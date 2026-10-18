import { describe, expect, it, vi } from 'vitest';
import { centralDiff, runOracle, type Oracle } from './oracle-harness';
import { spreadSeed } from './deck-invariants';
import { batch08Generators } from './batch08';
import { gradeCard, parseGameNumber, type CardGenerator, type PracticeCard } from '../types';
import type { Figure, FigureShape } from '../figure';

vi.setConfig({ testTimeout: 120_000 });

/**
 * Independent oracles for MIT-MV-36 (mass, average value, moment of inertia), 37 (change of variables), 38 (vector fields),
 * 39 (work and line integrals) and 40 (fundamental theorem for line integrals). Written from the "Audit" sections and the card
 * templates of docs/mit-mv-drafts/batch08-approved.md and from the PRINTED question text only; the generators were not read
 * before this file had run once. Routes: composite Gauss-Legendre quadrature (the quarter disk through x = a sin(phi) so the
 * integrand stays smooth, the diamond split at x = 0), numerical line integrals along explicit parametrisations with
 * Richardson-differentiated velocities, finite-difference Jacobians and gradients, bisection for the balance point, brute-force
 * point tests for choice cards and symbol cards. The closed forms of the audit lines are used only as a second assertion.
 */

// ------------------------------------------------------------------------------------------------------------------ helpers
const SEEDS = 60;
const PI = Math.PI;
type P = Record<string, number>;
type Pt = readonly [number, number];
type Vec2 = [number, number];
type Field = (x: number, y: number) => Vec2;
/** U+2212 minus to ASCII and no-break spaces to blanks. */
const clean = (s: string) => s.replace(/−/g, '-').replace(/ /g, ' ');
const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(spreadSeed(seed), lang);
const gen = (id: string) => batch08Generators[id];

const GL_X = [-0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664];
const GL_W = [0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891];
/** Composite 5-point Gauss-Legendre rule. */
function gl(f: (x: number) => number, a: number, b: number, panels = 40): number {
  const h = (b - a) / panels;
  let sum = 0;
  for (let i = 0; i < panels; i++) {
    const mid = a + (i + 0.5) * h;
    for (let k = 0; k < 5; k++) sum += GL_W[k] * f(mid + GL_X[k] * h / 2);
  }
  return sum * h / 2;
}
/** Richardson-extrapolated central difference. */
const d1 = (f: (x: number) => number, x: number, h = 1e-3) => (4 * centralDiff(f, x, h) - centralDiff(f, x, 2 * h)) / 3;
/** The integral of g over the first-quadrant quarter disk of radius a, written in Cartesian form with x = a sin(phi). */
const qdisk = (g: (x: number, y: number) => number, a: number) =>
  gl(phi => a * Math.cos(phi) * gl(y => g(a * Math.sin(phi), y), 0, a * Math.cos(phi), 6), 0, PI / 2);
/** The integral of g over the diamond |x| + |y| <= s (the square with vertices (+-s, 0), (0, +-s)). */
const diamond = (g: (x: number, y: number) => number, s: number) =>
  gl(x => gl(y => g(x, y), -(s + x), s + x, 8), -s, 0) + gl(x => gl(y => g(x, y), -(s - x), s - x, 8), 0, s);
/** The integral of g over the rectangle [0, a] x [0, b]. */
const rectangle = (g: (x: number, y: number) => number, a: number, b: number) => gl(x => gl(y => g(x, y), 0, b, 6), 0, a, 10);
function bisect(g: (x: number) => number, lo: number, hi: number): number {
  const glo = g(lo), ghi = g(hi);
  expect(glo * ghi, 'bisection bracket has no sign change').toBeLessThanOrEqual(0);
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; (g(mid) * glo > 0) ? (lo = mid) : (hi = mid); }
  return (lo + hi) / 2;
}
/** Line integral of F along a parametrised curve; the velocity is differentiated numerically. */
function lineInt(F: Field, path: (t: number) => Vec2, t0: number, t1: number): number {
  return gl(t => {
    const [x, y] = path(t);
    const [m, n] = F(x, y);
    return m * d1(s => path(s)[0], t) + n * d1(s => path(s)[1], t);
  }, t0, t1, 20);
}
const segment = (p: Pt, q: Pt) => (t: number): Vec2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const polyInt = (F: Field, pts: Pt[]) => pts.slice(1).reduce((sum, q, i) => sum + lineInt(F, segment(pts[i], q), 0, 1), 0);
/** Numerical gradient field of a scalar function. */
const gradient = (f: (x: number, y: number) => number): Field => (x, y) => [d1(s => f(s, y), x), d1(s => f(x, s), y)];
const hypot = (v: Vec2) => Math.hypot(v[0], v[1]);

type Env = Record<string, number>;
type Fn = (e: Env) => number;
const SUP: Record<string, number> = { '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
/** Recursive-descent parser for printed expressions: + - * / ^, superscripts, implicit multiplication, sqrt sign, pi, sin, cos, letters as variables. */
function parseExpr(src: string): Fn {
  const text = clean(src).replace(/·/g, '*');
  const toks: string[] = [];
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    const number = text.slice(i).match(/^\d+(?:\.\d+)?/);
    if (number) { toks.push(number[0]); i += number[0].length; continue; }
    const fn = text.slice(i).match(/^(sin|cos)/);
    if (fn) { toks.push(fn[0]); i += 3; continue; }
    if ('+-*/()^√'.includes(c) || c in SUP || /[A-Za-zθπ]/.test(c)) { toks.push(c); i++; continue; }
    throw new Error(`parseExpr: unexpected "${c}" in "${src}"`);
  }
  let pos = 0;
  const peek = () => toks[pos];
  const startsAtom = (t?: string) => t !== undefined && (/^\d/.test(t) || /^(sin|cos)$/.test(t) || /^[A-Za-zθπ]$/.test(t) || t === '(' || t === '√');
  const atom = (): Fn => {
    const t = toks[pos++];
    if (t === undefined) throw new Error(`parseExpr: unexpected end of "${src}"`);
    if (/^\d/.test(t)) { const v = Number(t); return () => v; }
    if (t === 'π') return () => PI;
    if (t === 'sin' || t === 'cos') {
      let e = 1;
      while (peek() in SUP) e = SUP[toks[pos++]];
      const arg = atom();
      return t === 'sin' ? env => Math.sin(arg(env)) ** e : env => Math.cos(arg(env)) ** e;
    }
    if (t === '√') { const arg = atom(); return env => Math.sqrt(arg(env)); }
    if (t === '(') { const v = sum(); if (toks[pos++] !== ')') throw new Error(`parseExpr: missing ) in "${src}"`); return v; }
    if (/^[A-Za-zθ]$/.test(t)) return env => { if (!(t in env)) throw new Error(`variable ${t} unbound in "${src}"`); return env[t]; };
    throw new Error(`parseExpr: unexpected token "${t}" in "${src}"`);
  };
  const power = (): Fn => {
    let base = atom();
    for (;;) {
      const t = peek();
      let exp: number;
      if (t in SUP) { exp = SUP[t]; pos++; } else if (t === '^') { pos++; exp = Number(toks[pos++]); } else return base;
      const b = base;
      base = env => b(env) ** exp;
    }
  };
  const unary = (): Fn => { if (peek() === '-') { pos++; const u = unary(); return env => -u(env); } return power(); };
  const product = (): Fn => {
    let left = unary();
    for (;;) {
      const t = peek(); const l = left;
      if (t === '*' || t === '/') { pos++; const r = unary(); left = t === '*' ? env => l(env) * r(env) : env => l(env) / r(env); }
      else if (startsAtom(t)) { const r = unary(); left = env => l(env) * r(env); }
      else return left;
    }
  };
  const sum = (): Fn => {
    let left = product();
    while (peek() === '+' || peek() === '-') { const op = toks[pos++]; const r = product(); const l = left; left = op === '+' ? env => l(env) + r(env) : env => l(env) - r(env); }
    return left;
  };
  const result = sum();
  if (pos !== toks.length) throw new Error(`parseExpr: trailing "${toks.slice(pos).join(' ')}" in "${src}"`);
  return result;
}
const xy = (src: string) => { const f = parseExpr(src); return (x: number, y: number) => f({ x, y }); };
const grab = (re: RegExp, text: string, where: string): RegExpMatchArray => {
  const m = clean(text).match(re);
  expect(m, `${where}: text does not match ${re}\n${text}`).not.toBeNull();
  return m!;
};
/** A printed coefficient: an empty string means an omitted 1. */
const coefOf = (s: string | undefined) => (s === undefined || s === '' ? 1 : Number(s));
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function ratio(x: number): [number, number] {
  for (let d = 1; d <= 5000; d++) { const n = Math.round(x * d); if (Math.abs(x - n / d) < 1e-9) return [n, d]; }
  throw new Error(`no small fraction for ${x}`);
}
const asText = (x: number) => { const [n, d] = ratio(x); return d === 1 ? `${n}` : `${n}/${d}`; };
const asPiText = (x: number) => { const [n, d] = ratio(x / PI); const head = n === 1 ? 'pi' : n === -1 ? '-pi' : `${n}pi`; return d === 1 ? head : `${head}/${d}`; };

type Deck = { i: number; cards: PracticeCard[] };
const decksCache: Record<string, Deck[]> = {};
function decks(id: string): Deck[] {
  return (decksCache[id] ??= Array.from({ length: SEEDS }, (_, i) => ({ i, cards: gen(id)(spreadSeed(i), 'en') })));
}
/** Every instance (one per seed) of card `slug` of game `id`. */
function eachCard(id: string, slug: string, fn: (card: PracticeCard, where: string, deck: PracticeCard[]) => void) {
  let count = 0;
  for (const { i, cards } of decks(id)) {
    const card = cards.find(c => c.id === `${id}-${slug}`);
    expect(card, `${id}-${slug} missing at seed #${i}`).toBeDefined();
    fn(card!, `${card!.id} seed #${i}`, cards);
    count++;
  }
  expect(count).toBe(SEEDS);
}
function expectOneCorrect(card: PracticeCard, verdict: (text: string) => boolean, where: string) {
  const verdicts = card.choice!.options.map(option => verdict(clean(option)));
  expect(verdicts.filter(Boolean).length, `${where}: exactly one option must be correct per the oracle: ${card.choice!.options.join(' | ')}`).toBe(1);
  expect(verdicts[card.choice!.answer], `${where}: card marks "${card.choice!.options[card.choice!.answer]}" but the oracle disagrees`).toBe(true);
}

