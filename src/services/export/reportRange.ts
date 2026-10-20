import { requireRule, schoolDate } from '../../domain/validation.ts';

export function reportRange(fromInput: unknown, toInput: unknown) {
  const from = schoolDate(fromInput);
  const to = schoolDate(toInput);
  requireRule(from <= to, 'La fecha inicial no puede ser posterior a la final.');
  return { from, to };
}
