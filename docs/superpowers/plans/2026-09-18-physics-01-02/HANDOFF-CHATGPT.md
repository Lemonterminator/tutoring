You are taking over a partly-finished implementation plan from another model. You are not
designing anything. The plan already contains the exact code, tests, commands and expected
output for every step. Copy it in faithfully, run it, and report **what actually happened**.

## Workspace

- Repo root: `C:\Users\Jiang\Documents\ChatGPT\Tutoring\tutoring` (git). Run everything from there.
- Windows 11, Node 24, npm 11. The plan's shell blocks are bash. If your terminal is
  PowerShell, translate literally (`cp a b` → `Copy-Item a b`) and change nothing else.
- You are already on branch `feat/physics-01-02`. Do not create a branch, do not switch
  branches, do not push, do not merge. Confirm with `git branch --show-current` first.

## State you are inheriting — read this before anything else

Tasks 1–5 are committed and have been independently verified: code matches the plan
character for character, 28 test files / 100 tests pass, typecheck is clean, no new
dependencies. Do not revisit them, do not refactor them.

**Task 6 is half-done and uncommitted.** The working tree has:

```
 M subjects/physics/01-traveling-waves/lesson.en.mdx     <- task 6 step 2, already written
 M subjects/physics/01-traveling-waves/terms.json        <- task 6 step 2, already written
?? subjects/physics/01-traveling-waves/lesson.test.tsx   <- task 6 step 3, written but WRONG
?? docs/superpowers/plans/2026-09-18-physics-01-02/EXECUTION-LOG.md
?? docs/superpowers/plans/2026-09-18-physics-01-02/DEVIATIONS.md
```

The previous model stopped because one test could not pass. **That was a bug in the plan,
not in its work, and the plan has since been fixed (commit `47e6e13`).** The old test
asserted on the article body after `setLang('fi')`; `Lesson` renders the Finnish MDX
*instead of* the English one, and `lesson.fi.mdx` is still a placeholder until task 7, so
that assertion could never pass. Task 6's third test now checks the glossary instead.

### Where to resume

1. Re-read `docs/superpowers/plans/2026-09-18-physics-01-02/task-06-lesson-01-content.md`
   in full, from disk, right now. Do not work from anything you were told about it.
2. Compare the on-disk `lesson.en.mdx` and `terms.json` against that task file's code
   blocks. If they match, keep them. If they differ, replace them with the plan's version
   and note it in `DEVIATIONS.md`.
3. Replace the third test in `lesson.test.tsx` with the corrected version from the task
   file. The first two tests should already be correct — check them against the plan too.
4. Continue from task 6 **Step 5** (run the test, expect 3 passing), then Step 6 (gate),
   then Step 7 (commit). Then tasks 7–13 in order.
5. Add to `DEVIATIONS.md`: `### Task 6 Step 3 — test corrected by the plan author` with a
   one-line note that the Finnish assertion moved to task 7.

## Read first, in this order

1. `docs/superpowers/plans/2026-09-18-physics-01-02.md` — overview, **Global Constraints**,
   file map, dependency order, test-count table.
2. `docs/superpowers/specs/2026-09-18-physics-acoustics-design.md` — background only. If it
   disagrees with a task file, the task file wins.

Then the task files `task-06-…` through `task-13-…`, strictly in number order, one at a time.

## Hard rules

1. **The plan is the source of truth.** Copy code blocks character for character. Do not
   improve, rename, reformat, reorder, add comments, add error handling, add features, or
   refactor earlier tasks.
2. **No invented facts.** Do not add a package, version, config option, API, file or
   function that is not written in the plan. If you think one is missing, that is a blocker
   (rule 8), not something to fill in.
3. **Re-read before every task.** Open the task file again and read it completely at the
   start of each task. Before using anything under **Consumes**, open the real file and
   confirm the name and signature exist exactly as written.
4. **Every step, every command, really run.** Including the "run it to confirm it fails"
   steps. A step is done only when you have seen its actual terminal output.
5. **Never report output you did not see.** The plan's `Expected:` lines are predictions,
   not results. Quote the real output. If you did not run something, write `NOT RUN` and why.
6. **Expected vs actual must match.** An "Expected: FAIL" step that passes means the test is
   testing nothing — stop and investigate. A test count that differs from the plan's number
   is a mismatch even if everything is green — find out why before moving on.
7. **Do not touch tests to get green.** Never edit, skip, `.only`, delete or weaken a test or
   an assertion. Never add `@ts-ignore`, `any` casts or lint disables that are not in the plan.
8. **Fix budget, then stop.** When plan code does not work as written: at most **2**
   attempts, each a minimal change to implementation code (never test code), driven by the
   actual error message. Log each attempt in `DEVIATIONS.md`. If it still fails, or the fix
   would reach into another task's files, or two task files contradict each other, or the
   test itself looks wrong: **STOP**, write a blocker entry, end your turn. Do not skip
   ahead to a later task.
9. **Dependencies are frozen.** No `npm install`, no `npm update`, no version bumps. The
   plan adds no packages.
10. **Git discipline.** Commit only at the plan's commit steps, with the plan's exact
    message plus a blank line and `Co-Authored-By: ChatGPT <noreply@openai.com>`. Stage only
    the files the commit step names — never `git add -A` or `git add .`. Run `git status`
    before each commit. Never commit `Textbook_materials/` (copyrighted textbook scans),
    `dist/`, or `node_modules/`. Never rewrite history.
11. **Gate before each commit.** `npx vitest run` (whole suite) and `npm run typecheck`, both
    clean. A failure inside an earlier task's code is a blocker (rule 8).
12. **Stay in scope.** Only create or modify files listed under the task's **Files:**, plus
    the two log files. **Never modify anything under `framework/`, `scripts/` or
    `subjects/math/`.** Do not delete files.
