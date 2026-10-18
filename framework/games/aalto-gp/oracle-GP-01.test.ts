import { describe, expect, it } from 'vitest';
import { gp01 } from './games/gp01';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';
import type { Figure } from '../figure';

/**
 * Independent oracle for GP-01 (covariance matrices and marginals).
 * Written from docs/aalto-gp-drafts/approved-GP-01.md only, BEFORE the generator was opened.
 * Numeric answers are recomputed by explicit routes (standardisation + Cholesky, selector products A S A^T, S a, Cholesky norm, x = m + L z);
 * choice answers are decided from the printed prompt/options with predicates from the plan.
 */
const SEEDS = 60;
const TOL = 0.006;
type Lang = 'en' | 'zh';
type P = Record<string, number>;
type M = number[][];
const seedAt = (i: number) => spreadSeed(i);
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const clean = (t: string) => t.replaceAll('−', '-').replace(/[₀-₉]/g, d => String(SUB.indexOf(d)));
const slugs = ['read-corr', 'match-contour', 'peak-height', 'marginal-pick', 'marginal-det', 'lincomb-var', 'sum-vs-diff', 'validity', 'challenge'] as const;
const pick = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(c => c.id === `GP-01-${slug}`);
  if (!card) throw new Error(`card GP-01-${slug} missing`);
  return card;
};
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);
const eachDeck = (fn: (cards: PracticeCard[], lang: Lang, at: string, i: number) => void) => {
  for (let i = 0; i < SEEDS; i++) for (const lang of ['en', 'zh'] as Lang[]) fn(gp01(seedAt(i), lang), lang, `seed ${seedAt(i)} ${lang}`, i);
};

// ---------- linear algebra written by hand ----------
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const matVec = (A: M, v: number[]) => A.map(r => dot(r, v));
const transpose = (A: M): M => A[0].map((_, j) => A.map(r => r[j]));
function cholesky(A: M): M {
  const n = A.length, L: M = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (!(s > 1e-12)) throw new Error('not positive definite'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function det(A: M): number {
  const n = A.length, W = A.map(r => [...r]);
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(W[r][c]) > Math.abs(W[p][c])) p = r;
    if (Math.abs(W[p][c]) < 1e-14) return 0;
    if (p !== c) { [W[c], W[p]] = [W[p], W[c]]; d = -d; }
    d *= W[c][c];
    for (let r = c + 1; r < n; r++) { const f = W[r][c] / W[c][c]; for (let j = c; j < n; j++) W[r][j] -= f * W[c][j]; }
  }
  return d;
}
function inverse2(A: M): M { const d = A[0][0] * A[1][1] - A[0][1] * A[1][0]; return [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]]; }
const sym3 = (p: P): M => [[p.s11, p.s12, p.s13], [p.s12, p.s22, p.s23], [p.s13, p.s23, p.s33]];
const selector = (keep: number[]): M => keep.map(k => [0, 1, 2].map(j => (j === k ? 1 : 0)));
const mul = (A: M, B: M): M => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const isSymPD = (A: M) => A.every((r, i) => r.every((v, j) => v === A[j][i])) && (() => { try { cholesky(A); return true; } catch { return false; } })();

// ---------- parsing the printed text ----------
const nums = (s: string) => [...clean(s).matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
/** Every matrix `[[..], [..]]` (2x2 or 3x3) in the text, in order of appearance. */
function matrices(text: string): M[] {
  const out: M[] = [];
  const t = clean(text);
  for (const m of t.matchAll(/\[\[[^\]]*\](?:,\s*\[[^\]]*\])+\]/g)) out.push([...m[0].matchAll(/\[([^\[\]]*)\]/g)].map(r => r[1].split(',').map(Number)));
  return out;
}
const firstMat = (text: string): M => { const ms = matrices(text); if (!ms.length) throw new Error(`no matrix in ${text.slice(0, 150)}`); return ms[0]; };
function tuple(text: string, re: RegExp): number[] {
  const m = re.exec(clean(text));
  if (!m) throw new Error(`no match ${re} in ${text.slice(0, 160)}`);
  return m.slice(1).map(Number);
}
const mean3 = (t: string) => tuple(t, /m = \((-?\d+), (-?\d+), (-?\d+)\)/);
const dropIndex = (t: string) => Number(/x(\d)(?: \(component \1\))?(?: is integrated out|\s*(?:（第 \1 个分量）)?积分)/.exec(clean(t))?.[1] ?? NaN);
/** "2x1 - x2" -> [2, -1] over the given number of variables. */
function linear(expr: string, n: number): number[] {
  const coefs = Array(n).fill(0);
  const t = clean(expr).replace(/\s+/g, ' ').trim();
  let found = 0;
  for (const m of t.matchAll(/([+-]?)\s*(\d*)x(\d)/g)) { coefs[Number(m[3]) - 1] += (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])); found++; }
  if (!found) throw new Error(`no linear expression in "${expr}"`);
  return coefs;
}
const lincomb = (prompt: string, name: string, n: number) => {
  const m = new RegExp(`${name} = ([^.。?？]*?)(?:\\. |。)`).exec(clean(prompt));
  if (!m) throw new Error(`no ${name} = in ${prompt}`);
  return linear(m[1], n);
};

