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
