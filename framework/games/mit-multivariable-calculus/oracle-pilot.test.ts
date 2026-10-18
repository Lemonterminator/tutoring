import { describe, expect, it } from 'vitest';
import { asVec, close, runOracle, type Oracle } from './oracle-harness';
import { pilotGenerators } from './pilot';

/** Coordinator-written pilot oracles: they show the pattern. Each recomputes the answer from the audit params by a different route. */
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.hypot(...a);
const crossViaMinors = (a: number[], b: number[]) => [
  a[1] * b[2] - b[1] * a[2], -(a[0] * b[2] - b[0] * a[2]), a[0] * b[1] - b[0] * a[1],
];

describe('pilot oracles (MIT-MV-02, 06, 17)', () => {
  it('MIT-MV-02 dot products, lengths and angles', () => {
    const counts = runOracle('MIT-MV-02', pilotGenerators['MIT-MV-02'], {
      'MIT-MV-02:dot': p => [dot(asVec(p.a), asVec(p.b))],
      'MIT-MV-02:length': p => [norm(asVec(p.a))],
      'MIT-MV-02:perpendicular': p => {
        // Solve (x, y, c) · (p, q, r) = 0 by bisection on c instead of the closed form, then check the residual.
        const { x, y, p: bp, q, r } = p as Record<string, number>;
        let lo = -1000, hi = 1000;
        const f = (c: number) => x * bp + y * q + c * r;
        for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; (f(mid) * f(lo) <= 0) ? (hi = mid) : (lo = mid); }
        return [Math.round((lo + hi) / 2 * 1e6) / 1e6];
      },
      'MIT-MV-02:angle': p => {
        const a = asVec(p.a), b = asVec(p.b);
        const sinSquared = dot(crossViaMinors(a, b), crossViaMinors(a, b)) / (dot(a, a) * dot(b, b)); // Lagrange identity
        const cos = Math.sign(dot(a, b)) * Math.sqrt(Math.max(0, 1 - sinSquared));
        expect(norm(a)).toBeCloseTo(p.la as number, 9);
        expect(norm(b)).toBeCloseTo(p.lb as number, 9);
        return [cos];
      },
      'MIT-MV-02:sign': p => {
        const d = dot(asVec(p.a), asVec(p.b));
        return { optionIsCorrect: text => (d > 0 ? text.startsWith('Positive') : d === 0 ? text.startsWith('Zero') : text.startsWith('Negative')) };
      },
      'MIT-MV-02:challenge': p => {
        const a = asVec(p.a), b = asVec(p.b);
        return [dot(a, b) / (norm(a) * norm(b))];
      },
    } satisfies Record<string, Oracle>);
    expect(Object.keys(counts).sort()).toEqual(['MIT-MV-02:angle', 'MIT-MV-02:challenge', 'MIT-MV-02:dot', 'MIT-MV-02:length', 'MIT-MV-02:perpendicular', 'MIT-MV-02:sign']);
  });

  it('MIT-MV-06 planes', () => {
    runOracle('MIT-MV-06', pilotGenerators['MIT-MV-06'], {
      'MIT-MV-06:from-normal': p => [dot(asVec(p.n), asVec(p.p0))],
      'MIT-MV-06:point-on-plane': p => {
        const { a, b, c, d, x, y } = p as Record<string, number>;
        const z = (d - a * x - b * y) / c;
        expect(close(a * x + b * y + c * z, d)).toBe(true);
        return [z];
      },
      'MIT-MV-06:three-point-normal': p => {
        const [P, Q, R] = [asVec(p.p), asVec(p.q), asVec(p.r)];
        const u = Q.map((v, i) => v - P[i]), w = R.map((v, i) => v - P[i]);
        const N = crossViaMinors(u, w);
        // Lagrange identity and orthogonality guard the cross product.
        expect(close(dot(N, N), dot(u, u) * dot(w, w) - dot(u, w) ** 2)).toBe(true);
        expect(dot(N, u)).toBe(0); expect(dot(N, w)).toBe(0);
        return N;
      },
      'MIT-MV-06:three-point-d': p => [dot(asVec(p.n), asVec(p.p))],
      'MIT-MV-06:challenge': p => {
        const [P, Q, R] = [asVec(p.p), asVec(p.q), asVec(p.r)];
        const N = crossViaMinors(Q.map((v, i) => v - P[i]), R.map((v, i) => v - P[i]));
        for (const point of [P, Q, R]) expect(dot(N, point)).toBe(dot(N, P));
        return [...N, dot(N, P)];
      },
      'MIT-MV-06:two-planes': p => {
        const n1 = [p.a, p.b, p.c] as number[], n2 = [p.a2, p.b2, p.c2] as number[];
        const parallel = crossViaMinors(n1, n2).every(v => v === 0);
        const k = dot(n2, n1) / dot(n1, n1);
        const same = parallel && close(p.d2 as number, k * (p.d as number));
        return { optionIsCorrect: text => (!parallel ? text.startsWith('They meet') : same ? text.startsWith('They are the same') : text.startsWith('They are parallel')) };
      },
    } satisfies Record<string, Oracle>);
  });

  it('MIT-MV-17 functions of two variables', () => {
    runOracle('MIT-MV-17', pilotGenerators['MIT-MV-17'], {
      'MIT-MV-17:evaluate': p => { const { a, b, c, x, y } = p as Record<string, number>; return [a * x * x - b * y + c]; },
      'MIT-MV-17:level-through': p => { const { k, x, y } = p as Record<string, number>; return [x * x + k * y * y]; },
      'MIT-MV-17:slice': p => {
        // Minimise x² + a y0² over x by ternary search.
        const { a, y } = p as Record<string, number>;
        let lo = -50, hi = 50;
        const f = (x: number) => x * x + a * y * y;
        for (let i = 0; i < 200; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; f(m1) < f(m2) ? (hi = m2) : (lo = m1); }
        return [Math.round(f((lo + hi) / 2) * 1e6) / 1e6];
      },
      'MIT-MV-17:challenge': p => {
        const { x0, y0, x1 } = p as Record<string, number>;
        const y1 = x0 * y0 / x1;
        expect(close(x1 * y1, x0 * y0)).toBe(true);
        return [y1];
      },
    } satisfies Record<string, Oracle>);
  });
});
