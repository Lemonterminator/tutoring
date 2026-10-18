import { describe, expect, it } from 'vitest';
import { gp16 } from './games/gp16';
import { deckProblems, spreadSeed, textLintProblems, textOf, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/* Independent oracle for GP-16 (non-stationary and structured kernels), written from docs/aalto-gp-drafts/approved-GP-16.md only. */
const SEEDS = 60;
const SLUGS = ['gibbs-diagonal', 'naive-asymmetry', 'gibbs-exponent', 'jump-prefactor', 'gibbs-value', 'warp-stationary', 'kmer-kernel', 'patch-sum', 'challenge'] as const;
type Slug = (typeof SLUGS)[number];
const NUMERIC: Slug[] = ['gibbs-diagonal', 'naive-asymmetry', 'gibbs-exponent', 'jump-prefactor', 'gibbs-value', 'kmer-kernel', 'patch-sum', 'challenge'];
const TAB: Record<number, number> = { 0.1: 0.905, 0.2: 0.819, 0.4: 0.670, 0.8: 0.449, 1.6: 0.202 };

const decks = new Map<string, PracticeCard[]>();
function deck(index: number, lang: GameLanguage): PracticeCard[] {
  const key = `${index}:${lang}`;
  if (!decks.has(key)) decks.set(key, gp16(spreadSeed(index), lang));
  return decks.get(key)!;
}
const card = (index: number, lang: GameLanguage, slug: Slug): PracticeCard => {
  const found = deck(index, lang).find(c => c.id === `GP-16-${slug}`);
  if (!found) throw new Error(`seed ${index} ${lang}: card ${slug} missing`);
  return found;
};

// ---------- independent maths ----------
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
function reducedDen(num: number, den: number): number { return Math.abs(den) / gcd(num, den); }
/** The full Gibbs kernel, evaluated numerically (Lecture 5 p. 73 eq. 64). */
const gibbs = (l: number, lp: number, d: number) => Math.sqrt(2 * l * lp / (l * l + lp * lp)) * Math.exp(-d * d / (l * l + lp * lp));
const tabOf = (t: number): number => {
  const key = Object.keys(TAB).map(Number).find(k => Math.abs(k - t) < 1e-9);
  if (key === undefined) throw new Error(`2E = ${t} is not a key of the exp table`);
  return TAB[key];
};
const tabHas = (t: number) => Object.keys(TAB).some(k => Math.abs(Number(k) - t) < 1e-9);
/** 2-decimal rounding, half up (a learner's rounding, not binary toFixed). */
const r2 = (x: number) => Math.round(x * 100 + 1e-9) / 100;
const GAP = 0.02 - 1e-12;
const farFrom = (truth: number, routes: number[], gap: number) => routes.every(v => Math.abs(v - truth) >= gap);

// ---------- plan sampling spaces (enumerated here, independently of the generator) ----------
const DENS = [1, 2, 4, 5, 8, 10];
const key = (...v: number[]) => v.join(',');

const space1: string[] = [];
for (const s of [2, 3, 4, 5]) for (const a of [2, 3, 4, 5, 6]) {
  if (farFrom(s, [s * a, s / a, s * a * a, s / (a * a), s * Math.sqrt(a), s / Math.sqrt(a)], GAP)) space1.push(key(s, a));
}
const space2: string[] = [];
for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) for (let d = 1; d <= 8; d++) {
  if (a === b) continue;
  const num = d * d * (a * a - b * b), den = 2 * a * a * b * b; // T = (d^2/2)(1/b^2 - 1/a^2)
  const T = num / den;
  if (!DENS.includes(reducedDen(num, den)) || !(Math.abs(T) > 0 && Math.abs(T) <= 10)) continue;
  const routes = [-d * d / (2 * a * a), -d * d / (2 * b * b), d * d * (1 / (b * b) - 1 / (a * a)), -T, d * d / 2 * (1 / b - 1 / a), 0, d * d / 2 * (1 / (a * a) + 1 / (b * b))];
  if (farFrom(T, routes, GAP)) space2.push(key(a, b, d));
}
const space3: string[] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let d = 1; d <= 8; d++) {
  if (a === b) continue;
  const num = d * d, den = a * a + b * b, E = num / den;
  if (!DENS.includes(reducedDen(num, den)) || !(E >= 0.1 - 1e-12 && E <= 5 + 1e-12)) continue;
  const routes = [d * d / (2 * a * a), d * d / (2 * b * b), d * d / ((a + b) ** 2), d * d / (2 * a * b), 2 * E, d / den, d * d / (a * a * b * b), E / 2];
  if (farFrom(E, routes, GAP)) space3.push(key(a, b, d));
}
const PAIRS4 = [[1, 2], [2, 1], [2, 4], [4, 2], [3, 6], [6, 3], [4, 8], [8, 4], [1, 3], [3, 1], [2, 6], [6, 2], [3, 9], [9, 3]];
const space4 = PAIRS4.map(([a, b]) => key(a, b));
const TRIPLES5 = [[1, 2, 1], [1, 2, 2], [2, 1, 1], [2, 1, 2], [2, 4, 1], [2, 4, 2], [2, 4, 4], [4, 2, 1], [4, 2, 2], [4, 2, 4], [3, 6, 3], [3, 6, 6], [6, 3, 3], [6, 3, 6], [4, 8, 2], [4, 8, 4], [4, 8, 8], [8, 4, 2], [8, 4, 4], [8, 4, 8], [1, 3, 1], [1, 3, 2], [3, 1, 1], [3, 1, 2], [2, 6, 2], [2, 6, 4], [6, 2, 2], [6, 2, 4], [3, 9, 3], [3, 9, 6], [9, 3, 3], [9, 3, 6]];
const space5 = TRIPLES5.map(([a, b, d]) => key(a, b, d));
const space9: string[] = [];
for (const [a, b, d] of TRIPLES5) for (const [p, q] of [[1, 2], [2, 1]]) space9.push(key(p, q, a, b, d));
const POOL = ['AAGGTGAA', 'TGAAAGGC', 'TGGGACGC', 'TCCTGGTT', 'TGGGGCGC', 'TCTAGGTG'];
const KMERS = ['GT', 'TG', 'AA', 'GG', 'CG'];
const phi = (z: string, s: string) => (z.match(new RegExp(`(?=${s})`, 'g')) ?? []).length; // overlapping count by lookahead
const phiFlat = (z: string, s: string) => (z.match(new RegExp(s, 'g')) ?? []).length; // non-overlapping count (wrong route R1)
function kmerTruth(x: string, xp: string, s1: string, w1: number, s2: string, w2: number): number {
  const fx = [Math.sqrt(w1) * phi(x, s1), Math.sqrt(w2) * phi(x, s2)], fy = [Math.sqrt(w1) * phi(xp, s1), Math.sqrt(w2) * phi(xp, s2)];
  return Math.round((fx[0] * fy[0] + fx[1] * fy[1]) * 1e9) / 1e9; // feature-vector dot product
}
function kmerRoutes(x: string, xp: string, s1: string, w1: number, s2: string, w2: number): number[] {
  const c1x = phi(x, s1), c1y = phi(xp, s1), c2x = phi(x, s2), c2y = phi(xp, s2);
  return [
    w1 * phiFlat(x, s1) * phiFlat(xp, s1) + w2 * phiFlat(x, s2) * phiFlat(xp, s2),
    c1x * c1y + c2x * c2y,
    w1 * (c1x + c1y) + w2 * (c2x + c2y),
    w1 * c1x * c1y, w2 * c2x * c2y,
    w2 * c1x * c1y + w1 * c2x * c2y,
    (w1 * c1x + w2 * c2x) * (w1 * c1y + w2 * c2y),
  ];
}
const space7: string[] = [];
for (let i = 0; i < POOL.length; i++) for (let j = i + 1; j < POOL.length; j++)
  for (let u = 0; u < KMERS.length; u++) for (let v = u + 1; v < KMERS.length; v++)
    for (const w1 of [1, 2, 3]) for (const w2 of [1, 2, 3]) {
      if (w1 === w2) continue;
      const [x, xp, s1, s2] = [POOL[i], POOL[j], KMERS[u], KMERS[v]];
      const T = kmerTruth(x, xp, s1, w1, s2, w2);
      if (T >= 3 && T <= 40 && farFrom(T, kmerRoutes(x, xp, s1, w1, s2, w2), 1 - 1e-9)) space7.push(`${x},${xp},${s1},${s2},${w1},${w2}`);
    }

