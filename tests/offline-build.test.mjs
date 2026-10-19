import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

test('el HTML distribuido solo carga recursos locales empaquetados', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)];
  assert.ok(resources.length >= 2, 'Deben existir los recursos compilados JS y CSS');
  for (const [, resource] of resources) {
    assert.match(resource, /^\/assets\/[\w.-]+$/);
    await readFile(new URL(`../dist${resource}`, import.meta.url));
  }
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  const css = await Promise.all(
    assets
      .filter((name) => name.endsWith('.css'))
      .map((name) => readFile(new URL(`../dist/assets/${name}`, import.meta.url), 'utf8')),
  );
  assert.ok(css.length > 0);
  assert.doesNotMatch(css.join('\n'), /@import|url\(\s*["']?(?:https?:)?\/\//i);
});

test('la aplicación distribuida bloquea red y no concede permisos nativos', async () => {
  const config = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  );
  assert.match(config.app.security.csp, /connect-src 'none'(?:;|$)/);
  assert.doesNotMatch(config.app.security.csp, /https?:|unsafe-eval|unsafe-inline/);
  assert.deepEqual(config.app.security.capabilities, []);
  assert.equal(config.bundle.windows.webviewInstallMode.type, 'skip');
});
