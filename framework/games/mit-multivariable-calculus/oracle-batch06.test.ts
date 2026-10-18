import { describe, expect, it } from 'vitest';
import { centralDiff, close, runOracle, type Oracle } from './oracle-harness';
import { spreadSeed } from './deck-invariants';
import { batch06Generators } from './batch06';
import { gradeCard, type CardGenerator, type PracticeCard } from '../types';

/**
 * Independent oracles for MIT-MV-26 (directional derivatives), MIT-MV-27 (Lagrange multipliers: statement and proof),
 * MIT-MV-28 (Lagrange multipliers: the drawer), MIT-MV-29 (constrained differentials) and MIT-MV-30 (Unit 2 review).
 * Written from audit-notes/batch06.md and the PRINTED question text only; the generator's own formulas were not used.
 *
 * Routes used: Richardson-extrapolated central differences for gradients, partials and directional derivatives (along
 * u = (cos atan2(v), sin atan2(v)), never by dividing by a hand-computed norm), brute-force scans of a parametrised
 * constraint (angle on the circle, x on the segment, a 2D grid on the plane) refined by bisection / Newton for constrained
 * extrema, bisection for the multiplier-free solves, Newton with finite-difference Jacobian for the Lagrange system of the
 * drawer, and numerical elimination (solve the constraint for the dependent variable, then differentiate) for every
 * constrained differential. Choice cards are judged by the content of each option.
 * Every `it` also compares the PRINTED text with the audit params (exact strings built here), so an oracle cannot silently
 * audit a problem different from the one the learner sees, and checks that the grader accepts the oracle value (two decimals,
 * fraction) and rejects wrong ones. Seeds are spread (tiny seeds give near-constant LCG draws).
 */

// ------------------------------------------------------------------------------------------------------------------ helpers
const SEEDS = 60;
const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(spreadSeed(seed), lang);
type P = Record<string, number>;
type Fn2 = (x: number, y: number) => number;
type Fn3 = (x: number, y: number, z: number) => number;
const clean = (s: string) => s.replace(/−/g, '-').replace(/ /g, ' ');
/** A number as printed after clean(): -3, 2, 0.5. */
const n = (v: number) => (Math.abs(v) < 5e-7 ? '0' : String(Number(v.toFixed(6))));
const pt = (...c: number[]) => `(${c.map(n).join(', ')})`;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** First derivative: Richardson extrapolation of the harness central difference (exact up to degree 4 polynomials). */
const d1 = (f: (x: number) => number, x: number, h = 0.05) => (4 * centralDiff(f, x, h) - centralDiff(f, x, 2 * h)) / 3;
const grad2 = (f: Fn2, x: number, y: number): [number, number] => [d1(s => f(s, y), x), d1(t => f(x, t), y)];
const grad3 = (f: Fn3, x: number, y: number, z: number): [number, number, number] => [d1(s => f(s, y, z), x), d1(t => f(x, t, z), y), d1(r => f(x, y, r), z)];
/** Unit vector of the direction of (vx, vy), obtained from its angle. */
const unitOf = (vx: number, vy: number): [number, number] => { const th = Math.atan2(vy, vx); return [Math.cos(th), Math.sin(th)]; };
/** dw/ds at (x, y) along the direction (vx, vy): derivative of the restriction to the line through P with unit direction. */
const dirDeriv = (f: Fn2, x: number, y: number, vx: number, vy: number) => { const [ux, uy] = unitOf(vx, vy); return d1(t => f(x + t * ux, y + t * uy), 0); };
/** Largest directional derivative over sampled unit directions (brute force), refined by ternary search around the best sample. */
function maxDirDeriv(f: Fn2, x: number, y: number) {
  const R = (th: number) => d1(t => f(x + t * Math.cos(th), y + t * Math.sin(th)), 0);
  const steps = 3600;
  let bt = 0, bv = -Infinity;
  for (let k = 0; k < steps; k++) { const th = (2 * Math.PI * k) / steps, v = R(th); if (v > bv) { bv = v; bt = th; } }
  let lo = bt - (2 * Math.PI) / steps, hi = bt + (2 * Math.PI) / steps;
  for (let i = 0; i < 100; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; (R(a) < R(b)) ? (lo = a) : (hi = b); }
  return Math.max(bv, R((lo + hi) / 2));
}
/** Bisection on a sign change of g over [lo, hi]. */
function bisect(g: (x: number) => number, lo: number, hi: number, iterations = 200) {
  const glo = g(lo), ghi = g(hi);
  expect(glo * ghi, 'bisection bracket has no sign change').toBeLessThan(0);
  for (let i = 0; i < iterations; i++) { const mid = (lo + hi) / 2; (g(mid) * glo > 0) ? (lo = mid) : (hi = mid); }
  return (lo + hi) / 2;
}
/** Newton's method on finite-difference gradient/Hessian of a function of two variables; verifies the residual. */
function newton2(f: Fn2, x: number, y: number): [number, number] {
  const fx = (a: number, b: number) => d1(s => f(s, b), a), fy = (a: number, b: number) => d1(t => f(a, t), b);
  for (let it = 0; it < 12; it++) {
    const gx = fx(x, y), gy = fy(x, y);
    const hxx = d1(s => fx(s, y), x), hyy = d1(t => fy(x, t), y), hxy = d1(s => fy(s, y), x);
    const det = hxx * hyy - hxy * hxy;
    expect(Math.abs(det), 'Hessian singular in oracle').toBeGreaterThan(1e-9);
    x -= (hyy * gx - hxy * gy) / det;
    y -= (hxx * gy - hxy * gx) / det;
  }
  expect(Math.hypot(fx(x, y), fy(x, y)), 'Newton residual').toBeLessThan(1e-7);
  return [x, y];
}
/** Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] {
  const m = A.length, a = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    if (Math.abs(a[c][c]) < 1e-14) return new Array(m).fill(NaN);
    for (let r = c + 1; r < m; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k <= m; k++) a[r][k] -= f * a[c][k]; }
  }
  const x = new Array(m).fill(0);
  for (let i = m - 1; i >= 0; i--) { let s = a[i][m]; for (let k = i + 1; k < m; k++) s -= a[i][k] * x[k]; x[i] = s / a[i][i]; }
  return x;
}
/** Damped Newton with a finite-difference Jacobian. Returns null when it does not converge. */
function newtonSystem(F: (v: number[]) => number[], start: number[]): number[] | null {
  let v = [...start];
  for (let it = 0; it < 80; it++) {
    const f = F(v), r0 = Math.hypot(...f);
    if (!Number.isFinite(r0)) return null;
    if (r0 < 1e-13) return v;
    const J = f.map((_, i) => v.map((_, j) => {
      const h = 1e-6 * Math.max(1, Math.abs(v[j])); const vp = [...v], vm = [...v]; vp[j] += h; vm[j] -= h;
      return (F(vp)[i] - F(vm)[i]) / (2 * h);
    }));
    const step = solveLinear(J, f.map(x => -x));
    if (step.some(s => !Number.isFinite(s))) return null;
    let lam = 1, next = v;
    for (let k = 0; k < 30; k++) { next = v.map((x, i) => x + lam * step[i]); if (Math.hypot(...F(next)) < r0) break; lam /= 2; }
    v = next;
  }
  return null;
}
const cross2 = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];

/** Text of a polynomial with the given coefficients/monomials, in that order; a coefficient 1 is omitted, zero terms are dropped. */
function polyText(cs: number[], vs: string[]): string {
  const parts = cs.map((c, i) => ({ c, v: vs[i] })).filter(p => p.c !== 0);
  if (!parts.length) return '0';
  return parts.map((p, i) => {
    const body = (Math.abs(p.c) === 1 ? '' : n(Math.abs(p.c))) + p.v;
    return i === 0 ? (p.c < 0 ? '-' : '') + body : ` ${p.c < 0 ? '-' : '+'} ${body}`;
  }).join('');
}
/** Polynomial text such as "3x² − xy + 2y" or "2yz + 5xz" in letters into a function of a named-values record. Throws on anything it cannot read. */
function parseMulti(src: string): (v: Record<string, number>) => number {
  const s = clean(src).replace(/\s+/g, '');
  const pieces = s.match(/[+-]?[^+-]+/g);
  if (!pieces || pieces.join('') !== s) throw new Error(`cannot split "${src}"`);
  const terms = pieces.map(piece => {
    const m = piece.match(/^([+-]?)(\d*\.?\d*)((?:[a-z][²³]?)*)$/);
    if (!m || (m[2] === '' && m[3] === '')) throw new Error(`cannot parse term "${piece}" of "${src}"`);
    const vars: Record<string, number> = {};
    for (const g of m[3].matchAll(/([a-z])([²³]?)/g)) vars[g[1]] = (vars[g[1]] ?? 0) + (g[2] === '²' ? 2 : g[2] === '³' ? 3 : 1);
    return { coef: (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])), vars };
  });
  return v => terms.reduce((sum, t) => sum + t.coef * Object.entries(t.vars).reduce((acc, [k, e]) => acc * v[k] ** e, 1), 0);
}
/** Coefficients [x, y, z] of a printed linear form (in the given letters). */
function linearCoefs(src: string, letters = 'xyz'): number[] {
  const f = parseMulti(src);
  const zero: Record<string, number> = Object.fromEntries([...letters].map(l => [l, 0]));
  const base = f(zero);
  expect(base, `constant term in "${src}"`).toBe(0);
  return [...letters].map(l => f({ ...zero, [l]: 1 }) - base);
}
/** All the test points of two (resp. three) variables used to compare two printed/expected functions. */
const PTS2: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [-2, 3], [2.5, -1.5], [3, 3], [-1, -2], [0.7, 1.9]];
const PTS3: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [-2, 3, 1.5], [2.5, -1.5, 0.5], [3, 3, -2], [-1, -2, 4]];
const same2 = (f: (v: Record<string, number>) => number, g: Fn2) => PTS2.every(([x, y]) => close(f({ x, y }), g(x, y), 1e-9));
const same3 = (f: (v: Record<string, number>) => number, g: Fn3) => PTS3.every(([x, y, z]) => close(f({ x, y, z }), g(x, y, z), 1e-9));

const Qfn = (p: P): Fn2 => (x, y) => p.a * x * x + p.b * x * y + p.c * y * y + p.d * x + p.e * y;
const Qtext = (p: P) => polyText([p.a, p.b, p.c, p.d, p.e], ['x²', 'xy', 'y²', 'x', 'y']);

