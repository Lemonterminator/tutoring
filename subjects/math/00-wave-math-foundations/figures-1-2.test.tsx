import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { ComplexRotator } from './ComplexRotator';
import { EulerCircle } from './EulerCircle';

afterEach(cleanup);

test('ComplexRotator starts at z = 1.5 + 0.5i and offers both rotations', () => {
  const { container } = render(<ComplexRotator />);
  expect(container.textContent).toContain('|z| = 1.58');
  expect(container.textContent).toContain('angle = 18°');
  expect(screen.getByRole('button', { name: '× i' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '× (−1)' })).toBeTruthy();
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Complex plane');
});

test('EulerCircle period follows the ω slider', () => {
  const { container } = render(<EulerCircle />);
  expect(container.textContent).toContain('T = 2π/ω = 4.19 s');
  fireEvent.input(screen.getByRole('slider'), { target: { value: '2' } });
  expect(container.textContent).toContain('T = 2π/ω = 3.14 s');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
});
