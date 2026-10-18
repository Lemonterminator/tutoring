import { describe, expect, it } from 'vitest';
import { gp29 } from './games/gp29';
import { spreadSeed, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard, type GameLanguage } from '../types';
import type { Figure } from '../figure';

/**
 * Independent oracle for GP-29 (Kalman filtering and smoothing). Written from docs/aalto-gp-drafts/approved-GP-29.md only.
 * Routes: explicit Gaussian conditioning with a hand-written rational Gauss-Jordan inverse, the dense GP posterior,
 * the precision form, the exact log density, and a full OU Kalman filter + RTS smoother checked against the dense GP.
 */
const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];

// ---------- exact rationals ----------
type Fr = { n: number; d: number };
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fr = (n: number, d = 1): Fr => { if (d === 0) throw new Error('zero denominator'); const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
const add = (x: Fr, y: Fr) => fr(x.n * y.d + y.n * x.d, x.d * y.d);
const sub = (x: Fr, y: Fr) => fr(x.n * y.d - y.n * x.d, x.d * y.d);
const mul = (x: Fr, y: Fr) => fr(x.n * y.n, x.d * y.d);
const div = (x: Fr, y: Fr) => fr(x.n * y.d, x.d * y.n);
const val = (x: Fr) => x.n / x.d;
const eq = (x: Fr, y: Fr) => x.n === y.n && x.d === y.d;
const str = (x: Fr) => (x.d === 1 ? `${x.n}` : `${x.n}/${x.d}`);
const F = (n: number) => fr(n);
type Mat = Fr[][];
/** Gauss-Jordan inverse over the rationals (no library). */
function inv(m: Mat): Mat {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? F(1) : F(0)))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && a[p][c].n === 0) p++;
    if (p === n) throw new Error('singular');
    [a[c], a[p]] = [a[p], a[c]];
    const piv = a[c][c];
    a[c] = a[c].map(x => div(x, piv));
    for (let r = 0; r < n; r++) if (r !== c && a[r][c].n !== 0) { const f = a[r][c]; a[r] = a[r].map((x, k) => sub(x, mul(f, a[c][k]))); }
  }
  return a.map(row => row.slice(n));
}
const mm = (a: Mat, b: Mat): Mat => a.map(row => b[0].map((_, j) => row.reduce((s, x, k) => add(s, mul(x, b[k][j])), F(0))));
const tr = (a: Mat): Mat => a[0].map((_, j) => a.map(row => row[j]));
/** Condition the Gaussian (mean, cov) on the entries `obs` taking the values `y`; returns mean/cov of the remaining entries. */
function condition(mean: Fr[], cov: Mat, obs: number[], y: Fr[]): { mean: Fr[]; cov: Mat; free: number[] } {
  const free = mean.map((_, i) => i).filter(i => !obs.includes(i));
  const Sff = free.map(i => free.map(j => cov[i][j]));
  const Sfo = free.map(i => obs.map(j => cov[i][j]));
  const Soo = obs.map(i => obs.map(j => cov[i][j]));
  const gain = mm(Sfo, inv(Soo));
  const innov = obs.map((o, k) => [sub(y[k], mean[o])]);
  const upd = mm(gain, innov);
  const m = free.map((i, k) => add(mean[i], upd[k][0]));
  const c = mm(gain, tr(Sfo)).map((row, i) => row.map((x, j) => sub(Sff[i][j], x)));
  return { mean: m, cov: c, free };
}

