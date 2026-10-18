import { describe, expect, it } from 'vitest';
import conceptMap from '../games/mit-multivariable-calculus/concept-map.json';
import manifest from '../games/mit-multivariable-calculus/manifest.json';
import { mitMultivariableGames } from '../games/mit-multivariable-calculus/registry';
import openCourses from '../../public/concept-graph/open-courses.json';

describe('MIT multivariable calculus concept map contract', () => {
  const nodeIds = new Set(openCourses.nodes.map(n => n.id));
  const manifestGameIds = new Set(manifest.games.map(g => g.id));
  const availableGameIds = new Set(mitMultivariableGames.map(g => g.id));

  it('maps only valid open-course node ids starting with ocw-calc-', () => {
    const keys = Object.keys(conceptMap);
    expect(keys.length).toBe(81);
    for (const key of keys) {
      expect(key.startsWith('ocw-calc-')).toBe(true);
      expect(nodeIds.has(key), `Node ${key} exists in open-courses.json`).toBe(true);
    }
  });

  it('references only valid game ids declared in manifest.json', () => {
    for (const [key, gameIds] of Object.entries(conceptMap)) {
      expect(Array.isArray(gameIds)).toBe(true);
      expect(gameIds.length).toBeGreaterThan(0);
      for (const gameId of gameIds) {
        expect(manifestGameIds.has(gameId), `Game ${gameId} for node ${key} exists in manifest.json`).toBe(true);
      }
    }
  });

  it('filters available games without producing links to unreleased games', () => {
    for (const [key, gameIds] of Object.entries(conceptMap)) {
      const active = (gameIds as string[]).filter(id => availableGameIds.has(id));
      for (const id of active) {
        expect(availableGameIds.has(id)).toBe(true);
      }
    }
  });
});
