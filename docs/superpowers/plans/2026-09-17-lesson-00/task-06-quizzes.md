### Task 6: Quizzes

**Files:**
- Create: `framework/practice/grade.ts`, `framework/practice/Quiz.tsx`
- Modify: `framework/components.ts` (add quiz components)
- Test: `framework/practice/grade.test.ts`, `framework/practice/Quiz.test.tsx`

**Interfaces:**
- Consumes: `tr` (Task 2).
- Produces (`grade.ts`): `parseNumber(input: string): number | null` (accepts `0,5`, `−3`, `6.0e1`, `1 000`); `gradeNumeric(input, answer, rel = 0.02, abs = 0): boolean` — correct when `|x − answer| ≤ max(|answer|·rel, abs)`.
- Produces (`Quiz.tsx`): `NumericQuiz({ answer, unit?, rel?, abs?, children })`, `ChoiceQuiz({ correct /* 0-based */, children })`, `Choice`, `Hint`, `Solution`. Children that are not `Choice/Hint/Solution` form the question body. Solution is rendered only after the first attempt. Feedback is `p.quiz__feedback[role=status]`.

MDX usage (all text is children, so translation never touches attributes):

```mdx
<NumericQuiz answer={60} unit="dB">
Question text.

<Hint>
Hint text.
</Hint>

<Solution>
Solution text.
</Solution>
</NumericQuiz>
```

- [ ] **Step 1: Write the failing tests**

`framework/practice/grade.test.ts`:

```ts
import { expect, test } from 'vitest';
import { gradeNumeric, parseNumber } from './grade';

test.each([
  ['0,5', 0.5],
  [' −3 ', -3],
  ['6.0e1', 60],
  ['1 000', 1000],
  ['abc', null],
  ['', null],
  ['1,2,3', null],
])('parseNumber(%j) = %j', (input, expected) => {
  expect(parseNumber(input)).toBe(expected);
});

test('relative tolerance defaults to 2 %', () => {
  expect(gradeNumeric('59', 60)).toBe(true);
  expect(gradeNumeric('58', 60)).toBe(false);
});

test('absolute tolerance for rounded answers', () => {
  expect(gradeNumeric('73', 73, 0, 0.5)).toBe(true);
  expect(gradeNumeric('72', 73, 0, 0.5)).toBe(false);
});
```

`framework/practice/Quiz.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { Choice, ChoiceQuiz, Hint, NumericQuiz, Solution } from './Quiz';

afterEach(cleanup);

test('numeric quiz accepts a decimal comma and reveals the solution after an attempt', () => {
  render(
    <NumericQuiz answer={0.5} unit="s">
      <p>How long?</p>
      <Hint>Use T = 2π/ω</Hint>
      <Solution>T is half a second</Solution>
    </NumericQuiz>,
  );
  expect(screen.queryByText('T is half a second')).toBeNull();

  const input = screen.getByLabelText('Your answer');
  fireEvent.input(input, { target: { value: '0,7' } });
  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('status').textContent).toContain('Not yet');
  expect(screen.getByText('T is half a second')).toBeTruthy();

  fireEvent.input(input, { target: { value: '0,5' } });
  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('status').textContent).toBe('Correct!');
});

test('choice quiz marks the picked option', () => {
  render(
    <ChoiceQuiz correct={1}>
      <p>Sign at a crest?</p>
      <Choice>Positive</Choice>
      <Choice>Negative</Choice>
      <Solution>Negative.</Solution>
    </ChoiceQuiz>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Positive' }));
  expect(screen.getByRole('button', { name: 'Positive' }).className).toContain('choice--wrong');
  expect(screen.getByRole('status').textContent).toContain('Not yet');

  fireEvent.click(screen.getByRole('button', { name: 'Negative' }));
  expect(screen.getByRole('status').textContent).toBe('Correct!');
  expect(screen.getByText('Negative.')).toBeTruthy();
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run framework/practice`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`framework/practice/grade.ts`:

```ts
/** Accepts the ways students type numbers: decimal comma, typographic minus, spaces, e-notation. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  return Number(s);
}

export function gradeNumeric(input: string, answer: number, rel = 0.02, abs = 0): boolean {
  const value = parseNumber(input);
  if (value === null) return false;
  return Math.abs(value - answer) <= Math.max(Math.abs(answer) * rel, abs);
}
```

