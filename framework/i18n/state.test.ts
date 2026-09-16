import { afterEach, expect, test } from 'vitest';
import { displayLang, examMode, lang, setExamMode, setLang } from './state';

afterEach(() => {
  setLang('en');
  setExamMode(false);
});

test('exam mode forces Finnish without forgetting the chosen language', () => {
  setLang('en');
  setExamMode(true);
  expect(displayLang.value).toBe('fi');
  expect(lang.value).toBe('en');
  setExamMode(false);
  expect(displayLang.value).toBe('en');
  expect(examMode.value).toBe(false);
});

test('setLang remembers the choice when storage works', () => {
  setLang('fi');
  expect(localStorage.getItem('tutoring.lang')).toBe('fi');
});
