import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mitMultivariableGameIndex, mitMultivariableGames, mitMultivariablePlannedGames, mitMultivariableProblemSets } from './registry';
import { mitMultivariableChunkGenerators, mitMultivariableGenerators } from './generators';
import { buildGameIndex } from '../game-index';
import { deckProblems } from './deck-invariants';

describe('MIT 18.02SC plan and manifest', () => {
  it('plans 69 games covering all 102 sessions and 5 exams exactly once', () => {
    expect(mitMultivariablePlannedGames).toHaveLength(69);
    expect(mitMultivariablePlannedGames.map(g => g.sequence)).toEqual(Array.from({ length: 69 }, (_, i) => i + 1));
    expect(new Set(mitMultivariablePlannedGames.map(g => g.id)).size).toBe(69);
    const sessions = mitMultivariablePlannedGames.flatMap(g => g.sessions);
    expect([...sessions].sort((a, b) => a - b)).toEqual(Array.from({ length: 102 }, (_, i) => i + 1));
    expect(mitMultivariablePlannedGames.filter(g => g.kind === 'exam')).toHaveLength(5);
    expect(mitMultivariablePlannedGames.filter(g => g.kind === 'review')).toHaveLength(7);
    expect(mitMultivariableProblemSets).toHaveLength(12);
  });

  it('points every planned game at real local PDFs and the official MIT page', () => {
    for (const game of mitMultivariablePlannedGames) {
      expect(game.officialUrl).toContain('https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/');
      if (game.kind === 'exam') {
        expect(game.sources.some(s => s.kind === 'problems'), game.id).toBe(true);
        expect(game.sources.some(s => s.kind === 'solutions'), game.id).toBe(true);
      } else if (game.evidence === 'full') {
        expect(game.sources.some(s => s.kind === 'notes' || s.kind === 'problems'), game.id).toBe(true);
      }
      for (const source of game.sources) {
        const path = resolve('public/open-courses', source.asset);
        expect(existsSync(path), `${game.id}: ${source.asset}`).toBe(true);
        expect(readFileSync(path).subarray(0, 5).toString()).toBe('%PDF-');
      }
    }
  });

  it('has a generator only for planned games, and lists exactly those games', () => {
    const planned = new Set(mitMultivariablePlannedGames.map(g => g.id));
    for (const id of Object.keys(mitMultivariableGenerators)) expect(planned.has(id), id).toBe(true);
    expect(mitMultivariableGames.map(g => g.id)).toEqual(mitMultivariablePlannedGames.filter(g => g.id in mitMultivariableGenerators).map(g => g.id));
  });
});

describe('game index (on-demand chunks)', () => {
  it('registers all 69 games of the plan', () => {
    expect(mitMultivariableGames).toHaveLength(69);
    expect(Object.keys(mitMultivariableGameIndex)).toHaveLength(69);
  });

  it('is up to date with the generators (run `npm run sync:game-index` when this fails)', () => {
    expect(mitMultivariableGameIndex).toEqual(buildGameIndex(mitMultivariableChunkGenerators));
  });

  it('names a chunk file that exists for every chunk, and the loader knows the same chunks', async () => {
    const chunks = new Set(Object.values(mitMultivariableGameIndex).map(entry => entry.chunk));
    expect([...chunks].sort()).toEqual(Object.keys(mitMultivariableChunkGenerators).sort());
    for (const name of chunks) expect(existsSync(resolve('framework/games/mit-multivariable-calculus', `${name}.ts`)), name).toBe(true);
    const { mitMultivariableChunkLoader } = await import('./chunks');
    for (const name of chunks) {
      const loaded = await mitMultivariableChunkLoader.load(name);
      expect(Object.keys(loaded).sort(), name).toEqual(Object.keys(mitMultivariableChunkGenerators[name]).sort());
      expect(mitMultivariableChunkLoader.peek(name)).toBe(loaded);
    }
  }, 60000);
});

describe('structural deck invariants (hidden inputs, localisation, contract; not mathematical validation)', () => {
  for (const game of mitMultivariableGames) {
    it(`${game.id} ${game.title.en}: 200 seeds, both languages`, () => {
      expect(deckProblems(game.id, mitMultivariableGenerators[game.id], game.kind)).toEqual([]);
    }, 30000);
  }
});
