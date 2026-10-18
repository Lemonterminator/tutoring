import { describe, expect, it } from 'vitest';
import { gp13 } from './games/gp13';
import { spreadSeed, questionTextOf, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const COVER = 6000;
const num = (s: string) => Number(s.replaceAll('−', '-'));
const NUM = '\\(?(−?\\d+(?:\\.\\d+)?)\\)?';
const deck = (seed: number, lang: GameLanguage) => gp13(seed, lang) as PracticeCard[];
const SLUGS = ['integrate-vs-mode', 'het-variance', 'het-integrate', 'count-unknowns', 'basis-kernel', 'basis-beta', 'basis-far-var', 'vague-naive', 'challenge'];
const byId = (cards: PracticeCard[], slug: string) => {
  const c = cards.find(card => card.id === `GP-13-${slug}`);
  if (!c) throw new Error(`missing card ${slug}`);
  return c;
};
const seeds = (n: number) => Array.from({ length: n }, (_, i) => spreadSeed(i));
const grade = (card: PracticeCard, values: string[]) => gradeCard(card, values, null, []);
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** reduced denominator of n/d (integers) */
const redDen = (n: number, d: number) => Math.abs(d) / gcd(n, d);
const DEN_OK = new Set([1, 2, 4, 5, 8, 10]);
const grab = (text: string, re: RegExp): RegExpMatchArray => {
  const m = text.match(re);
  if (!m) throw new Error(`pattern ${re} not found in: ${text}`);
  return m;
};
const cmp = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---------- hand-written linear algebra (2x2, row-major [a,b,c,d]) ----------
type M2 = [number, number, number, number];
const inv2 = (M: M2): M2 => { const d = M[0] * M[3] - M[1] * M[2]; return [M[3] / d, -M[1] / d, -M[2] / d, M[0] / d]; };
const mulV = (M: M2, v: [number, number]): [number, number] => [M[0] * v[0] + M[1] * v[1], M[2] * v[0] + M[3] * v[1]];
const dot = (a: [number, number], b: [number, number]) => a[0] * b[0] + a[1] * b[1];
const ONES: [number, number] = [1, 1];
/** C = K_y + B * 11^T */
const covC = (p: number, q: number, B: number): M2 => [p + B, q + B, q + B, p + B];
/** explicit joint-Gaussian conditioning of (y, g*), g = f + beta, beta ~ N(b, B), f ~ GP(0, K) with k*=0, k**=kappa */
function jointMean(p: number, q: number, B: number, b: number, y1: number, y2: number): number {
  const Ci = inv2(covC(p, q, B));
  const r: [number, number] = [y1 - b, y2 - b]; // y - E[y], E[y] = b * 1
  return b + dot([B, B], mulV(Ci, r)); // cov(g*, y) = B * 1
}
function jointVar(p: number, q: number, B: number, kappa: number): number {
  const Ci = inv2(covC(p, q, B));
  const c: [number, number] = [B, B];
  return kappa + B - dot(c, mulV(Ci, c));
}
/** GPML eq. 2.41 with matrices: (B^-1 + H Ky^-1 H^T)^-1 (H Ky^-1 y + B^-1 b), H = (1, 1) */
function gpmlMean(p: number, q: number, B: number, b: number, y1: number, y2: number): number {
  const Ky = inv2([p, q, q, p]);
  const hkh = dot(ONES, mulV(Ky, ONES));
  const hky = dot(ONES, mulV(Ky, [y1, y2]));
  return (hky + b / B) / (1 / B + hkh);
}
function gpmlVar(p: number, q: number, B: number, kappa: number): number {
  const hkh = dot(ONES, mulV(inv2([p, q, q, p]), ONES));
  return kappa + 1 / (1 / B + hkh);
}
const PQ: [number, number][] = [[2, -1], [3, -2], [3, -1], [3, 1], [3, 2], [4, -3], [4, -2], [4, 1], [5, -4], [5, -3], [5, -1]];
const rat = (n: number, d: number) => ({ n, d });

// ---------- parsing helpers ----------
function matrixIn(text: string, which = 0): number[] {
  const re = new RegExp(`\\[\\[\\s*${NUM}\\s*,\\s*${NUM}\\s*\\]\\s*,\\s*\\[\\s*${NUM}\\s*,\\s*${NUM}\\s*\\]\\]`, 'g');
  const all = [...text.matchAll(re)];
  if (!all[which]) throw new Error(`no 2x2 matrix #${which} in: ${text}`);
  return all[which].slice(1, 5).map(num);
}
const detIn = (text: string) => num(grab(text, /(?:determinant |行列式[为 ]*)(\d+)/)[1]);
const yIn = (text: string): [number, number] => { const m = grab(text, new RegExp(`y = \\(${NUM}, ${NUM}\\)ᵀ`)); return [num(m[1]), num(m[2])]; };
const priorIn = (text: string): [number, number] => { const m = grab(text, new RegExp(`β ~ N\\(${NUM}, ${NUM}\\)`)); return [num(m[1]), num(m[2])]; };
const kappaIn = (text: string) => num(grab(text, /k\(x\*, x\*\) = (\d+(?:\.\d+)?)/)[1]);

type Draw = { seed: number; lang: GameLanguage; cards: PracticeCard[] };
const cache = new Map<string, PracticeCard[]>();
const get = (seed: number, lang: GameLanguage) => {
  const key = `${seed}-${lang}`;
  if (!cache.has(key)) cache.set(key, deck(seed, lang));
  return cache.get(key)!;
};
const draws = (n: number): Draw[] => seeds(n).flatMap(seed => (['en', 'zh'] as const).map(lang => ({ seed, lang, cards: get(seed, lang) })));

function expectGrades(card: PracticeCard, answers: number[], where: string) {
  expect(card.fields!.length, where).toBe(answers.length);
  const strings = answers.map(a => a.toFixed(2));
  expect(grade(card, strings), `${where}: 2-decimal true value must be accepted (${strings})`).toBe('correct');
  answers.forEach((a, i) => {
    expect(card.fields![i].tolerance, `${where}: tolerance`).toBe(0.006);
    expect(Math.abs(card.fields![i].answer - a), `${where}: field ${i} answer ${card.fields![i].answer} vs oracle ${a}`).toBeLessThan(1e-9);
    for (const delta of [0.0075, -0.0075, 0.05, -0.05]) {
      const vals = strings.slice(); vals[i] = (a + delta).toFixed(4);
      expect(grade(card, vals), `${where}: field ${i} perturbed by ${delta}`).toBe('incorrect');
    }
  });
}
function expectGap(answer: number, wrongs: Record<string, number>, where: string, gap = 0.02) {
  for (const [name, w] of Object.entries(wrongs)) {
    expect(Math.abs(w - answer), `${where}: wrong route "${name}" = ${w} collides with answer ${answer}`).toBeGreaterThanOrEqual(gap - 1e-9);
  }
}
const allGap = (answer: number, wrongs: number[], gap = 0.02) => wrongs.every(w => Math.abs(w - answer) >= gap);

// ---------- plan wrong routes ----------
const w1 = (N: number, s: number) => [s / N, (s + 1) / N, s / (N + 2), (s + 1) / (N + 1)];
const w5 = (kappa: number, x: number, xp: number, B0: number, B1: number, m1: number, m2: number) => [
  B0 + B1 * x * xp, kappa * (B0 + B1 * x * xp), kappa + B0 + B1 * (x + xp), kappa + m1 + m2 * x * xp, kappa + B0 + B1];
const w6 = (p: number, q: number, B: number, b: number, y1: number, y2: number) => {
  const s = p + q, S = y1 + y2;
  return [S / 2, (B * S + p * b) / (p + 2 * B), (B * S) / (s + 2 * B), (S + b * B * s) / (B * s + 2)];
};
const w7 = (p: number, q: number, B: number, kappa: number) => {
  const s = p + q;
  return [kappa, kappa + B, kappa + (B * p) / (p + 2 * B), kappa + s / 2, kappa + 1 / B + 2 / s];
};

// ---------- sampling spaces by enumeration (independent of the generator) ----------
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function space1() {
  const out: string[] = [];
  for (const N of [2, 3, 6, 8]) for (let s = 0; s <= N; s++) {
    if (N === 2 * s) continue;
    const a = (s + 1) / (N + 2);
    if (!allGap(a, w1(N, s))) continue;
    if (!DEN_OK.has(redDen(s + 1, N + 2))) throw new Error('plan denominator rule violated in space1');
    out.push(`${N},${s}`);
  }
  return out;
}
function space2() { const out: string[] = []; for (const a1 of range(3, 8)) for (const a2 of range(3, 8)) if (a1 !== a2) out.push(`${a1},${a2}`); return out; }
function space4() { const out: string[] = []; for (const n of [20, 25, 30, 40]) for (const M of [8, 10, 12, 15]) out.push(`${n},${M}`); return out; }
function space5() {
  const out: string[] = [];
  for (const k100 of [25, 50, 75]) for (const [x, xp] of [[1, 2], [1, 3], [2, 3]]) for (const B0 of [1, 2]) for (const B1 of [1, 2, 3]) for (const m1 of [1, 2, 3]) for (const m2 of [1, 2, 3]) {
    if (m1 === B0 && m2 === B1) continue;
    const kappa = k100 / 100, a = kappa + B0 + B1 * x * xp;
    if (!allGap(a, w5(kappa, x, xp, B0, B1, m1, m2))) continue;
    out.push(`${kappa},${x},${xp},${B0},${B1},${m1},${m2}`);
  }
  return out;
}
const betaRat = (p: number, q: number, B: number, b: number, S: number) => { const s = p + q; return rat(B * S + s * b, s + 2 * B); };
function space6() {
  const out: string[] = [];
  for (const [p, q] of PQ) for (const B of [1, 2, 4]) for (const b of [-3, -2, -1, 1, 2, 3, 4, 5, 6]) for (const y1 of range(0, 8)) for (const y2 of range(0, 8)) {
    if (y1 === y2) continue;
    const r = betaRat(p, q, B, b, y1 + y2);
    if (!DEN_OK.has(redDen(r.n, r.d))) continue;
    if (!allGap(r.n / r.d, w6(p, q, B, b, y1, y2))) continue;
    out.push(`${p},${q},${B},${b},${y1},${y2}`);
  }
  return out;
}
const varRat100 = (p: number, q: number, B: number, k100: number) => { const s = p + q; return rat(k100 * (s + 2 * B) + 100 * B * s, 100 * (s + 2 * B)); };
function space7() {
  const out: string[] = [];
  for (const [p, q] of PQ) for (const B of [1, 2, 4]) for (const k100 of [25, 50, 75, 100, 150, 200]) {
    const r = varRat100(p, q, B, k100);
    if (!DEN_OK.has(redDen(r.n, r.d))) continue;
    if (!allGap(r.n / r.d, w7(p, q, B, k100 / 100))) continue;
    out.push(`${p},${q},${B},${k100 / 100}`);
  }
  return out;
}
function space9() {
  const out: string[] = [];
  for (const [p, q] of PQ) for (const B of [1, 2, 4]) for (const b of [-3, -2, -1, 1, 2, 3, 4, 5, 6]) for (const y1 of range(0, 8)) for (const y2 of range(0, 8)) {
    if (y1 === y2) continue;
    const rm = betaRat(p, q, B, b, y1 + y2);
    if (!DEN_OK.has(redDen(rm.n, rm.d))) continue;
    for (const k100 of [50, 100, 150]) {
      const rv = varRat100(p, q, B, k100);
      if (!DEN_OK.has(redDen(rv.n, rv.d))) continue;
      const mean = rm.n / rm.d, kappa = k100 / 100;
      if (!allGap(mean, w6(p, q, B, b, y1, y2))) continue;
      if (!allGap(rv.n / rv.d, w7(p, q, B, kappa))) continue;
      out.push(`${p},${q},${B},${b},${y1},${y2},${kappa}`);
    }
  }
  return out;
}

const keys = {
  1: (c: PracticeCard) => `${c.audit!.params.N},${c.audit!.params.s}`,
  2: (c: PracticeCard) => `${c.audit!.params.a1},${c.audit!.params.a2}`,
  4: (c: PracticeCard) => `${c.audit!.params.n},${c.audit!.params.M}`,
  5: (c: PracticeCard) => ['kappa', 'x', 'xp', 'B0', 'B1', 'm1', 'm2'].map(k => c.audit!.params[k]).join(','),
  6: (c: PracticeCard) => ['p', 'q', 'B', 'b', 'y1', 'y2'].map(k => c.audit!.params[k]).join(','),
  7: (c: PracticeCard) => ['p', 'q', 'B', 'kappa'].map(k => c.audit!.params[k]).join(','),
  9: (c: PracticeCard) => ['p', 'q', 'B', 'b', 'y1', 'y2', 'kappa'].map(k => c.audit!.params[k]).join(','),
};

describe('GP-13 oracle', () => {
  it('deck structure: 9 cards in plan order, no figures, no slots, audit kinds exactly as planned', () => {
    const expected = ['integrate-vs-mode', 'het-variance', 'count-unknowns', 'basis-kernel', 'basis-beta', 'basis-far-var', 'challenge'].map(s => `GP-13:${s}`).sort();
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const where = `seed ${seed} ${lang}`;
      expect(cards.map(c => c.id), where).toEqual(SLUGS.map(s => `GP-13-${s}`));
      expect(cards.filter(c => c.audit).map(c => c.audit!.kind).filter(k => k !== 'GP-13:vague-naive').sort(), where).toEqual(expected);
      for (const c of cards) {
        expect(c.figure, `${where} ${c.id}`).toBeUndefined();
        expect(c.choice?.figures?.some(Boolean) ?? false, `${where} ${c.id}`).toBe(false);
        expect(c.slots, `${where} ${c.id}`).toBeUndefined();
        expect(c.audit === undefined, `${where} ${c.id} audit presence`).toBe(c.id.endsWith('het-integrate'));
      }
    }
  });

  it('integrate-vs-mode: Beta integrals by quadrature, printed text, wrong routes', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'integrate-vs-mode'), a = c.audit!.params as Record<string, number>;
      const where = `integrate seed ${seed} ${lang}`;
      expect(c.audit!.kind).toBe('GP-13:integrate-vs-mode');
      const { N, s } = a;
      // independent route: ratio of Beta integrals by Simpson
      const simpson = (f: (t: number) => number) => { const n = 2000, h = 1 / n; let sum = f(0) + f(1); for (let i = 1; i < n; i++) sum += f(i * h) * (i % 2 ? 4 : 2); return sum * h / 3; };
      const ratio = simpson(t => t ** (s + 1) * (1 - t) ** (N - s)) / simpson(t => t ** s * (1 - t) ** (N - s));
      expect(Math.abs(ratio - (s + 1) / (N + 2)), where).toBeLessThan(1e-9);
      expectGrades(c, [ratio], where);
      expectGap(ratio, Object.fromEntries(w1(N, s).map((w, i) => [`w${i}`, w])), where);
      expect(N === 2 * s, where).toBe(false);
      const text = c.prompt;
      const t = lang === 'en' ? grab(text, /In (\d+) trials there are (\d+) successes/) : grab(text, /(\d+) 次试验中有 (\d+) 次成功/);
      expect([num(t[1]), num(t[2])], where).toEqual([N, s]);
      const b = grab(text, /Beta\((\d+), (\d+)\)/);
      expect([num(b[1]), num(b[2])], where).toEqual([s + 1, N - s + 1]);
      const mode = grab(text, lang === 'en' ? /mode is (\d+(?:\/\d+)?)/ : /众数为 (\d+(?:\/\d+)?)/);
      const [mn, md = '1'] = mode[1].split('/');
      expect(num(mn) / num(md), where).toBeCloseTo(s / N, 12);
    }
  });

  it('het-variance: exp(ln a)^2 and printed text', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'het-variance'), a = c.audit!.params as Record<string, number>;
      const where = `het-variance seed ${seed} ${lang}`;
      const truth = Math.exp(Math.log(a.a2)) ** 2;
      expectGrades(c, [truth], where);
      expectGap(truth, { a2: a.a2, '2a2': 2 * a.a2, a1sq: a.a1 ** 2, a1a2: a.a1 * a.a2 }, where, 3);
      expect(a.a1 !== a.a2 && a.a1 >= 3 && a.a1 <= 8 && a.a2 >= 3 && a.a2 <= 8, where).toBe(true);
      expect(num(grab(c.prompt, /g\(x₁\) = ln (\d+)/)[1]), where).toBe(a.a1);
      expect(num(grab(c.prompt, /g\(x₂\) = ln (\d+)/)[1]), where).toBe(a.a2);
    }
  });

  it('count-unknowns: list lengths and printed text', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'count-unknowns'), a = c.audit!.params as Record<string, number>;
      const where = `count seed ${seed} ${lang}`;
      const dense = [...Array(a.n).fill('f'), ...Array(a.n).fill('g'), ...Array(5).fill('s')].length;
      const hs = [...Array(a.M).fill('bf'), ...Array(a.M).fill('bg'), ...Array(5).fill('s')].length;
      expectGrades(c, [dense, hs], where);
      expectGap(dense, { 'n+5': a.n + 5, '2n': 2 * a.n, n: a.n, '2n+10': 2 * a.n + 10 }, where, 5);
      expectGap(hs, { 'M+5': a.M + 5, '2M': 2 * a.M, M: a.M, '2M+10': 2 * a.M + 10 }, where, 5);
      expect(a.M < a.n, where).toBe(true);
      expect(num(grab(c.prompt, /n = (\d+)/)[1]), where).toBe(a.n);
      expect(num(grab(c.prompt, /M = (\d+)/)[1]), where).toBe(a.M);
      const labels = c.fields!.map(f => f.label);
      expect(labels, where).toEqual(lang === 'en' ? ['Version 1 (f, g)', 'Version 2 (β_f, β_g)'] : ['版本 1 (f, g)', '版本 2 (β_f, β_g)']);
    }
  });

  it('basis-kernel: hᵀBh′ by matrix product, decoy mean, printed text', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'basis-kernel'), a = c.audit!.params as Record<string, number>;
      const where = `basis-kernel seed ${seed} ${lang}`;
      const h1: [number, number] = [1, a.x], h2: [number, number] = [1, a.xp];
      const Bm: M2 = [a.B0, 0, 0, a.B1];
      const truth = a.kappa + dot(h1, mulV(Bm, h2));
      expectGrades(c, [truth], where);
      expectGap(truth, Object.fromEntries(w5(a.kappa, a.x, a.xp, a.B0, a.B1, a.m1, a.m2).map((w, i) => [`w${i}`, w])), where);
      expect(a.m1 === a.B0 && a.m2 === a.B1, where).toBe(false);
      expect(num(grab(c.prompt, /k\(x, x′\) = (\d+(?:\.\d+)?)/)[1]), where).toBe(a.kappa);
      const xs = lang === 'en' ? grab(c.prompt, /x = (\d+) and x′ = (\d+)/) : grab(c.prompt, /x = (\d+)、x′ = (\d+)/);
      expect([num(xs[1]), num(xs[2])], where).toEqual([a.x, a.xp]);
      const bm = grab(c.prompt, new RegExp(`b = \\(${NUM}, ${NUM}\\)ᵀ`));
      expect([num(bm[1]), num(bm[2])], where).toEqual([a.m1, a.m2]);
      expect(matrixIn(c.prompt), where).toEqual([a.B0, 0, 0, a.B1]);
    }
  });

  it('basis-beta: conditioning and GPML 2.41 agree with the card; printed text', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'basis-beta'), a = c.audit!.params as Record<string, number>;
      const where = `basis-beta seed ${seed} ${lang}`;
      const r1 = jointMean(a.p, a.q, a.B, a.b, a.y1, a.y2), r2 = gpmlMean(a.p, a.q, a.B, a.b, a.y1, a.y2);
      expect(Math.abs(r1 - r2), where).toBeLessThan(1e-9);
      expectGrades(c, [r1], where);
      expectGap(r1, Object.fromEntries(w6(a.p, a.q, a.B, a.b, a.y1, a.y2).map((w, i) => [`w${i}`, w])), where);
      const rr = betaRat(a.p, a.q, a.B, a.b, a.y1 + a.y2);
      expect(DEN_OK.has(redDen(rr.n, rr.d)), `${where} denominator`).toBe(true);
      expect(a.y1 !== a.y2 && a.b !== 0, where).toBe(true);
      expect(PQ.some(([p, q]) => p === a.p && q === a.q), `${where} (p,q)`).toBe(true);
      expect(matrixIn(c.prompt), where).toEqual([a.p, a.q, a.q, a.p]);
      expect(detIn(c.prompt), where).toBe(a.p * a.p - a.q * a.q);
      expect(priorIn(c.prompt), where).toEqual([a.b, a.B]);
      expect(yIn(c.prompt), where).toEqual([a.y1, a.y2]);
    }
  });

  it('basis-far-var: joint conditioning and GPML 2.41 agree with the card; printed text', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'basis-far-var'), a = c.audit!.params as Record<string, number>;
      const where = `far-var seed ${seed} ${lang}`;
      const r1 = jointVar(a.p, a.q, a.B, a.kappa), r2 = gpmlVar(a.p, a.q, a.B, a.kappa);
      expect(Math.abs(r1 - r2), where).toBeLessThan(1e-9);
      expectGrades(c, [r1], where);
      expectGap(r1, Object.fromEntries(w7(a.p, a.q, a.B, a.kappa).map((w, i) => [`w${i}`, w])), where);
      expect(matrixIn(c.prompt), where).toEqual([a.p, a.q, a.q, a.p]);
      expect(detIn(c.prompt), where).toBe(a.p * a.p - a.q * a.q);
      expect(priorIn(c.prompt), where).toEqual([0, a.B]);
      expect(kappaIn(c.prompt), where).toBe(a.kappa);
    }
  });

  it('challenge: mean and variance by conditioning and GPML 2.41; printed text; wrong routes of cards 6 and 7', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'challenge'), a = c.audit!.params as Record<string, number>;
      const where = `challenge seed ${seed} ${lang}`;
      const m1 = jointMean(a.p, a.q, a.B, a.b, a.y1, a.y2), m2 = gpmlMean(a.p, a.q, a.B, a.b, a.y1, a.y2);
      const v1 = jointVar(a.p, a.q, a.B, a.kappa), v2 = gpmlVar(a.p, a.q, a.B, a.kappa);
      expect(Math.abs(m1 - m2) + Math.abs(v1 - v2), where).toBeLessThan(1e-9);
      expectGrades(c, [m1, v1], where);
      expectGap(m1, Object.fromEntries(w6(a.p, a.q, a.B, a.b, a.y1, a.y2).map((w, i) => [`mean w${i}`, w])), where);
      expectGap(v1, Object.fromEntries(w7(a.p, a.q, a.B, a.kappa).map((w, i) => [`var w${i}`, w])), where);
      expect(matrixIn(c.prompt), where).toEqual([a.p, a.q, a.q, a.p]);
      expect(detIn(c.prompt), where).toBe(a.p * a.p - a.q * a.q);
      expect(priorIn(c.prompt), where).toEqual([a.b, a.B]);
      expect(yIn(c.prompt), where).toEqual([a.y1, a.y2]);
      expect(kappaIn(c.prompt), where).toBe(a.kappa);
      expect(c.fields!.map(f => f.label), where).toEqual(lang === 'en' ? ['Predictive mean', 'Predictive variance'] : ['预测均值', '预测方差']);
    }
  });

  it('het-integrate: the unique correct option says only model A is integrable', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'het-integrate');
      const where = `het-integrate seed ${seed} ${lang}`;
      const isA = (t: string) => (lang === 'en' ? /^Only model A can/.test(t) : /^只有模型 A 可以/.test(t));
      const verdicts = c.choice!.options.map(isA);
      expect(c.choice!.options.length, where).toBe(4);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[c.choice!.answer], where).toBe(true);
      const lens = c.choice!.options.map(o => o.length);
      if (lang === 'en') expect(lens[c.choice!.answer], `${where} correct must not be the longest`).toBeLessThan(Math.max(...lens));
      // the other three are the planned false statements
      const plannedWrong = lang === 'en' ? [/^Both can/, /^Neither can/, /^Only model B can/] : [/^两个都可以/, /^两个都不可以/, /^只有模型 B 可以/];
      const wrong = c.choice!.options.filter((_, i) => i !== c.choice!.answer);
      for (const re of plannedWrong) expect(wrong.filter(o => re.test(o)).length, `${where} ${re}`).toBe(1);
    }
  });

  it('vague-naive: eigenvalues of [[d+B,B],[B,d+B]] by the 2x2 formula decide the correct option', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) {
      const c = byId(cards, 'vague-naive');
      const where = `vague seed ${seed} ${lang}`;
      const mats = [matrixIn(c.prompt, 0), matrixIn(c.prompt, 1)];
      const d = mats[0][0], Bv = mats[1][1];
      expect(mats[0], where).toEqual([d, 0, 0, d]);
      expect(mats[1], where).toEqual([d + Bv, Bv, Bv, d + Bv]);
      expect([1, 2].includes(d) && [100, 1000, 10000].includes(Bv), `${where}: d=${d} B=${Bv}`).toBe(true);
      expect(num(grab(c.prompt, /B = (\d+)/)[1]), where).toBe(Bv);
      const [a, b, , e] = mats[1];
      const tr = a + e, det = a * e - b * b, disc = Math.sqrt(tr * tr / 4 - det);
      const lo = tr / 2 - disc, hi = tr / 2 + disc;
      expect(Math.abs(lo - d), where).toBeLessThan(1e-6);
      expect(Math.abs(hi - (d + 2 * Bv)), where).toBeLessThan(1e-6);
      const cond = hi / lo;
      expect(det, `${where}: positive definite and nonsingular`).toBeGreaterThan(0);
      const ev = grab(c.prompt, lang === 'en' ? /eigenvalues are (\d+) and (\d+)/ : /特征值为 (\d+) 和 (\d+)/);
      expect([num(ev[1]), num(ev[2])], where).toEqual([d, d + 2 * Bv]);
      const has = (t: string, n: number) => new RegExp(`(?<![\\d.])${Math.round(n)}(?![\\d])`).test(t);
      const ok = (t: string) => has(t, lo) && has(t, hi) && has(t, cond) && (lang === 'en' ? /ill-conditioned/.test(t) : /条件数/.test(t));
      const verdicts = c.choice!.options.map(ok);
      expect(c.choice!.options.length, where).toBe(4);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[c.choice!.answer], where).toBe(true);
      const lens = c.choice!.options.map(o => o.length);
      if (lang === 'en') expect(lens[c.choice!.answer], `${where} correct must not be the longest`).toBeLessThan(Math.max(...lens));
      const wrong = c.choice!.options.filter((_, i) => i !== c.choice!.answer);
      const planned = lang === 'en' ? [/^Nothing goes wrong/, /singular/, /no longer positive definite|stops being positive definite/] : [/^没有问题/, /奇异/, /不再正定/];
      for (const re of planned) expect(wrong.filter(o => re.test(o)).length, `${where} ${re}`).toBe(1);
    }
  });

  it('sampling spaces equal the plan counts exactly (enumerated independently)', () => {
    const spaces: [keyof typeof keys, string, string[], number][] = [
      [1, 'integrate-vs-mode', space1(), 18], [2, 'het-variance', space2(), 30], [4, 'count-unknowns', space4(), 16],
      [5, 'basis-kernel', space5(), 426], [6, 'basis-beta', space6(), 6792], [7, 'basis-far-var', space7(), 46], [9, 'challenge', space9(), 12978]];
    const slugOf: Record<number, string> = { 1: 'integrate-vs-mode', 2: 'het-variance', 4: 'count-unknowns', 5: 'basis-kernel', 6: 'basis-beta', 7: 'basis-far-var', 9: 'challenge' };
    for (const [card, slug, space, planCount] of spaces) {
      expect(space.length, `enumeration of ${slug} vs plan`).toBe(planCount);
      expect(new Set(space).size, `${slug} unique`).toBe(planCount);
      const allowed = new Set(space), seen = new Set<string>();
      for (const seed of seeds(COVER)) {
        const c = byId(get(seed, 'en'), slugOf[card]);
        const key = keys[card](c);
        expect(allowed.has(key), `${slug} seed ${seed}: sampled ${key} outside the plan's space`).toBe(true);
        seen.add(key);
      }
      if (planCount <= 50) expect(seen.size, `${slug}: every planned set must occur`).toBe(planCount);
      else if (planCount <= 500) expect(seen.size, `${slug}: coverage`).toBeGreaterThan(planCount * 0.9);
    }
    // vague-naive: all 6 (B, d) sets occur
    const seen = new Set<string>();
    for (const seed of seeds(COVER)) { const m = matrixIn(byId(get(seed, 'en'), 'vague-naive').prompt, 1); seen.add(`${m[0] - m[1]},${m[1]}`); }
    expect([...seen].sort()).toEqual(['1,100', '1,1000', '1,10000', '2,100', '2,1000', '2,10000'].sort());
  });

  it('EN and ZH decks of the same seed carry identical audit params and answers', () => {
    for (const seed of seeds(SEEDS)) {
      const en = get(seed, 'en'), zh = get(seed, 'zh');
      en.forEach((c, i) => {
        expect(zh[i].id).toBe(c.id);
        expect(cmp(zh[i].audit, c.audit), `${seed} ${c.id}`).toBe(true);
        expect(cmp(zh[i].fields?.map(f => f.answer), c.fields?.map(f => f.answer)), `${seed} ${c.id}`).toBe(true);
        expect(zh[i].choice?.options.length, c.id).toBe(c.choice?.options.length);
      });
    }
  });

  it('variety: at least 6 distinct prompts per card over 60 seeds (concept card het-integrate exempt)', () => {
    for (const lang of ['en', 'zh'] as const) for (const slug of SLUGS) {
      if (slug === 'het-integrate') continue;
      const distinct = new Set(seeds(SEEDS).map(s => byId(get(s, lang), slug).prompt));
      expect(distinct.size, `${slug} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('learner-visible text: Unicode notation, no ASCII names, no hyphen minus, no raw floats, ZH without English words', () => {
    const BAD_ASCII = /\b(sigma|kappa|beta|lambda|K_inv|xp|l21|l11|B0|B1|m1|m2|y1|y2|s1|Ns1|N2|dB|undefined|NaN|Infinity)\b|\[object/;
    const HYPHEN_MINUS = /(?:^|[\s(,=])-\s?\d|\d-\d|[\s(]-[A-Za-zκσℓβ]/;
    const DOUBLE_PAREN = /\(\(/;
    const RAW_FLOAT = /\d+\.\d{4,}/;
    const PLACEHOLDER = /\{[^}]*\}/;
    const ZH_ALLOWED = /\b(GP|GPML|MCMC|Beta|Cholesky|exp|ln|Laplace|VI|EP|ELBO|KL|HS|SE|Var|cov|normal|N)\b/g;
    const seen = new Set<string>();
    for (const { seed, lang, cards } of draws(SEEDS)) for (const c of cards) {
      for (const t of textOf(c)) {
        const where = `seed ${seed} ${lang} ${c.id}: "${t}"`;
        if (seen.has(`${lang}${t}`)) continue;
        seen.add(`${lang}${t}`);
        expect(t, where).not.toMatch(BAD_ASCII);
        expect(t, where).not.toMatch(HYPHEN_MINUS);
        expect(t, where).not.toMatch(DOUBLE_PAREN);
        expect(t, where).not.toMatch(RAW_FLOAT);
        expect(t, where).not.toMatch(PLACEHOLDER);
        expect(t, where).not.toMatch(/\^/);
        expect(t, where).not.toMatch(/[+−-]\s*[-−]\s*\d/);
        if (lang === 'zh') {
          const stripped = t.replace(ZH_ALLOWED, '').replace(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g, '');
          expect(stripped, `${where} English word in ZH`).not.toMatch(/[A-Za-z]{3,}/);
        }
      }
      if (c.id.endsWith('integrate-vs-mode')) expect(c.explanation, `seed ${seed} ${lang} s=0 wording`).not.toMatch(/With 0 = 0/);
      // hints must not contain the answer as a standalone number
      if (c.fields) for (const f of c.fields) {
        const ans = String(Math.abs(f.answer));
        if (Math.abs(f.answer) >= 10 || !Number.isInteger(f.answer)) expect(c.hint, `seed ${seed} ${c.id} hint leaks ${ans}`).not.toContain(` ${ans} `);
      }
    }
  });

  it('question text shows the numbers the card uses (no hidden inputs)', () => {
    for (const { seed, lang, cards } of draws(SEEDS)) for (const c of cards) {
      if (!c.audit) continue;
      const text = questionTextOf(c).join(' ').replaceAll('−', '-');
      for (const [k, v] of Object.entries(c.audit.params)) {
        const value = v as number;
        const shown = new RegExp(`(?<![\\d.])${Math.abs(value)}(?![\\d])`).test(text) || Math.abs(value) <= 1;
        expect(shown, `seed ${seed} ${lang} ${c.id}: param ${k}=${value} not visible`).toBe(true);
      }
    }
  });
});
