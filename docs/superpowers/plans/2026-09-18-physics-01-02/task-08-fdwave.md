### Task 8: The finite-difference wave solver

This is the core of lesson 2. Everything the student sees about harmonics comes out of
this module; nothing is drawn from a formula.

The equation is `u_tt + 2γ u_t = c² u_xx`, solved by leapfrog and normalised to `c = 1`
and `L = 1`, so `Δt = Δx = 1/n` and the Courant number is exactly **1**. At `C = 1` the
undamped update collapses to `u_i^{n+1} = u_{i+1}^n + u_{i−1}^n − u_i^{n−1}`, which is
dispersion-free: the discrete mode frequencies equal the exact ones. Step 1 tests exactly
that, because if it were not true the simulation and the textbook formula would disagree
and the whole lesson would collapse.

**Do not change the discretisation.** In particular the open end uses the second-order
ghost point `u₋₁ = u₁`, which makes the boundary update `(2·cur[1] − …)`. Writing
`spare[0] = spare[1]` instead is first-order accurate and shifts the resonant frequencies
by percent — the student would see the formula fail.

**Files:**
- Create: `subjects/physics/02-standing-waves/fdwave.ts`
- Test: `subjects/physics/02-standing-waves/fdwave.test.ts`
- Create: `subjects/physics/02-standing-waves/index.html`
- Create: `subjects/physics/02-standing-waves/main.tsx`
- Create: `subjects/physics/02-standing-waves/meta.json`
- Create: `subjects/physics/02-standing-waves/terms.json` (placeholder, replaced in task 12)
- Create: `subjects/physics/02-standing-waves/lesson.en.mdx` (placeholder, replaced in task 12)
- Create: `subjects/physics/02-standing-waves/lesson.fi.mdx` (placeholder, replaced in task 13)

**Interfaces:**
- Consumes: nothing. This module has no imports.
- Produces, all from `subjects/physics/02-standing-waves/fdwave.ts`:
  - `type Boundary = 'closed' | 'open'`
  - `type Ends = { left: Boundary; right: Boundary }`
  - `type Drive = { index: number; amplitude: number; angularFrequency: number }` — a
    dipole source: it pushes `index` and pulls `index + 1`, so it injects no net momentum
  - `type Field = { intervals: number; points: number; dx: number; time: number; prev: Float64Array; cur: Float64Array; spare: Float64Array; envelope: Float64Array }`
  - `createField(intervals: number): Field`
  - `reset(f: Field): void`
  - `pluck(f: Field, position: number, height: number): void`
  - `step(f: Field, ends: Ends, damping: number, drive: Drive | null): void`
  - `advance(f: Field, steps: number, ends: Ends, damping: number, drive?: Drive | null, envelopeDecay?: number): void`
  - `trackEnvelope(f: Field, decay: number): void`
  - `peak(values: Float64Array): number`
  - `sampleAt(f: Field, position: number): number`

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/02-standing-waves/fdwave.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/02-standing-waves/fdwave.test.ts`
Expected: FAIL, resolving `./fdwave` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/02-standing-waves/fdwave.ts`:

