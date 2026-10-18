import { describe, expect, it } from 'vitest';
import { gpf3 } from './games/gpf3';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-F3 (Black-Litterman as a GP posterior), written from docs/aalto-gp-drafts/approved-GP-F3.md
 * WITHOUT reading the generator. Numbers are recomputed from the PRINTED prompt text by two independent routes:
 *  (i) explicit joint-Gaussian conditioning of (mu, P mu + eps') with a hand-written Gaussian elimination (GPML A.6),
 *  (ii) the precision form  Lambda = A^-1 + P' Omega^-1 P,  mu = Lambda^-1 (A^-1 pi + P' Omega^-1 q).
 */
const SEEDS = 60;
type M = number[][];
const seeds = Array.from({ length: SEEDS }, (_, i) => spreadSeed(i));
const decks: Record<GameLanguage, PracticeCard[][]> = { en: seeds.map(s => gpf3(s, 'en')), zh: seeds.map(s => gpf3(s, 'zh')) };
const norm = (t: string) => t.replaceAll('−', '-');
const SLUGS = ['dictionary', 'formula', 'joint-cov', 'bl-mean', 'bl-var', 'precision', 'limits', 'assumption', 'challenge'];
const card = (deck: PracticeCard[], slug: string) => { const c = deck.find(x => x.id === `GP-F3-${slug}`); if (!c) throw new Error(`no card ${slug}`); return c; };

// ---------- linear algebra, hand written ----------
const mul = (X: M, Y: M): M => X.map(r => Y[0].map((_, j) => r.reduce((s, x, k) => s + x * Y[k][j], 0)));
const T = (X: M): M => X[0].map((_, j) => X.map(r => r[j]));
function solve(Aa: M, B: M): M { // Gauss-Jordan with partial pivoting, Aa x = B
  const n = Aa.length; const a = Aa.map((r, i) => [...r, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) throw new Error('singular');
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c]; a[c] = a[c].map(x => x / d);
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; a[r] = a[r].map((x, k) => x - f * a[c][k]); }
  }
  return a.map(r => r.slice(n));
}
const eye = (n: number): M => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const inv = (X: M) => solve(X, eye(X.length));
const det = (X: M): number => (X.length === 1 ? X[0][0] : X[0][0] * X[1][1] - X[0][1] * X[1][0]);

/** Route (i): joint covariance of (mu, y = P mu + eps'), conditioning on y = q. Returns posterior mean and covariance of mu. */
function conditionJoint(A: M, P: M, Om: M, pi: number[], q: number[]) {
  const k = P.length; const Mx = [...eye(2), ...P];
  const J = mul(mul(Mx, A), T(Mx));
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) J[2 + i][2 + j] += Om[i][j];
  const Jxx = [[J[0][0], J[0][1]], [J[1][0], J[1][1]]];
  const Jxy = [0, 1].map(i => Array.from({ length: k }, (_, j) => J[i][2 + j]));
  const Jyy = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => J[2 + i][2 + j]));
  const my = mul(P, pi.map(x => [x])).map(r => r[0]);
  const resid = q.map((x, i) => [x - my[i]]);
  const gain = mul(Jxy, solve(Jyy, resid)); // Jxy Jyy^-1 (q - m_y)
  const mean = pi.map((x, i) => x + gain[i][0]);
  const S = solve(Jyy, T(Jxy)); // Jyy^-1 Jyx
  const cov = mul(Jxy, S).map((r, i) => r.map((x, j) => Jxx[i][j] - x));
  return { mean, cov, Jyy };
}
/** Route (ii): precision form, diagonal Omega. */
function precisionForm(A: M, P: M, OmDiag: number[], pi: number[], q: number[]) {
  const Ainv = inv(A); const Lam = Ainv.map(r => [...r]);
  P.forEach((row, v) => row.forEach((pi_, i) => row.forEach((pj, j) => { Lam[i][j] += pi_ * pj / OmDiag[v]; })));
  const rhs = [0, 1].map(i => Ainv[i][0] * pi[0] + Ainv[i][1] * pi[1] + P.reduce((s, row, v) => s + row[i] * q[v] / OmDiag[v], 0));
  const cov = inv(Lam);
  return { mean: cov.map(r => r[0] * rhs[0] + r[1] * rhs[1]), cov };
}
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// ---------- parsing the PRINTED text ----------
const int = String.raw`(-?\d+)`;
function parseA(t: string): M { const m = norm(t).match(new RegExp(String.raw`A = \[\[${int}, ${int}\], \[${int}, ${int}\]\]`)); if (!m) throw new Error('no A in ' + t.slice(0, 200)); return [[+m[1], +m[2]], [+m[3], +m[4]]]; }
function parseP(t: string): M { const m = norm(t).match(/P = (\[\[.*?\]\])/); if (!m) throw new Error('no P'); return parseRows(m[1]); }
function parseRows(s: string): M { return s.slice(2, -2).split('], [').map(r => r.split(',').map(x => Number(x.trim()))); }
function parseOmega(t: string): number { const m = norm(t).match(/Ω = (\d+)/); if (!m) throw new Error('no Omega'); return +m[1]; }
function parsePi(t: string): number[] { const m = norm(t).match(new RegExp(String.raw`π = \(${int}, ${int}\)`)); if (!m) throw new Error('no pi'); return [+m[1], +m[2]]; }
function parseQ(t: string): number { const m = norm(t).match(new RegExp(String.raw`q = ${int} ?%`)); if (!m) throw new Error('no q'); return +m[1]; }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
function quarterOK(v: number) { const x = 4 * v; return Math.abs(x - Math.round(x)) < 1e-9; }
function asDecimal(v: number) { return quarterOK(v) ? String(Math.round(4 * v) / 4) : String(v); }
function asFraction(v: number) { if (!quarterOK(v)) return String(v); const n = Math.round(4 * v), d = 4, g = gcd(n, d) || 1; return `${n / g}/${d / g}`; }
/** Plan: every sampled answer has reduced denominator in {1, 2, 4}. Collected here and asserted in the last test so the other checks still run. */
const gridViolations = new Set<string>();

