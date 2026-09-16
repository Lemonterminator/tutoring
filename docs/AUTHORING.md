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
