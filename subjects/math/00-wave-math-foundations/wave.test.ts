import { expect, test } from 'vitest';
import { d2ydt2, d2ydx2, dydt, dydx, y } from './wave';

const p = { A: 1.3, k: 1.7, omega: 2.2 };

test.each([
  [0.3, 0.1],
  [2, 1.5],
  [5.5, 4],
])('analytic derivatives match finite differences at x=%s, t=%s', (x, t) => {
  const h = 1e-5;
  const h2 = 1e-4;
  expect(dydt(p, x, t)).toBeCloseTo((y(p, x, t + h) - y(p, x, t - h)) / (2 * h), 5);
  expect(dydx(p, x, t)).toBeCloseTo((y(p, x + h, t) - y(p, x - h, t)) / (2 * h), 5);
  expect(d2ydx2(p, x, t)).toBeCloseTo((y(p, x + h2, t) - 2 * y(p, x, t) + y(p, x - h2, t)) / (h2 * h2), 3);
});

test('the sine wave satisfies the wave equation with v = ω/k', () => {
  const v = p.omega / p.k;
  expect(d2ydt2(p, 0.8, 0.4)).toBeCloseTo(v * v * d2ydx2(p, 0.8, 0.4), 10);
});
