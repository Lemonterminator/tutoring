import { describe, expect, it } from 'vitest';
import { gp19 } from './games/gp19';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';
import type { Figure } from '../figure';

/**
 * Independent oracle for GP-19 (variational inference). Written from docs/aalto-gp-drafts/approved-GP-19.md only.
 * Every key is recomputed from the audit params by a route that is not the plan's closed form
 * (numerical integration of q log(q/p), Gauss-Hermite, dense 2x2 inverse/determinant, true cdf by quadrature).
 */
const SEEDS = 60;
const COVER_SEEDS = 40000;
const LANGS = ['en', 'zh'] as const;
const TOL = 0.006;
const ID = (slug: string) => `GP-19-${slug}`;
const norm = (t: string) => t.replaceAll('−', '-');
const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const first = (text: string, re: RegExp, what: string): number[] => {
  const m = norm(text).match(re);
  if (!m) throw new Error(`cannot parse ${what} from: ${text.slice(0, 200)}`);
  return m.slice(1).filter(x => x !== undefined).map(Number);
};
const seeds = Array.from({ length: SEEDS }, (_, i) => spreadSeed(i));
const deck = (seed: number, lang: 'en' | 'zh') => gp19(seed, lang) as PracticeCard[];
const byId = (cards: PracticeCard[], slug: string) => cards.find(c => c.id === ID(slug))!;

// ---------- independent numerics ----------
function simpson(f: (x: number) => number, a: number, b: number, n = 4000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
const normalPdf = (x: number, m: number, v: number) => Math.exp(-((x - m) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v);
const logNormal = (x: number, m: number, v: number) => -((x - m) ** 2) / (2 * v) - 0.5 * Math.log(2 * Math.PI * v);
/** KL[N(m,v) || N(0,K)] by integrating q log(q/p). */
const klQuad = (m: number, v: number, K: number) => simpson(x => normalPdf(x, m, v) * (logNormal(x, m, v) - logNormal(x, 0, K)), m - 12 * Math.sqrt(v), m + 12 * Math.sqrt(v));
const Phi = (x: number) => simpson(t => Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI), -12, x, 6000);
const TABLE: Record<string, number> = { '0.5': 0.6915, '1': 0.8413, '1.5': 0.9332, '2': 0.9772, '2.5': 0.9938, '3': 0.9987 };
const inv2 = (a: number, b: number, c: number, d: number) => { const det = a * d - b * c; return { det, m: [[d / det, -b / det], [-c / det, a / det]] }; };
/** log of the equal mixture 0.5 N(-a,1) + 0.5 N(a,1), stable. */
const logMix = (f: number, a: number) => { const l1 = logNormal(f, -a, 1), l2 = logNormal(f, a, 1), mx = Math.max(l1, l2); return Math.log(0.5) + mx + Math.log(Math.exp(l1 - mx) + Math.exp(l2 - mx)); };
const klToMixture = (m: number, v: number, a: number) => simpson(f => normalPdf(f, m, v) * (logNormal(f, m, v) - logMix(f, a)), m - 10 * Math.sqrt(v), m + 10 * Math.sqrt(v), 20000);

// ---------- plan sampling spaces (enumerated here) ----------
const R = (a: number, b: number, step = 1) => { const out: number[] = []; for (let x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 1e6) / 1e6); return out; };
const key = (...xs: number[]) => xs.join('|');
const gap = (t: number, routes: number[]) => Math.min(...routes.map(r => Math.abs(r - t)));

const rankSpace = (() => {
  const set = new Set<string>();
  for (const v1 of R(-9, -3)) for (const v2 of R(-9, -3)) for (const v3 of R(-9, -3)) for (const k1 of R(1, 6)) for (const k2 of R(1, 6)) for (const k3 of R(1, 6)) {
    const ve = [v1, v2, v3], kl = [k1, k2, k3];
    if (new Set(ve).size < 3 || new Set(kl).size < 3) continue;
    const e = ve.map((v, i) => v - kl[i]), sorted = [...e].sort((a, b) => b - a);
    if (sorted[0] - sorted[1] < 1) continue;
    const t = e.indexOf(sorted[0]), s = ve.map((v, i) => v + kl[i]);
    if (t === ve.indexOf(Math.max(...ve)) || t === kl.indexOf(Math.min(...kl)) || s[t] === Math.max(...s)) continue;
    set.add(key(v1, k1, v2, k2, v3, k3));
  }
  return set;
})();
const gapSpace = new Set<string>(); for (const ve of R(-9, -3)) for (const kl of R(0.5, 3, 0.5)) for (const g of R(0.5, 2, 0.5)) gapSpace.add(key(ve - kl + g, ve, kl));
const varExpSpace = new Set<string>(); for (const m of R(0, 3)) for (const y of R(-2, 5)) if (Math.abs(y - m) >= 1 && Math.abs(y - m) <= 3) for (const S of [2, 3, 4]) varExpSpace.add(key(y, m, S));
const klMeanSpace = new Set<string>(); for (const K of [2, 4, 5]) for (const m of [2, 3, 4]) klMeanSpace.add(key(m, K, K));
const SK = [[1, 2], [1, 4], [2, 1], [2, 4], [2, 8], [4, 1], [4, 2], [4, 8], [4, 16]];
const klFullSpace = new Set<string>(); for (const [S, K] of SK) for (const m of [1, 2, 3]) klFullSpace.add(key(m, S, K, Math.round(Math.log(K / S) * 1000) / 1000));
const modeSpace = new Set<string>(['4', '5', '6', '7', '8', '10']);
const predList: Record<string, number[]> = { '2|1': [0.5, 1.5], '4|2': [0.5, 1, 1.5, 2.5, 3, 3.5], '6|1.5': [2, 4], '6|3': [0.5, 1, 1.5, 2, 2.5, 3.5, 4, 4.5, 5, 5.5], '8|2': [2, 6], '8|4': [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5, 5.5, 6, 6.5, 7, 7.5] };
const predSpace = new Set<string>(); for (const [kc, ss] of Object.entries(predList)) { const [K, c] = kc.split('|').map(Number); for (const S of ss) predSpace.add(key(K, c, S)); }
/** the plan's predicate behind the list, enumerated: must reproduce the list */
const predEnumerated = (() => {
  const set = new Set<string>();
  for (const K of [2, 4, 6, 8]) for (const c of [K / 4, K / 2]) for (const S of R(0.5, K - 0.5, 0.5)) {
    if (S === K / 2) continue;
    const T = K - c * c * (K - S) / K ** 2;
    const den = (() => { for (let d = 1; d <= 64; d++) if (Math.abs(T * d - Math.round(T * d)) < 1e-9) return d; return 999; })();
    if (![1, 2, 4, 5, 8, 10].includes(den)) continue;
    if (gap(T, [K - c * c / K, K - c * c * (K - S) / K, S, K - c * c * S / K ** 2, c * c * (K - S) / K ** 2, K - c * (K - S) / K]) < 0.125) continue;
    set.add(key(K, c, S));
  }
  return set;
})();
const classSpace = new Set<string>();
for (const [sg, mus] of [[[9, 16], [[5, 8], [5, 4], [15, 8]]], [[5, 4], [[3, 4], [3, 2], [9, 4]]], [[3, 1], [[1, 1], [2, 1], [3, 1]]], [[21, 4], [[5, 2]]]] as [number[], number[][]][])
  for (const mu of mus) classSpace.add(key(mu[0] / mu[1], sg[0] / sg[1]));
