import type { CardGenerator } from '../../types';
import { fitView, type FigureShape } from '../../figure';
import { exact, frac, makeGpDeck, mat, num, par, term, type Text } from '../support';

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

const TOL = 0.006;

// g.random(min, max) returns an integer and includes both ends.
function randInt(g: Deck, min: number, max: number): number {
  return g.random(min, max);
}
function pickIdx(g: Deck, len: number): number {
  return g.random(0, len - 1);
}

export const gp06: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-06');
  warm(g);

  // --- Card 1: one-mean ---
  const table1 = [
    { s: 3, c: 2, n: 1 }, { s: 3, c: 2, n: 2 }, { s: 3, c: 2, n: 3 },
    { s: 4, c: 2, n: 1 }, { s: 4, c: 3, n: 1 }, { s: 4, c: 2, n: 2 },
    { s: 4, c: 3, n: 2 }, { s: 5, c: 2, n: 1 }, { s: 5, c: 3, n: 1 }, { s: 5, c: 4, n: 1 },
  ];
  const p1 = retry(() => {
    const row = table1[pickIdx(g, table1.length)];
    const y = randInt(g, -6, 6);
    return { ...row, y };
  }, v => v.y !== 0);
  const A1 = p1.s + p1.n;
  const mean1 = p1.c * p1.y / A1;

  // --- Card 2: one-var ---
  const p2 = retry(() => {
    const row = table1[pickIdx(g, table1.length)];
    return row;
  }, v => !(v.s === p1.s && v.c === p1.c && v.n === p1.n));
  const A2 = p2.s + p2.n;
  const var2 = p2.s - (p2.c * p2.c) / A2;

  // --- Card 3: noise-direction ---
  const table3 = [
    { s: 2, c: 1 }, { s: 3, c: 1 }, { s: 3, c: 2 },
    { s: 4, c: 1 }, { s: 4, c: 2 }, { s: 4, c: 3 },
  ];
  const p3 = retry(() => {
    const row = table3[pickIdx(g, table3.length)];
    const y = randInt(g, -6, 6);
    const n1 = g.pick([1, 2, 4]);
    const n2 = g.pick([1, 2, 4]);
    return { ...row, y, n1, n2 };
  }, v => Math.abs(v.y) >= 2 && v.n1 !== v.n2);
  const raised = p3.n2 > p3.n1;
  const A3_1 = p3.s + p3.n1;
  const A3_2 = p3.s + p3.n2;
  const m3_1 = p3.c * p3.y / A3_1;
  const m3_2 = p3.c * p3.y / A3_2;
  const v3_1 = p3.s - (p3.c * p3.c) / A3_1;
  const v3_2 = p3.s - (p3.c * p3.c) / A3_2;
  const sd3 = Math.sqrt(Math.max(0, v3_1));
  const priorRange = 2 * Math.sqrt(p3.s);

  const shapes3: FigureShape[] = [
    { kind: 'line', points: [[-0.5, 0], [1.9, 0]], tone: 'muted', dash: true, label: t('prior mean', '先验均值')[lang === 'zh' ? 1 : 0] },
    { kind: 'point', at: [0, p3.y], tone: 'warn', label: 'y' },
    { kind: 'line', points: [[1, m3_1 - 2 * sd3], [1, m3_1 + 2 * sd3]], tone: 'accent', width: 4 },
    { kind: 'point', at: [1, m3_1], tone: 'accent', label: 'μ*' },
    { kind: 'line', points: [[1.5, -priorRange], [1.5, priorRange]], tone: 'muted', dash: true, width: 2 },
  ];

  // --- Card 4: distance ---
  const p4 = retry(() => {
    const s = g.pick([3, 4, 5]);
    const n = g.pick([1, 2, 3]);
    const ca = randInt(g, 2, s - 1);
    const cb = randInt(g, 0, ca - 1);
    return { s, n, ca, cb };
  }, v => v.s + v.n <= 7 && v.ca >= 2 && v.cb < v.ca);
  const A4 = p4.s + p4.n;
  const vA4 = p4.s - (p4.ca * p4.ca) / A4;
  const vB4 = p4.s - (p4.cb * p4.cb) / A4;
  const diff4 = vB4 - vA4;

  // --- Card 5: at-data ---
  const p5 = retry(() => {
    const s = randInt(g, 2, 6);
    const n = randInt(g, 1, 4);
    return { s, n };
  }, v => v.s !== v.n);
  const A5 = p5.s + p5.n;
  const var5 = p5.s * p5.n / A5;

  // --- Card 6: two-mean ---
  const table6 = [
    { s: 2, b: 1, n: 1, c: 1 }, { s: 2, b: 1, n: 2, c: 1 }, { s: 2, b: 1, n: 3, c: 1 },
    { s: 3, b: 1, n: 1, c: 1 }, { s: 3, b: 1, n: 1, c: 2 }, { s: 3, b: 1, n: 2, c: 1 },
    { s: 3, b: 1, n: 2, c: 2 }, { s: 3, b: 2, n: 1, c: 1 }, { s: 3, b: 2, n: 1, c: 2 },
    { s: 4, b: 1, n: 1, c: 1 }, { s: 4, b: 1, n: 1, c: 2 }, { s: 4, b: 1, n: 1, c: 3 },
  ];
  const p6 = retry(() => {
    const row = table6[pickIdx(g, table6.length)];
    const y1 = randInt(g, -4, 6);
    const y2 = randInt(g, -4, 6);
    return { ...row, y1, y2 };
  }, v => v.y1 + v.y2 !== 0);
  const A6 = p6.s + p6.n;
  const mean6 = p6.c * (p6.y1 + p6.y2) / (A6 + p6.b);

  // --- Card 7: two-var ---
  const p7 = retry(() => {
    const row = table6[pickIdx(g, table6.length)];
    return row;
  }, v => !(v.s === p6.s && v.b === p6.b && v.n === p6.n && v.c === p6.c));
  const A7 = p7.s + p7.n;
  const var7 = p7.s - (2 * p7.c * p7.c) / (A7 + p7.b);

  // --- Card 8: variance-ignores-y ---
  const p8 = retry(() => {
    const row = table1[pickIdx(g, table1.length)];
    const y = randInt(g, -5, 5);
    const lam = g.pick([2, 3, 5, 10]);
    return { ...row, y, lam };
  }, v => v.y !== 0);
  const A8 = p8.s + p8.n;
  const m8 = p8.c * p8.y / A8;
  const v8 = p8.s - (p8.c * p8.c) / A8;

  // --- Card 9: challenge ---
  const table9 = [
    { s: 2, b: 1, n: 1 }, { s: 3, b: 1, n: 1 }, { s: 3, b: 1, n: 2 },
    { s: 3, b: 2, n: 1 }, { s: 4, b: 1, n: 1 },
  ];
  const p9 = retry(() => {
    const row = table9[pickIdx(g, table9.length)];
    const c1 = randInt(g, 0, 4);
    const c2 = randInt(g, 0, 4);
    const y1 = randInt(g, -4, 6);
    const y2 = randInt(g, -4, 6);
    return { ...row, c1, c2, y1, y2 };
  }, v => {
    if (v.c1 === v.c2 || v.y1 === v.y2) return false;
    const A = v.s + v.n;
    // guard (a): the joint covariance of (f(x1), f(x2), f*) is strictly positive definite (eigenvalues s + b and s - b of K)
    const priorGap = v.s - ((v.c1 + v.c2) ** 2 / (2 * (v.s + v.b)) + (v.c1 - v.c2) ** 2 / (2 * (v.s - v.b)));
    if (priorGap <= 1e-12) return false;
    const term1 = (v.c1 + v.c2) ** 2 / (2 * (A + v.b));
    const term2 = (v.c1 - v.c2) ** 2 / (2 * (A - v.b));
    const var9 = v.s - term1 - term2;
    const mean9 = ((v.c1 + v.c2) * (v.y1 + v.y2)) / (2 * (A + v.b)) + ((v.c1 - v.c2) * (v.y1 - v.y2)) / (2 * (A - v.b));
    // guard (b): mu* is not 0
    if (Math.abs(mean9) < 1e-9) return false;
    // guard (c): every wrong route differs from the truth by at least 0.02
    const t = v.c1 * v.y1 + v.c2 * v.y2, q = v.c1 ** 2 + v.c2 ** 2;
    const wrongMeans = [t / A, t / (A + v.b), t / (v.s + v.b), (v.c1 + v.c2) * (v.y1 + v.y2) / (2 * (A + v.b)), t / (A - v.b)];
    const wrongVars = [v.s - q / A, v.s - q / (A + v.b)];
    if (wrongMeans.some(w => Math.abs(w - mean9) < 0.02) || wrongVars.some(w => Math.abs(w - var9) < 0.02)) return false;
    return true;
  });
  const A9 = p9.s + p9.n;
  const det9 = A9 * A9 - p9.b * p9.b;
  const w1_9 = (A9 * p9.y1 - p9.b * p9.y2) / det9;
  const w2_9 = (A9 * p9.y2 - p9.b * p9.y1) / det9;
  const mean9 = p9.c1 * w1_9 + p9.c2 * w2_9;
  const u1_9 = (A9 * p9.c1 - p9.b * p9.c2) / det9;
  const u2_9 = (A9 * p9.c2 - p9.b * p9.c1) / det9;
  const kTk9 = p9.c1 * u1_9 + p9.c2 * u2_9;
  const var9 = p9.s - kTk9;

  return [
    // Card 1: one-mean
    g.number({
      id: 'one-mean',
      title: t('Posterior mean from one observation', '一个观测下的后验均值'),
      prompt: t(
        `A zero-mean GP has the same prior variance k(x₁, x₁) = k(x*, x*) = ${p1.s} at both inputs and covariance k(x*, x₁) = ${p1.c} between them. One observation y = ${num(p1.y)} is made at x₁; the noise is Gaussian with variance σ² = ${p1.n}. What is the posterior mean μ* of f(x*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个零均值 GP 在两个输入处的先验方差相同：k(x₁, x₁) = k(x*, x*) = ${p1.s}，二者之间的协方差 k(x*, x₁) = ${p1.c}。在 x₁ 处得到一个观测 y = ${num(p1.y)}，噪声为高斯噪声，方差 σ² = ${p1.n}。f(x*) 的后验均值 μ* 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('μ*', 'μ*'), answer: mean1, tolerance: TOL }],
      hint: t(
        'With one observation C = k(x₁, x₁) + σ² is a single number, and μ* = k(x*, x₁) · y / C.',
        '只有一个观测时，C = k(x₁, x₁) + σ² 是一个数，μ* = k(x*, x₁) · y / C。'
      ),
      explanation: t(
        `C = ${p1.s} + ${p1.n} = ${A1}, so μ* = ${p1.c} · ${par(p1.y)} / ${A1} = ${exact(mean1)}. The noise variance sits in the denominator: it pulls the prediction toward the prior mean 0.`,
        `C = ${p1.s} + ${p1.n} = ${A1}，所以 μ* = ${p1.c} · ${par(p1.y)} / ${A1} = ${exact(mean1)}。噪声方差出现在分母里，使预测向先验均值 0 靠近。`
      ),
      audit: { kind: 'GP-06:one-mean', params: { k11: p1.s, ks1: p1.c, noise: p1.n, y1: p1.y } },
    }),

    // Card 2: one-var
    g.number({
      id: 'one-var',
      title: t('Posterior variance from one observation', '一个观测下的后验方差'),
      prompt: t(
        `A zero-mean GP has k(x₁, x₁) = k(x*, x*) = ${p2.s} and k(x*, x₁) = ${p2.c}. One observation is made at x₁ with noise variance σ² = ${p2.n}; its value is not needed. What is the posterior variance σ*² of the latent value f(x*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个零均值 GP 满足 k(x₁, x₁) = k(x*, x*) = ${p2.s}，k(x*, x₁) = ${p2.c}。在 x₁ 处做一次观测，噪声方差 σ² = ${p2.n}，观测值本身不需要。潜在函数值 f(x*) 的后验方差 σ*² 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('σ*²', 'σ*²'), answer: var2, tolerance: TOL }],
      hint: t(
        'Start from the prior variance k(x*, x*) and subtract what the observation explains: k(x*, x₁)² / C.',
        '从先验方差 k(x*, x*) 出发，减去观测能解释的部分 k(x*, x₁)² / C。'
      ),
      explanation: t(
        `C = ${p2.s} + ${p2.n} = ${A2}, so σ*² = ${p2.s} − ${p2.c}²/${A2} = ${p2.s} − ${p2.c * p2.c}/${A2} = ${exact(var2)}. This is the variance of f(x*); the variance of a noisy test observation y* would be larger by σ² = ${p2.n}.`,
        `C = ${p2.s} + ${p2.n} = ${A2}，所以 σ*² = ${p2.s} − ${p2.c}²/${A2} = ${p2.s} − ${p2.c * p2.c}/${A2} = ${exact(var2)}。这是 f(x*) 的方差；带噪声的测试观测 y* 的方差还要再加 σ² = ${p2.n}。`
      ),
      audit: { kind: 'GP-06:one-var', params: { k11: p2.s, ks1: p2.c, noise: p2.n } },
    }),

    // Card 3: noise-direction
    g.choice({
      id: 'noise-direction',
      title: t('More or less noise', '噪声变大或变小'),
      prompt: t(
        `A zero-mean GP has k(x₁, x₁) = k(x*, x*) = ${p3.s} and k(x*, x₁) = ${p3.c}. One observation y = ${num(p3.y)} is made at x₁ with noise variance σ² = ${p3.n1}. The figure shows the resulting posterior mean μ* of f(x*) with its ±2σ* range, next to the prior range ±2√${p3.s} around 0. Now the noise variance is ${raised ? 'raised' : 'lowered'} to σ² = ${p3.n2}; nothing else changes. What happens to |μ*| and to the posterior variance σ*² of f(x*)?`,
        `一个零均值 GP 满足 k(x₁, x₁) = k(x*, x*) = ${p3.s}，k(x*, x₁) = ${p3.c}。在 x₁ 处得到一个观测 y = ${num(p3.y)}，噪声方差 σ² = ${p3.n1}。图中画出了此时 f(x*) 的后验均值 μ* 及其 ±2σ* 范围，旁边是先验范围：以 0 为中心的 ±2√${p3.s}。现在噪声方差${raised ? '调大' : '调小'}为 σ² = ${p3.n2}，其余不变。|μ*| 和 f(x*) 的后验方差 σ*² 会怎样变化？`
      ),
      options: raised
        ? [
            t('|μ*| becomes smaller and σ*² becomes larger', '|μ*| 变小，σ*² 变大'),
            t('|μ*| becomes larger and σ*² becomes larger', '|μ*| 变大，σ*² 也变大'),
            t('|μ*| stays the same and σ*² becomes larger', '|μ*| 不变，σ*² 变大'),
            t('|μ*| becomes smaller and σ*² stays the same', '|μ*| 变小，σ*² 不变'),
          ]
        : [
            t('|μ*| becomes larger and σ*² becomes smaller', '|μ*| 变大，σ*² 变小'),
            t('|μ*| becomes smaller and σ*² becomes smaller', '|μ*| 变小，σ*² 也变小'),
            t('|μ*| stays the same and σ*² becomes smaller', '|μ*| 不变，σ*² 变小'),
            t('|μ*| becomes larger and σ*² stays the same', '|μ*| 变大，σ*² 不变'),
          ],
      correct: 0,
      figure: g.figure({
        alt: t(
          `Schematic, horizontal distances not to scale. On the left the observation y = ${num(p3.y)} at x₁ as a point; on the right, at x*, a solid vertical bar from μ* − 2σ* to μ* + 2σ* for noise variance ${p3.n1}, and next to it a dashed bar for the prior range from −2√${p3.s} to 2√${p3.s}; a dashed horizontal line marks the prior mean 0.`,
          `示意图，横向距离不按比例。左侧是 x₁ 处的观测 y = ${num(p3.y)}（一个点）；右侧在 x* 处，实线竖条表示噪声方差为 ${p3.n1} 时从 μ* − 2σ* 到 μ* + 2σ* 的范围，旁边的虚线竖条表示先验范围，从 −2√${p3.s} 到 2√${p3.s}；水平虚线标出先验均值 0。`
        ),
        view: fitView(shapes3, 0.15),
        axes: { yLabel: 'f' },
        shapes: shapes3,
        aspect: 'free',
      }),
      hint: t(
        'Both μ* = k(x*, x₁) y / C and σ*² = k(x*, x*) − k(x*, x₁)² / C depend on the noise only through C = k(x₁, x₁) + σ². Which way does C move, and what does dividing by it do?',
        'μ* = k(x*, x₁) y / C 与 σ*² = k(x*, x*) − k(x*, x₁)² / C 只通过 C = k(x₁, x₁) + σ² 依赖噪声。C 往哪个方向变？除以它会怎样？'
      ),
      explanation: t(
        `Only C = ${p3.s} + σ² changes: from ${p3.s} + ${p3.n1} = ${A3_1} to ${p3.s} + ${p3.n2} = ${A3_2}. μ* = ${p3.c} · ${par(p3.y)} / C goes from ${exact(m3_1)} to ${exact(m3_2)}, and σ*² = ${p3.s} − ${p3.c}²/C goes from ${exact(v3_1)} to ${exact(v3_2)}. ${raised ? 'Raised: a noisier observation is trusted less, so the prediction moves toward the prior mean 0 and the variance toward the prior variance ' + p3.s + '.' : 'Lowered: a cleaner observation is trusted more, so the prediction follows the data more closely and the variance falls.'}`,
        `只有 C = ${p3.s} + σ² 变了：从 ${p3.s} + ${p3.n1} = ${A3_1} 变为 ${p3.s} + ${p3.n2} = ${A3_2}。μ* = ${p3.c} · ${par(p3.y)} / C 从 ${exact(m3_1)} 变为 ${exact(m3_2)}，σ*² = ${p3.s} − ${p3.c}²/C 从 ${exact(v3_1)} 变为 ${exact(v3_2)}。${raised ? '调大时：噪声更大的观测更不被信任，预测向先验均值 0 靠近，方差向先验方差 ' + p3.s + ' 靠近。' : '调小时：更干净的观测更被信任，预测更贴近数据，方差变小。'}`
      ),
    }),

    // Card 4: distance
    g.number({
      id: 'distance',
      title: t('Near the data and far from it', '靠近数据与远离数据'),
      prompt: t(
        `A zero-mean GP has prior variance ${p4.s} at every input. One observation is made at x₁ with noise variance σ² = ${p4.n}. Test point A is close to x₁, with k(A, x₁) = ${p4.ca}; test point B is farther away, with k(B, x₁) = ${p4.cb}. By how much is the posterior variance of f(A) smaller than the posterior variance of f(B)? (Both are variances of the latent function value.) Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个零均值 GP 在每个输入处的先验方差都是 ${p4.s}。在 x₁ 处做一次观测，噪声方差 σ² = ${p4.n}。测试点 A 离 x₁ 较近，k(A, x₁) = ${p4.ca}；测试点 B 离 x₁ 较远，k(B, x₁) = ${p4.cb}。f(A) 的后验方差比 f(B) 的后验方差小多少？（两者都是潜在函数值的方差。）请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('σ*²(B) − σ*²(A)', 'σ*²(B) − σ*²(A)'), answer: diff4, tolerance: TOL }],
      hint: t(
        'For each test point the observation removes k(·, x₁)² / C from the prior variance, with C = k(x₁, x₁) + σ². Subtract the two results.',
        '对每个测试点，观测从先验方差中去掉 k(·, x₁)² / C，其中 C = k(x₁, x₁) + σ²。把两个结果相减。'
      ),
      explanation: t(
        `C = ${p4.s} + ${p4.n} = ${A4}. At A: σ*² = ${p4.s} − ${p4.ca}²/${A4} = ${exact(vA4)}. At B: σ*² = ${p4.s} − ${p4.cb}²/${A4} = ${exact(vB4)}. The difference is ${exact(vB4)} − ${exact(vA4)} = ${exact(diff4)}. The larger the covariance with the observed input, the more variance the observation removes; a point with k = 0 keeps the whole prior variance.`,
        `C = ${p4.s} + ${p4.n} = ${A4}。在 A 处：σ*² = ${p4.s} − ${p4.ca}²/${A4} = ${exact(vA4)}。在 B 处：σ*² = ${p4.s} − ${p4.cb}²/${A4} = ${exact(vB4)}。差为 ${exact(vB4)} − ${exact(vA4)} = ${exact(diff4)}。与已观测输入的协方差越大，观测去掉的方差越多；k = 0 的点保留全部先验方差。`
      ),
      audit: { kind: 'GP-06:distance', params: { k11: p4.s, ksa: p4.ca, ksb: p4.cb, noise: p4.n } },
    }),

    // Card 5: at-data
    g.number({
      id: 'at-data',
      title: t('Predicting at an observed input', '在已观测的输入处预测'),
      prompt: t(
        `A zero-mean GP has prior variance k(x₁, x₁) = ${p5.s}. One noisy observation is made at x₁ with noise variance σ² = ${p5.n}. Take the test point x* = x₁ itself, so k(x*, x₁) = k(x*, x*) = ${p5.s}. What is the posterior variance σ*² of the latent value f(x₁)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个零均值 GP 的先验方差 k(x₁, x₁) = ${p5.s}。在 x₁ 处做一次带噪声的观测，噪声方差 σ² = ${p5.n}。取测试点 x* 就是 x₁ 本身，所以 k(x*, x₁) = k(x*, x*) = ${p5.s}。潜在函数值 f(x₁) 的后验方差 σ*² 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('σ*²', 'σ*²'), answer: var5, tolerance: TOL }],
      hint: t(
        'Is it 0? The observation is y = f + ε, so it does not pin f(x₁) down exactly. Use σ*² = k(x*, x*) − k(x*, x₁)² / C.',
        '是 0 吗？观测是 y = f + ε，并不能把 f(x₁) 精确定下来。用 σ*² = k(x*, x*) − k(x*, x₁)² / C。'
      ),
      explanation: t(
        `C = ${p5.s} + ${p5.n} = ${A5}, so σ*² = ${p5.s} − ${p5.s}²/${A5} = ${exact(var5)}. It is not 0: the noise leaves f(x₁) uncertain. Only with σ² = 0 would the variance at an observed input be 0 (the noise-free case, GPML eq. 2.19).`,
        `C = ${p5.s} + ${p5.n} = ${A5}，所以 σ*² = ${p5.s} − ${p5.s}²/${A5} = ${exact(var5)}。它不是 0：噪声使 f(x₁) 仍有不确定性。只有当 σ² = 0 时，已观测输入处的方差才是 0（无噪声情形，GPML 式 2.19）。`
      ),
      audit: { kind: 'GP-06:at-data', params: { k11: p5.s, noise: p5.n } },
    }),

    // Card 6: two-mean
    g.number({
      id: 'two-mean',
      title: t('Posterior mean from two observations', '两个观测下的后验均值'),
      prompt: t(
        `A zero-mean GP has k(x₁, x₁) = k(x₂, x₂) = k(x*, x*) = ${p6.s}, k(x₁, x₂) = ${p6.b}, and k(x*, x₁) = k(x*, x₂) = ${p6.c}. So the covariance matrix of (f(x₁), f(x₂)) is K = ${mat([[String(p6.s), String(p6.b)], [String(p6.b), String(p6.s)]])}. The observations are y₁ = ${num(p6.y1)} at x₁ and y₂ = ${num(p6.y2)} at x₂, each with independent noise of variance σ² = ${p6.n}. What is the posterior mean μ* of f(x*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个零均值 GP 满足 k(x₁, x₁) = k(x₂, x₂) = k(x*, x*) = ${p6.s}，k(x₁, x₂) = ${p6.b}，k(x*, x₁) = k(x*, x₂) = ${p6.c}。因此 (f(x₁), f(x₂)) 的协方差矩阵为 K = ${mat([[String(p6.s), String(p6.b)], [String(p6.b), String(p6.s)]])}。观测为 x₁ 处 y₁ = ${num(p6.y1)}、x₂ 处 y₂ = ${num(p6.y2)}，各带独立噪声，方差 σ² = ${p6.n}。f(x*) 的后验均值 μ* 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('μ*', 'μ*'), answer: mean6, tolerance: TOL }],
      hint: t(
        `First C = K + σ²I = ${mat([[String(A6), String(p6.b)], [String(p6.b), String(A6)]])}. Then μ* = k*ᵀ C⁻¹ y, and the inverse of [[${A6}, ${p6.b}], [${p6.b}, ${A6}]] is [[${A6}, −${p6.b}], [−${p6.b}, ${A6}]] divided by ${A6}² − ${p6.b}².`,
        `先求 C = K + σ²I = ${mat([[String(A6), String(p6.b)], [String(p6.b), String(A6)]])}。再用 μ* = k*ᵀ C⁻¹ y；[[${A6}, ${p6.b}], [${p6.b}, ${A6}]] 的逆是 [[${A6}, −${p6.b}], [−${p6.b}, ${A6}]] 除以 ${A6}² − ${p6.b}²。`
      ),
      explanation: t(
        `C = K + σ²I = ${mat([[String(A6), String(p6.b)], [String(p6.b), String(A6)]])}, det C = ${A6}² − ${p6.b}² = ${A6 * A6 - p6.b * p6.b}, so C⁻¹ = ${mat([[frac(A6, A6 * A6 - p6.b * p6.b), frac(-p6.b, A6 * A6 - p6.b * p6.b)], [frac(-p6.b, A6 * A6 - p6.b * p6.b), frac(A6, A6 * A6 - p6.b * p6.b)]])}. Then k*ᵀC⁻¹ = (${frac(p6.c, A6 + p6.b)}, ${frac(p6.c, A6 + p6.b)}) and μ* = ${frac(p6.c, A6 + p6.b)} · (${num(p6.y1)} ${term(p6.y2)}) = ${exact(mean6)}. Shortcut: because both covariances with x* are equal, (1, 1) is an eigenvector of C with eigenvalue ${A6 + p6.b}, so μ* = ${p6.c}·(${num(p6.y1)} ${term(p6.y2)})/${A6 + p6.b}.`,
        `C = K + σ²I = ${mat([[String(A6), String(p6.b)], [String(p6.b), String(A6)]])}，det C = ${A6}² − ${p6.b}² = ${A6 * A6 - p6.b * p6.b}，所以 C⁻¹ = ${mat([[frac(A6, A6 * A6 - p6.b * p6.b), frac(-p6.b, A6 * A6 - p6.b * p6.b)], [frac(-p6.b, A6 * A6 - p6.b * p6.b), frac(A6, A6 * A6 - p6.b * p6.b)]])}。于是 k*ᵀC⁻¹ = (${frac(p6.c, A6 + p6.b)}, ${frac(p6.c, A6 + p6.b)})，μ* = ${frac(p6.c, A6 + p6.b)} · (${num(p6.y1)} ${term(p6.y2)}) = ${exact(mean6)}。捷径：x* 与两个训练点的协方差相等，所以 (1, 1) 是 C 的特征向量，特征值为 ${A6 + p6.b}，故 μ* = ${p6.c}·(${num(p6.y1)} ${term(p6.y2)})/${A6 + p6.b}。`
      ),
      audit: { kind: 'GP-06:two-mean', params: { k11: p6.s, k12: p6.b, ks: p6.c, noise: p6.n, y1: p6.y1, y2: p6.y2 } },
    }),

    // Card 7: two-var
    g.number({
      id: 'two-var',
      title: t('Posterior variance from two observations', '两个观测下的后验方差'),
      prompt: t(
        `A zero-mean GP has k(x₁, x₁) = k(x₂, x₂) = k(x*, x*) = ${p7.s}, k(x₁, x₂) = ${p7.b}, and k(x*, x₁) = k(x*, x₂) = ${p7.c}, so K = ${mat([[String(p7.s), String(p7.b)], [String(p7.b), String(p7.s)]])}. Two observations are made at x₁ and x₂, each with independent noise of variance σ² = ${p7.n}; their values are not needed. What is the posterior variance σ*² of the latent value f(x*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个零均值 GP 满足 k(x₁, x₁) = k(x₂, x₂) = k(x*, x*) = ${p7.s}，k(x₁, x₂) = ${p7.b}，k(x*, x₁) = k(x*, x₂) = ${p7.c}，所以 K = ${mat([[String(p7.s), String(p7.b)], [String(p7.b), String(p7.s)]])}。在 x₁ 和 x₂ 处各做一次观测，各带独立噪声，方差 σ² = ${p7.n}，观测值不需要。潜在函数值 f(x*) 的后验方差 σ*² 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('σ*²', 'σ*²'), answer: var7, tolerance: TOL }],
      hint: t(
        `With k* = (${p7.c}, ${p7.c}) the vector (1, 1) is an eigenvector of C = K + σ²I = ${mat([[String(A7), String(p7.b)], [String(p7.b), String(A7)]])}. What is its eigenvalue, and what is k*ᵀ C⁻¹ k*?`,
        `k* = (${p7.c}, ${p7.c}) 时，(1, 1) 是 C = K + σ²I = ${mat([[String(A7), String(p7.b)], [String(p7.b), String(A7)]])} 的特征向量。它的特征值是多少？k*ᵀ C⁻¹ k* 又是多少？`
      ),
      explanation: t(
        `C = ${mat([[String(A7), String(p7.b)], [String(p7.b), String(A7)]])} has eigenvalue ${A7} + ${p7.b} = ${A7 + p7.b} on (1, 1), so C⁻¹k* = (${frac(p7.c, A7 + p7.b)}, ${frac(p7.c, A7 + p7.b)}) and k*ᵀC⁻¹k* = 2 · ${p7.c}²/${A7 + p7.b} = ${frac(2 * p7.c * p7.c, A7 + p7.b)}. Hence σ*² = ${p7.s} − ${frac(2 * p7.c * p7.c, A7 + p7.b)} = ${exact(var7)}. The observed values play no role in the variance.`,
        `C = ${mat([[String(A7), String(p7.b)], [String(p7.b), String(A7)]])} 在 (1, 1) 方向上的特征值为 ${A7} + ${p7.b} = ${A7 + p7.b}，所以 C⁻¹k* = (${frac(p7.c, A7 + p7.b)}, ${frac(p7.c, A7 + p7.b)})，k*ᵀC⁻¹k* = 2 · ${p7.c}²/${A7 + p7.b} = ${frac(2 * p7.c * p7.c, A7 + p7.b)}。因此 σ*² = ${p7.s} − ${frac(2 * p7.c * p7.c, A7 + p7.b)} = ${exact(var7)}。方差与观测值无关。`
      ),
      audit: { kind: 'GP-06:two-var', params: { k11: p7.s, k12: p7.b, ks: p7.c, noise: p7.n } },
    }),

    // Card 8: variance-ignores-y
    g.choice({
      id: 'variance-ignores-y',
      title: t('Does the variance depend on the observed value?', '方差依赖观测值吗？'),
      prompt: t(
        `A zero-mean GP has k(x₁, x₁) = k(x*, x*) = ${p8.s}, k(x*, x₁) = ${p8.c} and noise variance σ² = ${p8.n}. With the observation y = ${num(p8.y)} at x₁ the model gives a posterior mean μ* and a posterior variance σ*² for f(x*). A colleague repeats it with the observed value multiplied by ${p8.lam}, that is y = ${num(p8.lam * p8.y)}, and the same x₁, kernel and noise. Which statement is correct?`,
        `一个零均值 GP 满足 k(x₁, x₁) = k(x*, x*) = ${p8.s}，k(x*, x₁) = ${p8.c}，噪声方差 σ² = ${p8.n}。在 x₁ 处观测到 y = ${num(p8.y)} 时，模型给出 f(x*) 的后验均值 μ* 和后验方差 σ*²。同事重做一次，观测值乘以 ${p8.lam}，即 y = ${num(p8.lam * p8.y)}，x₁、核函数和噪声都不变。下列哪条说法正确？`
      ),
      options: [
        t(`μ* is multiplied by ${p8.lam}; σ*² stays the same`, `μ* 变为原来的 ${p8.lam} 倍；σ*² 保持不变`),
        t(`μ* is multiplied by ${p8.lam}; σ*² is multiplied by ${p8.lam * p8.lam}`, `μ* 变为原来的 ${p8.lam} 倍；σ*² 变为原来的 ${p8.lam * p8.lam} 倍`),
        t(`μ* is multiplied by ${p8.lam}; σ*² is multiplied by ${p8.lam}`, `μ* 变为原来的 ${p8.lam} 倍；σ*² 也变为原来的 ${p8.lam} 倍`),
        t('μ* and σ*² both stay the same, because the kernel and the noise did not change', 'μ* 与 σ*² 都保持不变，因为核函数和噪声都没变'),
      ],
      correct: 0,
      hint: t(
        'Look at where y appears in μ* = k*ᵀ C⁻¹ y and in σ*² = k** − k*ᵀ C⁻¹ k*.',
        '看看 y 出现在 μ* = k*ᵀ C⁻¹ y 里，还是出现在 σ*² = k** − k*ᵀ C⁻¹ k* 里。'
      ),
      explanation: t(
        `C = ${p8.s} + ${p8.n} = ${A8}. With y = ${num(p8.y)}: μ* = ${p8.c} · ${par(p8.y)} / ${A8} = ${exact(m8)}; with y = ${num(p8.lam * p8.y)}: μ* = ${exact(p8.lam * m8)}, which is ${p8.lam} times as large (the posterior mean is linear in y, Lecture 3 p. 9). In both cases σ*² = ${p8.s} − ${p8.c}²/${A8} = ${exact(v8)}, because y does not appear in the variance formula (Lecture 3 p. 6, eq. 13): the variance depends on the inputs through the kernel and on σ² only.`,
        `C = ${p8.s} + ${p8.n} = ${A8}。y = ${num(p8.y)} 时：μ* = ${p8.c} · ${par(p8.y)} / ${A8} = ${exact(m8)}；y = ${num(p8.lam * p8.y)} 时：μ* = ${exact(p8.lam * m8)}，是原来的 ${p8.lam} 倍（后验均值是 y 的线性函数，第 3 讲第 9 页）。两种情形下 σ*² = ${p8.s} − ${p8.c}²/${A8} = ${exact(v8)}，因为方差公式里没有 y（第 3 讲第 6 页，式 13）：方差只通过核函数依赖输入，并依赖 σ²。`
      ),
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: a new model', '挑战：新的模型'),
      prompt: t(
        `A zero-mean GP has k(x₁, x₁) = k(x₂, x₂) = k(x*, x*) = ${p9.s} and k(x₁, x₂) = ${p9.b}. The test point has covariance k(x*, x₁) = ${p9.c1} with the first training input and k(x*, x₂) = ${p9.c2} with the second. The observations are y₁ = ${num(p9.y1)} at x₁ and y₂ = ${num(p9.y2)} at x₂, each with independent Gaussian noise of variance σ² = ${p9.n}. Find the posterior mean μ* and the posterior variance σ*² of the latent value f(x*). Give integers, fractions or decimals rounded to 2 places.`,
        `一个零均值 GP 满足 k(x₁, x₁) = k(x₂, x₂) = k(x*, x*) = ${p9.s}，k(x₁, x₂) = ${p9.b}。测试点与第一个训练输入的协方差为 k(x*, x₁) = ${p9.c1}，与第二个训练输入的协方差为 k(x*, x₂) = ${p9.c2}。观测为 x₁ 处 y₁ = ${num(p9.y1)}、x₂ 处 y₂ = ${num(p9.y2)}，各带独立高斯噪声，方差 σ² = ${p9.n}。求潜在函数值 f(x*) 的后验均值 μ* 和后验方差 σ*²。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('μ*', 'μ*'), answer: mean9, tolerance: TOL },
        { label: t('σ*²', 'σ*²'), answer: var9, tolerance: TOL },
      ],
      hint: t(
        'Form C = K + σ²I, invert the 2 × 2 matrix (keep the diagonal entries, change the sign of the off-diagonal entries, divide by the determinant: diagonal² − off-diagonal²), then use μ* = k*ᵀ C⁻¹ y and σ*² = k** − k*ᵀ C⁻¹ k*.',
        '先求 C = K + σ²I，再求这个 2 × 2 矩阵的逆（对角元保留，非对角元变号，再除以行列式：对角元² − 非对角元²），然后用 μ* = k*ᵀ C⁻¹ y 和 σ*² = k** − k*ᵀ C⁻¹ k*。'
      ),
      explanation: t(
        `C = K + σ²I = ${mat([[String(A9), String(p9.b)], [String(p9.b), String(A9)]])}, det C = ${A9}² − ${p9.b}² = ${det9}. C⁻¹y = (${exact(w1_9)}, ${exact(w2_9)}), so μ* = ${p9.c1}·(${exact(w1_9)}) + ${p9.c2}·(${exact(w2_9)}) = ${exact(mean9)}; C⁻¹k* = (${exact(u1_9)}, ${exact(u2_9)}), so k*ᵀC⁻¹k* = ${exact(kTk9)} and σ*² = ${p9.s} − ${exact(kTk9)} = ${exact(var9)}. This game does not assess non-zero prior mean functions, the variance of a noisy y*, kernel evaluation or hyperparameter fitting.`,
        `C = K + σ²I = ${mat([[String(A9), String(p9.b)], [String(p9.b), String(A9)]])}，det C = ${A9}² − ${p9.b}² = ${det9}。C⁻¹y = (${exact(w1_9)}, ${exact(w2_9)})，所以 μ* = ${p9.c1}·(${exact(w1_9)}) + ${p9.c2}·(${exact(w2_9)}) = ${exact(mean9)}；C⁻¹k* = (${exact(u1_9)}, ${exact(u2_9)})，所以 k*ᵀC⁻¹k* = ${exact(kTk9)}，σ*² = ${p9.s} − ${exact(kTk9)} = ${exact(var9)}。本游戏不考查非零先验均值函数、带噪声的 y* 的方差、核函数取值和超参数拟合。`
      ),
      audit: { kind: 'GP-06:challenge', params: { k11: p9.s, k12: p9.b, ks1: p9.c1, ks2: p9.c2, noise: p9.n, y1: p9.y1, y2: p9.y2 } },
    }),
  ];
};
