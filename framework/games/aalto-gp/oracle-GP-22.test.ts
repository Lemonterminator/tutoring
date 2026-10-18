import { describe, expect, it } from 'vitest';
import { gp22 } from './games/gp22';
import { spreadSeed, deckProblems, textLintProblems } from '../mit-multivariable-calculus/deck-invariants';
import { simpson } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-22 (sparse variational GPs), written from the approved plan and its audit section only.
 * Rational arithmetic is exact; the second route for each kind is explicit conditioning / matrix algebra / quadrature.
 */
const SEEDS = 60;
const COVERAGE_SEEDS = 40000;
const LANGS: GameLanguage[] = ['en', 'zh'];
const cardsOf = (seed: number, lang: GameLanguage) => gp22(seed, lang);
const byId = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-22-${slug}`);
  if (!card) throw new Error(`missing card ${slug}`);
  return card;
};

// ---------- exact rationals ----------
type Fr = { n: number; d: number };
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fr = (n: number, d = 1): Fr => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
const fnum = (x: number): Fr => {
  for (const d of [1, 2, 4, 5, 8, 10, 16, 20, 25, 40, 100, 1000]) if (Math.abs(x * d - Math.round(x * d)) < 1e-9) return fr(Math.round(x * d), d);
  throw new Error(`not rational: ${x}`);
};
const add = (a: Fr, b: Fr) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Fr, b: Fr) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Fr, b: Fr) => fr(a.n * b.n, a.d * b.d);
const div = (a: Fr, b: Fr) => fr(a.n * b.d, a.d * b.n);
const val = (a: Fr) => a.n / a.d;
const sq = (a: Fr) => mul(a, a);
const sum = (...xs: Fr[]) => xs.reduce(add, fr(0));
const OKDEN = new Set([1, 2, 4, 5, 8, 10]);
const denOk = (a: Fr) => OKDEN.has(a.d);
const exactStr = (a: Fr) => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`);
const cartesian = <T,>(...lists: T[][]): T[][] => lists.reduce<T[][]>((acc, list) => acc.flatMap(p => list.map(x => [...p, x])), [[]]);
const distinctRoutes = (truth: Fr, routes: Fr[], gap: number) => routes.every(r => Math.abs(val(r) - val(truth)) >= gap - 1e-12);

