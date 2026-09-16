import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { LessonContext } from '../layout/LessonContext';
import { examMode, lang } from './state';
import { termView } from './terms';

export function Term({ id, children }: { id: string; children?: ComponentChildren }) {
  const { terms } = useContext(LessonContext);
  const entry = terms[id];
  if (!entry) {
    return (
      <span class="term term--missing">
        {children} [?{id}]
      </span>
    );
  }
  const view = termView(entry, lang.value, examMode.value);
  return (
    <span class="term" data-term={id} title={view.hover ?? undefined}>
      <strong>{children}</strong>
      {view.secondary && <span class="term__alt"> ({view.secondary})</span>}
    </span>
  );
}
