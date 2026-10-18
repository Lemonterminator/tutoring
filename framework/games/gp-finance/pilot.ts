import { gpf1 } from './games/gpf1';
import { gpf2 } from './games/gpf2';
import { gpf3 } from './games/gpf3';
import type { GeneratorMap } from './support';

/** All three finance bridge games, independently accepted from the approved plans. */
export const pilotGenerators: GeneratorMap = { 'GP-F1': gpf1, 'GP-F2': gpf2, 'GP-F3': gpf3 };