// ----- audited numeric cards
type Spec = {
  slug: string;
  /** The audit params as a reader recovers them from the printed question. */
  printed: (card: PracticeCard, where: string) => P;
  /** Expected field values from the params by a numerical route. */
  truth: (p: P) => number[];
  /** Expected field values from the closed form of the audit line (second, separate assertion). */
  closed: (p: P) => number[];
  pi?: boolean;
};
function auditSuite(id: string, specs: Spec[]) {
  it('recomputes every audit kind (shared harness)', () => {
    const oracles: Record<string, Oracle> = {};
    for (const spec of specs) oracles[`${id}:${spec.slug}`] = p => spec.truth(p as P);
    const counts = runOracle(id, spread(gen(id)), oracles, SEEDS);
    expect(Object.keys(counts).sort()).toEqual(specs.map(s => `${id}:${s.slug}`).sort());
    for (const spec of specs) expect(counts[`${id}:${spec.slug}`], spec.slug).toBe(SEEDS);
  });
  for (const spec of specs) {
    it(`${spec.slug}: printed params, numeric answer, closed form and grading`, () => {
      eachCard(id, spec.slug, (card, where) => {
        expect(card.audit?.kind, where).toBe(`${id}:${spec.slug}`);
        const printed = spec.printed(card, where);
        expect(printed, `${where}: audit params differ from the printed question`).toEqual(card.audit!.params);
        const numeric = spec.truth(printed), closed = spec.closed(printed);
        expect(card.fields!.length, where).toBe(numeric.length);
        card.fields!.forEach((field, i) => {
          expect(Math.abs(field.answer - numeric[i]), `${where}: numeric oracle ${numeric[i]} vs card ${field.answer}`).toBeLessThanOrEqual(1e-8);
          expect(Math.abs(closed[i] - numeric[i]), `${where}: closed form ${closed[i]} vs numeric oracle ${numeric[i]}`).toBeLessThanOrEqual(1e-8);
        });
        // grading: the exact printed form of each answer is accepted, clearly wrong values are not
        const exact = numeric.map(v => (spec.pi ? asPiText(v) : asText(v)));
        expect(gradeCard(card, exact, null, []), `${where}: exact answer "${exact.join(' ; ')}" rejected`).toBe('correct');
        numeric.forEach((v, i) => {
          for (const wrong of [v + 1, v - 1, v + 1e-6, v * 1.1 + 0.3, 2 * v + 0.4321, -v + 0.1234]) {
            if (Math.abs(wrong - v) < 1e-7) continue;
            const attempt = exact.slice(); attempt[i] = String(wrong);
            expect(gradeCard(card, attempt, null, []), `${where}: wrong value ${wrong} accepted in field ${i}`).toBe('incorrect');
          }
        });
        // the prompt tells the student how to answer
        if (spec.pi) expect(clean(card.prompt), `${where}: a multiple-of-pi answer should be announced`).toMatch(/multiple of π/);
        else expect(clean(card.prompt), `${where}: decimals are not accepted, so the prompt must not ask for them`).not.toMatch(/decimal/i);
      });
    });
  }
}

// ----- figures and slots
const shapesOf = <K extends FigureShape['kind']>(fig: Figure | undefined, kind: K): Extract<FigureShape, { kind: K }>[] =>
  (fig?.shapes ?? []).filter((s): s is Extract<FigureShape, { kind: K }> => s.kind === kind);
function inPoly(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** The figure's single filled polygon describes `truth` up to a relative symmetric difference of `tol`. */
function expectFigureIs(fig: Figure | undefined, truth: (x: number, y: number) => boolean, box: [number, number, number, number], tol: number, where: string) {
  expect(fig, `${where}: figure missing`).toBeDefined();
  const areas = shapesOf(fig, 'area');
  expect(areas.length, `${where}: expected exactly one filled region`).toBe(1);
  const poly = areas[0].points;
  const N = 300, dx = (box[1] - box[0]) / N, dy = (box[3] - box[2]) / N;
  let diff = 0, area = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = box[0] + (i + 0.4137) * dx, y = box[2] + (j + 0.5821) * dy;
    const a = truth(x, y), b = inPoly(poly, x, y);
    if (a !== b) diff++;
    if (a) area++;
  }
  expect(area, `${where}: described region has no area`).toBeGreaterThan(0);
  expect(diff / area, `${where}: figure differs from the described region`).toBeLessThan(tol);
}
const distToSegment = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const distToPolyline = (p: Pt, poly: readonly Pt[]) => Math.min(...poly.slice(1).map((q, i) => distToSegment(p, poly[i], q)));
/** The drawn polylines (lines of the given tones, default all) stay within eps of the expected curves, and each expected curve's vertices are drawn. */
function expectCurves(fig: Figure | undefined, expected: (readonly Pt[])[], where: string, eps = 1e-6, onlyTone?: string) {
  const drawn = shapesOf(fig, 'line').filter(s => !onlyTone || s.tone === onlyTone);
  expect(drawn.length, `${where}: no line drawn`).toBeGreaterThan(0);
  for (const line of drawn) for (const p of line.points) expect(Math.min(...expected.map(c => distToPolyline(p, c))), `${where}: drawn point ${JSON.stringify(p)} is off the expected curves`).toBeLessThan(eps);
  for (const curve of expected) for (const v of curve) expect(Math.min(...drawn.flatMap(l => l.points.map(p => Math.hypot(p[0] - v[0], p[1] - v[1])))), `${where}: expected vertex ${JSON.stringify(v)} is not drawn`).toBeLessThan(eps);
}
function expectPoints(fig: Figure | undefined, pts: Pt[], where: string) {
  const drawn = shapesOf(fig, 'point').map(s => s.at);
  for (const v of pts) expect(Math.min(...drawn.map(p => Math.hypot(p[0] - v[0], p[1] - v[1]))), `${where}: point ${JSON.stringify(v)} not marked`).toBeLessThan(1e-9);
}
function renderSlots(card: PracticeCard): string {
  const s = card.slots!;
  return s.before + s.answers.map((a, i) => a + (i < s.answers.length - 1 ? (s.between?.[i] ?? ' ') : (s.after ?? ''))).join('');
}
/** The printed template of a symbol card (text after the last " = " of the "Fill in ..." sentence) with its blanks filled by the card's answers in order. */
function filledTemplate(card: PracticeCard, where: string): string {
  const m = clean(card.prompt).match(/[Ff]ill in (.*?)\.?$/);
  expect(m, `${where}: no "Fill in" sentence`).not.toBeNull();
  const tail = m![1].slice(m![1].lastIndexOf(' = ') + 3);
  const parts = tail.split('[ ]');
  expect(parts.length - 1, `${where}: blanks printed vs answers`).toBe(card.slots!.answers.length);
  return parts.map((p, i) => p + (i < card.slots!.answers.length ? clean(card.slots!.answers[i]) : '')).join('');
}
const squash = (s: string) => clean(s).replace(/\s+/g, '');
/** The slot widget renders exactly the formula printed in the prompt; tokens are distinct and contain every answer. */
function expectSlotLayout(card: PracticeCard, where: string) {
  const filled = filledTemplate(card, where);
  expect(squash(renderSlots(card)).endsWith(squash(filled)), `${where}: widget renders "${renderSlots(card)}" but the prompt shows "${filled}"`).toBe(true);
  expect(new Set(card.slots!.tokens).size, `${where}: duplicate tokens`).toBe(card.slots!.tokens.length);
  for (const a of card.slots!.answers) expect(card.slots!.tokens, `${where}: answer ${a} missing from the tokens`).toContain(a);
  expect(gradeCard(card, [], null, card.slots!.answers), where).toBe('correct');
}
/** Blank values in the order of the printed template. */
const blanks = (card: PracticeCard) => card.slots!.answers;

