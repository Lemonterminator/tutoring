import { describe, expect, it } from 'vitest';
import { asVec, close, runOracle, type Oracle } from './oracle-harness';
import { batch02Generators } from './batch02';
import { spreadSeed } from './deck-invariants';
import type { CardGenerator, PracticeCard } from '../types';

/**
 * Independent oracles for MIT-MV-07 .. MIT-MV-11 (batch 02). Each recomputes the answer from the audit params by a route that
 * differs from the textbook formula: exact-fraction Gauss-Jordan elimination with rank tests and residual checks, two or three
 * determinant expansions, numerical minimisation for distances, bisection for line parameters, column-combination products, etc.
 * Matrices are flattened row-major (see audit-notes/batch02.md).
 */

// ---------- exact rational arithmetic and Gauss-Jordan elimination ----------
type Fr = readonly [number, number];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const F = (n: number, d = 1): Fr => {
  if (d === 0) throw new Error('zero denominator');
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return [n / g + 0, d / g];
};
const fsub = (a: Fr, b: Fr) => F(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fmul = (a: Fr, b: Fr) => F(a[0] * b[0], a[1] * b[1]);
const fdiv = (a: Fr, b: Fr) => F(a[0] * b[1], a[1] * b[0]);
const fzero = (a: Fr) => a[0] === 0;
const fnum = (a: Fr) => a[0] / a[1];

/** Reduced row echelon form over the rationals, pivoting only in the first `pivotCols` columns. */
function rref(input: number[][], pivotCols = input[0].length): { m: Fr[][]; pivots: number[] } {
  const m = input.map(r => r.map(v => F(v)));
  const pivots: number[] = [];
  let row = 0;
  for (let col = 0; col < pivotCols && row < m.length; col++) {
    let p = row;
    while (p < m.length && fzero(m[p][col])) p++;
    if (p === m.length) continue;
    [m[row], m[p]] = [m[p], m[row]];
    const pv = m[row][col];
    m[row] = m[row].map(v => fdiv(v, pv));
    for (let r = 0; r < m.length; r++) {
      if (r !== row && !fzero(m[r][col])) {
        const f = m[r][col];
        m[r] = m[r].map((v, k) => fsub(v, fmul(f, m[row][k])));
      }
    }
    pivots.push(col);
    row++;
  }
  return { m, pivots };
}
const rankOf = (A: number[][]) => rref(A).pivots.length;
const aug = (A: number[][], b: number[]) => A.map((row, i) => [...row, b[i]]);
/** none / one / many by comparing rank A with rank [A | b] (and the number of unknowns). */
function classify(A: number[][], b: number[]): 'none' | 'one' | 'many' {
  const r = rankOf(A), ra = rankOf(aug(A, b));
  if (r < ra) return 'none';
  return r === A[0].length ? 'one' : 'many';
}
const rows = (flat: number[], r: number, c: number): number[][] => Array.from({ length: r }, (_, i) => flat.slice(i * c, (i + 1) * c));
const matVec = (A: number[][], x: number[]) => A.map(row => row.reduce((s, v, k) => s + v * x[k], 0));
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.hypot(...a);
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
const scale = (a: number[], k: number) => a.map(x => x * k);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Solve a square system by Gauss-Jordan; asserts a unique solution and a zero residual. */
function solveSquare(A: number[][], b: number[]): number[] {
  const { m, pivots } = rref(aug(A, b), A.length);
  expect(pivots, 'system must have a unique solution').toEqual(A.map((_, i) => i));
  const x = m.map(r => fnum(r[A.length]));
  const residual = matVec(A, x).map((v, i) => v - b[i]);
  residual.forEach(r => expect(Math.abs(r)).toBeLessThan(1e-9));
  return x;
}
/** The inverse found by solving A X = I (Gauss-Jordan on [A | I]), then verified exactly: A X = I and X A = I. */
function inverseByElimination(A: number[][]): Fr[][] {
  const n = A.length;
  const I = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  const { m, pivots } = rref(A.map((row, i) => [...row, ...I[i]]), n);
  expect(pivots).toEqual(A.map((_, i) => i));
  const X = m.map(r => r.slice(n));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let left: Fr = F(0), right: Fr = F(0);
    for (let k = 0; k < n; k++) {
      left = fsub(left, fmul(F(-A[i][k]), X[k][j]));   // sum A_ik X_kj
      right = fsub(right, fmul(X[i][k], F(-A[k][j]))); // sum X_ik A_kj
    }
    expect(fnum(left), `A X = I at ${i},${j}`).toBe(i === j ? 1 : 0);
    expect(fnum(right), `X A = I at ${i},${j}`).toBe(i === j ? 1 : 0);
  }
  return X;
}
// ---------- determinants by several routes ----------
const minor = (A: number[][], i: number, j: number) => A.filter((_, r) => r !== i).map(row => row.filter((_, c) => c !== j));
const detByRow = (A: number[][], r: number): number => (A.length === 1 ? A[0][0] : A[0].reduce((s, _, c) => s + (-1) ** (r + c) * A[r][c] * detByRow(minor(A, r, c), 0), 0));
const detByCol = (A: number[][], c: number): number => (A.length === 1 ? A[0][0] : A.reduce((s, _, r) => s + (-1) ** (r + c) * A[r][c] * detByCol(minor(A, r, c), 0), 0));
function detByElimination(A: number[][]): number {
  const m = A.map(r => r.map(v => F(v)));
  let det: Fr = F(1);
  for (let col = 0; col < m.length; col++) {
    let p = col;
    while (p < m.length && fzero(m[p][col])) p++;
    if (p === m.length) return 0;
    if (p !== col) { [m[col], m[p]] = [m[p], m[col]]; det = fmul(det, F(-1)); }
    det = fmul(det, m[col][col]);
    for (let r = col + 1; r < m.length; r++) {
      const f = fdiv(m[r][col], m[col][col]);
      m[r] = m[r].map((v, k) => fsub(v, fmul(f, m[col][k])));
    }
  }
  return fnum(det);
}
/** Determinant by two different cofactor expansions plus elimination; they must agree. */
function det(A: number[][]): number {
  const n = A.length;
  const a = detByRow(A, n - 1), b = detByCol(A, 1), c = detByElimination(A);
  expect(close(a, b, 1e-12), 'row expansion vs column expansion').toBe(true);
  expect(close(a, c, 1e-12), 'cofactor expansion vs elimination').toBe(true);
  return a;
}

