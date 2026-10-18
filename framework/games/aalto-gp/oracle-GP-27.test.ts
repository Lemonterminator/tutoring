import { describe, expect, it } from 'vitest';
import { gp27 } from './games/gp27';
import { deckProblems, spreadSeed, textLintProblems, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-27 (multi-output GPs). Written from docs/aalto-gp-drafts/approved-GP-27.md only.
 * Numeric cards are recomputed with explicit Kronecker products and a hand-written Gauss-Jordan inverse.
 */
const SEEDS = 60;
const SWEEP = 50000;
const LANGS: GameLanguage[] = ['en', 'zh'];
const ID = 'GP-27';
const ORDER = ['kron-dim', 'kron-inverse', 'imc-cov', 'slfm-cov', 'lmc-var', 'which-model', 'psd-limit', 'zero-cross', 'challenge'];
const KINDS = ['kron-dim', 'kron-inverse', 'imc-cov', 'slfm-cov', 'lmc-var', 'psd-limit', 'challenge'];
const NUMERIC = KINDS;

const norm = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ');
const nums = (text: string) => [...norm(text).matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
const SUB: Record<string, number> = { '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 };
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

type Mat = number[][];
const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => Array<number>(c).fill(0));
const outer = (a: number[]): Mat => a.map(x => a.map(y => x * y));
const addM = (a: Mat, b: Mat): Mat => a.map((row, i) => row.map((x, j) => x + b[i][j]));
function kron(A: Mat, B: Mat): Mat {
  const out = zeros(A.length * B.length, A[0].length * B[0].length);
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++)
    for (let k = 0; k < B.length; k++) for (let l = 0; l < B[0].length; l++) out[i * B.length + k][j * B[0].length + l] = A[i][j] * B[k][l];
  return out;
}
function inverse(M: Mat): Mat {
  const n = M.length;
  const W = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    [W[c], W[p]] = [W[p], W[c]];
    const d = W[c][c];
    expect(Math.abs(d)).toBeGreaterThan(1e-12);
    W[c] = W[c].map(x => x / d);
    for (let r = 0; r < n; r++) if (r !== c) { const f = W[r][c]; W[r] = W[r].map((x, j) => x - f * W[c][j]); }
  }
  return W.map(row => row.slice(n));
}
const kernel2 = (k: number): Mat => [[1, k], [k, 1]];

/* ---------- exact rationals for the denominator predicate ---------- */
type Fr = [number, number];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fr = (n: number, d = 1): Fr => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return [s * n / g, s * d / g]; };
const fmul = (a: Fr, b: Fr) => fr(a[0] * b[0], a[1] * b[1]);
const fdiv = (a: Fr, b: Fr) => fr(a[0] * b[1], a[1] * b[0]);
const fsub = (a: Fr, b: Fr) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const ffrom = (x: number): Fr => fr(Math.round(x * 4), 4);

/* ---------- parsing the visible question ---------- */
const vectors = (text: string): number[][] => [...norm(text).matchAll(/=\s*\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
const grab = (text: string, re: RegExp): number => { const m = norm(text).match(re); if (!m) throw new Error(`no match ${re} in ${text.slice(0, 80)}`); return Number(m[1]); };
const matrices = (text: string): number[][][] => [...norm(text).matchAll(/\[\[([^\]]*)\],\s*\[([^\]]*)\]\]/g)].map(m => [m[1], m[2]].map(r => r.split(',').map(Number)));
const NUM = String.raw`(-?\d+(?:\.\d+)?)`;

/* ---------- the plan's sampling spaces and wrong routes ---------- */
const W4 = [-2, -1, 1, 2];
const KS = [0.25, 0.5, 0.75];
const ABPAIRS: [number, number][] = [[1.25, 0.75], [1.25, -0.75], [1.5, 0.5], [1.5, -0.5], [2.5, 1.5], [2.5, -1.5], [3, 2], [3, -2]];
const DS = [0.25, 0.5, 2, 4];
const GAP = (key: number, routes: number[], gap: number) => routes.every(r => Math.abs(r - key) >= gap - 1e-9);

const kronDimRoutes = (m: number, n: number, p: number, q: number) => [(m + p) * (n + q), m * n + p * q, m * p + n * q, m * n * p];
const kronDimKey = (m: number, n: number, p: number, q: number) => m * p * n * q;
function kronInvKeyFr(a: number, b: number, d1: number): Fr { return fdiv(fdiv(fmul(ffrom(-1), ffrom(b)), fsub(fmul(ffrom(a), ffrom(a)), fmul(ffrom(b), ffrom(b)))), ffrom(d1)); }
function kronInvRoutes(a: number, b: number, d1: number, d2: number) {
  const det = a * a - b * b;
  return [-b * d1 / det, b / d1, a / (det * d1), -b / (det * d2), 1 / (b * d1), b * d1];
}
const imcKey = (p1: number, p2: number, q1: number, q2: number, k: number) => (p1 * p2 + q1 * q2) * k;
const imcRoutes = (p1: number, p2: number, q1: number, q2: number, k: number) =>
  [p1 * p2 * k, q1 * q2 * k, p1 * p2 + q1 * q2, (p1 + q1) * (p2 + q2) * k, (p1 * q2 + q1 * p2) * k];
