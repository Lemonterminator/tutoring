import { describe, expect, it } from 'vitest';
import { gp12 } from './games/gp12';
import { spreadSeed, textOf, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-12 (leave-one-out cross-validation in closed form).
 * Written from docs/aalto-gp-drafts/approved-GP-12.md without reading the generator.
 * Every number is recomputed from the PRINTED prompt (matrix, targets, point index) by explicit Gaussian conditioning
 * on the dense covariance C = inv(P); the closed form 1/[C^-1]_ii is never used as the oracle.
 */
const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];
const IDS = ['loo-var', 'loo-var-c', 'loo-mean', 'mean-change', 'loo-density', 'scale-c', 'singular', 'vs-evidence', 'challenge'].map(s => `GP-12-${s}`);

type M = [[number, number], [number, number]];
const inv2 = (m: M): M => { const det = m[0][0] * m[1][1] - m[0][1] * m[1][0]; return [[m[1][1] / det, -m[0][1] / det], [-m[1][0] / det, m[0][0] / det]]; };
const scale2 = (m: M, c: number): M => [[m[0][0] * c, m[0][1] * c], [m[1][0] * c, m[1][1] * c]];
/** Explicit Gaussian conditioning of y_i on y_j for a zero-mean 2D Gaussian with covariance C (i, j zero-based). */
function condition(C: M, y: [number, number], i: number) {
  const j = 1 - i;
  return { mu: C[i][j] / C[j][j] * y[j], v: C[i][i] - C[i][j] * C[i][j] / C[j][j] };
}
const logpdf = (y: number, mu: number, v: number) => -0.5 * Math.log(2 * Math.PI * v) - (y - mu) ** 2 / (2 * v);
const LN: Record<number, number> = { 1: 0, 2: 0.7, 4: 1.4 };

const NUM = String.raw`[−-]?\d+(?:\.\d+)?(?:/\d+)?`;
const toNum = (s: string) => { const t = s.replaceAll('−', '-'); const f = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+)$/); return f ? Number(f[1]) / Number(f[2]) : Number(t); };
const MATRIX = new RegExp(String.raw`\[\[\s*(${NUM})\s*,\s*(${NUM})\s*\]\s*,\s*\[\s*(${NUM})\s*,\s*(${NUM})\s*\]\]`);
function matrixOf(text: string): M {
  const m = text.match(MATRIX);
  if (!m) throw new Error(`no matrix in: ${text.slice(0, 120)}`);
  const v = m.slice(1, 5).map(toNum);
  expect(v[1], 'printed matrix must be symmetric').toBe(v[2]);
  return [[v[0], v[1]], [v[2], v[3]]];
}
function pairOf(text: string, label = 'y'): [number, number] {
  const m = text.match(new RegExp(String.raw`${label} = \((${NUM}), (${NUM})\)`));
  if (!m) throw new Error(`no ${label} vector in: ${text.slice(0, 160)}`);
  return [toNum(m[1]), toNum(m[2])];
}
const pointOf = (lang: GameLanguage, text: string) => {
  const m = text.match(lang === 'en' ? /[Pp]oint (\d)/ : /第 (\d) 个点/);
  if (!m) throw new Error(`no point index in: ${text.slice(0, 160)}`);
  return Number(m[1]);
};
const first = (text: string, re: RegExp) => { const m = text.match(re); if (!m) throw new Error(`no ${re} in: ${text.slice(0, 200)}`); return toNum(m[1]); };
const SUB = ['', '₁', '₂'];
const fmtNum = (x: number) => (x < 0 ? '−' : '') + String(Math.abs(x));

function gen(index: number, lang: GameLanguage): Map<string, PracticeCard> {
  const cards = gp12(spreadSeed(index), lang);
  expect(cards.map(c => c.id)).toEqual(IDS);
  return new Map(cards.map(c => [c.id, c]));
}
const grade = (card: PracticeCard, values: string[]) => gradeCard(card, values, null, []);
/** Accepts the oracle value (as a full-precision decimal, as 2-place decimal when exact to 2 places) and rejects values off by more than the tolerance. */
function checkGrading(card: PracticeCard, expected: number[], where: string, twoPlaces = true) {
  expect(card.fields!.length, where).toBe(expected.length);
  card.fields!.forEach(f => expect(f.tolerance, `${where}: tolerance`).toBe(0.006));
  expected.forEach((value, k) => {
    const others = expected.map(v => String(v));
    const mk = (s: string) => others.map((o, idx) => (idx === k ? s : o));
    expect(grade(card, mk(String(value))), `${where}: exact answer ${value}`).toBe('correct');
    if (twoPlaces) expect(grade(card, mk(value.toFixed(2))), `${where}: 2-place decimal ${value.toFixed(2)}`).toBe('correct');
    expect(grade(card, mk(String(value + 0.02))), `${where}: +0.02`).toBe('incorrect');
    expect(grade(card, mk(String(value - 0.02))), `${where}: -0.02`).toBe('incorrect');
    expect(grade(card, mk(String(value + 0.5))), `${where}: +0.5`).toBe('incorrect');
  });
}
const everyDraw = (fn: (index: number, lang: GameLanguage, cards: Map<string, PracticeCard>) => void) => {
  for (let index = 0; index < SEEDS; index++) for (const lang of LANGS) fn(index, lang, gen(index, lang));
};
const far = (truth: number, routes: number[]) => routes.every(r => Math.abs(truth - r) >= 0.02 - 1e-9);

