import { describe, expect, it } from 'vitest';
import { gp11 } from './games/gp11';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-11 (cost of exact GP regression).
 * Cost model (GPML pdf p. 37 and p. 220): Cholesky of n x n is n^3/6; each triangular solve is n^2/2.
 * Route 2 below is a counted simulation of a naive Cholesky loop and substitution loops.
 */
const SEEDS = 60;
const WIDE = 4000;
const ID = 'GP-11';
const slugs = ['chol-count', 'solve-count', 'memory-size', 'extrapolate', 'break-even', 'profile-check', 'mean-only', 'challenge'];
const deck = (i: number, lang: GameLanguage) => gp11(spreadSeed(i), lang);
const byId = (cards: PracticeCard[], slug: string) => cards.find(c => c.id === `${ID}-${slug}`)!;
const LANGS: GameLanguage[] = ['en', 'zh'];

// ---- independent counting routes -------------------------------------------------
/** naive Cholesky on an SPD matrix, counting multiply-adds (inner products) and square roots/divisions separately. */
function choleskyLoopCount(n: number): number {
  let ops = 0;
  // matrix: A = M Mt + n I, only the sparsity pattern of the loops matters but we run the real factorisation to be honest
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? n + 1 : 1 / (1 + Math.abs(i - j)))));
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let s = A[j][j];
    for (let k = 0; k < j; k++) { s -= L[j][k] * L[j][k]; ops++; }
    L[j][j] = Math.sqrt(s);
    for (let i = j + 1; i < n; i++) {
      let t = A[i][j];
      for (let k = 0; k < j; k++) { t -= L[i][k] * L[j][k]; ops++; }
      L[i][j] = t / L[j][j];
    }
  }
  return ops;
}
function substitutionLoopCount(n: number): number {
  let ops = 0;
  for (let i = 0; i < n; i++) for (let k = 0; k < i; k++) ops++;
  return ops;
}
const choleskyOps = (n: number) => n ** 3 / 6;
const solveOps = (n: number) => n ** 2 / 2;

describe('route 2: the closed forms are the leading terms of counted loops', () => {
  it('Cholesky loop count tends to n^3/6 and substitution loop to n^2/2', () => {
    for (const n of [12, 18, 24, 30, 36, 48, 60, 96]) {
      const c = choleskyLoopCount(n);
      expect(c / choleskyOps(n)).toBeGreaterThan(0.98);
      expect(c).toBeLessThanOrEqual(choleskyOps(n));
      const s = substitutionLoopCount(n);
      expect(s).toBe(n * (n - 1) / 2);
      expect(s / solveOps(n)).toBeGreaterThan(0.9);
    }
    expect(choleskyLoopCount(96) / choleskyOps(96)).toBeGreaterThan(0.99);
    expect(choleskyLoopCount(12)).toBe(286);
  });
});

