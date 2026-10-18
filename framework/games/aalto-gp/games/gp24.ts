import type { CardGenerator } from '../../types';
import { exact, makeGpDeck, num, par, type Text } from '../support';

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

// Sampling spaces: every space of the plan is enumerated once at module load (explicit lists and exact predicates, guards included),
// then a card draws one entry with g.pick, so every listed set is reachable and nothing outside the plan is drawn.
const SIX = [-3, -2, -1, 1, 2, 3];
const apart = (truth: number, routes: number[], gap: number): boolean => routes.every(r => Math.abs(r - truth) >= gap - 1e-9);
const denominatorOf = (v: number): number => { for (let d = 1; d <= 1000; d++) if (Math.abs(v * d - Math.round(v * d)) < 1e-9 * d) return d; return Infinity; };

const SPACE5: { g: number; u: number; x: number; xp: number }[] = [];
for (const [gg, uu] of [[1, 2], [2, 4], [1, 0.5], [2, 1], [4, 2]]) for (let x = -3; x <= 3; x++) for (let xp = -3; xp <= 3; xp++) {
  if (x === xp) continue;
  const ss = 2 * gg + gg * gg / uu, sm = 2 * uu + gg, d = x - xp;
  const T = -x * x / (2 * sm) - d * d / (2 * ss) - xp * xp / (2 * sm);
  if (![1, 2, 4, 5, 10].includes(denominatorOf(T))) continue;
  const routes = [
    -x * x / (2 * ss) - d * d / (2 * sm) - xp * xp / (2 * ss), -x * x / (2 * sm) - xp * xp / (2 * sm), -d * d / (2 * ss), -(x * x + d * d + xp * xp) / (2 * gg),
    -x * x / (4 * uu) - d * d / (2 * ss) - xp * xp / (4 * uu), -x * x / sm - d * d / ss - xp * xp / sm, -x * x / (2 * sm) - d * d / (2 * ss),
  ];
  if (apart(T, routes, 0.1)) SPACE5.push({ g: gg, u: uu, x, xp });
}
type Ntk2 = { p1: number; p2: number; v1: number; v2: number; x: number; y: number };
const SPACE6: Ntk2[] = [], SPACE7: Ntk2[] = [];
for (const p1 of SIX) for (const p2 of SIX) for (const v1 of SIX) for (const v2 of SIX) for (const x of SIX) for (const y of SIX) {
  if (p1 * p2 >= 0 || x * y <= 0 || x * y > 6) continue;
  const first = p1 * x > 0, pa = first ? p1 : p2, va = first ? v1 : v2, xy = x * y;
  if (va * va !== 1 && va * va !== pa * pa && apart(0.5 * pa * pa * xy, [pa * pa * xy, 0.5 * (p1 * p1 + p2 * p2) * xy, 0.5 * va * va * pa * pa * xy, 0.5 * va * va * xy], 0.5)) SPACE6.push({ p1, p2, v1, v2, x, y });
  if (xy !== 1 && va !== 1 && pa * pa !== va * va && apart(0.5 * va * va * xy, [va * va * xy, 0.5 * va * va, 0.5 * (v1 * v1 + v2 * v2) * xy, 0.5 * va * xy, 0.5 * pa * pa * xy], 0.5)) SPACE7.push({ p1, p2, v1, v2, x, y });
}
/** The challenge space has 655 360 sets: it is walked as one index into the 4⁸·36 grid with a rejection loop, so every admissible set can be reached. */
const FOUR = [-2, -1, 1, 2];
const GRID9 = 4 ** 8 * 36;
function decode9(index: number) {
  let r = index;
  const x = SIX[r % 6]; r = Math.floor(r / 6);
  const y = SIX[r % 6]; r = Math.floor(r / 6);
  const w: number[] = [];
  for (let k = 0; k < 8; k++) { w.push(FOUR[r % 4]); r = Math.floor(r / 4); }
  return { P: w.slice(0, 4), V: w.slice(4), x, y };
}
const ok9 = (d: { P: number[]; V: number[]; x: number; y: number }) => {
  if (d.x * d.y <= 0) return false;
  const act = [0, 1, 2, 3].filter(j => d.P[j] * d.x > 0);
  if (act.length < 1 || act.length > 3) return false;
  const xy = d.x * d.y;
  const sp = act.reduce((s, j) => s + d.P[j] ** 2, 0), sv = act.reduce((s, j) => s + d.V[j] ** 2, 0);
  const T = (xy * (sp + sv)) / 4;
  if (![1, 2, 4].includes(denominatorOf(T))) return false;
  const k1 = (xy * sp) / 4, k0 = (xy * sv) / 4;
  const all = (xy * (d.P.reduce((s, p) => s + p * p, 0) + d.V.reduce((s, v) => s + v * v, 0))) / 4;
  const routes = [k1, k0, all, 4 * T, k1 + act.reduce((s, j) => s + d.V[j], 0) * xy / 4, k1 + sv / 4, act.reduce((s, j) => s + d.V[j] ** 2 * d.P[j] ** 2, 0) * xy / 4 + k0];
  return apart(T, routes, 0.5);
};

