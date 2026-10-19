import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase, SCHEMA_V1 } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { StorageService } from '../../src/db/storage.ts';
import { ValidationError, schoolDate } from '../../src/domain/validation.ts';
import { StorageError } from '../../src/db/errors.ts';
import { createFixture, fillRelated } from './fixtures.ts';

function setup() {
  const db = new ClassNoteDatabase(`classnote-test-${crypto.randomUUID()}`);
  return { db, repositories: new Repositories(db) };
}

test('v1 abre vacía con diez stores e inicialización repetida sin duplicados', async (t) => {
  const { db } = setup();
  t.after(() => db.delete());
  const service = new StorageService(db);
  assert.equal(service.getSnapshot().status, 'loading');
  const first = service.initialize();
  assert.equal(service.getSnapshot().status, 'loading');
  assert.equal(first, service.initialize());
  await first;
  await service.initialize();
  assert.equal(service.getSnapshot().status, 'ready');
  assert.equal(db.verno, 1);
  assert.deepEqual(db.tables.map((table) => table.name).sort(), Object.keys(SCHEMA_V1).sort());
  for (const table of db.tables) assert.equal(await table.count(), 0);
});

test('inserta/consulta todas las entidades y conserva IDs, valores y relaciones tras reapertura v1', async (t) => {
  const { db, repositories } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(repositories);
  assert.equal((await repositories.listSchoolYears())[0]?.id, f.year.id);
  assert.equal((await repositories.listGroups(f.year.id))[0]?.id, f.group.id);
  assert.deepEqual(await repositories.getStudent(f.student.id), f.student);
  assert.equal((await repositories.listEnrollments(f.context))[0]?.studentId, f.student.id);
  assert.equal((await repositories.listAssignments(f.context))[0]?.id, f.assignment.id);
  assert.equal((await repositories.listAttendance(f.enrollmentContext))[0]?.status, 'present');
  assert.equal(
    (await repositories.listSubmissions(f.enrollmentContext))[0]?.assignmentId,
    f.assignment.id,
  );
  assert.equal((await repositories.listReadingLogs(f.enrollmentContext))[0]?.minutes, 12);
  assert.equal((await repositories.listStudentNotes(f.enrollmentContext))[0]?.category, 'academic');
  assert.equal((await repositories.getSetting('synthetic-test'))?.value, true);
  const snapshot = await Promise.all(db.tables.map((table) => table.toArray()));
  db.close();
  const reopened = new ClassNoteDatabase(db.name);
  t.after(() => reopened.close());
  await reopened.open();
  assert.deepEqual(await Promise.all(reopened.tables.map((table) => table.toArray())), snapshot);
  reopened.close();
});

test('índices únicos rechazan ciclos, grupos, matrícula, asistencia y entrega duplicados', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  await assert.rejects(r.createSchoolYear({ ...f.year }), StorageError);
  await assert.rejects(r.createGroup({ ...f.group, shift: 'Otro turno' }), StorageError);
  await assert.rejects(r.createEnrollment(f.context, f.enrollment), StorageError);
  const attendance = { date: '2026-10-19', status: 'present' };
  await r.createAttendance(f.enrollmentContext, attendance);
  await assert.rejects(r.createAttendance(f.enrollmentContext, attendance), StorageError);
  const submission = { assignmentId: f.assignment.id, status: 'pending' };
  await r.createSubmission(f.enrollmentContext, submission);
  await assert.rejects(r.createSubmission(f.enrollmentContext, submission), StorageError);
});

