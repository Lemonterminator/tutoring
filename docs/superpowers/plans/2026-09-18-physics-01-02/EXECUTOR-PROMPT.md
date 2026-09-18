You are executing a finished implementation plan. You are not designing anything. The plan already contains the exact code, tests, commands and expected output for every step. Your job is to copy it in faithfully, run it, and report **what actually happened**.

## Workspace

- Repo root: `C:\Users\Jiang\Documents\ChatGPT\Tutoring\tutoring` (git repo). Run every command from there.
- OS: Windows 11. Node 24, npm 11. The plan's shell blocks are bash syntax. If your terminal is PowerShell, translate literally (`cp a b` → `Copy-Item a b`, `VAR=x cmd` → `$env:VAR='x'; cmd`) and change nothing else about the command.
- Before Task 1: `git status` must be clean. Then `git switch -c feat/physics-01-02`. All commits go on this branch. Never push.

## Read first, in this order

1. `docs/superpowers/plans/2026-09-18-physics-01-02.md` (overview, **Global Constraints**, file map, dependency order, test-count table)
2. `docs/superpowers/specs/2026-09-18-physics-acoustics-design.md` (background only; the task files win if they differ)

Then do the tasks in `docs/superpowers/plans/2026-09-18-physics-01-02/task-01-*.md` … `task-13-*.md`, strictly in number order, one at a time.

## Hard rules

1. **The plan is the source of truth.** Copy code blocks character for character. Do not "improve", rename, reformat, reorder, add comments, add error handling, add features, or refactor earlier tasks.
2. **No invented facts.** Do not add a package, version, config option, API, file or function that is not written in the plan. If you think one is missing, that is a blocker (rule 8), not something to fill in.
3. **Re-read before every task.** At the start of each task, open that task file again and read it completely. Do not work from memory of an earlier read. Before using anything listed under **Consumes**, open the real file and confirm the name and signature exist exactly as written.
4. **Every step, every command, really run.** Execute every step in the order given, including "run it to confirm it fails". A step counts as done only when you have seen its actual terminal output.
5. **Never report output you did not see.** The plan's `Expected:` lines are predictions, not results. In your log, quote the real output (the pass/fail summary, the test counts, the error message). If you did not run it, write `NOT RUN` and why.
6. **Expected vs. actual must match.**
   - An "Expected: FAIL" step that passes instead → stop and investigate: the test may not be testing anything.
   - A test count that differs from the plan's `Expected: PASS (N tests)` or from the overview's running total → that is a mismatch even if everything is green. Find out why before moving on.
7. **Do not touch tests to get green.** Never edit, skip, `.only`, delete or weaken a test or an assertion to make it pass. Never add `// @ts-ignore`, `any` casts or `eslint-disable` that are not in the plan.
8. **Fix budget, then stop.** When plan code does not work as written:
   - At most **2** attempts, each a minimal change to implementation (not test) code, based on the actual error message.
   - Log each attempt in `DEVIATIONS.md` (format below).
   - If it still fails after 2 attempts, or the fix would need a change in another task's files, or two task files contradict each other, or a test itself looks wrong: **STOP**. Write a blocker entry and end your turn with the blocker report. Do not continue to the next task.
9. **Dependencies are frozen.** No `npm install` of anything new, no `npm audit fix`, no `npm update`, no version bumps. The plan adds no packages. If you believe one is needed, that is a blocker.
10. **Git discipline.**
    - Commit only at the plan's commit steps, with the plan's exact message plus a blank line and `Co-Authored-By: Gemini <noreply@google.com>`.
    - Stage only the files the commit step names. Never `git add -A` or `git add .`.
    - Before each commit, run `git status` and confirm nothing unexpected is staged or modified.
    - Never commit `Textbook_materials/`, `dist/`, `node_modules/`.
    - Never rewrite history (`reset --hard`, `rebase`, `commit --amend`, `push --force`).