// ---------- the plan's explicit sampling spaces, enumerated independently ----------
const key = (...v: number[]) => v.join(',');
function spaceLooVar() {
  const s = new Set<string>();
  for (const p1 of [2, 4, 5, 8, 10]) for (const p2 of [2, 4, 5, 8, 10]) for (const q of [-3, -2, -1, 1, 2, 3]) for (const i of [1, 2]) {
    if (p1 * p2 <= q * q) continue;
    const pi = i === 1 ? p1 : p2, pj = i === 1 ? p2 : p1, det = p1 * p2 - q * q;
    if (pi === pj) continue;
    if (far(1 / pi, [pi, 1 / pj, 1 / Math.abs(q), pj / det, det / pj, 1 / det, det / pi])) s.add(key(p1, p2, q, i));
  }
  return s;
}
function spaceLooVarC() {
  const s = new Set<string>();
  for (const a of [2, 4, 5]) for (const c of [2, 4, 5]) for (const b of [2, 3]) for (const i of [1, 2]) {
    if (a === c || a * c <= b * b) continue;
    const Cii = i === 1 ? a : c, Cjj = i === 1 ? c : a, det = a * c - b * b;
    if (far(det / Cjj, [Cii, det / Cii, Cjj / det, 1 / Cii, Cii - b / Cjj, Cii - b * b / Cii, det, Cii - b * b, 1 / Cjj])) s.add(key(a, b, c, i));
  }
  return s;
}
function spaceLooMean() {
  const s = new Set<string>();
  for (const p1 of [2, 4, 5]) for (const p2 of [2, 4, 5]) for (const q of [-3, -2, -1, 1, 2, 3]) for (const i of [1, 2]) for (let yi = -3; yi <= 3; yi++) for (const yj of [-3, -2, -1, 1, 2, 3]) {
    if (p1 * p2 <= q * q) continue;
    const pi = i === 1 ? p1 : p2, pj = i === 1 ? p2 : p1, Py = pi * yi + q * yj, r = Py / pi, t = -q * yj / pi;
    if (Math.abs(t) < 0.5 - 1e-12) continue;
    if (far(t, [r, yi + r, Py, yi - Py / pj, -q * yj, yj, -q * yj / pj, yi])) { const y1 = i === 1 ? yi : yj, y2 = i === 1 ? yj : yi; s.add(key(p1, p2, q, y1, y2, i)); }
  }
  return s;
}
function spaceMeanChange() {
  const s = new Set<string>();
  for (const p1 of [2, 4, 5]) for (const p2 of [2, 4, 5]) for (const q of [-3, -2, -1, 1, 2, 3]) for (const y2 of [-3, -2, -1, 1, 2, 3]) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    if (p1 * p2 <= q * q || a === b) continue;
    s.add(key(p1, p2, q, y2, a, b));
  }
  return s;
}
function spaceDensity() {
  const s = new Set<string>();
  for (const s2 of [2, 4]) for (let mu = -3; mu <= 3; mu++) for (let y = -4; y <= 4; y++) {
    const d = y - mu;
    if (d === 0 || Math.abs(d) > 4 || (s2 === 4 && d % 2 !== 0)) continue;
    const l = s2 === 2 ? 0.7 : 1.4, fit = d * d / (2 * s2), t = -l / 2 - fit - 0.92;
    if (far(t, [l / 2 - fit - 0.92, -l / 2 - d * d / s2 - 0.92, -l / 2 - d / (2 * s2) - 0.92, -l / 2 - fit, -l / 2 - fit - 1.84, -l - fit - 0.92, -l / 2 - 0.92, -l / 2 - d * d / (2 * Math.sqrt(s2)) - 0.92, -fit - 0.92, -l / 2 + fit - 0.92])) s.add(key(mu, s2, y));
  }
  return s;
}
function spaceScale() {
  const s = new Set<string>();
  for (const p1 of [2, 4, 5]) for (const p2 of [2, 4, 5]) for (const q of [-3, -2, -1, 1, 2, 3]) for (const i of [1, 2]) for (let yi = -3; yi <= 3; yi++) for (const yj of [-3, -2, -1, 1, 2, 3]) for (const c of [2, 4]) {
    if (p1 * p2 <= q * q) continue;
    const pi = i === 1 ? p1 : p2, pj = i === 1 ? p2 : p1;
    if (pi === pj) continue;
    const mu = -q * yj / pi;
    if (Math.abs(mu) < 0.5 - 1e-12) continue;
    if (far(mu, [c * mu, mu / c, c * c * mu, -mu]) && far(c / pi, [1 / pi, 1 / (c * pi), c * c / pi, c / pj, pi / c])) { const y1 = i === 1 ? yi : yj, y2 = i === 1 ? yj : yi; s.add(key(p1, p2, q, y1, y2, i, c)); }
  }
  return s;
}
function challengeRoutes(p1: number, p2: number, q: number, y1: number, y2: number) {
  const P = [p1 * y1 + q * y2, q * y1 + p2 * y2], p = [p1, p2], y = [y1, y2];
  const e = (k: number) => P[k] / p[k];
  const sum = (fn: (k: number) => number, ks = [0, 1]) => ks.reduce((s, k) => s + fn(k), 0);
  const truth = sum(k => LN[p[k]] / 2 - p[k] * e(k) ** 2 / 2 - 0.92);
  const routes = [
    sum(k => -LN[p[k]] / 2 - e(k) ** 2 / (2 * p[k]) - 0.92), sum(k => LN[p[k]] / 2 - p[k] * e(k) ** 2 / 2), sum(k => LN[p[k]] / 2 - p[k] * y[k] ** 2 / 2 - 0.92),
    sum(k => LN[p[k]] / 2 - p[k] * P[k] ** 2 / 2 - 0.92), sum(k => LN[p[k]] / 2 - p[k] * e(k) ** 2 / 2 - 0.92, [0]), sum(k => LN[p[k]] / 2 - p[k] * e(k) ** 2 / 2 - 0.92, [1]),
    sum(k => -LN[p[k]] / 2 - p[k] * e(k) ** 2 / 2 - 0.92), sum(k => LN[p[k]] - p[k] * e(k) ** 2 / 2 - 0.92),
  ];
  return { truth, routes, P };
}
function spaceChallenge() {
  const s = new Set<string>();
  for (const p1 of [1, 2, 4]) for (const p2 of [1, 2, 4]) for (const q of [-2, -1, 1, 2]) for (let y1 = -2; y1 <= 2; y1++) for (let y2 = -2; y2 <= 2; y2++) {
    if ((y1 === 0 && y2 === 0) || p1 * p2 <= q * q) continue;
    const { truth, routes, P } = challengeRoutes(p1, p2, q, y1, y2);
    if ((p1 === 4 && P[0] % 2 !== 0) || (p2 === 4 && P[1] % 2 !== 0) || truth < -12) continue;
    if (far(truth, routes)) s.add(key(p1, p2, q, y1, y2));
  }
  return s;
}
function spaceSingular() { const s = new Set<string>(); for (const a of [1, 2, 3, 4]) for (const sa of [a, -a]) s.add(key(a, sa)); return s; }
const SPACES = {
  'loo-var': spaceLooVar(), 'loo-var-c': spaceLooVarC(), 'loo-mean': spaceLooMean(), 'mean-change': spaceMeanChange(), 'loo-density': spaceDensity(),
  'scale-c': spaceScale(), singular: spaceSingular(), challenge: spaceChallenge(),
};

