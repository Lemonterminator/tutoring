import { quantLessonHref } from './learning-resources';

const chapters = [
  { id: 'QUANT-BS1', en: 'P/Q measures, diffusion and pricing', zh: 'P/Q 测度、扩散与定价', group: 0 },
  { id: 'QUANT-BS2', en: 'Delta, Gamma and curvature', zh: 'Delta、Gamma 与曲率', group: 0 },
  { id: 'QUANT-BS3', en: 'Finite differences and PDE grids', zh: '有限差分与 PDE 网格', group: 1 },
  { id: 'QUANT-BS4', en: 'Complex-step and 45-degree Gamma', zh: 'Complex-step 与 45° Gamma', group: 1 },
  { id: 'QUANT-BS5', en: 'Complex CDF, Hermite and P3', zh: '复数 CDF、Hermite 与 P3', group: 1 },
  { id: 'QUANT-BS6', en: 'Vega, Theta, Rho and dividends', zh: 'Vega、Theta、Rho 与股息', group: 2 },
  { id: 'QUANT-BS7', en: 'Put pricing and parity', zh: 'Put 定价与平价', group: 2 },
  { id: 'QUANT-BS8', en: 'Higher Greeks, Hessians and IV', zh: '高阶 Greeks、Hessian 与 IV', group: 3 },
];

const groups = [
  { en: '1. Model, pricing and PDE', zh: '1. 模型、定价与 PDE' },
  { en: '2. Numerical differentiation and complex CDF', zh: '2. 数值求导与复数 CDF' },
  { en: '3. Risk sensitivities and Put', zh: '3. 风险敏感度与 Put' },
  { en: '4. Higher derivatives and IV', zh: '4. 高阶导数与 IV' },
];

export function BSCourseContents({ lang }: { lang: 'en' | 'zh' }) {
  return <div class="bs-paper-route">{groups.map((group, index) => <section key={index}>
    <h3>{group[lang]}</h3>
    <ol>{chapters.filter((chapter) => chapter.group === index).map((chapter) => <li key={chapter.id}>
      <a href={quantLessonHref(chapter.id)}>{chapter[lang]}</a>
    </li>)}</ol>
  </section>)}</div>;
}

export function bsMaterialHref(filename: string): string {
  return `${import.meta.env.DEV ? '/' : './'}quant-materials/bs-math/${filename}`;
}

const stems = ['01_model_and_price', '02_delta_gamma', '03_finite_differences', '04_complex_step',
  '05_cdf_and_order', '06_first_order_greeks', '07_put_and_parity', '08_higher_greeks'];

const evidence: Record<number, string[]> = {
  0: ['numerical_notes.md', 'greeks_reference.csv', 'derivative_comparisons.csv', 'measure_probabilities.csv',
    'scenario1.csv', 'scenario2.csv', 'error_summary.csv', 'p1_gamma_limit.csv', 'taylor_shocks.csv'],
  1: ['measure_probabilities.csv'], 2: ['greeks_reference.csv'],
  3: ['scenario1.csv', 'scenario2.csv', 'error_summary.csv'], 4: ['p1_gamma_limit.csv'],
  5: ['p1_gamma_limit.csv', 'complex_cdf_series.md', 'cdf_performance.md'],
  6: ['greeks_reference.csv', 'derivative_comparisons.csv'],
  7: ['greeks_reference.csv', 'derivative_comparisons.csv'],
  8: ['taylor_shocks.csv', 'greeks_reference.csv', 'derivative_comparisons.csv'],
};

export function BSMaterials({ lang, lesson = 0 }: { lang: 'en' | 'zh'; lesson?: number }) {
  const chinese = lang === 'zh';
  const stem = stems[lesson - 1];
  return <section class="bs-paper-materials" aria-label={chinese ? '打印与数值资料' : 'Printable and numerical materials'}>
    <h2>{chinese ? '打印与数值资料' : 'Printable and numerical materials'}</h2>
    <p>{chinese ? '先手算，再对照这些样例。样例一致性不代表全参数域的证明；本课程目前没有通过 Lean 的形式化证明。'
      : 'Work by hand first, then compare these examples. Agreement on examples is not a proof over the full domain. This course currently has no Lean-checked formal proofs.'}</p>
    <ul>
      {stem && <li><a href={bsMaterialHref(`pdf/${stem}.pdf`)}>{lesson === 1
        ? (chinese ? '原版纸笔 PDF（未含本页新增 RN 基础；完整内容见 Markdown）' : 'Original paper PDF (RN additions are in the complete Markdown below)')
        : (chinese ? '本篇纸笔打印版' : 'Printable version of this chapter')}</a></li>}
      <li><a href={bsMaterialHref('pdf/black_scholes_paper_workbook.pdf')}>{chinese ? '八篇课程合订本' : 'Combined eight-chapter workbook'}</a></li>
      <li><a href={bsMaterialHref('pdf/original_assignment.pdf')}>{chinese ? '原始五页作业' : 'Original five-page assignment'}</a></li>
      {stem && <li><a href={bsMaterialHref(`${stem}.${lang}.md`)} download>{chinese ? '下载本篇 Markdown' : 'Download chapter Markdown'}</a></li>}
      {(evidence[lesson] ?? []).map((name) => <li key={name}><a href={bsMaterialHref(name)} download>{name}</a></li>)}
    </ul>
  </section>;
}