describe('Task C batch08 repaired text and arrow regressions', () => {
  it('exact masses and displayed denominators give accepted literal centers in EN/ZH', () => {
    for (let index = 0; index < 200; index++) for (const lang of ['en', 'zh'] as const) {
      const cards = gen('MIT-MV-36')(spreadSeed(index), lang);
      for (const slug of ['xcm-qdisk', 'ycm-qdisk']) {
        const card = cards.find(candidate => candidate.id.endsWith(`-${slug}`))!;
        const params = card.audit!.params as P;
        const radius = +grab(/y² ≤ (\d+)²/, card.prompt, card.id)[1];
        expect(radius).toBe(params.a);
        expect(card.prompt).toMatch(lang === 'en' ? /first quadrant/ : /第一象限/);
        const massText = grab(/M = (\d+(?:\/\d+)?)[.。]/, card.prompt, card.id)[1];
        const mass = parseGameNumber(massText)!;
        expect(mass).toBe(params.k * radius ** 3 / 3);
        const moment = qdisk((x, y) => (slug === 'xcm-qdisk' ? x : y) * params.k * y, radius);
        expect(gradeCard(card, [String(moment / mass)], null, [])).toBe('correct');
        if (slug === 'xcm-qdisk') {
          const literal = grab(/x_cm = ([\d.]+\/\(\d+(?:\/\d+)?\)) =/, card.explanation, card.id)[1];
          expect(gradeCard(card, [String(parseExpr(literal)({}))], null, [])).toBe('correct');
        }
      }
      const assumption = cards.find(card => card.id.endsWith('-com-assumption'))!;
      expect(assumption.explanation).toMatch(lang === 'en' ? /sufficient.*not necessary/ : /充分条件.*不是必要条件/);
    }
  });

  it('final displayed results are exact or explicitly approximate in EN/ZH', () => {
    for (let index = 0; index < 200; index++) for (const lang of ['en', 'zh'] as const) {
      const cards = gen('MIT-MV-36')(spreadSeed(index), lang);
      for (const slug of ['ycm-qdisk', 'challenge']) {
        const card = cards.find(candidate => candidate.id.endsWith(`-${slug}`))!;
        const display = grab(/≈ (\d+(?:\.\d+)?)/, card.explanation, card.id)[1];
        expect(Math.abs(+display - card.fields![0].answer)).toBeLessThanOrEqual(5e-7);
      }
      const average = cards.find(card => card.id.endsWith('-avg-distance'))!;
      const exactAverage = grab(/k = (\d+(?:\/\d+)?)[.。]/, average.explanation, average.id)[1];
      expect(gradeCard(average, [exactAverage], null, [])).toBe('correct');
      for (const card of gen('MIT-MV-39')(spreadSeed(index), lang).filter(candidate => /-circle-c[wc]w$/.test(candidate.id))) {
        const exactPi = grab(/(?:= |: |：)(-?\d+π)[.。]$/, card.explanation, card.id)[1];
        expect(gradeCard(card, [exactPi.replace('π', 'pi')], null, [])).toBe('correct');
      }
    }
  });

  it('field-match explains only the selected formula and its variant in EN/ZH', () => {
    const formulas = new Set<string>();
    for (let index = 0; index < 200; index++) for (const lang of ['en', 'zh'] as const) {
      const card = gen('MIT-MV-38')(spreadSeed(index), lang).find(candidate => candidate.id.endsWith('-field-match'))!;
      const correct = card.choice!.options[card.choice!.answer];
      formulas.add(correct);
      expect(card.explanation).toContain(`F = ${correct}`);
      expect(card.explanation).toContain('|F| = ');
      expect(card.explanation.match(/\([^(),]+, [^(),]+\)(?:\/r[²³]?)?/g)).toEqual([correct]);
      expect(card.explanation).not.toMatch(/for example|例如/);
    }
    expect(formulas.size).toBe(7);
  });

  it('diagonal arrows lie on the printed segment and point toward its endpoint in EN/ZH', () => {
    let unequal = 0;
    for (let index = 0; index < 200; index++) for (const lang of ['en', 'zh'] as const) {
      const card = gen('MIT-MV-40')(spreadSeed(index), lang).find(candidate => candidate.id.endsWith('-diag-field'))!;
      const endpoint = grab(/\(0, 0\).*?\((\d+), (\d+)\)/, card.prompt, card.id);
      const horizontal = +endpoint[1], vertical = +endpoint[2];
      if (horizontal !== vertical) unequal++;
      const arrows = shapesOf(card.figure, 'arrow');
      expect(arrows).toHaveLength(1);
      const arrow = arrows[0];
      for (const point of [arrow.from, arrow.to]) {
        expect(distToSegment(point, [0, 0], [horizontal, vertical])).toBeLessThan(1e-12);
        expect(horizontal * point[1] - vertical * point[0]).toBeCloseTo(0, 12);
      }
      expect((arrow.to[0] - arrow.from[0]) * horizontal + (arrow.to[1] - arrow.from[1]) * vertical).toBeGreaterThan(0);
      expect(arrow.from[0] / horizontal).toBeCloseTo(0.45, 12);
      expect(arrow.to[0] / horizontal).toBeCloseTo(0.55, 12);
    }
    expect(unequal).toBeGreaterThan(0);
  });
});

// ================================================================================================================== MIT-MV-36
describe('MIT-MV-36 mass, average value and moment of inertia', () => {
  const id = 'MIT-MV-36';
  const Q = (card: PracticeCard) => clean(card.prompt);
  auditSuite(id, [
    {
      slug: 'point-mass',
      printed: (c, w) => { const m = grab(/mass (-?\d+) at x = (-?\d+) and mass (-?\d+) at x = (-?\d+)/, Q(c), w); return { m1: +m[1], x1: +m[2], m2: +m[3], x2: +m[4] }; },
      truth: p => [bisect(cm => p.m1 * (p.x1 - cm) + p.m2 * (p.x2 - cm), Math.min(p.x1, p.x2), Math.max(p.x1, p.x2))],
      closed: p => [(p.m1 * p.x1 + p.m2 * p.x2) / (p.m1 + p.m2)],
    },
    {
      slug: 'mass-rect',
      printed: (c, w) => { const m = grab(/0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+) with density δ\(x, y\) = (\d*)x\./, Q(c), w); return { a: +m[1], b: +m[2], p: coefOf(m[3]) }; },
      truth: p => [rectangle((x) => p.p * x, p.a, p.b)],
      closed: p => [p.p * p.a * p.a * p.b / 2],
    },
    {
      slug: 'xcm-qdisk',
      printed: (c, w) => {
        const m = grab(/y² ≤ (\d+)² in the first quadrant, with density δ = (\d*)y\. Its mass is M = (\d+(?:\/\d+)?)\./, Q(c), w);
        const a = +m[1], k = coefOf(m[2]);
        expect(parseGameNumber(m[3]), `${w}: exact printed mass`).toBe(k * a ** 3 / 3);
        return { a, k };
      },
      truth: p => [qdisk((x, y) => x * p.k * y, p.a) / qdisk((_x, y) => p.k * y, p.a)],
      closed: p => [3 * p.a / 8],
    },
    {
      slug: 'ycm-qdisk', pi: true,
      printed: (c, w) => {
        const m = grab(/y² ≤ (\d+)² in the first quadrant, with density δ = (\d*)y\. Its mass is M = (\d+(?:\/\d+)?)\./, Q(c), w);
        const a = +m[1], k = coefOf(m[2]);
        expect(parseGameNumber(m[3]), `${w}: exact printed mass`).toBe(k * a ** 3 / 3);
        return { a, k };
      },
      truth: p => [qdisk((x, y) => y * p.k * y, p.a) / qdisk((_x, y) => p.k * y, p.a)],
      closed: p => [3 * PI * p.a / 16],
    },
    {
      slug: 'avg-distance',
      printed: (c, w) => { const m = grab(/y² ≤ (\d+)² in the first quadrant \(no density\)/, Q(c), w); return { a: +m[1] }; },
      truth: p => [qdisk((_x, y) => y, p.a) / qdisk(() => 1, p.a) * PI],
      closed: p => [4 * p.a / 3],
    },
    {
      slug: 'inertia-rect',
      printed: (c, w) => { const m = grab(/0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+) with density δ = (\d*)xy\./, Q(c), w); return { a: +m[1], b: +m[2], p: coefOf(m[3]) }; },
      truth: p => [rectangle((x, y) => x * x * p.p * x * y, p.a, p.b)],
      closed: p => [p.p * p.a ** 4 * p.b ** 2 / 8],
    },
    {
      slug: 'challenge', pi: true,
      printed: (c, w) => { const m = grab(/y² ≤ (\d+)² in the first quadrant with constant density δ = (\d+)\./, Q(c), w); return { a: +m[1], k: +m[2] }; },
      truth: p => [qdisk((x, y) => (x * x + y * y) * p.k, p.a)],
      closed: p => [p.k * PI * p.a ** 4 / 8],
    },
  ]);

  it('com-assumption: center of mass versus geometric center, judged by quadrature', () => {
    eachCard(id, 'com-assumption', (card, where) => {
      const m = grab(/0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+) and its density is δ = (.+?), so one side/, card.prompt, where);
      const a = +m[1];
      expect(+m[2], where).toBe(a);
      const dens = xy(m[3]);
      const mass = rectangle(dens, a, a);
      const cmx = rectangle((x, y) => x * dens(x, y), a, a) / mass, cmy = rectangle((x, y) => y * dens(x, y), a, a) / mass;
      const cmp = (v: number) => (Math.abs(v - a / 2) < 1e-9 ? 'equal' : v > a / 2 ? 'greater' : 'less');
      const where2: Record<string, string> = { x: cmp(cmx), y: cmp(cmy) };
      // denser side: does the density grow along the shifted coordinate?
      const grows = (axis: 'x' | 'y') => (axis === 'x' ? dens(a * 0.9, a / 2) - dens(a * 0.1, a / 2) : dens(a / 2, a * 0.9) - dens(a / 2, a * 0.1)) > 0;
      expectOneCorrect(card, text => {
        let r = text.match(/^([xy])_cm is (greater|less) than (\S+) and ([xy])_cm equals (\S+): the center of mass moves (toward|away from) the denser side\.$/);
        if (r) {
          const [, u, dir, h1, v, h2, side] = r;
          const shift = where2[u] === 'greater' ? 1 : -1;
          const towardDenser = shift === (grows(u as 'x' | 'y') ? 1 : -1);
          return where2[u] === dir && where2[v] === 'equal' && u !== v && near(parseGameNumber(h1)!, a / 2) && near(parseGameNumber(h2)!, a / 2) && (side === 'toward') === towardDenser;
        }
        r = text.match(/^It is exactly the geometric center \((\S+), (\S+)\), because the square is symmetric\.$/);
        if (r) return where2.x === 'equal' && where2.y === 'equal';
        r = text.match(/^Both x_cm and y_cm are (greater|less) than (\S+), because the density changes with ([xy])\.$/);
        if (r) return where2.x === r[1] && where2.y === r[1];
        throw new Error(`${where}: unrecognised option "${text}"`);
      }, where);
    });
  });

  it('setup-xcm: the widget shows the printed formula and the answers describe the quarter disk integral', () => {
    eachCard(id, 'setup-xcm', (card, where) => {
      expectSlotLayout(card, where);
      const m = grab(/y² ≤ (\d+)² in the first quadrant, with density δ = ([xy])\. .*∬_R ([xy])·δ dA/, card.prompt, where);
      const a = +m[1];
      const [integrand, rlo, rhi, tlo, thi] = blanks(card).map(parseExpr);
      const [r0, r1, t0, t1] = [rlo, rhi, tlo, thi].map(f => f({}));
      expect([r0, r1, t0, t1].map(v => Number(v.toFixed(9))), `${where}: limits`).toEqual([0, a, 0, Number((PI / 2).toFixed(9))]);
      const density = (x: number, y: number) => (m[2] === 'x' ? x : y), weight = (x: number, y: number) => (m[3] === 'x' ? x : y);
      // pointwise: the integrand is w·δ in polar form times the area factor r
      for (const r of [0.7, 1.3, 2.9]) for (const th of [0.3, 0.9, 1.4]) {
        const x = r * Math.cos(th), y = r * Math.sin(th);
        expect(integrand({ r, θ: th }), `${where}: integrand at r=${r}, θ=${th}`).toBeCloseTo(weight(x, y) * density(x, y) * r, 9);
      }
      // the whole iterated integral equals the Cartesian one over the quarter disk
      const polar = gl(th => gl(r => integrand({ r, θ: th }), r0, r1, 8), t0, t1, 8);
      expect(polar, where).toBeCloseTo(qdisk((x, y) => weight(x, y) * density(x, y), a), 8);
      // distractor tokens never equal the integrand
      for (const token of card.slots!.tokens) if (/r/.test(token) && token !== card.slots!.answers[0]) {
        const f = parseExpr(token);
        expect([0.7, 1.9].some(r => [0.4, 1.1].some(th => Math.abs(f({ r, θ: th }) - integrand({ r, θ: th })) > 1e-9)), `${where}: token ${token} is equivalent to the integrand`).toBe(true);
      }
    });
  });

  it('figures: rectangle and quarter disk match the printed regions', () => {
    for (const slug of ['mass-rect', 'inertia-rect']) eachCard(id, slug, (card, where) => {
      const m = grab(/0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+)/, card.prompt, where);
      expectFigureIs(card.figure, (x, y) => x >= 0 && x <= +m[1] && y >= 0 && y <= +m[2], [-1, +m[1] + 1, -1, +m[2] + 1], 0.01, where);
    });
    for (const slug of ['xcm-qdisk', 'ycm-qdisk', 'avg-distance', 'challenge']) eachCard(id, slug, (card, where) => {
      const a = +grab(/y² ≤ (\d+)²/, card.prompt + ' ' + card.figure!.alt, where)[1];
      expectFigureIs(card.figure, (x, y) => x >= 0 && y >= 0 && x * x + y * y <= a * a, [-1, a + 1, -1, a + 1], 0.02, where);
    });
  });
});

