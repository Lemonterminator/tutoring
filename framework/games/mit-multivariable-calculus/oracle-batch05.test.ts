import { describe, expect, it } from 'vitest';
import { asVec, centralDiff, close, runOracle, type Oracle } from './oracle-harness';
import { spreadSeed } from './deck-invariants';
import { batch05Generators } from './batch05';
import { gradeCard, type CardGenerator, type PracticeCard } from '../types';

/**
 * Independent oracles for MIT-MV-21 (least squares), MIT-MV-22 (second derivative test), MIT-MV-23 (total differential, chain rule),
 * MIT-MV-24 (chain rule, more variables) and MIT-MV-25 (gradient and level curves).
 * Written from audit-notes/batch05.md and the printed question text only. Rules of the road:
 *  - least squares: D(a, b) is built from the data and minimised by Newton's method on finite-difference gradient/Hessian
 *    (never the normal-equation formulas); the four sums are recovered from finite differences of D itself;
 *  - second partials, discriminants, gradients and chain-rule derivatives come from Romberg-extrapolated central differences
 *    (exact for polynomials of degree <= 8); composite functions are composed numerically and then differentiated;
 *  - critical points come from Newton's method started on a grid; classification is by scanning rings around the point;
 *  - level-curve slopes solve f(x, y) = f(P) for y numerically; perpendicularity is tested against a tangent vector measured
 *    on a tiny ring around P.
 * Every audit kind also has its PRINTED polynomials, points and increments parsed from the prompt and compared with the audit
 * params, so an oracle cannot audit a different problem from the one the learner sees. Seeds are spread (tiny seeds give
 * near-constant LCG draws).
 */

// ------------------------------------------------------------------------------------------------------------------ helpers
const SEEDS = 60;
const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(spreadSeed(seed), lang);
type P = Record<string, number>;
type Fn1 = (x: number) => number;
type Fn2 = (x: number, y: number) => number;
type Fn3 = (x: number, y: number, z: number) => number;
type FnN = (v: number[]) => number;
const clean = (s: string) => s.replace(/−/g, '-').replace(/[  ]/g, ' ');
/** Number as printed after clean(): -3, 2, 0.5. */
const n = (v: number) => (Math.abs(v) < 5e-7 ? '0' : String(Number(v.toFixed(6))));
const hasPoint = (prompt: string, ...coords: number[]) => clean(prompt).includes(`(${coords.map(n).join(', ')})`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Central-difference derivative with Romberg extrapolation over h, h/2, h/4, h/8: exact for polynomials up to degree 8. */
function deriv(f: Fn1, x: number, h = 1): number {
  const R: number[][] = [];
  for (let j = 0; j < 4; j++) {
    R[j] = [centralDiff(f, x, h / 2 ** j)];
    for (let k = 1; k <= j; k++) R[j][k] = (4 ** k * R[j][k - 1] - R[j - 1][k - 1]) / (4 ** k - 1);
  }
  return R[3][3];
}
const at = (v: number[], i: number, s: number) => v.map((c, j) => (j === i ? s : c));
const partial = (f: FnN, v: number[], i: number, h = 1) => deriv(s => f(at(v, i, s)), v[i], h);
const gradient = (f: FnN, v: number[], h = 1) => v.map((_, i) => partial(f, v, i, h));
/** H[i][j] = ∂/∂x_i (∂f/∂x_j). */
const hessian = (f: FnN, v: number[], h = 1) => v.map((_, i) => v.map((__, j) => deriv(s => partial(f, at(v, i, s), j, h), v[i], h)));
const f2 = (f: Fn2): FnN => v => f(v[0], v[1]);
const f3 = (f: Fn3): FnN => v => f(v[0], v[1], v[2]);

/** Newton's method on the finite-difference gradient/Hessian of f(x, y); null when it does not converge to a critical point. */
function newtonCritical(f: Fn2, x: number, y: number): [number, number] | null {
  const F = f2(f);
  for (let it = 0; it < 80; it++) {
    const g = gradient(F, [x, y]), H = hessian(F, [x, y]);
    const det = H[0][0] * H[1][1] - H[0][1] * H[1][0];
    if (!(Math.abs(det) > 1e-9)) return null;
    const dx = (H[1][1] * g[0] - H[0][1] * g[1]) / det, dy = (H[0][0] * g[1] - H[1][0] * g[0]) / det;
    x -= dx; y -= dy;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e3 || Math.abs(y) > 1e3) return null;
    if (Math.hypot(dx, dy) < 1e-13) break;
  }
  return Math.hypot(...gradient(F, [x, y])) < 1e-7 ? [x, y] : null;
}
/** All critical points of f found by Newton's method from a grid of starting points, de-duplicated. */
const criticalCache = new Map<string, [number, number][]>();
function criticalPoints(f: Fn2): [number, number][] {
  // the same function is audited by several cards of one deck: key the cache by its values on a probe grid
  const key = POINTS[2].map(([x, y]) => f(x, y).toFixed(9)).join('|');
  const cached = criticalCache.get(key);
  if (cached) return cached;
  const found: [number, number][] = [];
  for (const sx of [-6.3, -3.1, -1.2, 0.4, 2.3, 4.9, 7.1]) for (const sy of [-5.7, -2.9, -0.6, 1.3, 3.4, 6.2]) {
    const r = newtonCritical(f, sx, sy);
    if (r && !found.some(q => Math.hypot(q[0] - r[0], q[1] - r[1]) < 1e-6)) found.push(r);
  }
  criticalCache.set(key, found);
  return found;
}
/** Classify the critical point (px, py) of f by scanning rings of the given radii around it. */
function ringClass(f: Fn2, px: number, py: number, radii: number[], eps = 1e-9): 'min' | 'max' | 'saddle' {
  let pos = false, neg = false;
  const f0 = f(px, py);
  for (const r of radii) for (let k = 0; k < 90; k++) {
    const t = (2 * Math.PI * k) / 90;
    const diff = f(px + r * Math.cos(t), py + r * Math.sin(t)) - f0;
    if (diff > eps) pos = true;
    if (diff < -eps) neg = true;
  }
  expect(pos || neg, `degenerate point (${px}, ${py}) in the ring scan`).toBe(true);
  return pos && neg ? 'saddle' : pos ? 'min' : 'max';
}
const SUPS: Record<string, number> = { '²': 2, '³': 3, '⁴': 4 };
/** "−2x³ + 2xy² − x + 3" into a function of named variables. Throws on anything it cannot read. */
function parsePoly(src: string): (v: Record<string, number>) => number {
  const s = clean(src).replace(/\s+/g, '');
  const pieces = s.match(/[+-]?[^+-]+/g);
  if (!pieces || pieces.join('') !== s) throw new Error(`cannot split polynomial "${src}"`);
  const terms = pieces.map(piece => {
    const m = piece.match(/^([+-]?)(\d*\.?\d*)((?:[a-z](?:\^\d+|[²³⁴])?)*)$/);
    if (!m) throw new Error(`cannot parse term "${piece}" of "${src}"`);
    if (m[2] === '' && m[3] === '') throw new Error(`empty term in "${src}"`);
    const powers: Record<string, number> = {};
    for (const g of m[3].matchAll(/([a-z])(\^\d+|[²³⁴])?/g)) powers[g[1]] = (powers[g[1]] ?? 0) + (g[2] === undefined ? 1 : g[2][0] === '^' ? Number(g[2].slice(1)) : SUPS[g[2]]);
    return { coef: (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])), powers: Object.entries(powers) };
  });
  return v => terms.reduce((acc, t) => acc + t.coef * t.powers.reduce((p, [name, e]) => p * v[name] ** e, 1), 0);
}
/** The polynomial printed after "<label> = " in the prompt, using only the variable letters `vars`. */
function printedPoly(prompt: string, label: string, vars: string) {
  const m = clean(prompt).match(new RegExp(`(?<![A-Za-z_(])${label}\\s*=\\s*([0-9${vars}²³⁴^ +\\-]+)`));
  if (!m) throw new Error(`no "${label} = ..." in: ${prompt}`);
  return parsePoly(m[1].trim());
}
const POINTS: Record<number, number[][]> = {
  1: [[-2], [-1], [0], [1], [2], [0.5], [3], [-1.7]],
  2: [[0, 0], [1, 0], [0, 1], [1, 1], [-2, 3], [2.5, -1.5], [3, 3], [-1, -2], [0.7, 1.9]],
  3: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [-2, 3, 0.5], [2.5, -1.5, 2], [-1, -2, 3], [0.7, 1.9, -1.1]],
};
/** Fails when the printed function of variables `names` is not the function `expected`. */
function expectSame(printed: (v: Record<string, number>) => number, names: string[], expected: (...a: number[]) => number, where: string) {
  for (const pt of POINTS[names.length]) {
    const got = printed(Object.fromEntries(names.map((nm, i) => [nm, pt[i]])));
    expect(close(got, expected(...pt), 1e-9), `${where}: printed function gives ${got} at ${JSON.stringify(pt)}, params give ${expected(...pt)}`).toBe(true);
  }
}
/** The integer pairs/triples "(1, 0), (2, 0)" in a text, in order. */
const intTuples = (text: string, arity: number) => [...clean(text).matchAll(new RegExp(`\\((${Array(arity).fill('-?\\d+').join(', ')})\\)`, 'g'))].map(m => m[1].split(', ').map(Number));