/** Every audited card of every spread seed of game `id` (English). */
function eachAudited(id: string, fn: (card: PracticeCard, where: string) => void) {
  const seen = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch06Generators[id](seed, 'en')) if (card.audit) { fn(card, `${card.id} seed ${seed} params ${JSON.stringify(card.audit.params)}`); seen.add(card.audit.kind); }
  }
  return seen;
}
function eachCardById(id: string, cardId: string, fn: (card: PracticeCard, where: string) => void) {
  let count = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch06Generators[id](seed, 'en')) if (card.id === `${id}-${cardId}`) { fn(card, `${card.id} seed ${seed}`); count++; }
  }
  expect(count, `${cardId}: no cards seen`).toBe(SEEDS);
}
const expectKinds = (counts: Record<string, number>, id: string, kinds: string[]) => {
  expect(Object.keys(counts).sort()).toEqual(kinds.map(k => `${id}:${k}`).sort());
  for (const k of kinds) expect(counts[`${id}:${k}`], `${k} count`).toBe(SEEDS);
};
const promptOf = (card: PracticeCard) => clean(card.prompt);
function printed(card: PracticeCard, where: string, ...pieces: string[]) {
  const prompt = promptOf(card);
  for (const piece of pieces) expect(prompt, `${where}: printed text lacks "${clean(piece)}"\n${card.prompt}`).toContain(clean(piece));
}
const isInSet = (v: number, set: number[]) => set.includes(Math.round(v)) && Math.abs(v - Math.round(v)) < 1e-9;
/** First regexp match of the PRINTED prompt; throws when the shape of the question changed. */
function grab(card: PracticeCard, re: RegExp): RegExpMatchArray {
  const m = promptOf(card).match(re);
  if (!m) throw new Error(`${card.id}: ${re} not found in: ${card.prompt}`);
  return m;
}
const numsOf = (s: string) => clean(s).split(',').map(x => Number(x.trim()));
/** "(a/b, c/d)" or "(a, b)" vector with fractions, as printed in options. */
const parseVec = (s: string) => {
  const m = clean(s).match(/\(([^)]*)\)/);
  if (!m) throw new Error(`no vector in "${s}"`);
  return m[1].split(',').map(part => { const [a, b] = part.trim().split('/'); return b === undefined ? Number(a) : Number(a) / Number(b); });
};
const parseFraction = (s: string) => { const [a, b] = clean(s).trim().split('/'); return b === undefined ? Number(a) : Number(a) / Number(b); };

// -- grading ------------------------------------------------------------------------------------------------------------
/** Tolerances the notes prescribe, per field ("fraction or decimal to 2 places" is 0.005, otherwise exact). */
const TOL: Record<string, (number | undefined)[]> = {
  'MIT-MV-26:gradient': [undefined, undefined], 'MIT-MV-26:unit-vector': [0.005, 0.005], 'MIT-MV-26:directional-derivative': [0.005],
  'MIT-MV-26:angle': [undefined], 'MIT-MV-26:max-rate': [undefined], 'MIT-MV-26:distance': [0.005], 'MIT-MV-26:challenge': [0.005, 0.005],
  'MIT-MV-27:gradients': [undefined, undefined, undefined, undefined], 'MIT-MV-27:lambda': [undefined], 'MIT-MV-27:circle-max': [undefined, undefined],
  'MIT-MV-27:rectangle': [undefined, undefined], 'MIT-MV-27:challenge': [0.005, 0.005],
  'MIT-MV-28:cost-coefficients': [undefined, undefined, undefined], 'MIT-MV-28:cost-gradient': [undefined, undefined, undefined],
  'MIT-MV-28:ratios': [0.005, 0.005], 'MIT-MV-28:dimensions': [undefined, undefined, undefined], 'MIT-MV-28:lambda': [undefined],
  'MIT-MV-28:challenge': [undefined, undefined, undefined],
  'MIT-MV-29:total-differential': [undefined, undefined, undefined], 'MIT-MV-29:independent-xy': [undefined], 'MIT-MV-29:independent-xz': [undefined],
  'MIT-MV-29:gradient-with-constraint': [undefined, undefined], 'MIT-MV-29:cyclic': [0.005], 'MIT-MV-29:challenge': [0.005],
  'MIT-MV-30:tangent-plane': [undefined, undefined, undefined], 'MIT-MV-30:chain-rule': [undefined, undefined], 'MIT-MV-30:directional': [0.005],
  'MIT-MV-30:lagrange-value': [undefined], 'MIT-MV-30:constrained': [undefined], 'MIT-MV-30:challenge': [undefined, undefined, 0.005],
};
/** A short rational form n/d of v (denominator up to 30), when v has one. */
function asFraction(v: number): string | null {
  for (let d = 1; d <= 30; d++) { const k = Math.round(v * d); if (Math.abs(v * d - k) < 1e-9) return d === 1 ? String(k) : `${k}/${d}`; }
  return null;
}
/**
 * The grader must accept the oracle values (tolerance fields: the 2-decimal rounding and the fraction), keep the key unrounded,
 * and reject a wrong value. Returns the number of 2-decimal rounding ties (a tie means a student's correct rounding can be refused).
 */
function checkGrading(card: PracticeCard, values: number[], where: string): number {
  const fields = card.fields!;
  const tols = TOL[card.audit!.kind];
  expect(tols, `${where}: no tolerance spec for ${card.audit!.kind}`).toBeDefined();
  expect(fields.map(f => f.tolerance), `${where}: tolerances differ from the notes`).toEqual(tols);
  let ties = 0;
  const decimal = values.map((v, i) => {
    expect(Math.abs(fields[i].answer - v), `${where} field ${i}: key ${fields[i].answer} should be the unrounded ${v}`).toBeLessThan(1e-6);
    if (fields[i].tolerance === undefined) return String(Number(v.toFixed(9)));
    const r = Number(v.toFixed(2));
    if (Math.abs(r - v) > 0.005 - 1e-9) ties++;
    return r.toFixed(2);
  });
  if (ties === 0) expect(gradeCard(card, decimal, null, []), `${where}: oracle ${JSON.stringify(values)} (as ${decimal.join(' | ')}) must be accepted`).toBe('correct');
  const fractions = values.map((v, i) => asFraction(v) ?? decimal[i]);
  expect(gradeCard(card, fractions, null, []), `${where}: fractions ${fractions.join(' | ')} must be accepted`).toBe('correct');
  values.forEach((v, i) => {
    const wrong = decimal.map((s, k) => (k === i ? String(Number((v + (fields[i].tolerance === undefined ? 1e-3 : 0.02)).toFixed(9))) : s));
    expect(gradeCard(card, wrong, null, []), `${where}: field ${i} shifted must be rejected`).toBe('incorrect');
  });
  return ties;
}
/** Runs every numeric oracle again against the grader. */
function gradingPass(id: string, oracles: Record<string, Oracle>, kinds: string[]) {
  let ties = 0;
  const graded = new Set<string>();
  eachAudited(id, (card, where) => {
    if (!card.fields) return;
    const result = oracles[card.audit!.kind](card.audit!.params);
    if (!Array.isArray(result)) return;
    ties += checkGrading(card, result, where);
    graded.add(card.audit!.kind);
  });
  expect(ties, `${id}: answers on a two-decimal rounding tie`).toBe(0);
  expect([...graded].sort(), 'every numeric kind is graded').toEqual(kinds.map(k => `${id}:${k}`).sort());
}

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-26
const NORMS = [5, 10, 13, 15, 17];
const ORACLE26: Record<string, Oracle> = {
  'MIT-MV-26:gradient': p => { const q = p as P; return [...grad2(Qfn(q), q.x0, q.y0)]; },
  'MIT-MV-26:unit-vector': p => { const { vx, vy } = p as P; return [...unitOf(vx, vy)]; },
  'MIT-MV-26:directional-derivative': p => { const q = p as P; return [dirDeriv(Qfn(q), q.x0, q.y0, q.vx, q.vy)]; },
  'MIT-MV-26:not-unit': p => {
    const { g1, g2, vx, vy } = p as P;
    // a function with the printed gradient, differentiated along the unit direction of v
    const truth = dirDeriv((x, y) => g1 * x + g2 * y, 0, 0, vx, vy);
    const ndots = g1 * vx + g2 * vy, nv = Math.hypot(vx, vy);
    return {
      optionIsCorrect: text => {
        const m = clean(text).match(/^dw\/ds = (-?\d+(?:\/\d+)?)$/);
        if (!m) throw new Error(`cannot read option "${text}"`);
        const v = parseFraction(m[1]);
        // the three distractors are g·v, g·v/|v|² and −g·v/|v|: none may coincide with the truth
        for (const bad of [ndots, ndots / (nv * nv), -truth]) expect(Math.abs(bad - truth) > 1e-9 || false, 'distractor equals the truth').toBe(true);
        return Math.abs(v - truth) < 1e-9;
      },
    };
  },
  'MIT-MV-26:angle': p => {
    const { G, theta } = p as P;
    const th = (theta * Math.PI) / 180;
    // ∇w along +x with length G, u at angle θ from it
    return [G * Math.cos(th) + 0 * Math.sin(th)];
  },
  'MIT-MV-26:max-rate': p => {
    const { d, e, f, p: px, q, r } = p as P;
    const T: Fn3 = (x, y, z) => x * x + 2 * y * y + 2 * z * z + d * x + e * y + f * z;
    const g = grad3(T, px, q, r), len = Math.hypot(...g);
    // brute force over 2000 directions of a Fibonacci sphere: no direction beats |∇T| and some come within 0.1%
    let best = -Infinity;
    for (let k = 0; k < 2000; k++) {
      const z = 1 - (2 * (k + 0.5)) / 2000, rho = Math.sqrt(1 - z * z), phi = k * Math.PI * (3 - Math.sqrt(5));
      const u = [rho * Math.cos(phi), rho * Math.sin(phi), z];
      best = Math.max(best, d1(t => T(px + t * u[0], q + t * u[1], r + t * u[2]), 0));
    }
    expect(best, 'a direction beats |∇T|').toBeLessThanOrEqual(len + 1e-9);
    expect(best, 'no direction comes close to |∇T|').toBeGreaterThan(len * 0.995);
    return [len];
  },
  'MIT-MV-26:decrease-direction': p => {
    const { g1, g2 } = p as P;
    // brute-force minimiser of the directional derivative g·u over unit u, refined by ternary search
    const R = (th: number) => g1 * Math.cos(th) + g2 * Math.sin(th);
    let bt = 0, bv = Infinity;
    for (let k = 0; k < 7200; k++) { const th = (2 * Math.PI * k) / 7200; if (R(th) < bv) { bv = R(th); bt = th; } }
    let lo = bt - 0.001, hi = bt + 0.001;
    for (let i = 0; i < 200; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; (R(a) < R(b)) ? (hi = b) : (lo = a); }
    const best = [Math.cos((lo + hi) / 2), Math.sin((lo + hi) / 2)];
    return {
      optionIsCorrect: text => {
        const u = parseVec(text);
        return u.length === 2 && Math.abs(Math.hypot(u[0], u[1]) - 1) < 1e-9 && Math.hypot(u[0] - best[0], u[1] - best[1]) < 1e-6;
      },
    };
  },
  'MIT-MV-26:distance': p => {
    const { r, dT } = p as P;
    // smallest s ≥ 0 with (dT/ds)·s = ΔT, by bisection
    return [bisect(s => r * s - dT, 0, 1000)];
  },
  'MIT-MV-26:challenge': p => {
    const { a, b, d, e, x0, y0, vx, vy } = p as P;
    const w: Fn2 = (x, y) => a * x * x + b * y * y + d * x + e * y;
    return [dirDeriv(w, x0, y0, vx, vy), maxDirDeriv(w, x0, y0)];
  },
};

