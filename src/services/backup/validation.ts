import { SCHEMA_V1 } from '../../db/database.ts';
import {
  choice,
  integer,
  record,
  requireRule,
  schoolDate,
  text,
  uuid,
} from '../../domain/validation.ts';

export const TABLE_NAMES = Object.keys(SCHEMA_V1) as (keyof typeof SCHEMA_V1)[];
export type TableName = (typeof TABLE_NAMES)[number];
export type BackupRows = Record<TableName, Record<string, unknown>[]>;
export const TABLE_LABELS: Record<TableName, string> = {
  schoolYears: 'Ciclos escolares',
  groups: 'Grupos',
  students: 'Alumnos',
  enrollments: 'Matrículas',
  attendance: 'Asistencias',
  assignments: 'Tareas',
  submissions: 'Entregas',
  readingLogs: 'Lecturas',
  studentNotes: 'Observaciones privadas',
  appSettings: 'Configuración',
};

export function timestamp(value: unknown): string {
  requireRule(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),
    'La auditoría no es válida.',
  );
  requireRule(
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
    'La auditoría no es válida.',
  );
  return value;
}
function exactKeys(row: Record<string, unknown>, required: string[], optional: string[] = []) {
  requireRule(
    required.every((k) => Object.hasOwn(row, k)) &&
      Object.keys(row).every((k) => required.includes(k) || optional.includes(k)),
    'El respaldo tiene campos incompletos o desconocidos.',
  );
}
const fields: Record<TableName, [string[], string[]]> = {
  schoolYears: [['label', 'startDate', 'endDate', 'archived'], []],
  groups: [['schoolYearId', 'grade', 'name', 'archived'], ['shift']],
  students: [['firstName', 'lastName', 'active'], []],
  enrollments: [['studentId', 'groupId', 'joinedAt', 'status'], ['leftAt']],
  attendance: [['enrollmentId', 'date', 'status'], ['note']],
  assignments: [
    ['groupId', 'title', 'assignedDate'],
    ['description', 'dueDate'],
  ],
  submissions: [['assignmentId', 'enrollmentId', 'status'], ['comment']],
  readingLogs: [['enrollmentId', 'date', 'title', 'minutes'], ['comment']],
  studentNotes: [['enrollmentId', 'date', 'category', 'body'], []],
  appSettings: [['key', 'value'], []],
};
export function validateRows(rows: BackupRows) {
  for (const name of TABLE_NAMES)
    for (const row of rows[name]) {
      const [required, optional] = fields[name];
      exactKeys(
        row,
        name === 'appSettings' ? required : ['id', 'createdAt', 'updatedAt', ...required],
        optional,
      );
      if (name === 'appSettings') {
        requireRule(text(row.key, 'Preferencia') === row.key, 'Preferencia inválida.');
        const value = row.value;
        requireRule(
          value === null ||
            typeof value === 'string' ||
            typeof value === 'boolean' ||
            (typeof value === 'number' && Number.isFinite(value)),
          'Preferencia inválida.',
        );
        continue;
      }
      requireRule(uuid(row.id) === row.id, 'UUID inválido.');
      timestamp(row.createdAt);
      timestamp(row.updatedAt);
      for (const key of [...required, ...optional]) {
        const value = row[key];
        if (value === undefined && optional.includes(key)) continue;
        if (key.endsWith('Id')) requireRule(uuid(value) === value, 'Referencia inválida.');
        else if (
          [
            'date',
            'startDate',
            'endDate',
            'joinedAt',
            'leftAt',
            'assignedDate',
            'dueDate',
          ].includes(key)
        )
          requireRule(schoolDate(value) === value, 'Fecha inválida.');
        else if (key === 'archived' || key === 'active')
          requireRule(typeof value === 'boolean', 'Indicador inválido.');
        else if (key === 'grade') integer(value, 1, 6, 'Grado');
        else if (key === 'minutes') integer(value, 0, 1440, 'Minutos');
        else if (key === 'status')
          choice(
            value,
            name === 'enrollments'
              ? ['active', 'inactive']
              : name === 'attendance'
                ? ['present', 'absent', 'late', 'excused']
                : ['pending', 'submitted', 'incomplete', 'not_submitted'],
            'Estado',
          );
        else if (key === 'category')
          choice(value, ['academic', 'participation', 'behavior', 'other'], 'Categoría');
        else
          requireRule(text(value, 'Texto') === value, 'El respaldo contiene texto sin normalizar.');
      }
    }
  const find = (name: TableName, id: unknown) => {
    const row = rows[name].find((r) => r.id === id);
    requireRule(row, 'El respaldo contiene referencias inexistentes.');
    return row;
  };
  const inRange = (date: unknown, from: unknown, to: unknown) => {
    requireRule(
      typeof date === 'string' &&
        typeof from === 'string' &&
        typeof to === 'string' &&
        date >= from &&
        date <= to,
      'El respaldo contiene fechas fuera de su intervalo.',
    );
  };
  const yearOf = (groupId: unknown) => find('schoolYears', find('groups', groupId).schoolYearId);
  const enrollmentDate = (id: unknown, date: unknown) => {
    const enrollment = find('enrollments', id),
      year = yearOf(enrollment.groupId);
    inRange(date, year.startDate, year.endDate);
    inRange(date, enrollment.joinedAt, enrollment.leftAt ?? year.endDate);
    return enrollment;
  };
  for (const row of rows.schoolYears) inRange(row.startDate, row.startDate, row.endDate);
  for (const row of rows.groups) find('schoolYears', row.schoolYearId);
  for (const row of rows.enrollments) {
    find('students', row.studentId);
    const year = yearOf(row.groupId);
    inRange(row.joinedAt, year.startDate, year.endDate);
    if (row.leftAt !== undefined) inRange(row.leftAt, row.joinedAt, year.endDate);
  }
  for (const name of ['attendance', 'readingLogs', 'studentNotes'] as const)
    for (const row of rows[name]) enrollmentDate(row.enrollmentId, row.date);
  for (const row of rows.assignments) {
    const year = yearOf(row.groupId);
    inRange(row.assignedDate, year.startDate, year.endDate);
    if (row.dueDate !== undefined) inRange(row.dueDate, row.assignedDate, year.endDate);
  }
  for (const row of rows.submissions) {
    const assignment = find('assignments', row.assignmentId);
    const enrollment = enrollmentDate(row.enrollmentId, assignment.assignedDate);
    requireRule(enrollment.groupId === assignment.groupId, 'La entrega pertenece a otro grupo.');
  }
}