/** Every audited card of every spread seed of game `id` (English). */
function eachAudited(id: string, fn: (card: PracticeCard, where: string) => void) {
  const seen = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch05Generators[id](seed, 'en')) if (card.audit) { fn(card, `${card.id} seed ${seed} params ${JSON.stringify(card.audit.params)}`); seen.add(card.audit.kind); }
  }
  return seen;
}
function eachCardById(id: string, cardId: string, fn: (card: PracticeCard, where: string) => void) {
  let count = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch05Generators[id](seed, 'en')) if (card.id === `${id}-${cardId}`) { fn(card, `${card.id} seed ${seed}`); count++; }
  }
  expect(count, `${cardId}: no cards seen`).toBe(SEEDS);
}
const expectKinds = (counts: Record<string, number>, id: string, kinds: string[]) => {
  expect(Object.keys(counts).sort()).toEqual(kinds.map(k => `${id}:${k}`).sort());
  for (const k of kinds) expect(counts[`${id}:${k}`], `${k} count`).toBe(SEEDS);
};
/** Every field of the card has the tolerance (undefined = harness default 1e-8) the notes prescribe for its kind. */
function expectTolerances(card: PracticeCard, where: string, tolerance: number | undefined) {
  for (const field of card.fields!) expect(field.tolerance, `${where}: field "${field.label}" tolerance`).toBe(tolerance);
}
const optionsOf = (card: PracticeCard) => card.choice!.options;
/** Exactly one option passes `verdict` and it is the card's answer. */
function expectOneCorrect(card: PracticeCard, where: string, verdict: (text: string) => boolean) {
  const verdicts = optionsOf(card).map(verdict);
  expect(verdicts.filter(Boolean).length, `${where}: exactly one correct option, options ${JSON.stringify(optionsOf(card))}`).toBe(1);
  expect(verdicts[card.choice!.answer], `${where}: card answer index ${card.choice!.answer} of ${JSON.stringify(optionsOf(card))}`).toBe(true);
}

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-21
describe('MIT-MV-21 least squares', () => {
  const id = 'MIT-MV-21';
  const XSETS = [[0, 1, 2, 3], [-1, 0, 1, 2], [1, 2, 3, 4], [-3, -1, 1, 3], [0, 2, 4, 6]];
  /** D(a, b) = Σ (y_i − (a x_i + b))² built from the data. */
  const Dof = (xs: number[], ys: number[]): Fn2 => (a, b) => xs.reduce((s, x, i) => s + (ys[i] - (a * x + b)) ** 2, 0);
  /** Minimise D by Newton's method on finite-difference gradient and Hessian, then confirm a strict local minimum by a ring scan. */
  function minimise(xs: number[], ys: number[]): [number, number] {
    const D = Dof(xs, ys);
    const r = newtonCritical(D, 0.3, -0.2);
    expect(r, 'Newton found no critical point of D').not.toBeNull();
    const [a, b] = r!;
    expect(ringClass(D, a, b, [0.01, 0.1, 1, 5]), 'D must have a minimum there').toBe('min');
    return [a, b];
  }
  const dGrad = (xs: number[], ys: number[], a: number, b: number) => gradient(f2(Dof(xs, ys)), [a, b]);

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch05Generators[id]), {
      'MIT-MV-21:sum-squares': p => { const { a, b } = p as P; return [Dof(asVec(p.xs), asVec(p.ys))(a, b)]; },
      'MIT-MV-21:compare-lines': p => {
        const DA = sum(asVec(p.devA).map(v => v * v)), DB = sum(asVec(p.devB).map(v => v * v));
        expect(Math.abs(DA - DB), 'the two D values differ by at least 3').toBeGreaterThanOrEqual(3);
        return { optionIsCorrect: text => (text === 'Line A' ? DA < DB : text === 'Line B' ? DB < DA : text.startsWith('Neither') ? DA === DB : (() => { throw new Error(`unknown option ${text}`); })()) };
      },
      'MIT-MV-21:gradient-of-D': p => {
        const g = dGrad(asVec(p.xs), asVec(p.ys), (p as P).a, (p as P).b);
        expect(Math.abs(g[0]) + Math.abs(g[1]), 'never both 0').toBeGreaterThan(1e-9);
        return g;
      },
      'MIT-MV-21:normal-sums': p => {
        // Recover the four sums from finite differences of D itself: D_a = 2(Sxx a + Sx b − Sxy), D_b = 2(Sx a + n b − Sy).
        const xs = asVec(p.xs), ys = asVec(p.ys);
        const ga = (a: number, b: number) => dGrad(xs, ys, a, b)[0], gb = (a: number, b: number) => dGrad(xs, ys, a, b)[1];
        const Sxy = -ga(0, 0) / 2, Sy = -gb(0, 0) / 2;
        const Sxx = Sxy + ga(1, 0) / 2, Sx = Sxy + ga(0, 1) / 2;
        expect(close(Sy + gb(0, 1) / 2, xs.length, 1e-9), 'n recovered from D_b').toBe(true);
        expect(close(Sx, Sy + gb(1, 0) / 2, 1e-9), 'Σx recovered from D_a and from D_b').toBe(true);
        return [Sxx, Sx, Sxy, Sy];
      },
      'MIT-MV-21:least-squares-line': p => {
        const [a, b] = minimise(asVec(p.xs), asVec(p.ys));
        expect(close(a * 20, Math.round(a * 20), 1e-9) && close(b * 20, Math.round(b * 20), 1e-9), `a = ${a}, b = ${b} must be multiples of 0.05`).toBe(true);
        expect(Math.abs(a) > 1e-9 && Math.abs(b) > 1e-9, 'a and b are non-zero').toBe(true);
        return [a, b];
      },
      'MIT-MV-21:minimum-d': p => {
        const xs = asVec(p.xs), ys = asVec(p.ys);
        const [a, b] = minimise(xs, ys);
        expect(close(a, (p as P).a, 1e-9) && close(b, (p as P).b, 1e-9), `params (a, b) = (${(p as P).a}, ${(p as P).b}) must be the minimiser (${a}, ${b})`).toBe(true);
        const dmin = Dof(xs, ys)(a, b);
        expect(dmin, 'minimum D at least 1').toBeGreaterThanOrEqual(1 - 1e-9);
        expect(close(dmin * 100, Math.round(dmin * 100), 1e-7), `exact minimum ${dmin} has at most 2 decimals`).toBe(true);
        return [dmin];
      },
      'MIT-MV-21:challenge': p => {
        const [a, b] = minimise(asVec(p.xs), asVec(p.ys));
        return [a, b];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['sum-squares', 'compare-lines', 'gradient-of-D', 'normal-sums', 'least-squares-line', 'minimum-d', 'challenge']);
  }, 12000);

  it('printed data, lines and deviations agree with the audit params; tolerances follow the notes', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params;
      const prompt = clean(card.prompt);
      const num = (k: string) => (p as P)[k];
      if (p.xs) {
        const xs = asVec(p.xs), ys = asVec(p.ys);
        expect(XSETS.some(s => s.join() === xs.join()), `${where}: x-set`).toBe(true);
        expect(ys.length === 4 && ys.every(y => Number.isInteger(y) && y >= 0 && y <= 6), `${where}: ys integers in 0..6`).toBe(true);
        expect(intTuples(prompt, 2), `${where}: printed data points`).toEqual(xs.map((x, i) => [x, ys[i]]));
      }
      switch (card.audit!.kind) {
        case 'MIT-MV-21:sum-squares': {
          const m = prompt.match(/line y = (.+?), that is a = (-?\d+(?:\.\d+)?) and b = (-?\d+(?:\.\d+)?) in/);
          expect(m, `${where}: line not printed`).not.toBeNull();
          expect([Number(m![2]), Number(m![3])], where).toEqual([num('a'), num('b')]);
          expectSame(parsePoly(m![1]), ['x'], x => num('a') * x + num('b'), where);
          expectTolerances(card, where, undefined);
          break;
        }
        case 'MIT-MV-21:compare-lines': {
          const m = prompt.match(/Line A: \(([^)]*)\)\. Line B: \(([^)]*)\)\./);
          expect(m, `${where}: deviation vectors not printed`).not.toBeNull();
          expect(m![1].split(', ').map(Number), where).toEqual(asVec(p.devA));
          expect(m![2].split(', ').map(Number), where).toEqual(asVec(p.devB));
          const isAlt = (v: number[]) => v[0] !== 0 && v[1] === -v[0] && v[2] === v[0] && v[3] === -v[0] && Math.abs(v[0]) <= 3;
          expect(isAlt(asVec(p.devA)) || isAlt(asVec(p.devB)), `${where}: one line has deviations (p, −p, p, −p)`).toBe(true);
          expect([...card.choice!.options].sort(), where).toEqual(['Line A', 'Line B', 'Neither: both lines have the same D.'].sort());
          break;
        }
        case 'MIT-MV-21:gradient-of-D': {
          const m = prompt.match(/at a = (-?\d+(?:\.\d+)?), b = (-?\d+(?:\.\d+)?), the line y = (.+?)\./);
          expect(m, `${where}: trial line not printed`).not.toBeNull();
          expect([Number(m![1]), Number(m![2])], where).toEqual([num('a'), num('b')]);
          expectSame(parsePoly(m![3]), ['x'], x => num('a') * x + num('b'), where);
          expect(card.fields!.map(f => f.label), where).toEqual(['∂D/∂a', '∂D/∂b']);
          expectTolerances(card, where, undefined);
          break;
        }
        case 'MIT-MV-21:normal-sums':
          expect(prompt, where).toContain('n = 4');
          expect(card.fields!.map(f => f.label), where).toEqual(['Σxᵢ²', 'Σxᵢ', 'Σxᵢyᵢ', 'Σyᵢ']);
          expectTolerances(card, where, undefined);
          break;
        case 'MIT-MV-21:least-squares-line': case 'MIT-MV-21:challenge':
          expect(card.fields!.map(f => f.label), where).toEqual(['a', 'b']);
          expectTolerances(card, where, undefined);
          break;
        case 'MIT-MV-21:minimum-d': {
          const m = prompt.match(/least-squares line is y = (.+?), that is a = (-?\d+(?:\.\d+)?) and b = (-?\d+(?:\.\d+)?)\./);
          expect(m, `${where}: least-squares line not printed`).not.toBeNull();
          expect([Number(m![2]), Number(m![3])], where).toEqual([num('a'), num('b')]);
          expectSame(parsePoly(m![1]), ['x'], x => num('a') * x + num('b'), where);
          expect(prompt, where).toContain('2 decimal places');
          expectTolerances(card, where, 0.005);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(7);
  }, 12000);

  it('the challenge uses a different x-set from the main data; deviation figure draws the printed data and line', () => {
    for (let i = 0; i < SEEDS; i++) {
      const cards = batch05Generators[id](spreadSeed(i), 'en');
      const main = asVec(cards.find(c => c.id === `${id}-solve-line`)!.audit!.params.xs).join();
      const challenge = asVec(cards.find(c => c.id === `${id}-challenge`)!.audit!.params.xs).join();
      expect(challenge, `seed ${spreadSeed(i)}: challenge x-set equals the main x-set`).not.toBe(main);
      const dev = cards.find(c => c.id === `${id}-deviation`)!;
      const { xs, ys, a, b } = dev.audit!.params as Record<string, number | number[]> & { a: number; b: number };
      const shapes = dev.figure!.shapes;
      const px = asVec(xs), py = asVec(ys);
      const dots = shapes.filter(s => s.kind === 'point').map(s => (s as { at: readonly [number, number] }).at);
      expect(dots, `seed ${spreadSeed(i)}: data points in the figure`).toEqual(px.map((x, k) => [x, py[k]]));
      const solid = shapes.filter(s => s.kind === 'line' && !(s as { dash?: boolean }).dash) as unknown as { points: [number, number][] }[];
      expect(solid.length).toBe(1);
      for (const [x, y] of solid[0].points) expect(close(y, a * x + b, 1e-9), `seed ${spreadSeed(i)}: line vertex (${x}, ${y})`).toBe(true);
      const dashed = shapes.filter(s => s.kind === 'line' && (s as { dash?: boolean }).dash) as unknown as { points: [number, number][] }[];
      const expectedDashed = px.map((x, k) => ({ x, y1: py[k], y2: a * x + b })).filter(s => Math.abs(s.y1 - s.y2) > 1e-9);
      expect(dashed.length, `seed ${spreadSeed(i)}: one dashed segment per non-zero deviation`).toBe(expectedDashed.length);
      for (const seg of expectedDashed) {
        expect(dashed.some(d => d.points.every(([x]) => x === seg.x) && d.points.some(([, y]) => close(y, seg.y1, 1e-9)) && d.points.some(([, y]) => close(y, seg.y2, 1e-9))), `seed ${spreadSeed(i)}: segment at x = ${seg.x}`).toBe(true);
      }
    }
  }, 12000);

  it('grader behaviour: fractions with denominator dividing 20 are accepted, off-by-0.05 rejected; minimum-d accepts any 2-decimal rounding of the exact value', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        const where = `${card.id} seed ${spreadSeed(i)}`;
        if (card.audit?.kind === 'MIT-MV-21:least-squares-line' || card.audit?.kind === 'MIT-MV-21:challenge') {
          const [a, b] = minimise(asVec(card.audit.params.xs), asVec(card.audit.params.ys));
          const fr = (v: number) => `${Math.round(v * 20)}/20`;
          expect(gradeCard(card, [fr(a), fr(b)], null, []), `${where}: fractions ${fr(a)}, ${fr(b)}`).toBe('correct');
          expect(gradeCard(card, [String(Math.round(a * 20) / 20), String(Math.round(b * 20) / 20)], null, []), `${where}: decimals`).toBe('correct');
          expect(gradeCard(card, [String(a + 0.05), String(b)], null, []), where).toBe('incorrect');
          expect(gradeCard(card, [String(a), String(b - 0.05)], null, []), where).toBe('incorrect');
          if (Math.abs(a - b) > 1e-6) expect(gradeCard(card, [String(b), String(a)], null, []), `${where}: swapped a and b`).toBe('incorrect');
        }
        if (card.audit?.kind === 'MIT-MV-21:minimum-d') {
          const [a, b] = minimise(asVec(card.audit.params.xs), asVec(card.audit.params.ys));
          const dmin = Dof(asVec(card.audit.params.xs), asVec(card.audit.params.ys))(a, b);
          expect(gradeCard(card, [dmin.toFixed(2)], null, []), `${where}: ${dmin.toFixed(2)}`).toBe('correct');
          expect(gradeCard(card, [(dmin + 0.004).toFixed(3)], null, []), where).toBe('correct');
          expect(gradeCard(card, [(dmin - 0.004).toFixed(3)], null, []), where).toBe('correct');
          expect(gradeCard(card, [(dmin + 0.01).toFixed(2)], null, []), where).toBe('incorrect');
          expect(gradeCard(card, [(dmin - 0.01).toFixed(2)], null, []), where).toBe('incorrect');
          // the trial-line D of the first card is a different number (the learner must not be able to reuse it)
          const trialD = Dof(asVec(card.audit.params.xs), asVec(card.audit.params.ys));
          expect(trialD(a, b)).toBeLessThanOrEqual(trialD(a + 0.05, b) + 1e-12);
        }
      }
    }
  }, 12000);

  it('which-fit (no audit): only the option that is linear in its unknown coefficients can be fitted', () => {
    // each formula as a function of its coefficient vector θ and x; linearity in θ is tested numerically
    const formulas: Record<string, (t: number[], x: number) => number> = {
      'y = a₀ + a₁x + a₂x²': (t, x) => t[0] + t[1] * x + t[2] * x * x,
      'y = a₀ + a₁x + a₂/x': (t, x) => t[0] + t[1] * x + t[2] / x,
      'y = a₀ + a₁eˣ': (t, x) => t[0] + t[1] * Math.exp(x),
      'y = a₁x + a₂x³': (t, x) => t[0] * x + t[1] * x ** 3,
      'y = a₀ + a₁/x': (t, x) => t[0] + t[1] / x,
      'y = a₀ + a₁x + a₂x² + a₃x³': (t, x) => t[0] + t[1] * x + t[2] * x * x + t[3] * x ** 3,
      'y = c·e^(kx)': (t, x) => t[0] * Math.exp(t[1] * x),
      'y = a·sin(bx)': (t, x) => t[0] * Math.sin(t[1] * x),
      'y = a·x^b': (t, x) => t[0] * x ** t[1],
      'y = a/(1 + bx)': (t, x) => t[0] / (1 + t[1] * x),
      'y = a₀ + a₁e^(kx)': (t, x) => t[0] + t[1] * Math.exp(t[2] * x),
      'y = a₀ + a₁x + a₂sin(bx)': (t, x) => t[0] + t[1] * x + t[2] * Math.sin(t[3] * x),
      'y = a₀ + a₁x^b': (t, x) => t[0] + t[1] * x ** t[2],
    };
    const sizes: Record<string, number> = {
      'y = a₀ + a₁x + a₂x²': 3, 'y = a₀ + a₁x + a₂/x': 3, 'y = a₀ + a₁eˣ': 2, 'y = a₁x + a₂x³': 2, 'y = a₀ + a₁/x': 2, 'y = a₀ + a₁x + a₂x² + a₃x³': 4,
      'y = c·e^(kx)': 2, 'y = a·sin(bx)': 2, 'y = a·x^b': 2, 'y = a/(1 + bx)': 2, 'y = a₀ + a₁e^(kx)': 3, 'y = a₀ + a₁x + a₂sin(bx)': 4, 'y = a₀ + a₁x^b': 3,
    };
    const linearInCoefficients = (text: string) => {
      const F = formulas[text];
      if (!F) throw new Error(`unknown trial function ${text}`);
      const k = sizes[text];
      const t1 = Array.from({ length: k }, (_, i) => 0.4 + 0.37 * i), t2 = Array.from({ length: k }, (_, i) => 1.3 - 0.21 * i);
      return [0.5, 1.2, 2.3].every(x => {
        const mix = t1.map((v, i) => 0.7 * v + 1.9 * t2[i]);
        return close(F(mix, x), 0.7 * F(t1, x) + 1.9 * F(t2, x), 1e-10);
      });
    };
    eachCardById(id, 'which-fit', (card, where) => expectOneCorrect(card, where, linearInCoefficients));
  }, 12000);

  it('vertical (no audit): the correct option is the data set with n·Σx² − (Σx)² = 0 (all x equal)', () => {
    eachCardById(id, 'vertical', (card, where) => {
      const det = (text: string) => { const pts = intTuples(text, 2); expect(pts.length, `${where}: ${text}`).toBe(3); const xs = pts.map(q => q[0]); return xs.length * sum(xs.map(x => x * x)) - sum(xs) ** 2; };
      expectOneCorrect(card, where, text => det(text) === 0);
      for (const [i, text] of optionsOf(card).entries()) if (i !== card.choice!.answer) expect(det(text), `${where}: wrong option ${text} must have positive determinant`).toBeGreaterThan(0);
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-22
describe('MIT-MV-22 second derivative test', () => {
  const id = 'MIT-MV-22';
  const Gfn = (p: P): Fn2 => (x, y) => p.a * x ** 3 + p.b * x * y * y + p.c * x * x + p.d * x * y + p.e * y * y;
  const Qfn = (p: P): Fn2 => (x, y) => p.a * x * x + p.b * x * y + p.c * y * y + p.d * x + p.e * y;
  const Cfn = (p: P): Fn2 => (x, y) => p.p * x ** 3 + p.p * y ** 3 + p.c * x * y;
  const Ffn = (p: P): Fn2 => (x, y) => p.s * x ** 4 + p.t * y ** 4;
  const Hfn = (p: P): Fn2 => (x, y) => p.q * (p.k * x * y - x * x * y - x * y * y);
  const hess2 = (f: Fn2, x: number, y: number) => { const H = hessian(f2(f), [x, y]); return { A: H[0][0], B: H[0][1], C: H[1][1], Byx: H[1][0] }; };
  /** Classify a symmetric form A h² + 2B hk + C k² by its eigenvalues (closed form of a 2x2 symmetric matrix). */
  function formClass(A: number, B: number, C: number): 'min' | 'max' | 'saddle' | 'fails' {
    const mid = (A + C) / 2, rad = Math.hypot((A - C) / 2, B);
    const l1 = mid - rad, l2 = mid + rad;
    const tiny = 1e-9 * Math.max(1, Math.abs(l1), Math.abs(l2));
    if (Math.abs(l1) < tiny || Math.abs(l2) < tiny) return 'fails';
    return l1 > 0 ? 'min' : l2 < 0 ? 'max' : 'saddle';
  }
  const WORDS = { min: 'minimum', max: 'maximum', saddle: 'saddle' } as const;
  const judgeWords = (cls: 'min' | 'max' | 'saddle' | 'fails') => (text: string) => {
    if (text.startsWith('The test fails')) return cls === 'fails';
    if (text.startsWith('A minimum point')) return cls === 'min';
    if (text.startsWith('A maximum point')) return cls === 'max';
    if (text.startsWith('A saddle point')) return cls === 'saddle';
    throw new Error(`unknown option "${text}"`);
  };
  /** "(0, 0) is a saddle point and P is a minimum point." -> classes of (0, 0) and P. */
  function twoClasses(text: string): ['min' | 'max' | 'saddle', 'min' | 'max' | 'saddle'] {
    const word = (w: string) => (w === 'minimum' ? 'min' : w === 'maximum' ? 'max' : 'saddle') as 'min' | 'max' | 'saddle';
    if (text === 'Both (0, 0) and P are saddle points.') return ['saddle', 'saddle'];
    const m = text.match(/^\(0, 0\) is a (minimum|maximum|saddle) point and P is a (minimum|maximum|saddle) point\.$/);
    if (!m) throw new Error(`cannot read option "${text}"`);
    return [word(m[1]), word(m[2])];
  }

  it('recomputes every audit kind', () => {
    void WORDS;
    const counts = runOracle(id, spread(batch05Generators[id]), {
      'MIT-MV-22:second-partials': p => {
        const q = p as P;
        expect(q.a !== 0 && q.b !== 0, 'a and b non-zero').toBe(true);
        const { A, B, C, Byx } = hess2(Gfn(q), q.x0, q.y0);
        expect(close(B, Byx, 1e-9), `mixed partials differ by order: ${B} vs ${Byx}`).toBe(true);
        return [A, B, C];
      },
      'MIT-MV-22:classify-abc': p => {
        const { A, B, C } = p as P;
        const cls = formClass(A, B, C);
        // cross-check non-degenerate forms by scanning the unit circle of the quadratic form
        if (cls !== 'fails') {
          const form = (h: number, k: number) => A * h * h + 2 * B * h * k + C * k * k;
          expect(ringClass(form, 0, 0, [1, 0.3]), `A=${A}, B=${B}, C=${C}`).toBe(cls);
        }
        return { optionIsCorrect: judgeWords(cls) };
      },
      'MIT-MV-22:classify-quadratic': p => {
        const q = p as P;
        const f = Qfn(q);
        const crit = criticalPoints(f);
        expect(crit.length, 'a quadratic with 4ac ≠ b² has exactly one critical point').toBe(1);
        const [x, y] = crit[0];
        expect(Number.isInteger(Math.round(x)) && close(x, Math.round(x), 1e-7) && close(y, Math.round(y), 1e-7) && Math.abs(Math.round(x)) <= 2 && Math.abs(Math.round(y)) <= 2, `critical point (${x}, ${y}) integer in −2..2`).toBe(true);
        const cls = ringClass(f, x, y, [0.25, 0.5, 1, 2]);
        return { optionIsCorrect: text => text === `A ${WORDS[cls]} point` };
      },
      'MIT-MV-22:second-critical-point': p => {
        const q = p as P;
        const crit = criticalPoints(Cfn(q));
        expect(crit.length, `p x³ + p y³ + c xy has two critical points, found ${JSON.stringify(crit)}`).toBe(2);
        const other = crit.find(c => Math.hypot(c[0], c[1]) > 1e-6)!;
        expect(crit.some(c => Math.hypot(c[0], c[1]) < 1e-7), '(0, 0) is critical').toBe(true);
        expect(close(other[0], other[1], 1e-9), 'other critical point on the diagonal').toBe(true);
        expect(close(other[0], Math.round(other[0]), 1e-7) && Math.abs(Math.round(other[0])) >= 1 && Math.abs(Math.round(other[0])) <= 3, 'k integer with 1 ≤ |k| ≤ 3').toBe(true);
        return [other[0], other[1]];
      },
      'MIT-MV-22:discriminants': p => {
        const q = p as P;
        const f = Cfn(q);
        const other = criticalPoints(f).find(c => Math.hypot(c[0], c[1]) > 1e-6)!;
        const disc = (x: number, y: number) => { const { A, B, C } = hess2(f, x, y); return A * C - B * B; };
        return [disc(0, 0), disc(other[0], other[1])];
      },
      'MIT-MV-22:classify-two': p => {
        const q = p as P;
        const f = Cfn(q);
        const other = criticalPoints(f).find(c => Math.hypot(c[0], c[1]) > 1e-6)!;
        const radii = [0.02, 0.05, 0.1];
        const c0 = ringClass(f, 0, 0, radii), cP = ringClass(f, other[0], other[1], radii);
        return { optionIsCorrect: text => { const [a, b] = twoClasses(text); return a === c0 && b === cP; } };
      },
      'MIT-MV-22:test-fails': p => {
        const q = p as P;
        const f = Ffn(q);
        const g = gradient(f2(f), [0, 0]);
        const { A, B, C } = hess2(f, 0, 0);
        const critical = Math.hypot(...g) < 1e-9, disc = A * C - B * B;
        expect([A, B, C].every(v => Math.abs(v) < 1e-9), 'all second partials vanish at (0, 0)').toBe(true);
        return {
          optionIsCorrect: text => {
            if (text.startsWith('Nothing:')) return critical && Math.abs(disc) < 1e-9; // the test is silent when AC − B² = 0
            if (text.includes('is not a critical point')) return !critical;
            if (text.includes('is a saddle point')) return disc < -1e-9; // what the test would conclude only for AC − B² < 0
            throw new Error(`unknown option "${text}"`);
          },
        };
      },
      'MIT-MV-22:classify-flat': p => {
        const q = p as P;
        const cls = ringClass(Ffn(q), 0, 0, [0.1, 0.3, 1]);
        return { optionIsCorrect: text => text === `A ${WORDS[cls]} point` };
      },
      'MIT-MV-22:challenge': p => {
        const q = p as P;
        expect(q.k % 3 === 0 && Math.abs(q.k / 3) >= 1 && Math.abs(q.k / 3) <= 3, 'k = 3m with m in ±{1,2,3}').toBe(true);
        const f = Hfn(q);
        const crit = criticalPoints(f);
        expect(crit.length, `four critical points, found ${JSON.stringify(crit)}`).toBe(4);
        for (const want of [[0, 0], [q.k, 0], [0, q.k]]) expect(crit.some(c => Math.hypot(c[0] - want[0], c[1] - want[1]) < 1e-6), `critical point ${want}`).toBe(true);
        const diag = crit.find(c => Math.abs(c[0] - c[1]) < 1e-7 && Math.hypot(c[0], c[1]) > 1e-6)!;
        const { A, B, C } = hess2(f, diag[0], diag[1]);
        return [diag[0], A, A * C - B * B];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['second-partials', 'classify-abc', 'classify-quadratic', 'second-critical-point', 'discriminants', 'classify-two', 'test-fails', 'classify-flat', 'challenge']);
  }, 12000);

  it('printed functions, points and figures agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      switch (card.audit!.kind) {
        case 'MIT-MV-22:second-partials':
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], (x, y) => p.a * x ** 3 + p.b * x * y * y + p.c * x * x + p.d * x * y + p.e * y * y, where);
          expect(hasPoint(prompt, p.x0, p.y0), `${where}: point`).toBe(true);
          expect(card.fields!.map(f => f.label), where).toEqual(['A = f_xx', 'B = f_xy', 'C = f_yy']);
          break;
        case 'MIT-MV-22:classify-abc':
          expect(prompt.includes(`A = f_xx = ${n(p.A)}, B = f_xy = ${n(p.B)} and C = f_yy = ${n(p.C)}`), `${where}: A, B, C`).toBe(true);
          expect(card.choice!.options, where).toEqual(['A minimum point', 'A maximum point', 'A saddle point', 'The test fails: more investigation is needed']);
          break;
        case 'MIT-MV-22:classify-quadratic': {
          const f = Qfn(p);
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], f, where);
          const m = prompt.match(/critical point at P = \((-?\d+), (-?\d+)\)/);
          expect(m, `${where}: P not printed`).not.toBeNull();
          const px = Number(m![1]), py = Number(m![2]);
          expect(Math.hypot(...gradient(f2(f), [px, py])), `${where}: printed P is a critical point`).toBeLessThan(1e-9);
          const cls = ringClass(f, px, py, [0.25, 0.5, 1, 2]);
          expect(card.choice!.options, where).toEqual(['A minimum point', 'A maximum point', 'A saddle point']);
          // caption: "Curves f = f(P) + h, f(P) = −4, for h = 1, 4, 9" (saddle: "... for h = 1, 4 (first colour) and h = −1, −4 (second colour)")
          const cap = clean(card.figure!.caption ?? '');
          const cm = cap.match(/f\(P\) = (-?\d+), for h = (.+)$/);
          expect(cm, `${where}: caption "${cap}"`).not.toBeNull();
          expect(Number(cm![1]), `${where}: f(P) in the caption`).toBe(f(px, py));
          const hs = [...cm![2].matchAll(/-?\d+/g)].map(x => Number(x[0]));
          const want = cls === 'min' ? [1, 4, 9] : cls === 'max' ? [-1, -4, -9] : [1, 4, -1, -4];
          expect([...hs].sort((a, b) => a - b), `${where}: caption levels for a ${cls}`).toEqual([...want].sort((a, b) => a - b));
          // every contour vertex lies on one of the printed levels (marching-squares interpolation error stays small)
          const segs = card.figure!.shapes.filter(s => s.kind === 'line') as unknown as { points: [number, number][]; tone?: string }[];
          expect(segs.length, `${where}: contour segments`).toBeGreaterThan(20);
          const seenLevel = new Set<number>();
          for (const s of segs) for (const [x, y] of s.points) {
            const value = f(x, y) - f(px, py);
            const h = want.reduce((best, c) => (Math.abs(c - value) < Math.abs(best - value) ? c : best), want[0]);
            expect(Math.abs(value - h), `${where}: contour vertex (${x}, ${y}) has f − f(P) = ${value}, nearest printed level ${h}`).toBeLessThan(0.15);
            seenLevel.add(h);
          }
          expect([...seenLevel].every(h => want.includes(h)), `${where}: only printed levels drawn`).toBe(true);
          expect(want.filter(h => h > 0).length === 0 || [...seenLevel].some(h => h > 0), `${where}: a positive level is drawn`).toBe(true);
          expect(want.filter(h => h < 0).length === 0 || [...seenLevel].some(h => h < 0), `${where}: a negative level is drawn`).toBe(true);
          const pDot = card.figure!.shapes.find(s => s.kind === 'point') as unknown as { at: [number, number] } | undefined;
          expect(pDot && pDot.at[0] === px && pDot.at[1] === py, `${where}: P marked in the figure`).toBe(true);
          break;
        }
        case 'MIT-MV-22:second-critical-point': case 'MIT-MV-22:discriminants': case 'MIT-MV-22:classify-two': {
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], Cfn(p), where);
          const k = -p.c / (3 * p.p);
          expect(Number.isInteger(k) && k !== 0 && Math.abs(k) <= 3 && [-2, -1, 1, 2].includes(p.p), `${where}: k = ${k}`).toBe(true);
          if (card.audit!.kind !== 'MIT-MV-22:second-critical-point') {
            const m = prompt.match(/P = \((-?\d+), (-?\d+)\)/);
            expect(m, `${where}: P not printed`).not.toBeNull();
            const crit = criticalPoints(Cfn(p)).find(c => Math.hypot(c[0], c[1]) > 1e-6)!;
            expect(close(Number(m![1]), crit[0], 1e-7) && close(Number(m![2]), crit[1], 1e-7), `${where}: printed P is the other critical point ${crit}`).toBe(true);
          }
          if (card.audit!.kind === 'MIT-MV-22:classify-two') {
            const m = prompt.match(/f_xx = (.+?), f_xy = (.+?) and f_yy = (.+?)\. Which/);
            expect(m, `${where}: second partials not printed`).not.toBeNull();
            const f = Cfn(p);
            for (const pt of POINTS[2]) {
              const { A, B, C } = hess2(f, pt[0], pt[1]);
              expect(close(parsePoly(m![1])({ x: pt[0], y: pt[1] }), A, 1e-9), `${where}: printed f_xx`).toBe(true);
              expect(close(parsePoly(m![2])({ x: pt[0], y: pt[1] }), B, 1e-9), `${where}: printed f_xy`).toBe(true);
              expect(close(parsePoly(m![3])({ x: pt[0], y: pt[1] }), C, 1e-9), `${where}: printed f_yy`).toBe(true);
            }
          }
          if (card.audit!.kind === 'MIT-MV-22:discriminants') expect(card.fields!.map(f => f.label), where).toEqual(['AC − B² at (0, 0)', 'AC − B² at P']);
          break;
        }
        case 'MIT-MV-22:test-fails': case 'MIT-MV-22:classify-flat': {
          const f = Ffn(p);
          expect([-3, -2, -1, 1, 2, 3].includes(p.s) && [-3, -2, -1, 1, 2, 3].includes(p.t), `${where}: s, t in ±{1,2,3}`).toBe(true);
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], f, where);
          if (card.audit!.kind === 'MIT-MV-22:test-fails') {
            const m = prompt.match(/f_x = (.+?) and f_y = (.+?), so/);
            expect(m, `${where}: f_x, f_y not printed`).not.toBeNull();
            for (const pt of POINTS[2]) {
              expect(close(parsePoly(m![1])({ x: pt[0], y: pt[1] }), partial(f2(f), pt, 0), 1e-9), `${where}: printed f_x`).toBe(true);
              expect(close(parsePoly(m![2])({ x: pt[0], y: pt[1] }), partial(f2(f), pt, 1), 1e-9), `${where}: printed f_y`).toBe(true);
            }
          } else expect(card.choice!.options, where).toEqual(['A minimum point', 'A maximum point', 'A saddle point']);
          break;
        }
        case 'MIT-MV-22:challenge': {
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], Hfn(p), where);
          expect(prompt.includes(`(0, 0), (${n(p.k)}, 0), (0, ${n(p.k)})`), `${where}: critical points printed`).toBe(true);
          expect(card.fields!.map(f => f.label), where).toEqual(['m', 'A = f_xx at P', 'AC − B² at P']);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      if (card.fields) expect(card.fields.every(f => f.tolerance === undefined), `${where}: default tolerance`).toBe(true);
    });
    expect(seen.size).toBe(9);
  }, 12000);

  it('classify-quadratic figure: every level printed in the caption is actually drawn (notes: the caption lists h)', () => {
    const missing: string[] = [];
    eachAudited(id, (card, where) => {
      if (card.audit!.kind !== 'MIT-MV-22:classify-quadratic') return;
      const p = card.audit!.params as P;
      const f = Qfn(p);
      const [px, py] = criticalPoints(f)[0];
      const cap = clean(card.figure!.caption ?? '');
      const hs = [...cap.match(/for h = (.+)$/)![1].matchAll(/-?\d+/g)].map(x => Number(x[0]));
      const drawn = new Set<number>();
      for (const s of card.figure!.shapes) if (s.kind === 'line') for (const [x, y] of s.points) {
        const value = f(x, y) - f(px, py);
        drawn.add(hs.reduce((best, c) => (Math.abs(c - value) < Math.abs(best - value) ? c : best), hs[0]));
      }
      const absent = hs.filter(h => !drawn.has(h));
      if (absent.length) missing.push(`${where}: caption lists h = ${absent.join(', ')} but no such level curve is drawn in the view`);
    });
    expect(missing, missing.join(String.fromCharCode(10))).toEqual([]);
  }, 12000);

  it('classify-abc, classify-quadratic, classify-flat, classify-two: wrong classes are rejected by the grader and each class occurs', () => {
    const seenClass: Record<string, Set<string>> = { abc: new Set(), quad: new Set(), flat: new Set(), two: new Set() };
    for (let i = 0; i < 200; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        if (!card.choice) continue;
        const ans = card.choice.options[card.choice.answer];
        if (card.audit?.kind === 'MIT-MV-22:classify-abc') seenClass.abc.add(ans);
        if (card.audit?.kind === 'MIT-MV-22:classify-quadratic') seenClass.quad.add(ans);
        if (card.audit?.kind === 'MIT-MV-22:classify-flat') seenClass.flat.add(ans);
        if (card.audit?.kind === 'MIT-MV-22:classify-two') seenClass.two.add(ans);
        card.choice.options.forEach((_, k) => expect(gradeCard(card, [], k, []), `${card.id}`).toBe(k === card.choice!.answer ? 'correct' : 'incorrect'));
      }
    }
    expect(seenClass.abc.size, 'all four verdicts occur for classify-abc').toBe(4);
    expect(seenClass.quad.size, 'min, max and saddle occur for classify-quadratic').toBe(3);
    expect(seenClass.flat.size, 'min, max and saddle occur for classify-flat').toBe(3);
    expect(seenClass.two.size, 'both P verdicts occur for classify-two').toBeGreaterThanOrEqual(2);
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-23
describe('MIT-MV-23 total differentials and the chain rule', () => {
  const id = 'MIT-MV-23';
  const Wfn = (p: P): Fn3 => (x, y, z) => p.a * x * y * z + p.b * x * x + p.c * y * z + p.d * x;
  const grad3 = (f: Fn3, v: number[]) => gradient(f3(f), v);
  const isTenth = (v: number) => [0.1, 0.2, 0.3].some(m => close(Math.abs(v), m, 1e-12));

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch05Generators[id]), {
      'MIT-MV-23:differential-coefficients': p => {
        const q = p as P;
        const g = grad3(Wfn(q), [q.x0, q.y0, q.z0]);
        expect(g.filter(v => Math.abs(v) > 1e-9).length, 'at least two non-zero coefficients').toBeGreaterThanOrEqual(2);
        return g;
      },
      'MIT-MV-23:differential-value': p => {
        const q = p as P;
        expect([q.dx, q.dy, q.dz].every(isTenth), 'increments are ±0.1, ±0.2, ±0.3').toBe(true);
        const g = grad3(Wfn(q), [q.x0, q.y0, q.z0]);
        const dw = g[0] * q.dx + g[1] * q.dy + g[2] * q.dz;
        // the same number as the limit of the difference quotient along the increment direction
        const f = Wfn(q), e = 1e-5;
        const dir = (f(q.x0 + e * q.dx, q.y0 + e * q.dy, q.z0 + e * q.dz) - f(q.x0 - e * q.dx, q.y0 - e * q.dy, q.z0 - e * q.dz)) / (2 * e);
        expect(close(dir, dw, 1e-6), `directional quotient ${dir} vs ${dw}`).toBe(true);
        expect(Math.abs(dw), '|dw| ≥ 0.05').toBeGreaterThanOrEqual(0.05 - 1e-9);
        expect(close(dw * 100, Math.round(dw * 100), 1e-7), `exact dw = ${dw} has at most 2 decimals`).toBe(true);
        return [dw];
      },
      'MIT-MV-23:chain-path': p => {
        const q = p as P;
        const W = Wfn(q);
        const composite: Fn1 = t => W(t, q.q * t * t, q.r * t);
        const dwdt = deriv(composite, q.t0);
        expect(Math.abs(dwdt), '|dw/dt| ≤ 150').toBeLessThanOrEqual(150 + 1e-9);
        return [dwdt];
      },
      'MIT-MV-23:given-data': p => {
        const q = p as P;
        expect(q.p !== q.q && [q.p, q.q].every(v => Number.isInteger(v) && v >= 1 && v <= 4), 'exponents distinct in 1..4').toBe(true);
        // any function with w_x = wx and w_y = wy at (1, 1), including one with extra second-order terms; compose with the path and differentiate at t = 1
        const w1: Fn2 = (x, y) => q.wx * (x - 1) + q.wy * (y - 1);
        const w2: Fn2 = (x, y) => q.wx * (x - 1) + q.wy * (y - 1) + 5 * (x - 1) * (y - 1) - 3 * (x - 1) ** 2 + 2 * (y - 1) ** 3;
        const d1 = deriv(t => w1(t ** q.p, t ** q.q), 1, 0.01);
        const d2 = deriv(t => w2(t ** q.p, t ** q.q), 1, 0.01); // the cubic term has degree up to 12: small steps keep the extrapolation error far below 1e-9
        expect(close(d1, d2, 1e-9), 'dw/dt at t = 1 does not depend on the unknown second-order terms').toBe(true);
        return [d1];
      },
      'MIT-MV-23:bug': p => {
        const q = p as P;
        const T: Fn2 = (x, y) => 100 - q.p * x * x - q.q * y * y;
        const dTdt = deriv(t => T(q.a * t, q.b + q.c * t), q.t0);
        expect([1, 2].includes(q.t0) && [1, 2, -1, -2].includes(q.a) && [1, 2, -1, -2].includes(q.c) && q.b >= -2 && q.b <= 2, 'path parameters in range').toBe(true);
        return [dTdt];
      },
      'MIT-MV-23:challenge': p => {
        const q = p as P;
        const w: Fn3 = (x, y, z) => q.a * x * y + q.b * y * z * z + q.c * x;
        const dwdt = deriv(t => w(t * t, t + q.r, q.q * t), q.t0);
        expect(Math.abs(dwdt) > 1e-9 && Math.abs(dwdt) <= 200, `0 < |dw/dt| ≤ 200, got ${dwdt}`).toBe(true);
        return [dwdt];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['differential-coefficients', 'differential-value', 'chain-path', 'given-data', 'bug', 'challenge']);
  }, 12000);

  it('printed functions, points, increments and paths agree with the audit params; tolerances follow the notes', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      const W = Wfn(p);
      const printedW = () => expectSame(printedPoly(prompt, 'w', 'xyz'), ['x', 'y', 'z'], W, where);
      const printedT = (names: string[], fns: Fn1[]) => names.forEach((nm, i) => expectSame(printedPoly(prompt, nm, 't'), ['t'], fns[i], `${where} (${nm}(t))`));
      const printedAt = (re: RegExp) => { const m = prompt.match(re); expect(m, `${where}: ${re} in ${prompt}`).not.toBeNull(); return m!; };
      switch (card.audit!.kind) {
        case 'MIT-MV-23:differential-coefficients':
          printedW();
          expect(hasPoint(prompt, p.x0, p.y0, p.z0), `${where}: P`).toBe(true);
          expect(card.fields!.map(f => f.label), where).toEqual(['w_x(P)', 'w_y(P)', 'w_z(P)']);
          expectTolerances(card, where, undefined);
          break;
        case 'MIT-MV-23:differential-value':
          printedW();
          expect(hasPoint(prompt, p.x0, p.y0, p.z0), `${where}: P`).toBe(true);
          expect(prompt, where).toContain(`dx = ${n(p.dx)}, dy = ${n(p.dy)} and dz = ${n(p.dz)}`);
          expectTolerances(card, where, 0.005);
          break;
        case 'MIT-MV-23:chain-path':
          printedW();
          printedT(['x', 'y', 'z'], [t => t, t => p.q * t * t, t => p.r * t]);
          expect(printedAt(/at t = (-?\d+)\b/)[1], where).toBe(n(p.t0));
          expect([1, 2].includes(p.q) && [-2, -1, 1, 2].includes(p.r) && [-2, -1, 1, 2].includes(p.t0), `${where}: q, r, t0 ranges`).toBe(true);
          expectTolerances(card, where, undefined);
          break;
        case 'MIT-MV-23:given-data': {
          printedT(['x', 'y'], [t => t ** p.p, t => t ** p.q]);
          expect(prompt, where).toContain(`∂w/∂x = ${n(p.wx)} and ∂w/∂y = ${n(p.wy)}`);
          expect(prompt, where).toContain('(x, y) = (1, 1)');
          expect(prompt, where).toContain('t = 1');
          expectTolerances(card, where, undefined);
          break;
        }
        case 'MIT-MV-23:bug': {
          const T = printedPoly(prompt, 'T\\(x, y\\)', 'xy');
          expectSame(T, ['x', 'y'], (x, y) => 100 - p.p * x * x - p.q * y * y, where);
          printedT(['x', 'y'], [t => p.a * t, t => p.b + p.c * t]);
          expect(printedAt(/at t = (-?\d+)\./)[1], where).toBe(n(p.t0));
          expectTolerances(card, where, undefined);
          // figure: three level ellipses of T and the bug's path, the bug marked at (x(t0), y(t0))
          const x0 = p.a * p.t0, y0 = p.b + p.c * p.t0;
          const shapes = card.figure!.shapes;
          const loops = shapes.filter(s => s.kind === 'line' && (s as unknown as { points: unknown[] }).points.length > 20) as unknown as { points: [number, number][] }[];
          expect(loops.length, `${where}: three level curves`).toBe(3);
          const levels = loops.map(loop => { const vals = loop.points.map(([x, y]) => 100 - p.p * x * x - p.q * y * y); expect(Math.max(...vals) - Math.min(...vals), `${where}: a level curve of T is a level set`).toBeLessThan(1e-9); return vals[0]; });
          expect(new Set(levels.map(l => l.toFixed(6))).size, where).toBe(3);
          const dot = shapes.find(s => s.kind === 'point') as unknown as { at: [number, number] };
          expect(dot.at[0] === x0 && dot.at[1] === y0, `${where}: bug marker at (${x0}, ${y0}), got ${dot.at}`).toBe(true);
          expect(clean(card.figure!.alt), where).toContain(`(${n(x0)}, ${n(y0)}) at t = ${n(p.t0)}`);
          const arrow = shapes.find(s => s.kind === 'arrow') as unknown as { from: [number, number]; to: [number, number] };
          for (const [x, y] of [arrow.from, arrow.to]) expect(close(y, p.b + p.c * (x / p.a), 1e-9), `${where}: arrow end (${x}, ${y}) lies on the path`).toBe(true);
          break;
        }
        case 'MIT-MV-23:challenge': {
          expectSame(printedPoly(prompt, 'w', 'xyz'), ['x', 'y', 'z'], (x, y, z) => p.a * x * y + p.b * y * z * z + p.c * x, where);
          printedT(['x', 'y', 'z'], [t => t * t, t => t + p.r, t => p.q * t]);
          expect(printedAt(/at t = (-?\d+)\./)[1], where).toBe(n(p.t0));
          expect([1, 2].includes(p.q) && [-1, 1, 2].includes(p.t0), `${where}: q, t0 ranges`).toBe(true);
          expectTolerances(card, where, undefined);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(6);
  }, 12000);

  it('bug: x0 and y0 are non-zero at t0 (notes: "non-zero")', () => {
    eachAudited(id, (card, where) => {
      if (card.audit!.kind !== 'MIT-MV-23:bug') return;
      const q = card.audit!.params as P;
      const x0 = q.a * q.t0, y0 = q.b + q.c * q.t0;
      expect(x0 !== 0 && y0 !== 0, `${where}: bug is at (${x0}, ${y0}) at t = ${q.t0}`).toBe(true);
    });
  }, 12000);

  it('family constraints: a, b, c non-zero in −2..2, d in −3..3', () => {
    eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      if ('d' in p && 'a' in p && 'b' in p && 'c' in p && !('r' in p) && !('q' in p)) {
        expect([p.a, p.b, p.c].every(v => Number.isInteger(v) && v !== 0 && Math.abs(v) <= 2), `${where}: a, b, c`).toBe(true);
        expect(Number.isInteger(p.d) && Math.abs(p.d) <= 3, `${where}: d`).toBe(true);
      }
    });
  }, 12000);

  it('differential-value: the grader accepts the 2-decimal differential and rejects a different value', () => {
    let nonlinearWouldPass = 0, total = 0;
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        if (card.audit?.kind !== 'MIT-MV-23:differential-value') continue;
        const q = card.audit.params as P, W = Wfn(q);
        const g = grad3(W, [q.x0, q.y0, q.z0]);
        const dw = g[0] * q.dx + g[1] * q.dy + g[2] * q.dz;
        const where = `${card.id} seed ${spreadSeed(i)}`;
        expect(gradeCard(card, [dw.toFixed(2)], null, []), where).toBe('correct');
        expect(gradeCard(card, [(dw + 0.01).toFixed(2)], null, []), where).toBe('incorrect');
        expect(gradeCard(card, [(dw - 0.01).toFixed(2)], null, []), where).toBe('incorrect');
        const exact = W(q.x0 + q.dx, q.y0 + q.dy, q.z0 + q.dz) - W(q.x0, q.y0, q.z0);
        total++; if (Math.abs(exact - dw) <= 0.005) nonlinearWouldPass++;
      }
    }
    // informational: the question asks for the differential, not the exact change; report how often the exact change would also pass
    expect(total).toBe(SEEDS);
    expect(nonlinearWouldPass, `exact Δw coincides with dw within 0.005 on ${nonlinearWouldPass}/${total} seeds`).toBeLessThanOrEqual(total);
  }, 12000);

  it('derive / notation (no audit): the correct option is the divide-by-Δt limit; dw/dt, not ∂w/∂t', () => {
    eachCardById(id, 'derive', (card, where) => expectOneCorrect(card, where, t => t.startsWith('Divide both sides by Δt and let Δt → 0')));
    eachCardById(id, 'notation', (card, where) => expectOneCorrect(card, where, t => t.startsWith('dw/dt, an ordinary derivative, because w ends up depending on the single variable t')));
  }, 12000);

  it('chain-formula (symbols): dw/dt = w_x x′ + w_y y′ + w_z z′ is numerically the derivative of the composite and the distractor combinations are not', () => {
    // test function and path, independent of the generator
    const w: Fn3 = (x, y, z) => x * x * y + y * z * z * z - 2 * x * z + 3 * y;
    const path = [(t: number) => t * t + 1, (t: number) => Math.sin(t) + 2, (t: number) => 1 / (1 + t * t)];
    const t0 = 0.6, at0 = path.map(f => f(t0));
    const wPart = gradient(f3(w), at0, 0.2);
    const dPath = path.map(f => deriv(f, t0, 0.1));
    const trueRate = deriv(t => w(path[0](t), path[1](t), path[2](t)), t0, 0.1);
    const idx = (c: string) => 'xyz'.indexOf(c);
    const evalToken = (token: string) => { const m = token.match(/^w_([xyz]) ([xyz])′$/); if (!m) throw new Error(`unknown token ${token}`); return wPart[idx(m[1])] * dPath[idx(m[2])]; };
    eachCardById(id, 'chain-formula', (card, where) => {
      const s = card.slots!;
      expect(s.before, where).toBe('dw/dt =');
      expect(s.answers.length, where).toBe(5);
      expect([s.answers[1], s.answers[3]], where).toEqual(['+', '+']);
      const value = evalToken(s.answers[0]) + evalToken(s.answers[2]) + evalToken(s.answers[4]);
      expect(close(value, trueRate, 1e-6), `${where}: ${s.answers.join(' ')} = ${value} but dw/dt = ${trueRate}`).toBe(true);
      expect(s.tokens, where).toEqual(expect.arrayContaining(s.answers));
      const wrong = ['w_x y′', '+', 'w_y z′', '+', 'w_z x′'];
      expect(Math.abs(evalToken(wrong[0]) + evalToken(wrong[2]) + evalToken(wrong[4]) - trueRate), 'the distractor combination really is wrong').toBeGreaterThan(1e-3);
      expect(gradeCard(card, [], null, s.answers), where).toBe('correct');
      expect(gradeCard(card, [], null, wrong), where).toBe('incorrect');
      expect(gradeCard(card, [], null, ['w_x x′', '+', 'w_y y′', '+', 'w_y y′']), where).toBe('incorrect');
      expect(gradeCard(card, [], null, [s.answers[0], '+', s.answers[2]]), where).toBe('incomplete');
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-24
describe('MIT-MV-24 the chain rule with more variables', () => {
  const id = 'MIT-MV-24';
  const Wxy = (p: P): Fn2 => (x, y) => p.p * x * x * y + p.q * y * y + p.r * x;
  const Xuv = (p: P): Fn2 => (u, v) => p.a * u * u + p.b * v;
  const Yuv = (p: P): Fn2 => (u, v) => p.c * u + p.d * v * v;
  /** Compose the family numerically and differentiate with respect to u and v. */
  const compositePartials = (p: P) => {
    const w: Fn2 = (u, v) => Wxy(p)(Xuv(p)(u, v), Yuv(p)(u, v));
    return [deriv(s => w(s, p.v0), p.u0), deriv(s => w(p.u0, s), p.v0)];
  };
  const isTenth = (v: number) => [0.1, 0.2, 0.3].some(m => close(Math.abs(v), m, 1e-12));

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch05Generators[id]), {
      'MIT-MV-24:intermediates': p => {
        const q = p as P;
        const x = Xuv(q)(q.u0, q.v0), y = Yuv(q)(q.u0, q.v0);
        const w = Wxy(q);
        expect(Math.abs(x) <= 5 && Math.abs(y) <= 5, `|x|, |y| ≤ 5, got ${x}, ${y}`).toBe(true);
        const [wx, wy] = gradient(f2(w), [x, y]);
        return [x, y, wx, wy];
      },
      'MIT-MV-24:partials-uv': p => {
        const q = p as P;
        const g = compositePartials(q);
        expect(Math.abs(g[0]) <= 120 && Math.abs(g[1]) <= 120 && Math.abs(g[0]) + Math.abs(g[1]) > 1e-9, `partials ${g}`).toBe(true);
        // also: the chain rule assembled from separately measured pieces agrees with the composite
        const x = Xuv(q)(q.u0, q.v0), y = Yuv(q)(q.u0, q.v0);
        const [wx, wy] = gradient(f2(Wxy(q)), [x, y]);
        const xu = deriv(s => Xuv(q)(s, q.v0), q.u0), xv = deriv(s => Xuv(q)(q.u0, s), q.v0), yu = deriv(s => Yuv(q)(s, q.v0), q.u0), yv = deriv(s => Yuv(q)(q.u0, s), q.v0);
        expect(close(wx * xu + wy * yu, g[0], 1e-8) && close(wx * xv + wy * yv, g[1], 1e-8), 'chain rule pieces agree with the composite').toBe(true);
        return g;
      },
      'MIT-MV-24:differential-uv': p => {
        const q = p as P;
        expect([q.du, q.dv].every(isTenth), 'du, dv are ±0.1, ±0.2, ±0.3').toBe(true);
        const g = compositePartials(q);
        const dw = g[0] * q.du + g[1] * q.dv;
        expect(Math.abs(dw), '|dw| ≥ 0.05').toBeGreaterThanOrEqual(0.05 - 1e-9);
        expect(close(dw * 100, Math.round(dw * 100), 1e-7), `exact dw = ${dw} has at most 2 decimals`).toBe(true);
        return [dw];
      },
      'MIT-MV-24:three-intermediates': p => {
        const q = p as P;
        expect(q.which === 0 || q.which === 1, 'which is 0 or 1').toBe(true);
        const w = (u: number, v: number) => (q.p * u * v) * (u + q.q * v) * (u - q.r * v);
        const d = q.which === 0 ? deriv(s => w(s, q.v0), q.u0) : deriv(s => w(q.u0, s), q.v0);
        expect(Math.abs(d) > 1e-9 && Math.abs(d) <= 120, `0 < |answer| ≤ 120, got ${d}`).toBe(true);
        return [d];
      },
      'MIT-MV-24:polar': p => {
        const q = p as P;
        expect(q.a !== 0 && q.b !== 0 && q.a + q.b !== 0 && q.a !== q.b, 'a, b non-zero, a + b ≠ 0, a ≠ b').toBe(true);
        expect(Math.abs(q.a) <= (q.r0 === 3 ? 2 : 3) && Math.abs(q.b) <= (q.r0 === 3 ? 2 : 3) && [1, 2, 3].includes(q.r0), 'coefficient bounds for r0').toBe(true);
        const w = (r: number, th: number) => { const x = r * Math.cos(th), y = r * Math.sin(th); return q.a * x ** 3 * y + q.b * x * y ** 3; };
        return [deriv(s => w(s, Math.PI / 4), q.r0, 0.02), deriv(s => w(q.r0, s), Math.PI / 4, 0.02)];
      },
      'MIT-MV-24:challenge': p => {
        const q = p as P;
        expect(Math.abs(q.c) === 1 || Math.abs(q.c) === 2, 'c in ±{1,2}').toBe(true);
        const w = (u: number, v: number) => { const x = u + q.c * v, y = u * v; return q.a * x * y + q.b * y * y; };
        return [deriv(s => w(s, q.v0), q.u0), deriv(s => w(q.u0, s), q.v0)];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['intermediates', 'partials-uv', 'differential-uv', 'three-intermediates', 'polar', 'challenge']);
  }, 12000);

  it('printed functions, points and increments agree with the audit params; tolerances follow the notes', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      const uv = (names: string[], fns: ((u: number, v: number) => number)[]) => names.forEach((nm, i) => expectSame(printedPoly(prompt, nm, 'uv'), ['u', 'v'], fns[i], `${where} (${nm}(u, v))`));
      const family = () => {
        expectSame(printedPoly(prompt, 'w', 'xy'), ['x', 'y'], Wxy(p), where);
        uv(['x', 'y'], [Xuv(p), Yuv(p)]);
        expect(prompt.includes(`(u, v) = (${n(p.u0)}, ${n(p.v0)})`), `${where}: point`).toBe(true);
        expect([p.p, p.q, p.a, p.b, p.c, p.d].every(v => Number.isInteger(v) && v !== 0 && Math.abs(v) <= 2) && Number.isInteger(p.r) && Math.abs(p.r) <= 2, `${where}: coefficient ranges`).toBe(true);
        expect(Math.abs(p.u0) <= 2 && Math.abs(p.v0) <= 2, `${where}: point range`).toBe(true);
      };
      switch (card.audit!.kind) {
        case 'MIT-MV-24:intermediates':
          family();
          expect(card.fields!.map(f => f.label), where).toEqual(['x', 'y', 'w_x', 'w_y']);
          expectTolerances(card, where, undefined);
          break;
        case 'MIT-MV-24:partials-uv':
          family();
          expect(card.fields!.map(f => f.label), where).toEqual(['∂w/∂u', '∂w/∂v']);
          expectTolerances(card, where, undefined);
          break;
        case 'MIT-MV-24:differential-uv':
          family();
          expect(prompt, where).toContain(`du = ${n(p.du)} and dv = ${n(p.dv)}`);
          expectTolerances(card, where, 0.005);
          break;
        case 'MIT-MV-24:three-intermediates': {
          expectSame(printedPoly(prompt, 'w', 'xyz'), ['x', 'y', 'z'], (x, y, z) => x * y * z, where);
          uv(['x', 'y', 'z'], [(u, v) => p.p * u * v, (u, v) => u + p.q * v, (u, v) => u - p.r * v]);
          const m = prompt.match(/to find ∂w\/∂([uv]) at \(u, v\) = \((-?\d+), (-?\d+)\)/);
          expect(m, `${where}: question`).not.toBeNull();
          expect(m![1], `${where}: which = ${p.which}`).toBe(p.which === 0 ? 'u' : 'v');
          expect([Number(m![2]), Number(m![3])], where).toEqual([p.u0, p.v0]);
          expect(card.fields!.map(f => f.label), where).toEqual([`∂w/∂${p.which === 0 ? 'u' : 'v'}`]);
          expect([1, 2].includes(p.p) && [1, 2, 3].includes(p.q) && [1, 2, 3].includes(p.r) && p.u0 !== 0 && p.v0 !== 0 && Math.abs(p.u0) <= 2 && Math.abs(p.v0) <= 2, `${where}: ranges`).toBe(true);
          expectTolerances(card, where, undefined);
          break;
        }
        case 'MIT-MV-24:polar': {
          expectSame(printedPoly(prompt, 'w', 'xy'), ['x', 'y'], (x, y) => p.a * x ** 3 * y + p.b * x * y ** 3, where);
          expect(prompt, where).toContain(`(r, θ) = (${n(p.r0)}, π/4)`);
          expect(card.fields!.map(f => f.label), where).toEqual(['∂w/∂r', '∂w/∂θ']);
          // closed forms from the notes are not trusted blindly: they are re-derived below from the numerics (see oracle) and must be rational
          expect(close(card.fields![0].answer, (p.a + p.b) * p.r0 ** 3, 1e-12) && close(card.fields![1].answer, p.r0 ** 4 * (p.b - p.a) / 2, 1e-12), `${where}: rational closed forms`).toBe(true);
          expectTolerances(card, where, undefined);
          break;
        }
        case 'MIT-MV-24:challenge':
          expectSame(printedPoly(prompt, 'w', 'xy'), ['x', 'y'], (x, y) => p.a * x * y + p.b * y * y, where);
          uv(['x', 'y'], [(u, v) => u + p.c * v, (u, v) => u * v]);
          expect(prompt.includes(`(u, v) = (${n(p.u0)}, ${n(p.v0)})`), `${where}: point`).toBe(true);
          expect(card.fields!.map(f => f.label), where).toEqual(['∂w/∂u', '∂w/∂v']);
          expectTolerances(card, where, undefined);
          break;
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(6);
  }, 12000);

  it('differential-uv: the grader accepts the 2-decimal differential and rejects a different value', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        if (card.audit?.kind !== 'MIT-MV-24:differential-uv') continue;
        const q = card.audit.params as P;
        const g = compositePartials(q);
        const dw = g[0] * q.du + g[1] * q.dv;
        const where = `${card.id} seed ${spreadSeed(i)}`;
        expect(gradeCard(card, [dw.toFixed(2)], null, []), where).toBe('correct');
        expect(gradeCard(card, [(dw + 0.01).toFixed(2)], null, []), where).toBe('incorrect');
        expect(gradeCard(card, [(dw - 0.01).toFixed(2)], null, []), where).toBe('incorrect');
      }
    }
  }, 12000);

  it('three-intermediates: which = 0 and which = 1 both occur and the two partials differ', () => {
    const which = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const card = batch05Generators[id](spreadSeed(i), 'en').find(c => c.audit?.kind === 'MIT-MV-24:three-intermediates')!;
      which.add((card.audit!.params as P).which);
    }
    expect([...which].sort()).toEqual([0, 1]);
  }, 12000);

  it('chain-formula (symbols): ∂w/∂u = w_x x_u + w_y y_u is numerically the derivative of the composite and the distractors are not', () => {
    const w: Fn2 = (x, y) => x * x * y + 3 * y * y - x;
    const xf: Fn2 = (u, v) => u * u * v + v, yf: Fn2 = (u, v) => Math.sin(u) + u * v * v;
    const u0 = 0.7, v0 = 1.3;
    const x0 = xf(u0, v0), y0 = yf(u0, v0);
    const wPart = gradient(f2(w), [x0, y0], 0.2);
    const dxdu = deriv(s => xf(s, v0), u0, 0.1), dxdv = deriv(s => xf(u0, s), v0, 0.1), dydu = deriv(s => yf(s, v0), u0, 0.1), dydv = deriv(s => yf(u0, s), v0, 0.1);
    const comp = (s: number, t: number) => w(xf(s, t), yf(s, t));
    const trueU = deriv(s => comp(s, v0), u0, 0.1);
    const pieces: Record<string, number> = {
      'w_x x_u': wPart[0] * dxdu, 'w_y y_u': wPart[1] * dydu, 'w_x x_v': wPart[0] * dxdv, 'w_y y_v': wPart[1] * dydv, 'w_x y_u': wPart[0] * dydu, 'w_y x_u': wPart[1] * dxdu,
    };
    eachCardById(id, 'chain-formula', (card, where) => {
      const s = card.slots!;
      expect(s.before, where).toBe('∂w/∂u =');
      expect(s.answers.length, where).toBe(3);
      expect(s.answers[1], where).toBe('+');
      const value = pieces[s.answers[0]] + pieces[s.answers[2]];
      expect(close(value, trueU, 1e-6), `${where}: ${s.answers.join(' ')} = ${value} but ∂w/∂u = ${trueU}`).toBe(true);
      expect(s.tokens, where).toEqual(expect.arrayContaining(s.answers));
      for (const bad of [['w_x x_v', '+', 'w_y y_v'], ['w_x y_u', '+', 'w_y x_u']]) {
        expect(Math.abs(pieces[bad[0]] + pieces[bad[2]] - trueU), `distractor ${bad.join(' ')} is really wrong`).toBeGreaterThan(1e-3);
        expect(gradeCard(card, [], null, bad), where).toBe('incorrect');
      }
      expect(gradeCard(card, [], null, s.answers), where).toBe('correct');
    });
  }, 12000);

  it('count-terms and roles (no audit)', () => {
    eachCardById(id, 'count-terms', (card, where) => {
      const m = clean(card.prompt).match(/^w = f\(([^)]*)\) and each of/);
      expect(m, `${where}: ${card.prompt}`).not.toBeNull();
      const vars = m![1].split(', ');
      const N = vars.length;
      expect(N === 2 || N === 3, where).toBe(true);
      // the sum for ∂w/∂u has one term per intermediate variable: w_{x_i} · ∂x_i/∂u
      const verdict = (text: string) => text.startsWith(`${N} terms, one for each of ${vars.join(', ')}:`) && text.endsWith("derivative with respect to u.");
      expectOneCorrect(card, where, verdict);
      for (const [i, text] of optionsOf(card).entries()) if (i !== card.choice!.answer) expect(/derivative with respect to v\.$/.test(text) || text.startsWith(`${2 * N} terms`), `${where}: wrong option "${text}"`).toBe(true);
    });
    eachCardById(id, 'roles', (card, where) => expectOneCorrect(card, where,
      t => t.includes('w is the dependent variable') && t.includes('x and y are intermediate variables') && t.includes('u and v are the independent variables')));
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-25
describe('MIT-MV-25 the gradient and level curves', () => {
  const id = 'MIT-MV-25';
  const Qfn = (p: P): Fn2 => (x, y) => p.a * x * x + p.b * x * y + p.c * y * y + p.d * x + p.e * y;
  const grad2 = (f: Fn2, x: number, y: number) => gradient(f2(f), [x, y]);
  /** Solve f(x, y) = level for y near y0 by Newton's method (x fixed). */
  function levelY(f: Fn2, x: number, y0: number, level: number): number {
    let y = y0;
    for (let it = 0; it < 60; it++) {
      const dy = (f(x, y) - level) / deriv(t => f(x, t), y, 0.5);
      y -= dy;
      if (Math.abs(dy) < 1e-15) break;
    }
    expect(Math.abs(f(x, y) - level), `level-curve solve at x = ${x}`).toBeLessThan(1e-9);
    return y;
  }
  /** Unit tangent of the level curve of f through P, measured on a tiny ring: the chord between the two points of the ring on the level curve. */
  function levelTangent(f: Fn2, px: number, py: number): [number, number] {
    const f0 = f(px, py), r = 1e-4, N = 720;
    const g = (th: number) => f(px + r * Math.cos(th), py + r * Math.sin(th)) - f0;
    const roots: number[] = [];
    for (let k = 0; k < N; k++) {
      let lo = (2 * Math.PI * k) / N, hi = (2 * Math.PI * (k + 1)) / N;
      const glo = g(lo), ghi = g(hi);
      if (glo === 0) { roots.push(lo); continue; }
      if (glo * ghi < 0) { for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; (g(mid) * glo > 0 ? (lo = mid) : (hi = mid)); } roots.push((lo + hi) / 2); }
    }
    expect(roots.length, 'the level curve crosses a tiny ring twice').toBe(2);
    const [dx, dy] = [Math.cos(roots[0]) - Math.cos(roots[1]), Math.sin(roots[0]) - Math.sin(roots[1])];
    const len = Math.hypot(dx, dy);
    return [dx / len, dy / len];
  }
  const parseVec = (text: string) => { const m = clean(text).match(/^\((-?\d+), (-?\d+)\)$/); if (!m) throw new Error(`cannot read vector "${text}"`); return [Number(m[1]), Number(m[2])]; };
  const parsePoint3 = (text: string) => { const m = clean(text).match(/^\((-?\d+), (-?\d+), (-?\d+)\)$/); if (!m) throw new Error(`cannot read point "${text}"`); return [Number(m[1]), Number(m[2]), Number(m[3])]; };

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch05Generators[id]), {
      'MIT-MV-25:gradient': p => { const q = p as P; return grad2(Qfn(q), q.x0, q.y0); },
      'MIT-MV-25:perpendicular-vector': p => {
        const q = p as P;
        const f = Qfn({ ...q, d: 0, e: 0 });
        expect(q.a >= 1 && q.a <= 3 && q.c >= 1 && q.c <= 3 && q.b >= -2 && q.b <= 2 && 4 * q.a * q.c > q.b * q.b && q.x0 !== 0 && q.y0 !== 0, 'family ranges').toBe(true);
        const [gx, gy] = grad2(f, q.x0, q.y0);
        expect(Math.abs(gx) > 1e-9 && Math.abs(gy) > 1e-9 && Math.abs(Math.abs(gx) - Math.abs(gy)) > 1e-9, 'f_x, f_y ≠ 0 and |f_x| ≠ |f_y|').toBe(true);
        const tangent = levelTangent(f, q.x0, q.y0);
        return {
          optionIsCorrect: text => {
            const v = parseVec(text);
            const len = Math.hypot(v[0], v[1]);
            // perpendicular to the level curve: orthogonal to the measured tangent (chord direction is within ~κ·r of the true tangent)
            return Math.abs((v[0] * tangent[0] + v[1] * tangent[1]) / len) < 1e-3;
          },
        };
      },
      'MIT-MV-25:slopes': p => {
        const q = p as P;
        const f = Qfn(q);
        const [gx, gy] = grad2(f, q.x0, q.y0);
        expect(Math.abs(gx) > 1e-9 && Math.abs(gy) > 1e-9 && Math.abs(Math.abs(gx) - Math.abs(gy)) > 1e-9 && Math.abs(gx) <= 12.0000001 && Math.abs(gy) <= 12.0000001, `f_x, f_y non-zero, distinct magnitudes, ≤ 12: ${gx}, ${gy}`).toBe(true);
        const f0 = f(q.x0, q.y0);
        const dydx = deriv(x => levelY(f, x, q.y0, f0), q.x0, 0.004);
        return [dydx, gy / gx];
      },
      'MIT-MV-25:graph-normal': p => {
        const q = p as P;
        const g = (x: number) => q.a * x * x + q.b * x + q.c;
        const w: Fn2 = (x, y) => y - g(x);
        expect(close(w(q.x0, g(q.x0)), 0, 1e-12), 'P lies on w = 0').toBe(true);
        const [wx, wy] = grad2(w, q.x0, g(q.x0));
        expect(close(wy, 1, 1e-9), '∇w = (m, 1)').toBe(true);
        // (m, 1) is perpendicular to the tangent (1, g'(x0)) of the parabola
        expect(close(wx * 1 + wy * deriv(g, q.x0, 0.5), 0, 1e-9), 'perpendicular to the tangent').toBe(true);
        return [wx];
      },
      'MIT-MV-25:gradient-3d': p => {
        const q = p as P;
        const f: Fn3 = (x, y, z) => q.a * x * y + q.b * y * z + q.c * z * z + q.d * x;
        return gradient(f3(f), [q.x0, q.y0, q.z0]);
      },
      'MIT-MV-25:on-surface': p => {
        const q = p as P;
        const w: Fn3 = (x, y, z) => x * x + q.a * y * y + q.b * z * z;
        return { optionIsCorrect: text => { const [x, y, z] = parsePoint3(text); return Math.abs(w(x, y, z) - q.c) < 1e-12; } };
      },
      'MIT-MV-25:tangent-plane': p => {
        const q = p as P;
        const w: Fn3 = (x, y, z) => x * x + q.a * y * y + q.b * z;
        const P0 = [q.x0, q.y0, q.z0];
        const cPrinted = w(q.x0, q.y0, q.z0);
        expect(Number.isFinite(cPrinted), 'P is on the surface by construction').toBe(true);
        const nvec = gradient(f3(w), P0);
        // D from the plane through P normal to n; cross-check: two in-plane vectors have zero first-order change of w
        const D = nvec[0] * q.x0 + nvec[1] * q.y0 + nvec[2] * q.z0;
        const e1 = [nvec[1], -nvec[0], 0], e2 = [0, nvec[2], -nvec[1]];
        for (const e of [e1, e2]) {
          const dd = deriv(s => w(q.x0 + s * e[0], q.y0 + s * e[1], q.z0 + s * e[2]), 0, 0.5);
          expect(Math.abs(dd), 'w does not change to first order along the plane').toBeLessThan(1e-9);
        }
        return [...nvec, D];
      },
      'MIT-MV-25:zero-gradient': p => {
        const q = p as P;
        expect(q.a !== 0 && q.b !== 0 && Math.abs(q.a) <= 3 && Math.abs(q.b) <= 3, 'a, b non-zero in −3..3').toBe(true);
        const f: Fn2 = (x, y) => q.a * x * x + q.b * y * y + q.c * x + q.d * y;
        return { optionIsCorrect: text => { const [x, y] = parseVec(text); return Math.hypot(...grad2(f, x, y)) < 1e-9; } };
      },
      'MIT-MV-25:challenge': p => {
        const q = p as P;
        expect(q.a !== 0 && q.b !== 0 && q.c !== 0, 'a, b, c non-zero').toBe(true);
        const f: Fn2 = (x, y) => q.a * x * x + q.b * x * y + q.c * y ** 3;
        const [gx, gy] = grad2(f, q.x0, q.y0);
        expect(Math.abs(gx) > 1e-9 && Math.abs(gy) > 1e-9, 'f_x(P), f_y(P) non-zero').toBe(true);
        // the tangent line to the level curve through P: points (x0, y0) + s (−f_y, f_x) satisfy gx x + gy y = k
        const k = gx * q.x0 + gy * q.y0;
        for (const s of [-2, 0.7, 3]) expect(close(gx * (q.x0 - s * gy) + gy * (q.y0 + s * gx), k, 1e-9), 'k is constant along the tangent line').toBe(true);
        return [gx, gy, k];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['gradient', 'perpendicular-vector', 'slopes', 'graph-normal', 'gradient-3d', 'on-surface', 'tangent-plane', 'zero-gradient', 'challenge']);
  }, 12000);

  it('printed functions, points, surfaces and figures agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      const printedP = () => { const m = prompt.match(/P = \((-?\d+), (-?\d+)(?:, (-?\d+))?\)/); expect(m, `${where}: P not printed`).not.toBeNull(); return [Number(m![1]), Number(m![2]), m![3] === undefined ? undefined : Number(m![3])]; };
      switch (card.audit!.kind) {
        case 'MIT-MV-25:gradient':
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], Qfn(p), where);
          expect(prompt.includes(`(x, y) = (${n(p.x0)}, ${n(p.y0)})`), `${where}: point`).toBe(true);
          expect(card.fields!.map(f => f.label), where).toEqual(['f_x', 'f_y']);
          break;
        case 'MIT-MV-25:perpendicular-vector': {
          const f = Qfn({ ...p, d: 0, e: 0 });
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], f, where);
          expect(printedP().slice(0, 2), where).toEqual([p.x0, p.y0]);
          const fP = f(p.x0, p.y0);
          const levels = [fP / 4, fP, 1.5 * fP];
          const cap = clean(card.figure!.caption ?? '');
          const cm = cap.match(/^Level curves f = (.+)$/);
          expect(cm, `${where}: caption "${cap}"`).not.toBeNull();
          expect(cm![1].split(', ').map(Number), `${where}: caption levels`).toEqual(levels);
          // every contour vertex lies on one of the three printed levels; the highlighted (non-muted) curve is the middle one
          const segs = card.figure!.shapes.filter(s => s.kind === 'line') as unknown as { points: [number, number][]; tone?: string }[];
          expect(segs.length, `${where}: contour segments`).toBeGreaterThan(20);
          const drawn = new Set<number>();
          for (const s of segs) for (const [x, y] of s.points) {
            const value = f(x, y);
            const li = levels.reduce((best, c, i) => (Math.abs(c - value) < Math.abs(levels[best] - value) ? i : best), 0);
            expect(Math.abs(value - levels[li]), `${where}: vertex (${x}, ${y}) has f = ${value}, nearest printed level ${levels[li]}`).toBeLessThan(0.12);
            drawn.add(li);
            if (s.tone !== 'muted') expect(li, `${where}: highlighted curve must be the one through P`).toBe(1);
          }
          expect([...drawn].sort(), `${where}: all three levels drawn`).toEqual([0, 1, 2]);
          const dot = card.figure!.shapes.find(s => s.kind === 'point') as unknown as { at: [number, number] };
          expect(dot.at[0] === p.x0 && dot.at[1] === p.y0, `${where}: P marked`).toBe(true);
          break;
        }
        case 'MIT-MV-25:slopes':
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], Qfn(p), where);
          expect(printedP().slice(0, 2), where).toEqual([p.x0, p.y0]);
          expect(card.fields!.map(f => f.label), where).toEqual(['slope of the level curve', 'slope of ∇f(P)']);
          break;
        case 'MIT-MV-25:graph-normal': {
          const m = prompt.match(/parabola y = (.+?) is the level curve w = 0 of w\(x, y\) = y − \((.+?)\)\./) ?? prompt.match(/parabola y = (.+?) is the level curve w = 0 of w\(x, y\) = y - \((.+?)\)\./);
          expect(m, `${where}: parabola not printed`).not.toBeNull();
          const g = (x: number) => p.a * x * x + p.b * x + p.c;
          expectSame(parsePoly(m![1]), ['x'], g, where);
          expectSame(parsePoly(m![2]), ['x'], g, where);
          expect(printedP().slice(0, 2), where).toEqual([p.x0, g(p.x0)]);
          expect(prompt, where).toContain('∇w = (m, 1)');
          break;
        }
        case 'MIT-MV-25:gradient-3d': {
          expectSame(printedPoly(prompt, 'f\\(x, y, z\\)', 'xyz'), ['x', 'y', 'z'], (x, y, z) => p.a * x * y + p.b * y * z + p.c * z * z + p.d * x, where);
          expect(printedP(), where).toEqual([p.x0, p.y0, p.z0]);
          expect(card.fields!.map(f => f.label), where).toEqual(['f_x', 'f_y', 'f_z']);
          break;
        }
        case 'MIT-MV-25:on-surface': {
          const m = prompt.match(/The surface (.+?) = (-?\d+) is the level surface w = (-?\d+) of w = (.+?)\. The gradient/);
          expect(m, `${where}: surface not printed`).not.toBeNull();
          expectSame(parsePoly(m![1]), ['x', 'y', 'z'], (x, y, z) => x * x + p.a * y * y + p.b * z * z, where);
          expectSame(parsePoly(m![4]), ['x', 'y', 'z'], (x, y, z) => x * x + p.a * y * y + p.b * z * z, where);
          expect([Number(m![2]), Number(m![3])], where).toEqual([p.c, p.c]);
          expect(p.a >= 1 && p.a <= 3 && p.b >= 1 && p.b <= 3, `${where}: a, b in 1..3`).toBe(true);
          break;
        }
        case 'MIT-MV-25:tangent-plane': {
          const m = prompt.match(/The surface (.+?) = (-?\d+) passes through P = \((-?\d+), (-?\d+), (-?\d+)\)\. It is the level surface w = (-?\d+) of w = (.+?), so/);
          expect(m, `${where}: surface not printed`).not.toBeNull();
          const w = (x: number, y: number, z: number) => x * x + p.a * y * y + p.b * z;
          expectSame(parsePoly(m![1]), ['x', 'y', 'z'], w, where);
          expectSame(parsePoly(m![7]), ['x', 'y', 'z'], w, where);
          expect([Number(m![3]), Number(m![4]), Number(m![5])], where).toEqual([p.x0, p.y0, p.z0]);
          expect(Number(m![2]), `${where}: c printed equals w(P)`).toBe(w(p.x0, p.y0, p.z0));
          expect(Number(m![6]), where).toBe(Number(m![2]));
          expect(card.fields!.map(f => f.label), where).toEqual(['n_x', 'n_y', 'n_z', 'D']);
          break;
        }
        case 'MIT-MV-25:zero-gradient':
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], (x, y) => p.a * x * x + p.b * y * y + p.c * x + p.d * y, where);
          break;
        case 'MIT-MV-25:challenge':
          expectSame(printedPoly(prompt, 'f\\(x, y\\)', 'xy'), ['x', 'y'], (x, y) => p.a * x * x + p.b * x * y + p.c * y ** 3, where);
          expect(printedP().slice(0, 2), where).toEqual([p.x0, p.y0]);
          expect(card.fields!.map(f => f.label), where).toEqual(['f_x(P)', 'f_y(P)', 'k']);
          break;
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
      if (card.fields) expectTolerances(card, where, undefined);
    });
    expect(seen.size).toBe(9);
  }, 12000);

  it('slopes: answers are the exact double divisions and are accepted when typed as fractions', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        if (card.audit?.kind !== 'MIT-MV-25:slopes') continue;
        const q = card.audit.params as P;
        const [gx, gy] = grad2(Qfn(q), q.x0, q.y0).map(Math.round);
        const where = `${card.id} seed ${spreadSeed(i)} (f_x, f_y) = (${gx}, ${gy})`;
        expect(card.fields![0].answer, where).toBe(-gx / gy);
        expect(card.fields![1].answer, where).toBe(gy / gx);
        expect(gradeCard(card, [`${-gx}/${gy}`, `${gy}/${gx}`], null, []), where).toBe('correct');
        expect(gradeCard(card, [`${gx}/${gy}`, `${gy}/${gx}`], null, []), `${where}: wrong sign of the level-curve slope`).toBe('incorrect');
        expect(gradeCard(card, [`${gy}/${gx}`, `${-gx}/${gy}`], null, []), `${where}: slopes swapped (negative reciprocals)`).toBe('incorrect');
        expect(gradeCard(card, [String(-gx / gy + 0.001), String(gy / gx)], null, []), where).toBe('incorrect');
        // the product of the two slopes is −1: level curve ⟂ gradient
        expect(close(card.fields![0].answer * card.fields![1].answer, -1, 1e-12), where).toBe(true);
      }
    }
  }, 12000);

  it('perpendicular-vector: the three wrong options are the swapped, the tangent and the half-flipped vector', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        if (card.audit?.kind !== 'MIT-MV-25:perpendicular-vector') continue;
        const q = card.audit.params as P;
        const [gx, gy] = grad2(Qfn({ ...q, d: 0, e: 0 }), q.x0, q.y0).map(Math.round);
        const want = new Set([`${gx},${gy}`, `${gy},${gx}`, `${-gy},${gx}`, `${gx},${-gy}`]);
        const got = new Set(optionsOf(card).map(text => parseVec(text).join(',')));
        expect([...got].sort(), `${card.id} seed ${spreadSeed(i)}`).toEqual([...want].sort());
        expect(optionsOf(card).length).toBe(4);
      }
    }
  }, 12000);

  it('zero-gradient and on-surface: the wrong options are really wrong and the point sets match the notes', () => {
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch05Generators[id](spreadSeed(i), 'en')) {
        const where = `${card.id} seed ${spreadSeed(i)}`;
        if (card.audit?.kind === 'MIT-MV-25:zero-gradient') {
          const q = card.audit.params as P;
          const xs = -q.c / (2 * q.a), ys = -q.d / (2 * q.b);
          expect(Number.isInteger(xs) && Number.isInteger(ys), `${where}: critical point (${xs}, ${ys}) integer`).toBe(true);
          const got = optionsOf(card).map(parseVec).map(v => v.join(',')).sort();
          const want = [[xs, ys], [xs + 1, ys], [xs, ys + 1]].map(v => v.join(',')).sort();
          const alt = [[xs, ys], [xs + 1, ys + 1], [xs, ys + 1]].map(v => v.join(',')).sort();
          const alt2 = [[xs, ys], [xs + 1, ys], [xs + 1, ys + 1]].map(v => v.join(',')).sort();
          expect([want, alt, alt2].some(w => w.join('|') === got.join('|')), `${where}: options ${got} should be (xs, ys) plus points shifted by +1`).toBe(true);
        }
        if (card.audit?.kind === 'MIT-MV-25:on-surface') {
          const q = card.audit.params as P;
          const bad = optionsOf(card).map(parsePoint3).filter(([x, y, z]) => Math.abs(x * x + q.a * y * y + q.b * z * z - q.c) > 1e-12);
          expect(bad.length, `${where}: two points off the surface`).toBe(2);
          expect(optionsOf(card).length, where).toBe(3);
        }
      }
    }
  }, 12000);
});
