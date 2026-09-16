import type { Lang } from './state';

export type TermEntry = { en: string; fi: string };
export type TermDict = Record<string, TermEntry>;
export type TermView = { secondary: string | null; hover: string | null };

/** The surface text is always the author's inflected form; this decides what is added around it. */
export function termView(entry: TermEntry, lang: Lang, exam: boolean): TermView {
  if (exam) return { secondary: null, hover: entry.en };
  return { secondary: lang === 'en' ? entry.fi : entry.en, hover: null };
}
