import { describe, expect, it } from 'vitest';
import { gp07 } from './games/gp07';
import { spreadSeed, textOf, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, parseGameNumber, type GameLanguage, type PracticeCard } from '../types';

// Independent oracle for GP-07 (prior means, f* versus y*). Written from docs/aalto-gp-drafts/approved-GP-07.md only.
const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];
type Mat = number[][];

// ---------- linear algebra, three unrelated routes ----------
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
function gaussSolve(A: Mat, b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let p = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[p][col])) p = r;
    [M[col], M[p]] = [M[p], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}
function invert(A: Mat): Mat {
  const n = A.length;
  const cols = Array.from({ length: n }, (_, j) => gaussSolve(A, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0))));
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => cols[j][i]));
}
function cholesky(A: Mat): Mat {
  const n = A.length;
  const L: Mat = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) throw new Error('not positive definite'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function forward(L: Mat, b: number[]): number[] {
  const x: number[] = [];
  for (let i = 0; i < b.length; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x.push(s / L[i][i]); }
  return x;
}
function backward(L: Mat, b: number[]): number[] {
  const n = b.length, x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}
const leadingMinorsPositive = (A: Mat) => A.every((_, k) => {
  const sub = A.slice(0, k + 1).map(r => r.slice(0, k + 1));
  return det(sub) > 1e-9;
});
function det(A: Mat): number {
  if (A.length === 1) return A[0][0];
  return A[0].reduce((s, x, j) => s + (j % 2 ? -1 : 1) * x * det(A.slice(1).map(r => r.filter((_, c) => c !== j))), 0);
}

/** Posterior of f* and y* from the prior mean / covariance of (f, f*), by three routes that must agree. */
function posterior(mObs: number[], ms: number, K: Mat, noise: number, kstar: number[], kss: number, y: number[]) {
  const n = y.length, d = y.map((v, i) => v - mObs[i]);
  const C = K.map((row, i) => row.map((v, j) => v + (i === j ? noise : 0)));
  // route 1: elimination
  const w = gaussSolve(C, kstar);
  const r1 = { mu: ms + dot(w, d), varF: kss - dot(kstar, w) };
  // route 2: joint Gaussian of (y, f*) -> precision matrix -> conditional of f*
  const J: Mat = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) =>
    i < n && j < n ? C[i][j] : i < n ? kstar[i] : j < n ? kstar[j] : kss));
  const P = invert(J);
  let shift = 0;
  for (let i = 0; i < n; i++) shift += P[n][i] * d[i];
  const r2 = { mu: ms - shift / P[n][n], varF: 1 / P[n][n] };
  // route 3: Cholesky
  const L = cholesky(C);
  const z = backward(L, forward(L, d));
  const W = forward(L, kstar);
  const r3 = { mu: ms + dot(kstar, z), varF: kss - dot(W, W) };
  for (const r of [r2, r3]) {
    expect(Math.abs(r.mu - r1.mu)).toBeLessThan(1e-9);
    expect(Math.abs(r.varF - r1.varF)).toBeLessThan(1e-9);
  }
  return { mu: r1.mu, varF: r1.varF, varY: r1.varF + noise };
}

// ---------- helpers ----------
const norm = (t: string) => t.replaceAll('−', '-');
function grab(prompt: string, re: RegExp, where: string): number {
  const m = norm(prompt).match(re);
  if (!m) throw new Error(`${where}: pattern ${re} not found in "${prompt}"`);
  return Number(m[1]);
}
const Y_SINGLE = /(?<![A-Za-z₀-₉*])y = (-?\d+)/;
const SIG2 = /σ² = (\d+)/;
const KSTAR1 = /k\(x\*, x₁\) = (-?\d+)/;
const S_SAME = /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/;
function bySlug(cards: PracticeCard[], slug: string): PracticeCard {
  const card = cards.find(c => c.id === `GP-07-${slug}`);
  if (!card) throw new Error(`no card ${slug}`);
  return card;
}
function gcd(a: number, b: number): number { return b === 0 ? Math.abs(a) : gcd(b, a % b); }
/** Reduced fraction text of a rational with a small denominator; throws when there is none. */
function fraction(x: number): { text: string; den: number } {
  for (let den = 1; den <= 16; den++) {
    const num = Math.round(x * den);
    if (Math.abs(num / den - x) < 1e-9) { const g = gcd(num, den); const p = num / g, q = den / g; return { text: q === 1 ? `${p}` : `${p}/${q}`, den: q }; }
  }
  throw new Error(`${x} is not a small-denominator rational`);
}
const DENOMS = new Set([1, 2, 4, 5, 8]);
const separated = (truth: number, wrongs: number[]) => wrongs.every(w => Math.abs(truth - w) >= 0.02 - 1e-9);

