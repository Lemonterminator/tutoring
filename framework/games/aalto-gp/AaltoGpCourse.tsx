import type { GameLanguage } from '../types';
import { OcwGameCourse, type OcwCourseConfig, type OcwGame } from '../OcwGameCourse';
import { aaltoGpGameIndex, aaltoGpGames, aaltoGpPlannedGames, aaltoGpUnits } from './registry';
import { aaltoGpChunkLoader } from './chunks';

const TOTAL = aaltoGpPlannedGames.length;

const config: OcwCourseConfig = {
  games: aaltoGpGames as readonly OcwGame[],
  chunks: { index: aaltoGpGameIndex, loader: aaltoGpChunkLoader },
  units: aaltoGpUnits.map(([en, zh], i) => [`Unit ${i + 1} · ${en}`, `单元${i + 1} · ${zh}`] as const),
  storageKey: 'tutoring:aalto-cs-e4895:practice-completed:v1',
  anchorId: 'aalto-gp-play',
  ariaLabel: ['Aalto Gaussian processes game course', 'Aalto 高斯过程小游戏'],
  summary: (practiced, shown, lang) => ({
    headline: lang === 'zh' ? `${shown} / ${TOTAL} 个游戏已上线` : `${shown} of ${TOTAL} games available`,
    progress: lang === 'zh' ? `本浏览器已练习 ${practiced}/${shown}` : `${practiced}/${shown} practiced on this browser`,
  }),
  listHeading: (shown, lang) => lang === 'zh' ? `已上线的 ${shown} 个小游戏，按课程顺序` : `The ${shown} available games, in course order`,
  searchPlaceholder: ['e.g. kernel, Kalman, GP-29', '例如：核、Kalman、GP-29'],
  note: [`Completion marks record practice on this browser; they do not measure mastery. The ${TOTAL} games cover the 12 lectures and 6 assignments of CS-E4895 (2023) and two topics found only in the earlier CS-E4075 special course.`,
    `完成标记记录本浏览器的练习经历，不代表掌握程度。${TOTAL} 个游戏覆盖 CS-E4895（2023）的 12 讲和 6 份作业，以及只出现在早期 CS-E4075 专题课里的两个主题。`],
  officialLabel: ['Lecture PDF on GitHub', 'GitHub 上的讲义 PDF'],
  sourceTitles: true,
  kindLabels: { topic: ['Lecture', '讲次'], bonus: ['CS-E4075', 'CS-E4075'] },
  empty: ['The games of this course are in production; the first ones will appear here.', '本课程的小游戏正在制作中，完成后会出现在这里。'],
};

export function AaltoGpCourse({ lang = 'zh' }: { lang?: GameLanguage }) {
  return <OcwGameCourse lang={lang} config={config} />;
}
