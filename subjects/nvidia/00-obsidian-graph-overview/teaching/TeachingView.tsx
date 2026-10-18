import { useRef } from 'preact/hooks';
import type { TeachingLesson } from './types';
import './teaching.css';

type TeachingViewProps = {
  lesson: TeachingLesson;
  nodeId: string;
  language: 'en' | 'zh';
  onSelectNode: (id: string) => void;
  labelForNode: (id: string) => string;
};

export function TeachingView({ lesson, nodeId, language, onSelectNode, labelForNode }: TeachingViewProps) {
  const recapRef = useRef<HTMLElement | null>(null);
  const text = (value: { en: string; zh: string }) => value[language];
  const list = (value: { en: string[]; zh: string[] }) => value[language];
  const firstCheckQuestionId = `nvidia-study-check-question-${nodeId}`;

  const scrollToRecap = () => {
    const target = recapRef.current;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <article class="nvidia-teaching" key={`${nodeId}:${language}`}>
      <header class="nvidia-teaching__header">
        <div>
          <p class="nvidia-teaching__eyebrow">
            {language === 'zh' ? `${lesson.minutes} 分钟学习单元` : `${lesson.minutes}-minute teaching unit`}
          </p>
          <h3>{language === 'zh' ? '本节问题' : 'Guiding question'}</h3>
          <p class="nvidia-teaching__question">{text(lesson.question)}</p>
        </div>
        <button type="button" class="nvidia-teaching__recap-button" onClick={scrollToRecap}>
          {language === 'zh' ? '跳到总结' : 'Jump to recap'}
        </button>
      </header>

      {lesson.prerequisites.length > 0 && (
        <section class="nvidia-graph__study-section nvidia-teaching__prerequisites">
          <h3>{language === 'zh' ? '前置节点' : 'Prerequisite nodes'}</h3>
          <div class="nvidia-teaching__node-buttons">
            {lesson.prerequisites.map((id) => (
              <button type="button" key={`${nodeId}-prerequisite-${id}`} onClick={() => onSelectNode(id)}>
                {labelForNode(id)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="nvidia-graph__study-section nvidia-teaching__terms">
        <h3>{language === 'zh' ? '关键术语' : 'Key terms'}</h3>
        <dl>
          {lesson.terms.map((term) => (
            <div key={`${nodeId}-term-${text(term.name)}`}>
              <dt>{text(term.name)}</dt>
              <dd>{text(term.definition)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div class="nvidia-teaching__sections">
        {lesson.sections.map((section, index) => (
          <section class="nvidia-graph__study-section nvidia-teaching__section" key={`${nodeId}-section-${index}`}>
            <h3>{text(section.title)}</h3>
            {list(section.paragraphs).map((paragraph, paragraphIndex) => <p key={`${nodeId}-section-${index}-paragraph-${paragraphIndex}`}>{paragraph}</p>)}
            {section.equation && (
              <p class="nvidia-teaching__equation" aria-label={language === 'zh' ? '纯文本公式' : 'Plain-text equation'}>{section.equation}</p>
            )}
            {section.assumptions && <p class="nvidia-teaching__note"><strong>{language === 'zh' ? '假设：' : 'Assumptions: '}</strong>{text(section.assumptions)}</p>}
            {section.checkpoint && <p class="nvidia-teaching__checkpoint"><strong>{language === 'zh' ? '检查点：' : 'Checkpoint: '}</strong>{text(section.checkpoint)}</p>}
          </section>
        ))}
      </div>

      <section class="nvidia-graph__study-section nvidia-teaching__worked-example">
        <h3>{language === 'zh' ? '一步步算清楚' : 'Worked example, step by step'}</h3>
        <h4>{text(lesson.workedExample.title)}</h4>
        <p class="nvidia-teaching__note"><strong>{language === 'zh' ? '假设：' : 'Assumptions: '}</strong>{text(lesson.workedExample.assumptions)}</p>
        <ol class="nvidia-graph__compact-list">
          {list(lesson.workedExample.steps).map((step, index) => <li key={`${nodeId}-worked-step-${index}`}>{step.replace(/^\s*\d+[.)]\s+/, '')}</li>)}
        </ol>
        <p><strong>{language === 'zh' ? '结果：' : 'Result: '}</strong>{text(lesson.workedExample.result)}</p>
      </section>

      <section class="nvidia-graph__study-section nvidia-teaching__transfer">
        <h3>{text(lesson.transfer.title)}</h3>
        {list(lesson.transfer.paragraphs).map((paragraph, index) => <p key={`${nodeId}-transfer-${index}`}>{paragraph}</p>)}
        <p class="nvidia-teaching__boundary"><strong>{language === 'zh' ? '类比边界：' : 'Analogy boundary: '}</strong>{text(lesson.transfer.boundary)}</p>
      </section>

      <section class="nvidia-graph__study-section nvidia-teaching__recap" ref={recapRef}>
        <h3>{language === 'zh' ? '记忆摘要' : 'Recap'}</h3>
        <ul class="nvidia-graph__compact-list">{list(lesson.takeaways).map((item, index) => <li key={`${nodeId}-takeaway-${index}`}>{item}</li>)}</ul>
      </section>

      <section class="nvidia-graph__study-section nvidia-teaching__checks">
        <h3>{language === 'zh' ? '自测' : 'Checks'}</h3>
        {lesson.checks.map((check, index) => {
          const questionId = index === 0 ? firstCheckQuestionId : `${firstCheckQuestionId}-${index + 1}`;
          return (
            <details class="nvidia-graph__study-check-answer nvidia-teaching__check" key={`${nodeId}:${language}:check-${index}`}>
              <summary id={questionId}>{text(check.question)}</summary>
              <div class="nvidia-teaching__check-body">
                <h4>{language === 'zh' ? '答案' : 'Answer'}</h4>
                <p>{text(check.answer)}</p>
                <h4>{language === 'zh' ? '推理' : 'Reasoning'}</h4>
                <ul class="nvidia-graph__compact-list">{list(check.reasoning).map((item, itemIndex) => <li key={`${questionId}-reasoning-${itemIndex}`}>{item}</li>)}</ul>
                <h4>{language === 'zh' ? '评分要点' : 'Rubric'}</h4>
                <ul class="nvidia-graph__compact-list">{list(check.rubric).map((item, itemIndex) => <li key={`${questionId}-rubric-${itemIndex}`}>{item}</li>)}</ul>
                <h4>{language === 'zh' ? '边界' : 'Boundary'}</h4>
                <p>{text(check.boundary)}</p>
              </div>
            </details>
          );
        })}
      </section>

      <section class="nvidia-graph__study-section nvidia-teaching__sources">
        <h3>{language === 'zh' ? '来源' : 'Sources'}</h3>
        <ul class="nvidia-graph__compact-list">
          {lesson.sources.map((source) => (
            <li key={`${nodeId}-source-${source.url}`}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <span class="nvidia-teaching__source-note"> — {text(source.note)}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
