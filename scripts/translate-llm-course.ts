import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from './lesson-shape';

type LessonMeta = { id: string; title: string };
type TranslationRecord = { id: string; source: string; output: string; model: string; sections: number; sourceSha256: string; outputSha256: string; promoted: boolean };
type RuntimeEvidence = {
  apiVersion: string;
  modelDigest: string;
  modelModifiedAt: string | null;
  modelFamily: string | null;
  parameterSize: string | null;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const courseRoot = process.env.LLM_COURSE_ROOT ?? resolve(here, '..', '..', '..', 'LLM study', 'course');
const model = process.env.TRANSLATE_MODEL ?? 'qwen3.5:27b';
const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const maxAttempts = 2;
const lessonFilter = process.argv.find((arg) => arg.startsWith('--lesson='))?.slice('--lesson='.length);
const promote = process.argv.includes('--promote');
const all = process.argv.includes('--all');
const resume = process.argv.includes('--resume');

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function fetchRuntimeEvidence(): Promise<RuntimeEvidence> {
  const versionResponse = await fetch(`${host}/api/version`);
  if (!versionResponse.ok) throw new Error(`Ollama version ${versionResponse.status}: ${await versionResponse.text()}`);
  const version = await versionResponse.json() as { version?: string };
  const showResponse = await fetch(`${host}/api/show`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: model }),
  });
  if (!showResponse.ok) throw new Error(`Ollama model metadata ${showResponse.status}: ${await showResponse.text()}`);
  const show = await showResponse.json() as {
    modelfile?: string;
    modified_at?: string;
    details?: { family?: string; parameter_size?: string };
  };
  const digest = show.modelfile?.match(/sha256-[0-9a-f]{64}/i)?.[0];
  if (!version.version || !digest) throw new Error('Ollama runtime evidence is missing version or model digest');
  return {
    apiVersion: version.version,
    modelDigest: digest,
    modelModifiedAt: show.modified_at ?? null,
    modelFamily: show.details?.family ?? null,
    parameterSize: show.details?.parameter_size ?? null,
  };
}

function parseMeta(source: string): LessonMeta {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? '';
  return {
    id: block.match(/^id:\s*(.+)$/m)?.[1]?.trim() ?? 'unknown',
    title: (block.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? '').replace(/^['"]|['"]$/g, ''),
  };
}

function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/m);
  if (!match) throw new Error('lesson is missing YAML frontmatter');
  return { frontmatter: match[0].trimEnd(), body: source.slice(match[0].length).trim() };
}

