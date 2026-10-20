import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { fillRelated, createFixture } from './fixtures.ts';
import { groupWorkbook, safeCell } from '../../src/services/export/groupWorkbook.ts';

async function open(bytes: Uint8Array) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return book;
}
test('CN011 XLSX real: cuatro hojas, español, valores, rango local inclusivo y aislamiento', async (t) => {
  const db = new ClassNoteDatabase(`cn011-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  const other = await createFixture(r, 'Otro ciclo');
  const sibling = await r.createGroup({ schoolYearId: f.year.id, grade: 2, name: 'Otro grupo' });
  const siblingEnrollment = await r.createEnrollment(
    { schoolYearId: f.year.id, groupId: sibling.id },
    { studentId: f.student.id, joinedAt: '2026-08-01', status: 'active' },
  );
  await r.createReadingLog(
    { schoolYearId: f.year.id, groupId: sibling.id, enrollmentId: siblingEnrollment.id },
    { date: '2026-10-19', title: 'OTRO_GRUPO', minutes: 99 },
  );
  await r.createReadingLog(other.enrollmentContext, {
    date: '2026-10-19',
    title: 'EXCLUIDO',
    minutes: 99,
  });
  await r.createAttendance(f.enrollmentContext, { date: '2026-10-18', status: 'absent' });
  await r.createReadingLog(f.enrollmentContext, {
    date: '2026-10-20',
    title: 'Árbol y canción',
    minutes: 0,
    comment: 'Sí, leyó',
  });
  await r.createReadingLog(f.enrollmentContext, { date: '2026-10-21', title: 'FUERA', minutes: 9 });
  const pending = await r.createAssignment(f.context, {
    title: 'Álgebra',
    description: 'Descripción',
    assignedDate: '2026-10-20',
    dueDate: '2026-11-01',
  });
  const late = await r.createStudent({ firstName: 'Nueva', lastName: 'Álvarez' });
  await r.createEnrollment(f.context, {
    studentId: late.id,
    joinedAt: '2026-11-01',
    status: 'inactive',
  });
  const before = await Promise.all(db.tables.map((table) => table.toArray()));
  const data = await r.loadGroupReport(f.context, '2026-10-19', '2026-10-20');
  const book = await open(await groupWorkbook(data));
  assert.deepEqual(
    book.worksheets.map((sheet) => sheet.name),
    ['Alumnos', 'Asistencia', 'Tareas', 'Lecturas'],
  );
  for (const [sheet, headers] of [
    [
      'Alumnos',
      [
        'Matrícula',
        'Alumno',
        'Grado',
        'Grupo',
        'Turno',
        'Estado',
        'Fecha de matrícula',
        'Fecha de salida',
      ],
    ],
    [
      'Tareas',
      [
        'Tarea',
        'Descripción',
        'Fecha de asignación',
        'Fecha de entrega',
        'Alumno',
        'Estado de entrega',
        'Comentario',
      ],
    ],
    ['Lecturas', ['Fecha', 'Alumno', 'Título', 'Minutos', 'Comentario']],
  ] as const)
    assert.deepEqual(
      (book.getWorksheet(sheet)!.getRow(1).values as ExcelJS.CellValue[]).slice(1),
      headers,
    );
  assert.equal(book.getWorksheet('Alumnos')!.rowCount, 3);
  assert.equal(book.getWorksheet('Alumnos')!.getCell('B2').value, 'Álvarez, Nueva');
  assert.deepEqual(
    (book.getWorksheet('Asistencia')!.getRow(1).values as ExcelJS.CellValue[]).slice(1),
    ['Fecha', 'Alumno', 'Estado', 'Nota'],
  );
  assert.deepEqual(
    (book.getWorksheet('Asistencia')!.getRow(2).values as ExcelJS.CellValue[]).slice(1),
    ['19/10/2026', 'Prueba, Alumno ficticio', 'Presente', ''],
  );
  assert.equal(book.getWorksheet('Asistencia')!.rowCount, 2);
  assert.equal(book.getWorksheet('Lecturas')!.getCell('D3').value, 0);
  assert.equal(book.getWorksheet('Lecturas')!.getCell('C3').value, 'Árbol y canción');
  assert.equal(book.getWorksheet('Lecturas')!.rowCount, 3);
  assert.equal(book.getWorksheet('Tareas')!.getCell('A3').value, pending.title);
  assert.equal(book.getWorksheet('Tareas')!.getCell('F3').value, 'Pendiente');
  assert.equal(book.getWorksheet('Tareas')!.getCell('D3').value, '01/11/2026');
  assert.equal(book.getWorksheet('Tareas')!.getCell('F2').value, 'Entregada');
  assert.doesNotMatch(
    JSON.stringify(book.model),
    /EXCLUIDO|OTRO_GRUPO|FUERA|Observación sintética|synthetic-test/,
  );
  assert.deepEqual(await Promise.all(db.tables.map((table) => table.toArray())), before);
  await assert.rejects(
    r.loadGroupReport({ ...f.context, schoolYearId: other.year.id }, '2026-10-19', '2026-10-20'),
  );
  await assert.rejects(r.loadGroupReport(f.context, '2026-10-20', '2026-10-19'));
  await assert.rejects(r.loadGroupReport(f.context, '2026-02-29', '2026-10-19'));
});

test('CN011 vacíos, tarea sin destinatarios y rango de un día sin conversión UTC', async (t) => {
  const db = new ClassNoteDatabase(`cn011-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await createFixture(r);
  const group = await r.createGroup({ schoolYearId: f.year.id, grade: 3, name: 'Vacío' });
  const context = { schoolYearId: f.year.id, groupId: group.id };
  const book = await open(
    await groupWorkbook(await r.loadGroupReport(context, '2026-10-19', '2026-10-19')),
  );
  for (const sheet of book.worksheets)
    assert.equal(sheet.getCell('A2').value, 'Sin registros para este reporte.');
  await r.createAssignment(context, { title: 'Sin alumnos', assignedDate: '2026-10-19' });
  const next = await open(
    await groupWorkbook(await r.loadGroupReport(context, '2026-10-19', '2026-10-19')),
  );
  assert.equal(next.getWorksheet('Tareas')!.getCell('E2').value, 'Sin matrículas aplicables');
});

test('CN011 neutraliza todas las columnas de texto libre al reabrir XLSX sin fórmulas', async (t) => {
  const db = new ClassNoteDatabase(`cn011-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  for (const prefix of [
    '=',
    '+',
    '-',
    '@',
    '\t',
    '\r',
    ' =',
    '  +',
    ' -',
    ' @',
    ' \t',
    ' \r',
    '\n=',
  ]) {
    const danger = `${prefix}HYPERLINK("https://example.invalid")`;
    assert.equal(safeCell(danger), `'${danger}`);
    const data = await r.loadGroupReport(f.context, '2026-10-19', '2026-10-19');
    data.students[0]!.lastName = danger;
    data.group.name = danger;
    data.group.shift = danger;
    data.attendance[0]!.note = danger;
    data.assignments[0]!.title = danger;
    data.assignments[0]!.description = danger;
    data.submissions[0]!.comment = danger;
    data.readings[0]!.title = danger;
    data.readings[0]!.comment = danger;
    const book = await open(await groupWorkbook(data));
    for (const [sheet, cells] of [
      ['Alumnos', ['B2', 'D2', 'E2']],
      ['Asistencia', ['B2', 'D2']],
      ['Tareas', ['A2', 'B2', 'E2', 'G2']],
      ['Lecturas', ['B2', 'C2', 'E2']],
    ] as const) {
      for (const address of cells) {
        const cell = book.getWorksheet(sheet)!.getCell(address);
        assert.equal(cell.type, ExcelJS.ValueType.String);
        assert.ok(
          String(cell.value).startsWith(`'${danger.replaceAll('\r', '\n')}`),
          `${sheet}:${address} ${JSON.stringify(cell.value)} versus ${JSON.stringify(danger)}`,
        );
      }
    }
    for (const sheet of book.worksheets)
      sheet.eachRow((row) =>
        row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)),
      );
  }
  assert.equal(safeCell('Árbol'), 'Árbol');
});
