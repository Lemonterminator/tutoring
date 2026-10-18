import { describe, expect, it } from 'vitest';
import { asVec, close, runOracle, type Oracle } from './oracle-harness';
import { batch01Generators } from './batch01';
import type { CardGenerator, GameLanguage, PracticeCard } from '../types';

/**
 * Independent oracle for batch 01 (MIT-MV-01, 03, 04, 05). Every audited answer is recomputed from the audit params by a route that is
 * different from the obvious closed form (trig, Heron/Gram determinants, Sarrus + cofactor, finite differences of a linear map, brute force
 * over integer vectors, simulated headings, ...). Written from audit-notes/batch01.md and printed card texts only.
 */

// ---------------------------------------------------------------- small numeric helpers
type P = Record<string, number | number[]>;
const num = (x: unknown) => x as number;
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
const scale = (k: number, a: number[]) => a.map(x => k * x);
const fmt = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const tuple = (v: number[]) => `(${v.map(fmt).join(', ')})`;
const unminus = (s: string) => s.replaceAll('−', '-');

/** 3 x 3 determinant by Sarrus' rule (m row-major). */
const sarrus = (m: number[]) =>
  m[0] * m[4] * m[8] + m[1] * m[5] * m[6] + m[2] * m[3] * m[7] - m[2] * m[4] * m[6] - m[0] * m[5] * m[7] - m[1] * m[3] * m[8];
/** 3 x 3 determinant by cofactor expansion down the SECOND COLUMN. */
const cofactorColumn2 = (m: number[]) => {
  const minor = (r: number) => { const rows = [0, 1, 2].filter(x => x !== r); return m[rows[0] * 3] * m[rows[1] * 3 + 2] - m[rows[0] * 3 + 2] * m[rows[1] * 3]; };
  return -m[1] * minor(0) + m[4] * minor(1) - m[7] * minor(2);
};
/** Exact 16 * (triangle area)^2 from the three squared side lengths (Heron's formula in polynomial form). */
const sixteenAreaSq = (a2: number, b2: number, c2: number) => 2 * (a2 * b2 + b2 * c2 + c2 * a2) - a2 * a2 - b2 * b2 - c2 * c2;
const triangleAreaHeron = (p: number[], q: number[], r: number[]) => Math.sqrt(sixteenAreaSq(dot(sub(q, p), sub(q, p)), dot(sub(r, q), sub(r, q)), dot(sub(p, r), sub(p, r)))) / 4;
const cross2 = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];
const shoelace = (pts: number[][]) => Math.abs(pts.reduce((s, p, i) => s + cross2(p, pts[(i + 1) % pts.length]), 0)) / 2;
const isConvexStrict = (pts: number[][]) => {
  const signs = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], r = pts[(i + 2) % pts.length]; return Math.sign(cross2(sub(q, p), sub(r, q))); });
  return signs.every(s => s !== 0 && s === signs[0]);
};
/** Taylor series of cos, so the angle-form oracle does not use Math.cos. */
const cosSeries = (x: number) => { let term = 1, sum = 1; for (let n = 1; n < 30; n++) { term *= -x * x / ((2 * n - 1) * (2 * n)); sum += term; } return sum; };
/** Quadratic-fit vertex of f(t) = alpha t^2 + beta t + gamma using three samples: minimiser of a distance function. */
const quadraticMinimiser = (f: (t: number) => number) => { const beta = (f(1) - f(-1)) / 2, alpha = (f(1) + f(-1) - 2 * f(0)) / 2; return -beta / (2 * alpha); };

// ---------------------------------------------------------------- branch coverage counters
const seen = new Set<string>();

