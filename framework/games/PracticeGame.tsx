import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { gradeCard, type CardGenerator, type GameLanguage } from './types';
import { Figure2D } from './Figure2D';
import { MathText } from './MathText';
import 'katex/dist/katex.min.css';
import '../quant/dot-product-game.css';
import './practice-game.css';

function newDeck(generate: CardGenerator, lang: GameLanguage, previous?: string) {
  let cards, seed;
  do {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    cards = generate(seed, lang);
  } while (JSON.stringify(cards) === previous);
  for (const card of cards) {
    const modes = Number(!!card.fields) + Number(!!card.choice) + Number(!!card.slots);
    if (modes !== 1) throw new Error(`Card ${card.id} must have exactly one answer mode`);
  }
  if (!cards.length || new Set(cards.map(card => card.id)).size !== cards.length) throw new Error('A deck requires unique card IDs');
  return { seed, cards };
}

type PracticeFeedback = '' | 'incomplete' | 'correct' | 'wrong';

type PracticeSession = {
  seed: number;
  step: number;
  values: string[];
  slots: string[];
  token: string;
  selection: number | null;
  passed: boolean;
  showHint: boolean;
  feedback: PracticeFeedback;
  retries: number;
  hints: number;
};

// CourseLesson swaps its entire localized MDX body, which unmounts embedded
// games. Keep each keyed session in memory so language/game navigation does
// not discard the in-progress round.
const practiceSessions = new Map<string, PracticeSession>();
const generatorSessionKeys = new WeakMap<CardGenerator, string>();
let nextGeneratorSessionKey = 0;

function getSessionKey(generate: CardGenerator, explicitKey?: string): string {
  if (explicitKey) return explicitKey;
  let key = generatorSessionKeys.get(generate);
  if (!key) {
    key = `practice-generator:${++nextGeneratorSessionKey}`;
    generatorSessionKeys.set(generate, key);
  }
  return key;
}

