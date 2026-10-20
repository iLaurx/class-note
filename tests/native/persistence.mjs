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
import { access, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'vite';
import { chromium } from '@playwright/test';
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
  before = await first.evaluate('ClassNoteProbe.snapshot()');
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
    assert.deepEqual(archived[table], afterWrite[table]);
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
        offlineWriteAfterRestart: true,
        uiAttendancePartialCompletionCorrection: true,
        uiAttendanceStatesNotesCountsPreserved: true,
        uiAttendanceDateGroupIsolation: true,
        offlineAttendanceWriteAfterRestart: true,
        attendanceBeforeRestart: before.attendance,
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
} finally {
  await second.stop();
}
console.log(`Persistencia nativa verificada. Evidencia: ${path.join(output, 'result.json')}`);
