import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function reducedDenominator(x: number): number {
  const r = Math.round(x * 1000000) / 1000000;
  const d = 1000000;
  const n = Math.round(r * d);
  return d / gcd(n, d);
}
/** every wrong route must differ from the truth by at least `gap` on every draw (checked here, at enumeration time) */
const gapOk = (truth: number, wrongs: number[], gap = 0.1) => wrongs.every(w => Math.abs(w - truth) >= gap - 1e-9);
/** fraction in parentheses when it is negative or contains a bar, for use next to a product dot */
const pf = (x: number): string => { const e = exact(x); return e.includes('/') || x < 0 ? `(${e})` : e; };
/** product text without a leading 1· coefficient; a zero factor prints 0 */
const mt = (x: number, y: number): string => (x === 0 || y === 0 ? '0' : x === 1 ? (y < 0 ? pf(y) : exact(y)) : y === 1 ? (x < 0 ? pf(x) : exact(x)) : `${pf(x)}·${pf(y)}`);
const ALLOWED_DENOMS = new Set([1, 2, 4, 5, 8, 10]);
const denomOk = (x: number) => ALLOWED_DENOMS.has(reducedDenominator(x));

// Card 1: 24 triples
const C1_SETS: [number, number, number][] = [
  [2, 0.5, 1.5], [2, 0.5, 2], [2, 0.5, 3], [2, 1.5, 0.5], [2, 1.5, 2], [2, 2, 0.5],
  [2, 2, 1.5], [2, 2, 3], [2, 3, 0.5], [2, 3, 2], [4, 0.5, 2], [4, 0.5, 3],
  [4, 1.5, 2], [4, 2, 0.5], [4, 2, 1.5], [4, 2, 3], [4, 3, 0.5], [4, 3, 2],
  [5, 0.5, 2], [5, 0.5, 3], [5, 2, 0.5], [5, 2, 3], [5, 3, 0.5], [5, 3, 2],
];

// Card 2: 286 sets
const C2_AB: [number, number][] = [[3, 1], [3, 2], [2, 1], [1.5, 0.5], [2.5, 1.5]];
const C2_SETS: [number, number, number, number, number, number][] = [];
for (const [a, b] of C2_AB) {
  const D = a * a - b * b;
  for (let p1 = 0; p1 <= 3; p1++) for (let p2 = 0; p2 <= 3; p2++) {
    if (p1 === p2) continue;
    for (let q1 = 0; q1 <= 3; q1++) for (let q2 = 0; q2 <= 3; q2++) {
      if (q1 === q2) continue;
      if (p1 === q1 && p2 === q2) continue;
      const S = p1 * q1 + p2 * q2;
      const X = p1 * q2 + p2 * q1;
      if (S < 1 || X < 1) continue;
      const T = (a * S - b * X) / D;
      if (T <= 0 || !denomOk(T)) continue;
      if (!gapOk(T, [(a * S + b * X) / D, a * S + b * X, a * S - b * X, S, S / a, (a * S - b * X) / a])) continue;
      C2_SETS.push([a, b, p1, p2, q1, q2]);
    }
  }
}

// Card 3: 30 triples
const C3_SETS: [number, number, number][] = [
  [2, 2, 3], [2, 2, 5], [2, 2, 6], [2, 2, 8],
  [2, 3, 5], [2, 3, 6], [2, 3, 8],
  [4, 2, 3], [4, 2, 4], [4, 2, 5], [4, 2, 6], [4, 2, 8],
  [4, 3, 3], [4, 3, 4], [4, 3, 5], [4, 3, 6], [4, 3, 8],
  [5, 2, 1], [5, 2, 2], [5, 2, 3], [5, 2, 4], [5, 2, 5], [5, 2, 6], [5, 2, 8],
  [5, 3, 2], [5, 3, 3], [5, 3, 4], [5, 3, 5], [5, 3, 6], [5, 3, 8],
];

// Card 4: 18 pairs
const C4_SETS: [number, number][] = [
  [5, 2], [5, 3], [6, 2], [6, 4], [7, 2], [7, 3], [7, 4],
  [8, 2], [8, 3], [9, 2], [9, 3], [9, 4],
  [10, 2], [10, 3], [10, 4], [12, 2], [12, 3], [12, 4],
];

// Card 5: 12 pairs
const C5_SETS: [number, number][] = [
  [4, 2], [5, 2], [5, 3], [6, 2], [6, 3], [6, 4],
  [8, 2], [8, 3], [8, 4], [10, 2], [10, 3], [10, 4],
];

// Card 6: 1024 sets
const C6_SETS: [number, number, number, number, number, number, number, number][] = [];
for (const sg of [2, 4]) {
  for (const tVal of [0.5, 1, 2]) {
    for (let a1 = 0; a1 <= 2; a1++) for (let b1 = 0; b1 <= 2; b1++) {
      if (a1 === 0 && b1 === 0) continue;
      for (let a2 = 0; a2 <= 2; a2++) for (let b2 = 0; b2 <= 2; b2++) {
        if (a2 === 0 && b2 === 0) continue;
        for (let a3 = 0; a3 <= 2; a3++) for (let b3 = 0; b3 <= 2; b3++) {
          if (a3 === 0 && b3 === 0) continue;
          const nonZeroRows = (a1 !== 0 && b1 !== 0 ? 1 : 0) + (a2 !== 0 && b2 !== 0 ? 1 : 0) + (a3 !== 0 && b3 !== 0 ? 1 : 0);
          if (nonZeroRows < 2) continue;
          const d = a1 * b1 + a2 * b2 + a3 * b3;
          if (d < 1) continue;
          const T = tVal + d / sg;
          if (!denomOk(T)) continue;
          const c = a1 * a2 + b1 * b2;
          if (!gapOk(T, [d / sg, tVal + d, tVal + d * sg, tVal + c / sg, tVal + c, d, tVal])) continue;
          C6_SETS.push([sg, tVal, a1, b1, a2, b2, a3, b3]);
        }
      }
    }
  }
}

