import { describe, expect, it } from 'vitest';
import { gp23 } from './games/gp23';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';

type Lang = 'en' | 'zh';
const SEEDS = 60;
const LANGS: Lang[] = ['en', 'zh'];
const gen = gp23 as (seed: number, lang: Lang) => PracticeCard[];
const ID = 'GP-23';
const SLUGS = ['reproduce', 'norm-sq', 'norm-values', 'not-a-norm', 'ridge-alpha', 'fit-residual', 'lambda-noise', 'sample-outside', 'challenge'];
const KINDS = ['reproduce', 'norm-sq', 'norm-values', 'ridge-alpha', 'fit-residual', 'challenge'].map(k => `${ID}:${k}`);

// ---------- helpers (independent of the generator) ----------
const norm = (t: string) => t.replace(/[   ]/g, ' ');
const N = (s: string) => Number(s.replaceAll('−', '-'));
const gcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) : gcd(y, x % y));
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const sq = (x: number) => x * x;

type V2 = [number, number];
type M2 = [[number, number], [number, number]];
const mulMV = (K: M2, v: V2): V2 => [K[0][0] * v[0] + K[0][1] * v[1], K[1][0] * v[0] + K[1][1] * v[1]];
const dot = (x: V2, y: V2) => x[0] * y[0] + x[1] * y[1];
/** explicit adjugate inverse */
function inv2(K: M2): M2 {
  const det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
  return [[K[1][1] / det, -K[0][1] / det], [-K[1][0] / det, K[0][0] / det]];
}
/** Cholesky solve of a 2x2 SPD system, independent of the adjugate route */
function cholSolve(K: M2, y: V2): V2 {
  const l11 = Math.sqrt(K[0][0]), l21 = K[1][0] / l11, l22 = Math.sqrt(K[1][1] - l21 * l21);
  const z1 = y[0] / l11, z2 = (y[1] - l21 * z1) / l22;
  const x2 = z2 / l22, x1 = (z1 - l21 * x2) / l11;
  return [x1, x2];
}
/** minimiser of J(alpha) = alpha^T (K^2 + cK) alpha - 2 y^T K alpha by gradient descent (independent of any inverse) */
function minimiseJ(K: M2, c: number, y: V2): V2 {
  const A: M2 = [[0, 0], [0, 0]];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) A[i][j] = K[i][0] * K[0][j] + K[i][1] * K[1][j] + c * K[i][j];
  const Ky = mulMV(K, y);
  const L = 2 * (A[0][0] + A[1][1]) + 1;
  let al: V2 = [0, 0];
  for (let it = 0; it < 60000; it++) {
    const Aa = mulMV(A, al);
    al = [al[0] - (2 * Aa[0] - 2 * Ky[0]) / L, al[1] - (2 * Aa[1] - 2 * Ky[1]) / L];
  }
  return al;
}
const sym = (a: number, b: number): M2 => [[a, b], [b, a]];

function matrixOf(text: string, name: string): M2 {
  const m = norm(text).match(new RegExp(`${name} = \\[\\[(−?\\d+), (−?\\d+)\\], \\[(−?\\d+), (−?\\d+)\\]\\]`));
  if (!m) throw new Error(`no matrix ${name} in: ${text.slice(0, 200)}`);
  return [[N(m[1]), N(m[2])], [N(m[3]), N(m[4])]];
}
function parseCoef(raw: string): number {
  let s = raw.replaceAll(' ', '').replace(/·$/, '');
  let sign = 1;
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('−') || s.startsWith('-')) { sign = -1; s = s.slice(1); }
  if (s === '') return sign;
  const m = s.match(/^\((−?\d+)\)$|^(\d+)$/);
  if (!m) throw new Error(`bad coefficient "${raw}"`);
  return sign * N(m[1] ?? m[2]);
}
function fCoefs(prompt: string): V2 {
  const m = norm(prompt).match(/f = ([^k]*?)k\(x₁, ·\)\s*([^k]*?)k\(x₂, ·\)/);
  if (!m) throw new Error('no f = in prompt');
  return [parseCoef(m[1]), parseCoef(m[2])];
}
const grab = (text: string, re: RegExp): number[] => {
  const m = norm(text).match(re);
  if (!m) throw new Error(`pattern ${re} not found in: ${text.slice(0, 200)}`);
  return m.slice(1).map(N);
};
const printedY = (prompt: string): V2 => grab(prompt, /y = \((−?\d+), (−?\d+)\)/) as V2;
const printedLambda = (prompt: string) => grab(prompt, /λ = (\d+)/)[0];
const printedAlpha = (prompt: string): V2 => grab(prompt, /α̂ = \((−?\d+), (−?\d+)\)/) as V2;

function cardsOf(seed: number, lang: Lang) {
  const cards = gen(seed, lang);
  const by: Record<string, PracticeCard> = {};
  for (const c of cards) by[c.id.replace(`${ID}-`, '')] = c;
  return { cards, by };
}
const allSeeds = () => range(0, SEEDS - 1).map(spreadSeed);

