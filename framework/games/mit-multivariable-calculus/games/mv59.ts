import type { CardGenerator } from '../../types';
import { arrowField, ellipse, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, linear, makeMvDeck, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const mv59: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-59');
  warm(g);

  // 1. curl-setup
  const letterSets = [
    ['M', 'N', 'P'],
    ['A', 'B', 'C'],
    ['L', 'M', 'N'],
    ['P', 'Q', 'R'],
    ['f', 'g', 'h'],
    ['u', 'v', 'w'],
  ];
  const [A, B, C] = g.pick(letterSets);
  const setupAnswers = [C, B, A, C, B, A];
  const setupTokens = shuffled(g, [A, B, C, '0', 'x', 'y', 'z']);

  // 2. curl-vector
  const cv = retry(() => ({
    p: g.pick([-3, -2, -1, 1, 2, 3]),
    q: g.pick([-3, -2, -1, 1, 2, 3]),
    r: g.pick([-3, -2, -1, 1, 2, 3]),
  }), v => v.p !== 0 && v.q !== 0 && v.r !== 0);
  const cvAns = [-cv.q, -cv.r, -cv.p];

  // 3. paddle-speed
  const w = g.random(1, 6);
  const paddleShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0.9, 0.9, 0.4), tone: 'accent' },
    { kind: 'arrow', from: [1.3, 0.9], to: [0.9, 1.3], tone: 'accent2' },
    { kind: 'arrow', from: [0.9, 1.3], to: [0.5, 0.9], tone: 'accent2' },
    { kind: 'arrow', from: [0.5, 0.9], to: [0.9, 0.5], tone: 'accent2' },
    { kind: 'arrow', from: [0.9, 0.5], to: [1.3, 0.9], tone: 'accent2' },
    { kind: 'point', at: [0.9, 0.9], tone: 'text' },
  ];

  // 4. curl-y
  const cy = retry(() => ({
    a: g.pick([2, 3, 4, 5]),
    c: g.pick([2, 3, 4, 5]),
  }), v => v.a !== v.c);
  const cyAns = cy.a - cy.c;

  // 5. conservative-potential
  const d = g.random(2, 7);
  const potAnswer = `${d}x z`;
  const potTokens = shuffled(g, [
    `${d}x z`,
    `${d}x y`,
    `${d}z`,
    `${d}`,
    `${2 * d}x z`,
  ]);

  // 6. orientation-spin
  const s = g.pick([-3, -2, -1, 1, 2, 3]);
  const spinCorrect = s > 0 ? 'clockwise' : 'counterclockwise';
  const spinWrong = s > 0 ? 'counterclockwise' : 'clockwise';
  // The picture shows the field F = (s·y, 0, 0) and the wheel, never the spin sense (that is the answer).
  const fieldGrid = [-1.2, -0.6, 0, 0.6, 1.2];
  const spokes = 0.3 / Math.SQRT2;
  const spinShapes: FigureShape[] = [
    ...arrowField((_x, y) => [s * y, 0], fieldGrid, fieldGrid, 0.4, 'accent2'),
    { kind: 'line', points: ellipse(0, 0, 0.3), tone: 'accent' },
    { kind: 'line', points: [[-spokes, -spokes], [spokes, spokes]], tone: 'accent' },
    { kind: 'line', points: [[-spokes, spokes], [spokes, -spokes]], tone: 'accent' },
    { kind: 'point', at: [0, 0], tone: 'text', hollow: true, label: 'k' },
  ];

  // 7. assumption-domain
  const loci = [
    t('origin', '原点'),
    t('z-axis', 'z 轴'),
    t('circle', '一个圆'),
    t('xy-plane', 'xy 平面'),
    t('sphere', '一个球面'),
    t('segment', '一条线段'),
  ];
  const locus = g.pick(loci);

  // 8. curl-k
  const ck = retry(() => ({
    p: g.random(1, 6),
    q: g.random(1, 6),
    r: g.random(1, 6),
  }), v => v.p !== 0 && v.q !== 0 && v.r !== 0);
  const ckAns = ck.q - ck.p;

  // 9. challenge
  const ch = retry(() => ({
    p: g.pick([-3, -2, -1, 1, 2, 3]),
    q: g.pick([-3, -2, -1, 1, 2, 3]),
    r: g.pick([-3, -2, -1, 1, 2, 3]),
    a: g.pick([-3, -2, -1, 1, 2, 3]),
    b: g.pick([-3, -2, -1, 1, 2, 3]),
    c: g.pick([-3, -2, -1, 1, 2, 3]),
  }), v => {
    const val = -(v.a * v.q + v.b * v.r + v.c * v.p);
    return v.p !== 0 && v.q !== 0 && v.r !== 0 && v.a !== 0 && v.b !== 0 && v.c !== 0 && val !== 0 && Math.abs(val) <= 12;
  });
  const chAns = -(ch.a * ch.q + ch.b * ch.r + ch.c * ch.p);

  return [
    g.symbols({
      id: 'curl-setup',
      title: t('Write the definition of curl', '写出旋度的定义'),
      prompt: t(
        `For F = (${A}, ${B}, ${C}) = ${A} i + ${B} j + ${C} k, complete the definition curl F = ( ∂[ ]/∂y − ∂[ ]/∂z , ∂[ ]/∂z − ∂[ ]/∂x , ∂[ ]/∂x − ∂[ ]/∂y ).`,
        `设 F = (${A}, ${B}, ${C}) = ${A} i + ${B} j + ${C} k，补全旋度的定义 curl F = ( ∂[ ]/∂y − ∂[ ]/∂z , ∂[ ]/∂z − ∂[ ]/∂x , ∂[ ]/∂x − ∂[ ]/∂y )。`,
      ),
      before: 'curl F = ( ∂',
      between: ['/∂y − ∂', '/∂z , ∂', '/∂z − ∂', '/∂x , ∂', '/∂x − ∂'],
      after: t('/∂y ) .', '/∂y )。'),
      answers: setupAnswers,
      tokens: setupTokens,
      hint: t(
        'The first component pairs ∂/∂y with the third component and ∂/∂z with the second; the pattern cycles (V15.1, eq. 4).',
        '第一分量把 ∂/∂y 与第三个分量配对、∂/∂z 与第二个分量配对；其余按循环轮换（V15.1 式 (4)）。',
      ),
      explanation: t(
        `curl F = (∂${C}/∂y − ∂${B}/∂z) i + (∂${A}/∂z − ∂${C}/∂x) j + (∂${B}/∂x − ∂${A}/∂y) k, i.e. the six numerators in order are ${C}, ${B}, ${A}, ${C}, ${B}, ${A}.`,
        `curl F = (∂${C}/∂y − ∂${B}/∂z) i + (∂${A}/∂z − ∂${C}/∂x) j + (∂${B}/∂x − ∂${A}/∂y) k，即六个分子依次为 ${C}, ${B}, ${A}, ${C}, ${B}, ${A}。`,
      ),
    }),
    g.number({
      id: 'curl-vector',
      title: t('Compute a curl', '计算旋度'),
      prompt: t(
        `F = (${coef(cv.p, 'y')}, ${coef(cv.q, 'z')}, ${coef(cv.r, 'x')}) = ${linear([cv.p, cv.q, cv.r], ['y i', 'z j', 'x k'])}. Enter the three components of curl F as its i-, j- and k-components. Give integers.`,
        `F = (${coef(cv.p, 'y')}, ${coef(cv.q, 'z')}, ${coef(cv.r, 'x')}) = ${linear([cv.p, cv.q, cv.r], ['y i', 'z j', 'x k'])}。按 i、j、k 分量依次填写 curl F 的三个分量，填写整数。`,
      ),
      fields: [
        { label: t('i-component', 'i 分量'), answer: cvAns[0] },
        { label: t('j-component', 'j 分量'), answer: cvAns[1] },
        { label: t('k-component', 'k 分量'), answer: cvAns[2] },
      ],
      hint: t(
        'Each component mixes two of M, N, P; e.g. the k-component of curl F is ∂N/∂x − ∂M/∂y.',
        '每个分量由 M、N、P 中的两个组合而成；例如 curl F 的 k 分量是 ∂N/∂x − ∂M/∂y。',
      ),
      explanation: t(
        `With M = ${coef(cv.p, 'y')}, N = ${coef(cv.q, 'z')}, P = ${coef(cv.r, 'x')}: i = ∂P/∂y − ∂N/∂z = 0 − ${par(cv.q)} = ${par(cvAns[0])}; j = ∂M/∂z − ∂P/∂x = 0 − ${par(cv.r)} = ${par(cvAns[1])}; k = ∂N/∂x − ∂M/∂y = 0 − ${par(cv.p)} = ${par(cvAns[2])}. So curl F = (${num(cvAns[0])}, ${num(cvAns[1])}, ${num(cvAns[2])}).`,
        `取 M = ${coef(cv.p, 'y')}、N = ${coef(cv.q, 'z')}、P = ${coef(cv.r, 'x')}：i = ∂P/∂y − ∂N/∂z = 0 − ${par(cv.q)} = ${par(cvAns[0])}；j = ∂M/∂z − ∂P/∂x = 0 − ${par(cv.r)} = ${par(cvAns[1])}；k = ∂N/∂x − ∂M/∂y = 0 − ${par(cv.p)} = ${par(cvAns[2])}。故 curl F = (${num(cvAns[0])}, ${num(cvAns[1])}, ${num(cvAns[2])})。`,
      ),
      audit: { kind: 'MIT-MV-59:curl-vector', params: { p: cv.p, q: cv.q, r: cv.r } },
    }),
    g.number({
      id: 'paddle-speed',
      title: t('Spin of a paddle wheel', '桨轮的转速'),
      prompt: t(
        `A fluid has velocity field F = ${w === 1 ? '' : num(w) + ' '}(−y, x, 0) (written (−y, x, 0) when w = 1). A small paddle wheel lies in the xy-plane (its axle points along +k) at a point other than the origin. Using curl F = twice the angular velocity of the wheel, enter the angular velocity of the wheel about the +k direction (right-hand rule).`,
        `流体的速度场为 F = ${w === 1 ? '' : num(w) + ' '}(−y, x, 0)（w = 1 时写作 (−y, x, 0)）。一个小桨轮位于 xy 平面内（轴沿 +k 方向），轮心不在原点。由 curl F 等于角速度的两倍，按右手法则求桨轮绕 +k 方向的角速度。`,
      ),
      figure: g.figure({
        alt: t(
          'A small paddle wheel in the xy-plane; the circulating arrows show the fluid rotation.',
          'xy 平面内的一个小桨轮；环流的箭头表示流体的旋转。',
        ),
        view: fitView(paddleShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: paddleShapes,
      }),
      fields: [{ label: t('angular velocity', '角速度'), answer: w }],
      hint: t(
        'Compute curl F first; the angular velocity is half of it. For this field curl F points along k.',
        '先求 curl F；角速度是它的一半。对该场 curl F 沿 k 方向。',
      ),
      explanation: t(
        `curl F = (0, 0, ${num(2 * w)}), so the angular velocity vector is (curl F)/2 = (0, 0, ${num(w)}); about the +k direction it is ${num(w)}. The field is the V4.3 rotation field with angular velocity ${num(w)}.`,
        `curl F = (0, 0, ${num(2 * w)})，故角速度向量为 (curl F)/2 = (0, 0, ${num(w)})；绕 +k 方向即 ${num(w)}。该场是 V4.3 中角速度为 ${num(w)} 的旋转场。`,
      ),
      audit: { kind: 'MIT-MV-59:paddle-speed', params: { w } },
    }),
    g.number({
      id: 'curl-y',
      title: t('One component of a curl', '旋度的一个分量'),
      prompt: t(
        `F = (3x²y + ${coef(cy.a, 'z')}, x³, ${coef(cy.c, 'x')} + 3z²) = (3x²y + ${coef(cy.a, 'z')}) i + x³ j + (${coef(cy.c, 'x')} + 3z²) k. Enter the j-component of curl F. Give an integer.`,
        `F = (3x²y + ${coef(cy.a, 'z')}, x³, ${coef(cy.c, 'x')} + 3z²) = (3x²y + ${coef(cy.a, 'z')}) i + x³ j + (${coef(cy.c, 'x')} + 3z²) k。求 curl F 的 j 分量，填写整数。`,
      ),
      fields: [{ label: t('j-component of curl F', 'curl F 的 j 分量'), answer: cyAns }],
      hint: t(
        'The j-component of curl F is ∂M/∂z − ∂P/∂x; take these two derivatives and subtract in that order.',
        'curl F 的 j 分量为 ∂M/∂z − ∂P/∂x；求这两个偏导并按此顺序相减。',
      ),
      explanation: t(
        `The j-component of curl F is ∂M/∂z − ∂P/∂x with M = 3x²y + ${coef(cy.a, 'z')}, P = ${coef(cy.c, 'x')} + 3z²: ∂M/∂z = ${num(cy.a)}, ∂P/∂x = ${num(cy.c)}, so the j-component is ${num(cy.a)} − ${num(cy.c)} = ${num(cyAns)}. (The i- and k-components are 0.)`,
        `curl F 的 j 分量为 ∂M/∂z − ∂P/∂x，其中 M = 3x²y + ${coef(cy.a, 'z')}、P = ${coef(cy.c, 'x')} + 3z²：∂M/∂z = ${num(cy.a)}、∂P/∂x = ${num(cy.c)}，故 j 分量为 ${num(cy.a)} − ${num(cy.c)} = ${num(cyAns)}。（i、k 分量均为 0。）`,
      ),
      audit: { kind: 'MIT-MV-59:curl-y', params: { a: cy.a, c: cy.c } },
    }),
    g.symbols({
      id: 'conservative-potential',
      title: t('Find the missing term of the potential', '求势函数中缺的项'),
      prompt: t(
        `F = (3x²y + ${coef(d, 'z')}, x³, ${coef(d, 'x')} + 3z²) is a conservative field. Its potential has the form f = x³y + [ ] + z³ + C. Complete the missing term.`,
        `F = (3x²y + ${coef(d, 'z')}, x³, ${coef(d, 'x')} + 3z²) 是保守场。其势函数形如 f = x³y + [ ] + z³ + C。补全缺的项。`,
      ),
      before: 'f = x³y + ',
      after: t(' + z³ + C .', ' + z³ + C。'),
      answers: [potAnswer],
      tokens: potTokens,
      hint: t(
        `For F = ∇f, ∂f/∂x = 3x²y + ${coef(d, 'z')}, so f = x³y + (a function of y and z). Match ∂f/∂z = ${coef(d, 'x')} + 3z² next.`,
        `由 F = ∇f 得 ∂f/∂x = 3x²y + ${coef(d, 'z')}，故 f = x³y 加上一个 y、z 的函数。再接 ∂f/∂z = ${coef(d, 'x')} + 3z² 继续匹配。`,
      ),
      explanation: t(
        `∂f/∂x = 3x²y + ${coef(d, 'z')} gives f = x³y + g(y, z). Then ∂f/∂z = ${coef(d, 'x')} + ∂g/∂z must equal ${coef(d, 'x')} + 3z², so ∂g/∂z = 3z² and g = ${potAnswer} + z³ + C (the x z term comes from ∂g/∂z = ${coef(d, 'x')}). Check: ∇f = (3x²y + ${coef(d, 'z')}, x³, ${coef(d, 'x')} + 3z²) = F.`,
        `由 ∂f/∂x = 3x²y + ${coef(d, 'z')} 得 f = x³y + g(y, z)。又 ∂f/∂z = ${coef(d, 'x')} + ∂g/∂z 应等于 ${coef(d, 'x')} + 3z²，故 ∂g/∂z = 3z²，得 g = ${potAnswer} + z³ + C（x z 项来自 ∂g/∂z = ${coef(d, 'x')}）。检验：∇f = (3x²y + ${coef(d, 'z')}, x³, ${coef(d, 'x')} + 3z²) = F。`,
      ),
    }),
    g.choice({
      id: 'orientation-spin',
      title: t('Which way does it spin?', '它朝哪个方向转？'),
      prompt: t(
        `F = (${coef(s, 'y')}, 0, 0) = ${coef(s, 'y')} i. A small paddle wheel sits in this field with its axle pointing along the +k axis. By the right-hand rule, which way does the wheel spin (viewed from the positive z-axis)?`,
        `F = (${coef(s, 'y')}, 0, 0) = ${coef(s, 'y')} i。一个小桨轮位于该场中，轴沿 +k 方向。按右手法则，从正 z 轴看去桨轮朝哪个方向转？`,
      ),
      options: [
        t('clockwise (as viewed from the positive z-axis)', '顺时针（从正 z 轴看去）'),
        t('counterclockwise (as viewed from the positive z-axis)', '逆时针（从正 z 轴看去）'),
        t('it does not spin, because F has no z-component', '它不转，因为 F 没有 z 分量'),
        t('it spins about the y-axis, because F points in the y-direction', '它绕 y 轴转，因为 F 沿 y 方向'),
      ],
      correct: spinCorrect === 'clockwise' ? 0 : 1,
      hint: t(
        'Compute curl F, then (curl F)·k; the wheel\'s spin sense follows from its sign (V4.3, eq. 11).',
        '先求 curl F，再求 (curl F)·k；桨轮的转向由其符号决定（V4.3 式 (11)）。',
      ),
      explanation: t(
        `curl F = (0, 0, ${num(-s)}), so (curl F)·k = ${num(-s)}. Setting the thumb along +k, the fingers curl the way the wheel spins; with (curl F)·k = ${num(-s)} the wheel turns ${spinCorrect}. A single non-zero component of F does not mean 'no spin' (curl F ≠ 0 here), and the wheel does not turn about the y-axis.`,
        `curl F = (0, 0, ${num(-s)})，故 (curl F)·k = ${num(-s)}。拇指沿 +k 时四指弯曲方向即转动方向；(curl F)·k = ${num(-s)}，故桨轮${spinCorrect === 'clockwise' ? '顺时针' : '逆时针'}转。F 只有一个非零分量并不意味着不转（此处 curl F ≠ 0），桨轮也不绕 y 轴转动。`,
      ),
      figure: g.figure({
        alt: t(
          'Top view of the xy-plane: a small paddle wheel at the origin with its axle pointing out of the page along +k, and the horizontal arrows of the field, which point one way above the x-axis and the opposite way below it.',
          'xy 平面的俯视图：原点处有一个小桨轮，轴沿 +k 方向指向页面外；场的水平箭头在 x 轴上方指向一侧，在 x 轴下方指向相反的一侧。',
        ),
        view: fitView(spinShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y' },
        shapes: spinShapes,
      }),
    }),
    g.choice({
      id: 'assumption-domain',
      title: t('Does zero curl always give a potential?', '旋度为零一定有势函数吗？'),
      prompt: t(
        `A field G is defined and continuously differentiable at every point except the ${locus[0]}, and curl G = 0 at every point where G is defined. According to the criterion that F is conservative iff it is continuously differentiable for all x, y, z and curl F = 0, can we conclude that G is a gradient field?`,
        `场 G 除${locus[1]}外处处有定义且连续可微，且在 G 有定义的每一点 curl G = 0。按'F 为保守场当且仅当它在所有 x, y, z 处连续可微且 curl F = 0'这一判据，能否断定 G 是梯度场？`,
      ),
      options: [
        t('No — the criterion requires G to be continuously differentiable for all x, y and z, and G is not defined everywhere, so the criterion does not apply', '否——判据要求 G 对所有 x, y, z 连续可微，而 G 并非处处有定义，故判据不适用'),
        t('Yes, curl G = 0 is by itself enough', '是，curl G = 0 本身已足够'),
        t('Yes, a field with zero curl always has a potential', '是，旋度为零的场总有势函数'),
        t('No, because curl G is not defined at the excluded set', '否，因为 curl G 在排除的集合上无定义'),
      ],
      correct: 0,
      hint: t(
        'Read the criterion carefully: it has two hypotheses, \'continuously differentiable for all x, y, z\' and \'curl F = 0\'.',
        '仔细读判据：它有两个前提，\'对所有 x, y, z 连续可微\'和\'curl F = 0\'。',
      ),
      explanation: t(
        'The criterion on this page is stated for a field that is continuously differentiable for all x, y, z and has curl F = 0; both hypotheses are used. Since G is not defined on all of space, the criterion does not decide the question, so we cannot conclude that G is a gradient field. (What happens on such a region is taken up later, after Stokes\' theorem.)',
        '该判据针对的是对所有 x, y, z 连续可微且 curl F = 0 的场；两个前提都要用。由于 G 并非在全空间有定义，此判据无法作出判断，因此不能断定 G 是梯度场。（在带洞区域上的情形留待学习斯托克斯定理之后再讨论。）',
      ),
    }),
    g.number({
      id: 'curl-k',
      title: t('The k-component of a curl', '旋度的 k 分量'),
      prompt: t(
        `F = (${coef(ck.p, 'y')}, ${coef(ck.q, 'x')}, ${coef(ck.r, 'z')}) = ${coef(ck.p, 'y')} i + ${coef(ck.q, 'x')} j + ${coef(ck.r, 'z')} k. Enter the k-component of curl F. Give an integer.`,
        `F = (${coef(ck.p, 'y')}, ${coef(ck.q, 'x')}, ${coef(ck.r, 'z')}) = ${coef(ck.p, 'y')} i + ${coef(ck.q, 'x')} j + ${coef(ck.r, 'z')} k。求 curl F 的 k 分量，填写整数。`,
      ),
      fields: [{ label: t('k-component of curl F', 'curl F 的 k 分量'), answer: ckAns }],
      hint: t(
        'The k-component of curl F is ∂N/∂x − ∂M/∂y.',
        'curl F 的 k 分量为 ∂N/∂x − ∂M/∂y。',
      ),
      explanation: t(
        `The k-component of curl F is ∂N/∂x − ∂M/∂y with N = ${coef(ck.q, 'x')}, M = ${coef(ck.p, 'y')}: ∂N/∂x = ${num(ck.q)}, ∂M/∂y = ${num(ck.p)}, so it is ${num(ck.q)} − ${num(ck.p)} = ${num(ckAns)}. (The third coefficient ${num(ck.r)} does not enter.)`,
        `curl F 的 k 分量为 ∂N/∂x − ∂M/∂y，其中 N = ${coef(ck.q, 'x')}、M = ${coef(ck.p, 'y')}：∂N/∂x = ${num(ck.q)}、∂M/∂y = ${num(ck.p)}，故为 ${num(ck.q)} − ${num(ck.p)} = ${num(ckAns)}。（第三个系数 ${num(ck.r)} 不参与。）`,
      ),
      audit: { kind: 'MIT-MV-59:curl-k', params: { p: ck.p, q: ck.q, r: ck.r } },
    }),
    g.number({
      id: 'challenge',
      title: t('Curl along a direction', '沿某方向的旋度分量'),
      prompt: t(
        `F = (${coef(ch.p, 'y')}, ${coef(ch.q, 'z')}, ${coef(ch.r, 'x')}) = ${linear([ch.p, ch.q, ch.r], ['y i', 'z j', 'x k'])} and n = (${num(ch.a)}, ${num(ch.b)}, ${num(ch.c)}). Enter (curl F) · n. Give an integer.`,
        `F = (${coef(ch.p, 'y')}, ${coef(ch.q, 'z')}, ${coef(ch.r, 'x')}) = ${linear([ch.p, ch.q, ch.r], ['y i', 'z j', 'x k'])}，n = (${num(ch.a)}, ${num(ch.b)}, ${num(ch.c)})。求 (curl F) · n，填写整数。`,
      ),
      fields: [{ label: t('value', '数值'), answer: chAns }],
      hint: t(
        'First write curl F = (−q, −r, −p), then take the dot product with n = (a, b, c).',
        '先写出 curl F = (−q, −r, −p)，再与 n = (a, b, c) 作点积。',
      ),
      explanation: t(
        `curl F = (${num(-ch.q)}, ${num(-ch.r)}, ${num(-ch.p)}) (see the rule from the setup card). Then (curl F)·n = (${num(-ch.q)})(${num(ch.a)}) + (${num(-ch.r)})(${num(ch.b)}) + (${num(-ch.p)})(${num(ch.c)}) = −(${par(ch.a)}·${par(ch.q)} + ${par(ch.b)}·${par(ch.r)} + ${par(ch.c)}·${par(ch.p)}) = ${num(chAns)}. This game does not ask you to prove that curl F is twice the paddle-wheel angular velocity, or to derive the curl and divergence identities; it asks only that you compute curl F, read its size and sign, and use the conservative-field criterion.`,
        `curl F = (${num(-ch.q)}, ${num(-ch.r)}, ${num(-ch.p)})（用设定卡中的规则）。于是 (curl F)·n = (${num(-ch.q)})(${num(ch.a)}) + (${num(-ch.r)})(${num(ch.b)}) + (${num(-ch.p)})(${num(ch.c)}) = −(${par(ch.a)}·${par(ch.q)} + ${par(ch.b)}·${par(ch.r)} + ${par(ch.c)}·${par(ch.p)}) = ${num(chAns)}。本游戏不要求证明旋度等于桨轮角速度的两倍，也不要求推导旋度与散度的恒等式；只要求计算旋度、判读其大小与符号，并运用保守场判据。`,
      ),
      audit: { kind: 'MIT-MV-59:challenge', params: { p: ch.p, q: ch.q, r: ch.r, a: ch.a, b: ch.b, c: ch.c } },
    }),
  ];
};