export const gp24: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-24');
  warm(g);

  // --- Card 1: bnn-limit ---
  const acts = ['ReLU', 'step', 'sigmoid'];
  const act1 = g.pick(acts);
  const K1_1 = g.pick([100, 10000]);
  const actName1 = lang === 'zh' ? (act1 === 'ReLU' ? '线性整流函数' : act1 === 'step' ? '阶跃函数' : '误差函数型饱和函数') : act1;

  // --- Card 2: toy-kernel ---
  const sb2_2 = g.pick([0.5, 1, 2]);
  const sw2_2 = g.pick([1, 2, 4]);
  const x_2 = g.pick([-3, -2, -1, 1, 2, 3]);
  const xp_2 = g.pick([-3, -2, -1, 1, 2, 3]);
  const E_2 = (x_2 * xp_2 > 0) ? (x_2 * xp_2) / 2 : 0;
  const T_2 = sb2_2 + sw2_2 * E_2;
  const a1_2 = Math.max(x_2, 0);
  const a1p_2 = Math.max(xp_2, 0);
  const a2_2 = Math.max(-x_2, 0);
  const a2p_2 = Math.max(-xp_2, 0);
  const prod1_2 = a1_2 * a1p_2;
  const prod2_2 = a2_2 * a2p_2;
  const extra_2 = (x_2 * xp_2 < 0)
    ? t(`The ReLU switches off one of the two inputs for each value of u, so the product is 0 both times and only the bias variance σ_b² = ${sb2_2} is left.`, `对 u 的每个取值，线性整流都会关掉两个输入中的一个，所以两次乘积都是 0，只剩偏置方差 σ_b² = ${sb2_2}。`)
    : t('', '');

  // --- Card 3: unscaled-var ---
  const sb2_3 = g.pick([0.5, 1]);
  const sw2_3 = g.pick([0.5, 1, 2]);
  const m_3 = g.pick([0.5, 1, 2]);
  const K1_3 = g.pick([4, 5, 8, 10]);
  const T_3 = sb2_3 + K1_3 * sw2_3 * m_3;

  // --- Card 4: act-kernel ---
  const form4 = g.pick(['A', 'B']);
  const item4 = g.pick(acts);
  const kernelPairs: Record<string, { en: string; zh: string }> = {
    'ReLU': { en: 'ArcCos-1 kernel', zh: '1 阶反余弦核' },
    'step': { en: 'ArcCos-0 kernel', zh: '0 阶反余弦核' },
    'sigmoid': { en: 'NN kernel', zh: '神经网络核' },
  };
  const actName4 = lang === 'zh' ? (item4 === 'ReLU' ? '线性整流函数' : item4 === 'step' ? '阶跃函数' : '误差函数型饱和函数') : item4;
  const kernelName4 = lang === 'zh' ? kernelPairs[item4].zh : kernelPairs[item4].en;

  // --- Card 5: gauss-bump ---
  const draw5 = g.pick(SPACE5);
  const g_5 = draw5.g, u_5 = draw5.u;
  const ss_5 = 2 * g_5 + (g_5 * g_5) / u_5;
  const sm_5 = 2 * u_5 + g_5;
  const x_5 = draw5.x, xp_5 = draw5.xp;
  const T_5 = -(x_5 * x_5) / (2 * sm_5) - ((x_5 - xp_5) * (x_5 - xp_5)) / (2 * ss_5) - (xp_5 * xp_5) / (2 * sm_5);
  const swapped_5 = -(x_5 * x_5) / (2 * ss_5) - ((x_5 - xp_5) * (x_5 - xp_5)) / (2 * sm_5) - (xp_5 * xp_5) / (2 * ss_5);

  // --- Card 6: ntk-out ---
  const draw6 = g.pick(SPACE6);
  const { p1: p1_6, p2: p2_6, v1: v1_6, v2: v2_6, x: x_6, y: y_6 } = draw6;
  let ia_6 = 1, ib_6 = 2, pa_6 = p1_6, pb_6 = p2_6, va_6 = v1_6;
  if (p1_6 * x_6 > 0) { ia_6 = 1; ib_6 = 2; pa_6 = p1_6; pb_6 = p2_6; va_6 = v1_6; }
  else { ia_6 = 2; ib_6 = 1; pa_6 = p2_6; pb_6 = p1_6; va_6 = v2_6; }
  const T_6 = 0.5 * pa_6 * pa_6 * x_6 * y_6;
  const linear_6 = 0.5 * (p1_6 * p1_6 + p2_6 * p2_6) * x_6 * y_6;

  // --- Card 7: ntk-in ---
  const draw7 = g.pick(SPACE7);
  const { p1: p1_7, p2: p2_7, v1: v1_7, v2: v2_7, x: x_7, y: y_7 } = draw7;
  let ia_7 = 1, ib_7 = 2, pa_7 = p1_7, pb_7 = p2_7, va_7 = v1_7;
  if (p1_7 * x_7 > 0) { ia_7 = 1; ib_7 = 2; pa_7 = p1_7; pb_7 = p2_7; va_7 = v1_7; }
  else { ia_7 = 2; ib_7 = 1; pa_7 = p2_7; pb_7 = p1_7; va_7 = v2_7; }
  const T_7 = 0.5 * va_7 * va_7 * x_7 * y_7;
  const va_xy_7 = 0.5 * va_7 * x_7 * y_7;
  const va2_only_7 = 0.5 * va_7 * va_7;

  // --- Card 8: ntk-lazy ---
  const act8 = g.pick(acts);
  const K_8 = g.pick([100, 10000]);
  const actName8 = lang === 'zh' ? (act8 === 'ReLU' ? '线性整流函数' : act8 === 'step' ? '阶跃函数' : '误差函数型饱和函数') : act8;

  // --- Card 9: challenge ---
  const d9 = retry(() => decode9(g.random(0, GRID9 - 1)), ok9);
  const [p1_9, p2_9, p3_9, p4_9] = d9.P;
  const [v1_9, v2_9, v3_9, v4_9] = d9.V;
  const x_9 = d9.x, y_9 = d9.y;
  const ps = [p1_9, p2_9, p3_9, p4_9];
  const vs = [v1_9, v2_9, v3_9, v4_9];
  const activeIdx: number[] = [];
  for (let j = 0; j < 4; j++) { if (ps[j] * x_9 > 0) activeIdx.push(j); }
  const na_9 = activeIdx.length;
  let sumP2 = 0, sumV2 = 0;
  for (const j of activeIdx) { sumP2 += ps[j] * ps[j]; sumV2 += vs[j] * vs[j]; }
  const T_9 = (x_9 * y_9 * (sumP2 + sumV2)) / 4;
  const k1_9 = (x_9 * y_9 * sumP2) / 4;
  const k0_9 = (x_9 * y_9 * sumV2) / 4;
  const allunits_9 = (x_9 * y_9 * (ps.reduce((s, p) => s + p * p, 0) + vs.reduce((s, v) => s + v * v, 0))) / 4;
  const sign_9 = x_9 > 0 ? (lang === 'zh' ? '正数' : 'positive') : (lang === 'zh' ? '负数' : 'negative');
  const activeList_9 = activeIdx.map(j => (lang === 'zh' ? `第 ${j + 1} 个单元（w${'₀₁₂₃₄'[j + 1]}⁽⁰⁾ = ${num(ps[j])}）` : `unit ${j + 1} (w${'₀₁₂₃₄'[j + 1]}⁽⁰⁾ = ${num(ps[j])})`)).join(lang === 'zh' ? '、' : ', ');

  return [
    g.choice({
      id: 'bnn-limit',
      title: t('What the prior becomes', '先验变成什么'),
      prompt: t(
        `A single-hidden-layer network with ${actName1} activation has K₁ = ${num(K1_1)} hidden units. All parameters are independent with mean 0: the output weights wⱼ ∼ N(0, σ_w²/K₁), the output bias b ∼ N(0, σ_b²), and the first-layer parameters are independent too (Lecture 8 p. 15). Let K₁ grow towards infinity. What happens to the joint distribution of the outputs z(x₁), …, z(xₙ) at any n fixed inputs (Lecture 8 p. 16)?`,
        `一个单隐藏层网络使用${actName1}作为激活函数，有 K₁ = ${num(K1_1)} 个隐藏单元。所有参数相互独立且均值为 0：输出权重 wⱼ ∼ N(0, σ_w²/K₁)，输出偏置 b ∼ N(0, σ_b²)，第一层参数也相互独立（第 8 讲第 15 页）。令 K₁ 趋向无穷。对任意固定的 n 个输入，输出 z(x₁)、…、z(xₙ) 的联合分布会怎样（第 8 讲第 16 页）？`
      ),
      options: [
        t('They become jointly Gaussian with mean 0 (central limit theorem): the prior is a GP', '它们变成均值为 0 的联合高斯分布（中心极限定理），即先验是一个 GP'),
        t('They concentrate on one fixed function, because the many random terms average out (law of large numbers)', '它们集中到一个固定的函数上，因为大量随机项在求和时相互平均抵消（大数定律）'),
        t(`They stay non-Gaussian, because the ${actName1} activation is a non-linear function of x`, `它们保持非高斯，因为${actName1}是关于 x 的非线性函数`),
        t('They become Gaussian only after training: until the weights are fitted to data, the prior stays non-Gaussian', '它们只有在训练之后才变成高斯分布：权重拟合数据之前，先验一直是非高斯的'),
      ],
      correct: 0,
      hint: t('Ask what the scaling σ_w²/K₁ does to the variance of the sum as K₁ grows, and whether the terms are independent.', '想一想 σ_w²/K₁ 这个缩放使求和的方差随 K₁ 增大如何变化，以及各项是否相互独立。'),
      explanation: t(
        `Each output is z(x) = b + Σⱼ wⱼ aⱼ(x), a sum of K₁ independent terms with finite moments; the scaling σ_w²/K₁ keeps the variance of the sum at σ_b² + σ_w² E[a(x)²] for every K₁. By the central limit theorem the output at any finite set of inputs becomes jointly Gaussian with mean 0, which is the definition of a GP (Lecture 8 p. 16, Neal 1994). The terms have mean 0 and a variance that does not vanish, so they do not average to a fixed function. The ${actName1} activation being non-linear does not matter, only the finite moments do, and no training is involved: this is the prior at initialisation. This game does not assess the posterior of a trained wide network.`,
        `每个输出为 z(x) = b + Σⱼ wⱼ aⱼ(x)，是 K₁ 个独立且矩有限的项之和；缩放 σ_w²/K₁ 使这个和的方差对每个 K₁ 都保持为 σ_b² + σ_w² E[a(x)²]。由中心极限定理，任意有限个输入处的输出变成均值为 0 的联合高斯分布，这正是 GP 的定义（第 8 讲第 16 页，尼尔 1994）。这些项均值为 0 且方差不会消失，所以它们不会平均成一个固定的函数。${actName1}是非线性的并不重要，只需矩有限；这里也不涉及训练，说的是初始化时的先验。本游戏不考查训练后宽网络的后验。`
      ),
    }),
    g.number({
      id: 'toy-kernel',
      title: t('The kernel of a ReLU network', '线性整流网络的核'),
      prompt: t(
        `A network with K₁ hidden units has the output z(x) = b + Σⱼ wⱼ aⱼ(x), summed over the hidden units j, with aⱼ(x) = σ(uⱼ x) and σ(t) = max(t, 0). The parameters are independent: b ∼ N(0, σ_b²) with σ_b² = ${num(sb2_2)}, wⱼ ∼ N(0, σ_w²/K₁) with σ_w² = ${num(sw2_2)}, and each first-layer weight uⱼ equals 1 or −1 with probability 1/2 each (a simple toy choice). As K₁ → ∞ the covariance of z(x) and z(x′) tends to k(x, x′) = σ_b² + σ_w² E[a(x) a(x′)] (Lecture 8 p. 17). For x = ${num(x_2)} and x′ = ${num(xp_2)}, what is k(x, x′)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个有 K₁ 个隐藏单元的网络，输出为 z(x) = b + Σⱼ wⱼ aⱼ(x)（对隐藏单元 j 求和），其中 aⱼ(x) = σ(uⱼ x)，σ(t) 在 t > 0 时等于 t，在 t < 0 时等于 0（t = 0 时取 0）。各参数相互独立：b ∼ N(0, σ_b²)，σ_b² = ${num(sb2_2)}；wⱼ ∼ N(0, σ_w²/K₁)，σ_w² = ${num(sw2_2)}；每个第一层权重 uⱼ 以各 1/2 的概率取 1 或 −1（一个简化的玩具设定）。当 K₁ → ∞ 时，z(x) 与 z(x′) 的协方差趋于 k(x, x′) = σ_b² + σ_w² E[a(x) a(x′)]（第 8 讲第 17 页）。当 x = ${num(x_2)}，x′ = ${num(xp_2)} 时，k(x, x′) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(x, x′)', 'k(x, x′)'), answer: T_2, tolerance: 0.006 }],
      hint: t('Work out a(x) and a(x′) separately for u = 1 and for u = −1, then average the two products.', '分别在 u = 1 和 u = −1 时算出 a(x) 与 a(x′)，再对两个乘积取平均。'),
      explanation: t(
        `E[a(x)a(x′)] averages over the two equally likely values of u. For u = 1 the product is ${num(a1_2)}·${num(a1p_2)} = ${num(prod1_2)}; for u = −1 it is ${num(a2_2)}·${num(a2p_2)} = ${num(prod2_2)}. So E[a(x)a(x′)] = (${num(prod1_2)} + ${num(prod2_2)})/2 = ${num(E_2)}, and k(x, x′) = ${num(sb2_2)} + ${num(sw2_2)}·${num(E_2)} = ${num(T_2)}.${extra_2[0] ? ' ' + extra_2[0] : ''} If the activation were linear, a(x) = u x, the product would be ${num(x_2 * xp_2)} for both values of u and k would be ${num(sb2_2 + sw2_2 * x_2 * xp_2)}; the ReLU removes everything that is not switched on at both inputs. This is the toy version of the kernels of Lecture 8 p. 18.`,
        `E[a(x)a(x′)] 是对 u 的两个等概率取值求平均。u = 1 时乘积为 ${num(a1_2)}·${num(a1p_2)} = ${num(prod1_2)}；u = −1 时为 ${num(a2_2)}·${num(a2p_2)} = ${num(prod2_2)}。所以 E[a(x)a(x′)] = (${num(prod1_2)} + ${num(prod2_2)})/2 = ${num(E_2)}，k(x, x′) = ${num(sb2_2)} + ${num(sw2_2)}·${num(E_2)} = ${num(T_2)}。${extra_2[1]}若激活函数是线性的，a(x) = u x，则两个 u 值下的乘积都是 ${num(x_2 * xp_2)}，k 会等于 ${num(sb2_2 + sw2_2 * x_2 * xp_2)}；线性整流去掉了不在两个输入处同时被打开的部分。这是第 8 讲第 18 页那些核的玩具版本。`
      ),
      audit: { kind: 'GP-24:toy-kernel', params: { sb2: sb2_2, sw2: sw2_2, x: x_2, xp: xp_2 } },
    }),
    g.number({
      id: 'unscaled-var',
      title: t('What if the 1/K₁ is forgotten?', '忘了 1/K₁ 会怎样？'),
      prompt: t(
        `A student forgets the scaling of the output weights. The output is z(x) = b + Σⱼ wⱼ aⱼ(x) over K₁ = ${num(K1_3)} hidden units, with independent b ∼ N(0, σ_b²), σ_b² = ${num(sb2_3)}, and wⱼ ∼ N(0, σ_w²) with σ_w² = ${num(sw2_3)} (no division by K₁). The activations aⱼ(x) are independent of the weights, identically distributed over j, and E[a(x)²] = ${num(m_3)}. What is the variance of z(x) for this K₁? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一位学生忘了缩放输出权重。输出为 z(x) = b + Σⱼ wⱼ aⱼ(x)，共 K₁ = ${num(K1_3)} 个隐藏单元，其中 b ∼ N(0, σ_b²) 相互独立，σ_b² = ${num(sb2_3)}，wⱼ ∼ N(0, σ_w²)，σ_w² = ${num(sw2_3)}（没有除以 K₁）。激活值 aⱼ(x) 与权重相互独立，对 j 同分布，且 E[a(x)²] = ${num(m_3)}。对这个 K₁，z(x) 的方差是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Variance of z(x)', 'z(x) 的方差'), answer: T_3, tolerance: 0.006 }],
      hint: t('The terms are independent with mean 0, so their variances add. Count the terms.', '各项独立且均值为 0，所以方差直接相加。数一数有多少项。'),
      explanation: t(
        `Each term wⱼaⱼ(x) has mean 0 and variance σ_w²·E[a(x)²] = ${num(sw2_3)}·${num(m_3)} = ${num(sw2_3 * m_3)}, and the K₁ = ${num(K1_3)} terms are independent, so their variances add to ${num(K1_3)}·${num(sw2_3 * m_3)} = ${num(K1_3 * sw2_3 * m_3)}. The bias adds σ_b² = ${num(sb2_3)}, giving ${num(T_3)}. With the scaling σ_w²/K₁ of Lecture 8 p. 15 each term would be K₁ times smaller and the total would be ${num(sb2_3)} + ${num(sw2_3 * m_3)} = ${num(sb2_3 + sw2_3 * m_3)} for every K₁; that scaling is what makes the limit exist (GPML pdf p. 109, eq. 4.28 with σ_v² = ω²/N_H). Without it the variance grows in proportion to K₁ and the central limit theorem has nothing to converge to. This is the unscaled version of the kernel diagonal k(x, x).`,
        `每一项 wⱼaⱼ(x) 的均值为 0，方差为 σ_w²·E[a(x)²] = ${num(sw2_3)}·${num(m_3)} = ${num(sw2_3 * m_3)}，K₁ = ${num(K1_3)} 项相互独立，所以方差相加得 ${num(K1_3)}·${num(sw2_3 * m_3)} = ${num(K1_3 * sw2_3 * m_3)}。偏置再加上 σ_b² = ${num(sb2_3)}，得 ${num(T_3)}。若按第 8 讲第 15 页取 σ_w²/K₁ 的缩放，每一项的方差缩小为原来的 1/K₁，总方差对任意 K₁ 都是 ${num(sb2_3)} + ${num(sw2_3 * m_3)} = ${num(sb2_3 + sw2_3 * m_3)}；正是这个缩放使极限存在（教材第 109 页，式 4.28，σ_v² = ω²/N_H）。没有它，方差随 K₁ 成正比增长，中心极限定理就没有可收敛的对象。这是核对角线 k(x, x) 的未缩放版本。`
      ),
      audit: { kind: 'GP-24:unscaled-var', params: { sb2: sb2_3, sw2: sw2_3, m: m_3, K1: K1_3 } },
    }),
    g.choice({
      id: 'act-kernel',
      title: t('Which activation, which kernel', '哪种激活，哪种核'),
      prompt: form4 === 'A'
        ? t(
          `A single-hidden-layer Bayesian neural network has ${actName4} activation and independent random weights. In the infinite-width limit, which covariance function does the network prior induce (Lecture 8 p. 18)?`,
          `单隐藏层贝叶斯神经网络使用${actName4}作为激活函数，权重相互独立且随机。在无限宽极限下，网络先验诱导出哪一个协方差函数（第 8 讲第 18 页）？`
        )
        : t(
          `In the infinite-width limit, a single-hidden-layer Bayesian neural network with independent random weights induces the ${kernelName4}. Which activation function does it use (Lecture 8 p. 18)?`,
          `在无限宽极限下，权重相互独立且随机的单隐藏层贝叶斯神经网络诱导出${kernelName4}。它使用的是哪种激活函数（第 8 讲第 18 页）？`
        ),
      options: form4 === 'A'
        ? [
            t('ArcCos-1 kernel', '1 阶反余弦核'),
            t('ArcCos-0 kernel', '0 阶反余弦核'),
            t('NN kernel', '神经网络核'),
            t('modulated squared exponential kernel (non-stationary)', '调制的平方指数核（非平稳）'),
          ]
        : [
            t('ReLU', '线性整流函数'),
            t('step', '阶跃函数'),
            t('sigmoid (for example erf)', '误差函数型饱和函数'),
            t('Gaussian bump exp(−(x − u)²/(2σ_g²))', '高斯凸起函数 exp(−(x − u)²/(2σ_g²))'),
          ],
      correct: form4 === 'A'
        ? (item4 === 'ReLU' ? 0 : item4 === 'step' ? 1 : 2)
        : (item4 === 'ReLU' ? 0 : item4 === 'step' ? 1 : 2),
      hint: t('The three activations have different shapes: a kink at 0, a jump at 0, and a smooth saturating curve. Match each shape to its kernel.', '三种激活函数的形状不同：在 0 处有折点、在 0 处有跳变、光滑并趋于饱和。把每种形状对应到它的核。'),
      explanation: t(
        `Lecture 8 p. 18 pairs ReLU with the ArcCos-1 kernel, the step function with the ArcCos-0 kernel and the sigmoid with the NN kernel; the NN kernel is the one that the erf activation gives in closed form (GPML pdf p. 109, eq. 4.29). Here ${actName4} corresponds to the ${kernelName4}, so the other two kernel names belong to the other two activations. The modulated squared exponential kernel comes from Gaussian bump units exp(−(x − u)²/(2σ_g²)) with u ∼ N(0, σ_u²) and is non-stationary (GPML pdf p. 110); it is not the kernel of any of the three activations here. This game does not assess the closed forms of the ArcCos kernels.`,
        `第 8 讲第 18 页给出：线性整流函数对应 1 阶反余弦核，阶跃函数对应 0 阶反余弦核，误差函数型饱和函数对应神经网络核；神经网络核正是误差函数激活给出的闭式核（教材第 109 页，式 4.29）。这里${actName4}对应${kernelName4}，所以另外两个核的名字属于另外两种激活函数。调制的平方指数核来自高斯凸起单元 exp(−(x − u)²/(2σ_g²))（u ∼ N(0, σ_u²)），它是非平稳的（教材第 110 页），不是这三种激活中任何一种的核。本游戏不考查反余弦核的闭式表达。`
      ),
    }),
    g.number({
      id: 'gauss-bump',
      title: t('The Gaussian-bump kernel', '高斯凸起核'),
      prompt: t(
        `A single-hidden-layer network has Gaussian-bump units a(x) = exp(−(x − u)²/(2σ_g²)) with u ∼ N(0, σ_u²), where σ_g² = ${num(g_5)} and σ_u² = ${num(u_5)} (Assignment 4 Task 3.1; GPML pdf p. 110). In the infinite-width limit, up to a constant factor that depends on neither x nor x′, k(x, x′) ∝ exp(−x²/(2σ_m²)) · exp(−(x − x′)²/(2σ_s²)) · exp(−x′²/(2σ_m²)), with σ_s² = 2σ_g² + σ_g⁴/σ_u² and σ_m² = 2σ_u² + σ_g². Let k̃(x, x′) be this product. For x = ${num(x_5)} and x′ = ${num(xp_5)}, what is ln k̃(x, x′)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个单隐藏层网络使用高斯凸起单元 a(x) = exp(−(x − u)²/(2σ_g²))，u ∼ N(0, σ_u²)，其中 σ_g² = ${num(g_5)}，σ_u² = ${num(u_5)}（作业 4 第 3.1 题；教材第 110 页）。在无限宽极限下，除去一个与 x 和 x′ 都无关的常数因子，k(x, x′) ∝ exp(−x²/(2σ_m²)) · exp(−(x − x′)²/(2σ_s²)) · exp(−x′²/(2σ_m²))，其中 σ_s² = 2σ_g² + σ_g⁴/σ_u²，σ_m² = 2σ_u² + σ_g²。记 k̃(x, x′) 为这个乘积。当 x = ${num(x_5)}，x′ = ${num(xp_5)} 时，ln k̃(x, x′) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ln k̃(x, x′)', 'ln k̃(x, x′)'), answer: T_5, tolerance: 0.006 }],
      hint: t('Find σ_s² and σ_m² from the two definitions first; only then bring in x and x′.', '先由两个定义算出 σ_s² 和 σ_m²，再代入 x 和 x′。'),
      explanation: t(
        `σ_s² = 2·${num(g_5)} + ${num(g_5)}²/${num(u_5)} = ${exact(ss_5)} and σ_m² = 2·${num(u_5)} + ${num(g_5)} = ${exact(sm_5)}. Then ln k̃(x, x′) = −x²/(2σ_m²) − (x − x′)²/(2σ_s²) − x′²/(2σ_m²) = −${num(x_5 * x_5)}/(2·${exact(sm_5)}) − ${num((x_5 - xp_5) * (x_5 - xp_5))}/(2·${exact(ss_5)}) − ${num(xp_5 * xp_5)}/(2·${exact(sm_5)}) = ${exact(T_5)}. The two outer factors depend on x and x′ separately, so the kernel is not stationary (GPML pdf p. 110); the middle factor is the squared exponential in x − x′. Swapping the roles of σ_s² and σ_m² would give ${exact(swapped_5)}. This game does not assess the constant factor σ_e/σ_u of eq. 4.30.`,
        `σ_s² = 2·${num(g_5)} + ${num(g_5)}²/${num(u_5)} = ${exact(ss_5)}，σ_m² = 2·${num(u_5)} + ${num(g_5)} = ${exact(sm_5)}。于是 ln k̃(x, x′) = −x²/(2σ_m²) − (x − x′)²/(2σ_s²) − x′²/(2σ_m²) = −${num(x_5 * x_5)}/(2·${exact(sm_5)}) − ${num((x_5 - xp_5) * (x_5 - xp_5))}/(2·${exact(ss_5)}) − ${num(xp_5 * xp_5)}/(2·${exact(sm_5)}) = ${exact(T_5)}。两个外侧因子分别只依赖 x 和 x′，所以这个核不是平稳的（教材第 110 页）；中间的因子是关于 x − x′ 的平方指数。若把 σ_s² 与 σ_m² 的角色对调，会得到 ${exact(swapped_5)}。本游戏不考查式 4.30 中的常数因子 σ_e/σ_u。`
      ),
      audit: { kind: 'GP-24:gauss-bump', params: { g: g_5, u: u_5, x: x_5, xp: xp_5 } },
    }),
    g.number({
      id: 'ntk-out',
      title: t('The output-layer kernel', '输出层的核'),
      prompt: t(
        `A network f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x), summed over its K = 2 hidden units, has no biases and ReLU activation σ(t) = max(t, 0) (Lecture 8 p. 22). Its weights are w⁽⁰⁾ = (${num(p1_6)}, ${num(p2_6)}) and w⁽¹⁾ = (${num(v1_6)}, ${num(v2_6)}). The output-layer kernel is the inner product of the gradients with respect to the output weights w⁽¹⁾ = (w₁⁽¹⁾, w₂⁽¹⁾) alone: k⁽¹⁾(x, y) = ⟨∇ f(x; θ), ∇ f(y; θ)⟩ taken over w⁽¹⁾ only (Assignment 4 Task 3.2). What is k⁽¹⁾(x, y) for x = ${num(x_6)} and y = ${num(y_6)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个网络 f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x)（对 K = 2 个隐藏单元求和）没有偏置，激活函数 σ(t) 在 t > 0 时等于 t，在 t < 0 时等于 0（第 8 讲第 22 页）。它的权重为 w⁽⁰⁾ = (${num(p1_6)}, ${num(p2_6)})，w⁽¹⁾ = (${num(v1_6)}, ${num(v2_6)})。输出层的核是只对输出权重 w⁽¹⁾ = (w₁⁽¹⁾, w₂⁽¹⁾) 求梯度后的内积：k⁽¹⁾(x, y) = ⟨∇ f(x; θ), ∇ f(y; θ)⟩（梯度只取 w⁽¹⁾ 方向）（作业 4 第 3.2 题）。当 x = ${num(x_6)}，y = ${num(y_6)} 时，k⁽¹⁾(x, y) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k⁽¹⁾(x, y)', 'k⁽¹⁾(x, y)'), answer: T_6, tolerance: 0.006 }],
      hint: t('Differentiate f with respect to each output weight first. Then check which of the two hidden units is switched on at x and at y.', '先对每个输出权重求 f 的导数；再看两个隐藏单元里哪个在 x 和 y 处被打开。'),
      explanation: t(
        `Differentiating with respect to wⱼ⁽¹⁾ leaves σ(wⱼ⁽⁰⁾x)/√K, so k⁽¹⁾(x, y) = (1/K) Σⱼ σ(wⱼ⁽⁰⁾x) σ(wⱼ⁽⁰⁾y) (Assignment 4 Task 3.2). Unit ${ia_6} has wₐ⁽⁰⁾ = ${num(pa_6)}: σ(${num(pa_6)}·${par(x_6)}) = ${num(pa_6 * x_6)} and σ(${num(pa_6)}·${par(y_6)}) = ${num(pa_6 * y_6)}. Unit ${ib_6} has wᵦ⁽⁰⁾ = ${num(pb_6)}: both pre-activations (${num(pb_6 * x_6)} and ${num(pb_6 * y_6)}) are negative, so σ = 0 and it contributes nothing. So k⁽¹⁾ = (1/2)·${par(pa_6 * x_6)}·${par(pa_6 * y_6)} = ${exact(T_6)}. The output weights w⁽¹⁾ = (${num(v1_6)}, ${num(v2_6)}) do not appear: after differentiating with respect to them they are gone. Using both units as if the activation were linear would give ${exact(linear_6)}.`,
        `对 wⱼ⁽¹⁾ 求导后剩下 σ(wⱼ⁽⁰⁾x)/√K，所以 k⁽¹⁾(x, y) = (1/K) Σⱼ σ(wⱼ⁽⁰⁾x) σ(wⱼ⁽⁰⁾y)（作业 4 第 3.2 题）。第 ${ia_6} 个单元 wₐ⁽⁰⁾ = ${num(pa_6)}：σ(${num(pa_6)}·${par(x_6)}) = ${num(pa_6 * x_6)}，σ(${num(pa_6)}·${par(y_6)}) = ${num(pa_6 * y_6)}。第 ${ib_6} 个单元 wᵦ⁽⁰⁾ = ${num(pb_6)}：两个预激活值（${num(pb_6 * x_6)} 与 ${num(pb_6 * y_6)}）都为负，σ = 0，不贡献任何东西。所以 k⁽¹⁾ = (1/2)·${par(pa_6 * x_6)}·${par(pa_6 * y_6)} = ${exact(T_6)}。输出权重 w⁽¹⁾ = (${num(v1_6)}, ${num(v2_6)}) 不出现：对它们求导之后它们就消失了。若把两个单元都当作线性的，会得到 ${exact(linear_6)}。`
      ),
      audit: { kind: 'GP-24:ntk-out', params: { p1: p1_6, p2: p2_6, v1: v1_6, v2: v2_6, x: x_6, y: y_6 } },
    }),
    g.number({
      id: 'ntk-in',
      title: t('The input-layer kernel', '输入层的核'),
      prompt: t(
        `The same kind of network f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x) with K = 2 hidden units, no biases and ReLU activation σ(t) = max(t, 0) has weights w⁽⁰⁾ = (${num(p1_7)}, ${num(p2_7)}) and w⁽¹⁾ = (${num(v1_7)}, ${num(v2_7)}). The derivative of the activation is σ′(t) = 1 for t > 0 and σ′(t) = 0 for t < 0. The input-layer kernel is the inner product of the gradients with respect to the first-layer weights w⁽⁰⁾ = (w₁⁽⁰⁾, w₂⁽⁰⁾) alone: k⁽⁰⁾(x, y) = ⟨∇ f(x; θ), ∇ f(y; θ)⟩ taken over w⁽⁰⁾ only (Assignment 4 Task 3.2). What is k⁽⁰⁾(x, y) for x = ${num(x_7)} and y = ${num(y_7)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `同类的网络 f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x)，K = 2 个隐藏单元，没有偏置，激活函数 σ(t) 在 t > 0 时等于 t，在 t < 0 时等于 0，权重为 w⁽⁰⁾ = (${num(p1_7)}, ${num(p2_7)})，w⁽¹⁾ = (${num(v1_7)}, ${num(v2_7)})。激活函数的导数为：t > 0 时 σ′(t) = 1，t < 0 时 σ′(t) = 0。输入层的核是只对第一层权重 w⁽⁰⁾ = (w₁⁽⁰⁾, w₂⁽⁰⁾) 求梯度后的内积：k⁽⁰⁾(x, y) = ⟨∇ f(x; θ), ∇ f(y; θ)⟩（梯度只取 w⁽⁰⁾ 方向）（作业 4 第 3.2 题）。当 x = ${num(x_7)}，y = ${num(y_7)} 时，k⁽⁰⁾(x, y) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k⁽⁰⁾(x, y)', 'k⁽⁰⁾(x, y)'), answer: T_7, tolerance: 0.006 }],
      hint: t('Differentiate f with respect to each first-layer weight; the chain rule brings in σ′. A ReLU unit has derivative 0 where its input is negative.', '对每个第一层权重求 f 的导数，链式法则会带来 σ′。线性整流单元在输入为负处的导数为 0。'),
      explanation: t(
        `Differentiating with respect to wⱼ⁽⁰⁾ gives wⱼ⁽¹⁾ σ′(wⱼ⁽⁰⁾x) x/√K, so k⁽⁰⁾(x, y) = (1/K) Σⱼ (wⱼ⁽¹⁾)² σ′(wⱼ⁽⁰⁾x) σ′(wⱼ⁽⁰⁾y) x y (Assignment 4 Task 3.2). Unit ${ia_7}: σ′(${num(pa_7 * x_7)}) = 1 and σ′(${num(pa_7 * y_7)}) = 1, so its term is ${par(va_7)}²·${par(x_7)}·${par(y_7)} = ${exact(va_7 * va_7 * x_7 * y_7)}. Unit ${ib_7} has negative pre-activations (${num(pb_7 * x_7)} and ${num(pb_7 * y_7)}), so σ′ = 0 and its term is 0. Hence k⁽⁰⁾ = (1/2)·${exact(va_7 * va_7 * x_7 * y_7)} = ${exact(T_7)}. The weight enters squared, because it appears in the gradient at x and at y; using ${num(va_7)} instead of ${par(va_7)}² would give ${exact(va_xy_7)}. Leaving out the factor x·y of the chain rule would give ${exact(va2_only_7)}.`,
        `对 wⱼ⁽⁰⁾ 求导得 wⱼ⁽¹⁾ σ′(wⱼ⁽⁰⁾x) x/√K，所以 k⁽⁰⁾(x, y) = (1/K) Σⱼ (wⱼ⁽¹⁾)² σ′(wⱼ⁽⁰⁾x) σ′(wⱼ⁽⁰⁾y) x y（作业 4 第 3.2 题）。第 ${ia_7} 个单元：σ′(${num(pa_7 * x_7)}) = 1，σ′(${num(pa_7 * y_7)}) = 1，所以它的项为 ${par(va_7)}²·${par(x_7)}·${par(y_7)} = ${exact(va_7 * va_7 * x_7 * y_7)}。第 ${ib_7} 个单元的预激活值为负（${num(pb_7 * x_7)} 与 ${num(pb_7 * y_7)}），σ′ = 0，它的项为 0。因此 k⁽⁰⁾ = (1/2)·${exact(va_7 * va_7 * x_7 * y_7)} = ${exact(T_7)}。这个权重以平方形式出现，因为它同时出现在 x 处和 y 处的梯度里；若用 ${num(va_7)} 而不是 ${par(va_7)}²，会得到 ${exact(va_xy_7)}。漏掉链式法则中的因子 x·y，会得到 ${exact(va2_only_7)}。`
      ),
      audit: { kind: 'GP-24:ntk-in', params: { p1: p1_7, p2: p2_7, v1: v1_7, v2: v2_7, x: x_7, y: y_7 } },
    }),
    g.choice({
      id: 'ntk-lazy',
      title: t('The kernel at large width', '大宽度下的核'),
      prompt: t(
        `The network f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x), summed over its K hidden units, has ${actName8} activation and K = ${num(K_8)}. All weights are initialised independently, the first-layer weights wⱼ⁽⁰⁾ with the same distribution for every j (Assignment 4 Task 3.2). Its output-layer kernel is k⁽¹⁾(x, y) = (1/K) Σⱼ σ(wⱼ⁽⁰⁾ x) σ(wⱼ⁽⁰⁾ y). At two fixed inputs x and y, what happens to k⁽¹⁾(x, y) as K → ∞?`,
        `网络 f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x)（对 K 个隐藏单元求和）使用${actName8}作为激活函数，K = ${num(K_8)}。所有权重相互独立地初始化，第一层权重 wⱼ⁽⁰⁾ 对每个 j 服从同一分布（作业 4 第 3.2 题）。它的输出层核为 k⁽¹⁾(x, y) = (1/K) Σⱼ σ(wⱼ⁽⁰⁾ x) σ(wⱼ⁽⁰⁾ y)。在两个固定的输入 x 和 y 处，当 K → ∞ 时 k⁽¹⁾(x, y) 会怎样？`
      ),
      options: [
        t('It settles at one fixed number, the same for every random initialisation (law of large numbers)', '它趋于一个固定的数，对每一次随机初始化都相同（大数定律）'),
        t('It stays random: the average fluctuates as strongly as the network outputs do, so the kernel differs between initialisations', '它仍是随机的：平均值的波动与网络输出一样大，所以不同初始化的核不同'),
        t('It tends to 0 for every pair of inputs, because each of the K terms carries the small factor 1/K', '对每一对输入它都趋于 0，因为 K 项中的每一项都带有很小的因子 1/K'),
        t('It grows without bound, because the number of terms in the sum grows with K', '它无限增大，因为求和的项数随 K 增长'),
      ],
      correct: 0,
      hint: t('Look at what the factor 1/K does to a sum of K similar, independent terms.', '看一看因子 1/K 对 K 个相似且独立的项之和做了什么。'),
      explanation: t(
        `k⁽¹⁾(x, y) is an average of K independent, identically distributed terms σ(wⱼ⁽⁰⁾x)σ(wⱼ⁽⁰⁾y). By the law of large numbers it converges to the single number E[σ(w⁽⁰⁾x)σ(w⁽⁰⁾y)], which does not depend on any particular draw of the weights (Assignment 4 Task 3.2, question 3). The fluctuation of an average of K terms shrinks like 1/√K, unlike the output of the network, where zero-mean output weights make the sum fluctuate at order 1 and give a Gaussian limit (card 1). The limit is not 0 and does not grow: dividing by K exactly cancels the number of terms. A fixed kernel is what allows training to be analysed as kernel regression: for large K the parameters hardly move during gradient descent (Lecture 8 p. 23), so the gradients at initialisation, which define the kernel (p. 24), stay informative. This game does not assess the training dynamics of the network.`,
        `k⁽¹⁾(x, y) 是 K 个独立同分布项 σ(wⱼ⁽⁰⁾x)σ(wⱼ⁽⁰⁾y) 的平均。由大数定律，它收敛到单个数 E[σ(w⁽⁰⁾x)σ(w⁽⁰⁾y)]，这个数不依赖于权重的某一次具体取值（作业 4 第 3.2 题第 3 问）。K 项平均的波动按 1/√K 缩小；网络的输出则不同，零均值的输出权重使求和的波动保持在 1 的量级，并给出高斯极限（第 1 关）。极限既不是 0 也不会增大：除以 K 恰好抵消了项数。核固定不变，才能把训练当作核回归来分析：K 很大时，参数在梯度下降中几乎不动（第 8 讲第 23 页），因此定义核的初始化处梯度（第 24 页）依然有效。本游戏不考查网络的训练动力学。`
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the whole kernel', '挑战：完整的核'),
      prompt: t(
        `A network f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x), summed over its K = 4 hidden units, has no biases and ReLU activation σ(t) = max(t, 0), with σ′(t) = 1 for t > 0 and σ′(t) = 0 for t < 0. Its weights are w⁽⁰⁾ = (${num(p1_9)}, ${num(p2_9)}, ${num(p3_9)}, ${num(p4_9)}) and w⁽¹⁾ = (${num(v1_9)}, ${num(v2_9)}, ${num(v3_9)}, ${num(v4_9)}). The neural tangent kernel at these weights is k(x, y) = ⟨∇_θ f(x; θ), ∇_θ f(y; θ)⟩, the inner product over all weights θ = (w⁽⁰⁾, w⁽¹⁾) (Lecture 8 p. 24). What is k(x, y) for x = ${num(x_9)} and y = ${num(y_9)}? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个网络 f(x; θ) = (1/√K) Σⱼ wⱼ⁽¹⁾ σ(wⱼ⁽⁰⁾ x)（对 K = 4 个隐藏单元求和）没有偏置，激活函数 σ(t) 在 t > 0 时等于 t，在 t < 0 时等于 0，且 t > 0 时 σ′(t) = 1，t < 0 时 σ′(t) = 0。它的权重为 w⁽⁰⁾ = (${num(p1_9)}, ${num(p2_9)}, ${num(p3_9)}, ${num(p4_9)})，w⁽¹⁾ = (${num(v1_9)}, ${num(v2_9)}, ${num(v3_9)}, ${num(v4_9)})。在这些权重处的神经正切核为 k(x, y) = ⟨∇_θ f(x; θ), ∇_θ f(y; θ)⟩，即对全部权重 θ = (w⁽⁰⁾, w⁽¹⁾) 的内积（第 8 讲第 24 页）。当 x = ${num(x_9)}，y = ${num(y_9)} 时，k(x, y) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(x, y)', 'k(x, y)'), answer: T_9, tolerance: 0.006 }],
      hint: t('Both layers contribute to the kernel. First work out which of the four hidden units are switched on for x and for y.', '两层都对核有贡献。先找出四个隐藏单元中哪些在 x 和 y 处被打开。'),
      explanation: t(
        `Differentiating f gives σ(wⱼ⁽⁰⁾x)/√K for wⱼ⁽¹⁾ and wⱼ⁽¹⁾ σ′(wⱼ⁽⁰⁾x) x/√K for wⱼ⁽⁰⁾ (Assignment 4 Task 3.2), so k(x, y) = (1/K) Σⱼ [σ(wⱼ⁽⁰⁾x) σ(wⱼ⁽⁰⁾y) + (wⱼ⁽¹⁾)² σ′(wⱼ⁽⁰⁾x) σ′(wⱼ⁽⁰⁾y) x y]. With x = ${num(x_9)} and y = ${num(y_9)} (both ${sign_9}), the units switched on are those whose first-layer weight has that sign: ${activeList_9}; the others contribute 0 to both parts. Output-layer part: (1/4)·(${activeIdx.map(j => `${par(ps[j])}²·${par(x_9)}·${par(y_9)}`).join(' + ')}) = ${exact(k1_9)}. Input-layer part: (1/4)·(${activeIdx.map(j => `${par(vs[j])}²·${par(x_9)}·${par(y_9)}`).join(' + ')}) = ${exact(k0_9)}. Total: ${exact(k1_9)} + ${exact(k0_9)} = ${exact(T_9)}. ${k1_9 === k0_9 ? `One layer alone would give only ${exact(k1_9)}` : `One layer alone would give ${exact(k1_9)} or ${exact(k0_9)}`}; counting all four units as if the activation were linear would give ${exact(allunits_9)}. This game does not assess biases, deeper networks or the training dynamics.`,
        `对 f 求导：对 wⱼ⁽¹⁾ 得 σ(wⱼ⁽⁰⁾x)/√K，对 wⱼ⁽⁰⁾ 得 wⱼ⁽¹⁾ σ′(wⱼ⁽⁰⁾x) x/√K（作业 4 第 3.2 题），所以 k(x, y) = (1/K) Σⱼ [σ(wⱼ⁽⁰⁾x) σ(wⱼ⁽⁰⁾y) + (wⱼ⁽¹⁾)² σ′(wⱼ⁽⁰⁾x) σ′(wⱼ⁽⁰⁾y) x y]。当 x = ${num(x_9)}，y = ${num(y_9)}（都是${sign_9}）时，被打开的单元是第一层权重与它同号的那些：${activeList_9}；其余单元对两部分的贡献都是 0。输出层部分：(1/4)·(${activeIdx.map(j => `${par(ps[j])}²·${par(x_9)}·${par(y_9)}`).join(' + ')}) = ${exact(k1_9)}。输入层部分：(1/4)·(${activeIdx.map(j => `${par(vs[j])}²·${par(x_9)}·${par(y_9)}`).join(' + ')}) = ${exact(k0_9)}。合计：${exact(k1_9)} + ${exact(k0_9)} = ${exact(T_9)}。${k1_9 === k0_9 ? `只取一层只会得到 ${exact(k1_9)}` : `只取一层会得到 ${exact(k1_9)} 或 ${exact(k0_9)}`}；把四个单元都当作线性的会得到 ${exact(allunits_9)}。本游戏不考查偏置、更深的网络或训练动力学。`
      ),
      audit: { kind: 'GP-24:challenge', params: { p1: p1_9, p2: p2_9, p3: p3_9, p4: p4_9, v1: v1_9, v2: v2_9, v3: v3_9, v4: v4_9, x: x_9, y: y_9 } },
    }),
  ];
};
