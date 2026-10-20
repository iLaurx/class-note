import { expect, test, type Page } from '@playwright/test';
import { createYearsAndGroups } from '../helpers/school-flow';

async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 19, 23, 30));
  await page.goto('/');
  await createYearsAndGroups(page);
  await page.evaluate(async () => {
    const request = indexedDB.open('classnote');
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(
      [
        'appSettings',
        'students',
        'enrollments',
        'attendance',
        'assignments',
        'submissions',
        'readingLogs',
      ],
      'readwrite',
    );
    const selected = tx.objectStore('appSettings').get('work.groupId');
    selected.onsuccess = () => {
      const groupId = selected.result.value as string;
      const audit = () => ({
        id: crypto.randomUUID(),
        createdAt: '2026-10-19T12:00:00.000Z',
        updatedAt: '2026-10-19T12:00:00.000Z',
      });
      const assignment = {
        ...audit(),
        groupId,
        title: 'Tarea del resumen sintético',
        assignedDate: '2026-10-15',
        dueDate: '2026-10-22',
      };
      tx.objectStore('assignments').add(assignment);
      for (let i = 0; i < 3; i++) {
        const student = {
          ...audit(),
          firstName: `Alumno sintético ${i}`,
          lastName: 'Prueba',
          active: true,
        };
        const enrollment = {
          ...audit(),
          studentId: student.id,
          groupId,
          joinedAt: i === 2 ? '2026-10-19' : '2026-08-01',
          status: 'active',
        };
        tx.objectStore('students').add(student);
        tx.objectStore('enrollments').add(enrollment);
        if (i < 2)
          tx.objectStore('attendance').add({
            ...audit(),
            enrollmentId: enrollment.id,
            date: '2026-10-19',
            status: i === 0 ? 'present' : 'excused',
          });
        if (i === 0)
          tx.objectStore('submissions').add({
            ...audit(),
            assignmentId: assignment.id,
            enrollmentId: enrollment.id,
            status: 'submitted',
          });
        tx.objectStore('readingLogs').add({
          ...audit(),
          enrollmentId: enrollment.id,
          date: '2026-10-19',
          title: 'Libro sintético',
          minutes: i * 5,
        });
      }
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}
async function home(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Resumen del grupo', exact: true })).toBeVisible();
}

for (const width of [1100, 768, 360]) {
  test(`CN010 resumen real offline sin escrituras, contexto y teclado a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const external: string[] = [],
      errors: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:1421/')) external.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await prepare(page);
    await context.setOffline(true);
    await page.evaluate(() => {
      const state = { writes: 0, loading: false };
      Object.assign(window, { dashboardCheck: state });
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (
        ...args: Parameters<IDBDatabase['transaction']>
      ) {
        if (args[1] === 'readwrite') state.writes++;
        return original.apply(this, args);
      };
      new MutationObserver(() => {
        if (document.body.textContent?.includes('Cargando resumen…')) state.loading = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await home(page);
    const summary = page.getByRole('region', { name: 'Resumen del grupo', exact: true });
    await expect(summary.getByRole('article', { name: 'Matrículas de hoy' })).toContainText('3');
    await expect(summary.getByRole('article', { name: 'Asistencia de hoy' })).toContainText(
      'Presente: 1',
    );
    await expect(summary.getByRole('article', { name: 'Asistencia de hoy' })).toContainText(
      'Falta justificada: 1',
    );
    await expect(summary.getByText('Sin registrar: 1', { exact: true })).toBeVisible();
    await expect(summary).toContainText('15 minutos · 3 registros');
    await expect(summary).toContainText('1 pendientes de 2 matrículas aplicables al 2026-10-15');
    await expect(summary).toContainText('Del 2026-10-19 al 2026-10-25');
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { dashboardCheck: { writes: number; loading: boolean } })
            .dashboardCheck,
      ),
    ).toEqual({ writes: 0, loading: true });
    for (const label of ['1.º B', '1.º A', '1.º B']) {
      await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label });
      await expect(page.getByRole('region', { name: 'Contexto de trabajo' })).toHaveAttribute(
        'aria-busy',
        'false',
      );
    }
    await expect(summary).toContainText('Sin matrículas aplicables hoy.');
    await expect(summary).toContainText('Sin lecturas registradas esta semana.');
    await expect(summary).not.toContainText('Tarea del resumen sintético');
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
    await expect(summary).toContainText('15 minutos · 3 registros');
    await page
      .getByLabel('Ciclo de trabajo', { exact: true })
      .selectOption({ label: 'Ciclo de prueba dos' });
    await expect(
      page.getByText('Selecciona un ciclo y un grupo para consultar el resumen.'),
    ).toBeVisible();
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
    await expect(summary).toContainText('Sin lecturas registradas esta semana.');
    await page
      .getByLabel('Ciclo de trabajo', { exact: true })
      .selectOption({ label: 'Ciclo de prueba uno' });
    await page.getByLabel('Grupo de trabajo', { exact: true }).selectOption({ label: '1.º A' });
    await expect(summary).toContainText('15 minutos · 3 registros');
    const shortcuts = page.getByRole('region', { name: '¿Por dónde empezamos?' });
    for (const label of ['Alumnos', 'Asistencia', 'Tareas', 'Lectura en casa']) {
      const link = shortcuts.getByRole('link', { name: label, exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
      await home(page);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('CN010 error recuperable por teclado, sin datos ficticios ni escrituras', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    let fail = true;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      if (this.name === 'groups' && this.transaction.mode === 'readonly' && fail) {
        fail = false;
        throw new DOMException('Fallo sintético', 'UnknownError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar el resumen.');
  await expect(page.getByRole('region', { name: 'Resumen del grupo', exact: true })).toHaveCount(0);
  const retry = page.getByRole('button', { name: 'Reintentar resumen' });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Resumen del grupo', exact: true })).toContainText(
    '15 minutos · 3 registros',
  );
});
