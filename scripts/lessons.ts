import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Lesson directories are subjects/<subject>/<slug>/ containing index.html. */
export function findLessons(root = 'subjects'): string[] {
  const found: string[] = [];
  for (const subject of readdirSync(root)) {
    const subjectDir = join(root, subject);
    if (!statSync(subjectDir).isDirectory()) continue;
    for (const slug of readdirSync(subjectDir)) {
      const dir = join(subjectDir, slug);
      if (statSync(dir).isDirectory() && existsSync(join(dir, 'index.html'))) found.push(dir.split('\\').join('/'));
    }
  }
  return found.sort();
}

export function outputName(lessonDir: string): string {
  return `${basename(dirname(lessonDir))}-${basename(lessonDir)}.html`;
}
