import { createChunkLoader, parseChunkFiles, type ChunkModules } from '../chunk-loader';

/**
 * Dev server and vitest only. In a production page build, scripts/build-all.ts sets VITE_GAME_CHUNKS, the ternary below is
 * a constant, and this function (with every import() in it, hence every generator) is removed from the page.
 */
const developmentModules = (): ChunkModules => ({
  pilot: () => import('./pilot').then(m => m.pilotGenerators),
  batch01: () => import('./batch01').then(m => m.batch01Generators),
  batch02: () => import('./batch02').then(m => m.batch02Generators),
  batch03: () => import('./batch03').then(m => m.batch03Generators),
  batch04: () => import('./batch04').then(m => m.batch04Generators),
  batch05: () => import('./batch05').then(m => m.batch05Generators),
  batch06: () => import('./batch06').then(m => m.batch06Generators),
  batch07: () => import('./batch07').then(m => m.batch07Generators),
  batch08: () => import('./batch08').then(m => m.batch08Generators),
  batch09: () => import('./batch09').then(m => m.batch09Generators),
  batch10: () => import('./batch10').then(m => m.batch10Generators),
  batch11: () => import('./batch11').then(m => m.batch11Generators),
  batch12: () => import('./batch12').then(m => m.batch12Generators),
  batch13: () => import('./batch13').then(m => m.batch13Generators),
  batch14: () => import('./batch14').then(m => m.batch14Generators),
});

export const mitMultivariableChunkLoader = createChunkLoader(
  'mit-mv',
  parseChunkFiles(import.meta.env.VITE_GAME_CHUNKS, 'mit-mv'),
  import.meta.env.VITE_GAME_CHUNKS ? null : developmentModules(),
);
