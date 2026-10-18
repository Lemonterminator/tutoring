import { describe, expect, it } from 'vitest';
import { gp02 } from './games/gp02';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-02 (conditioning a Gaussian).
 * Every numeric answer is recomputed from the audit params by explicit conditioning of the full joint Gaussian with two hand-written
 * routes that must agree: (A) Cholesky solve of the observed block, (B) explicit Gauss-Jordan inverse of the whole Sigma, then the
 * precision form  cov = (P_TT)^-1, mean = m_T - cov P_TO d  (GPML A.6, second form). The plan's closed forms are used only as wrong-route
 * decoys and as range checks, never as the expected value.
 */
const SEEDS = 60;
const TOL = 0.006;
type Lang = 'en' | 'zh';
type P = Record<string, number>;
type M = number[][];
const seedAt = (i: number) => spreadSeed(i);
const clean = (t: string) => t.replaceAll('−', '-');
const slugs = ['cond-mean', 'cond-var', 'value-shift', 'zero-cov', 'never-larger', 'cov-after', 'two-obs', 'precision', 'challenge'] as const;
const pick = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-02-${slug}`);
  if (!card) throw new Error(`card GP-02-${slug} missing`);
  return card;
};
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);

// ---------- linear algebra written by hand ----------
function cholesky(A: M): M {
  const n = A.length, L: M = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (!(s > 1e-12)) throw new Error('matrix is not positive definite'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function forward(L: M, b: number[]): number[] {
  const x: number[] = [];
  for (let i = 0; i < L.length; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x.push(s / L[i][i]); }
  return x;
}
function backward(L: M, b: number[]): number[] { // solves L^T x = b
  const n = L.length, x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}
function inverse(A: M): M {
  const n = A.length, W = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    [W[c], W[p]] = [W[p], W[c]];
    const d = W[c][c];
    for (let j = 0; j < 2 * n; j++) W[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = W[r][c]; for (let j = 0; j < 2 * n; j++) W[r][j] -= f * W[c][j]; }
  }
  return W.map(row => row.slice(n));
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (A: M, R: number[], C: number[]) => R.map(r => C.map(c => A[r][c]));

/** Condition the target indices T on the observed indices O taking values v. Both routes must agree. */
function condition(S: M, mu: number[], T: number[], O: number[], v: number[]): { mean: number[]; cov: M } {
  cholesky(S); // the full joint must be positive definite
  const d = O.map((o, k) => v[k] - mu[o]);
  // route A: Cholesky of the observed block
  const L = cholesky(sub(S, O, O));
  const z = backward(L, forward(L, d)); // Sigma_OO^-1 d
  const meanA = T.map(t => mu[t] + dot(O.map(o => S[t][o]), z));
  const W = T.map(t => forward(L, O.map(o => S[o][t]))); // W[a] = L^-1 Sigma_O,t_a
  const covA = T.map((_, a) => T.map((__, b) => S[T[a]][T[b]] - dot(W[a], W[b])));
  // route B: precision form on the whole matrix
  const Pm = inverse(S);
  const covB = inverse(sub(Pm, T, T));
  const PTO = sub(Pm, T, O);
  const meanB = T.map((t, a) => mu[t] - dot(covB[a], PTO.map(row => dot(row, d))));
  for (let a = 0; a < T.length; a++) {
    if (Math.abs(meanA[a] - meanB[a]) > 1e-9) throw new Error(`oracle routes disagree on mean ${meanA[a]} vs ${meanB[a]}`);
    for (let b = 0; b < T.length; b++) if (Math.abs(covA[a][b] - covB[a][b]) > 1e-9) throw new Error('oracle routes disagree on covariance');
  }
  return { mean: meanA, cov: covA };
}
const S2 = (a: number, b: number, c: number): M => [[a, b], [b, c]];
const S3 = (s11: number, s12: number, s13: number, s22: number, s23: number, s33: number): M => [[s11, s12, s13], [s12, s22, s23], [s13, s23, s33]];

function toFraction(v: number): string {
  for (let d = 1; d <= 2000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return d === 1 ? `${n}` : `${n}/${d}`; }
  throw new Error(`no small fraction for ${v}`);
}

/** Oracle per audit kind; result in field order. */
function oracle(kind: string, p: P): number[] {
  switch (kind) {
    case 'GP-02:cond-mean': return [condition(S2(p.s11, p.s12, p.s22), [p.m1, p.m2], [0], [1], [p.v]).mean[0]];
    case 'GP-02:cond-var': return [condition(S2(p.s11, p.s12, p.s22), [p.m1, p.m2], [0], [1], [p.v]).cov[0][0]];
    case 'GP-02:zero-cov': { const r = condition(S2(p.s11, 0, p.s22), [p.m1, p.m2], [0], [1], [p.v]); return [r.mean[0], r.cov[0][0]]; }
    case 'GP-02:cov-after': { const r = condition(S3(p.s11, p.s12, p.s13, p.s22, p.s23, p.s33), [0, 0, 0], [0, 1], [2], [0]); return [r.cov[0][0], r.cov[0][1]]; }
    case 'GP-02:two-obs': { const r = condition(S3(p.s11, p.s12, p.s13, p.s22, 0, p.s33), [p.m1, p.m2, p.m3], [0], [1, 2], [p.v2, p.v3]); return [r.mean[0], r.cov[0][0]]; }
    case 'GP-02:precision': {
      const Sigma = inverse(S2(p.l11, p.l12, p.l22)); // covariance recovered from the printed precision matrix
      const r = condition(Sigma, [p.m1, p.m2], [0], [1], [p.v]);
      return [r.mean[0], r.cov[0][0]];
    }
    case 'GP-02:challenge': { const r = condition(S3(p.s11, p.s12, p.s13, p.s22, p.s23, p.s33), [p.m1, p.m2, p.m3], [1], [0, 2], [p.v1, p.v3]); return [r.mean[0], r.cov[0][0]]; }
    default: throw new Error(`unknown audit kind ${kind}`);
  }
}
const KINDS = ['cond-mean', 'cond-var', 'zero-cov', 'cov-after', 'two-obs', 'precision', 'challenge'].map(s => `GP-02:${s}`);

/** Wrong routes a learner could take: [field index, wrong value]. Each must be >= 0.02 from the truth and graded wrong. */
function wrongRoutes(kind: string, p: P): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const add = (k: number, ...vs: number[]) => vs.forEach(x => out.push([k, x]));
  switch (kind) {
    case 'GP-02:cond-mean': { const d = p.v - p.m2; add(0, p.m1 + p.s12 * d / p.s11, p.m1 + p.s12 * p.v / p.s22, p.s12 * d / p.s22, p.m1 - p.s12 * d / p.s22, p.m1 + p.s12 * d); break; }
    case 'GP-02:cond-var': add(0, p.s11 - Math.abs(p.s12) / p.s22, p.s11 - p.s12 ** 2, p.s11 - p.s12 ** 2 / p.s11, p.s11 + p.s12 ** 2 / p.s22, p.s12 ** 2 / p.s22, p.s11 - p.s12 ** 2 / p.s22 ** 2, p.s11); break;
    case 'GP-02:zero-cov': { const d = p.v - p.m2; add(0, p.v, p.m1 + p.v, p.m1 + d, d); add(1, p.s22, p.s11 + p.s22, p.s11 * p.s22); break; }
    case 'GP-02:cov-after': {
      add(0, p.s11 - Math.abs(p.s13) / p.s33, p.s11 - p.s13 ** 2, p.s11 - p.s13 ** 2 / p.s11, p.s11 + p.s13 ** 2 / p.s33, p.s13 ** 2 / p.s33, p.s11);
      add(1, p.s12, p.s12 - p.s13 * p.s23, p.s12 + p.s13 * p.s23 / p.s33, p.s12 - p.s13 * p.s23 / p.s11, p.s13 * p.s23 / p.s33);
      break;
    }
    case 'GP-02:two-obs': {
      const e2 = p.v2 - p.m2, e3 = p.v3 - p.m3;
      add(0, p.m1 + p.s12 * e2 / p.s22, p.m1 + p.s13 * e3 / p.s33, p.m1 + (p.s12 * e2 + p.s13 * e3) / (p.s22 + p.s33), p.m1 + p.s12 * e2 / p.s22 - p.s13 * e3 / p.s33,
        p.s12 * e2 / p.s22 + p.s13 * e3 / p.s33, p.m1 + p.s12 * p.v2 / p.s22 + p.s13 * p.v3 / p.s33, p.m1 - p.s12 * e2 / p.s22 - p.s13 * e3 / p.s33, p.m1 + p.s12 * e2 + p.s13 * e3);
      add(1, p.s11 - p.s12 ** 2 / p.s22, p.s11 - p.s13 ** 2 / p.s33, p.s11 - (p.s12 ** 2 + p.s13 ** 2) / (p.s22 + p.s33), p.s11 + p.s12 ** 2 / p.s22 + p.s13 ** 2 / p.s33,
        p.s11 - Math.abs(p.s12) / p.s22 - Math.abs(p.s13) / p.s33, p.s12 ** 2 / p.s22 + p.s13 ** 2 / p.s33);
      break;
    }
    case 'GP-02:precision': {
      const d = p.v - p.m2, det = p.l11 * p.l22 - p.l12 ** 2;
      add(0, p.m1 + p.l12 * d / p.l11, p.m1 - p.l12 * d / p.l22, p.m1 + p.l12 * d / p.l22, p.m1 - p.l12 * p.v / p.l11, p.m1 - p.l12 * d, p.m1 - p.l12 * d / det, p.m1 + p.l12 * d / det);
      add(1, p.l22 / det, p.l11, 1 / p.l22, p.l11 - p.l12 ** 2 / p.l22, det / p.l11);
      break;
    }
    case 'GP-02:challenge': {
      const d1 = p.v1 - p.m1, d3 = p.v3 - p.m3, A = p.s11, b = p.s13, c1 = p.s12, c2 = p.s23, det = A * A - b * b;
      add(0, p.m2 + (c1 * d1 + c2 * d3) / A, p.m2 + (c1 * d1 + c2 * d3) / (A + b), p.m2 + ((A * c1 + b * c2) * d1 + (A * c2 + b * c1) * d3) / det,
        p.m2 + (c1 + c2) * (d1 + d3) / (2 * (A + b)), p.m2 + (c1 * d1 + c2 * d3) / (A - b), p.m2 + (c1 * p.v1 + c2 * p.v3) / A);
      add(1, p.s22 - (c1 ** 2 + c2 ** 2) / A, p.s22 - (c1 ** 2 + c2 ** 2) / (A + b), p.s22 - (c1 ** 2 + c2 ** 2) / det, p.s22 - (c1 + c2) ** 2 / (2 * (A + b)), p.s22 - c1 ** 2 / A);
      break;
    }
    default: break;
  }
  return out;
}

// ---------- text parsing ----------
const ints = (text: string) => [...text.matchAll(/-?\d+/g)].map(m => Number(m[0]));
function muOf(t: string, n: number): number[] {
  const m = /μ = \(([^)]*)\)/.exec(t);
  if (!m) throw new Error(`no mean vector in ${t.slice(0, 120)}`);
  const v = ints(m[1]);
  if (v.length !== n) throw new Error(`mean vector has ${v.length} entries, expected ${n}`);
  return v;
}
function matrixAfter(t: string, marker: string, n: number): number[] {
  const i = t.indexOf(marker);
  if (i < 0) throw new Error(`no "${marker}" in ${t.slice(0, 120)}`);
  const v = [...t.slice(i + marker.length).matchAll(/-?\d+/g)].slice(0, n * n).map(m => Number(m[0]));
  if (v.length < n * n) throw new Error('matrix too short');
  return v;
}
const symmetric = (v: number[], n: number) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (v[i * n + j] !== v[j * n + i]) return false; return true; };
const obs = (t: string, name: string): number => {
  const m = new RegExp(`${name} = (-?\\d+)`).exec(t);
  if (!m) throw new Error(`no ${name} = in ${t.slice(0, 160)}`);
  return Number(m[1]);
};
/** The sampled numbers as the learner sees them. */
function printedParams(kind: string, raw: string): P {
  const t = clean(raw);
  switch (kind) {
    case 'GP-02:cond-mean': case 'GP-02:cond-var': {
      const [m1, m2] = muOf(t, 2), S = matrixAfter(t, 'Σ = ', 2);
      if (!symmetric(S, 2)) throw new Error('printed Σ not symmetric');
      return { m1, m2, s11: S[0], s12: S[1], s22: S[3], v: obs(t, 'x₂') };
    }
    case 'GP-02:zero-cov': {
      const [m1, m2] = muOf(t, 2), S = matrixAfter(t, 'Σ = ', 2);
      if (S[1] !== 0 || S[2] !== 0) throw new Error('zero-cov: off-diagonal printed not 0');
      return { m1, m2, s11: S[0], s22: S[3], v: obs(t, 'x₂') };
    }
    case 'GP-02:cov-after': {
      const S = matrixAfter(t, 'Σ = ', 3);
      if (!symmetric(S, 3)) throw new Error('printed Σ not symmetric');
      return { s11: S[0], s12: S[1], s13: S[2], s22: S[4], s23: S[5], s33: S[8] };
    }
    case 'GP-02:two-obs': {
      const [m1, m2, m3] = muOf(t, 3), S = matrixAfter(t, 'Σ = ', 3);
      if (!symmetric(S, 3) || S[5] !== 0) throw new Error('two-obs: Σ not symmetric or s23 != 0');
      return { m1, m2, m3, s11: S[0], s12: S[1], s13: S[2], s22: S[4], s33: S[8], v2: obs(t, 'x₂'), v3: obs(t, 'x₃') };
    }
    case 'GP-02:precision': {
      const [m1, m2] = muOf(t, 2), L = matrixAfter(t, 'Λ = Σ⁻¹ = ', 2);
      if (!symmetric(L, 2)) throw new Error('printed Λ not symmetric');
      return { m1, m2, l11: L[0], l12: L[1], l22: L[3], v: obs(t, 'x₂') };
    }
    case 'GP-02:challenge': {
      const [m1, m2, m3] = muOf(t, 3), S = matrixAfter(t, 'Σ = ', 3);
      if (!symmetric(S, 3)) throw new Error('printed Σ not symmetric');
      return { m1, m2, m3, s11: S[0], s12: S[1], s13: S[2], s22: S[4], s23: S[5], s33: S[8], v1: obs(t, 'x₁'), v3: obs(t, 'x₃') };
    }
    default: throw new Error(`unknown kind ${kind}`);
  }
}

// ---------- plan ranges (from the audit section) ----------
const inSet = (x: number, set: number[]) => set.includes(x);
const pm = (n: number) => Array.from({ length: n }, (_, i) => i + 1).flatMap(v => [v, -v]);
function rangeProblems(kind: string, p: P, expected: number[]): string[] {
  const bad: string[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) bad.push(msg); };
  switch (kind) {
    case 'GP-02:cond-mean': case 'GP-02:cond-var': {
      const d = p.v - p.m2;
      need(inSet(p.m1, pm(3)) && inSet(p.m2, pm(3)), 'm out of ±1..±3');
      need(inSet(p.s22, [2, 3, 4, 5]), 's22 range');
      need(p.s11 >= 2 && p.s11 <= (kind === 'GP-02:cond-mean' ? 6 : 7), 's11 range');
      need(kind === 'GP-02:cond-mean' ? inSet(p.s12, pm(3)) : inSet(p.s12, [2, -2, 3, -3]), 's12 range');
      need(p.s11 * p.s22 > p.s12 ** 2, 'Sigma not PD');
      need(p.s11 !== p.s22, 's11 == s22');
      need(inSet(d, pm(4)), 'v - m2 out of ±1..±4');
      if (kind === 'GP-02:cond-var') {
        need(p.s11 !== 2 * p.s12 ** 2 / p.s22, 's11 == 2 s12^2/s22');
        // the answer must not depend on m1, m2, v
        const r2 = condition(S2(p.s11, p.s12, p.s22), [p.m1 + 7, p.m2 - 5], [0], [1], [p.v + 11]).cov[0][0];
        need(Math.abs(r2 - expected[0]) < 1e-9, 'conditional variance depends on mean or value');
      }
      break;
    }
    case 'GP-02:zero-cov': {
      const d = p.v - p.m2;
      need(inSet(p.m1, pm(3)) && inSet(p.m2, pm(3)), 'm range');
      need(p.s11 >= 2 && p.s11 <= 6 && p.s22 >= 1 && p.s22 <= 5 && p.s11 !== p.s22, 's range');
      need(inSet(d, pm(4)) && p.v !== p.m1 && p.v !== 0 && d !== p.m1, 'value guards');
      break;
    }
    case 'GP-02:cov-after': {
      need(inSet(p.s11, [3, 4, 5, 6]) && inSet(p.s22, [3, 4, 5, 6]) && inSet(p.s33, [2, 3, 4]), 'diagonal range');
      need(p.s12 >= -2 && p.s12 <= 3, 's12 range');
      need(inSet(p.s13, pm(3)) && inSet(p.s23, pm(3)), 's13/s23 range');
      const det = p.s11 * (p.s22 * p.s33 - p.s23 ** 2) - p.s12 * (p.s12 * p.s33 - p.s23 * p.s13) + p.s13 * (p.s12 * p.s23 - p.s22 * p.s13);
      need(p.s11 > 0 && p.s11 * p.s22 - p.s12 ** 2 > 0 && det > 0, 'Sigma not PD');
      need(expected[0] >= 0.5 && p.s22 - p.s23 ** 2 / p.s33 >= 0.5, 'conditional variances below 1/2');
      need(Math.abs(expected[1]) > 1e-12, 'conditional covariance is zero');
      break;
    }
    case 'GP-02:two-obs': {
      need(inSet(p.m1, pm(3)) && inSet(p.m2, pm(3)) && inSet(p.m3, pm(3)), 'm range');
      need(p.s11 >= 3 && p.s11 <= 8, 's11 range');
      need(inSet(p.s12, [1, -1, 2, -2]) && inSet(p.s13, [1, -1, 2, -2]), 's12/s13 range');
      need(inSet(p.s22, [1, 2, 4]) && inSet(p.s33, [1, 2, 4]), 's22/s33 range');
      need(inSet(p.v2 - p.m2, pm(3)) && inSet(p.v3 - p.m3, pm(3)), 'deviation range');
      need(expected[1] >= 0.5, 'variance below 1/2');
      break;
    }
    case 'GP-02:precision': {
      need(inSet(p.m1, pm(3)) && inSet(p.m2, pm(3)), 'm range');
      need(inSet(p.l11, [2, 3, 4, 5]) && inSet(p.l22, [2, 3, 4, 5]) && inSet(p.l12, [1, -1, 2, -2]), 'lambda range');
      need(p.l11 * p.l22 > p.l12 ** 2 && p.l11 !== p.l22, 'Lambda not PD or l11 == l22');
      need(inSet(p.v - p.m2, pm(4)), 'deviation range');
      break;
    }
    case 'GP-02:challenge': {
      const pairs = [[2, 1], [2, -1], [3, 1], [3, -1], [3, 2], [3, -2], [4, 3], [4, -3]];
      need(pairs.some(([a, b]) => a === p.s11 && b === p.s13) && p.s33 === p.s11, '(s11, s13, s33) not in the plan table');
      need(p.s22 >= 3 && p.s22 <= 7, 's22 range');
      need(inSet(p.s12, pm(3)) && inSet(p.s23, pm(3)) && p.s12 !== p.s23, 's12/s23 range');
      need(inSet(p.m1, pm(3)) && inSet(p.m2, pm(3)) && inSet(p.m3, pm(3)), 'm range');
      const d1 = p.v1 - p.m1, d3 = p.v3 - p.m3;
      need(inSet(d1, pm(3)) && inSet(d3, pm(3)) && Math.abs(d1) !== Math.abs(d3), 'deviation range');
      need(expected[1] >= 0.5, 'variance below 1/2');
      // mean offset away from zero
      need(Math.abs(expected[0] - p.m2) > 1e-12, 'mean offset X = 0');
      break;
    }
    default: break;
  }
  return bad;
}

describe('GP-02 oracle: deck shape', () => {
  it('has the 9 planned cards in order, right answer modes, no figure, audit exactly on the 7 numeric cards, tolerance 0.006', () => {
    const fails: string[] = [];
    const twoField = ['zero-cov', 'cov-after', 'two-obs', 'precision', 'challenge'];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const cards = gp02(seedAt(i), lang);
      const at = `seed ${seedAt(i)} ${lang}`;
      if (cards.map(c => c.id).join() !== slugs.map(s => `GP-02-${s}`).join()) { fails.push(`${at}: ids ${cards.map(c => c.id)}`); continue; }
      for (const c of cards) {
        const slug = c.id.slice(6);
        const numeric = !['value-shift', 'never-larger'].includes(slug);
        if (numeric !== !!c.fields) fails.push(`${at} ${slug}: fields presence`);
        if (!numeric && !c.choice) fails.push(`${at} ${slug}: expected a choice card`);
        if (c.slots) fails.push(`${at} ${slug}: unexpected slots`);
        if (c.figure) fails.push(`${at} ${slug}: figure not planned`);
        if (!!c.audit !== numeric) fails.push(`${at} ${slug}: audit presence`);
        if (c.audit && c.audit.kind !== `GP-02:${slug}`) fails.push(`${at} ${slug}: audit kind ${c.audit.kind}`);
        if (c.choice && c.choice.options.length !== 4) fails.push(`${at} ${slug}: ${c.choice.options.length} options`);
        if (c.fields) {
          const want = twoField.includes(slug) ? 2 : 1;
          if (c.fields.length !== want) fails.push(`${at} ${slug}: ${c.fields.length} fields, plan says ${want}`);
          c.fields.forEach((f, k) => { if (f.tolerance !== TOL) fails.push(`${at} ${slug} field ${k}: tolerance ${f.tolerance}`); });
        }
      }
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
      if (kinds.join() !== [...KINDS].sort().join()) fails.push(`${at}: audit kinds ${kinds}`);
    }
    report(fails);
  });
});

describe('GP-02 oracle: numeric answers by independent conditioning', () => {
  for (const kind of KINDS) {
    it(`${kind}: answers, grading, wrong routes, printed text, plan ranges (60 spread seeds x EN/ZH)`, () => {
      const fails: string[] = [];
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) {
        const decks = { en: gp02(seedAt(i), 'en'), zh: gp02(seedAt(i), 'zh') };
        for (const lang of ['en', 'zh'] as Lang[]) {
          const card = decks[lang].find(c => c.audit?.kind === kind);
          if (!card) { fails.push(`seed ${seedAt(i)} ${lang}: ${kind} did not fire`); continue; }
          fired++;
          const where = `${kind} seed ${seedAt(i)} ${lang} ${JSON.stringify(card.audit!.params)}`;
          const params = card.audit!.params as P;
          let expected: number[];
          try { expected = oracle(kind, params); } catch (e) { fails.push(`${where}: oracle threw ${(e as Error).message}`); continue; }
          if (expected.length !== card.fields!.length) { fails.push(`${where}: ${card.fields!.length} fields, oracle ${expected.length}`); continue; }
          expected.forEach((v, k) => {
            const got = card.fields![k].answer;
            if (Math.abs(v - got) > 1e-9) fails.push(`${where} field ${k}: expected ${v}, got ${got}`);
          });
          // grading through gradeCard
          const asValues = (vs: string[]) => gradeCard(card, vs, null, []);
          const frac = expected.map(toFraction), dec = expected.map(v => v.toFixed(2));
          if (asValues(frac) !== 'correct') fails.push(`${where}: fractions ${frac} not graded correct`);
          if (asValues(dec) !== 'correct') fails.push(`${where}: decimals ${dec} not graded correct`);
          expected.forEach((v, k) => {
            for (const d of [0.02, -0.02, 0.007, -0.007]) {
              const vals = [...frac]; vals[k] = (v + d).toFixed(4);
              if (asValues(vals) !== 'incorrect') fails.push(`${where} field ${k}: perturbation ${d} graded ${asValues(vals)}`);
            }
          });
          for (const [k, w] of wrongRoutes(kind, params)) {
            if (Math.abs(w - expected[k]) < 0.02) { if (w !== expected[k]) fails.push(`${where}: wrong route value ${w} on field ${k} is within 0.02 of truth ${expected[k]}`); continue; }
            const vals = [...frac]; vals[k] = w.toFixed(4);
            if (asValues(vals) === 'correct') fails.push(`${where}: wrong route ${w} on field ${k} graded correct`);
          }
          // printed text equals audit params
          try {
            const printed = printedParams(kind, card.prompt);
            for (const [name, v] of Object.entries(params)) if (printed[name] !== v) fails.push(`${where}: printed ${name}=${printed[name]} but audit ${v}`);
            for (const name of Object.keys(printed)) if (!(name in params)) fails.push(`${where}: printed ${name} missing from audit`);
          } catch (e) { fails.push(`${where}: ${(e as Error).message}`); }
          for (const m of rangeProblems(kind, params, expected)) fails.push(`${where}: ${m}`);
        }
      }
      expect(fired).toBe(SEEDS * 2);
      report(fails);
    });
  }

  it('EN and ZH decks carry identical audits, answers and answer index; explanation states each answer; hint does not give a fractional answer away', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const en = gp02(seedAt(i), 'en'), zh = gp02(seedAt(i), 'zh');
      en.forEach((c, k) => {
        if (JSON.stringify(c.audit) !== JSON.stringify(zh[k].audit)) fails.push(`${c.id} seed ${seedAt(i)}: audit differs between languages`);
        if (c.choice && c.choice.answer !== zh[k].choice!.answer) fails.push(`${c.id} seed ${seedAt(i)}: answer index differs between languages`);
        if (!c.fields) return;
        c.fields.forEach((f, j) => { if (f.answer !== zh[k].fields![j].answer) fails.push(`${c.id} seed ${seedAt(i)}: answer differs between languages`); });
        for (const [lang, card] of [['en', c], ['zh', zh[k]]] as const) {
          const expl = clean(card.explanation), hint = clean(card.hint);
          card.fields!.forEach((f, j) => {
            const fr = toFraction(f.answer);
            if (!expl.includes(fr)) fails.push(`${c.id} ${lang} seed ${seedAt(i)} field ${j}: explanation does not contain ${fr}`);
            const recip = /^1\/(\d+)$/.exec(fr); // a reciprocal of a printed input (e.g. diag(1/2, 1/4) in the hint) is not a leak
            const isInputReciprocal = !!recip && Object.values(card.audit?.params ?? {}).includes(Number(recip[1]));
            if (fr.includes('/') && !isInputReciprocal && hint.includes(fr)) fails.push(`${c.id} ${lang} seed ${seedAt(i)}: hint contains the answer ${fr}`);
          });
        }
      });
    }
    report(fails);
  });
});

describe('GP-02 oracle: choice cards', () => {
  /** [means differ, variances differ] claimed by a value-shift option (EN or ZH). */
  const claim = (o: string): [boolean, boolean] => {
    const t = o.trim();
    if (/^Neither changes|^两者都不变/.test(t)) return [false, false];
    if (/^The conditional means differ and the conditional variances are equal|^条件均值不同，条件方差相同/.test(t)) return [true, false];
    if (/^The conditional means are equal and the conditional variances differ|^条件均值相同，条件方差不同/.test(t)) return [false, true];
    if (/^Both the conditional means and the conditional variances differ|^条件均值和条件方差都不同/.test(t)) return [true, true];
    throw new Error(`cannot parse value-shift option "${o}"`);
  };
  it('value-shift: exactly the option "means differ, variances equal" is correct by direct conditioning; answer index points to it', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const card = pick(gp02(seedAt(i), lang), 'value-shift');
      const t = clean(card.prompt), at = `seed ${seedAt(i)} ${lang}`;
      try {
        const [m1, m2] = muOf(t, 2), S = matrixAfter(t, 'Σ = ', 2);
        if (!symmetric(S, 2)) { fails.push(`${at}: printed Σ not symmetric`); continue; }
        const xs = [...t.matchAll(/x₂ = (-?\d+)/g)].map(m => Number(m[1]));
        const [v1, v2] = xs;
        if (xs.length < 2 || v1 === v2) { fails.push(`${at}: observed values ${xs}`); continue; }
        if (S[1] === 0 || S[0] * S[3] <= S[1] ** 2) fails.push(`${at}: s12 = 0 or not PD`);
        if (!(m1 >= -3 && m1 <= 3 && m2 >= -3 && m2 <= 3 && v1 >= -5 && v1 <= 5 && v2 >= -5 && v2 <= 5)) fails.push(`${at}: out of plan range`);
        const A = condition(S2(S[0], S[1], S[3]), [m1, m2], [0], [1], [v1]), B = condition(S2(S[0], S[1], S[3]), [m1, m2], [0], [1], [v2]);
        const truth: [boolean, boolean] = [Math.abs(A.mean[0] - B.mean[0]) > 1e-9, Math.abs(A.cov[0][0] - B.cov[0][0]) > 1e-9];
        const verdicts = card.choice!.options.map(o => { const c = claim(o); return c[0] === truth[0] && c[1] === truth[1]; });
        if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options match`);
        else if (verdicts[card.choice!.answer] !== true) fails.push(`${at}: answer index ${card.choice!.answer} is not the matching option ${verdicts.indexOf(true)}`);
        if (lang === 'en') {
          const lens = card.choice!.options.map(o => o.length), cl = lens[card.choice!.answer];
          if (lens.every((l, k) => k === card.choice!.answer || l < cl)) fails.push(`${at}: correct option is the longest`);
        }
      } catch (e) { fails.push(`${at}: ${(e as Error).message}`); }
    }
    report(fails);
  });

  it('never-larger: reported value exceeds S11, true conditional variance is below S11; exactly the "impossible: cannot exceed S11" option is correct', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const card = pick(gp02(seedAt(i), lang), 'never-larger');
      const t = clean(card.prompt), at = `seed ${seedAt(i)} ${lang}`;
      try {
        const S = matrixAfter(t, 'Σ = ', 2);
        const claimMatch = (lang === 'en' ? /reports (-?\d+)/ : /得到 (-?\d+)/).exec(t);
        if (!claimMatch) { fails.push(`${at}: no reported value`); continue; }
        const reported = Number(claimMatch[1]);
        const [s11, s12, s22] = [S[0], S[1], S[3]];
        const truth = condition(S2(s11, s12, s22), [0, 0], [0], [1], [0]).cov[0][0];
        if (!symmetric(S, 2) || s12 === 0 || s11 * s22 <= s12 ** 2) fails.push(`${at}: bad Sigma ${S}`);
        if (!(truth > 0 && truth < s11)) fails.push(`${at}: true variance ${truth} not in (0, s11)`);
        if (!(reported > s11)) fails.push(`${at}: reported ${reported} is not above s11 = ${s11}`);
        if (Math.abs(reported - (s11 + s12 ** 2 / s22)) > 1e-9) fails.push(`${at}: reported ${reported} != s11 + s12^2/s22`);
        if (!inSet(s22, [1, 2, 3, 4]) || s12 ** 2 % s22 !== 0) fails.push(`${at}: s22 / s12 outside the plan table`);
        // option predicates written from the plan; the number printed in an option must be S11
        const optionIsCorrect = (o: string): boolean => {
          const num = /Σ₁₁ = (-?\d+)/.exec(o);
          const n = num ? Number(num[1]) : NaN;
          if (/^Impossible: conditioning cannot make|^不可能：条件化不会使/.test(o)) return n === s11 && reported > s11;           // upper bound
          if (/^Impossible: the conditional variance must equal|^不可能：条件方差必须等于/.test(o)) return n === s11 && Math.abs(truth - s11) < 1e-12; // equal to marginal
          if (/^Possible: extra information|^可能：关于 x₂ 的额外信息/.test(o)) return false;       // conditioning never increases variance
          if (/^Possible: the term|^可能：Σ₁₂ 为正时/.test(o)) return false;                       // the term is a nonnegative square over a positive number
          throw new Error(`cannot parse never-larger option "${o}"`);
        };
        const verdicts = card.choice!.options.map(optionIsCorrect);
        if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options correct`);
        else if (verdicts[card.choice!.answer] !== true) fails.push(`${at}: answer index points to a wrong option`);
        if (lang === 'en') {
          const lens = card.choice!.options.map(o => o.length), cl = lens[card.choice!.answer];
          if (lens.every((l, k) => k === card.choice!.answer || l < cl)) fails.push(`${at}: correct option is the longest`);
        }
      } catch (e) { fails.push(`${at}: ${(e as Error).message}`); }
    }
    report(fails);
  });
});

describe('GP-02 oracle: variety and learner-facing text', () => {
  it('every card has at least 6 distinct prompts over 60 seeds (EN and ZH)', () => {
    const fails: string[] = [];
    for (const lang of ['en', 'zh'] as Lang[]) {
      const prompts = new Map<string, Set<string>>();
      for (let i = 0; i < SEEDS; i++) for (const c of gp02(seedAt(i), lang)) { if (!prompts.has(c.id)) prompts.set(c.id, new Set()); prompts.get(c.id)!.add(c.prompt); }
      for (const [id, s] of prompts) if (s.size < 6) fails.push(`${lang} ${id}: only ${s.size} distinct prompts`);
    }
    report(fails);
  });

  it('explanations print exact fractions only: no decimals, no doubled parentheses, no "a = a" repeats', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) for (const c of gp02(seedAt(i), lang)) {
      const e = clean(c.explanation), at = `${c.id} ${lang} seed ${seedAt(i)}`;
      if (/\d\.\d/.test(e)) fails.push(`${at}: decimal in explanation`);
      if (/\(\(/.test(e) && !/\(\(\d+\/\d+\)/.test(e)) fails.push(`${at}: doubled parentheses`);
      const rep = /= (\d+(?:\/\d+)?) = \1(?![\d/])/.exec(e);
      if (rep) fails.push(`${at}: repeated equality "${rep[0]}"`);
    }
    report(fails);
  });

  it('the challenge explanation states what the game does not assess (conventions rule 6)', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const e = pick(gp02(seedAt(i), lang), 'challenge').explanation;
      if (!(lang === 'en' ? /does not assess/.test(e) : /不考查/.test(e))) fails.push(`seed ${seedAt(i)} ${lang}: no "does not assess" sentence`);
    }
    report(fails);
  });

  it('ZH text has no English words except symbols, Var, Cov, GP; no leftover template braces or ^ in any text', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) for (const c of gp02(seedAt(i), lang)) {
      const at = `${c.id} ${lang} seed ${seedAt(i)}`;
      const texts = [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];
      for (const text of texts) {
        if (/[{}]|\^|undefined|NaN/.test(text)) fails.push(`${at}: leftover token in "${text.slice(0, 60)}"`);
        if (lang === 'zh') {
          const words = text.replace(/GPML|GP|Var|Cov|det|diag/g, '').match(/[A-Za-z]{2,}/g);
          if (words) fails.push(`${at}: English words in zh text: ${words.join(' ')}`);
        }
      }
    }
    report(fails);
  });
});