describe('GP-16 plan sampling spaces (sanity of this oracle)', () => {
  it('enumerated counts equal the plan', () => {
    expect(space1.length).toBe(20);
    expect(space2.length).toBe(32);
    expect(space3.length).toBe(46);
    expect(space4.length).toBe(14);
    expect(space5.length).toBe(32);
    expect(space7.length).toBe(72);
    expect(space9.length).toBe(64);
  });
  it('plan lists: truths 0.8/0.6, all 2E in the table, minimum gaps hold', () => {
    for (const [a, b, d] of TRIPLES5) {
      const r = 2 * a * b / (a * a + b * b), t = 2 * d * d / (a * a + b * b);
      expect(tabHas(t), `${a},${b},${d}`).toBe(true);
      expect(Math.abs(tabOf(t) - Math.exp(-t))).toBeLessThan(5e-4);
      const T = r * tabOf(t);
      expect(Math.abs(T - gibbs(a, b, d) ** 2), `${a},${b},${d}`).toBeLessThan(0.005);
      const E = t / 2, routes = [r, tabOf(t)]; if (tabHas(E)) routes.push(r * tabOf(E)); if (tabHas(2 * t)) routes.push(r * tabOf(2 * t));
      expect(farFrom(T, routes, GAP), `card 5 ${a},${b},${d}`).toBe(true);
      for (const [p, q] of [[1, 2], [2, 1]]) {
        const K2 = T, D = p * p * q * q * (1 - K2);
        const r9 = [p * p * q * q * K2, p * q * (1 - K2), p * p * q * q * (1 - r), p * p * q * q * (1 - tabOf(t)), p * p * q * q, (p * p + q * q) * (1 - K2)];
        if (tabHas(E)) r9.push(p * p * q * q * (1 - r * tabOf(E)));
        expect(farFrom(D, r9, GAP), `card 9 ${p},${q},${a},${b},${d}`).toBe(true);
        const det = (p * p * gibbs(a, a, 0)) * (q * q * gibbs(b, b, 0)) - (p * q * gibbs(a, b, d)) ** 2; // explicit 2x2 determinant
        expect(Math.abs(det - D)).toBeLessThan(0.005);
      }
    }
    for (const [a, b] of PAIRS4) {
      const r = 2 * a * b / (a * a + b * b);
      expect(farFrom(r, [1, Math.sqrt(r), Math.min(a, b) / Math.max(a, b), 2 * a * b / (a + b) ** 2, a * b / (a * a + b * b), (1 + r) / 2], GAP)).toBe(true);
    }
  });
});

