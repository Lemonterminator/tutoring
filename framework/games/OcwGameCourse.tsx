import { useEffect, useState } from 'preact/hooks';
import { PracticeGame } from './PracticeGame';
import type { CardGenerator, GameLanguage } from './types';
import type { ChunkLoader } from './chunk-loader';
import { openCourseAsset } from '../quant/OpenCourseLibrary';
import './ocw-course.css';

/** A local course PDF (`asset`, opened at `page`, default 1) or an external page (`href`, e.g. a notebook on GitHub). */
export type OcwSource = { kind: string; title: string; asset?: string; href?: string; filename?: string; page?: number };
const sourceHref = (s: OcwSource) => s.href ?? `${openCourseAsset(s.asset!)}#page=${s.page ?? 1}`;
export type OcwGame = {
  id: string; sequence: number; unit: number; session: string; kind: string;
  title: { en: string; zh: string }; officialUrl: string; sources: OcwSource[];
};
export type OcwProblemSet = {
  problemSet: number; unit: number; title: string; officialUrl: string; sources: OcwSource[];
};
type Pair = readonly [string, string];

/** Course-specific text and storage identity. All pairs are [English, Simplified Chinese]. */
export type OcwCourseConfig = {
  games: readonly OcwGame[];
  /** Eager mode: every generator is in the page. */
  generators?: Record<string, CardGenerator>;
  /** On-demand mode (instead of `generators`): the chunk and stage count of each game, and the loader of the chunks. */
  chunks?: { index: Record<string, { chunk: string; stages: number }>; loader: ChunkLoader };
  units: readonly Pair[];
  storageKey: string;
  anchorId: string;
  ariaLabel: Pair;
  summary: (practiced: number, shown: number, lang: GameLanguage) => { headline: string; progress: string };
  listHeading: (shown: number, lang: GameLanguage) => string;
  searchPlaceholder: Pair;
  note: Pair;
  /** Source-kind labels; `problems` differs for exam games. */
  sourceLabels?: Record<string, Pair>;
  kindLabels?: Partial<Record<'topic' | 'review' | 'exam' | 'bonus', Pair>>;
  /** Text appended to the stage line, per game kind. */
  kindSuffix?: Partial<Record<string, Pair>>;
  /** Optional block shown under the list, e.g. a note that more games are in production. */
  extra?: (lang: GameLanguage) => preact.ComponentChild;
  /** Problem sets for course units. */
  problemSets?: readonly OcwProblemSet[];
  /** Text of the link to `officialUrl` (default: MIT session page). */
  officialLabel?: Pair;
  /** Label each source link with its own title (e.g. "Lecture 3 · pp. 4–9") instead of its kind. */
  sourceTitles?: boolean;
  /** Shown instead of the course while no game is available yet. */
  empty?: Pair;
};

const DEFAULT_SOURCE: Record<string, Pair> = {
  notes: ['Lecture notes', '讲义'], problems: ['Original problems', '原习题'], examProblems: ['Original exam', '原考试题'],
  solutions: ['Original solutions', '原答案'], transcript: ['Video transcript', '视频文字稿'],
  examples: ['Worked examples', '例题'], recitation: ['Recitation transcript', '习题课文字稿'],
};
const DEFAULT_KIND: Record<string, Pair> = { topic: ['Session', '课节'], review: ['Review', '复习'], exam: ['Exam practice', '考试练习'], bonus: ['Supplement', '补充'] };

export function OcwGameCourse({ lang = 'zh', config }: { lang?: GameLanguage; config: OcwCourseConfig }) {
  if (!config.games.length) return <section class="mit-la" aria-label={config.ariaLabel[lang === 'zh' ? 1 : 0]}>
    <p class="mit-la__note" role="status">{(config.empty ?? ['No game is available yet.', '还没有上线的小游戏。'])[lang === 'zh' ? 1 : 0]}</p>
  </section>;
  return <OcwGameCourseBody lang={lang} config={config} />;
}

