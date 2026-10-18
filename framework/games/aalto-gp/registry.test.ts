import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aaltoGpGameIndex, aaltoGpGames, aaltoGpPlannedGames, aaltoGpUnits } from './registry';
import { aaltoGpChunkGenerators, aaltoGpGenerators } from './generators';
import { gpFinanceGameIndex, gpFinanceGames, gpFinancePlannedGames } from '../gp-finance/registry';
import { gpFinanceChunkGenerators, gpFinanceGenerators } from '../gp-finance/generators';
import { buildGameIndex } from '../game-index';
import { deckProblems } from '../mit-multivariable-calculus/deck-invariants';
import type { OcwGame, OcwSource } from '../OcwGameCourse';

const courses = [
  { name: 'aalto-gp', planned: aaltoGpPlannedGames as readonly OcwGame[], games: aaltoGpGames as readonly OcwGame[], index: aaltoGpGameIndex, chunks: aaltoGpChunkGenerators, generators: aaltoGpGenerators },
  { name: 'gp-finance', planned: gpFinancePlannedGames as readonly OcwGame[], games: gpFinanceGames as readonly OcwGame[], index: gpFinanceGameIndex, chunks: gpFinanceChunkGenerators, generators: gpFinanceGenerators },
];

describe('Aalto GP plan and manifests (docs/aalto-gp-games-plan.md)', () => {
  it('releases the complete 33-game course and all three finance bridge games', () => {
    expect(aaltoGpGames.map(g => g.id)).toEqual(aaltoGpPlannedGames.map(g => g.id));
    expect(gpFinanceGames.map(g => g.id)).toEqual(gpFinancePlannedGames.map(g => g.id));
    expect(Object.keys(aaltoGpGenerators)).toHaveLength(33);
    expect(Object.keys(gpFinanceGenerators)).toHaveLength(3);
  });
  it('plans 33 course games and 3 bridge games with distinct ids in sequence', () => {
    expect(aaltoGpPlannedGames).toHaveLength(33);
    expect(gpFinancePlannedGames).toHaveLength(3);
    expect(aaltoGpPlannedGames.map(g => g.sequence)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
    expect(new Set([...aaltoGpPlannedGames, ...gpFinancePlannedGames].map(g => g.id)).size).toBe(36);
    expect(aaltoGpPlannedGames.filter(g => g.kind === 'bonus').map(g => g.id)).toEqual(['GP-S1', 'GP-S2']);
    expect(aaltoGpUnits).toHaveLength(12);
    for (const g of aaltoGpPlannedGames) expect(g.unit, g.id).toBeLessThanOrEqual(12);
  });

  it('covers all 12 CS-E4895 lectures and all 6 assignments', () => {
    const titles = aaltoGpPlannedGames.flatMap(g => (g.sources as OcwSource[]).map(s => s.title));
    for (let n = 1; n <= 12; n++) expect(titles.some(t => t.startsWith(`Lecture ${n}:`)), `Lecture ${n}`).toBe(true);
    for (let n = 1; n <= 6; n++) expect(titles.some(t => t.startsWith(`Assignment ${n} `)), `Assignment ${n}`).toBe(true);
  });

  it('points every source at a local PDF page or a pinned GitHub file', () => {
    for (const game of [...aaltoGpPlannedGames, ...gpFinancePlannedGames] as OcwGame[]) {
      expect(game.officialUrl, game.id).toMatch(/^https:\/\/github\.com\/SpringNuance\/Gaussian-Processes\/blob\/[0-9a-f]{40}\//);
      for (const source of game.sources) {
        if (source.href) { expect(source.href, game.id).toMatch(/^https:\/\/github\.com\/SpringNuance\/Gaussian-Processes\/blob\/[0-9a-f]{40}\/.*\.ipynb$/); continue; }
        const path = resolve('public/open-courses', decodeURIComponent(source.asset!));
        expect(existsSync(path), `${game.id}: ${source.asset}`).toBe(true);
        expect(readFileSync(path).subarray(0, 5).toString()).toBe('%PDF-');
        expect(source.page, `${game.id}: ${source.title}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe.each(courses)('$name game index (on-demand chunks)', ({ name, planned, games, index, chunks, generators }) => {
  it('has a generator only for planned games, and lists exactly those games', () => {
    const ids = new Set(planned.map(g => g.id));
    for (const id of Object.keys(generators)) expect(ids.has(id), id).toBe(true);
    expect(games.map(g => g.id)).toEqual(planned.filter(g => g.id in generators).map(g => g.id));
  });

  it('is up to date with the generators (run `npm run sync:game-index` when this fails)', () => {
    expect(index).toEqual(buildGameIndex(chunks));
  });

  it('has a module file for every chunk in use', () => {
    for (const chunk of new Set(Object.values(index).map(entry => entry.chunk))) expect(existsSync(resolve('framework/games', name, `${chunk}.ts`)), chunk).toBe(true);
  });
});

describe('structural deck invariants (hidden inputs, localisation, contract; not mathematical validation)', () => {
  const all = courses.flatMap(c => c.games.map(game => ({ game, generate: c.generators[game.id] })));
  it.skipIf(all.length > 0)('no GP game implemented yet', () => {});
  for (const { game, generate } of all) {
    it(`${game.id} ${game.title.en}: 200 seeds, both languages`, () => {
      expect(deckProblems(game.id, generate, game.kind)).toEqual([]);
    }, 30000);
  }
});
