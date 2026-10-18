import { courseLang, setCourseLang } from '../i18n/course-state';
import { displayLang } from '../i18n/state';
import { ThemeToggle } from '../theme/ThemeToggle';
import { lessonCatalog } from './lesson-catalog';
import { resolveLessonHref } from './LessonNavigation';

const subjectTitles: Record<string, string> = {
  llm: 'LLM architecture',
  nvidia: 'NVIDIA Graduate Program interview graph',
  quant: 'Quantitative learning · mathematics, pricing and risk',
  math: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
};

function titleFor(entry: (typeof lessonCatalog)[number]): string {
  if (courseLang.value === 'zh' && entry.title.zh) return entry.title.zh;
  if (entry.subject !== 'llm' && displayLang.value === 'fi') return entry.title.fi ?? entry.title.en;
  return entry.title.en;
}

export function CourseIndex() {
  const courseEntries = lessonCatalog.filter((entry) => entry.kind !== 'game' && entry.kind !== 'game-index');
  const gameIndex = lessonCatalog.find((entry) => entry.kind === 'game-index');
  const gameCount = lessonCatalog.filter((entry) => entry.kind === 'game').length;
  const groups = [...new Set(courseEntries.map((entry) => entry.subject))];
  return (
    <>
      <header class="topbar">
        <div class="topbar__title">Tutoring course index</div>
        <div class="topbar__controls">
          <span>{courseEntries.length} lessons · {gameCount} games</span>
          <div class="seg" role="group" aria-label="Course language">
            <button type="button" aria-pressed={courseLang.value === 'en'} onClick={() => setCourseLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={courseLang.value === 'zh'} onClick={() => setCourseLang('zh')}>
              中文
            </button>
          </div>
          <ThemeToggle lang={courseLang.value} />
        </div>
      </header>
      <main class="course-index">
        <header class="course-index__hero">
          <p class="course-index__eyebrow">Tutoring</p>
          <h1>Choose a lesson</h1>
          <p>Each lesson keeps its own language toggle, derivation map, numerical checks, and interactive figures.</p>
        </header>
        {gameIndex && <section class="course-index__group">
          <h2>{courseLang.value === 'zh' ? '数学小游戏' : 'Math games'}</h2>
          <div class="course-index__grid">
            <a class="course-index__card" href={resolveLessonHref(gameIndex)}>
              <strong>{courseLang.value === 'zh' ? '进入小游戏专区' : 'Open the game library'}</strong>
              <span class="course-index__module">{courseLang.value === 'zh' ? `${gameCount} 个主题 · 点击查看全部小游戏 →` : `${gameCount} topics · Browse all games →`}</span>
            </a>
          </div>
        </section>}
        {groups.map((subject) => {
          const entries = courseEntries.filter((entry) => entry.subject === subject);
          const displayedEntries = subject === 'quant'
            ? entries.filter((entry) => entry.id === 'QUANT-1')
            : entries;
          return (
            <section class="course-index__group" key={subject}>
              <h2>{subjectTitles[subject] ?? subject}</h2>
              <div class="course-index__grid">
                {displayedEntries.map((entry) => (
                  <a class="course-index__card" href={resolveLessonHref(entry)} key={`${entry.subject}:${entry.id}`}>
                    <span class="course-index__id">{entry.id}</span>
                    <strong>{titleFor(entry)}</strong>
                    <span class="course-index__module">
                      {subject === 'quant'
                        ? courseLang.value === 'zh' ? '进入路线图查看全部量化章节 →' : 'Open the roadmap to browse all quantitative chapters →'
                        : entry.module ?? subject}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