// ---------- per-card tuple extraction from the PRINTED prompt (and audit params, which must agree) ----------
function looVarTuple(card: PracticeCard, lang: GameLanguage) {
  const P = matrixOf(card.prompt), i = pointOf(lang, card.prompt);
  return { P, i, tuple: key(P[0][0], P[1][1], P[0][1], i) };
}

describe('GP-12 deck shape', () => {
  it('has the nine planned cards in order, EN and ZH, no symbol cards, figure only on loo-density', () => {
    everyDraw((_, lang, cards) => {
      for (const [id, card] of cards) {
        expect(card.slots, `${id} ${lang}`).toBeUndefined();
        if (id === 'GP-12-loo-density') expect(card.figure, id).toBeDefined(); else expect(card.figure, `${id} ${lang}`).toBeUndefined();
        const modes = Number(!!card.fields) + Number(!!card.choice);
        expect(modes, id).toBe(1);
      }
      const choice = ['GP-12-mean-change', 'GP-12-singular', 'GP-12-vs-evidence'];
      for (const id of IDS) expect(!!cards.get(id)!.choice, `${id} ${lang}`).toBe(choice.includes(id));
      for (const id of choice) expect(cards.get(id)!.choice!.options, id).toHaveLength(4);
    });
  });
  it('audit kinds: every numeric card fires its kind on every seed, no unknown kinds, no audit on choice cards', () => {
    const want: Record<string, string> = {
      'GP-12-loo-var': 'GP-12:loo-var', 'GP-12-loo-var-c': 'GP-12:loo-var-c', 'GP-12-loo-mean': 'GP-12:loo-mean', 'GP-12-loo-density': 'GP-12:loo-density',
      'GP-12-scale-c': 'GP-12:scale-c', 'GP-12-challenge': 'GP-12:challenge',
    };
    const seen: Record<string, number> = {};
    everyDraw((_, lang, cards) => {
      for (const [id, card] of cards) {
        if (want[id]) { expect(card.audit?.kind, `${id} ${lang}`).toBe(want[id]); seen[want[id]] = (seen[want[id]] ?? 0) + 1; }
        else expect(card.audit, `${id} has no audit in the plan`).toBeUndefined();
      }
    });
    expect(Object.keys(seen).sort()).toEqual(Object.values(want).sort());
    Object.values(seen).forEach(n => expect(n).toBe(SEEDS * 2));
  });
  it('the audit param sets are exactly the plan names', () => {
    const names: Record<string, string[]> = {
      'GP-12-loo-var': ['p1', 'p2', 'q', 'i'], 'GP-12-loo-var-c': ['a', 'b', 'c', 'i'], 'GP-12-loo-mean': ['p1', 'p2', 'q', 'y1', 'y2', 'i'], 'GP-12-loo-density': ['mu', 's2', 'y', 'lns2'],
      'GP-12-scale-c': ['p1', 'p2', 'q', 'y1', 'y2', 'i', 'c'], 'GP-12-challenge': ['p1', 'p2', 'q', 'y1', 'y2'],
    };
    everyDraw((_, lang, cards) => { for (const [id, n] of Object.entries(names)) expect(Object.keys(cards.get(id)!.audit!.params).sort(), `${id} ${lang}`).toEqual([...n].sort()); });
  });
});

