import { describe, expect, it } from 'vitest';
import { gp17 } from './games/gp17';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const MANY = 4000;
type Params = Record<string, number | number[]>;
const norm = (t: string) => t.replaceAll('−', '-').replaceAll(' ', ' ');
const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const cardsOf = (seed: number, lang: GameLanguage) => gp17(seed, lang);
const byId = (cards: PracticeCard[], slug: string) => {
  const c = cards.find(card => card.id === `GP-17-${slug}`);
  if (!c) throw new Error(`missing card GP-17-${slug}`);
  return c;
};
const grab = (text: string, re: RegExp, n: number): number[] => {
  const m = norm(text).match(re);
  if (!m) throw new Error(`no match ${re} in ${text.slice(0, 200)}`);
  return m.slice(1, n + 1).map(Number);
};
const num = (v: number) => (Number.isInteger(v) ? String(v) : String(v));
const clean = (v: number) => Number(v.toFixed(9));

// ----------------------------------------------------------------- independent math
const logistic = (z: number) => 1 / (1 + Math.exp(-z));
/** table interpolation, np.interp style */
function interp(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) if (x >= xs[i] && x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
  throw new Error('interp');
}
/** bisection solve of pi/(1-pi) = odds */
function solveOdds(odds: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (mid / (1 - mid) < odds) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
const gaussLogPdf = (y: number, mu: number, v: number) => -0.5 * Math.log(2 * Math.PI * v) - (y - mu) ** 2 / (2 * v);
function fdWeight(s: number, y: number, f: number): number {
  const h = 1e-3, L = (u: number) => gaussLogPdf(y, u, s);
  return -(L(f + h) - 2 * L(f) + L(f - h)) / (h * h);
}

// ----------------------------------------------------------------- plan sampling spaces (independent enumeration)
const key = (...v: number[]) => v.map(clean).join('|');
const ODDS = [[3, 1], [4, 1], [9, 1], [1, 3], [1, 4], [3, 2], [2, 3]];
const TAIL = [[2, 3], [2, 4], [2, 5], [2, 6], [2, 8], [3, 6], [3, 9], [4, 6], [4, 8], [4, 10], [4, 12], [6, 9]];
const W_S = [0.5, 0.25, 2, 4, 5, 8, 10];
const W_YF = [[2, -1], [2, 0], [3, -1], [3, 0], [3, 1], [4, -1], [4, 0], [4, 1]];
const GRANGE = [-8, -7, -6, -5, -4, -3, -2, -1];
const spaceOdds = new Set(ODDS.map(([a, b]) => key(a, b)));
const spaceTail = new Set(TAIL.map(([a, b]) => key(a, b)));
const spaceFlip = new Set<string>();
for (const c of [1, 2]) for (const p of [0.6, 0.7, 0.8, 0.9]) for (const y of [-1, 1]) for (const f of [-c, c]) spaceFlip.add(key(c, p, y, f));
const spaceWeight = new Set<string>();
for (const s of W_S) for (const [y, f] of W_YF) spaceWeight.add(key(s, y, f));
const spaceChord = new Set<string>();
for (const x of [-4, -2, 0, 2]) for (const [alpha, mo] of [[0.25, 3], [0.75, 1]]) for (const gx of GRANGE) for (const gy of GRANGE) for (const gm of GRANGE) {
  const ch = alpha * gx + (1 - alpha) * gy;
  if (gx === gy || gm === ch || gm === 2 * ch) continue;
  spaceChord.add(key(x, x + 4, alpha, x + mo, gx, gy, gm));
}
const spaceOne = new Set<string>();
for (const x of [-4, -2, 0, 2]) for (const gx of GRANGE) for (const gy of GRANGE) for (const gm of GRANGE) if (gm !== (gx + gy) / 2) spaceOne.add(key(x, x + 4, x + 2, gx, gy, gm));
const sTab = (p1: number, p2: number) => (z: number) => interp(z, [-2, -1, 1, 2], [1 - p2, 1 - p1, p1, p2]);
const CH_P = [[0.6, 0.8], [0.7, 0.8], [0.6, 0.9], [0.7, 0.9], [0.8, 0.9]];
const PTS: [number, number][] = []; // (f, y)
for (const f of [-2, -1, 1, 2]) for (const y of [-1, 1]) PTS.push([f, y]);
function challengeWrong(p1: number, p2: number, pts: [number, number][]) {
  const s = sTab(p1, p2), z = pts.map(([f, y]) => f * y);
  const T = z.reduce((a, zi) => a * s(zi), 1);
  const wrongs = [
    pts.reduce((a, [f]) => a * s(f), 1),
    z.reduce((a, zi) => a * s(Math.abs(zi)), 1),
    z.reduce((a, zi) => a * s(-zi), 1),
    1 - T,
    z.reduce((a, zi) => a + s(zi), 0) / 3,
    z.reduce((a, zi) => a + s(zi), 0),
    z.reduce((a, zi) => a * (zi < 0 ? s(Math.abs(zi)) : s(zi)), 1),
  ];
  return { T, wrongs, z };
}
const spaceChallenge = new Set<string>();
const challengeAll: { p1: number; p2: number; pts: [number, number][]; T: number }[] = [];
for (const [p1, p2] of CH_P) for (const a of PTS) for (const b of PTS) for (const c of PTS) {
  const pts = [a, b, c];
  const { T, wrongs, z } = challengeWrong(p1, p2, pts);
  if (!(z.some(v => v > 0) && z.some(v => v < 0))) continue;
  const fs = new Set(pts.map(([f]) => Math.abs(f)));
  if (!(fs.has(1) && fs.has(2))) continue;
  if (T < 0.05) continue;
  if (wrongs.some(w => Math.abs(w - T) < 0.02)) continue;
  spaceChallenge.add(key(p1, p2, a[0], a[1], b[0], b[1], c[0], c[1]));
  challengeAll.push({ p1, p2, pts, T });
}

// ----------------------------------------------------------------- oracle per audit kind
type Oracle = { fields: (p: Params) => number[]; wrongs: (p: Params) => number[]; parse: (c: PracticeCard, lang: GameLanguage) => Params; space: (p: Params) => boolean; count?: number };
const P = (p: Params, k: string) => p[k] as number;
const oracles: Record<string, Oracle> = {
  'GP-17:odds': {
    fields: p => [logistic(Math.log(P(p, 'a') / P(p, 'b')))],
    wrongs: p => { const o = P(p, 'a') / P(p, 'b'), pi = P(p, 'a') / (P(p, 'a') + P(p, 'b')); return [o, 1 - pi, o / 2, 1 / o, o / (1 - o)]; },
    parse: (c, lang) => { const [a, b] = lang === 'en' ? grab(c.prompt, new RegExp(String.raw`are ${NUM} to ${NUM},`), 2) : grab(c.prompt, new RegExp(String.raw`为 ${NUM} 比 ${NUM}，`), 2); return { a, b }; },
    space: p => spaceOdds.has(key(P(p, 'a'), P(p, 'b'))), count: 7,
  },
  'GP-17:flip-label': {
    fields: p => [interp(P(p, 'y') * P(p, 'f'), [-P(p, 'c'), P(p, 'c')], [1 - P(p, 'p'), P(p, 'p')])],
    wrongs: p => [1 - interp(P(p, 'y') * P(p, 'f'), [-P(p, 'c'), P(p, 'c')], [1 - P(p, 'p'), P(p, 'p')])],
    parse: (c, lang) => {
      if (lang === 'en') { const [cc, p] = grab(c.prompt, new RegExp(String.raw`has σ\(${NUM}\) = ${NUM}\.`), 2); const [y, f] = grab(c.prompt, new RegExp(String.raw`has y = ${NUM} and f = ${NUM}\.`), 2); return { c: cc, p, y, f }; }
      const [cc, p] = grab(c.prompt, new RegExp(String.raw`σ\(${NUM}\) = ${NUM}。`), 2); const [y, f] = grab(c.prompt, new RegExp(String.raw`y = ${NUM}，f = ${NUM}。`), 2); return { c: cc, p, y, f };
    },
    space: p => spaceFlip.has(key(P(p, 'c'), P(p, 'p'), P(p, 'y'), P(p, 'f'))), count: 32,
  },
  'GP-17:weight-gauss': {
    fields: p => [fdWeight(P(p, 's'), P(p, 'y'), P(p, 'f'))],
    wrongs: p => { const s = P(p, 's'), y = P(p, 'y'), f = P(p, 'f'); return [-1 / s, s, 1 / (2 * s), 1 / (s * s), 2 / s, (y - f) / s, (y - f) ** 2 / (2 * s)]; },
    parse: (c, lang) => {
      const m = norm(c.prompt).match(new RegExp(lang === 'en' ? String.raw`σₙ² = ${NUM}; here yᵢ = ${NUM} and fᵢ = ${NUM}\.` : String.raw`σₙ² = ${NUM}；这里 yᵢ = ${NUM}，fᵢ = ${NUM}。`));
      if (!m) throw new Error('weight parse ' + c.prompt);
      return { s: Number(m[1]), y: Number(m[2]), f: Number(m[3]) };
    },
    space: p => spaceWeight.has(key(P(p, 's'), P(p, 'y'), P(p, 'f'))), count: 56,
  },
  'GP-17:chord-gap': {
    fields: p => [P(p, 'gm') - interp(P(p, 'm'), [P(p, 'x'), P(p, 'y')], [P(p, 'gx'), P(p, 'gy')])],
    wrongs: p => {
      const a = P(p, 'alpha'), gx = P(p, 'gx'), gy = P(p, 'gy'), gm = P(p, 'gm'), ch = a * gx + (1 - a) * gy;
      return [ch, -(gm - ch), gm - (gx + gy) / 2, gm - ((1 - a) * gx + a * gy)];
    },
    parse: (c, lang) => {
      const t = norm(c.prompt);
      const P1 = String.raw`has h\(${NUM}\) = ${NUM}, h\(${NUM}\) = ${NUM} and h\(${NUM}\) = ${NUM}, where ${NUM} = α·\(?${NUM}\)? \+ \(1 − α\)·\(?${NUM}\)? with α = ${NUM}\.`.replaceAll('−', '-');
      const P2 = String.raw`满足 h\(${NUM}\) = ${NUM}，h\(${NUM}\) = ${NUM}，h\(${NUM}\) = ${NUM}，其中 ${NUM} = α·\(?${NUM}\)? \+ \(1 − α\)·\(?${NUM}\)?，α = ${NUM}。`.replaceAll('−', '-');
      const m = t.match(new RegExp(lang === 'en' ? P1 : P2));
      if (!m) throw new Error(`chord parse ${lang}: ${t}`);
      const v = m.slice(1).map(Number);
      expect(v[6], 'printed m repeated').toBe(v[4]);
      expect(v[7], 'printed x repeated').toBe(v[0]);
      expect(v[8], 'printed y repeated').toBe(v[2]);
      return { x: v[0], gx: v[1], y: v[2], gy: v[3], m: v[4], gm: v[5], alpha: v[9] };
    },
    space: p => spaceChord.has(key(P(p, 'x'), P(p, 'y'), P(p, 'alpha'), P(p, 'm'), P(p, 'gx'), P(p, 'gy'), P(p, 'gm'))), count: 3432,
  },
  'GP-17:tail-growth': {
    fields: p => [Math.exp(2 * (Math.log(P(p, 'b')) - Math.log(P(p, 'a'))))],
    wrongs: p => { const r = P(p, 'b') / P(p, 'a'); return [r, r ** 3, r - 1, r * r / 2]; },
    parse: (c, lang) => { const [a, b] = grab(c.prompt, new RegExp(lang === 'en' ? String.raw`from t = ${NUM} to t = ${NUM}\.` : String.raw`从 t = ${NUM} 移到 t = ${NUM}。`), 2); return { a, b }; },
    space: p => spaceTail.has(key(P(p, 'a'), P(p, 'b'))), count: 12,
  },
  'GP-17:challenge': {
    fields: p => {
      const s = sTab(P(p, 'p1'), P(p, 'p2'));
      return [[1, 2, 3].reduce((a, i) => a * s(P(p, `f${i}`) * P(p, `y${i}`)), 1)];
    },
    wrongs: p => challengeWrong(P(p, 'p1'), P(p, 'p2'), [1, 2, 3].map(i => [P(p, `f${i}`), P(p, `y${i}`)] as [number, number])).wrongs,
    parse: (c, lang) => {
      const t = norm(c.prompt);
      const [p1, p2] = grab(t, new RegExp(lang === 'en' ? String.raw`σ\(1\) = ${NUM} and σ\(2\) = ${NUM}\.` : String.raw`σ\(1\) = ${NUM}，σ\(2\) = ${NUM}。`), 2);
      const m = t.match(new RegExp(lang === 'en'
        ? String.raw`\(f₁, y₁\) = \(${NUM}, ${NUM}\), \(f₂, y₂\) = \(${NUM}, ${NUM}\) and \(f₃, y₃\) = \(${NUM}, ${NUM}\)\.`
        : String.raw`\(f₁, y₁\) = \(${NUM}, ${NUM}\)，\(f₂, y₂\) = \(${NUM}, ${NUM}\)，\(f₃, y₃\) = \(${NUM}, ${NUM}\)。`));
      if (!m) throw new Error('challenge points ' + t);
      const v = m.slice(1).map(Number);
      return { p1, p2, f1: v[0], y1: v[1], f2: v[2], y2: v[3], f3: v[4], y3: v[5] };
    },
    space: p => spaceChallenge.has(key(P(p, 'p1'), P(p, 'p2'), P(p, 'f1'), P(p, 'y1'), P(p, 'f2'), P(p, 'y2'), P(p, 'f3'), P(p, 'y3'))), count: 612,
  },
};
const SLUG_OF: Record<string, string> = { 'GP-17:odds': 'odds', 'GP-17:flip-label': 'flip-label', 'GP-17:weight-gauss': 'weight-gauss', 'GP-17:chord-gap': 'chord-gap', 'GP-17:tail-growth': 'tail-growth', 'GP-17:challenge': 'challenge' };

describe('GP-17 independent oracle', () => {
  it('has the nine planned cards in order, with ids, one field per numeric card and tolerance 0.006', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const cards = cardsOf(spreadSeed(i), lang);
      expect(cards.map(c => c.id)).toEqual(['range-check', 'odds', 'flip-label', 'why-approx', 'weight-gauss', 'chord-gap', 'one-pair', 'tail-growth', 'challenge'].map(s => `GP-17-${s}`));
      for (const c of cards) {
        if (c.fields) { expect(c.fields).toHaveLength(1); expect(c.fields[0].tolerance, c.id).toBe(0.006); expect(c.audit?.kind, c.id).toBeDefined(); }
        else expect(c.audit, c.id).toBeUndefined();
        expect(c.figure, c.id).toBeUndefined();
      }
    }
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
        const expected = o.fields(printed)[0];
        expect(Math.abs(expected - card.fields![0].answer), `${where}: expected ${expected} got ${card.fields![0].answer}`).toBeLessThan(1e-4);
        expect(gradeCard(card, [String(expected)], null, []), where).toBe('correct');
        expect(gradeCard(card, [String(Number(expected.toFixed(2)))], null, []), `${where} rounded to 2 places`).toBe('correct');
        for (const d of [0.02, -0.02, 0.1, -0.5]) expect(gradeCard(card, [String(expected + d)], null, []), `${where} perturbed ${d}`).toBe('incorrect');
        for (const w of o.wrongs(printed)) {
          expect(Math.abs(w - expected), `${where}: wrong route ${w} collides with truth ${expected}`).toBeGreaterThanOrEqual(0.02 - 1e-12);
          expect(gradeCard(card, [String(w)], null, []), `${where}: wrong route ${w}`).toBe('incorrect');
        }
        expect(o.space(printed), `${where}: ${JSON.stringify(printed)} outside the plan's list`).toBe(true);
      }
    });
    it(`${kind}: sampling space is exactly the plan's (${o.count})`, () => {
      const seen = new Set<string>();
      for (let i = 0; i < MANY; i++) {
        const card = byId(cardsOf(spreadSeed(i), 'en'), SLUG_OF[kind]);
        const p = card.audit!.params as Params;
        expect(o.space(p), `${kind} ${JSON.stringify(p)}`).toBe(true);
        seen.add(JSON.stringify(Object.keys(p).sort().map(k => clean(p[k] as number))));
      }
      if (o.count! <= 60) expect(seen.size).toBe(o.count);
      else expect(seen.size).toBeGreaterThan(Math.min(o.count!, MANY) * 0.5);
    });
  }

  it('plan space sizes by independent enumeration: 7/7/32/6/56/3432/1920/12/612', () => {
    expect([spaceOdds.size, spaceFlip.size, spaceWeight.size, spaceChord.size, spaceOne.size, spaceTail.size, spaceChallenge.size]).toEqual([7, 32, 56, 3432, 1920, 12, 612]);
  });

  it('every audit kind fires on every seed and no unknown kinds appear', () => {
    for (let i = 0; i < SEEDS; i++) {
      const kinds = cardsOf(spreadSeed(i), 'en').filter(c => c.audit).map(c => c.audit!.kind).sort();
      expect(kinds).toEqual(Object.keys(oracles).sort());
    }
  });

  it('goodness of fit: the audit param ranges (tolerance, truth values are exact fractions with denominators in {1,2,4,5,8,10})', () => {
    for (let i = 0; i < SEEDS; i++) {
      const cards = cardsOf(spreadSeed(i), 'en');
      for (const c of cards) if (c.fields && c.id !== 'GP-17-challenge') {
        const a = c.fields[0].answer;
        expect([1, 2, 4, 5, 8, 10].some(d => Math.abs(a * d - Math.round(a * d)) < 1e-9), `${c.id} answer ${a}`).toBe(true);
      }
      const ch = byId(cards, 'challenge').fields![0].answer;
      expect(Math.abs(ch * 1000 - Math.round(ch * 1000))).toBeLessThan(1e-6);
    }
  });

  it('range-check: exactly one option satisfies the predicate (the logistic one), answer index points to it, printed values correct', () => {
    const fs = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const card = byId(cardsOf(spreadSeed(i), lang), 'range-check');
      const where = `range seed ${spreadSeed(i)} ${lang}`;
      const f = grab(card.prompt, new RegExp(lang === 'en' ? String.raw`latent value f = ${NUM} at` : String.raw`潜变量值 f = ${NUM}。`), 1)[0];
      expect(card.prompt.match(new RegExp(String.raw`f = ${NUM}`.replace(NUM, String(f).replace('.', String.raw`\.`)), 'g'))!.length, where).toBeGreaterThanOrEqual(2);
      fs.add(f);
      expect([1.5, 2, 2.5, 3, 3.5, 4, 5]).toContain(f);
      const opts = card.choice!.options.map(norm);
      // option "value" = number after "= ... =" ; parse by the shape of each option
      const isLogistic = (t: string) => /σ\(f\)/.test(t);
      expect(opts.filter(isLogistic), where).toHaveLength(1);
      expect(opts[card.choice!.answer], where).toMatch(/σ\(f\)/);
      const val = (re: RegExp) => { const o = opts.find(t => re.test(t))!; return Number(o.match(re)![1]); };
      expect(val(/σ\(f\) = (\d+(?:\.\d+)?)/)).toBeCloseTo(logistic(f), 2);
      expect(val(/exp\(f\) = (\d+(?:\.\d+)?)/)).toBeCloseTo(Math.exp(f), 2);
      expect(val(/f² = (\d+(?:\.\d+)?)/)).toBeCloseTo(f * f, 9);
      expect(val(/π = f = (\d+(?:\.\d+)?)/)).toBeCloseTo(f, 9);
      // predicate: bounded in (0,1) for all real z tested
      const bounded: Record<string, (z: number) => number> = { 'σ(f)': logistic, 'f²': z => z * z, 'exp(f)': Math.exp, 'π = f ': z => z };
      const inRange = (g: (z: number) => number) => [-30, -3, -0.5, 0, 0.5, 3, 30, 10, f].every(z => g(z) > 0 && g(z) < 1);
      const good = Object.entries(bounded).filter(([, g]) => inRange(g)).map(([k]) => k);
      expect(good).toEqual(['σ(f)']);
    }
    expect([...fs].length).toBeGreaterThanOrEqual(6);
  });

  it('why-approx: correct option is the Gaussian-noise regression one with the printed s; no other option has σₙ²', () => {
    const seen = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const card = byId(cardsOf(spreadSeed(i), lang), 'why-approx');
      const opts = card.choice!.options.map(norm);
      const g = opts.filter(t => t.includes('σₙ²'));
      expect(g).toHaveLength(1);
      expect(opts[card.choice!.answer]).toBe(g[0]);
      const s = Number(g[0].match(new RegExp(String.raw`σₙ² = ${NUM}`))![1]);
      expect([0.1, 0.25, 0.5, 1, 2, 4]).toContain(s);
      seen.add(s);
      const logi = opts.filter(t => /σ\(y·f\)|Φ\(y·f\)/.test(t));
      expect(logi).toHaveLength(2);
      const heavy = opts.filter(t => /重尾|heavy-tailed/.test(t));
      expect(heavy).toHaveLength(1);
    }
    expect(seen.size).toBe(6);
  });

  it('one-pair: exactly one true option per variant, answer index points to it, printed values = plan', () => {
    const variants = new Set<string>();
    for (let i = 0; i < SEEDS * 3; i++) for (const lang of ['en', 'zh'] as const) {
      const card = byId(cardsOf(spreadSeed(i), lang), 'one-pair');
      const where = `one-pair seed ${spreadSeed(i)} ${lang}`;
      const t = norm(card.prompt);
      const m = t.match(new RegExp(lang === 'en'
        ? String.raw`h\(${NUM}\) = ${NUM}, h\(${NUM}\) = ${NUM}, h\(${NUM}\) = ${NUM}, where ${NUM} = \(${NUM} \+ ${NUM}\)/2\.`
        : String.raw`h\(${NUM}\) = ${NUM}，h\(${NUM}\) = ${NUM}，h\(${NUM}\) = ${NUM}，其中 ${NUM} = \(${NUM} \+ ${NUM}\)/2。`));
      if (!m) throw new Error(where + ' ' + t);
      const [x, gx, m1, gm, y, gy, m2, x2, y2] = m.slice(1).map(Number);
      expect(m1).toBe(m2); expect(x2).toBe(x); expect(y2).toBe(y);
      expect(spaceOne.has(key(x, y, m1, gx, gy, gm)), where).toBe(true);
      expect(m1).toBe((x + y) / 2);
      const C = (gx + gy) / 2;
      const violated = gm < C;
      variants.add(violated ? 'V' : 'H');
      const opts = card.choice!.options.map(norm);
      const prefix = lang === 'en' ? (violated ? 'Not log-concave' : 'No conclusion yet') : (violated ? '不是对数凹' : '还不能判断');
      const truthful = opts.filter(o => o.startsWith(prefix));
      expect(truthful, where).toHaveLength(1);
      expect(card.choice!.answer, where).toBe(opts.indexOf(truthful[0]));
      // the other variant's phrase appears in no option that is true
      const otherPrefix = lang === 'en' ? (violated ? 'No conclusion yet' : 'Not log-concave') : (violated ? '还不能判断' : '不是对数凹');
      if (!violated) expect(opts.filter(o => o.startsWith(otherPrefix)), where).toHaveLength(1); // H-w2 "Not log-concave: all three negative" is a false distractor
      if (violated) {
        expect(truthful[0], where).toContain(`h(${m1}) = ${gm}`.replace('-', '-'));
        expect(truthful[0].includes(String(C)), `${where}: names C=${C}`).toBe(true);
      }
      const longestWrong = Math.max(...card.choice!.options.filter((_, k) => k !== card.choice!.answer).map(o => o.length));
      expect(card.choice!.options[card.choice!.answer].length, `${where} correct option not the longest`).toBeLessThan(longestWrong);
      // no false option names the true verdict: for V the distractors never claim non-concavity
      if (violated) for (const o of opts) if (o !== truthful[0]) expect(/not log-concave|不是对数凹/i.test(o), where).toBe(false);
    }
    expect([...variants].sort()).toEqual(['H', 'V']);
  });

  it('every choice card: correct option is not the longest in EN and ZH', () => {
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
    for (const s of Object.values(idx)) expect(s.size).toBeGreaterThanOrEqual(3);
  });

  it('variety: at least 6 distinct prompts per card over 60 seeds (cards 1 and 4 by prompt+options)', () => {
    for (const slug of ['range-check', 'odds', 'flip-label', 'why-approx', 'weight-gauss', 'chord-gap', 'one-pair', 'tail-growth', 'challenge']) {
      const seen = new Set<string>();
      for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
        const c = byId(cardsOf(spreadSeed(i), lang), slug);
        seen.add(lang + c.prompt + (c.choice?.options.join('|') ?? ''));
      }
      expect(seen.size / 2, slug).toBeGreaterThanOrEqual(6);
    }
  });

  it('labels, titles and learner-visible text conventions', () => {
    const LABEL_EN: Record<string, string> = { odds: 'Class probability p(y = +1)', 'flip-label': 'Likelihood p(y | f)', 'weight-gauss': 'Curvature weight Wᵢᵢ', 'chord-gap': 'Left side minus right side', 'tail-growth': 'Growth factor of the probit penalty', challenge: 'Likelihood p(y | f)' };
    const LABEL_ZH: Record<string, string> = { odds: '类别概率 p(y = +1)', 'flip-label': '似然 p(y | f)', 'weight-gauss': '曲率权重 Wᵢᵢ', 'chord-gap': '左边减右边', 'tail-growth': '概率单位惩罚的增长倍数', challenge: '似然 p(y | f)' };
    const TITLE_EN = ['A valid class probability', 'From odds to probability', 'The likelihood of a label', 'When is the posterior still Gaussian?', 'The curvature weight of a Gaussian likelihood', 'Testing the concavity inequality', 'One check is not a proof', 'How hard is a mislabelled point punished?', 'Challenge: the likelihood of three labels'];
    const TITLE_ZH = ['合法的类别概率', '从几率到概率', '标签的似然', '后验何时仍是高斯的？', '高斯似然的曲率权重', '检验凹性不等式', '检查一次不是证明', '错标的点受到多重的惩罚？', '挑战：三个标签的似然'];
    const ALLOWED_LATIN_ZH = new Set(['log', 'exp', 'GP', 'KL', 'ELBO', 'GPML', 'pdf', 'Wᵢᵢ']);
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      const cards = cardsOf(spreadSeed(i), lang);
      cards.forEach((c, k) => {
        const where = `${c.id} ${lang} seed ${spreadSeed(i)}`;
        expect(c.title, where).toBe((lang === 'en' ? TITLE_EN : TITLE_ZH)[k]);
        if (c.fields) expect(c.fields[0].label, where).toBe((lang === 'en' ? LABEL_EN : LABEL_ZH)[c.id.slice(6)]);
        const texts = [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];
        for (const t of texts) {
          expect(t, `${where}: ASCII hyphen as minus`).not.toMatch(/(^|[\s(,=≈:·])-\d/);
          expect(t, where + ' double parentheses').not.toMatch(/\(\(-?\d+(\.\d+)?\)|\(\(−\d/);
          expect(t, where + ' raw float').not.toMatch(/\d\.\d{4,}/);
          expect(t, where + ' marker').not.toMatch(/undefined|NaN|\[object|Infinity|DERIVED|NOT IN SOURCES|TODO|\$\{|\{[A-Za-z0-9_ ]+\}|\bo_a\b|\bgx\b|\balpha\b|\^|\\n/);
          expect(t, where + ' unicode minus + hyphen mix').not.toMatch(/[+−]\s*[-−]\s*\d/);
          expect(t, where + ' ASCII quote in ZH').not.toMatch(lang === 'zh' ? /["']/ : /$^/);
          expect(t, where + ' needless unity coefficient').not.toMatch(/(?<![\d.,A-Za-z_])1\.0+(?!\d)/);
          if (c.id !== 'GP-17-range-check') expect(t, where + ' trailing zeros').not.toMatch(/\d\.\d*0(?![\d.])(?!%)/);
          expect(t, where + ' n/1 fraction').not.toMatch(/(?<![\d./])(?!0\/1)\d+\/1(?![\d./])/);
          for (const m of norm(t).matchAll(/(?<![\d./])(\d+)\/(\d+)(?![\d./])/g)) {
            const a = Number(m[1]), b = Number(m[2]);
            // unreduced forms are only allowed where the plan prints raw sampled pairs (odds a/b, tail b/a, alpha-free)
            if (gcd(a, b) > 1) expect(['GP-17-odds', 'GP-17-tail-growth'].includes(c.id) || a === 2 && b === 4, `${where}: unreduced ${m[0]}`).toBe(true);
          }
          if (lang === 'zh') for (const w of t.match(/[A-Za-z]{2,}/g) ?? []) expect(ALLOWED_LATIN_ZH.has(w), `${where}: English word "${w}" in ZH: ${t.slice(0, 80)}`).toBe(true);
        }
        if (c.fields) for (const m of [c.prompt, c.explanation]) void m;
        expect(c.hint, where).not.toBe(c.explanation);
      });
    }
  });

  it('no answer in the hint: the hint contains no printed answer value', () => {
    for (let i = 0; i < SEEDS; i++) {
      const cards = cardsOf(spreadSeed(i), 'en');
      for (const c of cards) if (c.fields) {
        const a = c.fields[0].answer;
        const nums = norm(c.hint).match(/-?\d+(\.\d+)?/g) ?? [];
        for (const n of nums) {
          // hints may repeat input numbers but must not contain the answer when it differs from every printed input
          const inputs = norm(c.prompt).match(/-?\d+(\.\d+)?/g)!.map(Number);
          if (!inputs.includes(a)) expect(Number(n), `${c.id} hint reveals ${a}`).not.toBeCloseTo(a, 6);
        }
      }
    }
  });

  it('explanation states the answer value (numeric cards): the explanation contains the accepted answer in some printed form', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as const) {
      for (const c of cardsOf(spreadSeed(i), lang)) if (c.fields) {
        const a = c.fields[0].answer;
        const e = norm(c.explanation);
        const frac = (() => { for (const d of [1, 2, 4, 5, 8, 10]) { const n = Math.round(a * d); if (Math.abs(n / d - a) < 1e-9) return [`${n}/${d}`, String(a), String(n / d)]; } return [String(a)]; })();
        const dec = [String(a), String(Number(a.toFixed(3))), String(Number(a.toFixed(2)))];
        expect([...frac, ...dec].some(s => e.includes(s)), `${c.id} ${lang} seed ${spreadSeed(i)}: explanation lacks ${a}: ${e}`).toBe(true);
      }
    }
  });

  it('explanation numbers equal the answer: key equations in the explanations hold', () => {
    for (let i = 0; i < SEEDS; i++) {
      const cards = cardsOf(spreadSeed(i), 'en');
      const ch = byId(cards, 'challenge');
      const e = norm(ch.explanation);
      expect(e).toContain(`= ${clean(ch.fields![0].answer)}`);
      const cg = byId(cards, 'chord-gap');
      const T = cg.fields![0].answer;
      const fr = [1, 2, 4].map(d => ({ d, n: Math.round(T * d) })).find(({ d, n }) => Math.abs(n / d - T) < 1e-9)!;
      const gc = (x: number, y: number): number => (y ? gc(y, x % y) : Math.abs(x));
      const g0 = gc(fr.n, fr.d) || 1, txt = fr.d / g0 === 1 ? String(fr.n / g0) : `${fr.n / g0}/${fr.d / g0}`;
      expect(norm(cg.explanation)).toContain(`= ${txt}.`);
    }
  });
});
