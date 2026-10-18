import { useEffect, useMemo, useState } from 'preact/hooks';
import { GraphCanvas } from './GraphCanvas';
import { metricsReadings, quantLessonHref } from '../quant/learning-resources';
import mitLinearAlgebraConceptMap from '../games/mit-linear-algebra/concept-map.json';
import { mitLinearAlgebraGameHref } from '../games/mit-linear-algebra/links';
import mitMultivariableConceptMap from '../games/mit-multivariable-calculus/concept-map.json';
import { mitMultivariableGameHref } from '../games/mit-multivariable-calculus/links';
import { mitMultivariableGames } from '../games/mit-multivariable-calculus/registry';
import { compareCourseStudyOrder, courseStudyRank } from '../quant/course-study-order';
import { mergeOpenCourses, type OpenCourseExtension } from './open-course-extension';
import { createForceLayout, layeredLayout, validLayoutCache, type LayoutCache, type Positions } from './layout';
import {
  COURSES, courseLabel, graphSignature, indexGraph, matchesQuery, parseGraph,
  prerequisiteClosure, prerequisitePath, quoteIsVerified, visibleEdges, visibleNodes,
  type ConceptEdge, type ConceptGraphData, type ConceptNode, type GraphIndex, type SourceLocation,
} from './model';
import './concept-graph.css';

const CACHE_KEY = 'tutoring:concept-graph:layout';
const THEME_KEY = 'tutoring:concept-graph:theme';
const linearAlgebraConceptGames: Record<string, string[]> = mitLinearAlgebraConceptMap;
const availableMvGameIds = new Set(mitMultivariableGames.map(g => g.id));
const multivariableConceptGames: Record<string, string[]> = mitMultivariableConceptMap;
type Theme = 'system' | 'light' | 'dark';
export type ConceptGraphSources = {
  documents: Record<string, {
    url: string; filename: string; pages: number; available: boolean;
    language?: 'zh-CN'; pdfPages?: number; pageMap?: Record<string, number>;
    sourceFolder?: 'open-sources';
  }>;
  summary?: { referenced: number; available: number; missing: number };
};
const relationNames: Record<string, string> = {
  prerequisite_of: '先修', special_case_of: '特例', used_in: '使用', related_to: '相关', equivalent_to: '等价',
  covered_in: '课程专题',
};

function dataUrl(file: string): string {
  return new URL(`${import.meta.env.DEV ? '/' : './'}concept-graph/${file}`, window.location.href).href;
}
function readTheme(): Theme {
  try { const value = localStorage.getItem(THEME_KEY); return value === 'dark' || value === 'light' ? value : 'system'; }
  catch { return 'system'; }
}
function cacheFromStorage(graph: ConceptGraphData): Positions | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return validLayoutCache(value, graph) ? value.positions : null;
  } catch { return null; }
}