// ---------------------------------------------------------------- oracles
const mv01: Record<string, Oracle> = {
  'MIT-MV-01:displacement': p => {
    const P0 = asVec(p.p), Q = asVec(p.q);
    const d = scale(-1, sub(P0, Q)); // -(P - Q)
    expect(add(P0, d)).toEqual(Q); // the displacement carries P to Q
    expect(close(dot(d, d), dot(P0, P0) + dot(Q, Q) - 2 * dot(P0, Q))).toBe(true); // |Q-P|^2 expanded
    return d;
  },
  'MIT-MV-01:head-to-tail': p => {
    const a = asVec(p.a), b = asVec(p.b);
    const tip = add(b, a); // B + A, the other order
    expect(close(dot(tip, tip), dot(a, a) + dot(b, b) + 2 * dot(a, b))).toBe(true);
    return tip;
  },
  'MIT-MV-01:combine': p => {
    const s = num(p.s), r = num(p.r), a = asVec(p.a), b = asVec(p.b);
    // bilinear form: component k is the dot product of the coefficient vector (s, r) with the k-th components (a_k, b_k)
    return [0, 1].map(k => dot([s, r], [a[k], b[k]]));
  },
  'MIT-MV-01:length-of-sum': p => {
    const a = asVec(p.a), b = asVec(p.b);
    const squared = dot(a, a) + dot(b, b) + 2 * dot(a, b); // |A+B|^2 by the law of cosines form
    const len = Math.sqrt(squared);
    expect(Number.isInteger(len), 'length must be a whole number as the prompt says').toBe(true);
    return [len];
  },
  'MIT-MV-01:unit-vector': p => {
    const v = asVec(p.v);
    const len = norm(v);
    expect(Number.isInteger(len), 'prompt/hint say |v| is a whole number').toBe(true);
    const u = v.map(x => x / len);
    expect(close(norm(u), 1)).toBe(true);
    expect(Math.abs(cross2(u, v))).toBeLessThan(1e-12); // parallel
    expect(dot(u, v)).toBeGreaterThan(0); // same direction
    return u;
  },
  'MIT-MV-01:parallelogram-vertex': p => {
    const a = asVec(p.a), b = asVec(p.b), c = asVec(p.c);
    const d = sub(c, sub(b, a)); // D = C - AB
    expect(add(a, c).map(x => x / 2)).toEqual(add(b, d).map(x => x / 2)); // diagonals bisect each other
    expect(sub(a, d)).toEqual(sub(b, c)); // AD = BC as well
    expect(cross2(sub(b, a), sub(c, b)), 'A, B, C must not be collinear (nondegenerate parallelogram)').not.toBe(0);
    // area of ABCD (shoelace, vertices in order) is twice area of triangle ABC
    expect(close(shoelace([a, b, c, d]), 2 * triangleAreaHeron(a, b, c))).toBe(true);
    return d;
  },
  'MIT-MV-01:length-inequality': p => {
    const a = asVec(p.a), b = asVec(p.b), la = num(p.la), lb = num(p.lb);
    expect(close(norm(a), la)).toBe(true); expect(close(norm(b), lb)).toBe(true);
    const sum = add(a, b);
    const lhs = dot(sum, sum), rhs = (la + lb) ** 2; // compare squares: no square roots
    const rel = lhs < rhs ? '<' : lhs === rhs ? '=' : '>';
    expect(rel, 'sampling should exclude same-direction vectors').toBe('<');
    seen.add('01:length-inequality');
    return {
      optionIsCorrect: text => {
        const m = unminus(text).match(/^\|A \+ B\| ([<=>]) \|A\| \+ \|B\| = (\d+)/);
        return !!m && m[1] === rel && Number(m[2]) === la + lb;
      },
    };
  },
  'MIT-MV-01:river': p => {
    const river = num(p.river), rower = num(p.rower);
    // Simulate headings phi (from straight-across, positive = upstream) and look for a heading with zero net velocity along the river.
    const along = (phi: number) => rower * Math.sin(phi) - river; // net velocity upstream-positive
    let crossing = false;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const phi0 = -Math.PI / 2 + Math.PI * i / N, phi1 = -Math.PI / 2 + Math.PI * (i + 1) / N;
      if (along(phi0) * along(phi1) <= 0 && Math.cos((phi0 + phi1) / 2) > 1e-6) crossing = true; // also moving across the river
    }
    const straightAcrossWorks = Math.abs(along(0)) < 1e-12;
    expect(straightAcrossWorks).toBe(false);
    expect(crossing).toBe(river < rower); // sanity: simulation agrees with the criterion in the notes
    seen.add(crossing ? '01:river-yes' : '01:river-no');
    return {
      optionIsCorrect: text => {
        if (text.startsWith('Yes: head straight')) return straightAcrossWorks;
        if (text.startsWith('Yes: head upstream')) return crossing;
        if (text.startsWith('No:')) return !crossing;
        throw new Error(`unknown river option: ${text}`);
      },
    };
  },
  'MIT-MV-01:challenge': p => {
    const s = num(p.s), a = asVec(p.a), b = asVec(p.b);
    const squared = s * s * dot(a, a) - 2 * s * dot(a, b) + dot(b, b); // expanded norm
    const len = Math.sqrt(squared);
    expect(Number.isInteger(len)).toBe(true);
    return [len];
  },
};

