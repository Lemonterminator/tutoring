import { expect, test } from 'vitest';
import { clampGain, MAX_GAIN, Tone } from './tone';

test('gain is capped and sanitised', () => {
  expect(clampGain(5)).toBe(MAX_GAIN);
  expect(clampGain(-1)).toBe(0);
  expect(clampGain(Number.NaN)).toBe(0);
  expect(clampGain(0.1)).toBe(0.1);
});

test('a tone without Web Audio support is silently a no-op', () => {
  const tone = new Tone();
  expect(() => {
    tone.start(440, 0.1);
    tone.stop();
  }).not.toThrow();
});
