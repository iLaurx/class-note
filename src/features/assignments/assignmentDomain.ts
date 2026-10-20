import type { Assignment, SchoolYear, Submission, SubmissionStatus } from '../../domain/models.ts';
import { dateInYear } from '../attendance/attendanceDomain.ts';
import { optionalText, record, requireRule, text } from '../../domain/validation.ts';

export const submissionLabels = {
  pending: 'Pendiente',
  submitted: 'Entregada',
  incomplete: 'Incompleta',
  not_submitted: 'No entregada',
} satisfies Record<SubmissionStatus, string>;
export const submissionStates = ['pending', 'submitted', 'incomplete', 'not_submitted'] as const;
export function assignmentFields(input: unknown, year: SchoolYear) {
  const data = record(input);
  const assignedDate = dateInYear(data.assignedDate, year);
  const dueDate = data.dueDate === undefined ? undefined : dateInYear(data.dueDate, year);
  requireRule(
    dueDate === undefined || dueDate >= assignedDate,
    'La entrega no puede ser anterior a la asignación.',
  );
  return {
    title: text(data.title, 'Título'),
    description: optionalText(data.description, 'Descripción'),
    assignedDate,
    dueDate,
  };
}
export interface SubmissionDraft {
  enrollmentId: string;
  status: SubmissionStatus;
  comment: string;
  expected: Submission | null;
}
export function submissionChanged(row: SubmissionDraft) {
  return (
    row.status !== (row.expected?.status ?? 'pending') ||
    row.comment.trim() !== (row.expected?.comment ?? '')
  );
}
export function matchesSubmission(value: unknown, current: Submission) {
  if (typeof value !== 'object' || value === null) return false;
  const expected = value as Record<string, unknown>;
  return (
    ['id', 'assignmentId', 'enrollmentId', 'status', 'comment', 'createdAt', 'updatedAt'] as const
  ).every((key) => expected[key] === current[key]);
}
export function submissionCounts(rows: readonly SubmissionDraft[]) {
  const counts = {
    pending: 0,
    submitted: 0,
    incomplete: 0,
    not_submitted: 0,
    uncaptured: 0,
    total: rows.length,
  };
  for (const row of rows) {
    counts[row.status]++;
    if (!row.expected && !submissionChanged(row)) counts.uncaptured++;
  }
  return counts;
}
export function searchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}
export function filterAssignments(
  rows: readonly Assignment[],
  query: string,
  from: string,
  to: string,
) {
  return rows
    .filter(
      (row) =>
        searchText(row.title).includes(searchText(query)) &&
        (!from || row.assignedDate >= from) &&
        (!to || row.assignedDate <= to),
    )
    .sort((a, b) => b.assignedDate.localeCompare(a.assignedDate) || a.id.localeCompare(b.id));
}