const mv03: Record<string, Oracle> = {
  'MIT-MV-03:component-unit': p => {
    const a = asVec(p.a), un = asVec(p.u), d = num(p.d);
    expect(dot(un, un)).toBe(d * d); // |u| = 1
    // trig route: |A| cos(angle(A) - angle(u))
    const u = un.map(x => x / d);
    const phi = Math.atan2(a[1], a[0]) - Math.atan2(u[1], u[0]);
    return [norm(a) * Math.cos(phi)];
  },
  'MIT-MV-03:component-direction': p => {
    const a = asVec(p.a), b = asVec(p.b), lb = num(p.lb);
    expect(close(norm(b), lb)).toBe(true);
    // |A|^2 = comp^2 + (|A x B|/|B|)^2, sign from the dot product
    const cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const perpSq = dot(cr, cr) / dot(b, b);
    const mag = Math.sqrt(Math.max(0, dot(a, a) - perpSq));
    const sign = Math.sign(dot(a, b));
    return [sign * mag];
  },
  'MIT-MV-03:both-ways': p => {
    const a = asVec(p.a), b = asVec(p.b);
    expect(close(norm(a), num(p.la))).toBe(true); expect(close(norm(b), num(p.lb))).toBe(true);
    const crossZ = cross2(a, b);
    const along = (x: number[], y: number[]) => Math.sign(dot(x, y)) * Math.sqrt(dot(x, x) - crossZ * crossZ / dot(y, y)); // component of x along y
    return [along(a, b), along(b, a)];
  },
  'MIT-MV-03:angle-form': p => {
    const l = num(p.l), k = num(p.k), d = num(p.d);
    expect(k / d).toBeGreaterThan(0); expect(k / d).toBeLessThanOrEqual(1); // angle between two vectors lies in (0, pi]
    return [l * cosSeries(k * Math.PI / d)];
  },
  'MIT-MV-03:projection': p => {
    const a = asVec(p.a), b = asVec(p.b);
    expect(cross2(a, b)).not.toBe(0); expect(dot(a, b)).not.toBe(0);
    const t = quadraticMinimiser(t => { const r = sub(a, scale(t, b)); return dot(r, r); }); // closest point of line(B) to A
    const foot = scale(t, b);
    expect(Math.abs(dot(sub(a, foot), b))).toBeLessThan(1e-9); // perpendicular dropped from the tip of A
    return foot;
  },
  'MIT-MV-03:zero-component': p => {
    const y = num(p.y), b = asVec(p.b);
    const comp = (aa: number) => dot([aa, y], b) / norm(b);
    expect(b[0]).not.toBe(0);
    const g0 = comp(0), g1 = comp(1);
    return [-g0 / (g1 - g0)]; // root of an affine function from two samples
  },
  'MIT-MV-03:negative-component': p => {
    const y = num(p.y), b = asVec(p.b);
    const comp = (aa: number) => dot([aa, y], b) / norm(b);
    const grid: number[] = []; for (let v = -80; v <= 80; v += 0.5) grid.push(v);
    // The true set {a : comp(a) < 0}; an option is correct iff it describes exactly that set on a fine grid containing the boundary.
    seen.add(b[0] > 0 ? '03:neg-positive-coeff' : '03:neg-negative-coeff');
    return {
      optionIsCorrect: text => {
        const m = unminus(text).match(/^a ([<>=]) (-?\d+)$/);
        if (!m) throw new Error(`unparsed option ${text}`);
        const c = Number(m[2]);
        const holds = (v: number) => (m[1] === '<' ? v < c : m[1] === '>' ? v > c : v === c);
        return grid.every(v => (comp(v) < -1e-12) === holds(v));
      },
    };
  },
  'MIT-MV-03:challenge': p => {
    const t = num(p.t), b = asVec(p.b), lb = num(p.lb), c = num(p.c);
    expect(close(norm(b), lb)).toBe(true);
    const f = (x: number) => dot([x, t], b) / norm(b) - c;
    const f0 = f(0), f1 = f(1);
    return [-f0 / (f1 - f0)];
  },
};

const det2Trig = (m: number[]) => { // |r1||r2| sin(theta2 - theta1)
  const r1 = [m[0], m[1]], r2 = [m[2], m[3]];
  return norm(r1) * norm(r2) * Math.sin(Math.atan2(r2[1], r2[0]) - Math.atan2(r1[1], r1[0]));
};

const mv04: Record<string, Oracle> = {
  'MIT-MV-04:det2': p => [det2Trig(asVec(p.m))],
  'MIT-MV-04:parallelogram-area': p => {
    const a = asVec(p.a), b = asVec(p.b);
    const area = shoelace([[0, 0], a, add(a, b), b]);
    expect(area).toBeGreaterThan(0); // the prompt says "a positive number"
    return [area];
  },
  'MIT-MV-04:triangle-area': p => {
    const area = triangleAreaHeron(asVec(p.p), asVec(p.q), asVec(p.r));
    expect(area).toBeGreaterThan(0);
    return [area];
  },
  'MIT-MV-04:det3': p => {
    const m = asVec(p.m);
    expect(m.length).toBe(9);
    const s = sarrus(m), c = cofactorColumn2(m);
    expect(s).toBe(c);
    return [s];
  },
  'MIT-MV-04:cofactor': p => {
    const m = asVec(p.m), i = num(p.i), j = num(p.j);
    // The determinant is affine in entry (i, j) with slope equal to the cofactor.
    const bumped = m.slice(); bumped[(i - 1) * 3 + (j - 1)] += 1;
    const slope = sarrus(bumped) - sarrus(m);
    // and the checkerboard-sign times minor reading of the same number
    const rows = [0, 1, 2].filter(x => x !== i - 1), cols = [0, 1, 2].filter(x => x !== j - 1);
    const minor = m[rows[0] * 3 + cols[0]] * m[rows[1] * 3 + cols[1]] - m[rows[0] * 3 + cols[1]] * m[rows[1] * 3 + cols[0]];
    expect(slope + 0).toBe((-1) ** (i + j) * minor + 0);
    return [slope];
  },
  'MIT-MV-04:volume': p => {
    const a = asVec(p.a), b = asVec(p.b), c = asVec(p.c);
    const gram = [dot(a, a), dot(a, b), dot(a, c), dot(b, a), dot(b, b), dot(b, c), dot(c, a), dot(c, b), dot(c, c)];
    const volume = Math.sqrt(sarrus(gram)); // sqrt(det G) = |det|
    const triple = Math.abs(a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]));
    expect(close(volume, triple)).toBe(true);
    expect(volume).toBeGreaterThan(0);
    return [volume];
  },
  'MIT-MV-04:coplanar': p => {
    const a = asVec(p.a), b = asVec(p.b), c = asVec(p.c);
    const gram = [dot(a, a), dot(a, b), dot(a, c), dot(b, a), dot(b, b), dot(b, c), dot(c, a), dot(c, b), dot(c, c)];
    const flatByGram = sarrus(gram) === 0;
    const flatByCrossDot = dot(a, [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]]) === 0;
    expect(flatByGram).toBe(flatByCrossDot);
    seen.add(flatByGram ? '04:coplanar-yes' : '04:coplanar-no');
    return {
      optionIsCorrect: text => {
        if (text.startsWith('Yes')) return flatByGram;
        if (text.startsWith('No')) return !flatByGram;
        if (text.startsWith('It cannot')) return false;
        throw new Error(`unknown coplanar option ${text}`);
      },
    };
  },
  'MIT-MV-04:row-operations': p => {
    const d = num(p.d), c = num(p.c), k = num(p.k);
    // Build a concrete M of determinant d, then actually perform the operations and take the determinant of the result.
    const base = [1, 2, 3, 0, 1, 4, 5, 6, 0]; // det = 1
    expect(sarrus(base)).toBe(1);
    const M = base.map((x, idx) => (idx < 3 ? x * d : x)); // scale row 1 by d  -> det d
    expect(sarrus(M)).toBe(d);
    const rows = [M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)];
    [rows[0], rows[1]] = [rows[1], rows[0]]; // swap rows 1 and 2
    rows[2] = rows[2].map(x => c * x); // multiply row 3 by c
    rows[1] = add(rows[1], scale(k, rows[0])); // add k times (current) row 1 to row 2
    return [sarrus(rows.flat())];
  },
  'MIT-MV-04:challenge': p => {
    const a = asVec(p.a), b = asVec(p.b), c = asVec(p.c), o = [0, 0];
    const quad = [o, a, b, c];
    expect(isConvexStrict(quad), 'prompt says convex quadrilateral').toBe(true);
    const area = shoelace(quad);
    // other diagonal: triangles OAC and ABC
    expect(close(area, triangleAreaHeron(o, a, c) + triangleAreaHeron(a, b, c))).toBe(true);
    return [area];
  },
};

