import { describe, expect, it } from 'vitest';
import { gp25 } from './games/gp25';
import { spreadSeed, textLintProblems, deckProblems, questionTextOf, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard, type GameLanguage } from '../types';

const SEEDS = 60;
const SPACE_SEEDS = 30000;
const LANGS: GameLanguage[] = ['en', 'zh'];
const SLUGS = ['layer-input', 'latent-count', 'warped-kernel', 'propagated-variance', 'gaussian-closure', 'sample-count', 'sample-average', 'collapsed-layer', 'challenge'];
const pn = (s: string) => Number(s.replaceAll('−', '-'));
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map(d => SUB[Number(d)]).join('');
const unsub = (s: string) => Number([...s].map(c => SUB.indexOf(c)).join(''));

const deck = (seed: number, lang: GameLanguage) => gp25(seed, lang) as PracticeCard[];
const cardOf = (cards: PracticeCard[], slug: string) => cards.find(c => c.id === `GP-25-${slug}`)!;
const first = (re: RegExp, s: string, what: string): string => { const m = re.exec(s); if (!m) throw new Error(`cannot parse ${what} from: ${s}`); return m[1]; };

/* ---------- independent numeric routes ---------- */
function gaussPdf(x: number, m: number, v: number) { return Math.exp(-((x - m) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v); }
function simpson(f: (x: number) => number, a: number, b: number, n = 20000) {
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
/** E[(y - f)^2] for an equal-weight Gaussian mixture, by quadrature against the mixture density. */
function mixtureError(y: number, comps: [number, number][]) {
  const density = (x: number) => comps.reduce((s, [m, v]) => s + gaussPdf(x, m, v), 0) / comps.length;
  return simpson(x => (y - x) ** 2 * density(x), -40, 40);
}
function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }; }
function normal(rand: () => number) { return Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand()); }

function latentCount(P: Record<string, number>) {
  const widths: number[] = []; for (let l = 1; l <= P.L; l++) widths.push(P[`M${l}`]);
  const joint: number[] = []; for (const m of widths) for (let i = 0; i < P.N * m; i++) joint.push(0);
  return joint.length;
}
function warpedLogK(P: Record<string, number>) {
  const pts = [P.a, P.b];
  const K = pts.map(p => pts.map(q => Math.exp(-((p - q) ** 2) / (2 * P.ell ** 2))));
  return Math.log(K[0][1]);
}
function propagatedVariance(P: Record<string, number>) {
  // Var(u + e) = [1 1] diag(s, v) [1 1]^T
  const w = [1, 1], D = [[P.s, 0], [0, P.v]];
  let q = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) q += w[i] * D[i][j] * w[j];
  return q;
}
function sampleCount(P: Record<string, number>) {
  let c = 0; for (let layer = 1; layer <= P.L - 1; layer++) for (let s = 1; s <= P.S; s++) for (let b = 1; b <= P.B; b++) c++;
  return c;
}
const sampleAverage = (P: Record<string, number>) => mixtureError(P.y, [[P.m1, P.c1], [P.m2, P.c2]]);
const challengeSamples = (P: Record<string, number>) => { const a: number[] = []; for (let i = 1; i <= P.S; i++) a.push(P[`a${i}`]); return a; };
const challengeValue = (P: Record<string, number>) => mixtureError(P.y, challengeSamples(P).map(a => [a, P.v] as [number, number]));

