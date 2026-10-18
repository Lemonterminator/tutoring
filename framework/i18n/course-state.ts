import { signal } from '@preact/signals';

export type CourseLang = 'en' | 'zh';

const STORAGE_KEY = 'tutoring.llm-course.lang';

function readStoredLang(): CourseLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

export const courseLang = signal<CourseLang>(readStoredLang());

export function setCourseLang(next: CourseLang): void {
  courseLang.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable for file:// pages or private windows.
  }
}