describe('GP-12 numeric cards: recomputed by explicit Gaussian conditioning, printed text = audit params', () => {
  it('loo-var', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-loo-var')!, a = card.audit!.params;
      const { P, i } = looVarTuple(card, lang), where = `loo-var seed ${index} ${lang}`;
      expect([a.p1, a.q, a.p2, a.i], where).toEqual([P[0][0], P[0][1], P[1][1], i]);
      const C = inv2(P), { v } = condition(C, [0, 0], i - 1);
      expect(card.fields![0].answer, where).toBeCloseTo(v, 12);
      expect(card.fields![0].label, where).toContain(`σ₋${SUB[i]}²`);
      checkGrading(card, [v], where);
      expect(SPACES['loo-var'].has(key(P[0][0], P[1][1], P[0][1], i)), `${where}: tuple ${P.flat()} i=${i} outside the plan space`).toBe(true);
    });
  });
  it('loo-var-c', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-loo-var-c')!, a = card.audit!.params, where = `loo-var-c seed ${index} ${lang}`;
      const C = matrixOf(card.prompt), i = pointOf(lang, card.prompt);
      expect([a.a, a.b, a.c, a.i], where).toEqual([C[0][0], C[0][1], C[1][1], i]);
      const det = card.prompt.match(/det C = (\d+)·(\d+) − (\d+)² = (\d+)/);
      expect(det, where).not.toBeNull();
      expect([Number(det![1]), Number(det![2]), Number(det![3])], where).toEqual([C[0][0], C[1][1], C[0][1]]);
      expect(Number(det![4]), where).toBe(C[0][0] * C[1][1] - C[0][1] ** 2);
      const { v } = condition(C, [0, 0], i - 1);
      expect(1 / inv2(C)[i - 1][i - 1], where).toBeCloseTo(v, 12);
      expect(card.fields![0].answer, where).toBeCloseTo(v, 12);
      checkGrading(card, [v], where);
      expect(SPACES['loo-var-c'].has(key(C[0][0], C[0][1], C[1][1], i)), where).toBe(true);
    });
  });
  it('loo-mean', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-loo-mean')!, a = card.audit!.params, where = `loo-mean seed ${index} ${lang}`;
      const P = matrixOf(card.prompt), y = pairOf(card.prompt), i = pointOf(lang, card.prompt);
      expect([a.p1, a.q, a.p2, a.y1, a.y2, a.i], where).toEqual([P[0][0], P[0][1], P[1][1], y[0], y[1], i]);
      const { mu } = condition(inv2(P), y, i - 1);
      expect(card.fields![0].answer, where).toBeCloseTo(mu, 12);
      expect(card.fields![0].label, where).toContain(`μ₋${SUB[i]}`);
      expect(Math.abs(mu), where).toBeGreaterThanOrEqual(0.5 - 1e-12);
      checkGrading(card, [mu], where);
      expect(SPACES['loo-mean'].has(key(P[0][0], P[1][1], P[0][1], y[0], y[1], i)), `${where} outside plan space`).toBe(true);
    });
  });
  it('loo-density: answer uses the PRINTED constants, is within 0.01 of the true log density; printed text = audit', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-loo-density')!, a = card.audit!.params, where = `loo-density seed ${index} ${lang}`;
      const mu = first(card.prompt, new RegExp(`μ = (${NUM})`)), s2 = first(card.prompt, new RegExp(`σ² = (${NUM})`));
      const y = first(card.prompt, new RegExp(`yᵢ = (${NUM})`)), lns2 = first(card.prompt, /ln σ² = (\d\.\d+)/);
      expect([a.mu, a.s2, a.y, a.lns2], where).toEqual([mu, s2, y, lns2]);
      expect(lns2, where).toBe(s2 === 2 ? 0.7 : 1.4);
      expect(card.prompt, where).toContain(s2 === 2 ? 'ln σ² = 0.70' : 'ln σ² = 1.40');
      expect(card.prompt, where).toContain('ln 2π = 1.84');
      const d = y - mu, printed = -lns2 / 2 - d * d / (2 * s2) - 0.92;
      expect(card.fields![0].answer, where).toBeCloseTo(printed, 9);
      expect(Math.abs(card.fields![0].answer - logpdf(y, mu, s2)), `${where}: vs true log density`).toBeLessThan(0.01);
      expect(Math.abs(card.fields![0].answer * 100 - Math.round(card.fields![0].answer * 100)), `${where}: multiple of 0.01`).toBeLessThan(1e-7);
      checkGrading(card, [printed], where);
      expect(SPACES['loo-density'].has(key(mu, s2, y)), where).toBe(true);
    });
  });
  it('loo-density figure: N(mu, s2) bell curve, mu line, point at y on the curve, no leak of the answer', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-loo-density')!, a = card.audit!.params, where = `loo-density figure seed ${index} ${lang}`;
      const fig = card.figure!, mu = a.mu as number, s2 = a.s2 as number, y = a.y as number, sd = Math.sqrt(s2);
      const pdf = (x: number) => Math.exp(-((x - mu) ** 2) / (2 * s2)) / Math.sqrt(2 * Math.PI * s2);
      type Line = Extract<typeof fig.shapes[number], { kind: 'line' }>;
      type Pnt = Extract<typeof fig.shapes[number], { kind: 'point' }>;
      const lines = fig.shapes.filter(s => s.kind === 'line') as Line[];
      const points = fig.shapes.filter(s => s.kind === 'point') as Pnt[];
      const curve = lines.filter(l => l.points.length > 10);
      expect(curve, where).toHaveLength(1);
      for (const [x, v] of curve[0].points) expect(v, `${where}: density at ${x}`).toBeCloseTo(pdf(x), 9);
      const xs = curve[0].points.map(p => p[0]);
      expect(Math.min(...xs), where).toBeCloseTo(mu - 3 * sd, 9);
      expect(Math.max(...xs), where).toBeCloseTo(mu + 3 * sd, 9);
      const vertical = lines.filter(l => l.points.length === 2 && l.points[0][0] === l.points[1][0]);
      expect(vertical, where).toHaveLength(1);
      expect(vertical[0].points[0][0], where).toBeCloseTo(mu, 12);
      expect(points, where).toHaveLength(1);
      expect(points[0].at[0], where).toBeCloseTo(y, 12);
      expect(points[0].at[1], where).toBeCloseTo(pdf(y), 9);
      const all = [...curve[0].points, ...vertical[0].points, points[0].at];
      for (const [x, v] of all) {
        expect(x).toBeGreaterThanOrEqual(fig.view.xmin - 1e-9); expect(x).toBeLessThanOrEqual(fig.view.xmax + 1e-9);
        expect(v).toBeGreaterThanOrEqual(fig.view.ymin - 1e-9); expect(v).toBeLessThanOrEqual(fig.view.ymax + 1e-9);
        expect(v, where).toBeGreaterThanOrEqual(0);
      }
      const answer = card.fields![0].answer;
      const labels = fig.shapes.map(s => ('label' in s ? s.label ?? '' : '') + ('text' in s ? (s as { text: string }).text : ''));
      const figText = [fig.alt, fig.caption ?? '', fig.axes?.xLabel ?? '', fig.axes?.yLabel ?? '', ...labels].join(' ');
      const printedNums = new Set([Math.abs(mu), Math.abs(y), s2, 2, 0, 1]);
      for (const m of figText.replaceAll('−', '-').matchAll(/\d+(?:\.\d+)?/g)) expect(printedNums.has(Number(m[0])), `${where}: figure text number ${m[0]} not in the question`).toBe(true);
      expect(figText.replaceAll('−', '-'), where).not.toContain(answer.toFixed(2).replace('-', ''));
      expect(fig.alt.length, where).toBeGreaterThan(20);
      expect(fig.alt, where).toContain(fmtNum(mu));
      expect(fig.alt, where).toContain(fmtNum(y));
      expect(fig.axes?.xLabel, where).toBeTruthy();
      expect(fig.axes?.yLabel, where).toBeTruthy();
    });
  });
  it('scale-c: C -> cC by scaling the covariance (not the inverse), then explicit conditioning', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-scale-c')!, a = card.audit!.params, where = `scale-c seed ${index} ${lang}`;
      const P = matrixOf(card.prompt), y = pairOf(card.prompt), i = pointOf(lang, card.prompt), c = first(card.prompt, /c = (\d+)/);
      expect([a.p1, a.q, a.p2, a.y1, a.y2, a.i, a.c], where).toEqual([P[0][0], P[0][1], P[1][1], y[0], y[1], i, c]);
      const { mu, v } = condition(scale2(inv2(P), c), y, i - 1);
      expect(card.fields).toHaveLength(2);
      expect(card.fields![0].label, where).toContain(`μ₋${SUB[i]}`);
      expect(card.fields![1].label, where).toContain(`σ₋${SUB[i]}²`);
      expect(card.fields![0].answer, where).toBeCloseTo(mu, 12);
      expect(card.fields![1].answer, where).toBeCloseTo(v, 12);
      checkGrading(card, [mu, v], where);
      if (Math.abs(mu - v) > 0.05) expect(grade(card, [String(v), String(mu)]), where).toBe('incorrect');
      expect(SPACES['scale-c'].has(key(P[0][0], P[1][1], P[0][1], y[0], y[1], i, c)), where).toBe(true);
    });
  });
  it('challenge: sum of the two LOO log densities with the printed constants, within 0.02 of the true-log value', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-challenge')!, a = card.audit!.params, where = `challenge seed ${index} ${lang}`;
      const P = matrixOf(card.prompt), y = pairOf(card.prompt);
      expect([a.p1, a.q, a.p2, a.y1, a.y2], where).toEqual([P[0][0], P[0][1], P[1][1], y[0], y[1]]);
      expect(card.prompt, where).toContain('ln 2 = 0.70');
      expect(card.prompt, where).toContain('ln 4 = 1.40');
      expect(card.prompt, where).toContain('ln 2π = 1.84');
      const C = inv2(P);
      let trueSum = 0, printedSum = 0;
      for (const i of [0, 1]) {
        const { mu, v } = condition(C, y, i);
        trueSum += logpdf(y[i], mu, v);
        const pk = Math.round(1 / v);
        expect(Math.abs(1 / v - pk), where).toBeLessThan(1e-9);
        printedSum += LN[pk] / 2 - (y[i] - mu) ** 2 / (2 * v) - 0.92;
      }
      expect(card.fields![0].answer, where).toBeCloseTo(printedSum, 9);
      expect(Math.abs(card.fields![0].answer - trueSum), `${where}: vs true log`).toBeLessThan(0.02);
      expect(Math.abs(card.fields![0].answer * 100 - Math.round(card.fields![0].answer * 100)), where).toBeLessThan(1e-7);
      checkGrading(card, [printedSum], where);
      expect(card.fields![0].answer, where).toBeGreaterThanOrEqual(-12);
      expect(SPACES.challenge.has(key(P[0][0], P[1][1], P[0][1], y[0], y[1])), where).toBe(true);
    });
  });
});

