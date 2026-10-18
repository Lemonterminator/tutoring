import { useRef, useState } from 'preact/hooks';
import { fundamentalSpacesRoundSignature, generateFundamentalSpacesRound, lectureExample } from './fundamental-spaces-game-compute';
import './dot-product-game.css';
import './fundamental-spaces-game.css';

type Lang = 'en' | 'zh';
type SpaceToken = { id: string; label: string };
type ChoiceCard = {
  kind: 'choice'; title: string; prompt: string; choices: string[]; answer: number;
  hint: string; explanation: string;
};
type NumberCard = {
  kind: 'number'; title: string; prompt: string; fields: Array<{ label: string; answer: number }>;
  hint: string; explanation: string; matrix?: boolean;
};
type MatchCard = {
  kind: 'match'; title: string; prompt: string; tokens: SpaceToken[]; answer: [string, string];
  hint: string; explanation: string;
};
type Card = ChoiceCard | NumberCard | MatchCard;

const lectureMatrix = 'A = [1  2  3  1]     R = [1  0  1  1]\n    [1  1  2  1]         [0  1  1  0]\n    [1  2  3  1]         [0  0  0  0]';
const tr = (lang: Lang, zh: string, en: string) => lang === 'zh' ? zh : en;

function freshRound(previous?: string) {
  let round;
  do {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    round = generateFundamentalSpacesRound(seed);
  } while (fundamentalSpacesRoundSignature(round) === previous);
  return round;
}