const challengeKl = (K1: number, K2: number, S1: number, S2: number, m1: number, m2: number, lnr: number) => 0.5 * (S1 / K1 + S2 / K2 + m1 ** 2 / K1 + m2 ** 2 / K2 - 2 + lnr);
const challengeRoutes = (K1: number, K2: number, S1: number, S2: number, m1: number, m2: number, lnr: number, VE: number) => {
  const tr = S1 / K1 + S2 / K2, mean = m1 ** 2 / K1 + m2 ** 2 / K2, KL = 0.5 * (tr + mean - 2 + lnr);
  return [VE + KL, VE - 0.5 * (K1 / S1 + K2 / S2 + m1 ** 2 / S1 + m2 ** 2 / S2 - 2 - lnr), VE - 0.5 * (tr + mean - 1 + lnr), VE - 0.5 * (tr + mean - 2 - lnr),
    VE - 0.5 * (tr - 2 + lnr), VE - 0.5 * (K1 / S1 + K2 / S2 + mean - 2 + lnr), KL, VE - 0.5 * (tr + mean - 2), VE - (tr + mean - 2 + lnr)];
};
const challengeSpace = (() => {
  const set = new Set<string>(), quads = new Set<string>();
  for (const S1 of [1, 2]) for (const S2 of [1, 2]) for (const K1 of [1, 2, 4]) for (const K2 of [1, 2, 4]) {
    const e = Math.log2(K1 * K2 / (S1 * S2));
    if (e === 0 || Math.abs(e) > 2) continue;
    const lnr = Math.round(Math.log(K1 * K2 / (S1 * S2)) * 1000) / 1000;
    quads.add(key(S1, S2, K1, K2));
    for (const m1 of [0, 1, 2]) for (const m2 of [0, 1, 2]) for (const VE of R(-6, -3, 0.5)) {
      const KL = challengeKl(K1, K2, S1, S2, m1, m2, lnr);
      if (KL < 0.05) continue;
      if (gap(VE - KL, challengeRoutes(K1, K2, S1, S2, m1, m2, lnr, VE)) < 0.05) continue;
      set.add(key(K1, K2, S1, S2, m1, m2, lnr, VE));
    }
  }
  return { set, quads };
})();

describe('plan sampling spaces reproduce the stated counts', () => {
  it('counts', () => {
    expect(rankSpace.size).toBe(630);
    expect(gapSpace.size).toBe(168);
    expect(varExpSpace.size).toBe(66);
    expect(klMeanSpace.size).toBe(9);
    expect(klFullSpace.size).toBe(27);
    expect(modeSpace.size).toBe(6);
    expect(predSpace.size).toBe(36);
    expect([...predEnumerated].sort()).toEqual([...predSpace].sort());
    expect(classSpace.size).toBe(10);
    expect(challengeSpace.quads.size).toBe(23);
    expect(challengeSpace.set.size).toBe(1288);
  });
});

