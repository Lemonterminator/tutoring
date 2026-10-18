import { expect } from 'vitest';
import type { CardAudit, CardGenerator, PracticeCard } from '../types';

/** What an oracle may return for one audited card. */
export type OracleResult =
  /** Expected numeric answers, in the order of the card's `fields`. */
  | number[]
  /** For a choice card: tells whether an option's English text is mathematically correct. Exactly the card's correct option must satisfy it. */
  | { optionIsCorrect: (optionText: string) => boolean };
/** Params are the audited card's sampled inputs. Compute from them by an independent route (quadrature, finite differences, direct expansion). */
export type Oracle = (params: CardAudit['params']) => OracleResult;

export function asVec(value: number | number[] | undefined): number[] {
  if (!Array.isArray(value)) throw new Error('expected a vector parameter');
  return value;
}
export const close = (a: number, b: number, tolerance = 1e-9) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/** Composite Simpson's rule on [a, b] with n (even) panels. */
export function simpson(f: (x: number) => number, a: number, b: number, n = 400): number {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return sum * h / 3;
}
/** Central difference derivative. */
export const centralDiff = (f: (x: number) => number, x: number, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);

/**
 * Recompute every audited card of `generate` from its audit params and compare with the card's own answers,
 * over `seeds` seeds. Fails when a card carries an audit kind that has no oracle, so coverage cannot silently shrink.
 * Returns how many cards were independently recomputed per kind.
 */
export function runOracle(id: string, generate: CardGenerator, oracles: Record<string, Oracle>, seeds = 200): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let seed = 0; seed < seeds; seed++) {
    for (const card of generate(seed, 'en') as PracticeCard[]) {
      if (!card.audit) continue;
      const oracle = oracles[card.audit.kind];
      expect(oracle, `${card.id}: no oracle for audit kind ${card.audit.kind}`).toBeTypeOf('function');
      const result = oracle(card.audit.params);
      const where = `${card.id} seed ${seed} params ${JSON.stringify(card.audit.params)}`;
      if (Array.isArray(result)) {
        expect(card.fields, `${where}: oracle returned numbers for a card without fields`).toBeDefined();
        expect(result.length, where).toBe(card.fields!.length);
        result.forEach((value, i) => {
          const tolerance = card.fields![i].tolerance ?? 1e-8;
          expect(Math.abs(value - card.fields![i].answer), `${where} field ${i}: oracle ${value} vs card ${card.fields![i].answer}`).toBeLessThanOrEqual(tolerance);
        });
      } else {
        expect(card.choice, `${where}: oracle returned an option test for a card without choices`).toBeDefined();
        const verdicts = card.choice!.options.map(result.optionIsCorrect);
        expect(verdicts.filter(Boolean).length, `${where}: exactly one option must be correct per the oracle`).toBe(1);
        expect(verdicts[card.choice!.answer], `${where}: card marks "${card.choice!.options[card.choice!.answer]}" correct but the oracle disagrees`).toBe(true);
      }
      counts[card.audit.kind] = (counts[card.audit.kind] ?? 0) + 1;
    }
  }
  return counts;
}
