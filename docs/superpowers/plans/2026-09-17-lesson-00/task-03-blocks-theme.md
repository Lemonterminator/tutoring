### Task 3: Content boxes and theme

**Files:**
- Create: `framework/blocks/Blocks.tsx`, `framework/theme/index.css`
- Test: `framework/blocks/Blocks.test.tsx`

**Interfaces:**
- Consumes: `tr` from `framework/i18n/ui.ts`; `setLang` from `framework/i18n/state.ts`.
- Produces: `Syllabus`, `Beyond`, `ExamTip` — each `({ children }) => aside.box.box--<kind>[data-kind]` with `.box__label` and `.box__body`. Kinds: `syllabus`, `beyond`, `exam`.
- Produces: CSS tokens used by all later tasks: `--bg --surface --text --muted --border --grid --axis --accent --accent-2 --accent-3 --warn --on-accent --syllabus(-bg) --beyond(-bg) --exam(-bg) --radius --measure --font`; classes `.topbar .page .toc .lesson .glossary .box .figure .sim .sim__title .sim__hint .sim-canvas .controls .controls--stack .btn .btn--ghost .seg .switch .check .slider .readout .readout--active .quiz* .choice* .ask* .bars .bar* .cascade .shadow-en .en-tip .term*`.

- [ ] **Step 1: Write the failing test**

`framework/blocks/Blocks.test.tsx`:

```tsx
import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../i18n/state';
import { Beyond, ExamTip, Syllabus } from './Blocks';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('each box has its own kind and translated label', () => {
  const { container } = render(
    <>
      <Syllabus>a</Syllabus>
      <Beyond>b</Beyond>
      <ExamTip>c</ExamTip>
    </>,
  );
  const kinds = Array.from(container.querySelectorAll('aside.box'), (el) => el.getAttribute('data-kind'));
  expect(kinds).toEqual(['syllabus', 'beyond', 'exam']);
  expect(container.querySelector('.box--syllabus .box__label')?.textContent).toContain('In the syllabus');

  act(() => setLang('fi'));
  expect(container.querySelector('.box--syllabus .box__label')?.textContent).toContain('Opetussuunnitelmassa');
  expect(container.querySelector('.box--exam .box__body')?.textContent).toBe('c');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run framework/blocks`
Expected: FAIL — cannot resolve `./Blocks`.

- [ ] **Step 3: Implement the boxes**

`framework/blocks/Blocks.tsx`:

```tsx
import type { ComponentChildren } from 'preact';
import { tr } from '../i18n/ui';

type BoxProps = { kind: 'syllabus' | 'beyond' | 'exam'; icon: string; label: string; children?: ComponentChildren };

function Box({ kind, icon, label, children }: BoxProps) {
  return (
    <aside class={`box box--${kind}`} data-kind={kind}>
      <div class="box__label">
        <span aria-hidden="true">{icon}</span> {label}
      </div>
      <div class="box__body">{children}</div>
    </aside>
  );
}

type Props = { children?: ComponentChildren };

export const Syllabus = ({ children }: Props) => (
  <Box kind="syllabus" icon="📘" label={tr('syllabus')}>
    {children}
  </Box>
);

export const Beyond = ({ children }: Props) => (
  <Box kind="beyond" icon="🎓" label={tr('beyond')}>
    {children}
  </Box>
);

export const ExamTip = ({ children }: Props) => (
  <Box kind="exam" icon="🎯" label={tr('examTip')}>
    {children}
  </Box>
);
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run framework/blocks`
Expected: PASS (1 test).

- [ ] **Step 5: Write the theme**

`framework/theme/index.css`:

