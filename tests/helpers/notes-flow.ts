import { expect, type Page } from '@playwright/test';
import { attendanceNames } from './attendance-flow.ts';
export async function openNotes(page: Page) {
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Observaciones', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Observaciones del grupo' })).toBeVisible();
}
export async function addNote(page: Page, body = 'Observación sintética', index = 0) {
  await page.getByRole('button', { name: 'Registrar observación', exact: true }).click();
  await page
    .getByLabel('Alumno / matrícula', { exact: true })
    .selectOption({ label: attendanceNames[index] });
  await page.getByLabel('Fecha de observación', { exact: true }).fill('2026-10-19');
  await page.getByLabel('Categoría', { exact: true }).selectOption('participation');
  await page.getByLabel('Texto de la observación', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Guardar observación', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByText('La observación se guardó.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Registrar observación', exact: true }),
  ).toBeVisible();
}
export async function verifyNotes(page: Page) {
  await openNotes(page);
  await page.getByLabel('Filtrar por matrícula', { exact: true }).selectOption('');
  await expect(
    page.getByRole('region', { name: 'Historial de observaciones' }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(page.getByText('Observación corregida', { exact: true })).toBeVisible();
  await expect(page.getByText('Otra observación', { exact: true })).toBeVisible();
}
export async function recordNotes(page: Page) {
  await openNotes(page);
  await addNote(page);
  await addNote(page, 'Otra observación', 1);
  await page
    .getByRole('button', {
      name: `Editar observación de ${attendanceNames[0]} del 2026-10-19`,
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Alumno / matrícula', { exact: true })).toBeDisabled();
  await page.getByLabel('Texto de la observación').fill('Observación corregida');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar observación', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await verifyNotes(page);
}