// ---------- text helpers ----------
const clean = (s: string) => s.replaceAll('−', '-');
const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
function after(text: string, label: string): number {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?<![\\wᵢ′])${esc} = ${NUM}`).exec(clean(text));
  if (!m) throw new Error(`label "${label}" not found in: ${text.slice(0, 200)}`);
  return Number(m[1]);
}
function nums(s: string): number[] { return [...clean(s).matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0])); }
const between = (text: string, from: RegExp, to: RegExp): string => {
  const a = from.exec(text); if (!a) throw new Error(`no ${from}`);
  const rest = text.slice(a.index + a[0].length); const b = to.exec(rest);
  return b ? rest.slice(0, b.index) : rest;
};
const numToText = (x: number) => String(Number(x.toFixed(6))).replace('-', '−');

// ---------- plan sampling spaces (enumerated independently from the plan) ----------
type Key = string;
const keyOf = (...xs: number[]) => xs.map(x => Number(x.toFixed(6))).join('|');

const costSpace = (): Set<Key> => new Set(cartesian([10, 20, 50, 100], [4, 5, 10]).map(([M, r]) => keyOf(r * M, M)));
const costTruth = (N: number, M: number) => div(fr(N ** 3), fr(N * M * M));
const costRoutes = (N: number, M: number): Fr[] => {
  const r = fr(N, M);
  return [r, mul(r, mul(r, r)), div(fr(N ** 3), fr(M * M)), div(fr(N * N), fr(M)), div(fr(1), mul(r, r)), fr(N * M * M), fr(N ** 3)];
};

const qvarTruth = (kii: Fr, c: Fr, kuu: Fr, S: Fr) => add(sub(kii, div(sq(c), kuu)), div(mul(sq(c), S), sq(kuu)));
const qvarRoutes = (kii: Fr, c: Fr, kuu: Fr, S: Fr): Fr[] => [
  sub(kii, div(sq(c), kuu)), div(mul(sq(c), S), sq(kuu)), div(mul(sq(c), S), kuu),
  add(sub(kii, div(sq(c), kuu)), S), add(kii, div(mul(sq(c), S), sq(kuu))), S,
];
const qvarSets = (): number[][] => cartesian([1, 2], [0.5, 1, 1.5], [1, 2, 4], [0.5, 1, 2, 4]).filter(([kii, c, kuu, S]) => {
  const [a, b, d, s] = [fnum(kii), fnum(c), fnum(kuu), fnum(S)];
  return kii * kuu > c * c && c !== kuu && denOk(qvarTruth(a, b, d, s)) && distinctRoutes(qvarTruth(a, b, d, s), qvarRoutes(a, b, d, s), 0.1);
});
const PLAN_QVAR_22: number[][] = [
  [1, .5, 1, .5], [1, .5, 1, 2], [1, .5, 1, 4], [1, .5, 2, 2], [1, .5, 2, 4], [1, 1, 2, .5], [1, 1, 2, 1], [1, 1, 2, 4], [1, 1, 4, 2], [1, 1.5, 4, 4],
  [2, .5, 1, .5], [2, .5, 1, 1], [2, .5, 1, 2], [2, .5, 1, 4], [2, .5, 2, 4], [2, 1, 2, .5], [2, 1, 2, 1], [2, 1, 2, 4], [2, 1.5, 2, 4], [2, 1, 4, 2], [2, 1, 4, 4], [2, 1.5, 4, 4],
];

const traceTruth = (kv: Fr, kuu: Fr, c: Fr[], s2: Fr) => div(sub(mul(fr(3), kv), div(sum(...c.map(sq)), kuu)), mul(fr(2), s2));
const traceRoutes = (kv: Fr, kuu: Fr, c: Fr[], s2: Fr): Fr[] => {
  const tr = sub(mul(fr(3), kv), div(sum(...c.map(sq)), kuu)); const two = mul(fr(2), s2);
  return [tr, div(tr, s2), div(mul(fr(3), kv), two), div(div(sum(...c.map(sq)), kuu), two), div(sub(mul(fr(3), kv), div(sum(...c), kuu)), two), div(sub(mul(fr(3), kv), sum(...c.map(sq))), two)];
};
const traceSets = (): number[][] => {
  const grid = [0, 0.5, 1, 1.5, 2]; const out: number[][] = [];
  for (const [kv, kuu, s2] of cartesian([1, 2, 4], [2, 4], [1, 2, 4]))
    for (let i = 0; i < 5; i++) for (let j = i; j < 5; j++) for (let k = j; k < 5; k++) {
      if (i === k) continue; const c = [grid[i], grid[j], grid[k]];
      if (!c.every(x => x * x < kv * kuu)) continue;
      const [a, b, cs, d] = [fnum(kv), fnum(kuu), c.map(fnum), fnum(s2)];
      const t = traceTruth(a, b, cs, d);
      if (denOk(t) && distinctRoutes(t, traceRoutes(a, b, cs, d), 0.1)) out.push([kv, kuu, ...c, s2]);
    }
  return out;
};

const wmTruth = (b: number, c: number, m1: number, m2: number, p2: number) => b * m1 + c * m2 + p2;
const wmRoutes = (a: number, b: number, c: number, m1: number, m2: number, p1: number, p2: number): Fr[] => [
  fr(b * m1 + c * m2), fr(c * m2 + p2), add(add(div(fr(-b * m1), fr(a * c)), div(fr(m2), fr(c))), fr(p2)), fr(m2 + p2), fr(a * m1 + p1),
];
const wmSets = (): number[][] => cartesian([1, 2], [-1, 1, 2], [1, 2], [-2, -1, 1, 2], [-2, -1, 0, 1, 2], [-1, 0, 1], [-2, -1, 1, 2]).filter(([a, b, c, m1, m2, p1, p2]) =>
  distinctRoutes(fr(wmTruth(b, c, m1, m2, p2)), wmRoutes(a, b, c, m1, m2, p1, p2), 0.1));

const wcTruth = (b: Fr, c: Fr, s1: Fr, s2: Fr) => add(mul(sq(b), s1), mul(sq(c), s2));
const wcRoutes = (b: Fr, c: Fr, s1: Fr, s2: Fr): Fr[] => [
  mul(sq(c), s2), add(mul(b, s1), mul(c, s2)), add(mul(sq(b), s1), mul(c, s2)), s2, mul(c, s2), mul(sq(b), s1), add(mul(sq(b), s2), mul(sq(c), s1)),
];
const wcSets = (): number[][] => cartesian([1, 2], [-2, -1, 1, 2, 3], [2, 3], [0.25, 0.5, 2, 3, 4], [0.25, 0.5, 2, 3, 4]).filter(([, b, c, s1, s2]) => {
  const [B, C, S1, S2] = [fnum(b), fnum(c), fnum(s1), fnum(s2)];
  return denOk(wcTruth(B, C, S1, S2)) && distinctRoutes(wcTruth(B, C, S1, S2), wcRoutes(B, C, S1, S2), 0.1);
});

const mbTruth = (N: number, l1: Fr, l2: Fr, kl: number) => sub(mul(fr(N, 2), add(l1, l2)), fr(kl));
const mbRoutes = (N: number, l1: Fr, l2: Fr, kl: number): Fr[] => {
  const s = add(l1, l2), scaled = mul(fr(N, 2), s);
  return [sub(s, fr(kl)), mul(fr(N, 2), sub(s, fr(kl))), sub(mul(fr(N), s), fr(kl)), add(scaled, fr(kl)), scaled];
};
const mbSets = (): number[][] => {
  const e = [0.5, 1, 1.5, 2, 3]; const out: number[][] = [];
  for (const N of [10, 20, 40, 100]) for (let i = 0; i < 5; i++) for (let j = i; j < 5; j++) for (const kl of [1, 2, 3, 4, 5]) {
    const [l1, l2] = [fnum(-e[i]), fnum(-e[j])];
    const t = mbTruth(N, l1, l2, kl);
    if (denOk(t) && distinctRoutes(t, mbRoutes(N, l1, l2, kl), 0.1)) out.push([N, -e[i], -e[j], kl]);
  }
  return out;
};

const chTruth = (kii: Fr, c: Fr, kuu: Fr, sp: Fr) => add(sub(kii, div(sq(c), kuu)), div(mul(sq(c), sp), kuu));
const chRoutes = (kii: Fr, c: Fr, kuu: Fr, L: Fr, sp: Fr): Fr[] => {
  const kt = sub(kii, div(sq(c), kuu));
  return [kt, add(kt, div(mul(sq(c), sp), sq(kuu))), add(kt, div(mul(mul(sq(c), sp), L), sq(kuu))), add(kt, mul(sq(c), sp)), add(kii, div(mul(sq(c), sp), kuu)), div(mul(sq(c), sp), kuu), add(kt, div(mul(c, sp), kuu))];
};
const chSets = (): number[][] => cartesian<number>([0, 1, 2], [1, 2, 4], [0.5, 1, 1.5, 2, 3], [0.25, 0.5, 2, 3, 4], [-1, 1, 2])
  .map(([idx, kii, c, sp, mp]) => { const [kuu, L] = [[4, 2], [9, 3], [16, 4]][idx]; return [kuu, L, kii, c, mp, sp]; })
  .filter(([kuu, L, kii, c, , sp]) => {
    const [K, LL, I, C, SP] = [fnum(kuu), fnum(L), fnum(kii), fnum(c), fnum(sp)];
    return kii * kuu > c * c && denOk(chTruth(I, C, K, SP)) && distinctRoutes(chTruth(I, C, K, SP), chRoutes(I, C, K, LL, SP), 0.1);
  });

const klSpace = () => cartesian([10, 20, 50, 100], [4, 5, 10]).map(([M, r]) => keyOf(r * M, M));
const jitterSpace = () => cartesian([1, 2, 3, 4, 5], [0.01, 0.1, 0.5]).map(([v, e]) => keyOf(v, e));

// ---------- cached decks ----------
const decks = new Map<string, PracticeCard[]>();
function deck(seed: number, lang: GameLanguage): PracticeCard[] {
  const key = `${seed}|${lang}`;
  let d = decks.get(key); if (!d) { d = cardsOf(seed, lang); decks.set(key, d); }
  return d;
}

// ---------- printed-text parsing (EN and ZH share the numerals) ----------
function printed(card: PracticeCard): Record<string, number> {
  const p = card.prompt; const slug = card.id.replace('GP-22-', '');
  switch (slug) {
    case 'kl-term': case 'cost-ratio': return { N: after(p, 'N'), M: after(p, 'M') };
    case 'q-var': return { kii: after(p, 'k(xᵢ, xᵢ)'), c: after(p, 'k(xᵢ, z)'), kuu: after(p, 'k(z, z)'), m: after(p, 'm'), S: after(p, 'S') };
    case 'trace-term': {
      const tuple = clean(p).match(/k\(x₃, z\)\)\s*=\s*\(([^)]*)\)/)![1].split(/[,、]/).map(Number);
      return { kv: after(p, 'k(xᵢ, xᵢ)'), kuu: after(p, 'k(z, z)'), c1: tuple[0], c2: tuple[1], c3: tuple[2], s2: after(p, 'σ²') };
    }
    case 'whiten-mean': {
      const pv = nums(between(p, /\bp = \(/, /\)/)), mv = nums(between(p, /m′ = \(/, /\)/));
      const row = clean(between(p, /L = /, /\]\]/)) + ']]';
      const mm = row.match(/\[\[(-?[\d.]+), 0\], \[(-?[\d.]+), (-?[\d.]+)\]\]/);
      if (!mm) throw new Error(`bad L matrix: ${p.slice(0, 160)}`);
      return { a: Number(mm[1]), b: Number(mm[2]), c: Number(mm[3]), m1: mv[0], m2: mv[1], p1: pv[0], p2: pv[1] };
    }
    case 'whiten-cov': {
      const L = clean(p).match(/L = \[\[(-?[\d.]+), 0\], \[(-?[\d.]+), (-?[\d.]+)\]\]/)!;
      const S = clean(p).match(/S′ = \[\[(-?[\d.]+), 0\], \[0, (-?[\d.]+)\]\]/)!;
      return { a: Number(L[1]), b: Number(L[2]), c: Number(L[3]), s1: Number(S[1]), s2: Number(S[2]) };
    }
    case 'minibatch': {
      const t = clean(p);
      const pair = t.match(/(?:equal to|分别为) (-?[\d.]+) (?:and|和) (-?[\d.]+)/)!;
      return { N: after(p, 'N'), l1: Number(pair[1]), l2: Number(pair[2]), kl: Number(t.match(/KL\[q\(u\) ‖ p\(u\)\] = (-?[\d.]+)/)![1]) };
    }
    case 'challenge': return { kuu: after(p, 'k(z, z)'), L: after(p, 'L'), kii: after(p, 'k(xᵢ, xᵢ)'), c: after(p, 'k(xᵢ, z)'), mp: after(p, 'm′'), sp: after(p, 's′') };
    default: throw new Error(slug);
  }
}

// ---------- the nine cards: expected contract ----------
const IDS = ['kl-term', 'cost-ratio', 'q-var', 'trace-term', 'whiten-mean', 'whiten-cov', 'jitter-check', 'minibatch', 'challenge'];
const LABELS: Record<string, [string, string]> = {
  'cost-ratio': ['Cost ratio', '代价之比'],
  'q-var': ['Variance of fᵢ under q', 'q 下 fᵢ 的方差'],
  'trace-term': ['Trace penalty', '迹惩罚项'],
  'whiten-mean': ['Second entry of the mean of q(u)', 'q(u) 均值的第二个分量'],
  'whiten-cov': ['Entry (2, 2) of the covariance of q(u)', 'q(u) 协方差的 (2, 2) 元素'],
  minibatch: ['Mini-batch estimate of L', 'L 的小批量估计'],
  challenge: ['Variance of fᵢ under q', 'q 下 fᵢ 的方差'],
};
const TITLES: Record<string, [string, string]> = {
  'kl-term': ['Which KL term?', '是哪一个 KL 项？'],
  'cost-ratio': ['Exact against sparse cost', '精确计算与稀疏计算的代价'],
  'q-var': ['Variance of q(fᵢ)', 'q(fᵢ) 的方差'],
  'trace-term': ['The trace penalty', '迹惩罚项'],
  'whiten-mean': ['Un-whitening the mean', '还原白化后的均值'],
  'whiten-cov': ['Un-whitening the covariance', '还原白化后的协方差'],
  'jitter-check': ['Two identical inducing inputs', '两个相同的诱导点'],
  minibatch: ['A mini-batch estimate of the bound', '下界的小批量估计'],
  challenge: ['Challenge: a whitened posterior at one input', '挑战：一个输入处的白化后验'],
};
const END_EN = 'Give an integer, a fraction or a decimal rounded to 2 places.';
const END_ZH = '请填整数、分数，或保留 2 位小数的小数。';

describe('GP-22 structure and structural gates', () => {
  it('has the nine planned cards in order, bilingual, with exactly the planned answer modes and no figures', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = deck(spreadSeed(i), lang);
      expect(cards.map(c => c.id)).toEqual(IDS.map(s => `GP-22-${s}`));
      for (const c of cards) {
        const slug = c.id.replace('GP-22-', '');
        expect(c.title, c.id).toBe(TITLES[slug][lang === 'en' ? 0 : 1]);
        expect(c.figure, `${c.id} must have no figure`).toBeUndefined();
        expect(c.choice?.figures, c.id).toBeUndefined();
        expect(c.slots, c.id).toBeUndefined();
        const choice = slug === 'kl-term' || slug === 'jitter-check';
        expect(!!c.choice, c.id).toBe(choice);
        expect(!!c.fields, c.id).toBe(!choice);
        expect(!!c.audit, c.id).toBe(!choice);
        if (c.fields) {
          expect(c.fields).toHaveLength(1);
          expect(c.fields[0].label, c.id).toBe(LABELS[slug][lang === 'en' ? 0 : 1]);
          expect(c.prompt.endsWith(slug === 'cost-ratio' ? (lang === 'en' ? 'Give an integer.' : '请填整数。') : lang === 'en' ? END_EN : END_ZH), `${c.id} prompt ending`).toBe(true);
        }
      }
      expect(cards[8].explanation.length).toBeGreaterThan(0);
      for (const c of cards) expect(lang === 'en' ? /does not assess/.test(c.explanation) : /本游戏不考查/.test(c.explanation), `${c.id} closing sentence`).toBe(true);
    }
  });
  it('passes the shared deck and text gates', () => {
    expect(deckProblems('GP-22', cardsOf, 'topic', 200)).toEqual([]);
    expect(textLintProblems('GP-22', cardsOf, 200)).toEqual([]);
  });
  it('every number field has tolerance exactly 0.006 and no key sits within 0.003 of a rounding edge unless it is an exact tie', () => {
    for (let i = 0; i < 400; i++) {
      const seed = spreadSeed(i);
      for (const card of deck(seed, 'en')) for (const f of card.fields ?? []) {
        expect(f.tolerance, `${card.id} seed ${seed}: tolerance`).toBe(0.006);
        const scaled = Math.abs(f.answer) * 100;
        const frac = scaled - Math.floor(scaled + 1e-9); // 0.5 means x.xx5, an exact tie
        const dist = Math.abs(frac - 0.5) * 0.01; // distance from the nearest x.xx5 edge
        const onGrid = Math.abs(frac) < 1e-7 || Math.abs(frac - 1) < 1e-7;
        const exactTie = dist < 1e-9;
        expect(onGrid || exactTie || dist >= 0.003, `${card.id} seed ${seed}: key ${f.answer} within 0.003 of a rounding edge (distance ${dist})`).toBe(true);
        // either two-decimal rounding of an exact tie must be accepted
        for (const r of [Math.floor(scaled + 1e-9) / 100, Math.ceil(scaled - 1e-9) / 100]) {
          const signed = Math.sign(f.answer || 1) * r;
          expect(gradeCard(card, [numToText(signed)], null, []), `${card.id} seed ${seed}: rounding ${signed} of ${f.answer}`).toBe('correct');
        }
      }
    }
  });
});

describe('GP-22 numeric audit kinds (independent recomputation)', () => {
  const fieldAnswer = (card: PracticeCard) => card.fields![0].answer;
  const gradeStr = (card: PracticeCard, s: string) => gradeCard(card, [s], null, []);
  /** the accepted answer grades correct in every accepted form; answers moved past the tolerance or onto a wrong route grade wrong */
  function gradeChecks(card: PracticeCard, truth: Fr, routes: Fr[], where0: string) {
    const where = `${where0} ${JSON.stringify(card.audit!.params)}`;
    expect(gradeStr(card, exactStr(truth)), `${where} exact`).toBe('correct');
    expect(gradeStr(card, numToText(val(truth))), `${where} plain`).toBe('correct');
    expect(gradeStr(card, val(truth).toFixed(2)), `${where} two decimals`).toBe('correct');
    for (const delta of [0.0105, -0.0105, 0.1, -0.1]) expect(gradeStr(card, numToText(val(truth) + delta)), `${where} perturbed ${delta}`).toBe('incorrect');
    for (const r of routes) expect(gradeStr(card, exactStr(r)), `${where} wrong route ${exactStr(r)}`).toBe('incorrect');
  }
  const counts: Record<string, number> = {};
  const record = (kind: string) => { counts[kind] = (counts[kind] ?? 0) + 1; };

  it('fires every audit kind of the plan on every seed and no unknown kinds', () => {
    const expected = ['cost-ratio', 'q-var', 'trace-term', 'whiten-mean', 'whiten-cov', 'minibatch', 'challenge'].map(k => `GP-22:${k}`).sort();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const kinds = deck(spreadSeed(i), lang).filter(c => c.audit).map(c => c.audit!.kind).sort();
      expect(kinds).toEqual(expected);
    }
  });

  it('cost-ratio: N^3/(N M^2) and (N/M)^2, printed N and M equal the audit', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'cost-ratio'); const { N, M } = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ N, M });
      expect(costSpace().has(keyOf(N, M))).toBe(true);
      const truth = costTruth(N, M);
      expect(val(truth)).toBe(val(sq(fr(N, M))));
      expect(fieldAnswer(card)).toBe(val(truth));
      gradeChecks(card, truth, costRoutes(N, M), `cost-ratio seed ${i}`);
      for (const r of costRoutes(N, M)) expect(Math.abs(val(r) - val(truth)), `cost-ratio collision N=${N} M=${M}`).toBeGreaterThanOrEqual(1);
      record('cost');
    }
  });

  it('q-var: conditioning of (f, u) under q, and quadrature of the mixture variance', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'q-var'); const p = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ kii: p.kii, c: p.c, kuu: p.kuu, m: p.m, S: p.S });
      expect([1, 2, 3]).toContain(p.m);
      expect(PLAN_QVAR_22.some(s => keyOf(...s) === keyOf(p.kii, p.c, p.kuu, p.S)), `q-var set ${JSON.stringify(p)} not in the plan list`).toBe(true);
      // route 1: joint covariance of (f, u) under q = [[kt + a S a, a S], [a S, S]]
      const a = p.c / p.kuu, kt = p.kii - p.c * p.c / p.kuu;
      const joint = [[kt + a * p.S * a, a * p.S], [a * p.S, p.S]];
      // route 2: quadrature of the second central moment of ∫ N(f; a u, kt) N(u; m, S) du
      const sd = Math.sqrt(p.S);
      const pdf = (u: number) => Math.exp(-((u - p.m) ** 2) / (2 * p.S)) / Math.sqrt(2 * Math.PI * p.S);
      const mean = simpson(u => a * u * pdf(u), p.m - 12 * sd, p.m + 12 * sd, 4000);
      const second = simpson(u => (kt + a * a * u * u) * pdf(u), p.m - 12 * sd, p.m + 12 * sd, 4000);
      const variance = second - mean * mean;
      expect(Math.abs(variance - joint[0][0])).toBeLessThan(1e-6);
      expect(Math.abs(fieldAnswer(card) - joint[0][0])).toBeLessThanOrEqual(1e-9);
      const [kii, c, kuu, S] = [fnum(p.kii), fnum(p.c), fnum(p.kuu), fnum(p.S)];
      gradeChecks(card, qvarTruth(kii, c, kuu, S), qvarRoutes(kii, c, kuu, S), `q-var seed ${i}`);
      record('qvar');
    }
  });

  it('trace-term: explicit K, Q and the joint with u, trace(K-Q)/(2 s2)', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'trace-term'); const p = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ kv: p.kv, kuu: p.kuu, c1: p.c1, c2: p.c2, c3: p.c3, s2: p.s2 });
      const c = [p.c1, p.c2, p.c3];
      expect(c[0] <= c[1] && c[1] <= c[2] && !(c[0] === c[2])).toBe(true);
      // K = Q + diag(kv - c_i^2/kuu) completes a valid covariance; build all matrices explicitly
      const Q = c.map(ci => c.map(cj => ci * cj / p.kuu));
      const K = Q.map((row, r) => row.map((x, k) => x + (r === k ? p.kv - c[r] * c[r] / p.kuu : 0)));
      const joint = [[...K[0], c[0]], [...K[1], c[1]], [...K[2], c[2]], [c[0], c[1], c[2], p.kuu]];
      expect(choleskyOk(joint), `joint covariance with u must be positive definite`).toBe(true);
      expect(c.every(x => x * x < p.kv * p.kuu)).toBe(true);
      const trace = [0, 1, 2].reduce((s, r) => s + K[r][r] - Q[r][r], 0);
      const expected = trace / (2 * p.s2);
      expect(Math.abs(fieldAnswer(card) - expected)).toBeLessThanOrEqual(1e-9);
      const [kv, kuu, cs, s2] = [fnum(p.kv), fnum(p.kuu), c.map(fnum), fnum(p.s2)];
      gradeChecks(card, traceTruth(kv, kuu, cs, s2), traceRoutes(kv, kuu, cs, s2), `trace seed ${i}`);
      record('trace');
    }
  });

  it('whiten-mean: L m′ + p (second entry) and the L-inverse round trip', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'whiten-mean'); const p = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ a: p.a, b: p.b, c: p.c, m1: p.m1, m2: p.m2, p1: p.p1, p2: p.p2 });
      const L = [[p.a, 0], [p.b, p.c]];
      const mu = [L[0][0] * p.m1 + L[0][1] * p.m2 + p.p1, L[1][0] * p.m1 + L[1][1] * p.m2 + p.p2];
      expect(Math.abs(fieldAnswer(card) - mu[1])).toBeLessThanOrEqual(1e-9);
      // round trip: v = L^-1 (u - p) by forward substitution must give m′ back
      const r1 = (mu[0] - p.p1) / L[0][0], r2 = (mu[1] - p.p2 - L[1][0] * r1) / L[1][1];
      expect(close2(r1, p.m1) && close2(r2, p.m2)).toBe(true);
      const T = wmTruth(p.b, p.c, p.m1, p.m2, p.p2);
      const routes = wmRoutes(p.a, p.b, p.c, p.m1, p.m2, p.p1, p.p2);
      gradeChecks(card, fr(T), routes, `whiten-mean seed ${i}`);
      for (const r of routes) expect(Math.abs(val(r) - T), `whiten-mean collision ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(0.1 - 1e-12);
      record('wm');
    }
  });

  it('whiten-cov: full 2x2 product L S′ Lᵀ and the inverse round trip', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'whiten-cov'); const p = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ a: p.a, b: p.b, c: p.c, s1: p.s1, s2: p.s2 });
      const L = [[p.a, 0], [p.b, p.c]], S = [[p.s1, 0], [0, p.s2]];
      const LS = mm(L, S), Su = mm(LS, tr(L));
      expect(Math.abs(fieldAnswer(card) - Su[1][1])).toBeLessThanOrEqual(1e-9);
      const det = p.a * p.c, Li = [[p.c / det, 0], [-p.b / det, p.a / det]];
      const back = mm(mm(Li, Su), tr(Li));
      expect(close2(back[0][0], p.s1) && close2(back[1][1], p.s2) && close2(back[0][1], 0)).toBe(true);
      const [B, C, S1, S2] = [fnum(p.b), fnum(p.c), fnum(p.s1), fnum(p.s2)];
      gradeChecks(card, wcTruth(B, C, S1, S2), wcRoutes(B, C, S1, S2), `whiten-cov seed ${i}`);
      record('wc');
    }
  });

  it('minibatch: N*mean − KL and the average over all two-element batches', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'minibatch'); const p = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ N: p.N, l1: p.l1, l2: p.l2, kl: p.kl });
      expect(p.l1).toBeLessThan(0); expect(p.l2).toBeLessThan(0); expect(p.kl).toBeGreaterThan(0);
      expect(p.l1).toBeGreaterThanOrEqual(p.l2);
      expect(Math.abs(fieldAnswer(card) - (p.N * ((p.l1 + p.l2) / 2) - p.kl))).toBeLessThanOrEqual(1e-9);
      // unbiasedness: a data vector of length N with N/2 copies of each term; average the batch estimator over all pairs
      const data = Array.from({ length: p.N }, (_, k) => (k % 2 === 0 ? p.l1 : p.l2));
      let total = 0, pairs = 0;
      for (let a = 0; a < p.N; a++) for (let b = a + 1; b < p.N; b++) { total += (p.N / 2) * (data[a] + data[b]) - p.kl; pairs++; }
      expect(Math.abs(total / pairs - (data.reduce((s, x) => s + x, 0) - p.kl))).toBeLessThan(1e-9);
      // and the answer is that estimator for the printed batch
      const T = mbTruth(p.N, fnum(p.l1), fnum(p.l2), p.kl);
      gradeChecks(card, T, mbRoutes(p.N, fnum(p.l1), fnum(p.l2), p.kl), `minibatch seed ${i}`);
      record('mb');
    }
  });

  it('challenge: un-whiten, joint (f, u) under q, and quadrature', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'challenge'); const p = card.audit!.params as Record<string, number>;
      expect(printed(card)).toEqual({ kuu: p.kuu, L: p.L, kii: p.kii, c: p.c, mp: p.mp, sp: p.sp });
      expect(p.L * p.L).toBe(p.kuu);
      expect([-1, 1, 2]).toContain(p.mp);
      const Su = p.L * p.sp * p.L; // L S′ Lᵀ for a scalar
      const a = p.c / p.kuu, kt = p.kii - p.c * p.c / p.kuu;
      const joint00 = kt + a * Su * a;
      const mu = p.L * p.mp;
      const sd = Math.sqrt(Su);
      const pdf = (u: number) => Math.exp(-((u - mu) ** 2) / (2 * Su)) / Math.sqrt(2 * Math.PI * Su);
      const m1 = simpson(u => a * u * pdf(u), mu - 12 * sd, mu + 12 * sd, 4000);
      const m2 = simpson(u => (kt + a * a * u * u) * pdf(u), mu - 12 * sd, mu + 12 * sd, 4000);
      expect(Math.abs(m2 - m1 * m1 - joint00)).toBeLessThan(1e-6);
      expect(Math.abs(fieldAnswer(card) - joint00)).toBeLessThanOrEqual(1e-9);
      const [kii, c, kuu, L, sp] = [fnum(p.kii), fnum(p.c), fnum(p.kuu), fnum(p.L), fnum(p.sp)];
      gradeChecks(card, chTruth(kii, c, kuu, sp), chRoutes(kii, c, kuu, L, sp), `challenge seed ${i}`);
      record('ch');
    }
  });

  it('ran every kind on every seed and language', () => {
    for (const k of ['cost', 'qvar', 'trace', 'wm', 'wc', 'mb', 'ch']) expect(counts[k], k).toBe(SEEDS * 2);
  });
});