// ================================================================================================================== MIT-MV-37
describe('MIT-MV-37 change of variables and the Jacobian', () => {
  const id = 'MIT-MV-37';
  const Q = (card: PracticeCard) => clean(card.prompt);
  /** Jacobian determinant of a map by Richardson finite differences. */
  const jacobian = (map: (s: number, t: number) => Vec2, s: number, t: number) => {
    const xs = d1(q => map(q, t)[0], s), xt = d1(q => map(s, q)[0], t), ys = d1(q => map(q, t)[1], s), yt = d1(q => map(s, q)[1], t);
    return xs * yt - xt * ys;
  };
  /** Coefficients (of the first and second variable) of the two linear expressions printed as "A = expr1, B = expr2". */
  const linearPair = (e1: string, e2: string, v: [string, string]) => {
    const f = parseExpr(e1), g = parseExpr(e2);
    const at = (h: Fn, s: number, t: number) => h({ [v[0]]: s, [v[1]]: t });
    expect(at(f, 2, 3), `${e1} is not linear homogeneous`).toBeCloseTo(2 * at(f, 1, 0) + 3 * at(f, 0, 1), 12);
    expect(at(g, 2, 3), `${e2} is not linear homogeneous`).toBeCloseTo(2 * at(g, 1, 0) + 3 * at(g, 0, 1), 12);
    return [at(f, 1, 0), at(f, 0, 1), at(g, 1, 0), at(g, 0, 1)];
  };
  /** Solve u = U(x, y), v = V(x, y) for (x, y) by Newton with a finite-difference Jacobian. */
  const invert = (U: (x: number, y: number) => number, V: (x: number, y: number) => number) => (u: number, v: number): Vec2 => {
    let x = 0.1, y = 0.2;
    for (let it = 0; it < 30; it++) {
      const h = 1e-6;
      const a = (U(x + h, y) - U(x - h, y)) / (2 * h), b = (U(x, y + h) - U(x, y - h)) / (2 * h);
      const c = (V(x + h, y) - V(x - h, y)) / (2 * h), d = (V(x, y + h) - V(x, y - h)) / (2 * h);
      const du = u - U(x, y), dv = v - V(x, y), det = a * d - b * c;
      x += (d * du - b * dv) / det; y += (-c * du + a * dv) / det;
    }
    return [x, y];
  };
  auditSuite(id, [
    {
      slug: 'jac-sign',
      printed: (c, w) => { const m = grab(/x = (.+), y = (.+?)\. Find the Jacobian/, Q(c), w); const [a, b, cc, d] = linearPair(m[1], m[2], ['u', 'v']); return { a, b, c: cc, d }; },
      truth: p => [jacobian((u, v) => [p.a * u + p.b * v, p.c * u + p.d * v], 0.3, 0.7)],
      closed: p => [p.a * p.d - p.b * p.c],
    },
    {
      slug: 'reciprocal',
      printed: (c, w) => { const m = grab(/u = (.+), v = (.+?)\. Without solving/, Q(c), w); const [p, q, r, s] = linearPair(m[1], m[2], ['x', 'y']); return { p, q, r, s }; },
      truth: p => { const inv = invert((x, y) => p.p * x + p.q * y, (x, y) => p.r * x + p.s * y); return [jacobian(inv, 0.4, -0.3)]; },
      closed: p => [1 / (p.p * p.s - p.q * p.r)],
    },
    {
      slug: 'polar-check',
      printed: (c, w) => { const m = grab(/at the point \((\d+), (\d+)\)/, Q(c), w); return { x0: +m[1], y0: +m[2] }; },
      truth: p => [jacobian((x, y) => [Math.hypot(x, y), Math.atan2(y, x)], p.x0, p.y0)],
      closed: p => [1 / Math.hypot(p.x0, p.y0)],
    },
    {
      slug: 'sub-area',
      printed: (c, w) => { const m = grab(/when r = (\d+) and u = (\d+)\./, Q(c), w); return { r: +m[1], u: +m[2] }; },
      truth: p => [Math.abs(jacobian((u, r) => [u, Math.sqrt(r * r - u * u)], p.u, p.r))],
      closed: p => [p.r / Math.sqrt(p.r * p.r - p.u * p.u)],
    },
    {
      slug: 'square-integral',
      printed: (c, w) => { const m = grab(/\(x \+ y\)\^(\d+) dA over the square R with vertices \((\d+), 0\)/, Q(c), w); return { s: +m[2], p: +m[1] }; },
      truth: p => [diamond((x, y) => (x + y) ** p.p, p.s)],
      closed: p => [2 * p.s ** (p.p + 2) / (p.p + 1)],
    },
    {
      slug: 'challenge',
      printed: (c, w) => { const m = grab(/\(x \+ y\)\^(\d+)\/\(2 - x \+ y\)\^(\d+) dx dy, where R is the square with vertices \(1, 0\)/, Q(c), w); return { m: +m[1], n: +m[2] }; },
      truth: p => [diamond((x, y) => (x + y) ** p.m / (2 - x + y) ** p.n, 1)],
      closed: p => [gl(v => (2 - v) ** -p.n, -1, 1) / (p.m + 1)],
    },
  ]);

  it('area-element: the area element uses the absolute value of the Jacobian', () => {
    eachCard(id, 'area-element', (card, where) => {
      const J = parseGameNumber(grab(/= (.+) everywhere/, card.prompt, where)[1])!;
      expect(Number.isFinite(J) && J !== 0, where).toBe(true);
      expectOneCorrect(card, text => {
        const m = clean(text).match(/^dA = (.*?) ?du dv$/);
        expect(m, `${where}: option format "${text}"`).not.toBeNull();
        return near(parseExpr(m![1] === '' ? '1' : m![1])({}), Math.abs(J));
      }, where);
    });
  });

  it('region-image: the image of the square under u = x + y, v = x - y', () => {
    eachCard(id, 'region-image', (card, where) => {
      const m = grab(/vertices \((\d+), 0\), \(0, (\d+)\), \(-(\d+), 0\), \(0, -(\d+)\) is mapped by u = (.+), v = (.+?)\. Which/, card.prompt, where);
      const s = +m[1];
      expect([+m[2], +m[3], +m[4]], where).toEqual([s, s, s]);
      const U = xy(m[5]), V = xy(m[6]);
      const image: Pt[] = [[s, 0], [0, s], [-s, 0], [0, -s]].map(([x, y]) => [U(x, y), V(x, y)] as const);
      const box = (f: (u: number, v: number) => boolean) => {
        let diff = 0, area = 0; const N = 240, w = 4 * s;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const u = -w / 2 + (i + 0.4137) * w / N, v = -w / 2 + (j + 0.5821) * w / N;
          const A = inPoly(image, u, v), B = f(u, v);
          if (A !== B) diff++; if (A) area++;
        }
        return diff / area;
      };
      expectOneCorrect(card, text => {
        const t = clean(text);
        const rectangular = t.match(/^(.+) ≤ u ≤ (.+) and (.+) ≤ v ≤ (.+)$/);
        if (rectangular) { const [ulo, uhi, vlo, vhi] = rectangular.slice(1, 5).map(e => parseExpr(e)({})); return box((u, v) => u >= ulo && u <= uhi && v >= vlo && v <= vhi) < 0.01; }
        const disk = t.match(/^u² \+ v² ≤ (\d+)²$/);
        if (disk) { const radius = +disk[1]; return box((u, v) => u * u + v * v <= radius ** 2) < 0.01; }
        throw new Error(`${where}: unrecognised option "${text}"`);
      }, where);
    });
  });

  it('setup: limits and integrand reproduce the integral over the square', () => {
    eachCard(id, 'setup', (card, where) => {
      expectSlotLayout(card, where);
      const m = grab(/vertices \((\d+), 0\).*∬_R \(x \+ y\)\^(\d+) dA/, card.prompt, where);
      const s = +m[1], p = +m[2];
      const [integrand, ulo, uhi, vlo, vhi] = blanks(card).map(parseExpr);
      const [u0, u1, v0, v1] = [ulo, uhi, vlo, vhi].map(f => f({}));
      expect([u0, u1, v0, v1], `${where}: limits`).toEqual([-s, s, -s, s]);
      const iterated = gl(v => gl(u => integrand({ u, v }), u0, u1, 8), v0, v1, 8);
      expect(iterated, where).toBeCloseTo(diamond((x, y) => (x + y) ** p, s), 8);
      for (const token of card.slots!.tokens) if (/u/.test(token) && token !== card.slots!.answers[0]) {
        const f = parseExpr(token);
        expect(Math.abs(gl(v => gl(u => f({ u, v }), u0, u1, 8), v0, v1, 8) - iterated), `${where}: token ${token} gives the same integral`).toBeGreaterThan(1e-6);
      }
    });
  });

  it('figures show the diamond |x| + |y| <= s', () => {
    for (const slug of ['region-image', 'setup', 'square-integral', 'challenge']) eachCard(id, slug, (card, where) => {
      const s = +grab(/vertices \((\d+), 0\)/, card.prompt, where)[1];
      expectFigureIs(card.figure, (x, y) => Math.abs(x) + Math.abs(y) <= s, [-s - 1, s + 1, -s - 1, s + 1], 0.01, where);
      expectPoints(card.figure, [[s, 0], [0, s], [-s, 0], [0, -s]], where);
    });
  });
});

