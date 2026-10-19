import { expect, test } from '@playwright/test';
import { createYearsAndGroups, verifyArchiveFlow, verifySelection } from '../helpers/school-flow';
for (const width of [1100, 768, 360]) {
  test(`CN004 gestión offline y persistencia a ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/#/configuracion');
    await expect(
      page.getByText('Primero crea un ciclo escolar y después agrega sus grupos.'),
    ).toBeVisible();
    await context.setOffline(true);
    await createYearsAndGroups(page);
    await verifySelection(page);
    await page
      .getByRole('button', { name: 'Ver grupos de Ciclo de prueba dos', exact: true })
      .click();
    await expect(page.getByText('Matutino de prueba', { exact: true })).toHaveCount(0);
    await verifySelection(page);
    await page
      .getByLabel('Ciclo de trabajo', { exact: true })
      .selectOption({ label: 'Ciclo de prueba dos' });
    await expect(page.getByLabel('Grupo de trabajo', { exact: true })).toHaveValue('');
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º B' });
    await page
      .getByLabel('Ciclo de trabajo', { exact: true })
      .selectOption({ label: 'Ciclo de prueba uno' });
    await expect(page.getByLabel('Grupo de trabajo', { exact: true })).toHaveValue('');
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
    await expect(page.getByRole('region', { name: 'Contexto de trabajo' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    // Restore access only to the local preview assets for browser reload.
    await context.setOffline(false);
    await page.reload();
    await verifySelection(page);
    await context.setOffline(true);
    await verifyArchiveFlow(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/school-management-${width}.png`, fullPage: true });
  });
}
test('CN004 error de escritura conserva formulario y permite corregir duplicado', async ({
  page,
}) => {
  await page.goto('/#/configuracion');
  await createYearsAndGroups(page);
  await page.getByRole('button', { name: 'Editar grupo B', exact: true }).click();
  await page.getByLabel('Nombre del grupo', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ya existe');
  await expect(page.getByLabel('Nombre del grupo', { exact: true })).toHaveValue('A');
  await page.getByLabel('Nombre del grupo', { exact: true }).fill('C');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar grupo C', exact: true })).toBeVisible();
});

test('CN004 cambios rápidos mantienen contexto coherente y cancelar no escribe', async ({
  page,
}) => {
  await page.goto('/#/configuracion');
  await createYearsAndGroups(page);
  const before = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const request = indexedDB.open('classnote');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['schoolYears', 'groups', 'appSettings'], 'readonly');
        const rows: unknown[] = [];
        for (const name of ['schoolYears', 'groups', 'appSettings']) {
          const query = tx.objectStore(name).getAll();
          query.onsuccess = () => rows.push(query.result);
        }
        tx.oncomplete = () => {
          db.close();
          resolve(JSON.stringify(rows));
        };
      };
    });
  });
  await page.getByRole('button', { name: 'Archivar grupo A', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar archivo' }).click();
  const after = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const request = indexedDB.open('classnote');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['schoolYears', 'groups', 'appSettings'], 'readonly');
        const rows: unknown[] = [];
        for (const name of ['schoolYears', 'groups', 'appSettings']) {
          const query = tx.objectStore(name).getAll();
          query.onsuccess = () => rows.push(query.result);
        }
        tx.oncomplete = () => {
          db.close();
          resolve(JSON.stringify(rows));
        };
      };
    });
  });
  expect(after).toBe(before);
  // Administration changes synchronously, without launching competing reads.
  await page.evaluate(() => {
    for (let index = 0; index < 10; index++) {
      const text =
        index % 2 === 0 ? 'Ver grupos de Ciclo de prueba uno' : 'Ver grupos de Ciclo de prueba dos';
      const button = Array.from(document.querySelectorAll('button')).find(
        (node) => node.textContent === text,
      );
      button?.click();
    }
  });
  await expect(
    page.getByRole('region', { name: 'Grupos de Ciclo de prueba dos', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Matutino de prueba', { exact: true })).toHaveCount(0);
  await verifySelection(page);
  const cycle = page.getByLabel('Ciclo de trabajo', { exact: true });
  for (const label of ['Ciclo de prueba dos', 'Ciclo de prueba uno', 'Ciclo de prueba dos']) {
    await cycle.selectOption({ label });
    await expect(page.getByLabel('Grupo de trabajo', { exact: true })).toHaveValue('');
  }
  await expect(cycle.locator('option:checked')).toHaveText('Ciclo de prueba dos');
});

test('CN004 error al leer contexto ofrece reintento sin borrar registros', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.get;
    let fail = true;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      if (this.name === 'appSettings' && fail) {
        fail = false;
        throw new DOMException('Fallo de lectura sintético', 'UnknownError');
      }
      return original.apply(this, args);
    };
  });
  await page.goto('/#/configuracion');
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar el contexto.');
  await page.getByRole('button', { name: 'Reintentar contexto' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByText('Primero crea un ciclo escolar y después agrega sus grupos.'),
  ).toBeVisible();
});
