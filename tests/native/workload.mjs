import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';
import ExcelJS from 'exceljs';

export async function verifyWorkload(session, workload, output, stage) {
  const { page } = session;
  const { size } = workload;
  const started = performance.now();
  await page
    .getByLabel('Ciclo de trabajo', { exact: true })
    .selectOption({ label: `CN013 sintético ${size}` });
  await page
    .getByLabel('Grupo de trabajo', { exact: true })
    .selectOption({ label: `3.º CN013-${size}` });
  const open = (label) =>
    page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
  await open('Alumnos');
  await expect(page.getByRole('button', { name: /^Ver ficha de / })).toHaveCount(size);
  const listMs = Math.round(performance.now() - started);
  await page.getByLabel('Buscar en este grupo').fill('Sintético 001');
  await expect(page.getByRole('button', { name: /^Ver ficha de / })).toHaveCount(1);
  await open('Asistencia');
  await page.getByLabel('Fecha de asistencia', { exact: true }).fill('2026-09-01');
  await expect(page.getByRole('combobox', { name: /^Estado de / })).toHaveCount(size);
  await expect(page.getByText('Día registrado', { exact: true })).toBeVisible();
  const attendance = page.getByRole('combobox', { name: /^Estado de / }).first();
  if (stage === 'before-restart') {
    await attendance.selectOption('absent');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
    await expect(page.getByText('Día registrado', { exact: true })).toBeVisible();
  }
  await expect(attendance).toHaveValue('absent');
  await open('Tareas');
  await expect(page.getByRole('button', { name: /^Ver entregas de / })).toHaveCount(10);
  await page.getByRole('button', { name: 'Ver entregas de =1+1', exact: true }).click();
  const deliveries = page.getByRole('region', { name: 'Entregas de la tarea', exact: true });
  await expect(deliveries.getByRole('combobox', { name: /^Estado de / })).toHaveCount(size);
  const submission = deliveries.getByRole('combobox', { name: /^Estado de / }).first();
  if (stage === 'before-restart') {
    await submission.selectOption('submitted');
    page.once('dialog', (dialog) => dialog.accept());
    await deliveries.getByRole('button', { name: /^Guardar entregas/ }).click();
    await expect(
      deliveries.getByRole('button', { name: /^Guardar entregas \(0 cambios/ }),
    ).toBeDisabled();
  }
  await expect(submission).toHaveValue('submitted');
  await page.screenshot({ path: path.join(output, `workload-${size}-${stage}.png`) });
  assert.deepEqual(session.requests, []);
  return { size, listAndContextMs: listMs, flowMs: Math.round(performance.now() - started) };
}

export async function verifyWorkbooks(session, workloads, output) {
  const results = [];
  for (const workload of workloads) {
    const bytes = await session.evaluate(
      `ClassNoteProbe.workloadWorkbook(${JSON.stringify(workload)})`,
    );
    const filename = path.join(output, `workload-${workload.size}.xlsx`);
    await writeFile(filename, new Uint8Array(bytes));
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(filename);
    assert.deepEqual(
      book.worksheets.map((sheet) => sheet.name),
      ['Alumnos', 'Asistencia', 'Tareas', 'Lecturas'],
    );
    for (const [name, rows] of [
      ['Alumnos', workload.size],
      ['Asistencia', workload.size * workload.days],
      ['Tareas', workload.size * 10],
      ['Lecturas', 1],
    ])
      assert.equal(book.getWorksheet(name).rowCount, rows + 1, name);
    for (const sheet of book.worksheets)
      sheet.eachRow((row) =>
        row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)),
      );
    const strings = book.worksheets
      .flatMap((sheet) => sheet.getSheetValues().flat(2))
      .filter((value) => typeof value === 'string');
    for (const dangerous of ["'=1+1", "'+SUM(1,1)", "'@SUM(1,1)", "'-1+1"])
      assert.ok(
        strings.some((value) => value.startsWith(dangerous)),
        dangerous,
      );
    results.push({
      filename,
      size: workload.size,
      dangerousStringsNeutralized: true,
      fourSheets: true,
    });
  }
  return results;
}