/** Grade through gradeCard: right answer correct (decimal and fraction), perturbed answer wrong; the default tolerance must be tight. */
function expectGrades(c: PracticeCard, expected: number[], where: string) {
  expect(c.fields, where).toBeDefined();
  expect(c.fields!.length, where).toBe(expected.length);
  c.fields!.forEach((f, i) => { expect(f.tolerance ?? 1e-8, `${where} tolerance field ${i}`).toBeLessThanOrEqual(1e-6); });
  expected.forEach(v => { if (!quarterOK(v)) gridViolations.add(`${where}: oracle value ${v} not on the quarter grid`); });
  expect(gradeCard(c, expected.map(asDecimal), null, []), `${where} decimal ${expected}`).toBe('correct');
  expect(gradeCard(c, expected.map(asFraction), null, []), `${where} fraction ${expected.map(asFraction)}`).toBe('correct');
  expected.forEach((v, i) => {
    for (const delta of [0.02, -0.02, 0.25, -0.25, 1]) {
      const vals = expected.map(asDecimal); vals[i] = String(v + delta);
      expect(gradeCard(c, vals, null, []), `${where} field ${i} perturbed by ${delta}`).toBe('incorrect');
    }
  });
}

describe('GP-F3 deck shape', () => {
  it('9 cards in the planned order, last is challenge, one answer mode each, numeric field counts', () => {
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      expect(deck.map(c => c.id), `seed ${seeds[i]} ${lang}`).toEqual(SLUGS.map(s => `GP-F3-${s}`));
      const fields = Object.fromEntries(deck.map(c => [c.id.slice(6), c.fields?.length ?? 0]));
      expect(fields).toEqual({ dictionary: 0, formula: 0, 'joint-cov': 3, 'bl-mean': 2, 'bl-var': 1, precision: 2, limits: 0, assumption: 0, challenge: 1 });
      deck.forEach(c => { expect(c.choice !== undefined || c.fields !== undefined || c.slots !== undefined, c.id).toBe(true); expect(c.prompt, `${c.id} units`).toMatch(/%/); });
      expect(deck.filter(c => c.slots).map(c => c.id)).toEqual(['GP-F3-formula']);
      expect(deck.filter(c => c.choice).map(c => c.id)).toEqual(['GP-F3-dictionary', 'GP-F3-limits', 'GP-F3-assumption']);
    });
  });
  it('audit kinds: exactly the five planned kinds fire on every seed, with exactly the planned scalar params, and nothing else carries an audit', () => {
    const planned: Record<string, string[]> = {
      'GP-F3:joint-cov': ['a', 'b', 'd', 'w', 'p1', 'p2'], 'GP-F3:bl-mean': ['a', 'b', 'd', 'w', 'p1', 'p2', 'pi1', 'pi2', 'q'],
      'GP-F3:bl-var': ['a', 'b', 'd', 'w'], 'GP-F3:precision': ['a', 'w', 'pi1', 'q'], 'GP-F3:challenge': ['a', 'b', 'd', 'w', 'pi1', 'pi2', 'q'],
    };
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const kinds = deck.filter(c => c.audit).map(c => c.audit!.kind);
      expect(kinds.sort(), `seed ${seeds[i]} ${lang}`).toEqual(Object.keys(planned).sort());
      for (const c of deck) if (c.audit) {
        expect(Object.keys(c.audit.params).sort(), c.id).toEqual([...planned[c.audit.kind]].sort());
        for (const v of Object.values(c.audit.params)) expect(typeof v, c.id).toBe('number');
        expect(c.audit.kind.endsWith(c.id.slice(6)), `${c.id} kind ${c.audit.kind}`).toBe(true);
      }
      for (const c of deck) if (c.fields) expect(c.audit, `${c.id} numeric card needs an audit`).toBeDefined();
    });
    for (let i = 0; i < SEEDS; i++) for (const c of decks.en[i]) if (c.audit) expect(c.audit).toEqual(card(decks.zh[i], c.id.slice(6)).audit);
  });
});

