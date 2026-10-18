import { describe, expect, it } from 'vitest';
import { gpf1 } from './games/gpf1';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { close } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard, type PracticeCard } from '../types';

const SEEDS = 60;
const KINDS = [
  'GP-F1:linear-cov', 'GP-F1:portfolio-var', 'GP-F1:factor-cross', 'GP-F1:idio-var',
  'GP-F1:cross-portfolio', 'GP-F1:challenge',
] as const;
type P = Record<string, number>;
const p = (card: PracticeCard): P => card.audit?.params as P;
const cardBy = (cards: PracticeCard[], id: string) => {
  const card = cards.find(item => item.id === `GP-F1-${id}`);
  expect(card, `missing GP-F1-${id}`).toBeDefined();
  return card!;
};
const answerOf = (card: PracticeCard) => {
  expect(card.fields, `${card.id} has numeric audit but no field`).toBeDefined();
  expect(card.fields).toHaveLength(1);
  return card.fields![0].answer;
};
const fracText = (value: number): string => {
  for (let d = 1; d <= 10000; d++) {
    const n = Math.round(value * d);
    if (close(value, n / d, 1e-12)) return d === 1 ? String(n) : `${n}/${d}`;
  }
  throw new Error(`not a small rational: ${value}`);
};
const visibleNumbers = (text: string) => {
  const normalized = text.replaceAll('−', '-');
  const found = new Set([...normalized.matchAll(/(?<![A-Za-z])[-+]?\d+(?:\.\d+)?/g)].map(m => Number(m[0])));
  for (const m of normalized.matchAll(/(?<![\w.])(-?\d+)\s*\/\s*(\d+)(?![\w.])/g)) found.add(Number(m[1]) / Number(m[2]));
  return found;
};
const lit=(x:number)=>String(x).replaceAll('-','−');
function assertParamsVisible(card: PracticeCard, lang: 'en' | 'zh') {
  const numbers = visibleNumbers(card.prompt);
  const labels: Record<string, string> = { ...Object.fromEntries(Object.keys(p(card)).map(key => [key, key])), rho: 'ρ', mu: 'μ' };
  for (const [key, value] of Object.entries(p(card))) {
    expect(numbers.has(value), `${card.id} ${lang}: prompt does not print audit param ${key}=${value}; ${card.prompt}`).toBe(true);
    const label = labels[key] ?? key;
    expect(card.prompt, `${card.id} ${lang}: ${label} is not visibly bound to audit value ${value}`).toContain(`${label} = ${lit(value)}`);
  }
  const q=p(card), exactText: Record<string,string[]>={
    'linear-cov': [`F = [[${q.a}, 0], [0, ${q.b}]]`, `u = ${q.u}`],
    'portfolio-var': [`Σ = [[${q.a}, ${lit(q.c)}], [${lit(q.c)}, ${q.b}]]`, `h = ${lit(q.h)}`],
    'factor-cross': [`x = ${q.x}`, `y = ${lit(q.y)}`, `v = ${q.v}`],
    'idio-var': [`d1 = ${q.d1}`, `d2 = ${q.d2}`],
    'cross-portfolio': [`Σ = [[${q.a}, ${lit(q.c)}], [${lit(q.c)}, ${q.b}]]`],
    'challenge': [`X = (${q.x}, ${lit(q.y)})`, `Var(z) = v = ${q.v}`, `Cov(ε) = [[${q.d1}, 0], [0, ${q.d2}]]`],
  };
  for(const snippet of exactText[card.id.replace('GP-F1-','')]??[]) expect(card.prompt,`${card.id} ${lang}: sampled data representation changed`).toContain(snippet);
}

// Independent routes: multiply covariance matrices as linear transformations, not the scalar formula in the plan.
const mul = (A: number[][], B: number[][]) => A.map(row => B[0].map((_, j) => row.reduce((sum, value, k) => sum + value * B[k][j], 0)));
const transpose = (A: number[][]) => A[0].map((_, j) => A.map(row => row[j]));
const quad = (left: number[], A: number[][], right = left) => left.reduce((sum, x, i) => sum + x * right.reduce((row, y, j) => row + A[i][j] * y, 0), 0);
const recompute = (kind: string, q: P): number => {
  switch (kind) {
    case 'GP-F1:linear-cov': {
      const F = [[q.a, 0], [0, q.b]], x = [q.u, 1], z = [1, -1];
      const transformed = mul(F, z.map(value => [value]));
      return x[0] * transformed[0][0] + x[1] * transformed[1][0];
    }
    case 'GP-F1:portfolio-var': {
      const Sigma = [[q.a, q.c], [q.c, q.b]], w = [q.h, 1 - q.h];
      return quad(w, Sigma); // full wᵀΣw
    }
    case 'GP-F1:factor-cross': {
      const X = [[q.x], [q.y]], F = [[q.v]];
      return mul(mul(X, F), transpose(X))[0][1];
    }
    case 'GP-F1:idio-var': {
      const D = [[q.d1, 0], [0, q.d2]], w = [0.5, 0.5];
      return quad(w, D);
    }
    case 'GP-F1:cross-portfolio': {
      const Sigma = [[q.a, q.c], [q.c, q.b]], first = [0.5, 0.5], second = [2, -1];
      return quad(first, Sigma, second);
    }
    case 'GP-F1:challenge': {
      const X = [[q.x], [q.y]], F = [[q.v]], D = [[q.d1, 0], [0, q.d2]];
      const Sigma = mul(mul(X, F), transpose(X)).map((row, i) => row.map((v, j) => v + D[i][j]));
      return quad([0.5, 0.5], Sigma); // build full covariance, then evaluate the quadratic form
    }
    default: throw new Error(`unknown GP-F1 oracle kind: ${kind}`);
  }
};
function tuple(...values: number[]) { return values.join(','); }
function allowed(kind: string, q: P): boolean {
  switch (kind) {
    case 'GP-F1:linear-cov': return [2, 3].includes(q.a) && [1, 2].includes(q.b) && [1, 2, 3].includes(q.u) && q.a * q.u !== q.b;
    case 'GP-F1:portfolio-var': return [4, 6].includes(q.a) && [2, 4].includes(q.b) && [-1, 1].includes(q.c) && [-1, 0.5, 2].includes(q.h) && q.a * q.b - q.c ** 2 > 0;
    case 'GP-F1:factor-cross': return [1, 2].includes(q.x) && [-2, -1, 1, 2].includes(q.y) && [2, 3].includes(q.v);
    case 'GP-F1:idio-var': return [1, 2, 4].includes(q.d1) && [1, 2, 4].includes(q.d2);
    case 'GP-F1:cross-portfolio': return [4, 6].includes(q.a) && [2, 4].includes(q.b) && [-1, 1].includes(q.c) && q.a * q.b - q.c ** 2 > 0;
    case 'GP-F1:challenge': return [1, 2].includes(q.x) && [-1, 1, 2].includes(q.y) && [2, 4].includes(q.v) && [1, 2].includes(q.d1) && [1, 2].includes(q.d2);
    default: return false;
  }
}

