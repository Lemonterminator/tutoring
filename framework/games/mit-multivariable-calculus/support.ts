import { seededRandom, type CardAudit, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import type { Figure, FigureShape, FigureView } from '../figure';

/** A string, or an [English, Simplified Chinese] pair. Never write "English / 中文" in one string. */
export type Text = string | readonly [string, string];
export type GeneratorMap = Record<string, CardGenerator>;

type Common = {
  /** Unique within the game; the full card ID is `<gameId>-<id>`. The independent final card must use the id `challenge`. */
  id: string;
  title: Text; prompt: Text; hint: Text; explanation: Text;
  /** Extra lines shown under the prompt, e.g. the sampled data. */
  lines?: Text[];
  figure?: Figure;
  /** Sampled inputs (all visible in the question) for an independent oracle test. See docs/mit-multivariable-conventions.md. */
  audit?: CardAudit;
};
export type NumberSpec = Common & { fields: { label: Text; answer: number; tolerance?: number }[] };
export type ChoiceSpec = Common & {
  options: Text[]; correct: number; optionFigures?: (Figure | undefined)[];
  /** Keep the options in the given order (for "Picture A/B/C/D"); otherwise they are shuffled. */
  fixedOrder?: boolean;
};
export type SymbolSpec = Common & { before: Text; after?: Text; between?: string[]; answers: string[]; tokens: string[] };

export type FigureSpec = {
  alt: Text; view: FigureView; shapes: FigureShape[]; caption?: Text;
  axes?: { xLabel?: Text; yLabel?: Text; grid?: boolean };
  /** See `Figure.aspect`: `free` for graphs whose axes carry different units. */
  aspect?: 'equal' | 'free';
};

/** Typed deck builder. Object arguments (not positional) so a missing field fails at compile time. */
export function makeMvDeck(seed: number, lang: GameLanguage, gameId: string) {
  const random = seededRandom(seed);
  const t = (value: Text): string => typeof value === 'string' ? value : value[lang === 'zh' ? 1 : 0];
  const base = (spec: Common): PracticeCard => ({
    id: `${gameId}-${spec.id}`, title: t(spec.title), prompt: t(spec.prompt), hint: t(spec.hint), explanation: t(spec.explanation),
    ...(spec.lines ? { lines: spec.lines.map(t) } : {}),
    ...(spec.figure ? { figure: spec.figure } : {}),
    ...(spec.audit ? { audit: spec.audit } : {}),
  });
  const number = (spec: NumberSpec): PracticeCard => ({
    ...base(spec),
    fields: spec.fields.map(f => ({ label: t(f.label), answer: f.answer, ...(f.tolerance === undefined ? {} : { tolerance: f.tolerance }) })),
  });
  const choice = (spec: ChoiceSpec): PracticeCard => {
    const order = spec.options.map((_, index) => index);
    if (!spec.fixedOrder) for (let i = order.length - 1; i > 0; i--) { const j = random(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    const figures = spec.optionFigures ? order.map(index => spec.optionFigures![index]) : undefined;
    return { ...base(spec), choice: { options: order.map(index => t(spec.options[index])), answer: order.indexOf(spec.correct), ...(figures ? { figures } : {}) } };
  };
  const symbols = (spec: SymbolSpec): PracticeCard => ({
    ...base(spec),
    slots: { before: t(spec.before), ...(spec.after ? { after: t(spec.after) } : {}), ...(spec.between ? { between: spec.between } : {}), answers: spec.answers, tokens: spec.tokens },
  });
  const figure = (spec: FigureSpec): Figure => ({
    alt: t(spec.alt), view: spec.view, shapes: spec.shapes,
    ...(spec.aspect ? { aspect: spec.aspect } : {}),
    ...(spec.caption ? { caption: t(spec.caption) } : {}),
    ...(spec.axes ? { axes: { ...(spec.axes.xLabel ? { xLabel: t(spec.axes.xLabel) } : {}), ...(spec.axes.yLabel ? { yLabel: t(spec.axes.yLabel) } : {}), ...(spec.axes.grid ? { grid: true } : {}) } } : {}),
  });
  /** Random integer in [min, max] that is never zero. */
  const nonzero = (min: number, max: number) => { let v = 0; while (v === 0) v = random(min, max); return v; };
  const pick = <T,>(items: readonly T[]): T => items[random(0, items.length - 1)];
  return { random, nonzero, pick, t, number, choice, symbols, figure, lang };
}

// ---- Number formatting. Use these in prompts and explanations so negatives never print as "−-3" or "+ -3". ----
const MINUS = '−';
/** -3 -> "−3", 2 -> "2", 0.5 -> "0.5". */
export function num(x: number): string { const r = Number(x.toFixed(6)); return r < 0 ? `${MINUS}${-r}` : String(r === 0 ? 0 : r); }
/** A multiple of pi: piTerm(1) = "π", piTerm(-1) = "−π", piTerm(3) = "3π", piTerm(0.5) = "0.5π", piTerm(0) = "0". */
export function piTerm(k: number): string { return k === 0 ? '0' : k === 1 ? 'π' : k === -1 ? `${MINUS}π` : `${num(k)}π`; }
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** A power of a variable: power('x', 1) = "x", power('x', 3) = "x³", power('x', 12) = "x^12". Never prints an exponent 1. */
export function power(base: string, exponent: number): string { return exponent === 1 ? base : Number.isInteger(exponent) && exponent >= 2 && exponent <= 9 ? `${base}${SUPERSCRIPTS[exponent]}` : `${base}^${exponent}`; }
/** An exactly representable rational as a reduced fraction (denominator up to 720), otherwise a rounded number: exact(1/3) = "1/3", exact(-2.5) = "−5/2", exact(Math.PI) = "3.141593". Use it when the card asks for an integer or a fraction. */
export function exact(x: number, maxDenominator = 720): string {
  if (!Number.isFinite(x)) return num(x);
  for (let d = 1; d <= maxDenominator; d++) { const n = Math.round(x * d); if (Math.abs(x - n / d) < 1e-9 * Math.max(1, Math.abs(x))) return frac(n, d); }
  return num(x);
}
/** Parenthesise negatives: -3 -> "(−3)", 2 -> "2". For substitution into products and powers. */
export function par(x: number): string { return x < 0 ? `(${num(x)})` : num(x); }
/** Signed term for "a + b" / "a − b": 3 -> "+ 3", -3 -> "− 3". */
export function term(x: number): string { return x < 0 ? `${MINUS} ${num(-x)}` : `+ ${num(x)}`; }
/** Coefficient with a variable: coef(1,'x') = "x", coef(-1,'x') = "−x", coef(3,'x') = "3x". */
export function coef(a: number, variable: string): string { return a === 1 ? variable : a === -1 ? `${MINUS}${variable}` : `${num(a)}${variable}`; }
export function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
/** Reduced fraction text: frac(2,4) = "1/2", frac(-3,6) = "−1/2", frac(4,2) = "2". */
export function frac(n: number, d: number): string {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d); n /= g; d /= g;
  return d === 1 ? num(n) : `${num(n)}/${d}`;
}
/** Vector as "(1, −2, 3)". */
export function vec(...components: number[]): string { return `(${components.map(num).join(', ')})`; }
/** Linear expression: linear([2, -1, 0], ['x', 'y', 'z']) = "2x − y"; linear([-1, 3], ['x', 'y']) = "−x + 3y". Zero coefficients are omitted. */
export function linear(coefficients: number[], variables: string[]): string {
  const parts: string[] = [];
  coefficients.forEach((c, i) => {
    if (c === 0) return;
    const body = coef(Math.abs(c), variables[i]);
    parts.push(parts.length ? `${c < 0 ? MINUS : '+'} ${body}` : c < 0 ? `${MINUS}${body}` : body);
  });
  return parts.length ? parts.join(' ') : '0';
}
