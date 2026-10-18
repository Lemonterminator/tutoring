import { useRef, useState } from 'preact/hooks';
import { dot, generateDotRound, type Pair } from './dot-game-compute';
import './dot-product-game.css';

const titles = ['拼公式', '同位置相乘', '把乘积相加', '处理负号', '带符号相加', '正交侦探：先乘', '正交侦探：求和', '正交侦探：判断', '补齐向量：先算', '补齐向量：填数', '独立挑战'];
const enTitles = ['Build the formula', 'Multiply matching entries', 'Add the products', 'Handle signs', 'Add signed products', 'Orthogonality: multiply', 'Orthogonality: add', 'Orthogonality: decide', 'Complete a vector: multiply', 'Complete a vector: fill', 'Independent challenge'];
function freshRound(previous?: string) {
  // New entropy per session; also exclude the immediately previous set of numbers.
  let round;
  do { round = generateDotRound(crypto.getRandomValues(new Uint32Array(1))[0]); }
  while (JSON.stringify([round.basic, round.signed, round.geometry, round.missing, round.transfer]) === previous);
  return round;
}
const signature = (r: ReturnType<typeof generateDotRound>) => JSON.stringify([r.basic, r.signed, r.geometry, r.missing, r.transfer]);
const n = (value: number) => value < 0 ? `(${value})` : String(value);

