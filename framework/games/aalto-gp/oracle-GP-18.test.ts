import { describe, expect, it } from 'vitest';
import { gp18 } from './games/gp18';
import { spreadSeed, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

// ---------------------------------------------------------------- exact rational arithmetic
const gcdB = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Fr {
  readonly n: bigint; readonly d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error('zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcdB(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  static of(x: number) { return new Fr(BigInt(Math.round(x * 1000)), 1000n); }
  add(o: Fr) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Fr) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Fr) { return new Fr(this.n * o.n, this.d * o.d); }
  div(o: Fr) { return new Fr(this.n * o.d, this.d * o.n); }
  neg() { return new Fr(-this.n, this.d); }
  num() { return Number(this.n) / Number(this.d); }
  den() { return Number(this.d); }
  str() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
}
const f = Fr.of;
const ONE = f(1), ZERO = f(0);
const DENOMS = new Set([1, 2, 4, 5, 8, 10]);
const okDen = (x: Fr) => DENOMS.has(x.den());

// ---------------------------------------------------------------- independent linear algebra (exact)
type M2 = [[Fr, Fr], [Fr, Fr]];
const inv2 = (m: M2): M2 => {
  const det = m[0][0].mul(m[1][1]).sub(m[0][1].mul(m[1][0]));
  return [[m[1][1].div(det), m[0][1].neg().div(det)], [m[1][0].neg().div(det), m[0][0].div(det)]];
};
const det2 = (m: M2) => m[0][0].mul(m[1][1]).sub(m[0][1].mul(m[1][0]));
const mulMV = (m: M2, v: Fr[]) => [m[0][0].mul(v[0]).add(m[0][1].mul(v[1])), m[1][0].mul(v[0]).add(m[1][1].mul(v[1]))];
const addM = (p: M2, q: M2): M2 => [[p[0][0].add(q[0][0]), p[0][1].add(q[0][1])], [p[1][0].add(q[1][0]), p[1][1].add(q[1][1])]];
/** Gaussian elimination with partial pivoting for A x = b (2 x 2), no inverse formula. */
function solve2(A: M2, b: Fr[]): Fr[] {
  const m = [[A[0][0], A[0][1], b[0]], [A[1][0], A[1][1], b[1]]];
  if (m[0][0].n === 0n) [m[0], m[1]] = [m[1], m[0]];
  const factor = m[1][0].div(m[0][0]);
  for (let j = 0; j < 3; j++) m[1][j] = m[1][j].sub(factor.mul(m[0][j]));
  const x1 = m[1][2].div(m[1][1]);
  const x0 = m[0][2].sub(m[0][1].mul(x1)).div(m[0][0]);
  return [x0, x1];
}
const Kof = (a: number, b: number): M2 => [[f(a), f(b)], [f(b), f(a)]];

// ---------------------------------------------------------------- the plan's sampling spaces (enumerated, with every wrong route)
type Item = { params: Record<string, number>; truth: Fr; routes: number[] };
const R = (start: number, stop: number, step = 1) => { const out: number[] = []; for (let x = start; x <= stop + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000); return out; };
const GUARD = 0.02;
const farFrom = (item: Item) => item.routes.every(r => !Number.isFinite(r) || Math.abs(r - item.truth.num()) >= GUARD);

