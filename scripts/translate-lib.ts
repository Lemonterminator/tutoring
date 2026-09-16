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
