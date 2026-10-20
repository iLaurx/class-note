import { recordNotes, verifyNotes, addNote } from '../helpers/notes-flow.ts';
import {
  recordSubmissions,
  verifySubmissions,
  commentField,
  saveDeliveries,
} from '../helpers/assignment-flow.ts';
import { addReading, recordReading, verifyReading } from '../helpers/reading-flow.ts';
import { createStudentHistory, verifyStudentHistory } from '../helpers/student-flow.ts';
import {
  prepareAttendanceStudents,
  recordAttendance,
  verifyAttendance,
  statusField,
} from '../helpers/attendance-flow.ts';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'vite';
import { chromium, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import {
  createYearsAndGroups,
  verifySelection,
  verifyArchiveFlow,
} from '../helpers/school-flow.ts';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const exe = path.join(root, 'src-tauri/target/release/classnote.exe');
await access(exe);
const output = path.join(root, 'test-results/native');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'webview2-'));
const backupFile = path.join(output, `respaldo-${path.basename(profile)}.json`);
const previousBackupFile = path.join(output, `respaldo-previo-${path.basename(profile)}.json`);
const bundled = await build({
  configFile: false,
  logLevel: 'error',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(root, 'tests/native/probe.ts'),
      name: 'ClassNoteProbe',
      formats: ['iife'],
    },
  },
});
const bundle = Array.isArray(bundled) ? bundled[0] : bundled;
assert.ok(bundle && 'output' in bundle);
const script = bundle.output.find((item) => item.type === 'chunk').code;
const server = net.createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const endpoint = `http://127.0.0.1:${port}`;

async function poll(operation, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const result = await operation();
      if (result) return result;
    } catch {
      /* startup/shutdown */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Se agotó el tiempo de espera del ejecutable WebView2.');
}