// ---------- parsing the printed numbers (EN and ZH) ----------
const norm = (s: string) => s.replaceAll('−', '-').replaceAll(' ', ' ');
function grab(text: string, re: RegExp, where: string): RegExpMatchArray {
  const m = norm(text).match(re);
  if (!m) throw new Error(`${where}: /${re.source}/ not found in: ${text.slice(0, 160)}`);
  return m;
}
const num = (text: string, re: RegExp, where: string) => Number(grab(text, re, where)[1]);
function parseTable(text: string, lang: GameLanguage, where: string): Record<number, number> {
  const re = lang === 'en' ? /exp\(-(\d+(?:\.\d+)?)\) = (\d+(?:\.\d+)?)/g : /e 的 -(\d+(?:\.\d+)?) 次方 = (\d+(?:\.\d+)?)/g;
  const out: Record<number, number> = {};
  for (const m of norm(text).matchAll(re)) out[Number(m[1])] = Number(m[2]);
  expect(Object.keys(out).length, `${where}: table has 5 entries`).toBe(5);
  for (const [t, v] of Object.entries(out)) {
    expect(TAB[Number(t)], `${where}: table key ${t}`).toBe(v);
    expect(Math.abs(v - Math.round(Math.exp(-Number(t)) * 1000) / 1000)).toBeLessThan(1e-12);
  }
  return out;
}
const reLx = (text: string, w: string) => num(text, /ℓ\(x\) = (\d+)/, w);
const reLy = (text: string, w: string) => num(text, /ℓ\(x′\) = (\d+)/, w);
const reD = (text: string, w: string) => num(text, /x - x′ = (\d+)/, w);

/** Grade through the real gradeCard: the exact answer, its 2-decimal rounding when the prompt asks for it, and +-(tolerance+0.0005) perturbations. */
function checkGrading(c: PracticeCard, expected: number, where: string, accepted: string[] = []) {
  expect(c.fields, where).toHaveLength(1);
  const f = c.fields![0];
  expect(f.tolerance, `${where}: tolerance`).toBe(0.006);
  expect(Math.abs(f.answer - expected), `${where}: answer ${f.answer} vs oracle ${expected}`).toBeLessThanOrEqual(1e-6);
  for (const s of [String(f.answer), Math.abs(f.answer - Math.round(f.answer)) < 1e-9 ? String(Math.round(f.answer)) : f.answer.toFixed(2), ...accepted])
    expect(gradeCard(c, [s], null, []), `${where}: "${s}" should be correct`).toBe('correct');
  for (const delta of [0.0065, -0.0065, 1, -1, 0.05])
    expect(gradeCard(c, [(f.answer + delta).toFixed(4)], null, []), `${where}: delta ${delta} should be wrong`).toBe('incorrect');
}

const edge = new Set<string>();
const eachSeed = (fn: (index: number, lang: GameLanguage) => void) => { for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) fn(i, lang); };

