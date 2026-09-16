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
