import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, expect, test, vi } from 'vitest';
import { ConceptGraph, ConceptGraphViewer, type ConceptGraphSources } from './ConceptGraph';
import { layeredLayout } from './layout';
import { fixture } from './fixtures';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, '', '/'); });

test('search, course filters, selection, complete evidence, and excluded-edge labels are keyboard-accessible', () => {
  render(<ConceptGraphViewer graph={fixture} force={layeredLayout(fixture)} />);
  fireEvent.input(screen.getByRole('searchbox'), { target: { value: '基础' } });
  const sidebar = screen.getByRole('complementary', { name: '概念详情' });
  expect(within(sidebar).getByRole('heading', { name: 'Foundation' })).toBeTruthy();
  expect(within(sidebar).getByText('相关 · 双向关系')).toBeTruthy();
  fireEvent.input(screen.getByRole('searchbox'), { target: { value: '' } });
  fireEvent.change(screen.getByRole('combobox', { name: '选择概念' }), { target: { value: 'Target' } });
  expect(within(sidebar).getByText('待人工审查')).toBeTruthy();
  expect(within(sidebar).getByRole('heading', { name: '完整先修链（2，由浅入深）' })).toBeTruthy();
  expect(within(sidebar).getAllByText('已排除，不计入先修链')).toHaveLength(2);
  expect(within(sidebar).getAllByText('逐字引文：Original wording').length).toBeGreaterThan(0);
  expect(within(sidebar).getAllByText('≈ 转述：Restated evidence').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '清空课程' }));
  expect(screen.getByText('没有显示的概念，请选择至少一门课程。')).toBeTruthy();
  expect(within(sidebar).getByText(/当前课程筛选已隐藏此概念/)).toBeTruthy();
  expect(within(sidebar).getByRole('heading', { name: '完整先修链（2，由浅入深）' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /RL · 强化学习/ }));
  expect(screen.getByRole('status').textContent).toContain('2 / 4 节点');
  fireEvent.click(screen.getByRole('button', { name: '取消选择' }));
  expect(within(sidebar).getByRole('heading', { name: '课程概念图谱' })).toBeTruthy();
});

test('missing local graph has a recoverable error and blocked browser storage still permits a theme change', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<ConceptGraph />);
  expect((await screen.findByRole('alert')).textContent).toContain('404');
  fireEvent.change(screen.getByRole('combobox', { name: '图谱主题' }), { target: { value: 'dark' } });
  expect(document.querySelector('.concept-graph')?.getAttribute('data-theme')).toBe('dark');
  expect(screen.getByRole('button', { name: '重新加载' })).toBeTruthy();
});

test('a concept deep link opens its sidebar without requiring a pointer', () => {
  history.replaceState(null, '', '/#concept=Target');
  render(<ConceptGraphViewer graph={fixture} force={layeredLayout(fixture)} />);
  expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'Target' })).toBeTruthy();
});

const sourceDoc = 'Lecture A/å';
const linkedGraph = {
  ...fixture,
  nodes: fixture.nodes.map((item) => item.id === 'Target' ? {
    ...item,
    introduced_in: [{ course: 'MS-C2111', doc: sourceDoc, pages: [3, 4] }],
    used_in: [{ course: 'ELEC-E8125', doc: sourceDoc, pages: [5] }],
  } : item),
  edges: fixture.edges.map((item) => item.src === 'Middle' && item.dst === 'Target' ? {
    ...item, evidence: [{ doc: sourceDoc, page: 6, quote: 'Evidence' }],
  } : item),
};
const sourceIndex: ConceptGraphSources = { documents: {
  [sourceDoc]: { url: `sources/${encodeURIComponent(encodeURIComponent(sourceDoc))}.pdf`, filename: 'Lecture A – Å.pdf', pages: 10, available: true },
} };

