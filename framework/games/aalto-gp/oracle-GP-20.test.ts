import { describe, expect, it } from 'vitest';
import { gp20 } from './games/gp20';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const MANY = 6000;
type Params = Record<string, number | number[]>;
const norm = (t: string) => t.replaceAll('−', '-').replaceAll(' ', ' ');
const NUM = String.raw`\(?(-?\d+(?:\.\d+)?)\)?`;
const cardsOf = (seed: number, lang: GameLanguage) => gp20(seed, lang);
const byId = (cards: PracticeCard[], slug: string) => {
  const c = cards.find(card => card.id === `GP-20-${slug}`);
  if (!c) throw new Error(`missing card GP-20-${slug}`);
  return c;
};
const clean = (v: number) => Number(v.toFixed(9));
const key = (...v: number[]) => v.map(clean).join('|');
const grab = (text: string, re: RegExp, n: number): number[] => {
  const m = norm(text).match(re);
  if (!m) throw new Error(`no match ${re} in ${text.slice(0, 300)}`);
  return m.slice(1, n + 1).map(Number);
};
const DENOMS = [1, 2, 4, 5, 8, 10];
const denomOk = (t: number) => DENOMS.some(d => Math.abs(t * d - Math.round(t * d)) < 1e-9);
const EPS = 1e-9;

// ----------------------------------------------------------------- independent linear algebra
type M2 = [[number, number], [number, number]];
const inv2 = (m: M2): M2 => { const det = m[0][0] * m[1][1] - m[0][1] * m[1][0]; return [[m[1][1] / det, -m[0][1] / det], [-m[1][0] / det, m[0][0] / det]]; };
const mul2 = (a: M2, b: M2): M2 => [[0, 1].map(j => a[0][0] * b[0][j] + a[0][1] * b[1][j]) as [number, number], [0, 1].map(j => a[1][0] * b[0][j] + a[1][1] * b[1][j]) as [number, number]];
/** eigenvalues of a general real 2x2 with real spectrum, ascending */
const eig2 = (m: M2): [number, number] => {
  const tr = m[0][0] + m[1][1], det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  const disc = Math.sqrt(tr * tr / 4 - det);
  return [tr / 2 - disc, tr / 2 + disc];
};
const matVec = (m: number[][], v: number[]) => m.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const toeplitz3 = (b: number, c: number): number[][] => [[1, b, c], [b, 1, b], [c, b, 1]];
/** f(v) = 1/2 v^T C v - v^T y, minimised over v = t y by golden section search */
function lineMin(C: number[][], y: number[]): { t: number; f: number } {
  const f = (t: number) => { const v = y.map(x => t * x); return 0.5 * dot(v, matVec(C, v)) - dot(v, y); };
  let lo = -50, hi = 50;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo);
  for (let i = 0; i < 300; i++) {
    if (f(x1) < f(x2)) { hi = x2; } else { lo = x1; }
    x1 = hi - g * (hi - lo); x2 = lo + g * (hi - lo);
  }
  const t = (lo + hi) / 2;
  return { t, f: f(t) };
}
const det3 = (m: number[][]) =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

// ----------------------------------------------------------------- plan sampling spaces (independent enumeration)
const TOEP_SETS: [number, number, number][] = [[0.3, 0.2, 0.1], [0.4, 0.2, 0.1], [0.4, 0.3, 0.1], [0.5, 0.2, 0.1], [0.5, 0.3, 0.1], [0.5, 0.3, 0.2], [0.5, 0.4, 0.2], [0.6, 0.3, 0.1], [0.6, 0.4, 0.1], [0.6, 0.4, 0.2], [0.7, 0.4, 0.2], [0.7, 0.5, 0.3]];
const spaceToep = new Set(TOEP_SETS.map(s => key(...s)));
const toepRoutes = (b: number, c: number, d: number) => [1 + b + c + d, 1 + b + c, 1 + 2 * b + d, 2 * b + c, 1 + b + 2 * c];

const SEP_PQ = [0.25, 0.5, 0.6, 0.8, 0.9], SEP_V = [0.5, 2, 3, 4, 5];
const sepRoutes = (p: number, v: number, q: number) => [p * q, p * v, q * v, p + q + v, p * q / v, (p + q) * v];
const spaceSep = new Set<string>();
for (const p of SEP_PQ) for (const q of SEP_PQ) for (const v of SEP_V) {
  const T = p * v * q;
  if (Math.abs(T * 100 - Math.round(T * 100)) > 1e-9 || !denomOk(T)) continue;
  if (sepRoutes(p, v, q).some(w => Math.abs(w - T) < 0.1 - EPS)) continue;
  spaceSep.add(key(p, v, q));
}

