### Task 2: Language state and bilingual terms

**Files:**
- Create: `framework/i18n/state.ts`, `framework/i18n/ui.ts`, `framework/i18n/terms.ts`, `framework/i18n/Term.tsx`, `framework/layout/LessonContext.ts`
- Test: `framework/i18n/state.test.ts`, `framework/i18n/terms.test.ts`, `framework/i18n/Term.test.tsx`

**Interfaces:**
- Produces (`state.ts`): `type Lang = 'en' | 'fi'`; signals `lang`, `examMode`, computed `displayLang` (`'fi'` whenever exam mode is on); `setLang(next: Lang): void`; `setExamMode(on: boolean): void`. Storage key `tutoring.lang`.
- Produces (`ui.ts`): `type Bi = { en: string; fi: string }`; `ui` dictionary; `type UiKey`; `tr(key: UiKey): string`; `pick(text: Bi): string` — both read `displayLang`.
- Produces (`terms.ts`): `type TermEntry = { en: string; fi: string }`; `type TermDict = Record<string, TermEntry>`; `termView(entry, lang, exam): { secondary: string | null; hover: string | null }`.
- Produces (`LessonContext.ts`): `type LessonMeta = { id: string; subject: 'math' | 'physics' | 'chemistry'; title: Bi }`; `LessonContext` (`{ meta, terms }`); `InertContext` (boolean, default `false`).
- Produces (`Term.tsx`): `<Term id="…">surface text</Term>`; root `span.term[data-term]`, alternate form in `span.term__alt`, unknown id → `span.term.term--missing`.

- [ ] **Step 1: Write the failing tests**

`framework/i18n/state.test.ts`:

```ts
import { afterEach, expect, test } from 'vitest';
import { displayLang, examMode, lang, setExamMode, setLang } from './state';

afterEach(() => {
  setLang('en');
  setExamMode(false);
});

test('exam mode forces Finnish without forgetting the chosen language', () => {
  setLang('en');
  setExamMode(true);
  expect(displayLang.value).toBe('fi');
  expect(lang.value).toBe('en');
  setExamMode(false);
  expect(displayLang.value).toBe('en');
  expect(examMode.value).toBe(false);
});

test('setLang remembers the choice when storage works', () => {
  setLang('fi');
  expect(localStorage.getItem('tutoring.lang')).toBe('fi');
});
```

`framework/i18n/terms.test.ts`:

```ts
import { expect, test } from 'vitest';
import { termView } from './terms';

const entry = { en: 'frequency', fi: 'taajuus' };

test('English mode adds the Finnish base form', () => {
  expect(termView(entry, 'en', false)).toEqual({ secondary: 'taajuus', hover: null });
});

test('Finnish mode adds the English base form', () => {
  expect(termView(entry, 'fi', false)).toEqual({ secondary: 'frequency', hover: null });
});

test('exam mode shows no bracket and puts English on hover', () => {
  expect(termView(entry, 'en', true)).toEqual({ secondary: null, hover: 'frequency' });
});
```

`framework/i18n/Term.test.tsx`:

```tsx
import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { LessonContext } from '../layout/LessonContext';
import { setExamMode, setLang } from './state';
import { Term } from './Term';

const ctx = {
  meta: { id: 'x', subject: 'math' as const, title: { en: 'X', fi: 'X' } },
  terms: { frequency: { en: 'frequency', fi: 'taajuus' } },
};

function view(id: string, surface: string) {
  return render(
    <LessonContext.Provider value={ctx}>
      <Term id={id}>{surface}</Term>
    </LessonContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  setLang('en');
  setExamMode(false);
});

test('English mode shows the Finnish base form in brackets', () => {
  expect(view('frequency', 'frequency').container.textContent).toBe('frequency (taajuus)');
});

test('Finnish mode keeps the inflected surface text and adds English', () => {
  act(() => setLang('fi'));
  expect(view('frequency', 'taajuuden').container.textContent).toBe('taajuuden (frequency)');
});

test('exam mode hides English except on hover', () => {
  act(() => setExamMode(true));
  const { container } = view('frequency', 'taajuuden');
  expect(container.textContent).toBe('taajuuden');
  expect(container.querySelector('.term')?.getAttribute('title')).toBe('frequency');
});

test('an unknown id is visibly flagged', () => {
  expect(view('nope', 'x').container.querySelector('.term--missing')).not.toBeNull();
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run framework/i18n`
Expected: FAIL — modules `./state`, `./terms`, `./Term`, `../layout/LessonContext` not found.

- [ ] **Step 3: Implement**

`framework/i18n/state.ts`:

```ts
import { computed, signal } from '@preact/signals';

export type Lang = 'en' | 'fi';

const STORAGE_KEY = 'tutoring.lang';

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'fi' ? 'fi' : 'en';
  } catch {
    return 'en';
  }
}

export const lang = signal<Lang>(readStoredLang());
export const examMode = signal(false);
/** The language actually shown: exam mode is always Finnish. */
export const displayLang = computed<Lang>(() => (examMode.value ? 'fi' : lang.value));

export function setLang(next: Lang): void {
  lang.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable for file:// pages or private windows; the choice just isn't remembered.
  }
}

export function setExamMode(on: boolean): void {
  examMode.value = on;
}
```

`framework/i18n/ui.ts`:

```ts
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
```

`framework/i18n/terms.ts`:

```ts
import type { Lang } from './state';

export type TermEntry = { en: string; fi: string };
export type TermDict = Record<string, TermEntry>;
export type TermView = { secondary: string | null; hover: string | null };

/** The surface text is always the author's inflected form; this decides what is added around it. */
export function termView(entry: TermEntry, lang: Lang, exam: boolean): TermView {
  if (exam) return { secondary: null, hover: entry.en };
  return { secondary: lang === 'en' ? entry.fi : entry.en, hover: null };
}
```

`framework/layout/LessonContext.ts`:

```ts
import { createContext } from 'preact';
import type { TermDict } from '../i18n/terms';
import type { Bi } from '../i18n/ui';

export type LessonMeta = { id: string; subject: 'math' | 'physics' | 'chemistry'; title: Bi };

export const LessonContext = createContext<{ meta: LessonMeta; terms: TermDict }>({
  meta: { id: 'unknown', subject: 'math', title: { en: '', fi: '' } },
  terms: {},
});

/** True inside the hidden English copy used for exam-mode hover; figures render as empty placeholders there. */
export const InertContext = createContext(false);
```

`framework/i18n/Term.tsx`:

```tsx
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { LessonContext } from '../layout/LessonContext';
import { examMode, lang } from './state';
import { termView } from './terms';

export function Term({ id, children }: { id: string; children?: ComponentChildren }) {
  const { terms } = useContext(LessonContext);
  const entry = terms[id];
  if (!entry) {
    return (
      <span class="term term--missing">
        {children} [?{id}]
      </span>
    );
  }
  const view = termView(entry, lang.value, examMode.value);
  return (
    <span class="term" data-term={id} title={view.hover ?? undefined}>
      <strong>{children}</strong>
      {view.secondary && <span class="term__alt"> ({view.secondary})</span>}
    </span>
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run framework/i18n`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add framework/i18n framework/layout
git commit -m "feat: language signals, ui strings and bilingual Term"
```