// ---------- sampling spaces, enumerated from the plan ----------
const POS = [-2, -1, 1, 2, 3];
const SIX = [-3, -2, -1, 1, 2, 3];
const nonzero = (lo: number, hi: number) => range(lo, hi).filter(x => x !== 0);

type Tuple = number[];
const key = (t: Tuple) => t.join(',');
const minGap = (T: number, routes: number[]) => Math.min(...routes.map(r => Math.abs(r - T))) + 1e-9;

function space1(): Map<string, Tuple> {
  const out = new Map<string, Tuple>();
  for (const a of range(1, 4)) for (const c of range(1, 4)) { if (a === c) continue;
    for (const b of nonzero(-3, 3)) { if (!(b * b < a * c)) continue;
      for (const p of POS) for (const q of POS) {
        const T = p * b + q * c; if (T === 0) continue;
        const routes = [p * a + q * b, p + q, p * b + q * b, p * a + q * c, p * b - q * c, p * c + q * b];
        if (minGap(T, routes) < 1) continue;
        out.set(key([a, b, c, p, q]), [a, b, c, p, q]);
      } } }
  return out;
}
function space2(): Map<string, Tuple> {
  const out = new Map<string, Tuple>();
  for (const a of range(2, 5)) for (const b of nonzero(-(a - 1), a - 1)) for (const p of SIX) for (const q of SIX) {
    const T = a * (p * p + q * q) + 2 * b * p * q;
    const routes = [p * p + q * q, a * (p * p + q * q), a * (p * p + q * q) - 2 * b * p * q, b * (p * p + q * q) + 2 * a * p * q, a * (p + q) ** 2];
    if (minGap(T, routes) < 1) continue;
    out.set(key([a, b, p, q]), [a, b, p, q]);
  }
  return out;
}
function space3(): Map<string, Tuple> {
  const out = new Map<string, Tuple>();
  for (const a of range(2, 5)) for (const b of nonzero(-(a - 1), a - 1)) for (const p of SIX) for (const q of SIX) {
    const u = a * p + b * q, v = b * p + a * q;
    if (Math.abs(u) > 15 || Math.abs(v) > 15) continue;
    const T = a * (p * p + q * q) + 2 * b * p * q;
    const det = a * a - b * b;
    const routes = [u * u + v * v, (u * u + v * v) / a, (a * (u * u + v * v) + 2 * b * u * v) / det, (u * u + v * v) / det, u * (a * u + b * v) + v * (b * u + a * v)];
    if (minGap(T, routes) < 0.1) continue;
    out.set(key([a, b, u, v]), [a, b, u, v]);
  }
  return out;
}
function reduceDen(n: number, d: number) { const g = gcd(n, d); return Math.abs(d / g); }
function space5(): Map<string, Tuple> {
  const out = new Map<string, Tuple>();
  for (const a of range(2, 4)) for (const b of nonzero(-(a - 1), a - 1)) for (const c of range(1, 3)) for (const u of range(-4, 6)) for (const v of range(-4, 6)) {
    if (u === 0 && v === 0) continue;
    const s = a + c, d = s * s - b * b;
    const num = s * u - b * v;
    if (num === 0) continue;
    if (![1, 2, 4, 5, 10].includes(reduceDen(num, d))) continue;
    const T = num / d;
    const routes = [(a * u - b * v) / (a * a - b * b), (s * u + b * v) / d, (s * v - b * u) / d, u / s, s * u / d];
    if (minGap(T, routes) < 0.1) continue;
    out.set(key([a, b, c, u, v]), [a, b, c, u, v]);
  }
  return out;
}
function space6(): Map<string, Tuple> {
  const out = new Map<string, Tuple>();
  for (const a of range(2, 5)) for (const b of nonzero(-(a - 1), a - 1)) for (const c of range(1, 4)) for (const p of SIX) for (const q of SIX) {
    if (p === q) continue;
    const y1 = (a + c) * p + b * q;
    const T = c * p;
    const routes = [y1 - a * p, c * q, y1 - (a * q + b * p), y1, y1 - b * q, c * p + c * q];
    if (minGap(T, routes) < 1) continue;
    out.set(key([a, b, c, p, q]), [a, b, c, p, q]);
  }
  return out;
}
function space9(): Map<string, Tuple> {
  const out = new Map<string, Tuple>();
  for (const a of range(2, 4)) for (const b of nonzero(-(a - 1), a - 1)) for (const c of range(1, 3)) for (const p of POS) for (const q of POS) {
    const y1 = (a + c) * p + b * q, y2 = b * p + (a + c) * q;
    if (Math.abs(y1) > 12 || Math.abs(y2) > 12) continue;
    const T = a * (p * p + q * q) + 2 * b * p * q;
    const det = a * a - b * b;
    const Ka = [a * p + b * q, b * p + a * q];
    const routes = [p * p + q * q, y1 * y1 + y2 * y2, p * y1 + q * y2, (a * (y1 * y1 + y2 * y2) - 2 * b * y1 * y2) / det, Ka[0] * Ka[0] + Ka[1] * Ka[1], Math.sqrt(T)];
    if (minGap(T, routes) < 0.1) continue;
    out.set(key([a, b, c, y1, y2]), [a, b, c, y1, y2]);
  }
  return out;
}
const PLAN_COUNTS: Record<string, number> = { reproduce: 498, 'norm-sq': 576, 'norm-values': 476, 'ridge-alpha': 358, 'fit-residual': 2336, challenge: 446 };
const SPACES: Record<string, { build: () => Map<string, Tuple>; names: string[] }> = {
  reproduce: { build: space1, names: ['a', 'b', 'c', 'p', 'q'] },
  'norm-sq': { build: space2, names: ['a', 'b', 'p', 'q'] },
  'norm-values': { build: space3, names: ['a', 'b', 'u', 'v'] },
  'ridge-alpha': { build: space5, names: ['a', 'b', 'c', 'u', 'v'] },
  'fit-residual': { build: space6, names: ['a', 'b', 'c', 'p', 'q'] },
  challenge: { build: space9, names: ['a', 'b', 'c', 'y1', 'y2'] },
};

