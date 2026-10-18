import { describe, expect, it } from 'vitest';
import { gp05 } from './games/gp05';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';
import type { Figure, FigureShape } from '../figure';

/**
 * Independent oracle for GP-05 (from weights to functions).
 * Written from docs/aalto-gp-drafts/approved-GP-05.md only. Numeric answers are recomputed by building Phi (rows phi(x_i)^T), forming
 * K = Phi Sigma_p Phi^T with hand-written matrix products, and reading off entries / a hand-written determinant (cofactor + elimination),
 * never by the plan's closed form alone. The closed form is used as a second route and must agree.
 */
const SEEDS = 60;
const TOL = 0.006;
type Lang = 'en' | 'zh';
type P = Record<string, number>;
type M = number[][];
const seedAt = (i: number) => spreadSeed(i);
const clean = (t: string) => t.replaceAll('−', '-');
const slugs = ['kernel-value', 'poly-feature', 'gram-det', 'gram-rank', 'gp-def', 'consistency', 'se-vs-features', 'challenge'] as const;
const NUMERIC = ['kernel-value', 'poly-feature', 'gram-det', 'challenge'];
const CONCEPT = ['gp-def', 'consistency', 'se-vs-features'];
const pick = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-05-${slug}`);
  if (!card) throw new Error(`card GP-05-${slug} missing`);
  return card;
};
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);

// ---------- linear algebra written by hand ----------
const matMul = (A: M, B: M): M => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const transpose = (A: M): M => A[0].map((_, j) => A.map(r => r[j]));
const diag = (...d: number[]): M => d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));
/** determinant by Gaussian elimination with partial pivoting */
function detElim(A: M): number {
  const n = A.length, W = A.map(r => [...r]);
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    if (Math.abs(W[p][c]) < 1e-12) return 0;
    if (p !== c) { [W[c], W[p]] = [W[p], W[c]]; det = -det; }
    det *= W[c][c];
    for (let r = c + 1; r < n; r++) { const f = W[r][c] / W[c][c]; for (let j = c; j < n; j++) W[r][j] -= f * W[c][j]; }
  }
  return det;
}
/** determinant by cofactor expansion (second route) */
function detCof(A: M): number {
  if (A.length === 1) return A[0][0];
  return A[0].reduce((s, v, j) => s + (j % 2 ? -1 : 1) * v * detCof(A.slice(1).map(r => r.filter((_, k) => k !== j))), 0);
}
const leadingMinors = (A: M) => A.map((_, i) => detCof(A.slice(0, i + 1).map(r => r.slice(0, i + 1))));
const rankOf = (A: M): number => {
  const W = A.map(r => [...r]); let rank = 0;
  for (let c = 0; c < W[0].length && rank < W.length; c++) {
    let p = rank;
    for (let r = rank + 1; r < W.length; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    if (Math.abs(W[p][c]) < 1e-9) continue;
    [W[rank], W[p]] = [W[p], W[rank]];
    for (let r = rank + 1; r < W.length; r++) { const f = W[r][c] / W[rank][c]; for (let j = c; j < W[0].length; j++) W[r][j] -= f * W[rank][j]; }
    rank++;
  }
  return rank;
};
const poly = (x: number, d: number) => Array.from({ length: d }, (_, i) => x ** i);
const gram = (Sigma: M, xs: number[]): M => { const Phi = xs.map(x => poly(x, Sigma.length)); return matMul(matMul(Phi, Sigma), transpose(Phi)); };

/** Oracle per audit kind; params exactly as audited; result in field order. */
function oracle(kind: string, p: P): number[] {
  switch (kind) {
    case 'GP-05:kernel-value': return [gram(diag(p.a, p.b), [p.x1, p.x2])[0][1]];
    case 'GP-05:poly-feature': return [gram(diag(p.a, p.b, p.c), [p.x1, p.x2])[0][1]];
    case 'GP-05:gram-det': {
      const K = gram(diag(p.a, p.b), [p.x1, p.x2]);
      const d1 = detElim(K), d2 = detCof(K);
      // third route: det(Phi)^2 det(Sigma_p)
      const d3 = detCof([[1, p.x1], [1, p.x2]]) ** 2 * (p.a * p.b);
      if (Math.abs(d1 - d2) > 1e-9 || Math.abs(d1 - d3) > 1e-9) throw new Error(`det routes disagree ${d1} ${d2} ${d3}`);
      return [d1];
    }
    case 'GP-05:challenge': {
      const S = [[p.a, p.c], [p.c, p.b]];
      if (!(leadingMinors(S).every(m => m > 0))) throw new Error('Sigma_p is not positive definite');
      const K12 = gram(S, [p.x1, p.x2]);
      const sphi = matMul(S, [[1], [p.x2]]); // Sigma_p phi(x2)
      const alt = 1 * sphi[0][0] + p.x1 * sphi[1][0];
      if (Math.abs(alt - K12[0][1]) > 1e-9) throw new Error('challenge routes disagree');
      return [K12[0][1], K12[0][0]];
    }
    default: throw new Error(`unknown audit kind ${kind}`);
  }
}
/** Wrong routes a learner could take (the plan's guards); each must be rejected by the grader. */
function wrongRoutes(kind: string, p: P): number[][] {
  switch (kind) {
    case 'GP-05:kernel-value': return [[1 + p.x1 * p.x2], [p.a + p.b * (p.x1 + p.x2)], [p.b * p.x1 * p.x2]];
    case 'GP-05:poly-feature': return [[p.a + p.b * p.x1 * p.x2], [p.a + p.c * (p.x1 * p.x2) ** 2], [p.a + (p.b + p.c) * p.x1 * p.x2]];
    case 'GP-05:gram-det': {
      const K11 = p.a + p.b * p.x1 ** 2, K22 = p.a + p.b * p.x2 ** 2, K12 = p.a + p.b * p.x1 * p.x2;
      return [[(p.x1 - p.x2) ** 2], [p.b * (p.x1 - p.x2) ** 2], [K11 * K22 - K12]];
    }
    case 'GP-05:challenge': return [
      [p.a + p.b * p.x1 * p.x2, p.a + 2 * p.c * p.x1 + p.b * p.x1 ** 2], [p.a + p.c * (p.x1 + p.x2), p.a + 2 * p.c * p.x1 + p.b * p.x1 ** 2],
      [p.a + p.c * (p.x1 + p.x2) + p.b * p.x1 * p.x2, p.a + p.b * p.x1 ** 2], [p.a + p.c * (p.x1 + p.x2) + p.b * p.x1 * p.x2, p.a + 2 * p.c * p.x1],
    ];
    default: return [];
  }
}
function toFraction(v: number): string {
  for (let d = 1; d <= 2000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return d === 1 ? `${n}` : `${n}/${d}`; }
  throw new Error(`no small fraction for ${v}`);
}

// ---------- text parsing ----------
const grab = (text: string, re: RegExp): number => {
  const m = re.exec(text);
  if (!m) throw new Error(`no match for ${re} in: ${text.slice(0, 160)}`);
  return Number(m[1]);
};
const matrices = (text: string): M[] => [...clean(text).matchAll(/\[\[.*?\]\]/g)].map(m => [...m[0].matchAll(/\[([^\[\]]*)\]/g)].map(r => r[1].split(',').map(s => Number(s.trim()))));
/** The sampled numbers as the learner sees them. */
function printedParams(kind: string, raw: string): P {
  const t = clean(raw);
  const S = matrices(t)[0];
  const x1 = grab(t, /x₁ = (-?\d+)/), x2 = grab(t, /x₂ = (-?\d+)/);
  switch (kind) {
    case 'GP-05:kernel-value': case 'GP-05:gram-det': {
      if (S.length !== 2 || S[0][1] !== 0 || S[1][0] !== 0) throw new Error('Sigma_p is not printed as a 2x2 diagonal');
      return { a: S[0][0], b: S[1][1], x1, x2 };
    }
    case 'GP-05:poly-feature': {
      if (S.length !== 3 || S.some((r, i) => r.some((v, j) => i !== j && v !== 0))) throw new Error('Sigma_p is not printed as a 3x3 diagonal');
      return { a: S[0][0], b: S[1][1], c: S[2][2], x1, x2 };
    }
    case 'GP-05:challenge': {
      if (S.length !== 2 || S[0][1] !== S[1][0]) throw new Error('Sigma_p is not printed as a symmetric 2x2');
      return { a: S[0][0], c: S[0][1], b: S[1][1], x1, x2 };
    }
    default: throw new Error(`unknown kind ${kind}`);
  }
}
const EXPECTED_KINDS = NUMERIC.map(s => `GP-05:${s}`);

describe('GP-05 oracle: deck shape', () => {
  it('has the 8 planned cards in order with the right answer modes, one audit per numeric card, figure only on se-vs-features', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const cards = gp05(seedAt(i), lang);
      const at = `seed ${seedAt(i)} ${lang}`;
      if (cards.map(c => c.id).join() !== slugs.map(s => `GP-05-${s}`).join()) { fails.push(`${at}: ids ${cards.map(c => c.id)}`); continue; }
      for (const c of cards) {
        const slug = c.id.slice(6);
        const numeric = NUMERIC.includes(slug);
        if (numeric !== !!c.fields) fails.push(`${at} ${slug}: fields presence`);
        if (!numeric && !c.choice) fails.push(`${at} ${slug}: expected a choice card`);
        if (c.slots) fails.push(`${at} ${slug}: unexpected slots`);
        if (!!c.figure !== (slug === 'se-vs-features')) fails.push(`${at} ${slug}: figure presence`);
        if (!!c.audit !== numeric) fails.push(`${at} ${slug}: audit presence`);
        if (c.audit && c.audit.kind !== `GP-05:${slug}`) fails.push(`${at} ${slug}: audit kind ${c.audit.kind}`);
        if (c.choice && c.choice.options.length !== 4) fails.push(`${at} ${slug}: ${c.choice.options.length} options`);
        if (c.fields) c.fields.forEach((f, k) => { if (f.tolerance !== TOL) fails.push(`${at} ${slug} field ${k}: tolerance ${f.tolerance}`); });
      }
      if (pick(cards, 'challenge').fields!.length !== 2) fails.push(`${at}: challenge needs two fields`);
      for (const slug of ['kernel-value', 'poly-feature', 'gram-det']) if (pick(cards, slug).fields!.length !== 1) fails.push(`${at} ${slug}: needs one field`);
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
      if (kinds.join() !== [...EXPECTED_KINDS].sort().join()) fails.push(`${at}: audit kinds ${kinds}`);
    }
    report(fails);
  });
});

describe('GP-05 oracle: numeric answers by independent Gram-matrix computation', () => {
  for (const kind of EXPECTED_KINDS) {
    it(`${kind}: answers, grading, wrong routes, printed text, plan constraints (60 spread seeds x EN/ZH)`, () => {
      const fails: string[] = [];
      let fired = 0;
      const prompts = new Set<string>();
      for (let i = 0; i < SEEDS; i++) {
        for (const lang of ['en', 'zh'] as Lang[]) {
          const card = gp05(seedAt(i), lang).find(c => c.audit?.kind === kind);
          if (!card) { fails.push(`seed ${seedAt(i)} ${lang}: ${kind} did not fire`); continue; }
          fired++;
          if (lang === 'en') prompts.add(card.prompt);
          const where = `${kind} seed ${seedAt(i)} ${lang} ${JSON.stringify(card.audit!.params)}`;
          const params = card.audit!.params as P;
          let expected: number[];
          try { expected = oracle(kind, params); } catch (e) { fails.push(`${where}: oracle threw ${(e as Error).message}`); continue; }
          if (expected.length !== card.fields!.length) { fails.push(`${where}: ${card.fields!.length} fields, oracle ${expected.length}`); continue; }
          expected.forEach((v, k) => {
            const got = card.fields![k].answer;
            if (Math.abs(v - got) > 1e-9) fails.push(`${where} field ${k}: expected ${v}, got ${got}`);
          });
          // closed forms of the plan as a second route
          const q = params;
          const closed = kind === 'GP-05:kernel-value' ? [q.a + q.b * q.x1 * q.x2]
            : kind === 'GP-05:poly-feature' ? [q.a + q.b * q.x1 * q.x2 + q.c * q.x1 ** 2 * q.x2 ** 2]
            : kind === 'GP-05:gram-det' ? [q.a * q.b * (q.x1 - q.x2) ** 2]
            : [q.a + q.c * (q.x1 + q.x2) + q.b * q.x1 * q.x2, q.a + 2 * q.c * q.x1 + q.b * q.x1 ** 2];
          closed.forEach((v, k) => { if (Math.abs(v - expected[k]) > 1e-9) fails.push(`${where}: closed form ${v} != matrix route ${expected[k]}`); });
          // grading through gradeCard
          const grade = (vs: string[]) => gradeCard(card, vs, null, []);
          const frac = expected.map(toFraction), dec = expected.map(v => v.toFixed(2));
          if (grade(frac) !== 'correct') fails.push(`${where}: fractions ${frac} not graded correct`);
          if (grade(dec) !== 'correct') fails.push(`${where}: decimals ${dec} not graded correct`);
          expected.forEach((v, k) => {
            for (const d of [0.02, -0.02, 0.007, -0.007]) {
              const vals = [...frac]; vals[k] = (v + d).toFixed(4);
              if (grade(vals) !== 'incorrect') fails.push(`${where} field ${k}: perturbation ${d} graded ${grade(vals)}`);
            }
          });
          for (const wrong of wrongRoutes(kind, params)) {
            if (wrong.every((w, k) => Math.abs(w - expected[k]) < 0.02)) fails.push(`${where}: wrong route ${wrong} is within 0.02 of truth ${expected}`);
            else if (grade(wrong.map(w => w.toFixed(4))) === 'correct') fails.push(`${where}: wrong route ${wrong} graded correct`);
          }
          // printed text equals audit params
          try {
            const printed = printedParams(kind, card.prompt);
            for (const [name, v] of Object.entries(params)) if (printed[name] !== v) fails.push(`${where}: printed ${name}=${printed[name]} but audit ${v}`);
            for (const name of Object.keys(printed)) if (!(name in params)) fails.push(`${where}: printed ${name} missing from audit`);
          } catch (e) { fails.push(`${where}: ${(e as Error).message}`); }
          // plan constraints
          const bad = (m: string) => fails.push(`${where}: ${m}`);
          for (const [name, v] of Object.entries(params)) if (!Number.isInteger(v)) bad(`${name} is not an integer`);
          if (!(params.a > 0 && params.b > 0)) bad('a, b must be > 0');
          if (kind === 'GP-05:poly-feature' && !(params.c > 0)) bad('c must be > 0');
          if (kind === 'GP-05:gram-det' && (params.x1 === params.x2 || !(expected[0] > 0))) bad('x1 = x2 or det K not strictly positive');
          if (kind === 'GP-05:challenge' && !(params.a * params.b - params.c ** 2 > 0 && expected[1] > 0)) bad('Sigma_p not PD or k(x1,x1) not positive');
          // explanation states every answer; hint never gives it away as a bare fraction
          const expl = clean(card.explanation);
          frac.forEach((f, k) => { if (!expl.includes(f)) bad(`explanation does not contain ${f} (field ${k})`); });
        }
      }
      expect(fired).toBe(SEEDS * 2);
      if (prompts.size < 6) fails.push(`${kind}: only ${prompts.size} distinct EN prompts over ${SEEDS} seeds`);
      report(fails);
    });
  }

  it('EN and ZH decks carry identical audits, answers and answer indices', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const en = gp05(seedAt(i), 'en'), zh = gp05(seedAt(i), 'zh');
      en.forEach((c, k) => {
        if (JSON.stringify(c.audit) !== JSON.stringify(zh[k].audit)) fails.push(`${c.id} seed ${seedAt(i)}: audit differs between languages`);
        if (c.choice && c.choice.answer !== zh[k].choice!.answer) fails.push(`${c.id} seed ${seedAt(i)}: answer index differs between languages`);
        if (c.fields && JSON.stringify(c.fields.map(f => f.answer)) !== JSON.stringify(zh[k].fields!.map(f => f.answer))) fails.push(`${c.id} seed ${seedAt(i)}: answers differ`);
      });
    }
    report(fails);
  });
});

describe('GP-05 oracle: gram-rank (choice, printed K)', () => {
  it('printed K equals Phi Sigma_p Phi^T, is PSD and singular with rank 2; the correct option is "valid and singular, rank at most 2"', () => {
    const fails: string[] = [];
    const prompts = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const card = pick(gp05(seedAt(i), lang), 'gram-rank');
      const at = `seed ${seedAt(i)} ${lang}`;
      const t = clean(card.prompt);
      if (lang === 'en') prompts.add(card.prompt);
      const [S, Kp] = matrices(t);
      const xs = [grab(t, /x₁ = (-?\d+)/), grab(t, /x₂ = (-?\d+)/), grab(t, /x₃ = (-?\d+)/)];
      if (!S || !Kp) { fails.push(`${at}: matrices missing`); continue; }
      if (new Set(xs).size !== 3) fails.push(`${at}: inputs not distinct ${xs}`);
      if (S.length !== 2 || S[0][1] !== 0 || S[1][0] !== 0 || !(S[0][0] > 0 && S[1][1] > 0)) fails.push(`${at}: Sigma_p ${JSON.stringify(S)}`);
      const K = gram(diag(S[0][0], S[1][1]), xs);
      if (JSON.stringify(K) !== JSON.stringify(Kp)) fails.push(`${at}: printed K ${JSON.stringify(Kp)} != Phi Sigma Phi^T ${JSON.stringify(K)}`);
      if (Math.abs(detElim(K)) > 1e-9 || Math.abs(detCof(K)) > 1e-9) fails.push(`${at}: det K != 0`);
      if (leadingMinors(K).some(m => m < -1e-9)) fails.push(`${at}: K has a negative leading minor`);
      if (rankOf(K) !== 2) fails.push(`${at}: rank ${rankOf(K)}`);
      // the answer index must point at the option satisfying the plan's predicate: claims "valid" + "singular" + rank bound by features
      const en = clean(pick(gp05(seedAt(i), 'en'), 'gram-rank').choice!.options.join('\n'));
      void en;
      const enOpts = pick(gp05(seedAt(i), 'en'), 'gram-rank').choice!.options;
      const sat = (o: string) => /valid covariance matrix and is singular/.test(o) && /rank is at most 2/.test(o) && !/cannot|only because|only be defined/.test(o);
      const verdicts = enOpts.map(sat);
      if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} EN options satisfy the predicate`);
      else if (verdicts.indexOf(true) !== card.choice!.answer) fails.push(`${at}: answer index ${card.choice!.answer} != predicate option ${verdicts.indexOf(true)}`);
      if (lang === 'en') {
        const lens = card.choice!.options.map(o => o.length), cl = lens[card.choice!.answer];
        if (lens.every((l, k) => k === card.choice!.answer || l < cl)) fails.push(`${at}: correct option is the longest`);
      } else {
        const zhOpts = card.choice!.options;
        const zsat = (o: string) => /合法的协方差矩阵且奇异/.test(o) && /秩至多为 2/.test(o);
        const zv = zhOpts.map(zsat);
        if (zv.filter(Boolean).length !== 1 || zv.indexOf(true) !== card.choice!.answer) fails.push(`${at}: ZH predicate option ${zv.indexOf(true)} != answer ${card.choice!.answer}`);
      }
      // explanation prints the same Sigma and inputs
      const ex = clean(card.explanation);
      if (!ex.includes(`diag(${S[0][0]}, ${S[1][1]})`) || !ex.includes(`(${xs.join(', ')})`)) fails.push(`${at}: explanation does not restate Sigma_p / inputs`);
    }
    if (prompts.size < 6) fails.push(`gram-rank: only ${prompts.size} distinct prompts`);
    report(fails);
  });
});

