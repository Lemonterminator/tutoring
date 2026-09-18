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

test('the English lesson has five sections, three figures and seven quizzes', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article h2')).toHaveLength(5);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(3);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(7);
  expect(container.querySelectorAll('article math').length).toBeGreaterThan(15);
});

test('it labels syllabus material, university material and exam technique', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article .box--syllabus').length).toBeGreaterThanOrEqual(4);
  expect(container.querySelectorAll('article .box--beyond').length).toBeGreaterThanOrEqual(2);
  expect(container.querySelectorAll('article .box--exam').length).toBeGreaterThanOrEqual(2);
});

test('every Term resolves and the glossary lists them all', () => {
  const { container } = renderLesson();
  expect(container.querySelector('.term--missing')).toBeNull();
  expect(container.querySelector('[data-term="wavelength"] .term__alt')?.textContent).toBe(' (aallonpituus)');
  act(() => setLang('fi'));
  expect(container.querySelectorAll('.glossary__row')).toHaveLength(14);
});