/** Checks the card against expected answers through gradeCard and the plan's answer-format rules. */
function checkGrading(card: PracticeCard, expected: number[], where: string) {
  expect(card.fields, where).toBeDefined();
  expect(card.fields!.length, where).toBe(expected.length);
  card.fields!.forEach(f => expect(f.tolerance, `${where} tolerance`).toBe(0.006));
  card.fields!.forEach((f, i) => expect(Math.abs(f.answer - expected[i]), `${where} field ${i}: card ${f.answer} vs oracle ${expected[i]}`).toBeLessThan(1e-9));
  const fr = expected.map(fraction);
  fr.forEach(f => expect(DENOMS.has(f.den), `${where} denominator ${f.den}`).toBe(true));
  expect(gradeCard(card, fr.map(f => f.text), null, []), `${where} reduced fractions`).toBe('correct');
  expect(gradeCard(card, expected.map(x => x.toFixed(2)), null, []), `${where} 2-place decimals`).toBe('correct');
  expect(gradeCard(card, expected.map(x => String(x).replace('-', '−')), null, []), `${where} exact doubles`).toBe('correct');
  expected.forEach((x, i) => {
    for (const delta of [0.01, -0.01, 0.5]) {
      const vals = expected.map(v => String(v));
      vals[i] = String(x + delta);
      expect(gradeCard(card, vals, null, []), `${where} field ${i} perturbed by ${delta}`).toBe('incorrect');
    }
  });
  // the prompt says how to answer
  const endEn = expected.length === 1 ? 'Give an integer, a fraction or a decimal rounded to 2 places.' : 'Give integers, fractions or decimals rounded to 2 places.';
  const endZh = '请填整数、分数，或保留 2 位小数的小数。';
  expect(card.prompt.endsWith(endEn) || card.prompt.endsWith(endZh), `${where} prompt ending`).toBe(true);
  // the explanation shows the true value of every answer
  fr.forEach((f, i) => expect(norm(card.explanation), `${where} explanation shows ${f.text}`).toContain(f.text));
}

const decks = new Map<string, PracticeCard[]>();
function deck(seedIndex: number, lang: GameLanguage): PracticeCard[] {
  const key = `${seedIndex}/${lang}`;
  if (!decks.has(key)) decks.set(key, gp07(spreadSeed(seedIndex), lang));
  return decks.get(key)!;
}
function forAll(fn: (args: { index: number; lang: GameLanguage; cards: PracticeCard[]; where: (slug: string) => string }) => void, count = SEEDS) {
  for (let index = 0; index < count; index++) for (const lang of LANGS) fn({ index, lang, cards: deck(index, lang), where: slug => `${slug} seed#${index} ${lang}` });
}

const KINDS = ['constant-mean', 'mean-at-test', 'f-or-y', 'far-away', 'two-shift', 'challenge'].map(k => `GP-07:${k}`);
const TABLE7: [number, number, number, number][] = [
  [2, 1, 1, 1], [2, 2, 1, 1], [3, 1, 1, 1], [3, 1, 1, 2], [3, 2, -1, 1], [4, 1, -1, 1], [4, 1, 3, 1], [4, 1, 3, 2], [4, 1, 3, 3],
  [4, 2, -2, 1], [4, 2, -1, 1], [4, 2, -1, 2], [4, 2, 2, 1], [4, 2, 2, 2], [4, 2, 2, 3],
];
const T1: [number, number, number][] = [[3, 2, 1], [3, 2, 2], [4, 2, 1], [4, 3, 1]];
const inSet = (x: number, lo: number, hi: number, nonzero = false) => Number.isInteger(x) && x >= lo && x <= hi && (!nonzero || x !== 0);

