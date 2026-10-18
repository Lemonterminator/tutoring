import { describe, expect, it } from 'vitest';
import { gp04 } from './games/gp04';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-04 (Bayesian linear regression).
 * Written from docs/aalto-gp-drafts/approved-GP-04.md only. Every number is recomputed by explicit joint Gaussian conditioning
 * (route 2: Cov(w,y) = Sigma_p X, Var(y) = X' Sigma_p X + sigma2 I, hand-written Gauss-Jordan inverse of the n x n matrix) AND by the
 * precision route (hand-written Gaussian elimination on A); the two must agree before an expected value is used.
 */
const SEEDS = 60;
const TOL = 0.006;
type Lang = 'en' | 'zh';
type P = Record<string, number>;
const seedAt = (i: number) => spreadSeed(i);
const clean = (t: string) => t.replaceAll('−', '-');
const slugs = ['post-mean-1d', 'pred-mean-1d', 'pred-var-1d', 'post-cov-2d', 'post-mean-2d', 'precision-add', 'weaker-prior', 'challenge'] as const;
const KINDS = ['post-mean-1d', 'pred-mean-1d', 'pred-var-1d', 'post-cov-2d', 'post-mean-2d', 'challenge'].map(s => `GP-04:${s}`);
const pick = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-04-${slug}`);
  if (!card) throw new Error(`card GP-04-${slug} missing`);
  return card;
};
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);

// ---------- linear algebra written by hand ----------
type M = number[][];
function inverse(A: M): M {
  const n = A.length, W = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    if (Math.abs(W[p][c]) < 1e-12) throw new Error('singular matrix');
    [W[c], W[p]] = [W[p], W[c]];
    const d = W[c][c];
    for (let j = 0; j < 2 * n; j++) W[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = W[r][c]; for (let j = 0; j < 2 * n; j++) W[r][j] -= f * W[c][j]; }
  }
  return W.map(row => row.slice(n));
}
const mul = (A: M, B: M): M => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const T = (A: M): M => A[0].map((_, j) => A.map(row => row[j]));
const mv = (A: M, v: number[]) => A.map(row => row.reduce((s, x, k) => s + x * v[k], 0));
const sub = (A: M, B: M): M => A.map((row, i) => row.map((x, j) => x - B[i][j]));
const add = (A: M, B: M): M => A.map((row, i) => row.map((x, j) => x + B[i][j]));
const scale = (A: M, c: number): M => A.map(row => row.map(x => x * c));
const diag = (...d: number[]): M => d.map((x, i) => d.map((_, j) => (i === j ? x : 0)));
const quad = (v: number[], A: M) => v.reduce((s, x, i) => s + x * A[i].reduce((t, a, j) => t + a * v[j], 0), 0);

interface Model { X: M; y: number[]; sigmaP: M; sigma2: number }
/** Route 2: explicit joint conditioning. Returns posterior mean and covariance of w. */
function route2(m: Model): { mu: number[]; cov: M } {
  const n = m.y.length;
  const SX = mul(m.sigmaP, m.X); // D x n
  const Vy = add(mul(mul(T(m.X), m.sigmaP), m.X), scale(diag(...Array(n).fill(1)), m.sigma2));
  const Vi = inverse(Vy);
  return { mu: mv(mul(SX, Vi), m.y), cov: sub(m.sigmaP, mul(mul(SX, Vi), T(SX))) };
}
/** Route 1: precision form, with a hand-written elimination solve (not the same code as the inverse above). */
function route1(m: Model): { mu: number[]; cov: M } {
  const D = m.sigmaP.length;
  const A = add(scale(mul(m.X, T(m.X)), 1 / m.sigma2), inverse(m.sigmaP));
  const Xy = mv(m.X, m.y);
  const rhs = Xy.map(v => v / m.sigma2);
  // Gaussian elimination without pivoting trick: augmented [A | rhs | I]
  const W = A.map((row, i) => [...row, rhs[i], ...Array.from({ length: D }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < D; c++) {
    for (let r = 0; r < D; r++) {
      if (r === c) continue;
      const f = W[r][c] / W[c][c];
      for (let j = 0; j < W[r].length; j++) W[r][j] -= f * W[c][j];
    }
  }
  const mu = W.map((row, i) => row[D] / row[i]);
  const cov = W.map((row, i) => row.slice(D + 1).map(v => v / row[i]));
  return { mu, cov };
}
function solve(m: Model): { mu: number[]; cov: M } {
  const a = route1(m), b = route2(m);
  for (let i = 0; i < a.mu.length; i++) {
    if (Math.abs(a.mu[i] - b.mu[i]) > 1e-9) throw new Error(`oracle routes disagree on mu: ${a.mu} vs ${b.mu}`);
    for (let j = 0; j < a.mu.length; j++) if (Math.abs(a.cov[i][j] - b.cov[i][j]) > 1e-9) throw new Error('oracle routes disagree on covariance');
  }
  return b;
}
const model1d = (p: P): Model => ({ X: [[p.x1, p.x2]], y: [p.y1, p.y2], sigmaP: [[p.tau2]], sigma2: p.sigma2 });
const model2d = (p: P, withY = true): Model => ({ X: [[1, 1, 1], [p.x1, p.x2, p.x3]], y: withY ? [p.y1, p.y2, p.y3] : [0, 0, 0], sigmaP: diag(p.tau02, p.tau12), sigma2: p.sigma2 });
const isPD2 = (A: M) => A[0][0] > 0 && A[0][0] * A[1][1] - A[0][1] ** 2 > 0;

function oracle(kind: string, p: P): number[] {
  switch (kind) {
    case 'GP-04:post-mean-1d': return [solve(model1d(p)).mu[0]];
    case 'GP-04:pred-mean-1d': return [solve(model1d(p)).mu[0] * p.xs];
    case 'GP-04:pred-var-1d': { const v = solve(model1d(p)).cov[0][0] * p.xs ** 2; return [v, p.sigma2 + v]; }
    case 'GP-04:post-cov-2d': { const c = solve(model2d(p, false)).cov; return [c[0][0], c[1][1]]; }
    case 'GP-04:post-mean-2d': { const r = solve(model2d(p)); return [r.mu[0], r.mu[1]]; }
    case 'GP-04:challenge': { const r = solve(model2d(p)); return [r.mu[1], quad([1, p.xs], r.cov)]; }
    default: throw new Error(`unknown audit kind ${kind}`);
  }
}
/** A_matrix with Sigma_p added instead of Sigma_p^-1 (a plausible wrong route). */
function wrongSigmaA(p: P): M {
  const xs = [p.x1, p.x2, p.x3];
  const Sx = xs.reduce((a, b) => a + b, 0), Sxx = xs.reduce((a, b) => a + b * b, 0);
  return add(scale([[3, Sx], [Sx, Sxx]], 1 / p.sigma2), diag(p.tau02, p.tau12));
}
const dataA = (p: P): M => {
  const xs = [p.x1, p.x2, p.x3];
  const Sx = xs.reduce((a, b) => a + b, 0), Sxx = xs.reduce((a, b) => a + b * b, 0);
  return add(scale([[3, Sx], [Sx, Sxx]], 1 / p.sigma2), diag(1 / p.tau02, 1 / p.tau12));
};
/** Wrong routes a learner could take. */
function wrongRoutes(kind: string, p: P, truth: number[]): number[][] {
  switch (kind) {
    case 'GP-04:post-mean-1d': {
      const S = p.x1 ** 2 + p.x2 ** 2, Tt = p.x1 * p.y1 + p.x2 * p.y2;
      return [[Tt / S], [Tt / (S + p.sigma2)], [Tt / (S / p.sigma2 + p.tau2)], [Tt / (S + p.sigma2 * p.tau2)]];
    }
    case 'GP-04:pred-mean-1d': {
      const S = p.x1 ** 2 + p.x2 ** 2, Tt = p.x1 * p.y1 + p.x2 * p.y2;
      return [[(Tt / S) * p.xs], [truth[0] / p.xs]];
    }
    case 'GP-04:pred-var-1d': {
      const A = (p.x1 ** 2 + p.x2 ** 2) / p.sigma2 + 1 / p.tau2;
      return [[p.xs ** 2 * A, p.sigma2 + p.xs ** 2 * A], [truth[1], truth[0]], [truth[0], truth[0]], [truth[1], truth[1]], [truth[0] / p.xs ** 2, truth[1] / p.xs ** 2]];
    }
    case 'GP-04:post-cov-2d': {
      const A = dataA(p);
      return [[p.tau02, p.tau12], [A[0][0], A[1][1]], [A[1][1], A[0][0]], [1 / A[0][0], 1 / A[1][1]]];
    }
    case 'GP-04:post-mean-2d': {
      const w = wrongSigmaA(p), xs = [p.x1, p.x2, p.x3];
      const Sy = p.y1 + p.y2 + p.y3, Sxy = xs[0] * p.y1 + xs[1] * p.y2 + xs[2] * p.y3;
      const mu = mv(inverse(w), [Sy / p.sigma2, Sxy / p.sigma2]);
      const swapped = mv(inverse(dataA(p)), [Sxy / p.sigma2, Sy / p.sigma2]);
      return [[mu[0], mu[1]], [truth[1], truth[0]], [swapped[0], swapped[1]]];
    }
    case 'GP-04:challenge': {
      const w = inverse(wrongSigmaA(p)), xs = [p.x1, p.x2, p.x3];
      const Sy = p.y1 + p.y2 + p.y3, Sxy = xs[0] * p.y1 + xs[1] * p.y2 + xs[2] * p.y3;
      const mu = mv(w, [Sy / p.sigma2, Sxy / p.sigma2]);
      const Ai = inverse(dataA(p));
      return [[mu[1], quad([1, p.xs], w)], [truth[0], Ai[0][0] + p.xs ** 2 * Ai[1][1]], [truth[0], p.xs ** 2 * Ai[1][1]], [truth[0], truth[1] + p.sigma2], [truth[0], quad([1, p.xs], dataA(p))],
        [mv(Ai, [Sy, Sxy])[1], truth[1]]];
    }
    default: return [];
  }
}
function toFraction(v: number): string {
  for (let d = 1; d <= 5000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return d === 1 ? `${n}` : `${n}/${d}`; }
  throw new Error(`no small fraction for ${v}`);
}

// ---------- printed text ----------
const grab = (text: string, re: RegExp): number => {
  const m = re.exec(text);
  if (!m) throw new Error(`no match for ${re} in: ${text.slice(0, 200)}`);
  return Number(m[1]);
};
const frac = (s: string): number => { const [a, b] = s.trim().split('/'); return b === undefined ? Number(a) : Number(a) / Number(b); };
/** All 2x2 matrices printed as [[a, b], [c, d]] in order of appearance. */
function matrices(text: string): M[] {
  return [...text.matchAll(/\[\[\s*([^,\]]+),\s*([^,\]]+)\],\s*\[\s*([^,\]]+),\s*([^,\]]+)\]\]/g)].map(m => [[frac(m[1]), frac(m[2])], [frac(m[3]), frac(m[4])]]);
}
const eqM = (A: M, B: M) => A.every((r, i) => r.every((v, j) => Math.abs(v - B[i][j]) < 1e-9));
const SIG = /σ² = (\d+)/;
const PAIR = (a: string, b: string) => new RegExp(`\\(${a}, ${b}\\) = \\((-?\\d+), (-?\\d+)\\)`);
const pairVals = (t: string, i: number) => { const m = PAIR(`x_${i}`, `y_${i}`).exec(t); if (!m) throw new Error(`no (x_${i}, y_${i}) in ${t.slice(0, 160)}`); return [Number(m[1]), Number(m[2])]; };
function threePoints(t: string): number[] {
  const m = /\((-?\d+), (-?\d+)\)[、,，] ?\((-?\d+), (-?\d+)\)[、,，] ?\((-?\d+), (-?\d+)\)/.exec(t);
  if (!m) throw new Error(`no three points in ${t.slice(0, 200)}`);
  return m.slice(1, 7).map(Number);
}
function printedParams(kind: string, raw: string): P {
  const t = clean(raw);
  const base1 = () => { const [x1, y1] = pairVals(t, 1), [x2, y2] = pairVals(t, 2); return { x1, y1, x2, y2, sigma2: grab(t, SIG), tau2: grab(t, /w ~ N\(0, (\d+)\)/) }; };
  switch (kind) {
    case 'GP-04:post-mean-1d': {
      const p = base1();
      if (grab(t, /X Xᵀ = (\d+)/) !== p.x1 ** 2 + p.x2 ** 2) throw new Error('printed X Xᵀ differs from sum of squares');
      if (grab(t, /X y = (-?\d+)/) !== p.x1 * p.y1 + p.x2 * p.y2) throw new Error('printed X y differs from sum x y');
      return p;
    }
    case 'GP-04:pred-mean-1d': case 'GP-04:pred-var-1d': return { ...base1(), xs: grab(t, /x\* = (-?\d+)/) };
    case 'GP-04:post-cov-2d': {
      const [Sp, Sinv, XX] = matrices(t);
      const m = /x = (-?\d+)[、,，] ?(-?\d+)[、,，] ?(-?\d+)/.exec(t);
      if (!m) throw new Error('no three x values');
      const xs = m.slice(1, 4).map(Number);
      const Sx = xs[0] + xs[1] + xs[2], Sxx = xs.reduce((a, b) => a + b * b, 0);
      if (!eqM(XX, [[3, Sx], [Sx, Sxx]])) throw new Error(`printed X Xᵀ ${JSON.stringify(XX)} differs from the x values`);
      if (Sp[0][1] !== 0 || Sp[1][0] !== 0) throw new Error('Sigma_p not diagonal');
      if (!eqM(Sinv, diag(1 / Sp[0][0], 1 / Sp[1][1]))) throw new Error('printed Sigma_p⁻¹ is not the inverse of the printed Sigma_p');
      return { x1: xs[0], x2: xs[1], x3: xs[2], sigma2: grab(t, SIG), tau02: Sp[0][0], tau12: Sp[1][1] };
    }
    case 'GP-04:post-mean-2d': case 'GP-04:challenge': {
      const [Sp] = matrices(t);
      const q = threePoints(t);
      const out: P = { x1: q[0], y1: q[1], x2: q[2], y2: q[3], x3: q[4], y3: q[5], sigma2: grab(t, SIG), tau02: Sp[0][0], tau12: Sp[1][1] };
      if (Sp[0][1] !== 0 || Sp[1][0] !== 0) throw new Error('Sigma_p not diagonal');
      if (kind === 'GP-04:challenge') out.xs = grab(t, /x\* = (-?\d+)/);
      return out;
    }
    default: throw new Error(`unknown kind ${kind}`);
  }
}

// ---------- plan sampling tables ----------
const key = (...v: number[]) => v.join(',');
const T1 = new Set(['1,2,2,2,1,1', '1,2,3,3,1,1', '2,4,3,6,1,1', '1,2,2,5,1,2', '1,2,4,2,1,1', '1,2,2,3,2,1', '2,3,2,6,1,1', '1,2,2,2,2,2', '1,3,3,2,1,1']);
const T2 = new Set(['1,2,2,2,1,1,2', '2,4,3,6,1,1,2', '1,2,4,2,1,1,3', '1,2,3,3,1,1,1', '2,3,2,6,1,1,2', '1,2,2,5,1,2,2', '1,3,3,2,1,1,3']);
const T3 = new Set(['1,2,2,2,1,1,2', '1,2,3,3,1,1,1', '2,3,2,6,2,2,3', '1,2,2,5,1,2,2', '2,4,3,6,1,1,1', '1,2,2,2,1,1,1', '1,2,4,2,1,1,2']);
const T4 = new Set(['0,1,2,1,1,1', '0,1,2,1,1,2', '0,1,2,1,2,1', '0,1,2,2,1,1', '0,1,2,2,2,2', '1,2,3,1,1,1', '1,2,3,1,2,1']);
const T5 = new Set(['0,1,1,2,2,3,1,1,1', '0,1,1,1,1,1,1,1,1', '0,0,1,0,2,3,1,1,1', '0,0,1,0,2,3,1,1,2', '0,0,1,0,2,3,1,2,1', '0,0,1,0,2,3,2,1,1', '0,2,1,2,2,2,1,1,1', '0,1,1,3,2,5,1,1,1']);
const T8 = new Set(['1,1,2,2,3,3,1,1,1,1', '1,1,2,2,3,3,1,2,1,2', '1,2,2,3,3,1,1,1,1,2', '1,2,2,3,3,1,1,1,2,3', '1,3,2,2,3,1,1,1,1,1', '1,3,2,2,3,1,2,1,1,1']);

describe('GP-04 oracle: deck shape', () => {
  it('has the 8 planned cards in order, right answer modes, one audit per numeric card, exact kinds, no figures, tolerance 0.006', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const cards = gp04(seedAt(i), lang);
      const at = `seed ${seedAt(i)} ${lang}`;
      if (cards.map(c => c.id).join() !== slugs.map(s => `GP-04-${s}`).join()) { fails.push(`${at}: ids ${cards.map(c => c.id)}`); continue; }
      for (const c of cards) {
        const slug = c.id.slice(6);
        const numeric = !['precision-add', 'weaker-prior'].includes(slug);
        if (numeric !== !!c.fields) fails.push(`${at} ${slug}: fields presence`);
        if (!numeric && !c.choice) fails.push(`${at} ${slug}: expected a choice card`);
        if (c.slots) fails.push(`${at} ${slug}: unexpected slots`);
        if (c.figure || c.choice?.figures) fails.push(`${at} ${slug}: the plan says no figure on any card`);
        if (!!c.audit !== numeric) fails.push(`${at} ${slug}: audit presence`);
        if (c.audit && c.audit.kind !== `GP-04:${slug}`) fails.push(`${at} ${slug}: audit kind ${c.audit.kind}`);
        if (c.choice && c.choice.options.length !== 4) fails.push(`${at} ${slug}: ${c.choice.options.length} options`);
        if (c.fields) c.fields.forEach((f, k) => { if (f.tolerance !== TOL) fails.push(`${at} ${slug} field ${k}: tolerance ${f.tolerance}`); });
      }
      const nFields: Record<string, number> = { 'post-mean-1d': 1, 'pred-mean-1d': 1, 'pred-var-1d': 2, 'post-cov-2d': 2, 'post-mean-2d': 2, challenge: 2 };
      for (const [slug, n] of Object.entries(nFields)) if (pick(cards, slug).fields!.length !== n) fails.push(`${at} ${slug}: needs ${n} fields`);
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
      if (kinds.join() !== [...KINDS].sort().join()) fails.push(`${at}: audit kinds ${kinds}`);
      // prompt ending required by the plan
      for (const c of cards) if (c.fields) {
        const one = c.fields.length === 1;
        const en = one ? 'Give an integer, a fraction or a decimal rounded to 2 places.' : 'Give integers, fractions or decimals rounded to 2 places.';
        if (lang === 'en' && !c.prompt.endsWith(en)) fails.push(`${at} ${c.id}: EN prompt ending`);
        if (lang === 'zh' && !c.prompt.endsWith('请填整数、分数，或保留 2 位小数的小数。')) fails.push(`${at} ${c.id}: ZH prompt ending`);
      }
      const pc = pick(cards, 'post-cov-2d').audit!.params;
      if (Object.keys(pc).some(k => k.startsWith('y'))) fails.push(`${at}: post-cov-2d audit carries targets`);
      const expectedKeys: Record<string, string[]> = {
        'post-mean-1d': ['x1', 'y1', 'x2', 'y2', 'sigma2', 'tau2'], 'pred-mean-1d': ['x1', 'y1', 'x2', 'y2', 'sigma2', 'tau2', 'xs'], 'pred-var-1d': ['x1', 'y1', 'x2', 'y2', 'sigma2', 'tau2', 'xs'],
        'post-cov-2d': ['x1', 'x2', 'x3', 'sigma2', 'tau02', 'tau12'], 'post-mean-2d': ['x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'sigma2', 'tau02', 'tau12'],
        challenge: ['x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'sigma2', 'tau02', 'tau12', 'xs'],
      };
      for (const [slug, ks] of Object.entries(expectedKeys)) if (Object.keys(pick(cards, slug).audit!.params).sort().join() !== [...ks].sort().join()) fails.push(`${at} ${slug}: audit param names`);
    }
    report(fails);
  });
});

describe('GP-04 oracle: numeric answers by independent conditioning', () => {
  for (const kind of KINDS) {
    it(`${kind}: answers, grading, wrong routes, printed text, sampling table (60 spread seeds x EN/ZH)`, () => {
      const fails: string[] = [];
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) {
        for (const lang of ['en', 'zh'] as Lang[]) {
          const card = gp04(seedAt(i), lang).find(c => c.audit?.kind === kind);
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
          const asValues = (vs: string[]) => gradeCard(card, vs, null, []);
          const fr = expected.map(toFraction), dec = expected.map(v => v.toFixed(2));
          if (asValues(fr) !== 'correct') fails.push(`${where}: fractions ${fr} not graded correct`);
          if (asValues(dec) !== 'correct') fails.push(`${where}: decimals ${dec} not graded correct`);
          expected.forEach((v, k) => {
            for (const d of [0.02, -0.02, 0.007, -0.007]) {
              const vals = [...fr]; vals[k] = (v + d).toFixed(4);
              if (asValues(vals) !== 'incorrect') fails.push(`${where} field ${k}: perturbation ${d} graded ${asValues(vals)}`);
            }
          });
          for (const wrong of wrongRoutes(kind, params, expected)) {
            // a route that coincides EXACTLY with the truth in this row (e.g. sigma2/tau2 = sigma2 when tau2 = 1, or x* = 1) is not a wrong route here
            if (wrong.every((w, k) => Math.abs(w - expected[k]) < 1e-9)) continue;
            if (wrong.every((w, k) => Math.abs(w - expected[k]) < 0.02)) fails.push(`${where}: wrong route ${wrong} is within 0.02 of truth ${expected}`);
            else if (asValues(wrong.map(w => w.toFixed(4))) === 'correct') fails.push(`${where}: wrong route ${wrong} graded correct`);
          }
          try {
            const printed = printedParams(kind, card.prompt);
            for (const [name, v] of Object.entries(params)) if (printed[name] !== v) fails.push(`${where}: printed ${name}=${printed[name]} but audit ${v}`);
            for (const name of Object.keys(printed)) if (!(name in params)) fails.push(`${where}: printed ${name} missing from audit`);
          } catch (e) { fails.push(`${where}: ${(e as Error).message}`); }
          const tableFail = (m: string) => fails.push(`${where}: ${m}`);
          const q = params;
          if (kind === 'GP-04:post-mean-1d' && !T1.has(key(q.x1, q.y1, q.x2, q.y2, q.sigma2, q.tau2))) tableFail('row not in table');
          if (kind === 'GP-04:pred-mean-1d' && !T2.has(key(q.x1, q.y1, q.x2, q.y2, q.sigma2, q.tau2, q.xs))) tableFail('row not in table');
          if (kind === 'GP-04:pred-var-1d' && !T3.has(key(q.x1, q.y1, q.x2, q.y2, q.sigma2, q.tau2, q.xs))) tableFail('row not in table');
          if (kind === 'GP-04:post-cov-2d') {
            if (!T4.has(key(q.x1, q.x2, q.x3, q.sigma2, q.tau02, q.tau12))) tableFail('row not in table');
            if (!isPD2(dataA(q))) tableFail('A not positive definite');
            if (expected.some(v => v < 0.1)) tableFail('answer below 1/10');
          }
          if (kind === 'GP-04:post-mean-2d') {
            if (!T5.has(key(q.x1, q.y1, q.x2, q.y2, q.x3, q.y3, q.sigma2, q.tau02, q.tau12))) tableFail('row not in table');
            if (!isPD2(dataA(q))) tableFail('A not positive definite');
            if (expected.some(v => Math.abs(v) > 0 && Math.abs(v) < 0.02)) tableFail('small nonzero mu');
          }
          if (kind === 'GP-04:challenge') {
            if (!T8.has(key(q.x1, q.y1, q.x2, q.y2, q.x3, q.y3, q.sigma2, q.tau02, q.tau12, q.xs))) tableFail('row not in table');
            if (!isPD2(dataA(q))) tableFail('A not positive definite');
            if (!(expected[1] > 0) || Math.abs(expected[0]) < 1e-12) tableFail('Var <= 0 or mu1 = 0');
          }
          // plan guards (individual wrong routes >= 0.02 from the truth on the relevant field)
          if (kind === 'GP-04:post-mean-1d' || kind === 'GP-04:pred-mean-1d') if (Math.abs(expected[0]) < 0.02) tableFail('|answer| < 0.02');
        }
      }
      expect(fired).toBe(SEEDS * 2);
      report(fails);
    });
  }

  it('EN and ZH decks carry identical audits and answers; explanation states each answer; hint does not give it away', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const en = gp04(seedAt(i), 'en'), zh = gp04(seedAt(i), 'zh');
      en.forEach((c, k) => {
        if (JSON.stringify(c.audit) !== JSON.stringify(zh[k].audit)) fails.push(`${c.id} seed ${seedAt(i)}: audit differs between languages`);
        if (!c.fields) return;
        for (const [lang, card] of [['en', c], ['zh', zh[k]]] as const) {
          const expl = clean(card.explanation), hint = clean(card.hint);
          card.fields!.forEach((f, j) => {
            const fr = toFraction(f.answer);
            if (!expl.includes(fr)) fails.push(`${c.id} ${lang} seed ${seedAt(i)} field ${j}: explanation does not contain ${fr}`);
            if (fr.includes('/') && hint.includes(fr)) fails.push(`${c.id} ${lang} seed ${seedAt(i)}: hint contains the answer ${fr}`);
          });
        }
      });
    }
    report(fails);
  });

  it('variety: each numeric card has at least 6 distinct prompts over 60 seeds', () => {
    const fails: string[] = [];
    for (const slug of ['post-mean-1d', 'pred-mean-1d', 'pred-var-1d', 'post-cov-2d', 'post-mean-2d', 'challenge']) {
      const seen = new Set<string>();
      for (let i = 0; i < SEEDS; i++) seen.add(pick(gp04(seedAt(i), 'en'), slug).prompt);
      if (seen.size < 6) fails.push(`${slug}: only ${seen.size} distinct prompts`);
    }
    report(fails);
  });
});

// ---------- choice cards ----------
/** Evaluate an option "A = <coef> X Xᵀ <prior term>" numerically on a fixed test model and compare with the true A. */
function precisionOptionIsCorrect(option: string): boolean {
  const t = option.replace(/[.。]$/, '').split(/,|，/)[0];
  const XX: M = [[3, 6], [6, 14]], sigma2 = 2, Sp = diag(2, 3);
  const trueA = add(scale(XX, 1 / sigma2), inverse(Sp));
  let coef: number;
  if (/^A = \(1\/σ²\) X Xᵀ/.test(t)) coef = 1 / sigma2;
  else if (/^A = σ² X Xᵀ/.test(t)) coef = sigma2;
  else throw new Error(`cannot parse coefficient of "${option}"`);
  const rest = t.replace(/^A = (\(1\/σ²\)|σ²) X Xᵀ/, '').trim();
  let prior: M;
  if (rest === '+ Σ_p⁻¹') prior = inverse(Sp);
  else if (rest === '+ Σ_p') prior = Sp;
  else if (rest === '') prior = diag(0, 0);
  else throw new Error(`cannot parse prior term "${rest}" of "${option}"`);
  return eqM(add(scale(XX, coef), prior), trueA);
}
function weakerPrior(text: string): { S: number; T: number; s2: number; a: number; b: number } {
  const t = clean(text);
  return { S: grab(t, /X Xᵀ = (\d+)/), T: grab(t, /X y = (-?\d+)/), s2: grab(t, SIG), a: grab(t, /(?:model A has|模型 A 为) w ~ N\(0, (\d+)\)/), b: grab(t, /(?:model B has|模型 B 为) w ~ N\(0, (\d+)\)/) };
}
/** Claims an option makes: variance direction and |mu| direction (null when it makes no claim). */
function claims(option: string): { v: number | null; m: number | null } {
  const t = clean(option);
  if (/both unchanged|都不变/.test(t)) return { v: 0, m: 0 };
  const vm = /variance is (larger|smaller)|后验方差更(大|小)/.exec(t);
  const v = vm ? (vm[1] === 'larger' || vm[2] === '大' ? 1 : -1) : null;
  let m: number | null = null;
  if (/mean is unchanged|后验均值不变/.test(t)) m = 0;
  else if (/\|mu\| is larger|\|mu\| 也更大/.test(t)) m = 1;
  else if (/\|mu\| is smaller|\|mu\| 也更小/.test(t)) m = -1;
  return { v, m };
}
function weakerTruth(p: { S: number; T: number; s2: number; a: number; b: number }) {
  const solve1 = (tau2: number) => { const r = solve({ X: [[Math.sqrt(p.S), 0]], y: [p.T / Math.sqrt(p.S), 0], sigmaP: [[tau2]], sigma2: p.s2 }); return { mu: r.mu[0], v: r.cov[0][0] }; };
  const A = solve1(p.a), B = solve1(p.b);
  return { v: Math.sign(B.v - A.v), m: Math.sign(Math.abs(B.mu) - Math.abs(A.mu)) };
}

describe('GP-04 oracle: choice cards', () => {
  it('precision-add: exactly one option evaluates to the true precision on a numeric model, answer index points to it, correct is not the longest, position varies', () => {
    const fails: string[] = [];
    const positions = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const c = pick(gp04(seedAt(i), lang), 'precision-add');
      const where = `seed ${seedAt(i)} ${lang}`;
      let verdicts: boolean[];
      try { verdicts = c.choice!.options.map(precisionOptionIsCorrect); } catch (e) { fails.push(`${where}: ${(e as Error).message}`); continue; }
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${where}: ${verdicts.filter(Boolean).length} options correct`);
      if (!verdicts[c.choice!.answer]) fails.push(`${where}: answer index ${c.choice!.answer} not the correct option`);
      const lens = c.choice!.options.map(o => o.length);
      if (lens[c.choice!.answer] === Math.max(...lens)) fails.push(`${where}: correct option is the longest`);
      if (lang === 'en') positions.add(c.choice!.answer);
    }
    if (positions.size < 2) fails.push('answer position never varies');
    report(fails);
  });

  it('weaker-prior: printed numbers are one of the two plan illustrations; exactly one option matches the computed effect; answer index points to it', () => {
    const fails: string[] = [];
    const seenRows = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const c = pick(gp04(seedAt(i), lang), 'weaker-prior');
      const where = `seed ${seedAt(i)} ${lang}`;
      let p: ReturnType<typeof weakerPrior>;
      try { p = weakerPrior(c.prompt); } catch (e) { fails.push(`${where}: ${(e as Error).message}`); continue; }
      const rk = key(p.S, p.T, p.s2, p.a, p.b);
      seenRows.add(rk);
      if (!['5,6,1,1,2', '10,9,1,1,4'].includes(rk)) fails.push(`${where}: row ${rk} is not a plan illustration`);
      if (!(p.b > p.a) || p.T === 0) fails.push(`${where}: needs tauB2 > tauA2 and T != 0`);
      const truth = weakerTruth(p);
      const ok = c.choice!.options.map(o => {
        const cl = claims(o);
        if (cl.v === null && cl.m === null) throw new Error(`option makes no parseable claim: ${o}`);
        return (cl.v === null || cl.v === truth.v) && (cl.m === null || cl.m === truth.m);
      });
      if (ok.filter(Boolean).length !== 1) fails.push(`${where}: ${ok.filter(Boolean).length} options match the computed effect (${JSON.stringify(truth)})`);
      if (!ok[c.choice!.answer]) fails.push(`${where}: answer index ${c.choice!.answer} not the correct option`);
      if (truth.v !== 1 || truth.m !== 1) fails.push(`${where}: computed effect is ${JSON.stringify(truth)}, not (+1,+1)`);
      // the explanation numbers of the illustrations must be true
    }
    if (seenRows.size < 1) fails.push('no rows seen');
    report(fails);
  });

  it('weaker-prior explanation numbers equal the exact values for both illustrations', () => {
    const fails: string[] = [];
    const ex = (S: number, T: number, s2: number, tau: number) => { const A = S / s2 + 1 / tau; return { mu: (T / s2) / A, v: 1 / A }; };
    const cases: [number, number, number, number, number][] = [[5, 6, 1, 1, 2], [10, 9, 1, 1, 4]];
    const c = pick(gp04(seedAt(0), 'en'), 'weaker-prior');
    const expl = clean(c.explanation);
    for (const [S, T_, s2, a, b] of cases) for (const tau of [a, b]) {
      const r = ex(S, T_, s2, tau);
      for (const val of [r.mu, r.v]) if (!expl.includes(val.toFixed(3)) && !expl.includes(toFraction(val))) fails.push(`explanation lacks ${val} (S=${S}, tau=${tau})`);
    }
    report(fails);
  });
});
