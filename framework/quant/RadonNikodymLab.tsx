import { signal } from '@preact/signals';
import { courseLang } from '../i18n/course-state';
import { Slider } from '../interact/Controls';
import { reweightTwoStates } from './radon-nikodym';

// CourseLesson remounts MDX on language changes; retain this experiment's input.
const pUp = signal(0.7);

export function RadonNikodymLab() {
  const zh = courseLang.value === 'zh';
  const tr = (cn: string, en: string) => zh ? cn : en;
  const result = reweightTwoStates(pUp.value);
  const percent = (n: number) => `${(100 * n).toFixed(0)}%`;
  const fixed = (n: number) => n.toFixed(3);
  return <section class="rn-lab" aria-label={tr('RN 概率重加权实验', 'RN probability reweighting lab')}>
    <h4>{tr('动手：结果不变，改变它们的概率权重', 'Explore: fixed outcomes, different probability weights')}</h4>
    <p>{tr('沿用 1.2：S₀ = 100，r = q = 0，S₁ 为 120 或 80，Call 收益为 20 或 0。给定这些市场价格，Q 的上涨概率固定为 50%。',
      'From 1.2: S₀ = 100, r = q = 0, S₁ is 120 or 80, and the Call pays 20 or 0. These market prices fix the Q up probability at 50%.')}</p>
    <Slider label={tr('P 下上涨概率', 'Up probability under P')} min={0.1} max={0.9} step={0.1}
      value={pUp.value} display={percent(pUp.value)} onInput={value => { pUp.value = value; }} />
    <div class="rn-lab__states">
      {result.rows.map(row => <div class="rn-lab__state" key={row.state}>
        <strong>{row.state === 'up' ? tr('上涨', 'Up') : tr('下跌', 'Down')} · S₁ = {row.stock} · H = {row.payoff}</strong>
        <div class="rn-lab__bar-row"><span>P</span><div class="rn-lab__track" aria-hidden="true"><div class="rn-lab__bar" style={{ width: percent(row.p) }} /></div><span>{percent(row.p)}</span></div>
        <div class="rn-lab__bar-row"><span>Q</span><div class="rn-lab__track" aria-hidden="true"><div class="rn-lab__bar rn-lab__bar--q" style={{ width: percent(row.q) }} /></div><span>{percent(row.q)}</span></div>
        <p>L = Q / P = {fixed(row.q)} / {fixed(row.p)} = <strong>{fixed(row.weight)}</strong></p>
        <p>P × L = {fixed(row.p)} × {fixed(row.weight)} ≈ {fixed(row.p * row.weight)} = Q</p>
      </div>)}
    </div>
    <div class="rn-lab__readout" aria-live="polite" aria-atomic="true">
      <p>Eₚ[L] = <strong>{fixed(result.mass)}</strong> · Eₚ[L S₁] = <strong>{fixed(result.weightedStock)}</strong></p>
      <p>Eₚ[H] = <strong>{fixed(result.physicalPayoff)}</strong> · Eₚ[L H] = E_Q[H] = <strong>{fixed(result.weightedPayoff)}</strong></p>
    </div>
    <p>{tr('先拖到 40%，再拖到 50%：哪一个权重大于 1？何时两个权重都等于 1？Q 的 50% 来自复制定价；RN 导数负责把已给定的 P 转成 Q。图中数值是精确有限状态求和后的显示舍入，没有抽样误差。',
      'Try 40%, then 50%: which weight exceeds 1? When do both weights equal 1? Replication determines Q = 50%; the RN derivative converts the given P into Q. Displayed values are rounded exact finite-state sums, with no sampling error.')}</p>
  </section>;
}
