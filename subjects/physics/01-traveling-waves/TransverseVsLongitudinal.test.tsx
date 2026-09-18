import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { TransverseVsLongitudinal } from './TransverseVsLongitudinal';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('it starts in transverse mode', () => {
  const { getByText } = render(<TransverseVsLongitudinal />);
  expect(getByText('Transverse').getAttribute('aria-pressed')).toBe('true');
  expect(getByText('Longitudinal').getAttribute('aria-pressed')).toBe('false');
});

test('switching to longitudinal presses the other button', () => {
  const { getByText } = render(<TransverseVsLongitudinal />);
  fireEvent.click(getByText('Longitudinal'));
  expect(getByText('Longitudinal').getAttribute('aria-pressed')).toBe('true');
});

test('the pressure curve is named in the legend only in longitudinal mode', () => {
  const { container, getByText } = render(<TransverseVsLongitudinal />);
  expect(container.textContent).not.toContain('pressure p');
  fireEvent.click(getByText('Longitudinal'));
  expect(container.textContent).toContain('pressure p');
});