const NUMBER_TOKEN = (n: number) => new RegExp(`(?<![\\d.])${fmtNum(n)}(?!\\d|\\.\\d)`);
describe('GP-12 choice cards', () => {
  it('mean-change: mu_-1 is the same for y1 = s and y1 = t (dense conditioning); exactly one option says so and states t - s', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-mean-change')!, where = `mean-change seed ${index} ${lang}`;
      const P = matrixOf(card.prompt), y = pairOf(card.prompt), t = first(card.prompt, new RegExp(`y₁ = (${NUM})`));
      const C = inv2(P);
      const m1 = condition(C, y, 0).mu, m2 = condition(C, [t, y[1]], 0).mu;
      expect(Math.abs(m1 - m2), where).toBeLessThan(1e-12);
      const delta = t - y[0];
      expect(delta, where).not.toBe(0);
      expect(SPACES['mean-change'].has(key(P[0][0], P[1][1], P[0][1], y[1], y[0], t)), where).toBe(true);
      const same = lang === 'en' ? /^μ₋₁ stays the same; only/ : /^μ₋₁ 不变；只有/;
      const verdicts = card.choice!.options.map(o => same.test(o));
      expect(verdicts.filter(Boolean), where).toHaveLength(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      const correct = card.choice!.options[card.choice!.answer];
      expect(correct, where).toMatch(NUMBER_TOKEN(delta));
      const others = card.choice!.options.filter((_, k) => k !== card.choice!.answer);
      expect(others.filter(o => NUMBER_TOKEN(delta).test(o) && (lang === 'en' ? /changes by/ : /改变/).test(o)), where).toHaveLength(1);
      expect(others.filter(o => (lang === 'en' ? /stays the same and so does/ : /不变，留一误差也不变/).test(o)), where).toHaveLength(1);
      expect(others.filter(o => (lang === 'en' ? /because y₁ is multiplied/ : /因为形成 C⁻¹y 时/).test(o)), where).toHaveLength(1);
      if (lang === 'en') expect(Math.max(...others.map(o => o.length)), `${where}: correct must not be longest`).toBeGreaterThan(correct.length);
    });
  });
  it('singular: C = [[a, sa], [sa, a]] has det 0; exactly one option says singular with the determinant', () => {
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-singular')!, where = `singular seed ${index} ${lang}`;
      const C = matrixOf(card.prompt), a = C[0][0], sa = C[0][1];
      expect(C[1][1], where).toBe(a);
      expect(SPACES.singular.has(key(a, sa)), where).toBe(true);
      expect(C[0][0] * C[1][1] - C[0][1] * C[1][0], where).toBe(0);
      const isSingular = lang === 'en' ? /singular/ : /奇异/;
      const verdicts = card.choice!.options.map(o => isSingular.test(o) && /= 0/.test(o));
      expect(verdicts.filter(Boolean), where).toHaveLength(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      const correct = card.choice!.options[card.choice!.answer];
      expect(correct, where).toContain(`${a}·${a} − `);
      expect(card.choice!.options.filter(o => isSingular.test(o)), where).toHaveLength(1);
      const others = card.choice!.options.filter((_, k) => k !== card.choice!.answer);
      if (lang === 'en') expect(Math.max(...others.map(o => o.length)), `${where}: correct must not be longest`).toBeGreaterThan(correct.length);
      expect(others.some(o => o.includes(`1/${a}`) && o.includes(`= ${a}`)), where).toBe(true);
    });
  });
  it('vs-evidence: exactly one option says robust; the six context sets all occur; correct option never the longest', () => {
    const contexts = new Set<string>();
    everyDraw((index, lang, cards) => {
      const card = cards.get('GP-12-vs-evidence')!, where = `vs-evidence seed ${index} ${lang}`;
      const robust = lang === 'en' ? /robust/ : /稳健/;
      const verdicts = card.choice!.options.map(o => robust.test(o));
      expect(verdicts.filter(Boolean), where).toHaveLength(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      const correct = card.choice!.options[card.choice!.answer], others = card.choice!.options.filter((_, k) => k !== card.choice!.answer);
      if (lang === 'en') expect(Math.max(...others.map(o => o.length)), `${where}: correct must not be longest`).toBeGreaterThan(correct.length);
      if (lang === 'en') contexts.add(card.prompt);
    });
    expect(contexts.size).toBe(6);
  });
});

