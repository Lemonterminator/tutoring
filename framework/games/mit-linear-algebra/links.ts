import { quantLessonHref } from '../../quant/learning-resources';

export function mitLinearAlgebraGameHref(id?: string) {
  const base = quantLessonHref('GAME-MIT-LA');
  return id ? `${base}?game=${encodeURIComponent(id)}#mit-la-play` : base;
}
