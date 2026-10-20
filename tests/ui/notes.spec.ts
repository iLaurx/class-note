import { expect, test, type Page } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';
import { createStudentHistory } from '../helpers/student-flow';
import { attendanceNames, prepareAttendanceStudents } from '../helpers/attendance-flow';
import { addNote, openNotes, recordNotes, verifyNotes } from '../helpers/notes-flow';
async function setup(page: Page) {
  await page.goto('/');
  await createYearsAndGroups(page);
  await createStudentHistory(page);
  await prepareAttendanceStudents(page);
  await openNotes(page);
}
for (const width of [1100, 768, 360]) {
  test(`CN009 formularios, filtros, eliminación accesible y aislamiento offline a ${width}px`, async ({
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
    await expect(
      page.getByText('Este grupo aún no tiene observaciones.', { exact: true }),
    ).toBeVisible();
    await recordNotes(page);
    const history = page.getByRole('region', { name: 'Historial de observaciones' });
    await expect(history).toContainText('Matrícula inactiva');
    await page.getByLabel('Buscar por nombre o texto').fill('corregida');
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Buscar por nombre o texto').fill('ana editada');
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Buscar por nombre o texto').fill('');
    await page.getByLabel('Filtrar por categoría').selectOption('academic');
    await expect(history).toContainText('Sin coincidencias');
    await page.getByLabel('Filtrar por categoría').selectOption('participation');
    await page.getByLabel('Observaciones desde').fill('2026-10-20');
    await expect(history.getByRole('listitem')).toHaveCount(0);
    await page.getByLabel('Observaciones hasta').fill('2026-10-19');
    await expect(page.getByRole('alert')).toContainText('rango');
    await page.getByLabel('Observaciones desde').fill('2026-10-19');
    await expect(history.getByRole('listitem')).toHaveCount(2);
    await page.getByLabel('Filtrar por matrícula').selectOption({ label: attendanceNames[0] });
    await expect(history.getByRole('listitem')).toHaveCount(1);
    const remove = page.getByRole('button', {
      name: `Eliminar observación de ${attendanceNames[0]} del 2026-10-19`,
      exact: true,
    });
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(attendanceNames[0]!);
      expect(dialog.message()).toContain('2026-10-19');
      await dialog.dismiss();
    });
    await remove.click();
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Filtrar por matrícula').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Observaciones desde')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/notes-${width}.png`, fullPage: true });
    await remove.focus();
    page.once('dialog', (dialog) => dialog.accept());
    await page.keyboard.press('Enter');
    await expect(page.getByText('La observación se eliminó.', { exact: true })).toBeVisible();
    await expect(history.getByRole('listitem')).toHaveCount(0);
    await page.getByLabel('Filtrar por matrícula').selectOption('');
    await expect(history.getByRole('listitem')).toHaveCount(1);
    for (const label of ['1.º B', '1.º A', '1.º B'])
      await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label });
    await expect(page.getByText('Otra observación', { exact: true })).toHaveCount(0);
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
    await expect(page.getByText('Otra observación', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar observación', exact: true }).click();
    await expect(page.getByLabel('Alumno / matrícula', { exact: true })).toBeFocused();
    await page
      .getByLabel('Alumno / matrícula', { exact: true })
      .selectOption({ label: attendanceNames[0] });
    await page.getByLabel('Fecha de observación').fill('2026-10-19');
    await page.getByRole('button', { name: 'Guardar observación', exact: true }).click();
    await expect(page.getByRole('form')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/notes-form-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
test('CN009 borradores protegidos en navegación/contexto/historial y corrección cancelada sin escritura', async ({
  page,
}) => {
  await setup(page);
  await recordNotes(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
  await openNotes(page);
  await page.getByRole('button', { name: 'Registrar observación', exact: true }).click();
  await page.getByLabel('Texto de la observación').fill('Borrador');
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
    await expect(page).toHaveURL(/#\/observaciones$/);
    await expect(page.getByLabel('Texto de la observación')).toHaveValue('Borrador');
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar observación' }).click();
  await page.getByLabel('Filtrar por matrícula').selectOption({ label: attendanceNames[0] });
  await page
    .getByRole('button', {
      name: `Editar observación de ${attendanceNames[0]} del 2026-10-19`,
      exact: true,
    })
    .click();
  await page.getByLabel('Texto de la observación').fill('Cambio cancelado');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Guardar observación' }).click();
  await expect(page.getByLabel('Texto de la observación')).toHaveValue('Cambio cancelado');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar observación' }).click();
  await verifyNotes(page);
});
test('CN009 fallo de escritura conserva formulario; doble envío y consulta posterior fallida no duplican', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Registrar observación', exact: true }).click();
  await page
    .getByLabel('Alumno / matrícula', { exact: true })
    .selectOption({ label: attendanceNames[0] });
  await page.getByLabel('Fecha de observación').fill('2026-10-19');
  await page.getByLabel('Texto de la observación').fill('Única');
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let fail = true;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'studentNotes' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar observación' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Texto de la observación')).toHaveValue('Única');
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
  await expect(page.getByText('La observación se guardó.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Reintenta solo la lectura');
  await expect(page.getByRole('button', { name: 'Guardar observación' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await page.getByLabel('Filtrar por matrícula').selectOption({ label: attendanceNames[0] });
  await expect(
    page.getByRole('region', { name: 'Historial de observaciones' }).getByRole('listitem'),
  ).toHaveCount(1);
});
test('CN009 conflicto entre ventanas conserva borrador y no sobrescribe; consulta inicial recuperable', async ({
  page,
  context,
}) => {
  await setup(page);
  await addNote(page, 'Compartida');
  await page.getByLabel('Filtrar por matrícula').selectOption({ label: attendanceNames[0] });
  await page
    .getByRole('button', {
      name: `Editar observación de ${attendanceNames[0]} del 2026-10-19`,
      exact: true,
    })
    .click();
  const other = await context.newPage();
  await other.goto('/#/observaciones');
  await other.getByLabel('Filtrar por matrícula').selectOption({ label: attendanceNames[0] });
  await other
    .getByRole('button', {
      name: `Editar observación de ${attendanceNames[0]} del 2026-10-19`,
      exact: true,
    })
    .click();
  await other.getByLabel('Texto de la observación').fill('Cambio remoto');
  other.once('dialog', (dialog) => dialog.accept());
  await other.getByRole('button', { name: 'Guardar observación' }).click();
  await expect(other.getByRole('form')).toHaveCount(0);
  await page.getByLabel('Texto de la observación').fill('Mi borrador');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar observación' }).click();
  await expect(page.getByRole('alert')).toContainText('otra ventana');
  await expect(page.getByLabel('Texto de la observación')).toHaveValue('Mi borrador');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar observación' }).click();
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
  await openNotes(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await page.getByLabel('Filtrar por matrícula').selectOption({ label: attendanceNames[0] });
  await expect(page.getByText('Cambio remoto', { exact: true })).toBeVisible();
  await expect(page.getByText('Mi borrador', { exact: true })).toHaveCount(0);
  await other.close();
});

test('CN009 eliminación con error recuperable, lectura fallida tras commit y conflicto sin borrar corrección ajena', async ({
  page,
  context,
}) => {
  await setup(page);
  await addNote(page, 'Compartida');
  const other = await context.newPage();
  await other.goto('/#/observaciones');
  const edit = other.getByRole('button', { name: /Editar observación de/ });
  await edit.click();
  await other.getByLabel('Texto de la observación').fill('Cambio remoto');
  other.once('dialog', (dialog) => dialog.accept());
  await other.getByRole('button', { name: 'Guardar observación', exact: true }).click();
  await expect(other.getByRole('form')).toHaveCount(0);
  const remove = page.getByRole('button', { name: /Eliminar observación de/ });
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole('alert')).toContainText('otra ventana');
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await expect(page.getByText('Cambio remoto', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const remove = IDBObjectStore.prototype.delete;
    let fail = true;
    IDBObjectStore.prototype.delete = function (...args: Parameters<IDBObjectStore['delete']>) {
      if (this.name === 'studentNotes' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return remove.apply(this, args);
    };
  });
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await expect(page.getByText('Cambio remoto', { exact: true })).toBeVisible();
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
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByText('La observación se eliminó.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Reintenta solo la lectura');
  await expect(remove).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar consulta' }).click();
  await expect(
    page.getByText('Este grupo aún no tiene observaciones.', { exact: true }),
  ).toBeVisible();
  await other.close();
});