async function launch() {
  const child = spawn(exe, [], {
    cwd: path.dirname(exe),
    windowsHide: true,
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
    },
    stdio: 'ignore',
  });
  const exited = once(child, 'exit');
  let browser;
  const stop = async () => {
    if (browser) await browser.close().catch(() => {});
    if (child.exitCode === null) {
      const result = await exec(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-Process -Id ${child.pid}).CloseMainWindow()`,
        ],
        { windowsHide: true },
      );
      assert.match(result.stdout, /True/);
      await Promise.race([
        exited,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('El proceso nativo no cerró normalmente.')),
            15000,
          ).unref(),
        ),
      ]);
    }
    await poll(async () => {
      const result = await exec(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `@(Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'" | Where-Object { $_.CommandLine -like '*${profile.replaceAll("'", "''")}*' }).Count`,
        ],
        { windowsHide: true },
      );
      return result.stdout.trim() === '0';
    });
  };
  try {
    await poll(async () => {
      const response = await fetch(`${endpoint}/json/version`);
      return response.ok;
    });
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const page = await poll(() =>
      context.pages().find((page) => page.url().startsWith('http://tauri.localhost')),
    );
    await page.getByText('Almacenamiento local listo.', { exact: true }).waitFor();
    assert.ok((await readdir(profile)).length > 0, 'WebView2 debe usar el perfil aislado.');
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    const requests = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://tauri.localhost/')) requests.push(request.url());
    });
    const session = await context.newCDPSession(page);
    const evaluate = async (expression) => {
      const response = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      assert.equal(response.exceptionDetails, undefined, 'La sonda debe ejecutarse sin errores.');
      return response.result.value;
    };
    await evaluate(script);
    return { page, evaluate, stop, requests, pid: child.pid };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function verifyDashboard(session, stage) {
  await session.page.clock.setFixedTime(new Date(2026, 9, 19, 12));
  // Inicio may already be mounted after launch: refresh its local day on focus.
  await session.evaluate("window.dispatchEvent(new Event('focus'))");
  const snapshot = await session.evaluate('ClassNoteProbe.snapshot()');
  await session.page
    .getByRole('navigation')
    .getByRole('link', { name: 'Inicio', exact: true })
    .click();
  const summary = session.page.getByRole('region', { name: 'Resumen del grupo', exact: true });
  await expect(summary).toBeVisible();
  await expect(
    summary.getByRole('article', { name: 'Matrículas de hoy' }).locator('strong'),
  ).toHaveText('4');
  await expect(summary).toContainText('Presente: 2');
  await expect(summary).toContainText('Falta justificada: 1');
  await expect(summary).toContainText('35 minutos · 3 registros');
  await expect(summary).toContainText('Sin registrar: 0');
  assert.deepEqual(
    await session.evaluate('ClassNoteProbe.snapshot()'),
    snapshot,
    'Consultar el dashboard no debe escribir.',
  );
  await session.page.screenshot({
    path: path.join(output, `dashboard-${stage}.png`),
    fullPage: true,
  });
}
const first = await launch();
let before;
try {
  const empty = await first.evaluate('ClassNoteProbe.snapshot()');
  assert.equal(Object.keys(empty).length, 10);
  assert.ok(Object.values(empty).every((rows) => rows.length === 0));
  const seeded = await first.evaluate('ClassNoteProbe.seed()');
  assert.ok(Object.values(seeded).every((rows) => rows.length === 1));
  await createYearsAndGroups(first.page);
  await verifySelection(first.page);
  await createStudentHistory(first.page);
  await prepareAttendanceStudents(first.page);
  await recordAttendance(first.page);
  await recordSubmissions(first.page);
  await recordReading(first.page);
  await recordNotes(first.page);
  await verifyDashboard(first, 'before-restart');
  before = await first.evaluate('ClassNoteProbe.snapshot()');
  if (process.env.CN012_BACKUP_UI === '1') {
    await first.page
      .getByRole('navigation')
      .getByRole('link', { name: 'Configuración', exact: true })
      .click();
    console.log(`CN012: guardar respaldo sintético en ${backupFile}`);
    await first.page
      .getByRole('button', { name: 'Guardar respaldo completo', exact: true })
      .click();
    await first.page
      .getByText('Respaldo completo guardado.', { exact: true })
      .waitFor({ timeout: 240000 });
    assert.deepEqual(await first.evaluate('ClassNoteProbe.snapshot()'), before);
    await first.page.screenshot({ path: path.join(output, 'backup-exported.png') });
  }
  const student = before.students.find((s) => s.firstName === 'Ána editada');
  assert.ok(student);
  const history = before.enrollments.filter((e) => e.studentId === student.id);
  assert.equal(history.length, 2);
  assert.equal(history.filter((e) => e.status === 'active').length, 1);
  assert.equal(before.students.filter((s) => s.firstName === 'Ána editada').length, 1);
  await first.page.screenshot({ path: path.join(output, 'first-launch.png') });
  assert.deepEqual(first.requests, []);
} finally {
  await first.stop();
}

