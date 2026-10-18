import { describe, expect, it } from 'vitest';
import { centralDiff, close, runOracle, type Oracle } from './oracle-harness';
import { spreadSeed } from './deck-invariants';
import { batch04Generators } from './batch04';
import { gradeCard, type CardGenerator, type PracticeCard } from '../types';

/**
 * Independent oracles for MIT-MV-18 (partial derivatives), MIT-MV-19 (tangent plane approximation), MIT-MV-20 (optimization).
 * Written from audit-notes/batch04.md and the printed question text only. Gradients, partials and mixed partials come from
 * Richardson-extrapolated central differences (exact for the polynomials used here), critical points from Newton's method on
 * finite-difference gradients/Hessians or from bisection, classification and the reciprocal box problem from brute-force scans.
 * Every `it` also checks that the PRINTED polynomial and point in the prompt equal the audit params, so an oracle cannot
 * silently audit a problem different from the one the learner sees. Seeds are spread (tiny seeds give near-constant LCG draws).
 */

// ------------------------------------------------------------------------------------------------------------------ helpers
const SEEDS = 60;
const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(spreadSeed(seed), lang);
type P = Record<string, number>;
type Fn2 = (x: number, y: number) => number;
const clean = (s: string) => s.replace(/−/g, '-').replace(/ /g, ' ');
/** Number as printed after clean(): -3, 2, 0.5. */
const n = (v: number) => (Math.abs(v) < 5e-7 ? '0' : String(Number(v.toFixed(6))));
const hasPoint = (prompt: string, x: number, y: number) => clean(prompt).includes(`(${n(x)}, ${n(y)})`);
const round1 = (v: number) => Math.round(v * 10) / 10;

