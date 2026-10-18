import { quantLessonHref } from '../../quant/learning-resources';

export function mitMultivariableGameHref(id?: string) {
  const base = quantLessonHref('GAME-MIT-MV');
  return id ? `${base}?game=${encodeURIComponent(id)}#mit-mv-play` : base;
}