// ---------- numeric oracles per audit kind (route 2) ----------
function oracle(kind: string, p: P): number[] {
  switch (kind) {
    case 'GP-01:read-corr': {
      const S = [[p.a, p.c], [p.c, p.b]];
      const d = [1 / Math.sqrt(S[0][0]), 1 / Math.sqrt(S[1][1])];
      const rho1 = d[0] * S[0][1] * d[1];                       // (D S D)_12
      const L = cholesky(S);
      const rho2 = L[1][0] / Math.hypot(L[1][0], L[1][1]);       // Cholesky route
      if (Math.abs(rho1 - rho2) > 1e-12) throw new Error('routes disagree');
      return [rho1];
    }
    case 'GP-01:marginal-det': {
      const S = sym3(p); cholesky(S);
      const keep = [0, 1, 2].filter(k => k !== p.drop - 1);
      const A = selector(keep), B = mul(mul(A, S), transpose(A));
      const d1 = det(B);
      const tr = B[0][0] + B[1][1], disc = Math.sqrt(Math.max(0, tr * tr - 4 * d1));
      const d2 = ((tr + disc) / 2) * ((tr - disc) / 2);
      if (Math.abs(d1 - d2) > 1e-9) throw new Error('routes disagree');
      return [d1];
    }
    case 'GP-01:lincomb-var': {
      const S = [[p.s11, p.s12], [p.s12, p.s22]], a = [p.a1, p.a2];
      const v1 = dot(a, matVec(S, a));
      const L = cholesky(S), w = matVec(transpose(L), a), v2 = dot(w, w);
      if (Math.abs(v1 - v2) > 1e-9) throw new Error('routes disagree');
      return [v1];
    }
    case 'GP-01:challenge': {
      const S = sym3(p), a = [p.a1, p.a2, p.a3], m = [p.m1, p.m2, p.m3];
      const L = cholesky(S);
      const v1 = dot(a, matVec(S, a));
      const w = matVec(transpose(L), a), v2 = dot(w, w);
      // x = m + L z with z = e_k: Var(u) = sum_k (a . L[:,k])^2
      let v3 = 0;
      for (let k = 0; k < 3; k++) { const col = L.map(r => r[k]); v3 += dot(a, col) ** 2; }
      if (Math.abs(v1 - v2) > 1e-9 || Math.abs(v1 - v3) > 1e-9) throw new Error('routes disagree');
      return [dot(a, m), v1];
    }
    default: throw new Error(`unknown audit kind ${kind}`);
  }
}
/** Wrong routes a learner could take (from the plan); each must grade wrong. Each entry is a full answer vector. */
function wrongRoutes(kind: string, p: P, truth: number[]): number[][] {
  switch (kind) {
    case 'GP-01:read-corr': return [[p.c / p.a], [p.c / p.b], [p.c / (p.a * p.b)], [p.c / (p.a + p.b)], [p.c], [2 * p.c / (p.a + p.b)]];
    case 'GP-01:marginal-det': {
      const keep = [0, 1, 2].filter(k => k !== p.drop - 1), S = sym3(p);
      const pair = (i: number, j: number) => S[i][i] * S[j][j] - S[i][j] ** 2;
      return [[S[keep[0]][keep[0]] * S[keep[1]][keep[1]]], [pair(0, 1)], [pair(0, 2)], [pair(1, 2)], [det(S)]].filter(w => Math.abs(w[0] - truth[0]) > 1e-9);
    }
    case 'GP-01:lincomb-var': {
      const { s11: s, s12: c, s22: t, a1, a2 } = p;
      return [[a1 * a1 * s + a2 * a2 * t], [a1 * a1 * s + a1 * a2 * c + a2 * a2 * t], [a1 * s + a2 * t + 2 * a1 * a2 * c], [a1 * a1 * s + a2 * a2 * t - 2 * a1 * a2 * c], [s + t + 2 * c], [a1 * a1 * s + a2 * a2 * t + 2 * a1 * a2]];
    }
    case 'GP-01:challenge': {
      const S = sym3(p), a = [p.a1, p.a2, p.a3], m = [p.m1, p.m2, p.m3];
      let diag = 0, cross = 0, all = 0;
      for (let i = 0; i < 3; i++) { diag += a[i] ** 2 * S[i][i]; for (let j = 0; j < 3; j++) all += S[i][j]; for (let j = i + 1; j < 3; j++) cross += a[i] * a[j] * S[i][j]; }
      const out: number[][] = [[truth[0], diag], [truth[0], diag + cross], [truth[0], diag - 2 * cross], [truth[0], all]];
      out.push([m[0] + m[1] + m[2], truth[1]], [a.reduce((s, v, i) => s + Math.abs(v) * m[i], 0), truth[1]]);
      return out;
    }
    default: return [];
  }
}
/** The printed numbers = audit params. */
function printedParams(kind: string, prompt: string): P {
  const t = clean(prompt);
  switch (kind) {
    case 'GP-01:read-corr': { const S = firstMat(t); if (S[0][1] !== S[1][0]) throw new Error('printed matrix not symmetric'); return { a: S[0][0], b: S[1][1], c: S[0][1] }; }
    case 'GP-01:marginal-det': { const S = firstMat(t); return { s11: S[0][0], s12: S[0][1], s13: S[0][2], s22: S[1][1], s23: S[1][2], s33: S[2][2], drop: dropIndex(t) }; }
    case 'GP-01:lincomb-var': { const S = firstMat(t), a = lincomb(t, 'w', 2); return { s11: S[0][0], s12: S[0][1], s22: S[1][1], a1: a[0], a2: a[1] }; }
    case 'GP-01:challenge': {
      const S = firstMat(t), m = mean3(t), a = lincomb(t, 'u', 3);
      return { s11: S[0][0], s12: S[0][1], s13: S[0][2], s22: S[1][1], s23: S[1][2], s33: S[2][2], m1: m[0], m2: m[1], m3: m[2], a1: a[0], a2: a[1], a3: a[2] };
    }
    default: throw new Error(`unknown kind ${kind}`);
  }
}
const KINDS = ['read-corr', 'marginal-det', 'lincomb-var', 'challenge'].map(s => `GP-01:${s}`);
const NUMERIC_SLUGS = ['read-corr', 'marginal-det', 'lincomb-var', 'challenge'];
function toFraction(v: number): string {
  for (let d = 1; d <= 2000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return d === 1 ? `${n}` : `${n}/${d}`; }
  throw new Error(`no small fraction for ${v}`);
}
const grade = (card: PracticeCard, values: string[]) => gradeCard(card, values, null, []);

