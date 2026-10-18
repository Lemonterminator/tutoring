import { describe, expect, it } from 'vitest';
import { deckProblems, spreadSeed, textLintProblems } from './deck-invariants';
import { batch13Generators } from './batch13';
import { batch14Generators } from './batch14';
import { parseMathText } from '../MathText';
import type { Figure, FigureShape } from '../figure';
import type { PracticeCard } from '../types';

/**
 * Games 61-69 (not registered yet): structural test, typography lint and KaTeX rendering of every visible string.
 * Games are added to batch13.ts / batch14.ts as they are implemented.
 */
const generators = { ...batch13Generators, ...batch14Generators };

const broken = (html: string) => /katex-error|#cc0000/.test(html);
function figureText(figure?: Figure): string[] {
  if (!figure) return [];
  return [figure.alt, figure.caption ?? '', ...figure.shapes.map((shape: FigureShape) => shape.kind === 'text' ? shape.text : 'label' in shape ? shape.label ?? '' : '')];
}
function visibleCardText(card: PracticeCard): string[] {
  return [
    card.title, card.prompt, card.hint, card.explanation, ...(card.lines ?? []),
    ...(card.fields?.map(field => field.label) ?? []), ...(card.choice?.options ?? []),
    ...(card.slots ? [card.slots.before, ...(card.slots.between ?? []), card.slots.after ?? '', ...card.slots.tokens] : []),
    ...figureText(card.figure), ...(card.choice?.figures?.flatMap(figure => figureText(figure ?? undefined)) ?? []),
  ];
}

describe('games 61-69 text', () => {
  for (const [id, generate] of Object.entries(generators)) {
    it(`${id} passes the structural test`, () => expect(deckProblems(id, generate, 'topic', 100)).toEqual([]));
    it(`${id} has no typography lint hits`, () => expect(textLintProblems(id, generate, 100)).toEqual([]));
    it(`${id} renders every visible string without a TeX error`, () => {
      const bad: string[] = [];
      for (let index = 0; index < 20; index++) for (const language of ['en', 'zh'] as const)
        for (const card of generate(spreadSeed(index), language)) for (const source of visibleCardText(card))
          for (const part of parseMathText(source)) if (part.kind === 'math' && broken(part.html)) bad.push(`${language}/${card.id}: ${source}`);
      expect([...new Set(bad)]).toEqual([]);
    });
  }
});