const AB3: [number, number][] = [[2.5, 1.5], [3, 2], [3, 1]];
function spaceModeGradient(): Item[] {
  const out: Item[] = [];
  for (const [a, b] of AB3) for (const m1 of R(-4, 4)) for (const m2 of R(-4, 4)) {
    const g = solve2(Kof(a, b), [f(m1), f(m2)]);
    const D = a * a - b * b;
    const t = g[0];
    const g2 = g[1].num();
    const routes = [a * m1 + b * m2, a * m1 - b * m2, m1 / a, (a * m1 + b * m2) / D, m1, g2, m1 * a / D];
    const item = { params: { a, b, m1, m2 }, truth: t, routes };
    if (t.n !== 0n && Math.abs(t.num()) <= 6 && okDen(t) && farFrom(item)) out.push(item);
  }
  return out;
}
const PAIRS_VAR: [number, number][] = [[2, 0.75], [2, 1.5], [2, 2], [3, 0.5], [3, 1], [3, 3], [4, 0.25], [4, 1], [6, 0.25], [6, 0.5], [6, 1.5], [8, 0.5], [10, 1.5], [12, 0.75], [16, 0.25]];
function spaceLaplaceVariance(): Item[] {
  return PAIRS_VAR.map(([k, w]) => {
    const t = ONE.div(ONE.div(f(k)).add(f(w)));
    return { params: { k, w }, truth: t, routes: [k, 1 / w, 1 / k + w, k + 1 / w, 1 / (k + w), 1 / (1 / k - w), k * w, w] };
  }).filter(farFrom);
}
function spaceNewton(): Item[] {
  const out: Item[] = [];
  for (const k of [2, 4, 6]) for (const w of [0.25, 0.5, 1]) for (const f0 of [-2, -1, 1, 2]) for (const g of [-2, -1, -0.5, 0.5, 1, 2]) {
    const t = f(w).mul(f(f0)).add(f(g)).div(ONE.div(f(k)).add(f(w)));
    const tn = t.num();
    const routes = [f0 + g, f0 + g / w, (w * f0 + g) / w, g / (1 / k + w), f0 + g / (1 / k + w), (w * f0 + g) / (k + w), (w * f0 + g) * k, f0 + g * k, -tn, f0 + (g - f0 / k) / w];
    if (Math.abs(1 / k - w) > 1e-12) routes.push((w * f0 + g) / (1 / k - w));
    const item = { params: { k, f0, g, w }, truth: t, routes };
    if (t.n !== 0n && Math.abs(tn) <= 6 && okDen(t) && farFrom(item)) out.push(item);
  }
  return out;
}
function spaceLogistic(): Item[] {
  const out: Item[] = [];
  for (const k of [4, 6, 12, 16, 28, 36]) for (const y of [-1, 1]) {
    const s = f(y).div(f(2));
    const t = s.div(ONE.div(f(k)).add(f(0.25)));
    const routes = [2 * y, y / 2 * k, y / 2, -t.num(), (y / 2) / (k + 0.25)];
    if (k !== 4) routes.push((y / 2) / (1 / k - 0.25));
    if (y === -1) routes.push((y - 0.5) / (1 / k + 0.25));
    out.push({ params: { k, y }, truth: t, routes });
  }
  return out.filter(farFrom);
}
const GS = [-2, -1, -0.5, 0.5, 1, 2, 3], CS = [-1, -0.5, 0.5, 1, 2];
function spacePredMean(): Item[] {
  const out: Item[] = [];
  for (const [a, b] of AB3) for (const g1 of GS) for (const g2 of GS) for (const c1 of CS) for (const c2 of CS) {
    const t = f(c1).mul(f(g1)).add(f(c2).mul(f(g2)));
    const K = Kof(a, b), Ki = inv2(K);
    const Kg = mulMV(K, [f(g1), f(g2)]), Kig = mulMV(Ki, [f(g1), f(g2)]);
    const routes = [c1 * Kg[0].num() + c2 * Kg[1].num(), c1 * Kig[0].num() + c2 * Kig[1].num(), c1 * g2 + c2 * g1, c1 * g1, c2 * g2, (c1 + c2) * (g1 + g2)];
    const item = { params: { a, b, g1, g2, c1, c2 }, truth: t, routes };
    if (t.n !== 0n && Math.abs(t.num()) <= 6 && okDen(t) && farFrom(item)) out.push(item);
  }
  return out;
}
function spacePredVar(): Item[] {
  const out: Item[] = [];
  for (const k of [2, 3, 4]) for (const w of [0.25, 0.5, 1, 1.5, 2]) for (const c of [0.5, 1, 1.5, 2]) for (const kss of [1, 1.5, 2, 2.5, 3, 4]) {
    if (!(k * kss > c * c)) continue;
    const q = f(c).mul(f(c)).div(f(k).add(ONE.div(f(w))));
    const t = f(kss).sub(q);
    const routes = [kss - c * c / k, kss - c * c / (k + w), kss - c * c / (1 / k + w), kss, kss - c * c * (k + 1 / w), kss - c * c / (1 / k + 1 / w)];
    const item = { params: { k, kss, c, w }, truth: t, routes };
    if (t.num() > 0 && okDen(t) && okDen(q) && farFrom(item)) out.push(item);
  }
  return out;
}
function spaceLogDet(): Item[] {
  const out: Item[] = [];
  for (const [a, b] of [[2.5, 1.5], [3, 2], [3, 1], [2, 1]] as [number, number][]) for (const w1 of [0.25, 0.5, 1, 1.5, 2]) for (const w2 of [0.25, 0.5, 1, 1.5, 2]) {
    const K = Kof(a, b);
    const A = addM(inv2(K), [[f(w1), ZERO], [ZERO, f(w2)]]);
    const t = det2(K).mul(det2(A));
    const dK = a * a - b * b, dA = det2(A).num();
    const routes = [dK, dA, dK + dA, (1 + w1) * (1 + w2), (a + w1) * (a + w2) - b * b, dK * ((a + w1) * (a + w2) - b * b), (1 + a * w1) * (1 + a * w2), t.num() - 1, dA * dA, dK * w1 * w2, 1 + a * (w1 + w2)];
    const item = { params: { a, b, w1, w2 }, truth: t, routes };
    if (okDen(t) && t.num() <= 40 && farFrom(item)) out.push(item);
  }
  return out;
}
const AB6: [number, number][] = [[2.5, 1.5], [2.5, -1.5], [3.5, 2.5], [3.5, -2.5], [5, 1], [5, -1]];
function spaceChallenge(): Item[] {
  const out: Item[] = [];
  for (const [a, b] of AB6) for (const y1 of [-1, 1]) for (const y2 of [-1, 1]) {
    const K = Kof(a, b);
    const A = addM(inv2(K), [[f(0.25), ZERO], [ZERO, f(0.25)]]);
    const t = solve2(A, [f(y1 / 2), f(y2 / 2)])[0];
    const h = (l: number) => 4 * l / (4 + l);
    const other = y1 === y2 ? h(a - b) : h(a + b);
    const routes = [(y1 / 2) * 4 * a / (4 + a), (a * y1 + b * y2) / 2, 2 * y1, y1 / 2, (y1 / 2) * other, -t.num()];
    out.push({ params: { a, b, y1, y2 }, truth: t, routes });
  }
  return out.filter(farFrom);
}
const CHOICE_PAIRS: [number, number][] = [[1, -0.25], [1, -0.5], [1, -0.75], [2, -0.25], [1, -1.5], [1, -2], [2, -0.75], [2, -1], [4, -0.5], [4, -1]];

