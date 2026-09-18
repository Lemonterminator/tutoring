### Task 9: Mode formulas, node counting from data, and the cross-check

Two kinds of thing live here, and the last test in this file is what makes the lesson
honest: it drives the **simulation** at each mode frequency, **measures** the node count
from the resulting envelope, and compares it with the textbook formula. Neither side is
allowed to know about the other.

**Files:**
- Create: `subjects/physics/02-standing-waves/modes.ts`
- Test: `subjects/physics/02-standing-waves/modes.test.ts`

**Interfaces:**
- Consumes: `type Ends` from `./fdwave` (task 8) — a type-only import. `modes.ts` must not
  import any value from `fdwave.ts`; the two are combined only in the test and in the figure.
- Produces, all from `subjects/physics/02-standing-waves/modes.ts`:
  - `type PipeKind = 'string' | 'open' | 'closed-open'`
  - `endsFor(kind: PipeKind): Ends`
  - `modeWaveNumber(kind: PipeKind, n: number): number` — with `L = 1`
  - `modeAngularFrequency(kind: PipeKind, n: number): number` — with `c = 1`
  - `modeWavelength(kind: PipeKind, n: number): number` — in units of `L`
  - `interiorNodeCount(kind: PipeKind, n: number): number`
  - `antinodeCount(kind: PipeKind, n: number): number`
  - `harmonicFrequency(kind: PipeKind, n: number, length: number, speed: number): number` — Hz
  - `harmonicWavelength(kind: PipeKind, n: number, length: number): number` — metres
  - `nodePositions(envelope: Float64Array, relThreshold?: number): number[]` — the centre
    of each interior dip, as a fraction from 0 to 1 along the pipe
  - `countNodesFromEnvelope(envelope: Float64Array, relThreshold?: number): number`
  - `spacingToWavelength(positions: number[]): number` — 0 when there are fewer than two
  - `goertzel(samples: ArrayLike<number>, angularFrequency: number, dt: number): number`

`countNodesFromEnvelope` must count only **interior** dips. A run of low values that
touches either edge is discarded, because a closed end is itself a node and must not be
counted as an interior one, and a dip still open when the array ends has not been shown to
be a dip at all.

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/02-standing-waves/modes.test.ts`:

```ts
import { expect, test } from 'vitest';
import { advance, createField } from './fdwave';
import {
  antinodeCount,
  countNodesFromEnvelope,
  endsFor,
  goertzel,
  harmonicFrequency,
  harmonicWavelength,
  interiorNodeCount,
  modeAngularFrequency,
  modeWavelength,
  modeWaveNumber,
  nodePositions,
  spacingToWavelength,
  type PipeKind,
} from './modes';

const KINDS: PipeKind[] = ['string', 'open', 'closed-open'];

/** |the exact mode shape|, sampled on a grid — used to test the counter on its own. */
function analyticEnvelope(kind: PipeKind, n: number, points: number): Float64Array {
  const env = new Float64Array(points);
  const k = modeWaveNumber(kind, n);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    env[i] = Math.abs(kind === 'open' ? Math.cos(k * x) : Math.sin(k * x));
  }
  return env;
}

test('the wave numbers are the ones the textbook derives', () => {
  expect(modeWaveNumber('string', 1)).toBeCloseTo(Math.PI, 12);
  expect(modeWaveNumber('string', 4)).toBeCloseTo(4 * Math.PI, 12);
  expect(modeWaveNumber('open', 3)).toBeCloseTo(3 * Math.PI, 12);
  expect(modeWaveNumber('closed-open', 1)).toBeCloseTo(Math.PI / 2, 12);
  expect(modeWaveNumber('closed-open', 3)).toBeCloseTo((5 * Math.PI) / 2, 12);
  for (const kind of KINDS) expect(modeAngularFrequency(kind, 2)).toBeCloseTo(modeWaveNumber(kind, 2), 12);
});

test('the fundamental of a string or open pipe is 2L, and of a closed pipe 4L', () => {
  expect(modeWavelength('string', 1)).toBeCloseTo(2, 12);
  expect(modeWavelength('open', 1)).toBeCloseTo(2, 12);
  expect(modeWavelength('closed-open', 1)).toBeCloseTo(4, 12);
  expect(harmonicWavelength('string', 4, 0.8)).toBeCloseTo(0.4, 12);
});