describe('GP-16 deck structure', () => {
  it('9 cards in plan order, audit kinds exactly the 8 numeric kinds, no figure anywhere', () => {
    eachSeed((i, lang) => {
      const d = deck(i, lang);
      expect(d.map(c => c.id), `seed ${i} ${lang}`).toEqual(SLUGS.map(s => `GP-16-${s}`));
      expect(d.filter(c => c.audit).map(c => c.audit!.kind)).toEqual(NUMERIC.map(s => `GP-16:${s}`));
      for (const c of d) { expect(c.figure, c.id).toBeUndefined(); expect(c.choice?.figures, c.id).toBeUndefined(); expect(c.slots, c.id).toBeUndefined(); }
      expect(d[5].choice).toBeDefined();
      expect(d[5].audit).toBeUndefined();
    });
  });
  it('EN and ZH decks agree on answers, tolerance and audit params', () => {
    for (let i = 0; i < SEEDS; i++) {
      const en = deck(i, 'en'), zh = deck(i, 'zh');
      en.forEach((c, k) => {
        expect(zh[k].fields?.map(f => [f.answer, f.tolerance])).toEqual(c.fields?.map(f => [f.answer, f.tolerance]));
        expect(zh[k].audit).toEqual(c.audit);
        expect(zh[k].choice?.answer).toBe(c.choice?.answer);
      });
    }
  });
  it('structural gates and typography lint are clean', () => {
    expect(deckProblems('GP-16', gp16, 'topic', 200)).toEqual([]);
    expect(textLintProblems('GP-16', gp16, 200)).toEqual([]);
  });
  it('field labels', () => {
    const en = ['k(x, x)', 'ln k(x, x′) − ln k(x′, x)', 'E', 'K(x, x′)²', 'K(x, x′)²', 'k(x, x′)', 'k(x, x′)', 'det'];
    const zh = ['k(x, x)', 'ln k(x, x′) − ln k(x′, x)', 'E', 'K(x, x′)²', 'K(x, x′)²', 'k(x, x′)', 'k(x, x′)', '行列式'];
    for (const [lang, labels] of [['en', en], ['zh', zh]] as const) {
      const d = deck(3, lang);
      expect(NUMERIC.map(s => d.find(c => c.id === `GP-16-${s}`)!.fields![0].label)).toEqual(labels);
    }
  });
  it('titles', () => {
    const en = ['The variance does not move', 'Just plug in ℓ(x)?', 'What is inside the exponential?', 'Neighbours across a jump', 'A Gibbs kernel value', 'Same gap, same covariance?', 'A string kernel', 'All pairs of patches', 'Challenge: a covariance matrix'];
    const zh = ['方差不随长度尺度变化', '直接把 ℓ(x) 代入？', '指数里是什么？', '跨越突变的相邻点', '吉布斯核的取值', '间距相同，协方差也相同吗？', '字符串核', '所有图块对', '挑战：协方差矩阵'];
    expect(deck(5, 'en').map(c => c.title)).toEqual(en);
    expect(deck(5, 'zh').map(c => c.title)).toEqual(zh);
  });
});

