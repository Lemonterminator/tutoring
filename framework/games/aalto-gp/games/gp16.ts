import type { CardGenerator } from '../../types';
import { exact, frac, gcd, makeGpDeck, num, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** "n/d" followed by its reduced form only when that differs ("16/40 = 2/5", but "4/5" when already reduced). */
const eq = (n: number, d: number): string => (gcd(n, d) === 1 || d === 1 ? exact(n / d) : `${n}/${d} = ${exact(n / d)}`);
/** A rational in parentheses when negative: (−1/2). */
const parExact = (x: number): string => (x < 0 ? `(${exact(x)})` : exact(x));
/** Remove binary noise from computed answers (0.1616000000002 -> 0.1616). */
const clean = (x: number): number => Math.round(x * 1e9) / 1e9;
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// --- Shared constants ---
const GIBBS_EN = 'K(x, x′) = √(2ℓ(x)ℓ(x′)/(ℓ(x)² + ℓ(x′)²)) · exp(−(x − x′)²/(ℓ(x)² + ℓ(x′)²))';
const GIBBS_ZH = 'K(x, x′) = √(2ℓ(x)ℓ(x′)/(ℓ(x)² + ℓ(x′)²)) · exp(−(x − x′)²/(ℓ(x)² + ℓ(x′)²))';

const TAB_KEYS = [0.1, 0.2, 0.4, 0.8, 1.6];
const TAB_VALS = [0.905, 0.819, 0.670, 0.449, 0.202];
const TABLE_EN = 'exp(−0.1) = 0.905, exp(−0.2) = 0.819, exp(−0.4) = 0.670, exp(−0.8) = 0.449, exp(−1.6) = 0.202';
const TABLE_ZH = 'e 的 −0.1 次方 = 0.905，e 的 −0.2 次方 = 0.819，e 的 −0.4 次方 = 0.670，e 的 −0.8 次方 = 0.449，e 的 −1.6 次方 = 0.202';

function tabLookup(t: number): number {
  for (let i = 0; i < TAB_KEYS.length; i++) {
    if (Math.abs(TAB_KEYS[i] - t) < 1e-9) return TAB_VALS[i];
  }
  throw new Error('tabLookup: t not in table');
}

// --- Card 4: 14 ordered pairs ---
const CARD4_PAIRS: [number, number][] = [
  [1, 2], [2, 1], [2, 4], [4, 2], [3, 6], [6, 3], [4, 8], [8, 4],
  [1, 3], [3, 1], [2, 6], [6, 2], [3, 9], [9, 3],
];

// --- Card 5 & 9: 32 triples ---
const CARD5_TRIPLES: [number, number, number][] = [
  [1, 2, 1], [1, 2, 2], [2, 1, 1], [2, 1, 2],
  [2, 4, 1], [2, 4, 2], [2, 4, 4], [4, 2, 1], [4, 2, 2], [4, 2, 4],
  [3, 6, 3], [3, 6, 6], [6, 3, 3], [6, 3, 6],
  [4, 8, 2], [4, 8, 4], [4, 8, 8], [8, 4, 2], [8, 4, 4], [8, 4, 8],
  [1, 3, 1], [1, 3, 2], [3, 1, 1], [3, 1, 2],
  [2, 6, 2], [2, 6, 4], [6, 2, 2], [6, 2, 4],
  [3, 9, 3], [3, 9, 6], [9, 3, 3], [9, 3, 6],
];

// --- Card 7: string pool and 2-mer list ---
const STRINGS = ['AAGGTGAA', 'TGAAAGGC', 'TGGGACGC', 'TCCTGGTT', 'TGGGGCGC', 'TCTAGGTG'];
const TWOMERS = ['GT', 'TG', 'AA', 'GG', 'CG'];

function count2mer(s: string, m: string): number {
  let c = 0;
  for (let i = 0; i <= s.length - 2; i++) {
    if (s[i] === m[0] && s[i + 1] === m[1]) c++;
  }
  return c;
}

// Encode a string as an array of letter positions (A=1, C=2, G=3, T=4)
function encodeStr(s: string): number[] {
  const map: Record<string, number> = { A: 1, C: 2, G: 3, T: 4 };
  return s.split('').map(ch => map[ch]);
}

// Enumerate 72 passing tuples for card 7
type KmerTuple = { x: string; xp: string; s1: string; s2: string; w1: number; w2: number; T: number };
const KMER_TUPLES: KmerTuple[] = (() => {
  const result: KmerTuple[] = [];
  for (let i = 0; i < STRINGS.length; i++) {
    for (let j = i + 1; j < STRINGS.length; j++) {
      const x = STRINGS[i], xp = STRINGS[j];
      for (let m1 = 0; m1 < TWOMERS.length; m1++) {
        for (let m2 = m1 + 1; m2 < TWOMERS.length; m2++) {
          const s1 = TWOMERS[m1], s2 = TWOMERS[m2];
          for (const w1 of [1, 2, 3]) {
            for (const w2 of [1, 2, 3]) {
              if (w1 === w2) continue;
              const c1x = count2mer(x, s1), c1y = count2mer(xp, s1);
              const c2x = count2mer(x, s2), c2y = count2mer(xp, s2);
              const T = w1 * c1x * c1y + w2 * c2x * c2y;
              if (T < 3 || T > 40) continue;
              const R1 = (() => {
                const nc = (s: string, m: string) => {
                  let c = 0, pos = 0;
                  while (true) { const idx = s.indexOf(m, pos); if (idx === -1) break; c++; pos = idx + 2; }
                  return c;
                };
                return w1 * nc(x, s1) * nc(xp, s1) + w2 * nc(x, s2) * nc(xp, s2);
              })();
              const R2 = 1 * c1x * c1y + 1 * c2x * c2y;
              const R3 = w1 * (c1x + c1y) + w2 * (c2x + c2y);
              const R4 = w1 * c1x * c1y;
              const R5 = w2 * c2x * c2y;
              const R6 = w2 * c1x * c1y + w1 * c2x * c2y;
              const R7 = (w1 * c1x + w2 * c2x) * (w1 * c1y + w2 * c2y);
              const routes = [R1, R2, R3, R4, R5, R6, R7];
              if (routes.some(r => Math.abs(r - T) < 1)) continue;
              result.push({ x, xp, s1, s2, w1, w2, T });
            }
          }
        }
      }
    }
  }
  return result;
})();

// --- Card 8: enumerate 2914 ordered pairs ---
type PatchTuple = { x: [number, number, number]; xp: [number, number, number]; T: number };
const PATCH_TUPLES: PatchTuple[] = (() => {
  const result: PatchTuple[] = [];
  for (let x1 = 0; x1 <= 3; x1++)
    for (let x2 = 0; x2 <= 3; x2++)
      for (let x3 = 0; x3 <= 3; x3++) {
        const sx = x1 + x2 + x3;
        if (sx === 0) continue;
        for (let y1 = 0; y1 <= 3; y1++)
          for (let y2 = 0; y2 <= 3; y2++)
            for (let y3 = 0; y3 <= 3; y3++) {
              const sy = y1 + y2 + y3;
              if (sy === 0) continue;
              if (x1 === y1 && x2 === y2 && x3 === y3) continue;
              const v11 = x1 * y1 + x2 * y2;
              const v12 = x1 * y2 + x2 * y3;
              const v21 = x2 * y1 + x3 * y2;
              const v22 = x2 * y2 + x3 * y3;
              const T = v11 + v12 + v21 + v22;
              if (T < 4 || T > 40) continue;
              const R1 = v11 + v22;
              const R2 = x1 * y1 + x2 * y2 + x3 * y3;
              const R3 = T / 4;
              const R4 = sx * sy;
              const R5 = v11, R6 = v12, R7 = v21, R8 = v22;
              const routes = [R1, R2, R3, R4, R5, R6, R7, R8];
              if (routes.some(r => Math.abs(r - T) < 1)) continue;
              result.push({ x: [x1, x2, x3], xp: [y1, y2, y3], T });
            }
      }
  return result;
})();

// --- Card 2: enumerate 32 passing triples ---
type AsymTuple = { a: number; b: number; d: number; T: number };
const ASYM_TUPLES: AsymTuple[] = (() => {
  const result: AsymTuple[] = [];
  for (let a = 1; a <= 5; a++)
    for (let b = 1; b <= 5; b++) {
      if (a === b) continue;
      for (let d = 1; d <= 8; d++) {
        const T = (d * d / 2) * (1 / (b * b) - 1 / (a * a));
        if (T === 0 || Math.abs(T) > 10) continue;
        const num_ = d * d * (a * a - b * b);
        const den_ = 2 * a * a * b * b;
        const g = (x: number, y: number): number => y === 0 ? x : g(y, x % y);
        const gcd = g(Math.abs(num_), Math.abs(den_));
        const redDen = Math.abs(den_) / gcd;
        if (![1, 2, 4, 5, 8, 10].includes(redDen)) continue;
        const w1 = -d * d / (2 * a * a);
        const w2 = -d * d / (2 * b * b);
        const w3 = d * d * (1 / (b * b) - 1 / (a * a));
        const w4 = -T;
        const w5 = (d * d / 2) * (1 / b - 1 / a);
        const w6 = 0;
        const w7 = (d * d / 2) * (1 / (a * a) + 1 / (b * b));
        const routes = [w1, w2, w3, w4, w5, w6, w7];
        if (routes.some(r => Math.abs(r - T) < 0.02)) continue;
        result.push({ a, b, d, T });
      }
    }
  return result;
})();

// --- Card 3: enumerate 46 passing triples ---
type ExpTuple = { a: number; b: number; d: number; E: number };
const EXP_TUPLES: ExpTuple[] = (() => {
  const result: ExpTuple[] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) {
      if (a === b) continue;
      for (let d = 1; d <= 8; d++) {
        const E = (d * d) / (a * a + b * b);
        if (E < 0.1 || E > 5) continue;
        const num_ = d * d;
        const den_ = a * a + b * b;
        const g = (x: number, y: number): number => y === 0 ? x : g(y, x % y);
        const gcd = g(Math.abs(num_), Math.abs(den_));
        const redDen = Math.abs(den_) / gcd;
        if (![1, 2, 4, 5, 8, 10].includes(redDen)) continue;
        const w1 = d * d / (2 * a * a);
        const w2 = d * d / (2 * b * b);
        const w3 = d * d / ((a + b) * (a + b));
        const w4 = d * d / (2 * a * b);
        const w5 = 2 * d * d / (a * a + b * b);
        const w6 = d / (a * a + b * b);
        const w7 = d * d / (a * a * b * b);
        const w8 = d * d / (2 * (a * a + b * b));
        const routes = [w1, w2, w3, w4, w5, w6, w7, w8];
        if (routes.some(r => Math.abs(r - E) < 0.02)) continue;
        result.push({ a, b, d, E });
      }
    }
  return result;
})();

