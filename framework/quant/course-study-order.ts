/** Recommended study route; these ranks do not create prerequisite edges. */
export const COURSE_STUDY_ORDER = [
  'MIT-18.06SC', 'MIT-18.02SC', 'MIT-6.041SC', 'MS-C1620',
  'MIT-18.650', 'MIT-18.065', 'CS-E4895', 'MS-C2105', 'ELEC-E5424',
  'MS-C2111', 'MS-E1600', 'MS-E1604', 'ELEC-E8425', 'ELEC-E8125',
] as const;

export function courseStudyRank(id: string): number {
  const index = COURSE_STUDY_ORDER.findIndex((course) => course === id);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index + 1;
}

export function compareCourseStudyOrder(left: { id: string }, right: { id: string }): number {
  return courseStudyRank(left.id) - courseStudyRank(right.id) || left.id.localeCompare(right.id);
}
