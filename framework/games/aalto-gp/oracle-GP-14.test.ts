import { describe, expect, it } from 'vitest';
import { gp14 } from './games/gp14';
import { spreadSeed, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, parseGameNumber, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const COVER = 12000;
const LANGS: GameLanguage[] = ['en', 'zh'];
const SQ2 = Math.SQRT2;
const clean = (t: string) => t.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ');
const NUM = String.raw`\(?\s*(-?\d+)\s*\)?`;
const cardOf = (cards: PracticeCard[], slug: string) => {
  const c = cards.find(card => card.id === `GP-14-${slug}`);
  if (!c) throw new Error(`missing card ${slug}; have ${cards.map(x => x.id).join(',')}`);
  return c;
};
const deck = (index: number, lang: GameLanguage) => gp14(spreadSeed(index), lang);
const grab = (re: RegExp, text: string, where: string): number[] => {
  const m = clean(text).match(re);
  if (!m) throw new Error(`cannot parse ${re} in ${where}: ${text}`);
  return m.slice(1).map(Number);
};
const pairA = (t: string, w: string) => grab(new RegExp(String.raw`\ba = \(\s*${NUM}\s*,\s*${NUM}\s*\)`), t, w);
const pairB = (t: string, w: string) => grab(new RegExp(String.raw`\bb = \(\s*${NUM}\s*,\s*${NUM}\s*\)`), t, w);
const ORDER = ['feature-entry', 'inner-product', 'feature-dist', 'feature-count', 'se-term', 'not-unique', 'dist-not-kernel', 'challenge'];

// ---------------- independent recomputation ----------------
const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i], 0);
const phiQuad = (x1: number, x2: number) => [x1 * x1, SQ2 * x1 * x2, x2 * x2];
const psiQuad = (x1: number, x2: number) => [x1 * x1, x1 * x2, x1 * x2, x2 * x2];
function choose(n: number, r: number) { let v = 1; for (let i = 1; i <= r; i++) v = v * (n - r + i) / i; return Math.round(v); }
function countMultisets(D: number, p: number): number {
  const rec = (start: number, left: number): number => left === 0 ? 1 : Array.from({ length: D - start }, (_, i) => rec(start + i, left - 1)).reduce((a, b) => a + b, 0);
  return rec(0, p);
}
function cholRows(P: number, Q: number, R: number): [number[], number[]] {
  const l11 = Math.sqrt(P), l21 = R / l11, l22 = Math.sqrt(Q - l21 * l21);
  return [[l11, 0], [l21, l22]];
}
const phiChallenge = (x: number) => [1, SQ2 * x, x * x];

