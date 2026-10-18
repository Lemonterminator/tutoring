import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NvidiaGraph } from './NvidiaGraph';
import { teachingLessons } from './teaching';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/#node=scaling');
});
afterEach(cleanup);

test('deep-link opens the complete lesson, retains old progress and exposes the actual numeric answer', () => {
  localStorage.setItem('nvidia.study.v2', JSON.stringify({ selectedId: 'roofline', checkedIds: ['gemm'], deferredIds: ['memory'] }));
  const { container } = render(<NvidiaGraph language="zh" />);
  expect(screen.getByRole('heading', { level: 2, name: 'Amdahl / 扩展性' })).toBeTruthy();
  expect(container.querySelector('h2[id="nvidia-study-title"]')).toBeNull();
  expect(container.querySelector('#nvidia-study-title')?.textContent).toBe('Amdahl / 扩展性');
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
  expect(container.textContent).toContain('渐近上限是 20 倍');
  const firstAnswer = container.querySelector<HTMLDetailsElement>('details.nvidia-graph__study-check-answer');
  expect(firstAnswer?.open).toBe(false);
  fireEvent.click(firstAnswer!.querySelector('summary')!);
  expect(firstAnswer?.open).toBe(true);
  const stored = JSON.parse(localStorage.getItem('nvidia.study.v2')!);
  expect(stored.checkedIds).toEqual(['gemm']);
  expect(stored.deferredIds).toEqual(['memory']);
});

test('answer disclosures reset when navigating to a prerequisite and route progresses in the new order', () => {
  const { container } = render(<NvidiaGraph language="zh" />);
  const answer = container.querySelector<HTMLDetailsElement>('details.nvidia-graph__study-check-answer')!;
  fireEvent.click(answer.querySelector('summary')!);
  // The prerequisite is an explicit button in the narrative, distinct from graph-related navigation.
  fireEvent.click(screen.getByRole('button', { name: '任务分解', exact: true }));
  expect(window.location.hash).toBe('#node=decomp');
  expect(container.querySelector<HTMLDetailsElement>('details.nvidia-graph__study-check-answer')?.open).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '标记本节已检查', exact: true }));
  expect(screen.getByRole('button', { name: '下一项：Amdahl / 扩展性' })).toBeTruthy();
});

test('English follows the same node and hides no content behind a missing translation', () => {
  render(<NvidiaGraph language="en" />);
  expect(screen.getByRole('heading', { level: 2, name: 'Amdahl / scaling' })).toBeTruthy();
  expect(screen.getByText(/The asymptotic limit is 20/)).toBeTruthy();
});

test.each(Object.keys(teachingLessons))('renders the complete bilingual teaching unit for %s', (id) => {
  window.history.replaceState(null, '', `/#node=${id}`);
  const lesson = teachingLessons[id];
  const { container, rerender } = render(<NvidiaGraph language="zh" />);
  for (const language of ['zh', 'en'] as const) {
    rerender(<NvidiaGraph language={language} />);
    expect(container.querySelector('.nvidia-teaching__question')?.textContent).toBe(lesson.question[language]);
    expect(container.querySelectorAll('.nvidia-teaching__check').length).toBe(lesson.checks.length);
    expect(container.textContent).toContain(lesson.workedExample.result[language]);
    expect(container.textContent).toContain(lesson.transfer.boundary[language]);
  }
});

test('recap jump preserves the node deep-link and never marks the unit as mastered', () => {
  const scroll = vi.fn();
  const { container } = render(<NvidiaGraph language="zh" />);
  const recap = container.querySelector<HTMLElement>('.nvidia-teaching__recap')!;
  recap.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole('button', { name: '跳到总结', exact: true }));
  expect(scroll).toHaveBeenCalledOnce();
  expect(window.location.hash).toBe('#node=scaling');
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
});