export function ConceptGraph() {
  const [graph, setGraph] = useState<ConceptGraphData | null>(null);
  const [sources, setSources] = useState<ConceptGraphSources | null | undefined>(undefined);
  const [force, setForce] = useState<Positions | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const controller = new AbortController();
    let frame: number | null = null;
    setError(''); setGraph(null); setForce(null); setSources(undefined);
    const load = async () => {
      const extensionRequest = fetch(dataUrl('open-courses.json'), { signal: controller.signal })
        .then(async (response) => response.ok ? await response.json() as OpenCourseExtension : undefined)
        .catch(() => undefined);
      const sourceRequest = fetch(dataUrl('sources.json'), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`读取 sources.json 失败（${response.status}）。`);
          const value: unknown = await response.json();
          if (!isSourcesIndex(value)) throw new Error('sources.json 格式无效。');
          const extension = await extensionRequest;
          if (!controller.signal.aborted) setSources({ ...value, documents: { ...value.documents, ...extension?.documents } });
        })
        .catch(() => { if (!controller.signal.aborted) setSources(null); });
      const response = await fetch(dataUrl('graph.json'), { signal: controller.signal });
      if (!response.ok) throw new Error(`读取 graph.json 失败（${response.status}）。`);
      const data = mergeOpenCourses(parseGraph(await response.json()), await extensionRequest);
      if (controller.signal.aborted) return;
      setGraph(data);
      void sourceRequest;
      const saved = cacheFromStorage(data);
      if (saved) { setForce(saved); return; }
      try {
        const layoutResponse = await fetch(dataUrl(data.nodes.some((node) => node.origin === 'open-course') ? 'layout.open.json' : 'layout.json'), { signal: controller.signal });
        if (layoutResponse.ok) {
          const cached: unknown = await layoutResponse.json();
          if (validLayoutCache(cached, data)) {
            if (!controller.signal.aborted) setForce(cached.positions);
            return;
          }
        }
      } catch { /* A missing or stale cache does not prevent viewing the graph. */ }
      if (controller.signal.aborted) return;
      const solver = createForceLayout(data);
      const step = () => {
        if (controller.signal.aborted) return;
        if (!solver.step(2)) { frame = requestAnimationFrame(step); return; }
        const positions = solver.positions();
        setForce(positions);
        const cache: LayoutCache = { signature: graphSignature(data), positions };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* Storage may be blocked or full. */ }
      };
      frame = requestAnimationFrame(step);
    };
    void load().catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '无法读取图谱。');
    });
    return () => { controller.abort(); if (frame !== null) cancelAnimationFrame(frame); };
  }, [attempt]);

  const changeTheme = (value: Theme) => {
    setTheme(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* The current session still supports themes. */ }
  };
  return <section class="concept-graph" data-theme={theme === 'system' ? undefined : theme} lang="zh-CN" aria-label="量化课程概念图谱">
    <div class="concept-graph__heading">
      <p>课程概念与公开课专题星图 · 概念名为英文，支持多语言搜索。<a href={quantLessonHref('QUANT-3')}>公开课材料库</a></p>
      <label>图谱主题 <select aria-label="图谱主题" value={theme} onChange={(event) => changeTheme(event.currentTarget.value as Theme)}>
        <option value="system">跟随页面</option><option value="light">浅色</option><option value="dark">深色</option>
      </select></label>
    </div>
    {error ? <div class="concept-graph__error" role="alert">
      <p>{error}</p><p>请在前端项目中运行 <code>npm run sync:concept-graph</code>，然后刷新页面。</p>
      <button class="btn" type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button>
    </div> : !graph ? <p role="status">正在加载本地课程图谱…</p>
      : <ConceptGraphViewer graph={graph} force={force} theme={theme} sources={sources} sourceBase={dataUrl('sources.json')} />}
  </section>;
}

