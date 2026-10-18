import { describe, expect, it } from 'vitest';
import { gp15 } from './games/gp15';
import { spreadSeed, deckProblems, textLintProblems, textOf, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { simpson } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard, parseGameNumber, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const SPACE_SEEDS = 4000;
const TOL = 0.006;
const PI = Math.PI;
const LANGS: GameLanguage[] = ['en', 'zh'];
const IDS = ['ss-kernel', 'ss-return', 'freq-from-cos', 'spectrum-at-zero', 'process-variance', 'sm-value', 'envelope', 'negative-weight', 'challenge'];
const KINDS = ['ss-kernel', 'ss-return', 'freq-from-cos', 'spectrum-at-zero', 'process-variance', 'sm-value', 'challenge'].map(k => `GP-15:${k}`);

const norm = (text: string) => text.replaceAll('−', '-').replaceAll(' ', ' ');
const slug = (card: PracticeCard) => card.id.replace(/^GP-15-/, '');
const deck = (seed: number, lang: GameLanguage) => gp15(seed, lang);
const byId = (cards: PracticeCard[], id: string) => cards.find(c => slug(c) === id)!;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => a * b / gcd(a, b);
const key = (...v: number[]) => v.join(',');

// ---------- independent numerics ----------
/** mean over the ± spikes of exp(2πi ω τ): the real part of the complex sum. */
function spikeSum(weights: number[], freqs: number[], tau: number): number {
  let re = 0;
  weights.forEach((w, i) => {
    const th = 2 * PI * freqs[i] * tau;
    // (w/2)(e^{iθ} + e^{-iθ}) real part, summing the two spikes separately
    re += (w / 2) * (Math.cos(th) + Math.cos(-th));
  });
  return re;
}
const gauss = (w: number, m: number, s: number) => Math.exp(-((w - m) ** 2) / (2 * s * s)) / (Math.sqrt(2 * PI) * s);
const sqrtD = (x: number) => Math.sqrt(x);

type P = Record<string, number>;
const getK = (p: P, n: number) => Array.from({ length: n }, (_, i) => p[`k${i + 1}`]);

const oracle: Record<string, (p: P) => number> = {
  'GP-15:ss-kernel': p => { const ks = getK(p, p.Q); return spikeSum(ks.map(() => 1 / p.Q), ks.map(k => k / 6), p.tau); },
  'GP-15:ss-return': p => { for (let t = 1; t < 1000; t++) if (Math.abs((Math.cos(2 * PI * t / p.p1) + Math.cos(2 * PI * t / p.p2)) / 2 - 1) < 1e-12) return t; throw new Error('no return'); },
  'GP-15:freq-from-cos': p => {
    // first tau > 0 with cos(k pi tau / m) = 1, found by scan on a fine grid of multiples of 1/(8k)
    const period = (() => { for (let i = 1; i < 100000; i++) { const t = i / (60 * p.k); if (Math.abs(Math.cos(p.k * PI * t / p.m) - 1) < 1e-9) return t; } throw new Error('no period'); })();
    return 1 / period;
  },
  'GP-15:spectrum-at-zero': p => simpson(t => p.s * Math.exp(-Math.abs(t) / p.l), -60 * p.l, 0, 24000) + simpson(t => p.s * Math.exp(-Math.abs(t) / p.l), 0, 60 * p.l, 24000),
  'GP-15:process-variance': p => simpson(w => p.a1 * gauss(w, p.m1, p.s1) + p.a2 * gauss(w, p.m2, p.s2), -10, 10, 40000),
  'GP-15:sm-value': p => p.a * p.d * Math.cos(2 * PI * (p.k / 6) * p.tau),
  'GP-15:challenge': p => spikeSum([p.w1, p.w2], [p.k1 / 6, p.k2 / 6], p.tau),
};
/** the exact value of the SM component by quadrature of the spectrum (differs from the printed-d key by < 0.005). */
const smTrue = (p: P) => simpson(w => p.a * gauss(w, p.k / 6, p.sigma) * Math.cos(2 * PI * p.tau * w), -5, 5, 40000);
/** Wrong routes of the plan: each must differ from the truth by at least 0.02 on every draw. */
const wrongRoutes: Record<string, (p: P) => number[]> = {
  'GP-15:ss-kernel': p => {
    const ks = getK(p, p.Q), c = ks.map(k => Math.cos(2 * PI * (k / 6) * p.tau)), Q = p.Q;
    const sum = c.reduce((a, b) => a + b, 0), meanW = ks.reduce((a, b) => a + b, 0) / Q / 6, sumW = ks.reduce((a, b) => a + b, 0) / 6;
    const r = [sum, ks.reduce((a, k) => a + Math.cos(k * p.tau / 6), 0) / Q, Math.cos(2 * PI * meanW * p.tau), Math.cos(2 * PI * sumW * p.tau) / Q, c[0]];
    if (Q === 4) r.push(sum / 2);
    return r;
  },
  'GP-15:ss-return': p => [p.p1 * p.p2, Math.max(p.p1, p.p2), p.p1 + p.p2, (p.p1 + p.p2) / 2, gcd(p.p1, p.p2), p.p1 * p.p2 / (p.p1 + p.p2), Math.min(p.p1, p.p2)],
  'GP-15:freq-from-cos': p => [p.k / p.m, 2 * p.m / p.k, p.k / (2 * PI * p.m), 2 * p.k / p.m, p.k / (4 * p.m), 1 / (2 * p.m)],
  'GP-15:spectrum-at-zero': p => [p.s * p.l, p.s / p.l, 2 * p.s / p.l, p.s * p.l / PI, p.s * p.l * p.l, 4 * p.s * p.l, 2 * p.s],
  'GP-15:process-variance': p => [(p.a1 + p.a2) / 2, p.a1 * p.a2, p.a1 * p.m1 + p.a2 * p.m2, p.a1 * p.s1 + p.a2 * p.s2, Math.max(p.a1, p.a2), p.a1 * p.s1 ** 2 + p.a2 * p.s2 ** 2, p.s1 + p.s2, p.m1 + p.m2],
  'GP-15:sm-value': p => {
    const c = Math.cos(2 * PI * (p.k / 6) * p.tau), T = p.a * p.d * c, s = p.sigma, t = p.tau;
    return [p.a * c, p.a * p.d, p.a * p.d * Math.cos(p.k * t / 6), -T, p.a * Math.exp(-2 * PI * s * s * t * t) * c, p.a * Math.exp(-2 * PI * PI * s * t * t) * c, p.a * sqrtD(p.d) * c];
  },
  'GP-15:challenge': p => {
    const c1 = Math.cos(2 * PI * p.k1 / 6 * p.tau), c2 = Math.cos(2 * PI * p.k2 / 6 * p.tau), T = p.w1 * c1 + p.w2 * c2;
    return [T / 2, 2 * T, p.w1 + p.w2, p.w2 * c1 + p.w1 * c2, p.w1 * Math.cos(p.k1 * p.tau / 6) + p.w2 * Math.cos(p.k2 * p.tau / 6), p.w1 * c1, p.w2 * c2, c1 + c2];
  },
};

// ---------- parsing printed numbers (EN and ZH) ----------
const ZHsep = String.raw`\s*[,，、]\s*`;
function parse(kind: string, text: string): P {
  const t = norm(text);
  const m = (re: RegExp) => { const r = re.exec(t); if (!r) throw new Error(`cannot parse ${re} in: ${t}`); return r; };
  const fracK = (re: RegExp) => [...t.matchAll(re)].map(x => Number(x[1]));
  switch (kind) {
    case 'GP-15:ss-kernel': {
      const ks = fracK(/ω[₁₂₃₄] = (\d+)\/6/g);
      const p: P = { Q: Number(m(/Q = (\d)/)[1]), tau: Number(m(/τ = (\d+)/)[1]) };
      ks.forEach((k, i) => { p[`k${i + 1}`] = k; });
      return p;
    }
    case 'GP-15:ss-return': return { p1: Number(m(/ω₁ = 1\/(\d+)/)[1]), p2: Number(m(/ω₂ = 1\/(\d+)/)[1]) };
    case 'GP-15:freq-from-cos': { const r = m(/K\(τ\) = cos\((\d+)πτ(?:\/(\d+))?\)/); return { k: Number(r[1]), m: r[2] ? Number(r[2]) : 1 }; }
    case 'GP-15:spectrum-at-zero': { const r = m(/K\(τ\) = (?:(\d+)·)?exp/); return { s: r[1] ? Number(r[1]) : 1, l: Number(m(/ℓ = (\d+(?:\.\d+)?)/)[1]) }; }
    case 'GP-15:process-variance': {
      const comps = [...t.matchAll(/(?:(\d+(?:\.\d+)?)·)?N\(ω [|∣] (\d+(?:\.\d+)?), \((\d+(?:\.\d+)?)\)²\)/g)];
      // the definition "N(ω | μ, σ²)" does not match: it has no parenthesised number
      expect(comps.length, t).toBe(2);
      const g = (x: RegExpMatchArray) => [x[1] ? Number(x[1]) : 1, Number(x[2]), Number(x[3])];
      const [a1, m1, s1] = g(comps[0]), [a2, m2, s2] = g(comps[1]);
      return { a1, a2, m1, m2, s1, s2 };
    }
    case 'GP-15:sm-value': {
      const r = m(new RegExp(`a = (\\d+(?:\\.\\d+)?)${ZHsep}μ = (\\d+)/6${ZHsep}σ = (\\d+(?:\\.\\d+)?)(?: and |${ZHsep})τ = (\\d+)`));
      const d = m(/(?:equals|等于) (\d+(?:\.\d+)?)/);
      return { a: Number(r[1]), k: Number(r[2]), sigma: Number(r[3]), tau: Number(r[4]), d: Number(d[1]) };
    }
    case 'GP-15:challenge': {
      const w = m(/\((\d+)\/2\)·\[δ\(ω - ω₁\) \+ δ\(ω \+ ω₁\)\] \+ \((\d+)\/2\)·\[δ\(ω - ω₂\)/);
      const ks = fracK(/ω[₁₂] = (\d+)\/6/g);
      return { w1: Number(w[1]), w2: Number(w[2]), k1: ks[0], k2: ks[1], tau: Number(m(/K\((\d+)\)/)[1]) };
    }
  }
  throw new Error(kind);
}

// ---------- the plan's explicit sampling spaces, enumerated independently ----------
const C6 = [1, 0.5, -0.5, -1, -0.5, 0.5];
const far = (T: number, others: number[]) => others.every(o => Math.abs(o - T) >= 0.02);
function spaceSsKernel(): Set<string> {
  const out = new Set<string>();
  const ksets: number[][] = [];
  for (let a = 1; a <= 6; a++) for (let b = a + 1; b <= 6; b++) {
    ksets.push([a, b]);
    for (let c = b + 1; c <= 6; c++) for (let d = c + 1; d <= 6; d++) ksets.push([a, b, c, d]);
  }
  for (const ks of ksets) for (const tau of [1, 2, 3]) {
    const p: P = { Q: ks.length, tau }; ks.forEach((k, i) => { p[`k${i + 1}`] = k; });
    const T = ks.reduce((a, k) => a + C6[(k * tau) % 6], 0) / ks.length;
    if (Math.abs(T) < 1e-12 || Math.abs(T - 1) < 1e-12) continue;
    if (!far(T, wrongRoutes['GP-15:ss-kernel'](p))) continue;
    out.add(key(ks.length, ...ks, tau));
  }
  return out;
}
const SPACE_RETURN = new Set(['4,6', '4,10', '4,14', '6,8', '6,9', '6,10', '6,15', '8,12', '9,12', '10,15']);
const SPACE_FREQ = new Set('2,2 2,4 2,5 3,1 3,2 3,4 3,5 4,1 4,4 4,5 5,1 5,2 5,4 5,5 6,1 6,2 6,4 6,5 8,1 8,2 8,5'.split(' ').map(s => s.replace(' ', '')));
function spaceZero(): Set<string> {
  const out = new Set<string>();
  for (const s of [1, 2, 3, 4]) for (const l of [0.5, 2.5, 3]) if (far(2 * s * l, wrongRoutes['GP-15:spectrum-at-zero']({ s, l }))) out.add(key(s, l));
  return out;
}
function spaceVariance(): Set<string> {
  const out = new Set<string>();
  const A = [0.5, 1, 1.5, 2, 2.5, 3], M = [0.5, 1, 2], S = [0.1, 0.2, 0.25];
  for (const a1 of A) for (const a2 of A) if (a1 !== a2) for (const m1 of M) for (const m2 of M) for (const s1 of S) for (const s2 of S) {
    const p = { a1, a2, m1, m2, s1, s2 };
    if (far(a1 + a2, wrongRoutes['GP-15:process-variance'](p))) out.add(key(a1, a2, m1, m2, s1, s2));
  }
  return out;
}
const D_TABLE: Record<string, number> = { '0.05,1': 0.95, '0.05,2': 0.82, '0.05,3': 0.64, '0.1,1': 0.82, '0.1,2': 0.45, '0.15,1': 0.64, '0.2,1': 0.45 };
function spaceSm(): Set<string> {
  const out = new Set<string>();
  for (const a of [1, 2]) for (const k of [1, 2, 3, 4, 5]) for (const tau of [1, 2, 3]) for (const sigma of [0.05, 0.1, 0.15, 0.2]) {
    const d = D_TABLE[`${sigma},${tau}`]; if (d === undefined) continue;
    const c = C6[(k * tau) % 6]; if (c === 0) continue;
    const p = { a, k, tau, sigma, d }, T = a * d * c;
    if (far(T, wrongRoutes['GP-15:sm-value'](p)) && Math.abs(T - a * Math.exp(-2 * PI * PI * sigma * sigma * tau * tau) * c) <= 0.005) out.add(key(a, k, tau, sigma));
  }
  return out;
}
function spaceChallenge(): Set<string> {
  const out = new Set<string>();
  for (const w1 of [1, 2, 3, 4]) for (const w2 of [1, 2, 3, 4]) if (w1 !== w2) for (let k1 = 1; k1 <= 6; k1++) for (let k2 = k1 + 1; k2 <= 6; k2++) for (const tau of [1, 2, 3]) {
    const c1 = C6[(k1 * tau) % 6], c2 = C6[(k2 * tau) % 6];
    if (c1 === c2) continue;
    const T = w1 * c1 + w2 * c2; if (T === 0) continue;
    if (far(T, wrongRoutes['GP-15:challenge']({ w1, w2, k1, k2, tau }))) out.add(key(w1, w2, k1, k2, tau));
  }
  return out;
}
const SPACE_NEG = new Set('2,1 3,1 3,2 4,1 4,2 4,3 5,1 5,2 5,3 5,4'.split(' '));
const SIGMAS = [0.05, 0.1, 0.15, 0.2, 0.25];

// ---------- text helpers ----------
function numbersIn(text: string): number[] {
  const t = norm(text).replace(/(-?)(\d+)\s*\/\s*(\d+)/g, (_m, sg, a, b) => ` ${sg}${Number(a) / Number(b)} `);
  return [...t.matchAll(/-?\d+(?:\.\d+)?/g)].map(x => Number(x[0]));
}
const cardsFor = (i: number, lang: GameLanguage) => deck(spreadSeed(i), lang);
const answerOf = (card: PracticeCard) => card.fields![0].answer;

describe('GP-15 structure', () => {
  it('has the nine planned cards in order, on every seed and language, with the right modes', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = cardsFor(i, lang);
      expect(cards.map(slug)).toEqual(IDS);
      expect(cards.every(c => c.id.startsWith('GP-15-'))).toBe(true);
      const mode = (c: PracticeCard) => (c.fields ? 'n' : c.choice ? 'c' : c.slots ? 's' : '?');
      expect(cards.map(mode).join('')).toBe('nnnnnnccn');
      for (const c of cards) expect(c.figure ?? c.choice?.figures, `${c.id} figure`).toBeUndefined();
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind);
      expect(kinds, `seed ${i}`).toEqual(KINDS);
      expect(cards.find(c => c.choice)?.audit).toBeUndefined();
      for (const c of cards) if (c.fields) {
        expect(c.fields).toHaveLength(1);
        expect(c.fields[0].tolerance, c.id).toBe(TOL);
      }
    }
  });
  it('passes the shared structural gates', () => {
    expect(deckProblems('GP-15', gp15, 'topic', 200)).toEqual([]);
    expect(textLintProblems('GP-15', gp15, 200)).toEqual([]);
  });
});

