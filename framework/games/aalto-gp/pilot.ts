import { gp01 } from './games/gp01';
import { gp02 } from './games/gp02';
import { gp03 } from './games/gp03';
import { gp04 } from './games/gp04';
import { gp05 } from './games/gp05';
import { gp06 } from './games/gp06';
import { gp07 } from './games/gp07';
import type { GeneratorMap } from './support';

/** Accepted generators, grouped for on-demand loading within the chunk budget. */
export const pilotGenerators: GeneratorMap = { 'GP-01': gp01, 'GP-02': gp02, 'GP-03': gp03, 'GP-04': gp04, 'GP-05': gp05, 'GP-06': gp06, 'GP-07': gp07 };
