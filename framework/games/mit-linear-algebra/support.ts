import { seededRandom, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';

/** Text tuples are [English, Simplified Chinese]. Shared generators stay pure. */
export type Text = string | readonly [string, string];
export type GeneratorMap = Record<string, CardGenerator>;
export type FieldSpec = readonly [Text, number, number?];

export function makeDeck(seed: number, lang: GameLanguage, prefix: string) {
  const random = seededRandom(seed);
  const t = (value: Text): string => typeof value === 'string' ? value : value[lang === 'zh' ? 1 : 0];
  const base = (id: string, title: Text, prompt: Text, hint: Text, explanation: Text, lines?: Text[]) => ({
    id: `${prefix}-${id}`, title: t(title), prompt: t(prompt), hint: t(hint), explanation: t(explanation),
    ...(lines ? { lines: lines.map(t) } : {}),
  });
  const number = (id: string, title: Text, prompt: Text, fields: FieldSpec[], hint: Text, explanation: Text, lines?: Text[]): PracticeCard => ({
    ...base(id, title, prompt, hint, explanation, lines),
    fields: fields.map(([label, answer, tolerance]) => ({ label: t(label), answer, ...(tolerance === undefined ? {} : { tolerance }) })),
  });
  const choice = (id: string, title: Text, prompt: Text, options: Text[], correct: number, hint: Text, explanation: Text, lines?: Text[]): PracticeCard => {
    const shuffled = options.map((option, index) => ({ label: t(option), correct: index === correct }));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = random(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return { ...base(id, title, prompt, hint, explanation, lines), choice: { options: shuffled.map(o => o.label), answer: shuffled.findIndex(o => o.correct) } };
  };
  const symbols = (id: string, title: Text, prompt: Text, before: Text, answers: string[], tokens: string[], hint: Text, explanation: Text, between?: string[]): PracticeCard => ({
    ...base(id, title, prompt, hint, explanation), slots: { before: t(before), answers, tokens, between },
  });
  return { random, t, number, choice, symbols };
}