export function PracticeGame({ generate, lang = 'zh', onComplete, sessionKey }: { generate: CardGenerator; lang?: GameLanguage; onComplete?: () => void; sessionKey?: string }) {
  const tr = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const stableSessionKey = getSessionKey(generate, sessionKey);
  const savedSession = practiceSessions.get(stableSessionKey);
  const [deck, setDeck] = useState(() => savedSession
    ? { seed: savedSession.seed, cards: generate(savedSession.seed, lang) }
    : newDeck(generate, lang));
  const cards = useMemo(() => generate(deck.seed, lang), [deck.seed, lang, generate]);
  const [step, setStep] = useState(() => savedSession?.step ?? 0);
  const [values, setValues] = useState<string[]>(() => savedSession?.values ?? []);
  const [slots, setSlots] = useState<string[]>(() => savedSession?.slots ?? []);
  const [token, setToken] = useState(() => savedSession?.token ?? '');
  const [selection, setSelection] = useState<number | null>(() => savedSession?.selection ?? null);
  const [passed, setPassed] = useState(() => savedSession?.passed ?? false), [showHint, setShowHint] = useState(() => savedSession?.showHint ?? false);
  const [feedback, setFeedback] = useState<PracticeFeedback>(() => savedSession?.feedback ?? '');
  const [retries, setRetries] = useState(() => savedSession?.retries ?? 0), [hints, setHints] = useState(() => savedSession?.hints ?? 0);
  const heading = useRef<HTMLHeadingElement>(null);
  const markerOrigin = useRef<{ x: number; y: number } | null>(null);
  const [markerOffset, setMarkerOffset] = useState({ x: 0, y: 0 });
  const done = step >= cards.length, card = cards[Math.min(step, cards.length - 1)];
  const feedbackText = feedback === 'incomplete'
    ? tr('请填完空位。数字支持整数、小数、分数（如 1/4）和科学计数法。', 'Fill all blanks. Numbers accept integers, decimals, fractions (1/4) and scientific notation.')
    : feedback === 'correct'
      ? tr('对了。看看理由，再继续。', 'Correct. Read the reasoning, then continue.')
      : feedback === 'wrong'
        ? tr('还不对，留在这一步再想一下。可打开提示，不会扣生命值。', 'Not yet. Stay on this step and reconsider, or open a hint. No lives are lost.')
        : '';
  useLayoutEffect(() => {
    practiceSessions.set(stableSessionKey, {
      seed: deck.seed, step, values: [...values], slots: [...slots], token, selection,
      passed, showHint, feedback, retries, hints,
    });
  }, [stableSessionKey, deck.seed, step, values, slots, token, selection, passed, showHint, feedback, retries, hints]);
  const clear = () => { setValues([]); setSlots([]); setToken(''); setSelection(null); setPassed(false); setShowHint(false); setFeedback(''); };
  const restart = () => { setDeck(newDeck(generate, lang, JSON.stringify(cards))); setStep(0); setRetries(0); setHints(0); clear(); };
  const place = (index: number, next: string) => {
    if (passed || !card.slots?.tokens.includes(next)) return;
    setSlots(old => { const updated = [...old]; updated[index] = next; return updated; }); setFeedback('');
  };
  const check = () => {
    const status = gradeCard(card, values, selection, slots);
    if (status === 'incomplete') { setFeedback('incomplete'); return; }
    if (status === 'correct') { setPassed(true); setFeedback('correct'); }
    else { setRetries(v => v + 1); setFeedback('wrong'); }
  };
  const continueGame = () => { if (step + 1 === cards.length) onComplete?.(); setStep(step + 1); clear(); requestAnimationFrame(() => heading.current?.focus()); };
  return <section class="dot-game practice-game" aria-label={tr('数学练习游戏', 'Mathematics practice game')}>
    <div class="dot-game__top"><span>{tr(`${cards.length} 个短步骤 · 无计时`, `${cards.length} short stages · no timer`)}</span><button type="button" class="btn btn--ghost" onClick={restart}>{tr('换一局', 'New round')}</button></div>
    <progress max={cards.length} value={Math.min(step, cards.length)} aria-label={tr('完成进度', 'Progress')} />
    <h3 ref={heading} tabIndex={-1}>{done ? tr('本组完成', 'Deck complete') : <><span>{step + 1}/{cards.length} · </span><MathText text={card.title} /></>}</h3>
    {done ? <><p><MathText text={tr(`返修 ${retries} 次，提示 ${hints} 次。这是本局练习记录，不是掌握程度评分。`, `${retries} retries, ${hints} hints. This is a practice record, not a mastery score.`)} /></p><p><MathText text={tr('再来一局时尝试不用提示，并用自己的话解释最后一题。', 'Try the next round without hints and explain the final problem in your own words.')} /></p><button type="button" class="btn" onClick={restart}>{tr('再来一局新数字', 'Play with new numbers')}</button></> : <>
      <p class="practice-game__prompt"><MathText text={card.prompt} /></p>
      {card.figure && <Figure2D figure={card.figure} />}
      {card.lines && <ul class="practice-game__lines">{card.lines.map((line, i) => <li key={i}><MathText text={line} /></li>)}</ul>}
      {card.bound && <div class="practice-game__bound">
        <p><MathText text={tr('证据天花板固定。把 ELBO 标记拖到新数值，也可以直接点击位置或填写下方数字。', 'The evidence ceiling is fixed. Drag the ELBO marker to its new value, select a position, or fill the number below.')} /></p>
        <button type="button" disabled={passed} class="btn btn--ghost practice-game__marker" style={{ transform: `translate(${markerOffset.x}px, ${markerOffset.y}px)` }} onPointerDown={e => { if (passed) return; markerOrigin.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { const origin = markerOrigin.current; if (origin) setMarkerOffset({ x: e.clientX - origin.x, y: e.clientY - origin.y }); }} onPointerUp={e => {
          if (!markerOrigin.current) return;
          const target = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest<HTMLElement>('[data-elbo-value]')).find(Boolean);
          const value = target?.dataset.elboValue;
          if (!passed && value !== undefined) { setValues([value]); setFeedback(''); }
          markerOrigin.current = null; setMarkerOffset({ x: 0, y: 0 });
        }} onPointerCancel={() => { markerOrigin.current = null; setMarkerOffset({ x: 0, y: 0 }); }}>ELBO: <MathText text={values[0] || String(card.bound.start)} /></button>
        <div class="practice-game__bound-rail">{[card.bound.ceiling - 2, card.bound.ceiling - 1, card.bound.ceiling, card.bound.ceiling + 1].map(value => <button key={value} type="button" data-elbo-value={value} disabled={passed} aria-label={`${tr('ELBO 位置', 'ELBO position')} ${value}`} onClick={() => { setValues([String(value)]); setFeedback(''); }}>
          <strong><MathText text={String(value)} /></strong><span><MathText text={value === card.bound!.ceiling ? tr('log₂ p(x) · 天花板', 'log₂ p(x) · ceiling') : value > card.bound!.ceiling ? tr('超过精确下界允许范围', 'Above the exact bound range') : 'ELBO'} /></span>
        </button>)}</div>
      </div>}
      {card.slots && <><p><MathText text={tr('拖入符号，或先点击符号再点击空位。符号可重复使用，也支持键盘选择。', 'Drag a token, or select it and then select a blank. Tokens can be reused; keyboard selection also works.')} /></p>
        <div class="dot-game__tokens">{[...new Set(card.slots.tokens)].map(item => <button type="button" key={item} draggable={!passed} disabled={passed} aria-pressed={token === item} onClick={() => setToken(item)} onDragStart={e => e.dataTransfer?.setData('text/plain', item)}><MathText text={item} /></button>)}</div>
        <div class="dot-game__formula practice-game__formula"><MathText text={card.slots.before} />{card.slots.answers.map((_, i) => <span key={i}><button type="button" class="dot-game__slot" disabled={passed} aria-label={`${tr('符号空位', 'Token blank')} ${i + 1}`} onClick={() => place(i, token)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); place(i, e.dataTransfer?.getData('text/plain') ?? ''); }}>{slots[i] ? <MathText text={slots[i]} /> : '?'}</button><MathText text={i < card.slots!.answers.length - 1 ? card.slots!.between?.[i] ?? ' ' : card.slots!.after ?? ''} /></span>)}</div>
      </>}
      {card.fields && <><p class="practice-game__format">{lang === 'zh'
        ? <>可填小数或分数，例如 <code>0.25</code> 或 <code>1/4</code>；含 <MathText text="$\pi$" /> 或根号时，可输入 <code>3pi/4</code>（<MathText text="$\frac{3\pi}{4}$" />）、<code>sqrt(2)</code>（<MathText text="$\sqrt{2}$" />）。近似答案的精度要求会在题目中注明。</>
        : <>Enter decimals or fractions, e.g. <code>0.25</code> or <code>1/4</code>. For <MathText text="$\pi$" /> and square roots, type <code>3pi/4</code> (<MathText text="$\frac{3\pi}{4}$" />) or <code>sqrt(2)</code> (<MathText text="$\sqrt{2}$" />). Any approximation tolerance is stated in the question.</>}</p>{card.fields.map((field, i) => <label class="dot-game__number" key={i}><MathText text={field.label} /><input type="text" autoComplete="off" spellcheck={false} aria-label={field.label} disabled={passed} value={values[i] ?? ''} onInput={e => { const next = e.currentTarget.value; setValues(old => { const updated = [...old]; updated[i] = next; return updated; }); setFeedback(''); }} /></label>)}</>}
      {card.choice && <div class="dot-game__tokens">{card.choice.options.map((option, i) => <button type="button" key={i} class="martingale-game__choice" disabled={passed} aria-pressed={selection === i} onClick={() => { setSelection(i); setFeedback(''); }}>{card.choice!.figures?.[i] && <Figure2D compact figure={card.choice!.figures![i]!} />}<MathText text={option} /></button>)}</div>}
      <div class="dot-game__actions">{passed ? <button type="button" class="btn" onClick={continueGame}>{step === cards.length - 1 ? tr('查看记录', 'View record') : tr('下一步', 'Continue')}</button> : <button type="button" class="btn" onClick={check}>{tr('检查', 'Check')}</button>}<button type="button" class="btn btn--ghost" disabled={showHint || passed} onClick={() => { setShowHint(true); setHints(v => v + 1); }}>{tr('一点提示', 'Hint')}</button></div>
      <p role="status" class="dot-game__feedback"><MathText text={feedbackText} /></p>
      {showHint && <p class="dot-game__hint"><MathText text={card.hint} /></p>}
      {passed && <div class="dot-game__hint"><strong>{tr('为什么', 'Why')}</strong><p><MathText text={card.explanation} /></p></div>}
    </>}
  </section>;
}
