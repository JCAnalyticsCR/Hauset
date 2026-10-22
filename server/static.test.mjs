import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from './index.mjs';

async function fixture(t, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'hauset-static-test-'));
  const files = {
    'index.html': '<h1>HAUSET</h1>',
    '404.html': '<h1>Página no encontrada</h1>',
    'style.css': 'body{color:white}',
    'privacidad/index.html': '<h1>Privacidad</h1>',
    '_astro/main.hash.js': 'console.log("hauset")',
    'demo.mp4': Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    'empty.mp4': Buffer.alloc(0),
  };
  await mkdir(join(directory, 'privacidad'));
  await mkdir(join(directory, '_astro'));
  for (const [name, contents] of Object.entries(files))
    await writeFile(join(directory, name), contents);
  const app = createAppServer({ env, distDir: directory });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => {
      app.close(resolve);
      app.closeAllConnections();
    });
    for (const name of Object.keys(files)) await unlink(join(directory, name));
    await rmdir(join(directory, 'privacidad'));
    await rmdir(join(directory, '_astro'));
    await rmdir(directory);
  });
  return `http://127.0.0.1:${app.address().port}`;
}

test('HTML, MIME, HEAD y cabeceras de seguridad', async (t) => {
  const origin = await fixture(t);
  const home = await fetch(`${origin}/`);
  assert.equal(home.status, 200);
  assert.equal(await home.text(), '<h1>HAUSET</h1>');
  assert.match(home.headers.get('Content-Type'), /text\/html/);
  assert.equal(home.headers.get('Cache-Control'), 'no-cache');
  assert.equal(home.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(home.headers.get('X-Frame-Options'), 'DENY');
  const css = await fetch(`${origin}/style.css`, { method: 'HEAD' });
  assert.equal(css.status, 200);
  assert.match(css.headers.get('Content-Type'), /text\/css/);
  assert.equal(
    Number(css.headers.get('Content-Length')),
    'body{color:white}'.length,
  );
  assert.equal(await css.text(), '');
  const hashed = await fetch(`${origin}/_astro/main.hash.js`);
  assert.equal(
    hashed.headers.get('Cache-Control'),
    'public, max-age=31536000, immutable',
  );
});

test('subruta de Pages y directorios tienen redirecciones correctas', async (t) => {
  const origin = await fixture(t, { PUBLIC_BASE_PATH: '/hausetcr/' });
  for (const path of ['/', '/hausetcr']) {
    const redirect = await fetch(`${origin}${path}`, { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('Location'), '/hausetcr/');
  }
  assert.equal((await fetch(`${origin}/hausetcr/`)).status, 200);
  assert.equal((await fetch(`${origin}/hausetcr/style.css`)).status, 200);
  assert.equal((await fetch(`${origin}/style.css`)).status, 404);
  const privacy = await fetch(`${origin}/hausetcr/privacidad`, {
    redirect: 'manual',
  });
  assert.equal(privacy.headers.get('Location'), '/hausetcr/privacidad/');
  assert.equal((await fetch(`${origin}/hausetcr/privacidad/`)).status, 200);
});

test('bloquea traversal, archivos internos y rutas inválidas', async (t) => {
  const origin = await fixture(t);
  for (const path of [
    '/..%5cpackage.json',
    '/%2e%2e%2fpackage.json',
    '/.env',
    '/.git/config',
    '/%00',
  ]) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`${origin}/%zz`)).status, 400);
});

test('404 usa la página estática y HEAD conserva el estado sin cuerpo', async (t) => {
  const origin = await fixture(t);
  const missing = await fetch(`${origin}/inexistente`);
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), '<h1>Página no encontrada</h1>');
  const head = await fetch(`${origin}/inexistente`, { method: 'HEAD' });
  assert.equal(head.status, 404);
  assert.equal(await head.text(), '');
});

test('solo existe health: no hay API de contacto ni métodos de escritura', async (t) => {
  const origin = await fixture(t);
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal((await fetch(`${origin}/api/desconocido`)).status, 404);
  assert.equal(
    (await fetch(`${origin}/api/contact`, { method: 'POST', body: '{}' }))
      .status,
    404,
  );
  const write = await fetch(`${origin}/`, { method: 'POST', body: 'texto' });
  assert.equal(write.status, 405);
  assert.equal(write.headers.get('Allow'), 'GET, HEAD');
});

test('video: rangos cerrados, abiertos y sufijos devuelven solo los bytes pedidos', async (t) => {
  const origin = await fixture(t);
  const cases = [
    ['bytes=2-5', 'bytes 2-5/10', [2, 3, 4, 5]],
    ['bytes=7-', 'bytes 7-9/10', [7, 8, 9]],
    ['bytes=-3', 'bytes 7-9/10', [7, 8, 9]],
    ['bytes=8-99', 'bytes 8-9/10', [8, 9]],
    ['bytes=-99', 'bytes 0-9/10', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    ['bytes=0-0', 'bytes 0-0/10', [0]],
  ];
  for (const [range, contentRange, expected] of cases) {
    const response = await fetch(`${origin}/demo.mp4`, {
      headers: { Range: range },
    });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('Content-Type'), 'video/mp4');
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(response.headers.get('Content-Range'), contentRange);
    assert.equal(
      Number(response.headers.get('Content-Length')),
      expected.length,
    );
    assert.deepEqual(
      [...new Uint8Array(await response.arrayBuffer())],
      expected,
    );
  }
});

test('video: rangos imposibles devuelven 416 con tamaño total y sin cuerpo', async (t) => {
  const origin = await fixture(t);
  for (const range of [
    'bytes=10-',
    'bytes=6-3',
    'bytes=-0',
    'bytes=999999999999999999999999999-',
  ]) {
    const response = await fetch(`${origin}/demo.mp4`, {
      headers: { Range: range },
    });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), 'bytes */10');
    assert.equal(response.headers.get('Content-Length'), '0');
    assert.equal(await response.text(), '');
  }
  const empty = await fetch(`${origin}/empty.mp4`, {
    headers: { Range: 'bytes=0-' },
  });
  assert.equal(empty.status, 416);
  assert.equal(empty.headers.get('Content-Range'), 'bytes */0');
});

test('video: ignora rangos malformados o múltiples; HEAD informa el archivo completo', async (t) => {
  const origin = await fixture(t);
  for (const range of ['bytes=0-1,3-4', 'bytes=abc', 'items=0-1', 'bytes=-']) {
    const response = await fetch(`${origin}/demo.mp4`, {
      headers: { Range: range },
    });
    assert.equal(response.status, 200, range);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal((await response.arrayBuffer()).byteLength, 10);
  }
  const head = await fetch(`${origin}/demo.mp4`, {
    method: 'HEAD',
    headers: { Range: 'bytes=0-3' },
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(head.headers.get('Content-Length'), '10');
  assert.equal(head.headers.get('Content-Range'), null);
  assert.equal(await head.text(), '');
  const conditional = await fetch(`${origin}/demo.mp4`, {
    headers: { Range: 'bytes=0-3', 'If-Range': '"old-version"' },
  });
  assert.equal(conditional.status, 200);
  assert.equal((await conditional.arrayBuffer()).byteLength, 10);
});
