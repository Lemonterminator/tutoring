import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { courseLang, setCourseLang } from '../i18n/course-state';
import { CourseIndex } from './CourseIndex';
import { lessonCatalog } from './lesson-catalog';

afterEach(() => {
  cleanup();
  setCourseLang('en');
});

test('groups the reusable catalog and exposes all lesson links', () => {
  render(<CourseIndex />);

  expect(screen.getByRole('heading', { name: 'LLM architecture' })).toBeTruthy();
  expect(screen.getByText('M3.1')).toBeTruthy();
  // The index shows one card per lesson, except that the quant subject collapses to its QUANT-1
  // roadmap card (CourseIndex.tsx `displayedEntries`), plus one card linking to the game library.
  const lessonEntries = lessonCatalog.filter((entry) => entry.kind !== 'game' && entry.kind !== 'game-index');
  const visibleLessons = lessonEntries.filter((entry) => entry.subject !== 'quant' || entry.id === 'QUANT-1');
  const gameLibraryCards = lessonCatalog.some((entry) => entry.kind === 'game-index') ? 1 : 0;
  expect(document.querySelectorAll('.course-index__card')).toHaveLength(visibleLessons.length + gameLibraryCards);
  expect(screen.getByText('M3.1').closest('a')?.getAttribute('href')).toBe('/subjects/llm/M3.1-attention/index.html');
});

test('uses the Chinese title when the shared course language is Chinese', () => {
  courseLang.value = 'zh';
  render(<CourseIndex />);

  expect(screen.getByText('缩放点积与多头注意力')).toBeTruthy();
  expect(screen.getByRole('button', { name: '中文' }).getAttribute('aria-pressed')).toBe('true');
});