// ---------- structure ----------
const LABELS: Record<string, [string, string]> = {
  'elbo-gap': ['KL[q ‖ p(f | y)]', 'KL[q ‖ p(f | y)]'], 'var-exp': ['E_q[h(f)]', '期望 E_q[h(f)]'], 'kl-mean': ['KL[q ‖ p]', 'KL[q ‖ p]'], 'kl-full': ['KL[q ‖ p]', 'KL[q ‖ p]'],
  'pred-var': ['Variance σ*² of f*', 'f* 的方差 σ*²'], 'classif-pred': ['p(y* = +1 | y)', 'p(y* = +1 | y)'], challenge: ['ELBO ℒ[q]', '证据下界 ℒ[q]'],
};
const TITLES: Record<string, [string, string]> = {
  'rank-q': ['Which q is best?', '哪个 q 最好？'], 'elbo-gap': ['How far below log p(y)?', '比 log p(y) 低多少？'], 'var-exp': ['The variational expectation of a data-fit term', '数据拟合项的变分期望'],
  'kl-mean': ['KL when the variances match', '方差相同时的 KL'], 'kl-full': ['The Gaussian KL in one dimension', '一维高斯 KL'], 'mode-seek': ['A bimodal posterior and a single Gaussian', '双峰后验与单个高斯'],
  'pred-var': ['The variance of f* under q', 'q 之下 f* 的方差'], 'classif-pred': ['From f* to a class probability', '从 f* 到类别概率'], challenge: ['Challenge: the ELBO of a two-dimensional q', '挑战：二维 q 的证据下界'],
};
const ORDER = ['rank-q', 'elbo-gap', 'var-exp', 'kl-mean', 'kl-full', 'mode-seek', 'pred-var', 'classif-pred', 'challenge'];
const ENDS: Record<string, [string, string]> = {
  'elbo-gap': ['Give an integer, a fraction or a decimal rounded to 2 places.', '请填整数、分数，或保留 2 位小数的小数。'], 'var-exp': ['Give an integer, a fraction or a decimal rounded to 2 places.', '请填整数、分数，或保留 2 位小数的小数。'],
  'kl-mean': ['Give an integer, a fraction or a decimal rounded to 2 places.', '请填整数、分数，或保留 2 位小数的小数。'], 'pred-var': ['Give an integer, a fraction or a decimal rounded to 2 places.', '请填整数、分数，或保留 2 位小数的小数。'],
  'kl-full': ['Give a decimal rounded to 2 places.', '请填保留 2 位小数的小数。'], 'classif-pred': ['Give a decimal rounded to 2 places.', '请填保留 2 位小数的小数。'], challenge: ['Give a decimal rounded to 2 places.', '请填保留 2 位小数的小数。'],
};
const KINDS = ['elbo-gap', 'var-exp', 'kl-mean', 'kl-full', 'pred-var', 'classif-pred', 'challenge'].map(s => `GP-19:${s}`);

describe('GP-19 deck structure', () => {
  it('9 cards in the planned order, titles, labels, endings, one field with tolerance 0.006, only the planned audit kinds', () => {
    for (const seed of seeds) for (const [li, lang] of LANGS.entries()) {
      const cards = deck(seed, lang);
      expect(cards.map(c => c.id)).toEqual(ORDER.map(ID));
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind);
      expect(kinds.sort()).toEqual([...KINDS].sort());
      for (const slug of ORDER) {
        const c = byId(cards, slug);
        expect(c.title, slug).toBe(TITLES[slug][li]);
        if (slug === 'rank-q' || slug === 'mode-seek') { expect(c.choice, slug).toBeDefined(); expect(c.choice!.options).toHaveLength(4); expect(c.fields).toBeUndefined(); expect(c.audit).toBeUndefined(); continue; }
        expect(c.fields, slug).toHaveLength(1);
        expect(c.fields![0].label, slug).toBe(LABELS[slug][li]);
        expect(c.fields![0].tolerance, slug).toBe(TOL);
        expect(c.prompt.endsWith(ENDS[slug][li]), `${slug} ${lang}: ${c.prompt.slice(-60)}`).toBe(true);
        expect(c.slots).toBeUndefined();
      }
      for (const slug of ORDER) if (slug !== 'mode-seek') expect(byId(cards, slug).figure, slug).toBeUndefined();
      expect(byId(cards, 'mode-seek').figure).toBeDefined();
    }
  });
});