describe('GP-01 oracle: deck shape', () => {
  it('has the 9 planned cards in order with the right answer modes; only match-contour has a figure', () => {
    const fails: string[] = [];
    eachDeck((cards, _lang, at) => {
      if (cards.map(c => c.id).join() !== slugs.map(s => `GP-01-${s}`).join()) { fails.push(`${at}: ids ${cards.map(c => c.id)}`); return; }
      for (const c of cards) {
        const slug = c.id.slice(6), numeric = NUMERIC_SLUGS.includes(slug);
        if (numeric !== !!c.fields) fails.push(`${at} ${slug}: fields presence`);
        if (numeric !== !!c.audit) fails.push(`${at} ${slug}: audit presence`);
        if (!numeric && !c.choice) fails.push(`${at} ${slug}: expected choice`);
        if (c.slots) fails.push(`${at} ${slug}: unexpected slots`);
        if (!!c.figure !== (slug === 'match-contour')) fails.push(`${at} ${slug}: figure presence`);
        if (c.fields) for (const f of c.fields) if (f.tolerance !== TOL) fails.push(`${at} ${slug}: tolerance ${f.tolerance}`);
      }
      const fields = (s: string) => pick(cards, s).fields!.length;
      if (fields('challenge') !== 2 || fields('read-corr') !== 1 || fields('marginal-det') !== 1 || fields('lincomb-var') !== 1) fails.push(`${at}: field counts`);
      const sizes: Record<string, number> = { 'match-contour': 4, 'peak-height': 4, 'marginal-pick': 4, 'sum-vs-diff': 3, validity: 4 };
      for (const [s, n] of Object.entries(sizes)) if (pick(cards, s).choice!.options.length !== n) fails.push(`${at} ${s}: option count`);
    });
    report(fails);
  });
});

