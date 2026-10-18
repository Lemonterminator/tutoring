import type { CardGenerator } from '../../types';
import { fitView, type FigureShape } from '../../figure';
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
function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { const r = a % b; a = b; b = r; } return a; }
function denom(n: number, d: number): number { return d / gcd(n, d); }
/** Plan: a sampled answer must have reduced denominator in {1, 2, 4}, i.e. be exact in binary and typeable as a decimal. */
const DENOM_OK = [1, 2, 4];

const PRE = t(
  'Two assets have unknown expected returns μ = (μ₁, μ₂), in % per year. In the Black–Litterman model (Black & Litterman 1992) the prior is μ ~ N(π, A): π holds the equilibrium returns implied by market weights, and A = τΣ is the covariance matrix Σ of returns scaled by a small number τ (entries in %²). A view is a noisy linear statement Pμ = q + ε with ε ~ N(0, Ω); a small Ω means a confident view (He & Litterman 1999).',
  '两种资产的期望收益 μ = (μ₁, μ₂) 未知（单位：% 每年）。在 Black–Litterman 模型（Black 与 Litterman，1992）中，先验为 μ ~ N(π, A)：π 是由市场权重隐含的均衡收益，A = τΣ 是收益协方差矩阵 Σ 乘以一个很小的数 τ 后得到的矩阵（元素单位：%²）。观点是带噪声的线性陈述 Pμ = q + ε，其中 ε ~ N(0, Ω)；Ω 越小，观点越有把握（He 与 Litterman，1999）。'
);
const SHORT = t(
  'Black–Litterman prior μ ~ N(π, A) for two assets\' expected returns (% per year, A in %²); a view is Pμ = q + ε with ε ~ N(0, Ω).',
  '两种资产期望收益的 Black–Litterman 先验为 μ ~ N(π, A)（% 每年，A 的单位为 %²）；观点为 Pμ = q + ε，ε ~ N(0, Ω)。'
);
const OBS = t(
  'Write the view as an observation y = Pμ + ε′ with ε′ = −ε ~ N(0, Ω) and y = q; this is a GP regression with the observation operator P.',
  '把观点写成观测 y = Pμ + ε′，其中 ε′ = −ε ~ N(0, Ω)，y = q；这就是带观测算子 P 的高斯过程回归。'
);
const viewText = (abs: boolean, qv?: number) => ((q: string) => t(
  abs ? `The view is absolute, 'asset 1 will return ${q}% per year': P = ${mat([[num(1), num(0)]])}.`
      : `The view is relative, 'asset 1 will outperform asset 2 by ${q}% per year': P = ${mat([[num(1), num(-1)]])}.`,
  abs ? `这是一个绝对观点，「资产 1 的年收益将为 ${q}%」：P = ${mat([[num(1), num(0)]])}。`
      : `这是一个相对观点，「资产 1 每年将比资产 2 多 ${q}%」：P = ${mat([[num(1), num(-1)]])}。`
))(qv === undefined ? 'q' : num(qv));

