import { cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { TeachingView } from './TeachingView';
import { hpcLessons } from './hpc';

afterEach(cleanup);

test('recap precedes closed retrieval questions; authoring-only visual plans stay hidden', () => {
  const lesson = hpcLessons.scaling;
  const { container } = render(<TeachingView lesson={lesson} nodeId="scaling" language="zh" onSelectNode={() => {}} labelForNode={(id) => id} />);
  const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent);
  expect(headings.indexOf('记忆摘要')).toBeLessThan(headings.indexOf('自测'));
  expect([...container.querySelectorAll('details')].every((d) => !d.open)).toBe(true);
  expect(container.querySelectorAll('dt').length).toBe(lesson.terms.length);
  expect(container.textContent).not.toContain(lesson.visualSpec!.zh);
});

test('numbered source steps do not produce duplicate list numbering or damage decimals', () => {
  const lesson = {
    ...hpcLessons.hpc,
    workedExample: {
      ...hpcLessons.hpc.workedExample,
      steps: { en: ['1. First step', '0.25 FLOP/byte'], zh: ['1. 第一步', '0.25 FLOP/byte'] },
    },
  };
  const { container } = render(<TeachingView lesson={lesson} nodeId="hpc" language="zh" onSelectNode={() => {}} labelForNode={(id) => id} />);
  const steps = [...container.querySelectorAll('.nvidia-teaching__worked-example li')].map((li) => li.textContent);
  expect(steps).toEqual(['第一步', '0.25 FLOP/byte']);
});
