import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findLessons, outputName } from './lessons';

const MAX_BYTES = 1.5 * 1024 * 1024;

mkdirSync('dist', { recursive: true });
let failed = false;
for (const lesson of findLessons()) {
  execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, LESSON: lesson } });
  const name = outputName(lesson);
  const target = join('dist', name);
  copyFileSync(join('dist/.tmp', name.replace(/\.html$/, ''), 'index.html'), target);
  const bytes = statSync(target).size;
  console.log(`✔ ${target} (${(bytes / 1024).toFixed(0)} KB)`);
  if (bytes > MAX_BYTES) {
    console.error(`✘ ${target} is over the 1.5 MB budget`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
