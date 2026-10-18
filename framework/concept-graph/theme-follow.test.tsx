import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { setTheme } from '../theme/theme-state';
import { ConceptGraph, ConceptGraphViewer } from './ConceptGraph';
import { fixture } from './fixtures';
import { layeredLayout } from './layout';

/** A 2D context stand-in: every method is a no-op and every property reads as a harmless value. */
function fakeContext(): unknown {
  const make = (): unknown => new Proxy(function noop() {}, {
    get: (_target, property) => (property === Symbol.toPrimitive ? () => 0 : property === 'width' ? 10 : make()),
    apply: () => make(),
    set: () => true,
  });
  return make();
}

const pageTextColor = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? '#e7e9ee' : '#1d2330');
let seenTextColors: string[] = [];

beforeEach(() => {
  seenTextColors = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => fakeContext()) as never);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  // jsdom does not load the stylesheet: emulate the page tokens so the canvas colour reader sees the page theme.
  vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
    getPropertyValue: (name: string) => {
      if (name !== '--text') return '';
      seenTextColors.push(pageTextColor());
      return pageTextColor();
    },
  }) as unknown as CSSStyleDeclaration);
});
afterEach(() => {
  cleanup();
  setTheme('auto');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('the canvas repaints with the new colours when the page theme changes', async () => {
  render(<ConceptGraphViewer graph={fixture} force={layeredLayout(fixture)} />);
  await waitFor(() => expect(seenTextColors.length).toBeGreaterThan(0));
  expect(new Set(seenTextColors)).toEqual(new Set(['#1d2330']));

  setTheme('dark');
  await waitFor(() => expect(seenTextColors).toContain('#e7e9ee'));

  seenTextColors = [];
  setTheme('light');
  await waitFor(() => expect(seenTextColors).toContain('#1d2330'));
});

test('the canvas repaints when the OS colour scheme changes (Auto)', async () => {
  let osListener: (() => void) | null = null;
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: (_: string, listener: () => void) => { osListener = listener; },
    removeEventListener: () => {},
  }));
  render(<ConceptGraphViewer graph={fixture} force={layeredLayout(fixture)} />);
  await waitFor(() => expect(seenTextColors.length).toBeGreaterThan(0));
  seenTextColors = [];
  expect(osListener).not.toBeNull();
  osListener!();
  await waitFor(() => expect(seenTextColors.length).toBeGreaterThan(0));
});

test('the graph selector defaults to following the page: no graph-level data-theme, so page tokens apply', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  localStorage.removeItem('tutoring:concept-graph:theme');
  render(<ConceptGraph />);
  await screen.findByRole('alert');
  const section = document.querySelector('.concept-graph') as HTMLElement;
  const select = screen.getByRole('combobox', { name: '图谱主题' }) as HTMLSelectElement;
  expect(select.value).toBe('system');
  expect(screen.getByRole('option', { name: '跟随页面' })).toBeTruthy();
  expect(section.hasAttribute('data-theme')).toBe(false);

  setTheme('dark'); // an explicit page theme reaches the graph through the shared tokens on <html>
  expect(section.hasAttribute('data-theme')).toBe(false);
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  fireEvent.change(select, { target: { value: 'light' } }); // a deliberate graph-only override
  expect(section.getAttribute('data-theme')).toBe('light');
  fireEvent.change(select, { target: { value: 'system' } });
  expect(section.hasAttribute('data-theme')).toBe(false);
  localStorage.removeItem('tutoring:concept-graph:theme');
});
