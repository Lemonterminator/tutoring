import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findLessons, outputName } from './lessons';

test('finds lesson directories that contain index.html and skips shared component folders', () => {
  const root = join(mkdtempSync(join(tmpdir(), 'lessons-')), 'subjects');
  for (const dir of ['math/00-a', 'math/_components', 'physics/01-b']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'math/00-a/index.html'), '');
  writeFileSync(join(root, 'math/_components/X.tsx'), '');
  writeFileSync(join(root, 'physics/01-b/index.html'), '');

  expect(findLessons(root).map((p) => p.split('/subjects/')[1])).toEqual(['math/00-a', 'physics/01-b']);
});

test('output file name is subject-slug.html', () => {
  expect(outputName('subjects/math/00-wave-math-foundations')).toBe('math-00-wave-math-foundations.html');
});
