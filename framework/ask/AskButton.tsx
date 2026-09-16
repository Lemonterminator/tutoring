import { useContext, useState } from 'preact/hooks';
import { displayLang } from '../i18n/state';
import { tr } from '../i18n/ui';
import { LessonContext } from '../layout/LessonContext';
import { getAskProvider, type AskResult } from './provider';
import { buildQuestion, type AskContext } from './question';

export function AskButton({ where, getState }: { where: string; getState?: () => Record<string, unknown> }) {
  const { meta } = useContext(LessonContext);
  const [result, setResult] = useState<AskResult | null>(null);

  async function ask() {
    const ctx: AskContext = { lessonId: meta.id, lessonTitle: meta.title.en, where, lang: displayLang.value, state: getState?.() };
    setResult(await getAskProvider()(buildQuestion(ctx), ctx));
  }

  return (
    <div class="ask">
      <button type="button" class="btn btn--ghost" onClick={ask}>
        💬 {tr('ask')}
      </button>
      {result && (
        <span class="ask__status" role="status">
          {result === 'copied' ? tr('copied') : tr('copyFailed')}
        </span>
      )}
    </div>
  );
}
