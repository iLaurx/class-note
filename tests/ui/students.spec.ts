import { expect, test } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';
import { createStudentHistory, verifyStudentHistory, openStudents } from '../helpers/student-flow';
for (const width of [1100, 768, 360]) {
  test(`CN005 identidad histórica, baja, reactivación y archivo a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await openStudents(page);
    await expect(
      page.getByText('Selecciona un ciclo y un grupo en Contexto de trabajo.', { exact: false }),
    ).toBeVisible();
    await createYearsAndGroups(page);
    await context.setOffline(true);
    await createStudentHistory(page);
    await verifyStudentHistory(page);
    await page.getByRole('button', { name: 'Reactivar matrícula', exact: true }).click();
    await page.getByLabel('Fecha de salida (opcional)').fill('2026-10-19');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Corregir fechas', exact: true }).click();
    await page.getByLabel('Fecha de salida (opcional)').fill('');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Archivar alumno', exact: true }).click();
    await expect(
      page.getByText('desactivará 2 matrículas activas.', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar formulario', exact: true }).click();
    await page.getByRole('button', { name: 'Archivar alumno', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar archivo del alumno', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reactivar ficha', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reactivar ficha', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Reactivar matrícula', exact: true }),
    ).toBeEnabled();
    await page.getByLabel('Buscar en este grupo').fill('nadie');
    await expect(
      page.getByText('No hay coincidencias en este grupo.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Buscar en este grupo').fill('ana editada');
    await expect(
      page.getByRole('button', { name: 'Ver ficha de Pérez de prueba, Ána editada', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/students-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('CN005 homónimos distinguibles y cambio de contexto cancela formulario sin escribir', async ({
  page,
}) => {
  await page.goto('/');
  await createYearsAndGroups(page);
  await openStudents(page);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
    await page.getByLabel('Nombre o nombres').fill('Homónimo');
    await page.getByLabel('Apellido o apellidos').fill('Prueba');
    await page.getByLabel('Fecha de ingreso').fill('2026-08-01');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByRole('form')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Matricular alumno existente', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(2);
  const labels = await page
    .getByRole('radio')
    .evaluateAll((nodes) => nodes.map((n) => n.parentElement?.textContent));
  expect(labels[0]).not.toBe(labels[1]);
  await page.getByRole('button', { name: 'Cancelar formulario', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
  await page.getByLabel('Nombre o nombres').fill('No guardar');
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' });
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByText('Al cambiar de contexto se cierran', { exact: false })).toBeVisible();
  await expect(
    page.getByText('No hay alumnos con el filtro actual.', { exact: false }),
  ).toBeVisible();
  // Rapid selections never show the previous group's records as B's records.
  for (const label of ['1.º A', '1.º B']) {
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label });
    await expect(page.getByRole('region', { name: 'Contexto de trabajo' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  }
  await expect(
    page.getByRole('button', { name: 'Ver ficha de Prueba, Homónimo', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
  await expect(
    page.getByRole('button', { name: 'Ver ficha de Prueba, Homónimo', exact: true }),
  ).toHaveCount(2);
});

test('CN005 error de escritura conserva formulario y permite reintentar por teclado', async ({
  page,
}) => {
  await page.goto('/');
  await createYearsAndGroups(page);
  await openStudents(page);
  await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
  await page.getByLabel('Nombre o nombres').fill('Error ficticio');
  await page.getByLabel('Apellido o apellidos').fill('Prueba');
  await page.getByLabel('Fecha de ingreso').fill('2026-08-01');
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let fail = true;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'enrollments' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo acceder');
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Error ficticio');
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Ver ficha de Prueba, Error ficticio', exact: true }),
  ).toHaveCount(1);
});

test('CN005 errores de lectura y de consulta posterior al guardado no duplican fichas', async ({
  page,
}) => {
  await page.goto('/');
  await createYearsAndGroups(page);
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
  await openStudents(page);
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar la lista.');
  await page.getByRole('button', { name: 'Reintentar lista', exact: true }).click();
  await expect(
    page.getByText('No hay alumnos con el filtro actual.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
  await page.getByLabel('Nombre o nombres').fill('Guardado ficticio');
  await page.getByLabel('Apellido o apellidos').fill('Prueba');
  await page.getByLabel('Fecha de ingreso').fill('2026-08-01');
  // The mutation commits; only the global projection following it fails.
  await page.evaluate(() => {
    const getAll = IDBObjectStore.prototype.getAll;
    let fail = true;
    IDBObjectStore.prototype.getAll = function (...args: Parameters<IDBObjectStore['getAll']>) {
      if (this.name === 'students' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return getAll.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Los cambios se guardaron');
  await page.getByRole('button', { name: 'Reintentar lista', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Ver ficha de Prueba, Guardado ficticio', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Matricular alumno existente', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await page.getByRole('radio').check();
  await expect(
    page.getByText('Ya tiene matrícula activa en este grupo.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar reactivación', exact: true }),
  ).toBeDisabled();
});

test('CN005 matrícula existente inactiva se reactiva con intervalo confirmado, sin otra ficha', async ({
  page,
}) => {
  await page.goto('/');
  await createYearsAndGroups(page);
  await createStudentHistory(page);
  await page.getByRole('button', { name: 'Cerrar detalle', exact: true }).click();
  await page.getByRole('button', { name: 'Matricular alumno existente', exact: true }).click();
  await page.getByLabel('Buscar fichas en todos los grupos').fill('ana editada');
  await page.getByRole('radio').check();
  await expect(page.getByLabel('Fecha de ingreso')).toHaveValue('2026-08-01');
  await page.getByLabel('Fecha de salida (opcional)').fill('2026-10-19');
  await page.getByRole('button', { name: 'Confirmar reactivación', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByText('Matrícula activa', { exact: false })).toBeVisible();
  await page
    .getByRole('button', { name: 'Ver ficha de Pérez de prueba, Ána editada', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Detalle del alumno' }).getByRole('listitem'),
  ).toHaveCount(2);
});
