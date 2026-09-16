import { expect, test } from 'vitest';
import { buildQuestion } from './question';

const base = { lessonId: 'math-00', lessonTitle: 'Module 0', where: 'figure "euler"', lang: 'fi' as const };

test('builds a paste-ready question with rounded settings', () => {
  expect(buildQuestion({ ...base, state: { omega: 1.23456, playing: true } })).toBe(
    'Lesson: Module 0 [math-00]\nWhere: figure "euler"\nLanguage: FI\nSettings: omega=1.23, playing=true\n\nMy question: ',
  );
});

test('omits the settings line when nothing was reported', () => {
  expect(buildQuestion({ ...base, state: {} })).not.toContain('Settings');
});
