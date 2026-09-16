import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@mdx-js/rollup';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mdxOptions } from './framework/build/mdx-options';
import { outputName } from './scripts/lessons';

const here = dirname(fileURLToPath(import.meta.url));
const lesson = process.env.LESSON ?? 'subjects/math/00-wave-math-foundations';

export default defineConfig({
  root: resolve(here, lesson),
  plugins: [{ enforce: 'pre', ...mdx(mdxOptions) }, preact(), viteSingleFile()],
  build: {
    outDir: resolve(here, 'dist/.tmp', outputName(lesson).replace(/\.html$/, '')),
    emptyOutDir: true,
  },
});