const slfmKey = (a11: number, a12: number, a21: number, a22: number, k1: number, k2: number) => a11 * a12 * k1 + a21 * a22 * k2;
const slfmRoutes = (a11: number, a12: number, a21: number, a22: number, k1: number, k2: number) => {
  const s = a11 * a12 + a21 * a22;
  return [s * k1, s * k2, a11 * a12 * k1, a21 * a22 * k2, a11 * a12 * k2 + a21 * a22 * k1];
};
function lmcParts(w: number[], v1: number, v2: number, j: number) {
  const [p1, p2, q1, q2, r1, r2] = w;
  const pick = (x: number, y: number) => (j === 1 ? x : y);
  const a = pick(p1, p2), b = pick(q1, q2), c = pick(r1, r2);
  const a_ = pick(p2, p1), b_ = pick(q2, q1), c_ = pick(r2, r1);
  const key = v1 * (a * a + b * b) + v2 * c * c;
  const routes = [v1 * (a + b) ** 2 + v2 * c * c, v1 * (a + b) + v2 * c, v1 * (a * a + b * b + c * c), a * a + b * b + c * c, v1 * (a_ * a_ + b_ * b_) + v2 * c_ * c_];
  return { key, routes };
}
const PSD_VALUES = [1, 2, 4, 8, 9, 16, 18];
const psdRoutes = (b11: number, b22: number) => [(b11 + b22) / 2, b11 * b22, b11 + b22, Math.min(b11, b22), Math.max(b11, b22), Math.abs(b11 - b22)];
function challengeParts(w: number[], k1: number, k2: number, row: number, col: number) {
  const [p1, p2, q1, q2, r1, r2] = w;
  const B1 = addM(outer([p1, p2]), outer([q1, q2])), B2 = outer([r1, r2]);
  const K1 = kernel2(k1), K2 = kernel2(k2);
  const o = (r: number) => (r <= 2 ? 0 : 1), i = (r: number) => (r - 1) % 2;
  const key = B1[o(row)][o(col)] * K1[i(row)][i(col)] + B2[o(row)][o(col)] * K2[i(row)][i(col)];
  const t1 = B1[o(row)][o(col)] * K1[i(row)][i(col)], t2 = B2[o(row)][o(col)] * K2[i(row)][i(col)];
  const first = outer([p1, p2]);
  const classP = row <= 2 === col <= 2;
  const routes = [
    K1[o(row)][o(col)] * B1[i(row)][i(col)] + K2[o(row)][o(col)] * B2[i(row)][i(col)],
    t1, t2,
    first[o(row)][o(col)] * K1[i(row)][i(col)] + t2,
    classP ? addM(B1, B2)[o(row)][o(col)] * K1[i(row)][i(col)] : B1[0][1] * k1 + B2[0][1] * k2,
  ];
  return { key, routes };
}