// ================================================================================================================== MIT-MV-38
describe('MIT-MV-38 vector fields', () => {
  const id = 'MIT-MV-38';
  const Q = (card: PracticeCard) => clean(card.prompt);
  const radial = (k: number): Field => (x, y) => [k * x / (x * x + y * y), k * y / (x * x + y * y)];
  /** Velocity at (x0, y0) of a fluid rotating counterclockwise with angular velocity w: differentiate the motion of the particle. */
  const rotationVelocity = (w: number, x0: number, y0: number): Vec2 => [
    d1(t => x0 * Math.cos(w * t) - y0 * Math.sin(w * t), 0), d1(t => x0 * Math.sin(w * t) + y0 * Math.cos(w * t), 0)];
  auditSuite(id, [
    {
      slug: 'gradient-point',
      printed: (c, w) => { const m = grab(/f\(x, y\) = (\d*)xy²\. Find ∇f at the point \((\d+), (\d+)\)/, Q(c), w); return { a: coefOf(m[1]), x0: +m[2], y0: +m[3] }; },
      truth: p => { const f = (x: number, y: number) => p.a * x * y * y; return [d1(x => f(x, p.y0), p.x0), d1(y => f(p.x0, y), p.y0)]; },
      closed: p => [p.a * p.y0 ** 2, 2 * p.a * p.x0 * p.y0],
    },
    {
      slug: 'radial-mag',
      printed: (c, w) => { const m = grab(/F\(x, y\) = (\d*)\(x, y\)\/\(x² \+ y²\)\. Find the magnitude \|F\| at the point \((\d+), (\d+)\)/, Q(c), w); return { k: coefOf(m[1]), x0: +m[2], y0: +m[3] }; },
      truth: p => [hypot(radial(p.k)(p.x0, p.y0))],
      closed: p => [p.k / Math.hypot(p.x0, p.y0)],
    },
    {
      slug: 'electric-mag',
      printed: (c, w) => { const m = grab(/F\(x, y\) = (\d*)\(x, y\)\/\(x² \+ y²\)\^\{3\/2\}\. Find \|F\| at the point \((-?\d+), (-?\d+)\)/, Q(c), w); return { c: coefOf(m[1]), x0: +m[2], y0: +m[3] }; },
      truth: p => { const F: Field = (x, y) => [p.c * x / (x * x + y * y) ** 1.5, p.c * y / (x * x + y * y) ** 1.5]; return [hypot(F(p.x0, p.y0))]; },
      closed: p => [p.c / (p.x0 ** 2 + p.y0 ** 2)],
    },
    {
      slug: 'rotation',
      printed: (c, w) => { const m = grab(/ω = (\d+)\. Find .* at the point \((-?\d+), (-?\d+)\)/, Q(c), w); return { w: +m[1], x0: +m[2], y0: +m[3] }; },
      truth: p => rotationVelocity(p.w, p.x0, p.y0),
      closed: p => [-p.w * p.y0, p.w * p.x0],
    },
    {
      slug: 'source-flow', pi: true,
      printed: (c, w) => { const m = grab(/F\(x, y\) = (\d*)\(x, y\)\/\(x² \+ y²\) gives .*x² \+ y² = (\d+)²/, Q(c), w); return { k: coefOf(m[1]), a: +m[2] }; },
      truth: p => { const F = radial(p.k); return [gl(phi => { const [fx, fy] = F(p.a * Math.cos(phi), p.a * Math.sin(phi)); return (fx * Math.cos(phi) + fy * Math.sin(phi)) * p.a; }, 0, 2 * PI)]; },
      closed: p => [2 * PI * p.k],
    },
    {
      slug: 'challenge',
      printed: (c, w) => { const m = grab(/density (\d+) rotates counterclockwise about the origin with angular velocity ω = (\d+)\..*at the point \((-?\d+), (-?\d+)\)/, Q(c), w); return { d: +m[1], w: +m[2], x0: +m[3], y0: +m[4] }; },
      truth: p => [p.d * hypot(rotationVelocity(p.w, p.x0, p.y0))],
      closed: p => [p.d * p.w * Math.hypot(p.x0, p.y0)],
    },
  ]);

  /** "(A, B)" or "(A, B)/r^k" as a vector field. */
  function optionField(text: string, where: string): Field {
    const m = clean(text).match(/^\((.+), (.+)\)(?:\/(r|r²|r³))?$/);
    expect(m, `${where}: cannot read field option "${text}"`).not.toBeNull();
    const A = xy(m![1]), B = xy(m![2]);
    const k = m![3] === undefined ? 0 : m![3] === 'r' ? 1 : m![3] === 'r²' ? 2 : 3;
    return (x, y) => { const r = Math.hypot(x, y); return [A(x, y) / r ** k, B(x, y) / r ** k]; };
  }
  const SAMPLE: Pt[] = [[1.3, 0.7], [-0.9, 1.6], [2.1, -1.4], [-1.7, -0.6]];
  /** Whether a field has the property stated by the card description. */
  function describes(desc: string, F: Field, where: string): boolean {
    const t = clean(desc);
    const each = (ok: (x: number, y: number, f: Vec2) => boolean) => SAMPLE.every(([x, y]) => ok(x, y, F(x, y)));
    const away = (x: number, y: number, f: Vec2) => f[0] * x + f[1] * y > 0 && Math.abs(f[0] * y - f[1] * x) < 1e-9;
    if (/^Every vector has length 1 and points away from the origin\.$/.test(t)) return each((x, y, f) => near(hypot(f), 1) && away(x, y, f));
    if (/^Every vector points away from the origin and has length 1\/r\.$/.test(t)) return each((x, y, f) => near(hypot(f), 1 / Math.hypot(x, y)) && away(x, y, f));
    if (/^Every vector has length 1 and is tangent to the circles around the origin, pointing counterclockwise\.$/.test(t)) return each((x, y, f) => near(hypot(f), 1) && Math.abs(f[0] * x + f[1] * y) < 1e-9 && x * f[1] - y * f[0] > 0);
    if (/^Every vector has length 1 and is tangent to the circles around the origin, pointing clockwise\.$/.test(t)) return each((x, y, f) => near(hypot(f), 1) && Math.abs(f[0] * x + f[1] * y) < 1e-9 && x * f[1] - y * f[0] < 0);
    const g = t.match(/^Every vector is the same: it points straight down and has length (\d+)\.$/);
    if (g) return each((_x, _y, f) => near(f[0], 0) && near(f[1], -+g[1]));
    throw new Error(`${where}: unrecognised description "${desc}"`);
  }
  it('field-match: the option has the described direction and length, and the arrows of the figure follow it', () => {
    eachCard(id, 'field-match', (card, where) => {
      const desc = clean(card.prompt).match(/arrows drawn at some points around the origin\)\. (.+?) Which formula/);
      expect(desc, `${where}: description not found in "${card.prompt}"`).not.toBeNull();
      expectOneCorrect(card, text => describes(desc![1], optionField(text, where), where), where);
      const F = optionField(card.choice!.options[card.choice!.answer], where);
      const arrows = shapesOf(card.figure, 'arrow');
      expect(arrows.length, `${where}: arrows`).toBeGreaterThanOrEqual(8);
      for (const a of arrows) {
        const [fx, fy] = F(a.from[0], a.from[1]), dx = a.to[0] - a.from[0], dy = a.to[1] - a.from[1];
        expect((fx * dx + fy * dy) / (Math.hypot(fx, fy) * Math.hypot(dx, dy)), `${where}: arrow at ${JSON.stringify(a.from)} does not follow the field`).toBeGreaterThan(1 - 1e-9);
      }
    });
  });
  it('gradient-perp: the offered vector is perpendicular to the contour', () => {
    eachCard(id, 'gradient-perp', (card, where) => {
      const m = grab(/f\(x, y\) = x² \+ (\d+)y²\..*point \((-?\d+), (-?\d+)\)/, card.prompt, where);
      const b = +m[1], x0 = +m[2], y0 = +m[3];
      const f = (x: number, y: number) => x * x + b * y * y, level = f(x0, y0);
      // tangent of the contour by following it numerically: solve f(x, y) = level for y near y0 at x0 +- h
      const onContour = (x: number) => { let y = y0; for (let i = 0; i < 60; i++) y -= (f(x, y) - level) / d1(s => f(x, s), y); return y; };
      const h = 1e-4, tangent: Vec2 = [2 * h, onContour(x0 + h) - onContour(x0 - h)];
      expectOneCorrect(card, text => {
        const v = clean(text).match(/^\((-?\d+), (-?\d+)\)$/);
        expect(v, `${where}: option format "${text}"`).not.toBeNull();
        return Math.abs(+v![1] * tangent[0] + +v![2] * tangent[1]) < 1e-5 * Math.hypot(+v![1], +v![2]) * hypot(tangent);
      }, where);
    });
  });
  it('domain-check: the field is undefined exactly where the denominator vanishes', () => {
    eachCard(id, 'domain-check', (card, where) => {
      const m = grab(/F\(x, y\) = \((.+?), (.+?)\)\/\((.+)\)\. At which/, card.prompt, where);
      const denominator = xy(m[3]);
      const zeros: Pt[] = [];
      for (let x = -4; x <= 4; x += 0.5) for (let y = -4; y <= 4; y += 0.5) if (Math.abs(denominator(x, y)) < 1e-12) zeros.push([x, y]);
      expect(zeros.length, `${where}: the denominator should vanish at exactly one grid point`).toBe(1);
      const undefinedAt = (x: number, y: number) => Math.abs(x - zeros[0][0]) < 1e-9 && Math.abs(y - zeros[0][1]) < 1e-9;
      expectOneCorrect(card, text => {
        const t = clean(text);
        let excluded: ((x: number, y: number) => boolean) | undefined;
        const point = t.match(/^At every point except \((-?\d+), (-?\d+)\)\.$/);
        if (point) { const px = +point[1], py = +point[2]; excluded = (x, y) => x === px && y === py; }
        if (/^At every point except the origin \(0, 0\)\.$/.test(t)) excluded = (x, y) => x === 0 && y === 0;
        if (/^At every point of the plane/.test(t)) excluded = () => false;
        const line = t.match(/^At every point except those on the line x = (-?\d+)\.$/);
        if (line) { const lx = +line[1]; excluded = x => x === lx; }
        if (!excluded) throw new Error(`${where}: unrecognised option "${text}"`);
        for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (excluded(x, y) !== undefinedAt(x, y)) return false;
        return true;
      }, where);
    });
  });
  it('source-flow figure: a circle of radius a with outward arrows', () => {
    eachCard(id, 'source-flow', (card, where) => {
      const a = +grab(/x² \+ y² = (\d+)²/, card.prompt, where)[1];
      for (const line of shapesOf(card.figure, 'line')) for (const p of line.points) expect(Math.abs(Math.hypot(p[0], p[1]) - a), where).toBeLessThan(1e-9);
      const arrows = shapesOf(card.figure, 'arrow');
      expect(arrows.length, where).toBeGreaterThanOrEqual(4);
      for (const ar of arrows) {
        expect(Math.abs(Math.hypot(ar.from[0], ar.from[1]) - a), `${where}: arrow base off the circle`).toBeLessThan(1e-9);
        expect((ar.to[0] - ar.from[0]) * ar.from[0] + (ar.to[1] - ar.from[1]) * ar.from[1], `${where}: arrow not outward`).toBeGreaterThan(0);
        expect(Math.abs((ar.to[0] - ar.from[0]) * ar.from[1] - (ar.to[1] - ar.from[1]) * ar.from[0]), `${where}: arrow not radial`).toBeLessThan(1e-9);
      }
    });
  });
});

