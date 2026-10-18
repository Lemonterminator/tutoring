import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, num, par, type Text } from '../support';

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

export const gp11: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-11');
  warm(g);

  // Card 1: chol-count
  const n1 = g.pick([12, 18, 24, 30, 36, 48, 60]);
  const n1_3 = n1 * n1 * n1;
  const ops1 = n1_3 / 6;

  // Card 2: solve-count
  const n2 = g.pick([10, 12, 14, 16, 20, 30, 40, 50]);
  const half2 = n2 * n2 / 2;
  const ops2 = n2 * n2;

  // Card 3: memory-size
  const n3 = g.pick([500, 1000, 2000, 2500, 5000, 10000, 20000]);
  const n3_sq = n3 * n3;
  const bytes3 = 8 * n3_sq;
  const MB3 = bytes3 / 1e6;
  const lin3 = 8 * n3 / 1e6;

  // Card 4: extrapolate
  const c4 = g.pick([2, 3, 4, 5]);
  const n1_4 = g.pick([100, 200, 500, 1000]);
  const n2_4 = c4 * n1_4;
  const t1_4 = g.pick([0.5, 1, 2, 3]);
  const c4_3 = c4 * c4 * c4;
  const c4_2 = c4 * c4;
  const t2_4 = t1_4 * c4_3;

  // Card 5: break-even
  const n5 = g.pick([12, 18, 24, 30, 36, 48, 60]);
  const n5_3 = n5 * n5 * n5;
  const chol5 = n5_3 / 6;
  const half5 = n5 * n5 / 2;
  const m5 = n5 / 3;
  const n5_6 = n5 / 6;

  // Card 6: profile-check
  const profileSets = [
    { a: 50, b: 30 }, { a: 50, b: 35 }, { a: 55, b: 25 }, { a: 55, b: 30 },
    { a: 55, b: 35 }, { a: 60, b: 25 }, { a: 60, b: 30 }, { a: 60, b: 35 },
    { a: 65, b: 25 }, { a: 65, b: 30 }, { a: 70, b: 25 }
  ];
  const p6 = g.pick(profileSets);
  const a6 = p6.a;
  const b6 = p6.b;
  const r6 = 100 - a6 - b6;
  const ab6 = a6 + b6;

  // Card 7: mean-only
  const n7 = g.pick([12, 18, 24, 30, 36]);
  const m7 = g.pick([2, 3, 4, 5, 10]);
  const P7 = m7 * n7;
  const Q7 = m7 * n7 * n7 / 2;
  const R7 = m7 * n7 * n7 * n7 / 6;
  const S7 = n7 * n7 * n7 / 6 + m7 * n7;
  const half7 = n7 * n7 / 2;
  const chol7 = n7 * n7 * n7 / 6;

  // Card 8: challenge
  const n8 = g.pick([6, 12, 18, 24, 30]);
  const m8 = g.pick([2, 3, 4, 5, 10]);
  const n8_3 = n8 * n8 * n8;
  const chol8 = n8_3 / 6;
  const n8_2 = n8 * n8;
  const half8 = n8_2 / 2;
  const mh8 = m8 * half8;
  const total8 = chol8 + n8_2 + mh8;

  return [
    g.number({
      id: 'chol-count',
      title: t('Cost of the Cholesky factor', 'Cholesky 因子的运算量'),
      prompt: t(
        `Algorithm 2.1 of GPML computes the Cholesky factor L of the ${n1} × ${n1} matrix K + σ²I. How many operations does GPML count for this step? Give an integer.`,
        `GPML 的算法 2.1 要对 ${n1} × ${n1} 的矩阵 K + σ²I 做 Cholesky 分解，得到因子 L。GPML 对这一步给出的运算次数是多少？请填整数。`
      ),
      fields: [{ label: t('operations', '运算次数'), answer: ops1, tolerance: 0.006 }],
      hint: t(
        'The count is cubic in n, but with a constant factor well below 1, because C is symmetric and L is triangular. Memory (n × n entries) is a different question.',
        '运算次数与 n 的三次方成正比，但常数因子远小于 1，因为 C 是对称的、L 是三角矩阵。存储（n × n 个元素）是另一个问题。'
      ),
      explanation: t(
        `GPML counts n³/6 operations for the Cholesky factor of an n × n matrix (Algorithm 2.1 line 2, pdf p. 37; §A.4, pdf p. 220). For n = ${n1}: ${n1}³/6 = ${n1_3}/6 = ${ops1}. Counting n³ would ignore that the matrix is symmetric and the factor triangular; n² is the number of entries of C (memory), not the time.`,
        `GPML 指出 n × n 矩阵的 Cholesky 分解需要 n³/6 次运算（算法 2.1 第 2 行，pdf 第 37 页；§A.4，pdf 第 220 页）。n = ${n1} 时：${n1}³/6 = ${n1_3}/6 = ${ops1}。数 n³ 忽略了矩阵对称、因子是三角矩阵；n² 是 C 的元素个数（存储），不是时间。`
      ),
      audit: { kind: 'GP-11:chol-count', params: { n: n1 } }
    }),

    g.number({
      id: 'solve-count',
      title: t('Two triangular solves', '两次三角求解'),
      prompt: t(
        `The Cholesky factor L of the ${n2} × ${n2} matrix C is known. The system C x = b is solved in two steps: forward substitution for L z = b, then back substitution for Lᵀ x = z. How many operations does GPML count for these two steps together? Give an integer.`,
        `已知 ${n2} × ${n2} 矩阵 C 的 Cholesky 因子 L。方程组 C x = b 分两步求解：先对 L z = b 做前代，再对 Lᵀ x = z 做回代。GPML 对这两步合计给出的运算次数是多少？请填整数。`
      ),
      fields: [{ label: t('operations', '运算次数'), answer: ops2, tolerance: 0.006 }],
      hint: t(
        'There are two separate triangular systems, one forward and one backward. Each is quadratic in n; add the two.',
        '这里有两个独立的三角方程组，一个前代、一个回代。每个的运算次数都与 n 的平方有关，把两者相加。'
      ),
      explanation: t(
        `GPML §A.4 (pdf p. 220): both the forward and the backward substitution require n²/2 operations. For n = ${n2} each step costs ${n2}²/2 = ${half2} and the two together ${half2} + ${half2} = ${ops2}. Counting only one step gives ${half2}; the cubic term ${n2}³/6 belongs to the factorisation, which is already done.`,
        `GPML §A.4（pdf 第 220 页）：前代和回代各需要 n²/2 次运算。n = ${n2} 时每一步为 ${n2}²/2 = ${half2}，两步合计 ${half2} + ${half2} = ${ops2}。只数一步会得到 ${half2}；三次项 ${n2}³/6 属于分解本身，而分解已经完成。`
      ),
      audit: { kind: 'GP-11:solve-count', params: { n: n2 } }
    }),

    g.number({
      id: 'memory-size',
      title: t('Memory for K', 'K 的内存'),
      prompt: t(
        `A GP is fitted to n = ${n3} training points. The full covariance matrix K (n × n) is stored with every entry as an 8-byte number. How many megabytes does K occupy? (1 MB = 10⁶ bytes.) Give an integer, a fraction or a decimal rounded to 2 places.`,
        `对 n = ${n3} 个训练点拟合一个 GP。完整的协方差矩阵 K（n × n）的每个元素用一个 8 字节的数存储。K 占多少 MB？（1 MB = 10⁶ 字节。）请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('MB', 'MB'), answer: MB3, tolerance: 0.006 }],
      hint: t(
        'Count how many numbers K contains, multiply by the bytes per number, then convert bytes to megabytes.',
        '先数出 K 里有多少个数，乘以每个数的字节数，再把字节换算成 MB。'
      ),
      explanation: t(
        `K has n × n = ${n3}² = ${n3_sq} entries. At 8 bytes each: ${n3_sq} · 8 = ${bytes3} bytes = ${MB3} MB. Memory grows as O(n²) (Lecture 3 p. 47: time O(n³), memory O(n²)), so doubling n quadruples it. Storing only n numbers would give ${exact(lin3)} MB, which is the size of a vector, not of K.`,
        `K 有 n × n = ${n3}² = ${n3_sq} 个元素。每个 8 字节：${n3_sq} · 8 = ${bytes3} 字节 = ${MB3} MB。内存按 O(n²) 增长（第 3 讲第 47 页：时间 O(n³)，内存 O(n²)），所以 n 翻倍时内存变为 4 倍。只存 n 个数只有 ${exact(lin3)} MB，那是一个向量的大小，不是 K 的。`
      ),
      audit: { kind: 'GP-11:memory-size', params: { n: n3 } }
    }),

    g.number({
      id: 'extrapolate',
      title: t('Scaling the running time', '按比例推算运行时间'),
      prompt: t(
        `Exact GP regression on n₁ = ${n1_4} points takes t₁ = ${t1_4} s. Assume the running time is proportional to n³ (the Cholesky factorisation dominates). How many seconds does it take on n₂ = ${n2_4} points? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `对 n₁ = ${n1_4} 个点做精确 GP 回归需要 t₁ = ${t1_4} 秒。假设运行时间与 n³ 成正比（Cholesky 分解占主导）。对 n₂ = ${n2_4} 个点需要多少秒？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('t₂', 't₂'), answer: t2_4, tolerance: 0.006 }],
      hint: t(
        'Find how many times larger n₂ is than n₁ first. The time is multiplied by that factor raised to the power in the question.',
        '先求出 n₂ 是 n₁ 的多少倍，再把时间乘以这个倍数的相应次方（次数见题目）。'
      ),
      explanation: t(
        `n₂/n₁ = ${n2_4}/${n1_4} = ${c4}, so the time grows by ${c4}³ = ${c4_3}: t₂ = ${t1_4} · ${c4_3} = ${t2_4} s. Using the factor ${c4} or ${c4}² = ${c4_2} would model a linear or a matrix-vector cost, not the factorisation. Lecture 7 p. 8 extrapolates the same way to 10⁶ points (9.4 × 10⁷ s, about 2.98 years). Measured times are not exactly cubic at small n: Lecture 7 p. 7 gives 0.12 s at n = 1000 and 0.76 s at n = 2000, a factor 6.3 rather than 8.`,
        `n₂/n₁ = ${n2_4}/${n1_4} = ${c4}，所以时间增长 ${c4}³ = ${c4_3} 倍：t₂ = ${t1_4} · ${c4_3} = ${t2_4} 秒。用倍数 ${c4} 或 ${c4}² = ${c4_2} 对应的是线性或矩阵向量乘的代价，不是分解的代价。第 7 讲第 8 页用同样的方法外推到 10⁶ 个点（9.4 × 10⁷ 秒，约 2.98 年）。实测时间在 n 较小时并不严格是三次方：第 7 讲第 7 页给出 n = 1000 时 0.12 秒、n = 2000 时 0.76 秒，倍数是 6.3 而不是 8。`
      ),
      audit: { kind: 'GP-11:extrapolate', params: { n1: n1_4, n2: n2_4, t1: t1_4 } }
    }),

    g.number({
      id: 'break-even',
      title: t('When do the solves cost more than the factorisation?', '什么时候求解比分解更贵？'),
      prompt: t(
        `GPML's Algorithm 2.1 factorises the n × n matrix C = K + σ²I once and then needs one triangular solve for the variance at each test input. With n = ${n5} training points, for how many test inputs m do the m triangular solves together cost exactly as many operations as the one factorisation? Use GPML's operation counts. Give an integer.`,
        `GPML 的算法 2.1 对 n × n 矩阵 C = K + σ²I 只分解一次，之后每个测试输入的方差各需要一次三角求解。训练点数 n = ${n5}。测试输入数 m 为多少时，m 次三角求解合计的运算次数恰好等于那一次分解？请按 GPML 的运算次数计算。请填整数。`
      ),
      fields: [{ label: t('m', 'm'), answer: m5, tolerance: 0.006 }],
      hint: t(
        'Write the cost of m solves as m times the cost of one solve, and set it equal to the cost of the factorisation. Then solve for m.',
        '把 m 次求解的代价写成 m 乘以一次求解的代价，令其等于分解的代价，再解出 m。'
      ),
      explanation: t(
        `One factorisation costs n³/6 = ${n5_3}/6 = ${chol5}; one triangular solve costs n²/2 = ${half5}. Setting m · ${half5} = ${chol5} gives m = ${m5}. So O(n³) beating O(n²) is a statement about large n only: with more than ${m5} test inputs the solves cost more than the factorisation. Counting both substitutions per test input (n²) would give ${n5_6}, which is not what Algorithm 2.1 line 5 does (a single solve v = L \\ k*).`,
        `一次分解的代价为 n³/6 = ${n5_3}/6 = ${chol5}；一次三角求解的代价为 n²/2 = ${half5}。令 m · ${half5} = ${chol5}，得 m = ${m5}。所以 O(n³) 比 O(n²) 大只是关于大 n 的说法：测试输入超过 ${m5} 个时，求解的总代价就超过分解。若每个测试输入数两次代换（n²），会得到 ${n5_6}，但算法 2.1 第 5 行只做一次求解 v = L \\ k*。`
      ),
      audit: { kind: 'GP-11:break-even', params: { n: n5 } }
    }),

    g.choice({
      id: 'profile-check',
      title: t('Is Cholesky always the biggest cost?', 'Cholesky 总是最大的开销吗？'),
      prompt: t(
        `A profile of one log marginal likelihood evaluation reports these shares of the running time: building K ${a6} %, the Cholesky factorisation of K + σ²I ${b6} %, all other lines together ${r6} %. A student says: 'The factorisation is O(n³), so it must always take the largest share.' What does this profile show?`,
        `对一次对数边际似然计算做性能分析，各部分占运行时间的比例为：构造 K 占 ${a6} %，对 K + σ²I 做 Cholesky 分解占 ${b6} %，其余所有行合计占 ${r6} %。一位同学说：“分解是 O(n³)，所以它占的比例一定总是最大。”这个分析结果说明了什么？`
      ),
      options: [
        t('False here: building K takes more time than the Cholesky step, because O(n³) ignores constant factors and only wins for large n.',
          '在这里不成立：构造 K 比 Cholesky 步骤更耗时，因为 O(n³) 忽略了常数因子，只有 n 足够大时才占优。'),
        t('True: Cholesky is the only O(n³) step, so the profile must be wrong.',
          '成立：Cholesky 是唯一的 O(n³) 步骤，所以这个分析结果一定有误。'),
        t('False: the Cholesky factorisation is only O(n²), so building K naturally takes longer.',
          '不成立：Cholesky 分解只是 O(n²)，所以构造 K 自然更耗时。'),
        t(`False: building K takes more time, so the Cholesky step, with its ${b6} % share, is not a bottleneck at all and can be ignored in practice.`,
          `不成立：构造 K 更耗时，所以占 ${b6} % 的 Cholesky 步骤根本不是瓶颈，实际中可以忽略。`)
      ],
      correct: 0,
      hint: t(
        'Big-O describes how the cost grows with n. It does not tell you the size of the constant in front, nor how long the other steps take.',
        '大 O 描述的是代价随 n 如何增长，并没有说明前面常数的大小，也没有说明其他步骤要花多长时间。'
      ),
      explanation: t(
        `In this profile building K takes ${a6} % and the factorisation ${b6} %, so K is the larger share even though the factorisation is O(n³). Big-O hides constant factors; the cubic term only dominates for large enough n (this follows from the definition of O). Both are still the two big costs: together ${ab6} % of the time, against ${r6} % for everything else. Lecture 7 p. 9 shows exactly this pattern: 58.7 % for building K, 31.7 % for the Cholesky factorisation. This game does not assess approximate GP methods.`,
        `在这个分析中构造 K 占 ${a6} %，分解占 ${b6} %，所以尽管分解是 O(n³)，K 的构造占的比例更大。大 O 隐藏了常数因子；只有 n 足够大时三次项才占优（由 O 的定义推出）。两者仍是最大的两项开销：合计 ${ab6} %，其余全部只占 ${r6} %。第 7 讲第 9 页正是这种情形：构造 K 占 58.7 %，Cholesky 分解占 31.7 %。本游戏不考查近似 GP 方法。`
      )
    }),

    g.choice({
      id: 'mean-only',
      title: t('New test inputs, mean only', '新的测试输入，只要均值'),
      prompt: t(
        `A GP is fitted to n = ${n7} training points; the Cholesky factor L of C = K + σ²I and the vector α = C⁻¹y are already stored. Now only the predictive means μ* = k*ᵀα are needed at m = ${m7} new test inputs (no variances). Count a dot product of length n as n operations. Which total is correct, with the right reason?`,
        `对 n = ${n7} 个训练点拟合了一个 GP；C = K + σ²I 的 Cholesky 因子 L 和向量 α = C⁻¹y 已经存好。现在只需要 m = ${m7} 个新测试输入处的预测均值 μ* = k*ᵀα（不要方差）。长度为 n 的点积按 n 次运算计。下列哪个总数及理由是正确的？`
      ),
      options: [
        t(`${P7} operations: one dot product k*ᵀα of length n per test input.`,
          `${P7} 次运算：每个测试输入做一次长度为 n 的点积 k*ᵀα。`),
        t(`${Q7} operations: one triangular solve per test input, as for the variance.`,
          `${Q7} 次运算：每个测试输入做一次三角求解，和求方差时一样。`),
        t(`${R7} operations: the factorisation of C is repeated for every test input.`,
          `${R7} 次运算：每个测试输入都要重新做一次 C 的分解。`),
        t(`${S7} operations: the factorisation of C is repeated once, then one dot product per test input.`,
          `${S7} 次运算：把 C 的分解重做一次，然后每个测试输入做一次点积。`)
      ],
      correct: 0,
      hint: t(
        'Which of the stored objects change when a new test input arrives, and which new object depends on that input?',
        '新测试输入到来时，已存的对象哪些会改变？哪个新对象依赖于这个输入？'
      ),
      explanation: t(
        `L and α = C⁻¹y depend only on the training data, so they are reused. Only the vector k* changes with the test input, and the mean μ* = k*ᵀα is a dot product of length n: ${n7} operations per input, ${m7} · ${n7} = ${P7} in total (Lecture 7 p. 5: μ* scales as O(n) once α is known). A triangular solve (${n7}²/2 = ${half7} per input, ${Q7} in total) is needed for the variance, not the mean (GPML Algorithm 2.1 line 5). Refactorising would cost ${n7}³/6 = ${chol7} each time, which ${m7} inputs make ${R7}.`,
        `L 和 α = C⁻¹y 只依赖训练数据，所以可以重复使用。随测试输入变化的只有向量 k*，而均值 μ* = k*ᵀα 是长度为 n 的点积：每个输入 ${n7} 次运算，合计 ${m7} · ${n7} = ${P7}（第 7 讲第 5 页：α 已知后 μ* 为 O(n)）。三角求解（每个输入 ${n7}²/2 = ${half7}，合计 ${Q7}）是求方差时才需要的，求均值不需要（GPML 算法 2.1 第 5 行）。重新分解每次要 ${n7}³/6 = ${chol7}，${m7} 个输入就是 ${R7}。`
      )
    }),

    g.number({
      id: 'challenge',
      title: t('Challenge: the whole pipeline', '挑战：整条流水线'),
      prompt: t(
        `A GP is fitted to n = ${n8} training points and then used at m = ${m8} test inputs. Count operations as GPML's Algorithm 2.1 does: the Cholesky factorisation of K + σ²I once; the solves for α = (K + σ²I)⁻¹y with a forward and a back substitution, once; and one triangular solve v = L \\ k* for each test input (for its variance). Ignore building K and all dot products. How many operations in total? Give an integer.`,
        `对 n = ${n8} 个训练点拟合一个 GP，再用于 m = ${m8} 个测试输入。按 GPML 算法 2.1 的方式计数：对 K + σ²I 做一次 Cholesky 分解；用一次前代和一次回代求 α = (K + σ²I)⁻¹y，共一次；每个测试输入（为求其方差）做一次三角求解 v = L \\ k*。忽略构造 K 和所有点积。总共需要多少次运算？请填整数。`
      ),
      fields: [{ label: t('total operations', '总运算次数'), answer: total8, tolerance: 0.006 }],
      hint: t(
        'Make a list of the steps: one factorisation, the solves for α, and the solves for the test inputs. Cost each step with GPML’s counts, then add.',
        '列出各个步骤：一次分解、求 α 的求解、各测试输入的求解。用 GPML 的运算次数分别计算，再相加。'
      ),
      explanation: t(
        `Factorisation: n³/6 = ${n8_3}/6 = ${chol8}. The solves for α: forward plus back substitution, 2 · n²/2 = ${n8_2}. Variances: ${m8} solves of n²/2 = ${half8} each, ${mh8} in total. Sum: ${chol8} + ${n8_2} + ${mh8} = ${total8} (GPML Algorithm 2.1 and §A.4, pdf pp. 37 and 220). The factorisation is done once, not per test input; the solves for α are done once with two substitutions. This game does not assess approximate GP methods or hyperparameter fitting.`,
        `分解：n³/6 = ${n8_3}/6 = ${chol8}。求 α 的求解：前代加回代，2 · n²/2 = ${n8_2}。方差：${m8} 次求解，每次 n²/2 = ${half8}，合计 ${mh8}。总和：${chol8} + ${n8_2} + ${mh8} = ${total8}（GPML 算法 2.1 与 §A.4，pdf 第 37、220 页）。分解只做一次，不是每个测试输入都做；求 α 只做一次，包含两次代换。本游戏不考查近似 GP 方法，也不考查超参数拟合。`
      ),
      audit: { kind: 'GP-11:challenge', params: { n: n8, m: m8 } }
    })
  ];
};
