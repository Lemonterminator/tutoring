import type { GameLanguage } from '../types';
import { OcwGameCourse, type OcwCourseConfig, type OcwGame } from '../OcwGameCourse';
import { mitLinearAlgebraGames, mitLinearAlgebraGenerators } from './registry';

const config: OcwCourseConfig = {
  games: mitLinearAlgebraGames as readonly OcwGame[],
  generators: mitLinearAlgebraGenerators,
  units: [
    ['Unit I · Ax = b and the four subspaces', '单元一 · Ax = b 与四个子空间'],
    ['Unit II · Least squares, determinants and eigenvalues', '单元二 · 最小二乘、行列式与特征值'],
    ['Unit III · Positive definiteness and applications', '单元三 · 正定性与应用'],
    ['Final review, final exam and 2023 supplement', '期末复习、期末挑战与 2023 补充'],
  ],
  storageKey: 'tutoring:mit-18-06sc:practice-completed:v1',
  anchorId: 'mit-la-play',
  ariaLabel: ['MIT linear algebra complete game course', 'MIT 线性代数全课程小游戏'],
  summary: (practiced, _shown, lang) => ({
    headline: lang === 'zh' ? '40 个主线游戏 + 1 个补充游戏' : '40 main-course games + 1 supplement',
    progress: lang === 'zh' ? `本浏览器已练习 ${practiced}/41` : `${practiced}/41 practiced on this browser`,
  }),
  listHeading: (_shown, lang) => lang === 'zh' ? '全部 41 个小游戏，按课程顺序' : 'All 41 games, in course order',
  searchPlaceholder: ['e.g. eigenvalues, SVD, MIT-LA-10', '例如：特征值、SVD、MIT-LA-10'],
  note: ['Completion marks record practice on this browser; they do not measure mastery. The 40 main games cover every teaching/review/exam session in the 2011 package. The 2023 lecture is a separate supplement.', '完成标记记录本浏览器的练习经历，不代表掌握程度。40 个主线游戏对应 2011 课程包的全部教学、复习和考试环节；2023 告别讲座单独作为补充。'],
  kindSuffix: { exam: [' · Adapted exam practice', ' · 原考试主题改编练习'], bonus: [' · Optional 2023 supplement', ' · 2023 可选补充'] },
};

export function MitLinearAlgebraCourse({ lang = 'zh' }: { lang?: GameLanguage }) {
  return <OcwGameCourse lang={lang} config={config} />;
}
