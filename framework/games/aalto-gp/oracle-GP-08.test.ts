import { describe, expect, it } from 'vitest';
import { gp08 } from './games/gp08';
import { spreadSeed, questionTextOf, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';

/**
 * Independent oracle for GP-08 (common covariance functions).
 * Written from docs/aalto-gp-drafts/approved-GP-08.md only, BEFORE the generator source was opened.
 * Numeric answers: exact Fraction arithmetic AND doubles (ln, 2x2 determinant). Sampling spaces: the plan's enumerated tuple lists, rebuilt here exactly.
 */
const SEEDS = 60;
type Lang = 'en' | 'zh';
const LANGS: Lang[] = ['en', 'zh'];
const slug = (s: string) => `GP-08-${s}`;
const SLUGS = ['se-exponent', 'se-compare', 'rq-value', 'periodic-exponent', 'periodic-repeat', 'stationary-test', 'matern-smoothest', 'rq-limit', 'challenge'];
const KINDS = ['GP-08:se-exponent', 'GP-08:rq-value', 'GP-08:periodic-exponent', 'GP-08:challenge'];

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
type Fr = [number, number]; // reduced, positive denominator
const fr = (n: number, d = 1): Fr => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return [s * n / g, s * d / g]; };
const add = (a: Fr, b: Fr): Fr => fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const sub = (a: Fr, b: Fr): Fr => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a: Fr, b: Fr): Fr => fr(a[0] * b[0], a[1] * b[1]);
const div = (a: Fr, b: Fr): Fr => fr(a[0] * b[1], a[1] * b[0]);
const pow = (a: Fr, n: number): Fr => { let r = fr(1); for (let i = 0; i < n; i++) r = mul(r, a); return r; };
const val = (a: Fr) => a[0] / a[1];

const clean = (t: string) => t.replaceAll('−', '-');
const num = (text: string, symbol: string): number => {
  const m = clean(text).match(new RegExp(`${symbol} = (-?\\d+)`));
  if (!m) throw new Error(`no "${symbol} = n" in: ${text}`);
  return Number(m[1]);
};
const cardOf = (cards: PracticeCard[], s: string) => {
  const c = cards.find(x => x.id === slug(s));
  if (!c) throw new Error(`card ${slug(s)} missing`);
  return c;
};
const eachDeck = (fn: (cards: PracticeCard[], lang: Lang, at: string, i: number) => void) => {
  for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) fn(gp08(spreadSeed(i), lang), lang, `seed ${spreadSeed(i)} ${lang}`, i);
};
const report = (fails: string[]) => expect(fails.length ? [`${fails.length} failures`, ...fails.slice(0, 25)] : []).toEqual([]);
const fmtDecimal = (v: number) => v.toFixed(2);
const fmtFrac = (f: Fr) => (f[1] === 1 ? `${f[0]}` : `${f[0]}/${f[1]}`);

/** grading contract: accepted answer correct, reduced fraction correct, 2-place decimal correct, +-0.007 wrong. */
function gradeProblems(card: PracticeCard, exact: Fr, at: string): string[] {
  const out: string[] = [];
  const f = card.fields![0];
  if (f.tolerance !== 0.006) out.push(`${at} ${card.id}: tolerance ${f.tolerance}`);
  const v = val(exact);
  if (Math.abs(f.answer - v) > 1e-9) out.push(`${at} ${card.id}: answer ${f.answer} vs exact ${fmtFrac(exact)}`);
  const g = (s: string) => gradeCard(card, [s], null, []);
  if (g(fmtFrac(exact)) !== 'correct') out.push(`${at} ${card.id}: fraction ${fmtFrac(exact)} not accepted`);
  if (g(fmtDecimal(v)) !== 'correct') out.push(`${at} ${card.id}: decimal ${fmtDecimal(v)} not accepted`);
  if (g(String(v + 0.007)) !== 'incorrect') out.push(`${at} ${card.id}: +0.007 accepted`);
  if (g(String(v - 0.007)) !== 'incorrect') out.push(`${at} ${card.id}: -0.007 accepted`);
  if (g(String(v + 0.004)) !== 'correct') out.push(`${at} ${card.id}: +0.004 rejected`);
  return out;
}

// ---------- the plan's enumerated sampling spaces (exact) ----------
const DEN_SE = [1, 2, 4, 8], DEN_NUM = [1, 2, 4, 5, 8, 10], DEN_CH = [1, 2];
const far = (a: number, routes: number[], t: number) => routes.every(r => Math.abs(r - t) >= 0.02);