// ---------- text lints ----------
const ALLOWED_LATIN = /^(exp|ln|log|GP|KL|ELBO)$/;
function stripRefs(t: string) { return t.replace(/§\s?\d+(\.\d+)?|eq\. \d+(\.\d+)?|式 \(\d+(\.\d+)?\)|第 \d+\.\d+ 节|\(\d+\.\d+\)/g, ''); }
function lintProblems(text: string, lang: Lang, isPrompt = false): string[] {
  const out: string[] = [];
  const t = norm(text);
  if (/\^/.test(t)) out.push('caret');
  if (/(?<![A-Za-z0-9])-(?=\d)|[(,=+*·] ?-\d/.test(t)) out.push('ASCII hyphen minus');
  if (/\(\(/.test(t)) out.push('double parentheses');
  if (/\d\.\d{3,}/.test(t)) out.push('raw float');
  if (/undefined|NaN|Infinity|\[object|TODO|FIXME|\$\{|[{}]|\bparams?\b|=>|\bnull\b/.test(t)) out.push('developer marker');
  if (/(?<![\w.−·+*/(-])(\d+) = \1(?![\w(.\d·+*/−-])/.test(t)) out.push('x = x restatement');
  if (isPrompt && /(?<![\d.,A-Za-z^_{/])1·(?=[k⟨])|(?<![\d.])−1·(?=[k⟨])|\(−1\)·(?=[k⟨])/.test(t)) out.push('coefficient ±1 before k or ⟨ (term must drop it)');
  if (/\((\d+)\/(\d+)\)²/.test(t) === false && /(?<![(\d/])\d+\/\d+²/.test(t)) out.push('fraction squared without parentheses');
  for (const m of t.matchAll(/(?<![\d/·\w])(\d+)\/(\d+)(?![\d/\w(])/g)) if (gcd(Number(m[1]), Number(m[2])) > 1) out.push(`unreduced fraction ${m[0]}`);
  for (const sentence of stripRefs(t).split(/[。；]|\. (?=[A-ZΣ])/)) if (/\d\.\d/.test(sentence) && /(?<![\d/])\d+\/\d+(?![\d/])/.test(sentence)) out.push(`decimal and fraction in one sentence: ${sentence.slice(0, 60)}`);
  if (lang === 'zh') {
    for (const m of t.matchAll(/[A-Za-z]{2,}/g)) if (!ALLOWED_LATIN.test(m[0])) out.push(`Latin word in ZH: ${m[0]}`);
    if (/["“”']/.test(t.replace(/[′″]/g, ''))) out.push('ASCII or curly quote in ZH');
    if (/[一-鿿][,.;:?!]/.test(t) || /[,.;:?!][一-鿿]/.test(t)) out.push('ASCII punctuation next to Chinese');
    if (/[一-鿿],\s?[一-鿿]/.test(t)) out.push('ASCII comma in prose');
  } else if (/[㐀-鿿]/.test(t)) out.push('CJK in EN');
  return out;
}
const textsOf = (c: PracticeCard) => [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];

// ---------- plan strings ----------
const PLAN = {
  titles: {
    reproduce: ['Evaluating a function by an inner product', '用内积计算函数值'],
    'norm-sq': ['The squared norm of f', 'f 的范数平方'],
    'norm-values': ['The norm from function values', '由函数值求范数'],
    'not-a-norm': ['Can this be a kernel matrix?', '这能是核矩阵吗？'],
    'ridge-alpha': ['The ridge coefficients', '岭回归的系数'],
    'fit-residual': ['Does ridge regression interpolate?', '岭回归会插值吗？'],
    'lambda-noise': ['Ridge λ as a noise variance', '岭参数 λ 即噪声方差'],
    'sample-outside': ['Are GP samples in the RKHS?', '高斯过程的样本在再生核希尔伯特空间里吗？'],
    challenge: ['Challenge: the norm of the ridge solution', '挑战：岭回归解的范数'],
  } as Record<string, [string, string]>,
  labels: {
    reproduce: '⟨k(x₂, ·), f⟩_H', 'norm-sq': '‖f‖²_H', 'norm-values': '‖f‖²_H', 'ridge-alpha': 'α̂₁', 'fit-residual': 'y₁ − f̂(x₁)', challenge: '‖f̂‖²_H',
  } as Record<string, string>,
  hints: {
    reproduce: ['The inner product is linear, and ⟨k(x, ·), k(y, ·)⟩_H = k(x, y).', '内积是线性的，并且 ⟨k(x, ·), k(y, ·)⟩_H = k(x, y)。'],
    'norm-sq': ['Expand ⟨f, f⟩_H with ⟨k(xᵢ, ·), k(xⱼ, ·)⟩_H = k(xᵢ, xⱼ); there are four pairs (i, j).', '用 ⟨k(xᵢ, ·), k(xⱼ, ·)⟩_H = k(xᵢ, xⱼ) 展开 ⟨f, f⟩_H，共有四个 (i, j) 组合。'],
    'norm-values': ['The values satisfy f(xᵢ) = Σⱼ αⱼ k(xᵢ, xⱼ). Find α from them.', '这些值满足 f(xᵢ) = Σⱼ αⱼ k(xᵢ, xⱼ)。先由它们求出 α。'],
    'not-a-norm': ['Evaluate αᵀMα for each option and compare it with what a squared norm must satisfy.', '对每个选项计算 αᵀMα，并与范数平方必须满足的条件比较。'],
    'ridge-alpha': ['Write the objective as a function of α = (α₁, α₂) and set its derivative to zero.', '把目标函数写成 α = (α₁, α₂) 的函数，并令其导数为零。'],
    'fit-residual': ['f̂(x₁) is the inner product of k(x₁, ·) with f̂.', 'f̂(x₁) 就是 k(x₁, ·) 与 f̂ 的内积。'],
    'lambda-noise': ['Compare α̂ = (K + λI)⁻¹y with the posterior mean written with K + σ²I.', '把 α̂ = (K + λI)⁻¹y 与写成 K + σ²I 形式的后验均值作比较。'],
    'sample-outside': ['For one coefficient, fᵢ has variance λᵢ. What is the expected value of fᵢ²/λᵢ?', '对单个系数，fᵢ 的方差为 λᵢ。fᵢ²/λᵢ 的期望是多少？'],
    challenge: ['Two steps are needed: the coefficients first, then the norm.', '需要两步：先求系数，再求范数。'],
  } as Record<string, [string, string]>,
};
const NUMERIC = ['reproduce', 'norm-sq', 'norm-values', 'ridge-alpha', 'fit-residual', 'challenge'];
const CHOICE = ['not-a-norm', 'lambda-noise', 'sample-outside'];

// ---------- independent answer for each numeric audit kind ----------
function truth(kind: string, P: Record<string, number>): number {
  switch (kind) {
    case 'reproduce': { // f(x2) = sum_i alpha_i k(x_i, x2) = (alpha^T K)[1]
      const K: M2 = [[P.a, P.b], [P.b, P.c]];
      const row = mulMV(K, [P.p, P.q]); // K symmetric
      return row[1];
    }
    case 'norm-sq': { // alpha^T K alpha and the Cholesky route ||L^T alpha||^2
      const K = sym(P.a, P.b); const al: V2 = [P.p, P.q];
      const viaQuad = dot(al, mulMV(K, al));
      const l11 = Math.sqrt(K[0][0]), l21 = K[1][0] / l11, l22 = Math.sqrt(K[1][1] - l21 * l21);
      const w1 = l11 * al[0] + l21 * al[1], w2 = l22 * al[1];
      expect(Math.abs(viaQuad - (w1 * w1 + w2 * w2))).toBeLessThan(1e-9);
      return viaQuad;
    }
    case 'norm-values': { // f^T K^{-1} f via solve, and via eigen-decomposition (eigenvalues a+b, a-b)
      const K = sym(P.a, P.b); const f: V2 = [P.u, P.v];
      const viaInv = dot(f, mulMV(inv2(K), f));
      const e1 = P.a + P.b, e2 = P.a - P.b;
      const c1 = (f[0] + f[1]) / Math.SQRT2, c2 = (f[0] - f[1]) / Math.SQRT2;
      expect(Math.abs(viaInv - (c1 * c1 / e1 + c2 * c2 / e2))).toBeLessThan(1e-9);
      return viaInv;
    }
    case 'ridge-alpha': {
      const K = sym(P.a, P.b); const y: V2 = [P.u, P.v];
      const Kc: M2 = [[P.a + P.c, P.b], [P.b, P.a + P.c]];
      const viaInv = mulMV(inv2(Kc), y)[0];
      expect(Math.abs(viaInv - cholSolve(Kc, y)[0])).toBeLessThan(1e-9);
      expect(Math.abs(viaInv - minimiseJ(K, P.c, y)[0])).toBeLessThan(1e-5);
      return viaInv;
    }
    case 'fit-residual': { // y = (K + cI) alpha; residual = y1 - (K alpha)_1
      const K = sym(P.a, P.b); const al: V2 = [P.p, P.q];
      const y = mulMV([[P.a + P.c, P.b], [P.b, P.a + P.c]], al);
      expect(Math.abs(cholSolve([[P.a + P.c, P.b], [P.b, P.a + P.c]], y)[0] - al[0])).toBeLessThan(1e-9);
      return y[0] - mulMV(K, al)[0];
    }
    case 'challenge': {
      const K = sym(P.a, P.b); const y: V2 = [P.y1, P.y2];
      const Kc: M2 = [[P.a + P.c, P.b], [P.b, P.a + P.c]];
      const al = cholSolve(Kc, y);
      const viaQuad = dot(al, mulMV(K, al));
      const viaResidual = dot(al, [y[0] - P.c * al[0], y[1] - P.c * al[1]]);
      expect(Math.abs(viaQuad - viaResidual)).toBeLessThan(1e-9);
      const al2 = minimiseJ(K, P.c, y);
      expect(Math.abs(viaQuad - dot(al2, mulMV(K, al2)))).toBeLessThan(1e-4);
      return viaQuad;
    }
  }
  throw new Error(`unknown kind ${kind}`);
}
/** wrong routes of each kind, to be graded incorrect */
function wrongRoutes(kind: string, P: Record<string, number>): number[] {
  const { a, b, c, p, q, u, v, y1, y2 } = P;
  switch (kind) {
    case 'reproduce': return [p * a + q * b, p + q, p * b + q * b, p * a + q * c, p * b - q * c, p * c + q * b];
    case 'norm-sq': return [p * p + q * q, a * (p * p + q * q), a * (p * p + q * q) - 2 * b * p * q, b * (p * p + q * q) + 2 * a * p * q, a * (p + q) ** 2];
    case 'norm-values': return [u * u + v * v, (u * u + v * v) / a, (a * (u * u + v * v) + 2 * b * u * v) / (a * a - b * b), (u * u + v * v) / (a * a - b * b), u * (a * u + b * v) + v * (b * u + a * v)];
    case 'ridge-alpha': { const s = a + c, d = s * s - b * b; return [(a * u - b * v) / (a * a - b * b), (s * u + b * v) / d, (s * v - b * u) / d, u / s, s * u / d]; }
    case 'fit-residual': { const Y1 = (a + c) * p + b * q; return [Y1 - a * p, c * q, Y1 - (a * q + b * p), Y1, Y1 - b * q, c * p + c * q]; }
    case 'challenge': {
      const al = cholSolve([[a + c, b], [b, a + c]], [y1, y2]);
      const T = dot(al, mulMV(sym(a, b), al)); const Ka = mulMV(sym(a, b), al);
      return [al[0] ** 2 + al[1] ** 2, y1 * y1 + y2 * y2, al[0] * y1 + al[1] * y2, dot([y1, y2], mulMV(inv2(sym(a, b)), [y1, y2])), Ka[0] ** 2 + Ka[1] ** 2, Math.sqrt(T)];
    }
  }
  return [];
}

// ---------- tests ----------
describe(`${ID} structure`, () => {
  it('has the 9 planned cards in order, titles, labels, hints, modes, no figures', () => {
    for (const seed of allSeeds()) for (const [li, lang] of LANGS.entries()) {
      const { cards } = cardsOf(seed, lang);
      expect(cards.map(c => c.id)).toEqual(SLUGS.map(s => `${ID}-${s}`));
      for (const c of cards) {
        const slug = c.id.replace(`${ID}-`, '');
        expect(c.title, c.id).toBe(PLAN.titles[slug][li]);
        expect(c.hint, c.id).toBe(PLAN.hints[slug][li]);
        expect(c.figure, `${c.id} figure`).toBeUndefined();
        expect(c.choice?.figures, `${c.id} figures`).toBeUndefined();
        expect(c.slots, c.id).toBeUndefined();
        if (NUMERIC.includes(slug)) {
          expect(c.choice, c.id).toBeUndefined();
          expect(c.fields, c.id).toHaveLength(1);
          expect(c.fields![0].label, c.id).toBe(PLAN.labels[slug]);
          expect(c.fields![0].tolerance, `${c.id} tolerance`).toBe(0.006);
          expect(c.audit?.kind, c.id).toBe(`${ID}:${slug}`);
          expect(c.prompt.trim().endsWith(slug === 'ridge-alpha' ? (lang === 'en' ? 'Give an integer, a fraction or a decimal rounded to 2 places.' : '请填整数、分数，或保留 2 位小数的小数。') : (lang === 'en' ? 'Give an integer.' : '请填整数。')), `${c.id} ending`).toBe(true);
        } else {
          expect(c.fields, c.id).toBeUndefined();
          expect(c.choice!.options, c.id).toHaveLength(4);
          expect(c.audit, c.id).toBeUndefined();
        }
      }
    }
  });
  it('asks the slide objective in full on cards 5, 7, 9 and names the targets as columns', () => {
    for (const seed of allSeeds()) for (const lang of LANGS) {
      const { by } = cardsOf(seed, lang);
      for (const s of ['ridge-alpha', 'lambda-noise', 'challenge']) expect(norm(by[s].prompt), s).toContain('Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H');
    }
  });
});

describe(`${ID} numeric oracles over ${SEEDS} spread seeds, EN and ZH`, () => {
  for (const slug of NUMERIC) {
    it(`${slug}: answer = independent route, printed text = audit params, grading, wrong routes`, () => {
      let fired = 0;
      for (const seed of allSeeds()) for (const lang of LANGS) {
        const { by } = cardsOf(seed, lang);
        const card = by[slug];
        const P = card.audit!.params as Record<string, number>;
        const where = `${slug} seed ${seed} ${lang} ${JSON.stringify(P)}`;
        expect(Object.keys(P).sort(), where).toEqual([...SPACES[slug].names].sort());
        const expected = truth(slug, P);
        // answer + grading through gradeCard
        expect(Math.abs(card.fields![0].answer - expected), `${where}: card ${card.fields![0].answer} vs oracle ${expected}`).toBeLessThanOrEqual(1e-9);
        const accepted = slug === 'ridge-alpha' ? null : String(expected);
        if (accepted !== null) expect(gradeCard(card, [accepted.replace('-', '−')], null, []), where).toBe('correct');
        expect(gradeCard(card, [String(expected + 0.0065)], null, []), `${where} +tol`).toBe('incorrect');
        expect(gradeCard(card, [String(expected - 0.0065)], null, []), `${where} -tol`).toBe('incorrect');
        expect(gradeCard(card, [String(expected + 0.005)], null, []), `${where} within tol`).toBe('correct');
        for (const wrong of wrongRoutes(slug, P)) expect(gradeCard(card, [String(wrong)], null, []), `${where}: wrong route ${wrong} collides with the truth ${expected}`).toBe('incorrect');
        // printed text = audit params
        const prompt = norm(card.prompt);
        switch (slug) {
          case 'reproduce': {
            const [a, b, c] = [grab(prompt, /k\(x₁, x₁\) = (−?\d+)/)[0], grab(prompt, /k\(x₁, x₂\) = (−?\d+)/)[0], grab(prompt, /k\(x₂, x₂\) = (−?\d+)/)[0]];
            expect([a, b, c], where).toEqual([P.a, P.b, P.c]);
            expect(fCoefs(prompt), where).toEqual([P.p, P.q]);
            expect(P.b * P.b < P.a * P.c && P.a !== P.c, `${where} K strictly PD`).toBe(true);
            break;
          }
          case 'norm-sq': {
            const K = matrixOf(prompt, 'K');
            expect(K, where).toEqual(sym(P.a, P.b));
            expect(grab(prompt, /k\(x₁, x₁\) = k\(x₂, x₂\) = (−?\d+)/)[0], where).toBe(P.a);
            expect(grab(prompt, /k\(x₁, x₂\) = (−?\d+)/)[0], where).toBe(P.b);
            expect(fCoefs(prompt), where).toEqual([P.p, P.q]);
            expect(P.a > Math.abs(P.b), `${where} PD`).toBe(true);
            break;
          }
          case 'norm-values': {
            expect(matrixOf(prompt, 'K'), where).toEqual(sym(P.a, P.b));
            expect([grab(prompt, /f\(x₁\) = (−?\d+)/)[0], grab(prompt, /f\(x₂\) = (−?\d+)/)[0]], where).toEqual([P.u, P.v]);
            expect(P.a > Math.abs(P.b), where).toBe(true);
            // hidden coefficients must be integers in the plan range
            const K = sym(P.a, P.b); const al = mulMV(inv2(K), [P.u, P.v]);
            for (const x of al) { expect(Math.abs(x - Math.round(x)), `${where} alpha integer`).toBeLessThan(1e-9); expect(SIX.includes(Math.round(x)), `${where} alpha range`).toBe(true); }
            break;
          }
          case 'ridge-alpha': {
            expect(matrixOf(prompt, 'K'), where).toEqual(sym(P.a, P.b));
            expect(printedLambda(prompt), where).toBe(P.c);
            expect(printedY(prompt), where).toEqual([P.u, P.v]);
            const T = card.fields![0].answer;
            expect(Math.abs(T) > 0, where).toBe(true);
            // reduced denominator in {1,2,4,5,10}
            let den = 1; while (Math.abs(T * den - Math.round(T * den)) > 1e-9 && den < 1000) den++;
            expect([1, 2, 4, 5, 10], `${where} denominator ${den}`).toContain(den);
            // accepted strings: exact fraction, 2-decimal rounding, and the plain decimal
            const num = Math.round(T * den);
            for (const s of [den === 1 ? String(num) : `${num}/${den}`, T.toFixed(2), String(T)]) expect(gradeCard(card, [s.replace('-', '−')], null, []), `${where} accepts ${s}`).toBe('correct');
            break;
          }
          case 'fit-residual': {
            expect(matrixOf(prompt, 'K'), where).toEqual(sym(P.a, P.b));
            expect(printedLambda(prompt), where).toBe(P.c);
            expect(printedAlpha(prompt), where).toEqual([P.p, P.q]);
            // printed y = (K + cI) alpha
            expect(printedY(prompt), where).toEqual(mulMV([[P.a + P.c, P.b], [P.b, P.a + P.c]], [P.p, P.q]));
            expect(P.p !== P.q && P.a > Math.abs(P.b), where).toBe(true);
            break;
          }
          case 'challenge': {
            expect(matrixOf(prompt, 'K'), where).toEqual(sym(P.a, P.b));
            expect(printedLambda(prompt), where).toBe(P.c);
            expect(printedY(prompt), where).toEqual([P.y1, P.y2]);
            expect(Math.abs(P.y1) <= 12 && Math.abs(P.y2) <= 12, where).toBe(true);
            // hidden alpha integer in range
            const al = cholSolve([[P.a + P.c, P.b], [P.b, P.a + P.c]], [P.y1, P.y2]);
            for (const x of al) { expect(Math.abs(x - Math.round(x)), `${where} alpha integer`).toBeLessThan(1e-9); expect(POS.includes(Math.round(x)), `${where} alpha range`).toBe(true); }
            break;
          }
        }
        // explanation states the answer
        const T = card.fields![0].answer;
        const shown = slug === 'ridge-alpha' ? (Number.isInteger(T) ? String(T) : (() => { let d = 2; while (Math.abs(T * d - Math.round(T * d)) > 1e-9) d++; return `${Math.round(T * d)}/${d}`; })()) : String(T);
        expect(norm(card.explanation).replaceAll('−', '-'), `${where}: explanation lacks the answer ${shown}`).toContain(shown);
        fired++;
      }
      expect(fired).toBe(SEEDS * 2);
    });
  }
  it('every audit kind of the plan fires on every seed and no unknown kind appears', () => {
    for (const seed of allSeeds()) for (const lang of LANGS) {
      const kinds = cardsOf(seed, lang).cards.filter(c => c.audit).map(c => c.audit!.kind);
      expect(kinds.sort()).toEqual([...KINDS].sort());
    }
  });
});

describe(`${ID} choice cards`, () => {
  const lenOf = (c: PracticeCard) => c.choice!.options.map(o => [...o].length);
  const shorter = (c: PracticeCard, where: string) => {
    const L = lenOf(c); const ans = c.choice!.answer;
    expect(L[ans], `${where}: correct option not strictly shorter than the longest wrong one ${JSON.stringify(c.choice!.options)}`).toBeLessThan(Math.max(...L.filter((_, i) => i !== ans)));
  };
  it('not-a-norm: exactly one option has alpha^T M alpha < 0, printed values are right, answer index points to it', () => {
    const seen = new Set<number>(); const draws = new Set<string>();
    for (const seed of allSeeds()) for (const lang of LANGS) {
      const c = cardsOf(seed, lang).by['not-a-norm'];
      const M = matrixOf(c.prompt, 'M');
      const a = M[0][0]; const b = M[0][1];
      const where = `not-a-norm seed ${seed} ${lang} M=${JSON.stringify(M)}`;
      expect(M[1][0] === b && M[1][1] === a && a >= 1 && a <= 4 && b >= a + 1 && b <= a + 3, `${where} sampling space`).toBe(true);
      draws.add(`${a},${b}`);
      const verdicts = c.choice!.options.map(o => {
        const al = grab(o, /α = \((−?\d+), (−?\d+)\)/) as V2;
        const printed = grab(o, /αᵀMα = (−?\d+)/)[0];
        const real = dot(al, mulMV(M, al));
        expect(printed, `${where} printed value in "${o}"`).toBe(real);
        return real < 0;
      });
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[c.choice!.answer], where).toBe(true);
      expect(gradeCard(c, [], c.choice!.answer, [])).toBe('correct');
      shorter(c, where); seen.add(c.choice!.answer);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(draws.size).toBeGreaterThanOrEqual(8);
  });
  it('lambda-noise: the correct option states sigma^2 = c; four distinct values', () => {
    const seen = new Set<number>();
    for (const seed of allSeeds()) for (const lang of LANGS) {
      const c = cardsOf(seed, lang).by['lambda-noise'];
      const lam = printedLambda(c.prompt);
      const where = `lambda-noise seed ${seed} ${lang} c=${lam}`;
      expect([2, 3, 4, 5, 6, 10], where).toContain(lam);
      const values = c.choice!.options.map(o => { const m = norm(o).match(/σ² = (\d+)(?:\/(\d+))?/); if (!m) throw new Error(`no sigma in ${o}`); return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]); });
      expect(new Set(values).size, where).toBe(4);
      expect(values.filter(x => x === lam).length, where).toBe(1);
      expect(values[c.choice!.answer], where).toBe(lam);
      expect([lam * lam, 1 / lam, lam / 2].every(x => values.some(y => Math.abs(x - y) < 1e-12)), `${where} distractors`).toBe(true);
      shorter(c, where); seen.add(c.choice!.answer);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
  it('sample-outside: the correct option starts with N and says unbounded / not in H', () => {
    const seen = new Set<number>();
    for (const seed of allSeeds()) for (const lang of LANGS) {
      const c = cardsOf(seed, lang).by['sample-outside'];
      const n = grab(c.prompt, /N = (\d+)/)[0];
      const where = `sample-outside seed ${seed} ${lang} N=${n}`;
      expect([3, 4, 5, 6, 8, 10], where).toContain(n);
      const lead = c.choice!.options.map(o => { const m = norm(o).match(/^(\d+)(?:\/(\d+))?/); if (!m) throw new Error(`no lead in ${o}`); return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]); });
      expect(new Set(lead).size, where).toBe(4);
      expect(lead.filter(x => x === n).length, where).toBe(1);
      expect(lead[c.choice!.answer], where).toBe(n);
      expect([1, n * n, n / 2].every(x => lead.some(y => Math.abs(x - y) < 1e-12)), `${where} distractors`).toBe(true);
      const correct = norm(c.choice!.options[c.choice!.answer]);
      expect(lang === 'en' ? /not in H/.test(correct) && /without bound/.test(correct) : /不在 H 中/.test(correct) && /无限增大/.test(correct), where).toBe(true);
      shorter(c, where); seen.add(c.choice!.answer);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe(`${ID} variety and text quality`, () => {
  it('every card has at least 6 distinct prompts over 60 seeds', () => {
    for (const lang of LANGS) {
      const sets: Record<string, Set<string>> = {};
      for (const seed of allSeeds()) for (const c of cardsOf(seed, lang).cards) (sets[c.id] ??= new Set()).add(c.prompt);
      for (const [id, s] of Object.entries(sets)) expect(s.size, `${id} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('learner text passes the Unicode / ZH / style lints and EN vs ZH answers agree', () => {
    const hits = new Set<string>();
    for (const seed of allSeeds()) {
      const en = cardsOf(seed, 'en').cards, zh = cardsOf(seed, 'zh').cards;
      en.forEach((c, i) => {
        const z = zh[i];
        if (c.fields) { expect(z.fields![0].answer).toBe(c.fields[0].answer); expect(z.fields![0].tolerance).toBe(c.fields[0].tolerance); }
        if (c.choice) expect(z.choice!.answer).toBe(c.choice.answer);
        for (const t of textsOf(c)) for (const p of lintProblems(t, 'en', t === c.prompt)) hits.add(`${c.id} EN: ${p} :: ${t.slice(0, 80)}`);
        for (const t of textsOf(z)) for (const p of lintProblems(t, 'zh', t === z.prompt)) hits.add(`${c.id} ZH: ${p} :: ${t.slice(0, 80)}`);
        // explanation closes with the not-assessed sentence
        expect(c.explanation, c.id).toMatch(/does not assess/);
        expect(z.explanation, c.id).toMatch(/不考查/);
        // hints do not carry the numeric answer
        if (c.fields) expect(c.hint).not.toMatch(/\d/);
      });
    }
    expect([...hits].slice(0, 40)).toEqual([]);
  });
});

describe(`${ID} sampling spaces equal the plan`, () => {
  const TARGET = 40000;
  it('every card draws exactly the plan space (enumerated) — nothing outside, nothing missing', () => {
    const observed: Record<string, Set<string>> = {};
    for (let i = 0; i < TARGET; i++) {
      const { by } = cardsOf(spreadSeed(i), 'en');
      for (const slug of NUMERIC) {
        const P = by[slug].audit!.params as Record<string, number>;
        (observed[slug] ??= new Set()).add(key(SPACES[slug].names.map(n => P[n])));
      }
    }
    const report: string[] = [];
    for (const slug of NUMERIC) {
      const expected = SPACES[slug].build();
      const outside = [...observed[slug]].filter(k => !expected.has(k));
      const missing = [...expected.keys()].filter(k => !observed[slug].has(k));
      report.push(`${slug}: plan ${PLAN_COUNTS[slug]} enumerated ${expected.size} observed ${observed[slug].size} outside ${outside.length} missing ${missing.length}`);
      expect(expected.size, `${slug} enumerated vs plan count`).toBe(PLAN_COUNTS[slug]);
      expect(outside.slice(0, 5), `${slug} outside the plan space (${report[report.length - 1]})`).toEqual([]);
      expect(missing.slice(0, 5), `${slug} plan sets never drawn (${report[report.length - 1]})`).toEqual([]);
    }
    console.log(report.join('\n'));
  }, 300000);
  it('choice sampling spaces are exactly the plan lists', () => {
    const notNorm = new Set<string>(), lam = new Set<number>(), nn = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      const { by } = cardsOf(spreadSeed(i), 'en');
      const M = matrixOf(by['not-a-norm'].prompt, 'M'); notNorm.add(`${M[0][0]},${M[0][1]}`);
      lam.add(printedLambda(by['lambda-noise'].prompt)); nn.add(grab(by['sample-outside'].prompt, /N = (\d+)/)[0]);
    }
    const expectNN = new Set<string>(); for (const a of range(1, 4)) for (const d of [1, 2, 3]) expectNN.add(`${a},${a + d}`);
    expect([...notNorm].sort()).toEqual([...expectNN].sort());
    expect([...lam].sort((x, y) => x - y)).toEqual([2, 3, 4, 5, 6, 10]);
    expect([...nn].sort((x, y) => x - y)).toEqual([3, 4, 5, 6, 8, 10]);
  });
});
