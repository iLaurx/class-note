import type { SchoolYear, Student } from '../../domain/models';
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
export const matches = (student: Student, query: string) =>
  normalize(`${student.firstName} ${student.lastName}`).includes(normalize(query.trim()));
export const fullName = (student: Student) => `${student.lastName}, ${student.firstName}`;
export function localToday(year: SchoolYear) {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return today >= year.startDate && today <= year.endDate ? today : '';
}
