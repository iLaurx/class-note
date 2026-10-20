// Synthetic workload and fault injection, bundled only into the native test probe.
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { BackupService } from '../../src/services/backup/backupService.ts';
import { parseBackup } from '../../src/services/backup/validation.ts';
import { groupWorkbook } from '../../src/services/export/groupWorkbook.ts';
import { snapshot, verifyRestoreRollback } from './probe.ts';

function same(actual: unknown, expected: unknown) {
  const stable = (value: unknown) =>
    JSON.stringify(value, (_, item: unknown) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item,
    );
  if (stable(actual) !== stable(expected))
    throw new Error('Las diez stores deben conservar valores, UUID, relaciones y auditoría.');
}

export async function seedWorkload(size: number) {
  if (size !== 35 && size !== 100) throw new Error('Solo cargas sintéticas de 35/100.');
  const db = new ClassNoteDatabase();
  const started = performance.now();
  try {
    await db.open();
    const r = new Repositories(db);
    const year = await r.createSchoolYear({
      label: `CN013 sintético ${size}`,
      startDate: '2026-08-01',
      endDate: '2027-07-31',
    });
    const group = await r.createGroup({ schoolYearId: year.id, grade: 3, name: `CN013-${size}` });
    const context = { schoolYearId: year.id, groupId: group.id };
    const members = [];
    for (let i = 0; i < size; i++) {
      const member = await r.createStudentWithEnrollment(context, {
        firstName: `Sintético ${String(i + 1).padStart(3, '0')}`,
        lastName: i === 0 ? '=1+1' : 'CN013 ficticio',
        joinedAt: '2026-08-01',
      });
      members.push(member.enrollment.id);
    }
    // All 22 weekdays in September 2026, using civil dates without UTC conversion.
    let days = 0;
    for (let day = 1; day <= 30; day++) {
      const weekday = new Date(2026, 8, day, 12).getDay();
      if (weekday === 0 || weekday === 6) continue;
      days++;
      await r.saveAttendanceDay(
        context,
        `2026-09-${String(day).padStart(2, '0')}`,
        members.map((enrollmentId, index) => ({
          enrollmentId,
          status: ['present', 'absent', 'late', 'excused'][index % 4],
          note: index === 0 ? '+SUM(1,1)' : undefined,
          expected: null,
        })),
      );
    }
    for (let index = 0; index < 10; index++) {
      const assignment = await r.createAssignment(context, {
        title: index === 0 ? '=1+1' : `Tarea sintética ${index + 1}`,
        assignedDate: '2026-09-01',
      });
      await r.saveSubmissions(
        context,
        assignment.id,
        members.map((enrollmentId, i) => ({
          enrollmentId,
          status: ['pending', 'submitted', 'incomplete', 'not_submitted'][i % 4],
          comment: '@SUM(1,1)',
          expected: null,
        })),
      );
    }
    const enrollmentContext = { ...context, enrollmentId: members[0]! };
    await r.createReadingLog(enrollmentContext, {
      date: '2026-09-01',
      title: '-1+1',
      minutes: 0,
    });
    await r.createStudentNote(enrollmentContext, {
      date: '2026-09-01',
      category: 'other',
      body: 'Nota sintética CN013',
    });
    return { ...context, size, days, seedMs: Math.round(performance.now() - started) };
  } finally {
    db.close();
  }
}

export async function workloadWorkbook(context: { schoolYearId: string; groupId: string }) {
  const db = new ClassNoteDatabase();
  try {
    await db.open();
    const before = await snapshot();
    const bytes = await groupWorkbook(
      await new Repositories(db).loadGroupReport(context, '2026-09-01', '2026-09-30'),
    );
    same(await snapshot(), before);
    return Array.from(bytes);
  } finally {
    db.close();
  }
}

