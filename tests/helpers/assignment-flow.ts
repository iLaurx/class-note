import { expect, type Page } from '@playwright/test';
import { attendanceNames, statusField } from './attendance-flow.ts';
export { statusField };
export const taskTitle = 'Actividad sintética editada';
export function commentField(page: Page, index: number) {
  return page.getByLabel(`Comentario de ${attendanceNames[index]} (opcional)`, { exact: true });
}
export function saveDeliveries(page: Page) {
  return page.getByRole('button', { name: /^Guardar entregas/ });
}
export async function openAssignments(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tareas del grupo' })).toBeVisible();
}
export async function createTask(page: Page, title: string) {
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await expect(page.getByLabel('Título', { exact: true })).toBeFocused();
  await page.getByLabel('Título', { exact: true }).fill(title);
  await page.getByLabel('Descripción (opcional)', { exact: true }).fill('Descripción ficticia');
  await page.getByLabel('Fecha de asignación', { exact: true }).fill('2026-10-19');
  await page.getByLabel('Fecha de entrega (opcional)', { exact: true }).fill('2026-10-21');
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByText('La tarea se guardó.', { exact: true })).toBeVisible();
}
export async function prepareAssignments(page: Page) {
  await openAssignments(page);
  await expect(page.getByText('Este grupo aún no tiene tareas.', { exact: true })).toBeVisible();
  await createTask(page, 'Actividad sintética');
  await page.getByRole('button', { name: 'Editar tarea Actividad sintética', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill(taskTitle);
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await createTask(page, 'Otra tarea sintética');
  await page.getByLabel('Buscar tareas por título').fill('inexistente');
  await expect(page.getByText('Sin coincidencias de tareas.', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar tareas por título').fill('EDITADA');
  await expect(
    page.getByRole('button', { name: 'Ver entregas de Otra tarea sintética', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Asignación desde').fill('2026-10-20');
  await expect(page.getByText('Sin coincidencias de tareas.', { exact: true })).toBeVisible();
  await page.getByLabel('Asignación desde').fill('2026-10-19');
  await page.getByLabel('Asignación hasta').fill('2026-10-19');
  await page.getByRole('button', { name: `Ver entregas de ${taskTitle}`, exact: true }).click();
  await expect(statusField(page, 0)).toHaveValue('pending');
  await expect(page.getByText('Aún no tiene registro guardado', { exact: true })).toHaveCount(4);
  await expect(saveDeliveries(page)).toBeDisabled();
  await page.getByLabel('Buscar tareas por título').fill('');
}
export async function recordSubmissions(page: Page) {
  await prepareAssignments(page);
  for (const [index, status] of [
    'incomplete',
    'pending',
    'incomplete',
    'not_submitted',
  ].entries()) {
    await statusField(page, index).selectOption(status);
    await commentField(page, index).fill(`Comentario sintético ${index}`);
  }
  await page.getByLabel('Filtrar entregas por estado').selectOption('not_submitted');
  await expect(saveDeliveries(page)).toHaveText('Guardar entregas (4 cambios en toda la tarea)');
  await saveDeliveries(page).click();
  await expect(page.getByText('Entregas guardadas: 4.', { exact: true })).toBeVisible();
  await page.getByLabel('Filtrar entregas por estado').selectOption('');
  await statusField(page, 0).selectOption('submitted');
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('1 entregas');
    await dialog.dismiss();
  });
  await saveDeliveries(page).click();
  await expect(saveDeliveries(page)).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await saveDeliveries(page).click();
  await expect(saveDeliveries(page)).toBeDisabled();
  await verifySubmissions(page);
  await page.getByLabel('Buscar tareas por título').fill('');
  await page
    .getByRole('button', { name: 'Ver entregas de Otra tarea sintética', exact: true })
    .click();
  await expect(page.getByText('Aún no tiene registro guardado', { exact: true })).toHaveCount(4);
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' });
  await expect(page.getByText('Este grupo aún no tiene tareas.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Entregas de la tarea' })).toHaveCount(0);
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
  await verifySubmissions(page);
}
export async function verifySubmissions(page: Page) {
  await openAssignments(page);
  await page.getByRole('button', { name: `Ver entregas de ${taskTitle}`, exact: true }).click();
  for (const [index, status] of ['submitted', 'pending', 'incomplete', 'not_submitted'].entries()) {
    await expect(statusField(page, index)).toHaveValue(status);
    await expect(commentField(page, index)).toHaveValue(`Comentario sintético ${index}`);
  }
  await expect(page.getByRole('definition')).toHaveText(['1', '1', '1', '1', '0', '4']);
  await expect(saveDeliveries(page)).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Entregas de la tarea' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
}
