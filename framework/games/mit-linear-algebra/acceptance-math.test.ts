import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest.json';
import { mitLinearAlgebraGenerators } from './registry';
import type { PracticeCard } from '../types';

const seeds = [0, 1, 7919, 0xffff_ffff];
const idFor = (sequence: number) => `MIT-LA-${String(sequence).padStart(2, '0')}`;
function card(sequence: number, suffix: string, seed: number, lang: 'en' | 'zh' = 'en') {
  const deck = mitLinearAlgebraGenerators[idFor(sequence)](seed, lang);
  const found = deck.find((item) => item.id.endsWith(`-${suffix}`));
  if (!found) throw new Error(`Missing ${idFor(sequence)}-${suffix}`);
  return found;
}
function numeric(card: PracticeCard) {
  if (!card.fields) throw new Error(`${card.id} is not a numeric card`);
  return card.fields.map((field) => field.answer);
}
function numbers(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not read visible numeric data from: ${source}`);
  return match.slice(1).map(Number);
}

describe('MIT linear algebra independent acceptance oracles', () => {
  it('maps every manifest session to existing local source PDFs', () => {
    expect(manifest.games).toHaveLength(41);
    expect(manifest.games.filter((game) => game.kind === 'topic')).toHaveLength(32);
    expect(manifest.games.filter((game) => game.kind === 'review')).toHaveLength(4);
    expect(manifest.games.filter((game) => game.kind === 'exam')).toHaveLength(4);
    expect(manifest.games.filter((game) => game.kind === 'bonus')).toHaveLength(1);
    const assets = manifest.games.flatMap((game) => game.sources.map((source) => source.asset));
    expect(assets).toHaveLength(179);
    for (const asset of assets) {
      expect(existsSync(resolve(process.cwd(), 'public/open-courses', asset)), asset).toBe(true);
    }
  });

  it('keeps all 41 seeded decks structurally aligned in both languages', () => {
    for (const seed of seeds) {
      for (const game of manifest.games) {
        const generate = mitLinearAlgebraGenerators[game.id];
        const en = generate(seed, 'en');
        const zh = generate(seed, 'zh');
        expect(en.length, `${game.id} stage count`).toBeGreaterThan(0);
        expect(zh.map((item) => item.id)).toEqual(en.map((item) => item.id));
        expect(new Set(en.map((item) => item.id)).size).toBe(en.length);
        expect(generate(seed, 'en')).toEqual(en);
        for (const item of en) {
          const modes = Number(!!item.fields) + Number(!!item.choice) + Number(!!item.slots);
          expect(modes, item.id).toBe(1);
          for (const field of item.fields ?? []) {
            expect(Number.isFinite(field.answer), item.id).toBe(true);
            expect(Math.abs(field.answer), item.id).toBeLessThan(1_000_000);
          }
          if (item.choice) {
            expect(item.choice.answer).toBeGreaterThanOrEqual(0);
            expect(item.choice.answer).toBeLessThan(item.choice.options.length);
            expect(new Set(item.choice.options).size, item.id).toBe(item.choice.options.length);
          }
          if (item.slots) {
            expect(item.slots.answers.every((answer) => item.slots!.tokens.includes(answer)), item.id).toBe(true);
          }
        }
      }
    }
  });

  it('does not leak Chinese choice text into English cards', () => {
    const han = /[\u3400-\u9fff]/;
    for (const seed of seeds) {
      for (const game of manifest.games) {
        for (const item of mitLinearAlgebraGenerators[game.id](seed, 'en')) {
          for (const option of item.choice?.options ?? []) {
            expect(han.test(option), `${item.id}: ${option}`).toBe(false);
            const duplicatePair = option.match(/^(.+) \/ (.+)$/);
            if (duplicatePair) expect(duplicatePair[1], `${item.id}: ${option}`).not.toBe(duplicatePair[2]);
          }
        }
      }
    }
  });

  it.each(seeds)('recomputes randomized matrix products, Rayleigh quotients, SVDs, and null vectors (seed %s)', (seed) => {
    const product = card(1, 'matrix-vector', seed);
    const [a, b, c, d, x, y] = numbers(product.prompt, /A = \[\[(-?\d+), (-?\d+)\], \[(-?\d+), (-?\d+)\]\], x = \((-?\d+), (-?\d+)\)/);
    expect(numeric(product)).toEqual([a * x + b * y, c * x + d * y]);

    const rayleigh = card(37, 'rayleigh', seed);
    const [r1, r2] = numbers(rayleigh.prompt, /D=diag\((-?\d+),(-?\d+)\)/);
    expect(numeric(rayleigh)).toEqual([(r1 + r2) / 2]);

    const svd = card(33, 'challenge', seed);
    const [s1, s2] = numbers(svd.prompt, /C=\[\[0,(-?\d+)\],\[0,(-?\d+)\]\]/);
    const sigma = Math.hypot(s1, s2);
    expect(numeric(svd)).toEqual([sigma, s1 / sigma, s2 / sigma]);

    const nullVector = card(41, 'new-challenge', seed);
    const [p, q, r, s] = numbers(nullVector.prompt, /R=\[\[1,0,(-?\d+),(-?\d+)\],\[0,1,(-?\d+),(-?\d+)\]/);
    const z = numeric(nullVector);
    expect(z).toEqual([-p, -r, 1, 0]);
    expect([z[0] + p * z[2] + q * z[3], z[1] + r * z[2] + s * z[3]]).toEqual([0, 0]);
  });

  it('checks a least-squares solution from AᵀA and an FFT from direct complex arithmetic', () => {
    const leastSquares = numeric(card(39, 'least-squares', 7919));
    const gram = [[3, 3], [3, 5]];
    const rhs = [5, 6];
    const det = gram[0][0] * gram[1][1] - gram[0][1] * gram[1][0];
    const xhat = [
      (rhs[0] * gram[1][1] - gram[0][1] * rhs[1]) / det,
      (gram[0][0] * rhs[1] - rhs[0] * gram[1][0]) / det,
    ];
    expect(leastSquares).toEqual(xhat);

    const f4 = numeric(card(30, 'fft-f4', 7919));
    // Direct 4-point DFT with the +i convention printed in this card.
    const x = [2, -1, 1, 1];
    const direct = [
      [x.reduce((sum, value) => sum + value, 0), 0],
      [x[0] - x[2], x[1] - x[3]],
      [x[0] - x[1] + x[2] - x[3], 0],
      [x[0] - x[2], -(x[1] - x[3])],
    ].flat();
    expect(f4).toEqual(direct);
  });

  it('requires a visible precision instruction for an irrational numeric answer', () => {
    const normalized = card(23, 'normalize-eigenvector', 7919);
    expect(normalized.prompt).toMatch(/\bdecimal places\b|\bround to\b|\bapprox(?:imate|imation)\b/i);
  });

  it('keeps randomized explanation symbols defined by each visible prompt', () => {
    const challenge = card(33, 'challenge', 7919);
    expect(challenge.explanation).not.toMatch(/\bm\b/);
  });

  it('distinguishes asymptotic stability from Lyapunov stability and names free-column answers', () => {
    const stability = card(28, 'independent-challenge', 7919);
    expect(stability.prompt).toMatch(/asymptotically stable/i);
    expect(numeric(stability)).toEqual([3, 0]);

    const pivotFree = card(7, 'pivot-free', 7919);
    expect(pivotFree.prompt).toMatch(/classify column 1 and column 3/i);
    expect(pivotFree.slots?.answers).toEqual(['pivot', 'free']);
    expect(pivotFree.explanation).toMatch(/Column 1 is pivot; column 3 is free/i);
  });
});