type Space = { names: string[]; size: number; tuples: Set<string> };
const tup = (vals: number[]) => vals.join(',');
function buildSpaces(): Record<string, Space> {
  const S: Record<string, Space> = {};
  const add = (kind: string, names: string[], list: number[][]) => { S[kind] = { names, size: list.length, tuples: new Set(list.map(tup)) }; };
  { const L: number[][] = [];
    for (let m = 1; m <= 4; m++) for (let n = 1; n <= 4; n++) for (let p = 1; p <= 4; p++) for (let q = 1; q <= 4; q++)
      if (GAP(kronDimKey(m, n, p, q), kronDimRoutes(m, n, p, q), 1)) L.push([m, n, p, q]);
    add('kron-dim', ['m', 'n', 'p', 'q'], L); }
  { const L: number[][] = [];
    for (const [a, b] of ABPAIRS) for (const d1 of DS) for (const d2 of DS) {
      if (d1 === d2) continue;
      const key = kronInvKeyFr(a, b, d1);
      if (![1, 2, 4, 5, 8, 10].includes(key[1])) continue;
      if (GAP(key[0] / key[1], kronInvRoutes(a, b, d1, d2), 0.25)) L.push([a, b, d1, d2]);
    }
    add('kron-inverse', ['a', 'b', 'd1', 'd2'], L); }
  { const L: number[][] = [];
    for (const p1 of W4) for (const p2 of W4) for (const q1 of W4) for (const q2 of W4) for (const k of KS) {
      if (p1 * p2 + q1 * q2 === 0) continue;
      if (GAP(imcKey(p1, p2, q1, q2, k), imcRoutes(p1, p2, q1, q2, k), 0.25)) L.push([p1, p2, q1, q2, k]);
    }
    add('imc-cov', ['p1', 'p2', 'q1', 'q2', 'k'], L); }
  { const L: number[][] = [];
    for (const a11 of W4) for (const a12 of W4) for (const a21 of W4) for (const a22 of W4) for (const k1 of KS) for (const k2 of KS) {
      if (k1 === k2) continue;
      const key = slfmKey(a11, a12, a21, a22, k1, k2);
      if (key === 0) continue;
      if (GAP(key, slfmRoutes(a11, a12, a21, a22, k1, k2), 0.25)) L.push([a11, a12, a21, a22, k1, k2]);
    }
    add('slfm-cov', ['a11', 'a12', 'a21', 'a22', 'k1', 'k2'], L); }
  { const L: number[][] = [];
    const V = [0.5, 1, 1.5, 2];
    for (const p1 of W4) for (const p2 of W4) for (const q1 of W4) for (const q2 of W4) for (const r1 of W4) for (const r2 of W4)
      for (const v1 of V) for (const v2 of V) for (const j of [1, 2]) {
        if (v1 === v2) continue;
        const { key, routes } = lmcParts([p1, p2, q1, q2, r1, r2], v1, v2, j);
        if (GAP(key, routes, 0.5)) L.push([p1, p2, q1, q2, r1, r2, v1, v2, j]);
      }
    add('lmc-var', ['p1', 'p2', 'q1', 'q2', 'r1', 'r2', 'v1', 'v2', 'j'], L); }
  { const L: number[][] = [];
    for (const b11 of PSD_VALUES) for (const b22 of PSD_VALUES) {
      if (b11 === b22) continue;
      const r = Math.sqrt(b11 * b22);
      if (!Number.isInteger(r)) continue;
      if (GAP(r, psdRoutes(b11, b22), 0.5)) L.push([b11, b22]);
    }
    add('psd-limit', ['b11', 'b22'], L); }
  { const L: number[][] = [];
    const cells = [[1, 2], [2, 1], [3, 4], [4, 3], [1, 3], [2, 4], [3, 1], [4, 2]];
    for (const p1 of W4) for (const p2 of W4) for (const q1 of W4) for (const q2 of W4) for (const r1 of W4) for (const r2 of W4)
      for (const k1 of KS) for (const k2 of KS) for (const [row, col] of cells) {
        if (k1 === k2) continue;
        const { key, routes } = challengeParts([p1, p2, q1, q2, r1, r2], k1, k2, row, col);
        if (key === 0) continue;
        if (GAP(key, routes, 0.25)) L.push([p1, p2, q1, q2, r1, r2, k1, k2, row, col]);
      }
    add('challenge', ['p1', 'p2', 'q1', 'q2', 'r1', 'r2', 'k1', 'k2', 'row', 'col'], L); }
  return S;
}
const WHICH_SPACE: number[][] = (() => {
  const L: number[][] = [];
  for (const s1 of [2, 3, 4, 5]) L.push([1, s1, 0, 0, 0]);
  for (const Q of [2, 3, 4]) L.push([Q, 1, 1, Q >= 3 ? 1 : 0, Q >= 4 ? 1 : 0]);
  for (const s1 of [1, 2, 3]) for (const s2 of [1, 2, 3]) if (!(s1 === 1 && s2 === 1)) L.push([2, s1, s2, 0, 0]);
  for (const s1 of [1, 2]) for (const s2 of [1, 2]) for (const s3 of [1, 2]) if (!(s1 === 1 && s2 === 1 && s3 === 1)) L.push([3, s1, s2, s3, 0]);
  return L;
})();

/* ---------- decks ---------- */
const deck = (seed: number, lang: GameLanguage): PracticeCard[] => gp27(seed, lang);
const byKind = (cards: PracticeCard[], kind: string) => { const c = cards.find(x => x.id === `${ID}-${kind}`); expect(c, `${ID}-${kind} missing`).toBeDefined(); return c!; };

