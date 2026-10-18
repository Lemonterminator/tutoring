// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { MitLinearAlgebraCourse } from './MitLinearAlgebraCourse';
import { mitLinearAlgebraGames } from './registry';

beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/subjects/quant/14-mit-linear-algebra-games/index.html'); });
afterEach(cleanup);

describe('MIT course selection and source access', () => {
  for (const lang of ['en', 'zh'] as const) {
    it(`mounts every one of the 41 games in ${lang} with its corresponding source`, () => {
      render(<MitLinearAlgebraCourse lang={lang} />);
      const select = screen.getByLabelText(lang === 'en' ? 'Choose a game' : '选择小游戏');
      for (const entry of mitLinearAlgebraGames) {
        fireEvent.change(select, { target: { value: entry.id } });
        const region = screen.getByRole('region', { name: lang === 'en' ? 'Current game' : '当前小游戏' });
        expect(within(region).getAllByRole('heading')[0]?.textContent).toBe(`${entry.sequence}. ${entry.title[lang]}`);
        const pdfLinks = within(region).getAllByRole('link').filter(link => link.getAttribute('href')?.includes('.pdf#page=1'));
        expect(pdfLinks.length, entry.id).toBeGreaterThan(0);
        expect(pdfLinks.every(link => entry.sources.some(source => link.getAttribute('href')?.includes(source.asset)))).toBe(true);
        expect(within(region).getByRole('progressbar').getAttribute('value')).toBe('0');
      }
    }, 15000);
  }

  it('lists all 41 games and preserves a direct game URL', () => {
    window.history.replaceState({}, '', '/subjects/quant/14-mit-linear-algebra-games/index.html?game=MIT-LA-10');
    render(<MitLinearAlgebraCourse lang="zh" />);
    const selection = screen.getByLabelText('选择小游戏') as HTMLSelectElement;
    expect(selection.options).toHaveLength(41);
    expect(selection.value).toBe('MIT-LA-10');
    const source = screen.getByRole('complementary', { name: '本游戏对应材料' });
    const notes = within(source).getByRole('link', { name: '讲义 ↗' });
    expect(notes.getAttribute('href')).toContain('MIT18_06SCF11_Ses1.10sum.pdf#page=1');
    expect(notes.getAttribute('target')).toBe('_blank');
    expect(within(source).getByRole('link', { name: '原习题 ↗' })).toBeTruthy();
    expect(within(source).getByRole('link', { name: '原答案 ↗' })).toBeTruthy();
  });

  it('switches games, resets the displayed deck and updates source links', () => {
    render(<MitLinearAlgebraCourse lang="en" />);
    fireEvent.change(screen.getByLabelText('Choose a game'), { target: { value: 'MIT-LA-33' } });
    expect(window.location.search).toBe('?game=MIT-LA-33');
    const game = screen.getByRole('region', { name: 'Current game' });
    expect(within(game).getByRole('heading', { name: '33. Singular Value Decomposition' })).toBeTruthy();
    expect(within(game).getByRole('link', { name: 'Lecture notes ↗' }).getAttribute('href')).toContain('Ses3.5sum.pdf');
    expect(within(game).getByRole('progressbar').getAttribute('value')).toBe('0');
  });

  it('shows course progress, marks finished games and suggests the first unfinished one without locking any', () => {
    localStorage.setItem('tutoring:mit-18-06sc:practice-completed:v1', JSON.stringify(['MIT-LA-01', 'MIT-LA-02', 'MIT-LA-04']));
    render(<MitLinearAlgebraCourse lang="zh" />);
    const bar = screen.getAllByRole('progressbar').find(element => element.getAttribute('aria-valuemax') === '41')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByText('已解锁 3/41')).toBeTruthy();
    const next = screen.getByRole('link', { name: '3. 矩阵乘法与逆矩阵 →' });
    expect(next.getAttribute('href')).toContain('game=MIT-LA-03');
    const cards = screen.getAllByRole('link').filter(link => link.closest('.mit-la__grid'));
    expect(cards.filter(card => card.classList.contains('mit-la__card--done'))).toHaveLength(3);
    expect(cards.find(card => card.classList.contains('mit-la__card--next'))?.textContent).toContain('MIT-LA-03');
    // Unfinished later games stay playable.
    fireEvent.click(cards.find(card => card.textContent?.includes('MIT-LA-40'))!);
    expect(within(screen.getByRole('region', { name: '当前小游戏' })).getAllByRole('heading')[0]?.textContent).toBe('40. 期末考试挑战');
  });

  it('filters topics and recovers invalid IDs without rendering a broken game', () => {
    window.history.replaceState({}, '', '/?game=MIT-LA-999');
    render(<MitLinearAlgebraCourse lang="zh" />);
    expect((screen.getByLabelText('选择小游戏') as HTMLSelectElement).value).toBe('MIT-LA-01');
    fireEvent.input(screen.getByLabelText('查找主题'), { target: { value: 'MIT-LA-41' } });
    expect(screen.getByRole('link', { name: /MIT-LA-41/ })).toBeTruthy();
    fireEvent.input(screen.getByLabelText('查找主题'), { target: { value: 'nothing-matches-this-query' } });
    expect(screen.getByText('没有匹配的小游戏，请换一个主题或单元。')).toBeTruthy();
  });
});