export const gpf3: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-F3');
  warm(g);

  // ---- Card 1: dictionary ----
  const targets = [
    { key: 'pi', en: 'the prior mean m of f', zh: 'f 的先验均值 m', opt: 'π, the equilibrium returns', optZh: 'π，均衡收益', explEn: 'The prior of μ is N(π, τΣ), exactly like f ~ N(m, K) (Lecture 3 p. 7): π is the prior mean.', explZh: 'μ 的先验是 N(π, τΣ)，与 f ~ N(m, K) 完全一样（第 3 讲第 7 页）：π 是先验均值。' },
    { key: 'tauSigma', en: 'the prior covariance K of f', zh: 'f 的先验协方差 K', opt: 'τΣ, the scaled covariance of returns', optZh: 'τΣ，缩放后的收益协方差', explEn: 'The prior covariance of μ is τΣ, the role of K in f ~ N(m, K) (Lecture 3 p. 7).', explZh: 'μ 的先验协方差是 τΣ，对应 f ~ N(m, K) 中的 K（第 3 讲第 7 页）。' },
    { key: 'Omega', en: 'the noise covariance Σ_ε of the observations', zh: '观测噪声的协方差 Σ_ε', opt: 'Ω, the uncertainty of the views', optZh: 'Ω，各观点的不确定性', explEn: 'The view Pμ = q + ε has noise ε ~ N(0, Ω); in GP regression the noise covariance is σ²_obs I (Lecture 3 p. 5), here the general matrix Ω.', explZh: '观点 Pμ = q + ε 的噪声是 ε ~ N(0, Ω)；高斯过程回归中噪声协方差是 σ²_obs I（第 3 讲第 5 页），这里推广为一般矩阵 Ω。' },
    { key: 'q', en: 'the observed data y', zh: '观测数据 y', opt: 'q, the values the views state', optZh: 'q，各观点所陈述的数值', explEn: 'The views state the values q; written as an observation y = Pμ + ε′ with ε′ = −ε, they are the data y.', explZh: '观点陈述数值 q；写成观测 y = Pμ + ε′（ε′ = −ε）后，q 就是数据 y。' },
    { key: 'P', en: 'the observation operator H (the identity matrix in Lecture 3)', zh: '观测算子 H（第 3 讲中是单位矩阵）', opt: 'P, the matrix that picks the combinations the views talk about', optZh: 'P，选出各观点所涉及的收益组合的矩阵', explEn: 'In Lecture 3 the data are y = f + ε, i.e. H = I. A view looks at a combination of μ, for example μ₁ or μ₁ − μ₂; the matrix P that forms it is the operator H.', explZh: '第 3 讲的数据是 y = f + ε，即 H = I。观点看的是 μ 的某个组合，例如 μ₁ 或 μ₁ − μ₂；构造这个组合的矩阵 P 就是算子 H。' },
  ];
  const dictTarget = targets[g.random(0, targets.length - 1)];
  const allKeys = targets.map(x => x.key);
  const distractorKeys = allKeys.filter(k => k !== dictTarget.key);
  const omittedKey = distractorKeys[g.random(0, distractorKeys.length - 1)];
  const shownKeys = allKeys.filter(k => k !== omittedKey);
  const shownTargets = shownKeys.map(k => targets.find(x => x.key === k)!);
  const dictOptions = shownTargets.map(x => t(x.opt, x.optZh));
  const dictCorrect = shownKeys.indexOf(dictTarget.key);
  const distractorClauses = shownTargets.filter(x => x.key !== dictTarget.key).map(x => {
    const map: Record<string, [string, string]> = {
      pi: ['π is the prior mean of μ (GP: m).', 'π 是 μ 的先验均值（对应 m）。'],
      tauSigma: ['τΣ is the prior covariance of μ (GP: K).', 'τΣ 是 μ 的先验协方差（对应 K）。'],
      P: ['P forms the viewed combinations from μ (GP: the operator H).', 'P 由 μ 构造被观点涉及的组合（对应算子 H）。'],
      Omega: ['Ω is the covariance of the view noise (GP: Σ_ε).', 'Ω 是观点噪声的协方差（对应 Σ_ε）。'],
      q: ['q holds the values the views state (GP: the data y).', 'q 是各观点所陈述的数值（对应数据 y）。'],
    };
    const [en, zh] = map[x.key];
    return t(en, zh);
  });
  const dictExpl = t(
    dictTarget.explEn + ' ' + distractorClauses.map(c => c[0]).join(' '),
    dictTarget.explZh + ' ' + distractorClauses.map(c => c[1]).join(' ')
  );

  // ---- Card 2: formula ----
  const formulaVariant = g.random(0, 1) === 0 ? 'mean' : 'covariance';
  const formulaView = g.random(0, 2); // 0=abs, 1=rel, 2=I
  const formulaPMat = formulaView === 0 ? mat([[num(1), num(0)]]) : formulaView === 1 ? mat([[num(1), num(-1)]]) : mat([[num(1), num(0)], [num(0), num(1)]]);
  let formulaBefore: Text, formulaBetween: string[], formulaAfter: Text, formulaAnswers: string[], formulaTokens: string[];
  if (formulaVariant === 'mean') {
    formulaBefore = t('μ_BL = π + ', 'μ_BL = π + ');
    formulaBetween = [' · ', ' · '];
    formulaAfter = t('.', '。');
    formulaAnswers = ['τΣPᵀ', '(PτΣPᵀ + Ω)⁻¹', '(q − Pπ)'];
    formulaTokens = shuffled(g, ['τΣPᵀ', '(PτΣPᵀ + Ω)⁻¹', '(q − Pπ)', '(PτΣPᵀ + Ω)', '(Pπ − q)', 'PᵀτΣ', '(q − π)', 'Ω⁻¹']);
  } else {
    formulaBefore = t('Cov(μ | q) = τΣ − ', 'Cov(μ | q) = τΣ − ');
    formulaBetween = [' · (PτΣPᵀ + Ω)⁻¹ · '];
    formulaAfter = t('.', '。');
    formulaAnswers = ['τΣPᵀ', 'PτΣ'];
    formulaTokens = shuffled(g, ['τΣPᵀ', 'PτΣ', 'PᵀτΣ', 'τΣP', 'τΣ', 'Ω', 'Pπ']);
  }
  const formulaExpl = t(
    'C = Cov(μ, q) = τΣPᵀ and B = Cov(q) = PτΣPᵀ + Ω, so μ_BL = π + τΣPᵀ(PτΣPᵀ + Ω)⁻¹(q − Pπ) and Cov(μ | q) = τΣ − τΣPᵀ(PτΣPᵀ + Ω)⁻¹PτΣ (Black–Litterman 1992; GPML A.6; in Lecture 3 words k*ᵀ → τΣPᵀ, K + σ²_obs I → PτΣPᵀ + Ω, y − m → q − Pπ). The covariance contains no q, as the posterior variance in Lecture 3 p. 6 contains no y. It is the covariance of the expected returns μ, not of the returns.',
    'C = Cov(μ, q) = τΣPᵀ，B = Cov(q) = PτΣPᵀ + Ω，所以 μ_BL = π + τΣPᵀ(PτΣPᵀ + Ω)⁻¹(q − Pπ)，Cov(μ | q) = τΣ − τΣPᵀ(PτΣPᵀ + Ω)⁻¹PτΣ（Black–Litterman 1992；GPML 附录 A.6；用第 3 讲的记号：k*ᵀ → τΣPᵀ，K + σ²_obs I → PτΣPᵀ + Ω，y − m → q − Pπ）。协方差里没有 q，正如第 3 讲第 6 页的后验方差里没有 y。它是期望收益 μ 的协方差，不是收益本身的协方差。'
  );

  // ---- Card 3: joint-cov ----
  const jc = retry(() => {
    const abs = g.random(0, 1) === 0;
    const a = 2 + g.random(0, 4);
    const d = 2 + g.random(0, 4);
    const b = -2 + g.random(0, 4);
    const w = 1 + g.random(0, 3);
    return { abs, a, d, b, w };
  }, v => v.a * v.d - v.b * v.b >= 3);
  const jcP1 = jc.abs ? 1 : 1;
  const jcP2 = jc.abs ? 0 : -1;
  const jcU1 = jc.a * jcP1 + jc.b * jcP2;
  const jcU2 = jc.b * jcP1 + jc.d * jcP2;
  const jcS = jcP1 * jcU1 + jcP2 * jcU2 + jc.w;
  const jcExpl = jc.abs
    ? t(`APᵀ is the first column of A, (${num(jc.a)}, ${num(jc.b)}), and PAPᵀ = ${num(jc.a)}; adding Ω gives Var(y) = ${num(jc.a)} + ${num(jc.w)} = ${num(jcS)}. In GP terms (${num(jc.a)}, ${num(jc.b)}) plays k* and ${num(jcS)} plays K + σ²_obs I (Lecture 3 p. 6).`,
      `APᵀ 是 A 的第一列 (${num(jc.a)}, ${num(jc.b)})，PAPᵀ = ${num(jc.a)}；加上 Ω 得 Var(y) = ${num(jc.a)} + ${num(jc.w)} = ${num(jcS)}。用高斯过程的语言，(${num(jc.a)}, ${num(jc.b)}) 对应 k*，${num(jcS)} 对应 K + σ²_obs I（第 3 讲第 6 页）。`)
    : t(`APᵀ = (first column) − (second column) = (${num(jc.a)} − ${par(jc.b)}, ${par(jc.b)} − ${num(jc.d)}) = (${num(jcU1)}, ${num(jcU2)}); PAPᵀ = u₁ − u₂ = ${num(jcU1 - jcU2)}; adding Ω gives Var(y) = ${num(jcU1 - jcU2)} + ${num(jc.w)} = ${num(jcS)}.`,
      `APᵀ = 第一列 − 第二列 = (${num(jc.a)} − ${par(jc.b)}, ${par(jc.b)} − ${num(jc.d)}) = (${num(jcU1)}, ${num(jcU2)})；PAPᵀ = u₁ − u₂ = ${num(jcU1 - jcU2)}；加上 Ω 得 Var(y) = ${num(jcU1 - jcU2)} + ${num(jc.w)} = ${num(jcS)}。`);

  // ---- Card 4: bl-mean ----
  const bm = retry(() => {
    const abs = g.random(0, 1) === 0;
    const a = 2 + g.random(0, 4);
    const d = 2 + g.random(0, 4);
    const b = -2 + g.random(0, 4);
    const w = 1 + g.random(0, 5);
    const pi1 = 3 + g.random(0, 6);
    const pi2 = 3 + g.random(0, 6);
    const delta = (g.random(0, 1) === 0 ? 1 : -1) * (1 + g.random(0, 5));
    const p1 = abs ? 1 : 1;
    const p2 = abs ? 0 : -1;
    const ppi = p1 * pi1 + p2 * pi2;
    const q = ppi + delta;
    const u1 = a * p1 + b * p2;
    const u2 = b * p1 + d * p2;
    const v = p1 * u1 + p2 * u2;
    const s = v + w;
    const m1 = pi1 + u1 * delta / s;
    const m2 = pi2 + u2 * delta / s;
    return { abs, a, d, b, w, pi1, pi2, delta, p1, p2, ppi, q, u1, u2, v, s, m1, m2 };
  }, v => {
    if (v.a * v.d - v.b * v.b < 3) return false;
    if (v.s > 12) return false;
    if (v.q < 1 || v.q > 12) return false;
    if (!DENOM_OK.includes(denom(v.u1 * v.delta, v.s))) return false;
    if (!DENOM_OK.includes(denom(v.u2 * v.delta, v.s))) return false;
    return true;
  });
  const bmShapes: FigureShape[] = [
    { kind: 'point', at: [bm.pi1, bm.pi2], tone: 'accent', label: 'π' },
  ];
  if (bm.abs) {
    bmShapes.push({ kind: 'line', points: [[bm.q, bm.pi2 - 4], [bm.q, bm.pi2 + 4]], tone: 'warn', label: 'Pμ = q' });
  } else {
    bmShapes.push({ kind: 'line', points: [[bm.pi2 - 4 + bm.q, bm.pi2 - 4], [bm.pi2 + 4 + bm.q, bm.pi2 + 4]], tone: 'warn', label: 'Pμ = q' });
  }
  const bmExplParts: string[] = [];
  const bmExplPartsZh: string[] = [];
  bmExplParts.push(`Pπ = ${num(bm.ppi)} and q − Pπ = ${num(bm.delta)}; APᵀ = (${num(bm.u1)}, ${num(bm.u2)}) and PAPᵀ + Ω = ${num(bm.v)} + ${num(bm.w)} = ${num(bm.s)}. So μ_BL = (${num(bm.pi1)}, ${num(bm.pi2)}) + (${num(bm.delta)}/${num(bm.s)})·(${num(bm.u1)}, ${num(bm.u2)}) = (${exact(bm.m1)}, ${exact(bm.m2)}).`);
  bmExplPartsZh.push(`Pπ = ${num(bm.ppi)}，q − Pπ = ${num(bm.delta)}；APᵀ = (${num(bm.u1)}, ${num(bm.u2)})，PAPᵀ + Ω = ${num(bm.v)} + ${num(bm.w)} = ${num(bm.s)}。所以 μ_BL = (${num(bm.pi1)}, ${num(bm.pi2)}) + (${num(bm.delta)}/${num(bm.s)})·(${num(bm.u1)}, ${num(bm.u2)}) = (${exact(bm.m1)}, ${exact(bm.m2)})。`);
  if (bm.abs && bm.b !== 0) {
    const shift2 = bm.b * bm.delta / bm.s;
    bmExplParts.push(`The view mentions only asset 1, but asset 2 moves by ${par(bm.b)}·${par(bm.delta)}/${num(bm.s)} = ${exact(shift2)} because the two returns are correlated (Cov = ${num(bm.b)}).`);
    bmExplPartsZh.push(`观点只提到资产 1，但资产 2 也移动了 ${par(bm.b)}·${par(bm.delta)}/${num(bm.s)} = ${exact(shift2)}，因为两种收益相关（协方差 ${num(bm.b)}）。`);
  } else if (bm.abs && bm.b === 0) {
    bmExplParts.push('Asset 2 does not move: it is uncorrelated with asset 1.');
    bmExplPartsZh.push('资产 2 没有移动：它与资产 1 不相关。');
  } else {
    bmExplParts.push(`A relative view moves the two assets in opposite directions along APᵀ = (${num(bm.u1)}, ${num(bm.u2)}). The precision form gives the same mean; the posterior covariance is A − APᵀPA/${num(bm.s)}.`);
    bmExplPartsZh.push(`相对观点沿 APᵀ = (${num(bm.u1)}, ${num(bm.u2)}) 使两种资产朝相反方向移动。用精度形式会得到同样的均值；后验协方差为 A − APᵀPA/${num(bm.s)}。`);
  }

  // ---- Card 5: bl-var ----
  const bv = retry(() => {
    const a = 2 + g.random(0, 4);
    const d = 2 + g.random(0, 5);
    const b = [-3, -2, -1, 1, 2, 3][g.random(0, 5)];
    const w = 1 + g.random(0, 5);
    return { a, d, b, w };
  }, v => {
    if (v.a * v.d - v.b * v.b < 3) return false;
    if (!DENOM_OK.includes(denom(v.b * v.b, v.a + v.w))) return false;
    return true;
  });
  const bvS = bv.a + bv.w;
  const bvAns = bv.d - (bv.b * bv.b) / bvS;
  const bvExpl = t(
    `APᵀ = (${num(bv.a)}, ${num(bv.b)}) and PAPᵀ + Ω = ${num(bv.a)} + ${num(bv.w)} = ${num(bvS)}. The (2, 2) entry of A − APᵀPA/${num(bvS)} is ${num(bv.d)} − ${par(bv.b)}²/${num(bvS)} = ${num(bv.d)} − ${exact((bv.b * bv.b) / bvS)} = ${exact(bvAns)}. Asset 2 has no view, yet its variance drops from ${num(bv.d)} to ${exact(bvAns)} because it is correlated with asset 1; the drop ${par(bv.b)}²/${num(bvS)} does not depend on the sign of the correlation and not on q (the posterior covariance contains no data, Lecture 3 p. 6).`,
    `APᵀ = (${num(bv.a)}, ${num(bv.b)})，PAPᵀ + Ω = ${num(bv.a)} + ${num(bv.w)} = ${num(bvS)}。A − APᵀPA/${num(bvS)} 的 (2, 2) 元素为 ${num(bv.d)} − ${par(bv.b)}²/${num(bvS)} = ${num(bv.d)} − ${exact((bv.b * bv.b) / bvS)} = ${exact(bvAns)}。资产 2 没有观点，但它的方差从 ${num(bv.d)} 降到 ${exact(bvAns)}，因为它与资产 1 相关；降低量 ${par(bv.b)}²/${num(bvS)} 与相关的符号无关，也与 q 无关（后验协方差不含数据，第 3 讲第 6 页）。`
  );

  // ---- Card 6: precision ----
  const precPairs = [[2, 2], [2, 6], [3, 1], [3, 3], [4, 4], [6, 2], [6, 6]];
  const pc = retry(() => {
    const pair = precPairs[g.random(0, precPairs.length - 1)];
    const a = pair[0];
    const w = pair[1];
    const pi1 = 3 + g.random(0, 6);
    const q = 1 + g.random(0, 13);
    return { a, w, pi1, q };
  }, v => {
    if (v.q === v.pi1) return false;
    const mean = (v.w * v.pi1 + v.a * v.q) / (v.a + v.w);
    if (!DENOM_OK.includes(denom(v.w * v.pi1 + v.a * v.q, v.a + v.w))) return false;
    return true;
  });
  const pcVar = (pc.a * pc.w) / (pc.a + pc.w);
  const pcMean = (pc.w * pc.pi1 + pc.a * pc.q) / (pc.a + pc.w);
  const pcPrec = 1 / pc.a + 1 / pc.w;
  const pcWt = pc.a / (pc.a + pc.w);
  const pcExpl = t(
    `Precisions: 1/${num(pc.a)} + 1/${num(pc.w)} = ${exact(pcPrec)}, so the posterior variance is ${exact(pcVar)}. Mean = ${exact(pcVar)}·(${num(pc.pi1)}/${num(pc.a)} + ${num(pc.q)}/${num(pc.w)}) = ${exact(pcMean)}. The covariance form (a = ${num(pc.a)} is the prior variance, w = ${num(pc.w)} the noise variance) gives the same numbers: variance a − a²/(a + w) = ${num(pc.a)} − ${num(pc.a)}²/${num(pc.a + pc.w)} = ${exact(pcVar)}, mean π₁ + a(q − π₁)/(a + w) = ${num(pc.pi1)} + ${num(pc.a)}·(${num(pc.q)} − ${num(pc.pi1)})/${num(pc.a + pc.w)} = ${exact(pcMean)}. In matrix form the same statement reads Λ = (τΣ)⁻¹ + PᵀΩ⁻¹P for the posterior precision and μ_BL = Λ⁻¹((τΣ)⁻¹π + PᵀΩ⁻¹q): the posterior mean is a precision-weighted average of the prior mean and the view, with weight on the view a/(a + w) = ${exact(pcWt)}.`,
    `精度：1/${num(pc.a)} + 1/${num(pc.w)} = ${exact(pcPrec)}，所以后验方差为 ${exact(pcVar)}。均值 = ${exact(pcVar)}·(${num(pc.pi1)}/${num(pc.a)} + ${num(pc.q)}/${num(pc.w)}) = ${exact(pcMean)}。协方差形式（a = ${num(pc.a)} 为先验方差，w = ${num(pc.w)} 为噪声方差）给出同样的数：方差 a − a²/(a + w) = ${num(pc.a)} − ${num(pc.a)}²/${num(pc.a + pc.w)} = ${exact(pcVar)}，均值 π₁ + a(q − π₁)/(a + w) = ${num(pc.pi1)} + ${num(pc.a)}·(${num(pc.q)} − ${num(pc.pi1)})/${num(pc.a + pc.w)} = ${exact(pcMean)}。矩阵形式的同一结论是：后验精度 Λ = (τΣ)⁻¹ + PᵀΩ⁻¹P，μ_BL = Λ⁻¹((τΣ)⁻¹π + PᵀΩ⁻¹q)：后验均值是先验均值与观点按精度加权的平均，观点的权重为 a/(a + w) = ${exact(pcWt)}。`
  );

  // ---- Card 7: limits ----
  const lm = retry(() => {
    const limit = g.random(0, 1) === 0 ? 0 : 1; // 0 = Omega->0, 1 = Omega->inf
    const abs = g.random(0, 1) === 0;
    const pi1 = 3 + g.random(0, 6);
    const pi2 = 3 + g.random(0, 6);
    const delta = [-4, -2, 2, 4][g.random(0, 3)];
    const p1 = abs ? 1 : 1;
    const p2 = abs ? 0 : -1;
    const m = p1 * pi1 + p2 * pi2;
    const q = m + delta;
    const a = 2 + g.random(0, 4);
    const d = 2 + g.random(0, 4);
    const b = -2 + g.random(0, 4);
    return { limit, abs, pi1, pi2, delta, p1, p2, m, q, a, d, b };
  }, v => {
    if (v.a * v.d - v.b * v.b < 3) return false;
    if (v.q < 1 || v.q > 12) return false;
    return true;
  });
  const lmMid = (lm.m + lm.q) / 2;
  const lmOptions = [
    t(`${num(lm.q)}, the value q of the view`, `${num(lm.q)}，即观点的数值 q`),
    t(`${num(lm.m)}, the prior value Pπ`, `${num(lm.m)}，即先验值 Pπ`),
    t(`${num(lmMid)}, halfway between Pπ and q`, `${num(lmMid)}，即 Pπ 与 q 的中点`),
    t('It cannot be decided without the entries of A', '不知道 A 的各元素就无法确定'),
  ];
  const lmCorrect = lm.limit === 0 ? 0 : 1;
  const lmV = lm.abs ? lm.a : lm.a - 2 * lm.b + lm.d;
  const lmExpl = t(
    `With v = PAPᵀ = ${num(lmV)}, the posterior mean of Pμ is Pπ + v(q − Pπ)/(v + Ω) = ${num(lm.m)} + ${num(lmV)}·(${num(lm.q)} − ${par(lm.m)})/(${num(lmV)} + Ω): the weight of the view is v/(v + Ω). ${lm.limit === 0 ? 'The weight tends to 1, so the posterior mean tends to q = ' + num(lm.q) + ': the view is forced, and the posterior variance of Pμ, vΩ/(v + Ω), tends to 0.' : 'The weight tends to 0, so the posterior mean stays at the prior value Pπ = ' + num(lm.m) + ': the view is ignored, and the posterior variance of Pμ tends to the prior variance v = ' + num(lmV) + '.'} The midpoint ${num(lmMid)} would need the weight 1/2, i.e. Ω = v. The entries of A only change how fast the limit is reached.`,
    `记 v = PAPᵀ = ${num(lmV)}，Pμ 的后验均值为 Pπ + v(q − Pπ)/(v + Ω) = ${num(lm.m)} + ${num(lmV)}·(${num(lm.q)} − ${par(lm.m)})/(${num(lmV)} + Ω)：观点的权重是 v/(v + Ω)。${lm.limit === 0 ? '权重趋于 1，后验均值趋于 q = ' + num(lm.q) + '：观点被强制满足，Pμ 的后验方差 vΩ/(v + Ω) 趋于 0。' : '权重趋于 0，后验均值停在先验值 Pπ = ' + num(lm.m) + '：观点被忽略，Pμ 的后验方差趋于先验方差 v = ' + num(lmV) + '。'}中点 ${num(lmMid)} 需要权重为 1/2，即 Ω = v。A 的元素只影响趋近极限的快慢。`
  );

  // ---- Card 8: assumption ----
  const as = retry(() => {
    const a = 2 + g.random(0, 3);
    const b = [-1, 0, 1][g.random(0, 2)];
    const w = 1 + g.random(0, 2);
    const singular = g.random(0, 2); // 0=S1, 1=S2, 2=S3
    const invertibleChoices = [0, 1, 2, 3];
    const omitted = invertibleChoices[g.random(0, 3)];
    const shownInvertible = invertibleChoices.filter(x => x !== omitted);
    return { a, b, w, singular, shownInvertible };
  }, () => true);
  const asC = 2 * as.a - 2 * as.b;
  const asAmb = as.a - as.b;
  const asAw = as.a + as.w;
  const asDet1 = as.a * as.a - as.b * as.b;
  const asDet2 = as.w * (2 * as.a + as.w);
  const singularOptions = [
    t(`Two views, both 'asset 1 will return a given amount' (P = ${mat([[num(1), num(0)], [num(1), num(0)]])}), each stated with certainty (Ω = 0)`,
      `两个观点，都是「资产 1 将获得给定收益」（P = ${mat([[num(1), num(0)], [num(1), num(0)]])}），且都完全确定（Ω = 0）`),
    t(`Two views, both 'asset 1 will outperform asset 2' (P = ${mat([[num(1), num(-1)], [num(1), num(-1)]])}), each stated with certainty (Ω = 0)`,
      `两个观点，都是「资产 1 将跑赢资产 2」（P = ${mat([[num(1), num(-1)], [num(1), num(-1)]])}），且都完全确定（Ω = 0）`),
    t(`Two views, 'asset 1 outperforms asset 2' and 'twice the outperformance' (P = ${mat([[num(1), num(-1)], [num(2), num(-2)]])}), both stated with certainty (Ω = 0)`,
      `两个观点，「资产 1 跑赢资产 2」与「跑赢幅度的两倍」（P = ${mat([[num(1), num(-1)], [num(2), num(-2)]])}），且都完全确定（Ω = 0）`),
  ];
  const invertibleOptions = [
    t(`Two views, 'asset 1 will return q₁' and 'asset 2 will return q₂' (P = ${mat([[num(1), num(0)], [num(0), num(1)]])}), both stated with certainty (Ω = 0)`,
      `两个观点，「资产 1 将获得 q₁」与「资产 2 将获得 q₂」（P = ${mat([[num(1), num(0)], [num(0), num(1)]])}），且都完全确定（Ω = 0）`),
    t(`Two views, both 'asset 1 will return a given amount' (P = ${mat([[num(1), num(0)], [num(1), num(0)]])}), each with uncertainty ${num(as.w)} (Ω = ${mat([[num(as.w), num(0)], [num(0), num(as.w)]])})`,
      `两个观点，都是「资产 1 将获得给定收益」（P = ${mat([[num(1), num(0)], [num(1), num(0)]])}），各自的不确定性为 ${num(as.w)}（Ω = ${mat([[num(as.w), num(0)], [num(0), num(as.w)]])}）`),
    t(`One view, 'asset 1 will outperform asset 2' (P = ${mat([[num(1), num(-1)]])}), stated with certainty (Ω = 0)`,
      `一个观点，「资产 1 将跑赢资产 2」（P = ${mat([[num(1), num(-1)]])}），且完全确定（Ω = 0）`),
    t(`Two views, 'asset 1 will return q₁' and 'asset 1 will outperform asset 2 by q₂' (P = ${mat([[num(1), num(0)], [num(1), num(-1)]])}), both stated with certainty (Ω = 0)`,
      `两个观点，「资产 1 将获得 q₁」与「资产 1 将比资产 2 多 q₂」（P = ${mat([[num(1), num(0)], [num(1), num(-1)]])}），且都完全确定（Ω = 0）`),
  ];
  const asOptions: Text[] = [singularOptions[as.singular]];
  for (const idx of as.shownInvertible) {
    asOptions.push(invertibleOptions[idx]);
  }
  const asCorrect = 0;
  const Z = mat([[num(1), num(0)], [num(1), num(0)]]), R = mat([[num(1), num(-1)], [num(1), num(-1)]]), D = mat([[num(1), num(-1)], [num(2), num(-2)]]);
  const I2m = mat([[num(1), num(0)], [num(0), num(1)]]), R1 = mat([[num(1), num(-1)]]), M4 = mat([[num(1), num(0)], [num(1), num(-1)]]);
  const asOmega = mat([[num(as.w), num(0)], [num(0), num(as.w)]]);
  const cExpr = `2·${num(as.a)} − 2·${par(as.b)}`;
  const singularClauseEn = [
    `For P = ${Z}, Ω = 0: PAPᵀ = ${mat([[num(as.a), num(as.a)], [num(as.a), num(as.a)]])}, determinant ${num(as.a)}·${num(as.a)} − ${num(as.a)}·${num(as.a)} = 0.`,
    `For P = ${R}, Ω = 0: PAPᵀ = ${num(asC)}·${mat([[num(1), num(1)], [num(1), num(1)]])} with ${num(asC)} = ${cExpr}, determinant 0.`,
    `For P = ${D}, Ω = 0: PAPᵀ = ${num(asC)}·${mat([[num(1), num(2)], [num(2), num(4)]])} with ${num(asC)} = ${cExpr}, determinant ${num(asC)}²·(4 − 4) = 0.`,
  ][as.singular];
  const singularClauseZh = [
    `对 P = ${Z}，Ω = 0：PAPᵀ = ${mat([[num(as.a), num(as.a)], [num(as.a), num(as.a)]])}，行列式 ${num(as.a)}·${num(as.a)} − ${num(as.a)}·${num(as.a)} = 0。`,
    `对 P = ${R}，Ω = 0：PAPᵀ = ${num(asC)}·${mat([[num(1), num(1)], [num(1), num(1)]])}，其中 ${num(asC)} = ${cExpr}，行列式为 0。`,
    `对 P = ${D}，Ω = 0：PAPᵀ = ${num(asC)}·${mat([[num(1), num(2)], [num(2), num(4)]])}，其中 ${num(asC)} = ${cExpr}，行列式 ${num(asC)}²·(4 − 4) = 0。`,
  ][as.singular];
  const invertibleClausesEn: string[] = [];
  const invertibleClausesZh: string[] = [];
  for (const idx of as.shownInvertible) {
    if (idx === 0) {
      invertibleClausesEn.push(`For P = ${I2m}, Ω = 0: PAPᵀ = A, determinant ${num(as.a)}² − ${par(as.b)}² = ${num(asDet1)}, not 0.`);
      invertibleClausesZh.push(`对 P = ${I2m}，Ω = 0：PAPᵀ = A，行列式 ${num(as.a)}² − ${par(as.b)}² = ${num(asDet1)}，不为 0。`);
    } else if (idx === 1) {
      invertibleClausesEn.push(`For P = ${Z}, Ω = ${asOmega}: PAPᵀ + Ω = ${mat([[num(asAw), num(as.a)], [num(as.a), num(asAw)]])} (the diagonal entry is ${num(as.a)} + ${num(as.w)} = ${num(asAw)}), determinant ${num(asAw)}² − ${num(as.a)}² = ${num(asDet2)}, not 0.`);
      invertibleClausesZh.push(`对 P = ${Z}，Ω = ${asOmega}：PAPᵀ + Ω = ${mat([[num(asAw), num(as.a)], [num(as.a), num(asAw)]])}（对角元为 ${num(as.a)} + ${num(as.w)} = ${num(asAw)}），行列式 ${num(asAw)}² − ${num(as.a)}² = ${num(asDet2)}，不为 0。`);
    } else if (idx === 2) {
      invertibleClausesEn.push(`For P = ${R1}, Ω = 0: PAPᵀ + Ω is the number ${cExpr} = ${num(asC)}, not 0.`);
      invertibleClausesZh.push(`对 P = ${R1}，Ω = 0：PAPᵀ + Ω 是数 ${cExpr} = ${num(asC)}，不为 0。`);
    } else if (idx === 3) {
      invertibleClausesEn.push(`For P = ${M4}, Ω = 0: PAPᵀ = ${mat([[num(as.a), num(asAmb)], [num(asAmb), num(asC)]])}, determinant ${num(as.a)}·${num(asC)} − ${num(asAmb)}² = ${num(asDet1)}, not 0.`);
      invertibleClausesZh.push(`对 P = ${M4}，Ω = 0：PAPᵀ = ${mat([[num(as.a), num(asAmb)], [num(asAmb), num(asC)]])}，行列式 ${num(as.a)}·${num(asC)} − ${num(asAmb)}² = ${num(asDet1)}，不为 0。`);
    }
  }
  const asExpl = t(
    `Two exact statements about the same combination are redundant: they either say the same thing or contradict each other, and PAPᵀ + Ω is singular. ${singularClauseEn} ${invertibleClausesEn.join(' ')} Giving the views some noise (Ω > 0) or dropping the repeated view restores the inverse; GPML A.2 adds a small multiple of the identity for the same reason (pdf p. 219).`,
    `对同一个组合的两条精确陈述是冗余的：它们要么说的是同一件事，要么互相矛盾，PAPᵀ + Ω 因而奇异。${singularClauseZh} ${invertibleClausesZh.join(' ')} 给观点加一点噪声（Ω > 0）或删去重复的观点就能恢复可逆；GPML 附录 A.2 为同样的原因给协方差加上单位阵的小倍数（pdf 第 219 页）。`
  );

  // ---- Card 9: challenge ----
  const ch = retry(() => {
    const a = 2 + g.random(0, 4);
    const d = 2 + g.random(0, 4);
    const b = -2 + g.random(0, 4);
    const w = 1 + g.random(0, 5);
    const pi1 = 3 + g.random(0, 6);
    const pi2 = 3 + g.random(0, 6);
    const delta = (g.random(0, 1) === 0 ? 1 : -1) * (1 + g.random(0, 5));
    const ppi = pi1 - pi2;
    const q = ppi + delta;
    const u1 = a - b;
    const u2 = b - d;
    const v = a - 2 * b + d;
    const s = v + w;
    const m2 = pi2 + u2 * delta / s;
    return { a, d, b, w, pi1, pi2, delta, ppi, q, u1, u2, v, s, m2 };
  }, v => {
    if (v.a * v.d - v.b * v.b < 3) return false;
    if (v.b === v.d) return false;
    if (v.s > 12) return false;
    if (v.q < 1 || v.q > 12) return false;
    if (!DENOM_OK.includes(denom(v.u2 * v.delta, v.s))) return false;
    return true;
  });
  const chShift = Math.abs(ch.u2 * ch.delta / ch.s);
  const chDir = ch.u2 * ch.delta < 0 ? 'down' : 'up';
  const chDirZh = ch.u2 * ch.delta < 0 ? '下降' : '上升';
  const chExpl = t(
    `P = ${mat([[num(1), num(-1)]])}, so Pπ = ${num(ch.pi1)} − ${num(ch.pi2)} = ${num(ch.ppi)} and q − Pπ = ${num(ch.delta)}. APᵀ = (${num(ch.a)} − ${par(ch.b)}, ${par(ch.b)} − ${num(ch.d)}) = (${num(ch.u1)}, ${num(ch.u2)}) and PAPᵀ + Ω = ${num(ch.v)} + ${num(ch.w)} = ${num(ch.s)}. Asset 2: μ_BL,2 = ${num(ch.pi2)} + ${par(ch.u2)}·${par(ch.delta)}/${num(ch.s)} = ${exact(ch.m2)}. The view moves asset 2 ${chDir} by ${exact(chShift)}, because its covariance with the viewed combination is ${num(ch.u2)}. This game does not test choosing τ and Ω in practice or deriving the Black–Litterman portfolio weights; it tests Black–Litterman as Gaussian conditioning with a linear observation operator.`,
    `P = ${mat([[num(1), num(-1)]])}，所以 Pπ = ${num(ch.pi1)} − ${num(ch.pi2)} = ${num(ch.ppi)}，q − Pπ = ${num(ch.delta)}。APᵀ = (${num(ch.a)} − ${par(ch.b)}, ${par(ch.b)} − ${num(ch.d)}) = (${num(ch.u1)}, ${num(ch.u2)})，PAPᵀ + Ω = ${num(ch.v)} + ${num(ch.w)} = ${num(ch.s)}。资产 2：μ_BL,2 = ${num(ch.pi2)} + ${par(ch.u2)}·${par(ch.delta)}/${num(ch.s)} = ${exact(ch.m2)}。该观点使资产 2 ${chDirZh}了 ${exact(chShift)}，因为它与被观点涉及的组合的协方差是 ${num(ch.u2)}。本游戏不考查实践中如何选取 τ 与 Ω，也不考查推导 Black–Litterman 组合权重；它考查的是把 Black–Litterman 看作带线性观测算子的高斯条件化。`
  );

  return [
    g.choice({
      id: 'dictionary',
      title: t('The dictionary', '对照词典'),
      prompt: t(
        `${PRE[0]} Gaussian process regression with a general linear observation operator is the same model: f ~ N(m, K) and observations y = Hf + ε with ε ~ N(0, Σ_ε); Lecture 3 has H = I and Σ_ε = σ²_obs I. Which Black–Litterman object plays the role of ${dictTarget.en}?`,
        `${PRE[1]} 带一般线性观测算子的高斯过程回归是同一个模型：f ~ N(m, K)，观测 y = Hf + ε，ε ~ N(0, Σ_ε)；第 3 讲中 H = I，Σ_ε = σ²_obs I。Black–Litterman 中的哪个对象扮演 ${dictTarget.zh} 的角色？`
      ),
      options: dictOptions,
      correct: dictCorrect,
      hint: t('Match the role, not the shape: ask what the GP object does (the starting belief about f, its spread, the noise, the data, or the operator that turns f into what is observed) and which Black–Litterman object does the same job. Two of them are covariance matrices and two are vectors of returns, so the shape alone does not decide.', '按作用对应，不要按形状对应：先问这个高斯过程对象起什么作用（关于 f 的初始信念、它的离散程度、噪声、数据，或把 f 变成观测量的算子），再问哪个 Black–Litterman 对象起同样的作用。其中两个是协方差矩阵，两个是收益向量，所以只看形状无法判断。'),
      explanation: dictExpl,
    }),
    g.symbols({
      id: 'formula',
      title: t('The posterior formula', '后验公式'),
      prompt: t(
        `${PRE[0]} The view is the observation q = Pμ + ε′ (here P = ${formulaPMat}), so the joint distribution of (μ, q) is Gaussian with mean (π, Pπ) and blocks Cov(μ) = τΣ, Cov(μ, q) = τΣPᵀ and Cov(q) = PτΣPᵀ + Ω (linearity of Gaussians). Conditioning on q (GPML A.6; Lecture 3 p. 7 with m = π) gives the posterior of μ. Complete the ${formulaVariant === 'mean' ? 'posterior mean' : 'posterior covariance'} below.`,
        `${PRE[1]} 观点是观测 q = Pμ + ε′（这里 P = ${formulaPMat}），所以 (μ, q) 联合服从高斯分布，均值为 (π, Pπ)，分块为 Cov(μ) = τΣ、Cov(μ, q) = τΣPᵀ、Cov(q) = PτΣPᵀ + Ω（高斯的线性性质）。对 q 取条件（GPML 附录 A.6；第 3 讲第 7 页，m = π）即得 μ 的后验。请补全下面的后验${formulaVariant === 'mean' ? '均值' : '协方差'}公式。`
      ),
      before: formulaBefore,
      between: formulaBetween,
      after: formulaAfter,
      answers: formulaAnswers,
      tokens: formulaTokens,
      hint: t('Use GPML A.6: x | y has mean E[x] + C B⁻¹ (y − E[y]) and covariance Cov(x) − C B⁻¹ Cᵀ, with C = Cov(x, y) and B = Cov(y). Which blocks of the joint covariance of (μ, q) are C and B?', '用 GPML 附录 A.6：x | y 的均值为 E[x] + C B⁻¹ (y − E[y])，协方差为 Cov(x) − C B⁻¹ Cᵀ，其中 C = Cov(x, y)，B = Cov(y)。(μ, q) 联合协方差的哪些分块是 C 和 B？'),
      explanation: formulaExpl,
    }),
    g.number({
      id: 'joint-cov',
      title: t('The blocks of the joint covariance', '联合协方差的分块'),
      prompt: t(
        `${SHORT[0]} A = ${mat([[num(jc.a), num(jc.b)], [num(jc.b), num(jc.d)]])}. ${viewText(jc.abs)[0]} Its uncertainty is Ω = ${num(jc.w)} (%²). ${OBS[0]} Gaussian conditioning needs three numbers from the joint covariance of (μ, y): Cov(μ₁, y) and Cov(μ₂, y), the two entries of APᵀ, and Var(y) = PAPᵀ + Ω. Compute them (units %²).`,
        `${SHORT[1]} A = ${mat([[num(jc.a), num(jc.b)], [num(jc.b), num(jc.d)]])}。${viewText(jc.abs)[1]} 其不确定性为 Ω = ${num(jc.w)}（%²）。${OBS[1]} 高斯条件化需要 (μ, y) 联合协方差中的三个数：Cov(μ₁, y) 与 Cov(μ₂, y)（即 APᵀ 的两个元素），以及 Var(y) = PAPᵀ + Ω。请算出它们（单位 %²）。`
      ),
      fields: [
        { label: t('Cov(μ₁, y)', 'Cov(μ₁, y)'), answer: jcU1 },
        { label: t('Cov(μ₂, y)', 'Cov(μ₂, y)'), answer: jcU2 },
        { label: t('Var(y)', 'Var(y)'), answer: jcS },
      ],
      hint: t('APᵀ is A times the column Pᵀ = (p₁, p₂) made from the row of P: the first column of A for an absolute view, the first column minus the second for a relative view. Then PAPᵀ = p₁u₁ + p₂u₂, with u = APᵀ.', 'APᵀ 是 A 乘以列向量 Pᵀ = (p₁, p₂)（由 P 的那一行得到）：绝对观点就是 A 的第一列，相对观点是第一列减去第二列。然后 PAPᵀ = p₁u₁ + p₂u₂，其中 u = APᵀ。'),
      explanation: jcExpl,
      audit: { kind: 'GP-F3:joint-cov', params: { a: jc.a, b: jc.b, d: jc.d, w: jc.w, p1: jcP1, p2: jcP2 } },
    }),
    g.number({
      id: 'bl-mean',
      title: t('The Black–Litterman posterior mean', 'Black–Litterman 后验均值'),
      prompt: t(
        `${SHORT[0]} π = (${num(bm.pi1)}, ${num(bm.pi2)}) % and A = ${mat([[num(bm.a), num(bm.b)], [num(bm.b), num(bm.d)]])}. ${viewText(bm.abs, bm.q)[0]} The stated value is q = ${num(bm.q)} % and the uncertainty is Ω = ${num(bm.w)} (%²). The posterior mean is μ_BL = π + APᵀ(PAPᵀ + Ω)⁻¹(q − Pπ); here PAPᵀ + Ω is a single number. Compute the posterior expected returns μ_BL,1 and μ_BL,2 of both assets (in %).`,
        `${SHORT[1]} π = (${num(bm.pi1)}, ${num(bm.pi2)}) %，A = ${mat([[num(bm.a), num(bm.b)], [num(bm.b), num(bm.d)]])}。${viewText(bm.abs, bm.q)[1]} 所述数值为 q = ${num(bm.q)} %，不确定性为 Ω = ${num(bm.w)}（%²）。后验均值为 μ_BL = π + APᵀ(PAPᵀ + Ω)⁻¹(q − Pπ)；这里 PAPᵀ + Ω 是一个数。请算出两种资产的后验期望收益 μ_BL,1 与 μ_BL,2（单位 %）。`
      ),
      figure: g.figure({
        alt: t(
          `The plane of expected returns (μ₁, μ₂) in %: a point marks the prior mean π = (${num(bm.pi1)}, ${num(bm.pi2)}) and a line marks the returns for which the view Pμ = ${num(bm.q)} holds exactly.`,
          `期望收益 (μ₁, μ₂)（单位 %）的平面：一个点表示先验均值 π = (${num(bm.pi1)}, ${num(bm.pi2)})，一条直线表示恰好满足观点 Pμ = ${num(bm.q)} 的那些收益。`
        ),
        view: fitView(bmShapes, 0.5),
        axes: { xLabel: 'μ₁', yLabel: 'μ₂', grid: true },
        shapes: bmShapes,
        aspect: 'equal',
      }),
      fields: [
        { label: t('μ_BL,1 (%)', 'μ_BL,1（%）'), answer: bm.m1 },
        { label: t('μ_BL,2 (%)', 'μ_BL,2（%）'), answer: bm.m2 },
      ],
      hint: t('First the three numbers of the previous card: APᵀ, PAPᵀ + Ω, and the gap q − Pπ. Each asset moves by its entry of APᵀ times (q − Pπ)/(PAPᵀ + Ω).', '先算上一张卡片的三个量：APᵀ、PAPᵀ + Ω 以及差 q − Pπ。每种资产移动的量 = APᵀ 的相应元素乘以 (q − Pπ)/(PAPᵀ + Ω)。'),
      explanation: t(bmExplParts.join(' '), bmExplPartsZh.join(' ')),
      audit: { kind: 'GP-F3:bl-mean', params: { a: bm.a, b: bm.b, d: bm.d, w: bm.w, p1: bm.p1, p2: bm.p2, pi1: bm.pi1, pi2: bm.pi2, q: bm.q } },
    }),
    g.number({
      id: 'bl-var',
      title: t('Uncertainty of the asset without a view', '没有观点的资产的不确定性'),
      prompt: t(
        `${SHORT[0]} A = ${mat([[num(bv.a), num(bv.b)], [num(bv.b), num(bv.d)]])}. The only view is absolute, on asset 1: P = ${mat([[num(1), num(0)]])}, with uncertainty Ω = ${num(bv.w)} (%²). The posterior covariance of μ is A − APᵀ(PAPᵀ + Ω)⁻¹PA. Compute the posterior variance of μ₂, the asset the view does not mention (in %²).`,
        `${SHORT[1]} A = ${mat([[num(bv.a), num(bv.b)], [num(bv.b), num(bv.d)]])}。唯一的观点是关于资产 1 的绝对观点：P = ${mat([[num(1), num(0)]])}，不确定性 Ω = ${num(bv.w)}（%²）。μ 的后验协方差为 A − APᵀ(PAPᵀ + Ω)⁻¹PA。请算出 μ₂（观点没有提到的那种资产）的后验方差（单位 %²）。`
      ),
      fields: [{ label: t('Var(μ₂ | view) (%²)', 'Var(μ₂ | 观点)（%²）'), answer: bvAns }],
      hint: t('Only the (2, 2) entry is needed: the (2, 2) entry of A minus (APᵀ)₂² divided by PAPᵀ + Ω. Note that the formula contains neither q nor π.', '只需要 (2, 2) 元素：A 的 (2, 2) 元素减去 (APᵀ)₂² 除以 PAPᵀ + Ω。注意公式里既没有 q 也没有 π。'),
      explanation: bvExpl,
      audit: { kind: 'GP-F3:bl-var', params: { a: bv.a, b: bv.b, d: bv.d, w: bv.w } },
    }),
    g.number({
      id: 'precision',
      title: t('The same posterior from precisions', '用精度得到同一个后验'),
      prompt: t(
        `Look at asset 1 alone. The prior is μ₁ ~ N(${num(pc.pi1)}, ${num(pc.a)}) (mean in %, variance in %²). An absolute view states q = ${num(pc.q)} % with noise variance Ω = ${num(pc.w)} %², so as a function of μ₁ the likelihood is proportional to a Gaussian with mean ${num(pc.q)} and variance ${num(pc.w)}. Multiplying two Gaussians (GPML A.7) adds their precisions (inverse variances), and the mean is the average of the two means weighted by their precisions. Compute the posterior variance of μ₁ and the posterior mean of μ₁.`,
        `只看资产 1。先验为 μ₁ ~ N(${num(pc.pi1)}, ${num(pc.a)})（均值单位 %，方差单位 %²）。一个绝对观点给出 q = ${num(pc.q)} %，噪声方差 Ω = ${num(pc.w)} %²，因此作为 μ₁ 的函数，似然正比于均值为 ${num(pc.q)}、方差为 ${num(pc.w)} 的高斯。两个高斯相乘（GPML 附录 A.7）时精度（方差的倒数）相加，均值是两个均值按精度加权的平均。请算出 μ₁ 的后验方差和后验均值。`
      ),
      fields: [
        { label: t('posterior variance of μ₁ (%²)', 'μ₁ 的后验方差（%²）'), answer: pcVar },
        { label: t('posterior mean of μ₁ (%)', 'μ₁ 的后验均值（%）'), answer: pcMean },
      ],
      hint: t('Precision = 1/variance. Add the two precisions, invert for the variance, then weight each mean by its precision.', '精度 = 1/方差。把两个精度相加，取倒数得方差，再把每个均值按其精度加权。'),
      explanation: pcExpl,
      audit: { kind: 'GP-F3:precision', params: { a: pc.a, w: pc.w, pi1: pc.pi1, q: pc.q } },
    }),
    g.choice({
      id: 'limits',
      title: t('Sure and unsure views', '有把握与没把握的观点'),
      prompt: t(
        `${SHORT[0]} π = (${num(lm.pi1)}, ${num(lm.pi2)}) % and A = ${mat([[num(lm.a), num(lm.b)], [num(lm.b), num(lm.d)]])}. ${viewText(lm.abs, lm.q)[0]} The stated value is q = ${num(lm.q)} %. Let the uncertainty ${lm.limit === 0 ? 'go to zero, Ω → 0' : 'go to infinity, Ω → ∞'}. To which value does the posterior mean of the viewed quantity ${lm.abs ? 'μ₁' : 'μ₁ − μ₂'} tend? (Assume PAPᵀ > 0.)`,
        `${SHORT[1]} π = (${num(lm.pi1)}, ${num(lm.pi2)}) % 和 A = ${mat([[num(lm.a), num(lm.b)], [num(lm.b), num(lm.d)]])}。${viewText(lm.abs, lm.q)[1]} 所述数值为 q = ${num(lm.q)} %。让不确定性${lm.limit === 0 ? '趋于 0，即 Ω → 0' : '趋于无穷，即 Ω → ∞'}。被观点涉及的量 ${lm.abs ? 'μ₁' : 'μ₁ − μ₂'} 的后验均值趋于哪个值？（假设 PAPᵀ > 0。）`
      ),
      options: lmOptions,
      correct: lmCorrect,
      hint: t('Write the posterior mean of Pμ as Pπ + weight·(q − Pπ) with weight = PAPᵀ/(PAPᵀ + Ω). What is the weight when Ω → 0, and when Ω → ∞?', '把 Pμ 的后验均值写成 Pπ + 权重·(q − Pπ)，权重 = PAPᵀ/(PAPᵀ + Ω)。Ω → 0 与 Ω → ∞ 时权重分别是多少？'),
      explanation: lmExpl,
    }),
    g.choice({
      id: 'assumption',
      title: t('When the formula breaks', '公式何时失效'),
      prompt: t(
        `${SHORT[0]} A = ${mat([[num(as.a), num(as.b)], [num(as.b), num(as.a)]])} (positive definite). With several views at once, P has one row per view and Ω is their noise covariance, and the formula needs the inverse of PAPᵀ + Ω. In which case does PAPᵀ + Ω have no inverse, so that the formula cannot be applied as written?`,
        `${SHORT[1]} A = ${mat([[num(as.a), num(as.b)], [num(as.b), num(as.a)]])}（正定）。同时有多个观点时，P 的每一行对应一个观点，Ω 是它们的噪声协方差，公式需要 PAPᵀ + Ω 的逆。下列哪种情形下 PAPᵀ + Ω 没有逆，因而公式不能照原样使用？`
      ),
      options: asOptions,
      correct: asCorrect,
      hint: t('Compute PAPᵀ + Ω for each option, or ask which options make two noise-free statements about the same combination of returns.', '对每个选项计算 PAPᵀ + Ω，或者问：哪个选项对同一个收益组合作了两条毫无噪声的陈述？'),
      explanation: asExpl,
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: a relative view', '挑战：相对观点'),
      prompt: t(
        `Two assets have prior expected returns π = (${num(ch.pi1)}, ${num(ch.pi2)}) % per year and prior covariance A = ${mat([[num(ch.a), num(ch.b)], [num(ch.b), num(ch.d)]])} (%²) for (μ₁, μ₂). An analyst states the view 'asset 1 will outperform asset 2 by ${num(ch.q)}% per year' with uncertainty Ω = ${num(ch.w)} (%²). What is the posterior expected return of asset 2 (in %) by the Black–Litterman rule?`,
        `两种资产的先验期望收益为 π = (${num(ch.pi1)}, ${num(ch.pi2)}) %（每年），(μ₁, μ₂) 的先验协方差为 A = ${mat([[num(ch.a), num(ch.b)], [num(ch.b), num(ch.d)]])}（%²）。一位分析师给出观点：「资产 1 每年将比资产 2 多 ${num(ch.q)}%」，不确定性为 Ω = ${num(ch.w)}（%²）。按 Black–Litterman 规则，资产 2 的后验期望收益是多少（单位 %）？`
      ),
      fields: [{ label: t('μ_BL,2 (%)', 'μ_BL,2（%）'), answer: ch.m2 }],
      hint: t('Write the view as P = [[1, −1]]; you need APᵀ, PAPᵀ + Ω and q − Pπ. Only the second component of APᵀ matters for asset 2.', '把观点写成 P = [[1, −1]]；需要 APᵀ、PAPᵀ + Ω 和 q − Pπ。资产 2 只用到 APᵀ 的第二个分量。'),
      explanation: chExpl,
      audit: { kind: 'GP-F3:challenge', params: { a: ch.a, b: ch.b, d: ch.d, w: ch.w, pi1: ch.pi1, pi2: ch.pi2, q: ch.q } },
    }),
  ];
};