type SeTuple = { ell: number; x1: number; x2: number };
const SE_SPACE = new Map<string, SeTuple>();
for (const ell of [2, 3, 4]) for (let x1 = -6; x1 <= 6; x1++) for (let x2 = -6; x2 <= 6; x2++) {
  const r = Math.abs(x1 - x2); if (r < 1) continue;
  const e = fr(-r * r, 2 * ell * ell);
  if (!DEN_SE.includes(e[1])) continue;
  const t = val(e);
  if (!far(0, [-r * r / ell ** 2, -r / (2 * ell ** 2), -r * r / (2 * ell), -r * r / 2, r * r / (2 * ell ** 2)], t)) continue;
  SE_SPACE.set(`${ell},${x1},${x2}`, { ell, x1, x2 });
}
type RqT = { alpha: number; beta: number; ell: number; r: number };
const rqK = (t: RqT): Fr => { const q = add(fr(1), fr(t.r * t.r, 2 * t.beta * t.ell * t.ell)); return div(fr(t.alpha), pow(q, t.beta)); };
const RQ_SPACE = new Map<string, RqT>();
for (let alpha = 1; alpha <= 36; alpha++) for (const beta of [1, 2, 3]) for (let ell = 1; ell <= 4; ell++) for (let r = 1; r <= 8; r++) {
  const t = { alpha, beta, ell, r };
  const k = rqK(t); if (!DEN_NUM.includes(k[1])) continue;
  const q = 1 + r * r / (2 * beta * ell * ell);
  const routes = [alpha * q ** beta, alpha / (1 + r * r / (2 * ell * ell)) ** beta, alpha / (1 + r / (2 * beta * ell * ell)) ** beta, alpha / (1 + r * r / (2 * beta * ell)) ** beta, alpha / q];
  const use = [true, beta >= 2, true, true, beta >= 2];
  if (!far(0, routes.filter((_, i) => use[i]), val(k))) continue;
  RQ_SPACE.set(`${alpha},${beta},${ell},${r}`, t);
}
// sin^2(pi * frac) table of the plan, keyed by numerator/denominator of (r mod P)/P
const SIN2: Record<string, Fr> = { '1/6': fr(1, 4), '1/4': fr(1, 2), '1/3': fr(3, 4), '1/2': fr(1), '2/3': fr(3, 4), '3/4': fr(1, 2), '5/6': fr(1, 4) };
type PerT = { P: number; ell: number; r: number };
const perS = (t: PerT): Fr | null => { const f = fr(t.r % t.P, t.P); return SIN2[`${f[0]}/${f[1]}`] ?? null; };
const PER_SPACE = new Map<string, PerT>();
for (const P of [4, 6, 12]) for (const ell of [1, 2]) for (let r = 1; r <= 24; r++) {
  const s = perS({ P, ell, r }); if (!s) continue;
  const e = mul(fr(-2, ell * ell), s);
  if (!DEN_SE.includes(e[1])) continue;
  const sv = val(s), t = val(e);
  if (!far(0, [-(2 / ell ** 2) * Math.sqrt(sv), 0, -2 * (r / P) ** 2 / ell ** 2, -sv / ell ** 2, 2 * sv / ell ** 2], t)) continue;
  PER_SPACE.set(`${P},${ell},${r}`, { P, ell, r });
}
const chAnswer = (t: RqT): Fr => { const k = rqK(t); return sub(fr(t.alpha * t.alpha), mul(k, k)); };
const CH_SPACE = new Map<string, RqT>();
for (let alpha = 1; alpha <= 36; alpha++) for (const beta of [1, 2]) for (let ell = 1; ell <= 4; ell++) for (let r = 1; r <= 8; r++) {
  const t = { alpha, beta, ell, r };
  const k = rqK(t); if (!DEN_CH.includes(k[1]) || val(k) < 1) continue;
  const ans = chAnswer(t); if (!DEN_NUM.includes(ans[1])) continue;
  const kv = val(k), q = 1 + r * r / (2 * beta * ell * ell), a2 = alpha * alpha;
  const ws = [alpha * q ** beta, ...(beta >= 2 ? [alpha / (1 + r * r / (2 * ell * ell)) ** beta] : []), alpha / (1 + r / (2 * beta * ell * ell)) ** beta, alpha / (1 + r * r / (2 * beta * ell)) ** beta, ...(beta >= 2 ? [alpha / q] : [])];
  const routes = [...ws.map(w => a2 - w * w), a2 - kv, a2, kv * kv - a2, a2 - alpha * kv];
  if (!far(0, routes, val(ans))) continue;
  CH_SPACE.set(`${alpha},${beta},${ell},${r}`, t);
}

