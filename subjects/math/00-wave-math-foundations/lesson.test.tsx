import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setExamMode, setLang } from '../../../framework/i18n/state';
import { Lesson } from '../../../framework/layout/Lesson';
import type { LessonMeta } from '../../../framework/layout/LessonContext';
import En from './lesson.en.mdx';
import Fi from './lesson.fi.mdx';
import meta from './meta.json';
import terms from './terms.json';

const renderLesson = () => render(<Lesson meta={meta as LessonMeta} En={En} Fi={Fi} terms={terms} />);

afterEach(() => {
  cleanup();
  setLang('en');
  setExamMode(false);
});

test('the English lesson has six sections, four figures and five quizzes', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article h2')).toHaveLength(6);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(4);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(5);
  expect(container.querySelectorAll('article .box--beyond').length).toBeGreaterThanOrEqual(5);
  expect(container.querySelectorAll('article math').length).toBeGreaterThan(20);
});

test('every Term in the lesson resolves and shows the other language', () => {
  const { container } = renderLesson();
  expect(container.querySelector('.term--missing')).toBeNull();
  expect(container.querySelector('[data-term="imaginary-unit"] .term__alt')?.textContent).toBe(' (imaginaariyksikkö)');
  act(() => setLang('fi'));
  expect(container.querySelector('[data-term="imaginary-unit"] .term__alt')?.textContent).toBe(' (imaginary unit)');
});

test('the Finnish body is really Finnish and keeps the same structure', () => {
  const { container } = renderLesson();
  const englishHeadings = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  act(() => setLang('fi'));
  const finnishHeadings = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  expect(finnishHeadings).toHaveLength(englishHeadings.length);
  expect(finnishHeadings[1]).not.toBe(englishHeadings[1]);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(4);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(5);
});