export const gp16: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-16');
  warm(g);

  // Card 1
  const c1 = retry(() => ({ s: g.pick([2, 3, 4, 5]), a: g.pick([2, 3, 4, 5, 6]) }), v => true);

  // Card 2
  const c2 = retry(() => ASYM_TUPLES[g.random(0, ASYM_TUPLES.length - 1)], v => true);

  // Card 3
  const c3 = retry(() => EXP_TUPLES[g.random(0, EXP_TUPLES.length - 1)], v => true);

  // Card 4
  const c4 = retry(() => CARD4_PAIRS[g.random(0, CARD4_PAIRS.length - 1)], v => true);

  // Card 5
  const c5 = retry(() => CARD5_TRIPLES[g.random(0, CARD5_TRIPLES.length - 1)], v => true);

  // Card 6
  const c6 = retry(() => ({
    xa: g.random(0, 7), xb: g.random(0, 7), g_: g.pick([1, 2]), ell: g.pick([2, 3, 4]),
  }), v => v.xa !== v.xb);

  // Card 7
  const c7 = retry(() => KMER_TUPLES[g.random(0, KMER_TUPLES.length - 1)], v => true);

  // Card 8
  const c8 = retry(() => PATCH_TUPLES[g.random(0, PATCH_TUPLES.length - 1)], v => true);

  // Card 9
  const c9 = retry(() => {
    const tri = CARD5_TRIPLES[g.random(0, CARD5_TRIPLES.length - 1)];
    const pq = g.pick([[1, 2], [2, 1]]);
    return { a: tri[0], b: tri[1], d: tri[2], p: pq[0], q: pq[1] };
  }, v => true);

  // --- Compute derived values ---
  // Card 1
  const c1_answer = c1.s;

  // Card 2
  const c2_l1 = -(c2.d * c2.d) / (2 * c2.a * c2.a);
  const c2_l2 = -(c2.d * c2.d) / (2 * c2.b * c2.b);
  const c2_answer = clean(c2.T);

  // Card 3
  const c3_S = c3.a * c3.a + c3.b * c3.b;
  const c3_d2 = c3.d * c3.d;
  const c3_answer = clean(c3.E);
  const c3_E1 = c3.d * c3.d / (2 * c3.a * c3.a);
  const c3_E2 = c3.d * c3.d / (2 * c3.b * c3.b);

  // Card 4
  const c4_2ab = 2 * c4[0] * c4[1];
  const c4_S = c4[0] * c4[0] + c4[1] * c4[1];
  const c4_r = c4_2ab / c4_S;
  const c4_min = Math.min(c4[0], c4[1]);
  const c4_max = Math.max(c4[0], c4[1]);
  const c4_answer = clean(c4_r);

  // Card 5
  const c5_a = c5[0], c5_b = c5[1], c5_d = c5[2];
  const c5_2ab = 2 * c5_a * c5_b;
  const c5_S = c5_a * c5_a + c5_b * c5_b;
  const c5_r = c5_2ab / c5_S;
  const c5_E = (c5_d * c5_d) / c5_S;
  const c5_2E = 2 * c5_E;
  const c5_TAB = tabLookup(c5_2E);
  const c5_T = c5_r * c5_TAB;
  const c5_tab = c5_TAB.toFixed(3);
  const c5_answer = clean(c5_T);

  // Card 6
  const c6_xa = c6.xa, c6_xb = c6.xb, c6_g = c6.g_, c6_ell = c6.ell;
  const c6_xa2 = c6_xa + c6_g, c6_xb2 = c6_xb + c6_g;
  const c6_uaL = c6_xa * c6_xa, c6_uaR = c6_xa2 * c6_xa2;
  const c6_ubL = c6_xb * c6_xb, c6_ubR = c6_xb2 * c6_xb2;
  const c6_uA = c6_uaR - c6_uaL;
  const c6_uB = c6_ubR - c6_ubL;
  const c6_X = c6_xa < c6_xb ? 'A' : 'B';
  const c6_Y = c6_xa < c6_xb ? 'B' : 'A';
  const c6_uX = c6_xa < c6_xb ? c6_uA : c6_uB;
  const c6_uY = c6_xa < c6_xb ? c6_uB : c6_uA;

  // Card 7
  const c7_c1x = count2mer(c7.x, c7.s1), c7_c1y = count2mer(c7.xp, c7.s1);
  const c7_c2x = count2mer(c7.x, c7.s2), c7_c2y = count2mer(c7.xp, c7.s2);
  const c7_t1 = c7.w1 * c7_c1x * c7_c1y;
  const c7_t2 = c7.w2 * c7_c2x * c7_c2y;
  const c7_answer = c7.T;
  const c7_R1 = (() => {
    const nc = (s: string, m: string) => { let c = 0, pos = 0; while (true) { const idx = s.indexOf(m, pos); if (idx === -1) break; c++; pos = idx + 2; } return c; };
    return c7.w1 * nc(c7.x, c7.s1) * nc(c7.xp, c7.s1) + c7.w2 * nc(c7.x, c7.s2) * nc(c7.xp, c7.s2);
  })();
  const c7_R2 = 1 * c7_c1x * c7_c1y + 1 * c7_c2x * c7_c2y;

  // Card 8
  const c8_x = c8.x, c8_xp = c8.xp;
  const c8_v11 = c8_x[0] * c8_xp[0] + c8_x[1] * c8_xp[1];
  const c8_v12 = c8_x[0] * c8_xp[1] + c8_x[1] * c8_xp[2];
  const c8_v21 = c8_x[1] * c8_xp[0] + c8_x[2] * c8_xp[1];
  const c8_v22 = c8_x[1] * c8_xp[1] + c8_x[2] * c8_xp[2];
  const c8_answer = c8.T;
  const c8_R1 = c8_v11 + c8_v22;
  const c8_R2 = c8_x[0] * c8_xp[0] + c8_x[1] * c8_xp[1] + c8_x[2] * c8_xp[2];
  const c8_sx1 = c8_x[0] + c8_x[1], c8_sx2 = c8_x[1] + c8_x[2];
  const c8_sy1 = c8_xp[0] + c8_xp[1], c8_sy2 = c8_xp[1] + c8_xp[2];

  // Card 9
  const c9_a = c9.a, c9_b = c9.b, c9_d = c9.d, c9_p = c9.p, c9_q = c9.q;
  const c9_2ab = 2 * c9_a * c9_b;
  const c9_S = c9_a * c9_a + c9_b * c9_b;
  const c9_r = c9_2ab / c9_S;
  const c9_E = (c9_d * c9_d) / c9_S;
  const c9_2E = 2 * c9_E;
  const c9_TAB = tabLookup(c9_2E);
  const c9_K2 = c9_r * c9_TAB;
  const c9_p2q2 = c9_p * c9_p * c9_q * c9_q;
  const c9_tab = c9_TAB.toFixed(3);
  const c9_answer = clean(c9_p2q2 * (1 - c9_K2));

  return [
    // Card 1: gibbs-diagonal
    g.number({
      id: 'gibbs-diagonal',
      title: t('The variance does not move', '方差不随长度尺度变化'),
      prompt: t(
        `A Gaussian process has the covariance function k(x, x′) = ${c1.s} · K(x, x′), where K is the Gibbs kernel ${GIBBS_EN}. At the input x the length-scale is ℓ(x) = ${c1.a}. What is the variance k(x, x) of f(x)? Give an integer.`,
        `高斯过程的协方差函数为 k(x, x′) = ${c1.s} · K(x, x′)，其中 K 是吉布斯核 ${GIBBS_ZH}。在输入 x 处长度尺度为 ℓ(x) = ${c1.a}。f(x) 的方差 k(x, x) 是多少？请填整数。`
      ),
      fields: [{ label: t('k(x, x)', 'k(x, x)'), answer: c1_answer, tolerance: 0.006 }],
      hint: t(
        'The variance is k(x, x). Put x′ = x into K: what do the square root and the exponential become?',
        '方差就是 k(x, x)。把 x′ = x 代入 K：根号和指数分别变成什么？'
      ),
      explanation: t(
        `Put x′ = x. Then ℓ(x′) = ℓ(x) = ${c1.a}, the square root becomes √(2·${c1.a}·${c1.a}/(${c1.a}² + ${c1.a}²)) = √1 = 1 and the exponent is −0/(…) = 0, so exp(0) = 1. Hence K(x, x) = 1 and k(x, x) = ${c1.s} · 1 = ${c1.s} (Lecture 5 p. 73 eq. 64; GPML pdf p. 111: "k(x, x) = 1 for all x"). The length-scale controls how fast the correlation falls with distance, not the variance. Multiplying by ℓ(x) would give ${c1.s * c1.a}, dividing would give ${exact(c1.s / c1.a)}. This game does not assess fitting ℓ(x) to data.`,
        `取 x′ = x，则 ℓ(x′) = ℓ(x) = ${c1.a}，根号变为 √(2·${c1.a}·${c1.a}/(${c1.a}² + ${c1.a}²)) = √1 = 1，指数为 0，exp(0) = 1。所以 K(x, x) = 1，k(x, x) = ${c1.s} · 1 = ${c1.s}（第 5 讲第 73 页式 64；GPML pdf 第 111 页：对所有 x 有 k(x, x) = 1）。长度尺度决定相关性随距离衰减的快慢，不决定方差。若乘以 ℓ(x) 会得到 ${c1.s * c1.a}，若除以则得到 ${exact(c1.s / c1.a)}。本游戏不考查如何用数据拟合 ℓ(x)。`
      ),
      audit: { kind: 'GP-16:gibbs-diagonal', params: { s: c1.s, a: c1.a } },
    }),

    // Card 2: naive-asymmetry
    g.number({
      id: 'naive-asymmetry',
      title: t('Just plug in ℓ(x)?', '直接把 ℓ(x) 代入？'),
      prompt: t(
        `A student lets the SE length-scale depend on the input by writing k(x, x′) = exp(−(x − x′)²/(2ℓ(x)²)), always using the length-scale of the first argument. Take ℓ(x) = ${c2.a}, ℓ(x′) = ${c2.b} and |x − x′| = ${c2.d}. What is ln k(x, x′) − ln k(x′, x)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一位同学让 SE 核的长度尺度依赖输入，写成 k(x, x′) = exp(−(x − x′)²/(2ℓ(x)²))，总是用第一个自变量的长度尺度。取 ℓ(x) = ${c2.a}，ℓ(x′) = ${c2.b}，|x − x′| = ${c2.d}。ln k(x, x′) − ln k(x′, x) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ln k(x, x′) − ln k(x′, x)', 'ln k(x, x′) − ln k(x′, x)'), answer: c2_answer, tolerance: 0.006 }],
      hint: t(
        'k(x′, x) has x′ in the first slot. Which length-scale does the formula then use? Write both logarithms.',
        'k(x′, x) 的第一个自变量是 x′。公式此时用哪个长度尺度？把两个对数都写出来。'
      ),
      explanation: t(
        `ln k(x, x′) = −${c2.d}²/(2·${c2.a}²) = ${exact(c2_l1)} uses ℓ(x) = ${c2.a}. In k(x′, x) the first argument is x′, so ln k(x′, x) = −${c2.d}²/(2·${c2.b}²) = ${exact(c2_l2)} uses ℓ(x′) = ${c2.b}. The difference is ${parExact(c2_l1)} − ${parExact(c2_l2)} = ${exact(c2_answer)}, not 0. So k(x, x′) ≠ k(x′, x): a covariance must satisfy Cov(f(x), f(x′)) = Cov(f(x′), f(x)), hence this k is not a covariance function. GPML pdf p. 111 warns that making length-scales functions of x does not in general give a valid covariance function. The Gibbs kernel repairs the symmetry by using the symmetric pair ℓ(x)² + ℓ(x′)² and the normaliser in front (Lecture 5 p. 73). This game does not assess when other warped constructions are valid.`,
        `ln k(x, x′) = −${c2.d}²/(2·${c2.a}²) = ${exact(c2_l1)}，用的是 ℓ(x) = ${c2.a}。在 k(x′, x) 中第一个自变量是 x′，所以 ln k(x′, x) = −${c2.d}²/(2·${c2.b}²) = ${exact(c2_l2)}，用的是 ℓ(x′) = ${c2.b}。差为 ${parExact(c2_l1)} − ${parExact(c2_l2)} = ${exact(c2_answer)}，不为 0。所以 k(x, x′) ≠ k(x′, x)：协方差必须满足 Cov(f(x), f(x′)) = Cov(f(x′), f(x))，因此这个 k 不是协方差函数。GPML pdf 第 111 页提醒：让长度尺度成为 x 的函数，一般不能得到合法的协方差函数。吉布斯核用对称的 ℓ(x)² + ℓ(x′)² 和前面的归一化因子修复了对称性（第 5 讲第 73 页）。本游戏不考查其他变形构造何时合法。`
      ),
      audit: { kind: 'GP-16:naive-asymmetry', params: { a: c2.a, b: c2.b, d: c2.d } },
    }),

    // Card 3: gibbs-exponent
    g.number({
      id: 'gibbs-exponent',
      title: t('What is inside the exponential?', '指数里是什么？'),
      prompt: t(
        `The Gibbs kernel is ${GIBBS_EN}. Write it as K(x, x′) = (square root factor) · exp(−E). Take ℓ(x) = ${c3.a}, ℓ(x′) = ${c3.b} and x − x′ = ${c3.d}. What is E? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `吉布斯核为 ${GIBBS_ZH}。把它写成 K(x, x′) = （根号因子）· exp(−E)。取 ℓ(x) = ${c3.a}，ℓ(x′) = ${c3.b}，x − x′ = ${c3.d}。E 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('E', 'E'), answer: c3_answer, tolerance: 0.006 }],
      hint: t(
        'Square each length-scale first, then combine the two squares. Compare with the SE kernel, which has one length-scale.',
        '先把每个长度尺度平方，再合并这两个平方。想一想只有一个长度尺度的 SE 核。'
      ),
      explanation: t(
        `The denominator of the exponent is ℓ(x)² + ℓ(x′)² = ${c3.a}² + ${c3.b}² = ${c3.a * c3.a} + ${c3.b * c3.b} = ${c3_S}. The numerator is (x − x′)² = ${c3.d}² = ${c3_d2}. So E = ${eq(c3_d2, c3_S)} (Lecture 5 p. 73 eq. 64). When the two length-scales are equal to ℓ the denominator is 2ℓ², the familiar SE exponent; with different lengths it is the sum of both squares. Using 2ℓ(x)² alone would give ${exact(c3_E1)}; using 2ℓ(x′)² alone would give ${exact(c3_E2)}.`,
        `指数的分母是 ℓ(x)² + ℓ(x′)² = ${c3.a}² + ${c3.b}² = ${c3.a * c3.a} + ${c3.b * c3.b} = ${c3_S}，分子是 (x − x′)² = ${c3.d}² = ${c3_d2}。所以 E = ${eq(c3_d2, c3_S)}（第 5 讲第 73 页式 64）。两个长度尺度都等于 ℓ 时分母是 2ℓ²，即熟悉的 SE 指数；长度尺度不同时，分母是两个平方之和。若只用 2ℓ(x)² 会得到 ${exact(c3_E1)}，只用 2ℓ(x′)² 会得到 ${exact(c3_E2)}。`
      ),
      audit: { kind: 'GP-16:gibbs-exponent', params: { a: c3.a, b: c3.b, d: c3.d } },
    }),

    // Card 4: jump-prefactor
    g.number({
      id: 'jump-prefactor',
      title: t('Neighbours across a jump', '跨越突变的相邻点'),
      prompt: t(
        `The Gibbs kernel is ${GIBBS_EN}. Suppose the length-scale jumps from ℓ(x) = ${c4[0]} on one side of a boundary to ℓ(x′) = ${c4[1]} on the other side, and x and x′ lie so close to the boundary that (x − x′)² is practically 0. What is K(x, x′)²? (The square avoids a square root.) Give an integer, a fraction or a decimal rounded to 2 places.`,
        `吉布斯核为 ${GIBBS_ZH}。设长度尺度在某个边界的一侧为 ℓ(x) = ${c4[0]}，另一侧突变为 ℓ(x′) = ${c4[1]}，且 x 和 x′ 离边界非常近，使 (x − x′)² 实际上为 0。K(x, x′)² 是多少？（取平方是为了避免根号。）请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K(x, x′)²', 'K(x, x′)²'), answer: c4_answer, tolerance: 0.006 }],
      hint: t(
        'When the exponential is 1, which factor of K is left? Then square it.',
        '指数部分等于 1 时，K 中还剩哪个因子？然后把它平方。'
      ),
      explanation: t(
        `With (x − x′)² = 0 the exponential equals exp(0) = 1, so K(x, x′)² = 2ℓ(x)ℓ(x′)/(ℓ(x)² + ℓ(x′)²) = 2·${c4[0]}·${c4[1]}/(${c4[0]}² + ${c4[1]}²) = ${eq(c4_2ab, c4_S)}. So even two inputs that almost coincide have K² = ${exact(c4_r)} < 1: they are not almost perfectly correlated, because the length-scales differ. Only for equal length-scales is the prefactor 1 (card 1). GPML pdf p. 111 describes this: when the length-scale changes the covariance drops off quite sharply because of the prefactor. A smoothly varying ℓ(x) makes ℓ(x′) → ℓ(x) for neighbouring inputs and the prefactor tends to 1. The value 1 would assume equal length-scales; the ratio ${frac(c4_min, c4_max)} would confuse the radicand with the ratio of the lengths. This game does not assess how to choose ℓ(x) from data.`,
        `当 (x − x′)² = 0 时，指数等于 exp(0) = 1，所以 K(x, x′)² = 2ℓ(x)ℓ(x′)/(ℓ(x)² + ℓ(x′)²) = 2·${c4[0]}·${c4[1]}/(${c4[0]}² + ${c4[1]}²) = ${eq(c4_2ab, c4_S)}。因此即使两个输入几乎重合，K² 也只有 ${exact(c4_r)} < 1：它们并非几乎完全相关，原因是长度尺度不同。只有长度尺度相等时前置因子才等于 1（第 1 关）。GPML pdf 第 111 页描述了这一点：长度尺度变化时，由于前置因子，协方差会急剧下降。若 ℓ(x) 平滑变化，相邻输入的 ℓ(x′) → ℓ(x)，前置因子趋于 1。取 1 是假设长度尺度相等；比值 ${frac(c4_min, c4_max)} 则把根号内的量与长度尺度之比混为一谈。本游戏不考查如何由数据选取 ℓ(x)。`
      ),
      audit: { kind: 'GP-16:jump-prefactor', params: { a: c4[0], b: c4[1] } },
    }),

    // Card 5: gibbs-value
    g.number({
      id: 'gibbs-value',
      title: t('A Gibbs kernel value', '吉布斯核的取值'),
      prompt: t(
        `The Gibbs kernel is ${GIBBS_EN}. Take ℓ(x) = ${c5_a}, ℓ(x′) = ${c5_b} and x − x′ = ${c5_d}. Use these rounded values: ${TABLE_EN}. What is K(x, x′)²? (The square avoids a square root.) Give a decimal rounded to 2 places.`,
        `吉布斯核为 ${GIBBS_ZH}。取 ℓ(x) = ${c5_a}，ℓ(x′) = ${c5_b}，x − x′ = ${c5_d}。使用下列四舍五入的值：${TABLE_ZH}。K(x, x′)² 是多少？（取平方是为了避免根号。）请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K(x, x′)²', 'K(x, x′)²'), answer: c5_answer, tolerance: 0.006 }],
      hint: t(
        'Find the exponent of the kernel and the factor in front of it. Squaring the kernel changes both: what happens to the exponent?',
        '先求出核的指数和它前面的因子。把核平方会同时改变这两者：指数会怎样变化？'
      ),
      explanation: t(
        `The factor in front is 2·${c5_a}·${c5_b}/(${c5_a}² + ${c5_b}²) = ${eq(c5_2ab, c5_S)} after squaring (the square removes the root). The exponent is E = ${c5_d}²/(${c5_a}² + ${c5_b}²) = ${eq(c5_d * c5_d, c5_S)}; squaring K doubles it, so the exponential part becomes exp(−${exact(c5_2E)}) = ${c5_tab} from the table. Therefore K(x, x′)² = ${exact(c5_r)} · ${c5_tab} = ${num(c5_T)}. Forgetting the decay gives ${exact(c5_r)}; forgetting the prefactor gives ${c5_tab}. (Lecture 5 p. 73 eq. 64; the table values are rounded, so the result is rounded as well.)`,
        `前面的因子平方后是 2·${c5_a}·${c5_b}/(${c5_a}² + ${c5_b}²) = ${eq(c5_2ab, c5_S)}（平方消去了根号）。指数为 E = ${c5_d}²/(${c5_a}² + ${c5_b}²) = ${eq(c5_d * c5_d, c5_S)}；把 K 平方会使它加倍，所以指数部分是 e 的 −${exact(c5_2E)} 次方，由表得 ${c5_tab}。因此 K(x, x′)² = ${exact(c5_r)} · ${c5_tab} = ${num(c5_T)}。漏掉衰减得到 ${exact(c5_r)}，漏掉前置因子得到 ${c5_tab}。（第 5 讲第 73 页式 64；表中的值是四舍五入的，所以结果也是近似值。）`
      ),
      audit: { kind: 'GP-16:gibbs-value', params: { a: c5_a, b: c5_b, d: c5_d } },
    }),

    // Card 6: warp-stationary
    g.choice({
      id: 'warp-stationary',
      title: t('Same gap, same covariance?', '间距相同，协方差也相同吗？'),
      prompt: t(
        `A kernel is built by warping the input: k(x, x′) = exp(−(u(x) − u(x′))²/(2ℓ²)) with u(x) = x² and ℓ = ${c6_ell}. Pair A is the inputs ${c6_xa} and ${c6_xa2}; pair B is the inputs ${c6_xb} and ${c6_xb2}. Both pairs are ${c6_g} apart. Which statement is correct?`,
        `通过扭曲输入构造核：k(x, x′) = exp(−(u(x) − u(x′))²/(2ℓ²))，其中 u(x) = x²，ℓ = ${c6_ell}。数对 A 的输入是 ${c6_xa} 和 ${c6_xa2}，数对 B 的输入是 ${c6_xb} 和 ${c6_xb2}。两个数对的间距都是 ${c6_g}。下列哪条说法正确？`
      ),
      options: [
        t(`Pair ${c6_X}: its u-gap is ${c6_uX}, smaller than ${c6_uY}, so its covariance is larger.`,
          `数对 ${c6_X}：它的 u 间距为 ${c6_uX}，小于 ${c6_uY}，所以协方差更大。`),
        t(`Equal: both pairs are ${c6_g} apart in x, and the kernel depends only on the gap x − x′.`,
          `相等：两个数对在 x 上都相距 ${c6_g}，核只依赖间距 x − x′。`),
        t(`Pair ${c6_Y}: its inputs are larger, so its u-values are larger and its covariance is larger.`,
          `数对 ${c6_Y}：它的输入更大，u 值也更大，所以协方差更大。`),
        t('Neither can be ranked: replacing x by u(x) = x² makes k an invalid covariance function.',
          '无法比较：把 x 换成 u(x) = x² 之后，k 不再是合法的协方差函数。'),
      ],
      correct: 0,
      hint: t(
        'Compute u for both inputs of each pair and subtract. Which difference does the kernel actually use?',
        '对每个数对的两个输入分别算出 u，再相减。核实际用的是哪个差？'
      ),
      explanation: t(
        `The kernel is stationary in u (it depends only on u(x) − u(x′)), not in x. Pair A has the u-values ${c6_uaL} and ${c6_uaR}, so its u-gap is ${c6_uA}; pair B has ${c6_ubL} and ${c6_ubR}, so its u-gap is ${c6_uB}. A smaller u-gap gives a larger exp(−gap²/(2ℓ²)), so the pair with the smaller inputs, pair ${c6_X}, has the larger covariance, although both pairs are ${c6_g} apart in x (GPML pdf p. 110, warping). Equal gaps in x would give equal covariances only for a stationary kernel in x (Lecture 5 p. 68, K(x, x′) = K(x + a, x′ + a)); here shifting both inputs by a changes u-gaps. Warping is not a problem for validity: a valid kernel applied to u(x) stays valid. This game does not assess how to learn u.`,
        `这个核对 u 是平稳的（只依赖 u(x) − u(x′)），对 x 则不是。数对 A 的 u 值是 ${c6_uaL} 和 ${c6_uaR}，u 间距为 ${c6_uA}；数对 B 的 u 值是 ${c6_ubL} 和 ${c6_ubR}，u 间距为 ${c6_uB}。u 间距越小，exp(−间距²/(2ℓ²)) 越大，所以输入较小的数对 ${c6_X} 协方差更大，尽管两个数对在 x 上都相距 ${c6_g}（GPML pdf 第 110 页，输入扭曲）。只有对 x 平稳的核，相同的 x 间距才给出相同的协方差（第 5 讲第 68 页，K(x, x′) = K(x + a, x′ + a)）；这里把两个输入同时平移 a 会改变 u 间距。扭曲不会破坏合法性：合法的核作用在 u(x) 上仍然合法。本游戏不考查如何学习 u。`
      ),
    }),

    // Card 7: kmer-kernel
    g.number({
      id: 'kmer-kernel',
      title: t('A string kernel', '字符串核'),
      prompt: t(
        `A string kernel counts 2-mers (contiguous substrings of length 2; overlapping occurrences all count): k(x, x′) = w₁ φ₁(x) φ₁(x′) + w₂ φ₂(x) φ₂(x′), where φ₁(x) and φ₂(x) are the numbers of times the 2-mers ${c7.s1} and ${c7.s2} occur in x. Take x = ${c7.x}, x′ = ${c7.xp}, with weights w₁ = ${c7.w1} for ${c7.s1} and w₂ = ${c7.w2} for ${c7.s2}. What is k(x, x′)? Give an integer.`,
        `字符串核统计长度为 2 的连续子串（重叠出现的都要数）：k(x, x′) = w₁ φ₁(x) φ₁(x′) + w₂ φ₂(x) φ₂(x′)，其中 φ₁(x)、φ₂(x) 是子串 ${c7.s1} 和 ${c7.s2} 在 x 中出现的次数。取 x = ${c7.x}，x′ = ${c7.xp}，${c7.s1} 的权重 w₁ = ${c7.w1}，${c7.s2} 的权重 w₂ = ${c7.w2}。k(x, x′) 是多少？请填整数。`
      ),
      fields: [{ label: t('k(x, x′)', 'k(x, x′)'), answer: c7_answer, tolerance: 0.006 }],
      hint: t(
        'Slide a window of two letters along x and count how often each 2-mer appears, then do the same for x′. Check the letters shared by two neighbouring windows.',
        '沿 x 滑动一个两个字母的窗口，数每个子串出现几次，再对 x′ 做同样的事。注意相邻窗口共用的字母。'
      ),
      explanation: t(
        `Counts (overlaps included): ${c7.s1} occurs ${c7_c1x} time${c7_c1x === 1 ? '' : 's'} in ${c7.x} and ${c7_c1y} time${c7_c1y === 1 ? '' : 's'} in ${c7.xp}; ${c7.s2} occurs ${c7_c2x} time${c7_c2x === 1 ? '' : 's'} in ${c7.x} and ${c7_c2y} time${c7_c2y === 1 ? '' : 's'} in ${c7.xp}. Then k(x, x′) = ${c7.w1}·${c7_c1x}·${c7_c1y} + ${c7.w2}·${c7_c2x}·${c7_c2y} = ${c7_t1} + ${c7_t2} = ${c7_answer} (Lecture 5 p. 26, eq. 26: k(x, x′) = Σₛ wₛ φₛ(x) φₛ(x′), the dot product of the weighted count vectors). If overlapping occurrences were not counted, the answer would be ${c7_R1}; dropping the weights would give ${c7_R2}. This game does not assess long k-mers with millions of features.`,
        `各子串的次数（重叠计入）：${c7.s1} 在 ${c7.x} 中出现 ${c7_c1x} 次，在 ${c7.xp} 中出现 ${c7_c1y} 次；${c7.s2} 在 ${c7.x} 中出现 ${c7_c2x} 次，在 ${c7.xp} 中出现 ${c7_c2y} 次。于是 k(x, x′) = ${c7.w1}·${c7_c1x}·${c7_c1y} + ${c7.w2}·${c7_c2x}·${c7_c2y} = ${c7_t1} + ${c7_t2} = ${c7_answer}（第 5 讲第 26 页式 26：k(x, x′) = Σₛ wₛ φₛ(x) φₛ(x′)，即加权计数向量的点积）。若不数重叠出现，答案会是 ${c7_R1}；若忽略权重，答案会是 ${c7_R2}。本游戏不考查长 k 元子串和百万级特征。`
      ),
      audit: {
        kind: 'GP-16:kmer-kernel',
        params: {
          w1: c7.w1,
          w2: c7.w2,
        },
      },
    }),

    // Card 8: patch-sum
    g.number({
      id: 'patch-sum',
      title: t('All pairs of patches', '所有图块对'),
      prompt: t(
        `A grey-scale strip of 3 pixels, x = (${c8_x[0]}, ${c8_x[1]}, ${c8_x[2]}), has two patches of width 2: x[1] = (${c8_x[0]}, ${c8_x[1]}) and x[2] = (${c8_x[1]}, ${c8_x[2]}). A second strip x′ = (${c8_xp[0]}, ${c8_xp[1]}, ${c8_xp[2]}) has patches x′[1] and x′[2] in the same way. The patch kernel is the dot product k(u, v) = uᵀv, and the strip kernel adds it over all pairs of patches, at all positions: k(x, x′) = Σₚ Σₚ′ k(x[p], x′[p′]). What is k(x, x′)? Give an integer.`,
        `一条 3 个像素的灰度条 x = (${c8_x[0]}, ${c8_x[1]}, ${c8_x[2]}) 有两个宽度为 2 的图块：x[1] = (${c8_x[0]}, ${c8_x[1]})，x[2] = (${c8_x[1]}, ${c8_x[2]})。第二条 x′ = (${c8_xp[0]}, ${c8_xp[1]}, ${c8_xp[2]}) 以同样方式得到图块 x′[1] 和 x′[2]。图块核是点积 k(u, v) = uᵀv，条的核对所有位置上的所有图块对求和：k(x, x′) = Σₚ Σₚ′ k(x[p], x′[p′])。k(x, x′) 是多少？请填整数。`
      ),
      fields: [{ label: t('k(x, x′)', 'k(x, x′)'), answer: c8_answer, tolerance: 0.006 }],
      hint: t(
        'List all four pairs (p, p′) and evaluate the dot product for each. Include the pairs at different positions.',
        '列出全部四个 (p, p′) 对，并对每一对算点积。别漏掉位置不同的对。'
      ),
      explanation: t(
        `The four pairs: x[1]·x′[1] = ${c8_v11}, x[1]·x′[2] = ${c8_v12}, x[2]·x′[1] = ${c8_v21}, x[2]·x′[2] = ${c8_v22}. Their sum is ${c8_answer} (Lecture 5 p. 29, eqs. 27–29: the kernel compares all patch responses across all positions). Matching positions only would give ${c8_R1}; the plain dot product of the pixels ${c8_R2}. Because the patch kernel is linear, the double sum equals the dot product of the patch sums (${c8_sx1}, ${c8_sx2}) · (${c8_sy1}, ${c8_sy2}) = ${c8_answer}, a second route to the same number. This game does not assess convolutional GP inference.`,
        `四个图块对：x[1]·x′[1] = ${c8_v11}，x[1]·x′[2] = ${c8_v12}，x[2]·x′[1] = ${c8_v21}，x[2]·x′[2] = ${c8_v22}。总和为 ${c8_answer}（第 5 讲第 29 页式 27–29：核比较所有位置上的所有图块响应）。只取位置对应的图块对会得到 ${c8_R1}；直接对像素做点积会得到 ${c8_R2}。因为图块核是线性的，二重和等于图块和的点积 (${c8_sx1}, ${c8_sx2}) · (${c8_sy1}, ${c8_sy2}) = ${c8_answer}，这是通向同一个数的第二条路。本游戏不考查卷积 GP 的推断。`
      ),
      audit: { kind: 'GP-16:patch-sum', params: { x: c8_x, xp: c8_xp } },
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: a covariance matrix', '挑战：协方差矩阵'),
      prompt: t(
        `A process f has the covariance function k(x, x′) = σ(x) σ(x′) K(x, x′) with the Gibbs kernel ${GIBBS_EN}. At the inputs x and x′ we have σ(x) = ${c9_p}, σ(x′) = ${c9_q}, ℓ(x) = ${c9_a}, ℓ(x′) = ${c9_b} and x − x′ = ${c9_d}. Use these rounded values: ${TABLE_EN}. What is the determinant of the 2 × 2 covariance matrix of (f(x), f(x′))? Give a decimal rounded to 2 places.`,
        `过程 f 的协方差函数为 k(x, x′) = σ(x) σ(x′) K(x, x′)，其中 K 是吉布斯核 ${GIBBS_ZH}。在输入 x 和 x′ 处，σ(x) = ${c9_p}，σ(x′) = ${c9_q}，ℓ(x) = ${c9_a}，ℓ(x′) = ${c9_b}，x − x′ = ${c9_d}。使用下列四舍五入的值：${TABLE_ZH}。(f(x), f(x′)) 的 2 × 2 协方差矩阵的行列式是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('det', '行列式'), answer: c9_answer, tolerance: 0.006 }],
      hint: t(
        'Write the 2 × 2 matrix: variances on the diagonal, the covariance off the diagonal. Which quantity of the Gibbs kernel enters a determinant only through its square?',
        '写出 2 × 2 矩阵：对角线是方差，非对角线是协方差。吉布斯核的哪个量在行列式中只以平方的形式出现？'
      ),
      explanation: t(
        `The diagonal entries are the variances: k(x, x) = ${c9_p}²·1 = ${c9_p * c9_p} and k(x′, x′) = ${c9_q}²·1 = ${c9_q * c9_q}, because K(x, x) = 1 (card 1). The off-diagonal entry is ${c9_p}·${c9_q}·K(x, x′). The determinant is ${c9_p * c9_p}·${c9_q * c9_q} − (${c9_p}·${c9_q})²·K² = ${c9_p2q2}·(1 − K²). With the prefactor² ${exact(c9_r)} and the exponent doubled, K² = ${exact(c9_r)} · ${c9_tab} = ${num(c9_K2)}. So the determinant is ${c9_p2q2}·(1 − ${num(c9_K2)}) = ${num(c9_answer)}. It is positive because |K| < 1. Forgetting the "1 −" would give ${num(c9_p2q2 * c9_K2)}; leaving the amplitudes unsquared ${num(c9_p * c9_q * (1 - c9_K2))}. This game does not assess fitting amplitudes or length-scales.`,
        `对角线是方差：k(x, x) = ${c9_p}²·1 = ${c9_p * c9_p}，k(x′, x′) = ${c9_q}²·1 = ${c9_q * c9_q}，因为 K(x, x) = 1（第 1 关）。非对角元素是 ${c9_p}·${c9_q}·K(x, x′)。行列式为 ${c9_p * c9_p}·${c9_q * c9_q} − (${c9_p}·${c9_q})²·K² = ${c9_p2q2}·(1 − K²)。前置因子的平方是 ${exact(c9_r)}，指数加倍，故 K² = ${exact(c9_r)} · ${c9_tab} = ${num(c9_K2)}。所以行列式为 ${c9_p2q2}·(1 − ${num(c9_K2)}) = ${num(c9_answer)}。因为 |K| < 1，它为正。漏掉“1 −”会得到 ${num(c9_p2q2 * c9_K2)}；不平方振幅会得到 ${num(c9_p * c9_q * (1 - c9_K2))}。本游戏不考查振幅或长度尺度的拟合。`
      ),
      audit: { kind: 'GP-16:challenge', params: { p: c9_p, q: c9_q, a: c9_a, b: c9_b, d: c9_d } },
    }),
  ];
};
