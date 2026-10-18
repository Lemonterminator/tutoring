import type { GameLanguage } from '../types';
import { OcwGameCourse, type OcwCourseConfig, type OcwGame } from '../OcwGameCourse';
import { gpFinanceGameIndex, gpFinanceGames, gpFinancePlannedGames, gpFinanceUnits } from './registry';
import { gpFinanceChunkLoader } from './chunks';

const TOTAL = gpFinancePlannedGames.length;

const config: OcwCourseConfig = {
  games: gpFinanceGames as readonly OcwGame[],
  chunks: { index: gpFinanceGameIndex, loader: gpFinanceChunkLoader },
  units: gpFinanceUnits,
  storageKey: 'tutoring:gp-finance-bridge:practice-completed:v1',
  anchorId: 'gp-finance-play',
  ariaLabel: ['Gaussian processes and portfolios: bridge games', '高斯过程与投资组合：桥接小游戏'],
  summary: (practiced, shown, lang) => ({
    headline: lang === 'zh' ? `${shown} / ${TOTAL} 个游戏已上线` : `${shown} of ${TOTAL} games available`,
    progress: lang === 'zh' ? `本浏览器已练习 ${practiced}/${shown}` : `${practiced}/${shown} practiced on this browser`,
  }),
  listHeading: (shown, lang) => lang === 'zh' ? `已上线的 ${shown} 个桥接游戏` : `The ${shown} available bridge games`,
  searchPlaceholder: ['e.g. Black–Litterman, shrinkage', '例如：Black–Litterman、收缩'],
  note: ['These games are an extension written for this site, not part of the Aalto course. Completion marks record practice on this browser; they do not measure mastery.',
    '这些游戏是本站补充的扩展内容，不属于 Aalto 课程。完成标记记录本浏览器的练习经历，不代表掌握程度。'],
  officialLabel: ['Related lecture PDF on GitHub', 'GitHub 上的相关讲义 PDF'],
  sourceTitles: true,
  kindLabels: { bonus: ['Bridge', '桥接'] },
  empty: ['The bridge games are in production; they will appear here.', '桥接小游戏正在制作中，完成后会出现在这里。'],
};

export function GpFinanceCourse({ lang = 'zh' }: { lang?: GameLanguage }) {
  return <OcwGameCourse lang={lang} config={config} />;
}
