import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { StringElement, tangentEnds } from './StringElement';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('for a trough both tension arrows point above the element ends', () => {
  const { left, right } = tangentEnds({ x: 80, y: 120 }, { x: 160, y: 190 }, { x: 240, y: 120 }, 60);
  expect(left.y).toBeLessThan(120);
  expect(right.y).toBeLessThan(120);
  expect(left.x).toBeLessThan(80);
  expect(right.x).toBeGreaterThan(240);
});

test('for a crest both tension arrows point below the element ends', () => {
  const { left, right } = tangentEnds({ x: 80, y: 120 }, { x: 160, y: 50 }, { x: 240, y: 120 }, 60);
  expect(left.y).toBeGreaterThan(120);
  expect(right.y).toBeGreaterThan(120);
});

test('switching from trough to crest flips the stated direction of the net force', () => {
  const { container, getByText } = render(<StringElement />);
  expect(container.textContent).toContain('upwards');
  fireEvent.click(getByText('Crest'));
  expect(container.textContent).toContain('downwards');
});
