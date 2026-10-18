import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '../theme/theme-state';
import { themeHead, themeHeadScript } from './theme-head';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => vi.restoreAllMocks());

const run = () => new Function(themeHeadScript)();

test('the plugin injects one classic inline script at the very start of <head>', () => {
  const hook = themeHead().transformIndexHtml as { order?: string; handler: () => unknown };
  const tags = hook.handler() as { tag: string; attrs?: Record<string, unknown>; children: string; injectTo: string }[];
  expect(tags).toHaveLength(1);
  expect(tags[0].tag).toBe('script');
  expect(tags[0].injectTo).toBe('head-prepend');
  expect(tags[0].attrs?.type).toBeUndefined(); // classic script: blocking, runs before first paint
  expect(tags[0].attrs?.defer).toBeUndefined();
  expect(tags[0].attrs?.async).toBeUndefined();
  expect(tags[0].children).toBe(themeHeadScript);
});

test('the script uses the same storage key and attribute as the state module', () => {
  expect(themeHeadScript).toContain(`'${THEME_STORAGE_KEY}'`);
  expect(themeHeadScript).toContain(`'${THEME_ATTRIBUTE}'`);
});

test('stored light or dark is applied; auto, junk and empty storage leave the page alone', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  run();
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  document.documentElement.removeAttribute('data-theme');
  localStorage.setItem(THEME_STORAGE_KEY, 'light');
  run();
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  document.documentElement.removeAttribute('data-theme');
  for (const value of ['auto', 'purple', '']) {
    localStorage.setItem(THEME_STORAGE_KEY, value);
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  }
  localStorage.clear();
  run();
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

test('blocked storage does not throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(run).not.toThrow();
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

test('vite.config.ts registers the plugin', () => {
  const config = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
  expect(config).toMatch(/themeHead\(\)/);
});
