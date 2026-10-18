import type { GameLanguage } from '../types';
import { OcwGameCourse, type OcwCourseConfig, type OcwGame, type OcwProblemSet } from '../OcwGameCourse';
import { mitMultivariableGameIndex, mitMultivariableGames, mitMultivariablePlannedGames, mitMultivariableProblemSets } from './registry';
import { mitMultivariableChunkLoader } from './chunks';

const TOTAL = mitMultivariablePlannedGames.length;

const config: OcwCourseConfig = {
  games: mitMultivariableGames as readonly OcwGame[],
  chunks: { index: mitMultivariableGameIndex, loader: mitMultivariableChunkLoader },
  problemSets: mitMultivariableProblemSets as readonly OcwProblemSet[],
  units: [
    ['Unit 1 · Vectors and matrices', '单元一 · 向量与矩阵'],
    ['Unit 2 · Partial derivatives', '单元二 · 偏导数'],
    ['Unit 3 · Double integrals and line integrals in the plane', '单元三 · 二重积分与平面线积分'],
    ['Unit 4 · Triple integrals and surface integrals in 3-space', '单元四 · 三重积分与空间曲面积分'],
    ['Final review and final exam', '期末复习与期末考试'],
  ],
  storageKey: 'tutoring:mit-18-02sc:practice-completed:v1',
  anchorId: 'mit-mv-play',
  ariaLabel: ['MIT multivariable calculus game course', 'MIT 多变量微积分小游戏'],
  summary: (practiced, shown, lang) => ({
    headline: lang === 'zh' ? `${shown} / ${TOTAL} 个游戏已上线` : `${shown} of ${TOTAL} games available`,
    progress: lang === 'zh' ? `本浏览器已练习 ${practiced}/${shown}` : `${practiced}/${shown} practiced on this browser`,
  }),
  listHeading: (shown, lang) => lang === 'zh' ? `已上线的 ${shown} 个小游戏，按课程顺序` : `The ${shown} available games, in course order`,
  searchPlaceholder: ['e.g. gradient, Green, MIT-MV-17', '例如：梯度、Green、MIT-MV-17'],
  note: [`Completion marks record practice on this browser; they do not measure mastery. The ${TOTAL} planned games cover all 102 sessions and 5 exams of 18.02SC (Fall 2010); games not yet listed are in production.`,
    `完成标记记录本浏览器的练习经历，不代表掌握程度。计划中的 ${TOTAL} 个游戏覆盖 18.02SC（2010 秋）全部 102 个课节和 5 场考试；尚未列出的游戏正在制作中。`],
  sourceLabels: {
    examples: ['Worked examples', '例题'], practice: ['Practice exam', '练习考试'], practiceSolutions: ['Practice exam solutions', '练习考试答案'],
    examProblems: ['Original exam', '原考试题'],
  },
  kindSuffix: { exam: [' · Adapted exam practice', ' · 原考试主题改编练习'] },
};

export function MitMultivariableCourse({ lang = 'zh' }: { lang?: GameLanguage }) {
  return <OcwGameCourse lang={lang} config={config} />;
}
