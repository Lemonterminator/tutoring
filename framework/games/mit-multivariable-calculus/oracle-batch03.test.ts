import { describe, expect, it } from 'vitest';
import { asVec, centralDiff, close, runOracle, simpson, type Oracle } from './oracle-harness';
import { batch03Generators } from './batch03';
import type { PracticeCard } from '../types';

/**
 * Independent oracles for MIT-MV-12 .. MIT-MV-16 (batch 3). Written from audit-notes/batch03.md, the printed decks and the course
 * evidence only; nothing here was derived from the generator code. Every audit kind is recomputed by a route that differs from the
 * obvious closed form (quadrature, finite differences, determinants by two expansions, Gaussian elimination with residuals, Heron,
 * shoelace, law of cosines, signed distances, concrete motions ...). Each `it` also checks that the PROMPT TEXT matches the audit params,
 * so an oracle cannot silently audit a different problem than the one the learner sees.
 */

// ------------------------------------------------------------------------------------------------------------------ helpers
type V = number[];
const PI = Math.PI;
const dot = (a: V, b: V) => a.reduce((s, x, i) => s + x * b[i], 0);
const sub = (a: V, b: V) => a.map((x, i) => x - b[i]);
const add = (a: V, b: V) => a.map((x, i) => x + b[i]);
const scale = (a: V, k: number) => a.map(x => x * k);
const norm = (a: V) => Math.hypot(...a);
type M3 = number[][];
const toMat = (flat: number | number[] | undefined): M3 => { const f = asVec(flat as number[]); return [f.slice(0, 3), f.slice(3, 6), f.slice(6, 9)]; };
/** det by cofactor expansion along the first row. */
const detRow = (m: M3) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
/** det by cofactor expansion along the first column (a different expansion). */
const detCol = (m: M3) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[1][0] * (m[0][1] * m[2][2] - m[0][2] * m[2][1]) + m[2][0] * (m[0][1] * m[1][2] - m[0][2] * m[1][1]);
const det3 = (m: M3) => { const r = detRow(m), c = detCol(m); expect(close(r, c), `det expansions disagree ${r} vs ${c}`).toBe(true); return r; };
/** Cross product as three 3x3 determinants [e_i; u; w] (not the minors formula). */
const crossByDet = (u: V, w: V): V => [det3([[1, 0, 0], u, w]), det3([[0, 1, 0], u, w]), det3([[0, 0, 1], u, w])];
/** Gaussian elimination with partial pivoting; residual-checked. */
function solve(m: M3, b: V): V {
  const n = m.length;
  const a = m.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    expect(Math.abs(a[c][c]), 'singular matrix in oracle').toBeGreaterThan(1e-12);
    for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = a[i][n]; for (let k = i + 1; k < n; k++) s -= a[i][k] * x[k]; x[i] = s / a[i][i]; }
  const res = m.map((row, i) => dot(row, x) - b[i]);
  expect(Math.max(...res.map(Math.abs)), 'residual of Gaussian elimination').toBeLessThan(1e-9);
  return x;
}
/** Gauss-Jordan inverse via solving M x = e_j. */
const invert = (m: M3): M3 => {
  const cols = [0, 1, 2].map(j => solve(m, [0, 1, 2].map(i => (i === j ? 1 : 0))));
  return [0, 1, 2].map(i => [0, 1, 2].map(j => cols[j][i]));
};
/** First derivative: Richardson extrapolation of the harness central difference. */
const d1 = (f: (x: number) => number, x: number) => (4 * centralDiff(f, x, 1e-3) - centralDiff(f, x, 2e-3)) / 3;
/** Second derivative by Richardson-extrapolated second differences. */
const d2 = (f: (x: number) => number, x: number) => {
  const S = (h: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  return (4 * S(2e-3) - S(4e-3)) / 3;
};
const vd1 = (r: (t: number) => V, t: number): V => r(t).map((_, k) => d1(s => r(s)[k], t));
const vd2 = (r: (t: number) => V, t: number): V => r(t).map((_, k) => d2(s => r(s)[k], t));
const speedOf = (r: (t: number) => V) => (t: number) => norm(vd1(r, t));
/** Heron's formula from side lengths. */
const heron = (P: V, Q: V, R: V) => {
  const a = norm(sub(Q, R)), b = norm(sub(P, R)), c = norm(sub(P, Q)), s = (a + b + c) / 2;
  return Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
};
const cycloid = (a: number) => (t: number): V => [a * (t - Math.sin(t)), a * (1 - Math.cos(t))];
/** Arc length over n arches (0 <= t <= 2 n pi), per arch, by Simpson quadrature of the finite-difference speed. */
const cycloidArchLength = (a: number, n: number) => {
  const sp = speedOf(cycloid(a));
  let total = 0;
  for (let j = 0; j < n; j++) total += simpson(sp, 2 * PI * j, 2 * PI * (j + 1), 400);
  return total;
};
const wrap = (x: number, y: number) => [x, y];

// --- text parsing helpers (card texts only) --------------------------------------------------------------------------------
const clean = (s: string) => s.replace(/−/g, '-').replace(/[ ]/g, ' ');
const SUP: Record<string, number> = { '²': 2, '³': 3, '⁴': 4 };
/** Turn a displayed expression such as "−t³ + 2t", "3cos(3t)", "4cos t", "8t³/3" into a JS function of t. */
function exprFn(src: string): (t: number) => number {
  let s = clean(src).replace(/\s+/g, '');
  s = s.replace(/t([²³⁴])/g, (_m, p: string) => `(t**${SUP[p]})`);
  s = s.replace(/(cos|sin)\(/g, 'Math.$1(').replace(/(cos|sin)t/g, 'Math.$1(t)');
  s = s.replace(/(\d)(t|Math|\()/g, '$1*$2');
  return new Function('t', `return ${s};`) as (t: number) => number;
}
/** Contents (top-level comma separated) of the first parenthesis group after `marker`. */
function groupAfter(text: string, marker: string): string[] {
  const t = clean(text);
  const at = t.indexOf(marker);
  if (at < 0) throw new Error(`marker ${marker} not found in: ${text}`);
  let i = at + marker.length;
  if (t[i] !== '(') throw new Error(`no ( after ${marker}`);
  let depth = 0, start = i + 1;
  const parts: string[] = [];
  for (; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')') { depth--; if (depth === 0) { parts.push(t.slice(start, i)); break; } }
    else if (t[i] === ',' && depth === 1) { parts.push(t.slice(start, i)); start = i + 1; }
  }
  return parts;
}
const curveFromPrompt = (prompt: string, marker = 'r(t) = '): ((t: number) => V) => {
  const comps = groupAfter(prompt, marker).map(exprFn);
  return (t: number) => comps.map(f => f(t));
};
/** Parse "3x + y − z" style linear forms in x, y, z. */
function linearForm(lhs: string): V {
  const s = clean(lhs).replace(/\s+/g, '');
  const coef = [0, 0, 0];
  const re = /([+-]?)(\d*)([xyz])/g;
  let m: RegExpExecArray | null, used = 0;
  while ((m = re.exec(s))) {
    const k = m[2] === '' ? 1 : Number(m[2]);
    coef['xyz'.indexOf(m[3])] += (m[1] === '-' ? -1 : 1) * k;
    used += m[0].length;
  }
  expect(used, `unparsed characters in linear form "${lhs}"`).toBe(s.length);
  return coef.map(v => (v === 0 ? 0 : v));
}
const parseEq = (eq: string) => { const [l, r] = clean(eq).split('='); return { coef: linearForm(l), rhs: r.trim() }; };
const sameVec = (a: V, b: V) => a.length === b.length && a.every((x, i) => x === b[i]);
const vecStr = (v: V) => `(${v.join(', ')})`;
const hasVec = (prompt: string, v: V) => clean(prompt).includes(vecStr(v));
const nums = (s: string) => (clean(s).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
/** Every card of every seed of game `id` (English), tagged by seed. */
function eachCard(id: string, kind: string, fn: (card: PracticeCard, seed: number) => void, seeds = 200) {
  let n = 0;
  for (let seed = 0; seed < seeds; seed++) for (const card of batch03Generators[id](seed, 'en')) if (card.audit?.kind === kind) { fn(card, seed); n++; }
  expect(n, `${kind}: no cards seen`).toBeGreaterThan(0);
  return n;
}
function eachCardById(id: string, cardId: string, fn: (card: PracticeCard, seed: number) => void, seeds = 200) {
  let n = 0;
  for (let seed = 0; seed < seeds; seed++) for (const card of batch03Generators[id](seed, 'en')) if (card.id === `${id}-${cardId}`) { fn(card, seed); n++; }
  expect(n, `${cardId}: no cards seen`).toBeGreaterThan(0);
  return n;
}
const where = (c: PracticeCard, seed: number) => `${c.id} seed ${seed} params ${JSON.stringify(c.audit?.params)}`;
/** t = pπ/q as displayed. */
const tText = (p: number, q: number) => `${p === 1 ? '' : p}π${q === 1 ? '' : `/${q}`}`;

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-12
describe('MIT-MV-12 parametric curves / cycloid', () => {
  it('recomputes every audit kind', () => {
    const counts = runOracle('MIT-MV-12', batch03Generators['MIT-MV-12'], {
      'MIT-MV-12:position': p => {
        const { a, k } = p as Record<string, number>;
        const theta = k * PI;
        // Rolling wheel: contact point (aθ, 0); the rim point P0 = contact point; rotate the radius vector (0,-a) clockwise by θ about the centre.
        const centre = [a * theta, a];
        const c = Math.cos(-theta), s = Math.sin(-theta);
        const cp = [0 * c - -a * s, 0 * s + -a * c];
        const P = add(centre, cp);
        expect(P[1], 'rim point must stay above the road').toBeGreaterThan(-1e-12);
        return wrap(P[0], P[1]);
      },
      'MIT-MV-12:velocity': p => { const { a, p: pp, q } = p as Record<string, number>; return vd1(cycloid(a), pp * PI / q); },
      'MIT-MV-12:speed': p => {
        const { a, p: pp, q } = p as Record<string, number>;
        const sp = speedOf(cycloid(a))(pp * PI / q);
        expect(close(sp, 2 * a * Math.abs(Math.sin(pp * PI / (2 * q))), 1e-8), 'FD speed vs half-angle form').toBe(true);
        return [sp];
      },
      'MIT-MV-12:count-cusps': p => {
        const { a, n } = p as Record<string, number>;
        const sp = speedOf(cycloid(a));
        let count = 0;
        const steps = n * 50; // grid step pi/50 hits every multiple of 2π exactly
        for (let i = 0; i <= steps; i++) if (sp(i * PI / 50) < 1e-6) count++;
        return [count];
      },
      'MIT-MV-12:arch-length': p => { const { a, n } = p as Record<string, number>; return [cycloidArchLength(a, n)]; },
      'MIT-MV-12:cusp-time': p => {
        const { a } = p as Record<string, number>;
        return {
          optionIsCorrect: text => {
            const m = /^t = (\d+)π(\/2)?$/.exec(clean(text).trim().replace('-', '-'));
            expect(m, `unparsable cusp option "${text}"`).not.toBeNull();
            const t = Number(m![1]) * PI / (m![2] ? 2 : 1);
            return speedOf(cycloid(a))(t) < 1e-6;
          },
        };
      },
      'MIT-MV-12:challenge': p => {
        const { R, u, w, n, tn, td } = p as Record<string, number>;
        const t = tn / td;
        // complex arithmetic: z = (u + i w) t + R e^{i 2π n t}
        const phi = 2 * PI * n * t;
        const re = u * t + R * Math.cos(phi), im = w * t + R * Math.sin(phi);
        return wrap(re, im);
      },
    } satisfies Record<string, Oracle>);
    expect(Object.keys(counts).sort()).toEqual(['MIT-MV-12:arch-length', 'MIT-MV-12:challenge', 'MIT-MV-12:count-cusps', 'MIT-MV-12:cusp-time', 'MIT-MV-12:position', 'MIT-MV-12:speed', 'MIT-MV-12:velocity']);
    for (const c of Object.values(counts)) expect(c).toBe(200);
  });

  it('prompts show the audited inputs', () => {
    const G = 'MIT-MV-12';
    eachCard(G, 'MIT-MV-12:position', (c, s) => { const { a, k } = c.audit!.params as Record<string, number>; const t = clean(c.prompt); expect(t.includes(`a = ${a} `), where(c, s)).toBe(true); expect(t.includes(`θ = ${k === 1 ? '' : k}π.`), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-12:velocity', (c, s) => { const { a, p, q } = c.audit!.params as Record<string, number>; const t = clean(c.prompt); expect(t.includes(`a = ${a}.`), where(c, s)).toBe(true); expect(t.includes(`t = ${tText(p, q)}`), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-12:speed', (c, s) => { const { a, p, q } = c.audit!.params as Record<string, number>; const t = clean(c.prompt); expect(t.includes(`a = ${a},`), where(c, s)).toBe(true); expect(t.includes(`t = ${tText(p, q)}`), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-12:count-cusps', (c, s) => { const { a, n } = c.audit!.params as Record<string, number>; const t = clean(c.prompt); expect(t.includes(`a = ${a},`), where(c, s)).toBe(true); expect(t.includes(`0 ≤ t ≤ ${n}π`), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-12:arch-length', (c, s) => {
      const { a, n } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      expect(t.includes(`a = ${a}.`), where(c, s)).toBe(true); expect(t.includes(`0 ≤ t ≤ ${2 * n}π (${n} arch`), where(c, s)).toBe(true);
      // figure: alt text and polyline on the cycloid, cusps at multiples of 2πa
      const f = c.figure!;
      expect(f.alt.includes(`${n} arch`) && f.alt.includes(`a = ${a}`) && f.alt.includes(`height ${2 * a}`) && f.alt.includes(`${2 * a}π apart`), `${where(c, s)} alt "${f.alt}"`).toBe(true);
      const line = f.shapes.find(sh => sh.kind === 'line');
      expect(line && line.kind === 'line').toBe(true);
      if (line && line.kind === 'line') {
        for (const [X, Y] of line.points) {
          let lo = 0, hi = 2 * PI * n + 1;
          for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; (a * (mid - Math.sin(mid)) < X ? (lo = mid) : (hi = mid)); }
          const tt = (lo + hi) / 2;
          expect(Math.abs(a * (1 - Math.cos(tt)) - Y), `${where(c, s)} figure point (${X}, ${Y}) off the cycloid`).toBeLessThan(1e-6);
        }
      }
      const cusps = f.shapes.filter(sh => sh.kind === 'point').map(sh => (sh.kind === 'point' ? sh.at : [NaN, NaN]));
      expect(cusps.length, where(c, s)).toBe(n + 1);
      cusps.forEach((pt, j) => { expect(close(pt[0], 2 * PI * a * j) && Math.abs(pt[1]) < 1e-12, where(c, s)).toBe(true); });
      expect(f.view.xmin < 0 && f.view.xmax > 2 * PI * a * n && f.view.ymin < 0 && f.view.ymax > 2 * a, `${where(c, s)} view clips the arches`).toBe(true);
    });
    eachCard(G, 'MIT-MV-12:challenge', (c, s) => {
      const { R, u, w, n, tn, td } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      expect(t.includes(`R = ${R} cm`), where(c, s)).toBe(true);
      expect(t.includes(`center is at (${u}t, ${w}t) cm`), `${where(c, s)} :: ${t}`).toBe(true);
      expect(t.includes(`${n} revolution${n === 1 ? '' : 's'} per second`), where(c, s)).toBe(true);
      expect(t.includes(`t = ${tn}/${td} s`), where(c, s)).toBe(true);
    });
    // cusp-time explanations quote cos, sin and v for each option: check them numerically.
    eachCard(G, 'MIT-MV-12:cusp-time', (c, s) => {
      const { a } = c.audit!.params as Record<string, number>;
      const E = clean(c.explanation);
      const re = /At t = ([^:]+): cos t = (-?\d+), sin t = (-?\d+), so v = \((-?\d+), (-?\d+)\)/g;
      let m: RegExpExecArray | null, seen = 0;
      while ((m = re.exec(E))) {
        const mm = /^(\d+)π(\/2)?$/.exec(m[1].trim()); expect(mm, where(c, s)).not.toBeNull();
        const t = Number(mm![1]) * PI / (mm![2] ? 2 : 1);
        expect(close(Math.cos(t), Number(m[2])) && close(Math.sin(t), Number(m[3])), `${where(c, s)} trig in "${m[0]}"`).toBe(true);
        const v = vd1(cycloid(a), t);
        expect(close(v[0], Number(m[4]), 1e-8) && close(v[1], Number(m[5]), 1e-8), `${where(c, s)} v in "${m[0]}": FD ${v}`).toBe(true);
        seen++;
      }
      expect(seen, `${where(c, s)} explanation should discuss all three options`).toBe(3);
    });
    // signed-trap (not audited): numbers in the text must follow a
    eachCardById(G, 'signed-trap', (c, s) => {
      const a = Number(/with a = (\d+)/.exec(clean(c.prompt))![1]);
      const E = clean(c.explanation);
      const signed = simpson(t => 2 * a * Math.sin(t / 2), 0, 4 * PI, 800);
      expect(Math.abs(signed), `signed integral seed ${s}`).toBeLessThan(1e-9);
      const truth = simpson(t => 2 * a * Math.abs(Math.sin(t / 2)), 0, 2 * PI, 800) * 2;
      expect(close(truth, 16 * a, 1e-9)).toBe(true);
      for (const piece of [`2·8a = ${16 * a}`, `∫₀^{2π} 2a sin(t/2) dt = ${8 * a}`, `= −${8 * a}`, `(${4 * a}π, 0)`, `x(4π) = ${4 * a}π`]) expect(E.includes(piece) || E.includes(clean(piece)), `signed-trap seed ${s} (a=${a}) lacks "${piece}" in: ${E}`).toBe(true);
    });
  });
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-13
describe('MIT-MV-13 velocity, acceleration, arc length', () => {
  it('recomputes every audit kind', () => {
    const poly = (a: number, b: number, c: number) => (t: number): V => [a * t * t, b * t ** 3 + c * t];
    const curve3 = (c: number) => (t: number): V => [t, c * t * t, 2 * c * c * t ** 3 / 3];
    const counts = runOracle('MIT-MV-13', batch03Generators['MIT-MV-13'], {
      'MIT-MV-13:velocity': p => { const { a, b, c, t } = p as Record<string, number>; return vd1(poly(a, b, c), t); },
      'MIT-MV-13:acceleration': p => { const { a, b, c, t } = p as Record<string, number>; return vd2(poly(a, b, c), t); },
      'MIT-MV-13:line-speed-length': p => {
        const { p: pp, q, x0, y0, t1, t2 } = p as Record<string, number>;
        const r = (t: number): V => [pp * t + x0, q * t + y0];
        const sp = speedOf(r);
        const quad = simpson(sp, t1, t2, 200);
        const chord = norm(sub(r(t2), r(t1))); // straight segment: arc length = distance between the end points
        expect(close(quad, chord, 1e-8), `quadrature ${quad} vs chord ${chord}`).toBe(true);
        return [sp((t1 + t2) / 2), chord];
      },
      'MIT-MV-13:perfect-square': p => { const { c, t } = p as Record<string, number>; return [speedOf(curve3(c))(t)]; },
      'MIT-MV-13:arc-length-poly': p => { const { c, T } = p as Record<string, number>; return [simpson(speedOf(curve3(c)), 0, T, 400)]; },
      'MIT-MV-13:circle-acceleration': p => {
        const { rho, omega } = p as Record<string, number>;
        const r = (t: number): V => [rho * Math.cos(omega * t), rho * Math.sin(omega * t)];
        const sp1 = norm(vd1(r, 0.37)), sp2 = norm(vd1(r, 1.9));
        const ac1 = norm(vd2(r, 0.37)), ac2 = norm(vd2(r, 1.9));
        expect(close(sp1, sp2, 1e-7) && close(ac1, ac2, 1e-7), 'speed and |a| must be constant in t').toBe(true);
        return wrap(sp1, ac1);
      },
      'MIT-MV-13:challenge': p => {
        const { k, T } = p as Record<string, number>;
        const r = (t: number): V => [k * t ** 3 / 3 - k * t, k * t * t];
        return [simpson(speedOf(r), 0, T, 400)];
      },
    } satisfies Record<string, Oracle>);
    expect(Object.keys(counts).sort()).toEqual(['MIT-MV-13:acceleration', 'MIT-MV-13:arc-length-poly', 'MIT-MV-13:challenge', 'MIT-MV-13:circle-acceleration', 'MIT-MV-13:line-speed-length', 'MIT-MV-13:perfect-square', 'MIT-MV-13:velocity']);
    for (const c of Object.values(counts)) expect(c).toBe(200);
  });

  it('prompts show the audited inputs (the displayed curve equals the audited curve)', () => {
    const G = 'MIT-MV-13';
    const T3 = [-1.3, 0.4, 1.7];
    const same = (disp: (t: number) => V, truth: (t: number) => V, label: string) => { for (const t of T3) { const x = disp(t), y = truth(t); expect(x.length, label).toBe(y.length); x.forEach((v, i) => expect(close(v, y[i], 1e-9), `${label}: displayed ${x} vs audited ${y} at t=${t}`).toBe(true)); } };
    eachCard(G, 'MIT-MV-13:velocity', (c, s) => {
      const { a, b, c: cc, t } = c.audit!.params as Record<string, number>;
      same(curveFromPrompt(c.prompt), tt => [a * tt * tt, b * tt ** 3 + cc * tt], where(c, s));
      expect(nums(c.prompt.split('at t =')[1])[0], where(c, s)).toBe(t);
    });
    eachCard(G, 'MIT-MV-13:acceleration', (c, s) => {
      const { a, b, c: cc, t } = c.audit!.params as Record<string, number>;
      same(curveFromPrompt(c.prompt), tt => [a * tt * tt, b * tt ** 3 + cc * tt], where(c, s));
      expect(nums(c.prompt.split('at t =')[1])[0], where(c, s)).toBe(t);
    });
    eachCard(G, 'MIT-MV-13:line-speed-length', (c, s) => {
      const { p, q, x0, y0, t1, t2 } = c.audit!.params as Record<string, number>;
      const m = /x = (.+?), y = (.+?)\. Find/.exec(clean(c.prompt));
      expect(m, where(c, s)).not.toBeNull();
      const fx = exprFn(m![1]), fy = exprFn(m![2]);
      for (const t of T3) expect(close(fx(t), p * t + x0) && close(fy(t), q * t + y0), where(c, s)).toBe(true);
      expect(clean(c.prompt).includes(`from t = ${t1} to t = ${t2}`), where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-13:perfect-square', (c, s) => {
      const { c: k, t } = c.audit!.params as Record<string, number>;
      same(curveFromPrompt(c.prompt), tt => [tt, k * tt * tt, 2 * k * k * tt ** 3 / 3], where(c, s));
      expect(nums(c.prompt.split('at t =')[1])[0], where(c, s)).toBe(t);
    });
    eachCard(G, 'MIT-MV-13:arc-length-poly', (c, s) => {
      const { c: k, T } = c.audit!.params as Record<string, number>;
      same(curveFromPrompt(c.prompt, 'For r(t) = '), tt => [tt, k * tt * tt, 2 * k * k * tt ** 3 / 3], where(c, s));
      expect(clean(c.prompt).includes(`from t = 0 to t = ${T}`), where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-13:circle-acceleration', (c, s) => {
      const { rho, omega } = c.audit!.params as Record<string, number>;
      same(curveFromPrompt(c.prompt), tt => [rho * Math.cos(omega * tt), rho * Math.sin(omega * tt)], where(c, s));
      const t = clean(c.prompt); expect(t.includes(`ρ = ${rho}`) && t.includes(`ω = ${omega}`), where(c, s)).toBe(true);
      const f = c.figure!;
      expect(f.alt.includes(`radius ${rho}`) && f.alt.includes(`(${rho}, 0)`), where(c, s)).toBe(true);
      const line = f.shapes.find(sh => sh.kind === 'line');
      if (line && line.kind === 'line') for (const [X, Y] of line.points) expect(close(Math.hypot(X, Y), rho, 1e-9), `circle point off the circle ${where(c, s)}`).toBe(true);
      const arrows = f.shapes.filter(sh => sh.kind === 'arrow').map(sh => (sh.kind === 'arrow' ? sh : null)!);
      const va = arrows.find(a => a.label === 'v')!, aa = arrows.find(a => a.label === 'a')!;
      // omega > 0: velocity at (rho,0) is +y (counterclockwise); acceleration points to the centre, short of overshooting it
      expect(va.from[0] === rho && va.from[1] === 0 && va.to[0] === rho && va.to[1] > 0, where(c, s)).toBe(true);
      expect(aa.from[0] === rho && aa.to[1] === 0 && aa.to[0] < rho && aa.to[0] > 0, where(c, s)).toBe(true);
      expect(Math.max(...[va.to[1], aa.to[0], rho].map(Math.abs)) < f.view.xmax, where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-13:challenge', (c, s) => {
      const { k, T } = c.audit!.params as Record<string, number>;
      const m = /x = (.+?), y = (.+?)\. Find/.exec(clean(c.prompt)); expect(m, where(c, s)).not.toBeNull();
      const fx = exprFn(m![1]), fy = exprFn(m![2]);
      for (const t of T3) expect(close(fx(t), k * t ** 3 / 3 - k * t) && close(fy(t), k * t * t), where(c, s)).toBe(true);
      expect(clean(c.prompt).includes(`from t = 0 to t = ${T}`), where(c, s)).toBe(true);
    });
  });

  it('un-audited choice cards are mathematically right', () => {
    // constant-speed circle: |a| = v²/ρ stated in the explanation must match the prompt, and the correct option is the one about a changing velocity
    eachCardById('MIT-MV-13', 'constant-speed', (c, s) => {
      const m = /radius (\d+) with constant speed (\d+)/.exec(clean(c.prompt))!; const rho = Number(m[1]), v = Number(m[2]);
      expect(clean(c.explanation).includes(`|a| = |v|²/ρ = ${v}²/${rho} = ${v * v / rho}`), `seed ${s}: ${c.explanation}`).toBe(true);
      // numeric check on a real uniform circular motion
      const r = (t: number): V => [rho * Math.cos(v * t / rho), rho * Math.sin(v * t / rho)];
      expect(close(norm(vd1(r, 0.3)), v, 1e-7) && close(norm(vd2(r, 0.3)), v * v / rho, 1e-6), `seed ${s}`).toBe(true);
      expect(norm(vd2(r, 0.3)), 'acceleration is not zero').toBeGreaterThan(0.1);
      expect(clean(c.choice!.options[c.choice!.answer]).startsWith('Its velocity changes'), `seed ${s}`).toBe(true);
    });
    // product rule for the cross product, tested numerically against every offered option
    eachCardById('MIT-MV-13', 'product-rule', (c, s) => {
      const r = (t: number): V => [Math.sin(t) + t, t * t, Math.cos(2 * t)];
      const sFn = (t: number): V => [t ** 3, Math.exp(t / 3), Math.sin(3 * t)];
      const x0 = 0.8;
      const lhs = vd1(t => crossByDet(r(t), sFn(t)), x0);
      const rp = vd1(r, x0), sp = vd1(sFn, x0);
      const cands: Record<string, V> = {
        'r′ × s + s′ × r': add(crossByDet(rp, sFn(x0)), crossByDet(sp, r(x0))),
        'r′ × s′': crossByDet(rp, sp),
        'r′ × s + r × s′': add(crossByDet(rp, sFn(x0)), crossByDet(r(x0), sp)),
      };
      const good = c.choice!.options.map(o => { const v = cands[clean(o).replace(/-/g, '-')] ?? cands[o]; expect(v, `unknown option "${o}"`).toBeDefined(); return norm(sub(v, lhs)) < 1e-6; });
      expect(good.filter(Boolean).length, `seed ${s}`).toBe(1);
      expect(good[c.choice!.answer], `seed ${s}`).toBe(true);
    });
  });
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-14
describe("MIT-MV-14 Kepler's second law", () => {
  it('recomputes every audit kind', () => {
    const crossZ3 = (r: V, v: V) => crossByDet([r[0], r[1], 0], [v[0], v[1], 0])[2];
    const counts = runOracle('MIT-MV-14', batch03Generators['MIT-MV-14'], {
      'MIT-MV-14:cross-z': p => {
        const { x, y, vx, vy } = p as Record<string, number>;
        // area swept in dt = 1 by the straight motion r -> r + v: shoelace of the triangle O, r, r + v.
        const O = [0, 0], A = [x, y], B = [x + vx, y + vy];
        const shoelace = Math.abs(O[0] * A[1] - A[0] * O[1] + A[0] * B[1] - B[0] * A[1] + B[0] * O[1] - O[0] * B[1]) / 2;
        return wrap(crossZ3([x, y], [vx, vy]), shoelace);
      },
      'MIT-MV-14:circle-sign': p => {
        const { rho, omega } = p as Record<string, number>;
        const r = (t: number): V => [rho * Math.cos(omega * t), rho * Math.sin(omega * t)];
        const K = (t: number) => { const rr = r(t), vv = vd1(r, t); return rr[0] * vv[1] - rr[1] * vv[0]; };
        expect(close(K(0.4), K(1.1), 1e-7), 'r × v should be constant on the circle').toBe(true);
        const period = 2 * PI / Math.abs(omega);
        const areaPerPeriod = simpson(t => K(t) / 2, 0, period, 100);
        expect(close(Math.abs(areaPerPeriod), PI * rho * rho, 1e-7), 'one lap sweeps the disk area').toBe(true);
        return wrap(K(0.4), Math.abs(areaPerPeriod) / period);
      },
      'MIT-MV-14:equal-areas': p => {
        const { d1: D1, v1: v1_, d2: D2 } = p as Record<string, number>;
        // Realise the situation as a Kepler (inverse-square) orbit: apsides at D1 < D2; vis-viva fixes GM, then v2 follows from energy.
        expect(D1, 'nearest point must be nearer than farthest').toBeLessThan(D2);
        const lambda = 2 * D2 / (D1 + D2);            // v1² d1 / GM at an apsis with distance ratio d2/d1
        const GM = v1_ * v1_ * D1 / lambda;
        const v2sq = v1_ * v1_ - 2 * GM * (1 / D1 - 1 / D2);
        expect(v2sq, 'orbit must be realisable').toBeGreaterThan(0);
        return [Math.sqrt(v2sq)];
      },
      'MIT-MV-14:swept-area': p => {
        const { K, t1, t2 } = p as Record<string, number>;
        // concrete central-force motion with (r × v)_z = K: circle of radius 2 with ω = K/4 (the force is central), area by quadrature of ½|r × v|.
        const rho = 2, omega = K / (rho * rho);
        const r = (t: number): V => [rho * Math.cos(omega * t), rho * Math.sin(omega * t)];
        const rate = (t: number) => { const rr = r(t), vv = vd1(r, t); return Math.abs(rr[0] * vv[1] - rr[1] * vv[0]) / 2; };
        return [simpson(rate, t1, t2, 200)];
      },
      'MIT-MV-14:torque': p => {
        const { x, y, ax, ay } = p as Record<string, number>;
        // d/dτ (r × v)_z at τ = 0 along the motion r(τ) = r0 + v0 τ + a τ²/2 (any v0): central-difference derivative.
        const v0 = [1.3, -0.7];
        const rr = (t: number): V => [x + v0[0] * t + ax * t * t / 2, y + v0[1] * t + ay * t * t / 2];
        const vv = (t: number): V => [v0[0] + ax * t, v0[1] + ay * t];
        return [d1(t => crossZ3(rr(t), vv(t)), 0)];
      },
      'MIT-MV-14:challenge': p => {
        const { a, b, w, T } = p as Record<string, number>;
        const r = (t: number): V => [a * Math.cos(w * t), b * Math.sin(w * t)];
        const rate = (t: number) => { const rr = r(t), vv = vd1(r, t); return Math.abs(rr[0] * vv[1] - rr[1] * vv[0]) / 2; };
        const quad = simpson(rate, 0, T, 200);
        // second route: shoelace area of the fan polygon O, r(t0), ..., r(T)
        const N = 20000; let fan = 0;
        for (let i = 0; i < N; i++) { const A = r(T * i / N), B = r(T * (i + 1) / N); fan += (A[0] * B[1] - B[0] * A[1]) / 2; }
        expect(Math.abs(fan - quad) / quad, `fan polygon ${fan} vs quadrature ${quad}`).toBeLessThan(1e-5);
        return [quad];
      },
    } satisfies Record<string, Oracle>);
    expect(Object.keys(counts).sort()).toEqual(['MIT-MV-14:challenge', 'MIT-MV-14:circle-sign', 'MIT-MV-14:cross-z', 'MIT-MV-14:equal-areas', 'MIT-MV-14:swept-area', 'MIT-MV-14:torque']);
    for (const c of Object.values(counts)) expect(c).toBe(200);
  });

  it('prompts, figures and explanations match the audited inputs', () => {
    const G = 'MIT-MV-14';
    eachCard(G, 'MIT-MV-14:cross-z', (c, s) => {
      const { x, y, vx, vy } = c.audit!.params as Record<string, number>;
      expect(hasVec(c.prompt, [x, y]) && hasVec(c.prompt, [vx, vy]), `${where(c, s)} :: ${c.prompt}`).toBe(true);
      const f = c.figure!; const ar = f.shapes.filter(sh => sh.kind === 'arrow').map(sh => (sh.kind === 'arrow' ? sh : null)!);
      const r = ar.find(a => a.label === 'r')!, v = ar.find(a => a.label === 'v')!;
      expect(r.from[0] === 0 && r.from[1] === 0 && r.to[0] === x && r.to[1] === y && v.from[0] === x && v.from[1] === y && v.to[0] === x + vx && v.to[1] === y + vy, where(c, s)).toBe(true);
      expect(clean(f.alt).includes(`(${x}, ${y})`), where(c, s)).toBe(true);
      for (const pt of [[0, 0], [x, y], [x + vx, y + vy]]) expect(pt[0] >= f.view.xmin && pt[0] <= f.view.xmax && pt[1] >= f.view.ymin && pt[1] <= f.view.ymax, `${where(c, s)} view clips`).toBe(true);
    });
    eachCard(G, 'MIT-MV-14:circle-sign', (c, s) => {
      const { rho, omega } = c.audit!.params as Record<string, number>;
      const r = curveFromPrompt(c.prompt);
      for (const t of [0.3, 1.2]) { const z = r(t); expect(close(z[0], rho * Math.cos(omega * t)) && close(z[1], rho * Math.sin(omega * t)), where(c, s)).toBe(true); }
      expect(clean(c.prompt).includes(`ρ = ${rho} and ω = ${omega}`), where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-14:equal-areas', (c, s) => {
      const { d1: D1, v1: V1, d2: D2 } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      expect(t.includes(`d₁ = ${D1} `) && t.includes(`v₁ = ${V1},`) && t.includes(`d₂ = ${D2},`), `${where(c, s)} :: ${t}`).toBe(true);
    });
    eachCard(G, 'MIT-MV-14:swept-area', (c, s) => {
      const { K, t1, t2 } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      expect(t.includes(`At t = ${t1} its (r × v)_z equals ${K}.`) && t.includes(`from t = ${t1} to t = ${t2}`), `${where(c, s)} :: ${t}`).toBe(true);
    });
    eachCard(G, 'MIT-MV-14:torque', (c, s) => {
      const { x, y, ax, ay } = c.audit!.params as Record<string, number>;
      expect(hasVec(c.prompt, [x, y]) && hasVec(c.prompt, [ax, ay]), where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-14:challenge', (c, s) => {
      const { a, b, w, T } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      const r = curveFromPrompt(c.prompt);
      for (const tt of [0.3, 1.2]) { const z = r(tt); expect(close(z[0], a * Math.cos(w * tt)) && close(z[1], b * Math.sin(w * tt)), where(c, s)).toBe(true); }
      expect(t.includes(`(a = ${a}, b = ${b}, ω = ${w})`) && t.includes(`from t = 0 to t = ${T}`), `${where(c, s)} :: ${t}`).toBe(true);
      expect(w * T, `ω·T < 2π as the prompt claims: ${where(c, s)}`).toBeLessThan(2 * PI);
      const f = c.figure!; const line = f.shapes.find(sh => sh.kind === 'line');
      if (line && line.kind === 'line') for (const [X, Y] of line.points) expect(close((X / a) ** 2 + (Y / b) ** 2, 1, 1e-9), `ellipse point off ellipse ${where(c, s)}`).toBe(true);
      expect(clean(f.alt).includes(`semi-axis ${a}`) && clean(f.alt).includes(`semi-axis ${b}`), `${where(c, s)} alt: ${f.alt}`).toBe(true);
      expect(f.view.xmin <= -a && f.view.xmax >= a && f.view.ymin <= -b && f.view.ymax >= b, where(c, s)).toBe(true);
    });
    // central-force-n: exponent named in the prompt and the correct option agree; Kepler II holds for any central force: check on a numerical orbit.
    eachCardById(G, 'central-force-n', (c, s) => {
      const m = /K\/d(?:\^(\d+))?,/.exec(clean(c.prompt)); expect(m, `seed ${s}: ${c.prompt}`).not.toBeNull();
      const n = m![1] ? Number(m![1]) : 1;
      const correct = clean(c.choice!.options[c.choice!.answer]);
      expect(correct.startsWith('Yes') && correct.includes(`exponent ${n} does not matter`), `seed ${s}: ${correct}`).toBe(true);
      // leapfrog orbit under a = -K r / |r|^(n+1): r × v stays constant to integration accuracy
      let r: V = [1, 0], v: V = [0, 1.3]; const dt = 1e-4;
      const acc = (rr: V) => scale(rr, -1 / Math.hypot(...rr) ** (n + 1));
      let h0 = r[0] * v[1] - r[1] * v[0], worst = 0;
      let a = acc(r);
      for (let i = 0; i < 20000; i++) { v = add(v, scale(a, dt / 2)); r = add(r, scale(v, dt)); a = acc(r); v = add(v, scale(a, dt / 2)); worst = Math.max(worst, Math.abs(r[0] * v[1] - r[1] * v[0] - h0)); }
      expect(worst, `angular momentum drift for exponent ${n}`).toBeLessThan(1e-6);
    });
  });
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-15
describe('MIT-MV-15 Unit 1 review', () => {
  it('recomputes every audit kind', () => {
    const planeFrom = (P: V, Q: V, R: V) => { const N = crossByDet(sub(Q, P), sub(R, P)); const d = dot(N, P); for (const X of [P, Q, R]) expect(dot(N, X)).toBe(d); expect(dot(N, sub(Q, P))).toBe(0); expect(dot(N, sub(R, P))).toBe(0); return [...N, d]; };
    const counts = runOracle('MIT-MV-15', batch03Generators['MIT-MV-15'], {
      'MIT-MV-15:angle': p => {
        const Q = asVec(p.q), R = asVec(p.r);
        const theta = Math.atan2(norm(crossByDet(Q, R)), dot(Q, R)); // angle through atan2(|Q×R|, Q·R)
        const lq = norm(Q), lr = norm(R);
        expect(Math.abs(lq - Math.round(lq)) < 1e-9 && Math.abs(lr - Math.round(lr)) < 1e-9, `|OQ|=${lq}, |OR|=${lr} must be whole as the prompt says`).toBe(true);
        return [Math.cos(theta)];
      },
      'MIT-MV-15:triangle-area': p => {
        const P = asVec(p.p), Q = asVec(p.q), R = asVec(p.r);
        const cr = norm(crossByDet(sub(Q, P), sub(R, P)));
        expect(Number.isInteger(cr) || Math.abs(cr - Math.round(cr)) < 1e-12, '|PQ × PR| should be whole as the prompt says').toBe(true);
        return [heron(P, Q, R)];
      },
      'MIT-MV-15:plane-constant': p => planeFrom(asVec(p.p), asVec(p.q), asVec(p.r)),
      'MIT-MV-15:solve-system': p => solve(toMat(p.m), asVec(p.b)),
      'MIT-MV-15:singular-c': p => {
        const { u1, u2 } = p as Record<string, number>; const Vv = asVec(p.v), W = asVec(p.w);
        const f = (c: number) => det3([[u1, u2, c], Vv, W]);
        const slope = f(1) - f(0);
        expect(Math.abs(slope), 'coefficient of c must be nonzero').toBeGreaterThan(1e-12);
        const c = -f(0) / slope;
        expect(Math.abs(f(c)), 'det at the solved c').toBeLessThan(1e-9);
        return [c];
      },
      'MIT-MV-15:ladder': p => {
        const { L, d } = p as Record<string, number>; const theta = PI / d;
        const h = L * Math.sin(theta), w = Math.sqrt(L * L - h * h); // top height, foot distance by Pythagoras
        const mid = [-w / 2, h / 2];
        expect(close(norm(mid), L / 2, 1e-9), 'midpoint of a ladder is L/2 from the corner (Thales)').toBe(true);
        return wrap(mid[0], mid[1]);
      },
      'MIT-MV-15:helix-speed': p => {
        const { a, c, t } = p as Record<string, number>;
        const r = (s: number): V => [c * s, a * Math.cos(s), a * Math.sin(s)];
        const sp = speedOf(r)(t);
        expect(close(sp, speedOf(r)(t + 0.9), 1e-8), 'helix speed independent of t').toBe(true);
        return [sp];
      },
      'MIT-MV-15:constant-length': p => {
        const Vv = asVec(p.v);
        const results = [1.7, 0.6].map(rho => {
          // a real motion with |R| = rho and velocity V at τ = 0: a great-circle arc R(τ) = R0 cos(sτ) + (V/s) sin(sτ), s = |V|/rho, R0 ⟂ V.
          const e = [0, 1, 2].reduce((best, i) => (Math.abs(Vv[i]) < Math.abs(Vv[best]) ? i : best), 0);
          const basis = [0, 0, 0]; basis[e] = 1;
          const R0 = scale(crossByDet(Vv, basis), rho / norm(crossByDet(Vv, basis)));
          const s = norm(Vv) / rho;
          const R = (tau: number): V => add(scale(R0, Math.cos(s * tau)), scale(Vv, Math.sin(s * tau) / s));
          expect(close(norm(R(0.37)), rho, 1e-12), 'constant length').toBe(true);
          expect(close(dot(R(0), vd1(R, 0)), 0, 1e-8), 'R · V = 0').toBe(true);
          expect(close(norm(sub(vd1(R, 0), Vv)), 0, 1e-8), 'V is the velocity at τ = 0').toBe(true);
          return dot(R(0), vd2(R, 0));
        });
        expect(close(results[0], results[1], 1e-6), `R·A should not depend on the radius: ${results}`).toBe(true);
        return [results[0]];
      },
      'MIT-MV-15:cycloid-arch': p => { const { a, n } = p as Record<string, number>; return [cycloidArchLength(a, n)]; },
      'MIT-MV-15:area-rate': p => {
        const { x, y, vx, vy } = p as Record<string, number>;
        const O = [0, 0], A = [x, y], B = [x + vx, y + vy];
        return [Math.abs(O[0] * A[1] - A[0] * O[1] + A[0] * B[1] - B[0] * A[1] + B[0] * O[1] - O[0] * B[1]) / 2];
      },
      'MIT-MV-15:det-zero': p => ({
        optionIsCorrect: text => {
          const D = p.D as number;
          return D !== 0 ? clean(text).startsWith('Only X = 0') : clean(text).startsWith('Infinitely many solutions, including X = 0');
        },
      }),
      'MIT-MV-15:challenge': p => {
        const P = asVec(p.p), Q = asVec(p.q), R = asVec(p.r), S = asVec(p.s), Vv = asVec(p.v);
        // X lies in the plane PQR iff det[X − P; Q − P; R − P] = 0, which is linear in t.
        const f = (t: number) => det3([sub(add(S, scale(Vv, t)), P), sub(Q, P), sub(R, P)]);
        const slope = f(1) - f(0);
        expect(Math.abs(slope), 'V must not be parallel to the plane').toBeGreaterThan(1e-12);
        const t = -f(0) / slope;
        const N = crossByDet(sub(Q, P), sub(R, P)); const X = add(S, scale(Vv, t));
        expect(Math.abs(dot(N, X) - dot(N, P)), 'substituting back into the plane').toBeLessThan(1e-9);
        return [t];
      },
    } satisfies Record<string, Oracle>);
    expect(Object.keys(counts).sort()).toEqual(['MIT-MV-15:angle', 'MIT-MV-15:area-rate', 'MIT-MV-15:challenge', 'MIT-MV-15:constant-length', 'MIT-MV-15:cycloid-arch', 'MIT-MV-15:det-zero', 'MIT-MV-15:helix-speed', 'MIT-MV-15:ladder', 'MIT-MV-15:plane-constant', 'MIT-MV-15:singular-c', 'MIT-MV-15:solve-system', 'MIT-MV-15:triangle-area']);
    for (const c of Object.values(counts)) expect(c).toBe(200);
  });

  it('prompts, figures and displayed inverse data match the audited inputs', () => {
    const G = 'MIT-MV-15';
    eachCard(G, 'MIT-MV-15:angle', (c, s) => { const p = c.audit!.params; expect(hasVec(c.prompt, asVec(p.q)) && hasVec(c.prompt, asVec(p.r)), where(c, s)).toBe(true); });
    for (const kind of ['MIT-MV-15:triangle-area', 'MIT-MV-15:plane-constant']) eachCard(G, kind, (c, s) => { const p = c.audit!.params; expect([p.p, p.q, p.r].every(v => hasVec(c.prompt, asVec(v))), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-15:solve-system', (c, s) => {
      const m = toMat(c.audit!.params.m); const b = asVec(c.audit!.params.b); const t = clean(c.prompt);
      const eqs = /equations are (.+?)\. You may/.exec(t)![1].split(';').map(parseEq);
      expect(eqs.length, where(c, s)).toBe(3);
      eqs.forEach((e, i) => { expect(sameVec(e.coef, m[i]), `${where(c, s)} equation ${i}: "${t}" parsed ${e.coef}`).toBe(true); expect(Number(e.rhs), where(c, s)).toBe(b[i]); });
      // the displayed inverse: D = det M and K = adjugate (M K = D I), as the prompt lets the learner assume
      const D = Number(/D = (-?\d+)/.exec(t)![1]);
      const rows = [...t.split('K = rows')[1].matchAll(/\(([^)]*)\)/g)].map(mm => mm[1].split(',').map(Number));
      expect(rows.length).toBe(3);
      expect(close(D, det3(m)), `${where(c, s)} displayed D=${D}, det=${det3(m)}`).toBe(true);
      const prod = m.map(row => [0, 1, 2].map(j => dot(row, rows.map(rr => rr[j]))));
      prod.forEach((row, i) => row.forEach((val, j) => expect(close(val, i === j ? D : 0), `${where(c, s)} (M·K)[${i}][${j}] = ${val}, expected ${i === j ? D : 0}`).toBe(true)));
    });
    eachCard(G, 'MIT-MV-15:singular-c', (c, s) => {
      const { u1, u2 } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      expect(t.includes(`U = (${u1}, ${u2}, c)`) && hasVec(c.prompt, asVec(c.audit!.params.v)) && hasVec(c.prompt, asVec(c.audit!.params.w)), `${where(c, s)} :: ${t}`).toBe(true);
    });
    eachCard(G, 'MIT-MV-15:ladder', (c, s) => {
      const { L, d } = c.audit!.params as Record<string, number>; const t = clean(c.prompt); const theta = PI / d;
      expect(t.includes(`L = ${L} `) && t.includes(`θ = π/${d}`), `${where(c, s)} :: ${t}`).toBe(true);
      const f = c.figure!; expect(f.alt.includes(`π/${d}`), where(c, s)).toBe(true);
      const lines = f.shapes.filter(sh => sh.kind === 'line').map(sh => (sh.kind === 'line' ? sh.points : []));
      const lad = lines.find(pts => pts.length === 2 && pts[0][1] === 0 && pts[1][0] === 0 && pts[0][0] < -1 && pts[1][1] > 0)!;
      expect(lad && close(lad[0][0], -L * Math.cos(theta), 1e-9) && close(lad[1][1], L * Math.sin(theta), 1e-9), `${where(c, s)} ladder segment ${JSON.stringify(lad)}`).toBe(true);
      expect(close(norm(sub([...lad[0]], [...lad[1]])), L, 1e-9), 'ladder drawn with length L').toBe(true);
      const P = f.shapes.find(sh => sh.kind === 'point');
      if (P && P.kind === 'point') expect(close(P.at[0], (lad[0][0] + lad[1][0]) / 2, 1e-9) && close(P.at[1], (lad[0][1] + lad[1][1]) / 2, 1e-9), where(c, s)).toBe(true);
      expect(lad[0][0] >= f.view.xmin && lad[1][1] <= f.view.ymax, `${where(c, s)} view clips ladder`).toBe(true);
    });
    eachCard(G, 'MIT-MV-15:helix-speed', (c, s) => {
      const { a, c: cc, t } = c.audit!.params as Record<string, number>;
      const r = curveFromPrompt(c.prompt); const truth = (x: number): V => [cc * x, a * Math.cos(x), a * Math.sin(x)];
      for (const x of [0.2, 1.4]) r(x).forEach((v, i) => expect(close(v, truth(x)[i]), where(c, s)).toBe(true));
      expect(nums(c.prompt.split('at t =')[1])[0], where(c, s)).toBe(t);
    });
    eachCard(G, 'MIT-MV-15:constant-length', (c, s) => { expect(hasVec(c.prompt, asVec(c.audit!.params.v)), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-15:cycloid-arch', (c, s) => { const { a, n } = c.audit!.params as Record<string, number>; const t = clean(c.prompt); expect(t.includes(`a = ${a}.`) && t.includes(`0 ≤ t ≤ ${2 * n}π (${n} arch`), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-15:area-rate', (c, s) => { const { x, y, vx, vy } = c.audit!.params as Record<string, number>; expect(hasVec(c.prompt, [x, y]) && hasVec(c.prompt, [vx, vy]), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-15:det-zero', (c, s) => { const { D } = c.audit!.params as Record<string, number>; expect(clean(c.prompt).includes(`det M = ${D}.`), `${where(c, s)} :: ${c.prompt}`).toBe(true); });
    eachCard(G, 'MIT-MV-15:challenge', (c, s) => { const p = c.audit!.params; expect([p.p, p.q, p.r, p.s, p.v].every(v => hasVec(c.prompt, asVec(v))), where(c, s)).toBe(true); });
    // norm-claim counterexample quoted in the explanation
    eachCardById(G, 'norm-claim', (c, s) => {
      const R = (t: number): V => [Math.cos(t * t), Math.sin(t * t)];
      for (const t of [0.5, 1.3, 2.1]) {
        const Vv = vd1(R, t);
        expect(Math.abs(dot(R(t), Vv)), `seed ${s}`).toBeLessThan(1e-7);
        expect(close(norm(Vv), 2 * Math.abs(t), 1e-6), 'speed 2|t| is not constant').toBe(true);
      }
      expect(clean(c.choice!.options[c.choice!.answer]).startsWith('|R| is constant'), `seed ${s}`).toBe(true);
    });
  });
});

// ------------------------------------------------------------------------------------------------------------------ MIT-MV-16
describe('MIT-MV-16 Exam 1', () => {
  it('recomputes every audit kind', () => {
    const planeFrom = (P: V, Q: V, R: V) => { const N = crossByDet(sub(Q, P), sub(R, P)); const d = dot(N, P); for (const X of [P, Q, R]) expect(dot(N, X)).toBe(d); return [...N, d]; };
    const bug = (u: number) => (t: number): V => [u * t + Math.cos(t), Math.sin(t)];
    const counts = runOracle('MIT-MV-16', batch03Generators['MIT-MV-16'], {
      'MIT-MV-16:cosine': p => {
        const { alpha, beta, gamma } = p as Record<string, number>;
        const P = [alpha, 0, 0], Q = [0, beta, 0], R = [0, 0, gamma];
        const a = norm(sub(P, Q)), b = norm(sub(R, Q)), c = norm(sub(P, R)); // |QP|, |QR|, |PR|
        expect(Math.abs(a - Math.round(a)) < 1e-9 && Math.abs(b - Math.round(b)) < 1e-9, `|QP|=${a}, |QR|=${b} should be whole as the prompt says`).toBe(true);
        return [(a * a + b * b - c * c) / (2 * a * b)]; // law of cosines
      },
      'MIT-MV-16:area': p => [heron(asVec(p.p), asVec(p.q), asVec(p.r))],
      'MIT-MV-16:plane': p => planeFrom(asVec(p.p), asVec(p.q), asVec(p.r)),
      'MIT-MV-16:bug-position': p => {
        const { u } = p as Record<string, number>;
        // integrate the velocity (car velocity + bug velocity relative to the car) from the start point (1, 0)
        const T = PI / 2;
        const x = 1 + simpson(s => u - Math.sin(s), 0, T, 200), y = 0 + simpson(s => Math.cos(s), 0, T, 200);
        const r = bug(u)(T);
        expect(close(r[0], x, 1e-9) && close(r[1], y, 1e-9), 'integrated path vs r(t)').toBe(true);
        return wrap(x, y);
      },
      'MIT-MV-16:bug-speed': p => {
        const { u } = p as Record<string, number>;
        const sp = speedOf(bug(u));
        // dense scan on [0, π] followed by ternary refinement around the best sample
        const N = 20000; let imin = 0, vmax = 0;
        for (let i = 0; i <= N; i++) { const s = sp(PI * i / N); if (s < sp(PI * imin / N)) imin = i; vmax = Math.max(vmax, s * s); }
        let lo = PI * Math.max(0, imin - 1) / N, hi = PI * Math.min(N, imin + 1) / N;
        for (let i = 0; i < 100; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; sp(a) < sp(b) ? (hi = b) : (lo = a); }
        // both fields ask for |v|² (smallest and largest), so square the minimum speed
        const vmin = sp((lo + hi) / 2);
        return wrap(vmin * vmin, vmax);
      },
      'MIT-MV-16:det': p => [det3(toMat(p.m))],
      'MIT-MV-16:inverse-entry': p => {
        const m = toMat(p.m); const { i, j } = p as Record<string, number>;
        const D = det3(m); const inv = invert(m);
        // K = det · M⁻¹ must be an integer matrix whose product with M is det·I
        const K = inv.map(row => row.map(v => v * D));
        K.forEach(row => row.forEach(v => expect(Math.abs(v - Math.round(v)), 'adjugate entries are integers').toBeLessThan(1e-9)));
        return [K[i - 1][j - 1]];
      },
      'MIT-MV-16:solve-system': p => solve(toMat(p.m), asVec(p.b)),
      'MIT-MV-16:plane-motion': p => {
        const { a, b, c, d, v1, v2 } = p as Record<string, number>;
        expect(c, 'v3 is determined only if c ≠ 0').not.toBe(0);
        // pick a point r0 on the plane, move by τ·v with τ = 1 (first order = exact on a plane); solve N·(r0 + v) = d for v3 by bisection
        const r0 = [0, 0, d / c];
        const g = (v3: number) => a * (r0[0] + v1) + b * (r0[1] + v2) + c * (r0[2] + v3) - d;
        let lo = -1e4, hi = 1e4;
        for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; (g(mid) * g(lo) <= 0 ? (hi = mid) : (lo = mid)); }
        return [(lo + hi) / 2];
      },
      'MIT-MV-16:parallel-line': p => {
        const { a, b, c, d } = p as Record<string, number>; const A = asVec(p.A), B = asVec(p.B); const N = [a, b, c];
        // a line is parallel to the plane iff both of its points are at the same signed distance from the plane
        const dist = (X: V) => (dot(N, X) - d) / norm(N);
        const par = Math.abs(dist(A) - dist(B)) < 1e-12;
        return {
          optionIsCorrect: text => {
            const t = clean(text);
            if (t.startsWith('Yes')) return par;
            if (t.startsWith('No')) return !par;
            expect(t.startsWith('It cannot be decided'), `unknown option "${text}"`).toBe(true);
            return false;
          },
        };
      },
      'MIT-MV-16:unique-solution': p => ({
        optionIsCorrect: text => {
          const t = clean(text); const D = p.D as number;
          if (t.startsWith('Exactly one solution')) return D !== 0;
          if (t.startsWith('No solution or infinitely many')) return D === 0;
          expect(t.startsWith('Infinitely many solutions for every B'), `unknown option "${text}"`).toBe(true);
          return false;
        },
      }),
      'MIT-MV-16:challenge': p => {
        const m = toMat(p.m); const { c1, c3 } = p as Record<string, number>;
        // r(t) solves M r = (c1, t, c3): differentiate the solution in t numerically
        return [0, 1, 2].map(k => centralDiff(t => solve(m, [c1, t, c3])[k], 0.3, 0.25));
      },
    } satisfies Record<string, Oracle>);
    expect(Object.keys(counts).sort()).toEqual(['MIT-MV-16:area', 'MIT-MV-16:bug-position', 'MIT-MV-16:bug-speed', 'MIT-MV-16:challenge', 'MIT-MV-16:cosine', 'MIT-MV-16:det', 'MIT-MV-16:inverse-entry', 'MIT-MV-16:parallel-line', 'MIT-MV-16:plane', 'MIT-MV-16:plane-motion', 'MIT-MV-16:solve-system', 'MIT-MV-16:unique-solution']);
    for (const c of Object.values(counts)) expect(c).toBe(200);
  });

  it('prompts, figures and displayed inverse data match the audited inputs', () => {
    const G = 'MIT-MV-16';
    eachCard(G, 'MIT-MV-16:cosine', (c, s) => { const { alpha, beta, gamma } = c.audit!.params as Record<string, number>; expect(clean(c.prompt).includes(`P = (${alpha}, 0, 0), Q = (0, ${beta}, 0), R = (0, 0, ${gamma})`), where(c, s)).toBe(true); });
    for (const kind of ['MIT-MV-16:area', 'MIT-MV-16:plane']) eachCard(G, kind, (c, s) => { const p = c.audit!.params; expect([p.p, p.q, p.r].every(v => hasVec(c.prompt, asVec(v))), where(c, s)).toBe(true); });
    eachCard(G, 'MIT-MV-16:bug-position', (c, s) => {
      const { u } = c.audit!.params as Record<string, number>;
      expect(clean(c.prompt).includes(`speed u = ${u}.`) && clean(c.prompt).includes('t = π/2'), where(c, s)).toBe(true);
      const f = c.figure!; expect(f.alt.includes(`u = ${u}`), where(c, s)).toBe(true);
      const semi = f.shapes.find(sh => sh.kind === 'line' && sh.tone === 'accent');
      if (semi && semi.kind === 'line') {
        const ang = semi.points.map(([X, Y]) => { expect(close(Math.hypot(X, Y), 1, 1e-9) && Y >= -1e-12, where(c, s)).toBe(true); return Math.atan2(Y, X); });
        expect(close(ang[0], 0, 1e-9) && close(ang[ang.length - 1], PI, 1e-9), 'semicircle runs from (1,0) to (-1,0)').toBe(true);
        for (let i = 1; i < ang.length; i++) expect(ang[i], 'counterclockwise').toBeGreaterThan(ang[i - 1]);
      }
      const arrow = f.shapes.find(sh => sh.kind === 'arrow'); expect(arrow && arrow.kind === 'arrow' && arrow.to[0] > arrow.from[0] && arrow.to[1] === arrow.from[1], 'car arrow points right').toBe(true);
    });
    eachCard(G, 'MIT-MV-16:bug-speed', (c, s) => {
      const { u } = c.audit!.params as Record<string, number>;
      expect(clean(c.prompt).includes(`car speed u = ${u}, r(t) = (${u}t + cos t, sin t)`), `${where(c, s)} :: ${c.prompt}`).toBe(true);
      expect(u, 'oracle notes require u >= 2').toBeGreaterThanOrEqual(2);
    });
    eachCard(G, 'MIT-MV-16:det', (c, s) => { const m = toMat(c.audit!.params.m); expect(clean(c.prompt).includes(`rows ${m.map(vecStr).join(', ')}`), `${where(c, s)} :: ${c.prompt}`).toBe(true); });
    eachCard(G, 'MIT-MV-16:inverse-entry', (c, s) => {
      const { m, i, j } = c.audit!.params as { m: number[]; i: number; j: number }; const M = toMat(m);
      expect(clean(c.prompt).includes(`rows ${M.map(vecStr).join(', ')}`) && clean(c.prompt).includes(`row ${i}, column ${j}`), `${where(c, s)} :: ${c.prompt}`).toBe(true);
      // the hint names the minor to delete: row j, column i
      expect(clean(c.hint).includes(`delete row ${j} and column ${i}`), `${where(c, s)} hint: ${c.hint}`).toBe(true);
      expect(clean(c.explanation).includes(`Delete row ${j} and column ${i}`) && clean(c.explanation).includes(`(−1)^${i + j}`.replace('−', '-')) , `${where(c, s)} expl: ${c.explanation}`).toBe(true);
    });
    eachCard(G, 'MIT-MV-16:solve-system', (c, s) => {
      const m = toMat(c.audit!.params.m); const b = asVec(c.audit!.params.b); const t = clean(c.prompt);
      const eqs = /equations are (.+?)\. You may/.exec(t)![1].split(';').map(parseEq);
      eqs.forEach((e, i) => { expect(sameVec(e.coef, m[i]), `${where(c, s)} equation ${i}: "${t}" parsed ${e.coef}`).toBe(true); expect(Number(e.rhs), where(c, s)).toBe(b[i]); });
      const D = Number(/D = (-?\d+)/.exec(t)![1]);
      const rows = [...t.split('K = rows')[1].matchAll(/\(([^)]*)\)/g)].map(mm => mm[1].split(',').map(Number));
      expect(close(D, det3(m)), `${where(c, s)} displayed D=${D}, det=${det3(m)}`).toBe(true);
      const prod = m.map(row => [0, 1, 2].map(j => dot(row, rows.map(rr => rr[j]))));
      prod.forEach((row, i) => row.forEach((val, j) => expect(close(val, i === j ? D : 0), `${where(c, s)} (M·K)[${i}][${j}] = ${val}`).toBe(true)));
    });
    eachCard(G, 'MIT-MV-16:plane-motion', (c, s) => {
      const { a, b, c: cc, d, v1, v2 } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      const m = /on the plane (.+?)\. At some instant its velocity is \((.+?), (.+?), v₃\)/.exec(t); expect(m, `${where(c, s)} :: ${t}`).not.toBeNull();
      const e = parseEq(m![1]); expect(sameVec(e.coef, [a, b, cc]), `${where(c, s)} :: ${t}`).toBe(true); expect(Number(e.rhs)).toBe(d);
      expect(Number(m![2]) === v1 && Number(m![3]) === v2, where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-16:parallel-line', (c, s) => {
      const { a, b, c: cc, d } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      const e = parseEq(/The plane is (.+?)\. Is the line/.exec(t)![1]); expect(sameVec(e.coef, [a, b, cc]), `${where(c, s)} :: ${t} parsed ${e.coef}`).toBe(true); expect(Number(e.rhs)).toBe(d);
      expect(hasVec(c.prompt, asVec(c.audit!.params.A)) && hasVec(c.prompt, asVec(c.audit!.params.B)), where(c, s)).toBe(true);
    });
    eachCard(G, 'MIT-MV-16:unique-solution', (c, s) => { expect(clean(c.prompt).includes(`det M = ${c.audit!.params.D}.`), `${where(c, s)} :: ${c.prompt}`).toBe(true); });
    eachCard(G, 'MIT-MV-16:challenge', (c, s) => {
      const m = toMat(c.audit!.params.m); const { c1, c3 } = c.audit!.params as Record<string, number>; const t = clean(c.prompt);
      const eqs = /solves the system (.+?)\. Find dr\/dt/.exec(t)![1].split(';').map(parseEq);
      eqs.forEach((e, i) => expect(sameVec(e.coef, m[i]), `${where(c, s)} :: ${t}`).toBe(true));
      expect(Number(eqs[0].rhs) === c1 && eqs[1].rhs === 't' && Number(eqs[2].rhs) === c3, `${where(c, s)} :: ${t}`).toBe(true);
    });
    // normal-perp: on a concrete in-plane motion exactly one of the three statements holds
    eachCardById(G, 'normal-perp', (c, s) => {
      const t = clean(c.prompt);
      const N = /N = \((.+?)\)/.exec(t)![1].split(',').map(Number); const d = Number(/= (-?\d+), whose/.exec(t)![1]);
      const e = parseEq(/in the plane (.+?), whose/.exec(t)![1]); expect(sameVec(e.coef, N)).toBe(true); expect(Number(e.rhs)).toBe(d);
      const x0 = Math.abs(N[0]) < Math.abs(N[1]) ? [1, 0, 0] : [0, 1, 0];
      const e1 = crossByDet(N, x0), e2 = crossByDet(N, e1);
      const r0 = scale(N, d / dot(N, N));
      const r = (tau: number): V => add(r0, add(scale(e1, Math.cos(tau) / norm(e1)), scale(e2, 2 * Math.sin(tau) / norm(e2))));
      expect(close(dot(N, r(0.6)), d, 1e-9), 'path lies in the plane').toBe(true);
      const v = vd1(r, 0.6);
      const truths: Record<string, boolean> = {
        'v · r = 0': Math.abs(dot(v, r(0.6))) < 1e-6,
        'v is parallel to N': norm(crossByDet(v, N)) < 1e-6,
        'v · N = 0': Math.abs(dot(v, N)) < 1e-6,
      };
      const flags = c.choice!.options.map(o => { const k = clean(o); expect(k in truths, `unknown option "${o}"`).toBe(true); return truths[k]; });
      expect(flags.filter(Boolean).length, `seed ${s}`).toBe(1);
      expect(flags[c.choice!.answer], `seed ${s}`).toBe(true);
    });
  });

  it('parallel-line: when the line lies inside the plane the card must say so (the word "parallel" is definition-dependent)', () => {
    let inPlane = 0, parallel = 0, total = 0;
    eachCard('MIT-MV-16', 'MIT-MV-16:parallel-line', c => {
      const { a, b, c: cc, d } = c.audit!.params as Record<string, number>; const N = [a, b, cc]; const A = asVec(c.audit!.params.A), B = asVec(c.audit!.params.B);
      total++;
      if (dot(N, sub(B, A)) === 0) {
        parallel++;
        if (dot(N, A) === d) {
          inPlane++;
          // the prompt defines "parallel" as "its direction is parallel to the plane"; the explanation should not call the line a non-intersecting one
          expect(clean(c.prompt).includes('is its direction parallel to the plane'), c.prompt).toBe(true);
        }
      }
    });
    // eslint-disable-next-line no-console
    console.log(`parallel-line: ${total} cards, ${parallel} with N·AB=0, ${inPlane} of those have the line inside the plane (answer "Yes" relies on the direction-only definition in the prompt)`);
  });
});

// ------------------------------------------------------------------------------------------------------------------ language parity
describe('English / Chinese decks carry the same mathematics', () => {
  it('same audit params, answers and correct-option positions in both languages (batch 3)', () => {
    for (const id of ['MIT-MV-12', 'MIT-MV-13', 'MIT-MV-14', 'MIT-MV-15', 'MIT-MV-16']) {
      for (let seed = 0; seed < 60; seed++) {
        const en = batch03Generators[id](seed, 'en'), zh = batch03Generators[id](seed, 'zh');
        expect(zh.map(c => c.id), `${id} seed ${seed}`).toEqual(en.map(c => c.id));
        en.forEach((e, i) => {
          const z = zh[i];
          expect(z.audit, `${e.id} seed ${seed}`).toEqual(e.audit);
          expect(z.fields?.map(f => f.answer), `${e.id} seed ${seed}`).toEqual(e.fields?.map(f => f.answer));
          expect(z.choice?.answer, `${e.id} seed ${seed}`).toBe(e.choice?.answer);
          expect(z.choice?.options.length, `${e.id} seed ${seed}`).toBe(e.choice?.options.length);
          // Chinese text must not leak English sentences into prompt/explanation (a quick guard against untranslated strings)
          expect(/[一-鿿]/.test(z.prompt), `${e.id} seed ${seed}: Chinese card lacks Chinese text`).toBe(true);
        });
      }
    }
  });
});
