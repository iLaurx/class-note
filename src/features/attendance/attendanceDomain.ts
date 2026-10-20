import type { Attendance, AttendanceStatus, Enrollment, SchoolYear } from '../../domain/models.ts';
import { requireRule, schoolDate } from '../../domain/validation.ts';

export const attendanceLabels = {
  present: 'Presente',
  absent: 'Falta',
  late: 'Retardo',
  excused: 'Falta justificada',
} satisfies Record<AttendanceStatus, string>;

export function dateInYear(value: unknown, year: SchoolYear) {
  const date = schoolDate(value);
  requireRule(
    date >= year.startDate && date <= year.endDate,
    'Elige una fecha dentro del ciclo escolar.',
  );
  return date;
}
export function includesDate(enrollment: Enrollment, date: string) {
  return (
    enrollment.joinedAt <= date && (enrollment.leftAt === undefined || date <= enrollment.leftAt)
  );
}
export function defaultDate(year: SchoolYear, now = new Date()) {
  const today = `${now.getFullYear().toString().padStart(4, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  return today >= year.startDate && today <= year.endDate ? today : '';
}
export interface AttendanceDraft {
  enrollmentId: string;
  status: AttendanceStatus | '';
  note: string;
  expected: Attendance | null;
}
export function isChanged(row: AttendanceDraft) {
  return (
    row.status !== (row.expected?.status ?? '') || row.note.trim() !== (row.expected?.note ?? '')
  );
}
export function attendanceCounts(rows: readonly { status: AttendanceStatus | '' }[]) {
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unregistered: 0,
    total: rows.length,
  };
  for (const row of rows) {
    if (row.status) counts[row.status]++;
    else counts.unregistered++;
  }
  return counts;
}

// Compare values as well as audit timestamps: two writes may share a millisecond.
export function matchesAttendance(value: unknown, current: Attendance) {
  if (typeof value !== 'object' || value === null) return false;
  const expected = value as Record<string, unknown>;
  return (
    ['id', 'enrollmentId', 'date', 'status', 'note', 'createdAt', 'updatedAt'] as const
  ).every((key) => expected[key] === current[key]);
}