/** First derivative: Richardson extrapolation of the harness central difference (exact up to degree 4 polynomials). */
const d1 = (f: (x: number) => number, x: number, h = 0.05) => (4 * centralDiff(f, x, h) - centralDiff(f, x, 2 * h)) / 3;
const fx = (f: Fn2, x: number, y: number) => d1(s => f(s, y), x);
const fy = (f: Fn2, x: number, y: number) => d1(t => f(x, t), y);
/** ∂/∂x(∂f/∂y), cross-checked against the other order (the polynomials have continuous second partials). */
function mixedXY(f: Fn2, x: number, y: number) {
  const a = d1(s => d1(t => f(s, t), y), x);
  const b = d1(t => d1(s => f(s, t), x), y);
  expect(close(a, b, 1e-7), `mixed partials differ by order: ${a} vs ${b}`).toBe(true);
  return a;
}
/** Newton's method on finite-difference gradient and Hessian of a function of two variables; verifies the residual. */
function newton2(f: Fn2, x = 0.5, y = -0.5): [number, number] {
  for (let it = 0; it < 8; it++) {
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
/** Bisection on a sign change of g over [lo, hi]. */
function bisect(g: (x: number) => number, lo: number, hi: number, iterations = 100) {
  const glo = g(lo), ghi = g(hi);
  expect(glo * ghi, 'bisection bracket has no sign change').toBeLessThan(0);
  for (let i = 0; i < iterations; i++) { const mid = (lo + hi) / 2; (g(mid) * glo > 0) ? (lo = mid) : (hi = mid); }
  return (lo + hi) / 2;
}

// families, written with literal coefficients (not the generator's term lists)
const Qfn = (p: P): Fn2 => (x, y) => p.a * x * x + p.b * x * y + p.c * y * y + p.d * x + p.e * y;
const Dfn = (p: P): Fn2 => (x, y) => p.a * x * x + p.b * y * y + p.c * x + p.d * y + p.e;

/** Polynomial text such as "3x² − xy + 2y − 5" or "x³" into a function of (x, y). Throws on anything it cannot read. */
function parsePoly(src: string): Fn2 {
  const s = clean(src).replace(/\s+/g, '');
  const pieces = s.match(/[+-]?[^+-]+/g);
  if (!pieces || pieces.join('') !== s) throw new Error(`cannot split polynomial "${src}"`);
  const pow = (g: string | undefined) => (g === undefined ? 0 : g.length === 1 ? 1 : g[1] === '²' ? 2 : g[1] === '³' ? 3 : Number(g.slice(2)));
  const terms = pieces.map(piece => {
    const m = piece.match(/^([+-]?)(\d*\.?\d*)(x(?:\^\d+|[²³])?)?(y(?:\^\d+|[²³])?)?$/);
    if (!m) throw new Error(`cannot parse term "${piece}" of "${src}"`);
    const hasVar = !!(m[3] || m[4]);
    if (m[2] === '' && !hasVar) throw new Error(`empty term in "${src}"`);
    const coef = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    return { coef, i: pow(m[3]), j: pow(m[4]) };
  });
  return (x, y) => terms.reduce((sum, t) => sum + t.coef * x ** t.i * y ** t.j, 0);
}
const PROMPT_POLY = /f\(x, y\) = ([0-9xy²³^\s+−-]+)/;
const polyOfText = (text: string): Fn2 => {
  const m = text.match(PROMPT_POLY);
  if (!m) throw new Error(`no "f(x, y) = ..." in: ${text}`);
  return parsePoly(m[1].trim());
};
const TEST_POINTS: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [-2, 3], [2.5, -1.5], [3, 3], [-1, -2], [0.7, 1.9]];
const samePolynomial = (f: Fn2, g: Fn2) => TEST_POINTS.every(([x, y]) => close(f(x, y), g(x, y), 1e-9));
/** Fails when the polynomial printed in the card's prompt is not the one the audit params describe. */
function expectPrintedPoly(card: PracticeCard, expected: Fn2) {
  expect(samePolynomial(polyOfText(clean(card.prompt)), expected), `${card.id}: printed polynomial differs from params ${JSON.stringify(card.audit?.params)}: ${card.prompt}`).toBe(true);
}

/** Every audited card of every spread seed of game `id` (English). */
function eachAudited(id: string, fn: (card: PracticeCard, where: string) => void) {
  const generate = batch04Generators[id];
  const seen = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of generate(seed, 'en')) if (card.audit) { fn(card, `${card.id} seed ${seed} params ${JSON.stringify(card.audit.params)}`); seen.add(card.audit.kind); }
  }
  return seen;
}
function eachCardById(id: string, cardId: string, fn: (card: PracticeCard, where: string) => void) {
  let count = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = spreadSeed(i);
    for (const card of batch04Generators[id](seed, 'en')) if (card.id === `${id}-${cardId}`) { fn(card, `${card.id} seed ${seed}`); count++; }
  }
  expect(count, `${cardId}: no cards seen`).toBe(SEEDS);
}
const expectKinds = (counts: Record<string, number>, id: string, kinds: string[]) => {
  expect(Object.keys(counts).sort()).toEqual(kinds.map(k => `${id}:${k}`).sort());
  for (const k of kinds) expect(counts[`${id}:${k}`], `${k} count`).toBe(SEEDS);
};
const sample = (f: Fn2) => TEST_POINTS.map(([x, y]) => f(x, y));
/** Does option text "poly" print the same function as g? */
const optionEquals = (text: string, g: Fn2) => { try { return samePolynomial(parsePoly(text), g); } catch { return false; } };

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-18
describe('MIT-MV-18 partial derivatives', () => {
  it('recomputes every audit kind', () => {
    const id = 'MIT-MV-18';
    const counts = runOracle(id, spread(batch04Generators[id]), {
      'MIT-MV-18:partial-x': p => { const q = p as P; return [fx(Qfn(q), q.x0, q.y0)]; },
      'MIT-MV-18:partial-y': p => { const q = p as P; return [fy(Qfn(q), q.x0, q.y0)]; },
      'MIT-MV-18:which-partial': p => {
        const { a, b } = p as P;
        const f: Fn2 = (x, y) => a * x * y * y + b * x * x;
        const truth: Fn2 = (x, y) => fy(f, x, y);
        return { optionIsCorrect: text => optionEquals(text, truth) };
      },
      'MIT-MV-18:cubic-partials': p => {
        const { a, b, c, d, x0, y0 } = p as P;
        const f: Fn2 = (x, y) => a * x ** 3 + b * x * x * y + c * x * y * y + d * y ** 3;
        return [fx(f, x0, y0), fy(f, x0, y0)];
      },
      'MIT-MV-18:mixed-partial': p => {
        const { a, b, c, d, x0, y0 } = p as P;
        const f: Fn2 = (x, y) => a * x ** 3 * y + b * x * y * y + c * x * x + d * y;
        return [mixedXY(f, x0, y0)];
      },
      'MIT-MV-18:direction-of-change': p => {
        const q = p as P;
        const f = Qfn(q);
        const slope = fy(f, q.x0, q.y0);
        // Also a concrete small step in +y with x fixed.
        const step = f(q.x0, q.y0 + 1e-4) - f(q.x0, q.y0);
        expect(Math.sign(step), 'secant step disagrees with derivative sign').toBe(Math.sign(slope));
        return { optionIsCorrect: text => (Math.abs(slope) < 1e-9 ? text.startsWith('f does not change') : slope > 0 ? text.startsWith('f increases') : text.startsWith('f decreases')) };
      },
      'MIT-MV-18:challenge': p => {
        const { a, b, c, x0, y0 } = p as P;
        const f: Fn2 = (x, y) => a * x * x * y + b * x * y ** 3 + c * x;
        return [fy(f, x0, y0), mixedXY(f, x0, y0)];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['partial-x', 'partial-y', 'which-partial', 'cubic-partials', 'mixed-partial', 'direction-of-change', 'challenge']);
  }, 12000);

  it('printed polynomials and points agree with the audit params', () => {
    const seen = eachAudited('MIT-MV-18', (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      switch (card.audit!.kind) {
        case 'MIT-MV-18:partial-x': case 'MIT-MV-18:partial-y':
          expectPrintedPoly(card, Qfn(p));
          expect(hasPoint(card.prompt, p.x0, p.y0), `${where}: point not printed`).toBe(true);
          if (card.audit!.kind.endsWith('partial-x')) expect(prompt, where).toContain(`y = ${n(p.y0)}`);
          else expect(prompt, where).toContain(`x = ${n(p.x0)}`);
          break;
        case 'MIT-MV-18:which-partial':
          expectPrintedPoly(card, (x, y) => p.a * x * y * y + p.b * x * x);
          expect(prompt, where).toContain('∂f/∂y');
          break;
        case 'MIT-MV-18:cubic-partials':
          expectPrintedPoly(card, (x, y) => p.a * x ** 3 + p.b * x * x * y + p.c * x * y * y + p.d * y ** 3);
          expect(hasPoint(card.prompt, p.x0, p.y0), where).toBe(true);
          break;
        case 'MIT-MV-18:mixed-partial':
          expectPrintedPoly(card, (x, y) => p.a * x ** 3 * y + p.b * x * y * y + p.c * x * x + p.d * y);
          expect(hasPoint(card.prompt, p.x0, p.y0), where).toBe(true);
          break;
        case 'MIT-MV-18:direction-of-change':
          expectPrintedPoly(card, Qfn(p));
          expect(hasPoint(card.prompt, p.x0, p.y0), where).toBe(true);
          expect(prompt, where).toContain('+y direction');
          break;
        case 'MIT-MV-18:challenge':
          expectPrintedPoly(card, (x, y) => p.a * x * x * y + p.b * x * y ** 3 + p.c * x);
          expect(hasPoint(card.prompt, p.x0, p.y0), where).toBe(true);
          break;
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(7);
  }, 12000);

  it('which-fixed (no audit): the correct option names the plane y = y0 with y held fixed', () => {
    eachCardById('MIT-MV-18', 'which-fixed', (card, where) => {
      const m = clean(card.prompt).match(/P = \((-?[\d.]+), (-?[\d.]+)\)/);
      expect(m, where).not.toBeNull();
      const [wx, wy] = [m![1], m![2]];
      const verdict = (t: string) => { const s = clean(t); return s.includes(`in the plane y = ${wy}`) && s.includes(`w = f(x, ${wy})`) && s.includes(`slope at x = ${wx}`) && s.includes('y is held fixed'); };
      const verdicts = card.choice!.options.map(verdict);
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-19
describe('MIT-MV-19 tangent plane approximation', () => {
  it('recomputes every audit kind', () => {
    const id = 'MIT-MV-19';
    const counts = runOracle(id, spread(batch04Generators[id]), {
      'MIT-MV-19:tangent-data': p => { const q = p as P; const f = Qfn(q); return [f(q.x0, q.y0), fx(f, q.x0, q.y0), fy(f, q.x0, q.y0)]; },
      'MIT-MV-19:plane-constant': p => {
        const { f0, m, n: nn, x0, y0 } = p as P;
        // The plane by its definition z = f0 + m(x − x0) + n(y − y0); recover k from two heights of this plane.
        const z = (x: number, y: number) => f0 + m * (x - x0) + nn * (y - y0);
        const k1 = z(1.7, -2.3) - m * 1.7 - nn * -2.3;
        const k2 = z(-4, 5) - m * -4 - nn * 5;
        expect(close(k1, k2, 1e-12)).toBe(true);
        return [k1];
      },
      'MIT-MV-19:estimate': p => {
        const q = p as P; const f = Qfn(q);
        const plane = (x: number, y: number) => f(q.x0, q.y0) + fx(f, q.x0, q.y0) * (x - q.x0) + fy(f, q.x0, q.y0) * (y - q.y0);
        return [plane(q.x0 + q.dx, q.y0 + q.dy)];
      },
      'MIT-MV-19:error': p => {
        const q = p as P; const f = Qfn(q);
        const plane = f(q.x0, q.y0) + fx(f, q.x0, q.y0) * q.dx + fy(f, q.x0, q.y0) * q.dy;
        const exact = f(q.x0 + q.dx, q.y0 + q.dy);
        // Independent closed form of the remainder of a quadratic: a dx² + b dx dy + c dy².
        expect(close(exact - plane, q.a * q.dx * q.dx + q.b * q.dx * q.dy + q.c * q.dy * q.dy, 1e-9)).toBe(true);
        return [exact - plane];
      },
      'MIT-MV-19:sensitivity': p => {
        const { a, b, c } = p as P;
        const V = (x: number, y: number, z: number) => x * y * z;
        const partials = [
          centralDiff(s => V(s, b, c), a, 1e-4), centralDiff(s => V(a, s, c), b, 1e-4), centralDiff(s => V(a, b, s), c, 1e-4),
        ].map(Math.abs);
        const best = partials.indexOf(Math.max(...partials));
        expect(partials.filter(v => close(v, partials[best], 1e-6)).length, 'sides must give a unique maximum').toBe(1);
        return { optionIsCorrect: text => text === `Side ${'abc'[best]}` };
      },
      'MIT-MV-19:challenge': p => {
        const { a, b, x0, y0, dx, dy } = p as P;
        const f: Fn2 = (x, y) => a * x * x * y + b * x * y * y;
        return [f(x0, y0) + fx(f, x0, y0) * dx + fy(f, x0, y0) * dy];
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['tangent-data', 'plane-constant', 'estimate', 'error', 'sensitivity', 'challenge']);
  }, 12000);

  it('printed functions/points agree with the params and the grader rejects the exact f for linear estimates', () => {
    const seen = eachAudited('MIT-MV-19', (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      switch (card.audit!.kind) {
        case 'MIT-MV-19:tangent-data':
          expectPrintedPoly(card, Qfn(p));
          expect(prompt.includes(`P = (${n(p.x0)}, ${n(p.y0)})`), `${where}: P not printed`).toBe(true);
          break;
        case 'MIT-MV-19:plane-constant': {
          expect(prompt.includes(`f(P) = ${n(p.f0)},`), `${where}: f(P)`).toBe(true);
          expect(prompt.includes(`f_x(P) = ${n(p.m)} `), `${where}: f_x(P)`).toBe(true);
          expect(prompt.includes(`f_y(P) = ${n(p.n)} `), `${where}: f_y(P)`).toBe(true);
          expect(prompt.includes(`P = (${n(p.x0)}, ${n(p.y0)})`), `${where}: P`).toBe(true);
          const m = prompt.replace(/\s+/g, '').match(/z=([+-]?\d*)x([+-]\d*)y\+k/);
          expect(m, `${where}: "z = mx + ny + k" form`).not.toBeNull();
          const read = (s: string) => (s === '' || s === '+' ? 1 : s === '-' ? -1 : Number(s));
          expect(read(m![1]), `${where}: printed m`).toBe(p.m);
          expect(read(m![2]), `${where}: printed n`).toBe(p.n);
          break;
        }
        case 'MIT-MV-19:estimate': case 'MIT-MV-19:error': {
          expectPrintedPoly(card, Qfn(p));
          expect(prompt.includes(`P = (${n(p.x0)}, ${n(p.y0)})`), `${where}: P`).toBe(true);
          expect(prompt, where).toContain(`Δx = ${n(p.dx)}`);
          expect(prompt, where).toContain(`Δy = ${n(p.dy)}`);
          const x1 = round1(p.x0 + p.dx), y1 = round1(p.y0 + p.dy);
          expect(prompt, `${where}: evaluation point`).toContain(`f(${n(x1)}, ${n(y1)})`);
          if (card.audit!.kind.endsWith(':estimate')) checkLinearEstimate(card, where, p, Qfn(p));
          break;
        }
        case 'MIT-MV-19:sensitivity':
          expect(prompt, where).toContain(`a = ${n(p.a)}, b = ${n(p.b)}, c = ${n(p.c)}`);
          expect(new Set([p.a, p.b, p.c]).size, where).toBe(3);
          break;
        case 'MIT-MV-19:challenge': {
          const f: Fn2 = (x, y) => p.a * x * x * y + p.b * x * y * y;
          expectPrintedPoly(card, f);
          expect(prompt, where).toContain(`(${n(p.x0)}, ${n(p.y0)})`);
          expect(prompt, where).toContain(`Δx = ${n(p.dx)}`);
          expect(prompt, where).toContain(`Δy = ${n(p.dy)}`);
          checkLinearEstimate(card, where, p, f);
          break;
        }
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(6);
  }, 12000);

  /** The learner is asked for the LINEAR estimate: the oracle estimate is accepted and the exact f (read from the printed question) is rejected. */
  function checkLinearEstimate(card: PracticeCard, where: string, p: P, f: Fn2) {
    const est = f(p.x0, p.y0) + fx(f, p.x0, p.y0) * p.dx + fy(f, p.x0, p.y0) * p.dy;
    const e = clean(card.prompt).match(/estimate f\((-?[\d.]+), (-?[\d.]+)\)/);
    expect(e, `${where}: no "estimate f(x, y)" in prompt`).not.toBeNull();
    const exact = polyOfText(clean(card.prompt))(Number(e![1]), Number(e![2]));
    expect(close(exact, f(p.x0 + p.dx, p.y0 + p.dy), 1e-9), `${where}: printed evaluation point is not P + (Δx, Δy)`).toBe(true);
    expect(gradeCard(card, [est.toFixed(2)], null, []), `${where}: estimate ${est} must be accepted`).toBe('correct');
    expect(gradeCard(card, [String(exact)], null, []), `${where}: exact value ${exact} must be rejected`).toBe('incorrect');
    expect(gradeCard(card, [exact.toFixed(2)], null, []), `${where}: exact value ${exact.toFixed(2)} must be rejected`).toBe('incorrect');
    expect(Math.abs(exact - est), `${where}: exact ${exact} too close to estimate ${est}`).toBeGreaterThan(0.005);
  }

  it('formula (symbols): Δw ≈ f_x Δx + f_y Δy', () => {
    eachCardById('MIT-MV-19', 'formula', (card, where) => {
      expect(card.slots, where).toBeDefined();
      const s = card.slots!;
      expect(s.before, where).toBe('Δw ≈');
      expect(s.answers, where).toEqual(['f_x Δx', '+', 'f_y Δy']);
      expect(s.tokens, where).toEqual(expect.arrayContaining(s.answers));
      expect(gradeCard(card, [], null, s.answers)).toBe('correct');
      expect(gradeCard(card, [], null, ['f_x Δy', '+', 'f_y Δx'])).toBe('incorrect');
    });
  }, 12000);

  it('when-exact (no audit): the correct option is the only linear function', () => {
    eachCardById('MIT-MV-19', 'when-exact', (card, where) => {
      const isLinear = (text: string) => {
        const f = polyOfText(text);
        // Linear in (x, y) iff every second difference vanishes.
        return TEST_POINTS.every(([x, y]) => {
          const h = 1;
          const xx = f(x + h, y) - 2 * f(x, y) + f(x - h, y), yy = f(x, y + h) - 2 * f(x, y) + f(x, y - h);
          const xy = f(x + h, y + h) - f(x + h, y) - f(x, y + h) + f(x, y);
          return Math.abs(xx) < 1e-9 && Math.abs(yy) < 1e-9 && Math.abs(xy) < 1e-9;
        });
      };
      const verdicts = card.choice!.options.map(isLinear);
      expect(verdicts.filter(Boolean).length, `${where}: ${card.choice!.options.join(' | ')}`).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);

  it('cone (no audit): √(x²+y²) is smooth away from the origin and has no partials at it', () => {
    const w = (x: number, y: number) => Math.hypot(x, y);
    // one-sided slopes at the origin disagree; at (0.3, 0.4) they agree
    expect((w(1e-6, 0) - w(0, 0)) / 1e-6).toBeCloseTo(1, 6);
    expect((w(-1e-6, 0) - w(0, 0)) / -1e-6).toBeCloseTo(-1, 6);
    expect(centralDiff(s => w(s, 0.4), 0.3, 1e-5)).toBeCloseTo(0.6, 6);
    eachCardById('MIT-MV-19', 'cone', (card, where) => {
      const verdicts = card.choice!.options.map(t => t.startsWith('At the origin only'));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
    });
  }, 12000);
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-20
describe('MIT-MV-20 optimization', () => {
  /** Classify the critical point P of f by scanning rings around it. */
  const classify = (f: Fn2, [px, py]: [number, number]): 'min' | 'max' | 'neither' => {
    let pos = false, neg = false;
    for (const r of [0.25, 0.5, 1, 2, 3, 6]) for (let k = 0; k < 72; k++) {
      const t = (2 * Math.PI * k) / 72;
      const diff = f(px + r * Math.cos(t), py + r * Math.sin(t)) - f(px, py);
      if (diff > 1e-7) pos = true;
      if (diff < -1e-7) neg = true;
    }
    expect(pos || neg, 'degenerate critical point in oracle scan').toBe(true);
    return pos && neg ? 'neither' : pos ? 'min' : 'max';
  };
  const classOption = (kind: 'min' | 'max' | 'neither') => (text: string) =>
    text.startsWith(kind === 'min' ? 'P is a minimum' : kind === 'max' ? 'P is a maximum' : 'P is neither a maximum nor a minimum');

  it('recomputes every audit kind', () => {
    const id = 'MIT-MV-20';
    const counts = runOracle(id, spread(batch04Generators[id]), {
      'MIT-MV-20:fx-zero': p => {
        const f = Dfn(p as P);
        // f_x does not depend on y: solve it for two different y and require the same root.
        const r1 = bisect(s => fx(f, s, 0.37), -50, 50), r2 = bisect(s => fx(f, s, -4.2), -50, 50);
        expect(close(r1, r2, 1e-9)).toBe(true);
        return [r1];
      },
      'MIT-MV-20:critical-point': p => newton2(Dfn(p as P)),
      'MIT-MV-20:value-at-critical': p => { const f = Dfn(p as P); const [x, y] = newton2(f); return [f(x, y)]; },
      'MIT-MV-20:horizontal-plane': p => {
        const f = Dfn(p as P);
        return {
          optionIsCorrect: text => {
            const m = clean(text).match(/^\((-?[\d.]+), (-?[\d.]+)\)$/);
            if (!m) throw new Error(`cannot read point "${text}"`);
            const [x, y] = [Number(m[1]), Number(m[2])];
            return Math.abs(fx(f, x, y)) < 1e-7 && Math.abs(fy(f, x, y)) < 1e-7;
          },
        };
      },
      'MIT-MV-20:classify': p => {
        const f = Dfn(p as P);
        const kind = classify(f, newton2(f));
        return { optionIsCorrect: classOption(kind) };
      },
      'MIT-MV-20:reciprocal-critical': p => {
        const { A, B, r } = p as P;
        expect(A > 0 && B > 0 && r > 0).toBe(true);
        const w: Fn2 = (x, y) => A / x + B / y + r * x * y;
        const wx = (x: number, y: number) => centralDiff(s => w(s, y), x, 1e-4 * x);
        const wy = (x: number, y: number) => centralDiff(t => w(x, t), y, 1e-4 * y);
        // nested bisection: for each y the x > 0 with w_x = 0, then the y > 0 with w_y = 0 along that curve
        const xOf = (y: number) => bisect(s => wx(s, y), 1e-3, 1e3);
        const y = bisect(t => wy(xOf(t), t), 1e-2, 1e2);
        const x = xOf(y);
        expect(Math.hypot(wx(x, y), wy(x, y)), 'gradient residual').toBeLessThan(1e-5);
        // brute force: the minimum of w over a log grid sits at this critical point (global min on x,y > 0)
        const grid = Array.from({ length: 240 }, (_, i) => 0.05 * Math.exp((Math.log(12 / 0.05) * i) / 239));
        let best = Infinity, bx = 0, by = 0;
        for (const gx of grid) for (const gy of grid) { const v = w(gx, gy); if (v < best) { best = v; bx = gx; by = gy; } }
        expect(Math.abs(bx / x - 1), `grid min x ${bx} vs ${x}`).toBeLessThan(0.06);
        expect(Math.abs(by / y - 1), `grid min y ${by} vs ${y}`).toBeLessThan(0.06);
        // the Newton-free route lands on a 1e-7 neighbourhood of the true root: report on the 1e-6 grid like the pilot oracles
        return [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];
      },
      'MIT-MV-20:challenge': p => {
        const q = p as P;
        expect(Math.abs(4 * q.a * q.c - q.b * q.b), '4ac − b² must be non-zero').toBeGreaterThan(0);
        return newton2(Qfn(q));
      },
    } satisfies Record<string, Oracle>, SEEDS);
    expectKinds(counts, id, ['fx-zero', 'critical-point', 'value-at-critical', 'horizontal-plane', 'classify', 'reciprocal-critical', 'challenge']);
  }, 12000);

  it('printed functions/points agree with the params', () => {
    const seen = eachAudited('MIT-MV-20', (card, where) => {
      const p = card.audit!.params as P;
      const prompt = clean(card.prompt);
      switch (card.audit!.kind) {
        case 'MIT-MV-20:fx-zero': case 'MIT-MV-20:critical-point': case 'MIT-MV-20:value-at-critical': case 'MIT-MV-20:horizontal-plane':
          expectPrintedPoly(card, Dfn(p));
          break;
        case 'MIT-MV-20:classify': {
          const f = Dfn(p);
          expectPrintedPoly(card, f);
          const [px, py] = newton2(f);
          const m = prompt.match(/critical point P = \((-?[\d.]+), (-?[\d.]+)\), where f\(P\) = (-?[\d.]+)/);
          expect(m, `${where}: P and f(P) not printed`).not.toBeNull();
          expect(close(Number(m![1]), px, 1e-7) && close(Number(m![2]), py, 1e-7), `${where}: printed P (${m![1]}, ${m![2]}) vs critical point (${px}, ${py})`).toBe(true);
          expect(close(Number(m![3]), f(px, py), 1e-7), `${where}: printed f(P) ${m![3]} vs ${f(px, py)}`).toBe(true);
          break;
        }
        case 'MIT-MV-20:reciprocal-critical': {
          const m = prompt.match(/w\(x, y\) = (\d+)\/x \+ (\d+)\/y \+ (\d*)xy/);
          expect(m, `${where}: w(x, y) not printed`).not.toBeNull();
          expect([Number(m![1]), Number(m![2]), m![3] === '' ? 1 : Number(m![3])], where).toEqual([p.A, p.B, p.r]); // coefficient 1 is printed implicitly
          expect(prompt, where).toContain('x > 0 and y > 0');
          break;
        }
        case 'MIT-MV-20:challenge':
          expectPrintedPoly(card, Qfn(p));
          break;
        default: throw new Error(`unchecked kind ${card.audit!.kind}`);
      }
    });
    expect(seen.size).toBe(7);
  }, 12000);

  it('every audited f has f_x = f_y = 0 only at the point the card answers (value check)', () => {
    // a sanity check on the answer keys themselves: plug the CARD's own answers into the printed polynomial's gradient
    for (let i = 0; i < SEEDS; i++) {
      for (const card of batch04Generators['MIT-MV-20'](spreadSeed(i), 'en')) {
        if (card.audit?.kind === 'MIT-MV-20:critical-point' || card.audit?.kind === 'MIT-MV-20:challenge') {
          const f = polyOfText(clean(card.prompt));
          const [x, y] = card.fields!.map(field => field.answer);
          expect(Math.abs(fx(f, x, y)) + Math.abs(fy(f, x, y)), `${card.id} seed ${spreadSeed(i)}`).toBeLessThan(1e-7);
        }
      }
    }
  }, 12000);

  it('neither (no audit): f = p x² − q y² + e has (0, 0) as a non-extremal critical point', () => {
    eachCardById('MIT-MV-20', 'neither', (card, where) => {
      const f = polyOfText(clean(card.prompt));
      expect(Math.hypot(fx(f, 0, 0), fy(f, 0, 0)), `${where}: (0, 0) must be critical`).toBeLessThan(1e-9);
      const kind = classify(f, [0, 0]);
      expect(kind, where).toBe('neither');
      const verdicts = card.choice!.options.map(t => t.startsWith('It is a critical point but neither a maximum nor a minimum'));
      expect(verdicts.filter(Boolean).length, where).toBe(1);
      expect(verdicts[card.choice!.answer], where).toBe(true);
      // the two wrong options claim an extremum purely from f_x = f_y = 0
      for (const [i, t] of card.choice!.options.entries()) if (i !== card.choice!.answer) expect(/^It is a (minimum|maximum)/.test(t), `${where}: ${t}`).toBe(true);
    });
  }, 12000);
});