export function DotProductGame({ lang = 'zh' }: { lang?: 'en' | 'zh' }) {
  const zh = lang === 'zh';
  const [round, setRound] = useState(() => freshRound());
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [slots, setSlots] = useState(['', '', '']);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState('');
  const [passed, setPassed] = useState(false);
  const [hint, setHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [retries, setRetries] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const pair: Pair = step < 3 ? round.basic : step < 5 ? round.signed : step < 8 ? round.geometry : step < 10 ? round.missing : round.transfer;
  const products = [pair.u[0] * pair.v[0], pair.u[1] * pair.v[1]];
  const productStep = [1, 3, 5].includes(step);
  const result = dot(pair);
  const expect = productStep ? products : step === 7 ? [result === 0 ? 0 : 1] : step === 8 ? [products[1]] : step === 9 ? [pair.v[0]] : [result];
  const done = step === titles.length;
  const setAnswer = (i: number, value: string) => { setAnswers((old) => { const next = [...old]; next[i] = value; return next; }); setFeedback(''); };
  const place = (i: number, symbol: string) => {
    if (passed || !['×', '+', '−', '÷'].includes(symbol)) return;
    setSlots((old) => old.map((value, index) => index === i ? symbol : value)); setFeedback('');
  };
  const check = () => {
    const filled = step === 0 ? slots.every(Boolean) : expect.every((_, i) => /^[-+]?\d+$/.test((answers[i] ?? '').trim()));
    if (!filled) { setFeedback(zh ? '先填完空格；数字可以带负号。' : 'Fill every blank; signed integers are allowed.'); return; }
    const correct = step === 0 ? slots.join('') === '×+×' : expect.every((value, i) => Number(answers[i]) === value);
    setAttempts((value) => value + 1);
    if (correct) { setPassed(true); setFeedback(zh ? '对了。想清楚这一步，再继续。' : 'Correct. Take a moment, then continue.'); }
    else { setRetries((value) => value + 1); setFeedback(zh ? (productStep ? '检查同位置的配对和正负号，再试一次。' : step === 7 ? '看点积是否恰好为 0，再选一次。' : step === 9 ? '让 x 与刚算的乘积相加等于 0。' : step === 0 ? '同位置相乘，然后把两个乘积相加。' : '检查加法与负号，再试一次。') : 'Check matching entries, signs, and whether the sum is zero. Try again.'); }
  };
  const next = () => { setStep(step + 1); setAnswers([]); setSlots(['', '', '']); setSelected(''); setFeedback(''); setPassed(false); setHint(false); requestAnimationFrame(() => heading.current?.focus()); };
  const restart = () => { setRound(freshRound(signature(round))); setStep(0); setAnswers([]); setSlots(['', '', '']); setFeedback(''); setPassed(false); setHint(false); setSelected(''); setAttempts(0); setRetries(0); setHintCount(0); };
  const hints = [
    zh ? 'u·v = u₁×v₁ + u₂×v₂。× 可以用两次。' : 'u·v = u₁×v₁ + u₂×v₂. Use × twice.',
    zh ? '只配对第一个和第一个、第二个和第二个。' : 'Pair first with first and second with second.',
    zh ? '把上一关的两个乘积相加。' : 'Add the two products from the previous step.',
    zh ? '负×正是负，正×负也是负。' : 'Negative × positive and positive × negative are negative.',
    zh ? '两个负数相加：绝对值相加，保留负号。' : 'Add the magnitudes of two negatives and keep the minus sign.',
    zh ? '分别算两个乘积，别急着判断。' : 'Calculate each product before deciding.',
    zh ? '相反数的和为 0。' : 'Opposite numbers add to zero.',
    zh ? '两个非零向量的点积为 0，就互相垂直。' : 'Two nonzero vectors with zero dot product are perpendicular.',
    zh ? '先算第二个位置的乘积。' : 'Start with the second-coordinate product.',
    zh ? 'x + 第二项乘积 = 0，所以 x 是该乘积的相反数。' : 'x + second product = 0; x is its opposite.',
    zh ? '重新配对、相乘、相加。这关不显示中间结果。' : 'Match, multiply, add. Intermediate results are hidden here.',
  ];
  const input = (i: number, label: string) => <label class="dot-game__number">{label}<input aria-label={label} type="text" inputMode="text" autoComplete="off" spellcheck={false} value={answers[i] ?? ''} disabled={passed} onInput={(e) => setAnswer(i, e.currentTarget.value)} /></label>;
  return <section class="dot-game" aria-label={zh ? '点积小游戏' : 'Dot product games'}>
    <div class="dot-game__top"><span>{zh ? '4 个小游戏 · 11 个短步骤 · 无计时' : '4 mini games · 11 short steps · no timer'}</span><button type="button" class="btn btn--ghost" onClick={restart}>{zh ? '换一局' : 'New round'}</button></div>
    <progress max={titles.length} value={Math.min(step, titles.length)} aria-label={zh ? '完成进度' : 'Progress'} />
    <h3 ref={heading} tabIndex={-1}>{done ? (zh ? '本局完成' : 'Round complete') : `${step + 1}/11 · ${(zh ? titles : enTitles)[step]}`}</h3>
    {done ? <div><p>{zh ? `完成 11 步，检查 ${attempts} 次，返修 ${retries} 次，提示 ${hintCount} 次。` : `11 steps completed; ${attempts} checks, ${retries} retries, ${hintCount} hints.`}</p><p>{zh ? '这是本局练习记录，不代表掌握整门线性代数。下一次试着不用提示，并解释为什么点积为零代表正交。' : 'This records practice, not mastery of linear algebra. Next time, avoid hints and explain why zero dot product means orthogonality.'}</p><button class="btn" onClick={restart}>{zh ? '再来一局新数字' : 'Play with new numbers'}</button></div> : <>
      <p class="dot-game__vectors">u = ({pair.u.join(', ')})　 v = ({step === 8 || step === 9 ? `x, ${pair.v[1]}` : pair.v.join(', ')})</p>
      {step === 0 ? <><p>{zh ? '把符号拖进空位。也可以先点击符号，再点击空位；可重复使用。' : 'Drag symbols into blanks, or select a symbol then select a blank. Symbols can be reused.'}</p><div class="dot-game__tokens">{['+', '×', '−', '÷'].map((symbol) => <button type="button" draggable={!passed} aria-pressed={selected === symbol} disabled={passed} onClick={() => setSelected(symbol)} onDragStart={(e) => e.dataTransfer?.setData('text/plain', symbol)}>{symbol}</button>)}</div><div class="dot-game__formula">u·v = {n(pair.u[0])}{[0, 1, 2].map((i) => <span><button type="button" class="dot-game__slot" disabled={passed} aria-label={`${zh ? '符号空位' : 'Symbol blank'} ${i + 1}`} onClick={() => place(i, selected)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); place(i, e.dataTransfer?.getData('text/plain') ?? ''); }}>{slots[i] || '□'}</button>{i === 0 ? n(pair.v[0]) : i === 1 ? n(pair.u[1]) : n(pair.v[1])}</span>)}</div></> : step === 7 ? <><p>{zh ? `刚算出的点积是 ${result}。这两个非零向量互相垂直吗？` : `The dot product is ${result}. Are these nonzero vectors perpendicular?`}</p><div class="dot-game__tokens">{[0, 1].map((value) => <button type="button" disabled={passed} aria-pressed={answers[0] === String(value)} onClick={() => setAnswer(0, String(value))}>{value === 0 ? (zh ? '垂直（正交）' : 'Perpendicular') : (zh ? '不垂直' : 'Not perpendicular')}</button>)}</div></> : <div class="dot-game__inputs">
        {productStep ? <>{input(0, `${n(pair.u[0])} × ${n(pair.v[0])} =`)}{input(1, `${n(pair.u[1])} × ${n(pair.v[1])} =`)}</> : step === 8 ? <><p>{zh ? '目标：补一个整数 x，使 u·v = 0。先处理已知部分。' : 'Find an integer x so u·v = 0. Start with the known part.'}</p>{input(0, `${n(pair.u[1])} × ${n(pair.v[1])} =`)}</> : step === 9 ? <>{input(0, `x + ${n(products[1])} = 0; x =`)}</> : <>{step < 8 && <p class="dot-game__formula">{n(products[0])} + {n(products[1])}</p>}{input(0, 'u·v =')}</>}
      </div>}
      <div class="dot-game__actions">{passed ? <button type="button" class="btn" onClick={next}>{step === 10 ? (zh ? '查看本局记录' : 'View round record') : (zh ? '下一步' : 'Continue')}</button> : <button type="button" class="btn" onClick={check}>{zh ? '检查' : 'Check'}</button>}<button type="button" class="btn btn--ghost" disabled={hint || passed} onClick={() => { setHint(true); setHintCount((v) => v + 1); }}>{zh ? '给一点提示' : 'Hint'}</button></div>
      <p role="status" class={passed ? 'dot-game__feedback dot-game__feedback--ok' : 'dot-game__feedback'}>{feedback}</p>
      {hint && <p class="dot-game__hint">{hints[step]}</p>}
    </>}
    <details><summary>{zh ? '规则与数值范围' : 'Rules and number bounds'}</summary><p>{zh ? '固定题型，本地随机生成数字；换一局不会复用上一整套数字。常规分量绝对值 ≤ 3，补齐的 x 绝对值 ≤ 9；单项乘积绝对值 ≤ 9，求和绝对值 ≤ 18。错误后留在当前步骤，不扣生命值；最后一关撤去中间结果。' : 'Fixed templates and locally randomized values; a new round differs from the previous set. Ordinary entries have magnitude ≤ 3, missing x ≤ 9; products ≤ 9 and sums ≤ 18. Errors stay on the current step, with no lost lives. The final challenge hides intermediate results.'}</p></details>
  </section>;
}
