import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkCourseLesson, checkLesson } from './lesson-shape';
import { findLessons } from './lessons';

let failed = false;
for (const dir of findLessons()) {
  const isCourseLesson = existsSync(join(dir, 'lesson.zh.mdx'));
  const issues = isCourseLesson ? await checkCourseLesson(dir) : await checkLesson(dir);
  if (issues.length === 0) {
    console.log(`✔ ${dir}: EN and ${isCourseLesson ? 'ZH' : 'FI'} match`);
  } else {
    failed = true;
    console.error(`✘ ${dir}\n  - ${issues.join('\n  - ')}`);
  }
}
process.exit(failed ? 1 : 0);
