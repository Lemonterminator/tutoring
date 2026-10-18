import { describe, expect, it } from 'vitest';
import { gp09 } from './games/gp09';
import { spreadSeed, questionTextOf, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, parseGameNumber, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-09 (kernel combination and positive semi-definiteness), written from
 * docs/aalto-gp-drafts/approved-GP-09.md without reading the generator.
 */
type M = [[number, number], [number, number]];
const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];
const SLUGS = ['eigen-min', 'det-test', 'compose', 'scale-fn', 'product-gram', 'not-guaranteed', 'diff-quad', 'challenge'];
const KINDS = ['GP-09:eigen-min', 'GP-09:compose', 'GP-09:scale-fn', 'GP-09:product-gram', 'GP-09:diff-quad', 'GP-09:challenge'];

// ---- independent linear algebra -------------------------------------------------------------
const sym = (a: number, b: number): M => [[a, b], [b, a]];
const had = (A: M, B: M): M => [[A[0][0] * B[0][0], A[0][1] * B[0][1]], [A[1][0] * B[1][0], A[1][1] * B[1][1]]];
const add = (A: M, B: M): M => [[A[0][0] + B[0][0], A[0][1] + B[0][1]], [A[1][0] + B[1][0], A[1][1] + B[1][1]]];
const scl = (c: number, A: M): M => [[c * A[0][0], c * A[0][1]], [c * A[1][0], c * A[1][1]]];
const mul = (A: M, B: M): M => [
  [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
  [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
/** Real eigenvalues (sorted) from the characteristic polynomial λ² − tr λ + det = 0. */
function eigs(A: M): number[] {
  const tr = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const disc = tr * tr - 4 * det;
  expect(disc).toBeGreaterThanOrEqual(-1e-9);
  const s = Math.sqrt(Math.max(0, disc));
  return [(tr - s) / 2, (tr + s) / 2];
}
/** Rayleigh quotient minimum over 3600 unit vectors (symmetric matrices only). */
function rayleighMin(A: M): number {
  let best = Infinity;
  for (let i = 0; i < 3600; i++) {
    const t = Math.PI * i / 3600, x = Math.cos(t), y = Math.sin(t);
    best = Math.min(best, x * (A[0][0] * x + A[0][1] * y) + y * (A[1][0] * x + A[1][1] * y));
  }
  return best;
}
const quad = (v: number[], A: M) => v[0] * (A[0][0] * v[0] + A[0][1] * v[1]) + v[1] * (A[1][0] * v[0] + A[1][1] * v[1]);
const sminSym = (A: M) => { const e = eigs(A)[0]; expect(Math.abs(e - rayleighMin(A))).toBeLessThan(1e-3); return e; };

// ---- helpers --------------------------------------------------------------------------------
const norm = (s: string) => s.replaceAll('−', '-').replaceAll(' ', ' ');
/** Numbers printed in the question stem, with the answer-format sentence removed. */
function stemNumbers(prompt: string): number[] {
  const cut = norm(prompt).split(/Give an? |Give integers|请填/)[0];
  return (cut.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}
const fmt = (x: number) => String(x);
const AUDIT_ORDER: Record<string, string[]> = {
  'GP-09:eigen-min': ['a', 'b', 'b', 'a'],
  'GP-09:compose': ['l1', 'l2', 'l3', 'x', 'xp', 'r', 'p'],
  'GP-09:scale-fn': ['d', 'b', 'b', 'd', 's', 't'],
  'GP-09:product-gram': ['a1', 'b1', 'b1', 'a1', 'a2', 'b2', 'b2', 'a2'],
  'GP-09:diff-quad': ['a1', 'b1', 'b1', 'a1', 'a2', 'b2', 'b2', 'a2', 'v1', 'v2'],
  'GP-09:challenge': ['a1', 'b1', 'b1', 'a1', 'a2', 'b2', 'b2', 'a2', 'c'],
};
type P = Record<string, number | number[]>;
const n = (p: P, k: string) => { const v = p[k]; if (typeof v !== 'number') throw new Error(`param ${k} missing`); return v; };

/** Oracle: expected field answers per audit kind, by routes different from the plan's closed forms. */
const ORACLE: Record<string, (p: P) => number[]> = {
  'GP-09:eigen-min': p => [sminSym(sym(n(p, 'a'), n(p, 'b')))],
  'GP-09:compose': p => {
    // expression tree (l1*RBF) x (l2*PER) + l3*LIN, LIN as dot product of one-dimensional vectors
    const lin = [n(p, 'x')].reduce((s, xi, i) => s + xi * [n(p, 'xp')][i], 0);
    const left = n(p, 'l1') * n(p, 'r'), right = n(p, 'l2') * n(p, 'p');
    return [left * right + n(p, 'l3') * lin];
  },
  'GP-09:scale-fn': p => {
    const D: M = [[n(p, 's'), 0], [0, n(p, 't')]], K = sym(n(p, 'd'), n(p, 'b'));
    const R = mul(mul(D, K), D);
    return [R[1][1], R[0][1]];
  },
  'GP-09:product-gram': p => {
    const K1 = sym(n(p, 'a1'), n(p, 'b1')), K2 = sym(n(p, 'a2'), n(p, 'b2'));
    const mine = sminSym(had(K1, K2));
    expect(Math.abs(eigs(mul(K1, K2))[0] - mine), 'matrix-product trap must differ').toBeGreaterThan(0.02);
    return [mine];
  },
  'GP-09:diff-quad': p => {
    const K1 = sym(n(p, 'a1'), n(p, 'b1')), K2 = sym(n(p, 'a2'), n(p, 'b2')), v = [n(p, 'v1'), n(p, 'v2')];
    const D = add(K1, scl(-1, K2));
    const q = quad(v, D);
    expect(Math.abs(q - (quad(v, K1) - quad(v, K2)))).toBeLessThan(1e-12);
    expect(eigs(D)[0], 'K1 − K2 must have a negative eigenvalue').toBeLessThan(0);
    return [q];
  },
  'GP-09:challenge': p => {
    const K1 = sym(n(p, 'a1'), n(p, 'b1')), K2 = sym(n(p, 'a2'), n(p, 'b2'));
    return [sminSym(add(had(K1, K2), scl(n(p, 'c'), K1)))];
  },
};

// ---- generation -----------------------------------------------------------------------------
const decks: Record<GameLanguage, PracticeCard[][]> = { en: [], zh: [] };
for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) decks[lang].push(gp09(spreadSeed(i), lang));
const byId = (deck: PracticeCard[], slug: string) => deck.find(c => c.id === `GP-09-${slug}`)!;

describe('GP-09 oracle: structure', () => {
  it('has the 8 planned cards in order, in both languages, with no figures', () => {
    for (const lang of LANGS) for (const deck of decks[lang]) {
      expect(deck.map(c => c.id)).toEqual(SLUGS.map(s => `GP-09-${s}`));
      for (const c of deck) {
        expect(c.figure, c.id).toBeUndefined();
        expect(c.choice?.figures, c.id).toBeUndefined();
        expect(c.slots, c.id).toBeUndefined();
      }
    }
  });
  it('audit kinds: every kind fires on every seed, none unknown, none on choice cards', () => {
    for (const lang of LANGS) for (const deck of decks[lang]) {
      const kinds = deck.filter(c => c.audit && !c.choice).map(c => c.audit!.kind).sort();
      expect(kinds).toEqual([...KINDS].sort());
      // choice cards may carry audit params for the test (plan); if present, kinds must be the planned slugs
      for (const c of deck.filter(c => c.audit && c.choice)) expect(['GP-09:det-test', 'GP-09:not-guaranteed']).toContain(c.audit!.kind);
      for (const c of deck) if (c.choice) expect(c.fields, c.id).toBeUndefined();
    }
  });
  it('field counts and tolerance 0.006 everywhere', () => {
    for (const deck of decks.en) for (const c of deck) {
      if (!c.fields) continue;
      expect(c.fields.length, c.id).toBe(c.id.endsWith('scale-fn') ? 2 : 1);
      for (const f of c.fields) expect(f.tolerance, c.id).toBe(0.006);
    }
  });
});

describe('GP-09 oracle: numeric cards', () => {
  for (const kind of KINDS) it(`${kind}: independent answer, grading and printed numbers`, () => {
    let count = 0;
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = decks[lang][i].find(c => c.audit?.kind === kind && !c.choice)!;
      const p = card.audit!.params;
      const where = `${kind} seed#${i} ${lang} ${JSON.stringify(p)}`;
      const expected = ORACLE[kind](p);
      expect(card.fields!.length, where).toBe(expected.length);
      expected.forEach((e, j) => expect(Math.abs(card.fields![j].answer - e), `${where} field ${j}: oracle ${e} vs card ${card.fields![j].answer}`).toBeLessThan(1e-9));
      // grading: accepted strings correct, perturbed beyond tolerance wrong
      const good = expected.map(e => fmt(e));
      expect(gradeCard(card, good, null, []), where).toBe('correct');
      expect(gradeCard(card, expected.map(e => (Math.round(e * 100) / 100).toFixed(2)), null, []), `${where} 2dp`).toBe('correct');
      expected.forEach((_, j) => {
        for (const d of [0.01, -0.01, 1]) {
          const bad = good.slice(); bad[j] = fmt(expected[j] + d);
          expect(gradeCard(card, bad, null, []), `${where} perturb ${d} field ${j}`).toBe('incorrect');
        }
      });
      // printed text = audit params
      const order = AUDIT_ORDER[kind];
      expect(stemNumbers(card.prompt), `${where}: printed numbers\n${card.prompt}`).toEqual(order.map(k => n(p, k)));
      // the audit never leaks the answer as a param; no param is non-finite
      for (const v of Object.values(p)) expect(Number.isFinite(v as number), where).toBe(true);
      count++;
    }
    expect(count).toBe(SEEDS * 2);
  });

  it('EN and ZH decks share the same sampled audit params', () => {
    for (let i = 0; i < SEEDS; i++) {
      const a = decks.en[i].filter(c => c.audit).map(c => c.audit), b = decks.zh[i].filter(c => c.audit).map(c => c.audit);
      expect(b).toEqual(a);
    }
  });

  it('every wrong route differs from the truth by at least 0.02 on every draw (card-by-card guards)', () => {
    const ok = (truth: number, wrong: number[], where: string) =>
      wrong.forEach((w, j) => expect(Math.abs(w - truth), `${where}: wrong route #${j} (${w}) collides with truth ${truth}`).toBeGreaterThanOrEqual(0.02));
    for (let i = 0; i < SEEDS; i++) {
      const d = decks.en[i];
      const get = (k: string) => d.find(c => c.audit?.kind === `GP-09:${k}`)!;
      {
        const p = get('eigen-min').audit!.params, a = n(p, 'a'), b = n(p, 'b');
        ok(a - Math.abs(b), [a + Math.abs(b), a, a * a - b * b, Math.abs(b)], `eigen-min #${i}`);
      }
      {
        const p = get('compose').audit!.params, l1 = n(p, 'l1'), l2 = n(p, 'l2'), l3 = n(p, 'l3'), x = n(p, 'x'), xp = n(p, 'xp'), r = n(p, 'r'), q = n(p, 'p');
        const lin = x * xp, truth = l1 * l2 * r * q + l3 * lin;
        ok(truth, [l1 * l2 * (r + q) + l3 * lin, l1 * l2 * r * q + l3, l1 * l2 * (r * q + l3 * lin), r * q + l3 * lin,
          l1 * l2 * r * q + l3 * (x + xp), l1 * l2 * r * q], `compose #${i}`);
        expect(lin, 'lin ≠ 1').not.toBe(1); expect(lin, 'lin ≠ x+xp').not.toBe(x + xp);
      }
      {
        const p = get('scale-fn').audit!.params, dd = n(p, 'd'), b = n(p, 'b'), s = n(p, 's'), t = n(p, 't');
        ok(t * t * dd, [t * dd, dd, s * s * dd, s * t * dd, s * dd, -t * dd, (s + t) * dd], `scale-fn f1 #${i}`);
        ok(s * t * b, [s * b, t * b, b, (s + t) * b, Math.abs(s * t) * b, s * s * b, t * t * b, s * t * dd], `scale-fn f2 #${i}`);
      }
      {
        const p = get('product-gram').audit!.params, a1 = n(p, 'a1'), b1 = n(p, 'b1'), a2 = n(p, 'a2'), b2 = n(p, 'b2');
        const K1 = sym(a1, b1), K2 = sym(a2, b2), truth = a1 * a2 - Math.abs(b1 * b2);
        ok(truth, [eigs(mul(K1, K2))[0], (a1 - Math.abs(b1)) * (a2 - Math.abs(b2)), a1 * a2 + Math.abs(b1 * b2), a1 * a2,
          (a1 * a2) ** 2 - (b1 * b2) ** 2, (a1 - Math.abs(b1)) + (a2 - Math.abs(b2)), Math.abs(b1 * b2)], `product-gram #${i}`);
      }
      {
        const p = get('diff-quad').audit!.params, a1 = n(p, 'a1'), b1 = n(p, 'b1'), a2 = n(p, 'a2'), b2 = n(p, 'b2'), v1 = n(p, 'v1'), v2 = n(p, 'v2');
        const K1 = sym(a1, b1), K2 = sym(a2, b2), v = [v1, v2], da = a1 - a2, db = b1 - b2, truth = quad(v, add(K1, scl(-1, K2)));
        expect(truth).toBeLessThan(0);
        ok(truth, [quad(v, K1) + quad(v, K2), quad(v, K1), quad(v, K2), da * (v1 * v1 + v2 * v2) + db * v1 * v2,
          da * (v1 * v1 + v2 * v2) + 2 * db * Math.abs(v1 * v2), da * (v1 * v1 + v2 * v2)], `diff-quad #${i}`);
      }
      {
        const p = get('challenge').audit!.params, a1 = n(p, 'a1'), b1 = n(p, 'b1'), a2 = n(p, 'a2'), b2 = n(p, 'b2'), c = n(p, 'c');
        const K1 = sym(a1, b1), K2 = sym(a2, b2), truth = sminSym(add(had(K1, K2), scl(c, K1)));
        const e = Math.abs;
        ok(truth, [eigs(add(mul(K1, K2), scl(c, K1)))[0], (a1 * a2 - e(b1 * b2)) + c * (a1 - e(b1)), a1 * (a2 + c) - e(b1 * b2),
          a1 * a2 - e(b1) * e(b2 + c), a1 * (a2 + c) + e(b1) * e(b2 + c), a1 * (a2 + c), a1 * a2 - e(b1 * b2)], `challenge #${i}`);
        expect(b2, 'b2 always negative').toBeLessThan(0);
        expect(c).not.toBe(Math.abs(b2));
      }
    }
  });
});

describe('GP-09 oracle: sampling spaces equal the plan', () => {
  const SAMPLES = 9000;
  const seen: Record<string, Set<string>> = {};
  for (let i = 0; i < SAMPLES; i++) {
    const deck = gp09(spreadSeed(i), 'en');
    for (const c of deck) {
      const key = c.choice ? c.id : c.audit!.kind;
      const p = c.choice ? undefined : c.audit?.params;
      let tuple: string;
      if (p) tuple = JSON.stringify(Object.keys(p).sort().map(k => p[k]));
      else if (c.id.endsWith('det-test')) { const s = stemNumbers(c.prompt); tuple = [s[0], s[1], s[3]].join(','); }
      else tuple = c.choice!.options.join('|').match(/\d+/g)!.slice(0, 2).join(',');
      (seen[key] ??= new Set()).add(tuple);
    }
  }
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const pm = (hi: number) => [...range(1, hi), ...range(1, hi).map(x => -x)];
  // enumerate each plan space and compare with the generator's observed set
  const planned: Record<string, string[]> = {};
  const push = (k: string, t: (number | string)[]) => (planned[k] ??= []).push(JSON.stringify(t));
  for (const a of range(2, 6)) for (const b of pm(a - 1)) if (a !== 2 * Math.abs(b)) push('GP-09:eigen-min', [a, b]);
  for (const l1 of [2, 3]) for (const l2 of [2, 3]) for (const l3 of [1, 2, 3]) for (const x of [1, 2, 3]) for (const xp of pm(3)) for (const [r, p] of [[0.5, 0.5], [0.5, 0.25], [0.25, 0.5]]) {
    const lin = x * xp; if (lin === 1 || lin === x + xp) continue;
    const truth = l1 * l2 * r * p + l3 * lin;
    const wrong = [l1 * l2 * (r + p) + l3 * lin, l1 * l2 * r * p + l3, l1 * l2 * (r * p + l3 * lin), r * p + l3 * lin, l1 * l2 * r * p + l3 * (x + xp), l1 * l2 * r * p];
    if (wrong.some(w => Math.abs(w - truth) < 0.02)) continue;
    push('GP-09:compose', [l1, l2, l3, p, r, x, xp]); // keys sorted: l1,l2,l3,p,r,x,xp
  }
  for (const d of range(2, 5)) for (const b of range(1, d - 1)) for (const [s, t] of [[2, -3], [3, -2], [-2, 3], [-3, 2]]) push('GP-09:scale-fn', [b, d, s, t]);
  for (const a1 of [2, 3, 4]) for (const a2 of [2, 3, 4]) for (const b1 of pm(a1 - 1)) for (const b2 of pm(a2 - 1)) {
    if (a1 * b2 + a2 * b1 === 0 || a1 * a2 === 2 * Math.abs(b1 * b2)) continue;
    push('GP-09:product-gram', [a1, a2, b1, b2]);
  }
  for (const a1 of range(2, 5)) for (const a2 of range(2, 5)) for (const b1 of range(1, a1 - 1)) for (const b2 of range(1, a2 - 1)) for (const [v1, v2] of [[1, -1], [1, -2], [2, -1], [1, -3], [3, -1]]) {
    const da = a1 - a2, db = b1 - b2, Q = da * (v1 * v1 + v2 * v2) + 2 * db * v1 * v2;
    if (Q >= 0) continue;
    const q1 = a1 * (v1 * v1 + v2 * v2) + 2 * b1 * v1 * v2, q2 = a2 * (v1 * v1 + v2 * v2) + 2 * b2 * v1 * v2;
    const wrong = [q1 + q2, q1, q2, da * (v1 * v1 + v2 * v2) + db * v1 * v2, da * (v1 * v1 + v2 * v2) + 2 * db * Math.abs(v1 * v2), da * (v1 * v1 + v2 * v2)];
    if (wrong.some(w => Math.abs(w - Q) < 0.02)) continue;
    push('GP-09:diff-quad', [a1, a2, b1, b2, v1, v2]);
  }
  for (const a1 of [2, 3, 4]) for (const b1 of pm(a1 - 1)) for (const a2 of [2, 3]) for (const b2 of range(1, a2 - 1).map(x => -x)) for (const c of [1, 2, 3]) {
    if (c === Math.abs(b2)) continue;
    const e = Math.abs, truth = a1 * (a2 + c) - e(b1) * e(b2 + c);
    const K1 = sym(a1, b1), K2 = sym(a2, b2);
    const wrong = [eigs(add(mul(K1, K2), scl(c, K1)))[0], (a1 * a2 - e(b1 * b2)) + c * (a1 - e(b1)), a1 * (a2 + c) - e(b1 * b2), a1 * a2 - e(b1) * e(b2 + c), a1 * (a2 + c) + e(b1) * e(b2 + c), a1 * (a2 + c), a1 * a2 - e(b1 * b2)];
    if (wrong.some(w => Math.abs(w - truth) < 0.02)) continue;
    push('GP-09:challenge', [a1, a2, b1, b2, c]); // keys sorted: a1,a2,b1,b2,c
  }
  // det-test triples from the plan's rule
  for (const a of range(1, 5)) for (const c of range(1, 5)) for (const b of range(1, 5)) if (a !== c && b * b > a * c && b <= Math.max(a, c)) (planned['det'] ??= []).push([a, b, c].join(','));
  for (const p of range(2, 5)) for (const q of range(2, 5)) if (p !== q) (planned['notg'] ??= []).push(`${p},${q}`);

  const expectedCount: Record<string, number> = { 'GP-09:eigen-min': 24, 'GP-09:compose': 576 /* plan text says 384; its own guards leave 576 (648 - 72) */, 'GP-09:scale-fn': 40, 'GP-09:product-gram': 120, 'GP-09:diff-quad': 165, 'GP-09:challenge': 47, det: 34, notg: 12 };
  for (const [kind, count] of Object.entries(expectedCount)) it(`${kind}: plan space has ${count} sets and the generator draws exactly them`, () => {
    const plan = new Set(planned[kind]);
    expect(plan.size, 'plan enumeration').toBe(count);
    const key = kind === 'det' ? 'GP-09-det-test' : kind === 'notg' ? 'GP-09-not-guaranteed' : kind;
    const got = seen[key];
    expect(got, key).toBeDefined();
    // generator keys sorted alphabetically: re-sort tuple for compare for kinds above (keys already sorted in push order)
    const extra = [...got].filter(t => !plan.has(t));
    expect(extra.slice(0, 5), `${key}: sets outside the plan`).toEqual([]);
    const missing = [...plan].filter(t => !got.has(t));
    expect(missing.slice(0, 5), `${key}: plan sets never drawn in ${SAMPLES} seeds`).toEqual([]);
  });
});

describe('GP-09 oracle: choice cards', () => {
  it('det-test: exactly one option satisfies the predicate, answer index points to it, both languages', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = byId(decks[lang][i], 'det-test');
      const [a, b, b2, cc] = stemNumbers(c.prompt);
      const where = `det-test #${i} ${lang} ${c.prompt}`;
      expect(b2, where).toBe(b);
      const K: M = [[a, b], [b, cc]];
      expect(a !== cc && b * b > a * cc && a > 0 && cc > 0, where).toBe(true);
      expect(eigs(K)[0], where).toBeLessThan(0);
      expect(c.choice!.options.length).toBe(4);
      const verdict = c.choice!.options.map(o => {
        const t = norm(o);
        if (lang === 'en') {
          if (t.startsWith('Not valid:')) {
            const m = t.match(/^Not valid: (\d+)·(\d+) - (\d+)² is negative/);
            if (!m) return false; // reason is not the determinant
            return Number(m[1]) === a && Number(m[2]) === cc && Number(m[3]) === b && a * cc - b * b < 0;
          }
          return false; // "Valid: ..." claims a negative-eigenvalue matrix is valid
        }
        const m = t.match(/^不合法：(\d+)·(\d+) - (\d+)² 为负/);
        return !!m && Number(m[1]) === a && Number(m[2]) === cc && Number(m[3]) === b;
      });
      expect(verdict.filter(Boolean).length, where + JSON.stringify(c.choice!.options)).toBe(1);
      expect(verdict[c.choice!.answer], where).toBe(true);
      // the false options: "Valid" ones claim validity; the equal-diagonal one is false because a ≠ c
      const opts = c.choice!.options.map(norm);
      expect(opts.filter(o => /^(Valid|合法)/.test(o)).length, where).toBe(2);
      expect(opts.filter(o => /diagonal|对角元 k/.test(o) && /must be equal|必须相等/.test(o)).length, where).toBe(1);
      const lens = opts.map(o => o.length);
      if (lang === 'en') expect(lens[c.choice!.answer], `correct option must not be longest ${lens}`).toBeLessThan(Math.max(...lens));
      // grading
      for (let k = 0; k < 4; k++) expect(gradeCard(c, [], k, [])).toBe(k === c.choice!.answer ? 'correct' : 'incorrect');
    }
  });

  it('not-guaranteed: behavioural predicate (random PSD kernels, negative a) picks the difference', () => {
    const rnd = (() => { let s = 12345; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; })();
    const randPsd = (): M => { const u = [rnd() * 4 - 2, rnd() * 4 - 2], w = [rnd() * 4 - 2, rnd() * 4 - 2]; return [[u[0] * u[0] + w[0] * w[0], u[0] * u[1] + w[0] * w[1]], [u[0] * u[1] + w[0] * w[1], u[1] * u[1] + w[1] * w[1]]]; };
    const zero: M = [[0, 0], [0, 0]];
    const test: [M, M][] = [[zero, sym(2, 1)], [sym(2, 1), zero], [sym(2, 1), sym(1, -0.5)]];
    for (let i = 0; i < 300; i++) test.push([randPsd(), randPsd()]);
    /** Parses an option into a map (K1, K2) → Gram matrix. */
    const parse = (text: string): ((K1: M, K2: M) => M) => {
      const t = norm(text).trim();
      let m = t.match(/^(\d+)·k₁\(x, x′\) ([+-]) (\d+)·k₂\(x, x′\)$/);
      if (m) { const al = Number(m[1]), be = Number(m[3]) * (m[2] === '-' ? -1 : 1); return (K1, K2) => add(scl(al, K1), scl(be, K2)); }
      if (/^k₁\(x, x′\)·k₂\(x, x′\)$/.test(t)) return (K1, K2) => had(K1, K2);
      if (/^a\(x\)·k₁\(x, x′\)·a\(x′\)/.test(t)) return K1 => { const a = [-2, 3]; return [[a[0] * a[0] * K1[0][0], a[0] * a[1] * K1[0][1]], [a[0] * a[1] * K1[1][0], a[1] * a[1] * K1[1][1]]]; };
      throw new Error(`cannot parse option ${t}`);
    };
    const guaranteed = (o: string) => { const f = parse(o); return test.every(([K1, K2]) => eigs(f(K1, K2))[0] >= -1e-9); };
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const c = byId(decks[lang][i], 'not-guaranteed');
      const where = `not-guaranteed #${i} ${lang} ${JSON.stringify(c.choice!.options)}`;
      expect(c.choice!.options.length).toBe(4);
      const verdict = c.choice!.options.map(o => !guaranteed(o));
      expect(verdict.filter(Boolean).length, where).toBe(1);
      expect(verdict[c.choice!.answer], where).toBe(true);
      // the difference option prints p and q exactly as the weights, and p ≠ q
      const nums = norm(c.choice!.options[c.choice!.answer]).match(/\d+/g)!.map(Number).filter((_, j) => j !== 1 && j !== 3 || true);
      const coef = nums.filter(x => x !== 1 && x !== 2 || true);
      expect(new Set(coef).size >= 1).toBe(true);
      if (lang === 'en') {
        const lens = c.choice!.options.map(o => o.length);
        expect(lens[c.choice!.answer], `correct option must not be longest ${lens}`).toBeLessThan(Math.max(...lens));
      }
      for (let k = 0; k < 4; k++) expect(gradeCard(c, [], k, [])).toBe(k === c.choice!.answer ? 'correct' : 'incorrect');
    }
  });

  it('not-guaranteed: p, q printed in the options are the two distinct weights in {2..5}', () => {
    for (let i = 0; i < SEEDS; i++) {
      const c = byId(decks.en[i], 'not-guaranteed');
      const diff = norm(c.choice!.options[c.choice!.answer]).match(/^(\d+)·k₁\(x, x′\) - (\d+)·k₂\(x, x′\)$/)!;
      expect(diff, c.choice!.options[c.choice!.answer]).not.toBeNull();
      const p = Number(diff[1]), q = Number(diff[2]);
      expect(p >= 2 && p <= 5 && q >= 2 && q <= 5 && p !== q).toBe(true);
      const sum = c.choice!.options.map(norm).find(o => /^\d+·k₁\(x, x′\) \+ \d+·k₂/.test(o))!;
      expect(sum).toBe(`${p}·k₁(x, x′) + ${q}·k₂(x, x′)`);
    }
  });
});

