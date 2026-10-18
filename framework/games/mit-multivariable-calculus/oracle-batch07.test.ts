import { describe, expect, it } from 'vitest';
import { centralDiff, close, runOracle, simpson, type Oracle } from './oracle-harness';
import { spreadSeed } from './deck-invariants';
import { batch07Generators } from './batch07';
import { gradeCard, type CardGenerator, type PracticeCard } from '../types';
import type { Figure } from '../figure';

/**
 * Independent oracles for MIT-MV-31 (Exam 2), 32 (definition of double integrals), 33 (examples), 34 (exchanging the order) and
 * 35 (polar coordinates). Written from audit-notes/batch07.md and the PRINTED question text only; the generator formulas were not
 * consulted. Numerics: Richardson finite differences, Newton and bisection, grid scans, nested Simpson quadrature, Cartesian
 * midpoint grids with irrational offsets. Region-and-limits cards are checked by EVALUATING the answer tokens as limits: the
 * tokens are parsed by a small expression parser, then (a) points sampled inside the limits must lie in the region described by
 * the question text, (b) grid points of that region must lie inside the limits, (c) the integral of 1 and of a test function over
 * the limits must match the region's area and test integral computed another way. Figures are compared with the region by a
 * point-in-polygon grid test. Seeds are spread (tiny seeds give near-constant LCG draws).
 */

// ------------------------------------------------------------------------------------------------------------------ helpers
const SEEDS = 60;
const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(spreadSeed(seed), lang);
type P = Record<string, number>;
type Env = Record<string, number>;
type Fn = (e: Env) => number;
type Region = (x: number, y: number) => boolean;
type Box = [number, number, number, number];
type Pt = readonly [number, number];
/** U+2212 minus to ASCII and no-break spaces to blanks. */
const clean = (s: string) => s.replace(/−/g, '-').replace(/ /g, ' ');
const PI = Math.PI;

/** Tiny recursive-descent parser for the expressions printed in questions and answer tokens: + - * / ^ ² ³ ⁴, implicit multiplication, √, π, sec/cos/sin, variables. */
function parseExpr(src: string): Fn {
  const text = clean(src).replace(/·/g, '*').replace(/Δθ/g, 'E').replace(/Δr/g, 'D');
  const toks: string[] = [];
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = text.slice(i).match(/^\d+(?:\.\d+)?/);
    if (num) { toks.push(num[0]); i += num[0].length; continue; }
    const fn = text.slice(i).match(/^(sec|cos|sin)/);
    if (fn) { toks.push(fn[0]); i += 3; continue; }
    if ('+-*/()²³⁴^√'.includes(c) || /[A-Za-zθπ]/.test(c)) { toks.push(c); i++; continue; }
    throw new Error(`parseExpr: unexpected "${c}" in "${src}"`);
  }
  let pos = 0;
  const peek = () => toks[pos];
  const startsAtom = (t?: string) => t !== undefined && (/^\d/.test(t) || /^(sec|cos|sin)$/.test(t) || /^[A-Za-zθπ]$/.test(t) || t === '(' || t === '√');
  const atom = (): Fn => {
    const t = toks[pos++];
    if (t === undefined) throw new Error(`parseExpr: unexpected end of "${src}"`);
    if (/^\d/.test(t)) { const v = Number(t); return () => v; }
    if (t === 'π') return () => PI;
    if (t === 'sec' || t === 'cos' || t === 'sin') {
      const arg = atom();
      return t === 'sec' ? e => 1 / Math.cos(arg(e)) : t === 'cos' ? e => Math.cos(arg(e)) : e => Math.sin(arg(e));
    }
    if (t === '√') { const arg = atom(); return e => Math.sqrt(arg(e)); }
    if (t === '(') { const v = sum(); if (toks[pos++] !== ')') throw new Error(`parseExpr: missing ) in "${src}"`); return v; }
    if (/^[A-Za-zθ]$/.test(t)) return e => { if (!(t in e)) throw new Error(`variable ${t} unbound in "${src}"`); return e[t]; };
    throw new Error(`parseExpr: unexpected token "${t}" in "${src}"`);
  };
  const power = (): Fn => {
    let base = atom();
    for (;;) {
      const t = peek();
      const k = t === '²' ? 2 : t === '³' ? 3 : t === '⁴' ? 4 : t === '^' ? -1 : 0;
      if (!k) return base;
      pos++;
      let exp = k;
      if (k === -1) { exp = Number(toks[pos++]); }
      const b = base;
      base = e => b(e) ** exp;
    }
  };
  const unary = (): Fn => {
    if (peek() === '-') { pos++; const u = unary(); return e => -u(e); }
    return power();
  };
  const product = (): Fn => {
    let left = unary();
    for (;;) {
      const t = peek();
      const l = left;
      if (t === '*' || t === '/') { pos++; const r = unary(); left = t === '*' ? e => l(e) * r(e) : e => l(e) / r(e); }
      else if (startsAtom(t)) { const r = unary(); left = e => l(e) * r(e); }
      else return left;
    }
  };
  const sum = (): Fn => {
    let left = product();
    while (peek() === '+' || peek() === '-') {
      const op = toks[pos++]; const r = product(); const l = left;
      left = op === '+' ? e => l(e) + r(e) : e => l(e) - r(e);
    }
    return left;
  };
  const result = sum();
  if (pos !== toks.length) throw new Error(`parseExpr: trailing "${toks.slice(pos).join(' ')}" in "${src}"`);
  return result;
}
const ev = (src: string, env: Env = {}) => parseExpr(src)(env);
/** Both sides of an equation printed in the question as one function: lhs - rhs. */
const sides = (lhs: string, rhs: string): Fn => { const l = parseExpr(lhs), r = parseExpr(rhs); return e => l(e) - r(e); };
const PTS3: [number, number, number][] = [[0.3, -1.1, 0.7], [1.9, 0.4, -2.2], [-1.3, 2.1, 1.6], [2.7, -0.8, -0.5], [-2.4, -1.7, 2.9], [0.9, 1.3, 1.1], [1.7, 2.2, 0.4]];
const samePoly = (f: Fn, g: (x: number, y: number, z: number) => number) => PTS3.every(([x, y, z]) => close(f({ x, y, z }), g(x, y, z), 1e-9));
function expectPoly(label: string, printed: string, g: (x: number, y: number, z: number) => number, where: string) {
  expect(samePoly(parseExpr(printed), g), `${where}: printed ${label} "${printed}" differs from the audit params`).toBe(true);
}
const match = (re: RegExp, text: string, where: string): RegExpMatchArray => {
  const r = clean(text).match(re);
  expect(r, `${where}: text does not match ${re}\n${text}`).not.toBeNull();
  return r!;
};
const num = (s: string | undefined, implicit = 1) => (s === undefined || s === '' ? implicit : Number(s));

/** Richardson-extrapolated first derivative of the harness central difference (exact up to degree 4). */
const d1 = (f: (x: number) => number, x: number, h = 0.05) => (4 * centralDiff(f, x, h) - centralDiff(f, x, 2 * h)) / 3;
const fx = (f: (x: number, y: number) => number, x: number, y: number, h = 0.05) => d1(s => f(s, y), x, h);
const fy = (f: (x: number, y: number) => number, x: number, y: number, h = 0.05) => d1(t => f(x, t), y, h);
/** Bisection on a sign change of g over [lo, hi]. */
function bisect(g: (x: number) => number, lo: number, hi: number, iterations = 100) {
  const glo = g(lo), ghi = g(hi);
  expect(glo * ghi, 'bisection bracket has no sign change').toBeLessThanOrEqual(0);
  for (let i = 0; i < iterations; i++) { const mid = (lo + hi) / 2; (g(mid) * glo > 0) ? (lo = mid) : (hi = mid); }
  return (lo + hi) / 2;
}
/** Newton's method on finite-difference gradient and Hessian of a function of two variables; verifies the residual. */
function newton2(f: (x: number, y: number) => number, x = 0.5, y = -0.5): [number, number] {
  for (let it = 0; it < 10; it++) {
    const gx = fx(f, x, y), gy = fy(f, x, y);
    const hxx = d1(s => fx(f, s, y), x), hyy = d1(t => fy(f, x, t), y), hxy = d1(s => fy(f, s, y), x);
    const det = hxx * hyy - hxy * hxy;
    expect(Math.abs(det), 'Hessian singular in oracle').toBeGreaterThan(1e-6);
    x -= (hyy * gx - hxy * gy) / det;
    y -= (hxx * gy - hxy * gx) / det;
  }
  expect(Math.hypot(fx(f, x, y), fy(f, x, y)), 'Newton residual').toBeLessThan(1e-7);
  return [x, y];
}
/** Iterated integral: outer x in [xlo, xhi], inner y in [ylo(x), yhi(x)], nested composite Simpson. */
const iter2 = (f: (x: number, y: number) => number, xlo: number, xhi: number, ylo: (x: number) => number, yhi: (x: number) => number, nx = 200, ny = 200) =>
  simpson(x => simpson(y => f(x, y), ylo(x), yhi(x), ny), xlo, xhi, nx);
