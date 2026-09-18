### Task 7: Lesson 1 Finnish translation

**Files:**
- Modify (replace entirely): `subjects/physics/01-traveling-waves/lesson.fi.mdx`
- Modify (append one test): `subjects/physics/01-traveling-waves/lesson.test.tsx`

**Interfaces:**
- Consumes: `lesson.en.mdx` and `terms.json` from task 6; `scripts/translate.ts`, which
  already exists and must not be modified.
- Produces: a Finnish body with the same block count, maths count, component sequence,
  import lines and Term ids as the English one. `npm run check` enforces this.

**This task runs a local model. Do not translate the lesson yourself and do not switch
models.** If the model is unavailable, that is a blocker: stop and report.

---

- [ ] **Step 1: Confirm the local model is there**

Run: `curl -s http://localhost:11434/api/tags`
Expected: JSON that contains `qwen3.6:35b-a3b`.

If the request fails or the model is absent, **STOP**. Write a blocker entry and end your
turn. Do not translate by hand, do not use a different model, do not skip to task 8.

- [ ] **Step 2: Write the failing test**

Append to `subjects/physics/01-traveling-waves/lesson.test.tsx`:

```tsx
test('the Finnish body is really Finnish and keeps the same structure', () => {
  const { container } = renderLesson();
  const english = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  act(() => setLang('fi'));
  const finnish = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  expect(finnish).toHaveLength(english.length);
  expect(finnish[0]).not.toBe(english[0]);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(3);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(7);
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx`
Expected: FAIL with `expected 1 to have a length of 5` (the Finnish file is still the
one-section placeholder from task 1).

- [ ] **Step 4: Translate**

Run: `npm run translate -- subjects/physics/01-traveling-waves`

This calls the local Ollama server once per `h2` section, with two attempts each, and
prints a line per attempt. **It takes several minutes. Wait for the process to exit** —
do not interrupt it and do not start anything else while it runs.

Expected last line: `wrote subjects\physics\01-traveling-waves\lesson.fi.mdx — now run: npm run check`

Copy the `section i/N, attempt k` lines and any `structure mismatch` warnings into
`EXECUTION-LOG.md`.

- [ ] **Step 5: Run the structure check**

Run: `npm run check`
Expected: `✔ subjects/physics/01-traveling-waves: EN and FI match` plus the same line for
`subjects/math/00-wave-math-foundations`.

If it reports a mismatch, fix **the Finnish file only**, and only the specific thing named:

| Reported issue | What to do |
|---|---|
| `block count differs` | The model merged or split paragraphs. Restore the paragraph breaks so the counts match. Never merge English paragraphs to compensate. |
| `Term ids differ` | The model added a `Term` tag around a word that is plain in English (remove it) or dropped one from a sentence-initial word (restore it). Both are common. |
| `component sequence differs` | A block component was dropped, duplicated or reordered. Restore the English order. |
| `math count differs` | A formula was lost or an extra one invented. Restore. |
| `import lines differ` | Restore the English import block verbatim. |

- [ ] **Step 6: Read the whole Finnish file and fix concrete defects**

Read `lesson.fi.mdx` from top to bottom — all of it, not a sample. Fix only defects on
this list, and log every change as `before → after` in `EXECUTION-LOG.md`:

- Headings still in English, or their numbers dropped (`## 1. …` must keep the number).
- Leftover English words inside Finnish sentences.
- Non-words and letter slips (a word that is not Finnish at all, e.g. `aaltopituus` for
  `aallonpituus`).
- `<Term>` surface text that is not an inflected form of its base word.
- Changed LaTeX, or changed units (`m/s`, `Hz`, `mm`, `MHz` stay exactly as written).
- Numbers changed. Every numeral in the Finnish file must match the English one.
- A question whose word order has become unnatural, e.g. a subordinate clause left at the
  front where Finnish would put it at the end.

Do **not** "improve" wording you merely dislike, and do not merge or split paragraphs to
make it read better — exam mode pairs English and Finnish blocks by position.

Established terms to check are present, not calqued: `poikittainen aaltoliike`,
`pitkittäinen aaltoliike`, `aallonpituus`, `jaksonaika`, `taajuus`, `aaltoyhtälö`,
`infraääni`, `ultraääni`.

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 8: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **29 test files, 104 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

Run: `npm run check`
Expected: two `✔` lines.

- [ ] **Step 9: Commit**

```bash
git add subjects/physics/01-traveling-waves/lesson.fi.mdx subjects/physics/01-traveling-waves/lesson.test.tsx
git commit -m "feat: lesson 1 Finnish translation (Ollama draft, spot-checked)"
```
