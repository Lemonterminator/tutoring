# Interactive Lesson Framework — Design

Date: 2026-09-17 · Status: approved in brainstorming (sections 1–2), lesson 0 requested directly by the author.

## 1. Purpose

A reusable front-end framework for bilingual (EN/FI) interactive STEM lessons for international students in Finnish upper secondary school (lukio), aimed at mid-level students (grade ~7/10) heading for university STEM. Lessons are studied **alone, on a laptop**; the tutor does in-person Q&A. The first deliverable is **Module 0 — the math behind waves** (imaginary unit, Euler's formula, partial derivatives, logarithms), the prerequisite for the wave/acoustics modules built on Sanoma Pro Luku 14–15.

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Delivery | Source is structured for a future static site (C), but only single self-contained `.html` files (A) are built now. Double-click to open, offline, no server. |
| Subjects | Math, physics, chemistry. Heavy libraries (e.g. 3D) only enter the lessons that use them. |
| Usage | Self-study on a laptop is primary; phones must be readable, not optimised. |
| Q&A | "Ask about this" copies lesson + location + current simulation settings to the clipboard for WhatsApp/Discord. A swappable `AskProvider` interface reserves room for an in-page AI tutor later. |
| Multimodal | Pointer interaction (drag, sliders, buttons) and synthesized sound (Web Audio). No text-to-speech, no handwriting input. |
| Language | Global EN/FI switch + bilingual terms (`frequency (taajuus)`) + **exam mode**: everything Finnish, English only on hover. |
| Labels | Every non-core block is tagged: **Syllabus** (in the Finnish lukio curriculum), **Beyond** (not examined; you will meet it at university), **Exam tip** (technique for scoring points). |
| Stack | Vite + Preact + MDX (approach 1). |

## 3. Architecture

Three layers with one-way dependencies: `subjects → framework`, `scripts → framework/build`. The framework never imports a lesson.

```
tutoring/
├─ framework/
│  ├─ build/       mdx-options.ts, rehype-block-ids.ts   (shared by Vite, Vitest, check script)
│  ├─ i18n/        state.ts (signals), ui.ts (chrome strings, pick), terms.ts, Term.tsx
│  ├─ blocks/      Blocks.tsx  → Syllabus, Beyond, ExamTip
│  ├─ layout/      LessonContext.ts, Lesson.tsx (top bar, TOC, glossary, exam hover)
│  ├─ ask/         question.ts, provider.ts, AskButton.tsx, Figure.tsx
│  ├─ practice/    grade.ts, Quiz.tsx → NumericQuiz, ChoiceQuiz, Choice, Hint, Solution
│  ├─ interact/    format.ts, draw.ts, useAnimationFrame.ts, SimCanvas.tsx, Controls.tsx
│  ├─ audio/       decibel.ts, tone.ts
│  ├─ theme/       index.css (tokens, light/dark)
│  ├─ components.ts  registry passed to every MDX body
│  └─ types.d.ts
├─ subjects/<subject>/<NN-slug>/
│  ├─ index.html, main.tsx        entry (identical pattern for every lesson)
│  ├─ meta.json                   { id, subject, title: {en, fi} }
│  ├─ lesson.en.mdx               authored
│  ├─ lesson.fi.mdx               machine-translated, then spot-checked
│  ├─ terms.json                  { id: { en, fi } } base forms
│  └─ *.tsx / *.ts                lesson-specific simulations + pure math helpers
├─ scripts/  lessons.ts, check.ts, translate.ts, build-all.ts
└─ dist/     <subject>-<slug>.html
```

### 3.1 Bilingual rendering

- Both MDX bodies are compiled into the page. `displayLang = examMode ? 'fi' : lang` chooses which body renders.
- `rehype-block-ids` numbers every `p, h2, h3, li` in document order (`data-b="n"`) and gives each `h2` the id `sec-n`. Because EN and FI have the same structure, index *n* is the same block in both languages.
- In exam mode an inert English copy is rendered off-screen (simulations replaced by empty placeholders via `InertContext`). Hovering a Finnish block shows the English block with the same `data-b` in a tooltip.
- `<Term id="…">surface text</Term>`: the surface text is written in the body's language, so Finnish inflection stays correct (`taajuuden`). The component adds the other language's base form: EN mode `frequency (taajuus)`, FI mode `taajuuden (frequency)`, exam mode `taajuuden` with the English base form in `title`.
- Language preference is stored in `localStorage` inside `try/catch`; the page works identically when storage is unavailable.

### 3.2 Content labels

`<Syllabus>`, `<Beyond>`, `<ExamTip>` are MDX block components with a coloured left border, an icon and a translated label. Course codes are **not** shown until verified against LOPS 2021 (see §7).

### 3.3 Figures, state and Q&A

`<Figure id>` wraps a simulation, provides `useReportState()` so the simulation can publish its settings, and renders an `AskButton`. `buildQuestion(ctx)` produces:

```
Lesson: <English title> [<lesson id>]
Where: figure "<id>"
Language: EN|FI
Settings: key=value, …        (numbers to 3 significant digits; omitted if empty)

My question: 
```

`AskProvider = (text, ctx) => Promise<'copied' | 'failed'>`; default copies to clipboard (Clipboard API, then `execCommand` fallback).

### 3.4 Practice

`NumericQuiz` (answer, unit, `rel` default 0.02, `abs` default 0) accepts Finnish decimal commas and `e` notation. `ChoiceQuiz` (0-based `correct`). All human-readable text is MDX children (`Choice`, `Hint`, `Solution`) so translation never has to touch attributes. The solution appears only after an attempt.

### 3.5 Simulations and performance

- `SimCanvas` handles devicePixelRatio, resize, pointer capture and an animation loop that **stops when the canvas is off-screen** (IntersectionObserver) — several animated figures on one page cost nothing while scrolled away.
- Per-frame state lives in refs; Preact re-renders only for control changes (readouts throttled to ~7 Hz).
- Colours come from CSS variables, so canvases follow light/dark theme.
- Sound: one `OscillatorNode` + `GainNode`, gain hard-capped at 0.2, started only by a click (autoplay policy), smoothed with `setTargetAtTime`.

### 3.6 Build

- Math: `remark-math` + `rehype-katex` with `output: 'mathml'` — native browser MathML, no KaTeX CSS or fonts in the bundle.
- `vite-plugin-singlefile` inlines JS and CSS. One Vite build per lesson (`LESSON=<dir>`), copied to `dist/<subject>-<slug>.html`.
- `npm run build` = `check` then `build-all`. Budget: ≤ 1.5 MB per lesson file (expected ~150 KB).
- Future site target (not built now): same entries as a multi-page Vite build plus an index page.

### 3.7 Translation and checks

- `scripts/translate.ts <lessonDir>`: keeps import lines, splits the body at `## ` headings, sends each section with the glossary to local Ollama (`/api/chat`, default model `qwen3.6:35b-a3b`, `think: false`), retries a section once if its structure differs, writes `lesson.fi.mdx`.
- `scripts/check.ts`: for every lesson compares EN vs FI — block count, math node count, non-`Term` component sequence, import lines, and the multiset of `Term` ids — and requires every used term id to have `en` and `fi` in `terms.json`. Any issue fails the build.

## 4. Testing

- Vitest + jsdom + @testing-library/preact. Pure logic (grading, formatting, decibels, complex numbers, wave derivatives, question text, term view, structure comparison, prompt building) is unit-tested; components are tested for language switching, grading feedback, state reporting and readouts. Canvas drawing is verified manually.
- Manual acceptance per lesson: open the built file via `file://` in Chrome/Edge; no console errors; EN/FI switch; exam hover; every simulation reacts; sound starts/stops; animation pauses off-screen; dark mode readable; 375 px width has no horizontal page scroll.

## 5. Lesson 0 — Module 0: the math behind waves

Sections (each ends with a quiz):

1. **The imaginary unit is a quarter turn** — ×(−1) = half turn ⇒ ×i = quarter turn; complex plane. Figure `ComplexRotator` (drag z, animate ×i and ×(−1)). Beyond: complex numbers.
2. **Euler's formula** — circular motion ⇒ dz/dt = iωz ⇒ z = e^{iωt} = cos ωt + i sin ωt; "an oscillation is the shadow of a rotation". Figure `EulerCircle` (rotating phasor, velocity arrow, sine trace, ω slider). Beyond: proof idea and e^{−iωt} convention; phasors. Exam tip: radian mode.
3. **Partial derivatives** — y(x,t); freeze place (∂y/∂t), freeze time (∂y/∂x), bending (∂²y/∂x²) ⇒ bending causes acceleration. Figure `WaveSurface` (three modes, probe slider, time trace). Beyond: exact curvature formula.
4. **Logarithms turn multiplication into addition** — 10⁻¹²…1 W/m² → 0…120 dB; cascaded amplitude factors become stacked dB bars. Figure `DecibelLadder` (linear vs dB bars with landmarks, optional tone, three-stage cascade). Exam tip: ×10 = +10 dB, ×2 ≈ +3 dB. Beyond: 20 lg for amplitudes, Bode plots.
5. **Summary** — which tool each later module uses.

## 6. Content corrections applied to the source outline

1. Hearing range 10⁻¹² … 10⁰ W/m² is a factor of **10¹²** (a trillion, 万亿), not 百亿 (10¹⁰).
2. ∂²y/∂x² equals curvature only for small slopes; the exact curvature is y''/(1+y'²)^{3/2}. The lesson says so in a Beyond box.
3. The net force on a rope element is transverse (restoring), not "centripetal".
4. Module 0 uses e^{+iωt} (counterclockwise) while Module 1's outline uses e^{i(kx−ωt)}. The lesson names both conventions explicitly so Module 1 can use either without contradiction.
5. "Trusting" d/dt e^{iωt} = iω e^{iωt}: the lesson invites students to verify it by differentiating cos ωt + i sin ωt, so the derivation is not circular.
6. (For Module 2, recorded here) In the infinite well / string, *n* counts half-wavelengths (antinodes); the number of interior nodes is n − 1.
7. (For Module 4) Weber–Fechner is a first approximation; perceived loudness is closer to a power law (Stevens). Present as "roughly logarithmic".

## 7. Open items to verify (tracked as plan steps, not assumptions)

- Finnish sound terms against Sanoma Pro Luku 15 PDF (e.g. the exact term for sound intensity level).
- Course codes (LOPS 2021): waves are expected in **FY5** rather than FY3/FY4; complex numbers are expected to be **outside** pitkä matematiikka. Until verified, boxes show no course codes.

## 8. Out of scope now

Website build and hosting, accounts/progress tracking, AI tutor backend, text-to-speech, handwriting input, chemistry 3D, Modules 1–4 content.
