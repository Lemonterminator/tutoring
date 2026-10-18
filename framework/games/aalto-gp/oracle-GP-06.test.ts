import { describe, expect, it } from 'vitest';
import { gp06 } from './games/gp06';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';
import type { Figure, FigureShape } from '../figure';

/**
 * Independent oracle for GP-06 (GP posterior from one or two observations).
 * Written from docs/aalto-gp-drafts/approved-GP-06.md only: every answer is recomputed by explicit Gaussian conditioning of the
 * joint (y, f*) with a hand-written Cholesky solve AND a hand-written Gauss-Jordan inverse, never by the plan's closed form alone.
 */
const SEEDS = 60;
const COVER_SEEDS = 3000;
const TOL = 0.006;
type Lang = 'en' | 'zh';
type P = Record<string, number>;
const seedAt = (i: number) => spreadSeed(i);
const clean = (t: string) => t.replaceAll('−', '-');
const slugs = ['one-mean', 'one-var', 'noise-direction', 'distance', 'at-data', 'two-mean', 'two-var', 'variance-ignores-y', 'challenge'] as const;
const pick = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-06-${slug}`);
  if (!card) throw new Error(`card GP-06-${slug} missing`);
  return card;
};
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);

// ---------- linear algebra written by hand ----------
type M = number[][];
function cholesky(A: M): M {
  const n = A.length, L: M = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (!(s > 1e-12)) throw new Error('matrix is not positive definite'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function forward(L: M, b: number[]): number[] {
  const x: number[] = [];
  for (let i = 0; i < L.length; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x.push(s / L[i][i]); }
  return x;
}
function inverse(A: M): M {
  const n = A.length, W = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    [W[c], W[p]] = [W[p], W[c]];
    const d = W[c][c];
    for (let j = 0; j < 2 * n; j++) W[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = W[r][c]; for (let j = 0; j < 2 * n; j++) W[r][j] -= f * W[c][j]; }
  }
  return W.map(row => row.slice(n));
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const matVec = (A: M, v: number[]) => A.map(row => dot(row, v));

/**
 * Condition f* on noisy observations. `joint` is the NOISE-FREE covariance of (f(x1..xn), f*), size n+1. Returns the posterior of f*.
 * Both routes (Cholesky conditioning, explicit inverse) must agree; the joint must be positive definite unless `allowSingular`.
 */
function posterior(joint: M, noise: number, y: number[], allowSingular = false): { mu: number; v: number } {
  const n = y.length;
  if (!allowSingular) cholesky(joint);
  const C = joint.slice(0, n).map((row, i) => row.slice(0, n).map((x, j) => x + (i === j ? noise : 0)));
  const k = joint.slice(0, n).map(row => row[n]);
  const kss = joint[n][n];
  const L = cholesky(C);
  const a = forward(L, k), b = forward(L, y);
  const muA = dot(a, b), vA = kss - dot(a, a);
  const Ci = inverse(C);
  const muB = dot(k, matVec(Ci, y)), vB = kss - dot(k, matVec(Ci, k));
  if (Math.abs(muA - muB) > 1e-9 || Math.abs(vA - vB) > 1e-9) throw new Error(`oracle routes disagree: ${muA} ${muB} ${vA} ${vB}`);
  return { mu: muA, v: vA };
}
const joint1 = (k11: number, ks: number): M => [[k11, ks], [ks, k11]];
const joint2 = (k11: number, k12: number, ks1: number, ks2: number): M => [[k11, k12, ks1], [k12, k11, ks2], [ks1, ks2, k11]];

const ROWS1 = [[3, 2, 1], [3, 2, 2], [3, 2, 3], [4, 2, 1], [4, 3, 1], [4, 2, 2], [4, 3, 2], [5, 2, 1], [5, 3, 1], [5, 4, 1]];
const ROWS2 = [[2, 1, 1, 1], [2, 1, 2, 1], [2, 1, 3, 1], [3, 1, 1, 1], [3, 1, 1, 2], [3, 1, 2, 1], [3, 1, 2, 2], [3, 2, 1, 1], [3, 2, 1, 2], [4, 1, 1, 1], [4, 1, 1, 2], [4, 1, 1, 3]];
const CH_ROWS = [[2, 1, 1], [3, 1, 1], [3, 1, 2], [3, 2, 1], [4, 1, 1]];
const key = (...v: number[]) => v.join(',');
const set1 = new Set(ROWS1.map(r => key(...r)));
const set2 = new Set(ROWS2.map(r => key(...r)));
const setCh = new Set(CH_ROWS.map(r => key(...r)));

/** Oracle per audit kind. Params are exactly the audit params; result in field order. */
function oracle(kind: string, p: P): number[] {
  switch (kind) {
    case 'GP-06:one-mean': return [posterior(joint1(p.k11, p.ks1), p.noise, [p.y1]).mu];
    case 'GP-06:one-var': return [posterior(joint1(p.k11, p.ks1), p.noise, [0]).v];
    case 'GP-06:distance': return [posterior(joint1(p.k11, p.ksb), p.noise, [0]).v - posterior(joint1(p.k11, p.ksa), p.noise, [0]).v];
    case 'GP-06:at-data': return [posterior(joint1(p.k11, p.k11), p.noise, [0], true).v];
    case 'GP-06:two-mean': return [posterior(joint2(p.k11, p.k12, p.ks, p.ks), p.noise, [p.y1, p.y2]).mu];
    case 'GP-06:two-var': return [posterior(joint2(p.k11, p.k12, p.ks, p.ks), p.noise, [0, 0]).v];
    case 'GP-06:challenge': {
      const r = posterior(joint2(p.k11, p.k12, p.ks1, p.ks2), p.noise, [p.y1, p.y2]);
      return [r.mu, r.v];
    }
    default: throw new Error(`unknown audit kind ${kind}`);
  }
}
/** Wrong routes a learner could take; each must be rejected by the grader. */
function wrongRoutes(kind: string, p: P, truth: number[]): number[][] {
  const A = (p.k11 ?? 0) + (p.noise ?? 0);
  switch (kind) {
    case 'GP-06:one-mean': return [[p.ks1 * p.y1 / p.k11], [p.y1 / A]];
    case 'GP-06:one-var': return [[p.k11 - p.ks1 ** 2 / p.k11], [p.k11 - p.ks1 / A], [p.ks1 ** 2 / A], [p.k11 + p.noise - p.ks1 ** 2 / A]];
    case 'GP-06:distance': return [[(p.ksa ** 2 - p.ksb ** 2) / p.k11], [(p.ksa - p.ksb) / A], [-truth[0]]];
    case 'GP-06:at-data': return [[0], [p.k11 ** 2 / A], [p.k11 * p.noise / A + p.noise]];
    case 'GP-06:two-mean': return [[p.ks * (p.y1 + p.y2) / A], [p.ks * (p.y1 + p.y2) / (A - p.k12)], [p.ks * (p.y1 + p.y2) / (p.k11 + p.k12)]];
    case 'GP-06:two-var': return [[p.k11 - 2 * p.ks ** 2 / A], [p.k11 - 2 * p.ks ** 2 / (A - p.k12)], [p.k11 - p.ks ** 2 / (A + p.k12)]];
    case 'GP-06:challenge': {
      const t = p.ks1 * p.y1 + p.ks2 * p.y2, q = p.ks1 ** 2 + p.ks2 ** 2, b = p.k12;
      return [[t / A, truth[1]], [t / (A + b), truth[1]], [t / (p.k11 + b), truth[1]], [(p.ks1 + p.ks2) * (p.y1 + p.y2) / (2 * (A + b)), truth[1]], [t / (A - b), truth[1]],
        [truth[0], p.k11 - q / A], [truth[0], p.k11 - q / (A + b)]];
    }
    default: return [];
  }
}
function toFraction(v: number): string {
  for (let d = 1; d <= 2000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return d === 1 ? `${n}` : `${n}/${d}`; }
  throw new Error(`no small fraction for ${v}`);
}

/**
 * All admissible challenge sets of the plan: (s,b,n) in the 5 rows, c1 != c2 in 0..4, y1 != y2 in -4..6, strictly positive definite joint (guard a),
 * mu* != 0 (guard b), every wrong route >= 0.02 from the truth (guard c). Built with the oracle (Cholesky), not the generator's guard code.
 */
let admissibleCache: Set<string> | null = null;
function challengeAdmissible(): Set<string> {
  if (admissibleCache) return admissibleCache;
  const out = new Set<string>();
  for (const [s, b, n] of CH_ROWS) for (let c1 = 0; c1 <= 4; c1++) for (let c2 = 0; c2 <= 4; c2++) for (let y1 = -4; y1 <= 6; y1++) for (let y2 = -4; y2 <= 6; y2++) {
    if (c1 === c2 || y1 === y2) continue;
    const params = { k11: s, k12: b, ks1: c1, ks2: c2, noise: n, y1, y2 };
    let truth: number[];
    try { truth = oracle('GP-06:challenge', params); } catch { continue; }
    if (Math.abs(truth[0]) < 1e-9) continue;
    if (wrongRoutes('GP-06:challenge', params, truth).some(w => (w[1] === truth[1] && Math.abs(w[0] - truth[0]) < 0.02) || (w[0] === truth[0] && Math.abs(w[1] - truth[1]) < 0.02))) continue;
    out.add(key(s, b, n, c1, c2, y1, y2));
  }
  return (admissibleCache = out);
}

// ---------- text parsing ----------
const grab = (text: string, re: RegExp): number => {
  const m = re.exec(text);
  if (!m) throw new Error(`no match for ${re} in: ${text.slice(0, 160)}`);
  return Number(m[1]);
};
const allGrab = (text: string, re: RegExp): number[] => [...text.matchAll(new RegExp(re.source, 'g'))].map(m => Number(m[1]));
/** The four entries printed after "K = ". */
function matrixAfterK(text: string): number[] {
  const i = text.indexOf('K = ');
  if (i < 0) throw new Error(`no "K = " in ${text.slice(0, 120)}`);
  const found = [...text.slice(i + 4, i + 70).matchAll(/-?\d+/g)].slice(0, 4).map(m => Number(m[0]));
  if (found.length < 4) throw new Error('matrix has fewer than 4 numbers');
  return found;
}
const KSAME = /k\(x₁, x₁\) = k\(x₂, x₂\) = k\(x\*, x\*\) = (\d+)/;
/** The sampled numbers as the learner sees them. */
function printedParams(kind: string, raw: string): P {
  const t = clean(raw);
  switch (kind) {
    case 'GP-06:one-mean': return { k11: grab(t, /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/), ks1: grab(t, /k\(x\*, x₁\) = (\d+)/), noise: grab(t, /σ² = (\d+)/), y1: grab(t, /\by = (-?\d+)/) };
    case 'GP-06:one-var': return { k11: grab(t, /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/), ks1: grab(t, /k\(x\*, x₁\) = (\d+)/), noise: grab(t, /σ² = (\d+)/) };
    case 'GP-06:distance': return { k11: grab(t, /(?:prior variance|先验方差都是) (\d+)/), noise: grab(t, /σ² = (\d+)/), ksa: grab(t, /k\(A, x₁\) = (\d+)/), ksb: grab(t, /k\(B, x₁\) = (\d+)/) };
    case 'GP-06:at-data': {
      const k11 = grab(t, /k\(x₁, x₁\) = (\d+)/);
      if (grab(t, /k\(x\*, x₁\) = k\(x\*, x\*\) = (\d+)/) !== k11) throw new Error('k(x*, x1) = k(x*, x*) differs from k11');
      return { k11, noise: grab(t, /σ² = (\d+)/) };
    }
    case 'GP-06:two-mean': case 'GP-06:two-var': {
      const s = grab(t, KSAME), b = grab(t, /k\(x₁, x₂\) = (\d+)/);
      const Kp = matrixAfterK(t);
      if (Kp.join() !== [s, b, b, s].join()) throw new Error(`printed K ${Kp} differs from [[${s},${b}],[${b},${s}]]`);
      const out: P = { k11: s, k12: b, ks: grab(t, /k\(x\*, x₁\) = k\(x\*, x₂\) = (\d+)/), noise: grab(t, /σ² = (\d+)/) };
      if (kind === 'GP-06:two-mean') { out.y1 = grab(t, /y₁ = (-?\d+)/); out.y2 = grab(t, /y₂ = (-?\d+)/); }
      return out;
    }
    case 'GP-06:challenge': return { k11: grab(t, KSAME), k12: grab(t, /k\(x₁, x₂\) = (\d+)/), ks1: grab(t, /k\(x\*, x₁\) = (\d+)/), ks2: grab(t, /k\(x\*, x₂\) = (\d+)/), noise: grab(t, /σ² = (\d+)/), y1: grab(t, /y₁ = (-?\d+)/), y2: grab(t, /y₂ = (-?\d+)/) };
    default: throw new Error(`unknown kind ${kind}`);
  }
}
const EXPECTED_KINDS = ['one-mean', 'one-var', 'distance', 'at-data', 'two-mean', 'two-var', 'challenge'].map(s => `GP-06:${s}`);

describe('GP-06 oracle: deck shape', () => {
  it('has the 9 planned cards in order, the right answer modes, one audit per numeric card, no figure except noise-direction', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const cards = gp06(seedAt(i), lang);
      const at = `seed ${seedAt(i)} ${lang}`;
      if (cards.map(c => c.id).join() !== slugs.map(s => `GP-06-${s}`).join()) { fails.push(`${at}: ids ${cards.map(c => c.id)}`); continue; }
      for (const c of cards) {
        const slug = c.id.slice(6);
        const numeric = ['one-mean', 'one-var', 'distance', 'at-data', 'two-mean', 'two-var', 'challenge'].includes(slug);
        if (numeric !== !!c.fields) fails.push(`${at} ${slug}: fields presence`);
        if (!numeric && !c.choice) fails.push(`${at} ${slug}: expected a choice card`);
        if (c.slots) fails.push(`${at} ${slug}: unexpected slots`);
        if (!!c.figure !== (slug === 'noise-direction')) fails.push(`${at} ${slug}: figure presence`);
        if (!!c.audit !== numeric) fails.push(`${at} ${slug}: audit presence`);
        if (c.audit && c.audit.kind !== `GP-06:${slug}`) fails.push(`${at} ${slug}: audit kind ${c.audit.kind}`);
        if (c.choice && c.choice.options.length !== 4) fails.push(`${at} ${slug}: ${c.choice.options.length} options`);
        if (c.fields) c.fields.forEach((f, k) => { if (f.tolerance !== TOL) fails.push(`${at} ${slug} field ${k}: tolerance ${f.tolerance}`); });
      }
      if (pick(cards, 'challenge').fields!.length !== 2) fails.push(`${at}: challenge needs two fields`);
      for (const slug of ['one-mean', 'one-var', 'distance', 'at-data', 'two-mean', 'two-var']) if (pick(cards, slug).fields!.length !== 1) fails.push(`${at} ${slug}: needs one field`);
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
      if (kinds.join() !== [...EXPECTED_KINDS].sort().join()) fails.push(`${at}: audit kinds ${kinds}`);
    }
    report(fails);
  });
});

describe('GP-06 oracle: numeric answers by independent conditioning', () => {
  for (const kind of EXPECTED_KINDS) {
    it(`${kind}: answers, grading, wrong routes, printed text, sampling table (60 spread seeds x EN/ZH)`, () => {
      const fails: string[] = [];
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) {
        const decks = { en: gp06(seedAt(i), 'en'), zh: gp06(seedAt(i), 'zh') };
        for (const lang of ['en', 'zh'] as Lang[]) {
          const card = decks[lang].find(c => c.audit?.kind === kind);
          if (!card) { fails.push(`seed ${seedAt(i)} ${lang}: ${kind} did not fire`); continue; }
          fired++;
          const where = `${kind} seed ${seedAt(i)} ${lang} ${JSON.stringify(card.audit!.params)}`;
          const params = card.audit!.params as P;
          let expected: number[];
          try { expected = oracle(kind, params); } catch (e) { fails.push(`${where}: oracle threw ${(e as Error).message}`); continue; }
          // answers
          if (expected.length !== card.fields!.length) { fails.push(`${where}: ${card.fields!.length} fields, oracle ${expected.length}`); continue; }
          expected.forEach((v, k) => {
            const got = card.fields![k].answer;
            if (Math.abs(v - got) > 1e-9) fails.push(`${where} field ${k}: expected ${v}, got ${got}`);
          });
          // grading through gradeCard
          const asValues = (vs: string[]) => gradeCard(card, vs, null, []);
          const frac = expected.map(toFraction), dec = expected.map(v => v.toFixed(2));
          if (asValues(frac) !== 'correct') fails.push(`${where}: fractions ${frac} not graded correct`);
          if (asValues(dec) !== 'correct') fails.push(`${where}: decimals ${dec} not graded correct`);
          expected.forEach((v, k) => {
            for (const d of [0.02, -0.02, 0.007, -0.007]) {
              const vals = [...frac]; vals[k] = (v + d).toFixed(4);
              if (asValues(vals) !== 'incorrect') fails.push(`${where} field ${k}: perturbation ${d} graded ${asValues(vals)}`);
            }
          });
          for (const wrong of wrongRoutes(kind, params, expected)) {
            if (wrong.every((w, k) => Math.abs(w - expected[k]) < 0.02) ) fails.push(`${where}: wrong route ${wrong} is within 0.02 of truth ${expected}`);
            else if (asValues(wrong.map(w => w.toFixed(4))) === 'correct') fails.push(`${where}: wrong route ${wrong} graded correct`);
          }
          // printed text equals audit params
          try {
            const printed = printedParams(kind, card.prompt);
            for (const [name, v] of Object.entries(params)) if (printed[name] !== v) fails.push(`${where}: printed ${name}=${printed[name]} but audit ${v}`);
            for (const name of Object.keys(printed)) if (!(name in params)) fails.push(`${where}: printed ${name} missing from audit`);
          } catch (e) { fails.push(`${where}: ${(e as Error).message}`); }
          // plan sampling tables and guards
          const tableFail = (m: string) => fails.push(`${where}: ${m}`);
          const y = (name: string, lo: number, hi: number) => { if (!(Number.isInteger(params[name]) && params[name] >= lo && params[name] <= hi)) tableFail(`${name} out of ${lo}..${hi}`); };
          if (kind === 'GP-06:one-mean') { if (!set1.has(key(params.k11, params.ks1, params.noise))) tableFail('row not in table'); y('y1', -6, 6); if (params.y1 === 0) tableFail('y1 = 0'); }
          if (kind === 'GP-06:one-var' && !set1.has(key(params.k11, params.ks1, params.noise))) tableFail('row not in table');
          if (kind === 'GP-06:distance') {
            const { k11: s, noise: n, ksa: a, ksb: b } = params;
            if (![3, 4, 5].includes(s) || ![1, 2, 3].includes(n) || s + n > 7 || !(a >= 2 && a <= s - 1) || !(b >= 0 && b <= a - 1)) tableFail('distance row not allowed');
          }
          if (kind === 'GP-06:at-data') { const { k11: s, noise: n } = params; if (!(s >= 2 && s <= 6 && n >= 1 && n <= 4 && s !== n)) tableFail('at-data row not allowed'); }
          if (kind === 'GP-06:two-mean' || kind === 'GP-06:two-var') {
            if (!set2.has(key(params.k11, params.k12, params.noise, params.ks))) tableFail('row not in the 12 rows');
            if (kind === 'GP-06:two-mean') { y('y1', -4, 6); y('y2', -4, 6); if (params.y1 + params.y2 === 0) tableFail('y1 + y2 = 0'); }
          }
          if (kind === 'GP-06:challenge') {
            const { k11: s, k12: b, noise: n, ks1: c1, ks2: c2, y1, y2 } = params;
            if (!setCh.has(key(s, b, n))) tableFail('(s,b,n) not allowed');
            y('ks1', 0, 4); y('ks2', 0, 4); y('y1', -4, 6); y('y2', -4, 6);
            if (c1 === c2 || y1 === y2) tableFail('c1 = c2 or y1 = y2');
            if (!(s - ((c1 + c2) ** 2 / (2 * (s + b)) + (c1 - c2) ** 2 / (2 * (s - b))) > 0)) tableFail('guard (a) fails');
            if (Math.abs(expected[0]) < 1e-12) tableFail('mu* = 0');
            if (!challengeAdmissible().has(key(s, b, n, c1, c2, y1, y2))) tableFail('set is not among the admissible challenge sets of the plan (guards a, b, c)');
          }
        }
      }
      expect(fired).toBe(SEEDS * 2);
      report(fails);
    });
  }

  it('EN and ZH decks carry identical audits and answers; explanation states the answer; hint does not give it away', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const en = gp06(seedAt(i), 'en'), zh = gp06(seedAt(i), 'zh');
      en.forEach((c, k) => {
        if (JSON.stringify(c.audit) !== JSON.stringify(zh[k].audit)) fails.push(`${c.id} seed ${seedAt(i)}: audit differs between languages`);
        if (!c.fields) return;
        for (const [lang, card] of [['en', c], ['zh', zh[k]]] as const) {
          const expl = clean(card.explanation), hint = clean(card.hint);
          card.fields!.forEach((f, j) => {
            const fr = toFraction(f.answer);
            if (!expl.includes(fr)) fails.push(`${c.id} ${lang} seed ${seedAt(i)} field ${j}: explanation does not contain ${fr}`);
            if (fr.includes('/') && hint.includes(fr)) fails.push(`${c.id} ${lang} seed ${seedAt(i)}: hint contains the answer ${fr}`);
          });
        }
      });
    }
    report(fails);
  });

  it('card 2 draws a different row than card 1, card 7 a different row than card 6 (plan rule)', () => {
    const fails: string[] = [];
    for (let i = 0; i < COVER_SEEDS; i++) {
      const cards = gp06(seedAt(i), 'en');
      const a = pick(cards, 'one-mean').audit!.params as P, b = pick(cards, 'one-var').audit!.params as P;
      if (key(a.k11, a.ks1, a.noise) === key(b.k11, b.ks1, b.noise)) fails.push(`seed ${seedAt(i)}: one-var repeats the one-mean row ${key(a.k11, a.ks1, a.noise)}`);
      const c = pick(cards, 'two-mean').audit!.params as P, d = pick(cards, 'two-var').audit!.params as P;
      if (key(c.k11, c.k12, c.noise, c.ks) === key(d.k11, d.k12, d.noise, d.ks)) fails.push(`seed ${seedAt(i)}: two-var repeats the two-mean row`);
    }
    report(fails);
  });
});

/** Option text -> [direction of |mu*|, direction of sigma*^2] (-1 smaller, 0 same, +1 larger). */
function directionsOf(option: string, lang: Lang): [number, number] {
  const t = clean(option);
  const w = lang === 'en'
    ? /\|μ\*\| (becomes smaller|becomes larger|stays the same) and σ\*² (becomes larger|becomes smaller|stays the same)/.exec(t)
    : /\|μ\*\| (变小|变大|不变)，σ\*² (?:也)?(变大|变小|不变)/.exec(t);
  if (!w) throw new Error(`cannot parse option "${option}"`);
  const d = (s: string) => (/smaller|变小/.test(s) ? -1 : /larger|变大/.test(s) ? 1 : 0);
  return [d(w[1]), d(w[2])];
}
const sign = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x > 0 ? 1 : -1);

describe('GP-06 oracle: noise-direction (choice + figure)', () => {
  it('correct option follows the sign of n2 - n1; exactly one option matches; sampling table; figure matches the baseline', () => {
    const fails: string[] = [];
    const dirs = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const card = pick(gp06(seedAt(i), lang), 'noise-direction');
      const t = clean(card.prompt);
      const at = `seed ${seedAt(i)} ${lang}`;
      const s = grab(t, /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/), c = grab(t, /k\(x\*, x₁\) = (\d+)/), y = grab(t, /\by = (-?\d+)/);
      const [n1, n2] = allGrab(t, /σ² = (\d+)/);
      if (![[2, 1], [3, 1], [3, 2], [4, 1], [4, 2], [4, 3]].some(r => r[0] === s && r[1] === c)) fails.push(`${at}: (s,c)=(${s},${c}) not in the table`);
      if (!(Math.abs(y) >= 2 && Math.abs(y) <= 6)) fails.push(`${at}: y=${y}`);
      if (![1, 2, 4].includes(n1) || ![1, 2, 4].includes(n2) || n1 === n2) fails.push(`${at}: (n1,n2)=(${n1},${n2})`);
      const raisedWord = lang === 'en' ? /(raised|lowered) to σ² = / : /调(大|小)为 σ² = /;
      const w = raisedWord.exec(t);
      if (!w) { fails.push(`${at}: no raised/lowered word`); continue; }
      const sayRaised = w[1] === 'raised' || w[1] === '大';
      if (sayRaised !== n2 > n1) fails.push(`${at}: text says ${w[1]} but n1=${n1} n2=${n2}`);
      dirs.add(n2 > n1 ? 'raised' : 'lowered');
      const p1 = posterior(joint1(s, c), n1, [y]), p2 = posterior(joint1(s, c), n2, [y]);
      const want: [number, number] = [sign(Math.abs(p2.mu) - Math.abs(p1.mu)), sign(p2.v - p1.v)];
      const verdicts = card.choice!.options.map(o => { const d = directionsOf(o, lang); return d[0] === want[0] && d[1] === want[1]; });
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options match want ${want}`);
      else if (verdicts[card.choice!.answer] !== true) fails.push(`${at}: answer index ${card.choice!.answer} is not the matching option ${verdicts.indexOf(true)}`);
      if (want[0] === 0 || want[1] === 0) fails.push(`${at}: not strictly monotone`);
      const en = pick(gp06(seedAt(i), 'en'), 'noise-direction');
      if (lang === 'en') {
        const lens = card.choice!.options.map(o => o.length), cl = lens[card.choice!.answer];
        if (lens.every((l, k) => k === card.choice!.answer || l < cl)) fails.push(`${at}: correct option is the longest`);
        const labelled = card.choice!.options.map(o => directionsOf(o, 'en').join());
        if (new Set(labelled).size !== 4) fails.push(`${at}: options not four distinct direction pairs`);
      } else if (en.choice!.answer !== card.choice!.answer) fails.push(`${at}: EN/ZH answer index differs`);
      // figure
      const fig = card.figure as Figure;
      const sd = Math.sqrt(p1.v), sh = fig.shapes;
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
      const L = (k: number) => sh[k] as Extract<FigureShape, { kind: 'line' }>;
      const Pt = (k: number) => sh[k] as Extract<FigureShape, { kind: 'point' }>;
      if (sh.length !== 5) { fails.push(`${at}: figure has ${sh.length} shapes`); continue; }
      const okLine = (k: number, pts: number[][], dash: boolean) => sh[k].kind === 'line' && !!L(k).dash === dash && L(k).points.length === pts.length && pts.every((q, j) => near(L(k).points[j][0], q[0]) && near(L(k).points[j][1], q[1]));
      if (!okLine(0, [[-0.5, 0], [1.9, 0]], true)) fails.push(`${at}: prior-mean line wrong ${JSON.stringify(sh[0])}`);
      if (!(sh[1].kind === 'point' && near(Pt(1).at[0], 0) && near(Pt(1).at[1], y) && Pt(1).label === 'y')) fails.push(`${at}: observation point wrong ${JSON.stringify(sh[1])}`);
      if (!okLine(2, [[1, p1.mu - 2 * sd], [1, p1.mu + 2 * sd]], false)) fails.push(`${at}: posterior bar not mu*+-2sd at the starting noise ${JSON.stringify(sh[2])} (mu ${p1.mu}, sd ${sd})`);
      if (!(sh[3].kind === 'point' && near(Pt(3).at[0], 1) && near(Pt(3).at[1], p1.mu) && Pt(3).label === 'μ*')) fails.push(`${at}: mean point wrong ${JSON.stringify(sh[3])}`);
      if (!okLine(4, [[1.5, -2 * Math.sqrt(s)], [1.5, 2 * Math.sqrt(s)]], true)) fails.push(`${at}: prior bar wrong ${JSON.stringify(sh[4])}`);
      // the figure must not show the changed noise
      const sd2 = Math.sqrt(p2.v);
      for (const bad of [p2.mu, p2.mu - 2 * sd2, p2.mu + 2 * sd2]) for (const shape of sh) {
        const ys = shape.kind === 'line' || shape.kind === 'area' ? shape.points.map(q => q[1]) : shape.kind === 'point' || shape.kind === 'text' ? [shape.at[1]] : [];
        if (ys.some(v => near(v, bad)) && !near(bad, p1.mu) && !near(bad, p1.mu - 2 * sd) && !near(bad, p1.mu + 2 * sd)) fails.push(`${at}: figure contains the n2-value ${bad}`);
      }
      // view encloses everything and numbers in alt agree
      const inView = (q: readonly [number, number]) => q[0] >= fig.view.xmin - 1e-9 && q[0] <= fig.view.xmax + 1e-9 && q[1] >= fig.view.ymin - 1e-9 && q[1] <= fig.view.ymax + 1e-9;
      for (const shape of sh) {
        const pts = shape.kind === 'line' || shape.kind === 'area' ? shape.points : shape.kind === 'point' || shape.kind === 'text' ? [shape.at] : [];
        if (!pts.every(inView)) fails.push(`${at}: a shape is outside the view`);
      }
      const alt = clean(fig.alt);
      if (grab(alt, /\by = (-?\d+)/) !== y) fails.push(`${at}: alt prints another y`);
      if (!new RegExp(`(?:noise variance|噪声方差为?) ${n1}(?!\\d)`).test(alt)) fails.push(`${at}: alt does not print n1=${n1}`);
      if (!new RegExp(`2√${s}(?!\\d)`).test(alt)) fails.push(`${at}: alt does not print 2√${s}`);
      if (fig.aspect !== 'free' || fig.axes?.yLabel !== 'f') fails.push(`${at}: aspect/axes wrong`);
    }
    expect([...dirs].sort()).toEqual(['lowered', 'raised']);
    report(fails);
  });
});

