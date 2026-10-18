import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import { setTheme, themeChoice } from './theme-state';

beforeEach(() => setTheme('auto'));
afterEach(() => {
  cleanup();
  setTheme('auto');
});

test('shows Auto / Light / Dark with Auto pressed by default', () => {
  render(<ThemeToggle />);
  expect(screen.getByRole('group', { name: 'Theme' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Auto' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false');
});

test('clicking Dark, Light, then Auto sets, changes and removes data-theme on <html>', () => {
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Auto' }).getAttribute('aria-pressed')).toBe('false');
  expect(localStorage.getItem('tutoring:theme')).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: 'Light' }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(themeChoice.value).toBe('auto');
});

test('buttons are native, keyboard-reachable buttons', () => {
  render(<ThemeToggle />);
  for (const button of screen.getAllByRole('button')) {
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('tabindex')).not.toBe('-1');
  }
});

test('labels follow the page language: Chinese and Finnish', () => {
  const { rerender } = render(<ThemeToggle lang="zh" />);
  expect(screen.getByRole('group', { name: '主题' })).toBeTruthy();
  for (const name of ['自动', '浅色', '深色']) expect(screen.getByRole('button', { name })).toBeTruthy();
  rerender(<ThemeToggle lang="fi" />);
  expect(screen.getByRole('group', { name: 'Teema' })).toBeTruthy();
  for (const name of ['Auto', 'Vaalea', 'Tumma']) expect(screen.getByRole('button', { name })).toBeTruthy();
});

test('an external theme change updates the pressed button', () => {
  render(<ThemeToggle />);
  act(() => setTheme('dark'));
  expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
});
