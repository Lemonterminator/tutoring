import type { CardGenerator } from './types';

export type ChunkGenerators = Record<string, CardGenerator>;
/** Chunk name -> file path relative to the page, e.g. `{ pilot: 'games/mit-mv/pilot.1a2b3c4d.js' }`. */
export type ChunkFiles = Record<string, string>;
/** Dev/test fallback: chunk name -> dynamic import of the TypeScript module that exports its generators. */
export type ChunkModules = Record<string, () => Promise<ChunkGenerators>>;
export type ChunkLoader = {
  /** Loads a chunk once; a failed load is forgotten so that a retry loads it again. */
  load(chunk: string): Promise<ChunkGenerators>;
  /** The chunk's generators when it has already loaded, otherwise undefined. */
  peek(chunk: string): ChunkGenerators | undefined;
};

declare global {
  // eslint-disable-next-line no-var
  var __tutoringGameChunks: Record<string, ChunkGenerators> | undefined;
}

/**
 * Reads the build-time chunk table: a JSON string `{ "<course>/<chunk>": "<file>" }` (nothing in dev and tests),
 * and returns this course's part keyed by chunk name.
 */
export function parseChunkFiles(raw: unknown, course: string): ChunkFiles | null {
  if (typeof raw !== 'string' || !raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const files: ChunkFiles = {};
  for (const [key, file] of Object.entries(parsed)) if (key.startsWith(`${course}/`) && typeof file === 'string') files[key.slice(course.length + 1)] = file;
  return files;
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error(`Could not load ${url}`)); };
    script.src = url;
    document.head.append(script);
  });
}

/**
 * One loader per course. Production pages pass `files` (classic-script chunks that register themselves in
 * `globalThis.__tutoringGameChunks['<course>/<chunk>']`, which works from file://). The dev server and vitest pass `modules`.
 */
export function createChunkLoader(course: string, files: ChunkFiles | null, modules: ChunkModules | null): ChunkLoader {
  const done = new Map<string, ChunkGenerators>();
  const pending = new Map<string, Promise<ChunkGenerators>>();
  const fetchChunk = async (chunk: string): Promise<ChunkGenerators> => {
    if (files) {
      const file = files[chunk];
      if (!file) throw new Error(`Unknown chunk ${course}/${chunk}`);
      await loadScript(file);
      const generators = globalThis.__tutoringGameChunks?.[`${course}/${chunk}`];
      if (!generators) throw new Error(`${file} did not register ${course}/${chunk}`);
      return generators;
    }
    const load = modules?.[chunk];
    if (!load) throw new Error(`Unknown chunk ${course}/${chunk}`);
    return load();
  };
  return {
    peek: chunk => done.get(chunk),
    load(chunk) {
      const known = done.get(chunk);
      if (known) return Promise.resolve(known);
      let promise = pending.get(chunk);
      if (!promise) {
        promise = fetchChunk(chunk).then(generators => { done.set(chunk, generators); pending.delete(chunk); return generators; },
          error => { pending.delete(chunk); throw error; });
        pending.set(chunk, promise);
      }
      return promise;
    },
  };
}
