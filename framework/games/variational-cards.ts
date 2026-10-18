import { seededRandom, type CardGenerator } from './types';

// ELBO identity / likelihood-minus-KL: Kingma & Welling, equations (1)–(3).
// Gaussian KL and reparameterization: Gaussian appendix and section 2.4.
// https://arxiv.org/html/1312.6114v11
// Discrete exercises use log2 (bits); Gaussian exercises use ln (nats).

export const klCards: CardGenerator = (seed, lang) => {
  const random = seededRandom(seed);
  const t = (en: string, zh: string) => lang === 'zh' ? zh : en;
  const denominator = random(3, 6);
  const numerator = random(1, denominator - 1);
  const state = random(0, 1);
  return [
    {
      id: 'kl-normalize', title: t('Complete a distribution', '补全概率分布'),
      prompt: t(`q(0) = ${numerator}/${denominator}. What is q(1)?`, `q(0) = ${numerator}/${denominator}。q(1) 是多少？`),
      fields: [{ label: 'q(1)', answer: (denominator - numerator) / denominator }],
      hint: t('The two probabilities sum to 1.', '两个概率之和为 1。'),
      explanation: t(`q(1) = (${denominator} − ${numerator})/${denominator}.`, `q(1) = (${denominator} − ${numerator})/${denominator}。`),
    },
    {
      id: 'kl-formula', title: t('Build the KL sum', '拼出 KL 求和式'),
      prompt: t('Fill the expectation weight, numerator and denominator.', '填入期望权重、分子和分母。'),
      slots: { before: 'KL(q ‖ p) = Σz ', between: [' · log₂(', ' / '], after: ')', answers: ['q(z)', 'q(z)', 'p(z)'], tokens: ['q(z)', 'p(z)'] },
      hint: t('KL(q ‖ p) is an expectation under q.', 'KL(q ‖ p) 是在 q 下取的期望。'),
      explanation: t('Σz q(z) log₂(q(z)/p(z)); all three positions matter.', 'Σz q(z) log₂(q(z)/p(z))；三个位置都有意义。'),
    },
    {
      id: 'kl-weights', title: t('Whose expectation?', '谁的期望？'),
      prompt: t(`q = (${numerator}/${denominator}, ${denominator - numerator}/${denominator}). Which weights multiply the log ratios in KL(q ‖ p)?`, `q = (${numerator}/${denominator}, ${denominator - numerator}/${denominator})。KL(q ‖ p) 中用什么权重乘对数比值？`),
      choice: { options: [t('The probabilities from q', 'q 的概率'), t('The probabilities from p', 'p 的概率'), t('Always 1/2 and 1/2', '总是 1/2 和 1/2')], answer: 0 },
      hint: t('Read the distribution before the ‖ symbol.', '看 ‖ 符号前面的分布。'),
      explanation: t('The expectation weights are q(z); they are not automatically uniform.', '期望权重是 q(z)，不一定均匀。'),
    },
    {
      id: 'kl-direction', title: t('Read the direction', '读懂方向'),
      prompt: t('You sample z from q and average log₂(q(z)/p(z)). Which divergence is this?', '从 q 采样 z，再平均 log₂(q(z)/p(z))。这是什么散度？'),
      choice: { options: ['KL(p ‖ q)', 'KL(q ‖ p)', t('Both are always equal', '两者总是相等')], answer: 1 },
      hint: t('The sampling distribution supplies the weight.', '采样分布提供期望权重。'),
      explanation: t('Reversing KL changes both the weights and the log ratio.', '反转 KL 会同时改变权重和对数比值。'),
    },
    {
      id: 'kl-one-bit', title: t('A point mass against a fair coin', '点质量与公平硬币'),
      prompt: t(`q(${state}) = 1; p(0) = p(1) = 1/2. Compute KL(q ‖ p) in bits.`, `q(${state}) = 1；p(0) = p(1) = 1/2。计算 KL(q ‖ p)，单位为 bit。`),
      lines: [t('Convention: q(z) = 0 contributes 0, including when p(z) = 0.', '约定：q(z) = 0 的项贡献为 0，包括 p(z) = 0 时。')],
      fields: [{ label: t('KL in bits', 'KL（bit）'), answer: 1 }],
      hint: 'log₂(2) = 1',
      explanation: t('Only the occupied state contributes: 1 · log₂(1/(1/2)) = 1 bit.', '只有占据的状态有贡献：1 · log₂(1/(1/2)) = 1 bit。'),
    },
    {
      id: 'kl-equality', title: t('Identical distributions', '相同分布'),
      prompt: t(`p = q = (${numerator}/${denominator}, ${denominator - numerator}/${denominator}). Compute KL(q ‖ p).`, `p = q = (${numerator}/${denominator}, ${denominator - numerator}/${denominator})。计算 KL(q ‖ p)。`),
      fields: [{ label: 'KL(q ‖ p)', answer: 0 }],
      hint: 'log₂(1) = 0',
      explanation: t('Every ratio is 1, so every log is 0. KL is zero exactly when the distributions agree.', '每个比值都是 1，所以每个对数都是 0。KL 为零当且仅当两个分布相同。'),
    },
    {
      id: 'kl-zero-support', title: t('The zero-weight convention', '零权重约定'),
      prompt: t('At one state q(z) = 0 and p(z) = 1/2. What is that state’s KL contribution?', '某状态 q(z) = 0、p(z) = 1/2。该状态对 KL 的贡献是多少？'),
      fields: [{ label: t('Contribution', '贡献'), answer: 0 }],
      hint: t('Use the limiting convention; do not evaluate log₂(0) alone.', '使用极限约定；不要单独计算 log₂(0)。'),
      explanation: t('By convention 0 · log₂(0/p) = 0; states with q = 0 receive no expectation weight.', '约定 0 · log₂(0/p) = 0；q = 0 的状态没有期望权重。'),
    },
    {
      id: 'kl-missing-support', title: t('Missing support', '缺失支持集'),
      prompt: t(`q(${state}) > 0 but p(${state}) = 0. What happens to KL(q ‖ p)?`, `q(${state}) > 0，但 p(${state}) = 0。KL(q ‖ p) 会怎样？`),
      choice: { options: ['0', '+∞', '−∞'], answer: 1 },
      hint: t('A positive q weight encounters a zero denominator.', '正的 q 权重遇到了为零的分母。'),
      explanation: t('If any q-positive state has p = 0, KL(q ‖ p) is +∞. A q-zero state instead contributes 0.', '只要某个 q 为正的状态满足 p = 0，KL(q ‖ p) 就是 +∞。q 为零的状态则贡献 0。'),
    },
    {
      id: 'kl-asymmetry', title: t('Reverse the fair-coin comparison', '反转公平硬币比较'),
      prompt: t(`q(${state}) = 1 and p = (1/2, 1/2). KL(q ‖ p) = 1 bit. What is KL(p ‖ q)?`, `q(${state}) = 1，p = (1/2, 1/2)。KL(q ‖ p) = 1 bit。KL(p ‖ q) 是多少？`),
      choice: { options: [t('1 bit', '1 bit'), t('0 bits', '0 bit'), '+∞'], answer: 2 },
      hint: t('In the reverse direction, p weights both states.', '反向时，p 对两个状态都赋予正权重。'),
      explanation: t('p assigns positive probability to a state where q is zero. The reverse divergence is infinite, proving KL is asymmetric.', 'p 在 q 为零的状态上赋予正概率，因此反向散度为无穷。这说明 KL 不对称。'),
    },
    {
      id: 'kl-final-counterexample', title: t('Independent check: a negative term', '独立检查：负的单项'),
      prompt: t('q = (1/2, 1/2), p = (3/4, 1/4). Which statement is correct?', 'q = (1/2, 1/2)，p = (3/4, 1/4)。哪个说法正确？'),
      lines: [t('Supplied log facts: −1 < log₂(2/3) < 0; log₂(2) = 1.', '已知对数关系：−1 < log₂(2/3) < 0；log₂(2) = 1。'), t('Each contribution is q(z) times its log ratio.', '每项贡献是 q(z) 乘对应的对数比值。')],
      choice: { options: [t('Every individual contribution must be nonnegative', '每一项贡献都必须非负'), t('The first contribution is negative, while the total KL is positive', '第一项贡献为负，但 KL 总和为正'), t('A negative contribution makes the total KL negative', '有负的单项就会使 KL 总和为负')], answer: 1 },
      hint: t('Multiply both supplied logs by 1/2, then compare their sum with 0.', '两个给定对数都乘以 1/2，然后比较总和与 0。'),
      explanation: t('The first term lies between −1/2 and 0; the second is 1/2. Thus the total lies strictly between 0 and 1/2 bits. Nonnegativity applies to the total.', '第一项在 −1/2 与 0 之间，第二项为 1/2。因此总和严格位于 0 与 1/2 bit 之间。非负性适用于总和。'),
    },
  ];
};

