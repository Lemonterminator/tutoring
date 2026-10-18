import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };

export const gp02: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-02');
  warm(g);

  // Card 1: cond-mean
  const c1 = retry(() => {
    const m1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s22 = g.pick([2, 3, 4, 5]);
    const s12 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s11 = g.pick([2, 3, 4, 5, 6]);
    const d = g.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const v = m2 + d;
    return { m1, m2, s11, s12, s22, d, v };
  }, p => {
    if (p.s11 * p.s22 <= p.s12 * p.s12) return false;
    if (p.s11 === p.s22) return false;
    const truth = p.m1 + p.s12 * p.d / p.s22;
    const wrongs = [
      p.m1 + p.s12 * p.d / p.s11,
      p.m1 + p.s12 * p.v / p.s22,
      p.s12 * p.d / p.s22,
      p.m1 - p.s12 * p.d / p.s22,
      p.m1 + p.s12 * p.d
    ];
    return wrongs.every(w => Math.abs(w - truth) >= 0.02);
  });
  const c1Ans = c1.m1 + c1.s12 * c1.d / c1.s22;

  // Card 2: cond-var
  const c2 = retry(() => {
    const m1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s22 = g.pick([2, 3, 4, 5]);
    const s12 = g.pick([-3, -2, 2, 3]);
    const s11 = g.pick([2, 3, 4, 5, 6, 7]);
    const d = g.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const v = m2 + d;
    return { m1, m2, s11, s12, s22, d, v };
  }, p => {
    if (p.s11 * p.s22 <= p.s12 * p.s12) return false;
    if (p.s11 === p.s22) return false;
    if (p.s11 === 2 * p.s12 * p.s12 / p.s22) return false;
    const truth = p.s11 - p.s12 * p.s12 / p.s22;
    const wrongs = [
      p.s11 - Math.abs(p.s12) / p.s22,
      p.s11 - p.s12 * p.s12,
      p.s11 - p.s12 * p.s12 / p.s11,
      p.s11 + p.s12 * p.s12 / p.s22,
      p.s12 * p.s12 / p.s22,
      p.s11 - p.s12 * p.s12 / (p.s22 * p.s22)
    ];
    return wrongs.every(w => Math.abs(w - truth) >= 0.02);
  });
  const c2Ans = c2.s11 - c2.s12 * c2.s12 / c2.s22;

  // Card 3: value-shift
  const c3 = retry(() => {
    const m1 = g.pick([-3, -2, -1, 0, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 0, 1, 2, 3]);
    const s22 = g.pick([2, 3, 4, 5]);
    const s12 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s11 = g.pick([2, 3, 4, 5, 6]);
    const v1 = g.pick([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
    const v2 = g.pick([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
    return { m1, m2, s11, s12, s22, v1, v2 };
  }, p => {
    if (p.s11 * p.s22 <= p.s12 * p.s12) return false;
    if (p.s12 === 0) return false;
    if (p.v1 === p.v2) return false;
    return true;
  });
  const c3Mean1 = c3.m1 + c3.s12 * (c3.v1 - c3.m2) / c3.s22;
  const c3Mean2 = c3.m1 + c3.s12 * (c3.v2 - c3.m2) / c3.s22;
  const c3Var = c3.s11 - c3.s12 * c3.s12 / c3.s22;

  // Card 4: zero-cov
  const c4 = retry(() => {
    const m1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s11 = g.pick([2, 3, 4, 5, 6]);
    const s22 = g.pick([1, 2, 3, 4, 5]);
    const d = g.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const v = m2 + d;
    return { m1, m2, s11, s22, d, v };
  }, p => {
    if (p.s22 === p.s11) return false;
    if (p.v === p.m1 || p.v === 0) return false;
    if (p.d === p.m1) return false;
    return true;
  });
  const c4Mean = c4.m1;
  const c4Var = c4.s11;

  // Card 5: never-larger
  const c5 = retry(() => {
    const s12 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s22 = g.pick([1, 2, 3, 4]);
    const s11 = g.pick([2, 3, 4, 5, 6]);
    return { s11, s12, s22 };
  }, p => {
    if (p.s12 * p.s12 % p.s22 !== 0) return false;
    if (p.s11 * p.s22 <= p.s12 * p.s12) return false;
    return true;
  });
  const c5Claim = c5.s11 + c5.s12 * c5.s12 / c5.s22;
  const c5True = c5.s11 - c5.s12 * c5.s12 / c5.s22;

  // Card 6: cov-after
  const c6 = retry(() => {
    const s11 = g.pick([3, 4, 5, 6]);
    const s22 = g.pick([3, 4, 5, 6]);
    const s33 = g.pick([2, 3, 4]);
    const s12 = g.pick([-2, -1, 0, 1, 2, 3]);
    const s13 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s23 = g.pick([-3, -2, -1, 1, 2, 3]);
    return { s11, s12, s13, s22, s23, s33 };
  }, p => {
    if (p.s11 <= 0) return false;
    if (p.s11 * p.s22 - p.s12 * p.s12 <= 0) return false;
    const det = p.s11 * (p.s22 * p.s33 - p.s23 * p.s23) - p.s12 * (p.s12 * p.s33 - p.s23 * p.s13) + p.s13 * (p.s12 * p.s23 - p.s22 * p.s13);
    if (det <= 0) return false;
    if (p.s11 - p.s13 * p.s13 / p.s33 < 0.5) return false;
    if (p.s22 - p.s23 * p.s23 / p.s33 < 0.5) return false;
    if (p.s12 - p.s13 * p.s23 / p.s33 === 0) return false;
    const truthV = p.s11 - p.s13 * p.s13 / p.s33;
    const truthC = p.s12 - p.s13 * p.s23 / p.s33;
    const wrongV = [
      p.s11 - Math.abs(p.s13) / p.s33,
      p.s11 - p.s13 * p.s13,
      p.s11 - p.s13 * p.s13 / p.s11,
      p.s11 + p.s13 * p.s13 / p.s33,
      p.s13 * p.s13 / p.s33
    ];
    const wrongC = [
      p.s12,
      p.s12 - p.s13 * p.s23,
      p.s12 + p.s13 * p.s23 / p.s33,
      p.s12 - p.s13 * p.s23 / p.s11,
      -truthC,
      p.s13 * p.s23 / p.s33
    ];
    return wrongV.every(w => Math.abs(w - truthV) >= 0.02) && wrongC.every(w => Math.abs(w - truthC) >= 0.02);
  });
  const c6V = c6.s11 - c6.s13 * c6.s13 / c6.s33;
  const c6C = c6.s12 - c6.s13 * c6.s23 / c6.s33;

  // Card 7: two-obs
  const c7 = retry(() => {
    const m1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m3 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s11 = g.pick([3, 4, 5, 6, 7, 8]);
    const s12 = g.pick([-2, -1, 1, 2]);
    const s13 = g.pick([-2, -1, 1, 2]);
    const s22 = g.pick([1, 2, 4]);
    const s33 = g.pick([1, 2, 4]);
    const e2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const e3 = g.pick([-3, -2, -1, 1, 2, 3]);
    const v2 = m2 + e2;
    const v3 = m3 + e3;
    return { m1, m2, m3, s11, s12, s13, s22, s33, e2, e3, v2, v3 };
  }, p => {
    const V = p.s11 - p.s12 * p.s12 / p.s22 - p.s13 * p.s13 / p.s33;
    if (V < 0.5) return false;
    const truthM = p.m1 + p.s12 * p.e2 / p.s22 + p.s13 * p.e3 / p.s33;
    const wrongM = [
      p.m1 + p.s12 * p.e2 / p.s22,
      p.m1 + p.s13 * p.e3 / p.s33,
      p.m1 + (p.s12 * p.e2 + p.s13 * p.e3) / (p.s22 + p.s33),
      p.m1 + p.s12 * p.e2 / p.s22 - p.s13 * p.e3 / p.s33,
      p.s12 * p.e2 / p.s22 + p.s13 * p.e3 / p.s33,
      p.m1 + p.s12 * p.v2 / p.s22 + p.s13 * p.v3 / p.s33,
      p.m1 - p.s12 * p.e2 / p.s22 - p.s13 * p.e3 / p.s33,
      p.m1 + p.s12 * p.e2 + p.s13 * p.e3
    ];
    const wrongV = [
      p.s11 - p.s12 * p.s12 / p.s22,
      p.s11 - p.s13 * p.s13 / p.s33,
      p.s11 - (p.s12 * p.s12 + p.s13 * p.s13) / (p.s22 + p.s33),
      p.s11 + p.s12 * p.s12 / p.s22 + p.s13 * p.s13 / p.s33,
      p.s11 - Math.abs(p.s12) / p.s22 - Math.abs(p.s13) / p.s33,
      p.s12 * p.s12 / p.s22 + p.s13 * p.s13 / p.s33
    ];
    return wrongM.every(w => Math.abs(w - truthM) >= 0.02) && wrongV.every(w => Math.abs(w - V) >= 0.02);
  });
  const c7Mean = c7.m1 + c7.s12 * c7.e2 / c7.s22 + c7.s13 * c7.e3 / c7.s33;
  const c7Var = c7.s11 - c7.s12 * c7.s12 / c7.s22 - c7.s13 * c7.s13 / c7.s33;

  // Card 8: precision
  const c8 = retry(() => {
    const m1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const l11 = g.pick([2, 3, 4, 5]);
    const l22 = g.pick([2, 3, 4, 5]);
    const l12 = g.pick([-2, -1, 1, 2]);
    const d = g.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const v = m2 + d;
    return { m1, m2, l11, l12, l22, d, v };
  }, p => {
    if (p.l11 === p.l22) return false;
    if (p.l11 * p.l22 <= p.l12 * p.l12) return false;
    const det = p.l11 * p.l22 - p.l12 * p.l12;
    const truthV = 1 / p.l11;
    const truthM = p.m1 - p.l12 * p.d / p.l11;
    const wrongV = [
      p.l22 / det,
      p.l11,
      1 / p.l22,
      p.l11 - p.l12 * p.l12 / p.l22,
      det / p.l11
    ];
    const wrongM = [
      p.m1 + p.l12 * p.d / p.l11,
      p.m1 - p.l12 * p.d / p.l22,
      p.m1 + p.l12 * p.d / p.l22,
      p.m1 - p.l12 * p.v / p.l11,
      p.m1 - p.l12 * p.d,
      p.m1 - p.l12 * p.d / det,
      p.m1 + p.l12 * p.d / det
    ];
    return wrongV.every(w => Math.abs(w - truthV) >= 0.02) && wrongM.every(w => Math.abs(w - truthM) >= 0.02);
  });
  const c8Mean = c8.m1 - c8.l12 * c8.d / c8.l11;
  const c8Var = 1 / c8.l11;

  // Card 9: challenge
  const c9 = retry(() => {
    const pair = g.pick([[2, 1], [2, -1], [3, 1], [3, -1], [3, 2], [3, -2], [4, 3], [4, -3]]);
    const s11 = pair[0];
    const s13 = pair[1];
    const s33 = s11;
    const s22 = g.pick([3, 4, 5, 6, 7]);
    const s12 = g.pick([-3, -2, -1, 1, 2, 3]);
    const s23 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m2 = g.pick([-3, -2, -1, 1, 2, 3]);
    const m3 = g.pick([-3, -2, -1, 1, 2, 3]);
    const d1 = g.pick([-3, -2, -1, 1, 2, 3]);
    const d3 = g.pick([-3, -2, -1, 1, 2, 3]);
    const v1 = m1 + d1;
    const v3 = m3 + d3;
    return { s11, s12, s13, s22, s23, s33, m1, m2, m3, d1, d3, v1, v3 };
  }, p => {
    if (p.s12 === p.s23) return false;
    if (Math.abs(p.d1) === Math.abs(p.d3)) return false;
    const A = p.s11;
    const b = p.s13;
    const c1 = p.s12;
    const c2 = p.s23;
    const det = A * A - b * b;
    if (det <= 0) return false;
    const w1 = (A * c1 - b * c2) / det;
    const w2 = (A * c2 - b * c1) / det;
    const V = p.s22 - (c1 * w1 + c2 * w2);
    if (V < 0.5) return false;
    const X = w1 * p.d1 + w2 * p.d3;
    if (X === 0) return false;
    const truthM = p.m2 + X;
    const wrongM = [
      p.m2 + (c1 * p.d1 + c2 * p.d3) / A,
      p.m2 + (c1 * p.d1 + c2 * p.d3) / (A + b),
      p.m2 + ((A * c1 + b * c2) * p.d1 + (A * c2 + b * c1) * p.d3) / det,
      p.m2 + (c1 + c2) * (p.d1 + p.d3) / (2 * (A + b)),
      p.m2 + (c1 * p.d1 + c2 * p.d3) / (A - b),
      p.m2 - X,
      p.m2 + w1 * p.d1,
      p.m2 + w2 * p.d3,
      X,
      p.m2 + (c1 * p.v1 + c2 * p.v3) / A
    ];
    const wrongV = [
      p.s22 - (c1 * c1 + c2 * c2) / A,
      p.s22 - (c1 * c1 + c2 * c2) / (A + b),
      p.s22 - (c1 * c1 + c2 * c2) / det,
      p.s22 - (c1 + c2) * (c1 + c2) / (2 * (A + b)),
      p.s22 - c1 * c1 / A,
      p.s22 - ((A * c1 + b * c2) * c1 + (A * c2 + b * c1) * c2) / det,
      c1 * w1 + c2 * w2
    ];
    return wrongM.every(w => Math.abs(w - truthM) >= 0.02) && wrongV.every(w => Math.abs(w - V) >= 0.02);
  });
  const c9A = c9.s11;
  const c9b = c9.s13;
  const c9c1 = c9.s12;
  const c9c2 = c9.s23;
  const c9det = c9A * c9A - c9b * c9b;
  const c9w1 = (c9A * c9c1 - c9b * c9c2) / c9det;
  const c9w2 = (c9A * c9c2 - c9b * c9c1) / c9det;
  const c9Mean = c9.m2 + c9w1 * c9.d1 + c9w2 * c9.d3;
  const c9Var = c9.s22 - (c9c1 * c9w1 + c9c2 * c9w2);

  return [
    g.number({
      id: 'cond-mean',
      title: t('Conditional mean', '条件均值'),
      prompt: t(
        `The pair (x₁, x₂) is jointly Gaussian with mean μ = (${num(c1.m1)}, ${num(c1.m2)}) and covariance Σ = ${mat([[num(c1.s11), num(c1.s12)], [num(c1.s12), num(c1.s22)]])}. The value x₂ = ${num(c1.v)} is observed. What is the conditional mean E[x₁ | x₂ = ${num(c1.v)}]? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `二元变量 (x₁, x₂) 服从联合高斯分布，均值 μ = (${num(c1.m1)}, ${num(c1.m2)})，协方差矩阵 Σ = ${mat([[num(c1.s11), num(c1.s12)], [num(c1.s12), num(c1.s22)]])}。观测到 x₂ = ${num(c1.v)}。条件均值 E[x₁ | x₂ = ${num(c1.v)}] 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('E[x₁ | x₂]', 'E[x₁ | x₂]'), answer: c1Ans, tolerance: 0.006 }],
      hint: t(
        'Use E[x₁ | x₂] = m₁ + Σ₁₂ Σ₂₂⁻¹ (x₂ − m₂). Here Σ₂₂ is a single number, so Σ₂₂⁻¹ = 1/Σ₂₂.',
        '用 E[x₁ | x₂] = m₁ + Σ₁₂ Σ₂₂⁻¹ (x₂ − m₂)。这里 Σ₂₂ 是一个数，所以 Σ₂₂⁻¹ = 1/Σ₂₂。'
      ),
      explanation: t(
        `The observed value minus its mean is x₂ − m₂ = ${num(c1.v)} − ${par(c1.m2)} = ${num(c1.d)}. The gain is Σ₁₂/Σ₂₂ = ${num(c1.s12)}/${num(c1.s22)}. So E[x₁ | x₂] = m₁ + (Σ₁₂/Σ₂₂)(x₂ − m₂) = ${num(c1.m1)} + (${frac(c1.s12, c1.s22)})·(${num(c1.d)}) = ${exact(c1Ans)}.`,
        `观测值减去其均值：x₂ − m₂ = ${num(c1.v)} − ${par(c1.m2)} = ${num(c1.d)}。增益为 Σ₁₂/Σ₂₂ = ${num(c1.s12)}/${num(c1.s22)}。所以 E[x₁ | x₂] = m₁ + (Σ₁₂/Σ₂₂)(x₂ − m₂) = ${num(c1.m1)} + (${frac(c1.s12, c1.s22)})·(${num(c1.d)}) = ${exact(c1Ans)}。`
      ),
      audit: { kind: 'GP-02:cond-mean', params: { m1: c1.m1, m2: c1.m2, s11: c1.s11, s12: c1.s12, s22: c1.s22, v: c1.v } }
    }),
    g.number({
      id: 'cond-var',
      title: t('Conditional variance', '条件方差'),
      prompt: t(
        `The pair (x₁, x₂) is jointly Gaussian with mean μ = (${num(c2.m1)}, ${num(c2.m2)}) and covariance Σ = ${mat([[num(c2.s11), num(c2.s12)], [num(c2.s12), num(c2.s22)]])}. The value x₂ = ${num(c2.v)} is observed. What is the conditional variance Var(x₁ | x₂ = ${num(c2.v)})? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `二元变量 (x₁, x₂) 服从联合高斯分布，均值 μ = (${num(c2.m1)}, ${num(c2.m2)})，协方差矩阵 Σ = ${mat([[num(c2.s11), num(c2.s12)], [num(c2.s12), num(c2.s22)]])}。观测到 x₂ = ${num(c2.v)}。条件方差 Var(x₁ | x₂ = ${num(c2.v)}) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Var(x₁ | x₂)', 'Var(x₁ | x₂)'), answer: c2Ans, tolerance: 0.006 }],
      hint: t(
        'Use Var(x₁ | x₂) = Σ₁₁ − Σ₁₂ Σ₂₂⁻¹ Σ₂₁. Does the observed value appear in it?',
        '用 Var(x₁ | x₂) = Σ₁₁ − Σ₁₂ Σ₂₂⁻¹ Σ₂₁。观测值出现在里面吗？'
      ),
      explanation: t(
        `Var(x₁ | x₂) = Σ₁₁ − Σ₁₂²/Σ₂₂ = ${num(c2.s11)} − ${par(c2.s12)}²/${num(c2.s22)} = ${num(c2.s11)} − ${par(c2.s12 * c2.s12)}/${num(c2.s22)} = ${exact(c2Ans)}. The mean μ and the value x₂ = ${num(c2.v)} do not appear: the conditional variance is built from Σ only.`,
        `Var(x₁ | x₂) = Σ₁₁ − Σ₁₂²/Σ₂₂ = ${num(c2.s11)} − ${par(c2.s12)}²/${num(c2.s22)} = ${num(c2.s11)} − ${par(c2.s12 * c2.s12)}/${num(c2.s22)} = ${exact(c2Ans)}。均值 μ 和观测值 x₂ = ${num(c2.v)} 都没有出现：条件方差只由 Σ 决定。`
      ),
      audit: { kind: 'GP-02:cond-var', params: { m1: c2.m1, m2: c2.m2, s11: c2.s11, s12: c2.s12, s22: c2.s22, v: c2.v } }
    }),
    g.choice({
      id: 'value-shift',
      title: t('A different observed value', '换一个观测值'),
      prompt: t(
        `The pair (x₁, x₂) is jointly Gaussian with mean μ = (${num(c3.m1)}, ${num(c3.m2)}) and covariance Σ = ${mat([[num(c3.s11), num(c3.s12)], [num(c3.s12), num(c3.s22)]])}. In experiment A the value x₂ = ${num(c3.v1)} is observed; in experiment B the value x₂ = ${num(c3.v2)} is observed. Compare the conditional distributions p(x₁ | x₂ = ${num(c3.v1)}) and p(x₁ | x₂ = ${num(c3.v2)}). Which statement is correct?`,
        `二元变量 (x₁, x₂) 服从联合高斯分布，均值 μ = (${num(c3.m1)}, ${num(c3.m2)})，协方差矩阵 Σ = ${mat([[num(c3.s11), num(c3.s12)], [num(c3.s12), num(c3.s22)]])}。实验 A 观测到 x₂ = ${num(c3.v1)}，实验 B 观测到 x₂ = ${num(c3.v2)}。比较条件分布 p(x₁ | x₂ = ${num(c3.v1)}) 和 p(x₁ | x₂ = ${num(c3.v2)})。下列哪条说法正确？`
      ),
      options: [
        t('The conditional means differ and the conditional variances are equal.', '条件均值不同，条件方差相同。'),
        t('The conditional means are equal and the conditional variances differ.', '条件均值相同，条件方差不同。'),
        t('Both the conditional means and the conditional variances differ.', '条件均值和条件方差都不同。'),
        t('Neither changes: both conditional distributions are the same, because Σ is the same.', '两者都不变：两个条件分布完全相同，因为 Σ 没有变。')
      ],
      correct: 0,
      hint: t(
        'Look at where x₂ appears in the conditional mean and in the conditional variance.',
        '看看 x₂ 出现在条件均值里，还是出现在条件方差里。'
      ),
      explanation: t(
        `Mean: E[x₁ | x₂] = ${num(c3.m1)} + (${frac(c3.s12, c3.s22)})(x₂ − ${par(c3.m2)}) gives ${exact(c3Mean1)} for x₂ = ${num(c3.v1)} and ${exact(c3Mean2)} for x₂ = ${num(c3.v2)}; they differ. Variance: Σ₁₁ − Σ₁₂²/Σ₂₂ = ${num(c3.s11)} − ${par(c3.s12 * c3.s12)}/${num(c3.s22)} = ${exact(c3Var)} for both, because x₂ does not appear in it.`,
        `均值：E[x₁ | x₂] = ${num(c3.m1)} + (${frac(c3.s12, c3.s22)})(x₂ − ${par(c3.m2)})，x₂ = ${num(c3.v1)} 时为 ${exact(c3Mean1)}，x₂ = ${num(c3.v2)} 时为 ${exact(c3Mean2)}，两者不同。方差：Σ₁₁ − Σ₁₂²/Σ₂₂ = ${num(c3.s11)} − ${par(c3.s12 * c3.s12)}/${num(c3.s22)} = ${exact(c3Var)}，两种情形相同，因为 x₂ 不出现在其中。`
      )
    }),
    g.number({
      id: 'zero-cov',
      title: t('Zero covariance', '协方差为零'),
      prompt: t(
        `The pair (x₁, x₂) is jointly Gaussian with mean μ = (${num(c4.m1)}, ${num(c4.m2)}) and covariance Σ = ${mat([[num(c4.s11), '0'], ['0', num(c4.s22)]])}. The value x₂ = ${num(c4.v)} is observed. Find the conditional mean E[x₁ | x₂ = ${num(c4.v)}] and the conditional variance Var(x₁ | x₂ = ${num(c4.v)}). Give integers, fractions or decimals rounded to 2 places.`,
        `二元变量 (x₁, x₂) 服从联合高斯分布，均值 μ = (${num(c4.m1)}, ${num(c4.m2)})，协方差矩阵 Σ = ${mat([[num(c4.s11), '0'], ['0', num(c4.s22)]])}。观测到 x₂ = ${num(c4.v)}。求条件均值 E[x₁ | x₂ = ${num(c4.v)}] 与条件方差 Var(x₁ | x₂ = ${num(c4.v)})。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('E[x₁ | x₂]', 'E[x₁ | x₂]'), answer: c4Mean, tolerance: 0.006 },
        { label: t('Var(x₁ | x₂)', 'Var(x₁ | x₂)'), answer: c4Var, tolerance: 0.006 }
      ],
      hint: t(
        'Look at Σ₁₂. What does Σ₁₂ Σ₂₂⁻¹ (x₂ − m₂) become?',
        '看看 Σ₁₂。Σ₁₂ Σ₂₂⁻¹ (x₂ − m₂) 变成什么？'
      ),
      explanation: t(
        `Here Σ₁₂ = 0, so the correction Σ₁₂ Σ₂₂⁻¹ (x₂ − m₂) = 0 and Σ₁₂ Σ₂₂⁻¹ Σ₂₁ = 0. The conditional distribution is N(${num(c4.m1)}, ${num(c4.s11)}), the marginal of x₁: observing x₂ = ${num(c4.v)} tells us nothing about x₁.`,
        `这里 Σ₁₂ = 0，所以修正项 Σ₁₂ Σ₂₂⁻¹ (x₂ − m₂) = 0，Σ₁₂ Σ₂₂⁻¹ Σ₂₁ = 0。条件分布是 N(${num(c4.m1)}, ${num(c4.s11)})，也就是 x₁ 的边缘分布：观测到 x₂ = ${num(c4.v)} 对 x₁ 没有任何信息。`
      ),
      audit: { kind: 'GP-02:zero-cov', params: { m1: c4.m1, m2: c4.m2, s11: c4.s11, s22: c4.s22, v: c4.v } }
    }),
    g.choice({
      id: 'never-larger',
      title: t('A suspicious answer', '一个可疑的答案'),
      prompt: t(
        `The pair (x₁, x₂) is jointly Gaussian with covariance Σ = ${mat([[num(c5.s11), num(c5.s12)], [num(c5.s12), num(c5.s22)]])}. A student computes the conditional variance Var(x₁ | x₂) and reports ${num(c5Claim)}. Which statement is correct?`,
        `二元变量 (x₁, x₂) 服从联合高斯分布，协方差矩阵 Σ = ${mat([[num(c5.s11), num(c5.s12)], [num(c5.s12), num(c5.s22)]])}。一位同学计算条件方差 Var(x₁ | x₂)，得到 ${num(c5Claim)}。下列哪条说法正确？`
      ),
      options: [
        t(`Impossible: conditioning cannot make the variance of x₁ larger than Σ₁₁ = ${num(c5.s11)}.`, `不可能：条件化不会使 x₁ 的方差超过 Σ₁₁ = ${num(c5.s11)}。`),
        t('Possible: extra information about x₂ can make x₁ more uncertain.', '可能：关于 x₂ 的额外信息可以让 x₁ 更不确定。'),
        t(`Impossible: the conditional variance must equal Σ₁₁ = ${num(c5.s11)}, because x₂ is a fixed number.`, `不可能：条件方差必须等于 Σ₁₁ = ${num(c5.s11)}，因为 x₂ 是一个固定的数。`),
        t('Possible: the term Σ₁₂ Σ₂₂⁻¹ Σ₂₁ is added when Σ₁₂ is positive and subtracted when Σ₁₂ is negative.', '可能：Σ₁₂ 为正时，项 Σ₁₂ Σ₂₂⁻¹ Σ₂₁ 是加上去的；Σ₁₂ 为负时才是减去的。')
      ],
      correct: 0,
      hint: t(
        'Compare the reported value with Σ₁₁. What does the term Σ₁₂ Σ₂₂⁻¹ Σ₂₁ look like when Σ₂₂ > 0?',
        '把报出的值和 Σ₁₁ 比一比。当 Σ₂₂ > 0 时，项 Σ₁₂ Σ₂₂⁻¹ Σ₂₁ 是什么样的？'
      ),
      explanation: t(
        `Σ₁₂ Σ₂₂⁻¹ Σ₂₁ = ${par(c5.s12)}²/${num(c5.s22)} = ${exact(c5.s12 * c5.s12 / c5.s22)}, a square divided by a positive number, so it is positive. The conditional variance is Σ₁₁ − ${exact(c5.s12 * c5.s12 / c5.s22)} = ${num(c5.s11)} − ${exact(c5.s12 * c5.s12 / c5.s22)} = ${exact(c5True)}, which is smaller than Σ₁₁ = ${num(c5.s11)}. The reported ${num(c5Claim)} adds the term instead of subtracting it.`,
        `Σ₁₂ Σ₂₂⁻¹ Σ₂₁ = ${par(c5.s12)}²/${num(c5.s22)} = ${exact(c5.s12 * c5.s12 / c5.s22)}：平方除以正数，是正数。条件方差为 Σ₁₁ − ${exact(c5.s12 * c5.s12 / c5.s22)} = ${num(c5.s11)} − ${exact(c5.s12 * c5.s12 / c5.s22)} = ${exact(c5True)}，小于 Σ₁₁ = ${num(c5.s11)}。报出的 ${num(c5Claim)} 把这一项加了上去而不是减去。`
      )
    }),
    g.number({
      id: 'cov-after',
      title: t('Conditioning one variable in 3-D', '三维中观测一个变量'),
      prompt: t(
        `The triple (x₁, x₂, x₃) is jointly Gaussian with covariance Σ = ${mat([[num(c6.s11), num(c6.s12), num(c6.s13)], [num(c6.s12), num(c6.s22), num(c6.s23)], [num(c6.s13), num(c6.s23), num(c6.s33)]])}. The variable x₃ is observed; its value is not needed. Find the conditional variance Var(x₁ | x₃) and the conditional covariance Cov(x₁, x₂ | x₃). Give integers, fractions or decimals rounded to 2 places.`,
        `三元变量 (x₁, x₂, x₃) 服从联合高斯分布，协方差矩阵 Σ = ${mat([[num(c6.s11), num(c6.s12), num(c6.s13)], [num(c6.s12), num(c6.s22), num(c6.s23)], [num(c6.s13), num(c6.s23), num(c6.s33)]])}。观测到 x₃，其取值不需要。求条件方差 Var(x₁ | x₃) 与条件协方差 Cov(x₁, x₂ | x₃)。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('Var(x₁ | x₃)', 'Var(x₁ | x₃)'), answer: c6V, tolerance: 0.006 },
        { label: t('Cov(x₁, x₂ | x₃)', 'Cov(x₁, x₂ | x₃)'), answer: c6C, tolerance: 0.006 }
      ],
      hint: t(
        `Treat (x₁, x₂) as the first block and x₃ as the second: Σ₁₁ is the 2 × 2 block ${mat([[num(c6.s11), num(c6.s12)], [num(c6.s12), num(c6.s22)]])}, Σ₁₂ is the column (${num(c6.s13)}, ${num(c6.s23)}) and Σ₂₂ = ${num(c6.s33)}. The conditional covariance matrix is Σ₁₁ − Σ₁₂ Σ₂₂⁻¹ Σ₂₁; read off the entries you need.`,
        `把 (x₁, x₂) 看作第一块，x₃ 看作第二块：Σ₁₁ 是 2 × 2 的块 ${mat([[num(c6.s11), num(c6.s12)], [num(c6.s12), num(c6.s22)]])}，Σ₁₂ 是列 (${num(c6.s13)}, ${num(c6.s23)})，Σ₂₂ = ${num(c6.s33)}。条件协方差矩阵是 Σ₁₁ − Σ₁₂ Σ₂₂⁻¹ Σ₂₁，读出需要的元素。`
      ),
      explanation: t(
        `The correction is Σ₁₂ Σ₂₂⁻¹ Σ₂₁ = (1/${num(c6.s33)})·${mat([[num(c6.s13 * c6.s13), num(c6.s13 * c6.s23)], [num(c6.s13 * c6.s23), num(c6.s23 * c6.s23)]])}. So Var(x₁ | x₃) = ${num(c6.s11)} − ${par(c6.s13 * c6.s13)}/${num(c6.s33)} = ${exact(c6V)} and Cov(x₁, x₂ | x₃) = ${num(c6.s12)} − (${num(c6.s13)})·(${num(c6.s23)})/${num(c6.s33)} = ${num(c6.s12)} − (${num(c6.s13 * c6.s23)})/${num(c6.s33)} = ${exact(c6C)}.`,
        `修正项为 Σ₁₂ Σ₂₂⁻¹ Σ₂₁ = (1/${num(c6.s33)})·${mat([[num(c6.s13 * c6.s13), num(c6.s13 * c6.s23)], [num(c6.s13 * c6.s23), num(c6.s23 * c6.s23)]])}。所以 Var(x₁ | x₃) = ${num(c6.s11)} − ${par(c6.s13 * c6.s13)}/${num(c6.s33)} = ${exact(c6V)}，Cov(x₁, x₂ | x₃) = ${num(c6.s12)} − (${num(c6.s13)})·(${num(c6.s23)})/${num(c6.s33)} = ${num(c6.s12)} − (${num(c6.s13 * c6.s23)})/${num(c6.s33)} = ${exact(c6C)}。`
      ),
      audit: { kind: 'GP-02:cov-after', params: { s11: c6.s11, s12: c6.s12, s13: c6.s13, s22: c6.s22, s23: c6.s23, s33: c6.s33 } }
    }),
    g.number({
      id: 'two-obs',
      title: t('Two observed variables', '观测两个变量'),
      prompt: t(
        `The triple (x₁, x₂, x₃) is jointly Gaussian with mean μ = (${num(c7.m1)}, ${num(c7.m2)}, ${num(c7.m3)}) and covariance Σ = ${mat([[num(c7.s11), num(c7.s12), num(c7.s13)], [num(c7.s12), num(c7.s22), '0'], [num(c7.s13), '0', num(c7.s33)]])}. The values x₂ = ${num(c7.v2)} and x₃ = ${num(c7.v3)} are observed. Find the conditional mean E[x₁ | x₂ = ${num(c7.v2)}, x₃ = ${num(c7.v3)}] and the conditional variance Var(x₁ | x₂ = ${num(c7.v2)}, x₃ = ${num(c7.v3)}). Give integers, fractions or decimals rounded to 2 places.`,
        `三元变量 (x₁, x₂, x₃) 服从联合高斯分布，均值 μ = (${num(c7.m1)}, ${num(c7.m2)}, ${num(c7.m3)})，协方差矩阵 Σ = ${mat([[num(c7.s11), num(c7.s12), num(c7.s13)], [num(c7.s12), num(c7.s22), '0'], [num(c7.s13), '0', num(c7.s33)]])}。观测到 x₂ = ${num(c7.v2)}、x₃ = ${num(c7.v3)}。求条件均值 E[x₁ | x₂ = ${num(c7.v2)}, x₃ = ${num(c7.v3)}] 与条件方差 Var(x₁ | x₂ = ${num(c7.v2)}, x₃ = ${num(c7.v3)})。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('E[x₁ | x₂, x₃]', 'E[x₁ | x₂, x₃]'), answer: c7Mean, tolerance: 0.006 },
        { label: t('Var(x₁ | x₂, x₃)', 'Var(x₁ | x₂, x₃)'), answer: c7Var, tolerance: 0.006 }
      ],
      hint: t(
        `Take the first variable as block 1 and (x₂, x₃) as block 2. Σ₂₂ is diagonal, so Σ₂₂⁻¹ = diag(1/${num(c7.s22)}, 1/${num(c7.s33)}) and Σ₁₂ = (${num(c7.s12)}, ${num(c7.s13)}). Then use the mean and variance formulas with these blocks.`,
        `把第一个变量作为第 1 块，(x₂, x₃) 作为第 2 块。Σ₂₂ 是对角矩阵，所以 Σ₂₂⁻¹ = diag(1/${num(c7.s22)}, 1/${num(c7.s33)})，Σ₁₂ = (${num(c7.s12)}, ${num(c7.s13)})。再用均值和方差公式。`
      ),
      explanation: t(
        `Σ₂₂⁻¹ = diag(1/${num(c7.s22)}, 1/${num(c7.s33)}), Σ₁₂ = (${num(c7.s12)}, ${num(c7.s13)}), x₂ − m₂ = ${num(c7.v2)} − ${par(c7.m2)} = ${num(c7.e2)}, x₃ − m₃ = ${num(c7.v3)} − ${par(c7.m3)} = ${num(c7.e3)}. Mean: ${num(c7.m1)} + ${par(c7.s12)}·(${num(c7.e2)})/${num(c7.s22)} + ${par(c7.s13)}·(${num(c7.e3)})/${num(c7.s33)} = ${exact(c7Mean)}. Variance: ${num(c7.s11)} − ${par(c7.s12)}²/${num(c7.s22)} − ${par(c7.s13)}²/${num(c7.s33)} = ${exact(c7Var)}.`,
        `Σ₂₂⁻¹ = diag(1/${num(c7.s22)}, 1/${num(c7.s33)})，Σ₁₂ = (${num(c7.s12)}, ${num(c7.s13)})，x₂ − m₂ = ${num(c7.v2)} − ${par(c7.m2)} = ${num(c7.e2)}，x₃ − m₃ = ${num(c7.v3)} − ${par(c7.m3)} = ${num(c7.e3)}。均值：${num(c7.m1)} + ${par(c7.s12)}·(${num(c7.e2)})/${num(c7.s22)} + ${par(c7.s13)}·(${num(c7.e3)})/${num(c7.s33)} = ${exact(c7Mean)}。方差：${num(c7.s11)} − ${par(c7.s12)}²/${num(c7.s22)} − ${par(c7.s13)}²/${num(c7.s33)} = ${exact(c7Var)}。`
      ),
      audit: { kind: 'GP-02:two-obs', params: { m1: c7.m1, m2: c7.m2, m3: c7.m3, s11: c7.s11, s12: c7.s12, s13: c7.s13, s22: c7.s22, s33: c7.s33, v2: c7.v2, v3: c7.v3 } }
    }),
    g.number({
      id: 'precision',
      title: t('Conditioning from the precision matrix', '由精度矩阵做条件化'),
      prompt: t(
        `The pair (x₁, x₂) is jointly Gaussian with mean μ = (${num(c8.m1)}, ${num(c8.m2)}). You are given its precision matrix (the inverse of the covariance matrix), not Σ itself: Λ = Σ⁻¹ = ${mat([[num(c8.l11), num(c8.l12)], [num(c8.l12), num(c8.l22)]])}. The value x₂ = ${num(c8.v)} is observed. Find the conditional mean E[x₁ | x₂ = ${num(c8.v)}] and the conditional variance Var(x₁ | x₂ = ${num(c8.v)}). Give integers, fractions or decimals rounded to 2 places.`,
        `二元变量 (x₁, x₂) 服从联合高斯分布，均值 μ = (${num(c8.m1)}, ${num(c8.m2)})。给出的是它的精度矩阵（协方差矩阵的逆），而不是 Σ 本身：Λ = Σ⁻¹ = ${mat([[num(c8.l11), num(c8.l12)], [num(c8.l12), num(c8.l22)]])}。观测到 x₂ = ${num(c8.v)}。求条件均值 E[x₁ | x₂ = ${num(c8.v)}] 与条件方差 Var(x₁ | x₂ = ${num(c8.v)})。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('E[x₁ | x₂]', 'E[x₁ | x₂]'), answer: c8Mean, tolerance: 0.006 },
        { label: t('Var(x₁ | x₂)', 'Var(x₁ | x₂)'), answer: c8Var, tolerance: 0.006 }
      ],
      hint: t(
        'In the precision form, x₁ | x₂ ~ N(m₁ − Λ₁₁⁻¹ Λ₁₂ (x₂ − m₂), Λ₁₁⁻¹): the conditional covariance is the inverse of the top-left entry of Λ. No inversion of Λ is needed.',
        '精度形式下，x₁ | x₂ ~ N(m₁ − Λ₁₁⁻¹ Λ₁₂ (x₂ − m₂), Λ₁₁⁻¹)：条件协方差是 Λ 左上角元素的倒数。不需要对 Λ 求逆。'
      ),
      explanation: t(
        `Conditional variance = 1/Λ₁₁ = ${exact(c8Var)}. Conditional mean = m₁ − (Λ₁₂/Λ₁₁)(x₂ − m₂) = ${num(c8.m1)} − (${frac(c8.l12, c8.l11)})·(${num(c8.d)}) = ${exact(c8Mean)}, with x₂ − m₂ = ${num(c8.v)} − ${par(c8.m2)} = ${num(c8.d)}.`,
        `条件方差 = 1/Λ₁₁ = ${exact(c8Var)}。条件均值 = m₁ − (Λ₁₂/Λ₁₁)(x₂ − m₂) = ${num(c8.m1)} − (${frac(c8.l12, c8.l11)})·(${num(c8.d)}) = ${exact(c8Mean)}，其中 x₂ − m₂ = ${num(c8.v)} − ${par(c8.m2)} = ${num(c8.d)}。`
      ),
      audit: { kind: 'GP-02:precision', params: { m1: c8.m1, m2: c8.m2, l11: c8.l11, l12: c8.l12, l22: c8.l22, v: c8.v } }
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the middle variable', '挑战：中间的变量'),
      prompt: t(
        `The triple (x₁, x₂, x₃) is jointly Gaussian with mean μ = (${num(c9.m1)}, ${num(c9.m2)}, ${num(c9.m3)}) and covariance Σ = ${mat([[num(c9.s11), num(c9.s12), num(c9.s13)], [num(c9.s12), num(c9.s22), num(c9.s23)], [num(c9.s13), num(c9.s23), num(c9.s33)]])}. The values x₁ = ${num(c9.v1)} and x₃ = ${num(c9.v3)} are observed. Find the conditional mean and the conditional variance of x₂ given x₁ and x₃. Give integers, fractions or decimals rounded to 2 places.`,
        `三元变量 (x₁, x₂, x₃) 服从联合高斯分布，均值 μ = (${num(c9.m1)}, ${num(c9.m2)}, ${num(c9.m3)})，协方差矩阵 Σ = ${mat([[num(c9.s11), num(c9.s12), num(c9.s13)], [num(c9.s12), num(c9.s22), num(c9.s23)], [num(c9.s13), num(c9.s23), num(c9.s33)]])}。观测到 x₁ = ${num(c9.v1)}、x₃ = ${num(c9.v3)}。求 x₂ 在给定 x₁ 和 x₃ 时的条件均值与条件方差。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: t('E[x₂ | x₁, x₃]', 'E[x₂ | x₁, x₃]'), answer: c9Mean, tolerance: 0.006 },
        { label: t('Var(x₂ | x₁, x₃)', 'Var(x₂ | x₁, x₃)'), answer: c9Var, tolerance: 0.006 }
      ],
      hint: t(
        `Take x₂ as the first block and (x₁, x₃) as the second: Σ₁₂ = (${num(c9.s12)}, ${num(c9.s23)}) and Σ₂₂ = ${mat([[num(c9.s11), num(c9.s13)], [num(c9.s13), num(c9.s11)]])}. For a 2 × 2 matrix keep the diagonal entries, change the sign of the off-diagonal ones and divide by the determinant.`,
        `把 x₂ 作为第一块，(x₁, x₃) 作为第二块：Σ₁₂ = (${num(c9.s12)}, ${num(c9.s23)})，Σ₂₂ = ${mat([[num(c9.s11), num(c9.s13)], [num(c9.s13), num(c9.s11)]])}。2 × 2 矩阵求逆：对角元交换，非对角元变号，再除以行列式。`
      ),
      explanation: t(
        `The observed block is Σ₂₂ = ${mat([[num(c9.s11), num(c9.s13)], [num(c9.s13), num(c9.s11)]])} with det = ${num(c9.s11)}² − ${par(c9.s13)}² = ${num(c9det)}, so Σ₂₂⁻¹ = (1/${num(c9det)})·${mat([[num(c9.s11), num(-c9.s13)], [num(-c9.s13), num(c9.s11)]])}. Then Σ₂₂⁻¹ Σ₂₁ = (${exact(c9w1)}, ${exact(c9w2)}) with Σ₂₁ = (${num(c9.s12)}, ${num(c9.s23)}). The deviations are x₁ − m₁ = ${num(c9.v1)} − ${par(c9.m1)} = ${num(c9.d1)} and x₃ − m₃ = ${num(c9.v3)} − ${par(c9.m3)} = ${num(c9.d3)}. Mean: ${num(c9.m2)} + (${exact(c9w1)})·(${num(c9.d1)}) + (${exact(c9w2)})·(${num(c9.d3)}) = ${exact(c9Mean)}. Variance: ${num(c9.s22)} − [${par(c9.s12)}·(${exact(c9w1)}) + ${par(c9.s23)}·(${exact(c9w2)})] = ${exact(c9Var)}. This game does not assess sampling from a Gaussian, Bayesian regression or noisy GP posteriors.`,
        `观测块为 Σ₂₂ = ${mat([[num(c9.s11), num(c9.s13)], [num(c9.s13), num(c9.s11)]])}，det = ${num(c9.s11)}² − ${par(c9.s13)}² = ${num(c9det)}，所以 Σ₂₂⁻¹ = (1/${num(c9det)})·${mat([[num(c9.s11), num(-c9.s13)], [num(-c9.s13), num(c9.s11)]])}。于是 Σ₂₂⁻¹ Σ₂₁ = (${exact(c9w1)}, ${exact(c9w2)})，其中 Σ₂₁ = (${num(c9.s12)}, ${num(c9.s23)})。偏差为 x₁ − m₁ = ${num(c9.v1)} − ${par(c9.m1)} = ${num(c9.d1)}，x₃ − m₃ = ${num(c9.v3)} − ${par(c9.m3)} = ${num(c9.d3)}。均值：${num(c9.m2)} + (${exact(c9w1)})·(${num(c9.d1)}) + (${exact(c9w2)})·(${num(c9.d3)}) = ${exact(c9Mean)}。方差：${num(c9.s22)} − [${par(c9.s12)}·(${exact(c9w1)}) + ${par(c9.s23)}·(${exact(c9w2)})] = ${exact(c9Var)}。本游戏不考查高斯采样、贝叶斯回归和带噪声的 GP 后验。`
      ),
      audit: { kind: 'GP-02:challenge', params: { m1: c9.m1, m2: c9.m2, m3: c9.m3, s11: c9.s11, s12: c9.s12, s13: c9.s13, s22: c9.s22, s23: c9.s23, s33: c9.s33, v1: c9.v1, v3: c9.v3 } }
    })
  ];
};
