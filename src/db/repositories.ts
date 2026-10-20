import {
  assignmentFields,
  matchesSubmission,
  submissionStates,
} from '../features/assignments/assignmentDomain.ts';
import {
  matchesReading,
  readingFields,
  readingHistory,
} from '../features/reading/readingDomain.ts';
import type { ClassNoteDatabase } from './database.ts';
import { StorageError, storageOperation } from './errors.ts';
import type {
  AuditedEntity,
  SettingValue,
  Enrollment,
  Student,
  Submission,
} from '../domain/models.ts';
import {
  dateInYear,
  includesDate,
  matchesAttendance,
} from '../features/attendance/attendanceDomain.ts';
import {
  choice,
  flag,
  integer,
  optionalText,
  record,
  requireRule,
  schoolDate,
  text,
  uuid,
} from '../domain/validation.ts';

export interface GroupContext {
  schoolYearId: string;
  groupId: string;
}
export interface EnrollmentContext extends GroupContext {
  enrollmentId: string;
}

function audit(): AuditedEntity {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

// Only these explicit operations are exposed to services; no generic CRUD API.
export class Repositories {
  private readonly db: ClassNoteDatabase;

  constructor(db: ClassNoteDatabase) {
    this.db = db;
  }

  private write<T>(operation: () => Promise<T>): Promise<T> {
    // All reference checks and writes share the transaction, including nested bulk writes.
    return storageOperation(() => this.db.transaction('rw', this.db.tables, operation));
  }

  private read<T>(operation: () => Promise<T>): Promise<T> {
    return storageOperation(() => this.db.transaction('r', this.db.tables, operation));
  }

  private async year(id: unknown) {
    const year = await this.db.schoolYears.get(uuid(id));
    requireRule(year, 'El ciclo escolar no existe.');
    return year;
  }

  private async group(context: GroupContext) {
    const year = await this.year(context.schoolYearId);
    const group = await this.db.groups.get(uuid(context.groupId));
    requireRule(
      group && group.schoolYearId === year.id,
      'El grupo no pertenece al ciclo indicado.',
    );
    return { year, group };
  }

  private async enrollment(context: EnrollmentContext) {
    const result = await this.group(context);
    const enrollment = await this.db.enrollments.get(uuid(context.enrollmentId));
    requireRule(
      enrollment && enrollment.groupId === result.group.id,
      'La matrícula no pertenece al grupo indicado.',
    );
    return { ...result, enrollment };
  }

  private async uniqueYear(label: string, exceptId?: string) {
    const existing = await this.db.schoolYears.where('label').equals(label).first();
    if (existing && existing.id !== exceptId)
      throw new StorageError('Ya existe un ciclo con esa etiqueta, incluso entre los archivados.');
  }

  private async uniqueGroup(schoolYearId: string, grade: number, name: string, exceptId?: string) {
    const existing = await this.db.groups
      .where('[schoolYearId+grade+name]')
      .equals([schoolYearId, grade, name])
      .first();
    if (existing && existing.id !== exceptId)
      throw new StorageError(
        'Ya existe un grupo con ese ciclo, grado y nombre, incluso entre los archivados.',
      );
  }

  createSchoolYear(input: unknown) {
    return this.write(async () => {
      const data = record(input);
      const startDate = schoolDate(data.startDate);
      const endDate = schoolDate(data.endDate);
      requireRule(startDate <= endDate, 'El inicio del ciclo no puede ser posterior al fin.');
      const value = {
        ...audit(),
        label: text(data.label, 'Nombre del ciclo'),
        startDate,
        endDate,
        archived: flag(data.archived, false),
      };
      await this.uniqueYear(value.label);
      await this.db.schoolYears.add(value);
      return value;
    });
  }

  listSchoolYears() {
    return this.read(() => this.db.schoolYears.orderBy('label').toArray());
  }

  createGroup(input: unknown) {
    return this.write(async () => {
      const data = record(input);
      const year = await this.year(data.schoolYearId);
      requireRule(!year.archived, 'Reactiva el ciclo antes de crear grupos.');
      const value = {
        ...audit(),
        schoolYearId: year.id,
        grade: integer(data.grade, 1, 6, 'Grado'),
        name: text(data.name, 'Nombre del grupo'),
        shift: optionalText(data.shift, 'Turno'),
        archived: flag(data.archived, false),
      };
      await this.uniqueGroup(year.id, value.grade, value.name);
      await this.db.groups.add(value);
      return value;
    });
  }

  listGroups(schoolYearId: string) {
    return this.read(async () => {
      const year = await this.year(schoolYearId);
      return this.db.groups.where('schoolYearId').equals(year.id).toArray();
    });
  }

  updateSchoolYear(id: string, input: unknown) {
    return this.write(async () => {
      const previous = await this.year(id);
      requireRule(!previous.archived, 'Reactiva el ciclo antes de editarlo.');
      const data = record(input);
      const startDate = schoolDate(data.startDate);
      const endDate = schoolDate(data.endDate);
      requireRule(startDate <= endDate, 'El inicio del ciclo no puede ser posterior al fin.');
      const groups = await this.db.groups.where('schoolYearId').equals(id).primaryKeys();
      const enrollments = await this.db.enrollments.where('groupId').anyOf(groups).toArray();
      for (const enrollment of enrollments) {
        requireRule(
          enrollment.joinedAt >= startDate &&
            enrollment.joinedAt <= endDate &&
            (enrollment.leftAt === undefined || enrollment.leftAt <= endDate),
          'El intervalo dejaría matrículas fuera del ciclo. Conserva sus fechas.',
        );
      }
      const attendance = await this.db.attendance
        .where('enrollmentId')
        .anyOf(enrollments.map((item) => item.id))
        .toArray();
      requireRule(
        attendance.every((item) => item.date >= startDate && item.date <= endDate),
        'El intervalo dejaría asistencias fuera del ciclo. Conserva sus fechas.',
      );
      const fields = { label: text(data.label, 'Nombre del ciclo'), startDate, endDate };
      if (
        previous.label === fields.label &&
        previous.startDate === startDate &&
        previous.endDate === endDate
      )
        return previous;
      const value = { ...previous, ...fields, updatedAt: new Date().toISOString() };
      await this.uniqueYear(value.label, id);
      await this.db.schoolYears.put(value);
      return value;
    });
  }

  updateGroup(context: GroupContext, input: unknown) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de editar.',
      );
      const data = record(input);
      requireRule(
        data.schoolYearId === undefined || data.schoolYearId === year.id,
        'El ciclo del grupo no se puede cambiar. Crea otro grupo para conservar el historial.',
      );
      const fields = {
        grade: integer(data.grade, 1, 6, 'Grado'),
        name: text(data.name, 'Nombre del grupo'),
        shift: optionalText(data.shift, 'Turno'),
      };
      if (
        group.grade === fields.grade &&
        group.name === fields.name &&
        group.shift === fields.shift
      )
        return group;
      const value = { ...group, ...fields, updatedAt: new Date().toISOString() };
      await this.uniqueGroup(year.id, value.grade, value.name, group.id);
      await this.db.groups.put(value);
      return value;
    });
  }

  private async storeContext(schoolYearId: string | null, groupId: string | null) {
    await this.db.appSettings.bulkPut([
      { key: 'work.schoolYearId', value: schoolYearId },
      { key: 'work.groupId', value: groupId },
    ]);
    return { schoolYearId, groupId };
  }

  private async validContext() {
    const savedYear = await this.db.appSettings.get('work.schoolYearId');
    const savedGroup = await this.db.appSettings.get('work.groupId');
    const year =
      typeof savedYear?.value === 'string'
        ? await this.db.schoolYears.get(savedYear.value)
        : undefined;
    const group =
      typeof savedGroup?.value === 'string'
        ? await this.db.groups.get(savedGroup.value)
        : undefined;
    const schoolYearId = year && !year.archived ? year.id : null;
    const groupId =
      schoolYearId && group && !group.archived && group.schoolYearId === schoolYearId
        ? group.id
        : null;
    if (
      (savedYear && savedYear.value !== schoolYearId) ||
      (savedGroup && savedGroup.value !== groupId)
    ) {
      await this.storeContext(schoolYearId, groupId);
    }
    return { schoolYearId, groupId };
  }

  loadWorkspace() {
    return this.write(async () => ({
      selection: await this.validContext(),
      years: await this.db.schoolYears.orderBy('label').toArray(),
      groups: await this.db.groups.toArray(),
    }));
  }

  selectContext(input: unknown) {
    return this.write(async () => {
      const data = record(input);
      const schoolYearId = data.schoolYearId === null ? null : uuid(data.schoolYearId);
      const groupId = data.groupId === null ? null : uuid(data.groupId);
      if (schoolYearId) {
        const year = await this.year(schoolYearId);
        requireRule(!year.archived, 'El ciclo está archivado.');
        if (groupId) {
          const { group } = await this.group({ schoolYearId, groupId });
          requireRule(!group.archived, 'El grupo está archivado.');
        }
      } else requireRule(groupId === null, 'Selecciona primero un ciclo escolar.');
      return this.storeContext(schoolYearId, groupId);
    });
  }

  archiveSchoolYear(id: string) {
    return this.setSchoolYearArchived(id, true);
  }
  reactivateSchoolYear(id: string) {
    return this.setSchoolYearArchived(id, false);
  }
  private setSchoolYearArchived(id: string, archived: boolean) {
    return this.write(async () => {
      const year = await this.year(id);
      if (year.archived !== archived)
        await this.db.schoolYears.put({ ...year, archived, updatedAt: new Date().toISOString() });
      await this.validContext();
    });
  }

  archiveGroup(context: GroupContext) {
    return this.setGroupArchived(context, true);
  }
  reactivateGroup(context: GroupContext) {
    return this.setGroupArchived(context, false);
  }
  private setGroupArchived(context: GroupContext, archived: boolean) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      requireRule(!year.archived, 'Reactiva el ciclo antes de cambiar el estado del grupo.');
      if (group.archived !== archived)
        await this.db.groups.put({ ...group, archived, updatedAt: new Date().toISOString() });
      await this.validContext();
    });
  }

  createStudent(input: unknown) {
    return this.write(async () => {
      const data = record(input);
      const value = {
        ...audit(),
        firstName: text(data.firstName, 'Nombre'),
        lastName: text(data.lastName, 'Apellidos'),
        active: flag(data.active, true),
      };
      await this.db.students.add(value);
      return value;
    });
  }

  getStudent(studentId: string) {
    return this.read(() => this.db.students.get(uuid(studentId)));
  }

  createEnrollment(context: GroupContext, input: unknown) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      const data = record(input);
      const studentId = uuid(data.studentId);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de matricular.',
      );
      const student = await this.db.students.get(studentId);
      requireRule(student?.active, 'El alumno debe estar activo para matricular.');
      const joinedAt = schoolDate(data.joinedAt);
      const leftAt = data.leftAt === undefined ? undefined : schoolDate(data.leftAt);
      requireRule(
        joinedAt >= year.startDate &&
          joinedAt <= year.endDate &&
          (leftAt === undefined || (leftAt >= joinedAt && leftAt <= year.endDate)),
        'Las fechas de matrícula deben estar ordenadas y dentro del ciclo.',
      );
      const value = {
        ...audit(),
        studentId,
        groupId: group.id,
        joinedAt,
        leftAt,
        status: choice(data.status, ['active', 'inactive'] as const, 'Estado de matrícula'),
      };
      await this.db.enrollments.add(value);
      return value;
    });
  }

  listEnrollments(context: GroupContext) {
    return this.read(async () => {
      const { group } = await this.group(context);
      return this.db.enrollments.where('groupId').equals(group.id).toArray();
    });
  }

  createStudentWithEnrollment(context: GroupContext, input: unknown) {
    return this.write(async () => {
      const data = record(input);
      const student = await this.createStudent({
        firstName: data.firstName,
        lastName: data.lastName,
      });
      const enrollment = await this.createEnrollment(context, {
        studentId: student.id,
        joinedAt: data.joinedAt,
        status: 'active',
      });
      return { student, enrollment };
    });
  }

  updateStudent(id: string, input: unknown) {
    return this.write(async () => {
      const previous = await this.db.students.get(uuid(id));
      requireRule(previous, 'El alumno no existe.');
      const data = record(input);
      const value = {
        ...previous,
        firstName: text(data.firstName, 'Nombre'),
        lastName: text(data.lastName, 'Apellidos'),
        updatedAt: new Date().toISOString(),
      };
      await this.db.students.put(value);
      return value;
    });
  }

  setStudentActive(id: string, active: unknown) {
    return this.write(async () => {
      const previous = await this.db.students.get(uuid(id));
      requireRule(previous, 'El alumno no existe.');
      const enabled = flag(active, true);
      const updatedAt = new Date().toISOString();
      if (!enabled) {
        const enrollments = await this.db.enrollments
          .where('studentId')
          .equals(previous.id)
          .toArray();
        for (const item of enrollments) {
          if (item.status === 'active')
            await this.db.enrollments.put({ ...item, status: 'inactive', updatedAt });
        }
      }
      await this.db.students.put({ ...previous, active: enabled, updatedAt });
    });
  }

  updateEnrollment(context: EnrollmentContext, input: unknown) {
    return this.write(async () => {
      const { year, group, enrollment } = await this.enrollment(context);
      const data = record(input);
      requireRule(
        (data.studentId === undefined || data.studentId === enrollment.studentId) &&
          (data.groupId === undefined || data.groupId === enrollment.groupId),
        'La identidad de la matrícula no se puede cambiar. Crea otra matrícula.',
      );
      const status = choice(data.status, ['active', 'inactive'] as const, 'Estado de matrícula');
      if (status === 'active') {
        const student = await this.db.students.get(enrollment.studentId);
        requireRule(
          student?.active && !year.archived && !group.archived,
          'Reactiva alumno, ciclo y grupo antes de activar la matrícula.',
        );
      }
      const joinedAt = schoolDate(data.joinedAt);
      const leftAt = data.leftAt === undefined ? undefined : schoolDate(data.leftAt);
      requireRule(
        joinedAt >= year.startDate &&
          joinedAt <= year.endDate &&
          (leftAt === undefined || (leftAt >= joinedAt && leftAt <= year.endDate)),
        'Las fechas de matrícula deben estar ordenadas y dentro del ciclo.',
      );
      const attendance = await this.db.attendance
        .where('enrollmentId')
        .equals(enrollment.id)
        .toArray();
      requireRule(
        attendance.every(
          (item) => item.date >= joinedAt && (leftAt === undefined || item.date <= leftAt),
        ),
        'El intervalo dejaría asistencias fuera de la matrícula. Conserva sus fechas.',
      );
      const value = {
        ...enrollment,
        joinedAt,
        leftAt,
        status,
        updatedAt: new Date().toISOString(),
      };
      await this.db.enrollments.put(value);
      return value;
    });
  }

  listGroupStudents(context: GroupContext) {
    return this.read(async () => {
      const { group } = await this.group(context);
      const enrollments = await this.db.enrollments.where('groupId').equals(group.id).toArray();
      return Promise.all(
        enrollments.map(async (enrollment) => {
          const student = await this.db.students.get(enrollment.studentId);
          requireRule(student, 'No se pudo resolver la ficha del alumno.');
          return { student, enrollment };
        }),
      );
    });
  }

  // Global records are read only in an explicit enrollment/history flow.
  listStudentRecords() {
    return this.read(async () => ({
      students: await this.db.students.toArray(),
      enrollments: await this.db.enrollments.toArray(),
      groups: await this.db.groups.toArray(),
      years: await this.db.schoolYears.toArray(),
    }));
  }

  createAttendance(context: EnrollmentContext, input: unknown) {
    return this.write(async () => {
      const { year, enrollment } = await this.enrollment(context);
      const data = record(input);
      const date = schoolDate(data.date);
      requireRule(
        date >= year.startDate &&
          date <= year.endDate &&
          date >= enrollment.joinedAt &&
          (enrollment.leftAt === undefined || date <= enrollment.leftAt),
        'La asistencia debe estar dentro del ciclo y del intervalo de matrícula, incluidos sus extremos.',
      );
      const value = {
        ...audit(),
        enrollmentId: enrollment.id,
        date,
        status: choice(
          data.status,
          ['present', 'absent', 'late', 'excused'] as const,
          'Asistencia',
        ),
        note: optionalText(data.note, 'Nota'),
      };
      await this.db.attendance.add(value);
      return value;
    });
  }

  createAttendanceBatch(context: EnrollmentContext, inputs: unknown) {
    return this.write(async () => {
      requireRule(Array.isArray(inputs) && inputs.length > 0, 'Agrega al menos una asistencia.');
      const result = [];
      for (const input of inputs) result.push(await this.createAttendance(context, input));
      return result;
    });
  }

  loadAttendanceDay(context: GroupContext, inputDate: unknown) {
    return this.read(async () => {
      const { year } = await this.group(context);
      const date = dateInYear(inputDate, year);
      const members = await this.listGroupStudents(context);
      const rows = [];
      for (const member of members.filter((item) => includesDate(item.enrollment, date))) {
        const attendance = await this.db.attendance
          .where('[enrollmentId+date]')
          .equals([member.enrollment.id, date])
          .first();
        rows.push({ ...member, attendance: attendance ?? null });
      }
      return rows.sort((a, b) =>
        `${a.student.lastName} ${a.student.firstName}`.localeCompare(
          `${b.student.lastName} ${b.student.firstName}`,
          'es',
        ),
      );
    });
  }

  saveAttendanceDay(
    context: GroupContext,
    inputDate: unknown,
    inputs: unknown,
    confirmedCorrections: unknown = false,
  ) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar asistencia.',
      );
      const date = dateInYear(inputDate, year);
      requireRule(
        Array.isArray(inputs) && inputs.length > 0,
        'Selecciona al menos un estado para guardar.',
      );
      const confirmed = flag(confirmedCorrections, false);
      const seen = new Set<string>();
      const result = [];
      for (const input of inputs) {
        const data = record(input);
        const enrollmentId = uuid(data.enrollmentId);
        requireRule(!seen.has(enrollmentId), 'La matrícula está repetida en el lote.');
        seen.add(enrollmentId);
        const { enrollment } = await this.enrollment({ ...context, enrollmentId });
        requireRule(
          includesDate(enrollment, date),
          'La fecha está fuera del intervalo de matrícula, incluidos sus extremos.',
        );
        const student = await this.db.students.get(enrollment.studentId);
        requireRule(student, 'No se pudo resolver la ficha del alumno.');
        const status = choice(
          data.status,
          ['present', 'absent', 'late', 'excused'] as const,
          'Asistencia',
        );
        const note = optionalText(data.note, 'Nota');
        const current = await this.db.attendance
          .where('[enrollmentId+date]')
          .equals([enrollmentId, date])
          .first();
        if (current && current.status === status && current.note === note) {
          result.push(current);
          continue;
        }
        requireRule(
          current ? matchesAttendance(data.expected, current) : data.expected === null,
          'La asistencia cambió en otra ventana. Conservamos tu borrador; revisa el día antes de volver a guardar.',
        );
        if (current) {
          requireRule(
            confirmed,
            'Confirma la corrección de los registros existentes antes de guardar.',
          );
          const updated = { ...current, status, note, updatedAt: new Date().toISOString() };
          await this.db.attendance.put(updated);
          result.push(updated);
        } else {
          result.push(
            await this.createAttendance({ ...context, enrollmentId }, { date, status, note }),
          );
        }
      }
      return result;
    });
  }

  listAttendance(context: EnrollmentContext) {
    return this.read(async () => {
      const { enrollment } = await this.enrollment(context);
      return this.db.attendance.where('enrollmentId').equals(enrollment.id).toArray();
    });
  }

  createAssignment(context: GroupContext, input: unknown) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar tareas.',
      );
      const data = record(input);
      requireRule(
        data.groupId === undefined || data.groupId === group.id,
        'La tarea no se puede trasladar a otro grupo.',
      );
      const value = { ...audit(), groupId: group.id, ...assignmentFields(input, year) };
      await this.db.assignments.add(value);
      return value;
    });
  }

  updateAssignment(context: GroupContext, assignmentId: string, input: unknown) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar tareas.',
      );
      const previous = await this.assignment(context, assignmentId);
      const data = record(input);
      requireRule(
        data.groupId === undefined || data.groupId === previous.groupId,
        'La tarea no se puede trasladar a otro grupo.',
      );
      const fields = assignmentFields(input, year);
      if (fields.assignedDate !== previous.assignedDate) {
        const submissions = await this.db.submissions
          .where('assignmentId')
          .equals(previous.id)
          .toArray();
        for (const submission of submissions) {
          const enrollment = await this.db.enrollments.get(submission.enrollmentId);
          requireRule(
            enrollment &&
              enrollment.groupId === group.id &&
              includesDate(enrollment, fields.assignedDate),
            'La nueva asignación dejaría entregas fuera de su población. Corrige primero el historial de matrícula.',
          );
        }
      }
      if (
        Object.entries(fields).every(
          ([key, value]) => previous[key as keyof typeof previous] === value,
        )
      )
        return previous;
      const value = { ...previous, ...fields, updatedAt: new Date().toISOString() };
      await this.db.assignments.put(value);
      return value;
    });
  }

  private async assignment(context: GroupContext, assignmentId: unknown) {
    await this.group(context);
    const assignment = await this.db.assignments.get(uuid(assignmentId));
    requireRule(
      assignment && assignment.groupId === context.groupId,
      'La tarea no existe o pertenece a otro grupo.',
    );
    return assignment;
  }

  loadAssignment(context: GroupContext, assignmentId: string) {
    return this.read(async () => {
      const assignment = await this.assignment(context, assignmentId);
      const enrollments = await this.db.enrollments
        .where('groupId')
        .equals(context.groupId)
        .toArray();
      const submissions = await this.db.submissions
        .where('assignmentId')
        .equals(assignment.id)
        .toArray();
      const rows: { enrollment: Enrollment; student: Student; submission: Submission | null }[] =
        [];
      for (const enrollment of enrollments) {
        const student = await this.db.students.get(enrollment.studentId);
        if (student && includesDate(enrollment, assignment.assignedDate)) {
          rows.push({
            enrollment,
            student,
            submission: submissions.find((item) => item.enrollmentId === enrollment.id) ?? null,
          });
        }
      }
      rows.sort(
        (a, b) =>
          `${a.student.lastName} ${a.student.firstName}`.localeCompare(
            `${b.student.lastName} ${b.student.firstName}`,
            'es',
          ) || a.enrollment.id.localeCompare(b.enrollment.id),
      );
      const incidents = [];
      for (const submission of submissions.filter(
        (item) => !rows.some((member) => member.enrollment.id === item.enrollmentId),
      )) {
        const enrollment = await this.db.enrollments.get(submission.enrollmentId);
        const student = enrollment ? await this.db.students.get(enrollment.studentId) : undefined;
        const reason = !enrollment
          ? 'Matrícula inexistente'
          : enrollment.groupId !== context.groupId
            ? 'Matrícula de otro grupo'
            : !student
              ? 'Ficha inexistente'
              : 'Fuera del intervalo de matrícula';
        incidents.push({ submission, enrollment, student, reason });
      }
      return { assignment, rows, incidents };
    });
  }

  saveSubmissions(
    context: GroupContext,
    assignmentId: string,
    inputs: unknown,
    confirmedCorrections: unknown = false,
    expectedAssignment?: unknown,
  ) {
    return this.write(async () => {
      const { year, group } = await this.group(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar entregas.',
      );
      const assignment = await this.assignment(context, assignmentId);
      dateInYear(assignment.assignedDate, year);
      if (expectedAssignment !== undefined) {
        const expected = record(expectedAssignment);
        requireRule(
          (
            [
              'id',
              'groupId',
              'assignedDate',
              'title',
              'description',
              'dueDate',
              'createdAt',
              'updatedAt',
            ] as const
          ).every((key) => expected[key] === assignment[key]),
          'La tarea cambió en otra ventana. Revisa los datos guardados.',
        );
      }
      requireRule(Array.isArray(inputs) && inputs.length > 0, 'Modifica al menos una entrega.');
      const confirmed = flag(confirmedCorrections, false);
      const seen = new Set<string>();
      const result = [];
      for (const input of inputs) {
        const data = record(input);
        const enrollmentId = uuid(data.enrollmentId);
        requireRule(!seen.has(enrollmentId), 'La matrícula está repetida en el lote.');
        seen.add(enrollmentId);
        const { enrollment } = await this.enrollment({ ...context, enrollmentId });
        requireRule(
          includesDate(enrollment, assignment.assignedDate),
          'La matrícula está fuera de la población de la tarea. Corrige primero el historial.',
        );
        requireRule(
          await this.db.students.get(enrollment.studentId),
          'No se pudo resolver la ficha del alumno.',
        );
        const status = choice(data.status, submissionStates, 'Entrega');
        const comment = optionalText(data.comment, 'Comentario');
        const current = await this.db.submissions
          .where('[assignmentId+enrollmentId]')
          .equals([assignment.id, enrollmentId])
          .first();
        if (current && current.status === status && current.comment === comment) {
          result.push(current);
          continue;
        }
        requireRule(
          current ? matchesSubmission(data.expected, current) : data.expected === null,
          'La entrega cambió en otra ventana. Conservamos tu borrador; revisa los datos guardados.',
        );
        if (current) {
          requireRule(
            confirmed,
            'Confirma la corrección de las entregas existentes antes de guardar.',
          );
          const value = { ...current, status, comment, updatedAt: new Date().toISOString() };
          await this.db.submissions.put(value);
          result.push(value);
        } else {
          result.push(
            await this.createSubmission(
              { ...context, enrollmentId },
              { assignmentId: assignment.id, status, comment },
            ),
          );
        }
      }
      return result;
    });
  }

  listAssignments(context: GroupContext) {
    return this.read(async () => {
      const { group } = await this.group(context);
      return this.db.assignments.where('groupId').equals(group.id).toArray();
    });
  }

  createSubmission(context: EnrollmentContext, input: unknown) {
    return this.write(async () => {
      const { year, group, enrollment } = await this.enrollment(context);
      const data = record(input);
      const assignment = await this.db.assignments.get(uuid(data.assignmentId));
      requireRule(
        assignment && assignment.groupId === group.id,
        'La tarea no existe o pertenece a otro grupo.',
      );
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar entregas.',
      );
      dateInYear(assignment.assignedDate, year);
      requireRule(
        includesDate(enrollment, assignment.assignedDate),
        'La matrícula está fuera de la población de la tarea.',
      );
      const value = {
        ...audit(),
        assignmentId: assignment.id,
        enrollmentId: enrollment.id,
        status: choice(
          data.status,
          ['pending', 'submitted', 'incomplete', 'not_submitted'] as const,
          'Entrega',
        ),
        comment: optionalText(data.comment, 'Comentario'),
      };
      await this.db.submissions.add(value);
      return value;
    });
  }

  listSubmissions(context: EnrollmentContext) {
    return this.read(async () => {
      const { enrollment } = await this.enrollment(context);
      return this.db.submissions.where('enrollmentId').equals(enrollment.id).toArray();
    });
  }

  createReadingLog(context: EnrollmentContext, input: unknown) {
    return this.write(async () => {
      const { year, group, enrollment } = await this.enrollment(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar lecturas.',
      );
      requireRule(
        await this.db.students.get(enrollment.studentId),
        'No se pudo resolver la ficha del alumno.',
      );
      const value = {
        ...audit(),
        enrollmentId: enrollment.id,
        ...readingFields(input, year, enrollment),
      };
      await this.db.readingLogs.add(value);
      return value;
    });
  }

  listReadingLogs(context: EnrollmentContext) {
    return this.read(async () => {
      const { enrollment } = await this.enrollment(context);
      return readingHistory(
        await this.db.readingLogs.where('enrollmentId').equals(enrollment.id).toArray(),
        enrollment.id,
        '',
        '',
      );
    });
  }

  updateReadingLog(
    context: EnrollmentContext,
    readingId: string,
    input: unknown,
    expected: unknown,
  ) {
    return this.write(async () => {
      const { year, group, enrollment } = await this.enrollment(context);
      requireRule(
        !year.archived && !group.archived,
        'Reactiva el ciclo y el grupo antes de guardar lecturas.',
      );
      requireRule(
        await this.db.students.get(enrollment.studentId),
        'No se pudo resolver la ficha del alumno.',
      );
      const previous = await this.db.readingLogs.get(uuid(readingId));
      requireRule(
        previous && previous.enrollmentId === enrollment.id,
        'La lectura no pertenece a la matrícula indicada.',
      );
      const fields = readingFields(input, year, enrollment);
      requireRule(
        matchesReading(expected, previous),
        'La lectura cambió en otra ventana. Conservamos tu borrador; consulta los datos guardados antes de corregir.',
      );
      if (
        Object.entries(fields).every(
          ([key, value]) => previous[key as keyof typeof previous] === value,
        )
      )
        return previous;
      const value = { ...previous, ...fields, updatedAt: new Date().toISOString() };
      await this.db.readingLogs.put(value);
      return value;
    });
  }

  loadReadingGroup(context: GroupContext) {
    return this.read(async () => {
      await this.group(context);
      const members = await this.listGroupStudents(context);
      members.sort(
        (a, b) =>
          `${a.student.lastName} ${a.student.firstName}`.localeCompare(
            `${b.student.lastName} ${b.student.firstName}`,
            'es',
          ) || a.enrollment.id.localeCompare(b.enrollment.id),
      );
      const logs = await this.db.readingLogs
        .where('enrollmentId')
        .anyOf(members.map((member) => member.enrollment.id))
        .toArray();
      return { members, logs };
    });
  }

  createStudentNote(context: EnrollmentContext, input: unknown) {
    return this.write(async () => {
      const { enrollment } = await this.enrollment(context);
      const data = record(input);
      const value = {
        ...audit(),
        enrollmentId: enrollment.id,
        date: schoolDate(data.date),
        category: choice(
          data.category,
          ['academic', 'participation', 'behavior', 'other'] as const,
          'Categoría',
        ),
        body: text(data.body, 'Observación'),
      };
      await this.db.studentNotes.add(value);
      return value;
    });
  }

  listStudentNotes(context: EnrollmentContext) {
    return this.read(async () => {
      const { enrollment } = await this.enrollment(context);
      return this.db.studentNotes.where('enrollmentId').equals(enrollment.id).toArray();
    });
  }

  createSetting(input: unknown) {
    return this.write(async () => {
      const data = record(input);
      const value = data.value;
      requireRule(
        value === null ||
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value)),
        'El valor de configuración no es válido.',
      );
      const setting = {
        key: text(data.key, 'Clave de configuración'),
        value: value as SettingValue,
      };
      await this.db.appSettings.add(setting);
      return setting;
    });
  }

  getSetting(key: string) {
    return this.read(() => this.db.appSettings.get(text(key, 'Clave de configuración')));
  }
}