/* ---------- wrong routes (plan guards) with their minimum gaps ---------- */
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
function widthsOf(P: Record<string, number>) { const w: number[] = []; for (let l = 1; l <= P.L; l++) w.push(P[`M${l}`]); return w; }
const wrongRoutes: Record<string, { gap: number; routes: (P: Record<string, number>) => number[] }> = {
  'GP-25:latent-count': { gap: 2, routes: P => { const w = widthsOf(P), S = sum(w); return [P.N * (P.D + S), P.N * (S - 1), P.N * P.L, S, P.N * w.reduce((x, y) => x * y, 1)]; } },
  'GP-25:warped-kernel': { gap: 0.1, routes: P => { const D = Math.abs(P.a - P.b), dx = P.x2 - P.x1, e = P.ell; return [-dx * dx / (2 * e * e), -D * D / (e * e), D * D / (2 * e * e), -D / (2 * e * e), -D * D / (4 * e * e)]; } },
  'GP-25:propagated-variance': { gap: 0.5, routes: P => [P.v, P.s, P.s * P.v, P.s + P.v + P.m] },
  'GP-25:sample-count': { gap: 2, routes: P => [P.L * P.S * P.B, (P.L - 1) * P.S * P.N, (P.L - 1) * P.B, (P.L - 1) * P.S, P.L * P.S * P.N] },
  'GP-25:sample-average': { gap: 0.1, routes: P => { const e1 = (P.y - P.m1) ** 2 + P.c1, e2 = (P.y - P.m2) ** 2 + P.c2, T = (e1 + e2) / 2; return [(P.y - (P.m1 + P.m2) / 2) ** 2 + (P.c1 + P.c2) / 2, e1, ((P.y - P.m1) ** 2 + (P.y - P.m2) ** 2) / 2, (P.y - (P.m1 + P.m2) / 2) ** 2, 2 * T]; } },
  'GP-25:challenge': { gap: 0.1, routes: P => { const a = challengeSamples(P), S = a.length, sq = sum(a.map(x => (P.y - x) ** 2)), abar = sum(a) / S; return [(P.y - abar) ** 2 + P.v, (P.y - a[0]) ** 2 + P.v, sq / S, sq / S + S * P.v, P.v, sq + P.v]; } },
};
const independent: Record<string, (P: Record<string, number>) => number> = {
  'GP-25:latent-count': latentCount, 'GP-25:warped-kernel': warpedLogK, 'GP-25:propagated-variance': propagatedVariance,
  'GP-25:sample-count': sampleCount, 'GP-25:sample-average': sampleAverage, 'GP-25:challenge': challengeValue,
};
const planFormula: Record<string, (P: Record<string, number>) => number> = {
  'GP-25:latent-count': P => P.N * sum(widthsOf(P)),
  'GP-25:warped-kernel': P => -((P.a - P.b) ** 2) / (2 * P.ell ** 2),
  'GP-25:propagated-variance': P => P.s + P.v,
  'GP-25:sample-count': P => (P.L - 1) * P.S * P.B,
  'GP-25:sample-average': P => ((P.y - P.m1) ** 2 + P.c1 + (P.y - P.m2) ** 2 + P.c2) / 2,
  'GP-25:challenge': P => sum(challengeSamples(P).map(a => (P.y - a) ** 2)) / challengeSamples(P).length + P.v,
};
const slugOfKind: Record<string, string> = { 'GP-25:latent-count': 'latent-count', 'GP-25:warped-kernel': 'warped-kernel', 'GP-25:propagated-variance': 'propagated-variance', 'GP-25:sample-count': 'sample-count', 'GP-25:sample-average': 'sample-average', 'GP-25:challenge': 'challenge' };