export const elboCards: CardGenerator = (seed, lang) => {
  const random = seededRandom(seed);
  const t = (en: string, zh: string) => lang === 'zh' ? zh : en;
  const k = random(2, 4);
  const x = 2 * random(1, 2);
  const mu = random(0, 2);
  const sigma = random(1, 2);
  const epsilon = random(0, 1) === 0 ? -1 : 1;
  const reconstruction = -random(2, 5);
  const priorKl = random(1, 3);
  const finalX = 2 * random(1, 2);
  const finalMu = random(0, 2);
  const discrete = t(`Observed x; z ∈ {0, 1}; p(x,0) = p(x,1) = 1/${2 ** (k + 1)}. All discrete logs are base 2 (bits).`, `已观测 x；z ∈ {0, 1}；p(x,0) = p(x,1) = 1/${2 ** (k + 1)}。离散题均使用以 2 为底的对数（bit）。`);
  const gaussian = t('Gaussian model: p(z) = N(0,1), p(x|z) = N(z,1), q(z) = N(μ,1). Logs are natural (nats).', '高斯模型：p(z) = N(0,1)，p(x|z) = N(z,1)，q(z) = N(μ,1)。使用自然对数（nat）。');
  return [
    {
      id: 'elbo-evidence', title: t('Sum out the latent state', '求和消去隐变量'), prompt: discrete,
      fields: [{ label: 'p(x)', answer: 2 ** -k }, { label: 'log₂ p(x)', answer: -k }],
      hint: t('Add the two joint masses.', '把两个联合概率相加。'),
      explanation: t(`p(x) = 2/${2 ** (k + 1)} = 2^−${k}, so log₂ p(x) = −${k}.`, `p(x) = 2/${2 ** (k + 1)} = 2^−${k}，所以 log₂ p(x) = −${k}。`),
    },
    {
      id: 'elbo-posterior', title: t('Normalize the joint masses', '归一化联合概率'), prompt: discrete,
      fields: [{ label: 'p(z=0|x)', answer: 1 / 2 }, { label: 'p(z=1|x)', answer: 1 / 2 }],
      hint: t('Divide each joint mass by p(x).', '每个联合概率除以 p(x)。'),
      explanation: t('The equal joint masses give posterior probabilities 1/2 and 1/2.', '相等的联合概率给出后验概率 1/2 和 1/2。'),
    },
    {
      id: 'elbo-delta', title: t('ELBO for a point mass', '点质量的 ELBO'), prompt: discrete,
      lines: ['q(0) = 1, q(1) = 0', 'ELBO = Σz q(z) [log₂ p(x,z) − log₂ q(z)]', t('Zero-q states contribute 0.', 'q 为零的状态贡献为 0。')],
      fields: [{ label: t('ELBO in bits', 'ELBO（bit）'), answer: -(k + 1) }],
      hint: t('Only z = 0 contributes, and log₂ q(0) = 0.', '只有 z = 0 有贡献，且 log₂ q(0) = 0。'),
      explanation: t(`ELBO = log₂(2^−${k + 1}) − log₂(1) = −${k + 1}.`, `ELBO = log₂(2^−${k + 1}) − log₂(1) = −${k + 1}。`),
    },
    {
      id: 'elbo-half', title: t('ELBO at the exact posterior', '精确后验的 ELBO'), prompt: discrete,
      bound: { ceiling: -k, start: -(k + 1) },
      lines: ['q(0) = q(1) = 1/2', 'ELBO = Σz q(z) [log₂ p(x,z) − log₂ q(z)]'],
      fields: [{ label: t('ELBO in bits', 'ELBO（bit）'), answer: -k }],
      hint: t('Each bracket subtracts log₂(1/2) = −1.', '每个方括号中减去 log₂(1/2) = −1。'),
      explanation: t(`Both brackets equal −${k}; their weighted average is −${k}. Since q is the posterior, ELBO equals log evidence.`, `两个方括号均为 −${k}，加权平均也是 −${k}。q 等于后验时，ELBO 等于对数证据。`),
    },
    {
      id: 'elbo-gap', title: t('Measure the gap', '计算间隙'), prompt: discrete,
      lines: [`log₂ p(x) = −${k}; q(0) = 1; ELBO = −${k + 1}`],
      fields: [{ label: 'log₂ p(x) − ELBO', answer: 1 }],
      hint: t('Subtract ELBO from the log evidence.', '用对数证据减去 ELBO。'),
      explanation: t('The gap is 1 bit, equal to KL(q(z) ‖ p(z|x)), the divergence from q to the posterior.', '间隙为 1 bit，等于 KL(q(z) ‖ p(z|x))，即 q 到后验的散度。'),
    },
    {
      id: 'elbo-gap-identity', title: t('Assemble the identity', '拼出恒等式'),
      prompt: t('Which distribution belongs in the ELBO gap identity?', 'ELBO 间隙恒等式中应该使用哪个分布？'),
      slots: { before: 'log p(x) = ', between: [' + KL(q(z) ‖ '], after: ')', answers: ['ELBO', 'p(z|x)'], tokens: ['ELBO', 'p(z|x)', 'p(z)', '−ELBO'] },
      hint: t('The gap measures approximation to the posterior given this x.', '间隙衡量对给定 x 的后验的近似程度。'),
      explanation: t('log p(x) = ELBO + KL(q ‖ p(z|x)). The prior p(z) belongs in a different decomposition.', 'log p(x) = ELBO + KL(q ‖ p(z|x))。先验 p(z) 出现在另一种分解中。'),
    },
    {
      id: 'elbo-rearrange', title: t('Reconstruction minus prior KL', '重构减去先验 KL'),
      prompt: t(`E_q[log₂ p(x|z)] = ${reconstruction}; KL(q ‖ p(z)) = ${priorKl} bits. Find ELBO.`, `E_q[log₂ p(x|z)] = ${reconstruction}；KL(q ‖ p(z)) = ${priorKl} bit。求 ELBO。`),
      fields: [{ label: 'ELBO', answer: reconstruction - priorKl }],
      hint: 'ELBO = E_q[log p(x|z)] − KL(q ‖ p(z))',
      explanation: t(`Subtract the prior penalty: ${reconstruction} − ${priorKl} = ${reconstruction - priorKl}. This prior KL is not the posterior gap.`, `减去先验惩罚：${reconstruction} − ${priorKl} = ${reconstruction - priorKl}。该先验 KL 不是后验间隙。`),
    },
    {
      id: 'elbo-jensen', title: t('Where does the log go?', '对数放在哪里？'),
      prompt: t('A positive weight W is 2 or 8, each with probability 1/2. Choose Jensen’s correct relation.', '正权重 W 以各 1/2 的概率取 2 或 8。选择正确的 Jensen 关系。'),
      lines: [t('Supplied: E[W] = 5; log₂ 2 = 1; log₂ 8 = 3; 2 < log₂ 5 < 3.', '已知：E[W] = 5；log₂ 2 = 1；log₂ 8 = 3；2 < log₂ 5 < 3。')],
      choice: { options: ['E[log₂ W] = 2 < log₂ E[W]', 'log₂ E[W] < E[log₂ W]', 'E[log₂ W] = log₂ E[W]'], answer: 0 },
      hint: t('Averaging the logs gives (1 + 3)/2.', '对数的平均值为 (1 + 3)/2。'),
      explanation: t('The concavity of log gives E[log W] ≤ log E[W]. For importance weights W = p(x,z)/q(z), this yields ELBO ≤ log p(x), provided q covers the joint support.', '对数的凹性给出 E[log W] ≤ log E[W]。对重要性权重 W = p(x,z)/q(z)，若 q 覆盖联合分布的支持集，就得到 ELBO ≤ log p(x)。'),
    },
    {
      id: 'elbo-fixed-model', title: t('Change q, keep the model fixed', '固定模型，改变 q'), prompt: discrete,
      lines: [t('Replace a point-mass q with q = (1/2, 1/2), keeping p fixed.', '保持 p 不变，把点质量 q 换成 q = (1/2, 1/2)。')],
      choice: { options: [t('Both log evidence and ELBO must increase', '对数证据和 ELBO 都必须增大'), t('Log evidence stays fixed; ELBO rises by 1 bit', '对数证据不变；ELBO 增加 1 bit'), t('ELBO stays fixed; log evidence rises', 'ELBO 不变；对数证据增大')], answer: 1 },
      hint: t('p(x) depends on p, whereas ELBO also depends on q.', 'p(x) 取决于 p，而 ELBO 还取决于 q。'),
      explanation: t(`Log evidence remains −${k}; ELBO moves from −${k + 1} to −${k}. Improving q tightens the bound for this model.`, `对数证据仍为 −${k}；ELBO 从 −${k + 1} 变为 −${k}。改善 q 会收紧该模型的下界。`),
    },
    {
      id: 'elbo-change-model', title: t('Now change the model', '现在改变模型'),
      prompt: t('When model parameters θ change during training, what can happen to log pθ(x)?', '训练过程中模型参数 θ 改变时，log pθ(x) 会怎样？'),
      choice: { options: [t('It must stay fixed because ELBO is a bound', '因为 ELBO 是下界，它必须不变'), t('It must equal ELBO after every update', '每次更新后它都必须等于 ELBO'), t('It may change; the bound identity refers to the current model', '它可能改变；下界恒等式针对当前模型')], answer: 2 },
      hint: t('Changing θ changes the joint distribution itself.', '改变 θ 会改变联合分布本身。'),
      explanation: t('For each θ, log pθ(x) = ELBO(θ,q) + KL(q ‖ pθ(z|x)). Evidence is fixed only when the model and observation are fixed.', '对每个 θ，log pθ(x) = ELBO(θ,q) + KL(q ‖ pθ(z|x))。仅在模型和观测固定时，证据才固定。'),
    },
    {
      id: 'elbo-monte-carlo', title: t('A noisy estimate crosses the bound', '带噪估计越过下界'),
      prompt: t('The exact log evidence is −3 bits. A finite Monte Carlo ELBO estimate is −2 bits. What follows?', '精确对数证据为 −3 bit。有限次 Monte Carlo 的 ELBO 估计为 −2 bit。可以得出什么结论？'),
      choice: { options: [t('The mathematical bound has been disproved', '数学下界被推翻了'), t('A noisy estimate can exceed log evidence; exact ELBO still cannot', '带噪估计可以超过对数证据；精确 ELBO 仍不能'), t('The exact KL must be negative', '精确 KL 必须为负')], answer: 1 },
      hint: t('A sample average need not equal its expectation.', '样本平均值不一定等于其期望。'),
      explanation: t('The lower-bound claim applies to the exact expectation. Individual finite-sample estimates fluctuate and need not themselves be lower bounds.', '下界性质适用于精确期望。有限样本估计会波动，其每次结果不一定都是下界。'),
    },
    {
      id: 'elbo-gaussian-derivative', title: t('Differentiate the Gaussian ELBO', '求高斯 ELBO 的导数'), prompt: gaussian,
      lines: [t('Reconstruction = C − ½[(x−μ)² + 1]; prior KL = μ²/2.', '重构项 = C − ½[(x−μ)² + 1]；先验 KL = μ²/2。'), t('ELBO = C′ − ½(x−μ)² − ½μ²; C′ = C − 1/2, independent of μ.', 'ELBO = C′ − ½(x−μ)² − ½μ²；C′ = C − 1/2，与 μ 无关。'), `x = ${x}; μ = ${mu}`],
      fields: [{ label: t('Reconstruction derivative: x−μ', '重构导数：x−μ'), answer: x - mu }, { label: t('Negative prior-KL derivative: −μ', '负先验 KL 导数：−μ'), answer: -mu }, { label: t('Total derivative: x−2μ', '总导数：x−2μ'), answer: x - 2 * mu }],
      hint: t('Differentiate both quadratics; the KL penalty is subtracted.', '对两个平方项求导；KL 惩罚项被减去。'),
      explanation: t('The reconstruction pushes by x−μ; the prior penalty contributes −μ. Together ∂μ ELBO = x−2μ.', '重构项推动 x−μ，先验惩罚贡献 −μ，因此 ∂μ ELBO = x−2μ。'),
    },
    {
      id: 'elbo-gradient-direction', title: t('Choose the gradient direction', '选择梯度方向'), prompt: gaussian,
      lines: [`x = ${x}; μ = ${mu}; ∂μ ELBO = x−2μ`],
      choice: { options: [t('Increase μ', '增大 μ'), t('Decrease μ', '减小 μ'), t('Stay: derivative zero', '不动：导数为零')], answer: x - 2 * mu > 0 ? 0 : x - 2 * mu < 0 ? 1 : 2 },
      hint: t('ELBO is maximized, so ascend rather than descend.', '目标是最大化 ELBO，所以做上升而不是下降。'),
      explanation: t(`The derivative is ${x - 2 * mu}; its sign determines the local ascent direction.`, `导数为 ${x - 2 * mu}；其符号决定局部上升方向。`),
    },
    {
      id: 'elbo-gradient-ascent', title: t('Take an ascent step', '做一次梯度上升'), prompt: gaussian,
      lines: [`x = ${x}; μ = ${mu}; ∂μ ELBO = x−2μ`, 'μnew = μ + (1/2) · ∂μ ELBO'],
      fields: [{ label: 'μnew', answer: x / 2 }],
      hint: t('Add half the derivative to the old μ.', '把一半的导数加到原来的 μ 上。'),
      explanation: t(`μnew = ${mu} + (${x} − 2·${mu})/2 = ${x / 2}. This half step reaches the optimal mean for this quadratic.`, `μnew = ${mu} + (${x} − 2·${mu})/2 = ${x / 2}。该平方函数的一次半步更新即可到达最优均值。`),
    },
    {
      id: 'elbo-restricted-optimum', title: t('An optimal mean with a remaining gap', '均值最优仍有间隙'), prompt: gaussian,
      lines: [`x = ${x}; μ* = x/2 = ${x / 2}`, t('The exact posterior is N(x/2, 1/2). q is restricted to variance 1.', '精确后验为 N(x/2, 1/2)。q 的方差被限制为 1。')],
      choice: { options: [t('The gap is zero because the means match', '均值相同，所以间隙为零'), t('The mean is optimal, but the gap is positive because the variances differ', '均值最优，但方差不同，因此间隙为正'), t('The optimal mean is x', '最优均值为 x')], answer: 1 },
      hint: t('Equality requires the entire q distribution to match the posterior.', '取等号需要整个 q 分布与后验一致。'),
      explanation: t('The second derivative is −2, so μ = x/2 maximizes ELBO in this restricted family. Its variance 1 differs from posterior variance 1/2, leaving a positive posterior KL gap.', '二阶导数为 −2，因此 μ = x/2 在此受限分布族中最大化 ELBO。但其方差 1 与后验方差 1/2 不同，后验 KL 间隙仍为正。'),
    },
    {
      id: 'elbo-reparameterization-formula', title: t('Wire the sampling path', '接好采样路径'),
      prompt: t('For q = N(μ,σ²), use a parameter-independent standard normal noise ε. Build the sample.', '对于 q = N(μ,σ²)，使用独立于参数的标准正态噪声 ε。拼出样本。'),
      slots: { before: 'z = ', between: [' + ', ' × '], answers: ['μ', 'σ', 'ε'], tokens: ['μ', 'σ', 'ε', 'σ²'] },
      hint: t('The multiplier is standard deviation, not variance.', '乘数是标准差，而不是方差。'),
      explanation: t('z = μ + σε with ε ∼ N(0,1), hence z has mean μ and variance σ².', 'z = μ + σε，ε ∼ N(0,1)，所以 z 的均值为 μ，方差为 σ²。'),
    },
    {
      id: 'elbo-reparameterization', title: t('Move randomness into ε', '把随机性移到 ε'),
      prompt: t(`For this separate sampling exercise q = N(μ,σ²), z = μ + σε. Hold ε fixed: μ = ${mu}, σ = ${sigma}, ε = ${epsilon}.`, `本题单独考虑 q = N(μ,σ²)，z = μ + σε。固定 ε：μ = ${mu}，σ = ${sigma}，ε = ${epsilon}。`),
      fields: [{ label: 'z', answer: mu + sigma * epsilon }, { label: '∂z/∂μ', answer: 1 }, { label: '∂z/∂σ', answer: epsilon }],
      hint: t('Differentiate the deterministic map while keeping ε constant.', '保持 ε 不变，对确定性映射求导。'),
      explanation: t('Reparameterization uses ε ∼ N(0,1) independent of μ and σ. For a fixed sample, ∂μ z = 1 and ∂σ z = ε; this permits pathwise gradients.', '重参数化使用独立于 μ 和 σ 的 ε ∼ N(0,1)。固定样本时，∂μ z = 1、∂σ z = ε，从而可以沿采样路径求梯度。'),
    },
    {
      id: 'elbo-final-independent', title: t('Independent check: gradient and gap', '独立检查：梯度与间隙'),
      prompt: t('Answer both parts using the data given here.', '使用本题给出的数据回答两部分。'),
      lines: [gaussian, `x = ${finalX}; μ = ${finalMu}; ELBO = C′ − ½(x−μ)² − ½μ²`, t(`Separate discrete model: log₂ p(x) = −${k}, ELBO = −${k + 1}.`, `另一个离散模型：log₂ p(x) = −${k}，ELBO = −${k + 1}。`)],
      fields: [{ label: t('Gaussian ∂μ ELBO (natural logs)', '高斯 ∂μ ELBO（自然对数）'), answer: finalX - 2 * finalMu }, { label: t('Discrete KL(q ‖ p(z|x)) in bits', '离散 KL(q ‖ p(z|x))（bit）'), answer: 1 }],
      hint: t('Differentiate both μ-dependent quadratics. For the separate model, subtract ELBO from log evidence.', '对两个含 μ 的平方项求导。另一个模型中，用对数证据减去 ELBO。'),
      explanation: t(`The Gaussian gradient is x−2μ = ${finalX - 2 * finalMu}. Independently, posterior KL = log₂ p(x)−ELBO = 1 bit. These use different log units and are not combined.`, `高斯梯度为 x−2μ = ${finalX - 2 * finalMu}。独立地，后验 KL = log₂ p(x)−ELBO = 1 bit。两部分使用不同对数单位，不进行合并。`),
    },
  ];
};
