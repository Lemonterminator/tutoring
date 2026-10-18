import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8').replace(/\r\n/g, '\n');
const MEDIA = '@media (prefers-color-scheme: dark)';

/** Declarations (as a sorted list) of the rule whose selector starts at `selectorStart`, searching from `from`. */
function declarations(selectorStart: string, from = 0): string[] {
  const start = css.indexOf(selectorStart, from);
  expect(start, `missing ${selectorStart}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close).split(';').map((d) => d.trim()).filter(Boolean).sort();
}

test('light tokens live on :root', () => {
  expect(css).toMatch(/:root,\s*\.concept-graph\[data-theme="light"\]\s*\{/);
  expect(declarations(':root,')).toContain('color-scheme: light');
});

test('dark tokens appear under the OS preference (unless forced light) and under data-theme="dark" with identical values', () => {
  const media = css.indexOf(MEDIA);
  expect(media).toBeGreaterThan(-1);
  const viaMedia = declarations(':root:not([data-theme="light"])', media);
  const viaAttribute = declarations(':root[data-theme="dark"]');
  expect(viaMedia.length).toBeGreaterThan(15);
  expect(viaAttribute).toEqual(viaMedia);
  expect(viaMedia).toContain('color-scheme: dark');
});

test('every dark token overrides a light token and the body background stays explicit', () => {
  const names = (list: string[]) => list.map((d) => d.split(':')[0]);
  const light = new Set(names(declarations(':root,')));
  for (const name of names(declarations(':root:not([data-theme="light"])', css.indexOf(MEDIA)))) {
    expect(light.has(name), name).toBe(true);
  }
  expect(css).toMatch(/\nbody \{[^}]*background: var\(--bg\)/);
});
