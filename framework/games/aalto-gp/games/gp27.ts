import type { CardGenerator } from '../../types';
import { exact, frac, gcd, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const normaliseProducts = (s: string) => s
  .replace(/(^|[^\d.])1·(?=\(?[−\d])/g, '$1')
  .replace(/·1(?=$|[^\d.])/g, '');
const t = (en: string, zh: string): Text => [normaliseProducts(en), normaliseProducts(zh)];

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

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => SUBS[n];
/** Product of the factors other than 1, joined with the middle dot; `parFirst` parenthesises a negative first factor (used after an operator). */
function prodS(xs: number[], parFirst = false): string {
  const f = xs.filter(x => x !== 1);
  if (!f.length) return '1';
  return f.map((x, i) => (i === 0 && !parFirst) ? num(x) : par(x)).join('·');
}
/** "a = b = c", dropping a step that repeats the previous one (no "x = x"). */
const chain = (...parts: string[]) => parts.filter((x, i) => i === 0 || x !== parts[i - 1]).join(' = ');
/** Product of two positive integers for a counting sentence: "4·3 = 12", or just "3" when a factor is 1. */
const cnt = (a: number, b: number) => (a === 1 || b === 1) ? String(a * b) : `${a}·${b} = ${a * b}`;
const product = (a: number, b: number) => a === 1 ? num(b) : b === 1 ? num(a) : `${par(a)}·${par(b)}`;
/** Reduced denominator of the exact key of card 2: -b/(a^2-b^2)/d1 with a, b, d1 multiples of 1/4. */
function c2Denominator(a: number, b: number, d1: number): number {
  const A = Math.round(a * 4), B = Math.round(b * 4), D = Math.round(d1 * 4);
  const numer = -16 * B, denom = (A * A - B * B) * D;
  return Math.abs(denom / gcd(Math.abs(numer), Math.abs(denom)));
}

const W = [-2, -1, 1, 2];
const K1 = [0.25, 0.5, 0.75];
const V = [0.5, 1, 1.5, 2];
const D = [0.25, 0.5, 2, 4];
const AB = [[1.25, 0.75], [1.25, -0.75], [1.5, 0.5], [1.5, -0.5], [2.5, 1.5], [2.5, -1.5], [3, 2], [3, -2]];
const PSD = [[1, 4], [4, 1], [1, 9], [9, 1], [1, 16], [16, 1], [2, 8], [8, 2], [2, 18], [18, 2], [4, 9], [9, 4], [4, 16], [16, 4], [8, 18], [18, 8], [9, 16], [16, 9]];
const CP = [[1, 2], [2, 1], [3, 4], [4, 3]];
const CQ = [[1, 3], [2, 4], [3, 1], [4, 2]];

export const gp27: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-27');
  warm(g);

  // Card 1
  const c1 = retry(() => ({ m: g.pick([1, 2, 3, 4]), n: g.pick([1, 2, 3, 4]), p: g.pick([1, 2, 3, 4]), q: g.pick([1, 2, 3, 4]) }),
    v => {
      const key = v.m * v.n * v.p * v.q;
      const r1 = (v.m + v.p) * (v.n + v.q);
      const r2 = v.m * v.n + v.p * v.q;
      const r3 = v.m * v.p + v.n * v.q;
      const r4 = v.m * v.n * v.p;
      return Math.abs(key - r1) >= 1 && Math.abs(key - r2) >= 1 && Math.abs(key - r3) >= 1 && Math.abs(key - r4) >= 1;
    });
  const c1Key = c1.m * c1.n * c1.p * c1.q;

  // Card 2
  const c2 = retry(() => {
    const ab = g.pick(AB);
    const d1 = g.pick(D);
    let d2 = g.pick(D);
    if (d2 === d1) d2 = D[(D.indexOf(d1) + 1) % D.length];
    return { a: ab[0], b: ab[1], d1, d2 };
  }, v => {
    if (![1, 2, 4, 5, 8, 10].includes(c2Denominator(v.a, v.b, v.d1))) return false;
    const det = v.a * v.a - v.b * v.b;
    const key = (-v.b / det) * (1 / v.d1);
    const r1 = (-v.b * v.d1) / det;
    const r2 = v.b / v.d1;
    const r3 = v.a / (det * v.d1);
    const r4 = (-v.b) / (det * v.d2);
    const r5 = 1 / (v.b * v.d1);
    const r6 = v.b * v.d1;
    return Math.abs(key - r1) >= 0.25 && Math.abs(key - r2) >= 0.25 && Math.abs(key - r3) >= 0.25 && Math.abs(key - r4) >= 0.25 && Math.abs(key - r5) >= 0.25 && Math.abs(key - r6) >= 0.25;
  });
  const c2Det = c2.a * c2.a - c2.b * c2.b;
  const c2Key = (-c2.b / c2Det) * (1 / c2.d1);

  // Card 3
  const c3 = retry(() => ({ p1: g.pick(W), p2: g.pick(W), q1: g.pick(W), q2: g.pick(W), k: g.pick(K1) }),
    v => {
      const s = v.p1 * v.p2 + v.q1 * v.q2;
      if (s === 0) return false;
      const key = s * v.k;
      const r1 = v.p1 * v.p2 * v.k;
      const r2 = v.q1 * v.q2 * v.k;
      const r3 = s;
      const r4 = (v.p1 + v.q1) * (v.p2 + v.q2) * v.k;
      const r5 = (v.p1 * v.q2 + v.q1 * v.p2) * v.k;
      return Math.abs(key - r1) >= 0.25 && Math.abs(key - r2) >= 0.25 && Math.abs(key - r3) >= 0.25 && Math.abs(key - r4) >= 0.25 && Math.abs(key - r5) >= 0.25;
    });
  const c3S = c3.p1 * c3.p2 + c3.q1 * c3.q2;
  const c3Key = c3S * c3.k;

  // Card 4
  const c4 = retry(() => {
    const a11 = g.pick(W), a12 = g.pick(W), a21 = g.pick(W), a22 = g.pick(W);
    const k1 = g.pick(K1);
    let k2 = g.pick(K1);
    if (k2 === k1) k2 = K1[(K1.indexOf(k1) + 1) % K1.length];
    return { a11, a12, a21, a22, k1, k2 };
  }, v => {
    const key = v.a11 * v.a12 * v.k1 + v.a21 * v.a22 * v.k2;
    if (key === 0) return false;
    const s = v.a11 * v.a12 + v.a21 * v.a22;
    const r1 = s * v.k1;
    const r2 = s * v.k2;
    const r3 = v.a11 * v.a12 * v.k1;
    const r4 = v.a21 * v.a22 * v.k2;
    const r5 = v.a11 * v.a12 * v.k2 + v.a21 * v.a22 * v.k1;
    return Math.abs(key - r1) >= 0.25 && Math.abs(key - r2) >= 0.25 && Math.abs(key - r3) >= 0.25 && Math.abs(key - r4) >= 0.25 && Math.abs(key - r5) >= 0.25;
  });
  const c4Key = c4.a11 * c4.a12 * c4.k1 + c4.a21 * c4.a22 * c4.k2;

  // Card 5
  const c5 = retry(() => {
    const p1 = g.pick(W), p2 = g.pick(W), q1 = g.pick(W), q2 = g.pick(W), r1 = g.pick(W), r2 = g.pick(W);
    const v1 = g.pick(V);
    let v2 = g.pick(V);
    if (v2 === v1) v2 = V[(V.indexOf(v1) + 1) % V.length];
    const j = g.pick([1, 2]);
    return { p1, p2, q1, q2, r1, r2, v1, v2, j };
  }, v => {
    const a = v.j === 1 ? v.p1 : v.p2;
    const b = v.j === 1 ? v.q1 : v.q2;
    const c = v.j === 1 ? v.r1 : v.r2;
    const key = v.v1 * (a * a + b * b) + v.v2 * c * c;
    const r1 = v.v1 * (a + b) * (a + b) + v.v2 * c * c;
    const r2 = v.v1 * (a + b) + v.v2 * c;
    const r3 = v.v1 * (a * a + b * b + c * c);
    const r4 = a * a + b * b + c * c;
    const a2 = v.j === 1 ? v.p2 : v.p1;
    const b2 = v.j === 1 ? v.q2 : v.q1;
    const c2 = v.j === 1 ? v.r2 : v.r1;
    const r5 = v.v1 * (a2 * a2 + b2 * b2) + v.v2 * c2 * c2;
    return Math.abs(key - r1) >= 0.5 && Math.abs(key - r2) >= 0.5 && Math.abs(key - r3) >= 0.5 && Math.abs(key - r4) >= 0.5 && Math.abs(key - r5) >= 0.5;
  });
  const c5a = c5.j === 1 ? c5.p1 : c5.p2;
  const c5b = c5.j === 1 ? c5.q1 : c5.q2;
  const c5c = c5.j === 1 ? c5.r1 : c5.r2;
  const c5Key = c5.v1 * (c5a * c5a + c5b * c5b) + c5.v2 * c5c * c5c;

  // Card 6
  const c6Class = g.pick([0, 1, 2]);
  let c6Q = 1, c6S: number[] = [2];
  if (c6Class === 0) {
    c6Q = 1;
    c6S = [g.pick([2, 3, 4, 5])];
  } else if (c6Class === 1) {
    c6Q = g.pick([2, 3, 4]);
    c6S = new Array(c6Q).fill(1);
  } else {
    if (g.pick([0, 1]) === 0) {
      c6Q = 2;
      const s1 = g.pick([1, 2, 3]);
      let s2 = g.pick([1, 2, 3]);
      if (s1 === 1 && s2 === 1) s2 = 2;
      c6S = [s1, s2];
    } else {
      c6Q = 3;
      const s1 = g.pick([1, 2]);
      const s2 = g.pick([1, 2]);
      let s3 = g.pick([1, 2]);
      if (s1 === 1 && s2 === 1 && s3 === 1) s3 = 2;
      c6S = [s1, s2, s3];
    }
  }
  const c6Correct = c6Class === 0 ? 0 : (c6Class === 1 ? 1 : 2);

  // Card 7
  const c7 = g.pick(PSD);
  const c7Key = Math.sqrt(c7[0] * c7[1]);

  // Card 8
  const c8 = { b11: g.pick([1, 2, 3, 4]), b22: g.pick([1, 2, 3, 4]) };

  // Card 9
  const c9 = retry(() => {
    const p1 = g.pick(W), p2 = g.pick(W), q1 = g.pick(W), q2 = g.pick(W), r1 = g.pick(W), r2 = g.pick(W);
    const k1 = g.pick(K1);
    let k2 = g.pick(K1);
    if (k2 === k1) k2 = K1[(K1.indexOf(k1) + 1) % K1.length];
    const isP = g.pick([0, 1]) === 0;
    const rc = isP ? g.pick(CP) : g.pick(CQ);
    return { p1, p2, q1, q2, r1, r2, k1, k2, row: rc[0], col: rc[1] };
  }, v => {
    const o = (r: number) => r <= 2 ? 0 : 1;
    const i = (r: number) => (r - 1) % 2;
    const B1 = [[v.p1 * v.p1 + v.q1 * v.q1, v.p1 * v.p2 + v.q1 * v.q2], [v.p1 * v.p2 + v.q1 * v.q2, v.p2 * v.p2 + v.q2 * v.q2]];
    const B2 = [[v.r1 * v.r1, v.r1 * v.r2], [v.r1 * v.r2, v.r2 * v.r2]];
    const K1m = [[1, v.k1], [v.k1, 1]];
    const K2m = [[1, v.k2], [v.k2, 1]];
    const or = o(v.row), oc = o(v.col), ir = i(v.row), ic = i(v.col);
    const key = B1[or][oc] * K1m[ir][ic] + B2[or][oc] * K2m[ir][ic];
    if (key === 0) return false;
    const r1 = K1m[or][oc] * B1[ir][ic] + K2m[or][oc] * B2[ir][ic];
    const r2 = B1[or][oc] * K1m[ir][ic];
    const r3 = B2[or][oc] * K2m[ir][ic];
    const B1d = [[v.p1 * v.p1, v.p1 * v.p2], [v.p1 * v.p2, v.p2 * v.p2]];
    const r4 = B1d[or][oc] * K1m[ir][ic] + B2[or][oc] * K2m[ir][ic];
    let r5 = 0;
    if (v.row <= 2 && v.col <= 2 || (v.row > 2 && v.col > 2)) {
      r5 = (B1[or][oc] + B2[or][oc]) * K1m[ir][ic];
    } else {
      r5 = B1[0][1] * v.k1 + B2[0][1] * v.k2;
    }
    return Math.abs(key - r1) >= 0.25 && Math.abs(key - r2) >= 0.25 && Math.abs(key - r3) >= 0.25 && Math.abs(key - r4) >= 0.25 && Math.abs(key - r5) >= 0.25;
  });
  const c9B1 = [[c9.p1 * c9.p1 + c9.q1 * c9.q1, c9.p1 * c9.p2 + c9.q1 * c9.q2], [c9.p1 * c9.p2 + c9.q1 * c9.q2, c9.p2 * c9.p2 + c9.q2 * c9.q2]];
  const c9B2 = [[c9.r1 * c9.r1, c9.r1 * c9.r2], [c9.r1 * c9.r2, c9.r2 * c9.r2]];
  const c9Or = c9.row <= 2 ? 0 : 1;
  const c9Oc = c9.col <= 2 ? 0 : 1;
  const c9Ir = (c9.row - 1) % 2;
  const c9Ic = (c9.col - 1) % 2;
  const c9K1v = c9Ir === c9Ic ? 1 : c9.k1;
  const c9K2v = c9Ir === c9Ic ? 1 : c9.k2;
  const c9Key = c9B1[c9Or][c9Oc] * c9K1v + c9B2[c9Or][c9Oc] * c9K2v;

  // Precompute strings for card 9 explanation to avoid nested template issues
  const c9B1Str = mat([[num(c9B1[0][0]), num(c9B1[0][1])], [num(c9B1[1][0]), num(c9B1[1][1])]]);
  const c9B2Str = mat([[num(c9B2[0][0]), num(c9B2[0][1])], [num(c9B2[1][0]), num(c9B2[1][1])]]);
  const c9IsP = (c9.row <= 2 && c9.col <= 2) || (c9.row > 2 && c9.col > 2);
  const c9W5EN = c9IsP
    ? `using one kernel for both, ${num((c9B1[c9Or][c9Oc] + c9B2[c9Or][c9Oc]) * c9K1v)}`
    : `using the cross value at equal inputs, where the kernel value is 1, ${num(c9B1[0][1] * c9.k1 + c9B2[0][1] * c9.k2)}`;
  const c9W5ZH = c9IsP
    ? `用同一个核处理所有项，得到 ${num((c9B1[c9Or][c9Oc] + c9B2[c9Or][c9Oc]) * c9K1v)}`
    : `在相同输入处使用交叉值（此时核值为 1），得到 ${num(c9B1[0][1] * c9.k1 + c9B2[0][1] * c9.k2)}`;

  return [
    g.number({
      id: 'kron-dim',
      title: t('Size of a Kronecker product', '克罗内克积的大小'),
      prompt: t(`A is an m × n matrix and B is a p × q matrix, with m = ${c1.m}, n = ${c1.n}, p = ${c1.p} and q = ${c1.q}. The Kronecker product A ⊗ B replaces every entry aᵢⱼ of A by the block aᵢⱼB (Lecture 10 p. 40). How many entries does A ⊗ B have in total? Give an integer.`,
        `A 是 m × n 矩阵，B 是 p × q 矩阵，其中 m = ${c1.m}、n = ${c1.n}、p = ${c1.p}、q = ${c1.q}。克罗内克积 A ⊗ B 把 A 的每个元素 aᵢⱼ 换成分块 aᵢⱼB（第 10 讲第 40 页）。A ⊗ B 一共有多少个元素？请填整数。`),
      fields: [{ label: t('Number of entries', '元素个数'), answer: c1Key, tolerance: 0.006 }],
      hint: t('Count how many blocks A ⊗ B has and how many entries one block has.', '数一数 A ⊗ B 有多少个分块，每个分块有多少个元素。'),
      explanation: t(`A ⊗ B ∈ ℝ^{mp×nq} (Lecture 10 p. 42): ${cnt(c1.m,c1.p)} rows and ${cnt(c1.n,c1.q)} columns, so ${cnt(c1.m*c1.p,c1.n*c1.q)} entries. Counting blocks gives the same: A has ${cnt(c1.m,c1.n)} entries, each replaced by a block of ${cnt(c1.p,c1.q)} entries, and ${cnt(c1.m*c1.n,c1.p*c1.q)}. Adding the sizes, (${c1.m} + ${c1.p})·(${c1.n} + ${c1.q}), would give ${(c1.m + c1.p) * (c1.n + c1.q)}; adding the entry counts of A and B, ${c1.m * c1.n + c1.p * c1.q}; adding rows and columns, ${c1.m * c1.p + c1.n * c1.q}; forgetting the columns of the blocks, ${c1.m * c1.n * c1.p}.`,
        `A ⊗ B ∈ ℝ^{mp×nq}（第 10 讲第 42 页）：有 ${cnt(c1.m,c1.p)} 行和 ${cnt(c1.n,c1.q)} 列，所以共有 ${cnt(c1.m*c1.p,c1.n*c1.q)} 个元素。按分块数也一样：A 有 ${cnt(c1.m,c1.n)} 个元素，每个都换成含 ${cnt(c1.p,c1.q)} 个元素的分块，${cnt(c1.m*c1.n,c1.p*c1.q)}。把尺寸相加 (${c1.m} + ${c1.p})·(${c1.n} + ${c1.q}) 会得到 ${(c1.m + c1.p) * (c1.n + c1.q)}；把 A 与 B 的元素个数相加得到 ${c1.m * c1.n + c1.p * c1.q}；把行数与列数相加得到 ${c1.m * c1.p + c1.n * c1.q}；忘了分块的列数得到 ${c1.m * c1.n * c1.p}。`),
      audit: { kind: 'GP-27:kron-dim', params: { m: c1.m, n: c1.n, p: c1.p, q: c1.q } },
    }),
    g.number({
      id: 'kron-inverse',
      title: t('Inverting a Kronecker product', '克罗内克积的逆'),
      prompt: t(`A = ${mat([[num(c2.a), num(c2.b)], [num(c2.b), num(c2.a)]])} and B = ${mat([[num(c2.d1), '0'], ['0', num(c2.d2)]])} are invertible. The 4 × 4 matrix A ⊗ B is built from the blocks aᵢⱼB (Lecture 10 p. 40). What is the entry in row 1 and column 3 of its inverse (A ⊗ B)⁻¹? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `A = ${mat([[num(c2.a), num(c2.b)], [num(c2.b), num(c2.a)]])} 与 B = ${mat([[num(c2.d1), '0'], ['0', num(c2.d2)]])} 都可逆。4 × 4 矩阵 A ⊗ B 由分块 aᵢⱼB 构成（第 10 讲第 40 页）。它的逆矩阵 (A ⊗ B)⁻¹ 中第 1 行第 3 列的元素是多少？请填整数、分数，或保留 2 位小数的小数。`),
      fields: [{ label: t('Entry (1, 3) of (A ⊗ B)⁻¹', '(A ⊗ B)⁻¹ 的第 (1, 3) 个元素'), answer: c2Key, tolerance: 0.006 }],
      hint: t('You do not need to invert a 4 × 4 matrix. What is known about the inverse of a Kronecker product (Lecture 10 p. 43)?', '不必求 4 × 4 矩阵的逆。关于克罗内克积的逆，已知什么（第 10 讲第 43 页）？'),
      explanation: t(`(A ⊗ B)⁻¹ = A⁻¹ ⊗ B⁻¹ (Lecture 10 p. 43). Column 3 of the 4 × 4 matrix is block column 2, position 1 inside the block, and row 1 is block row 1, position 1 inside the block, so the entry is (A⁻¹)₁₂·(B⁻¹)₁₁. The determinant is ${num(c2Det)}. Therefore A⁻¹ = ${mat([[frac(c2.a, c2Det), frac(-c2.b, c2Det)], [frac(-c2.b, c2Det), frac(c2.a, c2Det)]])} and B⁻¹ = ${mat([[frac(1, c2.d1), '0'], ['0', frac(1, c2.d2)]])}. The entry is ${frac(-c2.b, c2Det)}·${frac(1, c2.d1)} = ${exact(c2Key)}. Not inverting B would give ${exact((-c2.b * c2.d1) / c2Det)}; not inverting A, ${exact(c2.b / c2.d1)}; a diagonal entry of A⁻¹ instead of the off-diagonal one, ${exact(c2.a / (c2Det * c2.d1))}; the second diagonal entry of B⁻¹, ${exact(-c2.b / (c2Det * c2.d2))}; inverting the single number ${exact(c2.b * c2.d1)}, ${exact(1 / (c2.b * c2.d1))}.`,
        `(A ⊗ B)⁻¹ = A⁻¹ ⊗ B⁻¹（第 10 讲第 43 页）。4 × 4 矩阵的第 3 列是第 2 个分块列、分块内第 1 个位置，第 1 行是第 1 个分块行、分块内第 1 个位置，所以该元素是 (A⁻¹)₁₂·(B⁻¹)₁₁。行列式为 ${num(c2Det)}。因此 A⁻¹ = ${mat([[frac(c2.a, c2Det), frac(-c2.b, c2Det)], [frac(-c2.b, c2Det), frac(c2.a, c2Det)]])}，B⁻¹ = ${mat([[frac(1, c2.d1), '0'], ['0', frac(1, c2.d2)]])}。该元素为 ${frac(-c2.b, c2Det)}·${frac(1, c2.d1)} = ${exact(c2Key)}。不对 B 求逆会得到 ${exact((-c2.b * c2.d1) / c2Det)}；不对 A 求逆得到 ${exact(c2.b / c2.d1)}；用 A⁻¹ 的对角元代替非对角元得到 ${exact(c2.a / (c2Det * c2.d1))}；用 B⁻¹ 的第二个对角元得到 ${exact(-c2.b / (c2Det * c2.d2))}；把 A ⊗ B 中那个数 ${exact(c2.b * c2.d1)} 直接取倒数得到 ${exact(1 / (c2.b * c2.d1))}。`),
      audit: { kind: 'GP-27:kron-inverse', params: { a: c2.a, b: c2.b, d1: c2.d1, d2: c2.d2 } },
    }),
    g.number({
      id: 'imc-cov',
      title: t('Cross-covariance in an IMC', 'IMC 中的互协方差'),
      prompt: t(`An intrinsic model of coregionalisation (IMC) has two outputs, f(x) = (f₁(x), f₂(x))ᵀ = a⁽¹⁾u⁽¹⁾(x) + a⁽²⁾u⁽²⁾(x), where u⁽¹⁾ and u⁽²⁾ are independent zero-mean GPs with the same kernel k (Lecture 10 pp. 49 and 50). The weight vectors are a⁽¹⁾ = (${num(c3.p1)}, ${num(c3.p2)}) and a⁽²⁾ = (${num(c3.q1)}, ${num(c3.q2)}) (columns, weight on f₁ first), and k(x₁, x₂) = ${num(c3.k)}. What is Cov(f₁(x₁), f₂(x₂))? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `内蕴协区域化模型（IMC）有两个输出，f(x) = (f₁(x), f₂(x))ᵀ = a⁽¹⁾u⁽¹⁾(x) + a⁽²⁾u⁽²⁾(x)，其中 u⁽¹⁾ 与 u⁽²⁾ 是相互独立的零均值 GP，且核 k 相同（第 10 讲第 49、50 页）。权重向量为 a⁽¹⁾ = (${num(c3.p1)}, ${num(c3.p2)}) 和 a⁽²⁾ = (${num(c3.q1)}, ${num(c3.q2)})（列向量，第一个数是对 f₁ 的权重），k(x₁, x₂) = ${num(c3.k)}。Cov(f₁(x₁), f₂(x₂)) 是多少？请填整数、分数，或保留 2 位小数的小数。`),
      fields: [{ label: t('Cov(f₁(x₁), f₂(x₂))', 'Cov(f₁(x₁), f₂(x₂))'), answer: c3Key, tolerance: 0.006 }],
      hint: t('The two latent GPs are independent. Ask which products of weights survive when you multiply f₁(x₁) by f₂(x₂) and take the mean.', '两个潜 GP 相互独立。想一想把 f₁(x₁) 与 f₂(x₂) 相乘再取均值时，哪些权重乘积会保留下来。'),
      explanation: t(`Different draws are independent, so only products of weights of the same draw survive, and each is multiplied by the kernel (Lecture 10 p. 52): Cov(f₁(x₁), f₂(x₂)) = (a₁⁽¹⁾a₂⁽¹⁾ + a₁⁽²⁾a₂⁽²⁾)·k(x₁, x₂), which is the entry b₁₂ of B̂ times k. Here ${prodS([c3.p1,c3.p2])} + ${prodS([c3.q1,c3.q2],true)} = ${num(c3.p1 * c3.p2)} + ${par(c3.q1 * c3.q2)} = ${num(c3S)}, so the covariance is ${prodS([c3S,c3.k],true)} = ${num(c3Key)}. Using only the first draw would give ${num(c3.p1 * c3.p2 * c3.k)}; only the second, ${num(c3.q1 * c3.q2 * c3.k)}; forgetting the kernel value, ${num(c3S)}; merging the draws into one weight vector, ${num((c3.p1 + c3.q1) * (c3.p2 + c3.q2) * c3.k)}; pairing the draws across, ${num((c3.p1 * c3.q2 + c3.q1 * c3.p2) * c3.k)}.`,
        `不同的抽样相互独立，所以只有同一次抽样的权重乘积会保留，并且乘上核值（第 10 讲第 52 页）：Cov(f₁(x₁), f₂(x₂)) = (a₁⁽¹⁾a₂⁽¹⁾ + a₁⁽²⁾a₂⁽²⁾)·k(x₁, x₂)，也就是 B̂ 的元素 b₁₂ 乘以 k。这里 ${prodS([c3.p1,c3.p2])} + ${prodS([c3.q1,c3.q2],true)} = ${num(c3.p1 * c3.p2)} + ${par(c3.q1 * c3.q2)} = ${num(c3S)}，所以协方差为 ${prodS([c3S,c3.k],true)} = ${num(c3Key)}。只用第一次抽样会得到 ${num(c3.p1 * c3.p2 * c3.k)}；只用第二次得到 ${num(c3.q1 * c3.q2 * c3.k)}；忘了核值得到 ${num(c3S)}；把两次抽样并成一个权重向量得到 ${num((c3.p1 + c3.q1) * (c3.p2 + c3.q2) * c3.k)}；交叉配对得到 ${num((c3.p1 * c3.q2 + c3.q1 * c3.p2) * c3.k)}。`),
      audit: { kind: 'GP-27:imc-cov', params: { p1: c3.p1, p2: c3.p2, q1: c3.q1, q2: c3.q2, k: c3.k } },
    }),
    g.number({
      id: 'slfm-cov',
      title: t('Cross-covariance in an SLFM', 'SLFM 中的互协方差'),
      prompt: t(`A semiparametric latent factor model (SLFM) has two outputs, f(x) = (f₁(x), f₂(x))ᵀ = a₁u₁(x) + a₂u₂(x), where u₁ and u₂ are independent zero-mean GPs with different kernels k₁ and k₂ (Lecture 10 pp. 56 and 57). The weight vectors are a₁ = (${num(c4.a11)}, ${num(c4.a12)}) and a₂ = (${num(c4.a21)}, ${num(c4.a22)}) (columns, weight on f₁ first), and k₁(x₁, x₂) = ${num(c4.k1)}, k₂(x₁, x₂) = ${num(c4.k2)}. What is Cov(f₁(x₁), f₂(x₂))? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `半参数隐因子模型（SLFM）有两个输出，f(x) = (f₁(x), f₂(x))ᵀ = a₁u₁(x) + a₂u₂(x)，其中 u₁ 与 u₂ 是相互独立的零均值 GP，核不同，分别为 k₁ 与 k₂（第 10 讲第 56、57 页）。权重向量为 a₁ = (${num(c4.a11)}, ${num(c4.a12)}) 和 a₂ = (${num(c4.a21)}, ${num(c4.a22)})（列向量，第一个数是对 f₁ 的权重），k₁(x₁, x₂) = ${num(c4.k1)}，k₂(x₁, x₂) = ${num(c4.k2)}。Cov(f₁(x₁), f₂(x₂)) 是多少？请填整数、分数，或保留 2 位小数的小数。`),
      fields: [{ label: t('Cov(f₁(x₁), f₂(x₂))', 'Cov(f₁(x₁), f₂(x₂))'), answer: c4Key, tolerance: 0.006 }],
      hint: t('u₁ and u₂ have different kernels. Ask which kernel value multiplies the weight product of each latent GP.', 'u₁ 与 u₂ 的核不同。想一想每个潜 GP 的权重乘积各自应乘哪一个核值。'),
      explanation: t(`The latent GPs are independent, so each one contributes the product of its two weights times its own kernel value (Lecture 10 pp. 59 and 60): Cov(f₁(x₁), f₂(x₂)) = a₁₁a₁₂ k₁(x₁, x₂) + a₂₁a₂₂ k₂(x₁, x₂), where the first entry of each weight vector is its weight on f₁ and the second its weight on f₂. Here ${prodS([c4.a11,c4.a12,c4.k1])} + ${prodS([c4.a21,c4.a22,c4.k2],true)} = ${num(c4.a11 * c4.a12 * c4.k1)} + ${par(c4.a21 * c4.a22 * c4.k2)} = ${num(c4Key)}. Using one kernel for both, ${prodS([c4.a11*c4.a12+c4.a21*c4.a22,c4.k1],true)} or ${prodS([c4.a11*c4.a12+c4.a21*c4.a22,c4.k2],true)}, would give ${num((c4.a11 * c4.a12 + c4.a21 * c4.a22) * c4.k1)} or ${num((c4.a11 * c4.a12 + c4.a21 * c4.a22) * c4.k2)}; leaving out the second latent GP, ${num(c4.a11 * c4.a12 * c4.k1)}; the first, ${num(c4.a21 * c4.a22 * c4.k2)}; swapping the kernels, ${num(c4.a11 * c4.a12 * c4.k2 + c4.a21 * c4.a22 * c4.k1)}.`,
        `潜 GP 相互独立，所以每一个贡献自己的两个权重之积乘上自己的核值（第 10 讲第 59、60 页）：Cov(f₁(x₁), f₂(x₂)) = a₁₁a₁₂ k₁(x₁, x₂) + a₂₁a₂₂ k₂(x₁, x₂)，其中第一个下标指向量编号，第二个下标指输出编号。这里 ${prodS([c4.a11,c4.a12,c4.k1])} + ${prodS([c4.a21,c4.a22,c4.k2],true)} = ${num(c4.a11 * c4.a12 * c4.k1)} + ${par(c4.a21 * c4.a22 * c4.k2)} = ${num(c4Key)}。两个都用同一个核，即 ${prodS([c4.a11*c4.a12+c4.a21*c4.a22,c4.k1],true)} 或 ${prodS([c4.a11*c4.a12+c4.a21*c4.a22,c4.k2],true)}，会得到 ${num((c4.a11 * c4.a12 + c4.a21 * c4.a22) * c4.k1)} 或 ${num((c4.a11 * c4.a12 + c4.a21 * c4.a22) * c4.k2)}；漏掉第二个潜 GP 得到 ${num(c4.a11 * c4.a12 * c4.k1)}；漏掉第一个得到 ${num(c4.a21 * c4.a22 * c4.k2)}；两个核对调得到 ${num(c4.a11 * c4.a12 * c4.k2 + c4.a21 * c4.a22 * c4.k1)}。`),
      audit: { kind: 'GP-27:slfm-cov', params: { a11: c4.a11, a12: c4.a12, a21: c4.a21, a22: c4.a22, k1: c4.k1, k2: c4.k2 } },
    }),
    g.number({
      id: 'lmc-var',
      title: t('Variance of one output of an LMC', 'LMC 中一个输出的方差'),
      prompt: t(`A linear model of coregionalisation (LMC) has two outputs and Q = 2 independent kernels (Lecture 10 pp. 61 and 62): f(x) = a₁⁽¹⁾u₁⁽¹⁾(x) + a₁⁽²⁾u₁⁽²⁾(x) + a₂⁽¹⁾u₂⁽¹⁾(x). All draws are independent zero-mean GPs. Kernel k₁ is used for the S₁ = 2 draws u₁⁽¹⁾ and u₁⁽²⁾ with weight vectors a₁⁽¹⁾ = (${num(c5.p1)}, ${num(c5.p2)}) and a₁⁽²⁾ = (${num(c5.q1)}, ${num(c5.q2)}); kernel k₂ is used for the S₂ = 1 draw u₂⁽¹⁾ with a₂⁽¹⁾ = (${num(c5.r1)}, ${num(c5.r2)}). Each vector lists the weight on f₁ first and on f₂ second. The variances are k₁(x, x) = ${num(c5.v1)} and k₂(x, x) = ${num(c5.v2)}. What is the variance Var(f${c5.j === 1 ? '₁' : '₂'}(x)) of output ${c5.j}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `线性协区域化模型（LMC）有两个输出和 Q = 2 个相互独立的核（第 10 讲第 61、62 页）：f(x) = a₁⁽¹⁾u₁⁽¹⁾(x) + a₁⁽²⁾u₁⁽²⁾(x) + a₂⁽¹⁾u₂⁽¹⁾(x)。所有抽样都是相互独立的零均值 GP。核 k₁ 用于 S₁ = 2 次抽样 u₁⁽¹⁾ 与 u₁⁽²⁾，权重向量为 a₁⁽¹⁾ = (${num(c5.p1)}, ${num(c5.p2)}) 和 a₁⁽²⁾ = (${num(c5.q1)}, ${num(c5.q2)})；核 k₂ 用于 S₂ = 1 次抽样 u₂⁽¹⁾，权重向量为 a₂⁽¹⁾ = (${num(c5.r1)}, ${num(c5.r2)})。每个向量的第一个数是对 f₁ 的权重，第二个数是对 f₂ 的权重。方差为 k₁(x, x) = ${num(c5.v1)} 与 k₂(x, x) = ${num(c5.v2)}。输出 ${c5.j} 的方差 Var(f${c5.j === 1 ? '₁' : '₂'}(x)) 是多少？请填整数、分数，或保留 2 位小数的小数。`),
      fields: [{ label: t(`Var(f${c5.j === 1 ? '₁' : '₂'}(x))`, `Var(f${c5.j === 1 ? '₁' : '₂'}(x))`), answer: c5Key, tolerance: 0.006 }],
      hint: t('Independent terms add their variances. What does a weight do to the variance of the GP it multiplies?', '相互独立的项方差相加。一个权重乘到某个 GP 上，会对它的方差产生什么影响？'),
      explanation: t(`All draws are independent, so the variances of the terms add, and a weight w multiplies the variance of its GP by w² (Lecture 10 pp. 63 and 64, entry ${c5.j}${c5.j} of B₁ and B₂ with x = x′). On output ${c5.j} the weights are ${num(c5a)} and ${num(c5b)} for kernel 1 and ${num(c5c)} for kernel 2. The squares are ${c5a * c5a} and ${c5b * c5b}, with sum ${c5a * c5a + c5b * c5b}, for kernel 1 and ${c5c * c5c} for kernel 2. So Var(f${c5.j === 1 ? '₁' : '₂'}(x)) = ${num(c5.v1)}·${c5a * c5a + c5b * c5b} + ${num(c5.v2)}·${c5c * c5c} = ${num(c5Key)}. Merging the two draws of kernel 1 into one weight, (${num(c5a)} + ${par(c5b)})², would give ${num(c5.v1 * (c5a + c5b) * (c5a + c5b) + c5.v2 * c5c * c5c)}; not squaring the weights, ${num(c5.v1 * (c5a + c5b) + c5.v2 * c5c)}; using k₁ for every term, ${num(c5.v1 * (c5a * c5a + c5b * c5b + c5c * c5c))}; forgetting the kernel variances, ${num(c5a * c5a + c5b * c5b + c5c * c5c)}; reading the other output, ${num(c5.v1 * ((c5.j === 1 ? c5.p2 : c5.p1) ** 2 + (c5.j === 1 ? c5.q2 : c5.q1) ** 2) + c5.v2 * (c5.j === 1 ? c5.r2 : c5.r1) ** 2)}.`,
        `所有抽样相互独立，所以各项的方差相加，权重 w 把它所乘 GP 的方差乘以 w²（第 10 讲第 63、64 页，B₁ 与 B₂ 的第 ${c5.j}${c5.j} 个元素，取 x = x′）。输出 ${c5.j} 上，核 1 的权重为 ${num(c5a)} 与 ${num(c5b)}，核 2 的权重为 ${num(c5c)}。核 1 的平方为 ${c5a * c5a} 与 ${c5b * c5b}，和为 ${c5a * c5a + c5b * c5b}；核 2 的平方为 ${c5c * c5c}。所以 Var(f${c5.j === 1 ? '₁' : '₂'}(x)) = ${num(c5.v1)}·${c5a * c5a + c5b * c5b} + ${num(c5.v2)}·${c5c * c5c} = ${num(c5Key)}。把核 1 的两次抽样并成一个权重 (${num(c5a)} + ${par(c5b)})² 会得到 ${num(c5.v1 * (c5a + c5b) * (c5a + c5b) + c5.v2 * c5c * c5c)}；不取平方得到 ${num(c5.v1 * (c5a + c5b) + c5.v2 * c5c)}；对每一项都用 k₁ 得到 ${num(c5.v1 * (c5a * c5a + c5b * c5b + c5c * c5c))}；忘了核的方差得到 ${num(c5a * c5a + c5b * c5b + c5c * c5c)}；读成另一个输出得到 ${num(c5.v1 * ((c5.j === 1 ? c5.p2 : c5.p1) ** 2 + (c5.j === 1 ? c5.q2 : c5.q1) ** 2) + c5.v2 * (c5.j === 1 ? c5.r2 : c5.r1) ** 2)}。`),
      audit: { kind: 'GP-27:lmc-var', params: { p1: c5.p1, p2: c5.p2, q1: c5.q1, q2: c5.q2, r1: c5.r1, r2: c5.r2, v1: c5.v1, v2: c5.v2, j: c5.j } },
    }),
    g.choice({
      id: 'which-model',
      title: t('IMC, SLFM or LMC?', 'IMC、SLFM 还是 LMC？'),
      prompt: t(`A multi-output GP is a weighted sum of independent zero-mean GP draws, f(x) = ∑ a u(x), where every draw has a constant weight vector a and belongs to one of Q = ${c6Q} latent kernels (the kernels are different from each other when Q > 1). The numbers of draws per kernel are ${c6S.map((s, i) => `S${sub(i + 1)} = ${s}`).join(', ')}. Which model of Lecture 10 is this?`,
        `多输出 GP 是相互独立的零均值 GP 抽样的加权和，f(x) = ∑ a u(x)，每次抽样都有常数权重向量 a，并且属于 Q = ${c6Q} 个潜核之一（Q > 1 时这些核互不相同）。各个核的抽样次数为${c6S.map((s, i) => `S${sub(i + 1)} = ${s}`).join('、')}。这是第 10 讲中的哪一个模型？`),
      options: [
        t('The intrinsic model of coregionalisation (IMC), because all draws share one kernel', '内蕴协区域化模型（IMC），因为所有抽样共用同一个核'),
        t('The semiparametric latent factor model (SLFM), because every kernel has exactly one draw', '半参数隐因子模型（SLFM），因为每个核恰好只有一次抽样'),
        t('A general linear model of coregionalisation (LMC) that is neither an IMC nor an SLFM', '一般的线性协区域化模型（LMC），既不是 IMC 也不是 SLFM'),
        t('A Gaussian process regression network (GPRN), because several latent processes are mixed together', '高斯过程回归网络（GPRN），因为这里把好几个不同的潜过程混合在了一起'),
      ],
      correct: c6Correct,
      hint: t('Look at how many kernels there are and how many draws each kernel has.', '看一看有几个核，每个核有几次抽样。'),
      explanation: t(`One kernel shared by S ≥ 2 draws is the IMC (Lecture 10 pp. 49 and 50); it is the bracketed term of the LMC (p. 63). Several different kernels with one draw each is the SLFM (p. 57). Several kernels with several draws for at least one of them is the general LMC (pp. 61 and 62); the SLFM is the case of one draw per kernel (compare p. 57 with p. 62) and the IMC the case of a single kernel. Here ${c6S.map((s, i) => `S${sub(i + 1)} = ${s}`).join(', ')}: ${c6Class === 0 ? 'there is one kernel, so it is an IMC' : (c6Class === 1 ? 'every kernel has one draw, so it is an SLFM' : 'there are several kernels and at least one has several draws, so it is a general LMC')}. It is not a GPRN, because that model mixes the latent GPs with weights W(x) that are themselves GPs (p. 68), while the weights here are constants.`,
        `一个核被 S ≥ 2 次抽样共用是 IMC（第 10 讲第 49、50 页），它是 LMC 中括号里的那一项（第 63 页）。几个不同的核、每个核只抽一次是 SLFM（第 57 页）。几个核、其中至少一个核有多次抽样，是一般的 LMC（第 61、62 页）；SLFM 对应每个核只抽一次的情形（比较第 57 页与第 62 页），IMC 对应只有一个核的情形。这里${c6S.map((s, i) => `S${sub(i + 1)} = ${s}`).join('、')}：${c6Class === 0 ? '只有一个核，所以是 IMC' : (c6Class === 1 ? '每个核只抽一次，所以是 SLFM' : '有多个核且至少一个核有多次抽样，所以是一般的 LMC')}。它不是 GPRN，因为 GPRN 用本身也是 GP 的权重 W(x) 来混合潜 GP（第 68 页），而这里的权重是常数。`),
    }),
    g.number({
      id: 'psd-limit',
      title: t('How strong can the cross term be?', '互协方差项最大能取多大？'),
      prompt: t(`An IMC with two outputs has the coregionalisation matrix B̂ = ${mat([[String(c7[0]), 'c'], ['c', String(c7[1])]])}. B̂ is a sum of terms a aᵀ (Lecture 10 p. 53), so it must be positive semi-definite. What is the largest value of c ≥ 0 for which this is still possible? Give an integer.`,
        `一个有两个输出的 IMC，协区域化矩阵为 B̂ = ${mat([[String(c7[0]), 'c'], ['c', String(c7[1])]])}。B̂ 是若干形如 a aᵀ 的项之和（第 10 讲第 53 页），所以必须半正定。c ≥ 0 时，c 最大能取多少才仍然可能？请填整数。`),
      fields: [{ label: t('Largest c', 'c 的最大值'), answer: c7Key, tolerance: 0.006 }],
      hint: t('B̂ is symmetric 2 × 2. A symmetric matrix is positive semi-definite when its eigenvalues are not negative. Which single number of the matrix is the product of its two eigenvalues?', 'B̂ 是 2 × 2 对称矩阵。对称矩阵半正定当且仅当特征值都不为负。矩阵的哪一个数等于两个特征值的乘积？'),
      explanation: t(`Every term a aᵀ has eigenvalues 0 and ‖a‖², so B̂ = ∑ a aᵀ is positive semi-definite (Lecture 10 p. 53). For a symmetric 2 × 2 matrix this means non-negative diagonal entries and a non-negative determinant (standard linear algebra, not a slide statement): ${c7[0]}·${c7[1]} − c² ≥ 0, so c ≤ √(${c7[0]}·${c7[1]}) = √${c7[0] * c7[1]} = ${c7Key}. At c = ${c7Key} the determinant is 0, B̂ has rank 1 and f₂ is a constant multiple of f₁; a larger c gives a negative eigenvalue, so B̂ ⊗ K would not be a covariance matrix. The mean (${c7[0]} + ${c7[1]})/2 would give ${(c7[0] + c7[1]) / 2}; the product ${c7[0] * c7[1]}; the sum ${c7[0] + c7[1]}; the smaller entry ${Math.min(c7[0], c7[1])}; the larger ${Math.max(c7[0], c7[1])}; the difference ${Math.abs(c7[0] - c7[1])}.`,
        `每一项 a aᵀ 的特征值为 0 和 ‖a‖²，所以 B̂ = ∑ a aᵀ 半正定（第 10 讲第 53 页）。对 2 × 2 对称矩阵，这意味着对角元非负且行列式非负（线性代数的标准结论，不是讲义原话）：${c7[0]}·${c7[1]} − c² ≥ 0，所以 c ≤ √(${c7[0]}·${c7[1]}) = √${c7[0] * c7[1]} = ${c7Key}。c = ${c7Key} 时行列式为 0，B̂ 的秩为 1，f₂ 是 f₁ 的常数倍；c 更大则出现负特征值，B̂ ⊗ K 就不是协方差矩阵了。取平均值 (${c7[0]} + ${c7[1]})/2 会得到 ${(c7[0] + c7[1]) / 2}；取乘积得到 ${c7[0] * c7[1]}；取和得到 ${c7[0] + c7[1]}；取较小的对角元得到 ${Math.min(c7[0], c7[1])}；取较大的得到 ${Math.max(c7[0], c7[1])}；取差得到 ${Math.abs(c7[0] - c7[1])}。`),
      audit: { kind: 'GP-27:psd-limit', params: { b11: c7[0], b22: c7[1] } },
    }),
    g.choice({
      id: 'zero-cross',
      title: t('A zero cross term', '为零的互协方差项'),
      prompt: t(`An IMC with two outputs has the coregionalisation matrix B̂ = ${mat([[String(c8.b11), '0'], ['0', String(c8.b22)]])} and a shared kernel k whose kernel matrix K is positive definite. The observation noise of the two outputs is independent. Which statement is correct (Lecture 10 pp. 47 and 55; GPML PDF p. 208)?`,
        `一个有两个输出的 IMC，协区域化矩阵为 B̂ = ${mat([[String(c8.b11), '0'], ['0', String(c8.b22)]])}，共享核 k 的核矩阵 K 正定。两个输出的观测噪声相互独立。下面哪一项正确（第 10 讲第 47、55 页；教材 PDF 第 208 页）？`),
      options: [
        t('The outputs are independent a priori: the joint covariance is block diagonal, so data on f₁ alone says nothing about f₂', '两个输出先验独立：联合协方差是分块对角的，所以只有 f₁ 的数据不会改变对 f₂ 的预测'),
        t('The outputs are perfectly correlated, because both are built from the same kernel k, so f₂ is just a rescaled copy of f₁ and carries no new information', '两个输出完全相关，因为二者都由同一个核 k 构成，所以 f₂ 只是 f₁ 按比例缩放后的复本，不含任何新信息'),
        t('The outputs are still correlated through the shared kernel k, so data on f₁ also changes the prediction for f₂', '两个输出仍通过共享的核 k 相关，所以 f₁ 的数据也会改变对 f₂ 的预测'),
        t('The joint covariance B̂ ⊗ K is singular because B̂ has a zero entry, so the prior has no density', '联合协方差 B̂ ⊗ K 奇异，因为 B̂ 有一个零元素，所以先验没有密度'),
      ],
      correct: 0,
      hint: t('Write the covariance between f₁(x) and f₂(x′) using B̂ and k. Is it zero for some pairs of inputs or for all of them?', '用 B̂ 与 k 写出 f₁(x) 与 f₂(x′) 的协方差。它是对某些输入对为零，还是对所有输入对都为零？'),
      explanation: t(`The covariance between the outputs is b₁₂ k(x, x′) = 0 for every pair of inputs (Lecture 10 p. 55), so the stacked vector has the block-diagonal covariance [[${c8.b11 === 1 ? "" : num(c8.b11)}K, 0], [0, ${c8.b22 === 1 ? "" : num(c8.b22)}K]], like two independent GPs (p. 47). With independent noise the posterior factorises as well, so data on f₁ alone cannot change the prediction for f₂. Sharing the kernel does not couple the outputs: only b₁₂ does. The outputs are two independent draws of the same type of GP, scaled by ${c8.b11} and ${c8.b22} in variance, not copies of each other. B̂ ⊗ K is invertible because B̂ = diag(${c8.b11}, ${c8.b22}) and K are (p. 43). With correlated noise, independent outputs would become correlated in the posterior (GPML PDF p. 208). This game does not assess inferring B from data.`,
        `两个输出之间的协方差为 b₁₂ k(x, x′) = 0，对每一对输入都成立（第 10 讲第 55 页），所以堆叠向量的协方差是分块对角的 [[${c8.b11 === 1 ? "" : num(c8.b11)}K, 0], [0, ${c8.b22 === 1 ? "" : num(c8.b22)}K]]，就像两个独立的 GP（第 47 页）。噪声独立时后验也会分解，所以只有 f₁ 的数据无法改变对 f₂ 的预测。共享核并不会把输出耦合起来，起耦合作用的只有 b₁₂。两个输出是同一类 GP 的两次独立抽样，方差分别被放大 ${c8.b11} 倍和 ${c8.b22} 倍，并不是彼此的复本。B̂ ⊗ K 可逆，因为 B̂ = diag(${c8.b11}, ${c8.b22}) 与 K 都可逆（第 43 页）。若噪声相关，独立的输出在后验中会变得相关（教材 PDF 第 208 页）。本游戏不考查如何从数据推断 B。`),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: an entry of an LMC covariance', '挑战：LMC 协方差矩阵的一个元素'),
      prompt: t(`An LMC with two outputs uses two independent kernels. Kernel k₁ has two independent draws with weight vectors a₁⁽¹⁾ = (${num(c9.p1)}, ${num(c9.p2)}) and a₁⁽²⁾ = (${num(c9.q1)}, ${num(c9.q2)}); kernel k₂ has one draw with a₂⁽¹⁾ = (${num(c9.r1)}, ${num(c9.r2)}). Each vector lists the weight on f₁ first and on f₂ second. At the two inputs x₁ and x₂ the four values k₁(x₁, x₁), k₁(x₂, x₂), k₂(x₁, x₁) and k₂(x₂, x₂) are all 1, and k₁(x₁, x₂) = ${num(c9.k1)}, k₂(x₁, x₂) = ${num(c9.k2)}. Let C be the 4 × 4 covariance matrix of the vector (f₁(x₁), f₁(x₂), f₂(x₁), f₂(x₂)) in this order. What is the entry of C in row ${c9.row} and column ${c9.col}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个有两个输出的 LMC 使用两个相互独立的核。核 k₁ 有两次相互独立的抽样，权重向量为 a₁⁽¹⁾ = (${num(c9.p1)}, ${num(c9.p2)}) 和 a₁⁽²⁾ = (${num(c9.q1)}, ${num(c9.q2)})；核 k₂ 有一次抽样，权重向量为 a₂⁽¹⁾ = (${num(c9.r1)}, ${num(c9.r2)})。每个向量的第一个数是对 f₁ 的权重，第二个数是对 f₂ 的权重。在两个输入 x₁ 与 x₂ 处，四个值 k₁(x₁, x₁)、k₁(x₂, x₂)、k₂(x₁, x₁)、k₂(x₂, x₂) 都等于 1，并且 k₁(x₁, x₂) = ${num(c9.k1)}，k₂(x₁, x₂) = ${num(c9.k2)}。记 C 为向量 (f₁(x₁), f₁(x₂), f₂(x₁), f₂(x₂))（按此顺序）的 4 × 4 协方差矩阵。C 的第 ${c9.row} 行第 ${c9.col} 列的元素是多少？请填整数、分数，或保留 2 位小数的小数。`),
      fields: [{ label: t('Entry of C', 'C 的元素'), answer: c9Key, tolerance: 0.006 }],
      hint: t(`Row ${c9.row} stands for one output at one input, and so does column ${c9.col}. Which output and which input are they? Then use the draws of each kernel.`,
        `第 ${c9.row} 行对应某个输出在某个输入处的值，第 ${c9.col} 列也是。它们各是哪个输出、哪个输入？然后再用各个核的抽样。`),
      explanation: t(`The vector is ordered output by output, so row ${c9.row} is (f${sub(c9Or + 1)}, x${sub(c9Ir + 1)}) and column ${c9.col} is (f${sub(c9Oc + 1)}, x${sub(c9Ic + 1)}). The draws of one kernel add up in its matrix B = ∑ a aᵀ, and the kernels add up as B₁ ⊗ K₁ + B₂ ⊗ K₂ (Lecture 10 p. 64): B₁ = ${c9B1Str}, B₂ = ${c9B2Str}, and the entry is B₁ entry (${c9Or}, ${c9Oc}) times the K₁ value ${num(c9K1v)} plus B₂ entry (${c9Or}, ${c9Oc}) times the K₂ value ${num(c9K2v)}: ${par(c9B1[c9Or][c9Oc])}·${num(c9K1v)} + ${par(c9B2[c9Or][c9Oc])}·${num(c9K2v)} = ${num(c9Key)}. Putting the blocks the other way round, K ⊗ B, would give ${num((c9Or === c9Oc ? 1 : c9.k1) * c9B1[c9Ir][c9Ic] + (c9Or === c9Oc ? 1 : c9.k2) * c9B2[c9Ir][c9Ic])}; using only the kernel 1 term, ${num(c9B1[c9Or][c9Oc] * c9K1v)}; only the kernel 2 term, ${num(c9B2[c9Or][c9Oc] * c9K2v)}; dropping the second draw of kernel 1, ${num((c9Or === 0 ? c9.p1 : c9.p2) * (c9Oc === 0 ? c9.p1 : c9.p2) * c9K1v + c9B2[c9Or][c9Oc] * c9K2v)}; ${c9W5EN}. This game does not assess fitting or inferring B.`,
        `向量按输出逐个排列，所以第 ${c9.row} 行是 (f${sub(c9Or + 1)}, x${sub(c9Ir + 1)})，第 ${c9.col} 列是 (f${sub(c9Oc + 1)}, x${sub(c9Ic + 1)})。同一个核的多次抽样在它的矩阵 B = ∑ a aᵀ 中相加，各个核再按 B₁ ⊗ K₁ + B₂ ⊗ K₂ 相加（第 10 讲第 64 页）：B₁ = ${c9B1Str}，B₂ = ${c9B2Str}，所求元素等于 B₁ 的第 (${c9Or}, ${c9Oc}) 个元素乘以 K₁ 的值 ${num(c9K1v)}，加上 B₂ 的第 (${c9Or}, ${c9Oc}) 个元素乘以 K₂ 的值 ${num(c9K2v)}：${par(c9B1[c9Or][c9Oc])}·${num(c9K1v)} + ${par(c9B2[c9Or][c9Oc])}·${num(c9K2v)} = ${num(c9Key)}。把分块顺序反过来，即 K ⊗ B，会得到 ${num((c9Or === c9Oc ? 1 : c9.k1) * c9B1[c9Ir][c9Ic] + (c9Or === c9Oc ? 1 : c9.k2) * c9B2[c9Ir][c9Ic])}；只用核 1 的项得到 ${num(c9B1[c9Or][c9Oc] * c9K1v)}；只用核 2 的项得到 ${num(c9B2[c9Or][c9Oc] * c9K2v)}；漏掉核 1 的第二次抽样得到 ${num((c9Or === 0 ? c9.p1 : c9.p2) * (c9Oc === 0 ? c9.p1 : c9.p2) * c9K1v + c9B2[c9Or][c9Oc] * c9K2v)}；${c9W5ZH}。本游戏不考查拟合或推断 B。`),
      audit: { kind: 'GP-27:challenge', params: { p1: c9.p1, p2: c9.p2, q1: c9.q1, q2: c9.q2, r1: c9.r1, r2: c9.r2, k1: c9.k1, k2: c9.k2, row: c9.row, col: c9.col } },
    }),
  ];
};
