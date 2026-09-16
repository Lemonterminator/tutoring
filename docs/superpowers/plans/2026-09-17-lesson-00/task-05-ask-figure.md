### Task 5: Figures and "ask about this"

**Files:**
- Create: `framework/ask/question.ts`, `framework/ask/provider.ts`, `framework/ask/AskButton.tsx`, `framework/ask/Figure.tsx`
- Modify: `framework/components.ts` (add `Figure`)
- Test: `framework/ask/question.test.ts`, `framework/ask/Figure.test.tsx`

**Interfaces:**
- Consumes: `LessonContext`, `InertContext` (Task 2); `displayLang`, `Lang` (Task 2); `tr` (Task 2).
- Produces (`question.ts`): `type AskContext = { lessonId: string; lessonTitle: string; where: string; lang: Lang; state?: Record<string, unknown> }`; `formatValue(v: unknown): string`; `buildQuestion(ctx: AskContext): string`.
- Produces (`provider.ts`): `type AskResult = 'copied' | 'failed'`; `type AskProvider = (text: string, ctx: AskContext) => Promise<AskResult>`; `clipboardProvider`; `setAskProvider(p)`; `getAskProvider()`. A future AI tutor replaces the provider; nothing else changes.
- Produces (`Figure.tsx`): `<Figure id="…">simulation</Figure>`; `useReportState(): (patch: Record<string, unknown>) => void` for simulations. Inside `InertContext` the figure renders an empty `div.figure--inert`.

- [ ] **Step 1: Write the failing tests**

`framework/ask/question.test.ts`:

```ts
import { expect, test } from 'vitest';
import { buildQuestion } from './question';

const base = { lessonId: 'math-00', lessonTitle: 'Module 0', where: 'figure "euler"', lang: 'fi' as const };

test('builds a paste-ready question with rounded settings', () => {
  expect(buildQuestion({ ...base, state: { omega: 1.23456, playing: true } })).toBe(
    'Lesson: Module 0 [math-00]\nWhere: figure "euler"\nLanguage: FI\nSettings: omega=1.23, playing=true\n\nMy question: ',
  );
});

test('omits the settings line when nothing was reported', () => {
  expect(buildQuestion({ ...base, state: {} })).not.toContain('Settings');
});
```

`framework/ask/Figure.test.tsx`:

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { useEffect } from 'preact/hooks';
import { afterEach, expect, test } from 'vitest';
import { InertContext } from '../layout/LessonContext';
import { Figure, useReportState } from './Figure';
import { clipboardProvider, setAskProvider } from './provider';

function Reporter() {
  const report = useReportState();
  useEffect(() => report({ omega: 2.51234, mode: 'dt' }), []);
  return <p>sim</p>;
}

afterEach(() => {
  cleanup();
  setAskProvider(clipboardProvider);
});

test('the ask button sends the figure id and reported settings to the provider', async () => {
  let sent = '';
  setAskProvider(async (text) => {
    sent = text;
    return 'copied';
  });
  render(
    <Figure id="euler">
      <Reporter />
    </Figure>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Ask about this/ }));
  });
  expect(sent).toContain('Where: figure "euler"');
  expect(sent).toContain('Settings: omega=2.51, mode=dt');
  expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into our chat.');
});

