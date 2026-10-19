import Dexie, { type Table } from 'dexie';
import type {
  SchoolYear,
  Group,
  Student,
  Enrollment,
  Attendance,
  Assignment,
  Submission,
  ReadingLog,
  StudentNote,
  AppSetting,
} from '../domain/models.ts';

export const DATABASE_NAME = 'classnote';
export const SCHEMA_V1 = {
  schoolYears: 'id, &label',
  groups: 'id, schoolYearId, &[schoolYearId+grade+name]',
  students: 'id, lastName',
  enrollments: 'id, studentId, groupId, &[studentId+groupId]',
  attendance: 'id, &[enrollmentId+date]',
  assignments: 'id, groupId, [groupId+assignedDate]',
  submissions: 'id, assignmentId, enrollmentId, &[assignmentId+enrollmentId]',
  readingLogs: 'id, [enrollmentId+date]',
  studentNotes: 'id, [enrollmentId+date]',
  appSettings: 'key',
} as const;

export class ClassNoteDatabase extends Dexie {
  schoolYears!: Table<SchoolYear, string>;
  groups!: Table<Group, string>;
  students!: Table<Student, string>;
  enrollments!: Table<Enrollment, string>;
  attendance!: Table<Attendance, string>;
  assignments!: Table<Assignment, string>;
  submissions!: Table<Submission, string>;
  readingLogs!: Table<ReadingLog, string>;
  studentNotes!: Table<StudentNote, string>;
  appSettings!: Table<AppSetting, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
  }
}
