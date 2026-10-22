import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function within(root, target) {
  const path = relative(root, target);
  return !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
}

// A single byte range is enough for native video seeking. Unsupported or
// malformed range sets are ignored; valid ranges outside the file return 416.
function byteRange(value, size) {
  if (typeof value !== 'string' || value.length > 256) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!size) return { unsatisfiable: true };
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!suffix) return { unsatisfiable: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || start >= size || end < start)
      return { unsatisfiable: true };
  }
  return { start, end };
}

/** Optional Railway host: static files only, with no contact or email API. */
export function createAppServer({
  env = process.env,
  distDir = resolve(projectRoot, 'dist'),
} = {}) {
  const root = resolve(distDir);
  const base =
    `/${(env.PUBLIC_BASE_PATH || '').replace(/^\/+|\/+$/g, '')}`.replace(
      /\/$/,
      '',
    );

  function redirect(response, location) {
    response.writeHead(308, { Location: location });
    response.end();
  }

  async function notFound(request, response) {
    try {
      const filename = resolve(root, '404.html');
      const info = await stat(filename);
      if (!info.isFile() || !within(root, await realpath(filename)))
        throw new Error();
      response.writeHead(404, {
        'Content-Type': mimeTypes['.html'],
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(filename)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch {
      json(response, 404, { ok: false, error: 'No encontrado.' });
    }
  }

  async function staticFile(request, response, pathname) {
    if (!['GET', 'HEAD'].includes(request.method))
      return json(
        response,
        405,
        { ok: false, error: 'Método no permitido.' },
        { Allow: 'GET, HEAD' },
      );
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return json(response, 400, { ok: false, error: 'Ruta inválida.' });
    }
    if (
      decoded.includes('\0') ||
      decoded.includes('\\') ||
      decoded.split('/').some((part) => part.startsWith('.'))
    )
      return notFound(request, response);
    if (base && (decoded === '/' || decoded === base))
      return redirect(response, `${base}/`);
    if (base && !decoded.startsWith(`${base}/`))
      return notFound(request, response);
    const route = base ? decoded.slice(base.length) : decoded;
    let filename = resolve(root, `.${route || '/'}`);
    if (!within(root, filename)) return notFound(request, response);
    let info;
    try {
      info = await stat(filename);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) return redirect(response, `${pathname}/`);
        filename = resolve(filename, 'index.html');
        info = await stat(filename);
      }
      if (!info.isFile() || !within(root, await realpath(filename)))
        throw new Error();
    } catch {
      return notFound(request, response);
    }
    const headers = {
      'Content-Type':
        mimeTypes[extname(filename).toLowerCase()] ||
        'application/octet-stream',
      'Content-Length': info.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': filename.includes(`${sep}_astro${sep}`)
        ? 'public, max-age=31536000, immutable'
        : extname(filename) === '.html'
          ? 'no-cache'
          : 'public, max-age=3600',
    };
    // RFC 9110 defines Range for GET only. Without strong validators, an
    // If-Range condition cannot match and must fall back to the full file.
    const range =
      request.method === 'GET' && !request.headers['if-range']
        ? byteRange(request.headers.range, info.size)
        : null;
    if (range?.unsatisfiable) {
      response.writeHead(416, {
        ...headers,
        'Content-Length': 0,
        'Content-Range': `bytes */${info.size}`,
      });
      return response.end();
    }
    if (range) {
      headers['Content-Length'] = range.end - range.start + 1;
      headers['Content-Range'] =
        `bytes ${range.start}-${range.end}/${info.size}`;
    }
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') return response.end();
    const stream = createReadStream(
      filename,
      range ? { start: range.start, end: range.end } : undefined,
    );
    // Seeking can cancel an in-flight response; release its file handle then.
    response.once('close', () => stream.destroy());
    stream.on('error', () => response.destroy()).pipe(response);
  }

  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      if (
        pathname === '/api/health' &&
        ['GET', 'HEAD'].includes(request.method)
      )
        return json(response, 200, { ok: true });
      if (pathname.startsWith('/api/'))
        return json(response, 404, { ok: false, error: 'No encontrado.' });
      await staticFile(request, response, pathname);
    } catch {
      if (!response.headersSent)
        json(response, 500, {
          ok: false,
          error: 'No pudimos cargar esta página.',
        });
      else response.destroy();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3000);
  const server = createAppServer();
  server.listen(port, '0.0.0.0', () =>
    console.log(`HAUSET listo en el puerto ${port}`),
  );
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