test('referencias inexistentes se rechazan antes de escribir', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const missing = crypto.randomUUID();
  await assert.rejects(r.createGroup({ ...f.group, schoolYearId: missing }), ValidationError);
  await assert.rejects(
    r.createEnrollment(f.context, { ...f.enrollment, studentId: missing }),
    ValidationError,
  );
  await assert.rejects(
    r.createAssignment({ ...f.context, groupId: missing }, f.assignment),
    ValidationError,
  );
  const context = { ...f.enrollmentContext, enrollmentId: missing };
  await assert.rejects(
    r.createAttendance(context, { date: '2026-10-19', status: 'present' }),
    ValidationError,
  );
  await assert.rejects(
    r.createReadingLog(context, { date: '2026-10-19', title: 'Prueba', minutes: 0 }),
    ValidationError,
  );
  await assert.rejects(
    r.createStudentNote(context, { date: '2026-10-19', category: 'other', body: 'Prueba' }),
    ValidationError,
  );
  await assert.rejects(
    r.createSubmission(f.enrollmentContext, { assignmentId: missing, status: 'pending' }),
    ValidationError,
  );
  assert.equal(await db.attendance.count(), 0);
});

test('dos ciclos y grupos no mezclan consultas ni aceptan entregas cruzadas', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const a = await createFixture(r, 'Ciclo sintético A');
  const b = await createFixture(r, 'Ciclo sintético B');
  for (const f of [a, b]) {
    await r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'late' });
    await r.createReadingLog(f.enrollmentContext, {
      date: '2026-10-19',
      title: f.year.label,
      minutes: 0,
    });
    await r.createStudentNote(f.enrollmentContext, {
      date: '2026-10-19',
      category: 'other',
      body: f.year.label,
    });
    await r.createSubmission(f.enrollmentContext, {
      assignmentId: f.assignment.id,
      status: 'pending',
    });
    assert.deepEqual(await r.listGroups(f.year.id), [f.group]);
    assert.deepEqual(await r.listEnrollments(f.context), [f.enrollment]);
    assert.deepEqual(await r.listAssignments(f.context), [f.assignment]);
    for (const list of [
      r.listAttendance.bind(r),
      r.listReadingLogs.bind(r),
      r.listStudentNotes.bind(r),
      r.listSubmissions.bind(r),
    ]) {
      const records = await list(f.enrollmentContext);
      assert.equal(records.length, 1);
      assert.equal(records[0]?.enrollmentId, f.enrollment.id);
    }
  }
  await assert.rejects(
    r.createSubmission(a.enrollmentContext, { assignmentId: b.assignment.id, status: 'submitted' }),
    ValidationError,
  );
  await assert.rejects(
    r.listEnrollments({ schoolYearId: a.year.id, groupId: b.group.id }),
    ValidationError,
  );
  await assert.rejects(
    r.listAttendance({ ...a.context, enrollmentId: b.enrollment.id }),
    ValidationError,
  );
});

test('fechas de calendario reales sin conversiones UTC', () => {
  for (const invalid of [
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '0000-01-01',
    '2026-10-19T00:00:00Z',
    '',
    null,
    19,
  ]) {
    assert.throws(() => schoolDate(invalid), ValidationError);
  }
  for (const valid of ['2000-02-29', '2028-02-29', '2026-10-19'])
    assert.equal(schoolDate(valid), valid);
});

