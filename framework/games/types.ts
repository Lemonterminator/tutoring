import type { Figure } from './figure';

export type GameLanguage = 'en' | 'zh';
/** Machine-readable sampled inputs that an independent oracle recomputes from. Every value must also be visible in the question. */
export type CardAudit = { kind: string; params: Record<string, number | number[]> };
export type PracticeCard = {
  id: string; title: string; prompt: string; lines?: string[];
  fields?: { label: string; answer: number; tolerance?: number }[];
  choice?: { options: string[]; answer: number; figures?: (Figure | undefined)[] };
  slots?: { before: string; between?: string[]; after?: string; answers: string[]; tokens: string[] };
  bound?: { ceiling: number; start: number };
  figure?: Figure;
  audit?: CardAudit;
  hint: string; explanation: string;
};
export type CardGenerator = (seed: number, lang: GameLanguage) => PracticeCard[];

const NUMBER = String.raw`(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const SIGNED = `[+-]?${NUMBER}`;
const PLAIN = new RegExp(`^${SIGNED}$`);
const FRACTION = new RegExp(String.raw`^(${SIGNED})\s*/\s*(${SIGNED})$`);
// sign, [coef[/coefDen]], [*], (pi | √r | sqrt(r)), [/den]
const SYMBOLIC = new RegExp(
  String.raw`^([+-]?)(?:(${NUMBER})(?:\s*/\s*(${NUMBER}))?)?\s*(\*)?\s*(?:(π|pi)|√\s*(${NUMBER})|sqrt\s*\(\s*(${NUMBER})\s*\))(?:\s*/\s*(${NUMBER}))?$`, 'i');

function finite(value: number): number | null { return Number.isFinite(value) ? value : null; }

/**
 * Answers are numbers, fractions, or one exact constant (π or a square root). Never executable expressions.
 * Accepted: `3`, `-0.5`, `1/4`, `pi`, `3pi/4`, `3π/4`, `3/4 pi`, `2*pi`, `sqrt(2)`, `3√2/2`, `√5`.
 * Rejected: sums, products of constants, nested roots, a second fraction bar on both sides of the constant.
 */
export function parseGameNumber(raw: string): number | null {
  const text = raw.trim().replaceAll('−', '-');
  if (PLAIN.test(text)) return finite(Number(text));
  const fraction = text.match(FRACTION);
  if (fraction) {
    const numerator = Number(fraction[1]), denominator = Number(fraction[2]);
    return denominator === 0 ? null : finite(numerator / denominator);
  }
  const symbolic = text.match(SYMBOLIC);
  if (!symbolic) return null;
  const [, sign, coefficient, coefficientDenominator, star, pi, rootBare, rootParen, denominator] = symbolic;
  if (star && coefficient === undefined) return null;
  if (coefficientDenominator !== undefined && denominator !== undefined) return null;
  let value = coefficient === undefined ? 1 : Number(coefficient);
  if (coefficientDenominator !== undefined) {
    const d = Number(coefficientDenominator);
    if (d === 0) return null;
    value /= d;
  }
  value *= pi ? Math.PI : Math.sqrt(Number(rootBare ?? rootParen));
  if (denominator !== undefined) {
    const d = Number(denominator);
    if (d === 0) return null;
    value /= d;
  }
  return finite(sign === '-' ? -value : value);
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return (min: number, max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return min + Math.floor(state / 4294967296 * (max - min + 1));
  };
}

export function gradeCard(card: PracticeCard, values: string[], selection: number | null, slots: string[]): 'incomplete' | 'correct' | 'incorrect' {
  if (card.fields) {
    const parsed = card.fields.map((_, i) => parseGameNumber(values[i] ?? ''));
    if (parsed.some(value => value === null)) return 'incomplete';
    return card.fields.every((field, i) => Math.abs(parsed[i]! - field.answer) <= (field.tolerance ?? 1e-8)) ? 'correct' : 'incorrect';
  }
  if (card.choice) return selection === null ? 'incomplete' : selection === card.choice.answer ? 'correct' : 'incorrect';
  if (card.slots) {
    if (card.slots.answers.some((_, i) => !slots[i])) return 'incomplete';
    return card.slots.answers.every((answer, i) => answer === slots[i]) ? 'correct' : 'incorrect';
  }
  throw new Error(`Card ${card.id} has no answer mode`);
}
