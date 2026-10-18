import { writeFileSync } from 'node:fs';
import { mitMultivariableChunkGenerators } from '../framework/games/mit-multivariable-calculus/generators';
import { aaltoGpChunkGenerators } from '../framework/games/aalto-gp/generators';
import { gpFinanceChunkGenerators } from '../framework/games/gp-finance/generators';
import { buildGameIndex } from '../framework/games/game-index';

/** Regenerates the game-index.json of every course that loads its games on demand, from the eager generators. */
const courses = [
  ['framework/games/mit-multivariable-calculus', mitMultivariableChunkGenerators],
  ['framework/games/aalto-gp', aaltoGpChunkGenerators],
  ['framework/games/gp-finance', gpFinanceChunkGenerators],
] as const;
for (const [dir, generators] of courses) {
  const target = `${dir}/game-index.json`;
  const index = buildGameIndex(generators);
  writeFileSync(target, JSON.stringify(index, null, 2) + '\n');
  console.log(`✔ ${target} (${Object.keys(index).length} games)`);
}
