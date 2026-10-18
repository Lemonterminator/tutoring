import { pilotGenerators } from './pilot';
import { batch02Generators } from './batch02';
import { batch03Generators } from './batch03';
import { batch04Generators } from './batch04';
import { batch05Generators } from './batch05';
import type { GeneratorMap } from './support';

/**
 * Eager copy of every generator, for tests, scripts/sync-game-index.ts and nothing else: the page never imports this file
 * (it would put all generators back into the page). Each key is a chunk name, the file name of its module in this folder.
 */
export const aaltoGpChunkGenerators: Record<string, GeneratorMap> = { pilot: pilotGenerators, batch02: batch02Generators, batch03: batch03Generators, batch04: batch04Generators, batch05: batch05Generators };
export const aaltoGpGenerators: GeneratorMap = Object.assign({}, ...Object.values(aaltoGpChunkGenerators));
