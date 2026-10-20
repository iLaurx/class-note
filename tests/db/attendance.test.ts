import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture } from './fixtures.ts';
import { attendanceCounts, defaultDate } from '../../src/features/attendance/attendanceDomain.ts';
const date = '2026-10-19';
function setup() {
  const db = new ClassNoteDatabase(`cn006-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
function input(enrollmentId: string, status = 'present', expected: unknown = null, note?: string) {
  return { enrollmentId, status, note, expected };
}

test('CN006 población inclusiva, histórica, archivada y sin salida; sin mezclar grupos', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const second = await createFixture(r, 'Otro ciclo');
  const extra = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otro',
    lastName: 'Sintético',
    joinedAt: date,
  });
  await r.updateEnrollment(f.enrollmentContext, {
    status: 'inactive',
    joinedAt: '2026-10-01',
    leftAt: date,
  });
  await r.setStudentActive(f.student.id, false);
  await r.updateEnrollment(
    { ...f.context, enrollmentId: extra.enrollment.id },
    { ...extra.enrollment, status: 'inactive' },
  );
  assert.equal((await r.loadAttendanceDay(f.context, '2026-09-30')).length, 0);
  const rows = await r.loadAttendanceDay(f.context, date);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.enrollment.id === f.enrollment.id)?.student.active, false);
  assert.equal(
    rows.find((row) => row.enrollment.id === extra.enrollment.id)?.enrollment.leftAt,
    undefined,
  );
  assert.equal((await r.loadAttendanceDay(f.context, '2026-10-20')).length, 1);
  assert.equal((await r.loadAttendanceDay(f.context, '2026-10-01')).length, 1);
  assert.equal((await r.loadAttendanceDay(second.context, date)).length, 1);
  await r.saveAttendanceDay(f.context, date, [input(f.enrollment.id)]);
  assert.equal(
    (await r.loadAttendanceDay(f.context, date)).find(
      (row) => row.enrollment.id === f.enrollment.id,
    )?.attendance?.status,
    'present',
  );
});

test('CN006 fechas, estado, nota, referencias y contextos archivados validados sin escrituras', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  for (const invalid of ['2026-02-30', '2026-07-31', '2027-08-01', '19/10/2026']) {
    await assert.rejects(r.loadAttendanceDay(f.context, invalid));
    await assert.rejects(r.saveAttendanceDay(f.context, invalid, [input(f.enrollment.id)]));
  }
  for (const invalid of [
    input(f.enrollment.id, 'unknown'),
    input(other.enrollment.id),
    { ...input(f.enrollment.id), note: 23 },
    { ...input(f.enrollment.id), expected: undefined },
  ])
    await assert.rejects(r.saveAttendanceDay(f.context, date, [invalid]));
  await assert.rejects(
    r.saveAttendanceDay({ ...f.context, schoolYearId: other.year.id }, date, [
      input(f.enrollment.id),
    ]),
  );
  await r.archiveGroup(f.context);
  await assert.rejects(r.saveAttendanceDay(f.context, date, [input(f.enrollment.id)]));
  await r.reactivateGroup(f.context);
  await r.archiveSchoolYear(f.year.id);
  await assert.rejects(r.saveAttendanceDay(f.context, date, [input(f.enrollment.id)]));
  assert.equal(await db.attendance.count(), 0);
});

test('CN006 parcial, completar, repetir sin duplicados y corrección conserva auditoría e intactos', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const extra = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otro',
    lastName: 'Prueba',
    joinedAt: date,
  });
  const batch = [input(f.enrollment.id, 'absent', null, 'Nota sintética')];
  const [original] = await r.saveAttendanceDay(f.context, date, batch);
  assert.ok(original);
  assert.equal(
    (await r.loadAttendanceDay(f.context, date)).filter((row) => row.attendance === null).length,
    1,
  );
  await r.saveAttendanceDay(f.context, date, batch);
  assert.equal(await db.attendance.count(), 1);
  await r.saveAttendanceDay(f.context, date, [input(extra.enrollment.id, 'late')]);
  await assert.rejects(
    r.saveAttendanceDay(f.context, date, [
      input(f.enrollment.id, 'excused', original, original.note),
    ]),
    /Confirma/,
  );
  assert.deepEqual(await db.attendance.get(original.id), original);
  const otherBefore = await db.attendance.where('enrollmentId').equals(extra.enrollment.id).first();
  const [corrected] = await r.saveAttendanceDay(
    f.context,
    date,
    [input(f.enrollment.id, 'excused', original, original.note)],
    true,
  );
  assert.ok(corrected);
  assert.equal(corrected.id, original.id);
  assert.equal(corrected.createdAt, original.createdAt);
  assert.ok(corrected.updatedAt >= original.updatedAt);
  assert.equal(corrected.note, original.note);
  assert.deepEqual(await db.attendance.get(otherBefore!.id), otherBefore);
  assert.equal(await db.attendance.count(), 2);
  await r.saveAttendanceDay(
    f.context,
    date,
    [input(f.enrollment.id, corrected.status, corrected, corrected.note)],
    true,
  );
  assert.deepEqual(await db.attendance.get(corrected.id), corrected);
});

test('CN006 lote nuevo revierte por fallo real a mitad, por validación y por matrícula repetida', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const extra = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otro',
    lastName: 'Prueba',
    joinedAt: date,
  });
  let writes = 0;
  const fail = () => {
    if (++writes === 2) throw new Error('Fallo sintético');
  };
  db.attendance.hook('creating', fail);
  await assert.rejects(
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id), input(extra.enrollment.id)]),
  );
  db.attendance.hook('creating').unsubscribe(fail);
  assert.equal(writes, 2);
  assert.equal(await db.attendance.count(), 0);
  await assert.rejects(
    r.saveAttendanceDay(f.context, date, [
      input(f.enrollment.id),
      input(extra.enrollment.id, 'bad'),
    ]),
  );
  await assert.rejects(
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id), input(f.enrollment.id)]),
  );
  assert.equal(await db.attendance.count(), 0);
});

test('CN006 concurrencia serializada, inserciones idénticas idempotentes y conflicto explícito sin perder filas', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const results = await Promise.allSettled([
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id)]),
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id, 'late')]),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  const rejected = results.find((row) => row.status === 'rejected');
  assert.ok(rejected?.status === 'rejected');
  assert.match(String(rejected.reason), /otra ventana/);
  const current = await db.attendance.toArray();
  assert.equal(current.length, 1);
  const original = current[0]!;
  const corrections = await Promise.allSettled([
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id, 'absent', original)], true),
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id, 'excused', original)], true),
  ]);
  assert.equal(corrections.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal(await db.attendance.count(), 1);
  const winner = (await db.attendance.toArray())[0]!;
  await assert.rejects(
    r.saveAttendanceDay(
      f.context,
      date,
      [input(f.enrollment.id, 'late', { ...winner, status: 'present' })],
      true,
    ),
    /otra ventana/,
  );
  assert.deepEqual(await db.attendance.get(winner.id), winner);
});

test('CN006 conflicto tardío revierte correcciones previas del lote y conserva fechas/grupos/ciclos', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const extra = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otro',
    lastName: 'Prueba',
    joinedAt: date,
  });
  const other = await createFixture(r, 'Otro');
  await r.saveAttendanceDay(other.context, date, [input(other.enrollment.id, 'late')]);
  await r.saveAttendanceDay(f.context, '2026-10-20', [input(f.enrollment.id, 'excused')]);
  const [one, two] = await r.saveAttendanceDay(f.context, date, [
    input(f.enrollment.id),
    input(extra.enrollment.id),
  ]);
  const before = await db.attendance.toArray();
  await assert.rejects(
    r.saveAttendanceDay(
      f.context,
      date,
      [
        input(f.enrollment.id, 'absent', one),
        input(extra.enrollment.id, 'late', { ...two, updatedAt: 'obsoleto' }),
      ],
      true,
    ),
  );
  assert.deepEqual(await db.attendance.toArray(), before);
  const fail = () => {
    throw new Error('Fallo sintético');
  };
  db.attendance.hook('updating', fail);
  await assert.rejects(
    r.saveAttendanceDay(f.context, date, [input(f.enrollment.id, 'absent', one)], true),
  );
  db.attendance.hook('updating').unsubscribe(fail);
  assert.deepEqual(await db.attendance.toArray(), before);
});

test('CN006 recuentos sin equiparar justificadas, día local y selección fuera del ciclo', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  assert.deepEqual(
    attendanceCounts([
      { status: 'present' },
      { status: 'absent' },
      { status: 'late' },
      { status: 'excused' },
      { status: '' },
    ]),
    { present: 1, absent: 1, late: 1, excused: 1, unregistered: 1, total: 5 },
  );
  assert.equal(attendanceCounts([]).total, 0);
  assert.equal(defaultDate(f.year, new Date(2026, 9, 19, 23, 59)), date);
  assert.equal(defaultDate(f.year, new Date(2025, 9, 19)), '');
});