describe('GP-15 numeric cards: independent recomputation', () => {
  for (const kind of KINDS) {
    it(`${kind}: answer, grading, printed text = audit params, wrong routes (60 spread seeds, EN and ZH)`, () => {
      let n = 0;
      for (let i = 0; i < SEEDS; i++) {
        const per: Record<string, number> = {};
        for (const lang of LANGS) {
          const card = cardsFor(i, lang).find(c => c.audit?.kind === kind)!;
          const p = card.audit!.params as P;
          const where = `${kind} seed#${i} ${lang} ${JSON.stringify(p)}`;
          // printed text = audit params
          const printed = parse(kind, card.prompt);
          expect(printed, where).toEqual(p);
          // independent answer
          const exp = oracle[kind](p);
          const ans = answerOf(card);
          expect(Math.abs(exp - ans), `${where}: oracle ${exp} vs card ${ans}`).toBeLessThanOrEqual(kind === 'GP-15:sm-value' ? 1e-9 : 1e-6);
          per[lang] = ans;
          // grading through gradeCard: accepted forms correct, perturbed beyond tolerance wrong
          const ok = (s: string) => gradeCard(card, [s], null, []);
          expect(ok(String(exp)), where).toBe('correct');
          expect(ok(exp.toFixed(2)), `${where} ${exp.toFixed(2)}`).toBe('correct');
          expect(ok(String(exp + 0.0065)), where).toBe('incorrect');
          expect(ok(String(exp - 0.0065)), where).toBe('incorrect');
          expect(ok(''), where).toBe('incomplete');
          // wrong routes never grade correct and differ by at least 0.02
          for (const w of wrongRoutes[kind](p)) {
            expect(Math.abs(w - exp), `${where}: wrong route ${w} collides with ${exp}`).toBeGreaterThanOrEqual(0.02);
            expect(ok(String(w)), `${where}: wrong route ${w}`).toBe('incorrect');
          }
          // kind specific
          if (kind === 'GP-15:sm-value') {
            expect(Math.abs(smTrue(p) - exp), `${where}: key vs true value`).toBeLessThanOrEqual(0.005);
            expect(D_TABLE[`${p.sigma},${p.tau}`], where).toBe(p.d);
            expect(Math.abs(p.d - Math.exp(-2 * PI * PI * p.sigma ** 2 * p.tau ** 2))).toBeLessThanOrEqual(0.005);
          }
          if (kind === 'GP-15:ss-return' || kind === 'GP-15:spectrum-at-zero') expect(Number.isInteger(ans), where).toBe(true);
          if (kind === 'GP-15:ss-return') expect(ans).toBe(lcm(p.p1, p.p2));
          if (kind === 'GP-15:ss-kernel') { expect(Math.abs(ans)).not.toBeLessThan(1e-9); expect(Math.abs(ans - 1)).toBeGreaterThan(1e-9); }
          if (kind === 'GP-15:challenge') { expect(ans).not.toBe(0); expect(p.w1).not.toBe(p.w2); }
          if (kind === 'GP-15:process-variance') expect(p.a1).not.toBe(p.a2);
          const needsInteger = kind === 'GP-15:ss-return' || kind === 'GP-15:spectrum-at-zero';
          expect(card.prompt.trim().endsWith(needsInteger ? (lang === 'en' ? 'Give an integer.' : '请填整数。') : (lang === 'en' ? 'Give an integer, a fraction or a decimal rounded to 2 places.' : '请填整数、分数，或保留 2 位小数的小数。')), where).toBe(true);
          // the explanation states the answer; the hint does not
          const eNums = numbersIn(card.explanation);
          expect(eNums.some(x => Math.abs(x - ans) <= TOL), `${where}: explanation does not state ${ans}: ${card.explanation}`).toBe(true);
          const promptNums = new Set(numbersIn(card.prompt).map(x => Math.round(x * 1e6)));
          for (const h of numbersIn(card.hint)) if (Math.abs(h - ans) <= TOL && !promptNums.has(Math.round(h * 1e6)) && ![0, 1].includes(h)) throw new Error(`${where}: hint reveals ${ans}: ${card.hint}`);
          n++;
        }
        expect(per.en, `seed ${i}`).toBe(per.zh);
      }
      expect(n).toBe(SEEDS * 2);
    });
  }
  it('audit kinds are exactly the planned set (no unknown kinds) and params are numbers only', () => {
    for (let i = 0; i < SEEDS; i++) for (const c of cardsFor(i, 'en')) if (c.audit) {
      expect(KINDS).toContain(c.audit.kind);
      for (const v of Object.values(c.audit.params)) expect(typeof v).toBe('number');
    }
  });
  it('field labels are the planned symbols and language-proper', () => {
    const labels: Record<string, string> = { 'ss-kernel': 'K(τ)', 'ss-return': 'τ', 'freq-from-cos': 'ω₀', 'spectrum-at-zero': 'S(0)', 'process-variance': 'k(0)', 'sm-value': 'K(τ)', challenge: 'K(τ)' };
    for (const lang of LANGS) {
      const cards = cardsFor(5, lang);
      for (const [id, label] of Object.entries(labels)) expect(byId(cards, id).fields![0].label, `${id} ${lang}`).toBe(label);
    }
  });
});

