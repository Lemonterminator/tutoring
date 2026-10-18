// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { OcwGameCourse, type OcwCourseConfig, type OcwGame } from './OcwGameCourse';
import type { CardGenerator } from './types';

beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/course/index.html'); });
afterEach(cleanup);

const oneCard: CardGenerator = () => [{
  id: 'only', title: 'Only stage', prompt: 'Pick yes.', choice: { options: ['yes', 'no'], answer: 0 }, hint: 'Yes.', explanation: 'Yes is right.',
}];
const game = (n: number, unit: number): OcwGame => ({
  id: `T-${n}`, sequence: n, unit, session: `${unit}.${n}`, kind: 'topic', title: { en: `Game ${n}`, zh: `游戏 ${n}` }, officialUrl: 'https://example.org', sources: [],
});
const games = [game(1, 1), game(2, 1), game(3, 2)];
const config: OcwCourseConfig = {
  games, generators: Object.fromEntries(games.map(g => [g.id, oneCard])), units: [['Unit one', '单元一'], ['Unit two', '单元二']],
  storageKey: 'test:progress', anchorId: 'test-play', ariaLabel: ['Test course', '测试课程'],
  summary: (practiced, shown) => ({ headline: 'Test', progress: `${practiced}/${shown}` }),
  listHeading: shown => `All ${shown} games`, searchPlaceholder: ['', ''], note: ['', ''],
};

it('unlocks the finished game on the progress bar and moves the suggestion to the next one', () => {
  render(<OcwGameCourse lang="en" config={config} />);
  const bar = () => screen.getAllByRole('progressbar').find(element => element.getAttribute('aria-valuemax') === '3')!;
  expect(bar().getAttribute('aria-valuenow')).toBe('0');
  expect(screen.getByRole('link', { name: '1. Game 1 →' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'yes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  fireEvent.click(screen.getByRole('button', { name: 'View record' }));

  expect(bar().getAttribute('aria-valuenow')).toBe('1');
  expect(screen.getByText('Unlocked 1 of 3')).toBeTruthy();
  expect(screen.getByText('Unlocked: 1. Game 1.')).toBeTruthy();
  expect(screen.getByRole('link', { name: '2. Game 2 →' })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('test:progress')!)).toEqual(['T-1']);
  expect([...document.querySelectorAll('.mit-la__progress-units li')].map(item => item.textContent)).toEqual(['Unit one 1/2', 'Unit two 0/1']);
});
