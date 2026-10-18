import { gp22 } from './games/gp22';
import { gp23 } from './games/gp23';
import { gp24 } from './games/gp24';
import { gp25 } from './games/gp25';
import { gp26 } from './games/gp26';
import { gp27 } from './games/gp27';
import { gp28 } from './games/gp28';
import type { GeneratorMap } from './support';

/** Accepted generators, grouped for on-demand loading within the chunk budget. */
export const batch04Generators: GeneratorMap = { 'GP-22': gp22, 'GP-23': gp23, 'GP-24': gp24, 'GP-25': gp25, 'GP-26': gp26, 'GP-27': gp27, 'GP-28': gp28 };