describe('GP-F1 independent covariance and factor-model oracle', () => {
  it('recomputes all six audit kinds over 60 spread seeds in EN and ZH', () => {
    const counts = Object.fromEntries(KINDS.map(kind => [kind, 0])) as Record<string, number>;
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const cards = gpf1(spreadSeed(i), lang) as PracticeCard[];
      for (const card of cards) {
        if (!card.audit) { if (card.fields) throw new Error(`${card.id} has an unaudited numeric answer`); continue; }
        expect(KINDS, `${card.id}: unexpected audit kind ${card.audit.kind}`).toContain(card.audit.kind);
        counts[card.audit.kind]++;
        const q = p(card);
        expect(allowed(card.audit.kind, q), `${card.id} seed ${i} has params outside approved sampled space: ${JSON.stringify(q)}`).toBe(true);
        assertParamsVisible(card, lang);
        const expected = recompute(card.audit.kind, q), actual = answerOf(card), tol = card.fields![0].tolerance ?? 1e-8;
        expect(tol, `${card.id} should retain approved 0.006 tolerance`).toBe(0.006);
        expect(Math.abs(actual - expected), `${card.id} seed ${i}, params ${JSON.stringify(q)}: expected ${expected}, got ${actual}`).toBeLessThanOrEqual(tol);
        const accepted = gradeCard(card, [fracText(expected)], null, []);
        expect(accepted, `${card.id} seed ${i}: oracle answer should grade correct`).toBe('correct');
        expect(gradeCard(card, [(Math.round(expected * 100) / 100).toFixed(2)], null, []), `${card.id} seed ${i}: two-decimal rounded answer should be accepted`).toBe('correct');
        const rejected = gradeCard(card, [fracText(expected + Math.max(2 * tol, 0.01))], null, []);
        expect(rejected, `${card.id} seed ${i}: perturbed answer should grade incorrect`).toBe('incorrect');
      }
    }
    for (const kind of KINDS) expect(counts[kind], `${kind} did not fire on every seed/language`).toBe(SEEDS * 2);
  });

  it('has at least six distinct prompt variants per parameterized card', () => {
    const ids = ['linear-cov', 'portfolio-var', 'factor-cross', 'idio-var', 'cross-portfolio', 'invalid-cov', 'challenge'];
    for (const id of ids) {
      const prompts = new Set(Array.from({ length: SEEDS }, (_, i) => cardBy(gpf1(spreadSeed(i), 'en'), id).prompt));
      expect(prompts.size, `GP-F1-${id} prompt variants`).toBeGreaterThanOrEqual(6);
    }
  });

  it('choice content encodes the mean-vs-risk and invalid-covariance predicates', () => {
    const invalidPred = (s: string) => /not a covariance|not valid|invalid|negative variance|否.*协方差|不是.*协方差|方差为负/.test(s.toLowerCase());
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const cards = gpf1(spreadSeed(i), lang) as PracticeCard[];
      const mean = cardBy(cards, 'mean-vs-risk');
      expect(mean.choice).toBeDefined();
      expect(mean.choice!.options.filter(s => /unchanged|does not change|remain.*same|不变/.test(s.toLowerCase()))).toHaveLength(1);
      expect(mean.choice!.options[mean.choice!.answer]).toMatch(/unchanged|does not change|remain.*same|不变/i);
      const bad = cardBy(cards, 'invalid-cov');
      const trueOptions = bad.choice!.options.filter(invalidPred);
      expect(trueOptions, `GP-F1-invalid-cov seed ${i} options`).toHaveLength(1);
      expect(invalidPred(bad.choice!.options[bad.choice!.answer])).toBe(true);
    }
  });
});