/** Oracle for each audit kind: parameters in, expected answer out, by explicit matrix algebra. */
const oracle: Record<string, (p: Record<string, number>) => number> = {
  'GP-27:kron-dim': p => kron(Array.from({ length: p.m }, () => Array(p.n).fill(1)), Array.from({ length: p.p }, () => Array(p.q).fill(1))).reduce((s, r) => s + r.length, 0),
  'GP-27:kron-inverse': p => inverse(kron([[p.a, p.b], [p.b, p.a]], [[p.d1, 0], [0, p.d2]]))[0][2],
  'GP-27:imc-cov': p => kron(addM(outer([p.p1, p.p2]), outer([p.q1, p.q2])), kernel2(p.k))[0][3],
  'GP-27:slfm-cov': p => kron(outer([p.a11, p.a12]), kernel2(p.k1))[0][3] + kron(outer([p.a21, p.a22]), kernel2(p.k2))[0][3],
  'GP-27:lmc-var': p => { const C = addM(addM(outer([p.p1, p.p2]).map(r => r.map(x => x * p.v1)), outer([p.q1, p.q2]).map(r => r.map(x => x * p.v1))), outer([p.r1, p.r2]).map(r => r.map(x => x * p.v2))); return C[p.j - 1][p.j - 1]; },
  'GP-27:psd-limit': p => {
    // largest c with smallest eigenvalue of [[b11, c], [c, b22]] >= 0, by bisection on the eigenvalue (not the closed form)
    const lam = (c: number) => { const t = p.b11 + p.b22, d = p.b11 * p.b22 - c * c; return (t - Math.sqrt(Math.max(0, t * t - 4 * d))) / 2; };
    let lo = 0, hi = p.b11 + p.b22;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (lam(mid) >= -1e-13) lo = mid; else hi = mid; }
    return lo;
  },
  'GP-27:challenge': p => { const M = addM(kron(addM(outer([p.p1, p.p2]), outer([p.q1, p.q2])), kernel2(p.k1)), kron(outer([p.r1, p.r2]), kernel2(p.k2))); return M[p.row - 1][p.col - 1]; },
};

/** Parse the sampled numbers back out of the printed prompt. */
function printed(kind: string, card: PracticeCard): Record<string, number> {
  const t = card.prompt;
  switch (kind) {
    case 'kron-dim': return { m: grab(t, /\bm = (\d+)/), n: grab(t, /\bn = (\d+)/), p: grab(t, /\bp = (\d+)/), q: grab(t, /\bq = (\d+)/) };
    case 'kron-inverse': {
      const [A, B] = matrices(t);
      expect(A[0][0], 'A diagonal symmetric').toBe(A[1][1]); expect(A[0][1], 'A symmetric').toBe(A[1][0]);
      expect(B[0][1], 'B off-diagonal zero shown').toBe(0); expect(B[1][0]).toBe(0);
      return { a: A[0][0], b: A[0][1], d1: B[0][0], d2: B[1][1] };
    }
    case 'imc-cov': { const [a, b] = vectors(t); return { p1: a[0], p2: a[1], q1: b[0], q2: b[1], k: grab(t, new RegExp(String.raw`k\(x₁, x₂\) = ${NUM}`)) }; }
    case 'slfm-cov': { const [a, b] = vectors(t); return { a11: a[0], a12: a[1], a21: b[0], a22: b[1], k1: grab(t, new RegExp(String.raw`k₁\(x₁, x₂\) = ${NUM}`)), k2: grab(t, new RegExp(String.raw`k₂\(x₁, x₂\) = ${NUM}`)) }; }
    case 'lmc-var': {
      const [a, b, c] = vectors(t);
      const j = SUB[norm(t).match(/Var\(f([₀-₉])\(x\)\)/)![1]];
      return { p1: a[0], p2: a[1], q1: b[0], q2: b[1], r1: c[0], r2: c[1], v1: grab(t, new RegExp(String.raw`k₁\(x, x\) = ${NUM}`)), v2: grab(t, new RegExp(String.raw`k₂\(x, x\) = ${NUM}`)), j };
    }
    case 'psd-limit': { const m = norm(t).match(/\[\[(\d+), c\], \[c, (\d+)\]\]/)!; return { b11: Number(m[1]), b22: Number(m[2]) }; }
    case 'challenge': {
      const [a, b, c] = vectors(t);
      const rc = norm(t).match(/row (\d+) and column (\d+)/) ?? norm(t).match(/第 (\d+) 行第 (\d+) 列/);
      return { p1: a[0], p2: a[1], q1: b[0], q2: b[1], r1: c[0], r2: c[1], k1: grab(t, new RegExp(String.raw`k₁\(x₁, x₂\) = ${NUM}`)), k2: grab(t, new RegExp(String.raw`k₂\(x₁, x₂\) = ${NUM}`)), row: Number(rc![1]), col: Number(rc![2]) };
    }
  }
  throw new Error(kind);
}

/** Wrong routes of the plan, for every numeric kind. */
function wrongRoutes(kind: string, p: Record<string, number>): number[] {
  switch (kind) {
    case 'kron-dim': return kronDimRoutes(p.m, p.n, p.p, p.q);
    case 'kron-inverse': return kronInvRoutes(p.a, p.b, p.d1, p.d2);
    case 'imc-cov': return imcRoutes(p.p1, p.p2, p.q1, p.q2, p.k);
    case 'slfm-cov': return slfmRoutes(p.a11, p.a12, p.a21, p.a22, p.k1, p.k2);
    case 'lmc-var': return lmcParts([p.p1, p.p2, p.q1, p.q2, p.r1, p.r2], p.v1, p.v2, p.j).routes;
    case 'psd-limit': return psdRoutes(p.b11, p.b22);
    case 'challenge': return challengeParts([p.p1, p.p2, p.q1, p.q2, p.r1, p.r2], p.k1, p.k2, p.row, p.col).routes;
  }
  throw new Error(kind);
}
const GAPS: Record<string, number> = { 'kron-dim': 1, 'kron-inverse': 0.25, 'imc-cov': 0.25, 'slfm-cov': 0.25, 'lmc-var': 0.5, 'psd-limit': 0.5, 'challenge': 0.25 };

