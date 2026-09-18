import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { WaveCalipers } from './WaveCalipers';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('the figure offers one canvas describing both graphs', () => {
  const { container } = render(<WaveCalipers />);
  const canvas = container.querySelector('canvas');
  expect(canvas).not.toBeNull();
  expect(canvas?.getAttribute('aria-label')).toContain('snapshot');
});

test('it shows the true wave speed so the measurement can be checked against it', () => {
  const { container } = render(<WaveCalipers />);
  expect(container.textContent).toContain('4.00');
});

test('the default marker positions give a deliberately wrong speed', () => {
  const { container } = render(<WaveCalipers />);
  expect(container.textContent).toContain('0.70');
  expect(container.textContent).toContain('0.20');
  expect(container.textContent).toContain('3.50');
});

test('the play button changes label when pressed', () => {
  const { getByText } = render(<WaveCalipers />);
  const button = getByText('Play');
  fireEvent.click(button);
  expect(button.textContent).toBe('Pause');
});