describe('GP-05 oracle: concept choice cards', () => {
  const predicates: Record<string, { en: (o: string) => boolean; zh: (o: string) => boolean }> = {
    // GP definition: collection of random variables, ANY FINITE subset jointly Gaussian
    'gp-def': {
      en: o => /collection of random variables/.test(o) && /any finite subset/.test(o) && /joint Gaussian/.test(o) && !/infinite collection|squared exponential|finite-dimensional/.test(o),
      zh: o => /一组以输入空间为指标集的随机变量/.test(o) && /任意有限多个/.test(o),
    },
    // consistency: the smaller set is the marginal (leading block), unchanged
    consistency: {
      en: o => /marginal of the joint/.test(o) && /leading 2 × 2 block/.test(o) && /unchanged/.test(o),
      zh: o => /边缘分布/.test(o) && /左上角的 2 × 2 块/.test(o) && /不会改变/.test(o),
    },
    // finite features => rank <= d; SE has infinitely many
    'se-vs-features': {
      en: o => /linear kernel has finitely many features/.test(o) && /rank at most d, the number of features/.test(o) && /squared exponential has infinitely many/.test(o),
      zh: o => /线性核特征数目有限/.test(o) && /秩至多为特征数 d/.test(o) && /平方指数核有无穷多个特征/.test(o),
    },
  };
  for (const slug of CONCEPT) {
    it(`${slug}: exactly one option satisfies the plan predicate and the answer index points to it (EN and ZH); correct option is not the longest`, () => {
      const fails: string[] = [];
      for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
        const card = pick(gp05(seedAt(i), lang), slug);
        const at = `seed ${seedAt(i)} ${lang}`;
        const verdicts = card.choice!.options.map(predicates[slug][lang]);
        if (verdicts.filter(Boolean).length !== 1) fails.push(`${at}: ${verdicts.filter(Boolean).length} options satisfy the predicate`);
        else if (verdicts.indexOf(true) !== card.choice!.answer) fails.push(`${at}: answer index ${card.choice!.answer} != predicate option ${verdicts.indexOf(true)}`);
        if (lang === 'en') {
          const lens = card.choice!.options.map(o => o.length), cl = lens[card.choice!.answer];
          if (lens.every((l, k) => k === card.choice!.answer || l < cl)) fails.push(`${at}: correct option is the longest`);
        }
        if (new Set(card.choice!.options).size !== 4) fails.push(`${at}: duplicate options`);
      }
      report(fails);
    });
  }
  it('the concept cards are fixed content (identical prompt text across seeds) apart from the option order', () => {
    for (const slug of CONCEPT) {
      const prompts = new Set<string>();
      for (let i = 0; i < 10; i++) prompts.add(pick(gp05(seedAt(i), 'en'), slug).prompt);
      expect(prompts.size).toBe(1);
    }
  });
});

