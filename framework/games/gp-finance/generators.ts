import { pilotGenerators } from './pilot';
import type { GeneratorMap } from './support';

/**
 * Eager copy of every generator, for tests, scripts/sync-game-index.ts and nothing else: the page never imports this file
 * (it would put all generators back into the page). Each key is a chunk name, the file name of its module in this folder.
 */
export const gpFinanceChunkGenerators: Record<string, GeneratorMap> = { pilot: pilotGenerators };
export const gpFinanceGenerators: GeneratorMap = Object.assign({}, ...Object.values(gpFinanceChunkGenerators));
