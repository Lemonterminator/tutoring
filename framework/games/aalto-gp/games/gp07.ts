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

const T1: [number, number, number][] = [[3, 2, 1], [3, 2, 2], [4, 2, 1], [4, 3, 1]];
const T3: [number, number, number][] = [[3, 1, 1], [3, 2, 1], [2, 1, 2], [4, 1, 1], [4, 2, 1], [4, 3, 1], [3, 1, 2], [3, 2, 2]];
const T7: [number, number, number, number][] = [
  [2, 1, 1, 1], [2, 2, 1, 1], [3, 1, 1, 1], [3, 1, 1, 2], [3, 2, -1, 1],
  [4, 1, -1, 1], [4, 1, 3, 1], [4, 1, 3, 2], [4, 1, 3, 3], [4, 2, -2, 1],
  [4, 2, -1, 1], [4, 2, -1, 2], [4, 2, 2, 1], [4, 2, 2, 2], [4, 2, 2, 3],
];

export const gp07: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-07');
  warm(g);

  // Card 1: constant-mean
  const p1 = retry(() => {
    const [s, c, n] = T1[g.random(0, T1.length - 1)];
    const m = g.pick([1, -1, 2, -2, 3, -3]);
    const d = g.pick([1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]);
    const y = m + d;
    return { s, c, n, m, d, y };
  }, v => {
    if (v.y === 0) return false;
    const A = v.s + v.n;
    const truth = v.m + v.c * (v.y - v.m) / A;
    const wrongs = [
      v.c * v.y / A, v.c * v.d / A, v.m + v.c * v.y / A, v.m + v.c * v.d / v.s,
      v.m + v.c * v.d / (A + 1), v.y, v.m + v.c * v.d / v.n, v.m - v.c * v.d / A, v.m + v.d / A,
    ];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const A1 = p1.s + p1.n;
  const ans1 = p1.m + p1.c * (p1.y - p1.m) / A1;

  // Card 2: mean-at-test
  const p2 = retry(() => {
    const [s, c, n] = T1[g.random(0, T1.length - 1)];
    const m1 = g.random(-3, 3);
    const ms = g.pick([1, -1, 2, -2, 3, -3]);
    const d = g.pick([1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]);
    const y = m1 + d;
    return { s, c, n, m1, ms, d, y };
  }, v => {
    if (v.ms === v.m1) return false;
    const A = v.s + v.n;
    const truth = v.ms + v.c * (v.y - v.m1) / A;
    const wrongs = [
      v.ms + v.c * v.y / A, v.m1 + v.c * v.d / A, v.ms + v.c * (v.y - v.ms) / A,
      v.c * v.d / A, v.ms + v.c * v.d / v.s, v.m1 + v.ms + v.c * v.d / A,
      v.c * v.y / A, v.ms - v.c * v.d / A, v.ms + v.c * (v.y - v.m1) / (A + 1),
    ];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const A2 = p2.s + p2.n;
  const ans2 = p2.ms + p2.c * (p2.y - p2.m1) / A2;

  // Card 3: shift-effect
  const p3 = retry(() => {
    const [s, c, n] = T3[g.random(0, T3.length - 1)];
    const m0 = g.pick([1, -1, 2, -2, 3, -3, 4, -4]);
    const y = g.pick([1, -1, 2, -2, 3, -3, 4, -4]);
    return { s, c, n, m0, y };
  }, () => true);
  const A3 = p3.s + p3.n;
  const shift3 = p3.m0 * (A3 - p3.c) / A3;
  const meanA3 = p3.c * p3.y / A3;
  const meanB3 = p3.m0 + p3.c * (p3.y - p3.m0) / A3;
  const var3 = p3.s - p3.c * p3.c / A3;

  // Card 4: f-or-y
  const p4 = retry(() => {
    const [s, c, n] = T1[g.random(0, T1.length - 1)];
    const m = g.pick([1, -1, 2, -2, 3, -3]);
    const y = g.pick([1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]);
    return { s, c, n, m, y };
  }, v => {
    const A = v.s + v.n;
    const vLatent = v.s - v.c * v.c / A;
    const vNoisy = vLatent + v.n;
    const wrongs1 = [v.c * v.c / A, v.s - v.c / A, v.s - v.c * v.c / v.s, v.s - v.c * v.c / (A + v.n), v.s];
    const wrongs2 = [vLatent, v.s + v.n, vLatent - v.n, vLatent * v.n, v.s + v.n - v.c * v.c / v.s, vLatent + 2 * v.n, v.s + v.n - v.c / A];
    return wrongs1.every(w => Math.abs(vLatent - w) >= 0.02) && wrongs2.every(w => Math.abs(vNoisy - w) >= 0.02);
  });
  const A4 = p4.s + p4.n;
  const v4 = p4.s - p4.c * p4.c / A4;
  const vy4 = v4 + p4.n;

  // Card 5: noisy-floor
  const p5 = retry(() => {
    const n = g.pick([2, 3, 4, 5]);
    const q = g.random(1, n - 1);
    return { n, q };
  }, () => true);

  // Card 6: far-away
  const p6 = retry(() => {
    const s = g.pick([2, 3, 4]);
    const n = g.pick([1, 2, 3]);
    const ms = g.pick([1, -1, 2, -2, 3, -3]);
    const m1 = g.random(-3, 3);
    const d = g.pick([1, -1, 2, -2, 3, -3, 4, -4]);
    const y = m1 + d;
    return { s, n, ms, m1, d, y };
  }, v => {
    if (v.s + v.n === v.s * v.n) return false;
    return v.ms !== 0 && v.ms !== v.y && v.ms !== v.m1 && v.ms !== v.d;
  });
  const ans6a = p6.ms;
  const ans6b = p6.s + p6.n;

  // Card 7: two-shift
  const p7 = retry(() => {
    const [s, n, b, c] = T7[g.random(0, T7.length - 1)];
    const m = g.pick([1, -1, 2, -2, 3, -3]);
    const d1 = g.pick([1, -1, 2, -2, 3, -3, 4, -4]);
    const d2 = g.pick([1, -1, 2, -2, 3, -3, 4, -4]);
    const y1 = m + d1;
    const y2 = m + d2;
    return { s, n, b, c, m, d1, d2, y1, y2 };
  }, v => {
    if (v.d1 === v.d2 || v.d1 + v.d2 === 0) return false;
    const a = v.s + v.n;
    const S = a + v.b;
    const mean = v.m + v.c * (v.d1 + v.d2) / S;
    const varr = v.s - 2 * v.c * v.c / S;
    const wrongsMean = [
      v.m + v.c * v.d1 / a, v.m + v.c * v.d2 / a, v.m + v.c * (v.d1 + v.d2) / a,
      v.m + v.c * (v.d1 + v.d2) / (a - v.b), v.c * (v.d1 + v.d2) / S,
      v.m + v.c * (v.y1 + v.y2) / S, v.m + 2 * v.c * (v.d1 + v.d2) / S,
      v.m + v.c * (v.d1 + v.d2) / (2 * S), v.m - v.c * (v.d1 + v.d2) / S,
    ];
    const wrongsVar = [
      v.s - v.c * v.c / a, v.s - 2 * v.c * v.c / a, v.s - 2 * v.c * v.c / (a - v.b),
      2 * v.c * v.c / S, v.s - v.c * v.c / S, v.s + 2 * v.c * v.c / S, varr + v.n,
    ];
    return wrongsMean.every(w => Math.abs(mean - w) >= 0.02) && wrongsVar.every(w => Math.abs(varr - w) >= 0.02);
  });
  const a7 = p7.s + p7.n;
  const S7 = a7 + p7.b;
  const ans7a = p7.m + p7.c * (p7.d1 + p7.d2) / S7;
  const ans7b = p7.s - 2 * p7.c * p7.c / S7;

  // Card 8: challenge
  const p8 = retry(() => {
    const b = g.pick([1, -1]);
    const c1 = g.pick([1, -1, 2, -2, 3, -3]);
    const c2 = g.pick([1, -1, 2, -2, 3, -3]);
    const ss = g.random(3, 7);
    const d1 = g.pick([1, -1, 2, -2, 3, -3]);
    const d2 = g.pick([1, -1, 2, -2, 3, -3]);
    const m1 = g.pick([1, -1, 2, -2]);
    const m2 = g.pick([1, -1, 2, -2]);
    const ms = g.pick([1, -1, 2, -2, 3, -3]);
    const y1 = m1 + d1;
    const y2 = m2 + d2;
    return { b, c1, c2, ss, d1, d2, m1, m2, ms, y1, y2 };
  }, v => {
    const { b, c1, c2, ss, d1, d2, m1, m2, ms } = v;
    if (c1 === c2) return false;
    if (Math.abs(d1) === Math.abs(d2)) return false;
    if (m1 === m2) return false;
    if (ms === m1 || ms === m2) return false;
    // (a) 3x3 prior strictly positive definite
    const M11 = 2;
    const M12 = 2 * 2 - b * b;
    const det3 = 2 * (2 * ss - c2 * c2) - b * (b * ss - c1 * c2) + c1 * (b * c2 - 2 * c1);
    if (M11 <= 0 || M12 <= 0 || det3 <= 0) return false;
    // (b) V >= 1/2
    const w1 = (3 * c1 - b * c2) / 8;
    const w2 = (3 * c2 - b * c1) / 8;
    const V = ss - (c1 * w1 + c2 * w2);
    if (V < 0.5) return false;
    // (c) X != 0 and |w1*m1 + w2*m2| >= 0.02
    const X = w1 * d1 + w2 * d2;
    const offset = w1 * m1 + w2 * m2;
    if (X === 0 || Math.abs(offset) < 0.02) return false;
    // (d) guards
    const wrongsX = [
      (c1 * d1 + c2 * d2) / 3, (c1 * d1 + c2 * d2) / (3 + b),
      ((3 * c1 + b * c2) / 8) * d1 + ((3 * c2 + b * c1) / 8) * d2,
      -X, w1 * d1, w2 * d2, (c1 * d1 + c2 * d2) / (3 - b), (c1 * d1 + c2 * d2) / (2 * (3 + b)),
    ];
    const vy = V + 1;
    const wrongsV = [
      V, ss + 1 - (c1 * c1 + c2 * c2) / 3, ss + 1 - (c1 * c1 + c2 * c2) / 8,
      ss + 1 - (c1 * ((3 * c1 + b * c2) / 8) + c2 * ((3 * c2 + b * c1) / 8)),
      ss + 1 - c1 * c1 / 3, ss - (c1 * c1 + c2 * c2) / 3,
      c1 * w1 + c2 * w2, ss - (c1 * c1 + c2 * c2) / (3 + b),
    ];
    return wrongsX.every(w => Math.abs(X - w) >= 0.02) && wrongsV.every(w => Math.abs(vy - w) >= 0.02);
  });
  const w8_1 = (3 * p8.c1 - p8.b * p8.c2) / 8;
  const w8_2 = (3 * p8.c2 - p8.b * p8.c1) / 8;
  const X8 = w8_1 * p8.d1 + w8_2 * p8.d2;
  const ans8a = p8.ms + X8;
  const V8 = p8.ss - (p8.c1 * w8_1 + p8.c2 * w8_2);
  const ans8b = V8 + 1;

  return [
    g.number({
      id: 'constant-mean',
      title: t('A non-zero prior mean', '非零的先验均值'),
      prompt: t(
        `A GP has the constant prior mean function m(x) = ${num(p1.m)}, the same prior variance k(x₁, x₁) = k(x*, x*) = ${num(p1.s)} at both inputs and covariance k(x*, x₁) = ${num(p1.c)} between them. One observation y = ${num(p1.y)} is made at x₁; the noise variance is σ² = ${num(p1.n)}. What is the posterior mean μ* of f(x*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个 GP 的先验均值函数为常数 m(x) = ${num(p1.m)}，两个输入处的先验方差相同：k(x₁, x₁) = k(x*, x*) = ${num(p1.s)}，二者之间的协方差 k(x*, x₁) = ${num(p1.c)}。在 x₁ 处得到一个观测 y = ${num(p1.y)}，噪声方差 σ² = ${num(p1.n)}。f(x*) 的后验均值 μ* 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('μ*', 'μ*'), answer: ans1, tolerance: 0.006 }],
      hint: t(
        'Subtract the prior mean from the data first, then apply the usual formula, then add the prior mean back.',
        '先从数据中减去先验均值，再套用通常的公式，最后加回先验均值。'
      ),
      explanation: t(
        `C = ${num(p1.s)} + ${par(p1.n)} = ${A1}. The data minus the prior mean is y − m = ${num(p1.y)} − ${par(p1.m)} = ${num(p1.d)}. So μ* = m + k(x*, x₁)(y − m)/C = ${num(p1.m)} + ${par(p1.c)}·(${num(p1.d)})/${A1} = ${exact(ans1)} (Lecture 3 p. 7, eq. 17; GPML eq. 2.38). Applying the zero-mean formula to the raw y would give ${par(p1.c)}·(${num(p1.y)})/${A1} = ${exact(p1.c * p1.y / A1)}, which is the posterior mean of a model with prior mean 0.`,
        `C = ${num(p1.s)} + ${par(p1.n)} = ${A1}。数据减去先验均值：y − m = ${num(p1.y)} − ${par(p1.m)} = ${num(p1.d)}。所以 μ* = m + k(x*, x₁)(y − m)/C = ${num(p1.m)} + ${par(p1.c)}·(${num(p1.d)})/${A1} = ${exact(ans1)}（第 3 讲第 7 页，式 17；GPML 式 2.38）。把零均值公式直接用在原始 y 上会得到 ${par(p1.c)}·(${num(p1.y)})/${A1} = ${exact(p1.c * p1.y / A1)}，那是先验均值为 0 的模型的后验均值。`
      ),
      audit: { kind: 'GP-07:constant-mean', params: { s: p1.s, c: p1.c, n: p1.n, m: p1.m, y: p1.y } },
    }),
    g.number({
      id: 'mean-at-test',
      title: t('Different prior means', '不同位置的先验均值'),
      prompt: t(
        `A GP has prior mean m(x₁) = ${num(p2.m1)} at the observed input and m(x*) = ${num(p2.ms)} at the test input. The prior variance is k(x₁, x₁) = k(x*, x*) = ${num(p2.s)} and k(x*, x₁) = ${num(p2.c)}. One observation y = ${num(p2.y)} is made at x₁ with noise variance σ² = ${num(p2.n)}. What is the posterior mean μ* of f(x*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个 GP 在观测输入处的先验均值为 m(x₁) = ${num(p2.m1)}，在测试输入处为 m(x*) = ${num(p2.ms)}。先验方差 k(x₁, x₁) = k(x*, x*) = ${num(p2.s)}，k(x*, x₁) = ${num(p2.c)}。在 x₁ 处得到一个观测 y = ${num(p2.y)}，噪声方差 σ² = ${num(p2.n)}。f(x*) 的后验均值 μ* 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('μ*', 'μ*'), answer: ans2, tolerance: 0.006 }],
      hint: t(
        'The data are centred with the prior mean at the observed input; the prior mean at the test input is added at the end.',
        '数据用观测输入处的先验均值去中心化；测试输入处的先验均值在最后加上。'
      ),
      explanation: t(
        `C = ${num(p2.s)} + ${par(p2.n)} = ${A2}. At the observed input y − m(x₁) = ${num(p2.y)} − ${par(p2.m1)} = ${num(p2.d)}. So μ* = m(x*) + k(x*, x₁)(y − m(x₁))/C = ${num(p2.ms)} + ${par(p2.c)}·(${num(p2.d)})/${A2} = ${exact(ans2)} (Lecture 3 p. 7, eq. 17, where m is the prior mean at the observation and m* at the test point). Using m(x₁) = ${num(p2.m1)} for the final offset, or ${num(p2.ms)} for the centring, gives a different number.`,
        `C = ${num(p2.s)} + ${par(p2.n)} = ${A2}。观测输入处 y − m(x₁) = ${num(p2.y)} − ${par(p2.m1)} = ${num(p2.d)}。所以 μ* = m(x*) + k(x*, x₁)(y − m(x₁))/C = ${num(p2.ms)} + ${par(p2.c)}·(${num(p2.d)})/${A2} = ${exact(ans2)}（第 3 讲第 7 页，式 17，其中 m 是观测处的先验均值，m* 是测试点处的先验均值）。最后一步加 m(x₁) = ${num(p2.m1)}，或用 ${num(p2.ms)} 做中心化，都会得到不同的数。`
      ),
      audit: { kind: 'GP-07:mean-at-test', params: { s: p2.s, c: p2.c, n: p2.n, m1: p2.m1, ms: p2.ms, y: p2.y } },
    }),
    g.choice({
      id: 'shift-effect',
      title: t('Moving the prior mean', '移动先验均值'),
      prompt: t(
        `Two GPs have the same kernel: k(x₁, x₁) = k(x*, x*) = ${num(p3.s)}, k(x*, x₁) = ${num(p3.c)}. The observation y = ${num(p3.y)} at x₁ has noise variance σ² = ${num(p3.n)}. GP A has prior mean m(x) = 0; GP B has the constant prior mean m(x) = ${num(p3.m0)}. Compare the posterior of f(x*) in B with that in A. Which statement is correct?`,
        `两个 GP 的核相同：k(x₁, x₁) = k(x*, x*) = ${num(p3.s)}，k(x*, x₁) = ${num(p3.c)}。x₁ 处的观测 y = ${num(p3.y)}，噪声方差 σ² = ${num(p3.n)}。GP A 的先验均值为 m(x) = 0；GP B 的先验均值为常数 m(x) = ${num(p3.m0)}。比较 B 与 A 中 f(x*) 的后验。下列哪条说法正确？`
      ),
      options: [
        t(`The means differ by ${exact(shift3)} and the variances are equal.`, `均值相差 ${exact(shift3)}，方差相同。`),
        t(`The means differ by ${num(p3.m0)}, the full shift of the prior mean, and the variances are equal.`, `均值相差 ${num(p3.m0)}，即先验均值的全部移动量，方差相同。`),
        t('The means are equal and the variances differ.', '均值相同，方差不同。'),
        t('Both the means and the variances differ.', '均值和方差都不同。'),
      ],
      correct: 0,
      hint: t(
        'Where does the prior mean m appear in the formula for μ*, and where in the formula for σ*²?',
        '先验均值 m 出现在 μ* 的公式里，还是 σ*² 的公式里？'
      ),
      explanation: t(
        `A: μ* = ${par(p3.c)}·(${num(p3.y)})/${A3} = ${exact(meanA3)}. B: μ* = m + c(y − m)/C = ${num(p3.m0)} + ${par(p3.c)}·(${num(p3.y)} − ${par(p3.m0)})/${A3} = ${exact(meanB3)}. The difference is ${num(p3.m0)} − ${par(p3.c)}·(${num(p3.m0)})/${A3} = ${exact(shift3)}: the mean moves, but by less than m = ${num(p3.m0)}, because the data pull it back. Variance: σ*² = ${num(p3.s)} − ${par(p3.c)}²/${A3} = ${exact(var3)} in both, since m does not appear in it (GPML p. 45: the predictive variance remains unchanged).`,
        `A：μ* = ${par(p3.c)}·(${num(p3.y)})/${A3} = ${exact(meanA3)}。B：μ* = m + c(y − m)/C = ${num(p3.m0)} + ${par(p3.c)}·(${num(p3.y)} − ${par(p3.m0)})/${A3} = ${exact(meanB3)}。差为 ${num(p3.m0)} − ${par(p3.c)}·(${num(p3.m0)})/${A3} = ${exact(shift3)}：均值发生了移动，但小于 m = ${num(p3.m0)}，因为数据把它拉了回来。方差：两者的 σ*² = ${num(p3.s)} − ${par(p3.c)}²/${A3} = ${exact(var3)}，因为 m 不出现在其中（GPML 第 45 页：预测方差不变）。`
      ),
    }),
    g.number({
      id: 'f-or-y',
      title: t('Latent value or new measurement', '潜在值还是新的测量'),
      prompt: t(
        `A GP has the constant prior mean m(x) = ${num(p4.m)}, k(x₁, x₁) = k(x*, x*) = ${num(p4.s)} and k(x*, x₁) = ${num(p4.c)}. One observation y = ${num(p4.y)} is made at x₁ with noise variance σ² = ${num(p4.n)}. Find the posterior variance of the latent value f(x*) and the predictive variance of a new noisy observation y* at x*. Give integers, fractions or decimals rounded to 2 places.`,
        `一个 GP 的先验均值为常数 m(x) = ${num(p4.m)}，k(x₁, x₁) = k(x*, x*) = ${num(p4.s)}，k(x*, x₁) = ${num(p4.c)}。在 x₁ 处得到一个观测 y = ${num(p4.y)}，噪声方差 σ² = ${num(p4.n)}。求潜在函数值 f(x*) 的后验方差，以及 x* 处新的带噪声观测 y* 的预测方差。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('Var(f*|y)', 'Var(f*|y)'), answer: v4, tolerance: 0.006 },
        { label: t('Var(y*|y)', 'Var(y*|y)'), answer: vy4, tolerance: 0.006 },
      ],
      hint: t(
        'The observation y* is a new noisy measurement: f* plus fresh noise of variance σ². Do m and y appear in a variance?',
        'y* 是一次新的带噪声测量：f* 加上方差为 σ² 的新噪声。m 和 y 会出现在方差里吗？'
      ),
      explanation: t(
        `Latent: σ*² = ${num(p4.s)} − ${par(p4.c)}²/${A4} = ${num(p4.s)} − ${p4.c * p4.c}/${A4} = ${exact(v4)}, with A = ${num(p4.s)} + ${par(p4.n)} = ${A4}. The noisy test value y* = f* + ε adds the independent noise variance: Var(y*|y) = ${exact(v4)} + ${par(p4.n)} = ${exact(vy4)} (GPML p. 36; Lecture 3 p. 12). The prior mean ${num(p4.m)} and the observed value ${num(p4.y)} do not appear in either variance. This game does not assess fitting hyperparameters or the marginal likelihood.`,
        `潜在值：σ*² = ${num(p4.s)} − ${par(p4.c)}²/${A4} = ${num(p4.s)} − ${p4.c * p4.c}/${A4} = ${exact(v4)}，其中 A = ${num(p4.s)} + ${par(p4.n)} = ${A4}。带噪声的测试值 y* = f* + ε 再加上独立的噪声方差：Var(y*|y) = ${exact(v4)} + ${par(p4.n)} = ${exact(vy4)}（GPML 第 36 页；第 3 讲第 12 页）。先验均值 ${num(p4.m)} 和观测值 ${num(p4.y)} 都不出现在这两个方差里。本游戏不考查超参数拟合和边际似然。`
      ),
      audit: { kind: 'GP-07:f-or-y', params: { s: p4.s, c: p4.c, n: p4.n, m: p4.m, y: p4.y } },
    }),
    g.choice({
      id: 'noisy-floor',
      title: t('A suspicious predictive variance', '一个可疑的预测方差'),
      prompt: t(
        `A GP regression model has observation noise variance σ² = ${num(p5.n)}. After many observations, a student reports the predictive variance of a new noisy observation y* at a test input as Var(y*|y) = ${num(p5.q)}. Which statement is correct?`,
        `一个 GP 回归模型的观测噪声方差 σ² = ${num(p5.n)}。有了许多观测之后，一位同学报出测试输入处新的带噪声观测 y* 的预测方差为 Var(y*|y) = ${num(p5.q)}。下列哪条说法正确？`
      ),
      options: [
        t(`Impossible: Var(y*|y) = σ*² + σ² is at least σ² = ${num(p5.n)}.`, `不可能：Var(y*|y) = σ*² + σ² 至少为 σ² = ${num(p5.n)}。`),
        t('Possible: enough data can drive the variance of y* down to 0.', '可能：足够多的数据可以把 y* 的方差降到 0。'),
        t(`Impossible: Var(y*|y) must equal σ² = ${num(p5.n)} exactly, whatever the data.`, `不可能：无论观测数据有多少，Var(y*|y) 都必须恰好等于 σ² = ${num(p5.n)}。`),
        t('Possible: the noise only affects the mean of y*, not its variance.', '可能：噪声只影响 y* 的均值，不影响它的方差。'),
      ],
      correct: 0,
      hint: t(
        'Write y* = f* + ε. What is the smallest possible variance of the noise part ε?',
        '把 y* 写成 f* + ε。噪声部分 ε 的方差最小是多少？'
      ),
      explanation: t(
        `A new measurement is y* = f(x*) + ε with fresh noise of variance σ² = ${num(p5.n)}, so Var(y*|y) = σ*² + ${par(p5.n)}, where σ*² ≥ 0 is the posterior variance of f(x*). It can never be smaller than ${num(p5.n)}; the reported ${num(p5.q)} is smaller. More data shrink σ*² towards 0, but the noise of a new measurement remains (GPML p. 36; Lecture 3 p. 12). This game does not assess hyperparameter fitting.`,
        `新的测量是 y* = f(x*) + ε，其中新噪声的方差为 σ² = ${num(p5.n)}，所以 Var(y*|y) = σ*² + ${par(p5.n)}，这里 σ*² ≥ 0 是 f(x*) 的后验方差。它不可能小于 ${num(p5.n)}，而报出的 ${num(p5.q)} 更小。更多数据会使 σ*² 趋向 0，但新测量的噪声仍然存在（GPML 第 36 页；第 3 讲第 12 页）。本游戏不考查超参数拟合。`
      ),
    }),
    g.number({
      id: 'far-away',
      title: t('Far from the data', '远离数据'),
      prompt: t(
        `A GP has the constant prior mean m(x) = ${num(p6.m1)} at the observed input and prior mean m(x*) = ${num(p6.ms)} at a test input x* that is far from the data, so that k(x*, x₁) = 0. The prior variance is k(x₁, x₁) = k(x*, x*) = ${num(p6.s)}. One observation y = ${num(p6.y)} is made at x₁ with noise variance σ² = ${num(p6.n)}. Find the posterior mean μ* of f(x*) and the predictive variance of a new noisy observation y* at x*. Give integers, fractions or decimals rounded to 2 places.`,
        `一个 GP 在观测输入处的先验均值为常数 m(x) = ${num(p6.m1)}，在远离数据的测试输入 x* 处先验均值为 m(x*) = ${num(p6.ms)}，并且 k(x*, x₁) = 0。先验方差 k(x₁, x₁) = k(x*, x*) = ${num(p6.s)}。在 x₁ 处得到一个观测 y = ${num(p6.y)}，噪声方差 σ² = ${num(p6.n)}。求 f(x*) 的后验均值 μ*，以及 x* 处新的带噪声观测 y* 的预测方差。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('μ*', 'μ*'), answer: ans6a, tolerance: 0.006 },
        { label: t('Var(y*|y)', 'Var(y*|y)'), answer: ans6b, tolerance: 0.006 },
      ],
      hint: t(
        'What does k(x*, x₁) = 0 do to the correction term k(x*, x₁)(y − m(x₁))/C?',
        'k(x*, x₁) = 0 会使修正项 k(x*, x₁)(y − m(x₁))/C 变成什么？'
      ),
      explanation: t(
        `With k(x*, x₁) = 0 the correction k(x*, x₁)(y − m(x₁))/C is 0, so μ* = m(x*) = ${num(p6.ms)}: far from the data the posterior falls back to the prior mean, not to 0 and not to the data. The latent variance is σ*² = ${num(p6.s)} − 0 = ${num(p6.s)}, the prior variance, so Var(y*|y) = ${num(p6.s)} + ${par(p6.n)} = ${exact(ans6b)}. The observation y = ${num(p6.y)} tells us nothing about x* (derived from Lecture 3 p. 7, eq. 17–18; Lecture 3 p. 11, Quiz 1).`,
        `k(x*, x₁) = 0 时修正项 k(x*, x₁)(y − m(x₁))/C 为 0，所以 μ* = m(x*) = ${num(p6.ms)}：远离数据时后验退回到先验均值，既不是 0，也不是数据。潜在方差 σ*² = ${num(p6.s)} − 0 = ${num(p6.s)}，即先验方差，所以 Var(y*|y) = ${num(p6.s)} + ${par(p6.n)} = ${exact(ans6b)}。观测 y = ${num(p6.y)} 对 x* 没有任何信息（由第 3 讲第 7 页式 17–18 推出；第 3 讲第 11 页，问题 1）。`
      ),
      audit: { kind: 'GP-07:far-away', params: { s: p6.s, n: p6.n, m1: p6.m1, ms: p6.ms, y: p6.y } },
    }),
    g.number({
      id: 'two-shift',
      title: t('Two observations, non-zero mean', '两个观测，非零均值'),
      prompt: t(
        `A GP has the constant prior mean m(x) = ${num(p7.m)} and prior variance ${num(p7.s)} at x₁, x₂ and x*. The covariances are k(x₁, x₂) = ${num(p7.b)} and k(x*, x₁) = k(x*, x₂) = ${num(p7.c)}. The observations y₁ = ${num(p7.y1)} at x₁ and y₂ = ${num(p7.y2)} at x₂ both have noise variance σ² = ${num(p7.n)}. Find the posterior mean μ* of f(x*) and the posterior variance σ*² of the latent value f(x*). Give integers, fractions or decimals rounded to 2 places.`,
        `一个 GP 的先验均值为常数 m(x) = ${num(p7.m)}，在 x₁、x₂、x* 处先验方差都为 ${num(p7.s)}。协方差 k(x₁, x₂) = ${num(p7.b)}，k(x*, x₁) = k(x*, x₂) = ${num(p7.c)}。x₁ 处的观测 y₁ = ${num(p7.y1)}、x₂ 处的观测 y₂ = ${num(p7.y2)}，噪声方差都为 σ² = ${num(p7.n)}。求 f(x*) 的后验均值 μ* 和潜在函数值 f(x*) 的后验方差 σ*²。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('μ*', 'μ*'), answer: ans7a, tolerance: 0.006 },
        { label: t('σ*²', 'σ*²'), answer: ans7b, tolerance: 0.006 },
      ],
      hint: t(
        `C = K + σ²I has equal diagonal entries ${a7} and off-diagonal ${num(p7.b)}, and k* = (${num(p7.c)}, ${num(p7.c)}). The vector (1, 1) is an eigenvector of C: C(1, 1)ᵀ = (${a7} + ${par(p7.b)})(1, 1)ᵀ, so C⁻¹ k* is a multiple of (1, 1).`,
        `C = K + σ²I 的对角元都是 ${a7}，非对角元是 ${num(p7.b)}，k* = (${num(p7.c)}, ${num(p7.c)})。向量 (1, 1) 是 C 的特征向量：C(1, 1)ᵀ = (${a7} + ${par(p7.b)})(1, 1)ᵀ，所以 C⁻¹ k* 是 (1, 1) 的倍数。`
      ),
      explanation: t(
        `C = ${mat([[num(a7), num(p7.b)], [num(p7.b), num(a7)]])} with a = ${num(p7.s)} + ${par(p7.n)} = ${a7}, and C⁻¹k* = ${num(p7.c)}/(${a7} + ${par(p7.b)})·(1, 1) = (${frac(p7.c, S7)}, ${frac(p7.c, S7)}) because (1, 1) is an eigenvector with eigenvalue a + b = ${S7}. The weights are v = (${frac(p7.c, S7)}, ${frac(p7.c, S7)}) (Lecture 3 p. 9: μ* is a linear combination of the data). Centred data: y₁ − m = ${num(p7.d1)}, y₂ − m = ${num(p7.d2)}. μ* = ${num(p7.m)} + ${frac(p7.c, S7)}·(${num(p7.d1)} + ${par(p7.d2)}) = ${exact(ans7a)}. σ*² = ${num(p7.s)} − k*ᵀC⁻¹k* = ${num(p7.s)} − 2·${par(p7.c)}²/${S7} = ${exact(ans7b)} (Lecture 3 p. 7, eq. 17–18).`,
        `C = ${mat([[num(a7), num(p7.b)], [num(p7.b), num(a7)]])}，其中 a = ${num(p7.s)} + ${par(p7.n)} = ${a7}，且 C⁻¹k* = ${num(p7.c)}/(${a7} + ${par(p7.b)})·(1, 1) = (${frac(p7.c, S7)}, ${frac(p7.c, S7)})，因为 (1, 1) 是特征向量，特征值 a + b = ${S7}。权重为 v = (${frac(p7.c, S7)}, ${frac(p7.c, S7)})（第 3 讲第 9 页：μ* 是数据的线性组合）。中心化数据：y₁ − m = ${num(p7.d1)}，y₂ − m = ${num(p7.d2)}。μ* = ${num(p7.m)} + ${frac(p7.c, S7)}·(${num(p7.d1)} + ${par(p7.d2)}) = ${exact(ans7a)}。σ*² = ${num(p7.s)} − k*ᵀC⁻¹k* = ${num(p7.s)} − 2·${par(p7.c)}²/${S7} = ${exact(ans7b)}（第 3 讲第 7 页，式 17–18）。`
      ),
      audit: { kind: 'GP-07:two-shift', params: { s: p7.s, n: p7.n, b: p7.b, c: p7.c, m: p7.m, y1: p7.y1, y2: p7.y2 } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: two observations, three prior means', '挑战：两个观测，三个先验均值'),
      prompt: t(
        `A GP has prior mean values m(x₁) = ${num(p8.m1)}, m(x₂) = ${num(p8.m2)} and m(x*) = ${num(p8.ms)}. Its covariances are k(x₁, x₁) = k(x₂, x₂) = 2, k(x₁, x₂) = ${num(p8.b)}, k(x*, x₁) = ${num(p8.c1)}, k(x*, x₂) = ${num(p8.c2)} and k(x*, x*) = ${num(p8.ss)}. The observations y₁ = ${num(p8.y1)} at x₁ and y₂ = ${num(p8.y2)} at x₂ have noise variance σ² = 1. Find the posterior mean μ* of f(x*) and the predictive variance Var(y*|y) of a new noisy observation y* at x*. Give integers, fractions or decimals rounded to 2 places.`,
        `一个 GP 的先验均值为 m(x₁) = ${num(p8.m1)}、m(x₂) = ${num(p8.m2)}、m(x*) = ${num(p8.ms)}。协方差为 k(x₁, x₁) = k(x₂, x₂) = 2，k(x₁, x₂) = ${num(p8.b)}，k(x*, x₁) = ${num(p8.c1)}，k(x*, x₂) = ${num(p8.c2)}，k(x*, x*) = ${num(p8.ss)}。x₁ 处的观测 y₁ = ${num(p8.y1)}、x₂ 处的观测 y₂ = ${num(p8.y2)}，噪声方差 σ² = 1。求 f(x*) 的后验均值 μ*，以及 x* 处新的带噪声观测 y* 的预测方差 Var(y*|y)。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('μ*', 'μ*'), answer: ans8a, tolerance: 0.006 },
        { label: t('Var(y*|y)', 'Var(y*|y)'), answer: ans8b, tolerance: 0.006 },
      ],
      hint: t(
        'Only the covariances and noise belong in C; the three prior means enter only through y − m(X) and the final offset. For a 2 × 2 matrix swap the diagonal, change the sign of the off-diagonal entries and divide by the determinant.',
        'C 里只有协方差和噪声；三个先验均值只通过 y − m(X) 和最后的偏移量出现。2 × 2 矩阵求逆：对角元交换，非对角元变号，再除以行列式。'
      ),
      explanation: t(
        `C = K + σ²I = ${mat([[num(3), num(p8.b)], [num(p8.b), num(3)]])}, det = 9 − ${par(p8.b)}² = 8, C⁻¹ = (1/8)·${mat([[num(3), num(-p8.b)], [num(-p8.b), num(3)]])}. Then w = C⁻¹k* = (${exact(w8_1)}, ${exact(w8_2)}) with k* = (${num(p8.c1)}, ${num(p8.c2)}). The centred data are y₁ − m(x₁) = ${num(p8.y1)} − ${par(p8.m1)} = ${num(p8.d1)} and y₂ − m(x₂) = ${num(p8.y2)} − ${par(p8.m2)} = ${num(p8.d2)}. Mean: μ* = ${num(p8.ms)} + (${exact(w8_1)})·(${num(p8.d1)}) + (${exact(w8_2)})·(${num(p8.d2)}) = ${num(p8.ms)} + (${exact(X8)}) = ${exact(ans8a)}. Latent variance: σ*² = ${num(p8.ss)} − [${par(p8.c1)}·(${exact(w8_1)}) + ${par(p8.c2)}·(${exact(w8_2)})] = ${num(p8.ss)} − ${exact(p8.c1 * w8_1 + p8.c2 * w8_2)} = ${exact(V8)}. The new measurement adds σ² = 1: Var(y*|y) = ${exact(V8)} + 1 = ${exact(ans8b)}. This game does not assess kernel choice, hyperparameter fitting or the marginal likelihood.`,
        `C = K + σ²I = ${mat([[num(3), num(p8.b)], [num(p8.b), num(3)]])}，det = 9 − ${par(p8.b)}² = 8，C⁻¹ = (1/8)·${mat([[num(3), num(-p8.b)], [num(-p8.b), num(3)]])}。于是 w = C⁻¹k* = (${exact(w8_1)}, ${exact(w8_2)})，其中 k* = (${num(p8.c1)}, ${num(p8.c2)})。中心化数据：y₁ − m(x₁) = ${num(p8.y1)} − ${par(p8.m1)} = ${num(p8.d1)}，y₂ − m(x₂) = ${num(p8.y2)} − ${par(p8.m2)} = ${num(p8.d2)}。均值：μ* = ${num(p8.ms)} + (${exact(w8_1)})·(${num(p8.d1)}) + (${exact(w8_2)})·(${num(p8.d2)}) = ${num(p8.ms)} + (${exact(X8)}) = ${exact(ans8a)}。潜在方差：σ*² = ${num(p8.ss)} − [${par(p8.c1)}·(${exact(w8_1)}) + ${par(p8.c2)}·(${exact(w8_2)})] = ${num(p8.ss)} − ${exact(p8.c1 * w8_1 + p8.c2 * w8_2)} = ${exact(V8)}。新测量再加 σ² = 1：Var(y*|y) = ${exact(V8)} + 1 = ${exact(ans8b)}。本游戏不考查核的选择、超参数拟合和边际似然。`
      ),
      audit: { kind: 'GP-07:challenge', params: { b: p8.b, c1: p8.c1, c2: p8.c2, ss: p8.ss, m1: p8.m1, m2: p8.m2, ms: p8.ms, y1: p8.y1, y2: p8.y2 } },
    }),
  ];
};
