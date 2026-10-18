import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setCourseLang } from '../i18n/course-state';
import { setLang } from '../i18n/state';
import { setTheme } from '../theme/theme-state';
import { CourseIndex } from './CourseIndex';
import { CourseLesson } from './CourseLesson';
import { Lesson } from './Lesson';

const Body = () => <h2 id="a">Section</h2>;
const courseMeta = { id: 'TEST-1', subject: 'quant', title: { en: 'Course lesson', zh: '课程' } };
const lessonMeta = { id: 'math-test', subject: 'math' as const, title: { en: 'Test lesson', fi: 'Testitunti' } };

afterEach(() => {
  cleanup();
  setTheme('auto');
  setCourseLang('en');
  setLang('en');
});

function topbarToggle(container: Element) {
  return within(container.querySelector('.topbar__controls') as HTMLElement);
}

test('CourseIndex top bar has the theme switch and it sets data-theme', () => {
  const { container } = render(<CourseIndex />);
  fireEvent.click(topbarToggle(container).getByRole('button', { name: 'Dark' }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

test('CourseIndex theme labels switch to Chinese with the course language', () => {
  const { container } = render(<CourseIndex />);
  act(() => setCourseLang('zh'));
  expect(topbarToggle(container).getByRole('group', { name: '主题' })).toBeTruthy();
  expect(topbarToggle(container).getByRole('button', { name: '浅色' })).toBeTruthy();
});

test('CourseLesson top bar has the theme switch', () => {
  const { container } = render(<CourseLesson meta={courseMeta} En={Body} Zh={Body} />);
  expect(topbarToggle(container).getByRole('group', { name: 'Theme' })).toBeTruthy();
  fireEvent.click(topbarToggle(container).getByRole('button', { name: 'Light' }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  act(() => setCourseLang('zh'));
  expect(topbarToggle(container).getByRole('button', { name: '深色' })).toBeTruthy();
});

test('Lesson top bar has the theme switch with Finnish labels in Finnish', () => {
  const { container } = render(<Lesson meta={lessonMeta} En={Body} Fi={Body} terms={{}} />);
  expect(topbarToggle(container).getByRole('group', { name: 'Theme' })).toBeTruthy();
  act(() => setLang('fi'));
  expect(topbarToggle(container).getByRole('group', { name: 'Teema' })).toBeTruthy();
  fireEvent.click(topbarToggle(container).getByRole('button', { name: 'Tumma' }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(screen.getAllByRole('button', { pressed: true }).some((b) => b.textContent === 'Tumma')).toBe(true);
});
