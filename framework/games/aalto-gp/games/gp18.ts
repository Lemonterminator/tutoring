import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, term, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];
const wrap = (s: string) => (/[/−]/.test(s) ? `(${s})` : s);
/** a/b with brackets around any fraction or negative operand, so "1/5/4" can never appear */
const ratio = (a: string, b: string) => `${wrap(a)}/${wrap(b)}`;
/** substituted value: exact fraction, negatives in brackets */
const pf = (x: number) => (x < 0 || !Number.isInteger(x) ? `(${exact(x)})` : exact(x));
/** reduced denominator of x (0 when x is not a small rational) */
const denOf = (x: number) => { for (let d = 1; d <= 720; d++) if (Math.abs(x * d - Math.round(x * d)) < 1e-9) return d; return 0; };
const denOk = (...xs: number[]) => xs.every(x => [1, 2, 4, 5, 8, 10].includes(denOf(x)));

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

export const gp18: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-18');
  warm(g);

  // --- Card 1: mode-gradient ---
  const c1 = retry(() => {
    const a = g.pick([2.5, 3, 3]);
    const b = a === 2.5 ? 1.5 : (a === 3 ? g.pick([2, 1]) : 0);
    const m1 = g.random(-4, 4);
    const m2 = g.random(-4, 4);
    return { a, b, m1, m2 };
  }, v => {
    const D = v.a * v.a - v.b * v.b;
    const g1 = (v.a * v.m1 - v.b * v.m2) / D;
    if (g1 === 0 || Math.abs(g1) > 6 + 1e-9 || !denOk(g1)) return false;
    const n = v.a * v.m1 - v.b * v.m2;
    const u = v.a * v.m1 + v.b * v.m2;
    const g2 = (v.a * v.m2 - v.b * v.m1) / D;
    const m1a = v.m1 / v.a;
    const g1wrong = (v.a * v.m1 + v.b * v.m2) / D;
    const m1a2 = v.m1 * v.a / D;
    const checks = [u, n, m1a, g1wrong, v.m1, g2, m1a2];
    return checks.every(w => Math.abs(g1 - w) >= 0.02);
  });
  const c1D = c1.a * c1.a - c1.b * c1.b;
  const c1g1 = (c1.a * c1.m1 - c1.b * c1.m2) / c1D;
  const c1n = c1.a * c1.m1 - c1.b * c1.m2;
  const c1u = c1.a * c1.m1 + c1.b * c1.m2;
  const c1chain = exact(c1g1);

  // --- Card 2: laplace-variance ---
  const c2Pairs = [
    { k: 2, w: 0.75 }, { k: 2, w: 1.5 }, { k: 2, w: 2 },
    { k: 3, w: 0.5 }, { k: 3, w: 1 }, { k: 3, w: 3 },
    { k: 4, w: 0.25 }, { k: 4, w: 1 },
    { k: 6, w: 0.25 }, { k: 6, w: 0.5 }, { k: 6, w: 1.5 },
    { k: 8, w: 0.5 }, { k: 10, w: 1.5 }, { k: 12, w: 0.75 }, { k: 16, w: 0.25 }
  ];
  const c2 = c2Pairs[g.random(0, c2Pairs.length - 1)];
  const c2A = 1 / c2.k + c2.w;
  const c2V = 1 / c2A;

  // --- Card 3: newton-step ---
  const c3 = retry(() => {
    const k = g.pick([2, 4, 6]);
    const w = g.pick([0.25, 0.5, 1]);
    const f0 = g.pick([-2, -1, 1, 2]);
    const slope = g.pick([-2, -1, -0.5, 0.5, 1, 2]);
    return { k, w, f0, slope };
  }, v => {
    const A = 1 / v.k + v.w;
    const fn = (v.w * v.f0 + v.slope) / A;
    if (fn === 0 || Math.abs(fn) > 6 + 1e-9 || !denOk(fn)) return false;
    const wrongs = [
      v.f0 + v.slope,
      v.f0 + v.slope / v.w,
      (v.w * v.f0 + v.slope) / v.w,
      v.slope / A,
      v.f0 + v.slope / A,
      (v.w * v.f0 + v.slope) / (v.k + v.w),
      (v.w * v.f0 + v.slope) * v.k,
      v.f0 + v.slope * v.k,
      -fn
    ];
    if (1 / v.k !== v.w) wrongs.push((v.w * v.f0 + v.slope) / (1 / v.k - v.w));
    wrongs.push(v.f0 + (v.slope - v.f0 / v.k) / v.w);
    return wrongs.every(w => Math.abs(fn - w) >= 0.02);
  });
  const c3A = 1 / c3.k + c3.w;
  const c3num = c3.w * c3.f0 + c3.slope;
  const c3fn = c3num / c3A;

  // --- Card 4: logistic-start ---
  const c4 = retry(() => {
    const k = g.pick([4, 6, 12, 16, 28, 36]);
    const y = g.pick([-1, 1]);
    return { k, y };
  }, v => {
    const s = v.y / 2;
    const A = 1 / v.k + 0.25;
    const f1 = s / A;
    const wrongs = [2 * v.y, s * v.k, s, -f1, s / (v.k + 0.25)];
    if (v.k !== 4) wrongs.push(s / (1 / v.k - 0.25));
    if (v.y === -1) wrongs.push((-1 - 0.5) / A);
    return wrongs.every(w => Math.abs(f1 - w) >= 0.02);
  });
  const c4s = c4.y / 2;
  const c4A = 1 / c4.k + 0.25;
  const c4f1 = c4s / c4A;

  // --- Card 5: valid-curvature ---
  const c5Pairs = [
    { k: 1, w: -0.25 }, { k: 1, w: -0.5 }, { k: 1, w: -0.75 }, { k: 2, w: -0.25 },
    { k: 1, w: -1.5 }, { k: 1, w: -2 }, { k: 2, w: -0.75 }, { k: 2, w: -1 }, { k: 4, w: -0.5 }, { k: 4, w: -1 }
  ];
  const c5 = c5Pairs[g.random(0, c5Pairs.length - 1)];
  const c5A = 1 / c5.k + c5.w;
  const c5A1 = 1 / c5.k - c5.w;
  const c5Pos = c5A > 0;

  // --- Card 6: pred-mean ---
  const c6 = retry(() => {
    const a = g.pick([2.5, 3, 3]);
    const b = a === 2.5 ? 1.5 : (a === 3 ? g.pick([2, 1]) : 0);
    const g1 = g.pick([-2, -1, -0.5, 0.5, 1, 2, 3]);
    const g2 = g.pick([-2, -1, -0.5, 0.5, 1, 2, 3]);
    const c1 = g.pick([-1, -0.5, 0.5, 1, 2]);
    const c2 = g.pick([-1, -0.5, 0.5, 1, 2]);
    return { a, b, g1, g2, c1, c2 };
  }, v => {
    const mu = v.c1 * v.g1 + v.c2 * v.g2;
    if (mu === 0 || Math.abs(mu) > 6 + 1e-9 || !denOk(mu)) return false;
    const D = v.a * v.a - v.b * v.b;
    const muK = v.c1 * (v.a * v.g1 + v.b * v.g2) + v.c2 * (v.b * v.g1 + v.a * v.g2);
    const muKi = (v.c1 * (v.a * v.g1 - v.b * v.g2) + v.c2 * (v.a * v.g2 - v.b * v.g1)) / D;
    const swapped = v.c1 * v.g2 + v.c2 * v.g1;
    const wrongs = [muK, muKi, swapped, v.c1 * v.g1, v.c2 * v.g2, (v.c1 + v.c2) * (v.g1 + v.g2)];
    return wrongs.every(w => Math.abs(mu - w) >= 0.02);
  });
  const c6mu = c6.c1 * c6.g1 + c6.c2 * c6.g2;
  const c6D = c6.a * c6.a - c6.b * c6.b;
  const c6muK = c6.c1 * (c6.a * c6.g1 + c6.b * c6.g2) + c6.c2 * (c6.b * c6.g1 + c6.a * c6.g2);
  const c6muKi = (c6.c1 * (c6.a * c6.g1 - c6.b * c6.g2) + c6.c2 * (c6.a * c6.g2 - c6.b * c6.g1)) / c6D;
  const c6term1 = c6.c1 * c6.g1;
  const c6term2 = c6.c2 * c6.g2;

  // --- Card 7: pred-var ---
  const c7 = retry(() => {
    const k = g.pick([2, 3, 4]);
    const w = g.pick([0.25, 0.5, 1, 1.5, 2]);
    const c = g.pick([0.5, 1, 1.5, 2]);
    const kss = g.pick([1, 1.5, 2, 2.5, 3, 4]);
    return { k, w, c, kss };
  }, v => {
    if (v.k * v.kss <= v.c * v.c) return false;
    const M = v.k + 1 / v.w;
    const q = v.c * v.c / M;
    const V = v.kss - q;
    if (V <= 0 || !denOk(V, q)) return false;
    const wrongs = [
      v.kss - v.c * v.c / v.k,
      v.kss - v.c * v.c / (v.k + v.w),
      v.kss - v.c * v.c / (1 / v.k + v.w),
      v.kss,
      v.kss - v.c * v.c * M,
      v.kss - v.c * v.c / (1 / v.k + 1 / v.w)
    ];
    return wrongs.every(w => Math.abs(V - w) >= 0.02);
  });
  const c7M = c7.k + 1 / c7.w;
  const c7q = c7.c * c7.c / c7M;
  const c7V = c7.kss - c7q;
  const c7V0 = c7.kss - c7.c * c7.c / c7.k;

  // --- Card 8: log-det ---
  const c8 = retry(() => {
    const a = g.pick([2.5, 3, 3, 2]);
    const b = a === 2.5 ? 1.5 : (a === 3 ? g.pick([2, 1]) : 1);
    const w1 = g.pick([0.25, 0.5, 1, 1.5, 2]);
    const w2 = g.pick([0.25, 0.5, 1, 1.5, 2]);
    return { a, b, w1, w2 };
  }, v => {
    const D = v.a * v.a - v.b * v.b;
    const P = (1 + v.a * v.w1) * (1 + v.a * v.w2) - v.b * v.b * v.w1 * v.w2;
    if (P > 40 || !denOk(P)) return false;
    const detA = P / D;
    const wrongs = [
      D,
      detA,
      D + detA,
      (1 + v.w1) * (1 + v.w2),
      (v.a + v.w1) * (v.a + v.w2) - v.b * v.b,
      D * ((v.a + v.w1) * (v.a + v.w2) - v.b * v.b),
      (1 + v.a * v.w1) * (1 + v.a * v.w2),
      P - 1,
      detA * detA,
      D * v.w1 * v.w2,
      1 + v.a * (v.w1 + v.w2)
    ];
    if (v.w1 * v.w2 === 1) return false;
    return wrongs.every(w => Math.abs(P - w) >= 0.02);
  });
  const c8D = c8.a * c8.a - c8.b * c8.b;
  const c8P = (1 + c8.a * c8.w1) * (1 + c8.a * c8.w2) - c8.b * c8.b * c8.w1 * c8.w2;
  const c8detA = c8P / c8D;

  // --- Card 9: challenge ---
  const c9 = retry(() => {
    const pairs = [
      { a: 2.5, b: 1.5 }, { a: 2.5, b: -1.5 },
      { a: 3.5, b: 2.5 }, { a: 3.5, b: -2.5 },
      { a: 5, b: 1 }, { a: 5, b: -1 }
    ];
    const p = pairs[g.random(0, pairs.length - 1)];
    const y1 = g.pick([-1, 1]);
    const y2 = g.pick([-1, 1]);
    return { a: p.a, b: p.b, y1, y2 };
  }, v => {
    const h = (lam: number) => 4 * lam / (4 + lam);
    const lam = v.y1 === v.y2 ? v.a + v.b : v.a - v.b;
    const f1 = (v.y1 / 2) * h(lam);
    const r1 = (v.y1 / 2) * 4 * v.a / (4 + v.a);
    const wrongs = [r1, (v.a * v.y1 + v.b * v.y2) / 2, 2 * v.y1, v.y1 / 2, -f1];
    const otherLam = v.y1 === v.y2 ? v.a - v.b : v.a + v.b;
    wrongs.push((v.y1 / 2) * h(otherLam));
    return wrongs.every(w => Math.abs(f1 - w) >= 0.02);
  });
  const c9h = (lam: number) => 4 * lam / (4 + lam);
  const c9lam = c9.y1 === c9.y2 ? c9.a + c9.b : c9.a - c9.b;
  const c9f1 = (c9.y1 / 2) * c9h(c9lam);
  const c9r1 = (c9.y1 / 2) * 4 * c9.a / (4 + c9.a);

  return [
    g.number({
      id: 'mode-gradient',
      title: t('Slope at the mode', '最大值点处的斜率'),
      prompt: t(
        `Two latent values f = (f(x₁), f(x₂)) have the prior N(0, K) with K = ${mat([[num(c1.a), num(c1.b)], [num(c1.b), num(c1.a)]])}. The posterior p(f | y) has its maximum (its mode) at f̂ = (${num(c1.m1)}, ${num(c1.m2)}), written as a column vector. What is the first component g₁ of the slope ∇log p(y | f) of the log-likelihood, evaluated at f̂? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `两个潜在值 f = (f(x₁), f(x₂)) 的先验为 N(0, K)，K = ${mat([[num(c1.a), num(c1.b)], [num(c1.b), num(c1.a)]])}。后验 p(f | y) 的最大值点（众数）是 f̂ = (${num(c1.m1)}, ${num(c1.m2)})，按列向量书写。对数似然的斜率 ∇log p(y | f) 在 f̂ 处的第一个分量 g₁ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('g₁', 'g₁'), answer: c1g1, tolerance: 0.006 }],
      hint: t(
        'At the mode the gradient of log p(y | f) + log p(f) is zero. What does the Gaussian prior N(0, K) contribute to that gradient at f̂?',
        '在最大值点处，log p(y | f) + log p(f) 的梯度为零。高斯先验 N(0, K) 在 f̂ 处给这个梯度贡献了什么？'
      ),
      explanation: t(
        `At the mode the slope of the log posterior is zero, so ∇log p(y | f̂) − K⁻¹f̂ = 0 and the likelihood slope equals K⁻¹f̂ (GPML pdf p. 61 eq. 3.17: f̂ = K ∇log p(y | f̂)). Here |K| = ${c1.a}² − ${c1.b}² = ${c1D}, so K⁻¹ = (1/${c1D})·[[${c1.a}, ${par(-c1.b)}], [${par(-c1.b)}, ${c1.a}]] and g₁ = (${c1.a}·${par(c1.m1)} − ${par(c1.b)}·${par(c1.m2)})/${c1D} = ${c1chain}. Multiplying by K instead of K⁻¹ would give ${exact(c1u)}; forgetting the determinant ${c1D} would give ${exact(c1n)}. This game does not assess how f̂ is found for a particular likelihood.`,
        `在最大值点处，对数后验的斜率为零，所以 ∇log p(y | f̂) − K⁻¹f̂ = 0，似然的斜率等于 K⁻¹f̂（GPML 第 61 页式 3.17：f̂ = K ∇log p(y | f̂)）。这里 |K| = ${c1.a}² − ${c1.b}² = ${c1D}，K⁻¹ = (1/${c1D})·[[${c1.a}, ${par(-c1.b)}], [${par(-c1.b)}, ${c1.a}]]，g₁ = (${c1.a}·${par(c1.m1)} − ${par(c1.b)}·${par(c1.m2)})/${c1D} = ${c1chain}。若误乘 K 而不是 K⁻¹，会得到 ${exact(c1u)}；若漏掉行列式 ${c1D}，会得到 ${exact(c1n)}。本游戏不考查如何对具体的似然求出 f̂。`
      ),
      audit: { kind: 'GP-18:mode-gradient', params: { a: c1.a, b: c1.b, m1: c1.m1, m2: c1.m2 } }
    }),
    g.number({
      id: 'laplace-variance',
      title: t('The width of the Laplace Gaussian', '拉普拉斯高斯的方差'),
      prompt: t(
        `One latent value f has the prior N(0, k) with k = ${num(c2.k)}. At the posterior mode f̂ the likelihood has the curvature weight W = −∂² log p(y | f)/∂f² = ${num(c2.w)}. The Laplace approximation is q(f) = N(f̂, V). What is the variance V? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个潜在值 f 的先验为 N(0, k)，k = ${num(c2.k)}。在后验最大值点 f̂ 处，似然的曲率权重为 W = −∂² log p(y | f)/∂f² = ${num(c2.w)}。拉普拉斯近似为 q(f) = N(f̂, V)。方差 V 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('V', 'V'), answer: c2V, tolerance: 0.006 }],
      hint: t(
        'The covariance of q is the inverse of the negative Hessian of the log posterior at f̂. Which two curvatures add up in that Hessian?',
        'q 的协方差是对数后验在 f̂ 处的负海森矩阵的逆。这个海森矩阵由哪两个曲率相加而成？'
      ),
      explanation: t(
        `The negative Hessian of the log posterior at the mode is A = 1/k + W: the prior contributes the precision 1/${c2.k} and the likelihood the precision ${exact(c2.w)} (GPML pdf p. 60 eq. 3.14; p. 61 eq. 3.20). So A = ${frac(1, c2.k)} + ${exact(c2.w)} = ${exact(c2A)} and V = 1/A = ${exact(c2V)}. Using the prior variance alone would give ${c2.k}; using the likelihood alone 1/W = ${exact(1 / c2.w)}; reading the precision A as the variance would give ${exact(c2A)}. This game does not assess how the mode f̂ is found.`,
        `对数后验在最大值点处的负海森矩阵为 A = 1/k + W：先验贡献精度 1/${c2.k}，似然贡献精度 ${exact(c2.w)}（GPML 第 60 页式 3.14；第 61 页式 3.20）。所以 A = ${frac(1, c2.k)} + ${exact(c2.w)} = ${exact(c2A)}，V = 1/A = ${exact(c2V)}。只用先验方差会得到 ${c2.k}；只用似然会得到 1/W = ${exact(1 / c2.w)}；把精度 A 当作方差会得到 ${exact(c2A)}。本游戏不考查如何求出最大值点 f̂。`
      ),
      audit: { kind: 'GP-18:laplace-variance', params: { k: c2.k, w: c2.w } }
    }),
    g.number({
      id: 'newton-step',
      title: t('One Newton step', '一步牛顿法'),
      prompt: t(
        `One latent value f has the prior N(0, k) with k = ${num(c3.k)}. At the current value f = ${num(c3.f0)} the log-likelihood has the slope ∂ log p(y | f)/∂f = ${num(c3.slope)} and the curvature weight W = −∂² log p(y | f)/∂f² = ${num(c3.w)}. Newton's method for the posterior mode moves f to a new value. What is the new f? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个潜在值 f 的先验为 N(0, k)，k = ${num(c3.k)}。在当前值 f = ${num(c3.f0)} 处，对数似然的斜率为 ∂ log p(y | f)/∂f = ${num(c3.slope)}，曲率权重为 W = −∂² log p(y | f)/∂f² = ${num(c3.w)}。用牛顿法求后验最大值点，f 被更新为新值。新的 f 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('f after the step', '迭代后的 f'), answer: c3fn, tolerance: 0.006 }],
      hint: t(
        'Write the slope and the curvature of log p(y | f) + log p(f) at the current f, then take the Newton step from f.',
        '写出 log p(y | f) + log p(f) 在当前 f 处的斜率和曲率，然后从 f 出发走一步牛顿法。'
      ),
      explanation: t(
        `Newton's iteration for the mode is f_new = (K⁻¹ + W)⁻¹ (W f + slope) (GPML pdf p. 61 eq. 3.18), with K⁻¹ = 1/${c3.k} here. The numerator is W f + slope = ${pf(c3.w)}·${pf(c3.f0)} + ${pf(c3.slope)} = ${exact(c3num)}; the denominator is 1/k + W = ${frac(1, c3.k)} + ${exact(c3.w)} = ${exact(c3A)}. So f_new = ${ratio(exact(c3num), exact(c3A))} = ${exact(c3fn)}. A plain gradient step f + slope would give ${exact(c3.f0 + c3.slope)}; Newton on the likelihood alone, f + slope/W, would give ${exact(c3.f0 + c3.slope / c3.w)}. This game does not assess convergence of the iteration.`,
        `求最大值点的牛顿迭代为 新的 f = (K⁻¹ + W)⁻¹ (W f + 斜率)（GPML 第 61 页式 3.18），这里 K⁻¹ = 1/${c3.k}。分子 W f + 斜率 = ${pf(c3.w)}·${pf(c3.f0)} + ${pf(c3.slope)} = ${exact(c3num)}；分母 1/k + W = ${frac(1, c3.k)} + ${exact(c3.w)} = ${exact(c3A)}。所以新的 f = ${ratio(exact(c3num), exact(c3A))} = ${exact(c3fn)}。只做梯度步 f + 斜率 会得到 ${exact(c3.f0 + c3.slope)}；只对似然做牛顿法 f + 斜率/W 会得到 ${exact(c3.f0 + c3.slope / c3.w)}。本游戏不考查迭代是否收敛。`
      ),
      audit: { kind: 'GP-18:newton-step', params: { k: c3.k, f0: c3.f0, g: c3.slope, w: c3.w } }
    }),
    g.number({
      id: 'logistic-start',
      title: t('Newton from the origin: logistic likelihood', '从原点出发：逻辑斯蒂似然'),
      prompt: t(
        `A single training point has the label y = ${num(c4.y)} (y is −1 or 1) and the logistic likelihood p(y | f) = σ(y·f) with σ(z) = 1/(1 + exp(−z)). With t = (y + 1)/2 and π = σ(f), the slope is ∂ log p(y | f)/∂f = t − π and the curvature weight is W = −∂² log p(y | f)/∂f² = π(1 − π). The prior is f ~ N(0, k) with k = ${num(c4.k)}. Newton's method for the posterior mode starts at f = 0. What is f after one Newton step? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个训练点的标签为 y = ${num(c4.y)}（y 取 −1 或 1），逻辑斯蒂似然为 p(y | f) = σ(y·f)，σ(z) = 1/(1 + exp(−z))。令 t = (y + 1)/2，π = σ(f)，则斜率为 ∂ log p(y | f)/∂f = t − π，曲率权重为 W = −∂² log p(y | f)/∂f² = π(1 − π)。先验为 f ~ N(0, k)，k = ${num(c4.k)}。用牛顿法求后验最大值点，从 f = 0 出发。走一步牛顿法后 f 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('f after the step', '迭代后的 f'), answer: c4f1, tolerance: 0.006 }],
      hint: t(
        'First evaluate σ at the starting point f = 0. Then use it in the printed slope and curvature weight, and take the Newton step from f = 0.',
        '先在起点 f = 0 处求出 σ 的值，再代入题中给出的斜率和曲率权重，然后从 f = 0 出发走一步牛顿法。'
      ),
      explanation: t(
        `At f = 0: π = σ(0) = 1/(1 + exp(0)) = 1/2, and t = ${exact((c4.y + 1) / 2)}. The slope is t − π = ${exact(c4s)} and W = π(1 − π) = (1/2)·(1/2) = 1/4 (GPML pdf p. 61 eq. 3.15). Newton's step from f = 0 is f₁ = (K⁻¹ + W)⁻¹ (W·0 + slope) = ${ratio(exact(c4s), `1/${c4.k} + 1/4`)} = ${ratio(exact(c4s), exact(c4A))} = ${exact(c4f1)} (eq. 3.18). Forgetting the prior, slope/W, would give ${exact(2 * c4.y)}; forgetting W, slope·k, would give ${exact(c4s * c4.k)}. This game does not assess later iterations.`,
        `在 f = 0 处：π = σ(0) = 1/(1 + exp(0)) = 1/2，t = ${exact((c4.y + 1) / 2)}。斜率为 t − π = ${exact(c4s)}，W = π(1 − π) = (1/2)·(1/2) = 1/4（GPML 第 61 页式 3.15）。从 f = 0 出发的牛顿步为 f₁ = (K⁻¹ + W)⁻¹ (W·0 + 斜率) = ${ratio(exact(c4s), `1/${c4.k} + 1/4`)} = ${ratio(exact(c4s), exact(c4A))} = ${exact(c4f1)}（式 3.18）。漏掉先验，即 斜率/W，会得到 ${exact(2 * c4.y)}；漏掉 W，即 斜率·k，会得到 ${exact(c4s * c4.k)}。本游戏不考查之后的迭代。`
      ),
      audit: { kind: 'GP-18:logistic-start', params: { k: c4.k, y: c4.y } }
    }),
    g.choice({
      id: 'valid-curvature',
      title: t('When is there a Laplace Gaussian?', '什么时候存在拉普拉斯高斯？'),
      prompt: t(
        `One latent value f has the prior N(0, k) with k = ${exact(c5.k)}. A likelihood that is not log-concave can have a negative curvature weight. At a point f̂ where the slope of log p(y | f) + log p(f) is zero, the likelihood has W = −∂² log p(y | f)/∂f² = ${exact(c5.w)}. We want q(f) = N(f̂, A⁻¹), where −A is the curvature of the log posterior at f̂. Which statement is correct?`,
        `一个潜在值 f 的先验为 N(0, k)，k = ${exact(c5.k)}。非对数凹的似然可能有负的曲率权重。在 log p(y | f) + log p(f) 的斜率为零的点 f̂ 处，似然的曲率权重为 W = −∂² log p(y | f)/∂f² = ${exact(c5.w)}。我们希望 q(f) = N(f̂, A⁻¹)，其中 −A 是对数后验在 f̂ 处的曲率。哪个陈述是正确的？`
      ),
      options: [
        c5Pos
          ? t(`A = ${exact(c5A)} is positive, so f̂ is a maximum and q = N(f̂, ${exact(1 / c5A)}).`, `A = ${exact(c5A)} 为正，所以 f̂ 是最大值点，q = N(f̂, ${exact(1 / c5A)})。`)
          : t(`A = ${exact(c5A)} is negative, so f̂ is not a maximum and no Gaussian q exists.`, `A = ${exact(c5A)} 为负，所以 f̂ 不是最大值点，不存在高斯 q。`),
        t(`A = ${exact(c5A1)} is positive, so f̂ is a maximum and q = N(f̂, ${exact(1 / c5A1)}).`, `A = ${exact(c5A1)} 为正，所以 f̂ 是最大值点，q = N(f̂, ${exact(1 / c5A1)})。`),
        c5Pos
          ? t(`A = ${exact(c5A)} is positive, but W is negative, so f̂ cannot be a maximum and no Gaussian q exists.`, `A = ${exact(c5A)} 为正，但 W 为负，所以 f̂ 不可能是最大值点，不存在高斯 q。`)
          : t(`A = ${exact(c5A)} is negative, so q = N(f̂, ${exact(1 / c5A)}) with a negative variance, which a Gaussian allows.`, `A = ${exact(c5A)} 为负，所以 q = N(f̂, ${exact(1 / c5A)})，高斯分布允许方差为负。`),
        t(`A = ${exact(c5.w)} is negative, so f̂ is not a maximum and no valid Gaussian q exists.`, `A = ${exact(c5.w)} 为负，所以 f̂ 不是最大值点，不存在合法的高斯 q。`)
      ],
      correct: 0,
      hint: t(
        'A maximum needs a negative curvature of the log posterior. Which two terms add up to that curvature, and what are their signs?',
        '最大值点要求对数后验的曲率为负。这个曲率由哪两项相加而成，它们各是什么符号？'
      ),
      explanation: t(
        `The curvature of the log posterior at f̂ is −A with A = 1/k + W = ${frac(1, c5.k)} + ${pf(c5.w)} = ${exact(c5A)} (GPML pdf p. 60 eq. 3.14: ∇∇Ψ = −W − K⁻¹). ${c5Pos ? `Here A is positive, so f̂ is a maximum and the variance of q is 1/A = ${exact(1 / c5A)}` : `Here A is negative, so f̂ is a minimum of the log posterior and 1/A = ${exact(1 / c5A)} cannot be a variance: no Gaussian q exists`}. A log-concave likelihood has W ≥ 0, so A > 0 and the maximum is unique (GPML pdf p. 60); a negative W, possible for a likelihood that is not log-concave, can make A negative, and Newton's method may then fail to converge (Lecture 6 p. 60). Flipping the sign of W would give A = ${exact(c5A1)}; using W alone gives ${exact(c5.w)}. Even when A > 0 the Gaussian can be a poor fit if the posterior is skewed or broader or narrower than the Hessian says (GPML pdf p. 61). This game does not assess multimodal posteriors in detail.`,
        `对数后验在 f̂ 处的曲率为 −A，A = 1/k + W = ${frac(1, c5.k)} + ${pf(c5.w)} = ${exact(c5A)}（GPML 第 60 页式 3.14：∇∇Ψ = −W − K⁻¹）。${c5Pos ? `这里 A 为正，所以 f̂ 是最大值点，q 的方差为 1/A = ${exact(1 / c5A)}` : `这里 A 为负，所以 f̂ 是对数后验的最小值点，1/A = ${exact(1 / c5A)} 不可能是方差：不存在高斯 q`}。对数凹的似然满足 W ≥ 0，因此 A > 0，最大值点唯一（GPML 第 60 页）；非对数凹的似然可能出现负的 W，使 A 为负，此时牛顿法也可能不收敛（第 6 讲第 60 页）。把 W 的符号弄反会得到 A = ${exact(c5A1)}；只用 W 会得到 ${exact(c5.w)}。即使 A > 0，若后验有偏、比海森矩阵所示更宽或更窄，高斯也可能拟合得很差（GPML 第 61 页）。本游戏不详细考查多峰后验。`
      )
    }),
    g.number({
      id: 'pred-mean',
      title: t('Predictive mean without K⁻¹', '不需要 K⁻¹ 的预测均值'),
      prompt: t(
        `Two training latent values f have the prior N(0, K) with K = ${mat([[num(c6.a), num(c6.b)], [num(c6.b), num(c6.a)]])}. At the posterior mode f̂ the slope of the log-likelihood is ∇log p(y | f̂) = (${num(c6.g1)}, ${num(c6.g2)}), written as a column vector. A test input x* has the covariances k* = (${num(c6.c1)}, ${num(c6.c2)}) between f* and the two training values, written as a column vector. What is the mean of f* under the Laplace approximation? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `两个训练潜在值 f 的先验为 N(0, K)，K = ${mat([[num(c6.a), num(c6.b)], [num(c6.b), num(c6.a)]])}。在后验最大值点 f̂ 处，对数似然的斜率为 ∇log p(y | f̂) = (${num(c6.g1)}, ${num(c6.g2)})，按列向量书写。测试输入 x* 与两个训练值之间的协方差为 k* = (${num(c6.c1)}, ${num(c6.c2)})，按列向量书写。在拉普拉斯近似下，f* 的均值是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('μ*', 'μ*'), answer: c6mu, tolerance: 0.006 }],
      hint: t(
        'The mean uses the mode f̂, which is not printed. What does the condition at the mode let you say about the printed slope vector?',
        '均值要用到最大值点 f̂，但题中没有给出。最大值点处的条件能让你对给出的斜率向量说些什么？'
      ),
      explanation: t(
        `The Laplace mean of f* is k*ᵀK⁻¹f̂ (GPML pdf p. 62 eq. 3.21). At the mode K⁻¹f̂ is exactly the likelihood slope (card 1), so the mean is k*ᵀ ∇log p(y | f̂) = ${pf(c6.c1)}·${pf(c6.g1)} + ${pf(c6.c2)}·${pf(c6.g2)} = ${exact(c6term1)} + ${c6term2 < 0 ? `(${exact(c6term2)})` : exact(c6term2)} = ${exact(c6mu)}. The matrix K is not needed. Using K times the slope would give ${exact(c6muK)}; using K⁻¹ times the slope ${exact(c6muKi)}. This game does not assess the predictive probability of a class.`,
        `f* 的拉普拉斯均值为 k*ᵀK⁻¹f̂（GPML 第 62 页式 3.21）。在最大值点处 K⁻¹f̂ 恰好等于似然的斜率（第 1 关），所以均值为 k*ᵀ ∇log p(y | f̂) = ${pf(c6.c1)}·${pf(c6.g1)} + ${pf(c6.c2)}·${pf(c6.g2)} = ${exact(c6term1)} + ${c6term2 < 0 ? `(${exact(c6term2)})` : exact(c6term2)} = ${exact(c6mu)}。矩阵 K 用不到。若用 K 乘斜率会得到 ${exact(c6muK)}；若用 K⁻¹ 乘斜率会得到 ${exact(c6muKi)}。本游戏不考查类别的预测概率。`
      ),
      audit: { kind: 'GP-18:pred-mean', params: { a: c6.a, b: c6.b, g1: c6.g1, g2: c6.g2, c1: c6.c1, c2: c6.c2 } }
    }),
    g.number({
      id: 'pred-var',
      title: t('Predictive variance of f*', 'f* 的预测方差'),
      prompt: t(
        `One training latent value f has the prior variance k = ${num(c7.k)}. A test latent value f* has the prior variance k** = ${num(c7.kss)} and the covariance k* = ${num(c7.c)} with f. At the posterior mode the likelihood has the curvature weight W = ${num(c7.w)}. What is the variance of the latent value f* (not of a noisy target y*) under the Laplace approximation? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个训练潜在值 f 的先验方差为 k = ${num(c7.k)}。测试潜在值 f* 的先验方差为 k** = ${num(c7.kss)}，与 f 的协方差为 k* = ${num(c7.c)}。在后验最大值点处，似然的曲率权重为 W = ${num(c7.w)}。在拉普拉斯近似下，潜在值 f* 的方差（不是带噪声的目标 y* 的方差）是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Var[f*]', 'f* 的方差'), answer: c7V, tolerance: 0.006 }],
      hint: t(
        'Replace the exact likelihood by its Gaussian approximation: the training value then behaves like an observation with its own noise variance. What is that noise variance in terms of W?',
        '用高斯近似代替精确似然：此时训练值就像一个带有自身噪声方差的观测。用 W 表示，这个噪声方差是多少？'
      ),
      explanation: t(
        `The latent variance under the Laplace approximation is Var[f*] = k** − k*ᵀ (K + W⁻¹)⁻¹ k* (GPML pdf p. 62 eq. 3.24). With one training value W⁻¹ = ${exact(1 / c7.w)} and K + W⁻¹ = ${c7.k} + ${exact(1 / c7.w)} = ${exact(c7M)}. Then k*²/(K + W⁻¹) = ${c7.c}²/${wrap(exact(c7M))} = ${exact(c7q)} and Var[f*] = ${c7.kss} − ${exact(c7q)} = ${exact(c7V)}. The variance given the exact f would be ${c7.kss} − ${c7.c}²/${c7.k} = ${exact(c7V0)}; the extra ${exact(c7V - c7V0)} is the uncertainty of f itself (eq. 3.23). This game does not assess the variance of a noisy target y*.`,
        `拉普拉斯近似下，f* 的方差为 k** − k*ᵀ (K + W⁻¹)⁻¹ k*（GPML 第 62 页式 3.24）。只有一个训练值时 W⁻¹ = ${exact(1 / c7.w)}，K + W⁻¹ = ${c7.k} + ${exact(1 / c7.w)} = ${exact(c7M)}。于是 k*²/(K + W⁻¹) = ${c7.c}²/${wrap(exact(c7M))} = ${exact(c7q)}，f* 的方差 = ${c7.kss} − ${exact(c7q)} = ${exact(c7V)}。若 f 已精确已知，方差为 ${c7.kss} − ${c7.c}²/${c7.k} = ${exact(c7V0)}；多出的 ${exact(c7V - c7V0)} 来自 f 本身的不确定性（式 3.23）。本游戏不考查带噪声目标 y* 的方差。`
      ),
      audit: { kind: 'GP-18:pred-var', params: { k: c7.k, kss: c7.kss, c: c7.c, w: c7.w } }
    }),
    g.number({
      id: 'log-det',
      title: t('The two determinant terms', '两个行列式项'),
      prompt: t(
        `The Laplace log marginal likelihood contains the terms −(1/2) log |K| − (1/2) log |K⁻¹ + W|. Together they equal −(1/2) log P. Here K = ${mat([[num(c8.a), num(c8.b)], [num(c8.b), num(c8.a)]])} and W = diag(${num(c8.w1)}, ${num(c8.w2)}), the diagonal matrix with these two entries. What is P? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `拉普拉斯对数边际似然含有两项 −(1/2) log |K| − (1/2) log |K⁻¹ + W|，它们合起来等于 −(1/2) log P。这里 K = ${mat([[num(c8.a), num(c8.b)], [num(c8.b), num(c8.a)]])}，W 是对角矩阵，对角元素依次为 ${num(c8.w1)} 和 ${num(c8.w2)}。P 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('P', 'P'), answer: c8P, tolerance: 0.006 }],
      hint: t(
        'You may find the two determinants separately and multiply, or combine the two matrices first. Either way, which matrix inverse do you need?',
        '可以分别求两个行列式再相乘，也可以先把两个矩阵合并。无论哪种做法，你需要求哪个矩阵的逆？'
      ),
      explanation: t(
        `Since −(1/2) log |K| − (1/2) log |A| = −(1/2) log (|K|·|A|) with A = K⁻¹ + W (Lecture 6 p. 59), P = |K|·|A|. |K| = ${c8.a}² − ${c8.b}² = ${c8D}. K⁻¹ = (1/${c8D})·[[${c8.a}, ${par(-c8.b)}], [${par(-c8.b)}, ${c8.a}]], so A = ${mat([[exact(c8.a / c8D + c8.w1), exact(-c8.b / c8D)], [exact(-c8.b / c8D), exact(c8.a / c8D + c8.w2)]])} and |A| = ${exact(c8detA)}. Then P = ${c8D}·${pf(c8detA)} = ${exact(c8P)}. A shortcut for the same number: K(K⁻¹ + W) = I + K W, so P = (1 + ${c8.a}·${c8.w1})(1 + ${c8.a}·${c8.w2}) − ${c8.b}²·${c8.w1}·${c8.w2} = ${exact(c8P)}. Using |K| alone gives ${c8D}; using |A| alone ${exact(c8detA)}. This game does not assess the data-fit term or optimising the hyperparameters.`,
        `因为 −(1/2) log |K| − (1/2) log |A| = −(1/2) log (|K|·|A|)，其中 A = K⁻¹ + W（第 6 讲第 59 页），所以 P = |K|·|A|。|K| = ${c8.a}² − ${c8.b}² = ${c8D}。K⁻¹ = (1/${c8D})·[[${c8.a}, ${par(-c8.b)}], [${par(-c8.b)}, ${c8.a}]]，于是 A = ${mat([[exact(c8.a / c8D + c8.w1), exact(-c8.b / c8D)], [exact(-c8.b / c8D), exact(c8.a / c8D + c8.w2)]])}，|A| = ${exact(c8detA)}。所以 P = ${c8D}·${pf(c8detA)} = ${exact(c8P)}。同一个数的捷径：K(K⁻¹ + W) = I + K W，所以 P = (1 + ${c8.a}·${c8.w1})(1 + ${c8.a}·${c8.w2}) − ${c8.b}²·${c8.w1}·${c8.w2} = ${exact(c8P)}。只用 |K| 会得到 ${c8D}；只用 |A| 会得到 ${exact(c8detA)}。本游戏不考查数据拟合项，也不考查超参数的优化。`
      ),
      audit: { kind: 'GP-18:log-det', params: { a: c8.a, b: c8.b, w1: c8.w1, w2: c8.w2 } }
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: two coupled points', '挑战：两个相关的点'),
      prompt: t(
        `Two training points have the labels y = (${num(c9.y1)}, ${num(c9.y2)}) (each is −1 or 1) and the logistic likelihood p(yᵢ | fᵢ) = σ(yᵢ·fᵢ) with σ(z) = 1/(1 + exp(−z)). With tᵢ = (yᵢ + 1)/2 and πᵢ = σ(fᵢ), the slope is ∂ log p(yᵢ | fᵢ)/∂fᵢ = tᵢ − πᵢ and the curvature weight is Wᵢᵢ = πᵢ(1 − πᵢ). The prior is f = (f₁, f₂) ~ N(0, K) with K = ${mat([[num(c9.a), num(c9.b)], [num(c9.b), num(c9.a)]])}. Newton's method for the posterior mode starts at f = (0, 0). What is the first component f₁ after one Newton step? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `两个训练点的标签为 y = (${num(c9.y1)}, ${num(c9.y2)})（各取 −1 或 1），逻辑斯蒂似然为 p(yᵢ | fᵢ) = σ(yᵢ·fᵢ)，σ(z) = 1/(1 + exp(−z))。令 tᵢ = (yᵢ + 1)/2，πᵢ = σ(fᵢ)，则斜率为 ∂ log p(yᵢ | fᵢ)/∂fᵢ = tᵢ − πᵢ，曲率权重为 Wᵢᵢ = πᵢ(1 − πᵢ)。先验为 f = (f₁, f₂) ~ N(0, K)，K = ${mat([[num(c9.a), num(c9.b)], [num(c9.b), num(c9.a)]])}。用牛顿法求后验最大值点，从 f = (0, 0) 出发。走一步牛顿法后，第一个分量 f₁ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('first component of f after the step', '迭代后 f 的第一个分量'), answer: c9f1, tolerance: 0.006 }],
      hint: t(
        'Evaluate σ at the starting point first. Then set up the Newton step for the two coupled values and solve it.',
        '先在起点处求出 σ 的值，再写出两个相关值的牛顿步并求解。'
      ),
      explanation: t(
        `At f = (0, 0): πᵢ = 1/2 for both points, so the slopes are (tᵢ − 1/2) = (${exact(c9.y1 / 2)}, ${exact(c9.y2 / 2)}) and W = diag(1/4, 1/4) (GPML pdf p. 61 eq. 3.15). Newton's step from 0 is f₁ = (K⁻¹ + W)⁻¹ (W·0 + slope) (eq. 3.18). The slope vector is a multiple of ${c9.y1 === c9.y2 ? '(1, 1)' : '(1, −1)'}, an eigenvector of K with eigenvalue λ = ${c9.a} ${c9.y1 === c9.y2 ? '+' : '−'} ${par(c9.b)} = ${exact(c9lam)}. On an eigenvector, (K⁻¹ + 1/4)⁻¹ multiplies by λ/(1 + λ/4) = ${exact(c9lam)}/(1 + ${exact(c9lam / 4)}) = ${exact(c9h(c9lam))}. So f = ${pf(c9.y1 / 2)}·${pf(c9h(c9lam))}·${c9.y1 === c9.y2 ? '(1, 1)' : '(1, −1)'} and its first component is ${exact(c9f1)}. Ignoring the off-diagonal entries of K would give ${exact(c9r1)}; forgetting the prior, slope/W, would give ${exact(2 * c9.y1)}. This game does not assess later iterations or the predictive class probability.`,
        `在 f = (0, 0) 处：两个点的 πᵢ 都是 1/2，所以斜率 (tᵢ − 1/2) = (${exact(c9.y1 / 2)}, ${exact(c9.y2 / 2)})，W 是对角矩阵，对角元素均为 1/4（GPML 第 61 页式 3.15）。从 0 出发的牛顿步为 f₁ = (K⁻¹ + W)⁻¹ (W·0 + 斜率)（式 3.18）。斜率向量是 ${c9.y1 === c9.y2 ? '(1, 1)' : '(1, −1)'} 的倍数，而 ${c9.y1 === c9.y2 ? '(1, 1)' : '(1, −1)'} 是 K 的特征向量，特征值 λ = ${c9.a} ${c9.y1 === c9.y2 ? '+' : '−'} ${par(c9.b)} = ${exact(c9lam)}。在特征向量上，(K⁻¹ + 1/4)⁻¹ 相当于乘以 λ/(1 + λ/4) = ${exact(c9lam)}/(1 + ${exact(c9lam / 4)}) = ${exact(c9h(c9lam))}。所以 f = ${pf(c9.y1 / 2)}·${pf(c9h(c9lam))}·${c9.y1 === c9.y2 ? '(1, 1)' : '(1, −1)'}，其第一个分量为 ${exact(c9f1)}。忽略 K 的非对角元素会得到 ${exact(c9r1)}；漏掉先验，即 斜率/W，会得到 ${exact(2 * c9.y1)}。本游戏不考查之后的迭代，也不考查类别预测概率。`
      ),
      audit: { kind: 'GP-18:challenge', params: { a: c9.a, b: c9.b, y1: c9.y1, y2: c9.y2 } }
    })
  ];
};