// entries ----
const entry = (a1: number, a2: number) => {
  const b = [1, 1];
  const c2 = ((a1 * b[0] + a2 * b[1]) ** 2 - a1 ** 2 * b[0] ** 2 - a2 ** 2 * b[1] ** 2) / (a1 * a2 * b[0] * b[1]);
  expect(c2).toBeCloseTo(2, 12);
  return Math.sqrt(c2) * a1 * a2;
};
const innerOracle = (a1: number, a2: number, b1: number, b2: number) => dot(phiQuad(a1, a2), phiQuad(b1, b2));
const distOracle = (P: number, Q: number, R: number) => { const [u, v] = cholRows(P, Q, R); return (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2; };
const seOracle = (x: number, xp: number, l: number) => {
  const u = x * xp / (l * l);
  // product form identity (checked) and second Taylor coefficient of exp(t u) at t = 0 by a central second difference
  expect(Math.abs(Math.exp(-x * x / (2 * l * l) - xp * xp / (2 * l * l) + u) - Math.exp(-((x - xp) ** 2) / (2 * l * l)))).toBeLessThan(1e-12);
  const h = 1e-3;
  return (Math.exp(h * u) - 2 + Math.exp(-h * u)) / (h * h) / 2;
};
const challengeOracle = (a: number, b: number) => { const p = phiChallenge(a), q = phiChallenge(b); return dot(p.map((v, i) => v - q[i]), p.map((v, i) => v - q[i])); };

// ---------------- plan sampling spaces (explicit enumeration with wrong-route guards) ----------------
const apart = (truth: number, others: number[]) => others.every(o => !(Math.abs(truth - o) < 0.02));
type Tuple = number[];
function space1(): Tuple[] {
  const out: Tuple[] = [];
  for (const a1 of [-3, -2, -1, 1, 2, 3]) for (const a2 of [-3, -2, -1, 1, 2, 3]) {
    const m = a1 * a2; if (Math.abs(m) < 2) continue;
    if (apart(SQ2 * m, [m, 2 * m, SQ2 * (a1 + a2), a1 * a1 + a2 * a2, SQ2 * m * m])) out.push([a1, a2]);
  }
  return out;
}
const V2 = [-2, -1, 1, 2, 3];
function space2(): Tuple[] {
  const out: Tuple[] = [];
  for (const a1 of V2) for (const a2 of V2) for (const b1 of V2) for (const b2 of V2) {
    const s = a1 * b1 + a2 * b2; if (s === 0 || Math.abs(s) > 7) continue;
    const Pc = a1 * a2 * b1 * b2, r2 = (a1 * b1) ** 2 + (a2 * b2) ** 2;
    if (apart(s * s, [s, r2, r2 + Pc, (a1 * a1 + a2 * a2) * (b1 * b1 + b2 * b2), 2 * s, (a1 * b1 - a2 * b2) ** 2])) out.push([a1, a2, b1, b2]);
  }
  return out;
}
function space3(): Tuple[] {
  const out: Tuple[] = [];
  for (let P = 2; P <= 9; P++) for (let Q = 2; Q <= 9; Q++) for (let R = -3; R <= 8; R++) {
    if (R === 0 || R * R >= P * Q) continue;
    const T = P + Q - 2 * R;
    if (apart(T, [P + Q + 2 * R, P + Q - R, P + Q, Math.sqrt(T), 2 * R - P - Q, P * Q - R * R])) out.push([P, Q, R]);
  }
  return out;
}
const space4 = (): Tuple[] => [[2, 3], [2, 4], [3, 3], [3, 4], [4, 2], [4, 3], [4, 4]];
function space5(): Tuple[] {
  const out: Tuple[] = [];
  for (const x of [-3, -2, -1, 1, 2, 3]) for (const xp of [-3, -2, -1, 1, 2, 3]) for (const l of [1, 2, 3]) {
    const u = x * xp / (l * l);
    if (Math.abs(2 * u - Math.round(2 * u)) > 1e-9 || Math.abs(u) < 0.5 || Math.abs(u) > 4) continue;
    const t = u * u / 2;
    if (apart(t, [u * u, u, u ** 3 / 6, (x * xp) ** 2 / 2, u * u / 4, 2 * u * u, u * u / 6])) out.push([x, xp, l]);
  }
  return out;
}
function space6(): Tuple[] {
  const out: Tuple[] = [];
  for (const a1 of V2) for (const a2 of V2) for (const b1 of V2) for (const b2 of V2) {
    const s = a1 * b1 + a2 * b2; if (s === 0 || Math.abs(s) > 7) continue;
    const k = s * s, w = (a1 * b1) ** 2 + a1 * a2 * b1 * b2 + (a2 * b2) ** 2;
    if (apart(k, [w, 2 * k]) && apart(w, [2 * k])) out.push([a1, a2, b1, b2]);
  }
  return out;
}
function space7(): Tuple[] {
  const out: Tuple[] = [];
  for (let x1 = -2; x1 <= 2; x1++) for (let x2 = x1 + 1; x2 <= 2; x2++) out.push([x1, x2]);
  return out;
}
function space8(): Tuple[] {
  const out: Tuple[] = [];
  const k = (x: number, y: number) => (x * y + 1) ** 2;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    if (a === b) continue;
    const T = (a - b) ** 2 * (2 + (a + b) ** 2); if (T > 100) continue;
    if (apart(T, [(a - b) ** 2, (a * a - b * b) ** 2, k(a, a) + k(b, b) - k(a, b), k(a, a) + k(b, b) + 2 * k(a, b), k(a, a) + k(b, b), 2 * (a - b) ** 2])) out.push([a, b]);
  }
  return out;
}
const SPACES: Record<string, Tuple[]> = {
  'feature-entry': space1(), 'inner-product': space2(), 'feature-dist': space3(), 'feature-count': space4(),
  'se-term': space5(), 'not-unique': space6(), 'dist-not-kernel': space7(), 'challenge': space8(),
};
const PLAN_COUNT: Record<string, number> = { 'feature-entry': 31, 'inner-product': 336, 'feature-dist': 446, 'feature-count': 7, 'se-term': 24, 'not-unique': 452, 'dist-not-kernel': 10, 'challenge': 36 };
const keySet = (ts: Tuple[]) => new Set(ts.map(t => t.join(',')));

