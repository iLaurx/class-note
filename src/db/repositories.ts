import type { ClassNoteDatabase } from './database.ts';
import { StorageError, storageOperation } from './errors.ts';
import type { AuditedEntity, SettingValue } from '../domain/models.ts';
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

  listAttendance(context: EnrollmentContext) {
    return this.read(async () => {
      const { enrollment } = await this.enrollment(context);
      return this.db.attendance.where('enrollmentId').equals(enrollment.id).toArray();
    });
  }

  createAssignment(context: GroupContext, input: unknown) {
    return this.write(async () => {
      const { group } = await this.group(context);
      const data = record(input);
      const assignedDate = schoolDate(data.assignedDate);
      const dueDate = data.dueDate === undefined ? undefined : schoolDate(data.dueDate);
      requireRule(
        dueDate === undefined || dueDate >= assignedDate,
        'La entrega no puede ser anterior a la asignación.',
      );
      const value = {
        ...audit(),
        groupId: group.id,
        title: text(data.title, 'Título'),
        description: optionalText(data.description, 'Descripción'),
        assignedDate,
        dueDate,
      };
      await this.db.assignments.add(value);
      return value;
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
      const { group, enrollment } = await this.enrollment(context);
      const data = record(input);
      const assignment = await this.db.assignments.get(uuid(data.assignmentId));
      requireRule(
        assignment && assignment.groupId === group.id,
        'La tarea no existe o pertenece a otro grupo.',
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
      const { enrollment } = await this.enrollment(context);
      const data = record(input);
      const value = {
        ...audit(),
        enrollmentId: enrollment.id,
        date: schoolDate(data.date),
        title: text(data.title, 'Título'),
        minutes: integer(data.minutes, 0, Number.MAX_SAFE_INTEGER, 'Minutos'),
        comment: optionalText(data.comment, 'Comentario'),
      };
      await this.db.readingLogs.add(value);
      return value;
    });
  }

  listReadingLogs(context: EnrollmentContext) {
    return this.read(async () => {
      const { enrollment } = await this.enrollment(context);
      return this.db.readingLogs.where('enrollmentId').equals(enrollment.id).toArray();
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
