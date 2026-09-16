# Lesson Framework + Module 0 (Math Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable bilingual lesson framework and ship Module 0 ("the math behind waves") as one double-clickable offline HTML file.

**Architecture:** Vite + Preact + MDX. Each lesson is `lesson.en.mdx` + machine-translated `lesson.fi.mdx` rendered through a shared framework (language signals, bilingual terms, syllabus/beyond/exam boxes, quizzes, figures with "ask" button, canvas simulation helpers, Web Audio). `vite-plugin-singlefile` inlines everything into `dist/<subject>-<slug>.html`.

**Tech Stack:** Node 24, TypeScript 5, Vite, Preact, @preact/signals, @mdx-js/rollup, remark-math, rehype-katex (MathML output), vite-plugin-singlefile, Vitest + jsdom + @testing-library/preact, tsx, local Ollama (`qwen3.6:35b-a3b`) for EN→FI translation.

**Spec:** `docs/superpowers/specs/2026-09-17-lesson-framework-design.md`

## Global Constraints

- All commands run from `tutoring/` (repo root, branch `main`). Shell examples are bash; on PowerShell set env vars with `$env:LESSON='...'`.
- Built lesson must open via `file://` with no network and no console errors in current Chrome/Edge.
- One lesson file ≤ 1.5 MB.
- Math renders with `rehype-katex` `output: 'mathml'` only; never import KaTeX CSS or fonts.
- No runtime `fetch`, no absolute asset paths, no external CDN.
- `localStorage` only inside `try/catch`; the page must behave identically without it.
- Every human-readable string in lessons is MDX children, never a JSX attribute. Framework chrome strings live in `framework/i18n/ui.ts`; simulation strings use `pick({ en, fi })`.
- Canvas colours come from CSS variables via `cssVar()`; no hard-coded colours in simulations.
- Animation loops must stop when off-screen (use `SimCanvas`/`useAnimationFrame`, never raw `requestAnimationFrame` in lessons).
- Audio gain hard cap `MAX_GAIN = 0.2`; sound starts only from a click.
- Do not commit `Textbook_materials/` (copyrighted PDFs).
- Import paths from a lesson to the framework are relative: `../../../framework/...`.
- Test files live next to the code: `*.test.ts` / `*.test.tsx`.

## File Map

| Path | Responsibility | Task |
|---|---|---|
| `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | toolchain | 1 |
| `framework/build/rehype-block-ids.ts`, `framework/build/mdx-options.ts` | shared MDX pipeline, block numbering | 1 |
| `framework/types.d.ts`, `framework/test-setup.ts` | `*.mdx` typing, jsdom canvas stub | 1 |
| `scripts/lessons.ts`, `scripts/build-all.ts` | discover lessons, build single files | 1 |
| `framework/i18n/state.ts`, `ui.ts`, `terms.ts`, `Term.tsx`; `framework/layout/LessonContext.ts` | language state, strings, bilingual terms | 2 |
| `framework/blocks/Blocks.tsx`, `framework/theme/index.css` | Syllabus/Beyond/ExamTip, design tokens | 3 |
| `framework/layout/Lesson.tsx`, `framework/components.ts`, lesson `main.tsx`, `meta.json` | page shell, TOC, glossary, exam hover | 4 |
| `framework/ask/question.ts`, `provider.ts`, `AskButton.tsx`, `Figure.tsx` | Q&A copy, figure state | 5 |
| `framework/practice/grade.ts`, `Quiz.tsx` | numeric/choice quizzes | 6 |
| `framework/interact/format.ts`, `draw.ts`, `useAnimationFrame.ts`, `SimCanvas.tsx`, `Controls.tsx`; `framework/audio/decibel.ts`, `tone.ts` | simulation + audio toolkit | 7 |
| `subjects/math/00-wave-math-foundations/complex.ts`, `wave.ts` | pure lesson math | 8 |
| `.../ComplexRotator.tsx`, `.../EulerCircle.tsx` | figures §1–2 | 9 |
| `.../WaveSurface.tsx` | figure §3 | 10 |
| `.../DecibelLadder.tsx` | figure §4 | 11 |
| `.../lesson.en.mdx`, `terms.json`, `lesson.test.tsx` | lesson content | 12 |
| `scripts/lesson-shape.ts`, `scripts/check.ts` | EN/FI structure check | 13 |
| `scripts/translate-lib.ts`, `scripts/translate.ts`, `.../lesson.fi.mdx` | Ollama translation | 14 |
| `docs/AUTHORING.md` | how to add the next lesson; final acceptance | 15 |

## Tasks

Each task is a separate file so an executor can load one at a time:

1. [Toolchain and single-file build](2026-09-17-lesson-00/task-01-toolchain.md)
2. [Language state and bilingual terms](2026-09-17-lesson-00/task-02-i18n.md)
3. [Content boxes and theme](2026-09-17-lesson-00/task-03-blocks-theme.md)
4. [Lesson page shell](2026-09-17-lesson-00/task-04-lesson-shell.md)
5. [Figures and "ask about this"](2026-09-17-lesson-00/task-05-ask-figure.md)
6. [Quizzes](2026-09-17-lesson-00/task-06-quizzes.md)
7. [Simulation and audio toolkit](2026-09-17-lesson-00/task-07-interact-audio.md)
8. [Lesson math helpers](2026-09-17-lesson-00/task-08-lesson-math.md)
9. [ComplexRotator and EulerCircle](2026-09-17-lesson-00/task-09-rotator-euler.md)
10. [WaveSurface](2026-09-17-lesson-00/task-10-wave-surface.md)
11. [DecibelLadder](2026-09-17-lesson-00/task-11-decibel-ladder.md)
12. [Lesson 0 English content](2026-09-17-lesson-00/task-12-content.md)
13. [EN/FI structure check](2026-09-17-lesson-00/task-13-check.md)
14. [Finnish translation via local Ollama](2026-09-17-lesson-00/task-14-translate.md)
15. [Authoring guide and acceptance](2026-09-17-lesson-00/task-15-acceptance.md)

Dependency order is linear except: 5, 6, 7 only need 1–4; 8 needs 1; 9–11 need 5, 7, 8; 12 needs 6 and 9–11; 13 needs 1; 14 needs 12–13.