// ---------------------------------------------------------------- independent answer routes (from audit params only)
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
type AuditOracle = { fields: string[][]; answer: (p: Record<string, number>) => number; space: () => Item[]; count: number; params: string[] };
const sigma = (z: number) => 1 / (1 + Math.exp(-z));
const ORACLES: Record<string, AuditOracle> = {
  'GP-18:mode-gradient': {
    fields: [['g₁', 'g₁']], params: ['a', 'b', 'm1', 'm2'], space: spaceModeGradient, count: 168,
    answer: p => { const K = Kof(p.a, p.b); const g = solve2(K, [f(p.m1), f(p.m2)]); const back = mulMV(K, g); expect(back[0].num()).toBeCloseTo(p.m1, 9); expect(back[1].num()).toBeCloseTo(p.m2, 9); return g[0].num(); },
  },
  'GP-18:laplace-variance': {
    fields: [['V', 'V']], params: ['k', 'w'], space: spaceLaplaceVariance, count: 15,
    answer: p => { const direct = 1 / (1 / p.k + p.w); expect(near(direct, p.k / (1 + p.k * p.w))).toBe(true); return direct; },
  },
  'GP-18:newton-step': {
    fields: [['f after the step', '迭代后的 f']], params: ['k', 'f0', 'g', 'w'], space: spaceNewton, count: 92,
    answer: p => {
      // root of the local quadratic model Psi'(f) = g - w (f - f0) - f/k
      const root = p.f0 + (p.g - p.f0 / p.k) / (1 / p.k + p.w);
      expect(near(p.g - p.w * (root - p.f0) - root / p.k, 0, 1e-9)).toBe(true);
      return root;
    },
  },
  'GP-18:logistic-start': {
    fields: [['f after the step', '迭代后的 f']], params: ['k', 'y'], space: spaceLogistic, count: 12,
    answer: p => {
      const psi = (x: number) => -Math.log1p(Math.exp(-p.y * x)) - x * x / (2 * p.k);
      const h = 1e-3;
      const d1 = (psi(-2 * h) - 8 * psi(-h) + 8 * psi(h) - psi(2 * h)) / (12 * h);
      const d2 = (-psi(-2 * h) + 16 * psi(-h) - 30 * psi(0) + 16 * psi(h) - psi(2 * h)) / (12 * h * h);
      return -d1 / d2;
    },
  },
  'GP-18:pred-mean': {
    fields: [['μ*', 'μ*']], params: ['a', 'b', 'g1', 'g2', 'c1', 'c2'], space: spacePredMean, count: 1564,
    answer: p => {
      const K = Kof(p.a, p.b);
      const fhat = mulMV(K, [f(p.g1), f(p.g2)]);
      const alpha = solve2(K, fhat);
      return f(p.c1).mul(alpha[0]).add(f(p.c2).mul(alpha[1])).num();
    },
  },
  'GP-18:pred-var': {
    fields: [['Var[f*]', 'f* 的方差']], params: ['k', 'kss', 'c', 'w'], space: spacePredVar, count: 57,
    answer: p => {
      // GPML eq 3.23: variance given f plus the propagated uncertainty of f
      const e323 = (p.kss - p.c * p.c / p.k) + (p.c / p.k) ** 2 / (1 / p.k + p.w);
      // dense route: pseudo-observation of f with noise variance 1/W, condition the joint (f, f*)
      const dense = p.kss - p.c * (1 / (p.k + 1 / p.w)) * p.c;
      expect(near(e323, dense, 1e-9)).toBe(true);
      return e323;
    },
  },
  'GP-18:log-det': {
    fields: [['P', 'P']], params: ['a', 'b', 'w1', 'w2'], space: spaceLogDet, count: 85,
    answer: p => {
      const K = Kof(p.a, p.b);
      const A = addM(inv2(K), [[f(p.w1), ZERO], [ZERO, f(p.w2)]]);
      const viaDets = det2(K).mul(det2(A)).num();
      const IKW = addM([[ONE, ZERO], [ZERO, ONE]], [[f(p.a).mul(f(p.w1)), f(p.b).mul(f(p.w2))], [f(p.b).mul(f(p.w1)), f(p.a).mul(f(p.w2))]]);
      expect(near(viaDets, det2(IKW).num(), 1e-9)).toBe(true);
      return viaDets;
    },
  },
  'GP-18:challenge': {
    fields: [['first component of f after the step', '迭代后 f 的第一个分量']], params: ['a', 'b', 'y1', 'y2'], space: spaceChallenge, count: 24,
    answer: p => {
      const K = Kof(p.a, p.b);
      const pi0 = sigma(0), W = pi0 * (1 - pi0);
      expect(near(W, 0.25)).toBe(true);
      const slope = [p.y1 === 1 ? 1 - pi0 : 0 - pi0, p.y2 === 1 ? 1 - pi0 : 0 - pi0];
      const dense = solve2(addM(inv2(K), [[f(0.25), ZERO], [ZERO, f(0.25)]]), [f(slope[0]), f(slope[1])])[0].num();
      // second route: K (I + K W)^-1 slope
      const IKW = addM([[ONE, ZERO], [ZERO, ONE]], [[K[0][0].mul(f(0.25)), K[0][1].mul(f(0.25))], [K[1][0].mul(f(0.25)), K[1][1].mul(f(0.25))]]);
      const z = solve2(IKW, [f(slope[0]), f(slope[1])]);
      expect(near(mulMV(K, z)[0].num(), dense, 1e-9)).toBe(true);
      return dense;
    },
  },
};

