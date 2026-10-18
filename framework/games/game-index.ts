import type { CardGenerator } from './types';

export type GameIndex = Record<string, { chunk: string; stages: number }>;

/**
 * Chunk and stage count of every game. The number of stages must not depend on the seed or the language
 * (the course list shows it without loading the chunk), so this throws when it does.
 */
export function buildGameIndex(chunks: Record<string, Record<string, CardGenerator>>): GameIndex {
  const index: GameIndex = {};
  for (const [chunk, generators] of Object.entries(chunks)) {
    for (const [id, generate] of Object.entries(generators)) {
      if (id in index) throw new Error(`${id} is defined in chunks ${index[id].chunk} and ${chunk}`);
      const counts = new Set<number>();
      for (const seed of [0, 1, 2, 31, 99, 7919, 123456, 4294967295]) for (const lang of ['en', 'zh'] as const) counts.add(generate(seed, lang).length);
      if (counts.size !== 1) throw new Error(`${id}: the number of stages varies (${[...counts].join(', ')})`);
      index[id] = { chunk, stages: [...counts][0] };
    }
  }
  return Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
}
