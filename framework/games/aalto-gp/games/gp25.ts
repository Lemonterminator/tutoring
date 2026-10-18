import type { CardGenerator } from '../../types';
import { makeGpDeck, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

const apart = (truth: number, routes: number[], gap: number): boolean => routes.every(r => Math.abs(r - truth) >= gap - 1e-9);
const rng = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const igcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : igcd(b, a % b));
/** The key is a multiple of 0.25, so its reduced denominator is 1, 2 or 4. */
const quarterOk = (T: number): boolean => { const q = Math.round(T * 4); return Math.abs(q - T * 4) < 1e-9 && [1, 2, 4].includes(4 / igcd(q, 4)); };
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const sub = (n: number): string => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');

function comp(k: number, n: number): string {
  if (k === 0) return 'x' + sub(n);
  let s = 'x' + sub(n);
  for (let i = 1; i <= k; i++) s = 'f' + sub(i) + '(' + s + ')';
  return s;
}

// Sampling spaces: every space of the plan is enumerated once at module load (explicit lists and exact predicates, guards included),
// then a card draws one entry with g.pick, so every listed set is reachable and nothing outside the plan is drawn.
const SP1: { L: number; l: number; n: number }[] = [];
for (const L of [3, 4, 5]) for (const l of rng(2, L)) for (const n of [1, 2, 3]) SP1.push({ L, l, n });

const SP2: { L: number; N: number; D: number; M: number[] }[] = [];
for (const L of [2, 3, 4]) for (const N of [2, 3, 4, 5, 10]) for (const D of [1, 2, 3, 4]) {
  const widths = (i: number, acc: number[]): void => {
    if (i === L - 1) {
      const M = [...acc, 1], sumM = M.reduce((x, y) => x + y, 0), prodM = M.reduce((x, y) => x * y, 1);
      if (apart(N * sumM, [N * (D + sumM), N * (sumM - 1), N * L, sumM, N * prodM], 2)) SP2.push({ L, N, D, M });
      return;
    }
    for (const m of [1, 2, 3]) widths(i + 1, [...acc, m]);
  };
  widths(0, []);
}

const SP3: { ell: number; x1: number; x2: number; a: number; b: number; delta: number; T: number; r1: number }[] = [];
for (const ell of [1, 2]) for (const x1 of [0, 1, 2]) for (const dx of [3, 4, 5, 6]) for (const a of rng(-3, 3)) for (const b of rng(-3, 3)) {
  const delta = Math.abs(a - b), e2 = ell * ell;
  if (delta < 1) continue;
  const T = -(delta * delta) / (2 * e2), r1 = -(dx * dx) / (2 * e2);
  if (quarterOk(T) && apart(T, [r1, -(delta * delta) / e2, (delta * delta) / (2 * e2), -delta / (2 * e2), -(delta * delta) / (4 * e2)], 0.1)) SP3.push({ ell, x1, x2: x1 + dx, a, b, delta, T, r1 });
}

const SP4: { m: number; s: number; v: number }[] = [];
for (const m of [-2, -1, 1, 2]) for (const s of [1, 2, 3, 4]) for (const v of [0.5, 1, 1.5, 2]) {
  if (apart(s + v, [v, s, s * v, s + v + m], 0.5)) SP4.push({ m, s, v });
}

const SP6: { L: number; S: number; B: number; N: number }[] = [];
for (const L of [2, 3, 4]) for (const S of [2, 3]) for (const B of [2, 4, 5]) for (const N of [20, 100]) {
  if (apart((L - 1) * S * B, [L * S * B, (L - 1) * S * N, (L - 1) * B, (L - 1) * S, L * S * N], 2)) SP6.push({ L, S, B, N });
}

const SP7: { y: number; m1: number; c1v: number; m2: number; c2v: number }[] = [];
for (const y of [-1, 0, 1, 2, 3]) for (const m1 of rng(-2, 4)) for (const m2 of rng(-2, 4)) for (const c1v of [1, 2, 3]) for (const c2v of [1, 2, 3]) {
  if (m1 === m2) continue;
  const e1 = (y - m1) ** 2 + c1v, e2 = (y - m2) ** 2 + c2v, T = (e1 + e2) / 2, mb = (m1 + m2) / 2;
  if (apart(T, [(y - mb) ** 2 + (c1v + c2v) / 2, e1, ((y - m1) ** 2 + (y - m2) ** 2) / 2, (y - mb) ** 2, 2 * T], 0.1)) SP7.push({ y, m1, c1v, m2, c2v });
}

const SP8: { L: number; k: number; t: number }[] = [];
for (const L of [3, 4, 5]) for (const k of rng(1, L)) for (const t of [0.01, 0.001]) SP8.push({ L, k, t });