/** All numeric tokens (decimals and fractions, unicode minus normalised) of a text, as numbers. */
function tokens(text: string): number[] {
  return [...norm(text).matchAll(/-?\d+(?:\.\d+)?(?:\/\d+)?/g)].map(m => { const [n, d] = m[0].split('/'); return d ? Number(n) / Number(d) : Number(n); });
}
const appears = (text: string, v: number) => tokens(text).some(x => close(x, v, 1e-9));

describe('GP-27 deck shape', () => {
  it('has the nine cards in order with full ids, no figures, and 0.006 tolerance', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = deck(spreadSeed(i), lang);
      expect(cards.map(c => c.id)).toEqual(ORDER.map(s => `${ID}-${s}`));
      for (const c of cards) {
        expect(c.figure, c.id).toBeUndefined();
        expect(c.choice?.figures, c.id).toBeUndefined();
        expect(c.slots, c.id).toBeUndefined();
        if (c.fields) expect(c.fields).toHaveLength(1);
      }
      for (const kind of ['which-model', 'zero-cross']) expect(byKind(cards, kind).choice!.options).toHaveLength(4);
    }
  });
  it('every number field has tolerance 0.006', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(spreadSeed(i), lang)) if (c.fields) expect(c.fields[0].tolerance, c.id).toBe(0.006);
  });
  it('titles and field labels follow the plan', () => {
    const T: Record<string, [string, string]> = {
      'kron-dim': ['Size of a Kronecker product', '克罗内克积的大小'], 'kron-inverse': ['Inverting a Kronecker product', '克罗内克积的逆'],
      'imc-cov': ['Cross-covariance in an IMC', 'IMC 中的互协方差'], 'slfm-cov': ['Cross-covariance in an SLFM', 'SLFM 中的互协方差'],
      'lmc-var': ['Variance of one output of an LMC', 'LMC 中一个输出的方差'], 'which-model': ['IMC, SLFM or LMC?', 'IMC、SLFM 还是 LMC？'],
      'psd-limit': ['How strong can the cross term be?', '互协方差项最大能取多大？'], 'zero-cross': ['A zero cross term', '为零的互协方差项'],
      'challenge': ['Challenge: an entry of an LMC covariance', '挑战：LMC 协方差矩阵的一个元素'],
    };
    const L: Record<string, [string, string]> = {
      'kron-dim': ['Number of entries', '元素个数'], 'kron-inverse': ['Entry (1, 3) of (A ⊗ B)⁻¹', '(A ⊗ B)⁻¹ 的第 (1, 3) 个元素'],
      'imc-cov': ['Cov(f₁(x₁), f₂(x₂))', 'Cov(f₁(x₁), f₂(x₂))'], 'slfm-cov': ['Cov(f₁(x₁), f₂(x₂))', 'Cov(f₁(x₁), f₂(x₂))'],
      'psd-limit': ['Largest c', 'c 的最大值'], 'challenge': ['Entry of C', 'C 的元素'],
    };
    for (let i = 0; i < SEEDS; i++) for (const [li, lang] of LANGS.entries()) {
      const cards = deck(spreadSeed(i), lang);
      for (const k of ORDER) expect(byKind(cards, k).title).toBe(T[k][li]);
      for (const [k, v] of Object.entries(L)) expect(byKind(cards, k).fields![0].label).toBe(v[li]);
      const j = printed('lmc-var', byKind(cards, 'lmc-var')).j;
      expect(byKind(cards, 'lmc-var').fields![0].label).toBe(`Var(f${'₀₁₂₃₄₅₆₇₈₉'[j]}(x))`);
    }
  });
});