export function ConceptGraphViewer({ graph, force, theme = 'system', sources, sourceBase }: {
  graph: ConceptGraphData; force: Positions | null; theme?: Theme;
  sources?: ConceptGraphSources | null; sourceBase?: string;
}) {
  const index = useMemo(() => indexGraph(graph), [graph]);
  const layered = useMemo(() => layeredLayout(graph), [graph]);
  const [active, setActive] = useState<Set<string>>(() => new Set(graph.nodes.flatMap((node) => node.courses)));
  const [query, setQuery] = useState('');
  const [showRelations, setShowRelations] = useState(true);
  const [layout, setLayout] = useState<'force' | 'layered'>('force');
  const [selected, setSelected] = useState<string | null>(() => {
    const id = new URLSearchParams(window.location.hash.slice(1)).get('concept');
    return id && index.byId.has(id) ? id : null;
  });
  const select = (id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.hash = id ? `concept=${encodeURIComponent(id)}` : '';
    try { history.replaceState(null, '', url); } catch { /* Selection remains available without history access. */ }
  };
  useEffect(() => {
    const onHash = () => {
      const id = new URLSearchParams(window.location.hash.slice(1)).get('concept');
      setSelected(id && index.byId.has(id) ? id : null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [index]);

  const nodes = useMemo(() => visibleNodes(graph, active), [graph, active]);
  const visibleIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo(() => visibleEdges(graph, visibleIds, showRelations), [graph, visibleIds, showRelations]);
  const results = useMemo(() => nodes.filter((node) => matchesQuery(node, query)).sort((a, b) => a.name.localeCompare(b.name)), [nodes, query]);
  const queryHits = useMemo(() => query.trim() ? new Set(results.map((node) => node.id)) : null, [results, query]);
  const ancestors = useMemo(() => selected ? prerequisiteClosure(index, selected, 'ancestors') : new Set<string>(), [index, selected]);
  const descendants = useMemo(() => selected ? prerequisiteClosure(index, selected, 'descendants') : new Set<string>(), [index, selected]);
  const node = selected ? index.byId.get(selected) : undefined;

  const search = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      const hits = nodes.filter((item) => matchesQuery(item, value));
      if (hits.length === 1) select(hits[0].id);
    }
  };
  const toggleCourse = (course: string) => setActive((value) => {
    const next = new Set(value); if (next.has(course)) next.delete(course); else next.add(course); return next;
  });
  return <>
    <div class="concept-graph__controls">
      <label class="concept-graph__search">搜索概念
        <input type="search" aria-label="搜索概念" placeholder="名称或多语言别名…" value={query}
          onInput={(event) => search(event.currentTarget.value)} />
      </label>
      <label class="concept-graph__selector">选择概念（键盘可用）
        <select aria-label="选择概念" value={selected && results.some((item) => item.id === selected) ? selected : ''}
          onChange={(event) => select(event.currentTarget.value || null)}>
          <option value="">{query.trim() ? `${results.length} 个搜索结果` : '请选择概念'}</option>
          {results.map((item) => <option value={item.id} key={item.id}>{item.name}{item.status === 'needs_review' ? ' · 待审' : ''}</option>)}
        </select>
      </label>
      <div class="seg" role="group" aria-label="图谱布局">
        <button type="button" aria-pressed={layout === 'force'} onClick={() => setLayout('force')}>力导向</button>
        <button type="button" aria-pressed={layout === 'layered'} onClick={() => setLayout('layered')}>先修深度分层</button>
      </div>
      <label class="check"><input type="checkbox" checked={showRelations}
        onChange={(event) => setShowRelations(event.currentTarget.checked)} />显示非先修边</label>
    </div>
    <p class="concept-graph__study-order">建议学习顺序 · 1–2 基础查漏 → 3–6 概率、统计与矩阵方法 → 7–9 优化与随机过程 → 10–11 测度概率与随机分析 → 12–13 应用专题。
      {' '}<a href={quantLessonHref('QUANT-1')}>查看学习路线</a>。编号是建议顺序；优化与随机过程可并行，定价方向优先学习 9–11。
    </p>
    <div class="concept-graph__courses" role="group" aria-label="课程筛选">
      {COURSES.filter((course) => graph.nodes.some((node) => node.courses.includes(course.id))).sort(compareCourseStudyOrder).map((course) => <button type="button" class="concept-graph__chip" key={course.id}
        aria-pressed={active.has(course.id)} onClick={() => toggleCourse(course.id)} title={`${course.id} ${course.name}`}>
        <span class="concept-graph__dot" style={{ background: `var(--graph-${course.short})` }} />
        {courseStudyRank(course.id)}. {course.short} · {course.name}{course.short === 'STAT' && sources?.documents['MS-C1620__TPP_TMP_luennot']?.language === 'zh-CN' && '（中文译本）'}
      </button>)}
      <button type="button" class="btn btn--ghost" onClick={() => setActive(new Set(graph.nodes.flatMap((item) => item.courses)))}>全部课程</button>
      <button type="button" class="btn btn--ghost" onClick={() => setActive(new Set())}>清空课程</button>
    </div>
    <p class="concept-graph__stats" role="status">
      {nodes.length} / {graph.nodes.length} 节点 · {edges.length} / {graph.edges.length} 边
      {query.trim() && ` · ${results.length} 个搜索结果`}
      {layout === 'force' && !force && ' · 正在准备力导向布局，暂用分层布局'}
    </p>
    {sources === null && <p class="concept-graph__source-note" role="status">源文件索引暂不可用，图谱证据链接未能加载。</p>}
    {query.trim() && <div class="concept-graph__results" aria-label="概念搜索结果">
      {results.slice(0, 12).map((item) => <button type="button" key={item.id} class="btn btn--ghost" onClick={() => select(item.id)}>{item.name}</button>)}
      {!results.length && <span>没有匹配的概念。可更换关键词或课程筛选。</span>}
      {results.length > 12 && <span>显示前 12 项；全部结果可在“选择概念”中查看。</span>}
    </div>}
    <div class="concept-graph__workspace">
      <div class="concept-graph__map" data-theme={theme === 'system' ? undefined : theme}>
        <GraphCanvas nodes={nodes} edges={edges} positions={layout === 'force' && force ? force : layered}
          selected={selected} ancestors={ancestors} descendants={descendants} queryHits={queryHits} onSelect={select} />
        <p class="concept-graph__hint">拖动平移 · 滚轮 / 双指缩放 · 标签自动避让，悬停或选中查看名称 · “聚焦所选”放大当前概念 · 大节点表示关系较多，外圈表示跨课程概念。</p>
      </div>
      <aside class="concept-graph__sidebar" aria-label="概念详情">
        {node ? <NodeDetails node={node} index={index} onSelect={select} hidden={!visibleIds.has(node.id)} sources={sources} sourceBase={sourceBase} /> : <GraphGuide graph={graph} />}
      </aside>
    </div>
    <details class="concept-graph__limits"><summary>数据范围与已知局限</summary>
      <p>原图谱基于七门 Aalto 课程。新增公开课以课件标题、讲义章节和视频文字稿建立课程专题索引；“课程专题”表示课程覆盖，不表示先修。</p>
      <p>原图谱约 31% 的证据引文为转述；置信度 ≤ 0.65 的原有关系为推断。新增专题保留文件和物理 PDF 页码，未从课程顺序推断先修边。时间序列、实分析及金融专题仍需补充。</p>
      <p>统计推断的中文译本按原文页码定位，原图及证据引文沿用芬兰语底本。六处实体合并判断待审；被排除以打破环的先修边不参与路径计算。仅供个人本地学习。</p>
    </details>
  </>;
}

function CourseTags({ node }: { node: ConceptNode }) {
  return <span class="concept-graph__tags">{node.courses.map((course) => <span key={course} title={course}
    style={{ borderColor: `var(--graph-${courseLabel(course)}, var(--border))` }}>{courseLabel(course)}</span>)}</span>;
}
function isSourcesIndex(value: unknown): value is ConceptGraphSources {
  if (!value || typeof value !== 'object' || !('documents' in value) || !value.documents || typeof value.documents !== 'object') return false;
  return Object.values(value.documents).every((document) => !!document && typeof document === 'object'
    && typeof document.url === 'string' && typeof document.filename === 'string'
    && Number.isInteger(document.pages) && document.pages >= 0 && typeof document.available === 'boolean');
}

function sourceHref(doc: string, page: number | undefined, sources: ConceptGraphSources | null | undefined, sourceBase: string | undefined): string | null {
  const entry = sources?.documents[doc];
  if (!entry?.available || !sourceBase || (page !== undefined && (!Number.isInteger(page) || page < 1 || page > entry.pages))) return null;
  try {
    const base = new URL(sourceBase, window.location.href);
    const translated = entry.language === 'zh-CN';
    const folder = entry.sourceFolder === 'open-sources' ? 'open-sources' : 'sources';
    const expected = new URL(`${folder}/${encodeURIComponent(`${encodeURIComponent(doc)}${translated ? '.zh' : ''}.pdf`)}`, base);
    const resolved = new URL(entry.url, base);
    if (resolved.origin !== window.location.origin || resolved.origin !== expected.origin
      || resolved.pathname !== expected.pathname || resolved.search || resolved.hash) return null;
    if (!resolved.pathname.startsWith(new URL(`${folder}/`, base).pathname)) return null;
    if (page !== undefined) {
      const targetPage = translated ? entry.pageMap?.[String(page)] : page;
      if (!Number.isInteger(targetPage) || !targetPage || targetPage < 1 || targetPage > (translated ? entry.pdfPages ?? 0 : entry.pages)) return null;
      resolved.hash = `page=${targetPage}`;
    }
    return resolved.href;
  } catch { return null; }
}

function SourceDocument({ doc, page, pageOnly = false, sources, sourceBase }: {
  doc: string; page?: number; pageOnly?: boolean; sources?: ConceptGraphSources | null; sourceBase?: string;
}) {
  if (sources === undefined) return pageOnly ? <>p {page}</> : <><code>{doc}</code>{page !== undefined && <span class="concept-graph__muted"> · p {page}</span>}</>;
  const entry = sources?.documents[doc];
  const docHref = sourceHref(doc, undefined, sources, sourceBase);
  const pageHref = page === undefined ? null : sourceHref(doc, page, sources, sourceBase);
  const mappedPage = page === undefined ? undefined : entry?.pageMap?.[String(page)];
  const pageText = entry?.language === 'zh-CN' && mappedPage ? `原 p ${page} → 中 p ${mappedPage}` : `p ${page}`;
  const pageDescription = entry?.language === 'zh-CN' && mappedPage
    ? `中文版第 ${mappedPage} 页（对应原文第 ${page} 页）` : `第 ${page} 页`;
  if (pageOnly) return pageHref
    ? <a class="concept-graph__source-link" href={pageHref} target="_blank" rel="noopener noreferrer"
      aria-label={`打开 ${entry!.filename} ${pageDescription}（${doc}）`} title={`${doc} · ${pageDescription}`}>{pageText}</a>
    : <span class={docHref ? 'concept-graph__source-missing' : 'concept-graph__muted'}>p {page}{docHref && '（页码无效）'}</span>;
  if (!docHref) return <><code>{doc}</code> <span class="concept-graph__source-missing">
    {doc === 'er_adjudication' ? '实体裁定记录（无 PDF）' : '源文件未找到'}
  </span>
    {page !== undefined && <span class="concept-graph__muted"> · p {page}</span>}</>;
  return <>
    <a class="concept-graph__source-link" href={docHref} target="_blank" rel="noopener noreferrer"
      aria-label={`打开源文件 ${entry!.filename}（${doc}）`} title={`${entry!.filename} · ${doc}`}>{entry!.filename}</a>
    <span class="concept-graph__muted"> · <code>{doc}</code></span>
    {page !== undefined && (pageHref
      ? <> · <a class="concept-graph__source-link" href={pageHref} target="_blank" rel="noopener noreferrer"
        aria-label={`打开 ${entry!.filename} ${pageDescription}（${doc}）`} title={`${doc} · ${pageDescription}`}>{pageText}</a></>
      : <span class="concept-graph__source-missing"> · p {page}（页码无效）</span>)}
  </>;
}

function Locations({ title, locations, sources, sourceBase }: {
  title: string; locations: SourceLocation[]; sources?: ConceptGraphSources | null; sourceBase?: string;
}) {
  return <section class="concept-graph__section"><h3>{title}</h3>
    {locations.length ? <ul>{locations.map((location, index) => <li key={`${location.doc}-${index}`}>
      <strong>{courseLabel(location.course)}</strong> · <SourceDocument doc={location.doc} sources={sources} sourceBase={sourceBase} />
      <span class="concept-graph__muted"> · {location.pages.length ? location.pages.map((page, pageIndex) => <span key={`${page}-${pageIndex}`}>
        {pageIndex > 0 && ', '}<SourceDocument doc={location.doc} page={page} pageOnly sources={sources} sourceBase={sourceBase} />
      </span>) : '未标注页码'}</span>
    </li>)}</ul> : <p class="concept-graph__muted">未记录（可能仅作为背景使用）。</p>}
  </section>;
}
function EdgeDetails({ edge, sources, sourceBase }: { edge: ConceptEdge; sources?: ConceptGraphSources | null; sourceBase?: string }) {
  return <div class="concept-graph__evidence">
    <p class="concept-graph__muted">置信度 {edge.confidence.toFixed(2)} · {edge.support} 份文档支持
      {edge.confidence <= 0.65 && <span class="concept-graph__badge">推断关系</span>}
      {edge.rel === 'prerequisite_of' && !edge.in_dag && <span class="concept-graph__badge">已排除，不计入先修链</span>}
    </p>
    <details><summary>引文与出处（{edge.evidence.length}）</summary>
      {edge.evidence.map((evidence, i) => <div class="concept-graph__quote" key={`${evidence.doc}-${evidence.page}-${i}`}>
        <p>{quoteIsVerified(edge, evidence) ? '逐字引文：' : '≈ 转述：'}{evidence.quote || evidence.note || '未提供引文。'}</p>
        <p class="concept-graph__muted"><SourceDocument doc={evidence.doc} page={evidence.page} sources={sources} sourceBase={sourceBase} />
          {evidence.page === undefined && ' · 未标注页码'}</p>
      </div>)}
    </details>
  </div>;
}
function EdgeList({ title, edges, node, index, onSelect, sources, sourceBase }: {
  title: string; edges: ConceptEdge[]; node: ConceptNode; index: GraphIndex; onSelect: (id: string) => void;
  sources?: ConceptGraphSources | null; sourceBase?: string;
}) {
  return <section class="concept-graph__section"><h3>{title}（{edges.length}）</h3>
    {!edges.length && <p class="concept-graph__muted">无</p>}
    <ul>{edges.map((edge, i) => {
      const other = index.byId.get(edge.src === node.id ? edge.dst : edge.src)!;
      return <li key={`${edge.src}-${edge.dst}-${edge.rel}-${i}`}>
        <button type="button" class="concept-graph__node-link" onClick={() => onSelect(other.id)}>{other.name}</button> <CourseTags node={other} />
        {edge.rel !== 'prerequisite_of' && <p class="concept-graph__muted">{relationNames[edge.rel] ?? edge.rel} · {
          edge.rel === 'related_to' || edge.rel === 'equivalent_to' ? '双向关系' : edge.src === node.id ? '当前概念 → 此概念' : '此概念 → 当前概念'
        }</p>}
        <EdgeDetails edge={edge} sources={sources} sourceBase={sourceBase} />
      </li>;
    })}</ul>
  </section>;
}
function NodeDetails({ node, index, onSelect, hidden, sources, sourceBase }: {
  node: ConceptNode; index: GraphIndex; onSelect: (id: string | null) => void; hidden: boolean;
  sources?: ConceptGraphSources | null; sourceBase?: string;
}) {
  const incoming = index.incoming.get(node.id) ?? [], outgoing = index.outgoing.get(node.id) ?? [];
  const byConfidence = (left: ConceptEdge, right: ConceptEdge) => right.confidence - left.confidence;
  const prerequisites = incoming.filter((edge) => edge.rel === 'prerequisite_of').sort(byConfidence);
  const successors = outgoing.filter((edge) => edge.rel === 'prerequisite_of').sort(byConfidence);
  const others = [...incoming, ...outgoing].filter((edge) => edge.rel !== 'prerequisite_of').sort(byConfidence);
  const path = prerequisitePath(index, node.id);
  return <div key={node.id}>
    <div class="concept-graph__detail-head"><h2 aria-live="polite">{node.name}</h2>
      <button class="btn btn--ghost" type="button" onClick={() => onSelect(null)}>取消选择</button></div>
    <CourseTags node={node} />
    {['jacobian-matrix', 'gradient-descent', 'linear-least-squares'].includes(node.id) && <section class="concept-graph__section">
      <h3>动手挑战：雅各比矩阵与优化</h3>
      <p>14 步：求偏导、拼链式法则、计算 Jᵀr，再认识 Gauss–Newton 与秩不足。</p>
      <a class="btn" href={quantLessonHref('GAME-JACOBIAN')}>开始雅各比挑战</a>
    </section>}
    {node.id === 'kullback-leibler-divergence' && <section class="concept-graph__section">
      <h3>动手挑战：KL 与 ELBO</h3>
      <p>分配概率、辨别 KL 方向、修补下界，再做高斯梯度与重参数化。</p>
      <p><a class="btn" href={quantLessonHref('GAME-KL')}>KL 游戏</a>{' '}<a class="btn" href={quantLessonHref('GAME-ELBO')}>ELBO 与梯度游戏</a></p>
    </section>}
    {node.id === 'martingale' && <section class="concept-graph__section">
      <h3>动手挑战：鞅与条件期望</h3>
      <p>12 关：信息树、反例、可预测赌注、平方补偿与停止。</p>
      <a class="btn" href={quantLessonHref('QUANT-5')}>开始鞅挑战</a>
    </section>}
    {node.id === 'orthogonality' && <section class="concept-graph__section">
      <h3>动手试点：点积与正交</h3>
      <p>四个小整数游戏：拼公式、处理负号、判断正交、补齐向量。</p>
      <a class="btn" href={quantLessonHref('QUANT-4')}>开始小游戏</a>
    </section>}
    {node.id === 'four-fundamental-subspaces' && <section class="concept-graph__section">
      <h3>动手挑战：四个基本子空间</h3>
      <p>13 步：匹配正交搭档、计算零度，并检查方程组解的结构。</p>
      <a class="btn" href={quantLessonHref('QUANT-4')}>开始四个子空间挑战</a>
    </section>}
    {(node.courses.includes('MIT-18.06SC') || linearAlgebraConceptGames[node.id]) && <section class="concept-graph__section">
      <h3>MIT 线性代数全课程小游戏</h3>
      <p>40 个主线游戏与 1 个补充游戏，每个均可打开对应的讲义、习题与答案。</p>
      <p><a class="btn" href={mitLinearAlgebraGameHref()}>打开全课程游戏目录</a></p>
      {linearAlgebraConceptGames[node.id]?.map(id => <p key={id}><a href={mitLinearAlgebraGameHref(id)}>进入本专题小游戏 · {id}</a></p>)}
    </section>}
    {(() => {
      const mvGames = (multivariableConceptGames[node.id] ?? []).filter(id => availableMvGameIds.has(id));
      if (!mvGames.length) return null;
      return <section class="concept-graph__section">
        <h3>MIT 多变量微积分全课程小游戏</h3>
        <p>计划上线 69 个小游戏，每个均可打开对应的讲义、习题与答案。</p>
        <p><a class="btn" href={mitMultivariableGameHref()}>打开全课程游戏目录</a></p>
        {mvGames.map(id => <p key={id}><a href={mitMultivariableGameHref(id)}>进入本专题小游戏 · {id}</a></p>)}
      </section>;
    })()}
    {node.origin === 'open-course' && <>
      <span class="concept-graph__badge">{node.kind === 'course' ? '公开课程' : '课程专题索引'}</span>
      <p><a href={quantLessonHref('QUANT-3') + `#course-${node.courses[0].replaceAll('.', '-')}`}>打开课程材料库</a></p>
    </>}
    {node.root && <span class="concept-graph__badge">基础概念</span>}
    {node.status === 'needs_review' && <span class="concept-graph__badge">待人工审查</span>}
    {hidden && <p class="concept-graph__notice">当前课程筛选已隐藏此概念；详情与先修链仍基于完整图谱。</p>}
    <p class="concept-graph__muted">{[...node.aliases_en, ...node.aliases_fi, ...node.aliases_zh].join(' · ') || '暂无别名'}</p>
    <p>{node.definition}</p>{node.notes && <p class="concept-graph__muted">{node.notes}</p>}
    <p class="concept-graph__muted">先修深度 {node.prereq_depth} · 关系度数 {node.degree}</p>
    <Locations title="首次讲授" locations={node.introduced_in} sources={sources} sourceBase={sourceBase} />
    {!!metricsReadings(node.id).length && <section class="concept-graph__section">
      <h3>延伸阅读：回归评估到量化风险</h3>
      <p class="concept-graph__muted">结合推导和交互实验理解应用。</p>
      <ul>{metricsReadings(node.id).map((section) => <li key={section.id}>
        <a href={quantLessonHref('QUANT-2', section.id)}>{section.zh}</a>
      </li>)}</ul>
    </section>}
    <details class="concept-graph__section"><summary>作为背景使用（{node.used_in.length}）</summary><Locations title="使用位置" locations={node.used_in} sources={sources} sourceBase={sourceBase} /></details>
    <EdgeList title="直接先修" edges={prerequisites} node={node} index={index} onSelect={onSelect} sources={sources} sourceBase={sourceBase} />
    <EdgeList title="学会后解锁" edges={successors} node={node} index={index} onSelect={onSelect} sources={sources} sourceBase={sourceBase} />
    <EdgeList title="其他关系" edges={others} node={node} index={index} onSelect={onSelect} sources={sources} sourceBase={sourceBase} />
    <section class="concept-graph__section"><h3>完整先修链（{path.length}，由浅入深）</h3>
      <p class="concept-graph__muted">基于全部课程计算，按先修深度排序；被排除的边不参与计算。</p>
      <ol>{path.map((item) => <li key={item.id}>
        <span class="concept-graph__muted">深度 {item.prereq_depth} · </span>
        <button type="button" class="concept-graph__node-link" onClick={() => onSelect(item.id)}>{item.name}</button> <CourseTags node={item} />
      </li>)}</ol>{!path.length && <p class="concept-graph__muted">无</p>}
    </section>
  </div>;
}
function GraphGuide({ graph }: { graph: ConceptGraphData }) {
  return <>
    <h2>课程概念图谱</h2><p>点击节点，或使用搜索与概念选择框，查看定义、先修链与证据。</p>
    <p class="concept-graph__muted">实线箭头表示先学 → 后学；虚线表示特例、使用或相关关系。选中后，蓝色是先修祖先，橙红色是后继。灰色虚线先修边已被排除。</p>
    <p class="concept-graph__muted">外圈表示跨课程合并；待审节点带粉色虚线环。共有 {graph.nodes.filter((node) => node.status === 'needs_review').length} 个待审节点。</p>
    <h3>课程图例</h3><ul class="concept-graph__legend">{COURSES.filter((course) => graph.nodes.some((node) => node.courses.includes(course.id))).sort(compareCourseStudyOrder).map((course) => <li key={course.id}>
      <span class="concept-graph__dot" style={{ background: `var(--graph-${course.short})` }} /><strong>{course.short}</strong> · {course.id} {course.name}
    </li>)}</ul>
    <p class="concept-graph__muted">筛选只改变图谱展示。概念详情与完整先修链始终使用全部课程的数据。</p>
  </>;
}
