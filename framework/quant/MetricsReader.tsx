import { useState } from 'preact/hooks';
import { graphConceptHref, metricsSections } from './learning-resources';
import './quant-learning.css';

export function MetricsReader({ lang }: { lang: 'en' | 'zh' }) {
  const chinese = lang === 'zh';
  const [section, setSection] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    return metricsSections.some((item) => item.id === requested) ? requested! : 'sec1';
  });
  const current = metricsSections.find((item) => item.id === section)!;
  const src = new URL(`${import.meta.env.DEV ? '/' : './'}quant-materials/regression-metrics/metrics_derivations_${lang}.html#${section}`, window.location.href).href;
  return <div class="quant-reader">
    <div class="quant-reader__controls">
      <label>{chinese ? '章节快捷入口' : 'Jump to a chapter'}
        <select value={section} onChange={(event) => {
          const value = event.currentTarget.value;
          setSection(value);
          const url = new URL(window.location.href); url.searchParams.set('section', value);
          history.replaceState(null, '', url);
        }}>
          {metricsSections.map((item) => <option key={item.id} value={item.id}>{chinese ? item.zh : item.en}</option>)}
        </select>
      </label>
      <a href={src} target="_blank" rel="noopener noreferrer">{chinese ? '独立打开本章' : 'Open chapter separately'} ↗</a>
    </div>
    <p class="quant-reader__note">{chinese
      ? '保留原材料全部推导、公式、参考文献与 15 个交互实验。章节可展开或收起；调节滑块观察指标变化。原中文版为繁体中文。'
      : 'All derivations, equations, references and 15 interactive experiments are preserved. Expand a chapter and move its sliders to explore the metrics.'}</p>
    <iframe key={`${lang}:${section}`} src={src} title={chinese ? '回归指标与量化风险推导教材' : 'Regression metrics and quantitative risk derivations'}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />
    {!!current.concepts.length && <p class="quant-reader__links">{chinese ? '回到相关基础概念：' : 'Related foundations: '}
      {current.concepts.map((id) => <a key={id} href={graphConceptHref(id)}>{id.replaceAll('-', ' ')}</a>)}
    </p>}
  </div>;
}
