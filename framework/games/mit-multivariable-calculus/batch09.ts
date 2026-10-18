import type { GeneratorMap } from './support';
import { mv41 } from './games/mv41';
import { mv42 } from './games/mv42';
import { mv43 } from './games/mv43';
import { mv44 } from './games/mv44';
import { mv45 } from './games/mv45';

/**
 * Batch 09: MIT-MV-41 to MIT-MV-45. Drafted by a local model, reviewed against the sources by three independent reviewers
 * (docs/mit-mv-drafts/batch09-review.md) and implemented from docs/mit-mv-drafts/batch09-approved.md.
 * NOT yet registered in registry.ts: it is registered only after an independent oracle test passes.
 */
export const batch09Generators: GeneratorMap = {
  'MIT-MV-41': mv41,
  'MIT-MV-42': mv42,
  'MIT-MV-43': mv43,
  'MIT-MV-44': mv44,
  'MIT-MV-45': mv45,
};
