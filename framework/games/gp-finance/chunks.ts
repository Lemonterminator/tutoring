import { createChunkLoader, parseChunkFiles, type ChunkModules } from '../chunk-loader';

/**
 * Dev server and vitest only. In a production page build, scripts/build-all.ts sets VITE_GAME_CHUNKS, the ternary below is
 * a constant, and this function (with every import() in it, hence every generator) is removed from the page.
 */
const developmentModules = (): ChunkModules => ({
  pilot: () => import('./pilot').then(m => m.pilotGenerators),
});

export const gpFinanceChunkLoader = createChunkLoader(
  'gp-finance',
  parseChunkFiles(import.meta.env.VITE_GAME_CHUNKS, 'gp-finance'),
  import.meta.env.VITE_GAME_CHUNKS ? null : developmentModules(),
);
