import manifest from './manifest.json';
import { batch01Generators } from './batch01';
import { batch02Generators } from './batch02';
import { batch03Generators } from './batch03';
import { batch04Generators } from './batch04';
import { batch05Generators } from './batch05';
import { batch06Generators } from './batch06';
import { batch07Generators } from './batch07';
import type { GeneratorMap } from './support';

export const mitLinearAlgebraGames = manifest.games;
export const mitLinearAlgebraGenerators: GeneratorMap = {
  ...batch01Generators, ...batch02Generators, ...batch03Generators, ...batch04Generators,
  ...batch05Generators, ...batch06Generators, ...batch07Generators,
};
export type MitLinearAlgebraGame = typeof mitLinearAlgebraGames[number];
