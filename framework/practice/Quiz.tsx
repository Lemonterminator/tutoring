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