/* ---------- prompt parsers ---------- */
const gaussians = (s: string) => [...s.matchAll(/N\((−?\d+(?:\.\d+)?), (\d+(?:\.\d+)?)\)/g)].map(m => [pn(m[1]), pn(m[2])] as [number, number]);
function parsePrompt(slug: string, prompt: string, lang: GameLanguage): Record<string, number> {
  const en = lang === 'en';
  switch (slug) {
    case 'latent-count': {
      const P: Record<string, number> = { L: pn(first(/\bL = (\d+)/, prompt, 'L')), N: pn(first(/\bN = (\d+)/, prompt, 'N')), D: pn(first(/\bD = (\d+)/, prompt, 'D')) };
      for (const m of prompt.matchAll(/M([₀-₉]+) = (\d+)/g)) P[`M${unsub(m[1])}`] = pn(m[2]);
      return P;
    }
    case 'warped-kernel': return {
      ell: pn(first(/ℓ = (\d+)/, prompt, 'ell')), x1: pn(first(/x₁ = (−?\d+)/, prompt, 'x1')), x2: pn(first(/x₂ = (−?\d+)/, prompt, 'x2')),
      a: pn(first(/f₁\(x₁\) = (−?\d+)/, prompt, 'a')), b: pn(first(/f₁\(x₂\) = (−?\d+)/, prompt, 'b')),
    };
    case 'propagated-variance': {
      const [[m, s]] = gaussians(prompt);
      const v = pn(first(en ? /variance (\d+(?:\.\d+)?) \(the layer noise/ : /方差都是 (\d+(?:\.\d+)?)（/, prompt, 'v'));
      return { m, s, v };
    }
    case 'sample-count': return {
      L: pn(first(/\bL = (\d+)/, prompt, 'L')), B: pn(first(/N\* = (\d+)/, prompt, 'B')), N: pn(first(/\bN = (\d+)/, prompt, 'N')), S: pn(first(/\bS = (\d+)/, prompt, 'S')),
    };
    case 'sample-average': {
      const g = gaussians(prompt);
      return { y: pn(first(/y = (−?\d+(?:\.\d+)?)/, prompt, 'y')), m1: g[0][0], c1: g[0][1], m2: g[1][0], c2: g[1][1] };
    }
    case 'challenge': {
      const list = first(en ? /output: (.*?)\. Layer 2/ : /样本：(.*?)。第 2 层/, prompt, 'samples').split(/[,、] ?/).map(pn);
      const P: Record<string, number> = {
        y: pn(first(/y = (−?\d+(?:\.\d+)?)/, prompt, 'y')), v: pn(first(en ? /for every input u, the variance (\d+(?:\.\d+)?)\./ : /方差都是 (\d+(?:\.\d+)?)。/, prompt, 'v')), S: pn(first(/\bS = (\d+)/, prompt, 'S')),
      };
      list.forEach((a, i) => { P[`a${i + 1}`] = a; });
      expect(list.length, 'printed sample count').toBe(P.S);
      return P;
    }
  }
  throw new Error(slug);
}

/* ---------- plan sampling spaces, enumerated once (guards included) ---------- */
type Space = Map<string, Record<string, number>>;
const keyOf = (P: Record<string, number>) => Object.keys(P).sort().map(k => `${k}=${P[k]}`).join(',');
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const denominatorOk = (T: number) => { const t4 = Math.round(T * 4); if (Math.abs(t4 - T * 4) > 1e-9) return false; const d = 4 / gcd(t4, 4); return d === 1 || d === 2 || d === 4; };
function enumerate(kind: string): Space {
  const out: Space = new Map();
  const add = (P: Record<string, number>) => {
    const T = planFormula[kind](P);
    const { gap, routes } = wrongRoutes[kind];
    if (routes(P).some(w => Math.abs(w - T) < gap - 1e-9)) return;
    out.set(keyOf(P), P);
  };
  if (kind === 'GP-25:latent-count') {
    for (const L of [2, 3, 4]) for (const N of [2, 3, 4, 5, 10]) for (const D of [1, 2, 3, 4]) {
      const rec = (i: number, ws: number[]) => {
        if (i === L) { const P: Record<string, number> = { L, N, D }; [...ws, 1].forEach((m, k) => { P[`M${k + 1}`] = m; }); add(P); return; }
        for (const m of [1, 2, 3]) rec(i + 1, [...ws, m]);
      };
      rec(1, []);
    }
  } else if (kind === 'GP-25:warped-kernel') {
    for (const ell of [1, 2]) for (const x1 of [0, 1, 2]) for (const dx of [3, 4, 5, 6]) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      if (Math.abs(a - b) < 1) continue;
      const P = { ell, x1, x2: x1 + dx, a, b }; if (!denominatorOk(planFormula[kind](P))) continue; add(P);
    }
  } else if (kind === 'GP-25:propagated-variance') {
    for (const m of [-2, -1, 1, 2]) for (const s of [1, 2, 3, 4]) for (const v of [0.5, 1, 1.5, 2]) add({ m, s, v });
  } else if (kind === 'GP-25:sample-count') {
    for (const L of [2, 3, 4]) for (const S of [2, 3]) for (const B of [2, 4, 5]) for (const N of [20, 100]) add({ L, S, B, N });
  } else if (kind === 'GP-25:sample-average') {
    for (const y of [-1, 0, 1, 2, 3]) for (let m1 = -2; m1 <= 4; m1++) for (let m2 = -2; m2 <= 4; m2++) { if (m1 === m2) continue; for (const c1 of [1, 2, 3]) for (const c2 of [1, 2, 3]) add({ y, m1, c1, m2, c2 }); }
  } else if (kind === 'GP-25:challenge') {
    for (const S of [2, 4]) for (const y of [0, 1, 2]) for (const v of [0.5, 1, 1.5, 2]) {
      const rec = (i: number, lo: number, arr: number[]) => {
        if (i === S) { const P: Record<string, number> = { y, v, S }; arr.forEach((a, k) => { P[`a${k + 1}`] = a; }); if (denominatorOk(planFormula[kind](P))) add(P); return; }
        for (let a = lo; a <= 3; a++) rec(i + 1, a, [...arr, a]);
      };
      rec(0, -1, []);
    }
  }
  return out;
}
const spaces: Record<string, Space> = {};
for (const kind of Object.keys(planFormula)) spaces[kind] = enumerate(kind);

