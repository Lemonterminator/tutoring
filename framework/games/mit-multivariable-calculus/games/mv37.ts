import type { CardGenerator } from '../../types';
import { fitView, type FigureShape } from '../../figure';
import { frac, linear, makeMvDeck, num, par, type Text } from '../support';

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

export const mv37: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-37');
  warm(g);

  // jac-sign
  const js = retry(() => ({ a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]), c: g.pick([1, 2, 3]), d: g.pick([1, 2, 3]) }), v => v.a * v.d - v.b * v.c !== 0);
  const jsAns = js.a * js.d - js.b * js.c;

  // area-element
  const J = g.pick([-1 / 2, -2, -3, -4, -5, -6, -8]);
  const q = Math.abs(J);

  // reciprocal
  const rc = retry(() => ({ p: g.pick([1, 2, 3]), q: g.pick([1, 2, 3]), r: g.pick([1, 2, 3]), s: g.pick([1, 2, 3]) }), v => Math.abs(v.p * v.s - v.q * v.r) >= 2);
  const rcD = rc.p * rc.s - rc.q * rc.r;
  const rcAns = 1 / rcD;

  // region-image
  const sRI = g.pick([1, 2, 3, 4, 5, 6]);

  // polar-check
  const pc = g.pick([[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5], [8, 15], [15, 8]]);
  const pcR = Math.sqrt(pc[0] ** 2 + pc[1] ** 2);
  const pcAns = 1 / pcR;

  // sub-area
  const sa = g.pick([[5, 3], [5, 4], [13, 5], [13, 12], [17, 8], [17, 15]]);
  const saW = Math.sqrt(sa[0] ** 2 - sa[1] ** 2);
  const saAns = sa[0] / saW;

  // setup
  const sSU = g.pick([1, 2]);
  const pSU = g.pick([2, 4, 6]);
  const sup = pSU === 2 ? '²' : pSU === 4 ? '⁴' : '⁶';
  const integSU = `u${sup}/2`;

  // square-integral
  const sSI = g.pick([1, 2]);
  const pSI = g.pick([2, 4, 6]);
  const siAns = 2 * sSI ** (pSI + 2) / (pSI + 1);

  // challenge
  const mCH = g.pick([2, 4]);
  const nCH = g.pick([2, 3, 4]);
  const I2 = 2 / 3, I3 = 4 / 9, I4 = 26 / 81;
  const In = nCH === 2 ? I2 : nCH === 3 ? I3 : I4;
  const chAns = In / (mCH + 1);

  const diamondShapes = (s: number): FigureShape[] => {
    const pts: [number, number][] = [[s, 0], [0, s], [-s, 0], [0, -s], [s, 0]];
    return [
      { kind: 'area', points: pts, tone: 'accent', opacity: 0.25 },
      { kind: 'line', points: pts, tone: 'accent', width: 2 },
      { kind: 'point', at: [s, 0], tone: 'accent' },
      { kind: 'point', at: [0, s], tone: 'accent' },
      { kind: 'point', at: [-s, 0], tone: 'accent' },
      { kind: 'point', at: [0, -s], tone: 'accent' },
      { kind: 'text', at: [s + 0.2, 0], text: `(${s}, 0)`, anchor: 'start' },
      { kind: 'text', at: [0, s + 0.2], text: `(0, ${s})`, anchor: 'middle' },
      { kind: 'text', at: [-s - 0.2, 0], text: `(${-s}, 0)`, anchor: 'end' },
      { kind: 'text', at: [0, -s - 0.2], text: `(0, ${-s})`, anchor: 'middle' },
    ];
  };

  return [
    g.number({
      id: 'jac-sign',
      title: t('Jacobian sign', '雅可比行列式的符号'),
      prompt: t(`A change of variables is x = ${linear([js.a, js.b], ['u', 'v'])}, y = ${linear([js.c, js.d], ['u', 'v'])}. Find the Jacobian ∂(x, y)/∂(u, v), keeping its sign.`,
        `换元为 x = ${linear([js.a, js.b], ['u', 'v'])}，y = ${linear([js.c, js.d], ['u', 'v'])}。求雅可比行列式 ∂(x, y)/∂(u, v)，保留符号。`),
      fields: [{ label: t('∂(x, y)/∂(u, v)', '∂(x, y)/∂(u, v)'), answer: jsAns }],
      hint: t('The Jacobian is the determinant with rows (x_u, x_v) and (y_u, y_v).', '雅可比行列式是以 (x_u, x_v) 与 (y_u, y_v) 为两行的行列式。'),
      explanation: t(`x_u = ${js.a}, x_v = ${js.b}, y_u = ${js.c}, y_v = ${js.d}, so ∂(x, y)/∂(u, v) = ${js.a}·${js.d} − ${js.b}·${js.c} = ${num(jsAns)}.`,
        `x_u = ${js.a}，x_v = ${js.b}，y_u = ${js.c}，y_v = ${js.d}，所以 ∂(x, y)/∂(u, v) = ${js.a}·${js.d} − ${js.b}·${js.c} = ${num(jsAns)}。`),
      audit: { kind: 'MIT-MV-37:jac-sign', params: { a: js.a, b: js.b, c: js.c, d: js.d } },
    }),
    g.choice({
      id: 'area-element',
      title: t('Area element', '面积元'),
      prompt: t(`A change of variables has ∂(x, y)/∂(u, v) = ${num(J)} everywhere. Areas are positive. Which formula gives the area element dA in the uv-system?`,
        `某个换元满足 ∂(x, y)/∂(u, v) = ${num(J)}（处处如此）。面积为正。哪个公式给出 uv 坐标系下的面积元 dA？`),
      options: [
        t(`dA = ${num(q)} du dv`, `dA = ${num(q)} du dv`),
        t(`dA = −${num(q)} du dv`, `dA = −${num(q)} du dv`),
        t(`dA = ${num(1 / q)} du dv`, `dA = ${num(1 / q)} du dv`),
        t('dA = du dv', 'dA = du dv'),
      ],
      correct: 0,
      hint: t('The Jacobian may be negative, but an area is not.', '雅可比行列式可以为负，面积不可以。'),
      explanation: t(`The area element uses the absolute value: dA = |${num(J)}| du dv = ${num(q)} du dv. A negative J only reflects the orientation.`,
        `面积元要取绝对值：dA = |${num(J)}| du dv = ${num(q)} du dv。J 为负只表示方向反转。`),
    }),
    g.number({
      id: 'reciprocal',
      title: t('Reciprocal Jacobian', '雅可比行列式的倒数'),
      prompt: t(`New coordinates are u = ${linear([rc.p, rc.q], ['x', 'y'])}, v = ${linear([rc.r, rc.s], ['x', 'y'])}. Without solving for x and y, use ∂(x, y)/∂(u, v) = 1/(∂(u, v)/∂(x, y)) to find ∂(x, y)/∂(u, v). Enter an integer or a fraction.`,
        `新坐标为 u = ${linear([rc.p, rc.q], ['x', 'y'])}，v = ${linear([rc.r, rc.s], ['x', 'y'])}。不要解出 x、y，利用 ∂(x, y)/∂(u, v) = 1/(∂(u, v)/∂(x, y)) 求 ∂(x, y)/∂(u, v)（填整数或分数）。`),
      fields: [{ label: t('∂(x, y)/∂(u, v)', '∂(x, y)/∂(u, v)'), answer: rcAns }],
      hint: t('First find ∂(u, v)/∂(x, y), which only needs the given formulas.', '先求 ∂(u, v)/∂(x, y)，只需要已给的公式。'),
      explanation: t(`∂(u, v)/∂(x, y) = ${rc.p}·${rc.s} − ${rc.q}·${rc.r} = ${num(rcD)}, so ∂(x, y)/∂(u, v) = 1/${par(rcD)}${frac(1, rcD) === `1/${rcD}` ? '' : ` = ${frac(1, rcD)}`}.`,
        `∂(u, v)/∂(x, y) = ${rc.p}·${rc.s} − ${rc.q}·${rc.r} = ${num(rcD)}，所以 ∂(x, y)/∂(u, v) = 1/${par(rcD)}${frac(1, rcD) === `1/${rcD}` ? '' : ` = ${frac(1, rcD)}`}。`),
      audit: { kind: 'MIT-MV-37:reciprocal', params: { p: rc.p, q: rc.q, r: rc.r, s: rc.s } },
    }),
    g.choice({
      id: 'region-image',
      title: t('Image of a square', '正方形的像区域'),
      prompt: t(`The square with vertices (${sRI}, 0), (0, ${sRI}), (−${sRI}, 0), (0, −${sRI}) is mapped by u = x + y, v = x − y. Which description of its image in the uv-plane is correct?`,
        `顶点为 (${sRI}, 0)、(0, ${sRI})、(−${sRI}, 0)、(0, −${sRI}) 的正方形在 u = x + y，v = x − y 下的像区域是下列哪一个？`),
      figure: g.figure({
        alt: t(`The square with vertices (${sRI}, 0), (0, ${sRI}), (−${sRI}, 0), (0, −${sRI}).`, `顶点为 (${sRI}, 0)、(0, ${sRI})、(−${sRI}, 0)、(0, −${sRI}) 的正方形。`),
        view: fitView(diamondShapes(sRI), 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: diamondShapes(sRI),
      }),
      options: [
        t(`−${sRI} ≤ u ≤ ${sRI} and −${sRI} ≤ v ≤ ${sRI}`, `−${sRI} ≤ u ≤ ${sRI}，−${sRI} ≤ v ≤ ${sRI}`),
        t(`−${sRI}√2 ≤ u ≤ ${sRI}√2 and −${sRI}√2 ≤ v ≤ ${sRI}√2`, `−${sRI}√2 ≤ u ≤ ${sRI}√2，−${sRI}√2 ≤ v ≤ ${sRI}√2`),
        t(`0 ≤ u ≤ ${sRI} and 0 ≤ v ≤ ${sRI}`, `0 ≤ u ≤ ${sRI}，0 ≤ v ≤ ${sRI}`),
        t(`u² + v² ≤ ${sRI}²`, `u² + v² ≤ ${sRI}²`),
      ],
      correct: 0,
      hint: t(`Find the lines x + y = ±${sRI} and x − y = ±${sRI} that bound the square, and rewrite them in u and v.`, `找出围成正方形的直线 x + y = ±${sRI} 与 x − y = ±${sRI}，再用 u、v 改写。`),
      explanation: t(`The sides are x + y = ±${sRI} and x − y = ±${sRI}, i.e. u = ±${sRI} and v = ±${sRI}. The vertex (${sRI}, 0) goes to (u, v) = (${sRI}, ${sRI}). The image is the square −${sRI} ≤ u ≤ ${sRI}, −${sRI} ≤ v ≤ ${sRI}.`,
        `四条边是 x + y = ±${sRI} 与 x − y = ±${sRI}，即 u = ±${sRI}，v = ±${sRI}。顶点 (${sRI}, 0) 变为 (u, v) = (${sRI}, ${sRI})。像区域是正方形 −${sRI} ≤ u ≤ ${sRI}，−${sRI} ≤ v ≤ ${sRI}。`),
    }),
    g.number({
      id: 'polar-check',
      title: t('Jacobian of polar coordinates', '极坐标的雅可比行列式'),
      prompt: t(`Let r = √(x² + y²) and θ = tan⁻¹(y/x). Find ∂(r, θ)/∂(x, y) at the point (${pc[0]}, ${pc[1]}). Enter an integer or a fraction.`,
        `设 r = √(x² + y²)，θ = tan⁻¹(y/x)。求 ∂(r, θ)/∂(x, y) 在点 (${pc[0]}, ${pc[1]}) 处的值（填整数或分数）。`),
      fields: [{ label: t('∂(r, θ)/∂(x, y)', '∂(r, θ)/∂(x, y)'), answer: pcAns }],
      hint: t('r is the distance from the origin to the point.', 'r 是该点到原点的距离。'),
      explanation: t(`At (${pc[0]}, ${pc[1]}) we have r = ${num(pcR)}, and ∂(r, θ)/∂(x, y) = 1/r = ${frac(1, pcR)}, the reciprocal of ∂(x, y)/∂(r, θ) = r.`,
        `在 (${pc[0]}, ${pc[1]}) 处 r = ${num(pcR)}，∂(r, θ)/∂(x, y) = 1/r = ${frac(1, pcR)}，它是 ∂(x, y)/∂(r, θ) = r 的倒数。`),
      audit: { kind: 'MIT-MV-37:polar-check', params: { x0: pc[0], y0: pc[1] } },
    }),
    g.number({
      id: 'sub-area',
      title: t('Area factor', '面积因子'),
      prompt: t(`For the change of variables x = u, y = √(r² − u²) we have dx dy = (factor) du dr, where factor = |∂(x, y)/∂(u, r)|. Find the factor when r = ${sa[0]} and u = ${sa[1]}.`,
        `对换元 x = u，y = √(r² − u²)，有 dx dy = (因子) du dr，其中因子 = |∂(x, y)/∂(u, r)|。当 r = ${sa[0]}，u = ${sa[1]} 时求这个因子。`),
      fields: [{ label: t('factor', '因子'), answer: saAns }],
      hint: t('Take the determinant with rows (x_u, x_r) and (y_u, y_r).', '取以 (x_u, x_r) 与 (y_u, y_r) 为两行的行列式。'),
      explanation: t(`x_u = 1, x_r = 0, so the determinant is y_r = r/√(r² − u²). With r = ${sa[0]}, u = ${sa[1]}: ${sa[0]}/√(${sa[0]}² − ${sa[1]}²) = ${sa[0]}/${saW}${frac(sa[0], saW) === `${sa[0]}/${saW}` ? '' : ` = ${frac(sa[0], saW)}`}.`,
        `x_u = 1，x_r = 0，所以行列式等于 y_r = r/√(r² − u²)。当 r = ${sa[0]}，u = ${sa[1]} 时：${sa[0]}/√(${sa[0]}² − ${sa[1]}²) = ${sa[0]}/${saW}${frac(sa[0], saW) === `${sa[0]}/${saW}` ? '' : ` = ${frac(sa[0], saW)}`}。`),
      audit: { kind: 'MIT-MV-37:sub-area', params: { r: sa[0], u: sa[1] } },
    }),
    g.symbols({
      id: 'setup',
      title: t('Set up the integral', '写出积分'),
      prompt: t(`R is the square with vertices (${sSU}, 0), (0, ${sSU}), (−${sSU}, 0), (0, −${sSU}). With u = x + y, v = x − y we have ∂(x, y)/∂(u, v) = −1/2. Fill in ∬_R (x + y)^${pSU} dA = ∫∫ [ ] du dv over [ ] ≤ u ≤ [ ], [ ] ≤ v ≤ [ ].`,
        `R 是顶点为 (${sSU}, 0)、(0, ${sSU})、(−${sSU}, 0)、(0, −${sSU}) 的正方形。令 u = x + y，v = x − y，则 ∂(x, y)/∂(u, v) = −1/2。把 ∬_R (x + y)^${pSU} dA 写成 ∫∫ [ ] du dv，积分区域 [ ] ≤ u ≤ [ ]，[ ] ≤ v ≤ [ ]。`),
      figure: g.figure({
        alt: t(`The square with vertices (${sSU}, 0), (0, ${sSU}), (−${sSU}, 0), (0, −${sSU}).`, `顶点为 (${sSU}, 0)、(0, ${sSU})、(−${sSU}, 0)、(0, −${sSU}) 的正方形。`),
        view: fitView(diamondShapes(sSU), 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: diamondShapes(sSU),
      }),
      before: '∫∫ ', between: [' du dv over ', ' ≤ u ≤ ', ' , ', ' ≤ v ≤ '],
      after: '',
      answers: [integSU, `−${sSU}`, `${sSU}`, `−${sSU}`, `${sSU}`],
      tokens: shuffled(g, ['0', `−${sSU}`, `${sSU}`, `${2 * sSU}`, integSU, `u${sup}`, `−u${sup}/2`, `2u${sup}`]),
      hint: t(`Step A: x + y = u. Step B: dA = |−1/2| du dv. Step C: the sides are u = ±${sSU}, v = ±${sSU}.`, `步骤 A：x + y = u。步骤 B：dA = |−1/2| du dv。步骤 C：各边为 u = ±${sSU}，v = ±${sSU}。`),
      explanation: t(`(x + y)^${pSU} becomes u${sup}, dA becomes (1/2) du dv, and both u and v run from −${sSU} to ${sSU}. The integrand is u${sup}/2.`,
        `(x + y)^${pSU} 变为 u${sup}，dA 变为 (1/2) du dv，u 与 v 都从 −${sSU} 积到 ${sSU}。被积函数是 u${sup}/2。`),
    }),
    g.number({
      id: 'square-integral',
      title: t('Evaluate the integral', '计算积分'),
      prompt: t(`Evaluate ∬_R (x + y)^${pSI} dA over the square R with vertices (${sSI}, 0), (0, ${sSI}), (−${sSI}, 0), (0, −${sSI}). Enter an integer or a fraction.`,
        `计算 ∬_R (x + y)^${pSI} dA，其中 R 是顶点为 (${sSI}, 0)、(0, ${sSI})、(−${sSI}, 0)、(0, −${sSI}) 的正方形（填整数或分数）。`),
      figure: g.figure({
        alt: t(`The square with vertices (${sSI}, 0), (0, ${sSI}), (−${sSI}, 0), (0, −${sSI}).`, `顶点为 (${sSI}, 0)、(0, ${sSI})、(−${sSI}, 0)、(0, −${sSI}) 的正方形。`),
        view: fitView(diamondShapes(sSI), 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: diamondShapes(sSI),
      }),
      fields: [{ label: t('I', 'I'), answer: siAns }],
      hint: t('Use u = x + y, v = x − y and dA = (1/2) du dv.', '用 u = x + y，v = x − y，dA = (1/2) du dv。'),
      explanation: t(`I = (1/2)·∫_{−${sSI}}^${sSI} u${pSI === 2 ? '²' : pSI === 4 ? '⁴' : '⁶'} du · ∫_{−${sSI}}^${sSI} dv = (1/2)·(2·${sSI}^${pSI + 1}/${pSI + 1})·(2·${sSI}) = ${frac(2 * sSI ** (pSI + 2), pSI + 1)}.`,
        `I = (1/2)·∫_{−${sSI}}^${sSI} u${pSI === 2 ? '²' : pSI === 4 ? '⁴' : '⁶'} du · ∫_{−${sSI}}^${sSI} dv = (1/2)·(2·${sSI}^${pSI + 1}/${pSI + 1})·(2·${sSI}) = ${frac(2 * sSI ** (pSI + 2), pSI + 1)}。`),
      audit: { kind: 'MIT-MV-37:square-integral', params: { s: sSI, p: pSI } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge integral', '挑战积分'),
      prompt: t(`Evaluate ∬_R (x + y)^${mCH}/(2 − x + y)^${nCH} dx dy, where R is the square with vertices (1, 0), (0, 1), (−1, 0), (0, −1). Enter an integer or a fraction.`,
        `计算 ∬_R (x + y)^${mCH}/(2 − x + y)^${nCH} dx dy，其中 R 是顶点为 (1, 0)、(0, 1)、(−1, 0)、(0, −1) 的正方形（填整数或分数）。`),
      figure: g.figure({
        alt: t('The square with vertices (1, 0), (0, 1), (−1, 0), (0, −1).', '顶点为 (1, 0)、(0, 1)、(−1, 0)、(0, −1) 的正方形。'),
        view: fitView(diamondShapes(1), 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: diamondShapes(1),
      }),
      fields: [{ label: t('I', 'I'), answer: chAns }],
      hint: t('The square is bounded by x + y = ±1 and x − y = ±1.', '正方形由 x + y = ±1 与 x − y = ±1 围成。'),
      explanation: t(`With u = x + y, v = x − y: I = (1/2)∫_{−1}^{1} u${mCH === 2 ? '²' : '⁴'} du · ∫_{−1}^{1} (2 − v)^{−${nCH}} dv = (1/2)·(2/${mCH + 1})·${frac(nCH === 2 ? 2 : nCH === 3 ? 4 : 26, nCH === 2 ? 3 : nCH === 3 ? 9 : 81)} = ${frac(nCH === 2 ? 2 : nCH === 3 ? 4 : 26, (nCH === 2 ? 3 : nCH === 3 ? 9 : 81) * (mCH + 1))}. The integrand is positive, so the value is positive. This game does not assess deriving the Jacobian formula or regions that are not bounded by level curves of u and v.`,
        `取 u = x + y，v = x − y：I = (1/2)∫_{−1}^{1} u${mCH === 2 ? '²' : '⁴'} du · ∫_{−1}^{1} (2 − v)^{−${nCH}} dv = (1/2)·(2/${mCH + 1})·${frac(nCH === 2 ? 2 : nCH === 3 ? 4 : 26, nCH === 2 ? 3 : nCH === 3 ? 9 : 81)} = ${frac(nCH === 2 ? 2 : nCH === 3 ? 4 : 26, (nCH === 2 ? 3 : nCH === 3 ? 9 : 81) * (mCH + 1))}。被积函数为正，所以结果为正。本游戏不考查雅可比公式的推导，也不考查边界不是 u、v 等值线的区域。`),
      audit: { kind: 'MIT-MV-37:challenge', params: { m: mCH, n: nCH } },
    }),
  ];
};
