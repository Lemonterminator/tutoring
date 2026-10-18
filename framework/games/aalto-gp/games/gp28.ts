import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, num, type Text } from '../support';

/**
 * GP-28 — Three views of a stationary GP
 * 9 cards: spectral-ou, lambda-from-peak, stationary-var, cov-from-sde,
 *          spectral-from-sde, unit-variance-qc, state-dim, markov-exact, challenge
 */
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

/** Print x²: integer → "4²", decimal → "(1.5)²" */
function sq(x: number): string {
  if (Number.isInteger(x)) return `${x}²`;
  return `(${x})²`;
}

/** Check if a number has a "nice" reduced denominator in {1,2,4,5,10,20,25} */
function niceDenom(x: number): boolean {
  if (!isFinite(x) || x <= 0) return false;
  const allowed = [1, 2, 4, 5, 10, 20, 25];
  for (const d of allowed) {
    const n = x * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return true;
  }
  return false;
}

/** Compute the minimum absolute difference between key and a list of wrong routes */
function minGap(key: number, routes: number[]): number {
  let min = Infinity;
  for (const r of routes) {
    const d = Math.abs(key - r);
    if (d < min) min = d;
  }
  return min;
}

export const gp28: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-28');
  warm(g);

  // ─── Card 1: spectral-ou ───
  const c1 = retry(
    () => ({ lam: g.pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6]), om: g.pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6]) }),
    (v) => {
      const key = 2 * v.lam / (v.lam * v.lam + v.om * v.om);
      if (!niceDenom(key)) return false;
      const R1 = 2 / (v.lam * v.lam + v.om * v.om);
      const R2 = v.lam / (v.lam * v.lam + v.om * v.om);
      const R3 = 2 * v.lam / ((v.lam + v.om) * (v.lam + v.om));
      const R4 = 2 / v.lam;
      // Admit the exact boundary gap 1/10 (e.g. λ=4, ω=2) despite float subtraction.
      return minGap(key, [R1, R2, R3, R4]) >= 0.1 - 1e-12;
    }
  );
  const c1Key = 2 * c1.lam / (c1.lam * c1.lam + c1.om * c1.om);
  const c1R1 = 2 / (c1.lam * c1.lam + c1.om * c1.om);
  const c1R2 = c1.lam / (c1.lam * c1.lam + c1.om * c1.om);
  const c1R3 = 2 * c1.lam / ((c1.lam + c1.om) * (c1.lam + c1.om));
  const c1R4 = 2 / c1.lam;

  // ─── Card 2: lambda-from-peak ───
  const c2 = retry(
    () => ({ s0: g.pick([0.1, 0.2, 0.25, 0.4, 0.5, 0.8, 1.6, 2, 4, 5]) }),
    (v) => {
      const key = 2 / v.s0;
      if (!niceDenom(key)) return false;
      const R1 = 1 / v.s0;
      const R2 = v.s0;
      const R3 = 4 / v.s0;
      const R4 = v.s0 / 2;
      return minGap(key, [R1, R2, R3, R4]) >= 0.25;
    }
  );
  const c2Key = 2 / c2.s0;
  const c2R1 = 1 / c2.s0;
  const c2R2 = c2.s0;
  const c2R3 = 4 / c2.s0;
  const c2R4 = c2.s0 / 2;

  // ─── Card 3: stationary-var ───
  const c3 = retry(
    () => ({ lam: g.pick([2, 3, 4, 5]), qc: g.pick([1, 2, 3, 4, 5, 6, 8, 10, 12]) }),
    (v) => {
      const key = v.qc / (2 * v.lam);
      if (!niceDenom(key)) return false;
      const R1 = v.qc / v.lam;
      const R2 = v.qc / (2 * v.lam * v.lam);
      const R3 = 2 * v.lam / v.qc;
      const R4 = v.qc / 2;
      return minGap(key, [R1, R2, R3, R4]) >= 0.25;
    }
  );
  const c3Key = c3.qc / (2 * c3.lam);
  const c3R1 = c3.qc / c3.lam;
  const c3R2 = c3.qc / (2 * c3.lam * c3.lam);
  const c3R3 = 2 * c3.lam / c3.qc;
  const c3R4 = c3.qc / 2;

  // ─── Card 4: cov-from-sde ───
  const c4 = retry(
    () => ({ lam: g.pick([1, 2, 4, 5]), qc: g.pick([2, 4, 5, 6, 8, 10, 12]), a: g.pick([0.2, 0.25, 0.4, 0.5, 0.75, 0.8]) }),
    (v) => {
      const key = v.a * v.qc / (2 * v.lam);
      if (!niceDenom(key)) return false;
      const pinf = v.qc / (2 * v.lam);
      const R1 = pinf;
      const R2 = v.a * v.qc / v.lam;
      const R3 = v.a * v.qc;
      const R4 = v.a * v.a * pinf;
      const R5 = (1 - v.a * v.a) * pinf;
      return minGap(key, [R1, R2, R3, R4, R5]) >= 0.25;
    }
  );
  const c4Pinf = c4.qc / (2 * c4.lam);
  const c4Key = c4.a * c4.qc / (2 * c4.lam);
  const c4R1 = c4Pinf;
  const c4R2 = c4.a * c4.qc / c4.lam;
  const c4R3 = c4.a * c4.qc;
  const c4R4 = c4.a * c4.a * c4Pinf;
  const c4R5 = (1 - c4.a * c4.a) * c4Pinf;

  // ─── Card 5: spectral-from-sde ───
  const c5 = retry(
    () => ({ lam: g.pick([1, 2, 3, 4]), Lv: g.pick([2, 3]), qc: g.pick([1, 2, 3, 4]), om: g.pick([1, 2, 3, 4]) }),
    (v) => {
      const den = v.lam * v.lam + v.om * v.om;
      const key = v.Lv * v.Lv * v.qc / den;
      if (!niceDenom(key)) return false;
      const R1 = v.Lv * v.qc / den;
      const R2 = v.qc / den;
      const R3 = v.Lv * v.Lv * v.qc / ((v.lam + v.om) * (v.lam + v.om));
      const R4 = v.Lv * v.Lv * v.qc / (v.lam * v.lam + v.om);
      const R5 = 2 * v.lam * v.Lv * v.Lv * v.qc / den;
      return minGap(key, [R1, R2, R3, R4, R5]) >= 0.5;
    }
  );
  const c5L2 = c5.Lv * c5.Lv;
  const c5Num = c5L2 * c5.qc;
  const c5Den = c5.lam * c5.lam + c5.om * c5.om;
  const c5Key = c5Num / c5Den;
  const c5R1 = c5.Lv * c5.qc / c5Den;
  const c5R2 = c5.qc / c5Den;
  const c5R3 = c5Num / ((c5.lam + c5.om) * (c5.lam + c5.om));
  const c5R4 = c5Num / (c5.lam * c5.lam + c5.om);
  const c5R5 = 2 * c5.lam * c5Num / c5Den;

  // ─── Card 6: unit-variance-qc ───
  const c6 = retry(
    () => ({ lam: g.pick([0.5, 1.5, 2, 2.5, 4, 5, 7, 10]) }),
    (v) => {
      const key = 2 * v.lam;
      if (!niceDenom(key)) return false;
      const R1 = 2;
      const R2 = v.lam;
      const R3 = v.lam / 2;
      const R4 = 2 * v.lam * v.lam;
      return minGap(key, [R1, R2, R3, R4]) >= 0.5;
    }
  );
  const c6Key = 2 * c6.lam;
  const c6R1 = 2;
  const c6R2 = c6.lam;
  const c6R3 = c6.lam / 2;
  const c6R4 = 2 * c6.lam * c6.lam;

  // ─── Card 7: state-dim ───
  const c7 = retry(
    () => ({ form: g.pick([1, 2]), m1: g.pick([1, 2, 3]), m2: g.pick([1, 2, 3]), m3: g.pick([1, 2, 3]) }),
    (v) => {
      let key: number;
      let routes: number[];
      if (v.form === 1) {
        key = (v.m1 + v.m2) * v.m3;
        routes = [v.m1 + v.m2 + v.m3, v.m1 * v.m2 * v.m3, v.m1 + v.m2 * v.m3, v.m1 * v.m3 + v.m2];
      } else {
        key = v.m1 * v.m2 + v.m3;
        routes = [v.m1 + v.m2 + v.m3, v.m1 * v.m2 * v.m3, v.m1 * (v.m2 + v.m3), (v.m1 + v.m2) * v.m3];
      }
      return minGap(key, routes) >= 1;
    }
  );
  let c7Key: number, c7R1: number, c7R2: number, c7R3: number, c7R4: number;
  if (c7.form === 1) {
    const c7T = c7.m1 + c7.m2;
    c7Key = c7T * c7.m3;
    c7R1 = c7.m1 + c7.m2 + c7.m3;
    c7R2 = c7.m1 * c7.m2 * c7.m3;
    c7R3 = c7.m1 + c7.m2 * c7.m3;
    c7R4 = c7.m1 * c7.m3 + c7.m2;
  } else {
    const c7T = c7.m1 * c7.m2;
    c7Key = c7T + c7.m3;
    c7R1 = c7.m1 + c7.m2 + c7.m3;
    c7R2 = c7.m1 * c7.m2 * c7.m3;
    c7R3 = c7.m1 * (c7.m2 + c7.m3);
    c7R4 = (c7.m1 + c7.m2) * c7.m3;
  }

  // ─── Card 8: markov-exact (choice) ───
  const c8 = retry(
    () => {
      const family = g.pick([1, 2, 3]);
      if (family === 1 || family === 2) {
        return { family, a: g.pick([1, 2, 3]), c: g.pick([2, 4, 6]), b: 0 };
      }
      return { family, a: 0, c: g.pick([1, 2, 3]), b: g.pick([2, 4, 8]) };
    },
    () => true
  );
  const c8A2 = c8.a * c8.a;
  const c8Sform = c8.family === 1
    ? `${c8.c} / (${c8A2} + ω²)`
    : c8.family === 2
      ? `${c8.c} / (${c8A2} + ω²)²`
      : `${c8.c}·exp(−ω²/${c8.b})`;
  const c8Correct = c8.family === 3 ? 1 : 0;

  // ─── Card 9: challenge ───
  const c9 = retry(
    () => ({ s2: g.pick([0.5, 1, 1.5, 2, 3, 4]), ell: g.pick([0.5, 1, 2, 4]), om: g.pick([0.5, 1, 1.5, 2, 3]) }),
    (v) => {
      const key = 2 * v.s2 * v.ell / (1 + v.ell * v.ell * v.om * v.om);
      if (!niceDenom(key)) return false;
      const R1 = 2 * v.s2 * v.ell / (v.ell * v.ell + v.om * v.om);
      const R2 = (2 * v.s2 / v.ell) / (1 + v.om * v.om);
      const R3 = 2 * v.ell / (1 + v.ell * v.ell * v.om * v.om);
      const R4 = 2 * v.s2 * v.ell / (1 + v.ell * v.om * v.om);
      const R5 = (2 * v.s2 / v.ell) / (v.ell * v.ell + v.om * v.om);
      return minGap(key, [R1, R2, R3, R4, R5]) >= 0.25;
    }
  );
  const c9Lam = 1 / c9.ell;
  const c9Num = 2 * c9.s2 * c9Lam;
  const c9Den = c9Lam * c9Lam + c9.om * c9.om;
  const c9Key = c9Num / c9Den;
  const c9R1 = 2 * c9.s2 * c9.ell / (c9.ell * c9.ell + c9.om * c9.om);
  const c9R2 = (2 * c9.s2 / c9.ell) / (1 + c9.om * c9.om);
  const c9R3 = 2 * c9.ell / (1 + c9.ell * c9.ell * c9.om * c9.om);
  const c9R4 = 2 * c9.s2 * c9.ell / (1 + c9.ell * c9.om * c9.om);
  const c9R5 = (2 * c9.s2 / c9.ell) / (c9.ell * c9.ell + c9.om * c9.om);

  // ─── Build cards ───
  return [
    // Card 1: spectral-ou
    g.number({
      id: 'spectral-ou',
      title: t('Spectral density of the exponential kernel', '指数核的谱密度'),
      prompt: t(
        `A stationary GP has the covariance function κ(τ) = exp(−λ|τ|) with λ = ${num(c1.lam)}. Its spectral density is the Fourier transform of κ, S(ω) = ∫ κ(τ) exp(−iωτ) dτ over τ ∈ ℝ (Lecture 11 p. 8), where ω is an angular frequency and there is no factor 2π. What is S(ω) at ω = ${num(c1.om)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个平稳 GP 的协方差函数为 κ(τ) = exp(−λ|τ|)，λ = ${num(c1.lam)}。它的谱密度是 κ 的傅里叶变换 S(ω) = ∫ κ(τ) exp(−iωτ) dτ（对 τ ∈ ℝ 积分，第 11 讲第 8 页），其中 ω 是角频率，没有 2π 因子。ω = ${num(c1.om)} 处的 S(ω) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('S(ω)', 'S(ω)'), answer: c1Key, tolerance: 0.006 }],
      hint: t(
        'S(ω) is the Fourier transform of the covariance function (Lecture 11 p. 8). Is the spectral density of this kernel largest at ω = 0 or at large ω?',
        'S(ω) 是协方差函数的傅里叶变换（第 11 讲第 8 页）。这个核的谱密度在 ω = 0 处最大，还是在 ω 很大时最大？'
      ),
      explanation: t(
        `The Fourier transform of exp(−λ|τ|) is S(ω) = 2λ/(λ² + ω²) (Lecture 11 p. 13; Supplement p. 13). Here 2·${num(c1.lam)} = ${num(2 * c1.lam)} and ${sq(c1.lam)} + ${sq(c1.om)} = ${num(c1.lam * c1.lam)} + ${num(c1.om * c1.om)} = ${num(c1.lam * c1.lam + c1.om * c1.om)}, so S(${num(c1.om)}) = ${num(2 * c1.lam)} ÷ ${num(c1.lam * c1.lam + c1.om * c1.om)} = ${exact(c1Key)}. Dropping λ from the numerator would give ${exact(c1R1)}; forgetting the factor 2, ${exact(c1R2)}; squaring the sum λ + ω instead of adding the squares, ${exact(c1R3)}; ignoring ω, which is the peak value S(0), ${exact(c1R4)}.`,
        `exp(−λ|τ|) 的傅里叶变换为 S(ω) = 2λ/(λ² + ω²)（第 11 讲第 13 页；补充讲义第 13 页）。这里 2·${num(c1.lam)} = ${num(2 * c1.lam)}，${sq(c1.lam)} + ${sq(c1.om)} = ${num(c1.lam * c1.lam)} + ${num(c1.om * c1.om)} = ${num(c1.lam * c1.lam + c1.om * c1.om)}，所以 S(${num(c1.om)}) = ${num(2 * c1.lam)} ÷ ${num(c1.lam * c1.lam + c1.om * c1.om)} = ${exact(c1Key)}。分子里漏掉 λ 会得到 ${exact(c1R1)}；忘了因子 2 得到 ${exact(c1R2)}；把 λ + ω 整体平方而不是平方后相加得到 ${exact(c1R3)}；忽略 ω（即峰值 S(0)）得到 ${exact(c1R4)}。`
      ),
      audit: { kind: 'GP-28:spectral-ou', params: { lam: c1.lam, om: c1.om } },
    }),

    // Card 2: lambda-from-peak
    g.number({
      id: 'lambda-from-peak',
      title: t('Reading λ from the peak of the spectrum', '由谱的峰值读出 λ'),
      prompt: t(
        `A stationary GP has the covariance function κ(τ) = exp(−λ|τ|) with an unknown λ > 0. Its spectral density S(ω), the Fourier transform of κ (Lecture 11 p. 8), takes the value S(0) = ${num(c2.s0)} at ω = 0. What is λ? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个平稳 GP 的协方差函数为 κ(τ) = exp(−λ|τ|)，其中 λ > 0 未知。它的谱密度 S(ω) 是 κ 的傅里叶变换（第 11 讲第 8 页），在 ω = 0 处取值 S(0) = ${num(c2.s0)}。λ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('λ', 'λ'), answer: c2Key, tolerance: 0.006 }],
      hint: t(
        'Put ω = 0 into the spectral density of the exponential kernel (Lecture 11 p. 13) and ask how S(0) changes when λ gets larger.',
        '把 ω = 0 代入指数核的谱密度（第 11 讲第 13 页），想一想 λ 变大时 S(0) 怎样变化。'
      ),
      explanation: t(
        `S(ω) = 2λ/(λ² + ω²) (Lecture 11 p. 13), so at the peak S(0) = 2/λ. From 2/λ = ${num(c2.s0)} we get λ = 2 ÷ ${num(c2.s0)} = ${exact(c2Key)}. Check: 2 ÷ ${exact(c2Key)} = ${num(c2.s0)}. A larger λ means a smaller and wider spectrum. Forgetting the factor 2, 1/S(0), would give ${exact(c2R1)}; reading S(0) as λ itself, ${exact(c2R2)}; applying the factor 2 twice, ${exact(c2R3)}; keeping only the 2, S(0)/2, ${exact(c2R4)}.`,
        `S(ω) = 2λ/(λ² + ω²)（第 11 讲第 13 页），所以峰值 S(0) = 2/λ。由 2/λ = ${num(c2.s0)} 得 λ = 2 ÷ ${num(c2.s0)} = ${exact(c2Key)}。验算：2 ÷ ${exact(c2Key)} = ${num(c2.s0)}。λ 越大，谱越低也越宽。忘了因子 2，即取 1/S(0)，会得到 ${exact(c2R1)}；把 S(0) 直接当作 λ 得到 ${exact(c2R2)}；把因子 2 用了两次得到 ${exact(c2R3)}；只保留 2，即取 S(0)/2，得到 ${exact(c2R4)}。`
      ),
      audit: { kind: 'GP-28:lambda-from-peak', params: { s0: c2.s0 } },
    }),

    // Card 3: stationary-var
    g.number({
      id: 'stationary-var',
      title: t('Stationary variance of an SDE', 'SDE 的平稳方差'),
      prompt: t(
        `A scalar GP is the solution of the SDE df/dt = −λ f + w(t), where w(t) is white noise with spectral density Qc (Lecture 11 p. 9). Here λ = ${num(c3.lam)} and Qc = ${num(c3.qc)}. The process is in its stationary state f(0) ∼ N(0, P∞) (Lecture 11 p. 10). What is the stationary variance P∞? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个标量 GP 是 SDE df/dt = −λ f + w(t) 的解，其中 w(t) 是谱密度为 Qc 的白噪声（第 11 讲第 9 页）。这里 λ = ${num(c3.lam)}，Qc = ${num(c3.qc)}。该过程处于平稳状态 f(0) ∼ N(0, P∞)（第 11 讲第 10 页）。平稳方差 P∞ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('P∞', 'P∞'), answer: c3Key, tolerance: 0.006 }],
      hint: t(
        'In the stationary state the variance no longer changes with time. Which two effects change it: the decay −λ f and what else?',
        '在平稳状态下，方差不再随时间变化。是哪两种作用在改变方差：衰减项 −λ f 和什么？'
      ),
      explanation: t(
        `Stationarity (Lecture 11 p. 10): F P∞ + P∞ Fᵀ + L Qc Lᵀ = 0. With F = −λ and L = 1 this is −2λ P∞ + Qc = 0, so P∞ = Qc ÷ (2λ). Here 2·${num(c3.lam)} = ${num(2 * c3.lam)} and ${num(c3.qc)} ÷ ${num(2 * c3.lam)} = ${exact(c3Key)}. The same balance, decay −2λ P∞ against noise Qc, is the variance equation of Supplement p. 12. Forgetting the factor 2 would give ${exact(c3R1)}; squaring λ, ${exact(c3R2)}; inverting the ratio, ${exact(c3R3)}; ignoring the decay, ${exact(c3R4)}.`,
        `平稳条件（第 11 讲第 10 页）：F P∞ + P∞ Fᵀ + L Qc Lᵀ = 0。取 F = −λ、L = 1，得 −2λ P∞ + Qc = 0，所以 P∞ = Qc ÷ (2λ)。这里 2·${num(c3.lam)} = ${num(2 * c3.lam)}，${num(c3.qc)} ÷ ${num(2 * c3.lam)} = ${exact(c3Key)}。衰减项 −2λ P∞ 与噪声 Qc 的平衡，正是补充讲义第 12 页的方差方程。忘了因子 2 会得到 ${exact(c3R1)}；把 λ 平方得到 ${exact(c3R2)}；把比值倒过来得到 ${exact(c3R3)}；忽略衰减得到 ${exact(c3R4)}。`
      ),
      audit: { kind: 'GP-28:stationary-var', params: { lam: c3.lam, qc: c3.qc } },
    }),

    // Card 4: cov-from-sde
    g.number({
      id: 'cov-from-sde',
      title: t('Covariance at a lag from the SDE', '由 SDE 得到滞后协方差'),
      prompt: t(
        `A scalar GP is the stationary solution of df/dt = −λ f + w(t), where w(t) is white noise with spectral density Qc, with λ = ${num(c4.lam)} and Qc = ${num(c4.qc)}. For a lag τ > 0 it is given that exp(−λτ) = ${num(c4.a)}, so you need not evaluate any exponential. What is the covariance κ(τ) = Cov(f(t), f(t + τ))? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个标量 GP 是 SDE df/dt = −λ f + w(t) 的平稳解，其中 w(t) 是谱密度为 Qc 的白噪声，λ = ${num(c4.lam)}，Qc = ${num(c4.qc)}。对某个滞后 τ > 0，已知 exp(−λτ) = ${num(c4.a)}，因此不必自己计算指数。协方差 κ(τ) = Cov(f(t), f(t + τ)) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('κ(τ)', 'κ(τ)'), answer: c4Key, tolerance: 0.006 }],
      hint: t(
        'Lecture 11 p. 10 gives the covariance function of a stationary state-space model in terms of F and P∞. What are F and P∞ here?',
        '第 11 讲第 10 页给出了平稳状态空间模型的协方差函数，用 F 和 P∞ 表示。这里的 F 与 P∞ 各是什么？'
      ),
      explanation: t(
        `The stationary variance is P∞ = Qc ÷ (2λ) = ${num(c4.qc)} ÷ ${num(2 * c4.lam)} = ${exact(c4Pinf)} (stationarity, Lecture 11 p. 10). For a lag τ the covariance function of the stationary state is κ(τ) = exp(τF) P∞ (p. 10), here exp(−λτ)·P∞ = ${num(c4.a)}·${exact(c4Pinf)} = ${exact(c4Key)}. Giving P∞ itself would be ${exact(c4R1)}; forgetting the factor 2 in P∞, ${exact(c4R2)}; skipping P∞, ${exact(c4R3)}; squaring the decay, ${exact(c4R4)}; using the transition-noise variance (1 − a²)·P∞ instead, ${exact(c4R5)}.`,
        `平稳方差为 P∞ = Qc ÷ (2λ) = ${num(c4.qc)} ÷ ${num(2 * c4.lam)} = ${exact(c4Pinf)}（平稳条件，第 11 讲第 10 页）。滞后 τ 处平稳状态的协方差函数为 κ(τ) = exp(τF) P∞（第 10 页），这里是 exp(−λτ)·P∞ = ${num(c4.a)}·${exact(c4Pinf)} = ${exact(c4Key)}。直接给出 P∞ 会得到 ${exact(c4R1)}；P∞ 中漏掉因子 2 得到 ${exact(c4R2)}；跳过 P∞ 得到 ${exact(c4R3)}；把衰减平方得到 ${exact(c4R4)}；改用转移噪声的方差 (1 − a²)·P∞ 得到 ${exact(c4R5)}。`
      ),
      audit: { kind: 'GP-28:cov-from-sde', params: { lam: c4.lam, qc: c4.qc, a: c4.a } },
    }),

    // Card 5: spectral-from-sde
    g.number({
      id: 'spectral-from-sde',
      title: t('Spectral density from the SDE', '由 SDE 得到谱密度'),
      prompt: t(
        `A scalar GP is the stationary solution of the SDE df/dt = −λ f + L w(t) with H = 1, where w(t) is white noise with spectral density Qc (Lecture 11 pp. 9 and 10). Here λ = ${num(c5.lam)}, L = ${num(c5.Lv)} and Qc = ${num(c5.qc)}. Its spectral density is the Fourier transform of its covariance function, S(ω) = ∫ κ(τ) exp(−iωτ) dτ, with no factor 2π. What is S(ω) at ω = ${num(c5.om)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个标量 GP 是 SDE df/dt = −λ f + L w(t) 的平稳解，H = 1，其中 w(t) 是谱密度为 Qc 的白噪声（第 11 讲第 9、10 页）。这里 λ = ${num(c5.lam)}，L = ${num(c5.Lv)}，Qc = ${num(c5.qc)}。它的谱密度是协方差函数的傅里叶变换 S(ω) = ∫ κ(τ) exp(−iωτ) dτ，没有 2π 因子。ω = ${num(c5.om)} 处的 S(ω) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t(`S(${num(c5.om)})`, `S(${num(c5.om)})`), answer: c5Key, tolerance: 0.006 }],
      hint: t(
        'Lecture 11 p. 10 gives S(ω) for a stationary SDE in terms of F, L and Qc; in this scalar case every matrix is a single number.',
        '第 11 讲第 10 页给出了平稳 SDE 的 S(ω)，用 F、L 和 Qc 表示；这里是标量情形，每个矩阵都只是一个数。'
      ),
      explanation: t(
        `In the scalar case S(ω) = L²·Qc ÷ ((F + iω)(F − iω)) (Lecture 11 p. 10), and with F = −λ the product (F + iω)(F − iω) is λ² + ω². So S(ω) = L²·Qc ÷ (λ² + ω²). Here L² = ${num(c5L2)}, L²·Qc = ${num(c5L2)}·${num(c5.qc)} = ${num(c5Num)} and λ² + ω² = ${num(c5.lam * c5.lam)} + ${num(c5.om * c5.om)} = ${num(c5Den)}, so S(${num(c5.om)}) = ${num(c5Num)} ÷ ${num(c5Den)} = ${exact(c5Key)}. Check: the covariance function is κ(τ) = L²·Qc ÷ (2λ)·exp(−λ|τ|), whose Fourier transform is the same value. Using L instead of L² would give ${exact(c5R1)}; leaving L out, ${exact(c5R2)}; squaring the sum λ + ω, ${exact(c5R3)}; not squaring ω, ${exact(c5R4)}; reusing the numerator 2λ of the unit-variance kernel, ${exact(c5R5)}.`,
        `标量情形下 S(ω) = L²·Qc ÷ ((F + iω)(F − iω))（第 11 讲第 10 页），取 F = −λ 时乘积 (F + iω)(F − iω) 等于 λ² + ω²。所以 S(ω) = L²·Qc ÷ (λ² + ω²)。这里 L² = ${num(c5L2)}，L²·Qc = ${num(c5L2)}·${num(c5.qc)} = ${num(c5Num)}，λ² + ω² = ${num(c5.lam * c5.lam)} + ${num(c5.om * c5.om)} = ${num(c5Den)}，所以 S(${num(c5.om)}) = ${num(c5Num)} ÷ ${num(c5Den)} = ${exact(c5Key)}。验算：协方差函数为 κ(τ) = L²·Qc ÷ (2λ)·exp(−λ|τ|)，它的傅里叶变换是同一个值。用 L 而不是 L² 会得到 ${exact(c5R1)}；漏掉 L 得到 ${exact(c5R2)}；把 λ + ω 整体平方得到 ${exact(c5R3)}；ω 不平方得到 ${exact(c5R4)}；沿用单位方差核的分子 2λ 得到 ${exact(c5R5)}。`
      ),
      audit: { kind: 'GP-28:spectral-from-sde', params: { lam: c5.lam, L: c5.Lv, qc: c5.qc, om: c5.om } },
    }),

    // Card 6: unit-variance-qc
    g.number({
      id: 'unit-variance-qc',
      title: t('Noise level for unit variance', '单位方差所需的噪声强度'),
      prompt: t(
        `Lecture 11 p. 13 lists F = −λ, L = 1, Qc = 2, H = 1 and P∞ = 1 for the kernel κ(τ) = exp(−λ|τ|), where w(t) is white noise with spectral density Qc. Take λ = ${num(c6.lam)}. Using the stationary state of Lecture 11 p. 10, which value of Qc gives the stationary variance P∞ = 1 for this λ? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `第 11 讲第 13 页给出，核 κ(τ) = exp(−λ|τ|) 对应 F = −λ、L = 1、Qc = 2、H = 1、P∞ = 1，其中 w(t) 是谱密度为 Qc 的白噪声。取 λ = ${num(c6.lam)}。利用第 11 讲第 10 页的平稳状态，要使这个 λ 下的平稳方差 P∞ = 1，Qc 应取多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Qc', 'Qc'), answer: c6Key, tolerance: 0.006 }],
      hint: t(
        'Apply the stationarity condition of Lecture 11 p. 10 with P∞ = 1 and the λ above, then compare with the value Qc = 2 on the slide.',
        '用第 11 讲第 10 页的平稳条件，取 P∞ = 1 和上面的 λ，再与讲义上的 Qc = 2 比较。'
      ),
      explanation: t(
        `Stationarity (Lecture 11 p. 10) with F = −λ and L = 1 reads −2λ P∞ + Qc = 0, so Qc = 2λ P∞. With P∞ = 1 and λ = ${num(c6.lam)}: Qc = 2·${num(c6.lam)} = ${exact(c6Key)}. The slide value Qc = 2 gives P∞ = 2 ÷ (2·${num(c6.lam)}) = 1 ÷ ${num(c6.lam)}, which equals 1 only for λ = 1, so the pair on the slide is correct for λ = 1 only. This is consistent with the spectral density: Qc = 2λ turns Qc ÷ (λ² + ω²) into the 2λ ÷ (λ² + ω²) printed on the slide, while Qc = 2 would give 2 ÷ (λ² + ω²). Taking the slide value for every λ would give ${exact(c6R1)}; dropping the factor 2, ${exact(c6R2)}; halving, ${exact(c6R3)}; squaring λ, ${exact(c6R4)}.`,
        `平稳条件（第 11 讲第 10 页）取 F = −λ、L = 1，即 −2λ P∞ + Qc = 0，所以 Qc = 2λ P∞。取 P∞ = 1、λ = ${num(c6.lam)}：Qc = 2·${num(c6.lam)} = ${exact(c6Key)}。讲义上的 Qc = 2 给出 P∞ = 2 ÷ (2·${num(c6.lam)}) = 1 ÷ ${num(c6.lam)}，只有 λ = 1 时才等于 1，所以讲义上的这一组数只对 λ = 1 成立。这与谱密度一致：Qc = 2λ 把 Qc ÷ (λ² + ω²) 变成讲义上的 2λ ÷ (λ² + ω²)，而 Qc = 2 只会给出 2 ÷ (λ² + ω²)。对每个 λ 都取讲义上的值会得到 ${exact(c6R1)}；漏掉因子 2 得到 ${exact(c6R2)}；取一半得到 ${exact(c6R3)}；把 λ 平方得到 ${exact(c6R4)}。`
      ),
      audit: { kind: 'GP-28:unit-variance-qc', params: { lam: c6.lam } },
    }),

    // Card 7: state-dim
    // The visible construction number and kernel expression both identify the audited branch.
    g.number({
      id: 'state-dim',
      title: t('State dimension of sums and products', '和与积的状态维数'),
      prompt: t(
        `Kernel construction ${c7.form}: a stationary GP has the kernel κ = ${c7.form === 1 ? '(κ₁ + κ₂) κ₃' : 'κ₁ κ₂ + κ₃'}. Taken on their own, the kernels κ₁, κ₂ and κ₃ have state dimensions m₁ = ${num(c7.m1)}, m₂ = ${num(c7.m2)} and m₃ = ${num(c7.m3)}. Using the standard block-sum/Kronecker construction without state reduction, what is the state dimension m for κ (Lecture 11 p. 15)? Give an integer.`,
        `核的构造 ${c7.form}：一个平稳 GP 的核为 κ = ${c7.form === 1 ? '(κ₁ + κ₂) κ₃' : 'κ₁ κ₂ + κ₃'}。单独来看，核 κ₁、κ₂、κ₃ 的状态维数分别为 m₁ = ${num(c7.m1)}、m₂ = ${num(c7.m2)}、m₃ = ${num(c7.m3)}。采用标准的分块和与克罗内克构造，不做状态降维时，κ 的状态维数 m 是多少（第 11 讲第 15 页）？请填整数。`
      ),
      fields: [{ label: t('State dimension m', '状态维数 m'), answer: c7Key, tolerance: 0.006 }],
      hint: t(
        'Lecture 11 p. 15 says how the state dimension behaves for a sum and for a product of kernels. Work out the dimension of the inner part first, then combine it with the rest.',
        '第 11 讲第 15 页说明了核的和与积的状态维数如何变化。先算内层部分的维数，再与其余部分合并。'
      ),
      explanation: t(
        c7.form === 1
          ? `A sum of kernels stacks the state spaces, so the dimensions add; a product gives a Kronecker sum, so the dimensions multiply (Lecture 11 p. 15). κ₁ + κ₂ has ${num(c7.m1)} + ${num(c7.m2)} = ${num(c7.m1 + c7.m2)} states, and multiplying by κ₃ gives ${num(c7.m1 + c7.m2)}·${num(c7.m3)} = ${exact(c7Key)}. Adding all three dimensions would give ${exact(c7R1)}; multiplying all three, ${exact(c7R2)}; binding the product to the wrong kernel, m₁ + m₂·m₃, ${exact(c7R3)}; multiplying only κ₁ by κ₃, m₁·m₃ + m₂, ${exact(c7R4)}.`
          : `A sum of kernels stacks the state spaces, so the dimensions add; a product gives a Kronecker sum, so the dimensions multiply (Lecture 11 p. 15). κ₁ κ₂ has ${num(c7.m1)}·${num(c7.m2)} = ${num(c7.m1 * c7.m2)} states, and adding κ₃ gives ${num(c7.m1 * c7.m2)} + ${num(c7.m3)} = ${exact(c7Key)}. Adding all three dimensions would give ${exact(c7R1)}; multiplying all three, ${exact(c7R2)}; multiplying κ₁ by the sum m₂ + m₃, ${exact(c7R3)}; multiplying the sum m₁ + m₂ by m₃, ${exact(c7R4)}.`,
        c7.form === 1
          ? `核的和把状态空间叠起来，所以维数相加；核的积给出克罗内克和，所以维数相乘（第 11 讲第 15 页）。κ₁ + κ₂ 有 ${num(c7.m1)} + ${num(c7.m2)} = ${num(c7.m1 + c7.m2)} 个状态，再乘以 κ₃ 得 ${num(c7.m1 + c7.m2)}·${num(c7.m3)} = ${exact(c7Key)}。三个维数都相加会得到 ${exact(c7R1)}；三个都相乘得到 ${exact(c7R2)}；把积绑在错误的核上，即 m₁ + m₂·m₃，得到 ${exact(c7R3)}；只把 κ₁ 与 κ₃ 相乘，即 m₁·m₃ + m₂，得到 ${exact(c7R4)}。`
          : `核的和把状态空间叠起来，所以维数相加；核的积给出克罗内克和，所以维数相乘（第 11 讲第 15 页）。κ₁ κ₂ 有 ${num(c7.m1)}·${num(c7.m2)} = ${num(c7.m1 * c7.m2)} 个状态，再加上 κ₃ 得 ${num(c7.m1 * c7.m2)} + ${num(c7.m3)} = ${exact(c7Key)}。三个维数都相加会得到 ${exact(c7R1)}；三个都相乘得到 ${exact(c7R2)}；把 κ₁ 乘以和 m₂ + m₃，得到 ${exact(c7R3)}；把和 m₁ + m₂ 乘以 m₃，得到 ${exact(c7R4)}。`
      ),
      audit: { kind: 'GP-28:state-dim', params: { form: c7.form, m1: c7.m1, m2: c7.m2, m3: c7.m3 } },
    }),

    // Card 8: markov-exact (choice)
    g.choice({
      id: 'markov-exact',
      title: t('Exact or approximate state space?', '精确还是近似的状态空间？'),
      prompt: t(
        `A stationary GP has the spectral density S(ω) = ${c8Sform}. Which statement about writing this GP as a linear SDE with a finite state dimension is correct (Lecture 11 p. 15; Supplement p. 16)?`,
        `一个平稳 GP 的谱密度为 S(ω) = ${c8Sform}。关于把这个 GP 写成有限状态维数的线性 SDE，下面哪一项正确（第 11 讲第 15 页；补充讲义第 16 页）？`
      ),
      options: [
        t('S is a constant divided by a polynomial in ω², so a finite-dimensional linear SDE reproduces this GP exactly',
          'S 是常数除以 ω² 的多项式，所以有限维的线性 SDE 能精确生成这个 GP'),
        t('S is not a constant divided by a polynomial in ω², so a finite-dimensional state space gives only an approximation of this GP',
          'S 不是常数除以 ω² 的多项式，所以有限维状态空间只能近似这个 GP'),
        t('Every stationary GP has an exact finite-dimensional state space, because its kernel depends only on the lag t − t′, whatever the shape of S',
          '任何平稳 GP 都有精确的有限维状态空间，因为核只依赖时间差 t − t′，与 S 的形状无关'),
        t('A Gaussian-shaped S gives the exact state space and a rational S only an approximation, because a smoother spectrum is easier to represent',
          '高斯形状的 S 对应精确的状态空间，有理形式的 S 只能近似，因为越光滑的谱越容易表示'),
      ],
      correct: c8Correct,
      hint: t(
        'Compare the shape of S(ω) with the spectral density of the exponential kernel in Lecture 11 p. 13.',
        '把 S(ω) 的形状与第 11 讲第 13 页指数核的谱密度作比较。'
      ),
      explanation: t(
        c8.family === 1
          ? `Here S is ${c8.c} divided by ${c8A2} + ω², a constant over a polynomial of degree 1 in ω², which is the spectral density of an exponential kernel, so a first-order SDE with state dimension 1 reproduces it. A spectral density that is a constant divided by a polynomial in ω² comes from a linear SDE of finite order (Supplement p. 16; GPML pdf p. 230, B.26), and the exponential kernel is the first-order case (Lecture 11 p. 13). Stationarity alone is not enough: it only says that the kernel depends on t − t′, while Lecture 11 p. 15 asks for a Markovian kernel or one approximated as such. The Gaussian-shaped spectrum belongs to the squared-exponential kernel, which Supplement p. 16 only approximates by a rational spectrum; its sample paths are infinitely smooth, whereas an SDE of order p has paths that are only (p − 1)-times differentiable (GPML pdf p. 231; the exactness statement is standard theory, not a slide sentence). A smoother spectrum therefore does not make the state space exact. This game does not assess how the approximation is constructed.`
          : c8.family === 2
            ? `Here S is ${c8.c} divided by the square of ${c8A2} + ω², a constant over a polynomial of degree 2 in ω², which is the form of GPML pdf p. 230 B.30 with p = 2, so an SDE of order 2 (state dimension 2) reproduces it. A spectral density that is a constant divided by a polynomial in ω² comes from a linear SDE of finite order (Supplement p. 16; GPML pdf p. 230, B.26), and the exponential kernel is the first-order case (Lecture 11 p. 13). Stationarity alone is not enough: it only says that the kernel depends on t − t′, while Lecture 11 p. 15 asks for a Markovian kernel or one approximated as such. The Gaussian-shaped spectrum belongs to the squared-exponential kernel, which Supplement p. 16 only approximates by a rational spectrum; its sample paths are infinitely smooth, whereas an SDE of order p has paths that are only (p − 1)-times differentiable (GPML pdf p. 231; the exactness statement is standard theory, not a slide sentence). A smoother spectrum therefore does not make the state space exact. This game does not assess how the approximation is constructed.`
            : `Here S is ${c8.c === 1 ? "" : `${c8.c} times `}exp(−ω²/${c8.b}), which is not a constant over a polynomial in ω², so a finite state dimension gives only an approximation. A spectral density that is a constant divided by a polynomial in ω² comes from a linear SDE of finite order (Supplement p. 16; GPML pdf p. 230, B.26), and the exponential kernel is the first-order case (Lecture 11 p. 13). Stationarity alone is not enough: it only says that the kernel depends on t − t′, while Lecture 11 p. 15 asks for a Markovian kernel or one approximated as such. The Gaussian-shaped spectrum belongs to the squared-exponential kernel, which Supplement p. 16 only approximates by a rational spectrum; its sample paths are infinitely smooth, whereas an SDE of order p has paths that are only (p − 1)-times differentiable (GPML pdf p. 231; the exactness statement is standard theory, not a slide sentence). A smoother spectrum therefore does not make the state space exact. This game does not assess how the approximation is constructed.`,
        c8.family === 1
          ? `这里 S 是 ${c8.c} 除以 ${c8A2} + ω²，即常数除以 ω² 的一次多项式，也就是指数核的谱密度，所以一阶 SDE（状态维数 1）能精确生成它。谱密度若是常数除以 ω² 的多项式，就来自有限阶的线性 SDE（补充讲义第 16 页；教材 PDF 第 230 页，式 B.26），指数核是一阶情形（第 11 讲第 13 页）。仅有平稳性并不够：它只说明核依赖于 t − t′，而第 11 讲第 15 页要求核是马尔可夫的或可近似为马尔可夫的。高斯形状的谱对应平方指数核，补充讲义第 16 页只是用有理谱去近似它；它的样本路径无限光滑，而 p 阶 SDE 的路径只是 p − 1 次可微（教材 PDF 第 231 页；关于不能精确表示的说法是标准理论，不是讲义原句）。所以谱越光滑，并不意味着状态空间越精确。本游戏不考查近似是如何构造的。`
          : c8.family === 2
            ? `这里 S 是 ${c8.c} 除以 ${c8A2} + ω² 的平方，即常数除以 ω² 的二次多项式，正是教材 PDF 第 230 页式 B.30 中 p = 2 的形式，所以二阶 SDE（状态维数 2）能精确生成它。谱密度若是常数除以 ω² 的多项式，就来自有限阶的线性 SDE（补充讲义第 16 页；教材 PDF 第 230 页，式 B.26），指数核是一阶情形（第 11 讲第 13 页）。仅有平稳性并不够：它只说明核依赖于 t − t′，而第 11 讲第 15 页要求核是马尔可夫的或可近似为马尔可夫的。高斯形状的谱对应平方指数核，补充讲义第 16 页只是用有理谱去近似它；它的样本路径无限光滑，而 p 阶 SDE 的路径只是 p − 1 次可微（教材 PDF 第 231 页；关于不能精确表示的说法是标准理论，不是讲义原句）。所以谱越光滑，并不意味着状态空间越精确。本游戏不考查近似是如何构造的。`
            : `这里 S 是 ${c8.c === 1 ? "" : `${c8.c} 乘以 `}exp(−ω²/${c8.b})，不是常数除以 ω² 的多项式，所以有限状态维数只能给出近似。谱密度若是常数除以 ω² 的多项式，就来自有限阶的线性 SDE（补充讲义第 16 页；教材 PDF 第 230 页，式 B.26），指数核是一阶情形（第 11 讲第 13 页）。仅有平稳性并不够：它只说明核依赖于 t − t′，而第 11 讲第 15 页要求核是马尔可夫的或可近似为马尔可夫的。高斯形状的谱对应平方指数核，补充讲义第 16 页只是用有理谱去近似它；它的样本路径无限光滑，而 p 阶 SDE 的路径只是 p − 1 次可微（教材 PDF 第 231 页；关于不能精确表示的说法是标准理论，不是讲义原句）。所以谱越光滑，并不意味着状态空间越精确。本游戏不考查近似是如何构造的。`
      ),
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: spectral density with a variance and a length-scale', '挑战：带方差与长度尺度的谱密度'),
      prompt: t(
        `A stationary GP has the covariance function κ(τ) = σ² exp(−|τ|/ℓ) with σ² = ${num(c9.s2)} and ℓ = ${num(c9.ell)}. Its spectral density is S(ω) = ∫ κ(τ) exp(−iωτ) dτ over τ ∈ ℝ, with no factor 2π. What is S(ω) at ω = ${num(c9.om)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个平稳 GP 的协方差函数为 κ(τ) = σ² exp(−|τ|/ℓ)，σ² = ${num(c9.s2)}，ℓ = ${num(c9.ell)}。它的谱密度为 S(ω) = ∫ κ(τ) exp(−iωτ) dτ（对 τ ∈ ℝ 积分），没有 2π 因子。ω = ${num(c9.om)} 处的 S(ω) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t(`S(${num(c9.om)})`, `S(${num(c9.om)})`), answer: c9Key, tolerance: 0.006 }],
      hint: t(
        'Compare κ with exp(−λ|τ|) of Lecture 11 p. 13: what plays the role of λ? And how does a constant factor σ² pass through a Fourier transform (Supplement p. 7)?',
        '把 κ 与第 11 讲第 13 页的 exp(−λ|τ|) 比较：什么相当于 λ？另外，常数因子 σ² 如何通过傅里叶变换（补充讲义第 7 页）？'
      ),
      explanation: t(
        `Compare with exp(−λ|τ|): λ = 1 ÷ ℓ = 1 ÷ ${num(c9.ell)} = ${exact(c9Lam)}. The Fourier transform is linear (Supplement p. 7), so the factor σ² passes through and S(ω) = σ²·2λ ÷ (λ² + ω²). Here 2·${num(c9.s2)}·${exact(c9Lam)} = ${exact(c9Num)} and ${sq(c9Lam)} + ${sq(c9.om)} = ${exact(c9Lam * c9Lam)} + ${exact(c9.om * c9.om)} = ${exact(c9Den)}, so S(${num(c9.om)}) = ${exact(c9Num)} ÷ ${exact(c9Den)} = ${exact(c9Key)}. In the length-scale form this is 2σ²ℓ ÷ (1 + ℓ²ω²) = 2·${num(c9.s2)}·${num(c9.ell)} ÷ (1 + ${exact(c9.ell * c9.ell)}·${exact(c9.om * c9.om)}) = ${exact(c9Key)}. Reading ℓ as λ would give ${exact(c9R1)}; putting λ = 1/ℓ only in the numerator, ${exact(c9R2)}; forgetting σ², ${exact(c9R3)}; not squaring ℓ, ${exact(c9R4)}; mixing 1/ℓ in the numerator with ℓ² in the denominator, ${exact(c9R5)}. This game does not assess evaluating the Fourier integral itself or fitting σ² and ℓ.`,
        `与 exp(−λ|τ|) 比较：λ = 1 ÷ ℓ = 1 ÷ ${num(c9.ell)} = ${exact(c9Lam)}。傅里叶变换是线性的（补充讲义第 7 页），所以因子 σ² 直接穿过去，S(ω) = σ²·2λ ÷ (λ² + ω²)。这里 2·${num(c9.s2)}·${exact(c9Lam)} = ${exact(c9Num)}，${sq(c9Lam)} + ${sq(c9.om)} = ${exact(c9Lam * c9Lam)} + ${exact(c9.om * c9.om)} = ${exact(c9Den)}，所以 S(${num(c9.om)}) = ${exact(c9Num)} ÷ ${exact(c9Den)} = ${exact(c9Key)}。用长度尺度的写法就是 2σ²ℓ ÷ (1 + ℓ²ω²) = 2·${num(c9.s2)}·${num(c9.ell)} ÷ (1 + ${exact(c9.ell * c9.ell)}·${exact(c9.om * c9.om)}) = ${exact(c9Key)}。把 ℓ 当作 λ 会得到 ${exact(c9R1)}；只在分子里用 λ = 1/ℓ 得到 ${exact(c9R2)}；忘了 σ² 得到 ${exact(c9R3)}；ℓ 不平方得到 ${exact(c9R4)}；分子用 1/ℓ 而分母用 ℓ² 得到 ${exact(c9R5)}。本游戏不考查傅里叶积分本身的计算，也不考查 σ² 与 ℓ 的拟合。`
      ),
      audit: { kind: 'GP-28:challenge', params: { s2: c9.s2, ell: c9.ell, om: c9.om } },
    }),
  ];
};
