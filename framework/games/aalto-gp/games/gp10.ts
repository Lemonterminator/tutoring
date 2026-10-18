import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const dec = (x: number | string) => (typeof x === "string" ? x : num(r4(x)));
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const LN2 = 0.693;
const LN3 = 1.099;
const LN2PI = 1.838;
const gcdInt = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcdInt(b, a % b));
/** denominator of numer/denom in lowest terms */
const reducedDen = (numer: number, denom: number) => denom / (gcdInt(numer, denom) || 1);
const lnOfInt = (n: number): number => { let r = 0, m = n; while (m % 2 === 0 && m > 1) { m /= 2; r += LN2; } while (m % 3 === 0 && m > 1) { m /= 3; r += LN3; } if (m !== 1) throw new Error('ln of ' + n); return r; };
/** every wrong route must stay at least 0.02 away from the answer */
const clear = (answer: number, wrongs: number[]) => wrongs.every(w => Math.abs(w - answer) >= 0.02);

export const gp10: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-10');
  warm(g);

  // --- Card 1: roles ---
  const N1 = g.random(3, 8);
  const vIdx = g.random(0, 5);
  const variants = [
    { key: 'y', Q: t('the observed targets y', '观测目标值 y'), setup: t('The inputs, the kernel, σ² and N stay fixed while only the values y change.', '输入、核函数、σ² 和 N 保持不变，只有 y 的取值变化。'), why: t('Only the data fit contains y. The normalising constant contains only N, and −½ ln|C| contains only K and σ², so replacing the targets changes only the data fit', '只有数据拟合项含 y。归一化常数只含 N，−½ ln|C| 只含 K 和 σ²，所以换掉目标值只改变数据拟合项'), correct: 0 },
    { key: 'ell', Q: t('the length-scale ℓ', '长度尺度 ℓ'), setup: t('The inputs, the targets, σ² and N stay fixed.', '输入、目标值、σ² 和 N 保持不变。'), why: t('ℓ enters K, hence C: it changes ln|C| (complexity penalty) and C⁻¹ (data fit). The normalising constant contains only N, so it does not move', 'ℓ 进入 K，从而进入 C：它改变 ln|C|（复杂度惩罚项）和 C⁻¹（数据拟合项）。归一化常数只含 N，不会变'), correct: 2 },
    { key: 'sf', Q: t('the signal variance σ_f²', '信号方差 σ_f²'), setup: t('The inputs, the targets, σ² and N stay fixed.', '输入、目标值、σ² 和 N 保持不变。'), why: t('σ_f² scales K, hence C: it changes ln|C| and C⁻¹. The normalising constant contains only N', 'σ_f² 缩放 K，从而改变 C：它改变 ln|C| 和 C⁻¹。归一化常数只含 N'), correct: 2 },
    { key: 'noise', Q: t('the noise variance σ²', '噪声方差 σ²'), setup: t('The inputs, the kernel, the targets and N stay fixed.', '输入、核函数、目标值和 N 保持不变。'), why: t('σ² is added to the diagonal of C: it changes ln|C| and C⁻¹. The normalising constant contains only N', 'σ² 加在 C 的对角线上：它改变 ln|C| 和 C⁻¹。归一化常数只含 N'), correct: 2 },
    { key: 'x', Q: t('the input locations x₁, …, x_N', '输入位置 x₁, …, x_N'), setup: t('The kernel, σ², the targets and N stay fixed.', '核函数、σ²、目标值和 N 保持不变。'), why: t('The inputs enter K = k(X, X), hence C: they change ln|C| and C⁻¹. The normalising constant contains only N', '输入进入 K = k(X, X)，从而进入 C：它们改变 ln|C| 和 C⁻¹。归一化常数只含 N'), correct: 2 },
    { key: 'n', Q: t('the number of data points N', '数据点个数 N'), setup: t(`One more data point is added, so N = ${dec(N1)} becomes N = ${dec(N1 + 1)}.`, `增加一个数据点，N = ${dec(N1)} 变为 N = ${dec(N1 + 1)}。`), why: t('N multiplies ln 2π, sets the size of C (so ln|C| is a different determinant) and the number of terms in yᵀC⁻¹y, so all three terms depend on N', 'N 乘在 ln 2π 上，决定 C 的大小（ln|C| 成为另一个行列式）以及 yᵀC⁻¹y 的项数，所以三项都依赖于 N'), correct: 3 },
  ];
  const v = variants[vIdx];
  const rolesOptions = [
    t('Only the data fit, the one term that contains y', '只有数据拟合项，它是唯一含 y 的项'),
    t('Only the complexity penalty, the one term that contains K', '只有复杂度惩罚项，它是唯一含 K 的项'),
    t('The complexity penalty and the data fit', '复杂度惩罚项和数据拟合项'),
    t('All three terms', '三项全部'),
  ];

  // --- Card 2: const-term ---
  const N2 = g.random(2, 9);
  const ans2 = -0.919 * N2;

  // --- Card 3: complexity ---
  const c3Pairs = [[2, 1], [2, -1], [3, 1], [3, -1], [4, 2], [4, -2], [5, 4], [5, -4], [5, 3], [5, -3]];
  const c3 = c3Pairs[g.random(0, 9)];
  const a3 = c3[0], b3 = c3[1];
  const det3 = a3 * a3 - b3 * b3;
  const lnDetTable: Record<number, { val: number, text: string }> = {
    3: { val: LN3, text: 'ln 3' },
    8: { val: 3 * LN2, text: '3 ln 2' },
    9: { val: 2 * LN3, text: '2 ln 3' },
    12: { val: 2 * LN2 + LN3, text: '2 ln 2 + ln 3' },
    16: { val: 4 * LN2, text: '4 ln 2' },
    24: { val: 3 * LN2 + LN3, text: '3 ln 2 + ln 3' },
  };
  const lnDet3 = lnDetTable[det3].val;
  const lnDet3Text = lnDetTable[det3].text;
  const ans3 = -0.5 * lnDet3;

  // --- Card 4: data-fit ---
  const c4Pairs = [[2, 1], [2, -1], [3, 1], [3, -1], [3, 2], [3, -2], [4, 2], [4, -2], [5, 3], [5, -3]];
  const ys = [-3, -2, -1, 1, 2, 3];
  const [c4, y1_4, y2_4] = retry(() => [c4Pairs[g.random(0, 9)], g.pick(ys), g.pick(ys)] as [number[], number, number], ([pr, p1, p2]) => {
    const [a, b] = pr; const d = a * a - b * b; const sq = p1 * p1 + p2 * p2, cr = 2 * b * p1 * p2;
    const numer = a * sq - cr; const ans = -numer / (2 * d);
    if (![1, 2, 4, 5, 8, 10].includes(reducedDen(numer, 2 * d))) return false;
    return clear(ans, [2 * ans, -ans, -0.5 * (a * sq + cr), -sq / (2 * a), -(a * sq + cr) / (2 * d), -0.5 * (a * sq - cr), -sq / (2 * d)]);
  });
  const a4 = c4[0], b4 = c4[1];
  const det4 = a4 * a4 - b4 * b4;
  const q4 = (a4 * (y1_4 * y1_4 + y2_4 * y2_4) - 2 * b4 * y1_4 * y2_4) / det4;
  const ans4 = -q4 / 2;
  const yCy4 = -0.5 * (a4 * (y1_4 * y1_4 + y2_4 * y2_4) + 2 * b4 * y1_4 * y2_4);

  // --- Card 5: occam ---
  const N5 = g.random(3, 8);
  // integer units: L in tenths (0.6, 0.8, ..., 3.0), q in halves (0.5, 1, ..., 6)
  const [LAi, LBi, qAi, qBi] = retry(() => [6 + 2 * g.random(0, 12), 6 + 2 * g.random(0, 12), g.random(1, 12), g.random(1, 12)], ([la, lb, qa, qb]) => {
    const dl = (la - lb) / 10, dqq = (qa - qb) / 2;
    if (Math.abs(la - lb) < 4 || dl * dqq >= 0) return false;
    const ans = -(dl + dqq) / 2;
    if (Math.abs((la - lb) + 5 * (qa - qb)) < 2) return false; // |answer| >= 0.1, in exact integer units
    return clear(ans, [-(dl + dqq), (dl + dqq) / 2, -dl / 2, -dqq / 2, (-dl + dqq) / 2, -(la + lb) / 20 - (qa + qb) / 4]);
  });
  const LA = LAi / 10, LB = LBi / 10, qA = qAi / 2, qB = qBi / 2;
  const dL = LA - LB;
  const dq = qA - qB;
  const ans5 = -(dL + dq) / 2;
  const pen5 = -dL / 2;
  const fit5 = -dq / 2;
  const verdict = ans5 > 0
    ? t('Model A has the higher log marginal likelihood: its better fit outweighs its larger penalty.', '模型 A 的对数边际似然更高：更好的拟合抵得过更大的惩罚。')
    : t('Model B has the higher log marginal likelihood: the extra fit of A does not pay for its penalty.', '模型 B 的对数边际似然更高：A 多出的拟合抵不过它的惩罚。');

  // --- Card 6: assume ---
  const isSingular = g.random(0, 1) === 0;
  const k6 = g.random(1, 4);
  const c6 = (g.random(0, 1) === 0 ? 1 : -1) * k6;
  const s6 = isSingular ? 0 : g.random(1, 3);
  const d6 = s6 * (2 * k6 + s6);
  const assumeOptions = isSingular
    ? [
        t(`|C| = 0, so ln|C| = −∞ and the log marginal likelihood does not exist.`, `|C| = 0，所以 ln|C| = −∞，对数边际似然不存在。`),
        t(`ln|C| is finite: |C| = ${dec(k6)} · ${dec(k6)} = ${dec(k6 * k6)}, the product of the two diagonal entries.`, `ln|C| 有限：|C| = ${dec(k6)} · ${dec(k6)} = ${dec(k6 * k6)}，即两个对角元的乘积。`),
        t('ln|C| = 0, because |C| = 0 and ln 0 = 0.', 'ln|C| = 0，因为 |C| = 0 且 ln 0 = 0。'),
        t('ln|C| is finite: K is a valid kernel matrix, so its determinant and |C| are always positive.', 'ln|C| 有限：K 是合法的核矩阵，所以它的行列式和 |C| 永远为正。'),
      ]
    : [
        t(`ln|C| is finite: |C| = ${dec(d6)} > 0, because σ² = ${dec(s6)} lifts the zero eigenvalue of K to ${dec(s6)}.`, `ln|C| 有限：|C| = ${dec(d6)} > 0，因为 σ² = ${dec(s6)} 把 K 的零特征值抬高到 ${dec(s6)}。`),
        t(`ln|C| = −∞: K is singular, so |C| = 0 whatever the noise variance σ² is.`, `ln|C| = −∞：K 是奇异矩阵，所以无论噪声方差 σ² 取何值，|C| = 0。`),
        t(`ln|C| is finite: |C| = |K| + σ² = ${dec(s6)}, because adding σ²I adds σ² to the determinant |K| = 0 of K.`, `ln|C| 有限：|C| = |K| + σ² = ${dec(s6)}，因为加上 σ²I 就是把 σ² 加到 K 的行列式 |K| = 0 上。`),
        t(`ln|C| is finite: |C| = (${dec(k6)} + ${dec(s6)})² = ${dec((k6 + s6) * (k6 + s6))}, the product of the two diagonal entries.`, `ln|C| 有限：|C| = (${dec(k6)} + ${dec(s6)})² = ${dec((k6 + s6) * (k6 + s6))}，即两个对角元的乘积。`),
      ];
  const assumeCorrect = 0;

  // --- Card 7: cholesky ---
  const lnl = (x: number) => x === 1 ? '0' : x === 2 ? '0.693' : '1.099';
  const [l11, l22, l21, v1, v2] = retry(() => [g.pick([1, 2, 3]), g.pick([1, 2, 3]), g.pick([-2, -1, 1, 2]), g.pick([-2, -1, 1, 2]), g.pick([-2, -1, 1, 2])], ([p11, p22, p21, w1, w2]) => {
    if ((p11 === 1 && p22 === 1) || (p11 === 3 && p22 === 3)) return false;
    const ln = lnOfInt(p11 * p22) * 2 / 1; // 2 (ln l11 + ln l22)
    const q = w1 * w1 + w2 * w2;
    const y1 = p11 * w1, y2 = p21 * w1 + p22 * w2;
    const t2 = y2 / p22, t1 = (y1 - p21 * t2) / p11;
    return clear(ln, [ln / 2, -ln, 2 * ln]) && clear(q, [(y1 / p11) ** 2 + (y2 / p22) ** 2, y1 * y1 + y2 * y2, Math.sqrt(q), t1 * t1 + t2 * t2]);
  });
  const y1_7 = l11 * v1;
  const y2_7 = l21 * v1 + l22 * v2;
  const lnC7 = 2 * (Number(lnl(l11)) + Number(lnl(l22)));
  const qq7 = v1 * v1 + v2 * v2;
  const wrongq7 = (y1_7 / l11) ** 2 + (y2_7 / l22) ** 2;

  // --- Card 8: challenge ---
  const c8Rows = [[2, 1, 1], [2, -1, 1], [2, 1, 3], [2, -1, 3], [3, 2, 1], [3, -2, 1], [3, 1, 2], [3, -1, 2], [4, 3, 1], [4, -3, 1], [4, 1, 1], [4, -1, 1]];
  const [c8, y1_8, y2_8] = retry(() => [c8Rows[g.random(0, 11)], g.pick(ys), g.pick(ys)] as [number[], number, number], ([row, p1, p2]) => {
    const [k, b, s0] = row; const a = k + s0; const d = a * a - b * b; const sq = p1 * p1 + p2 * p2, cr = 2 * b * p1 * p2;
    const numer = a * sq - cr; const q = numer / d;
    if (![1, 2, 4, 5, 8, 10].includes(reducedDen(numer, 2 * d))) return false;
    const lnD = lnDetTable[d].val; const kd = k * k - b * b; const qK = (k * sq - cr) / kd; const lnK = Math.log(kd);
    const ans = -LN2PI - lnD / 2 - q / 2;
    return clear(ans, [-LN2PI - lnD - q / 2, -LN2PI - lnD / 2 - q, -LN2PI + lnD / 2 - q / 2, -lnD / 2 - q / 2, -2 * LN2PI - lnD / 2 - q / 2,
      -LN2PI - lnK / 2 - qK / 2, -LN2PI - lnD / 2 - qK / 2, -LN2PI - lnD / 2 - 0.5 * (a * sq + cr), -LN2PI - lnD / 2 - 0.5 * (a * sq + cr) / d,
      -LN2PI - lnD / 2 + q / 2, -q / 2, -lnD / 2]);
  });
  const k8 = c8[0], b8 = c8[1], s8 = c8[2];
  const a8 = k8 + s8;
  const det8 = a8 * a8 - b8 * b8;
  const q8 = (a8 * (y1_8 * y1_8 + y2_8 * y2_8) - 2 * b8 * y1_8 * y2_8) / det8;
  const lnDet8 = lnDetTable[det8].val;
  const lnDet8Text = lnDetTable[det8].text;
  const ans8 = -LN2PI - 0.5 * lnDet8 - q8 / 2;

  return [
    g.choice({
      id: 'roles',
      title: t('What moves which term', '哪一项随什么变化'),
      prompt: t(
        `A GP regression model has N = ${dec(N1)} training points. Its log marginal likelihood is ln p(y | θ) = −(N/2) ln 2π − ½ ln|C| − ½ yᵀC⁻¹y, with C = K + σ²I and K built from the kernel and the inputs. ${v.setup[0]} Which terms of ln p(y | θ) depend on ${v.Q[0]}?`,
        `一个 GP 回归模型有 N = ${dec(N1)} 个训练点，其对数边际似然为 ln p(y | θ) = −(N/2) ln 2π − ½ ln|C| − ½ yᵀC⁻¹y，其中 C = K + σ²I，K 由核函数和输入构成。${v.setup[1]}ln p(y | θ) 的哪些项依赖于${v.Q[1]}？`
      ),
      options: rolesOptions,
      correct: v.correct,
      hint: t('Write each term as a function of its ingredients (N, K, σ², y) and ask where the changed quantity enters.', '把每一项看作它的原料（N、K、σ²、y）的函数，再问被改变的量出现在哪里。'),
      explanation: t(
        `${v.why[0]} (Lecture 3 p. 40; GPML pdf p. 131, eq. 5.8, the data fit is the only term involving the targets). This game does not assess maximising ln p(y | θ) over θ.`,
        `${v.why[1]}（第 3 讲第 40 页；GPML 第 131 页式 5.8，数据拟合项是唯一含目标值的项）。本游戏不考查对 θ 最大化 ln p(y | θ)。`
      ),
    }),
    g.number({
      id: 'const-term',
      title: t('The normalising constant', '归一化常数'),
      prompt: t(
        `A GP regression data set has N = ${dec(N2)} points. Use ln 2π ≈ 1.838. What is the normalising constant term −(N/2) ln 2π of the log marginal likelihood? Give a decimal rounded to 2 places.`,
        `一个 GP 回归数据集有 N = ${dec(N2)} 个点。取 ln 2π ≈ 1.838。对数边际似然中的归一化常数项 −(N/2) ln 2π 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('normalising constant', '归一化常数'), answer: ans2, tolerance: 0.006 }],
      hint: t('Each data point contributes the same amount to this term.', '每个数据点对这一项的贡献相同。'),
      explanation: t(
        `−(N/2) ln 2π = −(${dec(N2)}/2) · 1.838 = ${num(ans2)}, about ${num(Math.round(ans2 * 100) / 100)}. Each of the ${dec(N2)} points contributes −½ ln 2π = −0.919. Forgetting the ½ gives ${num(-N2 * 1.838)}. This term contains only N: it does not depend on K, σ² or y (Lecture 3 p. 40, eq. 54). This game does not assess the derivation of the Gaussian density.`,
        `−(N/2) ln 2π = −(${dec(N2)}/2) · 1.838 = ${num(ans2)}，约为 ${num(Math.round(ans2 * 100) / 100)}。${dec(N2)} 个点中每个点贡献 −½ ln 2π = −0.919。漏掉 ½ 会得到 ${num(-N2 * 1.838)}。这一项只含 N，与 K、σ²、y 无关（第 3 讲第 40 页，式 54）。本游戏不考查高斯密度的推导。`
      ),
      audit: { kind: 'GP-10:const-term', params: { N: N2 } },
    }),
    g.number({
      id: 'complexity',
      title: t('The complexity penalty', '复杂度惩罚项'),
      prompt: t(
        `The targets have covariance C = ${mat([[num(a3), num(b3)], [num(b3), num(a3)]])} (noise already included). Use ln 2 ≈ 0.693 and ln 3 ≈ 1.099. What is the complexity penalty −½ ln|C|, where |C| is the determinant of C? Give a decimal rounded to 2 places.`,
        `目标值的协方差为 C = ${mat([[num(a3), num(b3)], [num(b3), num(a3)]])}（已包含噪声）。取 ln 2 ≈ 0.693，ln 3 ≈ 1.099。复杂度惩罚项 −½ ln|C| 是多少，其中 |C| 是 C 的行列式？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('−½ ln|C|', '−½ ln|C|'), answer: ans3, tolerance: 0.006 }],
      hint: t('Find |C| first (for a 2 × 2 matrix, a·d − b·c); then use the printed logarithms, remembering that the logarithm of a product is a sum.', '先求 |C|（2 × 2 矩阵为 a·d − b·c），再用题中给出的对数值，并记住乘积的对数等于对数之和。'),
      explanation: t(
        `|C| = ${dec(a3)}·${dec(a3)} − ${par(b3)}·${par(b3)} = ${dec(a3 * a3)} − ${dec(b3 * b3)} = ${dec(det3)}. ln ${dec(det3)} = ${det3 === 3 ? '' : dec(lnDet3Text) + ' = '}${dec(lnDet3)}, so −½ ln|C| = −½ · ${dec(lnDet3)} = ${dec(ans3)}. Dropping the ½ gives ${dec(-lnDet3)}; keeping the determinant without its logarithm gives ${dec(-det3 / 2)} (Lecture 3 p. 40). A larger determinant means a more flexible model and a larger penalty. This game does not assess evaluating kernels.`,
        `|C| = ${dec(a3)}·${dec(a3)} − ${par(b3)}·${par(b3)} = ${dec(a3 * a3)} − ${dec(b3 * b3)} = ${dec(det3)}。ln ${dec(det3)} = ${det3 === 3 ? '' : dec(lnDet3Text) + ' = '}${dec(lnDet3)}，所以 −½ ln|C| = −½ · ${dec(lnDet3)} = ${dec(ans3)}。漏掉 ½ 会得到 ${dec(-lnDet3)}；不取对数会得到 ${dec(-det3 / 2)}（第 3 讲第 40 页）。行列式越大，模型越灵活，惩罚越大。本游戏不考查核函数的取值。`
      ),
      audit: { kind: 'GP-10:complexity', params: { a: a3, b: b3 } },
    }),
    g.number({
      id: 'data-fit',
      title: t('The data-fit term', '数据拟合项'),
      prompt: t(
        `The targets are y = (${num(y1_4)}, ${num(y2_4)})ᵀ and their covariance is C = ${mat([[num(a4), num(b4)], [num(b4), num(a4)]])}. What is the data-fit term −½ yᵀC⁻¹y? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `目标值 y = (${num(y1_4)}, ${num(y2_4)})ᵀ，其协方差 C = ${mat([[num(a4), num(b4)], [num(b4), num(a4)]])}。数据拟合项 −½ yᵀC⁻¹y 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('−½ yᵀC⁻¹y', '−½ yᵀC⁻¹y'), answer: ans4, tolerance: 0.006 }],
      hint: t('Invert C first: swap the diagonal entries, change the sign of the off-diagonal entries and divide by the determinant. Then multiply out in two steps.', '先求 C 的逆：交换对角元，非对角元变号，再除以行列式。然后分两步相乘。'),
      explanation: t(
        `|C| = ${dec(a4)}² − ${par(b4)}² = ${dec(det4)}, so C⁻¹ = (1/${dec(det4)}) · ${mat([[num(a4), num(-b4)], [num(-b4), num(a4)]])}. Then C⁻¹y = (1/${dec(det4)}) · (${dec(a4)}·${par(y1_4)} − ${par(b4)}·${par(y2_4)}, −${par(b4)}·${par(y1_4)} + ${dec(a4)}·${par(y2_4)}) = (1/${dec(det4)}) · (${dec(a4 * y1_4 - b4 * y2_4)}, ${dec(-b4 * y1_4 + a4 * y2_4)}), and yᵀC⁻¹y = (1/${dec(det4)}) · (${par(y1_4)}·${par(a4 * y1_4 - b4 * y2_4)} + ${par(y2_4)}·${par(-b4 * y1_4 + a4 * y2_4)}) = ${exact(q4)}. So −½ yᵀC⁻¹y = ${exact(ans4)} (Lecture 3 p. 40, eq. 54). Using C instead of C⁻¹ would give ${exact(yCy4)}. This game does not assess the determinant term.`,
        `|C| = ${dec(a4)}² − ${par(b4)}² = ${dec(det4)}，所以 C⁻¹ = (1/${dec(det4)}) · ${mat([[num(a4), num(-b4)], [num(-b4), num(a4)]])}。于是 C⁻¹y = (1/${dec(det4)}) · (${dec(a4)}·${par(y1_4)} − ${par(b4)}·${par(y2_4)}, −${par(b4)}·${par(y1_4)} + ${dec(a4)}·${par(y2_4)}) = (1/${dec(det4)}) · (${dec(a4 * y1_4 - b4 * y2_4)}, ${dec(-b4 * y1_4 + a4 * y2_4)})，yᵀC⁻¹y = (1/${dec(det4)}) · (${par(y1_4)}·${par(a4 * y1_4 - b4 * y2_4)} + ${par(y2_4)}·${par(-b4 * y1_4 + a4 * y2_4)}) = ${exact(q4)}。所以 −½ yᵀC⁻¹y = ${exact(ans4)}（第 3 讲第 40 页，式 54）。用 C 代替 C⁻¹ 会得到 ${exact(yCy4)}。本游戏不考查行列式项。`
      ),
      audit: { kind: 'GP-10:data-fit', params: { a: a4, b: b4, y1: y1_4, y2: y2_4 } },
    }),
    g.number({
      id: 'occam',
      title: t('Fit against complexity', '拟合与复杂度的权衡'),
      prompt: t(
        `Two GP models A and B explain the same N = ${dec(N5)} targets y. Model A has ln|C_A| = ${num(LA)} and yᵀC_A⁻¹y = ${num(qA)}. Model B has ln|C_B| = ${num(LB)} and yᵀC_B⁻¹y = ${num(qB)}. What is ln p(y | A) − ln p(y | B)? Give a decimal rounded to 2 places.`,
        `两个 GP 模型 A 和 B 解释同样的 N = ${dec(N5)} 个目标值 y。模型 A：ln|C_A| = ${num(LA)}，yᵀC_A⁻¹y = ${num(qA)}。模型 B：ln|C_B| = ${num(LB)}，yᵀC_B⁻¹y = ${num(qB)}。ln p(y | A) − ln p(y | B) 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ln p(y | A) − ln p(y | B)', 'ln p(y | A) − ln p(y | B)'), answer: ans5, tolerance: 0.006 }],
      hint: t('Write ln p for each model with the same three terms, then subtract.', '把两个模型的 ln p 各自写成同样的三项，再相减。'),
      explanation: t(
        `Each model has ln p = −(N/2) ln 2π − ½ ln|C| − ½ yᵀC⁻¹y. The first term is the same for A and B (same N), so it cancels. Penalty difference: −½(${num(LA)} − ${par(LB)}) = ${num(pen5)}. Data-fit difference: −½(${num(qA)} − ${par(qB)}) = ${num(fit5)}. Total: ${num(pen5)} + ${par(fit5)} = ${num(ans5)}. ${dec(verdict[0]).slice(0, -1)} (Lecture 3 p. 38: the marginal likelihood implements Occam's razor; GPML pdf p. 131, Fig. 5.3). This game does not assess choosing θ by gradient ascent.`,
        `每个模型的 ln p = −(N/2) ln 2π − ½ ln|C| − ½ yᵀC⁻¹y。第一项对 A 和 B 相同（N 相同），相减时抵消。惩罚项之差：−½(${num(LA)} − ${par(LB)}) = ${num(pen5)}。数据拟合项之差：−½(${num(qA)} − ${par(qB)}) = ${num(fit5)}。合计：${num(pen5)} + ${par(fit5)} = ${num(ans5)}。${dec(verdict[1]).slice(0, -1)}（第 3 讲第 38 页：边际似然体现奥卡姆剃刀；GPML 第 131 页图 5.3）。本游戏不考查用梯度上升选择 θ。`
      ),
      audit: { kind: 'GP-10:occam', params: { N: N5, LA: LA, LB: LB, qA: qA, qB: qB } },
    }),
    g.choice({
      id: 'assume',
      title: t('When ln|C| breaks', 'ln|C| 何时失效'),
      prompt: t(
        `Two noisy targets have noise-free covariance K = ${mat([[num(k6), num(c6)], [num(c6), num(k6)]])}, a valid kernel matrix (symmetric and positive semi-definite), and noise variance σ² = ${dec(s6)}. The log marginal likelihood is ln N(y | 0, C) with C = K + σ²I. Which statement about ln|C| is correct?`,
        `两个带噪声的目标值，其无噪声协方差为 K = ${mat([[num(k6), num(c6)], [num(c6), num(k6)]])}，这是一个合法的核矩阵（对称且半正定），噪声方差 σ² = ${dec(s6)}。对数边际似然为 ln N(y | 0, C)，其中 C = K + σ²I。关于 ln|C|，下列哪条说法正确？`
      ),
      options: assumeOptions,
      correct: assumeCorrect,
      hint: t('What happens to the eigenvalues of K when σ²I is added?', '加上 σ²I 之后，K 的特征值会怎样？'),
      explanation: t(
        isSingular
          ? `K = ${mat([[num(k6), num(c6)], [num(c6), num(k6)]])} has eigenvalues 0 and ${dec(2 * k6)}, and σ² = 0 adds nothing, so |C| = ${dec(k6)} · ${dec(k6)} − ${par(c6)} · ${par(c6)} = 0. Then ln|C| = −∞ and ln N(y | 0, C) is not defined, even though K is a valid kernel matrix; the noise term σ²I is what makes C positive definite (Lecture 3 p. 39: C = σ²I + K; Assignment 2 Task 4c adds a jitter of 10⁻⁸). This game does not assess testing whether a general matrix is a valid kernel.`
          : `K = ${mat([[num(k6), num(c6)], [num(c6), num(k6)]])} has eigenvalues 0 and ${dec(2 * k6)}. Adding σ²I = ${s6 === 1 ? "" : s6}I raises every eigenvalue by ${dec(s6)}: C has eigenvalues ${dec(s6)} and ${dec(2 * k6 + s6)}, so |C| = ${dec(s6)} · ${dec(2 * k6 + s6)} = ${dec(d6)} > 0 and ln|C| is finite. The determinant is not |K| + σ² (that would be ${dec(s6)}) and not the product of the diagonal (${dec((k6 + s6) * (k6 + s6))}), because the off-diagonal entries matter. (Cholesky needs a positive definite C; Assignment 2 Task 4c adds a jitter of 10⁻⁸ for the same reason.) This game does not assess testing whether a general matrix is a valid kernel.`,
        isSingular
          ? `K = ${mat([[num(k6), num(c6)], [num(c6), num(k6)]])} 的特征值为 0 和 ${dec(2 * k6)}，σ² = 0 不增加任何东西，所以 |C| = ${dec(k6)} · ${dec(k6)} − ${par(c6)} · ${par(c6)} = 0。于是 ln|C| = −∞，ln N(y | 0, C) 无定义，尽管 K 是合法的核矩阵；使 C 正定的正是噪声项 σ²I（第 3 讲第 39 页：C = σ²I + K；作业 2 任务 4c 加上 10⁻⁸ 的抖动）。本游戏不考查如何判断一般矩阵是否为合法的核矩阵。`
          : `K = ${mat([[num(k6), num(c6)], [num(c6), num(k6)]])} 的特征值为 0 和 ${dec(2 * k6)}。加上 σ²I = ${s6 === 1 ? "" : s6}I 使每个特征值增加 ${dec(s6)}：C 的特征值为 ${dec(s6)} 和 ${dec(2 * k6 + s6)}，所以 |C| = ${dec(s6)} · ${dec(2 * k6 + s6)} = ${dec(d6)} > 0，ln|C| 有限。行列式不是 |K| + σ²（那会得到 ${dec(s6)}），也不是对角元之积（${dec((k6 + s6) * (k6 + s6))}），因为非对角元也起作用。（Cholesky 分解需要 C 正定；作业 2 任务 4c 加上 10⁻⁸ 的抖动正是为此。）本游戏不考查如何判断一般矩阵是否为合法的核矩阵。`
      ),
    }),
    g.number({
      id: 'cholesky',
      title: t('From the Cholesky factor', '由 Cholesky 因子求值'),
      prompt: t(
        `C = LLᵀ, where the lower-triangular factor is L = ${mat([[num(l11), '0'], [num(l21), num(l22)]])}. Use ln 2 ≈ 0.693 and ln 3 ≈ 1.099. The targets are y = (${num(y1_7)}, ${num(y2_7)})ᵀ. Without forming C or C⁻¹, find ln|C| and yᵀC⁻¹y. Give decimals rounded to 2 places (the second one is an integer).`,
        `C = LLᵀ，其中下三角因子 L = ${mat([[num(l11), '0'], [num(l21), num(l22)]])}。取 ln 2 ≈ 0.693，ln 3 ≈ 1.099。目标值 y = (${num(y1_7)}, ${num(y2_7)})ᵀ。不要构造 C 或 C⁻¹，求 ln|C| 和 yᵀC⁻¹y。请填保留 2 位小数的小数（第二个是整数）。`
      ),
      fields: [
        { label: t('ln|C|', 'ln|C|'), answer: lnC7, tolerance: 0.006 },
        { label: t('yᵀC⁻¹y', 'yᵀC⁻¹y'), answer: qq7, tolerance: 0.006 },
      ],
      hint: t('Use C = LLᵀ: the determinant of a product is the product of the determinants. For the second quantity, first solve the triangular system L v = y.', '利用 C = LLᵀ：乘积的行列式等于行列式的乘积。对于第二个量，先解三角方程组 L v = y。'),
      explanation: t(
        `|C| = |L| · |Lᵀ| = (${dec(l11)} · ${dec(l22)})² = ${dec((l11 * l22) * (l11 * l22))}, so ln|C| = 2 (ln ${dec(l11)} + ln ${dec(l22)}) = 2 (${dec(lnl(l11))} + ${dec(lnl(l22))}) = ${dec(lnC7)} (Lecture 3 p. 43, eq. 59). Forward substitution in L v = y: v₁ = ${dec(y1_7)}/${dec(l11)} = ${dec(v1)}, v₂ = (${dec(y2_7)} − ${par(l21)} · ${par(r4(v1))})/${dec(l22)} = ${dec(v2)}. Then yᵀC⁻¹y = vᵀv = ${par(r4(v1))}² + ${par(r4(v2))}² = ${dec(qq7)} (eq. 60). Forgetting the factor 2 gives ${dec(lnC7 / 2)}; ignoring the off-diagonal l₂₁ gives ${exact(wrongq7)}. This game does not assess the operation count of the Cholesky factorisation.`,
        `|C| = |L| · |Lᵀ| = (${dec(l11)} · ${dec(l22)})² = ${dec((l11 * l22) * (l11 * l22))}，所以 ln|C| = 2 (ln ${dec(l11)} + ln ${dec(l22)}) = 2 (${dec(lnl(l11))} + ${dec(lnl(l22))}) = ${dec(lnC7)}（第 3 讲第 43 页，式 59）。对 L v = y 做前代：v₁ = ${dec(y1_7)}/${dec(l11)} = ${dec(v1)}，v₂ = (${dec(y2_7)} − ${par(l21)} · ${par(r4(v1))})/${dec(l22)} = ${dec(v2)}。于是 yᵀC⁻¹y = vᵀv = ${par(r4(v1))}² + ${par(r4(v2))}² = ${dec(qq7)}（式 60）。漏掉因子 2 会得到 ${dec(lnC7 / 2)}；忽略非对角元 l₂₁ 会得到 ${exact(wrongq7)}。本游戏不考查 Cholesky 分解的运算量。`
      ),
      audit: { kind: 'GP-10:cholesky', params: { l11: l11, l21: l21, l22: l22, y1: y1_7, y2: y2_7 } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the full log marginal likelihood', '挑战：完整的对数边际似然'),
      prompt: t(
        `N = 2 noisy targets y = (${num(y1_8)}, ${num(y2_8)})ᵀ are modelled by a zero-mean GP with noise-free covariance K = ${mat([[num(k8), num(b8)], [num(b8), num(k8)]])} and noise variance σ² = ${dec(s8)}. Use ln 2 ≈ 0.693, ln 3 ≈ 1.099 and ln 2π ≈ 1.838. What is the log marginal likelihood ln p(y | θ)? Give a decimal rounded to 2 places.`,
        `N = 2 个带噪声的目标值 y = (${num(y1_8)}, ${num(y2_8)})ᵀ 由零均值 GP 建模，无噪声协方差 K = ${mat([[num(k8), num(b8)], [num(b8), num(k8)]])}，噪声方差 σ² = ${dec(s8)}。取 ln 2 ≈ 0.693，ln 3 ≈ 1.099，ln 2π ≈ 1.838。对数边际似然 ln p(y | θ) 是多少？请填保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ln p(y | θ)', 'ln p(y | θ)'), answer: ans8, tolerance: 0.006 }],
      hint: t('Build C from K and σ² first, then take the three terms one at a time.', '先由 K 和 σ² 构造 C，再逐项计算三项。'),
      explanation: t(
        `C = K + σ²I = ${mat([[num(a8), num(b8)], [num(b8), num(a8)]])} with a = ${dec(k8)} + ${dec(s8)} = ${dec(a8)}. Normalising constant: −(2/2) · 1.838 = −1.838. |C| = ${dec(a8)}² − ${par(b8)}² = ${dec(det8)}, ln ${dec(det8)} = ${dec(lnDet8Text)} = ${dec(lnDet8)}, so −½ ln|C| = ${dec(-lnDet8 / 2)}. C⁻¹ = (1/${dec(det8)}) · ${mat([[num(a8), num(-b8)], [num(-b8), num(a8)]])}, yᵀC⁻¹y = ${exact(q8)}, so the data fit is −½ · ${exact(q8)} = ${exact(-q8 / 2)}. Total: −1.838 + ${par(r4(-lnDet8 / 2))} + (${exact(-q8 / 2)}) = ${dec(ans8)} (Lecture 3 p. 40, eq. 54). Using K instead of C would ignore the noise. This game does not assess maximising over θ.`,
        `C = K + σ²I = ${mat([[num(a8), num(b8)], [num(b8), num(a8)]])}，其中 a = ${dec(k8)} + ${dec(s8)} = ${dec(a8)}。归一化常数：−(2/2) · 1.838 = −1.838。|C| = ${dec(a8)}² − ${par(b8)}² = ${dec(det8)}，ln ${dec(det8)} = ${dec(lnDet8Text)} = ${dec(lnDet8)}，所以 −½ ln|C| = ${dec(-lnDet8 / 2)}。C⁻¹ = (1/${dec(det8)}) · ${mat([[num(a8), num(-b8)], [num(-b8), num(a8)]])}，yᵀC⁻¹y = ${exact(q8)}，数据拟合项为 −½ · ${exact(q8)} = ${exact(-q8 / 2)}。合计：−1.838 + ${par(r4(-lnDet8 / 2))} + (${exact(-q8 / 2)}) = ${dec(ans8)}（第 3 讲第 40 页，式 54）。用 K 代替 C 会忽略噪声。本游戏不考查对 θ 最大化。`
      ),
      audit: { kind: 'GP-10:challenge', params: { k: k8, b: b8, s: s8, y1: y1_8, y2: y2_8 } },
    }),
  ];
};
