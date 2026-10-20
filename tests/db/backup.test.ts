import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { BackupService } from '../../src/services/backup/backupService.ts';
import { fillRelated } from './fixtures.ts';

// Browser FileReader contract needed by the addon; no product fallback or test hook.
Object.assign(globalThis, {
  self: globalThis,
  FileReader: class {
    result: string | ArrayBuffer | null = null;
    onload: ((event: { target: unknown }) => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    readAsText(blob: Blob) {
      void blob.text().then(
        (s) => {
          this.result = s;
          this.onload?.({ target: this });
        },
        (e: unknown) => this.onerror?.(e),
      );
    }
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then(
        (s) => {
          this.result = s;
          this.onload?.({ target: this });
        },
        (e: unknown) => this.onerror?.(e),
      );
    }
  },
});

const setup = () => {
  const db = new ClassNoteDatabase(`backup-test-${crypto.randomUUID()}`);
  return { db, r: new Repositories(db), service: new BackupService(db) };
};
const snapshot = (db: ClassNoteDatabase) =>
  db.transaction('r', db.tables, () => Promise.all(db.tables.map((table) => table.toArray())));

test('CN012 diez tablas vacías y relacionadas, metadatos/conteos y reemplazo exacto sin residuos', async (t) => {
  const { db, r, service } = setup();
  t.after(() => db.delete());
  const empty = await service.export();
  assert.deepEqual(Object.values((await service.preview(empty)).counts), Array(10).fill(0));
  const f = await fillRelated(r);
  await r.selectContext(f.context);
  // A local clock correction must not rewrite or reject valid UTC audit values.
  await db.students.update(f.student.id, { updatedAt: '2026-01-01T00:00:00.000Z' });
  const before = await snapshot(db),
    source = await service.export();
  const info = await service.preview(source);
  assert.equal(Object.keys(info.counts).length, 10);
  assert.equal(info.counts.appSettings, 3);
  assert.equal(info.counts.submissions, 1);
  await r.createStudent({ firstName: 'Ajeno', lastName: 'Sintético' });
  let previous = '';
  assert.equal(
    await service.restore(source, true, async (value) => {
      previous = value;
      return true;
    }),
    true,
  );
  assert.deepEqual(await snapshot(db), before);
  assert.equal((await r.loadWorkspace()).selection.groupId, f.group.id);
  assert.equal((await service.preview(previous)).counts.students, 2);
  assert.equal(await service.restore(previous, true, async () => true), true);
  assert.equal(await db.students.count(), 2);
});

test('CN012 rechazo de corrupción, truncado, versiones, campos, conteos, referencias e invariantes antes de escribir', async (t) => {
  const { db, r, service } = setup();
  t.after(() => db.delete());
  await fillRelated(r);
  const source = await service.export(),
    before = await snapshot(db);
  for (const value of ['{', source.slice(0, -5), '{}', 'null'])
    await assert.rejects(service.preview(value));
  const edits: ((v: ReturnType<typeof JSON.parse>) => void)[] = [
    (v) => {
      v.format = 'xlsx';
    },
    (v) => {
      v.formatVersion = 2;
    },
    (v) => {
      v.schemaVersion = 2;
    },
    (v) => {
      v.appVersion = '99.0.0';
    },
    (v) => {
      v.data.data.tables.pop();
    },
    (v) => {
      v.data.data.data.pop();
    },
    (v) => {
      v.data.data.tables[0].rowCount++;
    },
    (v) => {
      v.data.data.data.find(
        (c: { tableName: string }) => c.tableName === 'enrollments',
      ).rows[0].studentId = crypto.randomUUID();
    },
    (v) => {
      v.data.data.data.find(
        (c: { tableName: string }) => c.tableName === 'readingLogs',
      ).rows[0].minutes = -1;
    },
    (v) => {
      v.data.data.data.find(
        (c: { tableName: string }) => c.tableName === 'students',
      ).rows[0].createdAt = 'yesterday';
    },
  ];
  for (const edit of edits) {
    const value = JSON.parse(source);
    edit(value);
    await assert.rejects(
      service.restore(JSON.stringify(value), true, async () => {
        throw new Error('No debe pedir guardado');
      }),
    );
    assert.deepEqual(await snapshot(db), before);
  }
});

test('CN012 cancelaciones, fallo de respaldo previo y conflicto mientras se guarda conservan la base', async (t) => {
  const { db, r, service } = setup();
  t.after(() => db.delete());
  await fillRelated(r);
  const source = await service.export(),
    before = await snapshot(db);
  assert.equal(
    await service.restore(source, false, async () => {
      throw new Error('No debe guardar');
    }),
    false,
  );
  assert.equal(await service.restore(source, true, async () => false), false);
  await assert.rejects(
    service.restore(source, true, async () => {
      throw new Error('Disco lleno');
    }),
  );
  assert.deepEqual(await snapshot(db), before);
  await assert.rejects(
    service.restore(source, true, async () => {
      await r.createSetting({ key: 'concurrent', value: true });
      return true;
    }),
    /cambiaron/,
  );
  assert.equal((await r.getSetting('concurrent'))?.value, true);
});

test('CN012 fallo real a mitad de transacción revierte limpieza, inserciones y selección; unicidad en temporal', async (t) => {
  const { db, r, service } = setup();
  t.after(() => db.delete());
  const f = await fillRelated(r);
  await r.selectContext(f.context);
  const source = await service.export();
  await r.createStudent({ firstName: 'Anterior', lastName: 'Sintético' });
  const before = await snapshot(db);
  const fail = () => {
    throw new Error('Fallo sintético en entregas');
  };
  db.submissions.hook('creating', fail);
  await assert.rejects(
    service.restore(source, true, async () => true),
    /Fallo sintético/,
  );
  db.submissions.hook('creating').unsubscribe(fail);
  assert.deepEqual(await snapshot(db), before);
  const invalid = JSON.parse(source);
  const students = invalid.data.data.data.find(
    (c: { tableName: string }) => c.tableName === 'students',
  );
  students.rows.push(students.rows[0]);
  invalid.data.data.tables.find((c: { name: string }) => c.name === 'students').rowCount++;
  await assert.rejects(service.preview(JSON.stringify(invalid)));
  assert.deepEqual(await snapshot(db), before);
});

test('CN012 selección inválida se sanea solo después de restaurar; historial archivado conserva relaciones', async (t) => {
  const { db, r, service } = setup();
  t.after(() => db.delete());
  const fixture = await fillRelated(r);
  await r.setStudentActive(fixture.student.id, false);
  await r.createSetting({ key: 'work.schoolYearId', value: crypto.randomUUID() });
  await r.createSetting({ key: 'work.groupId', value: crypto.randomUUID() });
  const source = await service.export();
  assert.equal(await service.restore(source, true, async () => true), true);
  assert.deepEqual((await r.loadWorkspace()).selection, { schoolYearId: null, groupId: null });
  assert.equal(await db.submissions.count(), 1);
  assert.equal((await db.students.get(fixture.student.id))?.active, false);
  assert.equal((await db.enrollments.get(fixture.enrollment.id))?.status, 'inactive');
});