test('document and page links cover introduction, background use, and edge evidence', () => {
  history.replaceState(null, '', '/#concept=Target');
  render(<ConceptGraphViewer graph={linkedGraph} force={layeredLayout(linkedGraph)} sources={sourceIndex} sourceBase="/concept-graph/sources.json" />);
  const sidebar = screen.getByRole('complementary', { name: '概念详情' });
  const documentLink = within(sidebar).getAllByRole('link', { name: `打开源文件 Lecture A – Å.pdf（${sourceDoc}）` })[0];
  const introduction = within(sidebar).getByRole('heading', { name: '首次讲授' }).parentElement!;
  expect(within(introduction).getAllByRole('link', { name: /^打开源文件/ })).toHaveLength(1);
  expect(documentLink.getAttribute('href')).toBe(`${location.origin}/concept-graph/sources/${encodeURIComponent(encodeURIComponent(sourceDoc))}.pdf`);
  expect(documentLink.getAttribute('target')).toBe('_blank');
  expect(documentLink.getAttribute('rel')).toBe('noopener noreferrer');
  expect(within(sidebar).getByRole('link', { name: `打开 Lecture A – Å.pdf 第 3 页（${sourceDoc}）` }).getAttribute('href'))
    .toBe(`${location.origin}/concept-graph/sources/${encodeURIComponent(encodeURIComponent(sourceDoc))}.pdf#page=3`);
  fireEvent.click(within(sidebar).getByText('作为背景使用（1）'));
  expect(within(sidebar).getByRole('link', { name: `打开 Lecture A – Å.pdf 第 5 页（${sourceDoc}）` })).toBeTruthy();
  fireEvent.click(within(sidebar).getByText('引文与出处（1）'));
  expect(within(sidebar).getByRole('link', { name: `打开 Lecture A – Å.pdf 第 6 页（${sourceDoc}）` })).toBeTruthy();
});

test('production relative source base resolves from the page and rejects missing or unsafe mappings', () => {
  history.replaceState(null, '', '/subjects/quant/00-concept-graph/index.html#concept=Target');
  const invalidSources: ConceptGraphSources = { documents: {
    [sourceDoc]: { url: `sources/${encodeURIComponent(encodeURIComponent(sourceDoc))}.pdf`, filename: 'Lecture.pdf', pages: 10, available: true },
    'missing-doc': { url: 'sources/missing-doc.pdf', filename: 'Missing.pdf', pages: 10, available: false },
    external: { url: 'https://example.org/evil.pdf', filename: 'External.pdf', pages: 10, available: true },
  } };
  const graph = {
    ...linkedGraph,
    nodes: linkedGraph.nodes.map((item) => item.id === 'Target' ? {
      ...item, introduced_in: [
        { course: 'MS-C2111', doc: sourceDoc, pages: [11] },
        { course: 'MS-C2111', doc: 'missing-doc', pages: [1] },
        { course: 'MS-C2111', doc: 'unmapped', pages: [1] },
        { course: 'MS-C2111', doc: 'external', pages: [1] },
      ],
    } : item),
  };
  render(<ConceptGraphViewer graph={graph} force={layeredLayout(graph)} sources={invalidSources} sourceBase="./concept-graph/sources.json" />);
  const sidebar = screen.getByRole('complementary', { name: '概念详情' });
  expect(within(sidebar).getAllByRole('link', { name: `打开源文件 Lecture.pdf（${sourceDoc}）` })[0].getAttribute('href'))
    .toBe(`${location.origin}/subjects/quant/00-concept-graph/concept-graph/sources/${encodeURIComponent(encodeURIComponent(sourceDoc))}.pdf`);
  expect(within(sidebar).getAllByText('源文件未找到').length).toBeGreaterThanOrEqual(2);
  expect(within(sidebar).queryByRole('link', { name: /External/ })).toBeNull();
  expect(within(sidebar).getByText('p 11（页码无效）')).toBeTruthy();
});

test('a failed source index leaves the graph available and reports the source issue', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(
    String(input).includes('graph.json')
      ? { ok: true, json: async () => fixture }
      : { ok: false, status: 404 },
  )));
  render(<ConceptGraph />);
  expect(await screen.findByText('源文件索引暂不可用，图谱证据链接未能加载。')).toBeTruthy();
  expect(screen.getByText(/4 \/ 4 节点/)).toBeTruthy();
});