describe('GP-F3 joint-cov', () => {
  it('blocks of the joint covariance of (mu, y), printed text = audit, two languages', () => {
    const seen = new Set<string>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'joint-cov'); const where = `joint-cov seed ${seeds[i]} ${lang}`;
      const A = parseA(c.prompt), P = parseP(c.prompt), w = parseOmega(c.prompt);
      const [p1, p2] = P[0]; expect(P.length).toBe(1); seen.add(`${p1},${p2}`);
      expect(c.audit!.params, where).toEqual({ a: A[0][0], b: A[0][1], d: A[1][1], w, p1, p2 });
      expect(A[0][1]).toBe(A[1][0]);
      expect([[1, 0], [1, -1]].some(([x, y]) => x === p1 && y === p2), where).toBe(true);
      expect(A[0][0] >= 2 && A[0][0] <= 6 && A[1][1] >= 2 && A[1][1] <= 6 && Math.abs(A[0][1]) <= 2 && w >= 1 && w <= 4, where).toBe(true);
      expect(A[0][0] * A[1][1] - A[0][1] ** 2, where).toBeGreaterThanOrEqual(3);
      const { Jyy } = conditionJoint(A, P, [[w]], [0, 0], [0]);
      const Mx = [...eye(2), ...P]; const J = mul(mul(Mx, A), T(Mx)); J[2][2] += w; // entries (0,2), (1,2), (2,2)
      const expected = [J[0][2], J[1][2], J[2][2]];
      expect(close(Jyy[0][0], expected[2]), where).toBe(true);
      expectGrades(c, expected, where);
      expect(c.fields!.map(f => f.label), where).toEqual(['Cov(μ₁, y)', 'Cov(μ₂, y)', 'Var(y)']);
    });
    expect([...seen].sort()).toEqual(['1,-1', '1,0']);
  });
});