const second = await launch();
try {
  const after = await second.evaluate('ClassNoteProbe.snapshot()');
  assert.deepEqual(after, before, 'Todos los valores, UUID y relaciones deben conservarse.');
  await verifyDashboard(second, 'after-restart');
  // A second offline write/read proves the reopened store remains writable.
  const result = await second.evaluate('ClassNoteProbe.writeAfterRestart()');
  assert.equal(result.appSettings.length, 4);
  await verifySelection(second.page);
  await verifyStudentHistory(second.page);
  await second.page.screenshot({
    path: path.join(output, 'students-after-restart.png'),
    fullPage: true,
  });
  await verifyAttendance(second.page);
  await second.page.screenshot({
    path: path.join(output, 'attendance-after-restart.png'),
    fullPage: true,
  });
  await second.page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-20');
  await statusField(second.page, 0).selectOption('late');
  await second.page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await second.page.getByText('Asistencia guardada. 3 sin registrar.', { exact: true }).waitFor();
  const afterWrite = await second.evaluate('ClassNoteProbe.snapshot()');
  assert.equal(afterWrite.attendance.length, before.attendance.length + 1);
  await verifySubmissions(second.page);
  await second.page.screenshot({
    path: path.join(output, 'assignments-after-restart.png'),
    fullPage: true,
  });
  await commentField(second.page, 1).fill('Comentario posterior offline');
  second.page.once('dialog', (dialog) => dialog.accept());
  await saveDeliveries(second.page).click();
  await second.page.getByText('Entregas guardadas: 1.', { exact: true }).waitFor();
  await expect(second.page.getByRole('region', { name: 'Entregas de la tarea' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  const assignmentsAfterWrite = await second.evaluate('ClassNoteProbe.snapshot()');
  assert.equal(assignmentsAfterWrite.submissions.length, before.submissions.length);
  const previous = before.submissions.find((row) => row.comment === 'Comentario sintético 1');
  const corrected = assignmentsAfterWrite.submissions.find((row) => row.id === previous.id);
  assert.equal(corrected.createdAt, previous.createdAt);
  assert.equal(corrected.status, 'pending');
  assert.equal(corrected.comment, 'Comentario posterior offline');
  await verifyReading(second.page);
  await second.page.screenshot({
    path: path.join(output, 'reading-after-restart.png'),
    fullPage: true,
  });
  await addReading(second.page, 0, 'Lectura offline posterior');
  const readingAfterWrite = await second.evaluate('ClassNoteProbe.snapshot()');
  assert.equal(readingAfterWrite.readingLogs.length, before.readingLogs.length + 1);
  assert.equal(
    readingAfterWrite.readingLogs.filter((row) => row.title === 'Lectura offline posterior').length,
    1,
  );
  // Opt-in desktop checkpoint: a human or Computer Use chooses this synthetic destination
  // in the real Windows dialog, then cancels the second dialog. No production test hooks.
  if (process.env.CN011_EXPORT_UI === '1') {
    await second.page
      .getByRole('navigation')
      .getByRole('link', { name: 'Reportes', exact: true })
      .click();
    await second.page.getByLabel('Desde', { exact: true }).fill('2026-10-19');
    await second.page.getByLabel('Hasta', { exact: true }).fill('2026-10-20');
    await second.page.screenshot({
      path: path.join(output, 'reports-after-restart.png'),
      fullPage: true,
    });
    const reportPath = path.join(output, 'reporte-sintetico.xlsx');
    console.log(`CN011: elegir destino en diálogo nativo: ${reportPath}`);
    await second.page.getByRole('button', { name: 'Exportar Excel' }).click();
    await second.page
      .getByText('Reporte Excel guardado.', { exact: true })
      .waitFor({ timeout: 240000 });
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(reportPath);
    assert.deepEqual(
      book.worksheets.map((sheet) => sheet.name),
      ['Alumnos', 'Asistencia', 'Tareas', 'Lecturas'],
    );
    const selection = readingAfterWrite.appSettings.find((row) => row.key === 'work.groupId').value;
    const members = readingAfterWrite.enrollments.filter((row) => row.groupId === selection);
    assert.equal(book.getWorksheet('Alumnos').rowCount, members.length + 1);
    assert.ok(
      book.getWorksheet('Alumnos').getColumn(2).values.includes('Pérez de prueba, Ána editada'),
    );
    for (const sheet of book.worksheets)
      sheet.eachRow((row) =>
        row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)),
      );
    assert.deepEqual(await second.evaluate('ClassNoteProbe.snapshot()'), readingAfterWrite);
    console.log('CN011: libro abierto/verificado con ExcelJS; cancelar el segundo diálogo nativo.');
    await second.page.getByRole('button', { name: 'Exportar Excel' }).click();
    await second.page
      .getByText('Exportación cancelada. No se escribió ningún archivo.', { exact: true })
      .waitFor({ timeout: 240000 });
    await second.page.screenshot({
      path: path.join(output, 'reports-cancelled.png'),
      fullPage: true,
    });
    await writeFile(
      path.join(output, 'excel-result.json'),
      JSON.stringify(
        {
          success: true,
          reportPath,
          sheets: book.worksheets.map((sheet) => ({ name: sheet.name, rows: sheet.rowCount })),
          nativeSave: true,
          nativeCancel: true,
          snapshotUnchanged: true,
        },
        null,
        2,
      ),
    );
    await second.page
      .getByRole('navigation')
      .getByRole('link', { name: 'Lectura en casa', exact: true })
      .click();
  }
  for (const log of before.readingLogs)
    assert.deepEqual(
      readingAfterWrite.readingLogs.find((row) => row.id === log.id),
      log,
    );
  await second.page.getByLabel('Fecha de la semana').fill('2026-10-19');
  await expect(
    second.page.getByText('Total del grupo: 35 minutos · 4 registros', { exact: true }),
  ).toBeVisible();
  await verifyNotes(second.page);
  await second.page.screenshot({
    path: path.join(output, 'notes-after-restart.png'),
    fullPage: true,
  });
  await addNote(second.page, 'Observación offline posterior');
  const notesAfterWrite = await second.evaluate('ClassNoteProbe.snapshot()');
  assert.equal(notesAfterWrite.studentNotes.length, before.studentNotes.length + 1);
  for (const note of before.studentNotes)
    assert.deepEqual(
      notesAfterWrite.studentNotes.find((row) => row.id === note.id),
      note,
    );
  const remove = second.page
    .getByRole('listitem')
    .filter({ hasText: 'Observación offline posterior' })
    .getByRole('button', { name: /Eliminar observación/ });
  second.page.once('dialog', (dialog) => dialog.dismiss());
  await remove.click();
  assert.deepEqual(
    (await second.evaluate('ClassNoteProbe.snapshot()')).studentNotes,
    notesAfterWrite.studentNotes,
  );
  second.page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(second.page.getByText('La observación se eliminó.', { exact: true })).toBeVisible();
  const notesAfterDelete = await second.evaluate('ClassNoteProbe.snapshot()');
  assert.deepEqual(notesAfterDelete.studentNotes, before.studentNotes);
  assert.deepEqual(notesAfterDelete.students, before.students);
  assert.deepEqual(notesAfterDelete.enrollments, before.enrollments);
  await verifyArchiveFlow(second.page);
  const archived = await second.evaluate('ClassNoteProbe.snapshot()');
  for (const table of [
    'students',
    'enrollments',
    'attendance',
    'assignments',
    'submissions',
    'readingLogs',
    'studentNotes',
  ])
    assert.deepEqual(archived[table], readingAfterWrite[table]);
  for (const label of [
    'Alumnos',
    'Asistencia',
    'Tareas',
    'Lectura en casa',
    'Observaciones',
    'Reportes',
    'Configuración',
    'Inicio',
  ]) {
    await second.page
      .getByRole('navigation')
      .getByRole('link', { name: label, exact: true })
      .click();
    assert.equal(await second.page.getByRole('heading', { level: 1 }).textContent(), label);
  }
  await second.page.screenshot({ path: path.join(output, 'after-restart.png') });
  assert.deepEqual(second.requests, []);
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        success: true,
        executable: exe,
        profile,
        firstPid: first.pid,
        secondPid: second.pid,
        origin: new URL(second.page.url()).origin,
        offline: true,
        domainRecordsBefore: Object.entries(before)
          .filter(([name]) => name !== 'appSettings')
          .reduce((total, [, rows]) => total + rows.length, 0),
        preservedTables: Object.keys(before),
        exactSnapshotPreserved: true,
        uiDashboardBeforeAndAfterRestart: true,
        dashboardReadOnlySnapshotUnchanged: true,
        offlineWriteAfterRestart: true,
        uiAttendancePartialCompletionCorrection: true,
        uiAttendanceStatesNotesCountsPreserved: true,
        uiAttendanceDateGroupIsolation: true,
        offlineAttendanceWriteAfterRestart: true,
        attendanceBeforeRestart: before.attendance,
        uiAssignmentsCreatedEdited: true,
        uiSubmissionsStatesCommentsCountsPreserved: true,
        uiSubmissionCorrectionConfirmed: true,
        uiAssignmentTaskGroupIsolation: true,
        offlineSubmissionWriteAfterRestart: true,
        assignmentsBeforeRestart: before.assignments,
        submissionsBeforeRestart: before.submissions,
        uiNotesCreatedEdited: true,
        uiNotesHistoryPreserved: true,
        offlineNoteWriteAfterRestart: true,
        uiNoteDeleteCancelledAndConfirmed: true,
        notesBeforeRestart: before.studentNotes,
        uiReadingCreatedEdited: true,
        uiReadingHistoryWeeklyTotalsPreserved: true,
        offlineReadingWriteAfterRestart: true,
        readingBeforeRestart: before.readingLogs,
        uiCreatedYears: 2,
        uiCreatedGroups: 4,
        uiSelectionAndEditPreserved: true,
        uiStudentIdentityAndTwoEnrollmentsPreserved: true,
        studentContinuity: before.students
          .filter((s) => s.firstName === 'Ána editada')
          .map((student) => ({
            studentId: student.id,
            enrollments: before.enrollments
              .filter((e) => e.studentId === student.id)
              .map((e) => ({
                id: e.id,
                groupId: e.groupId,
                status: e.status,
                joinedAt: e.joinedAt,
                leftAt: e.leftAt ?? null,
              })),
          })),
        uiSingleEnrollmentDeactivationPreserved: true,
        archiveReactivationPreservedRelations: true,
        externalPageRequests: second.requests,
        checkedAt: new Date().toISOString(),
        limits:
          'No demuestra primer arranque sin red, tráfico del sistema operativo, actualización ni desinstalación.',
      },
      null,
      2,
    ),
  );
  if (process.env.CN012_BACKUP_UI === '1') {
    const priorRestore = await second.evaluate('ClassNoteProbe.snapshot()');
    const exportedSource = await readFile(backupFile, 'utf8');
    assert.deepEqual(
      await second.evaluate(
        `ClassNoteProbe.verifyRestoreRollback(${JSON.stringify(exportedSource)})`,
      ),
      { rollback: true, selectionPreserved: true },
    );
    await second.page
      .getByRole('navigation')
      .getByRole('link', { name: 'Configuración', exact: true })
      .click();
    console.log(`CN012: abrir ${backupFile}`);
    await second.page.getByRole('button', { name: 'Elegir respaldo para restaurar' }).click();
    await second.page
      .getByRole('region', { name: 'Previsualización del respaldo' })
      .waitFor({ timeout: 240000 });
    await second.page.screenshot({ path: path.join(output, 'backup-preview.png') });
    assert.deepEqual(await second.evaluate('ClassNoteProbe.snapshot()'), priorRestore);
    await second.page.getByLabel('Confirmo reemplazar').check();
    console.log(`CN012: guardar respaldo previo en ${previousBackupFile}`);
    await second.page.getByRole('button', { name: 'Guardar respaldo previo y restaurar' }).click();
    await second.page
      .getByText('Restauración completada. Contexto y vistas recargados.', { exact: true })
      .waitFor({ timeout: 240000 });
    assert.deepEqual(await second.evaluate('ClassNoteProbe.snapshot()'), before);
    const previousFile = await readFile(previousBackupFile, 'utf8');
    assert.deepEqual(
      await second.evaluate(`ClassNoteProbe.inspectBackup(${JSON.stringify(previousFile)})`),
      priorRestore,
    );
    await second.page.screenshot({ path: path.join(output, 'backup-restored.png') });
    await writeFile(path.join(output, 'backup-before-restore.json'), JSON.stringify(priorRestore));
  }
} finally {
  await second.stop();
}
if (process.env.CN012_BACKUP_UI === '1') {
  const third = await launch();
  try {
    assert.notEqual(third.pid, second.pid);
    assert.deepEqual(await third.evaluate('ClassNoteProbe.snapshot()'), before);
    await verifySelection(third.page);
    await verifyStudentHistory(third.page);
    await verifyAttendance(third.page);
    await verifySubmissions(third.page);
    await verifyReading(third.page);
    await verifyNotes(third.page);
    await third.page.screenshot({ path: path.join(output, 'backup-after-restart.png') });
    assert.deepEqual(third.requests, []);
    await writeFile(
      path.join(output, 'backup-result.json'),
      JSON.stringify(
        {
          success: true,
          profile,
          firstPid: first.pid,
          secondPid: second.pid,
          thirdPid: third.pid,
          exactTenTablesRestored: true,
          nativeTransactionRollbackVerified: true,
          relationsAndSelectionVerifiedByUI: true,
          offline: true,
          externalPageRequests: third.requests,
          checkedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    await third.stop();
  }
}
console.log(`Persistencia nativa verificada. Evidencia: ${path.join(output, 'result.json')}`);
