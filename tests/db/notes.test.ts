import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture } from './fixtures.ts';
import { noteHistory } from '../../src/features/notes/notesDomain.ts';
const input = { date: '2026-10-19', category: 'academic', body: ' Observación sintética ' };
function setup() {
  const db = new ClassNoteDatabase(`cn009-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
test('CN009 alta, edición, identidad, no-op y concurrencia optimista', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const note = await r.createStudentNote(f.enrollmentContext, input);
  assert.equal(note.body, input.body.trim());
  assert.equal(db.verno, 1);
  let writes = 0;
  const count = () => {
    writes++;
  };
  db.studentNotes.hook('updating', count);
  assert.deepEqual(await r.updateStudentNote(f.enrollmentContext, note.id, note, note), note);
  assert.equal(writes, 0);
  const results = await Promise.allSettled(
    ['Uno', 'Dos'].map((body) =>
      r.updateStudentNote(f.enrollmentContext, note.id, { ...note, body }, note),
    ),
  );
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  const changed = (await db.studentNotes.get(note.id))!;
  assert.equal(changed.id, note.id);
  assert.equal(changed.createdAt, note.createdAt);
  assert.ok(changed.updatedAt >= note.updatedAt);
  await assert.rejects(
    r.updateStudentNote(
      f.enrollmentContext,
      note.id,
      { ...changed, enrollmentId: crypto.randomUUID() },
      changed,
    ),
    /propietaria/,
  );
  await assert.rejects(
    r.deleteStudentNote(f.enrollmentContext, note.id, note, true),
    /otra ventana/,
  );
  assert.deepEqual(await db.studentNotes.get(note.id), changed);
  db.studentNotes.hook('updating').unsubscribe(count);
});
test('CN009 fechas, categorías, campos y referencias inválidas no escriben', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  for (const patch of [
    { date: '2026-02-29' },
    { date: '2026-10-32' },
    { date: '2026-7-01' },
    { date: '2026-07-31' },
    { date: '2027-08-01' },
    { category: 'new' },
    { category: 0 },
    { body: '  ' },
    { body: 2 },
    { enrollmentId: other.enrollment.id },
  ])
    await assert.rejects(r.createStudentNote(f.enrollmentContext, { ...input, ...patch }));
  for (const context of [
    { ...f.enrollmentContext, enrollmentId: crypto.randomUUID() },
    { ...f.enrollmentContext, enrollmentId: other.enrollment.id },
    { ...f.enrollmentContext, schoolYearId: other.year.id },
  ])
    await assert.rejects(r.createStudentNote(context, input));
  await db.students.delete(f.student.id);
  await assert.rejects(r.createStudentNote(f.enrollmentContext, input));
  await db.students.add(f.student);
  await r.updateEnrollment(f.enrollmentContext, {
    joinedAt: '2026-10-01',
    leftAt: '2026-10-31',
    status: 'inactive',
  });
  for (const date of ['2026-09-30', '2026-11-01'])
    await assert.rejects(r.createStudentNote(f.enrollmentContext, { ...input, date }));
  assert.equal(await db.studentNotes.count(), 0);
});
test('CN009 historial inactivo/archivado, extremos inclusivos, aislamiento y búsqueda/filtros/orden estable', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  await r.setStudentActive(f.student.id, false);
  await r.updateEnrollment(f.enrollmentContext, {
    joinedAt: '2026-10-01',
    leftAt: '2026-10-31',
    status: 'inactive',
  });
  for (const date of ['2026-10-01', '2026-10-31', '2026-10-31'])
    await r.createStudentNote(f.enrollmentContext, { ...input, date });
  const foreign = await r.createStudentNote(other.enrollmentContext, input);
  const { members, notes } = await r.loadNotesGroup(f.context);
  assert.equal(members[0]!.student.active, false);
  assert.equal(notes.length, 3);
  assert.ok(!notes.some((note) => note.id === foreign.id));
  const history = await r.listStudentNotes(f.enrollmentContext);
  assert.equal(history[0]!.date, '2026-10-31');
  assert.ok(history[0]!.id < history[1]!.id);
  assert.equal(
    noteHistory(notes, members, '', 'academic', '2026-10-31', '2026-10-31', 'observacion').length,
    2,
  );
  assert.equal(
    noteHistory(notes, members, f.enrollment.id, '', '', '', 'ALUMNO FICTICIO').length,
    3,
  );
  assert.equal(noteHistory(notes, members, '', 'behavior').length, 0);
  assert.equal(noteHistory(notes, members, other.enrollment.id).length, 0);
  assert.throws(() => noteHistory(notes, members, '', '', '2026-02-30'));
  assert.throws(() => noteHistory(notes, members, '', '', '2026-11-01', '2026-10-01'));
  await assert.rejects(
    r.updateStudentNote(other.enrollmentContext, history[0]!.id, input, history[0]),
  );
  await assert.rejects(
    r.deleteStudentNote(other.enrollmentContext, history[0]!.id, history[0], true),
  );
  await r.archiveGroup(f.context);
  assert.equal((await r.loadNotesGroup(f.context)).notes.length, 3);
  await assert.rejects(r.createStudentNote(f.enrollmentContext, input), /Reactiva/);
  await assert.rejects(
    r.updateStudentNote(f.enrollmentContext, history[0]!.id, input, history[0]),
    /Reactiva/,
  );
  await assert.rejects(
    r.deleteStudentNote(f.enrollmentContext, history[0]!.id, history[0], true),
    /Reactiva/,
  );
});
test('CN009 eliminación requiere confirmación y solo borra la nota indicada', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const note = await r.createStudentNote(f.enrollmentContext, input);
  const kept = await r.createStudentNote(f.enrollmentContext, input);
  await assert.rejects(r.deleteStudentNote(f.enrollmentContext, note.id, note, false), /Confirma/);
  assert.deepEqual(await db.studentNotes.get(note.id), note);
  const students = await db.students.toArray(),
    enrollments = await db.enrollments.toArray();
  await r.deleteStudentNote(f.enrollmentContext, note.id, note, true);
  assert.deepEqual(await db.studentNotes.toArray(), [kept]);
  assert.deepEqual(await db.students.toArray(), students);
  assert.deepEqual(await db.enrollments.toArray(), enrollments);
});
test('CN009 rollback de alta, corrección y eliminación ante fallo transaccional posterior', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const note = await r.createStudentNote(f.enrollmentContext, input);
  for (const action of [
    () => r.createStudentNote(f.enrollmentContext, input),
    () => r.updateStudentNote(f.enrollmentContext, note.id, { ...note, body: 'Cambio' }, note),
    () => r.deleteStudentNote(f.enrollmentContext, note.id, note, true),
  ]) {
    await assert.rejects(
      db.transaction('rw', db.tables, async () => {
        await action();
        throw new Error('Fallo sintético posterior');
      }),
    );
    assert.deepEqual(await db.studentNotes.toArray(), [note]);
  }
});