// ================================================================================================================== MIT-MV-39
describe('MIT-MV-39 work and line integrals', () => {
  const id = 'MIT-MV-39';
  const Q = (card: PracticeCard) => clean(card.prompt);
  const lin = (M: (x: number, y: number) => number, N: (x: number, y: number) => number): Field => (x, y) => [M(x, y), N(x, y)];
  /** F = (p x² y, x - k y) of the cards 2-5, read from the printed pair. */
  const cubicPair = (c: PracticeCard, w: string) => {
    const m = grab(/F = \((.+?), (.+?)\)\. C is/, Q(c), w);
    const M = xy(m[1]), N = xy(m[2]);
    const p = M(1, 1), k = -N(0, 1);
    expect(M(2, 3), `${w}: first component is not p x² y`).toBeCloseTo(12 * p, 12);
    expect(N(2, 3), `${w}: second component is not x - k y`).toBeCloseTo(2 - 3 * k, 12);
    return { p, k };
  };
  const spinPair = (text: string, w: string) => {
    const m = grab(/F = \((.+?), (.+?)\)/, text, w);
    const M = xy(m[1]), N = xy(m[2]);
    expect(M(2, 3), `${w}: not (-p y, p x)`).toBeCloseTo(-3 * N(1, 0), 12);
    expect(N(2, 3), `${w}: not (-p y, p x)`).toBeCloseTo(2 * N(1, 0), 12);
    return N(1, 0);
  };
  auditSuite(id, [
    {
      slug: 'axis-work',
      printed: (c, w) => {
        const m = grab(/F = \((.+?), (.+?)\)\. Let C be the segment of the x-axis from \(0, 0\) to \((\d+), 0\)/, Q(c), w);
        const M = xy(m[1]), N = xy(m[2]);
        const p = M(1, 0), q = M(0, 1), r = N(1, 1);
        expect(M(2, 3), `${w}: first component is not p x + q y`).toBeCloseTo(2 * p + 3 * q, 12);
        expect(N(2, 3), `${w}: second component is not r x y`).toBeCloseTo(6 * r, 12);
        return { a: +m[3], p, q, r };
      },
      truth: p => [lineInt(lin((x, y) => p.p * x + p.q * y, (x, y) => p.r * x * y), segment([0, 0], [p.a, 0]), 0, 1)],
      closed: p => [p.p * p.a * p.a / 2],
    },
    {
      slug: 'parabola-value',
      printed: (c, w) => cubicPair(c, w),
      truth: p => [lineInt(lin((x, y) => p.p * x * x * y, (x, y) => x - p.k * y), t => [t, t * t], 0, 1)],
      closed: p => [p.p / 5 + 2 / 3 - p.k / 2],
    },
    {
      slug: 'line-value',
      printed: (c, w) => cubicPair(c, w),
      truth: p => [lineInt(lin((x, y) => p.p * x * x * y, (x, y) => x - p.k * y), t => [t, t], 0, 1)],
      closed: p => [p.p / 4 + (1 - p.k) / 2],
    },
    {
      slug: 'circle-ccw', pi: true,
      printed: (c, w) => { const p = spinPair(Q(c), w); const a = +grab(/circle x² \+ y² = (\d+)², traversed once counterclockwise/, Q(c), w)[1]; return { a, p }; },
      truth: p => [lineInt(lin((_x, y) => -p.p * y, x => p.p * x), t => [p.a * Math.cos(t), p.a * Math.sin(t)], 0, 2 * PI)],
      closed: p => [2 * PI * p.p * p.a * p.a],
    },
    {
      slug: 'circle-cw', pi: true,
      printed: (c, w) => { const p = spinPair(Q(c), w); const a = +grab(/same circle x² \+ y² = (\d+)², but now C is traversed once clockwise/, Q(c), w)[1]; return { a, p }; },
      truth: p => [lineInt(lin((_x, y) => -p.p * y, x => p.p * x), t => [p.a * Math.cos(t), -p.a * Math.sin(t)], 0, 2 * PI)],
      closed: p => [-2 * PI * p.p * p.a * p.a],
    },
    {
      slug: 'challenge',
      printed: (c, w) => {
        const m = grab(/F = \((.+?), (.+?)\)\. C goes first along the segment from \(0, (\d+)\) to \((\d+), \d+\), then along the segment from \(\d+, \d+\) down to \(\d+, 0\)/, Q(c), w);
        const M = xy(m[1]), N = xy(m[2]);
        const p = M(0, 1), q = N(0, 1);
        expect(M(2, 3), `${w}: first component is not p y`).toBeCloseTo(3 * p, 12);
        expect(N(2, 3), `${w}: second component is not x + q y`).toBeCloseTo(2 + 3 * q, 12);
        return { p, q, a: +m[4], b: +m[3] };
      },
      truth: p => [polyInt(lin((_x, y) => p.p * y, (x, y) => x + p.q * y), [[0, p.b], [p.a, p.b], [p.a, 0]])],
      closed: p => [(p.p - 1) * p.a * p.b - p.q * p.b * p.b / 2],
    },
  ]);

  it('parabola-setup: limits and integrand are F·dr along (t, t²)', () => {
    eachCard(id, 'parabola-setup', (card, where) => {
      expectSlotLayout(card, where);
      const { p, k } = cubicPair(card, where);
      const [lo, hi, integrand] = blanks(card).map(parseExpr);
      expect([lo({}), hi({})], `${where}: limits`).toEqual([0, 1]);
      const F = (x: number, y: number): Vec2 => [p * x * x * y, x - k * y];
      for (const t of [0.15, 0.4, 0.75, 0.95]) {
        const [x, y] = [t, t * t], [vx, vy] = [1, 2 * t];
        expect(integrand({ t }), `${where}: integrand at t=${t}`).toBeCloseTo(F(x, y)[0] * vx + F(x, y)[1] * vy, 9);
      }
      for (const token of card.slots!.tokens) if (/t/.test(token) && token !== card.slots!.answers[2]) {
        const f = parseExpr(token);
        expect([0.15, 0.4, 0.75].some(t => Math.abs(f({ t }) - integrand({ t })) > 1e-9), `${where}: token ${token} is equivalent to the integrand`).toBe(true);
      }
    });
  });
  it('path-dependence: the quoted values are right and only "depends on the path" survives the checks', () => {
    eachCard(id, 'path-dependence', (card, where, deck) => {
      const parabola = deck.find(c => c.id === `${id}-parabola-value`)!.audit!.params as P;
      const F = lin((x, y) => parabola.p * x * x * y, (x, y) => x - parabola.k * y);
      const viaParabola = lineInt(F, t => [t, t * t], 0, 1), viaLine = lineInt(F, t => [t, t], 0, 1);
      const reparametrised = lineInt(F, u => [u * u, u ** 4], 0, 1); // the same parabola, run at a different speed
      expect(near(reparametrised, viaParabola), `${where}: the integral should not depend on the parametrization`).toBe(true);
      const quoted = clean(card.prompt).match(/gives (-?[\d.]+) and the straight segment gives (-?[\d.]+)\./);
      expect(quoted, `${where}: quoted values`).not.toBeNull();
      expect(Math.abs(+quoted![1] - viaParabola), `${where}: quoted parabola value`).toBeLessThan(5e-7);
      expect(Math.abs(+quoted![2] - viaLine), `${where}: quoted segment value`).toBeLessThan(5e-7);
      expectOneCorrect(card, text => {
        if (/^A line integral can depend on the path/.test(text)) return !near(viaParabola, viaLine);
        if (/^A line integral depends only on its endpoints/.test(text)) return near(viaParabola, viaLine);
        if (/^One of the two computations must contain an arithmetic mistake/.test(text)) return Math.abs(+quoted![1] - viaParabola) > 5e-7 || Math.abs(+quoted![2] - viaLine) > 5e-7;
        if (/^The value changes with the parametrization/.test(text)) return !near(reparametrised, viaParabola);
        throw new Error(`${where}: unrecognised option "${text}"`);
      }, where);
    });
  });
  it('radial-arc: line integral on the quarter circle', () => {
    eachCard(id, 'radial-arc', (card, where) => {
      const m = grab(/F = \((.+?), (.+?)\)\. C is the quarter circle of radius (\d+) centered at the origin, from \(\d+, 0\) to \(0, \d+\), counterclockwise/, card.prompt, where);
      const a = +m[3];
      const F = lin(xy(m[1]), xy(m[2]));
      const value = lineInt(F, t => [a * Math.cos(t), a * Math.sin(t)], 0, PI / 2);
      expectOneCorrect(card, text => { const v = parseGameNumber(text); expect(v, `${where}: option "${text}" is not a number`).not.toBeNull(); return near(v!, value, 1e-8); }, where);
      // the arrows of the figure are the field F on the arc
      const arrows = shapesOf(card.figure, 'arrow');
      expect(arrows.length, where).toBeGreaterThanOrEqual(3);
      for (const ar of arrows) {
        const [fx, fy] = F(ar.from[0], ar.from[1]), dx = ar.to[0] - ar.from[0], dy = ar.to[1] - ar.from[1];
        expect(Math.abs(Math.hypot(ar.from[0], ar.from[1]) - a), `${where}: arrow base off the arc`).toBeLessThan(1e-9);
        expect((fx * dx + fy * dy) / (Math.hypot(fx, fy) * Math.hypot(dx, dy)), `${where}: arrow does not follow F`).toBeGreaterThan(1 - 1e-9);
      }
      for (const line of shapesOf(card.figure, 'line')) for (const pt of line.points) expect(Math.abs(Math.hypot(pt[0], pt[1]) - a), `${where}: arc`).toBeLessThan(1e-9);
    });
  });
  it('figures follow the printed curves', () => {
    eachCard(id, 'axis-work', (card, where) => {
      const a = +grab(/to \((\d+), 0\)/, card.prompt, where)[1];
      expectCurves(card.figure, [[[0, 0], [a, 0]]], where);
      expectPoints(card.figure, [[0, 0], [a, 0]], where);
      const v = card.figure!.view;
      expect((v.ymax - v.ymin) / (v.xmax - v.xmin), `${where}: the view is a sliver, ${JSON.stringify(v)}`).toBeGreaterThan(0.05);
    });
    for (const slug of ['parabola-setup', 'parabola-value']) eachCard(id, slug, (card, where) => {
      const curve = Array.from({ length: 65 }, (_, i) => [i / 64, (i / 64) ** 2] as const);
      expectCurves(card.figure, [curve], where, 1e-3);
      expectPoints(card.figure, [[0, 0], [1, 1]], where);
    });
    eachCard(id, 'line-value', (card, where) => {
      const curve = Array.from({ length: 65 }, (_, i) => [i / 64, (i / 64) ** 2] as const);
      expectCurves(card.figure, [curve, [[0, 0], [1, 1]]], where, 1e-3);
      const solid = shapesOf(card.figure, 'line').filter(l => !l.dash);
      expect(solid.length, `${where}: the segment is the solid line`).toBe(1);
      expect(solid[0].points, where).toEqual([[0, 0], [1, 1]]);
    });
    for (const [slug, sign] of [['circle-ccw', 1], ['circle-cw', -1]] as const) eachCard(id, slug, (card, where) => {
      const a = +grab(/x² \+ y² = (\d+)²/, card.prompt, where)[1];
      for (const line of shapesOf(card.figure, 'line')) for (const pt of line.points) expect(Math.abs(Math.hypot(pt[0], pt[1]) - a), where).toBeLessThan(1e-9);
      const arrows = shapesOf(card.figure, 'arrow');
      expect(arrows.length, where).toBe(1);
      const ar = arrows[0], cross = ar.from[0] * (ar.to[1] - ar.from[1]) - ar.from[1] * (ar.to[0] - ar.from[0]);
      expect(Math.sign(cross), `${where}: arrow direction`).toBe(sign);
      expect(Math.abs(Math.hypot(ar.from[0], ar.from[1]) - a), `${where}: arrow base`).toBeLessThan(1e-9);
    });
    eachCard(id, 'challenge', (card, where) => {
      const m = grab(/from \(0, (\d+)\) to \((\d+), \d+\), then/, card.prompt, where);
      const b = +m[1], a = +m[2];
      expectCurves(card.figure, [[[0, b], [a, b]], [[a, b], [a, 0]]], where);
      expectPoints(card.figure, [[0, b], [a, b], [a, 0]], where);
      const dirs = shapesOf(card.figure, 'arrow').map(ar => [Math.sign(ar.to[0] - ar.from[0]), Math.sign(ar.to[1] - ar.from[1])]);
      expect(dirs, `${where}: arrows point along the direction of travel`).toEqual([[1, 0], [0, -1]]);
    });
  });
});