// ---- number extraction from visible text ---------------------------------------
const nums = (text: string) => [...text.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
function paramFrom(text: string, symbol: string): number {
  const m = text.match(new RegExp(`${symbol} = (\\d+(?:\\.\\d+)?)`));
  if (!m) throw new Error(`no "${symbol} = " in ${text}`);
  return Number(m[1]);
}

// ---- per-kind oracles ------------------------------------------------------------
type Truth = { answer: number; wrongRoutes: number[]; check: (p: Record<string, number>, text: string) => void };
const closeTo = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const truths: Record<string, (p: Record<string, number>) => Truth> = {
  'GP-11:chol-count': p => ({ answer: p.n ** 3 / 6, wrongRoutes: [p.n ** 3, p.n ** 3 / 3, p.n ** 3 / 2, p.n ** 2, p.n ** 2 / 2, p.n ** 3 / 12, p.n ** 2 / 6], check: () => {} }),
  'GP-11:solve-count': p => ({ answer: 2 * solveOps(p.n), wrongRoutes: [p.n ** 2 / 2, p.n ** 2 / 4, 2 * p.n ** 2, p.n ** 3 / 6, p.n ** 3], check: () => {} }),
  'GP-11:memory-size': p => ({ answer: 8 * p.n * p.n / 1e6, wrongRoutes: [8 * p.n / 1e6, p.n ** 2 / 1e6, 8 * p.n ** 3 / 1e6, 4 * p.n * (p.n + 1) / 1e6, 8 * p.n ** 2 / 1e3], check: () => {} }),
  'GP-11:extrapolate': p => {
    const kappa = p.t1 / p.n1 ** 3; // fit t = kappa n^3 through (n1, t1)
    const c = p.n2 / p.n1;
    return { answer: kappa * p.n2 ** 3, wrongRoutes: [p.t1 * c, p.t1 * c * c, p.t1 * c ** 4, p.t1 + c ** 3], check: () => {} };
  },
  'GP-11:break-even': p => {
    // root of m n^2/2 - n^3/6 = 0 by bisection on the cost difference, then verify
    let lo = 0, hi = p.n * 4;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (mid * solveOps(p.n) < choleskyOps(p.n)) lo = mid; else hi = mid; }
    return { answer: (lo + hi) / 2, wrongRoutes: [p.n / 6, p.n / 2, 2 * p.n / 3, p.n, 2 * p.n], check: () => {} };
  },
  'GP-11:challenge': p => {
    // step list sum
    const steps: number[] = [choleskyOps(p.n), solveOps(p.n), solveOps(p.n)];
    for (let i = 0; i < p.m; i++) steps.push(solveOps(p.n));
    const total = steps.reduce((a, b) => a + b, 0);
    const n = p.n, m = p.m;
    return {
      answer: total,
      wrongRoutes: [
        n ** 3 / 6 + (m + 1) * n ** 2 / 2, n ** 3 / 6 + (m + 2) * n ** 2, m * n ** 3 / 6 + (m + 2) * n ** 2 / 2,
        (m + 2) * n ** 2 / 2, n ** 3 / 6 + n ** 2, n ** 3 / 6 + m * n ** 2 / 2, n ** 3 / 6,
      ],
      check: () => {},
    };
  },
};
const PARAM_KEYS: Record<string, string[]> = {
  'GP-11:chol-count': ['n'], 'GP-11:solve-count': ['n'], 'GP-11:memory-size': ['n'],
  'GP-11:extrapolate': ['n1', 'n2', 't1'], 'GP-11:break-even': ['n'], 'GP-11:challenge': ['n', 'm'],
};
const KIND_OF: Record<string, string> = {
  'chol-count': 'GP-11:chol-count', 'solve-count': 'GP-11:solve-count', 'memory-size': 'GP-11:memory-size',
  'extrapolate': 'GP-11:extrapolate', 'break-even': 'GP-11:break-even', 'challenge': 'GP-11:challenge',
};

/** Numbers as printed in the visible prompt, by card. */
function printedParams(slug: string, prompt: string): Record<string, number> {
  switch (slug) {
    case 'chol-count': case 'solve-count': {
      const m = prompt.match(/(\d+) × (\d+)/)!;
      expect(m[1]).toBe(m[2]);
      return { n: Number(m[1]) };
    }
    case 'memory-size': case 'break-even': return { n: paramFrom(prompt, 'n') };
    case 'extrapolate': return { n1: paramFrom(prompt, 'n₁'), n2: paramFrom(prompt, 'n₂'), t1: paramFrom(prompt, 't₁') };
    case 'challenge': return { n: paramFrom(prompt, 'n'), m: paramFrom(prompt, 'm') };
  }
  throw new Error(slug);
}