// ---------------- parse the sampled numbers out of the visible prompt ----------------
function parseParams(slug: string, prompt: string, lang: GameLanguage): Tuple {
  const w = `${slug} ${lang}`;
  switch (slug) {
    case 'feature-entry': return pairA(prompt, w);
    case 'inner-product': case 'not-unique': return [...pairA(prompt, w), ...pairB(prompt, w)];
    case 'feature-dist': return [grab(new RegExp(String.raw`k\(a, a\) = ${NUM}`), prompt, w)[0], grab(new RegExp(String.raw`k\(b, b\) = ${NUM}`), prompt, w)[0], grab(new RegExp(String.raw`k\(a, b\) = ${NUM}`), prompt, w)[0]];
    case 'feature-count': {
      const D = grab(/D = (\d+)/, prompt, w)[0];
      const p = lang === 'en' ? grab(/power (\d+)/, prompt, w)[0] : grab(/p = (\d+)/, prompt, w)[0];
      return [D, p];
    }
    case 'se-term': return [grab(/\bx = (-?\d+)/, prompt, w)[0], grab(/x′ = (-?\d+)/, prompt, w)[0], grab(/ℓ = (-?\d+)/, prompt, w)[0]];
    case 'dist-not-kernel': return [grab(/x₁ = (-?\d+)/, prompt, w)[0], grab(/x₂ = (-?\d+)/, prompt, w)[0]];
    case 'challenge': return [grab(/\ba = (-?\d+)/, prompt, w)[0], grab(/\bb = (-?\d+)/, prompt, w)[0]];
  }
  throw new Error(slug);
}
const dFromMatrix = (prompt: string) => grab(/\[\[\s*0\s*,\s*(\d+)\s*\]\s*,\s*\[\s*(\d+)\s*,\s*0\s*\]\]/, prompt, 'matrix')[0];

const NUMERIC: Record<string, { kind: string; keys: string[] }> = {
  'feature-entry': { kind: 'GP-14:feature-entry', keys: ['a1', 'a2'] },
  'inner-product': { kind: 'GP-14:inner-product', keys: ['a1', 'a2', 'b1', 'b2'] },
  'feature-dist': { kind: 'GP-14:feature-dist', keys: ['P', 'Q', 'R'] },
  'feature-count': { kind: 'GP-14:feature-count', keys: ['D', 'p'] },
  'se-term': { kind: 'GP-14:se-term', keys: ['x', 'xp', 'l'] },
  'challenge': { kind: 'GP-14:challenge', keys: ['a', 'b'] },
};
function expected(slug: string, t: Tuple): number {
  switch (slug) {
    case 'feature-entry': return entry(t[0], t[1]);
    case 'inner-product': return innerOracle(t[0], t[1], t[2], t[3]);
    case 'feature-dist': return distOracle(t[0], t[1], t[2]);
    case 'feature-count': return countMultisets(t[0], t[1]);
    case 'se-term': return seOracle(t[0], t[1], t[2]);
    case 'challenge': return challengeOracle(t[0], t[1]);
  }
  throw new Error(slug);
}
const norm = (s: string) => clean(s).replace(/\s+/g, '');

