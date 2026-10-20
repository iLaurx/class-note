import { expect, type Page } from '@playwright/test';
import { openStudents } from './student-flow.ts';

export const attendanceNames = [
  'Pérez de prueba, Ána editada',
  'Prueba B, Bruno ficticio',
  'Prueba C, Carla ficticia',
  'Prueba D, Diego ficticio',
];
export async function openAttendance(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Asistencia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Asistencia diaria' })).toBeVisible();
}
export async function prepareAttendanceStudents(page: Page) {
  await openStudents(page);
  for (const [firstName, lastName] of [
    ['Bruno ficticio', 'Prueba B'],
    ['Carla ficticia', 'Prueba C'],
    ['Diego ficticio', 'Prueba D'],
  ]) {
    await page.getByRole('button', { name: 'Agregar alumno', exact: true }).click();
    await page.getByLabel('Nombre o nombres').fill(firstName!);
    await page.getByLabel('Apellido o apellidos').fill(lastName!);
    await page.getByLabel('Fecha de ingreso').fill('2026-08-01');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByRole('form')).toHaveCount(0);
  }
}
export function statusField(page: Page, index: number) {
  return page.getByLabel(`Estado de ${attendanceNames[index]}`, { exact: true });
}
export function noteField(page: Page, index: number) {
  return page.getByLabel(`Nota de ${attendanceNames[index]} (opcional)`, { exact: true });
}
export async function recordAttendance(page: Page) {
  await openAttendance(page);
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  await expect(statusField(page, 0)).toHaveValue('');
  await expect(
    page.getByText('Matrícula inactiva · Sin salida registrada', { exact: true }),
  ).toBeVisible();
  await statusField(page, 0).selectOption('absent');
  await noteField(page, 0).fill('Nota histórica sintética');
  await statusField(page, 1).selectOption('late');
  await noteField(page, 2).fill('Nota pendiente sintética');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Marcar todos presentes', exact: true }).click();
  await expect(statusField(page, 0)).toHaveValue('absent');
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(
    page.getByText('Asistencia guardada. 2 sin registrar.', { exact: true }),
  ).toBeVisible();
  await expect(noteField(page, 2)).toHaveValue('Nota pendiente sintética');
  await statusField(page, 2).selectOption('excused');
  await statusField(page, 3).selectOption('present');
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(page.getByText('Día registrado', { exact: true })).toBeVisible();
  await statusField(page, 0).selectOption('present');
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('1 registros');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(
    page.getByText('Cambios sin guardar · Recuentos en vista previa', { exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(page.getByText('Día registrado', { exact: true })).toBeVisible();
  await verifyAttendance(page);
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-20');
  await expect(page.getByText('Día sin captura', { exact: true })).toBeVisible();
  await expect(statusField(page, 0)).toHaveValue('');
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' });
  await expect(page.getByText('Sin matrículas para la fecha', { exact: true })).toBeVisible();
  await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  await verifyAttendance(page);
}
export async function verifyAttendance(page: Page) {
  await openAttendance(page);
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-10-19');
  for (const [index, status] of ['present', 'late', 'excused', 'present'].entries())
    await expect(statusField(page, index)).toHaveValue(status);
  await expect(noteField(page, 0)).toHaveValue('Nota histórica sintética');
  await expect(noteField(page, 2)).toHaveValue('Nota pendiente sintética');
  const counts = page.getByRole('definition');
  await expect(counts).toHaveText(['2', '0', '1', '1', '0', '4']);
  await expect(page.getByText('Día registrado', { exact: true })).toBeVisible();
}
