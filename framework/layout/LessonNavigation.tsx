import type { ComponentChildren } from 'preact';

export type LessonLink = {
  id: string;
  title: string | { en: string; fi?: string; zh?: string };
  devHref: string;
  buildHref: string;
};

export type LessonNavigationMeta = {
  previous?: LessonLink;
  next?: LessonLink;
  indexHref?: { dev: string; build: string };
};

export type LessonIndexData = {
  id: string;
  module?: string;
  prereqs?: string[];
  estimatedHours?: number;
  spine?: { a?: string; b?: string };
  derivations?: string[];
  visualizations?: string[];
  assignment?: string;
  references?: string[];
};

export type LessonNavigationLabels = {
  index: string;
  id: string;
  module: string;
  prerequisites: string;
  estimatedHours: string;
  spine: string;
  derivations: string;
  visualizations: string;
  assignment: string;
  references: string;
  contents: string;
  previous: string;
  next: string;
  openIndex: string;
};

export type TocItem = { id: string; text: string };

export function resolveLessonHref(link: { devHref: string; buildHref: string }): string {
  // The Vite dev server may fall back unknown `*.html` paths to the course
  // index, so the current pathname cannot tell us whether this is a built
  // page. The build mode is the source of truth for choosing the route.
  if (import.meta.env.DEV) return link.devHref;
  const href = link.buildHref.replace(/^\//, '');
  return href.startsWith('.') ? href : `./${href}`;
}

function joinItems(items: string[] | undefined): string {
  return items?.length ? items.join(' · ') : '—';
}

function linkTitle(link: LessonLink, language: 'en' | 'fi' | 'zh'): string {
  return typeof link.title === 'string' ? link.title : link.title[language] ?? link.title.en;
}

function MetaRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="lesson-index__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function LessonIndex({
  meta,
  toc,
  labels,
}: {
  meta: LessonIndexData;
  toc: TocItem[];
  labels: LessonNavigationLabels;
}) {
  return (
    <>
      <section class="lesson-index" aria-label={labels.index}>
        <div class="lesson-index__head">{labels.index}</div>
        <div class="lesson-index__id"><span>{labels.id}</span><code>{meta.id}</code></div>
        <dl class="lesson-index__meta">
          {meta.module && <MetaRow label={labels.module}>{meta.module}</MetaRow>}
          {meta.prereqs && <MetaRow label={labels.prerequisites}>{joinItems(meta.prereqs)}</MetaRow>}
          {meta.estimatedHours !== undefined && <MetaRow label={labels.estimatedHours}>{meta.estimatedHours} h</MetaRow>}
          {meta.derivations && <MetaRow label={labels.derivations}>{joinItems(meta.derivations)}</MetaRow>}
          {meta.visualizations && <MetaRow label={labels.visualizations}>{joinItems(meta.visualizations)}</MetaRow>}
          {meta.assignment && <MetaRow label={labels.assignment}><code>{meta.assignment}</code></MetaRow>}
          {meta.references && <MetaRow label={labels.references}>{joinItems(meta.references)}</MetaRow>}
        </dl>
        {meta.spine && (
          <details class="lesson-index__spine" open>
            <summary>{labels.spine}</summary>
            {meta.spine.a && <p><strong>A.</strong> {meta.spine.a}</p>}
            {meta.spine.b && <p><strong>B.</strong> {meta.spine.b}</p>}
          </details>
        )}
      </section>

      <div class="toc__head">{labels.contents}</div>
      <ol>
        {toc.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </>
  );
}

export function LessonPager({
  navigation,
  labels,
  titleLanguage = 'en',
}: {
  navigation: LessonNavigationMeta;
  labels: Pick<LessonNavigationLabels, 'previous' | 'next' | 'openIndex'>;
  titleLanguage?: 'en' | 'fi' | 'zh';
}) {
  const previous = navigation.previous;
  const next = navigation.next;
  const indexHref = navigation.indexHref
    ? resolveLessonHref({ devHref: navigation.indexHref.dev, buildHref: navigation.indexHref.build })
    : null;
  if (!previous && !next && !indexHref) return null;

  return (
    <nav class="lesson-pager" aria-label={labels.openIndex}>
      {previous ? (
        <a class="lesson-pager__link" href={resolveLessonHref(previous)} rel="prev">
          <span class="lesson-pager__label">← {labels.previous}</span>
          <strong>{linkTitle(previous, titleLanguage)}</strong>
        </a>
      ) : <span />}
      {indexHref && <a class="lesson-pager__index" href={indexHref}>{labels.openIndex}</a>}
      {next ? (
        <a class="lesson-pager__link lesson-pager__link--next" href={resolveLessonHref(next)} rel="next">
          <span class="lesson-pager__label">{labels.next} →</span>
          <strong>{linkTitle(next, titleLanguage)}</strong>
        </a>
      ) : <span />}
    </nav>
  );
}
