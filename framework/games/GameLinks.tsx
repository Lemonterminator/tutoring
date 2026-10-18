import { lessonCatalog } from '../layout/lesson-catalog';
import { resolveLessonHref } from '../layout/LessonNavigation';
import type { GameLanguage } from './types';
import '../quant/dot-product-game.css';

export function LessonGameLinks({ subject, id, lang }: { subject: string; id: string; lang: GameLanguage }) {
  const games = lessonCatalog.filter(entry => entry.kind === 'game' && entry.sourceLesson === `${subject}:${id}`).sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));
  if (!games.length) return null;
  return <aside class="dot-game" aria-label={lang === 'zh' ? '本课小游戏' : 'Games for this lesson'}>
    <h2>{lang === 'zh' ? '先用小游戏练这一课' : 'Practice this lesson with games'}</h2>
    <div class="course-index__grid">{games.map(entry => <a key={entry.id} class="course-index__card" href={resolveLessonHref(entry)}><strong>{lang === 'zh' ? entry.title.zh ?? entry.title.en : entry.title.en}</strong></a>)}</div>
  </aside>;
}

export function SourceLessonLink({ source, lang }: { source: string; lang: GameLanguage }) {
  const entry = lessonCatalog.find(entry => `${entry.subject}:${entry.id}` === source);
  if (!entry) return null;
  return <p><a href={resolveLessonHref(entry)}>{lang === 'zh' ? '查看原课：' : 'Read the source lesson: '}{lang === 'zh' ? entry.title.zh ?? entry.title.en : entry.title.en}</a></p>;
}
