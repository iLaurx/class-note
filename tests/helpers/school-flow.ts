import { expect, type Page } from '@playwright/test';
export async function createYearsAndGroups(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Configuración' }).click();
  for (const label of ['Ciclo de prueba uno', 'Ciclo de prueba dos']) {
    await page.getByRole('button', { name: 'Crear ciclo escolar', exact: true }).click();
    await page.getByLabel('Etiqueta', { exact: true }).fill(label);
    await page.getByLabel('Fecha de inicio').fill('2026-08-01');
    await page.getByLabel('Fecha de fin').fill('2027-07-31');
    await page.getByRole('button', { name: 'Guardar ciclo', exact: true }).click();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.getByRole('button', { name: `Ver grupos de ${label}`, exact: true }).click();
    for (const name of ['A', 'B']) {
      await page.getByRole('button', { name: 'Crear grupo', exact: true }).click();
      await page.getByLabel('Nombre del grupo', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
      await expect(page.getByRole('form')).toHaveCount(0);
    }
  }
  await page
    .getByLabel('Ciclo de trabajo', { exact: true })
    .selectOption({ label: 'Ciclo de prueba uno' });
  await expect(page.getByLabel('Grupo de trabajo', { exact: true })).toBeEnabled();
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
  await expect(page.getByRole('region', { name: 'Contexto de trabajo' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page
    .getByRole('button', { name: 'Ver grupos de Ciclo de prueba uno', exact: true })
    .click();
  await page.getByRole('button', { name: 'Editar grupo A', exact: true }).click();
  await page.getByLabel('Turno (opcional)').fill('Matutino de prueba');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByText('Matutino de prueba', { exact: true })).toBeVisible();
}
export async function verifySelection(page: Page) {
  const year = page.getByLabel('Ciclo de trabajo', { exact: true });
  const group = page.getByLabel('Grupo de trabajo', { exact: true });
  await expect(year.locator('option:checked')).toHaveText('Ciclo de prueba uno');
  await expect(group.locator('option:checked')).toHaveText('1.º A');
}
export async function verifyArchiveFlow(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Configuración' }).click();
  await page
    .getByRole('button', { name: 'Ver grupos de Ciclo de prueba uno', exact: true })
    .click();
  await expect(page.getByText('Matutino de prueba', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archivar grupo A', exact: true }).click();
  await expect(
    page.getByText('Este registro se retirará de tu selección de trabajo.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar archivo' }).click();
  await verifySelection(page);
  await page.getByRole('button', { name: 'Archivar grupo A', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar archivo' }).click();
  await expect(page.getByLabel('Grupo de trabajo', { exact: true })).toHaveValue('');
  await page.getByLabel('Mostrar archivados').check();
  await page.getByRole('button', { name: 'Reactivar grupo A', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar grupo A', exact: true })).toBeEnabled();
  await page
    .getByRole('button', { name: 'Archivar ciclo Ciclo de prueba uno', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar archivo' }).click();
  await expect(page.getByLabel('Ciclo de trabajo', { exact: true })).toHaveValue('');
  await page
    .getByRole('button', { name: 'Reactivar ciclo Ciclo de prueba uno', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Editar grupo A', exact: true })).toBeEnabled();
  await expect(page.getByText('Matutino de prueba', { exact: true })).toBeVisible();
}
