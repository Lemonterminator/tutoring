import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** Parenthesise a fraction string when it is used as an operand, so `1/(33/2)` never prints as the ambiguous `1/33/2`. */
const Ps = (v: string) => (v.includes('/') ? `(${v})` : v);
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };

export const gp04: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-04');
  warm(g);

  const TOL = 0.006;
  const twoPlaces = t('Give integers, fractions or decimals rounded to 2 places.', '请填整数、分数，或保留 2 位小数的小数。');
  const onePlace = t('Give an integer, a fraction or a decimal rounded to 2 places.', '请填整数、分数，或保留 2 位小数的小数。');

  // Card 1: post-mean-1d
  const c1Rows = [
    { x1: 1, y1: 2, x2: 2, y2: 2, s2: 1, tau2: 1 },
    { x1: 1, y1: 2, x2: 3, y2: 3, s2: 1, tau2: 1 },
    { x1: 2, y1: 4, x2: 3, y2: 6, s2: 1, tau2: 1 },
    { x1: 1, y1: 2, x2: 2, y2: 5, s2: 1, tau2: 2 },
    { x1: 1, y1: 2, x2: 4, y2: 2, s2: 1, tau2: 1 },
    { x1: 1, y1: 2, x2: 2, y2: 3, s2: 2, tau2: 1 },
    { x1: 2, y1: 3, x2: 2, y2: 6, s2: 1, tau2: 1 },
    { x1: 1, y1: 2, x2: 2, y2: 2, s2: 2, tau2: 2 },
    { x1: 1, y1: 3, x2: 3, y2: 2, s2: 1, tau2: 1 },
  ];
  const c1 = c1Rows[g.random(0, c1Rows.length - 1)];
  const c1S = c1.x1 * c1.x1 + c1.x2 * c1.x2;
  const c1T = c1.x1 * c1.y1 + c1.x2 * c1.y2;
  const c1A = c1S / c1.s2 + 1 / c1.tau2;
  const c1mu = (c1T / c1.s2) / c1A;

  // Card 2: pred-mean-1d
  const c2Rows = [
    { x1: 1, y1: 2, x2: 2, y2: 2, s2: 1, tau2: 1, xs: 2 },
    { x1: 2, y1: 4, x2: 3, y2: 6, s2: 1, tau2: 1, xs: 2 },
    { x1: 1, y1: 2, x2: 4, y2: 2, s2: 1, tau2: 1, xs: 3 },
    { x1: 1, y1: 2, x2: 3, y2: 3, s2: 1, tau2: 1, xs: 1 },
    { x1: 2, y1: 3, x2: 2, y2: 6, s2: 1, tau2: 1, xs: 2 },
    { x1: 1, y1: 2, x2: 2, y2: 5, s2: 1, tau2: 2, xs: 2 },
    { x1: 1, y1: 3, x2: 3, y2: 2, s2: 1, tau2: 1, xs: 3 },
  ];
  const c2 = c2Rows[g.random(0, c2Rows.length - 1)];
  const c2S = c2.x1 * c2.x1 + c2.x2 * c2.x2;
  const c2T = c2.x1 * c2.y1 + c2.x2 * c2.y2;
  const c2A = c2S / c2.s2 + 1 / c2.tau2;
  const c2mu = (c2T / c2.s2) / c2A;
  const c2ans = c2mu * c2.xs;

  // Card 3: pred-var-1d
  const c3Rows = [
    { x1: 1, y1: 2, x2: 2, y2: 2, s2: 1, tau2: 1, xs: 2 },
    { x1: 1, y1: 2, x2: 3, y2: 3, s2: 1, tau2: 1, xs: 1 },
    { x1: 2, y1: 3, x2: 2, y2: 6, s2: 2, tau2: 2, xs: 3 },
    { x1: 1, y1: 2, x2: 2, y2: 5, s2: 1, tau2: 2, xs: 2 },
    { x1: 2, y1: 4, x2: 3, y2: 6, s2: 1, tau2: 1, xs: 1 },
    { x1: 1, y1: 2, x2: 2, y2: 2, s2: 1, tau2: 1, xs: 1 },
    { x1: 1, y1: 2, x2: 4, y2: 2, s2: 1, tau2: 1, xs: 2 },
  ];
  const c3 = c3Rows[g.random(0, c3Rows.length - 1)];
  const c3S = c3.x1 * c3.x1 + c3.x2 * c3.x2;
  const c3T = c3.x1 * c3.y1 + c3.x2 * c3.y2;
  const c3A = c3S / c3.s2 + 1 / c3.tau2;
  const c3Vf = (c3.xs * c3.xs) / c3A;
  const c3Vy = c3.s2 + c3Vf;

  // Card 4: post-cov-2d
  const c4Rows = [
    { x1: 0, x2: 1, x3: 2, s2: 1, t02: 1, t12: 1 },
    { x1: 0, x2: 1, x3: 2, s2: 1, t02: 1, t12: 2 },
    { x1: 0, x2: 1, x3: 2, s2: 1, t02: 2, t12: 1 },
    { x1: 0, x2: 1, x3: 2, s2: 2, t02: 1, t12: 1 },
    { x1: 0, x2: 1, x3: 2, s2: 2, t02: 2, t12: 2 },
    { x1: 1, x2: 2, x3: 3, s2: 1, t02: 1, t12: 1 },
    { x1: 1, x2: 2, x3: 3, s2: 1, t02: 2, t12: 1 },
  ];
  const c4 = c4Rows[g.random(0, c4Rows.length - 1)];
  const c4Sx = c4.x1 + c4.x2 + c4.x3;
  const c4Sxx = c4.x1 * c4.x1 + c4.x2 * c4.x2 + c4.x3 * c4.x3;
  const c4A11 = 3 / c4.s2 + 1 / c4.t02;
  const c4A12 = c4Sx / c4.s2;
  const c4A22 = c4Sxx / c4.s2 + 1 / c4.t12;
  const c4det = c4A11 * c4A22 - c4A12 * c4A12;
  const c4V0 = c4A22 / c4det;
  const c4V1 = c4A11 / c4det;

  // Card 5: post-mean-2d
  const c5Rows = [
    { x1: 0, y1: 1, x2: 1, y2: 2, x3: 2, y3: 3, s2: 1, t02: 1, t12: 1 },
    { x1: 0, y1: 1, x2: 1, y2: 1, x3: 1, y3: 1, s2: 1, t02: 1, t12: 1 },
    { x1: 0, y1: 0, x2: 1, y2: 0, x3: 2, y3: 3, s2: 1, t02: 1, t12: 1 },
    { x1: 0, y1: 0, x2: 1, y2: 0, x3: 2, y3: 3, s2: 1, t02: 1, t12: 2 },
    { x1: 0, y1: 0, x2: 1, y2: 0, x3: 2, y3: 3, s2: 1, t02: 2, t12: 1 },
    { x1: 0, y1: 0, x2: 1, y2: 0, x3: 2, y3: 3, s2: 2, t02: 1, t12: 1 },
    { x1: 0, y1: 2, x2: 1, y2: 2, x3: 2, y3: 2, s2: 1, t02: 1, t12: 1 },
    { x1: 0, y1: 1, x2: 1, y2: 3, x3: 2, y3: 5, s2: 1, t02: 1, t12: 1 },
  ];
  const c5 = c5Rows[g.random(0, c5Rows.length - 1)];
  const c5Sx = c5.x1 + c5.x2 + c5.x3;
  const c5Sxx = c5.x1 * c5.x1 + c5.x2 * c5.x2 + c5.x3 * c5.x3;
  const c5Sy = c5.y1 + c5.y2 + c5.y3;
  const c5Sxy = c5.x1 * c5.y1 + c5.x2 * c5.y2 + c5.x3 * c5.y3;
  const c5A11 = 3 / c5.s2 + 1 / c5.t02;
  const c5A12 = c5Sx / c5.s2;
  const c5A22 = c5Sxx / c5.s2 + 1 / c5.t12;
  const c5det = c5A11 * c5A22 - c5A12 * c5A12;
  const c5inv11 = c5A22 / c5det;
  const c5inv12 = -c5A12 / c5det;
  const c5inv22 = c5A11 / c5det;
  const c5mu0 = (1 / c5.s2) * (c5inv11 * c5Sy + c5inv12 * c5Sxy);
  const c5mu1 = (1 / c5.s2) * (c5inv12 * c5Sy + c5inv22 * c5Sxy);

  // Card 8: challenge
  const c8Rows = [
    { x1: 1, y1: 1, x2: 2, y2: 2, x3: 3, y3: 3, s2: 1, t02: 1, t12: 1, xs: 1 },
    { x1: 1, y1: 1, x2: 2, y2: 2, x3: 3, y3: 3, s2: 1, t02: 2, t12: 1, xs: 2 },
    { x1: 1, y1: 2, x2: 2, y2: 3, x3: 3, y3: 1, s2: 1, t02: 1, t12: 1, xs: 2 },
    { x1: 1, y1: 2, x2: 2, y2: 3, x3: 3, y3: 1, s2: 1, t02: 1, t12: 2, xs: 3 },
    { x1: 1, y1: 3, x2: 2, y2: 2, x3: 3, y3: 1, s2: 1, t02: 1, t12: 1, xs: 1 },
    { x1: 1, y1: 3, x2: 2, y2: 2, x3: 3, y3: 1, s2: 2, t02: 1, t12: 1, xs: 1 },
  ];
  const c8 = c8Rows[g.random(0, c8Rows.length - 1)];
  const c8Sx = c8.x1 + c8.x2 + c8.x3;
  const c8Sxx = c8.x1 * c8.x1 + c8.x2 * c8.x2 + c8.x3 * c8.x3;
  const c8Sy = c8.y1 + c8.y2 + c8.y3;
  const c8Sxy = c8.x1 * c8.y1 + c8.x2 * c8.y2 + c8.x3 * c8.y3;
  const c8A11 = 3 / c8.s2 + 1 / c8.t02;
  const c8A12 = c8Sx / c8.s2;
  const c8A22 = c8Sxx / c8.s2 + 1 / c8.t12;
  const c8det = c8A11 * c8A22 - c8A12 * c8A12;
  const c8inv11 = c8A22 / c8det;
  const c8inv12 = -c8A12 / c8det;
  const c8inv22 = c8A11 / c8det;
  const c8mu0 = (1 / c8.s2) * (c8inv11 * c8Sy + c8inv12 * c8Sxy);
  const c8mu1 = (1 / c8.s2) * (c8inv12 * c8Sy + c8inv22 * c8Sxy);
  const c8Vf = c8inv11 + 2 * c8.xs * c8inv12 + c8.xs * c8.xs * c8inv22;

  return [
    g.number({
      id: 'post-mean-1d',
      title: t('Posterior mean of the slope', '斜率的后验均值'),
      prompt: t(
        `A slope-only linear model f(x) = w·x has prior w ~ N(0, ${c1.tau2}); here the design matrix X is 1 × n, so X Xᵀ = ${c1S} (the sum of the squared x values) and X y = ${c1T} (the sum of x_i y_i). The training data are (x_1, y_1) = (${c1.x1}, ${c1.y1}) and (x_2, y_2) = (${c1.x2}, ${c1.y2}), and the noise variance is σ² = ${c1.s2}. What is the posterior mean μ of w? ${onePlace[0]}`,
        `只有斜率的线性模型 f(x) = w·x，先验为 w ~ N(0, ${c1.tau2})；这里设计矩阵 X 是 1 × n，所以 X Xᵀ = ${c1S}（x 值平方的和），X y = ${c1T}（x_i y_i 的和）。训练数据为 (x_1, y_1) = (${c1.x1}, ${c1.y1}) 与 (x_2, y_2) = (${c1.x2}, ${c1.y2})，噪声方差 σ² = ${c1.s2}。w 的后验均值 μ 是多少？${onePlace[1]}`
      ),
      fields: [{ label: t('mu', 'mu'), answer: c1mu, tolerance: TOL }],
      hint: t(
        'The posterior precision adds: A = X Xᵀ/σ² + 1/τ². Then mu = (X y/σ²)/A. (τ² is the prior variance.)',
        '后验精度相加：A = X Xᵀ/σ² + 1/τ²。再算 mu = (X y/σ²)/A。（τ² 是先验方差。）'
      ),
      explanation: t(
        `X Xᵀ = ${c1.x1}² + ${c1.x2}² = ${c1S}, X y = ${c1.x1}·${c1.y1} + ${c1.x2}·${c1.y2} = ${c1T}. The prior contributes 1/τ² = ${frac(1, c1.tau2)} and the data X Xᵀ/σ² = ${frac(c1S, c1.s2)}, so A = ${frac(c1S, c1.s2)} + ${frac(1, c1.tau2)} = ${c1A}. Then μ = (${c1T}/${c1.s2}) / ${c1A} = ${exact(c1mu)} (Lecture 2 p. 12, eq. 17). A larger σ² or a smaller τ² pulls μ toward the prior mean 0.`,
        `X Xᵀ = ${c1.x1}² + ${c1.x2}² = ${c1S}，X y = ${c1.x1}·${c1.y1} + ${c1.x2}·${c1.y2} = ${c1T}。先验贡献 1/τ² = ${frac(1, c1.tau2)}，数据贡献 X Xᵀ/σ² = ${frac(c1S, c1.s2)}，所以 A = ${frac(c1S, c1.s2)} + ${frac(1, c1.tau2)} = ${c1A}。于是 μ = (${c1T}/${c1.s2}) / ${c1A} = ${exact(c1mu)}（第 2 讲第 12 页，式 17）。σ² 越大或 τ² 越小，μ 越靠近先验均值 0。`
      ),
      audit: { kind: 'GP-04:post-mean-1d', params: { x1: c1.x1, y1: c1.y1, x2: c1.x2, y2: c1.y2, sigma2: c1.s2, tau2: c1.tau2 } },
    }),
    g.number({
      id: 'pred-mean-1d',
      title: t('Predictive mean at a new input', '新输入处的预测均值'),
      prompt: t(
        `A slope-only model f(x) = w·x has prior w ~ N(0, ${c2.tau2}). The data are (x_1, y_1) = (${c2.x1}, ${c2.y1}) and (x_2, y_2) = (${c2.x2}, ${c2.y2}); the noise variance is σ² = ${c2.s2}. What is the predictive mean of f at the new input x* = ${c2.xs} (the same as the predictive mean of a noisy y*)? ${onePlace[0]}`,
        `只有斜率的模型 f(x) = w·x，先验 w ~ N(0, ${c2.tau2})。数据为 (x_1, y_1) = (${c2.x1}, ${c2.y1})、(x_2, y_2) = (${c2.x2}, ${c2.y2})，噪声方差 σ² = ${c2.s2}。在新输入 x* = ${c2.xs} 处 f 的预测均值是多少（带噪声的 y* 预测均值相同）？${onePlace[1]}`
      ),
      fields: [{ label: t('mu x*', 'mu x*'), answer: c2ans, tolerance: TOL }],
      hint: t(
        'First find the posterior mean mu of the slope (card 1); the predictive mean at x* is mu·x*.',
        '先求斜率的后验均值 mu（第 1 关），x* 处的预测均值就是 mu·x*。'
      ),
      explanation: t(
        `As in card 1, A = ${frac(c2S, c2.s2)} + ${frac(1, c2.tau2)} = ${c2A} and μ = (${c2T}/${c2.s2})/${c2A} = ${exact(c2mu)}. The predictive mean at x* = ${c2.xs} is μ·x* = ${Ps(exact(c2mu))}·${c2.xs} = ${exact(c2ans)} (Lecture 2 p. 13, eq. 20; the mean does not involve σ²).`,
        `同第 1 关，A = ${frac(c2S, c2.s2)} + ${frac(1, c2.tau2)} = ${c2A}，μ = (${c2T}/${c2.s2})/${c2A} = ${exact(c2mu)}。x* = ${c2.xs} 处的预测均值为 μ·x* = ${Ps(exact(c2mu))}·${c2.xs} = ${exact(c2ans)}（第 2 讲第 13 页，式 20；均值与 σ² 无关）。`
      ),
      audit: { kind: 'GP-04:pred-mean-1d', params: { x1: c2.x1, y1: c2.y1, x2: c2.x2, y2: c2.y2, sigma2: c2.s2, tau2: c2.tau2, xs: c2.xs } },
    }),
    g.number({
      id: 'pred-var-1d',
      title: t('Latent variance or noisy variance?', '潜在方差还是带噪声方差？'),
      prompt: t(
        `A slope-only model f(x) = w·x has prior w ~ N(0, ${c3.tau2}). The data are (x_1, y_1) = (${c3.x1}, ${c3.y1}) and (x_2, y_2) = (${c3.x2}, ${c3.y2}); the noise variance is σ² = ${c3.s2}. At the new input x* = ${c3.xs}, find (i) the predictive variance of the latent value f(x*) and (ii) the predictive variance of a noisy observation y*. ${twoPlaces[0]}`,
        `只有斜率的模型 f(x) = w·x，先验 w ~ N(0, ${c3.tau2})。数据为 (x_1, y_1) = (${c3.x1}, ${c3.y1})、(x_2, y_2) = (${c3.x2}, ${c3.y2})，噪声方差 σ² = ${c3.s2}。在新输入 x* = ${c3.xs} 处求：(i) 潜在函数值 f(x*) 的预测方差；(ii) 带噪声观测 y* 的预测方差。${twoPlaces[1]}`
      ),
      fields: [
        { label: t('Var(f(x*))', 'Var(f(x*))'), answer: c3Vf, tolerance: TOL },
        { label: t('Var(y*)', 'Var(y*)'), answer: c3Vy, tolerance: TOL },
      ],
      hint: t(
        'The weight uncertainty gives x*²·(1/A); the noise adds σ² only for the noisy observation. Which field gets the extra σ²?',
        '权重的不确定性给出 x*²·(1/A)；只有带噪声的观测才再加上 σ²。哪一个字段要加 σ²？'
      ),
      explanation: t(
        `A = ${frac(c3S, c3.s2)} + ${frac(1, c3.tau2)} = ${c3A}, so A⁻¹ = ${frac(1, c3A)}. Var(f*) = x*²/A = ${c3.xs}²·${Ps(frac(1, c3A))} = ${exact(c3Vf)}. The noisy y* adds the measurement noise: Var(y*) = σ² + x*²/A = ${c3.s2} + ${exact(c3Vf)} = ${exact(c3Vy)}. The two differ by σ² = ${c3.s2}; the noise enters only the noisy observation (Lecture 2 p. 13, eq. 20).`,
        `A = ${frac(c3S, c3.s2)} + ${frac(1, c3.tau2)} = ${c3A}，所以 A⁻¹ = ${frac(1, c3A)}。Var(f*) = x*²/A = ${c3.xs}²·${Ps(frac(1, c3A))} = ${exact(c3Vf)}。带噪声的 y* 还要加上测量噪声：Var(y*) = σ² + x*²/A = ${c3.s2} + ${exact(c3Vf)} = ${exact(c3Vy)}。两者相差 σ² = ${c3.s2}；噪声只进入带噪声的观测（第 2 讲第 13 页，式 20）。`
      ),
      audit: { kind: 'GP-04:pred-var-1d', params: { x1: c3.x1, y1: c3.y1, x2: c3.x2, y2: c3.y2, sigma2: c3.s2, tau2: c3.tau2, xs: c3.xs } },
    }),
    g.number({
      id: 'post-cov-2d',
      title: t('Posterior variances of intercept and slope', '截距与斜率的后验方差'),
      prompt: t(
        `A linear model with intercept f(x) = w₀ + w₁·x has prior w = (w₀, w₁) ~ N(0, Σ_p) with Σ_p = ${mat([[num(c4.t02), '0'], ['0', num(c4.t12)]])}, so Σ_p⁻¹ = ${mat([[frac(1, c4.t02), '0'], ['0', frac(1, c4.t12)]])}. With x = (1, x) as the feature vector, three training points x = ${c4.x1}, ${c4.x2}, ${c4.x3} give X Xᵀ = ${mat([['3', num(c4Sx)], [num(c4Sx), num(c4Sxx)]])}; the noise variance is σ² = ${c4.s2}. The target values are not needed here. Find the posterior variances Var(w₀) and Var(w₁), the diagonal entries of A⁻¹. ${twoPlaces[0]}`,
        `带截距的线性模型 f(x) = w₀ + w₁·x，先验 w = (w₀, w₁) ~ N(0, Σ_p)，Σ_p = ${mat([[num(c4.t02), '0'], ['0', num(c4.t12)]])}，所以 Σ_p⁻¹ = ${mat([[frac(1, c4.t02), '0'], ['0', frac(1, c4.t12)]])}。以 x = (1, x) 为特征向量，三个训练点 x = ${c4.x1}, ${c4.x2}, ${c4.x3} 给出 X Xᵀ = ${mat([['3', num(c4Sx)], [num(c4Sx), num(c4Sxx)]])}；噪声方差 σ² = ${c4.s2}。这里目标值不需要。求后验方差 Var(w₀) 与 Var(w₁)，即 A⁻¹ 的对角元素。${twoPlaces[1]}`
      ),
      fields: [
        { label: t('Var(w₀)', 'Var(w₀)'), answer: c4V0, tolerance: TOL },
        { label: t('Var(w₁)', 'Var(w₁)'), answer: c4V1, tolerance: TOL },
      ],
      hint: t(
        'Form A = X Xᵀ/σ² + Σ_p⁻¹ (a 2 × 2 matrix), then invert it with the cofactor rule; Var(w₀) and Var(w₁) are the diagonal entries of A⁻¹.',
        '先写出 A = X Xᵀ/σ² + Σ_p⁻¹（2 × 2 矩阵），再用代数余子式求逆；A⁻¹ 的对角元素就是 Var(w₀) 与 Var(w₁)。'
      ),
      explanation: t(
        `X Xᵀ = ${mat([['3', num(c4Sx)], [num(c4Sx), num(c4Sxx)]])}; dividing by σ² = ${c4.s2} and adding Σ_p⁻¹ = ${mat([[frac(1, c4.t02), '0'], ['0', frac(1, c4.t12)]])} gives A = ${mat([[exact(c4A11), exact(c4A12)], [exact(c4A12), exact(c4A22)]])}. det A = ${Ps(exact(c4A11))}·${Ps(exact(c4A22))} − (${exact(c4A12)})² = ${exact(c4det)}, so A⁻¹ = (1/${Ps(exact(c4det))})·${mat([[exact(c4A22), exact(-c4A12)], [exact(-c4A12), exact(c4A11)]])}. Hence Var(w₀) = ${Ps(exact(c4A22))}/${Ps(exact(c4det))} = ${exact(c4V0)} and Var(w₁) = ${Ps(exact(c4A11))}/${Ps(exact(c4det))} = ${exact(c4V1)} (Lecture 2 p. 12 eq. 16; margins of a Gaussian). The prior variances ${c4.t02} and ${c4.t12} are the marginal variances before seeing data; the posterior ones are smaller because the precision adds.`,
        `X Xᵀ = ${mat([['3', num(c4Sx)], [num(c4Sx), num(c4Sxx)]])}；除以 σ² = ${c4.s2} 再加上 Σ_p⁻¹ = ${mat([[frac(1, c4.t02), '0'], ['0', frac(1, c4.t12)]])} 得 A = ${mat([[exact(c4A11), exact(c4A12)], [exact(c4A12), exact(c4A22)]])}。det A = ${Ps(exact(c4A11))}·${Ps(exact(c4A22))} − (${exact(c4A12)})² = ${exact(c4det)}，所以 A⁻¹ = (1/${Ps(exact(c4det))})·${mat([[exact(c4A22), exact(-c4A12)], [exact(-c4A12), exact(c4A11)]])}。于是 Var(w₀) = ${Ps(exact(c4A22))}/${Ps(exact(c4det))} = ${exact(c4V0)}，Var(w₁) = ${Ps(exact(c4A11))}/${Ps(exact(c4det))} = ${exact(c4V1)}（第 2 讲第 12 页式 16；高斯分布的边缘）。先验方差 ${c4.t02}、${c4.t12} 是见数据前的边缘方差；后验更小，因为精度相加。`
      ),
      audit: { kind: 'GP-04:post-cov-2d', params: { x1: c4.x1, x2: c4.x2, x3: c4.x3, sigma2: c4.s2, tau02: c4.t02, tau12: c4.t12 } },
    }),
    g.number({
      id: 'post-mean-2d',
      title: t('Posterior mean of intercept and slope', '截距与斜率的后验均值'),
      prompt: t(
        `A linear model with intercept f(x) = w₀ + w₁·x has prior w ~ N(0, Σ_p) with Σ_p = ${mat([[num(c5.t02), '0'], ['0', num(c5.t12)]])}. With the feature vector x = (1, x), the three training points are (${c5.x1}, ${c5.y1}), (${c5.x2}, ${c5.y2}), (${c5.x3}, ${c5.y3}); the noise variance is σ² = ${c5.s2}. Find the posterior mean vector μ = (μ_0, μ_1). ${twoPlaces[0]}`,
        `带截距的线性模型 f(x) = w₀ + w₁·x，先验 w ~ N(0, Σ_p)，Σ_p = ${mat([[num(c5.t02), '0'], ['0', num(c5.t12)]])}。以 x = (1, x) 为特征向量，三个训练点为 (${c5.x1}, ${c5.y1})、(${c5.x2}, ${c5.y2})、(${c5.x3}, ${c5.y3})；噪声方差 σ² = ${c5.s2}。求后验均值向量 μ = (μ_0, μ_1)。${twoPlaces[1]}`
      ),
      fields: [
        { label: t('mu_0', 'mu_0'), answer: c5mu0, tolerance: TOL },
        { label: t('mu_1', 'mu_1'), answer: c5mu1, tolerance: TOL },
      ],
      hint: t(
        'X y = (Sy, Sxy) with Sy the sum of the targets and Sxy the sum of x_i y_i. With A from card 4, mu = (1/σ²)·A⁻¹·(Sy, Sxy).',
        'X y = (Sy, Sxy)，其中 Sy 是目标值之和，Sxy 是 x_i y_i 之和。用第 4 关的 A，mu = (1/σ²)·A⁻¹·(Sy, Sxy)。'
      ),
      explanation: t(
        `S_y = ${c5Sy}, Sxy = ${c5Sxy}. As in card 4, A = ${mat([[exact(c5A11), exact(c5A12)], [exact(c5A12), exact(c5A22)]])} and A⁻¹ = (1/${Ps(exact(c5det))})·${mat([[exact(c5A22), exact(-c5A12)], [exact(-c5A12), exact(c5A11)]])}. So μ = (1/${c5.s2})·(1/${Ps(exact(c5det))})·${mat([[exact(c5A22), exact(-c5A12)], [exact(-c5A12), exact(c5A11)]])}·(${c5Sy}, ${c5Sxy}) = (${exact(c5mu0)}, ${exact(c5mu1)}) (Lecture 2 p. 12 eq. 17). The intercept absorbs the mean level while the slope follows the trend, and both are shrunk toward 0 by the prior.`,
        `S_y = ${c5Sy}，Sxy = ${c5Sxy}。同第 4 关，A = ${mat([[exact(c5A11), exact(c5A12)], [exact(c5A12), exact(c5A22)]])}，A⁻¹ = (1/${Ps(exact(c5det))})·${mat([[exact(c5A22), exact(-c5A12)], [exact(-c5A12), exact(c5A11)]])}。所以 μ = (1/${c5.s2})·(1/${Ps(exact(c5det))})·${mat([[exact(c5A22), exact(-c5A12)], [exact(-c5A12), exact(c5A11)]])}·(${c5Sy}, ${c5Sxy}) = (${exact(c5mu0)}, ${exact(c5mu1)})（第 2 讲第 12 页式 17）。截距吸收整体水平，斜率跟随趋势，两者都被先验向 0 收缩。`
      ),
      audit: { kind: 'GP-04:post-mean-2d', params: { x1: c5.x1, y1: c5.y1, x2: c5.x2, y2: c5.y2, x3: c5.x3, y3: c5.y3, sigma2: c5.s2, tau02: c5.t02, tau12: c5.t12 } },
    }),
    g.choice({
      id: 'precision-add',
      title: t('How the precision is built', '精度如何构成'),
      prompt: t(
        'In Bayesian linear regression f(x) = wᵀ x with prior w ~ N(0, Σ_p), design matrix X (D × n) and noise variance σ², the posterior is N(mu, A⁻¹) with mu = (1/σ²) A⁻¹ X y. Which expression for the posterior precision A is correct?',
        '在贝叶斯线性回归 f(x) = wᵀ x 中，先验 w ~ N(0, Σ_p)，设计矩阵 X（D × n），噪声方差 σ²，后验为 N(mu, A⁻¹)，mu = (1/σ²) A⁻¹ X y。下列关于后验精度 A 的表达式哪一个是正确的？'
      ),
      options: [
        t('A = (1/σ²) X Xᵀ + Σ_p⁻¹.', 'A = (1/σ²) X Xᵀ + Σ_p⁻¹。'),
        t('A = (1/σ²) X Xᵀ + Σ_p, because the data and the prior contributions add.', 'A = (1/σ²) X Xᵀ + Σ_p，因为数据与先验的贡献相加。'),
        t('A = σ² X Xᵀ + Σ_p⁻¹.', 'A = σ² X Xᵀ + Σ_p⁻¹。'),
        t('A = (1/σ²) X Xᵀ, because the prior only sets the mean.', 'A = (1/σ²) X Xᵀ，因为先验只决定均值。'),
      ],
      correct: 0,
      hint: t(
        "Bayes' rule multiplies the likelihood N(y | Xᵀ w, σ² I) by the prior N(w | 0, Σ_p). Collect the quadratic terms in w; each Gaussian contributes a precision.",
        '贝叶斯公式把似然 N(y | Xᵀ w, σ² I) 与先验 N(w | 0, Σ_p) 相乘。整理关于 w 的二次项；每个高斯各贡献一个精度。'
      ),
      explanation: t(
        'Completing the square in w (GPML eq. 2.7, pdf p. 27) puts the data term X Xᵀ/σ² and the prior term Σ_p⁻¹ side by side: A = (1/σ²) X Xᵀ + Σ_p⁻¹. Precisions add, not covariances (so the Σ_p option is wrong), and σ² divides (so the σ²-multiplication option is wrong); dropping the prior would give the least-squares information without the shrinkage, so that option is wrong too.',
        '对 w 配方（GPML 式 2.7，pdf 第 27 页）后，数据项 X Xᵀ/σ² 与先验项 Σ_p⁻¹ 并列：A = (1/σ²) X Xᵀ + Σ_p⁻¹。相加的是精度而不是协方差（所以加 Σ_p 的选项错），σ² 在分母（所以乘 σ² 的选项错）；丢掉先验只剩最小二乘信息、没有收缩，所以那个选项也错。'
      ),
    }),
    g.choice({
      id: 'weaker-prior',
      title: t('A weaker prior', '更弱的先验'),
      prompt: t(
        'Two Bayesian linear regressions use the same slope-only model f(x) = w·x, the same data (which give X Xᵀ = 5 and X y = 6, so X y ≠ 0) and the same noise variance σ² = 1; they differ only in the prior: model A has w ~ N(0, 1) and model B has w ~ N(0, 2), with 2 > 1. Compare the posterior mean and the posterior variance of w in A and B. Which statement is correct?',
        '两个贝叶斯线性回归使用相同的只有斜率的模型 f(x) = w·x、相同的数据（给出 X Xᵀ = 5 与 X y = 6，故 X y ≠ 0）和相同的噪声方差 σ² = 1；只有先验不同：模型 A 为 w ~ N(0, 1)，模型 B 为 w ~ N(0, 2)，且 2 > 1。比较 A 与 B 中 w 的后验均值与后验方差。下列哪条说法正确？'
      ),
      options: [
        t('In B the posterior variance is larger and |mu| is larger: a weaker prior shrinks the weight less, so the estimate stays closer to the least-squares value and is less certain.', 'B 中的后验方差更大，|mu| 也更大：先验更弱则对权重的收缩更少，估计更接近最小二乘值、也更不确定。'),
        t('In B the posterior variance is smaller, because a larger prior variance carries more information.', 'B 中的后验方差更小，因为先验方差更大意味着信息更多。'),
        t('In B the posterior mean and the posterior variance are both unchanged; the prior does not enter the posterior.', 'B 中后验均值与后验方差都不变；先验不进入后验。'),
        t('In B the posterior variance is larger, but the posterior mean is unchanged.', 'B 中后验方差更大，但后验均值不变。'),
      ],
      correct: 0,
      hint: t(
        'The posterior variance is A⁻¹ = 1/(X Xᵀ/σ² + 1/τ²). Here τ² is the prior variance. What happens to 1/τ², then to A, then to A⁻¹, when τ² grows? And how does |mu| = |X y/σ²|/A move?',
        '后验方差是 A⁻¹ = 1/(X Xᵀ/σ² + 1/τ²)。这里 τ² 是先验方差。τ² 变大时，1/τ²、A、A⁻¹ 各怎样变？|mu| = |X y/σ²|/A 又怎样变？'
      ),
      explanation: t(
        'Illustration 1: in A, A = 5 + 1 = 6, mu = 6/6 = 1, variance 1/6 ≈ 0.167; in B, A = 5 + 1/2 = 5.5, mu = 6/5.5 = 12/11 ≈ 1.091, variance 1/5.5 = 2/11 ≈ 0.182. Illustration 2: in A, A = 11, mu = 9/11 ≈ 0.818, variance 1/11 ≈ 0.091; in B, A = 10 + 1/4 = 10.25, mu = 36/41 ≈ 0.878, variance 4/41 ≈ 0.098. In both, a larger τ² gives a larger posterior variance and a larger |mu|: the posterior is a compromise whose likelihood term wins as the prior flattens (Lecture 2 p. 14).',
        '图示 1：A 中 A = 5 + 1 = 6，mu = 6/6 = 1，方差 1/6 ≈ 0.167；B 中 A = 5 + 1/2 = 5.5，mu = 6/5.5 = 12/11 ≈ 1.091，方差 1/5.5 = 2/11 ≈ 0.182。图示 2：A 中 A = 11，mu = 9/11 ≈ 0.818，方差 1/11 ≈ 0.091；B 中 A = 10 + 1/4 = 10.25，mu = 36/41 ≈ 0.878，方差 4/41 ≈ 0.098。两例中 τ² 越大，后验方差越大、|mu| 越大：后验是先验与似然的折中，先验越平坦似然项越占优（第 2 讲第 14 页）。'
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: a new data set', '挑战：一组新数据'),
      prompt: t(
        `A linear model with intercept f(x) = w₀ + w₁·x has prior w ~ N(0, Σ_p) with Σ_p = ${mat([[num(c8.t02), '0'], ['0', num(c8.t12)]])}. With the feature vector x = (1, x), the three training points are (${c8.x1}, ${c8.y1}), (${c8.x2}, ${c8.y2}), (${c8.x3}, ${c8.y3}); the noise variance is σ² = ${c8.s2}. Find (i) the posterior mean of the slope, μ_1, and (ii) the predictive variance of the latent value f(x*) at the new input x* = ${c8.xs}. ${twoPlaces[0]}`,
        `带截距的线性模型 f(x) = w₀ + w₁·x，先验 w ~ N(0, Σ_p)，Σ_p = ${mat([[num(c8.t02), '0'], ['0', num(c8.t12)]])}。以 x = (1, x) 为特征向量，三个训练点为 (${c8.x1}, ${c8.y1})、(${c8.x2}, ${c8.y2})、(${c8.x3}, ${c8.y3})；噪声方差 σ² = ${c8.s2}。求：(i) 斜率的后验均值 μ_1；(ii) 在新输入 x* = ${c8.xs} 处潜在函数值 f(x*) 的预测方差。${twoPlaces[1]}`
      ),
      fields: [
        { label: t('mu_1', 'mu_1'), answer: c8mu1, tolerance: TOL },
        { label: t('Var(f(x*))', 'Var(f(x*))'), answer: c8Vf, tolerance: TOL },
      ],
      hint: t(
        'Form A as in card 4, invert the 2 × 2 matrix, then mu = (1/σ²)·A⁻¹·(Sy, Sxy) and Var(f(x*)) = (1, x*)·A⁻¹·(1, x*).',
        '像第 4 关那样写出 A，求 2 × 2 逆矩阵，再用 mu = (1/σ²)·A⁻¹·(Sy, Sxy) 与 Var(f(x*)) = (1, x*)·A⁻¹·(1, x*)。'
      ),
      explanation: t(
        `A = ${mat([[exact(c8A11), exact(c8A12)], [exact(c8A12), exact(c8A22)]])}, det A = ${exact(c8det)}, A⁻¹ = (1/${Ps(exact(c8det))})·${mat([[exact(c8A22), exact(-c8A12)], [exact(-c8A12), exact(c8A11)]])}. X y = (${c8Sy}, ${c8Sxy}), so μ = (1/${c8.s2})·(1/${Ps(exact(c8det))})·${mat([[exact(c8A22), exact(-c8A12)], [exact(-c8A12), exact(c8A11)]])}·(${c8Sy}, ${c8Sxy}) = (${exact(c8mu0)}, ${exact(c8mu1)}); the slope is μ_1 = ${exact(c8mu1)}. For the variance, (1, x*)·A⁻¹ = (${exact(c8inv11 + c8.xs * c8inv12)}, ${exact(c8inv12 + c8.xs * c8inv22)}), so Var(f(x*)) = ${exact(c8inv11 + c8.xs * c8inv12)} + ${c8.xs}·${Ps(exact(c8inv12 + c8.xs * c8inv22))} = ${exact(c8Vf)}. This game does not assess the function-space/kernel view, non-zero prior means, evaluating kernel functions, or fitting hyperparameters.`,
        `A = ${mat([[exact(c8A11), exact(c8A12)], [exact(c8A12), exact(c8A22)]])}，det A = ${exact(c8det)}，A⁻¹ = (1/${Ps(exact(c8det))})·${mat([[exact(c8A22), exact(-c8A12)], [exact(-c8A12), exact(c8A11)]])}。X y = (${c8Sy}, ${c8Sxy})，所以 μ = (1/${c8.s2})·(1/${Ps(exact(c8det))})·${mat([[exact(c8A22), exact(-c8A12)], [exact(-c8A12), exact(c8A11)]])}·(${c8Sy}, ${c8Sxy}) = (${exact(c8mu0)}, ${exact(c8mu1)})；斜率为 μ_1 = ${exact(c8mu1)}。求方差时 (1, x*)·A⁻¹ = (${exact(c8inv11 + c8.xs * c8inv12)}, ${exact(c8inv12 + c8.xs * c8inv22)})，故 Var(f(x*)) = ${exact(c8inv11 + c8.xs * c8inv12)} + ${c8.xs}·${Ps(exact(c8inv12 + c8.xs * c8inv22))} = ${exact(c8Vf)}。本游戏不考查函数视角/核视角、非零先验均值、核函数取值和超参数拟合。`
      ),
      audit: { kind: 'GP-04:challenge', params: { x1: c8.x1, y1: c8.y1, x2: c8.x2, y2: c8.y2, x3: c8.x3, y3: c8.y3, sigma2: c8.s2, tau02: c8.t02, tau12: c8.t12, xs: c8.xs } },
    }),
  ];
};