describe('GP-27 numeric audit kinds: 60 spread seeds x EN and ZH', () => {
  for (const kind of KINDS) {
    it(`${kind}: audit fires, params = printed text, answer = independent recomputation, grading honours the 0.006 tolerance`, () => {
      const auditKind = `${ID}:${kind}`;
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const seed = spreadSeed(i);
        const card = byKind(deck(seed, lang), kind);
        const where = `${kind} seed ${seed} ${lang}`;
        expect(card.audit?.kind, where).toBe(auditKind);
        const params = card.audit!.params as Record<string, number>;
        const shown = printed(kind, card);
        expect(Object.keys(params).sort(), `${where}: param names`).toEqual(Object.keys(shown).sort());
        for (const name of Object.keys(shown)) expect(params[name], `${where}: ${name} audit vs printed`).toBe(shown[name]);
        const key = oracle[auditKind](params);
        expect(card.fields![0].answer, `${where}: ${JSON.stringify(params)} expected ${key} got ${card.fields![0].answer}`).toBeCloseTo(key, 9);
        // the accepted answer grades correct, a perturbation beyond the tolerance grades wrong
        expect(gradeCard(card, [String(key)], null, []), where).toBe('correct');
        expect(gradeCard(card, [key.toFixed(2)], null, []), `${where} 2 decimals`).toBe('correct');
        expect(gradeCard(card, [String(key + 0.0065)], null, []), where).toBe('incorrect');
        expect(gradeCard(card, [String(key - 0.0065)], null, []), where).toBe('incorrect');
        // every wrong route misses the key by at least the plan's gap and grades wrong
        for (const w of wrongRoutes(kind, params)) {
          expect(Math.abs(w - key), `${where}: wrong route ${w} vs key ${key}`).toBeGreaterThanOrEqual(GAPS[kind] - 1e-9);
          expect(gradeCard(card, [String(w)], null, []), `${where}: wrong route ${w}`).toBe('incorrect');
        }
      }
    });
  }
  it('has no unknown audit kinds and no audit on the choice cards', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(spreadSeed(i), lang)) {
      if (c.audit) expect(NUMERIC.map(k => `${ID}:${k}`), c.id).toContain(c.audit.kind);
      else expect(['which-model', 'zero-cross'].map(k => `${ID}-${k}`), c.id).toContain(c.id);
    }
  });
  it('explanations show the key and every wrong route of the plan', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = deck(spreadSeed(i), lang);
      for (const kind of KINDS) {
        const c = byKind(cards, kind);
        const params = c.audit!.params as Record<string, number>;
        const key = c.fields![0].answer;
        expect(appears(c.explanation, key), `${kind} ${lang} key ${key} not in explanation: ${c.explanation}`).toBe(true);
        for (const w of wrongRoutes(kind, params)) expect(appears(c.explanation, w), `${kind} ${lang} params ${JSON.stringify(params)} route ${w} not in explanation: ${c.explanation}`).toBe(true);
      }
    }
  });
});

describe('GP-27 choice cards', () => {
  const lens = (s: string) => [...s].length;
  const kindOf = (text: string): string => {
    if (/regression network|回归网络/.test(text)) return 'gprn';
    if (/semiparametric|半参数/.test(text)) return 'slfm';
    if (/intrinsic|内蕴/.test(text)) return 'imc';
    if (/general linear model|一般的线性/.test(text)) return 'lmc';
    return 'other';
  };
  const zeroKind = (text: string): string => {
    if (/block diagonal|分块对角/.test(text) && /independent|独立/.test(text) && !/correlated|相关/.test(text.replace(/Gaussian/, ''))) return 'independent';
    if (/perfectly correlated|完全相关/.test(text)) return 'w1';
    if (/singular|奇异/.test(text)) return 'w3';
    if (/still correlated|仍通过/.test(text)) return 'w2';
    return 'other';
  };
  it('which-model: one option per class, the card points at the class given by Q and S, GPRN never right, correct option shorter than the longest wrong', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = byKind(deck(spreadSeed(i), lang), 'which-model');
      const text = norm(c.prompt);
      const Q = Number(text.match(/Q = (\d)/)![1]);
      const S = [...text.matchAll(/S([₁-₄1-4]) = (\d+)/g)].map(m => Number(m[2]));
      expect(S.length, `${lang} ${c.prompt}`).toBe(Q);
      const subs = [...text.matchAll(/S([₁-₄1-4]) = \d+/g)].map(m => SUB[m[1]] ?? Number(m[1]));
      expect(subs).toEqual(Array.from({ length: Q }, (_, n) => n + 1));
      const joined = S.map((s, n) => `S${'₁₂₃₄'[n]} = ${s}`).join(lang === 'en' ? ', ' : '、');
      expect(text, 'list separators').toContain(joined);
      const expected = Q === 1 ? 'imc' : S.every(s => s === 1) ? 'slfm' : 'lmc';
      if (Q === 1) expect(S[0]).toBeGreaterThanOrEqual(2);
      const kinds = c.choice!.options.map(kindOf);
      expect([...kinds].sort()).toEqual(['gprn', 'imc', 'lmc', 'slfm']);
      expect(kinds[c.choice!.answer], `${lang} Q=${Q} S=${S}`).toBe(expected);
      const lengths = c.choice!.options.map(lens);
      const wrongMax = Math.max(...lengths.filter((_, n) => n !== c.choice!.answer));
      expect(lengths[c.choice!.answer], `${lang} correct option not shorter than longest wrong`).toBeLessThan(wrongMax);
    }
  });
  it('zero-cross: the block-diagonal option is correct on every draw, the other three are wrong, correct is shorter than the longest wrong', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = byKind(deck(spreadSeed(i), lang), 'zero-cross');
      const m = norm(c.prompt).match(/\[\[(\d+), 0\], \[0, (\d+)\]\]/)!;
      const b11 = Number(m[1]), b22 = Number(m[2]);
      expect(b11 >= 1 && b11 <= 4 && b22 >= 1 && b22 <= 4).toBe(true);
      const kinds = c.choice!.options.map(zeroKind);
      expect([...kinds].sort()).toEqual(['independent', 'w1', 'w2', 'w3']);
      expect(kinds[c.choice!.answer]).toBe('independent');
      const lengths = c.choice!.options.map(lens);
      expect(lengths[c.choice!.answer]).toBeLessThan(Math.max(...lengths.filter((_, n) => n !== c.choice!.answer)));
      const co = (b: number) => (b === 1 ? 'K' : `${b}K`);
      expect(c.explanation).toContain(`[[${co(b11)}, 0], [0, ${co(b22)}]]`);
    }
  });
  it('options are shuffled: the correct index takes every value over many seeds', () => {
    for (const kind of ['which-model', 'zero-cross']) {
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) seen.add(byKind(deck(spreadSeed(i), 'en'), kind).choice!.answer);
      expect(seen.size, kind).toBe(4);
    }
  });
});

