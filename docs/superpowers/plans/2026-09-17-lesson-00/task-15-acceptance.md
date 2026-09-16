### Task 15: Authoring guide and acceptance

**Files:**
- Create: `docs/AUTHORING.md`
- No code changes unless acceptance finds a defect (fix it in the file that owns the behaviour, add a test when the behaviour is testable, re-run this task).

**Interfaces:**
- Consumes: everything. Produces: `dist/math-00-wave-math-foundations.html`, verified.

- [ ] **Step 1: Write the authoring guide**

`docs/AUTHORING.md`:

````markdown
# Adding a lesson

1. Copy `subjects/math/00-wave-math-foundations/` to `subjects/<subject>/<NN-slug>/`. Keep `index.html` and `main.tsx` unchanged; delete the lesson-specific `.tsx/.ts` files and tests you do not reuse.
2. Edit `meta.json` (`id` = `<subject>-<NN-slug>`, both titles).
3. Write `lesson.en.mdx`. Available without import: `Term`, `Syllabus`, `Beyond`, `ExamTip`, `Figure`, `NumericQuiz`, `ChoiceQuiz`, `Choice`, `Hint`, `Solution`. Import only lesson-specific figures.
4. Put every `<Term id>` you use into `terms.json` with `en` and `fi` base forms, checked against the textbook.
5. A new figure: a component in the lesson folder built on `SimCanvas` (animated/drawn) or plain DOM/SVG, strings via `pick({ en, fi })`, colours via `cssVar`, settings via `useReportState()`. Test its readouts. When a second lesson needs it, move it to `subjects/<subject>/_components/`.
6. `npm run translate -- subjects/<subject>/<NN-slug>` (local Ollama), then spot-check `lesson.fi.mdx`.
7. `npm test && npm run build` → `dist/<subject>-<NN-slug>.html`. Send that one file (zip it for email).

## MDX pitfalls

- `{` and `<` outside `$…$` start JSX/expressions: rephrase the sentence.
- Leave a blank line before and after block components (`<Syllabus>`, `<Figure>`, quizzes) and around paragraphs inside them.
- Human-readable text goes in children, never in attributes; translation only touches children.

## Labels

- `Syllabus`: in the Finnish lukio curriculum, can be examined.
- `Beyond`: not examined; the student will meet it at university.
- `ExamTip`: technique for scoring points.
````

- [ ] **Step 2: Full automated run**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass; no type errors; `✔ … EN and FI match`; `✔ dist/math-00-wave-math-foundations.html (NNN KB)` with NNN below 1536.

- [ ] **Step 3: Offline acceptance in the browser pane**

Open `file:///C:/Users/Jiang/Documents/ChatGPT/Tutoring/tutoring/dist/math-00-wave-math-foundations.html` in the browser pane and check each line; stop and fix on the first failure:

1. Console has no errors or warnings from the page (`read_console_messages`, `onlyErrors: true`).
2. No network requests other than the file itself (`read_network_requests`).
3. Title, table of contents with 6 entries, glossary with 14 rows.
4. `FI` switches body, headings, box labels, quiz buttons and figure controls to Finnish; terms show `(english)`; reload keeps FI.
5. Exam mode: language buttons disabled, terms show no brackets, hovering a paragraph shows the English paragraph, hovering a term shows its English base form.
6. Figure 1: `× i` ×4 returns home; drag works. Figure 2: rotation, velocity arrow, sine trace, ω slider, pause. Figure 3: three modes behave as in Task 10 Step 5. Figure 4: sliders, landmarks, cascade bars, sound on/off (low volume).
7. Every quiz grades a correct and a wrong answer; `0,5` is accepted.
8. "Ask about this" on Figure 2 → paste somewhere: the text contains lesson id, `figure "euler"`, language and `omega=…`.
9. Off-screen animations stop. Scroll to the very top (no figure visible), then run in the page (`javascript_tool`):
   `window.__raf = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); };`
   Wait 2 s and read `window.__raf` → expected `0`. Scroll `#fig-euler` into view, wait 1 s, read again → expected more than 30. Reload the page afterwards.
10. Dark mode (`resize_window` with `colorScheme: 'dark'`, or OS dark theme): text, boxes and canvas lines readable.
11. Width 375 px (`resize_window` preset `mobile`, reload): no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`), TOC hidden, figures fit. Reset with preset `desktop`.

- [ ] **Step 4: Double-click test outside the dev machine setup**

Copy the file to `C:\tmp\math-00-wave-math-foundations.html` and open it by double-clicking in Explorer (default browser). Confirm formulas render and one figure animates.

- [ ] **Step 5: Commit**

```bash
git add docs/AUTHORING.md
git commit -m "docs: lesson authoring guide"
```

- [ ] **Step 6: Report**

Report to the author: file path and size, test count, any acceptance items that needed fixes, and the list of Finnish wording changes made during the spot-check (so they can be reviewed with a native speaker later).