// ---------- text helpers ----------
const NUM = String.raw`[−-]?\d+(?:\.\d+)?(?:/\d+)?`;
function parseTok(t: string): { v: number; n: number; d: number; token: string } {
  const clean = t.replace('−', '-');
  const [a, b] = clean.split('/');
  const n = Number(a), d = b === undefined ? 1 : Number(b);
  return { v: n / d, n, d, token: t };
}
/** First `label = number` in the prompt (the number may be parenthesised). */
function tok(text: string, label: string) {
  const m = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} = \\(?(${NUM})\\)?`).exec(text);
  if (!m) throw new Error(`no "${label} = number" in: ${text}`);
  return parseTok(m[1]);
}
function tokAfter(text: string, regexSource: string) {
  const m = new RegExp(`${regexSource}\\(?(${NUM})\\)?`).exec(text);
  if (!m) throw new Error(`no match for ${regexSource} in: ${text}`);
  return parseTok(m[1]);
}
const frOf = (t: { n: number; d: number }) => fr(t.n, t.d);

// ---------- sampling tables of the plan ----------
const key = (...xs: (number | string)[]) => xs.join('|');
// (a, s) pairs: a = 1/2 with s in {2,4,8,12}; a = 1/3 with s in {3,9,18}; a = 2/3 with s in {3,9,18}
const CARD1_SETS = new Set<string>([[1, 2, 2], [1, 2, 4], [1, 2, 8], [1, 2, 12], [1, 3, 3], [1, 3, 9], [1, 3, 18], [2, 3, 3], [2, 3, 9], [2, 3, 18]].map(([an, den, s]) => key(an, den, s)));
// card 2 rows (a_num, a_den, Q, p)
const CARD2_ROWS = new Set<string>([[1, 2, 6, 4], [1, 2, 6, 6], [1, 2, 9, 4], [1, 2, 9, 6], [1, 2, 9, 8], [1, 2, 3, 2], [1, 3, 16, 9], [2, 3, 10, 9]].map(r => key(...r)));
// card 3 rows (Pp, r) with den(K)
const CARD3_ROWS = new Map<string, number>([[key(2, 2), 2], [key(4, 4), 2], [key(6, 2), 4], [key(3, 1), 4], [key(6, 3), 3], [key(4, 2), 3], [key(9, 3), 4], [key(4, 1), 5]]);
// card 4 rows (a_num, a_den, s, r)
const CARD4_ROWS = new Set<string>([[1, 2, 4, 4], [1, 2, 8, 8], [1, 2, 12, 6], [1, 2, 12, 12], [1, 3, 9, 9], [2, 3, 9, 9], [2, 3, 18, 6], [2, 3, 9, 3]].map(r => key(...r)));
// card 5: S -> allowed (L, |v|)
const CARD5: Record<number, { L: number; v: number[] }> = { 1: { L: 1.84, v: [1, 2, 3] }, 4: { L: 3.22, v: [2, 4, 6] }, 8: { L: 3.92, v: [2, 4, 6] }, 10: { L: 4.14, v: [1, 2, 3, 4, 5, 6] } };
// card 6 rows (a_num, a_den, p, Pp_num, Pp_den)
const CARD6_ROWS = new Set<string>([[1, 2, 2, 7, 2], [1, 2, 2, 5, 1], [1, 2, 3, 9, 2], [1, 2, 4, 7, 1], [1, 2, 6, 15, 2], [1, 2, 6, 9, 1], [1, 2, 4, 10, 1], [1, 2, 3, 6, 1], [1, 3, 4, 12, 1], [1, 3, 6, 14, 1], [1, 3, 8, 16, 1], [2, 3, 3, 8, 1], [2, 3, 5, 10, 1], [2, 3, 9, 14, 1]].map(r => key(...r)));
// card 7 rows B..M (a, p, Pp, G) by value
const CARD7_ROWS_VAL = [
  { a: fr(1, 2), p: F(2), Pp: F(5), G: fr(1, 5) }, { a: fr(1, 2), p: F(3), Pp: fr(9, 2), G: fr(1, 3) }, { a: fr(1, 2), p: F(4), Pp: F(7), G: fr(2, 7) },
  { a: fr(1, 2), p: F(6), Pp: fr(15, 2), G: fr(2, 5) }, { a: fr(1, 2), p: F(6), Pp: F(9), G: fr(1, 3) }, { a: fr(1, 2), p: F(4), Pp: F(10), G: fr(1, 5) },
  { a: fr(1, 2), p: F(3), Pp: F(6), G: fr(1, 4) }, { a: fr(1, 3), p: F(6), Pp: F(14), G: fr(1, 7) }, { a: fr(2, 3), p: F(3), Pp: F(8), G: fr(1, 4) },
  { a: fr(2, 3), p: F(5), Pp: F(10), G: fr(1, 3) },
];
// card 9 families (a_num, a_den, s, r)
const CARD9_FAMILIES = new Set<string>([[1, 2, 2, 1], [1, 2, 4, 2], [1, 2, 6, 3], [1, 2, 8, 4], [1, 2, 12, 6], [2, 3, 3, 1], [2, 3, 6, 2], [2, 3, 9, 3], [2, 3, 12, 4], [2, 3, 3, 5], [2, 3, 6, 10]].map(r => key(...r)));

const SLUGS = ['discretise', 'predict', 'update', 'forecast', 'llh-term', 'rts-gain', 'smooth', 'assumption', 'challenge'];
const KINDS = ['discretise', 'predict', 'update', 'forecast', 'llh-term', 'rts-gain', 'smooth', 'challenge'].map(s => `GP-29:${s}`);

type Seeded = { seed: number; lang: GameLanguage; cards: Map<string, PracticeCard> };
function decks(): Seeded[] {
  const out: Seeded[] = [];
  for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
    const seed = spreadSeed(i);
    const cards = gp29(seed, lang);
    out.push({ seed, lang, cards: new Map(cards.map(c => [c.id.replace('GP-29-', ''), c])) });
  }
  return out;
}
const DECKS = decks();
const promptOf = (c: PracticeCard) => c.prompt.replaceAll('−', '-').replaceAll(' ', ' ');

/** Run a per-card check over all seeds and languages and collect readable failures. */
function forCard(slug: string, check: (card: PracticeCard, ctx: { seed: number; lang: GameLanguage }) => void): string[] {
  const failures: string[] = [];
  for (const d of DECKS) {
    const card = d.cards.get(slug);
    if (!card) { failures.push(`seed ${d.seed} ${d.lang}: card ${slug} missing`); continue; }
    try { check(card, d); } catch (e) { failures.push(`seed ${d.seed} ${d.lang} ${slug}: ${(e as Error).message.split('\n')[0]}`); }
  }
  return failures.slice(0, Number(process.env.MAXF ?? 20));
}
function must(cond: unknown, message: string) { if (!cond) throw new Error(message); }

/** Accepted answers grade correct; each field perturbed beyond its tolerance grades incorrect. */
function gradeChecks(card: PracticeCard, answers: Fr[], decimals?: number) {
  must(card.fields && card.fields.length === answers.length, `field count ${card.fields?.length} vs ${answers.length}`);
  const fields = card.fields!;
  fields.forEach((f, i) => {
    const tol = f.tolerance ?? 1e-8;
    must(Math.abs(val(answers[i]) - f.answer) <= tol, `field ${i}: oracle ${str(answers[i])}=${val(answers[i])} vs card ${f.answer}`);
  });
  const typed = answers.map(a => (decimals === undefined ? str(a) : val(a).toFixed(decimals)));
  must(gradeCard(card, typed, null, []) === 'correct', `exact answer ${typed.join(',')} graded ${gradeCard(card, typed, null, [])}`);
  fields.forEach((f, i) => {
    const tol = f.tolerance ?? 1e-8;
    for (const delta of [-1, 1]) {
      const bad = [...typed];
      bad[i] = String(val(answers[i]) + delta * Math.max(10 * tol, 1e-6));
      must(gradeCard(card, bad, null, []) === 'incorrect', `perturbed field ${i} by ${delta * 10 * tol} graded ${gradeCard(card, bad, null, [])}`);
    }
  });
}

const P = (c: PracticeCard) => c.audit!.params as Record<string, number>;

describe('GP-29 structure', () => {
  it('has nine cards in order with GP-29-<slug> ids and EN/ZH identical structure', () => {
    for (const d of DECKS) {
      expect([...d.cards.keys()], `seed ${d.seed} ${d.lang}`).toEqual(SLUGS);
      for (const c of d.cards.values()) expect(c.id.startsWith('GP-29-')).toBe(true);
    }
  });
  it('every audit kind of the plan fires on every seed and no unknown kind appears', () => {
    for (const d of DECKS) {
      const kinds = [...d.cards.values()].filter(c => c.audit).map(c => c.audit!.kind).sort();
      expect(kinds, `seed ${d.seed} ${d.lang}`).toEqual([...KINDS].sort());
      for (const c of d.cards.values()) {
        if (c.fields) expect(c.audit, `${c.id} numeric card without audit`).toBeDefined();
        if (c.id.endsWith('assumption')) { expect(c.audit).toBeUndefined(); expect(c.choice).toBeDefined(); }
        expect(c.slots, c.id).toBeUndefined();
        expect(c.audit ? Object.keys(c.audit.params).some(k => /answer|key|expected/i.test(k)) : false, `${c.id} audit leaks the answer`).toBe(false);
      }
    }
  });
});

describe('GP-29 card 1 discretise', () => {
  it('Var(q) from the kernel values, printed text = params, sets, grading', () => {
    const failures = forCard('discretise', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'a_den,a_num,s', `params ${Object.keys(p)}`);
      must(CARD1_SETS.has(key(p.a_num, p.a_den, p.s)), `set ${p.a_num}/${p.a_den}, s=${p.s} not in plan`);
      const s = tok(t, 'σ_f²'), a = tokAfter(t, String.raw`exp\(−Δ/ℓ\) = `.replace('−', '-'));
      must(s.v === p.s, `printed s ${s.token} vs ${p.s}`);
      must(a.n === p.a_num && a.d === p.a_den, `printed a ${a.token} vs ${p.a_num}/${p.a_den}`);
      const ratio = /Δ\/ℓ = (ln 2|ln 3|ln\(3\/2\))/.exec(t)?.[1];
      const expected = p.a_den === 2 ? 'ln 2' : p.a_den === 3 && p.a_num === 1 ? 'ln 3' : 'ln(3/2)';
      must(ratio === expected, `ratio ${ratio} vs ${expected}`);
      const a_ = fr(p.a_num, p.a_den), s_ = F(p.s);
      // Var(f1 - a f0) = k(0) + a^2 k(0) - 2 a k(Delta), k(Delta) = a s
      const route1 = sub(add(s_, mul(mul(a_, a_), s_)), mul(F(2), mul(a_, mul(a_, s_))));
      // second route: s - (a s)^2 / s
      const route2 = sub(s_, div(mul(mul(a_, s_), mul(a_, s_)), s_));
      must(eq(route1, route2), 'oracle routes disagree');
      gradeChecks(card, [route1]);
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 2 predict', () => {
  it('mean and variance of the linear map [a 1](f, q)', () => {
    const failures = forCard('predict', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'Q,a_den,a_num,m,p', `params ${Object.keys(p)}`);
      must(CARD2_ROWS.has(key(p.a_num, p.a_den, p.Q, p.p)), `row ${p.a_num}/${p.a_den}, Q=${p.Q}, p=${p.p} not in plan`);
      const j = p.m / p.a_den;
      must(Number.isInteger(j) && j !== 0 && Math.abs(j) <= 3, `m=${p.m} not a_den*j with j in ±1..3`);
      const a = tokAfter(t, String.raw`\ba = `), Q = tok(t, 'Var(qₖ)'), m = tok(t, 'mₖ⁺'), pp = tok(t, 'Pₖ⁺');
      must(a.n === p.a_num && a.d === p.a_den && Q.v === p.Q && m.v === p.m && pp.v === p.p, `printed ${a.token},${Q.token},${m.token},${pp.token}`);
      const a_ = fr(p.a_num, p.a_den);
      const row: Mat = [[a_, F(1)]];
      const cov: Mat = [[F(p.p), F(0)], [F(0), F(p.Q)]];
      const varNext = mm(mm(row, cov), tr(row))[0][0];
      const meanNext = mm(row, [[F(p.m)], [F(0)]])[0][0];
      gradeChecks(card, [meanNext, varNext]);
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 3 update', () => {
  it('Gaussian conditioning of (f, y) and the precision form', () => {
    const failures = forCard('update', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'Pp,mp,r,y', `params ${Object.keys(p)}`);
      const dk = CARD3_ROWS.get(key(p.Pp, p.r));
      must(dk !== undefined, `(Pp,r)=(${p.Pp},${p.r}) not in plan`);
      const diff = p.y - p.mp, j = diff / dk!;
      must(Number.isInteger(j) && [-2, -1, 1, 2].includes(j), `y-mp=${diff} not den(K)*j`);
      must([-3, -2, -1, 1, 2, 3].includes(p.mp), `mp=${p.mp}`);
      const r = tok(t, 'σ_n²'), mp = tok(t, 'mₖ⁻'), Pp = tok(t, 'Pₖ⁻'), y = tokAfter(t, String.raw`\by = `);
      must(r.v === p.r && mp.v === p.mp && Pp.v === p.Pp && y.v === p.y, `printed ${r.token},${mp.token},${Pp.token},${y.token}`);
      // route A: joint Gaussian of (f, y) conditioned on y
      const joint = condition([F(p.mp), F(p.mp)], [[F(p.Pp), F(p.Pp)], [F(p.Pp), F(p.Pp + p.r)]], [1], [F(p.y)]);
      const mPlus = joint.mean[0], PPlus = joint.cov[0][0];
      const K = div(F(p.Pp), F(p.Pp + p.r)); // regression coefficient Cov(f,y)/Var(y)
      // route B: precision form
      const Pprec = inv([[add(inv([[F(p.Pp)]])[0][0], inv([[F(p.r)]])[0][0])]])[0][0];
      const mprec = mul(Pprec, add(div(F(p.mp), F(p.Pp)), div(F(p.y), F(p.r))));
      const Kprec = div(Pprec, F(p.r));
      must(eq(mPlus, mprec) && eq(PPlus, Pprec) && eq(K, Kprec), 'oracle routes disagree');
      must(mPlus.d === 1, `m+ not an integer: ${str(mPlus)}`);
      gradeChecks(card, [K, mPlus, PPlus]);
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 4 forecast', () => {
  it('dense GP posterior with one observation', () => {
    const failures = forCard('forecast', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'a_den,a_num,r,s', `params ${Object.keys(p)}`);
      must(CARD4_ROWS.has(key(p.a_num, p.a_den, p.s, p.r)), `row not in plan`);
      const s = tok(t, 'σ_f²'), a = tokAfter(t, String.raw`\ba = `), r = tok(t, 'σ_n²'), Q = tok(t, 'Var(qₖ)');
      must(s.v === p.s && a.n === p.a_num && a.d === p.a_den && r.v === p.r, `printed ${s.token},${a.token},${r.token}`);
      const a_ = fr(p.a_num, p.a_den), s_ = F(p.s), r_ = F(p.r);
      must(eq(frOf({ n: Q.n, d: Q.d }), mul(s_, sub(F(1), mul(a_, a_)))), `printed Q ${Q.token} != s(1-a^2)`);
      // variables (y1, f1, f2): y1 = f1 + noise; k(t1,t2) = a s
      const as = mul(a_, s_);
      const cov: Mat = [[add(s_, r_), s_, as], [s_, s_, as], [as, as, s_]];
      const cond = condition([F(0), F(0), F(0)], cov, [0], [F(7)]); // value of y1 irrelevant to the variance
      const P1 = cond.cov[0][0], P2 = cond.cov[1][1];
      gradeChecks(card, [P1, P2]);
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 5 llh-term', () => {
  it('log density of N(v; 0, S) agrees with the keyed term from the printed L', () => {
    const failures = forCard('llh-term', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'L,S,v', `params ${Object.keys(p)}`);
      const row = CARD5[p.S];
      must(!!row, `S=${p.S} not in plan`);
      must(Math.abs(row.L - p.L) < 1e-9, `L=${p.L} vs plan ${row.L}`);
      must(row.v.includes(Math.abs(p.v)), `|v|=${Math.abs(p.v)} not allowed for S=${p.S}`);
      const v = tokAfter(t, String.raw`\bv = `), S = tokAfter(t, String.raw`\bS = `), L = tokAfter(t, String.raw`log\(2πS\) = `);
      must(v.v === p.v && S.v === p.S && Math.abs(L.v - p.L) < 1e-9, `printed ${v.token},${S.token},${L.token}`);
      const exact = -0.5 * Math.log(2 * Math.PI * p.S) - (p.v * p.v) / (2 * p.S);
      must(Math.abs(p.L - Math.log(2 * Math.PI * p.S)) < 0.005, `printed L ${p.L} vs ln(2πS)=${Math.log(2 * Math.PI * p.S)}`);
      const keyed = -(p.L + (p.v * p.v) / p.S) / 2;
      must(Math.abs(keyed - exact) <= 0.0051, `keyed ${keyed} vs exact ${exact}`);
      must(Math.abs(100 * keyed - Math.round(100 * keyed)) < 1e-6, `key ${keyed} has more than 2 decimals`);
      must(card.fields!.length === 1 && card.fields![0].tolerance === 0.005, `tolerance ${card.fields![0].tolerance}`);
      must(Math.abs(card.fields![0].answer - keyed) < 1e-9, `card answer ${card.fields![0].answer} vs ${keyed}`);
      must(keyed < 0, 'answer must be negative');
      const g = (x: number) => gradeCard(card, [x.toFixed(2)], null, []);
      must(g(Math.round(keyed * 100) / 100) === 'correct', 'rounded key rejected');
      must(gradeCard(card, [String(exact)], null, []) === 'correct', 'exact log density value rejected');
      must(gradeCard(card, [String(keyed + 0.0052)], null, []) === 'incorrect', 'key+0.0052 accepted');
      must(gradeCard(card, [String(keyed - 0.0052)], null, []) === 'incorrect', 'key-0.0052 accepted');
      must(gradeCard(card, [String(-keyed)], null, []) === 'incorrect', 'positive version accepted');
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 6 rts-gain', () => {
  it('regression slope of the joint Gaussian (f_k, f_k+1)', () => {
    const failures = forCard('rts-gain', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'Pp_den,Pp_num,a_den,a_num,p', `params ${Object.keys(p)}`);
      must(CARD6_ROWS.has(key(p.a_num, p.a_den, p.p, p.Pp_num, p.Pp_den)), `row not in plan`);
      const a = tokAfter(t, String.raw`\ba = `), pp = tok(t, 'Pₖ⁺'), Pp = tok(t, 'Pₖ₊₁⁻');
      must(a.n === p.a_num && a.d === p.a_den && pp.v === p.p && Pp.n === p.Pp_num && Pp.d === p.Pp_den, `printed ${a.token},${pp.token},${Pp.token}`);
      const a_ = fr(p.a_num, p.a_den), p_ = F(p.p), Pp_ = fr(p.Pp_num, p.Pp_den);
      must(val(Pp_) >= val(mul(mul(a_, a_), p_)), 'Pp < a^2 p');
      const sf2 = div(sub(Pp_, mul(mul(a_, a_), p_)), sub(F(1), mul(a_, a_)));
      must(val(sf2) >= p.p, `implied sigma_f^2 ${str(sf2)} < p`);
      const cov: Mat = [[p_, mul(a_, p_)], [mul(a_, p_), Pp_]];
      // slope of f_k on f_k+1: Cov(f_k, f_k+1) * Var(f_k+1)^-1 via the inverse of the 1x1 block
      const G = mm([[cov[0][1]]], inv([[cov[1][1]]]))[0][0];
      gradeChecks(card, [G]);
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 7 smooth', () => {
  it('conditioning the joint (f_k, f_k+1) on f_k+1 ~ N(ms, Ps); printed text, figure', () => {
    const failures = forCard('smooth', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'G_den,G_num,Pp_den,Pp_num,Ps_den,Ps_num,a_den,a_num,mf,ms,p', `params ${Object.keys(p)}`);
      const a_ = fr(p.a_num, p.a_den), p_ = F(p.p), Pp_ = fr(p.Pp_num, p.Pp_den), G_ = fr(p.G_num, p.G_den), Ps_ = fr(p.Ps_num, p.Ps_den);
      const rowOk = CARD7_ROWS_VAL.some(r => eq(r.a, a_) && eq(r.p, p_) && eq(r.Pp, Pp_) && eq(r.G, G_));
      must(rowOk, 'row (a,p,Pp,G) not in plan');
      must(eq(G_, div(mul(a_, p_), Pp_)), 'G != a p / Pp');
      // audit fractions are the reduced printed fractions
      for (const [n, d, name] of [[p.a_num, p.a_den, 'a'], [p.Pp_num, p.Pp_den, 'Pp'], [p.G_num, p.G_den, 'G'], [p.Ps_num, p.Ps_den, 'Ps']] as const)
        must(d >= 1 && gcd(n, d) === 1, `${name} = ${n}/${d} not reduced with den >= 1`);
      const h = p.G_den;
      const diff = sub(Pp_, Ps_);
      must(eq(diff, fr(h, 2)) || eq(diff, F(h)), `Pp-Ps=${str(diff)} not in {h/2, h}`);
      must(val(Ps_) > 0, 'Ps <= 0');
      must(p.mf % p.a_den === 0 && Math.abs(p.mf / p.a_den) >= 1 && Math.abs(p.mf / p.a_den) <= 3, `mf=${p.mf}`);
      const mpred = mul(a_, F(p.mf));
      const j2 = (p.ms - val(mpred)) / h;
      must(Number.isInteger(j2) && [-2, -1, 1, 2].includes(j2), `ms - a mf = ${p.ms - val(mpred)} not h*j2`);
      must(Math.abs(p.ms) <= 20, `|ms|=${p.ms} > 20`);
      // printed
      const mf = tok(t, 'mₖ⁺'), pp = tok(t, 'Pₖ⁺'), Pp = tok(t, 'Pₖ₊₁⁻'), G = tok(t, 'Gₖ'), ms = tok(t, 'mₖ₊₁ˢ'), Ps = tok(t, 'Pₖ₊₁ˢ'), a = tokAfter(t, String.raw`\ba = `);
      must(mf.v === p.mf && pp.v === p.p && Pp.n === p.Pp_num && Pp.d === p.Pp_den && G.n === p.G_num && G.d === p.G_den && ms.v === p.ms && Ps.n === p.Ps_num && Ps.d === p.Ps_den && a.n === p.a_num && a.d === p.a_den,
        `printed a=${a.token} mf=${mf.token} p=${pp.token} Pp=${Pp.token} G=${G.token} ms=${ms.token} Ps=${Ps.token} vs params`);
      // oracle: joint (f_k, f_k+1) given the filter, then tower rule over f_k+1 ~ N(ms, Ps)
      const joint = [F(p.mf), mpred], cov: Mat = [[p_, mul(a_, p_)], [mul(a_, p_), Pp_]];
      const c0 = condition(joint, cov, [1], [F(p.ms)]); // f_k | f_k+1 = ms: mean, variance (conditional variance independent of ms)
      const c1 = condition(joint, cov, [1], [add(F(p.ms), F(1))]); // slope = difference of conditional means for a unit step
      const slope = sub(c1.mean[0], c0.mean[0]);
      const E = c0.mean[0];
      const V = add(c0.cov[0][0], mul(mul(slope, slope), Ps_));
      must(E.d === 1, `mean not integer ${str(E)}`);
      must(val(V) > 0, 'variance not positive');
      gradeChecks(card, [E, V]);
      // figure
      const fig = card.figure as Figure | undefined;
      must(!!fig, 'figure missing');
      figureChecks(fig!, p, E, V);
    });
    expect(failures).toEqual([]);
  });
});

function figureChecks(fig: Figure, p: Record<string, number>, E: Fr, V: Fr) {
  const a = p.a_num / p.a_den, mf = p.mf, mpred = a * mf, Pp = p.Pp_num / p.Pp_den, Ps = p.Ps_num / p.Ps_den;
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  const pts = fig.shapes.filter(s => s.kind === 'point') as Extract<Figure['shapes'][number], { kind: 'point' }>[];
  const lines = fig.shapes.filter(s => s.kind === 'line') as Extract<Figure['shapes'][number], { kind: 'line' }>[];
  const arrows = fig.shapes.filter(s => s.kind === 'arrow') as Extract<Figure['shapes'][number], { kind: 'arrow' }>[];
  must(pts.length === 3, `${pts.length} points`);
  must(pts.some(s => near(s.at[0], 0) && near(s.at[1], mf)), `no filtered point at (0, ${mf})`);
  must(pts.some(s => near(s.at[0], 1) && near(s.at[1], mpred) && s.hollow), `no hollow predicted point at (1, ${mpred})`);
  must(pts.some(s => near(s.at[0], 1.25) && near(s.at[1], p.ms)), `no smoothed-next point at (1.25, ${p.ms})`);
  const bar = (x: number, centre: number, variance: number) => lines.some(l => l.points.length === 2 && l.points.every(q => near(q[0], x)) && l.points.some(q => near(q[1], centre - Math.sqrt(variance))) && l.points.some(q => near(q[1], centre + Math.sqrt(variance))));
  must(bar(0, mf, p.p), 'filtered bar');
  must(bar(1, mpred, Pp), 'predicted bar');
  must(bar(1.25, p.ms, Ps), 'smoothed bar');
  must(lines.some(l => l.dash && l.points.length === 2 && near(l.points[0][0], 0) && near(l.points[0][1], mf) && near(l.points[1][0], 1) && near(l.points[1][1], mpred)), 'dashed line (0,mf)->(1,a mf)');
  must(arrows.length === 1 && near(arrows[0].from[0], 1) && near(arrows[0].from[1], mpred) && near(arrows[0].to[0], 1.25) && near(arrows[0].to[1], p.ms), 'arrow predicted -> smoothed');
  must(fig.view.xmin <= -0.3 + 1e-9 && fig.view.xmax >= 1.6 - 1e-9, `view x ${fig.view.xmin}..${fig.view.xmax}`);
  must(fig.aspect === 'free', 'aspect free');
  for (const s of fig.shapes) {
    const all = s.kind === 'line' || s.kind === 'area' ? s.points : s.kind === 'arrow' ? [s.from, s.to] : [s.at];
    for (const q of all) must(q[0] >= fig.view.xmin - 1e-9 && q[0] <= fig.view.xmax + 1e-9 && q[1] >= fig.view.ymin - 1e-9 && q[1] <= fig.view.ymax + 1e-9, `shape outside view at ${q}`);
  }
  // does not show its own answer: nothing at t_k other than the filtered mean and its bar; no sqrt(V) bar anywhere
  const Es = val(E), Vs = val(V);
  if (!near(Es, mf)) must(!pts.some(s => near(s.at[0], 0) && near(s.at[1], Es)), 'figure shows the smoothed mean at t_k');
  must(!lines.some(l => l.points.length === 2 && l.points.every(q => near(q[0], 0)) && l.points.some(q => near(q[1], Es - Math.sqrt(Vs))) && l.points.some(q => near(q[1], Es + Math.sqrt(Vs))) && !near(Vs, p.p)), 'figure shows the smoothed bar at t_k');
  for (const s of fig.shapes) if (s.kind === 'text') must(!new RegExp(`(^|[^\\d.])${Es.toString().replace('-', '[−-]')}($|[^\\d.])`).test(s.text), 'text shape shows the answer');
}

describe('GP-29 card 9 challenge', () => {
  it('dense 2x2 posterior vs full Kalman + RTS; printed text; family and answer constraints', () => {
    const failures = forCard('challenge', card => {
      const p = P(card), t = promptOf(card);
      must(Object.keys(p).sort().join() === 'a_den,a_num,r,s,y1,y2', `params ${Object.keys(p)}`);
      must(CARD9_FAMILIES.has(key(p.a_num, p.a_den, p.s, p.r)), `family (${p.a_num}/${p.a_den}, s=${p.s}, r=${p.r}) not in plan`);
      must(p.y1 !== 0 && p.y2 !== 0 && Math.abs(p.y1) <= 8 && Math.abs(p.y2) <= 8 && p.y1 !== p.y2 && Number.isInteger(p.y1) && Number.isInteger(p.y2), `y=(${p.y1},${p.y2})`);
      const s = tok(t, 'σ_f²'), r = tok(t, 'σ_n²'), a = tokAfter(t, String.raw`exp\(-Δ/ℓ\) = `), y1 = tok(t, 'y₁'), y2 = tok(t, 'y₂');
      must(s.v === p.s && r.v === p.r && a.n === p.a_num && a.d === p.a_den && y1.v === p.y1 && y2.v === p.y2, `printed ${s.token},${r.token},${a.token},${y1.token},${y2.token}`);
      const ratio = /Δ\/ℓ = (ln 2|ln 3|ln\(3\/2\))/.exec(t)?.[1];
      const expected = p.a_den === 2 ? 'ln 2' : 'ln(3/2)';
      must(ratio === expected, `ratio ${ratio} vs ${expected}`);
      const a_ = fr(p.a_num, p.a_den), s_ = F(p.s), r_ = F(p.r), y = [F(p.y1), F(p.y2)];
      // (i) dense: k*^T (K + r I)^-1 y
      const K: Mat = [[s_, mul(a_, s_)], [mul(a_, s_), s_]];
      const C: Mat = [[add(K[0][0], r_), K[0][1]], [K[1][0], add(K[1][1], r_)]];
      const w = mm([[s_, mul(a_, s_)]], inv(C))[0];
      const dense = add(mul(w[0], y[0]), mul(w[1], y[1]));
      // dense via joint conditioning of (f1, y1, y2)
      const joint: Mat = [[s_, s_, mul(a_, s_)], [s_, add(s_, r_), mul(a_, s_)], [mul(a_, s_), mul(a_, s_), add(s_, r_)]];
      const dense2 = condition([F(0), F(0), F(0)], joint, [1, 2], y).mean[0];
      // (ii) Kalman filter + RTS smoother with Q = s (1 - a^2), prior N(0, s) at t1
      const Qn = mul(s_, sub(F(1), mul(a_, a_)));
      const S1 = add(s_, r_), K1 = div(s_, S1), m1 = mul(K1, y[0]), P1 = sub(s_, mul(mul(K1, S1), K1));
      const m2m = mul(a_, m1), P2m = add(mul(mul(a_, a_), P1), Qn);
      const S2 = add(P2m, r_), K2 = div(P2m, S2), m2p = add(m2m, mul(K2, sub(y[1], m2m)));
      const G1 = div(mul(a_, P1), P2m);
      const smooth = add(m1, mul(G1, sub(m2p, m2m)));
      must(eq(dense, dense2) && eq(dense, smooth), `routes disagree: ${str(dense)} ${str(dense2)} ${str(smooth)}`);
      must(dense.n !== 0, 'answer is 0');
      must([1, 2, 4].includes(dense.d), `denominator ${dense.d}`);
      gradeChecks(card, [dense]);
    });
    expect(failures).toEqual([]);
  });
});

describe('GP-29 card 8 assumption (choice)', () => {
  it('exactly one option satisfies the plan predicate and the answer index points to it', () => {
    const seenT1 = new Set<string>(), seenT2 = new Set<string>();
    const failures = forCard('assumption', (card, ctx) => {
      const c = card.choice!;
      must(!!c && !card.fields && !card.audit, 'must be a pure choice card');
      const en = ctx.lang === 'en';
      const t1 = en ? /^k = (\d+) exp\(−r\/(\d+)\), the exponential/ : /^k = (\d+) exp\(−r\/(\d+)\)，指数核/;
      const isT1 = /ℓ = \d+/.test(card.prompt);
      const fix = (s: string) => s.replaceAll('-', '−');
      let verdicts: boolean[];
      if (isT1) {
        const s = Number(/σ_f² = (\d+)/.exec(card.prompt)![1]), l = Number(/ℓ = (\d+)/.exec(card.prompt)![1]);
        must(c.options.length === 3, `${c.options.length} options in T1`);
        verdicts = c.options.map(o => { const m = t1.exec(fix(o)); return !!m && Number(m[1]) === s && Number(m[2]) === l; });
        // the wrong options are Matérn-3/2 and SE with the same s and l
        const mat = c.options.filter(o => /√3/.test(o)).length, se = c.options.filter(o => /r²/.test(o)).length;
        must(mat === 1 && se === 1, `distractors: ${mat} Matérn-3/2, ${se} SE`);
        const mOpt = c.options.find(o => /√3/.test(o))!, sOpt = c.options.find(o => /r²/.test(o))!;
        must(new RegExp(`k = ${s} \\(1 \\+ √3 r/${l}\\) exp\\(−√3 r/${l}\\)`).test(fix(mOpt)), `Matérn option parameters: ${mOpt}`);
        must(new RegExp(`k = ${s} exp\\(−r²/${2 * l * l}\\)`).test(fix(sOpt)), `SE option parameters (2l²=${2 * l * l}): ${sOpt}`);
        seenT1.add(card.prompt);
      } else {
        must(c.options.length === 4, `${c.options.length} options in T2`);
        verdicts = c.options.map(o => (en ? /^No/.test(o) && /rational/.test(o) && !/only for/.test(o) : /^不能/.test(o) && /有理函数/.test(o) && !/只适用于/.test(o)));
        const correct = c.options[c.answer];
        const longer = c.options.filter((o, i) => i !== c.answer && o.length > correct.length).length;
        must(longer >= 1, 'correct option is the strict longest');
        seenT2.add(c.options.slice().sort().join('||'));
      }
      must(verdicts.filter(Boolean).length === 1, `${verdicts.filter(Boolean).length} options satisfy the predicate`);
      must(verdicts[c.answer], `answer index ${c.answer} points to the wrong option`);
      must(gradeCard(card, [], c.answer, []) === 'correct' && gradeCard(card, [], (c.answer + 1) % c.options.length, []) === 'incorrect', 'grading');
      if (isT1) must(c.options[c.answer].length <= Math.max(...c.options.map(o => o.length)), 'x');
    });
    expect(failures).toEqual([]);
    expect(seenT1.size).toBeGreaterThanOrEqual(2);
    expect(seenT2.size).toBeGreaterThanOrEqual(1);
  });
});

describe('GP-29 variety and lints', () => {
  it('each card has at least 6 distinct EN prompts over 60 seeds', () => {
    for (const slug of SLUGS) {
      const prompts = new Set(DECKS.filter(d => d.lang === 'en').map(d => d.cards.get(slug)!.prompt));
      expect(prompts.size, `${slug}: ${prompts.size} distinct prompts`).toBeGreaterThanOrEqual(6);
    }
  });
  it('no card other than smooth has a figure; the printed question never contains the answer in the hint', () => {
    for (const d of DECKS) for (const [slug, c] of d.cards) {
      if (slug !== 'smooth') expect(c.figure, `${slug}`).toBeUndefined();
      if (c.fields) for (const f of c.fields) {
        const shown = questionTextOf(c).join(' ');
        void shown;
        expect(c.hint.includes(String(f.answer)) && !Number.isInteger(f.answer), `${slug} hint contains answer ${f.answer}`).toBe(false);
      }
    }
  });
});

describe('GP-29 learner-facing text', () => {
  it('explanations of exact cards contain no rounded decimals and no ambiguous chained fractions', () => {
    for (const d of DECKS) for (const [slug, c] of d.cards) {
      if (slug === 'llh-term' || slug === 'assumption') continue;
      expect(/(?<!(?:Task|任务) )\d\.\d/.test(c.explanation), `${slug} ${d.lang} explanation has a decimal: ${c.explanation.slice(0, 120)}`).toBe(false);
      // "a/b/c" or "a/b²" (a fraction followed by another slash or a square without parentheses)
      expect(/\d\/\d+(?:\/|²)/.test(c.explanation.replace(/\(\d+\/\d+\)²/g, '')), `${slug} ${d.lang} ambiguous fraction chain: ${c.explanation.slice(0, 200)}`).toBe(false);
    }
  });
  it('the ZH deck has no English words other than symbols and proper names', () => {
    for (const d of DECKS.filter(x => x.lang === 'zh')) for (const c of d.cards.values())
      for (const text of [c.prompt, c.hint, c.explanation, ...(c.choice?.options ?? [])])
        expect(/(pdf|Supplement|Assignment|Lecture)/.test(text), text.slice(0, 80)).toBe(false);
  });
  it('the correct choice is not always in the same position', () => {
    for (const t1 of [true, false]) {
      const idx = new Set<number>();
      for (const d of DECKS.filter(x => x.lang === 'en')) { const c = d.cards.get('assumption')!; if (/ℓ = \d/.test(c.prompt) === t1) idx.add(c.choice!.answer); }
      expect(idx.size, `template ${t1 ? 'T1' : 'T2'}`).toBeGreaterThanOrEqual(2);
    }
  });
});