describe('GP-01 oracle: numeric audit kinds', () => {
  it('fires every audit kind on every seed and no unknown kinds', () => {
    const seen: Record<string, number> = {};
    eachDeck(cards => { for (const c of cards) if (c.audit) seen[c.audit.kind] = (seen[c.audit.kind] ?? 0) + 1; });
    expect(Object.keys(seen).sort()).toEqual([...KINDS].sort());
    for (const k of KINDS) expect(seen[k]).toBe(SEEDS * 2);
  });

  it('answers equal the independent recomputation, grade correct, and perturbations / wrong routes grade wrong', () => {
    const fails: string[] = [];
    eachDeck((cards, _lang, at) => {
      for (const card of cards) {
        if (!card.audit) continue;
        const p = card.audit.params as P, kind = card.audit.kind;
        let truth: number[];
        try { truth = oracle(kind, p); } catch (e) { fails.push(`${at} ${kind}: ${(e as Error).message} ${JSON.stringify(p)}`); continue; }
        card.fields!.forEach((f, i) => { if (Math.abs(f.answer - truth[i]) > 1e-9) fails.push(`${at} ${kind} field ${i}: expected ${truth[i]} got ${f.answer} ${JSON.stringify(p)}`); });
        const exactStrs = truth.map(toFraction);
        if (grade(card, exactStrs) !== 'correct') fails.push(`${at} ${kind}: exact answer ${exactStrs} not accepted`);
        if (grade(card, truth.map(v => v.toFixed(2))) !== 'correct') fails.push(`${at} ${kind}: 2dp answer not accepted`);
        truth.forEach((v, i) => {
          for (const d of [TOL + 0.004, -(TOL + 0.004), 1]) {
            const vals = [...exactStrs]; vals[i] = String(v + d);
            if (grade(card, vals) !== 'incorrect') fails.push(`${at} ${kind} field ${i}: perturbation ${d} not rejected`);
          }
        });
        for (const w of wrongRoutes(kind, p, truth)) {
          if (w.every((x, i) => Math.abs(x - truth[i]) <= TOL)) { fails.push(`${at} ${kind}: wrong route ${w} indistinguishable from truth ${truth}`); continue; }
          if (grade(card, w.map(x => String(x))) !== 'incorrect') fails.push(`${at} ${kind}: wrong route ${w} accepted`);
        }
        if (kind !== 'GP-01:read-corr') {
          if (truth.some(v => Math.abs(v - Math.round(v)) > 1e-9)) fails.push(`${at} ${kind}: non-integer answer ${truth}`);
          if (!/Give (an )?integers?\.|请填整数。/.test(card.prompt)) fails.push(`${at} ${kind}: prompt lacks the integer instruction`);
        } else if (!/Give an integer, a fraction or a decimal rounded to 2 places\.|请填整数、分数，或保留 2 位小数的小数。/.test(card.prompt)) fails.push(`${at} ${kind}: prompt lacks the format instruction`);
      }
    });
    report(fails);
  });

  it('printed numbers in the prompt equal the audit params (EN and ZH)', () => {
    const fails: string[] = [];
    eachDeck((cards, _lang, at) => {
      for (const card of cards) {
        if (!card.audit) continue;
        let printed: P;
        try { printed = printedParams(card.audit.kind, card.prompt); } catch (e) { fails.push(`${at} ${card.audit.kind}: ${(e as Error).message}`); continue; }
        const params = card.audit.params as P;
        if (Object.keys(printed).sort().join() !== Object.keys(params).sort().join()) fails.push(`${at} ${card.audit.kind}: param names ${Object.keys(params)} vs ${Object.keys(printed)}`);
        for (const k of Object.keys(printed)) if (printed[k] !== params[k]) fails.push(`${at} ${card.audit.kind}.${k}: printed ${printed[k]} audit ${params[k]}`);
      }
    });
    report(fails);
  });

  it('respects the plan sampling spaces (ranges, positive definiteness, guards)', () => {
    const fails: string[] = [];
    eachDeck((cards, _lang, at) => {
      const rc = pick(cards, 'read-corr').audit!.params as P;
      const okPairs = ['1,4', '4,1', '1,9', '9,1', '2,8', '8,2', '4,9', '9,4'];
      if (!okPairs.includes(`${rc.a},${rc.b}`) || rc.c === 0 || Math.abs(rc.c) >= Math.sqrt(rc.a * rc.b)) fails.push(`${at} read-corr ${JSON.stringify(rc)}`);
      const md = pick(cards, 'marginal-det').audit!.params as P;
      const S = sym3(md), kept = [0, 1, 2].filter(k => k !== md.drop - 1);
      if (!isSymPD(S) || md.drop < 1 || md.drop > 3 || S[kept[0]][kept[1]] === 0) fails.push(`${at} marginal-det ${JSON.stringify(md)}`);
      for (let i = 0; i < 3; i++) {
        if (S[i][i] < 3 || S[i][i] > 6) fails.push(`${at} marginal-det diag`);
        const off = [0, 1, 2].filter(j => j !== i).reduce((s, j) => s + Math.abs(S[i][j]), 0);
        if (!(S[i][i] > off)) fails.push(`${at} marginal-det dominance`);
        for (let j = 0; j < 3; j++) if (Math.abs(S[i][j]) > 2 && i !== j) fails.push(`${at} marginal-det off-diagonal`);
      }
      const lv = pick(cards, 'lincomb-var').audit!.params as P, ans = oracle('GP-01:lincomb-var', lv)[0];
      if (lv.s11 < 2 || lv.s11 > 5 || lv.s22 < 2 || lv.s22 > 5 || lv.s12 === 0 || Math.abs(lv.s12) > 3 || lv.s12 ** 2 >= lv.s11 * lv.s22 || ![1, 2, 3].includes(lv.a1) || lv.a2 === 0 || Math.abs(lv.a2) > 3 || !(ans > 0 && ans <= 60)) fails.push(`${at} lincomb-var ${JSON.stringify(lv)}`);
      const ch = pick(cards, 'challenge').audit!.params as P, cs = sym3(ch), ca = [ch.a1, ch.a2, ch.a3], [eu, vu] = oracle('GP-01:challenge', ch);
      let active = 0;
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (ca[i] * ca[j] * cs[i][j] !== 0) active++;
      if (!isSymPD(cs) || ca.filter(v => v !== 0).length < 2 || active < 2 || ca.some(v => Math.abs(v) > 2) || [ch.m1, ch.m2, ch.m3].some(v => Math.abs(v) > 3) || eu === 0 || !(vu > 0 && vu <= 40)) fails.push(`${at} challenge ${JSON.stringify(ch)}`);
      for (let i = 0; i < 3; i++) if (cs[i][i] < 3 || cs[i][i] > 5) fails.push(`${at} challenge diag`);
    });
    report(fails);
  });
});

