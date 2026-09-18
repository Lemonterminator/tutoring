# Acceptance checklist — physics lessons 1–2

Written before execution, so the numbers here are predictions to check against, not
results. Gemini's report is a list of claims; accept only what you re-ran yourself.
General method: `~/.claude/skills/building-bilingual-stem-lessons/acceptance.md`.

## Expected end state

- Branch `feat/physics-01-02`, roughly 15 commits (13 task commits + the log commit, plus
  any deviation fixes). Branched from `e4afa2f` on `main`.
- `npx vitest run` → **34 test files, 131 tests**. Baseline before the run was 23 / 75.
- `npm run typecheck` → silent, exit 0.
- `npm run build` → three `✔ … EN and FI match` lines and three `✔ dist\….html (NNN KB)`
  lines. Module 0 was 148 KB; these two should land in the same order of magnitude and
  must be under 1500 KB.
- New files only under `subjects/physics/`. **Nothing** under `framework/`, `scripts/` or
  `subjects/math/` may have changed — check with `git diff --stat main..feat/physics-01-02`.

Per-task running totals are in `../2026-09-18-physics-01-02.md`. A test count that does not
match means missing tests, extra tests, or a plan miscount — find out which.

## Re-run independently

```bash
git switch feat/physics-01-02
npx vitest run
npm run typecheck
npm run build
node ~/.claude/skills/building-bilingual-stem-lessons/scripts/plan-vs-code.mjs docs/superpowers/plans/2026-09-18-physics-01-02
git diff --stat main..feat/physics-01-02
```

`plan-vs-code` should be almost all `SAME`. Two `DIFF`s are expected by design, because
later tasks append to files that an earlier task created as a full block:
`subjects/physics/01-traveling-waves/lesson.test.tsx` (task 7 appends a test) and
`subjects/physics/02-standing-waves/lesson.test.tsx` (task 13 appends a test). Both
`lesson.fi.mdx` files are generated, so they will differ from the task 1 / task 8
placeholders. Anything else needs reading the real diff.

## The numerics are the thing to check hardest

These were verified against a reference implementation before the plan was written, so a
failure means the code differs from the plan.

- `fdwave.test.ts` — 7 tests. The load-bearing one is "every mode returns exactly to its
  starting shape after one period": three boundary pairs × n = 1, 2, 3, tolerance 1e-9,
  reference run gave 1e-14. This is the claim that the simulation reproduces `2L/n` and
  `4L/(2n−1)` exactly. If it was weakened, the lesson is dishonest.
- `modes.test.ts` — 9 tests. The load-bearing one is "the simulation grows the same node
  pattern the formula predicts": three boundary pairs × n = 1..4, twelve exact integer
  comparisons.
- **Check by hand that nobody loosened anything**: `relThreshold` is still `0.25`, the
  exactness tolerance is still `1e-9`, the build-up is still `Math.round(100 / field.dx)`,
  and the expected counts are still `interiorNodeCount(kind, n)`.
- **Two failure modes worth recognising.** `got 0 want n` for `kind = 'open'` means the
  driver is not a dipole — a one-sided push excites the `k = 0` rigid-drift mode of a pipe
  open at both ends, which has no restoring force, and the permanent offset fills in every
  node. Resonances that are off by a few percent mean the open end was written as
  `spare[0] = spare[1]` (first order) instead of the ghost point `2 * cur[1] − …`.

## Artifact scan

```bash
for f in dist/physics-01-traveling-waves.html dist/physics-02-standing-waves.html; do
  echo "== $f"; ls -la "$f"
  grep -oE 'https?://[a-zA-Z0-9./_-]+' "$f" | sort -u
  grep -c '@font-face' "$f"
done
```

Only `http://www.w3.org/...` namespace URLs are allowed, and `@font-face` must be `0`.

## Browser checks

On `file:///C:/Users/Jiang/Documents/ChatGPT/Tutoring/tutoring/dist/physics-02-standing-waves.html`:

```js
window.scrollTo(0,0); window.__raf=0;
const raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=(cb)=>{window.__raf++;return raf(cb)};
await new Promise(r=>setTimeout(r,2000)); const off=window.__raf;
document.querySelector('#fig-resonance').scrollIntoView();
await new Promise(r=>setTimeout(r,1500));
({ title: document.title, h2: document.querySelectorAll('article h2').length,
   figs: document.querySelectorAll('article figure.figure').length,
   quizzes: document.querySelectorAll('article .quiz').length,
   math: document.querySelectorAll('math').length,
   off, on: window.__raf,
   resources: performance.getEntriesByType('resource').map(e => e.name) })
```

Expect lesson 2: `h2` 5, `figs` 2, `quizzes` 8, `resources` `[]`, `off` 0 (the figure was
off screen and paused) and `on` above 30. Lesson 1: `h2` 5, `figs` 3, `quizzes` 7.

Then, by hand:

- Console empty (`read_console_messages`).
- **The quiz check must use `form_input` on the element ref, then click the button by ref.**
  Setting `input.value` and dispatching an `input` event from JavaScript does not reach the
  Preact handler and produces a false "wrong answer". Type `200` into the guitar-string
  quiz → "Correct!".
- `ResonanceLab`: switch to "Pipe, one end closed", sweep the frequency slider, confirm the
  measured node count in the readout changes and that peaks appear at odd multiples only.
  This is the single most important thing to see working — the whole lesson rests on it.
- `ImpedanceReflection`: click "Air to tissue" → reflected reads `99.9 %`.
- Click **FI** → headings Finnish; reload keeps FI. Exam mode → Finnish body only.
- `resize_window` mobile → `document.documentElement.scrollWidth <= innerWidth`.
- Dark mode readable.

## Read the Finnish in full

Both `lesson.fi.mdx` files, top to bottom, not a sample. Checklist and the common
translation-model failures are in the skill's `content-and-finnish.md`. For these lessons
specifically, confirm every numeral survived: 0.68, 500, 340, 1.2, 3.0, 400, 0.5, 170,
0.53, 2.5, 1540, 0.62, 20, 20000, 17, 0.017 (lesson 1); 0.65, 260, 200, 600, 0.17, 500,
1000, 1500, 2500, 0.12, 90, 4000, 99.9, 0.6 (lesson 2).

## Left for the human, do not accept on the executor's word

- Every term logged `UNVERIFIED` — lesson 1's core vocabulary has no exported source
  chapter at all (`poikittaisaalto`, `pitkittäisaalto`, `etenemisnopeus`, `aaltoyhtälö`,
  `aallonpituus`). Ask for Luku 12/13 to be exported.
- Double-clicking the file in Explorer so it opens in the default browser.
- Native-speaker review of the Finnish.

## Verdict

Report: what was independently confirmed with numbers; what the executor claimed that did
not hold; fixes committed on the branch; what is left for the human. Merge command is
`git switch main && git merge --ff-only feat/physics-01-02` — **do not merge without the
user's go-ahead.**