const SP9: { S: number; y: number; v: number; a: number[] }[] = [];
for (const S of [2, 4]) for (const y of [0, 1, 2]) for (const v of [0.5, 1, 1.5, 2]) {
  const samples = (i: number, lo: number, acc: number[]): void => {
    if (i === S) {
      const sumSq = acc.reduce((u, ai) => u + (y - ai) ** 2, 0), msq = sumSq / S, T = msq + v, abar = acc.reduce((u, ai) => u + ai, 0) / S;
      if (quarterOk(T) && apart(T, [(y - abar) ** 2 + v, (y - acc[0]) ** 2 + v, msq, msq + S * v, v, sumSq + v], 0.1)) SP9.push({ S, y, v, a: acc });
      return;
    }
    for (let ai = lo; ai <= 3; ai++) samples(i + 1, ai, [...acc, ai]);
  };
  samples(0, -1, []);
}

export const gp25: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-25');
  warm(g);

  // Card 1: layer-input
  const c1 = g.pick(SP1);
  const c1_xn = 'x' + sub(c1.n);
  const c1_compL = comp(c1.L, c1.n);
  const c1_correct = comp(c1.l - 1, c1.n);
  const c1_w1 = c1_xn;
  const c1_w2 = comp(c1.l, c1.n);
  const c1_w3 = c1_xn + ' + ' + c1_correct;

  // Card 2: latent-count
  const c2b = g.pick(SP2);
  const sumM2 = c2b.M.reduce((a, b) => a + b, 0), prodM2 = c2b.M.reduce((a, b) => a * b, 1);
  const c2 = { ...c2b, sumM: sumM2, T: c2b.N * sumM2, r1: c2b.N * (c2b.D + sumM2), r2: c2b.N * (sumM2 - 1), r3: c2b.N * c2b.L, r4: sumM2, r5: c2b.N * prodM2 };
  const c2_pre = c2.M.slice(0, -1).map((m, i) => `M${sub(i + 1)} = ${m}`);
  const c2_widthsEn = c2_pre.length === 1 ? c2_pre[0] : `${c2_pre.slice(0, -1).join(', ')} and ${c2_pre[c2_pre.length - 1]}`;
  const c2_widthsZh = c2_pre.length === 1 ? c2_pre[0] : `${c2_pre.slice(0, -1).join('、')} 与 ${c2_pre[c2_pre.length - 1]}`;
  const c2_sumExpr = c2.M.join(' + ');

  // Card 3: warped-kernel
  const c3 = g.pick(SP3);

  // Card 4: propagated-variance
  const c4b = g.pick(SP4);
  const c4 = { ...c4b, T: c4b.s + c4b.v, r4: c4b.s + c4b.v + c4b.m };

  // Card 5: gaussian-closure
  const c5 = { s: g.pick([1, 2, 3, 4, 5, 6]) };
  const c5_var = 2 * c5.s * c5.s;

  // Card 6: sample-count
  const c6b = g.pick(SP6);
  const c6 = { ...c6b, T: (c6b.L - 1) * c6b.S * c6b.B, r1: c6b.L * c6b.S * c6b.B, r2: (c6b.L - 1) * c6b.S * c6b.N, r3: (c6b.L - 1) * c6b.B };

  // Card 7: sample-average
  const c7b = g.pick(SP7);
  const c7e1 = (c7b.y - c7b.m1) ** 2 + c7b.c1v, c7e2 = (c7b.y - c7b.m2) ** 2 + c7b.c2v;
  const c7mb = (c7b.m1 + c7b.m2) / 2, c7cb = (c7b.c1v + c7b.c2v) / 2;
  const c7 = { ...c7b, e1: c7e1, e2: c7e2, T: (c7e1 + c7e2) / 2, mb: c7mb, cb: c7cb, plug: (c7b.y - c7mb) ** 2 + c7cb, r3: ((c7b.y - c7b.m1) ** 2 + (c7b.y - c7b.m2) ** 2) / 2 };

  // Card 8: collapsed-layer
  const c8 = g.pick(SP8);

  // Card 9: challenge
  const c9b = g.pick(SP9);
  const c9sumSq = c9b.a.reduce((acc, ai) => acc + (c9b.y - ai) ** 2, 0), c9msq = c9sumSq / c9b.S;
  const c9abar = c9b.a.reduce((acc, ai) => acc + ai, 0) / c9b.S;
  const c9 = { ...c9b, sumSq: c9sumSq, msq: c9msq, T: c9msq + c9b.v, abar: c9abar, plug: (c9b.y - c9abar) ** 2 + c9b.v, first: (c9b.y - c9b.a[0]) ** 2 + c9b.v, r4: c9msq + c9b.S * c9b.v };
  const c9_alist = c9.a.map(x => num(x)).join(lang === 'zh' ? '、' : ', ');
  // the one-Gaussian value is printed only when it has at most 2 decimals (it can be a sixteenth)
  const c9_plugEq = Math.abs(c9.plug * 100 - Math.round(c9.plug * 100)) < 1e-9 ? ` = ${num(c9.plug)}` : '';
  const c9_sumExpr = c9.a.map(ai => num((c9.y - ai) ** 2)).join(' + ');

  return [
    // Card 1
    g.choice({
      id: 'layer-input',
      title: t('What does layer ℓ receive?', '第 ℓ 层接收什么？'),
      prompt: t(
        `In a deep GP with L = ${c1.L} layers, f₀ = x and every layer is a GP, f₁, …, f${sub(c1.L)}. The data point with input ${c1_xn} passes through the layers one after another, as ${c1_compL}. Which value is the input of the GP f${sub(c1.l)} of layer ${c1.l} for this data point?`,
        `在有 L = ${c1.L} 层的深度高斯过程中，f₀ = x，每一层都是高斯过程 f₁ 至 f${sub(c1.L)}。输入为 ${c1_xn} 的数据点依次通过各层，即 ${c1_compL}。对这个数据点，第 ${c1.l} 层的高斯过程 f${sub(c1.l)} 的输入是哪个值？`
      ),
      options: [
        t(`${c1_correct}, the output of the previous layer`, `${c1_correct}，即前一层的输出`),
        t(`${c1_w1} itself, since every layer sees the raw input`, `${c1_w1} 本身，因为每一层都接收原始输入`),
        t(`${c1_w2}, the output of this very layer`, `${c1_w2}，即本层自己的输出`),
        t(`${c1_w3}, the input plus the previous output`, `${c1_w3}，即原始输入加上前一层的输出`)
      ],
      correct: 0,
      hint: t(`Read the chain ${c1_compL} from the inside outwards.`, `沿着 ${c1_compL} 从内向外逐层读。`),
      explanation: t(
        `Each layer takes the output of the layer before it: the data point ${c1_xn} is first fed to f₁, its value to f₂, and so on (Lecture 9 pp. 14–16, 24). So the input of f${sub(c1.l)} is ${c1_correct}. Feeding ${c1_xn} to every layer would not be a composition. ${c1_w2} is what layer ${c1.l} outputs, not what it receives, and ${c1_w3} is a skip connection, which is not part of the model. This game does not assess the sparse inference in this card.`,
        `每一层的输入是前一层的输出：数据点 ${c1_xn} 先送入 f₁，它的取值再送入 f₂，依此类推（第 9 讲第 14 至 16 页、第 24 页）。所以 f${sub(c1.l)} 的输入是 ${c1_correct}。把 ${c1_xn} 送入每一层就不是复合了。${c1_w2} 是第 ${c1.l} 层的输出而不是它的输入，${c1_w3} 是跳跃连接，不属于这个模型。本游戏在这一关不考查稀疏推断。`
      ),
    }),

    // Card 2
    g.number({
      id: 'latent-count',
      title: t('How many latent values?', '有多少个潜变量？'),
      prompt: t(
        `A deep GP with L = ${c2.L} layers is fitted to N = ${c2.N} data points whose inputs have dimension D = ${c2.D}. The layer values f_ℓ have size (N, M_ℓ) with ${c2_widthsEn}; the last layer matches the scalar target, so M${sub(c2.L)} = 1. The inputs f₀ = x are given data. How many random latent values (the entries of f₁ to f${sub(c2.L)}) does the prior contain? Give an integer.`,
        `有 L = ${c2.L} 层的深度高斯过程拟合 N = ${c2.N} 个数据点，输入的维数为 D = ${c2.D}。各层的取值 f_ℓ 的大小为 (N, M_ℓ)，其中 ${c2_widthsZh}；最后一层对应标量目标，所以 M${sub(c2.L)} = 1。输入 f₀ = x 是已知数据。先验中有多少个随机的潜变量（f₁ 至 f${sub(c2.L)} 的全部元素）？请填整数。`
      ),
      fields: [{ label: t('latent values', '潜变量个数'), answer: c2.T, tolerance: 0.006 }],
      hint: t('Count the entries of each f_ℓ separately, and ask which of the printed quantities are random.', '分别数出每个 f_ℓ 的元素个数，并想一想题中哪些量是随机的。'),
      explanation: t(
        `Each f_ℓ has N·M_ℓ entries (Lecture 9 p. 25), so the prior holds N·(M₁ + … + M${sub(c2.L)}) = ${c2.N}·(${c2_sumExpr}) = ${c2.N}·${c2.sumM} = ${c2.T} latent values. The inputs f₀ = x are given data with ${c2.N * c2.D} entries and are not latent: counting them would give ${c2.r1}. Forgetting the output layer, whose values are latent too, would give ${c2.r2}, and ignoring the widths gives N·L = ${c2.r3}. This game does not assess the inducing variables.`,
        `每个 f_ℓ 有 N·M_ℓ 个元素（第 9 讲第 25 页），所以先验含有 N·(M₁ + … + M${sub(c2.L)}) = ${c2.N}·(${c2_sumExpr}) = ${c2.N}·${c2.sumM} = ${c2.T} 个潜变量。输入 f₀ = x 是已知数据，有 ${c2.N * c2.D} 个元素，不是潜变量：把它们算进去会得到 ${c2.r1}。漏掉同样是潜变量的输出层会得到 ${c2.r2}，忽略各层宽度则得到 N·L = ${c2.r3}。本游戏在这一关不考查诱导变量。`
      ),
      audit: { kind: 'GP-25:latent-count', params: { L: c2.L, N: c2.N, D: c2.D, ...Object.fromEntries(c2.M.map((m, i) => [`M${i + 1}`, m])) } },
    }),

    // Card 3
    g.number({
      id: 'warped-kernel',
      title: t('The kernel sees the layer-1 outputs', '核函数作用在第 1 层的输出上'),
      prompt: t(
        `In layer 2 of a deep GP the covariance function is the squared exponential k₂(a, b) = exp(−(a − b)²/(2ℓ²)) with variance 1 and length-scale ℓ = ${c3.ell}. The inputs x₁ = ${c3.x1} and x₂ = ${c3.x2} are mapped by layer 1 to f₁(x₁) = ${num(c3.a)} and f₁(x₂) = ${num(c3.b)}. What is ln k₂(${num(c3.a)}, ${num(c3.b)}), the natural logarithm of the layer-2 covariance of these two values? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在深度高斯过程的第 2 层中，协方差函数为平方指数核 k₂(a, b) = exp(−(a − b)²/(2ℓ²))，方差为 1，长度尺度 ℓ = ${c3.ell}。输入 x₁ = ${c3.x1} 与 x₂ = ${c3.x2} 经第 1 层映射为 f₁(x₁) = ${num(c3.a)} 与 f₁(x₂) = ${num(c3.b)}。这两个值在第 2 层的协方差的自然对数 ln k₂(${num(c3.a)}, ${num(c3.b)}) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ln k₂', 'ln k₂'), answer: c3.T, tolerance: 0.006 }],
      hint: t('Which two numbers does k₂ compare?', 'k₂ 比较的是哪两个数？'),
      explanation: t(
        `A deep GP evaluates the kernel of layer 2 at the layer-1 outputs, not at x (Lecture 9 p. 25; Assignment 5 Task 2 computes K2 from f1). Here a − b = ${num(c3.a)} − ${par(c3.b)} = ${num(c3.a - c3.b)}, so ln k₂ = −(a − b)²/(2ℓ²) = −(${num(c3.a - c3.b)})²/(2·${c3.ell}²) = ${num(c3.T)}. Using the input distance ${c3.x2} − ${par(c3.x1)} = ${c3.x2 - c3.x1} instead would give ${num(c3.r1)}, and dropping the minus sign ${num(-c3.T)}. The covariance depends on x only through f₁(x), so the layered process is not stationary in x (Lecture 9 p. 18). This game does not assess evaluating exp.`,
        `深度高斯过程把第 2 层的核函数作用在第 1 层的输出上，而不是作用在 x 上（第 9 讲第 25 页；作业 5 任务 2 由 f1 计算 K2）。这里 a − b = ${num(c3.a)} − ${par(c3.b)} = ${num(c3.a - c3.b)}，所以 ln k₂ = −(a − b)²/(2ℓ²) = −(${num(c3.a - c3.b)})²/(2·${c3.ell}²) = ${num(c3.T)}。若改用输入之间的距离 ${c3.x2} − ${par(c3.x1)} = ${c3.x2 - c3.x1}，会得到 ${num(c3.r1)}；漏掉负号则得到 ${num(-c3.T)}。协方差只通过 f₁(x) 依赖 x，所以这个分层过程关于 x 不是平稳的（第 9 讲第 18 页）。本游戏在这一关不考查 exp 的计算。`
      ),
      audit: { kind: 'GP-25:warped-kernel', params: { ell: c3.ell, x1: c3.x1, x2: c3.x2, a: c3.a, b: c3.b } },
    }),

    // Card 4
    g.number({
      id: 'propagated-variance',
      title: t('Uncertainty passed on by layer 1', '第 1 层传来的不确定性'),
      prompt: t(
        `At one training input x, layer 1 of a deep GP gives f₁(x) ~ N(${num(c4.m)}, ${num(c4.s)}) (mean, variance). Layer 2 has the identity mean μ₂(u) = u and, whatever its input u is, the output f₂(u) has the variance ${num(c4.v)} (the layer noise is part of the kernel). The value f₁(x) is not observed. What is the variance of f₂(f₁(x))? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在某个训练输入 x 处，深度高斯过程第 1 层给出 f₁(x) ~ N(${num(c4.m)}, ${num(c4.s)})（均值，方差）。第 2 层的均值函数为恒等映射 μ₂(u) = u，且无论输入 u 是什么，输出 f₂(u) 的方差都是 ${num(c4.v)}（层间噪声已包含在核函数中）。f₁(x) 的取值没有被观测到。f₂(f₁(x)) 的方差是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('variance of f₂(f₁(x))', 'f₂(f₁(x)) 的方差'), answer: c4.T, tolerance: 0.006 }],
      hint: t('Think about what is random when f₁(x) is not observed.', '想一想 f₁(x) 未被观测时，哪些量是随机的。'),
      explanation: t(
        `Given u = f₁(x), the output f₂(u) has mean u and variance ${num(c4.v)}. Because u itself is unknown with variance ${num(c4.s)} and enters through the identity mean, both add up: ${num(c4.s)} + ${num(c4.v)} = ${num(c4.T)} (law of total variance: the average conditional variance ${num(c4.v)} plus the variance ${num(c4.s)} of the conditional mean). The mean ${num(c4.m)} shifts the value but does not enter a variance; adding it would give ${num(c4.r4)}. With a zero mean function the layer-1 uncertainty would not reach the output and the variance would be only ${num(c4.v)}. For two inputs the pair of outputs is in general not jointly Gaussian, so the layered process is not a GP in x (Lecture 9 p. 27). This game does not assess the joint distribution.`,
        `给定 u = f₁(x)，输出 f₂(u) 的均值为 u，方差为 ${num(c4.v)}。由于 u 本身未知，方差为 ${num(c4.s)}，并通过恒等均值进入输出，两部分相加：${num(c4.s)} + ${num(c4.v)} = ${num(c4.T)}（全方差公式：条件方差的平均值 ${num(c4.v)} 加上条件均值的方差 ${num(c4.s)}）。均值 ${num(c4.m)} 只平移取值，不进入方差；把它加上会得到 ${num(c4.r4)}。若均值函数取零，第 1 层的不确定性传不到输出，方差就只有 ${num(c4.v)}。对两个输入，两个输出一般不是联合高斯的，所以这个分层过程关于 x 不是高斯过程（第 9 讲第 27 页）。本游戏在这一关不考查联合分布。`
      ),
      audit: { kind: 'GP-25:propagated-variance', params: { m: c4.m, s: c4.s, v: c4.v } },
    }),

    // Card 5
    g.choice({
      id: 'gaussian-closure',
      title: t('Is a function of a Gaussian Gaussian?', '高斯变量的函数还是高斯的吗？'),
      prompt: t(
        `In a deep GP, a Gaussian variable z ~ N(0, ${num(c5.s)}) (mean 0, variance ${num(c5.s)}) is passed through the nonlinear map g(z) = z², a simple stand-in for the next layer. The result w = g(z) has mean ${num(c5.s)} and variance ${num(c5_var)}. Which statement is correct?`,
        `在深度高斯过程中，高斯变量 z ~ N(0, ${num(c5.s)})（均值 0，方差 ${num(c5.s)}）经过非线性映射 g(z) = z²，用它简单代替下一层。结果 w = g(z) 的均值为 ${num(c5.s)}，方差为 ${num(c5_var)}。下列哪个说法正确？`
      ),
      options: [
        t(`Not Gaussian: w ≥ 0, but a Gaussian with mean ${num(c5.s)} and variance ${num(c5_var)} can be negative`, `不是高斯分布：w ≥ 0，但均值 ${num(c5.s)}、方差 ${num(c5_var)} 的高斯分布可取负值`),
        t(`Gaussian with mean ${num(c5.s)} and variance ${num(c5_var)}, since any function of a Gaussian variable is Gaussian`, `是均值为 ${num(c5.s)}、方差为 ${num(c5_var)} 的高斯分布，因为高斯变量的任何函数仍是高斯变量`),
        t(`Gaussian with mean 0 and variance ${num(c5.s)}, since squaring leaves the mean and variance unchanged`, `是均值为 0、方差为 ${num(c5.s)} 的高斯分布，因为平方不改变均值和方差`),
        t(`Not Gaussian, but only because the mean ${num(c5.s)} is not 0 and a Gaussian must have mean 0`, `不是高斯分布，但只是因为均值 ${num(c5.s)} 不为 0，而高斯分布的均值必须为 0`)
      ],
      correct: 0,
      hint: t('Compare the set of values w can take with the set of values a Gaussian can take.', '比较 w 能取的值的范围与高斯变量能取的值的范围。'),
      explanation: t(
        `Since z² is never negative, w cannot follow any Gaussian with positive variance, because that would give positive probability to negative values; N(${num(c5.s)}, ${num(c5_var)}) is no exception even though it has the same mean and variance as w. Passing a Gaussian through a nonlinearity does not give a Gaussian (Lecture 9 p. 26), and the same holds when the nonlinearity is another GP: f₂(f₁(x)) is no longer a GP in x (p. 27), which is why deep GP inference is approximate (p. 30). The claim that any function of a Gaussian is Gaussian is false; squaring changes the mean to ${num(c5.s)} and the variance to ${num(c5_var)} instead of keeping 0 and ${num(c5.s)}; and a Gaussian may have any mean, so the mean ${num(c5.s)} is not the obstacle. This game does not assess the exact law of z².`,
        `z² 不会为负，所以 w 不可能服从任何方差为正的高斯分布，因为那会给负值以正的概率；N(${num(c5.s)}, ${num(c5_var)}) 也不例外，尽管它的均值和方差与 w 相同。高斯变量经过非线性映射后不再是高斯的（第 9 讲第 26 页），当非线性映射是另一个高斯过程时同样如此：f₂(f₁(x)) 关于 x 不再是高斯过程（第 27 页），这正是深度高斯过程的推断只能是近似的原因（第 30 页）。「高斯变量的任何函数仍是高斯变量」是错的；平方把均值变为 ${num(c5.s)}、方差变为 ${num(c5_var)}，而不是保持 0 和 ${num(c5.s)}；高斯分布可以有任意均值，所以均值 ${num(c5.s)} 并不是障碍。本游戏在这一关不考查 z² 的精确分布。`
      ),
    }),

    // Card 6
    g.number({
      id: 'sample-count',
      title: t('Counting the draws', '数一数抽样次数'),
      prompt: t(
        `Doubly stochastic variational inference for a deep GP with L = ${c6.L} layers of width 1 evaluates the bound on a mini-batch of N* = ${c6.B} points out of N = ${c6.N}. For every mini-batch point it draws S = ${c6.S} samples one layer after another through the first ${c6.L === 2 ? 'layer' : `${c6.L - 1} layers`}, using the samples of the previous layer as fixed inputs; at the last layer it does not draw but predicts a Gaussian N(m, C) for each sample. How many univariate Gaussian draws does one evaluation of the bound make? Give an integer.`,
        `对有 L = ${c6.L} 层、各层宽度为 1 的深度高斯过程，双随机变分推断在 N = ${c6.N} 个数据中的 N* = ${c6.B} 个小批量点上计算证据下界。对每个小批量点，它依次通过前 ${c6.L - 1} 层各抽取 S = ${c6.S} 个样本，并把前一层的样本当作固定输入；在最后一层不再抽样，而是对每个样本预测一个高斯分布 N(m, C)。一次计算证据下界共做多少次单变量高斯抽样？请填整数。`
      ),
      fields: [{ label: t('univariate draws', '单变量抽样次数'), answer: c6.T, tolerance: 0.006 }],
      hint: t('Check which layers produce draws and which produce a Gaussian.', '看一看哪些层产生抽样，哪些层产生高斯分布。'),
      explanation: t(
        `${c6.L === 2 ? 'The first layer gives' : `Each of the first ${c6.L - 1} layers gives`} one draw per sample and mini-batch point, S·N* = ${c6.S}·${c6.B} = ${c6.S * c6.B} draws, so ${c6.L === 2 ? '' : `${c6.L - 1}·`}${c6.S}·${c6.B} = ${c6.T} in total (Lecture 9 pp. 53–54). The last layer contributes ${c6.S * c6.B} Gaussians N(m, C), not draws, and the integral against ln p(y ∣ f) is taken over them (pp. 54–55). Every draw is univariate (p. 51). Only the mini-batch is processed, so N = ${c6.N} does not enter: using it gives ${c6.r2}. Drawing at the last layer too would give ${c6.r1}, and forgetting the S samples gives ${c6.r3}. This game does not assess the KL terms of the bound.`,
        `前 ${c6.L - 1} 层中的每一层，对每个样本和每个小批量点各抽一次，共 S·N* = ${c6.S}·${c6.B} = ${c6.S * c6.B} 次，所以总共 ${c6.L === 2 ? '' : `${c6.L - 1}·`}${c6.S}·${c6.B} = ${c6.T} 次（第 9 讲第 53 至 54 页）。最后一层给出 ${c6.S * c6.B} 个高斯分布 N(m, C)，不抽样，对数似然 ln p(y ∣ f) 对它们求积分（第 54 至 55 页）。每次抽样都是单变量的（第 51 页）。只处理小批量，所以 N = ${c6.N} 不参与计算：用它会得到 ${c6.r2}。最后一层也抽样会得到 ${c6.r1}，忘了 S 个样本则得到 ${c6.r3}。本游戏在这一关不考查证据下界中的 KL 项。`
      ),
      audit: { kind: 'GP-25:sample-count', params: { L: c6.L, B: c6.B, N: c6.N, S: c6.S } },
    }),

    // Card 7
    g.number({
      id: 'sample-average',
      title: t('Averaging over the samples', '对样本取平均'),
      prompt: t(
        `For one data point with target y = ${num(c7.y)}, doubly stochastic VI draws two samples at layer L − 1. At the last layer they give two Gaussians for f, N(${num(c7.m1)}, ${num(c7.c1v)}) and N(${num(c7.m2)}, ${num(c7.c2v)}) (mean, variance), one per sample. For one Gaussian N(m, C) the expectation of (y − f)² is (y − m)² + C. Estimate the expected squared error of f under q, using the two samples to approximate q. Give an integer, a fraction or a decimal rounded to 2 places.`,
        `对目标值为 y = ${num(c7.y)} 的一个数据点，双随机变分推断在第 L − 1 层抽取两个样本。在最后一层，它们各给出 f 的一个高斯分布，N(${num(c7.m1)}, ${num(c7.c1v)}) 与 N(${num(c7.m2)}, ${num(c7.c2v)})（均值，方差）。对一个高斯分布 N(m, C)，(y − f)² 的期望为 (y − m)² + C。请用这两个样本近似 q，估计 f 在 q 下的期望平方误差。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('estimate of E[(y − f)²]', 'E[(y − f)²] 的估计'), answer: c7.T, tolerance: 0.006 }],
      hint: t('Decide whether the two samples should be combined before or after taking the expectation.', '想一想，两个样本应该在取期望之前还是之后合并。'),
      explanation: t(
        `Each sample gives its own Gaussian, and the estimate averages the expectations over the samples (Lecture 9 p. 55): ((y − m)² + C) is ${num(c7.e1)} for the first sample and ${num(c7.e2)} for the second, and their average is (${num(c7.e1)} + ${num(c7.e2)})/2 = ${num(c7.T)}. Plugging the averaged mean ${num(c7.mb)} and variance ${num(c7.cb)} into one Gaussian gives ${num(c7.plug)}, which is smaller by (m₁ − m₂)²/4 = ${num((c7.m1 - c7.m2) * (c7.m1 - c7.m2) / 4)}: the samples spread the mean of q(f), and one Gaussian built from the averages ignores this spread. Using the first sample only gives ${num(c7.e1)}, and dropping the variances gives ${num(c7.r3)}. This game does not assess the KL terms of the bound.`,
        `每个样本给出各自的高斯分布，估计值是各样本期望的平均（第 9 讲第 55 页）：第一个样本的 (y − m)² + C 为 ${num(c7.e1)}，第二个为 ${num(c7.e2)}，平均为 (${num(c7.e1)} + ${num(c7.e2)})/2 = ${num(c7.T)}。把平均后的均值 ${num(c7.mb)} 与方差 ${num(c7.cb)} 放进同一个高斯分布得到 ${num(c7.plug)}，比正确值小 (m₁ − m₂)²/4 = ${num((c7.m1 - c7.m2) * (c7.m1 - c7.m2) / 4)}：样本使 q(f) 的均值分散开，由平均值构造的单个高斯分布忽略了这种分散。只用第一个样本得到 ${num(c7.e1)}，去掉方差则得到 ${num(c7.r3)}。本游戏在这一关不考查证据下界中的 KL 项。`
      ),
      audit: { kind: 'GP-25:sample-average', params: { y: c7.y, m1: c7.m1, c1: c7.c1v, m2: c7.m2, c2: c7.c2v } },
    }),

    // Card 8
    g.choice({
      id: 'collapsed-layer',
      title: t('A layer that has been turned off', '被关闭的一层'),
      prompt: t(
        `A deep GP with L = ${c8.L} layers is trained by variational inference. Afterwards the variance of the output of layer ${c8.k} is about ${num(c8.t)} at every input, while the other layers keep variances near 1. Which statement is correct?`,
        `用变分推断训练一个有 L = ${c8.L} 层的深度高斯过程后，第 ${c8.k} 层输出的方差在所有输入处都约为 ${num(c8.t)}，其余各层的方差保持在 1 附近。下列哪个说法正确？`
      ),
      options: [
        t(`Layer ${c8.k} acts almost like a deterministic mapping and adds little uncertainty`, `第 ${c8.k} 层近似于确定性映射，几乎不增加不确定性`),
        t(`Layer ${c8.k} now adds the most uncertainty, since its small variance gives a large precision`, `第 ${c8.k} 层现在带来最多的不确定性，因为它的小方差意味着大精度`),
        t(`The bound now has ${c8.L - 1} KL terms, since layer ${c8.k} no longer takes part in the model`, `证据下界现在只有 ${c8.L - 1} 个 KL 项，因为第 ${c8.k} 层不再属于模型`),
        t(`Layer ${c8.k} is now the roughest layer, since a small variance makes its samples jump sharply`, `第 ${c8.k} 层现在最粗糙，因为小方差使它的样本剧烈跳变`)
      ],
      correct: 0,
      hint: t('Compare how much a layer\'s output can vary, for a fixed input, with its variance.', '比较输入固定时一层输出能变化多少，以及它的方差。'),
      explanation: t(
        `Variational inference tends to turn layers off or to shrink their variance towards zero, so that they behave like deterministic mappings (Lecture 9 p. 69). A variance of ${num(c8.t)} means that for a fixed input the output of layer ${c8.k} hardly varies, so the layer adds almost no uncertainty of its own. The option that calls it the most uncertain mixes up a small variance with a large one (a large precision is a small variance). The layer is still part of the model, so the bound keeps all ${c8.L} KL terms, one per layer (p. 44), not ${c8.L - 1}. Variance is the amplitude of the layer, not its roughness, which the length-scale controls. This game does not assess how to avoid this failure.`,
        `变分推断倾向于关闭某些层，或把它们的方差压到接近零，使它们表现得像确定性映射（第 9 讲第 69 页）。方差为 ${num(c8.t)} 意味着输入固定时第 ${c8.k} 层的输出几乎不变化，所以这一层几乎不增加自己的不确定性。认为它不确定性最大的选项把小方差和大方差弄反了（大精度对应小方差）。这一层仍属于模型，所以证据下界仍有全部 ${c8.L} 个 KL 项，每层一个（第 44 页），而不是 ${c8.L - 1} 个。方差是这一层的幅度，而不是粗糙程度，粗糙程度由长度尺度控制。本游戏在这一关不考查如何避免这种失败。`
      ),
    }),

    // Card 9
    g.number({
      id: 'challenge',
      title: t('Challenge: expected squared error through two layers', '挑战：穿过两层的期望平方误差'),
      prompt: t(
        `A two-layer deep GP is evaluated at one training input with target y = ${num(c9.y)}. Doubly stochastic VI draws S = ${c9.S} samples of the layer-1 output: ${c9_alist}. Layer 2 has the identity mean μ₂(u) = u and, for every input u, the variance ${num(c9.v)}. Estimate the expected squared error of the layer-2 output f under q, using the S samples to approximate q. Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个两层深度高斯过程在某个训练输入处计算，目标值为 y = ${num(c9.y)}。双随机变分推断抽取第 1 层输出的 S = ${c9.S} 个样本：${c9_alist}。第 2 层的均值函数为恒等映射 μ₂(u) = u，且对每个输入 u，方差都是 ${num(c9.v)}。请用这 S 个样本近似 q，估计第 2 层输出 f 在 q 下的期望平方误差。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('expected squared error', '期望平方误差'), answer: c9.T, tolerance: 0.006 }],
      hint: t('Two steps are needed.', '需要两步。'),
      explanation: t(
        `Given the layer-1 sample a, the identity mean makes the layer-2 output Gaussian with mean a and variance ${num(c9.v)}, so the sample gives the expectation (y − a)² + ${num(c9.v)} (Lecture 9 pp. 24–25). The estimate averages these over the ${c9.S} samples (p. 55): (${c9_sumExpr})/${c9.S} + ${num(c9.v)} = ${num(c9.msq)} + ${num(c9.v)} = ${num(c9.T)}. Replacing the samples by their mean ${num(c9.abar)} gives (y − ${par(c9.abar)})² + ${num(c9.v)}${c9_plugEq}, which ignores the spread of the samples, and using only the first sample gives ${num(c9.first)}. The variance ${num(c9.v)} is added once, not once per sample (that would give ${num(c9.r4)}). This game does not assess the KL terms of the bound or the sparse inducing structure.`,
        `给定第 1 层的样本 a，恒等均值使第 2 层输出服从均值为 a、方差为 ${num(c9.v)} 的高斯分布，所以这个样本给出的期望是 (y − a)² + ${num(c9.v)}（第 9 讲第 24 至 25 页）。估计值是这 ${c9.S} 个样本上的平均（第 55 页）：(${c9_sumExpr})/${c9.S} + ${num(c9.v)} = ${num(c9.msq)} + ${num(c9.v)} = ${num(c9.T)}。用样本的均值 ${num(c9.abar)} 代替样本得到 (y − ${par(c9.abar)})² + ${num(c9.v)}${c9_plugEq}，它忽略了样本的分散；只用第一个样本得到 ${num(c9.first)}。方差 ${num(c9.v)} 只加一次，而不是每个样本加一次（那样会得到 ${num(c9.r4)}）。本游戏在这一关不考查证据下界中的 KL 项和稀疏诱导结构。`
      ),
      audit: { kind: 'GP-25:challenge', params: { y: c9.y, v: c9.v, S: c9.S, ...Object.fromEntries(c9.a.map((a, i) => [`a${i + 1}`, a])) } },
    }),
  ];
};
