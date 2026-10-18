import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mitLinearAlgebraGames, mitLinearAlgebraGenerators } from './registry';

describe('complete MIT 18.06SC game inventory', () => {
  it('covers 32 topics, 4 reviews, 4 exams and a distinct 2023 supplement', () => {
    expect(mitLinearAlgebraGames).toHaveLength(41);
    expect(Object.keys(mitLinearAlgebraGenerators).sort()).toEqual(mitLinearAlgebraGames.map(g => g.id).sort());
    expect(mitLinearAlgebraGames.filter(g => g.kind === 'topic')).toHaveLength(32);
    expect(mitLinearAlgebraGames.filter(g => g.kind === 'review')).toHaveLength(4);
    expect(mitLinearAlgebraGames.filter(g => g.kind === 'exam')).toHaveLength(4);
    expect(mitLinearAlgebraGames.filter(g => g.kind === 'bonus')).toHaveLength(1);
    expect(mitLinearAlgebraGames[40].title.en).toContain('2023');
  });

  it('points to actual local PDFs and the corresponding official MIT pages', () => {
    for (const game of mitLinearAlgebraGames) {
      expect(game.officialUrl).toContain('https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/');
      expect(game.sources.length).toBeGreaterThan(0);
      for (const source of game.sources) {
        const path = resolve('public/open-courses', source.asset);
        expect(existsSync(path), `${game.id}: ${source.asset}`).toBe(true);
        expect(readFileSync(path).subarray(0, 5).toString()).toBe('%PDF-');
      }
      if (game.kind === 'topic') expect(game.sources.some(s => s.kind === 'notes'), game.id).toBe(true);
      if (game.kind === 'exam') {
        expect(game.sources.some(s => s.kind === 'problems'), game.id).toBe(true);
        expect(game.sources.some(s => s.kind === 'solutions'), game.id).toBe(true);
      }
    }
  });
});

describe('reachable, bilingual and deterministic practice decks', () => {
  for (const game of mitLinearAlgebraGames) {
    it(`${game.id}: bounded inputs, unique answers and reachable symbols across 200 seeds`, () => {
      const generate = mitLinearAlgebraGenerators[game.id];
      expect(new Set([1, 17, 89, 12345, 987654321].map(seed => JSON.stringify(generate(seed, 'en')))).size).toBeGreaterThan(1);
      for (let seed = 0; seed < 200; seed++) {
        const en = generate(seed, 'en'), zh = generate(seed, 'zh');
        expect(generate(seed, 'en')).toEqual(en);
        expect(en.length).toBeGreaterThanOrEqual(game.kind === 'exam' ? 10 : 8);
        expect(en.length).toBeLessThanOrEqual(16);
        expect(new Set(en.map(c => c.id)).size).toBe(en.length);
        expect(zh.map(c => c.id)).toEqual(en.map(c => c.id));
        expect(en.some(c => c.fields)).toBe(true);
        expect(en.some(c => c.choice)).toBe(true);
        for (let i = 0; i < en.length; i++) {
          const card = en[i], translated = zh[i];
          expect(Number(!!card.fields) + Number(!!card.choice) + Number(!!card.slots)).toBe(1);
          expect(card.prompt.trim().length).toBeGreaterThan(0);
          expect(card.hint.trim().length).toBeGreaterThan(0);
          expect(card.explanation.trim().length).toBeGreaterThan(0);
          expect(translated.prompt.trim().length).toBeGreaterThan(0);
          if (card.fields) {
            expect(translated.fields?.map(f => f.answer)).toEqual(card.fields.map(f => f.answer));
            for (const field of card.fields) {
              expect(Number.isFinite(field.answer), `${card.id}: ${field.label}`).toBe(true);
              expect(Math.abs(field.answer), `${card.id}: arithmetic bound`).toBeLessThanOrEqual(10000);
              if (field.tolerance !== undefined) expect(field.tolerance).toBeGreaterThan(0);
            }
          }
          if (card.choice) {
            expect(card.choice.answer).toBeGreaterThanOrEqual(0);
            expect(card.choice.answer).toBeLessThan(card.choice.options.length);
            expect(new Set(card.choice.options).size, card.id).toBe(card.choice.options.length);
            expect(translated.choice?.answer).toBe(card.choice.answer);
          }
          if (card.slots) {
            expect(translated.slots?.answers).toEqual(card.slots.answers);
            for (const answer of card.slots.answers) expect(card.slots.tokens, `${card.id}: unavailable token ${answer}`).toContain(answer);
          }
        }
      }
    });
  }
});