describe('GP-22 sampling spaces equal the plan exactly', () => {
  it('plan enumerations have the counts the plan states', () => {
    expect(costSpace().size).toBe(12);
    expect(qvarSets().length).toBe(22);
    expect(new Set(qvarSets().map(s => keyOf(...s)))).toEqual(new Set(PLAN_QVAR_22.map(s => keyOf(...s))));
    expect(traceSets().length).toBe(48);
    expect(wmSets().length).toBe(2360);
    expect(new Set(wmSets().map(([a, b, c, m1, m2]) => keyOf(a, b, c, m1, m2))).size).toBe(220);
    expect(wcSets().length).toBe(280);
    expect(mbSets().length).toBe(300);
    expect(chSets().length).toBe(48 * 3);
    expect(new Set(chSets().map(([kuu, , kii, c, , sp]) => keyOf(kuu, kii, c, sp))).size).toBe(48);
    expect(klSpace().length).toBe(12);
    expect(jitterSpace().length).toBe(15);
  });

  it(`observed draws over ${COVERAGE_SEEDS} seeds hit exactly the planned sets (no more, no fewer)`, () => {
    const seen: Record<string, Set<Key>> = { kl: new Set(), cost: new Set(), qvar: new Set(), trace: new Set(), wm: new Set(), wc: new Set(), jitter: new Set(), mb: new Set(), ch: new Set() };
    const order: Record<string, number[]> = {};
    for (let i = 0; i < COVERAGE_SEEDS; i++) {
      const cards = cardsOf(spreadSeed(i), 'en');
      const g = (slug: string) => byId(cards, slug);
      const kl = printed(g('kl-term')); seen.kl.add(keyOf(kl.N, kl.M));
      const cp = g('cost-ratio').audit!.params as Record<string, number>; seen.cost.add(keyOf(cp.N, cp.M));
      const q = g('q-var').audit!.params as Record<string, number>; seen.qvar.add(keyOf(q.kii, q.c, q.kuu, q.S, q.m));
      const t = g('trace-term').audit!.params as Record<string, number>; seen.trace.add(keyOf(t.kv, t.kuu, t.c1, t.c2, t.c3, t.s2));
      const w = g('whiten-mean').audit!.params as Record<string, number>; seen.wm.add(keyOf(w.a, w.b, w.c, w.m1, w.m2, w.p1, w.p2));
      const c6 = g('whiten-cov').audit!.params as Record<string, number>; seen.wc.add(keyOf(c6.a, c6.b, c6.c, c6.s1, c6.s2));
      const jp = clean(g('jitter-check').prompt); seen.jitter.add(keyOf(Number(jp.match(/equals (-?\d+(?:\.\d+)?)\)|等于 (-?\d+(?:\.\d+)?)）/)!.slice(1).find(Boolean)), Number(jp.match(/ε = (-?\d+(?:\.\d+)?)/)![1])));
      const mb = g('minibatch').audit!.params as Record<string, number>; seen.mb.add(keyOf(mb.N, mb.l1, mb.l2, mb.kl));
      const ch = g('challenge').audit!.params as Record<string, number>; seen.ch.add(keyOf(ch.kuu, ch.L, ch.kii, ch.c, ch.mp, ch.sp));
      void order;
    }
    const same = (name: string, planned: Set<Key>) => {
      const extra = [...seen[name]].filter(k => !planned.has(k)), missing = [...planned].filter(k => !seen[name].has(k));
      expect({ name, extra: extra.slice(0, 5), missing: missing.slice(0, 5), extraCount: extra.length, missingCount: missing.length }).toEqual({ name, extra: [], missing: [], extraCount: 0, missingCount: 0 });
    };
    same('kl', new Set(klSpace()));
    same('cost', costSpace());
    same('qvar', new Set(qvarSets().flatMap(s => [1, 2, 3].map(m => keyOf(...s, m)))));
    same('trace', new Set(traceSets().map(s => keyOf(...s))));
    same('wm', new Set(wmSets().map(s => keyOf(...s))));
    same('wc', new Set(wcSets().map(s => keyOf(...s))));
    same('jitter', new Set(jitterSpace()));
    same('mb', new Set(mbSets().map(s => keyOf(...s))));
    same('ch', new Set(chSets().map(([kuu, L, kii, c, mp, sp]) => keyOf(kuu, L, kii, c, mp, sp))));
  }, 600000);

  it('wrong routes differ from the truth on every enumerated draw (card 2 by 1, others by 0.1)', () => {
    for (const [N, M] of cartesian([10, 20, 50, 100], [4, 5, 10]).map(([m, r]) => [r * m, m])) expect(distinctRoutes(costTruth(N, M), costRoutes(N, M), 1)).toBe(true);
    for (const [kii, c, kuu, S] of qvarSets()) expect(distinctRoutes(qvarTruth(fnum(kii), fnum(c), fnum(kuu), fnum(S)), qvarRoutes(fnum(kii), fnum(c), fnum(kuu), fnum(S)), 0.1)).toBe(true);
  });
});

