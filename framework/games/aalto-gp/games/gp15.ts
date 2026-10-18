import type { CardGenerator } from '../../types';
import { exact, makeGpDeck, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const pex = (x: number) => (x < 0 ? `(${exact(x)})` : exact(x));
// a factor in a product: negatives and fractions get parentheses, so 1·(1/2) is not read as (1·1)/2
const pfac = (x: number) => (x < 0 || exact(x).includes('/') ? `(${exact(x)})` : exact(x));
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };

// Angle n·π/3 with n = (k·τ) mod 6, written in lowest terms: 0, π/3, 2π/3, π, 4π/3, 5π/3.
const ang = (n: number) => (n === 0 ? '0' : n === 3 ? 'π' : n === 1 ? 'π/3' : `${n}π/3`);
// A rational multiple p/q of π in lowest terms: π, 2π, 3π/2, …
const piMul = (p: number, q: number) => {
  let d = p, y = q;
  while (y) { [d, y] = [y, d % y]; }
  const [pp, qq] = [p / d, q / d];
  return { text: (pp === 1 ? 'π' : `${pp}π`) + (qq === 1 ? '' : `/${qq}`), p: pp, q: qq };
};

// Cosine table: C(n) for cos(2π * (k/6) * τ) where n = (k*τ) mod 6
const C_TABLE = [1, 1/2, -1/2, -1, -1/2, 1/2];

// Pre-computed valid sets for cards with enumerated sampling
const SS_KERNEL_SETS: { Q: number; ks: number[]; tau: number }[] = [];
{
  // Q=2: k1 < k2 from {1..6}, tau in {1,2,3}
  for (let k1 = 1; k1 <= 6; k1++)
    for (let k2 = k1 + 1; k2 <= 6; k2++)
      for (let tau = 1; tau <= 3; tau++) {
        const n1 = (k1 * tau) % 6, n2 = (k2 * tau) % 6;
        const c1 = C_TABLE[n1], c2 = C_TABLE[n2];
        const T = (c1 + c2) / 2;
        if (T === 0 || T === 1) continue;
        // Wrong routes
        const sum = c1 + c2;
        const rad = (Math.cos(k1 * tau / 6) + Math.cos(k2 * tau / 6)) / 2;
        const meanFreq = (k1 + k2) / 12;
        const cosMean = Math.cos(2 * Math.PI * meanFreq * tau);
        const cosSum = Math.cos(2 * Math.PI * (k1 + k2) / 6 * tau) / 2;
        const c1alone = c1;
        const routes = [sum, rad, cosMean, cosSum, c1alone];
        if (routes.every(r => Math.abs(r - T) >= 0.02)) {
          SS_KERNEL_SETS.push({ Q: 2, ks: [k1, k2], tau });
        }
      }
  // Q=4: k1 < k2 < k3 < k4 from {1..6}, tau in {1,2,3}
  for (let k1 = 1; k1 <= 6; k1++)
    for (let k2 = k1 + 1; k2 <= 6; k2++)
      for (let k3 = k2 + 1; k3 <= 6; k3++)
        for (let k4 = k3 + 1; k4 <= 6; k4++)
          for (let tau = 1; tau <= 3; tau++) {
            const ns = [k1, k2, k3, k4].map(k => (k * tau) % 6);
            const cs = ns.map(n => C_TABLE[n]);
            const T = cs.reduce((a, b) => a + b, 0) / 4;
            if (T === 0 || T === 1) continue;
            const sum = cs.reduce((a, b) => a + b, 0);
            const rad = cs.map((_, i) => Math.cos([k1, k2, k3, k4][i] * tau / 6)).reduce((a, b) => a + b, 0) / 4;
            const meanFreq = (k1 + k2 + k3 + k4) / 24;
            const cosMean = Math.cos(2 * Math.PI * meanFreq * tau);
            const cosSum = Math.cos(2 * Math.PI * (k1 + k2 + k3 + k4) / 6 * tau) / 4;
            const c1alone = cs[0];
            const sumHalf = sum / 2;
            const routes = [sum, rad, cosMean, cosSum, c1alone, sumHalf];
            if (routes.every(r => Math.abs(r - T) >= 0.02)) {
              SS_KERNEL_SETS.push({ Q: 4, ks: [k1, k2, k3, k4], tau });
            }
          }
}

const SS_RETURN_SETS: { p1: number; p2: number }[] = [
  { p1: 4, p2: 6 }, { p1: 4, p2: 10 }, { p1: 4, p2: 14 },
  { p1: 6, p2: 8 }, { p1: 6, p2: 9 }, { p1: 6, p2: 10 },
  { p1: 6, p2: 15 }, { p1: 8, p2: 12 }, { p1: 9, p2: 12 }, { p1: 10, p2: 15 },
];

const FREQ_SETS: { k: number; m: number }[] = [
  { k: 2, m: 2 }, { k: 2, m: 4 }, { k: 2, m: 5 },
  { k: 3, m: 1 }, { k: 3, m: 2 }, { k: 3, m: 4 }, { k: 3, m: 5 },
  { k: 4, m: 1 }, { k: 4, m: 4 }, { k: 4, m: 5 },
  { k: 5, m: 1 }, { k: 5, m: 2 }, { k: 5, m: 4 }, { k: 5, m: 5 },
  { k: 6, m: 1 }, { k: 6, m: 2 }, { k: 6, m: 4 }, { k: 6, m: 5 },
  { k: 8, m: 1 }, { k: 8, m: 2 }, { k: 8, m: 5 },
];

