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
