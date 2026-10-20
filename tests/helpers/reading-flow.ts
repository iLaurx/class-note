import { expect, type Page } from '@playwright/test';
import { attendanceNames } from './attendance-flow.ts';
export async function openReading(page: Page) {
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Lectura en casa', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Lecturas del grupo' })).toBeVisible();
}
export async function addReading(page: Page, minutes = 0, title = 'Libro sintético', index = 0) {
  await page.getByRole('button', { name: 'Registrar lectura', exact: true }).click();
  await page
    .getByLabel('Alumno / matrícula', { exact: true })
    .selectOption({ label: attendanceNames[index] });
  await page.getByLabel('Fecha de lectura', { exact: true }).fill('2026-10-19');
  await page.getByLabel('Título o texto leído', { exact: true }).fill(title);
  await page.getByLabel('Minutos', { exact: true }).fill(String(minutes));
  await page
    .getByLabel('Comentario (opcional)', { exact: true })
    .fill('Comentario de lectura ficticio');
  await page.getByRole('button', { name: 'Guardar lectura', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByText('La lectura se guardó.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar lectura', exact: true })).toBeVisible();
}
export async function verifyReading(page: Page) {
  await openReading(page);
  await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await page.getByLabel('Fecha de la semana').fill('2026-10-19');
  await expect(
    page.getByRole('region', { name: 'Historial individual' }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(
    page.getByText('Total del grupo: 35 minutos · 3 registros', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Semana del 2026-10-19 al 2026-10-25', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Libro corregido', { exact: true })).toBeVisible();
}
export async function recordReading(page: Page) {
  await openReading(page);
  await addReading(page, 0);
  await addReading(page, 15);
  await addReading(page, 20, 'Otro libro', 1);
  await page.getByLabel('Matrícula del historial').selectOption({ label: attendanceNames[0] });
  await page
    .getByRole('button', { name: 'Editar lectura Libro sintético del 2026-10-19', exact: true })
    .first()
    .click();
  await expect(page.getByLabel('Alumno / matrícula', { exact: true })).toBeDisabled();
  await page.getByLabel('Título o texto leído', { exact: true }).fill('Libro corregido');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar lectura', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await verifyReading(page);
}
