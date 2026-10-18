import { describe, expect, it } from 'vitest';
import { gp03 } from './games/gp03';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-03 (sampling with a Cholesky factor), written from docs/aalto-gp-drafts/approved-GP-03.md only.
 * Every answer is recomputed from the numbers PRINTED in the prompt: Cholesky by a hand-written algorithm, products by explicit
 * matrix multiplication, and the sample checked by forward substitution L z' = f - m.
 */
const SEEDS = 60;
const TOL = 0.006;
type Lang = 'en' | 'zh';
type M = number[][];
const seedAt = (i: number) => spreadSeed(i);
const clean = (t: string) => t.replaceAll('−', '-').replaceAll('`', '');
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);
const slugs = ['sample-value', 'chol-factor', 'llt-entries', 'sample-cov', 'jitter', 'no-factor', 'gp-grid', 'challenge'] as const;
const pick = (cards: PracticeCard[], slug: string) => {
  const c = cards.find(x => x.id === `GP-03-${slug}`);
  if (!c) throw new Error(`card GP-03-${slug} missing`);
  return c;
};
const ints = (s: string) => [...clean(s).matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));

// ---------- linear algebra by hand ----------
const T = (A: M): M => A[0].map((_, j) => A.map(r => r[j]));
const mul = (A: M, B: M): M => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const mv = (A: M, v: number[]) => A.map(r => r.reduce((s, x, k) => s + x * v[k], 0));
function chol(A: M): M {
  const n = A.length, L: M = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (!(s > 1e-12)) throw new Error('not positive definite'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function forward(L: M, b: number[]): number[] {
  const x: number[] = [];
  for (let i = 0; i < L.length; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x.push(s / L[i][i]); }
  return x;
}
const same = (a: number[], b: number[], eps = 1e-9) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= eps);
const flat = (A: M) => A.flat();

// ---------- the plan's finite families ----------
const L_ROWS: [number, number, number][] = [[2, 1, 2], [2, -1, 3], [3, 1, 2], [3, -2, 2], [2, 2, 1], [3, 2, 1], [2, 1, 1], [3, -1, 3], [4, 2, 1], [2, -2, 3]];
const CH_L_ROWS: [number, number, number][] = [[3, 3, 1], [4, 1, 3], [2, 3, 2]];
const sigmaOf = ([a, b, c]: [number, number, number]): M => mul([[a, 0], [b, c]], [[a, b], [0, c]]);
const key = (...v: number[]) => v.join(',');
const famL = new Set(L_ROWS.map(r => key(...r)));
const famSigma = new Set(L_ROWS.map(r => key(...flat(sigmaOf(r)))));
const chL = new Set(CH_L_ROWS.map(r => key(...r)));
const chSigma = new Set(CH_L_ROWS.map(r => key(...flat(sigmaOf(r)))));
const M_SET = new Set([[0, 0], [1, -1], [-2, 3], [2, 2], [-1, -2], [3, -1]].map(r => key(...r)));
const Z2_SET = new Set([[2, -1], [1, 2], [-1, 3], [3, 2], [-2, -1], [2, 1]].map(r => key(...r)));
const Z3_SET = new Set([[1, -1, 2], [-1, 1, 2], [2, 0, -1], [-1, -2, 1], [3, 1, -1], [0, 2, 1]].map(r => key(...r)));
const ZC_SET = new Set([[1, 2], [-1, 2], [2, -1]].map(r => key(...r)));
const NF_SET = new Set([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]].map(r => key(...r)));
const L3: M = [[2, 0, 0], [1, 2, 0], [1, 1, 1]];

// ---------- text parsing ----------
function matrix(text: string, label: string): M {
  const t = clean(text);
  const re = new RegExp(`${label} = \\[\\[([-\\d., ]*)\\], ?\\[([-\\d., ]*)\\](?:, ?\\[([-\\d., ]*)\\])?\\]`);
  const m = re.exec(t);
  if (!m) throw new Error(`no numeric matrix after "${label} = " in: ${t.slice(0, 200)}`);
  return m.slice(1).filter(x => x !== undefined).map(r => r.split(',').map(Number));
}
function vector(text: string, label: string): number[] {
  const m = new RegExp(`\\b${label} = \\(([-\\d., ]+)\\)`).exec(clean(text));
  if (!m) throw new Error(`no vector "${label} = (…)" in: ${clean(text).slice(0, 200)}`);
  return m[1].split(',').map(Number);
}

