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

const FAMILY: [number, number, number][] = [
  [2, 1, 2], [2, -1, 3], [3, 1, 2], [3, -2, 2], [2, 2, 1],
  [3, 2, 1], [2, 1, 1], [3, -1, 3], [4, 2, 1], [2, -2, 3],
];
const CHALLENGE_ROWS: [number, number, number][] = [
  [3, 3, 1], [4, 1, 3], [2, 3, 2],
];
const MEANS: [number, number][] = [[0, 0], [1, -1], [-2, 3], [2, 2], [-1, -2], [3, -1]];
const Z2: [number, number][] = [[2, -1], [1, 2], [-1, 3], [3, 2], [-2, -1], [2, 1]];
const Z3: [number, number, number][] = [[1, -1, 2], [-1, 1, 2], [2, 0, -1], [-1, -2, 1], [3, 1, -1], [0, 2, 1]];
const CH_Z: [number, number][] = [[1, 2], [-1, 2], [2, -1]];
const NO_FACTOR: [number, number][] = [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];
const EPS = [0.000001, 0.00000001];

// NOTE: mat() does not format entries, so negative entries must be passed through num() to print "−" instead of "-".
const fmt = (x: number): string => num(x);

export const gp03: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-03');
  warm(g);

  // Card 1: sample-value
  const sv = retry(() => {
    const row = g.pick(FAMILY);
    const m = g.pick(MEANS);
    const z = g.pick(Z2);
    return { row, m, z };
  }, v => v.z[0] !== v.z[1]);
  const [l11, l21, l22] = sv.row;
  const [m1, m2] = sv.m;
  const [z1, z2] = sv.z;
  const f1 = m1 + l11 * z1;
  const f2 = m2 + l21 * z1 + l22 * z2;
  const Lmat = mat([[fmt(l11), '0'], [fmt(l21), fmt(l22)]]);

  // Card 2: chol-factor
  const cf = retry(() => g.pick(FAMILY), v => true);
  const [cl11, cl21, cl22] = cf;
  const cs11 = cl11 * cl11;
  const cs12 = cl11 * cl21;
  const cs22 = cl21 * cl21 + cl22 * cl22;
  const Cmat = mat([[fmt(cs11), fmt(cs12)], [fmt(cs12), fmt(cs22)]]);

  // Card 3: llt-entries
  const le = retry(() => g.pick(FAMILY), v => true);
  const [ll11, ll21, ll22] = le;
  const lLmat = mat([[fmt(ll11), '0'], [fmt(ll21), fmt(ll22)]]);
  const ls12 = ll11 * ll21;
  const ls22 = ll21 * ll21 + ll22 * ll22;
  const lSigma = mat([[fmt(ll11 * ll11), fmt(ls12)], [fmt(ls12), fmt(ls22)]]);

  // Card 4: sample-cov
  const sc = retry(() => g.pick(FAMILY), v => true);
  const [sl11, sl21, sl22] = sc;
  const SLmat = mat([[fmt(sl11), '0'], [fmt(sl21), fmt(sl22)]]);
  const sSigma = mat([[fmt(sl11 * sl11), fmt(sl11 * sl21)], [fmt(sl11 * sl21), fmt(sl21 * sl21 + sl22 * sl22)]]);

  // Card 5: jitter
  const jt = retry(() => {
    const row = g.pick(FAMILY);
    const eps = g.pick(EPS);
    return { row, eps };
  }, v => true);
  const [jl11, jl21, jl22] = jt.row;
  const jKmat = mat([[fmt(jl11 * jl11), fmt(jl11 * jl21)], [fmt(jl11 * jl21), fmt(jl21 * jl21 + jl22 * jl22)]]);
  // NOTE: print ε as a scientific-notation string to avoid a "raw floating-point number" lint.
  const jEpsStr = jt.eps === 0.000001 ? '10⁻⁶' : '10⁻⁸';

  // Card 6: no-factor
  const nf = retry(() => g.pick(NO_FACTOR), v => true);
  const [na, nb] = nf;
  const nDet = na * na - nb * nb;
  const nL22sq = na - (nb * nb) / na;
  const nSigma = mat([[fmt(na), fmt(nb)], [fmt(nb), fmt(na)]]);

  // Card 7: gp-grid
  const gg = retry(() => g.pick(Z3), v => {
    const f2 = v[0] + 2 * v[1];
    const f3 = v[0] + v[1] + v[2];
    return f2 !== 0 && f3 !== 0;
  });
  const [gz1, gz2, gz3] = gg;
  const gF2 = gz1 + 2 * gz2;
  const gF3 = gz1 + gz2 + gz3;
  const gKmat = mat([['4', '2', '2'], ['2', '5', '3'], ['2', '3', '3']]);
  const gLmat = mat([['2', '0', '0'], ['1', '2', '0'], ['1', '1', '1']]);
  const ggShapes: FigureShape[] = [
    { kind: 'line', points: [[-0.5, 0], [2.5, 0]], tone: 'muted', dash: true },
    { kind: 'point', at: [0, 0], tone: 'text', hollow: true, label: 'x₁' },
    { kind: 'point', at: [1, 0], tone: 'text', hollow: true, label: 'x₂' },
    { kind: 'point', at: [2, 0], tone: 'text', hollow: true, label: 'x₃' },
  ];

  // Card 8: challenge
  const ch = retry(() => {
    const row = g.pick(CHALLENGE_ROWS);
    const z = g.pick(CH_Z);
    return { row, z };
  }, v => {
    const [cl11, cl21, cl22] = v.row;
    const [cz1, cz2] = v.z;
    if (cz1 === cz2) return false;
    const y2 = cl21 * cz1 + cl22 * cz2;
    return y2 !== 0;
  });
  const [chl11, chl21, chl22] = ch.row;
  const [chz1, chz2] = ch.z;
  const chS11 = chl11 * chl11;
  const chS12 = chl11 * chl21;
  const chS22 = chl21 * chl21 + chl22 * chl22;
  const chY1 = chl11 * chz1;
  const chY2 = chl21 * chz1 + chl22 * chz2;
  const chSigma = mat([[fmt(chS11), fmt(chS12)], [fmt(chS12), fmt(chS22)]]);

  return [
    g.number({
      id: 'sample-value',
      title: t('Sampling a Gaussian vector', '对高斯向量采样'),
      prompt: t(
        `A Gaussian vector y = (y₁, y₂) has mean m = (${num(m1)}, ${num(m2)}) and Cholesky factor L = ${Lmat} (so its covariance is Σ = LLᵀ). A draw z = (${num(z1)}, ${num(z2)}) of z ~ N(0, I) is given. Sample y = m + L z. Find y₁ and y₂. Give integers, fractions or decimals rounded to 2 places.`,
        `高斯向量 y = (y₁, y₂) 的均值是 m = (${num(m1)}, ${num(m2)})，Cholesky 因子是 L = ${Lmat}（其协方差为 Σ = LLᵀ）。给定标准正态抽样 z = (${num(z1)}, ${num(z2)})，即 z ~ N(0, I)。按 y = m + L z 采样。求 y₁ 与 y₂。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('y₁', 'y₁'), answer: f1, tolerance: 0.006 },
        { label: t('y₂', 'y₂'), answer: f2, tolerance: 0.006 },
      ],
      hint: t(
        'Read the first row of L: y₁ uses only l11; y₂ uses the second row. Multiply L by the column z and add m.',
        '看 L 的第一行：y₁ 只用 l11；y₂ 用第二行。用 L 乘列向量 z，再加 m。'
      ),
      explanation: t(
        `The second row of L is (${num(l21)}, ${num(l22)}), so y₂ = ${num(m2)} + (${num(l21)})·(${num(z1)}) + (${num(l22)})·(${num(z2)}) = ${num(m2)} + (${num(l21 * z1)}) + (${num(l22 * z2)}) = ${exact(f2)}; the first row is (${num(l11)}, 0), so y₁ = ${num(m1)} + ${num(l11)}·(${num(z1)}) = ${exact(f1)} (Lecture 1 p. 56 eq. 22). Because z ~ N(0, I), y has mean m and covariance LLᵀ.`,
        `L 的第二行是 (${num(l21)}, ${num(l22)})，所以 y₂ = ${num(m2)} + (${num(l21)})·(${num(z1)}) + (${num(l22)})·(${num(z2)}) = ${num(m2)} + (${num(l21 * z1)}) + (${num(l22 * z2)}) = ${exact(f2)}；第一行是 (${num(l11)}, 0)，所以 y₁ = ${num(m1)} + ${num(l11)}·(${num(z1)}) = ${exact(f1)}（第 1 讲第 56 页，式 22）。因为 z ~ N(0, I)，y 的均值为 m、协方差为 LLᵀ。`
      ),
      audit: { kind: 'GP-03:sample-value', params: { l11, l21, l22, m1, m2, z1, z2 } },
    }),
    g.number({
      id: 'chol-factor',
      title: t('The Cholesky factor of a covariance', '协方差的 Cholesky 因子'),
      prompt: t(
        `A covariance matrix is Σ = ${Cmat}. Its Cholesky factor is L = [[l11, 0], [l21, l22]] with positive diagonal and Σ = LLᵀ. Find l21 and l22. Give integers, fractions or decimals rounded to 2 places.`,
        `协方差矩阵 Σ = ${Cmat}。它的 Cholesky 因子为 L = [[l11, 0], [l21, l22]]，对角元为正，且 Σ = LLᵀ。求 l21 与 l22。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('l21', 'l21'), answer: cl21, tolerance: 0.006 },
        { label: t('l22', 'l22'), answer: cl22, tolerance: 0.006 },
      ],
      hint: t(
        'Read l11 from Σ11: l11² = Σ11. Then l11·l21 = Σ12 and l21² + l22² = Σ22.',
        '从 Σ11 读出 l11：l11² = Σ11。接着 l11·l21 = Σ12，l21² + l22² = Σ22。'
      ),
      explanation: t(
        `l11 = √${num(cs11)} = ${num(cl11)}. Then l21 = Σ12/l11 = (${num(cs12)})/${num(cl11)} = ${exact(cl21)} and l22 = √(Σ22 − l21²) = √(${num(cs22)} − ${num(cl21 * cl21)}) = ${exact(cl22)}. Check: LLᵀ = [[${num(cl11)}², ${num(cl11)}·${num(cl21)}], [${num(cl11)}·${num(cl21)}, ${num(cl21)}² + ${num(cl22)}²]] = ${Cmat} (GPML pdf p. 220, LLᵀ = A). The off-diagonal sign of L is the sign of Σ12.`,
        `l11 = √${num(cs11)} = ${num(cl11)}。于是 l21 = Σ12/l11 = (${num(cs12)})/${num(cl11)} = ${exact(cl21)}，l22 = √(Σ22 − l21²) = √(${num(cs22)} − ${num(cl21 * cl21)}) = ${exact(cl22)}。验证：LLᵀ = ${Cmat}（GPML 附录 A.4，LLᵀ = A）。L 非对角元的符号就是 Σ12 的符号。`
      ),
      audit: { kind: 'GP-03:chol-factor', params: { s11: cs11, s12: cs12, s22: cs22 } },
    }),
    g.number({
      id: 'llt-entries',
      title: t('Checking LLᵀ = Σ', '验证 LLᵀ = Σ'),
      prompt: t(
        `A lower-triangular matrix with positive diagonal is L = ${lLmat}. Its covariance is Σ = LLᵀ. Find the off-diagonal entry Σ12 and the diagonal entry Σ22 of Σ. Give integers, fractions or decimals rounded to 2 places.`,
        `对角元为正的下三角矩阵 L = ${lLmat}，其协方差为 Σ = LLᵀ。求 Σ 的非对角元 Σ12 与对角元 Σ22。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('Σ12', 'Σ12'), answer: ls12, tolerance: 0.006 },
        { label: t('Σ22', 'Σ22'), answer: ls22, tolerance: 0.006 },
      ],
      hint: t(
        'Σ12 is the first row of L dotted with the second (the zero in L drops out): Σ12 = l11·l21. Σ22 is the second row dotted with itself: l21² + l22².',
        'Σ12 是 L 第一行与第二行的点积（第一行的零元消失）：Σ12 = l11·l21。Σ22 是第二行与自身的点积：l21² + l22²。'
      ),
      explanation: t(
        `Σ12 = ${num(ll11)}·(${num(ll21)}) = ${exact(ls12)} and Σ22 = (${num(ll21)})² + (${num(ll22)})² = ${num(ll21 * ll21)} + ${num(ll22 * ll22)} = ${exact(ls22)}, so Σ = ${lSigma} and LLᵀ = Σ holds (GPML pdf p. 220). A check: Σ11·Σ22 − Σ12² = (${num(ll11 * ll22)})² = (l11·l22)², which equals det Σ. Entry Σ11 = l11² = ${num(ll11 * ll11)}.`,
        `Σ12 = ${num(ll11)}·(${num(ll21)}) = ${exact(ls12)}，Σ22 = (${num(ll21)})² + (${num(ll22)})² = ${num(ll21 * ll21)} + ${num(ll22 * ll22)} = ${exact(ls22)}，所以 Σ = ${lSigma}，即 LLᵀ = Σ（GPML 附录 A.4）。可验证：Σ11·Σ22 − Σ12² = (${num(ll11 * ll22)})²，正好等于 det Σ。Σ11 = l11² = ${num(ll11 * ll11)}。`
      ),
      audit: { kind: 'GP-03:llt-entries', params: { l11: ll11, l21: ll21, l22: ll22 } },
    }),
    g.choice({
      id: 'sample-cov',
      title: t('The covariance of a standard draw', '标准抽样的协方差'),
      prompt: t(
        `For a lower-triangular matrix with positive diagonal L = ${SLmat}, define f = L z with z ~ N(0, I) and z independent across coordinates. What is the covariance matrix of f?`,
        `对对角元为正的下三角矩阵 L = ${SLmat}，令 f = L z，其中 z ~ N(0, I)，且 z 各分量相互独立。f 的协方差矩阵是什么？`
      ),
      options: [
        t('L Lᵀ', 'L Lᵀ'),
        t('L, because f = L z', 'L，因为 f = L z'),
        t('Lᵀ L', 'Lᵀ L'),
        t('I, because z has covariance I', 'I，因为 z 的协方差就是 I'),
      ],
      correct: 0,
      hint: t(
        'How does a linear map change a covariance? Cov(A z) = A Cov(z) Aᵀ.',
        '线性变换如何改变协方差？Cov(A z) = A Cov(z) Aᵀ。'
      ),
      explanation: t(
        `Since Cov(z) = I, Cov(f) = Cov(L z) = L·I·Lᵀ = L Lᵀ (GPML pdf p. 219: L E[uuᵀ] Lᵀ = LLᵀ = K). With L = ${SLmat}, LLᵀ = ${sSigma}, the covariance of f. The order matters: LᵀL is a different matrix in general, and L alone is not symmetric.`,
        `由 Cov(z) = I，Cov(f) = Cov(L z) = L·I·Lᵀ = L Lᵀ（GPML 附录 A.2，L E[uuᵀ] Lᵀ = LLᵀ = K）。取 L = ${SLmat}，则 LLᵀ = ${sSigma}，正是 f 的协方差。顺序很重要：LᵀL 一般是另一个矩阵，而单独的 L 并不是对称矩阵。`
      ),
    }),
    g.choice({
      id: 'jitter',
      title: t('Why add jitter before Cholesky?', '为什么在 Cholesky 之前加抖动？'),
      prompt: t(
        `Before factorising a kernel matrix K = ${jKmat} we add a small multiple of the identity, K + εI with ε = ${jEpsStr}, and then compute its Cholesky factor. Why is εI added?`,
        `在对核矩阵 K = ${jKmat} 做分解之前，我们先加上单位矩阵的小倍数，即 K + εI，其中 ε = ${jEpsStr}，再计算它的 Cholesky 因子。为什么要加 εI？`
      ),
      options: [
        t('To keep the matrix positive definite, so the Cholesky decomposition does not fail.', '保持矩阵正定，避免 Cholesky 分解失败。'),
        t('To raise the signal variance of the samples to the desired level.', '把样本的信号方差提高到期望的水平。'),
        t('To make the covariance matrix diagonal, so the coordinates of the sample become independent.', '把协方差矩阵变成对角矩阵，使样本各分量相互独立。'),
        t('To make the decomposition cheaper by removing the off-diagonal entries.', '去掉非对角元，从而降低分解的代价。'),
      ],
      correct: 0,
      hint: t(
        'What can happen to the eigenvalues of a kernel matrix, and what does Cholesky need the matrix to be?',
        '核矩阵的特征值可能出现什么问题？Cholesky 分解要求矩阵满足什么？'
      ),
      explanation: t(
        `The eigenvalues of a kernel matrix can decay very rapidly, so floating-point rounding can make K fail to be strictly positive definite and the Cholesky decomposition fails. Adding εI = ${jEpsStr}·I lifts every eigenvalue by ${jEpsStr}, keeping the matrix positive definite; the price is that each sample gains independent noise of variance ${jEpsStr}, which is usually negligible (GPML pdf p. 219).`,
        `核矩阵的特征值可能衰减得非常快，浮点舍入会使 K 不再是严格正定，Cholesky 分解于是失败。加上 εI = ${jEpsStr}·I 会把每个特征值抬高 ${jEpsStr}，保持矩阵正定；代价是每个样本多出方差为 ${jEpsStr} 的独立噪声，通常可以忽略（GPML 附录 A.2）。`
      ),
    }),
    g.choice({
      id: 'no-factor',
      title: t('A matrix with no Cholesky factor', '没有 Cholesky 因子的矩阵'),
      prompt: t(
        `A student is asked for the Cholesky factor of Σ = ${nSigma}. Which statement is correct?`,
        `有同学被要求求 Σ = ${nSigma} 的 Cholesky 因子。下列哪条说法正确？`
      ),
      options: [
        t(`There is none: Σ is not positive definite (det Σ = ${num(na * na)} − ${num(nb * nb)} = ${num(nDet)} < 0).`, `不存在：Σ 不是正定矩阵（det Σ = ${num(na * na)} − ${num(nb * nb)} = ${num(nDet)} < 0）。`),
        t(`It is L = [[√${num(na)}, 0], [${num(nb)}/√${num(na)}, √(${num(na)} − ${num(nb * nb)}/${num(na)})]].`, `它是 L = [[√${num(na)}, 0], [${num(nb)}/√${num(na)}, √(${num(na)} − ${num(nb * nb)}/${num(na)})]]。`),
        t('It exists, because both diagonal entries of Σ are positive.', '存在，因为 Σ 的两个对角元都是正数。'),
        t(`It is L = [[√${num(na)}, 0], [${num(nb)}/√${num(na)}, −√(${num(nb * nb)}/${num(na)} − ${num(na)})]], taking the negative root under the square.`, `它是 L = [[√${num(na)}, 0], [${num(nb)}/√${num(na)}, −√(${num(nb * nb)}/${num(na)} − ${num(na)})]]，即取根号下的负值。`),
      ],
      correct: 0,
      hint: t(
        'Compute det Σ. What does positivity require, and what would l22² = Σ22 − l21² need to be?',
        '先算 det Σ。正定要求什么？而 l22² = Σ22 − l21² 需要满足什么？'
      ),
      explanation: t(
        `det Σ = ${num(na)}·${num(na)} − ${num(nb)}·${num(nb)} = ${num(nDet)} < 0, so Σ is not positive definite and is not a valid covariance. Try the factor: l11 = √${num(na)}, l21 = ${num(nb)}/√${num(na)}, then l22² = Σ22 − l21² = ${num(na)} − ${num(nb * nb)}/${num(na)} = ${exact(nL22sq)} < 0 — no real l22 exists (GPML pdf p. 220 requires A positive definite; positive diagonal entries alone are not enough).`,
        `det Σ = ${num(na)}·${num(na)} − ${num(nb)}·${num(nb)} = ${num(nDet)} < 0，故 Σ 不是正定矩阵，不是合法的协方差。试求因子：l11 = √${num(na)}，l21 = ${num(nb)}/√${num(na)}，则 l22² = Σ22 − l21² = ${num(na)} − ${num(nb * nb)}/${num(na)} = ${exact(nL22sq)} < 0，不存在实数 l22（GPML 附录 A.4 要求矩阵正定；仅对角元为正并不充分）。`
      ),
    }),
    g.number({
      id: 'gp-grid',
      title: t('Sampling a GP prior on a grid', '在网格上对 GP 先验采样'),
      prompt: t(
        `A zero-mean GP prior is evaluated on the grid x₁ = 0, x₂ = 1, x₃ = 2. Its kernel matrix is K = ${gKmat}, and its Cholesky factor is L = ${gLmat} (so K = LLᵀ). Sampling the prior means sampling the vector f = (f₁, f₂, f₃) as f = L z, z ~ N(0, I). For the draw z = (${num(gz1)}, ${num(gz2)}, ${num(gz3)}), find the sampled values f₂ and f₃. Give integers, fractions or decimals rounded to 2 places.`,
        `一个零均值 GP 先验在网格点 x₁ = 0, x₂ = 1, x₃ = 2 上取值。它的核矩阵为 K = ${gKmat}，Cholesky 因子为 L = ${gLmat}（即 K = LLᵀ）。对先验采样就是对向量 f = (f₁, f₂, f₃) 按 f = L z 采样，z ~ N(0, I)。给定抽样 z = (${num(gz1)}, ${num(gz2)}, ${num(gz3)})，求采样值 f₂ 与 f₃。请填整数、分数，或保留 2 位小数的小数。`
      ),
      figure: g.figure({
        alt: t(
          'A horizontal dashed line at 0 (the prior mean) spanning the inputs, with three hollow points at x₁ = 0, x₂ = 1, x₃ = 2 marked on it; no sampled values are drawn.',
          '一条位于 0 处的水平虚线（先验均值）横跨输入区间，线上标出三个空心点：x₁ = 0、x₂ = 1、x₃ = 2；图中不画任何采样值。'
        ),
        view: fitView(ggShapes, 0.2),
        shapes: ggShapes,
        axes: { xLabel: 'x', yLabel: 'f', grid: true },
        aspect: 'free',
      }),
      fields: [
        { label: t('f₂', 'f₂'), answer: gF2, tolerance: 0.006 },
        { label: t('f₃', 'f₃'), answer: gF3, tolerance: 0.006 },
      ],
      hint: t(
        'This is the same operation as any Gaussian vector: f = L z. The second row of L gives f₂; the third row gives f₃.',
        '这和高斯向量的采样是同一个运算：f = L z。L 的第二行给出 f₂，第三行给出 f₃。'
      ),
      explanation: t(
        `Rows of L: f₂ = 1·(${num(gz1)}) + 2·(${num(gz2)}) = ${exact(gF2)} and f₃ = 1·(${num(gz1)}) + 1·(${num(gz2)}) + 1·(${num(gz3)}) = ${exact(gF3)} (f₁ = 2·${num(gz1)} uses the first row). This is exactly Assignment 2 Task 2: L = cholesky(K), z ~ N(0, I), f = L z; the sampled vector has the prior covariance LLᵀ = K (Lecture 1 p. 56 eq. 22; GPML pdf p. 219).`,
        `L 的各行：f₂ = 1·(${num(gz1)}) + 2·(${num(gz2)}) = ${exact(gF2)}，f₃ = 1·(${num(gz1)}) + 1·(${num(gz2)}) + 1·(${num(gz3)}) = ${exact(gF3)}（f₁ = 2·${num(gz1)} 用第一行）。这正是作业 2 任务 2：L = cholesky(K)，z ~ N(0, I)，f = L z；采样向量的先验协方差为 LLᵀ = K（第 1 讲第 56 页，式 22；GPML 附录 A.2）。`
      ),
      audit: { kind: 'GP-03:gp-grid', params: { z1: gz1, z2: gz2, z3: gz3 } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: factorise and sample', '挑战：先分解再采样'),
      prompt: t(
        `A zero-mean Gaussian vector y = (y₁, y₂) has covariance Σ = ${chSigma}. To sample it, take the Cholesky factor L = [[l11, 0], [l21, l22]] with positive diagonal (Σ = LLᵀ) and set y = L z with z ~ N(0, I). For the draw z = (${num(chz1)}, ${num(chz2)}), find y₁ and y₂. Give integers, fractions or decimals rounded to 2 places.`,
        `零均值高斯向量 y = (y₁, y₂) 的协方差为 Σ = ${chSigma}。为对它采样，取对角元为正的 Cholesky 因子 L = [[l11, 0], [l21, l22]]（Σ = LLᵀ），并按 y = L z 采样，z ~ N(0, I)。给定抽样 z = (${num(chz1)}, ${num(chz2)})，求 y₁ 与 y₂。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('y₁', 'y₁'), answer: chY1, tolerance: 0.006 },
        { label: t('y₂', 'y₂'), answer: chY2, tolerance: 0.006 },
      ],
      hint: t(
        'Two steps, no scaffolding: first find L from Σ (l11² = Σ11, l11·l21 = Σ12, l21² + l22² = Σ22), then apply y = L z.',
        '两步，无提示：先从 Σ 求 L（l11² = Σ11，l11·l21 = Σ12，l21² + l22² = Σ22），再按 y = L z 采样。'
      ),
      explanation: t(
        `Σ = ${chSigma}, so l11 = √${num(chS11)} = ${num(chl11)}, l21 = ${num(chS12)}/${num(chl11)} = ${num(chl21)}, l22 = √(${num(chS22)} − ${num(chl21 * chl21)}) = ${num(chl22)}. Then y₁ = ${num(chl11)}·(${num(chz1)}) = ${exact(chY1)} and y₂ = ${num(chl21)}·(${num(chz1)}) + ${num(chl22)}·(${num(chz2)}) = ${exact(chY2)}. The sampled vector has covariance LLᵀ = Σ (GPML pdf p. 219). This game does not assess conditioning or the posterior (GP-02, GP-06), Bayesian linear regression (GP-04), kernel evaluation or kernel choice (GP-08), or hyperparameter fitting.`,
        `Σ = ${chSigma}，故 l11 = √${num(chS11)} = ${num(chl11)}，l21 = ${num(chS12)}/${num(chl11)} = ${num(chl21)}，l22 = √(${num(chS22)} − ${num(chl21 * chl21)}) = ${num(chl22)}。于是 y₁ = ${num(chl11)}·(${num(chz1)}) = ${exact(chY1)}，y₂ = ${num(chl21)}·(${num(chz1)}) + ${num(chl22)}·(${num(chz2)}) = ${exact(chY2)}。采样向量的协方差为 LLᵀ = Σ（GPML 附录 A.2）。本游戏不考查条件化与后验（GP-02、GP-06）、贝叶斯线性回归（GP-04）、核函数取值与核选择（GP-08），以及超参数拟合。`
      ),
      audit: { kind: 'GP-03:challenge', params: { s11: chS11, s12: chS12, s22: chS22, z1: chz1, z2: chz2 } },
    }),
  ];
};