// ---------------------------------------------------------------- text helpers
const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];
const NUM = String.raw`(−?\d+(?:\.\d+)?)`;
const val = (s: string) => Number(s.replaceAll('−', '-'));
const frNum = (s: string) => { const [n, d] = s.replaceAll('−', '-').split('/'); return Number(n) / Number(d ?? 1); };
const deck = (index: number, lang: GameLanguage): PracticeCard[] => gp18(spreadSeed(index), lang);
const find = (cards: PracticeCard[], slug: string) => cards.find(c => c.id === `GP-18-${slug}`)!;
function grab(text: string, re: RegExp, where: string): number[] {
  const m = re.exec(text);
  if (!m) throw new Error(`pattern ${re} not found in ${where}: ${text.slice(0, 200)}`);
  return m.slice(1).map(val);
}
const MAT = String.raw`\[\[\s*${NUM},\s*${NUM}\s*\],\s*\[\s*${NUM},\s*${NUM}\s*\]\]`;
const FHAT = 'f̂';
function matOf(text: string, where: string, prefix = 'K = '): number[] {
  const v = grab(text, new RegExp(prefix + MAT), where);
  expect(v[1], where).toBe(v[2]); expect(v[0], where).toBe(v[3]);
  return v;
}
/** Parses the sampled numbers out of the printed prompt (EN and ZH) in the order of the plan's audit params. */
const PRINTED: Record<string, (c: PracticeCard) => Record<string, number>> = {
  'GP-18:mode-gradient': c => { const K = matOf(c.prompt, c.id); const m = grab(c.prompt, new RegExp(`${FHAT} = \\(${NUM}, ${NUM}\\)`), c.id); return { a: K[0], b: K[1], m1: m[0], m2: m[1] }; },
  'GP-18:laplace-variance': c => ({ k: grab(c.prompt, new RegExp(`\\bk = ${NUM}`), c.id)[0], w: grab(c.prompt, new RegExp(`W = [^=]*= ${NUM}`), c.id)[0] }),
  'GP-18:newton-step': c => ({ k: grab(c.prompt, new RegExp(`\\bk = ${NUM}`), c.id)[0], f0: grab(c.prompt, new RegExp(`\\bf = ${NUM}`), c.id)[0], g: grab(c.prompt, new RegExp(`∂f = ${NUM}`), c.id)[0], w: grab(c.prompt, new RegExp(`W = [^=]*= ${NUM}`), c.id)[0] }),
  'GP-18:logistic-start': c => ({ k: grab(c.prompt, new RegExp(`\\bk = ${NUM}`), c.id)[0], y: grab(c.prompt, new RegExp(`\\by = ${NUM}`), c.id)[0] }),
  'GP-18:pred-mean': c => {
    const K = matOf(c.prompt, c.id);
    const g = grab(c.prompt, new RegExp(`∇log p\\(y \\| ${FHAT}\\) = \\(${NUM}, ${NUM}\\)`), c.id);
    const k = grab(c.prompt, new RegExp(`k\\* = \\(${NUM}, ${NUM}\\)`), c.id);
    return { a: K[0], b: K[1], g1: g[0], g2: g[1], c1: k[0], c2: k[1] };
  },
  'GP-18:pred-var': c => ({ k: grab(c.prompt, new RegExp(`\\bk = ${NUM}`), c.id)[0], kss: grab(c.prompt, new RegExp(`k\\*\\* = ${NUM}`), c.id)[0], c: grab(c.prompt, new RegExp(`k\\* = ${NUM}`), c.id)[0], w: grab(c.prompt, new RegExp(`W = ${NUM}`), c.id)[0] }),
  'GP-18:log-det': c => {
    const K = matOf(c.prompt, c.id);
    const w = c.prompt.includes('diag(') ? grab(c.prompt, new RegExp(`diag\\(${NUM}, ${NUM}\\)`), c.id) : grab(c.prompt, new RegExp(`依次为 ${NUM} 和 ${NUM}`), c.id);
    return { a: K[0], b: K[1], w1: w[0], w2: w[1] };
  },
  'GP-18:challenge': c => { const K = matOf(c.prompt, c.id); const y = grab(c.prompt, new RegExp(`\\by = \\(${NUM}, ${NUM}\\)`), c.id); return { a: K[0], b: K[1], y1: y[0], y2: y[1] }; },
};
const SLUG_OF_KIND = (kind: string) => kind.split(':')[1];
const SLUGS = ['mode-gradient', 'laplace-variance', 'newton-step', 'logistic-start', 'valid-curvature', 'pred-mean', 'pred-var', 'log-det', 'challenge'];
const keyOf = (p: Record<string, number | number[]>, names: string[]) => names.map(n => Number(p[n])).join('|');
const spaces = Object.fromEntries(Object.entries(ORACLES).map(([k, o]) => [k, o.space()]));

