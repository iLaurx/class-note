// Bundled only by the native test runner, never imported by the application.
export { seedWorkload, workloadWorkbook, exerciseRecovery, restoreIntoEmpty } from './hardening.ts';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { fillRelated } from '../db/fixtures.ts';
import { BackupService } from '../../src/services/backup/backupService.ts';
import { parseBackup } from '../../src/services/backup/validation.ts';

export async function inspectBackup(source: string) {
  const db = new ClassNoteDatabase();
  try {
    await new BackupService(db).preview(source);
    return parseBackup(source).rows;
  } finally {
    db.close();
  }
}

export async function verifyRestoreRollback(source: string) {
  const db = new ClassNoteDatabase();
  const before = await snapshot();
  let injected = false;
  const fail = () => {
    injected = true;
    throw new Error('Fallo sintético nativo a mitad de restauración');
  };
  try {
    await db.open();
    db.submissions.hook('creating', fail);
    let rejected = false;
    try {
      await new BackupService(db).restore(source, true, async () => true);
    } catch {
      rejected = true;
    }
    if (!rejected || !injected)
      throw new Error('La restauración debía alcanzar el fallo intermedio.');
  } finally {
    db.submissions.hook('creating').unsubscribe(fail);
    db.close();
  }
  const after = await snapshot();
  if (JSON.stringify(after) !== JSON.stringify(before))
    throw new Error('El rollback nativo no conservó las diez tablas.');
  return { rollback: true, selectionPreserved: true };
}

export async function snapshot() {
  const db = new ClassNoteDatabase();
  try {
    await db.open();
    const result: Record<string, unknown[]> = {};
    await db.transaction('r', db.tables, async () => {
      for (const table of db.tables) result[table.name] = await table.toArray();
    });
    return result;
  } finally {
    db.close();
  }
}

export async function seed() {
  const db = new ClassNoteDatabase();
  try {
    await db.open();
    for (const table of db.tables) {
      if ((await table.count()) !== 0) throw new Error('El perfil de prueba debe estar vacío.');
    }
    await fillRelated(new Repositories(db));
  } finally {
    db.close();
  }
  return snapshot();
}

export async function writeAfterRestart() {
  const db = new ClassNoteDatabase();
  try {
    await db.open();
    await new Repositories(db).createSetting({ key: 'after-restart', value: true });
  } finally {
    db.close();
  }
  return snapshot();
}