describe('GP-22 choice cards', () => {
  it('kl-term: exactly one option is KL[q(u) ‖ p(u)] over M values, the index points to it, and it is not the longest', () => {
    const pos = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'kl-term'); const { N, M } = printed(card);
      expect(klSpace()).toContain(keyOf(N, M));
      const opts = card.choice!.options;
      expect(opts).toHaveLength(4);
      const ok = (o: string) => o.includes('KL[q(u) ‖ p(u)]') && o.includes(lang === 'en' ? `${M} inducing values` : `${M} 个诱导值`);
      const hits = opts.map(ok);
      expect(hits.filter(Boolean)).toHaveLength(1);
      expect(card.choice!.answer).toBe(hits.indexOf(true));
      expect(opts.filter(o => o.includes('KL[q(u) ‖ p(u)]'))).toHaveLength(1);
      expect(opts.some(o => o.includes(`${N}`))).toBe(true); // the full-GP distractor names N
      const correct = opts[card.choice!.answer], wrongMax = Math.max(...opts.filter((_, k) => k !== card.choice!.answer).map(o => o.length));
      expect(correct.length, `${lang} correct option must be shorter than the longest wrong option`).toBeLessThan(wrongMax);
      pos.add(card.choice!.answer);
      expect(gradeCard(card, [], card.choice!.answer, [])).toBe('correct');
    }
    expect(pos.size).toBeGreaterThanOrEqual(3);
  });

  it('jitter-check: exactly one option has eigenvalues 2v and 0 and says jitter lifts them to 2v+ε and ε', () => {
    const pos = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(spreadSeed(i), lang), 'jitter-check'); const t = clean(card.prompt);
      const v = Number(t.match(/equals (-?\d+(?:\.\d+)?)\)|等于 (-?\d+(?:\.\d+)?)）/)!.slice(1).find(Boolean)), eps = Number(t.match(/ε = (-?\d+(?:\.\d+)?)/)![1]);
      expect(jitterSpace()).toContain(keyOf(v, eps));
      expect(t).toContain(`[[${v}, ${v}], [${v}, ${v}]]`);
      const f = (x: number) => numToText(Number(x.toFixed(6)));
      const opts = card.choice!.options; expect(opts).toHaveLength(4);
      const base = lang === 'en' ? `Eigenvalues ${f(2 * v)} and 0` : `特征值为 ${f(2 * v)} 和 0`;
      const lifted = lang === 'en' ? `${f(2 * v + eps)} and ${f(eps)}` : `${f(2 * v + eps)} 和 ${f(eps)}`;
      const ok = (o: string) => o.includes(base) && o.includes(lifted) && o.includes(lang === 'en' ? 'Cholesky fails' : '分解失败');
      const hits = opts.map(ok);
      expect(hits.filter(Boolean)).toHaveLength(1);
      expect(card.choice!.answer).toBe(hits.indexOf(true));
      expect(opts.filter(o => o.includes(f(2 * v + eps)))).toHaveLength(1);
      // the true spectrum, by explicit eigen-decomposition of [[v, v], [v, v]] + eps I
      const tr = 2 * (v + eps), det = (v + eps) ** 2 - v * v;
      const disc = Math.sqrt(tr * tr / 4 - det);
      expect(Math.abs(tr / 2 + disc - (2 * v + eps))).toBeLessThan(1e-9);
      expect(Math.abs(tr / 2 - disc - eps)).toBeLessThan(1e-9);
      const correct = opts[card.choice!.answer], wrongMax = Math.max(...opts.filter((_, k) => k !== card.choice!.answer).map(o => o.length));
      expect(correct.length, `${lang} correct option must be shorter than the longest wrong option`).toBeLessThan(wrongMax);
      pos.add(card.choice!.answer);
    }
    expect(pos.size).toBeGreaterThanOrEqual(3);
  });
});

