import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build, type Plugin } from 'vite';

/** A course whose games load on demand (see docs/game-chunks-plan.md). */
export type ChunkCourse = {
  /** Registry key and folder name: dist/games/<course>/. */
  course: string;
  /** Folder with one module per chunk, `<chunk>.ts` exporting `<chunk>Generators`, and game-index.json. */
  dir: string;
};
export const CHUNK_COURSES: ChunkCourse[] = [
  { course: 'mit-mv', dir: 'framework/games/mit-multivariable-calculus' },
  { course: 'aalto-gp', dir: 'framework/games/aalto-gp' },
  { course: 'gp-finance', dir: 'framework/games/gp-finance' },
];
export const MAX_CHUNK_BYTES = 300 * 1024;

/** Chunk names in use: the distinct `chunk` values of the course's game-index.json. */
export function chunkNames({ dir }: ChunkCourse): string[] {
  const index = JSON.parse(readFileSync(join(dir, 'game-index.json'), 'utf8')) as Record<string, { chunk: string }>;
  return [...new Set(Object.values(index).map(entry => entry.chunk))].sort();
}

const ENTRY = '\0game-chunk-entry';

/** Bundles one chunk as a classic IIFE script that registers its GeneratorMap in globalThis.__tutoringGameChunks. */
async function bundleChunk(course: ChunkCourse, name: string): Promise<string> {
  const module = resolve(course.dir, name).replaceAll('\\', '/');
  const entry: Plugin = {
    name: 'game-chunk-entry',
    resolveId: id => id === ENTRY ? id : null,
    load: id => id === ENTRY
      ? `import { ${name}Generators } from ${JSON.stringify(module)};\n(globalThis.__tutoringGameChunks ??= {})[${JSON.stringify(`${course.course}/${name}`)}] = ${name}Generators;\n`
      : null,
  };
  const result = await build({
    configFile: false, logLevel: 'warn', plugins: [entry],
    build: { write: false, minify: true, rollupOptions: { input: ENTRY, output: { format: 'iife' } } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => 'output' in r ? r.output : []);
  const files = outputs.filter(o => o.type === 'chunk');
  if (files.length !== 1) throw new Error(`${course.course}/${name}: expected one output chunk, got ${files.length}`);
  return files[0].code;
}

/**
 * Builds every chunk of every course into dist/games/<course>/<chunk>.<hash8>.js.
 * Returns the table for the page builds: { "<course>/<chunk>": "games/<course>/<file>" } (paths relative to the page).
 */
export async function buildGameChunks(distDir = 'dist'): Promise<{ table: Record<string, string>; sizes: Record<string, number> }> {
  const table: Record<string, string> = {};
  const sizes: Record<string, number> = {};
  for (const course of CHUNK_COURSES) {
    const outDir = join(distDir, 'games', course.course);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const name of chunkNames(course)) {
      const code = await bundleChunk(course, name);
      const hash = createHash('sha256').update(code).digest('hex').slice(0, 8);
      const file = `${name}.${hash}.js`;
      writeFileSync(join(outDir, file), code);
      table[`${course.course}/${name}`] = `games/${course.course}/${file}`;
      sizes[`${course.course}/${file}`] = Buffer.byteLength(code);
    }
  }
  return { table, sizes };
}
