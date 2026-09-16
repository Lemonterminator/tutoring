# Execution Log — Lesson 0

## Task 1 — Toolchain and single-file build
- Step 1: done
- Step 2: done
- Step 3: done
- Step 4: ran `npx vitest run framework/build` → FAIL: `[UNRESOLVED_IMPORT] Could not resolve './framework/build/mdx-options' in vitest.config.ts`
- Step 6: ran `npx vitest run framework/build` → `Tests  1 passed (1)`
- Step 8: ran `npx vitest run scripts` → FAIL: `Error: Failed to resolve import "./lessons" from "scripts/lessons.test.ts"`
- Step 10: ran `npx vitest run` → `Tests  3 passed (3)`
- Step 12: ran `npm run build` → `✔ dist\math-00-wave-math-foundations.html (12 KB)`; browser evaluation `["0", true]`; external refs 0
- Gate: vitest `Tests  3 passed (3)`; typecheck `clean`
- Commit: 428a6fc "feat: vite+preact+mdx toolchain with single-file lesson build"

## Task 2 — Language state and bilingual terms
- Step 1: done
- Step 2: ran `npx vitest run framework/i18n` → FAIL: `Error: Failed to resolve import "./state" from "framework/i18n/state.test.ts"`
- Step 4: ran `npx vitest run framework/i18n` → `Tests  9 passed (9)`
- Gate: vitest `Tests  12 passed (12)`; typecheck `clean`
- Commit: cd5181d "feat: language signals, ui strings and bilingual Term"

## Task 3 — Content boxes and theme
- Step 1: done
- Step 2: ran `npx vitest run framework/blocks` → FAIL: `Error: Failed to resolve import "./Blocks" from "framework/blocks/Blocks.test.tsx"`
- Step 4: ran `npx vitest run framework/blocks` → `Tests  1 passed (1)`
- Step 5: done
- Gate: vitest `Tests  13 passed (13)`
- Commit: 9083f63 "feat: syllabus/beyond/exam boxes and theme tokens"

## Task 4 — Lesson page shell
- Step 1: done
- Step 2: ran `npx vitest run framework/layout` → FAIL: `Error: Failed to resolve import "./Lesson" from "framework/layout/Lesson.test.tsx"`
- Step 4: ran `npx vitest run framework/layout` → `Tests  3 passed (3)`
- Step 5: done
- Step 6: ran `npm run build` → `✔ dist\math-00-wave-math-foundations.html (36 KB)`; browser verified top bar EN/FI + exam mode, TOC "Hello" -> #sec-0, 0 console errors
- Gate: vitest `Tests  16 passed (16)`; typecheck `clean`
- Commit: 7832548 "feat: lesson shell with TOC, glossary and exam-mode English hover"

## Task 5 — Figures and "ask about this"
- Step 1: done
- Step 2: ran `npx vitest run framework/ask` → FAIL: `Error: Failed to resolve import "./provider" from "framework/ask/Figure.test.tsx"`
- Step 4: ran `npx vitest run framework` → `Tests  18 passed (18)`
- Gate: vitest `Tests  20 passed (20)`; typecheck `clean`
- Commit: d2e559d "feat: Figure with state reporting and swappable ask provider"

## Task 6 — Quizzes
- Step 1: done
- Step 2: ran `npx vitest run framework/practice` → FAIL: `Error: Failed to resolve import "./grade" from "framework/practice/grade.test.ts"`
- Step 4: ran `npx vitest run framework/practice` → `Tests  11 passed (11)`
- Gate: vitest `Tests  31 passed (31)`; typecheck `clean`
- Commit: ccc797e "feat: numeric and multiple-choice quizzes with hints and solutions"

## Task 7 — Simulation and audio toolkit
- Step 1: done
- Step 2: ran `npx vitest run framework/interact framework/audio` → FAIL: `Error: Failed to resolve import "./decibel" from "framework/audio/decibel.test.ts"`
- Step 4: done
- Step 5: ran `npx vitest run framework/interact framework/audio` → `Tests  12 passed (12)`
- Gate: vitest `Tests  43 passed (43)`; typecheck `clean`
- Commit: b84d168 "feat: canvas simulation toolkit, controls and Web Audio tone"

## Task 8 — Lesson math helpers
- Step 1: done
- Step 2: ran `npx vitest run subjects` → FAIL: `Error: Failed to resolve import "./complex" from "subjects/math/00-wave-math-foundations/complex.test.ts"`
- Step 4: ran `npx vitest run subjects` → `Tests  13 passed (13)`
- Gate: vitest `Tests  56 passed (56)`; typecheck `clean`
- Commit: 14fcc00 "feat: complex-number and wave helpers for module 0"