// Card 7: 22 tuples
const C7_SETS: [number, number, number, number][] = [
  [1, 1, 1, 0.5], [1, 3, 1, 2], [2, 1, 1, 0.25], [4, 1, 1, 0.5],
  [4, 2, 2, 0.5], [4, 3, 1, 0.5], [4, 3, 2, 0.5], [4, 3, 3, 0.5],
  [4, 3, 5, 0.5], [5, 3, 1, 0.25], [6, 1, 1, 0.5], [6, 1, 2, 0.5],
  [6, 2, 3, 0.5], [6, 2, 5, 0.5], [6, 3, 2, 0.5], [6, 4, 1, 0.5],
  [8, 1, 1, 0.25], [8, 2, 2, 0.25], [8, 3, 1, 0.25], [8, 3, 2, 0.25],
  [8, 3, 3, 0.25], [8, 3, 5, 0.25],
];

// Card 8: 10 pairs
const C8_SETS: [number, number][] = [
  [1000, 20], [1000, 50], [1000, 100], [2000, 20], [2000, 50],
  [2000, 100], [2500, 50], [2500, 100], [5000, 50], [5000, 100],
];

// Card 9: 3210 sets
const C9_SETS: [number, number, number, number, number, number, number, number][] = [];
for (const s of [1, 2, 4]) {
  for (const sg of [2, 4]) {
    for (let a1 = 0; a1 <= 3; a1++) for (let a2 = 0; a2 <= 3; a2++) for (let a3 = 0; a3 <= 3; a3++) {
      if (a1 === a2 && a2 === a3) continue;
      if (a1 === 0 && a2 === 0 && a3 === 0) continue;
      for (let y1 = -2; y1 <= 2; y1++) for (let y2 = -2; y2 <= 2; y2++) for (let y3 = -2; y3 <= 2; y3++) {
        const nonZeroY = (y1 !== 0 ? 1 : 0) + (y2 !== 0 ? 1 : 0) + (y3 !== 0 ? 1 : 0);
        if (nonZeroY < 2) continue;
        const ay = a1 * y1 + a2 * y2 + a3 * y3;
        if (ay === 0) continue;
        const yy = y1 * y1 + y2 * y2 + y3 * y3;
        const aa = a1 * a1 + a2 * a2 + a3 * a3;
        const m = s + aa / sg;
        const T = yy / sg - (ay * ay) / (sg * sg * m);
        if (!denomOk(T)) continue;
        if (!gapOk(T, [yy / sg, yy / sg + (ay * ay) / (sg * sg * m), yy / sg - (ay * ay) / (sg * m), yy / sg - (ay * ay) / (sg * sg * (s + aa)), (ay * ay) / (sg * sg * m), yy / sg - ay / (sg * sg * m)])) continue;
        C9_SETS.push([s, sg, a1, a2, a3, y1, y2, y3]);
      }
    }
  }
}