describe('GP-08 plan sampling spaces (self-check of the oracle enumeration)', () => {
  it('match the plan counts', () => {
    expect(PER_SPACE.size).toBe(80);
    expect(RQ_SPACE.size).toBe(237);
    expect(CH_SPACE.size).toBe(140);
    // plan: 248 (ell, x1, x2) triples
    expect(SE_SPACE.size).toBe(248);
    let cmp = 0;
    for (let S = -4; S <= 8; S++) for (let dA = 1; dA <= 8; dA++) for (let dB = 1; dB <= 8; dB++) {
      if (dA === dB || (S - dA) % 2 || (S - dB) % 2) continue;
      if ([(S - dA) / 2, (S + dA) / 2, (S - dB) / 2, (S + dB) / 2].every(p => p >= -6 && p <= 8)) cmp++;
    }
    expect(cmp).toBe(156);
  });
});

describe('GP-08 deck structure', () => {
  it('9 cards in the planned order, same ids EN/ZH, no figures, audit kinds exactly the four planned', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      if (JSON.stringify(cards.map(c => c.id)) !== JSON.stringify(SLUGS.map(slug))) fails.push(`${at}: ids ${cards.map(c => c.id)}`);
      const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
      if (JSON.stringify(kinds) !== JSON.stringify([...KINDS].sort())) fails.push(`${at}: kinds ${kinds}`);
      for (const c of cards) {
        if (c.figure || c.choice?.figures) fails.push(`${at} ${c.id}: has a figure`);
        if (c.slots) fails.push(`${at} ${c.id}: has slots`);
        if (c.choice && c.audit) fails.push(`${at} ${c.id}: choice with audit`);
        if (c.choice && c.choice.options.length !== 4) fails.push(`${at} ${c.id}: ${c.choice.options.length} options`);
      }
      for (const s of ['se-exponent', 'rq-value', 'periodic-exponent', 'challenge']) if (!cardOf(cards, s).fields) fails.push(`${at} ${s}: no field`);
    });
    report(fails);
  });
  it('EN and ZH decks carry the same audit and answers', () => {
    const fails: string[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const en = gp08(spreadSeed(i), 'en'), zh = gp08(spreadSeed(i), 'zh');
      en.forEach((c, k) => {
        if (JSON.stringify(c.audit) !== JSON.stringify(zh[k].audit)) fails.push(`seed ${i} ${c.id}: audit differs`);
        if (JSON.stringify(c.fields?.map(f => [f.answer, f.tolerance])) !== JSON.stringify(zh[k].fields?.map(f => [f.answer, f.tolerance]))) fails.push(`seed ${i} ${c.id}: answers differ`);
        if (c.choice?.answer !== zh[k].choice?.answer) fails.push(`seed ${i} ${c.id}: choice index differs`);
      });
    }
    report(fails);
  });
});