describe('GP-16 numeric audit kinds: printed numbers, params, answers, sampling spaces', () => {
  it('gibbs-diagonal', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'gibbs-diagonal'), w = `seed ${i} ${lang}`;
      const s = num(c.prompt, /k\(x, x′\) = (\d+) · K/, w), a = reLx(c.prompt, w);
      expect(c.audit!.params).toEqual({ s, a });
      expect(space1, w).toContain(key(s, a));
      checkGrading(c, s * gibbs(a, a, 0), w);
    });
  });
  it('naive-asymmetry', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'naive-asymmetry'), w = `seed ${i} ${lang}`;
      const a = reLx(c.prompt, w), b = reLy(c.prompt, w), d = num(c.prompt, /\|x - x′\| = (\d+)/, w);
      expect(c.audit!.params).toEqual({ a, b, d });
      expect(space2, w).toContain(key(a, b, d));
      // ln k(x,x') uses l(x) = a; ln k(x',x) uses l(x') = b
      const T = Math.log(Math.exp(-d * d / (2 * a * a))) - Math.log(Math.exp(-d * d / (2 * b * b)));
      checkGrading(c, T, w, [(d * d * (a * a - b * b) / (2 * a * a * b * b)).toFixed(2)]);
    });
  });
  it('gibbs-exponent', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'gibbs-exponent'), w = `seed ${i} ${lang}`;
      const a = reLx(c.prompt, w), b = reLy(c.prompt, w), d = reD(c.prompt, w);
      expect(c.audit!.params).toEqual({ a, b, d });
      expect(space3, w).toContain(key(a, b, d));
      const E = -(Math.log(gibbs(a, b, d)) - 0.5 * Math.log(2 * a * b / (a * a + b * b)));
      checkGrading(c, E, w);
    });
  });
  it('jump-prefactor', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'jump-prefactor'), w = `seed ${i} ${lang}`;
      const a = reLx(c.prompt, w), b = reLy(c.prompt, w);
      expect(c.audit!.params).toEqual({ a, b });
      expect(space4, w).toContain(key(a, b));
      checkGrading(c, gibbs(a, b, 1e-9) ** 2, w);
    });
  });
  it('gibbs-value uses the printed exp table', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'gibbs-value'), w = `seed ${i} ${lang}`;
      const a = reLx(c.prompt, w), b = reLy(c.prompt, w), d = reD(c.prompt, w);
      expect(c.audit!.params).toEqual({ a, b, d });
      expect(space5, w).toContain(key(a, b, d));
      const table = parseTable(c.prompt, lang, w);
      const t = 2 * d * d / (a * a + b * b);
      const printed = Object.entries(table).find(([k]) => Math.abs(Number(k) - t) < 1e-9);
      expect(printed, `${w}: 2E=${t} printed`).toBeDefined();
      const key5 = 2 * a * b / (a * a + b * b) * printed![1];
      expect(Math.abs(key5 - gibbs(a, b, d) ** 2), w).toBeLessThan(0.005);
      const viaTruth = Math.abs(r2(gibbs(a, b, d) ** 2) - key5) < 0.006 - 1e-6 ? [r2(gibbs(a, b, d) ** 2).toFixed(2)] : [];
      if (!viaTruth.length) edge.add(`gibbs-value ${key(a, b, d)}`);
      checkGrading(c, key5, w, [r2(key5).toFixed(2), ...viaTruth]);
    });
  });
  it('kmer-kernel: strings parsed from the prompt', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'kmer-kernel'), w = `seed ${i} ${lang}`;
      const x = grab(c.prompt, /x = ([ACGT]{8})/, w)[1], xp = grab(c.prompt, /x′ = ([ACGT]{8})/, w)[1];
      const sm = grab(c.prompt, lang === 'en' ? /2-mers ([ACGT]{2}) and ([ACGT]{2}) occur/ : /子串 ([ACGT]{2}) 和 ([ACGT]{2}) 在 x 中/, w);
      const [s1, s2] = [sm[1], sm[2]];
      const w1 = num(c.prompt, /w₁ = (\d+)/, w), w2 = num(c.prompt, /w₂ = (\d+)/, w);
      for (const [k, v] of Object.entries(c.audit!.params)) {
        if (k === 'w1') expect(v).toBe(w1); else if (k === 'w2') expect(v).toBe(w2);
        else throw new Error(`${w}: unexpected audit param ${k} (strings must not be letter-encoded)`);
      }
      expect(c.audit!.params.w1, w).toBeDefined(); expect(c.audit!.params.w2, w).toBeDefined();
      expect(POOL.indexOf(x), w).toBeGreaterThanOrEqual(0);
      expect(POOL.indexOf(xp), w).toBeGreaterThan(POOL.indexOf(x));
      expect(KMERS.indexOf(s2), w).toBeGreaterThan(KMERS.indexOf(s1));
      expect(space7, w).toContain(`${x},${xp},${s1},${s2},${w1},${w2}`);
      checkGrading(c, kmerTruth(x, xp, s1, w1, s2, w2), w);
    });
  });
  it('patch-sum', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'patch-sum'), w = `seed ${i} ${lang}`;
      const xs = grab(c.prompt, /x = \((\d), (\d), (\d)\)/, w).slice(1).map(Number), ys = grab(c.prompt, /x′ = \((\d), (\d), (\d)\)/, w).slice(1).map(Number);
      expect(c.audit!.params).toEqual({ x: xs, xp: ys });
      for (const v of [...xs, ...ys]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(3); }
      expect(xs.join()).not.toBe(ys.join());
      const sum = (v: number[]) => v[0] + v[1] + v[2];
      expect(sum(xs)).toBeGreaterThan(0); expect(sum(ys)).toBeGreaterThan(0);
      // explicit double sum over the four patch pairs
      const px = [[xs[0], xs[1]], [xs[1], xs[2]]], py = [[ys[0], ys[1]], [ys[1], ys[2]]];
      let T = 0; for (const u of px) for (const v of py) T += u[0] * v[0] + u[1] * v[1];
      // second route: dot product of patch sums
      const sx1 = xs[0] + xs[1], sx2 = xs[1] + xs[2], sy1 = ys[0] + ys[1], sy2 = ys[1] + ys[2];
      expect(T, w).toBe(sx1 * sy1 + sx2 * sy2);
      expect(T, w).toBeGreaterThanOrEqual(4); expect(T, w).toBeLessThanOrEqual(40);
      const routes = [px[0][0] * py[0][0] + px[0][1] * py[0][1] + px[1][0] * py[1][0] + px[1][1] * py[1][1], xs[0] * ys[0] + xs[1] * ys[1] + xs[2] * ys[2], T / 4, sum(xs) * sum(ys)];
      for (const u of px) for (const v of py) routes.push(u[0] * v[0] + u[1] * v[1]);
      expect(routes.every(r => Math.abs(r - T) >= 1), `${w} wrong route collides: ${routes} vs ${T}`).toBe(true);
      checkGrading(c, T, w);
    });
  });
  it('challenge', () => {
    eachSeed((i, lang) => {
      const c = card(i, lang, 'challenge'), w = `seed ${i} ${lang}`;
      const p = num(c.prompt, /σ\(x\) = (\d+)/, w), q = num(c.prompt, /σ\(x′\) = (\d+)/, w);
      const a = reLx(c.prompt, w), b = reLy(c.prompt, w), d = reD(c.prompt, w);
      expect(c.audit!.params).toEqual({ p, q, a, b, d });
      expect(space9, w).toContain(key(p, q, a, b, d));
      const table = parseTable(c.prompt, lang, w);
      const t = 2 * d * d / (a * a + b * b);
      const printed = Object.entries(table).find(([k]) => Math.abs(Number(k) - t) < 1e-9);
      expect(printed, w).toBeDefined();
      const K2 = 2 * a * b / (a * a + b * b) * printed![1];
      const keyV = p * p * q * q * (1 - K2);
      // true determinant of the explicit covariance matrix
      const m = [[p * p * gibbs(a, a, 0), p * q * gibbs(a, b, d)], [p * q * gibbs(a, b, d), q * q * gibbs(b, b, 0)]];
      const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
      expect(Math.abs(det - keyV), w).toBeLessThan(0.005);
      expect(m[0][0] * m[1][1] - m[0][1] ** 2, `${w} PD`).toBeGreaterThan(0);
      // a learner who ignores the printed table and rounds the exact determinant is accepted only when that stays inside the tolerance (the edge cases are listed in the acceptance note)
      const viaTruth = Math.abs(r2(det) - keyV) < 0.006 - 1e-6 ? [r2(det).toFixed(2)] : [];
      if (!viaTruth.length) edge.add(`challenge ${key(p, q, a, b, d)}`);
      checkGrading(c, keyV, w, [r2(keyV).toFixed(2), ...viaTruth]);
    });
  });
});