test('the harmonic frequencies reproduce the lesson problems', () => {
  // A 0.65 m guitar string carrying waves at 260 m/s.
  expect(harmonicFrequency('string', 1, 0.65, 260)).toBeCloseTo(200, 9);
  expect(harmonicFrequency('string', 3, 0.65, 260)).toBeCloseTo(600, 9);
  // A 0.17 m pipe closed at one end, in air at 340 m/s.
  expect(harmonicFrequency('closed-open', 1, 0.17, 340)).toBeCloseTo(500, 9);
});

test('a pipe closed at one end has only odd harmonics', () => {
  const base = harmonicFrequency('closed-open', 1, 0.17, 340);
  expect(harmonicFrequency('closed-open', 2, 0.17, 340) / base).toBeCloseTo(3, 9);
  expect(harmonicFrequency('closed-open', 3, 0.17, 340) / base).toBeCloseTo(5, 9);
});

test('the counts follow from the boundary conditions, not from one memorised rule', () => {
  expect(interiorNodeCount('string', 4)).toBe(3);
  expect(antinodeCount('string', 4)).toBe(4);
  expect(interiorNodeCount('open', 4)).toBe(4);
  expect(antinodeCount('open', 4)).toBe(5);
  expect(interiorNodeCount('closed-open', 4)).toBe(3);
  expect(antinodeCount('closed-open', 4)).toBe(4);
  expect(endsFor('closed-open')).toEqual({ left: 'closed', right: 'open' });
});

test('the counter reads the right number off an exact mode shape', () => {
  for (const kind of KINDS) {
    for (const n of [1, 2, 3, 4]) {
      expect(countNodesFromEnvelope(analyticEnvelope(kind, n, 401))).toBe(interiorNodeCount(kind, n));
    }
  }
});

test('the simulation grows the same node pattern the formula predicts', () => {
  const intervals = 200;
  const damping = 0.05;
  // 0.31 of the way along is not a node of any mode used here, so the driver couples to all of them.
  const index = Math.round(0.31 * intervals);

  for (const kind of KINDS) {
    for (const n of [1, 2, 3, 4]) {
      const field = createField(intervals);
      const ends = endsFor(kind);
      const omega = modeAngularFrequency(kind, n);
      const drive = { index, amplitude: 0.002, angularFrequency: omega };

      advance(field, Math.round(100 / field.dx), ends, damping, drive); // reach steady state
      field.envelope.fill(0);
      advance(field, Math.round(((2 * Math.PI) / omega / field.dx) * 2), ends, damping, drive, 1);

      expect(countNodesFromEnvelope(field.envelope)).toBe(interiorNodeCount(kind, n));
    }
  }
});

test('the spacing between measured nodes gives back the wavelength', () => {
  for (const kind of KINDS) {
    for (const n of [2, 3, 4]) {
      if (interiorNodeCount(kind, n) < 2) continue;
      const found = nodePositions(analyticEnvelope(kind, n, 401));
      expect(spacingToWavelength(found)).toBeCloseTo(modeWavelength(kind, n), 2);
    }
  }
  expect(spacingToWavelength([0.5])).toBe(0);
  expect(spacingToWavelength([])).toBe(0);
});

