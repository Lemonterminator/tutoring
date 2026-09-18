### Task 2: The travelling wave and its derivatives

**Files:**
- Create: `subjects/physics/01-traveling-waves/wave1d.ts`
- Test: `subjects/physics/01-traveling-waves/wave1d.test.ts`

**Interfaces:**
- Consumes: nothing. This module has no imports.
- Produces, all from `subjects/physics/01-traveling-waves/wave1d.ts`:
  - `type Wave1D = { amplitude: number; waveNumber: number; angularFrequency: number; phase: number }`
  - `type Marker = { id: string; at: number }`
  - `displacement(w: Wave1D, x: number, t: number): number`
  - `particleVelocity(w: Wave1D, x: number, t: number): number`
  - `transverseAcceleration(w: Wave1D, x: number, t: number): number`
  - `slope(w: Wave1D, x: number, t: number): number`
  - `curvature(w: Wave1D, x: number, t: number): number`
  - `pressure(w: Wave1D, x: number, t: number, bulkModulus: number): number`
  - `waveSpeed(w: Wave1D): number`
  - `period(w: Wave1D): number`
  - `wavelengthOf(w: Wave1D): number`
  - `maxParticleSpeed(w: Wave1D): number`
  - `fromLambdaAndPeriod(amplitude: number, lambda: number, periodSeconds: number, phase?: number): Wave1D`
  - `nearestMarker(value: number, markers: Marker[]): string`
  - `measuredSpeed(distance: number, time: number): number`

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/01-traveling-waves/wave1d.test.ts`:

```ts
import { expect, test } from 'vitest';
import {
  curvature,
  displacement,
  fromLambdaAndPeriod,
  maxParticleSpeed,
  measuredSpeed,
  nearestMarker,
  particleVelocity,
  period,
  pressure,
  slope,
  transverseAcceleration,
  waveSpeed,
  wavelengthOf,
  type Wave1D,
} from './wave1d';

// λ = 2 m, T = 0.5 s, so v = 4 m/s — the numbers the caliper figure uses.
const wave: Wave1D = fromLambdaAndPeriod(1, 2, 0.5);

test('the wave is built from the wavelength and period a student measures', () => {
  expect(wavelengthOf(wave)).toBeCloseTo(2, 9);
  expect(period(wave)).toBeCloseTo(0.5, 9);
  expect(waveSpeed(wave)).toBeCloseTo(4, 9);
});

test('a crest sits at the origin when the phase is zero', () => {
  expect(displacement(wave, 0, 0)).toBeCloseTo(1, 9);
  expect(displacement(wave, 1, 0)).toBeCloseTo(-1, 9);
});

test('the medium is momentarily at rest at a crest and fastest at zero displacement', () => {
  expect(particleVelocity(wave, 0, 0)).toBeCloseTo(0, 9);
  expect(Math.abs(particleVelocity(wave, 0.5, 0))).toBeCloseTo(maxParticleSpeed(wave), 9);
});

test('the maximum particle speed is far below the wave speed for a real sound wave', () => {
  const sound = fromLambdaAndPeriod(0.0005, 2, 1 / 170);
  expect(maxParticleSpeed(sound)).toBeCloseTo(0.534, 3);
  expect(maxParticleSpeed(sound)).toBeLessThan(1);
});

test('the snapshot slope is flat at a crest', () => {
  expect(slope(wave, 0, 0)).toBeCloseTo(0, 9);
});

test('curvature and acceleration obey the wave equation at every sample point', () => {
  const v = waveSpeed(wave);
  for (const x of [0, 0.31, 0.75, 1.4, 2.2]) {
    for (const t of [0, 0.07, 0.19, 0.42]) {
      expect(transverseAcceleration(wave, x, t)).toBeCloseTo(v * v * curvature(wave, x, t), 9);
    }
  }
});

test('pressure is a quarter cycle out of step with displacement', () => {
  // ξ is at a maximum at x = 0, t = 0, so the pressure there is zero.
  expect(pressure(wave, 0, 0, 1.4e5)).toBeCloseTo(0, 6);
  // A quarter of a wavelength away the displacement vanishes and the pressure peaks.
  expect(displacement(wave, 0.5, 0)).toBeCloseTo(0, 9);
  expect(Math.abs(pressure(wave, 0.5, 0, 1.4e5))).toBeGreaterThan(1e5);
});