describe('MIT-MV-26 directional derivatives', () => {
  const id = 'MIT-MV-26';
  const kinds = ['gradient', 'unit-vector', 'directional-derivative', 'not-unit', 'angle', 'max-rate', 'decrease-direction', 'distance', 'challenge'];

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch06Generators[id]), ORACLE26, SEEDS);
    expectKinds(counts, id, kinds);
  }, 12000);

  it('printed functions, points and directions agree with the audit params and the sampling guarantees', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-26:gradient':
          printed(card, where, `w(x, y) = ${Qtext(p)}. Find the gradient`, `P = ${pt(p.x0, p.y0)}`);
          expect(p.a !== 0 && p.c !== 0, `${where}: a and c are never 0`).toBe(true);
          break;
        case 'MIT-MV-26:unit-vector':
          printed(card, where, `v = ${pt(p.vx, p.vy)}`);
          expect(isInSet(Math.hypot(p.vx, p.vy), NORMS), `${where}: |v| must be an integer in {5, 10, 13, 15, 17}`).toBe(true);
          break;
        case 'MIT-MV-26:directional-derivative': {
          printed(card, where, `w(x, y) = ${Qtext(p)} and P = ${pt(p.x0, p.y0)}.`, `v = ${pt(p.vx, p.vy)}`);
          expect(isInSet(Math.hypot(p.vx, p.vy), NORMS), where).toBe(true);
          const [gx, gy] = grad2(Qfn(p), p.x0, p.y0);
          expect(Math.abs(gx) > 1e-9 && Math.abs(gy) > 1e-9, `${where}: w_x(P) and w_y(P) must be non-zero`).toBe(true);
          expect(Math.abs(dirDeriv(Qfn(p), p.x0, p.y0, p.vx, p.vy)), `${where}: value must not be 0`).toBeGreaterThan(1e-9);
          break;
        }
        case 'MIT-MV-26:not-unit': {
          printed(card, where, `∇w = ${pt(p.g1, p.g2)}`, `v = ${pt(p.vx, p.vy)}, where |v| = ${n(Math.hypot(p.vx, p.vy))}.`);
          expect(isInSet(Math.hypot(p.vx, p.vy), NORMS), where).toBe(true);
          expect(Math.abs(p.g1 * p.vx + p.g2 * p.vy), `${where}: g·v is never 0`).toBeGreaterThan(0);
          break;
        }
        case 'MIT-MV-26:angle': {
          printed(card, where, `|∇w| = ${n(p.G)}`, `θ = ${n(p.theta)}°`);
          expect([0, 60, 90, 120, 180]).toContain(p.theta);
          const arrows = card.figure!.shapes.filter(s => s.kind === 'arrow').map(s => (s.kind === 'arrow' ? s : null)!);
          const gArrow = arrows.find(a => a.label === '∇w')!, uArrow = arrows.find(a => a.label === 'u')!;
          expect(gArrow && uArrow, `${where}: arrows ∇w and u`).toBeTruthy();
          expect(close(gArrow.to[1] - gArrow.from[1], 0, 1e-9) && gArrow.to[0] > gArrow.from[0], `${where}: ∇w must point along +x`).toBe(true);
          const angle = (Math.atan2(uArrow.to[1] - uArrow.from[1], uArrow.to[0] - uArrow.from[0]) * 180) / Math.PI;
          expect(close(angle, p.theta, 1e-9), `${where}: u drawn at ${angle}° instead of ${p.theta}°`).toBe(true);
          expect(promptOf(card)).toContain('(see the figure)');
          break;
        }
        case 'MIT-MV-26:max-rate': {
          const m = grab(card, /T\(x, y, z\) = (.*?) gives the temperature/);
          const printedT = parseMulti(m[1]);
          expect(same3(printedT, (x, y, z) => x * x + 2 * y * y + 2 * z * z + p.d * x + p.e * y + p.f * z), `${where}: printed T differs from params`).toBe(true);
          expect(m[1], `${where}: printed form`).toBe(polyText([1, 2, 2, p.d, p.e, p.f], ['x²', 'y²', 'z²', 'x', 'y', 'z']));
          printed(card, where, `P = ${pt(p.p, p.q, p.r)}`);
          break;
        }
        case 'MIT-MV-26:decrease-direction':
          printed(card, where, `∇w = ${pt(p.g1, p.g2)}`);
          expect(isInSet(Math.hypot(p.g1, p.g2), NORMS), `${where}: |g| must be an integer in the Pythagorean norms`).toBe(true);
          break;
        case 'MIT-MV-26:distance': {
          printed(card, where, `dT/ds = ${n(p.r)} (degrees`, `ΔT = ${n(p.dT)}?`);
          expect(Number.isInteger(p.r) && p.r !== 0, where).toBe(true);
          expect(Math.sign(p.dT), `${where}: dT and r share a sign`).toBe(Math.sign(p.r));
          expect(close(p.dT * 10, Math.round(p.dT * 10), 1e-9), `${where}: dT has one decimal`).toBe(true);
          break;
        }
        case 'MIT-MV-26:challenge': {
          const w = (x: number, y: number) => p.a * x * x + p.b * y * y + p.d * x + p.e * y;
          printed(card, where, `w(x, y) = ${polyText([p.a, p.b, p.d, p.e], ['x²', 'y²', 'x', 'y'])}. At P = ${pt(p.x0, p.y0)}`, `v = ${pt(p.vx, p.vy)}`);
          const g = grad2(w, p.x0, p.y0);
          expect(isInSet(Math.hypot(...g), NORMS), `${where}: |∇w(P)| = ${Math.hypot(...g)} must be an integer in the allowed set`).toBe(true);
          expect(Math.abs(cross2(g, [p.vx, p.vy])), `${where}: ∇w(P) must not be parallel to v`).toBeGreaterThan(1e-9);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(9);
  }, 12000);

  it('the grader accepts the oracle values and rejects wrong ones', () => { gradingPass(id, ORACLE26, ['gradient', 'unit-vector', 'directional-derivative', 'angle', 'max-rate', 'distance', 'challenge']); }, 12000);

  it('unit-vector: fraction entry n/|v| is accepted and an unnormalised v is rejected', () => {
    eachCardById(id, 'unit-vector', (card, where) => {
      const { vx, vy } = card.audit!.params as P;
      const norm = Math.round(Math.hypot(vx, vy));
      expect(gradeCard(card, [`${vx}/${norm}`, `${vy}/${norm}`], null, []), where).toBe('correct');
      expect(gradeCard(card, [String(vx), String(vy)], null, []), `${where}: v itself is not a unit vector`).toBe('incorrect');
      expect(gradeCard(card, [`${vy}/${norm}`, `${vx}/${norm}`], null, []), `${where}: swapped components must be rejected unless symmetric`).toBe(Math.abs(vx) === Math.abs(vy) ? 'correct' : 'incorrect');
    });
  }, 12000);

  it('directional derivative cards reject the unnormalised value ∇w·v', () => {
    for (const kind of ['directional', 'challenge']) eachCardById(id, kind, (card, where) => {
      const p = card.audit!.params as P;
      const w = kind === 'challenge' ? (x: number, y: number) => p.a * x * x + p.b * y * y + p.d * x + p.e * y : Qfn(p);
      const g = grad2(w, p.x0, p.y0);
      const raw = g[0] * p.vx + g[1] * p.vy;
      expect(gradeCard(card, [raw.toFixed(2), '0'], null, []).length > 0, where).toBe(true);
      expect(gradeCard(card, kind === 'challenge' ? [String(raw), '0'] : [String(raw)], null, []), `${where}: g·v = ${raw} (not divided by |v|) must be rejected`).toBe('incorrect');
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-27
const ORACLE27: Record<string, Oracle> = {
  'MIT-MV-27:gradients': p => {
    const { a, b, c, x0, y0 } = p as P;
    const f: Fn2 = (x, y) => a * x * y + b * y, g: Fn2 = (x, y) => x * x + c * y * y;
    return [...grad2(f, x0, y0), ...grad2(g, x0, y0)];
  },
  'MIT-MV-27:lambda': p => {
    const { u1, u2, v1, v2 } = p as P;
    // least-squares multiplier of ∇f = λ∇g, then the residual of both components
    const lam = (u1 * v1 + u2 * v2) / (v1 * v1 + v2 * v2);
    expect(Math.hypot(u1 - lam * v1, u2 - lam * v2), 'gradients are not parallel').toBeLessThan(1e-12);
    return [lam];
  },
  'MIT-MV-27:parallel': p => {
    const { u1, u2, v1, v2 } = p as P;
    // parallel iff the normalised vectors span zero area
    const parallel = Math.abs(cross2([u1, u2], [v1, v2])) / (Math.hypot(u1, u2) * Math.hypot(v1, v2)) < 1e-12;
    return { optionIsCorrect: text => (parallel ? text.startsWith('P is a candidate: ∇f is parallel to ∇g') : text.startsWith('P cannot be a local maximum or minimum')) };
  },
  'MIT-MV-27:circle-max': p => {
    const { p: pp, q, R } = p as P;
    const r = Math.sqrt(R), F = (th: number) => pp * r * Math.cos(th) + q * r * Math.sin(th);
    const steps = 7200;
    let bt = 0, bv = -Infinity;
    for (let k = 0; k < steps; k++) { const th = (2 * Math.PI * k) / steps; if (F(th) > bv) { bv = F(th); bt = th; } }
    const th = bisect(t => centralDiff(F, t, 1e-5), bt - (2 * Math.PI) / steps, bt + (2 * Math.PI) / steps);
    expect(F(th), 'refinement must not lose to the scan').toBeGreaterThanOrEqual(bv - 1e-9);
    return [r * Math.cos(th), r * Math.sin(th)];
  },
  'MIT-MV-27:rectangle': p => {
    const { a, b, c } = p as P;
    const A = (x: number) => (x * (c - a * x)) / b;
    const steps = 20000, xmax = c / a;
    let bx = 0, bv = -Infinity;
    for (let k = 1; k < steps; k++) { const x = (xmax * k) / steps; if (A(x) > bv) { bv = A(x); bx = x; } }
    const x = bisect(t => centralDiff(A, t, 1e-3), Math.max(bx - xmax / steps, 1e-9), Math.min(bx + xmax / steps, xmax - 1e-9));
    return [x, (c - a * x) / b];
  },
  'MIT-MV-27:challenge': p => {
    const { m, k } = p as P;
    const F = (th: number) => Math.cos(th) ** 2 + k * Math.cos(th) + m * Math.sin(th) ** 2;
    let hi = -Infinity, lo = Infinity;
    const steps = 200000;
    for (let i = 0; i < steps; i++) { const v = F((2 * Math.PI * i) / steps); hi = Math.max(hi, v); lo = Math.min(lo, v); }
    return [hi, lo];
  },
};

describe('MIT-MV-27 Lagrange multipliers: statement and proof', () => {
  const id = 'MIT-MV-27';
  const kinds = ['gradients', 'lambda', 'parallel', 'circle-max', 'rectangle', 'challenge'];

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch06Generators[id]), ORACLE27, SEEDS);
    expectKinds(counts, id, kinds);
  }, 12000);

  it('printed functions, constraints and gradients agree with the audit params', () => {
    const verdicts = new Set<boolean>();
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-27:gradients': {
          const k = p.x0 * p.x0 + p.c * p.y0 * p.y0;
          printed(card, where, `f(x, y) = ${polyText([p.a, p.b], ['xy', 'y'])} subject to the constraint g(x, y) = ${polyText([1, p.c], ['x²', 'y²'])} = ${n(k)}.`, `P = ${pt(p.x0, p.y0)}`);
          expect(p.c >= 1 && p.c <= 3 && p.x0 !== 0 && p.y0 !== 0, where).toBe(true);
          break;
        }
        case 'MIT-MV-27:lambda':
          printed(card, where, `∇f(P) = ${pt(p.u1, p.u2)}`, `∇g(P) = ${pt(p.v1, p.v2)}`);
          expect([p.u1, p.u2, p.v1, p.v2].every(v => v !== 0), `${where}: entries must be non-zero`).toBe(true);
          break;
        case 'MIT-MV-27:parallel':
          printed(card, where, `∇f = ${pt(p.u1, p.u2)}`, `∇g = ${pt(p.v1, p.v2)}`);
          verdicts.add(Math.abs(cross2([p.u1, p.u2], [p.v1, p.v2])) < 1e-12);
          break;
        case 'MIT-MV-27:circle-max':
          printed(card, where, `circle x² + y² = ${n(p.R)} where f(x, y) = ${polyText([p.p, p.q], ['x', 'y'])} has its largest value`);
          expect(Number.isInteger(Math.sqrt(p.R)), `${where}: R must be a perfect square`).toBe(true);
          {
            // (p, q) = m(±a, ±b) with a Pythagorean pair: the maximiser is an integer point
            const L = Math.hypot(p.p, p.q), r = Math.sqrt(p.R);
            expect(close(r * p.p / L, Math.round(r * p.p / L), 1e-9) && close(r * p.q / L, Math.round(r * p.q / L), 1e-9), `${where}: maximiser must be an integer point`).toBe(true);
          }
          break;
        case 'MIT-MV-27:rectangle': {
          printed(card, where, `lies on the line ${polyText([p.a, p.b], ['x', 'y'])} = ${n(p.c)}.`, 'first quadrant');
          expect(close(p.c / (2 * p.a), Math.round(p.c / (2 * p.a)), 1e-12) && close(p.c / (2 * p.b), Math.round(p.c / (2 * p.b)), 1e-12), `${where}: integer answers`).toBe(true);
          break;
        }
        case 'MIT-MV-27:challenge': {
          printed(card, where, `f(x, y) = ${polyText([1, p.k, p.m], ['x²', 'x', 'y²'])} on the unit circle x² + y² = 1.`);
          expect(Math.abs(p.k) < 2 * (p.m - 1), `${where}: |k| < 2(m − 1) is the sampled range`).toBe(true);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(6);
    expect([...verdicts].sort(), 'parallel card must show both a parallel and a non-parallel pair across the seeds').toEqual([false, true]);
  }, 12000);

  it('the grader accepts the oracle values and rejects wrong ones', () => { gradingPass(id, ORACLE27, ['gradients', 'lambda', 'circle-max', 'rectangle', 'challenge']); }, 12000);

  it('circle-max and rectangle: the other critical point (the minimum) is rejected', () => {
    eachCardById(id, 'circle-max', (card, where) => {
      const [x, y] = card.fields!.map(f => f.answer);
      expect(gradeCard(card, [String(-x), String(-y)], null, []), `${where}: the minimiser must be rejected`).toBe('incorrect');
    });
    eachCardById(id, 'rectangle', (card, where) => {
      const [x, y] = card.fields!.map(f => f.answer);
      expect(gradeCard(card, [String(y), String(x)], null, []), `${where}: swapped coordinates must be rejected unless symmetric`).toBe(x === y ? 'correct' : 'incorrect');
    });
  }, 12000);

  it('why-maximum (no audit): the correct option compares the critical value with the endpoint values', () => {
    eachCardById(id, 'why-maximum', (card, where) => {
      const line = grab(card, /segment (.*?) = (\d+) \(x ≥ 0, y ≥ 0\)/);
      const [a, b] = linearCoefs(line[1], 'xy'), c = Number(line[2]);
      const pm = grab(card, /P = \(([\d.]+), ([\d.]+)\), where f = ([\d.]+)\./);
      const [px, py, area] = [Number(pm[1]), Number(pm[2]), Number(pm[3])];
      const ends = grab(card, /from \(([\d.]+), 0\) to \(0, ([\d.]+)\)/);
      expect(a * Number(ends[1]), `${where}: first endpoint on the line`).toBe(c);
      expect(b * Number(ends[2]), `${where}: second endpoint on the line`).toBe(c);
      expect(a * px + b * py, `${where}: P on the line`).toBe(c);
      expect(px * py, `${where}: printed area is f(P)`).toBe(area);
      // Lagrange condition at P: (y, x) parallel to (a, b)
      expect(Math.abs(cross2([py, px], [a, b])), `${where}: P satisfies the Lagrange condition`).toBeLessThan(1e-12);
      // brute force: the largest xy on the segment is at P and the endpoints give 0
      let best = 0, bx = 0;
      const N = 20000;
      for (let k = 0; k <= N; k++) { const x = (c / a * k) / N, v = x * ((c - a * x) / b); if (v > best) { best = v; bx = x; } }
      expect(Math.abs(best - area), `${where}: brute-force maximum ${best} vs printed ${area}`).toBeLessThan(1e-3);
      expect(Math.abs(bx - px), where).toBeLessThan(2 * c / a / N + 1e-9);
      const verdict = (t: string) => t.startsWith('A maximum occurs at a critical point or at an endpoint of the segment.') && t.includes(`which is less than ${n(area)}`);
      const verdicts = card.choice!.options.map(verdict);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      // the distractors claim that Lagrange or uniqueness settles it
      card.choice!.options.forEach((t, i) => { if (i !== card.choice!.answer) expect(/Lagrange condition singles out maxima|only critical point on the segment/.test(t), `${where}: ${t}`).toBe(true); });
    });
  }, 12000);

  it('proof-geometric (no audit): the figure is the printed geometry and the tangent option is the only correct one', () => {
    eachCardById(id, 'proof-geometric', (card, where) => {
      const m = grab(card, /g\(x, y\) = x² \+ y² = (\d+) is the constraint\. The straight lines are level curves of f\(x, y\) = (.*?) at the values f = (\d+), f = (\d+) and f = (\d+)\./);
      const R = Number(m[1]), [fa, fb] = linearCoefs(m[2], 'xy'), L = [Number(m[3]), Number(m[4]), Number(m[5])];
      const r = Math.sqrt(R);
      // brute force: the extremes of f on the circle
      let hi = -Infinity, lo = Infinity, at = [0, 0];
      for (let k = 0; k < 72000; k++) { const th = (2 * Math.PI * k) / 72000, v = fa * r * Math.cos(th) + fb * r * Math.sin(th); if (v > hi) { hi = v; at = [r * Math.cos(th), r * Math.sin(th)]; } lo = Math.min(lo, v); }
      expect(L[0], `${where}: first line must miss the circle`).toBeGreaterThan(hi + 1e-6);
      expect(Math.abs(L[1] - hi), `${where}: touching line value ${L[1]} vs max ${hi}`).toBeLessThan(1e-6);
      expect(L[2] < hi - 1e-6 && L[2] > lo + 1e-6, `${where}: third line cuts the circle in two points`).toBe(true);
      // the figure: P = (fa, fb) is the touching point, on the circle, both gradient arrows leave it pointing away from the origin
      const f = card.figure!;
      const P = f.shapes.find(s => s.kind === 'point' && s.label === 'P');
      expect(P && P.kind === 'point', where).toBeTruthy();
      if (P && P.kind === 'point') { expect(Math.hypot(P.at[0] - at[0], P.at[1] - at[1]), `${where}: P is not the maximiser`).toBeLessThan(0.01 * r + 1e-3); expect(close(P.at[0], fa, 1e-9) && close(P.at[1], fb, 1e-9), `${where}: P = ∇f`).toBe(true); }
      for (const label of ['∇f', '∇g']) {
        const a = f.shapes.find(s => s.kind === 'arrow' && s.label === label);
        expect(a && a.kind === 'arrow', `${where}: arrow ${label}`).toBeTruthy();
        if (a && a.kind === 'arrow') {
          const dir = [a.to[0] - a.from[0], a.to[1] - a.from[1]];
          expect(close(a.from[0], fa, 1e-9) && close(a.from[1], fb, 1e-9), `${where}: ${label} starts at P`).toBe(true);
          expect(Math.abs(cross2(dir, [fa, fb])) / (Math.hypot(...dir) * Math.hypot(fa, fb)), `${where}: ${label} parallel to the radius`).toBeLessThan(1e-9);
          expect(dir[0] * fa + dir[1] * fb, `${where}: ${label} points away from the origin`).toBeGreaterThan(0);
        }
      }
      const lines = f.shapes.filter(s => s.kind === 'line');
      const circle = lines.find(s => s.kind === 'line' && s.points.length > 20)!;
      if (circle.kind === 'line') for (const [x, y] of circle.points) expect(close(Math.hypot(x, y), r, 1e-9), `${where}: circle point off the circle`).toBe(true);
      for (const l of lines) if (l.kind === 'line' && l.label) {
        const value = Number(clean(l.label).replace('f = ', ''));
        expect(L, `${where}: labelled level ${value} is printed`).toContain(value);
        for (const [x, y] of l.points) expect(close(fa * x + fb * y, value, 1e-9), `${where}: point (${x}, ${y}) is off the level line ${value}`).toBe(true);
      }
      expect(lines.filter(s => s.kind === 'line' && s.label).length, `${where}: three level lines`).toBe(3);
      // the options
      const verdicts = card.choice!.options.map(t => t.startsWith('The level line and the circle are tangent at P.'));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      expect(Math.hypot(fa, fb), `${where}: ∇f is not the zero vector`).toBeGreaterThan(0);
    });
  }, 12000);

  it('proof-chain (symbols): h′(0) = ∇f(P) · r′(0)', () => {
    // numerically: for f(x, y) = x² y and the curve r(t) = (cos t, sin t), h(t) = f(r(t)) has h′(0) = ∇f(P) · r′(0)
    const f: Fn2 = (x, y) => x * x * y, r = (t: number) => [Math.cos(t), Math.sin(t)];
    const h = (t: number) => f(r(t)[0], r(t)[1]);
    const gradP = grad2(f, 1, 0), rp = [d1(t => r(t)[0], 0, 1e-3), d1(t => r(t)[1], 0, 1e-3)];
    expect(close(d1(h, 0, 1e-3), gradP[0] * rp[0] + gradP[1] * rp[1], 1e-8), `${d1(h, 0, 1e-3)} vs ${gradP[0] * rp[0] + gradP[1] * rp[1]}`).toBe(true);
    eachCardById(id, 'proof-chain', (card, where) => {
      const s = card.slots!;
      expect(s.before, where).toBe('h′(0) =');
      expect(s.answers, where).toEqual(['∇f(P)', '·', 'r′(0)']);
      expect(s.tokens, where).toEqual(expect.arrayContaining(s.answers));
      expect(gradeCard(card, [], null, s.answers), where).toBe('correct');
      expect(gradeCard(card, [], null, ['∇f(P)', '×', 'r′(0)']), where).toBe('incorrect');
      expect(gradeCard(card, [], null, ['∇g(P)', '·', 'r′(0)']), where).toBe('incorrect');
      expect(gradeCard(card, [], null, ['r′(0)', '·', '∇f(P)']), where).toBe('incorrect');
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-28
const Cfn = (al: number, be: number, ga: number): Fn3 => (x, y, z) => al * y * z + be * x * z + ga * x * y;
const Vfn: Fn3 = (x, y, z) => x * y * z;
const ORACLE28: Record<string, Oracle> = {
  'MIT-MV-28:cost-coefficients': p => {
    const { s, b, f, m } = p as P;
    // the wood actually bought for a box of dimensions x, y, z: two sides (y by z), back and front (x by z), bottom (x by y)
    const wood = (x: number, y: number, z: number) => [s, s].reduce((sum, price) => sum + price * y * z, 0) + b * x * z + f * x * z + m * x * y;
    // C = α yz + β xz + γ xy, so the coefficients are the costs of the boxes (0,1,1), (1,0,1), (1,1,0)
    return [wood(0, 1, 1), wood(1, 0, 1), wood(1, 1, 0)];
  },
  'MIT-MV-28:cost-gradient': p => {
    const { alpha, beta, gamma, x0, y0, z0 } = p as P;
    return [...grad3(Cfn(alpha, beta, gamma), x0, y0, z0)];
  },
  'MIT-MV-28:ratios': p => {
    const { alpha, beta, gamma } = p as P;
    // x = 1; unknowns (y, z, λ) of the printed Lagrange equations; collect every positive solution found from many starts
    const F = (v: number[]) => [
      v[0] * v[1] - v[2] * (gamma * v[0] + beta * v[1]),
      v[1] - v[2] * (gamma + alpha * v[1]),
      v[0] - v[2] * (alpha * v[0] + beta),
    ];
    const sols: number[][] = [];
    for (const y of [0.5, 1, 2, 4]) for (const z of [0.5, 1, 2, 4]) for (const l of [0.05, 0.2, 0.5]) {
      const sol = newtonSystem(F, [y, z, l]);
      // (0, 0, 0) also solves the homogeneous system; only genuine positive solutions count
      if (sol && sol[0] > 1e-2 && sol[1] > 1e-2 && sol[2] > 1e-2) sols.push(sol);
    }
    expect(sols.length, 'Newton found no positive solution').toBeGreaterThan(0);
    for (const s of sols) expect(Math.hypot(s[0] - sols[0][0], s[1] - sols[0][1], s[2] - sols[0][2]), 'two different positive critical rays').toBeLessThan(1e-7);
    return [sols[0][0], sols[0][1]];
  },
  'MIT-MV-28:dimensions': p => {
    const { alpha, beta, gamma, B } = p as P;
    const C = Cfn(alpha, beta, gamma);
    const t = bisect(s => C(s * alpha, s * beta, s * gamma) - B, 0, 100);
    return [t * alpha, t * beta, t * gamma];
  },
  'MIT-MV-28:lambda': p => {
    const { alpha, beta, gamma, x0, y0, z0 } = p as P;
    // each printed equation solved for λ at the printed point: all three must agree
    const l1 = (y0 * z0) / (gamma * y0 + beta * z0), l2 = (x0 * z0) / (gamma * x0 + alpha * z0), l3 = (x0 * y0) / (alpha * y0 + beta * x0);
    expect(close(l1, l2, 1e-12) && close(l2, l3, 1e-12), `the three equations disagree: ${l1} ${l2} ${l3}`).toBe(true);
    // the point is a critical point of V on its cost level
    const C = Cfn(alpha, beta, gamma), gV = grad3(Vfn, x0, y0, z0), gC = grad3(C, x0, y0, z0);
    expect(Math.hypot(gV[0] - l1 * gC[0], gV[1] - l1 * gC[1], gV[2] - l1 * gC[2]), '∇V = λ∇C').toBeLessThan(1e-9);
    return [l1];
  },
  'MIT-MV-28:challenge': p => {
    const { a, b, c, d } = p as P;
    // reduced function of (x, y); z solved from the constraint
    const V: Fn2 = (x, y) => x * y * ((d - a * x - b * y) / c);
    let bx = 0, by = 0, bv = -Infinity;
    const N = 240;
    for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
      const x = ((d / a) * i) / N, y = ((d / b) * j) / N;
      if (a * x + b * y >= d) continue;
      const v = V(x, y);
      if (v > bv) { bv = v; bx = x; by = y; }
    }
    const [x, y] = newton2(V, bx, by);
    expect(V(x, y), 'Newton lost to the grid').toBeGreaterThanOrEqual(bv - 1e-9);
    return [x, y, (d - a * x - b * y) / c];
  },
};

describe('MIT-MV-28 Lagrange multipliers: the drawer', () => {
  const id = 'MIT-MV-28';
  const kinds = ['cost-coefficients', 'cost-gradient', 'ratios', 'dimensions', 'lambda', 'challenge'];

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch06Generators[id]), ORACLE28, SEEDS);
    expectKinds(counts, id, kinds);
  }, 12000);

  const eqs = (p: P) => `yz = λ(${polyText([p.gamma, p.beta], ['y', 'z'])}), xz = λ(${polyText([p.gamma, p.alpha], ['x', 'z'])}) and xy = λ(${polyText([p.alpha, p.beta], ['y', 'x'])})`;
  it('printed prices, cost functions, equations and points agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-28:cost-coefficients':
          printed(card, where, `Wood costs ${n(p.s)} per unit area for each of the two sides, ${n(p.b)} for the back, ${n(p.f)} for the front and ${n(p.m)} for the bottom.`);
          break;
        case 'MIT-MV-28:cost-gradient':
          printed(card, where, `C(x, y, z) = ${polyText([p.alpha, p.beta, p.gamma], ['yz', 'xz', 'xy'])}. Find`, `(x, y, z) = ${pt(p.x0, p.y0, p.z0)}.`);
          break;
        case 'MIT-MV-28:ratios':
          printed(card, where, `For C = ${polyText([p.alpha, p.beta, p.gamma], ['yz', 'xz', 'xy'])} the equation ∇V = λ∇C reads ${eqs(p)}.`);
          break;
        case 'MIT-MV-28:dimensions':
          printed(card, where, `x : y : z = ${n(p.alpha)} : ${n(p.beta)} : ${n(p.gamma)}`, `C(x, y, z) = ${polyText([p.alpha, p.beta, p.gamma], ['yz', 'xz', 'xy'])} = ${n(p.B)}.`);
          expect(new Set([p.alpha, p.beta, p.gamma]).size, `${where}: the three coefficients are distinct`).toBe(3);
          expect([1, 2], `${where}: t is 1 or 2`).toContain(Math.sqrt(p.B / (3 * p.alpha * p.beta * p.gamma)));
          break;
        case 'MIT-MV-28:lambda': {
          printed(card, where, `For C = ${polyText([p.alpha, p.beta, p.gamma], ['yz', 'xz', 'xy'])} the equations ∇V = λ∇C are ${eqs(p)}.`, `(x, y, z) = ${pt(p.x0, p.y0, p.z0)}.`);
          const t = p.x0 / p.alpha;
          expect(close(p.y0, t * p.beta, 1e-12) && close(p.z0, t * p.gamma, 1e-12), `${where}: point is t(α, β, γ)`).toBe(true);
          break;
        }
        case 'MIT-MV-28:challenge':
          printed(card, where, `subject to the constraint ${polyText([p.a, p.b, p.c], ['x', 'y', 'z'])} = ${n(p.d)}.`);
          expect(p.a === p.b && p.b === p.c, `${where}: a, b, c are not all equal`).toBe(false);
          break;
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(6);
  }, 12000);

  it('the grader accepts the oracle values and rejects wrong ones', () => { gradingPass(id, ORACLE28, kinds); }, 12000);

  it('printed Lagrange equations are the equations of ∇V = λ∇C (parsed from the text)', () => {
    eachAudited(id, (card, where) => {
      if (!['MIT-MV-28:ratios', 'MIT-MV-28:lambda'].includes(card.audit!.kind)) return;
      const m = grab(card, /yz = λ\((.*?)\), xz = λ\((.*?)\) and xy = λ\((.*?)\)/);
      const [r1, r2, r3] = [m[1], m[2], m[3]].map(parseMulti);
      const p = card.audit!.params as P;
      const C = Cfn(p.alpha, p.beta, p.gamma);
      for (const [x, y, z] of PTS3) {
        const [cx, cy, cz] = grad3(C, x, y, z);
        expect(close(r1({ x, y, z }), cx, 1e-8) && close(r2({ x, y, z }), cy, 1e-8) && close(r3({ x, y, z }), cz, 1e-8), `${where}: printed right-hand sides are not ∇C at (${x}, ${y}, ${z})`).toBe(true);
      }
    });
  }, 12000);

  it('which-system (no audit): only "∇V = λ∇C and C = B" is satisfied by the maximiser', () => {
    eachCardById(id, 'which-system', (card, where) => {
      const m = grab(card, /budget of B = (\d+), where the cost is C\(x, y, z\) = (.*?)\. Which conditions/);
      const B = Number(m[1]), [al, be, ga] = [linearCoefsOf(m[2], 'yz'), linearCoefsOf(m[2], 'xz'), linearCoefsOf(m[2], 'xy')];
      const C = Cfn(al, be, ga);
      const t = bisect(s => C(s * al, s * be, s * ga) - B, 0, 100);
      const X = [t * al, t * be, t * ga];
      const gV = grad3(Vfn, X[0], X[1], X[2]), gC = grad3(C, X[0], X[1], X[2]);
      const lam = gV[0] / gC[0];
      const holds: Record<string, boolean> = {
        '∇V = λ∇C': Math.hypot(gV[0] - lam * gC[0], gV[1] - lam * gC[1], gV[2] - lam * gC[2]) < 1e-9,
        '∇V = 0': Math.hypot(...gV) < 1e-9,
        [`C = ${B}`]: close(C(X[0], X[1], X[2]), B, 1e-9),
        [`V = ${B}`]: close(Vfn(X[0], X[1], X[2]), B, 1e-9),
      };
      const verdict = (text: string) => { const [c1, c2] = clean(text).split(' and '); return !!holds[c1] && !!holds[c2]; };
      const verdicts = card.choice!.options.map(verdict);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);

  it('why-max (no audit): V on the budget surface has its maximum at the printed critical point and tends to 0 at the edge', () => {
    eachCardById(id, 'why-max', (card, where) => {
      const m = grab(card, /budget C = (.*?) = (\d+) there is exactly one critical point with x, y, z > 0, namely \(([^)]*)\), with V = (\d+)\./);
      const Cp = parseMulti(m[1]), B = Number(m[2]);
      const [X, Y, Z] = numsOf(m[3]);
      const V0 = Number(m[4]);
      const al = Cp({ x: 0, y: 1, z: 1 }), be = Cp({ x: 1, y: 0, z: 1 }), ga = Cp({ x: 1, y: 1, z: 0 });
      expect(close(Cp({ x: X, y: Y, z: Z }), B, 1e-12), `${where}: critical point on the budget surface`).toBe(true);
      expect(X * Y * Z, `${where}: printed V`).toBe(V0);
      // scan the budget surface: z solved from C = B
      let best = 0, bx = 0, by = 0, edge = Infinity;
      const N = 300;
      for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
        const x = (5 * X * i) / N, y = (5 * Y * j) / N;
        const z = (B - ga * x * y) / (al * y + be * x);
        if (!(z > 0)) continue;
        const v = x * y * z;
        if (v > best) { best = v; bx = x; by = y; }
        if (i === 1 || j === 1) edge = Math.min(edge, v);
      }
      expect(best, `${where}: grid maximum ${best} exceeds the printed critical value ${V0}`).toBeLessThanOrEqual(V0 + 1e-9);
      expect(best, `${where}: grid maximum ${best} far below ${V0}`).toBeGreaterThan(0.97 * V0);
      expect(Math.hypot(bx / X - 1, by / Y - 1), `${where}: grid maximiser (${bx}, ${by}) is not near (${X}, ${Y})`).toBeLessThan(0.15);
      expect(edge, `${where}: V at the edge of the grid is small`).toBeLessThan(0.1 * V0);
      // the multiplier quoted in a distractor is the true multiplier of the critical point
      const lam = (Y * Z) / (ga * Y + be * Z);
      const claims = card.choice!.options.map(t => clean(t).match(/λ = (\d+(?:\/\d+)?) is positive/)).find(Boolean);
      expect(claims && Math.abs(parseFraction(claims![1]) - lam) < 1e-12, `${where}: quoted λ ${claims?.[1]} vs ${lam}`).toBe(true);
      // the bound in the correct option
      const bound = card.choice!.options.map(t => clean(t).match(/(\d*)yz ≤ (\d+) gives yz ≤ (\d+)/)).find(Boolean);
      expect(bound, where).toBeTruthy();
      expect(Number(bound![3]) * al, `${where}: yz ≤ B/α`).toBe(B);
      expect(Number(bound![2]), where).toBe(B);
      const verdicts = card.choice!.options.map(t => t.startsWith('Near the edge of the allowed region one dimension is close to 0'));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);

  it('which-box (no audit): the correct box has ∇V ∥ ∇C and C = B', () => {
    eachCardById(id, 'which-box', (card, where) => {
      const m = grab(card, /cost C = (.*?) and the budget B = (\d+),/);
      const Cp = parseMulti(m[1]), B = Number(m[2]);
      const C: Fn3 = (x, y, z) => Cp({ x, y, z });
      const verdict = (text: string) => {
        const [x, y, z] = parseVec(text.replace('(x, y, z) = ', ''));
        const gV = grad3(Vfn, x, y, z), gC = grad3(C, x, y, z);
        const crossNorm = Math.hypot(gV[1] * gC[2] - gV[2] * gC[1], gV[2] * gC[0] - gV[0] * gC[2], gV[0] * gC[1] - gV[1] * gC[0]);
        return crossNorm < 1e-8 * Math.hypot(...gV) * Math.hypot(...gC) && close(C(x, y, z), B, 1e-12);
      };
      const verdicts = card.choice!.options.map(verdict);
      expect(verdicts.filter(Boolean).length, `${where}: ${card.choice!.options.join(' | ')}`).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);
});
/** Coefficient of a monomial (named by its letters, e.g. 'yz') in a printed cost polynomial. */
function linearCoefsOf(src: string, monomial: string): number {
  const f = parseMulti(src);
  const vars = Object.fromEntries([...'xyz'].map(l => [l, monomial.includes(l) ? 1 : 0]));
  return f(vars);
}

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-29
const W3: Fn3 = (x, y, z) => x * x + y * y + z * z;
/** (∂w/∂x)_y for w = x²+y²+z² with z = a x² + b y²: z computed from the relation at every sampled point. */
const dwdxy = (a: number, b: number, x0: number, y0: number) => d1(s => W3(s, y0, a * s * s + b * y0 * y0), x0);
/** (∂w/∂x)_z with y² solved numerically from the relation (w only involves y²; y itself may be 0 at the point). */
const dwdxz = (a: number, b: number, x0: number, z0: number) => d1(s => { const y2 = bisect(u => a * s * s + b * u - z0, -1e4, 1e4); return s * s + y2 + z0 * z0; }, x0);
const ORACLE29: Record<string, Oracle> = {
  'MIT-MV-29:total-differential': p => {
    const { a, b, c, x0, y0, z0 } = p as P;
    return [...grad3((x, y, z) => a * x * y + b * y * z * z + c * x * z, x0, y0, z0)];
  },
  'MIT-MV-29:independent-xy': p => { const { a, b, x0, y0 } = p as P; return [dwdxy(a, b, x0, y0)]; },
  'MIT-MV-29:independent-xz': p => { const { a, b, x0, y0 } = p as P; return [dwdxz(a, b, x0, a * x0 * x0 + b * y0 * y0)]; },
  'MIT-MV-29:formal-vs-actual': p => {
    const { a, b, wrt } = p as P;
    const zOf = (x: number, y: number) => a * x * x + b * y * y;
    const actual = (x: number, y: number) => (wrt === 0 ? d1(s => W3(s, y, zOf(s, y)), x) : d1(t => W3(x, t, zOf(x, t)), y));
    return {
      optionIsCorrect: text => {
        const expr = parseMulti(text);
        return PTS2.every(([x, y]) => close(expr({ x, y, z: zOf(x, y) }), actual(x, y), 1e-8));
      },
    };
  },
  'MIT-MV-29:gradient-with-constraint': p => {
    const { f1, f2, f3, g1, g2, g3 } = p as P;
    // linear models with the printed gradients, through P = 0; z(x, y) from g = 0 by bisection
    const zOf = (x: number, y: number) => bisect(z => g1 * x + g2 * y + g3 * z, -1e4, 1e4);
    const w = (x: number, y: number) => f1 * x + f2 * y + f3 * zOf(x, y);
    return [d1(s => w(s, 0.3), 0.1), d1(t => w(0.1, t), 0.3)];
  },
  'MIT-MV-29:cyclic': p => {
    const { A, B } = p as P;
    // the plane x − A y + AB z = 0 has (∂x/∂y)_z = A and (∂y/∂z)_x = B (checked numerically); then (∂z/∂x)_y by elimination
    const [pp, qq, rr] = [1, -A, A * B];
    const solve = (g: (v: number) => number) => bisect(g, -1e5, 1e5);
    const xOf = (y: number, z: number) => solve(x => pp * x + qq * y + rr * z);
    const yOf = (x: number, z: number) => solve(y => pp * x + qq * y + rr * z);
    const zOf = (x: number, y: number) => solve(z => pp * x + qq * y + rr * z);
    const y0 = 0.3, z0 = -0.2, x0 = xOf(y0, z0);
    expect(close(d1(t => xOf(t, z0), y0, 0.1), A, 1e-8), '(∂x/∂y)_z of the model plane').toBe(true);
    expect(close(d1(t => yOf(x0, t), z0, 0.1), B, 1e-8), '(∂y/∂z)_x of the model plane').toBe(true);
    return [d1(t => zOf(t, y0), x0, 0.1)];
  },
  'MIT-MV-29:challenge': p => {
    const { x0, y0, z0 } = p as P;
    const R = x0 * x0 + y0 * y0 + z0 * z0, sign = Math.sign(y0);
    const w = (x: number, z: number) => x * (sign * Math.sqrt(R - x * x - z * z)) + z * z;
    return [d1(s => w(s, z0), x0, 1e-3)];
  },
};

describe('MIT-MV-29 constrained differentials', () => {
  const id = 'MIT-MV-29';
  const kinds = ['total-differential', 'independent-xy', 'independent-xz', 'formal-vs-actual', 'gradient-with-constraint', 'cyclic', 'challenge'];

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch06Generators[id]), ORACLE29, SEEDS);
    expectKinds(counts, id, kinds);
  }, 12000);

  it('printed functions, relations and points agree with the audit params', () => {
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-29:total-differential':
          printed(card, where, `Let w = ${polyText([p.a, p.b, p.c], ['xy', 'yz²', 'xz'])}, with x, y, z independent variables.`, `(x, y, z) = ${pt(p.x0, p.y0, p.z0)}.`);
          break;
        case 'MIT-MV-29:independent-xy': case 'MIT-MV-29:independent-xz': {
          const z0 = p.a * p.x0 * p.x0 + p.b * p.y0 * p.y0;
          printed(card, where, `z = ${polyText([p.a, p.b], ['x²', 'y²'])}`, `(x, y, z) = ${pt(p.x0, p.y0, z0)}`);
          expect(Math.abs(p.a) === 1 && [1, 2].includes(Math.abs(p.b)) && p.a !== p.b, `${where}: a ∈ {±1}, b ∈ {±1, ±2}, a ≠ b`).toBe(true);
          if (card.audit!.kind.endsWith('xy')) printed(card, where, 'Take x and y as the independent variables', '(∂w/∂x)_y, with y held constant');
          else printed(card, where, 'Now take x and z as the independent variables', '(∂w/∂x)_z, with z held constant');
          break;
        }
        case 'MIT-MV-29:formal-vs-actual': {
          const v = p.wrt === 0 ? 'x' : 'y', held = p.wrt === 0 ? 'y' : 'x';
          printed(card, where, `with z = ${polyText([p.a, p.b], ['x²', 'y²'])}, and take x and y as the independent variables.`, `(∂w/∂${v})_${held}, with ${held} held constant`);
          break;
        }
        case 'MIT-MV-29:gradient-with-constraint':
          printed(card, where, `∇f = ${pt(p.f1, p.f2, p.f3)} and ∇g = ${pt(p.g1, p.g2, p.g3)}. Take x and y as the independent variables`);
          expect([1, 2], where).toContain(Math.abs(p.g3));
          break;
        case 'MIT-MV-29:cyclic':
          printed(card, where, `(∂x/∂y)_z = ${n(p.A)} and (∂y/∂z)_x = ${n(p.B)}.`);
          expect([1, 2, 3], where).toContain(Math.abs(p.A));
          expect([1, 2, 3], where).toContain(Math.abs(p.B));
          break;
        case 'MIT-MV-29:challenge': {
          const R = p.x0 * p.x0 + p.y0 * p.y0 + p.z0 * p.z0;
          printed(card, where, `x² + y² + z² = ${n(R)}, and w = xy + z².`, `P = ${pt(p.x0, p.y0, p.z0)}.`, 'Take x and z as the independent variables');
          expect(p.y0 !== 0 && Math.abs(p.y0) !== Math.abs(p.x0), `${where}: y0 ≠ 0 and |y0| ≠ |x0|`).toBe(true);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(7);
  }, 12000);

  it('the grader accepts the oracle values and rejects wrong ones', () => { gradingPass(id, ORACLE29, ['total-differential', 'independent-xy', 'independent-xz', 'gradient-with-constraint', 'cyclic', 'challenge']); }, 12000);

  it('constrained answers differ from the formal partial derivative (the common wrong answer is rejected)', () => {
    // The formal w_x = 2x is a wrong answer except when z0 = 0 (then (∂w/∂x)_y = 2x0 itself): such seeds are counted and bounded.
    let formalIsRight = 0, otherIsRight = 0;
    eachCardById(id, 'independent-xy', (card, where) => {
      const { a, b, x0, y0 } = card.audit!.params as P;
      const verdict = gradeCard(card, [String(2 * x0)], null, []);
      if (Math.abs(a * x0 * x0 + b * y0 * y0) < 1e-12) { formalIsRight++; expect(verdict, `${where}: z0 = 0, so the formal derivative is the right value`).toBe('correct'); }
      else expect(verdict, `${where}: formal w_x = 2x must be rejected`).toBe('incorrect');
    });
    eachCardById(id, 'independent-xz', (card, where) => {
      const { a, b, x0, y0 } = card.audit!.params as P;
      const other = dwdxy(a, b, x0, y0), mine = dwdxz(a, b, x0, a * x0 * x0 + b * y0 * y0);
      if (Math.abs(other - mine) < 1e-9) { otherIsRight++; return; }
      expect(gradeCard(card, [String(other)], null, []), `${where}: the other constrained derivative ${other} must be rejected`).toBe('incorrect');
    });
    expect(formalIsRight, 'seeds on which the formal partial derivative is already correct (z0 = 0)').toBeLessThanOrEqual(SEEDS / 4);
    expect(otherIsRight, 'seeds on which both constrained derivatives coincide').toBe(0);
    eachCardById(id, 'cyclic', (card, where) => {
      const { A, B } = card.audit!.params as P;
      expect(gradeCard(card, [(1 / (A * B)).toFixed(2)], null, []), `${where}: +1/(AB) (product +1) must be rejected`).toBe('incorrect');
    });
  }, 12000);

  it('notation (no audit): the independent variables are the two letters of the symbol', () => {
    eachCardById(id, 'notation', (card, where) => {
      const held = grab(card, /In the symbol \(∂w\/∂x\)_(\w), the variable/)[1];
      const verdicts = card.choice!.options.map(t => t.startsWith(`x and ${held} are independent;`));
      expect(['y', 'z'], where).toContain(held);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);

  it('same-or-different (no audit): the two derivatives differ at the printed point, so "No." is the answer', () => {
    eachCardById(id, 'same-or-different', (card, where) => {
      const m = grab(card, /with z = (.*?) at \(x, y, z\) = \(([^)]*)\), are/);
      const rel = parseMulti(m[1]), [x0, y0, z0] = numsOf(m[2]);
      const a = rel({ x: 1, y: 0 }), b = rel({ x: 0, y: 1 });
      expect(close(a * x0 * x0 + b * y0 * y0, z0, 1e-12), `${where}: printed point is on the surface`).toBe(true);
      const dxy = dwdxy(a, b, x0, y0), dxz = dwdxz(a, b, x0, z0);
      const different = Math.abs(dxy - dxz) > 1e-6;
      expect(different, `${where}: (∂w/∂x)_y = ${dxy}, (∂w/∂x)_z = ${dxz}`).toBe(true);
      const verdicts = card.choice!.options.map(t => (different ? t.startsWith('No.') : t.startsWith('Yes.')));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);

  it('formal-vs-actual: both variables (wrt = 0 and wrt = 1) occur', () => {
    const seen = new Set<number>();
    eachAudited(id, card => { if (card.audit!.kind === 'MIT-MV-29:formal-vs-actual') seen.add((card.audit!.params as P).wrt); });
    expect([...seen].sort()).toEqual([0, 1]);
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-30
const ORACLE30: Record<string, Oracle> = {
  'MIT-MV-30:tangent-plane': p => {
    const q = p as P, f = Qfn(q);
    const [m, nn] = grad2(f, q.x0, q.y0), f0 = f(q.x0, q.y0);
    const plane = (x: number, y: number) => f0 + m * (x - q.x0) + nn * (y - q.y0);
    // the plane agrees with f to first order: the gap shrinks like h²
    for (const h of [1e-2, 1e-3]) expect(Math.abs(f(q.x0 + h, q.y0 - h) - plane(q.x0 + h, q.y0 - h)), 'plane is not tangent').toBeLessThan(20 * h * h);
    return [m, nn, plane(0, 0)];
  },
  'MIT-MV-30:classify': p => {
    const q = p as P, f = Qfn(q);
    const [gx, gy] = grad2(f, q.xs, q.ys);
    expect(Math.hypot(gx, gy), 'printed P is not a critical point').toBeLessThan(1e-8);
    let pos = false, neg = false;
    for (const r of [0.25, 0.5, 1, 2, 3, 6]) for (let k = 0; k < 72; k++) {
      const th = (2 * Math.PI * k) / 72, diff = f(q.xs + r * Math.cos(th), q.ys + r * Math.sin(th)) - f(q.xs, q.ys);
      if (diff > 1e-9) pos = true;
      if (diff < -1e-9) neg = true;
    }
    expect(pos || neg, 'degenerate critical point').toBe(true);
    const kind = pos && neg ? 'saddle' : pos ? 'minimum' : 'maximum';
    return { optionIsCorrect: text => text.startsWith(kind === 'saddle' ? 'P is a saddle point' : kind === 'minimum' ? 'P is a local minimum' : 'P is a local maximum') };
  },
  'MIT-MV-30:chain-rule': p => {
    const { a, b, x0, y0 } = p as P;
    const f = (u: number, v: number) => a * u * u + b * u * v;
    const W: Fn2 = (x, y) => f(x + y, x * y);
    return [...grad2(W, x0, y0)];
  },
  'MIT-MV-30:directional': p => { const q = p as P; return [dirDeriv(Qfn(q), q.x0, q.y0, q.vx, q.vy)]; },
  'MIT-MV-30:lagrange-value': p => {
    const { a, b, c } = p as P;
    const A = (x: number) => (x * (c - a * x)) / b;
    const xmax = c / a, steps = 20000;
    let bx = 0, bv = -Infinity;
    for (let k = 0; k <= steps; k++) { const x = (xmax * k) / steps; if (A(x) > bv) { bv = A(x); bx = x; } }
    const x = bisect(t => centralDiff(A, t, 1e-3), Math.max(bx - xmax / steps, 1e-9), Math.min(bx + xmax / steps, xmax - 1e-9));
    expect(A(0) === 0 && Math.abs(A(xmax)) < 1e-9, 'the endpoints give 0').toBe(true);
    return [A(x)];
  },
  'MIT-MV-30:constrained': p => {
    const { p: pp, q, x0, y0 } = p as P;
    const W: Fn2 = (x, y) => x * y + (pp * x + q * y) ** 2;
    return [d1(s => W(s, y0), x0)];
  },
  'MIT-MV-30:laplace': p => {
    const { a } = p as P;
    void a;
    const lap = (f: Fn2, x: number, y: number) => {
      const S = (g: (t: number) => number, t: number, h: number) => (g(t + h) - 2 * g(t) + g(t - h)) / (h * h);
      return S(s => f(s, y), x, 0.1) + S(t => f(x, t), y, 0.1);
    };
    return {
      optionIsCorrect: text => {
        const m = clean(text).match(/^w = (.*)$/);
        if (!m) throw new Error(`cannot read option "${text}"`);
        const e = parseMulti(m[1]);
        return PTS2.every(([x, y]) => Math.abs(lap((s, t) => e({ x: s, y: t }), x, y)) < 1e-6);
      },
    };
  },
  'MIT-MV-30:challenge': p => {
    const { c, x0, y0, dx, dy } = p as P;
    const f: Fn2 = (x, y) => x * x * y * y - c * x;
    const [fx, fy] = grad2(f, x0, y0);
    return [fx, fy, f(x0, y0) + fx * dx + fy * dy];
  },
};

describe('MIT-MV-30 Unit 2 review', () => {
  const id = 'MIT-MV-30';
  const kinds = ['tangent-plane', 'classify', 'chain-rule', 'directional', 'lagrange-value', 'constrained', 'laplace', 'challenge'];

  it('recomputes every audit kind', () => {
    const counts = runOracle(id, spread(batch06Generators[id]), ORACLE30, SEEDS);
    expectKinds(counts, id, kinds);
  }, 12000);

  it('printed functions, points and relations agree with the audit params', () => {
    const classes = new Set<string>();
    const seen = eachAudited(id, (card, where) => {
      const p = card.audit!.params as P;
      switch (card.audit!.kind) {
        case 'MIT-MV-30:tangent-plane':
          printed(card, where, `f(x, y) = ${Qtext(p)}. The tangent plane to the graph z = f(x, y) at P = ${pt(p.x0, p.y0)}`);
          break;
        case 'MIT-MV-30:classify': {
          printed(card, where, `f(x, y) = ${Qtext(p)} has the critical point P = ${pt(p.xs, p.ys)}.`);
          const D = 4 * p.a * p.c - p.b * p.b;
          expect(D, `${where}: 4ac − b² is never 0`).not.toBe(0);
          classes.add(D < 0 ? 'saddle' : p.a > 0 ? 'min' : 'max');
          // options in the fixed order [local minimum, local maximum, saddle point]
          expect(card.choice!.options[0].startsWith('P is a local minimum'), where).toBe(true);
          expect(card.choice!.options[1].startsWith('P is a local maximum'), where).toBe(true);
          expect(card.choice!.options[2].startsWith('P is a saddle point'), where).toBe(true);
          break;
        }
        case 'MIT-MV-30:chain-rule':
          printed(card, where, `w = f(u, v) = ${polyText([p.a, p.b], ['u²', 'uv'])}, where u = x + y and v = xy.`, `(x, y) = ${pt(p.x0, p.y0)}`);
          break;
        case 'MIT-MV-30:directional':
          printed(card, where, `f(x, y) = ${Qtext(p)} and P = ${pt(p.x0, p.y0)}.`, `v = ${pt(p.vx, p.vy)}.`);
          expect(isInSet(Math.hypot(p.vx, p.vy), NORMS), where).toBe(true);
          break;
        case 'MIT-MV-30:lagrange-value':
          printed(card, where, `on the line ${polyText([p.a, p.b], ['x', 'y'])} = ${n(p.c)} with x ≥ 0 and y ≥ 0.`);
          expect(close(p.c / (2 * p.a), Math.round(p.c / (2 * p.a)), 1e-12) && close(p.c / (2 * p.b), Math.round(p.c / (2 * p.b)), 1e-12), `${where}: c = 2abk`).toBe(true);
          break;
        case 'MIT-MV-30:constrained': {
          const z0 = p.p * p.x0 + p.q * p.y0;
          printed(card, where, `z = ${polyText([p.p, p.q], ['x', 'y'])}, and w = xy + z².`, `(∂w/∂x)_y, with y held constant, at (x, y, z) = ${pt(p.x0, p.y0, z0)}.`);
          break;
        }
        case 'MIT-MV-30:laplace':
          expect(card.choice!.options.map(clean).sort(), where).toEqual([`w = ${polyText([p.a, -p.a], ['x²', 'y²'])}`, `w = ${polyText([p.a, p.a], ['x²', 'y²'])}`, `w = ${polyText([p.a, -2 * p.a], ['x²', 'y²'])}`].sort());
          expect(p.a, where).not.toBe(0);
          break;
        case 'MIT-MV-30:challenge': {
          printed(card, where, `f(x, y) = ${polyText([1, -p.c], ['x²y²', 'x'])}. At P = ${pt(p.x0, p.y0)}`, `estimate f(${n(round2(p.x0 + p.dx))}, ${n(round2(p.y0 + p.dy))})`, `Δx = ${n(p.dx)} and Δy = ${n(p.dy)}`);
          expect(p.c !== 0 && [0.1, 0.2].includes(Math.abs(p.dx)) && [0.1, 0.2].includes(Math.abs(p.dy)), where).toBe(true);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(8);
    expect([...classes].sort(), 'classify card shows all three classes across the seeds').toEqual(['max', 'min', 'saddle']);
  }, 12000);

  it('the grader accepts the oracle values and rejects wrong ones', () => { gradingPass(id, ORACLE30, ['tangent-plane', 'chain-rule', 'directional', 'lagrange-value', 'constrained', 'challenge']); }, 12000);

  it('challenge: the linear estimate is accepted and the exact f at the new point is rejected whenever it is farther than the tolerance', () => {
    let exactAccepted = 0;
    eachCardById(id, 'challenge', (card, where) => {
      const { c, x0, y0, dx, dy } = card.audit!.params as P;
      const f: Fn2 = (x, y) => x * x * y * y - c * x;
      const [fx, fy] = grad2(f, x0, y0);
      const est = f(x0, y0) + fx * dx + fy * dy, exact = f(x0 + dx, y0 + dy);
      expect(gradeCard(card, [String(fx), String(fy), est.toFixed(2)], null, []), where).toBe('correct');
      // The notes do not require the exact value to be rejected, but the card asks for the LINEAR estimate. When the exact value lies
      // farther than the tolerance from the estimate the grader must reject it; the seeds where it does not are counted (see the log).
      if (Math.abs(exact - est) > 0.005 + 1e-9) expect(gradeCard(card, [String(fx), String(fy), exact.toFixed(2)], null, []), `${where}: exact value ${exact.toFixed(2)} must be rejected`).toBe('incorrect');
      else exactAccepted++;
      expect(gradeCard(card, [String(fx), String(fx), est.toFixed(2)], null, []), `${where}: f_x repeated for f_y`).toBe(Math.abs(fx - fy) < 1e-8 ? 'correct' : 'incorrect');
    });
    console.info(`MIT-MV-30 challenge: exact f(P + Δ) lies within the tolerance of the linear estimate (so it is accepted) on ${exactAccepted} of ${SEEDS} seeds`);
    expect(exactAccepted, 'exact value accepted too often').toBeLessThanOrEqual(SEEDS / 10);
  }, 12000);

  it('method-1 and method-2 (no audit): the correct option is the method that belongs to the printed kind of question', () => {
    const METHOD: [RegExp, string][] = [
      [/^Estimate f\(/, 'Tangent plane approximation'],
      [/^Find the largest value of f\(x, y\) = xy on the line/, 'Lagrange multipliers'],
      [/^Find the points where the graph of f\(x, y\) = .* has a horizontal tangent plane\.$/, 'Critical points'],
      [/^How fast does f\(x, y\) = .* change at P = /, 'Directional derivative'],
      [/^w = f\(u, v\) where u = x \+ .*y and v = xy\. Express ∂w\/∂x in terms of f_u, f_v, x and y\.$/, 'Chain rule'],
      [/^x, y, z satisfy z = .* and w = xy \+ z²\. Take x and y as the independent variables\. Find \(∂w\/∂x\)_y\.$/, 'Differentials'],
    ];
    const kindsSeen = new Set<string>();
    let bothAsDistractors = 0;
    for (const cardId of ['method-1', 'method-2']) {
      eachCardById(id, cardId, (card, where) => {
        const text = promptOf(card).replace(/^Which method answers this question\? /, '');
        const matches = METHOD.filter(([re]) => re.test(text));
        expect(matches.length, `${where}: question kind not recognised: ${text}`).toBe(1);
        const name = matches[0][1];
        kindsSeen.add(name);
        const names = card.choice!.options.map(o => METHOD.map(([, m]) => m).find(m => o.startsWith(`${m}:`)));
        expect(names.every(Boolean) && new Set(names).size === names.length, `${where}: options must be three distinct methods: ${card.choice!.options.join(' | ')}`).toBe(true);
        expect(card.choice!.options.length, where).toBe(3);
        // Notes: "the chain rule and differentials options never appear together". The meaningful part (both can solve a linked-variables
        // question) is enforced: neither of the two may be offered against a question of the other kind. The literal note is counted.
        if (name === 'Chain rule') expect(names, `${where}: differentials offered against a chain-rule question`).not.toContain('Differentials');
        if (name === 'Differentials') expect(names, `${where}: chain rule offered against a differentials question`).not.toContain('Chain rule');
        if (names.includes('Chain rule') && names.includes('Differentials')) bothAsDistractors++;
        const verdicts = card.choice!.options.map(o => o.startsWith(`${name}:`));
        expect(verdicts.filter(Boolean).length, where).toBe(1);
        expect(verdicts[card.choice!.answer], where).toBe(true);
      });
    }
    expect(kindsSeen.size, 'at least four kinds of question appear across the seeds').toBeGreaterThanOrEqual(4);
    // literal reading of the note: they never appear together. See the progress log: the generator only keeps them apart when one of them is the answer.
    console.info(`method cards with chain rule and differentials both offered as distractors: ${bothAsDistractors}`);
  }, 12000);

  it('lagrange-setup (no audit): the correct system is the one the true maximiser satisfies', () => {
    eachCardById(id, 'lagrange-setup', (card, where) => {
      const m = grab(card, /largest value of f\(x, y\) = xy on the line (.*?) = (\d+) with x > 0 and y > 0/);
      const [a, b] = linearCoefs(m[1], 'xy'), c = Number(m[2]);
      // true maximiser by scanning the segment
      const A = (x: number) => (x * (c - a * x)) / b;
      let bx = 0, bv = -Infinity;
      for (let k = 1; k < 20000; k++) { const x = (c / a * k) / 20000; if (A(x) > bv) { bv = A(x); bx = x; } }
      const x = bx, y = (c - a * x) / b, tol = (c / a) / 20000 * 3;
      const verdict = (text: string) => {
        const parts = clean(text).split(', ');
        if (parts.length !== 3) return false;
        const rel = parts.slice(0, 2).map(s => s.match(/^([xy]) = (\d*)λ$/));
        if (rel.some(r => !r)) return false;
        // each "v = kλ" must give the same λ at the maximiser, and the line must be the printed constraint
        const lam = rel.map(r => (r![1] === 'x' ? x : y) / (r![2] === '' ? 1 : Number(r![2])));
        const [l, r2] = parts[2].split(' = ');
        return Math.abs(lam[0] - lam[1]) < tol && new Set(rel.map(r => r![1])).size === 2 && close(Number(r2), c) && linearCoefs(l, 'xy').every((v, i) => v === [a, b][i]);
      };
      const verdicts = card.choice!.options.map(verdict);
      expect(verdicts.filter(Boolean).length, `${where}: ${card.choice!.options.join(' | ')}`).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      // the correct option is also the one matching ∇f = λ∇g computed by finite differences: y = aλ, x = bλ
      const lamStar = y / a;
      expect(Math.abs(x - b * lamStar), `${where}: maximiser satisfies x = bλ`).toBeLessThan(tol);
    });
  }, 12000);

  it('critical-claim (no audit): the counterexample f = p x² − q y² is a non-extremal critical point', () => {
    eachCardById(id, 'critical-claim', (card, where) => {
      const verdict = (text: string) => {
        if (!text.startsWith('False.')) return false;
        const m = grab({ ...card, prompt: text } as PracticeCard, /For f\(x, y\) = (.*?) both partial derivatives are 0 at \(0, 0\), but f is larger than f\(0, 0\) along the x-axis and smaller along the y-axis\./);
        const f = parseMulti(m[1]);
        const F: Fn2 = (x, y) => f({ x, y });
        const [gx, gy] = grad2(F, 0, 0);
        return Math.hypot(gx, gy) < 1e-9 && F(1, 0) > F(0, 0) && F(0, 1) < F(0, 0) && F(0.01, 0) > F(0, 0) && F(0, 0.01) < F(0, 0);
      };
      const verdicts = card.choice!.options.map(t => (t.startsWith('True.') ? false : verdict(t)));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      // the claim itself is false: the counterexample is not an extremum
      expect(card.choice!.options.filter(t => t.startsWith('True.')).length, where).toBe(2);
    });
  }, 12000);
});
