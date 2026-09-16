import type { Lang } from '../i18n/state';

export type AskContext = {
  lessonId: string;
  lessonTitle: string;
  where: string;
  lang: Lang;
  state?: Record<string, unknown>;
};

export function formatValue(value: unknown): string {
  return typeof value === 'number' ? String(Number(value.toPrecision(3))) : String(value);
}

/** Text the student pastes into the tutor chat; the tutor sees exactly what the student was looking at. */
export function buildQuestion(ctx: AskContext): string {
  const lines = [`Lesson: ${ctx.lessonTitle} [${ctx.lessonId}]`, `Where: ${ctx.where}`, `Language: ${ctx.lang.toUpperCase()}`];
  const settings = Object.entries(ctx.state ?? {});
  if (settings.length > 0) lines.push(`Settings: ${settings.map(([k, v]) => `${k}=${formatValue(v)}`).join(', ')}`);
  lines.push('', 'My question: ');
  return lines.join('\n');
}