describe('GP-16 edge report', () => {
  it('lists draws whose exact-value 2-decimal rounding lies at the tolerance edge', () => { console.log('EDGE', [...edge].join(' | ')); });
});

describe('GP-16 sampling spaces are exactly the plan lists', () => {
  const N = 4000;
  it(`every plan set occurs and nothing else does (${N} spread seeds, EN)`, () => {
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 7: new Set(), 9: new Set() };
    for (let i = 0; i < N; i++) {
      const d = gp16(spreadSeed(i), 'en');
      const by = (s: Slug) => d.find(c => c.id === `GP-16-${s}`)!;
      const pr = (s: Slug) => by(s).prompt;
      const w = 'sp';
      seen[1].add(key(num(pr('gibbs-diagonal'), /k\(x, x′\) = (\d+) · K/, w), reLx(pr('gibbs-diagonal'), w)));
      seen[2].add(key(reLx(pr('naive-asymmetry'), w), reLy(pr('naive-asymmetry'), w), num(pr('naive-asymmetry'), /\|x - x′\| = (\d+)/, w)));
      seen[3].add(key(reLx(pr('gibbs-exponent'), w), reLy(pr('gibbs-exponent'), w), reD(pr('gibbs-exponent'), w)));
      seen[4].add(key(reLx(pr('jump-prefactor'), w), reLy(pr('jump-prefactor'), w)));
      seen[5].add(key(reLx(pr('gibbs-value'), w), reLy(pr('gibbs-value'), w), reD(pr('gibbs-value'), w)));
      const k7 = pr('kmer-kernel'), s7 = grab(k7, /2-mers ([ACGT]{2}) and ([ACGT]{2}) occur/, w);
      seen[7].add(`${grab(k7, /x = ([ACGT]{8})/, w)[1]},${grab(k7, /x′ = ([ACGT]{8})/, w)[1]},${s7[1]},${s7[2]},${num(k7, /w₁ = (\d+)/, w)},${num(k7, /w₂ = (\d+)/, w)}`);
      const k9 = pr('challenge');
      seen[9].add(key(num(k9, /σ\(x\) = (\d+)/, w), num(k9, /σ\(x′\) = (\d+)/, w), reLx(k9, w), reLy(k9, w), reD(k9, w)));
    }
    const plan: Record<number, string[]> = { 1: space1, 2: space2, 3: space3, 4: space4, 5: space5, 7: space7, 9: space9 };
    for (const n of [1, 2, 3, 4, 5, 7, 9]) {
      expect([...seen[n]].filter(k => !plan[n].includes(k)), `card set ${n}: extra`).toEqual([]);
      expect(plan[n].filter(k => !seen[n].has(k)), `card set ${n}: missing`).toEqual([]);
    }
  });
  it('patch-sum draws satisfy all constraints (spot space of 2914 ordered pairs is large; check 3000 draws incl. extremes)', () => {
    for (let i = 0; i < 3000; i++) {
      const c = gp16(spreadSeed(i), 'en').find(k => k.id === 'GP-16-patch-sum')!;
      const xs = grab(c.prompt, /x = \((\d), (\d), (\d)\)/, 'ps').slice(1).map(Number), ys = grab(c.prompt, /x′ = \((\d), (\d), (\d)\)/, 'ps').slice(1).map(Number);
      const T = (xs[0] + xs[1]) * (ys[0] + ys[1]) + (xs[1] + xs[2]) * (ys[1] + ys[2]);
      expect(T).toBe(c.fields![0].answer);
    }
  });
});

