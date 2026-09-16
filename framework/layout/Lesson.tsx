import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { frameworkComponents } from '../components';
import { displayLang, examMode, lang, setExamMode, setLang } from '../i18n/state';
import type { TermDict } from '../i18n/terms';
import { tr } from '../i18n/ui';
import { InertContext, LessonContext, type LessonMeta } from './LessonContext';

type MdxBody = ComponentType<{ components?: Record<string, unknown> }>;
export type LessonProps = { meta: LessonMeta; En: MdxBody; Fi: MdxBody; terms: TermDict };
type TocItem = { id: string; text: string };
type Tip = { html: string; top: number; left: number };

export function Lesson({ meta, En, Fi, terms }: LessonProps) {
  const shown = displayLang.value;
  const exam = examMode.value;
  const Body = shown === 'fi' ? Fi : En;
  const articleRef = useRef<HTMLElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    document.documentElement.lang = shown;
    document.title = meta.title[shown];
    const headings = articleRef.current?.querySelectorAll('h2[id]') ?? [];
    setToc(Array.from(headings, (h) => ({ id: h.id, text: h.textContent ?? '' })));
  }, [shown]);

  function showEnglishFor(event: MouseEvent) {
    if (!exam) return;
    const block = (event.target as Element).closest?.('[data-b]');
    const source = block && shadowRef.current?.querySelector(`[data-b="${block.getAttribute('data-b')}"]`);
    if (!block || !source) {
      setTip(null);
      return;
    }
    const rect = block.getBoundingClientRect();
    setTip({ html: source.innerHTML, top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
  }

  const glossary = Object.entries(terms).sort(([, a], [, b]) => a.fi.localeCompare(b.fi, 'fi'));

  return (
    <LessonContext.Provider value={{ meta, terms }}>
      <header class="topbar">
        <div class="topbar__title">{meta.title[shown]}</div>
        <div class="topbar__controls">
          <div class="seg" role="group" aria-label={tr('language')}>
            <button type="button" aria-pressed={lang.value === 'en'} disabled={exam} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang.value === 'fi'} disabled={exam} onClick={() => setLang('fi')}>
              FI
            </button>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={exam}
              onChange={(e) => {
                setExamMode((e.target as HTMLInputElement).checked);
                setTip(null);
              }}
            />
            {tr('examMode')}
          </label>
        </div>
      </header>

      <div class="page">
        <nav class="toc" aria-label={tr('contents')}>
          <div class="toc__head">{tr('contents')}</div>
          <ol>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ol>
          <a href="#glossary">{tr('glossary')}</a>
        </nav>

        <main>
          <article ref={articleRef} class="lesson" onMouseOver={showEnglishFor} onMouseLeave={() => setTip(null)}>
            <h1>{meta.title[shown]}</h1>
            <Body components={frameworkComponents} />
          </article>
          <section id="glossary" class="glossary">
            <h2>{tr('glossary')}</h2>
            <dl>
              {glossary.map(([id, t]) => (
                <div key={id} class="glossary__row">
                  <dt>{t.fi}</dt>
                  <dd>{t.en}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </div>

      {exam && (
        <InertContext.Provider value={true}>
          <div ref={shadowRef} class="shadow-en" aria-hidden="true">
            <En components={frameworkComponents} />
          </div>
        </InertContext.Provider>
      )}
      {tip && (
        <div class="en-tip" style={{ top: `${tip.top}px`, left: `${tip.left}px` }} dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </LessonContext.Provider>
  );
}
