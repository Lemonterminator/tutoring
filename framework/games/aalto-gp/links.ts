import { quantLessonHref } from '../../quant/learning-resources';

export function aaltoGpGameHref(id?: string) {
  const base = quantLessonHref('GAME-AALTO-GP');
  return id ? `${base}?game=${encodeURIComponent(id)}#aalto-gp-play` : base;
}