const QS_Y: [number, number][] = [[1, 2], [2, 1], [1, -2], [2, -1]];
const qsQ = (a: number, b: number, c: number, y1: number, y2: number) => a * y1 * y1 + 2 * b * y1 * y2 + c * y2 * y2;
function qsRoutes(a: number, b: number, c: number, y1: number, y2: number): number[] {
  const det = a * c - b * b;
  const sol = [(c * y1 - b * y2) / det, (-b * y1 + a * y2) / det];
  const q = qsQ(a, b, c, y1, y2);
  return [5 / (a * y1 * y1 + c * y2 * y2), 5 / (a * y1 * y1 - 2 * b * y1 * y2 + c * y2 * y2), q / 5, 1 / a, 1 / c, sol[0], sol[1]];
}
const spaceQs = new Set<string>();
for (let a = 1; a <= 6; a++) for (let c = 1; c <= 6; c++) for (const b of [-4, -3, -2, -1, 1, 2, 3, 4]) {
  if (a * c - b * b <= 0) continue;
  for (const [y1, y2] of QS_Y) {
    const q = qsQ(a, b, c, y1, y2);
    if (![1, 2, 4, 5, 8, 10, 20].includes(q)) continue; // plan text omits q = 1, but its worked example (t = 5) and its count 52 need it
    const T = 5 / q;
    if (qsRoutes(a, b, c, y1, y2).some(w => Math.abs(w - T) < 0.125 - EPS)) continue;
    spaceQs.add(key(a, b, c, y1, y2));
  }
}

const condRoutes = (a: number, b: number, s: number) => [(a + b) / (a - b), (a + b) / (a - b) + s, (a + b + s) / (a - b), (a + b) / (a - b + s), (a + b + s) / s, (a + b) / s];
const spaceCond = new Set<string>();
for (let a = 2; a <= 7; a++) for (let b = 1; b <= a - 1; b++) for (const s of [0.5, 1, 2, 3, 4, 5]) {
  const T = (a + b + s) / (a - b + s);
  if (!denomOk(T)) continue;
  if (condRoutes(a, b, s).some(w => Math.abs(w - T) < 0.1 - EPS)) continue;
  spaceCond.add(key(a, b, s));
}

const spaceRescue = new Set<string>();
for (const a of [1, 2, 3, 4, 5]) for (const s of [0.5, 1, 2, 4]) if (2 * a / s !== 1) spaceRescue.add(key(a, s));

const preRoutes = (l1: number, l2: number, d1: number, d2: number) => [l1 / l2, Math.max(d1, d2) / Math.min(d1, d2), (l1 / l2) * (Math.max(d1, d2) / Math.min(d1, d2)), Math.max(l1 * d1, l2 * d2) / Math.min(l1 * d1, l2 * d2)];
const spacePre = new Set<string>();
for (let l1 = 1; l1 <= 6; l1++) for (let l2 = 1; l2 < l1; l2++) for (let d1 = 1; d1 <= 6; d1++) for (let d2 = 1; d2 <= 6; d2++) {
  if (d1 === d2) continue;
  const r1 = l1 / d1, r2 = l2 / d2, T = Math.max(r1, r2) / Math.min(r1, r2);
  if (Math.abs(T - 1) < EPS || T >= l1 / l2 - EPS || !denomOk(T)) continue;
  if (preRoutes(l1, l2, d1, d2).some(w => Math.abs(w - T) < 0.1 - EPS)) continue;
  spacePre.add(key(l1, l2, d1, d2));
}

const localRoutes = (N: number, M: number) => { const P = N / M; return [P ** 3, N ** 3, M * P ** 2, M * M * P ** 3, N ** 3 / M]; };
const spaceLocal = new Set<string>();
for (const M of [2, 3, 4, 5]) for (const P of [10, 20, 30]) spaceLocal.add(key(M * P, M));

function chRoutes(b: number, c: number, s: number, y: number[]): { T: number; routes: number[] } {
  const w = dot(y, y);
  const T = (bb: number, cc: number, ss: number) => { const C = toeplitz3(bb, cc).map((r, i) => r.map((x, j) => x + (i === j ? ss : 0))); const q = dot(y, matVec(C, y)); return -w * w / (2 * q); };
  const Tt = T(b, c, s);
  const q = dot(y, matVec(toeplitz3(b, c).map((r, i) => r.map((x, j) => x + (i === j ? s : 0))), y));
  const routes = [T(b, c, 0), T(b, b, s), -w / (2 * (1 + s)), -w / 2, -Tt, -w * w / q, w / q];
  return { T: Tt, routes };
}
const spaceCh = new Set<string>();
for (let ib = 1; ib <= 9; ib++) for (let ic = 1; ic < ib; ic++) {
  const b = ib / 10, c = ic / 10;
  // Sylvester: all leading principal minors of K - 0.05 I positive  <=>  smallest eigenvalue of K > 0.05
  const A = toeplitz3(b, c).map((r, i) => r.map((x, j) => x - (i === j ? 0.05 : 0)));
  if (!(A[0][0] > 0 && A[0][0] * A[1][1] - A[0][1] * A[1][0] > 0 && det3(A) > 0)) continue;
  for (const s of [0.5, 1, 2]) for (const y1 of [1, 2]) for (let y2 = -2; y2 <= 2; y2++) for (let y3 = -2; y3 <= 2; y3++) {
    const y = [y1, y2, y3];
    if (y.filter(v => v !== 0).length < 2 || dot(y, y) > 6) continue;
    const { T, routes } = chRoutes(b, c, s, y);
    if (!denomOk(T)) continue;
    if (routes.some(w => Math.abs(w - T) < 0.1 - EPS)) continue;
    spaceCh.add(key(b, c, s, y1, y2, y3));
  }
}