/** Truth for each numeric card computed from the PRINTED prompt only. */
function truth(slug: string, prompt: string): { answers: number[]; params: Record<string, number>; details: string[] } {
  const details: string[] = [];
  switch (slug) {
    case 'sample-value': {
      const L = matrix(prompt, 'L'), m = vector(prompt, 'm'), z = vector(prompt, 'z');
      const f = mv(L, z).map((v, i) => v + m[i]);
      // independent route: forward substitution recovers z
      if (!same(forward(L, f.map((v, i) => v - m[i])), z)) details.push('forward substitution does not recover z');
      if (!famL.has(key(L[0][0], L[1][0], L[1][1])) || L[0][1] !== 0) details.push(`L ${JSON.stringify(L)} not a family row`);
      if (!M_SET.has(key(...m))) details.push(`m ${m} not in the plan's set`);
      if (!Z2_SET.has(key(...z))) details.push(`z ${z} not in the plan's set`);
      if (z[0] === z[1]) details.push('z1 = z2');
      return { answers: f, params: { l11: L[0][0], l21: L[1][0], l22: L[1][1], m1: m[0], m2: m[1], z1: z[0], z2: z[1] }, details };
    }
    case 'chol-factor': {
      const S = matrix(prompt, 'Σ'), L = chol(S);
      if (!same(flat(mul(L, T(L))), flat(S))) details.push('chol(S) Lt != S');
      if (!famSigma.has(key(...flat(S)))) details.push(`Σ ${flat(S)} not a family row`);
      return { answers: [L[1][0], L[1][1]], params: { s11: S[0][0], s12: S[0][1], s22: S[1][1] }, details };
    }
    case 'llt-entries': {
      const L = matrix(prompt, 'L'), S = mul(L, T(L));
      const det = S[0][0] * S[1][1] - S[0][1] ** 2;
      if (Math.abs(det - (L[0][0] * L[1][1]) ** 2) > 1e-9) details.push('det check');
      if (!famL.has(key(L[0][0], L[1][0], L[1][1]))) details.push(`L ${flat(L)} not a family row`);
      return { answers: [S[0][1], S[1][1]], params: { l11: L[0][0], l21: L[1][0], l22: L[1][1] }, details };
    }
    case 'gp-grid': {
      const K = matrix(prompt, 'K'), L = matrix(prompt, 'L'), z = vector(prompt, 'z');
      if (!same(flat(L), flat(L3))) details.push(`L printed ${flat(L)} != fixed L`);
      if (!same(flat(mul(L, T(L))), flat(K))) details.push('L Lt != printed K');
      if (!same(flat(K), [4, 2, 2, 2, 5, 3, 2, 3, 3])) details.push('K != plan K');
      if (!Z3_SET.has(key(...z))) details.push(`z ${z} not in the plan's set`);
      const f = mv(L, z);
      if (!same(forward(L, f), z)) details.push('forward substitution does not recover z');
      return { answers: [f[1], f[2]], params: { z1: z[0], z2: z[1], z3: z[2] }, details };
    }
    case 'challenge': {
      const S = matrix(prompt, 'Σ'), z = vector(prompt, 'z'), L = chol(S);
      if (!chSigma.has(key(...flat(S)))) details.push(`Σ ${flat(S)} not in rows 11-13`);
      if (!ZC_SET.has(key(...z))) details.push(`z ${z} not in the plan's set`);
      const y = mv(L, z);
      if (!same(forward(L, y), z)) details.push('forward substitution does not recover z');
      if (Math.abs(y[1]) < 1e-9 || z[0] === z[1]) details.push('guards y2 != 0, z1 != z2');
      return { answers: y, params: { s11: S[0][0], s12: S[0][1], s22: S[1][1], z1: z[0], z2: z[1] }, details };
    }
    default: throw new Error(`no numeric truth for ${slug}`);
  }
}
const NUMERIC = ['sample-value', 'chol-factor', 'llt-entries', 'gp-grid', 'challenge'] as const;

