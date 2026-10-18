import type { GeneratorMap } from './support';
import { mv36 } from './games/mv36';
import { mv37 } from './games/mv37';
import { mv38 } from './games/mv38';
import { mv39 } from './games/mv39';
import { mv40 } from './games/mv40';

/**
 * Batch 08: MIT-MV-36 to MIT-MV-40. Drafted by a local model, reviewed against the sources by three independent reviewers
 * (docs/mit-mv-drafts/batch08-review.md) and implemented from docs/mit-mv-drafts/batch08-approved.md.
 * NOT yet registered in registry.ts: it is registered only after an independent oracle test passes.
 */
export const batch08Generators: GeneratorMap = {
  'MIT-MV-36': mv36,
  'MIT-MV-37': mv37,
  'MIT-MV-38': mv38,
  'MIT-MV-39': mv39,
  'MIT-MV-40': mv40,
};