describe('GP-15 sampling spaces equal the plan lists', () => {
  const seen: Record<string, Set<string>> = {};
  const addTo = (k: string, v: string) => (seen[k] ??= new Set()).add(v);
  const collect = () => {
    if (Object.keys(seen).length) return;
    for (let i = 0; i < SPACE_SEEDS; i++) {
      const cards = deck(spreadSeed(i + 1000), 'en');
      for (const c of cards) if (c.audit) {
        const p = c.audit.params as P;
        switch (c.audit.kind) {
          case 'GP-15:ss-kernel': addTo('ss', key(p.Q, ...getK(p, p.Q), p.tau)); break;
          case 'GP-15:ss-return': addTo('ret', key(p.p1, p.p2)); break;
          case 'GP-15:freq-from-cos': addTo('freq', key(p.k, p.m)); break;
          case 'GP-15:spectrum-at-zero': addTo('zero', key(p.s, p.l)); break;
          case 'GP-15:process-variance': addTo('var', key(p.a1, p.a2, p.m1, p.m2, p.s1, p.s2)); break;
          case 'GP-15:sm-value': addTo('sm', key(p.a, p.k, p.tau, p.sigma)); break;
          case 'GP-15:challenge': addTo('ch', key(p.w1, p.w2, p.k1, p.k2, p.tau)); break;
        }
      }
      const env = byId(deck(spreadSeed(i + 1000), 'en'), 'envelope');
      const t = norm(env.prompt);
      addTo('env', key(Number(/a = (\d+)/.exec(t)![1]), Number(/μ = (\d+(?:\.\d+)?)/.exec(t)![1]), Number(/Kernel A has σ = (\d+(?:\.\d+)?)/.exec(t)![1]), Number(/kernel B has σ = (\d+(?:\.\d+)?)/.exec(t)![1])));
      const neg = norm(byId(deck(spreadSeed(i + 1000), 'en'), 'negative-weight').prompt);
      const r = /\((\d+)\/2\)·\[δ\(ω - 1\) \+ δ\(ω \+ 1\)\] - \((\d+)\/2\)/.exec(neg)!;
      addTo('neg', key(Number(r[1]), Number(r[2])));
    }
  };
  const equal = (name: string, got: Set<string>, want: Set<string>) => {
    expect([...got].filter(x => !want.has(x)), `${name}: sampled outside the plan list`).toEqual([]);
    expect([...want].filter(x => !got.has(x)), `${name}: plan sets never sampled in ${SPACE_SEEDS} seeds`).toEqual([]);
  };
  it('plan counts reproduce independently', () => {
    expect(spaceSsKernel().size).toBe(27);
    expect(spaceZero().size).toBe(12);
    expect(spaceSm().size).toBe(57);
    expect(spaceVariance().size).toBe(1764);
    expect(spaceChallenge().size).toBe(324);
  });
  it('ss-kernel: exactly the 27 sets', () => { collect(); equal('ss-kernel', seen.ss, spaceSsKernel()); });
  it('ss-return: exactly the 10 pairs', () => { collect(); equal('ss-return', seen.ret, SPACE_RETURN); });
  it('freq-from-cos: exactly the 21 pairs', () => { collect(); equal('freq', seen.freq, SPACE_FREQ); });
  it('spectrum-at-zero: exactly the 12 sets', () => { collect(); equal('zero', seen.zero, spaceZero()); });
  it('process-variance: inside the 1764 passing tuples', () => { collect(); expect([...seen.var].filter(x => !spaceVariance().has(x))).toEqual([]); expect(seen.var.size).toBeGreaterThan(400); });
  it('sm-value: exactly the 57 sets', () => { collect(); equal('sm', seen.sm, spaceSm()); });
  it('challenge: exactly the 324 sets', () => { collect(); equal('challenge', seen.ch, spaceChallenge()); });
  it('envelope: exactly the 20 sigma pairs x a in {1,2,3} x mu in {0.5,1,2}', () => {
    collect();
    const want = new Set<string>();
    for (const a of [1, 2, 3]) for (const mu of [0.5, 1, 2]) for (const x of SIGMAS) for (const y of SIGMAS) if (x !== y) want.add(key(a, mu, x, y));
    expect(want.size).toBe(180);
    equal('envelope', seen.env, want);
  });
  it('negative-weight: exactly the 10 pairs', () => { collect(); equal('negative-weight', seen.neg, SPACE_NEG); });
});

