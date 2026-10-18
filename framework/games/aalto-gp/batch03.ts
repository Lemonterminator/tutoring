import { gp15 } from './games/gp15';
import { gp16 } from './games/gp16';
import { gp17 } from './games/gp17';
import { gp18 } from './games/gp18';
import { gp19 } from './games/gp19';
import { gp20 } from './games/gp20';
import { gp21 } from './games/gp21';
import type { GeneratorMap } from './support';

/** Accepted generators, grouped for on-demand loading within the chunk budget. */
export const batch03Generators: GeneratorMap = { 'GP-15': gp15, 'GP-16': gp16, 'GP-17': gp17, 'GP-18': gp18, 'GP-19': gp19, 'GP-20': gp20, 'GP-21': gp21 };
