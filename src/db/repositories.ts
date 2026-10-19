import type { ClassNoteDatabase } from './database.ts';
import { storageOperation } from './errors.ts';
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
      const value = {
        ...audit(),
        schoolYearId: year.id,
        grade: integer(data.grade, 1, 6, 'Grado'),
        name: text(data.name, 'Nombre del grupo'),
        shift: optionalText(data.shift, 'Turno'),
        archived: flag(data.archived, false),
      };
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
      requireRule(await this.db.students.get(studentId), 'El alumno no existe.');
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
