import { describe, expect, it } from 'vitest';
import { gp26, gp26SpaceSizes } from './games/gp26';
import { spreadSeed, textOf, questionTextOf, deckProblems, textLintProblems } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, parseGameNumber, type PracticeCard } from '../types';

const SEEDS = 60;
type Lang = 'en' | 'zh';
type Params = Record<string, number | number[]>;
const LANGS: Lang[] = ['en', 'zh'];
const ORDER = ['ppca-cov', 'ppca-det', 'latent-count', 'closed-form', 'data-fit', 'map-prior', 'bgplvm-interval', 'not-gaussian', 'challenge'];
const KIND = (slug: string) => `GP-26:${slug}`;
const NUMERIC = ['ppca-cov', 'ppca-det', 'latent-count', 'data-fit', 'map-prior', 'bgplvm-interval', 'challenge'];
const EPS = 1e-9;

// ---------------------------------------------------------------- generic helpers
const seedOf = (i: number) => spreadSeed(i);
const deck = (i: number, lang: Lang) => gp26(seedOf(i), lang) as PracticeCard[];
const cardOf = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-26-${slug}`);
  if (!card) throw new Error(`no card ${slug}`);
  return card;
};
const norm = (s: string) => s.replaceAll('−', '-');
const SUB: Record<string, number> = { '₁': 1, '₂': 2, '₃': 3 };
/** all numbers (decimals, fractions a/b) in a piece of text, in order */
function numbersIn(text: string): number[] {
  return [...norm(text).matchAll(/-?\d+(?:\.\d+)?(?:\/\d+)?/g)].map(m => {
    const [a, b] = m[0].split('/');
    return b === undefined ? Number(a) : Number(a) / Number(b);
  });
}
/** entries of the first matrix `[[...], [...]]` after `marker` in the text */
function matrixAfter(text: string, marker: string, occurrence = 0): number[][] {
  const t = norm(text);
  let from = -1;
  for (let k = 0; k <= occurrence; k++) from = t.indexOf(marker, from + 1);
  expect(from, `marker ${marker} in ${text.slice(0, 80)}`).toBeGreaterThanOrEqual(0);
  const start = t.indexOf('[[', from);
  const end = t.indexOf(']]', start);
  const body = t.slice(start + 2, end);
  return body.split('], [').map(row => numbersIn(row));
}
function scalarAfter(text: string, label: RegExp): number {
  const m = norm(text).match(label);
  expect(m, `${label} in ${text.slice(0, 120)}`).not.toBeNull();
  return numbersIn(m![1])[0];
}
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const close = (a: number, b: number, tol = EPS) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
const E5 = range(-2, 2);

/** smallest denominator d such that value*d is an integer, searching the allowed set first */
function denominator(value: number): number | null {
  for (let d = 1; d <= 40; d++) if (Math.abs(value * d - Math.round(value * d)) < 1e-9) return d;
  return null;
}
const allowedDen = new Set([1, 2, 4, 5, 8, 10]);
function fractionText(value: number): string {
  const d = denominator(value)!;
  return d === 1 ? String(Math.round(value)) : `${Math.round(value * d)}/${d}`;
}

// ---------------------------------------------------------------- independent mathematics
type M2 = [[number, number], [number, number]];
const mul2 = (a: M2, b: M2): M2 => [
  [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
  [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
];
const tr2 = (a: M2) => a[0][0] + a[1][1];
const T2 = (a: M2): M2 => [[a[0][0], a[1][0]], [a[0][1], a[1][1]]];
const det2 = (a: M2) => a[0][0] * a[1][1] - a[0][1] * a[1][0];
const inv2 = (a: M2): M2 => { const d = det2(a); return [[a[1][1] / d, -a[0][1] / d], [-a[1][0] / d, a[0][0] / d]]; };
/** Solve K u = b by Gaussian elimination with partial pivoting (independent of inv2). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
/** log N(x; 0, K) for 2-dim x */
const logpdf2 = (x: number[], K: M2) => {
  const u = solve(K, x);
  return -0.5 * (x[0] * u[0] + x[1] * u[1]) - 0.5 * Math.log(det2(K)) - Math.log(2 * Math.PI);
};
/** tr(K^-1 X X^T) from the Gaussian log likelihood identity (routes: logpdf and column solves). */
function dataFitByLikelihood(K: M2, X: M2): number {
  const cols = [[X[0][0], X[1][0]], [X[0][1], X[1][1]]];
  const ll = sum(cols.map(c => logpdf2(c, K)));
  const viaLikelihood = -2 * (ll + (2 / 2) * Math.log(det2(K)) + (2 * 2 / 2) * Math.log(2 * Math.PI));
  const viaSolve = sum(cols.map(c => { const u = solve(K, c); return c[0] * u[0] + c[1] * u[1]; }));
  expect(viaLikelihood).toBeCloseTo(viaSolve, 8);
  return viaSolve;
}
const XXt = (X: M2) => mul2(X, T2(X));
const XtX = (X: M2) => mul2(T2(X), X);
const M = (a: number, b: number, c: number, d: number): M2 => [[a, b], [c, d]];

// card 1
const covSigma = (p: Record<string, number>) => {
  const W = [[p.w11, p.w12], [p.w21, p.w22], [p.w31, p.w32]];
  const S = W.map((ri, a) => W.map((rj, b) => sum(ri.map((v, k) => v * rj[k])) + (a === b ? p.s2 : 0)));
  return S;
};
const covKey = (p: Record<string, number>) => covSigma(p)[p.i - 1][p.j - 1];
function covWrong(p: Record<string, number>): number[] {
  const rows = [[p.w11, p.w12], [p.w21, p.w22], [p.w31, p.w32]];
  const ri = rows[p.i - 1], rj = rows[p.j - 1];
  const key = ri[0] * rj[0] + ri[1] * rj[1];
  return [key + p.s2, p.w11 * p.w12 + p.w21 * p.w22 + p.w31 * p.w32, ri[0] * rj[0], ri[0] ** 2 + ri[1] ** 2 + p.s2, -key];
}
// card 2
const detKey = (p: Record<string, number>) => det2(M(p.a * p.a + p.s2, p.a * p.b, p.a * p.b, p.b * p.b + p.s2));
const detWrong = (p: Record<string, number>) => [(p.a ** 2 + p.s2) * (p.b ** 2 + p.s2), p.s2 ** 2, p.a ** 2 + p.b ** 2 + 2 * p.s2, p.s2 + p.a ** 2 + p.b ** 2];
// card 3
const countKey = (p: Record<string, number>) => new Array(p.N).fill(0).map(() => new Array(p.Q).fill(0)).flat().length;
const countWrong = (p: Record<string, number>) => [p.D * p.Q, p.N * p.D, p.N, p.Q * (p.N + p.D)];
// card 5
const dfK = (p: Record<string, number>) => M(p.ka, p.kb, p.kb, p.ka);
const dfX = (p: Record<string, number>) => M(p.x11, p.x12, p.x21, p.x22);
const fitKey = (p: Record<string, number>) => dataFitByLikelihood(dfK(p), dfX(p));
function fitWrong(p: Record<string, number>): number[] {
  const K = dfK(p), X = dfX(p), key = fitKey(p);
  return [tr2(mul2(inv2(K), XtX(X))), tr2(mul2(K, XXt(X))), key / 2, tr2(XXt(X)) / p.ka];
}
// card 6
const logN2 = (z: number[]) => -0.5 * (z[0] ** 2 + z[1] ** 2) - Math.log(2 * Math.PI);
const priorKey = (p: Record<string, number>) => {
  const zs = [[p.z11, p.z12], [p.z21, p.z22], [p.z31, p.z32]];
  return sum(zs.map(logN2)) - 3 * logN2([0, 0]);
};
function priorWrong(p: Record<string, number>): number[] {
  const zs = [[p.z11, p.z12], [p.z21, p.z22], [p.z31, p.z32]];
  const ss = sum(zs.map(z => z[0] ** 2 + z[1] ** 2));
  return [-ss, ss / 2, -sum(zs.flat().map(Math.abs)) / 2, -((zs[0][0] + zs[1][0] + zs[2][0]) ** 2 + (zs[0][1] + zs[1][1] + zs[2][1]) ** 2) / 2];
}
// card 7
function erf(x: number): number { // Abramowitz-Stegun 7.1.26 refined by series for accuracy 1e-12 via numeric integration
  const n = 2000, h = x / n;
  let s = 0;
  for (let k = 0; k <= n; k++) s += (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * Math.exp(-((k * h) ** 2));
  return 2 / Math.sqrt(Math.PI) * s * h / 3;
}
const cdf = (x: number, m: number, s: number) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
const intervalKey = (p: Record<string, number>) => p.m + 2 * Math.sqrt(p.S);
const intervalWrong = (p: Record<string, number>) => [p.m + 2 * p.S, p.m + Math.sqrt(p.S), p.m - 2 * Math.sqrt(p.S), 2 * Math.sqrt(p.S)];
// card 9
function challengeK(p: Record<string, number>): M2 {
  // exact covariance of x = Z w + eps with w ~ Rademacher (variance 1), eps_i = +-sqrt(s2) independent: average over the 8 sign patterns
  const z = [p.z1, p.z2], sd = Math.sqrt(p.s2);
  const K = [[0, 0], [0, 0]];
  for (let w of [-1, 1]) for (const e1 of [-1, 1]) for (const e2 of [-1, 1]) {
    const x = [z[0] * w + sd * e1, z[1] * w + sd * e2];
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) K[a][b] += x[a] * x[b] / 8;
  }
  return K as M2;
}
const chK = (p: Record<string, number>) => challengeK(p);
const chKey = (p: Record<string, number>) => dataFitByLikelihood(chK(p), M(p.x11, p.x12, p.x21, p.x22));
function chWrong(p: Record<string, number>): number[] {
  const K = chK(p), X = M(p.x11, p.x12, p.x21, p.x22), G = XXt(X);
  const out = [
    tr2(mul2(inv2(K), XtX(X))),
    tr2(mul2(K, G)),
    tr2(mul2(M(1 / K[0][0], 0, 0, 1 / K[1][1]), G)),
    tr2(G) / p.s2,
  ];
  const Kp = M(p.z1 ** 2 + p.s2, p.z1 * p.z2 + p.s2, p.z1 * p.z2 + p.s2, p.z2 ** 2 + p.s2);
  if (Math.abs(det2(Kp)) > 1e-9) out.push(tr2(mul2(inv2(Kp), G)));
  return out;
}

// ---------------------------------------------------------------- parse printed numbers from the prompt
type Parser = (prompt: string) => Record<string, number>;
const parsers: Record<string, Parser> = {
  'ppca-cov': prompt => {
    const W = matrixAfter(prompt, 'W =');
    expect(W.length).toBe(3);
    const cov = norm(prompt).match(/Cov\(x([₁₂₃]), x([₁₂₃])\)/)!;
    return { w11: W[0][0], w12: W[0][1], w21: W[1][0], w22: W[1][1], w31: W[2][0], w32: W[2][1], s2: scalarAfter(prompt, /σ² = (-?[\d./]+)/), i: SUB[cov[1]], j: SUB[cov[2]] };
  },
  'ppca-det': prompt => {
    const W = matrixAfter(prompt, 'W =');
    expect(W.flat().length).toBe(2);
    return { a: W.flat()[0], b: W.flat()[1], s2: scalarAfter(prompt, /σ² = (-?[\d./]+)/) };
  },
  'latent-count': prompt => ({ N: scalarAfter(prompt, /N = (\d+)/), D: scalarAfter(prompt, /D = (\d+)/), Q: scalarAfter(prompt, /Q = (\d+)/) }),
  'data-fit': prompt => {
    const K = matrixAfter(prompt, 'K = ', 1 /* first "K = K_ZZ" has no matrix */);
    const X = matrixAfter(prompt, 'X = ');
    return { ka: K[0][0], kb: K[0][1], x11: X[0][0], x12: X[0][1], x21: X[1][0], x22: X[1][1] };
  },
  'map-prior': prompt => {
    const Z = matrixAfter(prompt, 'Z = ');
    expect(Z.length).toBe(3);
    return { z11: Z[0][0], z12: Z[0][1], z21: Z[1][0], z22: Z[1][1], z31: Z[2][0], z32: Z[2][1] };
  },
  'bgplvm-interval': prompt => ({ m: scalarAfter(prompt, /mₙ = (-?[\d.]+)/), S: scalarAfter(prompt, /Sₙ = (-?[\d.]+)/) }),
  challenge: prompt => {
    const X = matrixAfter(prompt, 'X = ');
    return { z1: scalarAfter(prompt, /z₁ = (-?[\d.]+)/), z2: scalarAfter(prompt, /z₂ = (-?[\d.]+)/), s2: scalarAfter(prompt, /σ² = (-?[\d.]+)/), x11: X[0][0], x12: X[0][1], x21: X[1][0], x22: X[1][1] };
  },
};
const truth: Record<string, (p: Record<string, number>) => number> = {
  'ppca-cov': covKey, 'ppca-det': detKey, 'latent-count': countKey, 'data-fit': fitKey, 'map-prior': priorKey, 'bgplvm-interval': intervalKey, challenge: chKey,
};
const wrongRoutes: Record<string, (p: Record<string, number>) => number[]> = {
  'ppca-cov': covWrong, 'ppca-det': detWrong, 'latent-count': countWrong, 'data-fit': fitWrong, 'map-prior': priorWrong, 'bgplvm-interval': intervalWrong, challenge: chWrong,
};
const minGap: Record<string, number> = { 'ppca-cov': 1, 'ppca-det': 1, 'latent-count': 24, 'data-fit': 0.5, 'map-prior': 1, 'bgplvm-interval': 0.5, challenge: 0.5 };
const AUDIT_KEYS: Record<string, string[]> = {
  'ppca-cov': ['w11', 'w12', 'w21', 'w22', 'w31', 'w32', 's2', 'i', 'j'],
  'ppca-det': ['a', 'b', 's2'],
  'latent-count': ['N', 'D', 'Q'],
  'data-fit': ['ka', 'kb', 'x11', 'x12', 'x21', 'x22'],
  'map-prior': ['z11', 'z12', 'z21', 'z22', 'z31', 'z32'],
  'bgplvm-interval': ['m', 'S'],
  challenge: ['z1', 'z2', 's2', 'x11', 'x12', 'x21', 'x22'],
};
const FIELD_LABELS: Record<string, [string, string]> = {
  'ppca-det': ['|Σ|', '|Σ|'],
  'data-fit': ['tr(K⁻¹XXᵀ)', 'tr(K⁻¹XXᵀ)'],
  challenge: ['tr(K⁻¹XXᵀ)', 'tr(K⁻¹XXᵀ)'],
  'latent-count': ['Entries of Z', 'Z 的元素个数'],
  'map-prior': ['Part of log p(Z) that depends on Z', 'log p(Z) 中依赖于 Z 的部分'],
  'bgplvm-interval': ['Upper end', '上端点'],
};

// ---------------------------------------------------------------- plan sampling spaces (enumerated here, guards included)
const DF_PAIRS: [number, number][] = [[1.25, 0.75], [1.25, -0.75], [1.5, 0.5], [1.5, -0.5], [2.5, 1.5], [2.5, -1.5], [3, 1], [3, -1]];
type Space = { name: string; count: number; test: (p: Record<string, number>) => boolean };
function enumerate(slug: string, accept: (p: Record<string, number>) => boolean, gen: () => Generator<Record<string, number>>): number {
  let n = 0;
  for (const p of gen()) if (accept(p)) n++;
  void slug;
  return n;
}
const guardOk = (slug: string, p: Record<string, number>): boolean => {
  const key = truth[slug](p);
  return wrongRoutes[slug](p).every(w => Math.abs(w - key) >= minGap[slug] - 1e-9);
};
const denOk = (key: number) => { const d = denominator(key); return d !== null && allowedDen.has(d); };
const spaces: Record<string, Space> = {
  'ppca-cov': {
    name: 'ppca-cov', count: 65124, test: p => {
      const pairs = [[1, 2], [1, 3], [2, 3]];
      return [p.w11, p.w12, p.w21, p.w22, p.w31, p.w32].every(v => E5.includes(v)) && pairs.some(([i, j]) => i === p.i && j === p.j) && [1, 2, 3].includes(p.s2) && covKey(p) !== 0 && guardOk('ppca-cov', p);
    },
  },
  'ppca-det': { name: 'ppca-det', count: 108, test: p => [-3, -2, -1, 1, 2, 3].includes(p.a) && [-3, -2, -1, 1, 2, 3].includes(p.b) && [2, 3, 4].includes(p.s2) && guardOk('ppca-det', p) },
  'latent-count': { name: 'latent-count', count: 24, test: p => [100, 200, 500, 1000].includes(p.N) && [12, 20, 50].includes(p.D) && [2, 3].includes(p.Q) && guardOk('latent-count', p) },
  'data-fit': {
    name: 'data-fit', count: 1944, test: p => {
      if (!DF_PAIRS.some(([a, b]) => a === p.ka && b === p.kb)) return false;
      if (![p.x11, p.x12, p.x21, p.x22].every(v => E5.includes(v))) return false;
      const key = fitKey(p);
      return key >= 1 - 1e-9 && key <= 12 + 1e-9 && denOk(key) && guardOk('data-fit', p);
    },
  },
  'map-prior': {
    name: 'map-prior', count: 10084, test: p => {
      const z = [p.z11, p.z12, p.z21, p.z22, p.z31, p.z32];
      const ss = sum(z.map(v => v * v));
      return z.every(v => E5.includes(v)) && ss >= 4 && ss <= 14 && guardOk('map-prior', p);
    },
  },
  'bgplvm-interval': {
    name: 'bgplvm-interval', count: 48, test: p => range(-6, 6).map(v => v / 2).includes(p.m) && p.m !== 0 && [0.25, 2.25, 4, 9].includes(p.S) && guardOk('bgplvm-interval', p),
  },
  challenge: {
    name: 'challenge', count: 1572, test: p => {
      if (![-2, -1, 1, 2].includes(p.z1) || ![-2, -1, 1, 2].includes(p.z2) || ![1, 2, 3].includes(p.s2)) return false;
      if (![p.x11, p.x12, p.x21, p.x22].every(v => E5.includes(v))) return false;
      const key = chKey(p);
      return key >= 1 - 1e-9 && key <= 12 + 1e-9 && denOk(key) && guardOk('challenge', p);
    },
  },
};
function* gens(slug: string): Generator<Record<string, number>> {
  if (slug === 'ppca-cov') {
    for (const w11 of E5) for (const w12 of E5) for (const w21 of E5) for (const w22 of E5) for (const w31 of E5) for (const w32 of E5)
      for (const [i, j] of [[1, 2], [1, 3], [2, 3]]) for (const s2 of [1, 2, 3]) yield { w11, w12, w21, w22, w31, w32, i, j, s2 };
  } else if (slug === 'ppca-det') {
    for (const a of [-3, -2, -1, 1, 2, 3]) for (const b of [-3, -2, -1, 1, 2, 3]) for (const s2 of [2, 3, 4]) yield { a, b, s2 };
  } else if (slug === 'latent-count') {
    for (const N of [100, 200, 500, 1000]) for (const D of [12, 20, 50]) for (const Q of [2, 3]) yield { N, D, Q };
  } else if (slug === 'data-fit') {
    for (const [ka, kb] of DF_PAIRS) for (const x11 of E5) for (const x12 of E5) for (const x21 of E5) for (const x22 of E5) yield { ka, kb, x11, x12, x21, x22 };
  } else if (slug === 'map-prior') {
    for (const z11 of E5) for (const z12 of E5) for (const z21 of E5) for (const z22 of E5) for (const z31 of E5) for (const z32 of E5) yield { z11, z12, z21, z22, z31, z32 };
  } else if (slug === 'bgplvm-interval') {
    for (const m of range(-6, 6).map(v => v / 2)) for (const S of [0.25, 2.25, 4, 9]) yield { m, S };
  } else {
    for (const z1 of [-2, -1, 1, 2]) for (const z2 of [-2, -1, 1, 2]) for (const s2 of [1, 2, 3]) for (const x11 of E5) for (const x12 of E5) for (const x21 of E5) for (const x22 of E5) yield { z1, z2, s2, x11, x12, x21, x22 };
  }
}

// ---------------------------------------------------------------- text lints
const ZH_ALLOWED = new Set(['exp', 'log', 'ln', 'tr', 'Cov', 'Var', 'GP', 'KL', 'ELBO']);
const CJK = /[一-鿿]/;
function lintText(text: string, lang: Lang, where: string): string[] {
  const out: string[] = [];
  const bad = (name: string, re: RegExp) => { const m = re.exec(text); if (m) out.push(`${where} ${name}: …${text.slice(Math.max(0, m.index - 20), m.index + 30)}…`); };
  bad('ASCII hyphen minus', /(^|[\s(\[=+·,])-\s?[\d.]/);
  bad('caret', /\^(?!\{[NDQ×]+\})/);
  bad('braces', /(?<!\^)\{|(?<![×NDQ])\}/);
  bad('double parentheses', /\(\(−?\d|\d\)\)/);
  bad('raw float', /\d\.\d{4,}/);
  bad('developer marker', /undefined|NaN|Infinity|TODO|\[object|=>|\$\{|\bw1[12]\b|\bs2\b|\bka\b|\bkb\b|params?\./);
  bad('x = x restatement', /(?<![\w.])([A-Za-zσℓθ][^\s=]*) = (?![\w²])/);
  bad('1 coefficient', /(?<![\d.,A-Za-z^_/])1(?=[a-zA-Zπθρσℓ(])/);
  for (const sentence of text.split(/\.\s|[。;；]\s?|, (?:so|and|which)\s|，/)) if (/\d\.\d/.test(sentence) && /\d\/\d/.test(sentence.replace(/\(Lecture[^)]*\)/, ''))) out.push(`${where} mixed decimal and fraction: …${sentence.slice(0, 70)}…`);
  bad('a/1', /\d\/1(?!\d)/);
  bad('plus negative bare', /[+·] -\d/);
  bad('double sign', /[+−]\s*[+−]/);
  bad('two spaces', /\S {2,}\S/);
  if (lang === 'zh') {
    for (const m of text.matchAll(/[A-Za-z]{3,}/g)) {
      const w = m[0];
      if (!ZH_ALLOWED.has(w) && !/^[A-Z]{3,}$/.test(w) && !/^[A-Z]{2,}$/.test(w)) out.push(`${where} ZH Latin word ${w}`);
    }
    bad('ASCII comma touching CJK', /[一-鿿],|,[一-鿿]/);
    bad('ASCII paren touching CJK', /[一-鿿]\(|\)[一-鿿]/);
    bad('ASCII quote', /["']/);
  } else {
    bad('CJK in EN', CJK);
  }
  return out;
}

// ================================================================= tests
describe('GP-26 oracle: deck shape', () => {
  it('has the nine cards of the plan in order, in both languages, with full ids', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      expect(deck(i, lang).map(c => c.id)).toEqual(ORDER.map(s => `GP-26-${s}`));
    }
  });
  it('is deterministic and varies', () => {
    expect(JSON.stringify(deck(3, 'en'))).toBe(JSON.stringify(deck(3, 'en')));
    expect(new Set(Array.from({ length: SEEDS }, (_, i) => JSON.stringify(deck(i, 'en')))).size).toBeGreaterThan(30);
  });
  it('every number field has tolerance 0.006', () => {
    const bad = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) for (const f of c.fields ?? []) if (f.tolerance !== 0.006) bad.add(`${c.id} tolerance ${f.tolerance}`);
    expect([...bad]).toEqual([]);
  });
  it('has no figures anywhere', () => {
    for (let i = 0; i < SEEDS; i++) for (const c of deck(i, 'en')) { expect(c.figure, c.id).toBeUndefined(); expect(c.choice?.figures?.filter(Boolean) ?? [], c.id).toHaveLength(0); }
  });
  it('audit exists exactly on the seven numeric cards, with exactly the planned param names', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) {
      const slug = c.id.replace('GP-26-', '');
      if (NUMERIC.includes(slug)) {
        expect(c.audit?.kind, c.id).toBe(KIND(slug));
        expect(Object.keys(c.audit!.params).sort(), c.id).toEqual([...AUDIT_KEYS[slug]].sort());
        expect(c.fields, c.id).toHaveLength(1);
        expect(c.choice).toBeUndefined();
      } else {
        expect(c.audit, c.id).toBeUndefined();
        expect(c.choice, c.id).toBeDefined();
        expect(c.choice!.options).toHaveLength(4);
        expect(c.fields).toBeUndefined();
      }
    }
  });
});

describe('GP-26 oracle: numeric cards recomputed by an independent route', () => {
  for (const slug of NUMERIC) {
    it(`${slug}: answer, grading, printed text = audit, guards, plan space`, () => {
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const card = cardOf(deck(i, lang), slug);
        const where = `${slug} seed#${i} ${lang}`;
        const p = card.audit!.params as Record<string, number>;
        const key = truth[slug](p);
        // 1 answer
        expect(Math.abs(card.fields![0].answer - key), `${where} card ${card.fields![0].answer} vs oracle ${key} params ${JSON.stringify(p)}`).toBeLessThan(1e-9);
        const tol = card.fields![0].tolerance ?? 1e-8;
        for (const typed of [fractionText(key), String(key), key.toFixed(2).replace('-', '−')]) {
          // 2-decimal rounding of an eighth is allowed inside 0.006
          if (Math.abs(parseGameNumber(typed)! - key) <= 0.006) expect(gradeCard(card, [typed], null, []), `${where} typed ${typed}`).toBe('correct');
        }
        expect(gradeCard(card, [fractionText(key)], null, []), where).toBe('correct');
        expect(gradeCard(card, [String(key + 0.0075)], null, []), `${where} +`).toBe('incorrect');
        expect(gradeCard(card, [String(key - 0.0075)], null, []), `${where} -`).toBe('incorrect');
        expect(tol, `${where} tolerance`).toBe(0.006);
        // wrong routes
        for (const w of wrongRoutes[slug](p)) {
          expect(Math.abs(w - key), `${where} wrong route ${w} vs key ${key} params ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(minGap[slug] - 1e-9);
          expect(gradeCard(card, [String(w)], null, []), `${where} wrong route ${w} must grade wrong`).toBe('incorrect');
        }
        // denominators, ranges
        if (['data-fit', 'challenge'].includes(slug)) { expect(key).toBeGreaterThanOrEqual(1 - 1e-9); expect(key).toBeLessThanOrEqual(12 + 1e-9); }
        if (!['bgplvm-interval'].includes(slug)) expect(denOk(key), `${where} denominator of ${key}`).toBe(true);
        // 2 printed text = audit params
        const printed = parsers[slug](card.prompt);
        expect(printed, `${where} printed vs audit`).toEqual(p);
        // plan space membership
        expect(spaces[slug].test(p), `${where} outside plan sampling space ${JSON.stringify(p)}`).toBe(true);
        // labels
        if (FIELD_LABELS[slug]) expect(card.fields![0].label, where).toBe(FIELD_LABELS[slug][lang === 'en' ? 0 : 1]);
        if (slug === 'ppca-cov') expect(card.fields![0].label, where).toBe(`Cov(x${'₀₁₂₃'[p.i]}, x${'₀₁₂₃'[p.j]})`);
        fired++;
      }
      expect(fired).toBe(SEEDS * 2);
    });
  }
  it('card 7: key is a 2 s.d. upper end and the interval holds 95%', () => {
    for (let i = 0; i < SEEDS; i++) {
      const p = cardOf(deck(i, 'en'), 'bgplvm-interval').audit!.params as Record<string, number>;
      const key = cardOf(deck(i, 'en'), 'bgplvm-interval').fields![0].answer;
      const mass = cdf(key, p.m, Math.sqrt(p.S)) - cdf(p.m - (key - p.m), p.m, Math.sqrt(p.S));
      expect(mass).toBeGreaterThan(0.95);
      expect(mass).toBeLessThan(0.96);
    }
  });
  it('card 9: K estimated independently by exact enumeration equals ZZᵀ + σ²I', () => {
    for (let i = 0; i < SEEDS; i++) {
      const p = cardOf(deck(i, 'en'), 'challenge').audit!.params as Record<string, number>;
      const K = chK(p);
      expect(close(K[0][0], p.z1 ** 2 + p.s2)).toBe(true);
      expect(close(K[0][1], p.z1 * p.z2)).toBe(true);
      expect(close(K[1][1], p.z2 ** 2 + p.s2)).toBe(true);
    }
  });
  it('card 1: Σ is symmetric positive definite entry and the explicit moment E[x_i x_j] agrees', () => {
    for (let i = 0; i < SEEDS; i++) {
      const p = cardOf(deck(i, 'en'), 'ppca-cov').audit!.params as Record<string, number>;
      // exact moment over Rademacher latent z in {±1}² and noise sign patterns (variance s2 per feature), 4*8 outcomes
      const W = [[p.w11, p.w12], [p.w21, p.w22], [p.w31, p.w32]];
      let m = 0, count = 0;
      for (const z1 of [-1, 1]) for (const z2 of [-1, 1]) for (const e of [-1, 1]) for (const f of [-1, 1]) {
        const x = W.map(r => r[0] * z1 + r[1] * z2);
        const xi = x[p.i - 1] + (p.i === 1 ? Math.sqrt(p.s2) * e : p.i === 2 ? Math.sqrt(p.s2) * f : 0);
        const xj = x[p.j - 1] + (p.j === 1 ? Math.sqrt(p.s2) * e : p.j === 2 ? Math.sqrt(p.s2) * f : 0);
        m += xi * xj; count++;
      }
      // i != j so the noise of two different features is independent; E[e f] = 0 averages out (full independent noise patterns for each feature)
      expect(m / count).toBeCloseTo(covKey(p), 9);
    }
  });
});

describe('GP-26 oracle: plan sampling spaces equal the plan counts (enumerated, guards included)', () => {
  for (const slug of NUMERIC) {
    it(`${slug}: ${spaces[slug].count} sets`, () => {
      expect(enumerate(slug, spaces[slug].test, () => gens(slug))).toBe(spaces[slug].count);
    });
  }
});

describe('GP-26 oracle: shared structural gates', () => {
  it('deckProblems and textLintProblems are empty', () => {
    expect(deckProblems('GP-26', gp26, 'topic', 200)).toEqual([]);
    expect(textLintProblems('GP-26', gp26, 200)).toEqual([]);
  });
});

describe('GP-26 oracle: enumerated spaces of the generator', () => {
  it('data-fit and challenge draw from lists of exactly the plan sizes', () => {
    expect(gp26SpaceSizes).toEqual({ dataFit: 1944, challenge: 1572 });
  });
});

describe('GP-26 oracle: explanations show the same numbers as the answer', () => {
  const toNum = (t: string) => numbersIn(t)[0];
  it('data-fit and challenge: the column quadratic forms in the explanation are those of the columns of X and add to the key', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const slug of ['data-fit', 'challenge']) {
      const c = cardOf(deck(i, lang), slug);
      const p = c.audit!.params as Record<string, number>;
      const K = slug === 'data-fit' ? dfK(p) : chK(p);
      const cols = [[p.x11, p.x21], [p.x12, p.x22]];
      const q = cols.map(col => { const u = solve(K, col); return col[0] * u[0] + col[1] * u[1]; });
      const m = norm(c.explanation).match(/(-?\d+(?:\/\d+)?) \+ (-?\d+(?:\/\d+)?) = (-?\d+(?:\/\d+)?)(?=[;.。，])/g)!;
      const hit = m.find(x => { const [a, b, r] = x.replace(/[^\d/+=\- ]/g, '').split(/ \+ | = /).map(toNum); return Math.abs(a - q[0]) < 1e-9 && Math.abs(b - q[1]) < 1e-9 && Math.abs(r - (q[0] + q[1])) < 1e-9; });
      expect(hit, `${slug} ${lang} seed#${i} column forms ${q} not shown correctly in: ${c.explanation}`).toBeDefined();
    }
  });
  it('the explanation lists no two wrong routes with the same value twice (merged clauses)', () => {
    for (let i = 0; i < SEEDS; i++) for (const slug of ['ppca-cov', 'ppca-det', 'data-fit', 'map-prior', 'bgplvm-interval', 'challenge']) {
      const c = cardOf(deck(i, 'en'), slug);
      const p = c.audit!.params as Record<string, number>;
      const vals = wrongRoutes[slug](p).map(v => fractionText(Math.round(v * 1e6) / 1e6));
      const clauses = [...norm(c.explanation).matchAll(/(?:would give|both give) (-?\d+(?:\.\d+)?(?:\/\d+)?)/g)].map(m => m[1]);
      const seen = new Set<string>();
      for (const v of clauses) { expect(seen.has(v), `${slug} seed#${i} repeats a slip value ${v}: ${c.explanation}`).toBe(false); seen.add(v); }
      void vals;
    }
  });
});