describe('GP-06 oracle: variance-ignores-y (choice)', () => {
  /** Option text -> [factor on mu*, factor on sigma*^2]. */
  const factors = (option: string, lang: Lang): [number, number] => {
    const t = clean(option);
    if (lang === 'en') {
      if (/both stay the same/.test(t)) return [1, 1];
      const mu = /μ\* is multiplied by (\d+)/.exec(t), v = /σ\*² is multiplied by (\d+)/.exec(t);
      if (!mu) throw new Error(`cannot parse "${option}"`);
      if (!v && !/σ\*² stays the same/.test(t)) throw new Error(`cannot parse variance part of "${option}"`);
      return [Number(mu[1]), v ? Number(v[1]) : 1];
    }
    if (/都保持不变/.test(t)) return [1, 1];
    const mu = /μ\* 变为原来的 (\d+) 倍/.exec(t), v = /σ\*² (?:也)?变为原来的 (\d+) 倍/.exec(t);
    if (!mu) throw new Error(`cannot parse "${option}"`);
    if (!v && !/σ\*² 保持不变/.test(t)) throw new Error(`cannot parse variance part of "${option}"`);
    return [Number(mu[1]), v ? Number(v[1]) : 1];
  };
  it('exactly the option (mu* x lam, sigma*^2 x 1) is correct, in both languages, on every seed', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const card = pick(gp06(seedAt(i), lang), 'variance-ignores-y');
      const t = clean(card.prompt), at = `seed ${seedAt(i)} ${lang}`;
      const s = grab(t, /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/), c = grab(t, /k\(x\*, x₁\) = (\d+)/), n = grab(t, /σ² = (\d+)/);
      const [y, y2] = allGrab(t, /\by = (-?\d+)/);
      const lam = grab(t, lang === 'en' ? /multiplied by (\d+)/ : /乘以 (\d+)/);
      if (!set1.has(key(s, c, n))) fails.push(`${at}: row (${s},${c},${n}) not in the table`);
      if (!(Math.abs(y) >= 1 && Math.abs(y) <= 5)) fails.push(`${at}: y=${y}`);
      if (![2, 3, 5, 10].includes(lam)) fails.push(`${at}: lam=${lam}`);
      if (y2 !== lam * y) fails.push(`${at}: printed scaled y ${y2} != ${lam}*${y}`);
      const a = posterior(joint1(s, c), n, [y]), b = posterior(joint1(s, c), n, [lam * y]);
      const truth: [number, number] = [b.mu / a.mu, b.v / a.v];
      if (Math.abs(truth[0] - lam) > 1e-9 || Math.abs(truth[1] - 1) > 1e-9) fails.push(`${at}: oracle ratios ${truth}`);
      const verdicts = card.choice!.options.map(o => { const f = factors(o, lang); return Math.abs(f[0] - truth[0]) < 1e-9 && Math.abs(f[1] - truth[1]) < 1e-9; });
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options correct`);
      else if (verdicts[card.choice!.answer] !== true) fails.push(`${at}: answer index points to a wrong option`);
      if (lang === 'en') {
        const lens = card.choice!.options.map(o => o.length), cl = lens[card.choice!.answer];
        if (lens.every((l, k) => k === card.choice!.answer || l < cl)) fails.push(`${at}: correct option is the longest`);
      }
    }
    report(fails);
  });
});

describe('GP-06 oracle: sampling coverage and variety', () => {
  it('over 3000 seeds the samplers reach exactly the plan tables (no out-of-range values, no missing rows)', () => {
    const seen = {
      one: new Set<string>(), y1: new Set<number>(), two: new Set<string>(), twoY: new Set<number>(), ch: new Set<string>(), chC: new Set<number>(), chY: new Set<number>(),
      dist: new Set<string>(), at: new Set<string>(), nd: new Set<string>(), ndY: new Set<number>(), ndPair: new Set<string>(), va: new Set<string>(), vaY: new Set<number>(), vaLam: new Set<number>(),
    };
    for (let i = 0; i < COVER_SEEDS; i++) {
      const cards = gp06(seedAt(i), 'en');
      const g = (slug: string) => pick(cards, slug).audit!.params as P;
      const m = g('one-mean'); seen.one.add(key(m.k11, m.ks1, m.noise)); seen.y1.add(m.y1);
      const t = g('two-mean'); seen.two.add(key(t.k11, t.k12, t.noise, t.ks)); seen.twoY.add(t.y1); seen.twoY.add(t.y2);
      const c = g('challenge'); seen.ch.add(key(c.k11, c.k12, c.noise)); seen.chC.add(c.ks1); seen.chC.add(c.ks2); seen.chY.add(c.y1); seen.chY.add(c.y2);
      const d = g('distance'); seen.dist.add(key(d.k11, d.noise, ((d.ksa as number)), d.ksb));
      const a = g('at-data'); seen.at.add(key(a.k11, a.noise));
      const nd = clean(pick(cards, 'noise-direction').prompt);
      seen.nd.add(key(grab(nd, /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/), grab(nd, /k\(x\*, x₁\) = (\d+)/)));
      seen.ndY.add(grab(nd, /\by = (-?\d+)/)); const [n1, n2] = allGrab(nd, /σ² = (\d+)/); seen.ndPair.add(key(n1, n2));
      const va = clean(pick(cards, 'variance-ignores-y').prompt);
      seen.va.add(key(grab(va, /k\(x₁, x₁\) = k\(x\*, x\*\) = (\d+)/), grab(va, /k\(x\*, x₁\) = (\d+)/), grab(va, /σ² = (\d+)/)));
      seen.vaY.add(grab(va, /\by = (-?\d+)/)); seen.vaLam.add(grab(va, /multiplied by (\d+)/));
    }
    const range = (lo: number, hi: number, skip: number[] = []) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).filter(v => !skip.includes(v));
    const same = (got: Set<unknown>, want: unknown[]) => expect([...got].sort()).toEqual([...want].sort());
    same(seen.one, ROWS1.map(r => key(...r))); same(seen.y1, range(-6, 6, [0]));
    same(seen.two, ROWS2.map(r => key(...r))); same(seen.twoY, range(-4, 6));
    same(seen.ch, CH_ROWS.map(r => key(...r)));
    const adm = [...challengeAdmissible()].map(k => k.split(',').map(Number));
    expect(adm).toHaveLength(2460);
    same(seen.chC, [...new Set(adm.flatMap(a => [a[3], a[4]]))]); same(seen.chY, range(-4, 6));
    const dist: string[] = []; for (const s of [3, 4, 5]) for (const n of [1, 2, 3]) if (s + n <= 7) for (let a = 2; a <= s - 1; a++) for (let b = 0; b <= a - 1; b++) dist.push(key(s, n, a, b));
    expect(dist).toHaveLength(39); same(seen.dist, dist);
    const at: string[] = []; for (let s = 2; s <= 6; s++) for (let n = 1; n <= 4; n++) if (s !== n) at.push(key(s, n));
    expect(at).toHaveLength(17); same(seen.at, at);
    same(seen.nd, [[2, 1], [3, 1], [3, 2], [4, 1], [4, 2], [4, 3]].map(r => key(...r))); same(seen.ndY, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
    same(seen.ndPair, [[1, 2], [1, 4], [2, 1], [2, 4], [4, 1], [4, 2]].map(r => key(...r)));
    same(seen.va, ROWS1.map(r => key(...r))); same(seen.vaY, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]); same(seen.vaLam, [2, 3, 5, 10]);
  });

  it('every card has at least 6 distinct prompts over 60 seeds (EN and ZH)', () => {
    const fails: string[] = [];
    for (const lang of ['en', 'zh'] as Lang[]) {
      const prompts = new Map<string, Set<string>>();
      for (let i = 0; i < SEEDS; i++) for (const c of gp06(seedAt(i), lang)) { if (!prompts.has(c.id)) prompts.set(c.id, new Set()); prompts.get(c.id)!.add(c.prompt + JSON.stringify(c.figure?.shapes ?? '')); }
      for (const [id, s] of prompts) if (s.size < 6) fails.push(`${lang} ${id}: only ${s.size} distinct prompts`);
    }
    report(fails);
  });
});

describe('GP-06 oracle: learner-facing text', () => {
  it('explanations have no rounded decimals and no ambiguous fraction chains; ZH has no English words except GP, GPML and det', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) for (const c of gp06(seedAt(i), lang)) {
      const at = `${c.id} ${lang} seed ${seedAt(i)}`;
      const expl = clean(c.explanation);
      if (/\d\.\d/.test(expl.replace(/(?:eq\. |式 )\d+\.\d+/g, ''))) fails.push(`${at}: decimal in explanation`);
      if (/\d\/\d+(?:\/|²)/.test(expl.replace(/\(\d+\/\d+\)²/g, ''))) fails.push(`${at}: ambiguous fraction chain`);
      if (lang === 'zh') for (const text of [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? []), c.figure?.alt ?? '', ...(c.figure?.shapes ?? []).map(sh => ('label' in sh && sh.label) || '')]) {
        const words = text.replace(/GPML|GP|det/g, '').match(/[A-Za-z]{3,}/g);
        if (words) fails.push(`${at}: English words in zh text: ${words.join(' ')}`);
      }
    }
    report(fails);
  });
});