describe('GP-03 oracle: deck shape', () => {
  it('has the 8 planned cards in order, right answer modes, one audit per numeric card, figure only on gp-grid', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const cards = gp03(seedAt(i), lang);
      const at = `seed ${seedAt(i)} ${lang}`;
      if (cards.map(c => c.id).join() !== slugs.map(s => `GP-03-${s}`).join()) { fails.push(`${at}: ids ${cards.map(c => c.id)}`); continue; }
      for (const c of cards) {
        const slug = c.id.slice(6);
        const numeric = (NUMERIC as readonly string[]).includes(slug);
        if (numeric !== !!c.fields) fails.push(`${at} ${slug}: fields presence`);
        if (!numeric && !c.choice) fails.push(`${at} ${slug}: expected a choice card`);
        if (c.slots) fails.push(`${at} ${slug}: unexpected slots`);
        if (numeric !== !!c.audit) fails.push(`${at} ${slug}: audit presence`);
        if (numeric && c.audit && c.audit.kind !== `GP-03:${slug}`) fails.push(`${at} ${slug}: audit kind ${c.audit.kind}`);
        if (!!c.figure !== (slug === 'gp-grid')) fails.push(`${at} ${slug}: figure presence`);
        if (c.fields) {
          const want = slug === 'sample-value' || slug === 'challenge' || slug === 'chol-factor' || slug === 'llt-entries' || slug === 'gp-grid' ? 2 : 0;
          if (c.fields.length !== want) fails.push(`${at} ${slug}: ${c.fields.length} fields`);
          for (const f of c.fields) if (f.tolerance !== TOL) fails.push(`${at} ${slug}: tolerance ${f.tolerance}`);
          const tail = lang === 'en' ? 'Give integers, fractions or decimals rounded to 2 places.' : '请填整数、分数，或保留 2 位小数的小数。';
          if (!c.prompt.trim().endsWith(tail)) fails.push(`${at} ${slug}: prompt does not end with the answer-format sentence`);
        }
        if (c.choice && c.choice.options.length !== 4) fails.push(`${at} ${slug}: ${c.choice.options.length} options`);
      }
    }
    report(fails);
  });
});

describe('GP-03 oracle: numeric audit kinds', () => {
  for (const slug of NUMERIC) {
    it(`${slug}: answers, grading, perturbation, printed text = audit params (60 seeds x EN/ZH)`, () => {
      const fails: string[] = [];
      let fired = 0;
      const collisions: string[] = [];
      for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
        const seed = seedAt(i), at = `seed ${seed} ${lang} ${slug}`;
        const card = pick(gp03(seed, lang), slug);
        let t: ReturnType<typeof truth>;
        try { t = truth(slug, card.prompt); } catch (e) { fails.push(`${at}: ${(e as Error).message}`); continue; }
        for (const d of t.details) fails.push(`${at}: ${d}`);
        fired++;
        if (card.audit?.kind !== `GP-03:${slug}`) fails.push(`${at}: audit kind ${card.audit?.kind}`);
        // printed text = audit params
        const got = card.audit?.params ?? {};
        if (JSON.stringify(Object.keys(got).sort()) !== JSON.stringify(Object.keys(t.params).sort())) fails.push(`${at}: audit param names ${Object.keys(got)} vs ${Object.keys(t.params)}`);
        for (const [k, v] of Object.entries(t.params)) if (got[k] !== v) fails.push(`${at}: audit ${k}=${got[k]} but printed ${v}`);
        // answers
        const fields = card.fields!;
        t.answers.forEach((a, k) => { if (Math.abs(fields[k].answer - a) > 1e-9) fails.push(`${at} field ${k}: expected ${a}, got ${fields[k].answer}`); });
        const exactStr = t.answers.map(a => (Math.abs(a - Math.round(a)) < 1e-9 ? String(Math.round(a)) : String(a)));
        if (gradeCard(card, exactStr, null, []) !== 'correct') fails.push(`${at}: exact answers ${exactStr} do not grade correct`);
        if (gradeCard(card, exactStr.map(s => s.replace('-', '−')), null, []) !== 'correct') fails.push(`${at}: unicode minus answers do not grade correct`);
        // perturbation beyond tolerance
        for (let k = 0; k < t.answers.length; k++) for (const d of [0.02, -0.02, 1, -1]) {
          const v = exactStr.slice(); v[k] = String(t.answers[k] + d);
          if (gradeCard(card, v, null, []) !== 'incorrect') fails.push(`${at}: field ${k} perturbed by ${d} still grades ${gradeCard(card, v, null, [])}`);
        }
        const nudge = exactStr.map((s, k) => String(t.answers[k] + 0.004));
        if (gradeCard(card, nudge, null, []) !== 'correct') fails.push(`${at}: +0.004 should be within tolerance`);
        // swapped fields must be wrong unless equal
        if (Math.abs(t.answers[0] - t.answers[1]) > 0.02 && gradeCard(card, [exactStr[1], exactStr[0]], null, []) !== 'incorrect') fails.push(`${at}: swapped fields graded correct`);
        // wrong routes (written from the plan's pitfalls)
        const w = wrong(slug, card.prompt);
        for (const route of w) if (route.every((v, k) => Math.abs(v - t.answers[k]) <= TOL)) collisions.push(`${at}: wrong route ${route} = truth ${t.answers}`);
      }
      report(fails);
      // informational: a learner's typical wrong route that gives the right numbers on a degenerate draw (e.g. z2 = 0, l22 = 1, f1 = f2)
      if (collisions.length) console.log(`[GP-03 ${slug}] ${collisions.length} wrong-route collisions (informational), e.g. ${collisions[0]}`);
      expect(fired).toBe(SEEDS * 2);
    });
  }
});

