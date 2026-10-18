// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChunkLoader, parseChunkFiles } from './chunk-loader';
import type { CardGenerator } from './types';

const generator: CardGenerator = () => [];
afterEach(() => { vi.restoreAllMocks(); delete globalThis.__tutoringGameChunks; });

describe('parseChunkFiles', () => {
  it('returns nothing outside a production build and filters by course', () => {
    expect(parseChunkFiles(undefined, 'c')).toBeNull();
    expect(parseChunkFiles('', 'c')).toBeNull();
    expect(parseChunkFiles(JSON.stringify({ 'c/a': 'games/c/a.1.js', 'd/b': 'games/d/b.1.js' }), 'c')).toEqual({ a: 'games/c/a.1.js' });
  });
});

describe('createChunkLoader with script chunks (file:// compatible)', () => {
  const scripts: HTMLScriptElement[] = [];
  const capture = () => vi.spyOn(document.head, 'append').mockImplementation((...nodes: (Node | string)[]) => { scripts.push(...nodes as HTMLScriptElement[]); });
  afterEach(() => { scripts.length = 0; });

  it('adds a classic script once, resolves with the registered map and caches it', async () => {
    capture();
    const loader = createChunkLoader('c', { a: 'games/c/a.1.js' }, null);
    expect(loader.peek('a')).toBeUndefined();
    const first = loader.load('a'), second = loader.load('a');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toBe('games/c/a.1.js');
    expect(scripts[0].type).toBe('');
    globalThis.__tutoringGameChunks = { 'c/a': { G: generator } };
    scripts[0].onload!(new Event('load'));
    expect((await first).G).toBe(generator);
    expect(await second).toBe(await first);
    expect(loader.peek('a')).toBe(await first);
    await loader.load('a');
    expect(scripts).toHaveLength(1);
  });

  it('rejects when the file is missing, and loads again on retry', async () => {
    capture();
    const loader = createChunkLoader('c', { a: 'games/c/a.1.js' }, null);
    const failing = loader.load('a');
    scripts[0].onerror!(new Event('error'));
    await expect(failing).rejects.toThrow('Could not load');
    expect(loader.peek('a')).toBeUndefined();
    const retry = loader.load('a');
    expect(scripts).toHaveLength(2);
    globalThis.__tutoringGameChunks = { 'c/a': { G: generator } };
    scripts[1].onload!(new Event('load'));
    expect((await retry).G).toBe(generator);
  });

  it('rejects an unknown chunk and a script that registers nothing', async () => {
    capture();
    const loader = createChunkLoader('c', { a: 'games/c/a.1.js' }, null);
    await expect(loader.load('zzz')).rejects.toThrow('Unknown chunk');
    const empty = loader.load('a');
    scripts[0].onload!(new Event('load'));
    await expect(empty).rejects.toThrow('did not register');
  });
});

describe('createChunkLoader with modules (dev server and tests)', () => {
  it('imports each chunk once', async () => {
    const importer = vi.fn(async () => ({ G: generator }));
    const loader = createChunkLoader('c', null, { a: importer });
    const [x, y] = await Promise.all([loader.load('a'), loader.load('a')]);
    expect(x).toBe(y);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(loader.peek('a')).toBe(x);
    await expect(loader.load('b')).rejects.toThrow('Unknown chunk');
  });
});
