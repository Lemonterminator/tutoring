import type { GeneratorMap } from './support';
import { mv56 } from './games/mv56';
import { mv57 } from './games/mv57';
import { mv58 } from './games/mv58';
import { mv59 } from './games/mv59';
import { mv60 } from './games/mv60';

/**
 * Batch 12: MIT-MV-56 to MIT-MV-60. Drafted by a local model, reviewed against the sources by independent reviewers
 * (docs/mit-mv-drafts/review-54-57.md, review-58-60.md) and implemented from the approved plans in docs/mit-mv-drafts/.
 * NOT yet registered in registry.ts: it is registered only after an independent oracle test passes.
 */
export const batch12Generators: GeneratorMap = {
  'MIT-MV-56': mv56,
  'MIT-MV-57': mv57,
  'MIT-MV-58': mv58,
  'MIT-MV-59': mv59,
  'MIT-MV-60': mv60,
};
