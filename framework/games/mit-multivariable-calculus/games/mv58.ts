import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, line3d, project3d, type FigureShape, type Pt3 } from '../../figure';
import { coef, frac, makeMvDeck, num, par, type Text } from '../support';

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

export const mv58: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-58');
  warm(g);

  // setup
  const setup = retry(() => ({ a: g.pick([2, 3, 4, 5, 6, 7]), b: g.pick([2, 3, 4, 5, 6, 7]), c: g.pick([2, 3, 4, 5, 6, 7]) }),
    v => {
      const ab = v.a * v.b;
      const c2 = v.c * v.c;
      const tokens = [ab, c2, v.c, v.a];
      return new Set(tokens).size === tokens.length;
    });
  const setupAb = setup.a * setup.b;
  const setupC2 = setup.c * setup.c;
  const setupTokens = shuffled(g, [
    `−${setupAb}t`,
    `${setupAb}t`,
    `${setupC2}t`,
    `${setup.c}t`,
    `${setup.a}t`,
    `−${setupC2}t`,
  ]);

  // segment-work
  const seg = retry(() => ({ a: g.pick([2, 3, 4, 5, 6, 7]), b: g.pick([2, 3, 4, 5, 6, 7]), c: g.pick([2, 3, 4, 5, 6, 7]) }),
    v => v.a !== setup.a || v.b !== setup.b || v.c !== setup.c);
  const segAns = seg.c * seg.c / 2;

  // twisted-cubic
  const tw = retry(() => ({ p: g.pick([1, 2, 3]), h: g.pick([1, 2]) }),
    v => true);
  const twAns = tw.p * (Math.pow(tw.h, 3) / 3 + Math.pow(tw.h, 6) / 2);

  // not-conservative
  const nc = retry(() => ({ p: g.pick([1, 2, 3, 4, 5, 6]), q: g.pick([1, 2, 3, 4, 5, 6]), r: g.pick([1, 2, 3, 4, 5, 6]) }),
    v => v.p !== v.q);

  // conservative-work
  const cw = retry(() => ({ a: g.pick([1, 2, 3, 4, 5, 6]), b: g.pick([1, 2, 3, 4, 5, 6]), c: g.pick([1, 2, 3, 4, 5, 6]) }),
    v => true);
  const cwAns = cw.a * cw.b * cw.b * cw.c;

  // find-c
  const fc = retry(() => ({ d: g.pick([1, 2, 3, 4]), e: g.pick([1, 2, 3, 4]) }),
    v => new Set([2 * v.d, v.d, v.d + 1]).size === 3);
  const fcCorrect = 2 * fc.d;

  // exact-diff
  const ed = retry(() => ({ p: g.pick([1, 2, 3, 4, 5, 6]) }),
    v => true);

  // helix
  const hx = retry(() => ({ a: g.pick([1, 2, 3, 4, 5, 6]) }),
    v => true);
  const hxAns = -hx.a;

  // challenge
  const ch = retry(() => ({ a: g.pick([1, 2, 3, 4, 5, 6]), b: g.pick([1, 2, 3, 4, 5, 6]), h: g.pick([1, 2, 3]) }),
    v => true);
  const chAns = 2 * ch.a * ch.b;

  // Figure helpers: oblique 3D projection project3d(x, y, z) = (y − 0.45x, z − 0.3x).
  const segmentFigure = (a: number, b: number, c: number, label: string, alt: Text) => {
    const shapes: FigureShape[] = [
      ...axes3d(c + 1),
      arrow3d([0, 0, 0], [a, b, c], 'accent', label),
      { kind: 'point', at: project3d([a, b, c]), tone: 'accent' },
    ];
    return g.figure({ alt, view: fitView(shapes, 0.2), shapes });
  };

  const twistedPoints: Pt3[] = Array.from({ length: 25 }, (_, i) => { const tt = tw.h * i / 24; return [tt, tt * tt, tt * tt * tt]; });
  // Arrow of increasing t: a stretch of the curve itself, drawn on top of it near the far end.
  const twAt = (u: number): Pt3 => [u, u * u, u * u * u];
  const twistedShapes: FigureShape[] = [
    ...axes3d(tw.h ** 3 + 1),
    line3d(twistedPoints, 'accent', { width: 2 }),
    arrow3d(twAt(tw.h * 0.68), twAt(tw.h * 0.86), 'accent2'),
  ];

  const helixPoints: Pt3[] = Array.from({ length: 25 }, (_, i) => { const tt = Math.PI * i / 24; return [Math.cos(tt), Math.sin(tt), tt]; });
  const helixShapes: FigureShape[] = [
    ...axes3d(2),
    line3d(helixPoints, 'accent', { width: 2 }),
    { kind: 'point', at: project3d([1, 0, 0]), tone: 'accent' },
    { kind: 'point', at: project3d([-1, 0, Math.PI]), tone: 'accent' },
    arrow3d([0, 1, Math.PI / 2], [-0.3, 1, Math.PI / 2 + 0.3], 'accent'),
  ];

  const loopCorners: Pt3[] = [[0, 0, ch.h], [ch.a, 0, ch.h], [ch.a, ch.b, ch.h], [0, ch.b, ch.h], [0, 0, ch.h]];
  const loopShapes: FigureShape[] = [
    ...axes3d(Math.max(ch.a, ch.b) + 1),
    line3d(loopCorners, 'accent', { width: 2 }),
    arrow3d([0, 0, ch.h], [ch.a, 0, ch.h], 'accent'),
    arrow3d([ch.a, 0, ch.h], [ch.a, ch.b, ch.h], 'accent'),
    arrow3d([ch.a, ch.b, ch.h], [0, ch.b, ch.h], 'accent'),
    arrow3d([0, ch.b, ch.h], [0, 0, ch.h], 'accent'),
  ];

  return [
    g.symbols({
      id: 'setup',
      title: t('Set up the work integral', '写出功的积分'),
      prompt: t(
        `F = (−y, x, z) and C is the directed segment from (0, 0, 0) to (${setup.a}, ${setup.b}, ${setup.c}), parametrized by r(t) = (${setup.a}t, ${setup.b}t, ${setup.c}t), 0 ≤ t ≤ 1. Using ∫_C F · dr = ∫ from t = 0 to 1 of (F(r(t)) · dr/dt) dt, complete the work W = ∫ from t = 0 to 1 of [ ] dt + [ ] dt + [ ] dt.`,
        `F = (−y, x, z)，C 是从 (0, 0, 0) 到 (${setup.a}, ${setup.b}, ${setup.c}) 的有向直线段，参数化为 r(t) = (${setup.a}t, ${setup.b}t, ${setup.c}t)，0 ≤ t ≤ 1。由 ∫_C F · dr = 从 t = 0 到 1 的 (F(r(t)) · dr/dt) 积分，补全功 W = 从 t = 0 到 1 的 [ ] dt + [ ] dt + [ ] dt。`
      ),
      before: t('W = ∫ from t = 0 to 1 of ', 'W = 从 t = 0 到 1 的 '),
      between: [' dt + ', ' dt + '],
      after: t(' dt .', ' dt。'),
      answers: [`−${setupAb}t`, `${setupAb}t`, `${setupC2}t`],
      tokens: setupTokens,
      hint: t(
        `Substitute x = ${setup.a}t, y = ${setup.b}t, z = ${setup.c}t into F, and use dx = ${setup.a} dt, dy = ${setup.b} dt, dz = ${setup.c} dt; the three terms are the x-, y- and z-contributions.`,
        `把 x = ${setup.a}t、y = ${setup.b}t、z = ${setup.c}t 代入 F，并用 dx = ${setup.a} dt、dy = ${setup.b} dt、dz = ${setup.c} dt；三项分别是 x、y、z 方向的贡献。`
      ),
      explanation: t(
        `With x = ${setup.a}t, y = ${setup.b}t, z = ${setup.c}t, F = (−${setup.b}t, ${setup.a}t, ${setup.c}t) and dr/dt = (${setup.a}, ${setup.b}, ${setup.c}), so F · dr/dt = (−${setup.b}t)(${setup.a}) + (${setup.a}t)(${setup.b}) + (${setup.c}t)(${setup.c}) = −${setupAb}t + ${setupAb}t + ${setupC2}t. The first two terms cancel and the z term is ${setupC2}t.`,
        `由 x = ${setup.a}t、y = ${setup.b}t、z = ${setup.c}t 得 F = (−${setup.b}t, ${setup.a}t, ${setup.c}t)，dr/dt = (${setup.a}, ${setup.b}, ${setup.c})，所以 F · dr/dt = (−${setup.b}t)(${setup.a}) + (${setup.a}t)(${setup.b}) + (${setup.c}t)(${setup.c}) = −${setupAb}t + ${setupAb}t + ${setupC2}t。前两项相消，z 项为 ${setupC2}t。`
      ),
      figure: segmentFigure(setup.a, setup.b, setup.c, 'C',
        t(`The directed line segment from the origin to the point (${setup.a}, ${setup.b}, ${setup.c}).`, `从原点指向点 (${setup.a}, ${setup.b}, ${setup.c}) 的有向直线段。`)),
    }),
    g.number({
      id: 'segment-work',
      title: t('Work along the segment', '沿直线段的功'),
      prompt: t(
        `Using the set-up above, F = (−y, x, z), C the directed segment from (0, 0, 0) to (${seg.a}, ${seg.b}, ${seg.c}). Enter the work W. Give an integer or a fraction.`,
        `沿用上面的设定，F = (−y, x, z)，C 是从 (0, 0, 0) 到 (${seg.a}, ${seg.b}, ${seg.c}) 的有向直线段。求功 W，填写整数或分数。`
      ),
      fields: [{ label: t('W', 'W'), answer: segAns }],
      hint: t('Add the three terms from the set-up and integrate over 0 ≤ t ≤ 1.', '把设定中的三项相加，再对 0 ≤ t ≤ 1 积分。'),
      explanation: t(
        `W = ∫ from 0 to 1 of (−${seg.a * seg.b}t + ${seg.a * seg.b}t + ${seg.c * seg.c}t) dt = ∫ from 0 to 1 of ${seg.c * seg.c}t dt = ${seg.c * seg.c}/2. The terms from the x- and y-components cancel, so W depends only on the endpoint's z-coordinate ${seg.c}.`,
        `W = 从 0 到 1 的 (−${seg.a * seg.b}t + ${seg.a * seg.b}t + ${seg.c * seg.c}t) dt = 从 0 到 1 的 ${seg.c * seg.c}t dt = ${seg.c * seg.c}/2。x、y 分量的项相消，故 W 只与终点的 z 坐标 ${seg.c} 有关。`
      ),
      figure: segmentFigure(seg.a, seg.b, seg.c, 'C',
        t(`The directed line segment from the origin to the point (${seg.a}, ${seg.b}, ${seg.c}).`, `从原点指向点 (${seg.a}, ${seg.b}, ${seg.c}) 的有向直线段。`)),
      audit: { kind: 'MIT-MV-58:segment-work', params: { a: seg.a, b: seg.b, c: seg.c } },
    }),
    g.number({
      id: 'twisted-cubic',
      title: t('Work along a twisted cubic', '沿扭曲三次曲线的功'),
      prompt: t(
        `F = ${tw.p === 1 ? '' : tw.p}(−y, x, z) and C is the curve r(t) = (t, t², t³), 0 ≤ t ≤ ${tw.h}. Enter the work W. Give an integer or a fraction.`,
        `F = ${tw.p === 1 ? '' : tw.p}(−y, x, z)，C 是曲线 r(t) = (t, t², t³)，0 ≤ t ≤ ${tw.h}。求功 W，填写整数或分数。`
      ),
      fields: [{ label: t('W', 'W'), answer: twAns }],
      hint: t(`Differentiate r(t), substitute into F, and integrate t² + 3t⁵ from 0 to ${tw.h}.`, `对 r(t) 求导，代入 F，再把 t² + 3t⁵ 从 0 到 ${tw.h} 积分。`),
      explanation: t(
        `On C, x = t, y = t², z = t³, so F = ${tw.p === 1 ? '' : tw.p}(−t², t, t³) and dr/dt = (1, 2t, 3t²). Then F · dr/dt = ${tw.p === 1 ? '' : tw.p}(−t² + 2t² + 3t⁵) = ${tw.p === 1 ? '' : tw.p}(t² + 3t⁵). Integrating from 0 to ${tw.h}: ${tw.p === 1 ? '' : tw.p}(${tw.h}³/3 + ${tw.h}⁶/2) = ${frac(tw.p * tw.h * tw.h * tw.h * 2 + tw.p * tw.h * tw.h * tw.h * tw.h * tw.h * tw.h * 3, 6)}.`,
        `在 C 上 x = t、y = t²、z = t³，所以 F = ${tw.p === 1 ? '' : tw.p}(−t², t, t³)，dr/dt = (1, 2t, 3t²)。于是 F · dr/dt = ${tw.p === 1 ? '' : tw.p}(−t² + 2t² + 3t⁵) = ${tw.p === 1 ? '' : tw.p}(t² + 3t⁵)。从 0 到 ${tw.h} 积分得 ${tw.p === 1 ? '' : tw.p}(${tw.h}³/3 + ${tw.h}⁶/2) = ${frac(tw.p * tw.h * tw.h * tw.h * 2 + tw.p * tw.h * tw.h * tw.h * tw.h * tw.h * tw.h * 3, 6)}。`
      ),
      figure: g.figure({
        alt: t(`The space curve r(t) = (t, t², t³) for 0 ≤ t ≤ ${tw.h} with an arrow showing the direction of increasing t.`, `空间曲线 r(t) = (t, t², t³)，0 ≤ t ≤ ${tw.h}，箭头表示 t 增大的方向。`),
        view: fitView(twistedShapes, 0.2),
        shapes: twistedShapes,
      }),
      audit: { kind: 'MIT-MV-58:twisted-cubic', params: { p: tw.p, h: tw.h } },
    }),
    g.choice({
      id: 'not-conservative',
      title: t('Is this field path-independent?', '这个场与路径无关吗？'),
      prompt: t(
        `F = (${coef(nc.p, 'y')}, ${coef(nc.q, 'x')}, ${coef(nc.r, 'z')}) with ${nc.p} ≠ ${nc.q}. Which statement about the line integral between two fixed points is correct?`,
        `F = (${coef(nc.p, 'y')}, ${coef(nc.q, 'x')}, ${coef(nc.r, 'z')})，其中 ${nc.p} ≠ ${nc.q}。关于两点之间线积分的下列说法，哪一条正确？`
      ),
      options: [
        t(`The integral is not path-independent, because the criterion ∂M/∂y = ∂N/∂x fails: here ∂M/∂y = ${nc.p} but ∂N/∂x = ${nc.q}`, `积分与路径有关，因为判据 ∂M/∂y = ∂N/∂x 不成立：这里 ∂M/∂y = ${nc.p} 但 ∂N/∂x = ${nc.q}`),
        t('It is path-independent because F is linear in x, y, z', '它与路径无关，因为 F 关于 x, y, z 是线性的'),
        t('It is path-independent because ∂M/∂z = ∂P/∂x = 0', '它与路径无关，因为 ∂M/∂z = ∂P/∂x = 0'),
        t('Nothing can be said without knowing the two points', '不知道两个点就无法判断'),
      ],
      correct: 0,
      hint: t('Write F = M i + N j + P k and compare ∂M/∂y with ∂N/∂x.', '写成 F = M i + N j + P k，比较 ∂M/∂y 与 ∂N/∂x。'),
      explanation: t(
        `For F = M i + N j + P k with M = ${coef(nc.p, 'y')}, N = ${coef(nc.q, 'x')}, P = ${coef(nc.r, 'z')} we get ∂M/∂y = ${nc.p} and ∂N/∂x = ${nc.q}. A gradient field must have ∂M/∂y = ∂N/∂x (V12, eq. 1); since ${nc.p} ≠ ${nc.q} this fails, so F is not a gradient field on all of space and the integral is path-dependent. The other statements check the wrong pair of partial derivatives or ignore the criterion.`,
        `对 F = M i + N j + P k，M = ${coef(nc.p, 'y')}、N = ${coef(nc.q, 'x')}、P = ${coef(nc.r, 'z')}，得 ∂M/∂y = ${nc.p}、∂N/∂x = ${nc.q}。梯度场必须满足 ∂M/∂y = ∂N/∂x（V12 式 (1)）；因 ${nc.p} ≠ ${nc.q} 不成立，故 F 不是全空间上的梯度场，积分与路径有关。其余说法检查了错误的偏导数组合，或忽略了该判据。`
      ),
    }),
    g.number({
      id: 'conservative-work',
      title: t('Work of a gradient field', '梯度场的功'),
      prompt: t(
        `F = ∇f with f = x y² z, and C is any path from (0, 0, 0) to (${cw.a}, ${cw.b}, ${cw.c}). Enter the work W. Give an integer or a fraction.`,
        `F = ∇f，其中 f = x y² z，C 是从 (0, 0, 0) 到 (${cw.a}, ${cw.b}, ${cw.c}) 的任意路径。求功 W，填写整数或分数。`
      ),
      fields: [{ label: t('W', 'W'), answer: cwAns }],
      hint: t('Because F is a gradient field, only the endpoints matter: use the first fundamental theorem for line integrals.', '因为 F 是梯度场，只与端点有关：用线积分第一基本定理。'),
      explanation: t(
        `F = ∇f is a gradient field, so the integral is path-independent on all of space (V11, eq. 10): W = f(${cw.a}, ${cw.b}, ${cw.c}) − f(0, 0, 0) = ${cw.a}·${cw.b}²·${cw.c} − 0 = ${num(cwAns)}.`,
        `F = ∇f 是梯度场，故积分在全空间上与路径无关（V11 式 (10)）：W = f(${cw.a}, ${cw.b}, ${cw.c}) − f(0, 0, 0) = ${cw.a}·${cw.b}²·${cw.c} − 0 = ${num(cwAns)}。`
      ),
      figure: segmentFigure(cw.a, cw.b, cw.c, g.t(t('any path', '任意路径')),
        t(`An arrow from the origin to the point (${cw.a}, ${cw.b}, ${cw.c}), standing for any path between them.`, `从原点指向点 (${cw.a}, ${cw.b}, ${cw.c}) 的箭头，代表两点之间的任意路径。`)),
      audit: { kind: 'MIT-MV-58:conservative-work', params: { a: cw.a, b: cw.b, c: cw.c } },
    }),
    g.choice({
      id: 'find-c',
      title: t('When is this field conservative?', '何时该场保守？'),
      prompt: t(
        `For which value of c is F = y i + (x + c y z) j + (${coef(fc.d, 'y²')} + ${coef(fc.e, 'z²')}) k a conservative (gradient) field?`,
        `当 c 取何值时，F = y i + (x + c y z) j + (${coef(fc.d, 'y²')} + ${coef(fc.e, 'z²')}) k 是保守场（梯度场）？`
      ),
      options: [
        t(`c = ${fcCorrect}`, `c = ${fcCorrect}`),
        t(`c = ${fc.d}`, `c = ${fc.d}`),
        t(`c = ${fc.d + 1}`, `c = ${fc.d + 1}`),
        t('no such value', '不存在这样的值'),
      ],
      correct: 0,
      hint: t('Use the criterion: compute ∂P/∂y and ∂N/∂z for the three equalities (V12, eq. 1).', '用判据：对三条等式计算 ∂P/∂y 与 ∂N/∂z（V12 式 (1)）。'),
      explanation: t(
        `With M = y, N = x + c y z, P = ${coef(fc.d, 'y²')} + ${coef(fc.e, 'z²')}, the criterion needs ∂M/∂y = ∂N/∂x (1 = 1, holds), ∂M/∂z = ∂P/∂x (0 = 0, holds) and ∂N/∂z = ∂P/∂y, i.e. c y = ${2 * fc.d} y, so c = ${fcCorrect} (for y ≠ 0 this must hold identically).`,
        `取 M = y、N = x + c y z、P = ${coef(fc.d, 'y²')} + ${coef(fc.e, 'z²')}，判据要求 ∂M/∂y = ∂N/∂x（1 = 1，成立）、∂M/∂z = ∂P/∂x（0 = 0，成立）以及 ∂N/∂z = ∂P/∂y，即 c y = ${2 * fc.d} y，故 c = ${fcCorrect}（对 y ≠ 0 需恒成立）。`
      ),
    }),
    g.choice({
      id: 'exact-diff',
      title: t('Which differential is exact?', '哪个是恰微分？'),
      prompt: t('Which of these differentials is exact on all of space?', '下列哪个微分在全空间上是恰微分？'),
      options: [
        t(`${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'xyz')} dy + ${coef(ed.p, 'xy²')} dz`, `${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'xyz')} dy + ${coef(ed.p, 'xy²')} dz`),
        t(`${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'yz')} dy + ${coef(ed.p, 'xy²')} dz`, `${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'yz')} dy + ${coef(ed.p, 'xy²')} dz`),
        t(`${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'xyz')} dy + ${coef(ed.p, 'xy')} dz`, `${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'xyz')} dy + ${coef(ed.p, 'xy')} dz`),
        t(`${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'xyz')} dy + ${coef(ed.p, 'xyz')} dz`, `${coef(ed.p, 'y²z')} dx + ${coef(2 * ed.p, 'xyz')} dy + ${coef(ed.p, 'xyz')} dz`),
      ],
      correct: 0,
      hint: t('The differential M dx + N dy + P dz is exact exactly when ∂P/∂y = ∂N/∂z, ∂M/∂z = ∂P/∂x and ∂N/∂x = ∂M/∂y (V12, (13)–(14)).', '微分 M dx + N dy + P dz 为恰微分，当且仅当 ∂P/∂y = ∂N/∂z、∂M/∂z = ∂P/∂x、∂N/∂x = ∂M/∂y（V12 式 (13)–(14)）。'),
      explanation: t(
        `For the correct differential M = ${coef(ed.p, 'y²z')}, N = ${coef(2 * ed.p, 'xyz')}, P = ${coef(ed.p, 'xy²')}: ∂P/∂y = ${coef(2 * ed.p, 'xy')} = ∂N/∂z, ∂M/∂z = ${coef(ed.p, 'y²')} = ∂P/∂x, ∂N/∂x = ${coef(2 * ed.p, 'yz')} = ∂M/∂y, so it is d(${coef(ed.p, 'xy²z')}). Each other option fails one equality identically.`,
        `对正确的微分 M = ${coef(ed.p, 'y²z')}、N = ${coef(2 * ed.p, 'xyz')}、P = ${coef(ed.p, 'xy²')}：∂P/∂y = ${coef(2 * ed.p, 'xy')} = ∂N/∂z、∂M/∂z = ${coef(ed.p, 'y²')} = ∂P/∂x、∂N/∂x = ${coef(2 * ed.p, 'yz')} = ∂M/∂y，故它等于 d(${coef(ed.p, 'xy²z')})。其余各项都恒不满足其中一条等式。`
      ),
    }),
    g.number({
      id: 'helix',
      title: t('Work along the helix', '沿螺旋线的功'),
      prompt: t(
        `F = ∇f with f = (${coef(hx.a, 'x')} + y²) z. C is the helix x = cos t, y = sin t, z = t, 0 ≤ t ≤ π, run in the direction of increasing t (from (1, 0, 0) to (−1, 0, π)). The work ∫_C F · dr equals k·π. Enter k.`,
        `F = ∇f，其中 f = (${coef(hx.a, 'x')} + y²) z。C 是螺旋线 x = cos t、y = sin t、z = t，0 ≤ t ≤ π，沿 t 增大的方向（从 (1, 0, 0) 到 (−1, 0, π)）。功 ∫_C F · dr 等于 k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: hxAns }],
      hint: t('No direct integral is needed: a gradient field\'s line integral is f(end) − f(start). Evaluate f at the two endpoints.', '无需直接积分：梯度场的线积分等于 f(终点) − f(起点)。在两端点求 f。'),
      explanation: t(
        `F = ∇f is a gradient field, so by the first fundamental theorem (V11, eq. 10) the work is f(end) − f(start). At (1, 0, 0): f = (${coef(hx.a, 'x')}·1 + 0)·0 = 0. At (−1, 0, π): f = (${coef(hx.a, 'x')}·(−1) + 0)·π = ${hx.a === 1 ? '−π' : `−${hx.a}π`}. So the work is ${hx.a === 1 ? '−π' : `−${hx.a}π`} and k = ${hx.a === 1 ? '−1' : `−${hx.a}`}.`,
        `F = ∇f 是梯度场，由第一基本定理（V11 式 (10)）功等于 f(终点) − f(起点)。在 (1, 0, 0) 处 f = (${coef(hx.a, 'x')}·1 + 0)·0 = 0；在 (−1, 0, π) 处 f = (${coef(hx.a, 'x')}·(−1) + 0)·π = ${hx.a === 1 ? '−π' : `−${hx.a}π`}。故功为 ${hx.a === 1 ? '−π' : `−${hx.a}π`}，k = ${hx.a === 1 ? '−1' : `−${hx.a}`}。`
      ),
      figure: g.figure({
        alt: t('The helix x = cos t, y = sin t, z = t for 0 ≤ t ≤ π, from (1, 0, 0) to (−1, 0, π).', '螺旋线 x = cos t、y = sin t、z = t，0 ≤ t ≤ π，从 (1, 0, 0) 到 (−1, 0, π)。'),
        view: fitView(helixShapes, 0.2),
        shapes: helixShapes,
      }),
      audit: { kind: 'MIT-MV-58:helix', params: { a: hx.a } },
    }),
    g.number({
      id: 'challenge',
      title: t('Work around a closed loop', '沿闭曲线的功'),
      prompt: t(
        `F = (−y, x, z). C is the closed loop (0, 0, ${ch.h}) → (${ch.a}, 0, ${ch.h}) → (${ch.a}, ${ch.b}, ${ch.h}) → (0, ${ch.b}, ${ch.h}) → (0, 0, ${ch.h}), traversed counterclockwise as viewed from above (from the positive z-axis looking down). Enter the work ∮_C F · dr = W.`,
        `F = (−y, x, z)。C 是闭曲线 (0, 0, ${ch.h}) → (${ch.a}, 0, ${ch.h}) → (${ch.a}, ${ch.b}, ${ch.h}) → (0, ${ch.b}, ${ch.h}) → (0, 0, ${ch.h})，从上往下看（从正 z 轴俯视）为逆时针方向。求功 ∮_C F · dr = W。`
      ),
      fields: [{ label: t('W', 'W'), answer: chAns }],
      hint: t('Split the loop into its four straight sides, or note that the z-contribution vanishes and the rest is ∮_C (−y dx + x dy).', '把闭曲线分成四条直边，或注意 z 方向的贡献为零，其余是 ∮_C (−y dx + x dy)。'),
      explanation: t(
        `On the whole loop z = ${ch.h} is constant, so dz = 0 and the z-term drops out: ∮_C (−y dx + x dy). For the counterclockwise rectangle 0 ≤ x ≤ ${ch.a}, 0 ≤ y ≤ ${ch.b} this is twice its area, 2·${ch.a}·${ch.b} = ${num(chAns)}; the height ${ch.h} does not enter. This game does not assess Stokes' theorem, surface integrals, or whether 'curl F = 0 implies a potential' on a region that is not all of space.`,
        `整个闭曲线上 z = ${ch.h} 为常数，故 dz = 0，z 项消失：∮_C (−y dx + x dy)。对逆时针矩形 0 ≤ x ≤ ${ch.a}、0 ≤ y ≤ ${ch.b}，它等于面积的两倍，2·${ch.a}·${ch.b} = ${num(chAns)}；高度 ${ch.h} 不参与。本游戏不评估斯托克斯定理、曲面积分，也不评估“旋度为零推出势函数”在非全空间区域上是否成立。`
      ),
      figure: g.figure({
        alt: t(`A rectangle in the plane z = ${ch.h} with corners (0, 0, ${ch.h}), (${ch.a}, 0, ${ch.h}), (${ch.a}, ${ch.b}, ${ch.h}), (0, ${ch.b}, ${ch.h}), traversed counterclockwise viewed from above.`, `平面 z = ${ch.h} 上的矩形，四角为 (0, 0, ${ch.h})、(${ch.a}, 0, ${ch.h})、(${ch.a}, ${ch.b}, ${ch.h})、(0, ${ch.b}, ${ch.h})，从上往下看为逆时针方向。`),
        view: fitView(loopShapes, 0.2),
        shapes: loopShapes,
      }),
      audit: { kind: 'MIT-MV-58:challenge', params: { a: ch.a, b: ch.b, h: ch.h } },
    }),
  ];
};
