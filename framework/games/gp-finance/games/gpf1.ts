import type { CardGenerator } from '../../types';
import { makeGpDeck, mat, num, par, exact, type Text } from '../support';
const t = (en: string, zh: string): Text => [en, zh];
const matrix = (a: number, b: number, c: number) => mat([[num(a), num(c)], [num(c), num(b)]]);
const product = <T,>(a: readonly T[], b: readonly T[]): [T, T][] => a.flatMap(x => b.map(y => [x,y] as [T,T]));
const base = product([4,6], [2,4]).flatMap(([a,b]) => [-1,1].map(c => ({a,b,c})));
const linear = product([2,3], [1,2]).flatMap(([a,b]) => [1,2,3].map(u => ({a,b,u}))).filter(p => p.a*p.u !== p.b);
const portfolios = base.flatMap(p => [-1,0.5,2].map(h => ({...p,h})));
const factors = product([1,2], [-2,-1,1,2]).flatMap(([x,y]) => [2,3].map(v => ({x,y,v})));
const residuals = product([1,2,4], [1,2,4]).map(([d1,d2]) => ({d1,d2}));
const challenges = product([1,2], [-1,1,2]).flatMap(([x,y]) => [2,4].flatMap(v => product([1,2],[1,2]).map(([d1,d2]) => ({x,y,v,d1,d2}))));

