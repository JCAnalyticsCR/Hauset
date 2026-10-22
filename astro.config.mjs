import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = {
  ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), ''),
  ...process.env,
};
const base = `/${(env.PUBLIC_BASE_PATH || '').replace(/^\/+|\/+$/g, '')}`;

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'https://hausetcr.com',
  base,
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory' },
  server: { host: true },
  vite: { build: { sourcemap: false } },
});
