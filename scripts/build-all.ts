import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findLessons, outputName } from './lessons';
import { buildGameChunks, MAX_CHUNK_BYTES } from './game-chunks';

const MAX_BYTES = 1.5 * 1024 * 1024;

mkdirSync('dist', { recursive: true });
let failed = false;
// Games load on demand from classic-script chunks in dist/games/<course>/; pages learn the file names from VITE_GAME_CHUNKS.
const chunks = await buildGameChunks();
for (const [file, bytes] of Object.entries(chunks.sizes)) {
  console.log(`✔ dist/games/${file} (${(bytes / 1024).toFixed(0)} KB)`);
  if (bytes > MAX_CHUNK_BYTES) {
    console.error(`✘ dist/games/${file} is over the 300 KB chunk budget`);
    failed = true;
  }
}
const pageEnv = { ...process.env, VITE_GAME_CHUNKS: JSON.stringify(chunks.table) };
execSync('npx vite build', { stdio: 'inherit', env: { ...pageEnv, LESSON: '' } });
copyFileSync(join('dist/.tmp/index', 'index.html'), join('dist', 'index.html'));
console.log('✔ dist\\index.html (course index)');
for (const directory of ['concept-graph', 'quant-materials', 'open-courses']) {
  const assets = join('dist/.tmp/index', directory);
  if (existsSync(assets)) cpSync(assets, join('dist', directory), { recursive: true });
}
for (const lesson of findLessons()) {
  execSync('npx vite build', { stdio: 'inherit', env: { ...pageEnv, LESSON: lesson } });
  const name = outputName(lesson);
  const target = join('dist', name);
  copyFileSync(join('dist/.tmp', name.replace(/\.html$/, ''), 'index.html'), target);
  const bytes = statSync(target).size;
  console.log(`✔ ${target} (${(bytes / 1024).toFixed(0)} KB)`);
  if (bytes > MAX_BYTES) {
    console.error(`✘ ${target} is over the 1.5 MB budget`);
    failed = true;
  }
}
rmSync('dist/.tmp', { recursive: true, force: true });
process.exit(failed ? 1 : 0);

