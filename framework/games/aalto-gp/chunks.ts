import { createChunkLoader, parseChunkFiles, type ChunkModules } from '../chunk-loader';

/**
 * Dev server and vitest only. In a production page build, scripts/build-all.ts sets VITE_GAME_CHUNKS, the ternary below is
 * a constant, and this function (with every import() in it, hence every generator) is removed from the page.
 */
const developmentModules = (): ChunkModules => ({
  pilot: () => import('./pilot').then(m => m.pilotGenerators),
  batch02: () => import('./batch02').then(m => m.batch02Generators),
  batch03: () => import('./batch03').then(m => m.batch03Generators),
  batch04: () => import('./batch04').then(m => m.batch04Generators),
  batch05: () => import('./batch05').then(m => m.batch05Generators),
});

export const aaltoGpChunkLoader = createChunkLoader(
  'aalto-gp',
  parseChunkFiles(import.meta.env.VITE_GAME_CHUNKS, 'aalto-gp'),
  import.meta.env.VITE_GAME_CHUNKS ? null : developmentModules(),
);
