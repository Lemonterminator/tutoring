### Task 8: Lesson math helpers

**Files:**
- Create: `subjects/math/00-wave-math-foundations/complex.ts`, `subjects/math/00-wave-math-foundations/wave.ts`
- Test: `subjects/math/00-wave-math-foundations/complex.test.ts`, `subjects/math/00-wave-math-foundations/wave.test.ts`

**Interfaces:**
- Produces (`complex.ts`): `type C = { re: number; im: number }`; `c(re, im): C`; `I: C`; `mul(a, b): C`; `abs(z): number`; `arg(z): number` (radians, atan2); `fromPolar(r, theta): C`; `fmt(z): string` (2 decimals, typographic minus, `i` / `−i` for unit imaginary parts).
- Produces (`wave.ts`): `type WaveParams = { A: number; k: number; omega: number }` for `y = A sin(kx − ωt)`; `y`, `dydt`, `dydx`, `d2ydx2`, `d2ydt2` — each `(p, x, t) => number`, analytic.

- [ ] **Step 1: Write the failing tests**

`subjects/math/00-wave-math-foundations/complex.test.ts`:

```ts
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
```

`subjects/math/00-wave-math-foundations/wave.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run subjects`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`subjects/math/00-wave-math-foundations/complex.ts`:

```ts
export type C = { re: number; im: number };

export const c = (re: number, im: number): C => ({ re, im });
export const I = c(0, 1);
export const mul = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const abs = (z: C) => Math.hypot(z.re, z.im);
export const arg = (z: C) => Math.atan2(z.im, z.re);
export const fromPolar = (r: number, theta: number): C => c(r * Math.cos(theta), r * Math.sin(theta));

const round2 = (v: number) => {
  const r = Number(v.toFixed(2));
  return r === 0 ? 0 : r;
};

export function fmt(z: C): string {
  const re = round2(z.re);
  const im = round2(z.im);
  const real = (v: number) => (v < 0 ? `−${-v}` : `${v}`);
  const imaginary = (v: number) => (Math.abs(v) === 1 ? 'i' : `${Math.abs(v)}i`);
  if (im === 0) return real(re);
  if (re === 0) return `${im < 0 ? '−' : ''}${imaginary(im)}`;
  return `${real(re)} ${im < 0 ? '−' : '+'} ${imaginary(im)}`;
}
```

`subjects/math/00-wave-math-foundations/wave.ts`:

```ts
/** y(x, t) = A sin(kx − ωt) */
export type WaveParams = { A: number; k: number; omega: number };

const phase = (p: WaveParams, x: number, t: number) => p.k * x - p.omega * t;

export const y = (p: WaveParams, x: number, t: number) => p.A * Math.sin(phase(p, x, t));
export const dydt = (p: WaveParams, x: number, t: number) => -p.A * p.omega * Math.cos(phase(p, x, t));
export const dydx = (p: WaveParams, x: number, t: number) => p.A * p.k * Math.cos(phase(p, x, t));
export const d2ydx2 = (p: WaveParams, x: number, t: number) => -p.A * p.k * p.k * Math.sin(phase(p, x, t));
export const d2ydt2 = (p: WaveParams, x: number, t: number) => -p.A * p.omega * p.omega * Math.sin(phase(p, x, t));
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run subjects`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add subjects/math/00-wave-math-foundations/complex.ts subjects/math/00-wave-math-foundations/complex.test.ts subjects/math/00-wave-math-foundations/wave.ts subjects/math/00-wave-math-foundations/wave.test.ts
git commit -m "feat: complex-number and wave helpers for module 0"
```