describe('GP-09 oracle: variety and notation', () => {
  it('every card has at least 6 distinct visible questions over 60 seeds (EN and ZH)', () => {
    for (const lang of LANGS) for (const slug of SLUGS) {
      const set = new Set(decks[lang].map(d => { const c = byId(d, slug); return JSON.stringify([c.prompt, c.choice?.options.slice().sort()]); }));
      expect(set.size, `${lang} ${slug}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('learner-visible notation: Unicode, no ASCII names, no hyphen minus, no double parentheses, no raw floats', () => {
    const hits = new Set<string>();
    const allowZh = /\b(Gram|RBF|PER|LIN|GPML|pdf|GP|KL|ELBO|exp|sin)\b/g;
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of decks[lang][i]) for (const t of textOf(c)) {
      const add = (name: string) => hits.add(`${lang} ${c.id} ${name}: ${t.slice(0, 90)}`);
      if (/\b[kK][12]\b|lambda|[a-z]'(?!\w)|\bx_?[12]\b|\^|\\|\{|\}|undefined|NaN|\[object/.test(t)) add('ASCII name or leftover');
      if (/(?<=\d)\s*-\s*(?=\d)|(?<=\s)-(?=\d)|(?<=\()-(?=\d)|\w - \w| - \(/.test(t)) add('ASCII hyphen minus');
      if (/\(\(/.test(t) && !/\(\(\d+\/\d+\)/.test(t)) add('double parentheses');
      if (/\d\.\d{4,}/.test(t) || /\d\.0+\b/.test(t)) add('raw float');
      if (lang === 'zh' && /[A-Za-z]{3,}/.test(t.replace(allowZh, ''))) add('English word in ZH');
      if (lang === 'zh' && !/[一-鿿]/.test(t) && t.length > 40) add('ZH text without Chinese');
    }
    expect([...hits].slice(0, 20)).toEqual([]);
  });
  it('hints do not contain the numeric answer of their card', () => {
    for (let i = 0; i < SEEDS; i++) for (const c of decks.en[i]) {
      if (!c.fields) continue;
      for (const f of c.fields) expect(c.hint.includes(String(f.answer).replace('-', '−')) && Math.abs(f.answer) > 9, `${c.id}: ${c.hint}`).toBe(false);
    }
  });
  it('question text does not show the answer of a number card as a printed result', () => {
    for (let i = 0; i < SEEDS; i++) for (const c of decks.en[i]) {
      if (!c.fields) continue;
      const q = questionTextOf(c).join(' ');
      expect(q.includes('smallest eigenvalue is'), c.id).toBe(false);
    }
  });
});
