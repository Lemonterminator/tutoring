import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { DecibelLadder } from './DecibelLadder';

afterEach(cleanup);

test('starts at conversation level and follows the intensity slider', () => {
  const { container } = render(<DecibelLadder />);
  expect(container.textContent).toContain('60.0 dB · conversation');
  expect(container.textContent).toContain('1.0 × 10⁻⁶ W/m²');

  fireEvent.input(screen.getAllByRole('slider')[0], { target: { value: '-9' } });
  expect(container.textContent).toContain('30.0 dB · whisper');
});

test('cascade multiplies factors and adds decibels', () => {
  const { container } = render(<DecibelLadder />);
  expect(container.textContent).toContain('= 6.31');
  expect(container.textContent).toContain('+10.0 +20.0 −14.0 = +16.0 dB');

  fireEvent.input(screen.getAllByRole('slider')[3], { target: { value: '0' } });
  expect(container.textContent).toContain('+10.0 +20.0 +0.0 = +30.0 dB');
});

test('sound toggle switches label without Web Audio support', () => {
  render(<DecibelLadder />);
  fireEvent.click(screen.getByRole('button', { name: /Sound on/ }));
  expect(screen.getByRole('button', { name: /Sound off/ })).toBeTruthy();
});
