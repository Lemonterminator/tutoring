export type Localized<T = string> = { en: T; zh: T };
export const t = <T,>(en: T, zh: T): Localized<T> => ({ en, zh });
export type TeachingCheck = {
  question: Localized; answer: Localized; reasoning: Localized<string[]>;
  boundary: Localized; rubric: Localized<string[]>;
};
export type TeachingLesson = {
  minutes: number;
  question: Localized;
  terms: { name: Localized; definition: Localized }[];
  sections: { title: Localized; paragraphs: Localized<string[]>; equation?: string; assumptions?: Localized; checkpoint?: Localized }[];
  workedExample: { title: Localized; assumptions: Localized; steps: Localized<string[]>; result: Localized };
  transfer: { title: Localized; paragraphs: Localized<string[]>; boundary: Localized };
  checks: TeachingCheck[];
  takeaways: Localized<string[]>;
  prerequisites: string[];
  sources: { title: string; url: string; note: Localized }[];
  /** Authoring specification only; no empty visual placeholder is rendered. */
  visualSpec?: Localized;
};
export const coreStudySequence = [
  'decomp', 'scaling', 'memory', 'roofline', 'simt', 'occupancy',
  'gemm', 'case-gemm', 'case-reduction', 'formats', 'attention', 'case-attention',
  'os', 'raii', 'memory-model', 'polymorphism', 'case-memmove',
  'network', 'collectives', 'case-multigpu', 'case-inference',
] as const;
export const directionIds = ['hpc', 'arch', 'cpp', 'ai', 'infra'] as const;