describe('GP-14 deck shape', () => {
  it('has the 8 planned cards in order with the planned ids, both languages, challenge last', () => {
    for (const lang of LANGS) for (let i = 0; i < SEEDS; i++) {
      const cards = deck(i, lang);
      expect(cards.map(c => c.id)).toEqual(ORDER.map(s => `GP-14-${s}`));
    }
  });
  it('has no figures anywhere (plan: none)', () => {
    for (const lang of LANGS) for (let i = 0; i < SEEDS; i++) for (const c of deck(i, lang)) {
      expect(c.figure, c.id).toBeUndefined();
      expect(c.choice?.figures?.some(Boolean) ?? false, c.id).toBe(false);
    }
  });
  it('has audits exactly on the six numeric cards and nowhere else', () => {
    const kinds = new Set<string>();
    for (const lang of LANGS) for (let i = 0; i < SEEDS; i++) for (const c of deck(i, lang)) {
      const slug = c.id.replace('GP-14-', '');
      if (NUMERIC[slug]) {
        expect(c.audit?.kind, c.id).toBe(NUMERIC[slug].kind);
        expect(Object.keys(c.audit!.params).sort(), c.id).toEqual([...NUMERIC[slug].keys].sort());
        kinds.add(c.audit!.kind);
      } else { expect(c.audit, c.id).toBeUndefined(); expect(c.choice, c.id).toBeDefined(); }
      expect(c.slots, c.id).toBeUndefined();
    }
    expect([...kinds].sort()).toEqual(Object.values(NUMERIC).map(v => v.kind).sort());
  });
});

describe('GP-14 numeric cards: independent answers, grading, printed text equals audit params', () => {
  for (const [slug, meta] of Object.entries(NUMERIC)) {
    it(`${slug}: ${SEEDS} seeds x EN/ZH`, () => {
      let fired = 0;
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const card = cardOf(deck(i, lang), slug);
        const where = `${slug} ${lang} seed#${i}`;
        const params = meta.keys.map(k => card.audit!.params[k] as number);
        // printed text = audit params
        expect(parseParams(slug, card.prompt, lang), `${where} printed vs audit ${JSON.stringify(card.audit!.params)}`).toEqual(params);
        // independent answer
        const exp = expected(slug, params);
        expect(card.fields, where).toHaveLength(1);
        const f = card.fields![0];
        expect(f.tolerance, where).toBe(0.006);
        expect(Math.abs(f.answer - exp), `${where}: oracle ${exp} vs card ${f.answer}`).toBeLessThan(1e-6);
        // grading: exact, decimal rounded to 2 places, perturbed, nearby
        const g = (v: string) => gradeCard(card, [v], null, []);
        const dec2 = exp.toFixed(2);
        expect(g(dec2), `${where} dec2 ${dec2}`).toBe('correct');
        expect(g(String(exp + 0.02)), where).toBe('incorrect');
        expect(g(String(exp - 0.02)), where).toBe('incorrect');
        expect(g(String(exp * 2 + 1)), where).toBe('incorrect');
        if (slug === 'feature-entry') {
          const m = params[0] * params[1];
          expect(g(`${m}√2`), `${where} typed m√2`).toBe('correct');
          expect(g(`${m}√2`.replace('-', '−')), where).toBe('correct');
          expect(g(`${m + 1}√2`), where).toBe('incorrect');
          expect(g(String(m)), `${where} m alone`).toBe('incorrect');
          expect(g(String(2 * m)), where).toBe('incorrect');
          expect(g(`${2 * m}`), where).toBe('incorrect');
          expect(g((SQ2 * m).toFixed(2)), where).toBe('correct');
          expect(g((SQ2 * m).toFixed(1)), `${where} one decimal is outside 0.006 unless lucky`).toBe(Math.abs(Number((SQ2 * m).toFixed(1)) - SQ2 * m) <= 0.006 ? 'correct' : 'incorrect');
          expect(Math.abs(f.answer - SQ2 * m)).toBeLessThan(1e-9);
        } else if (slug === 'se-term') {
          const [x, xp, l] = params; const u = x * xp / (l * l);
          const num = (x * xp) ** 2, den = 2 * l ** 4;
          expect(g(`${num}/${den}`), where).toBe('correct');
          expect(g(String(u * u)), where).toBe('incorrect');
        } else {
          expect(g(String(Math.round(exp))), where).toBe('correct');
        }
        fired++;
      }
      expect(fired).toBe(SEEDS * 2);
    });
  }
});