const SPECTRUM_SETS: { s: number; l: number }[] = [];
{
  for (const s of [1, 2, 3, 4])
    for (const l of [0.5, 2.5, 3]) {
      const T = 2 * s * l;
      const routes = [s * l, s / l, 2 * s / l, s * l / Math.PI, s * l * l, 4 * s * l, 2 * s];
      if (routes.every(r => Math.abs(r - T) >= 0.02)) {
        SPECTRUM_SETS.push({ s, l });
      }
    }
}

const SM_TABLE: Record<string, number> = {
  '0.05,1': 0.95, '0.05,2': 0.82, '0.05,3': 0.64,
  '0.1,1': 0.82, '0.1,2': 0.45,
  '0.15,1': 0.64,
  '0.2,1': 0.45,
};

const NEG_WEIGHT_SETS: { a: number; b: number }[] = [
  { a: 2, b: 1 }, { a: 3, b: 1 }, { a: 3, b: 2 },
  { a: 4, b: 1 }, { a: 4, b: 2 }, { a: 4, b: 3 },
  { a: 5, b: 1 }, { a: 5, b: 2 }, { a: 5, b: 3 }, { a: 5, b: 4 },
];

export const gp15: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-15');
  warm(g);

  // Card 1: ss-kernel
  const c1 = SS_KERNEL_SETS[g.random(0, SS_KERNEL_SETS.length - 1)];
  const c1ks = c1.ks;
  const c1tau = c1.tau;
  const c1ns = c1ks.map(k => (k * c1tau) % 6);
  const c1cs = c1ns.map(n => C_TABLE[n]);
  const c1T = c1cs.reduce((a, b) => a + b, 0) / c1.Q;
  const c1sum = c1cs.reduce((a, b) => a + b, 0);
  const c1cList = c1cs.map(c => exact(c)).join(lang === 'zh' ? '、' : ', ');
  const c1sumExpr = c1cs.map(c => pex(c)).join(' + ');
  const c1freqsEN = c1.Q === 2
    ? `ω₁ = ${c1ks[0]}/6 and ω₂ = ${c1ks[1]}/6`
    : `ω₁ = ${c1ks[0]}/6, ω₂ = ${c1ks[1]}/6, ω₃ = ${c1ks[2]}/6 and ω₄ = ${c1ks[3]}/6`;
  const c1freqsZH = c1.Q === 2
    ? `ω₁ = ${c1ks[0]}/6，ω₂ = ${c1ks[1]}/6`
    : `ω₁ = ${c1ks[0]}/6，ω₂ = ${c1ks[1]}/6，ω₃ = ${c1ks[2]}/6，ω₄ = ${c1ks[3]}/6`;
  const c1auditParams: Record<string, number> = { Q: c1.Q, tau: c1tau };
  c1ks.forEach((k, i) => { c1auditParams[`k${i + 1}`] = k; });

  // Card 2: ss-return
  const c2 = SS_RETURN_SETS[g.random(0, SS_RETURN_SETS.length - 1)];
  const c2Lcm = ((a: number, b: number) => {
    let x = a, y = b;
    while (y) { [x, y] = [y, x % y]; }
    return (a * b) / x;
  })(c2.p1, c2.p2);
  const c2prod = c2.p1 * c2.p2;

  // Card 3: freq-from-cos
  const c3 = FREQ_SETS[g.random(0, FREQ_SETS.length - 1)];
  const c3w0 = c3.k / (2 * c3.m);
  const c3period = 2 * c3.m / c3.k;
  const c3pi = piMul(c3.k, c3.m);
  const c3w0Calc = `${c3pi.p}/${2 * c3pi.q}`;
  const c3w0Text = c3w0Calc === exact(c3w0) ? exact(c3w0) : `${c3w0Calc} = ${exact(c3w0)}`;
  const c3perText = exact(c3period);
  const c3perInv = c3perText.includes('/') ? `1/(${c3perText})` : `1/${c3perText}`;
  const c3perCalc = c3perInv === exact(c3w0) ? exact(c3w0) : `${c3perInv} = ${exact(c3w0)}`;
  const c3cosine = c3.m === 1 ? `cos(${c3.k}πτ)` : `cos(${c3.k}πτ/${c3.m})`;

  // Card 4: spectrum-at-zero
  const c4 = SPECTRUM_SETS[g.random(0, SPECTRUM_SETS.length - 1)];
  const c4T = 2 * c4.s * c4.l;
  const c4sL = c4.s * c4.l;
  const c4pre = c4.s === 1 ? '' : `${c4.s}·`;

  // Card 5: process-variance
  const aVals = [0.5, 1, 1.5, 2, 2.5, 3];
  const mVals = [0.5, 1, 2];
  const sVals = [0.1, 0.2, 0.25];
  const c5 = retry(() => {
    const a1 = aVals[g.random(0, aVals.length - 1)];
    const a2 = aVals[g.random(0, aVals.length - 1)];
    const m1 = mVals[g.random(0, mVals.length - 1)];
    const m2 = mVals[g.random(0, mVals.length - 1)];
    const s1 = sVals[g.random(0, sVals.length - 1)];
    const s2 = sVals[g.random(0, sVals.length - 1)];
    return { a1, a2, m1, m2, s1, s2 };
  }, v => {
    if (v.a1 === v.a2) return false;
    const T = v.a1 + v.a2;
    const routes = [
      (v.a1 + v.a2) / 2,
      v.a1 * v.a2,
      v.a1 * v.m1 + v.a2 * v.m2,
      v.a1 * v.s1 + v.a2 * v.s2,
      Math.max(v.a1, v.a2),
      v.a1 * v.s1 * v.s1 + v.a2 * v.s2 * v.s2,
      v.s1 + v.s2,
      v.m1 + v.m2,
    ];
    return routes.every(r => Math.abs(r - T) >= 0.02);
  });
  const c5T = c5.a1 + c5.a2;
  const c5avg = (c5.a1 + c5.a2) / 2;

  // Card 6: sm-value
  const c6 = retry(() => {
    const a = g.pick([1, 2]);
    const k = g.random(1, 5);
    const tau = g.random(1, 3);
    const sigma = g.pick([0.05, 0.1, 0.15, 0.2]);
    const key = `${sigma},${tau}`;
    if (!(key in SM_TABLE)) return null;
    const d = SM_TABLE[key];
    const n = (k * tau) % 6;
    const c = C_TABLE[n];
    if (c === 0) return null;
    const T = a * d * c;
    // Guard
    const routes = [
      a * c,
      a * d,
      a * Math.cos(k * tau / 6) * d,
      -T,
      a * Math.exp(-2 * Math.PI * sigma * sigma * tau * tau) * c,
      a * Math.exp(-2 * Math.PI * Math.PI * sigma * tau * tau) * c,
      a * Math.sqrt(d) * c,
    ];
    if (!routes.every(r => Math.abs(r - T) >= 0.02)) return null;
    // True value check
    const trueVal = a * Math.exp(-2 * Math.PI * Math.PI * sigma * sigma * tau * tau) * Math.cos(2 * Math.PI * (k / 6) * tau);
    if (Math.abs(trueVal - T) > 0.005) return null;
    return { a, k, tau, sigma, d, c, T };
  }, v => v !== null)!;
  const c6T = c6.T;
  const c6c = c6.c;
  const c6d = c6.d;
  const c6aC = c6.a * c6.c;

  // Card 7: envelope
  const c7a = g.pick([1, 2, 3]);
  const c7mu = g.pick([0.5, 1, 2]);
  const sOpts = [0.05, 0.1, 0.15, 0.2, 0.25];
  const c7sA = sOpts[g.random(0, sOpts.length - 1)];
  let c7sB = sOpts[g.random(0, sOpts.length - 1)];
  while (c7sB === c7sA) c7sB = sOpts[g.random(0, sOpts.length - 1)];
  const c7X = c7sA < c7sB ? 'A' : 'B';
  const c7Y = c7sA < c7sB ? 'B' : 'A';
  const c7sX = Math.min(c7sA, c7sB);
  const c7sY = Math.max(c7sA, c7sB);
  const c7sA2 = c7sA * c7sA;
  const c7sB2 = c7sB * c7sB;

  // Card 8: negative-weight
  const c8 = NEG_WEIGHT_SETS[g.random(0, NEG_WEIGHT_SETS.length - 1)];
  const c8a = c8.a;
  const c8b = c8.b;
  const c8diff = c8a - c8b;
  const c8bPre = c8b === 1 ? '' : `${c8b}·`;
  const c8sum = c8a + c8b;
  const c8det = -4 * c8a * c8b;
  const c8eig1 = 2 * c8a;
  const c8eig2 = -2 * c8b;
  const c8vKv = -4 * c8b;

  // Card 9: challenge
  const c9 = retry(() => {
    const w1 = g.random(1, 4);
    const w2 = g.random(1, 4);
    if (w1 === w2) return null;
    const k1 = g.random(1, 6);
    let k2 = g.random(1, 6);
    if (k2 <= k1) return null;
    const tau = g.random(1, 3);
    const n1 = (k1 * tau) % 6;
    const n2 = (k2 * tau) % 6;
    const c1v = C_TABLE[n1];
    const c2v = C_TABLE[n2];
    if (c1v === c2v) return null;
    const T = w1 * c1v + w2 * c2v;
    if (T === 0) return null;
    // Guard
    const routes = [
      T / 2,
      2 * T,
      w1 + w2,
      w2 * c1v + w1 * c2v,
      w1 * Math.cos(k1 * tau / 6) + w2 * Math.cos(k2 * tau / 6),
      w1 * c1v,
      w2 * c2v,
      c1v + c2v,
    ];
    if (!routes.every(r => Math.abs(r - T) >= 0.02)) return null;
    return { w1, w2, k1, k2, tau, c1v, c2v, T };
  }, v => v !== null)!;
  const c9T = c9.T;
  const c9c1 = c9.c1v;
  const c9c2 = c9.c2v;
  const c9wSum = c9.w1 + c9.w2;
  const c9half = c9.T / 2;

  return [
    // Card 1: ss-kernel
    g.number({
      id: 'ss-kernel',
      title: t('A sparse spectrum', '稀疏谱'),
      prompt: t(
        `A sparse spectrum kernel puts equal weight on Q frequencies, S(ω) = (1/Q)·Σ δ(ω − ωᵢ), which gives the stationary kernel K(τ) = (1/Q)·Σ cos(2πτωᵢ). Take Q = ${c1.Q} with ${c1freqsEN} and τ = ${c1tau}. What is K(τ)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `稀疏谱核把相等的权重放在 Q 个频率上，S(ω) = (1/Q)·Σ δ(ω − ωᵢ)，对应的平稳核为 K(τ) = (1/Q)·Σ cos(2πτωᵢ)。取 Q = ${c1.Q}，${c1freqsZH}，τ = ${c1tau}。K(τ) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K(τ)', 'K(τ)'), answer: c1T, tolerance: 0.006 }],
      hint: t(
        'Work out each cosine separately first. Which angle, in multiples of π, does each frequency give at this τ?',
        '先分别算出每个余弦。在这个 τ 处，每个频率给出的角度是 π 的几倍？'
      ),
      explanation: t(
        `Each frequency ωᵢ = kᵢ/6 gives the angle 2π·(kᵢ/6)·${c1tau}, which is ${c1ns.map(ang).join(', ')} once full turns are removed, so the cosines are ${c1cList}. The kernel is their average: K(${c1tau}) = (${c1sumExpr})/${c1.Q} = ${exact(c1T)}. The kernel is exactly the mean of the cosines the spectrum puts weight on (Lecture 5 p. 57, eq. 54). Dropping the factor 1/${c1.Q} would give ${exact(c1sum)}.`,
        `每个频率 ωᵢ = kᵢ/6 给出角度 2π·(kᵢ/6)·${c1tau}，去掉整圈后为 ${c1ns.map(ang).join('、')}，所以各余弦为 ${c1cList}。核就是它们的平均：K(${c1tau}) = (${c1sumExpr})/${c1.Q} = ${exact(c1T)}。核恰好是谱上有权重的那些余弦的平均（第 5 讲第 57 页，式 54）。若漏掉因子 1/${c1.Q}，会得到 ${exact(c1sum)}。`
      ),
      audit: { kind: 'GP-15:ss-kernel', params: c1auditParams },
    }),

    // Card 2: ss-return
    g.number({
      id: 'ss-return',
      title: t('The correlation never dies', '相关性永不消失'),
      prompt: t(
        `A sparse spectrum kernel with Q = 2 frequencies ω₁ = 1/${c2.p1} and ω₂ = 1/${c2.p2} is K(τ) = (1/2)·[cos(2πτω₁) + cos(2πτω₂)], so K(0) = 1. What is the smallest τ > 0 at which K(τ) = 1 again? Give an integer.`,
        `有 Q = 2 个频率 ω₁ = 1/${c2.p1}、ω₂ = 1/${c2.p2} 的稀疏谱核为 K(τ) = (1/2)·[cos(2πτω₁) + cos(2πτω₂)]，因此 K(0) = 1。使 K(τ) = 1 再次成立的最小 τ > 0 是多少？请填整数。`
      ),
      fields: [{ label: t('τ', 'τ'), answer: c2Lcm, tolerance: 0.006 }],
      hint: t(
        'K(τ) is an average of numbers that are each at most 1. When can such an average be exactly 1? What does that demand of each cosine?',
        'K(τ) 是若干个都不超过 1 的数的平均。这样的平均何时恰好等于 1？这对每个余弦提出了什么要求？'
      ),
      explanation: t(
        `An average of two numbers that are each at most 1 equals 1 only if both equal 1. cos(2πτ/${c2.p1}) = 1 exactly when τ is a multiple of ${c2.p1}, and cos(2πτ/${c2.p2}) = 1 exactly when τ is a multiple of ${c2.p2}. So K(τ) = 1 first happens at the least common multiple, ${c2Lcm}; the product ${c2.p1}·${c2.p2} = ${c2prod} is a common multiple but not the smallest. Because the cosines never fade, the sparse spectrum kernel keeps full correlation at arbitrarily large distances: Lecture 5 p. 57 calls it a highly regular covariance, prone to overfitting.`,
        `两个都不超过 1 的数，平均值等于 1 当且仅当两者都等于 1。cos(2πτ/${c2.p1}) = 1 恰在 τ 是 ${c2.p1} 的倍数时成立，cos(2πτ/${c2.p2}) = 1 恰在 τ 是 ${c2.p2} 的倍数时成立。所以 K(τ) = 1 首次出现在最小公倍数 ${c2Lcm}；乘积 ${c2.p1}·${c2.p2} = ${c2prod} 虽是公倍数，却不是最小的。余弦永不衰减，稀疏谱核在任意远的距离上仍保持完全相关：第 5 讲第 57 页称之为高度规则的协方差，容易过拟合。`
      ),
      audit: { kind: 'GP-15:ss-return', params: { p1: c2.p1, p2: c2.p2 } },
    }),

    // Card 3: freq-from-cos
    g.number({
      id: 'freq-from-cos',
      title: t('Where is the spectral peak?', '谱峰在哪里？'),
      prompt: t(
        `A stationary kernel is K(τ) = ${c3cosine}. It is the inverse Fourier transform K(τ) = ∫S(ω)·exp(2πiωτ)dω of a symmetric spectrum S(ω) = (1/2)·[δ(ω − ω₀) + δ(ω + ω₀)] with ω₀ > 0. What is ω₀? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `平稳核为 K(τ) = ${c3cosine}。它是对称谱 S(ω) = (1/2)·[δ(ω − ω₀) + δ(ω + ω₀)]（ω₀ > 0）的逆傅里叶变换 K(τ) = ∫S(ω)·exp(2πiωτ)dω。ω₀ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ω₀', 'ω₀'), answer: c3w0, tolerance: 0.006 }],
      hint: t(
        'A cosine of frequency ω₀ repeats after a time 1/ω₀. How long does one full cycle of the given cosine last?',
        '频率为 ω₀ 的余弦每隔 1/ω₀ 重复一次。题中这个余弦的一个完整周期有多长？'
      ),
      explanation: t(
        `S has spikes at ±ω₀, so K(τ) = (1/2)(exp(2πiω₀τ) + exp(−2πiω₀τ)) = cos(2πω₀τ) (Lecture 5 p. 39, p. 42). Matching ${c3cosine} = cos(2πω₀τ) gives 2πω₀ = ${c3pi.text}, so ω₀ = ${c3w0Text}. Check with the period: the cosine repeats after ${c3perText}, and the frequency is the inverse of the period, ${c3perCalc} (Lecture 5 p. 42). Answering ${exact(c3.k / c3.m)}, the coefficient of πτ, would forget that the angle is 2π times the frequency.`,
        `S 在 ±ω₀ 处有尖峰，所以 K(τ) = (1/2)(exp(2πiω₀τ) + exp(−2πiω₀τ)) = cos(2πω₀τ)（第 5 讲第 39、42 页）。令 ${c3cosine} = cos(2πω₀τ)，得 2πω₀ = ${c3pi.text}，所以 ω₀ = ${c3w0Text}。用周期检验：该余弦每隔 ${c3perText} 重复一次，频率是周期的倒数，${c3perCalc}（第 5 讲第 42 页）。若答 ${exact(c3.k / c3.m)}（πτ 的系数），就忘了角度是频率的 2π 倍。`
      ),
      audit: { kind: 'GP-15:freq-from-cos', params: { k: c3.k, m: c3.m } },
    }),

    // Card 4: spectrum-at-zero
    g.number({
      id: 'spectrum-at-zero',
      title: t('The spectrum at frequency zero', '零频处的谱'),
      prompt: t(
        `The exponential kernel K(τ) = ${c4pre}exp(−|τ|/ℓ) with ℓ = ${num(c4.l)} has the spectral density S(ω) = ∫K(τ)·exp(−2πiωτ)dτ. What is S(0)? Give an integer.`,
        `指数核 K(τ) = ${c4pre}exp(−|τ|/ℓ)，ℓ = ${num(c4.l)}，其谱密度为 S(ω) = ∫K(τ)·exp(−2πiωτ)dτ。S(0) 是多少？请填整数。`
      ),
      fields: [{ label: t('S(0)', 'S(0)'), answer: c4T, tolerance: 0.006 }],
      hint: t(
        'Put ω = 0 into the integral that defines S(ω). What is left to integrate, and over which range of τ?',
        '把 ω = 0 代入定义 S(ω) 的积分。剩下要积分的是什么？τ 的范围是多少？'
      ),
      explanation: t(
        `At ω = 0 the factor exp(−2πiωτ) equals 1, so S(0) = ∫K(τ)dτ, the area under the kernel (Lecture 5 p. 31 eq. 30). The kernel is even, so S(0) = 2·${c4pre}∫ exp(−τ/ℓ)dτ over τ from 0 to ∞ = 2·${c4pre}${num(c4.l)} = ${c4T}. Using only the half-line τ > 0 gives ${exact(c4sL)}. (The formula ℓ/π printed on slide p. 56 belongs to a different Fourier convention, with exp(−iωτ), and is not used here.)`,
        `在 ω = 0 时 exp(−2πiωτ) 等于 1，所以 S(0) = ∫K(τ)dτ，即核曲线下的面积（第 5 讲第 31 页，式 30）。核是偶函数，所以 S(0) = 2·${c4pre}∫ exp(−τ/ℓ)dτ（τ 从 0 到 ∞）= 2·${c4pre}${num(c4.l)} = ${c4T}。只用半直线 τ > 0 会得到 ${exact(c4sL)}。（第 56 页的 ℓ/π 属于另一种傅里叶约定 exp(−iωτ)，此处不用。）`
      ),
      audit: { kind: 'GP-15:spectrum-at-zero', params: { s: c4.s, l: c4.l } },
    }),

    // Card 5: process-variance
    g.number({
      id: 'process-variance',
      title: t('The variance from the spectrum', '由谱求方差'),
      prompt: t(
        `A stationary process f has the spectral density S(ω) = ${num(c5.a1)}·N(ω | ${num(c5.m1)}, (${num(c5.s1)})²) + ${num(c5.a2)}·N(ω | ${num(c5.m2)}, (${num(c5.s2)})²), where N(ω | μ, σ²) is the Gaussian density in the frequency ω with mean μ and variance σ². What is the variance k(0) of f(x)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `平稳过程 f 的谱密度为 S(ω) = ${num(c5.a1)}·N(ω | ${num(c5.m1)}, (${num(c5.s1)})²) + ${num(c5.a2)}·N(ω | ${num(c5.m2)}, (${num(c5.s2)})²)，其中 N(ω | μ, σ²) 是频率 ω 上均值为 μ、方差为 σ² 的高斯密度。f(x) 的方差 k(0) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(0)', 'k(0)'), answer: c5T, tolerance: 0.006 }],
      hint: t(
        'k(0) is the variance. Evaluate the inverse Fourier integral that gives K(τ) at τ = 0, and recall what a Gaussian density integrates to.',
        'k(0) 就是方差。把给出 K(τ) 的逆傅里叶积分在 τ = 0 处求值，并回忆高斯密度的积分是多少。'
      ),
      explanation: t(
        `The variance of the process is k(0) = ∫S(ω)dω (GPML pdf p. 100; Lecture 5 p. 35). Each Gaussian density integrates to 1 whatever its mean and variance, so k(0) = ${num(c5.a1)}·1 + ${num(c5.a2)}·1 = ${exact(c5T)}. Only the weights matter: the means ${num(c5.m1)}, ${num(c5.m2)} say where the power sits in frequency and the widths ${num(c5.s1)}, ${num(c5.s2)} say how spread it is, not how much there is. Taking the average of the weights would give ${exact(c5avg)}.`,
        `过程的方差为 k(0) = ∫S(ω)dω（GPML 第 100 页；第 5 讲第 35 页）。每个高斯密度无论均值与方差如何，积分都为 1，所以 k(0) = ${num(c5.a1)}·1 + ${num(c5.a2)}·1 = ${exact(c5T)}。只有权重起作用：均值 ${num(c5.m1)}、${num(c5.m2)} 说明功率在频率轴上的位置，宽度 ${num(c5.s1)}、${num(c5.s2)} 说明它有多分散，而不是总量有多大。取权重的平均会得到 ${exact(c5avg)}。`
      ),
      audit: { kind: 'GP-15:process-variance', params: { a1: c5.a1, a2: c5.a2, m1: c5.m1, m2: c5.m2, s1: c5.s1, s2: c5.s2 } },
    }),

    // Card 6: sm-value
    g.number({
      id: 'sm-value',
      title: t('One spectral mixture component', '一个谱混合分量'),
      prompt: t(
        `One component of a spectral mixture kernel is K(τ) = a·exp(−2π²σ²τ²)·cos(2πμτ) with a = ${c6.a}, μ = ${c6.k}/6, σ = ${num(c6.sigma)} and τ = ${c6.tau}. For these values the factor exp(−2π²σ²τ²) equals ${c6d} (rounded to 2 decimals). What is K(τ)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `谱混合核的一个分量为 K(τ) = a·exp(−2π²σ²τ²)·cos(2πμτ)，其中 a = ${c6.a}，μ = ${c6.k}/6，σ = ${num(c6.sigma)}，τ = ${c6.tau}。对这些取值，因子 exp(−2π²σ²τ²) 等于 ${c6d}（保留 2 位小数）。K(τ) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K(τ)', 'K(τ)'), answer: c6T, tolerance: 0.006 }],
      hint: t(
        'The decay factor and the cosine are separate factors that multiply the amplitude. Find the angle of the cosine first, in multiples of π.',
        '衰减因子和余弦是两个相乘的独立因子，再乘上振幅。先求出余弦的角度，用 π 的倍数表示。'
      ),
      explanation: t(
        `The cosine has the angle 2πμτ = 2π·(${c6.k}/6)·${c6.tau}, which is ${ang((c6.k * c6.tau) % 6)} once full turns are removed, so cos(2πμτ) = ${exact(c6c)}. The decay factor is ${c6d}, as printed. Therefore K(${c6.tau}) = a·${c6d}·cos = ${c6.a}·${c6d}·${pfac(c6c)} = ${num(c6T)}. Without the decay the value would be ${exact(c6aC)}; the factor exp(−2π²σ²τ²) is the smooth decay, cos(2πμτ) the periodic part (Lecture 5 p. 59, eq. 57).`,
        `余弦的角度为 2πμτ = 2π·(${c6.k}/6)·${c6.tau}，去掉整圈后为 ${ang((c6.k * c6.tau) % 6)}，所以 cos(2πμτ) = ${exact(c6c)}。衰减因子如题所示为 ${c6d}。因此 K(${c6.tau}) = a·${c6d}·cos = ${c6.a}·${c6d}·${pfac(c6c)} = ${num(c6T)}。若没有衰减，值为 ${exact(c6aC)}；因子 exp(−2π²σ²τ²) 是平滑衰减，cos(2πμτ) 是周期部分（第 5 讲第 59 页，式 57）。`
      ),
      audit: { kind: 'GP-15:sm-value', params: { a: c6.a, k: c6.k, tau: c6.tau, sigma: c6.sigma, d: c6d } },
    }),

    // Card 7: envelope
    g.choice({
      id: 'envelope',
      title: t('Narrow or wide in frequency?', '频率上窄还是宽？'),
      prompt: t(
        `Two spectral mixture kernels K(τ) = a·exp(−2π²σ²τ²)·cos(2πμτ) have the same a = ${c7a} and the same μ = ${num(c7mu)}. Kernel A has σ = ${num(c7sA)} and kernel B has σ = ${num(c7sB)}. Which statement is correct about how far in τ each kernel stays correlated?`,
        `两个谱混合核 K(τ) = a·exp(−2π²σ²τ²)·cos(2πμτ) 的 a = ${c7a}、μ = ${num(c7mu)} 都相同。核 A 的 σ = ${num(c7sA)}，核 B 的 σ = ${num(c7sB)}。关于各核在 τ 方向上保持相关的范围，下列哪条说法正确？`
      ),
      options: [
        t(`Kernel ${c7X}: its smaller σ = ${num(c7sX)} gives a narrow band, so exp(−2π²σ²τ²) decays slowly.`,
          `核 ${c7X}：较小的 σ = ${num(c7sX)} 对应窄频带，所以 exp(−2π²σ²τ²) 衰减得慢。`),
        t(`Kernel ${c7Y}: its larger σ = ${num(c7sY)} means a wider band of frequencies, so the correlation lasts longer.`,
          `核 ${c7Y}：较大的 σ = ${num(c7sY)} 表示频带更宽，覆盖的频率更多，所以相关性在更远的距离上依然保留，持续更久。`),
        t('Neither: the decay is set by μ alone, and μ is the same for both kernels.',
          '都不是：包络的衰减只由 μ 决定，而两个核的 μ 相同，所以两者的相关范围没有区别。'),
        t('Both equally: a and μ are equal, so the two envelopes are identical.',
          '两者相同：a 和 μ 都相等，所以两条包络完全一样。'),
      ],
      correct: 0,
      hint: t(
        'The envelope shrinks as σ²τ² grows. For the same τ, which kernel has the larger σ²τ²?',
        '包络随 σ²τ² 增大而缩小。在同一个 τ 处，哪个核的 σ²τ² 更大？'
      ),
      explanation: t(
        `The envelope exp(−2π²σ²τ²) falls faster the larger σ² is: σ² = ${num(c7sA2)} for A and ${num(c7sB2)} for B, so the kernel with σ = ${num(c7sY)} loses its correlation sooner and the one with σ = ${num(c7sX)} keeps it longer. A large σ spreads the spectrum over many frequencies, which makes the oscillations at different frequencies dephase quickly; a narrow band is almost a single cosine, which is the limit of a sparse spectrum that never fades (Lecture 5 pp. 57, 59). The mean μ = ${num(c7mu)} only sets the period of the oscillation, and a only scales the kernel. This game does not assess the learned values of these parameters on data.`,
        `σ² 越大，包络 exp(−2π²σ²τ²) 下降得越快：A 的 σ² = ${num(c7sA2)}，B 的 σ² = ${num(c7sB2)}，所以 σ = ${num(c7sY)} 的核相关性消失得更早，σ = ${num(c7sX)} 的核保持得更久。大的 σ 把谱分散到许多频率上，不同频率的振荡很快错相；窄带近似一个单独的余弦，也就是永不衰减的稀疏谱的极限（第 5 讲第 57、59 页）。均值 μ = ${num(c7mu)} 只决定振荡周期，a 只改变核的整体尺度。本游戏不考查这些参数在数据上学到的取值。`
      ),
    }),

    // Card 8: negative-weight
    g.choice({
      id: 'negative-weight',
      title: t('Can a weight be negative?', '权重可以为负吗？'),
      prompt: t(
        `A student proposes the symmetric spectrum S(ω) = (${c8a}/2)·[δ(ω − 1) + δ(ω + 1)] − (${c8b}/2)·[δ(ω − 1/2) + δ(ω + 1/2)]. Its inverse Fourier transform is K(τ) = ${c8a}·cos(2πτ) − ${c8bPre}cos(πτ), and K(0) = ${c8diff} is positive. The student concludes that K is a valid stationary kernel. Which statement is correct?`,
        `一位同学提出对称谱 S(ω) = (${c8a}/2)·[δ(ω − 1) + δ(ω + 1)] − (${c8b}/2)·[δ(ω − 1/2) + δ(ω + 1/2)]。其逆傅里叶变换为 K(τ) = ${c8a}·cos(2πτ) − ${c8bPre}cos(πτ)，且 K(0) = ${c8diff} 为正。这位同学断言 K 是合法的平稳核。下列哪条说法正确？`
      ),
      options: [
        t('Not valid: the weights at ω = ±1/2 are negative, so S is not non-negative.',
          '不合法：ω = ±1/2 处的权重为负，所以 S 不是非负的。'),
        t(`Valid: K(0) = ${c8diff} is positive, so the variance is positive and nothing more is required.`,
          `合法：K(0) = ${c8diff} 为正，所以方差为正，不需要其他条件。`),
        t('Valid: S is symmetric, S(ω) = S(−ω), and that is all that Bochner\'s theorem asks for.',
          '合法：S 是对称的，S(ω) = S(−ω)，这就是 Bochner 定理的全部要求。'),
        t('Not valid only because S is made of spikes; a smooth density with the same weights would be valid.',
          '不合法只是因为 S 由尖峰组成；权重相同的光滑密度就合法了。'),
      ],
      correct: 0,
      hint: t(
        'Besides symmetry, what must a spectral density be everywhere? Then build the 2 × 2 Gram matrix of K at the inputs 0 and 1.',
        '除了对称，谱密度处处还必须满足什么？然后写出 K 在输入 0 和 1 处的 2 × 2 Gram 矩阵。'
      ),
      explanation: t(
        `Bochner's theorem needs S to be non-negative (a positive measure, GPML pdf p. 100; Lecture 5 p. 35), and here the spikes at ±1/2 have the weight −${c8b}/2. A positive K(0) = ${c8diff} is not enough. The Gram matrix at the inputs 0 and 1 is [[${c8diff}, ${c8sum}], [${c8sum}, ${c8diff}]] because K(1) = ${c8a}·1 − ${c8b}·(−1) = ${c8sum}. Its determinant is (${c8diff})² − (${c8sum})² = ${num(c8det)} < 0, so it has the eigenvalues ${c8eig1} and ${num(c8eig2)}, and the vector (1, −1) gives vᵀKv = ${num(c8vKv)} < 0, a negative variance for f(0) − f(1). A kernel needs a Gram matrix with no negative eigenvalue (GP-09 tests this for given matrices). Smoothing the spikes while keeping a negative region would not repair this.`,
        `Bochner 定理要求 S 非负（正测度，GPML 第 100 页；第 5 讲第 35 页），而这里 ±1/2 处的尖峰权重为 −${c8b}/2。K(0) = ${c8diff} 为正并不够。在输入 0 和 1 处的 Gram 矩阵为 [[${c8diff}, ${c8sum}], [${c8sum}, ${c8diff}]]，因为 K(1) = ${c8a}·1 − ${c8b}·(−1) = ${c8sum}。其行列式为 (${c8diff})² − (${c8sum})² = ${num(c8det)} < 0，所以特征值为 ${c8eig1} 和 ${num(c8eig2)}，向量 (1, −1) 给出 vᵀKv = ${num(c8vKv)} < 0，即 f(0) − f(1) 的方差为负。核的 Gram 矩阵不能有负特征值（对给定矩阵的检验见 GP-09）。把尖峰抹平但保留负的区域也无法补救。`
      ),
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: a kernel from its spikes', '挑战：由尖峰求核'),
      prompt: t(
        `A stationary process has the spectral density S(ω) = (${c9.w1}/2)·[δ(ω − ω₁) + δ(ω + ω₁)] + (${c9.w2}/2)·[δ(ω − ω₂) + δ(ω + ω₂)] with ω₁ = ${c9.k1}/6 and ω₂ = ${c9.k2}/6. Using K(τ) = ∫S(ω)·exp(2πiωτ)dω, compute K(${c9.tau}). Give an integer, a fraction or a decimal rounded to 2 places.`,
        `平稳过程的谱密度为 S(ω) = (${c9.w1}/2)·[δ(ω − ω₁) + δ(ω + ω₁)] + (${c9.w2}/2)·[δ(ω − ω₂) + δ(ω + ω₂)]，其中 ω₁ = ${c9.k1}/6，ω₂ = ${c9.k2}/6。利用 K(τ) = ∫S(ω)·exp(2πiωτ)dω，计算 K(${c9.tau})。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('K(τ)', 'K(τ)'), answer: c9T, tolerance: 0.006 }],
      hint: t(
        'Each pair of spikes at ±ω contributes one real cosine to K. Track the weight of each pair.',
        '±ω 处的每一对尖峰给 K 贡献一个实的余弦。注意每一对的权重。'
      ),
      explanation: t(
        `The integral picks up each spike: K(τ) = Σ (wᵢ/2)·[exp(2πiωᵢτ) + exp(−2πiωᵢτ)] = Σ wᵢ·cos(2πωᵢτ), because exp(iθ) + exp(−iθ) = 2cos θ (Lecture 5 p. 39). At τ = ${c9.tau}: cos(2π·(${c9.k1}/6)·${c9.tau}) = ${exact(c9c1)} and cos(2π·(${c9.k2}/6)·${c9.tau}) = ${exact(c9c2)}. So K(${c9.tau}) = ${c9.w1}·${pfac(c9c1)} + ${c9.w2}·${pfac(c9c2)} = ${exact(c9T)}. As a check, K(0) = ${c9.w1} + ${c9.w2} = ${c9wSum} is the variance ∫S(ω)dω. Counting only one spike of each pair would halve the answer to ${exact(c9half)}. This game does not assess fitting hyperparameters by optimisation.`,
        `积分取出每个尖峰：K(τ) = Σ (wᵢ/2)·[exp(2πiωᵢτ) + exp(−2πiωᵢτ)] = Σ wᵢ·cos(2πωᵢτ)，因为 exp(iθ) + exp(−iθ) = 2cos θ（第 5 讲第 39 页）。在 τ = ${c9.tau} 处：cos(2π·(${c9.k1}/6)·${c9.tau}) = ${exact(c9c1)}，cos(2π·(${c9.k2}/6)·${c9.tau}) = ${exact(c9c2)}。所以 K(${c9.tau}) = ${c9.w1}·${pfac(c9c1)} + ${c9.w2}·${pfac(c9c2)} = ${exact(c9T)}。检验：K(0) = ${c9.w1} + ${c9.w2} = ${c9wSum} 是方差 ∫S(ω)dω。每一对只数一个尖峰会使答案减半，得到 ${exact(c9half)}。本游戏不考查用优化来拟合超参数。`
      ),
      audit: { kind: 'GP-15:challenge', params: { w1: c9.w1, w2: c9.w2, k1: c9.k1, k2: c9.k2, tau: c9.tau } },
    }),
  ];
};
