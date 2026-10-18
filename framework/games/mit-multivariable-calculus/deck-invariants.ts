import { figureProblems, type Figure } from '../figure';
import type { CardGenerator, PracticeCard } from '../types';

const CJK = /[㐀-鿿]/;
/** "English / 中文" literal mixes and other localisation damage. */
const MIXED = /[A-Za-z]{3,}[A-Za-z ,.'’-]* \/ [㐀-鿿]|[㐀-鿿] \/ [A-Za-z]{3,} [A-Za-z]/;
/** "−-3", "+ -3", "- -3": a negative number substituted without parentheses. */
const DOUBLE_SIGN = /[+−-]\s*[-−]\s*\d/;
const LEAK = /undefined|NaN|\[object|Infinity/;
/** Untranslated English connectives inside Chinese text, e.g. "(1, 2) and (3, 4)". */
const ENGLISH_WORD = /(?<![A-Za-z])(and|or|the|with|for|is|are|if|then|where|of|to)(?![A-Za-z])/;
/** Well-spread 32-bit seeds: the shared LCG's first draws are nearly constant for tiny sequential seeds, while the app seeds with random 32-bit values. */
export const spreadSeed = (i: number) => (Math.imul(i + 1, 2654435761) >>> 0);

/** Text the student can see BEFORE answering: hint and explanation are excluded on purpose. */
export function questionTextOf(card: PracticeCard): string[] {
  return textOf(card).filter(text => text !== card.hint && text !== card.explanation);
}

export function textOf(card: PracticeCard): string[] {
  const figures: Figure[] = [card.figure, ...(card.choice?.figures ?? [])].filter((f): f is Figure => !!f);
  return [
    card.title, card.prompt, card.hint, card.explanation, ...(card.lines ?? []),
    ...(card.fields?.map(f => f.label) ?? []), ...(card.choice?.options ?? []),
    ...(card.slots ? [card.slots.before, card.slots.after ?? '', ...(card.slots.between ?? []), ...card.slots.tokens] : []),
    ...figures.flatMap(f => [f.alt, f.caption ?? '', f.axes?.xLabel ?? '', f.axes?.yLabel ?? '']),
  ];
}

function numbersIn(strings: string[]): Set<number> {
  // 0 and 1 are always implicit: omitted terms (coefficient 0) and bare variables (coefficient 1) are visible in the question's structure.
  const found = new Set<number>([0, 1]);
  const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  // a superscript digit is a visible number too: x³ shows the exponent 3
  for (const text of strings) for (const m of text.replaceAll('−', '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, d => ` ${SUPERSCRIPT.indexOf(d)} `).matchAll(/\d+(?:\.\d+)?/g)) found.add(Math.abs(Number(m[0])));
  return found;
}

/**
 * Structural checks for one generator across many seeds and both languages.
 * This is NOT mathematical validation: it catches hidden inputs, localisation damage and contract errors.
 */
export function deckProblems(id: string, generate: CardGenerator, kind: string, seeds = 200): string[] {
  const problems: string[] = [];
  const add = (seed: number, message: string) => { if (problems.length < 30) problems.push(`${id} seed ${seed}: ${message}`); };
  const distinct = new Set<string>();
  for (let index = 0; index < seeds; index++) {
    const seed = spreadSeed(index);
    const en = generate(seed, 'en'), zh = generate(seed, 'zh');
    distinct.add(JSON.stringify(en));
    if (JSON.stringify(generate(seed, 'en')) !== JSON.stringify(en)) add(seed, 'not deterministic');
    const [min, max] = kind === 'exam' || kind === 'review' ? [9, 16] : [7, 12];
    if (en.length < min || en.length > max) add(seed, `${en.length} cards, expected ${min}-${max}`);
    if (new Set(en.map(c => c.id)).size !== en.length) add(seed, 'duplicate card IDs');
    if (JSON.stringify(zh.map(c => c.id)) !== JSON.stringify(en.map(c => c.id))) add(seed, 'EN/ZH card IDs differ');
    if (!en.some(c => c.fields)) add(seed, 'no numeric card');
    if (!en.some(c => c.choice)) add(seed, 'no conceptual choice card');
    const last = en[en.length - 1];
    if (!last || !last.id.endsWith('-challenge') || (!last.fields && !last.slots)) add(seed, 'final card must be an independent `challenge` numeric or symbol card');
    en.forEach((card, i) => {
      const other = zh[i];
      const at = `${card.id}`;
      const modes = Number(!!card.fields) + Number(!!card.choice) + Number(!!card.slots);
      if (modes !== 1) add(seed, `${at}: needs exactly one answer mode`);
      for (const [key, value] of [['prompt', card.prompt], ['hint', card.hint], ['explanation', card.explanation], ['title', card.title]] as const)
        if (!value.trim()) add(seed, `${at}: empty ${key}`);
      if (card.hint.trim() === card.explanation.trim()) add(seed, `${at}: hint equals explanation`);
      for (const text of textOf(card)) {
        if (CJK.test(text)) add(seed, `${at}: Chinese text in the English deck: ${text.slice(0, 50)}`);
        if (LEAK.test(text)) add(seed, `${at}: leaked value in ${text.slice(0, 60)}`);
        if (DOUBLE_SIGN.test(text)) add(seed, `${at}: unparenthesised negative in ${text.slice(0, 80)}`);
      }
      for (const text of textOf(other)) {
        if (MIXED.test(text)) add(seed, `${at}: English / 中文 mixed string in zh deck: ${text.slice(0, 60)}`);
        if (LEAK.test(text)) add(seed, `${at}: leaked value in zh ${text.slice(0, 60)}`);
        if (CJK.test(text) && ENGLISH_WORD.test(text)) add(seed, `${at}: untranslated English word in zh text: ${text.slice(0, 70)}`);
        if (DOUBLE_SIGN.test(text)) add(seed, `${at}: unparenthesised negative in zh ${text.slice(0, 80)}`);
      }
      if (!other.prompt.trim()) add(seed, `${at}: empty zh prompt`);
      if (card.fields) {
        if (!other.fields || other.fields.length !== card.fields.length) add(seed, `${at}: zh field count differs`);
        card.fields.forEach((field, k) => {
          if (!Number.isFinite(field.answer)) add(seed, `${at}: non-finite answer`);
          if (Math.abs(field.answer) > 1e6) add(seed, `${at}: answer ${field.answer} beyond arithmetic bound`);
          if (!field.label.trim()) add(seed, `${at}: empty field label`);
          if (field.tolerance !== undefined && !(field.tolerance > 0)) add(seed, `${at}: tolerance must be positive`);
          if (other.fields?.[k] && (other.fields[k].answer !== field.answer || other.fields[k].tolerance !== field.tolerance)) add(seed, `${at}: EN/ZH answers differ`);
        });
      }
      if (card.choice) {
        const { options, answer, figures } = card.choice;
        if (options.length < 2) add(seed, `${at}: fewer than 2 options`);
        if (!(answer >= 0 && answer < options.length)) add(seed, `${at}: answer index out of range`);
        if (new Set(options).size !== options.length) add(seed, `${at}: duplicate options`);
        if (!other.choice || other.choice.options.length !== options.length || other.choice.answer !== answer) add(seed, `${at}: EN/ZH choice structure differs`);
        if (figures && figures.length !== options.length) add(seed, `${at}: figures/options length mismatch`);
        if (figures && new Set(figures.map(f => JSON.stringify(f?.shapes))).size !== options.length) add(seed, `${at}: two option figures are identical`);
      }
      if (card.slots) {
        const { answers, tokens } = card.slots;
        for (const a of answers) if (!tokens.includes(a)) add(seed, `${at}: answer token "${a}" is not selectable`);
        if (new Set(tokens).size < answers.length) add(seed, `${at}: too few distinct tokens`);
        if (!other.slots || JSON.stringify(other.slots.answers) !== JSON.stringify(answers)) add(seed, `${at}: EN/ZH slot answers differ`);
      }
      const figs: [Figure | undefined, Figure | undefined][] = [[card.figure, other.figure], ...(card.choice?.figures ?? []).map((f, k): [Figure | undefined, Figure | undefined] => [f, other.choice?.figures?.[k]])];
      for (const [a, b] of figs) {
        if (!a && !b) continue;
        if (!a || !b) { add(seed, `${at}: figure missing in one language`); continue; }
        for (const p of figureProblems(a)) add(seed, `${at}: figure ${p}`);
        if (a.shapes.length !== b.shapes.length) add(seed, `${at}: EN/ZH figure shapes differ`);
      }
      if (card.audit) {
        if (!card.audit.kind.startsWith(`${id}:`)) add(seed, `${at}: audit kind must start with "${id}:"`);
        const visible = numbersIn(questionTextOf(card));
        const flat = Object.entries(card.audit.params).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map(x => [k, x] as const));
        for (const [k, x] of flat) {
          if (!Number.isFinite(x)) add(seed, `${at}: audit param ${k} is not finite`);
          else if (!visible.has(Math.abs(Number(x.toFixed(6))))) add(seed, `${at}: audit param ${k}=${x} is not visible in the question (hidden input)`);
        }
      }
    });
  }
  if (distinct.size < Math.min(seeds, 20)) problems.push(`${id}: only ${distinct.size} distinct decks in ${seeds} seeds`);
  return problems;
}

/**
 * Typography lint for rendered text (found by reading decks of games 36-50). Not part of `deckProblems` yet because older batches
 * have not been scanned with it. Each pattern is a symptom of a template that glued a sampled value to its neighbour.
 */
const TEXT_LINTS: [name: string, pattern: RegExp][] = [
  // "1x²y", "1cos t", "1(x² + y²)": a coefficient 1 that should have been omitted. Digits, a dot, a letter or ^ before it mean it is part of another number or name.
  ['explicit coefficient 1', /(?<![\d.,A-Za-z^_{/])1(?=[a-zA-Zπθρ(])(?!st\b|th\b)/],
  ['exponent 1 ("x^1")', /(?<=[A-Za-z)\]])\^\{?1\}?(?![\d.])/],
  ['ASCII caret power ("x^2"): use a superscript digit', /(?<=[A-Za-z])\^\d/],
  ['"1 times", "1 arrows": plural after one', /(?<![\d.])1 (?:times|arrows|points|circles|crossings|sides|units|curves|loops|paths|terms|values)\b/],
  ['placeholder or identifier leak', /(?<![_^])\{[A-Za-z0-9_·+*\-/ ]{1,12}\}|\b[a-z]{1,3}[A-Z]{2,}\b|\$\{|\bparams?\.|=>/],
  ['double parentheses around a coordinate ("((−4), 0)")', /\(\(−?\d+(?:\.\d+)?\),|, \(−?\d+(?:\.\d+)?\)\)/],
  ['ASCII hyphen used as a minus sign (use "−", e.g. via num() or par())', /[(,] ?-\d|[=≈] -\d/],
  ['raw floating-point number', /\d\.\d{8,}/],
  ['unevaluated product "2π2"', /π\d(?![\d.²³⁴])/],
  ['ZH "Green" instead of 格林', /Green 定理|Green定理/],
];
/** "a/b = c" and "a·b = c" between plain numbers must be true (catches "3a/8" printed as "31/8 = 0.375"). */
const DIVISION = /(?<=(?:^|[=≈:] ))(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?) = (-?\d+(?:\.\d+)?)(?![\d\w/·π]|\.\d)/g;
const PRODUCT = /(?<=(?:^|[=≈:] ))(-?\d+(?:\.\d+)?)·(-?\d+(?:\.\d+)?) = (-?\d+(?:\.\d+)?)(?![\d\w/·π]|\.\d)/g;
function arithmeticSlips(text: string): string[] {
  const slips: string[] = [];
  const t = text.replaceAll('−', '-');
  for (const m of t.matchAll(DIVISION)) { const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]; if (b !== 0 && Math.abs(a / b - c) > 1e-5 * Math.max(1, Math.abs(c))) slips.push(m[0]); }
  for (const m of t.matchAll(PRODUCT)) { const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]; if (Math.abs(a * b - c) > 1e-5 * Math.max(1, Math.abs(c))) slips.push(m[0]); }
  return slips;
}
export function textLintProblems(id: string, generate: CardGenerator, seeds = 200): string[] {
  const hits = new Map<string, string>();
  for (let index = 0; index < seeds; index++) {
    const seed = spreadSeed(index);
    for (const lang of ['en', 'zh'] as const) for (const card of generate(seed, lang))
      for (const text of textOf(card)) for (const [name, pattern] of TEXT_LINTS) {
        const m = pattern.exec(text);
        if (m) { const key = `${card.id} [${lang}] ${name}`; if (!hits.has(key)) hits.set(key, `…${text.slice(Math.max(0, m.index - 25), m.index + 35).replaceAll('\n', ' ')}…`); }
      }
    for (const card of generate(seed, 'en')) {
      // the card asks for an integer or a fraction, so its explanation must not end in a rounded decimal
      if (card.fields && /integer or a fraction|or a fraction|a fraction/.test(card.prompt) && /\d\.\d{5,}/.test(card.explanation)) { const key = `${card.id} [en] decimal in the explanation of a fraction answer`; if (!hits.has(key)) hits.set(key, `…${card.explanation.slice(-70)}`); }
    }
    for (const card of generate(seed, 'en')) for (const text of textOf(card)) {
      const slips = arithmeticSlips(text);
      if (slips.length) { const key = `${card.id} [en] false arithmetic`; if (!hits.has(key)) hits.set(key, `…${slips[0]}… in ${text.slice(0, 60)}`); }
    }
  }
  return [...hits].map(([key, sample]) => `${key}: ${sample}`);
}
