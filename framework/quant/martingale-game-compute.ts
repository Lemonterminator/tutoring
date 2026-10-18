export type MartingaleCard = {
  title: string; prompt: string; lines?: string[];
  fields?: { label: string; answer: number }[];
  choices?: string[]; correct?: number;
  formula?: boolean; hint: string; explanation: string;
};
export function martingaleCards(seed: number, lang: 'zh' | 'en'): MartingaleCard[] {
  let state = seed >>> 0;
  const pick = (max: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return 1 + Math.floor(state / 4294967296 * max); };
  const m = 2 * pick(4), d = 2 * pick(2), a = pick(3), stake = pick(3), s = pick(2);
  const leaves = [0, 4, 8, 12].map((base) => base + 4 * (pick(2) - 1));
  const h = (leaves[0] + leaves[1]) / 2, t = (leaves[2] + leaves[3]) / 2;
  const tr = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const tree = [`HH → ${leaves[0]}`, `HT → ${leaves[1]}`, `TH → ${leaves[2]}`, `TT → ${leaves[3]}`];
  return [
    { title: tr('拼出鞅条件', 'Build the martingale condition'), formula: true,
      prompt: tr('Mₙ 是当前值，ℱₙ 是截至 n 的全部信息。未来值应在哪些信息下取条件期望，等于哪个值？', 'Mₙ is the current value; ℱₙ is all information through n. Which information and value belong in the condition?'),
      hint: tr('用现在的信息预测下一步，预测均值等于当前值。', 'Predict the next step using current information; its conditional mean equals the current value.'),
      explanation: tr('E[Mₙ₊₁ | ℱₙ] = Mₙ；此外还要求过程适应 ℱₙ，且每个 Mₙ 可积。本局的有限树模型满足后两项。', 'E[Mₙ₊₁ | ℱₙ] = Mₙ. Adaptedness and integrability are also required; our finite tree models satisfy both.') },
    { title: tr('公平一步', 'One fair step'), prompt: tr(`已知 Mₙ = ${m}。下一步独立地以 1/2 概率增减 ${d}。填条件期望。`, `Given Mₙ = ${m}, the next independent increment is ±${d}, each with probability 1/2. Fill the conditional mean.`),
      lines: [`1/2 → ${m + d}`, `1/2 → ${m - d}`], fields: [{label:'E[Mₙ₊₁ | ℱₙ] =',answer:m}],
      hint: tr('两种未来等概率，取平均。', 'Average the two equally likely futures.'), explanation: `(${m + d} + ${m - d}) / 2 = ${m}.` },
    { title: tr('偏置硬币：先算', 'Biased coin: calculate'), prompt: tr(`仍在 ${m}，现在上涨 ${d} 的概率为 3/4，下跌 ${d} 的概率为 1/4。`, `Still at ${m}, now the probability of +${d} is 3/4 and of −${d} is 1/4.`),
      lines: [`3/4 → ${m + d}`, `1/4 → ${m - d}`], fields:[{label:'E[Mₙ₊₁ | ℱₙ] =',answer:m+d/2}],
      hint: tr('把上涨的未来值算三份，下跌算一份，总和除以 4。', 'Count the upper value three times and the lower value once, then divide by 4.'), explanation: tr(`条件均值是 ${m+d/2}，比现在 ${m} 大 ${d/2}。`, `The conditional mean ${m+d/2} exceeds the current value ${m} by ${d/2}.`) },
    { title: tr('条件均值不等：怎么分类？', 'Classify the drift'), prompt: tr('每一步都按上一关的独立偏置硬币更新。相对自然信息流，这个过程是什么？', 'Every step follows the same independent biased coin. Classify the process relative to its natural filtration.'),
      choices:[tr('鞅', 'Martingale'),tr('次鞅：条件均值 ≥ 当前值', 'Submartingale: conditional mean ≥ current value'),tr('上鞅：条件均值 ≤ 当前值', 'Supermartingale: conditional mean ≤ current value')],correct:1,
      hint: tr('“次鞅”对应向上的条件均值不等式。', 'Submartingale uses the upward conditional-mean inequality.'), explanation: tr('这里条件均值严格更大，所以是次鞅，不是鞅。去掉每步平均漂移，才会得到一个鞅。', 'Here the conditional mean is strictly larger: a submartingale, not a martingale. Subtracting the per-step mean drift yields a martingale.') },
    { title: tr('信息树：只平均尚未揭晓的分支', 'Information tree: average unresolved branches'), prompt: tr('独立公平硬币投两次；H/T 为正/反面。终值 Y 如下。现在第一次结果已知，第二次未知。', 'Flip independent fair coins twice (H/T). Terminal payoff Y is shown below. The first flip is known; the second is unknown.'),
      lines:tree,fields:[{label:tr('已知第一次 H：E[Y | ℱ₁] =', 'First H: E[Y | ℱ₁] ='),answer:h},{label:tr('已知第一次 T：E[Y | ℱ₁] =', 'First T: E[Y | ℱ₁] ='),answer:t}],
      hint: tr('已知 H 就只留 HH、HT；已知 T 就只留 TH、TT。', 'Given H, keep HH and HT only; given T, keep TH and TT only.'), explanation: tr(`两种已知历史的预测分别为 ${h} 和 ${t}。不能再平均不可能的分支。`, `The predictions for the two histories are ${h} and ${t}. Do not average branches excluded by known information.`) },
    { title: tr('从终值倒推：Doob 鞅', 'Work backwards: a Doob martingale'), prompt: tr(`投币前无信息，定义 Mₙ = E[Y | ℱₙ]。上关 M₁ 的两个可能值为 ${h} 和 ${t}，等概率。填 M₀。`, `Before either flip, define Mₙ = E[Y | ℱₙ]. The previous M₁ values are ${h} and ${t}, equally likely. Fill M₀.`),
      fields:[{label:'M₀ =',answer:(h+t)/2}],hint: tr('平均两种第一步预测。', 'Average the two first-step predictions.'), explanation: tr('M₂ = Y；每个父节点都是子节点的条件平均。这体现塔式法则：E[E[Y|ℱₙ₊₁]|ℱₙ] = E[Y|ℱₙ]。', 'M₂ = Y. Each parent is the conditional average of its children. The tower property gives E[E[Y|ℱₙ₊₁]|ℱₙ] = E[Y|ℱₙ].') },
    { title: tr('均值不变的陷阱', 'The constant-mean trap'), prompt: tr(`令 M₀=0，M₁ 等概率为 ±${a}，之后 M₂=−M₁。ℱ₁ 已揭晓 M₁。先填无条件均值。`, `Let M₀=0, M₁ be ±${a} with equal probability, and M₂=−M₁. ℱ₁ reveals M₁. First fill the unconditional means.`),
      fields:[{label:'E[M₁] =',answer:0},{label:'E[M₂] =',answer:0}],hint: tr('每一步的正负值都等概率。', 'At each step the opposite values are equally likely.'), explanation: tr('两步的无条件均值都是 0，但这还没有检查鞅的条件期望。', 'Both unconditional means are zero, but the conditional-mean requirement is still unchecked.') },
    { title: tr('抓出反例', 'Expose the counterexample'), prompt: tr(`沿用上关过程。现在已知 M₁=${a}，M₂=−M₁。填 E[M₂|ℱ₁]。`, `In the same process, M₁=${a} is now known and M₂=−M₁. Fill E[M₂|ℱ₁].`),
      fields:[{label:'E[M₂ | ℱ₁] =',answer:-a}],hint: tr('未来值已由当前信息确定，不再有两个可能分支。', 'Current information determines the future value; there are no longer two possible branches.'), explanation: tr(`条件均值为 −${a}，不等于当前 ${a}，所以不是鞅。均值保持不变只是必要条件。`, `The conditional mean is −${a}, not the current ${a}; this is not a martingale. Constant mean is only necessary.`) },
    { title: tr('不能偷看未来', 'No peeking at the future'), prompt: tr(`下一次独立公平投币 Xₙ₊₁=±1。如果提前选固定赌注 ${stake}，增量为 ${stake}Xₙ₊₁，条件均值为 0。有人改用 hₙ=Xₙ₊₁，增量 hₙXₙ₊₁=1。问题在哪里？`, `The next independent fair flip is Xₙ₊₁=±1. A stake ${stake} chosen beforehand gives increment ${stake}Xₙ₊₁ with conditional mean zero. Someone sets hₙ=Xₙ₊₁, so the gain is always 1. What fails?`),
      choices:[tr('赌注使用了尚未揭晓的未来，ℱₙ 中不可知', 'The stake uses a future outcome unavailable in ℱₙ'),tr('公平硬币其实偏置', 'The fair coin is biased'),tr('鞅允许任何赌注规则', 'Any stake rule preserves a martingale')],correct:0,
      hint: tr('赌注必须在下一次投币之前，用当前信息决定。', 'The stake must be chosen from current information before the next flip.'), explanation: tr('可预测策略要求 hₙ 对 ℱₙ 可测。此规则偷看 Xₙ₊₁；若扩大信息流让未来已知，原随机游走也不再是该信息流下的鞅。这里的正常策略有界，满足可积性。', 'A predictable strategy requires hₙ to be ℱₙ-measurable. This rule peeks at Xₙ₊₁. Enlarging the filtration to reveal that future also destroys the original random walk’s martingale property. Our legitimate bounded stakes satisfy integrability.') },
    { title: tr('平方过程：补偿漂移', 'Square process: compensate its drift'), prompt: tr(`公平随机游走 S 的下一步独立增量为 ±${d}。当前 Sₙ=${s}。先平均平方后的两个未来。`, `A fair random walk S has next independent increment ±${d}. Currently Sₙ=${s}. Average the squares of the two future values.`),
      lines:[`1/2 → (${s+d})² = ${(s+d)**2}`,`1/2 → (${s-d})² = ${(s-d)**2}`],fields:[{label:'E[Sₙ₊₁² | ℱₙ] =',answer:s*s+d*d},{label:tr('令 Mₙ=Sₙ²−n·c：c =', 'Set Mₙ=Sₙ²−n·c: c ='),answer:d*d}],
      hint: tr('相加时交叉项抵消，留下 Sₙ²+d²；每步减掉 d²。', 'The cross terms cancel, leaving Sₙ²+d². Subtract d² per step.'), explanation: tr(`对任意当前状态，E[Sₙ₊₁²|ℱₙ]=Sₙ²+${d*d}。所以 Sₙ²−n·${d*d} 是鞅，Sₙ² 本身是次鞅。`, `For every current state, E[Sₙ₊₁²|ℱₙ]=Sₙ²+${d*d}. Thus Sₙ²−n·${d*d} is a martingale; Sₙ² itself is a submartingale.`) },
    { title: tr('有限停止：枚举终值', 'Bounded stopping: enumerate payoffs'), prompt: tr(`从 S₀=0 开始，每步独立公平增减 ${d}。规则：第一步上涨就停，否则第二步后必停。四条潜在投币路径等概率。填停止值的平均。`, `Start S₀=0 with independent fair increments ±${d}. Stop after an upward first step; otherwise stop after step two. The four potential coin paths are equally likely. Average the stopped values.`),
      lines:[`HH → ${d}`,`HT → ${d}`,`TH → 0`,`TT → ${-2*d}`],fields:[{label:'E[Sτ] =',answer:0}],hint: tr('HH、HT 都在第一步停；第二次潜在投币不会改变已经停止的值。', 'HH and HT both stop at step one; the potential second flip cannot change the stopped value.'),explanation: tr('τ≤2 是有界停止时刻：是否已停，只看当时已知历史。枚举得到 E[Sτ]=S₀=0；无需模拟来猜答案。', 'τ≤2 is a bounded stopping time, decided from available history. Enumeration gives E[Sτ]=S₀=0 without simulation.') },
    { title: tr('最终判断：无限等到赢一次？', 'Final judgment: wait indefinitely for a win?'), prompt: tr('把规则改成：从 0 出发，公平 ±1 随机游走，第一次到 +1 才停，无时间上限。能只凭“过程是鞅”断言 E[Sτ]=0 吗？', 'Change the rule: a fair ±1 random walk starts at 0 and stops on first reaching +1, with no time limit. Does being a martingale alone imply E[Sτ]=0?'),
      choices:[tr('能，鞅对任何停止规则都成立', 'Yes, for every stopping rule'),tr('不能，需要检查停止定理的附加条件', 'No, the stopping theorem needs additional conditions')],correct:1,
      hint: tr('上关有明确的 τ≤2，这关没有。', 'Previously τ≤2 was guaranteed. Here it is not.'),explanation: tr('该对称随机游走最终到 +1 的概率为 1，停止值为 1；其到达时间期望无限。不能把有界停止结论直接套用。其他可选停止定理有不同条件，须逐一检查。', 'This symmetric walk reaches +1 almost surely, so its stopped value is 1, while the expected hitting time is infinite. The bounded-stopping result cannot be applied directly. Other optional-stopping versions have different hypotheses.') },
  ];
}
