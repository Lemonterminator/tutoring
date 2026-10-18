import type { GeneratorMap } from './support';
import { mv61 } from './games/mv61';
import { mv62 } from './games/mv62';
import { mv63 } from './games/mv63';
import { mv64 } from './games/mv64';

/**
 * Batch 13: MIT-MV-61 to MIT-MV-64. Drafted by a local model, reviewed against the sources by an independent reviewer
 * (docs/mit-mv-drafts/review-61-64.md) and implemented from the approved plan docs/mit-mv-drafts/approved-61-64.md.
 * Registered after the independent oracle (oracle-61-64.test.ts) and the acceptance record (acceptance-61-64.md) passed.
 */
export const batch13Generators: GeneratorMap = {
  'MIT-MV-61': mv61,
  'MIT-MV-62': mv62,
  'MIT-MV-63': mv63,
  'MIT-MV-64': mv64,
};
