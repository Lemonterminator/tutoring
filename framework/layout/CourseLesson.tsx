import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { frameworkComponents } from '../components';
import { LessonGameLinks } from '../games/GameLinks';
import { courseLang, setCourseLang } from '../i18n/course-state';
import { ThemeToggle } from '../theme/ThemeToggle';
import { getLessonNavigation } from './lesson-catalog';
import { LessonIndex, LessonPager, type LessonIndexData, type LessonNavigationMeta, type LessonNavigationLabels } from './LessonNavigation';

type MdxBody = ComponentType<{ components?: Record<string, unknown> }>;
type CourseSpine = { a?: string; b?: string };

export type CourseLessonMeta = Omit<LessonIndexData, 'spine'> & {
  id: string;
  subject: string;
  kind?: 'game' | 'game-index';
  title: { en: string; zh: string };
  spine?: { en?: CourseSpine; zh?: CourseSpine };
  navigation?: LessonNavigationMeta;
};

type TocItem = { id: string; text: string };

export function CourseLesson({
  meta,
  En,
  Zh,
}: {
  meta: CourseLessonMeta;
  En: MdxBody;
  Zh: MdxBody;
}) {
  const shown = courseLang.value;
  const Body = shown === 'zh' ? Zh : En;
  const articleRef = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const navigation = meta.navigation ?? getLessonNavigation(meta.subject, meta.id);
  const labels: LessonNavigationLabels = shown === 'zh'
    ? {
      index: '课程索引', id: 'ID', module: '模块', prerequisites: '先修课', estimatedHours: '预计时间', spine: '学习主线',
      derivations: '推导', visualizations: '可视化', assignment: '作业', references: '参考文献', contents: '目录',
      previous: '上一课', next: '下一课', openIndex: meta.kind === 'game' ? '小游戏专区' : '全部课程',
    }
    : {
      index: 'Lesson index', id: 'ID', module: 'Module', prerequisites: 'Prerequisites', estimatedHours: 'Estimated time', spine: 'Learning spine',
      derivations: 'Derivations', visualizations: 'Visualizations', assignment: 'Assignment', references: 'References', contents: 'Contents',
      previous: 'Previous lesson', next: 'Next lesson', openIndex: meta.kind === 'game' ? 'Game library' : 'All lessons',
    };
  const indexMeta: LessonIndexData = {
    id: meta.id,
    module: meta.module,
    prereqs: meta.prereqs,
    estimatedHours: meta.estimatedHours,
    spine: meta.spine?.[shown],
    derivations: meta.derivations,
    visualizations: meta.visualizations,
    assignment: meta.assignment,
    references: meta.references,
  };

  useEffect(() => {
    document.documentElement.lang = shown === 'zh' ? 'zh-CN' : 'en';
    document.title = meta.title[shown];
    const headings = articleRef.current?.querySelectorAll('h2[id]') ?? [];
    setToc(Array.from(headings, (heading) => ({ id: heading.id, text: heading.textContent ?? '' })));
  }, [shown, meta.title]);

  return (
    <>
      <header class="topbar">
        <div class="topbar__title">{meta.title[shown]}</div>
        <div class="topbar__controls">
          <div class="seg" role="group" aria-label="Course language">
            <button type="button" aria-pressed={shown === 'en'} onClick={() => setCourseLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={shown === 'zh'} onClick={() => setCourseLang('zh')}>
              中文
            </button>
          </div>
          <ThemeToggle lang={shown} />
        </div>
      </header>

      <div class="page">
        <nav class="toc" aria-label={labels.contents}>
          <LessonIndex meta={indexMeta} toc={toc} labels={labels} />
        </nav>

        <main>
          <article ref={articleRef} class="lesson">
            <h1>{meta.title[shown]}</h1>
            <LessonGameLinks subject={meta.subject} id={meta.id} lang={shown} />
            <Body components={frameworkComponents} />
          </article>
          <LessonPager navigation={navigation} labels={labels} titleLanguage={shown} />
        </main>
      </div>
    </>
  );
}
