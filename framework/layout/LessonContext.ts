import { createContext } from 'preact';
import type { TermDict } from '../i18n/terms';
import type { Bi } from '../i18n/ui';

export type LessonMeta = { id: string; subject: 'math' | 'physics' | 'chemistry'; title: Bi };

export const LessonContext = createContext<{ meta: LessonMeta; terms: TermDict }>({
  meta: { id: 'unknown', subject: 'math', title: { en: '', fi: '' } },
  terms: {},
});

/** True inside the hidden English copy used for exam-mode hover; figures render as empty placeholders there. */
export const InertContext = createContext(false);