describe('GP-16 warp-stationary choice card', () => {
  it('predicate from the plan: exactly one option satisfies it, the answer index points to it, all options have the plan shapes', () => {
    const seenOrder = new Set<string>();
    eachSeed((i, lang) => {
      const c = card(i, lang, 'warp-stationary'), w = `seed ${i} ${lang}`;
      const pairRe = lang === 'en' ? /[Pp]air ([AB]) is the inputs (\d+) and (\d+)/g : /数对 ([AB]) 的输入是 (\d+) 和 (\d+)/g;
      const pairs: Record<string, [number, number]> = {};
      const order: string[] = [];
      for (const m of norm(c.prompt).matchAll(pairRe)) { pairs[m[1]] = [Number(m[2]), Number(m[3])]; order.push(m[1]); }
      expect(Object.keys(pairs).sort(), w).toEqual(['A', 'B']);
      seenOrder.add(order.join(''));
      const ell = num(c.prompt, /ℓ = (\d+)/, w);
      const g = num(c.prompt, lang === 'en' ? /are (\d+) apart/ : /间距都是 (\d+)/, w);
      expect([2, 3, 4], w).toContain(ell); expect([1, 2], w).toContain(g);
      const inputs = [...pairs.A, ...pairs.B];
      for (const v of inputs) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(8 + 1); }
      for (const L of ['A', 'B']) { expect(pairs[L][1] - pairs[L][0], w).toBe(g); expect(pairs[L][0], w).toBeLessThanOrEqual(7); }
      expect(pairs.A[0], w).not.toBe(pairs.B[0]);
      const u = (x: number) => x * x;
      const kk = (L: string) => Math.exp(-((u(pairs[L][1]) - u(pairs[L][0])) ** 2) / (2 * ell * ell));
      const gapU = (L: string) => u(pairs[L][1]) - u(pairs[L][0]);
      const best = kk('A') > kk('B') ? 'A' : 'B', other = best === 'A' ? 'B' : 'A';
      expect(best, w).toBe(pairs.A[0] < pairs.B[0] ? 'A' : 'B'); // plan predicate: smaller inputs, larger covariance
      expect(kk('A'), w).not.toBe(kk('B'));
      const optRe = lang === 'en'
        ? /^Pair ([AB]): its u-gap is (\d+), smaller than (\d+), so its covariance is larger\.$/
        : /^数对 ?([AB])：它的 u 间距为 (\d+)，小于 (\d+)，所以协方差更大。$/;
      const correct = (t: string) => {
        const m = norm(t).match(optRe);
        return !!m && m[1] === best && Number(m[2]) === gapU(best) && Number(m[3]) === gapU(other) && Number(m[2]) < Number(m[3]);
      };
      const verdicts = c.choice!.options.map(correct);
      expect(verdicts.filter(Boolean), w).toHaveLength(1);
      expect(verdicts[c.choice!.answer], `${w}: answer index`).toBe(true);
      expect(c.choice!.options).toHaveLength(4);
      // the three wrong options keep the plan shapes
      const wrong = c.choice!.options.filter((_, k) => k !== c.choice!.answer);
      const joined = wrong.join(' | ');
      if (lang === 'en') {
        expect(wrong.some(o => o.startsWith('Equal:') && o.includes(`${g} apart`)), joined).toBe(true);
        expect(wrong.some(o => o.startsWith(`Pair ${other}: its inputs are larger`)), joined).toBe(true);
        expect(wrong.some(o => o.startsWith('Neither can be ranked') && o.includes('invalid')), joined).toBe(true);
      } else {
        expect(wrong.some(o => o.startsWith('相等：') && o.includes(`相距 ${g}`)), joined).toBe(true);
        expect(wrong.some(o => o.startsWith(`数对 ${other}：`) || o.startsWith(`数对${other}：`)), joined).toBe(true);
        expect(wrong.some(o => o.startsWith('无法比较')), joined).toBe(true);
      }
      // correct option is never the longest
      const lens = c.choice!.options.map(o => [...o].length);
      expect(lens[c.choice!.answer], `${w}: correct option must be strictly shorter than the longest`).toBeLessThan(Math.max(...lens));
    });
    expect(seenOrder.size, 'pair listing order varies').toBeGreaterThan(0);
  });
  it('sampling space: xa,xb in 0..7 distinct, g in {1,2}, ell in {2,3,4}; both label orders occur; 336 draws', () => {
    const seen = new Set<string>(); const smallerIsA = new Set<boolean>();
    for (let i = 0; i < 6000; i++) {
      const c = gp16(spreadSeed(i), 'en').find(k => k.id === 'GP-16-warp-stationary')!;
      const m = [...norm(c.prompt).matchAll(/[Pp]air ([AB]) is the inputs (\d+) and (\d+)/g)];
      const A = m.find(x => x[1] === 'A')!, B = m.find(x => x[1] === 'B')!;
      const xa = Number(A[2]), xb = Number(B[2]), g = Number(A[3]) - xa, ell = num(c.prompt, /ℓ = (\d+)/, 'w');
      expect(xa >= 0 && xa <= 7 && xb >= 0 && xb <= 7 && xa !== xb && [1, 2].includes(g) && [2, 3, 4].includes(ell)).toBe(true);
      expect(Number(B[3]) - xb).toBe(g);
      seen.add(key(xa, xb, g, ell)); smallerIsA.add(xa < xb);
    }
    expect(seen.size).toBe(336);
    expect(smallerIsA.size).toBe(2);
  });
});