describe('GP-15 choice cards', () => {
  it('envelope: exactly one option satisfies the predicate, the index points to it, correct is not the longest (EN and ZH)', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(cardsFor(i, lang), 'envelope');
      const t = norm(card.prompt);
      const sA = Number(/(?:Kernel A has|核 A 的) σ = (\d+(?:\.\d+)?)/.exec(t)![1]);
      const sB = Number(/(?:kernel B has|核 B 的) σ = (\d+(?:\.\d+)?)/.exec(t)![1]);
      expect(sA).not.toBe(sB);
      const winner = sA < sB ? 'A' : 'B', sX = Math.min(sA, sB);
      const where = `seed#${i} ${lang}`;
      const rx = lang === 'en' ? new RegExp(`^Kernel ${winner}: its smaller σ = ${sX} `) : new RegExp(`^核 ${winner}：较小的 σ = ${sX} `);
      const verdicts = card.choice!.options.map(o => rx.test(norm(o)));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      expect(card.choice!.options).toHaveLength(4);
      // the other kernel's option names the loser with its larger sigma, so the wrong option about the other kernel is really wrong
      const loser = winner === 'A' ? 'B' : 'A', sY = Math.max(sA, sB);
      const wrongNames = card.choice!.options.filter((_, k) => k !== card.choice!.answer).map(norm);
      expect(wrongNames.filter(o => (lang === 'en' ? o.startsWith(`Kernel ${loser}: its larger σ = ${sY} `) : o.startsWith(`核 ${loser}：较大的 σ = ${sY} `))).length, where).toBe(1);
      const lens = card.choice!.options.map(o => o.length);
      const longestWrong = Math.max(...lens.filter((_, k) => k !== card.choice!.answer));
      expect(lens[card.choice!.answer], `${where} lengths ${lens}`).toBeLessThan(longestWrong);
      // numerical truth: the envelope is strictly smaller for the smaller sigma at every tau
      for (const tau of [0.5, 1, 2, 5]) expect(Math.exp(-2 * PI * PI * sX * sX * tau * tau)).toBeGreaterThan(Math.exp(-2 * PI * PI * sY * sY * tau * tau));
      // explanation states both sigma squares
      for (const s of [sA, sB]) expect(numbersIn(card.explanation).some(x => Math.abs(x - s * s) < 1e-9), `${where} σ² ${s * s} in explanation`).toBe(true);
      // explanation names options by content, never by position
      expect(/option [1-4a-d]\b|第 ?[一二三四1-4] ?(个|项)|选项 ?[A-D1-4]/i.test(card.explanation), where).toBe(false);
    }
  });
  it('negative-weight: Gram matrix is indefinite; "not valid / negative weight" is the only correct option', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(cardsFor(i, lang), 'negative-weight');
      const t = norm(card.prompt);
      const r = /\((\d+)\/2\)·\[δ\(ω - 1\) \+ δ\(ω \+ 1\)\] - \((\d+)\/2\)·\[δ\(ω - 1\/2\) \+ δ\(ω \+ 1\/2\)\]/.exec(t)!;
      const a = Number(r[1]), b = Number(r[2]);
      const where = `seed#${i} ${lang} a=${a} b=${b}`;
      const K = (tau: number) => a * Math.cos(2 * PI * tau) - b * Math.cos(PI * tau);
      expect(a, where).toBeGreaterThan(b);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(K(0)).toBeCloseTo(a - b, 9);
      // Gram matrix at the inputs 0 and 1, eigenvalues of a symmetric 2x2 in closed form
      const g00 = K(0), g01 = K(1), det = g00 * g00 - g01 * g01;
      const eMin = g00 - Math.abs(g01), eMax = g00 + Math.abs(g01);
      expect(det).toBeCloseTo(-4 * a * b, 9);
      expect(eMin).toBeCloseTo(-2 * b, 9);
      expect(eMax).toBeCloseTo(2 * a, 9);
      expect(eMin).toBeLessThan(0);
      // the card's printed K(0)
      expect(Number(/K\(0\) = (\d+) /.exec(t)![1])).toBe(a - b);
      // option predicate: the claim "valid" is false (indefinite Gram), "not valid" is true; and it names the negative weights
      const opts = card.choice!.options.map(norm);
      const correct = (o: string) => lang === 'en' ? /^Not valid: .*negative/.test(o) : /^不合法：.*为负/.test(o);
      const verdicts = opts.map(correct);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      expect(opts.filter(o => (lang === 'en' ? /negative/.test(o) : /为负/.test(o))).length, `${where} only the correct option mentions the negative weights`).toBe(1);
      const lens = card.choice!.options.map(o => o.length);
      const longestWrong = Math.max(...lens.filter((_, k) => k !== card.choice!.answer));
      expect(lens[card.choice!.answer], where).toBeLessThan(longestWrong);
      // the printed K(0) value inside the "valid" option and the explanation numbers
      const ex = numbersIn(card.explanation);
      for (const v of [a - b, a + b, -4 * a * b, 2 * a, -2 * b, -4 * b]) expect(ex.some(x => Math.abs(x - v) < 1e-9), `${where}: explanation lacks ${v}: ${card.explanation}`).toBe(true);
    }
  });
});

