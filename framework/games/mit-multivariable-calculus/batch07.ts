import { ellipse, fitView, sampleCurve, type FigureShape, type Pt } from '../figure';
import { coef, frac, gcd, linear, makeMvDeck, num, par, term, vec, type GeneratorMap, type Text } from './support';

/**
 * Batch 7: MIT-MV-31 Exam 2, MIT-MV-32 Definition of Double Integrals, MIT-MV-33 Examples of Double Integration,
 * MIT-MV-34 Exchanging the Order of Integration, MIT-MV-35 Double Integrals in Polar Coordinates.
 * Sources: content/mit-multivariable-calculus/sources/{31..35}-*.txt (18.02SC Exam 2 materials, sessions 47-50).
 * Iterated limits are written as inequalities, inner variable first, e.g. "0 ≤ y ≤ 4 − 2x,  0 ≤ x ≤ 2".
 */
type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string) => [en, zh] as const;
/** Pick the English (0) or Chinese (1) half of a pair built by t(). */
const t2 = (pair: readonly [string, string], i: 0 | 1) => pair[i];

/** Draw with `make` until `ok` holds. Bounded, so a bad sampling condition fails loudly instead of hanging. */
function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** The shared LCG gives near-constant first draws for neighbouring seeds. */
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const uniq = (items: string[]) => [...new Set(items)];
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
/** "2 dx + 3 dy − dz" with spaces between coefficient and differential (never "2dx", never "1 dx"). */
const diffLin = (a: number, b: number, c: number) => [[a, 'dx'], [b, 'dy'], [c, 'dz']].filter(([k]) => k !== 0).map(([k, v], i) => {
  const abs = Math.abs(k as number), body = abs === 1 ? `${v}` : `${abs} ${v}`;
  return i === 0 ? ((k as number) < 0 ? `−${body}` : body) : `${(k as number) < 0 ? '−' : '+'} ${body}`;
}).join(' ');
/** n·π/d reduced: piMul(15, 2) = "15π/2", piMul(2, 1) = "2π", piMul(1, 2) = "π/2". */
const piMul = (n: number, d: number) => {
  const k = gcd(n, d); n /= k; d /= k;
  const head = n === 1 ? 'π' : `${n}π`;
  return d === 1 ? head : `${head}/${d}`;
};
/** A rational coefficient as a prefix: 1 -> "", 3 -> "3", 3/2 -> "(3/2)". Never "1(...)". */
const kfac = (n: number, d: number) => { const v = frac(n, d); return v === '1' ? '' : v.includes('/') || v.startsWith('−') ? `(${v})` : v; };

// ---- Small polynomial toolkit in x, y: a term is [coefficient, power of x, power of y]. ----
type Term2 = [number, number, number];
const sup = (p: number) => (p === 1 ? '' : p === 2 ? '²' : p === 3 ? '³' : p === 4 ? '⁴' : `^${p}`);
function poly2(terms: Term2[], vx = 'x', vy = 'y'): string {
  const live = terms.filter(([c]) => c !== 0);
  if (!live.length) return '0';
  return live.map(([c, i, j], k) => {
    const vars = (i ? vx + sup(i) : '') + (j ? vy + sup(j) : '');
    const abs = Math.abs(c);
    const body = vars === '' ? num(abs) : abs === 1 ? vars : `${num(abs)}${vars}`;
    return k === 0 ? (c < 0 ? `−${body}` : body) : ` ${c < 0 ? '−' : '+'} ${body}`;
  }).join('');
}
const ev2 = (terms: Term2[], x: number, y: number) => terms.reduce((s, [c, i, j]) => s + c * x ** i * y ** j, 0);
const dx2 = (terms: Term2[]): Term2[] => terms.filter(([, i]) => i > 0).map(([c, i, j]) => [c * i, i - 1, j]);
const dy2 = (terms: Term2[]): Term2[] => terms.filter(([, , j]) => j > 0).map(([c, i, j]) => [c * j, i, j - 1]);
/** The polynomial with concrete values substituted, e.g. "2·3² + (−1)·3·4". */
function subst2(terms: Term2[], x: number, y: number): string {
  const live = terms.filter(([c]) => c !== 0);
  if (!live.length) return '0';
  return live.map(([c, i, j]) => {
    const parts: string[] = [];
    if (Math.abs(c) !== 1 || (i === 0 && j === 0)) parts.push(par(c));
    else if (c === -1) parts.push('(−1)');
    if (i) parts.push(i === 1 ? par(x) : `${par(x)}${sup(i)}`);
    if (j) parts.push(j === 1 ? par(y) : `${par(y)}${sup(j)}`);
    return parts.join('·');
  }).join(' + ');
}
/** Polynomial in x, y, z: a term is [coefficient, power of x, power of y, power of z]. */
type Term3 = [number, number, number, number];
function poly3(terms: Term3[]): string {
  const live = terms.filter(([c]) => c !== 0);
  return live.map(([c, i, j, k], n) => {
    const vars = (i ? 'x' + sup(i) : '') + (j ? 'y' + sup(j) : '') + (k ? 'z' + sup(k) : '');
    const abs = Math.abs(c);
    const body = abs === 1 ? vars : `${num(abs)}${vars}`;
    return n === 0 ? (c < 0 ? `−${body}` : body) : ` ${c < 0 ? '−' : '+'} ${body}`;
  }).join('');
}
/** "x − 3", "x + 2" or "x": the variable shifted by a centre value. */
const shift = (v: string, c: number) => (c === 0 ? v : c > 0 ? `${v} − ${num(c)}` : `${v} + ${num(-c)}`);
/** (x − 2)², x² */
const square = (v: string, c: number) => (c === 0 ? `${v}²` : `(${shift(v, c)})²`);
/** px + qy + r with no "1x" and no "+ −". */
const linPQR = (p: number, q: number, r: number) => linear([p, q], ['x', 'y']) + (r === 0 ? '' : ` ${term(r)}`);

// ---- Figure helpers ----
const fill = (points: Pt[]): FigureShape => ({ kind: 'area', points, tone: 'accent', opacity: 0.25 });
const outline = (points: Pt[]): FigureShape => ({ kind: 'line', points: [...points, points[0]], tone: 'accent', width: 2 });
const seg = (a: Pt, b: Pt, tone: 'warn' | 'muted' | 'axis' = 'muted', dash = false): FigureShape => ({ kind: 'line', points: [a, b], tone, dash, width: 1.5 });
const AXES = { xLabel: 'x', yLabel: 'y', grid: true } as const;

// ---- Regions for exchanging the order of integration (MV-34). All lie in 0 ≤ x ≤ a (or ≤ √a), first quadrant. ----
type Form = 'upper' | 'lower' | 'under' | 'parabola' | 'wedge';
const FORMS: Form[] = ['upper', 'lower', 'under', 'parabola', 'wedge'];
type Reg = {
  form: Form; a: number; m: number;
  /** Order dy dx: inner y limits (in x) and outer x limits. */
  y: [string, string]; xr: [string, string];
  /** Order dx dy: inner x limits (in y) and outer y limits. */
  x: [string, string]; yr: [string, string];
  poly: Pt[]; words: readonly [string, string];
  /** Inner y from lo0 + lo1·x to hi0 + hi1·x, outer x from 0 to a (null for the parabola). */
  lin: { lo0: number; lo1: number; hi0: number; hi1: number } | null;
  /** [∬ x dA, ∬ y dA] as numerators over 6 (null for the parabola). */
  moments6: [number, number] | null;
};
function makeRegion(form: Form, a: number, m = 2): Reg {
  const s = Math.round(Math.sqrt(a));
  switch (form) {
    case 'upper': return {
      form, a, m, y: ['x', `${a}`], xr: ['0', `${a}`], x: ['0', 'y'], yr: ['0', `${a}`], poly: [[0, 0], [0, a], [a, a]],
      words: t(`the triangle with vertices (0, 0), (0, ${a}) and (${a}, ${a}), above the line y = x`, `顶点为 (0, 0)、(0, ${a})、(${a}, ${a}) 的三角形，位于直线 y = x 上方`),
      lin: { lo0: 0, lo1: 1, hi0: a, hi1: 0 }, moments6: [a ** 3, 2 * a ** 3],
    };
    case 'lower': return {
      form, a, m, y: ['0', 'x'], xr: ['0', `${a}`], x: ['y', `${a}`], yr: ['0', `${a}`], poly: [[0, 0], [a, 0], [a, a]],
      words: t(`the triangle with vertices (0, 0), (${a}, 0) and (${a}, ${a}), below the line y = x`, `顶点为 (0, 0)、(${a}, 0)、(${a}, ${a}) 的三角形，位于直线 y = x 下方`),
      lin: { lo0: 0, lo1: 0, hi0: 0, hi1: 1 }, moments6: [2 * a ** 3, a ** 3],
    };
    case 'under': return {
      form, a, m, y: ['0', `${a} − x`], xr: ['0', `${a}`], x: ['0', `${a} − y`], yr: ['0', `${a}`], poly: [[0, 0], [a, 0], [0, a]],
      words: t(`the triangle with vertices (0, 0), (${a}, 0) and (0, ${a}), under the line x + y = ${a}`, `顶点为 (0, 0)、(${a}, 0)、(0, ${a}) 的三角形，位于直线 x + y = ${a} 之下`),
      lin: { lo0: 0, lo1: 0, hi0: a, hi1: -1 }, moments6: [a ** 3, a ** 3],
    };
    case 'wedge': return {
      form, a, m, y: ['0', coef(m, 'x')], xr: ['0', `${a}`], x: [`y/${m}`, `${a}`], yr: ['0', `${m * a}`], poly: [[0, 0], [a, 0], [a, m * a]],
      words: t(`the triangle with vertices (0, 0), (${a}, 0) and (${a}, ${m * a}), between the x-axis and the line y = ${coef(m, 'x')}`, `顶点为 (0, 0)、(${a}, 0)、(${a}, ${m * a}) 的三角形，介于 x 轴与直线 y = ${coef(m, 'x')} 之间`),
      lin: { lo0: 0, lo1: 0, hi0: 0, hi1: m }, moments6: [2 * m * a ** 3, m * m * a ** 3],
    };
    default: return {
      form, a, m, y: ['x²', `${a}`], xr: ['0', `${s}`], x: ['0', '√y'], yr: ['0', `${a}`],
      poly: [...sampleCurve(x => [x, x * x], 0, s, 24), [0, a]],
      words: t(`the region between the parabola y = x² and the line y = ${a}, for 0 ≤ x ≤ ${s}`, `抛物线 y = x² 与直线 y = ${a} 之间、0 ≤ x ≤ ${s} 的区域`),
      lin: null, moments6: null,
    };
  }
}
const regShapes = (r: Reg): FigureShape[] => [fill(r.poly), outline(r.poly)];
/** The iterated limits in the given order as one line: "inner ≤ y ≤ …, outer ≤ x ≤ …". */
const dydx = (r: Reg) => `${r.y[0]} ≤ y ≤ ${r.y[1]},  ${r.xr[0]} ≤ x ≤ ${r.xr[1]}`;
const dxdy = (r: Reg) => `${r.x[0]} ≤ x ≤ ${r.x[1]},  ${r.yr[0]} ≤ y ≤ ${r.yr[1]}`;

