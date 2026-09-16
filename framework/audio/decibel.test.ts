import { expect, test } from 'vitest';
import { addLevels, ampRatioToDb, dbToAmpRatio, dbToIntensity, intensityToDb } from './decibel';

test('threshold of hearing is 0 dB and 1 W/m² is 120 dB', () => {
  expect(intensityToDb(1e-12)).toBeCloseTo(0, 10);
  expect(intensityToDb(1)).toBeCloseTo(120, 10);
  expect(dbToIntensity(60)).toBeCloseTo(1e-6, 15);
});

test('amplitude ratios use 20 lg', () => {
  expect(ampRatioToDb(10)).toBeCloseTo(20, 10);
  expect(dbToAmpRatio(-40)).toBeCloseTo(0.01, 12);
});

test('two equal sources add about 3 dB', () => {
  expect(addLevels(70, 70)).toBeCloseTo(73.01, 2);
});
