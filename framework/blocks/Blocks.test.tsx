import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../i18n/state';
import { Beyond, ExamTip, Syllabus } from './Blocks';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('each box has its own kind and translated label', () => {
  const { container } = render(
    <>
      <Syllabus>a</Syllabus>
      <Beyond>b</Beyond>
      <ExamTip>c</ExamTip>
    </>,
  );
  const kinds = Array.from(container.querySelectorAll('aside.box'), (el) => el.getAttribute('data-kind'));
  expect(kinds).toEqual(['syllabus', 'beyond', 'exam']);
  expect(container.querySelector('.box--syllabus .box__label')?.textContent).toContain('In the syllabus');

  act(() => setLang('fi'));
  expect(container.querySelector('.box--syllabus .box__label')?.textContent).toContain('Opetussuunnitelmassa');
  expect(container.querySelector('.box--exam .box__body')?.textContent).toBe('c');
});