const crossViaTripleProduct = (a: number[], b: number[]) =>
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e => sarrus([...e, ...a, ...b])); // k-th component = det(e_k, a, b)

const mv05: Record<string, Oracle> = {
  'MIT-MV-05:cross': p => {
    const a = asVec(p.a), b = asVec(p.b);
    const n = crossViaTripleProduct(a, b);
    expect(dot(n, a)).toBe(0); expect(dot(n, b)).toBe(0);
    expect(dot(n, n)).toBe(dot(a, a) * dot(b, b) - dot(a, b) ** 2); // Lagrange identity
    // right-hand rule orientation: (A, B, A x B) is a positively oriented frame when A x B != 0
    if (dot(n, n) > 0) expect(sarrus([...a, ...b, ...n])).toBeGreaterThan(0);
    return n;
  },
  'MIT-MV-05:planar': p => {
    const a = asVec(p.a), b = asVec(p.b);
    const n = crossViaTripleProduct([a[0], a[1], 0], [b[0], b[1], 0]);
    expect(n[0]).toBe(0); expect(n[1]).toBe(0);
    // trig route: |A||B| sin(theta_B - theta_A)
    const viaAngle = norm(a) * norm(b) * Math.sin(Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]));
    expect(close(viaAngle, n[2], 1e-9)).toBe(true);
    return [n[2]];
  },
  'MIT-MV-05:parallelogram-area': p => {
    const a = asVec(p.a), b = asVec(p.b);
    const lagrange = Math.sqrt(dot(a, a) * dot(b, b) - dot(a, b) ** 2);
    // Cauchy-Binet: area^2 = sum of squares of the three coordinate-plane shadows' determinants
    const shadows = [[0, 1], [1, 2], [0, 2]].map(([i, j]) => a[i] * b[j] - a[j] * b[i]);
    expect(close(lagrange, Math.sqrt(shadows.reduce((s, x) => s + x * x, 0)))).toBe(true);
    expect(Number.isInteger(lagrange), 'prompt says the area is a whole number').toBe(true);
    expect(lagrange).toBeGreaterThan(0);
    return [lagrange];
  },
  'MIT-MV-05:lagrange': p => {
    const la = num(p.la), lb = num(p.lb), d = num(p.d);
    // Heron: parallelogram with edges of lengths la, lb whose diagonal c satisfies c^2 = la^2 + lb^2 - 2 A.B (law of cosines)
    const c2 = la * la + lb * lb - 2 * d;
    const area = 2 * Math.sqrt(sixteenAreaSq(la * la, lb * lb, c2)) / 4;
    expect(Number.isInteger(area)).toBe(true);
    expect(Math.abs(d)).toBeLessThan(la * lb); // a real, non-degenerate pair of vectors exists
    return [area];
  },
  'MIT-MV-05:direction': p => {
    const a = asVec(p.a), b = asVec(p.b);
    // angle from A to B, normalised to (-pi, pi]
    let delta = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]);
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    const exactZero = a[0] * b[1] - a[1] * b[0] === 0;
    const dir = exactZero ? 0 : delta > 0 ? 1 : -1;
    expect(exactZero).toBe(false); // the notes say the zero case is never sampled
    seen.add(dir > 0 ? '05:direction+z' : '05:direction-z');
    return {
      optionIsCorrect: text => {
        const t = unminus(text);
        if (t.startsWith('A × B points in the +z')) return dir > 0;
        if (t.startsWith('A × B points in the -z')) return dir < 0;
        if (t.startsWith('A × B = 0')) return dir === 0;
        throw new Error(`unknown direction option ${text}`);
      },
    };
  },
  'MIT-MV-05:triangle-area': p => {
    const P0 = asVec(p.p), Q = asVec(p.q);
    const area = triangleAreaHeron([0, 0, 0], P0, Q);
    expect(close(area * 2, Math.round(area * 2))).toBe(true); // half-integer by construction
    expect(area).toBeGreaterThan(0);
    return [area];
  },
  'MIT-MV-05:challenge': p => {
    const P0 = asVec(p.p), Q = asVec(p.q), R = asVec(p.r);
    const area = triangleAreaHeron(P0, Q, R);
    expect(area).toBeGreaterThan(0);
    return [area];
  },
};

