import { lessonCatalog } from '../layout/lesson-catalog';
import { resolveLessonHref } from '../layout/LessonNavigation';

export function GameLibrary({ lang = 'zh' }: { lang?: 'en' | 'zh' }) {
  const games = lessonCatalog.filter((entry) => entry.kind === 'game').sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));
  const groups = [...new Set(games.map(entry => entry.gameGroup ?? 'foundations'))];
  const names: Record<string, { en: string; zh: string }> = {
    foundations: { en: 'Mathematics and probability', zh: '数学与概率' },
    'mit-linear-algebra': { en: 'MIT 18.06SC · Complete linear algebra course', zh: 'MIT 18.06SC · 线性代数全课程' },
    'mit-multivariable-calculus': { en: 'MIT 18.02SC · Multivariable calculus course', zh: 'MIT 18.02SC · 多变量微积分全课程' },
    'aalto-gp': { en: 'Aalto CS-E4895 · Gaussian processes course', zh: 'Aalto CS-E4895 · 高斯过程全课程' },
    'gp-finance': { en: 'Gaussian processes and portfolios · bridge', zh: '高斯过程与投资组合 · 桥接' },
    optimization: { en: 'Jacobians and optimization', zh: '雅各比与优化' },
    variational: { en: 'KL, ELBO and variational gradients', zh: 'KL、ELBO 与变分梯度' },
    'llm-foundations': { en: 'LLM lesson one · notation and gradient checks', zh: 'LLM 第一课 · 符号表示与梯度检查' },
  };
  return <div>{groups.map(group => <section key={group} class="course-index__group">
    <h3>{names[group]?.[lang] ?? group}</h3>
    <div class="course-index__grid">{games.filter(entry => (entry.gameGroup ?? 'foundations') === group).map((entry) => <a class="course-index__card" key={`${entry.subject}:${entry.id}`} href={resolveLessonHref(entry)}>
        <span class="course-index__id">{entry.id}</span>
        <strong>{lang === 'zh' ? entry.title.zh ?? entry.title.en : entry.title.en}</strong>
        <span class="course-index__module">{lang === 'zh' ? '进入游戏 →' : 'Play →'}</span>
      </a>)}</div>
  </section>)}</div>;
}