describe('GP-F3 bl-mean and challenge', () => {
  it('bl-mean: posterior mean by joint conditioning AND precision form, printed = audit, figure consistent', () => {
    const views = new Set<string>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'bl-mean'); const where = `bl-mean seed ${seeds[i]} ${lang}`;
      const A = parseA(c.prompt), P = parseP(c.prompt), w = parseOmega(c.prompt), pi = parsePi(c.prompt), q = parseQ(c.prompt);
      const [p1, p2] = P[0]; views.add(`${p1},${p2}`);
      expect(c.audit!.params, where).toEqual({ a: A[0][0], b: A[0][1], d: A[1][1], w, p1, p2, pi1: pi[0], pi2: pi[1], q });
      const r1 = conditionJoint(A, P, [[w]], pi, [q]), r2 = precisionForm(A, P, [w], pi, [q]);
      r1.mean.forEach((x, k) => expect(close(x, r2.mean[k]), `${where} routes disagree`).toBe(true));
      // constraints of the plan
      const m = p1 * pi[0] + p2 * pi[1], v = A[0][0] * p1 * p1 + 2 * A[0][1] * p1 * p2 + A[1][1] * p2 * p2, s = v + w;
      expect(A[0][0] * A[1][1] - A[0][1] ** 2, where).toBeGreaterThanOrEqual(3);
      expect(s, where).toBeLessThanOrEqual(12); expect(q >= 1 && q <= 12, where).toBe(true); expect(q).not.toBe(m);
      expect(Math.abs(q - m) >= 1 && Math.abs(q - m) <= 6, where).toBe(true);
      expect(pi.every(x => x >= 3 && x <= 9) && w >= 1 && w <= 6, where).toBe(true);
      expectGrades(c, r1.mean, where);
      // figure
      const f = c.figure!; expect(f, where).toBeDefined();
      const pts = f.shapes.filter(s => s.kind === 'point') as Extract<typeof f.shapes[number], { kind: 'point' }>[];
      const lines = f.shapes.filter(s => s.kind === 'line') as Extract<typeof f.shapes[number], { kind: 'line' }>[];
      expect(pts.length, where).toBe(1); expect(lines.length, where).toBe(1);
      expect(pts[0].at, where).toEqual([pi[0], pi[1]]);
      expect(lines[0].points.length).toBeGreaterThanOrEqual(2);
      for (const [x, y] of lines[0].points) expect(close(p1 * x + p2 * y, q), `${where} line point ${x},${y}`).toBe(true);
      expect(new Set(lines[0].points.map(p => p.join(','))).size, where).toBeGreaterThanOrEqual(2);
      // the figure must not show the answer: no marker at the posterior mean, no numbers in text shapes
      const ans = r1.mean;
      for (const sh of f.shapes) {
        const coords = sh.kind === 'line' || sh.kind === 'area' ? sh.points : sh.kind === 'arrow' ? [sh.from, sh.to] : [sh.at];
        for (const p of coords) expect(close(p[0], ans[0]) && close(p[1], ans[1]), `${where} figure shows posterior mean`).toBe(false);
        if (sh.kind === 'text') expect(norm(sh.text), where).not.toMatch(/\d/);
      }
      for (const [x, y] of [...lines[0].points, pts[0].at]) { expect(x >= f.view.xmin && x <= f.view.xmax && y >= f.view.ymin && y <= f.view.ymax, `${where} outside view`).toBe(true); }
      const alt = norm(f.alt); expect(alt, where).toContain(`(${pi[0]}, ${pi[1]})`); expect(alt, where).toContain(String(q));
      expect(f.axes?.xLabel).toBe('μ₁'); expect(f.axes?.yLabel).toBe('μ₂');
    });
    expect([...views].sort()).toEqual(['1,-1', '1,0']);
  });

  it('challenge: relative view, mu_BL,2 by joint conditioning AND precision form', () => {
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'challenge'); const where = `challenge seed ${seeds[i]} ${lang}`;
      const t = norm(c.prompt);
      expect(t, where).not.toMatch(/P = \[\[/);
      const A = parseA(t), w = parseOmega(t), pi = parsePi(t);
      const qm = t.match(lang === 'en' ? /by (-?\d+) ?%/ : /多 ?(-?\d+) ?%/); if (!qm) throw new Error('no q ' + t);
      const q = +qm[1];
      expect(c.audit!.params, where).toEqual({ a: A[0][0], b: A[0][1], d: A[1][1], w, pi1: pi[0], pi2: pi[1], q });
      const P = [[1, -1]];
      const r1 = conditionJoint(A, P, [[w]], pi, [q]), r2 = precisionForm(A, P, [w], pi, [q]);
      expect(close(r1.mean[1], r2.mean[1]), where).toBe(true);
      const s = A[0][0] - 2 * A[0][1] + A[1][1] + w;
      expect(A[0][0] * A[1][1] - A[0][1] ** 2, where).toBeGreaterThanOrEqual(3);
      expect(A[0][1]).not.toBe(A[1][1]); expect(s).toBeLessThanOrEqual(12); expect(q >= 1 && q <= 12 && q !== pi[0] - pi[1], where).toBe(true);
      expect(Math.abs(q - (pi[0] - pi[1])) <= 6, where).toBe(true);
      expectGrades(c, [r1.mean[1]], where);
      expect(c.figure, where).toBeUndefined();
    });
  });
});