13. **No claims beyond the log.** Your final report may state only facts that appear in
    `EXECUTION-LOG.md` with quoted output behind them. No adjectives ("smooth", "perfect",
    "production-ready"), no description of what the lesson teaches, no statement about how
    something is implemented that you did not check.

## Steps that need special handling

- **Tasks 7 and 13 need a local model that may not be reachable from where you are.** Both
  run `npm run translate`, which calls Ollama at `http://localhost:11434` on the user's own
  machine. First run `curl -s http://localhost:11434/api/tags` and check the output lists
  `qwen3.6:35b-a3b`.
  - **If it is there:** do tasks 7–13 exactly as written. Use the test counts in column A below.
  - **If it is not there** (connection refused, no such model, no network access to
    localhost): **do not translate by hand, do not use yourself as the translator, do not
    substitute another model.** Instead: skip task 7 entirely, log it as
    `Task 7 — SKIPPED, local model unreachable: <quoted error>`, and continue with tasks
    8–12 using column B below. **Stop after task 12** and do not attempt task 13 — it runs
    `npm run build`, which enforces that the English and Finnish files have the same
    structure, and that cannot pass while the Finnish files are placeholders. Say clearly in
    your final report that tasks 7 and 13 are left undone.
- **Tasks 8 and 9, the numerics — the most important code in this plan.** Their tests were
  verified against a working reference implementation before the plan was written, so a
  failure means *your code differs from the plan*, not that the test is too strict. Do
  **not** loosen a tolerance, shorten a run, change an expected node count, or adjust
  `relThreshold`. Compare your code to the plan line by line, especially two places:
  - the open-end (Neumann) boundary in `step` must use the ghost point
    `(2 * cur[1] - keep * prev[0]) / divide`, never `spare[0] = spare[1]`;
  - the driver must be a **dipole** — it adds at `drive.index` and subtracts at
    `drive.index + 1`. A one-sided push excites the zero-frequency rigid-drift mode of a
    pipe open at both ends, which has no restoring force, and the resulting offset fills in
    every node, giving `got 0 want n`.
  If you cannot find the difference within 2 attempts, stop and quote the actual and
  expected numbers for every failing case.
- **Tasks 6 and 12, the physics text.** You are transcribing, not reviewing. If you believe
  a sentence is physically wrong, do **not** change it — finish the task as written and put
  the concern in `DEVIATIONS.md` under `QUESTION (no change made)`.
- **Tasks 6 and 12, the Finnish glossary.** The PDFs in `Textbook_materials/` are scanned
  images with no text layer. Do not try to read them, do not claim a term is "from the
  textbook", and do not change any Finnish word from memory. Copy `terms.json` exactly as
  written and log the `UNVERIFIED:` line the task gives you.
- **Task 13, browser acceptance.** If you have a browser tool, open the `file:///…` URL and
  check each listed item, logging what you observed. If a check is not possible with your
  tools, mark it `NOT CHECKED (reason)` — never mark it passed. Item 7 is `LEFT FOR HUMAN`.
  For the quiz check, set the value with a form-input tool and click the button by element
  reference; a JavaScript-dispatched `input` event does not reach the handler and gives a
  false "wrong answer".

## Test counts — the running total of the whole suite after each task

| After task | A: local model available | B: task 7 skipped |
|---|---|---|
| 6 | 29 files / 103 tests | 29 / 103 |
| 7 | 29 / 104 | skipped |
| 8 | 30 / 111 | 30 / 110 |
| 9 | 31 / 120 | 31 / 119 |
| 10 | 32 / 124 | 32 / 123 |
| 11 | 33 / 127 | 33 / 126 |
| 12 | 34 / 130 | 34 / 129 |
| 13 | 34 / 131 | skipped |

If your number does not match the column you are in, that is rule 6 — stop and find out why
before committing.

## Logs

Append to `docs/superpowers/plans/2026-09-18-physics-01-02/EXECUTION-LOG.md` (it already has
tasks 1–5; keep the same format), one section per task:

```
## Task N — <title>
- Step 1: done
- Step 2: ran `<command>` → FAIL: <quoted error line>
- Step 4: ran `<command>` → <quoted "Tests  X passed (X)" line>
- Gate: vitest <quoted summary>; typecheck <clean | quoted errors>
- Commit: <short hash> "<message>"
```

And `DEVIATIONS.md`, one entry per departure:

```
### Task N Step M — <one line>
- Plan said: <quote>
- Actual output: <quoted error>
- Change made: <file:line, exact diff>
- Result: <quoted output after change>
```

Commit both log files once, at the very end.

## When to stop

Stop only when (a) every task you can do is done, or (b) you hit a blocker. Do not stop to
ask "should I continue?" between tasks, and do not skip a blocked task to work on later ones
(the one exception is the task 7 skip described above, which is pre-authorised).

## Final report — your last message

1. Status: `COMPLETE`, `COMPLETE THROUGH TASK 12 (translation unavailable)`, or
   `BLOCKED at Task N Step M`.
2. Real output of `git log --oneline feat/physics-01-02 ^main`.
3. The last full `npx vitest run` summary — both the file count and the test count — and,
   if you ran `npm run build`, every output line with its file size.
4. Which translation path you took (A or B) and the quoted output of the `curl` check.
5. Deviations: the count, one line each.
6. Everything marked `UNVERIFIED`, `NOT CHECKED`, `LEFT FOR HUMAN`, and every
   `QUESTION (no change made)`.
7. If blocked: the exact error output, what you tried, and what decision you need.

Keep it factual. Every claim needs quoted output behind it. Do not merge the branch — that
is the repo owner's decision, not yours.
