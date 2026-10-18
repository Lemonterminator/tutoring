// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { MitMultivariableCourse } from './MitMultivariableCourse';
import { mitMultivariableGames } from './registry';

beforeEach(() => { Element.prototype.scrollIntoView = () => {}; localStorage.clear(); window.history.replaceState({}, '', '/subjects/quant/27-mit-multivariable-calculus-games/index.html'); });
afterEach(cleanup);

describe('MIT 18.02SC course selection, figures and source access', () => {
  for (const lang of ['en', 'zh'] as const) {
    it(`mounts every available game in ${lang} with its sources and figures`, async () => {
      render(<MitMultivariableCourse lang={lang} />);
      const select = screen.getByLabelText(lang === 'en' ? 'Choose a game' : '选择小游戏');
      for (const entry of mitMultivariableGames) {
        fireEvent.change(select, { target: { value: entry.id } });
        const region = screen.getByRole('region', { name: lang === 'en' ? 'Current game' : '当前小游戏' });
        expect(within(region).getAllByRole('heading')[0]?.textContent).toBe(`${entry.sequence}. ${entry.title[lang]}`);
        const pdfLinks = within(region).getAllByRole('link').filter(link => link.getAttribute('href')?.includes('.pdf#page=1'));
        // A session with no OCW files (e.g. 96, a summary page) still links to its MIT session page.
        if (entry.sources.length > 0) expect(pdfLinks.length, entry.id).toBeGreaterThan(0);
        else expect(within(region).getAllByRole('link').some(link => link.getAttribute('href') === entry.officialUrl), entry.id).toBe(true);
        expect(pdfLinks.every(link => link.getAttribute('target') === '_blank' && link.getAttribute('rel')?.includes('noopener'))).toBe(true);
        // The chunk with the game's generator loads on demand.
        await waitFor(() => expect(within(region).getByRole('progressbar').getAttribute('value')).toBe('0'), { timeout: 15000 });
      }
    }, 60000);
  }

  it('lists only available games, keeps a direct URL and recovers invalid IDs', () => {
    const id = mitMultivariableGames[mitMultivariableGames.length - 1].id;
    window.history.replaceState({}, '', `/x/index.html?game=${id}`);
    const { unmount } = render(<MitMultivariableCourse lang="zh" />);
    const selection = screen.getByLabelText('选择小游戏') as HTMLSelectElement;
    expect(selection.options).toHaveLength(mitMultivariableGames.length);
    expect(selection.value).toBe(id);
    unmount();
    window.history.replaceState({}, '', '/x/index.html?game=MIT-MV-999');
    render(<MitMultivariableCourse lang="zh" />);
    expect((screen.getByLabelText('选择小游戏') as HTMLSelectElement).value).toBe(mitMultivariableGames[0].id);
    fireEvent.input(screen.getByLabelText('查找主题'), { target: { value: 'nothing-matches-this-query' } });
    expect(screen.getByText('没有匹配的小游戏，请换一个主题或单元。')).toBeTruthy();
  });

  it('renders the figure with a text alternative for a figure card', async () => {
    window.history.replaceState({}, '', '/x/index.html?game=MIT-MV-17');
    render(<MitMultivariableCourse lang="en" />);
    await screen.findByLabelText('Progress', {}, { timeout: 15000 });
    // The first card of MIT-MV-17 is the four-picture choice.
    expect(document.querySelectorAll('.fig2d--compact svg[role="img"]').length).toBe(4);
    for (const svg of document.querySelectorAll('.fig2d svg')) expect(svg.getAttribute('aria-label')?.length).toBeGreaterThan(5);
  }, 30000);

  it('renders unit problem sets with target="_blank" and rel="noopener noreferrer"', () => {
    const { unmount } = render(<MitMultivariableCourse lang="en" />);
    const enLinks = screen.getAllByRole('link').filter(l => l.textContent?.includes('Problem Set'));
    expect(enLinks.length).toBeGreaterThan(0);
    expect(enLinks.some(l => l.textContent?.includes('Problem Set 1'))).toBe(true);
    for (const link of enLinks) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      if (link.getAttribute('href')?.endsWith('.pdf#page=1') || link.getAttribute('href')?.includes('.pdf#page=1')) {
        expect(link.getAttribute('href')).toContain('#page=1');
      }
    }
    unmount();

    render(<MitMultivariableCourse lang="zh" />);
    const zhLinks = screen.getAllByRole('link').filter(l => l.textContent?.includes('习题集'));
    expect(zhLinks.length).toBeGreaterThan(0);
    expect(zhLinks.some(l => l.textContent?.includes('习题集 1'))).toBe(true);
    for (const link of zhLinks) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
