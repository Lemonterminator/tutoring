import { computed, signal } from '@preact/signals';

export type Lang = 'en' | 'fi';

const STORAGE_KEY = 'tutoring.lang';

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'fi' ? 'fi' : 'en';
  } catch {
    return 'en';
  }
}

export const lang = signal<Lang>(readStoredLang());
export const examMode = signal(false);
/** The language actually shown: exam mode is always Finnish. */
export const displayLang = computed<Lang>(() => (examMode.value ? 'fi' : lang.value));

export function setLang(next: Lang): void {
  lang.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable for file:// pages or private windows; the choice just isn't remembered.
  }
}

export function setExamMode(on: boolean): void {
  examMode.value = on;
}