describe('GP-26 oracle: choice cards', () => {
  const KERNELS_EN: [RegExp, string][] = [[/linear kernel/, 'linear'], [/squared exponential/, 'SE'], [/Matérn-1\/2/, 'M12'], [/Matérn-3\/2/, 'M32']];
  const KERNELS_ZH: [RegExp, string][] = [[/线性核/, 'linear'], [/平方指数核/, 'SE'], [/马特恩-1\/2/, 'M12'], [/马特恩-3\/2/, 'M32']];
  const kernelOf = (prompt: string, lang: Lang) => {
    const hits = (lang === 'en' ? KERNELS_EN : KERNELS_ZH).filter(([re]) => re.test(prompt)).map(([, k]) => k);
    expect(hits, prompt).toHaveLength(1);
    return hits[0];
  };
  const qOf = (prompt: string, lang: Lang) => Number((lang === 'en' ? prompt.match(/(\d+)-dimensional/) : prompt.match(/(\d+) 维/))![1]);
  it('closed-form: eigenvalue option only for linear, gradient option otherwise; exactly one correct; length rule', () => {
    const seen = new Set<string>(), idx = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = cardOf(deck(i, lang), 'closed-form');
      const k = kernelOf(c.prompt, lang), Q = qOf(c.prompt, lang);
      seen.add(`${k}${Q}`);
      expect([1, 2, 3]).toContain(Q);
      const eig = lang === 'en' ? /eigenvalue/ : /特征值问题/;
      const grad = lang === 'en' ? /gradient-based optimisation/ : /基于梯度的优化/;
      const isCorrect = (o: string) => (k === 'linear' ? eig.test(o) && /analytic solution exists|存在解析解/.test(o) : grad.test(o) && /No analytic solution|不存在解析解/.test(o));
      const verdicts = c.choice!.options.map(isCorrect);
      expect(verdicts.filter(Boolean), `${c.id} ${lang} ${k}`).toHaveLength(1);
      expect(verdicts[c.choice!.answer], `${c.id} ${lang} ${k} answer index`).toBe(true);
      idx.add(c.choice!.answer);
      const lens = c.choice!.options.map(o => [...o].length);
      const maxWrong = Math.max(...lens.filter((_, j) => j !== c.choice!.answer));
      expect(lens[c.choice!.answer], `${c.id} ${lang} correct option must be shorter than longest wrong`).toBeLessThan(maxWrong);
      expect(new Set(c.choice!.options).size).toBe(4);
      // convex / conditioning options are never the answer
      expect(/convex|凸/.test(c.choice!.options[c.choice!.answer]) && !/non|非/.test(c.choice!.options[c.choice!.answer])).toBe(false);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
    expect(idx.size).toBeGreaterThan(1);
  });
  it('not-gaussian: the non-linear-dependence option is the one correct on every draw; length rule', () => {
    const seen = new Set<string>(), idx = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = cardOf(deck(i, lang), 'not-gaussian');
      const k = kernelOf(c.prompt, lang), Q = qOf(c.prompt, lang);
      seen.add(`${k}${Q}`);
      const isCorrect = (o: string) => (lang === 'en' ? /non-linearly/.test(o) && /inverse/.test(o) && /determinant/.test(o) && /no closed form/.test(o) : /非线性/.test(o) && /逆/.test(o) && /行列式/.test(o) && /无解析形式/.test(o));
      const verdicts = c.choice!.options.map(isCorrect);
      expect(verdicts.filter(Boolean), `${c.id} ${lang}`).toHaveLength(1);
      expect(verdicts[c.choice!.answer], `${c.id} ${lang} answer index`).toBe(true);
      idx.add(c.choice!.answer);
      const lens = c.choice!.options.map(o => [...o].length);
      expect(lens[c.choice!.answer], `${c.id} ${lang}`).toBeLessThan(Math.max(...lens.filter((_, j) => j !== c.choice!.answer)));
      expect(new Set(c.choice!.options).size).toBe(4);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
    expect(idx.size).toBeGreaterThan(1);
  });
});

