import type { Student, Enrollment } from '../../domain/models';
export type StudentFormState =
  | { kind: 'new' | 'existing' }
  | { kind: 'edit'; student: Student }
  | { kind: 'dates' | 'leave' | 'reactivate'; enrollment: Enrollment }
  | { kind: 'archive'; student: Student };