describe('GP-22 learner-visible text', () => {
  const ALLOWED_LATIN = /\b(?:exp|ln|log|GP|KL|ELBO|tr)\b/g;
  const visible = (c: PracticeCard) => [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];
  const gcdOf = (a: number, b: number): number => (b ? gcdOf(b, a % b) : a);
  it('is Unicode, lint-clean, reduced, and ZH has no English words and correct punctuation', () => {
    const problems = new Set<string>();
    for (let i = 0; i < 120; i++) for (const lang of LANGS) for (const card of deck(spreadSeed(i), lang)) for (const text of visible(card)) {
      const add = (m: string) => problems.add(`${card.id} [${lang}] ${m}: …${text.slice(0, 90)}`);
      if (/(?:^|[\s(\[,=×·/+])-(?=[\d.(])|[\d)\]] - [\d(]/.test(text)) add('ASCII hyphen as minus');
      if (/\^/.test(text)) add('caret');
      if (/\(\(\s*[−-]?[\d./]+\s*\)\)|\(\([−-]?[\d./]+\),|, \([−-]?[\d./]+\)\)/.test(text)) add('double parentheses');
      if (/\d\.\d{4,}|\d[eE][+-]?\d/.test(text)) add('raw float');
      if (/undefined|NaN|\[object|Infinity|\$\{|=>|\{[^}]{0,14}\}|\bparams?\b|\bTODO\b|\bFIXME\b|\bfoo\b|\bconst\b|\blet\b|\bnull\b|[a-z]+_[a-z]+/.test(text)) add('developer marker');
      if (/(?<![\w.])1·(?=[A-Za-zσκεμ])|(?<=[A-Za-zσκεμ])·1(?![\d.])/.test(text)) add('coefficient 1');
      const restate = /(?<![\w.²/·×+*−(])(−?[\w.′]+(?:\/[\w.′]+)?(?:\([^)]*\))?) = \1(?![\w.²/′+·*×])/.exec(text);
      if (/(?<![\w.)(²³])−\d+(?:\.\d+)?[²³]/.test(text)) add('negative number squared without parentheses');
      if (restate) add(`restatement "${restate[0]}"`);
      for (const m of text.matchAll(/(?<![\d./])(\d+)\/(\d+)(?![\d/])(?! = )/g)) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        if (gcdOf(a, b) !== 1 && a % b !== 0) add(`unreduced fraction ${m[0]}`);
      }
      if (/\bx\s*=\s*x\b/.test(text)) add('x = x');
      if (text === card.explanation) for (const sentence of text.split(/(?<=[.。])\s+(?=[A-Z])|(?<=。)/)) if (/\d\.\d/.test(sentence.replace(/\b[pP]p?\. ?\d/g, '')) && /\d\/\d/.test(sentence)) add(`mixed decimal and fraction style in one sentence: ${sentence.slice(0, 80)}`);
      if (lang === 'en') { if (/[㐀-鿿，、；：（）]/.test(text)) add('CJK in EN'); }
      else {
        const stripped = text.replace(ALLOWED_LATIN, '');
        const words = stripped.match(/[A-Za-z]{3,}|(?<![A-Za-z])(?:and|or|the|with|for|is|are|if|then|where|of|to)(?![A-Za-z])/g);
        if (words) add(`English words in ZH ${words.join(',')}`);
        if (/["'“”‘’]/.test(text.replace(/[′]/g, ''))) add('quotes');
        if (/[㐀-鿿],|,\s?[㐀-鿿]|[㐀-鿿];/.test(text)) add('ASCII comma next to ZH prose');
        if (!/[㐀-鿿]/.test(text) && text.length > 12) add('ZH string without Chinese');
      }
      if (/\.\.\.|--/.test(text)) add('ASCII ellipsis or dashes');
      if (/\S=|=\S/.test(text)) add('missing space around =');
    }
    expect([...problems]).toEqual([]);
  });
  it('hints show neither the answer nor placeholders', () => {
    for (let i = 0; i < 120; i++) for (const lang of LANGS) for (const card of deck(spreadSeed(i), lang)) if (card.fields) {
      const answerText = String(Number(Math.abs(card.fields[0].answer).toFixed(4)));
      if (answerText.length >= 3) expect(card.hint.includes(answerText), `${card.id} hint contains the answer`).toBe(false);
    }
  });
  it('explanations contain the answer in one of its accepted forms', () => {
    for (let i = 0; i < 120; i++) for (const lang of LANGS) for (const card of deck(spreadSeed(i), lang)) if (card.fields) {
      let T: Fr; try { T = fnum(card.fields[0].answer); } catch { T = fr(Math.round(card.fields[0].answer * 1e6), 1e6); }
      const text = clean(card.explanation);
      const forms = [exactStr(T), String(Number(val(T).toFixed(4))), val(T).toFixed(2)].map(clean);
      expect(forms.some(f => text.includes(f.replace(/^-/, '')) ), `${card.id} [${lang}] explanation lacks ${forms.join(' / ')}: ${text}`).toBe(true);
    }
  });
  it('card variety: at least 6 distinct prompts per card over 60 seeds', () => {
    for (const slug of IDS) for (const lang of LANGS) {
      const set = new Set<string>();
      for (let i = 0; i < SEEDS; i++) set.add(byId(deck(spreadSeed(i), lang), slug).prompt);
      expect(set.size, `${slug} ${lang} distinct prompts`).toBeGreaterThanOrEqual(6);
    }
  });
});

// ---------- small linear algebra ----------
function mm(A: number[][], B: number[][]): number[][] { return A.map(row => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0))); }
function tr(A: number[][]): number[][] { return A[0].map((_, j) => A.map(row => row[j])); }
const close2 = (a: number, b: number) => Math.abs(a - b) < 1e-9;
function choleskyOk(A: number[][]): boolean {
  const n = A.length; const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 1e-12) return false; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return true;
}
