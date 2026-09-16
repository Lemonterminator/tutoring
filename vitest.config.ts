import mdx from '@mdx-js/rollup';
import { defineConfig } from 'vitest/config';
import { mdxOptions } from './framework/build/mdx-options';

export default defineConfig({
  plugins: [{ enforce: 'pre', ...mdx(mdxOptions) }],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    environment: 'jsdom',
    setupFiles: ['framework/test-setup.ts'],
    include: ['framework/**/*.test.{ts,tsx}', 'subjects/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
