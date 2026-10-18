import { describe, expect, it } from 'vitest';
import { parseGameNumber } from './types';

describe('parseGameNumber', () => {
  it('keeps the original number and fraction behaviour', () => {
    expect(parseGameNumber('3')).toBe(3);
    expect(parseGameNumber(' −2.5 ')).toBe(-2.5);
    expect(parseGameNumber('1/4')).toBe(0.25);
    expect(parseGameNumber('3/-4')).toBe(-0.75);
    expect(parseGameNumber('1e3/2')).toBe(500);
    expect(parseGameNumber('1/0')).toBeNull();
    expect(parseGameNumber('')).toBeNull();
    expect(parseGameNumber('abc')).toBeNull();
    expect(parseGameNumber('2+3')).toBeNull();
  });

  it('accepts a single exact pi constant with optional coefficient and denominator', () => {
    const pi = Math.PI;
    expect(parseGameNumber('pi')).toBeCloseTo(pi, 12);
    expect(parseGameNumber('π')).toBeCloseTo(pi, 12);
    expect(parseGameNumber('-pi')).toBeCloseTo(-pi, 12);
    expect(parseGameNumber('2pi')).toBeCloseTo(2 * pi, 12);
    expect(parseGameNumber('2*pi')).toBeCloseTo(2 * pi, 12);
    expect(parseGameNumber('3pi/4')).toBeCloseTo(3 * pi / 4, 12);
    expect(parseGameNumber('3π/4')).toBeCloseTo(3 * pi / 4, 12);
    expect(parseGameNumber('pi/2')).toBeCloseTo(pi / 2, 12);
    expect(parseGameNumber('3/4 pi')).toBeCloseTo(3 * pi / 4, 12);
    expect(parseGameNumber('−3/4π')).toBeCloseTo(-3 * pi / 4, 12);
    expect(parseGameNumber('1.5pi')).toBeCloseTo(1.5 * pi, 12);
  });

  it('accepts a single square root', () => {
    expect(parseGameNumber('sqrt(2)')).toBeCloseTo(Math.SQRT2, 12);
    expect(parseGameNumber('√5')).toBeCloseTo(Math.sqrt(5), 12);
    expect(parseGameNumber('3√2/2')).toBeCloseTo(3 * Math.SQRT2 / 2, 12);
    expect(parseGameNumber('2*sqrt(3)')).toBeCloseTo(2 * Math.sqrt(3), 12);
    expect(parseGameNumber('-sqrt(2)/2')).toBeCloseTo(-Math.SQRT2 / 2, 12);
  });

  it('rejects anything that is not one exact constant', () => {
    for (const bad of ['pi/0', '3pi/4/5', '3/4pi/5', 'pipi', 'pi+1', '2pi*3', '*pi', 'sqrt(2', 'sqrt2', 'sqrt(2)sqrt(3)', 'e', '3 pi pi', 'pi/', '√', 'sqrt()', 'Infinity', 'NaN'])
      expect(parseGameNumber(bad), bad).toBeNull();
  });
});
