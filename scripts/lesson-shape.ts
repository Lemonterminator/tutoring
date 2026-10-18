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

/** LLM course pages use the independent English/Simplified-Chinese pair. */
export async function checkCourseLesson(dir: string): Promise<string[]> {
  const read = (file: string) => readFileSync(join(dir, file), 'utf8');
  try {
    const enSource = read('lesson.en.mdx');
    const zhSource = read('lesson.zh.mdx');
    const en = await analyze(enSource);
    const zh = await analyze(zhSource);
    const issues: string[] = [];
    if (en.components.join(' ') !== zh.components.join(' ')) issues.push(`component sequence differs: en=[${en.components.join(' ')}] zh=[${zh.components.join(' ')}]`);
    if (en.imports.join('\n') !== zh.imports.join('\n')) issues.push('import lines differ');
    if (en.termIds.join(' ') !== zh.termIds.join(' ')) issues.push(`Term ids differ: en=[${en.termIds.join(' ')}] zh=[${zh.termIds.join(' ')}]`);
    const enWidgets = [...enSource.matchAll(/<CourseWidget\s+id="([^"]+)"\s*\/>/g)].map((match) => match[1]);
    const zhWidgets = [...zhSource.matchAll(/<CourseWidget\s+id="([^"]+)"\s*\/>/g)].map((match) => match[1]);
    if (enWidgets.join(' ') !== zhWidgets.join(' ')) issues.push(`CourseWidget ids differ: en=[${enWidgets.join(' ')}] zh=[${zhWidgets.join(' ')}]`);
    return issues;
  } catch (error) {
    return [`cannot analyse: ${(error as Error).message}`];
  }
}
