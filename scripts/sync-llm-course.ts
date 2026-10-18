import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const scriptDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, '').replace(/^([A-Za-z]):/, '$1:'));
const repoRoot = resolve(scriptDir, '..');
const courseRoot = process.env.LLM_COURSE_ROOT ?? resolve(scriptDir, '..', '..', '..', 'LLM study', 'course');
const contentRoot = join(courseRoot, 'content');
const subjectsRoot = join(repoRoot, 'subjects', 'llm');
const computeRoot = join(repoRoot, 'framework', 'course', 'compute');

type LessonFrontmatter = {
  id: string;
  title: string;
  module: string;
  prereqs: string[];
  estimatedHours?: number;
  spineA: string;
  spineB: string;
  derivations: string[];
  visualizations: string[];
  assignment: string;
  references: string[];
};

type SyncedLessonMeta = {
  id: string;
  module: string;
  title: { en: string; zh: string };
  prereqs: string[];
  estimatedHours?: number;
  spine: { en: { a: string; b: string }; zh: { a: string; b: string } };
  derivations: string[];
  visualizations: string[];
  assignment: string;
  references: string[];
};

function parseList(raw: string): string[] {
  const inner = raw.match(/^\[([\s\S]*)\]$/)?.[1] ?? raw;
  return inner.split(',').map((value) => value.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function splitFrontmatter(source: string): { meta: LessonFrontmatter; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/m);
  if (!match) throw new Error('LLM lesson is missing YAML frontmatter');
  const block = match[1];
  const field = (name: string) => block.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
  const estimatedHours = Number(field('estimated_hours'));
  return {
    meta: {
      id: field('id'),
      title: field('title').replace(/^['"]|['"]$/g, ''),
      module: field('module'),
      prereqs: parseList(field('prereqs')),
      estimatedHours: Number.isFinite(estimatedHours) ? estimatedHours : undefined,
      spineA: field('spine_a'),
      spineB: field('spine_b'),
      derivations: parseList(field('derivations')),
      visualizations: parseList(field('visualizations')),
      assignment: field('assignment'),
      references: parseList(field('references')),
    },
    body: source.slice(match[0].length).trimStart(),
  };
}

function withWidgets(source: string, ids: string[]): string {
  if (ids.length === 0) return source;
  const block = ids.map((id) => `<CourseWidget id="${id}" />`).join('\n\n');
  const heading = /^## 5(?:\.|。)[^\r\n]*$/m;
  return heading.test(source) ? source.replace(heading, (line) => `${line}\n\n${block}`) : `${source}\n\n${block}\n`;
}

function writeLessonFiles(dir: string, english: string, chinese: string, meta: SyncedLessonMeta) {
  mkdirSync(dir, { recursive: true });
  // Frontmatter is build metadata, not lesson prose. Keep it in meta.json so it
  // becomes a structured index instead of an accidental first TOC heading.
  writeFileSync(join(dir, 'lesson.en.mdx'), withWidgets(english, meta.visualizations), 'utf8');
  writeFileSync(join(dir, 'lesson.zh.mdx'), withWidgets(chinese, meta.visualizations), 'utf8');
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ subject: 'llm', ...meta }, null, 2), 'utf8');
  writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LLM Architecture Course</title>
  </head>
  <body><div id="app"></div><script type="module" src="./main.tsx"></script></body>
</html>
`, 'utf8');
  writeFileSync(join(dir, 'main.tsx'), `import { render } from 'preact';
import '../../../framework/theme/index.css';
import { CourseLesson, type CourseLessonMeta } from '../../../framework/layout/CourseLesson';
import En from './lesson.en.mdx';
import Zh from './lesson.zh.mdx';
import meta from './meta.json';

render(<CourseLesson meta={meta as CourseLessonMeta} En={En} Zh={Zh} />, document.getElementById('app')!);
`, 'utf8');
}

function syncComputes() {
  mkdirSync(computeRoot, { recursive: true });
  const sourceCompute = join(courseRoot, 'viz', 'compute');
  for (const file of readdirSync(sourceCompute).filter((name) => name.endsWith('.ts'))) {
    copyFileSync(join(sourceCompute, file), join(computeRoot, file));
  }
  copyFileSync(join(courseRoot, 'code', 'minilm', 'architecture_cards.ts'), join(computeRoot, 'architecture_cards.ts'));
  const comparator = join(computeRoot, 'architecture_comparator.ts');
  const source = readFileSync(comparator, 'utf8').replace(/['"]\.\.\/\.\.\/code\/minilm\/architecture_cards\.ts['"]/, "'./architecture_cards'").replace(/(['"]\.\/architecture_cards)\.ts(['"])/, '$1$2');
  writeFileSync(comparator, source, 'utf8');
}

function syncLessons(): number {
  mkdirSync(subjectsRoot, { recursive: true });
  let count = 0;
  const moduleDirs = readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  for (const moduleDir of moduleDirs) {
    const sourceDir = join(contentRoot, moduleDir.name);
    const files = readdirSync(sourceDir)
      .filter((name) => name.endsWith('.en.mdx'))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    for (const file of files) {
      const englishPath = join(sourceDir, file);
      const chinesePath = englishPath.replace(/\.en\.mdx$/, '.zh.mdx');
      const en = splitFrontmatter(readFileSync(englishPath, 'utf8'));
      const zh = splitFrontmatter(readFileSync(chinesePath, 'utf8'));
      const meta: SyncedLessonMeta = {
        id: en.meta.id,
        module: en.meta.module,
        title: { en: en.meta.title, zh: zh.meta.title },
        prereqs: en.meta.prereqs,
        estimatedHours: en.meta.estimatedHours,
        spine: { en: { a: en.meta.spineA, b: en.meta.spineB }, zh: { a: zh.meta.spineA, b: zh.meta.spineB } },
        derivations: en.meta.derivations,
        visualizations: en.meta.visualizations,
        assignment: en.meta.assignment,
        references: en.meta.references,
      };
      const slug = basename(file, '.en.mdx');
      writeLessonFiles(join(subjectsRoot, slug), en.body, zh.body, meta);
      count += 1;
    }
  }
  return count;
}

function syncLessonCatalog() {
  const subjectsDir = join(repoRoot, 'subjects');
  const entries: Array<Record<string, unknown>> = [];
  for (const subjectEntry of readdirSync(subjectsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const subjectRoot = join(subjectsDir, subjectEntry.name);
    for (const lessonEntry of readdirSync(subjectRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const metaPath = join(subjectRoot, lessonEntry.name, 'meta.json');
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { id: string; module?: string; kind?: 'game' | 'game-index'; gameGroup?: string; sourceLesson?: string; title: Record<string, string> };
        entries.push({
          subject: subjectEntry.name,
          slug: lessonEntry.name,
          id: meta.id,
          module: meta.module,
          kind: meta.kind,
          gameGroup: meta.gameGroup,
          sourceLesson: meta.sourceLesson,
          title: meta.title,
          devHref: `/subjects/${subjectEntry.name}/${lessonEntry.name}/index.html`,
          buildHref: `./${subjectEntry.name}-${lessonEntry.name}.html`,
        });
      } catch {
        // A subject directory without a lesson meta file is not a lesson page.
      }
    }
  }
  entries.sort((left, right) => `${left.subject}:${left.id}`.localeCompare(`${right.subject}:${right.id}`, undefined, { numeric: true }));
  const output = `// Generated by scripts/sync-llm-course.ts. Do not edit by hand.\nimport type { LessonNavigationMeta } from './LessonNavigation';\n\nexport type LessonCatalogEntry = {\n  subject: string;\n  slug: string;\n  id: string;\n  module?: string;\n  kind?: 'game' | 'game-index';\n  gameGroup?: string;\n  sourceLesson?: string;\n  title: { en: string; fi?: string; zh?: string };\n  devHref: string;\n  buildHref: string;\n};\n\nexport const lessonIndexHref = { dev: '/', build: './index.html' } as const;\nexport const lessonCatalog: LessonCatalogEntry[] = ${JSON.stringify(entries, null, 2)};\n\nexport function getLessonNavigation(subject: string, id: string): LessonNavigationMeta {\n  const current = lessonCatalog.find((entry) => entry.subject === subject && entry.id === id);\n  const hub = lessonCatalog.find((entry) => entry.kind === 'game-index');\n  const sequence = lessonCatalog.filter((entry) => {\n    if (entry.subject !== subject) return false;\n    if (current?.kind === 'game') return entry.kind === 'game' && (entry.gameGroup ?? 'foundations') === (current.gameGroup ?? 'foundations');\n    if (current?.kind === 'game-index') return entry.id === id;\n    return entry.kind !== 'game' && entry.kind !== 'game-index';\n  });\n  if (current?.kind === 'game') sequence.sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));\n  const index = sequence.findIndex((entry) => entry.id === id);\n  return {\n    previous: index > 0 ? sequence[index - 1] : undefined,\n    next: index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : undefined,\n    indexHref: current?.kind === 'game' && hub ? { dev: hub.devHref, build: hub.buildHref } : lessonIndexHref,\n  };\n}\n`;
  writeFileSync(join(repoRoot, 'framework', 'layout', 'lesson-catalog.ts'), output, 'utf8');
}

const catalogOnly = process.argv.includes('--catalog-only');
if (!catalogOnly) syncComputes();
const count = catalogOnly ? 0 : syncLessons();
syncLessonCatalog();
console.log(catalogOnly ? 'Regenerated the lesson catalog.' : `Synced ${count} LLM lessons, the reusable lesson catalog, and compute modules from ${courseRoot}`);