11. **Gate before each commit.** Run `npx vitest run` (the whole suite) and `npm run typecheck`. Both must be clean before you commit. If a failure is in an earlier task's code, that is a blocker (rule 8).
12. **Stay in scope.** Only create or modify files listed under the task's **Files:**, plus `EXECUTION-LOG.md` and `DEVIATIONS.md`. Never modify anything under `framework/`, `scripts/` or `subjects/math/`. Do not delete files.
13. **No claims beyond the log.** Your final report may only state facts that appear in `EXECUTION-LOG.md` with quoted output behind them. No feature descriptions, no adjectives ("smooth", "tiny", "perfect", "production-ready"), no statements about how something is implemented that you did not check, no summary of what the lesson teaches.

## Steps that need special handling

- **Tasks 8 and 9, the numerics.** These two files decide whether the lesson is honest, and their tests were verified against a reference implementation before the plan was written. If a numerical test fails, **do not** loosen a tolerance, shorten a run, change an expected count, or adjust `relThreshold`. Your code differs from the plan — compare it line by line, especially the open-end ghost point in `step` and the dipole driver. If you cannot find the difference in 2 attempts, stop with a blocker and quote the actual and expected numbers for every failing case.
- **Tasks 6 and 12, the physics text.** You are transcribing, not reviewing. If you believe a sentence is physically wrong, do **not** change it: finish the task as written and put the concern in `DEVIATIONS.md` under a heading `QUESTION (no change made)`.
- **Tasks 6 and 12, the Finnish glossary.** The PDFs in `Textbook_materials/` are scanned images with no text layer. Do not try to read them, do not confirm a term "from the textbook", and do not change any Finnish word from memory. Copy `terms.json` exactly as written and log the `UNVERIFIED:` line the task gives you.
- **Tasks 7 and 13, translation.** First check that `curl -s http://localhost:11434/api/tags` lists `qwen3.6:35b-a3b`. If it does not, **STOP** with a blocker. Do not translate the lesson yourself and do not switch models. The run takes several minutes; wait for the process to exit. In the spot check, fix only the concrete defects the task lists, and log every Finnish wording change as `before → after`.
- **Task 13, browser acceptance.** If you have a browser tool, open the `file:///…` URL and check each listed item, logging what you observed for each. If a check is not possible with your tools, mark it `NOT CHECKED (reason)`; do not mark it passed. Item 7 is for the human: mark it `LEFT FOR HUMAN`. For the quiz check, set the value with a form-input tool and click the button by element reference — a JavaScript-dispatched `input` event does not reach the handler and gives a false "wrong answer".

## Logs (create at the start; commit only at the end)

`docs/superpowers/plans/2026-09-18-physics-01-02/EXECUTION-LOG.md`, one section per task:

```
## Task N — <title>
- Step 1: done
- Step 2: ran `<command>` → FAIL: <quoted error line>
- Step 4: ran `<command>` → <quoted "Tests  X passed (X)" line>
- Gate: vitest <quoted summary>; typecheck <clean | quoted errors>
- Commit: <short hash> "<message>"
```

`docs/superpowers/plans/2026-09-18-physics-01-02/DEVIATIONS.md`, one entry per departure (write `None` if there were none):

```
### Task N Step M — <one line>
- Plan said: <quote>
- Actual output: <quoted error>
- Change made: <file:line, exact diff>
- Result: <quoted output after change>
```

## When to stop

Stop and end your turn only when (a) all 13 tasks are done, or (b) you hit a blocker. Do not stop to ask "should I continue?" between tasks. Do not skip a blocked task to work on later ones.

## Final report (your last message)

1. Status: `COMPLETE` or `BLOCKED at Task N Step M`.
2. `git log --oneline feat/physics-01-02 ^main` (real output).
3. The last full `npx vitest run` summary lines — both the file count and the test count — and every `npm run build` output line with its file size (real output).
4. Deviations: the count, and one line each.
5. Everything marked `UNVERIFIED`, `NOT CHECKED`, `LEFT FOR HUMAN`, and every `QUESTION (no change made)` entry.
6. If blocked: the exact error output, what you tried, and what decision you need from me.

Keep the report factual. No "everything works great" summaries. Every claim needs quoted output behind it.
