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
