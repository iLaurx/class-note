import { expect, test } from '@playwright/test';

const sections = [
  ['Inicio', '#/inicio'],
  ['Alumnos', '#/alumnos'],
  ['Asistencia', '#/asistencia'],
  ['Tareas', '#/tareas'],
  ['Lectura en casa', '#/lectura'],
  ['Observaciones', '#/observaciones'],
  ['Reportes', '#/reportes'],
  ['Configuración', '#/configuracion'],
] as const;

for (const width of [1100, 768, 360]) {
  test(`las ocho secciones son accesibles a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inicio');
    await expect(page.getByText('Todos los datos son ficticios.')).toBeVisible();
    for (const [label, hash] of sections) {
      const link = page.getByRole('navigation').getByRole('link', { name: label, exact: true });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
      if (label !== 'Inicio') {
        if (label === 'Configuración')
          await expect(
            page.getByRole('heading', { name: 'Ciclos escolares y grupos' }),
          ).toBeVisible();
        else if (label === 'Alumnos')
          await expect(page.getByRole('heading', { name: 'Alumnos del grupo' })).toBeVisible();
        else await expect(page.getByText('EN PREPARACIÓN', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test('accesos rápidos, historial, enlace directo y sección desconocida', async ({ page }) => {
  await page.goto('/');
  const shortcuts = page.getByRole('region', { name: '¿Por dónde empezamos?' });
  for (const label of ['Alumnos', 'Asistencia', 'Tareas', 'Lectura en casa']) {
    await shortcuts.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await page.getByRole('link', { name: 'Volver a Inicio' }).click();
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alumnos');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tareas');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tareas');
  await page.goto('/#/no-existe');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sección no encontrada');
  await page.getByRole('link', { name: 'Volver a Inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inicio');
});

test('navegación por teclado y salto al contenido', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inicio');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const link = page.getByRole('navigation').getByRole('link', { name: 'Lectura en casa' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lectura en casa');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('recursos locales, navegación offline y base vacía sin mocks', async ({ page, context }) => {
  const externalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:1421') {
      externalRequests.push(route.request().url());
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await page.goto('/');
  await expect(page.getByText('Almacenamiento local listo.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '¡Qué gusto tenerte aquí!' })).toBeVisible();
  await context.setOffline(true);
  for (const [label] of sections) {
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
  }
  expect(externalRequests).toEqual([]);
  const storage = await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    const counts = await new Promise<Record<string, number>>((resolve, reject) => {
      const request = indexedDB.open('classnote');
      request.onerror = () => reject(new Error('No se pudo abrir la base de prueba.'));
      request.onsuccess = () => {
        const db = request.result;
        const names = Array.from(db.objectStoreNames);
        const transaction = db.transaction(names, 'readonly');
        const result: Record<string, number> = {};
        for (const name of names) {
          const count = transaction.objectStore(name).count();
          count.onsuccess = () => {
            result[name] = count.result;
          };
        }
        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(new Error('No se pudo leer la base de prueba.'));
        };
      };
    });
    return {
      local: localStorage.length,
      session: sessionStorage.length,
      databases: databases.map((db) => db.name),
      counts,
    };
  });
  expect(storage.local).toBe(0);
  expect(storage.session).toBe(0);
  expect(storage.databases).toEqual(['classnote']);
  expect(Object.keys(storage.counts).sort()).toEqual(
    [
      'schoolYears',
      'groups',
      'students',
      'enrollments',
      'attendance',
      'assignments',
      'submissions',
      'readingLogs',
      'studentNotes',
      'appSettings',
    ].sort(),
  );
  expect(Object.values(storage.counts)).toEqual(Array(10).fill(0));
});

test('error accesible de apertura y reintento real sin borrar almacenamiento', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let fail = true;
    IDBFactory.prototype.open = function (...args: Parameters<IDBFactory['open']>) {
      if (fail) {
        fail = false;
        throw new DOMException('Fallo sintético privado', 'SecurityError');
      }
      return open.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No se pudo abrir el almacenamiento local.');
  await expect(page.getByText('Almacenamiento local listo.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).not.toContainText('Fallo sintético');
  const retry = page.getByRole('button', { name: 'Reintentar almacenamiento' });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Almacenamiento local listo.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
