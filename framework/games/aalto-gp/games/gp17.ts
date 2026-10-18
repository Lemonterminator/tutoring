import type { CardGenerator } from '../../types';
import { exact, makeGpDeck, num, par, type Text } from '../support';

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

export const gp17: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-17');
  warm(g);

  // Card 1: range-check
  const f1 = g.pick([1.5, 2, 2.5, 3, 3.5, 4, 5]);
  const sigma1 = (1 / (1 + Math.exp(-f1))).toFixed(2);
  const exp1 = Math.exp(f1).toFixed(2);
  const f1sq = f1 * f1;

  // Card 2: odds
  const oddsPairs = [[3, 1], [4, 1], [9, 1], [1, 3], [1, 4], [3, 2], [2, 3]] as const;
  const [a2, b2] = oddsPairs[g.random(0, oddsPairs.length - 1)];
  const pi2 = a2 / (a2 + b2);
  const odds2 = b2 === 1 ? String(a2) : `${a2}/${b2}`;
  const bTimes2 = b2 === 1 ? '' : `·${b2}`;
  const aTimes2 = a2 === 1 ? '(1 − π)' : `(1 − π)·${a2}`;

  // Card 3: flip-label
  const c3 = g.pick([1, 2]);
  const p3 = g.pick([0.6, 0.7, 0.8, 0.9]);
  const y3 = g.pick([-1, 1]);
  const f3 = g.pick([-c3, c3]);
  const yf3 = y3 * f3;
  const T3 = yf3 > 0 ? p3 : Number((1 - p3).toFixed(6));

  // Card 4: why-approx
  const s4 = g.pick([0.1, 0.25, 0.5, 1, 2, 4]);

  // Card 5: weight-gauss
  const s5 = g.pick([0.5, 0.25, 2, 4, 5, 8, 10]);
  const yfPairs5 = [[2, -1], [2, 0], [3, -1], [3, 0], [3, 1], [4, -1], [4, 0], [4, 1]] as const;
  const [y5, f5] = yfPairs5[g.random(0, yfPairs5.length - 1)];
  const T5 = 1 / s5;

  // Card 6: chord-gap
  const x6 = g.pick([-4, -2, 0, 2]);
  const y6 = x6 + 4;
  const alphaChoice = g.pick([0, 1]);
  const alpha6 = alphaChoice === 0 ? 0.25 : 0.75;
  const m6 = alphaChoice === 0 ? x6 + 3 : x6 + 1;
  const gx6 = g.random(-8, -1);
  const gy6 = retry(() => g.random(-8, -1), v => v !== gx6);
  const ch6 = alpha6 * gx6 + (1 - alpha6) * gy6;
  const gm6 = retry(() => g.random(-8, -1), v => v !== ch6 && v !== 2 * ch6);
  const T6 = gm6 - ch6;

  // Card 7: one-pair
  const x7 = g.pick([-4, -2, 0, 2]);
  const y7 = x7 + 4;
  const m7 = x7 + 2;
  const gx7 = g.random(-8, -1);
  const gy7 = g.random(-8, -1);
  const C7 = (gx7 + gy7) / 2;
  const gm7 = retry(() => g.random(-8, -1), v => v !== C7);
  const isViolated = gm7 < C7;

  // Card 8: tail-growth
  const tailPairs = [[2, 3], [2, 4], [2, 5], [2, 6], [2, 8], [3, 6], [3, 9], [4, 6], [4, 8], [4, 10], [4, 12], [6, 9]] as const;
  const [a8, b8] = tailPairs[g.random(0, tailPairs.length - 1)];
  const T8 = (b8 / a8) * (b8 / a8);
  const sq8 = Number.isInteger(b8 / a8) ? `${b8 / a8}²` : `(${exact(b8 / a8)})²`;
  const ratio8 = exact(b8 / a8) === `${b8}/${a8}` ? `${b8}/${a8}` : `${b8}/${a8} = ${exact(b8 / a8)}`;

  // Card 9: challenge
  const pPairs = [[0.6, 0.8], [0.7, 0.8], [0.6, 0.9], [0.7, 0.9], [0.8, 0.9]] as const;
  const [p1_9, p2_9] = pPairs[g.random(0, pPairs.length - 1)];
  const fVals = [-2, -1, 1, 2];
  const yVals = [-1, 1];
  const samplePoint = () => ({ f: fVals[g.random(0, 3)], y: yVals[g.random(0, 1)] });
  const ch9 = retry(() => {
    const p1 = samplePoint();
    const p2 = samplePoint();
    const p3 = samplePoint();
    const z1 = p1.y * p1.f;
    const z2 = p2.y * p2.f;
    const z3 = p3.y * p3.f;
    const s = (z: number) => {
      const az = Math.abs(z);
      const base = az === 1 ? p1_9 : p2_9;
      return z > 0 ? base : 1 - base;
    };
    const T = s(z1) * s(z2) * s(z3);
    return { p1, p2, p3, z1, z2, z3, T };
  }, v => {
    const hasPos = v.z1 > 0 || v.z2 > 0 || v.z3 > 0;
    const hasNeg = v.z1 < 0 || v.z2 < 0 || v.z3 < 0;
    const absF = [Math.abs(v.p1.f), Math.abs(v.p2.f), Math.abs(v.p3.f)];
    const has1 = absF.includes(1);
    const has2 = absF.includes(2);
    if (!(hasPos && hasNeg && has1 && has2 && v.T >= 0.05)) return false;
    const sv = (z: number) => { const base = Math.abs(z) === 1 ? p1_9 : p2_9; return z > 0 ? base : 1 - base; };
    const zs = [v.z1, v.z2, v.z3], fs = [v.p1.f, v.p2.f, v.p3.f];
    const wrongRoutes = [
      fs.reduce((a, f) => a * sv(f), 1),
      zs.reduce((a, z) => a * sv(Math.abs(z)), 1),
      zs.reduce((a, z) => a * sv(-z), 1),
      1 - v.T,
      zs.reduce((a, z) => a + sv(z), 0) / 3,
      zs.reduce((a, z) => a + sv(z), 0)
    ];
    return wrongRoutes.every(w => Math.abs(w - v.T) >= 0.02);
  });
  const { p1: pt1, p2: pt2, p3: pt3, z1: z1_9, z2: z2_9, z3: z3_9, T: T9 } = ch9;
  const sVal = (z: number) => {
    const az = Math.abs(z);
    const base = az === 1 ? p1_9 : p2_9;
    return z > 0 ? base : 1 - base;
  };
  const s1_9 = sVal(z1_9);
  const s2_9 = sVal(z2_9);
  const s3_9 = sVal(z3_9);

  return [
    g.choice({
      id: 'range-check',
      title: t('A valid class probability', '合法的类别概率'),
      prompt: t(
        `A Gaussian process gives the latent value f = ${num(f1)} at a test input. A response function must turn every real latent value into a valid class probability π, that is a number in (0, 1). Which of these maps does that for every real f? The numbers show what each map gives at f = ${num(f1)}.`,
        `高斯过程在某个测试输入处给出潜变量值 f = ${num(f1)}。响应函数必须把任意实数潜变量都变成合法的类别概率 π，也就是 (0, 1) 中的数。下列哪个映射对每个实数 f 都做到这一点？数字给出的是各映射在 f = ${num(f1)} 处的取值。`
      ),
      options: [
        t(`π = σ(f) = ${sigma1}: the logistic function`, `π = σ(f) = ${sigma1}：逻辑斯蒂函数`),
        t(`π = f = ${num(f1)}: the latent value used as the probability`, `π = f = ${num(f1)}：直接把潜变量当作概率`),
        t(`π = f² = ${num(f1sq)}: the square of the latent value`, `π = f² = ${num(f1sq)}：潜变量的平方`),
        t(`π = exp(f) = ${exp1}: the exponential, always positive`, `π = exp(f) = ${exp1}：指数函数，恒为正`)
      ],
      correct: 0,
      hint: t(
        'A probability must stay between 0 and 1 for every latent value, also for very large and very small ones. Try f = 10 and f = −10 in each map.',
        '对每个潜变量值，包括很大和很小的值，概率都必须保持在 0 和 1 之间。把 f = 10 和 f = −10 代入每个映射试试。'
      ),
      explanation: t(
        `A response function has to squash the whole real line into the probability range (GPML pdf p. 53). The logistic function σ(z) = 1/(1 + exp(−z)) does: exp(−z) > 0, so the denominator exceeds 1 and σ(z) is between 0 and 1 for every real z, here σ(${num(f1)}) = ${sigma1}. The identity gives ${num(f1)} and the square gives ${num(f1sq)}, both above 1. The exponential is positive but exp(${num(f1)}) = ${exp1} is above 1 and grows without bound for larger f. The cumulative normal Φ would also work (probit); a GP prior on f is unbounded, which is why regressing the 0/1 labels directly, p(y = +1 | x) = f(x), can give impossible 'probabilities' (Lecture 6 p. 6).`,
        `响应函数必须把整条实数轴压进概率的取值范围（GPML pdf 第 53 页）。逻辑斯蒂函数 σ(z) = 1/(1 + exp(−z)) 做到了：exp(−z) > 0，所以分母大于 1，对每个实数 z，σ(z) 都在 0 与 1 之间，这里 σ(${num(f1)}) = ${sigma1}。恒等映射给出 ${num(f1)}，平方给出 ${num(f1sq)}，都大于 1。指数函数虽为正，但 exp(${num(f1)}) = ${exp1} 已大于 1，f 越大越没有上界。标准正态的累积分布函数 Φ 同样可用（概率单位模型）；高斯过程先验下的 f 没有界，所以直接把 0/1 标签当作回归目标、令 p(y = +1 | x) = f(x)，可能得到不可能的概率（第 6 讲第 6 页）。`
      )
    }),
    g.number({
      id: 'odds',
      title: t('From odds to probability', '从几率到概率'),
      prompt: t(
        `In the logistic model the latent value is the log odds: f = log[ p(y = +1) / p(y = −1) ] (GPML pdf p. 55). At a test input the odds in favour of y = +1 are ${a2} to ${b2}, that is p(y = +1) / p(y = −1) = ${odds2}. What is the class probability p(y = +1)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在逻辑斯蒂模型中，潜变量是对数几率：f = log[ p(y = +1) / p(y = −1) ]（GPML pdf 第 55 页）。在某个测试输入处，支持 y = +1 的几率为 ${a2} 比 ${b2}，即 p(y = +1) / p(y = −1) = ${odds2}。类别概率 p(y = +1) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Class probability p(y = +1)', '类别概率 p(y = +1)'), answer: pi2, tolerance: 0.006 }],
      hint: t(
        'The two class probabilities add up to 1. Call p(y = +1) the unknown and write p(y = −1) with it.',
        '两个类别的概率之和为 1。把 p(y = +1) 当作未知数，用它来表示 p(y = −1)。'
      ),
      explanation: t(
        `Let π = p(y = +1); then p(y = −1) = 1 − π, and the odds are π/(1 − π) = ${odds2}. Solving, π${bTimes2} = ${aTimes2}, so π·(${a2} + ${b2}) = ${a2} and π = ${a2}/(${a2} + ${b2}) = ${exact(pi2)}. Check: 1 − π = ${exact(1 - pi2)}, and ${exact(pi2)} divided by ${exact(1 - pi2)} is ${odds2}. The odds ${odds2} themselves are not a probability (they can exceed 1); the probability of the other class would be ${exact(1 - pi2)}. The log odds f = log(${odds2}) can take any real value, which is why the logit is the canonical link for binary data (GPML pdf p. 55).`,
        `设 π = p(y = +1)，则 p(y = −1) = 1 − π，几率为 π/(1 − π) = ${odds2}。解得 π${bTimes2} = ${aTimes2}，即 π·(${a2} + ${b2}) = ${a2}，所以 π = ${a2}/(${a2} + ${b2}) = ${exact(pi2)}。检验：1 − π = ${exact(1 - pi2)}，${exact(pi2)} 除以 ${exact(1 - pi2)} 等于 ${odds2}。几率 ${odds2} 本身不是概率（它可以大于 1）；另一个类别的概率是 ${exact(1 - pi2)}。对数几率 f = log(${odds2}) 可以取任意实数，所以对数几率变换是二分类数据的标准链接函数（GPML pdf 第 55 页）。`
      ),
      audit: { kind: 'GP-17:odds', params: { a: a2, b: b2 } }
    }),
    g.number({
      id: 'flip-label',
      title: t('The likelihood of a label', '标签的似然'),
      prompt: t(
        `A symmetric sigmoid σ, with σ(−z) = 1 − σ(z), has σ(${c3}) = ${num(p3)}. For a label y ∈ {−1, +1} and a latent value f the likelihood is p(y | f) = σ(y·f). A data point has y = ${num(y3)} and f = ${num(f3)}. What is p(y | f)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `对称的压缩函数 σ 满足 σ(−z) = 1 − σ(z)，且 σ(${c3}) = ${num(p3)}。对标签 y ∈ {−1, +1} 和潜变量值 f，似然为 p(y | f) = σ(y·f)。某个数据点的 y = ${num(y3)}，f = ${num(f3)}。p(y | f) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Likelihood p(y | f)', '似然 p(y | f)'), answer: T3, tolerance: 0.006 }],
      hint: t(
        `Look at the product y·f. Which of σ(${c3}) and σ(−${c3}) does it ask for?`,
        `看乘积 y·f。它要的是 σ(${c3}) 还是 σ(−${c3})？`
      ),
      explanation: t(
        `The likelihood is σ(y·f) = σ(${num(y3)}·${par(f3)}) = σ(${num(yf3)}). ${yf3 > 0 ? `Here y·f = ${c3} is positive, so the table value is read directly: σ(${c3}) = ${num(p3)}, as given.` : `Here y·f = −${c3} is negative, so σ(−${c3}) = 1 − σ(${c3}) = 1 − ${num(p3)} = ${num(1 - p3)}.`} Using the other value, ${num(1 - T3)}, would be the likelihood of the opposite label. The form σ(y·f) is the compact way of writing σ(f) for y = +1 and 1 − σ(f) for y = −1 (GPML pdf p. 55, eq. 3.5).`,
        `似然为 σ(y·f) = σ(${num(y3)}·${par(f3)}) = σ(${num(yf3)})。${yf3 > 0 ? `这里 y·f = ${c3} 为正，直接查表：σ(${c3}) = ${num(p3)}，题目已给出。` : `这里 y·f = −${c3} 为负，所以 σ(−${c3}) = 1 − σ(${c3}) = 1 − ${num(p3)} = ${num(1 - p3)}。`}另一个值 ${num(1 - T3)} 是相反标签的似然。σ(y·f) 是紧凑的写法：y = +1 时为 σ(f)，y = −1 时为 1 − σ(f)（GPML pdf 第 55 页，式 3.5）。`
      ),
      audit: { kind: 'GP-17:flip-label', params: { c: c3, p: p3, y: y3, f: f3 } }
    }),
    g.choice({
      id: 'why-approx',
      title: t('When is the posterior still Gaussian?', '后验何时仍是高斯的？'),
      prompt: t(
        'A Gaussian process prior is placed on the latent function f. For which observation model is the posterior over f again a Gaussian process, with a closed form as in GP regression?',
        '在潜函数 f 上放置高斯过程先验。对于哪一种观测模型，f 的后验仍是高斯过程，并且像高斯过程回归那样有闭式解？'
      ),
      options: [
        t(`Real-valued y = f(x) + ε with Gaussian noise, σₙ² = ${num(s4)}`, `实值 y = f(x) + ε，高斯噪声，σₙ² = ${num(s4)}`),
        t('Class labels y ∈ {−1, +1} with the logistic likelihood p(y | f) = σ(y·f)', '类别标签 y ∈ {−1, +1}，逻辑斯蒂似然 p(y | f) = σ(y·f)'),
        t('Class labels y ∈ {−1, +1} with the probit likelihood p(y | f) = Φ(y·f)', '类别标签 y ∈ {−1, +1}，概率单位似然 p(y | f) = Φ(y·f)'),
        t('Real-valued y = f(x) + ε with heavy-tailed noise ε, not Gaussian', '实值 y = f(x) + ε，噪声 ε 是重尾分布，而不是高斯分布')
      ],
      correct: 0,
      hint: t(
        'Look at the likelihood p(y | f) as a function of f. Is it a Gaussian shape in each model? What does the product of two Gaussian shapes look like?',
        '把似然 p(y | f) 看作 f 的函数。每个模型里它是不是高斯形状？两个高斯形状的乘积是什么样子？'
      ),
      explanation: t(
        `With Gaussian noise the likelihood N(y | f, σₙ² = ${num(s4)}) is itself a Gaussian shape in f, so prior times likelihood is Gaussian and the posterior is again a Gaussian process (GPML pdf p. 52, Lecture 6 p. 8). The logistic σ(y·f) and the probit Φ(y·f) are not Gaussian shapes, and neither is a heavy-tailed noise density (Lecture 6 p. 10): with a non-Gaussian likelihood the posterior over f is not Gaussian, the integral in the predictive distribution is intractable, and the posterior has to be approximated, for example by the Laplace approximation or expectation propagation (GPML pdf pp. 52, 59). This game does not assess how those approximations are computed.`,
        `高斯噪声下，似然 N(y | f, σₙ² = ${num(s4)}) 作为 f 的函数本身就是高斯形状，先验乘似然仍是高斯，后验也就仍是高斯过程（GPML pdf 第 52 页，第 6 讲第 8 页）。逻辑斯蒂 σ(y·f) 和概率单位 Φ(y·f) 都不是高斯形状，重尾噪声的密度也不是（第 6 讲第 10 页）：似然非高斯时，f 的后验不是高斯，预测分布中的积分无法解析求出，后验只能近似，例如拉普拉斯近似或期望传播（GPML pdf 第 52、59 页）。本游戏不考查这些近似如何计算。`
      )
    }),
    g.number({
      id: 'weight-gauss',
      title: t('The curvature weight of a Gaussian likelihood', '高斯似然的曲率权重'),
      prompt: t(
        `A regression point has the Gaussian likelihood p(yᵢ | fᵢ) = N(yᵢ | fᵢ, σₙ²) with σₙ² = ${num(s5)}; here yᵢ = ${num(y5)} and fᵢ = ${num(f5)}. Its log-likelihood is log p(yᵢ | fᵢ) = −(yᵢ − fᵢ)²/(2σₙ²) + const. The weight Wᵢᵢ = −∂² log p(yᵢ | fᵢ)/∂fᵢ² is the diagonal entry of W in the Hessian K⁻¹ + W of the negative log-posterior (GPML pdf p. 60). What is Wᵢᵢ? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个回归数据点的高斯似然为 p(yᵢ | fᵢ) = N(yᵢ | fᵢ, σₙ²)，其中 σₙ² = ${num(s5)}；这里 yᵢ = ${num(y5)}，fᵢ = ${num(f5)}。其对数似然为 log p(yᵢ | fᵢ) = −(yᵢ − fᵢ)²/(2σₙ²) + 常数。权重 Wᵢᵢ = −∂² log p(yᵢ | fᵢ)/∂fᵢ² 是负对数后验的海森矩阵 K⁻¹ + W 中 W 的对角元素（GPML pdf 第 60 页）。Wᵢᵢ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Curvature weight Wᵢᵢ', '曲率权重 Wᵢᵢ'), answer: T5, tolerance: 0.006 }],
      hint: t(
        'Differentiate the log-likelihood twice with respect to fᵢ. Which of yᵢ and fᵢ is still left in the result?',
        '把对数似然对 fᵢ 求两次导数。结果里还剩下 yᵢ 和 fᵢ 中的哪一个？'
      ),
      explanation: t(
        `Differentiating −(yᵢ − fᵢ)²/(2σₙ²) once with respect to fᵢ gives (yᵢ − fᵢ)/σₙ² = (${num(y5)} − ${par(f5)})/${num(s5)} = ${exact((y5 - f5) / s5)}; differentiating again gives −1/σₙ² = −${exact(T5)}. So Wᵢᵢ = −(−${exact(T5)}) = ${exact(T5)}. The result does not depend on yᵢ or fᵢ: the log-likelihood is a downward parabola in fᵢ, so it is concave, the likelihood is log-concave, and Wᵢᵢ ≥ 0 as GPML pdf p. 60 states for every log-concave likelihood. The first derivative ${exact((y5 - f5) / s5)} is the slope of the parabola at fᵢ, not its curvature.`,
        `把 −(yᵢ − fᵢ)²/(2σₙ²) 对 fᵢ 求一次导数，得 (yᵢ − fᵢ)/σₙ² = (${num(y5)} − ${par(f5)})/${num(s5)} = ${exact((y5 - f5) / s5)}；再求一次导数，得 −1/σₙ² = −${exact(T5)}。所以 Wᵢᵢ = −(−${exact(T5)}) = ${exact(T5)}。结果与 yᵢ、fᵢ 无关：对数似然是 fᵢ 的开口向下的抛物线，因此是凹的，似然是对数凹的，并且如 GPML pdf 第 60 页所述，对数凹的似然都有 Wᵢᵢ ≥ 0。一阶导数 ${exact((y5 - f5) / s5)} 是抛物线在 fᵢ 处的斜率，不是曲率。`
      ),
      audit: { kind: 'GP-17:weight-gauss', params: { s: s5, y: y5, f: f5 } }
    }),
    g.number({
      id: 'chord-gap',
      title: t('Testing the concavity inequality', '检验凹性不等式'),
      prompt: t(
        `A function h is concave if h(αx + (1 − α)y) ≥ α·h(x) + (1 − α)·h(y) for all x, y and every α between 0 and 1 (Lecture 6 p. 24). A candidate log-likelihood h(f) = log p(y | f) has h(${num(x6)}) = ${num(gx6)}, h(${num(y6)}) = ${num(gy6)} and h(${num(m6)}) = ${num(gm6)}, where ${num(m6)} = α·${par(x6)} + (1 − α)·${par(y6)} with α = ${alpha6}. By how much is the left side h(αx + (1 − α)y) larger than the right side α·h(x) + (1 − α)·h(y)? A negative number means it is smaller. Give an integer, a fraction or a decimal rounded to 2 places.`,
        `若对所有 x、y 以及 0 与 1 之间的每个 α 都有 h(αx + (1 − α)y) ≥ α·h(x) + (1 − α)·h(y)，则函数 h 是凹的（第 6 讲第 24 页）。某个候选对数似然 h(f) = log p(y | f) 满足 h(${num(x6)}) = ${num(gx6)}，h(${num(y6)}) = ${num(gy6)}，h(${num(m6)}) = ${num(gm6)}，其中 ${num(m6)} = α·${par(x6)} + (1 − α)·${par(y6)}，α = ${alpha6}。左边 h(αx + (1 − α)y) 比右边 α·h(x) + (1 − α)·h(y) 大多少？负数表示左边更小。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Left side minus right side', '左边减右边'), answer: T6, tolerance: 0.006 }],
      hint: t(
        `First compute the right side: a weighted average of the two end values, with weight α on h(${num(x6)}). Then compare it with the middle value.`,
        `先算右边：两个端点值的加权平均，h(${num(x6)}) 的权重为 α。再与中间那个值比较。`
      ),
      explanation: t(
        `With α = ${alpha6} = ${exact(alpha6)}, the right side is α·h(x) + (1 − α)·h(y) = (${exact(alpha6)})·${par(gx6)} + (${exact(1 - alpha6)})·${par(gy6)} = ${exact(ch6)}. The left side is h(${num(m6)}) = ${num(gm6)}. The difference is ${num(gm6)} − ${ch6 < 0 ? `(${exact(ch6)})` : exact(ch6)} = ${exact(T6)}. ${T6 > 0 ? 'The difference is not negative, so this pair does not break the inequality' : 'The difference is negative: the curve lies below the chord, so the inequality fails for this pair'}. Swapping the two weights would give a right side of ${exact((1 - alpha6) * gx6 + alpha6 * gy6)} and an answer of ${exact(gm6 - ((1 - alpha6) * gx6 + alpha6 * gy6))}; averaging with equal weights would give ${exact(gm6 - (gx6 + gy6) / 2)}.`,
        `取 α = ${alpha6} = ${exact(alpha6)}，右边为 α·h(x) + (1 − α)·h(y) = (${exact(alpha6)})·${par(gx6)} + (${exact(1 - alpha6)})·${par(gy6)} = ${exact(ch6)}。左边为 h(${num(m6)}) = ${num(gm6)}。差为 ${num(gm6)} − ${ch6 < 0 ? `(${exact(ch6)})` : exact(ch6)} = ${exact(T6)}。${T6 > 0 ? '差不为负，所以这一对点不违反不等式' : '差为负：曲线在弦的下方，这一对点违反了不等式'}。若把两个权重对调，右边为 ${exact((1 - alpha6) * gx6 + alpha6 * gy6)}，答案变成 ${exact(gm6 - ((1 - alpha6) * gx6 + alpha6 * gy6))}；若用相等的权重取平均，则得到 ${exact(gm6 - (gx6 + gy6) / 2)}。`
      ),
      audit: { kind: 'GP-17:chord-gap', params: { x: x6, y: y6, alpha: alpha6, m: m6, gx: gx6, gy: gy6, gm: gm6 } }
    }),
    g.choice({
      id: 'one-pair',
      title: t('One check is not a proof', '检查一次不是证明'),
      prompt: t(
        `A student checks whether a candidate log-likelihood h(f) = log p(y | f) is concave. She evaluates it at one pair of points and their midpoint: h(${num(x7)}) = ${num(gx7)}, h(${num(m7)}) = ${num(gm7)}, h(${num(y7)}) = ${num(gy7)}, where ${num(m7)} = (${num(x7)} + ${par(y7)})/2. What can she conclude about h from this single check?`,
        `一位同学检查某个候选对数似然 h(f) = log p(y | f) 是否是凹函数。她在一对点及其中点处求值：h(${num(x7)}) = ${num(gx7)}，h(${num(m7)}) = ${num(gm7)}，h(${num(y7)}) = ${num(gy7)}，其中 ${num(m7)} = (${num(x7)} + ${par(y7)})/2。仅凭这一次检查，她能对 h 得出什么结论？`
      ),
      options: isViolated ? [
        t(`Not log-concave: h(${num(m7)}) = ${num(gm7)} lies below the chord value ${num(C7)}, so the inequality fails.`, `不是对数凹：h(${num(m7)}) = ${num(gm7)} 低于弦上的值 ${num(C7)}，不等式不成立。`),
        t('Log-concave: all three values are negative, as every log-probability is.', '是对数凹：三个值都是负数，因为每个对数概率都是负数，所以一定是凹函数。'),
        t('Cannot tell yet: a single failing pair is only an exception, since concavity has to hold on average.', '还不能判断：只有一个点对不满足只是例外，凹性只要求在平均意义上成立，不必处处成立。'),
        t('Log-concave: the likelihood p(y | f) is positive everywhere, and positive functions are concave.', '是对数凹：似然 p(y | f) 处处为正，而正的函数都是凹的。')
      ] : [
        t('No conclusion yet: it holds at this pair, but it must hold for every x, y and α.', '还不能判断：这一对点上成立，但必须对所有 x、y 和 α 都成立。'),
        t(`Log-concave: h(${num(m7)}) = ${num(gm7)} is not below the chord value ${num(C7)}, so h is concave.`, `是对数凹：h(${num(m7)}) = ${num(gm7)} 不低于弦上的值 ${num(C7)}，所以 h 是凹的。`),
        t('Not log-concave: all three values are negative, and a concave function can never take negative values.', '不是对数凹：三个值都是负数，而凹函数永远不可能取负值。'),
        t('Log-concave only if the likelihood p(y | f) itself is also concave.', '只有当似然 p(y | f) 本身也是凹函数时，才是对数凹。')
      ],
      correct: 0,
      hint: t(
        `Compare h(${num(m7)}) with the average of h(${num(x7)}) and h(${num(y7)}). Then ask: would one pair be enough to prove concavity, and would one pair be enough to disprove it?`,
        `把 h(${num(m7)}) 与 h(${num(x7)}) 和 h(${num(y7)}) 的平均值比较。然后想一想：一对点够不够证明凹性？一对点够不够否定凹性？`
      ),
      explanation: t(
        `At α = 1/2 the chord value is (h(${num(x7)}) + h(${num(y7)}))/2 = (${num(gx7)} + ${par(gy7)})/2 = ${num(C7)}, and h(${num(m7)}) = ${num(gm7)}. ${isViolated ? `${num(gm7)} < ${num(C7)}, so the inequality fails at this pair; because concavity demands it for every x, y and α, one failing pair is enough to show that h is not concave. Then the guarantee of GPML pdf p. 60 (Wᵢᵢ ≥ 0, a concave Ψ(f) with a unique maximum) is lost.` : `${num(gm7)} > ${num(C7)}, so the inequality holds at this pair, but it must hold for every pair and every α, so a satisfied pair proves nothing.`} Both the logistic and the probit log-likelihood do satisfy it for every pair (GPML pdf p. 60, Fig. 3.3). Concavity belongs to log p(y | f), not to p(y | f): the Gaussian likelihood is bell-shaped, not concave, while its logarithm is a downward parabola. This game does not assess how a posterior is approximated when the likelihood is not log-concave.`,
        `取 α = 1/2，弦上的值为 (h(${num(x7)}) + h(${num(y7)}))/2 = (${num(gx7)} + ${par(gy7)})/2 = ${num(C7)}，而 h(${num(m7)}) = ${num(gm7)}。${isViolated ? `${num(gm7)} < ${num(C7)}，不等式在这一对点上不成立；凹性要求对所有 x、y 和 α 都成立，所以一对不满足的点就足以说明 h 不是凹函数。此时 GPML pdf 第 60 页的保证（Wᵢᵢ ≥ 0，Ψ(f) 是凹函数且有唯一最大值）不再成立。` : `${num(gm7)} > ${num(C7)}，不等式在这一对点上成立，但它必须对每一对点和每个 α 都成立，所以一对满足的点什么也证明不了。`}逻辑斯蒂和概率单位的对数似然对每一对点都满足它（GPML pdf 第 60 页，图 3.3）。凹性属于 log p(y | f)，而不是 p(y | f)：高斯似然是钟形，不是凹函数，而它的对数是开口向下的抛物线。本游戏不考查似然不是对数凹时如何近似后验。`
      )
    }),
    g.number({
      id: 'tail-growth',
      title: t('How hard is a mislabelled point punished?', '错标的点受到多重的惩罚？'),
      prompt: t(
        `A badly misclassified point has z = y·f = −t with t large. Its penalty is −log p(y | f). For large t the logistic penalty grows linearly in t and the probit penalty quadratically in t (GPML pdf p. 60, Fig. 3.3). Treat the logistic penalty as exactly proportional to t and the probit penalty as exactly proportional to t². The point moves from t = ${a8} to t = ${b8}. By what factor does the probit penalty grow? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个被严重错分的点有 z = y·f = −t，t 很大，其惩罚为 −log p(y | f)。t 很大时，逻辑斯蒂惩罚随 t 线性增长，概率单位惩罚随 t 二次增长（GPML pdf 第 60 页，图 3.3）。把逻辑斯蒂惩罚当作恰好与 t 成正比，把概率单位惩罚当作恰好与 t² 成正比。该点从 t = ${a8} 移到 t = ${b8}。概率单位惩罚增长到原来的多少倍？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Growth factor of the probit penalty', '概率单位惩罚的增长倍数'), answer: T8, tolerance: 0.006 }],
      hint: t(
        'If the penalty is proportional to t², what happens to it when t is multiplied by some factor?',
        '若惩罚与 t² 成正比，当 t 乘以某个倍数时，惩罚会发生什么变化？'
      ),
      explanation: t(
        `t grows by the factor ${ratio8}. A penalty proportional to t² grows by the square of that factor: ${sq8} = ${exact(T8)}. The linear logistic penalty would grow only by ${exact(b8 / a8)}, so a point that is far on the wrong side is punished much more by the probit likelihood than by the logistic one. In reality −log Φ(−t) is only approximately quadratic for large t (its leading term is t²/2), which is why the question asks you to treat it as exactly proportional to t²; the qualitative contrast, linear versus quadratic, is the one in GPML pdf p. 60. This game does not assess fitting either likelihood to data.`,
        `t 增长为原来的 ${ratio8} 倍。与 t² 成正比的惩罚增长为这个倍数的平方：${sq8} = ${exact(T8)}。线性的逻辑斯蒂惩罚只增长 ${exact(b8 / a8)} 倍，所以远在错误一侧的点受到概率单位似然的惩罚比受到逻辑斯蒂似然的惩罚重得多。实际上 −log Φ(−t) 在 t 很大时只是近似二次（其首项为 t²/2），所以题目要求你把它当作恰好与 t² 成正比；线性与二次的定性对比出自 GPML pdf 第 60 页。本游戏不考查如何用数据拟合这两种似然。`
      ),
      audit: { kind: 'GP-17:tail-growth', params: { a: a8, b: b8 } }
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the likelihood of three labels', '挑战：三个标签的似然'),
      prompt: t(
        `A binary GP classifier has labels y ∈ {−1, +1}, independent given f, with p(yᵢ | fᵢ) = σ(yᵢ·fᵢ) for a symmetric sigmoid σ with σ(1) = ${num(p1_9)} and σ(2) = ${num(p2_9)}. Three training points have (f₁, y₁) = (${num(pt1.f)}, ${num(pt1.y)}), (f₂, y₂) = (${num(pt2.f)}, ${num(pt2.y)}) and (f₃, y₃) = (${num(pt3.f)}, ${num(pt3.y)}). What is the likelihood p(y | f) of the three labels? Give a decimal; the exact value has 3 decimal places.`,
        `二分类高斯过程模型的标签 y ∈ {−1, +1}，在给定 f 时相互独立，p(yᵢ | fᵢ) = σ(yᵢ·fᵢ)，其中 σ 是对称的压缩函数，σ(1) = ${num(p1_9)}，σ(2) = ${num(p2_9)}。三个训练点为 (f₁, y₁) = (${num(pt1.f)}, ${num(pt1.y)})，(f₂, y₂) = (${num(pt2.f)}, ${num(pt2.y)})，(f₃, y₃) = (${num(pt3.f)}, ${num(pt3.y)})。这三个标签的似然 p(y | f) 是多少？请填小数；精确值有 3 位小数。`
      ),
      fields: [{ label: t('Likelihood p(y | f)', '似然 p(y | f)'), answer: Number(T9.toFixed(6)), tolerance: 0.006 }],
      hint: t(
        'Work out each product yᵢ·fᵢ first. For a negative product you need σ of a negative number.',
        '先算出每个乘积 yᵢ·fᵢ。乘积为负时，需要的是负数处的 σ 值。'
      ),
      explanation: t(
        `Independent labels give p(y | f) = p(y₁ | f₁)·p(y₂ | f₂)·p(y₃ | f₃) (Lecture 6 p. 12), and each factor is σ(yᵢ·fᵢ). The products yᵢfᵢ are ${num(z1_9)}, ${num(z2_9)}, ${num(z3_9)}. A positive product reads the table directly: σ(1) = ${num(p1_9)}, σ(2) = ${num(p2_9)}. A negative one uses σ(−z) = 1 − σ(z): σ(−1) = 1 − ${num(p1_9)} = ${num(1 - p1_9)}, σ(−2) = 1 − ${num(p2_9)} = ${num(1 - p2_9)}. So the factors are ${num(s1_9)}, ${num(s2_9)}, ${num(s3_9)} and their product is ${num(s1_9)}·${num(s2_9)}·${num(s3_9)} = ${num(T9)}. Ignoring the labels would give ${num(sVal(pt1.f) * sVal(pt2.f) * sVal(pt3.f))}; treating every point as correctly classified would give ${num(sVal(Math.abs(z1_9)) * sVal(Math.abs(z2_9)) * sVal(Math.abs(z3_9)))}. This game does not assess fitting σ to data.`,
        `标签相互独立，所以 p(y | f) = p(y₁ | f₁)·p(y₂ | f₂)·p(y₃ | f₃)（第 6 讲第 12 页），每个因子都是 σ(yᵢ·fᵢ)。乘积 yᵢfᵢ 分别为 ${num(z1_9)}、${num(z2_9)}、${num(z3_9)}。乘积为正时直接查表：σ(1) = ${num(p1_9)}，σ(2) = ${num(p2_9)}。乘积为负时用 σ(−z) = 1 − σ(z)：σ(−1) = 1 − ${num(p1_9)} = ${num(1 - p1_9)}，σ(−2) = 1 − ${num(p2_9)} = ${num(1 - p2_9)}。所以三个因子为 ${num(s1_9)}、${num(s2_9)}、${num(s3_9)}，乘积为 ${num(s1_9)}·${num(s2_9)}·${num(s3_9)} = ${num(T9)}。若忽略标签，会得到 ${num(sVal(pt1.f) * sVal(pt2.f) * sVal(pt3.f))}；若把每个点都当作分类正确，会得到 ${num(sVal(Math.abs(z1_9)) * sVal(Math.abs(z2_9)) * sVal(Math.abs(z3_9)))}。本游戏不考查如何用数据拟合 σ。`
      ),
      audit: { kind: 'GP-17:challenge', params: { p1: p1_9, p2: p2_9, f1: pt1.f, y1: pt1.y, f2: pt2.f, y2: pt2.y, f3: pt3.f, y3: pt3.y } }
    })
  ];
};
