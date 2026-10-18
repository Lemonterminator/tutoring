import { gp29 } from './games/gp29';
import { gp30 } from './games/gp30';
import { gp31 } from './games/gp31';
import { gps1 } from './games/gps1';
import { gps2 } from './games/gps2';
import type { GeneratorMap } from './support';

/** Accepted generators, grouped for on-demand loading within the chunk budget. */
export const batch05Generators: GeneratorMap = { 'GP-29': gp29, 'GP-30': gp30, 'GP-31': gp31, 'GP-S1': gps1, 'GP-S2': gps2 };