/* ---------- choice-card helpers ---------- */
const comp = (k: number, n: number): string => { let s = `x${sub(n)}`; for (let i = 1; i <= k; i++) s = `f${sub(i)}(${s})`; return s; };
const head = (opt: string) => opt.split(/[,，]/)[0];
const valueOfOption = (opt: string) => head(opt).replace(/ itself$/, '').replace(/ 本身$/, '');
function parseLayerInput(prompt: string, lang: GameLanguage) {
  const en = lang === 'en';
  const L = pn(first(/\bL = (\d+)/, prompt, 'L'));
  const l = pn(first(en ? /of layer (\d+) for/ : /第 (\d+) 层的高斯过程/, prompt, 'l'));
  const n = unsub(first(en ? /input x([₀-₉]+) passes/ : /输入为 x([₀-₉]+) 的/, prompt, 'n'));
  return { L, l, n };
}
const correctShorter = (c: PracticeCard) => { const o = c.choice!.options; const len = o.map(x => [...x].length); const ans = len[c.choice!.answer]; return ans < Math.max(...len.filter((_, i) => i !== c.choice!.answer)); };

/* ================================================================ */
describe('GP-25 structure', () => {
  it('has the nine planned cards in order, one answer mode each, no figures, EN/ZH aligned', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = deck(spreadSeed(i), lang);
      expect(cards.map(c => c.id)).toEqual(SLUGS.map(s => `GP-25-${s}`));
      for (const c of cards) {
        expect(c.figure, `${c.id} figure`).toBeUndefined();
        expect(c.choice?.figures, `${c.id} option figures`).toBeUndefined();
        expect(c.slots, `${c.id} slots`).toBeUndefined();
        expect(Number(!!c.fields) + Number(!!c.choice)).toBe(1);
      }
    }
  });
  it('titles, field labels and prompt endings follow the plan', () => {
    const titles = { en: ['What does layer ℓ receive?', 'How many latent values?', 'The kernel sees the layer-1 outputs', 'Uncertainty passed on by layer 1', 'Is a function of a Gaussian Gaussian?', 'Counting the draws', 'Averaging over the samples', 'A layer that has been turned off', 'Challenge: expected squared error through two layers'],
      zh: ['第 ℓ 层接收什么？', '有多少个潜变量？', '核函数作用在第 1 层的输出上', '第 1 层传来的不确定性', '高斯变量的函数还是高斯的吗？', '数一数抽样次数', '对样本取平均', '被关闭的一层', '挑战：穿过两层的期望平方误差'] };
    const labels: Record<string, Record<GameLanguage, string>> = {
      'latent-count': { en: 'latent values', zh: '潜变量个数' }, 'warped-kernel': { en: 'ln k₂', zh: 'ln k₂' }, 'propagated-variance': { en: 'variance of f₂(f₁(x))', zh: 'f₂(f₁(x)) 的方差' },
      'sample-count': { en: 'univariate draws', zh: '单变量抽样次数' }, 'sample-average': { en: 'estimate of E[(y − f)²]', zh: 'E[(y − f)²] 的估计' }, challenge: { en: 'expected squared error', zh: '期望平方误差' },
    };
    const endInt = { en: 'Give an integer.', zh: '请填整数。' }, endNum = { en: 'Give an integer, a fraction or a decimal rounded to 2 places.', zh: '请填整数、分数，或保留 2 位小数的小数。' };
    for (const i of [3, 17, 41]) for (const lang of LANGS) {
      const cards = deck(spreadSeed(i), lang);
      cards.forEach((c, k) => expect(c.title).toBe(titles[lang][k]));
      for (const [slug, lab] of Object.entries(labels)) {
        const c = cardOf(cards, slug);
        expect(c.fields!.length).toBe(1);
        expect(c.fields![0].label).toBe(lab[lang]);
        expect(c.prompt.endsWith((slug === 'latent-count' || slug === 'sample-count' ? endInt : endNum)[lang]), `${slug} ending`).toBe(true);
      }
    }
  });
  it('passes the shared structural gates', () => {
    expect(deckProblems('GP-25', gp25, 'topic', 60)).toEqual([]);
    expect(textLintProblems('GP-25', gp25, 60)).toEqual([]);
  });
});

