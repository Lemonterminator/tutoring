import { quantLessonHref } from '../../quant/learning-resources';

export function gpFinanceGameHref(id?: string) {
  const base = quantLessonHref('GAME-GP-FINANCE');
  return id ? `${base}?game=${encodeURIComponent(id)}#gp-finance-play` : base;
}
