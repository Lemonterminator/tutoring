// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { PracticeGame } from '../PracticeGame';
import type { CardGenerator } from '../types';

afterEach(cleanup);

it('keeps errors on the current stage, accepts equivalent fractions, and records completion only after the last stage', () => {
  const onComplete = vi.fn();
  const generate: CardGenerator = () => [{
    id: 'fraction', title: 'Projection coefficient', prompt: 'a=(1,1), b=(1,0). Find (a·b)/(a·a).',
    fields: [{ label: 'Coefficient', answer: 0.5 }], hint: 'The numerator is 1 and denominator 2.', explanation: 'The projection coefficient is 1/2.',
  }, {
    id: 'condition', title: 'A required assumption', prompt: 'Can the direction vector be zero?',
    choice: { options: ['No', 'Yes'], answer: 0 }, hint: 'Check the denominator.', explanation: 'a·a must be nonzero.',
  }];
  render(<PracticeGame generate={generate} lang="en" onComplete={onComplete} />);
  fireEvent.input(screen.getByLabelText('Coefficient'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check', exact: true }));
  expect(screen.getByRole('heading').textContent).toContain('1/2');
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.input(screen.getByLabelText('Coefficient'), { target: { value: '1/2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'No', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Check', exact: true }));
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View record', exact: true }));
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading').textContent).toBe('Deck complete');
});

it('preserves the round, current stage and typed answer when a localized course body remounts', () => {
  const generate: CardGenerator = (seed, lang) => [1, 2].map((stage) => ({
    id: `stage-${stage}`,
    title: lang === 'zh' ? `第 ${stage} 步` : `Stage ${stage}`,
    prompt: `${lang === 'zh' ? '中文' : 'English'} seed=${seed} stage=${stage}`,
    fields: [{ label: lang === 'zh' ? `答案 ${stage}` : `Answer ${stage}`, answer: stage === 1 ? 4 : 7 }],
    hint: 'Hint', explanation: 'Explanation',
  }));

  const chinese = render(<PracticeGame generate={generate} lang="zh" />);
  const firstPrompt = chinese.container.querySelector('.practice-game__prompt')!.textContent!;
  const seed = firstPrompt.match(/seed=(\d+)/)![1];
  fireEvent.input(screen.getByLabelText('答案 1'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: '检查', exact: true }));
  chinese.unmount();

  const english = render(<PracticeGame generate={generate} lang="en" />);
  expect(english.container.querySelector('.practice-game__prompt')!.textContent).toBe(`English seed=${seed} stage=1`);
  expect(screen.getByRole('status').textContent).toBe('Correct. Read the reasoning, then continue.');
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  fireEvent.input(screen.getByLabelText('Answer 2'), { target: { value: '7' } });
  english.unmount();

  render(<PracticeGame generate={generate} lang="zh" />);
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
  expect(screen.getByRole('heading').textContent).toContain('2/2 · 第 2 步');
  expect(document.querySelector('.practice-game__prompt')!.textContent).toBe(`中文 seed=${seed} stage=2`);
  expect((screen.getByLabelText('答案 2') as HTMLInputElement).value).toBe('7');
  fireEvent.click(screen.getByRole('button', { name: '检查', exact: true }));
  expect(screen.getByRole('button', { name: '查看记录', exact: true })).toBeTruthy();
});