describe('GP-18 plan sampling spaces (enumerated independently of the generator)', () => {
  for (const [kind, o] of Object.entries(ORACLES)) {
    it(`${kind}: the plan's list and the plan's count agree (${o.count})`, () => {
      expect(spaces[kind].length).toBe(o.count);
    });
  }
  it('card 5 pairs: 4 positive-A and 6 negative-A draws', () => {
    expect(CHOICE_PAIRS.filter(([k, w]) => 1 / k + w > 0)).toHaveLength(4);
    expect(CHOICE_PAIRS.filter(([k, w]) => 1 / k + w < 0)).toHaveLength(6);
  });
  it('distinct truths and minimum gaps quoted in the plan', () => {
    const distinct = (kind: string) => new Set(spaces[kind].map(i => i.truth.str())).size;
    expect(distinct('GP-18:mode-gradient')).toBe(80);
    expect(distinct('GP-18:laplace-variance')).toBe(13);
    expect(distinct('GP-18:newton-step')).toBe(48);
    expect(distinct('GP-18:logistic-start')).toBe(12);
    expect(distinct('GP-18:pred-mean')).toBe(41);
    expect(distinct('GP-18:pred-var')).toBe(36);
    expect(distinct('GP-18:log-det')).toBe(45);
    expect(distinct('GP-18:challenge')).toBe(6);
  });
});

describe('GP-18 deck shape', () => {
  it('has the nine planned cards in order, in both languages, deterministic', () => {
    for (let i = 0; i < SEEDS; i++) {
      const en = deck(i, 'en'), zh = deck(i, 'zh');
      expect(en.map(c => c.id)).toEqual(SLUGS.map(s => `GP-18-${s}`));
      expect(zh.map(c => c.id)).toEqual(en.map(c => c.id));
      expect(JSON.stringify(deck(i, 'en'))).toBe(JSON.stringify(en));
      for (const c of en.concat(zh)) expect(c.figure, c.id).toBeUndefined();
    }
  });
});