describe('GP-14 explanations and hints', () => {
  it('numeric explanations contain the answer; hints contain no digits; no answer in hint', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of deck(i, lang)) {
      const slug = card.id.replace('GP-14-', '');
      expect(card.hint.replace('n = 2', ''), `${card.id} hint`).not.toMatch(/\d/);
      if (!NUMERIC[slug]) continue;
      const ans = card.fields![0].answer, ex = norm(card.explanation);
      const cands = [String(Math.round(ans)), ans.toFixed(2)];
      if (slug === 'feature-entry') {
        const m = Math.round(ans / SQ2); cands.push(`${m}√2`);
        expect(ex, `${card.id} ${lang} ${i}`).toContain(norm(`${m}√2`));
        expect(ex).toContain(norm(ans.toFixed(2)));
        continue;
      }
      if (slug === 'se-term') {
        const [x, xp, l] = [card.audit!.params.x, card.audit!.params.xp, card.audit!.params.l] as number[];
        const num = (x * xp) ** 2, den = 2 * l ** 4; const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a; const g = gcd(num, den);
        const frac = den / g === 1 ? `${num / g}` : `${num / g}/${den / g}`;
        expect(ex, `${card.id} ${lang} ${i}`).toContain(norm(frac));
        continue;
      }
      expect(ex, `${card.id} ${lang} ${i} answer ${ans}`).toContain(norm(String(ans)));
    }
  });
});

describe('GP-14 choice cards', () => {
  it('not-unique: exactly one option satisfies the plan predicate, answer index points to it, correct is not longest', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = cardOf(deck(i, lang), 'not-unique');
      const [a1, a2, b1, b2] = parseParams('not-unique', card.prompt, lang);
      const k = (a1 * b1 + a2 * b2) ** 2, kPsi = dot(psiQuad(a1, a2), psiQuad(b1, b2));
      expect(Math.abs(kPsi - k)).toBeLessThan(1e-9); expect(Math.abs(innerOracle(a1, a2, b1, b2) - k)).toBeLessThan(1e-9);
      const w = (a1 * b1) ** 2 + a1 * a2 * b1 * b2 + (a2 * b2) ** 2;
      expect(new Set([k, w, 2 * k]).size).toBe(3);
      const re = lang === 'en' ? /^Both inner products equal (-?\d+)\b/ : /^两个内积都等于 (-?\d+)/;
      const hits = card.choice!.options.map(o => { const m = clean(o).match(re); return !!m && Number(m[1]) === k; });
      expect(hits.filter(Boolean), `${lang} #${i}: ${card.choice!.options.join(' | ')}`).toHaveLength(1);
      expect(hits[card.choice!.answer], `${lang} #${i}`).toBe(true);
      expect(card.choice!.options).toHaveLength(4);
      // no other option claims the true value k as the only-P statement or Q-value
      const lens = card.choice!.options.map(o => [...o].length);
      expect(lens[card.choice!.answer], `${lang} #${i} lengths ${lens}`).toBeLessThan(Math.max(...lens));
      // the false numeric claims really are false: w1 mentions w, w3 mentions 2k
      const texts = card.choice!.options.map(clean);
      expect(texts.some(t => t.includes(String(w)) && !hitsText(t, k, lang))).toBe(true);
      expect(texts.some(t => t.includes(String(2 * k)))).toBe(true);
    }
  });
  it('dist-not-kernel: exactly one option satisfies the plan predicate, answer index points to it, correct is not longest', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = cardOf(deck(i, lang), 'dist-not-kernel');
      const [x1, x2] = parseParams('dist-not-kernel', card.prompt, lang);
      const D = dFromMatrix(card.prompt);
      const h = (x: number) => [x, x * x];
      const direct = (h(x1)[0] - h(x2)[0]) ** 2 + (h(x1)[1] - h(x2)[1]) ** 2;
      expect(D).toBe(direct);
      expect(D).toBe((x1 - x2) ** 2 * (1 + (x1 + x2) ** 2));
      expect(D).toBeGreaterThanOrEqual(2);
      // eigenvalues of [[0, D], [D, 0]] by the characteristic polynomial: lambda^2 - D^2 = 0
      const eig = [-Math.sqrt(D * D), Math.sqrt(D * D)];
      expect(eig[0]).toBeLessThan(0);
      const re = lang === 'en' ? /^Not valid: the eigenvalues are (\d+) and -(\d+)\b/ : /^不合法：特征值为 (\d+) 和 -(\d+)/;
      const hits = card.choice!.options.map(o => { const m = clean(o).match(re); return !!m && Number(m[1]) === D && Number(m[2]) === D; });
      expect(hits.filter(Boolean), `${lang} #${i}: ${card.choice!.options.join(' | ')}`).toHaveLength(1);
      expect(hits[card.choice!.answer]).toBe(true);
      expect(card.choice!.options).toHaveLength(4);
      const lens = card.choice!.options.map(o => [...o].length);
      expect(lens[card.choice!.answer], `${lang} #${i} lengths ${lens}`).toBeLessThan(Math.max(...lens));
      // no other option mentions -D
      card.choice!.options.forEach((o, j) => { if (j !== card.choice!.answer) expect(clean(o)).not.toContain(`-${D}`); });
    }
  });
  it('ZH option lengths: correct option is not the longest and is shorter than the longest wrong one (both choice cards, every set in the plan space)', () => {
    // exhaustive over seeds covering the plan sets
    const seen = { nu: new Set<string>(), dk: new Set<string>() };
    for (let i = 0; i < COVER; i++) {
      const cards = deck(i, 'zh');
      for (const [slug, bag] of [['not-unique', seen.nu], ['dist-not-kernel', seen.dk]] as const) {
        const c = cardOf(cards, slug);
        const lens = c.choice!.options.map(o => [...o].length);
        const key = (slug === 'dist-not-kernel' ? parseParams(slug, c.prompt, 'zh').sort((p, q) => p - q) : parseParams(slug, c.prompt, 'zh')).join(',');
        bag.add(key);
        expect(lens[c.choice!.answer], `${slug} ${key} ${lens}`).toBeLessThan(Math.max(...lens));
      }
    }
    expect(seen.nu.size).toBe(452); expect(seen.dk.size).toBe(10);
  });
});
function hitsText(t: string, k: number, lang: GameLanguage) {
  return (lang === 'en' ? /^Both inner products equal/ : /^两个内积都等于/).test(t) && t.includes(String(k));
}

