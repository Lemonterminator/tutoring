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