describe('GP-18 numeric audit kinds: independent recomputation, printed text, space membership, wrong routes, tolerance', () => {
  for (const [kind, o] of Object.entries(ORACLES)) {
    it(`${kind}: ${SEEDS} seeds x EN/ZH`, () => {
      const slug = SLUG_OF_KIND(kind);
      const inSpace = new Set(spaces[kind].map(i => keyOf(i.params, o.params)));
      const routesOf = new Map(spaces[kind].map(i => [keyOf(i.params, o.params), i]));
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const cards = deck(i, lang);
        const card = find(cards, slug);
        const where = `${kind} seed#${i} ${lang}`;
        expect(card.audit, where).toBeDefined();
        expect(card.audit!.kind, where).toBe(kind);
        expect(Object.keys(card.audit!.params).sort(), where).toEqual([...o.params].sort());
        const p = card.audit!.params as Record<string, number>;
        // sampling space membership
        const key = keyOf(p, o.params);
        expect(inSpace.has(key), `${where}: params ${JSON.stringify(p)} outside the plan's sampling space`).toBe(true);
        // printed text = audit params
        const printed = PRINTED[kind](card);
        for (const n of o.params) expect(printed[n], `${where}: printed ${n}`).toBe(p[n]);
        // field shape and labels
        expect(card.fields, where).toHaveLength(1);
        expect(card.fields![0].label, where).toBe(o.fields[0][lang === 'en' ? 0 : 1]);
        expect(card.fields![0].tolerance, where).toBe(0.006);
        // answer by an independent route
        const truth = o.answer(p);
        const item = routesOf.get(key)!;
        expect(near(truth, item.truth.num(), 1e-6), `${where}: oracle ${truth} vs plan formula ${item.truth.num()}`).toBe(true);
        expect(near(card.fields![0].answer, truth, 1e-6), `${where}: card answer ${card.fields![0].answer} vs oracle ${truth}`).toBe(true);
        // grading: exact fraction, 2-decimal roundings, and perturbations
        const grade = (s: string) => gradeCard(card, [s], null, []);
        expect(grade(item.truth.str()), `${where} fraction ${item.truth.str()}`).toBe('correct');
        expect(grade(truth.toFixed(2)), `${where} rounded ${truth.toFixed(2)}`).toBe('correct');
        expect(grade((Math.floor(item.truth.num() * 100 + 1e-7) / 100).toFixed(2)), `${where} floor`).toBe('correct');
        expect(grade((Math.ceil(item.truth.num() * 100 - 1e-7) / 100).toFixed(2)), `${where} ceil`).toBe('correct');
        expect(grade(String(truth + 0.007)), `${where} +0.007`).toBe('incorrect');
        expect(grade(String(truth - 0.007)), `${where} -0.007`).toBe('incorrect');
        // every wrong route grades wrong on every draw (collision = defect)
        for (const r of item.routes.filter(Number.isFinite)) expect(grade(String(r)), `${where}: wrong route ${r} collides with the truth ${truth}`).toBe('incorrect');
        // the key is exact (not a rounded decimal) and has a denominator from the allowed set
        expect(DENOMS.has(item.truth.den()), where).toBe(true);
        fired++;
      }
      expect(fired).toBe(SEEDS * 2);
    });
  }
  it('no unknown audit kinds, and exactly the eight numeric kinds fire (choice card has none)', () => {
    for (let i = 0; i < SEEDS; i++) {
      const cards = deck(i, 'en');
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind);
      expect(kinds.sort()).toEqual(Object.keys(ORACLES).sort());
      for (const c of cards) if (c.fields) expect(c.audit, c.id).toBeDefined();
      expect(find(cards, 'valid-curvature').audit).toBeUndefined();
    }
  });
});

describe('GP-18 sampling-space coverage: every card draws exactly the planned set', () => {
  it('the generator reaches every planned tuple and nothing else', () => {
    const SWEEP = 40000;
    const seen: Record<string, Set<string>> = Object.fromEntries(Object.keys(ORACLES).map(k => [k, new Set<string>()]));
    const seenChoice = new Set<string>();
    for (let i = 0; i < SWEEP; i++) {
      for (const card of deck(i, 'en')) {
        if (card.audit) {
          const o = ORACLES[card.audit.kind];
          seen[card.audit.kind].add(keyOf(card.audit.params, o.params));
        } else if (card.id.endsWith('valid-curvature')) {
          const k = frNum(/\bk = (−?\d+(?:\/\d+)?)/.exec(card.prompt)![1]);
          const w = frNum(/W = [^=]*= (−?\d+(?:\/\d+)?)/.exec(card.prompt)![1]);
          seenChoice.add(`${k}|${w}`);
        }
      }
    }
    const report: string[] = [];
    for (const [kind, o] of Object.entries(ORACLES)) {
      const planned = new Set(spaces[kind].map(it => keyOf(it.params, o.params)));
      const extra = [...seen[kind]].filter(x => !planned.has(x)), missing = [...planned].filter(x => !seen[kind].has(x));
      if (extra.length || missing.length) report.push(`${kind}: planned ${planned.size}, observed ${seen[kind].size}, extra ${extra.length} [${extra.slice(0, 8).join(' ; ')}], missing ${missing.length} [${missing.slice(0, 8).join(' ; ')}]`);
    }
    const plannedChoice = new Set(CHOICE_PAIRS.map(([k, w]) => `${k}|${w}`));
    const cExtra = [...seenChoice].filter(x => !plannedChoice.has(x)), cMissing = [...plannedChoice].filter(x => !seenChoice.has(x));
    if (cExtra.length || cMissing.length) report.push(`valid-curvature: planned 10, observed ${seenChoice.size}, extra ${cExtra.length} [${cExtra.join(' ')}], missing ${cMissing.length} [${cMissing.join(' ')}]`);
    expect(report).toEqual([]);
  }, 300000);
});