/** Midpoint rule on an irrational-offset grid over `box`, summing g where `inside`. */
function gridIntegral(g: (x: number, y: number) => number, inside: Region, box: Box, N = 500): number {
  const dx = (box[1] - box[0]) / N, dy = (box[3] - box[2]) / N;
  let sum = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = box[0] + (i + 0.4137) * dx, y = box[2] + (j + 0.5821) * dy;
    if (inside(x, y)) sum += g(x, y);
  }
  return sum * dx * dy;
}
/** Areas where two regions disagree, and the area of the first. */
function symDiff(a: Region, b: Region, box: Box, N = 300) {
  const dx = (box[1] - box[0]) / N, dy = (box[3] - box[2]) / N;
  let diff = 0, area = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = box[0] + (i + 0.4137) * dx, y = box[2] + (j + 0.5821) * dy;
    const A = a(x, y), B = b(x, y);
    if (A !== B) diff++;
    if (A) area++;
  }
  return { diff: diff * dx * dy, area: area * dx * dy };
}
/** Even-odd ray casting. */
function inPoly(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const shoelace = (poly: readonly Pt[]) => Math.abs(poly.reduce((s, [x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
const bbox = (poly: readonly Pt[]): Box => [Math.min(...poly.map(p => p[0])), Math.max(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[1]))];
const unionBox = (a: Box, b: Box): Box => { const w = Math.max(a[1], b[1]) - Math.min(a[0], b[0]), h = Math.max(a[3], b[3]) - Math.min(a[2], b[2]); return [Math.min(a[0], b[0]) - 0.05 * w, Math.max(a[1], b[1]) + 0.05 * w, Math.min(a[2], b[2]) - 0.05 * h, Math.max(a[3], b[3]) + 0.05 * h]; };
/** The single filled polygon of a figure. */
function figurePolygon(figure: Figure | undefined, where: string): Pt[] {
  expect(figure, `${where}: figure missing`).toBeDefined();
  const areas = figure!.shapes.filter(s => s.kind === 'area');
  expect(areas.length, `${where}: expected exactly one filled region in the figure`).toBe(1);
  return (areas[0] as { points: Pt[] }).points;
}
/** The figure's filled polygon describes the region `truth` (symmetric difference below `tol` of its area). */
function expectFigureIs(figure: Figure | undefined, truth: Region, truthBox: Box, tol: number, where: string) {
  const poly = figurePolygon(figure, where);
  const { diff, area } = symDiff(truth, p => false, truthBox);
  void diff;
  const box = unionBox(truthBox, bbox(poly));
  const cmp = symDiff(truth, (x, y) => inPoly(poly, x, y), box);
  expect(area, `${where}: region has no area`).toBeGreaterThan(0);
  expect(cmp.diff / area, `${where}: figure differs from the described region (disagreement ${cmp.diff.toFixed(4)} of area ${area.toFixed(4)})`).toBeLessThan(tol);
}

/** "inner ≤ y ≤ …,  outer ≤ x ≤ …" into two limit pairs, inner first. */
type Limit = { v: string; lo: Fn; hi: Fn };
function parseLimits(line: string): Limit[] {
  return clean(line).split(/,\s*/).map(part => {
    const m = part.trim().match(/^(.+?)\s*≤\s*([xyzrθ])\s*≤\s*(.+)$/);
    if (!m) throw new Error(`cannot read limits "${part}" of "${line}"`);
    return { v: m[2], lo: parseExpr(m[1]), hi: parseExpr(m[3]) };
  });
}
/** The iterated limits (inner, outer) as a region of the plane when (inner, outer) are Cartesian. */
function cartesianRegion([inner, outer]: Limit[]): { region: Region; outerRange: [number, number] } {
  const olo = outer.lo({}), ohi = outer.hi({});
  const region: Region = (x, y) => {
    const t = outer.v === 'x' ? x : y, s = outer.v === 'x' ? y : x;
    if (t < olo || t > ohi) return false;
    const env: Env = { [outer.v]: t };
    return s >= inner.lo(env) && s <= inner.hi(env);
  };
  return { region, outerRange: [olo, ohi] };
}
/** Area and ∫ g of an iterated Cartesian integral, by nested Simpson. */
function iteratedCartesian([inner, outer]: Limit[], g: (x: number, y: number) => number, n = 2000, m = 300) {
  const [olo, ohi] = [outer.lo({}), outer.hi({})];
  const at = (t: number, s: number) => (outer.v === 'x' ? g(t, s) : g(s, t));
  const area = simpson(t => inner.hi({ [outer.v]: t }) - inner.lo({ [outer.v]: t }), olo, ohi, n);
  const integral = simpson(t => simpson(s => at(t, s), inner.lo({ [outer.v]: t }), inner.hi({ [outer.v]: t }), m), olo, ohi, n);
  return { area, integral };
}
const G = (x: number, y: number) => 1 + 0.5 * x + 0.3 * y * y;

/** Every audited card (English) of every spread seed of game `id`. */
function eachAudited(id: string, fn: (card: PracticeCard, where: string) => void) {
  const seen = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch07Generators[id](seed, 'en')) if (card.audit) { fn(card, `${card.id} seed #${i} params ${JSON.stringify(card.audit.params)}`); seen.add(card.audit.kind); }
  }
  return seen;
}
function eachCardById(id: string, cardId: string, fn: (card: PracticeCard, where: string) => void) {
  let count = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch07Generators[id](seed, 'en')) if (card.id === `${id}-${cardId}`) { fn(card, `${card.id} seed #${i}`); count++; }
  }
  expect(count, `${cardId}: expected one card per seed`).toBe(SEEDS);
}
const expectKinds = (counts: Record<string, number>, id: string, kinds: string[]) => {
  expect(Object.keys(counts).sort()).toEqual(kinds.map(k => `${id}:${k}`).sort());
  for (const k of kinds) expect(counts[`${id}:${k}`], `${k} count`).toBe(SEEDS);
};
/** Option text of a choice card, checked to contain exactly one correct option by `verdict`; returns nothing. */
function expectOneCorrect(card: PracticeCard, verdict: (text: string, index: number) => boolean, where: string) {
  const verdicts = card.choice!.options.map(verdict);
  expect(verdicts.filter(Boolean).length, `${where}: exactly one option must be correct per the oracle: ${card.choice!.options.join(' | ')}`).toBe(1);
  expect(verdicts[card.choice!.answer], `${where}: card marks "${card.choice!.options[card.choice!.answer]}" but the oracle disagrees`).toBe(true);
}
/** Grading behaviour of numeric cards: the printed exact value is accepted; a perturbed one is rejected; tolerance as contracted. */
function expectGrading(card: PracticeCard, where: string, tolerances: Record<string, number | undefined>) {
  if (!card.fields) return;
  const answers = card.fields!.map(f => f.answer);
  expect(gradeCard(card, answers.map(String), null, []), `${where}: own answer rejected`).toBe('correct');
  card.fields!.forEach((f, i) => {
    expect(f.tolerance, `${where}: tolerance of field ${i}`).toBe(tolerances[card.audit!.kind]);
    const tol = f.tolerance ?? 1e-8;
    const high = answers.map(String), low = answers.map(String);
    high[i] = String(f.answer + (tol > 1e-6 ? 10 * tol : 1e-6));
    low[i] = String(f.answer - (tol > 1e-6 ? 10 * tol : 1e-6));
    expect(gradeCard(card, high, null, []), `${where}: value above the answer by 10 tolerances accepted`).toBe('incorrect');
    expect(gradeCard(card, low, null, []), `${where}: value below the answer by 10 tolerances rejected wrongly`).toBe('incorrect');
    if (f.tolerance) {
      const near = answers.map(String);
      near[i] = String(f.answer + 0.8 * tol);
      expect(gradeCard(card, near, null, []), `${where}: value within tolerance rejected`).toBe('correct');
    }
  });
}

