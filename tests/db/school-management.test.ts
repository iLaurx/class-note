import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { fillRelated } from './fixtures.ts';

function setup() {
  const db = new ClassNoteDatabase(`cn004-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
const input = { label: '2026–2027', startDate: '2026-08-01', endDate: '2027-07-31' };

test('CN004 ediciones conservan identidad, recortan textos y no escriben al guardar sin cambios', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const year = await r.createSchoolYear(input);
  const edited = await r.updateSchoolYear(year.id, { ...input, label: ' Otro ciclo ' });
  assert.equal(edited.label, 'Otro ciclo');
  assert.equal(edited.id, year.id);
  assert.equal(edited.createdAt, year.createdAt);
  assert.deepEqual(await r.updateSchoolYear(year.id, edited), edited);
  const group = await r.createGroup({ schoolYearId: year.id, grade: 1, name: ' A ' });
  const changed = await r.updateGroup(
    { schoolYearId: year.id, groupId: group.id },
    { grade: 6, name: ' B ', shift: ' Tarde ' },
  );
  assert.equal(changed.name, 'B');
  assert.equal(changed.shift, 'Tarde');
  assert.equal(changed.id, group.id);
  assert.equal(changed.createdAt, group.createdAt);
  assert.deepEqual(
    await r.updateGroup({ schoolYearId: year.id, groupId: group.id }, changed),
    changed,
  );
  await assert.rejects(
    r.updateGroup(
      { schoolYearId: year.id, groupId: group.id },
      { ...changed, schoolYearId: crypto.randomUUID() },
    ),
  );
  assert.deepEqual(await r.listGroups(year.id), [changed]);
});

test('CN004 fechas, grados y duplicados de creación/edición sin escrituras parciales', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const first = await r.createSchoolYear(input);
  const second = await r.createSchoolYear({ ...input, label: 'Segundo' });
  const a = await r.createGroup({ schoolYearId: first.id, grade: 1, name: 'A' });
  const b = await r.createGroup({ schoolYearId: first.id, grade: 1, name: 'B' });
  const before = await Promise.all(db.tables.map((table) => table.toArray()));
  for (const fields of [{ startDate: '2026-02-30' }, { startDate: '2028-01-01' }, { label: ' ' }]) {
    await assert.rejects(r.updateSchoolYear(first.id, { ...input, ...fields }));
  }
  await assert.rejects(r.createSchoolYear(input));
  await assert.rejects(r.updateSchoolYear(second.id, input));
  for (const grade of [0, 7, 1.5, '1'])
    await assert.rejects(
      r.updateGroup({ schoolYearId: first.id, groupId: a.id }, { grade, name: 'A' }),
    );
  await assert.rejects(r.createGroup({ ...a, shift: 'Otro' }));
  await assert.rejects(
    r.updateGroup(
      { schoolYearId: first.id, groupId: b.id },
      { grade: 1, name: 'A', shift: 'Otro' },
    ),
  );
  assert.deepEqual(await Promise.all(db.tables.map((table) => table.toArray())), before);
});

test('CN004 reducción de intervalo valida matrículas y asistencias, conserva relaciones', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  await assert.rejects(
    r.updateSchoolYear(f.year.id, { ...f.year, startDate: '2026-08-02' }),
    /matrículas/,
  );
  // Attendance after a proposed end is rejected independently of open-ended enrollment.
  await assert.rejects(
    r.updateSchoolYear(f.year.id, { ...f.year, endDate: '2026-10-18' }),
    /asistencias/,
  );
  await db.enrollments.update(f.enrollment.id, { leftAt: '2027-07-31' });
  await assert.rejects(
    r.updateSchoolYear(f.year.id, { ...f.year, endDate: '2027-07-30' }),
    /matrículas/,
  );
  assert.deepEqual((await r.listSchoolYears())[0], f.year);
  await r.updateSchoolYear(f.year.id, {
    ...f.year,
    startDate: '2025-01-01',
    endDate: '2028-01-01',
  });
  assert.equal((await r.listAttendance(f.enrollmentContext)).length, 1);
});

test('CN004 archivo atómico de contexto, sin cascada y reactivación conserva historia', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  const other = await r.createGroup({ schoolYearId: f.year.id, grade: 2, name: 'B' });
  const history = await Promise.all(
    db.tables
      .filter((table) => !['schoolYears', 'groups', 'appSettings'].includes(table.name))
      .map((table) => table.toArray()),
  );
  await r.selectContext(f.context);
  await r.archiveGroup(f.context);
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: f.year.id, groupId: null });
  await assert.rejects(r.updateGroup(f.context, f.group));
  await r.selectContext({ schoolYearId: f.year.id, groupId: other.id });
  await r.archiveSchoolYear(f.year.id);
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: null, groupId: null });
  assert.equal((await db.groups.get(f.group.id))?.archived, true);
  assert.equal((await db.groups.get(other.id))?.archived, false);
  await assert.rejects(r.createGroup({ ...other, name: 'C' }));
  await assert.rejects(r.updateGroup({ schoolYearId: f.year.id, groupId: other.id }, other));
  await assert.rejects(r.reactivateGroup(f.context));
  await assert.rejects(r.updateSchoolYear(f.year.id, f.year));
  await assert.rejects(r.selectContext(f.context));
  await r.reactivateSchoolYear(f.year.id);
  assert.equal((await db.groups.get(f.group.id))?.archived, true);
  await r.reactivateGroup(f.context);
  assert.equal((await db.groups.get(f.group.id))?.archived, false);
  assert.deepEqual(
    history,
    await Promise.all(
      db.tables
        .filter((table) => !['schoolYears', 'groups', 'appSettings'].includes(table.name))
        .map((table) => table.toArray()),
    ),
  );
});

test('CN004 selección recuperada, referencias inválidas descartadas sin elegir reemplazo', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: null, groupId: null });
  assert.equal(await db.appSettings.count(), 0);
  const f = await fillRelated(r);
  const y2 = await r.createSchoolYear({ ...input, label: 'Otro' });
  await r.selectContext(f.context);
  db.close();
  await db.open();
  assert.deepEqual((await r.loadWorkspace()).selection, f.context);
  await assert.rejects(r.selectContext({ schoolYearId: y2.id, groupId: f.group.id }));
  assert.deepEqual((await r.loadWorkspace()).selection, f.context);
  for (const value of [crypto.randomUUID(), 1, 'malformado']) {
    await db.appSettings.put({ key: 'work.schoolYearId', value });
    assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: null, groupId: null });
  }
  for (const value of [crypto.randomUUID(), false, 'malformado']) {
    await r.selectContext({ schoolYearId: y2.id, groupId: null });
    await db.appSettings.put({ key: 'work.groupId', value });
    assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: y2.id, groupId: null });
  }
  await db.appSettings.bulkPut([
    { key: 'work.schoolYearId', value: y2.id },
    { key: 'work.groupId', value: f.group.id },
  ]);
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: y2.id, groupId: null });
  await r.selectContext(f.context);
  await db.schoolYears.update(f.year.id, { archived: true });
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: null, groupId: null });
  await db.schoolYears.update(f.year.id, { archived: false });
  await r.selectContext(f.context);
  await db.groups.update(f.group.id, { archived: true });
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: f.year.id, groupId: null });
});

test('CN004 fallo al actualizar preferencias revierte el archivo completo', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  await r.selectContext(f.context);
  const fail = () => {
    throw new Error('Fallo sintético');
  };
  db.appSettings.hook('updating', fail);
  await assert.rejects(r.archiveSchoolYear(f.year.id));
  db.appSettings.hook('updating').unsubscribe(fail);
  assert.deepEqual(await db.schoolYears.get(f.year.id), f.year);
  assert.deepEqual((await r.loadWorkspace()).selection, f.context);
});