// ----------------------------------------------------------------- oracle per audit kind
type Oracle = { answer: (p: Params) => number; wrongs: (p: Params) => number[]; parse: (c: PracticeCard, lang: GameLanguage) => Params; space: (p: Params) => boolean; count: number; gap: number };
const P = (p: Params, k: string) => p[k] as number;
const mat2re = (name: string) => new RegExp(String.raw`${name} = \[\[${NUM}, ${NUM}\], \[${NUM}, ${NUM}\]\]`);
const oracles: Record<string, Oracle> = {
  'GP-20:toeplitz-row': {
    answer: p => { const k = [1, P(p, 'b'), P(p, 'c'), P(p, 'd')]; const T = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => k[Math.abs(i - j)])); return T[2].reduce((s, x) => s + x, 0); },
    wrongs: p => toepRoutes(P(p, 'b'), P(p, 'c'), P(p, 'd')),
    parse: c => { const [b, cc, d] = grab(c.prompt, new RegExp(String.raw`k\(1\) = ${NUM}[,，] ?k\(2\) = ${NUM}[,，] ?k\(3\) = ${NUM}`), 3); return { b, c: cc, d }; },
    space: p => spaceToep.has(key(P(p, 'b'), P(p, 'c'), P(p, 'd'))), count: 12, gap: 0.1,
  },
  'GP-20:separable': {
    answer: p => Math.exp(Math.log(P(p, 'p')) + Math.log(P(p, 'v')) + Math.log(P(p, 'q'))),
    wrongs: p => sepRoutes(P(p, 'p'), P(p, 'v'), P(p, 'q')),
    parse: c => {
      const [p] = grab(c.prompt, new RegExp(String.raw`k₁\(x₁, x₁′\) = ${NUM}`), 1);
      const [q] = grab(c.prompt, new RegExp(String.raw`k₃\(x₃, x₃′\) = ${NUM}`), 1);
      const [v] = grab(c.prompt, new RegExp(String.raw`k₂\(x₂, x₂\) = ${NUM}`), 1);
      return { p, v, q };
    },
    space: p => spaceSep.has(key(P(p, 'p'), P(p, 'v'), P(p, 'q'))), count: 55, gap: 0.1,
  },
  'GP-20:quad-step': {
    answer: p => {
      const C = [[P(p, 'a'), P(p, 'b')], [P(p, 'b'), P(p, 'c')]], y = [P(p, 'y1'), P(p, 'y2')];
      return lineMin(C, y).t;
    },
    wrongs: p => qsRoutes(P(p, 'a'), P(p, 'b'), P(p, 'c'), P(p, 'y1'), P(p, 'y2')),
    parse: c => {
      const [a, b, b2, cc] = grab(c.prompt, mat2re('C'), 4);
      expect(b2, 'symmetric matrix').toBe(b);
      const [y1, y2] = grab(c.prompt, new RegExp(String.raw`y = \(${NUM}, ${NUM}\)`), 2);
      return { a, b, c: cc, y1, y2 };
    },
    space: p => spaceQs.has(key(P(p, 'a'), P(p, 'b'), P(p, 'c'), P(p, 'y1'), P(p, 'y2'))), count: 52, gap: 0.125,
  },
  'GP-20:cond-noise': {
    answer: p => {
      const a = P(p, 'a'), b = P(p, 'b'), s = P(p, 's');
      const [lo, hi] = eig2([[a + s, b], [b, a + s]]);
      return hi / lo;
    },
    wrongs: p => condRoutes(P(p, 'a'), P(p, 'b'), P(p, 's')),
    parse: c => {
      const [a, b, b2, a2] = grab(c.prompt, mat2re('K'), 4);
      expect(b2).toBe(b); expect(a2).toBe(a);
      const [s] = grab(c.prompt, new RegExp(String.raw`σ² = ${NUM}`), 1);
      return { a, b, s };
    },
    space: p => spaceCond.has(key(P(p, 'a'), P(p, 'b'), P(p, 's'))), count: 62, gap: 0.1,
  },
  'GP-20:precond': {
    answer: p => {
      const Pinv = inv2([[P(p, 'd1'), 0], [0, P(p, 'd2')]]);
      const [lo, hi] = eig2(mul2(Pinv, [[P(p, 'l1'), 0], [0, P(p, 'l2')]]));
      return hi / lo;
    },
    wrongs: p => preRoutes(P(p, 'l1'), P(p, 'l2'), P(p, 'd1'), P(p, 'd2')),
    parse: c => {
      const [l1, z1, z2, l2] = grab(c.prompt, mat2re('C'), 4);
      const [d1, z3, z4, d2] = grab(c.prompt, mat2re('P'), 4);
      expect([z1, z2, z3, z4]).toEqual([0, 0, 0, 0]);
      return { l1, l2, d1, d2 };
    },
    space: p => spacePre.has(key(P(p, 'l1'), P(p, 'l2'), P(p, 'd1'), P(p, 'd2'))), count: 88, gap: 0.1,
  },
  'GP-20:local-cost': {
    answer: p => { const N = P(p, 'N'), M = P(p, 'M'); const sizes: number[] = []; for (let i = 0; i < M; i++) sizes.push(Math.floor(N / M) + (i < N % M ? 1 : 0)); return sizes.reduce((s, n) => s + n ** 3, 0); },
    wrongs: p => localRoutes(P(p, 'N'), P(p, 'M')),
    parse: c => { const [N, M] = grab(c.prompt, new RegExp(String.raw`N = ${NUM}.*?M = ${NUM}`), 2); return { N, M }; },
    space: p => spaceLocal.has(key(P(p, 'N'), P(p, 'M'))), count: 12, gap: 1000,
  },
  'GP-20:challenge': {
    answer: p => {
      const C = toeplitz3(P(p, 'b'), P(p, 'c')).map((r, i) => r.map((x, j) => x + (i === j ? P(p, 's') : 0)));
      return lineMin(C, [P(p, 'y1'), P(p, 'y2'), P(p, 'y3')]).f;
    },
    wrongs: p => chRoutes(P(p, 'b'), P(p, 'c'), P(p, 's'), [P(p, 'y1'), P(p, 'y2'), P(p, 'y3')]).routes,
    parse: c => {
      const [b, cc] = grab(c.prompt, new RegExp(String.raw`k\(0\) = 1[,，] ?k\(1\) = ${NUM}[,，] ?k\(2\) = ${NUM}`), 2);
      const [s] = grab(c.prompt, new RegExp(String.raw`σ² = ${NUM}`), 1);
      const [y1, y2, y3] = grab(c.prompt, new RegExp(String.raw`y = \(${NUM}, ${NUM}, ${NUM}\)`), 3);
      return { b, c: cc, s, y1, y2, y3 };
    },
    space: p => spaceCh.has(key(P(p, 'b'), P(p, 'c'), P(p, 's'), P(p, 'y1'), P(p, 'y2'), P(p, 'y3'))), count: 81, gap: 0.1,
  },
};
const SLUG_OF: Record<string, string> = {
  'GP-20:toeplitz-row': 'toeplitz-row', 'GP-20:separable': 'separable', 'GP-20:quad-step': 'quad-step', 'GP-20:cond-noise': 'cond-noise',
  'GP-20:precond': 'precond', 'GP-20:local-cost': 'local-cost', 'GP-20:challenge': 'challenge',
};
const SLUGS = ['toeplitz-row', 'toeplitz-check', 'separable', 'quad-step', 'cond-noise', 'noise-rescue', 'precond', 'local-cost', 'challenge'];