```css
:root {
  --bg: #fbfaf7;
  --surface: #ffffff;
  --text: #1d2330;
  --muted: #5d6675;
  --border: #e3e0d8;
  --grid: #efece6;
  --axis: #9aa2ae;
  --accent: #2f6fdb;
  --accent-2: #d9480f;
  --accent-3: #2b8a3e;
  --warn: #c2255c;
  --on-accent: #ffffff;
  --syllabus: #2f6fdb;
  --syllabus-bg: #edf3fd;
  --beyond: #7048e8;
  --beyond-bg: #f3effe;
  --exam: #b35c00;
  --exam-bg: #fff4e3;
  --radius: 10px;
  --measure: 46rem;
  --font: "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161b;
    --surface: #1c1f26;
    --text: #e7e9ee;
    --muted: #9aa3b2;
    --border: #2d313a;
    --grid: #22252c;
    --axis: #5c6370;
    --accent: #6ea0ff;
    --accent-2: #ff8a4c;
    --accent-3: #5fcf7a;
    --warn: #ff6b9d;
    --on-accent: #0b1220;
    --syllabus: #6ea0ff;
    --syllabus-bg: #1a2433;
    --beyond: #a98bff;
    --beyond-bg: #221d33;
    --exam: #ffb347;
    --exam-bg: #2e2416;
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 18px; line-height: 1.65; }
a { color: var(--accent); }

/* page shell */
.topbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.6rem 1.25rem; background: var(--surface); border-bottom: 1px solid var(--border); }
.topbar__title { font-weight: 600; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topbar__controls { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; font-size: 0.9rem; }
.page { display: grid; grid-template-columns: 14rem minmax(0, var(--measure)); gap: 2.5rem; justify-content: center; padding: 2rem 1.25rem 4rem; }
.toc { position: sticky; top: 4.5rem; align-self: start; font-size: 0.9rem; }
.toc__head { font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.75rem; color: var(--muted); }
.toc ol { list-style: none; padding: 0; margin: 0.5rem 0 1rem; }
.toc li { margin: 0.35rem 0; }
.toc a { color: var(--muted); text-decoration: none; }
.toc a:hover { color: var(--accent); }
main { min-width: 0; }
@media (max-width: 900px) {
  .page { grid-template-columns: minmax(0, 1fr); padding: 1.25rem 1rem 3rem; }
  .toc { display: none; }
  body { font-size: 17px; }
}

/* lesson text */
.lesson h1 { font-size: 2.1rem; line-height: 1.2; margin: 0 0 1.5rem; }
.lesson h2 { font-size: 1.5rem; line-height: 1.3; margin: 3rem 0 1rem; padding-top: 1rem; border-top: 1px solid var(--border); scroll-margin-top: 4.5rem; }
math { font-size: 1.08em; }
math[display="block"] { margin: 1rem 0; overflow-x: auto; max-width: 100%; }
.term strong { font-weight: 600; }
.term__alt { color: var(--muted); font-size: 0.88em; font-style: italic; }
.term[title] { text-decoration: underline dotted; cursor: help; }
.term--missing { outline: 2px dashed var(--warn); }

/* syllabus / beyond / exam boxes */
.box { margin: 1.25rem 0; padding: 0.75rem 1rem; border-left: 4px solid; border-radius: 0 var(--radius) var(--radius) 0; }
.box__label { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.box__body > :first-child { margin-top: 0.25rem; }
.box__body > :last-child { margin-bottom: 0; }
.box--syllabus { border-color: var(--syllabus); background: var(--syllabus-bg); }
.box--syllabus .box__label { color: var(--syllabus); }
.box--beyond { border-color: var(--beyond); background: var(--beyond-bg); }
.box--beyond .box__label { color: var(--beyond); }
.box--exam { border-color: var(--exam); background: var(--exam-bg); }
.box--exam .box__label { color: var(--exam); }

/* figures and controls */
.figure { margin: 1.75rem 0; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.sim-canvas { display: block; width: 100%; touch-action: none; border-radius: 6px; }
.sim__title { font-weight: 600; margin: 0.25rem 0 0.5rem; }
.sim__title + .controls { margin-top: 0; }
.sim__hint { font-size: 0.85rem; color: var(--muted); margin: 0.5rem 0 0; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem; margin-top: 0.75rem; }
.controls--stack { flex-direction: column; align-items: flex-start; }
.btn { font: inherit; font-size: 0.9rem; padding: 0.35rem 0.9rem; border-radius: 999px; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); cursor: pointer; }
.btn--ghost { background: transparent; color: var(--accent); }
.btn:focus-visible, .seg button:focus-visible, .choice:focus-visible, .slider input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
.seg button { font: inherit; font-size: 0.85rem; padding: 0.3rem 0.8rem; border: 0; background: transparent; color: var(--text); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
.seg button:disabled { opacity: 0.5; cursor: not-allowed; }
.switch, .check { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.9rem; }
.slider { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; font-size: 0.9rem; }
.slider input { width: 12rem; accent-color: var(--accent); }
.slider__value { font-variant-numeric: tabular-nums; min-width: 6rem; }
.readout { font-variant-numeric: tabular-nums; font-size: 0.9rem; color: var(--muted); }
.readout--active { color: var(--text); font-weight: 600; }
.ask { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; font-size: 0.85rem; }
.ask__status { color: var(--muted); }

/* decibel figure */
.bars { display: grid; gap: 1.2rem; margin: 0.75rem 0 1.5rem; }
.bar { display: grid; grid-template-columns: 10rem 1fr; align-items: center; gap: 0.75rem; font-size: 0.85rem; }
.bar__track { position: relative; height: 1.4rem; background: var(--grid); border-radius: 4px; }
.bar__fill { height: 100%; background: var(--accent-2); border-radius: 4px; }
.bar__fill--db { background: var(--accent); }
.bar__tick { position: absolute; top: 100%; transform: translateX(-50%); font-size: 0.7rem; color: var(--muted); }
.cascade { display: block; width: 100%; height: auto; margin-top: 0.75rem; }
@media (max-width: 600px) { .bar { grid-template-columns: 1fr; } }

/* quizzes */
.quiz { margin: 1.5rem 0; padding: 1rem 1.1rem; border: 1px dashed var(--border); border-radius: var(--radius); background: var(--surface); }
.quiz__label { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.quiz__row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.quiz__input { font: inherit; width: 9rem; padding: 0.3rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
.quiz__choices { display: flex; flex-direction: column; gap: 0.4rem; }
.choice { font: inherit; text-align: left; padding: 0.45rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); cursor: pointer; }
.choice--correct { border-color: var(--accent-3); background: color-mix(in srgb, var(--accent-3) 15%, transparent); }
.choice--wrong { border-color: var(--warn); background: color-mix(in srgb, var(--warn) 12%, transparent); }
.quiz__feedback--correct { color: var(--accent-3); font-weight: 600; }
.quiz__feedback--wrong { color: var(--warn); }
details { margin-top: 0.5rem; }
summary { cursor: pointer; color: var(--accent); font-size: 0.9rem; }

/* glossary and exam-mode hover */
.glossary { margin-top: 3rem; }
.glossary dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.25rem 1.5rem; }
.glossary__row { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border); padding: 0.25rem 0; font-size: 0.92rem; }
.glossary dt { font-weight: 600; }
.glossary dd { margin: 0; color: var(--muted); }
.shadow-en { position: absolute; left: -99999px; top: 0; width: 40rem; visibility: hidden; }
.en-tip { position: absolute; z-index: 20; max-width: min(34rem, calc(100vw - 2rem)); padding: 0.6rem 0.8rem; background: var(--text); color: var(--bg); border-radius: 8px; font-size: 0.88rem; line-height: 1.5; box-shadow: 0 6px 24px rgb(0 0 0 / 0.2); pointer-events: none; }
.en-tip > * { margin: 0; }
```

- [ ] **Step 6: Commit**

```bash
git add framework/blocks framework/theme
git commit -m "feat: syllabus/beyond/exam boxes and theme tokens"
```