const nd = (x: number): number[] => { for (let d = 1; d <= 64; d++) { const n = Math.round(x * d); if (Math.abs(x * d - n) < 1e-9) return d === 1 ? [n] : [n, d]; } return [x]; };
export const gp21: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-21');
  warm(g);

  // Card 1
  const c1 = C1_SETS[g.random(0, C1_SETS.length - 1)];
  const [s1, a1_1, a2_1] = c1;
  const T1 = a1_1 * a2_1 / s1;

  // Card 2
  const c2 = C2_SETS[g.random(0, C2_SETS.length - 1)];
  const [a2, b2, p1, p2, q1, q2] = c2;
  const D2 = a2 * a2 - b2 * b2;
  const S2 = p1 * q1 + p2 * q2;
  const X2 = p1 * q2 + p2 * q1;
  const T2 = (a2 * S2 - b2 * X2) / D2;
  const u1_2 = p1 * a2 - p2 * b2, u2_2 = p2 * a2 - p1 * b2;
  const numN2 = a2 * S2 - b2 * X2;
  const raw2 = `${pf(numN2)}/${num(D2)}`;
  const tail2 = raw2 === exact(T2) ? exact(T2) : `${raw2} = ${exact(T2)}`;

  // Card 3
  const c3 = C3_SETS[g.random(0, C3_SETS.length - 1)];
  const [s3, a3, v3] = c3;
  const T3 = v3 - (a3 * a3) / s3;

  // Card 4
  const c4 = C4_SETS[g.random(0, C4_SETS.length - 1)];
  const [N4, M4] = c4;
  const T4 = N4 - M4;

  // Card 5
  const c5 = C5_SETS[g.random(0, C5_SETS.length - 1)];
  const [N5, M5] = c5;

  // Card 6
  const c6 = C6_SETS[g.random(0, C6_SETS.length - 1)];
  const [sg6, t6, a1_6, b1_6, a2_6, b2_6, a3_6, b3_6] = c6;
  const d6 = a1_6 * b1_6 + a2_6 * b2_6 + a3_6 * b3_6;
  const T6 = t6 + d6 / sg6;

  // Card 7
  const c7 = C7_SETS[g.random(0, C7_SETS.length - 1)];
  const [s7, a1_7, a2_7, sg7] = c7;
  const m7 = s7 + (a1_7 * a1_7 + a2_7 * a2_7) / sg7;
  const T7 = 1 / sg7 - (a1_7 * a1_7) / (sg7 * sg7 * m7);

  // Card 8
  const c8 = C8_SETS[g.random(0, C8_SETS.length - 1)];
  const [N8, M8] = c8;
  const T8 = Math.pow(N8 / M8, 2);

  // Card 9
  const c9 = C9_SETS[g.random(0, C9_SETS.length - 1)];
  const [s9, sg9, a1_9, a2_9, a3_9, y1_9, y2_9, y3_9] = c9;
  const ay9 = a1_9 * y1_9 + a2_9 * y2_9 + a3_9 * y3_9;
  const yy9 = y1_9 * y1_9 + y2_9 * y2_9 + y3_9 * y3_9;
  const aa9 = a1_9 * a1_9 + a2_9 * a2_9 + a3_9 * a3_9;
  const m9 = s9 + aa9 / sg9;
  const T9 = yy9 / sg9 - (ay9 * ay9) / (sg9 * sg9 * m9);

  return [
    // Card 1: entry-one
    g.number({
      id: 'entry-one',
      title: t('One subset input', '只有一个子集输入'),
      prompt: t(
        `The Nyström approximation is K̃ = K_z K_zz⁻¹ K_zᵀ, where K_z = K(X, Z) and K_zz = K(Z, Z) (Lecture 7 p. 33). The subset Z has a single input z (M = 1), with k(z, z) = ${num(s1)}. Two training inputs x₁ and x₂ have k(x₁, z) = ${num(a1_1)} and k(x₂, z) = ${num(a2_1)}. What is the entry K̃₁₂, the approximate covariance between x₁ and x₂? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `尼斯特伦近似为 K̃ = K_z K_zz⁻¹ K_zᵀ，其中 K_z = K(X, Z)，K_zz = K(Z, Z)（第 7 讲第 33 页）。子集 Z 只含一个输入 z（M = 1），k(z, z) = ${num(s1)}。两个训练输入 x₁ 和 x₂ 满足 k(x₁, z) = ${num(a1_1)}，k(x₂, z) = ${num(a2_1)}。元素 K̃₁₂，即 x₁ 与 x₂ 的近似协方差，是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K̃₁₂', 'K̃₁₂'), answer: T1, tolerance: 0.006 }],
      hint: t(
        'K_z is a column with one entry per training input, and K_zz is a single number here.',
        'K_z 是一列，每个训练输入对应一个元素；这里 K_zz 只是一个数。'
      ),
      explanation: t(
        `With M = 1, K_zz = ${num(s1)} is a single number and K_z = (${num(a1_1)}, ${num(a2_1)}) is a column, so K̃₁₂ = ${num(a1_1)}·${num(s1)}⁻¹·${num(a2_1)} = ${num(T1)}. The product ${num(a1_1 * a2_1)} alone would be the answer only if k(z, z) were 1: the middle factor K_zz⁻¹ divides by the variance of the subset input. Every entry of K̃ is built through z, so the approximate covariance of x₁ and x₂ is what both share with z. This game does not assess how the subset is chosen.`,
        `M = 1 时，K_zz = ${num(s1)} 只是一个数，K_z = (${num(a1_1)}、${num(a2_1)}) 是一列，所以 K̃₁₂ = ${num(a1_1)}·${num(s1)}⁻¹·${num(a2_1)} = ${num(T1)}。只有当 k(z, z) 等于 1 时，乘积 ${num(a1_1 * a2_1)} 才是答案：中间的因子 K_zz⁻¹ 要除以子集输入的方差。K̃ 的每个元素都通过 z 构造，所以 x₁ 与 x₂ 的近似协方差就是两者与 z 共有的部分。本游戏不考查如何选取子集。`
      ),
      audit: { kind: 'GP-21:entry-one', params: { s: s1, a1: a1_1, a2: a2_1 } },
    }),

    // Card 2: entry-two
    g.number({
      id: 'entry-two',
      title: t('Two subset inputs', '两个子集输入'),
      prompt: t(
        `The subset Z = (z₁, z₂) has K_zz = ${mat([[exact(a2), exact(b2)], [exact(b2), exact(a2)]])}, with determinant ${num(D2)}. For two further inputs x and x′ the covariances with the subset are k(x, Z) = (${num(p1)}, ${num(p2)}) and k(x′, Z) = (${num(q1)}, ${num(q2)}). The Nyström approximation of their covariance is K̃(x, x′) = k(x, Z) K_zz⁻¹ k(x′, Z)ᵀ, with k(x, Z) a row and k(x′, Z)ᵀ a column (Lecture 7 p. 33; GPML pdf p. 191, eq. 8.7). What is K̃(x, x′)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `子集 Z = (z₁, z₂) 的 K_zz = ${mat([[exact(a2), exact(b2)], [exact(b2), exact(a2)]])}，行列式为 ${num(D2)}。另有两个输入 x 和 x′，它们与子集的协方差为 k(x, Z) = (${num(p1)}、${num(p2)})，k(x′, Z) = (${num(q1)}、${num(q2)})。它们协方差的尼斯特伦近似为 K̃(x, x′) = k(x, Z) K_zz⁻¹ k(x′, Z)ᵀ，其中 k(x, Z) 为行向量，k(x′, Z)ᵀ 为列向量（第 7 讲第 33 页；教材第 191 页，式 8.7）。K̃(x, x′) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K̃(x, x′)', 'K̃(x, x′)'), answer: T2, tolerance: 0.006 }],
      hint: t(
        'Work out K_zz⁻¹ as a matrix first (the determinant is printed), then multiply from the left by the row and from the right by the column.',
        '先把 K_zz⁻¹ 写成矩阵（行列式已给出），再左乘行向量、右乘列向量。'
      ),
      explanation: t(
        `K_zz⁻¹ = (1/${num(D2)})·${mat([[exact(a2), exact(-b2)], [exact(-b2), exact(a2)]])}: the diagonal entries stay ${exact(a2)} and the off-diagonal entries change sign to ${exact(-b2)}. The row (${num(p1)}, ${num(p2)}) times this matrix is (${exact(u1_2)}, ${exact(u2_2)}) before dividing by ${num(D2)}, because ${mt(p1, a2)} − ${mt(p2, b2)} = ${exact(u1_2)} and ${mt(p2, a2)} − ${mt(p1, b2)} = ${exact(u2_2)}. Times the column (${num(q1)}, ${num(q2)}) this gives ${mt(u1_2, q1)} + ${mt(u2_2, q2)} = ${exact(numN2)} before dividing by ${num(D2)}, so K̃(x, x′) = ${tail2}. Flipping the sign of the coupling would give ${exact((a2 * S2 + b2 * X2) / D2)}; using K_zz itself instead of its inverse gives ${exact(a2 * S2 + b2 * X2)}. This game does not assess how the subset is chosen.`,
        `K_zz⁻¹ = (1/${num(D2)})·${mat([[exact(a2), exact(-b2)], [exact(-b2), exact(a2)]])}：对角元素仍为 ${exact(a2)}，非对角元素变号为 ${exact(-b2)}。行向量 (${num(p1)}、${num(p2)}) 乘以这个矩阵，除以 ${num(D2)} 之前得到 (${exact(u1_2)}、${exact(u2_2)})，因为 ${mt(p1, a2)} − ${mt(p2, b2)} = ${exact(u1_2)}，${mt(p2, a2)} − ${mt(p1, b2)} = ${exact(u2_2)}。再乘以列向量 (${num(q1)}、${num(q2)})，得 ${mt(u1_2, q1)} + ${mt(u2_2, q2)} = ${exact(numN2)}，再除以 ${num(D2)}，所以 K̃(x, x′) = ${tail2}。若耦合项的符号弄反，会得到 ${exact((a2 * S2 + b2 * X2) / D2)}；若直接用 K_zz 而不是它的逆，会得到 ${exact(a2 * S2 + b2 * X2)}。本游戏不考查如何选取子集。`
      ),
      audit: { kind: 'GP-21:entry-two', params: { a: nd(a2), b: nd(b2), p1, p2, q1, q2 } },
    }),

    // Card 3: schur-gap
    g.number({
      id: 'schur-gap',
      title: t('What the approximation loses', '近似损失了什么'),
      prompt: t(
        `Two training inputs have the positive definite kernel matrix K = ${mat([[exact(s3), exact(a3)], [exact(a3), exact(v3)]])}. The subset is Z = {x₁} (M = 1), so K_z = (K₁₁, K₂₁) is the first column of K and K_zz = K₁₁, and K̃ = K_z K_zz⁻¹ K_zᵀ (Lecture 7 p. 33). What is K₂₂ − K̃₂₂, the error in the variance of the left-out input x₂? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `两个训练输入的核矩阵为正定矩阵 K = ${mat([[exact(s3), exact(a3)], [exact(a3), exact(v3)]])}。子集为 Z = {x₁}（M = 1），因此 K_z = (K₁₁、K₂₁) 是 K 的第一列，K_zz = K₁₁，且 K̃ = K_z K_zz⁻¹ K_zᵀ（第 7 讲第 33 页）。被排除在外的输入 x₂ 的方差误差 K₂₂ − K̃₂₂ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K₂₂ − K̃₂₂', 'K₂₂ − K̃₂₂'), answer: T3, tolerance: 0.006 }],
      hint: t(
        'K̃₂₂ is the (2, 2) entry of a column times a number times a row.',
        'K̃₂₂ 是「一列乘一个数再乘一行」后的第 (2, 2) 个元素。'
      ),
      explanation: t(
        `K_z = (${num(s3)}, ${num(a3)}) and K_zz = ${num(s3)}, so K̃₂₂ = ${num(a3)}²/${num(s3)} = ${exact((a3 * a3) / s3)}. The error is K₂₂ − K̃₂₂ = ${num(v3)} − ${exact((a3 * a3) / s3)} = ${exact(T3)}. This is the Schur complement of K_zz, which is the variance of x₂ given x₁ and is never negative (GPML pdf p. 191); it is positive here because K is positive definite. K̃ agrees with K in the first row and column, so all of the error sits in the entry of the left-out input. Using ${num(a3)}² without dividing by ${num(s3)} would give ${num(v3 - a3 * a3)}. This game does not assess which inputs make the error small.`,
        `K_z = (${num(s3)}、${num(a3)})，K_zz = ${num(s3)}，所以 K̃₂₂ = ${num(a3)}²/${num(s3)} = ${exact((a3 * a3) / s3)}。误差为 K₂₂ − K̃₂₂ = ${num(v3)} − ${exact((a3 * a3) / s3)} = ${exact(T3)}。这是 K_zz 的舒尔补，即给定 x₁ 时 x₂ 的方差，永远不会为负（教材第 191 页）；此处 K 正定，所以它为正。K̃ 的第一行和第一列与 K 相同，所有误差都出现在被排除输入的那个元素上。若不除以 ${num(s3)} 直接用 ${num(a3)}²，会得到 ${num(v3 - a3 * a3)}。本游戏不考查哪些输入能让误差更小。`
      ),
      audit: { kind: 'GP-21:schur-gap', params: { s: s3, a: a3, v: v3 } },
    }),

    // Card 4: rank-zeros
    g.number({
      id: 'rank-zeros',
      title: t('Zero eigenvalues of K̃', 'K̃ 的零特征值'),
      prompt: t(
        `K̃ = K_z K_zz⁻¹ K_zᵀ is built from a subset of M = ${num(M4)} out of N = ${num(N4)} training inputs (Lecture 7 p. 33). The N × M matrix K_z has linearly independent columns and the M × M matrix K_zz is invertible. K̃ is a symmetric N × N matrix; how many of its N eigenvalues are exactly 0? Give an integer.`,
        `K̃ = K_z K_zz⁻¹ K_zᵀ 由 N = ${num(N4)} 个训练输入中的 M = ${num(M4)} 个构成（第 7 讲第 33 页）。N × M 矩阵 K_z 的列线性无关，M × M 矩阵 K_zz 可逆。K̃ 是 N × N 对称矩阵；它的 N 个特征值中恰有几个等于 0？请填整数。`
      ),
      fields: [{ label: t('Number of zero eigenvalues', '零特征值的个数'), answer: T4, tolerance: 0.006 }],
      hint: t(
        'Count the rank of K̃ first: how many independent directions can a product through an M-dimensional middle have?',
        '先数一数 K̃ 的秩：中间经过 M 维空间的乘积最多有几个独立方向？'
      ),
      explanation: t(
        `K̃ = K_z K_zz⁻¹ K_zᵀ has rank M = ${num(M4)}: it is a sum of M rank-one terms (GPML pdf p. 190, eq. 8.4), and the independent columns of K_z and the invertible K_zz keep all M of them. A symmetric N × N matrix of rank ${num(M4)} has N − ${num(M4)} = ${num(T4)} zero eigenvalues, so K̃ alone is singular. This is why the approximate likelihood uses K̃ + σ²I (Lecture 7 p. 33): the noise term lifts every zero eigenvalue to σ². Answering ${num(M4)} confuses the rank with the number of zero eigenvalues. This game does not assess how fast the eigenvalues of K decay.`,
        `K̃ = K_z K_zz⁻¹ K_zᵀ 的秩为 M = ${num(M4)}：它是 M 个秩一矩阵之和（教材第 190 页，式 8.4），K_z 的列线性无关且 K_zz 可逆，使这 M 项全部保留。秩为 ${num(M4)} 的 N × N 对称矩阵有 N − ${num(M4)} = ${num(T4)} 个零特征值，所以单独的 K̃ 是奇异的。这就是近似似然使用 K̃ + σ²I 的原因（第 7 讲第 33 页）：噪声项把每个零特征值抬高到 σ²。回答 ${num(M4)} 是把秩与零特征值的个数弄混了。本游戏不考查 K 的特征值衰减得多快。`
      ),
      audit: { kind: 'GP-21:rank-zeros', params: { N: N4, M: M4 } },
    }),

    // Card 5: exactness-check
    g.choice({
      id: 'exactness-check',
      title: t('When is the approximation exact?', '近似何时精确？'),
      prompt: t(
        `N = ${num(N5)} training inputs have a positive definite kernel matrix K. The Nyström approximation K̃ = K_z K_zz⁻¹ K_zᵀ uses a subset Z of them, and K_zz = K(Z, Z) is invertible. For which situation is K̃ = K guaranteed exactly, whatever the kernel?`,
        `N = ${num(N5)} 个训练输入的核矩阵 K 正定。尼斯特伦近似 K̃ = K_z K_zz⁻¹ K_zᵀ 使用其中的一个子集 Z，且 K_zz = K(Z, Z) 可逆。无论核函数是什么，下列哪种情形能保证 K̃ = K 精确成立？`
      ),
      options: [
        t(`All ${num(N5)} inputs are in the subset (M = N), so K_zz is the whole matrix K`, `全部 ${num(N5)} 个输入都在子集中（M = N），所以 K_zz = K`),
        t(`${num(N5 - 1)} of the ${num(N5)} inputs are in the subset, so only one input is left out`, `${num(N5)} 个输入中有 ${num(N5 - 1)} 个在子集中，只有一个输入被排除在外`),
        t(`M = ${num(M5)} of the ${num(N5)} inputs are in the subset and the noise variance is σ² = 0`, `${num(N5)} 个输入中有 M = ${num(M5)} 个在子集中，且噪声方差 σ² = 0（没有观测噪声）`),
        t(`M = ${num(M5)} of the ${num(N5)} inputs are in the subset and the other inputs have covariance 0 with them`, `${num(N5)} 个输入中有 M = ${num(M5)} 个在子集中，其余输入与它们的协方差为 0`),
      ],
      correct: 0,
      hint: t(
        'Compare K̃ and K block by block: which block of K̃ is not simply copied from K when some inputs are left out?',
        '按分块比较 K̃ 与 K：有输入被排除时，K̃ 的哪一块不是直接取自 K？'
      ),
      explanation: t(
        `K̃ copies the rows and columns of K that belong to the subset (GPML pdf p. 191); only the block for the left-out inputs is rebuilt as K_Rz K_zz⁻¹ K_zR. If the subset is all ${num(N5)} inputs, K_zz = K and K̃ = K K⁻¹ K = K exactly (Lecture 7 p. 36). With even one input left out, the error is the Schur complement of K_zz, which is positive when K is positive definite. The noise variance σ² never enters K̃, so σ² = 0 changes nothing. And if the other inputs had covariance 0 with the subset, K_Rz = 0 would make the rebuilt block 0 instead of the variances on the diagonal of K. This game does not assess how large the error is for a given subset.`,
        `K̃ 复制了 K 中属于子集的行和列（教材第 191 页）；只有被排除输入对应的那一块被重建为 K_Rz K_zz⁻¹ K_zR。若子集是全部 ${num(N5)} 个输入，则 K_zz = K，K̃ = K K⁻¹ K = K 精确成立（第 7 讲第 36 页）。哪怕只排除一个输入，误差也是 K_zz 的舒尔补，K 正定时它为正。噪声方差 σ² 从不出现在 K̃ 中，所以 σ² = 0 没有任何作用。如果其余输入与子集的协方差为 0，则 K_Rz = 0，重建的那一块为 0，而不是 K 对角线上的方差。本游戏不考查给定子集时误差有多大。`
      ),
    }),

    // Card 6: small-matrix
    g.number({
      id: 'small-matrix',
      title: t('The small matrix in the Woodbury identity', '伍德伯里恒等式中的小矩阵'),
      prompt: t(
        `The Woodbury identity (Lecture 7 p. 35) gives (K_z K_zz⁻¹ K_zᵀ + σ²I)⁻¹ = σ⁻²I − σ⁻⁴ K_z (K_zz + σ⁻² K_zᵀ K_z)⁻¹ K_zᵀ, so only the M × M matrix K_zz + σ⁻² K_zᵀ K_z has to be inverted. Here N = 3, M = 2, σ² = ${num(sg6)}, K_zz = ${mat([[exact(3), exact(t6)], [exact(t6), exact(3)]])} and K_z = ${mat([[exact(a1_6), exact(b1_6)], [exact(a2_6), exact(b2_6)], [exact(a3_6), exact(b3_6)]])} (3 rows, 2 columns). What is the entry in row 1, column 2 of K_zz + σ⁻² K_zᵀ K_z? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `伍德伯里恒等式（第 7 讲第 35 页）给出 (K_z K_zz⁻¹ K_zᵀ + σ²I)⁻¹ = σ⁻²I − σ⁻⁴ K_z (K_zz + σ⁻² K_zᵀ K_z)⁻¹ K_zᵀ，因此只需求 M × M 矩阵 K_zz + σ⁻² K_zᵀ K_z 的逆。这里 N = 3，M = 2，σ² = ${num(sg6)}，K_zz = ${mat([[exact(3), exact(t6)], [exact(t6), exact(3)]])}，K_z = ${mat([[exact(a1_6), exact(b1_6)], [exact(a2_6), exact(b2_6)], [exact(a3_6), exact(b3_6)]])}（3 行 2 列）。K_zz + σ⁻² K_zᵀ K_z 的第 1 行第 2 列元素是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Entry (1, 2)', '第 (1, 2) 个元素'), answer: T6, tolerance: 0.006 }],
      hint: t(
        'K_zᵀ K_z multiplies columns of K_z with each other, not rows.',
        'K_zᵀ K_z 是 K_z 的列与列相乘，而不是行与行相乘。'
      ),
      explanation: t(
        `Entry (1, 2) of K_zᵀ K_z is column 1 of K_z times column 2: ${mt(a1_6, b1_6)} + ${mt(a2_6, b2_6)} + ${mt(a3_6, b3_6)} = ${num(d6)}. Divided by σ² = ${num(sg6)} this is ${exact(d6 / sg6)}, and adding the entry ${exact(t6)} of K_zz gives ${exact(T6)}. K_zᵀ K_z is 2 × 2, as it must be (M × M); K_z K_zᵀ would be the 3 × 3 matrix of the rows, whose (1, 2) entry is ${num(a1_6 * a2_6 + b1_6 * b2_6)}. That the inverse is taken of a 2 × 2 matrix instead of a 3 × 3 matrix is the saving of the identity: the cost falls from O(N³) to O(NM²) (Lecture 7 p. 35). This game does not assess the rest of the identity.`,
        `K_zᵀ K_z 的第 (1, 2) 个元素是 K_z 第 1 列与第 2 列相乘：${mt(a1_6, b1_6)} + ${mt(a2_6, b2_6)} + ${mt(a3_6, b3_6)} = ${num(d6)}。除以 σ² = ${num(sg6)} 得 ${exact(d6 / sg6)}，再加上 K_zz 的对应元素 ${exact(t6)}，得 ${exact(T6)}。K_zᵀ K_z 是 2 × 2 的，正如应有的 M × M；K_z K_zᵀ 则是由行构成的 3 × 3 矩阵，其第 (1, 2) 个元素为 ${num(a1_6 * a2_6 + b1_6 * b2_6)}。恒等式的好处就是只需求 2 × 2 矩阵而不是 3 × 3 矩阵的逆：运算量由 O(N³) 降到 O(NM²)（第 7 讲第 35 页）。本游戏不考查恒等式的其余部分。`
      ),
      audit: { kind: 'GP-21:small-matrix', params: { sg: sg6, t: nd(t6), a1: a1_6, b1: b1_6, a2: a2_6, b2: b2_6, a3: a3_6, b3: b3_6 } },
    }),

    // Card 7: woodbury-entry
    g.number({
      id: 'woodbury-entry',
      title: t('Using the Woodbury identity', '使用伍德伯里恒等式'),
      prompt: t(
        `N = 2 training inputs and one subset input (M = 1): K_zz = ${num(s7)}, K_z = (${num(a1_7)}, ${num(a2_7)}) as a column, and the noise variance is σ² = ${num(sg7)}. By the Woodbury identity (K_z K_zz⁻¹ K_zᵀ + σ²I)⁻¹ = σ⁻²I − σ⁻⁴ K_z (K_zz + σ⁻² K_zᵀ K_z)⁻¹ K_zᵀ (Lecture 7 p. 35), what is the (1, 1) entry of (K̃ + σ²I)⁻¹? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `N = 2 个训练输入和一个子集输入（M = 1）：K_zz = ${num(s7)}，K_z = (${num(a1_7)}、${num(a2_7)})（列向量），噪声方差为 σ² = ${num(sg7)}。由伍德伯里恒等式 (K_z K_zz⁻¹ K_zᵀ + σ²I)⁻¹ = σ⁻²I − σ⁻⁴ K_z (K_zz + σ⁻² K_zᵀ K_z)⁻¹ K_zᵀ（第 7 讲第 35 页），(K̃ + σ²I)⁻¹ 的第 (1, 1) 个元素是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('(1, 1) entry of the inverse', '逆矩阵的第 (1, 1) 个元素'), answer: T7, tolerance: 0.006 }],
      hint: t(
        'Compute the 1 × 1 matrix K_zz + σ⁻² K_zᵀ K_z first, invert it, and only then assemble the two terms.',
        '先算出 1 × 1 矩阵 K_zz + σ⁻² K_zᵀ K_z，求逆，最后再合成两项。'
      ),
      explanation: t(
        `K_zᵀ K_z = ${num(a1_7)}² + ${num(a2_7)}² = ${num(a1_7 * a1_7 + a2_7 * a2_7)}. Here σ⁻² = ${exact(1 / sg7)}, so K_zz + σ⁻² K_zᵀ K_z = ${num(s7)} + ${mt(1 / sg7, a1_7 * a1_7 + a2_7 * a2_7)} = ${exact(m7)}. The (1, 1) entry of K_z (…)⁻¹ K_zᵀ is ${num(a1_7)}²/${exact(m7)}, so the (1, 1) entry of the inverse is ${exact(1 / sg7)} − ${pf(1 / sg7)}²·${num(a1_7 * a1_7)}/${exact(m7)} = ${exact(1 / sg7)} − ${exact((a1_7 * a1_7) / (sg7 * sg7 * m7))} = ${exact(T7)}. Check by inverting directly: K̃ + σ²I = ${mat([[exact((a1_7 * a1_7) / s7 + sg7), exact((a1_7 * a2_7) / s7)], [exact((a1_7 * a2_7) / s7), exact((a2_7 * a2_7) / s7 + sg7)]])} with determinant ${exact(((a1_7 * a1_7) / s7 + sg7) * ((a2_7 * a2_7) / s7 + sg7) - Math.pow((a1_7 * a2_7) / s7, 2))}, and its inverse has (1, 1) entry ${exact(((a2_7 * a2_7) / s7 + sg7) / (((a1_7 * a1_7) / s7 + sg7) * ((a2_7 * a2_7) / s7 + sg7) - Math.pow((a1_7 * a2_7) / s7, 2)))}, the same value. The identity trades an N × N inversion for an M × M one (here 1 × 1). This game does not assess the determinant identity.`,
        `K_zᵀ K_z = ${num(a1_7)}² + ${num(a2_7)}² = ${num(a1_7 * a1_7 + a2_7 * a2_7)}。这里 σ⁻² = ${exact(1 / sg7)}，所以 K_zz + σ⁻² K_zᵀ K_z = ${num(s7)} + ${mt(1 / sg7, a1_7 * a1_7 + a2_7 * a2_7)} = ${exact(m7)}。K_z (…)⁻¹ K_zᵀ 的第 (1, 1) 个元素为 ${num(a1_7)}²/${exact(m7)}，因此逆矩阵的第 (1, 1) 个元素为 ${exact(1 / sg7)} − ${pf(1 / sg7)}²·${num(a1_7 * a1_7)}/${exact(m7)} = ${exact(1 / sg7)} − ${exact((a1_7 * a1_7) / (sg7 * sg7 * m7))} = ${exact(T7)}。直接求逆验证：K̃ + σ²I = ${mat([[exact((a1_7 * a1_7) / s7 + sg7), exact((a1_7 * a2_7) / s7)], [exact((a1_7 * a2_7) / s7), exact((a2_7 * a2_7) / s7 + sg7)]])}，行列式为 ${exact(((a1_7 * a1_7) / s7 + sg7) * ((a2_7 * a2_7) / s7 + sg7) - Math.pow((a1_7 * a2_7) / s7, 2))}，其逆的第 (1, 1) 个元素为 ${exact(((a2_7 * a2_7) / s7 + sg7) / (((a1_7 * a1_7) / s7 + sg7) * ((a2_7 * a2_7) / s7 + sg7) - Math.pow((a1_7 * a2_7) / s7, 2)))}，数值相同。恒等式把 N × N 的求逆换成了 M × M 的求逆（这里是 1 × 1）。本游戏不考查行列式恒等式。`
      ),
      audit: { kind: 'GP-21:woodbury-entry', params: { s: s7, a1: a1_7, a2: a2_7, sg: sg7 } },
    }),

    // Card 8: cost-ratio
    g.number({
      id: 'cost-ratio',
      title: t('What the identity saves', '恒等式节省了多少'),
      prompt: t(
        `Inverting the N × N matrix K̃ + σ²I directly costs O(N³); with the Woodbury identity the computation costs O(NM²) (Lecture 7 p. 35). Treat the two costs as exactly N³ units and N·M² units. With N = ${num(N8)} training inputs and a subset of M = ${num(M8)}, how many times fewer units does the Woodbury route need? Give an integer.`,
        `直接求 N × N 矩阵 K̃ + σ²I 的逆需要 O(N³) 的运算量；用伍德伯里恒等式，整个计算的运算量为 O(NM²)（第 7 讲第 35 页）。把两种运算量分别当作恰好 N³ 个单位和 N·M² 个单位。N = ${num(N8)} 个训练输入、子集大小 M = ${num(M8)} 时，伍德伯里方法需要的单位数少多少倍？请填整数。`
      ),
      fields: [{ label: t('Times cheaper', '便宜多少倍'), answer: T8, tolerance: 0.006 }],
      hint: t(
        'Write the ratio of the two costs as a fraction and cancel every factor they share.',
        '把两个运算量之比写成分数，约去它们共有的因子。'
      ),
      explanation: t(
        `The ratio is N³/(N·M²) = N²/M² = (${num(N8)}/${num(M8)})² = ${num(N8 / M8)}² = ${num(T8)}. Dividing N by M alone gives ${num(N8 / M8)}, which would be the saving if the cost fell from N to M; the saving is larger because the cost is cubic in N and only quadratic in M. These are the leading terms the slide states, not exact operation counts, and the saving only appears when M is much smaller than N. This game does not assess constants or memory.`,
        `两者之比为 N³/(N·M²) = N²/M² = (${num(N8)}/${num(M8)})² = ${num(N8 / M8)}² = ${num(T8)}。只做 N 除以 M 得到 ${num(N8 / M8)}，那相当于运算量从 N 降到 M；实际节省更多，因为运算量对 N 是三次、对 M 只是二次。这里用的是幻灯片给出的首项，不是精确的运算次数，而且只有当 M 远小于 N 时才有节省。本游戏不考查常数因子和内存。`
      ),
      audit: { kind: 'GP-21:cost-ratio', params: { N: N8, M: M8 } },
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: the data-fit quantity', '挑战：数据拟合量'),
      prompt: t(
        `N = 3 training inputs and a subset of one input (M = 1): K_zz = ${num(s9)}, K_z = (${num(a1_9)}, ${num(a2_9)}, ${num(a3_9)}) as a column, and the noise variance is σ² = ${num(sg9)}. The targets are y = (${num(y1_9)}, ${num(y2_9)}, ${num(y3_9)}) as a column. The approximate data-fit term of the log marginal likelihood contains yᵀ(K̃ + σ²I)⁻¹y with K̃ = K_z K_zz⁻¹ K_zᵀ (Lecture 7 p. 33). What is yᵀ(K̃ + σ²I)⁻¹y? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `N = 3 个训练输入和只含一个输入的子集（M = 1）：K_zz = ${num(s9)}，K_z = (${num(a1_9)}、${num(a2_9)}、${num(a3_9)})（列向量），噪声方差为 σ² = ${num(sg9)}。目标值为 y = (${num(y1_9)}、${num(y2_9)}、${num(y3_9)})（列向量）。对数边际似然的近似数据拟合项含有 yᵀ(K̃ + σ²I)⁻¹y，其中 K̃ = K_z K_zz⁻¹ K_zᵀ（第 7 讲第 33 页）。yᵀ(K̃ + σ²I)⁻¹y 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('yᵀ(K̃ + σ²I)⁻¹y', 'yᵀ(K̃ + σ²I)⁻¹y'), answer: T9, tolerance: 0.006 }],
      hint: t(
        'K̃ + σ²I is a 3 × 3 matrix, but K̃ has rank 1. Use that to avoid inverting a 3 × 3 matrix.',
        'K̃ + σ²I 是 3 × 3 矩阵，但 K̃ 的秩为 1。利用这一点，避免求 3 × 3 矩阵的逆。'
      ),
      explanation: t(
        `K̃ + σ²I has a rank-one part, so (K̃ + σ²I)⁻¹ = σ⁻²I − σ⁻⁴ K_z (K_zz + σ⁻² K_zᵀ K_z)⁻¹ K_zᵀ (Lecture 7 p. 35). Here K_zᵀ K_z = ${num(aa9)} and K_zz + σ⁻² K_zᵀ K_z = ${num(s9)} + ${num(aa9)}/${num(sg9)} = ${exact(m9)}. With yᵀy = ${num(yy9)} and K_zᵀ y = ${num(ay9)}: yᵀ(K̃ + σ²I)⁻¹y = ${num(yy9)}/${num(sg9)} − ${par(ay9)}²/(${num(sg9)}²·${exact(m9)}) = ${exact(yy9 / sg9)} − ${exact((ay9 * ay9) / (sg9 * sg9 * m9))} = ${exact(T9)}. Dropping the low-rank part would leave ${exact(yy9 / sg9)}; the correction is not small, because K̃ explains part of y. This game does not assess the determinant term or any optimisation of hyperparameters.`,
        `K̃ + σ²I 含有一个秩一部分，所以 (K̃ + σ²I)⁻¹ = σ⁻²I − σ⁻⁴ K_z (K_zz + σ⁻² K_zᵀ K_z)⁻¹ K_zᵀ（第 7 讲第 35 页）。这里 K_zᵀ K_z = ${num(aa9)}，K_zz + σ⁻² K_zᵀ K_z = ${num(s9)} + ${num(aa9)}/${num(sg9)} = ${exact(m9)}。由 yᵀy = ${num(yy9)} 和 K_zᵀ y = ${num(ay9)}：yᵀ(K̃ + σ²I)⁻¹y = ${num(yy9)}/${num(sg9)} − ${par(ay9)}²/(${num(sg9)}²·${exact(m9)}) = ${exact(yy9 / sg9)} − ${exact((ay9 * ay9) / (sg9 * sg9 * m9))} = ${exact(T9)}。若丢掉低秩部分，只剩 ${exact(yy9 / sg9)}；修正量并不小，因为 K̃ 解释了 y 的一部分。本游戏不考查行列式项，也不考查超参数的优化。`
      ),
      audit: { kind: 'GP-21:challenge', params: { s: s9, sg: sg9, a1: a1_9, a2: a2_9, a3: a3_9, y1: y1_9, y2: y2_9, y3: y3_9 } },
    }),
  ];
};
