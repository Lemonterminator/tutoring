import { lessonCatalog } from '../layout/lesson-catalog';
import { resolveLessonHref } from '../layout/LessonNavigation';

type Language = 'en' | 'zh';

const groups = [
  {
    en: 'Foundations and research',
    zh: '数学基础与研究',
    includes: (id: string) => ['QUANT-0', 'QUANT-2', 'QUANT-3'].includes(id),
  },
  {
    en: 'Black–Scholes paper course',
    zh: 'Black–Scholes 论文推导课程',
    includes: (id: string) => id.startsWith('QUANT-BS'),
  },
  {
    en: 'Pricing and numerical engineering',
    zh: '定价与数值工程',
    includes: (id: string) => id.startsWith('QUANT-P'),
  },
];

export function QuantChapterIndex({ lang }: { lang: Language }) {
  const entries = lessonCatalog.filter((entry) =>
    entry.subject === 'quant'
    && entry.id !== 'QUANT-1'
    && entry.kind !== 'game'
    && entry.kind !== 'game-index',
  );
  const groupedEntries = groups.map((group) => ({
    ...group,
    entries: entries.filter((entry) => group.includes(entry.id)),
  }));
  const groupedIds = new Set(groupedEntries.flatMap((group) => group.entries.map((entry) => entry.id)));
  const otherEntries = entries.filter((entry) => !groupedIds.has(entry.id));
  if (otherEntries.length) {
    groupedEntries.push({
      en: 'Other quantitative lessons',
      zh: '其他量化课程',
      includes: () => true,
      entries: otherEntries,
    });
  }

  return (
    <nav class="quant-chapter-index" aria-label={lang === 'zh' ? '量化学习章节' : 'Quantitative learning chapters'}>
      {groupedEntries.map((group) => group.entries.length > 0 && (
        <section class="quant-chapter-index__group" key={group.en} aria-label={group[lang]}>
          <h3>{group[lang]}</h3>
          <div class="course-index__grid">
            {group.entries.map((entry) => (
              <a class="course-index__card" href={resolveLessonHref(entry)} key={entry.id}>
                <span class="course-index__id">{entry.id}</span>
                <strong>{entry.title[lang] ?? entry.title.en}</strong>
              </a>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