test('valida fechas, grado, minutos, campos, estados y categorías desde unknown', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  await assert.rejects(
    r.createSchoolYear({ label: 'Otro', startDate: '2027-01-01', endDate: '2026-01-01' }),
    ValidationError,
  );
  for (const grade of [0, 7, 1.5, '1', null])
    await assert.rejects(r.createGroup({ ...f.group, grade }), ValidationError);
  for (const input of [
    null,
    [],
    { firstName: ' ', lastName: 'Prueba' },
    { firstName: 'Prueba', lastName: '' },
    { firstName: 'Prueba', lastName: 'Prueba', active: 'true' },
  ])
    await assert.rejects(r.createStudent(input), ValidationError);
  await assert.rejects(
    r.createEnrollment(f.context, { ...f.enrollment, leftAt: '2026-07-01' }),
    ValidationError,
  );
  await assert.rejects(
    r.createEnrollment(f.context, { ...f.enrollment, status: 'inventado' }),
    ValidationError,
  );
  await assert.rejects(
    r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'inventado' }),
    ValidationError,
  );
  await assert.rejects(
    r.createSubmission(f.enrollmentContext, { assignmentId: f.assignment.id, status: 'inventado' }),
    ValidationError,
  );
  await assert.rejects(
    r.createAssignment(f.context, { ...f.assignment, dueDate: '2026-01-01' }),
    ValidationError,
  );
  for (const minutes of [-1, 1.5, NaN, Infinity, '10'])
    await assert.rejects(
      r.createReadingLog(f.enrollmentContext, { date: '2026-10-19', title: 'Prueba', minutes }),
      ValidationError,
    );
  await assert.rejects(
    r.createStudentNote(f.enrollmentContext, {
      date: '2026-10-19',
      category: 'inventado',
      body: 'Prueba',
    }),
    ValidationError,
  );
  await assert.rejects(
    r.createStudentNote(f.enrollmentContext, { date: '2026-10-19', category: 'other', body: ' ' }),
    ValidationError,
  );
  await assert.rejects(r.createSetting({ key: 'Prueba', value: {} }), ValidationError);
});

test('asistencia respeta ciclo y matrícula con extremos inclusivos', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const student = await r.createStudent({ firstName: 'Otra prueba', lastName: 'Sintética' });
  const enrollment = await r.createEnrollment(f.context, {
    studentId: student.id,
    joinedAt: '2026-09-01',
    leftAt: '2026-10-19',
    status: 'inactive',
  });
  const context = { ...f.context, enrollmentId: enrollment.id };
  for (const date of ['2026-09-01', '2026-10-19'])
    await r.createAttendance(context, { date, status: 'present' });
  for (const date of ['2026-08-31', '2026-10-20', '2027-08-01', '2026-07-31'])
    await assert.rejects(r.createAttendance(context, { date, status: 'present' }), ValidationError);
  for (const date of ['2026-08-01', '2027-07-31'])
    await r.createAttendance(f.enrollmentContext, { date, status: 'present' });
});

test('varias lecturas el mismo día son válidas, incluidos cero minutos', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  for (const minutes of [0, 12])
    await r.createReadingLog(f.enrollmentContext, {
      date: '2026-10-19',
      title: 'Libro sintético',
      minutes,
    });
  assert.equal((await r.listReadingLogs(f.enrollmentContext)).length, 2);
});

test('fallo de almacenamiento a mitad del lote revierte todas las escrituras', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  await assert.rejects(
    r.createAttendanceBatch(f.enrollmentContext, [
      { date: '2026-10-19', status: 'present' },
      { date: '2026-10-19', status: 'late' },
    ]),
    StorageError,
  );
  assert.equal(await db.attendance.count(), 0);
  await assert.rejects(
    r.createAttendanceBatch(f.enrollmentContext, [
      { date: '2026-10-19', status: 'present' },
      { date: '2026-10-20', status: 'inválido' },
    ]),
    ValidationError,
  );
  assert.equal(await db.attendance.count(), 0);
});

test('escrituras concurrentes respetan unicidad', async (t) => {
  const { db, repositories: r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const results = await Promise.allSettled([
    r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'present' }),
    r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'late' }),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(await db.attendance.count(), 1);
});

test('error al abrir y reintento conservan registros sin fallback ni borrado', async (t) => {
  const { db, repositories } = setup();
  t.after(() => db.delete());
  const f = await createFixture(repositories);
  db.close();
  const service = new StorageService(db);
  const open = db.open.bind(db);
  db.open = () =>
    Dexie.Promise.reject(new Error('Error sintético con datos que no deben mostrarse'));
  await service.initialize();
  assert.equal(service.getSnapshot().status, 'error');
  assert.doesNotMatch(JSON.stringify(service.getSnapshot()), /Error sintético/);
  db.open = open;
  await service.initialize();
  assert.equal(service.getSnapshot().status, 'ready');
  assert.deepEqual(await service.repositories.getStudent(f.student.id), f.student);
});