export function parseBackup(source: string) {
  const envelope = record(JSON.parse(source) as unknown);
  exactKeys(envelope, [
    'format',
    'formatVersion',
    'appVersion',
    'schemaVersion',
    'createdAt',
    'data',
  ]);
  requireRule(
    envelope.format === 'classnote-backup' &&
      envelope.formatVersion === 1 &&
      envelope.schemaVersion === 1 &&
      envelope.appVersion === '0.1.0',
    'Formato o versión de respaldo incompatible.',
  );
  const createdAt = timestamp(envelope.createdAt);
  const payload = record(envelope.data);
  exactKeys(payload, ['formatName', 'formatVersion', 'data']);
  requireRule(
    payload.formatName === 'dexie' && payload.formatVersion === 1,
    'Formato Dexie incompatible.',
  );
  const data = record(payload.data);
  exactKeys(data, ['databaseName', 'databaseVersion', 'tables', 'data']);
  requireRule(
    data.databaseName === 'classnote' && data.databaseVersion === 1,
    'Esquema incompatible.',
  );
  requireRule(
    Array.isArray(data.tables) && data.tables.length === 10 && Array.isArray(data.data),
    'Faltan tablas del respaldo.',
  );
  const rows = Object.fromEntries(
    TABLE_NAMES.map((name) => [name, [] as Record<string, unknown>[]]),
  ) as BackupRows;
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  for (const input of data.tables) {
    const table = record(input);
    exactKeys(table, ['name', 'schema', 'rowCount']);
    const name = choice(table.name, TABLE_NAMES, 'Tabla');
    requireRule(!seen.has(name), 'Tabla repetida.');
    seen.add(name);
    // Dexie emits canonical index strings without whitespace.
    requireRule(table.schema === SCHEMA_V1[name].replaceAll(' ', ''), 'Índices incompatibles.');
    counts[name] = integer(table.rowCount, 0, Number.MAX_SAFE_INTEGER, 'Registros');
  }
  const chunks = new Set<string>();
  for (const input of data.data) {
    const chunk = record(input);
    exactKeys(chunk, ['tableName', 'inbound', 'rows']);
    const name = choice(chunk.tableName, TABLE_NAMES, 'Tabla');
    requireRule(
      chunk.inbound === true && Array.isArray(chunk.rows),
      'Contenido de tabla inválido.',
    );
    chunks.add(name);
    for (const inputRow of chunk.rows) {
      const row = { ...record(inputRow) };
      // Dexie Typeson encodes optional undefined values as 0 + an explicit tag.
      // Accept only that exact tag on known optional fields, never exotic objects.
      if (Object.hasOwn(row, '$types')) {
        const tags = record(row.$types);
        requireRule(Object.keys(tags).length > 0, 'Anotación de tipos inválida.');
        for (const [key, tag] of Object.entries(tags)) {
          requireRule(
            fields[name][1].includes(key) && tag === 'undef' && row[key] === 0,
            'Tipo de dato no admitido.',
          );
          row[key] = undefined;
        }
        delete row.$types;
      }
      rows[name].push(row);
    }
  }
  for (const name of TABLE_NAMES)
    requireRule(
      chunks.has(name) && counts[name] === rows[name].length,
      'Respaldo incompleto: conteos incorrectos.',
    );
  validateRows(rows);
  return {
    createdAt,
    appVersion: '0.1.0',
    schemaVersion: 1,
    formatVersion: 1,
    counts,
    rows,
    payload,
  };
}
