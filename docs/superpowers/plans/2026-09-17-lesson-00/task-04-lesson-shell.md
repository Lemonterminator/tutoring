### Task 4: Lesson page shell

**Files:**
- Create: `framework/components.ts`, `framework/layout/Lesson.tsx`
- Create: `subjects/math/00-wave-math-foundations/meta.json`, `terms.json` (empty for now), `lesson.fi.mdx` (temporary copy)
- Modify: `subjects/math/00-wave-math-foundations/main.tsx` (replace the Task 1 version)
- Test: `framework/layout/Lesson.test.tsx`

**Interfaces:**
- Consumes: `displayLang`, `examMode`, `lang`, `setLang`, `setExamMode` (Task 2); `tr` (Task 2); `LessonContext`, `InertContext`, `LessonMeta` (Task 2); `Term` (Task 2); `Syllabus`, `Beyond`, `ExamTip` (Task 3); `TermDict` (Task 2).
- Produces: `frameworkComponents` — the object passed as `components` to every MDX body. Tasks 5 and 6 add entries.
- Produces: `<Lesson meta En Fi terms />` where `En`/`Fi` are MDX components. Renders `header.topbar`, `nav.toc` (from `article h2[id]`), `article.lesson`, `section#glossary`; in exam mode an inert off-screen English copy `div.shadow-en` and a hover tooltip `div.en-tip`.

- [ ] **Step 1: Write the failing test**

`framework/layout/Lesson.test.tsx`:

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setExamMode, setLang } from '../i18n/state';
import { Lesson } from './Lesson';

type BodyProps = { components?: Record<string, any> };

const En = ({ components = {} }: BodyProps) => {
  const { Syllabus } = components;
  return (
    <>
      <h2 id="sec-0" data-b="0">Hello</h2>
      <p data-b="1">English text</p>
      <Syllabus>
        <p data-b="2">Box</p>
      </Syllabus>
    </>
  );
};
const Fi = () => (
  <>
    <h2 id="sec-0" data-b="0">Hei</h2>
    <p data-b="1">Suomenkielinen teksti</p>
  </>
);
const meta = { id: 'math-test', subject: 'math' as const, title: { en: 'Test lesson', fi: 'Testitunti' } };
const terms = { wave: { en: 'wave', fi: 'aalto' } };

afterEach(() => {
  cleanup();
  setLang('en');
  setExamMode(false);
});

test('renders the English body, a table of contents and the glossary', () => {
  const { container } = render(<Lesson meta={meta} En={En} Fi={Fi} terms={terms} />);
  expect(container.querySelector('article h1')?.textContent).toBe('Test lesson');
  expect(container.querySelector('.toc li a')?.getAttribute('href')).toBe('#sec-0');
  expect(container.querySelector('.box--syllabus')).not.toBeNull();
  expect(container.querySelector('.glossary dt')?.textContent).toBe('aalto');
});

test('switching to Finnish swaps the body and the document language', () => {
  render(<Lesson meta={meta} En={En} Fi={Fi} terms={terms} />);
  act(() => setLang('fi'));
  expect(screen.getByText('Suomenkielinen teksti')).toBeTruthy();
  expect(document.documentElement.lang).toBe('fi');
});