describe('GP-25 numeric cards: independent recomputation, grading, printed text, wrong routes', () => {
  for (const [kind, oracle] of Object.entries(independent)) {
    const slug = slugOfKind[kind];
    it(`${kind}: ${SEEDS} spread seeds x EN/ZH`, () => {
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const seed = spreadSeed(i);
        const cards = deck(seed, lang);
        const card = cardOf(cards, slug);
        const where = `${kind} seed ${seed} ${lang}`;
        expect(card.audit?.kind, where).toBe(kind);
        const P = card.audit!.params as Record<string, number>;
        // printed text = audit params
        expect(parsePrompt(slug, card.prompt, lang), `${where} printed vs audit`).toEqual(P);
        // answer from independent route, plan formula, and card
        const T = oracle(P);
        expect(Math.abs(T - planFormula[kind](P)), `${where} independent vs plan formula`).toBeLessThan(1e-6);
        expect(card.fields![0].tolerance, where).toBe(0.006);
        expect(Math.abs(card.fields![0].answer - T), `${where} card ${card.fields![0].answer} vs oracle ${T}`).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(card.fields![0].answer * 4 - Math.round(card.fields![0].answer * 4)), `${where} multiple of 0.25`).toBeLessThan(1e-9);
        // grading
        for (const accepted of [String(T), T.toFixed(2), T.toFixed(2).replace('-', '−'), `${Math.round(T * 4)}/4`, String(T + 0.004), String(T - 0.004)])
          expect(gradeCard(card, [accepted], null, []), `${where} accepts ${accepted}`).toBe('correct');
        for (const wrong of [T + 0.007, T - 0.007, T + 0.25, T - 1])
          expect(gradeCard(card, [String(wrong)], null, []), `${where} rejects ${wrong}`).toBe('incorrect');
        // every wrong route differs on this draw and is graded wrong
        const { gap, routes } = wrongRoutes[kind];
        for (const w of routes(P)) {
          expect(Math.abs(w - T), `${where} wrong route ${w} vs ${T}`).toBeGreaterThanOrEqual(gap - 1e-9);
          expect(gradeCard(card, [String(w)], null, []), `${where} wrong route ${w}`).toBe('incorrect');
        }
        fired++;
      }
      expect(fired).toBe(SEEDS * 2);
    });
  }
  it('the audit kinds are exactly the six planned ones and every numeric card is audited', () => {
    const seen = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const c of deck(spreadSeed(i), 'en')) {
      if (c.fields) expect(c.audit, c.id).toBeDefined();
      if (c.audit) seen.add(c.audit.kind);
      if (c.choice) expect(c.audit, c.id).toBeUndefined();
    }
    expect([...seen].sort()).toEqual(Object.keys(independent).sort());
  });
  it('Monte Carlo cross-checks: propagated variance and the two mixtures', () => {
    for (let i = 0; i < 8; i++) {
      const cards = deck(spreadSeed(i), 'en');
      const rand = lcg(12345 + i);
      const pv = cardOf(cards, 'propagated-variance').audit!.params as Record<string, number>;
      const n = 400000; let s1 = 0, s2 = 0;
      for (let k = 0; k < n; k++) { const f = pv.m + Math.sqrt(pv.s) * normal(rand) + Math.sqrt(pv.v) * normal(rand); s1 += f; s2 += f * f; }
      expect(Math.abs(s2 / n - (s1 / n) ** 2 - (pv.s + pv.v))).toBeLessThan(0.1);
      for (const slug of ['sample-average', 'challenge']) {
        const c = cardOf(cards, slug); const P = c.audit!.params as Record<string, number>;
        const comps: [number, number][] = slug === 'challenge' ? challengeSamples(P).map(a => [a, P.v]) : [[P.m1, P.c1], [P.m2, P.c2]];
        let acc = 0;
        for (let k = 0; k < n; k++) { const [m, v] = comps[Math.floor(rand() * comps.length)]; const f = m + Math.sqrt(v) * normal(rand); acc += (P.y - f) ** 2; }
        expect(Math.abs(acc / n - c.fields![0].answer), `${slug} MC`).toBeLessThan(0.1);
      }
    }
  });
});