describe('GP-14 sampling spaces equal the plan lists exactly', () => {
  it('plan enumerations have the planned sizes', () => {
    for (const [slug, space] of Object.entries(SPACES)) expect(space.length, slug).toBe(PLAN_COUNT[slug]);
  });
  it(`over ${COVER} spread seeds the generator hits exactly the planned sets (EN prompts) and nothing else`, () => {
    const seen: Record<string, Set<string>> = Object.fromEntries(Object.keys(SPACES).map(s => [s, new Set<string>()]));
    for (let i = 0; i < COVER; i++) {
      const cards = deck(i, 'en');
      for (const slug of Object.keys(SPACES)) {
        const t = parseParams(slug, cardOf(cards, slug).prompt, 'en');
        // dist-not-kernel is symmetric in (x1, x2): the plan counts 10 unordered pairs
        seen[slug].add((slug === 'dist-not-kernel' ? [...t].sort((p, q) => p - q) : t).join(','));
      }
    }
    for (const [slug, space] of Object.entries(SPACES)) {
      const planned = keySet(space);
      const extra = [...seen[slug]].filter(k => !planned.has(k));
      const missing = [...planned].filter(k => !seen[slug].has(k));
      expect(extra, `${slug} sampled outside the plan`).toEqual([]);
      expect(missing, `${slug} planned sets never sampled in ${COVER} seeds`).toEqual([]);
    }
  });
  it('dist-not-kernel D lies in {2,4,10,16,18,20}', () => {
    for (let i = 0; i < SEEDS; i++) expect([2, 4, 10, 16, 18, 20]).toContain(dFromMatrix(cardOf(deck(i, 'en'), 'dist-not-kernel').prompt));
  });
});

