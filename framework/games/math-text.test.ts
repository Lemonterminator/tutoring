import { describe, expect, it } from 'vitest';
import { parseMathText } from './MathText';
import { mitMultivariableGenerators } from './mit-multivariable-calculus/generators';
import { batch08Generators } from './mit-multivariable-calculus/batch08';
import { batch09Generators } from './mit-multivariable-calculus/batch09';
import { batch10Generators } from './mit-multivariable-calculus/batch10';
import type { Figure, FigureShape } from './figure';
import type { PracticeCard } from './types';

/** Text and formulas as written: formulas are shown as ⟦TeX⟧. */
function segments(source: string): string {
  return parseMathText(source).map(part => part.kind === 'text'
    ? part.value
    : `⟦${(part.html.match(/<annotation[^>]*>([\s\S]*?)<\/annotation>/)?.[1] ?? '?').replace(/&amp;/g, '&')}⟧`).join('');
}

/** KaTeX marks a parse error with .katex-error and an unknown command (\lambdax) in red. */
const broken = (html: string) => /katex-error|#cc0000/.test(html);

describe('formula detection in card prose', () => {
  it('keeps a Greek command apart from the next letter', () => {
    expect(segments('Ax = λx')).toBe('⟦Ax = \\lambda x⟧');
    expect(segments('A = SΛS⁻¹')).toBe('⟦A = S\\Lambda S^{-1}⟧');
  });

  it('keeps sentence punctuation outside the formula', () => {
    expect(segments('so A = SΛS⁻¹.')).toBe('so ⟦A = S\\Lambda S^{-1}⟧.');
    expect(segments('Then S is invertible and AS = SΛ, so')).toBe('Then ⟦S⟧ is invertible and ⟦AS = S\\Lambda ⟧, so');
    expect(segments('若 Ax = 1x，x 对 A³ 的特征值是多少？')).toBe('若 ⟦Ax = 1x⟧，⟦x⟧ 对 ⟦A^{3}⟧ 的特征值是多少？');
  });

  it('finds formulas glued to Chinese text and single variables between Chinese words', () => {
    expect(segments('λ = 2 时，A−2I 的零空间')).toBe('⟦\\lambda  = 2⟧ 时，⟦A-2I⟧ 的零空间');
    expect(segments('有 n 个特征向量')).toBe('有 ⟦n⟧ 个特征向量');
  });

  it('keeps whole vectors together, including Chinese commas inside brackets', () => {
    expect(segments('A = (−1, 0, −3) and B = (2, −3, 2).')).toBe('⟦A = (-1, 0, -3)⟧ and ⟦B = (2, -3, 2)⟧.');
    expect(segments('令 b = (3，1，3)，求解')).toBe('令 ⟦b = (3,1,3)⟧，求解');
  });

  it('sets function names upright and reads name=value formulas', () => {
    expect(segments('rank(B)=3−1=2.')).toBe('⟦\\operatorname{rank}(B)=3-1=2⟧.');
    expect(segments('For D = diag(2, 1), enter')).toBe('For ⟦D = \\operatorname{diag}(2, 1)⟧, enter');
    expect(segments('CDx=0; multiply')).toBe('⟦CDx=0⟧; multiply');
    expect(segments('N(A)=span{(2,1,0)}')).toBe('⟦N(A)=\\operatorname{span}\\{(2,1,0)\\}⟧');
    expect(segments('f_min=−20')).toBe('⟦f_{\\mathrm{min}}=-20⟧');
    expect(segments('w = −2xyz − 2x² + yz.')).toBe('⟦w = -2xyz - 2x^{2} + yz⟧.');
  });

  it('leaves English prose, articles, labels and typed answer syntax alone', () => {
    expect(segments('English seed=123 stage=1')).toBe('English seed=123 stage=1');
    expect(segments('A rank-1 truncation keeps')).toBe('A rank-1 truncation keeps');
    expect(segments('if they span R²')).toBe('if they span ⟦R^{2}⟧');
    expect(segments('Expanding along the first row: 1')).toBe('Expanding along the first row: 1');
    expect(segments('using 1=yes, 0=no.')).toBe('using 1=yes, 0=no.');
    expect(segments('e.g. 6pi.')).toBe('e.g. 6pi.');
    expect(segments('J−pI=0')).toBe('⟦J-pI=0⟧');
  });

  it('renders symbol-card fragments around a blank without errors', () => {
    for (const fragment of ['∫_', '^', '∫_{y=0}^{', '} dx dy', ' ∮_C₂ F·dr = ∬_R ', '∮_C_in F·dr', '(__, __)', 'e^(At)']) {
      for (const part of parseMathText(fragment)) if (part.kind === 'math') expect(broken(part.html), fragment).toBe(false);
    }
    expect(segments('e^(At)')).toBe('⟦e^{At}⟧');
  });

  it('renders common Unicode accents, summation bounds, KL bars and stacked scripts', () => {
    const examples = [
      'β̄ = 2',
      'Σₙ₌₁ᴺ xₙ',
      'KL[q ‖ p]',
      'KL[q(u) ‖ p(u)]',
      'KL[q ‖ p(f | y)]',
      'KL‖q ‖ p‖',
      'α̂₁',
      'wⱼ⁽¹⁾',
      'wᵦ⁽⁰⁾',
      'a⁽¹⁾',
      'Σⱼ₌₋₁¹ f(j)',
      'Σ₁₁',
      'Σₙ',
    ];
    for (const source of examples) {
      const parsed = parseMathText(source);
      const math = parsed.filter((part): part is Extract<typeof part, { kind: 'math' }> => part.kind === 'math');
      expect(math.length, source).toBeGreaterThan(0);
      for (const part of math) expect(broken(part.html), source).toBe(false);
    }
    expect(segments('β̄ = 2')).toContain('\\bar{\\beta}');
    expect(segments('Σₙ₌₁ᴺ xₙ')).toBe('⟦\\sum _{n=1}^{N} x_{n}⟧');
    for (const source of ['KL[q ‖ p]', 'KL[q(u) ‖ p(u)]', 'KL[q ‖ p(f | y)]']) {
      const rendered = segments(source);
      expect(rendered, source).toContain('\\middle\\Vert');
      expect(rendered, source).not.toContain('‖');
    }
    expect(segments('KL‖q ‖ p‖')).toBe('⟦\\operatorname{KL}\\left(q  \\middle\\Vert  p\\right)⟧');
    expect(segments('α̂₁')).toContain('\\hat{\\alpha}_{1}');
    expect(segments('wⱼ⁽¹⁾')).toContain('w_{j}^{(1)}');
    expect(segments('wᵦ⁽⁰⁾')).toContain('w_{\\beta }^{(0)}');
    expect(segments('a⁽¹⁾')).toContain('a^{(1)}');
    expect(segments('Σⱼ₌₋₁¹ f(j)')).toContain('\\sum');
    expect(segments('Σ₁₁')).toBe('⟦\\Sigma _{11}⟧');
    expect(segments('Σₙ')).toBe('⟦\\Sigma _{n}⟧');
  });
});

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

describe('MIT multivariable calculus formula rendering', () => {
  it('renders every visible text field of every generator without a TeX error', () => {
    const generators = { ...mitMultivariableGenerators, ...batch08Generators, ...batch09Generators, ...batch10Generators };
    for (const seed of [0, 7919]) {
      for (const [id, generate] of Object.entries(generators)) {
        for (const language of ['en', 'zh'] as const) {
          for (const card of generate(seed, language)) {
            for (const source of visibleCardText(card)) {
              for (const part of parseMathText(source)) {
                if (part.kind === 'math') expect(broken(part.html), `${id}/${language}/${card.id}: ${source}`).toBe(false);
              }
            }
          }
        }
      }
    }
  });
});