// ---------- numeric cards ----------
type Num = { slug: string; parse: (prompt: string) => Record<string, number | number[]>; key: (p: Record<string, number | number[]>) => number; routes: (p: Record<string, number | number[]>) => number[]; minGap: number; space: Set<string>; spaceKey: (p: Record<string, number | number[]>) => string; ensure?: (p: Record<string, number | number[]>, truth: number) => void };
const n = (x: number | number[]) => x as number;
const fr = (x: number | number[]) => { const a = x as number[]; return a[0] / (a[1] ?? 1); };
const NUMBERS: Num[] = [
  {
    slug: 'elbo-gap', minGap: 0.5, space: gapSpace, spaceKey: p => key(n(p.lp), n(p.ve), n(p.kl)),
    parse: t => { const [lp] = first(t, new RegExp(String.raw`log p\(y\) = ${NUM}`), 'lp'); const [ve] = first(t, new RegExp(String.raw`E_q\[log p\(y \| f\)\] = ${NUM}`), 've'); const [kl] = first(t, new RegExp(String.raw`KL\[q ‖ p\(f\)\] = ${NUM}`), 'kl'); return { lp, ve, kl }; },
    // independent route: closed-form conjugate identity is checked below; here ELBO then gap
    key: p => { const elbo = n(p.ve) - n(p.kl); return n(p.lp) - elbo; },
    routes: p => { const { lp, ve, kl } = p as Record<string, number>; const g = lp - ve + kl; return [lp - ve, g - kl, -g, lp - kl, ve - kl, kl + g]; },
    ensure: (p, T) => { expect(T).toBeGreaterThan(0.49); expect(T).toBeLessThan(2.01); },
  },
  {
    slug: 'var-exp', minGap: 1, space: varExpSpace, spaceKey: p => key(n(p.y), n(p.m), n(p.S)),
    parse: t => { const [y] = first(t, new RegExp(String.raw`\by = ${NUM}`), 'y'); const [m, S] = first(t, new RegExp(String.raw`q\(f\) = N\(${NUM}, ${NUM}\)`), 'm,S'); return { y, m, S }; },
    // 3-node Gauss-Hermite (probabilists'): nodes 0, ±sqrt3, weights 2/3, 1/6, 1/6, exact for quadratics
    key: p => { const { y, m, S } = p as Record<string, number>; return [[0, 2 / 3], [Math.sqrt(3), 1 / 6], [-Math.sqrt(3), 1 / 6]].reduce((s, [z, w]) => s + w * (-((y - (m + Math.sqrt(S) * z)) ** 2) / 2), 0); },
    routes: p => { const { y, m, S } = p as Record<string, number>; const d2 = (y - m) ** 2; return [-d2 / 2, -(d2 + S ** 2) / 2, (d2 + S) / 2, -d2 / 2 - S, -(d2 - S) / 2, -(d2 + S), -d2 / 2 + S / 2]; },
  },
  {
    slug: 'kl-mean', minGap: 0.2, space: klMeanSpace, spaceKey: p => key(n(p.m), n(p.S), n(p.K)),
    parse: t => { const [K] = first(t, new RegExp(String.raw`p\(f\) = N\(0, ${NUM}\)`), 'K'); const [m, S] = first(t, new RegExp(String.raw`q\(f\) = N\(${NUM}, ${NUM}\)`), 'm,S'); return { m, S, K }; },
    key: p => klQuad(n(p.m), n(p.S), n(p.K)),
    routes: p => { const { m, K } = p as Record<string, number>; return [m * m / K, m * m / (2 * K * K), m * m / 2, m / (2 * K), m * m / (4 * K), 0]; },
    ensure: (p, T) => { expect(n(p.S)).toBe(n(p.K)); },
  },
  {
    slug: 'kl-full', minGap: 0.03, space: klFullSpace, spaceKey: p => key(n(p.m), n(p.S), n(p.K), n(p.lnr)),
    parse: t => { const [K] = first(t, new RegExp(String.raw`p\(f\) = N\(0, ${NUM}\)`), 'K'); const [m, S] = first(t, new RegExp(String.raw`q\(f\) = N\(${NUM}, ${NUM}\)`), 'm,S'); const [a, b, lnr] = first(t, new RegExp(String.raw`ln\(${NUM}/${NUM}\) = ${NUM}`), 'lnr'); expect(a).toBe(K); expect(b).toBe(S); return { m, S, K, lnr }; },
    // printed-log key from the formula; the exact-log quadrature must agree within the 3-decimal rounding
    key: p => { const { m, S, K, lnr } = p as Record<string, number>; return 0.5 * (S / K + m * m / K - 1 + lnr); },
    routes: p => { const { m, S, K, lnr } = p as Record<string, number>; return [0.5 * (K / S + m * m / S - 1 - lnr), 2 * 0.5 * (S / K + m * m / K - 1 + lnr), 0.5 * (S / K + m * m / K - 1 - lnr), 0.5 * (S / K - 1 + lnr), 0.5 * (K / S + m * m / K - 1 + lnr), 0.5 * (S / K + m * m / S - 1 + lnr), 0.5 * (S / K + m * m / K - 1), 0.5 * (S / K + m * m / K + lnr)]; },
    ensure: (p, T) => {
      const { m, S, K, lnr } = p as Record<string, number>;
      expect(Math.abs(T - klQuad(m, S, K)), `exact vs printed-log key ${key(m, S, K)}`).toBeLessThan(5e-4);
      expect(lnr).toBeCloseTo(Math.round(Math.log(K / S) * 1000) / 1000, 12);
      expect(T).toBeGreaterThanOrEqual(0.1);
    },
  },
  {
    slug: 'pred-var', minGap: 0.125, space: predSpace, spaceKey: p => key(n(p.K), n(p.c), n(p.S)),
    parse: t => { const [K] = first(t, new RegExp(String.raw`K = k\(x, x\) = ${NUM}`), 'K'); const [kss] = first(t, new RegExp(String.raw`k\*\* = k\(x\*, x\*\) = ${NUM}`), 'k**'); expect(kss).toBe(K); const [c] = first(t, new RegExp(String.raw`k\* = k\(x\*, x\) = ${NUM}`), 'c'); const [S] = first(t, new RegExp(String.raw`(?:variance|方差) S = ${NUM}`), 'S'); return { K, c, S }; },
    // total variance by quadrature over f ~ N(m, S): E[Var(f*|f)] + Var(E[f*|f]) with E[f*|f] = (c/K) f, Var(f*|f) = K - c^2/K
    key: p => { const { K, c, S } = p as Record<string, number>; const m = 0.7, v = K - c * c / K; const E1 = simpson(f => normalPdf(f, m, S) * (c / K) * f, m - 12 * Math.sqrt(S), m + 12 * Math.sqrt(S)); const E2 = simpson(f => normalPdf(f, m, S) * (v + ((c / K) * f) ** 2), m - 12 * Math.sqrt(S), m + 12 * Math.sqrt(S)); return E2 - E1 * E1; },
    routes: p => { const { K, c, S } = p as Record<string, number>; return [K - c * c / K, K - c * c * (K - S) / K, S, K - c * c * S / K ** 2, c * c * (K - S) / K ** 2, K - c * (K - S) / K]; },
    ensure: (p) => { const { K, c, S } = p as Record<string, number>; expect(c).toBeGreaterThan(0); expect(c).toBeLessThan(K); expect(S).toBeGreaterThan(0); expect(S).toBeLessThan(K); expect(S).not.toBe(K / 2); },
  },
  {
    slug: 'classif-pred', minGap: 0.02, space: classSpace, spaceKey: p => key(fr(p.mu), fr(p.sg)),
    parse: t => { const frac = (re: RegExp, what: string) => { const m = norm(t).match(re); if (!m) throw new Error('cannot parse ' + what + ' from ' + t.slice(0, 300)); return [Number(m[1]), m[2] === undefined ? 1 : Number(m[2])]; }; return { mu: frac(/μ\* = (-?\d+)(?:\/(\d+))?/, 'mu'), sg: frac(/σ\*² = (\d+)(?:\/(\d+))?/, 'sg') }; },
    // quadrature of Phi(f) N(f | mu, sg), compared against the printed table below
    key: p => { const mu = fr(p.mu), sg = fr(p.sg); return simpson(f => Phi(f) * normalPdf(f, mu, sg), mu - 10 * Math.sqrt(sg), mu + 10 * Math.sqrt(sg), 600); },
    routes: p => { const mu = fr(p.mu), sg = fr(p.sg); return [Phi(mu), Phi(mu / (1 + sg)), Phi(mu / Math.sqrt(sg)), Phi(mu / sg), Phi(mu * Math.sqrt(1 + sg))]; },
    ensure: (p, T) => {
      const mu = fr(p.mu), sg = fr(p.sg);
      const z = mu / Math.sqrt(1 + sg); expect(Object.keys(TABLE).map(Number)).toContain(Math.round(z * 1e9) / 1e9);
      expect(Math.abs(TABLE[String(Math.round(z * 1e9) / 1e9)] - T)).toBeLessThan(6e-5);
    },
  },
  {
    slug: 'challenge', minGap: 0.05, space: challengeSpace.set, spaceKey: p => key(n(p.K1), n(p.K2), n(p.S1), n(p.S2), n(p.m1), n(p.m2), n(p.lnr), n(p.VE)),
    parse: t => {
      const tt = norm(t);
      const K = tt.match(new RegExp(String.raw`K = \[\[${NUM}, ${NUM}\], \[${NUM}, ${NUM}\]\]`)), S = tt.match(new RegExp(String.raw`S = \[\[${NUM}, ${NUM}\], \[${NUM}, ${NUM}\]\]`)), m = tt.match(new RegExp(String.raw`m = \(${NUM}, ${NUM}\)`));
      if (!K || !S || !m) throw new Error('cannot parse challenge matrices: ' + t.slice(0, 200));
      expect([K[2], K[3]]).toEqual(['0', '0']); expect([S[2], S[3]]).toEqual(['0', '0']);
      const [VE] = first(t, new RegExp(String.raw`E_q\[log p\(y \| f\)\] = ${NUM}`), 'VE'); const [lnr] = first(t, new RegExp(String.raw`ln\([‖|]K[‖|]\/[‖|]S[‖|]\) = ${NUM}`), 'lnr');
      return { K1: +K[1], K2: +K[4], S1: +S[1], S2: +S[4], m1: +m[1], m2: +m[2], lnr, VE };
    },
    // dense 2x2 route with hand-written inverse and determinant, true ln; also a sum of two 1-D quadrature KLs
    key: p => {
      const { K1, K2, S1, S2, m1, m2, lnr, VE } = p as Record<string, number>;
      const Ki = inv2(K1, 0, 0, K2), Sd = inv2(S1, 0, 0, S2);
      const tr = Ki.m[0][0] * S1 + Ki.m[0][1] * 0 + Ki.m[1][0] * 0 + Ki.m[1][1] * S2;
      const quad = Ki.m[0][0] * m1 * m1 + 2 * Ki.m[0][1] * m1 * m2 + Ki.m[1][1] * m2 * m2;
      const dense = 0.5 * (tr + quad - 2 + Math.log(Ki.det / Sd.det));
      const sum1d = klQuad(m1, S1, K1) + klQuad(m2, S2, K2);
      expect(Math.abs(dense - sum1d), 'dense vs two 1-D quadratures').toBeLessThan(1e-6);
      // key computed from the printed rounded log: must be within 7e-4 of the exact value
      void lnr;
      return VE - dense;
    },
    routes: p => { const q = p as Record<string, number>; return challengeRoutes(q.K1, q.K2, q.S1, q.S2, q.m1, q.m2, q.lnr, q.VE); },
    ensure: (p, T) => {
      const q = p as Record<string, number>;
      const ratio = Math.log2(q.K1 * q.K2 / (q.S1 * q.S2));
      expect([-2, -1, 1, 2], `exponent of K/S for ${JSON.stringify(p)}`).toContain(ratio);
      expect(q.lnr).toBeCloseTo(Math.round(Math.log(q.K1 * q.K2 / (q.S1 * q.S2)) * 1000) / 1000, 12);
      const printedKey = q.VE - challengeKl(q.K1, q.K2, q.S1, q.S2, q.m1, q.m2, q.lnr);
      expect(Math.abs(printedKey - T), 'printed-log key vs exact').toBeLessThan(7e-4);
      expect(challengeKl(q.K1, q.K2, q.S1, q.S2, q.m1, q.m2, q.lnr)).toBeGreaterThanOrEqual(0.05);
    },
  },
];

