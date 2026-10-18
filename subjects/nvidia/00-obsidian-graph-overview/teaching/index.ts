import { hpcLessons } from './hpc';
import { architectureLessons } from './architecture';
import { aiLessons } from './ai';
import { systemsLessons } from './systems';
import { infrastructureLessons } from './infrastructure';
import { coreStudySequence, directionIds, type TeachingLesson } from './types';

export { coreStudySequence, directionIds } from './types';

export const teachingLessons: Record<string, TeachingLesson> = {};
for (const group of [hpcLessons, architectureLessons, aiLessons, systemsLessons, infrastructureLessons]) {
  for (const [id, lesson] of Object.entries(group)) {
    if (teachingLessons[id]) throw new Error(`Duplicate teaching node: ${id}`);
    teachingLessons[id] = lesson;
  }
}
// An omitted core lesson must never silently become a summary-as-answer.
for (const id of [...coreStudySequence, ...directionIds]) {
  if (!teachingLessons[id]?.checks.length) throw new Error(`Missing teaching/checks: ${id}`);
}
