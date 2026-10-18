import { describe, expect, it } from 'vitest';
import { parseMathText } from '../MathText';
import manifest from './manifest.json';
import { mitLinearAlgebraGenerators } from './registry';
import type { Figure, FigureShape } from '../figure';
import type { PracticeCard } from '../types';

function figureText(figure?: Figure): string[] {
  if (!figure) return [];
  const labels = figure.shapes.flatMap((shape: FigureShape) => {
    if (shape.kind === 'text') return [shape.text];
    return 'label' in shape && shape.label ? [shape.label] : [];
  });
  return [figure.alt, figure.caption ?? '', figure.axes?.xLabel ?? '', figure.axes?.yLabel ?? '', ...labels];
}

function visibleCardText(card: PracticeCard): string[] {
  return [
    card.title, card.prompt, card.hint, card.explanation, ...(card.lines ?? []),
    ...(card.fields?.map((field) => field.label) ?? []),
    ...(card.choice?.options ?? []),
    ...(card.slots ? [card.slots.before, ...(card.slots.between ?? []), card.slots.after ?? '', ...card.slots.tokens] : []),
    ...figureText(card.figure),
    ...(card.choice?.figures?.flatMap((figure) => figureText(figure)) ?? []),
  ];
}

describe('MIT linear algebra LaTeX rendering', () => {
  it('renders explicit delimiters, legacy matrices, and common Unicode math', () => {
    const cases = [
      '$x_1 + x_2 = 3$',
      '$$\\begin{bmatrix}1&2\\\\3&7\\end{bmatrix}$$',
      '\\(R₂ ← R₂ - mR₁\\)',
      '\\[\\sqrt{2} + π/2\\]',
      'A = [[1, 2], [3, 7]]',
      '||x|| ≤ 1 and c₁ ∈ R²',
    ];
    for (const source of cases) {
      const parts = parseMathText(source);
      expect(parts.some((part) => part.kind === 'math'), source).toBe(true);
      expect(parts.filter((part) => part.kind === 'math').some((part) => /katex-error|#cc0000/.test(part.html)), source).toBe(false);
    }
    expect(parseMathText('A = [[1, 2], [3, 7]]').some((part) => part.kind === 'math' && part.html.includes('mtable'))).toBe(true);
  });

  it('renders every visible text field across all 41 games in both languages', () => {
    const seeds = [0, 7919, 0xffff_ffff];
    expect(manifest.games).toHaveLength(41);
    for (const seed of seeds) {
      for (const game of manifest.games) {
        const generate = mitLinearAlgebraGenerators[game.id];
        for (const language of ['en', 'zh'] as const) {
          const cards = generate(seed, language);
          for (const card of cards) {
            for (const source of visibleCardText(card)) {
              const parts = parseMathText(source);
              const mathParts = parts.filter((part) => part.kind === 'math');
              expect(mathParts.some((part) => /katex-error|#cc0000/.test(part.html)), `${game.id}/${language}/${card.id}: ${source} => ${mathParts.map((part) => part.html.match(/<annotation[^>]*>(.*?)<\/annotation>/)?.[1] ?? '').join(' | ')}`).toBe(false);
              if (source.includes('[[')) expect(parts.some((part) => part.kind === 'text' && part.value.includes('[[')), `${game.id}/${language}/${card.id}: ${source}`).toBe(false);
            }
          }
        }
      }
    }
  });
});
