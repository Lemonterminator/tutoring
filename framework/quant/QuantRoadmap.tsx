import { graphConceptHref, quantLessonHref } from './learning-resources';
import './quant-learning.css';

const topics = [
  { en: '1. Linear algebra and multivariable calculus', zh: '1. 线性代数与多元微积分',
    detailEn: 'Projections, SVD/PCA, positive definite matrices, gradients, Hessians and Taylor expansions.', detailZh: '投影、SVD/PCA、正定矩阵、梯度、Hessian 与泰勒展开。',
    statusEn: 'Complete MIT 18.06SC and 18.02SC static course packages are available in the university materials library.', statusZh: '已接入 MIT 18.06SC 与 18.02SC 整包材料，可按需查缺补漏。', concept: 'orthogonality' },
  { en: '2. Probability and mathematical statistics', zh: '2. 概率论与数理统计',
    detailEn: 'Conditional expectation, LLN/CLT, estimation, hypothesis testing and regression assumptions.', detailZh: '条件期望、大数律、中心极限定理、估计、假设检验与回归假设。',
    statusEn: 'STAT and its Chinese textbook are in the graph; MIT 6.041SC and 18.650 supply additional full course materials.', statusZh: '已有 STAT 中文教材，并补充 MIT 6.041SC 与 18.650 整套课程材料。', concept: 'statistical-inference' },
  { en: '3. Regression, statistical learning and model evaluation', zh: '3. 回归、统计学习与模型评估',
    detailEn: 'Regularization, out-of-sample prediction, proper scoring, calibration and selection bias.', detailZh: '正则化、样本外预测、适当评分、校准与选择偏差。',
    statusEn: 'The new bilingual reading supplies detailed evaluation and risk derivations; it does not replace a full statistical learning course.', statusZh: '新接入双语材料补充评估与风险推导；统计学习仍需系统课程。', concept: 'regression-analysis', section: 'sec1' },
  { en: '4. Time series and financial econometrics', zh: '4. 时间序列与金融计量',
    detailEn: 'Stationarity, ARMA/ARIMA, GARCH, state-space models, cointegration and chronological evaluation.', detailZh: '平稳性、ARMA/ARIMA、GARCH、状态空间、协整与按时间评估。',
    statusEn: 'MS-C2128 material is already in the local collection but is not yet integrated as a graph course. The evaluation reading covers GARCH and backtest diagnostics.', statusZh: '本地已有 MS-C2128 材料，尚未作为课程进入星图；评估材料补充 GARCH 与回测诊断。', concept: 'autoregressive-model', section: 'sec12' },
  { en: '5. Convex and stochastic optimization', zh: '5. 凸优化与随机优化',
    detailEn: 'Duality, constrained optimization, mean-variance portfolios, estimation error and robustness.', detailZh: '对偶、约束优化、均值方差组合、估计误差与稳健性。',
    statusEn: 'OPT/CVX materials are present. Portfolio applications and their estimation assumptions need additional study.', statusZh: '已有 OPT/CVX 材料；需补充组合应用及估计假设。', concept: 'convex-optimization-problem' },
  { en: '6. Multivariate, Bayesian and high-dimensional statistics', zh: '6. 多元、贝叶斯与高维统计',
    detailEn: 'Covariance estimation, shrinkage, latent factors, dependence and joint predictive distributions.', detailZh: '协方差估计、收缩、潜在因子、依赖结构与联合预测分布。',
    statusEn: 'The graph has related foundations. Sections 11.5–11.6 explain why marginal calibration can miss portfolio risk.', statusZh: '图谱已有相关基础；新材料 §11.5–11.6 解释边际校准为何可能遗漏组合风险。', concept: 'covariance', section: 'sec11b' },
  { en: '7. Real analysis and measure-theoretic probability', zh: '7. 实分析与测度概率',
    detailEn: 'Convergence, integration, conditional expectation and the assumptions behind limit arguments.', detailZh: '收敛、积分、条件期望与极限交换所需条件。',
    statusEn: 'Aalto MS-E1600 measure-theoretic probability notes are now integrated. A separate real-analysis course remains a gap.', statusZh: '已接入 Aalto MS-E1600 测度概率讲义；独立的实分析课程仍待补充。', concept: 'modes-of-convergence-of-random-variables' },
  { en: '8. Stochastic calculus and mathematical finance', zh: '8. 随机分析与金融数学',
    detailEn: 'Martingales, Itô calculus, SDEs, changes of measure, pricing and hedging.', detailZh: '鞅、Itô 积分、随机微分方程、测度变换、定价与对冲。',
    statusEn: 'BM/SP supplies foundations. The eight-chapter BS paper course connects P/Q, pricing, hedging and Greeks.', statusZh: 'BM/SP 提供基础；已接入八篇 BS 纸笔课程，连接 P/Q、定价、对冲与 Greeks。', concept: 'ito-integral', lesson: 'QUANT-BS0' },
  { en: '9. Numerical analysis and Monte Carlo', zh: '9. 数值分析与蒙特卡洛',
    detailEn: 'Numerical linear algebra, simulation error, variance reduction, SDE discretization and finite-difference PDEs.', detailZh: '数值线性代数、模拟误差、方差缩减、SDE 离散化与 PDE 有限差分。',
    statusEn: 'BS paper chapters 03-05 cover finite differences, roundoff and complex CDF. A full numerical analysis course remains further study.', statusZh: 'BS 纸笔课程 03-05 已补充有限差分、舍入与复数 CDF；完整数值分析课程仍需系统学习。', concept: 'monte-carlo-integration', lesson: 'QUANT-BS3' },
  { en: '10. Risk, dependence and robust validation', zh: '10. 风险、依赖结构与稳健验证',
    detailEn: 'VaR/ES, tail behavior, density forecasts, multiple testing and the limits of conformal coverage.', detailZh: 'VaR/ES、尾部行为、密度预测、多重检验与保形覆盖的适用条件。',
    statusEn: 'The new reading supplies a bridge. Tail-risk modeling and market microstructure remain further topics.', statusZh: '新材料提供衔接；尾部风险建模和市场微观结构仍需后续专题。', concept: 'quantile', section: 'sec9' },
];

export function QuantRoadmap({ lang }: { lang: 'en' | 'zh' }) {
  const chinese = lang === 'zh';
  return <div class="quant-roadmap">{topics.map((topic) => <section class="quant-roadmap__course" key={topic.en}>
    <h3>{chinese ? topic.zh : topic.en}</h3>
    <p>{chinese ? topic.detailZh : topic.detailEn}</p>
    <p class="quant-roadmap__status">{chinese ? topic.statusZh : topic.statusEn}</p>
    <div class="quant-roadmap__links">
      <a href={graphConceptHref(topic.concept)}>{chinese ? '查看相关基础概念' : 'Explore related foundations'}</a>
      {topic.section && <a href={quantLessonHref('QUANT-2', topic.section)}>{chinese ? '阅读对应推导与实验' : 'Read derivations and experiments'}</a>}
      {topic.lesson && <a href={quantLessonHref(topic.lesson)}>{chinese ? '进入 BS 纸笔课程' : 'Open the BS paper course'}</a>}
    </div>
  </section>)}</div>;
}