// ---------- choice cards ----------
describe('GP-01 oracle: choice cards', () => {
  it('peak-height: exactly the smallest-determinant label is correct; the fourth option never is', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = pick(cards, 'peak-height'), Ms = matrices(c.prompt);
      if (Ms.length !== 3) { fails.push(`${at}: ${Ms.length} matrices`); return; }
      const dets = Ms.map(det), best = dets.indexOf(Math.min(...dets));
      if (dets.filter(d => Math.abs(d - dets[best]) < 1e-9).length !== 1) fails.push(`${at}: tie ${dets}`);
      if (c.choice!.answer !== best) fails.push(`${at}: answer ${c.choice!.answer} expected ${best} dets ${dets}`);
      const labels = ['Σ_P', 'Σ_Q', 'Σ_R'];
      [0, 1, 2].forEach(i => { if (c.choice!.options[i] !== labels[i]) fails.push(`${at}: option ${i} = ${c.choice!.options[i]}`); });
      const fourth = c.choice!.options[3];
      if (!(lang === 'en' ? /equal/.test(fourth) : /一样高/.test(fourth))) fails.push(`${at}: fourth option ${fourth}`);
      if (c.choice!.answer === 3) fails.push(`${at}: fourth option marked correct`);
      const diag = Ms.filter(m => m[0][1] === 0), corr = Ms.filter(m => m[0][1] !== 0);
      if (diag.length !== 2 || corr.length !== 1) fails.push(`${at}: roles`);
      else { const a = corr[0][0][0]; if (corr[0][1][1] !== a || !diag.some(m => m[0][0] === a && m[1][1] === a) || !diag.some(m => m[0][0] === a - 1 && m[1][1] === a - 1)) fails.push(`${at}: role values`); }
      if (c.choice!.options.some((o, i) => i !== c.choice!.answer && o.length < c.choice!.options[c.choice!.answer].length)) fails.push(`${at}: correct not shortest`);
    });
    report(fails);
  });

  it('marginal-pick: exactly one option matches the marginal (mean (mi,mj), covariance block); the others fail', () => {
    const fails: string[] = [];
    eachDeck((cards, _lang, at) => {
      const c = pick(cards, 'marginal-pick'), S = firstMat(c.prompt), m = mean3(c.prompt), d = dropIndex(c.prompt) - 1;
      if (new Set(m).size !== 3) fails.push(`${at}: means not distinct`);
      const keep = [0, 1, 2].filter(k => k !== d), B = mul(mul(selector(keep), S), transpose(selector(keep)));
      if (!isSymPD(S)) fails.push(`${at}: prompt Σ invalid`);
      if (B[0][1] === 0) fails.push(`${at}: kept covariance is zero`);
      const parsed = c.choice!.options.map(o => { const co = clean(o), mm = /N\(\((-?\d+), (-?\d+)\), /.exec(co); return { mean: mm ? [Number(mm[1]), Number(mm[2])] : [NaN, NaN], cov: matrices(co)[0] }; });
      const ok = parsed.map(q => q.mean[0] === m[keep[0]] && q.mean[1] === m[keep[1]] && !!q.cov && q.cov.every((r, i) => r.every((v, j) => v === B[i][j])));
      if (ok.filter(Boolean).length !== 1) fails.push(`${at}: ${ok.filter(Boolean).length} matching options`);
      if (!ok[c.choice!.answer]) fails.push(`${at}: marked option does not match`);
      if (new Set(c.choice!.options).size !== 4) fails.push(`${at}: duplicate options`);
      const lens = c.choice!.options.map(o => o.length), cl = lens[c.choice!.answer];
      if (lens.every((l, i) => i === c.choice!.answer || l < cl)) fails.push(`${at}: correct strictly longest`);
      const wrong = parsed.filter((_, i) => i !== c.choice!.answer);
      if (wrong.filter(q => q.cov[0][1] === 0).length < 1) fails.push(`${at}: the zero-covariance distractor is missing`);
    });
    report(fails);
  });

  it('sum-vs-diff: sign of the covariance decides the option', () => {
    const fails: string[] = [];
    const seen = new Set<string>();
    eachDeck((cards, lang, at) => {
      const c = pick(cards, 'sum-vs-diff'), S = firstMat(c.prompt), s = S[0][0], t = S[1][1], cc = S[0][1];
      const vs = s + t + 2 * cc, vd = s + t - 2 * cc;
      const want = vs > vd ? 'sum' : vs < vd ? 'diff' : 'eq';
      seen.add(want);
      const kindOf = (o: string) => (lang === 'en' ? (/equal/.test(o) ? 'eq' : /x₁ \+ x₂\) is/.test(o) ? 'sum' : /x₁ − x₂\) is/.test(o) ? 'diff' : '?') : (/相等/.test(o) ? 'eq' : /x₁ \+ x₂\)/.test(o) ? 'sum' : /x₁ − x₂\)/.test(o) ? 'diff' : '?'));
      const kinds = c.choice!.options.map(kindOf);
      if (kinds.filter(k => k === want).length !== 1 || [...kinds].sort().join() !== ['diff', 'eq', 'sum'].join()) fails.push(`${at}: kinds ${kinds} want ${want}`);
      if (kinds[c.choice!.answer] !== want) fails.push(`${at}: marked ${kinds[c.choice!.answer]} want ${want} Σ=${JSON.stringify(S)}`);
      if (cc * cc >= s * t) fails.push(`${at}: Σ not PD`);
      if (c.choice!.options.every((o, i) => i === c.choice!.answer || o.length < c.choice!.options[c.choice!.answer].length)) fails.push(`${at}: correct strictly longest`);
    });
    report(fails);
    expect(seen.has('sum') && seen.has('diff')).toBe(true);
  });

  it('validity: exactly the symmetric positive-definite matrix is correct (symmetry tested first)', () => {
    const fails: string[] = [];
    eachDeck((cards, _lang, at) => {
      const c = pick(cards, 'validity'), Ms = c.choice!.options.map(o => matrices(o)[0]);
      if (Ms.some(m => !m || m.length !== 2)) { fails.push(`${at}: unparsable options`); return; }
      const good = Ms.map(isSymPD);
      if (good.filter(Boolean).length !== 1) fails.push(`${at}: ${good.filter(Boolean).length} valid options ${JSON.stringify(Ms)}`);
      if (!good[c.choice!.answer]) fails.push(`${at}: marked option invalid`);
      const bad = Ms.filter((_, i) => !good[i]);
      const nonSym = bad.filter(m => m[0][1] !== m[1][0]).length, negDiag = bad.filter(m => m[0][1] === m[1][0] && (m[0][0] < 0 || m[1][1] < 0)).length;
      const negDet = bad.filter(m => m[0][1] === m[1][0] && m[0][0] > 0 && m[1][1] > 0).length;
      if (nonSym !== 1 || negDiag !== 1 || negDet !== 1) fails.push(`${at}: distractor types ${nonSym}/${negDiag}/${negDet}`);
      const strs = c.choice!.options, cl = strs[c.choice!.answer].length;
      if (strs.every((s, i) => i === c.choice!.answer || s.length < cl)) fails.push(`${at}: valid is strictly longest`);
    });
    report(fails);
  });
});

