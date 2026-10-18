import type { CardGenerator } from '../../types';
import { fitView, type FigureShape, graphOf } from '../../figure';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const dec = (x: number | string) => (typeof x === "string" ? x : num(r4(x)));
/** Join equal-looking steps of a displayed chain only once: "1/5 = 1/5" becomes "1/5". */
const chain = (...parts: string[]) => parts.filter((x, k) => k === 0 || x !== parts[k - 1]).join(' = ');
const lnText = (l: number) => (l === 0 ? '0' : `−${l.toFixed(2)}`);
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Pre-computed valid tuples for card 2 (14 sets)
const card2Tuples: [number, number, number, number][] = [
  [2,4,2,2],[2,5,2,1],[2,5,2,2],[4,2,2,1],[4,5,2,1],[4,5,2,2],[4,5,3,1],[4,5,3,2],
  [5,2,2,1],[5,2,2,2],[5,4,2,1],[5,4,2,2],[5,4,3,1],[5,4,3,2]
];

export const gp12: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-12');
  warm(g);

  // --- Card 1: loo-var ---
  const c1 = retry(() => {
    const p1 = g.pick([2, 4, 5, 8, 10]);
    const p2 = g.pick([2, 4, 5, 8, 10]);
    const q = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    const i = g.random(1, 2);
    return { p1, p2, q, i };
  }, v => {
    if (v.p1 * v.p2 <= v.q * v.q) return false;
    if (v.p1 === v.p2) return false;
    const pi = v.i === 1 ? v.p1 : v.p2;
    const pj = v.i === 1 ? v.p2 : v.p1;
    const det = v.p1 * v.p2 - v.q * v.q;
    const truth = 1 / pi;
    const wrongs = [pi, 1 / pj, 1 / Math.abs(v.q), pj / det, det / pj, 1 / det, det / pi];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const c1_pi = c1.i === 1 ? c1.p1 : c1.p2;
  const c1_pj = c1.i === 1 ? c1.p2 : c1.p1;
  const c1_det = c1.p1 * c1.p2 - c1.q * c1.q;
  const c1_truth = 1 / c1_pi;
  const c1_sgi = c1.i === 1 ? 'σ₋₁²' : 'σ₋₂²';
  const c1_yi = c1.i === 1 ? 'y₁' : 'y₂';

  // --- Card 2: loo-var-c ---
  const c2Tuple = g.pick(card2Tuples);
  const [c2_a, c2_c, c2_b, c2_i] = c2Tuple;
  const c2_det = c2_a * c2_c - c2_b * c2_b;
  const c2_Cii = c2_i === 1 ? c2_a : c2_c;
  const c2_Cjj = c2_i === 1 ? c2_c : c2_a;
  const c2_truth = c2_det / c2_Cjj;
  const c2_sgi = c2_i === 1 ? 'σ₋₁²' : 'σ₋₂²';
  const c2_yi = c2_i === 1 ? 'y₁' : 'y₂';

  // --- Card 3: loo-mean ---
  const c3 = retry(() => {
    const p1 = g.pick([2, 4, 5]);
    const p2 = g.pick([2, 4, 5]);
    const q = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    const i = g.random(1, 2);
    const yi = g.random(-3, 3);
    const yj = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    return { p1, p2, q, i, yi, yj };
  }, v => {
    if (v.p1 * v.p2 <= v.q * v.q) return false;
    const pi = v.i === 1 ? v.p1 : v.p2;
    const pj = v.i === 1 ? v.p2 : v.p1;
    const Pyi = pi * v.yi + v.q * v.yj;
    const r = Pyi / pi;
    const truth = v.yi - r; // = -q*yj/pi
    if (Math.abs(truth) < 0.5) return false;
    const wrongs = [r, v.yi + r, Pyi, v.yi - Pyi / pj, -v.q * v.yj, v.yj, -v.q * v.yj / pj, v.yi];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const c3_pi = c3.i === 1 ? c3.p1 : c3.p2;
  const c3_Pyi = c3_pi * c3.yi + c3.q * c3.yj;
  const c3_r = c3_Pyi / c3_pi;
  const c3_truth = c3.yi - c3_r;
  const c3_mui = c3.i === 1 ? 'μ₋₁' : 'μ₋₂';
  const c3_yi = c3.i === 1 ? 'y₁' : 'y₂';
  const c3_y1 = c3.i === 1 ? c3.yi : c3.yj;
  const c3_y2 = c3.i === 1 ? c3.yj : c3.yi;

  // --- Card 4: mean-change ---
  const c4 = retry(() => {
    const p1 = g.pick([2, 4, 5]);
    const p2 = g.pick([2, 4, 5]);
    const q = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    const y2 = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    const s = g.random(-3, 3);
    const t = g.random(-3, 3);
    return { p1, p2, q, y2, s, t };
  }, v => {
    if (v.p1 * v.p2 <= v.q * v.q) return false;
    if (v.s === v.t) return false;
    return true;
  });
  const c4_mu = -c4.q * c4.y2 / c4.p1;
  const c4_Ps = c4.p1 * c4.s + c4.q * c4.y2;
  const c4_Pt = c4.p1 * c4.t + c4.q * c4.y2;
  const c4_delta = c4.t - c4.s;

  // --- Card 5: loo-density ---
  const c5 = retry(() => {
    const s2 = g.pick([2, 4]);
    const mu = g.random(-3, 3);
    const y = g.random(-4, 4);
    return { s2, mu, y };
  }, v => {
    const d = v.y - v.mu;
    if (d === 0) return false;
    if (Math.abs(d) > 4) return false;
    if (v.s2 === 4 && d % 2 !== 0) return false;
    const l = v.s2 === 2 ? 0.70 : 1.40;
    const truth = -l / 2 - (d * d) / (2 * v.s2) - 0.92;
    const wrongs = [
      l / 2 - (d * d) / (2 * v.s2) - 0.92,
      -l / 2 - (d * d) / v.s2 - 0.92,
      -l / 2 - d / (2 * v.s2) - 0.92,
      -l / 2 - (d * d) / (2 * v.s2),
      -l / 2 - (d * d) / (2 * v.s2) - 1.84,
      -l - (d * d) / (2 * v.s2) - 0.92,
      -l / 2 - 0.92,
      -l / 2 - (d * d) / (2 * Math.sqrt(v.s2)) - 0.92,
      -(d * d) / (2 * v.s2) - 0.92,
      -l / 2 + (d * d) / (2 * v.s2) - 0.92
    ];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const c5_d = c5.y - c5.mu;
  const c5_l = c5.s2 === 2 ? 0.70 : 1.40;
  const c5_truth = -c5_l / 2 - (c5_d * c5_d) / (2 * c5.s2) - 0.92;

  // Figure for card 5
  const sigma = Math.sqrt(c5.s2);
  const x0 = c5.mu - 3 * sigma;
  const x1 = c5.mu + 3 * sigma;
  const densityFn = (x: number) => Math.exp(-((x - c5.mu) ** 2) / (2 * c5.s2)) / Math.sqrt(2 * Math.PI * c5.s2);
  const curvePts = graphOf(densityFn, x0, x1);
  const c5_shapes: FigureShape[] = [
    { kind: 'line', points: curvePts, tone: 'accent' },
    { kind: 'line', points: [[c5.mu, 0], [c5.mu, densityFn(c5.mu)]], tone: 'muted', dash: true, label: 'μ' },
    { kind: 'point', at: [c5.y, densityFn(c5.y)], tone: 'warn', label: 'yᵢ' },
  ];

  // --- Card 6: scale-c ---
  const c6 = retry(() => {
    const p1 = g.pick([2, 4, 5]);
    const p2 = g.pick([2, 4, 5]);
    const q = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    const i = g.random(1, 2);
    const yi = g.random(-3, 3);
    const yj = g.pick([1, 2, 3]) * (g.random(0, 1) === 0 ? 1 : -1);
    const c = g.pick([2, 4]);
    return { p1, p2, q, i, yi, yj, c };
  }, v => {
    if (v.p1 * v.p2 <= v.q * v.q) return false;
    if (v.p1 === v.p2) return false;
    const pi = v.i === 1 ? v.p1 : v.p2;
    const pj = v.i === 1 ? v.p2 : v.p1;
    const mu = -v.q * v.yj / pi;
    if (Math.abs(mu) < 0.5) return false;
    const v_truth = v.c / pi;
    const wrongsMu = [v.c * mu, mu / v.c, v.c * v.c * mu, -mu];
    const wrongsV = [1 / pi, 1 / (v.c * pi), v.c * v.c / pi, v.c / pj, pi / v.c];
    return wrongsMu.every(w => Math.abs(mu - w) >= 0.02) && wrongsV.every(w => Math.abs(v_truth - w) >= 0.02);
  });
  const c6_pi = c6.i === 1 ? c6.p1 : c6.p2;
  const c6_mu = -c6.q * c6.yj / c6_pi;
  const c6_v = c6.c / c6_pi;
  const c6_mui = c6.i === 1 ? 'μ₋₁' : 'μ₋₂';
  const c6_sgi = c6.i === 1 ? 'σ₋₁²' : 'σ₋₂²';
  const c6_yi = c6.i === 1 ? 'y₁' : 'y₂';
  const c6_y1 = c6.i === 1 ? c6.yi : c6.yj;
  const c6_y2 = c6.i === 1 ? c6.yj : c6.yi;

  // --- Card 7: singular ---
  const c7_a = g.pick([1, 2, 3, 4]);
  const c7_sg = g.random(0, 1) === 0 ? 1 : -1;
  const c7_sa = c7_sg * c7_a;

  // --- Card 8: vs-evidence ---
  const c8_kernel = g.pick(['squared exponential', 'Matérn-3/2', 'periodic']);
  const c8_data = g.pick(['monthly CO₂ readings', 'daily sales figures']);
  const c8_kernelZh = c8_kernel === 'squared exponential' ? '平方指数' : c8_kernel === 'Matérn-3/2' ? 'Matérn-3/2' : '周期';
  const c8_dataZh = c8_data === 'monthly CO₂ readings' ? '每月 CO₂ 读数' : '每日销售数据';

  // --- Card 9: challenge ---
  const c9 = retry(() => {
    const p1 = g.pick([1, 2, 4]);
    const p2 = g.pick([1, 2, 4]);
    const q = g.pick([-2, -1, 1, 2]);
    const y1 = g.random(-2, 2);
    const y2 = g.random(-2, 2);
    return { p1, p2, q, y1, y2 };
  }, v => {
    if (v.p1 * v.p2 <= v.q * v.q) return false;
    if (v.y1 === 0 && v.y2 === 0) return false;
    const Py1 = v.p1 * v.y1 + v.q * v.y2;
    const Py2 = v.q * v.y1 + v.p2 * v.y2;
    if (v.p1 === 4 && Py1 % 2 !== 0) return false;
    if (v.p2 === 4 && Py2 % 2 !== 0) return false;
    const e1 = Py1 / v.p1;
    const e2 = Py2 / v.p2;
    const l1 = v.p1 === 1 ? 0 : v.p1 === 2 ? 0.70 : 1.40;
    const l2 = v.p2 === 1 ? 0 : v.p2 === 2 ? 0.70 : 1.40;
    const d1 = l1 / 2 - (v.p1 * e1 * e1) / 2 - 0.92;
    const d2 = l2 / 2 - (v.p2 * e2 * e2) / 2 - 0.92;
    const truth = d1 + d2;
    if (truth < -12) return false;
    // Guards
    const wrongs = [
      // variance read as pk instead of 1/pk
      (v.p1 === 1 ? 0 : v.p1 === 2 ? 0.70 : 1.40) / 2 - (e1 * e1) / 2 - 0.92 + (v.p2 === 1 ? 0 : v.p2 === 2 ? 0.70 : 1.40) / 2 - (e2 * e2) / 2 - 0.92,
      // no normalising constant
      l1 / 2 - (v.p1 * e1 * e1) / 2 + l2 / 2 - (v.p2 * e2 * e2) / 2,
      // mean taken as 0
      l1 / 2 - (v.p1 * v.y1 * v.y1) / 2 - 0.92 + l2 / 2 - (v.p2 * v.y2 * v.y2) / 2 - 0.92,
      // Pyk not divided by pk
      l1 / 2 - (v.p1 * Py1 * Py1) / 2 - 0.92 + l2 / 2 - (v.p2 * Py2 * Py2) / 2 - 0.92,
      // first point only
      l1 / 2 - (v.p1 * e1 * e1) / 2 - 0.92,
      // second point only
      l2 / 2 - (v.p2 * e2 * e2) / 2 - 0.92,
      // sign of log term flipped
      -l1 / 2 - (v.p1 * e1 * e1) / 2 - 0.92 - l2 / 2 - (v.p2 * e2 * e2) / 2 - 0.92,
      // log term without 1/2
      -l1 - (v.p1 * e1 * e1) / 2 - 0.92 - l2 - (v.p2 * e2 * e2) / 2 - 0.92
    ];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const c9_Py1 = c9.p1 * c9.y1 + c9.q * c9.y2;
  const c9_Py2 = c9.q * c9.y1 + c9.p2 * c9.y2;
  const c9_e1 = c9_Py1 / c9.p1;
  const c9_e2 = c9_Py2 / c9.p2;
  const c9_l1 = c9.p1 === 1 ? 0 : c9.p1 === 2 ? 0.70 : 1.40;
  const c9_l2 = c9.p2 === 1 ? 0 : c9.p2 === 2 ? 0.70 : 1.40;
  const c9_d1 = c9_l1 / 2 - (c9.p1 * c9_e1 * c9_e1) / 2 - 0.92;
  const c9_d2 = c9_l2 / 2 - (c9.p2 * c9_e2 * c9_e2) / 2 - 0.92;
  const c9_truth = c9_d1 + c9_d2;

  return [
    // Card 1
    g.number({
      id: 'loo-var',
      title: t('Leave-one-out variance', '留一法的方差'),
      prompt: t(
        `A GP regression has noisy targets y = (y₁, y₂) with covariance C = K + σ²I. The inverse is C⁻¹ = ${mat([[num(c1.p1), num(c1.q)], [num(c1.q), num(c1.p2)]])}. Point ${dec(c1.i)} is left out and predicted from the other target. What is the variance ${dec(c1_sgi)} of ${dec(c1_yi)} given the other target? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个 GP 回归的带噪声目标为 y = (y₁, y₂)，协方差 C = K + σ²I，其逆矩阵 C⁻¹ = ${mat([[num(c1.p1), num(c1.q)], [num(c1.q), num(c1.p2)]])}。把第 ${dec(c1.i)} 个点留出，用另一个目标来预测它。在给定另一个目标的条件下，${dec(c1_yi)} 的方差 ${dec(c1_sgi)} 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: c1_sgi, answer: c1_truth, tolerance: 0.006 }],
      hint: t(
        'Only the diagonal entry that belongs to the left-out point matters here; the other entries are not needed. A large entry there means the point is almost fixed by the other target: should its predictive variance be large or small?',
        '这里只需要与被留出的点对应的那个对角元，其余元素用不到。该对角元很大，说明这个点几乎被另一个目标确定：它的预测方差应该大还是小？'
      ),
      explanation: t(
        `The variance of ${dec(c1_yi)} given the other target is 1/[C⁻¹]ᵢᵢ (GPML pdf p. 135, eq. 5.12). Here [C⁻¹]ᵢᵢ = ${dec(c1_pi)}, so ${chain(dec(c1_sgi), '1/' + dec(c1_pi), exact(c1_truth))}. The other diagonal entry ${dec(c1_pj)} belongs to the other point and the off-diagonal entry ${dec(c1.q)} is not used. The diagonal entry of C itself, ${frac(c1_pj, c1_det)}, is the prior variance of ${dec(c1_yi)} before the other target is used; it is larger than ${exact(c1_truth)} because the other target is informative.`,
        `在给定另一个目标时，${dec(c1_yi)} 的方差为 1/[C⁻¹]ᵢᵢ（GPML pdf 第 135 页，式 5.12）。这里 [C⁻¹]ᵢᵢ = ${dec(c1_pi)}，所以 ${chain(dec(c1_sgi), '1/' + dec(c1_pi), exact(c1_truth))}。另一个对角元 ${dec(c1_pj)} 属于另一个点，非对角元 ${dec(c1.q)} 用不到。C 自身的对角元 ${frac(c1_pj, c1_det)} 是在没用另一个目标之前 ${dec(c1_yi)} 的先验方差；它比 ${exact(c1_truth)} 大，因为另一个目标提供了信息。`
      ),
      audit: { kind: 'GP-12:loo-var', params: { p1: c1.p1, p2: c1.p2, q: c1.q, i: c1.i } }
    }),

    // Card 2
    g.number({
      id: 'loo-var-c',
      title: t('From C to the leave-one-out variance', '由 C 求留一法方差'),
      prompt: t(
        `The noisy targets y = (y₁, y₂) have covariance C = K + σ²I = ${mat([[num(c2_a), num(c2_b)], [num(c2_b), num(c2_c)]])}, with determinant det C = ${dec(c2_a)}·${par(c2_c)} − ${par(c2_b)}² = ${dec(c2_det)}. Point ${dec(c2_i)} is left out. What is the variance ${dec(c2_sgi)} of ${dec(c2_yi)} given the other target? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `带噪声目标 y = (y₁, y₂) 的协方差为 C = K + σ²I = ${mat([[num(c2_a), num(c2_b)], [num(c2_b), num(c2_c)]])}，行列式 det C = ${dec(c2_a)}·${par(c2_c)} − ${par(c2_b)}² = ${dec(c2_det)}。把第 ${dec(c2_i)} 个点留出。在给定另一个目标的条件下，${dec(c2_yi)} 的方差 ${dec(c2_sgi)} 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: c2_sgi, answer: c2_truth, tolerance: 0.006 }],
      hint: t(
        'For a 2 × 2 matrix the inverse swaps the two diagonal entries, changes the sign of the off-diagonal entry and divides by the determinant. You can also check your answer by predicting yᵢ from the other target alone.',
        '2 × 2 矩阵的逆：交换两个对角元，非对角元变号，再除以行列式。你也可以只用另一个目标去预测 yᵢ，用它来检验答案。'
      ),
      explanation: t(
        `C⁻¹ = (1/${dec(c2_det)})·${mat([[num(c2_c), num(-c2_b)], [num(-c2_b), num(c2_a)]])}, so [C⁻¹]ᵢᵢ = ${dec(c2_Cjj)}/${dec(c2_det)} and ${chain(dec(c2_sgi), '1/[C⁻¹]ᵢᵢ', dec(c2_det) + '/' + dec(c2_Cjj), exact(c2_truth))} (GPML pdf p. 135). Check by conditioning on the other target alone: ${dec(c2_Cii)} − ${par(c2_b)}²/${dec(c2_Cjj)} = ${dec(c2_Cii)} − ${frac(c2_b * c2_b, c2_Cjj)} = ${exact(c2_truth)}. Both routes agree. The variance is smaller than the prior variance ${dec(c2_Cii)} because the other target is informative.`,
        `C⁻¹ = (1/${dec(c2_det)})·${mat([[num(c2_c), num(-c2_b)], [num(-c2_b), num(c2_a)]])}，所以 [C⁻¹]ᵢᵢ = ${dec(c2_Cjj)}/${dec(c2_det)}，${chain(dec(c2_sgi), '1/[C⁻¹]ᵢᵢ', dec(c2_det) + '/' + dec(c2_Cjj), exact(c2_truth))}（GPML pdf 第 135 页）。用只以另一个目标为条件来检验：${dec(c2_Cii)} − ${par(c2_b)}²/${dec(c2_Cjj)} = ${dec(c2_Cii)} − ${frac(c2_b * c2_b, c2_Cjj)} = ${exact(c2_truth)}。两种做法一致。方差比先验方差 ${dec(c2_Cii)} 小，因为另一个目标提供了信息。`
      ),
      audit: { kind: 'GP-12:loo-var-c', params: { a: c2_a, b: c2_b, c: c2_c, i: c2_i } }
    }),

    // Card 3
    g.number({
      id: 'loo-mean',
      title: t('Leave-one-out mean', '留一法的均值'),
      prompt: t(
        `For noisy targets y = (${num(c3_y1)}, ${num(c3_y2)}) the inverse covariance is C⁻¹ = ${mat([[num(c3.p1), num(c3.q)], [num(c3.q), num(c3.p2)]])}. Point ${dec(c3.i)} is left out and predicted from the other target. What is the leave-one-out mean ${dec(c3_mui)} (the predictive mean of ${dec(c3_yi)})? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `带噪声目标 y = (${num(c3_y1)}, ${num(c3_y2)})，其协方差的逆为 C⁻¹ = ${mat([[num(c3.p1), num(c3.q)], [num(c3.q), num(c3.p2)]])}。把第 ${dec(c3.i)} 个点留出，用另一个目标预测它。留一法均值 ${dec(c3_mui)}（${dec(c3_yi)} 的预测均值）是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: c3_mui, answer: c3_truth, tolerance: 0.006 }],
      hint: t(
        'Start with the vector C⁻¹y, using the printed entries. A sanity check for your final number: the leave-one-out mean for a point is computed without that point\'s own target, so it cannot change when that target changes.',
        '先用给出的元素算向量 C⁻¹y。检验最终结果的方法：一个点的留一法均值是在不使用该点自身目标的情况下算出的，所以该点的目标改变时它不会变。'
      ),
      explanation: t(
        `[C⁻¹y]ᵢ = ${par(c3_pi)}·${par(c3.yi)} + ${par(c3.q)}·${par(c3.yj)} = ${dec(c3_Pyi)} (row ${dec(c3.i)} of C⁻¹ times y). Then ${dec(c3_mui)} = ${dec(c3_yi)} − [C⁻¹y]ᵢ/[C⁻¹]ᵢᵢ = ${num(c3.yi)} − ${par(c3_Pyi)}/${dec(c3_pi)} = ${num(c3.yi)} − (${exact(c3_r)}) = ${exact(c3_truth)} (GPML pdf p. 135, eq. 5.12). The quotient ${exact(c3_r)} is the model's residual at point ${dec(c3.i)} when all data are used; the leave-one-out mean is not that residual, and it does not contain ${dec(c3_yi)}: it equals −${par(c3.q)}·${par(c3.yj)}/${dec(c3_pi)} = ${exact(c3_truth)}.`,
        `[C⁻¹y]ᵢ = ${par(c3_pi)}·${par(c3.yi)} + ${par(c3.q)}·${par(c3.yj)} = ${dec(c3_Pyi)}（C⁻¹ 的第 ${dec(c3.i)} 行乘以 y）。于是 ${dec(c3_mui)} = ${dec(c3_yi)} − [C⁻¹y]ᵢ/[C⁻¹]ᵢᵢ = ${num(c3.yi)} − ${par(c3_Pyi)}/${dec(c3_pi)} = ${num(c3.yi)} − (${exact(c3_r)}) = ${exact(c3_truth)}（GPML pdf 第 135 页，式 5.12）。商 ${exact(c3_r)} 是用全部数据拟合时模型在第 ${dec(c3.i)} 个点的残差；留一法均值不是这个残差，并且不含 ${dec(c3_yi)}：它等于 −${par(c3.q)}·${par(c3.yj)}/${dec(c3_pi)} = ${exact(c3_truth)}。`
      ),
      audit: { kind: 'GP-12:loo-mean', params: { p1: c3.p1, p2: c3.p2, q: c3.q, y1: c3_y1, y2: c3_y2, i: c3.i } }
    }),

    // Card 4
    g.choice({
      id: 'mean-change',
      title: t('Does the left-out mean follow the left-out target?', '留出点的均值会随该点的目标变化吗？'),
      prompt: t(
        `The inverse covariance of the noisy targets is C⁻¹ = ${mat([[num(c4.p1), num(c4.q)], [num(c4.q), num(c4.p2)]])}. With y = (${num(c4.s)}, ${num(c4.y2)}) the leave-one-out mean of point 1 is μ₋₁. Now the first target changes to y₁ = ${num(c4.t)} while y₂ = ${num(c4.y2)} stays. Which statement is correct?`,
        `带噪声目标的协方差之逆为 C⁻¹ = ${mat([[num(c4.p1), num(c4.q)], [num(c4.q), num(c4.p2)]])}。当 y = (${num(c4.s)}, ${num(c4.y2)}) 时，点 1 的留一法均值为 μ₋₁。现在第一个目标变为 y₁ = ${num(c4.t)}，y₂ = ${num(c4.y2)} 不变。下列哪条说法正确？`
      ),
      options: [
        t(`μ₋₁ stays the same; only the leave-one-out error y₁ − μ₋₁ changes, by ${num(c4_delta)}.`, `μ₋₁ 不变；只有留一误差 y₁ − μ₋₁ 改变，改变量为 ${num(c4_delta)}。`),
        t(`μ₋₁ changes by ${num(c4_delta)}: the mean follows y₁, and the leave-one-out error stays the same.`, `μ₋₁ 改变 ${num(c4_delta)}：均值跟着 y₁ 走，留一误差不变。`),
        t(`μ₋₁ changes, because y₁ is multiplied by the entry [C⁻¹]₁₁ = ${dec(c4.p1)} when C⁻¹y is formed.`, `μ₋₁ 会变，因为形成 C⁻¹y 时 y₁ 要乘以元素 [C⁻¹]₁₁ = ${dec(c4.p1)}。`),
        t(`μ₋₁ stays the same and so does the leave-one-out error, because leaving a point out removes its influence.`, `μ₋₁ 不变，留一误差也不变，因为留出一个点就去掉了它的影响。`)
      ],
      correct: 0,
      hint: t(
        'Compute μ₋₁ once with each value of y₁. Which entries of y does the leave-one-out mean for point 1 actually use?',
        '对 y₁ 的两个取值各算一次 μ₋₁。点 1 的留一法均值究竟用到了 y 的哪些元素？'
      ),
      explanation: t(
        `For y₁ = ${num(c4.s)}: [C⁻¹y]₁ = ${dec(c4.p1)}·${par(c4.s)} + ${par(c4.q)}·${par(c4.y2)} = ${dec(c4_Ps)}, so μ₋₁ = ${num(c4.s)} − ${par(c4_Ps)}/${dec(c4.p1)} = ${exact(c4_mu)}. For y₁ = ${num(c4.t)}: [C⁻¹y]₁ = ${dec(c4.p1)}·${par(c4.t)} + ${par(c4.q)}·${par(c4.y2)} = ${dec(c4_Pt)}, so μ₋₁ = ${num(c4.t)} − ${par(c4_Pt)}/${dec(c4.p1)} = ${exact(c4_mu)}. The mean is the same, because the ${dec(c4.p1)}·y₁ in C⁻¹y is exactly cancelled by the y₁ in front of the quotient; it depends only on y₂ (GPML pdf p. 135: the mean is independent of yᵢ 'as indeed it should be'). The error y₁ − μ₋₁ goes from ${exact(c4.s - c4_mu)} to ${exact(c4.t - c4_mu)}, a change of ${num(c4_delta)}.`,
        `y₁ = ${num(c4.s)} 时：[C⁻¹y]₁ = ${dec(c4.p1)}·${par(c4.s)} + ${par(c4.q)}·${par(c4.y2)} = ${dec(c4_Ps)}，所以 μ₋₁ = ${num(c4.s)} − ${par(c4_Ps)}/${dec(c4.p1)} = ${exact(c4_mu)}。y₁ = ${num(c4.t)} 时：[C⁻¹y]₁ = ${dec(c4.p1)}·${par(c4.t)} + ${par(c4.q)}·${par(c4.y2)} = ${dec(c4_Pt)}，所以 μ₋₁ = ${num(c4.t)} − ${par(c4_Pt)}/${dec(c4.p1)} = ${exact(c4_mu)}。均值相同，因为 C⁻¹y 中的 ${dec(c4.p1)}·y₁ 恰好被商前面的 y₁ 抵消；它只依赖于 y₂（GPML pdf 第 135 页：均值与 yᵢ 无关，“理应如此”）。误差 y₁ − μ₋₁ 从 ${exact(c4.s - c4_mu)} 变为 ${exact(c4.t - c4_mu)}，变化量为 ${num(c4_delta)}。`
      )
    }),

    // Card 5
    g.number({
      id: 'loo-density',
      title: t('One leave-one-out log density', '一个留一法对数密度'),
      prompt: t(
        `The leave-one-out predictive distribution of a target yᵢ is N(μ, σ²) with μ = ${num(c5.mu)} and σ² = ${dec(c5.s2)}. The observed value is yᵢ = ${num(c5.y)}. The log density is log p = −½ ln σ² − (yᵢ − μ)²/(2σ²) − ½ ln 2π. Use ln σ² = ${dec(c5_l.toFixed(2))} and ln 2π = 1.84 (rounded values, use them as given). What is log p? Give a decimal rounded to 2 places.`,
        `目标 yᵢ 的留一法预测分布为 N(μ, σ²)，其中 μ = ${num(c5.mu)}，σ² = ${dec(c5.s2)}。观测值为 yᵢ = ${num(c5.y)}。对数密度为 log p = −½ ln σ² − (yᵢ − μ)²/(2σ²) − ½ ln 2π。取 ln σ² = ${dec(c5_l.toFixed(2))}，ln 2π = 1.84（已取整，按给定值使用）。log p 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: 'log p', answer: c5_truth, tolerance: 0.006 }],
      figure: g.figure({
        alt: t(
          `The density N(μ, σ²) drawn as a bell curve centred at ${num(c5.mu)}, with the observed value ${num(c5.y)} marked on it.`,
          `N(μ, σ²) 的密度画成以 ${num(c5.mu)} 为中心的钟形曲线，并在曲线上标出观测值 ${num(c5.y)}。`
        ),
        view: fitView(c5_shapes, 0.5),
        axes: { xLabel: 'yᵢ', yLabel: t('density', '密度'), grid: false },
        shapes: c5_shapes,
        aspect: 'free'
      }),
      hint: t(
        'Work out the three terms one at a time: the log-variance term, the squared-error term and the constant. Pay attention to the sign in front of each.',
        '把三项分别算出来：对数方差项、平方误差项和常数项。注意每一项前面的符号。'
      ),
      explanation: t(
        `d = yᵢ − μ = ${num(c5.y)} − ${par(c5.mu)} = ${num(c5_d)}. The three terms are −½·${c5_l.toFixed(2)} = ${num(-c5_l / 2)}, −${par(c5_d)}²/(2·${par(c5.s2)}) = ${chain('−' + frac(c5_d * c5_d, 2 * c5.s2), num(-(c5_d * c5_d) / (2 * c5.s2)))} and −½·1.84 = −0.92. Their sum is ${num(c5_truth)} (GPML pdf p. 134, eq. 5.10). The squared-error term shrinks when σ² grows, while the log-variance term gets more negative: the log density rewards a variance that fits the size of the error.`,
        `d = yᵢ − μ = ${num(c5.y)} − ${par(c5.mu)} = ${num(c5_d)}。三项分别为 −½·${c5_l.toFixed(2)} = ${num(-c5_l / 2)}、−${par(c5_d)}²/(2·${par(c5.s2)}) = ${chain('−' + frac(c5_d * c5_d, 2 * c5.s2), num(-(c5_d * c5_d) / (2 * c5.s2)))} 和 −½·1.84 = −0.92，相加得 ${num(c5_truth)}（GPML pdf 第 134 页，式 5.10）。σ² 变大时平方误差项变小，而对数方差项变得更负：对数密度奖励与误差大小相称的方差。`
      ),
      audit: { kind: 'GP-12:loo-density', params: { mu: c5.mu, s2: c5.s2, y: c5.y, lns2: c5_l } }
    }),

    // Card 6
    g.number({
      id: 'scale-c',
      title: t('Scaling the whole covariance', '整体缩放协方差'),
      prompt: t(
        `For noisy targets y = (${num(c6_y1)}, ${num(c6_y2)}) the covariance C has inverse C⁻¹ = ${mat([[num(c6.p1), num(c6.q)], [num(c6.q), num(c6.p2)]])}. Now the signal variance and the noise variance are both multiplied by c = ${dec(c6.c)}, so the covariance becomes cC and its inverse becomes C⁻¹/c. For the new covariance, point ${dec(c6.i)} is left out: find the leave-one-out mean ${dec(c6_mui)} and the variance ${dec(c6_sgi)} of ${dec(c6_yi)} given the other target. Give integers, fractions or decimals rounded to 2 places.`,
        `带噪声目标 y = (${num(c6_y1)}, ${num(c6_y2)})，协方差 C 的逆为 C⁻¹ = ${mat([[num(c6.p1), num(c6.q)], [num(c6.q), num(c6.p2)]])}。现在把信号方差和噪声方差都乘以 c = ${dec(c6.c)}，协方差变为 cC，其逆变为 C⁻¹/c。对新的协方差，把第 ${dec(c6.i)} 个点留出：求留一法均值 ${dec(c6_mui)} 和在给定另一个目标时 ${dec(c6_yi)} 的方差 ${dec(c6_sgi)}。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [
        { label: c6_mui, answer: c6_mu, tolerance: 0.006 },
        { label: c6_sgi, answer: c6_v, tolerance: 0.006 }
      ],
      hint: t(
        `Replace C⁻¹ by the scaled matrix first, then repeat the leave-one-out steps for point ${dec(c6.i)}. Compare both results with the unscaled case: which of the two numbers feels the scale c?`,
        `先把 C⁻¹ 换成缩放后的矩阵，再对第 ${dec(c6.i)} 个点重复留一法的步骤。把两个结果与未缩放的情形比较：哪一个数会受尺度 c 影响？`
      ),
      explanation: t(
        `The new inverse is C⁻¹/c, so its entries are the old ones divided by ${dec(c6.c)}. In ${dec(c6_mui)} = ${dec(c6_yi)} − [C⁻¹y]ᵢ/[C⁻¹]ᵢᵢ numerator and denominator both shrink by the factor ${dec(c6.c)}, so the mean is unchanged: ${dec(c6_mui)} = ${exact(c6_mu)}. The variance ${chain(dec(c6_sgi), '1/[C⁻¹/c]ᵢᵢ', dec(c6.c) + '/' + dec(c6_pi), exact(c6_v))}, ${dec(c6.c)} times the unscaled value 1/${dec(c6_pi)}. So a loss that uses only the means, such as squared error, cannot tell the scales apart and leaves one degree of freedom undetermined, while the log density contains ${dec(c6_sgi)} and can (GPML pdf p. 136).`,
        `新的逆矩阵是 C⁻¹/c，各元素都是旧元素除以 ${dec(c6.c)}。在 ${dec(c6_mui)} = ${dec(c6_yi)} − [C⁻¹y]ᵢ/[C⁻¹]ᵢᵢ 中，分子分母同时缩小为原来的 1/${dec(c6.c)}，所以均值不变：${dec(c6_mui)} = ${exact(c6_mu)}。方差 ${chain(dec(c6_sgi), '1/[C⁻¹/c]ᵢᵢ', dec(c6.c) + '/' + dec(c6_pi), exact(c6_v))}，是未缩放值 1/${dec(c6_pi)} 的 ${dec(c6.c)} 倍。因此只用均值的损失（例如平方误差）分不出尺度，会留下一个自由度无法确定，而对数密度含有 ${dec(c6_sgi)}，可以确定（GPML pdf 第 136 页）。`
      ),
      audit: { kind: 'GP-12:scale-c', params: { p1: c6.p1, p2: c6.p2, q: c6.q, y1: c6_y1, y2: c6_y2, i: c6.i, c: c6.c } }
    }),

    // Card 7
    g.choice({
      id: 'singular',
      title: t('When the closed form breaks', '闭式何时失效'),
      prompt: t(
        `A noise-free GP (σ² = 0) is evaluated at two inputs with x₁ = x₂, so the covariance of the targets is C = ${mat([[num(c7_a), num(c7_sa)], [num(c7_sa), num(c7_a)]])}. Someone wants the variance of y₁ given y₂ from σ₋₁² = 1/[C⁻¹]₁₁. What happens?`,
        `一个无噪声的 GP（σ² = 0）在两个输入 x₁ = x₂ 处取值，因此目标的协方差为 C = ${mat([[num(c7_a), num(c7_sa)], [num(c7_sa), num(c7_a)]])}。有人想用 σ₋₁² = 1/[C⁻¹]₁₁ 求在给定 y₂ 时 y₁ 的方差。会发生什么？`
      ),
      options: [
        t(`C is singular: its determinant is ${dec(c7_a)}·${par(c7_a)} − ${par(c7_sa)}² = 0, so C⁻¹ does not exist and the closed form cannot be used.`, `C 是奇异的：行列式为 ${dec(c7_a)}·${par(c7_a)} − ${par(c7_sa)}² = 0，所以 C⁻¹ 不存在，闭式无法使用。`),
        t(`C⁻¹ has the entry 1/${dec(c7_a)} in position (1, 1), so σ₋₁² = ${dec(c7_a)}.`, `C⁻¹ 的 (1, 1) 元素为 1/${dec(c7_a)}，所以 σ₋₁² = ${dec(c7_a)}。`),
        t(`Nothing goes wrong: a valid kernel always gives an invertible C, so σ₋₁² = 1/[C⁻¹]₁₁ can be applied as usual.`, `没有问题：合法的核总是给出可逆的 C，所以仍可照常使用 σ₋₁² = 1/[C⁻¹]₁₁。`),
        t(`[C⁻¹]₁₁ = 0, so σ₋₁² is infinite: the other target says nothing about y₁.`, `[C⁻¹]₁₁ = 0，所以 σ₋₁² 为无穷大：另一个目标对 y₁ 没有任何信息。`)
      ],
      correct: 0,
      hint: t(
        'Compute the determinant of the printed matrix. What does the closed form need from C?',
        '算出所给矩阵的行列式。闭式对 C 有什么要求？'
      ),
      explanation: t(
        `The closed form divides by an entry of C⁻¹, so it needs C to be invertible (GPML pdf p. 135 uses K⁻¹). Here det C = ${dec(c7_a)}·${par(c7_a)} − ${par(c7_sa)}² = 0, so C⁻¹ does not exist; entry-wise 1/${dec(c7_a)} is not an inverse. A valid kernel only gives a positive semi-definite matrix, and with σ² = 0 and a repeated input it is singular. With any σ² > 0 the matrix C = K + σ²I is positive definite and the closed form works. This remark is derived here; it is not a statement from the source. The conditional variance can still be computed directly: ${dec(c7_a)} − ${par(c7_sa)}²/${dec(c7_a)} = 0, because y₂ determines y₁ exactly, but the formula 1/[C⁻¹]₁₁ is not available.`,
        `闭式要除以 C⁻¹ 的一个元素，所以需要 C 可逆（GPML pdf 第 135 页用到 K⁻¹）。这里 det C = ${dec(c7_a)}·${par(c7_a)} − ${par(c7_sa)}² = 0，C⁻¹ 不存在；逐元素取 1/${dec(c7_a)} 不是逆矩阵。合法的核只保证矩阵半正定，在 σ² = 0 且输入重复时它是奇异的。只要 σ² > 0，C = K + σ²I 就是正定的，闭式可用。这是推导出的说明，不是来源中的原话。条件方差仍可直接算：${dec(c7_a)} − ${par(c7_sa)}²/${dec(c7_a)} = 0，因为 y₂ 完全确定 y₁，但公式 1/[C⁻¹]₁₁ 用不了。`
      )
    }),

    // Card 8
    g.choice({
      id: 'vs-evidence',
      title: t('Leave-one-out or marginal likelihood?', '留一法还是边际似然？'),
      prompt: t(
        `A GP with a ${dec(c8_kernel)} kernel is fitted to ${dec(c8_data)}. Which statement correctly compares choosing hyperparameters by the leave-one-out log pseudo-likelihood with choosing them by the marginal likelihood (GPML §5.4)?`,
        `对${dec(c8_dataZh)}用${dec(c8_kernelZh)}核拟合一个 GP。下列哪条陈述正确地比较了用留一法对数伪似然与用边际似然来选择超参数？`
      ),
      options: [
        t('It scores held-out predictions even if the model is wrong, so it is argued to be more robust.', '即使模型有误，它也在评估对留出数据的预测，因此被认为更稳健。'),
        t('It is much cheaper, because it needs no matrix inverse, only n small updates.', '它便宜得多，因为不需要矩阵求逆，只需 n 次小更新。'),
        t('It is the probability of the data under the model assumptions, so it is meaningless if the kernel is wrong.', '它是在模型假设下数据出现的概率，所以核不对时就没有意义。'),
        t('Squared error is the best loss to use, because it takes the predictive variances into account.', '平方误差是最好的损失，因为它考虑了预测方差。')
      ],
      correct: 0,
      hint: t(
        'Ask what each criterion measures: the probability of the data given the model\'s assumptions, or how well held-out targets are predicted.',
        '想想每个准则衡量的是什么：模型假设下数据出现的概率，还是对留出目标的预测好坏。'
      ),
      explanation: t(
        'The marginal likelihood is the probability of the observations given the assumptions of the model; the leave-one-out value estimates the predictive log probability whether or not the assumptions hold, so cross-validation is argued to be more robust against mis-specification (GPML pdf p. 136, citing Wahba). It is not cheaper: K⁻¹ costs O(n³) once and the n leave-one-out quantities then cost O(n²) in total, and the computational demands of the two methods are roughly identical (pp. 135–136). And a loss that uses only the squared error ignores the predictive variances and leaves the scale undetermined, which makes it unattractive for choosing hyperparameters (p. 136).',
        '边际似然是在模型假设成立的前提下观测数据出现的概率；留一法的值估计的是预测对数概率，不论假设是否成立，所以交叉验证被认为对模型设定错误更稳健（GPML pdf 第 136 页，引用 Wahba）。它并不更便宜：K⁻¹ 需要一次 O(n³)，之后全部 n 个留一量总共只需 O(n²)，两种方法的计算量大致相同（第 135–136 页）。而只用平方误差的损失忽略预测方差，会让尺度无法确定，因此不适合用来选择超参数（第 136 页）。'
      )
    }),

    // Card 9
    g.number({
      id: 'challenge',
      title: t('Challenge: the whole pseudo-likelihood', '挑战：完整的伪似然'),
      prompt: t(
        `A GP regression has noisy targets y = (${num(c9.y1)}, ${num(c9.y2)}) and the inverse covariance C⁻¹ = ${mat([[num(c9.p1), num(c9.q)], [num(c9.q), num(c9.p2)]])}. Find the leave-one-out log pseudo-likelihood, the sum over both points of log p(yᵢ | y₋ᵢ) = −½ ln σ₋ᵢ² − (yᵢ − μ₋ᵢ)²/(2σ₋ᵢ²) − ½ ln 2π, where μ₋ᵢ and σ₋ᵢ² are the leave-one-out mean and variance of yᵢ. Use ln 2 = 0.70, ln 4 = 1.40 and ln 2π = 1.84 (rounded values, use them as given). Give a decimal rounded to 2 places.`,
        `一个 GP 回归的带噪声目标为 y = (${num(c9.y1)}, ${num(c9.y2)})，协方差之逆为 C⁻¹ = ${mat([[num(c9.p1), num(c9.q)], [num(c9.q), num(c9.p2)]])}。求留一法对数伪似然，即两个点的 log p(yᵢ | y₋ᵢ) = −½ ln σ₋ᵢ² − (yᵢ − μ₋ᵢ)²/(2σ₋ᵢ²) − ½ ln 2π 之和，其中 μ₋ᵢ 与 σ₋ᵢ² 是 yᵢ 的留一法均值与方差。取 ln 2 = 0.70，ln 4 = 1.40，ln 2π = 1.84（已取整，按给定值使用）。请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('LOO log pseudo-likelihood', 'LOO 对数伪似然'), answer: c9_truth, tolerance: 0.006 }],
      hint: t(
        'Do it point by point: first the leave-one-out mean and variance from the printed matrix, then the three terms of the density, then add the two points.',
        '逐点做：先由所给矩阵求留一法均值和方差，再算密度的三项，最后把两个点相加。'
      ),
      explanation: t(
        `Point 1: [C⁻¹y]₁ = ${dec(c9.p1)}·${par(c9.y1)} + ${par(c9.q)}·${par(c9.y2)} = ${dec(c9_Py1)}, so y₁ − μ₋₁ = ${chain(dec(c9_Py1) + '/' + dec(c9.p1), exact(c9_e1))} and σ₋₁² = 1/${dec(c9.p1)}, ln σ₋₁² = ${lnText(c9_l1)}. Its log density is −½·${c9_l1 === 0 ? '0' : '(' + lnText(c9_l1) + ')'} − (${exact(c9_e1)})²/(2/${dec(c9.p1)}) − 0.92 = ${num(c9_d1)}. Point 2: [C⁻¹y]₂ = ${par(c9.q)}·${par(c9.y1)} + ${par(c9.p2)}·${par(c9.y2)} = ${dec(c9_Py2)}, so y₂ − μ₋₂ = ${exact(c9_e2)}, σ₋₂² = 1/${dec(c9.p2)}; its log density is ${num(c9_d2)}. The sum is ${num(c9_d1)} + ${par(c9_d2)} = ${num(c9_truth)} (GPML pdf p. 134, eqs. 5.10–5.12). This game does not test optimising the hyperparameters with the gradient of the pseudo-likelihood, matrices larger than 2 × 2, or evaluating logarithms yourself.`,
        `点 1：[C⁻¹y]₁ = ${dec(c9.p1)}·${par(c9.y1)} + ${par(c9.q)}·${par(c9.y2)} = ${dec(c9_Py1)}，所以 y₁ − μ₋₁ = ${chain(dec(c9_Py1) + '/' + dec(c9.p1), exact(c9_e1))}，σ₋₁² = 1/${dec(c9.p1)}，ln σ₋₁² = ${lnText(c9_l1)}。它的对数密度为 −½·${c9_l1 === 0 ? '0' : '(' + lnText(c9_l1) + ')'} − (${exact(c9_e1)})²/(2/${dec(c9.p1)}) − 0.92 = ${num(c9_d1)}。点 2：[C⁻¹y]₂ = ${par(c9.q)}·${par(c9.y1)} + ${par(c9.p2)}·${par(c9.y2)} = ${dec(c9_Py2)}，所以 y₂ − μ₋₂ = ${exact(c9_e2)}，σ₋₂² = 1/${dec(c9.p2)}；其对数密度为 ${num(c9_d2)}。总和为 ${num(c9_d1)} + ${par(c9_d2)} = ${num(c9_truth)}（GPML pdf 第 134 页，式 5.10–5.12）。本游戏不考查用伪似然的梯度优化超参数、大于 2 × 2 的矩阵，以及自己计算对数。`
      ),
      audit: { kind: 'GP-12:challenge', params: { p1: c9.p1, p2: c9.p2, q: c9.q, y1: c9.y1, y2: c9.y2 } }
    })
  ];
};
