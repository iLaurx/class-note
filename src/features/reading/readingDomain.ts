import type { Enrollment, ReadingLog, SchoolYear, Student } from '../../domain/models.ts';
import {
  integer,
  optionalText,
  record,
  requireRule,
  schoolDate,
  text,
} from '../../domain/validation.ts';
import { dateInYear, includesDate } from '../attendance/attendanceDomain.ts';

export interface ReadingMember {
  enrollment: Enrollment;
  student: Student;
}
export function readingFields(input: unknown, year: SchoolYear, enrollment: Enrollment) {
  const data = record(input);
  requireRule(
    data.enrollmentId === undefined || data.enrollmentId === enrollment.id,
    'La matrícula propietaria de la lectura no se puede cambiar.',
  );
  const date = dateInYear(data.date, year);
  requireRule(
    includesDate(enrollment, date),
    'La lectura debe estar dentro del intervalo de matrícula, incluidos sus extremos.',
  );
  return {
    date,
    title: text(data.title, 'Título'),
    minutes: integer(data.minutes, 0, 1440, 'Minutos'),
    comment: optionalText(data.comment, 'Comentario'),
  };
}
export function matchesReading(expected: unknown, current: ReadingLog) {
  const data = record(expected);
  return (
    ['id', 'enrollmentId', 'date', 'title', 'minutes', 'comment', 'createdAt', 'updatedAt'] as const
  ).every((key) => data[key] === current[key]);
}
export function readingHistory(
  logs: readonly ReadingLog[],
  enrollmentId: string,
  from: string,
  to: string,
) {
  if (from) schoolDate(from);
  if (to) schoolDate(to);
  requireRule(!from || !to || from <= to, 'El inicio del historial no puede ser posterior al fin.');
  return logs
    .filter(
      (log) =>
        log.enrollmentId === enrollmentId && (!from || log.date >= from) && (!to || log.date <= to),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
function monthDays(year: number, month: number) {
  return [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]!;
}
// Civil calendar arithmetic only: no UTC conversion, timezone or DST involved.
export function readingWeek(value: string) {
  const date = schoolDate(value);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const prior = year - 1;
  let ordinal =
    prior * 365 +
    Math.floor(prior / 4) -
    Math.floor(prior / 100) +
    Math.floor(prior / 400) +
    day -
    1;
  for (let m = 1; m < month; m++) ordinal += monthDays(year, m);
  const mondayOffset = ordinal % 7;
  function shift(offset: number) {
    let y = year,
      m = month,
      d = day + offset;
    while (d < 1) {
      if (--m < 1) {
        m = 12;
        y--;
      }
      d += monthDays(y, m);
    }
    while (d > monthDays(y, m)) {
      d -= monthDays(y, m);
      if (++m > 12) {
        m = 1;
        y++;
      }
    }
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return { from: shift(-mondayOffset), to: shift(6 - mondayOffset) };
}
export function weeklyReadings(
  members: readonly ReadingMember[],
  logs: readonly ReadingLog[],
  date: string,
) {
  const week = readingWeek(date);
  const rows = members.map((member) => {
    const entries = logs.filter(
      (log) =>
        log.enrollmentId === member.enrollment.id && log.date >= week.from && log.date <= week.to,
    );
    return {
      ...member,
      minutes: entries.reduce((total, log) => total + log.minutes, 0),
      count: entries.length,
    };
  });
  return {
    ...week,
    rows,
    minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
    count: rows.reduce((sum, row) => sum + row.count, 0),
  };
}
export function memberCondition({ enrollment, student }: ReadingMember) {
  return `${enrollment.status === 'inactive' ? 'Matrícula inactiva' : 'Matrícula activa'}${!student.active ? ' · Alumno archivado' : ''} · Ingreso: ${enrollment.joinedAt} · ${enrollment.leftAt ? `Salida: ${enrollment.leftAt}` : 'Sin salida registrada'}`;
}
