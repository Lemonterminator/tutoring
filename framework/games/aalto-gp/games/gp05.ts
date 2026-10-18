import type { CardGenerator } from '../../types';
import { fitView, type FigureShape } from '../../figure';
import { exact, makeGpDeck, mat, num, par, type Text } from '../support';

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

/** Format a matrix with proper minus signs (num() prints − for negatives). */
function matFmt(rows: number[][]): string {
  return mat(rows.map(r => r.map(n => num(n))));
}

export const gp05: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-05');
  warm(g);

  // Card 1: kernel-value
  const p1 = retry(() => ({
    a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]),
    x1: g.pick([-2, -1, 0, 1, 2, 3]), x2: g.pick([-2, -1, 0, 1, 2, 3]),
  }), v => {
    const truth = v.a + v.b * v.x1 * v.x2;
    const w1 = 1 + v.x1 * v.x2;
    const w2 = v.a + v.b * (v.x1 + v.x2);
    const w3 = v.b * v.x1 * v.x2;
    return Math.abs(truth - w1) >= 0.02 && Math.abs(truth - w2) >= 0.02 && Math.abs(truth - w3) >= 0.02;
  });
  const ans1 = p1.a + p1.b * p1.x1 * p1.x2;

  // Card 2: poly-feature
  const p2 = retry(() => ({
    a: g.pick([1, 2]), b: g.pick([1, 2]), c: g.pick([1, 2]),
    x1: g.pick([-1, 1, 2, 3]), x2: g.pick([-1, 1, 2]),
  }), v => {
    const truth = v.a + v.b * v.x1 * v.x2 + v.c * v.x1 * v.x1 * v.x2 * v.x2;
    const w1 = v.a + v.b * v.x1 * v.x2;
    const w2 = v.a + v.c * v.x1 * v.x1 * v.x2 * v.x2;
    const w3 = v.a + (v.b + v.c) * v.x1 * v.x2;
    return Math.abs(truth - w1) >= 0.02 && Math.abs(truth - w2) >= 0.02 && Math.abs(truth - w3) >= 0.02;
  });
  const ans2 = p2.a + p2.b * p2.x1 * p2.x2 + p2.c * p2.x1 * p2.x1 * p2.x2 * p2.x2;

  // Card 3: gram-det
  const p3 = retry(() => ({
    a: g.pick([2, 3, 4]), b: g.pick([1, 2, 3, 4]),
    x1: g.pick([1, 2]), x2: g.pick([1, 2, 3, 4]),
  }), v => {
    if (v.x1 === v.x2) return false;
    const truth = v.a * v.b * (v.x1 - v.x2) * (v.x1 - v.x2);
    const w1 = (v.x1 - v.x2) * (v.x1 - v.x2);
    const w2 = v.b * (v.x1 - v.x2) * (v.x1 - v.x2);
    const K11 = v.a + v.b * v.x1 * v.x1;
    const K22 = v.a + v.b * v.x2 * v.x2;
    const K12 = v.a + v.b * v.x1 * v.x2;
    const w3 = K11 * K22 - K12;
    return Math.abs(truth - w1) >= 0.02 && Math.abs(truth - w2) >= 0.02 && Math.abs(truth - w3) >= 0.02;
  });
  const ans3 = p3.a * p3.b * (p3.x1 - p3.x2) * (p3.x1 - p3.x2);
  const K11_3 = p3.a + p3.b * p3.x1 * p3.x1;
  const K22_3 = p3.a + p3.b * p3.x2 * p3.x2;
  const K12_3 = p3.a + p3.b * p3.x1 * p3.x2;

  // Card 4: gram-rank
  const p4 = retry(() => ({
    a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]),
    x1: g.pick([-1, 0, 1]), x2: g.pick([-1, 0, 1, 2]), x3: g.pick([-1, 0, 1, 2, 3]),
  }), v => v.x1 !== v.x2 && v.x2 !== v.x3 && v.x1 !== v.x3);
  const K4 = [
    [p4.a + p4.b * p4.x1 * p4.x1, p4.a + p4.b * p4.x1 * p4.x2, p4.a + p4.b * p4.x1 * p4.x3],
    [p4.a + p4.b * p4.x1 * p4.x2, p4.a + p4.b * p4.x2 * p4.x2, p4.a + p4.b * p4.x2 * p4.x3],
    [p4.a + p4.b * p4.x1 * p4.x3, p4.a + p4.b * p4.x2 * p4.x3, p4.a + p4.b * p4.x3 * p4.x3],
  ];

  // Card 8: challenge
  const p8 = retry(() => ({
    a: g.pick([2, 3, 4, 5]), c: g.pick([-1, 1, 2]), b: g.pick([2, 3]),
    x1: g.pick([-1, 1, 2]), x2: g.pick([1, 2, 3]),
  }), v => {
    if (v.a <= 0 || v.b <= 0 || v.a * v.b - v.c * v.c <= 0) return false;
    const k12 = v.a + v.c * (v.x1 + v.x2) + v.b * v.x1 * v.x2;
    const k11 = v.a + 2 * v.c * v.x1 + v.b * v.x1 * v.x1;
    const w12_1 = v.a + v.b * v.x1 * v.x2;
    const w12_2 = v.a + v.c * (v.x1 + v.x2);
    const w11_1 = v.a + v.b * v.x1 * v.x1;
    const w11_2 = v.a + 2 * v.c * v.x1;
    return Math.abs(k12 - w12_1) >= 0.02 && Math.abs(k12 - w12_2) >= 0.02 &&
           Math.abs(k11 - w11_1) >= 0.02 && Math.abs(k11 - w11_2) >= 0.02;
  });
  const ans8_1 = p8.a + p8.c * (p8.x1 + p8.x2) + p8.b * p8.x1 * p8.x2;
  const ans8_2 = p8.a + 2 * p8.c * p8.x1 + p8.b * p8.x1 * p8.x1;

  // Card 7 figure
  const shapes7: FigureShape[] = [
    { kind: 'line', points: [[-1, -1], [1, 1]], tone: 'accent' },
    { kind: 'line', points: [[-1, 0.5], [1, -0.5]], tone: 'muted' },
    { kind: 'line', points: [[-1, 0.3], [1, 0.7]], tone: 'warn' },
  ];

  return [
    g.number({
      id: 'kernel-value',
      title: t('A kernel value from the weights', '由权重得到一个核值'),
      prompt: t(
        `A Bayesian linear model has the two-dimensional feature map φ(x) = (1, x)ᵀ and prior w ~ N(0, Σ_p) with Σ_p = ${matFmt([[p1.a, 0], [0, p1.b]])}. So k(x, x′) = φ(x)ᵀΣ_pφ(x′). What is k(x₁, x₂) for x₁ = ${num(p1.x1)} and x₂ = ${num(p1.x2)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个贝叶斯线性模型的特征映射为二维的 φ(x) = (1, x)ᵀ，先验 w ~ N(0, Σ_p)，其中 Σ_p = ${matFmt([[p1.a, 0], [0, p1.b]])}。因此 k(x, x′) = φ(x)ᵀΣ_pφ(x′)。当 x₁ = ${num(p1.x1)}、x₂ = ${num(p1.x2)} 时，k(x₁, x₂) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(x₁, x₂)', 'k(x₁, x₂)'), answer: ans1, tolerance: 0.006 }],
      hint: t(
        `Put φ(x₁) = (1, ${num(p1.x1)}) and φ(x₂) = (1, ${num(p1.x2)}), apply Σ_p = ${matFmt([[p1.a, 0], [0, p1.b]])} to one of them, then take the dot product with the other.`,
        `写出 φ(x₁) = (1, ${num(p1.x1)})、φ(x₂) = (1, ${num(p1.x2)})，用 Σ_p = ${matFmt([[p1.a, 0], [0, p1.b]])} 作用在其中一个上，再与另一个做点积。`
      ),
      explanation: t(
        `Σ_pφ(x₂) = ${matFmt([[p1.a, 0], [0, p1.b]])}·(1, ${num(p1.x2)}) = (${num(p1.a)}, ${num(p1.b * p1.x2)}). Then k(x₁, x₂) = φ(x₁)·Σ_pφ(x₂) = 1·(${num(p1.a)}) + (${num(p1.x1)})·(${num(p1.b * p1.x2)}) = ${num(p1.a)} + ${par(p1.b * p1.x1 * p1.x2)} = ${exact(ans1)}. The kernel is the covariance between f(x₁) and f(x₂) that the weight prior induces (GPML pdf p. 30; slides p. 21).`,
        `Σ_pφ(x₂) = ${matFmt([[p1.a, 0], [0, p1.b]])}·(1, ${num(p1.x2)}) = (${num(p1.a)}, ${num(p1.b * p1.x2)})。于是 k(x₁, x₂) = φ(x₁)·Σ_pφ(x₂) = 1·(${num(p1.a)}) + (${num(p1.x1)})·(${num(p1.b * p1.x2)}) = ${num(p1.a)} + ${par(p1.b * p1.x1 * p1.x2)} = ${exact(ans1)}。这个核就是权重先验诱导出的 f(x₁) 与 f(x₂) 之间的协方差（GPML 第 30 页；讲义第 21 页）。`
      ),
      audit: { kind: 'GP-05:kernel-value', params: { a: p1.a, b: p1.b, x1: p1.x1, x2: p1.x2 } },
    }),

    g.number({
      id: 'poly-feature',
      title: t('A polynomial feature map', '多项式特征映射'),
      prompt: t(
        `A Bayesian linear model has the three-dimensional feature map φ(x) = (1, x, x²)ᵀ and prior w ~ N(0, Σ_p) with Σ_p = ${matFmt([[p2.a, 0, 0], [0, p2.b, 0], [0, 0, p2.c]])}. So k(x, x′) = φ(x)ᵀΣ_pφ(x′). What is k(x₁, x₂) for x₁ = ${num(p2.x1)} and x₂ = ${num(p2.x2)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个贝叶斯线性模型的特征映射为三维的 φ(x) = (1, x, x²)ᵀ，先验 w ~ N(0, Σ_p)，其中 Σ_p = ${matFmt([[p2.a, 0, 0], [0, p2.b, 0], [0, 0, p2.c]])}。因此 k(x, x′) = φ(x)ᵀΣ_pφ(x′)。当 x₁ = ${num(p2.x1)}、x₂ = ${num(p2.x2)} 时，k(x₁, x₂) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(x₁, x₂)', 'k(x₁, x₂)'), answer: ans2, tolerance: 0.006 }],
      hint: t(
        'Write φ(x₁) and φ(x₂) as three entries (1, x, x²); multiply entrywise by the diagonal of Σ_p, then take the dot product.',
        '把 φ(x₁)、φ(x₂) 写成三项 (1, x, x²)；与 Σ_p 的对角元逐项相乘，再做点积。'
      ),
      explanation: t(
        `φ(x₁) = (1, ${num(p2.x1)}, ${num(p2.x1 * p2.x1)}) and φ(x₂) = (1, ${num(p2.x2)}, ${num(p2.x2 * p2.x2)}). Σ_pφ(x₂) = (${num(p2.a)}, ${num(p2.b * p2.x2)}, ${num(p2.c * p2.x2 * p2.x2)}). So k(x₁, x₂) = ${num(p2.a)}·1 + ${par(p2.b)}·${par(p2.x1)}·${par(p2.x2)} + ${par(p2.c)}·${par(p2.x1 * p2.x1)}·${par(p2.x2 * p2.x2)} = ${num(p2.a)} + ${par(p2.b * p2.x1 * p2.x2)} + ${par(p2.c * p2.x1 * p2.x1 * p2.x2 * p2.x2)} = ${exact(ans2)}. The polynomial feature map φ(x) = (1, x, x², …)ᵀ is the example in GPML pdf p. 30.`,
        `φ(x₁) = (1, ${num(p2.x1)}, ${num(p2.x1 * p2.x1)})，φ(x₂) = (1, ${num(p2.x2)}, ${num(p2.x2 * p2.x2)})。Σ_pφ(x₂) = (${num(p2.a)}, ${num(p2.b * p2.x2)}, ${num(p2.c * p2.x2 * p2.x2)})。所以 k(x₁, x₂) = ${num(p2.a)}·1 + ${par(p2.b)}·${par(p2.x1)}·${par(p2.x2)} + ${par(p2.c)}·${par(p2.x1 * p2.x1)}·${par(p2.x2 * p2.x2)} = ${num(p2.a)} + ${par(p2.b * p2.x1 * p2.x2)} + ${par(p2.c * p2.x1 * p2.x1 * p2.x2 * p2.x2)} = ${exact(ans2)}。多项式特征映射 φ(x) = (1, x, x², …)ᵀ 见 GPML 第 30 页。`
      ),
      audit: { kind: 'GP-05:poly-feature', params: { a: p2.a, b: p2.b, c: p2.c, x1: p2.x1, x2: p2.x2 } },
    }),

    g.number({
      id: 'gram-det',
      title: t('The Gram matrix of two inputs', '两个输入的格拉姆矩阵'),
      prompt: t(
        `The same model has φ(x) = (1, x)ᵀ and Σ_p = ${matFmt([[p3.a, 0], [0, p3.b]])}. For the inputs x₁ = ${num(p3.x1)} and x₂ = ${num(p3.x2)} the covariance matrix of (f(x₁), f(x₂)) is the Gram matrix K = ΦΣ_pΦᵀ, where Φ has rows φ(x₁)ᵀ and φ(x₂)ᵀ. What is det K? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `同一个模型的特征映射 φ(x) = (1, x)ᵀ，Σ_p = ${matFmt([[p3.a, 0], [0, p3.b]])}。对输入 x₁ = ${num(p3.x1)}、x₂ = ${num(p3.x2)}，(f(x₁), f(x₂)) 的协方差矩阵是格拉姆矩阵 K = ΦΣ_pΦᵀ，其中 Φ 的两行分别是 φ(x₁)ᵀ 和 φ(x₂)ᵀ。det K 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('det K', 'det K'), answer: ans3, tolerance: 0.006 }],
      hint: t(
        `Write K = ${matFmt([[K11_3, K12_3], [K12_3, K22_3]])}, then use det = K₁₁K₂₂ − K₁₂².`,
        `写出 K = ${matFmt([[K11_3, K12_3], [K12_3, K22_3]])}，再用 det = K₁₁K₂₂ − K₁₂²。`
      ),
      explanation: t(
        `K₁₁ = ${num(p3.a)} + ${par(p3.b)}·${par(p3.x1)}² = ${num(K11_3)}, K₂₂ = ${num(p3.a)} + ${par(p3.b)}·${par(p3.x2)}² = ${num(K22_3)}, K₁₂ = ${num(p3.a)} + ${par(p3.b)}·${par(p3.x1)}·${par(p3.x2)} = ${num(K12_3)}. So det K = ${num(K11_3)}·${par(K22_3)} − (${num(K12_3)})² = ${exact(ans3)}. With Σ_p = diag(a, b) it simplifies to a·b·(x₁ − x₂)² = ${num(p3.a)}·${par(p3.b)}·(${num(p3.x1 - p3.x2)})², which is positive because a, b > 0 and x₁ ≠ x₂ — with two inputs and two features the Gram matrix has rank 2 (GPML pdf p. 32).`,
        `K₁₁ = ${num(p3.a)} + ${par(p3.b)}·${par(p3.x1)}² = ${num(K11_3)}，K₂₂ = ${num(p3.a)} + ${par(p3.b)}·${par(p3.x2)}² = ${num(K22_3)}，K₁₂ = ${num(p3.a)} + ${par(p3.b)}·${par(p3.x1)}·${par(p3.x2)} = ${num(K12_3)}。所以 det K = ${num(K11_3)}·${par(K22_3)} − (${num(K12_3)})² = ${exact(ans3)}。记 Σ_p = diag(a, b)，它化简为 a·b·(x₁ − x₂)² = ${num(p3.a)}·${par(p3.b)}·(${num(p3.x1 - p3.x2)})²；因为 a, b > 0 且 x₁ ≠ x₂，它是正的——两个输入、两个特征时格拉姆矩阵的秩为 2（GPML 第 32 页）。`
      ),
      audit: { kind: 'GP-05:gram-det', params: { a: p3.a, b: p3.b, x1: p3.x1, x2: p3.x2 } },
    }),

    g.choice({
      id: 'gram-rank',
      title: t('A singular covariance matrix', '一个奇异的协方差矩阵'),
      prompt: t(
        `The feature map is φ(x) = (1, x)ᵀ with prior covariance Σ_p = ${matFmt([[p4.a, 0], [0, p4.b]])}, and three distinct inputs x₁ = ${num(p4.x1)}, x₂ = ${num(p4.x2)}, x₃ = ${num(p4.x3)} give the covariance matrix K of (f(x₁), f(x₂), f(x₃)) = ${matFmt(K4)}. Its determinant is 0. Which statement is correct?`,
        `特征映射 φ(x) = (1, x)ᵀ，先验协方差 Σ_p = ${matFmt([[p4.a, 0], [0, p4.b]])}，三个互不相同的输入 x₁ = ${num(p4.x1)}、x₂ = ${num(p4.x2)}、x₃ = ${num(p4.x3)} 给出 (f(x₁), f(x₂), f(x₃)) 的协方差矩阵 K = ${matFmt(K4)}。它的行列式为 0。下列哪条说法正确？`
      ),
      options: [
        t('K is a valid covariance matrix and is singular: with only two features and three inputs its rank is at most 2.', 'K 是合法的协方差矩阵且奇异：只有两个特征、三个输入时它的秩至多为 2。'),
        t('K cannot be a covariance matrix, because a covariance matrix must be invertible and K is not.', 'K 不可能是协方差矩阵，因为协方差矩阵必须可逆，而 K 不可逆。'),
        t('K is singular only because two of the three inputs are equal.', 'K 奇异只是因为三个输入中有两个相等。'),
        t('A GP with this kernel can only be defined on at most two inputs, because there are only two features, so the third input is not allowed.', '使用该核的 GP 最多只能在两个输入上定义，因为只有两个特征，所以第三个输入是不允许的。'),
      ],
      correct: 0,
      hint: t(
        'The feature map φ(x) = (1, x)ᵀ has only two entries, so the three values f(x₁), f(x₂), f(x₃) all lie in a two-dimensional space. What does that say about the rank of K, and does a singular covariance matrix contradict the definition of the kernel?',
        '特征映射 φ(x) = (1, x)ᵀ 只有两项，所以 f(x₁), f(x₂), f(x₃) 这三个值都落在一个二维空间里。这对 K 的秩意味着什么？奇异的协方差矩阵与核的定义矛盾吗？'
      ),
      explanation: t(
        `Here Σ_p = diag(${num(p4.a)}, ${num(p4.b)}), so K = ΦΣ_pΦᵀ = ${num(p4.a)}·J + ${par(p4.b)}·x·xᵀ with J the all-ones matrix and x = (${num(p4.x1)}, ${num(p4.x2)}, ${num(p4.x3)})ᵀ. Both terms have rank 1, so rank K ≤ 2 < 3 and K is singular — although every input is distinct. Singularity does not make K invalid: a GP with a finite feature map is allowed to have a singular covariance on more inputs than features (GPML pdf p. 32), exactly as a constant kernel is a valid kernel; and a GP can always be evaluated at any number of inputs.`,
        `这里 Σ_p = diag(${num(p4.a)}, ${num(p4.b)})，所以 K = ΦΣ_pΦᵀ = ${num(p4.a)}·J + ${par(p4.b)}·x·xᵀ，其中 J 是全 1 矩阵、x = (${num(p4.x1)}, ${num(p4.x2)}, ${num(p4.x3)})ᵀ。两项的秩都为 1，因此 K 的秩 ≤ 2 < 3，K 奇异——尽管每个输入互不相同。奇异并不使 K 无效：有限特征映射的 GP 在输入多于特征时协方差矩阵可以是奇异的（GPML 第 32 页），正如常数核也是合法的核；GP 可以在任意多个输入上取值。`
      ),
    }),

    g.choice({
      id: 'gp-def',
      title: t('What is a Gaussian process?', '什么是高斯过程？'),
      prompt: t(
        'The move from weights to functions gives a distribution over functions f(x) = φ(x)ᵀw. Which statement is the definition of a Gaussian process?',
        '从权重到函数的转换给出了函数 f(x) = φ(x)ᵀw 上的分布。下列哪条是高斯过程的定义？'
      ),
      options: [
        t('A collection of random variables indexed over an input space, any finite subset of which has a joint Gaussian distribution.', '一组以输入空间为指标集的随机变量，其中任意有限多个都服从联合高斯分布。'),
        t('An infinite collection of random variables whose entire, uncountably infinite, joint distribution is required to be jointly Gaussian.', '一族无穷多个随机变量，其整个不可数无穷维联合分布都必须是联合高斯的。'),
        t('A distribution over functions whose mean is zero and whose covariance function is the squared exponential.', '一个函数分布，其均值为零、协方差函数为平方指数核。'),
        t('A finite-dimensional Gaussian random vector, with one component for each observed data point.', '一个有限维高斯随机向量，每个已观测的数据点对应一个分量。'),
      ],
      correct: 0,
      hint: t(
        'Read the definition carefully: how many of the random variables have to be jointly Gaussian at once?',
        '仔细读定义：要求同时联合高斯的是其中多少个随机变量？'
      ),
      explanation: t(
        'A Gaussian process is a collection of random variables indexed over an input space such that **any finite** subset has a joint Gaussian distribution (Lecture 2 p. 26; GPML pdf p. 31). It is completely characterised by its mean function m(x) and covariance function k(x, x′). The joint distribution may be uncountable in principle, but the definition only ever constrains finitely many variables at once — that is exactly why we can condition on a finite data set.',
        '高斯过程是一组以输入空间为指标集的随机变量，其中**任意有限**多个都服从联合高斯分布（第 2 讲第 26 页；GPML 第 31 页）。它由均值函数 m(x) 与协方差函数 k(x, x′) 完全确定。原则上变量可以有无穷多个，但定义每次只约束有限多个变量——这正是我们可以对有限数据集做条件化的原因。'
      ),
    }),

    g.choice({
      id: 'consistency',
      title: t('Consistency under marginalisation', '边际化下的一致性'),
      prompt: t(
        'A Gaussian process specifies the joint distribution of (f(x₁), f(x₂), f(x₃)) as a Gaussian. What does the marginalisation (consistency) property say the distribution of the smaller set (f(x₁), f(x₂)) is?',
        '一个高斯过程把 (f(x₁), f(x₂), f(x₃)) 的联合分布指定为高斯分布。边际化（一致性）性质说，较小的集合 (f(x₁), f(x₂)) 的分布是什么？'
      ),
      options: [
        t('It is the marginal of the joint: the first two mean entries and the leading 2 × 2 block of the covariance, unchanged by looking at more variables.', '它是联合分布的边缘分布：前两个均值分量与协方差矩阵左上角的 2 × 2 块，多看变量并不会改变它。'),
        t('It is the conditional distribution given f(x₃), evaluated at the mean of f(x₃), which is the marginal.', '它是给定 f(x₃) 的条件分布，在 f(x₃) 的均值处取值，这就是边缘分布。'),
        t('Its covariance is smaller than the corresponding block of the larger joint, because the third variable adds information.', '它的协方差比大联合分布中对应的块更小，因为第三个变量带来了信息。'),
        t('The GP cannot specify both distributions at once: each finite set of inputs requires its own separate Gaussian distribution, chosen independently of the others.', 'GP 不能同时指定这两个分布：每个有限输入集合都需要各自独立选取一个单独的高斯分布。'),
      ],
      correct: 0,
      hint: t(
        'The consistency property is about the smaller set alone. Does it depend on the third variable at all?',
        '一致性性质只涉及较小的集合。它到底依不依赖第三个变量？'
      ),
      explanation: t(
        'If the GP gives (y₁, y₂, y₃) ~ N(μ, Σ), it must also give (y₁, y₂) ~ N(μ₁₂, Σ₁₁), where Σ₁₁ is the leading 2 × 2 submatrix: "examination of a larger set of variables does not change the distribution of the smaller set" (Lecture 2 p. 28; GPML pdf p. 31). The covariance is read off, not recomputed, and it is a marginal, not a conditional.',
        '若 GP 给出 (y₁, y₂, y₃) ~ N(μ, Σ)，它也必须给出 (y₁, y₂) ~ N(μ₁₂, Σ₁₁)，其中 Σ₁₁ 是左上角的 2 × 2 子块："观察更大的变量集合不会改变较小集合的分布"（第 2 讲第 28 页；GPML 第 31 页）。协方差是直接读出的，不需要重算；它是边缘分布，不是条件分布。'
      ),
    }),

    g.choice({
      id: 'se-vs-features',
      title: t('Finite features and the squared exponential', '有限特征与平方指数核'),
      prompt: t(
        'The linear kernel k(x, x′) = φ(x)ᵀΣ_pφ(x′) comes from a finite feature map; here φ(x) = (1, x)ᵀ. The figure shows three functions drawn from this kernel\'s prior: they are straight lines. The other kernel is the squared exponential k(x, x′) = exp(−‖x − x′‖²/2). Which statement is correct?',
        '线性核 k(x, x′) = φ(x)ᵀΣ_pφ(x′) 来自有限维特征映射；这里 φ(x) = (1, x)ᵀ。图中画出该核先验下的三条函数曲线，它们都是直线。另一个核是平方指数核 k(x, x′) = exp(−‖x − x′‖²/2)。下列哪条说法正确？'
      ),
      figure: g.figure({
        alt: t('Three straight lines with different slopes and intercepts, drawn from the prior of the linear kernel, over x from −1 to 1.', '在 x 从 −1 到 1 的区间上画出线性核先验下的三条直线，斜率与截距各不相同。'),
        view: fitView(shapes7, 0.2),
        shapes: shapes7,
        axes: { xLabel: 'x', yLabel: 'f' },
        aspect: 'free',
      }),
      options: [
        t('The linear kernel has finitely many features, so its Gram matrix on n inputs has rank at most d, the number of features; the squared exponential has infinitely many.', '线性核特征数目有限，因此它在 n 个输入上的格拉姆矩阵的秩至多为特征数 d；平方指数核有无穷多个特征。'),
        t('Both kernels come from a finite feature map, so both Gram matrices are singular as soon as there are more inputs than features, which is always the case for large data sets.', '两个核都来自有限维特征映射，所以只要输入多于特征，两个格拉姆矩阵都是奇异的——大数据集总是如此。'),
        t('The squared exponential is also a finite-feature kernel, because exp(z) can be written as a finite polynomial in z for the inputs used here.', '平方指数核同样是有限特征核，因为对这里用的输入来说 exp(z) 可以写成 z 的有限次多项式。'),
        t('The rank of a Gram matrix depends only on how many inputs there are, and not at all on how many features the kernel has.', '格拉姆矩阵的秩只取决于输入个数，与核的特征数目完全无关。'),
      ],
      correct: 0,
      hint: t(
        'How many basis functions does each kernel need: φ(x) = (1, x)ᵀ has two entries. Can a finite set of basis functions reproduce the squared exponential exactly?',
        '每个核需要多少个基函数：φ(x) = (1, x)ᵀ 只有两项。有限多个基函数能精确表示平方指数核吗？'
      ),
      explanation: t(
        'With φ(x) = (1, x)ᵀ the model is f(x) = w₀ + w₁x, a straight line — that is why the prior samples in the figure are lines. Any finite feature map gives a Gram matrix of rank at most the number of features (GPML pdf p. 32), so with two features and more than two inputs the Gram matrix is singular. The squared exponential corresponds to a Bayesian linear regression model with **infinitely many** basis functions (GPML pdf p. 32), so no finite feature count bounds its Gram rank; its samples are the smooth curves of the usual GP prior.',
        '取 φ(x) = (1, x)ᵀ 时模型是 f(x) = w₀ + w₁x，是一条直线——这就是图中先验样本都是直线的原因。任何有限维特征映射给出的格拉姆矩阵，其秩至多为特征个数（GPML 第 32 页）；因此两个特征、多于两个输入时格拉姆矩阵奇异。平方指数核对应**无穷多个**基函数的贝叶斯线性回归模型（GPML 第 32 页），其格拉姆矩阵的秩不受任何有限特征数限制；它的样本是通常 GP 先验的那些光滑曲线。'
      ),
    }),

    g.number({
      id: 'challenge',
      title: t('Challenge: a full prior covariance', '挑战：完整的先验协方差'),
      prompt: t(
        `A Bayesian linear model has the feature map φ(x) = (1, x)ᵀ and prior w ~ N(0, Σ_p) with the **full** matrix Σ_p = ${matFmt([[p8.a, p8.c], [p8.c, p8.b]])}, so k(x, x′) = φ(x)ᵀΣ_pφ(x′). For x₁ = ${num(p8.x1)} and x₂ = ${num(p8.x2)}, find k(x₁, x₂) and k(x₁, x₁). Give integers, fractions or decimals rounded to 2 places.`,
        `一个贝叶斯线性模型的特征映射 φ(x) = (1, x)ᵀ，先验 w ~ N(0, Σ_p)，其中 Σ_p 是**完整**矩阵 ${matFmt([[p8.a, p8.c], [p8.c, p8.b]])}，因此 k(x, x′) = φ(x)ᵀΣ_pφ(x′)。当 x₁ = ${num(p8.x1)}、x₂ = ${num(p8.x2)} 时，求 k(x₁, x₂) 与 k(x₁, x₁)。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('k(x₁, x₂)', 'k(x₁, x₂)'), answer: ans8_1, tolerance: 0.006 },
        { label: t('k(x₁, x₁)', 'k(x₁, x₁)'), answer: ans8_2, tolerance: 0.006 },
      ],
      hint: t(
        `Multiply Σ_p = ${matFmt([[p8.a, p8.c], [p8.c, p8.b]])} into φ(x₂) = (1, ${num(p8.x2)}) first, then dot with φ(x₁) = (1, ${num(p8.x1)}); repeat with x₁ in both places for the variance.`,
        `先用 Σ_p = ${matFmt([[p8.a, p8.c], [p8.c, p8.b]])} 乘 φ(x₂) = (1, ${num(p8.x2)})，再与 φ(x₁) = (1, ${num(p8.x1)}) 做点积；把两处都取 x₁ 即得方差。`
      ),
      explanation: t(
        `Σ_pφ(x₂) = (${num(p8.a + p8.c * p8.x2)}, ${num(p8.c + p8.b * p8.x2)}), so k(x₁, x₂) = 1·(${num(p8.a + p8.c * p8.x2)}) + ${par(p8.x1)}·(${num(p8.c + p8.b * p8.x2)}) = ${num(p8.a)} + ${par(p8.c)}·(${num(p8.x1)} + ${par(p8.x2)}) + ${par(p8.b)}·${par(p8.x1)}·${par(p8.x2)} = ${exact(ans8_1)}. Σ_pφ(x₁) = (${num(p8.a + p8.c * p8.x1)}, ${num(p8.c + p8.b * p8.x1)}), so k(x₁, x₁) = ${num(p8.a)} + 2·${par(p8.c)}·${par(p8.x1)} + ${par(p8.b)}·${par(p8.x1)}² = ${exact(ans8_2)}. Because Σ_p is positive definite (a > 0 and a·b − c² > 0 here), k(x₁, x₁) is a variance and is positive. This game does not assess the posterior over weights or GP regression.`,
        `Σ_pφ(x₂) = (${num(p8.a + p8.c * p8.x2)}, ${num(p8.c + p8.b * p8.x2)})，所以 k(x₁, x₂) = 1·(${num(p8.a + p8.c * p8.x2)}) + ${par(p8.x1)}·(${num(p8.c + p8.b * p8.x2)}) = ${num(p8.a)} + ${par(p8.c)}·(${num(p8.x1)} + ${par(p8.x2)}) + ${par(p8.b)}·${par(p8.x1)}·${par(p8.x2)} = ${exact(ans8_1)}。Σ_pφ(x₁) = (${num(p8.a + p8.c * p8.x1)}, ${num(p8.c + p8.b * p8.x1)})，所以 k(x₁, x₁) = ${num(p8.a)} + 2·${par(p8.c)}·${par(p8.x1)} + ${par(p8.b)}·${par(p8.x1)}² = ${exact(ans8_2)}。由于 Σ_p 正定（这里 a > 0 且 a·b − c² > 0），k(x₁, x₁) 是一个方差，取正值。本游戏不考查权重的后验或 GP 回归。`
      ),
      audit: { kind: 'GP-05:challenge', params: { a: p8.a, c: p8.c, b: p8.b, x1: p8.x1, x2: p8.x2 } },
    }),
  ];
};
