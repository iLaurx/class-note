import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture, fillRelated } from './fixtures.ts';
function setup() {
  const db = new ClassNoteDatabase(`cn005-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
const studentInput = { firstName: ' Ána ', lastName: ' Pérez ', joinedAt: '2026-08-01' };

test('CN005 alta atómica, homónimos, entradas inválidas y rollback real al fallar matrícula', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const one = await r.createStudentWithEnrollment(f.context, studentInput);
  const two = await r.createStudentWithEnrollment(f.context, studentInput);
  assert.notEqual(one.student.id, two.student.id);
  assert.equal(one.student.firstName, 'Ána');
  const before = await db.students.toArray();
  for (const fields of [
    { firstName: ' ' },
    { lastName: '' },
    { joinedAt: '2026-02-30' },
    { joinedAt: '2027-08-01' },
  ])
    await assert.rejects(r.createStudentWithEnrollment(f.context, { ...studentInput, ...fields }));
  const fail = () => {
    throw new Error('Fallo sintético');
  };
  db.enrollments.hook('creating', fail);
  await assert.rejects(r.createStudentWithEnrollment(f.context, studentInput));
  db.enrollments.hook('creating').unsubscribe(fail);
  assert.deepEqual(await db.students.toArray(), before);
});

test('CN005 misma ficha en otro ciclo/grado, edición e historial y consultas aisladas', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  const related = await Promise.all([
    db.attendance.toArray(),
    db.submissions.toArray(),
    db.readingLogs.toArray(),
    db.studentNotes.toArray(),
  ]);
  const y = await r.createSchoolYear({
    label: 'Siguiente',
    startDate: '2027-08-01',
    endDate: '2028-07-31',
  });
  const g = await r.createGroup({ schoolYearId: y.id, grade: 2, name: 'B' });
  const c = { schoolYearId: y.id, groupId: g.id };
  const e = await r.createEnrollment(c, {
    studentId: f.student.id,
    joinedAt: y.startDate,
    status: 'active',
  });
  assert.equal(await db.students.count(), 1);
  assert.notEqual(e.id, f.enrollment.id);
  const edited = await r.updateStudent(f.student.id, {
    firstName: ' Cambio ',
    lastName: 'Álvarez',
    id: crypto.randomUUID(),
    createdAt: 'otra',
  });
  assert.equal(edited.id, f.student.id);
  assert.equal(edited.createdAt, f.student.createdAt);
  assert.equal(edited.firstName, 'Cambio');
  assert.ok(edited.updatedAt >= f.student.updatedAt);
  assert.equal((await r.listGroupStudents(f.context))[0]?.enrollment.id, f.enrollment.id);
  assert.equal((await r.listGroupStudents(c))[0]?.enrollment.id, e.id);
  assert.equal((await r.listStudentRecords()).enrollments.length, 2);
  assert.deepEqual(
    related,
    await Promise.all([
      db.attendance.toArray(),
      db.submissions.toArray(),
      db.readingLogs.toArray(),
      db.studentNotes.toArray(),
    ]),
  );
  await assert.rejects(r.updateEnrollment(f.enrollmentContext, { ...f.enrollment, groupId: g.id }));
  await assert.rejects(
    r.updateEnrollment(f.enrollmentContext, { ...f.enrollment, studentId: crypto.randomUUID() }),
  );
});

test('CN005 duplicados concurrentes y contexto archivado o alumno inactivo rechazados', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const s = await r.createStudent({ firstName: 'Otro', lastName: 'Prueba' });
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      r.createEnrollment(f.context, {
        studentId: s.id,
        joinedAt: f.year.startDate,
        status: 'active',
      }),
    ),
  );
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  await r.setStudentActive(s.id, false);
  const g = await r.createGroup({ schoolYearId: f.year.id, grade: 3, name: 'C' });
  const c = { ...f.context, groupId: g.id };
  await assert.rejects(
    r.createEnrollment(c, { studentId: s.id, joinedAt: f.year.startDate, status: 'active' }),
  );
  await r.setStudentActive(s.id, true);
  await r.archiveGroup(c);
  await assert.rejects(r.createStudentWithEnrollment(c, studentInput));
  await r.reactivateGroup(c);
  await r.archiveSchoolYear(f.year.id);
  await assert.rejects(
    r.createEnrollment(c, { studentId: s.id, joinedAt: f.year.startDate, status: 'active' }),
  );
});

test('CN005 intervalos inclusivos protegen asistencias; baja y reactivación conservan identidad', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  for (const fields of [
    { joinedAt: '2026-10-20' },
    { leftAt: '2026-10-18' },
    { leftAt: '2028-01-01' },
    { leftAt: '2026-07-01' },
    { joinedAt: '2026-02-30' },
  ])
    await assert.rejects(r.updateEnrollment(f.enrollmentContext, { ...f.enrollment, ...fields }));
  const leave = await r.updateEnrollment(f.enrollmentContext, {
    ...f.enrollment,
    joinedAt: '2026-10-19',
    leftAt: '2026-10-19',
    status: 'inactive',
  });
  assert.equal(leave.id, f.enrollment.id);
  assert.equal(leave.createdAt, f.enrollment.createdAt);
  assert.equal((await r.getStudent(f.student.id))?.active, true);
  await r.archiveGroup(f.context);
  await assert.rejects(r.updateEnrollment(f.enrollmentContext, { ...leave, status: 'active' }));
  await r.reactivateGroup(f.context);
  const active = await r.updateEnrollment(f.enrollmentContext, {
    ...leave,
    leftAt: undefined,
    status: 'active',
  });
  assert.equal(active.leftAt, undefined);
  assert.equal(await db.enrollments.count(), 1);
  assert.equal((await r.listAttendance(f.enrollmentContext)).length, 1);
});

test('CN005 archivo global atómico, cancelación por fallo y reactivación sin cascada', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  const g = await r.createGroup({ schoolYearId: f.year.id, grade: 2, name: 'B' });
  const other = await r.createEnrollment(
    { ...f.context, groupId: g.id },
    { studentId: f.student.id, joinedAt: f.year.startDate, status: 'active' },
  );
  await r.updateEnrollment(f.enrollmentContext, { ...f.enrollment, status: 'inactive' });
  assert.equal((await db.enrollments.get(other.id))?.status, 'active');
  await r.updateEnrollment(f.enrollmentContext, f.enrollment);
  const before = await Promise.all(db.tables.map((table) => table.toArray()));
  const fail = () => {
    throw new Error('Fallo sintético');
  };
  db.students.hook('updating', fail);
  await assert.rejects(r.setStudentActive(f.student.id, false));
  db.students.hook('updating').unsubscribe(fail);
  assert.deepEqual(await Promise.all(db.tables.map((table) => table.toArray())), before);
  await r.setStudentActive(f.student.id, false);
  for (const e of await db.enrollments.toArray()) {
    assert.equal(e.status, 'inactive');
    assert.equal(e.leftAt, undefined);
    assert.equal(e.joinedAt, f.year.startDate);
  }
  await assert.rejects(r.updateEnrollment(f.enrollmentContext, f.enrollment));
  await r.setStudentActive(f.student.id, true);
  assert.ok((await db.enrollments.toArray()).every((e) => e.status === 'inactive'));
  for (const table of ['attendance', 'submissions', 'readingLogs', 'studentNotes'])
    assert.deepEqual(
      await db.table(table).toArray(),
      before[db.tables.findIndex((x) => x.name === table)],
    );
});
