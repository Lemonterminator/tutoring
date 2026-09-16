import { checkLesson } from './lesson-shape';
import { findLessons } from './lessons';

let failed = false;
for (const dir of findLessons()) {
  const issues = await checkLesson(dir);
  if (issues.length === 0) {
    console.log(`✔ ${dir}: EN and FI match`);
  } else {
    failed = true;
    console.error(`✘ ${dir}\n  - ${issues.join('\n  - ')}`);
  }
}
process.exit(failed ? 1 : 0);
