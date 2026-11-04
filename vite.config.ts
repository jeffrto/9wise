import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vitest/config';

// GitHub Pages can't send headers, so the CSP goes in a meta tag. Build only: dev needs HMR.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' https: data:",
  'connect-src https://readwise.io https://openlibrary.org',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const csp: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

export default defineConfig({
  base: './',
  plugins: [svelte(), csp],
  // Component tests need Svelte's browser runtime.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
