import { expect, test } from 'vitest';
import {
  angularFrequency,
  echoDistance,
  frequencyOf,
  HEARING_MAX_HZ,
  HEARING_MIN_HZ,
  V_AIR,
  V_TISSUE,
  V_WATER,
  wavelength,
  waveNumber,
} from './acoustics';

test('the lowest audible tone in air is about 17 m long', () => {
  expect(wavelength(V_AIR, HEARING_MIN_HZ)).toBeCloseTo(17, 5);
});

test('the highest audible tone in air is about 17 mm long', () => {
  expect(wavelength(V_AIR, HEARING_MAX_HZ)).toBeCloseTo(0.017, 5);
});

test('medical ultrasound at 2.5 MHz is sub-millimetre in tissue', () => {
  const lambda = wavelength(V_TISSUE, 2.5e6);
  expect(lambda).toBeGreaterThan(0.0006);
  expect(lambda).toBeLessThan(0.00062);
});

test('frequency and wavelength invert each other', () => {
  expect(frequencyOf(V_AIR, wavelength(V_AIR, 440))).toBeCloseTo(440, 9);
});

test('omega over k is the wave speed', () => {
  expect(angularFrequency(440) / waveNumber(wavelength(V_AIR, 440))).toBeCloseTo(V_AIR, 9);
});

test('echo sounding halves the round trip', () => {
  expect(echoDistance(V_WATER, 0.12)).toBeCloseTo(90, 9);
});
