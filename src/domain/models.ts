export type SchoolDate = string;
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type EnrollmentStatus = 'active' | 'inactive';
export type SubmissionStatus = 'pending' | 'submitted' | 'incomplete' | 'not_submitted';
export type NoteCategory = 'academic' | 'participation' | 'behavior' | 'other';
export type SettingValue = string | number | boolean | null;

export interface AuditedEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface SchoolYear extends AuditedEntity {
  label: string;
  startDate: SchoolDate;
  endDate: SchoolDate;
  archived: boolean;
}
export interface Group extends AuditedEntity {
  schoolYearId: string;
  grade: number;
  name: string;
  shift?: string;
  archived: boolean;
}
export interface Student extends AuditedEntity {
  firstName: string;
  lastName: string;
  active: boolean;
}
export interface Enrollment extends AuditedEntity {
  studentId: string;
  groupId: string;
  joinedAt: SchoolDate;
  leftAt?: SchoolDate;
  status: EnrollmentStatus;
}
export interface Attendance extends AuditedEntity {
  enrollmentId: string;
  date: SchoolDate;
  status: AttendanceStatus;
  note?: string;
}
export interface Assignment extends AuditedEntity {
  groupId: string;
  title: string;
  description?: string;
  assignedDate: SchoolDate;
  dueDate?: SchoolDate;
}
export interface Submission extends AuditedEntity {
  assignmentId: string;
  enrollmentId: string;
  status: SubmissionStatus;
  comment?: string;
}
export interface ReadingLog extends AuditedEntity {
  enrollmentId: string;
  date: SchoolDate;
  title: string;
  minutes: number;
  comment?: string;
}
export interface StudentNote extends AuditedEntity {
  enrollmentId: string;
  date: SchoolDate;
  category: NoteCategory;
  body: string;
}
export interface AppSetting {
  key: string;
  value: SettingValue;
}
