import { pilotGenerators } from './pilot';
import { batch01Generators } from './batch01';
import { batch02Generators } from './batch02';
import { batch03Generators } from './batch03';
import { batch04Generators } from './batch04';
import { batch05Generators } from './batch05';
import { batch06Generators } from './batch06';
import { batch07Generators } from './batch07';
import { batch08Generators } from './batch08';
import { batch09Generators } from './batch09';
import { batch10Generators } from './batch10';
import { batch11Generators } from './batch11';
import { batch12Generators } from './batch12';
import { batch13Generators } from './batch13';
import { batch14Generators } from './batch14';
import type { GeneratorMap } from './support';

/**
 * Eager copy of every generator, for tests, scripts/sync-game-index.ts and nothing else: the page never imports this file
 * (it would put all generators back into the page). Each key is a chunk name, the file name of its module in this folder.
 */
export const mitMultivariableChunkGenerators: Record<string, GeneratorMap> = {
  pilot: pilotGenerators, batch01: batch01Generators, batch02: batch02Generators, batch03: batch03Generators, batch04: batch04Generators,
  batch05: batch05Generators, batch06: batch06Generators, batch07: batch07Generators, batch08: batch08Generators, batch09: batch09Generators,
  batch10: batch10Generators, batch11: batch11Generators, batch12: batch12Generators, batch13: batch13Generators, batch14: batch14Generators,
};
export const mitMultivariableGenerators: GeneratorMap = Object.assign({}, ...Object.values(mitMultivariableChunkGenerators));