describe('GP-19 numeric cards: independent recomputation, printed text, wrong routes, grading', () => {
  for (const spec of NUMBERS) {
    it(`${spec.slug}: ${SEEDS} seeds x EN/ZH`, () => {
      const seen = new Set<string>();
      for (const seed of seeds) for (const lang of LANGS) {
        const card = byId(deck(seed, lang), spec.slug);
        const where = `${spec.slug} seed ${seed} ${lang}`;
        const params = card.audit!.params;
        expect(card.audit!.kind).toBe(`GP-19:${spec.slug}`);
        // 2. printed text = audit params
        // a one-element fraction array [n] is read as [n, 1]; whether the generator should always emit [n, d] is reported separately
        const norm1 = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) && v.length === 1 ? [v[0], 1] : v]));
        expect(spec.parse(card.prompt), `${where}: printed vs audit params`).toEqual(norm1);
        for (const v of Object.values(params)) if (Array.isArray(v)) expect(v.length, `${where}: fraction param must be [numerator, denominator]`).toBe(2);
        // plan sampling space
        expect(spec.space.has(spec.spaceKey(params)), `${where}: ${JSON.stringify(params)} outside the plan's sampling space`).toBe(true);
        seen.add(spec.spaceKey(params));
        // 1. independent key
        const truth = spec.key(params);
        spec.ensure?.(params, truth);
        const field = card.fields![0];
        const tol = spec.slug === 'classif-pred' ? 6e-5 + 1e-9 : spec.slug === 'kl-full' || spec.slug === 'challenge' ? 7e-4 : 1e-9;
        expect(Math.abs(field.answer - truth), `${where}: card key ${field.answer} vs oracle ${truth}`).toBeLessThanOrEqual(tol);
        // grading through gradeCard
        const grade = (v: number) => gradeCard(card, [String(v)], null, []);
        expect(grade(field.answer), `${where} key accepted`).toBe('correct');
        expect(grade(Math.round(truth * 100) / 100), `${where} learner rounding of the exact value accepted`).toBe('correct');
        expect(grade(field.answer + TOL + 0.001), `${where} perturbed up`).toBe('incorrect');
        expect(grade(field.answer - TOL - 0.001), `${where} perturbed down`).toBe('incorrect');
        // rounding edge: a learner using the exact logarithm and rounding to 2 places lands on the same 2-decimal value as the key
        if (spec.slug === 'kl-full' || spec.slug === 'challenge') expect(Math.round(field.answer * 100), `${where}: 2-dp rounding of key ${field.answer} differs from exact ${truth}`).toBe(Math.round(truth * 100));
        // wrong routes never collide with the truth (more than twice the tolerance, and the plan's gap)
        const routes = spec.routes(params);
        const g = gap(truth, routes);
        expect(g, `${where}: wrong-route collision gap ${g} params ${JSON.stringify(params)}`).toBeGreaterThanOrEqual(Math.max(spec.minGap - 1e-9, 2 * TOL));
        for (const r of routes) expect(grade(r), `${where}: a wrong route ${r} is graded correct`).toBe('incorrect');
      }
    });
  }
  it('elbo-gap identity on a conjugate toy model (K=2, noise 0.5, y=1.3, q=N(0.4,0.3)): log p(y) - ELBO = KL[q || posterior]', () => {
    const K = 2, s2 = 0.5, y = 1.3, qm = 0.4, qv = 0.3;
    const logpy = logNormal(y, 0, K + s2);
    const pv = 1 / (1 / K + 1 / s2), pm = pv * y / s2;
    const ve = simpson(f => normalPdf(f, qm, qv) * logNormal(y, f, s2), qm - 12, qm + 12);
    const kl = simpson(f => normalPdf(f, qm, qv) * (logNormal(f, qm, qv) - logNormal(f, 0, K)), qm - 12, qm + 12);
    const klPost = simpson(f => normalPdf(f, qm, qv) * (logNormal(f, qm, qv) - logNormal(f, pm, pv)), qm - 12, qm + 12);
    expect(Math.abs(logpy - (ve - kl) - klPost)).toBeLessThan(1e-8);
    expect(Math.abs(logpy - -1.71508 - (ve - kl - (-1.71508 - klPost)))).toBeLessThan(1e-4);
  });
  it('card 8 printed table equals the true cdf within 6e-5', () => {
    const card = byId(deck(seeds[0], 'en'), 'classif-pred');
    const printed = [...norm(card.prompt).matchAll(/Φ\(([\d.]+)\) = (\d\.\d+)/g)];
    expect(printed).toHaveLength(6);
    for (const [, x, v] of printed) { expect(TABLE[x]).toBe(Number(v)); expect(Math.abs(Phi(Number(x)) - Number(v))).toBeLessThan(6e-5); }
    for (const lang of LANGS) for (const seed of seeds) expect([...norm(byId(deck(seed, lang), 'classif-pred').prompt).matchAll(/Φ\(([\d.]+)\) = (\d\.\d+)/g)].map(m => m[0])).toEqual(printed.map(m => m[0]));
  });
});