describe('GP-08 numeric cards', () => {
  it('se-exponent: exact fraction + log route, sampling space, printed = audit, wrong routes graded wrong', () => {
    const fails: string[] = [];
    const seen = new Set<number>();
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'se-exponent');
      const p = c.audit!.params as Record<string, number>;
      const { alpha, ell, x1, x2 } = p;
      if (JSON.stringify(Object.keys(p).sort()) !== JSON.stringify(['alpha', 'ell', 'x1', 'x2'])) fails.push(`${at}: params ${Object.keys(p)}`);
      for (const [k, v] of Object.entries({ alpha, ell, x1, x2 })) if (num(c.prompt, k === 'alpha' ? 'α' : k === 'ell' ? 'ℓ' : k === 'x1' ? 'x₁' : 'x₂') !== v) fails.push(`${at}: printed ${k} != ${v}`);
      if (![2, 3, 5, 7].includes(alpha)) fails.push(`${at}: alpha ${alpha}`);
      if (!SE_SPACE.has(`${ell},${x1},${x2}`)) fails.push(`${at}: (ell,x1,x2)=(${ell},${x1},${x2}) outside plan space`);
      const r = Math.abs(x1 - x2);
      const exact = fr(-r * r, 2 * ell * ell);
      // independent route: ln of the kernel value in doubles
      const kv = alpha * Math.exp(-((x1 - x2) ** 2) / (2 * ell ** 2));
      const viaLog = Math.log(kv / alpha), viaLog2 = Math.log(kv) - Math.log(alpha);
      if (Math.abs(viaLog - c.fields![0].answer) > 1e-9 || Math.abs(viaLog2 - c.fields![0].answer) > 1e-9) fails.push(`${at}: log route ${viaLog} vs ${c.fields![0].answer}`);
      fails.push(...gradeProblems(c, exact, at));
      for (const w of [-r * r / ell ** 2, -r / (2 * ell ** 2), -r * r / (2 * ell), -r * r / 2, r * r / (2 * ell ** 2)])
        if (gradeCard(c, [String(w)], null, []) !== 'incorrect') fails.push(`${at}: wrong route ${w} graded correct`);
      if (lang === 'en') seen.add(alpha);
    });
    report(fails);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('rq-value: exact Fraction + double route, space of 237, printed = audit', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'rq-value');
      const { alpha, beta, ell, x1, x2 } = c.audit!.params as Record<string, number>;
      if (num(c.prompt, 'α') !== alpha || num(c.prompt, 'β') !== beta || num(c.prompt, 'ℓ') !== ell || num(c.prompt, 'x₁') !== x1 || num(c.prompt, 'x₂') !== x2) fails.push(`${at}: printed != audit`);
      const r = Math.abs(x1 - x2);
      if (!RQ_SPACE.has(`${alpha},${beta},${ell},${r}`)) fails.push(`${at}: (alpha,beta,ell,r)=(${alpha},${beta},${ell},${r}) outside plan space`);
      if (Math.min(x1, x2) < -8 || Math.max(x1, x2) > 8) fails.push(`${at}: x outside [-8,8]`);
      const exact = rqK({ alpha, beta, ell, r });
      const dbl = alpha * (1 + r ** 2 / (2 * beta * ell ** 2)) ** (-beta);
      if (Math.abs(dbl - c.fields![0].answer) > 1e-9) fails.push(`${at}: double ${dbl} vs ${c.fields![0].answer}`);
      fails.push(...gradeProblems(c, exact, at));
      const q = 1 + r * r / (2 * beta * ell * ell);
      for (const w of [alpha * q ** beta, alpha / (1 + r * r / (2 * ell * ell)) ** beta, alpha / (1 + r / (2 * beta * ell * ell)) ** beta, alpha / (1 + r * r / (2 * beta * ell)) ** beta, alpha / q]) {
        if (Math.abs(w - dbl) < 0.02) { if (!(beta === 1 && (w === alpha / q || Math.abs(w - alpha / (1 + r * r / (2 * ell * ell)) ** beta) < 1e-12))) fails.push(`${at}: route ${w} collides with truth ${dbl}`); }
        else if (gradeCard(c, [String(w)], null, []) !== 'incorrect') fails.push(`${at}: wrong route ${w} graded correct`);
      }
    });
    report(fails);
  });

  it('periodic-exponent: table + sin^2 doubles route, space of 80, printed = audit', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'periodic-exponent');
      const { alpha, ell, P, x1, x2 } = c.audit!.params as Record<string, number>;
      if (num(c.prompt, 'α') !== alpha || num(c.prompt, 'ℓ') !== ell || num(c.prompt, 'P') !== P || num(c.prompt, 'x₁') !== x1 || num(c.prompt, 'x₂') !== x2) fails.push(`${at}: printed != audit`);
      if (![2, 3, 5, 7].includes(alpha)) fails.push(`${at}: alpha ${alpha}`);
      const r = Math.abs(x1 - x2);
      if (!PER_SPACE.has(`${P},${ell},${r}`)) fails.push(`${at}: (P,ell,r)=(${P},${ell},${r}) outside plan space`);
      if (Math.min(x1, x2) < -12 || Math.max(x1, x2) > 12) fails.push(`${at}: x outside [-12,12]`);
      if (x1 < -12 || x1 > 12) fails.push(`${at}: x1 outside [-12,12]`); // plan says x1 in [-10,10] but r = 23 (P = 4, 6) is then unplaceable in [-12,12]
      const s = perS({ P, ell, r });
      if (!s) { fails.push(`${at}: r/P not in table`); return; }
      const exact = mul(fr(-2, ell * ell), s);
      const dbl = -(2 / ell ** 2) * Math.sin(Math.PI * r / P) ** 2;
      if (Math.abs(Math.sin(Math.PI * r / P) ** 2 - val(s)) > 1e-12) fails.push(`${at}: table s ${fmtFrac(s)} vs double`);
      if (Math.abs(dbl - c.fields![0].answer) > 1e-9) fails.push(`${at}: double ${dbl} vs ${c.fields![0].answer}`);
      fails.push(...gradeProblems(c, exact, at));
      const sv = val(s);
      for (const w of [-(2 / ell ** 2) * Math.sqrt(sv), 0, -2 * (r / P) ** 2 / ell ** 2, -sv / ell ** 2, 2 * sv / ell ** 2])
        if (gradeCard(c, [String(w)], null, []) !== 'incorrect') fails.push(`${at}: wrong route ${w} graded correct (truth ${dbl})`);
    });
    report(fails);
  });

  it('challenge: dense 2x2 determinant, space of 140, new numbers vs rq-value', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'challenge');
      const { alpha, beta, ell, x1, x2 } = c.audit!.params as Record<string, number>;
      if (num(c.prompt, 'α') !== alpha || num(c.prompt, 'β') !== beta || num(c.prompt, 'ℓ') !== ell || num(c.prompt, 'x₁') !== x1 || num(c.prompt, 'x₂') !== x2) fails.push(`${at}: printed != audit`);
      const r = Math.abs(x1 - x2);
      if (!CH_SPACE.has(`${alpha},${beta},${ell},${r}`)) fails.push(`${at}: (alpha,beta,ell,r)=(${alpha},${beta},${ell},${r}) outside plan space`);
      if (Math.min(x1, x2) < -8 || Math.max(x1, x2) > 8) fails.push(`${at}: x outside [-8,8]`);
      const kern = (a: number, b: number) => alpha * (1 + (a - b) ** 2 / (2 * beta * ell ** 2)) ** (-beta);
      const K = [[kern(x1, x1), kern(x1, x2)], [kern(x2, x1), kern(x2, x2)]];
      const det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
      if (Math.abs(det - c.fields![0].answer) > 1e-9) fails.push(`${at}: det ${det} vs ${c.fields![0].answer}`);
      fails.push(...gradeProblems(c, chAnswer({ alpha, beta, ell, r }), at));
      const rq = cardOf(cards, 'rq-value').audit!.params as Record<string, number>;
      const r3 = Math.abs(rq.x1 - rq.x2);
      if (rq.alpha === alpha) fails.push(`${at}: alpha equals card 3`);
      if (rq.beta === beta && rq.ell === ell && r3 === r) fails.push(`${at}: (beta,ell,r) equals card 3`);
      const kv = kern(x1, x2), q = 1 + r * r / (2 * beta * ell * ell), a2 = alpha * alpha;
      const ws = [alpha * q ** beta, alpha / (1 + r * r / (2 * ell * ell)) ** beta, alpha / (1 + r / (2 * beta * ell * ell)) ** beta, alpha / (1 + r * r / (2 * beta * ell)) ** beta, alpha / q];
      const wrong = [...ws.map(w => a2 - w * w), a2 - kv, a2, kv * kv - a2, a2 - alpha * kv];
      // for beta = 1 two of the k-routes coincide with the truth (not wrong routes there)
      const skip = beta === 1 ? [1, 4] : [];
      wrong.forEach((w, i) => {
        if (skip.includes(i)) return;
        if (Math.abs(w - det) < 0.02) fails.push(`${at}: wrong route #${i} ${w} collides with truth ${det}`);
        else if (gradeCard(c, [String(w)], null, []) !== 'incorrect') fails.push(`${at}: wrong route #${i} graded correct`);
      });
    });
    report(fails);
  });
});