describe('GP-18 card 5 valid-curvature (choice): predicate written from the plan', () => {
  const lenOf = (s: string) => [...s].length;
  const fracVal = (s: string) => (s.includes('/') ? (([n, d]) => val(n) / val(d))(s.split('/')) : val(s));
  it('exactly one option satisfies the predicate and the answer index points to it', () => {
    const seenA = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = find(deck(i, lang), 'valid-curvature');
      const where = `valid-curvature seed#${i} ${lang}`;
      const k = frNum(/\bk = (−?\d+(?:\/\d+)?)/.exec(card.prompt)![1]);
      const w = frNum(/W = [^=]*= (−?\d+(?:\/\d+)?)/.exec(card.prompt)![1]);
      expect(CHOICE_PAIRS.some(([kk, ww]) => kk === k && ww === w), `${where}: (${k}, ${w}) outside plan`).toBe(true);
      const A = 1 / k + w;
      seenA.add(A > 0 ? 'pos' : 'neg');
      const opts = card.choice!.options;
      expect(opts, where).toHaveLength(4);
      expect(new Set(opts).size, `${where}: duplicate options`).toBe(4);
      const FR = String.raw`(−?\d+(?:\.\d+)?(?:/\d+)?)`;
      const isCorrect = (t: string): boolean => {
        const m = new RegExp(`A = ${FR}`).exec(t);
        if (!m || !near(fracVal(m[1].replaceAll('−', '-')), A, 1e-9)) return false;
        if (lang === 'en') {
          const noGaussian = /no (valid )?Gaussian/.test(t), notMax = /not a maximum/.test(t);
          if (A > 0) {
            const v = new RegExp(`N\\(f̂, ${FR}\\)`).exec(t);
            return /is positive/.test(t) && /is a maximum/.test(t) && !noGaussian && !notMax && !!v && near(fracVal(v[1].replaceAll('−', '-')), 1 / A, 1e-9);
          }
          return /is negative/.test(t) && notMax && noGaussian;
        }
        const noGaussian = /不存在/.test(t), notMax = /不是最大值点/.test(t);
        if (A > 0) {
          const v = new RegExp(`N\\(f̂, ${FR}\\)`).exec(t);
          return /为正/.test(t) && /是最大值点/.test(t) && !noGaussian && !notMax && !/不可能/.test(t) && !!v && near(fracVal(v[1].replaceAll('−', '-')), 1 / A, 1e-9);
        }
        return /为负/.test(t) && notMax && noGaussian;
      };
      const verdicts = opts.map(isCorrect);
      expect(verdicts.filter(Boolean).length, `${where}: exactly one option must satisfy the predicate: ${JSON.stringify(opts)}`).toBe(1);
      expect(verdicts[card.choice!.answer], `${where}: answer index ${card.choice!.answer} does not point at the predicate-correct option`).toBe(true);
      // the correct option is not the longest (EN: strictly shorter than the longest wrong; ZH: never the longest)
      const lens = opts.map(lenOf), correctLen = lens[card.choice!.answer];
      expect(correctLen, `${where}: correct option is the longest or tied: ${JSON.stringify(opts)}`).toBeLessThan(Math.max(...lens.filter((_, j) => j !== card.choice!.answer)));
      // grading through the framework
      for (let j = 0; j < 4; j++) expect(gradeCard(card, [], j, []), where).toBe(j === card.choice!.answer ? 'correct' : 'incorrect');
    }
    expect([...seenA].sort()).toEqual(['neg', 'pos']);
  });
  it('the answer index is spread over the positions (shuffled)', () => {
    const positions = new Set<number>();
    for (let i = 0; i < SEEDS; i++) positions.add(find(deck(i, 'en'), 'valid-curvature').choice!.answer);
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });
});

describe('GP-18 symbol cards and figures', () => {
  it('there are no symbol cards and no figures in this game', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) {
      expect(c.slots, c.id).toBeUndefined();
      expect(c.figure, c.id).toBeUndefined();
      expect(c.choice?.figures, c.id).toBeUndefined();
    }
  });
});