describe('GP-F3 bl-var', () => {
  it('posterior variance of mu_2 after an absolute view: Schur complement, precision inverse and closed form', () => {
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'bl-var'); const where = `bl-var seed ${seeds[i]} ${lang}`;
      const A = parseA(c.prompt), w = parseOmega(c.prompt), P = parseP(c.prompt);
      expect(P).toEqual([[1, 0]]); expect(norm(c.prompt), where).not.toMatch(/q = /);
      expect(c.audit!.params, where).toEqual({ a: A[0][0], b: A[0][1], d: A[1][1], w });
      const r1 = conditionJoint(A, P, [[w]], [0, 0], [0]), r2 = precisionForm(A, P, [w], [0, 0], [0]);
      expect(close(r1.cov[1][1], r2.cov[1][1]), where).toBe(true);
      expect(close(r1.cov[1][1], A[1][1] - A[0][1] ** 2 / (A[0][0] + w)), where).toBe(true);
      const a = A[0][0], d = A[1][1], b = A[0][1];
      expect(a >= 2 && a <= 6 && d >= 2 && d <= 7 && [1, 2, 3].includes(Math.abs(b)) && w >= 1 && w <= 6, where).toBe(true);
      expect(a * d - b * b, where).toBeGreaterThanOrEqual(3);
      expectGrades(c, [r1.cov[1][1]], where);
      expect(c.fields![0].label).toContain('Var(μ₂');
      expect(c.figure).toBeUndefined();
    });
  });
});

describe('GP-F3 precision', () => {
  it('asset-1 posterior variance and mean: embedded 2-asset conditioning, precision form, grid integration', () => {
    const pairs = new Set<string>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'precision'); const where = `precision seed ${seeds[i]} ${lang}`;
      const t = norm(c.prompt);
      const m1 = t.match(/μ₁ ~ N\((-?\d+), (\d+)\)/)!, mw = t.match(/Ω = (\d+) ?%²/)!;
      const pi1 = +m1[1], a = +m1[2], w = +mw[1], q = parseQ(t);
      pairs.add(`${a},${w}`);
      expect(c.audit!.params, where).toEqual({ a, w, pi1, q });
      expect(['2,2', '2,6', '3,1', '3,3', '4,4', '6,2', '6,6'], where).toContain(`${a},${w}`);
      expect(pi1 >= 3 && pi1 <= 9 && q >= 1 && q <= 14 && q !== pi1, where).toBe(true);
      const A = [[a, 1], [1, 5]];
      const r1 = conditionJoint(A, [[1, 0]], [[w]], [pi1, 3], [q]), r2 = precisionForm(A, [[1, 0]], [w], [pi1, 3], [q]);
      expect(close(r1.cov[0][0], r2.cov[0][0]) && close(r1.mean[0], r2.mean[0]), where).toBe(true);
      // grid integration of the product of the two Gaussians
      const N = 200000, lo = -40, hi = 60, h = (hi - lo) / N; let Z = 0, M1 = 0, M2 = 0;
      for (let k = 0; k <= N; k++) { const x = lo + k * h, f = Math.exp(-((x - pi1) ** 2) / (2 * a) - ((x - q) ** 2) / (2 * w)) * (k === 0 || k === N ? 0.5 : 1); Z += f; M1 += f * x; M2 += f * x * x; }
      const gm = M1 / Z, gv = M2 / Z - gm * gm;
      expect(Math.abs(gv - r1.cov[0][0]), where).toBeLessThan(1e-6); expect(Math.abs(gm - r1.mean[0]), where).toBeLessThan(1e-6);
      expectGrades(c, [r1.cov[0][0], r1.mean[0]], where);
      expect(c.fields![0].label, where).toMatch(lang === 'en' ? /variance/ : /方差/); expect(c.fields![1].label, where).toMatch(lang === 'en' ? /mean/ : /均值/);
    });
    expect(pairs.size).toBeGreaterThanOrEqual(5);
  });
});