describe('GP-11 deck shape', () => {
  it('has 8 cards with the planned ids in order, answer modes, and no figures', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = deck(i, lang);
      expect(cards.map(c => c.id)).toEqual(slugs.map(s => `${ID}-${s}`));
      for (const c of cards) {
        expect(c.figure).toBeUndefined();
        expect(c.choice?.figures).toBeUndefined();
        expect(c.slots).toBeUndefined();
      }
      for (const s of ['profile-check', 'mean-only']) { expect(byId(cards, s).choice!.options).toHaveLength(4); expect(byId(cards, s).audit).toBeUndefined(); expect(byId(cards, s).fields).toBeUndefined(); }
      for (const s of Object.keys(KIND_OF)) { const c = byId(cards, s); expect(c.fields).toHaveLength(1); expect(c.fields![0].tolerance).toBe(0.006); expect(c.choice).toBeUndefined(); }
    }
  });
});

describe('numeric audit kinds: independent recomputation, grading, printed text', () => {
  for (const [slug, kind] of Object.entries(KIND_OF)) {
    it(`${kind}: ${SEEDS} spread seeds, EN and ZH`, () => {
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const card = byId(deck(i, lang), slug);
        const where = `${kind} seed#${i} ${lang}`;
        expect(card.audit?.kind, where).toBe(kind);
        const params = card.audit!.params as Record<string, number>;
        expect(Object.keys(params).sort(), where).toEqual([...PARAM_KEYS[kind]].sort());
        const truth = truths[kind](params);
        // answer
        expect(Math.abs(truth.answer - card.fields![0].answer), `${where} oracle ${truth.answer} vs ${card.fields![0].answer}`).toBeLessThanOrEqual(1e-9);
        // grading: accepted answer correct (several spellings), perturbed answer wrong
        const a = truth.answer;
        for (const s of [String(a), a.toFixed(2), a.toFixed(3), String(a + 0.005), String(a - 0.005)]) expect(gradeCard(card, [s], null, []), `${where} accepts ${s}`).toBe('correct');
        for (const s of [String(a + 0.02), String(a - 0.02), String(a + 1), String(a * 2)]) expect(gradeCard(card, [s], null, []), `${where} rejects ${s}`).toBe('incorrect');
        // every wrong route is a defect if it collides
        truth.wrongRoutes.forEach((w, k) => {
          expect(Math.abs(w - a), `${where} wrong route #${k}=${w} collides with truth ${a}`).toBeGreaterThanOrEqual(0.02);
          expect(gradeCard(card, [String(w)], null, []), `${where} wrong route #${k}`).toBe('incorrect');
        });
        // printed text = audit params
        const printed = printedParams(slug, card.prompt);
        for (const [k, v] of Object.entries(printed)) expect(params[k], `${where} printed ${k}`).toBe(v);
        if (kind === 'GP-11:extrapolate') expect(closeTo(params.n2 / params.n1, Math.round(params.n2 / params.n1))).toBe(true);
        fired++;
      }
      expect(fired).toBe(SEEDS * 2);
    });
  }
  it('answers have the planned closed forms on the worked examples', () => {
    const ex = (s: string, p: Record<string, number>) => truths[KIND_OF[s]](p).answer;
    expect(ex('chol-count', { n: 12 })).toBe(288);
    expect(ex('chol-count', { n: 30 })).toBe(4500);
    expect(ex('solve-count', { n: 10 })).toBe(100);
    expect(ex('solve-count', { n: 40 })).toBe(1600);
    expect(ex('memory-size', { n: 1000 })).toBe(8);
    expect(ex('memory-size', { n: 5000 })).toBe(200);
    expect(ex('extrapolate', { n1: 100, n2: 300, t1: 2 })).toBeCloseTo(54, 9);
    expect(ex('extrapolate', { n1: 500, n2: 1000, t1: 0.5 })).toBeCloseTo(4, 9);
    expect(ex('break-even', { n: 12 })).toBeCloseTo(4, 9);
    expect(ex('break-even', { n: 60 })).toBeCloseTo(20, 9);
    expect(ex('challenge', { n: 12, m: 5 })).toBe(792);
    expect(ex('challenge', { n: 24, m: 3 })).toBe(3744);
  });
  it('no unknown audit kinds and no unaudited numeric card', () => {
    const seen = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const c of deck(i, 'en')) { if (c.audit) seen.add(c.audit.kind); if (c.fields) expect(c.audit, c.id).toBeDefined(); }
    expect([...seen].sort()).toEqual(Object.values(KIND_OF).sort());
  });
});

