import { expect, test } from 'vitest';
import { fixed, sci } from './format';

test.each([
  [1e-6, '1.0 × 10⁻⁶'],
  [3.2e-12, '3.2 × 10⁻¹²'],
  [1, '1.0 × 10⁰'],
  [9.96e-7, '1.0 × 10⁻⁶'],
  [250, '2.5 × 10²'],
])('sci(%s) = %s', (x, expected) => {
  expect(sci(x)).toBe(expected);
});

test('fixed uses a typographic minus and never shows negative zero', () => {
  expect(fixed(-1.5708)).toBe('−1.57');
  expect(fixed(-3e-16)).toBe('0.00');
  expect(fixed(18.43, 0)).toBe('18');
});