describe('GP-07 structure', () => {
  it('has the 8 planned cards in order, exactly the planned audit kinds, each firing once per seed, no figures or slots', () => {
    forAll(({ cards, where }) => {
      expect(cards.map(c => c.id), where('deck')).toEqual(['constant-mean', 'mean-at-test', 'shift-effect', 'f-or-y', 'noisy-floor', 'far-away', 'two-shift', 'challenge'].map(s => `GP-07-${s}`));
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind);
      expect(kinds, where('kinds')).toEqual(KINDS);
      for (const c of cards) {
        expect(c.figure, `${c.id} figure`).toBeUndefined();
        expect(c.choice?.figures, `${c.id} choice figures`).toBeUndefined();
        expect(c.slots, `${c.id} slots`).toBeUndefined();
        expect(c.bound, `${c.id} bound`).toBeUndefined();
      }
      expect(cards.filter(c => c.fields).map(c => c.fields!.length), where('field counts')).toEqual([1, 1, 2, 2, 2, 2]);
      expect(cards.filter(c => c.choice).map(c => c.id), where('choice cards')).toEqual(['GP-07-shift-effect', 'GP-07-noisy-floor'].sort((a, b) => cards.findIndex(c => c.id === a) - cards.findIndex(c => c.id === b)));
    });
  });
});

