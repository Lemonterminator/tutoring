// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { OcwGameCourse, type OcwCourseConfig, type OcwGame } from './OcwGameCourse';
import type { ChunkGenerators, ChunkLoader } from './chunk-loader';
import type { PracticeCard } from './types';

const card = (id: string): PracticeCard => ({ id, title: `Card ${id}`, prompt: `Prompt ${id}`.replace(/1/g,'alpha').replace(/2/g,'beta').replace(/3/g,'gamma').replace(/-/g,' '), fields: [{ label: 'x', answer: 1 }], hint: 'h', explanation: 'e' });
const game = (n: number): OcwGame => ({ id: `G-${n}`, sequence: n, unit: 1, session: String(n), kind: 'topic', title: { en: `Game ${n}`, zh: `游戏 ${n}` }, officialUrl: 'https://example.org/', sources: [] });
const games = [game(1), game(2), game(3)];
const index = { 'G-1': { chunk: 'a', stages: 2 }, 'G-2': { chunk: 'a', stages: 2 }, 'G-3': { chunk: 'b', stages: 3 } };
const maps: Record<string, ChunkGenerators> = {
  a: { 'G-1': () => [card('1-1'), card('1-2')], 'G-2': () => [card('2-1'), card('2-2')] },
  b: { 'G-3': () => [card('3-1'), card('3-2'), card('3-3')] },
};

function fakeLoader(failures: string[] = []) {
  const done = new Map<string, ChunkGenerators>();
  const load = vi.fn(async (chunk: string) => {
    await Promise.resolve();
    const failing = failures.indexOf(chunk);
    if (failing >= 0) { failures.splice(failing, 1); throw new Error('offline'); }
    done.set(chunk, maps[chunk]);
    return maps[chunk];
  });
  const loader: ChunkLoader = { load, peek: chunk => done.get(chunk) };
  return { loader, load };
}
const config = (loader: ChunkLoader): OcwCourseConfig => ({
  games, chunks: { index, loader }, units: [['Unit 1', '单元 1']], storageKey: 'test:chunks', anchorId: 'play',
  ariaLabel: ['Course', '课程'], summary: () => ({ headline: 'h', progress: 'p' }), listHeading: () => 'List',
  searchPlaceholder: ['s', 's'], note: ['n', 'n'],
});

beforeEach(() => { Element.prototype.scrollIntoView = () => {}; localStorage.clear(); window.history.replaceState({}, '', '/x/index.html'); });
afterEach(cleanup);

describe('OcwGameCourse in on-demand mode', () => {
  it('lists stage counts from the index, shows a loading state, mounts the game and prefetches the next chunk', async () => {
    const { loader, load } = fakeLoader();
    render(<OcwGameCourse lang="en" config={config(loader)} />);
    expect(screen.getByText(/^3 stages/)).toBeTruthy();
    expect(screen.getByText(/Loading the game/)).toBeTruthy();
    expect(load).toHaveBeenCalledWith('a');
    await screen.findByLabelText('Progress');
    expect(screen.getByText('Prompt alpha alpha')).toBeTruthy();
    // Game 2 is in the same chunk as game 1; game 3 is in "b", which was prefetched while game 2 was shown.
    fireEvent.click(screen.getByText('Next game →'));
    await screen.findByText('Prompt beta alpha');
    await waitFor(() => expect(load).toHaveBeenCalledWith('b'));
    fireEvent.click(screen.getByText('Next game →'));
    await screen.findByText('Prompt gamma alpha');
  });

  it('keeps ?game= and shows a bilingual error with a working retry button when a chunk cannot load', async () => {
    window.history.replaceState({}, '', '/x/index.html?game=G-3');
    const { loader, load } = fakeLoader(['b']);
    render(<OcwGameCourse lang="en" config={config(loader)} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('games/ folder');
    fireEvent.click(screen.getByText('Try again'));
    await screen.findByText('Prompt gamma alpha');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(load.mock.calls.filter(([chunk]) => chunk === 'b')).toHaveLength(2);
    cleanup();
    const second = fakeLoader(['b']);
    render(<OcwGameCourse lang="zh" config={config(second.loader)} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('games/ 文件夹'));
    expect(screen.getByText('重试')).toBeTruthy();
  });

  it('still needs one of generators or chunks', () => {
    const { loader } = fakeLoader();
    const broken = { ...config(loader), chunks: undefined };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<OcwGameCourse lang="en" config={broken} />)).toThrow('generators or chunks');
    error.mockRestore();
  });
});