describe('sampling spaces equal the plan exactly', () => {
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);
  it('numeric card spaces', () => {
    const space: Record<string, Set<string>> = {};
    for (let i = 0; i < WIDE; i++) {
      const cards = gp11(spreadSeed(i), 'en');
      for (const s of Object.keys(KIND_OF)) (space[s] ??= new Set()).add(JSON.stringify(byId(cards, s).audit!.params));
    }
    const key = (o: Record<string, number>) => JSON.stringify(o);
    const set = (list: Record<string, number>[]) => new Set(list.map(key));
    const only = (key1: string, vals: number[]) => set(vals.map(v => ({ [key1]: v })));
    expect(space['chol-count']).toEqual(only('n', [12, 18, 24, 30, 36, 48, 60]));
    expect(space['solve-count']).toEqual(only('n', [10, 12, 14, 16, 20, 30, 40, 50]));
    expect(space['memory-size']).toEqual(only('n', [500, 1000, 2000, 2500, 5000, 10000, 20000]));
    expect(space['break-even']).toEqual(only('n', [12, 18, 24, 30, 36, 48, 60]));
    const ext: Record<string, number>[] = [];
    for (const c of [2, 3, 4, 5]) for (const n1 of [100, 200, 500, 1000]) for (const t1 of [0.5, 1, 2, 3]) ext.push({ n1, n2: c * n1, t1 });
    // JSON key order: compare as normalised objects
    const norm = (s: Set<string>) => new Set([...s].map(x => { const o = JSON.parse(x); return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]))); }));
    const normList = (l: Record<string, number>[]) => new Set(l.map(o => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])))));
    expect(norm(space['extrapolate'])).toEqual(normList(ext));
    expect(ext).toHaveLength(64);
    const ch: Record<string, number>[] = [];
    for (const n of [6, 12, 18, 24, 30]) for (const m of [2, 3, 4, 5, 10]) ch.push({ n, m });
    expect(norm(space['challenge'])).toEqual(normList(ch));
  });
  it('choice card spaces (profile-check a,b pairs; mean-only n,m) read from the printed text', () => {
    const pairs = new Set<string>(), nm = new Set<string>();
    for (let i = 0; i < WIDE; i++) {
      const cards = gp11(spreadSeed(i), 'en');
      const pc = byId(cards, 'profile-check').prompt;
      const [a, b, r] = [...pc.matchAll(/(\d+) %/g)].map(m => Number(m[1]));
      pairs.add(`${a},${b}`);
      expect(a + b + r).toBe(100);
      const mo = byId(cards, 'mean-only').prompt;
      nm.add(`${paramFrom(mo, 'n')},${paramFrom(mo, 'm')}`);
    }
    expect([...pairs].sort()).toEqual(['50,30', '50,35', '55,25', '55,30', '55,35', '60,25', '60,30', '60,35', '65,25', '65,30', '70,25'].sort());
    const want: string[] = [];
    for (const n of [12, 18, 24, 30, 36]) for (const m of [2, 3, 4, 5, 10]) want.push(`${n},${m}`);
    expect([...nm].sort()).toEqual(want.sort());
  });
  it('sampled values are sorted lists (sanity of helper)', () => { expect(sorted(new Set([3, 1, 2]))).toEqual([1, 2, 3]); });
});