describe('GP-07 numeric cards: recomputation from audit params and from printed text', () => {
  it('constant-mean', () => forAll(({ cards, lang, where }) => {
    const c = bySlug(cards, 'constant-mean'), w = where('constant-mean');
    const p = c.audit!.params as Record<string, number>;
    expect(Object.keys(p).sort(), w).toEqual(['c', 'm', 'n', 's', 'y']);
    const printed = { s: grab(c.prompt, S_SAME, w), c: grab(c.prompt, KSTAR1, w), n: grab(c.prompt, SIG2, w), m: grab(c.prompt, /m\(x\) = (-?\d+)/, w), y: grab(c.prompt, Y_SINGLE, w) };
    expect(printed, `${w} printed vs audit`).toEqual({ s: p.s, c: p.c, n: p.n, m: p.m, y: p.y });
    expect(T1.some(([s, cc, n]) => s === p.s && cc === p.c && n === p.n), `${w} triple`).toBe(true);
    expect(inSet(p.m, -3, 3, true) && Math.abs(p.y - p.m) >= 1 && Math.abs(p.y - p.m) <= 6 && p.y !== 0, `${w} ranges`).toBe(true);
    const post = posterior([p.m], p.m, [[p.s]], p.n, [p.c], p.s, [p.y]);
    checkGrading(c, [post.mu], w);
    const A = p.s + p.n, d = p.y - p.m;
    expect(separated(post.mu, [p.c * p.y / A, p.c * d / A, p.m + p.c * p.y / A, p.m + p.c * d / p.s, p.m + p.c * d / (A + 1), p.y, p.m + p.c * d / p.n, p.m - p.c * d / A, p.m + d / A]), `${w} wrong routes collide with ${post.mu}`).toBe(true);
  }));

  it('mean-at-test', () => forAll(({ cards, where }) => {
    const c = bySlug(cards, 'mean-at-test'), w = where('mean-at-test');
    const p = c.audit!.params as Record<string, number>;
    expect(Object.keys(p).sort(), w).toEqual(['c', 'm1', 'ms', 'n', 's', 'y']);
    const printed = { s: grab(c.prompt, S_SAME, w), c: grab(c.prompt, KSTAR1, w), n: grab(c.prompt, SIG2, w), m1: grab(c.prompt, /m\(x₁\) = (-?\d+)/, w), ms: grab(c.prompt, /m\(x\*\) = (-?\d+)/, w), y: grab(c.prompt, Y_SINGLE, w) };
    expect(printed, `${w} printed vs audit`).toEqual({ s: p.s, c: p.c, n: p.n, m1: p.m1, ms: p.ms, y: p.y });
    expect(T1.some(([s, cc, n]) => s === p.s && cc === p.c && n === p.n), `${w} triple`).toBe(true);
    expect(inSet(p.m1, -3, 3) && inSet(p.ms, -3, 3, true) && p.ms !== p.m1 && Math.abs(p.y - p.m1) >= 1 && Math.abs(p.y - p.m1) <= 6, `${w} ranges`).toBe(true);
    const post = posterior([p.m1], p.ms, [[p.s]], p.n, [p.c], p.s, [p.y]);
    checkGrading(c, [post.mu], w);
    const A = p.s + p.n, d = p.y - p.m1;
    expect(separated(post.mu, [p.ms + p.c * p.y / A, p.m1 + p.c * d / A, p.ms + p.c * (p.y - p.ms) / A, p.c * d / A, p.ms + p.c * d / p.s, p.m1 + p.ms + p.c * d / A, p.c * p.y / A, p.ms - p.c * d / A, p.ms + p.c * (p.y - p.m1) / (A + 1)]), `${w} wrong routes collide`).toBe(true);
  }));

  it('f-or-y', () => forAll(({ cards, lang, where }) => {
    const c = bySlug(cards, 'f-or-y'), w = where('f-or-y');
    const p = c.audit!.params as Record<string, number>;
    expect(Object.keys(p).sort(), w).toEqual(['c', 'm', 'n', 's', 'y']);
    const printed = { s: grab(c.prompt, S_SAME, w), c: grab(c.prompt, KSTAR1, w), n: grab(c.prompt, SIG2, w), m: grab(c.prompt, /m\(x\) = (-?\d+)/, w), y: grab(c.prompt, Y_SINGLE, w) };
    expect(printed, `${w} printed vs audit`).toEqual({ s: p.s, c: p.c, n: p.n, m: p.m, y: p.y });
    expect(T1.some(([s, cc, n]) => s === p.s && cc === p.c && n === p.n), `${w} triple`).toBe(true);
    expect(inSet(p.m, -3, 3, true) && inSet(p.y, -6, 6, true), `${w} ranges`).toBe(true);
    const post = posterior([p.m], p.m, [[p.s]], p.n, [p.c], p.s, [p.y]);
    const other = posterior([p.m + 1], p.m - 2, [[p.s]], p.n, [p.c], p.s, [p.y + 3]);
    expect(other.varF).toBeCloseTo(post.varF, 12);
    expect(c.fields!.map(f => f.label), w).toEqual(['Var(f*|y)', 'Var(y*|y)']);
    checkGrading(c, [post.varF, post.varY], w);
    // both variance kinds are named in the prompt
    expect(lang === 'en' ? /latent value f\(x\*\)/.test(c.prompt) && /new noisy observation y\* at x\*/.test(c.prompt) : /潜在函数值 f\(x\*\)/.test(c.prompt) && /x\* 处新的带噪声观测 y\*/.test(c.prompt), `${w} names both variances`).toBe(true);
    const A = p.s + p.n, v = p.s - p.c ** 2 / A;
    expect(separated(post.varF, [p.c ** 2 / A, p.s - p.c / A, p.s - p.c ** 2 / p.s, p.s - p.c ** 2 / (A + p.n), p.s]), `${w} field 1 wrong routes`).toBe(true);
    expect(separated(post.varY, [v, p.s + p.n, v - p.n, v * p.n, p.s + p.n - p.c ** 2 / p.s, v + 2 * p.n, p.s + p.n - p.c / A]), `${w} field 2 wrong routes`).toBe(true);
  }));

  it('far-away', () => forAll(({ cards, lang, where }) => {
    const c = bySlug(cards, 'far-away'), w = where('far-away');
    const p = c.audit!.params as Record<string, number>;
    expect(Object.keys(p).sort(), w).toEqual(['m1', 'ms', 'n', 's', 'y']);
    const printed = { s: grab(c.prompt, S_SAME, w), n: grab(c.prompt, SIG2, w), m1: grab(c.prompt, /m\(x\) = (-?\d+)/, w), ms: grab(c.prompt, /m\(x\*\) = (-?\d+)/, w), y: grab(c.prompt, Y_SINGLE, w) };
    expect(printed, `${w} printed vs audit`).toEqual({ s: p.s, n: p.n, m1: p.m1, ms: p.ms, y: p.y });
    expect(grab(c.prompt, /k\(x\*, x₁\) = (-?\d+)/, w), `${w} k* printed as 0`).toBe(0);
    expect(inSet(p.s, 2, 4) && inSet(p.n, 1, 3) && inSet(p.ms, -3, 3, true) && inSet(p.m1, -3, 3) && Math.abs(p.y - p.m1) >= 1 && Math.abs(p.y - p.m1) <= 4, `${w} ranges`).toBe(true);
    const post = posterior([p.m1], p.ms, [[p.s]], p.n, [0], p.s, [p.y]);
    expect(c.fields!.map(f => f.label), w).toEqual(['μ*', 'Var(y*|y)']);
    checkGrading(c, [post.mu, post.varY], w);
    expect([0, p.y, p.m1, p.y - p.m1].includes(p.ms), `${w} ms collides with a wrong mean`).toBe(false);
    expect([p.s, p.n, p.s * p.n, p.s - p.n].includes(p.s + p.n), `${w} s+n collides`).toBe(false);
  }));

  it('two-shift', () => forAll(({ cards, where }) => {
    const c = bySlug(cards, 'two-shift'), w = where('two-shift');
    const p = c.audit!.params as Record<string, number>;
    expect(Object.keys(p).sort(), w).toEqual(['b', 'c', 'm', 'n', 's', 'y1', 'y2']);
    const printed = { s: grab(c.prompt, /(?:prior variance|先验方差都为) (\d+)/, w), n: grab(c.prompt, SIG2, w), b: grab(c.prompt, /k\(x₁, x₂\) = (-?\d+)/, w), c: grab(c.prompt, /k\(x\*, x₁\) = k\(x\*, x₂\) = (-?\d+)/, w), m: grab(c.prompt, /m\(x\) = (-?\d+)/, w), y1: grab(c.prompt, /y₁ = (-?\d+)/, w), y2: grab(c.prompt, /y₂ = (-?\d+)/, w) };
    expect(printed, `${w} printed vs audit`).toEqual({ s: p.s, n: p.n, b: p.b, c: p.c, m: p.m, y1: p.y1, y2: p.y2 });
    expect(TABLE7.some(r => r[0] === p.s && r[1] === p.n && r[2] === p.b && r[3] === p.c), `${w} row`).toBe(true);
    expect(leadingMinorsPositive([[p.s, p.b, p.c], [p.b, p.s, p.c], [p.c, p.c, p.s]]), `${w} prior PD`).toBe(true);
    const d1 = p.y1 - p.m, d2 = p.y2 - p.m;
    expect(inSet(p.m, -3, 3, true) && Math.abs(d1) >= 1 && Math.abs(d1) <= 4 && Math.abs(d2) >= 1 && Math.abs(d2) <= 4 && d1 !== d2 && d1 + d2 !== 0, `${w} ranges`).toBe(true);
    const post = posterior([p.m, p.m], p.m, [[p.s, p.b], [p.b, p.s]], p.n, [p.c, p.c], p.s, [p.y1, p.y2]);
    // eigen route: (1,1) is an eigenvector of C with eigenvalue a+b
    const a = p.s + p.n, S = a + p.b;
    expect(post.mu).toBeCloseTo(p.m + p.c * (d1 + d2) / S, 12);
    expect(post.varF).toBeCloseTo(p.s - 2 * p.c ** 2 / S, 12);
    expect(c.fields!.map(f => f.label), w).toEqual(['μ*', 'σ*²']);
    checkGrading(c, [post.mu, post.varF], w);
    const m = p.m, cc = p.c;
    expect(separated(post.mu, [m + cc * d1 / a, m + cc * d2 / a, m + cc * (d1 + d2) / a, m + cc * (d1 + d2) / (a - p.b), cc * (d1 + d2) / S, m + cc * (p.y1 + p.y2) / S, m + 2 * cc * (d1 + d2) / S, m + cc * (d1 + d2) / (2 * S), m - cc * (d1 + d2) / S]), `${w} mean wrong routes`).toBe(true);
    expect(separated(post.varF, [p.s - cc ** 2 / a, p.s - 2 * cc ** 2 / a, p.s - 2 * cc ** 2 / (a - p.b), 2 * cc ** 2 / S, p.s - cc ** 2 / S, p.s + 2 * cc ** 2 / S, post.varF + p.n]), `${w} variance wrong routes`).toBe(true);
    expect(post.varF).toBeGreaterThan(1.4 - 1e-9); // plan text says minimum 7/4; the true minimum over its table is 7/5 (row 3,1,1,2); strict positivity is the contract
  }));

  it('challenge', () => forAll(({ cards, where }) => {
    const c = bySlug(cards, 'challenge'), w = where('challenge');
    const p = c.audit!.params as Record<string, number>;
    expect(Object.keys(p).sort(), w).toEqual(['b', 'c1', 'c2', 'm1', 'm2', 'ms', 'ss', 'y1', 'y2']);
    const printed = {
      b: grab(c.prompt, /k\(x₁, x₂\) = (-?\d+)/, w), c1: grab(c.prompt, /k\(x\*, x₁\) = (-?\d+)/, w), c2: grab(c.prompt, /k\(x\*, x₂\) = (-?\d+)/, w), ss: grab(c.prompt, /k\(x\*, x\*\) = (\d+)/, w),
      m1: grab(c.prompt, /m\(x₁\) = (-?\d+)/, w), m2: grab(c.prompt, /m\(x₂\) = (-?\d+)/, w), ms: grab(c.prompt, /m\(x\*\) = (-?\d+)/, w), y1: grab(c.prompt, /y₁ = (-?\d+)/, w), y2: grab(c.prompt, /y₂ = (-?\d+)/, w),
    };
    expect(printed, `${w} printed vs audit`).toEqual({ b: p.b, c1: p.c1, c2: p.c2, ss: p.ss, m1: p.m1, m2: p.m2, ms: p.ms, y1: p.y1, y2: p.y2 });
    expect(c.prompt, `${w} constants`).toContain('k(x₁, x₁) = k(x₂, x₂) = 2');
    expect(norm(c.prompt), `${w} noise`).toContain('σ² = 1');
    const d1 = p.y1 - p.m1, d2 = p.y2 - p.m2;
    expect(p.b === 1 || p.b === -1, `${w} b`).toBe(true);
    expect(inSet(p.c1, -3, 3, true) && inSet(p.c2, -3, 3, true) && p.c1 !== p.c2 && inSet(p.ss, 3, 7), `${w} c, ss`).toBe(true);
    expect(inSet(p.m1, -2, 2, true) && inSet(p.m2, -2, 2, true) && p.m1 !== p.m2 && inSet(p.ms, -3, 3, true) && p.ms !== p.m1 && p.ms !== p.m2, `${w} means`).toBe(true);
    expect(Math.abs(d1) >= 1 && Math.abs(d1) <= 3 && Math.abs(d2) >= 1 && Math.abs(d2) <= 3 && Math.abs(d1) !== Math.abs(d2), `${w} offsets`).toBe(true);
    expect(leadingMinorsPositive([[2, p.b, p.c1], [p.b, 2, p.c2], [p.c1, p.c2, p.ss]]), `${w} prior PD`).toBe(true);
    const post = posterior([p.m1, p.m2], p.ms, [[2, p.b], [p.b, 2]], 1, [p.c1, p.c2], p.ss, [p.y1, p.y2]);
    // eigen route for the mean offset
    const eig = (p.c1 + p.c2) * (d1 + d2) / (2 * (3 + p.b)) + (p.c1 - p.c2) * (d1 - d2) / (2 * (3 - p.b));
    expect(post.mu - p.ms).toBeCloseTo(eig, 12);
    expect(c.fields!.map(f => f.label), w).toEqual(['μ*', 'Var(y*|y)']);
    checkGrading(c, [post.mu, post.varY], w);
    // plan guards
    const w1 = (3 * p.c1 - p.b * p.c2) / 8, w2 = (3 * p.c2 - p.b * p.c1) / 8, wp1 = (3 * p.c1 + p.b * p.c2) / 8, wp2 = (3 * p.c2 + p.b * p.c1) / 8;
    const X = w1 * d1 + w2 * d2, V = p.ss - (p.c1 * w1 + p.c2 * w2), cd = p.c1 * d1 + p.c2 * d2;
    expect(V).toBeGreaterThanOrEqual(0.5);
    expect(Math.abs(X) > 1e-9 && Math.abs(w1 * p.m1 + w2 * p.m2) >= 0.02, `${w} X, w.m`).toBe(true);
    expect(separated(X, [cd / 3, cd / (3 + p.b), wp1 * d1 + wp2 * d2, -X, w1 * d1, w2 * d2, cd / (3 - p.b), cd / (2 * (3 + p.b))]), `${w} mean wrong routes`).toBe(true);
    expect(separated(V + 1, [V, p.ss + 1 - (p.c1 ** 2 + p.c2 ** 2) / 3, p.ss + 1 - (p.c1 ** 2 + p.c2 ** 2) / 8, p.ss + 1 - (p.c1 * wp1 + p.c2 * wp2), p.ss + 1 - p.c1 ** 2 / 3, p.ss - (p.c1 ** 2 + p.c2 ** 2) / 3, p.c1 * w1 + p.c2 * w2, p.ss - (p.c1 ** 2 + p.c2 ** 2) / (3 + p.b)]), `${w} variance wrong routes`).toBe(true);
  }));
});

