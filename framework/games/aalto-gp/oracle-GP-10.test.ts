import { describe, expect, it } from 'vitest';
import { gp10 } from './games/gp10';
import { spreadSeed, questionTextOf, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const BIG = 6000;
const LN2PI_TRUE = Math.log(2 * Math.PI);
// printed constants of the plan
const P2 = 0.693, P3 = 1.099, P2PI = 1.838;
const MINUS = /[−-]/;
const num = (s: string) => Number(s.replaceAll('−', '-'));
const deck = (seed: number, lang: GameLanguage) => gp10(seed, lang) as PracticeCard[];
const byId = (cards: PracticeCard[], slug: string) => {
  const c = cards.find(card => card.id === `GP-10-${slug}`);
  if (!c) throw new Error(`missing card ${slug}`);
  return c;
};
const seeds = (n: number) => Array.from({ length: n }, (_, i) => spreadSeed(i));
const NUM = '(−?\\d+(?:\\.\\d+)?)';
function matrixIn(text: string): number[] {
  const m = text.match(new RegExp(`\\[\\[\\s*${NUM}\\s*,\\s*${NUM}\\s*\\]\\s*,\\s*\\[\\s*${NUM}\\s*,\\s*${NUM}\\s*\\]\\]`));
  if (!m) throw new Error(`no 2x2 matrix in: ${text}`);
  return m.slice(1, 5).map(num);
}
function vectorIn(text: string): [number, number] {
  const m = text.match(new RegExp(`y = \\(${NUM}, ${NUM}\\)ᵀ`));
  if (!m) throw new Error(`no y vector in: ${text}`);
  return [num(m[1]), num(m[2])];
}
// hand-written 2x2 helpers (independent of the plan's closed forms)
function inv2(M: number[]): number[] {
  const [p, q, r, s] = M; const d = p * s - q * r;
  return [s / d, -q / d, -r / d, p / d];
}
function quad(M: number[], y: [number, number]): number { // y^T M y
  return y[0] * (M[0] * y[0] + M[1] * y[1]) + y[1] * (M[2] * y[0] + M[3] * y[1]);
}
function chol2(M: number[]): number[] { // lower-triangular [l11,0,l21,l22]
  const l11 = Math.sqrt(M[0]); const l21 = M[2] / l11; const l22 = Math.sqrt(M[3] - l21 * l21);
  return [l11, 0, l21, l22];
}
/** logpdf of N(0, C) at y for N = 2, via Cholesky (independent route to the exact log density). */
function logpdf(C: number[], y: [number, number]): number {
  const L = chol2(C);
  const v1 = y[0] / L[0], v2 = (y[1] - L[2] * v1) / L[3];
  return -LN2PI_TRUE - (Math.log(L[0]) + Math.log(L[3])) - 0.5 * (v1 * v1 + v2 * v2);
}
/** ln of an integer that is a product of 2s and 3s using the printed constants */
function lnPrinted(n: number): number {
  let r = 0, m = n;
  while (m % 2 === 0 && m > 1) { m /= 2; r += P2; }
  while (m % 3 === 0 && m > 1) { m /= 3; r += P3; }
  if (m !== 1) throw new Error(`${n} is not 2^i 3^j`);
  return r;
}
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
function fractionString(num_: number, den: number): string { const g = gcd(num_, den); return `${num_ / g}/${den / g}`; }
const grade = (card: PracticeCard, values: string[]) => gradeCard(card, values, null, []);
function expectGrades(card: PracticeCard, answers: number[], where: string) {
  const strings = answers.map(a => a.toFixed(2));
  expect(grade(card, strings), `${where}: rounded true value must be accepted (${strings})`).toBe('correct');
  answers.forEach((a, i) => {
    const tol = card.fields![i].tolerance ?? 1e-8;
    for (const delta of [tol * 3.5, -tol * 3.5, 0.05]) {
      const vals = strings.slice(); vals[i] = (a + delta).toFixed(3);
      expect(grade(card, vals), `${where}: field ${i} perturbed by ${delta}`).toBe('incorrect');
    }
  });
}
function expectGap(answer: number, wrongs: Record<string, number>, where: string, gap = 0.02) {
  for (const [name, w] of Object.entries(wrongs)) {
    expect(Math.abs(w - answer), `${where}: wrong route "${name}" = ${w} collides with answer ${answer}`).toBeGreaterThanOrEqual(gap);
  }
}


type P = Record<string, number>;
const dfAnswer = (p: P) => -(p.a * (p.y1 ** 2 + p.y2 ** 2) - 2 * p.b * p.y1 * p.y2) / (2 * (p.a * p.a - p.b * p.b));
function dfWrongs(p: P): Record<string, number> {
  const det = p.a * p.a - p.b * p.b; const sumsq = p.y1 ** 2 + p.y2 ** 2, cross = 2 * p.b * p.y1 * p.y2; const q = -2 * dfAnswer(p);
  return { 'no half': -q, 'plus half': 0.5 * q, 'C not inverse': -0.5 * (p.a * sumsq + cross), 'diag only': -sumsq / (2 * p.a),
    'wrong offdiag sign': -(p.a * sumsq + cross) / (2 * det), 'no det': -0.5 * (p.a * sumsq - cross), 'identity over det': -sumsq / (2 * det) };
}
function cholAnswers(p: P): [number, number] {
  const v1 = p.y1 / p.l11, v2 = (p.y2 - p.l21 * v1) / p.l22;
  return [2 * (lnPrinted(p.l11) + lnPrinted(p.l22)), v1 * v1 + v2 * v2];
}
function cholWrongs(p: P): [Record<string, number>, Record<string, number>] {
  const [a0] = cholAnswers(p); const v1 = p.y1 / p.l11, v2 = (p.y2 - p.l21 * v1) / p.l22;
  const w2 = p.y2 / p.l22, w1 = (p.y1 - p.l21 * w2) / p.l11;
  return [{ 'no factor 2': lnPrinted(p.l11) + lnPrinted(p.l22), neg: -a0, double: 2 * a0 },
    { 'offdiag ignored': (p.y1 / p.l11) ** 2 + (p.y2 / p.l22) ** 2, 'plain norm': p.y1 ** 2 + p.y2 ** 2, 'no square': Math.sqrt(v1 * v1 + v2 * v2), 'transposed solve': w1 * w1 + w2 * w2 }];
}
function chAnswer(p: P): number {
  const a = p.k + p.s; const det = a * a - p.b * p.b; const q = (a * (p.y1 ** 2 + p.y2 ** 2) - 2 * p.b * p.y1 * p.y2) / det;
  return -P2PI - lnPrinted(det) / 2 - q / 2;
}
function chWrongs(p: P): Record<string, number> {
  const a = p.k + p.s; const det = a * a - p.b * p.b; const lnD = lnPrinted(det);
  const sumsq = p.y1 ** 2 + p.y2 ** 2, cross = 2 * p.b * p.y1 * p.y2; const q = (a * sumsq - cross) / det;
  const Kdet = p.k * p.k - p.b * p.b; const qK = (p.k * sumsq - cross) / Kdet; const lnK = Math.log(Kdet);
  return { 'half forgotten on log': -P2PI - lnD - q / 2, 'half forgotten on fit': -P2PI - lnD / 2 - q,
    'penalty sign': -P2PI + lnD / 2 - q / 2, 'no constant': -lnD / 2 - q / 2, '-N ln2pi': -2 * P2PI - lnD / 2 - q / 2,
    'K not C both': -P2PI - lnK / 2 - qK / 2, 'K not C in fit': -P2PI - lnD / 2 - qK / 2,
    yCy: -P2PI - lnD / 2 - 0.5 * (a * sumsq + cross), 'offdiag sign': -P2PI - lnD / 2 - 0.5 * (a * sumsq + cross) / det,
    'fit sign': -P2PI - lnD / 2 + q / 2, 'fit alone': -q / 2, 'penalty alone': -lnD / 2 };
}
const clearOf = (answer: number, wrongs: Record<string, number>) => Object.values(wrongs).every(w => Math.abs(w - answer) >= 0.02);

describe('GP-10 oracle', () => {
  it('deck structure: 8 cards in plan order, no figures, audit kinds exactly as planned, on every seed and language', () => {
    const slugs = ['roles', 'const-term', 'complexity', 'data-fit', 'occam', 'assume', 'cholesky', 'challenge'];
    const expected = ['const-term', 'complexity', 'data-fit', 'occam', 'cholesky', 'challenge'].map(s => `GP-10:${s}`).sort();
    for (const seed of seeds(SEEDS)) for (const lang of ['en', 'zh'] as const) {
      const cards = deck(seed, lang);
      expect(cards.map(c => c.id)).toEqual(slugs.map(s => `GP-10-${s}`));
      expect(cards.filter(c => c.audit).map(c => c.audit!.kind).sort()).toEqual(expected);
      for (const c of cards) { expect(c.figure, c.id).toBeUndefined(); expect(c.choice?.figures?.some(Boolean) ?? false, c.id).toBe(false); }
      for (const slug of ['roles', 'assume']) expect(byId(cards, slug).audit).toBeUndefined();
      expect(byId(cards, 'cholesky').fields!.length).toBe(2);
      for (const c of cards.filter(c => c.fields)) for (const f of c.fields!) expect(f.tolerance).toBe(0.006);
    }
  });

  for (const lang of ['en', 'zh'] as const) {
    describe(`numeric cards (${lang})`, () => {
      it('const-term: printed N = audit N; answer = -(N/2) ln 2pi within tolerance of the true value', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'const-term');
          const N = c.audit!.params.N as number;
          expect(Object.keys(c.audit!.params)).toEqual(['N']);
          expect(c.prompt).toMatch(new RegExp(`N = ${N}\\b`));
          expect(c.prompt).toContain('1.838');
          const truth = logpdfIdentity(N);
          expect(Math.abs(c.fields![0].answer - truth), `seed ${seed}`).toBeLessThanOrEqual(0.003);
          expect(c.fields![0].answer).toBeCloseTo(-0.919 * N, 9); // printed constant, never Math.log
          expectGrades(c, [truth], `const-term seed ${seed}`);
          expectGap(c.fields![0].answer, { 'no half': -1.838 * N, sign: 0.919 * N, 'N ignored': -0.919, 'N-1': -0.919 * (N - 1), 'N+1': -0.919 * (N + 1) }, `const-term seed ${seed}`);
        }
      });

      it('complexity: -1/2 ln|C| via Cholesky/log det and via logpdf(C,0)+ln 2pi', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'complexity');
          const M = matrixIn(c.prompt);
          const { a, b } = c.audit!.params as { a: number; b: number };
          expect(M).toEqual([a, b, b, a]);
          expect(c.prompt).toContain('0.693'); expect(c.prompt).toContain('1.099');
          const L = chol2(M);
          const route1 = -(Math.log(L[0]) + Math.log(L[3]));
          const route2 = logpdf(M, [0, 0]) + LN2PI_TRUE;
          expect(route1).toBeCloseTo(route2, 10);
          expect(Math.abs(c.fields![0].answer - route1)).toBeLessThanOrEqual(0.003);
          expectGrades(c, [route1], `complexity seed ${seed}`);
          const d = a * a - b * b;
          expect(a).toBeGreaterThan(Math.abs(b));
          expectGap(c.fields![0].answer, { 'no half': -lnPrinted(d), sign: 0.5 * lnPrinted(d), 'no log': -d / 2, 'det': -d }, `complexity seed ${seed}`);
        }
      });

      it('data-fit: -1/2 y^T C^-1 y by explicit inverse, by elimination, and by log densities; fraction answer accepted', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'data-fit');
          const M = matrixIn(c.prompt); const y = vectorIn(c.prompt);
          const p = c.audit!.params as { a: number; b: number; y1: number; y2: number };
          expect(M).toEqual([p.a, p.b, p.b, p.a]); expect(y).toEqual([p.y1, p.y2]);
          const Mi = inv2(M);
          const r1 = -0.5 * quad(Mi, y);
          // elimination: solve M x = y
          const f = M[2] / M[0]; const x2 = (y[1] - f * y[0]) / (M[3] - f * M[1]); const x1 = (y[0] - M[1] * x2) / M[0];
          const r2 = -0.5 * (y[0] * x1 + y[1] * x2);
          const r3 = logpdf(M, y) - logpdf(M, [0, 0]);
          expect(r1).toBeCloseTo(r2, 10); expect(r1).toBeCloseTo(r3, 10);
          expect(Math.abs(c.fields![0].answer - r1)).toBeLessThanOrEqual(1e-8);
          const det = p.a * p.a - p.b * p.b;
          const numer = -(p.a * (p.y1 ** 2 + p.y2 ** 2) - 2 * p.b * p.y1 * p.y2);
          expect(numer / (2 * det)).toBeCloseTo(r1, 10);
          expect(grade(c, [fractionString(numer, 2 * det)]), `fraction ${fractionString(numer, 2 * det)}`).toBe('correct');
          expect(grade(c, [r1.toFixed(2)])).toBe('correct');
          expect(grade(c, [(r1 + 0.03).toFixed(2)])).toBe('incorrect');
          expect(grade(c, [(r1 - 0.03).toFixed(2)])).toBe('incorrect');
          expectGap(c.fields![0].answer, dfWrongs(p), `data-fit seed ${seed}`);
        }
      });

      it('occam: difference of two explicit log densities with the true ln 2pi', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'occam');
          const p = c.audit!.params as { N: number; LA: number; LB: number; qA: number; qB: number };
          expect(Object.keys(p).sort()).toEqual(['LA', 'LB', 'N', 'qA', 'qB']);
          const rx = lang === 'en'
            ? new RegExp(`N = (\\d+) targets y\\. Model A has ln\\|C_A\\| = ${NUM} and yᵀC_A⁻¹y = ${NUM}\\. Model B has ln\\|C_B\\| = ${NUM} and yᵀC_B⁻¹y = ${NUM}\\.`)
            : new RegExp(`N = (\\d+) 个目标值 y。模型 A：ln\\|C_A\\| = ${NUM}，yᵀC_A⁻¹y = ${NUM}。模型 B：ln\\|C_B\\| = ${NUM}，yᵀC_B⁻¹y = ${NUM}。`);
          const m = c.prompt.match(rx);
          expect(m, c.prompt).not.toBeNull();
          const [N, LA, qA, LB, qB] = m!.slice(1).map(num);
          expect({ N, LA, LB, qA, qB }).toEqual(p);
          const lnp = (L: number, q: number) => -(N / 2) * LN2PI_TRUE - L / 2 - q / 2;
          const truth = lnp(LA, qA) - lnp(LB, qB);
          expect(Math.abs(c.fields![0].answer - truth)).toBeLessThanOrEqual(1e-9);
          expectGrades(c, [truth], `occam seed ${seed}`);
          const dL = LA - LB, dq = qA - qB;
          expect(Math.abs(dL)).toBeGreaterThanOrEqual(0.4 - 1e-9);
          expect(dL * dq).toBeLessThan(0);
          expect(Math.abs(truth)).toBeGreaterThanOrEqual(0.1 - 1e-9);
          expect(N).toBeGreaterThanOrEqual(3); expect(N).toBeLessThanOrEqual(8);
          for (const v of [LA, LB]) { expect(v).toBeGreaterThanOrEqual(0.6 - 1e-9); expect(v).toBeLessThanOrEqual(3 + 1e-9); expect(Math.abs(v * 5 - Math.round(v * 5))).toBeLessThan(1e-9); }
          for (const v of [qA, qB]) { expect(v).toBeGreaterThanOrEqual(0.5); expect(v).toBeLessThanOrEqual(6); expect(Math.abs(v * 2 - Math.round(v * 2))).toBeLessThan(1e-9); }
          expectGap(truth, {
            'no halves': -(dL + dq), swapped: (dL + dq) / 2, 'penalty only': -dL / 2, 'fit only': -dq / 2,
            'fit sign flipped': (-dL + dq) / 2, 'sums': -(LA + LB) / 2 - (qA + qB) / 2,
          }, `occam seed ${seed}`);
        }
      });

      it('cholesky: ln|C| and y^T C^-1 y from C = L L^T built explicitly', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'cholesky');
          const M = matrixIn(c.prompt); const y = vectorIn(c.prompt);
          const p = c.audit!.params as { l11: number; l21: number; l22: number; y1: number; y2: number };
          expect(Object.keys(p).sort()).toEqual(['l11', 'l21', 'l22', 'y1', 'y2']);
          expect(M).toEqual([p.l11, 0, p.l21, p.l22]); expect(y).toEqual([p.y1, p.y2]);
          expect(c.prompt).toContain('0.693'); expect(c.prompt).toContain('1.099');
          expect(`${p.l11},${p.l22}`).not.toMatch(/^(1,1|3,3)$/);
          expect([1, 2, 3]).toContain(p.l11); expect([1, 2, 3]).toContain(p.l22); expect([-2, -1, 1, 2]).toContain(p.l21);
          // C = L L^T explicitly
          const C = [p.l11 * p.l11, p.l11 * p.l21, p.l21 * p.l11, p.l21 * p.l21 + p.l22 * p.l22];
          const det = C[0] * C[3] - C[1] * C[2];
          const lnC = Math.log(det);
          const q = quad(inv2(C), y);
          const [a0, a1] = c.fields!.map(f => f.answer);
          expect(Math.abs(a0 - lnC)).toBeLessThanOrEqual(0.003);
          expect(Math.abs(a1 - q)).toBeLessThanOrEqual(1e-9);
          expect(c.fields![0].label).toContain('ln|C|'); expect(c.fields![1].label).toContain('yᵀC⁻¹y');
          expectGrades(c, [lnC, q], `cholesky seed ${seed}`);
          // hidden v is an integer in {±1,±2}
          const v1 = p.y1 / p.l11, v2 = (p.y2 - p.l21 * v1) / p.l22;
          for (const v of [v1, v2]) { expect(Number.isInteger(v)).toBe(true); expect([-2, -1, 1, 2]).toContain(v); }
          const [wl, wq] = cholWrongs(p);
          expectGap(a0, wl, `cholesky ln seed ${seed}`); expectGap(a1, wq, `cholesky q seed ${seed}`);
        }
      });

      it('challenge: exact log density of N(0, K + s I) at y', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'challenge');
          const p = c.audit!.params as { k: number; b: number; s: number; y1: number; y2: number };
          expect(Object.keys(p).sort()).toEqual(['b', 'k', 's', 'y1', 'y2']);
          const K = matrixIn(c.prompt); const y = vectorIn(c.prompt);
          const s = num(c.prompt.match(/σ² = (\d+)/)![1]);
          expect(K).toEqual([p.k, p.b, p.b, p.k]); expect(y).toEqual([p.y1, p.y2]); expect(s).toBe(p.s);
          expect(c.prompt).toMatch(/N = 2\b/);
          for (const t of ['0.693', '1.099', '1.838']) expect(c.prompt).toContain(t);
          expect(p.k).toBeGreaterThan(Math.abs(p.b));
          const C = [K[0] + s, K[1], K[2], K[3] + s];
          const truth = logpdf(C, y);
          expect(Math.abs(c.fields![0].answer - truth)).toBeLessThanOrEqual(0.003);
          expectGrades(c, [truth], `challenge seed ${seed}`);
          expectGap(c.fields![0].answer, chWrongs(p), `challenge seed ${seed}`);
        }
      });
    });
  }

  for (const lang of ['en', 'zh'] as const) {
    describe(`choice cards (${lang})`, () => {
      const roleKey: [string, string][] = lang === 'en'
        ? [['observed targets', 'y'], ['length-scale', 'ell'], ['signal variance', 'sf'], ['noise variance', 'noise'], ['input locations', 'x'], ['number of data points', 'n']]
        : [['观测目标值', 'y'], ['长度尺度', 'ell'], ['信号方差', 'sf'], ['噪声方差', 'noise'], ['输入位置', 'x'], ['数据点个数', 'n']];
      it('roles: exactly one option satisfies the plan predicate; B never correct and never the longest-correct', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'roles');
          const question = c.prompt.split(lang === 'en' ? 'depend on' : '依赖于')[1];
          const hits = roleKey.filter(([k]) => question.includes(k));
          expect(hits.length, c.prompt).toBe(1);
          const v = hits[0][1];
          const N = num(c.prompt.match(/N = (\d+)/)![1]);
          expect(N).toBeGreaterThanOrEqual(3); expect(N).toBeLessThanOrEqual(8);
          if (v === 'n') expect(c.prompt).toContain(`N = ${N + 1}`);
          const kind = (o: string): string => {
            if (lang === 'en') {
              if (o.startsWith('Only the data fit')) return 'A';
              if (o.startsWith('Only the complexity penalty')) return 'B';
              if (o.startsWith('The complexity penalty and the data fit')) return 'C';
              if (o.startsWith('All three')) return 'D';
            } else {
              if (o.startsWith('只有数据拟合项')) return 'A';
              if (o.startsWith('只有复杂度惩罚项')) return 'B';
              if (o.startsWith('复杂度惩罚项和数据拟合项')) return 'C';
              if (o.startsWith('三项全部')) return 'D';
            }
            return '?';
          };
          const kinds = c.choice!.options.map(kind);
          expect([...kinds].sort()).toEqual(['A', 'B', 'C', 'D']);
          const want = v === 'y' ? 'A' : v === 'n' ? 'D' : 'C';
          expect(kinds[c.choice!.answer], `seed ${seed} v=${v}`).toBe(want);
          const lens = c.choice!.options.map(o => o.length);
          expect(lens[c.choice!.answer], 'correct option must not be the longest').toBeLessThan(Math.max(...lens));
        }
      });

      it('assume: determinant of C decides which option is correct', () => {
        for (const seed of seeds(SEEDS)) {
          const c = byId(deck(seed, lang), 'assume');
          const K = matrixIn(c.prompt); const s = num(c.prompt.match(/σ² = (\d+)/)![1]);
          const k = K[0], cc = K[1];
          expect(K[3]).toBe(k); expect(K[2]).toBe(cc); expect(Math.abs(cc)).toBe(k); // K singular
          expect(k * k - cc * cc).toBe(0);
          const C = [k + s, cc, cc, k + s];
          const det = C[0] * C[3] - C[1] * C[2];
          expect(det).toBe(s * (2 * k + s));
          const isCorrect = (o: string): boolean => {
            if (det > 0) {
              const m = o.match(lang === 'en' ? /^ln\|C\| is finite: \|C\| = (\d+) > 0/ : /^ln\|C\| 有限：\|C\| = (\d+) > 0/);
              return !!m && Number(m[1]) === det;
            }
            return lang === 'en' ? o.startsWith('|C| = 0, so ln|C| = −∞') : o.startsWith('|C| = 0，所以 ln|C| = −∞');
          };
          const verdicts = c.choice!.options.map(isCorrect);
          expect(verdicts.filter(Boolean).length, `seed ${seed} det ${det}`).toBe(1);
          expect(verdicts[c.choice!.answer]).toBe(true);
          expect(c.choice!.options.length).toBe(4);
          const lens = c.choice!.options.map(o => o.length);
          expect(lens[c.choice!.answer]).toBeLessThan(Math.max(...lens));
          // wrong-route options: their claimed determinant values never equal the true one
          for (const [i, o] of c.choice!.options.entries()) {
            if (i === c.choice!.answer) continue;
            const claimed = [...o.matchAll(/(?:=|＝) (\d+)(?!\d)/g)].map(m => Number(m[1]));
            if (det > 0) expect(claimed.filter(x => x === det && /有限|finite/.test(o)), `wrong option claims the true determinant: ${o}`).toEqual([]);
          }
        }
      });
    });
  }

  it('sampling spaces match the plan counts (6000 spread seeds)', () => {
    const seen: Record<string, Set<string>> = {};
    const add = (k: string, v: string) => (seen[k] ??= new Set()).add(v);
    for (const seed of seeds(BIG)) {
      const cards = deck(seed, 'en');
      for (const c of cards) if (c.audit) {
        const p = c.audit.params as Record<string, number>;
        const k = c.audit.kind.slice(6);
        if (k === 'occam') { add('occam-decoy', String(p.N)); add('occam', JSON.stringify([p.LA, p.LB, p.qA, p.qB])); } else add(k, JSON.stringify(p));
      }
      const r = byId(cards, 'roles'); const N = num(r.prompt.match(/N = (\d+)/)![1]);
      const qtxt = r.prompt.split('depend on')[1];
      add('roles', `${N}|${qtxt}`);
      const a = byId(cards, 'assume'); add('assume', a.prompt.replace(/[^\d−\[\],σ²= ]/g, '').trim());
    }
    expect(seen['const-term'].size).toBe(8);
    expect(seen['complexity'].size).toBe(10);
    expect(seen['data-fit'].size).toBe(152);
    expect(seen['cholesky'].size).toBe(372);
    expect(seen['challenge'].size).toBe(144);
    expect(seen['roles'].size).toBe(36);
    expect(seen['assume'].size).toBe(32);
    expect([...seen['occam-decoy']].sort()).toEqual(['3', '4', '5', '6', '7', '8']);
    // enumerate the planned sets independently (sampling space after the plan's guards) and require set equality
    const key = (o: Record<string, number>) => JSON.stringify(o);
    const sortedKeys = (set: Set<string>) => [...set].map(x => key(JSON.parse(x))).sort();
    const dfSet: string[] = [];
    for (const [a0, b0] of [[2, 1], [3, 1], [3, 2], [4, 2], [5, 3]]) for (const b of [b0, -b0]) for (const y1 of [-3, -2, -1, 1, 2, 3]) for (const y2 of [-3, -2, -1, 1, 2, 3]) {
      const p = { a: a0, b, y1, y2 }; const det = a0 * a0 - b * b; const numer = a0 * (y1 * y1 + y2 * y2) - 2 * b * y1 * y2;
      const den = (2 * det) / gcd(numer, 2 * det);
      if ([1, 2, 4, 5, 8, 10].includes(den) && clearOf(dfAnswer(p), dfWrongs(p))) dfSet.push(key(p));
    }
    expect(dfSet.length).toBe(152);
    expect(sortedKeys(seen['data-fit'])).toEqual(dfSet.sort());
    const chSet: string[] = [];
    for (const l11 of [1, 2, 3]) for (const l22 of [1, 2, 3]) {
      if ((l11 === 1 && l22 === 1) || (l11 === 3 && l22 === 3)) continue;
      for (const l21 of [-2, -1, 1, 2]) for (const v1 of [-2, -1, 1, 2]) for (const v2 of [-2, -1, 1, 2]) {
        const p = { l11, l21, l22, y1: l11 * v1, y2: l21 * v1 + l22 * v2 }; const [a0, a1] = cholAnswers(p); const [wl, wq] = cholWrongs(p);
        if (clearOf(a0, wl) && clearOf(a1, wq)) chSet.push(key(p));
      }
    }
    expect(chSet.length).toBe(372);
    expect(sortedKeys(seen['cholesky'])).toEqual(chSet.sort());
    const cgSet: string[] = [];
    for (const [k, b0, s0] of [[2, 1, 1], [2, 1, 3], [3, 2, 1], [3, 1, 2], [4, 3, 1], [4, 1, 1]]) for (const b of [b0, -b0]) for (const y1 of [-3, -2, -1, 1, 2, 3]) for (const y2 of [-3, -2, -1, 1, 2, 3]) {
      const p = { k, b, s: s0, y1, y2 }; const a = k + s0; const det = a * a - b * b; const numer = a * (y1 * y1 + y2 * y2) - 2 * b * y1 * y2;
      const den = (2 * det) / gcd(numer, 2 * det);
      if ([1, 2, 4, 5, 8, 10].includes(den) && clearOf(chAnswer(p), chWrongs(p))) cgSet.push(key(p));
    }
    const ocSet = new Set<string>(); let pos = 0, neg = 0;
    for (let la = 6; la <= 30; la += 2) for (let lb = 6; lb <= 30; lb += 2) for (let qa = 1; qa <= 12; qa++) for (let qb = 1; qb <= 12; qb++) {
      const dl = (la - lb) / 10, dqq = (qa - qb) / 2; if (Math.abs(la - lb) < 4 || dl * dqq >= 0) continue;
      const ans = -(dl + dqq) / 2; if (Math.abs((la - lb) + 5 * (qa - qb)) < 2) continue; // |answer| >= 0.1 exactly (plan says 7602 sets; exact enumeration gives 7830)
      if (!clearOf(ans, { a: -(dl + dqq), b: (dl + dqq) / 2, c: -dl / 2, d: -dqq / 2, e: (-dl + dqq) / 2, f: -(la + lb) / 20 - (qa + qb) / 4 })) continue;
      ocSet.add(JSON.stringify([la / 10, lb / 10, qa / 2, qb / 2])); if (ans > 0) pos++; else neg++;
    }
    expect(ocSet.size).toBe(7830); expect(pos).toBe(3915); expect(neg).toBe(3915);
    for (const k of seen['occam']) expect(ocSet.has(k), `occam draw ${k} outside the planned space`).toBe(true);
    expect(seen['occam'].size).toBeGreaterThan(1500);
    expect(cgSet.length).toBe(144);
    expect(sortedKeys(seen['challenge'])).toEqual(cgSet.sort());
  });

  it('variety: at least 6 distinct prompts per card over 60 seeds, per language', () => {
    for (const lang of ['en', 'zh'] as const) {
      const prompts: Record<string, Set<string>> = {};
      for (const seed of seeds(SEEDS)) for (const c of deck(seed, lang)) (prompts[c.id] ??= new Set()).add(c.prompt);
      for (const [id, set] of Object.entries(prompts)) expect(set.size, `${id} ${lang}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('learner-visible notation: Unicode only, no ASCII names, no hyphen minus, no double parentheses, no raw floats, no ZH English words', () => {
    const ascii = /\b(sigma|Sigma|mu|theta|ell\b|yTCinv|Sigma_p|w_0|sigma_f|l11|l21|l22|LA|LB|qA|qB)\b|sigma_f|\^|\{[^}]*\}/;
    for (const seed of seeds(SEEDS)) for (const lang of ['en', 'zh'] as const) for (const c of deck(seed, lang)) for (const t of textOf(c)) {
      expect(t, `${c.id} ${lang}`).not.toMatch(ascii);
      expect(t, `${c.id} ${lang} hyphen minus`).not.toMatch(/[(,=≈] ?-\d|\d - -|[+−-] ?- ?\d/);
      expect(t, `${c.id} ${lang} double parens`).not.toMatch(/\(\(−?\d+(?:\.\d+)?\),|, \(−?\d+(?:\.\d+)?\)\)|\(\(−?\d+(?:\.\d+)?\)\)/);
      expect(t, `${c.id} ${lang} raw float`).not.toMatch(/\d\.\d{5,}/);
      expect(t, `${c.id} ${lang} tautology`).not.toMatch(/(\bln \d+) = \1(?!\d)/);
      expect(t, `${c.id} ${lang} stray sentence end before citation`).not.toMatch(/[.。] ?[(（]Lecture|[.。]（第/);
      expect(t, `${c.id} ${lang} leak`).not.toMatch(/undefined|NaN|\[object|Infinity/);
      if (lang === 'zh') {
        const stripped = t.replace(/\b(ln|GP|GPML|KL|ELBO|Cholesky)\b/g, '');
        expect(stripped, `${c.id} zh English word`).not.toMatch(/[A-Za-z]{3,}/);
      }
    }
  });

  it('every number in each explanation that restates the answer equals the answer', () => {
    for (const seed of seeds(SEEDS)) for (const lang of ['en', 'zh'] as const) {
      const cards = deck(seed, lang);
      for (const c of cards) {
        if (!c.fields) continue;
        const nums = [...c.explanation.matchAll(/(−?\d+(?:\/\d+)?(?:\.\d+)?)/g)].map(m => m[1]);
        for (const f of c.fields) {
          const ok = nums.some(t => {
            const v = t.includes('/') ? Number(t.split('/')[0].replace('−', '-')) / Number(t.split('/')[1]) : num(t);
            return Math.abs(v - f.answer) <= 0.006;
          });
          expect(ok, `${c.id} ${lang} seed ${seed}: answer ${f.answer} not restated in explanation: ${c.explanation}`).toBe(true);
        }
      }
    }
  });
});

function logpdfIdentity(N: number): number {
  // lp(I_N, 0) = -(N/2) ln 2pi by summing N standard-normal log densities at 0
  let s = 0; for (let i = 0; i < N; i++) s += -0.5 * LN2PI_TRUE; return s;
}
void questionTextOf; void MINUS;
