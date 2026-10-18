import { describe, expect, it } from 'vitest';
import { parseMathText } from '../MathText';
import { aaltoGpGenerators } from './generators';
import { gpFinanceGenerators } from '../gp-finance/generators';
import { spreadSeed, textOf } from '../mit-multivariable-calculus/deck-invariants';
import type { Figure } from '../figure';

function labels(figure?: Figure): string[] {
  return figure?.shapes.flatMap(shape => shape.kind === 'text' ? [shape.text] : 'label' in shape && shape.label ? [shape.label] : []) ?? [];
}

describe('GP bilingual formula rendering', () => {
  for (const [id, generate] of Object.entries({ ...aaltoGpGenerators, ...gpFinanceGenerators })) {
    it(`${id}: every card field and figure label renders without a TeX error`, () => {
      for (const index of [3, 17, 41]) for (const lang of ['en', 'zh'] as const) {
        for (const card of generate(spreadSeed(index), lang)) {
          const strings = [...textOf(card), ...labels(card.figure), ...(card.choice?.figures?.flatMap(labels) ?? [])];
          for (const source of strings) for (const part of parseMathText(source)) if (part.kind === 'math') {
            expect(/katex-error|#cc0000/.test(part.html), `${id} ${lang} seed=${index} ${card.id}: ${source}`).toBe(false);
          }
        }
      }
    }, 30000);
  }
});
