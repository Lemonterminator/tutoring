import { displayLang } from './state';

export type Bi = { en: string; fi: string };

export const ui = {
  syllabus: { en: 'In the syllabus', fi: 'Opetussuunnitelmassa' },
  beyond: { en: 'Beyond the syllabus · you will meet this at university', fi: 'Oppimäärän ulkopuolelta · tulee vastaan yliopistossa' },
  examTip: { en: 'Exam technique', fi: 'Koetekniikka' },
  practice: { en: 'Practice', fi: 'Harjoitus' },
  check: { en: 'Check', fi: 'Tarkista' },
  correct: { en: 'Correct!', fi: 'Oikein!' },
  tryAgain: { en: 'Not yet. Try again or open the hint.', fi: 'Ei vielä. Yritä uudelleen tai avaa vihje.' },
  hint: { en: 'Hint', fi: 'Vihje' },
  solution: { en: 'Solution', fi: 'Ratkaisu' },
  answerPlaceholder: { en: 'Your answer', fi: 'Vastauksesi' },
  ask: { en: 'Ask about this', fi: 'Kysy tästä' },
  copied: { en: 'Copied. Paste it into our chat.', fi: 'Kopioitu. Liitä se keskusteluumme.' },
  copyFailed: { en: 'Could not copy. Take a screenshot instead.', fi: 'Kopiointi ei onnistunut. Ota kuvakaappaus.' },
  examMode: { en: 'Exam mode (Finnish only)', fi: 'Koetila (vain suomeksi)' },
  language: { en: 'Language', fi: 'Kieli' },
  contents: { en: 'Contents', fi: 'Sisältö' },
  glossary: { en: 'Glossary', fi: 'Sanasto' },
} satisfies Record<string, Bi>;

export type UiKey = keyof typeof ui;

export function tr(key: UiKey): string {
  return ui[key][displayLang.value];
}

export function pick(text: Bi): string {
  return text[displayLang.value];
}
