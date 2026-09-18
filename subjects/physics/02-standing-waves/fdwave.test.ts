import { expect, test } from 'vitest';
import {
  advance,
  createField,
  peak,
  pluck,
  step,
  trackEnvelope,
  type Ends,
} from './fdwave';

const N = 240; // divisible by 1, 2, 3 and 5, which every period below needs

const STRING: Ends = { left: 'closed', right: 'closed' };
const OPEN: Ends = { left: 'open', right: 'open' };
const HALF_OPEN: Ends = { left: 'closed', right: 'open' };

test('the grid has one more point than intervals and a time step equal to its space step', () => {
  const field = createField(N);
  expect(field.points).toBe(N + 1);
  expect(field.dx).toBeCloseTo(1 / N, 12);
});

test('a closed end is pinned at zero and an open end is free to move', () => {
  const pinned = createField(60);
  pluck(pinned, 0.5, 1);
  advance(pinned, 200, STRING, 0);
  expect(pinned.cur[0]).toBe(0);
  expect(pinned.cur[pinned.points - 1]).toBe(0);

  // A free end does move. Watch it over a whole run rather than at one instant, because
  // any single instant could happen to catch it near zero.
  const free = createField(60);
  pluck(free, 0.3, 1);
  let largest = 0;
  for (let s = 0; s < 200; s++) {
    step(free, OPEN, 0, null);
    largest = Math.max(largest, Math.abs(free.cur[0]));
  }
  expect(largest).toBeGreaterThan(0.1);
});

test('every mode returns exactly to its starting shape after one period', () => {
  // With C = 1 the scheme is dispersion-free, so this is an equality, not an approximation.
  const cases: { ends: Ends; shape: (i: number, n: number) => number; k: (n: number) => number }[] = [
    { ends: STRING, shape: (i, n) => Math.sin((n * Math.PI * i) / N), k: (n) => n * Math.PI },
    { ends: OPEN, shape: (i, n) => Math.cos((n * Math.PI * i) / N), k: (n) => n * Math.PI },
    { ends: HALF_OPEN, shape: (i, n) => Math.sin(((2 * n - 1) * Math.PI * i) / (2 * N)), k: (n) => ((2 * n - 1) * Math.PI) / 2 },
  ];

  for (const { ends, shape, k } of cases) {
    for (const n of [1, 2, 3]) {
      const field = createField(N);
      const omega = k(n); // c = 1, so ω = k
      const start = Array.from({ length: field.points }, (_, i) => shape(i, n));
      for (let i = 0; i < field.points; i++) {
        field.cur[i] = start[i];
        field.prev[i] = start[i] * Math.cos(omega * field.dx); // u(x, −Δt)
      }
      const steps = Math.round((2 * Math.PI) / omega / field.dx);
      expect(Math.abs(steps - (2 * Math.PI) / omega / field.dx)).toBeLessThan(1e-9);
      advance(field, steps, ends, 0);
      let worst = 0;
      for (let i = 0; i < field.points; i++) worst = Math.max(worst, Math.abs(field.cur[i] - start[i]));
      expect(worst).toBeLessThan(1e-9);
    }
  }
});

test('damping makes a plucked string die away', () => {
  const field = createField(120);
  pluck(field, 0.3, 1);
  advance(field, 240, STRING, 0);
  const early = peak(field.cur);
  advance(field, 4800, STRING, 0.5);
  expect(peak(field.cur)).toBeLessThan(early * 0.5);
});

test('a pluck is a triangle released from rest', () => {
  const field = createField(100);
  pluck(field, 0.5, 2);
  expect(field.cur[50]).toBeCloseTo(2, 9);
  expect(field.cur[0]).toBeCloseTo(0, 9);
  expect(field.cur[100]).toBeCloseTo(0, 9);
  expect(field.cur[25]).toBeCloseTo(1, 9);
  for (let i = 0; i < field.points; i++) expect(field.prev[i]).toBe(field.cur[i]);
});

test('a soft driver pumps energy into a string that starts at rest', () => {
  const field = createField(120);
  expect(peak(field.cur)).toBe(0);
  advance(field, 3000, STRING, 0.05, { index: 37, amplitude: 0.002, angularFrequency: Math.PI });
  // Measured on a reference run: about 0.016. If yours is wildly different, say so in the log.
  expect(peak(field.cur)).toBeGreaterThan(0.01);
});

test('the envelope holds a peak and then leaks away', () => {
  const field = createField(10);
  field.cur.fill(0.8);
  trackEnvelope(field, 0.9);
  expect(field.envelope[5]).toBeCloseTo(0.8, 9);
  field.cur.fill(0);
  trackEnvelope(field, 0.9);
  expect(field.envelope[5]).toBeCloseTo(0.72, 9);
});
