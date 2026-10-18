import type { GeneratorMap } from './support';
import { mv51 } from './games/mv51';
import { mv52 } from './games/mv52';
import { mv53 } from './games/mv53';
import { mv54 } from './games/mv54';
import { mv55 } from './games/mv55';

/**
 * Batch 11: MIT-MV-51 to MIT-MV-55. Drafted by a local model, reviewed against the sources by independent reviewers
 * (docs/mit-mv-drafts/review-51-53.md, review-54-57.md) and implemented from the approved plans in docs/mit-mv-drafts/.
 * NOT yet registered in registry.ts: it is registered only after an independent oracle test passes.
 */
export const batch11Generators: GeneratorMap = {
  'MIT-MV-51': mv51,
  'MIT-MV-52': mv52,
  'MIT-MV-53': mv53,
  'MIT-MV-54': mv54,
  'MIT-MV-55': mv55,
};
