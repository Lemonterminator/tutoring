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

test('the English lesson has five sections, two figures and eight quizzes', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article h2')).toHaveLength(5);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(2);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(8);
  expect(container.querySelectorAll('article math').length).toBeGreaterThan(20);
});

test('it labels syllabus material, university material and exam technique', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article .box--syllabus').length).toBeGreaterThanOrEqual(2);
  expect(container.querySelectorAll('article .box--beyond').length).toBeGreaterThanOrEqual(2);
  expect(container.querySelectorAll('article .box--exam').length).toBeGreaterThanOrEqual(2);
});

test('every Term resolves and the glossary lists them all', () => {
  const { container } = renderLesson();
  expect(container.querySelector('.term--missing')).toBeNull();
  expect(container.querySelector('[data-term="node"] .term__alt')?.textContent).toBe(' (solmu)');
  // The Finnish body is still the task 8 placeholder, so nothing here may depend on it.
  // The glossary is built from terms.json and renders in either language; task 13 adds the
  // assertions that need real Finnish prose.
  act(() => setLang('fi'));
  expect(container.querySelectorAll('.glossary__row')).toHaveLength(13);
});

test('the Finnish body is really Finnish and keeps the same structure', () => {
  const { container } = renderLesson();
  const english = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  act(() => setLang('fi'));
  const finnish = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  expect(finnish).toHaveLength(english.length);
  expect(finnish[0]).not.toBe(english[0]);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(2);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(8);
  expect(container.querySelector('[data-term="node"] .term__alt')?.textContent).toBe(' (node)');
});