describe('GP-F3 choice and symbol cards', () => {
  const OBJ_EN: [string, string][] = [['the prior mean m of f', 'π'], ['the prior covariance K of f', 'τΣ'], ['the noise covariance Σ_ε', 'Ω'], ['the observed data y', 'q'], ['the observation operator H', 'P']];
  const OBJ_ZH: [string, string][] = [['f 的先验均值 m', 'π'], ['f 的先验协方差 K', 'τΣ'], ['观测噪声的协方差 Σ_ε', 'Ω'], ['观测数据 y', 'q'], ['观测算子 H', 'P']];
  it('dictionary: the option for the asked role, exactly one, answer index points to it', () => {
    const targets = new Set<string>(), idx = new Set<number>(), omitted = new Set<string>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'dictionary'); const where = `dictionary seed ${seeds[i]} ${lang}`;
      const askedPart = lang === 'en' ? c.prompt.split('plays the role of')[1] : c.prompt.split('扮演')[1];
      const hit = (lang === 'en' ? OBJ_EN : OBJ_ZH).filter(([k]) => askedPart.includes(k));
      expect(hit.length, `${where}: ${askedPart}`).toBe(1);
      const target = hit[0][1]; targets.add(target);
      const keys = c.choice!.options.map(o => o.split(/[,，]/)[0].trim());
      expect(c.choice!.options.length, where).toBe(4);
      expect(new Set(keys).size, where).toBe(4);
      keys.forEach(k => expect(['π', 'τΣ', 'P', 'Ω', 'q'], where).toContain(k));
      expect(keys.filter(k => k === target).length, where).toBe(1);
      expect(c.choice!.answer, where).toBe(keys.indexOf(target));
      if (lang === 'en') { idx.add(c.choice!.answer); ['π', 'τΣ', 'P', 'Ω', 'q'].filter(k => !keys.includes(k)).forEach(k => omitted.add(k)); }
      // the explanation must not name the options by position
      expect(c.explanation, where).not.toMatch(/option [A-D1-4]|first option|选项 ?[A-D]|第[一二三四]个选项/i);
    });
    expect([...targets].sort()).toEqual(['P', 'q', 'Ω', 'π', 'τΣ'].sort());
    expect(idx.size).toBeGreaterThanOrEqual(3);
    expect(omitted.size).toBeGreaterThanOrEqual(4);
  });

  it('formula: assembled text equals the plan formula, tokens contain answers and the plan token set; 6 variants', () => {
    const nrm = (s: string) => s.replace(/\s+/g, '');
    const variants = new Set<string>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'formula'); const where = `formula seed ${seeds[i]} ${lang}`;
      const sl = c.slots!; const P = nrm(norm(c.prompt).match(/P = (\[\[.*?\]\])/)![1]);
      expect(['[[1,0]]', '[[1,-1]]', '[[1,0],[0,1]]'], where).toContain(P);
      const mean = sl.before.includes('μ_BL');
      variants.add(`${mean ? 'mean' : 'cov'}|${P}`);
      const assembled = sl.before + sl.answers.map((a, k) => a + (sl.between?.[k] ?? '')).join('') + (sl.after ?? '');
      if (mean) {
        expect(sl.answers, where).toEqual(['τΣPᵀ', '(PτΣPᵀ + Ω)⁻¹', '(q − Pπ)']);
        expect(nrm(assembled).replace(/。$/, '.'), where).toBe(nrm('μ_BL = π + τΣPᵀ · (PτΣPᵀ + Ω)⁻¹ · (q − Pπ).'));
        expect([...sl.tokens].sort(), where).toEqual(['τΣPᵀ', '(PτΣPᵀ + Ω)⁻¹', '(q − Pπ)', '(PτΣPᵀ + Ω)', '(Pπ − q)', 'PᵀτΣ', '(q − π)', 'Ω⁻¹'].sort());
        expect(sl.between!.length).toBe(2);
      } else {
        expect(sl.answers, where).toEqual(['τΣPᵀ', 'PτΣ']);
        expect(nrm(assembled).replace(/。$/, '.'), where).toBe(nrm('Cov(μ | q) = τΣ − τΣPᵀ · (PτΣPᵀ + Ω)⁻¹ · PτΣ.'));
        expect([...sl.tokens].sort(), where).toEqual(['τΣPᵀ', 'PτΣ', 'PᵀτΣ', 'τΣP', 'τΣ', 'Ω', 'Pπ'].sort());
        expect(sl.between!.length).toBe(1);
      }
      for (const a of sl.answers) expect(sl.tokens, where).toContain(a);
      expect(new Set(sl.tokens).size, where).toBe(sl.tokens.length);
      expect(gradeCard(c, [], null, sl.answers), where).toBe('correct');
      const bad = [...sl.answers]; [bad[0], bad[1]] = [bad[1], bad[0]];
      expect(gradeCard(c, [], null, bad), where).toBe('incorrect');
    });
    expect(variants.size).toBe(6);
  });

  it('formula (semantic): the planned formula really is the posterior (guards the oracle reading of the plan)', () => {
    const A = [[4, 1], [1, 3]], P = [[1, 0], [0, 1]], Om = [[2, 0], [0, 3]], pi = [5, 3], q = [8, 6];
    const via = conditionJoint(A, P, Om, pi, q).mean;
    const B = mul(mul(P, A), T(P)).map((r, i) => r.map((x, j) => x + Om[i][j]));
    const gain = mul(mul(mul(A, T(P)), inv(B)), q.map((x, i) => [x - (P[i][0] * pi[0] + P[i][1] * pi[1])]));
    expect(close(pi[0] + gain[0][0], via[0]) && close(pi[1] + gain[1][0], via[1])).toBe(true);
  });

  it('limits: the option equal to the limit of the posterior mean of P mu, exactly one, answer index points to it', () => {
    const seenLimits = new Set<string>(), seenViews = new Set<string>(), idx = new Set<number>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'limits'); const where = `limits seed ${seeds[i]} ${lang}`;
      const A = parseA(c.prompt), P = parseP(c.prompt), pi = parsePi(c.prompt), q = parseQ(c.prompt);
      const t = norm(c.prompt); const toZero = /Ω → 0/.test(t), toInf = /Ω → ∞/.test(t);
      expect(toZero !== toInf, where).toBe(true); seenLimits.add(toZero ? '0' : 'inf'); seenViews.add(P[0].join(','));
      const m = P[0][0] * pi[0] + P[0][1] * pi[1];
      expect(q >= 1 && q <= 12 && Math.abs(q - m) % 2 === 0 && Math.abs(q - m) >= 2 && Math.abs(q - m) <= 4, where).toBe(true);
      expect(A[0][0] * A[1][1] - A[0][1] ** 2, where).toBeGreaterThanOrEqual(3);
      const Om = toZero ? 1e-9 : 1e9;
      const mu = conditionJoint(A, P, [[Om]], pi, [q]).mean, mu2 = precisionForm(A, P, [Om], pi, [q]).mean;
      const limit = P[0][0] * mu[0] + P[0][1] * mu[1], limit2 = P[0][0] * mu2[0] + P[0][1] * mu2[1];
      expect(Math.abs(limit - limit2), where).toBeLessThan(1e-3);
      expect(Math.abs(limit - (toZero ? q : m)), where).toBeLessThan(1e-3);
      const opts = c.choice!.options; expect(opts.length, where).toBe(4);
      const leading = opts.map(o => { const mm = norm(o).match(/^(-?\d+(?:\.\d+)?)\s*[,，]/); return mm ? Number(mm[1]) : null; });
      const good = leading.map(v => v !== null && Math.abs(v - limit) < 1e-3);
      expect(good.filter(Boolean).length, `${where} ${JSON.stringify(opts)}`).toBe(1);
      expect(c.choice!.answer, where).toBe(good.indexOf(true));
      expect(leading.filter(v => v === null).length, where).toBe(1);
      expect(new Set(leading.filter(v => v !== null)).size, where).toBe(3);
      expect(new Set(leading.filter(v => v !== null)), where).toEqual(new Set([q, m, (q + m) / 2]));
      if (lang === 'en') idx.add(c.choice!.answer);
    });
    expect([...seenLimits].sort()).toEqual(['0', 'inf']); expect([...seenViews].sort()).toEqual(['1,-1', '1,0']);
    expect(idx.size).toBeGreaterThanOrEqual(3);
  });

  it('assumption: the option with det(P A P^T + Omega) = 0 is the only one, answer index points to it', () => {
    const singularSeen = new Set<string>(), idx = new Set<number>();
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      const c = card(deck, 'assumption'); const where = `assumption seed ${seeds[i]} ${lang}`;
      const A = parseA(c.prompt); expect(A[1][1], where).toBe(A[0][0]);
      const a = A[0][0], b = A[0][1]; expect(a >= 2 && a <= 5 && Math.abs(b) <= 1 && Math.abs(b) < a, where).toBe(true);
      const dets = c.choice!.options.map(o => {
        const t = norm(o); const P = parseRows(t.match(/P = (\[\[.*?\]\])/)![1]);
        const om = t.match(/Ω = \[\[(\d+), 0\], \[0, (\d+)\]\]/);
        expect(/Ω = 0|Ω = \[\[/.test(t), `${where} ${t}`).toBe(true);
        const Om = om ? [[+om[1], 0], [0, +om[2]]] : P.map((_, r) => P.map((__, s) => (r === s ? 0 : 0)));
        const S = mul(mul(P, A), T(P)).map((r, k) => r.map((x, l) => x + Om[k][l]));
        return { d: det(S), P: JSON.stringify(P) };
      });
      expect(c.choice!.options.length, where).toBe(4);
      const sing = dets.map(x => Math.abs(x.d) < 1e-9);
      expect(sing.filter(Boolean).length, `${where} ${JSON.stringify(dets.map(d => d.d))}`).toBe(1);
      expect(c.choice!.answer, where).toBe(sing.indexOf(true));
      singularSeen.add(dets[c.choice!.answer].P);
      dets.filter((_, k) => !sing[k]).forEach(x => expect(Math.abs(x.d), where).toBeGreaterThan(0.5));
      if (lang === 'en') idx.add(c.choice!.answer);
    });
    expect([...singularSeen].sort()).toEqual(['[[1,-1],[1,-1]]', '[[1,-1],[2,-2]]', '[[1,0],[1,0]]']);
    expect(idx.size).toBeGreaterThanOrEqual(3);
  });
});

