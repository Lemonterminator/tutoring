import type { CardGenerator } from '../../types';
import { arrowField, ellipse, fitView, rect, type FigureShape, type Pt } from '../../figure';
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

export const mv46: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-46');
  warm(g);

  // Sample parameters for all cards
  const ndSample = retry(() => {
    const a = g.pick([2, 3]);
    const P = g.pick([[a, 0], [0, a], [-a, 0], [0, -a]]);
    const dir = g.pick(['ccw', 'cw'] as const);
    return { a, P, dir };
  }, v => true);

  const sf = retry(() => ({
    m: g.pick([1, 2, 3]),
    n: g.pick([1, 2, 3]),
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
  }), v => v.m !== v.n);

  const cf = { k: g.pick([1, 2, 3]), a: g.pick([1, 2, 3]) };

  const tz = {
    k: g.pick([1, 2, 3]),
    a: g.pick([1, 2, 3]),
    variant: g.pick([0, 1]),
  };

  const sfq = {
    m: g.pick([1, 2, 3]),
    n: g.pick([1, 2, 3]),
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
  };

  const cs = { k: g.pick([1, 2, 3]), a: g.pick([2, 3, 4]) };

  const ch = {
    p: g.pick([1, 2, 3]),
    q: g.pick([1, 2, 3]),
    c: g.pick([1, 2, 3]),
    d: g.pick([1, 2, 3]),
  };

  const nfVariant = g.pick([0, 1]);

  // Compute answers
  const sfAnswer = (sf.m - sf.n) * sf.a * sf.b / 2;
  const cfAnswer = 2 * cf.k * cf.a * cf.a * Math.PI;
  const sfqAnswer = (sfq.m + sfq.n) * sfq.a * sfq.b;
  const csAnswer = -2 * cs.k * cs.a * cs.a * Math.PI;
  const chAnswer = (ch.p * ch.d * ch.d + ch.q * ch.c * ch.c) / 2;

  // Helper for field expression
  const fieldExpr = (m: number, n: number) => `(${coef(m, 'x')}, ${coef(n, 'y')})`;

  // Figure helpers
  const makeCircleFigure = (radius: number, dir: 'ccw' | 'cw', P?: readonly number[]): FigureShape[] => {
    const shapes: FigureShape[] = [
      { kind: 'line', points: ellipse(0, 0, radius, radius), tone: 'accent', width: 2 },
    ];
    // Add direction arrow
    if (dir === 'ccw') {
      shapes.push({ kind: 'arrow', from: [radius * 0.7, radius * 0.7], to: [radius * 0.5, radius * 0.9], tone: 'accent2', width: 2 });
    } else {
      shapes.push({ kind: 'arrow', from: [radius * 0.7, radius * 0.7], to: [radius * 0.9, radius * 0.5], tone: 'accent2', width: 2 });
    }
    if (P) {
      shapes.push({ kind: 'point', at: [P[0], P[1]], tone: 'warn', label: 'P' });
    }
    return shapes;
  };

  const makeSegmentFigure = (a: number, b: number): FigureShape[] => {
    return [
      { kind: 'line', points: [[0, 0], [a, b]], tone: 'accent', width: 2 },
      { kind: 'arrow', from: [a * 0.8, b * 0.8], to: [a, b], tone: 'accent2', width: 2 },
      { kind: 'point', at: [0, 0], tone: 'muted' },
      { kind: 'point', at: [a, b], tone: 'muted' },
    ];
  };

  const makeSquareFigure = (a: number, b: number): FigureShape[] => {
    const r = rect(0, 0, a, b);
    return [
      { kind: 'area', points: r, tone: 'accent', opacity: 0.15 },
      { kind: 'line', points: [...r, [0, 0]], tone: 'accent', width: 2 },
      { kind: 'arrow', from: [a / 2, 0], to: [a / 2, -0.3], tone: 'accent2', width: 2 },
      { kind: 'arrow', from: [a, b / 2], to: [a + 0.3, b / 2], tone: 'accent2', width: 2 },
      { kind: 'arrow', from: [a / 2, b], to: [a / 2, b + 0.3], tone: 'accent2', width: 2 },
      { kind: 'arrow', from: [0, b / 2], to: [-0.3, b / 2], tone: 'accent2', width: 2 },
    ];
  };

  // Compute normal-direction options correctly
  const nd = ndSample;
  const ndCorrect = nd.dir === 'ccw' ? [nd.P[0] / nd.a, nd.P[1] / nd.a] : [-nd.P[0] / nd.a, -nd.P[1] / nd.a];
  const ndOpposite = [-ndCorrect[0], -ndCorrect[1]];
  // Tangent vectors: for ccw at (a,0) t=(0,1); at (0,a) t=(-1,0); at (-a,0) t=(0,-1); at (0,-a) t=(1,0)
  // For cw, t is negated
  const ndTangent = (() => {
    const [px, py] = nd.P;
    let tx: number, ty: number;
    if (px === nd.a && py === 0) { tx = 0; ty = 1; }
    else if (px === 0 && py === nd.a) { tx = -1; ty = 0; }
    else if (px === -nd.a && py === 0) { tx = 0; ty = -1; }
    else { tx = 1; ty = 0; }
    if (nd.dir === 'cw') { tx = -tx; ty = -ty; }
    return [tx, ty] as [number, number];
  })();
  const ndNegTangent = [-ndTangent[0], -ndTangent[1]];

  const fmtVec = (v: readonly number[]) => `(${num(v[0])}, ${num(v[1])})`;
  const ndOptions: Text[] = [
    t(`n = ${fmtVec(ndCorrect)}`, `n = ${fmtVec(ndCorrect)}`),
    t(`n = ${fmtVec(ndOpposite)}`, `n = ${fmtVec(ndOpposite)}`),
    t(`n = ${fmtVec(ndTangent)}`, `n = ${fmtVec(ndTangent)}`),
    t(`n = ${fmtVec(ndNegTangent)}`, `n = ${fmtVec(ndNegTangent)}`),
  ];

  return [
    g.choice({
      id: 'flux-identity',
      title: t('Flux identity', '通量恒等式'),
      prompt: t(
        'F = M i + N j is a vector field and C is a directed curve. The unit normal n is the direction of travel turned clockwise by 90°. Which line integral is the flux of F across C, that is, ∫_C F·n ds?',
        'F = M i + N j 是向量场，C 是有向曲线。单位法向量 n 是把行进方向顺时针旋转 90° 得到的方向。哪一个线积分是 F 穿过 C 的通量，即 ∫_C F·n ds？'
      ),
      options: [
        t('∫_C M dy − N dx', '∫_C M dy − N dx'),
        t('∫_C M dx + N dy', '∫_C M dx + N dy'),
        t('∫_C N dx − M dy', '∫_C N dx − M dy'),
        t('∫_C M dx − N dy', '∫_C M dx − N dy'),
      ],
      correct: 0,
      hint: t(
        'Turn the unit tangent (dx/ds, dy/ds) clockwise by 90° to get n, then form F·n ds.',
        '把单位切向量 (dx/ds, dy/ds) 顺时针旋转 90° 得到 n，再写出 F·n ds。'
      ),
      explanation: t(
        'Turning the tangent (dx/ds, dy/ds) clockwise by 90° gives n = (dy/ds, −dx/ds), so F·n ds = M dy − N dx. The integral of M dx + N dy is the work F·T ds: it uses the tangent, not the normal.',
        '把切向量 (dx/ds, dy/ds) 顺时针旋转 90° 得 n = (dy/ds, −dx/ds)，所以 F·n ds = M dy − N dx。而 M dx + N dy 是功 F·T ds，用的是切向量而不是法向量。'
      ),
    }),
    g.choice({
      id: 'normal-direction',
      title: t('Normal direction', '法向方向'),
      prompt: t(
        `C is the circle of radius ${nd.a} centred at the origin, traversed ${nd.dir === 'ccw' ? 'counterclockwise' : 'clockwise'}. At the point P = (${num(nd.P[0])}, ${num(nd.P[1])}) the unit tangent t points in the direction of travel, and n is t turned clockwise by 90°. What is n at P?`,
        `C 是以原点为圆心、半径为 ${nd.a} 的圆，沿${nd.dir === 'ccw' ? '逆时针' : '顺时针'}方向绕行。在点 P = (${num(nd.P[0])}, ${num(nd.P[1])}) 处，单位切向量 t 指向行进方向，n 是把 t 顺时针旋转 90° 所得的向量。P 处的 n 是什么？`
      ),
      options: ndOptions,
      correct: 0,
      hint: t(
        'First write t at P (the direction of travel), then turn it clockwise: (t_x, t_y) becomes (t_y, −t_x).',
        '先写出 P 处的 t（行进方向），再顺时针旋转：(t_x, t_y) 变为 (t_y, −t_x)。'
      ),
      explanation: t(
        `At P = (${num(nd.P[0])}, ${num(nd.P[1])}) a counterclockwise walker moves in the tangent direction. Turning t clockwise by 90° gives n pointing away from the centre. Going clockwise reverses t and therefore n.`,
        `在 P = (${num(nd.P[0])}, ${num(nd.P[1])}) 处，逆时针行进的方向沿切线。把 t 顺时针旋转 90° 得 n 指向圆外。改为顺时针行进时 t 反向，n 也反向。`
      ),
      figure: g.figure({
        alt: t(
          `A circle of radius ${nd.a} around the origin with an arrow showing ${nd.dir === 'ccw' ? 'counterclockwise' : 'clockwise'} travel and the point P marked on it.`,
          `以原点为圆心、半径为 ${nd.a} 的圆，箭头显示${nd.dir === 'ccw' ? '逆时针' : '顺时针'}方向，点 P 标在圆上。`
        ),
        view: fitView(makeCircleFigure(nd.a, nd.dir, nd.P), 0.3),
        shapes: makeCircleFigure(nd.a, nd.dir, nd.P),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
    }),
    g.number({
      id: 'segment-flux',
      title: t('Flux across a segment', '线段通量'),
      prompt: t(
        `F = ${fieldExpr(sf.m, sf.n)} is a vector field. C is the line segment from (0, 0) to (${sf.a}, ${sf.b}), traversed in that direction. Here n is the direction of travel turned clockwise by 90°. Find the flux ∫_C F·n ds of F across C.`,
        `F = ${fieldExpr(sf.m, sf.n)} 是向量场。C 是从 (0, 0) 到 (${sf.a}, ${sf.b}) 的线段，沿此方向行进。这里 n 是把行进方向顺时针旋转 90° 得到的单位法向量。求 F 穿过 C 的通量 ∫_C F·n ds。`
      ),
      fields: [{ label: t('flux', '通量'), answer: sfAnswer }],
      hint: t(
        `Parametrize x = ${coef(sf.a, 't')}, y = ${coef(sf.b, 't')} for 0 ≤ t ≤ 1 and use flux = ∫ M dy − N dx.`,
        `取 x = ${coef(sf.a, 't')}，y = ${coef(sf.b, 't')}，0 ≤ t ≤ 1，并用 通量 = ∫ M dy − N dx。`
      ),
      explanation: t(
        `With x = ${coef(sf.a, 't')} and y = ${coef(sf.b, 't')}: M dy − N dx = (${sf.m}·${coef(sf.a, 't')}·${sf.b} − ${sf.n}·${coef(sf.b, 't')}·${sf.a}) dt = ${par((sf.m - sf.n) * sf.a * sf.b)} t dt, and the integral from t = 0 to 1 is ${num(sfAnswer)}.`,
        `取 x = ${coef(sf.a, 't')}，y = ${coef(sf.b, 't')}：M dy − N dx = (${sf.m}·${coef(sf.a, 't')}·${sf.b} − ${sf.n}·${coef(sf.b, 't')}·${sf.a}) dt = ${par((sf.m - sf.n) * sf.a * sf.b)} t dt，在 0 到 1 上积分得 ${num(sfAnswer)}。`
      ),
      figure: g.figure({
        alt: t(`The line segment from (0, 0) to (${sf.a}, ${sf.b}).`, `从 (0, 0) 到 (${sf.a}, ${sf.b}) 的线段。`),
        view: fitView(makeSegmentFigure(sf.a, sf.b), 0.3),
        shapes: makeSegmentFigure(sf.a, sf.b),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-46:segment-flux', params: { m: sf.m, n: sf.n, a: sf.a, b: sf.b } },
    }),
    g.number({
      id: 'circle-flux',
      title: t('Flux across a circle', '圆的通量'),
      prompt: t(
        `F = ${cf.k === 1 ? '(x, y)' : `${cf.k}(x, y)`}. C is the circle of radius ${cf.a} centred at the origin, traversed counterclockwise, and n is the outward unit normal. Find the flux ∫_C F·n ds. Give the exact value, for example 6pi.`,
        `F = ${cf.k === 1 ? '(x, y)' : `${cf.k}(x, y)`}。C 是以原点为圆心、半径为 ${cf.a} 的圆，沿逆时针方向绕行，n 是外法向的单位向量。求通量 ∫_C F·n ds，写出精确值，例如 6pi。`
      ),
      fields: [{ label: t('flux', '通量'), answer: cfAnswer }],
      hint: t(
        `On the circle F points along n and |F| = ${cf.k}·${cf.a}: F·n = |F|. The circumference is 2π·${cf.a}.`,
        `在圆上 F 与 n 同向，|F| = ${cf.k}·${cf.a}，所以 F·n = |F|。圆的周长是 2π·${cf.a}。`
      ),
      explanation: t(
        `F = ${cf.k === 1 ? '(x, y)' : `${cf.k}(x, y)`} points radially outward, so F·n = |F| = ${cf.k}·${cf.a}. Then the flux is ${cf.k}·${cf.a}·(2π·${cf.a}) ≈ ${num(cfAnswer)}.`,
        `F = ${cf.k === 1 ? '(x, y)' : `${cf.k}(x, y)`} 沿径向向外，所以 F·n = |F| = ${cf.k}·${cf.a}，通量 = ${cf.k}·${cf.a}·(2π·${cf.a}) ≈ ${num(cfAnswer)}。`
      ),
      figure: g.figure({
        alt: t(`A circle of radius ${cf.a} with an arrow showing counterclockwise travel.`, `半径为 ${cf.a} 的圆，箭头显示逆时针绕行方向。`),
        view: fitView(makeCircleFigure(cf.a, 'ccw'), 0.3),
        shapes: makeCircleFigure(cf.a, 'ccw'),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-46:circle-flux', params: { k: cf.k, a: cf.a } },
    }),
    g.choice({
      id: 'tangential-zero',
      title: t('Tangential field has zero flux', '切向场通量为零'),
      prompt: t(
        `C is the circle of radius ${tz.a} centred at the origin, traversed counterclockwise, with the outward unit normal n. For which of these fields is the flux ∫_C F·n ds equal to 0?`,
        `C 是以原点为圆心、半径为 ${tz.a} 的圆，沿逆时针方向绕行，n 为外法向的单位向量。下面哪个向量场使通量 ∫_C F·n ds 等于 0？`
      ),
      options: [
        t(`F = ${tz.k === 1 ? '(−y, x)' : `${tz.k}(−y, x)`}`, `F = ${tz.k === 1 ? '(−y, x)' : `${tz.k}(−y, x)`}`),
        t(`F = ${tz.k === 1 ? '(x, y)' : `${tz.k}(x, y)`}`, `F = ${tz.k === 1 ? '(x, y)' : `${tz.k}(x, y)`}`),
        t(`F = ${tz.k === 1 ? '(x − y, x + y)' : `${tz.k}(x − y, x + y)`}`, `F = ${tz.k === 1 ? '(x − y, x + y)' : `${tz.k}(x − y, x + y)`}`),
        t(`F = ${tz.k === 1 ? '(x, y)/(x² + y²)' : `${tz.k}(x, y)/(x² + y²)`}`, `F = ${tz.k === 1 ? '(x, y)/(x² + y²)' : `${tz.k}(x, y)/(x² + y²)`}`),
      ],
      correct: 0,
      hint: t(
        'A field that is tangent to the circle everywhere has no component along n.',
        '处处与圆相切的场在 n 方向没有分量。'
      ),
      explanation: t(
        'On the circle the vector (−y, x) is perpendicular to the radius, hence to n, so F·n = 0 at every point and the flux is 0. The other fields all have a radial part, which contributes a nonzero flux.',
        '在圆上，向量 (−y, x) 与半径垂直，也就与 n 垂直，所以处处 F·n = 0，通量为 0。其余各场都含有径向分量，通量不为 0。'
      ),
    }),
    g.symbols({
      id: 'normal-form',
      title: t('Green\'s theorem in normal form', '格林定理的法向形式'),
      prompt: t(
        `C is a counterclockwise simple closed boundary enclosing R, n is its outward unit normal, and F = M i + N j is continuously differentiable on an open set containing R and its boundary. Complete Green's theorem in normal form: ${nfVariant === 0 ? '∮_C M dy − N dx' : '∮_C F·n ds'} = ∬_R [ ] dA.`,
        `C 是逆时针方向的简单闭边界，围成区域 R，n 为其单位外法向量，F = M i + N j 在包含 R 及其边界的开集上连续可微。补全格林定理的法向形式：${nfVariant === 0 ? '∮_C M dy − N dx' : '∮_C F·n ds'} = ∬_R [ ] dA。`
      ),
      before: nfVariant === 0 ? '∮_C M dy − N dx = ∬_R ' : '∮_C F·n ds = ∬_R ',
      between: [],
      after: ' dA',
      answers: [nfVariant === 0 ? '∂M/∂x + ∂N/∂y' : 'div F'],
      tokens: shuffled(g, [
        nfVariant === 0 ? '∂M/∂x + ∂N/∂y' : 'div F',
        nfVariant === 0 ? '∂N/∂x − ∂M/∂y' : 'curl F',
        nfVariant === 0 ? '∂M/∂x − ∂N/∂y' : '|F|',
        nfVariant === 0 ? '−∂M/∂x − ∂N/∂y' : '∇f',
        nfVariant === 0 ? '∂M/∂y + ∂N/∂x' : 'f(x, y)',
      ]),
      hint: t(
        'Write M dy − N dx as − N dx + M dy and apply the standard form of Green\'s theorem.',
        '把 M dy − N dx 写成 − N dx + M dy，再用格林定理的标准形式。'
      ),
      explanation: t(
        'Writing M dy − N dx = (−N) dx + M dy, Green\'s theorem gives ∬_R (M_x − (−N)_y) dA = ∬_R (∂M/∂x + ∂N/∂y) dA. This integrand is div F: it is the source rate, and the total flux across C equals the source rate of R.',
        '把 M dy − N dx 写成 (−N) dx + M dy，由格林定理得 ∬_R (M_x − (−N)_y) dA = ∬_R (∂M/∂x + ∂N/∂y) dA。被积函数就是 div F，即源强；穿过 C 的总通量等于 R 的总源强。'
      ),
    }),
    g.number({
      id: 'square-flux',
      title: t('Flux across a square', '矩形的通量'),
      prompt: t(
        `F = ${fieldExpr(sfq.m, sfq.n)}. C is the boundary of the rectangle with vertices (0, 0), (${sfq.a}, 0), (${sfq.a}, ${sfq.b}), (0, ${sfq.b}), traversed counterclockwise, and n is the outward unit normal. Use the normal form of Green\'s theorem to find the flux ∫_C F·n ds.`,
        `F = ${fieldExpr(sfq.m, sfq.n)}。C 是顶点为 (0, 0)、(${sfq.a}, 0)、(${sfq.a}, ${sfq.b})、(0, ${sfq.b}) 的矩形的边界，沿逆时针方向绕行，n 为外法向的单位向量。用格林定理的法向形式求通量 ∫_C F·n ds。`
      ),
      fields: [{ label: t('flux', '通量'), answer: sfqAnswer }],
      hint: t(
        'Compute div F = ∂M/∂x + ∂N/∂y, then multiply by the area.',
        '先算 div F = ∂M/∂x + ∂N/∂y，再乘以面积。'
      ),
      explanation: t(
        `div F = ${sfq.m} + ${sfq.n} = ${sfq.m + sfq.n} is constant, so the flux is ${sfq.m + sfq.n}·(area ${sfq.a}·${sfq.b}) = ${num(sfqAnswer)}.`,
        `div F = ${sfq.m} + ${sfq.n} = ${sfq.m + sfq.n} 是常数，所以通量 = ${sfq.m + sfq.n}·(面积 ${sfq.a}·${sfq.b}) = ${num(sfqAnswer)}。`
      ),
      figure: g.figure({
        alt: t(`The rectangle with vertices (0, 0), (${sfq.a}, 0), (${sfq.a}, ${sfq.b}), (0, ${sfq.b}).`, `顶点为 (0, 0)、(${sfq.a}, 0)、(${sfq.a}, ${sfq.b})、(0, ${sfq.b}) 的矩形。`),
        view: fitView(makeSquareFigure(sfq.a, sfq.b), 0.3),
        shapes: makeSquareFigure(sfq.a, sfq.b),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-46:square-flux', params: { m: sfq.m, n: sfq.n, a: sfq.a, b: sfq.b } },
    }),
    g.choice({
      id: 'clockwise-sign',
      title: t('Clockwise traversal sign', '顺时针方向的符号'),
      prompt: t(
        `F = ${cs.k === 1 ? '(x, y)' : `${cs.k}(x, y)`}. C is the circle of radius ${cs.a} centred at the origin, now traversed CLOCKWISE, and n is the direction of travel turned clockwise by 90°. What is the flux ∫_C F·n ds?`,
        `F = ${cs.k === 1 ? '(x, y)' : `${cs.k}(x, y)`}。C 是以原点为圆心、半径为 ${cs.a} 的圆，这次沿顺时针方向绕行，n 是把行进方向顺时针旋转 90° 得到的单位法向量。通量 ∫_C F·n ds 是多少？`
      ),
      options: [
        t(`−${num(2 * cs.k * cs.a * cs.a)}π`, `−${num(2 * cs.k * cs.a * cs.a)}π`),
        t(`${num(2 * cs.k * cs.a * cs.a)}π`, `${num(2 * cs.k * cs.a * cs.a)}π`),
        t(`−${num(2 * cs.k * cs.a)}π`, `−${num(2 * cs.k * cs.a)}π`),
        t('0', '0'),
      ],
      correct: 0,
      hint: t(
        'Going clockwise, which way does n point: outward or inward? Compare with the counterclockwise case.',
        '沿顺时针绕行时，n 指向圆外还是圆内？与逆时针的情形比较。'
      ),
      explanation: t(
        `Going clockwise, the tangent turned clockwise by 90° points toward the centre, so n is the inward normal. F points outward, so F·n = −|F| = −${cs.k}·${cs.a}. The flux is −${cs.k}·${cs.a}·(2π·${cs.a}) = −${num(2 * cs.k * cs.a * cs.a)}π, the negative of the counterclockwise value.`,
        `沿顺时针绕行时，把切向量再顺时针旋转 90° 指向圆心，所以 n 是内法向。F 指向圆外，F·n = −|F| = −${cs.k}·${cs.a}，通量 = −${cs.k}·${cs.a}·(2π·${cs.a}) = −${num(2 * cs.k * cs.a * cs.a)}π，是逆时针情形的相反数。`
      ),
      figure: g.figure({
        alt: t(`A circle of radius ${cs.a} with a clockwise arrow.`, `半径为 ${cs.a} 的圆，顺时针箭头。`),
        view: fitView(makeCircleFigure(cs.a, 'cw'), 0.3),
        shapes: makeCircleFigure(cs.a, 'cw'),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: flux across a diagonal segment', '挑战：对角线段通量'),
      prompt: t(
        `F = (${coef(ch.p, 'y')}) i + (${coef(ch.q, 'x')}) j. C is the line segment from (${ch.c}, 0) to (0, ${ch.d}), traversed in that direction, and n is the direction of travel turned clockwise by 90°. Find the flux ∫_C F·n ds.`,
        `F = (${coef(ch.p, 'y')}) i + (${coef(ch.q, 'x')}) j。C 是从 (${ch.c}, 0) 到 (0, ${ch.d}) 的线段，沿此方向行进，n 是把行进方向顺时针旋转 90° 得到的单位法向量。求通量 ∫_C F·n ds。`
      ),
      fields: [{ label: t('flux', '通量'), answer: chAnswer }],
      hint: t(
        `Parametrize x = ${ch.c === 1 ? '1 − t' : `${ch.c}(1 − t)`}, y = ${coef(ch.d, 't')} and use ∫ M dy − N dx.`,
        `取 x = ${ch.c === 1 ? '1 − t' : `${ch.c}(1 − t)`}，y = ${coef(ch.d, 't')}，并用 ∫ M dy − N dx。`
      ),
      explanation: t(
        `With x = ${ch.c === 1 ? '1 − t' : `${ch.c}(1 − t)`}, y = ${coef(ch.d, 't')}: M dy = ${ch.p}·${coef(ch.d, 't')}·${ch.d} dt and −N dx = −${ch.q}·${ch.c}·(1 − t)·(−${ch.c}) dt = ${ch.q}·${ch.c}²(1 − t) dt. Integrating from 0 to 1 gives ${ch.p}·${ch.d}²/2 + ${ch.q}·${ch.c}²/2 = ${num(chAnswer)}. This game does not ask you to prove Green's theorem, to compute flux across surfaces in space, or to integrate along curves other than circles and line segments.`,
        `取 x = ${ch.c === 1 ? '1 − t' : `${ch.c}(1 − t)`}，y = ${coef(ch.d, 't')}：M dy = ${ch.p}·${coef(ch.d, 't')}·${ch.d} dt，−N dx = −${ch.q}·${ch.c}·(1 − t)·(−${ch.c}) dt = ${ch.q}·${ch.c}²(1 − t) dt。在 0 到 1 上积分得 ${ch.p}·${ch.d}²/2 + ${ch.q}·${ch.c}²/2 = ${num(chAnswer)}。本游戏不要求证明格林定理，不涉及空间曲面的通量，也不要求对圆和线段以外的曲线做积分。`
      ),
      figure: g.figure({
        alt: t(`The line segment from (${ch.c}, 0) to (0, ${ch.d}).`, `从 (${ch.c}, 0) 到 (0, ${ch.d}) 的线段。`),
        view: fitView([
          { kind: 'line', points: [[ch.c, 0], [0, ch.d]], tone: 'accent', width: 2 },
          { kind: 'arrow', from: [ch.c * 0.8, ch.d * 0.2], to: [ch.c * 0.6, ch.d * 0.4], tone: 'accent2', width: 2 },
          { kind: 'point', at: [ch.c, 0], tone: 'muted' },
          { kind: 'point', at: [0, ch.d], tone: 'muted' },
        ], 0.3),
        shapes: [
          { kind: 'line', points: [[ch.c, 0], [0, ch.d]], tone: 'accent', width: 2 },
          { kind: 'arrow', from: [ch.c * 0.8, ch.d * 0.2], to: [ch.c * 0.6, ch.d * 0.4], tone: 'accent2', width: 2 },
          { kind: 'point', at: [ch.c, 0], tone: 'muted' },
          { kind: 'point', at: [0, ch.d], tone: 'muted' },
        ],
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-46:challenge', params: { p: ch.p, q: ch.q, c: ch.c, d: ch.d } },
    }),
  ];
};