// ================================================================================================================== MIT-MV-31
describe('MIT-MV-31 Exam 2', () => {
  const id = 'MIT-MV-31';
  const F = (p: P) => (x: number, y: number) => p.a * x * x * y * y - p.b * x;
  const Q = (p: P) => (x: number, y: number) => p.a * x * x + p.b * x * y + p.c * y * y + p.d * x + p.e * y;
  /** Classify the critical point P of f by scanning rings around it. */
  const classify = (f: (x: number, y: number) => number, [px, py]: [number, number]): 'min' | 'max' | 'saddle' => {
    let pos = false, neg = false;
    for (const r of [0.25, 0.5, 1, 2, 3, 6]) for (let k = 0; k < 72; k++) {
      const t = (2 * PI * k) / 72;
      const diff = f(px + r * Math.cos(t), py + r * Math.sin(t)) - f(px, py);
      if (diff > 1e-7) pos = true;
      if (diff < -1e-7) neg = true;
    }
    expect(pos || neg, 'degenerate critical point in oracle scan').toBe(true);
    return pos && neg ? 'saddle' : pos ? 'min' : 'max';
  };
  /** Largest value of a concave function on the quadrant: coordinate ascent with exact 1D maximisation by bisection on the derivative. */
  function maxOnQuadrant(w: (x: number, y: number) => number): [number, number, number] {
    const argmax1 = (g: (t: number) => number) => (d1(g, 0) <= 0 ? 0 : bisect(t => d1(g, t), 0, 500));
    let x = 0.5, y = 0.5;
    for (let it = 0; it < 60; it++) { x = argmax1(t => w(t, y)); y = argmax1(t => w(x, t)); }
    // brute-force guard: no grid point of the quadrant beats the answer
    let best = -Infinity;
    for (let i = 0; i <= 160; i++) for (let j = 0; j <= 160; j++) best = Math.max(best, w(i * 0.05, j * 0.05));
    expect(best, 'a grid point beats the quadrant maximum').toBeLessThanOrEqual(w(x, y) + 1e-9);
    return [x, y, w(x, y)];
  }
  /** y(x) along the intersection curve of two surfaces by Newton on the (y, z) unknowns, FD Jacobian. */
  function solveYZ(p: P, x: number): [number, number] {
    const Fv = (y: number, z: number) => [p.p * x * x + p.q * y ** 3 + p.r * z ** 4 - (p.p + p.q + p.r), p.a * z ** 3 + p.b * x * z + p.c * x * y - (p.a + p.b + p.c)];
    let y = 1, z = 1;
    for (let it = 0; it < 60; it++) {
      const f = Fv(y, z), h = 1e-6;
      const a = Fv(y + h, z), b = Fv(y - h, z), c = Fv(y, z + h), d = Fv(y, z - h);
      const J = [[(a[0] - b[0]) / (2 * h), (c[0] - d[0]) / (2 * h)], [(a[1] - b[1]) / (2 * h), (c[1] - d[1]) / (2 * h)]];
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      expect(Math.abs(det), 'singular Jacobian: no implicit curve').toBeGreaterThan(1e-9);
      y -= (J[1][1] * f[0] - J[0][1] * f[1]) / det;
      z -= (-J[1][0] * f[0] + J[0][0] * f[1]) / det;
    }
    expect(Math.max(...Fv(y, z).map(Math.abs)), 'Newton residual on the curve').toBeLessThan(1e-12);
    return [y, z];
  }

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch07Generators[id]), {
      'MIT-MV-31:gradient': p => { const q = p as P, f = F(q); return [fx(f, q.x0, q.y0), fy(f, q.x0, q.y0)]; },
      'MIT-MV-31:tangent-plane': p => {
        const q = p as P, f = F(q);
        const plane = (x: number, y: number) => f(q.x0, q.y0) + fx(f, q.x0, q.y0) * (x - q.x0) + fy(f, q.x0, q.y0) * (y - q.y0);
        // the plane really is tangent: the gap to the graph shrinks quadratically
        for (const h of [1e-2, 1e-3]) expect(Math.abs(f(q.x0 + h, q.y0 - h) - plane(q.x0 + h, q.y0 - h)), 'plane is not tangent').toBeLessThan(200 * h * h);
        return [plane(0, 0)];
      },
      'MIT-MV-31:linear-approx': p => {
        const q = p as P, f = F(q);
        return [f(q.x0, q.y0) + fx(f, q.x0, q.y0) * q.dx + fy(f, q.x0, q.y0) * q.dy];
      },
      'MIT-MV-31:directional': p => {
        const q = p as P, f = F(q);
        expect(Math.hypot(q.v1, q.v2)).toBe(5);
        const u = [q.v1 / 5, q.v2 / 5];
        return [d1(t => f(q.x0 + t * u[0], q.y0 + t * u[1]), 0)];
      },
      'MIT-MV-31:critical': p => {
        const f = Q(p as P);
        const [x, y] = newton2(f);
        const [rx, ry] = [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];
        expect(Number.isInteger(rx) && Number.isInteger(ry) && Math.abs(rx) <= 3 && Math.abs(ry) <= 3, `critical point (${x}, ${y}) should be an integer point in [-3, 3]^2`).toBe(true);
        return [x, y];
      },
      'MIT-MV-31:classify': p => {
        const q = p as P;
        const f = Q({ ...q, d: 0, e: 0 });
        const kind = classify(f, [0, 0]);
        expect(Math.abs(4 * q.a * q.c - q.b * q.b), 'D = 0 must never occur here').toBeGreaterThan(0);
        return { optionIsCorrect: text => (kind === 'min' ? text === 'A local minimum' : kind === 'max' ? text === 'A local maximum' : text === 'A saddle point') };
      },
      'MIT-MV-31:boundary-max': p => {
        const q = p as P;
        expect(q.a > 0 && q.c > 0 && q.d > 0 && q.e > 0).toBe(true);
        const w = (x: number, y: number) => -q.a * x * x - q.c * y * y + q.d * x - q.e * y;
        return maxOnQuadrant(w);
      },
      'MIT-MV-31:chain-rule': p => {
        const q = p as P;
        const u0 = q.y0 / q.x0, v0 = q.x0 * q.x0 + q.y0 * q.y0;
        // a function with the given first partials at (u0, v0) and non-trivial higher-order terms
        const w = (u: number, v: number) => q.wu * (u - u0) + q.wv * (v - v0) + 5 * (u - u0) ** 2 - 3 * (u - u0) * (v - v0) + 2 * (v - v0) ** 3;
        const W = (x: number, y: number) => w(y / x, x * x + y * y);
        return [fx(W, q.x0, q.y0, 1e-3), fy(W, q.x0, q.y0, 1e-3)];
      },
      'MIT-MV-31:total-diff': p => {
        const q = p as P;
        const [y0, z0] = solveYZ(q, 1);
        expect(close(y0, 1) && close(z0, 1), 'curve must pass through (1, 1, 1)').toBe(true);
        // curved implicit curve: Romberg (two Richardson levels, O(h^6)) of the central differences of the Newton-located y(x)
        const h = 2e-4, curve = (x: number) => solveYZ(q, x)[0];
        return [(16 * d1(curve, 1, h) - d1(curve, 1, 2 * h)) / 15];
      },
      'MIT-MV-31:challenge': p => {
        const q = p as P;
        const f = (t: number) => q.p * q.R * Math.cos(t) + q.q * q.R * Math.sin(t);
        let best = 0, bv = -Infinity;
        const M = 20000;
        for (let k = 0; k < M; k++) { const t = (2 * PI * k) / M; if (f(t) > bv) { bv = f(t); best = t; } }
        const step = (2 * PI) / M;
        const t = bisect(s => centralDiff(f, s, 1e-6), best - step, best + step);
        return [q.R * Math.cos(t), q.R * Math.sin(t), f(t)];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['gradient', 'tangent-plane', 'linear-approx', 'directional', 'critical', 'classify', 'boundary-max', 'chain-rule', 'total-diff', 'challenge']);
  }, 12000);

  it('printed functions, points and constants agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      const kind = card.audit!.kind.slice(id.length + 1);
      const fx0 = F(p);
      switch (kind) {
        case 'gradient': {
          const m = match(/f\(x, y\) = (.+?)\. Find the gradient ∇f = \(f_x, f_y\) at the point \(x, y\) = \((-?\d+), (-?\d+)\)\./, card.prompt, where);
          expectPoly('f', m[1], (x, y) => fx0(x, y), where);
          expect([Number(m[2]), Number(m[3])], where).toEqual([p.x0, p.y0]);
          break;
        }
        case 'tangent-plane': {
          const m = match(/of f\(x, y\) = (.+?) passes through P = \((-?\d+), (-?\d+), (-?[\d.]+)\)\. Its tangent plane at P can be written z = mx \+ ny \+ k\. Find k\./, card.prompt, where);
          expectPoly('f', m[1], (x, y) => fx0(x, y), where);
          expect([Number(m[2]), Number(m[3])], where).toEqual([p.x0, p.y0]);
          expect(close(Number(m[4]), fx0(p.x0, p.y0), 1e-12), `${where}: printed f(P) ${m[4]}`).toBe(true);
          break;
        }
        case 'linear-approx': {
          const m = match(/For f\(x, y\) = (.+?), use the tangent plane at \((-?\d+), (-?\d+)\) to estimate f\((-?[\d.]+), (-?[\d.]+)\), where Δx = (-?[\d.]+) and Δy = (-?[\d.]+)\. Enter the estimate to 2 decimal places/, card.prompt, where);
          expectPoly('f', m[1], (x, y) => fx0(x, y), where);
          expect([Number(m[2]), Number(m[3])], where).toEqual([p.x0, p.y0]);
          expect(close(Number(m[4]), p.x0 + p.dx, 1e-12) && close(Number(m[5]), p.y0 + p.dy, 1e-12), `${where}: target point is not P + (Δx, Δy)`).toBe(true);
          expect([Number(m[6]), Number(m[7])], where).toEqual([p.dx, p.dy]);
          expect([0.1, 0.2].includes(Math.abs(p.dx)) && [0.1, 0.2].includes(Math.abs(p.dy)), `${where}: Δ values`).toBe(true);
          // the learner asked for the linear estimate: the estimate is accepted, the exact value of the printed f is rejected
          const est = fx0(p.x0, p.y0) + fx(fx0, p.x0, p.y0) * p.dx + fy(fx0, p.x0, p.y0) * p.dy;
          const exact = parseExpr(m[1])({ x: Number(m[4]), y: Number(m[5]) });
          expect(gradeCard(card, [est.toFixed(2)], null, []), `${where}: estimate rejected`).toBe('correct');
          expect(gradeCard(card, [String(exact)], null, []), `${where}: exact value ${exact} accepted`).toBe('incorrect');
          expect(Math.abs(exact - est), `${where}: exact ${exact} too close to the estimate ${est}`).toBeGreaterThanOrEqual(0.02 - 1e-9);
          break;
        }
        case 'directional': {
          const m = match(/For f\(x, y\) = (.+?), find the directional derivative df\/ds at \((-?\d+), (-?\d+)\) in the direction of the vector v = \((-?\d+), (-?\d+)\) \(\|v\| = 5\)/, card.prompt, where);
          expectPoly('f', m[1], (x, y) => fx0(x, y), where);
          expect([Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])], where).toEqual([p.x0, p.y0, p.v1, p.v2]);
          expect(Math.hypot(p.v1, p.v2)).toBe(5);
          expect(card.prompt).toContain('unit vector');
          break;
        }
        case 'critical': {
          const m = match(/w\(x, y\) = (.+?) has exactly one critical point/, card.prompt, where);
          expectPoly('w', m[1], (x, y) => Q(p)(x, y), where);
          expect(4 * p.a * p.c - p.b * p.b, `${where}: 4ac − b²`).not.toBe(0);
          break;
        }
        case 'classify': {
          const m = match(/same function w\(x, y\) = (.+?) with its single critical point/, card.prompt, where);
          const w = parseExpr(m[1]);
          const wf = (x: number, y: number) => w({ x, y });
          // the second-order part of the PRINTED function carries a, b, c
          expect(close((wf(1, 0) - 2 * wf(0, 0) + wf(-1, 0)) / 2, p.a, 1e-9), `${where}: a`).toBe(true);
          expect(close((wf(0, 1) - 2 * wf(0, 0) + wf(0, -1)) / 2, p.c, 1e-9), `${where}: c`).toBe(true);
          expect(close(wf(1, 1) - wf(1, 0) - wf(0, 1) + wf(0, 0), p.b, 1e-9), `${where}: b`).toBe(true);
          // judge the card's answer from the printed function itself
          const kind = classify(wf, newton2(wf));
          const want = kind === 'min' ? 'A local minimum' : kind === 'max' ? 'A local maximum' : 'A saddle point';
          expect(card.choice!.options[card.choice!.answer], where).toBe(want);
          expect(card.choice!.options.slice().sort(), where).toEqual(['A local maximum', 'A local minimum', 'A saddle point', 'The test cannot decide']);
          break;
        }
        case 'boundary-max': {
          const m = match(/On the first quadrant x ≥ 0, y ≥ 0, find the point where w\(x, y\) = (.+?) is largest, and the largest value of w/, card.prompt, where);
          expectPoly('w', m[1], (x, y) => -p.a * x * x - p.c * y * y + p.d * x - p.e * y, where);
          break;
        }
        case 'chain-rule': {
          const m = match(/w = w\(u, v\) with u = y\/x and v = x² \+ y²\. At the point \(x, y\) = \((-?\d+), (-?\d+)\) suppose w_u = (-?\d+) and w_v = (-?\d+)\./, card.prompt, where);
          expect(m.slice(1).map(Number), where).toEqual([p.x0, p.y0, p.wu, p.wv]);
          expect([1, 2].includes(Math.abs(p.x0)) && p.y0 !== 0, `${where}: x0 ∈ {±1, ±2}, y0 ≠ 0`).toBe(true);
          break;
        }
        case 'total-diff': {
          const m = match(/The surfaces (.+?) = (-?\d+) and (.+?) = (-?\d+) both pass through \(1, 1, 1\)/, card.prompt, where);
          const s1 = sides(m[1], m[2]), s2 = sides(m[3], m[4]);
          expect(samePoly(s1, (x, y, z) => p.p * x * x + p.q * y ** 3 + p.r * z ** 4 - (p.p + p.q + p.r)), `${where}: first surface`).toBe(true);
          expect(samePoly(s2, (x, y, z) => p.a * z ** 3 + p.b * x * z + p.c * x * y - (p.a + p.b + p.c)), `${where}: second surface`).toBe(true);
          expect(s1({ x: 1, y: 1, z: 1 }) === 0 && s2({ x: 1, y: 1, z: 1 }) === 0, `${where}: (1, 1, 1) on both`).toBe(true);
          break;
        }
        case 'challenge': {
          const m = match(/largest value of f\(x, y\) = (.+?) on the circle of radius (\d+), x² \+ y² = (\d+),/, card.prompt, where);
          expectPoly('f', m[1], (x, y) => p.p * x + p.q * y, where);
          expect(Number(m[2]), where).toBe(p.R);
          expect(Number(m[3]), where).toBe(p.R * p.R);
          expect(Math.abs(p.p) * Math.abs(p.q) === 12 && p.p * p.p + p.q * p.q === 25, `${where}: (p, q) ∈ {(±3, ±4), (±4, ±3)}`).toBe(true);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      expectGrading(card, where, { 'MIT-MV-31:linear-approx': 0.005 });
    });
    expect(seen.size).toBe(10);
  }, 12000);

  it('contour-points (no audit): the correct letter is the point of the figure where the stated partials hold', () => {
    eachCardById(id, 'contour-points', (card, where) => {
      const prompt = clean(card.prompt);
      const m = match(/level curve f\(x, y\) = (\d+) of f\(x, y\) = (.+?), a circle of radius (\d+) centred at \((-?\d+), (-?\d+)\)\. Four points P, Q, R, S are marked on it\. At which point do we have f_(x|y) = 0 and f_(x|y) (<|>) 0\?/, prompt, where);
      const f = parseExpr(m[2]);
      const F2 = (x: number, y: number) => f({ x, y });
      expect(Number(m[1]), where).toBe(Number(m[3]) ** 2);
      const [h, k, rho] = [Number(m[4]), Number(m[5]), Number(m[3])];
      const points = card.figure!.shapes.filter(s => s.kind === 'point') as { at: Pt; label?: string }[];
      expect(points.map(s => s.label).sort(), where).toEqual(['P', 'Q', 'R', 'S']);
      const zero = m[6], other = m[7], sign = m[8] === '>' ? 1 : -1;
      expect(zero, `${where}: asks for two different partials`).not.toBe(other);
      const holds = (pt: { at: Pt }) => {
        const [x, y] = pt.at;
        expect(close(F2(x, y), rho * rho, 1e-9), `${where}: marked point (${x}, ${y}) is not on the level curve`).toBe(true);
        const partial = (name: string) => (name === 'x' ? fx(F2, x, y) : fy(F2, x, y));
        return Math.abs(partial(zero)) < 1e-7 && Math.sign(partial(other)) === sign && Math.abs(partial(other)) > 1e-7;
      };
      const good = points.filter(holds);
      expect(good.length, `${where}: exactly one marked point must satisfy the condition`).toBe(1);
      expect(card.choice!.options[card.choice!.answer], where).toBe(`Point ${good[0].label}`);
      // the alt text names the same positions
      const pos = (pt: { at: Pt }) => (Math.abs(pt.at[0] - h) < 1e-9 ? (pt.at[1] > k ? 'top' : 'bottom') : (pt.at[0] > h ? 'right' : 'left'));
      for (const pt of points) expect(clean(card.figure!.alt), `${where}: alt text position of ${pt.label}`).toContain(`${pt.label} (${pos(pt)})`);
    });
  }, 12000);

  it('inconclusive (no audit): the verdict follows from the signs of f along the axes', () => {
    eachCardById(id, 'inconclusive', (card, where) => {
      const m = match(/^f\(x, y\) = (.+?) has f_x = f_y = 0 at \(0, 0\), and there f_xx f_yy - f_xy² = 0\./, card.prompt, where);
      const f = parseExpr(m[1]);
      const F2 = (x: number, y: number) => f({ x, y });
      // premises: critical point with zero discriminant
      expect(Math.hypot(fx(F2, 0, 0), fy(F2, 0, 0))).toBeLessThan(1e-9);
      const hh = 1e-3;
      const second = (g: (t: number) => number) => (g(hh) - 2 * g(0) + g(-hh)) / (hh * hh);
      const fxx = second(t => F2(t, 0)), fyy = second(t => F2(0, t));
      const fxy = (F2(hh, hh) - F2(hh, -hh) - F2(-hh, hh) + F2(-hh, -hh)) / (4 * hh * hh);
      expect(Math.abs(fxx * fyy - fxy * fxy), `${where}: D must be 0`).toBeLessThan(1e-6);
      // truth by a scan around the origin
      let pos = false, neg = false;
      for (const r of [0.05, 0.3, 1, 2]) for (let k = 0; k < 360; k++) {
        const v = F2(r * Math.cos((2 * PI * k) / 360), r * Math.sin((2 * PI * k) / 360));
        if (v > 1e-12) pos = true;
        if (v < -1e-12) neg = true;
      }
      const truth = pos && neg ? 'saddle' : pos ? 'min' : 'max';
      expectOneCorrect(card, text => {
        const claim = /always a saddle/.test(text) ? 'always' : /changes sign/.test(text) ? 'saddle' : /f ≥ 0/.test(text) ? 'min' : /f ≤ 0/.test(text) ? 'max' : 'unknown';
        if (claim === 'always' || claim === 'unknown') return false;
        const conclusion = /is a saddle point\.$/.test(text) ? 'saddle' : /is a minimum\.$/.test(text) ? 'min' : /is a maximum\.$/.test(text) ? 'max' : 'unknown';
        return text.startsWith('The test says nothing') && claim === truth && conclusion === truth;
      }, where);
    });
  }, 12000);

  it('choose-tool (no audit): the scenario decides the method', () => {
    eachCardById(id, 'choose-tool', (card, where) => {
      const prompt = clean(card.prompt);
      const rules: [RegExp, string][] = [
        [/Find the point of the surface .* at which [xyz] is largest/, 'Lagrange multipliers'],
        [/You know f\(.+\) = .+, f_x\(.+\) = .+ and f_y\(.+\) = .+\. Estimate f\(/, 'Linear (tangent-plane) approximation'],
        [/second derivatives are w_xx = .+ w_yy = .+ and w_xy = .+\. Decide whether it is a minimum, a maximum or a saddle/, 'The second derivative test'],
        [/w = w\(u, v\) with u = .+ and v = .+\. Express w_x in terms of w_u and w_v/, 'The chain rule'],
      ];
      const fits = rules.filter(([re]) => re.test(prompt));
      expect(fits.length, `${where}: scenario matches ${fits.length} rules: ${prompt}`).toBe(1);
      expectOneCorrect(card, text => text === fits[0][1], where);
      expect(card.choice!.options.slice().sort(), where).toEqual(['Lagrange multipliers', 'Linear (tangent-plane) approximation', 'The chain rule', 'The second derivative test']);
    });
  }, 12000);

  it('lagrange-setup (no audit): the unit vector of the asked variable is parallel to ∇g at the numerically found maximiser', () => {
    eachCardById(id, 'lagrange-setup', (card, where) => {
      const m = match(/^Consider the surface (.+?) = (\d+)\. At the point of the surface where ([xyz]) is largest.* Here g = (.+?), so ∇g = \((.+?), (.+?), (.+?)\)\. Do not solve them\.$/, card.prompt, where);
      expect(m[1], `${where}: g and the surface agree`).toBe(m[4]);
      const gs = parseExpr(m[4]);
      const g = (v: number[]) => gs({ x: v[0], y: v[1], z: v[2] });
      const c = Number(m[2]);
      const gradText = [m[5], m[6], m[7]].map(parseExpr);
      const gradFD = (v: number[]) => [0, 1, 2].map(i => d1(t => g(v.map((s, j) => (j === i ? t : s))), v[i]));
      for (const v of [[0.4, -1.2, 0.9], [1.7, 0.3, -2.1], [-0.8, 1.1, 1.3]])
        gradText.forEach((component, i) => expect(close(component({ x: v[0], y: v[1], z: v[2] }), gradFD(v)[i], 1e-8), `${where}: printed ∇g component ${i}`).toBe(true));
      const axis = 'xyz'.indexOf(m[3]);
      // maximise the coordinate over the (positive definite) surface g = c: search directions u on the sphere, scale u onto the surface
      const onSurface = (th: number, ph: number) => {
        const u = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
        const gu = g(u);
        expect(gu, `${where}: g must be positive definite`).toBeGreaterThan(0);
        return u.map(s => s * Math.sqrt(c / gu));
      };
      let bt = 0, bp = 0, bv = -Infinity;
      for (let i = 0; i <= 90; i++) for (let j = 0; j < 180; j++) { const v = onSurface((PI * i) / 90, (2 * PI * j) / 180)[axis]; if (v > bv) { bv = v; bt = (PI * i) / 90; bp = (2 * PI * j) / 180; } }
      let step = PI / 90;
      for (let it = 0; it < 80; it++) {
        let improved = false;
        for (const [dt, dp] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step], [step, -step], [-step, step]]) {
          const v = onSurface(bt + dt, bp + dp)[axis];
          if (v > bv + 1e-15) { bv = v; bt += dt; bp += dp; improved = true; }
        }
        if (!improved) step /= 2;
      }
      const star = onSurface(bt, bp);
      const grad = gradFD(star);
      const gn = Math.hypot(...grad);
      expect(gn, `${where}: ∇g must not vanish on the surface`).toBeGreaterThan(1e-6);
      expectOneCorrect(card, text => {
        const t = clean(text);
        const zero = t.match(/^\((.+)\) = \(0, 0, 0\)$/);
        if (zero) return gn < 1e-9;
        const lam = t.match(/^\((\d), (\d), (\d)\) = λ\((.+)\)$/);
        if (!lam) throw new Error(`cannot read option "${text}"`);
        expect(lam[4], `${where}: option's ∇g must be the printed one`).toBe(`${m[5]}, ${m[6]}, ${m[7]}`);
        const e = [Number(lam[1]), Number(lam[2]), Number(lam[3])];
        const cross = [e[1] * grad[2] - e[2] * grad[1], e[2] * grad[0] - e[0] * grad[2], e[0] * grad[1] - e[1] * grad[0]];
        return Math.hypot(...cross) < 1e-5 * gn && Math.hypot(...e) > 0;
      }, where);
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ slot cards
/** The four answer tokens of an iterated-limits symbol card as (inner, outer) limits; also checks the printed blank layout. */
function slotLimits(card: PracticeCard, where: string): { limits: Limit[]; inner: string; outer: string } {
  const s = card.slots!;
  expect(s.before, where).toBe('');
  expect(s.between!.length, where).toBe(3);
  const inner = s.between![0].match(/^ ≤ ([xyrθ]) ≤ $/), outer = s.between![2].match(/^ ≤ ([xyrθ]) ≤ $/);
  expect(inner && outer && s.between![1] === ',  ', `${where}: blank layout ${JSON.stringify(s.between)}`).toBeTruthy();
  expect(s.answers.length, where).toBe(4);
  const [a0, a1, a2, a3] = s.answers;
  return { limits: [{ v: inner![1], lo: parseExpr(a0), hi: parseExpr(a1) }, { v: outer![1], lo: parseExpr(a2), hi: parseExpr(a3) }], inner: inner![1], outer: outer![1] };
}
/** The answer limits (Cartesian) describe exactly `truth`: grid agreement, area and a test integral. */
function expectCartesianSlots(card: PracticeCard, truth: Region, box: Box, area: number, where: string) {
  const { limits, inner, outer } = slotLimits(card, where);
  expect(new Set([inner, outer]).size, `${where}: inner and outer variables must differ`).toBe(2);
  const { region } = cartesianRegion(limits);
  const cmp = symDiff(truth, region, box, 400);
  expect(cmp.diff / area, `${where}: limits ${card.slots!.answers.join(' | ')} differ from the region by ${cmp.diff.toFixed(4)} of ${area.toFixed(4)}`).toBeLessThan(2e-3);
  const { area: a, integral } = iteratedCartesian(limits, G);
  expect(Math.abs(a - area) / area, `${where}: limit area ${a} vs region area ${area}`).toBeLessThan(2e-3);
  const reference = gridIntegral(G, truth, box, 700);
  expect(Math.abs(integral - reference) / Math.abs(reference), `${where}: ∬ g over the limits ${integral} vs over the region ${reference}`).toBeLessThan(1e-2);
  for (const t of card.slots!.answers) expect(card.slots!.tokens, `${where}: token ${t}`).toContain(t);
}
/** Triangle with the axes: (0, 0), (A, 0), (0, C), from the question text "y = LINE (it meets the axes at (A, 0) and (0, C))". */
function triangleFromPrompt(prompt: string, where: string) {
  const m = match(/the line y = (.+?) \(it meets the axes at \((\d+), 0\) and \(0, (\d+)\)\)/, prompt, where);
  const [A, C] = [Number(m[2]), Number(m[3])];
  const line = parseExpr(m[1]);
  expect(close(line({ x: A }), 0) && close(line({ x: 0 }), C), `${where}: printed line y = ${m[1]} does not join (${A}, 0) and (0, ${C})`).toBe(true);
  const region: Region = (x, y) => x >= 0 && y >= 0 && y <= line({ x });
  return { A, C, line, region, box: [0, A, 0, C] as Box, area: (A * C) / 2 };
}
/** A choice option "Inner: y from x² to x + 2. Outer: x from 0 to 1." (either order) as limits, or null when it is not a valid iterated integral. */
function optionLimits(text: string): Limit[] | null {
  const t = clean(text);
  const a = t.match(/^Inner: ([xy]) from (.+?) to (.+?)\. Outer: ([xy]) from (.+?) to (.+?)\.$/), b = t.match(/^Outer: ([xy]) from (.+?) to (.+?)\. Inner: ([xy]) from (.+?) to (.+?)\.$/);
  const mk = (m: RegExpMatchArray, o: number, i: number): Limit[] | null => {
    const inner = { v: m[i], lo: parseExpr(m[i + 1]), hi: parseExpr(m[i + 2]) }, outer = { v: m[o], lo: parseExpr(m[o + 1]), hi: parseExpr(m[o + 2]) };
    if (inner.v === outer.v) return null;
    try { outer.lo({}); outer.hi({}); inner.lo({ [outer.v]: 0.5 }); inner.hi({ [outer.v]: 0.5 }); } catch { return null; } // outer limits must be constants; inner limits may use only the outer variable
    return [inner, outer];
  };
  if (a) return mk(a, 4, 1);
  if (b) return mk(b, 1, 4);
  throw new Error(`cannot read option "${text}"`);
}

// ================================================================================================================== MIT-MV-32
describe('MIT-MV-32 Definition of Double Integrals', () => {
  const id = 'MIT-MV-32';
  /** Riemann sum over the m × n unit squares with a chosen corner of each (area of each square from its own corners). */
  const cornerSum = (p: P, corner: 'lower-left' | 'upper-right') => {
    const f = (x: number, y: number) => p.p * x + p.q * y + p.r;
    let sum = 0;
    for (let i = 0; i < p.m; i++) for (let j = 0; j < p.n; j++) {
      const [x0, x1, y0, y1] = [i, i + 1, j, j + 1];
      const dA = (x1 - x0) * (y1 - y0);
      sum += corner === 'lower-left' ? f(x0, y0) * dA : f(x1, y1) * dA;
    }
    return sum;
  };

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch07Generators[id]), {
      'MIT-MV-32:corner-sum': p => [cornerSum(p as P, 'lower-left')],
      'MIT-MV-32:table-sum': p => {
        const dA = p.dA as number[], delta = p.delta as number[];
        expect(dA.length === 4 && delta.length === 4).toBe(true);
        return [dA.reduce((s, a, i) => s + a * delta[i], 0)];
      },
      'MIT-MV-32:challenge': p => [cornerSum(p as P, 'upper-right')],
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['corner-sum', 'table-sum', 'challenge']);
  }, 12000);

  it('printed rectangles, functions and tables agree with the audit params (and the figure marks the sampled corners)', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params;
      switch (card.audit!.kind) {
        case 'MIT-MV-32:corner-sum': {
          const q = p as P;
          const m = match(/R is the rectangle 0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+), cut into (\d+) unit squares \(ΔA_i = 1 for every square\)\. In each square take \(x_i, y_i\) to be its lower-left corner, as marked in the figure\. For f\(x, y\) = (.+?), compute the Riemann sum/, card.prompt, where);
          expect([Number(m[1]), Number(m[2]), Number(m[3])], where).toEqual([q.m, q.n, q.m * q.n]);
          expectPoly('f', m[4], (x, y) => q.p * x + q.q * y + q.r, where);
          // the marked points of the figure are the lower-left corners and their f-values sum to the answer
          const pts = card.figure!.shapes.filter(s => s.kind === 'point') as { at: Pt }[];
          expect(pts.length, `${where}: one marked point per square`).toBe(q.m * q.n);
          const keys = pts.map(s => `${s.at[0]},${s.at[1]}`).sort();
          const want: string[] = [];
          for (let i = 0; i < q.m; i++) for (let j = 0; j < q.n; j++) want.push(`${i},${j}`);
          expect(keys, where).toEqual(want.sort());
          const f = parseExpr(m[4]);
          expect(close(pts.reduce((s, pt) => s + f({ x: pt.at[0], y: pt.at[1] }), 0), card.fields![0].answer, 1e-12), `${where}: Σ f over the figure's marked points`).toBe(true);
          const poly = figurePolygon(card.figure, where);
          expect(bbox(poly), where).toEqual([0, q.m, 0, q.n]);
          expect(shoelace(poly), where).toBe(q.m * q.n);
          break;
        }
        case 'MIT-MV-32:table-sum': {
          const dA = p.dA as number[], delta = p.delta as number[];
          expect(card.lines!.length, where).toBe(4);
          card.lines!.forEach((line, i) => {
            const m = match(/^Piece (\d): ΔA = ([\d.]+) m², δ = ([\d.]+) kg\/m²$/, line, where);
            expect([Number(m[1]), Number(m[2]), Number(m[3])], `${where} line ${i}`).toEqual([i + 1, dA[i], delta[i]]);
          });
          const total = card.lines!.reduce((s, line) => { const m = clean(line).match(/ΔA = ([\d.]+) m², δ = ([\d.]+)/)!; return s + Number(m[1]) * Number(m[2]); }, 0);
          expect(total, `${where}: sum of the printed rows`).toBe(card.fields![0].answer);
          break;
        }
        case 'MIT-MV-32:challenge': {
          const q = p as P;
          const m = match(/R is the rectangle 0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+), cut into (\d+) unit squares\. In each square take \(x_i, y_i\) to be its upper-right corner\. For f\(x, y\) = (.+?), compute the Riemann sum/, card.prompt, where);
          expect([Number(m[1]), Number(m[2]), Number(m[3])], where).toEqual([q.m, q.n, q.m * q.n]);
          expectPoly('f', m[4], (x, y) => q.p * x + q.q * y + q.r, where);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      expectGrading(card, where, {});
    });
    expect(seen.size).toBe(3);
  }, 12000);

  it('piece-area, limit (no audit): the correct option is the standard meaning', () => {
    eachCardById(id, 'piece-area', (card, where) => expectOneCorrect(card, t => /^The area of the i-th small piece of R\.$/.test(t), where));
    eachCardById(id, 'limit', (card, where) => expectOneCorrect(card, t => /approximation/.test(t) && /is the limit of such sums/.test(t) && !/^S equals/.test(t), where));
  }, 12000);

  it('sample-point (no audit): the printed sums are the two corner sums; both approximate the same integral', () => {
    eachCardById(id, 'sample-point', (card, where) => {
      const m = match(/^R = \[0, (\d+)\] × \[0, (\d+)\] is cut into (\d+) unit squares \(ΔA_i = 1\) and f\(x, y\) = (.+?)\. Student A takes the lower-left corner of each square as \(x_i, y_i\); Student B takes the upper-right corner\. Their sums are (-?\d+) and (-?\d+)\./, card.prompt, where);
      const [mm, nn] = [Number(m[1]), Number(m[2])];
      expect(Number(m[3]), where).toBe(mm * nn);
      const f = parseExpr(m[4]);
      let A = 0, B = 0;
      for (let i = 0; i < mm; i++) for (let j = 0; j < nn; j++) { A += f({ x: i, y: j }); B += f({ x: i + 1, y: j + 1 }); }
      expect([A, B], `${where}: printed sums`).toEqual([Number(m[5]), Number(m[6])]);
      expect(A, `${where}: the sums must differ for the scenario to make sense`).not.toBe(B);
      // refining the grid, both corner sums converge to the same number: the integral of f over R
      const corner = (k: number, c: number) => { let s = 0; for (let i = 0; i < mm * k; i++) for (let j = 0; j < nn * k; j++) s += f({ x: (i + c) / k, y: (j + c) / k }) / (k * k); return s; };
      expect(Math.abs(corner(100, 0) - corner(100, 1)), where).toBeLessThan(Math.abs(A - B) / 50 + 1e-9);
      expectOneCorrect(card, t => /^The sums differ, but both approximate ∬_R f dA and both approach the same limit as the pieces shrink\.$/.test(t), where);
    });
  }, 12000);

  it('units (no audit): the integral has the unit density × area', () => {
    const parseUnit = (s: string) => {
      const out: Record<string, number> = {};
      let sign = 1;
      for (const part of clean(s).split(/([·/])/)) {
        if (part === '/') { sign = -1; continue; }
        if (part === '·') { sign = 1; continue; }
        const m = part.match(/^([a-z]+)(²)?$/);
        if (!m) throw new Error(`cannot read unit "${part}" of "${s}"`);
        out[m[1]] = (out[m[1]] ?? 0) + sign * (m[2] ? 2 : 1);
      }
      return out;
    };
    const canon = (u: Record<string, number>) => JSON.stringify(Object.entries(u).filter(([, v]) => v !== 0).sort());
    eachCardById(id, 'units', (card, where) => {
      const m = match(/density δ in (\S+) \(mass per unit area\), and areas are measured in (\S+?)\. In what unit is the mass/, card.prompt, where);
      const product: Record<string, number> = { ...parseUnit(m[1]) };
      for (const [k, v] of Object.entries(parseUnit(m[2]))) product[k] = (product[k] ?? 0) + v;
      expectOneCorrect(card, t => canon(parseUnit(t)) === canon(product), where);
    });
  }, 12000);

  it('setup (symbols): integral sign, matching integrand, area element', () => {
    eachCardById(id, 'setup', (card, where) => {
      const prompt = clean(card.prompt);
      const kind: 'N' | 'V' | 'M' = /population density ρ/.test(prompt) ? 'N' : /graph z = f\(x, y\)/.test(prompt) ? 'V' : /density δ\(x, y\) is mass per unit area/.test(prompt) ? 'M' : (() => { throw new Error(`${where}: scenario not recognised: ${prompt}`); })();
      expect(prompt, where).toContain(`${kind} = lim Σ`);
      const integrand = { N: 'ρ(x, y)', V: 'f(x, y)', M: 'δ(x, y)' }[kind];
      expect(card.slots!.answers, where).toEqual(['∬_R', integrand, 'dA']);
      expect(card.slots!.before, where).toBe(`${kind} =`);
      for (const t of card.slots!.answers) expect(card.slots!.tokens).toContain(t);
      expect(gradeCard(card, [], null, card.slots!.answers), where).toBe('correct');
    });
  }, 12000);
});