describe('GP-12 sampling spaces equal the plan counts exactly', () => {
  it('my independent enumeration reproduces the plan counts', () => {
    expect(Object.fromEntries(Object.entries(SPACES).map(([k, v]) => [k, v.size]))).toEqual({
      'loo-var': 104, 'loo-var-c': 14, 'loo-mean': 1864, 'mean-change': 11592, 'loo-density': 57, 'scale-c': 2912, singular: 8, challenge: 324,
    });
  });
  it('the generator draws only inside each space and reaches all of every small space', () => {
    const seen: Record<string, Set<string>> = Object.fromEntries(Object.keys(SPACES).map(k => [k, new Set<string>()]));
    const N = 9000;
    for (let index = 0; index < N; index++) {
      const cards = gen(index, 'en');
      const c1 = cards.get('GP-12-loo-var')!, P1 = matrixOf(c1.prompt);
      seen['loo-var'].add(key(P1[0][0], P1[1][1], P1[0][1], pointOf('en', c1.prompt)));
      const c2 = cards.get('GP-12-loo-var-c')!, C2 = matrixOf(c2.prompt);
      seen['loo-var-c'].add(key(C2[0][0], C2[0][1], C2[1][1], pointOf('en', c2.prompt)));
      const a3 = cards.get('GP-12-loo-mean')!.audit!.params;
      seen['loo-mean'].add(key(a3.p1 as number, a3.p2 as number, a3.q as number, a3.y1 as number, a3.y2 as number, a3.i as number));
      const a5 = cards.get('GP-12-loo-density')!.audit!.params;
      seen['loo-density'].add(key(a5.mu as number, a5.s2 as number, a5.y as number));
      const a6 = cards.get('GP-12-scale-c')!.audit!.params;
      seen['scale-c'].add(key(a6.p1 as number, a6.p2 as number, a6.q as number, a6.y1 as number, a6.y2 as number, a6.i as number, a6.c as number));
      const C7 = matrixOf(cards.get('GP-12-singular')!.prompt);
      seen.singular.add(key(C7[0][0], C7[0][1]));
      const a9 = cards.get('GP-12-challenge')!.audit!.params;
      seen.challenge.add(key(a9.p1 as number, a9.p2 as number, a9.q as number, a9.y1 as number, a9.y2 as number));
      const p4 = cards.get('GP-12-mean-change')!.prompt, P4 = matrixOf(p4), y4 = pairOf(p4);
      seen['mean-change'].add(key(P4[0][0], P4[1][1], P4[0][1], y4[1], y4[0], first(p4, new RegExp(`y₁ = (${NUM})`))));
    }
    const report: Record<string, string> = {};
    for (const [k, space] of Object.entries(SPACES)) {
      const outside = [...seen[k]].filter(t => !space.has(t));
      expect(outside.slice(0, 5), `${k}: tuples outside the plan space`).toEqual([]);
      report[k] = `${seen[k].size}/${space.size}`;
    }
    for (const k of ['loo-var', 'loo-var-c', 'loo-density', 'singular', 'challenge']) expect(seen[k].size, `${k} coverage ${JSON.stringify(report)}`).toBe(SPACES[k as keyof typeof SPACES].size);
    // large spaces: uniform draws would miss about size * exp(-N / size) tuples
    for (const k of ['loo-mean', 'scale-c', 'mean-change']) {
      const size = SPACES[k as keyof typeof SPACES].size, expected = size * (1 - Math.exp(-N / size));
      expect(seen[k].size, `${k} coverage ${JSON.stringify(report)}`).toBeGreaterThan(expected * 0.97);
    }
    console.log('GP-12 coverage', JSON.stringify(report));
  }, 240000);
});