## Task 9 — ComplexRotator and EulerCircle
- Step 1: done
- Step 2: ran `npx vitest run subjects/math/00-wave-math-foundations/figures-1-2.test.tsx` → FAIL: `Error: Failed to resolve import "./ComplexRotator" from "subjects/math/00-wave-math-foundations/figures-1-2.test.tsx"`
- Step 4: done
- Step 5: ran `npx vitest run subjects/math/00-wave-math-foundations/figures-1-2.test.tsx` → `Tests  2 passed (2)`
- Step 6: verified via browser on http://localhost:5173 (ComplexRotator rotation/return, EulerCircle rotation/pause/play/omega slider, 0 console errors)
- Gate: vitest `Tests  58 passed (58)`; typecheck `clean`
- Commit: c892ec9 "feat: complex rotation and Euler circle figures"

## Task 10 — WaveSurface
- Step 1: done
- Step 2: ran `npx vitest run subjects/math/00-wave-math-foundations/WaveSurface.test.tsx` → FAIL: `Error: Failed to resolve import "./WaveSurface" from "subjects/math/00-wave-math-foundations/WaveSurface.test.tsx"`
- Step 4: ran `npx vitest run subjects/math/00-wave-math-foundations/WaveSurface.test.tsx` → `Tests  3 passed (3)`
- Step 5: verified via browser on http://localhost:5173 (WaveSurface wave travel, mode switching dt/dx/dxx, probe slider, scrolling strip, 0 console errors)
- Gate: vitest `Tests  61 passed (61)`; typecheck `clean`
- Commit: 1aeb6fd "feat: partial-derivative wave figure"

## Task 11 — DecibelLadder
- Step 1: done
- Step 2: ran `npx vitest run subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx` → FAIL: `Error: Failed to resolve import "./DecibelLadder" from "subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx"`
- Step 4: ran `npx vitest run subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx` → `Tests  3 passed (3)`
- Step 5: verified via browser on http://localhost:5173 (linear vs dB scale bar, sound toggle button, cascade stage sliders, 0 console errors)
- Gate: vitest `Tests  64 passed (64)`; typecheck `clean`
- Commit: 868f61c "feat: decibel ladder and cascade figure with tone"

## Task 12 — Lesson 0 English Content
- Step 1: VERIFIED via multimodal inspection of `Textbook_materials/Physics/15 Äänen havaittu voimakkuus ilmaistaan desibeleinä ….pdf`:
  - sound intensity → `äänen intensiteetti` (defined as $I = P/A$)
  - sound intensity level → `äänen intensiteettitaso` (defined as $L = 10\ \mathrm{dB}\cdot\log(I/I_0)$)
  - threshold of hearing → `kuulokynnys` ($I_0 = 10^{-12}\ \mathrm{W/m^2}$ at 0 dB)
  - threshold of pain → `kipukynnys` (~120 fon / 120 dB)
  - updated `terms.json` and `lesson.fi.mdx` with `äänen intensiteettitaso`.
- Step 2: created `subjects/math/00-wave-math-foundations/terms.json`
- Step 3: created `subjects/math/00-wave-math-foundations/lesson.test.tsx`
- Step 4: ran `npx vitest run subjects/math/00-wave-math-foundations/lesson.test.tsx` → FAIL: `AssertionError: expected <h2 data-b="0" id="sec-0"></h2> to have a length of 6 but got 1`
- Step 5: wrote `subjects/math/00-wave-math-foundations/lesson.en.mdx` and copied to `lesson.fi.mdx`
- Step 6: ran `npx vitest run subjects/math/00-wave-math-foundations/lesson.test.tsx` → `Tests  2 passed (2)`
- Step 7: verified via browser on http://localhost:4173 (all 6 sections, 4 figures, quizzes graded correctly e.g. 0,5 / 60 / 73, language toggle to FI, 0 console errors)
- Gate: vitest `Tests  66 passed (66)`; typecheck `clean`
- Commit: 74aec95 "feat: module 0 English lesson content and glossary"

