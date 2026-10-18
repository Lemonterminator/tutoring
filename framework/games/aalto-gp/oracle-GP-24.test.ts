import { describe, expect, it } from 'vitest';
import { gp24 } from './games/gp24';
import { deckProblems, spreadSeed, textLintProblems, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { simpson } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-24 (infinitely wide networks and the neural tangent kernel).
 * Written from docs/aalto-gp-drafts/approved-GP-24.md only. Every numeric answer is recomputed by a route that does not use the plan's closed form:
 * explicit covariance matrix, quadrature of the Gaussian-bump integral, central finite differences of the network output.
 */
const SEEDS = 60;
const seeds = Array.from({ length: SEEDS }, (_, i) => spreadSeed(i));
const decks: Record<GameLanguage, PracticeCard[][]> = { en: seeds.map(s => gp24(s, 'en')), zh: seeds.map(s => gp24(s, 'zh')) };
const SLUGS = ['bnn-limit', 'toy-kernel', 'unscaled-var', 'act-kernel', 'gauss-bump', 'ntk-out', 'ntk-in', 'ntk-lazy', 'challenge'];
const cardOf = (deck: PracticeCard[], slug: string) => deck.find(c => c.id === `GP-24-${slug}`)!;
const each = (slug: string, body: (en: PracticeCard, zh: PracticeCard, index: number) => void) => seeds.forEach((_, i) => body(cardOf(decks.en[i], slug), cardOf(decks.zh[i], slug), i));
const where = (card: PracticeCard, i: number) => `${card.id} seed#${i} ${JSON.stringify(card.audit?.params ?? {})}`;

// ---------- small helpers ----------
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toNum = (s: string) => Number(s.replaceAll('−', '-'));
/** value printed as `symbol = value` (optionally parenthesised); every occurrence must agree */
function printed(text: string, symbol: string): number {
  const re = new RegExp(String.raw`(?<![\p{L}_′⁰-⁹₀-₉])${escapeRe(symbol)} = \(?(−?\d+(?:\.\d+)?)\)?`, 'gu');
  const values = [...text.matchAll(re)].map(m => toNum(m[1]));
  expect(values.length, `"${symbol} = …" not printed in: ${text.slice(0, 120)}`).toBeGreaterThan(0);
  values.forEach(v => expect(v, `conflicting values for ${symbol}`).toBe(values[0]));
  return values[0];
}
/** first fully numeric list printed as `name = (a, b, …)` */
function vector(text: string, name: string): number[] {
  const re = new RegExp(String.raw`${escapeRe(name)} = \((−?\d+(?:[,，] ?−?\d+)*)\)`, 'u');
  const m = text.match(re);
  expect(m, `vector ${name} not printed in: ${text.slice(0, 160)}`).not.toBeNull();
  return m![1].split(/[,，] ?/).map(toNum);
}
function denominator(v: number): number {
  for (let d = 1; d <= 2000; d++) if (Math.abs(v * d - Math.round(v * d)) < 1e-9 * d) return d;
  return Infinity;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const len = (s: string) => [...s].length;
/** exact string forms of an answer that an explanation may print */
function forms(v: number): string[] {
  const d = denominator(v), n = Math.round(v * d), sign = n < 0 ? '−' : '', a = Math.abs(n);
  const out = new Set<string>([String(Math.round(v * 100) / 100).replace('-', '−')]);
  out.add(d === 1 ? `${sign}${a}` : `${sign}${a}/${d}`);
  return [...out];
}
const containsNumber = (text: string, token: string) => new RegExp(String.raw`(?<![\d./])${escapeRe(token)}(?![\d]|\.\d|/\d)`).test(text);

// ---------- independent recomputations ----------
const NTK_F = (x: number, theta: number[], K: number) => {
  // theta = [w0_1..w0_K, w1_1..w1_K];  f = (1/sqrt K) sum_j w1_j relu(w0_j x)
  let s = 0;
  for (let j = 0; j < K; j++) s += theta[K + j] * Math.max(theta[j] * x, 0);
  return s / Math.sqrt(K);
};
function ntkByFiniteDifferences(p: number[], v: number[], x: number, y: number, parts: 'out' | 'in' | 'all'): number {
  const K = p.length, theta = [...p, ...v], h = 1e-6;
  const coords = parts === 'out' ? Array.from({ length: K }, (_, j) => K + j) : parts === 'in' ? Array.from({ length: K }, (_, j) => j) : Array.from({ length: 2 * K }, (_, j) => j);
  const grad = (at: number) => coords.map(c => {
    const up = theta.slice(), dn = theta.slice();
    up[c] += h; dn[c] -= h;
    return (NTK_F(at, up, K) - NTK_F(at, dn, K)) / (2 * h);
  });
  const gx = grad(x), gy = grad(y);
  return gx.reduce((s, g, i) => s + g * gy[i], 0);
}
/** explicit covariance of z = b + sum_j w_j a_j with a_j = sqrt(m) * (+-1), w_j ~ N(0, sw2): sum of all entries of the covariance matrix of the terms plus the bias variance */
function unscaledVariance(sb2: number, sw2: number, m: number, K1: number): number {
  let total = sb2;
  for (let i = 0; i < K1; i++) for (let j = 0; j < K1; j++) total += i === j ? sw2 * m : 0;
  return total;
}
/** ln k~ from the exact integral k(x, x') = E_u[a(x)a(x')] by quadrature, minus the constant factor ln(sigma_e / sigma_u) */
function gaussBumpLogK(g: number, u: number, x: number, xp: number): number {
  const integral = simpson(t => Math.exp(-((x - t) ** 2) / (2 * g) - ((xp - t) ** 2) / (2 * g) - (t * t) / (2 * u)), -60, 60, 12000);
  const k = integral / Math.sqrt(2 * Math.PI * u);
  const sigmaE = Math.pow(2 / g + 1 / u, -0.5);
  return Math.log(k) - Math.log(sigmaE / Math.sqrt(u));
}
/** E[a(x)a(x')] for a = relu(u x), u = +-1 with probability 1/2, then the covariance of the K1-unit network: sb2 + K1 * (sw2/K1) * E */
function toyKernel(sb2: number, sw2: number, x: number, xp: number): number {
  let E = 0;
  for (const u of [-1, 1]) E += 0.5 * Math.max(u * x, 0) * Math.max(u * xp, 0);
  const K1 = 400;
  return sb2 + K1 * (sw2 / K1) * E;
}

// ---------- plan sampling spaces and wrong routes ----------
const NONZERO3 = [-3, -2, -1, 1, 2, 3];
const NONZERO2 = [-2, -1, 1, 2];
type Space = { name: string; count: number; ok: (p: Record<string, number>) => boolean; key: (p: Record<string, number>) => string };

const toyRoutes = (p: Record<string, number>) => {
  const E = p.x * p.xp > 0 ? p.x * p.xp / 2 : 0;
  return { key: p.sb2 + p.sw2 * E, wrong: [p.sw2 * E, p.sb2 + p.sw2 * p.x * p.xp], gap: 0.5 };
};
const unscaledRoutes = (p: Record<string, number>) => ({
  key: p.sb2 + p.K1 * p.sw2 * p.m,
  wrong: [p.sb2 + p.sw2 * p.m, p.K1 * p.sw2 * p.m, p.K1 * (p.sb2 + p.sw2 * p.m)], gap: 0.5, // plan overview says 0.75 but the bias-dropped route differs by sb2 = 0.5 (plan arithmetic slip; the 72 sets all pass at 0.5)
});
const gaussRoutes = (p: Record<string, number>) => {
  const { g, u, x, xp } = p, ss = 2 * g + g * g / u, sm = 2 * u + g, d = x - xp;
  return {
    key: -x * x / (2 * sm) - d * d / (2 * ss) - xp * xp / (2 * sm),
    wrong: [
      -x * x / (2 * ss) - d * d / (2 * sm) - xp * xp / (2 * ss),
      -x * x / (2 * sm) - xp * xp / (2 * sm),
      -d * d / (2 * ss),
      -(x * x + d * d + xp * xp) / (2 * g),
      -x * x / (4 * u) - d * d / (2 * ss) - xp * xp / (4 * u),
      -x * x / sm - d * d / ss - xp * xp / sm,
      -x * x / (2 * sm) - d * d / (2 * ss),
    ], gap: 0.1 - 1e-9,
  };
};
const activeUnit = (p1: number, p2: number, x: number) => (p1 * x > 0 ? 1 : 2);
const outRoutes = (p: Record<string, number>) => {
  const { p1, p2, v1, v2, x, y } = p, a = activeUnit(p1, p2, x), pa = a === 1 ? p1 : p2, va = a === 1 ? v1 : v2;
  return { key: 0.5 * pa * pa * x * y, wrong: [pa * pa * x * y, 0.5 * (p1 * p1 + p2 * p2) * x * y, 0.5 * va * va * pa * pa * x * y, 0.5 * va * va * x * y], gap: 0.5 };
};
const inRoutes = (p: Record<string, number>) => {
  const { p1, p2, v1, v2, x, y } = p, a = activeUnit(p1, p2, x), pa = a === 1 ? p1 : p2, va = a === 1 ? v1 : v2;
  return { key: 0.5 * va * va * x * y, wrong: [va * va * x * y, 0.5 * va * va, 0.5 * (v1 * v1 + v2 * v2) * x * y, 0.5 * va * x * y, 0.5 * pa * pa * x * y], gap: 0.5 };
};
const challengeRoutes = (p: Record<string, number>) => {
  const ps = [p.p1, p.p2, p.p3, p.p4], vs = [p.v1, p.v2, p.v3, p.v4], { x, y } = p, xy = x * y;
  const A = [0, 1, 2, 3].filter(j => ps[j] * x > 0);
  const sum = (idx: number[], f: (j: number) => number) => idx.reduce((s, j) => s + f(j), 0);
  const all = [0, 1, 2, 3];
  const k1 = sum(A, j => ps[j] ** 2) * xy / 4, k0 = sum(A, j => vs[j] ** 2) * xy / 4, T = k1 + k0;
  return {
    key: T, na: A.length,
    wrong: [k1, k0, (sum(all, j => ps[j] ** 2) + sum(all, j => vs[j] ** 2)) * xy / 4, 4 * T, k1 + sum(A, j => vs[j]) * xy / 4, k1 + sum(A, j => vs[j] ** 2) / 4, sum(A, j => vs[j] ** 2 * ps[j] ** 2) * xy / 4 + k0],
    gap: 0.5 - 1e-9,
  };
};

function guardsHold(r: { key: number; wrong: number[]; gap: number }) { return r.wrong.every(w => Math.abs(w - r.key) >= r.gap); }

const toySpace: Space = {
  name: 'toy-kernel', count: 324,
  ok: p => [0.5, 1, 2].includes(p.sb2) && [1, 2, 4].includes(p.sw2) && NONZERO3.includes(p.x) && NONZERO3.includes(p.xp) && guardsHold(toyRoutes(p)),
  key: p => `${p.sb2},${p.sw2},${p.x},${p.xp}`,
};
const unscaledSpace: Space = {
  name: 'unscaled-var', count: 72,
  ok: p => [0.5, 1].includes(p.sb2) && [0.5, 1, 2].includes(p.sw2) && [0.5, 1, 2].includes(p.m) && [4, 5, 8, 10].includes(p.K1) && guardsHold(unscaledRoutes(p)),
  key: p => `${p.sb2},${p.sw2},${p.m},${p.K1}`,
};
const GU = [[1, 2], [2, 4], [1, 0.5], [2, 1], [4, 2]];
const gaussSpace: Space = {
  name: 'gauss-bump', count: 74,
  ok: p => GU.some(([g, u]) => g === p.g && u === p.u) && Number.isInteger(p.x) && Number.isInteger(p.xp) && Math.abs(p.x) <= 3 && Math.abs(p.xp) <= 3 && p.x !== p.xp
    && [1, 2, 4, 5, 10].includes(denominator(gaussRoutes(p).key)) && guardsHold(gaussRoutes(p)),
  key: p => `${p.g},${p.u},${p.x},${p.xp}`,
};
const ntkOutSpace: Space = {
  name: 'ntk-out', count: 4608,
  ok: p => ['p1', 'p2', 'v1', 'v2', 'x', 'y'].every(k => NONZERO3.includes(p[k])) && p.p1 * p.p2 < 0 && p.x * p.y > 0 && p.x * p.y <= 6
    && ((p.p1 * p.x > 0) !== (p.p2 * p.x > 0)) && (() => { const a = activeUnit(p.p1, p.p2, p.x), pa = a === 1 ? p.p1 : p.p2, va = a === 1 ? p.v1 : p.v2; return va * va !== 1 && va * va !== pa * pa; })() && guardsHold(outRoutes(p)),
  key: p => `${p.p1},${p.p2},${p.v1},${p.v2},${p.x},${p.y}`,
};
const ntkInSpace: Space = {
  name: 'ntk-in', count: 5040,
  ok: p => ['p1', 'p2', 'v1', 'v2', 'x', 'y'].every(k => NONZERO3.includes(p[k])) && p.p1 * p.p2 < 0 && p.x * p.y > 0 && p.x * p.y <= 6 && p.x * p.y !== 1
    && (() => { const a = activeUnit(p.p1, p.p2, p.x), pa = a === 1 ? p.p1 : p.p2, va = a === 1 ? p.v1 : p.v2; return va !== 1 && pa * pa !== va * va; })() && guardsHold(inRoutes(p)),
  key: p => `${p.p1},${p.p2},${p.v1},${p.v2},${p.x},${p.y}`,
};
const challengeSpace: Space = {
  name: 'challenge', count: 655360,
  ok: p => ['p1', 'p2', 'p3', 'p4', 'v1', 'v2', 'v3', 'v4'].every(k => NONZERO2.includes(p[k])) && NONZERO3.includes(p.x) && NONZERO3.includes(p.y) && p.x * p.y > 0
    && (() => { const r = challengeRoutes(p); return r.na >= 1 && r.na <= 3 && [1, 2, 4].includes(denominator(r.key)) && guardsHold(r); })(),
  key: p => `${p.p1},${p.p2},${p.p3},${p.p4},${p.v1},${p.v2},${p.v3},${p.v4},${p.x},${p.y}`,
};

function enumerate(domains: number[][], names: string[], visit: (p: Record<string, number>) => void) {
  const idx = domains.map(() => 0), p: Record<string, number> = {};
  for (;;) {
    names.forEach((n, i) => { p[n] = domains[i][idx[i]]; });
    visit(p);
    let k = names.length - 1;
    while (k >= 0 && ++idx[k] === domains[k].length) { idx[k] = 0; k--; }
    if (k < 0) return;
  }
}
const countSpace = (space: Space, domains: number[][], names: string[]) => { let n = 0; enumerate(domains, names, p => { if (space.ok(p)) n++; }); return n; };

// ---------- the audit contract ----------
const AUDITS: Record<string, { names: string[]; label: [string, string]; space: Space; domains: number[][] }> = {
  'toy-kernel': { names: ['sb2', 'sw2', 'x', 'xp'], label: ['k(x, x′)', 'k(x, x′)'], space: toySpace, domains: [[0.5, 1, 2], [1, 2, 4], NONZERO3, NONZERO3] },
  'unscaled-var': { names: ['sb2', 'sw2', 'm', 'K1'], label: ['Variance of z(x)', 'z(x) 的方差'], space: unscaledSpace, domains: [[0.5, 1], [0.5, 1, 2], [0.5, 1, 2], [4, 5, 8, 10]] },
  'gauss-bump': { names: ['g', 'u', 'x', 'xp'], label: ['ln k̃(x, x′)', 'ln k̃(x, x′)'], space: gaussSpace, domains: [[1, 2, 4], [0.5, 1, 2, 4], [-3, -2, -1, 0, 1, 2, 3], [-3, -2, -1, 0, 1, 2, 3]] },
  'ntk-out': { names: ['p1', 'p2', 'v1', 'v2', 'x', 'y'], label: ['k⁽¹⁾(x, y)', 'k⁽¹⁾(x, y)'], space: ntkOutSpace, domains: Array(6).fill(NONZERO3) },
  'ntk-in': { names: ['p1', 'p2', 'v1', 'v2', 'x', 'y'], label: ['k⁽⁰⁾(x, y)', 'k⁽⁰⁾(x, y)'], space: ntkInSpace, domains: Array(6).fill(NONZERO3) },
  'challenge': { names: ['p1', 'p2', 'p3', 'p4', 'v1', 'v2', 'v3', 'v4', 'x', 'y'], label: ['k(x, y)', 'k(x, y)'], space: challengeSpace, domains: [...Array(8).fill(NONZERO2), NONZERO3, NONZERO3] },
};
const NUMERIC = Object.keys(AUDITS);
const ALLOWED_DENOMINATORS: Record<string, number[]> = { 'toy-kernel': [1, 2], 'unscaled-var': [1, 2, 4, 5, 10], 'gauss-bump': [1, 2, 4, 5, 10], 'ntk-out': [1, 2], 'ntk-in': [1, 2], 'challenge': [1, 2, 4] };

/** what the oracle computes from the audit params of one numeric card */
function oracleValue(slug: string, p: Record<string, number>): number {
  switch (slug) {
    case 'toy-kernel': return toyKernel(p.sb2, p.sw2, p.x, p.xp);
    case 'unscaled-var': return unscaledVariance(p.sb2, p.sw2, p.m, p.K1);
    case 'gauss-bump': return gaussBumpLogK(p.g, p.u, p.x, p.xp);
    case 'ntk-out': return ntkByFiniteDifferences([p.p1, p.p2], [p.v1, p.v2], p.x, p.y, 'out');
    case 'ntk-in': return ntkByFiniteDifferences([p.p1, p.p2], [p.v1, p.v2], p.x, p.y, 'in');
    case 'challenge': return ntkByFiniteDifferences([p.p1, p.p2, p.p3, p.p4], [p.v1, p.v2, p.v3, p.v4], p.x, p.y, 'all');
  }
  throw new Error(slug);
}
type Routes = { key: number; wrong: number[]; gap: number };
const ROUTE_FNS: Record<string, (p: Record<string, number>) => Routes> = { 'toy-kernel': toyRoutes, 'unscaled-var': unscaledRoutes, 'gauss-bump': gaussRoutes, 'ntk-out': outRoutes, 'ntk-in': inRoutes, challenge: challengeRoutes };
const routesOf = (slug: string, p: Record<string, number>): Routes => ROUTE_FNS[slug](p);
const withValue = (card: PracticeCard, v: number) => gradeCard(card, [String(v)], null, []);

describe('GP-24 deck structure', () => {
  it('has the nine cards of the plan in order, with plan titles and no figures', () => {
    const TITLES: Record<string, [string, string]> = {
      'bnn-limit': ['What the prior becomes', '先验变成什么'], 'toy-kernel': ['The kernel of a ReLU network', '线性整流网络的核'],
      'unscaled-var': ['What if the 1/K₁ is forgotten?', '忘了 1/K₁ 会怎样？'], 'act-kernel': ['Which activation, which kernel', '哪种激活，哪种核'],
      'gauss-bump': ['The Gaussian-bump kernel', '高斯凸起核'], 'ntk-out': ['The output-layer kernel', '输出层的核'], 'ntk-in': ['The input-layer kernel', '输入层的核'],
      'ntk-lazy': ['The kernel at large width', '大宽度下的核'], 'challenge': ['Challenge: the whole kernel', '挑战：完整的核'],
    };
    seeds.forEach((_, i) => {
      expect(decks.en[i].map(c => c.id)).toEqual(SLUGS.map(s => `GP-24-${s}`));
      expect(decks.zh[i].map(c => c.id)).toEqual(SLUGS.map(s => `GP-24-${s}`));
      SLUGS.forEach(s => {
        expect(cardOf(decks.en[i], s).title).toBe(TITLES[s][0]);
        expect(cardOf(decks.zh[i], s).title).toBe(TITLES[s][1]);
      });
      for (const lang of ['en', 'zh'] as const) for (const c of decks[lang][i]) {
        expect(c.figure, `${c.id} must have no figure`).toBeUndefined();
        expect(c.choice?.figures, `${c.id} must have no option figures`).toBeUndefined();
        expect(c.slots, `${c.id} must not be a symbol card`).toBeUndefined();
      }
    });
  });
});

describe('GP-24 numeric cards: independent recomputation through gradeCard', () => {
  for (const slug of NUMERIC) {
    it(`${slug}: audit kind and params, oracle value, tolerance 0.006, grading both ways`, () => {
      const spec = AUDITS[slug];
      each(slug, (en, zh, i) => {
        const at = where(en, i);
        expect(en.audit?.kind, at).toBe(`GP-24:${slug}`);
        expect(Object.keys(en.audit!.params).sort(), at).toEqual([...spec.names].sort());
        expect(zh.audit, at).toEqual(en.audit);
        const p = en.audit!.params as Record<string, number>;
        expect(en.fields, at).toHaveLength(1);
        expect(en.fields![0].label, `${at} EN label`).toBe(spec.label[0]);
        expect(zh.fields![0].label, `${at} ZH label`).toBe(spec.label[1]);
        for (const c of [en, zh]) expect(c.fields![0].tolerance, `${at} tolerance`).toBe(0.006);
        expect(zh.fields![0].answer, at).toBe(en.fields![0].answer);
        const truth = oracleValue(slug, p);
        const answer = en.fields![0].answer;
        expect(Math.abs(truth - answer), `${at}: oracle ${truth} vs card ${answer}`).toBeLessThan(slug === 'gauss-bump' ? 1e-6 : 1e-7);
        expect(ALLOWED_DENOMINATORS[slug], `${at}: key ${answer} denominator`).toContain(denominator(answer));
        // grade the oracle value (independent route) and the perturbed answers
        for (const c of [en, zh]) {
          expect(withValue(c, Number(truth.toFixed(6))), `${at} oracle value should grade correct`).toBe('correct');
          expect(c && gradeCard(c, [truth.toFixed(2)], null, []), `${at} 2-decimal form`).toBe('correct');
          expect(withValue(c, truth + 0.005), `${at} inside tolerance`).toBe('correct');
          expect(withValue(c, truth - 0.005), `${at} inside tolerance`).toBe('correct');
          expect(withValue(c, truth + 0.0065), `${at} +0.0065 should be wrong`).toBe('incorrect');
          expect(withValue(c, truth - 0.0065), `${at} −0.0065 should be wrong`).toBe('incorrect');
          expect(withValue(c, truth + 0.02), `${at} +0.02`).toBe('incorrect');
          expect(withValue(c, truth - 0.02), `${at} −0.02`).toBe('incorrect');
          const fraction = forms(answer).find(f => f.includes('/'));
          if (fraction) expect(gradeCard(c, [fraction], null, []), `${at} fraction ${fraction}`).toBe('correct');
        }
      });
    });
  }

  it('the plan prompt endings, EN and ZH', () => {
    for (const slug of NUMERIC) each(slug, (en, zh, i) => {
      expect(en.prompt.endsWith('Give an integer, a fraction or a decimal rounded to 2 places.'), where(en, i)).toBe(true);
      expect(zh.prompt.endsWith('请填整数、分数，或保留 2 位小数的小数。'), where(zh, i)).toBe(true);
    });
  });
});

describe('GP-24 printed text equals audit params (EN and ZH)', () => {
  const readers: Record<string, (text: string) => Record<string, number>> = {
    'toy-kernel': t => ({ sb2: printed(t, 'σ_b²'), sw2: printed(t, 'σ_w²'), x: printed(t, 'x'), xp: printed(t, 'x′') }),
    'unscaled-var': t => ({ sb2: printed(t, 'σ_b²'), sw2: printed(t, 'σ_w²'), m: printed(t, 'E[a(x)²]'), K1: printed(t, 'K₁') }),
    'gauss-bump': t => ({ g: printed(t, 'σ_g²'), u: printed(t, 'σ_u²'), x: printed(t, 'x'), xp: printed(t, 'x′') }),
    'ntk-out': t => { const p = vector(t, 'w⁽⁰⁾'), v = vector(t, 'w⁽¹⁾'); return { p1: p[0], p2: p[1], v1: v[0], v2: v[1], x: printed(t, 'x'), y: printed(t, 'y') }; },
    'ntk-in': t => { const p = vector(t, 'w⁽⁰⁾'), v = vector(t, 'w⁽¹⁾'); return { p1: p[0], p2: p[1], v1: v[0], v2: v[1], x: printed(t, 'x'), y: printed(t, 'y') }; },
    'challenge': t => { const p = vector(t, 'w⁽⁰⁾'), v = vector(t, 'w⁽¹⁾'); expect(p).toHaveLength(4); expect(v).toHaveLength(4); return { p1: p[0], p2: p[1], p3: p[2], p4: p[3], v1: v[0], v2: v[1], v3: v[2], v4: v[3], x: printed(t, 'x'), y: printed(t, 'y') }; },
  };
  for (const slug of NUMERIC) it(`${slug}: sampled numbers in the prompt are the audit params`, () => {
    each(slug, (en, zh, i) => {
      expect(readers[slug](en.prompt), `${where(en, i)} EN`).toEqual(en.audit!.params);
      expect(readers[slug](zh.prompt), `${where(zh, i)} ZH`).toEqual(en.audit!.params);
    });
  });
  it('the fixed counts K = 2 (cards 6, 7) and K = 4 (card 9) are printed', () => {
    each('ntk-out', (en, zh) => { expect(en.prompt).toContain('K = 2'); expect(zh.prompt).toContain('K = 2'); });
    each('ntk-in', (en, zh) => { expect(en.prompt).toContain('K = 2'); expect(zh.prompt).toContain('K = 2'); });
    each('challenge', (en, zh) => { expect(en.prompt).toContain('K = 4'); expect(zh.prompt).toContain('K = 4'); });
  });
});

describe('GP-24 wrong routes and sampling spaces', () => {
  it('plan counts of the sampling spaces, enumerated independently', () => {
    expect(countSpace(toySpace, AUDITS['toy-kernel'].domains, AUDITS['toy-kernel'].names)).toBe(324);
    expect(countSpace(unscaledSpace, AUDITS['unscaled-var'].domains, AUDITS['unscaled-var'].names)).toBe(72);
    const perPair: Record<string, number> = {};
    let gauss = 0;
    enumerate(AUDITS['gauss-bump'].domains, AUDITS['gauss-bump'].names, p => { if (gaussSpace.ok(p)) { gauss++; perPair[`${p.g},${p.u}`] = (perPair[`${p.g},${p.u}`] ?? 0) + 1; } });
    expect(gauss).toBe(74);
    expect(perPair).toEqual({ '1,2': 28, '2,4': 12, '1,0.5': 14, '2,1': 14, '4,2': 6 });
    expect(countSpace(ntkOutSpace, AUDITS['ntk-out'].domains, AUDITS['ntk-out'].names)).toBe(4608);
    expect(countSpace(ntkInSpace, AUDITS['ntk-in'].domains, AUDITS['ntk-in'].names)).toBe(5040);
    let withNa = 0;
    enumerate(AUDITS.challenge.domains, AUDITS.challenge.names, p => { if (p.x * p.y > 0) { const na = [p.p1, p.p2, p.p3, p.p4].filter(q => q * p.x > 0).length; if (na >= 1 && na <= 3) withNa++; } });
    expect(withNa).toBe(1032192);
    expect(countSpace(challengeSpace, AUDITS.challenge.domains, AUDITS.challenge.names)).toBe(655360);
  }, 120_000);

  for (const slug of NUMERIC) it(`${slug}: every drawn set is in the plan space and every wrong route differs from the key`, () => {
    each(slug, (en, _zh, i) => {
      const p = en.audit!.params as Record<string, number>, at = where(en, i), r = routesOf(slug, p);
      expect(AUDITS[slug].space.ok(p), `${at} not in the plan space`).toBe(true);
      expect(Math.abs(r.key - en.fields![0].answer), at).toBeLessThan(1e-9);
      r.wrong.forEach((w, k) => expect(Math.abs(w - en.fields![0].answer), `${at} wrong route #${k + 1} = ${w} vs key ${en.fields![0].answer}`).toBeGreaterThanOrEqual(r.gap));
      // and no wrong route is accepted by the grader
      for (const c of [en, _zh]) r.wrong.forEach(w => expect(withValue(c, w), `${at} wrong route ${w} accepted`).toBe('incorrect'));
    });
  });

  it('the pre-activations of cards 6, 7 and 9 are never 0 and the inactive units are off at both inputs', () => {
    for (const slug of ['ntk-out', 'ntk-in', 'challenge']) each(slug, (en, _z, i) => {
      const p = en.audit!.params as Record<string, number>;
      const ps = Object.keys(p).filter(k => k.startsWith('p')).map(k => p[k]);
      ps.forEach(q => { expect(q * p.x, where(en, i)).not.toBe(0); expect(q * p.y, where(en, i)).not.toBe(0); expect(Math.sign(q * p.x), where(en, i)).toBe(Math.sign(q * p.y)); });
    });
  });

  it('draws cover each small plan space completely (324, 72, 74 sets) and stay inside the large ones', () => {
    const N = 9000;
    const found: Record<string, Set<string>> = { 'toy-kernel': new Set(), 'unscaled-var': new Set(), 'gauss-bump': new Set() };
    const bigSeen: Record<string, Set<string>> = { 'ntk-out': new Set(), 'ntk-in': new Set(), challenge: new Set() };
    const marginals: Record<string, Record<string, Set<number>>> = { 'ntk-out': {}, 'ntk-in': {}, challenge: {} };
    const actives: Record<string, Set<string>> = { 'ntk-out': new Set(), 'ntk-in': new Set(), challenge: new Set() };
    for (let k = 0; k < N; k++) {
      const deck = gp24(spreadSeed(k + 1000), 'en');
      for (const slug of [...Object.keys(found), ...Object.keys(bigSeen)]) {
        const p = cardOf(deck, slug).audit!.params as Record<string, number>;
        expect(AUDITS[slug].space.ok(p), `${slug} draw ${k} outside the plan space: ${JSON.stringify(p)}`).toBe(true);
        if (found[slug]) found[slug].add(AUDITS[slug].space.key(p));
        else {
          bigSeen[slug].add(AUDITS[slug].space.key(p));
          for (const [name, value] of Object.entries(p)) (marginals[slug][name] ??= new Set()).add(value);
          const ps = Object.keys(p).filter(n => /^p\d$/.test(n)).map(n => p[n]);
          actives[slug].add(ps.map(q => (q * p.x > 0 ? 1 : 0)).join(''));
        }
      }
    }
    expect(found['toy-kernel'].size).toBe(324);
    expect(found['unscaled-var'].size).toBe(72);
    expect(found['gauss-bump'].size).toBe(74);
    for (const slug of Object.keys(bigSeen)) {
      expect(bigSeen[slug].size, `${slug} distinct sets drawn`).toBeGreaterThan(Math.min(N * 0.45, AUDITS[slug].space.count * 0.5));
      const domains = Object.fromEntries(AUDITS[slug].names.map((n, i) => [n, AUDITS[slug].domains[i]]));
      for (const [name, values] of Object.entries(marginals[slug])) {
        const wanted = slug === 'challenge' && /^[pv]/.test(name) ? NONZERO2 : domains[name];
        expect([...values].sort((a, b) => a - b), `${slug} ${name} values reached`).toEqual([...wanted].sort((a, b) => a - b));
      }
    }
    expect(actives['ntk-out'].size).toBe(2);
    expect(actives['ntk-in'].size).toBe(2);
    // every active pattern with 1..3 active units must be reachable in the challenge: C(4,1)+C(4,2)+C(4,3) = 14 patterns
    expect(actives.challenge.size).toBe(14);
  }, 600_000);
});

describe('GP-24 choice cards', () => {
  const ACT_EN = ['ReLU', 'step', 'sigmoid'], ACT_ZH = ['线性整流函数', '阶跃函数', '误差函数型饱和函数'];
  const actOf = (prompt: string, lang: GameLanguage) => {
    const names = lang === 'en' ? ACT_EN : ACT_ZH;
    const hits = names.filter(n => (lang === 'en' ? new RegExp(String.raw`\b${n}\b`) : new RegExp(n)).test(prompt));
    expect(hits, `exactly one activation in: ${prompt.slice(0, 100)}`).toHaveLength(1);
    return names.indexOf(hits[0]);
  };
  function checkChoice(slug: string, classify: (option: string, lang: GameLanguage) => string, categories: string[], correct: string) {
    const answerIndices = new Set<number>();
    each(slug, (en, zh, i) => {
      const at = `${en.id} seed#${i}`;
      expect(en.audit, at).toBeUndefined();
      expect(en.choice!.options, at).toHaveLength(4);
      for (const [lang, c] of [['en', en], ['zh', zh]] as const) {
        const cats = c.choice!.options.map(o => classify(o, lang));
        expect([...cats].sort(), `${at} ${lang}: one option per misconception`).toEqual([...categories].sort());
        expect(cats[c.choice!.answer], `${at} ${lang}: answer index ${c.choice!.answer} does not point to the correct option`).toBe(correct);
        const lens = c.choice!.options.map(len), right = lens[c.choice!.answer];
        const longestWrong = Math.max(...lens.filter((_, k) => k !== c.choice!.answer));
        expect(right, `${at} ${lang}: correct option (${right}) must be shorter than the longest wrong option (${longestWrong})`).toBeLessThan(longestWrong);
        expect(gradeCard(c, [], c.choice!.answer, [])).toBe('correct');
        for (let k = 0; k < 4; k++) if (k !== c.choice!.answer) expect(gradeCard(c, [], k, [])).toBe('incorrect');
      }
      expect(zh.choice!.answer, at).toBe(en.choice!.answer);
      answerIndices.add(en.choice!.answer);
    });
    expect(answerIndices.size, `${slug}: options are shuffled`).toBeGreaterThanOrEqual(3);
  }

  it('bnn-limit: the CLT option is the only correct one, on all 6 (activation, K₁) draws', () => {
    const classify = (o: string, lang: GameLanguage) => {
      if (lang === 'en') return /jointly Gaussian with mean 0/.test(o) ? 'clt' : /law of large numbers/.test(o) ? 'lln' : /non-Gaussian, because/.test(o) ? 'nonlinear' : /only after training/.test(o) ? 'training' : 'unknown';
      return /均值为 0 的联合高斯分布/.test(o) ? 'clt' : /大数定律/.test(o) ? 'lln' : /保持非高斯/.test(o) ? 'nonlinear' : /只有在训练之后/.test(o) ? 'training' : 'unknown';
    };
    checkChoice('bnn-limit', classify, ['clt', 'lln', 'nonlinear', 'training'], 'clt');
    const combos = new Set<string>();
    each('bnn-limit', (en, zh) => {
      const a = actOf(en.prompt, 'en'), K1 = printed(en.prompt, 'K₁');
      expect([100, 10000]).toContain(K1);
      expect(printed(zh.prompt, 'K₁')).toBe(K1);
      expect(actOf(zh.prompt, 'zh')).toBe(a);
      // the non-linearity option names the same activation as the prompt
      const w2en = en.choice!.options.find(o => /non-linear/.test(o))!, w2zh = zh.choice!.options.find(o => /保持非高斯/.test(o))!;
      expect(w2en).toContain(ACT_EN[a] === 'step' ? 'step' : ACT_EN[a]);
      expect(w2zh).toContain(ACT_ZH[a]);
      combos.add(`${a},${K1}`);
    });
    expect(combos.size).toBe(6);
  });

  it('act-kernel: activation ↔ kernel pairs of Lecture 8 p. 18 in both forms', () => {
    const KERNEL_EN = ['ArcCos-1 kernel', 'ArcCos-0 kernel', 'NN kernel'], KERNEL_ZH = ['1 阶反余弦核', '0 阶反余弦核', '神经网络核'];
    const OPT_B_EN = ['ReLU', 'step', 'sigmoid (for example erf)'], OPT_B_ZH = ['线性整流函数', '阶跃函数', '误差函数型饱和函数'];
    const BUMP_EN = 'Gaussian bump exp(−(x − u)²/(2σ_g²))', BUMP_ZH = '高斯凸起函数 exp(−(x − u)²/(2σ_g²))';
    const MSE_EN = 'modulated squared exponential kernel (non-stationary)', MSE_ZH = '调制的平方指数核（非平稳）';
    const seen = new Set<string>();
    each('act-kernel', (en, zh, i) => {
      const at = `${en.id} seed#${i}`;
      expect(en.audit, at).toBeUndefined();
      const formB = /Which activation/.test(en.prompt);
      expect(/哪种激活函数/.test(zh.prompt), at).toBe(formB);
      if (!formB) expect(en.prompt).toContain('which covariance function');
      for (const [lang, c] of [['en', en], ['zh', zh]] as const) {
        const KN = lang === 'en' ? KERNEL_EN : KERNEL_ZH, OB = lang === 'en' ? OPT_B_EN : OPT_B_ZH;
        let item: number, expected: string, universe: string[];
        if (!formB) {
          item = actOf(c.prompt, lang); expected = KN[item]; universe = [...KN, lang === 'en' ? MSE_EN : MSE_ZH];
        } else {
          const hits = KN.map((k, n) => (lang === 'en' ? c.prompt.includes(k) : new RegExp(String.raw`(?<![\d])${k}`).test(c.prompt)) ? n : -1).filter(n => n >= 0);
          expect(hits, `${at} ${lang}: exactly one kernel named in the prompt`).toHaveLength(1);
          item = hits[0]; expected = OB[item]; universe = [...OB, lang === 'en' ? BUMP_EN : BUMP_ZH];
        }
        expect([...c.choice!.options].sort(), `${at} ${lang} options`).toEqual([...universe].sort());
        const satisfying = c.choice!.options.map((o, k) => (o === expected ? k : -1)).filter(k => k >= 0);
        expect(satisfying, `${at} ${lang}: exactly one option satisfies the pair table`).toHaveLength(1);
        expect(c.choice!.answer, `${at} ${lang} answer index`).toBe(satisfying[0]);
        const lens = c.choice!.options.map(len), longestWrong = Math.max(...lens.filter((_, k) => k !== c.choice!.answer));
        expect(lens[c.choice!.answer], `${at} ${lang} correct option must be shorter than the longest wrong one`).toBeLessThan(longestWrong);
        if (lang === 'en') seen.add(`${formB ? 'B' : 'A'}${item}`);
      }
      expect(zh.choice!.answer, at).toBe(en.choice!.answer);
    });
    expect(seen.size, 'all six (form, item) draws appear').toBe(6);
  });

  it('ntk-lazy: the law-of-large-numbers option is the only correct one, on all 6 (activation, K) draws', () => {
    const classify = (o: string, lang: GameLanguage) => {
      if (lang === 'en') return /settles at one fixed number/.test(o) ? 'fixed' : /stays random/.test(o) ? 'random' : /tends to 0 for every pair/.test(o) ? 'zero' : /grows without bound/.test(o) ? 'grows' : 'unknown';
      return /趋于一个固定的数/.test(o) ? 'fixed' : /仍是随机/.test(o) ? 'random' : /都趋于 0/.test(o) ? 'zero' : /无限增大/.test(o) ? 'grows' : 'unknown';
    };
    checkChoice('ntk-lazy', classify, ['fixed', 'random', 'zero', 'grows'], 'fixed');
    const combos = new Set<string>();
    each('ntk-lazy', (en, zh) => {
      const a = actOf(en.prompt, 'en'), K = printed(en.prompt, 'K');
      expect([100, 10000]).toContain(K);
      expect(printed(zh.prompt, 'K')).toBe(K);
      expect(actOf(zh.prompt, 'zh')).toBe(a);
      combos.add(`${a},${K}`);
    });
    expect(combos.size).toBe(6);
  });
});

describe('GP-24 learner-visible text', () => {
  const ALL: [GameLanguage, PracticeCard, number][] = [];
  for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => deck.forEach(c => ALL.push([lang, c, i])));
  const check = (name: string, bad: (text: string, lang: GameLanguage, card: PracticeCard) => string | null) => {
    it(name, () => {
      const hits = new Map<string, string>();
      for (const [lang, c] of ALL) for (const text of textOf(c)) {
        const m = bad(text, lang, c);
        if (m) { const key = `${c.id} [${lang}] ${m}`; if (!hits.has(key)) hits.set(key, text.slice(0, 160)); }
      }
      expect([...hits].map(([k, v]) => `${k}: ${v}`)).toEqual([]);
    });
  };
  const CJK = /[㐀-鿿]/;
  const found = (t: string, patterns: [string, RegExp][]) => {
    for (const [name, re] of patterns) { const m = re.exec(t); if (m) return `${name}: …${t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20)}…`; }
    return null;
  };
  check('Unicode only: no ASCII minus, caret, unevaluated leftovers, developer markers or raw floats', t => found(t, [
    ['ASCII hyphen as minus', /(?:^|[\s(,=+·×/-])-\d/],
    ['caret', /\^/],
    ['leftover/developer marker', /[{}]|\$\{|undefined|\bNaN\b|\[object|Infinity|TODO|FIXME/],
    ['code name', /\b(?:sb2|sw2|xp|p[1-4]|v[1-4]|m1|K1|ia|ib|pa|pb|va|vb)\b/],
    ['raw float', /\d\.\d{3,}/],
    ['ASCII operator or constant', /\d\*\d|\d\s\*\s\d|\bsqrt\(|\bpi\b/],
  ]));
  check('no double parentheses, unparenthesised negative after an operator, "1·" coefficient or "x = x" restatement', t => found(t, [
    ['double parentheses around a coordinate', /\(\(−?\d+(?:\.\d+)?\),|, \(−?\d+(?:\.\d+)?\)\)/],
    ['unparenthesised negative after an operator', /[·×]\s?−\d/],
    ['coefficient 1·', /(?<![\d.\w/(])1·(?=[A-Za-zσ])/],
    ['x = x restatement', /(?:^|[\s(,])(\S+) = \1(?=[\s,)。，；]|\.(?!\d)|$)/],
  ]));
  check('no double spaces, no space before punctuation, no repeated "A or A"', t => found(t, [
    ['double space', /\S {2,}\S/],
    ['space before punctuation', / [.,;。，；]/],
    ['"X or X" with identical values', /would give (\S+) or \1(?![\d/])|会得到 (\S+) 或 \2(?![\d/])/],
  ]));
  check('fractions are reduced and a sentence uses one number style', t => {
    for (const m of t.matchAll(/(?<![\d./])(\d+)\/(\d+)(?![\d./])/g)) if (gcd(Number(m[1]), Number(m[2])) !== 1 || Number(m[2]) === 1) return `unreduced fraction ${m[0]}`;
    const sentences = t.replace(/\(1\/[24]\)/g, '').replace(/\b1\/2 each|各 1\/2/g, '').split(/(?<=[。；])|(?<=\.)\s+/);
    for (const s of sentences) if (/(?<![\d./])\d+\/\d+(?![\d./])/.test(s) && /\d\.\d/.test(s)) return `fraction and decimal in one sentence: ${s.slice(0, 80)}`;
    return null;
  });
  check('ZH: no English words (only exp, ln, log, GP, KL, ELBO), no ASCII quotes, comma or period in prose, full-width parentheses outside formulas', (t, lang) => {
    if (lang !== 'zh') return null;
    const stripped = t.replace(/\b(?:exp|ln|log|GP|KL|ELBO)\b/g, '');
    const word = stripped.match(/[A-Za-z]{2,}/);
    if (word) return `English word "${word[0]}"`;
    if (/["']/.test(t)) return 'ASCII quote';
    if (CJK.test(t)) {
      if (/[㐀-鿿],|,[㐀-鿿]/.test(t)) return 'ASCII comma next to Chinese';
      if (/[㐀-鿿]\.|\.$/.test(t)) return 'ASCII period in prose';
      if (/[㐀-鿿]\(|\)[㐀-鿿]/.test(t)) return 'ASCII parenthesis next to Chinese (use full-width)';
      if (/[㐀-鿿][;:?!]|[;:?!][㐀-鿿]/.test(t)) return 'ASCII punctuation next to Chinese';
    }
    return null;
  });
  check('ZH text has no Latin ReLU, max, step, sigmoid or NN', (t, lang) => (lang === 'zh' && /ReLU|max|step|sigmoid|\bNN\b|ArcCos|kernel/i.test(t) ? 'English term in ZH' : null));
  check('no empty text and hint differs from explanation', (t, _l, c) => (!t.trim() && t !== '' ? 'blank text' : c.hint === c.explanation ? 'hint equals explanation' : null));

  it('explanations print the key; hints never contain it', () => {
    for (const slug of NUMERIC) each(slug, (en, zh, i) => {
      const answer = en.fields![0].answer, at = where(en, i);
      for (const c of [en, zh]) {
        expect(forms(answer).some(f => containsNumber(c.explanation, f)), `${at}: explanation lacks the key ${forms(answer).join(' or ')}`).toBe(true);
        if (Math.abs(answer) > 1) for (const f of forms(answer)) expect(containsNumber(c.hint, f), `${at}: hint contains the key ${f}`).toBe(false);
      }
    });
  });
  it('the explanations of cards 1, 4, 5, 8, 9 close with what the game does not assess', () => {
    for (const slug of ['bnn-limit', 'act-kernel', 'gauss-bump', 'ntk-lazy', 'challenge']) each(slug, (en, zh) => {
      expect(en.explanation).toMatch(/This game does not assess/);
      expect(zh.explanation).toMatch(/本游戏不考查/);
    });
  });
  it('prompts state the quantities the plan requires (ReLU defined, derivative convention printed, bias scaling stated)', () => {
    each('toy-kernel', (en, zh) => { expect(en.prompt).toContain('max(t, 0)'); expect(zh.prompt).toContain('t > 0 时等于 t'); expect(zh.prompt).not.toMatch(/max/); });
    each('ntk-in', (en, zh) => { expect(en.prompt).toContain('σ′(t) = 1 for t > 0'); expect(zh.prompt).toContain('σ′(t) = 1'); });
    each('challenge', (en, zh) => { expect(en.prompt).toContain('σ′(t) = 1 for t > 0'); expect(zh.prompt).toContain('σ′(t) = 1'); });
    each('unscaled-var', (en) => { expect(en.prompt).toContain('no division by K₁'); });
    each('gauss-bump', (en, zh) => { expect(en.prompt).toContain('σ_s² = 2σ_g² + σ_g⁴/σ_u²'); expect(zh.prompt).toContain('σ_m² = 2σ_u² + σ_g²'); });
  });
});

describe('GP-24 shared structural gates', () => {
  it('deckProblems and textLintProblems report nothing', () => {
    expect(deckProblems('GP-24', gp24, 'topic', 200)).toEqual([]);
    expect(textLintProblems('GP-24', gp24, 200)).toEqual([]);
  });
});

describe('GP-24 variety', () => {
  for (const slug of SLUGS) it(`${slug}: at least 6 distinct prompts over ${SEEDS} seeds`, () => {
    const prompts = new Set(decks.en.map(d => cardOf(d, slug).prompt));
    expect(prompts.size).toBeGreaterThanOrEqual(6);
  });
});