describe('GP-15 text and variety', () => {
  const ASCII_NAME = /\b(k1|k2|k3|k4|tau|sigma|mu|sA|sB|sX|sY|p1|p2|w1|w2|a1|a2|m1|m2|s1|s2|c1|c2)\b/;
  const ZH_ALLOWED = new Set(['exp', 'cos', 'Kv', 'Gram', 'Bochner', 'SM', 'GP', 'KL', 'ELBO', 'GPML']);
  it('learner text: Unicode only, no developer markers, no ASCII minus, no double parentheses, no raw floats, ZH without English words', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of cardsFor(i, lang)) for (const raw of textOf(card)) {
      const text = raw;
      const where = `${card.id} ${lang} seed#${i}: ${text.slice(0, 90)}`;
      expect(/DERIVED|NOT IN SOURCES|TODO|FIXME|undefined|NaN|\$\{|\{[^}]*\}|\^/.test(text), where).toBe(false);
      expect(ASCII_NAME.test(text), `${where} ASCII identifier`).toBe(false);
      expect(/(^|[\s(,=\[])-\d/.test(text) || /\w-\d/.test(text.replace(/\bGP-\d+/g, '')), `${where} hyphen minus`).toBe(false);
      expect(/\(\(−?\d+(\.\d+)?\),|, \(−?\d+(\.\d+)?\)\)|\(\(\(/.test(text), `${where} double parentheses`).toBe(false);
      expect(/\d\.\d{6,}/.test(text), `${where} raw float`).toBe(false);
      expect(/\bpi\b|\bsqrt\b|\binf\b|\bdelta\b|\bomega\b|\btheta\b|\blambda\b/i.test(text), `${where} ASCII Greek name`).toBe(false);
      if (lang === 'en') expect(/[㐀-鿿]/.test(text), where).toBe(false);
      else {
        for (const w of text.match(/[A-Za-z]{2,}/g) ?? []) expect(ZH_ALLOWED.has(w), `${where} English word "${w}" in ZH`).toBe(true);
      }
    }
  });
  it('angles are reduced in explanations and prompts (no 6π/3, 4π/2, ...)', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of cardsFor(i, lang)) for (const text of textOf(card))
      for (const m of text.matchAll(/(?<![\d/])(\d+)π\/(\d+)/g)) {
        const n = Number(m[1]), d = Number(m[2]);
        expect(gcd(n, d), `${card.id} ${lang}: unreduced angle ${m[0]} in ${text.slice(0, 120)}`).toBe(1);
        // angles of a cosine evaluated at a point must be reduced to one turn; the frequency equation 2πω₀ = 5π/2 of freq-from-cos is not such an angle
        if (/ss-kernel|sm-value/.test(card.id)) expect(n / d, `${card.id} ${lang}: angle ${m[0]} beyond one turn: ${text.slice(0, 120)}`).toBeLessThanOrEqual(2);
      }
  });
  it('every numeric card shows a convention-free statement: the Fourier convention is printed with the transform', () => {
    for (let i = 0; i < SEEDS; i += 7) {
      const cards = cardsFor(i, 'en');
      expect(norm(byId(cards, 'freq-from-cos').prompt)).toContain('exp(2πiωτ)');
      expect(norm(byId(cards, 'spectrum-at-zero').prompt)).toContain('exp(−2πiωτ)'.replace('−', '-'));
      expect(norm(byId(cards, 'challenge').prompt)).toContain('exp(2πiωτ)');
      // slide formulas that the plan overrides must not be used
      for (const c of cards) expect(/ℓ\/π|sℓ\/π/.test(c.hint + c.prompt) , c.id).toBe(false);
    }
  });
  it('variety: at least 6 distinct prompts per card over 60 seeds (EN and ZH)', () => {
    for (const lang of LANGS) for (const id of IDS) {
      const prompts = new Set<string>();
      for (let i = 0; i < SEEDS; i++) prompts.add(byId(cardsFor(i, lang), id).prompt);
      expect(prompts.size, `${id} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('questionTextOf never contains the answer of a numeric card as the only occurrence of a hidden value (smoke)', () => {
    for (let i = 0; i < 10; i++) for (const c of cardsFor(i, 'en')) expect(questionTextOf(c).length).toBeGreaterThan(0);
    expect(parseGameNumber('3/4')).toBe(0.75);
  });
});