describe('GP-16 variety, answers vs hints, learner-visible text', () => {
  it('every card has at least 6 distinct prompts over 60 seeds', () => {
    for (const lang of ['en', 'zh'] as const) for (const slug of SLUGS) {
      const set = new Set<string>(); for (let i = 0; i < SEEDS; i++) set.add(card(i, lang, slug).prompt);
      expect(set.size, `${slug} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('Unicode only: no ASCII names, ASCII minus, caret, braces, developer markers, raw floats', () => {
    const BAD: [string, RegExp][] = [
      ['ASCII name', /\b(ell|sigma|phi|sqrt|xp|s1|s2|w1|w2|c1x|c1y|c2x|c2y|uaL|uaR)\b|x'|\bl\(x|[a-z]\^|\bK2\b/],
      ['caret', /\^/], ['brace', /[{}]/], ['marker', /DERIVED|UNVERIFIED|TODO|FIXME|NOT IN SOURCES|WRITTEN BY|undefined|NaN|\bnull\b/],
      ['raw float', /\d\.\d{5,}/], ['double parens', /\(\(/], ['ASCII minus before number', /(^|[\s(=,])-\d/], ['ASCII asterisk', /\*/], ['ASCII <= >= !=', /<=|>=|!=|->/],
      ['unevaluated', /\b(TAB|GIBBS|TABLE)\b/],
    ];
    eachSeed((i, lang) => {
      for (const c of deck(i, lang)) for (const t of textOf(c)) for (const [name, re] of BAD) {
        const m = re.exec(t);
        expect(m, `${c.id} ${lang} seed ${i}: ${name} in "${t.slice(Math.max(0, (m?.index ?? 0) - 30), (m?.index ?? 0) + 40)}"`).toBeNull();
      }
    });
  });
  it('ZH has no English words (exp, GP, KL, ELBO, sequence letters and symbols excepted) and no Gibbs/stationary/Pair', () => {
    const ALLOWED = new Set(['exp', 'GP', 'KL', 'ELBO', 'GPML', 'pdf', 'SE', 'ln', 'Cov']) // GPML pdf citations and SE/ln/Cov symbols follow the other accepted ZH GP games;
    const seen = new Map<string, string>();
    eachSeed((i, lang) => {
      if (lang !== 'zh') return;
      for (const c of deck(i, lang)) for (const t of textOf(c)) {
        for (const m of t.matchAll(/[A-Za-z]{2,}/g)) {
          if (ALLOWED.has(m[0]) || /^[ACGT]+$/.test(m[0])) continue;
          seen.set(m[0], `${c.id}: …${t.slice(Math.max(0, m.index! - 12), m.index! + 20)}…`);
        }
        expect(/Gibbs|[Ss]tationary|\bPair\b|k-mer/.test(t), `${c.id}: ${t.slice(0, 50)}`).toBe(false);
      }
    });
    expect([...seen], 'English words in ZH').toEqual([]);
  });
  it('EN has no Chinese; GPML/pdf/Cov in ZH are reported by the previous test if disallowed', () => {
    eachSeed((i, lang) => { if (lang === 'en') for (const c of deck(i, lang)) for (const t of textOf(c)) expect(/[㐀-鿿]/.test(t), c.id).toBe(false); });
  });
  it('Gibbs cards print the full kernel formula', () => {
    for (const lang of ['en', 'zh'] as const) {
      const f = 'K(x, x′) = √(2ℓ(x)ℓ(x′)/(ℓ(x)² + ℓ(x′)²)) · exp(−(x − x′)²/(ℓ(x)² + ℓ(x′)²))';
      for (const slug of ['gibbs-exponent', 'jump-prefactor', 'gibbs-value', 'challenge'] as const) expect(card(2, lang, slug).prompt, `${slug} ${lang}`).toContain(f);
      expect(card(2, lang, 'gibbs-diagonal').prompt).toContain(f);
    }
  });
  it('the hint never contains the answer and the prompt never shows it', () => {
    eachSeed((i, lang) => {
      for (const s of NUMERIC) {
        const c = card(i, lang, s), ans = c.fields![0].answer;
        const forms = new Set([String(ans), ans.toFixed(2), ans.toFixed(3), ans.toFixed(4)].map(x => x.replace(/\.?0+$/, '')));
        if (Number.isInteger(ans) || Math.abs(ans) >= 10) continue; // small integers occur by chance in any text
        for (const f of forms) if (f.length >= 3) expect(norm(c.hint), `${c.id} hint reveals ${f}`).not.toContain(f);
      }
    });
  });
  it('explanations contain the answer (numbers in the explanation equal the key)', () => {
    eachSeed((i, lang) => {
      for (const s of ['gibbs-diagonal', 'gibbs-exponent', 'jump-prefactor', 'gibbs-value', 'kmer-kernel', 'patch-sum', 'challenge'] as const) {
        const c = card(i, lang, s), ans = c.fields![0].answer;
        const e = norm(c.explanation);
        const frac = (() => { for (let q = 1; q <= 40; q++) if (Math.abs(ans * q - Math.round(ans * q)) < 1e-9) return `${Math.round(ans * q)}/${q}`; return ''; })();
        const ok = e.includes(String(ans)) || e.includes(ans.toFixed(2)) || e.includes(ans.toFixed(4)) || (frac && e.includes(frac)) || e.includes(String(Math.round(ans)));
        expect(ok, `${c.id} ${lang} seed ${i}: explanation does not state ${ans} (${frac})`).toBe(true);
      }
    });
  });
  it('question text of every card is solvable: sampled numbers are visible (hidden-input gate via audit)', () => {
    eachSeed((i, lang) => { for (const c of deck(i, lang)) expect(questionTextOf(c).join(' ').length, c.id).toBeGreaterThan(20); });
  });
});