describe('GP-26 oracle: variety, text, language', () => {
  it('each card has at least 6 distinct prompts over 60 seeds', () => {
    for (const slug of ORDER) {
      const prompts = new Set(Array.from({ length: SEEDS }, (_, i) => cardOf(deck(i, 'en'), slug).prompt));
      expect(prompts.size, slug).toBeGreaterThanOrEqual(6);
    }
  });
  it('learner-visible text passes the typography and language lints in both languages', () => {
    const problems: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) {
      for (const text of textOf(c)) {
        if (!text) continue;
        for (const line of lintText(text, lang, `${c.id} [${lang}]`)) if (!problems.includes(line)) problems.push(line);
      }
    }
    expect(problems.slice(0, 40)).toEqual([]);
  });
  it('hints and explanations: the hint does not contain the answer; the explanation states the key', () => {
    for (let i = 0; i < SEEDS; i++) for (const slug of NUMERIC) {
      const c = cardOf(deck(i, 'en'), slug);
      const key = c.fields![0].answer;
      const shown = (v: number) => [norm(String(v)), norm(fractionText(v))];
      const expl = norm(c.explanation);
      expect(shown(key).some(s => expl.includes(s)) || (Math.abs(key) < 1e-9 && expl.includes('0')) || expl.includes(norm(key.toFixed(2))), `${slug} explanation lacks the key ${key}: ${c.explanation}`).toBe(true);
      if (Math.abs(key) >= 10 || !Number.isInteger(key)) expect(norm(c.hint), `${slug} hint contains key`).not.toMatch(new RegExp(`(?<![\\d.])${String(key).replace('.', '\\.').replace('-', '-')}(?![\\d.])`));
    }
  });
  it('question text contains every audit parameter literally (hidden-input check)', () => {
    for (let i = 0; i < SEEDS; i++) for (const slug of NUMERIC) {
      const c = cardOf(deck(i, 'en'), slug);
      const visible = new Set(questionTextOf(c).flatMap(t => numbersIn(t)).map(v => Math.abs(Number(v.toFixed(6)))));
      for (const [k, v] of Object.entries(c.audit!.params)) expect(visible.has(Math.abs(v as number)), `${slug} param ${k}=${v}`).toBe(true);
    }
  });
});
