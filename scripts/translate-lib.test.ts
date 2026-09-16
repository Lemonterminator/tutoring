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
