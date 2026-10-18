import { describe, expect, it } from 'vitest';
import { reweightTwoStates } from './radon-nikodym';

describe('BS1 two-state Radon–Nikodym experiment', () => {
  it('recovers the hand-derived likelihood ratios and Call price', () => {
    const result = reweightTwoStates(0.7);
    expect(result.rows[0].weight).toBeCloseTo(5 / 7, 14);
    expect(result.rows[1].weight).toBeCloseTo(5 / 3, 14);
    expect(result.physicalPayoff).toBeCloseTo(14, 14);
    expect(result.weightedPayoff).toBeCloseTo(10, 14);
  });

  it.each([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])(
    'preserves total probability and both replicated prices at P(up) = %s', p => {
      const result = reweightTwoStates(p);
      expect(result.mass).toBeCloseTo(1, 14);
      expect(result.weightedStock).toBeCloseTo(100, 12);
      expect(result.weightedPayoff).toBeCloseTo(10, 12);
      // The two singleton events generate the full event algebra.
      for (const row of result.rows) expect(row.p * row.weight).toBeCloseTo(0.5, 14);
    },
  );

  it('has unit weights when the probability measures agree', () => {
    expect(reweightTwoStates(0.5).rows.map(row => row.weight)).toEqual([1, 1]);
  });

  it.each([0, 1, -0.1, 1.1, NaN, Infinity])('rejects unsupported or invalid physical probabilities: %s', p => {
    expect(() => reweightTwoStates(p)).toThrow(RangeError);
  });
});