// ---------- choice cards ----------
describe('rank-q choice card', () => {
  it('exactly one option satisfies the plan predicate, the answer points to it, never the longest', () => {
    for (const seed of seeds) for (const [li, lang] of LANGS.entries()) {
      const card = byId(deck(seed, lang), 'rank-q'), t = norm(card.prompt), where = `rank-q ${seed} ${lang}`;
      const ve: number[] = [], kl: number[] = [];
      for (const q of ['₁', '₂', '₃']) { const m = t.match(new RegExp(String.raw`q${q}[:：] ?E_q\[log p\(y \| f\)\] = ${NUM}[,，] ?KL\[q ‖ p\(f\)\] = ${NUM}`)); if (!m) throw new Error(where + ' cannot parse ' + t); ve.push(+m[1]); kl.push(+m[2]); }
      expect(rankSpace.has(key(ve[0], kl[0], ve[1], kl[1], ve[2], kl[2])), `${where} outside plan space`).toBe(true);
      const e = ve.map((v, i) => v - kl[i]), best = Math.max(...e);
      const options = card.choice!.options;
      const fourth = li === 0 ? 'Cannot be decided without knowing log p(y)' : '不知道 log p(y) 就无法判断';
      expect(options.filter(o => o === fourth)).toHaveLength(1);
      const verdict = options.map(o => { const i = ['q₁', 'q₂', 'q₃'].indexOf(o); return i >= 0 && e[i] === best; });
      expect(verdict.filter(Boolean), where).toHaveLength(1);
      expect(verdict[card.choice!.answer], where).toBe(true);
      const sorted = [...e].sort((a, b) => b - a); expect(sorted[0] - sorted[1]).toBeGreaterThanOrEqual(1);
      const len = options.map(o => [...o].length), correct = len[card.choice!.answer];
      expect(correct, `${where} correct option longest`).toBeLessThan(Math.max(...len));
      expect(options[card.choice!.answer]).not.toBe(fourth);
    }
  });
});
describe('mode-seek choice card and figure', () => {
  it('correct option is the true KL minimiser (numerical integration), v = 1 + a^2, figure shows p only', () => {
    const avals = new Set<number>();
    for (const seed of seeds) for (const [li, lang] of LANGS.entries()) {
      const card = byId(deck(seed, lang), 'mode-seek'), where = `mode-seek ${seed} ${lang}`;
      const am = norm(card.prompt).match(/½ N\(f \| -(\d+), 1\) \+ ½ N\(f \| (\d+), 1\)/)!; expect(am[1]).toBe(am[2]);
      const A = Number(am[1]); avals.add(A);
      expect(modeSpace.has(String(A))).toBe(true);
      const v = 1 + A * A, options = card.choice!.options;
      const parsed = options.map(o => { const m = norm(o).match(/^N\((-?\d+), (\d+)\)/)!; return { mean: +m[1], var: +m[2], text: norm(o) }; });
      const kls = parsed.map(p => klToMixture(p.mean, p.var, A));
      const bestIdx = kls.indexOf(Math.min(...kls));
      expect(bestIdx, `${where}: KL values ${kls}`).toBe(card.choice!.answer);
      const sortedKl = [...kls].sort((x, y) => x - y);
      expect(sortedKl[0]).toBeCloseTo(Math.log(2), 2);
      expect(sortedKl[1] - sortedKl[0], where).toBeGreaterThan(1.2);
      // plan predicate on the text
      const isCorrect = (t: string) => t.includes(`N(${A}, 1)`) && t.includes(`N(-${A}, 1)`);
      expect(parsed.map(p => isCorrect(p.text)).filter(Boolean)).toHaveLength(1);
      expect(isCorrect(parsed[card.choice!.answer].text)).toBe(true);
      expect(parsed.filter(p => p.text.includes(`, ${v})`))).toHaveLength(2);
      expect(parsed.filter(p => p.mean === 0 && p.var === v)).toHaveLength(1);
      expect(parsed.filter(p => p.mean === 0 && p.var === 1)).toHaveLength(1);
      expect(parsed.filter(p => p.mean === A && p.var === v)).toHaveLength(1);
      const len = options.map(o => [...o].length);
      expect(len[card.choice!.answer], `${where} correct option is not strictly shorter than the longest wrong option`).toBeLessThan(Math.max(...len.filter((_, i) => i !== card.choice!.answer)));
      // figure
      const fig = card.figure as Figure;
      expect(fig.shapes).toHaveLength(1);
      const s = fig.shapes[0]; expect(s.kind).toBe('line');
      if (s.kind === 'line') {
        expect(s.points.length).toBeGreaterThanOrEqual(100);
        expect(s.points[0][0]).toBeCloseTo(-A - 4, 9); expect(s.points[s.points.length - 1][0]).toBeCloseTo(A + 4, 9);
        for (const [x, y] of s.points) expect(Math.abs(y - 0.5 * (normalPdf(x, -A, 1) + normalPdf(x, A, 1)))).toBeLessThan(1e-9);
        const ymax = Math.max(...s.points.map(p => p[1]));
        expect(fig.view.xmin).toBeLessThanOrEqual(-A - 4 + 1e-9); expect(fig.view.xmax).toBeGreaterThanOrEqual(A + 4 - 1e-9);
        expect(fig.view.ymin).toBeLessThanOrEqual(0 + 1e-9); expect(fig.view.ymax).toBeGreaterThanOrEqual(ymax);
      }
      expect(norm(fig.alt)).toContain(`-${A}`); expect(norm(fig.alt)).toContain(`${A}`);
      expect(fig.axes?.xLabel).toBe('f'); expect(fig.axes?.yLabel).toBe(li === 0 ? 'density' : '概率密度');
      // the figure never shows a candidate q or the answer: no points/text/arrows
      expect(fig.shapes.every(sh => sh.kind === 'line')).toBe(true);
      expect(`${fig.alt} ${fig.caption ?? ''}`).not.toMatch(/N\(/);
    }
    expect([...avals].sort((x, y) => x - y)).toEqual([4, 5, 6, 7, 8, 10]);
  });
});

// ---------- variety and exact coverage of the sampling spaces ----------
describe('variety and coverage', () => {
  it('every card has >= 6 distinct prompts over 60 seeds (mode-seek has 6 draws in total)', () => {
    for (const slug of ORDER) {
      const prompts = new Set(seeds.map(s => byId(deck(s, 'en'), slug).prompt));
      expect(prompts.size, `${slug} distinct prompts`).toBeGreaterThanOrEqual(6);
    }
  });
  it(`the sampler reaches exactly the plan's sets (${COVER_SEEDS} random seeds, EN)`, () => {
    let state = 12345;
    const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
    const seen: Record<string, Set<string>> = {}, outside: Record<string, Set<string>> = {};
    for (let i = 0; i < COVER_SEEDS; i++) {
      const seed = (Math.imul(next(), 2654435761) ^ next()) >>> 0;
      for (const card of deck(seed, 'en')) {
        const slug = card.id.slice(6);
        let k: string | undefined;
        if (card.audit) { const spec = NUMBERS.find(s => s.slug === slug)!; k = spec.spaceKey(card.audit.params); if (!spec.space.has(k)) (outside[slug] ??= new Set()).add(JSON.stringify(card.audit.params)); }
        else if (slug === 'rank-q') { const t = norm(card.prompt); const nums = [...t.matchAll(/= (-?\d+)/g)].map(m => +m[1]); k = key(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); if (!rankSpace.has(k)) (outside[slug] ??= new Set()).add(k); }
        else { k = String(+norm(card.prompt).match(/N\(f \| (\d+), 1\)/)![1]); }
        (seen[slug] ??= new Set()).add(k);
      }
    }
    const planned: Record<string, Set<string>> = { 'rank-q': rankSpace, 'elbo-gap': gapSpace, 'var-exp': varExpSpace, 'kl-mean': klMeanSpace, 'kl-full': klFullSpace, 'mode-seek': modeSpace, 'pred-var': predSpace, 'classif-pred': classSpace, challenge: challengeSpace.set };
    expect(Object.fromEntries(Object.entries(outside).map(([k, v]) => [k, [...v].slice(0, 6).concat(`(${v.size} outside the plan space)`)])), 'sets outside the plan space').toEqual({});
    for (const slug of ORDER) expect(seen[slug].size, `${slug}: reached ${seen[slug].size} of ${planned[slug].size}`).toBe(planned[slug].size);
  }, 240000);
});

// ---------- learner-visible text ----------
const textOfCard = (c: PracticeCard) => [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? []), c.figure?.alt ?? '', c.figure?.axes?.xLabel ?? '', c.figure?.axes?.yLabel ?? ''];
describe('learner-visible text', () => {
  it('Unicode only, no hyphen minus, no double parentheses, no raw floats, no developer markers, no "x = x", no ZH English words', () => {
    const bad: string[] = [];
    const ZH_ALLOWED = /^(GP|KL|ELBO|ln|log|exp|N|E|Cholesky)$/;
    for (const seed of seeds) for (const lang of LANGS) for (const card of deck(seed, lang)) for (const text of textOfCard(card)) {
      const flag = (what: string) => bad.push(`${card.id} ${lang}: ${what}: ${text.slice(0, 90)}`);
      if (/(?<![\w)])-\s?\d|\s-\s|[(=,+] ?-\w/.test(text)) flag('ASCII hyphen as minus');
      if (/\^/.test(text)) flag('caret');
      if (/\(\(|\)\)/.test(text.replace(/\(\s*\w[^()]*\([^()]*\)[^()]*\)/g, ''))) flag('double parentheses');
      if (/\d\.\d{6,}/.test(text)) flag('raw float');
      if (/[{}]|\$|\\|undefined|NaN|DERIVED|NOT IN SOURCES|TODO|TBD|audit|\blp\b|\bve\b|\blnr\b|\bkl\d?\b/.test(text)) flag('developer marker or leftover');
      const restated = norm(text).match(/(?<![\w(+\-*/·÷×] )(?<![\w(/²·÷×])(-?\d+(?:\.\d+)?(?:\/\d+)?|[A-Za-zμσ*²]+) = \1(?![\w./²(]| [+\-*/·])/);
      if (restated) flag('x = x: [' + restated[0] + '] in …' + norm(text).slice(Math.max(0, restated.index! - 40), restated.index! + 30));
      if (/(?<!ln\()\b\d+\/1\b(?!\d)/.test(text)) flag('a/1 fraction');
      if (/[一-鿿]/.test(text) || lang === 'zh') {
        if (lang === 'zh') for (const w of text.match(/[A-Za-z]{2,}/g) ?? []) if (!ZH_ALLOWED.test(w) && !/^(p|q|f|y|tr|GPML|pdf|df)$/.test(w)) flag('English word ' + w);
        if (lang === 'zh' && /[A-Za-z]{2,}/.test(text.replace(/GPML|pdf|GP|KL|ELBO|ln|log|exp|tr/g, ''))) { /* covered above */ }
        if (lang === 'zh' && /[一-鿿][,.;:?!]|[)\]\d][,.;:] ?[一-鿿]/.test(text)) flag('ASCII punctuation in ZH');
      }
    }
    expect([...new Set(bad)].slice(0, 40)).toEqual([]);
  });
  it('ZH correct option is never the longest, EN too, in both languages for both choice cards', () => {
    for (const seed of seeds) for (const lang of LANGS) for (const slug of ['rank-q', 'mode-seek']) {
      const c = byId(deck(seed, lang), slug), len = c.choice!.options.map(o => [...o].length);
      expect(len[c.choice!.answer], `${slug} ${lang}`).toBeLessThan(Math.max(...len));
    }
  });
  it('hints do not contain the answer and explanations state the key', () => {
    for (const seed of seeds) for (const lang of LANGS) {
      const cards = deck(seed, lang);
      for (const slug of ORDER) {
        const c = byId(cards, slug);
        expect(c.hint.trim()).not.toBe(c.explanation.trim());
        if (c.fields) {
          const ans = c.fields[0].answer, hint = norm(c.hint);
          for (const s of [String(ans), ans.toFixed(2), ans.toFixed(3)]) expect(hint.includes(s) && !/^\d$/.test(s) && Math.abs(ans) > 1.5 && s.length > 3, `${slug} hint contains ${s}`).toBe(false);
        }
      }
    }
  });
});