test('an inert figure renders nothing inside', () => {
  const { container } = render(
    <InertContext.Provider value={true}>
      <Figure id="x">
        <Reporter />
      </Figure>
    </InertContext.Provider>,
  );
  expect(container.textContent).toBe('');
  expect(container.querySelector('.figure--inert')).not.toBeNull();
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run framework/ask`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`framework/ask/question.ts`:

```ts
import type { Lang } from '../i18n/state';

export type AskContext = {
  lessonId: string;
  lessonTitle: string;
  where: string;
  lang: Lang;
  state?: Record<string, unknown>;
};

export function formatValue(value: unknown): string {
  return typeof value === 'number' ? String(Number(value.toPrecision(3))) : String(value);
}

/** Text the student pastes into the tutor chat; the tutor sees exactly what the student was looking at. */
export function buildQuestion(ctx: AskContext): string {
  const lines = [`Lesson: ${ctx.lessonTitle} [${ctx.lessonId}]`, `Where: ${ctx.where}`, `Language: ${ctx.lang.toUpperCase()}`];
  const settings = Object.entries(ctx.state ?? {});
  if (settings.length > 0) lines.push(`Settings: ${settings.map(([k, v]) => `${k}=${formatValue(v)}`).join(', ')}`);
  lines.push('', 'My question: ');
  return lines.join('\n');
}
```

`framework/ask/provider.ts`:

```ts
import type { AskContext } from './question';

export type AskResult = 'copied' | 'failed';
export type AskProvider = (text: string, ctx: AskContext) => Promise<AskResult>;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API missing or blocked: fall back to a hidden textarea.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export const clipboardProvider: AskProvider = async (text) => ((await copyText(text)) ? 'copied' : 'failed');

let current: AskProvider = clipboardProvider;

/** Swap point for a future in-page AI tutor. */
export function setAskProvider(provider: AskProvider): void {
  current = provider;
}

export function getAskProvider(): AskProvider {
  return current;
}
```

`framework/ask/AskButton.tsx`:

```tsx
import { useContext, useState } from 'preact/hooks';
import { displayLang } from '../i18n/state';
import { tr } from '../i18n/ui';
import { LessonContext } from '../layout/LessonContext';
import { getAskProvider, type AskResult } from './provider';
import { buildQuestion, type AskContext } from './question';

export function AskButton({ where, getState }: { where: string; getState?: () => Record<string, unknown> }) {
  const { meta } = useContext(LessonContext);
  const [result, setResult] = useState<AskResult | null>(null);

  async function ask() {
    const ctx: AskContext = { lessonId: meta.id, lessonTitle: meta.title.en, where, lang: displayLang.value, state: getState?.() };
    setResult(await getAskProvider()(buildQuestion(ctx), ctx));
  }

  return (
    <div class="ask">
      <button type="button" class="btn btn--ghost" onClick={ask}>
        💬 {tr('ask')}
      </button>
      {result && (
        <span class="ask__status" role="status">
          {result === 'copied' ? tr('copied') : tr('copyFailed')}
        </span>
      )}
    </div>
  );
}
```

`framework/ask/Figure.tsx`:

```tsx
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useRef } from 'preact/hooks';
import { InertContext } from '../layout/LessonContext';
import { AskButton } from './AskButton';

type Report = (patch: Record<string, unknown>) => void;

const ReportContext = createContext<Report>(() => {});

/** Simulations call this to publish their current settings for the ask button. */
export function useReportState(): Report {
  return useContext(ReportContext);
}

export function Figure({ id, children }: { id: string; children?: ComponentChildren }) {
  const inert = useContext(InertContext);
  const state = useRef<Record<string, unknown>>({});
  const report = useRef<Report>((patch) => {
    state.current = { ...state.current, ...patch };
  });

  if (inert) return <div class="figure figure--inert" />;

  return (
    <figure class="figure" id={`fig-${id}`}>
      <ReportContext.Provider value={report.current}>{children}</ReportContext.Provider>
      <AskButton where={`figure "${id}"`} getState={() => state.current} />
    </figure>
  );
}
```

Modify `framework/components.ts` to:

```ts
import { Figure } from './ask/Figure';
import { Beyond, ExamTip, Syllabus } from './blocks/Blocks';
import { Term } from './i18n/Term';

/** Components every lesson body can use without importing them. */
export const frameworkComponents = { Term, Syllabus, Beyond, ExamTip, Figure };
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run framework`
Expected: PASS (all framework tests, including 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add framework/ask framework/components.ts
git commit -m "feat: Figure with state reporting and swappable ask provider"
```