// ================================================================================================================== MIT-MV-33
describe('MIT-MV-33 Examples of Double Integration', () => {
  const id = 'MIT-MV-33';
  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch07Generators[id]), {
      'MIT-MV-33:triangle-integral': p => {
        const { a, c } = p as P, f = (x: number, y: number) => (p.p as number) * x + (p.q as number) * y;
        const dydx = iter2(f, 0, a, () => 0, x => c * (1 - x / a));
        const dxdy = iter2((y, x) => f(x, y), 0, c, () => 0, y => a * (1 - y / c)); // the other order gives the same number
        expect(close(dydx, dxdy, 1e-10), `orders disagree ${dydx} vs ${dxdy}`).toBe(true);
        return [dydx];
      },
      'MIT-MV-33:curved-area': p => {
        const s = p.s as number;
        const exact = iter2(() => 1, 0, 1, x => x * x, x => x + s);
        const grid = gridIntegral(() => 1, (x, y) => x >= 0 && x <= 1 && y >= x * x && y <= x + s, [0, 1, 0, s + 1], 800);
        expect(Math.abs(grid - exact) / exact, 'grid area').toBeLessThan(5e-3);
        return [exact];
      },
      'MIT-MV-33:curved-mass': p => {
        const { s, p: k } = p as P;
        const exact = iter2(x => k * x, 0, 1, x => x * x, x => x + s);
        const grid = gridIntegral(x => k * x, (x, y) => x >= 0 && x <= 1 && y >= x * x && y <= x + s, [0, 1, 0, s + 1], 800);
        expect(Math.abs(grid - exact) / exact, 'grid mass').toBeLessThan(5e-3);
        return [exact];
      },
      'MIT-MV-33:tetrahedron': p => {
        const { h, p: pp, q } = p as P;
        const z = (x: number, y: number) => h - pp * x - q * y;
        const a = h / pp, b = h / q;
        const v1 = iter2(z, 0, a, () => 0, x => b * (1 - x / a));
        const v2 = iter2((y, x) => z(x, y), 0, b, () => 0, y => a * (1 - y / b));
        expect(close(v1, v2, 1e-10), 'orders disagree').toBe(true);
        return [v1];
      },
      'MIT-MV-33:challenge': p => {
        const { m, b, p: pp, q } = p as P, f = (x: number, y: number) => pp * x + q * y;
        const v1 = iter2(f, 0, b, () => 0, x => m * x);
        // other order: outer y in [0, m b], inner x from y/m to b
        const v2 = iter2((y, x) => f(x, y), 0, m * b, y => y / m, () => b);
        expect(close(v1, v2, 1e-9), `orders disagree ${v1} vs ${v2}`).toBe(true);
        return [v1];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['triangle-integral', 'curved-area', 'curved-mass', 'tetrahedron', 'challenge']);
  }, 12000);

  it('printed regions, integrands and figures agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-33:triangle-integral': {
          const m = match(/^Evaluate ∬_R \((.+?)\) dA, where R is the triangle bounded by the x-axis, the y-axis and the line y = (.+?) \(it meets the axes at \((\d+), 0\) and \(0, (\d+)\)\)\. Use dy dx: inner y from 0 to (.+?), outer x from 0 to (\d+)\./, card.prompt, where);
          expectPoly('integrand', m[1], (x, y) => p.p * x + p.q * y, where);
          expect([Number(m[3]), Number(m[4]), Number(m[6])], where).toEqual([p.a, p.c, p.a]);
          expect(m[5], `${where}: inner limit equals the line`).toBe(m[2]);
          const tri = triangleFromPrompt(card.prompt, where);
          expect([tri.A, tri.C], where).toEqual([p.a, p.c]);
          expectFigureIs(card.figure, tri.region, tri.box, 3e-3, where);
          break;
        }
        case 'MIT-MV-33:curved-area': {
          const m = match(/\(the region of the previous figure, between y = x² and y = x \+ (\d+) for 0 ≤ x ≤ 1\) as the double integral ∬_R dA with dy dx: inner y from x² to x \+ (\d+), outer x from 0 to 1\./, card.prompt, where);
          expect([Number(m[1]), Number(m[2])], where).toEqual([p.s, p.s]);
          expectFigureIs(card.figure, (x, y) => x >= 0 && x <= 1 && y >= x * x && y <= x + p.s, [0, 1, 0, p.s + 1], 1.5e-2, where);
          const dashed = card.figure!.shapes.filter(s => s.kind === 'line' && s.points.length === 2 && s.points[0][0] === s.points[1][0] && s.points[0][0] === 0.5) as { points: Pt[] }[];
          expect(dashed.length, `${where}: dashed vertical line at x = 0.5`).toBe(1);
          expect(close(dashed[0].points[0][1], 0.25) && close(dashed[0].points[1][1], 0.5 + p.s), `${where}: dashed line runs from the parabola to the line`).toBe(true);
          break;
        }
        case 'MIT-MV-33:curved-mass': {
          const m = match(/\(between y = x² and y = x \+ (\d+), 0 ≤ x ≤ 1\) has density δ\(x, y\) = (.+?)\. Find its mass M = ∬_R δ dA using dy dx/, card.prompt, where);
          expect(Number(m[1]), where).toBe(p.s);
          expectPoly('δ', m[2], x => p.p * x, where);
          break;
        }
        case 'MIT-MV-33:tetrahedron': {
          const m = match(/the plane z = (.+?); the plane meets the axes at x = (.+?), y = (.+?) and z = (\d+)\. Its volume is V = ∬_R \((.+?)\) dA, where R is the triangle in the xy-plane with vertices \(0, 0\), \((.+?), 0\) and \(0, (.+?)\)/, card.prompt, where);
          expectPoly('plane', m[1], (x, y) => p.h - p.p * x - p.q * y, where);
          expectPoly('integrand', m[5], (x, y) => p.h - p.p * x - p.q * y, where);
          const [ax, by] = [ev(m[2]), ev(m[3])];
          expect(close(ax, p.h / p.p) && close(by, p.h / p.q) && Number(m[4]) === p.h, `${where}: intercepts`).toBe(true);
          expect(close(ev(m[6]), ax) && close(ev(m[7]), by), `${where}: vertices`).toBe(true);
          expectFigureIs(card.figure, (x, y) => x >= 0 && y >= 0 && x / ax + y / by <= 1, [0, ax, 0, by], 3e-3, where);
          break;
        }
        case 'MIT-MV-33:challenge': {
          const m = match(/^R is the triangle bounded by the x-axis, the vertical line x = (\d+) and the line y = (.+?)\. Evaluate ∬_R \((.+?)\) dA, integrating first in y \(dy dx\)\./, card.prompt, where);
          expect(Number(m[1]), where).toBe(p.b);
          expectPoly('line', m[2], x => p.m * x, where);
          expectPoly('integrand', m[3], (x, y) => p.p * x + p.q * y, where);
          if (card.figure) expectFigureIs(card.figure, (x, y) => x >= 0 && x <= p.b && y >= 0 && y <= p.m * x, [0, p.b, 0, p.m * p.b], 3e-3, where);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      expectGrading(card, where, {});
    });
    expect(seen.size).toBe(5);
  }, 12000);

  it('vertical-line (no audit): inner y between the entry and exit of a vertical line', () => {
    eachCardById(id, 'vertical-line', (card, where) => {
      expect(clean(card.prompt), where).toContain('y as the inner variable (dy first, then dx)');
      const tri = triangleFromPrompt(card.prompt, where);
      expectFigureIs(card.figure, tri.region, tri.box, 3e-3, where);
      // fix x = x*: the points of R on that vertical line are y between 0 and the line, so inner limits are y-values and outer x runs over [0, A]
      expectOneCorrect(card, t => /^Hold x fixed and let y increase: the point traces a vertical line\./.test(t) && /inner limits are the y-values where this line enters and leaves R/.test(t) && /outer limits run over all x for which the line meets R/.test(t), where);
      const dashed = card.figure!.shapes.filter(s => s.kind === 'line' && s.points.length === 2 && s.points[0][0] === s.points[1][0]) as { points: Pt[] }[];
      expect(dashed.length, `${where}: dashed vertical line`).toBe(1);
      const [x0, y1] = [dashed[0].points[1][0], dashed[0].points[1][1]];
      expect(dashed[0].points[0], where).toEqual([x0, 0]);
      expect(close(y1, tri.line({ x: x0 })) && x0 > 0 && x0 < tri.A, `${where}: the dashed line ends on the hypotenuse`).toBe(true);
    });
  }, 12000);

  it('triangle-limits (symbols): the four limits describe the triangle', () => {
    eachCardById(id, 'triangle-limits', (card, where) => {
      const tri = triangleFromPrompt(card.prompt, where);
      expect(clean(card.prompt), where).toContain('y is the inner variable (dy), x the outer variable (dx)');
      expectCartesianSlots(card, tri.region, tri.box, tri.area, where);
      expect(slotLimits(card, where).inner, where).toBe('y');
      expectFigureIs(card.figure, tri.region, tri.box, 3e-3, where);
    });
  }, 12000);

  it('curved-limits and bad-limits (no audit): evaluate each option as an iterated integral and compare with the region', () => {
    eachCardById(id, 'curved-limits', (card, where) => {
      const m = match(/^R is bounded by the parabola y = x², the line y = x \+ (\d+) and the vertical lines x = 0 and x = 1/, card.prompt, where);
      const s = Number(m[1]);
      const truth: Region = (x, y) => x >= 0 && x <= 1 && y >= x * x && y <= x + s;
      const box: Box = [-0.2, 1.2, -0.3, s + 1.3];
      expect(clean(card.prompt), where).toContain('hold x fixed and let y increase');
      expectOneCorrect(card, t => {
        const limits = optionLimits(t);
        if (!limits || limits[1].v !== 'x') return false;
        return symDiff(truth, cartesianRegion(limits).region, box, 400).diff < 1e-3;
      }, where);
      expectFigureIs(card.figure, truth, [0, 1, 0, s + 1], 1.5e-2, where);
    });
    eachCardById(id, 'bad-limits', (card, where) => {
      const tri = triangleFromPrompt(card.prompt, where);
      expect(clean(card.prompt), where).toContain('order dy dx, inner variable y');
      expectOneCorrect(card, t => {
        const limits = optionLimits(t);
        if (!limits || limits[1].v !== 'x' || limits[0].v !== 'y') return false;
        return symDiff(tri.region, cartesianRegion(limits).region, unionBox(tri.box, [0, tri.A, 0, tri.C]), 400).diff < 1e-3;
      }, where);
    });
  }, 12000);
});

