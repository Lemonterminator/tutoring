### Task 14: Finnish translation via local Ollama

**Files:**
- Create: `scripts/translate-lib.ts`, `scripts/translate.ts`
- Modify: `package.json` scripts (`translate`)
- Modify (generated, then spot-checked): `subjects/math/00-wave-math-foundations/lesson.fi.mdx`
- Modify: `subjects/math/00-wave-math-foundations/lesson.test.tsx` (add a Finnish test)
- Test: `scripts/translate-lib.test.ts`

**Interfaces:**
- Consumes: `analyze`, `compareShapes` (Task 13); `TermDict` (Task 2).
- Produces (`translate-lib.ts`): `separateImports(src): { imports: string; body: string }`; `splitSections(body): string[]` (split before each `## `); `buildPrompt(section, terms): string`; `cleanOutput(raw): string` (drops `<think>…</think>` and a wrapping code fence).
- Produces: `npm run translate -- <lessonDir>` — env `OLLAMA_HOST` (default `http://localhost:11434`), `TRANSLATE_MODEL` (default `qwen3.6:35b-a3b`). Each section gets up to 2 attempts; an attempt is accepted when its structure matches the English section (missing glossary entries are ignored at this stage). Writes `lesson.fi.mdx`, then the author runs `npm run check`.

Translation runs on the local GPU (free, no Claude or API quota). Machine translation is the draft; Step 7's spot check is required.

- [ ] **Step 1: Write the failing test**

`scripts/translate-lib.test.ts`:

```ts
import { expect, test } from 'vitest';
import { buildPrompt, cleanOutput, separateImports, splitSections } from './translate-lib';

test('imports stay out of translation', () => {
  const { imports, body } = separateImports("import { A } from './A';\nimport { B } from './B';\n\n## One\n\nText\n");
  expect(imports).toBe("import { A } from './A';\nimport { B } from './B';");
  expect(body).toBe('## One\n\nText\n');
});

test('sections split before every level-2 heading', () => {
  expect(splitSections('## One\n\nA\n\n## Two\n\nB\n')).toEqual(['## One\n\nA', '## Two\n\nB']);
});

test('prompt carries the glossary, the rules and the section', () => {
  const prompt = buildPrompt('## Waves\n\nText', { wave: { en: 'wave', fi: 'aalto' } });
  expect(prompt).toContain('- wave = aalto');
  expect(prompt).toContain('Keep all LaTeX');
  expect(prompt.endsWith('## Waves\n\nText')).toBe(true);
});

test('model output is cleaned of reasoning and code fences', () => {
  expect(cleanOutput('<think>hmm</think>\n```mdx\n## Aallot\n\nTeksti\n```')).toBe('## Aallot\n\nTeksti');
  expect(cleanOutput('## Aallot')).toBe('## Aallot');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/translate-lib.test.ts`
Expected: FAIL — cannot resolve `./translate-lib`.

- [ ] **Step 3: Implement**

`scripts/translate-lib.ts`:

```ts
import type { TermDict } from '../framework/i18n/terms';

export function separateImports(source: string): { imports: string; body: string } {
  const lines = source.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('import ') || lines[i].trim() === '')) i++;
  return { imports: lines.slice(0, i).join('\n').trim(), body: lines.slice(i).join('\n') };
}