// ---------- match-contour ----------
function panelsOf(fig: Figure) {
  const centres: [number, number][] = [[-3.2, 3.2], [3.2, 3.2], [-3.2, -3.2], [3.2, -3.2]];
  return centres.map((ctr, k) => ({ ctr, sh: fig.shapes.slice(4 * k, 4 * k + 4) }));
}
describe('GP-01 oracle: match-contour figure', () => {
  it('exactly one panel satisfies p^T S^-1 p = 1 for the printed S, the others are off by >= 0.4; the answer index points to it', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = pick(cards, 'match-contour'), S = firstMat(c.prompt), fig = c.figure!;
      if (fig.shapes.length !== 16) { fails.push(`${at}: ${fig.shapes.length} shapes`); return; }
      if (c.choice!.options.length !== 4) fails.push(`${at}: options`);
      const Si = inverse2(S);
      const dev = panelsOf(fig).map(({ ctr, sh }, k) => {
        if (sh[2].kind !== 'line' || sh[0].kind !== 'line' || sh[1].kind !== 'line' || sh[3].kind !== 'text') { fails.push(`${at}: panel ${k} shape kinds`); return NaN; }
        const letter = 'ABCD'[k];
        if (sh[3].text !== letter) fails.push(`${at}: panel ${k} letter ${sh[3].text}`);
        if (Math.abs(sh[3].at[0] - (ctr[0] - 2.4)) > 1e-9 || Math.abs(sh[3].at[1] - (ctr[1] + 2.3)) > 1e-9) fails.push(`${at}: letter position`);
        const h = sh[0].points, v = sh[1].points;
        if (Math.abs(h[0][0] - (ctr[0] - 2.4)) > 1e-9 || Math.abs(h[1][0] - (ctr[0] + 2.4)) > 1e-9 || h[0][1] !== ctr[1] || Math.abs(v[0][1] - (ctr[1] - 2.4)) > 1e-9 || Math.abs(v[1][1] - (ctr[1] + 2.4)) > 1e-9 || v[0][0] !== ctr[0]) fails.push(`${at}: axes position`);
        const pts = sh[2].points;
        if (pts.length !== 73) fails.push(`${at}: ellipse has ${pts.length} points`);
        return Math.max(...pts.map(pt => { const x = pt[0] - ctr[0], y = pt[1] - ctr[1]; return Math.abs(x * (Si[0][0] * x + Si[0][1] * y) + y * (Si[1][0] * x + Si[1][1] * y) - 1); }));
      });
      const hits = dev.map((d, k) => (d < 1e-6 ? k : -1)).filter(k => k >= 0);
      if (hits.length !== 1) fails.push(`${at}: ${hits.length} matching panels, deviations ${dev.map(x => x.toFixed(3))}`);
      else {
        if (c.choice!.answer !== hits[0]) fails.push(`${at}: answer ${c.choice!.answer} but panel ${hits[0]} matches`);
        dev.forEach((d, k) => { if (k !== hits[0] && d < 0.4) fails.push(`${at}: wrong panel ${k} too close (${d.toFixed(3)})`); });
      }
      const letters = 'ABCD';
      c.choice!.options.forEach((o, i) => { if (o !== (lang === 'en' ? `Panel ${letters[i]}` : `图 ${letters[i]}`)) fails.push(`${at}: option ${i} "${o}"`); });
      // nothing in the figure marks the answer: all panels styled identically
      const tones = fig.shapes.map(s => String('tone' in s ? s.tone : '') + String('width' in s ? s.width : ''));
      for (let k = 1; k < 4; k++) if (tones.slice(4 * k, 4 * k + 4).join() !== tones.slice(0, 4).join()) fails.push(`${at}: panel ${k} styled differently from panel 0`);
      if (fig.shapes.some(s => s.kind === 'point' || s.kind === 'arrow' || s.kind === 'area' || ('label' in s && s.label))) fails.push(`${at}: extra marking shapes`);
      if (JSON.stringify(fig.view) !== JSON.stringify({ xmin: -6, xmax: 6, ymin: -6, ymax: 6 }) || fig.aspect !== 'equal') fails.push(`${at}: view/aspect`);
      const [[a, cv], [, b]] = S;
      if (![a, b].every(v => v >= 1 && v <= 4) || a === b || cv === 0 || Math.abs(cv) > 3 || cv * cv >= a * b || Math.abs(cv) / Math.sqrt(a * b) < 0.35) fails.push(`${at}: Σ out of plan ${JSON.stringify(S)}`);
    });
    report(fails);
  });

  it('role structure: the four panels are T, N (opposite tilt), S (variances swapped), Z (uncorrelated), and alt text describes each panel truly', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = pick(cards, 'match-contour'), S = firstMat(c.prompt), fig = c.figure!;
      const [[a, cv], [, b]] = S;
      const sigmas = panelsOf(fig).map(({ ctr, sh }) => {
        const pts = (sh[2] as unknown as { points: [number, number][] }).points.slice(0, 72).map(p => [p[0] - ctr[0], p[1] - ctr[1]]);
        return [0, 1].map(i => [0, 1].map(j => pts.reduce((s, p) => s + p[i] * p[j], 0) / 36));
      });
      const same = (x: M, y: M) => x.every((r, i) => r.every((v, j) => Math.abs(v - y[i][j]) < 1e-9));
      const expect4: M[] = [S, [[a, -cv], [-cv, b]], [[b, cv], [cv, a]], [[a, 0], [0, b]]];
      const used = expect4.map(e => sigmas.findIndex(s => same(s, e)));
      if (used.some(u => u < 0) || new Set(used).size !== 4) fails.push(`${at}: roles ${used}`);
      const alt = fig.alt;
      sigmas.forEach((s, k) => {
        const L = 'ABCD'[k], seg = lang === 'en' ? new RegExp(`Panel ${L}: ([^.]*)\\.`).exec(alt) : new RegExp(`图 ${L}：([^。]*)。`).exec(alt);
        if (!seg) { fails.push(`${at}: alt lacks panel ${L}`); return; }
        const t = seg[1];
        const wide = s[0][0] > s[1][1];
        const tilt = Math.abs(s[0][1]) < 1e-9 ? 0 : s[0][1] > 0 ? 1 : -1;
        const okReach = lang === 'en' ? (wide ? /further left-right than up-down/ : /further up-down than left-right/).test(t) : (wide ? /左右方向伸得比上下方向远/ : /上下方向伸得比左右方向远/).test(t);
        const okTilt = lang === 'en' ? (tilt === 1 ? /tilted up to the right/ : tilt === -1 ? /tilted down to the right/ : /not tilted/).test(t) : (tilt === 1 ? /向右上方倾斜/ : tilt === -1 ? /向右下方倾斜/ : /不倾斜/).test(t);
        if (!okReach || !okTilt) fails.push(`${at}: alt panel ${L} "${t}" vs Σ=${JSON.stringify(s)}`);
      });
    });
    report(fails);
  });
});