// ================================================================================================================== MIT-MV-34
describe('MIT-MV-34 Exchanging the Order of Integration', () => {
  const id = 'MIT-MV-34';
  /** The region described in words in an exchange card, from the printed vertices / parabola, as a predicate with a bounding box. */
  function wordsRegion(prompt: string, where: string): { region: Region; box: Box } | null {
    const tri = clean(prompt).match(/triangle with vertices \((-?\d+), (-?\d+)\), \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/);
    if (tri) {
      const poly: Pt[] = [[Number(tri[1]), Number(tri[2])], [Number(tri[3]), Number(tri[4])], [Number(tri[5]), Number(tri[6])]];
      return { region: (x, y) => inPoly(poly, x, y), box: bbox(poly) };
    }
    const par = clean(prompt).match(/region between the parabola y = x² and the line y = (\d+), for 0 ≤ x ≤ (\d+)/);
    if (par) {
      const [top, xr] = [Number(par[1]), Number(par[2])];
      expect(xr * xr, `${where}: parabola meets the line at x = √${top}`).toBe(top);
      return { region: (x, y) => x >= 0 && x <= xr && y >= x * x && y <= top, box: [0, xr, 0, top] };
    }
    return null;
  }

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch07Generators[id]), {
      'MIT-MV-34:poly-exchange': p => {
        const { a, lo0, lo1, hi0, hi1, p: pp, q } = p as P;
        const lo = (x: number) => lo0 + lo1 * x, hi = (x: number) => hi0 + hi1 * x;
        for (let k = 0; k <= 20; k++) expect(hi((a * k) / 20) - lo((a * k) / 20), 'region must have non-negative height').toBeGreaterThanOrEqual(-1e-12);
        const f = (x: number, y: number) => pp * x + q * y;
        const v1 = iter2(f, 0, a, lo, hi);
        // exchanged order, computed on a grid over the same region (a different route from the nested Simpson)
        const ymin = Math.min(lo(0), lo(a)), ymax = Math.max(hi(0), hi(a));
        const grid = gridIntegral(f, (x, y) => x >= 0 && x <= a && y >= lo(x) && y <= hi(x), [0, a, ymin, ymax], 900);
        const scale = Math.max(1, Math.abs(v1));
        expect(Math.abs(grid - v1) / scale, `grid ${grid} vs ${v1}`).toBeLessThan(6e-3);
        return [v1];
      },
      'MIT-MV-34:gaussian': p => {
        const { a, m } = p as P;
        // original order dy dx: inner y from x to a, outer x from 0 to a
        const I = iter2((_x, y) => m * Math.exp(-y * y), 0, a, x => x, () => a, 600, 300);
        return [I / (1 - Math.exp(-a * a))];
      },
      'MIT-MV-34:challenge': p => {
        const { n, d, k } = p as P;
        const c = (n * PI) / d;
        const sinc = (x: number) => (Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x);
        // order dx dy: inner x from y to c, outer y from 0 to c
        return [simpson(y => simpson(x => k * sinc(x), y, c, 300), 0, c, 600)];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['poly-exchange', 'gaussian', 'challenge']);
  }, 12000);

  it('printed limits, integrands and figures agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-34:poly-exchange': {
          const m = match(/^Let R be the region with limits\s+(.+?)\s+\(order dy dx\), and I = ∬_R \((.+?)\) dA\./, card.prompt, where);
          expectPoly('integrand', m[2], (x, y) => p.p * x + p.q * y, where);
          const limits = parseLimits(m[1]);
          expect(limits.map(l => l.v), where).toEqual(['y', 'x']);
          expect([limits[1].lo({}), limits[1].hi({})], where).toEqual([0, p.a]);
          for (let k = 0; k <= 10; k++) {
            const x = (p.a * k) / 10;
            expect(close(limits[0].lo({ x }), p.lo0 + p.lo1 * x) && close(limits[0].hi({ x }), p.hi0 + p.hi1 * x), `${where}: printed inner limits at x = ${x}`).toBe(true);
          }
          const region = (x: number, y: number) => x >= 0 && x <= p.a && y >= p.lo0 + p.lo1 * x && y <= p.hi0 + p.hi1 * x;
          const ys = [p.lo0, p.lo0 + p.lo1 * p.a, p.hi0, p.hi0 + p.hi1 * p.a];
          expectFigureIs(card.figure, region, [0, p.a, Math.min(...ys), Math.max(...ys)], 3e-3, where);
          expect(clean(card.prompt), where).toContain('Exchange the order, so that x is the inner variable (dx) and y the outer variable (dy)');
          break;
        }
        case 'MIT-MV-34:gaussian': {
          const m = match(/^I = ∬_R (\d*)e\^\{-y²\} dA with R: 0 ≤ x ≤ (\d+), x ≤ y ≤ (\d+) \(inner variable y, order dy dx\)\. After exchanging the order, I can be written as I = k\(1 - e\^\{-(\d+)\}\)\. Find k\./, card.prompt, where);
          expect([num(m[1]), Number(m[2]), Number(m[3]), Number(m[4])], where).toEqual([p.m, p.a, p.a, p.a * p.a]);
          break;
        }
        case 'MIT-MV-34:challenge': {
          const m = match(/^Evaluate I = ∬_R (\d*)\(sin x\)\/x dA over R: 0 ≤ y ≤ (.+?), y ≤ x ≤ (.+?) \(inner variable x, order dx dy\)\./, card.prompt, where);
          const c = (p.n * PI) / p.d;
          expect(num(m[1]), where).toBe(p.k);
          expect(close(ev(m[2]), c, 1e-12) && close(ev(m[3]), c, 1e-12), `${where}: printed c = ${m[2]} vs nπ/d = ${c}`).toBe(true);
          // printed forms: π, π/d or nπ/d
          const printed = p.n === 1 && p.d === 1 ? 'π' : p.n === 1 ? `π/${p.d}` : `${p.n}π/${p.d}`;
          expect(m[2], where).toBe(printed);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      expectGrading(card, where, {});
    });
    expect(seen.size).toBe(3);
  }, 12000);

  it('read-region (four pictures): exactly one picture matches the printed limits; the pictures all differ', () => {
    eachCardById(id, 'read-region', (card, where) => {
      const m = match(/^The integral ∬_R f dy dx has the limits\s+(.+?)\s+\(inner variable y, outer variable x\)\. Which picture shows the region R\?/, card.prompt, where);
      const limits = parseLimits(m[1]);
      expect(limits.map(l => l.v), where).toEqual(['y', 'x']);
      const { region } = cartesianRegion(limits);
      const figures = card.choice!.figures!;
      expect(figures.length, where).toBe(4);
      expect(card.choice!.options, where).toEqual(['Picture A', 'Picture B', 'Picture C', 'Picture D']);
      const polys = figures.map((f, i) => figurePolygon(f, `${where} picture ${i}`));
      const box = polys.map(bbox).reduce((u, b) => unionBox(u, b));
      const truthArea = symDiff(region, () => false, box, 120).area;
      expect(truthArea, `${where}: printed region has no area`).toBeGreaterThan(0);
      const matches = polys.map(poly => symDiff(region, (x, y) => inPoly(poly, x, y), box, 120).diff / truthArea < 0.03);
      expect(matches.filter(Boolean).length, `${where}: exactly one picture must match the limits`).toBe(1);
      expect(card.choice!.answer, where).toBe(matches.indexOf(true));
      // every pair of pictures is a different region
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const d = symDiff((x, y) => inPoly(polys[i], x, y), (x, y) => inPoly(polys[j], x, y), box, 120);
        expect(d.diff / Math.max(d.area, 1e-9), `${where}: pictures ${i} and ${j} are nearly the same region`).toBeGreaterThan(0.1);
      }
      // each alt text names the shape that is drawn
      figures.forEach((f, i) => {
        const alt = clean(f!.alt);
        expect(alt.startsWith(`Picture ${'ABCD'[i]}:`), `${where}: alt label ${alt}`).toBe(true);
        const w = wordsRegion(alt, where);
        if (w) expect(symDiff(w.region, (x, y) => inPoly(polys[i], x, y), unionBox(w.box, bbox(polys[i])), 120).diff / symDiff(w.region, () => false, unionBox(w.box, bbox(polys[i])), 120).area, `${where}: picture ${i} drawing vs its alt text`).toBeLessThan(0.03);
      });
    });
  }, 12000);

  /** Exchange cards: the printed region (limits in the given order), then the answer limits in the other order. */
  function checkSwap(cardId: string, givenInner: string) {
    eachCardById(id, cardId, (card, where) => {
      const m = match(/^R is (.+?)\. In the order (dy dx|dx dy) its limits are\s+(.+?)\. Exchange the order: now (.) is the inner variable/, card.prompt, where);
      expect(m[2] === 'dy dx' ? 'y' : 'x', where).toBe(givenInner);
      const given = parseLimits(m[3]);
      expect(given.map(l => l.v), where).toEqual([givenInner, givenInner === 'y' ? 'x' : 'y']);
      const { region } = cartesianRegion(given);
      const outerLimit = given[1];
      const [olo, ohi] = [outerLimit.lo({}), outerLimit.hi({})];
      const inner = given[0];
      const innerExtremes = [0, 0.25, 0.5, 0.75, 1].flatMap(f => { const e = { [outerLimit.v]: olo + f * (ohi - olo) }; return [inner.lo(e), inner.hi(e)]; });
      const box: Box = givenInner === 'y' ? [olo - 0.2, ohi + 0.2, Math.min(...innerExtremes) - 0.2, Math.max(...innerExtremes) + 0.2] : [Math.min(...innerExtremes) - 0.2, Math.max(...innerExtremes) + 0.2, olo - 0.2, ohi + 0.2];
      const words = wordsRegion(m[1], where);
      expect(words, `${where}: region in words not recognised: ${m[1]}`).not.toBeNull();
      const ref = symDiff(words!.region, region, unionBox(box, words!.box));
      expect(ref.diff / ref.area, `${where}: the printed limits differ from the region in words`).toBeLessThan(5e-3);
      const area = symDiff(region, () => false, box).area;
      // the answer: inner/outer variables are the other way round than in the given order
      const { limits, inner: iv } = slotLimits(card, where);
      expect(iv, `${where}: answer inner variable`).toBe(givenInner === 'y' ? 'x' : 'y');
      const swapped = cartesianRegion(limits).region;
      const cmp = symDiff(region, swapped, box, 400);
      expect(cmp.diff / area, `${where}: answer ${card.slots!.answers.join(' | ')} differs from the region by ${cmp.diff.toFixed(4)} of ${area.toFixed(4)}`).toBeLessThan(2e-3);
      const A = iteratedCartesian(given, G), B = iteratedCartesian(limits, G, 4000, 300);
      expect(Math.abs(A.area - B.area) / A.area, where).toBeLessThan(2e-3);
      expect(Math.abs(A.integral - B.integral) / Math.abs(A.integral), `${where}: ∬ g ${A.integral} vs ${B.integral}`).toBeLessThan(2e-3);
      expectFigureIs(card.figure, words!.region, words!.box, 2e-2, where);
      for (const t of card.slots!.answers) expect(card.slots!.tokens, where).toContain(t);
    });
  }
  it('swap-limits (symbols): dy dx to dx dy', () => { checkSwap('swap-limits', 'y'); }, 12000);
  it('swap-back (symbols): dx dy to dy dx', () => { checkSwap('swap-back', 'x'); }, 12000);

  it('why-exchange (no audit): exchange, with a correct new region and a correct inner integral', () => {
    eachCardById(id, 'why-exchange', (card, where) => {
      const m = match(/^I = ∬_R (sin y \/ y|e\^\{-y²\}) dA with R: 0 ≤ x ≤ (.+?), x ≤ y ≤ (.+?) \(inner variable y, order dy dx\)\./, card.prompt, where);
      const c = ev(m[2]);
      expect(close(ev(m[3]), c, 1e-12), where).toBe(true);
      const g = m[1] === 'sin y / y' ? (y: number) => Math.sin(y) / y : (y: number) => Math.exp(-y * y);
      const original: Region = (x, y) => x >= 0 && x <= c && y >= x && y <= c;
      expectOneCorrect(card, text => {
        const t = clean(text);
        const e = t.match(/^Exchange the order: R becomes 0 ≤ y ≤ (.+?), 0 ≤ x ≤ y, and the inner x-integral of (.+?) is (.+?), easy in y\.$/);
        if (!e) return false;
        const limits = parseLimits(`0 ≤ x ≤ y, 0 ≤ y ≤ ${e[1]}`);
        const same = symDiff(original, cartesianRegion(limits).region, [-0.2, c + 0.2, -0.2, c + 0.2]).diff < 1e-3;
        // the inner integral over x from 0 to y of g(y) is y g(y): compare the claimed closed form with quadrature
        const closedForm = e[3] === 'sin y' ? (y: number) => Math.sin(y) : e[3] === 'y e^{-y²}' ? (y: number) => y * Math.exp(-y * y) : null;
        if (!closedForm) throw new Error(`cannot read inner integral "${e[3]}"`);
        const innerOk = [0.3, 0.9, 1.4].every(y => close(simpson(() => g(y), 0, y, 8), closedForm(y), 1e-12));
        return same && innerOk;
      }, where);
    });
  }, 12000);

  it('constant-limits (no audit): the rectangle is the region whose inner limits do not depend on the outer variable', () => {
    eachCardById(id, 'constant-limits', (card, where) => {
      expectOneCorrect(card, t => {
        const [inner, outer] = parseLimits(t);
        expect([inner.v, outer.v], where).toEqual(['y', 'x']);
        const [olo, ohi] = [outer.lo({}), outer.hi({})];
        const samples = [0, 0.3, 0.6, 1].map(f => olo + f * (ohi - olo));
        const constant = (l: Limit) => samples.every(x => close(l.lo({ x }), l.lo({ x: samples[0] })) && close(l.hi({ x }), l.hi({ x: samples[0] })));
        return constant(inner);
      }, where);
    });
  }, 12000);
});