describe('choice cards', () => {
  it('profile-check: exactly one option satisfies the predicate, answer points at it, constraints hold, others are false', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(i, lang), 'profile-check');
      const where = `profile-check seed#${i} ${lang}`;
      const [a, b, r] = [...card.prompt.matchAll(/(\d+) %/g)].map(m => Number(m[1]));
      expect(a + b + r, where).toBe(100);
      expect(a, where).toBeGreaterThan(b + 10 - 1e-9);
      expect(b, where).toBeGreaterThan(r);
      expect(r, where).toBeGreaterThanOrEqual(4);
      const opts = card.choice!.options;
      // correct: says the claim is false, because of constant factors, and that K takes more time than the Cholesky step
      const pred = lang === 'en'
        ? (t: string) => /^False/.test(t) && /constant factors/.test(t) && /building K takes more time than the Cholesky step/.test(t) && !/ignored/.test(t)
        : (t: string) => /不成立/.test(t) && !/^成立/.test(t) && /常数因子/.test(t) && /构造 K 比 Cholesky 步骤更耗时/.test(t);
      const hits = opts.map(pred);
      expect(hits.filter(Boolean).length, `${where} ${JSON.stringify(opts)}`).toBe(1);
      expect(hits[card.choice!.answer], where).toBe(true);
      // wrong options: each is false for its stated reason
      const wrong = opts.filter((_, k) => k !== card.choice!.answer);
      const hasTrust = wrong.filter(t => lang === 'en' ? /^True/.test(t) : /^成立/.test(t));
      expect(hasTrust, where).toHaveLength(1); // claim true although a > b
      const hasOn2 = wrong.filter(t => lang === 'en' ? /only O\(n²\)/.test(t) : /只是 O\(n²\)/.test(t));
      expect(hasOn2, where).toHaveLength(1);
      const hasIgnore = wrong.filter(t => lang === 'en' ? new RegExp(`${b} %`).test(t) && /ignored/.test(t) : new RegExp(`${b} %`).test(t) && /忽略/.test(t));
      expect(hasIgnore, where).toHaveLength(1);
      // correct is not the longest (EN length contract)
      if (lang === 'en') expect(Math.max(...opts.map(t => t.length)), where).toBeGreaterThan(opts[card.choice!.answer].length);
    }
  });
  it('mean-only: the option whose value is m·n is correct; the other three are m·n²/2, m·n³/6, n³/6 + m·n', () => {
    const answerPositions = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = byId(deck(i, lang), 'mean-only');
      const where = `mean-only seed#${i} ${lang}`;
      const n = paramFrom(card.prompt, 'n'), m = paramFrom(card.prompt, 'm');
      const value = (t: string) => Number((t.match(/^([\d,]+)/)?.[1] ?? 'NaN').replaceAll(',', ''));
      const vals = card.choice!.options.map(value);
      const want = [m * n, m * n * n / 2, m * n ** 3 / 6, n ** 3 / 6 + m * n];
      expect([...vals].sort((x, y) => x - y), where).toEqual([...want].sort((x, y) => x - y));
      expect(new Set(vals).size, where).toBe(4);
      expect(vals[card.choice!.answer], where).toBe(m * n);
      // reasons: correct one is the dot product
      const correctText = card.choice!.options[card.choice!.answer];
      expect(/dot product/.test(correctText) || /点积/.test(correctText), where).toBe(true);
      // reason matches value for each option
      card.choice!.options.forEach((t, k) => {
        const v = vals[k];
        if (v === m * n ** 2 / 2) expect(lang === 'en' ? /triangular solve/.test(t) : /三角求解/.test(t), `${where} ${t}`).toBe(true);
        if (v === m * n ** 3 / 6) expect(lang === 'en' ? /repeated for every/.test(t) : /每个测试输入都要重新/.test(t), `${where} ${t}`).toBe(true);
      });
      if (lang === 'en') expect(Math.max(...card.choice!.options.map(t => t.length)), where).toBeGreaterThan(correctText.length);
      answerPositions.add(card.choice!.answer);
    }
    expect(answerPositions.size).toBeGreaterThan(1); // options are shuffled
  });
});

