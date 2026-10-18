import type { GeneratorMap } from './support';
import { mv65 } from './games/mv65';
import { mv66 } from './games/mv66';
import { mv67 } from './games/mv67';
import { mv68 } from './games/mv68';
import { mv69 } from './games/mv69';

/**
 * Batch 14: MIT-MV-65 to MIT-MV-69 (final reviews of units 1â€“4 and the final exam). Reviewed against the sources
 * (docs/mit-mv-drafts/review-65-67.md, review-68-69.md; 67's plan by a Muse Spark subagent) and implemented by DeepSeek
 * code agents from the approved plans in docs/mit-mv-drafts/.
 * Registered after the independent oracles (oracle-65-67.test.ts, oracle-68-69.test.ts) and acceptance records passed.
 */
export const batch14Generators: GeneratorMap = {
  'MIT-MV-65': mv65,
  'MIT-MV-66': mv66,
  'MIT-MV-67': mv67,
  'MIT-MV-68': mv68,
  'MIT-MV-69': mv69,
};
