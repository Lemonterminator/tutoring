import { gp08 } from './games/gp08';
import { gp09 } from './games/gp09';
import { gp10 } from './games/gp10';
import { gp11 } from './games/gp11';
import { gp12 } from './games/gp12';
import { gp13 } from './games/gp13';
import { gp14 } from './games/gp14';
import type { GeneratorMap } from './support';

/** Accepted generators, grouped for on-demand loading within the chunk budget. */
export const batch02Generators: GeneratorMap = { 'GP-08': gp08, 'GP-09': gp09, 'GP-10': gp10, 'GP-11': gp11, 'GP-12': gp12, 'GP-13': gp13, 'GP-14': gp14 };