function splitSections(body: string): string[] {
  return body.split(/^(?=## )/m).map((part) => part.trim()).filter(Boolean);
}

function visibleFrontmatterLines(frontmatter: string): string[] {
  return frontmatter.split(/\r?\n/).filter((line) => /^(?:title|spine_a|spine_b):\s*/.test(line));
}

function replaceVisibleFrontmatter(frontmatter: string, translatedLines: string[]): string {
  const translatedByKey = new Map(translatedLines.map((line) => {
    const match = line.match(/^(title|spine_a|spine_b):\s*(.*)$/);
    return [match?.[1] ?? '', match?.[2] ?? ''] as const;
  }));
  return frontmatter.split(/\r?\n/).map((line) => {
    const key = line.match(/^(title|spine_a|spine_b):\s*/)?.[1];
    return key && translatedByKey.has(key) ? `${key}: ${translatedByKey.get(key)}` : line;
  }).join('\n');
}

function protectedTokens(source: string): string[] {
  const tokens: string[] = [];
  const patterns = [
    /\$\$[\s\S]*?\$\$/g,
    /(?<!\$)\$(?!\$)[\s\S]*?(?<!\$)\$(?!\$)/g,
    /`[^`\n]*`/g,
    /\]\(https?:\/\/[^)\s]+\)/g,
    /https?:\/\/[^)\s]+/g,
    /\b(?:D|V|A)-M[0-9.]+-[0-9A-Za-z.-]+\b/g,
  ];
  for (const pattern of patterns) tokens.push(...(source.match(pattern) ?? []));
  return tokens.map((token) => token.replace(/[.,;:!?，。；：！？、）】〉》]+$/u, ''));
}

function headingShape(source: string): string[] {
  return source.match(/^#{1,6} .*$/gm) ?? [];
}

function structureSignature(source: string): string[] {
  return source.split(/\r?\n/).map((line) => {
    if (line.trim() === '') return 'blank';
    if (/^[ \t]*#{1,6}[ \t]+/.test(line)) return `heading:${line.match(/^[ \t]*(#{1,6})/)?.[1].length ?? 0}`;
    if (/^[ \t]*\d+\.[ \t]+/.test(line)) return 'ordered-list';
    if (/^[ \t]*[-*+][ \t]+/.test(line)) return `unordered-list:${line.trimStart()[0]}`;
    if (/^[ \t]*>[ \t]+/.test(line)) return 'blockquote';
    if (/^[ \t]*\|/.test(line)) return 'table-row';
    return 'text';
  });
}

function markerCounts(source: string): { bold: number; tablePipes: number } {
  return { bold: (source.match(/\*\*/g) ?? []).length, tablePipes: (source.match(/\|/g) ?? []).length };
}

function protectSection(source: string): { promptSection: string; tokens: string[] } {
  const tokens: string[] = [];
  const pattern = /^[ \t]*#{1,6}[ \t]+|^[ \t]*(?:\d+\.[ \t]+|[-*+][ \t]+)|^[ \t]*>[ \t]+|\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)[\s\S]*?(?<!\$)\$(?!\$)|`[^`\n]*`|\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^)\s]+|\b(?:D|V|A)-M[0-9.]+-[0-9A-Za-z.-]+\b|(?<![A-Za-z])[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?%?/gm;
  const promptSection = source.replace(pattern, (token) => {
    const index = tokens.push(token) - 1;
    return `__QWEN_PROTECTED_${String(index).padStart(4, '0')}__`;
  });
  return { promptSection, tokens };
}

function restoreSection(output: string, tokens: string[]): string {
  const placeholder = /__QWEN_PROTECTED_(\d+)__/g;
  const count = [...output.matchAll(placeholder)].length;
  if (count !== tokens.length) return output;
  let cursor = 0;
  return output.replace(placeholder, () => tokens[cursor++]);
}

function buildFrontmatterPrompt(frontmatter: string, lessonId: string): { prompt: string; tokens: string[] } {
  const source = visibleFrontmatterLines(frontmatter).join('\n');
  const protectedSource = protectSection(source);
  return {
    prompt: [
      'Translate the human-readable YAML metadata values below from English into Simplified Chinese for a technically strong self-study course.',
      `Lesson ID: ${lessonId}`,
      'Output exactly three YAML lines in the same order: title, spine_a, spine_b. Output no fence, explanation, or extra line.',
      'Keep every key exactly unchanged. Keep model names, paper names, acronyms, URLs, numbers, IDs, and placeholders exactly unchanged. Translate only ordinary prose.',
      'The placeholders stand for protected bytes. Copy every placeholder exactly once; the caller restores the original bytes after you answer.',
      '',
      '--- BEGIN YAML VALUES ---',
      protectedSource.promptSection,
      '--- END YAML VALUES ---',
    ].join('\n'),
    tokens: protectedSource.tokens,
  };
}

function frontmatterIsLocalized(source: string, candidate: string): boolean {
  const sourceLines = visibleFrontmatterLines(source);
  const candidateLines = visibleFrontmatterLines(candidate);
  if (sourceLines.length !== 3 || candidateLines.length !== 3) return false;
  const sourceValues = sourceLines.map((line) => line.replace(/^[^:]+:\s*/, ''));
  const candidateValues = candidateLines.map((line) => line.replace(/^[^:]+:\s*/, ''));
  return candidateLines.every((line, index) => line.startsWith(sourceLines[index].split(':', 1)[0] + ':'))
    && candidateValues.some((value, index) => value !== sourceValues[index]);
}

async function translateVisibleFrontmatter(frontmatter: string, lessonId: string): Promise<string> {
  const sourceLines = visibleFrontmatterLines(frontmatter);
  if (sourceLines.length !== 3) throw new Error('frontmatter must contain title, spine_a, and spine_b');
  let lastIssues = 'unknown validation error';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const protectedPrompt = buildFrontmatterPrompt(frontmatter, lessonId);
    const output = restoreSection(await askModel(protectedPrompt.prompt), protectedPrompt.tokens);
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const keys = lines.map((line) => line.match(/^(title|spine_a|spine_b):\s+/)?.[1] ?? '');
    if (lines.length === 3 && keys.join('|') === 'title|spine_a|spine_b' && !output.includes('__QWEN_PROTECTED_')) {
      return replaceVisibleFrontmatter(frontmatter, lines);
    }
    lastIssues = `expected exactly title/spine_a/spine_b lines, got ${lines.join(' | ')}`;
    console.warn(`${lessonId}: frontmatter attempt ${attempt} failed: ${lastIssues}`);
  }
  throw new Error(`${lessonId} frontmatter failed validation: ${lastIssues}`);
}

function buildPrompt(section: string, lessonId: string): { prompt: string; tokens: string[] } {
  const protectedSection = protectSection(section);
  return {
    prompt: [
    'Translate this English self-study course MDX section into Simplified Chinese for technically strong readers.',
    `Lesson ID: ${lessonId}`,
    'Output only the translated MDX section. Do not add explanations, comments, markdown fences, or a preface.',
    'Preservation rules are strict:',
    '1. The source contains __QWEN_PROTECTED_####__ placeholders. Copy every placeholder exactly once and in the same order; never translate, delete, duplicate, or renumber one.',
    '2. Placeholders stand for LaTeX, inline code, URLs, derivation IDs, visualization IDs, numbers, units, file paths, and code identifiers. The caller restores their original bytes after you answer.',
    '3. Keep the Markdown structure identical: headings, list markers, table pipes, bold markers, paragraphs, and blockquote markers.',
    '4. Translate only ordinary human-readable English prose. Keep named models, paper titles, API names, and standard technical acronyms in their conventional form.',
    '5. Preserve theorem/approximation/analogy labels and the pedagogical order. Do not invent facts or alter numerical outputs.',
    '6. Do not translate or remove YAML/frontmatter; the caller handles frontmatter separately.',
    '',
    '--- BEGIN ENGLISH SECTION ---',
    protectedSection.promptSection,
    '--- END ENGLISH SECTION ---',
    ].join('\n'),
    tokens: protectedSection.tokens,
  };
}

function cleanOutput(raw: string): string {
  const noThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = noThinking.match(/^```(?:md|mdx|markdown)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced ? fenced[1] : noThinking).trim();
}

async function askModel(prompt: string): Promise<string> {
  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      options: { temperature: 0.15, num_ctx: 32768 },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  const data = await response.json() as { message?: { content?: string } };
  if (!data.message?.content) throw new Error('Ollama returned no message content');
  return cleanOutput(data.message.content);
}

async function validate(source: string, translated: string): Promise<string[]> {
  const issues: string[] = [];
  const sourceTokens = protectedTokens(source);
  const translatedTokens = protectedTokens(translated);
  const firstMismatch = sourceTokens.findIndex((token, index) => token !== translatedTokens[index]);
  if (sourceTokens.length !== translatedTokens.length || firstMismatch >= 0) {
    const index = firstMismatch >= 0 ? firstMismatch : Math.min(sourceTokens.length, translatedTokens.length);
    issues.push(`protected token sequence differs: source=${sourceTokens.length}, output=${translatedTokens.length}, first=${index}, expected=${sourceTokens[index] ?? '(none)'}, got=${translatedTokens[index] ?? '(none)'}`);
  }
  if (headingShape(source).length !== headingShape(translated).length) issues.push('heading count differs');
  if (structureSignature(source).join('|') !== structureSignature(translated).join('|')) issues.push('Markdown block/list structure differs');
  const sourceMarkers = markerCounts(source);
  const translatedMarkers = markerCounts(translated);
  if (sourceMarkers.bold !== translatedMarkers.bold) issues.push('bold-marker count differs');
  if (sourceMarkers.tablePipes !== translatedMarkers.tablePipes) issues.push('table-pipe count differs');
  try {
    const sourceShape = await analyze(source);
    const translatedShape = await analyze(translated);
    if (sourceShape.components.join(' ') !== translatedShape.components.join(' ')) issues.push('MDX component sequence differs');
    if (sourceShape.imports.join('\n') !== translatedShape.imports.join('\n')) issues.push('import lines differ');
    if (sourceShape.termIds.join(' ') !== translatedShape.termIds.join(' ')) issues.push('Term IDs differ');
  } catch (error) {
    issues.push(`invalid MDX: ${(error as Error).message}`);
  }
  return issues;
}

function lessonPairs(): Array<{ id: string; englishPath: string; chinesePath: string }> {
  const result: Array<{ id: string; englishPath: string; chinesePath: string }> = [];
  const contentRoot = join(courseRoot, 'content');
  for (const moduleEntry of readdirSync(contentRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const moduleRoot = join(contentRoot, moduleEntry.name);
    for (const file of readdirSync(moduleRoot).filter((name) => name.endsWith('.en.mdx'))) {
      const englishPath = join(moduleRoot, file);
      result.push({ id: parseMeta(readFileSync(englishPath, 'utf8')).id, englishPath, chinesePath: englishPath.replace(/\.en\.mdx$/, '.zh.mdx') });
    }
  }
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function qwenOutputPath(pair: { chinesePath: string }): string {
  return pair.chinesePath.replace(/\.zh\.mdx$/, '.qwen.zh.mdx');
}

async function translatePair(pair: { id: string; englishPath: string; chinesePath: string }): Promise<TranslationRecord> {
  const english = readFileSync(pair.englishPath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(english);
  const outputPath = qwenOutputPath(pair);
  if (resume && existsSync(outputPath)) {
    const existing = readFileSync(outputPath, 'utf8');
    try {
      const existingParts = splitFrontmatter(existing);
      const existingIssues = await validate(body, existingParts.body);
      if (existingIssues.length === 0) {
        let reusable = existing;
        if (!frontmatterIsLocalized(frontmatter, existingParts.frontmatter)) {
          console.log(`${pair.id}: body is valid; translating visible YAML metadata`);
          const localized = await translateVisibleFrontmatter(frontmatter, pair.id);
          reusable = `${localized}\n\n${existingParts.body}\n`;
          writeFileSync(outputPath, reusable, 'utf8');
        }
        console.log(`${pair.id}: reusing validated ${basename(outputPath)}`);
        return { id: pair.id, source: pair.englishPath, output: outputPath, model, sections: splitSections(body).length, sourceSha256: sha256(english), outputSha256: sha256(reusable), promoted: false };
      }
      console.warn(`${pair.id}: existing temporary output failed validation; regenerating (${existingIssues.join('; ')})`);
    } catch (error) {
      console.warn(`${pair.id}: existing temporary output is not valid MDX; regenerating (${(error as Error).message})`);
    }
  }
  const sections = splitSections(body);
  const translatedSections: string[] = [];
  for (const [index, section] of sections.entries()) {
    let output = '';
    let issues: string[] = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      console.log(`${pair.id}: section ${index + 1}/${sections.length}, attempt ${attempt}, model=${model}`);
      const protectedPrompt = buildPrompt(section, pair.id);
      output = restoreSection(await askModel(protectedPrompt.prompt), protectedPrompt.tokens);
      if (output.includes('__QWEN_PROTECTED_')) issues = ['unrestored protected placeholder remains'];
      else issues = await validate(section, output);
      if (issues.length === 0) break;
      console.warn(`  ${issues.join('; ')}`);
    }
    if (issues.length > 0) throw new Error(`${pair.id} section ${index + 1} failed validation: ${issues.join('; ')}`);
    translatedSections.push(output);
  }
  const localizedFrontmatter = await translateVisibleFrontmatter(frontmatter, pair.id);
  const translated = `${localizedFrontmatter}\n\n${translatedSections.join('\n\n')}\n`;
  writeFileSync(outputPath, translated, 'utf8');
  return { id: pair.id, source: pair.englishPath, output: outputPath, model, sections: sections.length, sourceSha256: sha256(english), outputSha256: sha256(translated), promoted: false };
}

function promoteRecords(records: TranslationRecord[]): void {
  const backupRoot = join(courseRoot, 'translation', 'pre-qwen');
  for (const record of records) {
    const sourceChinese = record.output.replace(/\.qwen\.zh\.mdx$/, '.zh.mdx');
    const backupPath = join(backupRoot, basename(dirname(record.source)), basename(sourceChinese));
    mkdirSync(dirname(backupPath), { recursive: true });
    if (existsSync(sourceChinese) && !existsSync(backupPath)) copyFileSync(sourceChinese, backupPath);
    copyFileSync(record.output, sourceChinese);
    record.promoted = true;
  }
}

const pairs = lessonPairs().filter((pair) => all || !lessonFilter || pair.id === lessonFilter);
if (pairs.length === 0) throw new Error('No lesson selected. Use --lesson=M0.1 or --all.');

const runtime = await fetchRuntimeEvidence();
const records: TranslationRecord[] = [];
for (const pair of pairs) records.push(await translatePair(pair));
if (promote) promoteRecords(records);
const manifestPath = join(courseRoot, 'translation', 'qwen-manifest.json');
mkdirSync(dirname(manifestPath), { recursive: true });
let previous: TranslationRecord[] = [];
if (existsSync(manifestPath)) {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as TranslationRecord[] | { records?: TranslationRecord[] };
    previous = Array.isArray(parsed) ? parsed : (parsed.records ?? []);
  } catch { previous = []; }
}
const merged = [...previous.filter((old) => !records.some((current) => current.id === old.id)), ...records].sort((left, right) => left.id.localeCompare(right.id));
const portableRecords = merged.map((record) => ({
  ...record,
  source: relative(courseRoot, record.source).split('\\').join('/'),
  output: relative(courseRoot, record.output).split('\\').join('/'),
}));
writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), host, model, runtime, records: portableRecords }, null, 2) + '\n', 'utf8');
console.log(`${promote ? 'Promoted' : 'Generated'} ${records.length} Qwen translation(s); manifest=${manifestPath}`);