function buildCards(lang: Lang, challenge: { m: number; n: number; r: number }): Card[] {
  const zh = lang === 'zh';
  const ex = lectureExample;
  const allSpaces: SpaceToken[] = [
    { id: 'column', label: zh ? 'C(A) · 列空间' : 'C(A) · column space' },
    { id: 'null', label: zh ? 'N(A) · 零空间' : 'N(A) · nullspace' },
    { id: 'row', label: zh ? 'C(Aᵀ) · 行空间' : 'C(Aᵀ) · row space' },
    { id: 'left-null', label: zh ? 'N(Aᵀ) · 左零空间' : 'N(Aᵀ) · left nullspace' },
  ];
  return [
    {
      kind: 'choice', title: tr(lang, '给四个空间分房间', 'Place the four spaces'),
      prompt: tr(lang, '若 A 是 m×n 矩阵，哪一对一定属于 Rⁿ？', 'If A is m×n, which pair always lives in Rⁿ?'),
      choices: [
        tr(lang, 'C(A) 与 N(Aᵀ)', 'C(A) and N(Aᵀ)'),
        tr(lang, 'C(Aᵀ)（行空间）与 N(A)', 'C(Aᵀ) (row space) and N(A)'),
        tr(lang, '四个空间都在 Rⁿ', 'All four spaces'),
      ], answer: 1,
      hint: tr(lang, '看向量的长度：Ax 的 x 有 n 个分量；A 的每一列有 m 个分量。', 'Check vector length: x in Ax has n entries, while each column of A has m entries.'),
      explanation: tr(lang, '行空间 C(Aᵀ) 和零空间 N(A) 都在 Rⁿ；列空间与左零空间在 Rᵐ。', 'The row space C(Aᵀ) and nullspace N(A) are in Rⁿ; the column space and left nullspace are in Rᵐ.'),
    },
    {
      kind: 'number', title: tr(lang, '读出讲义例题的秩', 'Read the rank in the lecture example'),
      prompt: tr(lang, '讲义把这个 3×4 矩阵化为阶梯形 R。数主元列，填入秩 r。', 'The lecture reduces this 3×4 matrix to echelon form R. Count the pivot columns and enter rank r.'),
      fields: [{ label: 'r =', answer: ex.r }], matrix: true,
      hint: tr(lang, '数 R 中首个非零元所在的列。', 'Count the columns containing a leading nonzero entry in R.'),
      explanation: tr(lang, 'R 有两个主元，所以 r=2。A 的主元列给出 C(A) 的一组基；R 的前 r 个非零行给出行空间的一组基。', 'R has two pivots, so r=2. The pivot columns of A give a basis for C(A); the first r nonzero rows of R give a basis for the row space.'),
    },
    {
      kind: 'number', title: tr(lang, '列空间的维数', 'Dimension of the column space'),
      prompt: tr(lang, '本例的秩 r=2。dim C(A) 等于多少？行空间的维数与它相同。', 'Here rank r=2. What is dim C(A)? The row space has the same dimension.'),
      fields: [{ label: 'dim C(A) =', answer: ex.r }],
      hint: tr(lang, '主元列构成 C(A) 的基。', 'The pivot columns form a basis for C(A).'),
      explanation: tr(lang, `dim C(A)=r=${ex.r}，并且 dim C(Aᵀ)=r。`, `dim C(A)=r=${ex.r}, and dim C(Aᵀ)=r as well.`),
    },
    {
      kind: 'number', title: tr(lang, '零空间的维数', 'Dimension of the nullspace'),
      prompt: tr(lang, `本例有 n=${ex.n} 个变量、r=${ex.r} 个主元。dim N(A)=n-r 是多少？`, `There are n=${ex.n} variables and r=${ex.r} pivots. Find dim N(A)=n-r.`),
      fields: [{ label: `n-r = ${ex.n}-${ex.r} =`, answer: ex.n - ex.r }],
      hint: tr(lang, '自由变量数 = 变量总数 − 主元数。', 'The number of free variables is total variables minus pivots.'),
      explanation: tr(lang, `有 ${ex.n - ex.r} 个自由变量，因此 dim N(A)=${ex.n - ex.r}。`, `There are ${ex.n - ex.r} free variables, so dim N(A)=${ex.n - ex.r}.`),
    },
    {
      kind: 'number', title: tr(lang, '左零空间的维数', 'Dimension of the left nullspace'),
      prompt: tr(lang, `A 有 m=${ex.m} 行、秩 r=${ex.r}。dim N(Aᵀ)=m-r 是多少？`, `A has m=${ex.m} rows and rank r=${ex.r}. Find dim N(Aᵀ)=m-r.`),
      fields: [{ label: `m-r = ${ex.m}-${ex.r} =`, answer: ex.m - ex.r }],
      hint: tr(lang, '把 A 转置后有 m 列，其中 r 个主元。', 'After transposing A, there are m columns and r pivots.'),
      explanation: tr(lang, `dim N(Aᵀ)=m-r=${ex.m - ex.r}。本例中它由一个独立的行依赖描述。`, `dim N(Aᵀ)=m-r=${ex.m - ex.r}. Here it records one independent dependency among the rows.`),
    },
    {
      kind: 'match', title: tr(lang, '在 Rⁿ 中找正交搭档', 'Find the orthogonal pair in Rⁿ'),
      prompt: tr(lang, '把构成正交补的两个空间放入空位。可拖拽，也可先点符号再点空位。', 'Place the two orthogonal-complement spaces in the slots. Drag, or select a label and then a slot.'),
      tokens: allSpaces, answer: ['row', 'null'],
      hint: tr(lang, '每一行与 Ax=0 的解向量点积为 0。', 'Every row has zero dot product with a solution of Ax=0.'),
      explanation: tr(lang, '行空间 C(Aᵀ) 与零空间 N(A) 在 Rⁿ 中互为正交补。', 'The row space C(Aᵀ) and nullspace N(A) are orthogonal complements in Rⁿ.'),
    },
    {
      kind: 'match', title: tr(lang, '在 Rᵐ 中找正交搭档', 'Find the orthogonal pair in Rᵐ'),
      prompt: tr(lang, '再找出 Rᵐ 中的正交补空间对。', 'Now find the orthogonal-complement pair in Rᵐ.'),
      tokens: allSpaces, answer: ['column', 'left-null'],
      hint: tr(lang, '若 y∈N(Aᵀ)，则 yᵀA=0。', 'If y is in N(Aᵀ), then yᵀA=0.'),
      explanation: tr(lang, '列空间 C(A) 与左零空间 N(Aᵀ) 在 Rᵐ 中互为正交补。', 'The column space C(A) and left nullspace N(Aᵀ) are orthogonal complements in Rᵐ.'),
    },
    {
      kind: 'choice', title: tr(lang, '左零空间的定义', 'Define the left nullspace'),
      prompt: tr(lang, '向量 y 属于 N(Aᵀ) 的条件是哪一个？', 'Which condition says that y belongs to N(Aᵀ)?'),
      choices: ['Ay = 0', 'Aᵀy = 0', 'Ax = b'], answer: 1,
      hint: tr(lang, '“左”来自 yᵀA=0；把它转置。', '“Left” comes from yᵀA=0; transpose that equation.'),
      explanation: tr(lang, 'Aᵀy=0 等价于 yᵀA=0；y 的长度是 m。', 'Aᵀy=0 is equivalent to yᵀA=0, with y having m entries.'),
    },
    {
      kind: 'choice', title: tr(lang, '什么时候 Ax=b 有解？', 'When is Ax=b solvable?'),
      prompt: tr(lang, '已知 b∈Rᵐ。Ax=b 有解的充要条件是什么？', 'Given b∈Rᵐ, what is the necessary and sufficient condition for Ax=b to have a solution?'),
      choices: [
        tr(lang, 'b∈C(A)', 'b∈C(A)'),
        tr(lang, 'b∈N(A)', 'b∈N(A)'),
        tr(lang, 'b∈Rⁿ', 'b∈Rⁿ'),
      ], answer: 0,
      hint: tr(lang, 'Ax 是 A 的列的线性组合。', 'Ax is a linear combination of the columns of A.'),
      explanation: tr(lang, 'Ax=b 有解，当且仅当 b 是 A 的列组合，也就是 b∈C(A)。', 'Ax=b is solvable exactly when b is a combination of the columns of A: b∈C(A).'),
    },
    {
      kind: 'choice', title: tr(lang, '解集长什么样？', 'What does the solution set look like?'),
      prompt: tr(lang, '若 xp 是一个特解，所有解如何写？', 'If xₚ is one particular solution, how can every solution be written?'),
      choices: ['xₚ + N(A)', 'xₚ + C(A)', 'N(Aᵀ) + b'], answer: 0,
      hint: tr(lang, '两个解相减后满足 A(x₁−x₂)=0。', 'The difference of two solutions satisfies A(x₁−x₂)=0.'),
      explanation: tr(lang, '所有解为 xp+z，其中 z∈N(A)；齐次解描述了特解之外的全部自由度。', 'Every solution is xp+z with z∈N(A); the nullspace contains every freedom beyond the particular solution.'),
    },
    {
      kind: 'choice', title: tr(lang, '矩阵也能组成向量空间', 'Matrices can form a vector space too'),
      prompt: tr(lang, '在所有 3×3 矩阵中，上三角矩阵与对称矩阵的交集是什么？', 'Inside the vector space of all 3×3 matrices, what is the intersection of upper-triangular and symmetric matrices?'),
      choices: [tr(lang, '对角矩阵 D', 'Diagonal matrices D'), tr(lang, '所有对称矩阵', 'All symmetric matrices'), tr(lang, '零矩阵集合以外的矩阵', 'All matrices except the zero matrix')], answer: 0,
      hint: tr(lang, '对称性要求主对角线两侧成对相等；上三角性让下三角为零。', 'Symmetry pairs entries across the diagonal; upper-triangular form sets the lower triangle to zero.'),
      explanation: tr(lang, '两条条件一起迫使所有非对角元素为零，留下对角矩阵 D。', 'Together, the two conditions force every off-diagonal entry to zero, leaving diagonal matrices D.'),
    },
    {
      kind: 'number', title: tr(lang, '对角子空间有多大？', 'How large is the diagonal subspace?'),
      prompt: tr(lang, '一个 3×3 对角矩阵有几个可独立选择的对角元素？', 'How many diagonal entries can be chosen independently in a 3×3 diagonal matrix?'),
      fields: [{ label: 'dim D =', answer: 3 }],
      hint: tr(lang, '一组基可以分别把三个对角位置设为 1。', 'A basis sets one of the three diagonal positions to 1 at a time.'),
      explanation: tr(lang, 'dim D=3；三个基矩阵分别在一个对角位置取 1，其余位置为 0。', 'dim D=3; three basis matrices place a 1 in one diagonal position at a time.'),
    },
    {
      kind: 'number', title: tr(lang, '独立挑战：换一张矩阵', 'Independent challenge: a new matrix'),
      prompt: tr(lang, `只给 m=${challenge.m}、n=${challenge.n}、r=${challenge.r}。不显示中间步骤，填出两个零空间的维数。`, `Given only m=${challenge.m}, n=${challenge.n}, and r=${challenge.r}, find both nullspace dimensions without intermediate steps.`),
      fields: [
        { label: `dim N(A) = n-r = ${challenge.n}-${challenge.r} =`, answer: challenge.n - challenge.r },
        { label: `dim N(Aᵀ) = m-r = ${challenge.m}-${challenge.r} =`, answer: challenge.m - challenge.r },
      ],
      hint: tr(lang, '回想两个自由变量计数：一个减去 r 的是列数 n，另一个减去 r 的是行数 m。', 'Recall the two free-variable counts: subtract r from the number of columns n and from the number of rows m.'),
      explanation: tr(lang, `dim N(A)=${challenge.n}-${challenge.r}=${challenge.n - challenge.r}，dim N(Aᵀ)=${challenge.m}-${challenge.r}=${challenge.m - challenge.r}。`, `dim N(A)=${challenge.n}-${challenge.r}=${challenge.n - challenge.r}, and dim N(Aᵀ)=${challenge.m}-${challenge.r}=${challenge.m - challenge.r}.`),
    },
  ];
}