describe('typography and notation of learner-visible text', () => {
  it('Unicode symbols only; no ASCII names, hyphen minus, double parentheses, raw floats, caret', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) {
      const texts = [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];
      for (const t of texts) {
        const where = `${c.id} ${lang}: ${t.slice(0, 90)}`;
        expect(t, where).not.toMatch(/\^/);
        expect(t, where).not.toMatch(/\b(?:n1|n2|t1|t2|alpha|mu|sigma|n_1|t_1)\b/);
        expect(t, where).not.toMatch(/(?:^|[\s(,=])-\d/); // ASCII hyphen as minus
        expect(t, where).not.toMatch(/\(\(/);
        expect(t, where).not.toMatch(/\d\.\d{4,}/);
        expect(t, where).not.toMatch(/undefined|NaN|\{|\}|Infinity/);
        expect(t, where).not.toMatch(/[a-zA-Z]+\d/);
        if (lang === 'zh') {
          const stripped = t.replace(/GPML|GP|Cholesky|O\(n[²³]\)|MB|Lecture|pdf|KL|ELBO/g, '');
          expect(stripped.replace(/[A-Za-z]{3,}/g, m => `<<${m}>>`), where).not.toMatch(/<<.+?>>/);
        }
      }
    }
  });
  it('the planned symbols appear in the planned cards', () => {
    const c = byId(deck(3, 'en'), 'extrapolate');
    expect(c.prompt).toContain('n₁'); expect(c.prompt).toContain('t₁'); expect(c.prompt).toContain('n₂');
    expect(byId(deck(3, 'en'), 'mean-only').prompt).toContain('k*ᵀα');
    expect(byId(deck(3, 'en'), 'mean-only').prompt).toContain('C⁻¹');
    expect(byId(deck(3, 'en'), 'solve-count').prompt).toContain('Lᵀ');
  });
});

describe('explanations and hints', () => {
  it('numeric explanations state the answer; hints do not contain it as a bare number equal to the answer', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const cards = deck(i, lang);
      for (const slug of Object.keys(KIND_OF)) {
        const c = byId(cards, slug), ans = c.fields![0].answer;
        const explNums = nums(c.explanation.replaceAll(',', ''));
        expect(explNums.some(x => Math.abs(x - ans) < 1e-9), `${c.id} ${lang} explanation lacks ${ans}: ${c.explanation}`).toBe(true);
        const hintNums = nums(c.hint);
        expect(hintNums.some(x => Math.abs(x - ans) < 1e-9 && x > 1), `${c.id} hint leaks ${ans}`).toBe(false);
      }
      for (const slug of ['profile-check', 'mean-only']) {
        const c = byId(cards, slug);
        expect(c.hint).not.toBe(c.explanation);
      }
      // question text shows every audit param (non-hidden inputs)
      for (const slug of Object.keys(KIND_OF)) {
        const c = byId(cards, slug);
        const visible = new Set(questionTextOf(c).flatMap(t => nums(t.replaceAll(',', ''))));
        for (const [k, v] of Object.entries(c.audit!.params)) expect(visible.has(v as number), `${c.id} ${k}`).toBe(true);
      }
    }
  });
});

describe('variety', () => {
  it('each card has at least 6 distinct prompts over 60 seeds', () => {
    for (const lang of LANGS) {
      const prompts: Record<string, Set<string>> = {};
      for (let i = 0; i < SEEDS; i++) for (const c of deck(i, lang)) (prompts[c.id] ??= new Set()).add(c.prompt);
      for (const slug of slugs) expect(prompts[`${ID}-${slug}`].size, `${slug} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('deterministic, and EN and ZH decks share answers', () => {
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(deck(i, 'en'))).toBe(JSON.stringify(deck(i, 'en')));
      const en = deck(i, 'en'), zh = deck(i, 'zh');
      en.forEach((c, k) => { expect(zh[k].fields?.map(f => f.answer)).toEqual(c.fields?.map(f => f.answer)); expect(zh[k].choice?.answer).toBe(c.choice?.answer); });
    }
  });
});