function OcwGameCourseBody({ lang, config }: { lang: GameLanguage; config: OcwCourseConfig }) {
  const { games, generators, chunks, units, storageKey, anchorId } = config;
  if (!generators && !chunks) throw new Error('OcwGameCourse needs generators or chunks');
  const idx = lang === 'zh' ? 1 : 0;
  const t = (en: string, zh: string) => lang === 'zh' ? zh : en;
  const gameInUrl = () => {
    const id = new URL(window.location.href).searchParams.get('game');
    return games.find(g => g.id === id)?.id ?? games[0].id;
  };
  const completedGames = (): string[] => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(stored) ? [...new Set(stored.filter((id): id is string => typeof id === 'string' && games.some(g => g.id === id)))] : [];
    } catch { return []; }
  };
  const [selected, setSelected] = useState(gameInUrl);
  const [completed, setCompleted] = useState(completedGames);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const game = games.find(g => g.id === selected)!;
  const index = games.indexOf(game);
  const stagesOf = (id: string) => chunks ? chunks.index[id].stages : generators![id](1, lang).length;
  // In on-demand mode the generator exists only after its chunk has loaded; `loadTick` re-renders when that happens.
  const generate: CardGenerator | undefined = chunks ? chunks.loader.peek(chunks.index[game.id].chunk)?.[game.id] : generators![game.id];
  const stageCount = stagesOf(game.id);
  const [, setLoadTick] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!chunks) return;
    let live = true;
    const { chunk } = chunks.index[game.id];
    chunks.loader.load(chunk).then(loaded => {
      if (!live) return;
      if (!loaded[game.id]) { setFailed(game.id); return; }
      setFailed(null);
      setLoadTick(n => n + 1);
      const next = games[index + 1];
      if (next) chunks.loader.load(chunks.index[next.id].chunk).catch(() => { /* Prefetch only; the next selection reports a real failure. */ });
    }, () => { if (live) setFailed(game.id); });
    return () => { live = false; };
  }, [game.id, attempt]);
  useEffect(() => {
    const sync = () => setSelected(gameInUrl());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const hrefFor = (id: string) => { const url = new URL(window.location.href); url.searchParams.set('game', id); url.hash = anchorId; return url.href; };
  const select = (id: string) => {
    setSelected(id);
    window.history.pushState({}, '', hrefFor(id));
    requestAnimationFrame(() => document.getElementById(anchorId)?.scrollIntoView({ block: 'start' }));
  };
  // The game finished in this visit, announced once beside the progress bar.
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const markComplete = () => {
    if (!completed.includes(game.id)) setUnlocked(game.id);
    setCompleted(old => {
      const next = old.includes(game.id) ? old : [...old, game.id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Practice works when browser storage is unavailable. */ }
      return next;
    });
  };
  const done = new Set(completed);
  // Suggested next game: the first unfinished one in course order. Nothing is locked.
  const nextGame = games.find(g => !done.has(g.id));
  const unlockedGame = games.find(g => g.id === unlocked);
  const percent = Math.round(100 * completed.length / games.length);

  const label = (kind: string) => {
    const table = { ...DEFAULT_SOURCE, ...config.sourceLabels } as Record<string, Pair>;
    const key = kind === 'problems' && game.kind === 'exam' ? 'examProblems' : kind;
    return (table[key] ?? [kind, kind])[idx];
  };
  const kindLabel = (kind: string) => ({ ...DEFAULT_KIND, ...config.kindLabels } as Record<string, Pair>)[kind]?.[idx] ?? kind;
  const secondary = (kind: string) => kind === 'transcript' || kind === 'recitation';
  const primary = game.sources.filter(s => !secondary(s.kind));
  const supplementary = game.sources.filter(s => secondary(s.kind));
  const query = search.trim().toLowerCase();
  const matches = (g: OcwGame) => (filter === 'all' || filter === String(g.unit)) && `${g.id} ${g.title.en} ${g.title.zh}`.toLowerCase().includes(query);
  const { headline, progress } = config.summary(completed.length, games.length, lang);

  return <section class="mit-la" aria-label={config.ariaLabel[idx]}>
    <div class="mit-la__summary"><strong>{headline}</strong><span>{progress}</span></div>
    <label class="mit-la__select">{t('Choose a game', '选择小游戏')}<select value={selected} onChange={e => select(e.currentTarget.value)}>{games.map(g => <option key={g.id} value={g.id}>{g.sequence}. {g.title[lang]}{completed.includes(g.id) ? ' ✓' : ''}</option>)}</select></label>
    <section id={anchorId} class="mit-la__play" aria-label={t('Current game', '当前小游戏')}>
      <p class="mit-la__eyebrow">{game.id} · {units[game.unit - 1][idx]}</p>
      <h3>{game.sequence}. {game.title[lang]}</h3>
      <p>{stageCount} {t('short stages · numeric blanks, reasoning and optional hints', '个短步骤 · 数字填空、推理与可选提示')}{config.kindSuffix?.[game.kind]?.[idx] ?? ''}</p>
      <aside class="mit-la__sources" aria-label={t('Sources for this game', '本游戏对应材料')}>
        <strong>{t('Stuck? Read the sources for this session', '不会做？查看这节的原材料')}</strong>
        <div class="mit-la__links">{(primary.length ? primary : supplementary.slice(0, 1)).map(s => <a key={sourceHref(s)} href={sourceHref(s)} target="_blank" rel="noopener noreferrer">{config.sourceTitles ? s.title : <>{label(s.kind)}{primary.filter(p => p.kind === s.kind).length > 1 ? ` ${primary.filter(p => p.kind === s.kind).indexOf(s) + 1}` : ''}</>} ↗</a>)}
          <a href={game.officialUrl} target="_blank" rel="noopener noreferrer">{(config.officialLabel ?? ['MIT session page', 'MIT 本节课程页'])[idx]} ↗</a>
        </div>
        {!!primary.length && !!supplementary.length && <details><summary>{t('Video transcripts', '视频文字稿')}</summary><ul>{supplementary.map(s => <li key={sourceHref(s)}><a href={sourceHref(s)} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul></details>}
        <small>{t('Sources open in another tab, keeping your current answers.', '材料在新标签打开，当前答题会保留。')}</small>
      </aside>
      {generate
        ? <PracticeGame key={game.id} generate={generate} lang={lang} sessionKey={`${storageKey}:${game.id}`} onComplete={markComplete} />
        : failed === game.id
          ? <div class="mit-la__loadfail" role="alert">
            <p>{t('This game could not be loaded. The games/ folder must stay next to this page: if you moved or copied the page, copy the games/ folder with it. Then try again.', '无法加载这个游戏。games/ 文件夹必须和本页面放在一起：如果移动或复制过页面，请把 games/ 文件夹一起带上，然后重试。')}</p>
            <button type="button" class="btn" onClick={() => { setFailed(null); setAttempt(n => n + 1); }}>{t('Try again', '重试')}</button>
          </div>
          : <p class="mit-la__loading" role="status" aria-busy="true">{t('Loading the game…', '正在加载游戏……')}</p>}
      <nav class="mit-la__pager" aria-label={t('Game navigation', '小游戏导航')}><button type="button" class="btn btn--ghost" disabled={index === 0} onClick={() => select(games[index - 1].id)}>{t('← Previous game', '← 上一个小游戏')}</button><button type="button" class="btn" disabled={index === games.length - 1} onClick={() => select(games[index + 1].id)}>{t('Next game →', '下一个小游戏 →')}</button></nav>
    </section>
    <h3>{config.listHeading(games.length, lang)}</h3>
    <div class="mit-la__progress">
      <div class="mit-la__progress-head">
        <strong id={`${anchorId}-progress`}>{t(`Unlocked ${completed.length} of ${games.length}`, `已解锁 ${completed.length}/${games.length}`)}</strong>
        <span>{percent}%</span>
      </div>
      <div class="mit-la__progress-track" role="progressbar" aria-labelledby={`${anchorId}-progress`} aria-valuemin={0} aria-valuemax={games.length} aria-valuenow={completed.length}>
        {units.map((unit, i) => {
          const unitGames = games.filter(g => g.unit === i + 1);
          if (!unitGames.length) return null;
          const unitDone = unitGames.filter(g => done.has(g.id)).length;
          return <span key={i} class="mit-la__progress-unit" style={{ flexGrow: unitGames.length }} title={`${unit[idx]} · ${unitDone}/${unitGames.length}`}>
            <span class="mit-la__progress-fill" style={{ width: `${100 * unitDone / unitGames.length}%` }} />
          </span>;
        })}
      </div>
      <ul class="mit-la__progress-units">{units.map((unit, i) => {
        const unitGames = games.filter(g => g.unit === i + 1);
        return unitGames.length ? <li key={i}>{unit[idx]} <b>{unitGames.filter(g => done.has(g.id)).length}/{unitGames.length}</b></li> : null;
      })}</ul>
      <p role="status" class="mit-la__progress-news">{unlockedGame ? t(`Unlocked: ${unlockedGame.sequence}. ${unlockedGame.title.en}.`, `新解锁：${unlockedGame.sequence}. ${unlockedGame.title.zh}。`) : ''}</p>
      {nextGame
        ? <p class="mit-la__progress-next">{t('Next suggested: ', '下一个建议：')}<a href={hrefFor(nextGame.id)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); select(nextGame.id); } }}>{nextGame.sequence}. {nextGame.title[lang]} →</a></p>
        : <p class="mit-la__progress-next">{t('Every game is unlocked. Try a round with new numbers and no hints.', '全部解锁。可以换新数字、不看提示再做一轮。')}</p>}
    </div>
    <div class="mit-la__filters"><label>{t('Find a topic', '查找主题')}<input type="search" value={search} placeholder={config.searchPlaceholder[idx]} onInput={e => setSearch(e.currentTarget.value)} /></label><label>{t('Course unit', '课程单元')}<select value={filter} onChange={e => setFilter(e.currentTarget.value)}><option value="all">{t('All units', '全部单元')}</option>{units.map((unit, i) => <option value={String(i + 1)} key={i}>{unit[idx]}</option>)}</select></label></div>
    {units.map((unit, i) => {
      const shown = games.filter(g => g.unit === i + 1 && matches(g));
      const unitPsets = config.problemSets?.filter(p => p.unit === i + 1) ?? [];
      return shown.length ? <section key={i} class="mit-la__unit">
        <h4>{unit[idx]} ({shown.length})</h4>
        {unitPsets.length > 0 && <aside class="mit-la__sources mit-la__psets" aria-label={t(`Problem sets for ${unit[0]}`, `${unit[1]}习题集`)}>
          <strong>{t('Unit problem sets', '单元习题集')}</strong>
          <div class="mit-la__links">{unitPsets.map(ps => {
            const psLabel = t(`Problem Set ${ps.problemSet}`, `习题集 ${ps.problemSet}`);
            const primaryPs = ps.sources.filter(s => !secondary(s.kind));
            const links = (primaryPs.length ? primaryPs : ps.sources.slice(0, 1)).map(s => {
              const dupes = primaryPs.filter(p => p.kind === s.kind);
              const suffix = dupes.length > 1 ? ` ${dupes.indexOf(s) + 1}` : '';
              return <a key={sourceHref(s)} href={sourceHref(s)} target="_blank" rel="noopener noreferrer">
                {psLabel} · {label(s.kind)}{suffix} ↗
              </a>;
            });
            return [
              ...links,
              <a key={ps.officialUrl} href={ps.officialUrl} target="_blank" rel="noopener noreferrer">{psLabel} · {t('MIT page', 'MIT 页面')} ↗</a>,
            ];
          })}</div>
        </aside>}
        <ol class="mit-la__grid">{shown.map(g => <li key={g.id}><a href={hrefFor(g.id)} class={done.has(g.id) ? 'mit-la__card--done' : g === nextGame ? 'mit-la__card--next' : undefined} aria-current={selected === g.id ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); select(g.id); } }}><span class="mit-la__eyebrow">{g.id} · {kindLabel(g.kind)} {g.session}</span><strong>{g.sequence}. {g.title[lang]}</strong><span>{t(`${stagesOf(g.id)} stages`, `${stagesOf(g.id)} 步`)} · {done.has(g.id) ? t('Unlocked ✓', '已解锁 ✓') : g === nextGame ? t('Next →', '下一个 →') : t('Play →', '开始 →')}</span></a></li>)}</ol>
      </section> : null;
    })}
    {!games.some(matches) && <p role="status">{t('No matching games. Try another topic or unit.', '没有匹配的小游戏，请换一个主题或单元。')}</p>}
    <p class="mit-la__note">{config.note[idx]}</p>
    {config.extra?.(lang)}
  </section>;
}