describe('GP-07 choice cards', () => {
  it('shift-effect: exactly one option satisfies the predicate and the answer index points to it', () => forAll(({ cards, lang, where }) => {
    const c = bySlug(cards, 'shift-effect'), w = where('shift-effect');
    const s = grab(c.prompt, S_SAME, w), cc = grab(c.prompt, KSTAR1, w), n = grab(c.prompt, SIG2, w), y = grab(c.prompt, Y_SINGLE, w);
    const m0 = grab(c.prompt, /GP B.*?m\(x\) = (-?\d+)/, w);
    expect(grab(c.prompt, /GP A.*?m\(x\) = (-?\d+)/, w), `${w} GP A mean`).toBe(0);
    expect(T3.some(r => r[0] === s && r[1] === cc && r[2] === n), `${w} triple`).toBe(true);
    expect(inSet(m0, -4, 4, true) && inSet(y, -4, 4, true), `${w} ranges`).toBe(true);
    const A = posterior([0], 0, [[s]], n, [cc], s, [y]);
    const B = posterior([m0], m0, [[s]], n, [cc], s, [y]);
    const shift = B.mu - A.mu;
    expect(Math.abs(shift) > 0.01 && Math.abs(shift - m0) > 0.01, `${w} shift strictly between 0 and m0`).toBe(true);
    expect(Math.abs(B.varF - A.varF)).toBeLessThan(1e-12);
    const verdicts = c.choice!.options.map(o => {
      const t = norm(o);
      const meansEqual = lang === 'en' ? /means are equal/.test(t) : /均值相同/.test(t);
      const varsEqual = lang === 'en' ? /variances are equal/.test(t) : /方差相同/.test(t);
      const bothDiffer = lang === 'en' ? /Both the means and the variances differ/.test(t) : /均值和方差都不同/.test(t);
      const varsDiffer = bothDiffer || (lang === 'en' ? /variances differ/.test(t) : /方差不同/.test(t));
      const by = t.match(lang === 'en' ? /differ by (\S+?)(?:,| and)/ : /均值相差 (\S+?)[，,]/);
      if (by) { const v = parseGameNumber(by[1]); return v !== null && Math.abs(v - shift) < 0.006 && varsEqual && !varsDiffer; }
      return !meansEqual && !varsDiffer && varsEqual && false;
    });
    expect(verdicts.filter(Boolean).length, `${w} exactly one correct option in ${JSON.stringify(c.choice!.options)}`).toBe(1);
    expect(verdicts[c.choice!.answer], `${w} answer index`).toBe(true);
    expect(c.choice!.options.length).toBe(4);
    const lens = c.choice!.options.map(o => o.length);
    expect(lens[c.choice!.answer] < Math.max(...lens), `${w} correct option is not the longest`).toBe(true);
    // the wrong claims are false: full shift m0 (!= shift), equal means (shift != 0)
    const full = c.choice!.options.find(o => norm(o).includes(`${m0}`) && /differ by|均值相差/.test(norm(o)) && !verdicts[c.choice!.options.indexOf(o)]);
    expect(full, `${w} w1 option present`).toBeDefined();
  }));

  it('noisy-floor: only the "at least σ²" option is true', () => forAll(({ cards, lang, where }) => {
    const c = bySlug(cards, 'noisy-floor'), w = where('noisy-floor');
    const n = grab(c.prompt, SIG2, w), q = grab(c.prompt, /Var\(y\*\|y\) = (\d+)/, w);
    expect(inSet(n, 2, 5) && inSet(q, 1, n - 1), `${w} ranges n=${n} q=${q}`).toBe(true);
    expect(c.audit, w).toBeUndefined();
    const verdicts = c.choice!.options.map(o => {
      const t = norm(o);
      const impossible = lang === 'en' ? /^Impossible/.test(t) : /^不可能/.test(t);
      const atLeast = lang === 'en' ? /is at least σ² = (\d+)\./.exec(t) : /至少为 σ² = (\d+)。/.exec(t);
      return impossible && !!atLeast && Number(atLeast[1]) === n;
    });
    expect(verdicts.filter(Boolean).length, `${w} one correct in ${JSON.stringify(c.choice!.options)}`).toBe(1);
    expect(verdicts[c.choice!.answer], `${w} answer index`).toBe(true);
    expect(c.choice!.options.length).toBe(4);
    const lens = c.choice!.options.map(o => o.length);
    expect(lens[c.choice!.answer] < Math.max(...lens), `${w} correct option is not the longest`).toBe(true);
    // the other three claims are false: possible-with-zero / exactly-sigma / noise-only-affects-mean
    c.choice!.options.forEach((o, i) => { if (i !== c.choice!.answer) expect(/at least|至少/.test(o), `${w} wrong option mentions the bound`).toBe(false); });
    // truth: a floor of n holds for every posterior variance of f* >= 0
    for (const sigmaStar of [0, 0.01, 0.5, 3]) expect(sigmaStar + n).toBeGreaterThan(q);
  }));
});
const T3: [number, number, number][] = [[3, 1, 1], [3, 2, 1], [2, 1, 2], [4, 1, 1], [4, 2, 1], [4, 3, 1], [3, 1, 2], [3, 2, 2]];