// ---------- choice cards ----------
const longestIdx = (opts: string[]) => { const m = Math.max(...opts.map(o => o.length)); return opts.map((o, i) => (o.length === m ? i : -1)).filter(i => i >= 0); };
const notLongest = (c: PracticeCard, at: string, fails: string[]) => {
  const L = longestIdx(c.choice!.options);
  if (L.length === c.choice!.options.length) return; // all equal length (matern)
  if (L.includes(c.choice!.answer)) fails.push(`${at} ${c.id}: correct option is (one of) the longest`);
};

describe('GP-08 choice cards', () => {
  it('se-compare: smaller gap wins, shared midpoint, space per plan', () => {
    const fails: string[] = [];
    const labels = new Set<string>(), orders = new Set<string>();
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'se-compare');
      const alpha = num(c.prompt, 'α'), ell = num(c.prompt, 'ℓ');
      const pairs = [...clean(c.prompt).matchAll(/\((-?\d+), (-?\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
      if (pairs.length !== 2) { fails.push(`${at}: ${pairs.length} pairs`); return; }
      const [[a1, a2], [b1, b2]] = pairs;
      if (![1, 2, 3, 5].includes(alpha) || ![1, 2, 3, 4].includes(ell)) fails.push(`${at}: alpha/ell ${alpha}/${ell}`);
      const dA = Math.abs(a1 - a2), dB = Math.abs(b1 - b2);
      if (a1 + a2 !== b1 + b2) fails.push(`${at}: midpoints differ`);
      if (dA === dB || dA < 1 || dB < 1 || dA > 8 || dB > 8) fails.push(`${at}: gaps ${dA},${dB}`);
      const S = a1 + a2;
      if (S < -4 || S > 8) fails.push(`${at}: S ${S}`);
      if ((dA - S) % 2 !== 0 || (dB - S) % 2 !== 0) fails.push(`${at}: parity`);
      if ([a1, a2, b1, b2].some(v => v < -6 || v > 8)) fails.push(`${at}: points out of [-6,8]`);
      const kA = alpha * Math.exp(-((a1 - a2) ** 2) / (2 * ell * ell)), kB = alpha * Math.exp(-((b1 - b2) ** 2) / (2 * ell * ell));
      const want = kA > kB ? 'A' : 'B';
      const re = lang === 'en' ? /^Pair ([AB]) has the larger covariance\.$/ : /^([AB]) 对的协方差更大。$/;
      const hits = c.choice!.options.map((o, i) => { const m = o.match(re); return m && m[1] === want ? i : -1; }).filter(i => i >= 0);
      if (hits.length !== 1 || hits[0] !== c.choice!.answer) fails.push(`${at}: hits ${hits} answer ${c.choice!.answer} want ${want}`);
      const other = c.choice!.options.filter(o => re.test(o)).length;
      if (other !== 2) fails.push(`${at}: expected both pair sentences, got ${other}`);
      notLongest(c, at, fails);
      if (gradeCard(c, [], c.choice!.answer, []) !== 'correct') fails.push(`${at}: grade`);
      labels.add(want); orders.add(`${a1 > a2}`);
    });
    report(fails);
    expect(labels.size).toBe(2);
    expect(orders.size).toBe(2);
  });

  it('periodic-repeat: value is alpha, four distinct values alpha, 0, -alpha, alpha/2', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'periodic-repeat');
      const alpha = num(c.prompt, 'α'), ell = num(c.prompt, 'ℓ'), P = num(c.prompt, 'P'), x1 = num(c.prompt, 'x₁'), x2 = num(c.prompt, 'x₂');
      const n = Number(clean(c.prompt).match(lang === 'en' ? /gap is (\d+) whole/ : /恰为 (\d+) 个整周期/)![1]);
      if (![2, 4, 6, 8].includes(alpha) || ![1, 2, 3].includes(ell) || ![2, 3, 4, 5].includes(P) || ![1, 2, 3].includes(n)) fails.push(`${at}: params`);
      if (x1 < -3 || x1 > 3) fails.push(`${at}: x1 ${x1}`);
      if (Math.abs(x1 - x2) !== n * P) fails.push(`${at}: gap ${Math.abs(x1 - x2)} != ${n}*${P}`);
      const k = alpha * Math.exp(-(2 / ell ** 2) * Math.sin(Math.PI * Math.abs(x1 - x2) / P) ** 2);
      const vals = c.choice!.options.map(o => { const m = clean(o).match(/^k = (-?\d+)$/); return m ? Number(m[1]) : NaN; });
      if (vals.some(Number.isNaN)) { fails.push(`${at}: option format ${c.choice!.options}`); return; }
      if (JSON.stringify([...vals].sort((a, b) => a - b)) !== JSON.stringify([-alpha, 0, alpha / 2, alpha].sort((a, b) => a - b))) fails.push(`${at}: values ${vals}`);
      const ok = vals.map(v => Math.abs(v - k) < 1e-9);
      if (ok.filter(Boolean).length !== 1 || !ok[c.choice!.answer]) fails.push(`${at}: answer idx ${c.choice!.answer} vals ${vals} k ${k}`);
      notLongest(c, at, fails);
    });
    report(fails);
  });

  it('stationary-test: exactly one option uses x1/x2 outside r = |x1 - x2|; variants and parameter ranges per plan', () => {
    const fails: string[] = [];
    const variants = new Set<string>();
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'stationary-test');
      const opts = c.choice!.options;
      const usesXs = (o: string) => /x₁|x₂/.test(o);
      const hits = opts.map((o, i) => (usesXs(o) ? i : -1)).filter(i => i >= 0);
      if (hits.length !== 1 || hits[0] !== c.choice!.answer) fails.push(`${at}: x-dependent options ${hits} answer ${c.choice!.answer}`);
      const nonst = opts[c.choice!.answer];
      const m1 = nonst.match(/^k = x₁x₂$/), m2 = nonst.match(/^k = (\d+)·x₁x₂$|^k = (\d+) x₁x₂$/), m3 = nonst.match(/^k = x₁x₂ \+ (\d+)$/);
      if (m1) variants.add('plain');
      else if (m2) { variants.add('scaled'); if (![2, 3, 5].includes(Number(m2[1] ?? m2[2]))) fails.push(`${at}: c0 ${nonst}`); }
      else if (m3) { variants.add('shifted'); if (![1, 2, 3].includes(Number(m3[1]))) fails.push(`${at}: c0 ${nonst}`); }
      else fails.push(`${at}: unknown non-stationary option "${nonst}"`);
      const rest = opts.filter((_, i) => i !== c.choice!.answer).map(clean);
      const se = rest.filter(o => /exp\(-r²\/\(2·\d+²\)\)$/.test(o)), per = rest.filter(o => /sin²/.test(o)), rq = rest.filter(o => /\(1 \+ r²/.test(o));
      if (se.length !== 1 || per.length !== 1 || rq.length !== 1) { fails.push(`${at}: kernel families ${rest}`); return; }
      const ps = se[0].match(/^k = (\d+) exp\(-r²\/\(2·(\d+)²\)\)$/);
      if (!ps || ![1, 2, 3].includes(Number(ps[1])) || ![1, 2, 3].includes(Number(ps[2]))) fails.push(`${at}: SE ${se[0]}`);
      const pr = rq[0].match(/^k = (\d+) \(1 \+ r²\/\(2·(\d+)·(\d+)²\)\)/);
      if (!pr || ![1, 2, 3].includes(Number(pr[1])) || ![2, 3].includes(Number(pr[2])) || ![1, 2, 3].includes(Number(pr[3]))) fails.push(`${at}: RQ ${rq[0]}`);
      else if (!clean(rq[0]).includes(lang === 'en' ? `to the power -${pr[2]}` : `的 -${pr[2]} 次幂`)) fails.push(`${at}: RQ power != beta ${rq[0]}`);
      const pp = per[0].match(/^k = (\d+) exp\(-\(2\/(\d+)²\) sin²\(π r\/(\d+)\)\)$/);
      if (!pp || ![1, 2, 3].includes(Number(pp[1])) || ![1, 2].includes(Number(pp[2])) || ![2, 3, 4].includes(Number(pp[3]))) fails.push(`${at}: periodic ${per[0]}`);
      // shift test on the non-stationary option by evaluating it
      const f = (x1: number, x2: number) => { if (m1) return x1 * x2; if (m2) return Number(m2[1] ?? m2[2]) * x1 * x2; if (m3) return x1 * x2 + Number(m3[1]); return NaN; };
      if (f(0, 1) === f(1, 2) || f(0, 1) === f(-3, -2)) fails.push(`${at}: shift does not change the option`);
      notLongest(c, at, fails);
      const L = longestIdx(opts); const shortest = Math.min(...opts.map(o => o.length));
      if (nonst.length !== shortest) fails.push(`${at}: correct option not the shortest (${lang})`);
      void L;
    });
    report(fails);
    expect([...variants].sort()).toEqual(['plain', 'scaled', 'shifted']);
  });

  it('matern-smoothest: unique max nu, neither max alpha nor max ell', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'matern-smoothest');
      const T = c.choice!.options.map(o => { const m = clean(o).match(/^α = (\d+), ℓ = (\d+), ν = (\d)\/2$/); return m ? { a: Number(m[1]), l: Number(m[2]), nu: Number(m[3]) / 2 } : null; });
      if (T.some(t => !t)) { fails.push(`${at}: format ${c.choice!.options}`); return; }
      const t = T as { a: number; l: number; nu: number }[];
      if (new Set(t.map(x => x.nu)).size !== 4 || new Set(t.map(x => x.a)).size !== 4 || new Set(t.map(x => x.l)).size !== 4) fails.push(`${at}: not distinct`);
      if (t.some(x => ![0.5, 1.5, 2.5, 3.5, 4.5].includes(x.nu) || x.a < 1 || x.a > 6 || x.l < 1 || x.l > 6)) fails.push(`${at}: out of range`);
      const d = t.map(x => Math.floor(x.nu));
      const best = d.indexOf(Math.max(...d));
      if (best !== c.choice!.answer) fails.push(`${at}: answer ${c.choice!.answer} best ${best}`);
      if (t[best].a === Math.max(...t.map(x => x.a)) || t[best].l === Math.max(...t.map(x => x.l))) fails.push(`${at}: correct is max alpha or ell`);
      if (new Set(c.choice!.options.map(o => o.length)).size !== 1) fails.push(`${at}: option lengths differ`);
    });
    report(fails);
  });

  it('rq-limit: SE with the same alpha and ell; wrong options differ on every draw', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      const c = cardOf(cards, 'rq-limit');
      const alpha = num(c.prompt, 'α'), ell = num(c.prompt, 'ℓ'), beta = num(c.prompt, 'β');
      if (![2, 3, 4, 5].includes(alpha) || ![2, 3, 4, 5].includes(ell) || ![2, 3, 4].includes(beta)) fails.push(`${at}: params`);
      const kinds = c.choice!.options.map(o => {
        const n = (clean(o).match(/\d+/g) ?? []).map(Number);
        const se = /squared exponential|平方指数核/.test(o), mat = /Matérn/.test(o), cst = /constant|常数/.test(o);
        return { se, mat, cst, n };
      });
      const good = kinds.map((k, i) => (k.se && !k.mat && !k.cst && JSON.stringify(k.n) === JSON.stringify([alpha, ell]) ? i : -1)).filter(i => i >= 0);
      if (good.length !== 1 || good[0] !== c.choice!.answer) fails.push(`${at}: good ${good} answer ${c.choice!.answer}`);
      const w1 = kinds.filter(k => k.se && JSON.stringify(k.n) === JSON.stringify([alpha, beta * ell]));
      const w2 = kinds.filter(k => k.mat && JSON.stringify(k.n) === JSON.stringify([alpha, ell, beta]));
      const w3 = kinds.filter(k => k.cst && JSON.stringify(k.n) === JSON.stringify([alpha]));
      if (w1.length !== 1 || w2.length !== 1 || w3.length !== 1) fails.push(`${at}: wrong-option shapes ${w1.length}${w2.length}${w3.length}`);
      if (beta * ell === ell) fails.push(`${at}: beta*ell = ell`);
      // numerical limit check of the plan's claim
      const rq = (b: number, r: number) => alpha * (1 + r * r / (2 * b * ell * ell)) ** (-b);
      if (Math.abs(rq(1e6, ell) / (alpha * Math.exp(-0.5)) - 1) > 1e-3) fails.push(`${at}: limit`);
      if (Math.abs(rq(1e6, ell) / (alpha * Math.exp(-0.5 / beta ** 2)) - 1) < 1e-3) fails.push(`${at}: w1 indistinguishable`);
      notLongest(c, at, fails);
    });
    report(fails);
  });
});