describe('GP-27 sampling spaces equal the plan (counts, predicate, coverage)', () => {
  const spaces = buildSpaces();
  const PLAN_SIZES: Record<string, number> = { 'kron-dim': 178, 'kron-inverse': 58, 'imc-cov': 336, 'slfm-cov': 1184, 'lmc-var': 75440, 'psd-limit': 18, 'challenge': 164448 };
  it('the enumerated predicate reproduces the plan counts', () => {
    for (const [k, n] of Object.entries(PLAN_SIZES)) expect(spaces[k].size, k).toBe(n);
    expect(WHICH_SPACE).toHaveLength(22);
  });
  const observed: Record<string, Set<string>> = {};
  const whichSeen = new Set<string>(), zeroSeen = new Set<string>();
  const sweepDone = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      for (const k of KINDS) observed[k] = new Set();
      for (let i = 0; i < SWEEP; i++) {
        const cards = deck(spreadSeed(i), 'en');
        for (const k of KINDS) { const p = byKind(cards, k).audit!.params as Record<string, number>; observed[k].add(tup(spaces[k].names.map(n => p[n]))); }
        const w = norm(byKind(cards, 'which-model').prompt);
        const Q = Number(w.match(/Q = (\d)/)![1]);
        const S = [...w.matchAll(/S[₁-₄1-4] = (\d+)/g)].map(m => Number(m[1]));
        whichSeen.add(tup([Q, S[0], S[1] ?? 0, S[2] ?? 0, S[3] ?? 0]));
        const z = norm(byKind(cards, 'zero-cross').prompt).match(/\[\[(\d+), 0\], \[0, (\d+)\]\]/)!;
        zeroSeen.add(`${z[1]},${z[2]}`);
      }
    };
  })();
  for (const k of KINDS) {
    it(`${k}: every drawn set lies inside the plan's guarded space${spaces[k].size <= 1184 ? ' and every set is drawn' : ''}`, () => {
      sweepDone();
      const outside = [...observed[k]].filter(t => !spaces[k].tuples.has(t));
      expect(outside.slice(0, 5), `${k}: ${outside.length} drawn sets violate the plan's predicate`).toEqual([]);
      if (spaces[k].size <= 1184) {
        const missing = [...spaces[k].tuples].filter(t => !observed[k].has(t));
        expect(missing.slice(0, 5), `${k}: ${missing.length} of ${spaces[k].size} plan sets never drawn (observed ${observed[k].size})`).toEqual([]);
      } else expect(observed[k].size, k).toBeGreaterThan(Math.min(5000, SWEEP * 0.5));
    }, 300000);
  }
  it('which-model draws exactly the 22 sets of the plan', () => {
    sweepDone();
    expect([...whichSeen].sort()).toEqual(WHICH_SPACE.map(tup).sort());
  }, 300000);
  it('zero-cross draws exactly the 16 pairs of the plan', () => {
    sweepDone();
    const all: string[] = [];
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) all.push(`${a},${b}`);
    expect([...zeroSeen].sort()).toEqual(all.sort());
  }, 300000);
});