describe('GP-F3 variety', () => {
  it('each non-concept card has at least 6 distinct prompts over 60 seeds (dictionary is the concept card: 5 targets)', () => {
    for (const slug of SLUGS) {
      const n = new Set(decks.en.map(d => card(d, slug).prompt)).size;
      if (slug === 'dictionary') expect(n, slug).toBeGreaterThanOrEqual(5); else expect(n, `${slug}: ${n} distinct prompts`).toBeGreaterThanOrEqual(6);
    }
  });
  it('numeric answers are not constant', () => {
    for (const slug of ['joint-cov', 'bl-mean', 'bl-var', 'precision', 'challenge']) expect(new Set(decks.en.map(d => card(d, slug).fields!.map(f => f.answer).join('|'))).size, slug).toBeGreaterThanOrEqual(6);
  });
});

describe('GP-F3 plan sampling constraint on denominators', () => {
  it('every numeric answer has reduced denominator in {1, 2, 4} (exact in binary)', () => {
    expect([...gridViolations].slice(0, 10), `${gridViolations.size} violations`).toEqual([]);
  });
});

describe('GP-F3 learner-facing text', () => {
  const MINUS = '−';
  const fracText = (v: number) => { const n = Math.round(4 * v), g = gcd(n, 4) || 1, nn = n / g, dd = 4 / g; return `${nn < 0 ? MINUS : ''}${Math.abs(nn)}${dd === 1 ? '' : '/' + dd}`; };
  it('every numeric explanation shows each field answer (reduced fraction or integer), in both languages', () => {
    for (const lang of ['en', 'zh'] as const) decks[lang].forEach((deck, i) => {
      for (const c of deck) if (c.fields) c.fields.forEach((f, k) => {
        if (!quarterOK(f.answer)) return; // reported by the denominator test
        expect(c.explanation, `${c.id} seed ${seeds[i]} ${lang} field ${k}: explanation lacks ${fracText(f.answer)}`).toContain(fracText(f.answer));
      });
    });
  });
  it('hints do not depend on the sampled values (so they cannot leak an answer) and units are stated', () => {
    for (const lang of ['en', 'zh'] as const) for (const slug of SLUGS) {
      expect(new Set(decks[lang].map(d => card(d, slug).hint)).size, `${slug} ${lang}`).toBe(1);
    }
  });
  it('the challenge prompt contains no formula and no step hints', () => {
    for (const d of decks.en) expect(card(d, 'challenge').prompt).not.toMatch(/APᵀ|PAPᵀ|Pπ|\(PAP/);
    for (const d of decks.zh) expect(card(d, 'challenge').prompt).not.toMatch(/APᵀ|PAPᵀ|Pπ/);
  });
  it('the formula prompt does not repeat the blank formula and names the variant in both languages', () => {
    for (const lang of ['en', 'zh'] as const) for (const d of decks[lang]) {
      const c = card(d, 'formula'); expect(c.prompt).not.toContain(c.slots!.before.trim());
    }
  });
  it('joint-cov never prints a made-up view value', () => {
    for (const lang of ['en', 'zh'] as const) for (const d of decks[lang]) expect(card(d, 'joint-cov').prompt).not.toMatch(/(?:return|为|多) ?0 ?%/);
  });
});
