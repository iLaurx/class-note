import { expect, test, type Page } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';
import path from 'node:path';

async function prepare(page: Page) {
  // Serve packaged chunks from disk when Playwright cuts even localhost networking.
  await page.route('http://127.0.0.1:1421/assets/**', (route) =>
    route.fulfill({
      path: path.join(
        process.cwd(),
        'dist/assets',
        path.basename(new URL(route.request().url()).pathname),
      ),
    }),
  );
  await page.goto('/');
  await createYearsAndGroups(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Reportes', exact: true }).click();
}
async function mockSave(page: Page, mode: 'save' | 'cancel' | 'error' | 'slow') {
  await page.evaluate((mode) => {
    const state = { calls: 0, bytes: [] as number[] };
    Object.assign(window, {
      reportCheck: state,
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: { bytes: number[] }) => {
          if (command !== 'save_group_report') throw new Error('Comando inesperado');
          state.calls++;
          state.bytes = args.bytes;
          if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 1000));
          if (mode === 'error') throw new Error('No se pudo guardar el reporte. Reintenta.');
          return mode !== 'cancel';
        },
      },
    });
  }, mode);
}

for (const width of [1100, 768, 360]) {
  test(`CN011 filtros, teclado, vacío y exportación offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1:1421/')) external.push(r.url());
    });
    await prepare(page);
    await context.setOffline(true);
    await mockSave(page, 'save');
    await expect(page.getByText(/no un respaldo restaurable/)).toBeVisible();
    await page.getByLabel('Desde', { exact: true }).fill('2026-10-20');
    await page.getByLabel('Hasta', { exact: true }).fill('2026-10-19');
    await page.getByRole('button', { name: 'Exportar Excel' }).click();
    await expect(page.getByRole('alert')).toContainText('posterior');
    await page.getByLabel('Hasta', { exact: true }).fill('2026-10-20');
    const button = page.getByRole('button', { name: 'Exportar Excel' });
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('status').filter({ hasText: 'Reporte Excel guardado.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        const state = (window as unknown as { reportCheck: { bytes: number[]; calls: number } })
          .reportCheck;
        return { calls: state.calls, signature: state.bytes.slice(0, 2) };
      }),
    ).toEqual({ calls: 1, signature: [80, 75] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/reports-${width}.png`, fullPage: true });
    expect(external).toEqual([]);
  });
}
test('CN011 cancelación, error nativo, error de lectura, reintento y doble envío', async ({
  page,
}) => {
  await prepare(page);
  await mockSave(page, 'cancel');
  await page.getByRole('button', { name: 'Exportar Excel' }).click();
  await expect(
    page.getByText('Exportación cancelada. No se escribió ningún archivo.'),
  ).toBeVisible();
  await expect(page.getByText('Reporte Excel guardado.')).toHaveCount(0);
  await mockSave(page, 'error');
  await page.getByRole('button', { name: 'Exportar Excel' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo guardar');
  await expect(page.getByText('Reporte Excel guardado.')).toHaveCount(0);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readonly') {
        IDBDatabase.prototype.transaction = original;
        throw new Error('Fallo sintético');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Exportar Excel' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Reporte Excel guardado.')).toHaveCount(0);
  await mockSave(page, 'slow');
  await page.getByRole('button', { name: 'Exportar Excel' }).dblclick({ force: true });
  await expect(page.getByText('Reporte Excel guardado.')).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { reportCheck: { calls: number } }).reportCheck.calls,
    ),
  ).toBe(1);
});