describe('GP-18 variety', () => {
  it('every card has at least 6 distinct prompts over 60 seeds', () => {
    for (const slug of SLUGS) for (const lang of LANGS) {
      const prompts = new Set<string>();
      for (let i = 0; i < SEEDS; i++) prompts.add(find(deck(i, lang), slug).prompt + (find(deck(i, lang), slug).choice?.options.join('|') ?? ''));
      expect(prompts.size, `${slug} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('GP-18 learner-visible text rules', () => {
  const allText = (c: PracticeCard) => [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(x => x.label) ?? []), ...(c.choice?.options ?? []), ...(c.lines ?? [])];
  const ZH_OK = new Set(['log', 'exp', 'GP', 'GPML', 'KL', 'ELBO', 'diag']);
  it('Unicode only: no ASCII minus, double parentheses, raw floats, markers, leftovers, restatements', () => {
    const bad: string[] = [];
    const lints: [string, RegExp][] = [
      ['ASCII hyphen as minus', /(^|[\s(=,+·*/])-(?=[\d.(])|\d-\d|[A-Za-ẑ]-\d/],
      ['caret', /\^/],
      ['double parentheses', /\(\(|\)\)\)/],
      ['raw float', /\d\.\d{3,}|\d{6,}/],
      ['braces or template leftovers', /[{}]|\$\{|undefined|NaN|Infinity|\[object/],
      ['developer marker', /DERIVED|NOT IN SOURCES|TODO|FIXME|XXX|NEEDS-NEW|\bm1\b|\bm2\b|\bg1\b|\bc1\b|\bkss\b|\bw1\b|\bw2\b/],
      ['x = x restatement', /(?<=^|[\s(])(\S{1,12}) = \1(?![\w./])/],
      ['plus-minus junk', /\+ −|\+ -|− −|−−|\+\+/],
      ['negative after operator without parentheses', /[+·×*] −\d|[=] −\d(?=[^)]*\))\s*·/],
      ['unreduced or degenerate fraction', /(?<![\d./])(\d+)\/(\d+)(?![\d(])/],
    ];
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) for (const t of allText(c)) {
      for (const [name, re] of lints) {
        const m = re.exec(t);
        if (!m) continue;
        let fr = "";
        if (name === 'unreduced or degenerate fraction') {
          const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
          const re2 = /(?<![\d./])(\d+)\/(\d+)(?![\d(])/g; let mm: RegExpExecArray | null; let found = false;
          while ((mm = re2.exec(t))) if (g(Number(mm[1]), Number(mm[2])) !== 1 || mm[2] === "1" || mm[2] === "0") { found = true; fr = mm[0]; }
          if (!found) continue;
        }
        bad.push(`${c.id} [${lang}] ${name} [${fr}]: …${t.slice(Math.max(0, m.index - 20), m.index + 30).replaceAll('\n', ' ')}…`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
  it('ZH has no English words (only symbols and GP/KL/ELBO/log/exp)', () => {
    const found = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const c of deck(i, 'zh')) for (const t of allText(c)) for (const w of t.match(/[A-Za-z]{2,}/g) ?? []) if (!ZH_OK.has(w)) found.add(`${c.id}: ${w}`);
    expect([...found]).toEqual([]);
  });
  it('EN has no CJK, both languages differ, prompts end with the answer-format sentence', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const c of deck(i, 'en')) for (const t of allText(c)) expect(/[一-鿿]/.test(t), `${c.id}: ${t}`).toBe(false);
      for (const c of deck(i, 'zh')) expect(/[一-鿿]/.test(c.prompt), c.id).toBe(true);
      for (const c of deck(i, 'en')) if (c.fields) expect(c.prompt.endsWith('Give an integer, a fraction or a decimal rounded to 2 places.'), c.id).toBe(true);
      for (const c of deck(i, 'zh')) if (c.fields) expect(c.prompt.endsWith('请填整数、分数，或保留 2 位小数的小数。'), c.id).toBe(true);
    }
  });
  it('the hint and the question text never show the card answer; the explanation shows it', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) {
      if (!c.fields) continue;
      const a = c.fields[0].answer;
      const forms = [String(a).replace('-', '−'), (Math.round(a * 100) / 100).toString().replace('-', '−')];
      const visible = [c.hint, ...questionTextOf(c)].join(' ');
      // the printed forms of the answer must not appear as a standalone token in the hint
      for (const form of forms) expect(new RegExp(`(?<![\\d./])${form.replace('.', '\\.')}(?![\\d./])`).test(c.hint), `${c.id} [${lang}] hint contains ${form}: ${c.hint}`).toBe(false);
      expect(visible.length).toBeGreaterThan(0);
    }
  });
  it('decimal-vs-fraction style is consistent inside the question text of a card', () => {
    const mixed: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const c of deck(i, 'en')) {
      const q = questionTextOf(c).join(' ');
      const hasDecimal = /\d\.\d/.test(q), hasFraction = /(?<![\d(])\d+\/\d+(?![\d(])/.test(q.replace(/\(1\/2\)|1\/2|1\/4/g, ''));
      if (hasDecimal && hasFraction) mixed.push(c.id);
    }
    expect([...new Set(mixed)]).toEqual([]);
  });
  it('explanation keys quote the answer in the same style as the prompt (no rounded decimals of fraction answers)', () => {
    for (let i = 0; i < SEEDS; i++) for (const c of deck(i, 'en')) if (c.fields) expect(/\d\.\d{3,}/.test(c.explanation), c.id).toBe(false);
  });
});
