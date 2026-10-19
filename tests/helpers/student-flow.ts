import { expect, type Page } from '@playwright/test';
export async function openStudents(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alumnos del grupo' })).toBeVisible();
}
export async function selectStudentContext(page: Page, year: string) {
  await page.getByLabel('Ciclo de trabajo', { exact: true }).selectOption({ label: year });
  await expect(page.getByLabel('Grupo de trabajo', { exact: true })).toBeEnabled();
  await page
    .getByLabel('Grupo de trabajo', { exact: true })
    .selectOption({ label: year.endsWith('dos') ? '2.º A' : '1.º A' });
  await expect(page.getByRole('region', { name: 'Contexto de trabajo' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
}
export async function createStudentHistory(page: Page) {
  // Different grade in the second cycle, through existing administration UI.
  await page
    .getByRole('button', { name: 'Ver grupos de Ciclo de prueba dos', exact: true })
    .click();
  await page.getByRole('button', { name: 'Editar grupo A', exact: true }).click();
  await page.getByRole('combobox', { name: 'Grado', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await openStudents(page);
  await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
  await page.getByLabel('Nombre o nombres').fill('Ána ficticia');
  await page.getByLabel('Apellido o apellidos').fill('Pérez de prueba');
  await page.getByLabel('Fecha de ingreso').fill('2026-08-01');
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Ver ficha de Pérez de prueba, Ána ficticia', exact: true })
    .click();
  await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  await page.getByLabel('Nombre o nombres').fill('Ána editada');
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await selectStudentContext(page, 'Ciclo de prueba dos');
  await expect(page.getByRole('region', { name: 'Detalle del alumno' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Matricular alumno existente', exact: true }).click();
  await page.getByLabel('Buscar fichas en todos los grupos').fill('ana editada');
  await page.getByRole('radio').check();
  await page.getByLabel('Fecha de ingreso').fill('2026-09-01');
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Ver ficha de Pérez de prueba, Ána editada', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Detalle del alumno' }).getByRole('listitem'),
  ).toHaveCount(2);
  await selectStudentContext(page, 'Ciclo de prueba uno');
  await page
    .getByRole('button', { name: 'Ver ficha de Pérez de prueba, Ána editada', exact: true })
    .click();
  await page.getByRole('button', { name: 'Dar de baja del grupo', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar formulario', exact: true }).click();
  await expect(page.getByText('Matrícula activa', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Dar de baja del grupo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar baja', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page.getByLabel('Mostrar matrículas inactivas').check();
  await expect(page.getByText('Matrícula inactiva', { exact: false })).toBeVisible();
}
export async function verifyStudentHistory(page: Page) {
  await openStudents(page);
  await page.getByLabel('Mostrar matrículas inactivas').check();
  await page
    .getByRole('button', { name: 'Ver ficha de Pérez de prueba, Ána editada', exact: true })
    .click();
  const detail = page.getByRole('region', { name: 'Detalle del alumno' });
  await expect(detail.getByRole('listitem')).toHaveCount(2);
  await expect(detail).toContainText('Ciclo de prueba uno');
  await expect(detail).toContainText('Ciclo de prueba dos');
  await expect(detail).toContainText('2.º A');
  await expect(detail).toContainText('Ingreso: 2026-08-01');
  await expect(detail).toContainText('Ingreso: 2026-09-01');
  await expect(page.getByText('Matrícula inactiva', { exact: false })).toBeVisible();
}