// ================================================================================================================== MIT-MV-40
describe('MIT-MV-40 the fundamental theorem for line integrals', () => {
  const id = 'MIT-MV-40';
  const Q = (card: PracticeCard) => clean(card.prompt);
  const lin = (M: (x: number, y: number) => number, N: (x: number, y: number) => number): Field => (x, y) => [M(x, y), N(x, y)];
  /** a x y + b x² read from a printed expression. */
  const quadratic = (src: string, w: string) => {
    const f = xy(src);
    const b = f(1, 0), a = f(1, 1) - b;
    expect(f(2, 3), `${w}: "${src}" is not a x y + b x²`).toBeCloseTo(6 * a + 4 * b, 12);
    expect(f(0, 3), `${w}: "${src}" has a pure y term`).toBeCloseTo(0, 12);
    return { a, b, f };
  };
  const spin = (c: PracticeCard, w: string) => {
    const m = grab(/F = \((.+?), (.+?)\)\. C/, Q(c), w);
    const M = xy(m[1]), N = xy(m[2]);
    expect(M(2, 3), `${w}: not (-p y, p x)`).toBeCloseTo(-3 * N(1, 0), 12);
    expect(N(2, 3), `${w}: not (-p y, p x)`).toBeCloseTo(2 * N(1, 0), 12);
    return N(1, 0);
  };
  auditSuite(id, [
    {
      slug: 'potential-difference',
      printed: (c, w) => {
        const m = grab(/f\(x, y\) = (.+?)\. C is any curve from \((\d+), (\d+)\) to \((\d+), (\d+)\)/, Q(c), w);
        const { a, b } = quadratic(m[1], w);
        return { a, b, x0: +m[2], y0: +m[3], x1: +m[4], y1: +m[5] };
      },
      // F is the numerical gradient of f; the curve is bent on purpose (y follows a parabola in the parameter)
      truth: p => [lineInt(gradient((x, y) => p.a * x * y + p.b * x * x), s => [p.x0 + (p.x1 - p.x0) * s, p.y0 + (p.y1 - p.y0) * s * s], 0, 1)],
      closed: p => [p.a * (p.x1 * p.y1 - p.x0 * p.y0) + p.b * (p.x1 ** 2 - p.x0 ** 2)],
    },
    {
      slug: 'seg-via-xaxis',
      printed: (c, w) => { const p = spin(c, w); const m = grab(/to \((\d+), 0\), then straight up to \((\d+), (\d+)\)/, Q(c), w); expect(m[1], w).toBe(m[2]); return { a: +m[1], b: +m[3], p }; },
      truth: p => [polyInt(lin((_x, y) => -p.p * y, x => p.p * x), [[0, 0], [p.a, 0], [p.a, p.b]])],
      closed: p => [p.p * p.a * p.b],
    },
    {
      slug: 'diag-field',
      printed: (c, w) => {
        const m = grab(/F = \((.+?), (.+?)\)\. C is the straight segment from \(0, 0\) to \((\d+), (\d+)\), parametrized by x = (\d*)t, y = (\d*)t/, Q(c), w);
        expect(xy(m[1])(2, 3), `${w}: first component should be 0`).toBe(0);
        expect([coefOf(m[5]), coefOf(m[6])], `${w}: parametrization differs from the endpoint`).toEqual([+m[3], +m[4]]);
        return { a: +m[3], b: +m[4], p: xy(m[2])(1, 0) };
      },
      truth: p => [lineInt(lin(() => 0, x => p.p * x), t => [p.a * t, p.b * t], 0, 1)],
      closed: p => [p.p * p.a * p.b / 2],
    },
    {
      slug: 'challenge',
      printed: (c, w) => {
        const m = grab(/F = \((.+?), (.+?)\)\. C is the boundary of the rectangle 0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+), traversed once counterclockwise starting at \(0, 0\)/, Q(c), w);
        const M = xy(m[1]), N = xy(m[2]), p = N(1, 0);
        expect(M(2, 3), `${w}: first component is not 2x - p y`).toBeCloseTo(4 - 3 * p, 12);
        expect(N(2, 3), `${w}: second component is not p x + 2y`).toBeCloseTo(2 * p + 6, 12);
        return { a: +m[3], b: +m[4], p };
      },
      truth: p => [polyInt(lin((x, y) => 2 * x - p.p * y, (x, y) => p.p * x + 2 * y), [[0, 0], [p.a, 0], [p.a, p.b], [0, p.b], [0, 0]])],
      closed: p => [2 * p.p * p.a * p.b],
    },
  ]);

  it('gradient-field: the two answers are the partial derivatives of the printed f', () => {
    eachCard(id, 'gradient-field', (card, where) => {
      expectSlotLayout(card, where);
      const f = xy(grab(/f\(x, y\) = (.+?)\. Fill in/, card.prompt, where)[1]);
      const [fx, fy] = blanks(card).map(xy);
      const G = gradient(f);
      for (const [x, y] of [[0.7, 1.3], [1.9, -0.8], [-1.2, 0.6]] as Pt[]) {
        expect(fx(x, y), `${where}: f_x at (${x}, ${y})`).toBeCloseTo(G(x, y)[0], 5);
        expect(fy(x, y), `${where}: f_y at (${x}, ${y})`).toBeCloseTo(G(x, y)[1], 5);
      }
      for (const token of card.slots!.tokens) if (!blanks(card).includes(token)) {
        const g = xy(token);
        expect([[0.7, 1.3], [1.9, 0.8]].some(([x, y]) => Math.abs(g(x, y) - fx(x, y)) > 1e-6 && Math.abs(g(x, y) - fy(x, y)) > 1e-6), `${where}: token ${token} equals a correct component`).toBe(true);
      }
    });
  });

  /** Integral of ∇f over the three paths of the path-independence card. */
  it('path-independence: the three paths give the same value', () => {
    eachCard(id, 'path-independence', (card, where) => {
      const m = grab(/f\(x, y\) = (.+?)\. Path 1 goes from \((\d+), (\d+)\) horizontally to \((\d+), (\d+)\) and then vertically to \((\d+), (\d+)\); path 2 goes vertically to \((\d+), (\d+)\) and then horizontally to \((\d+), (\d+)\); path 3/, card.prompt, where);
      const { f } = quadratic(m[1], where);
      const P0: Pt = [+m[2], +m[3]], P1: Pt = [+m[6], +m[7]];
      expect([+m[4], +m[5]], `${where}: path 1 corner`).toEqual([P1[0], P0[1]]);
      expect([+m[8], +m[9]], `${where}: path 2 corner`).toEqual([P0[0], P1[1]]);
      const F = gradient(f);
      const I1 = polyInt(F, [P0, [P1[0], P0[1]], P1]), I2 = polyInt(F, [P0, [P0[0], P1[1]], P1]), I3 = polyInt(F, [P0, P1]);
      expectOneCorrect(card, text => {
        let r = text.match(/^All three integrals are equal, each is (.+)\.$/);
        if (r) return near(I1, I2) && near(I2, I3) && near(parseGameNumber(r[1])!, I1);
        if (/^The straight segment gives the smallest value/.test(text)) return I3 < I1 - 1e-9 && I3 < I2 - 1e-9;
        if (/^The two paths with a corner give different values/.test(text)) return !near(I1, I2);
        r = text.match(/^Only the straight segment gives (.+); the paths with a corner give other values\.$/);
        if (r) return near(parseGameNumber(r[1])!, I3) && !near(I1, I3) && !near(I2, I3);
        throw new Error(`${where}: unrecognised option "${text}"`);
      }, where);
      // the figure draws the three paths of the text
      const lines = shapesOf(card.figure, 'line').map(l => l.points);
      const sameLine = (a: readonly Pt[], b: readonly Pt[]) => a.length === b.length && a.every((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 1e-9);
      for (const expected of [[P0, [P1[0], P0[1]], P1], [P0, [P0[0], P1[1]], P1], [P0, P1]] as Pt[][]) expect(lines.some(l => sameLine(l, expected)), `${where}: path ${JSON.stringify(expected)} not drawn`).toBe(true);
    });
  });
  it('closed-loop: a gradient field has zero circulation on any loop', () => {
    eachCard(id, 'closed-loop', (card, where) => {
      const m = grab(/f\(x, y\) = (.+?)\. C is a closed curve that starts and ends at \((\d+), (\d+)\)/, card.prompt, where);
      const { f } = quadratic(m[1], where);
      const x0 = +m[2], y0 = +m[3], F = gradient(f), rho = 1.3;
      const circle = lineInt(F, t => [x0 + rho * (1 - Math.cos(t)), y0 + rho * Math.sin(t)], 0, 2 * PI);
      const triangle = polyInt(F, [[x0, y0], [x0 + 1, y0], [x0, y0 + 2], [x0, y0]]);
      const loops = [{ I: circle, area: PI * rho * rho }, { I: triangle, area: 1 }];
      expectOneCorrect(card, text => {
        if (/^0, whatever the shape of C\.$/.test(text)) return loops.every(l => Math.abs(l.I) < 1e-8);
        const r = text.match(/^f\((\d+), (\d+)\) = (-?[\d.]+), the value of the potential at the starting point\.$/);
        if (r) { expect([+r[1], +r[2]], where).toEqual([x0, y0]); expect(+r[3], `${where}: printed f(P)`).toBeCloseTo(f(x0, y0), 6); return loops.every(l => Math.abs(l.I - f(x0, y0)) < 1e-8); }
        if (/^It depends on the shape of C\.$/.test(text)) return Math.abs(circle - triangle) > 1e-8;
        if (/^The area enclosed by C\.$/.test(text)) return loops.every(l => Math.abs(l.I - l.area) < 1e-8);
        throw new Error(`${where}: unrecognised option "${text}"`);
      }, where);
    });
  });
  it('spot-nonconservative: exactly the rotation field has circulation', () => {
    eachCard(id, 'spot-nonconservative', (card, where) => {
      const m = grab(/Two fields: (\w) = \((.+?), (.+?)\) and (\w) = \((.+?), (.+?)\)\./, card.prompt, where);
      const fields: Record<string, Field> = { [m[1]]: lin(xy(m[2]), xy(m[3])), [m[4]]: lin(xy(m[5]), xy(m[6])) };
      expect(Object.keys(fields).length, `${where}: the two fields need different names`).toBe(2);
      const circulation = (F: Field) => lineInt(F, t => [Math.cos(t), Math.sin(t)], 0, 2 * PI);
      const nonconservative = Object.keys(fields).filter(k => Math.abs(circulation(fields[k])) > 1e-8);
      expect(nonconservative.length, `${where}: exactly one of the fields should fail`).toBe(1);
      const viaX = (F: Field) => polyInt(F, [[0, 0], [1, 0], [1, 1]]), viaY = (F: Field) => polyInt(F, [[0, 0], [0, 1], [1, 1]]);
      expectOneCorrect(card, text => {
        let r = text.match(/^Only (\w) is not conservative: from \(0, 0\) to \(1, 1\) it gives (-?\d+) along the path through \(1, 0\) but (-?\d+) along the path through \(0, 1\)\.$/);
        if (r) { const F = fields[r[1]]; expect(F, `${where}: unknown name ${r[1]}`).toBeDefined(); return nonconservative.length === 1 && nonconservative[0] === r[1] && near(viaX(F), +r[2]) && near(viaY(F), +r[3]); }
        r = text.match(/^Only (\w) is not conservative, because /);
        if (r) return nonconservative.length === 1 && nonconservative[0] === r[1];
        if (/^Both are conservative/.test(text)) return nonconservative.length === 0;
        if (/^Neither is conservative/.test(text)) return nonconservative.length === 2;
        throw new Error(`${where}: unrecognised option "${text}"`);
      }, where);
    });
  });
  it('figures follow the printed paths', () => {
    eachCard(id, 'seg-via-xaxis', (card, where) => {
      const m = grab(/to \((\d+), 0\), then straight up to \(\d+, (\d+)\)/, card.prompt, where);
      expectCurves(card.figure, [[[0, 0], [+m[1], 0]], [[+m[1], 0], [+m[1], +m[2]]]], where);
    });
    eachCard(id, 'diag-field', (card, where) => {
      const m = grab(/to \((\d+), (\d+)\), parametrized/, card.prompt, where);
      expectCurves(card.figure, [[[0, 0], [+m[1], +m[2]]]], where);
    });
    eachCard(id, 'challenge', (card, where) => {
      const m = grab(/0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+)/, card.prompt, where);
      const a = +m[1], b = +m[2];
      expectCurves(card.figure, [[[0, 0], [a, 0], [a, b], [0, b], [0, 0]]], where);
      const sides = shapesOf(card.figure, 'line').flatMap(l => l.points.slice(1).map((q, i) => [l.points[i], q] as const));
      for (const [p, q] of [[[0, 0], [a, 0]], [[a, 0], [a, b]], [[a, b], [0, b]], [[0, b], [0, 0]]] as [Pt, Pt][]) {
        const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        expect(Math.min(...sides.map(([s, e]) => distToSegment(mid, s, e))), `${where}: side ${JSON.stringify(p)}→${JSON.stringify(q)} of the rectangle is not drawn`).toBeLessThan(1e-9);
      }
      const dirs = shapesOf(card.figure, 'arrow').map(ar => [Math.sign(ar.to[0] - ar.from[0]), Math.sign(ar.to[1] - ar.from[1])]);
      expect(dirs, `${where}: counterclockwise arrows`).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1]]);
    });
  });
});

// ================================================================================================================== all five games
describe('English and Chinese decks are parallel in every answer', () => {
  for (const id of Object.keys(batch08Generators)) {
    it(`${id}: same ids, answers, audit params and correct option index in EN and ZH`, () => {
      for (let i = 0; i < 20; i++) {
        const en = gen(id)(spreadSeed(i), 'en'), zh = gen(id)(spreadSeed(i), 'zh');
        expect(zh.map(c => c.id), `${id} seed #${i}`).toEqual(en.map(c => c.id));
        en.forEach((card, k) => {
          expect(zh[k].fields?.map(f => f.answer), `${card.id} seed #${i}: field answers`).toEqual(card.fields?.map(f => f.answer));
          expect(zh[k].audit, `${card.id} seed #${i}: audit`).toEqual(card.audit);
          expect(zh[k].choice?.answer, `${card.id} seed #${i}: correct option index`).toBe(card.choice?.answer);
          expect(zh[k].slots?.answers, `${card.id} seed #${i}: slot answers`).toEqual(card.slots?.answers);
        });
      }
    });
  }
});
