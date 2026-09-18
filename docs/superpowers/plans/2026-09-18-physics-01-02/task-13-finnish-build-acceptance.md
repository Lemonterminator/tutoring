### Task 13: Lesson 2 Finnish translation, build, and acceptance

**Files:**
- Modify (replace entirely): `subjects/physics/02-standing-waves/lesson.fi.mdx`
- Modify (append one test): `subjects/physics/02-standing-waves/lesson.test.tsx`
- Create: `docs/superpowers/plans/2026-09-18-physics-01-02/EXECUTION-LOG.md` (commit here)
- Create: `docs/superpowers/plans/2026-09-18-physics-01-02/DEVIATIONS.md` (commit here)

**Interfaces:**
- Consumes: everything from tasks 1–12.
- Produces: `dist/physics-01-traveling-waves.html` and `dist/physics-02-standing-waves.html`.
  `dist/` is **not** committed.

---

- [ ] **Step 1: Confirm the local model is there**

Run: `curl -s http://localhost:11434/api/tags`
Expected: JSON containing `qwen3.6:35b-a3b`. If not, **STOP** with a blocker.

- [ ] **Step 2: Write the failing test**

Append to `subjects/physics/02-standing-waves/lesson.test.tsx`:

```tsx
test('the Finnish body is really Finnish and keeps the same structure', () => {
  const { container } = renderLesson();
  const english = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  act(() => setLang('fi'));
  const finnish = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  expect(finnish).toHaveLength(english.length);
  expect(finnish[0]).not.toBe(english[0]);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(2);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(8);
  expect(container.querySelector('[data-term="node"] .term__alt')?.textContent).toBe(' (node)');
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/02-standing-waves/lesson.test.tsx`
Expected: FAIL with `expected 1 to have a length of 5`.

- [ ] **Step 4: Translate**

Run: `npm run translate -- subjects/physics/02-standing-waves`

Several minutes. Wait for the process to exit. Copy the per-section lines into
`EXECUTION-LOG.md`.

- [ ] **Step 5: Check the structure, then read the whole Finnish file**

Run: `npm run check`
Expected: three `✔` lines.

Fix mismatches in the Finnish file only, using the same table as task 7 step 5. Then read
`lesson.fi.mdx` from top to bottom and fix only concrete defects, logging each as
`before → after`. Watch in particular for:

- `seisova aalto`, `solmu`, `kupu`, `perustaajuus`, `reunaehto`, `heijastuminen` present
  and not calqued from English.
- Numbers unchanged: 0.65, 260, 200, 600, 0.17, 340, 500, 1000, 1500, 2500, 0.12, 1500,
  90, 4000, 99.9, 0.6.
- Units unchanged: `m`, `Hz`, `m/s`, `s`.
- `n − 1`, `2L/n` and `4L/(2n−1)` unchanged inside the maths.
- Headings still numbered.

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/02-standing-waves/lesson.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 7: Full gate**

Run: `npx vitest run`
Expected: PASS. Repo total **34 test files, 131 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: three `✔ … EN and FI match` lines, then three `✔ dist\… .html (NNN KB)` lines.
Quote all of them, with the actual sizes, into `EXECUTION-LOG.md`. Each must be under
1500 KB.

- [ ] **Step 8: Scan the built files**

For each of `dist/physics-01-traveling-waves.html` and `dist/physics-02-standing-waves.html`:

```bash
grep -oE 'https?://[a-zA-Z0-9./_-]+' dist/physics-01-traveling-waves.html | sort -u
grep -c '@font-face' dist/physics-01-traveling-waves.html
```

Expected: the only URLs are `http://www.w3.org/...` namespace declarations, and the
`@font-face` count is `0`. Quote the real output. If anything else appears, that is a
constraint violation — stop and report it, do not try to fix it.

- [ ] **Step 9: Browser acceptance, if you have a browser tool**

Open `file:///C:/Users/Jiang/Documents/ChatGPT/Tutoring/tutoring/dist/physics-02-standing-waves.html`
and check each item, recording what you actually observed. Anything your tools cannot do,
mark `NOT CHECKED (reason)` — never `passed`.

1. The page renders with a title, a table of contents and five `h2` sections.
2. The console is empty.
3. The `ResonanceLab` canvas is animating, and the boundary buttons change the readouts.
4. A numeric quiz accepts a decimal comma: type `200` into the guitar-string quiz and
   confirm it says "Correct!". **Set the value with a form-input tool and click the button
   by element reference.** Setting `input.value` from JavaScript and dispatching an `input`
   event does not reach the handler and produces a false "wrong answer".
5. Clicking **FI** turns the headings Finnish.
6. Exam mode shows the Finnish body only.
7. `LEFT FOR HUMAN`: double-clicking the file in Explorer so it opens in the default
   browser. Do not claim this one.

- [ ] **Step 10: Write the logs and commit everything**

`EXECUTION-LOG.md` has one section per task with quoted output. `DEVIATIONS.md` has one
entry per departure from the plan, or the single word `None`.

```bash
git add subjects/physics/02-standing-waves/lesson.fi.mdx subjects/physics/02-standing-waves/lesson.test.tsx
git commit -m "feat: lesson 2 Finnish translation (Ollama draft, spot-checked)"
git add docs/superpowers/plans/2026-09-18-physics-01-02/EXECUTION-LOG.md docs/superpowers/plans/2026-09-18-physics-01-02/DEVIATIONS.md
git commit -m "docs: physics lessons 1-2 execution log"
```

Run `git status` and confirm the only untracked things left are under `dist/`.
