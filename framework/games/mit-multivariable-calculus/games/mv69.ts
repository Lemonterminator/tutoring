import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, line3d, wire3d, type FigureShape, type Pt } from '../../figure';
import { coef, exact, makeMvDeck, num, par, piTerm, term, type Text } from '../support';

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
/** Product of two possibly-negative numbers, parenthesised: pr(-3, 2) = "(-3)*2". */
const pr = (a: number, b: number) => `${par(a)}·${par(b)}`;

const NOT_ASSESSED_EN = 'This exam game checks set-ups and short computations from each of the four units; it does not ask you to sketch regions or fields, to write full justifications, or to evaluate the long integrals of the original exam.';
const NOT_ASSESSED_ZH = '本考试游戏检验四个单元中各一部分的积分设定和简短计算；它不要求画出区域或向量场，不要求写完整的论证，也不要求计算原考试中冗长的积分。';

export const mv69: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-69');
  warm(g);

  // 1. singular-a (unit 1): a = t·r − p·q·t + p·s, det A = a + K.
  const sa = retry(() => ({ p: g.pick([2, 3, 4]), q: g.pick([-3, -2, -1, 1, 2, 3]), r: g.pick([-3, -2, -1, 1, 2, 3]), s: g.pick([-3, -2, -1, 1, 2, 3]), t: g.pick([-3, -2, -1, 1, 2, 3]) }),
    v => v.t * v.r - v.p * v.q * v.t + v.p * v.s !== 0);
  const saA = sa.t * sa.r - sa.p * sa.q * sa.t + sa.p * sa.s;
  const saK = -sa.r * sa.t + sa.p * (sa.q * sa.t - sa.s);

  // 2. inverse-entry (unit 1): p = −(u·c1 + w·c3)/c2.
  // NOTE: the plan's source instance uses w = 5, outside the stated range |u|,|w| ≤ 4; the range is followed.
  const iv = retry(() => ({ c1: g.nonzero(-4, 4), c2: g.nonzero(-3, 3), c3: g.nonzero(-4, 4), u: g.nonzero(-4, 4), w: g.nonzero(-4, 4) }),
    v => v.u * v.c1 + v.w * v.c3 !== 0);
  const ivS = iv.u * iv.c1 + iv.w * iv.c3;
  const ivP = -ivS / iv.c2;
  const ivProd = `${pr(iv.u, iv.c1)} ${term(iv.w)}·${par(iv.c3)}`;

  // 3. chain-phi (unit 2): ∂F/∂φ = p·x0 + q·y0 − r·z0.
  const chain = retry(() => ({ a: g.pick([1, 2, 3]), th: g.pick([0, 1, 2, 3]), p: g.pick([-3, -2, -1, 1, 2, 3]), q: g.pick([-3, -2, -1, 1, 2, 3]), r: g.pick([-3, -2, -1, 1, 2, 3]) }),
    v => v.p * (v.a * [1, 0, -1, 0][v.th]) + v.q * (v.a * [0, 1, 0, -1][v.th]) - v.r * v.a !== 0);
  const chX0 = chain.a * [1, 0, -1, 0][chain.th];
  const chY0 = chain.a * [0, 1, 0, -1][chain.th];
  const chAns = chain.p * chX0 + chain.q * chY0 - chain.r * chain.a;
  const chThetaLabel = ['0', 'π/2', 'π', '−π/2'][chain.th];
  const chASqrt = chain.a === 1 ? '√2' : `${chain.a}√2`;

  // 4. gradient-test (choice; unit 2): correct field (s·y, s·x).
  const gtS = g.pick([1, 2, 3, 4, 5, 6]) * g.pick([1, -1]);

  // 5. order-swap (symbols; unit 3).
  const osFamily = g.pick(['A', 'B'] as const);
  const osA = g.pick([2, 3, 4, 5, 6, 7]);
  const osAns = osFamily === 'A' ? [String(osA * osA), `y/${osA}`, '√y'] : [String(osA * osA), '√y', String(osA)];
  const osTokens = shuffled(g, [String(osA * osA), String(osA), `y/${osA}`, `${osA}y`, '√y', 'y²']);
  const osParabola: Pt[] = Array.from({ length: 25 }, (_, i) => { const x = osA * i / 24; return [x, x * x] as Pt; });
  const osShapes: FigureShape[] = osFamily === 'A'
    ? [{ kind: 'area', points: [...osParabola, [0, 0]], tone: 'accent', opacity: 0.25 },
      { kind: 'line', points: [[0, 0], [osA, osA * osA]], tone: 'accent2', width: 2 },
      { kind: 'point', at: [osA, osA * osA], label: `x = ${osA}` }, // not (a, a²): a² is the card's first answer
      { kind: 'point', at: [0, 0], label: '(0, 0)' }]
    : [{ kind: 'area', points: [[0, 0], ...osParabola, [osA, 0], [0, 0]], tone: 'accent', opacity: 0.25 },
      { kind: 'line', points: osParabola, tone: 'accent2', width: 2 },
      { kind: 'point', at: [osA, osA * osA], label: `x = ${osA}` }, // not (a, a²): a² is the card's first answer
      { kind: 'point', at: [0, 0], label: '(0, 0)' }];

  // 6. cone-limits (symbols; unit 3).
  const cl = { k: g.pick([2, 3, 4]), h: g.pick([2, 3, 4, 5, 6]) };
  const clTokens = shuffled(g, [`tan⁻¹(1/${cl.k})`, `tan⁻¹(${cl.k})`, 'π/4', `${cl.h} sec φ`, `${cl.h} cos φ`, `${cl.h}`, 'ρ⁴ cos²φ sin φ', 'ρ³ cos φ sin φ', 'ρ² cos²φ sin φ']);

  // 7. cyl-setup (symbols; unit 4): div F = a on the curved side; F · n = 0 on the four flat faces.
  const cs = { a: g.pick([2, 3, 4]), R: g.pick([2, 4, 6]), H: g.pick([1, 2, 3, 4, 5]) };
  const csTokens = shuffled(g, [String(cs.a), `${cs.a}x`, '1', '0', num(-cs.a)]);

  // 8. cyl-flux (number; unit 4): k = a·R²·H/4.
  const cf = { a: g.pick([2, 3, 4]), R: g.pick([2, 4, 6]), H: g.pick([1, 2, 3, 4, 5]) };
  const cfV = cf.R * cf.R * cf.H / 4;
  const cfK = cf.a * cfV;

  // 9. stokes-setup (symbols; unit 4): [π/2, √h, 4a r² − 2a h].
  // The plan lists the second token as `√{h}` but its examples print the value ("2", "3", "4") and require the
  // palette to contain every answer, so h ∈ {4, 9, 16} is printed as its integer root √h ∈ {2, 3, 4}.
  const st = { a: g.pick([1, 2, 3]), h: g.pick([4, 9, 16]) };
  const stS = Math.sqrt(st.h);
  const stA3 = `${num(4 * st.a)}r² ${term(-2 * st.a * st.h)}`;
  const stTokens = shuffled(g, ['π/2', 'π', '2π', String(stS), String(st.h), stA3,
    `${num(3 * st.a)}r² ${term(-2 * st.a * st.h)}`, `${num(2 * st.a)}r² ${term(-2 * st.a * st.h)}`, num(2 * st.a * st.h)]);

  // 10. challenge (number; unit 4): k = (d − c)·h/4.
  const ch = retry(() => ({ a: g.pick([1, 2, 3]), c: g.pick([1, 2, 3]), d: g.pick([1, 2, 3]), h: g.pick([2, 3, 4, 5, 6, 8]) }), v => v.c !== v.d);
  const chK = (ch.d - ch.c) * ch.h / 4;
  const chDC = ch.d - ch.c;
  const chPi = chK === 1 ? 'π' : chK === -1 ? '−π' : `(${exact(chK)})π`;

  // --- 3D figure shapes (shared) ---
  const cylShapes = (R: number, H: number): FigureShape[] => {
    const c45 = Math.cos(Math.PI / 4) * R, s45 = Math.sin(Math.PI / 4) * R;
    return [
      ...axes3d(R + 1),
      ...wire3d((u, v) => [R * Math.cos(u), R * Math.sin(u), v], 0, Math.PI / 2, 0, H, 6, 4, 24, 'accent'),
      line3d([[R, 0, 0], [0, 0, 0], [0, R, 0]], 'muted'),
      line3d([[R, 0, H], [0, 0, H], [0, R, H]], 'muted'),
      line3d([[0, 0, 0], [0, 0, H]], 'muted'),
      arrow3d([c45, s45, H / 2], [c45 + 0.8 * Math.cos(Math.PI / 4), s45 + 0.8 * Math.sin(Math.PI / 4), H / 2], 'accent2', 'n'),
    ];
  };
  const coneShapes: FigureShape[] = [
    ...axes3d(cl.h + 1),
    ...wire3d((u, v) => [u * Math.cos(v), u * Math.sin(v), cl.k * u], 0, cl.h / cl.k, 0, 2 * Math.PI, 3, 12, 36, 'accent'),
    line3d(Array.from({ length: 49 }, (_, i) => { const s = 2 * Math.PI * i / 48; return [(cl.h / cl.k) * Math.cos(s), (cl.h / cl.k) * Math.sin(s), cl.h]; }), 'warn'),
  ];
  const stShapes: FigureShape[] = [
    ...axes3d(Math.max(stS, st.h) + 1),
    ...wire3d((u, v) => [u * Math.cos(v), u * Math.sin(v), st.h - u * u], 0, stS, 0, Math.PI / 2, 4, 6, 24, 'accent'),
    line3d(Array.from({ length: 25 }, (_, i) => { const s = (Math.PI / 2) * i / 24; return [stS * Math.cos(s), stS * Math.sin(s), 0]; }), 'warn'),
    line3d(Array.from({ length: 25 }, (_, i) => { const y = stS * i / 24; return [0, y, st.h - y * y]; }), 'warn'),
    line3d(Array.from({ length: 25 }, (_, i) => { const x = stS * i / 24; return [x, 0, st.h - x * x]; }), 'warn'),
  ];

  return [
    g.number({
      id: 'singular-a',
      title: t('When is A singular?', 'A 何时不可逆？'),
      prompt: t(`A is the 3 × 3 matrix whose rows are (1, 0, ${num(sa.p)}), (${num(sa.q)}, 1, ${num(sa.r)}) and (${num(sa.s)}, ${num(sa.t)}, a), where a is a constant. For which value of a does Ax = 0 have a non-zero solution x? (an integer)`,
        `3 × 3 矩阵 A 的各行为 (1, 0, ${num(sa.p)})、(${num(sa.q)}, 1, ${num(sa.r)}) 和 (${num(sa.s)}, ${num(sa.t)}, a)，其中 a 是常数。a 取何值时 Ax = 0 有非零解 x？（整数）`),
      fields: [{ label: t('a', 'a'), answer: saA }],
      hint: t('Ax = 0 has a non-zero solution exactly when det A = 0. Expand det A along the first row: it is a linear function of a.',
        'Ax = 0 有非零解当且仅当 det A = 0。沿第一行展开 det A：它是 a 的一次函数。'),
      explanation: t(`det A = 1·(1·a − ${pr(sa.r, sa.t)}) + ${par(sa.p)}·(${pr(sa.q, sa.t)} − ${par(sa.s)}) = a ${term(saK)}, with K = ${num(saK)}. This is 0 only for a = ${num(saA)}, and then A is not invertible, so Ax = 0 has non-zero solutions.`,
        `det A = 1·(1·a − ${pr(sa.r, sa.t)}) + ${par(sa.p)}·(${pr(sa.q, sa.t)} − ${par(sa.s)}) = a ${term(saK)}，其中 K 是常数 ${num(saK)}。只有 a = ${num(saA)} 时它才为 0，这时 A 不可逆，Ax = 0 有非零解。`),
      audit: { kind: 'MIT-MV-69:singular-a', params: { p: sa.p, q: sa.q, r: sa.r, s: sa.s, t: sa.t } },
    }),
    g.number({
      id: 'inverse-entry',
      title: t('A hidden entry of the inverse', '逆矩阵中的未知元素'),
      prompt: t(`A is an invertible 3 × 3 matrix whose first column is (${num(iv.c1)}, ${num(iv.c2)}, ${num(iv.c3)}). The second row of A⁻¹ is (${num(iv.u)}, p, ${num(iv.w)}). Find p. Enter an integer or a fraction.`,
        `A 是可逆的 3 × 3 矩阵，它的第一列是 (${num(iv.c1)}, ${num(iv.c2)}, ${num(iv.c3)})。A⁻¹ 的第二行是 (${num(iv.u)}, p, ${num(iv.w)})。求 p。填整数或分数。`),
      fields: [{ label: t('p', 'p'), answer: ivP }],
      hint: t('A⁻¹A = I. Look at the entry in row 2, column 1 of the product: it is (row 2 of A⁻¹) · (column 1 of A). What does the identity matrix say about it?',
        'A⁻¹A = I。看乘积第 2 行第 1 列的元素：它等于 (A⁻¹ 的第 2 行) · (A 的第 1 列)。单位矩阵告诉你它是多少？'),
      explanation: t(`The entry in row 2, column 1 of A⁻¹A is (${num(iv.u)}, p, ${num(iv.w)}) · (${num(iv.c1)}, ${num(iv.c2)}, ${num(iv.c3)}) = ${ivProd} + (${coef(iv.c2, 'p')}). In the identity matrix this off-diagonal entry is 0, so ${num(ivS)} + (${coef(iv.c2, 'p')}) = 0 and p = ${exact(ivP)}.`,
        `A⁻¹A 的第 2 行第 1 列的元素是 (${num(iv.u)}, p, ${num(iv.w)}) · (${num(iv.c1)}, ${num(iv.c2)}, ${num(iv.c3)}) = ${ivProd} + (${coef(iv.c2, 'p')})。在单位矩阵中这个非对角元素是 0，所以 ${num(ivS)} + (${coef(iv.c2, 'p')}) = 0，p = ${exact(ivP)}。`),
      audit: { kind: 'MIT-MV-69:inverse-entry', params: { c1: iv.c1, c2: iv.c2, c3: iv.c3, u: iv.u, w: iv.w } },
    }),
    g.number({
      id: 'chain-phi',
      title: t('The chain rule in spherical coordinates', '球坐标下的链式法则'),
      prompt: t(`F(x, y, z) is a smooth function with ∇F(${num(chX0)}, ${num(chY0)}, ${num(chain.a)}) = (${num(chain.p)}, ${num(chain.q)}, ${num(chain.r)}). Use x = ρ sin φ cos θ, y = ρ sin φ sin θ, z = ρ cos φ, with φ measured from the positive z-axis. The point (${num(chX0)}, ${num(chY0)}, ${num(chain.a)}) has spherical coordinates (ρ, φ, θ) = (${chASqrt}, π/4, ${chThetaLabel}). Find ∂F/∂φ there. Enter an integer.`,
        `F(x, y, z) 是光滑函数，∇F(${num(chX0)}, ${num(chY0)}, ${num(chain.a)}) = (${num(chain.p)}, ${num(chain.q)}, ${num(chain.r)})。取 x = ρ sin φ cos θ，y = ρ sin φ sin θ，z = ρ cos φ，其中 φ 是从正 z 轴量起的角。点 (${num(chX0)}, ${num(chY0)}, ${num(chain.a)}) 的球坐标为 (ρ, φ, θ) = (${chASqrt}, π/4, ${chThetaLabel})。求该点处的 ∂F/∂φ。填整数。`),
      fields: [{ label: t('∂F/∂φ', '∂F/∂φ'), answer: chAns }],
      hint: t('∂F/∂φ = F_x ∂x/∂φ + F_y ∂y/∂φ + F_z ∂z/∂φ. Differentiate x, y, z with respect to φ, then put in ρ, φ, θ.',
        '∂F/∂φ = F_x ∂x/∂φ + F_y ∂y/∂φ + F_z ∂z/∂φ。先把 x、y、z 对 φ 求导，再代入 ρ、φ、θ。'),
      explanation: t(`x_φ = ρ cos φ cos θ = ${chASqrt} · (√2/2) · cos(${chThetaLabel}) = ${num(chX0)}, y_φ = ρ cos φ sin θ = ${num(chY0)} and z_φ = −ρ sin φ = ${num(-chain.a)}. So ∂F/∂φ = ${pr(chain.p, chX0)} + ${pr(chain.q, chY0)} + ${pr(chain.r, -chain.a)} = ${num(chAns)}.`,
        `x_φ = ρ cos φ cos θ = ${chASqrt} · (√2/2) · cos(${chThetaLabel}) = ${num(chX0)}，y_φ = ρ cos φ sin θ = ${num(chY0)}，z_φ = −ρ sin φ = ${num(-chain.a)}。所以 ∂F/∂φ = ${pr(chain.p, chX0)} + ${pr(chain.q, chY0)} + ${pr(chain.r, -chain.a)} = ${num(chAns)}。`),
      audit: { kind: 'MIT-MV-69:chain-phi', params: { x0: chX0, y0: chY0, z0: chain.a, p: chain.p, q: chain.q, r: chain.r } },
    }),

    g.choice({
      id: 'gradient-test',
      title: t('Which field is a gradient?', '哪个场是梯度场？'),
      prompt: t('Which one of these vector fields can be the gradient ∇f of a smooth function f(x, y), at every point (x, y) of the plane?',
        '下面哪一个向量场可以是某个光滑函数 f(x, y) 在平面上每一点 (x, y) 处的梯度 ∇f？'),
      options: [
        t(`(${coef(gtS, 'y')}, ${coef(gtS, 'x')})`, `(${coef(gtS, 'y')}, ${coef(gtS, 'x')})`),
        t(`(${coef(-gtS, 'y')}, ${coef(gtS, 'x')})`, `(${coef(-gtS, 'y')}, ${coef(gtS, 'x')})`),
        t(`(${coef(gtS, 'y')}, ${coef(-gtS, 'x')})`, `(${coef(gtS, 'y')}, ${coef(-gtS, 'x')})`),
        t(`(${coef(gtS, 'y')}, ${coef(2 * gtS, 'x')})`, `(${coef(gtS, 'y')}, ${coef(2 * gtS, 'x')})`),
      ],
      correct: 0,
      hint: t('If ∇f = (M, N) for a smooth f, what do the mixed partial derivatives f_xy and f_yx tell you about M_y and N_x?',
        '如果光滑函数 f 满足 ∇f = (M, N)，混合偏导数 f_xy 与 f_yx 对 M_y 和 N_x 有什么要求？'),
      explanation: t(`If ∇f = (M, N), then M = f_x and N = f_y, so M_y = f_xy = f_yx = N_x. For (${coef(gtS, 'y')}, ${coef(gtS, 'x')}) both sides are ${num(gtS)}, and f = ${coef(gtS, 'xy')} has this gradient. For (${coef(-gtS, 'y')}, ${coef(gtS, 'x')}) we get M_y = ${num(-gtS)} but N_x = ${num(gtS)}; for (${coef(gtS, 'y')}, ${coef(-gtS, 'x')}), M_y = ${num(gtS)} but N_x = ${num(-gtS)}; for (${coef(gtS, 'y')}, ${coef(2 * gtS, 'x')}), M_y = ${num(gtS)} but N_x = ${num(2 * gtS)}. In each of these three the two mixed partials would have to differ, which is impossible for a smooth f.${gtS === 1 ? ' Here the field (−y, x) is the rotation field of the exam; it is not a gradient.' : ''}`,
        `若 ∇f = (M, N)，则 M = f_x，N = f_y，于是 M_y = f_xy = f_yx = N_x。对 (${coef(gtS, 'y')}, ${coef(gtS, 'x')})，两边都是 ${num(gtS)}，而 f = ${coef(gtS, 'xy')} 的梯度正是它。对 (${coef(-gtS, 'y')}, ${coef(gtS, 'x')})，M_y = ${num(-gtS)}，N_x = ${num(gtS)}；对 (${coef(gtS, 'y')}, ${coef(-gtS, 'x')})，M_y = ${num(gtS)}，N_x = ${num(-gtS)}；对 (${coef(gtS, 'y')}, ${coef(2 * gtS, 'x')})，M_y = ${num(gtS)}，N_x = ${num(2 * gtS)}。这三个场里两个混合偏导数必须不同，而光滑函数的混合偏导数相等，所以它们都不是梯度场。${gtS === 1 ? ' 这里 (−y, x) 这个场是考试中的旋转场，它不是梯度场。' : ''}`),
    }),
    g.symbols({
      id: 'order-swap',
      title: t('Change the order of integration', '交换积分次序'),
      prompt: t(osFamily === 'A'
        ? `Let I = the integral over x from 0 to ${osA} and, for each x, y from x² to ${osA}x, of f(x, y) dy dx. The region lies between the parabola y = x² and the line y = ${osA}x. Changing the order of integration gives I = the integral over y from 0 to [ ], and for each y, x from [ ] to [ ], of f(x, y) dx dy.`
        : `Let I = the integral over x from 0 to ${osA} and, for each x, y from 0 to x², of f(x, y) dy dx. The region lies under the parabola y = x², between x = 0 and x = ${osA}. Changing the order of integration gives I = the integral over y from 0 to [ ], and for each y, x from [ ] to [ ], of f(x, y) dx dy.`,
        osFamily === 'A'
          ? `设 I = x 从 0 到 ${osA}、对每个 x，y 从 x² 到 ${osA}x 对 f(x, y) dy dx 的积分。积分区域在抛物线 y = x² 与直线 y = ${osA}x 之间。交换积分次序得 I = y 从 0 到 [ ]、对每个 y，x 从 [ ] 到 [ ] 对 f(x, y) dx dy 的积分。`
          : `设 I = x 从 0 到 ${osA}、对每个 x，y 从 0 到 x² 对 f(x, y) dy dx 的积分。积分区域在抛物线 y = x² 之下、x = 0 与 x = ${osA} 之间。交换积分次序得 I = y 从 0 到 [ ]、对每个 y，x 从 [ ] 到 [ ] 对 f(x, y) dx dy 的积分。`),
      before: t('I = the integral over y from 0 to ', 'I = y 从 0 到 '),
      between: lang === 'zh' ? ['、对每个 y，x 从 ', ' 到 '] : [', and for each y, x from ', ' to '],
      after: t(', of f(x, y) dx dy', ' 对 f(x, y) dx dy 的积分'),
      answers: osAns,
      tokens: osTokens,
      hint: t('Sketch the region. Fix a height y and ask where the horizontal line through that height enters and leaves the region.',
        '画出区域。固定高度 y，问过该高度的水平线从哪里进入、从哪里离开区域。'),
      explanation: t(osFamily === 'A'
        ? `For 0 ≤ x ≤ ${osA} the region lies between y = x² (below) and y = ${osA}x (above); the two curves meet at (0, 0) and (${osA}, ${osA * osA}), so y runs from 0 to ${osA * osA}. At a fixed height y a horizontal line enters the region at the line y = ${osA}x, that is x = y/${osA}, and leaves it at the parabola, x = √y.`
        : `For 0 ≤ x ≤ ${osA} the region lies under y = x², so y runs from 0 to ${osA * osA}. At a fixed height y a horizontal line enters the region at the parabola, x = √y, and leaves it at the vertical line x = ${osA}.`,
        osFamily === 'A'
          ? `当 0 ≤ x ≤ ${osA} 时，区域在 y = x²（下方）与 y = ${osA}x（上方）之间；两条曲线交于 (0, 0) 和 (${osA}, ${osA * osA})，所以 y 从 0 到 ${osA * osA}。在固定高度 y 处，水平线从直线 y = ${osA}x，即 x = y/${osA} 处进入区域，从抛物线 x = √y 处离开。`
          : `当 0 ≤ x ≤ ${osA} 时，区域在 y = x² 之下，所以 y 从 0 到 ${osA * osA}。在固定高度 y 处，水平线从抛物线 x = √y 处进入区域，从竖直线 x = ${osA} 处离开。`),
      figure: g.figure({
        alt: t(osFamily === 'A'
          ? `The region between the parabola y = x² and the line y = ${osA}x in the first quadrant; the curves meet at (0, 0) and again where x = ${osA}.`
          : `The region under the parabola y = x² and above the x-axis, between x = 0 and x = ${osA}.`,
          osFamily === 'A'
            ? `第一象限中抛物线 y = x² 与直线 y = ${osA}x 之间的区域，两曲线交于 (0, 0) 以及 x = ${osA} 处。`
            : `抛物线 y = x² 之下、x 轴之上、x = 0 与 x = ${osA} 之间的区域。`),
        view: fitView(osShapes, 0.2), aspect: 'free', axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: osShapes,
      }),
    }),
    g.symbols({
      id: 'cone-limits',
      title: t('Set up the moment in spherical coordinates', '写出球坐标下的矩'),
      prompt: t(`G is the solid above the cone z = ${cl.k}√(x² + y²) and below the plane z = ${cl.h}. Its density is δ = z, the height above the xy-plane. In spherical coordinates (ρ, φ, θ), with φ measured from the positive z-axis, the moment M = ∭_G z δ dV equals the integral over θ from 0 to 2π, φ from 0 to [ ], and ρ from 0 to [ ], of ([ ]) dρ dφ dθ.`,
        `G 是锥面 z = ${cl.k}√(x² + y²) 之上、平面 z = ${cl.h} 之下的立体，密度 δ = z（到 xy 平面的高度）。在球坐标 (ρ, φ, θ) 中（φ 是从正 z 轴量起的角），矩 M = ∭_G z δ dV 等于 θ 从 0 到 2π、φ 从 0 到 [ ]、ρ 从 0 到 [ ] 对 ([ ]) dρ dφ dθ 的积分。`),
      before: t('M = the integral over θ from 0 to 2π, φ from 0 to ', 'M = θ 从 0 到 2π、φ 从 0 到 '),
      between: lang === 'zh' ? ['、ρ 从 0 到 ', ' 对 ('] : [', and ρ from 0 to ', ', of ('],
      after: t(') dρ dφ dθ', ') dρ dφ dθ 的积分'),
      answers: [`tan⁻¹(1/${cl.k})`, `${cl.h} sec φ`, 'ρ⁴ cos²φ sin φ'],
      tokens: clTokens,
      hint: t('On the cone tan φ = r/z; the plane z = h is ρ cos φ = h. The integrand is z·δ times the volume element ρ² sin φ.',
        '锥面上 tan φ = r/z；平面 z = h 即 ρ cos φ = h。被积函数是 z·δ 乘以体积元 ρ² sin φ。'),
      explanation: t(`On the cone z = ${cl.k}r, so tan φ = r/z = 1/${cl.k}; the solid above the cone has φ from 0 to tan⁻¹(1/${cl.k}). The plane z = ${cl.h} is ρ cos φ = ${cl.h}, so ρ runs up to ${cl.h} sec φ. The integrand is z·δ·ρ² sin φ = (ρ cos φ)(ρ cos φ) ρ² sin φ = ρ⁴ cos²φ sin φ.`,
        `在锥面 z = ${cl.k}r 上，tan φ = r/z = 1/${cl.k}；锥面上方的立体 φ 从 0 到 tan⁻¹(1/${cl.k})。平面 z = ${cl.h} 即 ρ cos φ = ${cl.h}，所以 ρ 最大到 ${cl.h} sec φ。被积函数是 z·δ·ρ² sin φ = (ρ cos φ)(ρ cos φ) ρ² sin φ = ρ⁴ cos²φ sin φ。`),
      figure: g.figure({
        alt: t(`A solid cone with its vertex at the origin opening upward, cut off by the horizontal plane z = ${cl.h}.`,
          `顶点在原点、开口向上的圆锥体，被水平面 z = ${cl.h} 截去上部。`),
        view: fitView(coneShapes, 0.2), shapes: coneShapes,
      }),
    }),

    g.symbols({
      id: 'cyl-setup',
      title: t('Divergence theorem on a quarter cylinder', '四分之一圆柱上的散度定理'),
      prompt: t(`G is the part of the solid cylinder x² + y² ≤ ${cs.R * cs.R} (radius ${cs.R}) in the first octant with 0 ≤ z ≤ ${cs.H}. S is its curved side, with the normal pointing away from the z-axis, and F = (${coef(cs.a, 'x')}, 0, 0). The four other faces of G lie in the planes x = 0, y = 0, z = 0 and z = ${cs.H}. By the divergence theorem (outward normals), flux through S + flux through the four flat faces = ∭_G ( [ ] ) dV. On every one of the four flat faces F · n = [ ].`,
        `G 是实心圆柱 x² + y² ≤ ${cs.R * cs.R}（半径 ${cs.R}）位于第一卦限且 0 ≤ z ≤ ${cs.H} 的部分。S 是它的侧面，法向量背离 z 轴，F = (${coef(cs.a, 'x')}, 0, 0)。G 的另外四个面分别在平面 x = 0、y = 0、z = 0 和 z = ${cs.H} 上。由散度定理（法向量向外），穿过 S 的通量 + 穿过四个平面的通量 = ∭_G ( [ ] ) dV。在四个平面中的每一个上，F · n = [ ]。`),
      before: t('flux through S + flux through the four flat faces = ∭_G (', '穿过 S 的通量 + 穿过四个平面的通量 = ∭_G ('),
      between: lang === 'zh' ? [') dV。在四个平面中的每一个上，F · n = '] : [') dV. On every one of the four flat faces F · n = '],
      after: t('.', '。'),
      answers: [String(cs.a), '0'],
      tokens: csTokens,
      hint: t('div F = ∂/∂x of the first component. Find the normal of each flat face: it is ±i, ±j or ±k.',
        'div F 是第一个分量对 x 的偏导数。先写出每个平面的法向量：±i、±j 或 ±k。'),
      explanation: t(`div F = ∂(${coef(cs.a, 'x')})/∂x = ${cs.a}. On the face in the plane y = 0, n = −j and F · n = 0; on the face in the plane x = 0, n = −i and F · n = −${coef(cs.a, 'x')} = 0 because x = 0 there; on the faces z = 0 and z = ${cs.H}, n = ∓k and F · n = 0 because F has no k-component. So F · n = 0 on all four flat faces.`,
        `div F = ∂(${coef(cs.a, 'x')})/∂x = ${cs.a}。平面 y = 0 上的面 n = −j，F · n = 0；平面 x = 0 上的面 n = −i，F · n = −${coef(cs.a, 'x')}，而该面上 x = 0，所以为 0；平面 z = 0 与 z = ${cs.H} 上的面 n = ∓k，F 没有 k 分量，F · n = 0。所以四个平面上 F · n 都是 0。`),
      figure: g.figure({
        alt: t('The quarter of a solid cylinder in the first octant, standing on the xy-plane with its axis along the z-axis, with an arrow n pointing away from the axis on the curved side.',
          '位于第一卦限、立在 xy 平面上、轴沿 z 轴的四分之一实心圆柱，侧面上有一个背离轴的箭头 n。'),
        view: fitView(cylShapes(cs.R, cs.H), 0.2), shapes: cylShapes(cs.R, cs.H),
      }),
    }),
    g.number({
      id: 'cyl-flux',
      title: t('Flux through the curved side', '穿过侧面的通量'),
      prompt: t(`G is the part of the solid cylinder x² + y² ≤ ${cf.R * cf.R} (radius ${cf.R}) in the first octant with 0 ≤ z ≤ ${cf.H}, and S is its curved side. Find the flux of F = (${coef(cf.a, 'x')}, 0, 0) across S, taking the normal that points away from the z-axis. The flux equals kπ; enter k (an integer).`,
        `G 是实心圆柱 x² + y² ≤ ${cf.R * cf.R}（半径 ${cf.R}）位于第一卦限且 0 ≤ z ≤ ${cf.H} 的部分，S 是它的侧面。取背离 z 轴的法向量，求 F = (${coef(cf.a, 'x')}, 0, 0) 穿过 S 的通量。它等于 kπ，求 k（整数）。`),
      fields: [{ label: t('k', 'k'), answer: cfK }],
      hint: t('Either parametrise S by x = R cos θ, y = R sin θ and integrate F · n dS, or close S with the four flat faces and use the divergence theorem.',
        '可以用 x = R cos θ、y = R sin θ 把 S 参数化并积分 F · n dS，也可以用四个平面把 S 封闭后用散度定理。'),
      explanation: t(`On the four flat faces F · n = 0, so the flux through S equals the flux out of G, which is ∭_G div F dV = ${cf.a}·Vol(G). The volume of the quarter cylinder is π·${cf.R * cf.R * cf.H}/4 = ${piTerm(cfV)}, so the flux is ${cf.a}·${piTerm(cfV)} = ${piTerm(cfK)}. Direct check: with n dS = (${cf.R} cos θ, ${cf.R} sin θ, 0) dθ dz we get F · n dS = ${cf.a}·${cf.R * cf.R} cos²θ dθ dz, and the integral of cos²θ from 0 to π/2 is π/4.`,
        `四个平面上 F · n = 0，所以穿过 S 的通量等于从 G 流出的通量，即 ∭_G div F dV = ${cf.a}·Vol(G)。四分之一圆柱的体积是 π·${cf.R * cf.R * cf.H}/4 = ${piTerm(cfV)}，所以通量为 ${cf.a}·${piTerm(cfV)} = ${piTerm(cfK)}。直接验证：n dS = (${cf.R} cos θ, ${cf.R} sin θ, 0) dθ dz，于是 F · n dS = ${cf.a}·${cf.R * cf.R} cos²θ dθ dz，而 cos²θ 从 0 到 π/2 的积分是 π/4。`),
      audit: { kind: 'MIT-MV-69:cyl-flux', params: { a: cf.a, R: cf.R, H: cf.H } },
      figure: g.figure({
        alt: t('The quarter of a solid cylinder in the first octant, standing on the xy-plane with its axis along the z-axis, with an arrow n pointing away from the axis on the curved side.',
          '位于第一卦限、立在 xy 平面上、轴沿 z 轴的四分之一实心圆柱，侧面上有一个背离轴的箭头 n。'),
        view: fitView(cylShapes(cf.R, cf.H), 0.2), shapes: cylShapes(cf.R, cf.H),
      }),
    }),
    g.symbols({
      id: 'stokes-setup',
      title: t("Set up Stokes' theorem", '写出斯托克斯定理的积分'),
      prompt: t(`S is the part of the paraboloid z = ${st.h} − x² − y² with x ≥ 0, y ≥ 0 and z ≥ 0, with the normal pointing up, and F = (${coef(st.a, 'yz')}, ${coef(-st.a, 'xz')}, 1). For this F, curl F = (${coef(st.a, 'x')}, ${coef(st.a, 'y')}, ${coef(-2 * st.a, 'z')}), and on the graph z = ${st.h} − x² − y² the normal element is n dS = (2x, 2y, 1) dA. By Stokes' theorem the integral of F around the boundary of S, traversed counterclockwise when seen from above, equals ∬_S curl F · n dS = the integral over θ from 0 to [ ] and r from 0 to [ ] of ([ ]) r dr dθ, where z has been replaced by ${st.h} − r².`,
        `S 是抛物面 z = ${st.h} − x² − y² 位于 x ≥ 0、y ≥ 0、z ≥ 0 的部分，法向量向上，F = (${coef(st.a, 'yz')}, ${coef(-st.a, 'xz')}, 1)。这个 F 的旋度是 curl F = (${coef(st.a, 'x')}, ${coef(st.a, 'y')}, ${coef(-2 * st.a, 'z')})，在曲面 z = ${st.h} − x² − y² 上法向面元为 n dS = (2x, 2y, 1) dA。由斯托克斯定理，F 沿 S 的边界曲线（从上往下看为逆时针）的积分等于 ∬_S curl F · n dS = θ 从 0 到 [ ]、r 从 0 到 [ ] 对 ([ ]) r dr dθ 的积分，其中 z 已换成 ${st.h} − r²。`),
      before: t('= the integral over θ from 0 to ', '= θ 从 0 到 '),
      between: lang === 'zh' ? ['、r 从 0 到 ', ' 对 ('] : [' and r from 0 to ', ' of ('],
      after: t(') r dr dθ', ') r dr dθ 的积分'),
      answers: ['π/2', String(stS), stA3],
      tokens: stTokens,
      hint: t(`On S, z = ${st.h} − r². Take the dot product of curl F with (2x, 2y, 1), use x² + y² = r², and ask which part of the xy-plane lies under S.`,
        `在 S 上 z = ${st.h} − r²。把 curl F 与 (2x, 2y, 1) 作点积，用 x² + y² = r²，并想一想 S 位于 xy 平面的哪一部分之上。`),
      explanation: t(`curl F · n dS = (${coef(st.a, 'x')}, ${coef(st.a, 'y')}, ${coef(-2 * st.a, 'z')}) · (2x, 2y, 1) dA = (${num(2 * st.a)}x² + ${num(2 * st.a)}y² ${term(-2 * st.a)}z) dA. With x² + y² = r² and z = ${st.h} − r² this is (${num(2 * st.a)}r² ${term(-2 * st.a)}(${st.h} − r²)) dA = (${stA3}) dA. S lies over the quarter of the disc r ≤ √${st.h} where x ≥ 0 and y ≥ 0, so θ runs from 0 to π/2 and r from 0 to √${st.h}.`,
        `curl F · n dS = (${coef(st.a, 'x')}, ${coef(st.a, 'y')}, ${coef(-2 * st.a, 'z')}) · (2x, 2y, 1) dA = (${num(2 * st.a)}x² + ${num(2 * st.a)}y² ${term(-2 * st.a)}z) dA。代入 x² + y² = r²、z = ${st.h} − r²，得 (${num(2 * st.a)}r² ${term(-2 * st.a)}(${st.h} − r²)) dA = (${stA3}) dA。S 位于圆盘 r ≤ √${st.h} 中 x ≥ 0、y ≥ 0 的四分之一之上，所以 θ 从 0 到 π/2，r 从 0 到 √${st.h}。`),
      figure: g.figure({
        alt: t('The part of the paraboloid above the first octant, bounded by a quarter-circle arc in the xy-plane and two parabolic arcs in the yz-plane and the xz-plane.',
          '第一卦限上方的那部分抛物面，边界是 xy 平面内的四分之一圆弧以及 yz 平面和 xz 平面内的两段抛物线弧。'),
        view: fitView(stShapes, 0.2), shapes: stShapes,
      }),
    }),
    g.number({
      id: 'challenge',
      title: t('A loop on a paraboloid', '抛物面上的闭曲线'),
      prompt: t(`S is the part of the paraboloid z = ${ch.h} − x² − y² with x ≥ 0, y ≥ 0 and z ≥ 0, and C is its boundary curve, traversed counterclockwise when seen from above. Find ∮_C F · dr for F = (${coef(ch.a, 'yz')} + ${coef(ch.c, 'y')}, ${coef(-ch.a, 'xz')} + ${coef(ch.d, 'x')}, 1). It equals kπ; enter k (an integer or a fraction).`,
        `S 是抛物面 z = ${ch.h} − x² − y² 位于 x ≥ 0、y ≥ 0、z ≥ 0 的部分，C 是它的边界曲线，从上往下看沿逆时针方向绕行。对 F = (${coef(ch.a, 'yz')} + ${coef(ch.c, 'y')}, ${coef(-ch.a, 'xz')} + ${coef(ch.d, 'x')}, 1)，求 ∮_C F · dr。它等于 kπ，求 k（整数或分数）。`),
      fields: [{ label: t('k', 'k'), answer: chK }],
      hint: t("Use Stokes' theorem with S, where n dS = (2x, 2y, 1) dA, or add up the three line integrals over the three pieces of C.",
        '可以对 S 用斯托克斯定理（n dS = (2x, 2y, 1) dA），也可以把 C 的三段上的线积分加起来。'),
      explanation: t(`curl F = (${coef(ch.a, 'x')}, ${coef(ch.a, 'y')}, ${num(chDC)} ${term(-2 * ch.a)}z). With n dS = (2x, 2y, 1) dA and z = ${ch.h} − r², curl F · n dS = (${num(4 * ch.a)}r² ${term(-2 * ch.a * ch.h)} + (${num(chDC)})) dA. Over the quarter disc r ≤ √${ch.h}, 0 ≤ θ ≤ π/2 the first two terms integrate to (π/2)·(${num(ch.a * ch.h * ch.h)} − ${num(ch.a * ch.h * ch.h)}) = 0, and the constant ${num(chDC)} gives (${num(chDC)})·π·${ch.h}/4 = ${chPi}. So the loop integral is ${chPi} and k = ${exact(chK)}. Check with the three pieces: on the two curves in the yz- and xz-planes only the term 1·dz contributes, ${num(ch.h)} and ${num(-ch.h)}, which cancel; on the arc in the xy-plane, ∮ ${coef(ch.c, 'y')} dx + ${coef(ch.d, 'x')} dy = (${num(ch.d)} − ${num(ch.c)})·${ch.h}π/4. ${NOT_ASSESSED_EN}`,
        `curl F = (${coef(ch.a, 'x')}, ${coef(ch.a, 'y')}, ${num(chDC)} ${term(-2 * ch.a)}z). 取 n dS = (2x, 2y, 1) dA，z = ${ch.h} − r²，则 curl F · n dS = (${num(4 * ch.a)}r² ${term(-2 * ch.a * ch.h)} + (${num(chDC)})) dA。在四分之一圆盘 r ≤ √${ch.h}、0 ≤ θ ≤ π/2 上，前两项积分为 (π/2)·(${num(ch.a * ch.h * ch.h)} − ${num(ch.a * ch.h * ch.h)}) = 0，常数项 ${num(chDC)} 给出 (${num(chDC)})·π·${ch.h}/4 = ${chPi}。所以环路积分为 ${chPi}，k = ${exact(chK)}。用三段曲线验证：yz 平面和 xz 平面内的两段曲线上只有 1·dz 起作用，分别为 ${num(ch.h)} 与 ${num(-ch.h)}，相互抵消；xy 平面内的圆弧上，∮ ${coef(ch.c, 'y')} dx + ${coef(ch.d, 'x')} dy = (${num(ch.d)} − ${num(ch.c)})·${ch.h}π/4。${NOT_ASSESSED_ZH}`),
      audit: { kind: 'MIT-MV-69:challenge', params: { a: ch.a, c: ch.c, d: ch.d, h: ch.h } },
    }),
  ];
};
