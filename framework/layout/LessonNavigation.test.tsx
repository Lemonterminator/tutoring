import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { LessonIndex, LessonPager, resolveLessonHref, type LessonNavigationLabels } from './LessonNavigation';

const labels: LessonNavigationLabels = {
  index: 'Lesson index',
  id: 'ID',
  module: 'Module',
  prerequisites: 'Prerequisites',
  estimatedHours: 'Estimated time',
  spine: 'Learning spine',
  derivations: 'Derivations',
  visualizations: 'Visualizations',
  assignment: 'Assignment',
  references: 'References',
  contents: 'Contents',
  previous: 'Previous lesson',
  next: 'Next lesson',
  openIndex: 'All lessons',
};

afterEach(cleanup);

test('renders structured lesson metadata instead of raw frontmatter', () => {
  render(
    <nav class="toc">
      <LessonIndex
        labels={labels}
        meta={{
          id: 'M3.1',
          module: 'M3',
          prereqs: ['M2.2'],
          estimatedHours: 8,
          derivations: ['D-M3.1-01'],
          visualizations: ['V-M3-a'],
          assignment: 'A-M3',
          references: ['vaswani2017'],
          spine: { a: 'Attention is a normalized map.', b: 'Derive every backward matrix.' },
        }}
        toc={[{ id: 'sec-1', text: 'Scaled dot-product attention' }]}
      />
    </nav>,
  );

  expect(screen.getByText('M3.1')).toBeTruthy();
  expect(screen.getByText('D-M3.1-01')).toBeTruthy();
  expect(screen.getByText('Scaled dot-product attention').getAttribute('href')).toBe('#sec-1');
  expect(screen.queryByText(/title:/i)).toBeNull();
});

test('renders reusable previous, index, and next links', () => {
  render(
    <LessonPager
      labels={labels}
      titleLanguage="zh"
      navigation={{
        previous: { id: 'M2.2', title: { en: 'Seq2seq', zh: '序列到序列' }, devHref: '/prev', buildHref: '/prev.html' },
        next: { id: 'M3.2', title: { en: 'Positional encoding', zh: '位置编码' }, devHref: '/next', buildHref: '/next.html' },
        indexHref: { dev: '/', build: '/index.html' },
      }}
    />,
  );

  expect(screen.getByRole('link', { name: /序列到序列/ }).getAttribute('href')).toBe('/prev');
  expect(screen.getByRole('link', { name: 'All lessons' }).getAttribute('href')).toBe('/');
  expect(screen.getByRole('link', { name: /位置编码/ }).getAttribute('href')).toBe('/next');
});

test('resolveLessonHref uses devHref in development and normalizes to relative ./... in production', () => {
  expect(resolveLessonHref({ devHref: '/dev/lesson', buildHref: '/lesson.html' })).toBe('/dev/lesson');

  const originalDev = import.meta.env.DEV;
  try {
    (import.meta.env as { DEV: boolean }).DEV = false;
    expect(resolveLessonHref({ devHref: '/dev/lesson', buildHref: '/lesson.html' })).toBe('./lesson.html');
    expect(resolveLessonHref({ devHref: '/dev/lesson', buildHref: './lesson.html' })).toBe('./lesson.html');
    expect(resolveLessonHref({ devHref: '/dev/lesson', buildHref: 'lesson.html' })).toBe('./lesson.html');
    expect(resolveLessonHref({ devHref: '/', buildHref: '/index.html' })).toBe('./index.html');
  } finally {
    (import.meta.env as { DEV: boolean }).DEV = originalDev;
  }
});