export const gpf1: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-F1');
  for(let i=0;i<4;i++) g.random(0,1);
  const l=g.pick(linear), p=g.pick(portfolios), f=g.pick(factors), d=g.pick(residuals), q=g.pick(base), z=g.pick(challenges);
  const m=g.random(1,3), n=g.random(4,5), a=g.random(1,6), b=a+1;
  const av = p.h*p.h*p.a+2*p.h*(1-p.h)*p.c+(1-p.h)*(1-p.h)*p.b;
  const cv = q.a+q.c/2-q.b/2;
  const zv = z.v*((z.x+z.y)/2)**2+(z.d1+z.d2)/4;
  const field=(label: Text, answer: number) => [{label,answer,tolerance:0.006}];
  return [
    g.number({id:'linear-cov',title:t('A linear covariance','线性协方差'),
      prompt:t(`A linear kernel is k(x,z) = xᵀFz. F = ${matrix(l.a,l.b,0)} with a = ${l.a}, b = ${l.b}; x = (${l.u}, 1), z = (1, −1), u = ${l.u}. Find k(x,z). Enter an integer or a fraction.`, `线性核为 k(x,z) = xᵀFz。F = ${matrix(l.a,l.b,0)}，其中 a = ${l.a}，b = ${l.b}；x = (${l.u}, 1)，z = (1, −1)，u = ${l.u}。求 k(x,z)，输入整数或分数。`),
      fields:field('k(x,z)',l.a*l.u-l.b),audit:{kind:'GP-F1:linear-cov',params:l},
      hint:t('Multiply F by z first, then take the inner product with x.','先计算 Fz，再与 x 做内积。'),
      explanation:t(`Fz = (${l.a}, ${num(-l.b)}), so k(x,z) = ${l.u}·${l.a} − ${l.b} = ${exact(l.a*l.u-l.b)}. This is the covariance of two linear function values.`, `Fz = (${l.a}, ${num(-l.b)})，因此 k(x,z) = ${l.u}·${l.a} − ${l.b} = ${exact(l.a*l.u-l.b)}，即两个线性函数值的协方差。`)}),
    g.number({id:'portfolio-var',title:t('Portfolio variance','组合方差'),
      prompt:t(`Returns r are a column with covariance Σ = ${matrix(p.a,p.b,p.c)}; a = ${p.a}, b = ${p.b}, c = ${num(p.c)}. Portfolio return R = wᵀr has weights w = (${num(p.h)}, ${num(1-p.h)}), h = ${num(p.h)}, summing to 1; short positions are allowed. Find Var(R), not its standard deviation. Enter an integer or a fraction.`, `收益列向量 r 的协方差为 Σ = ${matrix(p.a,p.b,p.c)}；a = ${p.a}，b = ${p.b}，c = ${num(p.c)}。组合收益 R = wᵀr，权重 w = (${num(p.h)}, ${num(1-p.h)})，h = ${num(p.h)}，权重和为 1，允许做空。求 Var(R)，即方差而非标准差，输入整数或分数。`),
      fields:field(t('Var(R)','组合方差'),av),audit:{kind:'GP-F1:portfolio-var',params:p},
      hint:t('Expand both covariance cross terms and square each weight on the diagonal.','展开两个协方差交叉项，对角项的权重需要平方。'),
      explanation:t(`wᵀΣw = (${num(p.h)})²·${p.a} + 2·${par(p.h)}·${par(1-p.h)}·${par(p.c)} + (${num(1-p.h)})²·${p.b} = ${exact(av)}.`, `wᵀΣw = (${num(p.h)})²·${p.a} + 2·${par(p.h)}·${par(1-p.h)}·${par(p.c)} + (${num(1-p.h)})²·${p.b} = ${exact(av)}。`)}),
    g.number({id:'factor-cross',title:t('Shared factor covariance','共同因子的协方差'),
      prompt:t(`Two returns follow r₁ = xz + ε₁, r₂ = yz + ε₂, where x = ${f.x}, y = ${num(f.y)}, Var(z) = v = ${f.v}. The residuals are independent of z and each other. Find Cov(r₁,r₂). Enter an integer or a fraction.`, `两种收益满足 r₁ = xz + ε₁、r₂ = yz + ε₂，其中 x = ${f.x}，y = ${num(f.y)}，Var(z) = v = ${f.v}。残差彼此独立且与 z 独立。求 Cov(r₁,r₂)，输入整数或分数。`),
      fields:field(t('Cov(r₁,r₂)','收益协方差'),f.x*f.y*f.v),audit:{kind:'GP-F1:factor-cross',params:f},
      hint:t('Keep only the shared random source when expanding the covariance.','展开协方差时，只保留共同的随机来源。'),
      explanation:t(`Cov(r₁,r₂) = x·y·Var(z) = ${f.x}·${par(f.y)}·${f.v} = ${exact(f.x*f.y*f.v)}. Independent residuals add no cross-covariance.`, `Cov(r₁,r₂) = x·y·Var(z) = ${f.x}·${par(f.y)}·${f.v} = ${exact(f.x*f.y*f.v)}。独立残差不增加交叉协方差。`)}),
    g.number({id:'idio-var',title:t('Independent residual risk','独立残差风险'),
      prompt:t(`Returns have independent residuals ε₁, ε₂ with Var(ε₁) = d1 = ${d.d1}, Var(ε₂) = d2 = ${d.d2}. Portfolio weights w = (0.5, 0.5) sum to 1. Find the residual contribution to Var(wᵀr). Enter an integer or a fraction.`, `收益的独立残差 ε₁、ε₂ 满足 Var(ε₁) = d1 = ${d.d1}，Var(ε₂) = d2 = ${d.d2}。组合权重 w = (0.5, 0.5)，权重和为 1。求残差对 Var(wᵀr) 的贡献，输入整数或分数。`),
      fields:field(t('Residual variance','残差方差'),(d.d1+d.d2)/4),audit:{kind:'GP-F1:idio-var',params:d},
      hint:t('Each residual variance is multiplied by the square of its portfolio weight.','每个残差方差乘以对应组合权重的平方。'),
      explanation:t(`wᵀDw = (${d.d1} + ${d.d2})/4 = ${exact((d.d1+d.d2)/4)}. There is no covariance term between independent residuals.`, `wᵀDw = (${d.d1} + ${d.d2})/4 = ${exact((d.d1+d.d2)/4)}。独立残差之间没有协方差项。`)}),
    g.choice({id:'mean-vs-risk',title:t('Mean and covariance','均值与协方差'),prompt:t(`Returns r have E[r] = (${m}, ${n}) and covariance Σ. Replace r by r + E[r], so its mean doubles and centered fluctuations stay the same. What happens to Σ?`, `收益 r 的均值为 (${m}, ${n})，协方差为 Σ。将 r 替换为 r + E[r]，均值加倍，中心化波动保持不变。Σ 如何变化？`),options:[t('It stays unchanged.','保持不变。'),t('It doubles.','变为两倍。'),t('It quadruples.','变为四倍。'),t('It becomes zero.','变为零。')],correct:0,hint:t('Compute the new centered return.','考察新的中心化收益。'),explanation:t('Adding a deterministic mean shift cancels when centering; the covariance stays Σ. Scaling the whole random return would be a different operation.','加上确定的均值平移后，中心化时该平移被抵消，协方差仍为 Σ。把整个随机收益缩放是另一种运算。')}),
    g.choice({id:'invalid-cov',title:t('A negative variance direction','负方差方向'),prompt:t(`A proposed covariance is Σ = ${matrix(a,a,b)}, a = ${a}, b = ${b}. Can it be a covariance matrix of returns?`, `候选收益协方差为 Σ = ${matrix(a,a,b)}，a = ${a}，b = ${b}。它能作为协方差矩阵吗？`),options:[t('No: direction (1, −1) has negative variance.','不能：方向 (1, −1) 的方差为负。'),t('Yes: every symmetric matrix is a covariance.','能：所有对称矩阵都是协方差。'),t('Yes: positive diagonal entries suffice.','能：对角元为正就足够。'),t('Yes: positive entries guarantee positive semidefiniteness.','能：元素为正就保证半正定。')],correct:0,hint:t('Test the variance of the difference of two assets.','检查两种资产收益之差的方差。'),explanation:t(`Var(r₁ − r₂) would be 2·(${a} − ${b}) = −2. Covariance matrices must be positive semidefinite, so this matrix fails.`, `Var(r₁ − r₂) 将为 2·(${a} − ${b}) = −2。协方差矩阵必须半正定，因此该矩阵不合法。`)}),
    g.number({id:'cross-portfolio',title:t('Two portfolio returns','两个组合收益'),prompt:t(`Returns r have Σ = ${matrix(q.a,q.b,q.c)}, a = ${q.a}, b = ${q.b}, c = ${num(q.c)}. Both weight vectors p = (0.5, 0.5), q = (2, −1) sum to 1; short positions are allowed. Find Cov(pᵀr,qᵀr). Enter an integer or a fraction.`, `收益 r 的协方差为 Σ = ${matrix(q.a,q.b,q.c)}，a = ${q.a}，b = ${q.b}，c = ${num(q.c)}。权重 p = (0.5, 0.5)、q = (2, −1) 均满足和为 1，允许做空。求 Cov(pᵀr,qᵀr)，输入整数或分数。`),fields:field(t('Portfolio cross-covariance','组合交叉协方差'),cv),audit:{kind:'GP-F1:cross-portfolio',params:q},hint:t('Covariance is linear in each of its two weight vectors.','协方差对两个权重向量分别都是线性的。'),explanation:t(`pᵀΣq = ${q.a} + (${num(q.c)})/2 − ${q.b}/2 = ${exact(cv)}. Use both portfolios, rather than squaring one portfolio weight.`, `pᵀΣq = ${q.a} + (${num(q.c)})/2 − ${q.b}/2 = ${exact(cv)}。需要同时使用两个组合的权重，而不是对某一个权重平方。`)}),
    g.number({id:'challenge',title:t('Factor model challenge','因子模型挑战'),prompt:t(`Returns are r = Xz + ε with X = (${z.x}, ${num(z.y)})ᵀ, x = ${z.x}, y = ${num(z.y)}, Var(z) = v = ${z.v}, Cov(ε) = ${matrix(z.d1,z.d2,0)}, d1 = ${z.d1}, d2 = ${z.d2}. The factor and independent residuals are independent. Weights w = (0.5, 0.5) sum to 1. Find Var(wᵀr). Enter an integer or a fraction.`, `收益满足 r = Xz + ε，其中 X = (${z.x}, ${num(z.y)})ᵀ，x = ${z.x}，y = ${num(z.y)}，Var(z) = v = ${z.v}，Cov(ε) = ${matrix(z.d1,z.d2,0)}，d1 = ${z.d1}，d2 = ${z.d2}。因子与残差独立，残差彼此独立。权重 w = (0.5, 0.5)，权重和为 1。求 Var(wᵀr)，输入整数或分数。`),fields:field(t('Portfolio variance','组合方差'),zv),audit:{kind:'GP-F1:challenge',params:z},hint:t('Identify the combined factor exposure and the independent residual contribution.','确定组合的因子暴露以及独立残差的贡献。'),explanation:t(`The combined exposure is (${z.x} + ${par(z.y)})/2 = ${exact((z.x+z.y)/2)}. Its factor variance plus residual risk is ${z.v}·(${exact((z.x+z.y)/2)})² + (${z.d1} + ${z.d2})/4 = ${exact(zv)}. This game does not assess estimating factor models or portfolio performance on real returns.`, `组合因子暴露为 (${z.x} + ${par(z.y)})/2 = ${exact((z.x+z.y)/2)}。因子方差加上残差风险为 ${z.v}·(${exact((z.x+z.y)/2)})² + (${z.d1} + ${z.d2})/4 = ${exact(zv)}。本游戏不考查从真实收益估计因子模型，也不评估组合的实际表现。`)}),
  ];
};