describe('GP-01 oracle: hints do not give the answer', () => {
  it('no numeric card hint contains its answer unless that number is printed in the prompt', () => {
    const fails: string[] = [];
    eachDeck((cards, _l, at) => {
      for (const c of cards) {
        if (!c.fields) continue;
        // equation / page citations such as 'eq. 16', 'p. 54', '式 16', '第 52 页' are not answers
        const tx = c.hint.replaceAll('−', '-').replace(/(eq\.|p\.|pp\.|式)\s*\d+(\s*and\s*\d+)?/g, '').replace(/第\s*\d+\s*页/g, ''), printed = nums(c.prompt); // subscripts stay letters-with-subscripts here: Σ₁₂ is not the number 12
        for (const f of c.fields) {
          const s = String(f.answer);
          if (Math.abs(f.answer) >= 2 && !printed.includes(f.answer) && new RegExp(`(?<![\\d.])${s}(?![\\d.])`).test(tx)) fails.push(`${at} ${c.id}: hint reveals ${s}`);
        }
      }
    });
    report(fails);
  });
});

describe('GP-01 oracle: learner-facing text hygiene', () => {
  it('subscripts are real subscripts, minus signs are U+2212, explanations state the answer, no leftovers', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      for (const c of cards) {
        const texts = [c.title, c.prompt, c.hint, c.explanation, ...(c.choice?.options ?? []), c.figure?.alt ?? ''];
        for (const tx of texts) {
          if (/(?<![A-Za-z])x\d/.test(tx)) fails.push(`${at} ${c.id}: ASCII-digit variable in "${tx.slice(0, 60)}"`);
          if (/(^|[\s(=,])-\d/.test(tx) || /\d\s-\s\d/.test(tx)) fails.push(`${at} ${c.id}: ASCII hyphen minus in "${tx.slice(0, 80)}"`);
          if (/undefined|NaN|\{|\}|\^/.test(tx)) fails.push(`${at} ${c.id}: leftover`);
          if (/[−+]\s*[−]\s*\d|\+\s*\+/.test(tx)) fails.push(`${at} ${c.id}: double sign`);
          if (/(?<![\w(])1[xΣ]/.test(tx)) fails.push(`${at} ${c.id}: 1 before a letter`);
          if (lang === 'zh' && /\b(and|or|the|is|are|Panel|Give)\b/.test(tx)) fails.push(`${at} ${c.id}: English word in ZH`);
        }
        if (c.fields) c.fields.forEach(f => {
          const s = (f.answer < 0 ? '−' : '') + toFraction(Math.abs(f.answer));
          if (!c.explanation.includes(`= ${s}`)) fails.push(`${at} ${c.id}: explanation lacks "= ${s}"`);
        });
        // a fraction restated as itself ("ρ = 1/6 = 1/6") is noise
        const taut = /(−?\d+\/\d+) = (?![\d/])/.exec(c.explanation);
        if (taut) fails.push(`${at} ${c.id}: tautology "${taut[0]}"`);
      }
    });
    report(fails);
  });
  it('the contour ellipses are closed curves', () => {
    const fails: string[] = [];
    eachDeck((cards, _l, at) => {
      for (const s of pick(cards, 'match-contour').figure!.shapes) if (s.kind === 'line' && s.points.length === 73) {
        const a = s.points[0], b = s.points[72];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-9) fails.push(`${at}: ellipse not closed`);
      }
    });
    report(fails);
  });
  it('challenge explanation lists exactly the cross terms with both coefficients non-zero', () => {
    const fails: string[] = [];
    eachDeck((cards, _l, at) => {
      const c = pick(cards, 'challenge'), p = c.audit!.params as P, a = [p.a1, p.a2, p.a3], S = sym3(p);
      const expected: number[] = [];
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (a[i] !== 0 && a[j] !== 0) expected.push(a[i] * a[j] * S[i][j]);
      const m = /(?:cross terms give|交叉项为) 2·\((.*?)\) = (-?\d+)/.exec(clean(c.explanation));
      if (!m) { fails.push(`${at}: no cross-term sentence`); return; }
      const listed = nums(m[1].replace(/[()]/g, ' ').replace(/\+/g, ' ').replace(/(\d)\s*-/g, '$1 -'));
      if (listed.join() !== expected.join()) fails.push(`${at}: listed ${listed} expected ${expected}`);
      if (Number(m[2]) !== 2 * expected.reduce((x, y) => x + y, 0)) fails.push(`${at}: cross sum ${m[2]}`);
    });
    report(fails);
  });
});

describe('GP-01 oracle: variety', () => {
  it('every card has >= 6 distinct prompts over 60 seeds (EN)', () => {
    const sets: Record<string, Set<string>> = {};
    for (let i = 0; i < SEEDS; i++) for (const c of gp01(seedAt(i), 'en')) (sets[c.id] ??= new Set()).add(c.prompt + JSON.stringify(c.choice?.options ?? []));
    const low = Object.entries(sets).filter(([, s]) => s.size < 6).map(([id, s]) => `${id}: ${s.size}`);
    expect(low).toEqual([]);
  });
});
