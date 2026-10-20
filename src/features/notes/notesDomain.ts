import type { Enrollment, SchoolYear, Student, StudentNote } from '../../domain/models.ts';
import { choice, record, requireRule, schoolDate, text } from '../../domain/validation.ts';
import { dateInYear, includesDate } from '../attendance/attendanceDomain.ts';
export interface NoteMember {
  enrollment: Enrollment;
  student: Student;
}
export const noteCategories = {
  academic: 'Académica',
  participation: 'Participación',
  behavior: 'Conducta',
  other: 'Otra',
} as const;
export function noteFields(input: unknown, year: SchoolYear, enrollment: Enrollment) {
  const data = record(input);
  requireRule(
    data.enrollmentId === undefined || data.enrollmentId === enrollment.id,
    'La matrícula propietaria de la observación no se puede cambiar.',
  );
  const date = dateInYear(data.date, year);
  requireRule(
    includesDate(enrollment, date),
    'La observación debe estar dentro del intervalo de matrícula, incluidos sus extremos.',
  );
  return {
    date,
    category: choice(
      data.category,
      ['academic', 'participation', 'behavior', 'other'] as const,
      'Categoría',
    ),
    body: text(data.body, 'Observación'),
  };
}
export function matchesNote(expected: unknown, current: StudentNote) {
  const data = record(expected);
  return (
    ['id', 'enrollmentId', 'date', 'category', 'body', 'createdAt', 'updatedAt'] as const
  ).every((key) => data[key] === current[key]);
}
export function noteHistory(
  notes: readonly StudentNote[],
  members: readonly NoteMember[],
  enrollmentId = '',
  category = '',
  from = '',
  to = '',
  search = '',
) {
  if (from) schoolDate(from);
  if (to) schoolDate(to);
  requireRule(!from || !to || from <= to, 'El inicio del rango no puede ser posterior al fin.');
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  const query = normalize(search.trim());
  return notes
    .filter((note) => {
      const member = members.find((item) => item.enrollment.id === note.enrollmentId);
      return (
        member &&
        (!enrollmentId || note.enrollmentId === enrollmentId) &&
        (!category || note.category === category) &&
        (!from || note.date >= from) &&
        (!to || note.date <= to) &&
        (!query ||
          normalize(`${member.student.firstName} ${member.student.lastName} ${note.body}`).includes(
            query,
          ))
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function noteMemberCondition({ enrollment, student }: NoteMember) {
  return `${enrollment.status === 'inactive' ? 'Matrícula inactiva' : 'Matrícula activa'}${!student.active ? ' · Alumno archivado' : ''} · Ingreso: ${enrollment.joinedAt} · ${enrollment.leftAt ? `Salida: ${enrollment.leftAt}` : 'Sin salida registrada'}`;
}
