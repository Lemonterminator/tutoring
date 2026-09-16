### Task 1: Toolchain and single-file build

**Files:**
- Create: `.gitignore`, `package.json` (via npm), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `framework/build/rehype-block-ids.ts`, `framework/build/mdx-options.ts`, `framework/types.d.ts`, `framework/test-setup.ts`
- Create: `scripts/lessons.ts`, `scripts/build-all.ts`
- Create (temporary, replaced in Tasks 4 and 12): `subjects/math/00-wave-math-foundations/index.html`, `main.tsx`, `lesson.en.mdx`
- Test: `framework/build/rehype-block-ids.test.ts`, `scripts/lessons.test.ts`

**Interfaces:**
- Produces: `rehypeBlockIds(options?: { onCount?: (count: number) => void })` — sets `data-b="n"` on every `p|h2|h3|li` in document order, `id="sec-n"` on `h2` without id.
- Produces: `remarkPlugins`, `rehypePlugins`, `mdxOptions` from `framework/build/mdx-options.ts`.
- Produces: `findLessons(root = 'subjects'): string[]` (forward-slash paths of dirs containing `index.html`), `outputName(lessonDir): string` → `"<subject>-<slug>.html"`.
- Produces: `npm run build` → `dist/<subject>-<slug>.html`.

- [ ] **Step 1: Initialise the package and install dependencies**

```bash
npm init -y
npm pkg set name=tutoring-lessons private=true type=module
npm pkg set scripts.dev="vite" scripts.test="vitest run" scripts.typecheck="tsc --noEmit" scripts.build="tsx scripts/build-all.ts"
npm install preact @preact/signals
npm install -D vite @preact/preset-vite @mdx-js/rollup @mdx-js/mdx remark-math rehype-katex vite-plugin-singlefile vitest jsdom @testing-library/preact typescript tsx unist-util-visit unified @types/hast @types/node
```

- [ ] **Step 2: Write config files**

`.gitignore`:

```
node_modules/
dist/
Textbook_materials/
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["framework", "subjects", "scripts", "vite.config.ts", "vitest.config.ts"]
}
```

`framework/types.d.ts`:

```ts
declare module '*.mdx' {
  import type { ComponentType } from 'preact';
  const MDXContent: ComponentType<{ components?: Record<string, unknown> }>;
  export default MDXContent;
}
```

`framework/test-setup.ts`:

```ts
// jsdom has no canvas implementation; simulations must cope with a missing 2D context.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
```

- [ ] **Step 3: Write the failing block-id test**

`framework/build/rehype-block-ids.test.ts`:

```ts
import { compile } from '@mdx-js/mdx';
import { expect, test } from 'vitest';
import { rehypeBlockIds } from './rehype-block-ids';

test('numbers p, h2, h3 and li in document order and gives h2 a stable id', async () => {
  let count = -1;
  const out = String(
    await compile('## A\n\nText\n\n- one\n- two\n', {
      jsxImportSource: 'preact',
      rehypePlugins: [[rehypeBlockIds, { onCount: (n: number) => (count = n) }]],
    }),
  );
  expect(count).toBe(4);
  expect(out).toMatch(/"data-b":\s*"0"/);
  expect(out).toMatch(/id:\s*"sec-0"/);
  expect(out).toMatch(/"data-b":\s*"3"/);
});
```

`vitest.config.ts`:

```ts
import mdx from '@mdx-js/rollup';
import { defineConfig } from 'vitest/config';
import { mdxOptions } from './framework/build/mdx-options';

export default defineConfig({
  plugins: [{ enforce: 'pre', ...mdx(mdxOptions) }],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    environment: 'jsdom',
    setupFiles: ['framework/test-setup.ts'],
    include: ['framework/**/*.test.{ts,tsx}', 'subjects/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run framework/build`
Expected: FAIL — cannot resolve `./rehype-block-ids` (and `./framework/build/mdx-options`).

- [ ] **Step 5: Implement the plugin and shared MDX options**

`framework/build/rehype-block-ids.ts`:

```ts
import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

const NUMBERED = new Set(['p', 'h2', 'h3', 'li']);

export type BlockIdOptions = { onCount?: (count: number) => void };

/**
 * Numbers every p/h2/h3/li in document order as data-b="n" and gives each h2 the id "sec-n".
 * EN and FI bodies share structure, so the same n is the same block in both languages.
 */
export function rehypeBlockIds(options: BlockIdOptions = {}) {
  return (tree: Root) => {
    let n = 0;
    visit(tree, 'element', (node: Element) => {
      if (!NUMBERED.has(node.tagName)) return;
      const index = n++;
      node.properties = { ...node.properties, dataB: String(index) };
      if (node.tagName === 'h2' && !node.properties.id) node.properties.id = `sec-${index}`;
    });
    options.onCount?.(n);
  };
}
```

`framework/build/mdx-options.ts`:

