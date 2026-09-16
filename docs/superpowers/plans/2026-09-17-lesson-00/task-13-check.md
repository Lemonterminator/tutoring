### Task 13: EN/FI structure check

**Files:**
- Create: `scripts/lesson-shape.ts`, `scripts/check.ts`
- Modify: `package.json` scripts (`check`, `build`)
- Test: `scripts/lesson-shape.test.ts`

**Interfaces:**
- Consumes: `remarkPlugins` (Task 1), `rehypeBlockIds` (Task 1), `findLessons` (Task 1), `TermDict` (Task 2).
- Produces: `type LessonShape = { blocks: number; math: number; components: string[]; imports: string[]; termIds: string[] /* sorted */ }`; `analyze(source: string): Promise<LessonShape>` (throws on invalid MDX); `compareShapes(en, fi, terms): string[]` — messages start with `block count differs`, `math count differs`, `component sequence differs`, `import lines differ`, `Term ids differ`, or `term "<id>" is missing en or fi in terms.json`; `checkLesson(dir): Promise<string[]>`.
- Produces: `npm run check` (exit 1 on any issue) and `npm run build` = check, then build-all.

Why these checks: exam-mode hover pairs blocks by index, so block counts must match; components, imports, math and term ids must survive translation untouched. Term ids are compared as a sorted list because Finnish word order may move them within a sentence.

- [ ] **Step 1: Write the failing test**

`scripts/lesson-shape.test.ts`:

```ts
import { expect, test } from 'vitest';
import { analyze, compareShapes } from './lesson-shape';

const en = `import { X } from './X';

## Title

A <Term id="wave">wave</Term> and $x$.

<Figure id="f">
  <X />
</Figure>
`;

const fi = `import { X } from './X';

## Otsikko

<Term id="wave">Aalto</Term> ja $x$.

<Figure id="f">
  <X />
</Figure>
`;

const terms = { wave: { en: 'wave', fi: 'aalto' } };

test('analyze counts blocks, math, components, imports and term ids', async () => {
  expect(await analyze(en)).toEqual({
    blocks: 2,
    math: 1,
    components: ['Figure', 'X'],
    imports: ["import { X } from './X';"],
    termIds: ['wave'],
  });
});

test('a faithful translation has no issues', async () => {
  expect(compareShapes(await analyze(en), await analyze(fi), terms)).toEqual([]);
});

test('a dropped paragraph and a missing glossary entry are reported', async () => {
  const broken = fi.replace('<Term id="wave">Aalto</Term> ja $x$.\n\n', '');
  const issues = compareShapes(await analyze(en), await analyze(broken), {});
  expect(issues).toContain('block count differs: en=2 fi=1');
  expect(issues).toContain('math count differs: en=1 fi=0');
  expect(issues).toContain('term "wave" is missing en or fi in terms.json');
});

test('invalid MDX throws', async () => {
  await expect(analyze('<Figure id="f">\n')).rejects.toThrow();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/lesson-shape.test.ts`
Expected: FAIL — cannot resolve `./lesson-shape`.

- [ ] **Step 3: Implement**

`scripts/lesson-shape.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '@mdx-js/mdx';
import { visit } from 'unist-util-visit';
import { remarkPlugins } from '../framework/build/mdx-options';
import { rehypeBlockIds } from '../framework/build/rehype-block-ids';
import type { TermDict } from '../framework/i18n/terms';

export type LessonShape = { blocks: number; math: number; components: string[]; imports: string[]; termIds: string[] };

type MdxNode = { type: string; name?: string | null; attributes?: { name?: string; value?: unknown }[] };

export async function analyze(source: string): Promise<LessonShape> {
  const shape: LessonShape = {
    blocks: 0,
    math: 0,
    components: [],
    imports: source.split(/\r?\n/).filter((line) => line.startsWith('import ')).map((line) => line.trim()),
    termIds: [],
  };

  const collect = () => (tree: any) => {
    visit(tree, (node: MdxNode) => {
      if (node.type === 'math' || node.type === 'inlineMath') shape.math++;
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name) {
        if (node.name === 'Term') shape.termIds.push(String(node.attributes?.find((a) => a.name === 'id')?.value ?? ''));
        else shape.components.push(node.name);
      }
    });
  };

  await compile(source, {
    jsxImportSource: 'preact',
    remarkPlugins: [...remarkPlugins, collect],
    rehypePlugins: [[rehypeBlockIds, { onCount: (n: number) => (shape.blocks = n) }]],
  });
  shape.termIds.sort();
  return shape;
}

export function compareShapes(en: LessonShape, fi: LessonShape, terms: TermDict): string[] {
  const issues: string[] = [];
  if (en.blocks !== fi.blocks) issues.push(`block count differs: en=${en.blocks} fi=${fi.blocks}`);
  if (en.math !== fi.math) issues.push(`math count differs: en=${en.math} fi=${fi.math}`);
  if (en.components.join(' ') !== fi.components.join(' ')) {
    issues.push(`component sequence differs: en=[${en.components.join(' ')}] fi=[${fi.components.join(' ')}]`);
  }
  if (en.imports.join('\n') !== fi.imports.join('\n')) issues.push('import lines differ');
  if (en.termIds.join(' ') !== fi.termIds.join(' ')) issues.push(`Term ids differ: en=[${en.termIds.join(' ')}] fi=[${fi.termIds.join(' ')}]`);
  for (const id of new Set([...en.termIds, ...fi.termIds])) {
    if (!terms[id]?.en || !terms[id]?.fi) issues.push(`term "${id}" is missing en or fi in terms.json`);
  }
  return issues;
}

export async function checkLesson(dir: string): Promise<string[]> {
  const read = (file: string) => readFileSync(join(dir, file), 'utf8');
  try {
    const terms = JSON.parse(read('terms.json')) as TermDict;
    return compareShapes(await analyze(read('lesson.en.mdx')), await analyze(read('lesson.fi.mdx')), terms);
  } catch (error) {
    return [`cannot analyse: ${(error as Error).message}`];
  }
}
```

`scripts/check.ts`:

```ts
import { checkLesson } from './lesson-shape';
import { findLessons } from './lessons';

let failed = false;
for (const dir of findLessons()) {
  const issues = await checkLesson(dir);
  if (issues.length === 0) {
    console.log(`✔ ${dir}: EN and FI match`);
  } else {
    failed = true;
    console.error(`✘ ${dir}\n  - ${issues.join('\n  - ')}`);
  }
}
process.exit(failed ? 1 : 0);
```

```bash
npm pkg set scripts.check="tsx scripts/check.ts" scripts.build="tsx scripts/check.ts && tsx scripts/build-all.ts"
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run scripts`
Expected: PASS (6 tests: 2 lessons + 4 lesson-shape).

- [ ] **Step 5: Run the check on the real lesson**

Run: `npm run check`
Expected: `✔ subjects/math/00-wave-math-foundations: EN and FI match` (the Finnish file is still a copy).

Then prove it catches a real mistake: delete one paragraph from `lesson.fi.mdx`, run `npm run check`, expect exit code 1 with `block count differs`, and restore the file with `cp subjects/math/00-wave-math-foundations/lesson.en.mdx subjects/math/00-wave-math-foundations/lesson.fi.mdx`.

- [ ] **Step 6: Commit**

```bash
git add scripts/lesson-shape.ts scripts/lesson-shape.test.ts scripts/check.ts package.json
git commit -m "feat: EN/FI lesson structure check gating the build"
```
