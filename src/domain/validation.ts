export class ValidationError extends Error {}

export function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

export function record(value: unknown): Record<string, unknown> {
  requireRule(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    'Los datos no tienen un formato válido.',
  );
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string): string {
  requireRule(
    typeof value === 'string' && value.trim().length > 0,
    `${label}: completa este campo.`,
  );
  return value.trim();
}

export function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : text(value, label);
}

export function uuid(value: unknown): string {
  const result = text(value, 'Referencia');
  requireRule(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result),
    'La referencia no es válida.',
  );
  return result;
}

export function schoolDate(value: unknown): string {
  const result = text(value, 'Fecha');
  requireRule(/^\d{4}-\d{2}-\d{2}$/.test(result), 'Usa una fecha válida con formato AAAA-MM-DD.');
  const year = Number(result.slice(0, 4));
  const month = Number(result.slice(5, 7));
  const day = Number(result.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireRule(
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0),
    'La fecha no existe en el calendario.',
  );
  return result;
}

export function integer(value: unknown, min: number, max: number, label: string): number {
  requireRule(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max,
    `${label}: escribe un entero entre ${min} y ${max}.`,
  );
  return value;
}

export function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  requireRule(
    typeof value === 'string' && choices.includes(value as T),
    `${label}: selecciona una opción válida.`,
  );
  return value as T;
}

export function flag(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  requireRule(typeof value === 'boolean', 'El indicador debe ser verdadero o falso.');
  return value;
}