```ts
/**
 * One-dimensional damped wave equation u_tt + 2γ u_t = c² u_xx, by leapfrog.
 *
 * Everything is normalised to c = 1 and L = 1, so Δt = Δx = 1/intervals and the Courant
 * number is exactly 1. At C = 1 the undamped update collapses to
 *     u_i^{n+1} = u_{i+1}^n + u_{i−1}^n − u_i^{n−1}
 * which is dispersion-free: the frequencies of the grid modes equal the exact ones. That
 * is what lets the simulation agree with λ_n = 2L/n and λ_n = 4L/(2n−1) to the digits the
 * lesson prints. Do not change the discretisation.
 */
export type Boundary = 'closed' | 'open';
export type Ends = { left: Boundary; right: Boundary };
export type Drive = { index: number; amplitude: number; angularFrequency: number };

export type Field = {
  intervals: number;
  points: number;
  /** Space step; also the time step, because c = 1 and the Courant number is 1. */
  dx: number;
  time: number;
  prev: Float64Array;
  cur: Float64Array;
  spare: Float64Array;
  envelope: Float64Array;
};

export function createField(intervals: number): Field {
  const points = intervals + 1;
  return {
    intervals,
    points,
    dx: 1 / intervals,
    time: 0,
    prev: new Float64Array(points),
    cur: new Float64Array(points),
    spare: new Float64Array(points),
    envelope: new Float64Array(points),
  };
}

export function reset(f: Field): void {
  f.prev.fill(0);
  f.cur.fill(0);
  f.spare.fill(0);
  f.envelope.fill(0);
  f.time = 0;
}

/** Triangular initial displacement, released from rest. */
export function pluck(f: Field, position: number, height: number): void {
  reset(f);
  const last = f.points - 1;
  const top = Math.min(last - 1, Math.max(1, Math.round(position * last)));
  for (let i = 0; i <= last; i++) {
    f.cur[i] = i <= top ? (height * i) / top : (height * (last - i)) / (last - top);
  }
  f.prev.set(f.cur);
}

export function step(f: Field, ends: Ends, damping: number, drive: Drive | null): void {
  const { cur, prev, spare } = f;
  const last = f.points - 1;
  const gammaDt = damping * f.dx;
  const divide = 1 + gammaDt;
  const keep = 1 - gammaDt;

  for (let i = 1; i < last; i++) {
    spare[i] = (cur[i + 1] + cur[i - 1] - keep * prev[i]) / divide;
  }

  // Closed end: the medium is held still. Open end: ∂u/∂x = 0, imposed with the
  // second-order ghost point u₋₁ = u₁, which turns cur[i+1] + cur[i−1] into 2·cur[1].
  spare[0] = ends.left === 'closed' ? 0 : (2 * cur[1] - keep * prev[0]) / divide;
  spare[last] = ends.right === 'closed' ? 0 : (2 * cur[last - 1] - keep * prev[last]) / divide;

  // The driver pushes one point and pulls its neighbour, so it injects no net momentum.
  // This matters: with both ends open there is nothing holding the column in place, and a
  // one-sided push leaves a permanent rigid displacement that fills in every node. A real
  // sound source works this way too — it squeezes the medium rather than shoving all of it.
  if (drive) {
    const push = drive.amplitude * Math.sin(drive.angularFrequency * f.time);
    spare[drive.index] += push;
    spare[Math.min(last, drive.index + 1)] -= push;
  }

  f.prev = cur;
  f.cur = spare;
  f.spare = prev;
  f.time += f.dx;
}

/** Peak-hold with a leak, so the envelope follows a slowly changing standing pattern. */
export function trackEnvelope(f: Field, decay: number): void {
  const { cur, envelope } = f;
  for (let i = 0; i < f.points; i++) {
    const level = Math.abs(cur[i]);
    envelope[i] = level > envelope[i] ? level : envelope[i] * decay;
  }
}

export function advance(
  f: Field,
  steps: number,
  ends: Ends,
  damping: number,
  drive: Drive | null = null,
  envelopeDecay = 0,
): void {
  for (let s = 0; s < steps; s++) {
    step(f, ends, damping, drive);
    if (envelopeDecay > 0) trackEnvelope(f, envelopeDecay);
  }
}

export function peak(values: Float64Array): number {
  let top = 0;
  for (let i = 0; i < values.length; i++) {
    const size = Math.abs(values[i]);
    if (size > top) top = size;
  }
  return top;
}

/** Value at a fraction of the way along, snapped to the nearest grid point. */
export function sampleAt(f: Field, position: number): number {
  const last = f.points - 1;
  const index = Math.min(last, Math.max(0, Math.round(position * last)));
  return f.cur[index];
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/02-standing-waves/fdwave.test.ts`
Expected: PASS (7 tests)

If the third test fails, the discretisation is wrong — most likely the open-end line. Do
not loosen the tolerance to make it pass; that test is the reason the lesson works.

- [ ] **Step 5: Create the lesson 2 entry files**

`subjects/physics/02-standing-waves/index.html`: identical to
`subjects/physics/01-traveling-waves/index.html` except the title line, which reads
`    <title>Physics 2</title>`.

`subjects/physics/02-standing-waves/main.tsx`: identical to
`subjects/physics/01-traveling-waves/main.tsx`, byte for byte.

`subjects/physics/02-standing-waves/meta.json`:

```json
{
  "id": "physics-02-standing-waves",
  "subject": "physics",
  "title": {
    "en": "Lesson 2: Standing waves, boundaries and harmonics",
    "fi": "Oppitunti 2: Seisovat aallot, reunaehdot ja harmoniset"
  }
}
```

`subjects/physics/02-standing-waves/terms.json`:

```json
{}
```

`subjects/physics/02-standing-waves/lesson.en.mdx`:

```mdx
## 1. Placeholder

The lesson body is written in task 12.
```

`subjects/physics/02-standing-waves/lesson.fi.mdx`:

```mdx
## 1. Paikanvaraus

Oppitunnin sisältö kirjoitetaan tehtävässä 12.
```

- [ ] **Step 6: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **30 test files, 111 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

Run: `npm run check`
Expected: three `✔` lines (math 00, physics 01, physics 02).

- [ ] **Step 7: Commit**

```bash
git add subjects/physics/02-standing-waves/fdwave.ts subjects/physics/02-standing-waves/fdwave.test.ts subjects/physics/02-standing-waves/index.html subjects/physics/02-standing-waves/main.tsx subjects/physics/02-standing-waves/meta.json subjects/physics/02-standing-waves/terms.json subjects/physics/02-standing-waves/lesson.en.mdx subjects/physics/02-standing-waves/lesson.fi.mdx
git commit -m "feat: dispersion-free finite-difference wave solver"
```
