import { expect, test } from 'vitest';
import { abs, arg, c, fmt, fromPolar, I, mul } from './complex';

test('i times i is minus one', () => {
  expect(mul(I, I)).toEqual(c(-1, 0));
});

test('multiplying by i turns an arrow 90° counterclockwise and keeps its length', () => {
  const z = c(2, 1);
  const turned = mul(z, I);
  expect(turned).toEqual(c(-1, 2));
  expect(abs(turned)).toBeCloseTo(abs(z), 12);
  expect(arg(turned) - arg(z)).toBeCloseTo(Math.PI / 2, 12);
});

test('fromPolar', () => {
  const z = fromPolar(2, Math.PI / 2);
  expect(z.re).toBeCloseTo(0, 12);
  expect(z.im).toBeCloseTo(2, 12);
});

test.each([
  [c(0, 1), 'i'],
  [c(0, -1), '−i'],
  [c(-1, 0), '−1'],
  [c(3, -2), '3 − 2i'],
  [c(1.5, 0.5), '1.5 + 0.5i'],
  [c(1e-17, 1), 'i'],
])('fmt(%j) = %s', (z, expected) => {
  expect(fmt(z)).toBe(expected);
});