describe('GP-05 oracle: se-vs-features figure', () => {
  it('three straight lines f = w0 + w1 x over x in [-1, 1] at the plan coordinates, inside the view, no text/answer shapes', () => {
    const fails: string[] = [];
    const want: { tone: string; pts: number[][] }[] = [
      { tone: 'accent', pts: [[-1, -1], [1, 1]] }, { tone: 'muted', pts: [[-1, 0.5], [1, -0.5]] }, { tone: 'warn', pts: [[-1, 0.3], [1, 0.7]] },
    ];
    for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) {
      const card = pick(gp05(seedAt(i), lang), 'se-vs-features');
      const at = `seed ${seedAt(i)} ${lang}`;
      const fig = card.figure as Figure;
      const sh = fig.shapes;
      if (sh.length !== 3) { fails.push(`${at}: ${sh.length} shapes`); continue; }
      sh.forEach((s, k) => {
        if (s.kind !== 'line') { fails.push(`${at}: shape ${k} is ${s.kind}`); return; }
        const L = s as Extract<FigureShape, { kind: 'line' }>;
        if (L.points.length !== 2) fails.push(`${at}: line ${k} has ${L.points.length} points (not a straight 2-point segment)`);
        if (L.tone !== want[k].tone) fails.push(`${at}: line ${k} tone ${L.tone}`);
        if (L.dash) fails.push(`${at}: line ${k} dashed`);
        want[k].pts.forEach((q, j) => { if (!L.points[j] || Math.abs(L.points[j][0] - q[0]) > 1e-9 || Math.abs(L.points[j][1] - q[1]) > 1e-9) fails.push(`${at}: line ${k} point ${j} ${JSON.stringify(L.points[j])} != ${q}`); });
        // each line is f = w0 + w1 x: both endpoints lie on one line through the segment (trivial) and x spans -1..1 as printed in the alt text
        if (L.points[0][0] !== -1 || L.points[1][0] !== 1) fails.push(`${at}: line ${k} does not span x from -1 to 1`);
      });
      const inView = (q: readonly [number, number]) => q[0] >= fig.view.xmin - 1e-9 && q[0] <= fig.view.xmax + 1e-9 && q[1] >= fig.view.ymin - 1e-9 && q[1] <= fig.view.ymax + 1e-9;
      for (const s of sh) if (s.kind === 'line' && !s.points.every(inView)) fails.push(`${at}: a line leaves the view`);
      const alt = clean(fig.alt);
      if (lang === 'en' && !/from -1 to 1/.test(alt)) fails.push(`${at}: alt does not state x from -1 to 1`);
      if (lang === 'zh' && !/从 -1 到 1/.test(alt)) fails.push(`${at}: zh alt does not state x from -1 to 1`);
      // the figure must not give away the answer: no labels on shapes and no kernel names in alt/caption
      if (/squared exponential|平方指数|infinite|无穷|rank|秩/i.test(`${fig.alt} ${fig.caption ?? ''}`)) fails.push(`${at}: figure text states the answer`);
      if (fig.aspect !== 'free' || fig.axes?.xLabel !== 'x' || fig.axes?.yLabel !== 'f') fails.push(`${at}: axes/aspect wrong`);
    }
    report(fails);
  });
});