describe('GP-12 variety and learner-visible text lints', () => {
  it('each card has at least 6 distinct prompts over 60 seeds (EN and ZH)', () => {
    for (const lang of LANGS) {
      const prompts: Record<string, Set<string>> = {};
      for (let index = 0; index < SEEDS; index++) for (const c of gen(index, lang).values()) (prompts[c.id] ??= new Set()).add(c.prompt);
      for (const id of IDS) expect(prompts[id].size, `${id} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('Unicode-only notation, no ASCII hyphen minus, no double parentheses, no raw floats, no leftovers', () => {
    const ALLOWED_ZH_WORDS = new Set(['GP', 'GPML', 'LOO', 'ln', 'log', 'det', 'pdf', 'Wahba', 'CO', 'cC', 'Matérn']);
    const bad = new Set<string>();
    const add = (id: string, lang: string, why: string, text: string) => bad.add(`${id} ${lang} ${why}: ${text.slice(0, 90)}`);
    for (let index = 0; index < SEEDS; index++) for (const lang of LANGS) for (const c of gen(index, lang).values()) {
      for (const text of textOf(c)) {
        if (/(^|[\s(=,·+×/])-\s?\d/.test(text) || /\d-\d/.test(text) || / - /.test(text)) add(c.id, lang, 'ASCII hyphen minus', text);
        if (/\(\(|\)\)/.test(text)) add(c.id, lang, 'double parentheses', text);
        if (/\d+\.\d{3,}/.test(text)) add(c.id, lang, 'raw float', text);
        if (/[{}]|\$\{|\^|undefined|NaN|\[object/.test(text)) add(c.id, lang, 'leftover', text);
        if (/\b(?:p1|p2|y1|y2|mu_\w*|sigma\w*|s2|lns2|L_LOO|sqrt)\b/.test(text)) add(c.id, lang, 'ASCII name', text);
        if (lang === 'zh') for (const m of text.matchAll(/[A-Za-zÀ-ÿ]{2,}/g)) if (!ALLOWED_ZH_WORDS.has(m[0])) add(c.id, lang, `English word ${m[0]}`, text);
      }
    }
    expect([...bad].slice(0, 20)).toEqual([]);
  });
  it('hints use only numbers visible in the question', () => {
    everyDraw((index, lang, cards) => {
      for (const c of cards.values()) {
        const q = new Set(questionTextOf(c).flatMap(t => [...t.replaceAll('−', '-').matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0])));
        for (const m of c.hint.replaceAll('−', '-').matchAll(/\d+(?:\.\d+)?/g)) expect(q.has(m[0]), `${c.id} seed ${index} ${lang}: hint number ${m[0]}`).toBe(true);
      }
    });
  });
});