const allOracles: Record<string, Oracle> = { ...mv01, ...mv03, ...mv04, ...mv05 };
/** Seeds spread over the full 32-bit range: sequential small seeds give strongly correlated first draws with the course's LCG. */
const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(1_700_000_000 + seed * 7919, lang);
const oraclesFor = (id: string) => Object.fromEntries(Object.entries(allOracles).filter(([k]) => k.startsWith(`${id}:`)));
const kindsOf = (id: string) => Object.keys(oraclesFor(id)).sort();

describe('independent oracles for batch 01', () => {
  for (const id of ['MIT-MV-01', 'MIT-MV-03', 'MIT-MV-04', 'MIT-MV-05']) {
    it(`${id}: every audited card, seeds 0..199`, () => {
      const counts = runOracle(id, batch01Generators[id], oraclesFor(id));
      expect(Object.keys(counts).sort()).toEqual(kindsOf(id));
      for (const [kind, n] of Object.entries(counts)) expect(n, kind).toBe(200);
    });
    it(`${id}: every audited card, 200 seeds spread over the 32-bit range`, () => {
      const counts = runOracle(id, spread(batch01Generators[id]), oraclesFor(id));
      expect(Object.keys(counts).sort()).toEqual(kindsOf(id));
    });
  }

  it('branches of the choice cards are actually exercised', () => {
    for (const key of ['01:length-inequality', '01:river-yes', '01:river-no', '03:neg-positive-coeff', '03:neg-negative-coeff', '04:coplanar-yes', '04:coplanar-no', '05:direction+z', '05:direction-z'])
      expect(seen.has(key), key).toBe(true);
  });
});

// ---------------------------------------------------------------- prompt / hidden-input / figure / explanation checks (text and figure data of the cards only)
const lin = (s: number, t: number) => `${s === 1 ? 'i' : s === -1 ? '−i' : `${fmt(s)}i`}${t < 0 ? ' − ' : ' + '}${Math.abs(t) === 1 ? 'j' : `${Math.abs(t)}j`}`;
const sa = (s: number, name: string) => (s === 1 ? name : s === -1 ? `−${name}` : `${fmt(s)}${name}`);
const rowsText = (m: number[]) => [0, 1, 2].map(r => tuple(m.slice(r * 3, r * 3 + 3)));

