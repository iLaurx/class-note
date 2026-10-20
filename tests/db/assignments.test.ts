import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture } from './fixtures.ts';
import {
  filterAssignments,
  submissionChanged,
  submissionCounts,
} from '../../src/features/assignments/assignmentDomain.ts';
const date = '2026-10-19';
function setup() {
  const db = new ClassNoteDatabase(`cn007-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db) };
}
function input(
  enrollmentId: string,
  status = 'pending',
  expected: unknown = null,
  comment?: string,
) {
  return { enrollmentId, status, expected, comment };
}

test('CN007 alta/edición recortadas, homónimas, identidad inmutable y sin cambios sin escritura', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const second = await r.createAssignment(f.context, {
    title: '  Tarea sintética  ',
    assignedDate: date,
    description: ' Texto ',
    dueDate: date,
  });
  assert.equal(second.title, f.assignment.title);
  assert.equal(second.description, 'Texto');
  assert.equal((await r.listAssignments(f.context)).length, 2);
  assert.deepEqual(await r.updateAssignment(f.context, second.id, second), second);
  const changed = await r.updateAssignment(f.context, second.id, {
    ...second,
    title: 'Editada',
    description: undefined,
    dueDate: undefined,
  });
  assert.equal(changed.id, second.id);
  assert.equal(changed.createdAt, second.createdAt);
  assert.equal(changed.groupId, second.groupId);
  assert.equal(changed.description, undefined);
  assert.ok(changed.updatedAt >= second.updatedAt);
  await assert.rejects(
    r.updateAssignment(f.context, second.id, { ...second, groupId: crypto.randomUUID() }),
  );
});

test('CN007 fechas reales, orden, ciclo, títulos y contextos activos; sin escritura inválida', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  for (const data of [
    { title: ' ' },
    { assignedDate: '2026-02-30' },
    { assignedDate: '2026-07-31' },
    { dueDate: '2027-08-01' },
    { dueDate: '2026-10-18' },
    { description: 42 },
  ]) {
    const fields = { ...f.assignment, ...data };
    await assert.rejects(r.createAssignment(f.context, fields));
    await assert.rejects(r.updateAssignment(f.context, f.assignment.id, fields));
  }
  await assert.rejects(r.updateAssignment(other.context, f.assignment.id, f.assignment));
  await r.archiveGroup(f.context);
  await assert.rejects(r.createAssignment(f.context, f.assignment));
  await assert.rejects(r.updateAssignment(f.context, f.assignment.id, f.assignment));
  await assert.rejects(r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id)]));
  await r.reactivateGroup(f.context);
  await r.archiveSchoolYear(f.year.id);
  await assert.rejects(r.createAssignment(f.context, f.assignment));
  await assert.rejects(r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id)]));
  assert.equal(await db.assignments.count(), 2);
  assert.equal(await db.submissions.count(), 0);
});

test('CN007 población inclusiva, fichas archivadas/históricas, sin instantánea ni escrituras al leer', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const later = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Posterior ficticio',
    lastName: 'Prueba',
    joinedAt: '2026-10-20',
  });
  const boundary = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Extremo ficticio',
    lastName: 'Prueba',
    joinedAt: date,
  });
  await r.updateEnrollment(f.enrollmentContext, {
    ...f.enrollment,
    status: 'inactive',
    leftAt: date,
  });
  await r.setStudentActive(f.student.id, false);
  const detail = await r.loadAssignment(f.context, f.assignment.id);
  assert.equal(detail.rows.length, 2);
  assert.equal(detail.rows.find((row) => row.student.id === f.student.id)?.student.active, false);
  assert.ok(detail.rows.some((row) => row.enrollment.id === boundary.enrollment.id));
  assert.ok(!detail.rows.some((row) => row.enrollment.id === later.enrollment.id));
  assert.ok(detail.rows.every((row) => row.submission === null));
  assert.equal(await db.submissions.count(), 0);
  await r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id, 'submitted')]);
  await r.updateEnrollment(f.enrollmentContext, {
    ...f.enrollment,
    status: 'inactive',
    leftAt: '2026-10-18',
  });
  const corrected = await r.loadAssignment(f.context, f.assignment.id);
  assert.equal(corrected.rows.length, 1);
  assert.equal(corrected.incidents.length, 1);
  assert.equal(corrected.incidents[0]?.submission.status, 'submitted');
  await assert.rejects(
    r.saveSubmissions(
      f.context,
      f.assignment.id,
      [input(f.enrollment.id, 'pending', corrected.incidents[0]?.submission)],
      true,
    ),
  );
  assert.equal(await db.submissions.count(), 1);
});

test('CN007 comentario pendiente, cuatro estados, corrección conserva auditoría e intactos e idempotencia', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const extra = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otro ficticio',
    lastName: 'Prueba',
    joinedAt: date,
  });
  const batch = [input(f.enrollment.id, 'pending', null, ' Comentario sintético ')];
  const [original] = await r.saveSubmissions(f.context, f.assignment.id, batch);
  assert.ok(original);
  assert.equal(original.comment, 'Comentario sintético');
  await Promise.all([
    r.saveSubmissions(f.context, f.assignment.id, batch),
    r.saveSubmissions(f.context, f.assignment.id, batch),
  ]);
  assert.equal(await db.submissions.count(), 1);
  const [untouched] = await r.saveSubmissions(f.context, f.assignment.id, [
    input(extra.enrollment.id, 'not_submitted'),
  ]);
  let current = original;
  for (const status of ['submitted', 'incomplete', 'not_submitted', 'pending']) {
    await assert.rejects(
      r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id, status, current)]),
      /Confirma/,
    );
    const [next] = await r.saveSubmissions(
      f.context,
      f.assignment.id,
      [input(f.enrollment.id, status, current)],
      true,
    );
    assert.ok(next);
    assert.equal(next.id, original.id);
    assert.equal(next.createdAt, original.createdAt);
    current = next;
  }
  assert.deepEqual(await db.submissions.get(untouched!.id), untouched);
  assert.equal(await db.submissions.count(), 2);
});

test('CN007 validación de estados/comentarios, matrícula/grupo/ciclo/tarea y lotes repetidos', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  for (const row of [
    input(other.enrollment.id),
    input(f.enrollment.id, 'bad'),
    { ...input(f.enrollment.id), comment: 42 },
    { ...input(f.enrollment.id), expected: undefined },
  ])
    await assert.rejects(r.saveSubmissions(f.context, f.assignment.id, [row]));
  await assert.rejects(r.saveSubmissions(f.context, other.assignment.id, [input(f.enrollment.id)]));
  await assert.rejects(
    r.saveSubmissions({ ...f.context, schoolYearId: other.year.id }, f.assignment.id, [
      input(f.enrollment.id),
    ]),
  );
  await assert.rejects(
    r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id), input(f.enrollment.id)]),
  );
  assert.equal(await db.submissions.count(), 0);
});

test('CN007 rollback real intermedio y validación tardía; conflictos sin depender de timestamps', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const extra = await r.createStudentWithEnrollment(f.context, {
    firstName: 'Otro ficticio',
    lastName: 'Prueba',
    joinedAt: date,
  });
  let writes = 0;
  const fail = () => {
    if (++writes === 2) throw new Error('Fallo sintético');
  };
  db.submissions.hook('creating', fail);
  await assert.rejects(
    r.saveSubmissions(f.context, f.assignment.id, [
      input(f.enrollment.id),
      input(extra.enrollment.id),
    ]),
  );
  db.submissions.hook('creating').unsubscribe(fail);
  assert.equal(writes, 2);
  assert.equal(await db.submissions.count(), 0);
  await assert.rejects(
    r.saveSubmissions(f.context, f.assignment.id, [
      input(f.enrollment.id),
      input(extra.enrollment.id, 'bad'),
    ]),
  );
  assert.equal(await db.submissions.count(), 0);
  const [one, two] = await r.saveSubmissions(f.context, f.assignment.id, [
    input(f.enrollment.id),
    input(extra.enrollment.id),
  ]);
  const before = await db.submissions.toArray();
  await assert.rejects(
    r.saveSubmissions(
      f.context,
      f.assignment.id,
      [
        input(f.enrollment.id, 'submitted', one),
        input(extra.enrollment.id, 'incomplete', { ...two, status: 'submitted' }),
      ],
      true,
    ),
    /otra ventana/,
  );
  assert.deepEqual(await db.submissions.toArray(), before);
  const failUpdate = () => {
    throw new Error('Fallo sintético');
  };
  db.submissions.hook('updating', failUpdate);
  await assert.rejects(
    r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id, 'submitted', one)], true),
  );
  db.submissions.hook('updating').unsubscribe(failUpdate);
  assert.deepEqual(await db.submissions.toArray(), before);
});

test('CN007 concurrencia e índice único; aislamiento entre tareas/grupos/ciclos', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  const results = await Promise.allSettled([
    r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id, 'submitted')]),
    r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id, 'incomplete')]),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal(await db.submissions.count(), 1);
  const current = (await db.submissions.toArray())[0]!;
  await assert.rejects(
    r.createSubmission(f.enrollmentContext, { assignmentId: f.assignment.id, status: 'pending' }),
  );
  const second = await r.createAssignment(f.context, { title: 'Otra', assignedDate: date });
  assert.ok((await r.loadAssignment(f.context, second.id)).rows.every((row) => !row.submission));
  await r.saveSubmissions(other.context, other.assignment.id, [input(other.enrollment.id)]);
  await r.saveSubmissions(f.context, second.id, [input(f.enrollment.id)]);
  assert.deepEqual(await db.submissions.get(current.id), current);
  assert.equal(await db.submissions.count(), 3);
});

test('CN007 cambiar asignación incompatible se rechaza sin pérdida; tarea concurrente rechazada', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  await r.updateEnrollment(f.enrollmentContext, { ...f.enrollment, joinedAt: date });
  await r.saveSubmissions(f.context, f.assignment.id, [input(f.enrollment.id)]);
  await assert.rejects(
    r.updateAssignment(f.context, f.assignment.id, { ...f.assignment, assignedDate: '2026-10-18' }),
    /población/,
  );
  assert.deepEqual(await db.assignments.get(f.assignment.id), f.assignment);
  assert.equal(await db.submissions.count(), 1);
  await r.updateAssignment(f.context, f.assignment.id, { ...f.assignment, title: 'Cambió' });
  await assert.rejects(
    r.saveSubmissions(
      f.context,
      f.assignment.id,
      [input(f.enrollment.id, 'submitted')],
      false,
      f.assignment,
    ),
    /tarea cambió/,
  );
});

test('CN007 borrador, conteos, pendiente sin registro, vuelta inicial y filtros estables', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const rows = [
    { enrollmentId: f.enrollment.id, status: 'pending' as const, expected: null, comment: '' },
  ];
  assert.equal(submissionChanged(rows[0]!), false);
  assert.equal(submissionChanged({ ...rows[0]!, comment: ' Texto ' }), true);
  assert.equal(submissionChanged({ ...rows[0]!, comment: '  ' }), false);
  assert.deepEqual(submissionCounts(rows), {
    pending: 1,
    submitted: 0,
    incomplete: 0,
    not_submitted: 0,
    uncaptured: 1,
    total: 1,
  });
  const draft = [
    ...rows,
    { ...rows[0]!, status: 'submitted' as const },
    { ...rows[0]!, status: 'incomplete' as const },
    { ...rows[0]!, status: 'not_submitted' as const },
  ];
  assert.equal(submissionCounts(draft).pending, 1);
  assert.equal(submissionCounts(draft).not_submitted, 1);
  const assignments = [
    f.assignment,
    { ...f.assignment, id: 'a' },
    { ...f.assignment, id: 'b', assignedDate: '2026-10-20' },
  ];
  assert.equal(filterAssignments(assignments, 'SINTETICA', date, date).length, 2);
  assert.equal(filterAssignments(assignments, '', '', '')[0]?.id, 'b');
  assert.equal(filterAssignments(assignments, 'inexistente', '', '').length, 0);
  assert.equal(draft.filter(submissionChanged).length, 3);
});

test('CN007 incidencias preservan entregas con referencias previas incompatibles o inexistentes', async (t) => {
  const { db, r } = setup();
  t.after(() => db.delete());
  const f = await createFixture(r);
  const other = await createFixture(r, 'Otro');
  const [submission] = await r.saveSubmissions(f.context, f.assignment.id, [
    input(f.enrollment.id, 'submitted', null, 'Comentario histórico'),
  ]);
  assert.ok(submission);
  await db.submissions.add({
    ...submission,
    id: crypto.randomUUID(),
    enrollmentId: other.enrollment.id,
  });
  await db.submissions.add({
    ...submission,
    id: crypto.randomUUID(),
    enrollmentId: crypto.randomUUID(),
  });
  await db.students.delete(f.student.id);
  const detail = await r.loadAssignment(f.context, f.assignment.id);
  assert.equal(detail.rows.length, 0);
  assert.equal(detail.incidents.length, 3);
  assert.deepEqual(
    detail.incidents.map((row) => row.reason).sort(),
    ['Ficha inexistente', 'Matrícula de otro grupo', 'Matrícula inexistente'].sort(),
  );
  assert.ok(detail.incidents.every((row) => row.submission.comment === 'Comentario histórico'));
  assert.equal(await db.submissions.count(), 3);
});