test('in exam mode hovering a Finnish block shows the matching English block', () => {
  render(<Lesson meta={meta} En={En} Fi={Fi} terms={terms} />);
  act(() => setExamMode(true));
  fireEvent.mouseOver(screen.getByText('Suomenkielinen teksti'));
  expect(document.querySelector('.en-tip')?.textContent).toBe('English text');
  expect(screen.getByRole('button', { name: 'EN' }).hasAttribute('disabled')).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run framework/layout`
Expected: FAIL — cannot resolve `./Lesson`.

- [ ] **Step 3: Implement the registry and the shell**

`framework/components.ts`:

```ts
import { Beyond, ExamTip, Syllabus } from './blocks/Blocks';
import { Term } from './i18n/Term';

/** Components every lesson body can use without importing them. */
export const frameworkComponents = { Term, Syllabus, Beyond, ExamTip };
```

`framework/layout/Lesson.tsx`:

```tsx
import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { frameworkComponents } from '../components';
import { displayLang, examMode, lang, setExamMode, setLang } from '../i18n/state';
import type { TermDict } from '../i18n/terms';
import { tr } from '../i18n/ui';
import { InertContext, LessonContext, type LessonMeta } from './LessonContext';

type MdxBody = ComponentType<{ components?: Record<string, unknown> }>;
export type LessonProps = { meta: LessonMeta; En: MdxBody; Fi: MdxBody; terms: TermDict };
type TocItem = { id: string; text: string };
type Tip = { html: string; top: number; left: number };

export function Lesson({ meta, En, Fi, terms }: LessonProps) {
  const shown = displayLang.value;
  const exam = examMode.value;
  const Body = shown === 'fi' ? Fi : En;
  const articleRef = useRef<HTMLElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    document.documentElement.lang = shown;
    document.title = meta.title[shown];
    const headings = articleRef.current?.querySelectorAll('h2[id]') ?? [];
    setToc(Array.from(headings, (h) => ({ id: h.id, text: h.textContent ?? '' })));
  }, [shown]);

  function showEnglishFor(event: MouseEvent) {
    if (!exam) return;
    const block = (event.target as Element).closest?.('[data-b]');
    const source = block && shadowRef.current?.querySelector(`[data-b="${block.getAttribute('data-b')}"]`);
    if (!block || !source) {
      setTip(null);
      return;
    }
    const rect = block.getBoundingClientRect();
    setTip({ html: source.innerHTML, top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
  }

  const glossary = Object.entries(terms).sort(([, a], [, b]) => a.fi.localeCompare(b.fi, 'fi'));

  return (
    <LessonContext.Provider value={{ meta, terms }}>
      <header class="topbar">
        <div class="topbar__title">{meta.title[shown]}</div>
        <div class="topbar__controls">
          <div class="seg" role="group" aria-label={tr('language')}>
            <button type="button" aria-pressed={lang.value === 'en'} disabled={exam} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang.value === 'fi'} disabled={exam} onClick={() => setLang('fi')}>
              FI
            </button>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={exam}
              onChange={(e) => {
                setExamMode((e.target as HTMLInputElement).checked);
                setTip(null);
              }}
            />
            {tr('examMode')}
          </label>
        </div>
      </header>

      <div class="page">
        <nav class="toc" aria-label={tr('contents')}>
          <div class="toc__head">{tr('contents')}</div>
          <ol>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ol>
          <a href="#glossary">{tr('glossary')}</a>
        </nav>

        <main>
          <article ref={articleRef} class="lesson" onMouseOver={showEnglishFor} onMouseLeave={() => setTip(null)}>
            <h1>{meta.title[shown]}</h1>
            <Body components={frameworkComponents} />
          </article>
          <section id="glossary" class="glossary">
            <h2>{tr('glossary')}</h2>
            <dl>
              {glossary.map(([id, t]) => (
                <div key={id} class="glossary__row">
                  <dt>{t.fi}</dt>
                  <dd>{t.en}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </div>

      {exam && (
        <InertContext.Provider value={true}>
          <div ref={shadowRef} class="shadow-en" aria-hidden="true">
            <En components={frameworkComponents} />
          </div>
        </InertContext.Provider>
      )}
      {tip && (
        <div class="en-tip" style={{ top: `${tip.top}px`, left: `${tip.left}px` }} dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </LessonContext.Provider>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run framework/layout`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the real lesson entry**

`subjects/math/00-wave-math-foundations/meta.json`:

```json
{
  "id": "math-00-wave-math-foundations",
  "subject": "math",
  "title": {
    "en": "Module 0: The math behind waves",
    "fi": "Moduuli 0: Aaltojen matemaattinen perusta"
  }
}
```

`subjects/math/00-wave-math-foundations/terms.json`:

```json
{}
```

Copy the temporary English body so the entry compiles (Task 12 rewrites both files):

```bash
cp subjects/math/00-wave-math-foundations/lesson.en.mdx subjects/math/00-wave-math-foundations/lesson.fi.mdx
```

`subjects/math/00-wave-math-foundations/main.tsx`:

```tsx
import { render } from 'preact';
import '../../../framework/theme/index.css';
import { Lesson } from '../../../framework/layout/Lesson';
import type { LessonMeta } from '../../../framework/layout/LessonContext';
import En from './lesson.en.mdx';
import Fi from './lesson.fi.mdx';
import meta from './meta.json';
import terms from './terms.json';

render(<Lesson meta={meta as LessonMeta} En={En} Fi={Fi} terms={terms} />, document.getElementById('app')!);
```

- [ ] **Step 6: Build and look at it**

Run: `npm run build`
Expected: `✔ dist/math-00-wave-math-foundations.html`. Open it via `file://` in the browser pane: the top bar shows EN/FI and exam mode, the "Hello" heading appears in the table of contents, no console errors.

- [ ] **Step 7: Commit**

```bash
git add framework/components.ts framework/layout subjects
git commit -m "feat: lesson shell with TOC, glossary and exam-mode English hover"
```
