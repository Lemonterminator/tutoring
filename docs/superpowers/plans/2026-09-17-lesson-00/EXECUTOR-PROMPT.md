# Executor prompt — Lesson 0 plan (paste everything below the line into the agent)

---

You are executing a finished implementation plan. You are not designing anything. The plan already has the exact code, tests, commands and expected output for every step. Your job is to copy it in faithfully, run it, and report **what actually happened**.

## Workspace

- Repo root: `C:\Users\Jiang\Documents\ChatGPT\Tutoring\tutoring` (git repo). Run every command from there.
- OS: Windows 11. Node 24, npm 11. The plan's shell blocks are bash syntax. If your terminal is PowerShell, translate literally (`cp a b` → `Copy-Item a b`, `VAR=x cmd` → `$env:VAR='x'; cmd`) and do not change anything else about the command.
- Before Task 1: `git status` must be clean. Then `git switch -c feat/lesson-00`. All commits go on this branch. Never push.

## Read first, in this order

1. `docs/superpowers/plans/2026-09-17-lesson-00-math-foundations.md` (overview, **Global Constraints**, file map, dependency order)
2. `docs/superpowers/specs/2026-09-17-lesson-framework-design.md` (background only; the task files win if they differ)

Then do the tasks in `docs/superpowers/plans/2026-09-17-lesson-00/task-01-*.md` … `task-15-*.md`, strictly in number order, one at a time.

## Hard rules

1. **The plan is the source of truth.** Copy code blocks character for character. Do not "improve", rename, reformat, reorder, add comments, add error handling, add features, or refactor earlier tasks.
2. **No invented facts.** Do not add a package, version, config option, API, file or function that is not written in the plan. If you think one is missing, that is a blocker (rule 8), not something to fill in.
3. **Re-read before every task.** At the start of each task, open that task file again and read it completely. Do not work from memory of an earlier read. Before using anything listed under **Consumes**, open the real file and confirm the name and signature exist exactly as written.
4. **Every step, every command, really run.** Execute every step in the order given, including "run it to confirm it fails". A step counts as done only when you have seen its actual terminal output.
5. **Never report output you did not see.** The plan's `Expected:` lines are predictions, not results. In your log, quote the real output (the relevant lines: pass/fail summary, test counts, error message). If you did not run it, write `NOT RUN` and why.
6. **Expected vs. actual must match.**
   - "Expected: FAIL" step passes instead → stop and investigate: the test may not be testing anything.
   - Test count differs from `Expected: PASS (N tests)` → it is a mismatch, even if everything is green. Find out why before moving on.
7. **Do not touch tests to get green.** Never edit, skip, `.only`, delete or weaken a test or an assertion to make it pass. Never add `// @ts-ignore`, `any` casts, or `eslint-disable` that are not in the plan.
8. **Fix budget, then stop.** When plan code does not work as written:
   - You may make at most **2** attempts, each a minimal change to implementation (not test) code, based on the actual error message.
   - Log each attempt in `DEVIATIONS.md` (format below).
   - If it is still failing after 2 attempts, or the fix would need a change in a different task's files, or two task files contradict each other, or a test itself looks wrong: **STOP**. Write a blocker entry and end your turn with the blocker report. Do not continue to the next task.
9. **Dependencies are frozen.** Install only what Task 1's `package.json` specifies. No `npm audit fix`, no `npm update`, no version bumps, no `--force` / `--legacy-peer-deps` unless the plan says so. If `npm install` fails, it is a blocker.
10. **Git discipline.**
    - Commit only at the plan's commit steps, with the plan's exact message plus a blank line and `Co-Authored-By: Gemini <noreply@google.com>`.
    - Stage only the files the commit step names. Never `git add -A` or `git add .`.
    - Before each commit, run `git status` and confirm nothing unexpected is staged or modified.
    - Never commit `Textbook_materials/`, `dist/`, `node_modules/`.
    - Never rewrite history (`reset --hard`, `rebase`, `commit --amend`, `push --force`).
11. **Gate before each commit.** Run `npx vitest run` (the whole suite). From Task 4 onward also run `npm run typecheck`. Both must be clean before you commit. If a failure is in an earlier task's code, that is a blocker (rule 8).
12. **Stay in scope.** Only create or modify files listed under the task's **Files:**, plus `EXECUTION-LOG.md` and `DEVIATIONS.md`. Do not delete files, except where the plan says to (e.g. Task 12 removing the smoke lesson).

## Steps that need special handling

- **Task 12, Finnish term check against the PDF** (`Textbook_materials/Physics/15 …pdf`): only confirm or change a term if you actually extracted text that shows it, and log the page and the quoted Finnish word. If you cannot read the PDF, leave `terms.json` as the plan wrote it and log `UNVERIFIED: <term ids>`. Do not guess Finnish terms from memory.
- **Task 14, translation:** first check `curl -s http://localhost:11434/api/tags` lists `qwen3.6:35b-a3b`. If it does not, **STOP** with a blocker. Do not translate the lesson yourself, and do not switch models. The translation run takes several minutes; wait for the process to exit. In the spot check, fix only concrete defects from the Step 7 list, and log every Finnish wording change as `before → after`.
- **Task 15, browser acceptance:** if you have a browser tool, open the `file:///…` URL and check each of the 11 items, logging what you observed for each. If a check is not possible with your tools (e.g. rAF counter, dark mode emulation), mark it `NOT CHECKED (reason)`; do not mark it passed. Step 4 (double-click in Explorer) is for the human: mark it `LEFT FOR HUMAN`.

## Logs (create at the start; do not commit until the end)

`docs/superpowers/plans/2026-09-17-lesson-00/EXECUTION-LOG.md`, one section per task:

```
## Task N — <title>
- Step 1: done
- Step 2: ran `<command>` → FAIL: <quoted error line>
- Step 4: ran `<command>` → <quoted "Tests  X passed (X)" line>
- Gate: vitest <quoted summary>; typecheck <clean | quoted errors>
- Commit: <short hash> "<message>"
```

`docs/superpowers/plans/2026-09-17-lesson-00/DEVIATIONS.md`, one entry per departure from the plan (write `None` if there were none):

```
### Task N Step M — <one line>
- Plan said: <quote>
- Actual output: <quoted error>
- Change made: <file:line, exact diff>
- Result: <quoted output after change>
```

After Task 15, commit both logs: `git add` the two files, message `docs: lesson 0 execution log`.

## When to stop

Stop and end your turn only when:
- (a) all 15 tasks are done, or
- (b) you hit a blocker.

Do not stop to ask "should I continue?" between tasks. Do not skip a blocked task to work on later ones.

## Final report (your last message)

1. Status: `COMPLETE` or `BLOCKED at Task N Step M`.
2. `git log --oneline feat/lesson-00 ^main` (real output).
3. Last full `npx vitest run` summary line and `npm run build` output line with the file size (real output).
4. Deviations: count, and one line each.
5. Items marked `UNVERIFIED`, `NOT CHECKED`, `LEFT FOR HUMAN`.
6. If blocked: the exact error output, what you tried, and what decision you need from me.

Keep the report factual. No "everything works great" summaries; each claim needs quoted output behind it.