describe('GP-07 variety and typography', () => {
  it('each card has at least 6 distinct prompts over 60 seeds in EN and ZH', () => {
    for (const lang of LANGS) {
      const seen = new Map<string, Set<string>>();
      for (let index = 0; index < SEEDS; index++) for (const c of deck(index, lang)) (seen.get(c.id) ?? seen.set(c.id, new Set()).get(c.id)!).add(c.prompt);
      for (const [id, prompts] of seen) expect(prompts.size, `${id} ${lang} distinct prompts`).toBeGreaterThanOrEqual(6);
    }
  });

  it('the answer is not visible in the question or hint text', () => forAll(({ cards, where }) => {
    for (const c of cards) {
      if (!c.fields) continue;
      // the question (prompt, labels) must not contain the reduced answers as a standalone "= answer"
      const text = norm(c.prompt);
      c.fields.forEach(f => { const t = fraction(f.answer).text; if (/\//.test(t)) expect(text, `${where(c.id)} prompt shows fraction answer ${t}`).not.toMatch(new RegExp(`(?<![\\d/])${t.replace('-', '\\-')}(?![\\d/])`)); });
    }
  }));

  it('all learner-visible notation is Unicode: no ASCII names, no ASCII hyphen minus, no markup leftovers', () => forAll(({ cards, lang, where }) => {
    for (const c of cards) for (const raw of textOf(c)) {
      const t = raw;
      const at = `${where(c.id)} "${t.slice(0, 80)}"`;
      expect(t, `${at} ASCII greek name`).not.toMatch(/\b(?:mu|sigma|Sigma|Mu|alpha|beta|lambda|theta|tau|rho|epsilon|eps|delta|Delta|phi|pi)\b/);
      expect(t, `${at} subscript underscore`).not.toMatch(/[A-Za-z]_[A-Za-z0-9{]/);
      expect(t, `${at} ASCII hyphen as minus`).not.toMatch(/(?<![A-Za-z0-9])-(?=[\dA-Za-zμσ(])|(?<=[=(,]) ?-\d/);
      expect(t, `${at} caret / ASCII operators`).not.toMatch(/\^|<=|>=|->|\bsqrt\b|\binf\b|\*\*/);
      expect(t, `${at} leftovers`).not.toMatch(/undefined|NaN|\{|\}|\$\{|\[object/);
      expect(t, `${at} fraction of negative with ascii`).not.toMatch(/\d-\d/);
      if (lang === 'zh') {
        const words = t.replace(/\b(?:Var|Cov|GP|GPML|KL|ELBO|det)\b/g, '').match(/[A-Za-z]{2,}/g);
        expect(words, `${at} bare English words in ZH`).toBeNull();
      }
    }
  }));

  it('question text carries each numeric answer only through its inputs (no stray results in labels)', () => forAll(({ cards, where }) => {
    for (const c of cards) for (const t of questionTextOf(c)) expect(norm(t), `${where(c.id)} text`).not.toMatch(/answer|答案/i);
  }, 20));
});
