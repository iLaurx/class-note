import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture } from './fixtures.ts';
import {
  readingHistory,
  readingWeek,
  weeklyReadings,
} from '../../src/features/reading/readingDomain.ts';
function setup() {
  const db = new ClassNoteDatabase(`cn008-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
const input = {
  date: '2026-10-19',
  title: ' Texto sintético ',
  minutes: 0,
  comment: ' Comentario ',
};

test('CN008 varias entradas idénticas concurrentes el mismo día, cero y máximo por entrada sin límite diario', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const logs = await Promise.all([
    r.createReadingLog(f.enrollmentContext, input),
    r.createReadingLog(f.enrollmentContext, input),
    r.createReadingLog(f.enrollmentContext, { ...input, minutes: 1440 }),
    r.createReadingLog(f.enrollmentContext, { ...input, minutes: 1440 }),
  ]);
  assert.equal(new Set(logs.map((log) => log.id)).size, 4);
  assert.equal(logs[0]!.title, 'Texto sintético');
  assert.equal(logs[0]!.comment, 'Comentario');
  const group = await r.loadReadingGroup(f.context);
  const summary = weeklyReadings(group.members, group.logs, input.date);
  assert.equal(summary.count, 4);
  assert.equal(summary.minutes, 2880);
  assert.equal(db.verno, 1);
});
test('CN008 entradas inválidas se rechazan sin escribir: minutos, título, calendario, ciclo y matrícula', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  for (const patch of [
    { minutes: -1 },
    { minutes: 0.5 },
    { minutes: 1441 },
    { minutes: '1' },
    { minutes: NaN },
    { minutes: Infinity },
    { title: '  ' },
    { date: '2026-02-29' },
    { date: '2026-10-32' },
    { date: '2026-7-01' },
    { date: '2026-07-31' },
    { date: '2027-08-01' },
    { enrollmentId: crypto.randomUUID() },
  ]) {
    await assert.rejects(r.createReadingLog(f.enrollmentContext, { ...input, ...patch }));
  }
  await r.updateEnrollment(f.enrollmentContext, {
    joinedAt: '2026-10-01',
    leftAt: '2026-10-31',
    status: 'inactive',
  });
  for (const date of ['2026-09-30', '2026-11-01'])
    await assert.rejects(r.createReadingLog(f.enrollmentContext, { ...input, date }));
  assert.equal(await db.readingLogs.count(), 0);
});
test('CN008 extremos inclusivos, historia inactiva/archivada sin inferir salida y contexto archivado bloqueado', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  await r.setStudentActive(f.student.id, false);
  for (const date of [f.year.startDate, f.year.endDate])
    await r.createReadingLog(f.enrollmentContext, { ...input, date });
  assert.equal((await r.listEnrollments(f.context))[0]!.leftAt, undefined);
  await r.updateEnrollment(f.enrollmentContext, {
    joinedAt: '2026-10-01',
    leftAt: '2026-10-31',
    status: 'inactive',
  });
  for (const date of ['2026-10-01', '2026-10-31'])
    await r.createReadingLog(f.enrollmentContext, { ...input, date });
  const group = await r.loadReadingGroup(f.context);
  assert.equal(group.members[0]!.student.active, false);
  assert.equal(group.logs.length, 4);
  await r.archiveGroup(f.context);
  await assert.rejects(r.createReadingLog(f.enrollmentContext, input), /Reactiva/);
  assert.equal((await r.loadReadingGroup(f.context)).logs.length, 4);
});
test('CN008 edición conserva identidad/auditoría, no escribe intactas, propietario inmutable y conflicto explícito', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const original = await r.createReadingLog(f.enrollmentContext, input);
  assert.deepEqual(
    await r.updateReadingLog(f.enrollmentContext, original.id, original, original),
    original,
  );
  const changed = await r.updateReadingLog(
    f.enrollmentContext,
    original.id,
    { ...original, title: 'Corregida', date: '2026-10-20', minutes: 15, comment: undefined },
    original,
  );
  assert.equal(changed.id, original.id);
  assert.equal(changed.createdAt, original.createdAt);
  assert.ok(changed.updatedAt >= original.updatedAt);
  await assert.rejects(
    r.updateReadingLog(
      f.enrollmentContext,
      original.id,
      { ...original, title: 'Obsoleta' },
      original,
    ),
    /otra ventana/,
  );
  await assert.rejects(
    r.updateReadingLog(
      f.enrollmentContext,
      original.id,
      { ...changed, enrollmentId: crypto.randomUUID() },
      changed,
    ),
    /propietaria/,
  );
  await assert.rejects(
    r.updateReadingLog(f.enrollmentContext, original.id, { ...changed, minutes: 1441 }, changed),
  );
  assert.deepEqual(await db.readingLogs.get(original.id), changed);
  const results = await Promise.allSettled(
    ['Uno', 'Dos'].map((title) =>
      r.updateReadingLog(f.enrollmentContext, original.id, { ...changed, title }, changed),
    ),
  );
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal(await db.readingLogs.count(), 1);
});
test('CN008 relaciones y consultas aisladas por matrícula, grupo y ciclo; historial estable descendente y filtros', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro ciclo');
  const student = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otra',
    lastName: 'Sintética',
    joinedAt: f.year.startDate,
  });
  const first = await r.createReadingLog(f.enrollmentContext, input);
  await r.createReadingLog(f.enrollmentContext, { ...input, date: '2026-10-20' });
  await r.createReadingLog(f.enrollmentContext, input);
  await r.createReadingLog(
    { ...f.context, enrollmentId: student.enrollment.id },
    { ...input, minutes: 20 },
  );
  const foreign = await r.createReadingLog(other.enrollmentContext, { ...input, minutes: 100 });
  await assert.rejects(
    r.createReadingLog({ ...f.context, enrollmentId: other.enrollment.id }, input),
  );
  await assert.rejects(r.updateReadingLog(other.enrollmentContext, first.id, input, first));
  await assert.rejects(r.loadReadingGroup({ ...f.context, groupId: other.group.id }));
  await assert.rejects(
    r.createReadingLog({ ...f.enrollmentContext, enrollmentId: crypto.randomUUID() }, input),
  );
  await db.students.delete(student.student.id);
  await assert.rejects(
    r.createReadingLog({ ...f.context, enrollmentId: student.enrollment.id }, input),
  );
  await db.students.add(student.student);
  const group = await r.loadReadingGroup(f.context);
  assert.equal(group.logs.length, 4);
  assert.ok(!group.logs.some((row) => row.id === foreign.id));
  const history = await r.listReadingLogs(f.enrollmentContext);
  assert.equal(history[0]!.date, '2026-10-20');
  assert.ok(history[1]!.id < history[2]!.id);
  assert.equal(readingHistory(group.logs, f.enrollment.id, '2026-10-19', '2026-10-19').length, 2);
  assert.throws(() => readingHistory(group.logs, f.enrollment.id, '2026-10-20', '2026-10-19'));
  assert.throws(() => readingHistory(group.logs, f.enrollment.id, '2026-02-30', ''));
  const summary = weeklyReadings(group.members, group.logs, input.date);
  assert.equal(summary.minutes, 20);
  assert.equal(summary.count, 4);
  assert.equal(summary.rows.find((row) => row.enrollment.id === f.enrollment.id)!.count, 3);
});
test('CN008 semanas civiles lunes/domingo cruzan mes, año y febrero bisiesto sin UTC', () => {
  for (const [date, from, to] of [
    ['2026-10-19', '2026-10-19', '2026-10-25'],
    ['2026-10-25', '2026-10-19', '2026-10-25'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2024-02-29', '2024-02-26', '2024-03-03'],
    ['2026-03-01', '2026-02-23', '2026-03-01'],
    ['2000-02-29', '2000-02-28', '2000-03-05'],
  ])
    assert.deepEqual(readingWeek(date!), { from, to });
  assert.throws(() => readingWeek('2100-02-29'));
});
test('CN008 totales incluyen extremos semanales y ceros, excluyen días vecinos y otras matrículas', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  for (const date of ['2026-10-18', '2026-10-19', '2026-10-19', '2026-10-25', '2026-10-26'])
    await r.createReadingLog(f.enrollmentContext, {
      ...input,
      date,
      minutes: date === '2026-10-25' ? 5 : 0,
    });
  const group = await r.loadReadingGroup(f.context);
  const summary = weeklyReadings(group.members, group.logs, '2026-10-22');
  assert.equal(summary.count, 3);
  assert.equal(summary.minutes, 5);
  assert.equal(weeklyReadings(group.members, group.logs, '2026-11-02').count, 0);
});