// ================================================================================================================== MIT-MV-35
describe('MIT-MV-35 Double Integrals in Polar Coordinates', () => {
  const id = 'MIT-MV-35';
  const polarOf = (x: number, y: number) => [Math.hypot(x, y), Math.atan2(y, x)] as const;

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch07Generators[id]), {
      'MIT-MV-35:patch-area': p => {
        const { r, dr, dth } = p as P;
        expect([0.1, 0.2, 0.5].includes(dr) && [0.1, 0.2, 0.5].includes(dth), 'Δr, Δθ ∈ {0.1, 0.2, 0.5}').toBe(true);
        // the estimate r Δr Δθ is the Riemann-sum area of the patch; the exact patch has the mid-radius r + Δr/2 as its centroid radius for the arc length
        return [r * dr * dth];
      },
      'MIT-MV-35:sector-mass': p => {
        const { R, d } = p as P;
        // polar quadrature of x y r over the sector
        const polar = simpson(th => simpson(r => r * Math.cos(th) * r * Math.sin(th) * r, 0, R, 200), 0, PI / d, 400);
        // Cartesian midpoint grid over the same sector
        const grid = gridIntegral((x, y) => x * y, (x, y) => { const [r, th] = polarOf(x, y); return r <= R && th >= 0 && th <= PI / d; }, [0, R, 0, R], 800);
        expect(Math.abs(grid - polar) / polar, `Cartesian grid ${grid} vs polar ${polar}`).toBeLessThan(1.5e-2);
        return [polar];
      },
      'MIT-MV-35:ring-integral': p => {
        const { b, c, k } = p as P;
        const polar = simpson(th => simpson(r => k * r * r * r, b, c, 200), 0, 2 * PI, 40);
        const grid = gridIntegral((x, y) => k * (x * x + y * y), (x, y) => { const s = x * x + y * y; return s >= b * b && s <= c * c; }, [-c, c, -c, c], 800);
        expect(Math.abs(grid - polar) / polar, `Cartesian grid ${grid} vs polar ${polar}`).toBeLessThan(1e-2);
        return [polar];
      },
      'MIT-MV-35:cardioid-area': p => {
        const { a, sign } = p as P;
        expect(Math.abs(sign)).toBe(1);
        const radius = (th: number) => a * (1 + sign * Math.cos(th));
        const polar = simpson(th => 0.5 * radius(th) ** 2, 0, 2 * PI, 2000); // area under a polar curve
        const grid = gridIntegral(() => 1, (x, y) => { const [r, th] = polarOf(x, y); return r <= radius(th); }, [-2 * a, 2 * a, -2 * a, 2 * a], 800);
        expect(Math.abs(grid - polar) / polar, `Cartesian grid ${grid} vs polar ${polar}`).toBeLessThan(1e-2);
        return [polar];
      },
      'MIT-MV-35:challenge': p => {
        const { a, k } = p as P;
        // polar about the origin: r from 0 to 2a cos θ, integrand k / r times r
        const polar = simpson(th => simpson(() => k, 0, 2 * a * Math.cos(th), 4), -PI / 2, PI / 2, 2000);
        // Cartesian midpoint grid with the integrable singularity at the origin (it lies on the boundary of the disk)
        const grid = gridIntegral((x, y) => k / Math.hypot(x, y), (x, y) => (x - a) ** 2 + y * y <= a * a, [0, 2 * a, -a, a], 1200);
        expect(Math.abs(grid - polar) / polar, `Cartesian grid ${grid} vs polar ${polar}`).toBeLessThan(2.5e-2);
        return [polar];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['patch-area', 'sector-mass', 'ring-integral', 'cardioid-area', 'challenge']);
  }, 12000);

  it('printed constants, signs and figures agree with the audit params; exact multiples of π are graded exactly', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-35:patch-area': {
          const m = match(/^A small polar patch is at distance r = (.+?) from the origin, with Δr = (.+?) and Δθ = (.+?) \(radians\)\. Estimate its area ΔA ≈ r Δr Δθ to 2 decimal places\./, card.prompt, where);
          expect([Number(m[1]), Number(m[2]), Number(m[3])], where).toEqual([p.r, p.dr, p.dth]);
          const f = card.fields![0];
          expect(f.tolerance, where).toBe(0.005);
          expect(Math.abs(f.answer * 100 - Math.round(f.answer * 100)), `${where}: answer rounded to 2 decimals`).toBeLessThan(1e-9);
          expect(gradeCard(card, [(p.r * p.dr * p.dth).toFixed(2)], null, []), where).toBe('correct');
          break;
        }
        case 'MIT-MV-35:sector-mass': {
          const m = match(/^A plate fills the sector 0 ≤ r ≤ (\d+), 0 ≤ θ ≤ π\/(\d+) and has density δ\(x, y\) = xy\./, card.prompt, where);
          expect([Number(m[1]), Number(m[2])], where).toEqual([p.R, p.d]);
          expect([2, 3, 4, 6].includes(p.d), where).toBe(true);
          expectFigureIs(card.figure, (x, y) => { const [r, th] = polarOf(x, y); return r <= p.R && th >= 0 && th <= PI / p.d; }, [0, p.R, 0, p.R], 1e-2, where);
          break;
        }
        case 'MIT-MV-35:ring-integral': {
          const m = match(/^Evaluate ∬_R (\d*)\(x² \+ y²\) dA over the ring R: (\d+) ≤ x² \+ y² ≤ (\d+)\./, card.prompt, where);
          expect([num(m[1]), Number(m[2]), Number(m[3])], where).toEqual([p.k, p.b * p.b, p.c * p.c]);
          expectFigureIs(card.figure, (x, y) => { const s = x * x + y * y; return s >= p.b * p.b && s <= p.c * p.c; }, [-p.c, p.c, -p.c, p.c], 1e-2, where);
          // exact multiple of π is accepted as typed
          const num2 = p.k * (p.c ** 4 - p.b ** 4);
          expect(gradeCard(card, [`${num2}pi/2`], null, []), `${where}: ${num2}pi/2`).toBe('correct');
          expect(gradeCard(card, [`${num2 + 1}pi/2`], null, []), where).toBe('incorrect');
          break;
        }
        case 'MIT-MV-35:cardioid-area': {
          const m = match(/the cardioid r = (?:(\d+)\(1 ([+-]) cos θ\)|1 ([+-]) cos θ), 0 ≤ θ ≤ 2π/, card.prompt, where);
          const printedSign = (m[2] ?? m[3]) === '+' ? 1 : -1;
          const printedA = m[1] === undefined ? 1 : Number(m[1]);
          expect([printedA, printedSign], `${where}: printed equation r = ${printedA}(1 ${m[2] ?? m[3]} cos θ)`).toEqual([p.a, p.sign]);
          if (p.a === 1) expect(m[1], `${where}: a = 1 printed without the factor`).toBeUndefined();
          // figure: the cardioid curve with its far point on the side given by the sign, area 3πa²/2
          const poly = figurePolygon(card.figure, where);
          const [x0, x1] = bbox(poly);
          if (p.sign === 1) expect(close(x1, 2 * p.a, 1e-6) && x0 > -0.5 * p.a - 1e-9, `${where}: far point at (${2 * p.a}, 0): bbox ${x0}, ${x1}`).toBe(true);
          else expect(close(x0, -2 * p.a, 1e-6) && x1 < 0.5 * p.a + 1e-9, `${where}: far point at (${-2 * p.a}, 0): bbox ${x0}, ${x1}`).toBe(true);
          expect(Math.abs(shoelace(poly) - 1.5 * PI * p.a * p.a) / (1.5 * PI * p.a * p.a), `${where}: polygon area`).toBeLessThan(5e-3);
          expectFigureIs(card.figure, (x, y) => { const [r, th] = polarOf(x, y); return r <= p.a * (1 + p.sign * Math.cos(th)); }, [-2 * p.a, 2 * p.a, -1.8 * p.a, 1.8 * p.a], 1e-2, where);
          expect(gradeCard(card, [`${3 * p.a * p.a}pi/2`], null, []), where).toBe('correct');
          break;
        }
        case 'MIT-MV-35:challenge': {
          const m = match(/^Compute ∬_R (\d*)\/√\(x² \+ y²\) dA over R, the disk inside the circle of radius (\d+) centred at \((\d+), 0\) \(that is, \(x - (\d+)\)² \+ y² ≤ (\d+)\)\./, card.prompt, where);
          expect([num(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])], where).toEqual([p.k, p.a, p.a, p.a, p.a * p.a]);
          if (card.figure) expectFigureIs(card.figure, (x, y) => (x - p.a) ** 2 + y * y <= p.a * p.a, [0, 2 * p.a, -p.a, p.a], 1e-2, where);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      expectGrading(card, where, { 'MIT-MV-35:patch-area': 0.005 });
    });
    expect(seen.size).toBe(5);
  }, 12000);

  it('area-element (no audit): the area of a small polar patch, by comparing each option with the exact patch area', () => {
    eachCardById(id, 'area-element', (card, where) => {
      const r = 2, dr = 1e-4, dth = 1e-4;
      const exact = 0.5 * ((r + dr) ** 2 - r * r) * dth;
      expectOneCorrect(card, t => {
        const value = ev(t, { r, D: dr, E: dth });
        return Math.abs(value / exact - 1) < 1e-3;
      }, where);
      // the figure's patch: two arcs and two rays, polygon area equals the exact patch area
      const poly = figurePolygon(card.figure, where);
      const [rs] = [poly.map(([x, y]) => Math.hypot(x, y))];
      const r0 = Math.min(...rs), r1 = Math.max(...rs);
      const angles = poly.map(([x, y]) => Math.atan2(y, x));
      const th = Math.max(...angles) - Math.min(...angles);
      expect(Math.abs(shoelace(poly) - 0.5 * (r1 * r1 - r0 * r0) * th) / shoelace(poly), `${where}: figure patch area`).toBeLessThan(1e-2);
    });
  }, 12000);

  it('circle-equation (no audit): the option whose curve is the circle of radius a centred at (a, 0)', () => {
    eachCardById(id, 'circle-equation', (card, where) => {
      const m = match(/^The figure shows the circle of radius (\d+) centred at C = \((\d+), 0\); it passes through the origin O\. Which polar equation/, card.prompt, where);
      const a = Number(m[1]);
      expect(Number(m[2]), where).toBe(a);
      for (const [x, y] of figurePolygonOrLine(card.figure!)) expect(close((x - a) ** 2 + y * y, a * a, 1e-9), `${where}: figure point (${x}, ${y}) on the circle`).toBe(true);
      expectOneCorrect(card, t => {
        const e = clean(t).match(/^r = (.+)$/);
        if (!e) throw new Error(`cannot read "${t}"`);
        const rf = parseExpr(e[1]);
        for (let k = 0; k < 720; k++) {
          const th = (2 * PI * k) / 720, r = rf({ θ: th });
          if (!close((r * Math.cos(th) - a) ** 2 + (r * Math.sin(th)) ** 2, a * a, 1e-9)) return false;
        }
        return true;
      }, where);
    });
  }, 12000);

  it('polar-limits (symbols): the limits, integrated numerically, cover exactly the printed region', () => {
    const kinds = new Set<string>();
    eachCardById(id, 'polar-limits', (card, where) => {
      const prompt = clean(card.prompt);
      expect(prompt, where).toContain('r is the inner variable (dr), θ the outer variable (dθ)');
      let truth: Region, box: Box, area: number;
      let m: RegExpMatchArray | null;
      if ((m = prompt.match(/R is the disk inside the circle \(x - (\d+)\)² \+ y² = (\d+)\./))) {
        const a = Number(m[1]); expect(Number(m[2]), where).toBe(a * a);
        truth = (x, y) => (x - a) ** 2 + y * y <= a * a; box = [-0.2, 2 * a + 0.2, -a - 0.2, a + 0.2]; area = PI * a * a; kinds.add('disk');
      } else if ((m = prompt.match(/R is the sector of the disk x² \+ y² ≤ (\d+) between the positive x-axis and the ray at angle π\/(\d+) from it\./))) {
        const R = Math.sqrt(Number(m[1])), d = Number(m[2]);
        expect(Number.isInteger(R), where).toBe(true);
        truth = (x, y) => { const [r, th] = polarOf(x, y); return r <= R && th >= 0 && th <= PI / d; }; box = [-0.2, R + 0.2, -0.2, R + 0.2]; area = (R * R / 2) * (PI / d); kinds.add('sector');
      } else if ((m = prompt.match(/R is the region (\d+) ≤ x ≤ (\d+), 0 ≤ y ≤ x\./))) {
        const [lo, hi] = [Number(m[1]), Number(m[2])];
        truth = (x, y) => x >= lo && x <= hi && y >= 0 && y <= x; box = [0, hi + 0.2, -0.2, hi + 0.2]; area = (hi * hi - lo * lo) / 2; kinds.add('strip');
      } else if ((m = prompt.match(/R is the ring between the circles r = (\d+) and r = (\d+), once around the origin\./))) {
        const [b, c] = [Number(m[1]), Number(m[2])];
        truth = (x, y) => { const r = Math.hypot(x, y); return r >= b && r <= c; }; box = [-c - 0.2, c + 0.2, -c - 0.2, c + 0.2]; area = PI * (c * c - b * b); kinds.add('ring');
      } else if ((m = prompt.match(/R is the region inside the cardioid r = (?:(\d+)\(1 \+ cos θ\)|1 \+ cos θ)\./))) {
        const a = m[1] === undefined ? 1 : Number(m[1]);
        truth = (x, y) => { const [r, th] = polarOf(x, y); return r <= a * (1 + Math.cos(th)); }; box = [-0.5 * a - 0.2, 2 * a + 0.2, -1.8 * a, 1.8 * a]; area = 1.5 * PI * a * a; kinds.add('cardioid');
      } else throw new Error(`${where}: region not recognised: ${prompt}`);
      const { limits, inner, outer } = slotLimits(card, where);
      expect([inner, outer], where).toEqual(['r', 'θ']);
      const [rl, tl] = limits;
      const [tlo, thi] = [tl.lo({}), tl.hi({})];
      const region: Region = (x, y) => {
        const [r, th0] = polarOf(x, y);
        return [-1, 0, 1].some(k => { const th = th0 + 2 * PI * k; return th >= tlo && th <= thi && r >= rl.lo({ θ: th }) && r <= rl.hi({ θ: th }); });
      };
      const cmp = symDiff(truth, region, box, 500);
      expect(cmp.diff / area, `${where}: limits ${card.slots!.answers.join(' | ')} differ from the region by ${cmp.diff.toFixed(4)} of ${area.toFixed(4)}`).toBeLessThan(2e-3);
      // area element r dr dθ over the limits equals the area of the region, and a test function integrates the same
      const A = simpson(th => (rl.hi({ θ: th }) ** 2 - rl.lo({ θ: th }) ** 2) / 2, tlo, thi, 4000);
      expect(Math.abs(A - area) / area, `${where}: ∬ r dr dθ over the limits ${A} vs ${area}`).toBeLessThan(1e-6);
      const g = (x: number, y: number) => 1 + 0.5 * x + 0.3 * y * y;
      const polarInt = simpson(th => simpson(r => g(r * Math.cos(th), r * Math.sin(th)) * r, rl.lo({ θ: th }), rl.hi({ θ: th }), 200), tlo, thi, 1000);
      const ref = gridIntegral(g, truth, box, 900);
      expect(Math.abs(polarInt - ref) / Math.abs(ref), `${where}: test integral ${polarInt} vs ${ref}`).toBeLessThan(1e-2);
      expectFigureIs(card.figure, truth, box, 2e-2, where);
      for (const t of card.slots!.answers) expect(card.slots!.tokens, where).toContain(t);
    });
    expect([...kinds].sort(), 'all five region forms occur').toEqual(['cardioid', 'disk', 'ring', 'sector', 'strip']);
  }, 12000);

  it('negative-r (no audit): the integral of r over [−R, R] is zero', () => {
    eachCardById(id, 'negative-r', (card, where) => {
      const m = match(/the disk r ≤ (\d+) and computes ∫₀\^\(2π\) ∫_\(-(\d+)\)\^\((\d+)\) r dr dθ/, card.prompt, where);
      const R = Number(m[1]);
      expect([Number(m[2]), Number(m[3])], where).toEqual([R, R]);
      const value = simpson(() => simpson(r => r, -R, R, 100), 0, 2 * PI, 10);
      expectOneCorrect(card, t => {
        const e = clean(t).match(/^The integral is ([^:,]+)[:,]/);
        if (!e) throw new Error(`cannot read "${t}"`);
        return close(ev(e[1]), value, 1e-9);
      }, where);
    });
  }, 12000);
});

/** All points of a figure's single polyline (the circle outline). */
function figurePolygonOrLine(figure: Figure): Pt[] {
  const lines = figure.shapes.filter(s => s.kind === 'line') as { points: Pt[] }[];
  expect(lines.length).toBeGreaterThan(0);
  return lines.flatMap(l => l.points);
}