export function splitSections(body: string): string[] {
  return body
    .split(/^(?=## )/m)
    .map((section) => section.trim())
    .filter(Boolean);
}

export function buildPrompt(section: string, terms: TermDict): string {
  const glossary = Object.values(terms)
    .map((t) => `- ${t.en} = ${t.fi}`)
    .join('\n');
  return [
    'Translate this MDX lesson section from English to Finnish for students in Finnish upper secondary school (lukio).',
    'Rules:',
    '1. Translate only the human-readable text. Keep every JSX tag, attribute name and attribute value exactly as written, e.g. <Term id="derivative">, <NumericQuiz answer={60} unit="dB">, <Figure id="euler">.',
    '2. Text between <Term id="..."> and </Term> must become the correctly inflected Finnish form of that glossary term.',
    '3. Keep all LaTeX between $ or $$ unchanged.',
    '4. Keep the Markdown structure identical: same headings, same number of paragraphs, same list items, same blank lines, same bold text.',
    '5. Use standard Finnish lukio mathematics and physics terminology. Glossary:',
    glossary,
    '6. Output only the translated MDX. No explanations and no code fences.',
    '',
    '---',
    section,
  ].join('\n');
}

export function cleanOutput(raw: string): string {
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fenced = withoutThinking.match(/^```[a-z]*\s*\n([\s\S]*?)\n```$/);
  return (fenced ? fenced[1] : withoutThinking).trim();
}
```

`scripts/translate.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TermDict } from '../framework/i18n/terms';
import { analyze, compareShapes } from './lesson-shape';
import { buildPrompt, cleanOutput, separateImports, splitSections } from './translate-lib';

const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const model = process.env.TRANSLATE_MODEL ?? 'qwen3.6:35b-a3b';
const MAX_ATTEMPTS = 2;

async function askModel(prompt: string): Promise<string> {
  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      options: { temperature: 0.2, num_ctx: 16384 },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as { message: { content: string } };
  return data.message.content;
}

async function structuralIssues(english: string, finnish: string, terms: TermDict): Promise<string[]> {
  try {
    return compareShapes(await analyze(english), await analyze(finnish), terms).filter((issue) => !issue.startsWith('term "'));
  } catch (error) {
    return [`invalid MDX: ${(error as Error).message}`];
  }
}

const lessonDir = process.argv[2];
if (!lessonDir) {
  console.error('usage: npm run translate -- subjects/<subject>/<slug>');
  process.exit(2);
}

const terms = JSON.parse(readFileSync(join(lessonDir, 'terms.json'), 'utf8')) as TermDict;
const { imports, body } = separateImports(readFileSync(join(lessonDir, 'lesson.en.mdx'), 'utf8'));
const sections = splitSections(body);
const translated: string[] = [];

for (const [index, section] of sections.entries()) {
  let best = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`section ${index + 1}/${sections.length}, attempt ${attempt} (${model})`);
    best = cleanOutput(await askModel(buildPrompt(section, terms)));
    const issues = await structuralIssues(section, best, terms);
    if (issues.length === 0) break;
    console.warn(`  structure mismatch:\n  - ${issues.join('\n  - ')}`);
  }
  translated.push(best);
}

writeFileSync(join(lessonDir, 'lesson.fi.mdx'), `${imports}\n\n${translated.join('\n\n')}\n`);
console.log(`wrote ${join(lessonDir, 'lesson.fi.mdx')} — now run: npm run check`);
```

```bash
npm pkg set scripts.translate="tsx scripts/translate.ts"
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run scripts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit the tool**

```bash
git add scripts/translate-lib.ts scripts/translate-lib.test.ts scripts/translate.ts package.json
git commit -m "feat: section-wise EN→FI lesson translation via local Ollama"
```

- [ ] **Step 6: Translate the lesson**

Check Ollama is serving: `curl -s localhost:11434/api/tags` lists `qwen3.6:35b-a3b`. If not, start `ollama serve`.

Run (takes several minutes; run it in the background and wait for it to exit):

```bash
npm run translate -- subjects/math/00-wave-math-foundations
npm run check
```

Expected: `✔ subjects/math/00-wave-math-foundations: EN and FI match`. If check still reports a section, rerun translate once; if it persists, fix that section of `lesson.fi.mdx` by hand (usually a merged paragraph or a translated attribute).

- [ ] **Step 7: Spot-check the Finnish**

Open `lesson.fi.mdx` and check:
- headings are Finnish and keep their numbers (`## 1. …`);
- every `<Term id>` surface form is an inflected form of its glossary term (e.g. `imaginaariyksikkö`, `kompleksitasossa`);
- no English sentence left untranslated; no LaTeX changed (`git diff --no-index` the `$…$` spans if in doubt);
- `lg`, `dB`, `W/m²`, `rad/s` untouched;
- "trillion" became `biljoona` (not `triljoona`).

Correct any wording by hand, then `npm run check` again.

- [ ] **Step 8: Add a Finnish rendering test**

Append to `subjects/math/00-wave-math-foundations/lesson.test.tsx`:

```tsx
test('the Finnish body is really Finnish and keeps the same structure', () => {
  const { container } = renderLesson();
  const englishHeadings = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  act(() => setLang('fi'));
  const finnishHeadings = Array.from(container.querySelectorAll('article h2'), (h) => h.textContent);
  expect(finnishHeadings).toHaveLength(englishHeadings.length);
  expect(finnishHeadings[1]).not.toBe(englishHeadings[1]);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(4);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(5);
});
```

Run: `npx vitest run subjects/math/00-wave-math-foundations/lesson.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add subjects/math/00-wave-math-foundations/lesson.fi.mdx subjects/math/00-wave-math-foundations/lesson.test.tsx
git commit -m "feat: module 0 Finnish translation (Ollama draft, spot-checked)"
```
