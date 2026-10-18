import { lessonCatalog } from '../layout/lesson-catalog';
import { resolveLessonHref } from '../layout/LessonNavigation';

export type MetricsSection = { id: string; en: string; zh: string; concepts: string[] };
export const metricsSections: MetricsSection[] = [
  { id: 'sec0', en: 'Notation and evaluation population', zh: '记号、评估母体与有效样本数', concepts: ['random-variable', 'central-limit-theorem'] },
  { id: 'sec1', en: 'RMSE, MAE, Bias and P95', zh: 'RMSE、MAE、偏差与 P95', concepts: ['mean-squared-error-loss', 'mean-squared-error-of-an-estimator', 'regression-analysis', 'simple-linear-regression'] },
  { id: 'sec2', en: 'Interval coverage', zh: '预测区间覆盖率', concepts: ['normal-distribution', 'prediction-interval', 'confidence-interval'] },
  { id: 'sec3', en: 'CRPS and proper scoring', zh: 'CRPS 与概率预测评分', concepts: ['cumulative-distribution-function', 'expected-value', 'normal-distribution'] },
  { id: 'sec4', en: 'PIT, reliability and ECE', zh: 'PIT、可靠度图与 ECE', concepts: ['cumulative-distribution-function', 'kolmogorovsmirnov-test'] },
  { id: 'sec5', en: 'Heteroscedastic Gaussian NLL', zh: '异方差高斯 NLL', concepts: ['maximum-likelihood-estimation', 'heteroscedasticity', 'normal-distribution', 'cross-entropy-loss'] },
  { id: 'sec6', en: 'Pooling, censoring and LONO', zh: '池化、删失与 LONO 评估协议', concepts: ['simple-random-sampling', 'selection-bias', 'regression-analysis'] },
  { id: 'sec7', en: 'Constants and summary', zh: '常数速查与指标总结', concepts: [] },
  { id: 'sec7b', en: 'Finance introduction', zh: '收益、波动率与风险导读', concepts: ['variance'] },
  { id: 'sec8', en: 'Sharpe, dependence and multiple testing', zh: 'Sharpe、序列相关与多重检验', concepts: ['central-limit-theorem', 'statistical-hypothesis-test', 'p-value'] },
  { id: 'sec9', en: 'VaR exception backtests', zh: 'VaR 超损回测', concepts: ['binomial-distribution', 'chi-squared-distribution', 'maximum-likelihood-estimation'] },
  { id: 'sec10', en: 'Density forecasts and Berkowitz', zh: '密度预测与 Berkowitz 检验', concepts: ['kolmogorovsmirnov-test', 'maximum-likelihood-estimation'] },
  { id: 'sec11', en: 'Pinball loss, VaR and ES', zh: '分位数损失、VaR 与 ES', concepts: ['quantile'] },
  { id: 'sec11b', en: 'Marginal versus joint calibration', zh: '边际校准与联合校准', concepts: ['covariance', 'correlation', 'joint-distribution'] },
  { id: 'sec11c', en: 'Rosenblatt transform', zh: 'Rosenblatt 多元变换', concepts: ['conditional-probability', 'joint-distribution'] },
  { id: 'sec12', en: 'GARCH, QMLE and QLIKE', zh: 'GARCH、QMLE 与 QLIKE', concepts: ['heteroscedasticity', 'maximum-likelihood-estimation', 'autoregressive-model'] },
  { id: 'sec13', en: 'Conformal prediction and CQR', zh: '保形预测与 CQR', concepts: ['quantile', 'prediction-interval'] },
];

export function quantLessonHref(id: string, section?: string): string {
  const entry = lessonCatalog.find((lesson) => lesson.subject === 'quant' && lesson.id === id);
  if (!entry) return '#';
  return resolveLessonHref(entry) + (section ? `?section=${encodeURIComponent(section)}#reader` : '');
}

export function graphConceptHref(concept: string): string {
  return `${quantLessonHref('QUANT-0')}#concept=${encodeURIComponent(concept)}`;
}

export function metricsReadings(concept: string) {
  return metricsSections.filter((section) => section.concepts.includes(concept));
}
