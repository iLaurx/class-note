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
        await expect(page.getByText('EN PREPARACIÓN', { exact: true })).toBeVisible();
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

test('recursos locales, navegación offline y sin almacenamiento', async ({ page, context }) => {
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
  await expect(page.getByRole('heading', { name: '¡Qué gusto tenerte aquí!' })).toBeVisible();
  await context.setOffline(true);
  for (const [label] of sections) {
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
  }
  expect(externalRequests).toEqual([]);
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: (await indexedDB.databases()).length,
  }));
  expect(storage).toEqual({ local: 0, session: 0, databases: 0 });
});
