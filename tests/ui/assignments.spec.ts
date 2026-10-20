import { expect, test, type Page } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';
import { createStudentHistory } from '../helpers/student-flow';
import { prepareAttendanceStudents } from '../helpers/attendance-flow';
import {
  commentField,
  createTask,
  openAssignments,
  prepareAssignments,
  recordSubmissions,
  saveDeliveries,
  statusField,
  taskTitle,
} from '../helpers/assignment-flow';
async function setup(page: Page) {
  await page.goto('/');
  await createYearsAndGroups(page);
  await createStudentHistory(page);
  await prepareAttendanceStudents(page);
  await openAssignments(page);
}
for (const width of [1100, 768, 360]) {
  test(`CN007 tareas/estados/comentarios/correcciones/filtros/aislamiento offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (req) => {
      if (!req.url().startsWith('http://127.0.0.1:1421/')) external.push(req.url());
    });
    await setup(page);
    await context.setOffline(true);
    await recordSubmissions(page);
    await statusField(page, 1).focus();
    await page.keyboard.press('ArrowDown');
    await expect(statusField(page, 1)).toBeFocused();
    await statusField(page, 1).selectOption('pending');
    await expect(saveDeliveries(page)).toBeDisabled();
    await page.getByLabel('Buscar alumno').fill('BRUNO');
    await expect(statusField(page, 0)).toHaveCount(0);
    await expect(statusField(page, 1)).toBeVisible();
    await page.getByLabel('Buscar alumno').fill('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/assignments-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('CN007 protege formulario y entregas en tarea/sección/ciclo/grupo/historial', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Borrador ficticio');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Borrador ficticio');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar tarea', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
  await openAssignments(page);
  await prepareAssignments(page);
  await commentField(page, 0).fill('Sin guardar');
  for (const action of [
    () => page.goBack(),
    () =>
      page
        .getByRole('button', { name: 'Ver entregas de Otra tarea sintética', exact: true })
        .click(),
    () => page.getByRole('button', { name: `Editar tarea ${taskTitle}`, exact: true }).click(),
    () => page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' }),
    () =>
      page
        .getByLabel('Ciclo de trabajo', { exact: true })
        .selectOption({ label: 'Ciclo de prueba dos' }),
    () => page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click(),
  ]) {
    const confirmation = page.waitForEvent('dialog');
    page.once('dialog', (dialog) => dialog.dismiss());
    await action();
    await confirmation;
    await expect(commentField(page, 0)).toHaveValue('Sin guardar');
    await expect(page).toHaveURL(/#\/tareas$/);
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Ver entregas de Otra tarea sintética', exact: true })
    .click();
  await expect(commentField(page, 0)).toHaveValue('');
});

test('CN007 error de escritura conserva borrador y fallo de lectura posterior no reenvía', async ({
  page,
}) => {
  await setup(page);
  await prepareAssignments(page);
  await commentField(page, 0).fill('Se conserva');
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let fail = true;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'submissions' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return add.apply(this, args);
    };
  });
  await saveDeliveries(page).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo acceder');
  await expect(commentField(page, 0)).toHaveValue('Se conserva');
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
  await saveDeliveries(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Las entregas se guardaron');
  await expect(saveDeliveries(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar lectura', exact: true }).click();
  await expect(commentField(page, 0)).toHaveValue('Se conserva');
  await expect(statusField(page, 0)).toHaveValue('pending');
  await expect(saveDeliveries(page)).toBeDisabled();
  await expect(page.getByText('Aún no tiene registro guardado', { exact: true })).toHaveCount(3);
});

test('CN007 conflictos entre ventanas conservan borrador y revisión explícita', async ({
  page,
  context,
}) => {
  await setup(page);
  await prepareAssignments(page);
  const second = await context.newPage();
  await second.goto('/#/tareas');
  await second.getByRole('button', { name: `Ver entregas de ${taskTitle}`, exact: true }).click();
  await expect(statusField(second, 0)).toHaveValue('pending');
  await statusField(page, 0).selectOption('submitted');
  await saveDeliveries(page).click();
  await expect(saveDeliveries(page)).toBeDisabled();
  await statusField(second, 0).selectOption('incomplete');
  await commentField(second, 0).fill('Conflicto ficticio');
  await saveDeliveries(second).click();
  await expect(second.getByRole('alert')).toContainText('otra ventana');
  await expect(commentField(second, 0)).toHaveValue('Conflicto ficticio');
  second.once('dialog', (dialog) => dialog.accept());
  await second.getByRole('button', { name: 'Revisar entregas guardadas', exact: true }).click();
  await expect(statusField(second, 0)).toHaveValue('submitted');
  await expect(commentField(second, 0)).toHaveValue('');
  await second.close();
});

test('CN007 sin contexto, fecha inicial fuera de ciclo y listado fallido recuperable sin repetir alta', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2028, 0, 1, 12));
  await page.goto('/#/tareas');
  await expect(
    page.getByText('Selecciona un ciclo y un grupo para gestionar tareas.', { exact: true }),
  ).toBeVisible();
  await createYearsAndGroups(page);
  await openAssignments(page);
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await expect(page.getByLabel('Fecha de asignación', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Cancelar tarea', exact: true }).click();
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
  await createTask(page, 'Alta única sintética');
  await expect(page.getByRole('alert')).toContainText('Reintenta solo la lectura');
  await page.getByRole('button', { name: 'Reintentar listado', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Ver entregas de Alta única sintética', exact: true }),
  ).toHaveCount(1);
});

test('CN007 cambios rápidos de grupo no publican detalle ni conteos anteriores', async ({
  page,
}) => {
  await setup(page);
  await prepareAssignments(page);
  for (const label of ['1.º B', '1.º A', '1.º B'])
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label });
  await expect(page.getByText('Este grupo aún no tiene tareas.', { exact: true })).toBeVisible();
  await expect(page.getByRole('definition')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Entregas de la tarea' })).toHaveCount(0);
});

test('CN007 editar tarea conserva entregas; fecha incompatible rechazada e incidencia visible sin edición', async ({
  page,
}) => {
  await setup(page);
  await prepareAssignments(page);
  await commentField(page, 0).fill('Comentario histórico');
  await statusField(page, 0).selectOption('submitted');
  await saveDeliveries(page).click();
  await expect(saveDeliveries(page)).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Entregas de la tarea' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: `Editar tarea ${taskTitle}`, exact: true }).click();
  await page.getByLabel('Descripción (opcional)', { exact: true }).fill('Descripción corregida');
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page.getByRole('button', { name: `Ver entregas de ${taskTitle}`, exact: true }).click();
  await expect(commentField(page, 0)).toHaveValue('Comentario histórico');
  // A synthetic historical correction simulates data changed after this task was assigned.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('classnote');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['students', 'enrollments'], 'readwrite');
        const students = tx.objectStore('students').getAll();
        students.onsuccess = () => {
          const student = (students.result as { id: string; firstName: string }[]).find(
            (s) => s.firstName === 'Ána editada',
          );
          const entries = tx.objectStore('enrollments').getAll();
          entries.onsuccess = () => {
            for (const row of entries.result as { studentId: string; joinedAt: string }[])
              if (row.studentId === student?.id)
                tx.objectStore('enrollments').put({ ...row, joinedAt: '2026-10-20' });
          };
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(new Error('Fallo de fixture'));
        };
      };
      request.onerror = () => reject(new Error('Fallo de fixture'));
    });
  });
  await page.getByRole('button', { name: `Editar tarea ${taskTitle}`, exact: true }).click();
  await page.getByLabel('Fecha de asignación', { exact: true }).fill('2026-10-18');
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('dejaría entregas fuera de su población');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar tarea', exact: true }).click();
  await page.getByRole('button', { name: `Ver entregas de ${taskTitle}`, exact: true }).click();
  const incidents = page.getByRole('region', { name: 'Incidencias de entregas' });
  await expect(incidents).toContainText('Comentario histórico');
  await expect(incidents).toContainText('Fuera del intervalo de matrícula');
  await expect(statusField(page, 0)).toHaveCount(0);
  await expect(incidents.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('definition')).toHaveText(['3', '0', '0', '0', '3', '3']);
});
