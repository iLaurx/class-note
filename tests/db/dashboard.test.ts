import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture } from './fixtures.ts';
import { dashboardPeriod, localDay } from '../../src/features/dashboard/dashboardDomain.ts';

function setup() {
  const db = new ClassNoteDatabase(`cn010-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
test('CN010 calendario local, límites de año/mes y bisiesto sin UTC', () => {
  assert.equal(localDay(new Date(2026, 9, 19, 23, 59)), '2026-10-19');
  assert.deepEqual(dashboardPeriod('2027-01-01'), {
    recentFrom: '2026-12-26',
    upcomingTo: '2027-01-07',
  });
  assert.deepEqual(dashboardPeriod('2024-03-01'), {
    recentFrom: '2024-02-24',
    upcomingTo: '2024-03-07',
  });
  assert.throws(() => dashboardPeriod('2026-02-29'));
});
test('CN010 población inclusiva histórica, asistencia parcial/justificada y pendientes por asignación', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  await r.updateEnrollment(f.enrollmentContext, {
    joinedAt: '2026-10-19',
    leftAt: '2026-10-19',
    status: 'inactive',
  });
  await r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'excused' });
  const student = await r.createStudent({ firstName: 'Otro', lastName: 'Sintético' });
  await r.createEnrollment(f.context, {
    studentId: student.id,
    joinedAt: '2026-10-20',
    status: 'active',
  });
  const third = await r.createStudent({ firstName: 'Tercero', lastName: 'Sintético' });
  await r.createEnrollment(f.context, {
    studentId: third.id,
    joinedAt: '2026-08-01',
    status: 'inactive',
  });
  const summary = await r.loadDashboard(f.context, '2026-10-19');
  assert.equal(summary.students, 2);
  assert.deepEqual(summary.attendance, {
    present: 0,
    absent: 0,
    late: 0,
    excused: 1,
    unregistered: 1,
    total: 2,
  });
  assert.equal(summary.assignments[0]!.population, 2);
  assert.equal(summary.assignments[0]!.pending, 2);
  await r.createSubmission(f.enrollmentContext, {
    assignmentId: f.assignment.id,
    status: 'incomplete',
  });
  assert.equal((await r.loadDashboard(f.context, '2026-10-20')).assignments[0]!.pending, 1);
  assert.equal((await r.loadDashboard(f.context, '2026-10-20')).students, 2);
});
test('CN010 aislamiento ciclos/grupos, semana completa, ceros, agenda acotada y lectura sin escrituras', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro ciclo sintético');
  const group = await r.createGroup({ schoolYearId: f.year.id, grade: 2, name: 'Otro' });
  for (const [date, minutes] of [
    ['2026-10-18', 100],
    ['2026-10-19', 0],
    ['2026-10-25', 12],
    ['2026-10-26', 200],
  ] as const)
    await r.createReadingLog(f.enrollmentContext, { date, minutes, title: 'Lectura sintética' });
  await r.createReadingLog(other.enrollmentContext, {
    date: '2026-10-19',
    minutes: 999,
    title: 'Otro ciclo',
  });
  await r.createAssignment(f.context, {
    title: 'Antigua próxima',
    assignedDate: '2026-09-01',
    dueDate: '2026-10-25',
  });
  await r.createAssignment(f.context, {
    title: 'Excluida',
    assignedDate: '2026-10-12',
    dueDate: '2026-10-26',
  });
  await r.createAssignment(f.context, { title: 'Límite reciente', assignedDate: '2026-10-13' });
  const before = await Promise.all(db.tables.map((table) => table.toArray()));
  const summary = await r.loadDashboard(f.context, '2026-10-19');
  assert.deepEqual(summary.reading, {
    from: '2026-10-19',
    to: '2026-10-25',
    minutes: 12,
    count: 2,
  });
  assert.equal(summary.assignments.length, 3);
  assert.ok(!summary.assignments.some((row) => row.title === 'Excluida'));
  const empty = await r.loadDashboard({ schoolYearId: f.year.id, groupId: group.id }, '2026-10-19');
  assert.equal(empty.students, 0);
  assert.equal(empty.reading.count, 0);
  assert.deepEqual(empty.assignments, []);
  await assert.rejects(
    r.loadDashboard({ schoolYearId: other.year.id, groupId: f.group.id }, '2026-10-19'),
  );
  assert.equal((await r.loadDashboard(f.context, '2027-08-01')).attendance, null);
  assert.deepEqual(await Promise.all(db.tables.map((table) => table.toArray())), before);
  assert.equal(db.verno, 1);
});