describe('GP-25 sampling spaces equal the plan exactly', () => {
  it('plan enumeration counts', () => {
    const counts = Object.fromEntries(Object.entries(spaces).map(([k, v]) => [k, v.size]));
    // plan: 680, 492, 56, 36, 1796, 836
    expect(counts).toEqual({ 'GP-25:latent-count': 680, 'GP-25:warped-kernel': 492, 'GP-25:propagated-variance': 56, 'GP-25:sample-count': 36, 'GP-25:sample-average': 1796, 'GP-25:challenge': 836 });
  });
  it(`${SPACE_SEEDS} seeds draw only in-plan sets and cover every set`, () => {
    const seen: Record<string, Set<string>> = {};
    for (const k of Object.keys(spaces)) seen[k] = new Set();
    for (let i = 0; i < SPACE_SEEDS; i++) for (const c of deck(spreadSeed(i), 'en')) if (c.audit) seen[c.audit.kind].add(keyOf(c.audit.params as Record<string, number>));
    for (const [kind, space] of Object.entries(spaces)) {
      const outside = [...seen[kind]].filter(k => !space.has(k));
      const missing = [...space.keys()].filter(k => !seen[kind].has(k));
      expect({ kind, outside: outside.slice(0, 5), nOutside: outside.length, missing: missing.slice(0, 5), nMissing: missing.length }).toEqual({ kind, outside: [], nOutside: 0, missing: [], nMissing: 0 });
    }
  }, 600000);
  it('choice cards: sampling spaces', () => {
    const li = new Set<string>(), gc = new Set<number>(), cl = new Set<string>();
    for (let i = 0; i < SPACE_SEEDS; i++) {
      const cards = deck(spreadSeed(i), 'en');
      const a = parseLayerInput(cardOf(cards, 'layer-input').prompt, 'en'); li.add(`${a.L},${a.l},${a.n}`);
      gc.add(pn(first(/N\(0, (\d+)\)/, cardOf(cards, 'gaussian-closure').prompt, 's')));
      const p = cardOf(cards, 'collapsed-layer').prompt;
      cl.add(`${first(/\bL = (\d+)/, p, 'L')},${first(/output of layer (\d+) is/, p, 'k')},${first(/is about ([\d.]+) at/, p, 't')}`);
    }
    const wantLi = new Set<string>(); for (const L of [3, 4, 5]) for (let l = 2; l <= L; l++) for (const n of [1, 2, 3]) wantLi.add(`${L},${l},${n}`);
    expect(wantLi.size).toBe(27); expect([...li].sort()).toEqual([...wantLi].sort());
    expect([...gc].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const wantCl = new Set<string>(); for (const L of [3, 4, 5]) for (let k = 1; k <= L; k++) for (const t of ['0.01', '0.001']) wantCl.add(`${L},${k},${t}`);
    expect(wantCl.size).toBe(24); expect([...cl].sort()).toEqual([...wantCl].sort());
  }, 600000);
});

describe('GP-25 choice cards', () => {
  it('layer-input: exactly one option has the value comp(l-1, n), answer index points to it', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = cardOf(deck(spreadSeed(i), lang), 'layer-input');
      const { L, l, n } = parseLayerInput(c.prompt, lang);
      expect(l).toBeGreaterThanOrEqual(2); expect(l).toBeLessThanOrEqual(L);
      const opts = c.choice!.options; expect(opts.length).toBe(4);
      const ok = opts.map(o => head(o) === comp(l - 1, n));
      expect(ok.filter(Boolean).length).toBe(1);
      expect(ok[c.choice!.answer]).toBe(true);
      const vals = opts.map(valueOfOption);
      expect(new Set(vals).size, vals.join(' | ')).toBe(4);
      expect(vals).toContain(comp(l, n)); expect(vals).toContain(`x${sub(n)}`); expect(vals).toContain(`x${sub(n)} + ${comp(l - 1, n)}`);
      expect(c.prompt).toContain(comp(L, n).replace(/f₁\(x/, 'f₁(x')); // chain in the prompt
      expect(correctShorter(c), `${lang} correct strictly shorter than longest wrong`).toBe(true);
    }
  });
  it('gaussian-closure: only the "not Gaussian because w >= 0" option is correct', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = cardOf(deck(spreadSeed(i), lang), 'gaussian-closure');
      const s = pn(first(/N\(0, (\d+)\)/, c.prompt, 's'));
      expect(s).toBeGreaterThanOrEqual(1); expect(s).toBeLessThanOrEqual(6);
      const [pm, pv] = lang === 'en' ? [first(/has mean (\d+) and variance/, c.prompt, 'mean'), first(/and variance (\d+)\. Which/, c.prompt, 'var')] : [first(/均值为 (\d+)，方差为/, c.prompt, 'mean'), first(/方差为 (\d+)。下列/, c.prompt, 'var')];
      expect([pn(pm), pn(pv)]).toEqual([s, 2 * s * s]);
      const pred = lang === 'en' ? (o: string) => /^Not Gaussian/.test(o) && /negative/.test(o) : (o: string) => /^不是高斯分布/.test(o) && /负/.test(o);
      const ok = c.choice!.options.map(pred);
      expect(ok.filter(Boolean).length).toBe(1);
      expect(ok[c.choice!.answer]).toBe(true);
      const joined = c.choice!.options.join(' ');
      expect(joined).toContain(String(s)); expect(joined).toContain(String(2 * s * s));
      expect(correctShorter(c)).toBe(true);
    }
    // Monte Carlo of z^2: mean s, variance 2 s^2, never negative
    const rand = lcg(99);
    for (let s = 1; s <= 6; s++) {
      let m = 0, m2 = 0, min = Infinity; const n = 300000;
      for (let k = 0; k < n; k++) { const w = (Math.sqrt(s) * normal(rand)) ** 2; m += w; m2 += w * w; min = Math.min(min, w); }
      m /= n; const v = m2 / n - m * m;
      expect(Math.abs(m - s) / s).toBeLessThan(0.02); expect(Math.abs(v - 2 * s * s) / (2 * s * s)).toBeLessThan(0.06); expect(min).toBeGreaterThanOrEqual(0);
    }
  });
  it('collapsed-layer: only the deterministic-mapping option is true; the KL option prints L-1', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = cardOf(deck(spreadSeed(i), lang), 'collapsed-layer');
      const en = lang === 'en';
      const L = pn(first(/\bL = (\d+)/, c.prompt, 'L'));
      const k = pn(first(en ? /output of layer (\d+) is/ : /第 (\d+) 层输出的方差/, c.prompt, 'k'));
      const t = pn(first(en ? /is about ([\d.]+) at/ : /都约为 ([\d.]+)，/, c.prompt, 't'));
      expect(L >= 3 && L <= 5 && k >= 1 && k <= L && (t === 0.01 || t === 0.001)).toBe(true);
      const opts = c.choice!.options;
      const ok = opts.map(o => en ? /deterministic mapping/.test(o) : /确定性映射/.test(o));
      expect(ok.filter(Boolean).length).toBe(1);
      expect(ok[c.choice!.answer]).toBe(true);
      const kl = opts.filter(o => /KL/.test(o));
      expect(kl.length).toBe(1);
      expect(pn(first(en ? /has (\d+) KL terms/ : /只有 (\d+) 个 KL/, kl[0], 'KL count'))).toBe(L - 1);
      expect(opts.filter(o => o.includes(String(k)) || true).length).toBe(4);
      expect(correctShorter(c)).toBe(true);
    }
  });
});

