import { ClassNoteDatabase } from '../../db/database.ts';
import { requireRule } from '../../domain/validation.ts';
import { parseBackup, TABLE_NAMES, validateRows, type BackupRows } from './validation.ts';

// Lazy import keeps the addon and file readers out of ordinary application startup.
const addon = () => import('dexie-export-import');
export type BackupPreview = Omit<ReturnType<typeof parseBackup>, 'rows' | 'payload'>;
function stable(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}
async function snapshot(db: ClassNoteDatabase): Promise<BackupRows> {
  const rows = Object.fromEntries(
    await Promise.all(TABLE_NAMES.map(async (name) => [name, await db.table(name).toArray()])),
  ) as BackupRows;
  return rows;
}
export class BackupService {
  private readonly db: ClassNoteDatabase;
  constructor(db: ClassNoteDatabase) {
    this.db = db;
  }

  async export(): Promise<string> {
    return (await this.capture()).source;
  }

  private async capture() {
    const { exportDB } = await addon();
    const { blob, rows } = await this.db.transaction('r', this.db.tables, async () => ({
      rows: await snapshot(this.db),
      blob: await exportDB(this.db),
    }));
    const data: unknown = JSON.parse(await blob.text());
    // Only the stable product name is portable; temporary test DB names never enter files.
    recordDatabaseName(data);
    const source = JSON.stringify({
      format: 'classnote-backup',
      formatVersion: 1,
      appVersion: '0.1.0',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data,
    });
    return { source, rows };
  }

  async preview(source: string): Promise<BackupPreview> {
    const { createdAt, appVersion, schemaVersion, formatVersion, counts } =
      await this.validate(source);
    return { createdAt, appVersion, schemaVersion, formatVersion, counts };
  }

  private async validate(source: string) {
    const parsed = parseBackup(source);
    const temporary = new ClassNoteDatabase(`classnote-restore-validation-${crypto.randomUUID()}`);
    try {
      await temporary.open();
      const { importInto } = await addon();
      await importInto(temporary, new Blob([JSON.stringify(parsed.payload)]), {
        acceptNameDiff: true,
      });
      const imported = await temporary.transaction('r', temporary.tables, () =>
        snapshot(temporary),
      );
      requireRule(
        stable(imported) === stable(parsed.rows),
        'El respaldo no conserva todos sus registros.',
      );
      validateRows(imported);
      return parsed;
    } finally {
      // Only this isolated, newly created staging database is ever deleted.
      await temporary.delete();
    }
  }

  async restore(
    source: string,
    confirmed: boolean,
    savePrevious: (source: string) => Promise<boolean>,
  ): Promise<boolean> {
    if (!confirmed) return false;
    const validated = await this.validate(source);
    const previous = await this.capture();
    if (!(await savePrevious(previous.source))) return false;
    await this.db.transaction('rw', this.db.tables, async () => {
      requireRule(
        stable(await snapshot(this.db)) === stable(previous.rows),
        'Los datos cambiaron mientras guardabas el respaldo previo. Revisa y vuelve a confirmar la restauración.',
      );
      for (const name of TABLE_NAMES) {
        await this.db.table(name).clear();
        await this.db.table(name).bulkAdd(validated.rows[name]);
      }
    });
    return true;
  }
}

function recordDatabaseName(value: unknown) {
  // The exporter owns this structure; validation of untrusted files is separate.
  const data = value as { data: { databaseName: string } };
  data.data.databaseName = 'classnote';
}