test('nearestMarker picks the marker closest to the pointer', () => {
  const markers = [
    { id: 'a', at: 1 },
    { id: 'b', at: 3 },
  ];
  expect(nearestMarker(1.4, markers)).toBe('a');
  expect(nearestMarker(2.6, markers)).toBe('b');
});

test('measuredSpeed refuses to divide by zero', () => {
  expect(measuredSpeed(2, 0.5)).toBeCloseTo(4, 9);
  expect(measuredSpeed(2, 0)).toBe(0);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/01-traveling-waves/wave1d.test.ts`
Expected: FAIL, resolving `./wave1d` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/01-traveling-waves/wave1d.ts`:

```ts
/**
 * The course-wide travelling wave: y(x, t) = A cos(ωt − kx + φ).
 *
 * Cosine is even, so this is the same wave as A cos(kx − ωt + φ). The ωt − kx order is
 * the one the whole course uses, because it matches Module 0's counterclockwise e^{iωt}
 * and the ∂/∂t → +iω rule that later modules need.
 */
export type Wave1D = { amplitude: number; waveNumber: number; angularFrequency: number; phase: number };

export type Marker = { id: string; at: number };

const argument = (w: Wave1D, x: number, t: number) => w.angularFrequency * t - w.waveNumber * x + w.phase;

export const displacement = (w: Wave1D, x: number, t: number) => w.amplitude * Math.cos(argument(w, x, t));

/** ∂y/∂t: how fast this one piece of the medium is moving. This is not the wave speed. */
export const particleVelocity = (w: Wave1D, x: number, t: number) =>
  -w.amplitude * w.angularFrequency * Math.sin(argument(w, x, t));

/** ∂²y/∂t². */
export const transverseAcceleration = (w: Wave1D, x: number, t: number) =>
  -w.amplitude * w.angularFrequency ** 2 * Math.cos(argument(w, x, t));

/** ∂y/∂x: the slope of the frozen snapshot. For a transverse wave this is not the strain. */
export const slope = (w: Wave1D, x: number, t: number) =>
  w.amplitude * w.waveNumber * Math.sin(argument(w, x, t));

/** ∂²y/∂x²: the curvature, valid as written only while the slope stays small. */
export const curvature = (w: Wave1D, x: number, t: number) =>
  -w.amplitude * w.waveNumber ** 2 * Math.cos(argument(w, x, t));

/**
 * For a longitudinal wave the same function is the displacement ξ of the medium along x,
 * and the pressure change is p = −B ∂ξ/∂x — a quarter cycle out of step with ξ.
 */
export const pressure = (w: Wave1D, x: number, t: number, bulkModulus: number) =>
  -bulkModulus * slope(w, x, t);

export const waveSpeed = (w: Wave1D) => w.angularFrequency / w.waveNumber;
export const period = (w: Wave1D) => (2 * Math.PI) / w.angularFrequency;
export const wavelengthOf = (w: Wave1D) => (2 * Math.PI) / w.waveNumber;
export const maxParticleSpeed = (w: Wave1D) => Math.abs(w.amplitude * w.angularFrequency);

/** Builds the wave from the two quantities a student reads off the two graphs. */
export function fromLambdaAndPeriod(amplitude: number, lambda: number, periodSeconds: number, phase = 0): Wave1D {
  return {
    amplitude,
    waveNumber: (2 * Math.PI) / lambda,
    angularFrequency: (2 * Math.PI) / periodSeconds,
    phase,
  };
}

/** Which marker a pointer landed nearest. Used to decide what a drag is grabbing. */
export function nearestMarker(value: number, markers: Marker[]): string {
  let best = markers[0];
  for (const marker of markers) {
    if (Math.abs(marker.at - value) < Math.abs(best.at - value)) best = marker;
  }
  return best.id;
}

export const measuredSpeed = (distance: number, time: number) => (time === 0 ? 0 : distance / time);
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/01-traveling-waves/wave1d.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **25 test files, 90 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add subjects/physics/01-traveling-waves/wave1d.ts subjects/physics/01-traveling-waves/wave1d.test.ts
git commit -m "feat: travelling wave model with derivatives and pressure"
```