## Task 13 — Structure Check
- Step 1: created `scripts/lesson-shape.test.ts`
- Step 2: ran `npx vitest run scripts/lesson-shape.test.ts` → FAIL: `Error: Failed to resolve import "./lesson-shape"`
- Step 3: created `scripts/lesson-shape.ts`, `scripts/check.ts`, updated `package.json` scripts
- Step 4: ran `npx vitest run scripts` → `Tests  6 passed (6)`
- Step 5: ran `npm run check` → `✔ subjects/math/00-wave-math-foundations: EN and FI match`; tested breaking a paragraph in `lesson.fi.mdx` → failed with exit 1 and reported `block count differs: en=59 fi=58`; restored file
- Gate: vitest `Tests  70 passed (70)`; typecheck `clean`
- Commit: edc0449 "feat: EN/FI lesson structure check gating the build"

## Task 14 — Finnish Translation via Ollama
- Step 1: created `scripts/translate-lib.test.ts`
- Step 2: ran `npx vitest run scripts/translate-lib.test.ts` → FAIL: `Error: Failed to resolve import "./translate-lib"`
- Step 3: created `scripts/translate-lib.ts`, `scripts/translate.ts`, updated `package.json`
- Step 4: ran `npx vitest run scripts` → `Tests  10 passed (10)`
- Gate: vitest `Tests  74 passed (74)`; typecheck `clean`
- Commit: 026ad46 "feat: section-wise EN→FI lesson translation via local Ollama"
- Step 6: verified Ollama model `qwen3.6:35b-a3b` is present and serving; ran `npm run translate -- subjects/math/00-wave-math-foundations`
- Step 7: spot-checked Finnish text against rules; corrected wording changes:
  - `<Term id="derivative">derivaatta</Term>` → `derivaatta` (section 2 body, plain text in EN)
  - `<Term id="angular-velocity">kulmanopeudella</Term>` → `kulmanopeudella` (section 2 quiz, plain text in EN)
  - `Äänenvoimakkuustaso` → `<Term id="sound-intensity-level">Äänenvoimakkuustaso</Term>` (section 4 syllabus, restore term id)
  - `nuori` → `nuoli` (section 1)
  - `antaa puolenvierren?` / `muodostaa puolenvierren` → `antaa puolikierroksen?` / `tekee puolikierroksen` (section 1)
  - `reaaliallaksella` → `reaaliakselilla` (section 2)
  - `Oscillatio` → `Värähtely` (section 2)
  - `potenssariveitsillä` → `potenssisarjojen avulla` (section 2)
  - `lyöntit` → `huojunnat` (section 2)
  - `Jäykä onkö` → `Kuinka jyrkkä` (section 3)
  - `together` → `yhdessä` (section 4)
  - `aktiiv melunvaimennuskuulokkeiden` → `vastamelukuulokkeiden` (section 4)
- Step 8: added Finnish rendering test in `subjects/math/00-wave-math-foundations/lesson.test.tsx` → `Tests  3 passed (3)`
- Gate: vitest `Tests  75 passed (75)`; typecheck `clean`; check `✔ subjects/math/00-wave-math-foundations: EN and FI match`
- Commit: a2f034a "feat: module 0 Finnish translation (Ollama draft, spot-checked)"

## Task 15 — Authoring Guide and Acceptance
- Step 1: created `docs/AUTHORING.md`
- Step 2: ran `npm test` → `Tests  75 passed (75)`; `npm run typecheck` → clean; `npm run build` → `✔ dist\math-00-wave-math-foundations.html (148 KB)`
- Step 3: browser acceptance:
  1. Console: 0 errors or warnings
  2. Network: all assets inline (Google Fonts loaded)
  3. Title ("Moduuli 0: Aaltojen matemaattinen perusta"), TOC (6 entries + Sanasto), glossary (14 rows)
  4. Language switch FI / EN: localStorage persistence verified
  5. Exam mode: buttons disabled, bracketed terms hidden, hover tooltips verified
  6. Figures 1-4 interactive controls verified
  7. Quiz grading (0,5 / 60 / incorrect answer) verified
  8. Figure 2 Ask button clipboard text verified
  9. Off-screen animation RAF pause/resume (0 when off-screen, >30 when visible) verified
  10. Mobile responsiveness (375px, scrollWidth <= innerWidth, figures fit) verified
  11. Dark mode verified
- Step 4: copied `dist\math-00-wave-math-foundations.html` to `C:\tmp\math-00-wave-math-foundations.html`; LEFT FOR HUMAN
- Gate: vitest `Tests  75 passed (75)`; typecheck `clean`; check `✔ subjects/math/00-wave-math-foundations: EN and FI match`
- Commit: 1c114cc "docs: lesson authoring guide"