`framework/practice/Quiz.tsx`:

```tsx
import { isValidElement, toChildArray, type ComponentChildren, type VNode } from 'preact';
import { useState } from 'preact/hooks';
import { tr } from '../i18n/ui';
import { gradeNumeric } from './grade';

type Kids = { children?: ComponentChildren };
type Verdict = 'correct' | 'wrong' | null;

export const Hint = ({ children }: Kids) => (
  <details class="quiz__hint">
    <summary>{tr('hint')}</summary>
    {children}
  </details>
);

export const Solution = ({ children }: Kids) => (
  <details class="quiz__solution">
    <summary>{tr('solution')}</summary>
    {children}
  </details>
);

export const Choice = ({ children }: Kids) => <>{children}</>;

function splitChildren(children: ComponentChildren) {
  const body: ComponentChildren[] = [];
  const choices: VNode[] = [];
  let hint: VNode | null = null;
  let solution: VNode | null = null;
  for (const child of toChildArray(children)) {
    if (isValidElement(child) && child.type === Hint) hint = child;
    else if (isValidElement(child) && child.type === Solution) solution = child;
    else if (isValidElement(child) && child.type === Choice) choices.push(child);
    else body.push(child);
  }
  return { body, choices, hint, solution };
}

function Feedback({ verdict }: { verdict: Verdict }) {
  if (!verdict) return null;
  return (
    <p class={`quiz__feedback quiz__feedback--${verdict}`} role="status">
      {verdict === 'correct' ? tr('correct') : tr('tryAgain')}
    </p>
  );
}

type NumericProps = Kids & { answer: number; unit?: string; rel?: number; abs?: number };

export function NumericQuiz({ answer, unit, rel = 0.02, abs = 0, children }: NumericProps) {
  const { body, hint, solution } = splitChildren(children);
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [attempted, setAttempted] = useState(false);

  function check(event: Event) {
    event.preventDefault();
    setAttempted(true);
    setVerdict(gradeNumeric(value, answer, rel, abs) ? 'correct' : 'wrong');
  }

  return (
    <div class="quiz">
      <div class="quiz__label">✏️ {tr('practice')}</div>
      {body}
      <form class="quiz__row" onSubmit={check}>
        <input
          class="quiz__input"
          inputMode="decimal"
          aria-label={tr('answerPlaceholder')}
          placeholder={tr('answerPlaceholder')}
          value={value}
          onInput={(e) => {
            setValue((e.target as HTMLInputElement).value);
            setVerdict(null);
          }}
        />
        {unit && <span class="quiz__unit">{unit}</span>}
        <button type="submit" class="btn">
          {tr('check')}
        </button>
      </form>
      <Feedback verdict={verdict} />
      {hint}
      {attempted && solution}
    </div>
  );
}

export function ChoiceQuiz({ correct, children }: Kids & { correct: number }) {
  const { body, choices, hint, solution } = splitChildren(children);
  const [picked, setPicked] = useState<number | null>(null);
  const verdict: Verdict = picked === null ? null : picked === correct ? 'correct' : 'wrong';

  return (
    <div class="quiz">
      <div class="quiz__label">✏️ {tr('practice')}</div>
      {body}
      <div class="quiz__choices" role="group">
        {choices.map((choice, i) => {
          const state = picked === i ? (i === correct ? ' choice--correct' : ' choice--wrong') : '';
          return (
            <button key={i} type="button" class={`choice${state}`} aria-pressed={picked === i} onClick={() => setPicked(i)}>
              {choice}
            </button>
          );
        })}
      </div>
      <Feedback verdict={verdict} />
      {hint}
      {picked !== null && solution}
    </div>
  );
}
```

Modify `framework/components.ts` to:

```ts
import { Figure } from './ask/Figure';
import { Beyond, ExamTip, Syllabus } from './blocks/Blocks';
import { Term } from './i18n/Term';
import { Choice, ChoiceQuiz, Hint, NumericQuiz, Solution } from './practice/Quiz';

/** Components every lesson body can use without importing them. */
export const frameworkComponents = { Term, Syllabus, Beyond, ExamTip, Figure, NumericQuiz, ChoiceQuiz, Choice, Hint, Solution };
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run framework/practice`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add framework/practice framework/components.ts
git commit -m "feat: numeric and multiple-choice quizzes with hints and solutions"
```