/** Wrong values a learner could produce; a prompt on which one coincides with the truth is flawed. */
function wrong(slug: string, prompt: string): number[][] {
  if (slug === 'sample-value') {
    const L = matrix(prompt, 'L'), m = vector(prompt, 'm'), z = vector(prompt, 'z'), t = truth(slug, prompt).answers;
    const Lt = T(L);
    return [...(m[0] === 0 && m[1] === 0 ? [] : [mv(L, z)]), mv(Lt, z).map((v, i) => v + m[i]), [m[0] + z[0], m[1] + z[1]], ];
  }
  if (slug === 'chol-factor') {
    const S = matrix(prompt, 'Σ'), l11 = Math.sqrt(S[0][0]), l21 = S[0][1] / l11;
    return [[S[0][1], S[1][1]], [S[0][1], Math.sqrt(S[1][1])], [l21, Math.sqrt(S[1][1])], [S[0][1] / S[0][0], S[1][1] - l21 ** 2]];
  }
  if (slug === 'llt-entries') {
    const L = matrix(prompt, 'L'), S2 = mul(T(L), L);
    return [[S2[0][1], S2[1][1]], [L[1][0], L[1][1]], [L[1][0], L[1][1] ** 2]];
  }
  if (slug === 'gp-grid') {
    const z = vector(prompt, 'z');
    return [[2 * z[0] + z[1], z[0] + z[1] + z[2]], [z[0] + z[1], z[0] + z[1] + z[2]], [z[0] + 2 * z[1], z[1] + z[2]]];
  }
  const S = matrix(prompt, 'Σ'), z = vector(prompt, 'z'), L = chol(S);
  return [[S[0][0] * z[0], S[0][1] * z[0] + S[1][1] * z[1]], [L[0][0] * z[0], S[0][1] * z[0] + L[1][1] * z[1]], [Math.sqrt(S[0][0]) * z[0], L[1][0] * z[0] + Math.sqrt(S[1][1]) * z[1]], [S[0][0], S[1][1]]];
}

describe('GP-03 oracle: audit coverage', () => {
  it('exactly the five planned audit kinds fire on every seed; no unknown kinds', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) for (const c of gp03(seedAt(i), lang)) if (c.audit) counts[c.audit.kind] = (counts[c.audit.kind] ?? 0) + 1;
    expect(counts).toEqual(Object.fromEntries(NUMERIC.map(s => [`GP-03:${s}`, SEEDS * 2])));
  });
});

