import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, term, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const dec = (x: number | string) => (typeof x === "string" ? x : num(r4(x)));
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const gp09: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-09');
  warm(g);

  // Card 1: eigen-min
  const c1 = retry(() => {
    const a = g.random(2, 6);
    const sign = g.random(0, 1) === 0 ? 1 : -1;
    const b = sign * g.random(1, a - 1);
    return { a, b };
  }, v => v.a !== 2 * Math.abs(v.b));
  const c1Answer = c1.a - Math.abs(c1.b);

  // Card 2: det-test
  const c2 = retry(() => {
    const a = g.random(1, 5);
    const c = g.random(1, 5);
    const b = g.random(1, 5);
    return { a, b, c };
  }, v => v.a !== v.c && v.b * v.b > v.a * v.c && v.b <= Math.max(v.a, v.c));
  const c2Det = c2.a * c2.c - c2.b * c2.b;

  // Card 3: compose
  const c3 = retry(() => {
    const l1 = g.pick([2, 3]);
    const l2 = g.pick([2, 3]);
    const l3 = g.pick([1, 2, 3]);
    const x = g.pick([1, 2, 3]);
    const xp = g.pick([-3, -2, -1, 1, 2, 3]);
    const rp = g.pick([[0.5, 0.5], [0.5, 0.25], [0.25, 0.5]]);
    return { l1, l2, l3, x, xp, r: rp[0], p: rp[1] };
  }, v => {
    const lin = v.x * v.xp;
    if (lin === 1 || lin === v.x + v.xp) return false;
    const truth = v.l1 * v.l2 * v.r * v.p + v.l3 * lin;
    const wrong1 = v.l1 * v.l2 * (v.r + v.p) + v.l3 * lin;
    const wrong2 = v.l1 * v.l2 * v.r * v.p + v.l3;
    const wrong3 = v.l1 * v.l2 * (v.r * v.p + v.l3 * lin);
    const wrong4 = v.r * v.p + v.l3 * lin;
    const wrong5 = v.l1 * v.l2 * v.r * v.p + v.l3 * (v.x + v.xp);
    const wrong6 = v.l1 * v.l2 * v.r * v.p;
    return Math.abs(truth - wrong1) >= 0.02 && Math.abs(truth - wrong2) >= 0.02 && Math.abs(truth - wrong3) >= 0.02 && Math.abs(truth - wrong4) >= 0.02 && Math.abs(truth - wrong5) >= 0.02 && Math.abs(truth - wrong6) >= 0.02;
  });
  const c3Lin = c3.x * c3.xp;
  const c3Prod = c3.l1 * c3.r * c3.l2 * c3.p;
  const c3Lterm = c3.l3 * c3Lin;
  const c3Answer = c3Prod + c3Lterm;

  // Card 4: scale-fn
  const c4 = retry(() => {
    const d = g.random(2, 5);
    const b = g.random(1, d - 1);
    const st = g.pick([[2, -3], [3, -2], [-2, 3], [-3, 2]]);
    return { d, b, s: st[0], t: st[1] };
  }, () => true);
  const c4F1 = c4.t * c4.t * c4.d;
  const c4F2 = c4.s * c4.t * c4.b;

  // Card 5: product-gram
  const c5 = retry(() => {
    const a1 = g.pick([2, 3, 4]);
    const a2 = g.pick([2, 3, 4]);
    const b1 = (g.random(0, 1) === 0 ? 1 : -1) * g.random(1, a1 - 1);
    const b2 = (g.random(0, 1) === 0 ? 1 : -1) * g.random(1, a2 - 1);
    return { a1, b1, a2, b2 };
  }, v => {
    if (v.a1 * v.b2 + v.a2 * v.b1 === 0) return false;
    if (v.a1 * v.a2 === 2 * Math.abs(v.b1 * v.b2)) return false;
    const truth = v.a1 * v.a2 - Math.abs(v.b1 * v.b2);
    const wrong2 = (v.a1 - Math.abs(v.b1)) * (v.a2 - Math.abs(v.b2));
    const wrong3 = v.a1 * v.a2 + Math.abs(v.b1 * v.b2);
    const wrong4 = v.a1 * v.a2;
    const wrong5 = (v.a1 * v.a2) * (v.a1 * v.a2) - (v.b1 * v.b2) * (v.b1 * v.b2);
    const wrong6 = (v.a1 - Math.abs(v.b1)) + (v.a2 - Math.abs(v.b2));
    const wrong7 = Math.abs(v.b1 * v.b2);
    return Math.abs(truth - wrong2) >= 0.02 && Math.abs(truth - wrong3) >= 0.02 && Math.abs(truth - wrong4) >= 0.02 && Math.abs(truth - wrong5) >= 0.02 && Math.abs(truth - wrong6) >= 0.02 && Math.abs(truth - wrong7) >= 0.02;
  });
  const c5Answer = c5.a1 * c5.a2 - Math.abs(c5.b1 * c5.b2);

  // Card 6: not-guaranteed
  const c6 = retry(() => {
    const p = g.pick([2, 3, 4, 5]);
    const q = g.pick([2, 3, 4, 5]);
    return { p, q };
  }, v => v.p !== v.q);

  // Card 7: diff-quad
  const c7 = retry(() => {
    const a1 = g.random(2, 5);
    const a2 = g.random(2, 5);
    const b1 = g.random(1, a1 - 1);
    const b2 = g.random(1, a2 - 1);
    const v = g.pick([[1, -1], [1, -2], [2, -1], [1, -3], [3, -1]]);
    return { a1, b1, a2, b2, v1: v[0], v2: v[1] };
  }, v => {
    const da = v.a1 - v.a2;
    const db = v.b1 - v.b2;
    const Q = da * (v.v1 * v.v1 + v.v2 * v.v2) + 2 * db * v.v1 * v.v2;
    if (Q >= 0) return false;
    const w1 = v.a1 * (v.v1 * v.v1 + v.v2 * v.v2) + 2 * v.b1 * v.v1 * v.v2;
    const w2 = v.a2 * (v.v1 * v.v1 + v.v2 * v.v2) + 2 * v.b2 * v.v1 * v.v2;
    const wrong1 = w1 + w2;
    const wrong2 = w1;
    const wrong3 = w2;
    const wrong4 = da * (v.v1 * v.v1 + v.v2 * v.v2) + db * v.v1 * v.v2;
    const wrong5 = da * (v.v1 * v.v1 + v.v2 * v.v2) + 2 * db * Math.abs(v.v1 * v.v2);
    const wrong6 = da * (v.v1 * v.v1 + v.v2 * v.v2);
    return Math.abs(Q - wrong1) >= 0.02 && Math.abs(Q - wrong2) >= 0.02 && Math.abs(Q - wrong3) >= 0.02 && Math.abs(Q - wrong4) >= 0.02 && Math.abs(Q - wrong5) >= 0.02 && Math.abs(Q - wrong6) >= 0.02;
  });
  const c7Da = c7.a1 - c7.a2;
  const c7Db = c7.b1 - c7.b2;
  const c7W1 = c7Da * c7.v1 + c7Db * c7.v2;
  const c7W2 = c7Db * c7.v1 + c7Da * c7.v2;
  const c7Answer = c7.v1 * c7W1 + c7.v2 * c7W2;

  // Card 8: challenge
  const c8 = retry(() => {
    const a1 = g.pick([2, 3, 4]);
    const b1 = (g.random(0, 1) === 0 ? 1 : -1) * g.random(1, a1 - 1);
    const a2 = g.pick([2, 3]);
    const b2 = -g.random(1, a2 - 1);
    const c = g.pick([1, 2, 3]);
    return { a1, b1, a2, b2, c };
  }, v => {
    if (v.c === Math.abs(v.b2)) return false;
    const truth = v.a1 * (v.a2 + v.c) - Math.abs(v.b1) * Math.abs(v.b2 + v.c);
    // smallest eigenvalue of the matrix product K₁K₂ + c·K₁ = K₁(K₂ + cI); both factors share eigenvectors (1, ±1)
    const wrong1 = Math.min((v.a1 + v.b1) * (v.a2 + v.c + v.b2), (v.a1 - v.b1) * (v.a2 + v.c - v.b2));
    const wrong2 = (v.a1 * v.a2 - Math.abs(v.b1 * v.b2)) + v.c * (v.a1 - Math.abs(v.b1));
    const wrong3 = v.a1 * (v.a2 + v.c) - Math.abs(v.b1 * v.b2);
    const wrong4 = v.a1 * v.a2 - Math.abs(v.b1) * Math.abs(v.b2 + v.c);
    const wrong5 = v.a1 * (v.a2 + v.c) + Math.abs(v.b1) * Math.abs(v.b2 + v.c);
    const wrong6 = v.a1 * (v.a2 + v.c);
    const wrong7 = v.a1 * v.a2 - Math.abs(v.b1 * v.b2);
    return Math.abs(truth - wrong1) >= 0.02 && Math.abs(truth - wrong2) >= 0.02 && Math.abs(truth - wrong3) >= 0.02 && Math.abs(truth - wrong4) >= 0.02 && Math.abs(truth - wrong5) >= 0.02 && Math.abs(truth - wrong6) >= 0.02 && Math.abs(truth - wrong7) >= 0.02;
  });
  const c8Dd = c8.a1 * (c8.a2 + c8.c);
  const c8Oo = c8.b1 * (c8.b2 + c8.c);
  const c8Answer = c8Dd - Math.abs(c8Oo);

  return [
    g.number({
      id: 'eigen-min',
      title: t('Smallest eigenvalue', '最小特征值'),
      prompt: t(
        `A kernel k has the Gram matrix K = ${mat([[num(c1.a), num(c1.b)], [num(c1.b), num(c1.a)]])} at two inputs x₁, x₂. What is the smallest eigenvalue of K? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `核函数 k 在两个输入 x₁、x₂ 上的 Gram 矩阵为 K = ${mat([[num(c1.a), num(c1.b)], [num(c1.b), num(c1.a)]])}。K 的最小特征值是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('smallest eigenvalue of K', 'K 的最小特征值'), answer: c1Answer, tolerance: 0.006 }],
      hint: t(
        'Compute K·(1, 1) and K·(1, −1) with the printed entries. Each result is a multiple of the vector you started with; the multiples are eigenvalues.',
        '用给出的矩阵分别计算 K·(1, 1) 和 K·(1, −1)。每个结果都是原向量的倍数，这些倍数就是特征值。'
      ),
      explanation: t(
        `K·(1, 1) = (${dec(c1.a)} + ${par(c1.b)}, ${par(c1.b)} + ${par(c1.a)}) = (${dec(c1.a + c1.b)}, ${dec(c1.a + c1.b)}) = ${par(c1.a + c1.b)}·(1, 1) and K·(1, −1) = (${dec(c1.a)} − ${par(c1.b)}, ${par(c1.b)} − ${par(c1.a)}) = (${dec(c1.a - c1.b)}, ${num(c1.b - c1.a)}) = ${par(c1.a - c1.b)}·(1, −1). So the eigenvalues are ${dec(c1.a + c1.b)} and ${dec(c1.a - c1.b)}; the smallest is ${exact(c1Answer)}. A symmetric matrix is positive semi-definite exactly when all its eigenvalues are non-negative (GPML pdf p. 98), so K is a possible Gram matrix of a kernel.`,
        `K·(1, 1) = (${dec(c1.a)} + ${par(c1.b)}, ${par(c1.b)} + ${par(c1.a)}) = (${dec(c1.a + c1.b)}, ${dec(c1.a + c1.b)}) = ${par(c1.a + c1.b)}·(1, 1)，K·(1, −1) = (${dec(c1.a)} − ${par(c1.b)}, ${par(c1.b)} − ${par(c1.a)}) = (${dec(c1.a - c1.b)}, ${num(c1.b - c1.a)}) = ${par(c1.a - c1.b)}·(1, −1)。所以特征值为 ${dec(c1.a + c1.b)} 和 ${dec(c1.a - c1.b)}，最小的是 ${exact(c1Answer)}。对称矩阵半正定当且仅当所有特征值非负（GPML pdf 第 98 页），所以 K 可以是某个核函数的 Gram 矩阵。`
      ),
      audit: { kind: 'GP-09:eigen-min', params: { a: c1.a, b: c1.b } }
    }),
    g.choice({
      id: 'det-test',
      title: t('A suspicious Gram matrix', '一个可疑的 Gram 矩阵'),
      prompt: t(
        `Someone proposes a kernel k whose Gram matrix at two inputs x₁, x₂ is K = ${mat([[num(c2.a), num(c2.b)], [num(c2.b), num(c2.c)]])}. Which statement is correct?`,
        `有人提出一个核函数 k，它在两个输入 x₁、x₂ 上的 Gram 矩阵为 K = ${mat([[num(c2.a), num(c2.b)], [num(c2.b), num(c2.c)]])}。下列哪条说法正确？`
      ),
      options: [
        t(`Not valid: ${par(c2.a)}·${par(c2.c)} − ${par(c2.b)}² is negative, so K has a negative eigenvalue.`, `不合法：${par(c2.a)}·${par(c2.c)} − ${par(c2.b)}² 为负，所以 K 有负特征值。`),
        t('Valid: K is symmetric and its diagonal entries are positive, which is enough.', '合法：K 对称且对角元为正，这就足够了。'),
        t('Valid: every entry of K is positive, so K is positive semi-definite.', '合法：K 的每个元素都为正，所以 K 半正定。'),
        t('Not valid: the diagonal entries k(x₁, x₁) and k(x₂, x₂) must be equal.', '不合法：对角元 k(x₁, x₁) 与 k(x₂, x₂) 必须相等。')
      ],
      correct: 0,
      hint: t(
        'A symmetric 2 × 2 matrix is positive semi-definite only if both eigenvalues are non-negative. What does that say about their product, the determinant?',
        '对称的 2 × 2 矩阵半正定，当且仅当两个特征值都非负。这对它们的乘积（行列式）意味着什么？'
      ),
      explanation: t(
        `For a symmetric 2 × 2 matrix the product of the two eigenvalues is the determinant: ${par(c2.a)}·${par(c2.c)} − ${par(c2.b)}² = ${dec(c2.a * c2.c)} − ${par(c2.b * c2.b)} = ${dec(c2Det)}. A negative determinant means one eigenvalue is negative, so some vector v gives vᵀKv < 0 and K cannot be the Gram matrix of a kernel (GPML pdf p. 98). Symmetry and positive entries are not enough, and unequal diagonal entries are perfectly allowed.`,
        `对称 2 × 2 矩阵的两个特征值之积等于行列式：${par(c2.a)}·${par(c2.c)} − ${par(c2.b)}² = ${dec(c2.a * c2.c)} − ${par(c2.b * c2.b)} = ${dec(c2Det)}。行列式为负说明有一个特征值为负，于是存在向量 v 使 vᵀKv < 0，K 不可能是核函数的 Gram 矩阵（GPML pdf 第 98 页）。仅有对称性和正元素是不够的，而对角元不相等是完全允许的。`
      ),
      audit: { kind: 'GP-09:det-test', params: { a: c2.a, b: c2.b, c: c2.c } }
    }),
    g.number({
      id: 'compose',
      title: t('Evaluating a composed kernel', '计算组合核'),
      prompt: t(
        `Build k(x, x′) = λ₁·RBF(x, x′) × λ₂·PER(x, x′) + λ₃·LIN(x, x′) with λ₁ = ${dec(c3.l1)}, λ₂ = ${dec(c3.l2)}, λ₃ = ${dec(c3.l3)}, where LIN(x, x′) = x·x′ (the product of the two inputs). At x = ${dec(c3.x)} and x′ = ${par(c3.xp)} the other two kernels take the values RBF(x, x′) = ${num(c3.r)} and PER(x, x′) = ${num(c3.p)}. The × is evaluated before the +. What is k(x, x′)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `构造 k(x, x′) = λ₁·RBF(x, x′) × λ₂·PER(x, x′) + λ₃·LIN(x, x′)，其中 λ₁ = ${dec(c3.l1)}，λ₂ = ${dec(c3.l2)}，λ₃ = ${dec(c3.l3)}，LIN(x, x′) = x·x′（两个输入的乘积）。在 x = ${dec(c3.x)}、x′ = ${par(c3.xp)} 处，另外两个核的取值为 RBF(x, x′) = ${num(c3.r)}，PER(x, x′) = ${num(c3.p)}。先算 ×，再算 +。k(x, x′) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(x, x′)', 'k(x, x′)'), answer: c3Answer, tolerance: 0.006 }],
      hint: t(
        'A product and a sum of kernels are taken value by value at the same pair (x, x′), and × is done before +. Work out the product part and the LIN part separately.',
        '核的乘积与和都是在同一对 (x, x′) 上逐个取值再运算，并且先乘后加。分别算出乘积部分和 LIN 部分。'
      ),
      explanation: t(
        `The product part is ${par(c3.l1)}·${par(c3.r)}·${par(c3.l2)}·${par(c3.p)} = ${num(c3Prod)}. LIN(x, x′) = x·x′ = ${par(c3.x)}·${par(c3.xp)} = ${num(c3Lin)}, so the last term is ${par(c3.l3)}·${par(c3Lin)} = ${num(c3Lterm)}. Sum: ${num(c3Prod)} + ${par(c3Lterm)} = ${exact(c3Answer)} (Lecture 5 p. 22, eqs. (18)–(23)). Sums, products and constant weights of kernels are again kernels (Lecture 3 p. 25).`,
        `乘积部分为 ${par(c3.l1)}·${par(c3.r)}·${par(c3.l2)}·${par(c3.p)} = ${num(c3Prod)}。LIN(x, x′) = x·x′ = ${par(c3.x)}·${par(c3.xp)} = ${num(c3Lin)}，所以最后一项为 ${par(c3.l3)}·${par(c3Lin)} = ${num(c3Lterm)}。相加：${num(c3Prod)} + ${par(c3Lterm)} = ${exact(c3Answer)}（第 5 讲第 22 页，式 (18)–(23)）。核的和、积以及常数权重仍是核（第 3 讲第 25 页）。`
      ),
      audit: { kind: 'GP-09:compose', params: { l1: c3.l1, l2: c3.l2, l3: c3.l3, x: c3.x, xp: c3.xp, r: c3.r, p: c3.p } }
    }),
    g.number({
      id: 'scale-fn',
      title: t('Scaling by a function', '函数缩放'),
      prompt: t(
        `At two inputs x₁, x₂ a kernel k₁ has the Gram matrix K₁ = ${mat([[num(c4.d), num(c4.b)], [num(c4.b), num(c4.d)]])}. A function a(x) takes the values a(x₁) = ${par(c4.s)} and a(x₂) = ${par(c4.t)}. The kernel k(x, x′) = a(x)·k₁(x, x′)·a(x′) is built from them. Find k(x₂, x₂) and k(x₁, x₂). Give integers, fractions or decimals rounded to 2 places.`,
        `在两个输入 x₁、x₂ 上，核 k₁ 的 Gram 矩阵为 K₁ = ${mat([[num(c4.d), num(c4.b)], [num(c4.b), num(c4.d)]])}。函数 a(x) 取值 a(x₁) = ${par(c4.s)}，a(x₂) = ${par(c4.t)}。用它们构造核 k(x, x′) = a(x)·k₁(x, x′)·a(x′)。求 k(x₂, x₂) 和 k(x₁, x₂)。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('k(x₂, x₂)', 'k(x₂, x₂)'), answer: c4F1, tolerance: 0.006 },
        { label: t('k(x₁, x₂)', 'k(x₁, x₂)'), answer: c4F2, tolerance: 0.006 }
      ],
      hint: t(
        'For the first entry use a(x₂) on both sides; for the second use a(x₁) on the left and a(x₂) on the right, with the matching entry of K₁ in the middle.',
        '第一个元素两侧都用 a(x₂)；第二个元素左侧用 a(x₁)、右侧用 a(x₂)，中间放 K₁ 中对应的元素。'
      ),
      explanation: t(
        `k(x₂, x₂) = a(x₂)·k₁(x₂, x₂)·a(x₂) = ${par(c4.t)}·${par(c4.d)}·${par(c4.t)} = ${exact(c4F1)}. k(x₁, x₂) = a(x₁)·k₁(x₁, x₂)·a(x₂) = ${par(c4.s)}·${par(c4.b)}·${par(c4.t)} = ${exact(c4F2)}. The function a(x) may be negative (Lecture 3 p. 25, 'for arbitrary a(x)'; GPML pdf p. 113): the diagonal entries stay positive because they contain a(x)², and the sign of the off-diagonal entry follows the signs of a(x₁) and a(x₂). The whole Gram matrix is ${mat([[num(c4.s * c4.s * c4.d), num(c4F2)], [num(c4F2), num(c4F1)]])}, still positive semi-definite.`,
        `k(x₂, x₂) = a(x₂)·k₁(x₂, x₂)·a(x₂) = ${par(c4.t)}·${par(c4.d)}·${par(c4.t)} = ${exact(c4F1)}。k(x₁, x₂) = a(x₁)·k₁(x₁, x₂)·a(x₂) = ${par(c4.s)}·${par(c4.b)}·${par(c4.t)} = ${exact(c4F2)}。a(x) 可以取负值（第 3 讲第 25 页，“a(x) 任意”；GPML pdf 第 113 页）：对角元含有 a(x)²，所以仍为正，非对角元的符号由 a(x₁)、a(x₂) 的符号决定。整个 Gram 矩阵为 ${mat([[num(c4.s * c4.s * c4.d), num(c4F2)], [num(c4F2), num(c4F1)]])}，仍然半正定。`
      ),
      audit: { kind: 'GP-09:scale-fn', params: { d: c4.d, b: c4.b, s: c4.s, t: c4.t } }
    }),
    g.number({
      id: 'product-gram',
      title: t('The product of two kernels', '两个核的乘积'),
      prompt: t(
        `At two inputs x₁, x₂ the kernels k₁ and k₂ have the Gram matrices K₁ = ${mat([[num(c5.a1), num(c5.b1)], [num(c5.b1), num(c5.a1)]])} and K₂ = ${mat([[num(c5.a2), num(c5.b2)], [num(c5.b2), num(c5.a2)]])}. The kernel k(x, x′) = k₁(x, x′)·k₂(x, x′) multiplies the two values at each pair of inputs. What is the smallest eigenvalue of the Gram matrix of k at x₁, x₂? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在两个输入 x₁、x₂ 上，核 k₁ 和 k₂ 的 Gram 矩阵分别为 K₁ = ${mat([[num(c5.a1), num(c5.b1)], [num(c5.b1), num(c5.a1)]])} 和 K₂ = ${mat([[num(c5.a2), num(c5.b2)], [num(c5.b2), num(c5.a2)]])}。核 k(x, x′) = k₁(x, x′)·k₂(x, x′) 在每一对输入上把两个值相乘。k 在 x₁、x₂ 上的 Gram 矩阵的最小特征值是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('smallest eigenvalue of the Gram matrix of k', 'k 的 Gram 矩阵的最小特征值'), answer: c5Answer, tolerance: 0.006 }],
      hint: t(
        'Multiply the two kernels at each pair separately, for (x₁, x₁), (x₁, x₂) and (x₂, x₂), and write the 2 × 2 result. Then find its eigenvalues.',
        '对 (x₁, x₁)、(x₁, x₂)、(x₂, x₂) 三对输入分别把两个核的值相乘，写出 2 × 2 的结果，再求它的特征值。'
      ),
      explanation: t(
        `The Gram matrix of k is the entry-by-entry product: k(x₁, x₁) = k(x₂, x₂) = ${par(c5.a1)}·${par(c5.a2)} = ${dec(c5.a1 * c5.a2)} and k(x₁, x₂) = ${par(c5.b1)}·${par(c5.b2)} = ${num(c5.b1 * c5.b2)}, so it is ${mat([[num(c5.a1 * c5.a2), num(c5.b1 * c5.b2)], [num(c5.b1 * c5.b2), num(c5.a1 * c5.a2)]])}. Its eigenvalues are ${dec(c5.a1 * c5.a2 + c5.b1 * c5.b2)} and ${dec(c5.a1 * c5.a2 - c5.b1 * c5.b2)}; the smallest is ${exact(c5Answer)}. This is not the matrix product K₁K₂ and not the product of the two smallest eigenvalues (Lecture 3 p. 25, GPML pdf p. 113). It is positive, as the Gram matrix of a product of kernels must be.`,
        `k 的 Gram 矩阵是逐元素相乘：k(x₁, x₁) = k(x₂, x₂) = ${par(c5.a1)}·${par(c5.a2)} = ${dec(c5.a1 * c5.a2)}，k(x₁, x₂) = ${par(c5.b1)}·${par(c5.b2)} = ${num(c5.b1 * c5.b2)}，所以是 ${mat([[num(c5.a1 * c5.a2), num(c5.b1 * c5.b2)], [num(c5.b1 * c5.b2), num(c5.a1 * c5.a2)]])}。它的特征值为 ${dec(c5.a1 * c5.a2 + c5.b1 * c5.b2)} 和 ${dec(c5.a1 * c5.a2 - c5.b1 * c5.b2)}，最小的是 ${exact(c5Answer)}。这不是矩阵乘积 K₁K₂，也不是两个最小特征值的乘积（第 3 讲第 25 页，GPML pdf 第 113 页）。结果为正，与核之积必须半正定一致。`
      ),
      audit: { kind: 'GP-09:product-gram', params: { a1: c5.a1, b1: c5.b1, a2: c5.a2, b2: c5.b2 } }
    }),
    g.choice({
      id: 'not-guaranteed',
      title: t('Which combination can fail?', '哪种组合可能失败？'),
      prompt: t(
        'k₁ and k₂ are valid kernels: every Gram matrix they produce is symmetric and positive semi-definite. Which of the following is NOT guaranteed to be a valid kernel?',
        'k₁ 和 k₂ 是合法的核：它们产生的每个 Gram 矩阵都对称且半正定。下列哪一个不一定是合法的核？'
      ),
      options: [
        t(`${par(c6.p)}·k₁(x, x′) − ${par(c6.q)}·k₂(x, x′)`, `${par(c6.p)}·k₁(x, x′) − ${par(c6.q)}·k₂(x, x′)`),
        t(`${par(c6.p)}·k₁(x, x′) + ${par(c6.q)}·k₂(x, x′)`, `${par(c6.p)}·k₁(x, x′) + ${par(c6.q)}·k₂(x, x′)`),
        t('k₁(x, x′)·k₂(x, x′)', 'k₁(x, x′)·k₂(x, x′)'),
        t('a(x)·k₁(x, x′)·a(x′), where a is any real function, possibly negative', 'a(x)·k₁(x, x′)·a(x′)，其中 a 是任意实函数，可以取负值')
      ],
      correct: 0,
      hint: t(
        'A valid kernel must keep vᵀKv ≥ 0 for every vector v. Which operation can turn a non-negative quantity into a negative one?',
        '合法的核必须对每个向量 v 都满足 vᵀKv ≥ 0。哪种运算可能把非负的量变成负的？'
      ),
      explanation: t(
        `Sums with positive weights, products taken value by value, and scaling a(x)k₁(x, x′)a(x′) all keep the Gram matrix symmetric and positive semi-definite (Lecture 3 p. 25; GPML pdf p. 113); a(x) may be negative because it appears squared on the diagonal. A difference gives no such guarantee: take k₁ = 0 (a valid kernel) and any k₂ with vᵀK₂v > 0 for some v; then ${par(c6.p)}·k₁ − ${par(c6.q)}·k₂ has vᵀKv = −${par(c6.q)}·vᵀK₂v < 0. The next card computes such a case.`,
        `带正权重的和、逐值相乘的积、以及缩放 a(x)k₁(x, x′)a(x′) 都保持 Gram 矩阵对称半正定（第 3 讲第 25 页；GPML pdf 第 113 页）；a(x) 可以取负值，因为它在对角线上以平方出现。差没有这样的保证：取 k₁ = 0（合法的核）和任意使某个 v 满足 vᵀK₂v > 0 的 k₂，则 ${par(c6.p)}·k₁ − ${par(c6.q)}·k₂ 满足 vᵀKv = −${par(c6.q)}·vᵀK₂v < 0。下一关计算这样的例子。`
      ),
      audit: { kind: 'GP-09:not-guaranteed', params: { p: c6.p, q: c6.q } }
    }),
    g.number({
      id: 'diff-quad',
      title: t('A difference of two kernels', '两个核之差'),
      prompt: t(
        `At two inputs x₁, x₂ the valid kernels k₁ and k₂ have the Gram matrices K₁ = ${mat([[num(c7.a1), num(c7.b1)], [num(c7.b1), num(c7.a1)]])} and K₂ = ${mat([[num(c7.a2), num(c7.b2)], [num(c7.b2), num(c7.a2)]])}. Let k = k₁ − k₂ with Gram matrix K, and let v = (${num(c7.v1)}, ${num(c7.v2)}). Find vᵀKv. Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在两个输入 x₁、x₂ 上，合法的核 k₁ 和 k₂ 的 Gram 矩阵分别为 K₁ = ${mat([[num(c7.a1), num(c7.b1)], [num(c7.b1), num(c7.a1)]])} 和 K₂ = ${mat([[num(c7.a2), num(c7.b2)], [num(c7.b2), num(c7.a2)]])}。令 k = k₁ − k₂，其 Gram 矩阵为 K，并取 v = (${num(c7.v1)}, ${num(c7.v2)})。求 vᵀKv。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('vᵀKv', 'vᵀKv'), answer: c7Answer, tolerance: 0.006 }],
      hint: t(
        'Subtract the matrices first. Then multiply K by v, and take the dot product of v with the result.',
        '先把两个矩阵相减。再用 K 乘以 v，最后把结果与 v 做点积。'
      ),
      explanation: t(
        `K = K₁ − K₂ = ${mat([[num(c7Da), num(c7Db)], [num(c7Db), num(c7Da)]])}. Then the first entry of Kv is ${par(c7Da)}·${par(c7.v1)} + ${par(c7Db)}·${par(c7.v2)} = ${num(c7W1)} and the second is ${par(c7Db)}·${par(c7.v1)} + ${par(c7Da)}·${par(c7.v2)} = ${num(c7W2)}, so Kv = (${num(c7W1)}, ${num(c7W2)}), and vᵀKv = ${par(c7.v1)}·${par(c7W1)} + ${par(c7.v2)}·${par(c7W2)} = ${exact(c7Answer)}. A negative value means K is not positive semi-definite (GPML pdf p. 98 requires vᵀKv ≥ 0 for every v), so the difference of two valid kernels is not guaranteed to be a kernel.`,
        `K = K₁ − K₂ = ${mat([[num(c7Da), num(c7Db)], [num(c7Db), num(c7Da)]])}。于是 Kv 的第一个元素为 ${par(c7Da)}·${par(c7.v1)} + ${par(c7Db)}·${par(c7.v2)} = ${num(c7W1)}，第二个元素为 ${par(c7Db)}·${par(c7.v1)} + ${par(c7Da)}·${par(c7.v2)} = ${num(c7W2)}，所以 Kv = (${num(c7W1)}, ${num(c7W2)})，vᵀKv = ${par(c7.v1)}·${par(c7W1)} + ${par(c7.v2)}·${par(c7W2)} = ${exact(c7Answer)}。结果为负说明 K 不是半正定的（GPML pdf 第 98 页要求对每个 v 都有 vᵀKv ≥ 0），所以两个合法核之差不一定是核。`
      ),
      audit: { kind: 'GP-09:diff-quad', params: { a1: c7.a1, b1: c7.b1, a2: c7.a2, b2: c7.b2, v1: c7.v1, v2: c7.v2 } }
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: a new kernel from two', '挑战：由两个核构造新核'),
      prompt: t(
        `At two inputs x₁, x₂ the valid kernels k₁ and k₂ have the Gram matrices K₁ = ${mat([[num(c8.a1), num(c8.b1)], [num(c8.b1), num(c8.a1)]])} and K₂ = ${mat([[num(c8.a2), num(c8.b2)], [num(c8.b2), num(c8.a2)]])}. A new kernel is k(x, x′) = k₁(x, x′)·k₂(x, x′) + ${par(c8.c)}·k₁(x, x′), where the product multiplies the two values at each pair of inputs. What is the smallest eigenvalue of the Gram matrix of k at x₁, x₂? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在两个输入 x₁、x₂ 上，合法的核 k₁ 和 k₂ 的 Gram 矩阵分别为 K₁ = ${mat([[num(c8.a1), num(c8.b1)], [num(c8.b1), num(c8.a1)]])} 和 K₂ = ${mat([[num(c8.a2), num(c8.b2)], [num(c8.b2), num(c8.a2)]])}。新核为 k(x, x′) = k₁(x, x′)·k₂(x, x′) + ${par(c8.c)}·k₁(x, x′)，其中乘积在每一对输入上把两个值相乘。k 在 x₁、x₂ 上的 Gram 矩阵的最小特征值是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('smallest eigenvalue', '最小特征值'), answer: c8Answer, tolerance: 0.006 }],
      hint: t(
        'Write the three values k(x₁, x₁), k(x₁, x₂), k(x₂, x₂) first, then find the eigenvalues of the 2 × 2 matrix they form.',
        '先写出 k(x₁, x₁)、k(x₁, x₂)、k(x₂, x₂) 三个值，再求它们组成的 2 × 2 矩阵的特征值。'
      ),
      explanation: t(
        `k(x₁, x₁) = k(x₂, x₂) = ${par(c8.a1)}·${par(c8.a2)} + ${par(c8.c)}·${par(c8.a1)} = ${exact(c8Dd)} and k(x₁, x₂) = ${par(c8.b1)}·${par(c8.b2)} + ${par(c8.c)}·${par(c8.b1)} = ${exact(c8Oo)}. The Gram matrix is ${mat([[num(c8Dd), num(c8Oo)], [num(c8Oo), num(c8Dd)]])} with eigenvalues ${dec(c8Dd + c8Oo)} and ${dec(c8Dd - c8Oo)}; the smallest is ${exact(c8Answer)}. The smallest eigenvalues of the two pieces do not simply add, because their eigenvectors can differ. This game does not test proving validity for arbitrary inputs, eigenvalues of matrices larger than 2 × 2, or evaluating exp, sin and other kernel formulas.`,
        `k(x₁, x₁) = k(x₂, x₂) = ${par(c8.a1)}·${par(c8.a2)} + ${par(c8.c)}·${par(c8.a1)} = ${exact(c8Dd)}，k(x₁, x₂) = ${par(c8.b1)}·${par(c8.b2)} + ${par(c8.c)}·${par(c8.b1)} = ${exact(c8Oo)}。Gram 矩阵为 ${mat([[num(c8Dd), num(c8Oo)], [num(c8Oo), num(c8Dd)]])}，特征值为 ${dec(c8Dd + c8Oo)} 和 ${dec(c8Dd - c8Oo)}，最小的是 ${exact(c8Answer)}。两部分的最小特征值不能直接相加，因为它们的特征向量可能不同。本游戏不考查对任意输入证明核的合法性、大于 2 × 2 的矩阵的特征值，以及 exp、sin 等核公式的计算。`
      ),
      audit: { kind: 'GP-09:challenge', params: { a1: c8.a1, b1: c8.b1, a2: c8.a2, b2: c8.b2, c: c8.c } }
    })
  ];
};
