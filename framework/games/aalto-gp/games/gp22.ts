import type { CardGenerator } from '../../types';
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

/** Reduced denominator of a rational with a small denominator (0 when none is found). */
function denominatorOf(x: number): number {
  for (let d = 1; d <= 720; d++) if (Math.abs(x * d - Math.round(x * d)) < 1e-9 * Math.max(1, Math.abs(x))) return d;
  return 0;
}
const DEN_OK = [1, 2, 4, 5, 8, 10];
/** Every wrong route must differ from the truth by at least `gap`. */
const apart = (truth: number, routes: number[], gap = 0.1) => routes.every(r => Math.abs(r - truth) >= gap - 1e-12);
/** One number style (fractions) inside explanations: an atom that can be multiplied or squared. */
const atom = (x: number) => (Number.isInteger(x) ? par(x) : `(${exact(x)})`);
const square = (x: number) => `${atom(x)}²`;
/** c/kuu with its reduced value appended only when that adds something (never "1/4 = 1/4"). */
const slope = (c: number, kuu: number, a: number) => { const raw = `${atom(c)}/${num(kuu)}`; return raw === exact(a) ? raw : `${raw} = ${exact(a)}`; };

export const gp22: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-22');
  warm(g);

  // Card 1: kl-term
  const c1 = (() => {
    const Ms = [10, 20, 50, 100];
    const rs = [4, 5, 10];
    const M = g.pick(Ms);
    const r = g.pick(rs);
    const N = r * M;
    return { N, M };
  })();

  // Card 2: cost-ratio
  const c2 = (() => {
    const Ms = [10, 20, 50, 100];
    const rs = [4, 5, 10];
    const M = g.pick(Ms);
    const r = g.pick(rs);
    const N = r * M;
    const T = r * r;
    return { N, M, r, T };
  })();

  // Card 3: q-var
  const c3 = (() => {
    const sets: [number, number, number, number][] = [
      [1, 0.5, 1, 0.5], [1, 0.5, 1, 2], [1, 0.5, 1, 4],
      [1, 0.5, 2, 2], [1, 0.5, 2, 4],
      [1, 1, 2, 0.5], [1, 1, 2, 1], [1, 1, 2, 4], [1, 1, 4, 2],
      [1, 1.5, 4, 4],
      [2, 0.5, 1, 0.5], [2, 0.5, 1, 1], [2, 0.5, 1, 2], [2, 0.5, 1, 4], [2, 0.5, 2, 4],
      [2, 1, 2, 0.5], [2, 1, 2, 1], [2, 1, 2, 4],
      [2, 1.5, 2, 4],
      [2, 1, 4, 2], [2, 1, 4, 4],
      [2, 1.5, 4, 4]
    ];
    const idx = g.random(0, sets.length - 1);
    const [kii, c, kuu, S] = sets[idx];
    const m = g.pick([1, 2, 3]);
    const a = c / kuu;
    const kt = kii - (c * c) / kuu;
    const extra = a * a * S;
    const T = kt + extra;
    return { kii, c, kuu, m, S, a, kt, extra, T };
  })();

  // Card 4: trace-term
  const c4 = (() => {
    const kvs = [1, 2, 4];
    const kuus = [2, 4];
    const s2s = [1, 2, 4];
    const cVals = [0, 0.5, 1, 1.5, 2];
    const p = retry(() => {
      const kv = g.pick(kvs);
      const kuu = g.pick(kuus);
      const s2 = g.pick(s2s);
      const c1v = g.pick(cVals);
      const c2v = g.pick(cVals);
      const c3v = g.pick(cVals);
      const cs = [c1v, c2v, c3v].sort((a, b) => a - b);
      return { kv, kuu, s2, cs };
    }, v => {
      const [c1, c2, c3] = v.cs;
      if (c1 === c2 && c2 === c3) return false;
      for (const c of v.cs) {
        if (c * c >= v.kv * v.kuu) return false;
      }
      const sumSq = c1 * c1 + c2 * c2 + c3 * c3, two = 2 * v.s2;
      const tr = 3 * v.kv - sumSq / v.kuu;
      const T = tr / two;
      if (!DEN_OK.includes(denominatorOf(T))) return false;
      return apart(T, [
        tr, tr / v.s2, 3 * v.kv / two, (sumSq / v.kuu) / two,
        (3 * v.kv - (c1 + c2 + c3) / v.kuu) / two, (3 * v.kv - sumSq) / two
      ]);
    });
    const { kv, kuu, s2, cs } = p;
    const [c1, c2, c3] = cs;
    const d1 = kv - (c1 * c1) / kuu;
    const d2 = kv - (c2 * c2) / kuu;
    const d3 = kv - (c3 * c3) / kuu;
    const tr = d1 + d2 + d3;
    const T = tr / (2 * s2);
    return { kv, kuu, s2, c1, c2, c3, d1, d2, d3, tr, T };
  })();

  // Card 5: whiten-mean
  const c5 = (() => {
    const p = retry(() => {
      const a = g.pick([1, 2]);
      const b = g.pick([-1, 1, 2]);
      const c = g.pick([1, 2]);
      const m1 = g.pick([-2, -1, 1, 2]);
      const m2 = g.pick([-2, -1, 0, 1, 2]);
      const p1 = g.pick([-1, 0, 1]);
      const p2 = g.pick([-2, -1, 1, 2]);
      return { a, b, c, m1, m2, p1, p2 };
    }, v => {
      const T = v.b * v.m1 + v.c * v.m2 + v.p2;
      const routes = [
        T - v.p2,
        v.c * v.m2 + v.p2,
        -v.b * v.m1 / (v.a * v.c) + v.m2 / v.c + v.p2,
        v.m2 + v.p2,
        v.a * v.m1 + v.p1
      ];
      return routes.every(r => Math.abs(r - T) >= 0.1);
    });
    const { a, b, c, m1, m2, p1, p2 } = p;
    const x = b * m1 + c * m2;
    const T = x + p2;
    return { a, b, c, m1, m2, p1, p2, x, T };
  })();

  // Card 6: whiten-cov
  const c6 = (() => {
    const p = retry(() => {
      const a = g.pick([1, 2]);
      const b = g.pick([-2, -1, 1, 2, 3]);
      const c = g.pick([2, 3]);
      const s1 = g.pick([0.25, 0.5, 2, 3, 4]);
      const s2 = g.pick([0.25, 0.5, 2, 3, 4]);
      return { a, b, c, s1, s2 };
    }, v => {
      const T = v.b * v.b * v.s1 + v.c * v.c * v.s2;
      const routes = [
        v.c * v.c * v.s2,
        v.b * v.s1 + v.c * v.s2,
        v.b * v.b * v.s1 + v.c * v.s2,
        v.s2,
        v.c * v.s2,
        v.b * v.b * v.s1,
        v.b * v.b * v.s2 + v.c * v.c * v.s1
      ];
      const g1 = (a: number, b: number): number => b === 0 ? a : g1(b, a % b);
      const n = Math.round(T * 1000);
      const d = 1000;
      const gcd = g1(Math.abs(n), Math.abs(d));
      const redDen = Math.abs(d) / gcd;
      return [1, 2, 4, 5, 8, 10].includes(redDen) && routes.every(r => Math.abs(r - T) >= 0.1);
    });
    const { a, b, c, s1, s2 } = p;
    const t1 = b * b * s1;
    const t2 = c * c * s2;
    const T = t1 + t2;
    return { a, b, c, s1, s2, t1, t2, T };
  })();

  // Card 7: jitter-check
  const c7 = (() => {
    const v = g.pick([1, 2, 3, 4, 5]);
    const eps = g.pick([0.01, 0.1, 0.5]);
    return { v, eps };
  })();

  // Card 8: minibatch
  const c8 = (() => {
    const p = retry(() => {
      const N = g.pick([10, 20, 40, 100]);
      const e1 = g.pick([0.5, 1, 1.5, 2, 3]);
      const e2 = g.pick([0.5, 1, 1.5, 2, 3]);
      const kl = g.pick([1, 2, 3, 4, 5]);
      const l1 = -Math.min(e1, e2);
      const l2 = -Math.max(e1, e2);
      return { N, l1, l2, kl };
    }, v => {
      const T = (v.N / 2) * (v.l1 + v.l2) - v.kl;
      const g1 = (a: number, b: number): number => b === 0 ? a : g1(b, a % b);
      const n = Math.round(T * 1000);
      const d = 1000;
      const gcd = g1(Math.abs(n), Math.abs(d));
      const redDen = Math.abs(d) / gcd;
      return [1, 2, 4, 5, 8, 10].includes(redDen);
    });
    const { N, l1, l2, kl } = p;
    const s = N / 2;
    const sc = s * (l1 + l2);
    const T = sc - kl;
    return { N, l1, l2, kl, s, sc, T };
  })();

  // Card 9: challenge
  const c9 = (() => {
    const p = retry(() => {
      const kuuL = g.pick([[4, 2], [9, 3], [16, 4]]);
      const kuu = kuuL[0];
      const L = kuuL[1];
      const kii = g.pick([1, 2, 4]);
      const c = g.pick([0.5, 1, 1.5, 2, 3]);
      const sp = g.pick([0.25, 0.5, 2, 3, 4]);
      const mp = g.pick([-1, 1, 2]);
      return { kuu, L, kii, c, sp, mp };
    }, v => {
      if (v.kii * v.kuu <= v.c * v.c) return false;
      const c2v = v.c * v.c, kt = v.kii - c2v / v.kuu;
      const T = kt + c2v * v.sp / v.kuu;
      if (!DEN_OK.includes(denominatorOf(T))) return false;
      return apart(T, [
        kt, kt + c2v * v.sp / (v.kuu * v.kuu), kt + c2v * v.sp * v.L / (v.kuu * v.kuu), kt + c2v * v.sp,
        v.kii + c2v * v.sp / v.kuu, c2v * v.sp / v.kuu, kt + v.c * v.sp / v.kuu
      ]);
    });
    const { kuu, L, kii, c, sp, mp } = p;
    const vu = kuu * sp;
    const a = c / kuu;
    const kt = kii - (c * c) / kuu;
    const extra = a * a * vu;
    const T = kt + extra;
    return { kuu, L, kii, c, sp, mp, vu, a, kt, extra, T };
  })();

  return [
    // Card 1: kl-term
    g.choice({
      id: 'kl-term',
      title: t('Which KL term?', '是哪一个 KL 项？'),
      prompt: t(
        `A sparse variational GP has N = ${num(c1.N)} training points and M = ${num(c1.M)} inducing values u. Its variational posterior is q(f, u) = p(f | u)q(u) with q(u) = N(μ, Σ) (Lecture 7 p. 50). The lower bound is ⟨log p(y | f)⟩ minus one KL term. Which KL term is it?`,
        `稀疏变分 GP 有 N = ${num(c1.N)} 个训练点和 M = ${num(c1.M)} 个诱导值 u。其变分后验为 q(f, u) = p(f | u)q(u)，其中 q(u) = N(μ, Σ)（第 7 讲第 50 页）。下界等于 ⟨log p(y | f)⟩ 减去一个 KL 项。这个 KL 项是哪一项？`
      ),
      options: [
        t(`KL[q(u) ‖ p(u)] over the ${num(c1.M)} inducing values, with p(f | u) cancelled`,
          `KL[q(u) ‖ p(u)]，作用于 ${num(c1.M)} 个诱导值，p(f | u) 已约去`),
        t(`KL[q(f) ‖ p(f)] over all ${num(c1.N)} latent function values, as in the variational bound of a full GP`,
          `KL[q(f) ‖ p(f)]，作用于全部 ${num(c1.N)} 个潜函数值，与完整 GP 的变分下界相同`),
        t(`KL[p(u) ‖ q(u)] over the ${num(c1.M)} inducing values`,
          `KL[p(u) ‖ q(u)]，作用于 ${num(c1.M)} 个诱导值`),
        t(`KL[q(u) ‖ p(u | y)] over the ${num(c1.M)} inducing values`,
          `KL[q(u) ‖ p(u | y)]，作用于 ${num(c1.M)} 个诱导值`)
      ],
      correct: 0,
      hint: t(
        'q(f, u) reuses the prior conditional p(f | u). What happens to a factor that appears both in q and in the prior?',
        'q(f, u) 沿用了先验条件分布 p(f | u)。同时出现在 q 和先验中的因子会怎样？'
      ),
      explanation: t(
        `Because q(f, u) = p(f | u)q(u) reuses the prior conditional, p(f | u) cancels inside the logarithm and only KL[q(u) ‖ p(u)] is left (Lecture 7 p. 50). It compares two Gaussians over ${num(c1.M)} values, not ${num(c1.N)}, and does not touch the data (p. 67). KL[q(f) ‖ p(f)] over all ${num(c1.N)} latent values is the bound of a full GP and would need ${num(c1.N)} × ${num(c1.N)} matrices. KL[p(u) ‖ q(u)] has the wrong direction: the bound uses KL[q ‖ p] (p. 43). KL[q(u) ‖ p(u | y)] is the gap between the bound and log p(y), not a term of the bound. This game does not assess how q(u) or the inducing inputs are optimised.`,
        `由于 q(f, u) = p(f | u)q(u) 沿用先验条件分布，p(f | u) 在对数内部约去，只剩下 KL[q(u) ‖ p(u)]（第 7 讲第 50 页）。它比较的是 ${num(c1.M)} 个值上的两个高斯分布，而不是 ${num(c1.N)} 个，并且与数据无关（第 67 页）。作用于全部 ${num(c1.N)} 个潜函数值的 KL[q(f) ‖ p(f)] 是完整 GP 的下界，需要 ${num(c1.N)} × ${num(c1.N)} 的矩阵。KL[p(u) ‖ q(u)] 方向错误：下界使用的是 KL[q ‖ p]（第 43 页）。KL[q(u) ‖ p(u | y)] 是下界与 log p(y) 之间的差距，不是下界中的一项。本游戏不考查 q(u) 或诱导点位置如何被优化。`
      )
    }),

    // Card 2: cost-ratio
    g.number({
      id: 'cost-ratio',
      title: t('Exact against sparse cost', '精确计算与稀疏计算的代价'),
      prompt: t(
        `Treat the cost of exact GP regression on N points as N³ units and the cost of evaluating the sparse variational bound with M inducing points as N·M² units (Lecture 7 pp. 53–54). Here N = ${num(c2.N)} and M = ${num(c2.M)}. How many times more units does the exact computation need than the sparse bound? Give an integer.`,
        `把 N 个点上的精确 GP 回归的代价当作 N³ 个单位，把使用 M 个诱导点计算稀疏变分下界的代价当作 N·M² 个单位（第 7 讲第 53–54 页）。这里 N = ${num(c2.N)}，M = ${num(c2.M)}。精确计算所需的单位数是稀疏下界的多少倍？请填整数。`
      ),
      fields: [{ label: t('Cost ratio', '代价之比'), answer: c2.T, tolerance: TOL }],
      hint: t(
        'Write both costs with the numbers inserted, then divide. Which factor occurs in both?',
        '把两个代价都代入数字，再相除。哪个因子在两者中都出现？'
      ),
      explanation: t(
        `Exact: ${num(c2.N)}³ units. Sparse: ${num(c2.N)}·${num(c2.M)}² units. The factor ${num(c2.N)} appears in both, so the ratio is ${num(c2.N)}²/${num(c2.M)}² = (${num(c2.N)}/${num(c2.M)})² = ${num(c2.r)}² = ${num(c2.T)}. The saving grows with the square of N/M, not with N/M itself (${num(c2.r)}) and not with its cube (${num(c2.r * c2.r * c2.r)}); and M enters the sparse cost squared, so doubling M quadruples the cost, which is the speed against accuracy trade-off of Lecture 7 p. 56. This game does not assess exact operation counts (GP-11).`,
        `精确计算：${num(c2.N)}³ 个单位。稀疏计算：${num(c2.N)}·${num(c2.M)}² 个单位。因子 ${num(c2.N)} 在两者中都出现，所以比值为 ${num(c2.N)}²/${num(c2.M)}² = (${num(c2.N)}/${num(c2.M)})² = ${num(c2.r)}² = ${num(c2.T)}。节省的倍数随 N/M 的平方增长，不是 N/M 本身（${num(c2.r)}），也不是它的立方（${num(c2.r * c2.r * c2.r)}）；而且 M 在稀疏代价中是平方，诱导点数翻倍则代价变为四倍，这就是第 7 讲第 56 页所说的速度与精度的权衡。本游戏不考查精确的运算次数（GP-11）。`
      ),
      audit: { kind: 'GP-22:cost-ratio', params: { N: c2.N, M: c2.M } }
    }),

    // Card 3: q-var
    g.number({
      id: 'q-var',
      title: t('Variance of q(fᵢ)', 'q(fᵢ) 的方差'),
      prompt: t(
        `A sparse GP has one inducing value u = f(z) and one training value fᵢ = f(xᵢ). The prior has k(xᵢ, xᵢ) = ${num(c3.kii)}, k(xᵢ, z) = ${num(c3.c)} and k(z, z) = ${num(c3.kuu)}. The variational posterior is q(u) = N(m, S) with m = ${num(c3.m)} and S = ${num(c3.S)}, and q(fᵢ) = ∫ p(fᵢ | u) q(u) du, where p(fᵢ | u) is the prior conditional (Lecture 7 pp. 49, 52). What is the variance of fᵢ under q? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `稀疏 GP 有一个诱导值 u = f(z) 和一个训练值 fᵢ = f(xᵢ)。先验给出 k(xᵢ, xᵢ) = ${num(c3.kii)}，k(xᵢ, z) = ${num(c3.c)}，k(z, z) = ${num(c3.kuu)}。变分后验为 q(u) = N(m, S)，其中 m = ${num(c3.m)}，S = ${num(c3.S)}，并且 q(fᵢ) = ∫ p(fᵢ | u) q(u) du，其中 p(fᵢ | u) 是先验条件分布（第 7 讲第 49、52 页）。在 q 下 fᵢ 的方差是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Variance of fᵢ under q', 'q 下 fᵢ 的方差'), answer: c3.T, tolerance: TOL }],
      hint: t(
        'fᵢ is a straight-line function of u plus leftover randomness. Where does each of the two parts get its variance from?',
        'fᵢ 是 u 的线性函数再加上剩余的随机性。这两部分的方差各从哪里来？'
      ),
      explanation: t(
        `The prior conditional p(fᵢ | u) has slope ${slope(c3.c, c3.kuu, c3.a)} and leftover variance ${num(c3.kii)} − ${square(c3.c)}/${num(c3.kuu)} = ${exact(c3.kt)} (Lecture 7 p. 49). Under q(u) = N(${num(c3.m)}, ${exact(c3.S)}) the variance of u is ${exact(c3.S)}, and passing it through the slope adds ${square(c3.a)}·${atom(c3.S)} = ${exact(c3.extra)}. So the variance of fᵢ under q is ${exact(c3.kt)} + ${exact(c3.extra)} = ${exact(c3.T)} (p. 52). The value ${exact(c3.kt)} alone would treat q(u) as certain; the value ${exact(c3.extra)} alone would forget the part of fᵢ that u does not explain. The mean ${num(c3.m)} of q(u) only moves the mean of fᵢ and does not enter the variance. This game does not assess how q(u) is optimised.`,
        `先验条件分布 p(fᵢ | u) 的斜率为 ${slope(c3.c, c3.kuu, c3.a)}，剩余方差为 ${num(c3.kii)} − ${square(c3.c)}/${num(c3.kuu)} = ${exact(c3.kt)}（第 7 讲第 49 页）。在 q(u) = N(${num(c3.m)}, ${exact(c3.S)}) 下，u 的方差是 ${exact(c3.S)}，经斜率传递后增加 ${square(c3.a)}·${atom(c3.S)} = ${exact(c3.extra)}。所以在 q 下 fᵢ 的方差为 ${exact(c3.kt)} + ${exact(c3.extra)} = ${exact(c3.T)}（第 52 页）。单独的 ${exact(c3.kt)} 把 q(u) 当成确定值；单独的 ${exact(c3.extra)} 则忘了 u 解释不了的那部分 fᵢ。q(u) 的均值 ${num(c3.m)} 只改变 fᵢ 的均值，不进入方差。本游戏不考查 q(u) 如何被优化。`
      ),
      audit: { kind: 'GP-22:q-var', params: { kii: c3.kii, c: c3.c, kuu: c3.kuu, m: c3.m, S: c3.S } }
    }),

    // Card 4: trace-term
    g.number({
      id: 'trace-term',
      title: t('The trace penalty', '迹惩罚项'),
      prompt: t(
        `The collapsed bound of a sparse variational GP is L = log N(y | 0, Q + σ²I) − (1/(2σ²))·tr(K − Q) (Lecture 7 p. 54). Here K is the 3 × 3 prior covariance of f(x₁), f(x₂), f(x₃) and Q = K(f, u)K(u, u)⁻¹K(u, f) is built from one inducing value u = f(z), so Qᵢⱼ = k(xᵢ, z)·k(xⱼ, z)/k(z, z). Let σ² = ${num(c4.s2)}, k(z, z) = ${num(c4.kuu)}, k(xᵢ, xᵢ) = ${num(c4.kv)} for all three inputs, and (k(x₁, z), k(x₂, z), k(x₃, z)) = (${num(c4.c1)}, ${num(c4.c2)}, ${num(c4.c3)}). What is the penalty (1/(2σ²))·tr(K − Q)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `稀疏变分 GP 的折叠下界为 L = log N(y | 0, Q + σ²I) − (1/(2σ²))·tr(K − Q)（第 7 讲第 54 页）。这里 K 是 f(x₁)、f(x₂)、f(x₃) 的 3 × 3 先验协方差，Q = K(f, u)K(u, u)⁻¹K(u, f) 由一个诱导值 u = f(z) 构成，因此 Qᵢⱼ = k(xᵢ, z)·k(xⱼ, z)/k(z, z)。设 σ² = ${num(c4.s2)}，k(z, z) = ${num(c4.kuu)}，三个输入都有 k(xᵢ, xᵢ) = ${num(c4.kv)}，且 (k(x₁, z)、k(x₂, z)、k(x₃, z)) = (${num(c4.c1)}、${num(c4.c2)}、${num(c4.c3)})。惩罚项 (1/(2σ²))·tr(K − Q) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Trace penalty', '迹惩罚项'), answer: c4.T, tolerance: TOL }],
      hint: t(
        'Only the diagonal of K − Q enters a trace. Work out the diagonal entries one input at a time.',
        '迹只用到 K − Q 的对角线。逐个输入算出对角线元素。'
      ),
      explanation: t(
        `The trace adds the diagonal entries of K − Q, and Qᵢᵢ = k(xᵢ, z)²/k(z, z). For the three inputs: ${num(c4.kv)} − ${square(c4.c1)}/${num(c4.kuu)} = ${exact(c4.d1)}, ${num(c4.kv)} − ${square(c4.c2)}/${num(c4.kuu)} = ${exact(c4.d2)}, ${num(c4.kv)} − ${square(c4.c3)}/${num(c4.kuu)} = ${exact(c4.d3)}. Their sum is tr(K − Q) = ${exact(c4.tr)}, and dividing by 2σ² = ${num(2 * c4.s2)} gives ${exact(c4.T)}. Without that factor the value would be ${exact(c4.tr)}; using tr K alone would give ${exact(3 * c4.kv / (2 * c4.s2))}, which ignores what the inducing value already explains. The penalty is zero only when the inducing values explain each f(xᵢ) completely, and it is the reason L is not a valid log-pdf (Lecture 7 p. 55). This game does not assess the log N(y | 0, Q + σ²I) term.`,
        `迹是 K − Q 对角线元素之和，而 Qᵢᵢ = k(xᵢ, z)²/k(z, z)。三个输入分别为：${num(c4.kv)} − ${square(c4.c1)}/${num(c4.kuu)} = ${exact(c4.d1)}，${num(c4.kv)} − ${square(c4.c2)}/${num(c4.kuu)} = ${exact(c4.d2)}，${num(c4.kv)} − ${square(c4.c3)}/${num(c4.kuu)} = ${exact(c4.d3)}。它们的和为 tr(K − Q) = ${exact(c4.tr)}，再除以 2σ² = ${num(2 * c4.s2)} 得 ${exact(c4.T)}。若漏掉这个因子，结果是 ${exact(c4.tr)}；只用 tr K 会得到 ${exact(3 * c4.kv / (2 * c4.s2))}，这忽略了诱导值已经解释的部分。只有当诱导值完全解释每个 f(xᵢ) 时惩罚项才为零，它也是 L 不是合法对数概率密度的原因（第 7 讲第 55 页）。本游戏不考查 log N(y | 0, Q + σ²I) 这一项。`
      ),
      audit: { kind: 'GP-22:trace-term', params: { kv: c4.kv, kuu: c4.kuu, c1: c4.c1, c2: c4.c2, c3: c4.c3, s2: c4.s2 } }
    }),

    // Card 5: whiten-mean
    g.number({
      id: 'whiten-mean',
      title: t('Un-whitening the mean', '还原白化后的均值'),
      prompt: t(
        `Whitening writes the inducing values as u = Lv + p, where K = LLᵀ is the Cholesky factor of the prior covariance, p is the prior mean and v has the prior N(0, I) (Lecture 7 p. 75; Assignment 4 Task 1). Here L = ${mat([[num(c5.a), '0'], [num(c5.b), num(c5.c)]])} (rows), p = (${num(c5.p1)}, ${num(c5.p2)}) as a column, and the optimiser holds q(v) = N(m′, S′) with m′ = (${num(c5.m1)}, ${num(c5.m2)}) as a column. What is the second entry of the mean of q(u)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `白化把诱导值写成 u = Lv + p，其中 K = LLᵀ 是先验协方差的乔列斯基因子，p 是先验均值，v 的先验为 N(0, I)（第 7 讲第 75 页；作业 4 任务 1）。这里 L = ${mat([[num(c5.a), '0'], [num(c5.b), num(c5.c)]])}（按行），p = (${num(c5.p1)}、${num(c5.p2)})（列向量），优化器保存的是 q(v) = N(m′, S′)，其中 m′ = (${num(c5.m1)}、${num(c5.m2)})（列向量）。q(u) 均值的第二个分量是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Second entry of the mean of q(u)', 'q(u) 均值的第二个分量'), answer: c5.T, tolerance: TOL }],
      hint: t(
        'u is a linear function of v. Multiply L with m′ row by row, then see what p does.',
        'u 是 v 的线性函数。把 L 与 m′ 按行相乘，再看 p 起什么作用。'
      ),
      explanation: t(
        `Since u = Lv + p, the mean of q(u) is L·m′ + p (Lecture 7 p. 75; Assignment 4). The second row of L is (${num(c5.b)}, ${num(c5.c)}), so the second entry of L·m′ is ${num(c5.b)}·${par(c5.m1)} + ${num(c5.c)}·${par(c5.m2)} = ${num(c5.x)}. Adding the prior mean p₂ = ${num(c5.p2)} gives ${num(c5.T)}. Without the prior mean the value would be ${num(c5.x)}; using Lᵀ, whose second row is (0, ${num(c5.c)}), would give ${num(c5.c * c5.m2 + c5.p2)}. This game does not assess how m′ is optimised.`,
        `因为 u = Lv + p，q(u) 的均值为 L·m′ + p（第 7 讲第 75 页；作业 4）。L 的第二行为 (${num(c5.b)}、${num(c5.c)})，所以 L·m′ 的第二个分量是 ${num(c5.b)}·${par(c5.m1)} + ${num(c5.c)}·${par(c5.m2)} = ${num(c5.x)}。再加上先验均值 p₂ = ${num(c5.p2)}，得 ${num(c5.T)}。若不加先验均值，值为 ${num(c5.x)}；若误用 Lᵀ（第二行为 (0、${num(c5.c)})），则得 ${num(c5.c * c5.m2 + c5.p2)}。本游戏不考查 m′ 如何被优化。`
      ),
      audit: { kind: 'GP-22:whiten-mean', params: { a: c5.a, b: c5.b, c: c5.c, m1: c5.m1, m2: c5.m2, p1: c5.p1, p2: c5.p2 } }
    }),

    // Card 6: whiten-cov
    g.number({
      id: 'whiten-cov',
      title: t('Un-whitening the covariance', '还原白化后的协方差'),
      prompt: t(
        `With whitening, u = Lv where K = LLᵀ is the Cholesky factor of the prior covariance, L = ${mat([[num(c6.a), '0'], [num(c6.b), num(c6.c)]])} (rows). The optimiser holds q(v) = N(m′, S′) with S′ = ${mat([[num(c6.s1), '0'], ['0', num(c6.s2)]])} (diagonal). The covariance of q(u) is the matrix you get by transforming S′ back to u (Lecture 7 p. 75). What is its entry in row 2, column 2? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `白化时 u = Lv，其中 K = LLᵀ 是先验协方差的乔列斯基因子，L = ${mat([[num(c6.a), '0'], [num(c6.b), num(c6.c)]])}（按行）。优化器保存的是 q(v) = N(m′, S′)，其中 S′ = ${mat([[num(c6.s1), '0'], ['0', num(c6.s2)]])}（对角矩阵）。把 S′ 变换回 u 空间即得到 q(u) 的协方差（第 7 讲第 75 页）。它的第 2 行第 2 列元素是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Entry (2, 2) of the covariance of q(u)', 'q(u) 协方差的 (2, 2) 元素'), answer: c6.T, tolerance: TOL }],
      hint: t(
        'Only the second row of L reaches this entry. Write out the product of L, S′ and the transpose of L for that one entry.',
        '只有 L 的第二行会影响这个元素。把 L、S′ 与 L 的转置相乘，只写出这一个元素。'
      ),
      explanation: t(
        `The covariance of q(u) is L S′ Lᵀ (Lecture 7 p. 75). Its (2, 2) entry uses the second row of L, (${num(c6.b)}, ${num(c6.c)}): ${square(c6.b)}·${atom(c6.s1)} + ${square(c6.c)}·${atom(c6.s2)} = ${exact(c6.t1)} + ${exact(c6.t2)} = ${exact(c6.T)}. The term ${exact(c6.t1)} is the part that u₂ inherits from v₁ through the entry ${num(c6.b)}. Dropping it gives ${exact(c6.t2)}, which is (LᵀS′L)₂₂, the transform in the wrong order. With S′ = I the same entry would be ${square(c6.b)} + ${square(c6.c)} = ${num(c6.b * c6.b + c6.c * c6.c)}, the prior variance of u₂, which is why q(v) = N(0, I) means q(u) equals the prior. This game does not assess how S′ is optimised.`,
        `q(u) 的协方差为 L S′ Lᵀ（第 7 讲第 75 页）。它的 (2, 2) 元素用到 L 的第二行 (${num(c6.b)}、${num(c6.c)})：${square(c6.b)}·${atom(c6.s1)} + ${square(c6.c)}·${atom(c6.s2)} = ${exact(c6.t1)} + ${exact(c6.t2)} = ${exact(c6.T)}。项 ${exact(c6.t1)} 是 u₂ 通过元素 ${num(c6.b)} 从 v₁ 继承来的部分。漏掉它得到 ${exact(c6.t2)}，那是 (LᵀS′L)₂₂，即变换顺序错了。若 S′ = I，同一元素为 ${square(c6.b)} + ${square(c6.c)} = ${num(c6.b * c6.b + c6.c * c6.c)}，也就是 u₂ 的先验方差，这说明 q(v) = N(0, I) 时 q(u) 就等于先验。本游戏不考查 S′ 如何被优化。`
      ),
      audit: { kind: 'GP-22:whiten-cov', params: { a: c6.a, b: c6.b, c: c6.c, s1: c6.s1, s2: c6.s2 } }
    }),

    // Card 7: jitter-check
    g.choice({
      id: 'jitter-check',
      title: t('Two identical inducing inputs', '两个相同的诱导点'),
      prompt: t(
        `Two inducing inputs coincide, z₁ = z₂, so the prior covariance of the inducing values is Kᵤᵤ = ${mat([[num(c7.v), num(c7.v)], [num(c7.v), num(c7.v)]])} (every entry equals ${num(c7.v)}). Whitening needs its Cholesky factor L (Lecture 7 p. 75), so Lecture 7 p. 74 adds jitter: Kᵤᵤ is replaced by Kᵤᵤ + εI with ε = ${num(c7.eps)}. Which statement is correct?`,
        `两个诱导输入重合，z₁ = z₂，因此诱导值的先验协方差为 Kᵤᵤ = ${mat([[num(c7.v), num(c7.v)], [num(c7.v), num(c7.v)]])}（每个元素都等于 ${num(c7.v)}）。白化需要它的乔列斯基因子 L（第 7 讲第 75 页），所以第 7 讲第 74 页加入抖动项：把 Kᵤᵤ 换成 Kᵤᵤ + εI，其中 ε = ${num(c7.eps)}。下列哪个说法正确？`
      ),
      options: [
        t(`Eigenvalues ${num(2 * c7.v)} and 0, so Cholesky fails; with εI they become ${num(2 * c7.v + c7.eps)} and ${num(c7.eps)}`,
          `特征值为 ${num(2 * c7.v)} 和 0，乔列斯基分解失败；加上 εI 后为 ${num(2 * c7.v + c7.eps)} 和 ${num(c7.eps)}`),
        t(`Eigenvalues ${num(2 * c7.v)} and 0, but Cholesky still works for a symmetric matrix, so no jitter is needed`,
          `特征值为 ${num(2 * c7.v)} 和 0，但因为矩阵是对称的，所以乔列斯基分解仍可顺利进行，完全不需要抖动项`),
        t(`Eigenvalues ${num(2 * c7.v)} and 0, and jitter cannot change a zero eigenvalue`,
          `特征值为 ${num(2 * c7.v)} 和 0，抖动项改变不了为零的特征值`),
        t(`Eigenvalues ${num(c7.v)} and ${num(c7.v)}, because every entry equals ${num(c7.v)}, so Cholesky works and no jitter is needed`,
          `特征值为 ${num(c7.v)} 和 ${num(c7.v)}，因为每个元素都等于 ${num(c7.v)}，所以乔列斯基分解可行，完全不需要抖动项`)
      ],
      correct: 0,
      hint: t(
        'Try the vectors (1, 1) and (1, −1) on Kᵤᵤ to find its eigenvalues. A Cholesky factorisation needs every pivot to be positive.',
        '用向量 (1, 1) 和 (1, −1) 作用在 Kᵤᵤ 上求特征值。乔列斯基分解要求每个主元都是正数。'
      ),
      explanation: t(
        `Kᵤᵤ = ${mat([[num(c7.v), num(c7.v)], [num(c7.v), num(c7.v)]])} has eigenvalues ${num(2 * c7.v)} (for (1, 1)) and 0 (for (1, −1)): equal entries do not give equal eigenvalues. The Cholesky algorithm needs every pivot to be positive, but the second pivot is ${num(c7.v)} − ${num(c7.v)}·${num(c7.v)}/${num(c7.v)} = 0, so it fails; symmetry alone is not enough. Adding εI raises both eigenvalues by ${num(c7.eps)}, including the zero one, so the matrix has eigenvalues ${num(2 * c7.v + c7.eps)} and ${num(c7.eps)} and can be factorised. The jitter corresponds to observing the inducing values with a very small noise (Lecture 7 p. 74), so it changes the model slightly. This game does not assess how jitter size or inducing inputs are chosen.`,
        `Kᵤᵤ = ${mat([[num(c7.v), num(c7.v)], [num(c7.v), num(c7.v)]])} 的特征值为 ${num(2 * c7.v)}（对应 (1, 1)）和 0（对应 (1, −1)）：元素相等并不意味着特征值相等。乔列斯基算法要求每个主元为正，而第二个主元是 ${num(c7.v)} − ${num(c7.v)}·${num(c7.v)}/${num(c7.v)} = 0，所以会失败；仅有对称性不够。加上 εI 会使两个特征值都增加 ${num(c7.eps)}，为零的那个也不例外，于是矩阵的特征值为 ${num(2 * c7.v + c7.eps)} 和 ${num(c7.eps)}，可以分解。抖动项相当于带着极小的噪声去观测诱导值（第 7 讲第 74 页），因此会稍微改变模型。本游戏不考查抖动大小或诱导点位置如何选取。`
      )
    }),

    // Card 8: minibatch
    g.number({
      id: 'minibatch',
      title: t('A mini-batch estimate of the bound', '下界的小批量估计'),
      prompt: t(
        `The uncollapsed sparse bound is L = Σₙ₌₁ᴺ ⟨log p(yₙ | fₙ)⟩ − KL[q(u) ‖ p(u)] with N = ${num(c8.N)} training points (Lecture 7 p. 69). A random mini-batch of B = 2 points has ⟨log p(yₙ | fₙ)⟩ equal to ${num(c8.l1)} and ${num(c8.l2)}, and KL[q(u) ‖ p(u)] = ${num(c8.kl)}. What mini-batch estimate of L is correct on average over random batches? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `未折叠的稀疏下界为 L = Σₙ₌₁ᴺ ⟨log p(yₙ | fₙ)⟩ − KL[q(u) ‖ p(u)]，共有 N = ${num(c8.N)} 个训练点（第 7 讲第 69 页）。一个含 B = 2 个点的随机小批量中，⟨log p(yₙ | fₙ)⟩ 分别为 ${num(c8.l1)} 和 ${num(c8.l2)}，且 KL[q(u) ‖ p(u)] = ${num(c8.kl)}。对随机小批量取平均时，哪个 L 的估计值是正确的？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Mini-batch estimate of L', 'L 的小批量估计'), answer: c8.T, tolerance: TOL }],
      hint: t(
        'The bound has N data terms but the batch supplies only 2. How must the batch sum be adjusted, and does the KL term depend on the data?',
        '下界有 N 个数据项，而小批量只提供 2 个。批量之和应如何调整？KL 项依赖数据吗？'
      ),
      explanation: t(
        `The full bound sums N = ${num(c8.N)} data terms, the batch has B = 2, so the batch sum is scaled by N/B = ${num(c8.N)} ÷ 2 = ${num(c8.s)} (Lecture 7 p. 69): ${num(c8.s)}·(${par(c8.l1)} + ${par(c8.l2)}) = ${num(c8.sc)}. The KL term does not depend on the data (p. 67), so it is subtracted once without scaling: ${num(c8.sc)} − ${num(c8.kl)} = ${num(c8.T)}. Scaling the KL as well would give ${num(c8.s * (c8.l1 + c8.l2 - c8.kl))}; no scaling at all would give ${num(c8.l1 + c8.l2 - c8.kl)}. Averaged over all batches the estimate equals L, which is what allows stochastic gradient descent. This game does not assess the choice of batch size or learning rate.`,
        `完整下界对 N = ${num(c8.N)} 个数据项求和，而小批量只有 B = 2 个，所以批量之和要乘以 N/B = ${num(c8.N)} ÷ 2 = ${num(c8.s)}（第 7 讲第 69 页）：${num(c8.s)}·(${par(c8.l1)} + ${par(c8.l2)}) = ${num(c8.sc)}。KL 项与数据无关（第 67 页），只减一次，不做缩放：${num(c8.sc)} − ${num(c8.kl)} = ${num(c8.T)}。若把 KL 也缩放，会得到 ${num(c8.s * (c8.l1 + c8.l2 - c8.kl))}；完全不缩放则得到 ${num(c8.l1 + c8.l2 - c8.kl)}。对所有批量取平均，该估计等于 L，这正是可以使用随机梯度下降的原因。本游戏不考查批量大小或学习率的选择。`
      ),
      audit: { kind: 'GP-22:minibatch', params: { N: c8.N, l1: c8.l1, l2: c8.l2, kl: c8.kl } }
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Challenge: a whitened posterior at one input', '挑战：一个输入处的白化后验'),
      prompt: t(
        `One inducing value u = f(z) has prior variance k(z, z) = ${num(c9.kuu)}, with Cholesky factor L = ${num(c9.L)}. The optimiser holds the whitened posterior u = Lv with q(v) = N(m′, s′), where m′ = ${num(c9.mp)} and s′ = ${num(c9.sp)}. For one training input, k(xᵢ, xᵢ) = ${num(c9.kii)} and k(xᵢ, z) = ${num(c9.c)}. What is the variance of fᵢ under q(fᵢ) = ∫ p(fᵢ | u) q(u) du? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个诱导值 u = f(z) 的先验方差为 k(z, z) = ${num(c9.kuu)}，乔列斯基因子为 L = ${num(c9.L)}。优化器保存的是白化后验：u = Lv，其中 q(v) = N(m′, s′)，m′ = ${num(c9.mp)}，s′ = ${num(c9.sp)}。对于一个训练输入，k(xᵢ, xᵢ) = ${num(c9.kii)}，k(xᵢ, z) = ${num(c9.c)}。在 q(fᵢ) = ∫ p(fᵢ | u) q(u) du 下，fᵢ 的方差是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Variance of fᵢ under q', 'q 下 fᵢ 的方差'), answer: c9.T, tolerance: TOL }],
      hint: t(
        'First turn q(v) into a distribution over u, then pass it through the conditional of fᵢ given u.',
        '先把 q(v) 变成 u 上的分布，再经 fᵢ 对 u 的条件分布传递。'
      ),
      explanation: t(
        `Un-whiten first: u = Lv gives the variance L²·s′ = ${num(c9.L)}²·${atom(c9.sp)} = ${exact(c9.vu)} for u (the mean ${num(c9.mp)} of v only moves the mean). The prior conditional p(fᵢ | u) has slope ${slope(c9.c, c9.kuu, c9.a)} and leftover variance ${num(c9.kii)} − ${square(c9.c)}/${num(c9.kuu)} = ${exact(c9.kt)}. So the variance of fᵢ under q is ${exact(c9.kt)} + ${square(c9.a)}·${atom(c9.vu)} = ${exact(c9.kt)} + ${exact(c9.extra)} = ${exact(c9.T)}. Taking s′ = ${exact(c9.sp)} as the variance of u would give ${exact(c9.kii - (c9.c * c9.c) / c9.kuu + (c9.c * c9.c) * c9.sp / (c9.kuu * c9.kuu))}, which forgets that L stretches v. This game does not assess how m′ and s′ are optimised.`,
        `先还原白化：u = Lv 使 u 的方差为 L²·s′ = ${num(c9.L)}²·${atom(c9.sp)} = ${exact(c9.vu)}（v 的均值 ${num(c9.mp)} 只改变均值）。先验条件分布 p(fᵢ | u) 的斜率为 ${slope(c9.c, c9.kuu, c9.a)}，剩余方差为 ${num(c9.kii)} − ${square(c9.c)}/${num(c9.kuu)} = ${exact(c9.kt)}。所以在 q 下 fᵢ 的方差为 ${exact(c9.kt)} + ${square(c9.a)}·${atom(c9.vu)} = ${exact(c9.kt)} + ${exact(c9.extra)} = ${exact(c9.T)}。若把 s′ = ${exact(c9.sp)} 当作 u 的方差，会得到 ${exact(c9.kii - (c9.c * c9.c) / c9.kuu + (c9.c * c9.c) * c9.sp / (c9.kuu * c9.kuu))}，这忘了 L 会拉伸 v。本游戏不考查 m′ 与 s′ 如何被优化。`
      ),
      audit: { kind: 'GP-22:challenge', params: { kuu: c9.kuu, L: c9.L, kii: c9.kii, c: c9.c, mp: c9.mp, sp: c9.sp } }
    })
  ];
};
