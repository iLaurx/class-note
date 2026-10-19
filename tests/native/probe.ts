// Bundled only by the native test runner, never imported by the application.
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { fillRelated } from '../db/fixtures.ts';

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
