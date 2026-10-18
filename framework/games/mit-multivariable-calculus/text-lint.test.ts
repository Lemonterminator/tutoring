import { describe, expect, it } from 'vitest';
import { deckProblems, textLintProblems } from './deck-invariants';
import { batch08Generators } from './batch08';
import { batch09Generators } from './batch09';
import { batch10Generators } from './batch10';

/**
 * Games 36-50 (not registered yet): structural test plus the typography lint found while reading their rendered decks
 * (printed coefficient 1, exponent 1, glued digits, template leaks, ASCII hyphen as minus, false "a/b = c" arithmetic, ...).
 * Games 1-35 have not been scanned with the lint yet (about 11 EN hits, see the progress log).
 */
const generators = { ...batch08Generators, ...batch09Generators, ...batch10Generators };

describe('games 36-50 text', () => {
  for (const [id, generate] of Object.entries(generators)) {
    const kind = id === 'MIT-MV-48' ? 'review' : id === 'MIT-MV-49' ? 'exam' : 'topic';
    it(`${id} passes the structural test`, () => expect(deckProblems(id, generate, kind, 100)).toEqual([]));
    it(`${id} has no typography lint hits`, () => expect(textLintProblems(id, generate, 100)).toEqual([]));
  }
});
