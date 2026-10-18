import type { CardGenerator } from '../../types';
import { fitView, graphOf, type FigureShape } from '../../figure';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
const nd = (x: number): number[] => { for (let d = 1; d <= 64; d++) { const n = Math.round(x * d); if (Math.abs(x * d - n) < 1e-9) return [n, d]; } return [x]; };
const ov = (a: number, b: number) => (b === 1 ? num(a) : `${num(a)}/${num(b)}`);
const sq = (a: number, b: number) => (b === 1 ? `${num(a)}²` : `${num(a)}²/${num(b)}`);
/** "a = b" chain that drops a step identical to its neighbour, so no explanation says "x = x". */
const chain = (...parts: string[]) => parts.filter((p, i) => i === 0 || p !== parts[i - 1]).join(' = ');
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const PHI_TABLE: Record<string, number> = {
  '0.5': 0.6915, '1': 0.8413, '1.5': 0.9332, '2': 0.9772, '2.5': 0.9938, '3': 0.9987,
};

export const gp19: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-19');
  warm(g);

  // Card 1: rank-q
  const c1 = retry(() => {
    const ve = shuffled(g, [g.random(-9, -3), g.random(-9, -3), g.random(-9, -3)]);
    const kl = shuffled(g, [g.random(1, 6), g.random(1, 6), g.random(1, 6)]);
    return { ve, kl };
  }, v => {
    const [ve1, ve2, ve3] = v.ve;
    const [kl1, kl2, kl3] = v.kl;
    if (new Set([ve1, ve2, ve3]).size !== 3) return false;
    if (new Set([kl1, kl2, kl3]).size !== 3) return false;
    const e = [ve1 - kl1, ve2 - kl2, ve3 - kl3];
    const sorted = [...e].sort((a, b) => b - a);
    if (sorted[0] - sorted[1] < 1) return false;
    const tIdx = e.indexOf(Math.max(...e));
    const iv = [ve1, ve2, ve3].indexOf(Math.max(ve1, ve2, ve3));
    const ik = [kl1, kl2, kl3].indexOf(Math.min(kl1, kl2, kl3));
    const is = [ve1 + kl1, ve2 + kl2, ve3 + kl3].indexOf(Math.max(ve1 + kl1, ve2 + kl2, ve3 + kl3));
    return tIdx !== iv && tIdx !== ik && tIdx !== is;
  });
  const { ve: [ve1, ve2, ve3], kl: [kl1, kl2, kl3] } = c1;
  const e1 = ve1 - kl1, e2 = ve2 - kl2, e3 = ve3 - kl3;
  const eArr = [e1, e2, e3];
  const tIdx = eArr.indexOf(Math.max(...eArr));
  const iv = [ve1, ve2, ve3].indexOf(Math.max(ve1, ve2, ve3));
  const ik = [kl1, kl2, kl3].indexOf(Math.min(kl1, kl2, kl3));
  const qNames = ['q₁', 'q₂', 'q₃'];
  const optTexts = [
    t(qNames[0], qNames[0]),
    t(qNames[1], qNames[1]),
    t(qNames[2], qNames[2]),
    t('Cannot be decided without knowing log p(y)', '不知道 log p(y) 就无法判断'),
  ];
  const shuffledOpts = shuffled(g, optTexts);
  const correctIdx = shuffledOpts.findIndex(o => o[0] === qNames[tIdx]);

  // Card 2: elbo-gap
  const c2 = retry(() => ({
    ve: g.random(-9, -3),
    kl: g.pick([0.5, 1, 1.5, 2, 2.5, 3]),
    gp: g.pick([0.5, 1, 1.5, 2]),
  }), v => {
    const T = v.gp;
    const lp = v.ve - v.kl + v.gp;
    const routes = [lp - v.ve, v.gp - v.kl, -v.gp, lp - v.kl, v.ve - v.kl];
    return routes.every(r => Math.abs(r - T) >= 0.5);
  });
  const ve2_ = c2.ve;
  const kl2_ = c2.kl;
  const g2 = c2.gp;
  const lp2 = ve2_ - kl2_ + g2;
  const elbo2 = ve2_ - kl2_;
  const T2 = g2;

  // Card 3: var-exp
  const c3 = retry(() => ({
    m: g.pick([0, 1, 2, 3]),
    y: g.random(-2, 5),
    S: g.pick([2, 3, 4]),
  }), v => {
    const d = Math.abs(v.y - v.m);
    if (d < 1 || d > 3) return false;
    const T = -((v.y - v.m) * (v.y - v.m) + v.S) / 2;
    const routes = [
      -(v.y - v.m) * (v.y - v.m) / 2,
      -((v.y - v.m) * (v.y - v.m) + v.S * v.S) / 2,
      ((v.y - v.m) * (v.y - v.m) + v.S) / 2,
      -(v.y - v.m) * (v.y - v.m) / 2 - v.S,
      -((v.y - v.m) * (v.y - v.m) - v.S) / 2,
      -((v.y - v.m) * (v.y - v.m) + v.S),
      -(v.y - v.m) * (v.y - v.m) / 2 + v.S / 2,
    ];
    return routes.every(r => Math.abs(r - T) >= 1);
  });
  const m3 = c3.m;
  const y3 = c3.y;
  const S3 = c3.S;
  const d3 = y3 - m3;
  const d3sq = d3 * d3;
  const d3sqS = d3sq + S3;
  const T3 = -d3sqS / 2;

  // Card 4: kl-mean
  const c4 = retry(() => ({
    K: g.pick([2, 4, 5]),
    m: g.pick([2, 3, 4]),
  }), v => {
    const T = v.m * v.m / (2 * v.K);
    const routes = [v.m * v.m / v.K, v.m * v.m / (2 * v.K * v.K), v.m * v.m / 2, v.m / (2 * v.K), v.m * v.m / (4 * v.K), 0];
    return routes.every(r => Math.abs(r - T) >= 0.2);
  });
  const K4 = c4.K;
  const m4 = c4.m;
  const T4 = m4 * m4 / (2 * K4);

  // Card 5: kl-full
  const pairs5: [number, number, number][] = [
    [1, 2, 0.693], [1, 4, 1.386], [2, 1, -0.693], [2, 4, 0.693], [2, 8, 1.386],
    [4, 1, -1.386], [4, 2, -0.693], [4, 8, 0.693], [4, 16, 1.386],
  ];
  const c5 = retry(() => {
    const pair = g.pick(pairs5);
    const m = g.pick([1, 2, 3]);
    return { S: pair[0], K: pair[1], lnr: pair[2], m };
  }, v => {
    const T = 0.5 * (v.S / v.K + v.m * v.m / v.K - 1 + v.lnr);
    if (T < 0.1) return false;
    const rev = 0.5 * (v.K / v.S + v.m * v.m / v.S - 1 - v.lnr);
    const routes = [rev, 2 * T, 0.5 * (v.S / v.K + v.m * v.m / v.K - 1 - v.lnr), 0.5 * (v.S / v.K - 1 + v.lnr), 0.5 * (v.K / v.S + v.m * v.m / v.K - 1 + v.lnr), 0.5 * (v.S / v.K + v.m * v.m / v.S - 1 + v.lnr), 0.5 * (v.S / v.K + v.m * v.m / v.K - 1), 0.5 * (v.S / v.K + v.m * v.m / v.K + v.lnr)];
    return routes.every(r => Math.abs(r - T) >= 0.03);
  });
  const S5 = c5.S;
  const K5 = c5.K;
  const lnr5 = c5.lnr;
  const m5 = c5.m;
  const T5 = 0.5 * (S5 / K5 + m5 * m5 / K5 - 1 + lnr5);

  // Card 6: mode-seek
  const a6 = g.pick([4, 5, 6, 7, 8, 10]);
  const v6 = 1 + a6 * a6;
  const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const posteriorFn = (f: number) => 0.5 * phi(f + a6) + 0.5 * phi(f - a6);
  const shapes6: FigureShape[] = [
    { kind: 'line', points: graphOf(posteriorFn, -a6 - 4, a6 + 4, 160), tone: 'accent', label: 'p(f | y)' },
  ];
  const opt6 = [
    t(`N(${a6}, 1) or N(−${a6}, 1): sits on one mode, variance 1`, `N(${a6}, 1) 或 N(−${a6}, 1)：落在一个峰上，方差为 1`),
    t(`N(0, ${v6}): the mean and variance of the whole mixture`, `N(0, ${v6})：均值和方差都与整个混合分布完全相同，位于两个峰之间`),
    t('N(0, 1): midway between the modes, variance 1 like each mode', 'N(0, 1)：位于两个峰的正中间，方差与每个峰的方差相同'),
    t(`N(${a6}, ${v6}): centred on one mode, as wide as the whole mixture`, `N(${a6}, ${v6})：以其中一个峰为中心，但与整个混合分布一样宽`),
  ];
  const shuffled6 = shuffled(g, opt6);
  const correctIdx6 = shuffled6.findIndex(o => o[0].includes(`N(${a6}, 1)`));

  // Card 7: pred-var
  const c7 = retry(() => {
    const K = g.pick([2, 4, 6, 8]);
    const c = g.pick([K / 4, K / 2]);
    const S = g.pick([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5].filter(s => s < K && s > 0));
    return { K, c, S };
  }, v => {
    const T = v.K - v.c * v.c * (v.K - v.S) / (v.K * v.K);
    const denom = T * 8;
    if (Math.abs(denom - Math.round(denom)) > 1e-9) return false;
    const routes = [
      v.K - v.c * v.c / v.K,
      v.K - v.c * v.c * (v.K - v.S) / v.K,
      v.S,
      v.K - v.c * v.c * v.S / (v.K * v.K),
      v.c * v.c * (v.K - v.S) / (v.K * v.K),
      v.K - v.c * (v.K - v.S) / v.K,
    ];
    return routes.every(r => Math.abs(r - T) >= 0.125);
  });
  const K7 = c7.K;
  const c7_ = c7.c;
  const S7 = c7.S;
  const T7 = K7 - c7_ * c7_ * (K7 - S7) / (K7 * K7);
  const [cn7, cd7] = nd(c7_);
  const csq7 = cd7 === 1 ? `${num(cn7)}²` : `(${num(cn7)}/${num(cd7)})²`;
  const rho7 = `${num(cn7)}/${num(cd7 * K7)}`;

  // Card 8: classif-pred
  const PAIRS8: [number, number][] = [
    [9 / 16, 5 / 8], [9 / 16, 5 / 4], [9 / 16, 15 / 8],
    [5 / 4, 3 / 4], [5 / 4, 3 / 2], [5 / 4, 9 / 4],
    [3, 1], [3, 2], [3, 3],
    [21 / 4, 5 / 2],
  ];
  const c8 = retry(() => {
    const [sg, mu] = g.pick(PAIRS8);
    return { sg, mu };
  }, v => {
    const z = v.mu / Math.sqrt(1 + v.sg);
    const zStr = z.toFixed(1).replace(/\.0$/, '');
    if (!(zStr in PHI_TABLE)) return false;
    const T = PHI_TABLE[zStr];
    const routes = [
      PHI_TABLE[v.mu.toFixed(1).replace(/\.0$/, '')] || 0,
      PHI_TABLE[(v.mu / (1 + v.sg)).toFixed(1).replace(/\.0$/, '')] || 0,
      PHI_TABLE[(v.mu / Math.sqrt(v.sg)).toFixed(1).replace(/\.0$/, '')] || 0,
      PHI_TABLE[(v.mu / v.sg).toFixed(1).replace(/\.0$/, '')] || 0,
      PHI_TABLE[(v.mu * Math.sqrt(1 + v.sg)).toFixed(1).replace(/\.0$/, '')] || 0,
    ];
    return routes.every(r => Math.abs(r - T) >= 0.021);
  });
  const sg8 = c8.sg;
  const mu8 = c8.mu;
  const z8 = mu8 / Math.sqrt(1 + sg8);
  const T8 = PHI_TABLE[z8.toFixed(1).replace(/\.0$/, '')];

  // Card 9: challenge
  const c9 = retry(() => {
    const S1 = g.pick([1, 2]);
    const S2 = g.pick([1, 2]);
    const K1 = g.pick([1, 2, 4]);
    const K2 = g.pick([1, 2, 4]);
    const m1 = g.pick([0, 1, 2]);
    const m2 = g.pick([0, 1, 2]);
    const VE = -6 + 0.5 * g.random(0, 6); // -6 to -3, step 0.5
    const ratio = (K1 * K2) / (S1 * S2);
    const exp2 = Math.log2(ratio);
    if (exp2 === 0 || Math.abs(exp2) > 2) return null;
    const lnr = Math.round(0.693 * exp2 * 1000) / 1000;
    return { S1, S2, K1, K2, m1, m2, VE, lnr };
  }, v => {
    if (!v) return false;
    const { S1, S2, K1, K2, m1, m2, VE, lnr } = v;
    const KL = 0.5 * (S1 / K1 + S2 / K2 + m1 * m1 / K1 + m2 * m2 / K2 - 2 + lnr);
    if (KL < 0.05) return false;
    const T = VE - KL;
    const routes = [
      VE + KL,
      VE - 0.5 * (K1 / S1 + K2 / S2 + m1 * m1 / S1 + m2 * m2 / S2 - 2 - lnr),
      VE - 0.5 * (S1 / K1 + S2 / K2 + m1 * m1 / K1 + m2 * m2 / K2 - 1 + lnr),
      VE - 0.5 * (S1 / K1 + S2 / K2 + m1 * m1 / K1 + m2 * m2 / K2 - 2 - lnr),
      VE - 0.5 * (S1 / K1 + S2 / K2 - 2 + lnr),
      VE - 0.5 * (K1 / S1 + K2 / S2 + m1 * m1 / K1 + m2 * m2 / K2 - 2 + lnr),
      KL,
      VE - 0.5 * (S1 / K1 + S2 / K2 + m1 * m1 / K1 + m2 * m2 / K2 - 2),
      VE - (S1 / K1 + S2 / K2 + m1 * m1 / K1 + m2 * m2 / K2 - 2 + lnr),
    ];
    return routes.every(r => Math.abs(r - T) >= 0.05);
  });
  // retry rejects null candidates; make that runtime invariant explicit to TypeScript.
  if (!c9) throw new Error('GP-19: challenge sampler returned an invalid candidate');
  const S19 = c9.S1;
  const S29 = c9.S2;
  const K19 = c9.K1;
  const K29 = c9.K2;
  const m19 = c9.m1;
  const m29 = c9.m2;
  const VE9 = c9.VE;
  const lnr9 = c9.lnr;
  const KL9 = 0.5 * (S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 2 + lnr9);
  const T9 = VE9 - KL9;

  return [
    g.choice({
      id: 'rank-q',
      title: t('Which q is best?', '哪个 q 最好？'),
      prompt: t(
        `Variational inference fits a Gaussian q(f) to the posterior p(f | y). Three candidate Gaussians for the same model and the same data y have these values. q₁: E_q[log p(y | f)] = ${num(ve1)}, KL[q ‖ p(f)] = ${num(kl1)}. q₂: E_q[log p(y | f)] = ${num(ve2)}, KL[q ‖ p(f)] = ${num(kl2)}. q₃: E_q[log p(y | f)] = ${num(ve3)}, KL[q ‖ p(f)] = ${num(kl3)}. Which candidate has the smallest KL[q ‖ p(f | y)]?`,
        `变分推断用高斯分布 q(f) 逼近后验 p(f | y)。对同一个模型、同一组数据 y，三个候选高斯分布的取值如下。q₁：E_q[log p(y | f)] = ${num(ve1)}，KL[q ‖ p(f)] = ${num(kl1)}。q₂：E_q[log p(y | f)] = ${num(ve2)}，KL[q ‖ p(f)] = ${num(kl2)}。q₃：E_q[log p(y | f)] = ${num(ve3)}，KL[q ‖ p(f)] = ${num(kl3)}。哪个候选的 KL[q ‖ p(f | y)] 最小？`
      ),
      options: shuffledOpts,
      correct: correctIdx,
      hint: t('Variational inference maximises one number for each q. Write down what it is built from, and ask whether log p(y) changes from one candidate to the next.', '变分推断对每个 q 最大化同一个量。写出它由什么构成，再想想 log p(y) 会不会因候选不同而变化。'),
      explanation: t(
        `The ELBO ℒ[q] = E_q[log p(y | f)] − KL[q ‖ p(f)] is q₁: ${num(ve1)} − ${num(kl1)} = ${num(e1)}, q₂: ${num(ve2)} − ${num(kl2)} = ${num(e2)}, q₃: ${num(ve3)} − ${num(kl3)} = ${num(e3)}. Since log p(y) = ℒ[q] + KL[q ‖ p(f | y)] and log p(y) is the same constant for every q (Lecture 6 pp. 65–66), the largest ELBO, ${num(eArr[tIdx])} for ${qNames[tIdx]}, belongs to the smallest KL[q ‖ p(f | y)]. Looking only at the data fit would pick ${qNames[iv]} (${num([ve1, ve2, ve3][iv])} is the largest), looking only at the regulariser would pick ${qNames[ik]} (${num([kl1, kl2, kl3][ik])} is the smallest); neither is the ELBO. The posterior itself is never needed.`,
        `证据下界 ℒ[q] = E_q[log p(y | f)] − KL[q ‖ p(f)]：q₁ 为 ${num(ve1)} − ${num(kl1)} = ${num(e1)}，q₂ 为 ${num(ve2)} − ${num(kl2)} = ${num(e2)}，q₃ 为 ${num(ve3)} − ${num(kl3)} = ${num(e3)}。因为 log p(y) = ℒ[q] + KL[q ‖ p(f | y)]，且 log p(y) 对每个 q 都是同一个常数（第 6 讲第 65–66 页），所以最大的证据下界 ${num(eArr[tIdx])}（属于 ${qNames[tIdx]}）对应最小的 KL[q ‖ p(f | y)]。只看数据拟合会选 ${qNames[iv]}（它的 ${num([ve1, ve2, ve3][iv])} 最大），只看正则项会选 ${qNames[ik]}（它的 ${num([kl1, kl2, kl3][ik])} 最小），两者都不是证据下界。整个过程不需要后验本身。`
      ),
    }),
    g.number({
      id: 'elbo-gap',
      title: t('How far below log p(y)?', '比 log p(y) 低多少？'),
      prompt: t(
        `For a model with prior p(f) the log evidence is log p(y) = ${num(lp2)}. A Gaussian q(f) has data fit E_q[log p(y | f)] = ${num(ve2_)} and KL[q ‖ p(f)] = ${num(kl2_)}. How large is KL[q ‖ p(f | y)], the distance that variational inference minimises? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `某个以 p(f) 为先验的模型，其对数证据为 log p(y) = ${num(lp2)}。高斯分布 q(f) 的数据拟合项为 E_q[log p(y | f)] = ${num(ve2_)}，KL[q ‖ p(f)] = ${num(kl2_)}。变分推断所最小化的距离 KL[q ‖ p(f | y)] 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('KL[q ‖ p(f | y)]', 'KL[q ‖ p(f | y)]'), answer: T2, tolerance: 0.006 }],
      hint: t('First find the ELBO of this q. The ELBO is a lower bound on log p(y); what does the remaining distance to log p(y) measure?', '先求这个 q 的证据下界。证据下界是 log p(y) 的下界；它与 log p(y) 之间剩下的距离度量的是什么？'),
      explanation: t(
        `The ELBO is ℒ[q] = ${num(ve2_)} − ${num(kl2_)} = ${num(elbo2)}. Because log p(y) = ℒ[q] + KL[q ‖ p(f | y)] (Lecture 6 pp. 65–66), KL[q ‖ p(f | y)] = ${num(lp2)} − ${par(elbo2)} = ${num(T2)}. It is positive, as every KL divergence is (p. 64), so the ELBO lies below log p(y). Subtracting only the data fit would give ${num(lp2)} − ${par(ve2_)} = ${num(lp2 - ve2_)}, which forgets the prior term KL[q ‖ p(f)] = ${num(kl2_)}. Maximising the ELBO closes this gap, and the gap is zero only when q equals the posterior.`,
        `证据下界为 ℒ[q] = ${num(ve2_)} − ${num(kl2_)} = ${num(elbo2)}。因为 log p(y) = ℒ[q] + KL[q ‖ p(f | y)]（第 6 讲第 65–66 页），所以 KL[q ‖ p(f | y)] = ${num(lp2)} − ${par(elbo2)} = ${num(T2)}。它是正数，因为任何 KL 散度都不小于 0（第 64 页），所以证据下界低于 log p(y)。若只减去数据拟合项，得到 ${num(lp2)} − ${par(ve2_)} = ${num(lp2 - ve2_)}，这就漏掉了先验项 KL[q ‖ p(f)] = ${num(kl2_)}。最大化证据下界就是缩小这个差距，只有 q 等于后验时差距才为零。`
      ),
      audit: { kind: 'GP-19:elbo-gap', params: { lp: lp2, ve: ve2_, kl: kl2_ } },
    }),
    g.number({
      id: 'var-exp',
      title: t('The variational expectation of a data-fit term', '数据拟合项的变分期望'),
      prompt: t(
        `In the data-fit term E_q[log p(y | f)] of the ELBO, one data point with y = ${num(y3)} has the log-likelihood h(f) = −(y − f)²/2 = −(${num(y3)} − f)²/2 (a Gaussian likelihood with noise variance 1, constant dropped). The variational distribution is q(f) = N(${num(m3)}, ${num(S3)}), mean ${num(m3)} and variance ${num(S3)}. What is the expectation E_q[h(f)]? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在证据下界的数据拟合项 E_q[log p(y | f)] 中，一个数据点 y = ${num(y3)} 的对数似然为 h(f) = −(y − f)²/2 = −(${num(y3)} − f)²/2（噪声方差为 1 的高斯似然，已略去常数）。变分分布为 q(f) = N(${num(m3)}, ${num(S3)})，均值 ${num(m3)}，方差 ${num(S3)}。期望 E_q[h(f)] 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('E_q[h(f)]', '期望 E_q[h(f)]'), answer: T3, tolerance: 0.006 }],
      hint: t('Under q the value f is random. Is the average of (y − f)² the same as (y − mean)²? Which extra quantity, visible in q, makes up the difference?', '在 q 之下 f 是随机的。(y − f)² 的平均值等于 (y − 均值)² 吗？差别由 q 中的哪个量造成？'),
      explanation: t(
        `Under q the value f has mean ${num(m3)} and variance ${num(S3)}, so E_q[(y − f)²] = (y − m)² + S = (${num(y3)} − ${par(m3)})² + ${num(S3)} = ${num(d3sq)} + ${num(S3)} = ${num(d3sqS)}. Hence E_q[h(f)] = ${chain(`−${num(d3sqS)}/2`, exact(T3))}. Evaluating h at the mean only gives ${chain(`−${num(d3sq)}/2`, exact(-d3sq / 2))}; it ignores the spread S = ${num(S3)} of f, and a log-likelihood that is not linear in f is not simply evaluated at the mean. Gauss–Hermite quadrature (Lecture 6 p. 69) returns the same number, because h is a polynomial of order 2.`,
        `在 q 之下 f 的均值为 ${num(m3)}，方差为 ${num(S3)}，所以 E_q[(y − f)²] = (y − m)² + S = (${num(y3)} − ${par(m3)})² + ${num(S3)} = ${num(d3sq)} + ${num(S3)} = ${num(d3sqS)}。因此 E_q[h(f)] = ${chain(`−${num(d3sqS)}/2`, exact(T3))}。只在均值处计算 h 得到 ${chain(`−${num(d3sq)}/2`, exact(-d3sq / 2))}，这忽略了 f 的方差 S = ${num(S3)}；对数似然不是 f 的线性函数时，期望不能直接用均值处的值代替。高斯–埃尔米特求积（第 6 讲第 69 页）会给出同样的数，因为 h 是二次多项式。`
      ),
      audit: { kind: 'GP-19:var-exp', params: { y: y3, m: m3, S: S3 } },
    }),
    g.number({
      id: 'kl-mean',
      title: t('KL when the variances match', '方差相同时的 KL'),
      prompt: t(
        `In one dimension (k = 1) the prior is p(f) = N(0, ${num(K4)}) and the variational distribution is q(f) = N(${num(m4)}, ${num(K4)}), mean ${num(m4)} and variance ${num(K4)}. Use KL[N(μ₀, Σ₀) ‖ N(μ₁, Σ₁)] = ½( tr(Σ₁⁻¹Σ₀) + (μ₁ − μ₀)ᵀΣ₁⁻¹(μ₁ − μ₀) − k + ln(|Σ₁|/|Σ₀|) ), where N(μ₀, Σ₀) is q and N(μ₁, Σ₁) is p. What is KL[q ‖ p]? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一维情形（k = 1）下，先验为 p(f) = N(0, ${num(K4)})，变分分布为 q(f) = N(${num(m4)}, ${num(K4)})，均值 ${num(m4)}，方差 ${num(K4)}。使用公式 KL[N(μ₀, Σ₀) ‖ N(μ₁, Σ₁)] = ½( 迹(Σ₁⁻¹Σ₀) + (μ₁ − μ₀)ᵀΣ₁⁻¹(μ₁ − μ₀) − k + ln(|Σ₁|/|Σ₀|) )，其中 N(μ₀, Σ₀) 是 q，N(μ₁, Σ₁) 是 p。KL[q ‖ p] 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('KL[q ‖ p]', 'KL[q ‖ p]'), answer: T4, tolerance: 0.006 }],
      hint: t('With equal variances, look at which of the four terms in the bracket survive. Two of them are fixed numbers that cancel.', '方差相同时，看括号里四项中哪些还留下。其中有两项是固定的数，会互相抵消。'),
      explanation: t(
        `Both variances are ${num(K4)}. The trace term is ${num(K4)}/${num(K4)} = 1, which cancels −k = −1, and the log-determinant term is ln 1 = 0. Only the mean term remains: (0 − ${num(m4)})²/${num(K4)} = ${exact(m4 * m4 / K4)}. With the factor ½, KL[q ‖ p] = ½ · ${exact(m4 * m4 / K4)} = ${exact(T4)}. Dropping the ½ would give ${exact(m4 * m4 / K4)}. The KL is positive although the variances agree, because the means differ (Lecture 6 p. 64: KL ≥ 0, and KL = 0 only if q ≡ p).`,
        `两个方差都是 ${num(K4)}。迹项为 ${num(K4)}/${num(K4)} = 1，与 −k = −1 抵消；行列式的对数项为 ln 1 = 0。只剩均值项：(0 − ${num(m4)})²/${num(K4)} = ${exact(m4 * m4 / K4)}。乘以 ½，得 KL[q ‖ p] = ½ · ${exact(m4 * m4 / K4)} = ${exact(T4)}。若漏掉 ½，会得到 ${exact(m4 * m4 / K4)}。方差相同而 KL 仍为正，是因为均值不同（第 6 讲第 64 页：KL ≥ 0，且只有 q ≡ p 时才为 0）。`
      ),
      audit: { kind: 'GP-19:kl-mean', params: { m: m4, S: K4, K: K4 } },
    }),
    g.number({
      id: 'kl-full',
      title: t('The Gaussian KL in one dimension', '一维高斯 KL'),
      prompt: t(
        `In one dimension (k = 1) the prior is p(f) = N(0, ${num(K5)}) and the variational distribution is q(f) = N(${num(m5)}, ${num(S5)}), mean ${num(m5)} and variance ${num(S5)}. The logarithm in the formula has the value ln(${num(K5)}/${num(S5)}) = ${num(lnr5)}. Use KL[N(μ₀, Σ₀) ‖ N(μ₁, Σ₁)] = ½( tr(Σ₁⁻¹Σ₀) + (μ₁ − μ₀)ᵀΣ₁⁻¹(μ₁ − μ₀) − k + ln(|Σ₁|/|Σ₀|) ), where N(μ₀, Σ₀) is q and N(μ₁, Σ₁) is p. What is KL[q ‖ p]? Give a decimal rounded to 2 places.`,
        `一维情形（k = 1）下，先验为 p(f) = N(0, ${num(K5)})，变分分布为 q(f) = N(${num(m5)}, ${num(S5)})，均值 ${num(m5)}，方差 ${num(S5)}。公式中的对数取值 ln(${num(K5)}/${num(S5)}) = ${num(lnr5)}。使用公式 KL[N(μ₀, Σ₀) ‖ N(μ₁, Σ₁)] = ½( 迹(Σ₁⁻¹Σ₀) + (μ₁ − μ₀)ᵀΣ₁⁻¹(μ₁ − μ₀) − k + ln(|Σ₁|/|Σ₀|) )，其中 N(μ₀, Σ₀) 是 q，N(μ₁, Σ₁) 是 p。KL[q ‖ p] 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('KL[q ‖ p]', 'KL[q ‖ p]'), answer: T5, tolerance: 0.006 }],
      hint: t('Evaluate the four terms in the bracket one at a time: the trace, the mean term, −k and the logarithm. The variances here are not equal, so none of them cancels.', '把括号里的四项逐项算出：迹、均值项、−k 和对数项。这里两个方差不相等，所以没有哪一项会被抵消。'),
      explanation: t(
        `Trace term: Σ₁⁻¹Σ₀ = ${chain(ov(S5, K5), exact(S5 / K5))}. Mean term: (0 − ${num(m5)})²/${num(K5)} = ${chain(ov(m5 * m5, K5), exact(m5 * m5 / K5))}. Then −k = −1, and the logarithm is ${num(lnr5)}. The bracket is ${num(S5 / K5)} + ${num(m5 * m5 / K5)} − 1 + ${par(lnr5)} = ${num(S5 / K5 + m5 * m5 / K5 - 1 + lnr5)}, so KL[q ‖ p] = ½ · ${num(S5 / K5 + m5 * m5 / K5 - 1 + lnr5)} = ${num(T5)}. The reverse direction KL[p ‖ q] swaps the two Gaussians: it uses the variance ratio ${chain(ov(K5, S5), exact(K5 / S5))} in the trace term and the opposite logarithm, and gives ${num(0.5 * (K5 / S5 + m5 * m5 / S5 - 1 - lnr5))}: the KL is not symmetric (Lecture 6 p. 64), and the course minimises KL[q ‖ p].`,
        `迹项：Σ₁⁻¹Σ₀ = ${chain(ov(S5, K5), exact(S5 / K5))}。均值项：(0 − ${num(m5)})²/${num(K5)} = ${chain(ov(m5 * m5, K5), exact(m5 * m5 / K5))}。再加 −k = −1，对数项为 ${num(lnr5)}。括号内为 ${num(S5 / K5)} + ${num(m5 * m5 / K5)} − 1 + ${par(lnr5)} = ${num(S5 / K5 + m5 * m5 / K5 - 1 + lnr5)}，所以 KL[q ‖ p] = ½ · ${num(S5 / K5 + m5 * m5 / K5 - 1 + lnr5)} = ${num(T5)}。反方向 KL[p ‖ q] 交换了两个高斯分布：迹项改用方差之比 ${chain(ov(K5, S5), exact(K5 / S5))}，对数取相反数，结果为 ${num(0.5 * (K5 / S5 + m5 * m5 / S5 - 1 - lnr5))}：KL 不对称（第 6 讲第 64 页），而本课程最小化的是 KL[q ‖ p]。`
      ),
      audit: { kind: 'GP-19:kl-full', params: { m: m5, S: S5, K: K5, lnr: lnr5 } },
    }),
    g.choice({
      id: 'mode-seek',
      title: t('A bimodal posterior and a single Gaussian', '双峰后验与单个高斯'),
      prompt: t(
        `The true posterior is bimodal: p(f | y) = ½ N(f | −${a6}, 1) + ½ N(f | ${a6}, 1), with two well separated modes. Variational inference must use one Gaussian q(f) = N(m, v) and minimises KL[q ‖ p(f | y)]. Which q does it choose?`,
        `真实后验是双峰的：p(f | y) = ½ N(f | −${a6}, 1) + ½ N(f | ${a6}, 1)，两个峰相距很远。变分推断只能使用一个高斯分布 q(f) = N(m, v)，并最小化 KL[q ‖ p(f | y)]。它会选哪个 q？`
      ),
      options: shuffled6,
      correct: correctIdx6,
      hint: t('KL[q ‖ p] averages log(q/p) under q. What happens to that average if q puts mass where p has almost none?', 'KL[q ‖ p] 是 log(q/p) 在 q 之下的平均。如果 q 把质量放在 p 几乎没有质量的地方，这个平均会怎样？'),
      explanation: t(
        `KL[q ‖ p(f | y)] averages log(q/p) under q (Lecture 6 p. 64). Where q has mass but p has almost none, as between the two modes, log(q/p) is huge, so q avoids that region and settles on one mode: variational inference is mode-seeking (Lecture 6 p. 74). The best single Gaussian is essentially N(±${a6}, 1), with KL ≈ ln 2 ≈ 0.69, the price of ignoring the other half of the mass. The Gaussian N(0, ${v6}) has the mean 0 and the variance 1 + ${a6}² = ${v6} of the whole mixture; matching the first two moments minimises the reverse direction KL[p ‖ q] (GPML pdf pp. 221–222, eq. A.24), not KL[q ‖ p], and most of its mass lies in the empty region between the modes. N(0, 1) sits in that empty region as well, and N(${a6}, ${v6}) wastes most of its mass away from the mode. The variance 1 of the variational fit is far below the true variance ${v6}: variational inference underestimates the variance (Lecture 6 p. 74). This game does not assess how the fit is optimised.`,
        `KL[q ‖ p(f | y)] 是 log(q/p) 在 q 之下的平均（第 6 讲第 64 页）。在 q 有质量而 p 几乎没有质量的地方，例如两个峰之间，log(q/p) 非常大，所以 q 会避开这个区域，只落在一个峰上：变分推断是寻找众数的（第 6 讲第 74 页）。最好的单个高斯基本上是 N(±${a6}, 1)，其 KL ≈ ln 2 ≈ 0.69，这是忽略另一半质量的代价。高斯 N(0, ${v6}) 具有整个混合分布的均值 0 和方差 1 + ${a6}² = ${v6}；匹配前两阶矩最小化的是反方向 KL[p ‖ q]（GPML 第 221–222 页，式 A.24），而不是 KL[q ‖ p]，它的大部分质量落在两峰之间的空白区域。N(0, 1) 同样位于这块空白区域，N(${a6}, ${v6}) 则把大部分质量放在峰的外面。变分拟合的方差 1 远小于真实方差 ${v6}：变分推断会低估方差（第 6 讲第 74 页）。本游戏不考查拟合是如何优化的。`
      ),
      figure: g.figure({
        alt: t(`Density of the posterior p(f | y): two bumps of equal height, one at f = −${a6} and one at f = ${a6}, with almost no density in between.`, `后验 p(f | y) 的密度曲线：两个等高的峰，分别位于 f = −${a6} 和 f = ${a6}，两峰之间几乎没有密度。`),
        view: fitView(shapes6, 0.5),
        axes: { xLabel: 'f', yLabel: t('density', '概率密度') },
        shapes: shapes6,
        aspect: 'free',
      }),
    }),
    g.number({
      id: 'pred-var',
      title: t('The variance of f* under q', 'q 之下 f* 的方差'),
      prompt: t(
        `A GP has one training latent value f = f(x) and a test latent value f*. The kernel gives K = k(x, x) = ${num(K7)}, k** = k(x*, x*) = ${num(K7)} and k* = k(x*, x) = ${num(c7_)}. Given f, the test value is f* | f ~ N( k* K⁻¹ f, k** − k* K⁻¹ k* ) (Lecture 6 p. 77). The variational posterior is q(f) = N(m, S) with variance S = ${num(S7)}. Under q(f*) = ∫ p(f* | f) q(f) df, what is the variance σ*² of the latent value f* (not of a noisy y*)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个高斯过程有一个训练潜变量值 f = f(x) 和一个测试潜变量值 f*。核函数给出 K = k(x, x) = ${num(K7)}，k** = k(x*, x*) = ${num(K7)}，k* = k(x*, x) = ${num(c7_)}。给定 f 时，测试值满足 f* | f ~ N( k* K⁻¹ f, k** − k* K⁻¹ k* )（第 6 讲第 77 页）。变分后验为 q(f) = N(m, S)，其方差 S = ${num(S7)}。在 q(f*) = ∫ p(f* | f) q(f) df 之下，潜变量值 f*（不是带噪声的 y*）的方差 σ*² 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Variance σ*² of f*', 'f* 的方差 σ*²'), answer: T7, tolerance: 0.006 }],
      hint: t('f* depends on f, and f is itself uncertain under q. Which two separate sources of uncertainty does f* then have, and how strongly does f feed into f*?', 'f* 依赖于 f，而 f 在 q 之下本身也不确定。那么 f* 有哪两个互相独立的不确定来源？f 对 f* 的影响有多大？'),
      explanation: t(
        `Given f, the variance of f* is k** − k* K⁻¹ k* = ${num(K7)} − ${csq7}/${num(K7)} = ${num(K7)} − ${exact(c7_ * c7_ / K7)} = ${exact(K7 - c7_ * c7_ / K7)}. On top of that, f is uncertain under q, and f* depends on it through the factor k* K⁻¹ = ${chain(rho7, exact(c7_ / K7))}: this adds (${exact(c7_ / K7)})² · ${exact(S7)} = ${exact((c7_ / K7) * (c7_ / K7))} · ${exact(S7)} = ${exact((c7_ / K7) * (c7_ / K7) * S7)}. The total is ${exact(K7 - c7_ * c7_ / K7)} + ${exact((c7_ / K7) * (c7_ / K7) * S7)} = ${exact(T7)}, which equals k** − k* K⁻¹ (K − S) K⁻¹ k* (Assignment 3 Task 1, part e). Keeping only the first part gives ${exact(K7 - c7_ * c7_ / K7)}, as if q were certain. Using S = ${exact(S7)} itself would give the variance of f at the training input, which equals σ*² only if x* = x.`,
        `给定 f 时，f* 的方差为 k** − k* K⁻¹ k* = ${num(K7)} − ${csq7}/${num(K7)} = ${num(K7)} − ${exact(c7_ * c7_ / K7)} = ${exact(K7 - c7_ * c7_ / K7)}。此外，f 在 q 之下也不确定，而 f* 通过系数 k* K⁻¹ = ${chain(rho7, exact(c7_ / K7))} 依赖于它：这又增加 (${exact(c7_ / K7)})² · ${exact(S7)} = ${exact((c7_ / K7) * (c7_ / K7))} · ${exact(S7)} = ${exact((c7_ / K7) * (c7_ / K7) * S7)}。总方差为 ${exact(K7 - c7_ * c7_ / K7)} + ${exact((c7_ / K7) * (c7_ / K7) * S7)} = ${exact(T7)}，它等于 k** − k* K⁻¹ (K − S) K⁻¹ k*（作业 3 任务 1 第 e 问）。只保留第一部分得到 ${exact(K7 - c7_ * c7_ / K7)}，好像 q 是确定的。直接取 S = ${exact(S7)} 得到的是训练输入处 f 的方差，只有 x* = x 时它才等于 σ*²。`
      ),
      audit: { kind: 'GP-19:pred-var', params: { K: K7, c: c7_, S: S7 } },
    }),
    g.number({
      id: 'classif-pred',
      title: t('From f* to a class probability', '从 f* 到类别概率'),
      prompt: t(
        `A binary GP classifier has the likelihood p(y* = +1 | f*) = Φ(f*), where Φ is the standard normal cdf: Φ(0.5) = 0.6915, Φ(1) = 0.8413, Φ(1.5) = 0.9332, Φ(2) = 0.9772, Φ(2.5) = 0.9938, Φ(3) = 0.9987. The variational posterior gives q(f*) = N(μ*, σ*²) with μ* = ${exact(mu8)} and σ*² = ${exact(sg8)}. What is p(y* = +1 | y) ≈ ∫ Φ(f*) q(f*) df*? Give a decimal rounded to 2 places.`,
        `二分类高斯过程分类器的似然为 p(y* = +1 | f*) = Φ(f*)，其中 Φ 是标准正态分布函数：Φ(0.5) = 0.6915，Φ(1) = 0.8413，Φ(1.5) = 0.9332，Φ(2) = 0.9772，Φ(2.5) = 0.9938，Φ(3) = 0.9987。变分后验给出 q(f*) = N(μ*, σ*²)，其中 μ* = ${exact(mu8)}，σ*² = ${exact(sg8)}。p(y* = +1 | y) ≈ ∫ Φ(f*) q(f*) df* 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('p(y* = +1 | y)', 'p(y* = +1 | y)'), answer: T8, tolerance: 0.006 }],
      hint: t('The integral of Φ against a Gaussian is again Φ at a single number. The spread σ*² should pull the probability towards 1/2 compared with Φ(μ*). Which number does Φ get?', 'Φ 对高斯分布的积分仍然是 Φ 在某一个数处的取值。与 Φ(μ*) 相比，方差 σ*² 应当把概率拉向 1/2。Φ 的自变量是哪个数？'),
      explanation: t(
        `The integral equals Φ( μ* / √(1 + σ*²) ) (Lecture 6 p. 78). Here 1 + σ*² = 1 + ${exact(sg8)} = ${exact(1 + sg8)}, whose square root is ${exact(Math.sqrt(1 + sg8))}, so the argument is ${exact(mu8)} ÷ ${exact(Math.sqrt(1 + sg8))} = ${exact(z8)}. In the table this is Φ(${num(z8)}) = ${T8}. Using Φ(μ*) directly ignores σ*² and is too confident; the larger σ*² is, the closer the probability moves to 1/2 (as σ*² → ∞ it tends to 1/2). Dividing by σ* instead of √(1 + σ*²) gives a different number again.`,
        `该积分等于 Φ( μ* / √(1 + σ*²) )（第 6 讲第 78 页）。这里 1 + σ*² = 1 + ${exact(sg8)} = ${exact(1 + sg8)}，其平方根为 ${exact(Math.sqrt(1 + sg8))}，所以自变量为 ${exact(mu8)} ÷ ${exact(Math.sqrt(1 + sg8))} = ${exact(z8)}。表中对应 Φ(${num(z8)}) = ${T8}。直接用 Φ(μ*) 会忽略 σ*²，结果过于自信；σ*² 越大，概率越接近 1/2（σ*² → ∞ 时趋于 1/2）。若除以 σ* 而不是 √(1 + σ*²)，又会得到另一个数。`
      ),
      audit: { kind: 'GP-19:classif-pred', params: { mu: nd(mu8), sg: nd(sg8) } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the ELBO of a two-dimensional q', '挑战：二维 q 的证据下界'),
      prompt: t(
        `A model has a two-dimensional latent f with prior p(f) = N(0, K), K = ${mat([[String(K19), '0'], ['0', String(K29)]])}. The variational distribution is q(f) = N(m, S) with m = (${num(m19)}, ${num(m29)}) and S = ${mat([[String(S19), '0'], ['0', String(S29)]])}. The data-fit term is E_q[log p(y | f)] = ${num(VE9)}, and ln(|K|/|S|) = ${num(lnr9)}. What is the ELBO ℒ[q]? Give a decimal rounded to 2 places.`,
        `某个模型有二维潜变量 f，先验为 p(f) = N(0, K)，K = ${mat([[String(K19), '0'], ['0', String(K29)]])}。变分分布为 q(f) = N(m, S)，其中 m = (${num(m19)}, ${num(m29)})，S = ${mat([[String(S19), '0'], ['0', String(S29)]])}。数据拟合项为 E_q[log p(y | f)] = ${num(VE9)}，且 ln(|K|/|S|) = ${num(lnr9)}。证据下界 ℒ[q] 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ELBO ℒ[q]', '证据下界 ℒ[q]'), answer: T9, tolerance: 0.006 }],
      hint: t('The ELBO has two parts. One of them is a KL divergence between two Gaussians, now with k = 2 dimensions. Both matrices are diagonal, so the traces and the mean terms split into two pieces.', '证据下界由两部分构成，其中一部分是两个高斯分布之间的 KL 散度，这里维数 k = 2。两个矩阵都是对角的，所以迹和均值项都可以拆成两块。'),
      explanation: t(
        `ℒ[q] = E_q[log p(y | f)] − KL[q ‖ p(f)]. For the KL (Assignment 3 Task 1, part a) the trace term is ${ov(S19, K19)} + ${ov(S29, K29)} = ${exact(S19 / K19 + S29 / K29)}. The mean term is ${sq(m19, K19)} + ${sq(m29, K29)} = ${exact(m19 * m19 / K19 + m29 * m29 / K29)}. Then −k = −2, and the logarithm is ${num(lnr9)}. The bracket is ${num(S19 / K19 + S29 / K29)} + ${num(m19 * m19 / K19 + m29 * m29 / K29)} − 2 + ${par(lnr9)} = ${num(S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 2 + lnr9)}, so KL[q ‖ p] = ½ · ${num(S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 2 + lnr9)} = ${num(KL9)}. Then ℒ[q] = ${num(VE9)} − ${par(KL9)} = ${num(T9)}. Adding the KL instead of subtracting it would give ${num(VE9 + KL9)}; using k = 1 would give ${num(VE9 - 0.5 * (S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 1 + lnr9))}. This game does not assess how E_q[log p(y | f)] is computed for a non-Gaussian likelihood (Gauss–Hermite quadrature) or how q is optimised.`,
        `ℒ[q] = E_q[log p(y | f)] − KL[q ‖ p(f)]。先算 KL（作业 3 任务 1 第 a 问）：迹项为 ${ov(S19, K19)} + ${ov(S29, K29)} = ${exact(S19 / K19 + S29 / K29)}。均值项为 ${sq(m19, K19)} + ${sq(m29, K29)} = ${exact(m19 * m19 / K19 + m29 * m29 / K29)}。再加 −k = −2，对数项为 ${num(lnr9)}。括号内为 ${num(S19 / K19 + S29 / K29)} + ${num(m19 * m19 / K19 + m29 * m29 / K29)} − 2 + ${par(lnr9)} = ${num(S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 2 + lnr9)}，所以 KL[q ‖ p] = ½ · ${num(S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 2 + lnr9)} = ${num(KL9)}。于是 ℒ[q] = ${num(VE9)} − ${par(KL9)} = ${num(T9)}。若把 KL 加上而不是减去，会得到 ${num(VE9 + KL9)}；若取 k = 1，会得到 ${num(VE9 - 0.5 * (S19 / K19 + S29 / K29 + m19 * m19 / K19 + m29 * m29 / K29 - 1 + lnr9))}。本游戏不考查非高斯似然时如何计算 E_q[log p(y | f)]（高斯–埃尔米特求积）或如何优化 q。`
      ),
      audit: { kind: 'GP-19:challenge', params: { K1: K19, K2: K29, S1: S19, S2: S29, m1: m19, m2: m29, lnr: lnr9, VE: VE9 } },
    }),
  ];
};
