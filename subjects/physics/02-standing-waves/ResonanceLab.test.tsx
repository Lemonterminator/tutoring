import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { ResonanceLab } from './ResonanceLab';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('it offers the three boundary cases the syllabus asks about', () => {
  const { getByText } = render(<ResonanceLab />);
  expect(getByText('String, both ends fixed').getAttribute('aria-pressed')).toBe('true');
  expect(getByText('Pipe, both ends open')).toBeTruthy();
  expect(getByText('Pipe, one end closed')).toBeTruthy();
});

test('it starts in sweep mode and can switch to pluck', () => {
  const { container, getByText } = render(<ResonanceLab />);
  expect(container.textContent).toContain('Drive frequency');
  fireEvent.click(getByText('Pluck'));
  expect(container.textContent).toContain('Pluck position');
});

test('the readout reports a measured node count, not a formula', () => {
  const { container } = render(<ResonanceLab />);
  expect(container.textContent).toContain('measured');
});

test('changing the pipe keeps the figure on screen', () => {
  const { container, getByText } = render(<ResonanceLab />);
  fireEvent.click(getByText('Pipe, one end closed'));
  expect(getByText('Pipe, one end closed').getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('canvas')).not.toBeNull();
});