export const batch07Generators: GeneratorMap = {
  // ================================================================================================
  // MIT-MV-31 Exam 2 (Unit 2: partial derivatives)
  // ================================================================================================
  'MIT-MV-31': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-31');
    warm(g);

    // Cards 1-4 share f(x, y) = a x²y² − b x and the point (x0, y0) (Exam 2 problem 1 has a = b = 1, P = (2, 1)).
    const s = retry(() => ({ a: g.nonzero(-2, 2), b: g.nonzero(-3, 3), x0: g.nonzero(-2, 3), y0: g.nonzero(-2, 2) }),
      v => 2 * v.a * v.x0 * v.y0 * v.y0 - v.b !== 0 && 2 * v.a * v.x0 * v.x0 * v.y0 !== 0);
    const F: Term2[] = [[s.a, 2, 2], [-s.b, 1, 0]];
    const Fx = dx2(F), Fy = dy2(F);
    const f0 = ev2(F, s.x0, s.y0), fx0 = ev2(Fx, s.x0, s.y0), fy0 = ev2(Fy, s.x0, s.y0);
    const planeK = f0 - fx0 * s.x0 - fy0 * s.y0;
    const deltas = [-0.2, -0.1, 0.1, 0.2];
    const inc = retry(() => ({ dx: g.pick(deltas), dy: g.pick(deltas) }), v => {
      const est = f0 + fx0 * v.dx + fy0 * v.dy;
      return Math.abs(ev2(F, s.x0 + v.dx, s.y0 + v.dy) - est) >= 0.02;
    });
    const x1 = round1(s.x0 + inc.dx), y1 = round1(s.y0 + inc.dy);
    const estimate = round2(f0 + fx0 * inc.dx + fy0 * inc.dy);
    const exact = round3(ev2(F, x1, y1));
    const DIRS: [number, number][] = [[3, 4], [4, 3], [-3, 4], [-4, 3], [3, -4], [4, -3], [-3, -4], [-4, -3]];
    const dir = g.pick(DIRS);
    const dirDeriv = (fx0 * dir[0] + fy0 * dir[1]) / 5;

    // 5. contour circle f = ρ² and four marked points
    const cc = { h: g.random(-2, 2), k: g.random(-2, 2), rho: g.random(2, 3) };
    const posKind = g.random(0, 3); // 0 top, 1 right, 2 bottom, 3 left
    const letters = shuffled(g, ['P', 'Q', 'R', 'S']); // letters[position]: positions 0 top, 1 right, 2 bottom, 3 left
    const circlePts: Pt[] = [[cc.h, cc.k + cc.rho], [cc.h + cc.rho, cc.k], [cc.h, cc.k - cc.rho], [cc.h - cc.rho, cc.k]];
    const contourShapes: FigureShape[] = [
      { kind: 'line', points: ellipse(cc.h, cc.k, cc.rho, cc.rho, 72), tone: 'accent', width: 2 },
      ...circlePts.map((at, i): FigureShape => ({ kind: 'point', at, tone: 'warn', label: letters[i] })),
    ];

    // 6-7. one quadratic with an integer critical point; the kind (min, max, saddle) is sampled
    const kind = g.random(0, 2);
    const q = retry(() => ({ a: g.nonzero(-3, 3), b: g.nonzero(-3, 3), c: g.nonzero(-3, 3), xs: g.random(-3, 3), ys: g.random(-3, 3) }), v => {
      const D = 4 * v.a * v.c - v.b * v.b;
      return D !== 0 && (kind === 0 ? D > 0 && v.a > 0 : kind === 1 ? D > 0 && v.a < 0 : D < 0);
    });
    const qd = -2 * q.a * q.xs - q.b * q.ys, qe = -q.b * q.xs - 2 * q.c * q.ys;
    const Q: Term2[] = [[q.a, 2, 0], [q.b, 1, 1], [q.c, 0, 2], [qd, 1, 0], [qe, 0, 1]];
    const qD = 4 * q.a * q.c - q.b * q.b;
    const qfx = poly2(dx2(Q)), qfy = poly2(dy2(Q));

    // 8. D = 0 at the origin for f = s1·k x⁴ + s2·l y⁴
    const quartic = { s1: g.pick([1, -1]), s2: g.pick([1, -1]), k1: g.random(1, 3), k2: g.random(1, 3) };
    const quarticF = `${quartic.s1 < 0 ? '−' : ''}${coef(quartic.k1, 'x⁴')} ${quartic.s2 < 0 ? '−' : '+'} ${coef(quartic.k2, 'y⁴')}`;
    const quarticCase = quartic.s1 > 0 && quartic.s2 > 0 ? 0 : quartic.s1 < 0 && quartic.s2 < 0 ? 1 : 2;

    // 9. maximum on the boundary of the first quadrant
    const bm = { a: g.pick([1, 2, 4]), c: g.random(1, 3), d: g.pick([2, 4, 6, 8]), e: g.random(1, 6) };
    const bmX = bm.d / (2 * bm.a), bmW = bm.d * bm.d / (4 * bm.a);
    const bmF = `${bm.a === 1 ? '−' : `−${bm.a}`}x² − ${coef(bm.c, 'y²')} + ${bm.d}x − ${coef(bm.e, 'y')}`;
    const bmCrit = frac(-bm.e, 2 * bm.c);

    // 10. chain rule
    const ch = retry(() => ({ x0: g.pick([-2, -1, 1, 2]), y0: g.nonzero(-3, 3), A: g.nonzero(-3, 3), B: g.nonzero(-3, 3) }), () => true);
    const chWx = -ch.y0 * ch.A / (ch.x0 * ch.x0) + 2 * ch.x0 * ch.B;
    const chWy = ch.A / ch.x0 + 2 * ch.y0 * ch.B;

    // 11. total differentials at (1, 1, 1): p x² + q y³ + r z⁴ = k1 and a z³ + b zx + c xy = k2
    const td = retry(() => ({ p: g.nonzero(-2, 2), q: g.nonzero(-2, 2), r: g.nonzero(-2, 2), a: g.nonzero(-2, 2), b: g.nonzero(-2, 2), c: g.nonzero(-2, 2) }), v => {
      const A1 = 2 * v.p, B1 = 3 * v.q, C1 = 4 * v.r, A2 = v.b + v.c, B2 = v.c, C2 = 3 * v.a + v.b;
      const num0 = A1 * C2 - A2 * C1, den0 = B2 * C1 - B1 * C2;
      return den0 !== 0 && num0 !== 0 && Math.abs(den0) / gcd(num0, den0) <= 4 && Math.abs(num0 / den0) <= 8;
    });
    const tdA1 = 2 * td.p, tdB1 = 3 * td.q, tdC1 = 4 * td.r, tdA2 = td.b + td.c, tdB2 = td.c, tdC2 = 3 * td.a + td.b;
    const tdNum = tdA1 * tdC2 - tdA2 * tdC1, tdDen = tdB2 * tdC1 - tdB1 * tdC2;
    const tdF1: Term3[] = [[td.p, 2, 0, 0], [td.q, 0, 3, 0], [td.r, 0, 0, 4]];
    const tdF2: Term3[] = [[td.a, 0, 0, 3], [td.b, 1, 0, 1], [td.c, 1, 1, 0]];

    // 12. which tool
    const toolCase = g.random(0, 3);
    const tc = { c: g.random(6, 20), v0: g.random(3, 9), fx: g.nonzero(-4, 4), fy: g.nonzero(-4, 4), fxx: g.random(1, 4), fyy: g.random(1, 4), fxy: g.random(1, 4), m: g.random(2, 4) };

    // 13. Lagrange equations for g = c
    const lg = { A: g.random(3, 5), B: g.random(3, 5), C: g.random(3, 5), D: g.nonzero(-2, 2), E: g.nonzero(-2, 2), c: g.random(6, 20), coord: g.random(0, 2) };
    const gx = linear([2 * lg.A, lg.D, 0], ['x', 'y', 'z']), gy = linear([lg.D, 2 * lg.B, lg.E], ['x', 'y', 'z']), gz = linear([0, lg.E, 2 * lg.C], ['x', 'y', 'z']);
    const gSurface = poly3([[lg.A, 2, 0, 0], [lg.B, 0, 2, 0], [lg.C, 0, 0, 2], [lg.D, 1, 1, 0], [lg.E, 0, 1, 1]]);
    const unitVec = (i: number) => `(${[0, 1, 2].map(k => (k === i ? 1 : 0)).join(', ')})`;

    // 14. challenge: largest p x + q y on a circle (Lagrange)
    const cp = g.pick(DIRS);
    const cR = g.random(1, 4);
    const cx = cp[0] * cR / 5, cy = cp[1] * cR / 5, cMax = 5 * cR;

    const fText = poly2(F);
    return [
      g.number({
        id: 'gradient', title: t('Gradient at a point', '一点处的梯度'),
        prompt: t(`Exam-style warm-up. f(x, y) = ${fText}. Find the gradient ∇f = (f_x, f_y) at the point (x, y) = (${num(s.x0)}, ${num(s.y0)}).`,
          `考试式热身。f(x, y) = ${fText}。求 f 在点 (x, y) = (${num(s.x0)}, ${num(s.y0)}) 处的梯度 ∇f = (f_x, f_y)。`),
        fields: [{ label: t('f_x', 'f_x'), answer: fx0 }, { label: t('f_y', 'f_y'), answer: fy0 }],
        hint: t('Differentiate in x holding y constant, then in y holding x constant. Substitute the point at the end.', '先对 x 求导（y 当常数），再对 y 求导（x 当常数），最后代入该点。'),
        explanation: t(`f_x = ${poly2(Fx)}, so f_x(${num(s.x0)}, ${num(s.y0)}) = ${subst2(Fx, s.x0, s.y0)} = ${num(fx0)}. f_y = ${poly2(Fy)}, so f_y(${num(s.x0)}, ${num(s.y0)}) = ${subst2(Fy, s.x0, s.y0)} = ${num(fy0)}. So ∇f = ${vec(fx0, fy0)}.`,
          `f_x = ${poly2(Fx)}，所以 f_x(${num(s.x0)}, ${num(s.y0)}) = ${subst2(Fx, s.x0, s.y0)} = ${num(fx0)}。f_y = ${poly2(Fy)}，所以 f_y(${num(s.x0)}, ${num(s.y0)}) = ${subst2(Fy, s.x0, s.y0)} = ${num(fy0)}。因此 ∇f = ${vec(fx0, fy0)}。`),
        audit: { kind: 'MIT-MV-31:gradient', params: { a: s.a, b: s.b, x0: s.x0, y0: s.y0 } },
      }),
      g.number({
        id: 'tangent-plane', title: t('Tangent plane to the graph', '图像的切平面'),
        prompt: t(`The graph z = f(x, y) of f(x, y) = ${fText} passes through P = (${num(s.x0)}, ${num(s.y0)}, ${num(f0)}). Its tangent plane at P can be written z = mx + ny + k. Find k.`,
          `f(x, y) = ${fText} 的图像 z = f(x, y) 过点 P = (${num(s.x0)}, ${num(s.y0)}, ${num(f0)})。它在 P 处的切平面可写成 z = mx + ny + k。求 k。`),
        fields: [{ label: t('k', 'k'), answer: planeK }],
        hint: t('The tangent plane is z = f(P) + f_x(P)(x − x₀) + f_y(P)(y − y₀); k is its constant part after expanding.', '切平面是 z = f(P) + f_x(P)(x − x₀) + f_y(P)(y − y₀)；展开后的常数部分就是 k。'),
        explanation: t(`m = f_x(P) = ${num(fx0)} and n = f_y(P) = ${num(fy0)}. Then k = f(P) − m·x₀ − n·y₀ = ${num(f0)} − ${par(fx0)}·${par(s.x0)} − ${par(fy0)}·${par(s.y0)} = ${num(planeK)}. The plane is z = ${linPQR(fx0, fy0, planeK)}.`,
          `m = f_x(P) = ${num(fx0)}，n = f_y(P) = ${num(fy0)}。于是 k = f(P) − m·x₀ − n·y₀ = ${num(f0)} − ${par(fx0)}·${par(s.x0)} − ${par(fy0)}·${par(s.y0)} = ${num(planeK)}。切平面为 z = ${linPQR(fx0, fy0, planeK)}。`),
        audit: { kind: 'MIT-MV-31:tangent-plane', params: { a: s.a, b: s.b, x0: s.x0, y0: s.y0 } },
      }),
      g.number({
        id: 'linear-approx', title: t('Linear approximation', '线性近似'),
        prompt: t(`For f(x, y) = ${fText}, use the tangent plane at (${num(s.x0)}, ${num(s.y0)}) to estimate f(${num(x1)}, ${num(y1)}), where Δx = ${num(inc.dx)} and Δy = ${num(inc.dy)}. Enter the estimate to 2 decimal places (not the exact value of f).`,
          `对 f(x, y) = ${fText}，用 (${num(s.x0)}, ${num(s.y0)}) 处的切平面估计 f(${num(x1)}, ${num(y1)})，其中 Δx = ${num(inc.dx)}，Δy = ${num(inc.dy)}。保留 2 位小数输入估计值（不是 f 的精确值）。`),
        fields: [{ label: t('estimate', '估计值'), answer: estimate, tolerance: 0.005 }],
        hint: t('f(P) + f_x(P)Δx + f_y(P)Δy, with the numbers you already found.', 'f(P) + f_x(P)Δx + f_y(P)Δy，用前面已求出的数。'),
        explanation: t(`Estimate = f(P) + f_x(P)Δx + f_y(P)Δy = ${num(f0)} + ${par(fx0)}·${par(inc.dx)} + ${par(fy0)}·${par(inc.dy)} = ${num(estimate)}. The exact value f(${num(x1)}, ${num(y1)}) = ${num(exact)} differs, because the tangent plane only follows the graph to first order.`,
          `估计值 = f(P) + f_x(P)Δx + f_y(P)Δy = ${num(f0)} + ${par(fx0)}·${par(inc.dx)} + ${par(fy0)}·${par(inc.dy)} = ${num(estimate)}。精确值 f(${num(x1)}, ${num(y1)}) = ${num(exact)} 与之不同，因为切平面只在一阶意义上贴合图像。`),
        audit: { kind: 'MIT-MV-31:linear-approx', params: { a: s.a, b: s.b, x0: s.x0, y0: s.y0, dx: inc.dx, dy: inc.dy } },
      }),
      g.number({
        id: 'directional', title: t('Directional derivative', '方向导数'),
        prompt: t(`For f(x, y) = ${fText}, find the directional derivative df/ds at (${num(s.x0)}, ${num(s.y0)}) in the direction of the vector v = ${vec(dir[0], dir[1])} (|v| = 5). Use the unit vector û = v/|v|. Enter an integer, fraction or decimal.`,
          `对 f(x, y) = ${fText}，求 f 在点 (${num(s.x0)}, ${num(s.y0)}) 处沿向量 v = ${vec(dir[0], dir[1])}（|v| = 5）方向的方向导数 df/ds。取单位向量 û = v/|v|。输入整数、分数或小数。`),
        fields: [{ label: t('df/ds', 'df/ds'), answer: dirDeriv }],
        hint: t('df/ds = ∇f · û with û of length 1.', 'df/ds = ∇f · û，其中 û 长度为 1。'),
        explanation: t(`∇f = ${vec(fx0, fy0)} and û = ${vec(dir[0], dir[1])}/5. So df/ds = ∇f · û = (${par(fx0)}·${par(dir[0])} + ${par(fy0)}·${par(dir[1])})/5 = ${num(fx0 * dir[0] + fy0 * dir[1])}/5 = ${num(dirDeriv)}. Dividing by |v| = 5 is essential: v itself is not a unit vector.`,
          `∇f = ${vec(fx0, fy0)}，û = ${vec(dir[0], dir[1])}/5。所以 df/ds = ∇f · û = (${par(fx0)}·${par(dir[0])} + ${par(fy0)}·${par(dir[1])})/5 = ${num(fx0 * dir[0] + fy0 * dir[1])}/5 = ${num(dirDeriv)}。必须除以 |v| = 5：v 本身不是单位向量。`),
        audit: { kind: 'MIT-MV-31:directional', params: { a: s.a, b: s.b, x0: s.x0, y0: s.y0, v1: dir[0], v2: dir[1] } },
      }),
      g.choice({
        id: 'contour-points', title: t('Read partial derivatives from a level curve', '从等值线读出偏导数'),
        prompt: t(`The figure shows the level curve f(x, y) = ${cc.rho * cc.rho} of f(x, y) = ${square('x', cc.h)} + ${square('y', cc.k)}, a circle of radius ${cc.rho} centred at ${vec(cc.h, cc.k)}. Four points P, Q, R, S are marked on it. At which point do we have ${['f_x = 0 and f_y > 0', 'f_y = 0 and f_x > 0', 'f_x = 0 and f_y < 0', 'f_y = 0 and f_x < 0'][posKind]}?`,
          `图中是 f(x, y) = ${square('x', cc.h)} + ${square('y', cc.k)} 的等值线 f(x, y) = ${cc.rho * cc.rho}，它是以 ${vec(cc.h, cc.k)} 为圆心、半径为 ${cc.rho} 的圆。圆上标出了四个点 P、Q、R、S。在哪一点处有 ${['f_x = 0 且 f_y > 0', 'f_y = 0 且 f_x > 0', 'f_x = 0 且 f_y < 0', 'f_y = 0 且 f_x < 0'][posKind]}？`),
        figure: g.figure({
          alt: t(`A circle of radius ${cc.rho} centred at ${vec(cc.h, cc.k)} with four marked points ${letters[0]} (top), ${letters[1]} (right), ${letters[2]} (bottom) and ${letters[3]} (left).`,
            `以 ${vec(cc.h, cc.k)} 为圆心、半径为 ${cc.rho} 的圆，圆上四个标记点：${letters[0]}（最上）、${letters[1]}（最右）、${letters[2]}（最下）、${letters[3]}（最左）。`),
          view: fitView(contourShapes, 0.25), axes: AXES, shapes: contourShapes, caption: t(`Level curve f = ${cc.rho * cc.rho}`, `等值线 f = ${cc.rho * cc.rho}`),
        }),
        options: ['P', 'Q', 'R', 'S'].map(L => t(`Point ${L}`, `点 ${L}`)), correct: ['P', 'Q', 'R', 'S'].indexOf(letters[posKind]), fixedOrder: true,
        hint: t('Compute f_x and f_y for this f and see where each is zero or has a given sign on the circle.', '先求这个 f 的 f_x 与 f_y，再看它们在圆上何处为零或取给定符号。'),
        explanation: t(`Here f_x = 2(${shift('x', cc.h)}) and f_y = 2(${shift('y', cc.k)}). f_x = 0 means x = ${num(cc.h)}, the points directly above or below the centre; f_y = 0 means y = ${num(cc.k)}, the points level with the centre. The sign of f_y is the sign of y − ${par(cc.k)}, the sign of f_x that of x − ${par(cc.h)}. The required condition holds at the ${['top', 'rightmost', 'bottom', 'leftmost'][posKind]} point of the circle, which is labelled ${letters[posKind]}.`,
          `这里 f_x = 2(${shift('x', cc.h)})，f_y = 2(${shift('y', cc.k)})。f_x = 0 即 x = ${num(cc.h)}，对应圆心正上方或正下方的点；f_y = 0 即 y = ${num(cc.k)}，对应与圆心同高的点。f_y 的符号就是 y − ${par(cc.k)} 的符号，f_x 的符号就是 x − ${par(cc.h)} 的符号。所要求的条件在圆的${['最上', '最右', '最下', '最左'][posKind]}点成立，该点标为 ${letters[posKind]}。`),
      }),
      g.number({
        id: 'critical', title: t('Critical point', '临界点'),
        prompt: t(`w(x, y) = ${poly2(Q)} has exactly one critical point. Find its coordinates (x, y).`, `w(x, y) = ${poly2(Q)} 恰有一个临界点。求它的坐标 (x, y)。`),
        fields: [{ label: t('x', 'x'), answer: q.xs }, { label: t('y', 'y'), answer: q.ys }],
        hint: t('A critical point has w_x = 0 and w_y = 0 at the same time: solve the two linear equations.', '临界点处 w_x = 0 且 w_y = 0：解这两个线性方程。'),
        explanation: t(`w_x = ${qfx} = 0 and w_y = ${qfy} = 0. Solving gives (x, y) = ${vec(q.xs, q.ys)}. Check: w_x = ${subst2(dx2(Q), q.xs, q.ys)} = 0 and w_y = ${subst2(dy2(Q), q.xs, q.ys)} = 0.`,
          `w_x = ${qfx} = 0，w_y = ${qfy} = 0。解得 (x, y) = ${vec(q.xs, q.ys)}。验算：w_x = ${subst2(dx2(Q), q.xs, q.ys)} = 0，w_y = ${subst2(dy2(Q), q.xs, q.ys)} = 0。`),
        audit: { kind: 'MIT-MV-31:critical', params: { a: q.a, b: q.b, c: q.c, d: qd, e: qe } },
      }),
      g.choice({
        id: 'classify', title: t('Classify the critical point', '判别临界点类型'),
        prompt: t(`For the same function w(x, y) = ${poly2(Q)} with its single critical point, what type of critical point is it? Decide with the second derivative test.`,
          `仍取 w(x, y) = ${poly2(Q)}，它只有一个临界点。用二阶导数判别法，这个临界点是什么类型？`),
        options: [t('A local minimum', '局部极小点'), t('A local maximum', '局部极大点'), t('A saddle point', '鞍点'), t('The test cannot decide', '该判别法无法判定')], correct: kind === 0 ? 0 : kind === 1 ? 1 : 2,
        hint: t('Compare A = w_xx, C = w_yy, B = w_xy: look at AC − B² first, then at the sign of A.', '比较 A = w_xx，C = w_yy，B = w_xy：先看 AC − B²，再看 A 的符号。'),
        explanation: t(`w_xx = ${num(2 * q.a)}, w_yy = ${num(2 * q.c)}, w_xy = ${num(q.b)}. So AC − B² = ${par(2 * q.a)}·${par(2 * q.c)} − ${par(q.b)}² = ${num(qD)}. ${qD < 0 ? 'It is negative, so the critical point is a saddle point.' : q.a > 0 ? 'It is positive and w_xx > 0, so the critical point is a local minimum.' : 'It is positive and w_xx < 0, so the critical point is a local maximum.'} Since AC − B² is not 0 the test does decide.`,
          `w_xx = ${num(2 * q.a)}，w_yy = ${num(2 * q.c)}，w_xy = ${num(q.b)}。所以 AC − B² = ${par(2 * q.a)}·${par(2 * q.c)} − ${par(q.b)}² = ${num(qD)}。${qD < 0 ? '它为负，所以临界点是鞍点。' : q.a > 0 ? '它为正且 w_xx > 0，所以临界点是局部极小点。' : '它为正且 w_xx < 0，所以临界点是局部极大点。'}因为 AC − B² 不为 0，判别法能够判定。`),
        audit: { kind: 'MIT-MV-31:classify', params: { a: q.a, b: q.b, c: q.c } },
      }),
      g.choice({
        id: 'inconclusive', title: t('When the test says nothing', '判别法无结论时'),
        prompt: t(`f(x, y) = ${quarticF} has f_x = f_y = 0 at (0, 0), and there f_xx f_yy − f_xy² = 0. Which statement is correct?`,
          `f(x, y) = ${quarticF} 在 (0, 0) 处 f_x = f_y = 0，并且 f_xx f_yy − f_xy² = 0。哪个说法正确？`),
        options: [
          t('The test says nothing, but f ≥ 0 = f(0, 0) at every point of the plane, so (0, 0) is a minimum.', '判别法没有结论，但在平面上每一点都有 f ≥ 0 = f(0, 0)，所以 (0, 0) 是极小点。'),
          t('The test says nothing, but f ≤ 0 = f(0, 0) at every point of the plane, so (0, 0) is a maximum.', '判别法没有结论，但在平面上每一点都有 f ≤ 0 = f(0, 0)，所以 (0, 0) 是极大点。'),
          t('The test says nothing, but f changes sign between the two axes, so (0, 0) is a saddle point.', '判别法没有结论，但 f 在两条坐标轴上符号相反，所以 (0, 0) 是鞍点。'),
          t('Because f_xx f_yy − f_xy² = 0, the point (0, 0) is always a saddle point.', '因为 f_xx f_yy − f_xy² = 0，所以 (0, 0) 总是鞍点。'),
        ], correct: quarticCase,
        hint: t('When the discriminant is 0 look at f itself near (0, 0), for example along the two axes.', '判别式为 0 时，直接研究 f 在 (0, 0) 附近的取值，例如沿两条坐标轴。'),
        explanation: t(`A zero discriminant does not decide anything. Compare with f(0, 0) = 0: along the x-axis f = ${coef(quartic.s1 * quartic.k1, 'x⁴')} is ${quartic.s1 > 0 ? 'non-negative' : 'non-positive'}, along the y-axis f = ${coef(quartic.s2 * quartic.k2, 'y⁴')} is ${quartic.s2 > 0 ? 'non-negative' : 'non-positive'}. ${quarticCase === 0 ? 'Both are ≥ 0, and f ≥ 0 everywhere: a minimum.' : quarticCase === 1 ? 'Both are ≤ 0, and f ≤ 0 everywhere: a maximum.' : 'The signs differ: a saddle point.'} The claim that a zero value of f_xx f_yy − f_xy² means a saddle point is false: x⁴ + y⁴ has a minimum there.`,
          `判别式为 0 时什么也不能判定。与 f(0, 0) = 0 比较：沿 x 轴 f = ${coef(quartic.s1 * quartic.k1, 'x⁴')} ${quartic.s1 > 0 ? '≥ 0' : '≤ 0'}，沿 y 轴 f = ${coef(quartic.s2 * quartic.k2, 'y⁴')} ${quartic.s2 > 0 ? '≥ 0' : '≤ 0'}。${quarticCase === 0 ? '两者都 ≥ 0，且处处 f ≥ 0：极小点。' : quarticCase === 1 ? '两者都 ≤ 0，且处处 f ≤ 0：极大点。' : '符号相反：鞍点。'}「f_xx f_yy − f_xy² = 0 就是鞍点」的说法是错的：x⁴ + y⁴ 在该点取极小值。`),
      }),
      g.number({
        id: 'boundary-max', title: t('Largest value in the first quadrant', '第一象限内的最大值'),
        prompt: t(`On the first quadrant x ≥ 0, y ≥ 0, find the point where w(x, y) = ${bmF} is largest, and the largest value of w. Enter x, y and w. (Fractions or decimals are fine.)`,
          `在第一象限 x ≥ 0，y ≥ 0 内，求 w(x, y) = ${bmF} 取最大值的点以及最大值。依次输入 x、y 与 w（分数或小数均可）。`),
        fields: [{ label: t('x', 'x'), answer: bmX }, { label: t('y', 'y'), answer: 0 }, { label: t('largest w', '最大值 w'), answer: bmW }],
        hint: t('Is the critical point inside the quadrant? If not, the maximum is on the boundary.', '临界点在象限内吗？若不在，最大值在边界上。'),
        explanation: t(`The only critical point has y = ${bmCrit} < 0, outside the quadrant, so the maximum is on the boundary. On x = 0: w = ${poly2([[-bm.c, 0, 2], [-bm.e, 0, 1]], 'x', 'y')} ≤ 0, largest (0) at y = 0. On y = 0: w = ${poly2([[-bm.a, 2, 0], [bm.d, 1, 0]])}, largest at x = ${frac(bm.d, 2 * bm.a)} with w = ${num(bmW)} > 0. For large x or y, w → −∞, so nothing larger lies out at infinity. The maximum is at (${num(bmX)}, 0).`,
          `唯一的临界点 y = ${bmCrit} < 0，在象限之外，所以最大值在边界上。在 x = 0 上：w = ${poly2([[-bm.c, 0, 2], [-bm.e, 0, 1]], 'x', 'y')} ≤ 0，在 y = 0 处最大（为 0）。在 y = 0 上：w = ${poly2([[-bm.a, 2, 0], [bm.d, 1, 0]])}，在 x = ${frac(bm.d, 2 * bm.a)} 处最大，w = ${num(bmW)} > 0。当 x 或 y 很大时 w → −∞，所以无穷远处不会更大。最大值点是 (${num(bmX)}, 0)。`),
        audit: { kind: 'MIT-MV-31:boundary-max', params: { a: bm.a, c: bm.c, d: bm.d, e: bm.e } },
      }),
      g.number({
        id: 'chain-rule', title: t('Chain rule with two intermediate variables', '双中间变量的链式法则'),
        prompt: t(`Let w = w(u, v) with u = y/x and v = x² + y². At the point (x, y) = (${num(ch.x0)}, ${num(ch.y0)}) suppose w_u = ${num(ch.A)} and w_v = ${num(ch.B)}. Find w_x and w_y at this point.`,
          `设 w = w(u, v)，其中 u = y/x，v = x² + y²。在点 (x, y) = (${num(ch.x0)}, ${num(ch.y0)}) 处 w_u = ${num(ch.A)}，w_v = ${num(ch.B)}。求该点的 w_x 与 w_y。`),
        fields: [{ label: t('w_x', 'w_x'), answer: chWx }, { label: t('w_y', 'w_y'), answer: chWy }],
        hint: t('w_x = w_u u_x + w_v v_x and w_y = w_u u_y + w_v v_y.', 'w_x = w_u u_x + w_v v_x，w_y = w_u u_y + w_v v_y。'),
        explanation: t(`u_x = −y/x², u_y = 1/x, v_x = 2x, v_y = 2y. So w_x = −(y/x²)w_u + 2x w_v = −(${num(ch.y0)}/${num(ch.x0 * ch.x0)})·${par(ch.A)} + 2·${par(ch.x0)}·${par(ch.B)} = ${num(chWx)}, and w_y = (1/x)w_u + 2y w_v = (1/${par(ch.x0)})·${par(ch.A)} + 2·${par(ch.y0)}·${par(ch.B)} = ${num(chWy)}.`,
          `u_x = −y/x²，u_y = 1/x，v_x = 2x，v_y = 2y。所以 w_x = −(y/x²)w_u + 2x w_v = −(${num(ch.y0)}/${num(ch.x0 * ch.x0)})·${par(ch.A)} + 2·${par(ch.x0)}·${par(ch.B)} = ${num(chWx)}，w_y = (1/x)w_u + 2y w_v = (1/${par(ch.x0)})·${par(ch.A)} + 2·${par(ch.y0)}·${par(ch.B)} = ${num(chWy)}。`),
        audit: { kind: 'MIT-MV-31:chain-rule', params: { x0: ch.x0, y0: ch.y0, wu: ch.A, wv: ch.B } },
      }),
      g.number({
        id: 'total-diff', title: t('Total differentials of two surfaces', '两个曲面的全微分'),
        prompt: t(`The surfaces ${poly3(tdF1)} = ${num(td.p + td.q + td.r)} and ${poly3(tdF2)} = ${num(td.a + td.b + td.c)} both pass through (1, 1, 1) and meet in a curve along which y is a function of x. Find dy/dx at (x, y, z) = (1, 1, 1). Enter an integer or fraction.`,
          `曲面 ${poly3(tdF1)} = ${num(td.p + td.q + td.r)} 与 ${poly3(tdF2)} = ${num(td.a + td.b + td.c)} 都过点 (1, 1, 1)，它们相交成一条曲线，沿该曲线 y 是 x 的函数。求 (x, y, z) = (1, 1, 1) 处的 dy/dx。输入整数或分数。`),
        fields: [{ label: t('dy/dx', 'dy/dx'), answer: tdNum / tdDen }],
        hint: t('Take the total differential of each equation, then eliminate dz.', '对每个方程取全微分，再消去 dz。'),
        explanation: t(`At (1, 1, 1) the total differentials are ${diffLin(tdA1, tdB1, tdC1)} = 0 and ${diffLin(tdA2, tdB2, tdC2)} = 0. Eliminating dz (multiply the first by ${par(tdC2)}, the second by ${par(tdC1)}, subtract) gives ${diffLin(tdA1 * tdC2 - tdA2 * tdC1, 0, 0)} = ${diffLin(0, tdB2 * tdC1 - tdB1 * tdC2, 0)}, so dy/dx = ${frac(tdNum, tdDen)}.`,
          `在 (1, 1, 1) 处，全微分方程为 ${diffLin(tdA1, tdB1, tdC1)} = 0 和 ${diffLin(tdA2, tdB2, tdC2)} = 0。消去 dz（第一式乘 ${par(tdC2)}，第二式乘 ${par(tdC1)}，相减）得 ${diffLin(tdA1 * tdC2 - tdA2 * tdC1, 0, 0)} = ${diffLin(0, tdB2 * tdC1 - tdB1 * tdC2, 0)}，所以 dy/dx = ${frac(tdNum, tdDen)}。`),
        audit: { kind: 'MIT-MV-31:total-diff', params: { p: td.p, q: td.q, r: td.r, a: td.a, b: td.b, c: td.c } },
      }),
      g.choice({
        id: 'choose-tool', title: t('Which tool fits the problem?', '哪种方法适合这道题？'),
        prompt: [
          t(`Which method fits this problem? Find the point of the surface x² + y² + 2z² = ${tc.c} at which x is largest.`, `哪种方法适合这道题？在曲面 x² + y² + 2z² = ${tc.c} 上求 x 最大的点。`),
          t(`Which method fits this problem? You know f(2, 1) = ${tc.v0}, f_x(2, 1) = ${num(tc.fx)} and f_y(2, 1) = ${num(tc.fy)}. Estimate f(2.1, 0.9).`, `哪种方法适合这道题？已知 f(2, 1) = ${tc.v0}，f_x(2, 1) = ${num(tc.fx)}，f_y(2, 1) = ${num(tc.fy)}。估计 f(2.1, 0.9)。`),
          t(`Which method fits this problem? At a critical point of w the second derivatives are w_xx = ${tc.fxx}, w_yy = ${tc.fyy} and w_xy = ${tc.fxy}. Decide whether it is a minimum, a maximum or a saddle.`, `哪种方法适合这道题？w 在某临界点处的二阶导数为 w_xx = ${tc.fxx}，w_yy = ${tc.fyy}，w_xy = ${tc.fxy}。判断它是极小点、极大点还是鞍点。`),
          t(`Which method fits this problem? w = w(u, v) with u = x + y and v = ${coef(tc.m, 'xy')}. Express w_x in terms of w_u and w_v.`, `哪种方法适合这道题？w = w(u, v)，其中 u = x + y，v = ${coef(tc.m, 'xy')}。用 w_u 与 w_v 表示 w_x。`),
        ][toolCase],
        options: [t('Lagrange multipliers', '拉格朗日乘数法'), t('Linear (tangent-plane) approximation', '线性（切平面）近似'), t('The second derivative test', '二阶导数判别法'), t('The chain rule', '链式法则')], correct: toolCase,
        hint: t('Ask what is given and what is wanted: a constrained extreme value, a nearby value, a type of critical point, or a derivative of a composite?', '看已知什么、要求什么：条件极值、邻近点的值、临界点的类型，还是复合函数的导数？'),
        explanation: [
          t('Finding where x is largest on a surface g = c is a constrained optimisation problem: ∇f = λ∇g with f = x, together with the constraint.', '在曲面 g = c 上求 x 最大的点是条件极值问题：取 f = x，解 ∇f = λ∇g 及约束方程。'),
          t('Estimating a nearby value from f, f_x and f_y at one point is exactly the linear approximation f ≈ f(P) + f_xΔx + f_yΔy.', '由一点处的 f、f_x、f_y 估计邻近点的值，正是线性近似 f ≈ f(P) + f_xΔx + f_yΔy。'),
          t('Deciding the type of a critical point from w_xx, w_yy and w_xy is the second derivative test (look at w_xx w_yy − w_xy²).', '由 w_xx、w_yy、w_xy 判断临界点类型，用的是二阶导数判别法（看 w_xx w_yy − w_xy²）。'),
          t('w depends on x through u and v, so w_x = w_u u_x + w_v v_x: the chain rule.', 'w 通过 u 和 v 依赖于 x，所以 w_x = w_u u_x + w_v v_x：这是链式法则。'),
        ][toolCase],
      }),
      g.choice({
        id: 'lagrange-setup', title: t('Lagrange multiplier equations', '拉格朗日乘数方程'),
        prompt: t(`Consider the surface ${gSurface} = ${lg.c}. At the point of the surface where ${'xyz'[lg.coord]} is largest, which are the Lagrange multiplier equations ∇f = λ∇g (besides the constraint)? Here g = ${gSurface}, so ∇g = (${gx}, ${gy}, ${gz}). Do not solve them.`,
          `考虑曲面 ${gSurface} = ${lg.c}。在曲面上 ${'xyz'[lg.coord]} 最大的点处，拉格朗日乘数方程 ∇f = λ∇g（除约束方程外）是哪一组？这里 g = ${gSurface}，所以 ∇g = (${gx}, ${gy}, ${gz})。不必求解。`),
        options: [0, 1, 2].map(i => t(`${unitVec(i)} = λ(${gx}, ${gy}, ${gz})`, `${unitVec(i)} = λ(${gx}, ${gy}, ${gz})`)).concat([t(`(${gx}, ${gy}, ${gz}) = (0, 0, 0)`, `(${gx}, ${gy}, ${gz}) = (0, 0, 0)`)]),
        correct: lg.coord, fixedOrder: true,
        hint: t(`The function to maximise is f = ${'xyz'[lg.coord]}; its gradient has a single non-zero component.`, `要最大化的函数是 f = ${'xyz'[lg.coord]}；它的梯度只有一个非零分量。`),
        explanation: t(`With f = ${'xyz'[lg.coord]} we have ∇f = ${unitVec(lg.coord)}, so ∇f = λ∇g reads ${unitVec(lg.coord)} = λ(${gx}, ${gy}, ${gz}). The equations with the 1 in another place maximise a different coordinate, and (${gx}, ${gy}, ${gz}) = (0, 0, 0) would only find critical points of g itself, which ignores f.`,
          `取 f = ${'xyz'[lg.coord]}，则 ∇f = ${unitVec(lg.coord)}，所以 ∇f = λ∇g 就是 ${unitVec(lg.coord)} = λ(${gx}, ${gy}, ${gz})。把 1 放在别的位置的方程组最大化的是别的坐标；而 (${gx}, ${gy}, ${gz}) = (0, 0, 0) 只能求出 g 自身的临界点，与 f 无关。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Find the largest value of f(x, y) = ${linear([cp[0], cp[1]], ['x', 'y'])} on the circle of radius ${cR}, x² + y² = ${cR * cR}, and the point (x, y) of the circle where it is attained. Enter x, y and the largest value.`,
          `求 f(x, y) = ${linear([cp[0], cp[1]], ['x', 'y'])} 在半径为 ${cR} 的圆 x² + y² = ${cR * cR} 上的最大值，以及取到最大值的圆上的点 (x, y)。依次输入 x、y 与最大值。`),
        fields: [{ label: t('x', 'x'), answer: cx }, { label: t('y', 'y'), answer: cy }, { label: t('largest f', '最大值 f'), answer: cMax }],
        hint: t('Constrained maximum: use ∇f = λ∇g with g = x² + y² and the constraint.', '条件极值：用 ∇f = λ∇g（g = x² + y²）和约束方程。'),
        explanation: t(`∇f = ${vec(cp[0], cp[1])} = λ(2x, 2y), so x = ${num(cp[0])}/(2λ) and y = ${num(cp[1])}/(2λ): the point is a multiple of ${vec(cp[0], cp[1])}. Then x² + y² = ${cR * cR} gives (x, y) = ${cR}/5·${vec(cp[0], cp[1])} = ${vec(cx, cy)} (the maximum, because f is largest in the direction of ∇f), and f = ${par(cp[0])}·${par(cx)} + ${par(cp[1])}·${par(cy)} = ${num(cMax)}. This exam deck does not assess second-order tests for constrained problems.`,
          `∇f = ${vec(cp[0], cp[1])} = λ(2x, 2y)，所以 x = ${num(cp[0])}/(2λ)，y = ${num(cp[1])}/(2λ)：该点是 ${vec(cp[0], cp[1])} 的倍数。再由 x² + y² = ${cR * cR} 得 (x, y) = ${cR}/5·${vec(cp[0], cp[1])} = ${vec(cx, cy)}（这是最大值点，因为 f 沿 ∇f 方向最大），并且 f = ${par(cp[0])}·${par(cx)} + ${par(cp[1])}·${par(cy)} = ${num(cMax)}。本套考试题不检查条件极值的二阶判别。`),
        audit: { kind: 'MIT-MV-31:challenge', params: { p: cp[0], q: cp[1], R: cR } },
      }),
    ];
  },

  // ================================================================================================
  // MIT-MV-32 Definition of Double Integrals (session 47)
  // ================================================================================================
  'MIT-MV-32': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-32');
    warm(g);
    /** Sum of f = p x + q y + r over the unit squares of [0, m] × [0, n], taking the corner (i + off, j + off) of square (i, j). */
    const cornerSum = (v: { m: number; n: number; p: number; q: number; r: number }, off: 0 | 1) => {
      let s = 0;
      for (let i = 0; i < v.m; i++) for (let j = 0; j < v.n; j++) s += v.p * (i + off) + v.q * (j + off) + v.r;
      return s;
    };

    const nPieces = g.random(4, 12);
    const qty = g.random(0, 2); // 0 mass, 1 volume, 2 population
    const integrand = ['δ(x, y)', 'f(x, y)', 'ρ(x, y)'][qty];
    const grid = retry(() => ({ m: g.random(2, 3), n: g.random(2, 3), p: g.nonzero(-3, 3), q: g.nonzero(-3, 3), r: g.random(-4, 4) }), v => cornerSum(v, 0) !== 0);
    const gridSum = cornerSum(grid, 0);
    const { dA, dens } = retry(() => ({ dA: [0, 1, 2, 3].map(() => g.random(1, 4)), dens: [0, 1, 2, 3].map(() => g.random(1, 6)) }),
      v => new Set(v.dA.map((a, i) => `${a}/${v.dens[i]}`)).size === 4);
    const tableSum = dA.reduce((s, a, i) => s + a * dens[i], 0);
    const sp = retry(() => ({ m: g.random(2, 3), n: g.random(2, 3), p: g.nonzero(-3, 3), q: g.nonzero(-3, 3) }), v => v.p + v.q !== 0);
    const spLL = cornerSum({ ...sp, r: 0 }, 0), spUR = cornerSum({ ...sp, r: 0 }, 1);
    const bigN = g.pick([20, 50, 100, 200]);
    const unit = g.pick([['kg', 'm'], ['g', 'cm'], ['kg', 'cm'], ['g', 'm']] as const);
    const ch = retry(() => ({ m: g.random(2, 4), n: g.random(2, 4), p: g.nonzero(-3, 3), q: g.nonzero(-3, 3), r: g.random(-4, 4) }), v => cornerSum(v, 1) !== 0);
    const chSum = cornerSum(ch, 1);

    const gridShapes: FigureShape[] = [fill([[0, 0], [grid.m, 0], [grid.m, grid.n], [0, grid.n]])];
    for (let i = 0; i <= grid.m; i++) gridShapes.push(seg([i, 0], [i, grid.n]));
    for (let j = 0; j <= grid.n; j++) gridShapes.push(seg([0, j], [grid.m, j]));
    for (let i = 0; i < grid.m; i++) for (let j = 0; j < grid.n; j++) gridShapes.push({ kind: 'point', at: [i, j], tone: 'warn' });

    const sumX = grid.n * grid.m * (grid.m - 1) / 2, sumY = grid.m * grid.n * (grid.n - 1) / 2, count = grid.m * grid.n;
    const sumX2 = ch.n * ch.m * (ch.m + 1) / 2, sumY2 = ch.m * ch.n * (ch.n + 1) / 2, count2 = ch.m * ch.n;
    const uM = unit[0], uL = unit[1];

    return [
      g.choice({
        id: 'piece-area', title: t('The pieces of a Riemann sum', '黎曼和中的小块'),
        prompt: t(`A region R of the plane is cut into n = ${nPieces} small pieces. In the piece number i we choose a point (x_i, y_i). In the sum Σ f(x_i, y_i) ΔA_i (i = 1, …, n), what does ΔA_i stand for?`,
          `平面区域 R 被分成 n = ${nPieces} 个小块。在第 i 块中取一点 (x_i, y_i)。在和式 Σ f(x_i, y_i) ΔA_i（i = 1, …, n）中，ΔA_i 表示什么？`),
        options: [
          t('The area of the i-th small piece of R.', '第 i 个小块的面积。'),
          t('The length of the i-th piece measured along the x-axis.', '第 i 个小块沿 x 轴方向的长度。'),
          t('The value of f at the chosen point of the i-th piece.', 'f 在第 i 块所取点处的函数值。'),
        ], correct: 0,
        hint: t('Each term is "value of f" times a second factor. What does the second factor measure?', '每一项是「f 的值」乘另一个因子。这个因子度量什么？'),
        explanation: t('ΔA_i is the area of the i-th piece. The term f(x_i, y_i) ΔA_i is a value of f times the area it is spread over, such as a height times a base area, so the sum adds up pieces of volume, mass or similar. The value of f at the chosen point is the factor f(x_i, y_i) itself, not ΔA_i.',
          'ΔA_i 是第 i 个小块的面积。f(x_i, y_i) ΔA_i 是 f 的值乘以它所分布的面积，例如高乘底面积，所以这个和式把一小块一小块的体积、质量等加起来。f 在所取点的函数值是因子 f(x_i, y_i) 本身，而不是 ΔA_i。'),
      }),
      g.symbols({
        id: 'setup', title: t('From the sum to the integral', '从和式到积分'),
        prompt: [
          t(`A thin plate fills a region R of the xy-plane. Its density δ(x, y) is mass per unit area, so the piece with area ΔA_i has mass Δm_i ≈ δ(x_i, y_i) ΔA_i. Write the total mass M = lim Σ δ(x_i, y_i) ΔA_i as a double integral. Fill the three blanks: the integral sign with its region, the integrand, the area element.`,
            `一块薄板占据 xy 平面上的区域 R。密度 δ(x, y) 是单位面积的质量，所以面积为 ΔA_i 的小块质量 Δm_i ≈ δ(x_i, y_i) ΔA_i。把总质量 M = lim Σ δ(x_i, y_i) ΔA_i 写成二重积分。填三个空：带区域的积分号、被积函数、面积元素。`),
          t(`A solid lies below the graph z = f(x, y) (with f ≥ 0) and above a region R of the xy-plane. The part above the i-th piece is almost a box: ΔV_i ≈ f(x_i, y_i) ΔA_i. Write the volume V = lim Σ f(x_i, y_i) ΔA_i as a double integral. Fill the three blanks: the integral sign with its region, the integrand, the area element.`,
            `一个立体位于曲面 z = f(x, y)（f ≥ 0）之下、xy 平面上区域 R 之上。第 i 小块上方的部分近似为长方体：ΔV_i ≈ f(x_i, y_i) ΔA_i。把体积 V = lim Σ f(x_i, y_i) ΔA_i 写成二重积分。填三个空：带区域的积分号、被积函数、面积元素。`),
          t(`A region R of a map has population density ρ(x, y) in people per km², and ΔA_i is measured in km². The population is N = lim Σ ρ(x_i, y_i) ΔA_i. Write it as a double integral. Fill the three blanks: the integral sign with its region, the integrand, the area element.`,
            `地图上的区域 R 有人口密度 ρ(x, y)（单位：人/km²），ΔA_i 以 km² 计。人口总数是 N = lim Σ ρ(x_i, y_i) ΔA_i。把它写成二重积分。填三个空：带区域的积分号、被积函数、面积元素。`),
        ][qty],
        before: `${'MVN'[qty]} =`, between: [' ', ' '], answers: ['∬_R', integrand, 'dA'],
        tokens: shuffled(g, ['∬_R', 'Σ', 'δ(x, y)', 'f(x, y)', 'ρ(x, y)', 'dA', 'ΔA', 'dx']),
        hint: t('Each term of the sum is (value at the point) × (area of the piece). In the limit the sum becomes the integral and ΔA becomes dA.', '和式的每一项是（该点的函数值）×（小块面积）。取极限后和式变成积分，ΔA 变成 dA。'),
        explanation: t(`In the limit the sum Σ ${integrand} ΔA_i becomes ∬_R ${integrand} dA: the sum sign turns into the integral over R and ΔA_i into dA. The other densities or functions in the list belong to other quantities.`,
          `取极限后，和式 Σ ${integrand} ΔA_i 变成 ∬_R ${integrand} dA：求和号变为在 R 上的积分，ΔA_i 变为 dA。列表中其他的密度或函数对应的是别的量。`),
      }),
      g.number({
        id: 'riemann-sum', title: t('A Riemann sum on a grid', '网格上的黎曼和'),
        prompt: t(`R is the rectangle 0 ≤ x ≤ ${grid.m}, 0 ≤ y ≤ ${grid.n}, cut into ${count} unit squares (ΔA_i = 1 for every square). In each square take (x_i, y_i) to be its lower-left corner, as marked in the figure. For f(x, y) = ${linPQR(grid.p, grid.q, grid.r)}, compute the Riemann sum Σ f(x_i, y_i) ΔA_i.`,
          `R 是矩形 0 ≤ x ≤ ${grid.m}，0 ≤ y ≤ ${grid.n}，被分成 ${count} 个单位正方形（每块 ΔA_i = 1）。在每个正方形中取其左下角为 (x_i, y_i)，如图中标记所示。对 f(x, y) = ${linPQR(grid.p, grid.q, grid.r)}，计算黎曼和 Σ f(x_i, y_i) ΔA_i。`),
        figure: g.figure({
          alt: t(`The rectangle 0 ≤ x ≤ ${grid.m}, 0 ≤ y ≤ ${grid.n} divided into unit squares, with a marked point at the lower-left corner of every square.`,
            `矩形 0 ≤ x ≤ ${grid.m}，0 ≤ y ≤ ${grid.n} 被分成单位正方形，每个正方形的左下角有一个标记点。`),
          view: fitView(gridShapes, 0.2), axes: AXES, shapes: gridShapes, caption: t('Lower-left corners', '左下角取点'),
        }),
        fields: [{ label: t('Σ f(x_i, y_i) ΔA_i', 'Σ f(x_i, y_i) ΔA_i'), answer: gridSum }],
        hint: t(`The lower-left corners are the points (i, j) with i = 0, …, ${grid.m - 1} and j = 0, …, ${grid.n - 1}. Since ΔA_i = 1, just add the values of f at those corners.`, `左下角是点 (i, j)，i = 0, …, ${grid.m - 1}，j = 0, …, ${grid.n - 1}。因为 ΔA_i = 1，只要把 f 在这些点的值相加。`),
        explanation: t(`The ${count} corners have Σ x_i = ${num(sumX)} and Σ y_i = ${num(sumY)}. Since ΔA_i = 1 the sum is ${par(grid.p)}·${num(sumX)} + ${par(grid.q)}·${num(sumY)} + ${par(grid.r)}·${count} = ${num(gridSum)}. This is only an approximation of ∬_R f dA: finer grids would change it.`,
          `这 ${count} 个角点满足 Σ x_i = ${num(sumX)}，Σ y_i = ${num(sumY)}。因为 ΔA_i = 1，和为 ${par(grid.p)}·${num(sumX)} + ${par(grid.q)}·${num(sumY)} + ${par(grid.r)}·${count} = ${num(gridSum)}。这只是 ∬_R f dA 的近似值：网格更细时它会改变。`),
        audit: { kind: 'MIT-MV-32:corner-sum', params: { m: grid.m, n: grid.n, p: grid.p, q: grid.q, r: grid.r } },
      }),
      g.number({
        id: 'table-sum', title: t('A Riemann sum from a table', '由数据表算黎曼和'),
        prompt: t(`A plate R is cut into four pieces. The areas ΔA_i (in m²) and the density δ(x_i, y_i) (in kg/m²) at the chosen point of each piece are listed below. Estimate the mass M ≈ Σ δ(x_i, y_i) ΔA_i in kg.`,
          `一块薄板 R 被分成四小块。每块的面积 ΔA_i（单位 m²）与所取点处的密度 δ(x_i, y_i)（单位 kg/m²）列在下面。估计质量 M ≈ Σ δ(x_i, y_i) ΔA_i（单位 kg）。`),
        lines: [0, 1, 2, 3].map(i => t(`Piece ${i + 1}: ΔA = ${dA[i]} m², δ = ${dens[i]} kg/m²`, `第 ${i + 1} 块：ΔA = ${dA[i]} m²，δ = ${dens[i]} kg/m²`)),
        fields: [{ label: t('M (kg)', 'M（kg）'), answer: tableSum }],
        hint: t('Multiply density by area piece by piece, then add the four products.', '逐块把密度乘以面积，再把四个乘积相加。'),
        explanation: t(`${dA.map((a, i) => `${a}·${dens[i]}`).join(' + ')} = ${dA.map((a, i) => a * dens[i]).join(' + ')} = ${num(tableSum)} kg. Each product δ(x_i, y_i) ΔA_i is a mass (kg/m² times m²), so the sum is a mass. It is an estimate: the true density varies inside every piece.`,
          `${dA.map((a, i) => `${a}·${dens[i]}`).join(' + ')} = ${dA.map((a, i) => a * dens[i]).join(' + ')} = ${num(tableSum)} kg。每个乘积 δ(x_i, y_i) ΔA_i 是质量（kg/m² 乘 m²），所以和是质量。这只是估计：每一块内部的真实密度是变化的。`),
        audit: { kind: 'MIT-MV-32:table-sum', params: { dA, delta: dens } },
      }),
      g.choice({
        id: 'sample-point', title: t('Does the choice of sample point matter?', '取点方式有影响吗？'),
        prompt: t(`R = [0, ${sp.m}] × [0, ${sp.n}] is cut into ${sp.m * sp.n} unit squares (ΔA_i = 1) and f(x, y) = ${linear([sp.p, sp.q], ['x', 'y'])}. Student A takes the lower-left corner of each square as (x_i, y_i); Student B takes the upper-right corner. Their sums are ${num(spLL)} and ${num(spUR)}. Which statement is correct?`,
          `R = [0, ${sp.m}] × [0, ${sp.n}] 被分成 ${sp.m * sp.n} 个单位正方形（ΔA_i = 1），f(x, y) = ${linear([sp.p, sp.q], ['x', 'y'])}。甲取每个正方形的左下角为 (x_i, y_i)，乙取右上角。两人的和分别是 ${num(spLL)} 与 ${num(spUR)}。哪个说法正确？`),
        options: [
          t('The sums differ, but both approximate ∬_R f dA and both approach the same limit as the pieces shrink.', '两个和不同，但都是 ∬_R f dA 的近似，并且随着小块变小，两者趋于同一个极限。'),
          t('Only A is a genuine Riemann sum, because the point (x_i, y_i) has to be the lower-left corner of its piece, so B is wrong.', '只有甲的是真正的黎曼和，因为 (x_i, y_i) 必须取小块的左下角，所以乙的做法是错的。'),
          t('The sums must be equal, because both students cut R into the same pieces and use the same f.', '两个和必须相等，因为两人把 R 分成了同样的小块，用的又是同一个 f。'),
        ], correct: 0,
        hint: t('Any point inside (or on the edge of) the piece is allowed. Does the limit depend on the choice?', '小块内（含边界）的任意点都允许。极限是否依赖于这个选择？'),
        explanation: t(`The sums really differ: B's sum minus A's sum is ${num(spUR - spLL)}, because each term of B differs from the matching term of A by f(i + 1, j + 1) − f(i, j) = ${num(sp.p + sp.q)}, and there are ${sp.m * sp.n} terms. This is no contradiction: the double integral is the limit as the pieces shrink, and in 18.02 that limit exists and does not depend on how the points are chosen. A single sum is only an approximation. So "the sums must be equal" is false, and so is "only the lower-left corner is allowed". This game does not assess when such a limit might fail to exist.`,
          `两个和确实不同：乙的和减去甲的和为 ${num(spUR - spLL)}，因为乙的每一项与甲的对应项相差 f(i + 1, j + 1) − f(i, j) = ${num(sp.p + sp.q)}，一共有 ${sp.m * sp.n} 项。这并不矛盾：二重积分是小块变小时的极限，在 18.02 中这个极限存在，并且不依赖于取点方式。单独一个和只是近似值。所以「两个和必须相等」是错的，「只能取左下角」也是错的。本游戏不涉及这类极限何时可能不存在。`),
      }),
      g.choice({
        id: 'limit', title: t('When the sum becomes the integral', '和式何时变成积分'),
        prompt: t(`A student cuts R into N = ${bigN} pieces and computes S = Σ f(x_i, y_i) ΔA_i. Which statement about S and the double integral ∬_R f dA is correct?`,
          `一位同学把 R 分成 N = ${bigN} 块，算出 S = Σ f(x_i, y_i) ΔA_i。关于 S 与二重积分 ∬_R f dA，哪个说法正确？`),
        options: [
          t('S is an approximation; the integral is the limit of such sums as the pieces get finer (N → ∞, every ΔA_i → 0).', 'S 是近似值；积分是这类和式在小块越分越细（N → ∞，每个 ΔA_i → 0）时的极限。'),
          t(`S equals the integral exactly once the number of pieces is as large as N = ${bigN}, because then the pieces are small enough.`, `只要块数达到 N = ${bigN} 这么多，S 就恰好等于积分，因为这时小块已经足够小。`),
          t('S equals the integral exactly whenever all the pieces are squares, whatever their number or size.', '只要所有小块都是正方形，不管块数多少、大小如何，S 就恰好等于积分。'),
        ], correct: 0,
        hint: t('The definition involves a limit, not a fixed number of pieces.', '定义涉及的是极限，而不是某个固定的块数。'),
        explanation: t(`A finite sum with N = ${bigN} pieces is still an approximation; only in the limit of infinitely many pieces, each with area going to 0, does it become ∬_R f dA. Squares or not, no fixed number of pieces gives the exact value in general. In 18.02 the technical conditions for this limit to exist are always met.`,
          `N = ${bigN} 块的有限和仍然只是近似；只有在块数趋于无穷、每块面积趋于 0 的极限下，它才变成 ∬_R f dA。无论是不是正方形，一般来说没有任何固定块数能给出精确值。在 18.02 中，这个极限存在的技术条件总是满足的。`),
      }),
      g.choice({
        id: 'units', title: t('What does the double integral measure?', '二重积分的量纲'),
        prompt: t(`A plate has density δ in ${uM}/${uL}² (mass per unit area), and areas are measured in ${uL}². In what unit is the mass M = ∬_R δ dA?`,
          `一块薄板的密度 δ 以 ${uM}/${uL}²（单位面积的质量）计，面积以 ${uL}² 计。质量 M = ∬_R δ dA 的单位是什么？`),
        options: [t(`${uM}`, `${uM}`), t(`${uM}/${uL}²`, `${uM}/${uL}²`), t(`${uM}·${uL}²`, `${uM}·${uL}²`)], correct: 0,
        hint: t('Each term of the sum is density × area. Multiply the units.', '和式的每一项是密度 × 面积。把单位相乘。'),
        explanation: t(`Each term δ ΔA has the unit (${uM}/${uL}²)·${uL}² = ${uM}, and a sum of masses is a mass. The unit ${uM}/${uL}² is that of the density δ itself, and ${uM}·${uL}² would come from multiplying the density by the area twice.`,
          `每一项 δ ΔA 的单位是 (${uM}/${uL}²)·${uL}² = ${uM}，质量之和还是质量。${uM}/${uL}² 是密度 δ 本身的单位，而 ${uM}·${uL}² 则是把密度与面积相乘了两次才会出现的。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`R is the rectangle 0 ≤ x ≤ ${ch.m}, 0 ≤ y ≤ ${ch.n}, cut into ${count2} unit squares. In each square take (x_i, y_i) to be its upper-right corner. For f(x, y) = ${linPQR(ch.p, ch.q, ch.r)}, compute the Riemann sum Σ f(x_i, y_i) ΔA_i.`,
          `R 是矩形 0 ≤ x ≤ ${ch.m}，0 ≤ y ≤ ${ch.n}，被分成 ${count2} 个单位正方形。在每个正方形中取其右上角为 (x_i, y_i)。对 f(x, y) = ${linPQR(ch.p, ch.q, ch.r)}，计算黎曼和 Σ f(x_i, y_i) ΔA_i。`),
        fields: [{ label: t('Σ f(x_i, y_i) ΔA_i', 'Σ f(x_i, y_i) ΔA_i'), answer: chSum }],
        hint: t(`The upper-right corners are the points (i, j) with i = 1, …, ${ch.m} and j = 1, …, ${ch.n}.`, `右上角是点 (i, j)，i = 1, …, ${ch.m}，j = 1, …, ${ch.n}。`),
        explanation: t(`Σ x_i = ${num(sumX2)}, Σ y_i = ${num(sumY2)} over the ${count2} corners, and ΔA_i = 1. So the sum is ${par(ch.p)}·${num(sumX2)} + ${par(ch.q)}·${num(sumY2)} + ${par(ch.r)}·${count2} = ${num(chSum)}. You practised building and evaluating a Riemann sum; computing the exact value of ∬_R f dA is not part of this game.`,
          `在这 ${count2} 个角点上 Σ x_i = ${num(sumX2)}，Σ y_i = ${num(sumY2)}，且 ΔA_i = 1。所以和为 ${par(ch.p)}·${num(sumX2)} + ${par(ch.q)}·${num(sumY2)} + ${par(ch.r)}·${count2} = ${num(chSum)}。你练习的是建立并计算黎曼和；求 ∬_R f dA 的精确值不在本游戏范围内。`),
        audit: { kind: 'MIT-MV-32:challenge', params: { m: ch.m, n: ch.n, p: ch.p, q: ch.q, r: ch.r } },
      }),
    ];
  },

  // ================================================================================================
  // MIT-MV-33 Examples of Double Integration (session 48): limits in rectangular coordinates
  // ================================================================================================
  'MIT-MV-33': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-33');
    warm(g);

    // Triangle with intercepts (a, 0) and (0, c = k a): the line is y = c − kx.
    const tri = (() => { const a = g.random(1, 3), k = g.random(1, 3); return { a, k, c: k * a }; })();
    const pq = retry(() => ({ p: g.nonzero(-3, 3), q: g.nonzero(-3, 3) }), v => v.p * tri.a + v.q * tri.c !== 0);
    const triInt = tri.a * tri.c * (pq.p * tri.a + pq.q * tri.c) / 6;
    const lineText = `${tri.c} − ${coef(tri.k, 'x')}`;
    const xs = tri.a / 2;
    const triShapes: FigureShape[] = [
      fill([[0, 0], [tri.a, 0], [0, tri.c]]), outline([[0, 0], [tri.a, 0], [0, tri.c]]),
      seg([xs, 0], [xs, tri.c - tri.k * xs], 'warn', true),
      { kind: 'point', at: [tri.a, 0], tone: 'warn', label: `(${tri.a}, 0)` }, { kind: 'point', at: [0, tri.c], tone: 'warn', label: `(0, ${tri.c})` },
    ];
    const triFigure = g.figure({
      alt: t(`The triangle with vertices (0, 0), (${tri.a}, 0) and (0, ${tri.c}), below the line y = ${lineText}. A dashed vertical line at x = ${num(xs)} runs from the x-axis up to the line.`,
        `顶点为 (0, 0)、(${tri.a}, 0)、(0, ${tri.c}) 的三角形，位于直线 y = ${lineText} 之下。在 x = ${num(xs)} 处有一条虚线竖线，从 x 轴一直到该直线。`),
      view: fitView(triShapes, 0.22), axes: AXES, shapes: triShapes, caption: t(`y = ${lineText}`, `y = ${lineText}`),
    });

    // Curved region: between y = x² and y = x + s for 0 ≤ x ≤ 1.
    const cs = g.random(1, 4);
    const cp = g.random(1, 4);
    const lower: Pt[] = sampleCurve(x => [x, x * x], 0, 1, 24), upper: Pt[] = [[0, cs], [1, 1 + cs]];
    const curvedShapes: FigureShape[] = [
      fill([...lower, ...[...upper].reverse()]),
      { kind: 'line', points: lower, tone: 'accent', width: 2 }, { kind: 'line', points: upper, tone: 'accent', width: 2 },
      seg([0, 0], [0, cs]), seg([1, 1], [1, 1 + cs]),
      seg([0.5, 0.25], [0.5, 0.5 + cs], 'warn', true),
      { kind: 'text', at: [0.85, 0.45], text: 'y = x²', tone: 'text' }, { kind: 'text', at: [0.3, cs + 0.55], text: `y = x + ${cs}`, tone: 'text' },
    ];
    const curvedFigure = g.figure({
      alt: t(`The region between the parabola y = x² (below) and the line y = x + ${cs} (above) for 0 ≤ x ≤ 1, with a dashed vertical line at x = 0.5 crossing it from the parabola to the line.`,
        `抛物线 y = x²（下）与直线 y = x + ${cs}（上）之间、0 ≤ x ≤ 1 的区域，x = 0.5 处有一条虚线竖线，从抛物线穿到直线。`),
      view: fitView(curvedShapes, 0.18), axes: AXES, shapes: curvedShapes, caption: t('0 ≤ x ≤ 1', '0 ≤ x ≤ 1'),
    });
    const curvedArea = cs + 1 / 6;
    const curvedMass = cp * (1 + 6 * cs) / 12;

    // Tetrahedron under the plane z = h − p x − q y.
    const tt = (() => {
      const a = g.random(1, 3), b = g.random(1, 3);
      const L = a * b / gcd(a, b);
      const h = L * g.random(1, 2);
      return { a, b, h, p: h / a, q: h / b };
    })();
    const tetraV = tt.a * tt.b * tt.h / 6;
    const tetraShapes: FigureShape[] = [
      fill([[0, 0], [tt.a, 0], [0, tt.b]]), outline([[0, 0], [tt.a, 0], [0, tt.b]]),
      { kind: 'point', at: [tt.a, 0], tone: 'warn', label: `(${tt.a}, 0)` }, { kind: 'point', at: [0, tt.b], tone: 'warn', label: `(0, ${tt.b})` },
    ];
    const tetraFigure = g.figure({
      alt: t(`The base region R in the xy-plane: the triangle with vertices (0, 0), (${tt.a}, 0) and (0, ${tt.b}).`, `xy 平面上的底面区域 R：顶点为 (0, 0)、(${tt.a}, 0)、(0, ${tt.b}) 的三角形。`),
      view: fitView(tetraShapes, 0.25), axes: AXES, shapes: tetraShapes, caption: t('Base R of the tetrahedron', '四面体的底面 R'),
    });
    const tetraPlane = `${tt.h} − ${coef(tt.p, 'x')} − ${coef(tt.q, 'y')}`;

    // Challenge: right triangle under y = m x, x ≤ b.
    const ch = retry(() => ({ m: g.random(1, 3), b: g.random(1, 3), p: g.nonzero(-3, 3), q: g.nonzero(-3, 3) }), v => 2 * v.p + v.q * v.m !== 0);
    const chAns = ch.p * ch.m * ch.b ** 3 / 3 + ch.q * ch.m * ch.m * ch.b ** 3 / 6;
    /** The coefficient κ = (2pm + qm²)/2 of x² after the inner integral, as "κx²" (or just "κ" when `v` is empty). */
    const kapN = 2 * ch.p * ch.m + ch.q * ch.m * ch.m;
    const kap = (v: string) => (v === '' ? (kapN % 2 === 0 ? par(kapN / 2) : `(${frac(kapN, 2)})`) : kapN % 2 === 0 ? coef(kapN / 2, v) : `(${frac(kapN, 2)})${v}`);

    const triText = t(`the triangle bounded by the x-axis, the y-axis and the line y = ${lineText} (it meets the axes at (${tri.a}, 0) and (0, ${tri.c}))`,
      `由 x 轴、y 轴和直线 y = ${lineText} 围成的三角形（它与坐标轴交于 (${tri.a}, 0) 和 (0, ${tri.c})）`);
    const fPQ = linear([pq.p, pq.q], ['x', 'y']);

    // Slot card tokens for the triangle.
    const triTokens = shuffled(g, uniq(['0', `${tri.a}`, `${tri.c}`, lineText, `${tri.a} − ${coef(tri.k, 'x')}`, 'x', `${tri.c} + ${coef(tri.k, 'x')}`, `${tri.c}x`]));

    return [
      g.choice({
        id: 'vertical-line', title: t('How to find the limits', '如何确定积分限'),
        prompt: t(`You want to evaluate ∬_R f dy dx, where R is ${t2(triText, 0)}, with y as the inner variable (dy first, then dx). Which procedure produces the limits?`,
          `你要计算 ∬_R f dy dx，其中 R 是${t2(triText, 1)}，y 是内层变量（先对 y 积分，再对 x 积分）。哪个步骤能得到积分限？`),
        figure: triFigure,
        options: [
          t('Hold x fixed and let y increase: the point traces a vertical line. The inner limits are the y-values where this line enters and leaves R; the outer limits run over all x for which the line meets R.', '固定 x，让 y 增大：该点画出一条竖线。内层积分限是这条线进入和离开 R 处的 y 值；外层积分限取遍所有使竖线与 R 相交的 x。'),
          t('Hold y fixed and let x increase: the point traces a horizontal line. The inner limits are the x-values where this line enters and leaves R; the outer limits run over all y for which the line meets R.', '固定 y，让 x 增大：该点画出一条水平线。内层积分限是这条线进入和离开 R 处的 x 值；外层积分限取遍所有使水平线与 R 相交的 y。'),
          t('Use the smallest and largest x and the smallest and largest y of R as constant limits for both integrals.', '用 R 中 x 的最小、最大值和 y 的最小、最大值作为两个积分的常数积分限。'),
        ], correct: 0,
        hint: t('The inner integral runs along the variable that is integrated first (here y). What does the path look like when only y moves?', '内层积分沿先积分的变量（这里是 y）进行。只有 y 变化时，路径是什么样的？'),
        explanation: t(`With dy first, the inner integral runs in the y-direction, so we hold x fixed and follow a vertical line through R. For this triangle the vertical line enters on the x-axis (y = 0) and leaves on the line y = ${lineText}; x runs from 0 to ${tri.a}. The horizontal-line procedure belongs to dx dy, and constant limits only work for a rectangle, not for this triangle.`,
          `先对 y 积分时，内层积分沿 y 方向进行，所以固定 x，沿穿过 R 的竖线走。对这个三角形，竖线从 x 轴（y = 0）进入，从直线 y = ${lineText} 离开；x 从 0 到 ${tri.a}。水平线的步骤属于 dx dy 的次序，而常数积分限只适用于矩形，不适用于这个三角形。`),
      }),
      g.symbols({
        id: 'triangle-limits', title: t('Limits for the triangle', '三角形的积分限'),
        prompt: t(`R is ${t2(triText, 0)}. Write the limits of ∬_R f dy dx: y is the inner variable (dy), x the outer variable (dx). Fill the four blanks in the order: inner lower, inner upper, outer lower, outer upper.`,
          `R 是${t2(triText, 1)}。写出 ∬_R f dy dx 的积分限：y 是内层变量（dy），x 是外层变量（dx）。按顺序填四个空：内层下限、内层上限、外层下限、外层上限。`),
        figure: triFigure,
        before: '', between: [' ≤ y ≤ ', ',  ', ' ≤ x ≤ '], answers: ['0', lineText, '0', `${tri.a}`], tokens: triTokens,
        hint: t('Follow the dashed vertical line: where does it enter R, where does it leave? Then ask which x give such a line.', '沿着虚线竖线走：它从哪里进入 R，从哪里离开？再问哪些 x 对应这样的竖线。'),
        explanation: t(`A vertical line at x enters R on the x-axis, y = 0, and leaves on the line y = ${lineText}. Such lines meet R for x from 0 to ${tri.a} (where the line y = ${lineText} reaches the x-axis). So 0 ≤ y ≤ ${lineText}, 0 ≤ x ≤ ${tri.a}.`,
          `x 处的竖线从 x 轴（y = 0）进入 R，从直线 y = ${lineText} 离开。这样的竖线在 x 从 0 到 ${tri.a}（直线 y = ${lineText} 到达 x 轴处）时与 R 相交。所以 0 ≤ y ≤ ${lineText}，0 ≤ x ≤ ${tri.a}。`),
      }),
      g.number({
        id: 'triangle-integral', title: t('Evaluate over the triangle', '在三角形上求值'),
        prompt: t(`Evaluate ∬_R (${fPQ}) dA, where R is ${t2(triText, 0)}. Use dy dx: inner y from 0 to ${lineText}, outer x from 0 to ${tri.a}. Enter an integer, fraction or decimal.`,
          `计算 ∬_R (${fPQ}) dA，其中 R 是${t2(triText, 1)}。用 dy dx：内层 y 从 0 到 ${lineText}，外层 x 从 0 到 ${tri.a}。输入整数、分数或小数。`),
        figure: triFigure,
        fields: [{ label: t('∬_R f dA', '∬_R f dA'), answer: triInt }],
        hint: t('Do the inner integral in y with x held constant, then integrate the result in x.', '先在 x 固定时对 y 积分，再对所得结果对 x 积分。'),
        explanation: t(`Inner: ∫₀^(${lineText}) (${fPQ}) dy = ${coef(pq.p, 'x')}(${lineText}) + ${par(pq.q)}(${lineText})²/2. Outer: ∫₀^${tri.a} x(${lineText}) dx = ${frac(tri.k * tri.a ** 3, 6)} and ∫₀^${tri.a} (${lineText})²/2 dx = ${tri.c}³/(6·${tri.k}) = ${frac(tri.c ** 3, 6 * tri.k)}. So the integral is ${par(pq.p)}·${frac(tri.k * tri.a ** 3, 6)} + ${par(pq.q)}·${frac(tri.c ** 3, 6 * tri.k)} = ${frac(tri.a * tri.c * (pq.p * tri.a + pq.q * tri.c), 6)}.`,
          `内层：∫₀^(${lineText}) (${fPQ}) dy = ${coef(pq.p, 'x')}(${lineText}) + ${par(pq.q)}(${lineText})²/2。外层：∫₀^${tri.a} x(${lineText}) dx = ${frac(tri.k * tri.a ** 3, 6)}，∫₀^${tri.a} (${lineText})²/2 dx = ${tri.c}³/(6·${tri.k}) = ${frac(tri.c ** 3, 6 * tri.k)}。所以积分为 ${par(pq.p)}·${frac(tri.k * tri.a ** 3, 6)} + ${par(pq.q)}·${frac(tri.c ** 3, 6 * tri.k)} = ${frac(tri.a * tri.c * (pq.p * tri.a + pq.q * tri.c), 6)}。`),
        audit: { kind: 'MIT-MV-33:triangle-integral', params: { a: tri.a, c: tri.c, p: pq.p, q: pq.q } },
      }),
      g.choice({
        id: 'curved-limits', title: t('Lower and upper boundary', '下边界与上边界'),
        prompt: t(`R is bounded by the parabola y = x², the line y = x + ${cs} and the vertical lines x = 0 and x = 1 (see the figure). For ∬_R f dy dx, hold x fixed and let y increase. Which limits are correct?`,
          `R 由抛物线 y = x²、直线 y = x + ${cs} 以及竖直线 x = 0 和 x = 1 围成（见图）。对 ∬_R f dy dx，固定 x、让 y 增大。哪组积分限正确？`),
        figure: curvedFigure,
        options: [
          t(`Inner: y from x² to x + ${cs}. Outer: x from 0 to 1.`, `内层：y 从 x² 到 x + ${cs}。外层：x 从 0 到 1。`),
          t(`Inner: y from x + ${cs} to x². Outer: x from 0 to 1.`, `内层：y 从 x + ${cs} 到 x²。外层：x 从 0 到 1。`),
          t(`Inner: y from 0 to x + ${cs}. Outer: x from 0 to 1.`, `内层：y 从 0 到 x + ${cs}。外层：x 从 0 到 1。`),
        ], correct: 0,
        hint: t('On the dashed vertical line, which curve is met first when y increases from below?', '在虚线竖线上，y 从下往上增大时先遇到哪条曲线？'),
        explanation: t(`Going up a vertical line at x, we enter R on the parabola y = x² (for example at x = 0.5 the parabola is at 0.25, the line at ${num(0.5 + cs)}) and leave on the line y = x + ${cs}. The limits "from x + ${cs} to x²" run downward and give the negative of the right integral. "From 0 to x + ${cs}" starts below the parabola, so it also integrates over points that are not in R.`,
          `沿 x 处的竖线向上走，先在抛物线 y = x² 上进入 R（例如 x = 0.5 时抛物线在 0.25，直线在 ${num(0.5 + cs)}），再从直线 y = x + ${cs} 离开。「从 x + ${cs} 到 x²」是向下积分，得到的是正确积分的相反数。「从 0 到 x + ${cs}」从抛物线下方开始，把不在 R 中的点也积分了进去。`),
      }),
      g.number({
        id: 'curved-area', title: t('Area of the curved region', '曲边区域的面积'),
        prompt: t(`Find the area of R (the region of the previous figure, between y = x² and y = x + ${cs} for 0 ≤ x ≤ 1) as the double integral ∬_R dA with dy dx: inner y from x² to x + ${cs}, outer x from 0 to 1. Enter a fraction or decimal.`,
          `把 R（上图的区域：0 ≤ x ≤ 1 时 y = x² 与 y = x + ${cs} 之间的部分）的面积写成二重积分 ∬_R dA 并求值，用 dy dx：内层 y 从 x² 到 x + ${cs}，外层 x 从 0 到 1。输入分数或小数。`),
        figure: curvedFigure,
        fields: [{ label: t('Area', '面积'), answer: curvedArea }],
        hint: t('The inner integral of 1 dy is the height of the vertical segment: upper minus lower.', '1 对 y 的内层积分就是竖直线段的长度：上限减下限。'),
        explanation: t(`Inner: ∫ from x² to x + ${cs} of dy = x + ${cs} − x². Outer: ∫₀¹ (x + ${cs} − x²) dx = 1/2 + ${cs} − 1/3 = ${frac(6 * cs + 1, 6)}.`,
          `内层：∫ 从 x² 到 x + ${cs} 的 dy = x + ${cs} − x²。外层：∫₀¹ (x + ${cs} − x²) dx = 1/2 + ${cs} − 1/3 = ${frac(6 * cs + 1, 6)}。`),
        audit: { kind: 'MIT-MV-33:curved-area', params: { s: cs } },
      }),
      g.number({
        id: 'curved-mass', title: t('Mass of the curved region', '曲边区域的质量'),
        prompt: t(`The same region R (between y = x² and y = x + ${cs}, 0 ≤ x ≤ 1) has density δ(x, y) = ${coef(cp, 'x')}. Find its mass M = ∬_R δ dA using dy dx. Enter a fraction or decimal.`,
          `同一个区域 R（0 ≤ x ≤ 1 时 y = x² 与 y = x + ${cs} 之间）的密度为 δ(x, y) = ${coef(cp, 'x')}。用 dy dx 求它的质量 M = ∬_R δ dA。输入分数或小数。`),
        fields: [{ label: t('M', 'M'), answer: curvedMass }],
        hint: t('The density does not depend on y, so the inner integral is density × height of the segment.', '密度不依赖于 y，所以内层积分是密度乘以线段长度。'),
        explanation: t(`Inner: ∫ from x² to x + ${cs} of ${coef(cp, 'x')} dy = ${coef(cp, 'x')}(x + ${cs} − x²). Outer: ${cp === 1 ? '' : `${cp}·`}∫₀¹ (x² + ${coef(cs, 'x')} − x³) dx = ${cp === 1 ? '' : `${cp}·`}(1/3 + ${frac(cs, 2)} − 1/4) = ${cp === 1 ? '' : `${cp}·${frac(1 + 6 * cs, 12)} = `}${frac(cp * (1 + 6 * cs), 12)}.`,
          `内层：∫ 从 x² 到 x + ${cs} 的 ${coef(cp, 'x')} dy = ${coef(cp, 'x')}(x + ${cs} − x²)。外层：${cp === 1 ? '' : `${cp}·`}∫₀¹ (x² + ${coef(cs, 'x')} − x³) dx = ${cp === 1 ? '' : `${cp}·`}(1/3 + ${frac(cs, 2)} − 1/4) = ${cp === 1 ? '' : `${cp}·${frac(1 + 6 * cs, 12)} = `}${frac(cp * (1 + 6 * cs), 12)}。`),
        audit: { kind: 'MIT-MV-33:curved-mass', params: { s: cs, p: cp } },
      }),
      g.number({
        id: 'tetrahedron', title: t('Volume of a tetrahedron', '四面体的体积'),
        prompt: t(`A tetrahedron is bounded by the three coordinate planes and the plane z = ${tetraPlane}; the plane meets the axes at x = ${tt.a}, y = ${tt.b} and z = ${tt.h}. Its volume is V = ∬_R (${tetraPlane}) dA, where R is the triangle in the xy-plane with vertices (0, 0), (${tt.a}, 0) and (0, ${tt.b}) (see the figure). Find V. Enter a fraction or decimal.`,
          `一个四面体由三个坐标平面和平面 z = ${tetraPlane} 围成；该平面与坐标轴交于 x = ${tt.a}、y = ${tt.b}、z = ${tt.h}。它的体积是 V = ∬_R (${tetraPlane}) dA，其中 R 是 xy 平面上顶点为 (0, 0)、(${tt.a}, 0)、(0, ${tt.b}) 的三角形（见图）。求 V。输入分数或小数。`),
        figure: tetraFigure,
        fields: [{ label: t('V', 'V'), answer: tetraV }],
        hint: t('Write the height as h(1 − x/a − y/b), integrate y from 0 to b(1 − x/a), then x from 0 to a.', '把高写成 h(1 − x/a − y/b)，y 从 0 积到 b(1 − x/a)，再对 x 从 0 积到 a。'),
        explanation: t(`With a = ${tt.a}, b = ${tt.b}, h = ${tt.h} the height is h(1 − x/a − y/b). Inner: ∫₀^(b(1 − x/a)) h(1 − x/a − y/b) dy = h·b(1 − x/a)²/2. Outer: ∫₀^a h·b(1 − x/a)²/2 dx = a·b·h/6 = ${tt.a}·${tt.b}·${tt.h}/6 = ${frac(tt.a * tt.b * tt.h, 6)}.`,
          `取 a = ${tt.a}，b = ${tt.b}，h = ${tt.h}，高为 h(1 − x/a − y/b)。内层：∫₀^(b(1 − x/a)) h(1 − x/a − y/b) dy = h·b(1 − x/a)²/2。外层：∫₀^a h·b(1 − x/a)²/2 dx = a·b·h/6 = ${tt.a}·${tt.b}·${tt.h}/6 = ${frac(tt.a * tt.b * tt.h, 6)}。`),
        audit: { kind: 'MIT-MV-33:tetrahedron', params: { h: tt.h, p: tt.p, q: tt.q } },
      }),
      g.choice({
        id: 'bad-limits', title: t('Which iterated integral makes sense?', '哪个累次积分有意义？'),
        prompt: t(`R is ${t2(triText, 0)}. Which of these iterated integrals for ∬_R f dA (order dy dx, inner variable y) is a correct description of R?`,
          `R 是${t2(triText, 1)}。下面哪个 ∬_R f dA 的累次积分（次序 dy dx，内层变量 y）正确描述了 R？`),
        options: [
          t(`Outer: x from 0 to ${tri.a}. Inner: y from 0 to ${lineText}.`, `外层：x 从 0 到 ${tri.a}。内层：y 从 0 到 ${lineText}。`),
          t(`Outer: y from 0 to ${lineText}. Inner: x from 0 to ${tri.a}.`, `外层：y 从 0 到 ${lineText}。内层：x 从 0 到 ${tri.a}。`),
          t(`Outer: x from 0 to ${tri.a}. Inner: y from 0 to ${tri.c}.`, `外层：x 从 0 到 ${tri.a}。内层：y 从 0 到 ${tri.c}。`),
        ], correct: 0,
        hint: t('Outer limits must be numbers (nothing is fixed yet). Inner limits may use the outer variable. And the limits must describe R, not a bigger region.', '外层积分限必须是数（此时还没有固定任何变量）；内层积分限可以含外层变量；并且积分限必须恰好描述 R，而不是更大的区域。'),
        explanation: t(`The option with outer variable y has the limit ${lineText}, which contains x, on its outer integral, although x is only integrated later: that makes no sense. The option "y from 0 to ${tri.c}" has legal constant limits, but they describe the whole rectangle 0 ≤ x ≤ ${tri.a}, 0 ≤ y ≤ ${tri.c}, which is bigger than the triangle. Only "x from 0 to ${tri.a}, y from 0 to ${lineText}" describes R.`,
          `外层变量是 y 的那个选项，其外层积分限 ${lineText} 含有 x，而 x 要到后面才积分，这没有意义。「y 从 0 到 ${tri.c}」那个选项的常数积分限合法，但它描述的是整个矩形 0 ≤ x ≤ ${tri.a}，0 ≤ y ≤ ${tri.c}，比三角形大。只有「x 从 0 到 ${tri.a}，y 从 0 到 ${lineText}」恰好描述 R。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`R is the triangle bounded by the x-axis, the vertical line x = ${ch.b} and the line y = ${coef(ch.m, 'x')}. Evaluate ∬_R (${linear([ch.p, ch.q], ['x', 'y'])}) dA, integrating first in y (dy dx). Enter a fraction or decimal.`,
          `R 是由 x 轴、竖直线 x = ${ch.b} 和直线 y = ${coef(ch.m, 'x')} 围成的三角形。计算 ∬_R (${linear([ch.p, ch.q], ['x', 'y'])}) dA，先对 y 积分（dy dx）。输入分数或小数。`),
        fields: [{ label: t('∬_R f dA', '∬_R f dA'), answer: chAns }],
        hint: t('Sketch R first, then choose the limits.', '先画出 R，再确定积分限。'),
        explanation: t(`A vertical line at x enters R on the x-axis (y = 0) and leaves on the line y = ${coef(ch.m, 'x')}; x runs from 0 to ${ch.b}. Inner: ∫₀^(${coef(ch.m, 'x')}) (${linear([ch.p, ch.q], ['x', 'y'])}) dy = ${kap('x²')}. Outer: ∫₀^${ch.b} ${kap('x²')} dx = ${kap('')}·${ch.b}³/3 = ${frac(2 * ch.p * ch.m * ch.b ** 3 + ch.q * ch.m * ch.m * ch.b ** 3, 6)}. This game checks setting up and evaluating limits in rectangular coordinates; it does not assess other coordinate systems.`,
          `x 处的竖线从 x 轴（y = 0）进入 R，从直线 y = ${coef(ch.m, 'x')} 离开；x 从 0 到 ${ch.b}。内层：∫₀^(${coef(ch.m, 'x')}) (${linear([ch.p, ch.q], ['x', 'y'])}) dy = ${kap('x²')}。外层：∫₀^${ch.b} ${kap('x²')} dx = ${kap('')}·${ch.b}³/3 = ${frac(2 * ch.p * ch.m * ch.b ** 3 + ch.q * ch.m * ch.m * ch.b ** 3, 6)}。本游戏检查直角坐标下积分限的建立与计算，不涉及其他坐标系。`),
        audit: { kind: 'MIT-MV-33:challenge', params: { m: ch.m, b: ch.b, p: ch.p, q: ch.q } },
      }),
    ];
  },

  // ================================================================================================
  // MIT-MV-34 Exchanging the Order of Integration (session 49)
  // ================================================================================================
  'MIT-MV-34': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-34');
    warm(g);
    const aFor = (form: Form) => form === 'parabola' ? g.pick([4, 9]) : form === 'wedge' ? g.random(1, 3) : g.random(2, 4);

    // Card 1 shows four pictures of the same size; the other cards use different regions.
    const PICS: Form[] = ['upper', 'lower', 'under', 'parabola'];
    const a1 = g.pick([4, 9]);
    const f1 = g.pick(PICS);
    const picRegs = PICS.map(f => makeRegion(f, a1));
    const r1 = picRegs[PICS.indexOf(f1)];
    const rest = shuffled(g, FORMS.filter(f => f !== f1));
    const f2 = rest[0], f3 = rest[1];
    const m2 = g.random(2, 3), m3 = g.random(2, 3);
    const r2 = makeRegion(f2, aFor(f2), m2), r3 = makeRegion(f3, aFor(f3), m3);
    const view1 = { xmin: -0.12 * a1, xmax: 1.12 * a1, ymin: -0.12 * a1, ymax: 1.12 * a1 };
    const regFigure = (r: Reg, caption: Text) => g.figure({
      alt: t(`The region R: ${t2(r.words, 0)}.`, `区域 R：${t2(r.words, 1)}。`),
      view: fitView(regShapes(r), 0.2), axes: AXES, shapes: regShapes(r), caption,
    });
    const letters = ['A', 'B', 'C', 'D'];
    const picFigures = picRegs.map((r, i) => g.figure({
      alt: t(`Picture ${letters[i]}: ${t2(r.words, 0)}.`, `图 ${letters[i]}：${t2(r.words, 1)}。`),
      view: view1, axes: AXES, shapes: regShapes(r),
    }));

    const baseTokens = (r: Reg, forward: boolean) => {
      const a = r.a;
      const common = ['0', `${a}`, 'x', 'y', `${a} − x`, `${a} − y`];
      const extra = r.form === 'parabola' ? [forward ? '√y' : '√x', 'x²', 'y²', `${Math.round(Math.sqrt(a))}`]
        : r.form === 'wedge' ? [`y/${r.m}`, `${r.m}y`, `${r.m}x`, `x/${r.m}`, `${r.m * a}`] : ['√y', 'x²'];
      return shuffled(g, uniq([...common, ...extra]));
    };
    const swapTokens = baseTokens(r2, true), backTokens = baseTokens(r3, false);

    // Card 4: why exchange
    const gaussCase = g.random(0, 1);
    const wc = gaussCase === 0 ? { c: 'π/2', f: 'sin y / y', yf: 'sin y' } : { c: `${g.random(2, 3)}`, f: 'e^{−y²}', yf: 'y e^{−y²}' };

    // Card 5: polynomial after exchanging (linear limits only)
    const f5 = g.pick<Form>(['upper', 'lower', 'under', 'wedge']);
    const r5 = makeRegion(f5, f5 === 'wedge' ? g.random(1, 2) : g.random(2, 3), g.random(2, 3));
    const pq = retry(() => ({ p: g.nonzero(-3, 3), q: g.nonzero(-3, 3) }), v => v.p * r5.moments6![0] + v.q * r5.moments6![1] !== 0);
    const ans5 = (pq.p * r5.moments6![0] + pq.q * r5.moments6![1]) / 6;

    // Card 6: Gaussian
    const gs = { a: g.random(2, 4), m: g.random(1, 4) };

    // Card 7: constant limits
    const cl = { a: g.random(2, 5), b: g.random(2, 5) };

    // Challenge: sin x / x
    const [cn, cd] = g.pick<[number, number]>([[1, 3], [1, 2], [2, 3], [1, 1]]);
    const ck = g.random(1, 3);
    const cText = cd === 1 ? 'π' : cn === 1 ? `π/${cd}` : `${cn}π/${cd}`;
    const chAns = Math.round(ck * (1 - Math.cos(cn * Math.PI / cd)) * 1e9) / 1e9;
    const skn = ck === 1 ? 'sin x' : `${ck} sin x`;

    const regionName = (r: Reg) => r.words;
    return [
      g.choice({
        id: 'read-region', title: t('Read the region from the limits', '由积分限读出区域'),
        prompt: t(`The integral ∬_R f dy dx has the limits  ${dydx(r1)}  (inner variable y, outer variable x). Which picture shows the region R?`,
          `二重积分 ∬_R f dy dx 的积分限为  ${dydx(r1)}（内层变量 y，外层变量 x）。哪幅图表示区域 R？`),
        options: letters.map(L => t(`Picture ${L}`, `图 ${L}`)), optionFigures: picFigures, correct: PICS.indexOf(f1), fixedOrder: true,
        hint: t('Take one value of x and ask which y-values lie in R above it.', '取定一个 x，问它上方哪些 y 值属于 R。'),
        explanation: t(`For each x the inner variable y runs ${r1.y[0]} ≤ y ≤ ${r1.y[1]}, and x runs ${r1.xr[0]} ≤ x ≤ ${r1.xr[1]}. That is ${t2(regionName(r1), 0)}. The other pictures show the three other regions that can be described with the same numbers but different boundaries.`,
          `对每个 x，内层变量 y 满足 ${r1.y[0]} ≤ y ≤ ${r1.y[1]}，x 满足 ${r1.xr[0]} ≤ x ≤ ${r1.xr[1]}。这就是${t2(regionName(r1), 1)}。其余图形表示用相同数字但边界不同的另外三个区域。`),
      }),
      g.symbols({
        id: 'swap-limits', title: t('Exchange dy dx into dx dy', '把 dy dx 换成 dx dy'),
        prompt: t(`R is ${t2(r2.words, 0)}. In the order dy dx its limits are  ${dydx(r2)}. Exchange the order: now x is the inner variable (dx) and y the outer variable (dy). Fill the four blanks in the order: inner lower, inner upper, outer lower, outer upper.`,
          `R 是${t2(r2.words, 1)}。按 dy dx 的次序，积分限为  ${dydx(r2)}。交换次序：现在 x 是内层变量（dx），y 是外层变量（dy）。按顺序填四个空：内层下限、内层上限、外层下限、外层上限。`),
        figure: regFigure(r2, t('Region R', '区域 R')),
        before: '', between: [' ≤ x ≤ ', ',  ', ' ≤ y ≤ '], answers: [r2.x[0], r2.x[1], r2.yr[0], r2.yr[1]], tokens: swapTokens,
        hint: t('Take a horizontal line at height y: where does it enter R and where does it leave? Then ask which y give such lines.', '取高度为 y 的水平线：它从哪里进入 R，从哪里离开？再问哪些 y 对应这样的水平线。'),
        explanation: t(`A horizontal line at height y enters R at x = ${r2.x[0]} and leaves at x = ${r2.x[1]}, and such lines meet R for y from ${r2.yr[0]} to ${r2.yr[1]}. So ${dxdy(r2)}. The limits must be re-derived from the region; the old pairs of limits cannot just be swapped.`,
          `高度为 y 的水平线在 x = ${r2.x[0]} 处进入 R，在 x = ${r2.x[1]} 处离开，并且 y 从 ${r2.yr[0]} 到 ${r2.yr[1]} 时这样的水平线与 R 相交。所以 ${dxdy(r2)}。积分限必须根据区域重新确定，不能把原来的几组积分限直接对调。`),
      }),
      g.symbols({
        id: 'swap-back', title: t('Exchange dx dy into dy dx', '把 dx dy 换成 dy dx'),
        prompt: t(`R is ${t2(r3.words, 0)}. In the order dx dy its limits are  ${dxdy(r3)}. Exchange the order: now y is the inner variable (dy) and x the outer variable (dx). Fill the four blanks in the order: inner lower, inner upper, outer lower, outer upper.`,
          `R 是${t2(r3.words, 1)}。按 dx dy 的次序，积分限为  ${dxdy(r3)}。交换次序：现在 y 是内层变量（dy），x 是外层变量（dx）。按顺序填四个空：内层下限、内层上限、外层下限、外层上限。`),
        figure: regFigure(r3, t('Region R', '区域 R')),
        before: '', between: [' ≤ y ≤ ', ',  ', ' ≤ x ≤ '], answers: [r3.y[0], r3.y[1], r3.xr[0], r3.xr[1]], tokens: backTokens,
        hint: t('Take a vertical line at position x: where does it enter R and where does it leave?', '取位置为 x 的竖线：它从哪里进入 R，从哪里离开？'),
        explanation: t(`A vertical line at x enters R at y = ${r3.y[0]} and leaves at y = ${r3.y[1]}, and such lines meet R for x from ${r3.xr[0]} to ${r3.xr[1]}. So ${dydx(r3)}.`,
          `位置为 x 的竖线在 y = ${r3.y[0]} 处进入 R，在 y = ${r3.y[1]} 处离开，并且 x 从 ${r3.xr[0]} 到 ${r3.xr[1]} 时这样的竖线与 R 相交。所以 ${dydx(r3)}。`),
      }),
      g.choice({
        id: 'why-exchange', title: t('Why exchange the order?', '为什么要交换次序？'),
        prompt: t(`I = ∬_R ${wc.f} dA with R: 0 ≤ x ≤ ${wc.c}, x ≤ y ≤ ${wc.c} (inner variable y, order dy dx). The function ${wc.f} has no antiderivative in y that is given by a simple formula. What should you do?`,
          `I = ∬_R ${wc.f} dA，R：0 ≤ x ≤ ${wc.c}，x ≤ y ≤ ${wc.c}（内层变量 y，次序 dy dx）。函数 ${wc.f} 关于 y 没有可用简单公式表示的原函数。该怎么办？`),
        options: [
          t(`Exchange the order: R becomes 0 ≤ y ≤ ${wc.c}, 0 ≤ x ≤ y, and the inner x-integral of ${wc.f} is ${wc.yf}, easy in y.`, `交换次序：R 变为 0 ≤ y ≤ ${wc.c}，0 ≤ x ≤ y，${wc.f} 对 x 的内层积分是 ${wc.yf}，对 y 容易积分。`),
          t(`Keep the order: find the inner antiderivative of ${wc.f} in y with the usual rules (substitution, parts), then integrate in x.`, `保持次序：用常规方法（换元、分部）求出 ${wc.f} 关于 y 的内层原函数，再对 x 积分。`),
          t('Neither order works: with no simple antiderivative in y the integral cannot be evaluated by any method.', '两种次序都不行：y 方向没有简单的原函数，用任何方法都无法求出这个积分。'),
        ], correct: 0,
        hint: t('Is there an order in which the inner integral is easy? Sketch R and look at horizontal lines.', '有没有一种次序使内层积分很容易？画出 R，看看水平线。'),
        explanation: t(`In the order dx dy the integrand ${wc.f} does not depend on x, so the inner integral over 0 ≤ x ≤ y is just y·(${wc.f}) = ${wc.yf}. Then the outer integral over 0 ≤ y ≤ ${wc.c} is easy. The region is the same triangle in both orders; only the way of slicing changes. Keeping the original order would require an antiderivative that does not exist in simple form, and the claim that nothing works is false, because the exchanged integral can be done.`,
          `按 dx dy 的次序，被积函数 ${wc.f} 不依赖于 x，所以对 0 ≤ x ≤ y 的内层积分就是 y·(${wc.f}) = ${wc.yf}。然后对 0 ≤ y ≤ ${wc.c} 的外层积分就容易了。两种次序下区域是同一个三角形，只是切片方式不同。保持原来的次序则需要一个不存在简单形式的原函数；而「什么都不行」的说法是错的，因为交换次序后的积分可以算出来。`),
      }),
      g.number({
        id: 'poly-exchange', title: t('Evaluate after exchanging', '交换次序后求值'),
        prompt: t(`Let R be the region with limits  ${dydx(r5)}  (order dy dx), and I = ∬_R (${linear([pq.p, pq.q], ['x', 'y'])}) dA. Exchange the order, so that x is the inner variable (dx) and y the outer variable (dy), and evaluate I. Enter a fraction or decimal.`,
          `设 R 的积分限为  ${dydx(r5)}（次序 dy dx），I = ∬_R (${linear([pq.p, pq.q], ['x', 'y'])}) dA。交换次序，使 x 为内层变量（dx）、y 为外层变量（dy），并求 I。输入分数或小数。`),
        figure: regFigure(r5, t('Region R', '区域 R')),
        fields: [{ label: t('I', 'I'), answer: ans5 }],
        hint: t('Write R in the new order first, then integrate x, then y.', '先把 R 写成新次序下的积分限，再先对 x 积分、后对 y 积分。'),
        explanation: t(`In the new order R is ${dxdy(r5)}. Integrating the pieces over R gives ∬_R x dA = ${frac(r5.moments6![0], 6)} and ∬_R y dA = ${frac(r5.moments6![1], 6)}, so I = ${par(pq.p)}·${frac(r5.moments6![0], 6)} + ${par(pq.q)}·${frac(r5.moments6![1], 6)} = ${frac(pq.p * r5.moments6![0] + pq.q * r5.moments6![1], 6)}. The other order gives the same value.`,
          `在新次序下 R 为 ${dxdy(r5)}。分别对 R 积分得 ∬_R x dA = ${frac(r5.moments6![0], 6)}，∬_R y dA = ${frac(r5.moments6![1], 6)}，所以 I = ${par(pq.p)}·${frac(r5.moments6![0], 6)} + ${par(pq.q)}·${frac(r5.moments6![1], 6)} = ${frac(pq.p * r5.moments6![0] + pq.q * r5.moments6![1], 6)}。用原来的次序得到同样的值。`),
        audit: { kind: 'MIT-MV-34:poly-exchange', params: { a: r5.a, lo0: r5.lin!.lo0, lo1: r5.lin!.lo1, hi0: r5.lin!.hi0, hi1: r5.lin!.hi1, p: pq.p, q: pq.q } },
      }),
      g.number({
        id: 'gaussian', title: t('The integral of e^(−y²)', 'e^(−y²) 的积分'),
        prompt: t(`I = ∬_R ${coef(gs.m, 'e^{−y²}')} dA with R: 0 ≤ x ≤ ${gs.a}, x ≤ y ≤ ${gs.a} (inner variable y, order dy dx). After exchanging the order, I can be written as I = k(1 − e^{−${gs.a * gs.a}}). Find k. Enter a fraction or decimal.`,
          `I = ∬_R ${coef(gs.m, 'e^{−y²}')} dA，R：0 ≤ x ≤ ${gs.a}，x ≤ y ≤ ${gs.a}（内层变量 y，次序 dy dx）。交换次序后，I 可以写成 I = k(1 − e^{−${gs.a * gs.a}})。求 k。输入分数或小数。`),
        fields: [{ label: t('k', 'k'), answer: gs.m / 2 }],
        hint: t('Exchange the order: R becomes 0 ≤ y ≤ the upper limit, 0 ≤ x ≤ y. Integrate in x first.', '交换次序：R 变为 0 ≤ y ≤ 上限，0 ≤ x ≤ y。先对 x 积分。'),
        explanation: t(`After exchanging, R is 0 ≤ y ≤ ${gs.a}, 0 ≤ x ≤ y. Inner: ∫₀^y ${coef(gs.m, 'e^{−y²}')} dx = ${coef(gs.m, 'y e^{−y²}')}. Outer: ∫₀^${gs.a} ${coef(gs.m, 'y e^{−y²}')} dy = ${gs.m === 1 ? '' : `${gs.m}·`}[−e^{−y²}/2]₀^${gs.a} = ${kfac(gs.m, 2)}(1 − e^{−${gs.a * gs.a}}). So k = ${frac(gs.m, 2)}.`,
          `交换次序后，R 为 0 ≤ y ≤ ${gs.a}，0 ≤ x ≤ y。内层：∫₀^y ${coef(gs.m, 'e^{−y²}')} dx = ${coef(gs.m, 'y e^{−y²}')}。外层：∫₀^${gs.a} ${coef(gs.m, 'y e^{−y²}')} dy = ${gs.m === 1 ? '' : `${gs.m}·`}[−e^{−y²}/2]₀^${gs.a} = ${kfac(gs.m, 2)}(1 − e^{−${gs.a * gs.a}})。所以 k = ${frac(gs.m, 2)}。`),
        audit: { kind: 'MIT-MV-34:gaussian', params: { a: gs.a, m: gs.m } },
      }),
      g.choice({
        id: 'constant-limits', title: t('When can you just swap the limits?', '什么时候可以直接对调积分限？'),
        prompt: t('For which of these regions (described in the order dy dx) can you exchange the order simply by swapping the two pairs of limits, with the inner variable still between the same numbers?', '下面哪个区域（按 dy dx 的次序描述）只要对调两组积分限就能交换次序，即内层变量仍在同样的两个数之间？'),
        options: [
          t(`0 ≤ y ≤ ${cl.b},  0 ≤ x ≤ ${cl.a}`, `0 ≤ y ≤ ${cl.b},  0 ≤ x ≤ ${cl.a}`),
          t(`0 ≤ y ≤ x,  0 ≤ x ≤ ${cl.a}`, `0 ≤ y ≤ x,  0 ≤ x ≤ ${cl.a}`),
          t(`0 ≤ y ≤ ${cl.a} − x,  0 ≤ x ≤ ${cl.a}`, `0 ≤ y ≤ ${cl.a} − x,  0 ≤ x ≤ ${cl.a}`),
        ], correct: 0,
        hint: t('Swapping the pairs only works if no limit contains the other variable.', '只有当任何积分限都不含另一个变量时，直接对调才行。'),
        explanation: t(`The region 0 ≤ y ≤ ${cl.b}, 0 ≤ x ≤ ${cl.a} is the rectangle: all four limits are constants, so the order dx dy simply has 0 ≤ x ≤ ${cl.a} inside and 0 ≤ y ≤ ${cl.b} outside. The other two regions are triangles whose inner limit contains x; exchanging them needs new limits (for 0 ≤ y ≤ x it becomes y ≤ x ≤ ${cl.a}, and for 0 ≤ y ≤ ${cl.a} − x it becomes 0 ≤ x ≤ ${cl.a} − y).`,
          `区域 0 ≤ y ≤ ${cl.b}，0 ≤ x ≤ ${cl.a} 是矩形：四个积分限都是常数，所以 dx dy 的次序就是内层 0 ≤ x ≤ ${cl.a}、外层 0 ≤ y ≤ ${cl.b}。另外两个区域是三角形，内层积分限含 x；交换次序需要新的积分限（0 ≤ y ≤ x 变成 y ≤ x ≤ ${cl.a}，0 ≤ y ≤ ${cl.a} − x 变成 0 ≤ x ≤ ${cl.a} − y）。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Evaluate I = ∬_R ${coef(ck, '(sin x)/x')} dA over R: 0 ≤ y ≤ ${cText}, y ≤ x ≤ ${cText} (inner variable x, order dx dy). Enter a fraction or decimal.`,
          `计算 I = ∬_R ${coef(ck, '(sin x)/x')} dA，R：0 ≤ y ≤ ${cText}，y ≤ x ≤ ${cText}（内层变量 x，次序 dx dy）。输入分数或小数。`),
        fields: [{ label: t('I', 'I'), answer: chAns }],
        hint: t('Sketch R and exchange the order.', '画出 R 并交换次序。'),
        explanation: t(`R is the triangle 0 ≤ y ≤ x ≤ ${cText}. Exchanging gives 0 ≤ x ≤ ${cText}, 0 ≤ y ≤ x. Inner: ∫₀^x ${coef(ck, '(sin x)/x')} dy = ${skn}. Outer: ∫₀^(${cText}) ${skn} dx = ${ck === 1 ? '' : `${ck}·`}(1 − cos(${cText})) = ${num(chAns)}. This game assesses exchanging limits for double integrals in rectangular coordinates; it does not assess when the exchange is allowed for unbounded regions.`,
          `R 是三角形 0 ≤ y ≤ x ≤ ${cText}。交换次序得 0 ≤ x ≤ ${cText}，0 ≤ y ≤ x。内层：∫₀^x ${coef(ck, '(sin x)/x')} dy = ${skn}。外层：∫₀^(${cText}) ${skn} dx = ${ck === 1 ? '' : `${ck}·`}(1 − cos(${cText})) = ${num(chAns)}。本游戏检查直角坐标下二重积分积分限的交换，不涉及无界区域上何时允许交换。`),
        audit: { kind: 'MIT-MV-34:challenge', params: { n: cn, d: cd, k: ck } },
      }),
    ];
  },

  // ================================================================================================
  // MIT-MV-35 Double Integrals in Polar Coordinates (session 50)
  // ================================================================================================
  'MIT-MV-35': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-35');
    warm(g);
    const polar = (r: number, th: number): Pt => [r * Math.cos(th), r * Math.sin(th)];
    const arc = (r: number, t0: number, t1: number, n = 24): Pt[] => sampleCurve(th => polar(r, th), t0, t1, n);
    const cosT = (k: number) => (k === 1 ? 'cos θ' : `${k} cos θ`);
    const sinT = (k: number) => (k === 1 ? 'sin θ' : `${k} sin θ`);

    // 1. polar patch
    const patch = { r1: g.random(2, 3), th0: 0.3 + 0.15 * g.random(0, 4) };
    const th1 = patch.th0 + 0.4;
    const patchPoly: Pt[] = [...arc(patch.r1, patch.th0, th1, 10), ...arc(patch.r1 + 1, th1, patch.th0, 10)];
    const patchShapes: FigureShape[] = [
      fill(patchPoly), outline(patchPoly),
      seg([0, 0], polar(patch.r1 + 1.6, patch.th0), 'muted', true), seg([0, 0], polar(patch.r1 + 1.6, th1), 'muted', true),
      { kind: 'text', at: polar(patch.r1 + 1.45, (patch.th0 + th1) / 2), text: 'Δθ', tone: 'text' },
      { kind: 'text', at: polar(patch.r1 + 0.5, th1 + 0.12), text: 'Δr', tone: 'text' },
    ];

    // 2. patch area
    const sm = [0.1, 0.2, 0.5];
    const pa = { r: g.random(2, 9), dr: g.pick(sm), dth: g.pick(sm) };
    const paAns = round2(pa.r * pa.dr * pa.dth);

    // 3. circle equation
    const ca = g.random(1, 4);
    const circleShapes: FigureShape[] = [
      { kind: 'line', points: ellipse(ca, 0, ca, ca, 72), tone: 'accent', width: 2 },
      { kind: 'point', at: [0, 0], tone: 'warn', label: 'O' }, { kind: 'point', at: [ca, 0], tone: 'muted', label: 'C' },
    ];

    // 4. limits for a sampled region
    const lf = g.pick(['sector', 'annulus', 'offset', 'sec', 'cardioid'] as const);
    const sec = { R: g.random(2, 4), d: g.pick([2, 3, 4, 6]) };
    const ann = { b: g.random(1, 2), c: g.random(3, 4) };
    const off = { a: g.random(1, 3) };
    const secR = { c: g.random(2, 3) };
    const car = { a: g.random(1, 3) };
    const cardioidPts = (a: number, sgn = 1): Pt[] => sampleCurve(th => polar(a * (1 + sgn * Math.cos(th)), th), 0, 2 * Math.PI, 72);
    const ringPoly = (b: number, c: number): Pt[] => [...arc(c, 0, 2 * Math.PI, 48), ...arc(b, 2 * Math.PI, 0, 48)];
    const cardioidExpr = (a: number, sgn = 1) => (a === 1 ? `1 ${sgn > 0 ? '+' : '−'} cos θ` : `${a}(1 ${sgn > 0 ? '+' : '−'} cos θ)`);
    type Lim = { words: readonly [string, string]; answers: string[]; extra: string[]; poly: Pt[]; why: readonly [string, string]; extraShapes?: FigureShape[] };
    const LIM: Record<typeof lf, Lim> = {
      sector: {
        words: t(`the sector of the disk x² + y² ≤ ${sec.R * sec.R} between the positive x-axis and the ray at angle π${sec.d === 1 ? '' : `/${sec.d}`} from it`,
          `圆盘 x² + y² ≤ ${sec.R * sec.R} 中，介于正 x 轴与从它起转过 π/${sec.d} 的射线之间的扇形`),
        answers: ['0', `${sec.R}`, '0', `π/${sec.d}`], extra: [`${sec.R * sec.R}`, 'π/2', '2π', 'π'], poly: [[0, 0], ...arc(sec.R, 0, Math.PI / sec.d, 24)],
        why: t(`Rays from the origin sweep out R for θ from 0 to π/${sec.d}; on each ray r runs from the origin (0) to the arc (${sec.R}).`, `θ 从 0 到 π/${sec.d} 时，从原点出发的射线扫过 R；在每条射线上 r 从原点（0）到圆弧（${sec.R}）。`),
      },
      annulus: {
        words: t(`the ring between the circles r = ${ann.b} and r = ${ann.c}, once around the origin`, `圆 r = ${ann.b} 与圆 r = ${ann.c} 之间、绕原点一整圈的圆环`),
        answers: [`${ann.b}`, `${ann.c}`, '0', '2π'], extra: ['0', `${ann.c * ann.c}`, 'π', 'π/2'], poly: ringPoly(ann.b, ann.c),
        why: t(`A ray at angle θ enters the ring at r = ${ann.b} and leaves at r = ${ann.c}; the rays for θ from 0 to 2π cover the whole ring.`, `角度为 θ 的射线在 r = ${ann.b} 处进入圆环，在 r = ${ann.c} 处离开；θ 从 0 到 2π 的射线盖住整个圆环。`),
      },
      offset: {
        words: t(`the disk inside the circle ${square('x', off.a)} + y² = ${off.a * off.a}`, `圆 ${square('x', off.a)} + y² = ${off.a * off.a} 内部的圆盘`),
        answers: ['0', cosT(2 * off.a), '−π/2', 'π/2'], extra: [sinT(2 * off.a), cosT(off.a), `${2 * off.a}`, 'π', '0'], poly: ellipse(off.a, 0, off.a, off.a, 72),
        why: t(`Multiplying r = ${cosT(2 * off.a)} by r gives r² = ${coef(2 * off.a, 'x')}, which is the circle ${square('x', off.a)} + y² = ${off.a * off.a}. Rays leave the disk on this circle, and only the angles −π/2 ≤ θ ≤ π/2 meet the disk.`,
          `把 r = ${cosT(2 * off.a)} 两边乘 r 得 r² = ${coef(2 * off.a, 'x')}，这就是圆 ${square('x', off.a)} + y² = ${off.a * off.a}。射线在这个圆上离开圆盘，并且只有 −π/2 ≤ θ ≤ π/2 的射线与圆盘相交。`),
      },
      sec: {
        words: t(`the region 1 ≤ x ≤ ${secR.c}, 0 ≤ y ≤ x`, `由 1 ≤ x ≤ ${secR.c}、0 ≤ y ≤ x 确定的区域`),
        answers: ['sec θ', `${secR.c} sec θ`, '0', 'π/4'], extra: ['1', `${secR.c}`, 'cos θ', 'π/2', 'π'], poly: [[1, 0], [secR.c, 0], [secR.c, secR.c], [1, 1]],
        why: t(`The line x = 1 is r cos θ = 1, i.e. r = sec θ, and x = ${secR.c} is r = ${secR.c} sec θ. A ray enters R on the first line and leaves on the second, for θ from 0 (the x-axis) to π/4 (the line y = x).`,
          `直线 x = 1 即 r cos θ = 1，也就是 r = sec θ；x = ${secR.c} 即 r = ${secR.c} sec θ。射线在前一条直线上进入 R，在后一条上离开；θ 从 0（x 轴）到 π/4（直线 y = x）。`),
      },
      cardioid: {
        words: t(`the region inside the cardioid r = ${cardioidExpr(car.a)}`, `心形线 r = ${cardioidExpr(car.a)} 内部的区域`),
        answers: ['0', cardioidExpr(car.a), '0', '2π'], extra: [car.a === 1 ? '1 − cos θ' : `${car.a}(1 − cos θ)`, `${car.a}`, 'π', 'π/2'], poly: cardioidPts(car.a),
        why: t(`Each ray from the origin leaves the region on the curve r = ${cardioidExpr(car.a)}, and all angles from 0 to 2π are needed, because the cardioid goes once around the origin.`,
          `从原点出发的每条射线都在曲线 r = ${cardioidExpr(car.a)} 上离开该区域；心形线绕原点一圈，所以需要 0 到 2π 的所有角度。`),
      },
    };
    const L = LIM[lf];
    const limFigure = g.figure({
      alt: t(`The region R: ${t2(L.words, 0)}.`, `区域 R：${t2(L.words, 1)}。`),
      view: fitView([fill(L.poly), outline(L.poly)], 0.2), axes: AXES, shapes: [fill(L.poly), outline(L.poly)], caption: t('Region R', '区域 R'),
    });

    // 5. sector mass with density xy
    const sm5 = { R: g.random(2, 3), d: g.pick([2, 3, 4, 6]) };
    const SIN2: Record<number, [number, number]> = { 2: [1, 1], 3: [3, 4], 4: [1, 2], 6: [1, 4] };
    const [sn, sd] = SIN2[sm5.d];
    const massAns = sm5.R ** 4 * sn / (8 * sd);
    const sectorShapes: FigureShape[] = [fill([[0, 0], ...arc(sm5.R, 0, Math.PI / sm5.d, 24)]), outline([[0, 0], ...arc(sm5.R, 0, Math.PI / sm5.d, 24)])];

    // 6. ring integral of x² + y²
    const rg = (() => { const b = g.random(1, 3); return { b, c: g.random(b + 1, 4), k: g.random(1, 3) }; })();
    const ringShapes: FigureShape[] = [fill(ringPoly(rg.b, rg.c)), outline(arc(rg.c, 0, 2 * Math.PI, 48)), outline(arc(rg.b, 0, 2 * Math.PI, 48))];
    const ringAns = rg.k * Math.PI * (rg.c ** 4 - rg.b ** 4) / 2;
    const ringInt = rg.k === 1 ? '(x² + y²)' : `${rg.k}(x² + y²)`;

    // 7. cardioid area
    const cd = { a: g.random(1, 4), sgn: g.pick([1, -1]) };
    const cardShapes: FigureShape[] = [fill(cardioidPts(cd.a, cd.sgn)), outline(cardioidPts(cd.a, cd.sgn))];
    const cardAns = 3 * Math.PI * cd.a * cd.a / 2;
    const halfA = cd.a % 2 === 0 ? `${cd.a * cd.a / 2}` : `${cd.a * cd.a}/2`;

    // 8. negative r
    const nr = { R: g.random(2, 5) };

    // 9. challenge
    const chA = g.random(1, 4), chK = g.random(1, 3);
    const chInt = chK === 1 ? '1/√(x² + y²)' : `${chK}/√(x² + y²)`;

    return [
      g.choice({
        id: 'area-element', title: t('The area of a small polar patch', '极坐标小块的面积'),
        prompt: t(`In polar coordinates (r, θ), a small patch of the plane lies between the radii r and r + Δr and between the angles θ and θ + Δθ (Δθ in radians), as in the figure. For small Δr and Δθ, its area ΔA is approximately...`,
          `在极坐标 (r, θ) 下，平面上一小块位于半径 r 与 r + Δr 之间、角度 θ 与 θ + Δθ 之间（Δθ 以弧度计），如图所示。当 Δr 与 Δθ 很小时，它的面积 ΔA 近似为……`),
        figure: g.figure({
          alt: t('A small curved patch between two circular arcs and two rays from the origin, with its radial width Δr and angular width Δθ marked.', '一个由两段圆弧和两条从原点出发的射线围成的小块，标出了径向宽度 Δr 和角宽度 Δθ。'),
          view: fitView(patchShapes, 0.15), axes: AXES, shapes: patchShapes, caption: t('Patch between r and r + Δr', 'r 与 r + Δr 之间的小块'),
        }),
        options: [t('r Δr Δθ', 'r Δr Δθ'), t('Δr Δθ', 'Δr Δθ'), t('r² Δr Δθ', 'r² Δr Δθ'), t('Δr Δθ / r', 'Δr Δθ / r')], correct: 0,
        hint: t('The patch is almost a rectangle. One side is Δr; what is the length of the other side, an arc of angle Δθ at radius r?', '这个小块近似为矩形。一条边是 Δr；另一条边是半径为 r、角为 Δθ 的圆弧，它有多长？'),
        explanation: t('The sides are Δr and the arc length r Δθ, so ΔA ≈ (Δr)(r Δθ) = r Δr Δθ, which gives dA = r dr dθ. Without the factor r the area would not grow with the distance from the origin, although the same angle Δθ cuts a longer arc farther out.',
          '两条边分别是 Δr 和弧长 r Δθ，所以 ΔA ≈ (Δr)(r Δθ) = r Δr Δθ，由此得 dA = r dr dθ。如果没有因子 r，面积就不会随着到原点的距离增大，而同样的角 Δθ 在更远处截出的弧更长。'),
      }),
      g.number({
        id: 'patch-area', title: t('Size of a polar patch', '极坐标小块的大小'),
        prompt: t(`A small polar patch is at distance r = ${pa.r} from the origin, with Δr = ${pa.dr} and Δθ = ${pa.dth} (radians). Estimate its area ΔA ≈ r Δr Δθ to 2 decimal places.`,
          `一个极坐标小块到原点的距离为 r = ${pa.r}，Δr = ${pa.dr}，Δθ = ${pa.dth}（弧度）。保留 2 位小数，估计它的面积 ΔA ≈ r Δr Δθ。`),
        fields: [{ label: t('ΔA', 'ΔA'), answer: paAns, tolerance: 0.005 }],
        hint: t('Multiply the three numbers r, Δr and Δθ.', '把 r、Δr、Δθ 这三个数相乘。'),
        explanation: t(`ΔA ≈ ${pa.r}·${pa.dr}·${pa.dth} = ${num(paAns)}. A rectangle Δr × Δθ = ${num(round3(pa.dr * pa.dth))} would be wrong by the factor r = ${pa.r}.`,
          `ΔA ≈ ${pa.r}·${pa.dr}·${pa.dth} = ${num(paAns)}。若把它当作 Δr × Δθ = ${num(round3(pa.dr * pa.dth))} 就差了因子 r = ${pa.r}。`),
        audit: { kind: 'MIT-MV-35:patch-area', params: { r: pa.r, dr: pa.dr, dth: pa.dth } },
      }),
      g.choice({
        id: 'circle-equation', title: t('A circle in polar coordinates', '极坐标下的圆'),
        prompt: t(`The figure shows the circle of radius ${ca} centred at C = (${ca}, 0); it passes through the origin O. Which polar equation r = r(θ) describes it? (x = r cos θ, y = r sin θ.)`,
          `图中是以 C = (${ca}, 0) 为圆心、半径为 ${ca} 的圆，它经过原点 O。哪个极坐标方程 r = r(θ) 描述它？（x = r cos θ，y = r sin θ。）`),
        figure: g.figure({
          alt: t(`The circle of radius ${ca} centred at (${ca}, 0), passing through the origin.`, `以 (${ca}, 0) 为圆心、半径为 ${ca}、经过原点的圆。`),
          view: fitView(circleShapes, 0.2), axes: AXES, shapes: circleShapes, caption: t(`Radius ${ca}, centre (${ca}, 0)`, `半径 ${ca}，圆心 (${ca}, 0)`),
        }),
        options: [t(`r = ${cosT(2 * ca)}`, `r = ${cosT(2 * ca)}`), t(`r = ${sinT(2 * ca)}`, `r = ${sinT(2 * ca)}`), t(`r = ${ca}`, `r = ${ca}`), t(`r = ${cosT(ca)}`, `r = ${cosT(ca)}`)], correct: 0,
        hint: t('Write (x − a)² + y² = a² as x² + y² = 2ax and substitute x = r cos θ.', '把 (x − a)² + y² = a² 写成 x² + y² = 2ax，再代入 x = r cos θ。'),
        explanation: t(`(x − ${ca})² + y² = ${ca * ca} means x² + y² = ${coef(2 * ca, 'x')}, i.e. r² = ${2 * ca} r cos θ, so r = ${cosT(2 * ca)} (for −π/2 ≤ θ ≤ π/2). The equation r = ${sinT(2 * ca)} is the circle centred at (0, ${ca}), r = ${ca} is the circle of radius ${ca} about the origin, and r = ${cosT(ca)} is a circle of radius ${frac(ca, 2)} centred at (${frac(ca, 2)}, 0).`,
          `(x − ${ca})² + y² = ${ca * ca} 即 x² + y² = ${coef(2 * ca, 'x')}，也就是 r² = ${2 * ca} r cos θ，所以 r = ${cosT(2 * ca)}（−π/2 ≤ θ ≤ π/2）。方程 r = ${sinT(2 * ca)} 是圆心在 (0, ${ca}) 的圆，r = ${ca} 是以原点为圆心、半径为 ${ca} 的圆，r = ${cosT(ca)} 是圆心在 (${frac(ca, 2)}, 0)、半径为 ${frac(ca, 2)} 的圆。`),
      }),
      g.symbols({
        id: 'polar-limits', title: t('Limits in polar coordinates', '极坐标下的积分限'),
        prompt: t(`R is ${t2(L.words, 0)}. Write the limits of ∬_R f r dr dθ: r is the inner variable (dr), θ the outer variable (dθ). Fill the four blanks in the order: inner lower, inner upper, outer lower, outer upper.`,
          `R 是${t2(L.words, 1)}。写出 ∬_R f r dr dθ 的积分限：r 是内层变量（dr），θ 是外层变量（dθ）。按顺序填四个空：内层下限、内层上限、外层下限、外层上限。`),
        figure: limFigure,
        before: '', between: [' ≤ r ≤ ', ',  ', ' ≤ θ ≤ '], answers: L.answers, tokens: shuffled(g, uniq([...L.answers, ...L.extra])),
        hint: t('Hold θ fixed and let r increase: the point moves along a ray from the origin. Where does the ray enter R and where does it leave? Then find the smallest and largest θ of such rays.', '固定 θ 让 r 增大：点沿着从原点出发的射线移动。射线从哪里进入 R、从哪里离开？再找出这类射线的最小与最大 θ。'),
        explanation: t(`${t2(L.why, 0)} So ${L.answers[0]} ≤ r ≤ ${L.answers[1]}, ${L.answers[2]} ≤ θ ≤ ${L.answers[3]}.`, `${t2(L.why, 1)}所以 ${L.answers[0]} ≤ r ≤ ${L.answers[1]}，${L.answers[2]} ≤ θ ≤ ${L.answers[3]}。`),
      }),
      g.number({
        id: 'sector-mass', title: t('Mass of a sector', '扇形的质量'),
        prompt: t(`A plate fills the sector 0 ≤ r ≤ ${sm5.R}, 0 ≤ θ ≤ π/${sm5.d} and has density δ(x, y) = xy. Find its mass M = ∬_R δ dA. Use x = r cos θ, y = r sin θ and dA = r dr dθ. Enter a fraction or decimal.`,
          `一块薄板占据扇形 0 ≤ r ≤ ${sm5.R}，0 ≤ θ ≤ π/${sm5.d}，密度为 δ(x, y) = xy。求它的质量 M = ∬_R δ dA。用 x = r cos θ，y = r sin θ，dA = r dr dθ。输入分数或小数。`),
        figure: g.figure({
          alt: t(`The sector of radius ${sm5.R} between the positive x-axis and the ray at angle π/${sm5.d}.`, `半径为 ${sm5.R}、介于正 x 轴与角度 π/${sm5.d} 的射线之间的扇形。`),
          view: fitView(sectorShapes, 0.2), axes: AXES, shapes: sectorShapes, caption: t('Sector R', '扇形 R'),
        }),
        fields: [{ label: t('M', 'M'), answer: massAns }],
        hint: t('In polar coordinates δ = r² cos θ sin θ, and the area element adds a factor r.', '极坐标下 δ = r² cos θ sin θ，面积元素再带一个因子 r。'),
        explanation: t(`M = ∫₀^(π/${sm5.d}) ∫₀^${sm5.R} r² cos θ sin θ · r dr dθ. Inner: cos θ sin θ · ${sm5.R}⁴/4 = ${sm5.R ** 4}/4 · cos θ sin θ. Outer: ∫₀^(π/${sm5.d}) cos θ sin θ dθ = sin²(π/${sm5.d})/2 = ${frac(sn, 2 * sd)}. So M = ${frac(sm5.R ** 4, 4)}·${frac(sn, 2 * sd)} = ${frac(sm5.R ** 4 * sn, 8 * sd)}.`,
          `M = ∫₀^(π/${sm5.d}) ∫₀^${sm5.R} r² cos θ sin θ · r dr dθ。内层：cos θ sin θ · ${sm5.R}⁴/4 = ${sm5.R ** 4}/4 · cos θ sin θ。外层：∫₀^(π/${sm5.d}) cos θ sin θ dθ = sin²(π/${sm5.d})/2 = ${frac(sn, 2 * sd)}。所以 M = ${frac(sm5.R ** 4, 4)}·${frac(sn, 2 * sd)} = ${frac(sm5.R ** 4 * sn, 8 * sd)}。`),
        audit: { kind: 'MIT-MV-35:sector-mass', params: { R: sm5.R, d: sm5.d } },
      }),
      g.number({
        id: 'ring-integral', title: t('Integrate x² + y² over a ring', '在圆环上积分 x² + y²'),
        prompt: t(`Evaluate ∬_R ${ringInt} dA over the ring R: ${rg.b * rg.b} ≤ x² + y² ≤ ${rg.c * rg.c}. Use polar coordinates (dA = r dr dθ). Enter the exact value as a multiple of π, for example 7pi/2.`,
          `在圆环 R：${rg.b * rg.b} ≤ x² + y² ≤ ${rg.c * rg.c} 上计算 ∬_R ${ringInt} dA。用极坐标（dA = r dr dθ）。以 π 的倍数输入精确值，例如 7pi/2。`),
        figure: g.figure({
          alt: t(`The ring between the circles of radius ${rg.b} and ${rg.c} about the origin.`, `以原点为圆心、半径分别为 ${rg.b} 和 ${rg.c} 的两圆之间的圆环。`),
          view: fitView(ringShapes, 0.15), axes: AXES, shapes: ringShapes, caption: t('Ring R', '圆环 R'),
        }),
        fields: [{ label: t('Integral', '积分值'), answer: ringAns }],
        hint: t('x² + y² = r², so the integrand becomes (constant) · r² · r dr dθ, with r from the inner to the outer radius and θ from 0 to 2π.', 'x² + y² = r²，所以被积式变成（常数）· r² · r dr dθ，r 从内半径到外半径，θ 从 0 到 2π。'),
        explanation: t(`${rg.k === 1 ? '' : `${rg.k}·`}∫₀^(2π) ∫_${rg.b}^${rg.c} r³ dr dθ = ${rg.k === 1 ? '' : `${rg.k}·`}2π·(${rg.c}⁴ − ${rg.b}⁴)/4 = ${rg.k === 1 ? '' : `${rg.k}·`}2π·${frac(rg.c ** 4 - rg.b ** 4, 4)} = ${piMul(rg.k * (rg.c ** 4 - rg.b ** 4), 2)}.`,
          `${rg.k === 1 ? '' : `${rg.k}·`}∫₀^(2π) ∫_${rg.b}^${rg.c} r³ dr dθ = ${rg.k === 1 ? '' : `${rg.k}·`}2π·(${rg.c}⁴ − ${rg.b}⁴)/4 = ${rg.k === 1 ? '' : `${rg.k}·`}2π·${frac(rg.c ** 4 - rg.b ** 4, 4)} = ${piMul(rg.k * (rg.c ** 4 - rg.b ** 4), 2)}。`),
        audit: { kind: 'MIT-MV-35:ring-integral', params: { b: rg.b, c: rg.c, k: rg.k } },
      }),
      g.number({
        id: 'cardioid-area', title: t('Area inside a cardioid', '心形线内部的面积'),
        prompt: t(`Find the area inside the cardioid r = ${cardioidExpr(cd.a, cd.sgn)}, 0 ≤ θ ≤ 2π, as ∬_R dA = ∫ ∫ r dr dθ with r from 0 to ${cardioidExpr(cd.a, cd.sgn)}. Enter the exact value as a multiple of π, for example 3pi/2.`,
          `求心形线 r = ${cardioidExpr(cd.a, cd.sgn)}（0 ≤ θ ≤ 2π）内部的面积，即 ∬_R dA = ∫ ∫ r dr dθ，其中 r 从 0 到 ${cardioidExpr(cd.a, cd.sgn)}。以 π 的倍数输入精确值，例如 3pi/2。`),
        figure: g.figure({
          alt: t(`The heart-shaped cardioid r = ${cardioidExpr(cd.a, cd.sgn)}, with its cusp at the origin and its far point at (${cd.sgn > 0 ? '' : '−'}${2 * cd.a}, 0).`, `心形线 r = ${cardioidExpr(cd.a, cd.sgn)}，尖点在原点，最远点为 (${cd.sgn > 0 ? '' : '−'}${2 * cd.a}, 0)。`),
          view: fitView(cardShapes, 0.15), axes: AXES, shapes: cardShapes, caption: t(`r = ${cardioidExpr(cd.a, cd.sgn)}`, `r = ${cardioidExpr(cd.a, cd.sgn)}`),
        }),
        fields: [{ label: t('Area', '面积'), answer: cardAns }],
        hint: t('Inner integral of r dr is r²/2 evaluated at the upper limit. Then expand the square and use cos²θ = (1 + cos 2θ)/2.', '对 r dr 的内层积分是 r²/2 在上限处的值；然后展开平方并用 cos²θ = (1 + cos 2θ)/2。'),
        explanation: t(`Inner: ∫₀^(${cardioidExpr(cd.a, cd.sgn)}) r dr = ${cd.a === 1 ? `(1 ${cd.sgn > 0 ? '+' : '−'} cos θ)²/2` : `${cd.a * cd.a}(1 ${cd.sgn > 0 ? '+' : '−'} cos θ)²/2`}. Outer: ∫₀^(2π) (1 ${cd.sgn > 0 ? '+' : '−'} 2 cos θ + cos²θ) dθ = 2π + 0 + π = 3π, so the area is (${halfA})·3π = ${piMul(3 * cd.a * cd.a, 2)}.`,
          `内层：∫₀^(${cardioidExpr(cd.a, cd.sgn)}) r dr = ${cd.a === 1 ? `(1 ${cd.sgn > 0 ? '+' : '−'} cos θ)²/2` : `${cd.a * cd.a}(1 ${cd.sgn > 0 ? '+' : '−'} cos θ)²/2`}。外层：∫₀^(2π) (1 ${cd.sgn > 0 ? '+' : '−'} 2 cos θ + cos²θ) dθ = 2π + 0 + π = 3π，所以面积为 (${halfA})·3π = ${piMul(3 * cd.a * cd.a, 2)}。`),
        audit: { kind: 'MIT-MV-35:cardioid-area', params: { a: cd.a, sign: cd.sgn } },
      }),
      g.choice({
        id: 'negative-r', title: t('Why r must stay non-negative', '为什么 r 必须取非负值'),
        prompt: t(`A student wants the area of the disk r ≤ ${nr.R} and computes ∫₀^(2π) ∫_(−${nr.R})^(${nr.R}) r dr dθ, letting r run from −${nr.R} to ${nr.R} "to cover everything". What happens?`,
          `一位同学想求圆盘 r ≤ ${nr.R} 的面积，计算 ∫₀^(2π) ∫_(−${nr.R})^(${nr.R}) r dr dθ，让 r 从 −${nr.R} 取到 ${nr.R}「以便盖住所有点」。结果如何？`),
        options: [
          t(`The integral is 0, because ∫ r dr from −${nr.R} to ${nr.R} is 0: negative r cancels positive r. Take r ≥ 0 in integrals.`, `积分值为 0，因为 ∫ r dr（r 从 −${nr.R} 到 ${nr.R}）等于 0：负的 r 抵消正的 r。积分时要取 r ≥ 0。`),
          t(`The integral is π·${nr.R * nr.R}, the area of the disk: every point of the disk is counted exactly once, so letting r start at −${nr.R} is harmless.`, `积分值是 π·${nr.R * nr.R}，即圆盘的面积：圆盘上每个点恰好被算一次，所以让 r 从 −${nr.R} 开始没有问题。`),
          t(`The integral is 2π·${nr.R * nr.R}: every point is counted twice, once with r > 0 and once with r < 0, so the area is doubled.`, `积分值是 2π·${nr.R * nr.R}：每个点被算两次，一次对应 r > 0，一次对应 r < 0，所以面积翻倍。`),
        ], correct: 0,
        hint: t('Compute the inner integral ∫ r dr from −R to R first.', '先算内层积分 ∫ r dr（r 从 −R 到 R）。'),
        explanation: t(`∫_(−${nr.R})^(${nr.R}) r dr = [r²/2] = 0, so the whole integral is 0, not an area. Negative r can be used to plot a curve, but in integration it must be avoided: use 0 ≤ r ≤ ${nr.R} and 0 ≤ θ ≤ 2π, which gives 2π·${nr.R * nr.R}/2 = ${nr.R * nr.R}π.`,
          `∫_(−${nr.R})^(${nr.R}) r dr = [r²/2] = 0，所以整个积分为 0，不是面积。负的 r 可以用来画曲线，但积分时必须避免：用 0 ≤ r ≤ ${nr.R}、0 ≤ θ ≤ 2π，得 2π·${nr.R * nr.R}/2 = ${nr.R * nr.R}π。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Compute ∬_R ${chInt} dA over R, the disk inside the circle of radius ${chA} centred at (${chA}, 0) (that is, ${square('x', chA)} + y² ≤ ${chA * chA}). Enter a fraction or decimal.`,
          `计算 ∬_R ${chInt} dA，其中 R 是以 (${chA}, 0) 为圆心、半径为 ${chA} 的圆内部的圆盘（即 ${square('x', chA)} + y² ≤ ${chA * chA}）。输入分数或小数。`),
        fields: [{ label: t('Integral', '积分值'), answer: 4 * chA * chK }],
        hint: t('Use polar coordinates; first write the circle as r = f(θ) and find the range of θ.', '用极坐标；先把圆写成 r = f(θ)，并确定 θ 的范围。'),
        explanation: t(`The circle is r = ${cosT(2 * chA)} for −π/2 ≤ θ ≤ π/2. The integrand is ${chK === 1 ? '' : `${chK}·`}1/r and dA = r dr dθ, so the integral is ${chK === 1 ? '' : `${chK}·`}∫ from −π/2 to π/2 of ∫₀^(${cosT(2 * chA)}) dr dθ = ${chK === 1 ? '' : `${chK}·`}∫ ${cosT(2 * chA)} dθ = ${chK === 1 ? '' : `${chK}·`}${2 * chA}·[sin θ] = ${chK === 1 ? '' : `${chK}·`}${2 * chA}·2 = ${4 * chA * chK}. This game assesses setting up and computing polar double integrals; it does not assess integrals over regions that need negative r.`,
          `这个圆是 r = ${cosT(2 * chA)}，−π/2 ≤ θ ≤ π/2。被积函数是 ${chK === 1 ? '' : `${chK}·`}1/r，dA = r dr dθ，所以积分为 ${chK === 1 ? '' : `${chK}·`}∫（θ 从 −π/2 到 π/2）∫₀^(${cosT(2 * chA)}) dr dθ = ${chK === 1 ? '' : `${chK}·`}∫ ${cosT(2 * chA)} dθ = ${chK === 1 ? '' : `${chK}·`}${2 * chA}·[sin θ] = ${chK === 1 ? '' : `${chK}·`}${2 * chA}·2 = ${4 * chA * chK}。本游戏检查极坐标二重积分的建立与计算，不涉及需要负 r 的区域。`),
        audit: { kind: 'MIT-MV-35:challenge', params: { a: chA, k: chK } },
      }),
    ];
  },
};
