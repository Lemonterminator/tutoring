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

// Helper: check if a fraction (num/den) has a reduced denominator in the allowed set
function allowedDenom(num: number, den: number): boolean {
  if (den === 0) return false;
  const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b);
  const g = gcd(Math.abs(num), Math.abs(den));
  const reducedDen = Math.abs(den) / g;
  return [1, 2, 4, 5, 8, 10].includes(reducedDen);
}

// Helper: check minimum gap between truth and wrong routes
function minGap(truth: number, routes: number[]): number {
  return Math.min(...routes.map(r => Math.abs(truth - r)));
}

// Format a number for use inside a matrix (replaces ASCII hyphen with proper minus)
function fmtNum(x: number): string {
  if (x < 0) return '−' + String(Math.abs(x));
  return String(x);
}

export const gp13: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-13');
  warm(g);

  // === Card 1: integrate-vs-mode ===
  const c1 = retry(() => {
    const N = g.pick([2, 3, 6, 8]);
    const s = g.random(0, N);
    return { N, s };
  }, v => {
    if (v.N === 2 * v.s) return false;
    if ((v.N === 6 && v.s === 0) || (v.N === 8 && v.s === 0)) return false;
    const prob = (v.s + 1) / (v.N + 2);
    const routes = [
      v.s / v.N,
      (v.s + 1) / v.N,
      v.s / (v.N + 2),
      (v.s + 1) / (v.N + 1),
    ];
    return minGap(prob, routes) >= 0.02;
  });
  const c1_prob = (c1.s + 1) / (c1.N + 2);
  const c1_mode = c1.s / c1.N;
  const c1_s1 = c1.s + 1;
  const c1_Ns1 = c1.N - c1.s + 1;
  const c1_N2 = c1.N + 2;
  const c1_same = exact(c1_prob) === `${c1_s1}/${c1_N2}`;

  // === Card 2: het-variance ===
  const c2 = retry(() => {
    const a1 = g.pick([3, 4, 5, 6, 7, 8]);
    const a2 = g.pick([3, 4, 5, 6, 7, 8]);
    return { a1, a2 };
  }, v => v.a1 !== v.a2);
  const c2_variance = c2.a2 * c2.a2;
  const c2_v1 = c2.a1 * c2.a1;

  // === Card 4: count-unknowns ===
  const c4 = retry(() => {
    const n = g.pick([20, 25, 30, 40]);
    const M = g.pick([8, 10, 12, 15]);
    return { n, M };
  }, v => v.M < v.n);
  const c4_dense = 2 * c4.n + 5;
  const c4_hs = 2 * c4.M + 5;
  const c4_nf = c4.n + 5;
  const c4_n2 = 2 * c4.n;

  // === Card 5: basis-kernel ===
  const c5 = retry(() => {
    const kappa = g.pick([0.25, 0.5, 0.75]);
    const pair = g.pick([[1, 2], [1, 3], [2, 3]]);
    const x = pair[0], xp = pair[1];
    const B0 = g.pick([1, 2]);
    const B1 = g.pick([1, 2, 3]);
    const m1 = g.pick([1, 2, 3]);
    const m2 = g.pick([1, 2, 3]);
    return { kappa, x, xp, B0, B1, m1, m2 };
  }, v => {
    if (v.m1 === v.B0 && v.m2 === v.B1) return false;
    const cov = v.kappa + v.B0 + v.B1 * v.x * v.xp;
    const routes = [
      v.B0 + v.B1 * v.x * v.xp,
      v.kappa * (v.B0 + v.B1 * v.x * v.xp),
      v.kappa + v.B0 + v.B1 * (v.x + v.xp),
      v.kappa + v.m1 + v.m2 * v.x * v.xp,
      v.kappa + v.B0 + v.B1,
    ];
    return minGap(cov, routes) >= 0.02;
  });
  const c5_cov = c5.kappa + c5.B0 + c5.B1 * c5.x * c5.xp;
  const c5_hbh = c5.B0 + c5.B1 * c5.x * c5.xp;

  // === Card 6: basis-beta ===
  const pqList: [number, number][] = [[2, -1], [3, -2], [3, -1], [3, 1], [3, 2], [4, -3], [4, -2], [4, 1], [5, -4], [5, -3], [5, -1]];
  const c6 = retry(() => {
    const pq = g.pick(pqList);
    const p = pq[0], q = pq[1];
    const B = g.pick([1, 2, 4]);
    const b = g.random(-3, 6);
    const y1 = g.random(0, 8);
    const y2 = g.random(0, 8);
    return { p, q, B, b, y1, y2 };
  }, v => {
    if (v.b === 0) return false;
    if (v.y1 === v.y2) return false;
    const s = v.p + v.q;
    const S = v.y1 + v.y2;
    const betabar = (v.B * S + s * v.b) / (s + 2 * v.B);
    const num = v.B * S + s * v.b;
    const den = s + 2 * v.B;
    if (!allowedDenom(num, den)) return false;
    const avg = S / 2;
    const indep = (v.B * S + v.p * v.b) / (v.p + 2 * v.B);
    const nob = v.B * S / (s + 2 * v.B);
    const swapped = (S + v.b * v.B * s) / (v.B * s + 2);
    const routes = [avg, indep, nob, swapped];
    return minGap(betabar, routes) >= 0.02;
  });
  const c6_s = c6.p + c6.q;
  const c6_S = c6.y1 + c6.y2;
  const c6_betabar = (c6.B * c6_S + c6_s * c6.b) / (c6_s + 2 * c6.B);
  const c6_avg = c6_S / 2;
  const c6_indep = (c6.B * c6_S + c6.p * c6.b) / (c6.p + 2 * c6.B);
  const c6_nob = c6.B * c6_S / (c6_s + 2 * c6.B);

  // === Card 7: basis-far-var ===
  const c7 = retry(() => {
    const pq = g.pick(pqList);
    const p = pq[0], q = pq[1];
    const B = g.pick([1, 2, 4]);
    const kappa = g.pick([0.25, 0.5, 0.75, 1, 1.5, 2]);
    return { p, q, B, kappa };
  }, v => {
    const s = v.p + v.q;
    const pv = v.B * s / (s + 2 * v.B);
    const vVar = v.kappa + pv;
    const num = v.kappa * (s + 2 * v.B) + v.B * s;
    const den = s + 2 * v.B;
    if (!allowedDenom(num, den)) return false;
    const routes = [
      v.kappa,
      v.kappa + v.B,
      v.kappa + v.B * v.p / (v.p + 2 * v.B),
      v.kappa + s / 2,
      v.kappa + 1 / v.B + 2 / s,
    ];
    return minGap(vVar, routes) >= 0.02;
  });
  const c7_s = c7.p + c7.q;
  const c7_pv = c7.B * c7_s / (c7_s + 2 * c7.B);
  const c7_var = c7.kappa + c7_pv;
  const c7_alt1 = c7.kappa + c7.B;

  // === Card 8: vague-naive ===
  const c8 = retry(() => {
    const B = g.pick([100, 1000, 10000]);
    const d = g.pick([1, 2]);
    return { B, d };
  }, () => true);
  const c8_dB = c8.d + c8.B;
  const c8_big = c8.d + 2 * c8.B;
  const c8_cond = c8_big / c8.d;
  const c8_det = c8.d * c8_big;

  // === Card 9: challenge ===
  const c9 = retry(() => {
    const pq = g.pick(pqList);
    const p = pq[0], q = pq[1];
    const B = g.pick([1, 2, 4]);
    const b = g.random(-3, 6);
    const y1 = g.random(0, 8);
    const y2 = g.random(0, 8);
    const kappa = g.pick([0.5, 1, 1.5]);
    return { p, q, B, b, y1, y2, kappa };
  }, v => {
    if (v.b === 0) return false;
    if (v.y1 === v.y2) return false;
    const s = v.p + v.q;
    const S = v.y1 + v.y2;
    const mean = (v.B * S + s * v.b) / (s + 2 * v.B);
    const pv = v.B * s / (s + 2 * v.B);
    const vVar = v.kappa + pv;
    const meanNum = v.B * S + s * v.b;
    const meanDen = s + 2 * v.B;
    if (!allowedDenom(meanNum, meanDen)) return false;
    const varNum = v.kappa * (s + 2 * v.B) + v.B * s;
    const varDen = s + 2 * v.B;
    if (!allowedDenom(varNum, varDen)) return false;
    const meanRoutes = [
      S / 2,
      (v.B * S + v.p * v.b) / (v.p + 2 * v.B),
      v.B * S / (s + 2 * v.B),
      (S + v.b * v.B * s) / (v.B * s + 2),
    ];
    if (minGap(mean, meanRoutes) < 0.02) return false;
    const varRoutes = [
      v.kappa,
      v.kappa + v.B,
      v.kappa + v.B * v.p / (v.p + 2 * v.B),
      v.kappa + s / 2,
      v.kappa + 1 / v.B + 2 / s,
    ];
    return minGap(vVar, varRoutes) >= 0.02;
  });
  const c9_s = c9.p + c9.q;
  const c9_S = c9.y1 + c9.y2;
  const c9_mean = (c9.B * c9_S + c9_s * c9.b) / (c9_s + 2 * c9.B);
  const c9_pv = c9.B * c9_s / (c9_s + 2 * c9.B);
  const c9_var = c9.kappa + c9_pv;
  const c9_nob = c9.B * c9_S / (c9_s + 2 * c9.B);

  return [
    // Card 1: integrate-vs-mode
    g.number({
      id: 'integrate-vs-mode',
      title: t('Integrate, do not plug in', '积分，而不是代入点估计'),
      prompt: t(
        `A success probability θ has a uniform prior. In ${c1.N} trials there are ${c1.s} successes. The posterior is Beta(${c1_s1}, ${c1_Ns1}) (this is Beta(u, w) with u = s + 1, w = N − s + 1; its mean is u/(u + w)), and its mode is ${exact(c1_mode)}. What is the probability that the next trial is a success when we average over the whole posterior of θ? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `成功概率 θ 取均匀先验。${c1.N} 次试验中有 ${c1.s} 次成功。后验为 Beta(${c1_s1}, ${c1_Ns1})（即 Beta(u, w)，u = s + 1，w = N − s + 1；其均值为 u/(u + w)），众数为 ${exact(c1_mode)}。对 θ 的整个后验取平均时，下一次试验成功的概率是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Probability', '概率'), answer: c1_prob, tolerance: 0.006 }],
      hint: t(
        'The mode is a single point of the posterior. Averaging over θ uses all of it, and the chance of a success given θ is θ itself.',
        '众数只是后验上的一个点。对 θ 取平均要用到整个后验，而给定 θ 时成功的概率就是 θ 本身。'
      ),
      explanation: t(
        `Given θ the next trial succeeds with probability θ, so averaging over the posterior gives E[θ | data], the posterior mean u/(u + w) = ${c1_s1}/(${c1_s1} + ${c1_Ns1}) = ${c1_s1}/${c1_N2}${c1_same ? '' : ` = ${exact(c1_prob)}`}. The plug-in prediction with the mode is ${c1.s}/${c1.N} = ${exact(c1_mode)}. ${c1.s === 0 ? `With s = 0 successes the mode says a success is impossible, while the average keeps 1/${c1_N2} (Lecture 4 pp. 11–12: mode versus mean).` : 'The mode ignores that the data could not rule out other values of θ.'} This game does not assess fitting hyperparameters or running MCMC.`,
        `给定 θ，下一次试验成功的概率就是 θ，所以对后验取平均得到 E[θ | 数据]，即后验均值 u/(u + w) = ${c1_s1}/(${c1_s1} + ${c1_Ns1}) = ${c1_s1}/${c1_N2}${c1_same ? '' : ` = ${exact(c1_prob)}`}。用众数代入得到 ${c1.s}/${c1.N} = ${exact(c1_mode)}。${c1.s === 0 ? `成功 0 次时众数说成功不可能，而取平均仍保留 1/${c1_N2}（第 4 讲第 11–12 页：众数与均值）。` : '众数没有考虑数据无法排除 θ 的其他取值。'}本游戏不考查超参数拟合，也不考查 MCMC 的运行。`
      ),
      audit: { kind: 'GP-13:integrate-vs-mode', params: { N: c1.N, s: c1.s } },
    }),

    // Card 2: het-variance
    g.number({
      id: 'het-variance',
      title: t('Noise variance from the log standard deviation', '由对数标准差求噪声方差'),
      prompt: t(
        `In the heteroscedastic model y ~ normal(f(x), exp(g(x))) the quantity exp(g(x)) is the standard deviation of the noise, so g is the log standard deviation. A fitted g has g(x₁) = ln ${c2.a1} and g(x₂) = ln ${c2.a2}. What is the variance of the noise at x₂? Give an integer.`,
        `异方差模型 y ~ normal(f(x), exp(g(x))) 中，exp(g(x)) 是噪声的标准差，所以 g 是对数标准差。已拟合的 g 满足 g(x₁) = ln ${c2.a1}、g(x₂) = ln ${c2.a2}。x₂ 处噪声的方差是多少？请填整数。`
      ),
      fields: [{ label: t('Variance', '方差'), answer: c2_variance, tolerance: 0.006 }],
      hint: t(
        'Undo ln first: what number is exp(g(x₂))? Then check whether the question wants that number or something built from it.',
        '先消去 ln：exp(g(x₂)) 是多少？再看题目要的是这个数还是由它得到的量。'
      ),
      explanation: t(
        `exp(g(x₂)) = exp(ln ${c2.a2}) = ${c2.a2} is the standard deviation (Lecture 4 p. 14: g is the log standard deviation), so the variance is ${c2.a2}² = ${c2_variance}. Reading ${c2.a2} as the variance would give ${c2.a2}; the value at x₁ (${c2.a1}² = ${c2_v1}) belongs to another input. The noise level changes with x, which is what heteroscedastic means. This game does not assess fitting g.`,
        `exp(g(x₂)) = exp(ln ${c2.a2}) = ${c2.a2} 是标准差（第 4 讲第 14 页：g 是对数标准差），所以方差是 ${c2.a2}² = ${c2_variance}。把 ${c2.a2} 当成方差会得到 ${c2.a2}；x₁ 处的值（${c2.a1}² = ${c2_v1}）属于另一个输入。噪声大小随 x 变化，这就是“异方差”。本游戏不考查拟合 g。`
      ),
      audit: { kind: 'GP-13:het-variance', params: { a1: c2.a1, a2: c2.a2 } },
    }),

    // Card 3: het-integrate
    g.choice({
      id: 'het-integrate',
      title: t('Which model can be integrated?', '哪个模型可以解析积分？'),
      prompt: t(
        `Model A: y ~ normal(f(x), σ) with a constant σ and f ~ GP(0, K₁). Model B: y ~ normal(f(x), exp(g(x))) with f ~ GP(0, K₁) and g ~ GP(0, K₂). A student says: 'f and g both have Gaussian process priors, so the marginal likelihood is a Gaussian integral in both models.' Which statement is correct?`,
        `模型 A：y ~ normal(f(x), σ)，σ 为常数，f ~ GP(0, K₁)。模型 B：y ~ normal(f(x), exp(g(x)))，f ~ GP(0, K₁)，g ~ GP(0, K₂)。一位同学说：“f 和 g 都有高斯过程先验，所以两个模型的边际似然都是高斯积分。”下列哪个说法正确？`
      ),
      options: [
        t('Only model A can: it is linear in f; model B is not linear in g, so g cannot be integrated analytically.', '只有模型 A 可以：它对 f 是线性的；模型 B 对 g 不是线性的，无法对 g 解析积分。'),
        t('Both can, because f and g both have Gaussian process priors, so every integral in either model is Gaussian.', '两个都可以，因为 f 和 g 都有高斯过程先验，所以两个模型中的每个积分都是高斯的。'),
        t('Neither can: any GP model needs MCMC for its marginal likelihood.', '两个都不可以：任何 GP 模型的边际似然都需要 MCMC。'),
        t('Only model B can, because exp(g(x)) is a smooth positive function and g has a Gaussian process prior.', '只有模型 B 可以，因为 exp(g(x)) 是光滑的正函数，而且 g 有高斯过程先验。'),
      ],
      correct: 0,
      hint: t(
        'Ask in which unknown function each model is linear. A Gaussian prior alone is not what makes an integral closed-form.',
        '看每个模型分别对哪个未知函数是线性的。仅有高斯先验并不能保证积分有闭式。'
      ),
      explanation: t(
        'In model A, y is f plus Gaussian noise, so integrating over f gives a Gaussian marginal likelihood (Lecture 4 p. 15). In model B the noise level exp(g(x)) depends on g non-linearly, so the model is not linear in g and the integral over g has no closed form (Lecture 4 p. 24); one then needs MCMC, Laplace, VI or EP. Gaussian priors are not enough; neither does every GP model need MCMC. This game does not assess running those approximations.',
        '在模型 A 中，y 是 f 加高斯噪声，对 f 积分得到高斯边际似然（第 4 讲第 15 页）。在模型 B 中，噪声水平 exp(g(x)) 非线性地依赖 g，模型对 g 不是线性的，对 g 的积分没有闭式（第 4 讲第 24 页）；这时需要 MCMC、Laplace、VI 或 EP。仅有高斯先验是不够的；也并非每个 GP 模型都需要 MCMC。本游戏不考查这些近似方法的具体运行。'
      ),
    }),

    // Card 4: count-unknowns
    g.number({
      id: 'count-unknowns',
      title: t('Counting the unknowns', '数一数未知量'),
      prompt: t(
        `A heteroscedastic GP, y ~ normal(f(x), exp(g(x))), is fitted to n = ${c4.n} observations. Version 1 treats the unknowns (f, g, ℓ_f, σ_f, ℓ_g, σ_g, σ) jointly, where f and g each have one value per observation and the other five are single numbers. Version 2 expands f and g in M = ${c4.M} basis functions each, so the unknowns are (β_f, β_g, ℓ_f, σ_f, ℓ_g, σ_g, σ) with M coefficients in each of β_f and β_g. How many unknown numbers does each version have? Give integers.`,
        `对 n = ${c4.n} 个观测拟合异方差 GP，y ~ normal(f(x), exp(g(x)))。版本 1 把未知量 (f, g, ℓ_f, σ_f, ℓ_g, σ_g, σ) 联合处理，其中 f 和 g 各有每个观测一个值，其余五个各是一个数。版本 2 用各 M = ${c4.M} 个基函数展开 f 和 g，未知量为 (β_f, β_g, ℓ_f, σ_f, ℓ_g, σ_g, σ)，β_f 和 β_g 各含 M 个系数。两个版本各有多少个未知数？请填整数。`
      ),
      fields: [
        { label: t('Version 1 (f, g)', '版本 1 (f, g)'), answer: c4_dense, tolerance: 0.006 },
        { label: t('Version 2 (β_f, β_g)', '版本 2 (β_f, β_g)'), answer: c4_hs, tolerance: 0.006 },
      ],
      hint: t(
        'Count the numbers inside each symbol of the list, then add the single numbers.',
        '数出列表中每个符号里含有几个数，再加上那些单个的数。'
      ),
      explanation: t(
        `Version 1: f and g have ${c4.n} values each and five single numbers: 2 · ${c4.n} + 5 = ${c4_dense}, which exceeds the ${c4.n} observations (Lecture 4 p. 24: the number of unknowns is bigger than the number of observations). Version 2 replaces them by ${c4.M} coefficients each (p. 30: good enough with fewer than n basis functions; p. 36): 2 · ${c4.M} + 5 = ${c4_hs}. Counting only f gives ${c4_nf}; forgetting the five single numbers gives ${c4_n2}. This game does not assess how many basis functions a given accuracy needs.`,
        `版本 1：f 和 g 各有 ${c4.n} 个值，再加五个单个的数：2 · ${c4.n} + 5 = ${c4_dense}，超过 ${c4.n} 个观测（第 4 讲第 24 页：未知量个数多于观测个数）。版本 2 把它们换成各 ${c4.M} 个系数（第 30 页：基函数少于 n 个就足够好；第 36 页）：2 · ${c4.M} + 5 = ${c4_hs}。只数 f 会得到 ${c4_nf}；忘了那五个单个的数会得到 ${c4_n2}。本游戏不考查达到某个精度需要多少个基函数。`
      ),
      audit: { kind: 'GP-13:count-unknowns', params: { n: c4.n, M: c4.M } },
    }),

    // Card 5: basis-kernel
    g.number({
      id: 'basis-kernel',
      title: t('Covariance after integrating out β', '对 β 积分后的协方差'),
      prompt: t(
        `Let g(x) = f(x) + h(x)ᵀβ with basis h(x) = (1, x)ᵀ, where f has k(x, x′) = ${c5.kappa} for the two inputs x = ${c5.x} and x′ = ${c5.xp}, and β ~ N(b, B) with b = (${c5.m1}, ${c5.m2})ᵀ and B = ${mat([[String(c5.B0), '0'], ['0', String(c5.B1)]])}. With β integrated out, what is the covariance of g(${c5.x}) and g(${c5.xp})? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `设 g(x) = f(x) + h(x)ᵀβ，基函数 h(x) = (1, x)ᵀ，其中 f 在 x = ${c5.x}、x′ = ${c5.xp} 处的协方差 k(x, x′) = ${c5.kappa}，β ~ N(b, B)，b = (${c5.m1}, ${c5.m2})ᵀ，B = ${mat([[String(c5.B0), '0'], ['0', String(c5.B1)]])}。对 β 积分后，g(${c5.x}) 与 g(${c5.xp}) 的协方差是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Covariance', '协方差'), answer: c5_cov, tolerance: 0.006 }],
      hint: t(
        'Integrating out β adds a term to the covariance. Ask which of b and B describes uncertainty, and evaluate h at both inputs.',
        '对 β 积分会给协方差加上一项。想想 b 和 B 哪一个描述不确定性，并在两个输入处分别计算 h。'
      ),
      explanation: t(
        `Integrating out β gives a GP with covariance k(x, x′) + h(x)ᵀBh(x′) (GPML eq. 2.40). Here h(${c5.x}) = (1, ${c5.x})ᵀ and h(${c5.xp}) = (1, ${c5.xp})ᵀ, so hᵀBh′ = ${c5.B0} · 1 · 1 + ${c5.B1} · ${c5.x} · ${c5.xp} = ${c5_hbh}. Total ${exact(c5.kappa)} + ${c5_hbh} = ${exact(c5_cov)}. The prior mean b only shifts the mean h(x)ᵀb, not the covariance; the term is added to k, not multiplied with it. This game does not assess evaluating kernels such as the SE or the composition of kernels (GP-08, GP-09).`,
        `对 β 积分得到协方差为 k(x, x′) + h(x)ᵀBh(x′) 的 GP（GPML 式 2.40）。这里 h(${c5.x}) = (1, ${c5.x})ᵀ，h(${c5.xp}) = (1, ${c5.xp})ᵀ，所以 hᵀBh′ = ${c5.B0} · 1 · 1 + ${c5.B1} · ${c5.x} · ${c5.xp} = ${c5_hbh}。合计 ${exact(c5.kappa)} + ${c5_hbh} = ${exact(c5_cov)}。先验均值 b 只平移均值 h(x)ᵀb，不影响协方差；这一项是加到 k 上，而不是与 k 相乘。本游戏不考查平方指数等核的取值或核的组合（GP-08、GP-09）。`
      ),
      audit: { kind: 'GP-13:basis-kernel', params: { kappa: c5.kappa, x: c5.x, xp: c5.xp, B0: c5.B0, B1: c5.B1, m1: c5.m1, m2: c5.m2 } },
    }),

    // Card 6: basis-beta
    g.number({
      id: 'basis-beta',
      title: t('Posterior mean of the basis coefficient', '基函数系数的后验均值'),
      prompt: t(
        `Let g(x) = f(x) + β with basis h(x) = 1 (so H = (1, 1)) and prior β ~ N(${num(c6.b)}, ${c6.B}). Two observations y = (${c6.y1}, ${c6.y2})ᵀ have K_y = K + σ²I = ${mat([[fmtNum(c6.p), fmtNum(c6.q)], [fmtNum(c6.q), fmtNum(c6.p)]])}, with determinant ${c6.p * c6.p - c6.q * c6.q} (the residual f is correlated between the two inputs). What is the posterior mean β̄ of β? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `设 g(x) = f(x) + β，基函数 h(x) = 1（即 H = (1, 1)），先验 β ~ N(${num(c6.b)}, ${c6.B})。两个观测 y = (${c6.y1}, ${c6.y2})ᵀ，K_y = K + σ²I = ${mat([[fmtNum(c6.p), fmtNum(c6.q)], [fmtNum(c6.q), fmtNum(c6.p)]])}，行列式为 ${c6.p * c6.p - c6.q * c6.q}（残差 f 在两个输入之间相关）。β 的后验均值 β̄ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('β̄', 'β̄'), answer: c6_betabar, tolerance: 0.006 }],
      hint: t(
        'The compromise is between the data term and the prior: weigh each by its precision. Apply K_y to the vector (1, 1)ᵀ to see how the correlated residual acts on the two observations.',
        '结果是数据项与先验的折中：各按其精度加权。把 K_y 作用到向量 (1, 1)ᵀ 上，看看相关的残差如何影响这两个观测。'
      ),
      explanation: t(
        `K_y (1, 1)ᵀ = ${c6_s} (1, 1)ᵀ, so HK_y⁻¹Hᵀ = 2/${c6_s} and HK_y⁻¹y = (${c6.y1} + ${c6.y2})/${c6_s} = ${c6_S}/${c6_s}. With B⁻¹ = 1/${c6.B}: β̄ = (1/${c6.B} + 2/${c6_s})⁻¹ (${c6_S}/${c6_s} + ${par(c6.b)}/${c6.B}) = ${exact(c6_betabar)} (GPML eq. 2.41). Dropping the prior gives the plain average ${exact(c6_avg)}; treating the residuals as independent (replacing ${c6_s} by ${c6.p}) gives ${exact(c6_indep)}; leaving out the prior mean ${par(c6.b)} gives ${exact(c6_nob)}. This game does not assess the vague-prior limit formulas beyond card 8.`,
        `K_y (1, 1)ᵀ = ${c6_s} (1, 1)ᵀ，所以 HK_y⁻¹Hᵀ = 2/${c6_s}，HK_y⁻¹y = (${c6.y1} + ${c6.y2})/${c6_s} = ${c6_S}/${c6_s}。取 B⁻¹ = 1/${c6.B}：β̄ = (1/${c6.B} + 2/${c6_s})⁻¹ (${c6_S}/${c6_s} + ${par(c6.b)}/${c6.B}) = ${exact(c6_betabar)}（GPML 式 2.41）。去掉先验得到简单平均 ${exact(c6_avg)}；把残差当作独立（把 ${c6_s} 换成 ${c6.p}）得到 ${exact(c6_indep)}；漏掉先验均值 ${par(c6.b)} 得到 ${exact(c6_nob)}。除第 8 关外，本游戏不考查 B⁻¹ → 0 的极限公式。`
      ),
      audit: { kind: 'GP-13:basis-beta', params: { p: c6.p, q: c6.q, B: c6.B, b: c6.b, y1: c6.y1, y2: c6.y2 } },
    }),

    // Card 7: basis-far-var
    g.number({
      id: 'basis-far-var',
      title: t('Variance far from the data', '远离数据处的方差'),
      prompt: t(
        `Same model: g(x) = f(x) + β, h(x) = 1, β ~ N(0, ${c7.B}), K_y = ${mat([[fmtNum(c7.p), fmtNum(c7.q)], [fmtNum(c7.q), fmtNum(c7.p)]])} for two training inputs (determinant ${c7.p * c7.p - c7.q * c7.q}). A test input x* has k(x*, x₁) = k(x*, x₂) = 0 and k(x*, x*) = ${c7.kappa}. What is the variance of the latent g(x*) given the data? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `同一模型：g(x) = f(x) + β，h(x) = 1，β ~ N(0, ${c7.B})，两个训练输入的 K_y = ${mat([[fmtNum(c7.p), fmtNum(c7.q)], [fmtNum(c7.q), fmtNum(c7.p)]])}（行列式 ${c7.p * c7.p - c7.q * c7.q}）。测试输入 x* 满足 k(x*, x₁) = k(x*, x₂) = 0，k(x*, x*) = ${c7.kappa}。给定数据后，潜在值 g(x*) 的方差是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Variance of g(x*)', 'g(x*) 的方差'), answer: c7_var, tolerance: 0.006 }],
      hint: t(
        'Since x* is uncorrelated with both observations, the data can only teach us about β. Add the leftover variance of f* to what remains uncertain about β after the data.',
        'x* 与两个观测都不相关，所以数据只能告诉我们关于 β 的信息。把 f* 剩余的方差加上数据之后 β 仍然不确定的部分。'
      ),
      explanation: t(
        `With k* = 0 the GP part is unchanged: cov(f*) = k(x*, x*) = ${exact(c7.kappa)}, and R = H* = 1. The extra term is the posterior variance of β: (1/${c7.B} + 2/${c7_s})⁻¹ = ${exact(c7_pv)}. Total ${exact(c7.kappa)} + ${exact(c7_pv)} = ${exact(c7_var)} (GPML eq. 2.41). The prior variance ${c7.B} of β would overstate it (${exact(c7_alt1)}), and ignoring β would understate it (${exact(c7.kappa)}). This game does not assess the posterior mean at a test input near the data.`,
        `k* = 0 时 GP 部分不变：cov(f*) = k(x*, x*) = ${exact(c7.kappa)}，R = H* = 1。额外的一项是 β 的后验方差：(1/${c7.B} + 2/${c7_s})⁻¹ = ${exact(c7_pv)}。合计 ${exact(c7.kappa)} + ${exact(c7_pv)} = ${exact(c7_var)}（GPML 式 2.41）。用 β 的先验方差 ${c7.B} 会高估（${exact(c7_alt1)}），忽略 β 会低估（${exact(c7.kappa)}）。本游戏不考查靠近数据的测试输入处的后验均值。`
      ),
      audit: { kind: 'GP-13:basis-far-var', params: { p: c7.p, q: c7.q, B: c7.B, kappa: c7.kappa } },
    }),

    // Card 8: vague-naive
    g.choice({
      id: 'vague-naive',
      title: t('A vague prior done naively', '朴素地实现模糊先验'),
      prompt: t(
        `With h(x) = 1 and β ~ N(0, B), the covariance of g at two inputs is K + B·(all ones) with K = [[${c8.d}, 0], [0, ${c8.d}]], i.e. [[${c8_dB}, ${c8.B}], [${c8.B}, ${c8_dB}]] for B = ${c8.B}. Its eigenvalues are ${c8.d} and ${c8_big}. A student wants a vague prior and lets B grow, still plugging this matrix into the standard GP prediction formulas. What is the problem?`,
        `取 h(x) = 1，β ~ N(0, B)，则 g 在两个输入处的协方差为 K + B·(全 1 矩阵)，其中 K = [[${c8.d}, 0], [0, ${c8.d}]]，B = ${c8.B} 时即 [[${c8_dB}, ${c8.B}], [${c8.B}, ${c8_dB}]]。其特征值为 ${c8.d} 和 ${c8_big}。一位同学想要模糊先验，让 B 不断增大，仍把这个矩阵代入标准的 GP 预测公式。问题在哪里？`
      ),
      options: [
        t(`Its eigenvalues ${c8.d} and ${c8_big} differ by a factor ${c8_cond}: it is ill-conditioned, so use the vague-prior formulas instead.`, `它的特征值 ${c8.d} 和 ${c8_big} 相差 ${c8_cond} 倍：条件数很差，应改用模糊先验的公式。`),
        t('Nothing goes wrong: each diagonal entry exceeds the off-diagonal entry, so the matrix stays well conditioned and the solve is accurate.', '没有问题：每个对角元素都大于非对角元素，所以矩阵条件良好，求解是准确的。'),
        t('The matrix is singular for every finite B, so no prediction exists.', '对任何有限的 B 矩阵都是奇异的，所以无法预测。'),
        t('The matrix stops being positive definite once B is large, so the kernel becomes invalid.', 'B 一大矩阵就不再正定，核就不合法了。'),
      ],
      correct: 0,
      hint: t(
        'Look at the two eigenvalues as B grows. Does a matrix with one tiny and one huge eigenvalue behave well when you solve with it?',
        '看看 B 增大时两个特征值如何变化。一个特征值很小、一个很大的矩阵，用来求解时表现好吗？'
      ),
      explanation: t(
        `The matrix has eigenvalues ${c8.d} and ${c8_big}, so its condition number is ${c8_cond} for B = ${c8.B} and grows linearly with B. The matrix is still positive definite and not singular (its determinant is ${c8_det}), but a solve with it loses accuracy, and as B → ∞ the entries tend to infinity (GPML p. 46). The remedy is the limiting formula, which does not depend on b. Diagonal dominance only guarantees positive definiteness, not a good condition number. This game does not assess approximate GP methods.`,
        `矩阵的特征值为 ${c8.d} 和 ${c8_big}，B = ${c8.B} 时条件数为 ${c8_cond}，并且随 B 线性增长。矩阵仍然正定、不奇异（行列式为 ${c8_det}），但用它求解会损失精度，而且 B → ∞ 时各元素趋于无穷大（GPML 第 46 页）。补救办法是使用极限公式，它与 b 无关。对角占优只能保证正定，不能保证条件数小。本游戏不考查近似 GP 方法。`
      ),
      audit: { kind: 'GP-13:vague-naive', params: { B: c8.B, d: c8.d } },
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: far from the data', '挑战：远离数据处'),
      prompt: t(
        `A GP with g(x) = f(x) + β, h(x) = 1, f with zero mean, and prior β ~ N(${num(c9.b)}, ${c9.B}). Two training inputs have K_y = K + σ²I = ${mat([[fmtNum(c9.p), fmtNum(c9.q)], [fmtNum(c9.q), fmtNum(c9.p)]])} (determinant ${c9.p * c9.p - c9.q * c9.q}) and targets y = (${c9.y1}, ${c9.y2})ᵀ. A test input x* has k(x*, x₁) = k(x*, x₂) = 0 and k(x*, x*) = ${c9.kappa}. Find the predictive mean and the predictive variance of the latent g(x*). Give integers, fractions or decimals rounded to 2 places.`,
        `一个 GP：g(x) = f(x) + β，h(x) = 1，f 的均值为零，先验 β ~ N(${num(c9.b)}, ${c9.B})。两个训练输入的 K_y = K + σ²I = ${mat([[fmtNum(c9.p), fmtNum(c9.q)], [fmtNum(c9.q), fmtNum(c9.p)]])}（行列式 ${c9.p * c9.p - c9.q * c9.q}），目标 y = (${c9.y1}, ${c9.y2})ᵀ。测试输入 x* 满足 k(x*, x₁) = k(x*, x₂) = 0，k(x*, x*) = ${c9.kappa}。求潜在值 g(x*) 的预测均值和预测方差。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('Predictive mean', '预测均值'), answer: c9_mean, tolerance: 0.006 },
        { label: t('Predictive variance', '预测方差'), answer: c9_var, tolerance: 0.006 },
      ],
      hint: t(
        'Two parts: what the data teach about the constant β, and what the GP residual does at an input it never saw.',
        '分两部分：数据告诉了我们关于常数 β 的什么，以及 GP 残差在一个从未见过的输入处如何表现。'
      ),
      explanation: t(
        `K_y (1, 1)ᵀ = ${c9_s} (1, 1)ᵀ, so HK_y⁻¹Hᵀ = 2/${c9_s}, and β̄ = (1/${c9.B} + 2/${c9_s})⁻¹ (${c9_S}/${c9_s} + ${par(c9.b)}/${c9.B}) = ${exact(c9_mean)}. With k* = 0 the residual GP predicts its prior mean 0 at x*, so ḡ(x*) = ${exact(c9_mean)}. The variance is cov(f*) + (1/${c9.B} + 2/${c9_s})⁻¹ = ${exact(c9.kappa)} + ${exact(c9_pv)} = ${exact(c9_var)} (GPML eq. 2.41). Mixing up the roles gives a wrong answer: ignoring the prior mean gives ${exact(c9_nob)}, ignoring β in the variance gives ${exact(c9.kappa)}. This game does not assess fitting hyperparameters or MCMC.`,
        `K_y (1, 1)ᵀ = ${c9_s} (1, 1)ᵀ，所以 HK_y⁻¹Hᵀ = 2/${c9_s}，β̄ = (1/${c9.B} + 2/${c9_s})⁻¹ (${c9_S}/${c9_s} + ${par(c9.b)}/${c9.B}) = ${exact(c9_mean)}。k* = 0 时残差 GP 在 x* 处预测其先验均值 0，所以 ḡ(x*) = ${exact(c9_mean)}。方差为 cov(f*) + (1/${c9.B} + 2/${c9_s})⁻¹ = ${exact(c9.kappa)} + ${exact(c9_pv)} = ${exact(c9_var)}（GPML 式 2.41）。弄混各部分的作用就会出错：忽略先验均值得到 ${exact(c9_nob)}，方差里忽略 β 得到 ${exact(c9.kappa)}。本游戏不考查超参数拟合或 MCMC。`
      ),
      audit: { kind: 'GP-13:challenge', params: { p: c9.p, q: c9.q, B: c9.B, b: c9.b, y1: c9.y1, y2: c9.y2, kappa: c9.kappa } },
    }),
  ];
};