export async function exerciseRecovery() {
  const db = new ClassNoteDatabase();
  try {
    await db.open();
    const service = new BackupService(db);
    const before = await snapshot();
    const source = await service.export();
    const rejected = async (operation: () => Promise<unknown>) => {
      let failed = false;
      try {
        await operation();
      } catch {
        failed = true;
      }
      if (!failed) throw new Error('Se esperaba rechazo del fallo sintético.');
      same(await snapshot(), before);
    };
    let corruptReachedSave = false;
    await rejected(() =>
      service.restore(source.slice(0, -25), true, async () => {
        corruptReachedSave = true;
        throw new Error('No debe intentar guardar un respaldo corrupto.');
      }),
    );
    if (corruptReachedSave)
      throw new Error('La corrupción debe rechazarse antes del respaldo previo.');
    let called = false;
    if (
      (await service.restore(source, false, async () => {
        called = true;
        return true;
      })) ||
      called
    )
      throw new Error('Cancelar confirmación no debe escribir ni guardar.');
    same(await snapshot(), before);
    if (await service.restore(source, true, async () => false))
      throw new Error('Cancelar respaldo previo debe cancelar restauración.');
    same(await snapshot(), before);
    await rejected(() =>
      service.restore(source, true, async () => {
        throw new DOMException('Disco sintético sin espacio', 'QuotaExceededError');
      }),
    );
    await verifyRestoreRollback(source);
    same(await snapshot(), before);
    const repositories = new Repositories(db);
    const group = (before.groups as { id: string; schoolYearId: string; name: string }[]).find(
      (row) => row.name === 'CN013-35',
    )!;
    const enrollment = (before.enrollments as { id: string; groupId: string }[]).find(
      (row) => row.groupId === group.id,
    )!;
    const context = { schoolYearId: group.schoolYearId, groupId: group.id };
    const failWrite = () => {
      throw new DOMException('Cuota sintética', 'QuotaExceededError');
    };
    db.attendance.hook('creating', failWrite);
    try {
      await rejected(() =>
        repositories.saveAttendanceDay(context, '2026-10-01', [
          { enrollmentId: enrollment.id, status: 'present', expected: null },
        ]),
      );
    } finally {
      db.attendance.hook('creating').unsubscribe(failWrite);
    }
    await repositories.saveAttendanceDay(context, '2026-10-01', [
      { enrollmentId: enrollment.id, status: 'present', expected: null },
    ]);
    const retried = await snapshot();
    if (retried.attendance!.length !== before.attendance!.length + 1)
      throw new Error('El reintento debe guardar exactamente una asistencia.');
    await repositories.createSetting({ key: 'cn013-after-backup', value: true });
    const changed = await snapshot();
    let previous = '';
    if (
      !(await service.restore(source, true, async (value) => {
        previous = value;
        return true;
      }))
    )
      throw new Error('Debe restaurar tras recuperar el almacenamiento.');
    same(parseBackup(previous).rows, changed);
    same(await snapshot(), before);
    return {
      source,
      previous,
      exactTenStores: true,
      corruptRejected: true,
      confirmationCancelled: true,
      preBackupCancelled: true,
      saveErrorPreserved: true,
      intermediateRollback: true,
      storageQuotaRollbackAndRetry: true,
      retryRestored: true,
      previousBackupExact: true,
    };
  } finally {
    db.close();
  }
}

export async function restoreIntoEmpty(source: string) {
  const db = new ClassNoteDatabase();
  try {
    await db.open();
    const empty = await snapshot();
    if (Object.keys(empty).length !== 10 || Object.values(empty).some((rows) => rows.length))
      throw new Error('La restauración limpia requiere un perfil nuevo con diez stores vacías.');
    let previous = '';
    await new BackupService(db).restore(source, true, async (value) => {
      previous = value;
      return true;
    });
    same(parseBackup(previous).rows, empty);
    same(await snapshot(), parseBackup(source).rows);
    return { previous, before: empty, after: await snapshot() };
  } finally {
    db.close();
  }
}