describe('GP-08 notation, language and variety', () => {
  it('all learner-visible text is Unicode: no ASCII hyphen minus, no ASCII names, no leftovers; ZH has no stray English', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      for (const c of cards) for (const t of textOf(c)) {
        const where = `${at} ${c.id}: ${t.slice(0, 70)}`;
        if (/(?<![A-Za-z])-|-(?![A-Za-z])/.test(t)) fails.push(`${where} [ascii hyphen]`);
        if (/\b(alpha|beta|ell|sigma|lambda|theta|sqrt|infty|nu|pi)\b/i.test(t.replace(/\bnu\b(?=\W)/g, 'nu'))) fails.push(`${where} [ascii name]`);
        if (/\b[a-zA-Z]\d\b/.test(t) || /\^|<=|>=|->|\bx'|\{|\}|undefined|NaN/.test(t)) fails.push(`${where} [ascii notation / leftover]`);
        if (lang === 'zh') {
          const words = (t.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? []).filter(w => !['exp', 'sin', 'Matérn', 'GP', 'KL', 'ELBO', 'det', 'SE', 'RQ', 'Bessel', 'cos'].includes(w));
          if (words.length) fails.push(`${where} [English in ZH: ${words}]`);
        }
      }
    });
    report(fails);
  });

  it('hints never contain the answer value of their own card (numeric cards)', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      for (const c of cards) if (c.fields) {
        const a = c.fields[0].answer;
        const forms = [String(Math.round(a * 100) / 100).replace('-', '−'), Math.abs(a) < 1e-9 ? '' : ''];
        if (c.hint.includes(` ${forms[0]} `) || c.hint.includes(`= ${forms[0]}`)) fails.push(`${at} ${c.id}: hint contains ${forms[0]}`);
      }
    });
    report(fails);
  });

  it('variety: every non-concept card has at least 6 distinct visible questions over 60 seeds', () => {
    for (const s of SLUGS) {
      const seen = new Set<string>();
      for (let i = 0; i < SEEDS; i++) { const c = cardOf(gp08(spreadSeed(i), 'en'), s); seen.add(questionTextOf(c).join('|') + '|' + (c.choice?.options.join(';') ?? '')); }
      expect(seen.size, s).toBeGreaterThanOrEqual(6);
    }
    // prompt text alone must vary on parameterised cards
    for (const s of ['se-exponent', 'se-compare', 'rq-value', 'periodic-exponent', 'periodic-repeat', 'rq-limit', 'challenge']) {
      const seen = new Set<string>();
      for (let i = 0; i < SEEDS; i++) seen.add(cardOf(gp08(spreadSeed(i), 'en'), s).prompt);
      expect(seen.size, `${s} prompts`).toBeGreaterThanOrEqual(6);
    }
  });

  it('every choice card marks its answer correct through gradeCard and wrong for the others', () => {
    const fails: string[] = [];
    eachDeck((cards, lang, at) => {
      for (const c of cards) if (c.choice) c.choice.options.forEach((_, i) => {
        if (gradeCard(c, [], i, []) !== (i === c.choice!.answer ? 'correct' : 'incorrect')) fails.push(`${at} ${c.id}: option ${i}`);
      });
    });
    report(fails);
  });
});