describe('GP-20 independent oracle', () => {
  it('has the nine planned cards in order, one field per numeric card with tolerance 0.006, no figures', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const cards = cardsOf(spreadSeed(i), lang);
      expect(cards.map(c => c.id)).toEqual(SLUGS.map(s => `GP-20-${s}`));
      for (const c of cards) {
        if (c.fields) { expect(c.fields).toHaveLength(1); expect(c.fields[0].tolerance, c.id).toBe(0.006); expect(c.audit?.kind, c.id).toBeDefined(); }
        else { expect(c.audit, c.id).toBeUndefined(); expect(c.choice, c.id).toBeDefined(); }
        expect(c.figure, c.id).toBeUndefined();
        expect(c.choice?.figures, c.id).toBeUndefined();
        expect(c.slots, c.id).toBeUndefined();
      }
    }
  });

  it('independent enumeration reproduces the plan counts 12/12/55/52/62/18/88/12/81', () => {
    expect([spaceToep.size, spaceSep.size, spaceQs.size, spaceCond.size, spaceRescue.size, spacePre.size, spaceLocal.size, spaceCh.size]).toEqual([12, 55, 52, 62, 18, 88, 12, 81]);
  });

  for (const [kind, o] of Object.entries(oracles)) {
    it(`${kind}: answer, grading, printed text = audit, wrong routes, sampling space`, () => {
      for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
        const cards = cardsOf(spreadSeed(i), lang);
        const card = byId(cards, SLUG_OF[kind]);
        const where = `${kind} seed ${spreadSeed(i)} ${lang}`;
        expect(card.audit!.kind, where).toBe(kind);
        const params = card.audit!.params;
        const printed = o.parse(card, lang);
        for (const [k, v] of Object.entries(printed)) expect(params[k] as number, `${where}: printed ${k}`).toBeCloseTo(v as number, 9);
        expect(Object.keys(params).sort(), where).toEqual(Object.keys(printed).sort());
        const expected = o.answer(printed);
        expect(Math.abs(expected - card.fields![0].answer), `${where}: expected ${expected} got ${card.fields![0].answer}`).toBeLessThan(1e-6);
        expect(gradeCard(card, [String(expected)], null, []), where).toBe('correct');
        expect(gradeCard(card, [String(Number(expected.toFixed(2)))], null, []), `${where} rounded to 2 places`).toBe('correct');
        const bigStep = kind === 'GP-20:local-cost' ? [1, -1, 100, -500] : [0.02, -0.02, 0.1, -0.5, 0.0075, -0.0075];
        for (const d of bigStep) expect(gradeCard(card, [String(expected + d)], null, []), `${where} perturbed ${d}`).toBe('incorrect');
        for (const w of o.wrongs(printed)) {
          expect(Math.abs(w - expected), `${where}: wrong route ${w} collides with truth ${expected}`).toBeGreaterThanOrEqual(o.gap - 1e-9);
          expect(gradeCard(card, [String(w)], null, []), `${where}: wrong route ${w}`).toBe('incorrect');
        }
        expect(o.space(printed), `${where}: ${JSON.stringify(printed)} outside the plan's list`).toBe(true);
      }
    });
    it(`${kind}: sampling space is exactly the plan's (${o.count}) in both languages`, () => {
      const seen = new Set<string>();
      for (let i = 0; i < MANY; i++) {
        const card = byId(cardsOf(spreadSeed(i), 'en'), SLUG_OF[kind]);
        const p = card.audit!.params as Params;
        expect(o.space(p), `${kind} ${JSON.stringify(p)}`).toBe(true);
        seen.add(JSON.stringify(Object.keys(p).sort().map(k => clean(p[k] as number))));
      }
      expect(seen.size).toBe(o.count);
      for (let i = 0; i < 300; i++) {
        const en = byId(cardsOf(spreadSeed(i), 'en'), SLUG_OF[kind]), zh = byId(cardsOf(spreadSeed(i), 'zh'), SLUG_OF[kind]);
        expect(zh.audit).toEqual(en.audit);
        expect(zh.fields![0].answer).toBe(en.fields![0].answer);
      }
    });
  }

  it('every audit kind fires on every seed and no unknown kinds appear', () => {
    for (let i = 0; i < SEEDS; i++) {
      const kinds = cardsOf(spreadSeed(i), 'en').filter(c => c.audit).map(c => c.audit!.kind).sort();
      expect(kinds).toEqual(Object.keys(oracles).sort());
    }
  });

  it('truth values are exact fractions with denominators in {1,2,4,5,8,10}', () => {
    for (let i = 0; i < SEEDS; i++) for (const c of cardsOf(spreadSeed(i), 'en')) if (c.fields) {
      expect(denomOk(c.fields[0].answer), `${c.id} answer ${c.fields[0].answer}`).toBe(true);
    }
  });

  // ------------------------------------------------------------- choice cards
  const parseFrac = (t: string) => (t.includes('/') ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : Number(t));
  it('toeplitz-check: exactly one option has equally spaced inputs AND a stationary kernel; answer index points to it', () => {
    const hs = new Set<number>();
    for (let i = 0; i < SEEDS * 3; i++) for (const lang of ['en', 'zh'] as const) {
      const card = byId(cardsOf(spreadSeed(i), lang), 'toeplitz-check');
      const where = `toeplitz-check seed ${spreadSeed(i)} ${lang}`;
      const t = norm(card.prompt);
      const l = Number(t.match(new RegExp(String.raw`ℓ = ${NUM}`))![1]);
      const h = Number(t.match(new RegExp(String.raw`h = ${NUM}`))![1]);
      expect([0.5, 1, 2, 3, 4, 5]).toContain(h); expect([1, 2]).toContain(l);
      hs.add(h);
      const opts = card.choice!.options.map(norm);
      const inputsOf = (o: string) => (o.match(/^(?:Inputs|输入) (.*?)[;；]/)![1]).split(/, ?|、/).map(Number);
      const kernelOf = (o: string) => o.split(/[;；] ?/)[1];
      const regular = (xs: number[]) => xs.every((x, k) => k === 0 || Math.abs(x - xs[k - 1] - (xs[1] - xs[0])) < 1e-9);
      // stationary: after removing exp and (x − x′) differences, no bare variable x is left
      const stationary = (kernel: string) => !/x/.test(kernel.replace(/exp/g, '').replaceAll('(x - x′)', '').replace(/k\(x, x′\)/, '').replace(/线性核|linear kernel/, ''));
      const good = opts.map(o => regular(inputsOf(o)) && stationary(kernelOf(o)));
      expect(good.filter(Boolean), where).toHaveLength(1);
      expect(card.choice!.answer, where).toBe(good.indexOf(true));
      const g1 = [1, 2, 3, 4].map(m => m * h), g2 = [1, 2, 4, 5].map(m => m * h);
      const inputs = opts.map(inputsOf);
      expect(inputs.filter(x => JSON.stringify(x) === JSON.stringify(g1)), where).toHaveLength(3);
      expect(inputs.filter(x => JSON.stringify(x) === JSON.stringify(g2)), where).toHaveLength(1);
      // independent check of the claim: K entries along the first super-diagonal agree
      const kfun = (o: string): ((a: number, b: number) => number) | null => {
        const k = kernelOf(o);
        if (/x·x′·exp/.test(k)) return (a, b) => a * b * Math.exp(-((a - b) ** 2) / (2 * l * l));
        if (/exp/.test(k)) return (a, b) => Math.exp(-((a - b) ** 2) / (2 * l * l));
        if (/x·x′/.test(k)) return (a, b) => a * b;
        return null;
      };
      opts.forEach((o, k) => {
        const xs = inputsOf(o), f = kfun(o)!;
        expect(f, `${where}: kernel recognised ${o}`).not.toBeNull();
        const d = [0, 1, 2].map(j => f(xs[j], xs[j + 1]));
        const toeplitz = Math.abs(d[0] - d[1]) < 1e-9 && Math.abs(d[1] - d[2]) < 1e-9;
        expect(toeplitz, `${where}: option ${k} ${o} numerically Toeplitz (first superdiagonal)`).toBe(k === card.choice!.answer);
      });
    }
    expect([...hs].sort((a, b) => a - b)).toEqual([0.5, 1, 2, 3, 4, 5]);
  });

  it('noise-rescue: the correct option states kappa(C) = (2a+s)/s with infinite kappa(K); no other option contains that value', () => {
    const seen = new Set<string>();
    for (let i = 0; i < SEEDS * 3; i++) for (const lang of ['en', 'zh'] as const) {
      const card = byId(cardsOf(spreadSeed(i), lang), 'noise-rescue');
      const where = `noise-rescue seed ${spreadSeed(i)} ${lang}`;
      const t = norm(card.prompt);
      const [a, b2, b3, a2] = grab(t, mat2re('K'), 4);
      expect([b2, b3, a2]).toEqual([a, a, a]);
      const [s] = grab(t, new RegExp(String.raw`σ² = ${NUM}`), 1);
      expect(spaceRescue.has(key(a, s)), where).toBe(true);
      seen.add(key(a, s));
      // independent: eigenvalues of K=[[a,a],[a,a]] by characteristic polynomial, then of C = K + sI
      const [lo, hi] = eig2([[a + s, a], [a, a + s]]);
      expect(lo).toBeCloseTo(s, 9); expect(hi).toBeCloseTo(2 * a + s, 9);
      const v = hi / lo, r = 2 * a / s;
      expect(Math.abs(v - r)).toBeGreaterThan(0.5);
      const opts = card.choice!.options.map(norm);
      const claimsC = (o: string) => { const m = o.match(/κ\(C\) = (\d+(?:\.\d+)?(?:\/\d+)?)/); return m ? parseFrac(m[1]) : null; };
      const claimsKInf = (o: string) => /infinite|无穷大/.test(o);
      const good = opts.map(o => claimsKInf(o) && claimsC(o) !== null && Math.abs(claimsC(o)! - v) < 1e-9);
      expect(good.filter(Boolean), where).toHaveLength(1);
      expect(card.choice!.answer, where).toBe(good.indexOf(true));
      // the other options claim 1 and r and infinity, and nothing else
      const others = opts.filter((_, k) => k !== card.choice!.answer);
      expect(others.map(claimsC).filter(x => x !== null).map(Number).sort((x, y) => x - y), where).toEqual([1, r].sort((x, y) => x - y));
      expect(others.filter(o => !claimsC(o)).every(o => /infinite|无穷大/.test(o)), where).toBe(true);
      // printed value uses the form of an exact fraction or integer in lowest terms
      const printed = opts[card.choice!.answer].match(/κ\(C\) = (\d+(?:\.\d+)?(?:\/\d+)?)/)![1];
      expect(Math.abs(parseFrac(printed) - v)).toBeLessThan(1e-9);
    }
    expect(seen.size).toBe(18);
  });

  it('every choice card: 4 options, correct option strictly shorter than the longest wrong option in EN and ZH', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) for (const c of cardsOf(spreadSeed(i), lang)) if (c.choice) {
      const lens = c.choice.options.map(o => o.length);
      const correct = lens[c.choice.answer];
      expect(correct, `${c.id} ${lang} seed ${spreadSeed(i)}`).toBeLessThan(Math.max(...lens.filter((_, k) => k !== c.choice!.answer)));
      expect(c.choice.options).toHaveLength(4);
    }
  });

  it('choice answers are consistent between EN and ZH and are shuffled', () => {
    const idx: Record<string, Set<number>> = {};
    for (let i = 0; i < 200; i++) {
      const en = cardsOf(spreadSeed(i), 'en'), zh = cardsOf(spreadSeed(i), 'zh');
      en.forEach((c, k) => { if (c.choice) { expect(zh[k].choice!.answer).toBe(c.choice.answer); (idx[c.id] ??= new Set()).add(c.choice.answer); } });
    }
    expect(Object.keys(idx).sort()).toEqual(['GP-20-noise-rescue', 'GP-20-toeplitz-check']);
    for (const s of Object.values(idx)) expect(s.size).toBe(4);
  });

  it('variety: at least 6 distinct prompts per card over 60 seeds', () => {
    for (const slug of SLUGS) {
      const seen = new Set<string>();
      for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
        const c = byId(cardsOf(spreadSeed(i), lang), slug);
        seen.add(lang + c.prompt + (c.choice?.options.join('|') ?? ''));
      }
      expect(seen.size / 2, slug).toBeGreaterThanOrEqual(6);
    }
  });

  // ------------------------------------------------------------- learner-visible text
  const TITLE_EN = ['Reading a Toeplitz matrix', 'When is K Toeplitz?', 'A separable kernel on a grid', 'The first conjugate gradient step', 'Noise and the condition number', 'Two identical inputs', 'Does the preconditioner help?', 'Splitting the data into local experts', 'Challenge: one CG step on a grid'];
  const TITLE_ZH = ['读懂托普利茨矩阵', 'K 何时是托普利茨矩阵？', '网格上的可分离核', '共轭梯度的第一步', '噪声与条件数', '两个相同的输入', '预条件子有帮助吗？', '把数据拆给局部专家', '挑战：网格上的一步共轭梯度'];
  const LABEL_EN: Record<string, string> = { 'toeplitz-row': 'Sum of the third row of K', separable: 'k(x, x′)', 'quad-step': 'Step length t', 'cond-noise': 'κ(C)', precond: 'κ(P⁻¹C)', 'local-cost': 'Total cost (units)', challenge: 'Smallest value of f on the line' };
  const LABEL_ZH: Record<string, string> = { 'toeplitz-row': 'K 的第三行之和', separable: 'k(x, x′)', 'quad-step': '步长 t', 'cond-noise': 'κ(C)', precond: 'κ(P⁻¹C)', 'local-cost': '总代价（单位）', challenge: '该直线上 f 的最小值' };
  const ALLOWED_LATIN_ZH = new Set(['exp', 'GP', 'KL', 'ELBO', 'diag', 'max', 'min']);
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  it('titles, labels, prompt endings and learner-visible text conventions', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const cards = cardsOf(spreadSeed(i), lang);
      cards.forEach((c, k) => {
        const where = `${c.id} ${lang} seed ${spreadSeed(i)}`;
        expect(c.title, where).toBe((lang === 'en' ? TITLE_EN : TITLE_ZH)[k]);
        const slug = c.id.slice(6);
        if (c.fields) {
          expect(c.fields[0].label, where).toBe((lang === 'en' ? LABEL_EN : LABEL_ZH)[slug]);
          const end = slug === 'local-cost' ? (lang === 'en' ? 'Give an integer.' : '请填整数。') : (lang === 'en' ? 'Give an integer, a fraction or a decimal rounded to 2 places.' : '请填整数、分数，或保留 2 位小数的小数。');
          expect(c.prompt.endsWith(end), `${where}: prompt ends with ${end}`).toBe(true);
        }
        const texts = [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];
        for (const t of texts) {
          expect(t, `${where}: ASCII hyphen as minus`).not.toMatch(/(^|[\s(,=≈:·])-\d/);
          expect(t, where + ' double parentheses').not.toMatch(/\(\(-?\d+(\.\d+)?\)|\(\(−\d|, \(−?\d+(\.\d+)?\)\)/);
          expect(t, where + ' raw float').not.toMatch(/\d\.\d{4,}/);
          expect(t, where + ' marker').not.toMatch(/undefined|NaN|\[object|Infinity|DERIVED|NOT IN SOURCES|TODO|\$\{|\{[A-Za-z0-9_ ]+\}|\bsigma\b|\blambda\b|\bkappa\b|\bsqrt\b|\^|\\n|_\w|[a-z]\d\b(?=[ ,.)])/);
          expect(t, where + ' unicode minus + hyphen mix').not.toMatch(/[+−]\s*[-−]\s*\d/);
          expect(t, where + ' ASCII quote in ZH').not.toMatch(lang === 'zh' ? /["']/ : /$^/);
          expect(t, where + ' 1· coefficient').not.toMatch(/(?<![\d.,A-Za-z_])1·(?!\d)/);
          expect(t, where + ' x = x restatement').not.toMatch(/(?<![\w.·+\-−/] ?)(-?\d+(?:\.\d+)?) = \1(?![\w.])/);
          expect(t, where + ' a/b = a/b restatement').not.toMatch(/(?<![\d./])(\d+(?:\.\d+)?\/\d+(?:\.\d+)?) = \1(?![\d./])/);
          expect(t, where + ' trailing zeros').not.toMatch(/\d\.\d*0(?![\d.])/);
          expect(t, where + ' .0').not.toMatch(/\d\.0(?!\d)/);
          expect(t, where + ' ASCII ^ or ** or sqrt').not.toMatch(/\*\*|\bpi\b/);
          expect(t, where + ' ZH comma in EN / EN comma in ZH prose').not.toMatch(lang === 'en' ? /[，。；（）]/ : /[A-Za-z]{3,}, [A-Za-z]{3,}/);
          // reduced forms: a fraction of two integers must be in lowest terms unless it is an evaluation shown as "a/b = value" or inside diag( )
          for (const m of norm(t).matchAll(/(?<![\d./])(\d+)\/(\d+)(?![\d./])/g)) {
            const a = Number(m[1]), b = Number(m[2]);
            const after = norm(t).slice(m.index! + m[0].length, m.index! + m[0].length + 4);
            const before = norm(t).slice(Math.max(0, m.index! - 12), m.index!);
            const shownEvaluation = after.startsWith(' = ') || /diag\(/.test(before) || /^, \d/.test(after) && /diag\(/.test(before);
            if (b === 1 || gcd(a, b) > 1) expect(shownEvaluation || (b !== 1 && a === 5 && b === 5), `${where}: unreduced ${m[0]} in ${t.slice(Math.max(0, m.index! - 30), m.index! + 30)}`).toBe(true);
          }
          if (lang === 'zh') for (const w of (t.match(/[A-Za-z]{2,}/g) ?? []).filter(x => /[a-z]{3,}/.test(x) || ALLOWED_LATIN_ZH.has(x))) expect(ALLOWED_LATIN_ZH.has(w), `${where}: English word "${w}" in ZH: ${t.slice(0, 80)}`).toBe(true);
        }
        expect(c.hint, where).not.toBe(c.explanation);
        expect(c.explanation.length, where).toBeGreaterThan(40);
      });
    }
  });

  it('no answer in the hint (numeric cards) and the explanation contains the answer', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) for (const c of cardsOf(spreadSeed(i), lang)) if (c.fields) {
      const a = c.fields[0].answer;
      const cands = new Set<string>([String(Number(a.toFixed(3))).replace('-', '−')]);
      for (const d of [2, 4, 5, 8, 10]) if (Math.abs(a * d - Math.round(a * d)) < 1e-9 && !Number.isInteger(a)) { const n = Math.round(a * d), g = gcd(Math.abs(n), d); cands.add(`${n / g}/${d / g}`.replace('-', '−')); }
      const trivial = Number.isInteger(a) && Math.abs(a) <= 2;
      const where = `${c.id} ${lang} seed ${spreadSeed(i)} answer ${a}`;
      if (!trivial) for (const cand of cands) expect(c.hint.includes(cand), `${where}: hint contains ${cand}`).toBe(false);
      expect([...cands].some(cand => norm(c.explanation).includes(norm(cand))), `${where}: explanation lacks any of ${[...cands]}`).toBe(true);
    }
  });

  it('explanations use the same numbers as the prompt (every audited param appears in the explanation or the prompt)', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) for (const c of cardsOf(spreadSeed(i), lang)) if (c.audit) {
      for (const [k, v] of Object.entries(c.audit.params)) {
        const s = String(v as number);
        expect(norm(c.prompt).includes(s), `${c.id} ${lang}: param ${k}=${s} printed in prompt`).toBe(true);
      }
    }
  });
});