test('goertzel finds one frequency and ignores the others', () => {
  const samples = Array.from({ length: 64 }, (_, i) => 1.5 * Math.sin((2 * Math.PI * 3 * i) / 64));
  const present = (2 * Math.PI * 3) / 64;
  const absent = (2 * Math.PI * 7) / 64;
  expect(goertzel(samples, present, 1)).toBeCloseTo(1.5, 6);
  expect(goertzel(samples, absent, 1)).toBeLessThan(1e-6);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/02-standing-waves/modes.test.ts`
Expected: FAIL, resolving `./modes` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/02-standing-waves/modes.ts`:

```ts
import type { Ends } from './fdwave';

/**
 * The three cases the syllabus asks about. Every number below is derived from the
 * boundary conditions; none of it is a remembered rule.
 *
 *   string       both ends held still     u = 0 at both ends     k_n L = nπ
 *   open         both ends free           ∂u/∂x = 0 at both      k_n L = nπ
 *   closed-open  one end held, one free   u = 0 and ∂u/∂x = 0    cos(k_n L) = 0
 *
 * For a pipe, u is the displacement of the air. A displacement node is a pressure
 * antinode, so the same picture answers both kinds of question — but only if you say
 * which one you mean.
 */
export type PipeKind = 'string' | 'open' | 'closed-open';

export function endsFor(kind: PipeKind): Ends {
  if (kind === 'string') return { left: 'closed', right: 'closed' };
  if (kind === 'open') return { left: 'open', right: 'open' };
  return { left: 'closed', right: 'open' };
}

/** Wave number of harmonic n, in units where L = 1. */
export function modeWaveNumber(kind: PipeKind, n: number): number {
  return kind === 'closed-open' ? ((2 * n - 1) * Math.PI) / 2 : n * Math.PI;
}

/** In the solver c = 1, so ω and k are the same number. */
export const modeAngularFrequency = (kind: PipeKind, n: number) => modeWaveNumber(kind, n);

/** Wavelength in units of L: 2/n for a string or open pipe, 4/(2n−1) for a closed one. */
export const modeWavelength = (kind: PipeKind, n: number) => (2 * Math.PI) / modeWaveNumber(kind, n);

/**
 * Nodes strictly between the ends. A string held at both ends has a node at each end and
 * n − 1 in between; a pipe open at both ends has an antinode at each end and n nodes
 * inside; a pipe closed at one end has its node at the closed end and n − 1 inside.
 */
export const interiorNodeCount = (kind: PipeKind, n: number) => (kind === 'open' ? n : n - 1);

/** Antinodes anywhere, including at an open end. */
export const antinodeCount = (kind: PipeKind, n: number) => (kind === 'open' ? n + 1 : n);

export const harmonicWavelength = (kind: PipeKind, n: number, length: number) =>
  modeWavelength(kind, n) * length;

export const harmonicFrequency = (kind: PipeKind, n: number, length: number, speed: number) =>
  speed / harmonicWavelength(kind, n, length);

/**
 * Counts nodes by looking at the measured envelope, not by using any formula above.
 *
 * A node is a run of grid points where the envelope stays below a fraction of its peak.
 * A run that touches either edge is discarded: the left edge may be a boundary node, which
 * is not an interior one, and a run still open at the right edge has not been shown to end.
 */
export function nodePositions(envelope: Float64Array, relThreshold = 0.25): number[] {
  let top = 0;
  for (let i = 0; i < envelope.length; i++) if (envelope[i] > top) top = envelope[i];
  if (top <= 0) return [];

  const limit = top * relThreshold;
  const last = envelope.length - 1;
  const found: number[] = [];
  let runStart = -1;
  for (let i = 0; i < envelope.length; i++) {
    const below = envelope[i] < limit;
    if (below && runStart < 0) runStart = i;
    if (!below && runStart >= 0) {
      if (runStart > 0) found.push((runStart + i - 1) / 2 / last);
      runStart = -1;
    }
  }
  return found;
}

export const countNodesFromEnvelope = (envelope: Float64Array, relThreshold = 0.25) =>
  nodePositions(envelope, relThreshold).length;

/** Neighbouring nodes sit half a wavelength apart, so the spacing doubles to give λ. */
export function spacingToWavelength(positions: number[]): number {
  if (positions.length < 2) return 0;
  const spacing = (positions[positions.length - 1] - positions[0]) / (positions.length - 1);
  return 2 * spacing;
}

/** Amplitude of one frequency in a sampled signal, by the Goertzel algorithm. */
export function goertzel(samples: ArrayLike<number>, angularFrequency: number, dt: number): number {
  const w = angularFrequency * dt;
  const coefficient = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] + coefficient * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  const real = s1 - s2 * Math.cos(w);
  const imaginary = s2 * Math.sin(w);
  return (2 * Math.hypot(real, imaginary)) / samples.length;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/02-standing-waves/modes.test.ts`
Expected: PASS (9 tests)

The cross-check test runs about 5 million grid updates and takes a few seconds. All twelve
cases (three boundary pairs × `n = 1..4`) were confirmed against a reference
implementation of exactly this code before the plan was written, so a failure here means
your code differs from the plan, not that the test is too strict.

If it fails, **do not** relax `relThreshold`, shorten the build-up, or change the expected
counts. Report it as a blocker with the actual and expected number for each case. The two
things most likely to be wrong are the open-end ghost point in `step` and the dipole
driver — a one-sided driver leaves a rigid displacement that fills in every node of an
open pipe, and the symptom is exactly `got 0 want n` for `kind = 'open'`.

- [ ] **Step 5: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **31 test files, 120 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add subjects/physics/02-standing-waves/modes.ts subjects/physics/02-standing-waves/modes.test.ts
git commit -m "feat: mode formulas and node counting measured from the simulation"
```