export function FundamentalSpacesGame({ lang = 'zh' }: { lang?: Lang }) {
  const zh = lang === 'zh';
  const [round, setRound] = useState(() => freshRound());
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [slots, setSlots] = useState(['', '']);
  const [selectedToken, setSelectedToken] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [passed, setPassed] = useState(false);
  const [hint, setHint] = useState(false);
  const [checks, setChecks] = useState(0);
  const [retries, setRetries] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const cards = buildCards(lang, round.challenge);
  const done = step === cards.length;
  const card = cards[Math.min(step, cards.length - 1)];

  const setAnswer = (index: number, value: string) => {
    setAnswers((old) => { const next = [...old]; next[index] = value; return next; });
    setFeedback('');
  };
  const place = (index: number, tokenId: string) => {
    if (passed || card.kind !== 'match' || !card.tokens.some((token) => token.id === tokenId)) return;
    setSlots((old) => old.map((value, slot) => slot === index ? tokenId : value));
    setFeedback('');
  };
  const check = () => {
    const filled = card.kind === 'choice'
      ? selectedChoice !== null
      : card.kind === 'number'
        ? card.fields.every((_, index) => /^[-+]?\d+$/.test((answers[index] ?? '').trim()))
        : slots.every(Boolean);
    if (!filled) {
      setFeedback(tr(lang, '先选完答案或填完所有数字。', 'Select an answer or fill every number first.'));
      return;
    }
    const correct = card.kind === 'choice'
      ? selectedChoice === card.answer
      : card.kind === 'number'
        ? card.fields.every((field, index) => Number(answers[index]) === field.answer)
        : new Set(slots).size === 2 && slots.every((value) => card.answer.includes(value));
    setChecks((value) => value + 1);
    if (correct) {
      setPassed(true);
      setFeedback(tr(lang, '对了。看一下这一步为什么成立，再继续。', 'Correct. Review why this step works, then continue.'));
    } else {
      setRetries((value) => value + 1);
      setFeedback(tr(lang, '还不对。留在这一关再想想；可以打开提示。', 'Not yet. Stay on this step and reconsider; a hint is available.'));
    }
  };
  const clearStep = () => {
    setAnswers([]); setSlots(['', '']); setSelectedToken(''); setSelectedChoice(null);
    setFeedback(''); setPassed(false); setHint(false);
  };
  const next = () => {
    setStep((value) => value + 1);
    clearStep();
    requestAnimationFrame(() => heading.current?.focus());
  };
  const restart = () => {
    setRound(freshRound(fundamentalSpacesRoundSignature(round)));
    setStep(0); setChecks(0); setRetries(0); setHintCount(0); clearStep();
  };

  return <section class="dot-game four-spaces" aria-label={tr(lang, '四个基本子空间小游戏', 'Four fundamental subspaces game')}>
    <div class="dot-game__top">
      <span>{tr(lang, '13 步 · 小整数 · 无计时、无扣命', '13 steps · small integers · no timer or lost lives')}</span>
      <button type="button" class="btn btn--ghost" onClick={restart}>{tr(lang, '换一局', 'New round')}</button>
    </div>
    <progress max={cards.length} value={Math.min(step, cards.length)} aria-label={tr(lang, '完成进度', 'Progress')} />
    <h3 ref={heading} tabIndex={-1}>{done ? tr(lang, '挑战完成', 'Challenge complete') : `${step + 1}/${cards.length} · ${card.title}`}</h3>
    {done ? <>
      <p>{tr(lang, `完成 ${cards.length} 步，检查 ${checks} 次，返修 ${retries} 次，提示 ${hintCount} 次。`, `${cards.length} steps completed; ${checks} checks, ${retries} retries, ${hintCount} hints.`)}</p>
      <p>{tr(lang, '这是本局练习记录，不是掌握度分数。下次可以先独立推导两个零空间维数，再解释为什么它们与另两个子空间正交。', 'This is a practice record, not a mastery score. Next time, derive both nullspace dimensions first and explain why each is orthogonal to its partner.')}</p>
      <button type="button" class="btn" onClick={restart}>{tr(lang, '再来一局', 'Play another round')}</button>
    </> : <>
      <p>{card.prompt}</p>
      {card.kind === 'number' && card.matrix && <div class="four-spaces__matrix"><pre>{lectureMatrix}</pre></div>}
      {card.kind === 'choice' && <div class="dot-game__tokens four-spaces__choices">
        {card.choices.map((choice, index) => <button type="button" key={choice} disabled={passed}
          aria-pressed={selectedChoice === index} onClick={() => { setSelectedChoice(index); setFeedback(''); }}>{choice}</button>)}
      </div>}
      {card.kind === 'number' && <div class="four-spaces__inputs">
        {card.fields.map((field, index) => <label class="dot-game__number four-spaces__number" key={field.label}>
          <span>{field.label}</span><input type="text" inputMode="numeric" autoComplete="off" spellcheck={false}
            aria-label={field.label} disabled={passed} value={answers[index] ?? ''}
            onInput={(event) => setAnswer(index, event.currentTarget.value)} />
        </label>)}
      </div>}
      {card.kind === 'match' && <>
        <div class="dot-game__tokens four-spaces__choices">
          {card.tokens.map((token) => <button type="button" key={token.id} draggable={!passed} disabled={passed}
            aria-pressed={selectedToken === token.id} onClick={() => setSelectedToken(token.id)}
            onDragStart={(event) => event.dataTransfer?.setData('text/plain', token.id)}>{token.label}</button>)}
        </div>
        <div class="four-spaces__slots">
          {slots.map((slot, index) => <button type="button" key={index} class="dot-game__slot four-spaces__slot" disabled={passed}
            aria-label={`${tr(lang, '正交空间空位', 'Orthogonal-space slot')} ${index + 1}`}
            onClick={() => place(index, selectedToken)} onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); place(index, event.dataTransfer?.getData('text/plain') ?? ''); }}>
            {slot ? card.tokens.find((token) => token.id === slot)?.label : tr(lang, '放入一个空间', 'Place a space')}
          </button>)}
        </div>
      </>}
      <div class="dot-game__actions">
        {passed
          ? <button type="button" class="btn" onClick={next}>{step === cards.length - 1 ? tr(lang, '查看本局记录', 'View round record') : tr(lang, '下一步', 'Continue')}</button>
          : <button type="button" class="btn" onClick={check}>{tr(lang, '检查', 'Check')}</button>}
        <button type="button" class="btn btn--ghost" disabled={hint || passed} onClick={() => { setHint(true); setHintCount((value) => value + 1); }}>{tr(lang, '给一点提示', 'Hint')}</button>
      </div>
      <p role="status" class={passed ? 'dot-game__feedback dot-game__feedback--ok' : 'dot-game__feedback'}>{feedback}</p>
      {hint && <p class="dot-game__hint">{card.hint}</p>}
      {passed && <p class="dot-game__explanation">{card.explanation}</p>}
    </>}
    <details><summary>{tr(lang, '范围与玩法说明', 'Bounds and rules')}</summary>
      <p>{tr(lang, '题目围绕讲义中的 3×4、秩为 2 的例子；独立挑战从固定案例抽取 m,n≤5 且 1≤r≤min(m,n)。数字只需做小整数减法。题型固定，错误后留在本关；提示和返修只记录练习过程。', 'The guided questions use the lecture’s 3×4, rank-2 example. The final challenge selects from fixed cases with m,n≤5 and 1≤r≤min(m,n). Arithmetic is small-integer subtraction. Templates are fixed; errors stay on the current step, and hint/retry counts describe practice only.')}</p>
    </details>
  </section>;
}