// ---------- numeric helpers ----------
function ternaryArgmin(f: (x: number) => number, lo: number, hi: number, iterations = 110): number {
  for (let i = 0; i < iterations; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (f(m1) < f(m2)) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}
/** Distance from P to the plane n.X = d by minimising |X - P| over a two-parameter parametrisation of the plane. */
function distanceToPlaneNumeric(n: number[], d: number, P: number[]): number {
  const nn = dot(n, n);
  const X0 = scale(n, d / nn);
  const smallest = [0, 1, 2].sort((i, j) => Math.abs(n[i]) - Math.abs(n[j]))[0];
  const axis = [0, 0, 0]; axis[smallest] = 1;
  const u = scale(cross(n, axis), 1 / norm(cross(n, axis)));
  const w = scale(cross(n, u), 1 / norm(cross(n, u)));
  const g = (s: number, t: number) => norm(sub(add(add(X0, scale(u, s)), scale(w, t)), P));
  const R = 300;
  const inner = (s: number) => { const t = ternaryArgmin(tt => g(s, tt), -R, R); return g(s, t); };
  const s = ternaryArgmin(inner, -R, R);
  return inner(s);
}
/** Bisection for the root of a monotone function. */
function bisect(f: (t: number) => number, lo = -1000, hi = 1000): number {
  const fl = f(lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    (f(mid) * fl <= 0) ? (hi = mid) : (lo = mid);
  }
  return (lo + hi) / 2;
}
const numbersInText = (text: string) => (text.replaceAll('−', '-').match(/-?\d+/g) ?? []).map(Number);

// ---------- oracles ----------
const oracles07 = {
  'MIT-MV-07:defined': p => {
    const { am, an, bm, bn } = p as Record<string, number>;
    const ab = an === bm, ba = bn === am;
    return { optionIsCorrect: text => (ab && ba ? text.startsWith('Both AB and BA') : ab ? text.startsWith('Only AB is defined') : ba ? text.startsWith('Only BA is defined') : text.startsWith('Neither AB nor BA')) };
  },
  'MIT-MV-07:matvec': p => {
    // A x as the combination x1 c1 + x2 c2 + x3 c3 of the columns (not row dot products).
    const A = rows(asVec(p.a), 3, 3), x = asVec(p.x);
    const out = [0, 0, 0];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out[i] += x[j] * A[i][j];
    expect(out).toEqual(matVec(A, x).map(v => v + 0));
    return out;
  },
  'MIT-MV-07:entry': p => {
    // Row i of AB is the combination sum_k A[i][k] * (row k of B); then take entry j.
    const A = rows(asVec(p.a), 2, 3), B = rows(asVec(p.b), 3, 2);
    const i = (p.i as number) - 1, j = (p.j as number) - 1;
    const rowI = [0, 0];
    for (let k = 0; k < 3; k++) for (let c = 0; c < 2; c++) rowI[c] += A[i][k] * B[k][c];
    return [rowI[j]];
  },
  'MIT-MV-07:product2': p => {
    // Column j of AB = A (column j of B), written as a combination of the columns of A; verified on a test vector (AB) v = A (B v).
    const A = rows(asVec(p.a), 2, 2), B = rows(asVec(p.b), 2, 2);
    const AB = [[0, 0], [0, 0]];
    for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (let i = 0; i < 2; i++) AB[i][j] += B[k][j] * A[i][k];
    for (const v of [[1, 0], [0, 1], [3, -7]]) expect(matVec(AB, v)).toEqual(matVec(A, matVec(B, v)));
    return [AB[0][0], AB[0][1], AB[1][0], AB[1][1]];
  },
  'MIT-MV-07:noncommute': p => {
    const A = rows(asVec(p.a), 2, 2), B = rows(asVec(p.b), 2, 2);
    const prod = (X: number[][], Y: number[][]) => X.map((_, i) => Y[0].map((__, j) => X[i][0] * Y[0][j] + X[i][1] * Y[1][j]));
    const AB = prod(A, B), BA = prod(B, A);
    const equal = AB.every((r, i) => r.every((v, j) => v === BA[i][j]));
    return { optionIsCorrect: text => (text === 'AB = BA' ? equal : text === 'AB ≠ BA' ? !equal : false) };
  },
  'MIT-MV-07:column': p => {
    // u is right iff A u = c_j for several unrelated test matrices (a necessary and, with generic matrices, sufficient test).
    const j = (p.j as number) - 1;
    const tests = [
      [[2, 5, -3], [7, -1, 4], [3, 8, 6]], [[1, 2, 3], [4, 5, 6], [7, 8, 10]], [[0, 1, -2], [3, -4, 5], [-6, 7, 9]], [[5, -2, 11], [13, 3, -7], [2, 17, 1]],
    ];
    return {
      optionIsCorrect: text => {
        const u = numbersInText(text.split('=')[1] ?? text);
        expect(u.length, text).toBe(3);
        return tests.every(A => matVec(A, u).every((v, i) => v === A[i][j]));
      },
    };
  },
  'MIT-MV-07:meaning': p => {
    // Shoelace area of the parallelogram with vertices 0, Ai, Ai+Aj, Aj.
    const A = rows(asVec(p.a), 2, 2);
    const Ai = [A[0][0], A[1][0]], Aj = [A[0][1], A[1][1]];
    const V = [[0, 0], Ai, add(Ai, Aj), Aj];
    let twice = 0;
    for (let k = 0; k < 4; k++) { const [x1, y1] = V[k], [x2, y2] = V[(k + 1) % 4]; twice += x1 * y2 - x2 * y1; }
    expect(Math.abs(twice) / 2).not.toBe(0);
    return [Math.abs(twice) / 2];
  },
  'MIT-MV-07:det-product': p => {
    const A = rows(asVec(p.a), 2, 2), B = rows(asVec(p.b), 2, 2);
    const AB = A.map((_, i) => B[0].map((__, j) => A[i][0] * B[0][j] + A[i][1] * B[1][j]));
    expect(det(AB)).toBe(det(A) * det(B));
    return [det(AB)];
  },
  'MIT-MV-07:challenge': p => {
    const A = rows(asVec(p.a), 2, 3), B = rows(asVec(p.b), 3, 2), x = asVec(p.x);
    const stepwise = matVec(A, matVec(B, x));
    const AB = A.map((_, i) => [0, 1].map(j => A[i].reduce((s, v, k) => s + v * B[k][j], 0)));
    expect(matVec(AB, x)).toEqual(stepwise);
    return stepwise.map(v => v + 0);
  },
} satisfies Record<string, Oracle>;

const oracles08 = {
  'MIT-MV-08:inverse2': p => {
    const A = rows(asVec(p.a), 2, 2);
    const X = inverseByElimination(A);
    return X.flat().map(fnum);
  },
  'MIT-MV-08:exists': p => {
    const A = rows(asVec(p.a), 2, 2);
    const invertible = rankOf(A) === 2;
    expect(invertible).toBe(det(A) !== 0);
    return { optionIsCorrect: text => (invertible ? text.startsWith('A⁻¹ exists, because |A| ≠ 0') : text.startsWith('A⁻¹ does not exist, because |A| = 0')) };
  },
  'MIT-MV-08:solve-inverse': p => {
    const A = rows(asVec(p.a), 2, 2), b = asVec(p.b);
    expect(Math.abs(det(A))).toBe(1);
    return solveSquare(A, b);
  },
  'MIT-MV-08:det3': p => det(rows(asVec(p.a), 3, 3)) + 0 === 0 ? [0] : [det(rows(asVec(p.a), 3, 3))],
  'MIT-MV-08:inverse-entry': p => {
    const A = rows(asVec(p.a), 3, 3);
    const X = inverseByElimination(A);
    const i = (p.i as number) - 1, j = (p.j as number) - 1;
    // cross-check against the adjugate formula, using the cofactor of the entry in row j, column i
    expect(fnum(X[i][j])).toBeCloseTo((-1) ** (i + j) * detByElimination(minor(A, j, i)) / det(A), 12);
    return [fnum(X[i][j])];
  },
  'MIT-MV-08:det-inverse': p => {
    // Build a concrete matrix diag(k, 1, 1) (det k), invert it by elimination and take the determinant of the inverse.
    const k = p.k as number;
    const A = [[k, 0, 0], [0, 1, 0], [0, 0, 1]];
    const X = inverseByElimination(A).map(r => r.map(fnum));
    expect(det(A)).toBe(k);
    return [det(X)];
  },
  'MIT-MV-08:challenge': p => {
    const A = rows(asVec(p.a), 2, 2), b = asVec(p.b);
    expect(Math.abs(det(A))).toBeGreaterThanOrEqual(2);
    return solveSquare(A, b);
  },
} satisfies Record<string, Oracle>;

const oracles09 = {
  'MIT-MV-09:intercept': p => {
    // Plane through the three intercept points, via its normal (B-A) x (C-A); then solve N.(X-A) = 0 for z.
    const { a, b, c, x, y } = p as Record<string, number>;
    const A = [a, 0, 0], B = [0, b, 0], C = [0, 0, c];
    const N = cross(sub(B, A), sub(C, A));
    expect(N.every(v => v === 0)).toBe(false);
    const z = (dot(N, A) - N[0] * x - N[1] * y) / N[2];
    for (const point of [A, B, C, [x, y, z]]) expect(close(dot(N, point), dot(N, A), 1e-12)).toBe(true);
    return [z];
  },
  'MIT-MV-09:line-normal': p => {
    const P1 = asVec(p.p1), P2 = asVec(p.p2);
    const v = sub(P2, P1);
    // Solve for (N1, N2) from N.v = 0 and the stated orientation (N rotates v by +90 degrees): N = R v.
    const N = [0 * v[0] - 1 * v[1], 1 * v[0] + 0 * v[1]];
    const c = dot(N, P1);
    expect(dot(N, v)).toBe(0);
    expect(dot(N, P2)).toBe(c);
    return [N[0] + 0, N[1] + 0, c + 0];
  },
  'MIT-MV-09:plane-distance': p => {
    const n = asVec(p.n), P = asVec(p.p), d = p.d as number;
    expect(Number.isInteger(norm(n))).toBe(true);
    return [distanceToPlaneNumeric(n, d, P)];
  },
  'MIT-MV-09:parallel-planes': p => {
    const n = asVec(p.n), n2 = asVec(p.n2), d = p.d as number, e = p.e as number;
    expect(cross(n, n2).every(v => v === 0)).toBe(true);
    const k = n2.find((v, i) => n[i] !== 0)! / n[n.findIndex(v => v !== 0)];
    expect(Number.isInteger(k) && k !== 0).toBe(true);
    expect(n2.every((v, i) => v === k * n[i])).toBe(true);
    expect(close(e, k * d)).toBe(false); // different planes
    // Distance from two different points of plane 1 to plane 2 must agree.
    const X0 = scale(n, d / dot(n, n));
    const axis = [0, 0, 0]; axis[[0, 1, 2].sort((i, j) => Math.abs(n[i]) - Math.abs(n[j]))[0]] = 1;
    const inPlane = cross(n, axis);
    const d1 = distanceToPlaneNumeric(n2, e, X0), d2 = distanceToPlaneNumeric(n2, e, add(X0, scale(inPlane, 2.5)));
    expect(close(d1, d2, 1e-7)).toBe(true);
    return [d1];
  },
  'MIT-MV-09:count-2x2': p => {
    const { a, b, c, d, e, f } = p as Record<string, number>;
    const kind = classify([[a, b], [c, d]], [e, f]);
    return { optionIsCorrect: text => (kind === 'one' ? text.startsWith('Exactly one solution') : kind === 'none' ? text.startsWith('No solution') : text.startsWith('Infinitely many solutions')) };
  },
  'MIT-MV-09:three-planes': p => {
    const A = rows(asVec(p.a), 3, 3), d = asVec(p.d);
    const r = rankOf(A), ra = rankOf(aug(A, d));
    const verdict = r < ra ? 'none' : r === 3 ? 'point' : r === 2 ? 'line' : 'plane';
    if (verdict === 'point') solveSquare(A, d);
    return { optionIsCorrect: text => (verdict === 'point' ? text.startsWith('In exactly one point') : verdict === 'line' ? text.startsWith('In a line') : verdict === 'plane' ? text.startsWith('In a whole plane') : text.startsWith('There is no point on all three planes')) };
  },
  'MIT-MV-09:challenge': p => {
    // Minimise |P1 + t v - P| over t.
    const P1 = asVec(p.p1), P2 = asVec(p.p2), P = asVec(p.p);
    const v = sub(P2, P1);
    expect(Number.isInteger(Math.hypot(...v))).toBe(true);
    const f = (t: number) => Math.hypot(P1[0] + t * v[0] - P[0], P1[1] + t * v[1] - P[1]);
    const t = ternaryArgmin(f, -200, 200, 200);
    return [f(t)];
  },
} satisfies Record<string, Oracle>;

/** Homogeneous solution with x = 1 from the RREF of a rank-2 3x3 system; asserts the free variable gives a first component that can be scaled to 1. */
function nullVectorWithXOne(A: number[][]): number[] {
  const { m, pivots } = rref(A);
  expect(pivots.length, 'rank must be 2').toBe(2);
  const free = [0, 1, 2].find(c => !pivots.includes(c))!;
  const v = [0, 0, 0].map(() => F(0));
  v[free] = F(1);
  pivots.forEach((pc, r) => { v[pc] = fsub(F(0), m[r][free]); });
  expect(fzero(v[0]), 'solution must have non-zero first component').toBe(false);
  const out = v.map(c => fnum(fdiv(c, v[0])));
  expect(matVec(A, out).map(Math.abs).every(r => r < 1e-9)).toBe(true);
  return out;
}
const oracles10 = {
  'MIT-MV-10:unique': p => {
    const A = rows(asVec(p.a), 3, 3), b = asVec(p.b);
    const d = det(A);
    expect(Math.abs(d)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(d)).toBeLessThanOrEqual(4);
    const x = solveSquare(A, b);
    x.forEach(v => expect(Number.isInteger(v)).toBe(true));
    return x.map(v => v + 0);
  },
  'MIT-MV-10:critical-c': p => {
    // det(c) is linear in c: find the root from two evaluations, then check det(root) = 0 and det(root + 1) != 0.
    const r1 = asVec(p.r1), r2 = asVec(p.r2), u = asVec(p.u);
    const D = (c: number) => det([r1, r2, [u[0], u[1], c]]);
    const d0 = D(0), d1 = D(1);
    expect(d1 - d0).not.toBe(0);
    const c = -d0 / (d1 - d0);
    expect(Math.abs(D(c))).toBeLessThan(1e-9);
    expect(rankOf([r1, r2, [u[0], u[1], c]])).toBeLessThan(3);
    expect(Math.abs(D(c + 1))).toBeGreaterThan(0);
    return [c + 0];
  },
  'MIT-MV-10:homogeneous': p => {
    const A = rows(asVec(p.a), 3, 3);
    const trivialOnly = rankOf(A) === 3;
    expect(trivialOnly).toBe(det(A) !== 0);
    return { optionIsCorrect: text => (trivialOnly ? text.startsWith('Only the trivial solution') : text.startsWith('There are non-zero solutions')) };
  },
  'MIT-MV-10:null-vector': p => {
    const A = rows(asVec(p.a), 3, 3);
    expect(det(A)).toBe(0);
    const v = nullVectorWithXOne(A);
    return [v[1] + 0, v[2] + 0];
  },
  'MIT-MV-10:count-solutions': p => {
    const A = rows(asVec(p.a), 3, 3), b = asVec(p.b);
    const kind = classify(A, b);
    expect(kind === 'one').toBe(det(A) !== 0);
    return { optionIsCorrect: text => (kind === 'one' ? text.startsWith('Exactly one solution') : kind === 'none' ? text.startsWith('No solution') : text.startsWith('Infinitely many solutions')) };
  },
  'MIT-MV-10:consistent-value': p => {
    // A left null vector y (y A = 0) is the cross product of two independent columns of A; consistency needs y . (b1, b2, beta) = 0.
    const flat = asVec(p.a), A = rows(flat, 3, 3), b = asVec(p.b);
    expect(rankOf(A)).toBe(2);
    const col = (j: number) => A.map(r => r[j]);
    let y: number[] | undefined;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { const c = cross(col(i), col(j)); if (c.some(v => v !== 0)) { y = c; break; } }
    expect(y).toBeDefined();
    for (let j = 0; j < 3; j++) expect(dot(y!, col(j))).toBe(0);
    expect(y![2]).not.toBe(0);
    const beta = -(y![0] * b[0] + y![1] * b[1]) / y![2];
    // Confirm by ranks: consistent at beta, inconsistent at beta + 1.
    expect(classify(A, [b[0], b[1], beta])).not.toBe('none');
    expect(classify(A, [b[0], b[1], beta + 1])).toBe('none');
    return [beta + 0];
  },
  'MIT-MV-10:challenge': p => {
    const r1 = asVec(p.r1), r2 = asVec(p.r2), u = asVec(p.u);
    const D = (c: number) => det([r1, r2, [u[0], u[1], c]]);
    const d0 = D(0), d1 = D(1);
    const c = -d0 / (d1 - d0);
    const v = nullVectorWithXOne([r1, r2, [u[0], u[1], c]]);
    return [c + 0, v[1] + 0, v[2] + 0];
  },
} satisfies Record<string, Oracle>;

const oracles11 = {
  'MIT-MV-11:on-line': p => {
    const P0 = asVec(p.p0), v = asVec(p.v), x = p.x as number;
    expect(v[0]).not.toBe(0);
    const t = bisect(s => P0[0] + s * v[0] - x);
    return [P0[1] + t * v[1]];
  },
  'MIT-MV-11:two-points': p => {
    // Barycentric form (1 - t) P0 + t P1; the result must be collinear with P0, P1.
    const P0 = asVec(p.p0), P1 = asVec(p.p1), t = p.t as number;
    const Q = P0.map((v, i) => (1 - t) * v + t * P1[i]);
    expect(cross(sub(Q, P0), sub(P1, P0)).every(v => v === 0)).toBe(true);
    return Q;
  },
  'MIT-MV-11:same-line': p => {
    const P0 = asVec(p.p0), v = asVec(p.v);
    return {
      optionIsCorrect: text => {
        const nums = numbersInText(text);
        expect(nums.length, text).toBe(6);
        const Q = nums.slice(0, 3), w = nums.slice(3);
        // Rank route: Q - P0 parallel to v and w parallel to v (both rank-1 stacks); w must be non-zero.
        const qOn = rankOf([sub(Q, P0), v]) === 1;
        const wPar = w.some(c => c !== 0) && rankOf([w, v]) === 1;
        // Cross-product route must agree.
        expect(cross(sub(Q, P0), v).every(c => c === 0)).toBe(qOn);
        expect(cross(w, v).every(c => c === 0) && w.some(c => c !== 0)).toBe(wPar);
        return qOn && wPar;
      },
    };
  },
  'MIT-MV-11:meets-plane': p => {
    const P0 = asVec(p.p0), v = asVec(p.v), n = asVec(p.n), d = p.d as number;
    expect(dot(n, v)).not.toBe(0);
    const t = bisect(s => dot(n, add(P0, scale(v, s))) - d);
    const X = add(P0, scale(v, t));
    expect(Math.abs(dot(n, X) - d)).toBeLessThan(1e-8);
    return [t, ...X];
  },
  'MIT-MV-11:relationship': p => {
    const P0 = asVec(p.p0), v = asVec(p.v), n = asVec(p.n), d = p.d as number;
    const f = (t: number) => dot(n, add(P0, scale(v, t))) - d;
    const nonConstant = f(0) !== f(1) || f(1) !== f(2);
    const lies = !nonConstant && f(0) === 0;
    return { optionIsCorrect: text => (nonConstant ? text.startsWith('It meets the plane in exactly one point') : lies ? text.startsWith('It lies in the plane') : text.startsWith('It is parallel to the plane')) };
  },
  'MIT-MV-11:two-planes': p => {
    const n1 = asVec(p.n1), n2 = asVec(p.n2);
    // Null space of [n1; n2] by RREF gives the line direction up to scale; its scale and sign are fixed by Lagrange's identity and det[n1; n2; v] = |v|^2 > 0.
    const { m, pivots } = rref([n1, n2]);
    expect(pivots.length).toBe(2);
    const free = [0, 1, 2].find(c => !pivots.includes(c))!;
    const dir = [F(0), F(0), F(0)];
    dir[free] = F(1);
    pivots.forEach((pc, r) => { dir[pc] = fsub(F(0), m[r][free]); });
    const direction = dir.map(fnum);
    const lagrange = dot(n1, n1) * dot(n2, n2) - dot(n1, n2) ** 2;
    const factor = Math.sqrt(lagrange / dot(direction, direction));
    let v = scale(direction, factor);
    if (det([n1, n2, v]) < 0) v = scale(v, -1);
    expect(close(dot(v, v), lagrange, 1e-9)).toBe(true);
    expect(Math.abs(dot(v, n1))).toBeLessThan(1e-9);
    expect(Math.abs(dot(v, n2))).toBeLessThan(1e-9);
    expect(det([n1, n2, v])).toBeGreaterThan(0);
    return v.map(c => Math.round(c * 1e9) / 1e9 + 0);
  },
  'MIT-MV-11:challenge': p => {
    // Solve A + t (B - A) = s P + u Q (the plane through O spanned by P and Q) as a 3x3 linear system in (t, s, u).
    const A = asVec(p.a), B = asVec(p.b), P = asVec(p.p), Q = asVec(p.q);
    const v = sub(B, A);
    const M = [0, 1, 2].map(i => [v[i], -P[i], -Q[i]]);
    const [t, s, u] = solveSquare(M, A.map(c => -c));
    const X = add(A, scale(v, t));
    X.forEach((c, i) => expect(Math.abs(c - (s * P[i] + u * Q[i]))).toBeLessThan(1e-9));
    expect(Math.abs(dot(cross(P, Q), X))).toBeLessThan(1e-9);
    return X;
  },
} satisfies Record<string, Oracle>;

const spread = (generate: CardGenerator): CardGenerator => (seed, lang) => generate(spreadSeed(seed), lang);

const expectedKinds = (id: string, kinds: string[]) => kinds.map(k => `${id}:${k}`).sort();
function runBoth(id: string, oracles: Record<string, Oracle>, kinds: string[]) {
  const generate = batch02Generators[id];
  // Sequential seeds 0..199 (harness default) and well-spread 32-bit seeds (the shared LCG is nearly constant on small sequential seeds).
  const plain = runOracle(id, generate, oracles);
  const wide = runOracle(id, spread(generate), oracles);
  expect(Object.keys(plain).sort()).toEqual(expectedKinds(id, kinds));
  expect(Object.keys(wide).sort()).toEqual(expectedKinds(id, kinds));
  for (const kind of kinds) {
    expect(wide[`${id}:${kind}`], `${kind} count`).toBe(200);
  }
}

describe('batch02 independent oracles (MIT-MV-07 .. 11)', () => {
  it('MIT-MV-07 matrix multiplication', () => {
    runBoth('MIT-MV-07', oracles07, ['defined', 'matvec', 'entry', 'product2', 'noncommute', 'column', 'meaning', 'det-product', 'challenge']);
  });
  it('MIT-MV-08 matrix inverses', () => {
    runBoth('MIT-MV-08', oracles08, ['inverse2', 'exists', 'solve-inverse', 'det3', 'inverse-entry', 'det-inverse', 'challenge']);
  });
  it('MIT-MV-09 planes and linear systems', () => {
    runBoth('MIT-MV-09', oracles09, ['intercept', 'line-normal', 'plane-distance', 'parallel-planes', 'count-2x2', 'three-planes', 'challenge']);
  }, 60000);
  it('MIT-MV-10 square systems', () => {
    runBoth('MIT-MV-10', oracles10, ['unique', 'critical-c', 'homogeneous', 'null-vector', 'count-solutions', 'consistent-value', 'challenge']);
  });
  it('MIT-MV-11 lines and line-plane intersection', () => {
    runBoth('MIT-MV-11', oracles11, ['on-line', 'two-points', 'same-line', 'meets-plane', 'relationship', 'two-planes', 'challenge']);
  });
});

// ---------- checks on printed card text (derived values that are not audit params) ----------
const parseMatrixLine = (line: string, name: string): number[][] | null => {
  const m = line.replaceAll('−', '-').match(new RegExp(`^${name} = \\[(.*)\\]$`));
  return m ? m[1].split(';').map(r => r.trim().split(/\s+/).map(Number)) : null;
};
const cards = (id: string, seed: number): PracticeCard[] => batch02Generators[id](spreadSeed(seed), 'en');

describe('batch02 printed text agrees with the mathematics', () => {
  it('MIT-MV-08 solve-inverse: the printed M really is A⁻¹, and 3x3 inverse-entry prints the true |A|', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const card of cards('MIT-MV-08', seed)) {
        if (card.audit?.kind === 'MIT-MV-08:solve-inverse') {
          const A = rows(asVec(card.audit.params.a), 2, 2);
          const M = card.lines!.map(l => parseMatrixLine(l, 'M')).find(Boolean)!;
          const X = inverseByElimination(A).map(r => r.map(fnum));
          expect(M, `${card.id} seed ${seed}`).toEqual(X);
        }
        if (card.audit?.kind === 'MIT-MV-08:inverse-entry') {
          const A = rows(asVec(card.audit.params.a), 3, 3);
          const printed = numbersInText(card.prompt.match(/\|A\| = (−?\d+)/)![0].replace('|A| = ', ''))[0];
          expect(printed, `${card.id} seed ${seed}`).toBe(det(A));
        }
        if (card.audit?.kind === 'MIT-MV-08:det-inverse') {
          expect(numbersInText(card.prompt.match(/\|A\| = (−?\d+)/)![0].replace('|A| = ', ''))[0]).toBe(card.audit.params.k);
        }
      }
    }
  });

  it('every audited parameter appears in the visible question (no hidden inputs), ignoring 0 and 1', () => {
    for (const id of Object.keys(batch02Generators)) {
      for (let seed = 0; seed < 200; seed++) {
        for (const card of cards(id, seed)) {
          if (!card.audit) continue;
          const visible = [card.prompt, ...(card.lines ?? []), ...(card.choice?.options ?? []), ...(card.fields?.map(f => f.label) ?? []), card.figure?.alt ?? '']
            .join(' ').replaceAll('−', '-');
          const available = (visible.match(/\d+/g) ?? []).map(Number);
          const needed = Object.entries(card.audit.params).flatMap(([, value]) => [value].flat()).map(Math.abs).filter(v => v > 1);
          const pool = [...available];
          for (const n of needed) {
            const at = pool.indexOf(n);
            expect(at, `${card.id} seed ${seed}: audit value ${n} of ${JSON.stringify(card.audit.params)} not visible in the question`).toBeGreaterThanOrEqual(0);
            pool.splice(at, 1);
          }
        }
      }
    }
  });
});