describe('GP-14 variety', () => {
  it('each card has at least 6 distinct prompts over 60 seeds (EN and ZH)', () => {
    for (const lang of LANGS) {
      const sets: Record<string, Set<string>> = Object.fromEntries(ORDER.map(s => [s, new Set<string>()]));
      for (let i = 0; i < SEEDS; i++) for (const c of deck(i, lang)) sets[c.id.replace('GP-14-', '')].add(c.prompt);
      for (const s of ORDER) expect(sets[s].size, `${s} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('GP-14 learner-visible notation lint', () => {
  const allText = (c: PracticeCard) => [c.title, c.prompt, c.hint, c.explanation, ...(c.fields?.map(f => f.label) ?? []), ...(c.choice?.options ?? [])];
  it('Unicode only: no ASCII minus, no caret, no double parentheses, no raw floats, no ASCII names, no leftovers', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const c of deck(i, lang)) for (const raw of allText(c)) {
      const t = raw, where = `${c.id} ${lang} #${i}: ${t}`;
      expect(t, where).not.toMatch(/\^/);
      expect(t, `${where} (ASCII hyphen as minus)`).not.toMatch(/(^|[\s(\[,=·])-\s?[\d(a-zA-Zφψℓ√]/);
      expect(t, `${where} (ASCII hyphen between operands)`).not.toMatch(/\d-\d|\s-\s/);
      // exp(…/(2ℓ²)) closes a function call and the squared-exponential formula itself; every other double parenthesis is a defect
      expect(t.replaceAll('(2ℓ²))', '(2ℓ²)'), where).not.toMatch(/\(\(|\)\)/);
      expect(t, where).not.toMatch(/\d\.\d{3,}/);
      expect(t, where).not.toMatch(/\d\.\d+e[+-]?\d|NaN|undefined|Infinity|\[object|\{|\}|\bnull\b/i);
      expect(t, where).not.toMatch(/\b(a1|a2|b1|b2|x1|x2|xp|phi|psi|sqrt|Dsup|Dsub)\b/);
      expect(t, where).not.toMatch(/\bPc\b|\bkaa\b|\bkbb\b|\bkab\b/);
      expect(t, where).not.toMatch(/TODO|DERIVED|NOT IN SOURCES|\(DERIVED\)/);
    }
  });
  it('ZH has no stray English words (allowed: GP, KL, ELBO, Gram, exp, SE, GPML, pdf, with the plan sanctioning Gram/exp/SE/GPML/pdf)', () => {
    const ok = new Set(['GP', 'KL', 'ELBO', 'Gram', 'exp', 'SE', 'GPML', 'pdf', 'Kv']);
    for (let i = 0; i < SEEDS; i++) for (const c of deck(i, 'zh')) for (const t of allText(c)) {
      for (const w of t.match(/[A-Za-z]{2,}/g) ?? []) expect(ok.has(w), `${c.id}: "${w}" in ${t}`).toBe(true);
      expect(t, c.id).not.toMatch(/Give an integer|squared|kernel/i);
    }
  });
  it('EN has no CJK, ZH prompt has CJK', () => {
    for (let i = 0; i < 10; i++) for (const c of deck(i, 'en')) for (const t of questionTextOf(c)) expect(t).not.toMatch(/[一-鿿]/);
    for (let i = 0; i < 10; i++) for (const c of deck(i, 'zh')) expect(c.prompt).toMatch(/[一-鿿]/);
  });
  it('number-card prompts end with the planned answer-format sentence', () => {
    const en: Record<string, string> = {
      'feature-entry': 'Give a number times √2 (for example 3√2), or a decimal rounded to 2 places.',
      'inner-product': 'Give an integer.', 'feature-dist': 'Give an integer.', 'feature-count': 'Give an integer.', challenge: 'Give an integer.',
      'se-term': 'Give an integer, a fraction or a decimal rounded to 2 places.',
    };
    const zh: Record<string, string> = {
      'feature-entry': '请填 √2 的整数倍（例如 3√2），或保留 2 位小数的小数。',
      'inner-product': '请填整数。', 'feature-dist': '请填整数。', 'feature-count': '请填整数。', challenge: '请填整数。',
      'se-term': '请填整数、分数，或保留 2 位小数的小数。',
    };
    for (let i = 0; i < 20; i++) {
      for (const [slug, end] of Object.entries(en)) expect(clean(cardOf(deck(i, 'en'), slug).prompt).trimEnd().endsWith(clean(end)), slug).toBe(true);
      for (const [slug, end] of Object.entries(zh)) expect(clean(cardOf(deck(i, 'zh'), slug).prompt).trimEnd().endsWith(clean(end)), slug).toBe(true);
    }
  });
});
