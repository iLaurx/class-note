import { expect, test, type Page } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';
import { createStudentHistory } from '../helpers/student-flow';
import {
  openAttendance,
  prepareAttendanceStudents,
  recordAttendance,
  statusField,
  noteField,
} from '../helpers/attendance-flow';
async function setup(page: Page) {
  await page.goto('/');
  await createYearsAndGroups(page);
  await createStudentHistory(page);
  await prepareAttendanceStudents(page);
  await openAttendance(page);
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  await expect(statusField(page, 0)).toBeVisible();
}
for (const width of [1100, 768, 360]) {
  test(`CN006 captura parcial, corrección, aislamiento y teclado offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:1421/')) external.push(request.url());
    });
    await setup(page);
    await context.setOffline(true);
    await recordAttendance(page);
    await statusField(page, 1).focus();
    await page.keyboard.press('ArrowDown');
    await expect(statusField(page, 1)).toBeFocused();
    // Discard this keyboard draft explicitly, preserving the saved day.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-20');
    await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
    await expect(statusField(page, 0)).toHaveValue('present');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/attendance-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('CN006 proteger fecha, ciclo, grupo, navegación e historial; descartar explícitamente', async ({
  page,
}) => {
  await setup(page);
  await statusField(page, 0).selectOption('absent');
  await noteField(page, 0).fill('Borrador ficticio');
  const date = page.getByLabel('Fecha de asistencia', { exact: true });
  for (const action of [
    () => page.goBack(),
    () => date.fill('2026-10-20'),
    () =>
      page
        .getByLabel('Ciclo de trabajo', { exact: true })
        .selectOption({ label: 'Ciclo de prueba dos' }),
    () => page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' }),
    () => page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click(),
  ]) {
    page.once('dialog', (dialog) => dialog.dismiss());
    await action();
    await expect(page).toHaveURL(/#\/asistencia$/);
    await expect(date).toHaveValue('2026-10-19');
    await expect(noteField(page, 0)).toHaveValue('Borrador ficticio');
    await expect(
      page.getByLabel('Grupo de trabajo', { exact: true }).locator('option:checked'),
    ).toHaveText('1.º A');
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tareas');
  await openAttendance(page);
  await date.fill('2026-10-19');
  await expect(statusField(page, 0)).toHaveValue('');
  await expect(noteField(page, 0)).toHaveValue('');
});

test('CN006 marcar todos conserva notas y no guarda hasta confirmar el lote; cancelar corrección no escribe', async ({
  page,
}) => {
  await setup(page);
  await statusField(page, 0).selectOption('late');
  await noteField(page, 0).fill('Nota masiva sintética');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Marcar todos presentes', exact: true }).click();
  for (let i = 0; i < 4; i++) await expect(statusField(page, i)).toHaveValue('present');
  await expect(noteField(page, 0)).toHaveValue('Nota masiva sintética');
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(page.getByText('Día registrado', { exact: true })).toBeVisible();
  await statusField(page, 0).selectOption('absent');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  await expect(statusField(page, 0)).toHaveValue('present');
  await expect(noteField(page, 0)).toHaveValue('Nota masiva sintética');
  await expect(statusField(page, 0).locator('option[value=""]')).toHaveJSProperty('disabled', true);
});

test('CN006 fallo de escritura conserva borrador; error de recarga reconoce guardado confirmado', async ({
  page,
}) => {
  await setup(page);
  await statusField(page, 0).selectOption('late');
  await noteField(page, 0).fill('Se conserva');
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let fail = true;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'attendance' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo acceder');
  await expect(noteField(page, 0)).toHaveValue('Se conserva');
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    let fail = true;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      // Read-only refresh after commit, never the transactional write validations.
      if (this.name === 'groups' && this.transaction.mode === 'readonly' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('La asistencia se guardó');
  await expect(page.getByRole('button', { name: 'Guardar asistencia', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Reintentar lectura', exact: true }).click();
  await expect(statusField(page, 0)).toHaveValue('late');
  await expect(noteField(page, 0)).toHaveValue('Se conserva');
  await expect(page.getByText('Captura parcial', { exact: true })).toBeVisible();
});

test('CN006 lectura fallida recuperable, fecha inválida y alternancia rápida sin datos antiguos', async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-07-31');
  await expect(page.getByText('Elige una fecha válida entre', { exact: false })).toBeVisible();
  await expect(statusField(page, 0)).toHaveCount(0);
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    let fail = true;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      if (this.name === 'groups' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar');
  await page.getByRole('button', { name: 'Reintentar lectura', exact: true }).click();
  await expect(statusField(page, 0)).toHaveValue('');
  await statusField(page, 0).selectOption('absent');
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(page.getByText('Captura parcial', { exact: true })).toBeVisible();
  for (const date of ['2026-10-20', '2026-10-19', '2026-10-20'])
    await page.getByLabel('Fecha de asistencia', { exact: true }).fill(date);
  await expect(statusField(page, 0)).toHaveValue('');
  await expect(page.getByText('Día sin captura', { exact: true })).toBeVisible();
});

test('CN006 conflicto entre ventanas conserva el borrador y exige revisar sin sobrescribir', async ({
  page,
  context,
}) => {
  await setup(page);
  const second = await context.newPage();
  await second.goto('/#/asistencia');
  await second.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  await expect(statusField(second, 0)).toHaveValue('');
  await statusField(page, 0).selectOption('present');
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(page.getByText('Captura parcial', { exact: true })).toBeVisible();
  await statusField(second, 0).selectOption('late');
  await noteField(second, 0).fill('Borrador concurrente sintético');
  await second.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('otra ventana');
  await expect(statusField(second, 0)).toHaveValue('late');
  await expect(noteField(second, 0)).toHaveValue('Borrador concurrente sintético');
  second.once('dialog', (dialog) => dialog.accept());
  await second.getByRole('button', { name: 'Revisar día guardado', exact: true }).click();
  await expect(statusField(second, 0)).toHaveValue('present');
  await expect(noteField(second, 0)).toHaveValue('');
  await second.close();
});

test('CN006 sin contexto y hoy fuera del ciclo requiere elegir fecha explícita', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2028, 0, 1, 12));
  await page.goto('/#/asistencia');
  await expect(
    page.getByText('Selecciona un ciclo y un grupo para registrar asistencia.'),
  ).toBeVisible();
  await createYearsAndGroups(page);
  await openAttendance(page);
  await expect(page.getByLabel('Fecha de asistencia', { exact: true })).toHaveValue('');
  await expect(page.getByText('Elige una fecha válida entre', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar asistencia', exact: true })).toHaveCount(
    0,
  );
});
