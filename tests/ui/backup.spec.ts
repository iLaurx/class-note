import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { createYearsAndGroups } from '../helpers/school-flow';

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('classnote');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const result: Record<string, unknown[]> = {};
      for (const name of db.objectStoreNames)
        result[name] = await new Promise<unknown[]>((resolve, reject) => {
          const request = db.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      return result;
    } finally {
      db.close();
    }
  });
}
async function prepare(page: Page) {
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
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Configuración', exact: true })
    .click();
  await page.evaluate(() => {
    const check = { source: '', previous: '', mode: 'ok', saves: 0 };
    Object.assign(window, {
      backupCheck: check,
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: { source: string; previous: boolean }) => {
          if (command === 'open_backup')
            return check.mode === 'open-cancel'
              ? null
              : check.mode === 'corrupt'
                ? '{'
                : check.source;
          if (command !== 'save_backup') throw new Error('Comando inesperado');
          check.saves++;
          if (check.mode === 'error') throw new Error('Disco lleno');
          if (check.mode === 'cancel') return false;
          if (args.previous) check.previous = args.source;
          else check.source = args.source;
          return true;
        },
      },
    });
  });
}
async function mode(page: Page, value: string) {
  await page.evaluate((value) => {
    (window as unknown as { backupCheck: { mode: string } }).backupCheck.mode = value;
  }, value);
}
const exportButton = (page: Page) =>
  page.getByRole('button', { name: 'Guardar respaldo completo', exact: true });
const openButton = (page: Page) =>
  page.getByRole('button', { name: 'Elegir respaldo para restaurar' });
const restoreButton = (page: Page) =>
  page.getByRole('button', { name: 'Guardar respaldo previo y restaurar' });

for (const width of [1100, 768, 360])
  test(`CN012 previsualización, teclado y restauración offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page);
    await context.setOffline(true);
    await exportButton(page).click();
    await expect(page.getByText('Respaldo completo guardado.', { exact: true })).toBeVisible();
    const before = await snapshot(page);
    await openButton(page).click();
    await expect(page.getByRole('region', { name: 'Previsualización del respaldo' })).toBeVisible();
    await expect(page.getByText('Ciclos escolares: 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Grupos: 4', { exact: true })).toBeVisible();
    await expect(page.getByText('Observaciones privadas: 0', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Cancelar restauración', exact: true }),
    ).toBeFocused();
    await expect(restoreButton(page)).toBeDisabled();
    await page.getByLabel('Confirmo reemplazar').check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/backup-preview-${width}.png`, fullPage: true });
    await restoreButton(page).click();
    await expect(
      page.getByText('Restauración completada. Contexto y vistas recargados.', { exact: true }),
    ).toBeVisible();
    expect(await snapshot(page)).toEqual(before);
  });

test('CN012 cancelaciones y errores no escriben ni informan éxito', async ({ page }) => {
  await prepare(page);
  const before = await snapshot(page);
  await mode(page, 'cancel');
  await exportButton(page).click();
  await expect(page.getByText('Guardado cancelado.', { exact: true })).toBeVisible();
  await mode(page, 'open-cancel');
  await openButton(page).click();
  await expect(page.getByText('Selección cancelada.', { exact: true })).toBeVisible();
  await mode(page, 'corrupt');
  await openButton(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await mode(page, 'ok');
  await exportButton(page).click();
  await openButton(page).click();
  await page.getByRole('button', { name: 'Cancelar restauración', exact: true }).click();
  await expect(page.getByText('Restauración cancelada.', { exact: true })).toBeVisible();
  await openButton(page).click();
  await page.getByLabel('Confirmo reemplazar').check();
  await mode(page, 'cancel');
  await restoreButton(page).click();
  await expect(
    page.getByText('Restauración cancelada. La base se conserva.', { exact: true }),
  ).toBeVisible();
  await mode(page, 'ok');
  await openButton(page).click();
  await page.getByLabel('Confirmo reemplazar').check();
  await mode(page, 'error');
  await restoreButton(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Previsualización del respaldo' })).toBeVisible();
  await expect(page.getByText(/Restauración completada/)).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
});

test('CN012 lectura posterior fallida solo reintenta contexto y bloquea doble envío', async ({
  page,
}) => {
  await prepare(page);
  await exportButton(page).click();
  await openButton(page).click();
  await page.getByLabel('Confirmo reemplazar').check();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      if (this.name === 'appSettings' && key === 'work.schoolYearId')
        throw new Error('Lectura sintética');
      return original.call(this, key);
    };
    Object.assign(window, {
      restoreGet: () => {
        IDBObjectStore.prototype.get = original;
      },
    });
  });
  await restoreButton(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText(/Los datos fueron restaurados/)).toBeVisible();
  await expect(openButton(page)).toBeDisabled();
  await page.evaluate(() => (window as unknown as { restoreGet: () => void }).restoreGet());
  await page.getByRole('button', { name: 'Reintentar lectura del contexto' }).click();
  await expect(
    page.getByText('Restauración completada. Contexto y vistas recargados.'),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { backupCheck: { saves: number } }).backupCheck.saves,
    ),
  ).toBe(2);
});