describe('GP-03 oracle: choice cards', () => {
  it('sample-cov: exactly the LLt option is correct; L, LtL, I differ from LLt for the printed L', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const at = `seed ${seedAt(i)} ${lang}`, c = pick(gp03(seedAt(i), lang), 'sample-cov'), L = matrix(c.prompt, 'L');
      if (!famL.has(key(L[0][0], L[1][0], L[1][1]))) fails.push(`${at}: L not a family row`);
      const S = mul(L, T(L));
      if (same(flat(L), flat(S)) || same(flat(mul(T(L), L)), flat(S)) || same(flat(S), [1, 0, 0, 1])) fails.push(`${at}: a distractor matrix equals LLt for ${flat(L)}`);
      const norm = (o: string) => clean(o).replace(/\s/g, '');
      const verdicts = c.choice!.options.map(o => norm(o).startsWith('LLᵀ'));
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options start with LLᵀ`);
      if (!verdicts[c.choice!.answer]) fails.push(`${at}: answer index ${c.choice!.answer} is not the LLᵀ option`);
      const others = c.choice!.options.filter((_, k) => k !== c.choice!.answer).map(norm);
      if (!others.some(o => o.startsWith('LᵀL')) || !others.some(o => /^L[,，]/.test(o)) || !others.some(o => /^I[,，]/.test(o))) fails.push(`${at}: distractors are not L, LᵀL, I: ${others}`);
      // explanation shows LLt for the printed L
      if (!clean(c.explanation).includes(`[[${S[0][0]}, ${S[0][1]}], [${S[1][0]}, ${S[1][1]}]]`)) fails.push(`${at}: explanation does not print LLt = ${JSON.stringify(S)}`);
      const longest = Math.max(...c.choice!.options.map(o => o.length));
      if (c.choice!.options[c.choice!.answer].length === longest && c.choice!.options.filter(o => o.length === longest).length === 1) fails.push(`${at}: correct option is the longest`);
    }
    report(fails);
  });

  it('jitter: only the positive-definiteness option is correct; K is a family matrix and eps in {1e-6, 1e-8}', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const at = `seed ${seedAt(i)} ${lang}`, c = pick(gp03(seedAt(i), lang), 'jitter');
      const K = matrix(c.prompt, 'K');
      if (!famSigma.has(key(...flat(K)))) fails.push(`${at}: K ${flat(K)} not a family Σ`);
      const eps = /ε = (0\.0*1|10⁻⁶|10⁻⁸)(?![\d⁰-⁹])/.exec(clean(c.prompt));
      const epsValue = eps ? (eps[1] === '10⁻⁶' ? 1e-6 : eps[1] === '10⁻⁸' ? 1e-8 : Number(eps[1])) : NaN;
      if (![1e-6, 1e-8].includes(epsValue)) fails.push(`${at}: eps not 10⁻⁶ / 10⁻⁸ in ${clean(c.prompt).slice(0, 160)}`);
      const pd = lang === 'en' ? /positive definite/ : /正定/;
      const verdicts = c.choice!.options.map(o => pd.test(o));
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options mention positive definiteness`);
      if (!verdicts[c.choice!.answer]) fails.push(`${at}: answer index is not the positive-definite option`);
      for (const wrongHint of lang === 'en' ? ['signal variance', 'diagonal', 'cheaper'] : ['信号方差', '对角', '代价']) if (!c.choice!.options.some(o => o.includes(wrongHint))) fails.push(`${at}: missing distractor about "${wrongHint}"`);
      const opts = c.choice!.options, correct = opts[c.choice!.answer];
      if (opts.filter(o => o.length >= correct.length).length === 1) fails.push(`${at}: correct option is the longest of all (length tell)`);
    }
    report(fails);
  });

  it('no-factor: the correct option says no real factor, det = a^2 - b^2 < 0 is printed correctly, distractors wrong', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const at = `seed ${seedAt(i)} ${lang}`, c = pick(gp03(seedAt(i), lang), 'no-factor');
      const S = matrix(c.prompt, 'Σ'), a = S[0][0], b = S[0][1];
      if (S[1][1] !== a || S[1][0] !== b || !NF_SET.has(key(a, b))) fails.push(`${at}: Σ ${flat(S)} not [[a,b],[b,a]] of the plan`);
      let detPosDef = true;
      try { chol(S); } catch { detPosDef = false; }
      if (detPosDef || a * a - b * b >= 0 || a - b * b / a >= 0) fails.push(`${at}: Σ is unexpectedly positive definite`);
      const none = lang === 'en' ? /^There is none/ : /^不存在/;
      const verdicts = c.choice!.options.map(o => none.test(clean(o)));
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} "none" options`);
      if (!verdicts[c.choice!.answer]) fails.push(`${at}: answer index wrong`);
      const text = clean(c.choice!.options[c.choice!.answer]);
      const det = a * a - b * b;
      if (!text.includes(`${a * a} - ${b * b} = ${det}`) || !text.includes('< 0')) fails.push(`${at}: correct option must show ${a * a} - ${b * b} = ${det} < 0: ${text}`);
      const wrongs = c.choice!.options.filter((_, k) => k !== c.choice!.answer).map(clean);
      if (!wrongs.some(o => o.includes(`√${a}`)) || !wrongs.some(o => /^(It exists|存在)/.test(o))) fails.push(`${at}: distractors lack the procedural / existence traps`);
      if (!clean(c.explanation).includes(`${a} - ${b * b}/${a} = ${(a * a - b * b) / a}`) && !clean(c.explanation).includes(String(det))) fails.push(`${at}: explanation lacks det ${det}`);
    }
    report(fails);
  });
});

describe('GP-03 oracle: figure', () => {
  it('gp-grid figure draws exactly the 3 grid inputs and the prior mean line, with coordinates matching the printed grid and not the answers', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const at = `seed ${seedAt(i)} ${lang}`, c = pick(gp03(seedAt(i), lang), 'gp-grid'), f = c.figure!;
      if (!f) { fails.push(`${at}: no figure`); continue; }
      const grid = /x₁ = 0, x₂ = 1, x₃ = 2|x₁ = 0，x₂ = 1，x₃ = 2|x₁ = 0, x₂ = 1, x₃ = 2/.test(c.prompt);
      if (!grid) fails.push(`${at}: prompt does not print the grid 0,1,2`);
      const pts = f.shapes.filter(s => s.kind === 'point') as Extract<typeof f.shapes[number], { kind: 'point' }>[];
      const xs = pts.map(p => p.at[0]).sort();
      if (pts.length !== 3 || xs.join() !== '0,1,2' || pts.some(p => p.at[1] !== 0)) fails.push(`${at}: points ${JSON.stringify(pts.map(p => p.at))}`);
      for (const [k, x] of [[1, 0], [2, 1], [3, 2]]) { const p = pts.find(q => q.at[0] === x); if (!p || !p.label?.includes(`x${'₀₁₂₃'[k]}`)) fails.push(`${at}: point at ${x} label ${p?.label}`); }
      const lines = f.shapes.filter(s => s.kind === 'line') as Extract<typeof f.shapes[number], { kind: 'line' }>[];
      if (lines.length !== 1 || lines[0].points.some(p => p[1] !== 0) || Math.min(...lines[0].points.map(p => p[0])) > 0 || Math.max(...lines[0].points.map(p => p[0])) < 2) fails.push(`${at}: prior-mean line wrong`);
      if (f.shapes.length !== 4) fails.push(`${at}: ${f.shapes.length} shapes`);
      const t = truth('gp-grid', c.prompt);
      if (f.shapes.some(s => s.kind === 'text' || s.kind === 'arrow' || s.kind === 'area')) fails.push(`${at}: unexpected shape kinds`);
      const alsoShown = JSON.stringify(f.shapes);
      for (const a of t.answers) if (a !== 0 && alsoShown.includes(`"label":"${a}"`)) fails.push(`${at}: figure labels the answer ${a}`);
      if (pts.some(p => t.answers.some(a => p.at[1] === a))) fails.push(`${at}: a point sits at an answer value`);
      if (!f.alt.trim() || (lang === 'en' && /[㐀-鿿]/.test(f.alt))) fails.push(`${at}: alt`);
      if (f.axes?.xLabel !== 'x' || f.axes?.yLabel !== 'f') fails.push(`${at}: axes ${JSON.stringify(f.axes)}`);
      const { xmin, xmax, ymin, ymax } = f.view;
      if (!(xmin < 0 && xmax > 2 && ymin < 0 && ymax > 0)) fails.push(`${at}: view does not contain the plotted shapes ${JSON.stringify(f.view)}`);
    }
    report(fails);
  });
});

describe('GP-03 oracle: variety', () => {
  it('every card has at least 6 distinct prompts over 60 seeds', () => {
    const seen: Record<string, Set<string>> = {};
    for (let i = 0; i < SEEDS; i++) for (const c of gp03(seedAt(i), 'en')) (seen[c.id] ??= new Set()).add(c.prompt);
    const low = Object.entries(seen).filter(([, s]) => s.size < 6).map(([id, s]) => `${id}: ${s.size}`);
    expect(low).toEqual([]);
  });
  it('is deterministic per seed and ZH answers equal EN answers', () => {
    for (let i = 0; i < 20; i++) {
      const en = gp03(seedAt(i), 'en'), zh = gp03(seedAt(i), 'zh');
      expect(JSON.stringify(gp03(seedAt(i), 'en'))).toBe(JSON.stringify(en));
      en.forEach((c, k) => {
        expect(zh[k].fields?.map(f => f.answer)).toEqual(c.fields?.map(f => f.answer));
        expect(zh[k].choice?.answer).toBe(c.choice?.answer);
      });
    }
  });
});
