import type { GeneratorMap } from './support';
import { mv46 } from './games/mv46';
import { mv47 } from './games/mv47';
import { mv48 } from './games/mv48';
import { mv49 } from './games/mv49';
import { mv50 } from './games/mv50';

/**
 * Batch 10: MIT-MV-46 to MIT-MV-50. Drafted by a local model, reviewed against the sources by three independent reviewers
 * (docs/mit-mv-drafts/batch10-review.md) and implemented from docs/mit-mv-drafts/batch10-approved.md.
 * NOT yet registered in registry.ts: it is registered only after an independent oracle test passes.
 */
export const batch10Generators: GeneratorMap = {
  'MIT-MV-46': mv46,
  'MIT-MV-47': mv47,
  'MIT-MV-48': mv48,
  'MIT-MV-49': mv49,
  'MIT-MV-50': mv50,
};
