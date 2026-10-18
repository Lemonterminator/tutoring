import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const KEY = 'tutoring:theme';
const load = () => import('./theme-state');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0)); // MutationObserver callbacks are microtask-queued

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('defaults to Auto: no attribute, nothing stored', async () => {
  const state = await load();
  expect(state.themeChoice.value).toBe('auto');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(localStorage.getItem(KEY)).toBeNull();
});

test('setTheme sets data-theme, stores the choice, and Auto clears both', async () => {
  const state = await load();
  state.setTheme('dark');
  expect(state.themeChoice.value).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(localStorage.getItem(KEY)).toBe('dark');
  state.setTheme('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(localStorage.getItem(KEY)).toBe('light');
  state.setTheme('auto');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(localStorage.getItem(KEY)).toBeNull();
});

test('a stored choice is restored and applied on load; junk values mean Auto', async () => {
  localStorage.setItem(KEY, 'dark');
  let state = await load();
  expect(state.themeChoice.value).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  vi.resetModules();
  document.documentElement.removeAttribute('data-theme');
  localStorage.setItem(KEY, 'purple');
  state = await load();
  expect(state.themeChoice.value).toBe('auto');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

test('blocked storage still switches the theme and never throws', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  const state = await load();
  expect(state.themeChoice.value).toBe('auto');
  expect(() => state.setTheme('dark')).not.toThrow();
  expect(state.themeChoice.value).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(() => state.setTheme('auto')).not.toThrow();
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

test('with blocked storage a theme the head script already applied is kept', async () => {
  document.documentElement.setAttribute('data-theme', 'light');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const state = await load();
  expect(state.themeChoice.value).toBe('light');
});

test('resolvedTheme resolves Auto against the OS and an explicit choice over it', async () => {
  const state = await load();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark'), addEventListener() {}, removeEventListener() {} }));
  expect(state.resolvedTheme()).toBe('dark');
  state.setTheme('light');
  expect(state.resolvedTheme()).toBe('light');
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  state.setTheme('auto');
  expect(state.resolvedTheme()).toBe('light');
});

test('onThemeChange fires for attribute changes and OS scheme changes, and can be unsubscribed', async () => {
  let osListener: (() => void) | null = null;
  const removed = vi.fn();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: (_: string, listener: () => void) => { osListener = listener; },
    removeEventListener: removed,
  }));
  const state = await load();
  const listener = vi.fn();
  const stop = state.onThemeChange(listener);

  state.setTheme('dark');
  await tick();
  expect(listener).toHaveBeenCalledTimes(1);

  osListener!();
  expect(listener).toHaveBeenCalledTimes(2);

  stop();
  expect(removed).toHaveBeenCalled();
  state.setTheme('light');
  await tick();
  expect(listener).toHaveBeenCalledTimes(2);
});

test('a change made in another tab (storage event) is picked up', async () => {
  const state = await load();
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'dark' }));
  expect(state.themeChoice.value).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: null }));
  expect(state.themeChoice.value).toBe('auto');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});
