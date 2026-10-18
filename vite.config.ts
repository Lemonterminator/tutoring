import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@mdx-js/rollup';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mdxOptions } from './framework/build/mdx-options';
import { themeHead } from './framework/build/theme-head';
import { outputName } from './scripts/lessons';

const here = dirname(fileURLToPath(import.meta.url));
const lesson = process.env.LESSON?.trim() || null;
const buildEntry = lesson ? outputName(lesson).replace(/\.html$/, '') : 'index';

/** Single-file pages inline every font KaTeX's stylesheet lists. Keep only the woff2
 * sources (every current browser reads them); the woff and ttf copies add about 1 MB per page. */
const katexWoff2Only: Plugin = {
  name: 'katex-woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]katex[\\/]dist[\\/]katex(?:\.min)?\.css/u.test(id)) return null;
    return code.replace(/,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/gu, '');
  },
};

export default defineConfig({
  base: './',
  root: lesson ? resolve(here, lesson) : here,
  publicDir: resolve(here, 'public'),
  plugins: [katexWoff2Only, themeHead(), { enforce: 'pre', ...mdx(mdxOptions) }, preact(), viteSingleFile()],
  build: {
    outDir: resolve(here, 'dist/.tmp', buildEntry),
    emptyOutDir: true,
    copyPublicDir: !lesson,
  },
});
