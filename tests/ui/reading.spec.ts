import { expect, test, type Page } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';
import { createStudentHistory } from '../helpers/student-flow';
import { attendanceNames, prepareAttendanceStudents } from '../helpers/attendance-flow';
import { addReading, openReading, recordReading, verifyReading } from '../helpers/reading-flow';
async function setup(page: Page) {
  await page.goto('/');
  await createYearsAndGroups(page);
  await createStudentHistory(page);
  await prepareAttendanceStudents(page);
  await openReading(page);
}
for (const width of [1100, 768, 360]) {
  test(`CN008 alta/edición/historial/semana offline y accesibilidad a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [],
      external: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (req) => {
      if (!req.url().startsWith('http://127.0.0.1:1421/')) external.push(req.url());
    });
    await setup(page);
    await context.setOffline(true);
    await recordReading(page);
    const history = page.getByRole('region', { name: 'Historial individual' });
    await expect(history).toContainText('Matrícula inactiva');
    await expect(history).toContainText('Sin salida registrada');
    await page.getByLabel('Lecturas desde').fill('2026-10-20');
    await expect(history).toContainText('Sin lecturas para esta matrícula y rango.');
    await expect(
      page.getByText('Total del grupo: 35 minutos · 3 registros', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Lecturas hasta').fill('2026-10-19');
    await expect(page.getByRole('alert')).toContainText('rango de historial ordenado');
    await page.getByLabel('Lecturas desde').fill('2026-10-19');
    await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[1] });
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Matrícula del historial').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Lecturas desde')).toBeFocused();
    await page.getByLabel('Fecha de la semana').fill('2027-01-01');
    await expect(
      page.getByText('Semana del 2026-12-28 al 2027-01-03', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Sin lecturas en esta semana.', { exact: true })).toBeVisible();
    await page.getByLabel('Fecha de la semana').fill('2026-10-19');
    for (const label of ['1.º B', '1.º A', '1.º B'])
      await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label });
    await expect(
      page.getByText('Total del grupo: 0 minutos · 0 registros', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Historial individual' }).getByRole('listitem'),
    ).toHaveCount(0);
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
    await verifyReading(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/reading-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Registrar lectura', exact: true }).click();
    await expect(page.getByLabel('Alumno / matrícula', { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/reading-form-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
test('CN008 borradores protegidos en navegación/contexto/historial y corrección cancelada sin escritura', async ({
  page,
}) => {
  await setup(page);
  await recordReading(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
  await openReading(page);
  await page.getByRole('button', { name: 'Registrar lectura', exact: true }).click();
  await page.getByLabel('Título o texto leído').fill('Borrador');
  for (const action of [
    () => page.goBack(),
    () => page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click(),
    () => page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' }),
    () =>
      page
        .getByLabel('Ciclo de trabajo', { exact: true })
        .selectOption({ label: 'Ciclo de prueba dos' }),
  ]) {
    const confirmation = new Promise<void>((resolve) => {
      page.once('dialog', async (dialog) => {
        await dialog.dismiss();
        resolve();
      });
    });
    await action();
    await confirmation;
    await expect(page).toHaveURL(/#\/lectura$/);
    await expect(page.getByLabel('Título o texto leído')).toHaveValue('Borrador');
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar lectura' }).click();
  await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await page
    .getByRole('button', { name: 'Editar lectura Libro corregido del 2026-10-19', exact: true })
    .click();
  await page.getByLabel('Minutos', { exact: true }).fill('25');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(page.getByLabel('Minutos', { exact: true })).toHaveValue('25');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar lectura' }).click();
  await verifyReading(page);
});
test('CN008 fallo de escritura conserva formulario; doble envío y consulta posterior fallida no duplican', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Registrar lectura', exact: true }).click();
  await page
    .getByLabel('Alumno / matrícula', { exact: true })
    .selectOption({ label: attendanceNames[0] });
  await page.getByLabel('Fecha de lectura').fill('2026-10-19');
  await page.getByLabel('Título o texto leído').fill('Única');
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let fail = true;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'readingLogs' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Título o texto leído')).toHaveValue('Única');
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    let fail = true;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      if (this.name === 'groups' && this.transaction.mode === 'readonly' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await page.getByRole('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.getByText('La lectura se guardó.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Reintenta solo la lectura');
  await expect(page.getByRole('button', { name: 'Guardar lectura' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await expect(
    page.getByRole('region', { name: 'Historial individual' }).getByRole('listitem'),
  ).toHaveCount(1);
  await page.getByLabel('Fecha de la semana').fill('2026-10-19');
  await expect(
    page.getByText('Total del grupo: 0 minutos · 1 registros', { exact: true }),
  ).toBeVisible();
});
test('CN008 conflicto entre ventanas conserva borrador y no sobrescribe; consulta inicial recuperable', async ({
  page,
  context,
}) => {
  await setup(page);
  await addReading(page, 10, 'Compartida');
  await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await page
    .getByRole('button', { name: 'Editar lectura Compartida del 2026-10-19', exact: true })
    .click();
  const other = await context.newPage();
  await other.goto('/#/lectura');
  await other.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await other
    .getByRole('button', { name: 'Editar lectura Compartida del 2026-10-19', exact: true })
    .click();
  await other.getByLabel('Título o texto leído').fill('Cambio remoto');
  other.once('dialog', (dialog) => dialog.accept());
  await other.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(other.getByRole('form')).toHaveCount(0);
  await page.getByLabel('Título o texto leído').fill('Mi borrador');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(page.getByRole('alert')).toContainText('otra ventana');
  await expect(page.getByLabel('Título o texto leído')).toHaveValue('Mi borrador');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar lectura' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
  // Inicio also reads groups. Finish that query before arming the one-shot fault.
  await expect(page.getByRole('region', { name: 'Resumen del grupo', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    let fail = true;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      if (this.name === 'groups' && this.transaction.mode === 'readonly' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await openReading(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await expect(page.getByText('Cambio remoto', { exact: true })).toBeVisible();
  await expect(page.getByText('Mi borrador', { exact: true })).toHaveCount(0);
  await other.close();
});
