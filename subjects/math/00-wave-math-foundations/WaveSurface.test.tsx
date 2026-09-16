import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { WaveSurface } from './WaveSurface';

afterEach(cleanup);

test('readouts at the start: probe at x = 2 m sits on a zero crossing', () => {
  const { container } = render(<WaveSurface />);
  const text = container.textContent ?? '';
  expect(text).toContain('y = 0.00');
  expect(text).toContain('∂y/∂t = 2.09');
  expect(text).toContain('∂y/∂x = −1.57');
  expect(text).toContain('∂²y/∂x² = 0.00');
});

test('freezing time pauses the animation and highlights the slope readout', () => {
  const { container } = render(<WaveSurface />);
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /freeze time/ }));
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  expect(container.querySelector('.readout--active')?.textContent).toBe('∂y/∂x = −1.57');
});

test('moving the probe updates the readouts', () => {
  const { container } = render(<WaveSurface />);
  fireEvent.input(screen.getByRole('slider'), { target: { value: '1' } });
  expect(container.textContent).toContain('y = 1.00');
});