```ts
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import type { PluggableList } from 'unified';
import { rehypeBlockIds } from './rehype-block-ids';

export const remarkPlugins: PluggableList = [remarkMath];
// MathML output: browsers render it natively, so no KaTeX CSS or fonts end up in the bundle.
export const rehypePlugins: PluggableList = [[rehypeKatex, { output: 'mathml' }], rehypeBlockIds];
export const mdxOptions = { jsxImportSource: 'preact', remarkPlugins, rehypePlugins };
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npx vitest run framework/build`
Expected: PASS (1 test).

- [ ] **Step 7: Write the failing lesson-discovery test**

`scripts/lessons.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findLessons, outputName } from './lessons';

test('finds lesson directories that contain index.html and skips shared component folders', () => {
  const root = join(mkdtempSync(join(tmpdir(), 'lessons-')), 'subjects');
  for (const dir of ['math/00-a', 'math/_components', 'physics/01-b']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'math/00-a/index.html'), '');
  writeFileSync(join(root, 'math/_components/X.tsx'), '');
  writeFileSync(join(root, 'physics/01-b/index.html'), '');

  expect(findLessons(root).map((p) => p.split('/subjects/')[1])).toEqual(['math/00-a', 'physics/01-b']);
});

test('output file name is subject-slug.html', () => {
  expect(outputName('subjects/math/00-wave-math-foundations')).toBe('math-00-wave-math-foundations.html');
});
```

- [ ] **Step 8: Run it to confirm it fails**

Run: `npx vitest run scripts`
Expected: FAIL — cannot resolve `./lessons`.

- [ ] **Step 9: Implement lesson discovery and the build script**

`scripts/lessons.ts`:

```ts
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Lesson directories are subjects/<subject>/<slug>/ containing index.html. */
export function findLessons(root = 'subjects'): string[] {
  const found: string[] = [];
  for (const subject of readdirSync(root)) {
    const subjectDir = join(root, subject);
    if (!statSync(subjectDir).isDirectory()) continue;
    for (const slug of readdirSync(subjectDir)) {
      const dir = join(subjectDir, slug);
      if (statSync(dir).isDirectory() && existsSync(join(dir, 'index.html'))) found.push(dir.split('\\').join('/'));
    }
  }
  return found.sort();
}

export function outputName(lessonDir: string): string {
  return `${basename(dirname(lessonDir))}-${basename(lessonDir)}.html`;
}
```

`scripts/build-all.ts`:

```ts
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findLessons, outputName } from './lessons';

const MAX_BYTES = 1.5 * 1024 * 1024;

mkdirSync('dist', { recursive: true });
let failed = false;
for (const lesson of findLessons()) {
  execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, LESSON: lesson } });
  const name = outputName(lesson);
  const target = join('dist', name);
  copyFileSync(join('dist/.tmp', name.replace(/\.html$/, ''), 'index.html'), target);
  const bytes = statSync(target).size;
  console.log(`✔ ${target} (${(bytes / 1024).toFixed(0)} KB)`);
  if (bytes > MAX_BYTES) {
    console.error(`✘ ${target} is over the 1.5 MB budget`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
```

`vite.config.ts`:

```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@mdx-js/rollup';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mdxOptions } from './framework/build/mdx-options';
import { outputName } from './scripts/lessons';

const here = dirname(fileURLToPath(import.meta.url));
const lesson = process.env.LESSON ?? 'subjects/math/00-wave-math-foundations';

export default defineConfig({
  root: resolve(here, lesson),
  plugins: [{ enforce: 'pre', ...mdx(mdxOptions) }, preact(), viteSingleFile()],
  build: {
    outDir: resolve(here, 'dist/.tmp', outputName(lesson).replace(/\.html$/, '')),
    emptyOutDir: true,
  },
});
```

- [ ] **Step 10: Run the tests to confirm they pass**

Run: `npx vitest run`
Expected: PASS (3 tests).

- [ ] **Step 11: Add a temporary smoke lesson**

`subjects/math/00-wave-math-foundations/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Module 0</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`subjects/math/00-wave-math-foundations/main.tsx` (temporary):

```tsx
import { render } from 'preact';
import En from './lesson.en.mdx';

render(<En />, document.getElementById('app')!);
```

`subjects/math/00-wave-math-foundations/lesson.en.mdx` (temporary):

```mdx
## Hello

Euler: $e^{i\pi} = -1$
```

- [ ] **Step 12: Build and verify the file opens offline**

Run: `npm run build`
Expected: log line `✔ dist/math-00-wave-math-foundations.html (NN KB)` with NN under 100.

Then open `file:///C:/Users/Jiang/Documents/ChatGPT/Tutoring/tutoring/dist/math-00-wave-math-foundations.html` in the browser pane and run in its console: `[document.querySelector('h2')?.dataset.b, !!document.querySelector('math')]`
Expected: `["0", true]`, and no console errors. Confirm nothing is loaded from outside the file: `grep -cE '<script[^>]+src=|<link[^>]+href=' dist/math-00-wave-math-foundations.html` → `0`.

- [ ] **Step 13: Typecheck and commit**

Run: `npm run typecheck` → no errors.

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts framework scripts subjects
git commit -m "feat: vite+preact+mdx toolchain with single-file lesson build"
```