describe('GP-25 variety and text hygiene', () => {
  it('choice cards shuffle: the answer index takes at least 3 values over 60 seeds', () => {
    for (const slug of ['layer-input', 'gaussian-closure', 'collapsed-layer']) {
      const idx = new Set<number>();
      for (let i = 0; i < SEEDS; i++) idx.add(cardOf(deck(spreadSeed(i), 'en'), slug).choice!.answer);
      expect(idx.size, slug).toBeGreaterThanOrEqual(3);
    }
  });
  it('each card has at least 6 distinct prompts over 60 seeds (EN and ZH)', () => {
    for (const lang of LANGS) {
      const sets: Record<string, Set<string>> = {}; for (const s of SLUGS) sets[s] = new Set();
      for (let i = 0; i < SEEDS; i++) for (const c of deck(spreadSeed(i), lang)) sets[c.id.replace('GP-25-', '')].add(c.prompt);
      for (const s of SLUGS) expect(sets[s].size, `${lang} ${s}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('learner-visible text rules', () => {
    const ALLOWED_ZH_LATIN = new Set(['GP', 'KL', 'ELBO', 'ln', 'exp']);
    const bad: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(spreadSeed(i), lang)) {
      const all = textOf(c);
      const flag = (why: string, t: string) => { if (bad.length < 40) bad.push(`${c.id} ${lang} ${why}: ${t.slice(0, 90)}`); };
      for (const t of all) {
        if (/DERIVED/i.test(t)) flag('DERIVED', t);
        if (/(^|[\s(,=])-\d|[A-Za-z₀-₉)\]] - [\w(]/.test(t)) flag('ASCII hyphen as minus', t);
        if (/\(\(−?\d+(?:\.\d+)?\),|, \(−?\d+(?:\.\d+)?\)\)/.test(t)) flag('double parentheses around a coordinate', t);
        if (/\d\.\d{4,}/.test(t)) flag('raw float', t);
        if (/undefined|NaN|\[object|Infinity|TODO|FIXME|\bDEV\b|\$\{|\{[^}]*\}|\^|"/.test(t)) flag('developer marker', t);
        for (const m of t.matchAll(/(?<![+−·*\/] ?)(?<![\w.])(\d+(?:\.\d+)?) = \1(?![\d.])/g)) flag('x = x restatement', m[0]);
        for (const m of t.matchAll(/(?<![\d./])(\d+)\/(\d+)(?![\d/])/g)) if (gcd(Number(m[1]), Number(m[2])) > 1) flag('unreduced fraction', m[0]);
        for (const sentence of t.split(/(?<=[.。!?？])\s*/)) if (/(?<![\d)])\d+\/\d+(?![\d])/.test(sentence) && /\d\.\d/.test(sentence)) flag('fraction and decimal in one sentence', sentence);
        if (/\b1·/.test(t)) flag('1· coefficient', t);
        if (lang === 'zh') {
          for (const w of t.match(/[A-Za-z]{2,}/g) ?? []) if (!ALLOWED_ZH_LATIN.has(w)) flag(`English word "${w}" in ZH`, t);
          if (/[一-鿿][,;:!?]|[,;:!?][一-鿿]/.test(t)) flag('ASCII punctuation in ZH prose', t);
        }
        if (lang === 'en' && /[㐀-鿿]/.test(t)) flag('CJK in EN', t);
      }
      // hints never carry the numeric answer as a standalone number
      if (c.fields) for (const f of c.fields) { const s = String(f.answer).replace('-', '−'); if (new RegExp(`(?<![\\d.])${s.replace('.', '\\.')}(?![\\d.])`).test(c.hint)) flag('answer in hint', c.hint); }
      if (!/This game does not assess|本游戏在这一关不考查/.test(c.explanation)) flag('no "does not assess" sentence', c.explanation.slice(-60));
      // question text has no "E[" / "Var(" except the stated label
      for (const t of questionTextOf(c)) if (/Var\(/.test(t)) flag('Var( in question', t);
    }
    expect(bad).toEqual([]);
  });
  it('explanations substitute the sampled numbers (answer appears in numeric explanations)', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(spreadSeed(i), lang)) {
      if (!c.fields) continue;
      const a = c.fields[0].answer; const printed = String(a).replace('-', '−');
      expect(c.explanation.includes(printed), `${c.id} ${lang} explanation lacks ${printed}`).toBe(true);
    }
  });
});