describe('GP-27 variety and determinism', () => {
  it('every card has at least 6 distinct prompts over 60 seeds in EN and ZH', () => {
    for (const lang of LANGS) for (const k of ORDER) {
      const set = new Set<string>();
      for (let i = 0; i < SEEDS; i++) set.add(byKind(deck(spreadSeed(i), lang), k).prompt);
      expect(set.size, `${k} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('EN and ZH decks sample the same parameters', () => {
    for (let i = 0; i < SEEDS; i++) {
      const en = deck(spreadSeed(i), 'en'), zh = deck(spreadSeed(i), 'zh');
      for (const k of KINDS) expect(byKind(zh, k).audit, k).toEqual(byKind(en, k).audit);
      expect(byKind(zh, 'which-model').choice!.answer).toBe(byKind(en, 'which-model').choice!.answer);
      expect(byKind(zh, 'zero-cross').choice!.answer).toBe(byKind(en, 'zero-cross').choice!.answer);
    }
  });
  it('is deterministic and passes the shared structural and lint gates', () => {
    expect(deckProblems(ID, deck, 'topic', 100)).toEqual([]);
    expect(textLintProblems(ID, deck, 100)).toEqual([]);
  });
});

describe('GP-27 learner-visible text rules', () => {
  const sentences = (text: string) => norm(text).split(/[;；。]|\.(?=\s|$)/).map(s => s.trim()).filter(Boolean);
  it('is Unicode, parenthesised, reduced, one number style per sentence, and ZH has no English words', () => {
    const hits = new Map<string, string>();
    const flag = (key: string, sample: string, re?: RegExp) => { const at = re ? norm(sample).replaceAll('*', '·').search(re) : 0; if (!hits.has(key)) hits.set(key, norm(sample).replaceAll('*', '·').slice(Math.max(0, at - 30), Math.max(0, at - 30) + 100)); };
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(spreadSeed(i), lang)) for (const raw of textOf(c)) {
      const where = (name: string) => `${c.id} [${lang}] ${name}`;
      const t = raw;
      if (/-(?=\d)|(?<=\d)-| - /.test(t)) flag(where('ASCII hyphen minus'), t);
      if (/\(\(/.test(t)) flag(where('double opening parenthesis'), t);
      if (/\d\.\d{3,}/.test(t)) flag(where('raw float'), t);
      if (/\b[a-zA-Z]\d{1,2}\b|undefined|NaN|Infinity|TODO|[{}$\\_]/.test(t.replace('ℝ^{mp×nq}', ''))) flag(where('developer marker'), t);
      // Only flag a repeated symbolic variable; numeric arithmetic such as 4 = 4 is not x = x.
      const RESTATE = /([A-Za-ẑ̃][₀-₉]?) = \1(?![′'\w₀-₉])/, UNRED = /(?<![\d./])1·|·1(?![\d./])|\/1(?![\d.])/;
      if (RESTATE.test(t)) flag(where('x = x restatement'), t, RESTATE);
      if (UNRED.test(norm(t).replaceAll('*', '·'))) flag(where('unreduced 1·/·1'), t, UNRED);
      if (/(?<![\d.])0\.\d*0(?!\d)/.test(t)) flag(where('trailing zero decimal'), t);
      if (/["'`]/.test(t)) flag(where('ASCII quote'), t);
      for (const s of sentences(t)) if (/\d\.\d/.test(s) && /\d\/\d/.test(s)) flag(where('decimal and fraction in one sentence'), s);
      if (lang === 'zh') {
        const stripped = t.replace(/\b(exp|GP|KL|ELBO|diag|max|min)\b/g, '');
        if (/[a-z]{3,}/.test(stripped)) flag(where('English word in ZH'), stripped);
        if (/[一-鿿]\s*,|,\s*[一-鿿]/.test(t)) flag(where('ASCII comma in ZH prose'), t);
        if (/[一-鿿]\(|\)[一-鿿]/.test(t)) flag(where('ASCII parenthesis against CJK'), t);
      }
    }
    expect([...hits].map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });
  it('ZH correct option is never the longest; hints do not print the answer', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const kind of ['which-model', 'zero-cross']) {
        const c = byKind(deck(spreadSeed(i), 'zh'), kind);
        const lengths = c.choice!.options.map(o => [...o].length);
        expect(lengths[c.choice!.answer]).toBeLessThan(Math.max(...lengths));
      }
      for (const lang of LANGS) for (const kind of KINDS) {
        const c = byKind(deck(spreadSeed(i), lang), kind);
        const key = c.fields![0].answer;
        const hintNums = tokens(c.hint.replace(/\d\s*×\s*\d/g, ''));
        if (Math.abs(key) !== 1) expect(hintNums.some(x => close(x, key)), `${kind} ${lang} hint prints the answer: ${c.hint}`).toBe(false);
      }
    }
  });
  it('the explanation of every number card names the stated tolerance-free sentence about what is not assessed', () => {
    for (const lang of LANGS) {
      const c = byKind(deck(spreadSeed(3), lang), 'challenge');
      expect(c.explanation).toMatch(lang === 'en' ? /does not assess/ : /不考查/);
    }
  });
});