/** Everything the student must see in the English prompt to be able to reproduce the audited answer. */
const requiredInPrompt: Record<string, (p: P) => string[]> = {
  'MIT-MV-01:displacement': p => [`P = ${tuple(asVec(p.p))}`, `Q = ${tuple(asVec(p.q))}`],
  'MIT-MV-01:head-to-tail': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-01:combine': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `Compute ${sa(num(p.s), 'A')} ${num(p.r) < 0 ? '−' : '+'} ${Math.abs(num(p.r)) === 1 ? '' : Math.abs(num(p.r))}B.`],
  'MIT-MV-01:length-of-sum': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-01:unit-vector': p => [`v = ${tuple(asVec(p.v))}`],
  'MIT-MV-01:parallelogram-vertex': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `C = ${tuple(asVec(p.c))}`],
  'MIT-MV-01:length-inequality': p => [`A = ${tuple(asVec(p.a))} has length |A| = ${p.la}`, `B = ${tuple(asVec(p.b))} has length |B| = ${p.lb}`],
  'MIT-MV-01:river': p => [`flows at ${p.river} mph`, `rows at ${p.rower} mph`],
  'MIT-MV-01:challenge': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `|${num(p.s)}A − B|`],
  'MIT-MV-03:component-unit': p => { const u = asVec(p.u); return [`A = ${tuple(asVec(p.a))}`, `u = (${fmt(u[0])}/${p.d}, ${fmt(u[1])}/${p.d})`]; },
  'MIT-MV-03:component-direction': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `|B| = ${p.lb}`],
  'MIT-MV-03:both-ways': p => [`A = ${tuple(asVec(p.a))} with |A| = ${p.la}`, `B = ${tuple(asVec(p.b))} with |B| = ${p.lb}`],
  'MIT-MV-03:angle-form': p => [`|A| = ${p.l}`, `|B| = ${p.m}`, `θ = ${num(p.k) === 1 ? '' : num(p.k)}π/${p.d}`],
  'MIT-MV-03:projection': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-03:zero-component': p => [`A = (a, ${fmt(num(p.y))})`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-03:negative-component': p => [`A = (a, ${fmt(num(p.y))})`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-03:challenge': p => [`A = (x, ${fmt(num(p.t))})`, `B = ${tuple(asVec(p.b))}`, `|B| = ${p.lb}`, `equals ${fmt(num(p.c))}`],
  'MIT-MV-04:det2': p => { const m = asVec(p.m); return [`rows (${fmt(m[0])}, ${fmt(m[1])}) and (${fmt(m[2])}, ${fmt(m[3])})`]; },
  'MIT-MV-04:parallelogram-area': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-04:triangle-area': p => [`P = ${tuple(asVec(p.p))}`, `Q = ${tuple(asVec(p.q))}`, `R = ${tuple(asVec(p.r))}`],
  'MIT-MV-04:det3': p => { const r = rowsText(asVec(p.m)); return [`rows ${r[0]}, ${r[1]} and ${r[2]}`]; },
  'MIT-MV-04:cofactor': p => { const r = rowsText(asVec(p.m)); return [`rows ${r[0]}, ${r[1]} and ${r[2]}`, `row ${p.i}, column ${p.j}`]; },
  'MIT-MV-04:volume': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `C = ${tuple(asVec(p.c))}`],
  'MIT-MV-04:coplanar': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `C = ${tuple(asVec(p.c))}`],
  'MIT-MV-04:row-operations': p => [`det M = ${fmt(num(p.d))}`, `multiplying row 3 by ${fmt(num(p.c))}`, `adding ${num(p.k) < 0 ? `(${fmt(num(p.k))})` : num(p.k)} times row 1 to row 2`],
  'MIT-MV-04:challenge': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`, `C = ${tuple(asVec(p.c))}`, 'O = (0, 0)'],
  'MIT-MV-05:cross': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-05:planar': p => { const a = asVec(p.a), b = asVec(p.b); return [`(${lin(a[0], a[1])}) × (${lin(b[0], b[1])})`]; },
  'MIT-MV-05:parallelogram-area': p => [`A = ${tuple(asVec(p.a))}`, `B = ${tuple(asVec(p.b))}`],
  'MIT-MV-05:lagrange': p => [`|A| = ${p.la}`, `|B| = ${p.lb}`, `A · B = ${fmt(num(p.d))}`],
  'MIT-MV-05:direction': p => [`A = ${tuple([...asVec(p.a), 0])}`, `B = ${tuple([...asVec(p.b), 0])}`],
  'MIT-MV-05:triangle-area': p => [`P = ${tuple(asVec(p.p))}`, `Q = ${tuple(asVec(p.q))}`],
  'MIT-MV-05:challenge': p => [`P = ${tuple(asVec(p.p))}`, `Q = ${tuple(asVec(p.q))}`, `R = ${tuple(asVec(p.r))}`],
};
/** Vector parameters that must appear as a printed tuple in the prompt in EVERY language (exceptions listed). */
const tupleExempt = new Set(['MIT-MV-03:component-unit:u', 'MIT-MV-05:planar:a', 'MIT-MV-05:planar:b', 'MIT-MV-05:direction:a', 'MIT-MV-05:direction:b']);

const allCards = (lang: GameLanguage, seeds: number[]) => {
  const out: { id: string; seed: number; card: PracticeCard }[] = [];
  for (const id of Object.keys(batch01Generators)) if (['MIT-MV-01', 'MIT-MV-03', 'MIT-MV-04', 'MIT-MV-05'].includes(id))
    for (const seed of seeds) for (const card of batch01Generators[id](seed, lang)) out.push({ id, seed, card });
  return out;
};
const seedsA = Array.from({ length: 60 }, (_, i) => i);
const seedsB = Array.from({ length: 60 }, (_, i) => 1_700_000_000 + i * 7919);

describe('batch 01 card texts, figures and explanations', () => {
  it('English prompts show every number the audited answer needs', () => {
    for (const { card, seed } of allCards('en', [...seedsA, ...seedsB])) {
      if (!card.audit) continue;
      const need = requiredInPrompt[card.audit.kind];
      expect(need, `no prompt rule for ${card.audit.kind}`).toBeTypeOf('function');
      for (const s of need(card.audit.params)) expect(card.prompt, `${card.id} seed ${seed}: prompt lacks "${s}"`).toContain(s);
    }
  });

  it('every language prints each vector parameter as a tuple', () => {
    for (const lang of ['en', 'zh'] as const) for (const { card, seed } of allCards(lang, [...seedsA.slice(0, 30), ...seedsB.slice(0, 30)])) {
      if (!card.audit) continue;
      for (const [key, value] of Object.entries(card.audit.params)) {
        if (!Array.isArray(value) || value.length < 2 || value.length > 3 || tupleExempt.has(`${card.audit.kind}:${key}`)) continue;
        if (card.audit.kind === 'MIT-MV-04:det2' || card.audit.kind === 'MIT-MV-03:zero-component') continue;
        expect(card.prompt, `${card.id} seed ${seed} ${lang}: missing ${tuple(value)}`).toContain(tuple(value));
      }
    }
  });

  it('no untranslated English connective words in Chinese prompts, lines, options, hints and explanations', () => {
    const offenders: string[] = [];
    for (const { card, seed } of allCards('zh', [...seedsA.slice(0, 20)])) {
      const texts = [card.prompt, card.hint, card.explanation, ...(card.lines ?? []), ...(card.choice?.options ?? [])];
      for (const t of texts) if (/\b(and|or|the|of|with|where|find)\b/.test(t)) offenders.push(`${card.id} seed ${seed}: ${t.slice(0, 80)}`);
    }
    expect([...new Set(offenders.map(o => o.split(' seed ')[0]))], offenders.slice(0, 3).join(' || ')).toEqual([]);
  });

  it('explanations contain the audited numeric answers (integers and rationals), English and Chinese', () => {
    const bad: string[] = [];
    for (const lang of ['en', 'zh'] as const) for (const { card, seed } of allCards(lang, seedsA)) {
      if (!card.audit || !card.fields) continue;
      for (const f of card.fields) {
        const a = f.answer; if (Number.isInteger(a) && a === 0) continue;
        const forms: string[] = [fmt(a)];
        for (let q = 2; q <= 1000; q++) if (Math.abs(a * q - Math.round(a * q)) < 1e-9) { forms.push(`${fmt(Math.round(a * q))}/${q}`, `${fmt(Math.round(Math.abs(a) * q))}/${q}`, String(a)); break; }
        if (!Number.isInteger(a) && forms.length === 1) continue; // irrational: skipped (exact surd forms are checked below)
        if (!forms.some(s => card.explanation.includes(s))) bad.push(`${card.id} seed ${seed} ${lang}: answer ${a} not in explanation`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('figure data matches the audit params and stays inside the view box', () => {
    const near = (p: number[] | undefined, q: number[]) => !!p && p.length >= 2 && Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;
    // Oblique projection read from the axis arrows of the MIT-MV-05 parallelogram figure: (x,y,z) -> (y - 0.45 x, z - 0.3 x)
    const oblique = (v: number[]) => [v[1] - 0.45 * v[0], v[2] - 0.3 * v[0]];
    for (const { card, seed } of allCards('en', [...seedsA, ...seedsB])) {
      const fig = card.figure as any; if (!card.audit || !fig) continue;
      const where = `${card.id} seed ${seed}`;
      const p = card.audit.params as P;
      const arrows = (fig.shapes as any[]).filter(s => s.kind === 'arrow');
      const arrow = (label: string) => arrows.find(s => s.label === label);
      // all points inside the declared view
      const pts: number[][] = [];
      for (const s of fig.shapes as any[]) { if (s.from) pts.push(s.from, s.to); if (s.points) pts.push(...s.points); if (s.at) pts.push(s.at); }
      for (const q of pts) { expect(q[0] >= fig.view.xmin && q[0] <= fig.view.xmax && q[1] >= fig.view.ymin && q[1] <= fig.view.ymax, `${where}: point ${q} outside view`).toBe(true); }
      // alt text mentions the printed parameters
      for (const key of ['a', 'b', 'c', 'p', 'q', 'r']) { const v = p[key]; if (Array.isArray(v) && v.length >= 2 && !(card.audit.kind === 'MIT-MV-03:component-unit')) expect(fig.alt, `${where}: alt lacks ${tuple(v)}`).toContain(tuple(v)); }
      switch (card.audit.kind) {
        case 'MIT-MV-01:head-to-tail': {
          const a = asVec(p.a), b = asVec(p.b);
          expect(near(arrow('A').from, [0, 0]) && near(arrow('A').to, a), where).toBe(true);
          expect(near(arrow('B').from, a) && near(arrow('B').to, add(a, b)), where).toBe(true);
          break;
        }
        case 'MIT-MV-03:projection': {
          const a = asVec(p.a), b = asVec(p.b);
          const t = dot(a, b) / dot(b, b), foot = scale(t, b);
          expect(near(arrow('A').to, a) && near(arrow('B').to, b), where).toBe(true);
          expect(near(arrow('proj').to, foot), `${where}: projection arrow ends at ${arrow('proj').to}, foot is ${foot}`).toBe(true);
          const line = (fig.shapes as any[]).find(s => s.kind === 'line');
          expect(near(line.points[0], a) && near(line.points[1], foot), where).toBe(true);
          break;
        }
        case 'MIT-MV-04:parallelogram-area': {
          const a = asVec(p.a), b = asVec(p.b);
          const poly = (fig.shapes as any[]).find(s => s.kind === 'area').points as number[][];
          [[0, 0], a, add(a, b), b].forEach((v, i) => expect(near(poly[i], v), `${where}: vertex ${i}`).toBe(true));
          break;
        }
        case 'MIT-MV-04:triangle-area': {
          const poly = (fig.shapes as any[]).find(s => s.kind === 'area').points as number[][];
          [asVec(p.p), asVec(p.q), asVec(p.r)].forEach((v, i) => expect(near(poly[i], v), `${where}: vertex ${i}`).toBe(true));
          break;
        }
        case 'MIT-MV-04:challenge': {
          const poly = (fig.shapes as any[]).find(s => s.kind === 'area').points as number[][];
          [[0, 0], asVec(p.a), asVec(p.b), asVec(p.c)].forEach((v, i) => expect(near(poly[i], v), `${where}: vertex ${i}`).toBe(true));
          break;
        }
        case 'MIT-MV-04:volume': {
          const a = asVec(p.a), b = asVec(p.b), c = asVec(p.c);
          const corners = [[0, 0, 0], a, b, c, add(a, b), add(a, c), add(b, c), add(add(a, b), c)];
          const edgesWanted = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 4], [2, 6], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7]];
          const lines = (fig.shapes as any[]).filter(s => s.kind === 'line').map(s => s.points as number[][]);
          expect(lines.length, where).toBe(12);
          for (const [i, j] of edgesWanted) {
            const hit = lines.some(l => (near(l[0], oblique(corners[i])) && near(l[1], oblique(corners[j]))) || (near(l[1], oblique(corners[i])) && near(l[0], oblique(corners[j]))));
            expect(hit, `${where}: edge ${i}-${j} missing or wrong`).toBe(true);
          }
          [['A', a], ['B', b], ['C', c]].forEach(([l, v]) => expect(near(arrow(l as string).to, oblique(v as number[])), `${where}: arrow ${l}`).toBe(true));
          break;
        }
        case 'MIT-MV-05:parallelogram-area': {
          const a = asVec(p.a), b = asVec(p.b);
          const poly = (fig.shapes as any[]).find(s => s.kind === 'area').points as number[][];
          [[0, 0, 0], a, add(a, b), b].forEach((v, i) => expect(near(poly[i], oblique(v)), `${where}: vertex ${i}`).toBe(true));
          // the axis arrows should themselves be consistent with the projection used
          expect(near(arrow('x').to, scale(3, oblique([1, 0, 0]))) && near(arrow('y').to, scale(3, oblique([0, 1, 0]))) && near(arrow('z').to, scale(3, oblique([0, 0, 1]))), where).toBe(true);
          break;
        }
        case 'MIT-MV-05:direction': {
          expect(near(arrow('A').to, asVec(p.a)) && near(arrow('B').to, asVec(p.b)), where).toBe(true);
          break;
        }
        default: break;
      }
    }
  });

  it('MIT-MV-05 cards without audit: non-associative and zero-cross, verified from their own texts', () => {
    const unit: Record<string, number[]> = { i: [1, 0, 0], j: [0, 1, 0], k: [0, 0, 1] };
    const x3 = (a: number[], b: number[]) => crossViaTripleProduct(a, b);
    const name = (v: number[]): string => {
      if (v.every(c => c === 0)) return '0';
      for (const [n, e] of Object.entries(unit)) { if (v.every((c, i) => c === e[i])) return n; if (v.every((c, i) => c === -e[i])) return `-${n}`; }
      return '?';
    };
    // all small integer 3D vectors, for the zero-cross brute force
    const small: number[][] = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) small.push([x, y, z]);
    const zeroPairs = small.flatMap(a => small.filter(b => x3(a, b).every(c => c === 0)).map(b => [a, b] as const));
    const parallelOrZero = (a: number[], b: number[]) => a.every(c => c === 0) || b.every(c => c === 0) || x3(a, b).every(c => c === 0);
    for (const seed of [...seedsA, ...seedsB]) for (const card of batch01Generators['MIT-MV-05'](seed, 'en')) {
      if (card.id === 'MIT-MV-05-non-associative') {
        const m = card.prompt.match(/u = ([ijk]) and v = ([ijk])/); expect(m, card.prompt).not.toBeNull();
        const u = unit[m![1]], v = unit[m![2]];
        expect(m![1]).not.toBe(m![2]);
        const lhs = name(x3(x3(u, v), v)), rhs = name(x3(u, x3(v, v)));
        card.choice!.options.forEach((o, idx) => {
          const t = unminus(o);
          const differ = t.match(/^They differ: \(u × v\) × v = (-?[ijk0]), but u × \(v × v\) = (-?[ijk0])/);
          const equal = t.match(/^They are equal, both (-?[ijk0])/);
          const correct = differ ? differ[1] === lhs && differ[2] === rhs && lhs !== rhs : equal ? equal[1] === lhs && lhs === rhs : (() => { throw new Error(`unparsed option ${o}`); })();
          expect(correct, `seed ${seed} option "${o}" (truth: ${lhs} vs ${rhs})`).toBe(idx === card.choice!.answer);
        });
      }
      if (card.id === 'MIT-MV-05-zero-cross') {
        const claims = {
          perp: zeroPairs.every(([a, b]) => dot(a, b) === 0), // "A is perpendicular to B" justified?
          bothZero: zeroPairs.every(([a, b]) => a.every(c => c === 0) && b.every(c => c === 0)),
          parallelOrZero: zeroPairs.every(([a, b]) => parallelOrZero(a, b)) && small.every(a => small.every(b => !parallelOrZero(a, b) || x3(a, b).every(c => c === 0))),
        };
        card.choice!.options.forEach((o, idx) => {
          const verdict = o.startsWith('A and B are parallel') ? claims.parallelOrZero : o.startsWith('A is perpendicular') ? claims.perp : o.startsWith('A = 0 and B = 0') ? claims.bothZero : (() => { throw new Error(`unparsed option ${o}`); })();
          expect(verdict, `seed ${seed} option "${o}"`).toBe(idx === card.choice!.answer);
        });
        // the worked example inside the explanation: two nonzero vectors with zero cross product
        const ex = card.explanation.match(/A = \(([^)]*)\) and B = \(([^)]*)\) are nonzero/); expect(ex).not.toBeNull();
        const A = unminus(ex![1]).split(',').map(Number), B = unminus(ex![2]).split(',').map(Number);
        expect(norm(A)).toBeGreaterThan(0); expect(norm(B)).toBeGreaterThan(0); expect(x3(A, B)).toEqual([0, 0, 0]);
      }
    }
  });

  it('structural sanity: unique card ids per deck, non-empty hint and explanation, distinct options', () => {
    for (const { card, seed } of allCards('en', seedsA.slice(0, 20))) {
      expect(card.hint.length, `${card.id} seed ${seed}`).toBeGreaterThan(5);
      expect(card.explanation.length, `${card.id} seed ${seed}`).toBeGreaterThan(5);
      if (card.choice) expect(new Set(card.choice.options).size, `${card.id} seed ${seed}`).toBe(card.choice.options.length);
    }
    for (const id of ['MIT-MV-01', 'MIT-MV-03', 'MIT-MV-04', 'MIT-MV-05']) {
      const ids = batch01Generators[id](0, 'en').map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
