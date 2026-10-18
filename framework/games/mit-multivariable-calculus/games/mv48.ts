import type { CardGenerator } from '../../types';
import { ellipse, fitView, graphOf, rect, sampleCurve, type FigureShape, type Pt } from '../../figure';
import { coef, frac, makeMvDeck, num, par, power, term, type Text } from '../support';

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

export const mv48: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-48');
  warm(g);

  // com-setup
  const cs = { k: g.pick([1, 2, 3]), h: g.pick([1, 2, 3]) };
  const csA = cs.k * cs.h * cs.h;
  const csLx = `${coef(cs.k, 'y')} − ${cs.k * cs.h}`;
  const csRx = `${cs.k * cs.h} − ${coef(cs.k, 'y')}`;
  const csTokens = shuffled(g, [
    '0', String(cs.h), csLx, csRx,
    `${coef(cs.k, 'y')}`, `−${coef(cs.k, 'y')}`, String(cs.k * cs.h), `−${cs.k * cs.h}`
  ]);

  // polar-inertia
  const pi = { R: g.pick([1, 2]), k: g.pick([1, 2, 3]), axis: g.pick(['x', 'y']) };
  const piAns = 4 * pi.k * Math.pow(pi.R, 5) / 5;
  // |x| = r|cos θ| for the distance to the y-axis, |y| = r|sin θ| for the distance to the x-axis
  const piTrig = pi.axis === 'x' ? 'cos θ' : 'sin θ';

  // conservative, potential, path-value
  const cv = { c: g.pick([1, 2, 3]), q: g.pick([1, 2, 3]), p: g.pick([1, 2, 3]), r: g.pick([1, 2, 3]) };
  const cvA = 3 * cv.q;
  const cvB = 3 * cv.c;
  const pv = { s: g.pick([1, 2]), t: g.pick([1, 2]) };
  const pvAns = cv.q * Math.pow(pv.s, 3) * pv.t + cv.c * pv.s * Math.pow(pv.t, 3) + cv.p * pv.s + cv.r * pv.t;

  // check-conservative
  const cc = { m: g.pick([1, 2, 3]), cons: g.pick([true, false]) };

  // line-int
  const li = { m: g.pick([1, 2, 3]), j: g.pick([2, 3]) };
  const liAns = 1 / (li.m + li.j + 1) + 1 / 3;

  // jacobian
  const jb = { a: g.pick([2, 3, 4, 5]), arr: g.pick([1, 2]) };

  // green-m
  const gm = { p: g.pick([1, 2, 3]), a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]) };
  const gmAns = -gm.p * gm.a * gm.b * gm.b;

  // flux-green, flux-side
  const fg = { k: g.pick([1, 2, 3]), c: g.pick([1, 2]), e: g.pick([1, 2, 3]) };
  const fgAns = fg.k * Math.pow(fg.c, 2 * fg.e + 1) / (2 * fg.e + 1);
  const fsAns = fgAns + fg.c;

  // challenge
  const ch = { e: g.pick([2, 3]), p: g.pick([1, 2, 3]), q: g.pick([1, 2, 3]) };
  const chAns = (ch.p + ch.q) * (ch.e - 1) / (2 * (ch.e + 1));

  // Figures
  const csShapes: FigureShape[] = [
    { kind: 'area', points: [[-cs.k * cs.h, 0], [0, cs.h], [cs.k * cs.h, 0]], tone: 'accent', opacity: 0.25 },
    { kind: 'line', points: [[-cs.k * cs.h, 0], [0, cs.h], [cs.k * cs.h, 0], [-cs.k * cs.h, 0]], tone: 'accent', width: 2 },
  ];

  const piShapes: FigureShape[] = [
    { kind: 'area', points: ellipse(0, 0, pi.R, pi.R), tone: 'accent', opacity: 0.2 },
    { kind: 'text', at: [pi.R / 2, 0], text: `R = ${pi.R}`, tone: 'text' },
  ];

  const liShapes: FigureShape[] = [
    { kind: 'line', points: sampleCurve((x: number) => [x, Math.pow(x, li.j)], 0, 1), tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'accent' },
    { kind: 'point', at: [1, 1], tone: 'accent' },
  ];

  const gmShapes: FigureShape[] = [
    { kind: 'area', points: rect(0, 0, gm.a, gm.b), tone: 'accent', opacity: 0.2 },
    { kind: 'line', points: [...rect(0, 0, gm.a, gm.b), [0, 0]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [gm.a / 2, 0], to: [gm.a / 2 + 0.1, 0], tone: 'accent' },
    { kind: 'arrow', from: [gm.a, gm.b / 2], to: [gm.a, gm.b / 2 + 0.1], tone: 'accent' },
    { kind: 'arrow', from: [gm.a / 2, gm.b], to: [gm.a / 2 - 0.1, gm.b], tone: 'accent' },
    { kind: 'arrow', from: [0, gm.b / 2], to: [0, gm.b / 2 - 0.1], tone: 'accent' },
  ];

  const fgCurve = sampleCurve((x: number) => [x, Math.pow(x, fg.e)], 0, fg.c);
  const fgSlope = fg.e * Math.pow(fg.c / 2, fg.e - 1), fgNorm = Math.sqrt(1 + fgSlope * fgSlope);
  const fgShapes: FigureShape[] = [
    { kind: 'area', points: [
      [0, 0], [fg.c, 0],
      ...fgCurve.reverse(),
      [0, 0]
    ], tone: 'accent', opacity: 0.2 },
    { kind: 'line', points: [[0, 0], [fg.c, 0]], tone: 'accent', width: 2 },
    { kind: 'line', points: [[fg.c, 0], [fg.c, Math.pow(fg.c, fg.e)]], tone: 'accent', width: 2 },
    { kind: 'line', points: fgCurve, tone: 'accent', width: 2 },
    { kind: 'arrow', from: [fg.c / 2, 0], to: [fg.c / 2, -0.1], tone: 'warn' },
    { kind: 'arrow', from: [fg.c, Math.pow(fg.c, fg.e) / 2], to: [fg.c + 0.1, Math.pow(fg.c, fg.e) / 2], tone: 'warn' },
    { kind: 'arrow', from: [fg.c / 2, Math.pow(fg.c / 2, fg.e)], to: [fg.c / 2 - 0.12 * fgSlope / fgNorm, Math.pow(fg.c / 2, fg.e) + 0.12 / fgNorm], tone: 'warn' },
  ];

  const chCurve = sampleCurve((x: number) => [x, Math.pow(x, ch.e)], 0, 1);
  const chShapes: FigureShape[] = [
    { kind: 'area', points: [
      [0, 0], [1, 1],
      ...chCurve.reverse(),
      [0, 0]
    ], tone: 'accent', opacity: 0.2 },
    { kind: 'line', points: [[0, 0], [1, 1]], tone: 'accent', width: 2 },
    { kind: 'line', points: chCurve, tone: 'accent', width: 2 },
  ];

  // Text helpers
  const fStr = (c: number, q: number, p: number, r: number, a: number, b: number): string => {
    const M = `${coef(a, 'x²y')} + ${coef(c, 'y³')} + ${num(p)}`;
    const N = `${coef(q, 'x³')} + ${coef(b, 'xy²')} + ${num(r)}`;
    return `(${M}) i + (${N}) j`;
  };

  const fStrNoAB = (c: number, q: number, p: number, r: number): string => {
    const M = `${coef(3 * q, 'x²y')} + ${coef(c, 'y³')} + ${num(p)}`;
    const N = `${coef(q, 'x³')} + ${coef(3 * c, 'xy²')} + ${num(r)}`;
    return `(${M}) i + (${N}) j`;
  };

  const potTerms = [
    coef(cv.q, 'x³y'),
    coef(cv.c, 'xy³'),
    coef(cv.p, 'x'),
    coef(cv.r, 'y')
  ];
  const potTokens = shuffled(g, [
    ...potTerms,
    coef(3 * cv.q, 'x³y'),
    coef(3 * cv.c, 'xy³'),
    coef(cv.p, 'xy'),
    coef(cv.r, 'xy')
  ]);

  const ccF = cc.cons
    ? `${coef(1, power('x', cc.m))}y i + ${frac(1, cc.m + 1)}${power('x', cc.m + 1)} j`
    : `${coef(1, power('x', cc.m))}y i + y² j`;

  const jbW = jb.arr === 1 ? 'u' : 'v';
  const jbU = jb.arr === 1 ? `${power('x', jb.a)}/y` : 'xy';
  const jbV = jb.arr === 1 ? 'xy' : `${power('x', jb.a)}/y`;
  const jbOpts = [
    `dx dy = (1/(${jb.a + 1}${jbW})) du dv`,
    `dx dy = ${jb.a + 1}${jbW} du dv`,
    `dx dy = (1/(${jb.a - 1 === 1 ? '' : jb.a - 1}${jbW})) du dv`,
    `dx dy = du dv`
  ];

  return [
    g.symbols({
      id: 'com-setup',
      title: t('Centre of mass setup', '质心积分设置'),
      prompt: t(
        `Let (x̄, ȳ) be the centre of mass of the triangle with vertices (${num(-cs.k * cs.h)}, 0), (0, ${cs.h}), (${cs.k * cs.h}, 0) and uniform density δ = 1. Its area is A = ${csA}. Fill in the limits (outer variable y, inner variable x): ȳ = (1/${csA}) ∫_{y = [ ]}^{[ ]} ∫_{x = [ ]}^{[ ]} y dx dy.`,
        `设三角形的顶点为 (${num(-cs.k * cs.h)}, 0)、(0, ${cs.h})、(${cs.k * cs.h}, 0)，密度均匀 δ = 1，质心为 (x̄, ȳ)，面积 A = ${csA}。填写积分限（外层变量 y，内层变量 x）：ȳ = (1/${csA}) ∫_{y = [ ]}^{[ ]} ∫_{x = [ ]}^{[ ]} y dx dy。`
      ),
      before: '∫_{y = ',
      between: ['}^{', '} ∫_{x = ', '}^{'],
      after: '} y dx dy',
      answers: ['0', String(cs.h), csLx, csRx],
      tokens: csTokens,
      hint: t('Slice horizontally. At height y the triangle runs from its left edge to its right edge: write the left edge as x in terms of y.', '水平切片。在高度 y 处，三角形从左边缘延伸到右边缘：把左边缘写成 x 关于 y 的函数。'),
      explanation: t(
        `The left edge goes from (${num(-cs.k * cs.h)}, 0) to (0, ${cs.h}), so x = ${csLx}; by symmetry the right edge is x = ${csRx}. The triangle covers heights y from 0 to ${cs.h}.`,
        `左边缘从 (${num(-cs.k * cs.h)}, 0) 到 (0, ${cs.h})，所以 x = ${csLx}；由对称性右边缘是 x = ${csRx}。三角形覆盖的高度是 y 从 0 到 ${cs.h}。`
      ),
      figure: g.figure({
        alt: t(`Triangle with vertices (${num(-cs.k * cs.h)}, 0), (0, ${cs.h}), (${cs.k * cs.h}, 0).`, `三角形顶点为 (${num(-cs.k * cs.h)}, 0)、(0, ${cs.h})、(${cs.k * cs.h}, 0)。`),
        view: fitView(csShapes, 0.25),
        shapes: csShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
    }),
    g.number({
      id: 'polar-inertia',
      title: t('Polar moment of inertia', '极转动惯量'),
      prompt: t(
        `A disc of radius ${pi.R} centred at the origin has density δ = ${coef(pi.k, pi.axis === 'x' ? '|x|' : '|y|')}, which is ${pi.k === 1 ? 'the' : `${pi.k} times the`} distance from the ${pi.axis === 'x' ? 'y-axis' : 'x-axis'}. Its polar moment of inertia is I₀ = ∬_D r²·δ dA. Find I₀.`,
        `以原点为圆心、半径为 ${pi.R} 的圆盘，密度 δ = ${coef(pi.k, pi.axis === 'x' ? '|x|' : '|y|')}，即到 ${pi.axis === 'x' ? 'y 轴' : 'x 轴'} 的距离${pi.k === 1 ? '' : `的 ${pi.k} 倍`}。它的极转动惯量 I₀ = ∬_D r²·δ dA。求 I₀。`
      ),
      fields: [{ label: t('I₀', 'I₀'), answer: piAns }],
      hint: t(`Use polar coordinates: ${pi.axis === 'x' ? 'x = r cos θ' : 'y = r sin θ'}, so δ = ${pi.k === 1 ? '' : pi.k}r|${piTrig}|; the θ-integral of |${piTrig}| over a full turn is 4.`, `用极坐标：${pi.axis === 'x' ? 'x = r cos θ' : 'y = r sin θ'}，所以 δ = ${pi.k === 1 ? '' : pi.k}r|${piTrig}|；|${piTrig}| 在一整圈上的积分是 4。`),
      explanation: t(
        `I₀ = ∫₀^{2π}∫₀^{${pi.R}} r²·${pi.k === 1 ? '' : pi.k}r|${piTrig}|·r dr dθ = ${pi.k === 1 ? '' : pi.k + '·'}(${pi.R}⁵/5)·∫₀^{2π}|${piTrig}| dθ = ${pi.k === 1 ? '' : pi.k + '·'}(${pi.R}⁵/5)·4 = ${num(piAns)}.`,
        `I₀ = ∫₀^{2π}∫₀^{${pi.R}} r²·${pi.k === 1 ? '' : pi.k}r|${piTrig}|·r dr dθ = ${pi.k === 1 ? '' : pi.k + '·'}(${pi.R}⁵/5)·∫₀^{2π}|${piTrig}| dθ = ${pi.k === 1 ? '' : pi.k + '·'}(${pi.R}⁵/5)·4 = ${num(piAns)}。`
      ),
      figure: g.figure({
        alt: t(`Disc of radius ${pi.R}.`, `半径为 ${pi.R} 的圆盘。`),
        view: fitView(piShapes, 0.25),
        shapes: piShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-48:polar-inertia', params: { R: pi.R, k: pi.k } },
    }),
    g.number({
      id: 'conservative',
      title: t('Make F conservative', '使 F 为保守场'),
      prompt: t(
        `F = (a x²y + ${coef(cv.c, 'y³')} + ${num(cv.p)}) i + (${coef(cv.q, 'x³')} + b xy² + ${num(cv.r)}) j is defined on the whole plane, where a and b are constants. Find a and b so that F is conservative.`,
        `F = (a x²y + ${coef(cv.c, 'y³')} + ${num(cv.p)}) i + (${coef(cv.q, 'x³')} + b xy² + ${num(cv.r)}) j 在整个平面上有定义，其中 a、b 是常数。求 a 和 b，使 F 为保守场。`
      ),
      fields: [
        { label: t('a', 'a'), answer: cvA },
        { label: t('b', 'b'), answer: cvB },
      ],
      hint: t('On the whole plane, conservative means M_y = N_x. Compute both and compare the coefficients of x² and of y².', '在整个平面上，保守等价于 M_y = N_x。分别计算，比较 x² 与 y² 的系数。'),
      explanation: t(
        `M_y = a x² + ${3 * cv.c}y² and N_x = ${3 * cv.q}x² + b y². They agree for all x, y when a = ${cvA} and b = ${cvB}.`,
        `M_y = a x² + ${3 * cv.c}y²，N_x = ${3 * cv.q}x² + b y²。当 a = ${cvA}、b = ${cvB} 时二者对所有 x、y 相等。`
      ),
      audit: { kind: 'MIT-MV-48:conservative', params: { c: cv.c, q: cv.q, p: cv.p, r: cv.r } },
    }),
    g.symbols({
      id: 'potential',
      title: t('Find the potential function', '求势函数'),
      prompt: t(
        `With a = ${cvA} and b = ${cvB}: F = (${coef(cvA, 'x²y')} + ${coef(cv.c, 'y³')} + ${num(cv.p)}) i + (${coef(cv.q, 'x³')} + ${coef(cvB, 'xy²')} + ${num(cv.r)}) j = ∇f. Complete f(x, y) = [ ] + [ ] + [ ] + [ ] (+ constant): the terms of f in the order x³y, xy³, x, y.`,
        `取 a = ${cvA}，b = ${cvB}：F = (${coef(cvA, 'x²y')} + ${coef(cv.c, 'y³')} + ${num(cv.p)}) i + (${coef(cv.q, 'x³')} + ${coef(cvB, 'xy²')} + ${num(cv.r)}) j = ∇f。补全 f(x, y) = [ ] + [ ] + [ ] + [ ]（+ 常数）：按 x³y、xy³、x、y 的顺序填入 f 的各项。`
      ),
      before: 'f(x, y) = ',
      between: [' + ', ' + ', ' + '],
      after: ' (+ constant)',
      answers: potTerms,
      tokens: potTokens,
      hint: t('Integrate M with respect to x, keeping y fixed, then use f_y = N to find what is missing.', '对 M 关于 x 积分（把 y 看作常数），再用 f_y = N 求出缺少的部分。'),
      explanation: t(
        `f_x = ${coef(cvA, 'x²y')} + ${coef(cv.c, 'y³')} + ${num(cv.p)} gives f = ${coef(cv.q, 'x³y')} + ${coef(cv.c, 'xy³')} + ${coef(cv.p, 'x')} + g(y). Then f_y = ${coef(cv.q, 'x³')} + ${coef(3 * cv.c, 'xy²')} + g′(y) must equal N, so g′(y) = ${num(cv.r)} and g(y) = ${coef(cv.r, 'y')}.`,
        `f_x = ${coef(cvA, 'x²y')} + ${coef(cv.c, 'y³')} + ${num(cv.p)} 积分得 f = ${coef(cv.q, 'x³y')} + ${coef(cv.c, 'xy³')} + ${coef(cv.p, 'x')} + g(y)。再由 f_y = ${coef(cv.q, 'x³')} + ${coef(3 * cv.c, 'xy²')} + g′(y) = N 得 g′(y) = ${num(cv.r)}，g(y) = ${coef(cv.r, 'y')}。`
      ),
    }),
    g.number({
      id: 'path-value',
      title: t('Line integral of conservative field', '保守场的线积分'),
      prompt: t(
        `F = (${coef(cvA, 'x²y')} + ${coef(cv.c, 'y³')} + ${num(cv.p)}) i + (${coef(cv.q, 'x³')} + ${coef(cvB, 'xy²')} + ${num(cv.r)}) j is conservative. C is any curve from (0, 0) to (${pv.s}, ${pv.t}). Find ∫_C F·dr.`,
        `F = (${coef(cvA, 'x²y')} + ${coef(cv.c, 'y³')} + ${num(cv.p)}) i + (${coef(cv.q, 'x³')} + ${coef(cvB, 'xy²')} + ${num(cv.r)}) j 是保守场。C 是从 (0, 0) 到 (${pv.s}, ${pv.t}) 的任意曲线。求 ∫_C F·dr。`
      ),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: pvAns }],
      hint: t('Use a potential function: ∫_C F·dr = f(end) − f(start), whatever the curve.', '用势函数：∫_C F·dr = f(终点) − f(起点)，与曲线形状无关。'),
      explanation: t(
        `With f = ${coef(cv.q, 'x³y')} + ${coef(cv.c, 'xy³')} + ${coef(cv.p, 'x')} + ${coef(cv.r, 'y')} we get f(${pv.s}, ${pv.t}) − f(0, 0) = ${num(pvAns)}.`,
        `取 f = ${coef(cv.q, 'x³y')} + ${coef(cv.c, 'xy³')} + ${coef(cv.p, 'x')} + ${coef(cv.r, 'y')}，则 f(${pv.s}, ${pv.t}) − f(0, 0) = ${num(pvAns)}。`
      ),
      audit: { kind: 'MIT-MV-48:path-value', params: { q: cv.q, c: cv.c, p: cv.p, r: cv.r, s: pv.s, t: pv.t } },
    }),
    g.choice({
      id: 'check-conservative',
      title: t('Path independence check', '路径无关性检验'),
      prompt: t(
        `F = ${ccF}. Two paths run from (0, 0) to (1, 1): C₁ along the line y = x and C₂ along the parabola y = x². Is ∫_{C₁} F·dr equal to ∫_{C₂} F·dr?`,
        `F = ${ccF}。从 (0, 0) 到 (1, 1) 有两条路径：C₁ 沿直线 y = x，C₂ 沿抛物线 y = x²。∫_{C₁} F·dr 与 ∫_{C₂} F·dr 相等吗？`
      ),
      options: [
        t('Yes: M_y = N_x, so F is conservative and only the endpoints matter.', '相等：M_y = N_x，所以 F 是保守场，积分只取决于端点。'),
        t('No: M_y ≠ N_x, so F is not conservative and the value can depend on the path.', '不相等：M_y ≠ N_x，所以 F 不是保守场，积分值可以依赖路径。'),
        t('Yes: both paths have the same endpoints, and that is enough for any vector field.', '相等：两条路径的端点相同，对任何向量场这都足够。'),
        t('No: the two paths are different curves, so the integrals always differ.', '不相等：两条路径是不同的曲线，积分一定不同。'),
      ],
      correct: cc.cons ? 0 : 1,
      hint: t('Compare M_y with N_x before computing anything.', '先比较 M_y 与 N_x，再决定要不要计算。'),
      explanation: cc.cons
        ? t(
            `M = ${coef(1, power('x', cc.m))}y, N = ${frac(1, cc.m + 1)}${power('x', cc.m + 1)}: M_y = ${power('x', cc.m)} = N_x, so F = ∇f with f = ${frac(1, cc.m + 1)}y ${power('x', cc.m + 1)}. Both integrals equal f(1, 1) − f(0, 0) = ${frac(1, cc.m + 1)}.`,
            `M = ${coef(1, power('x', cc.m))}y，N = ${frac(1, cc.m + 1)}${power('x', cc.m + 1)}：M_y = ${power('x', cc.m)} = N_x，所以 F = ∇f，f = ${frac(1, cc.m + 1)}y ${power('x', cc.m + 1)}。两个积分都等于 f(1, 1) − f(0, 0) = ${frac(1, cc.m + 1)}。`
          )
        : t(
            `M_y = ${power('x', cc.m)} but N_x = 0, so F is not conservative. Along y = x the integral is ${frac(1, cc.m + 2)} + ${frac(1, 3)}, along y = x² it is ${frac(1, cc.m + 3)} + ${frac(1, 3)}: they differ.`,
            `M_y = ${power('x', cc.m)}，而 N_x = 0，所以 F 不是保守场。沿 y = x 的积分是 ${frac(1, cc.m + 2)} + ${frac(1, 3)}，沿 y = x² 的积分是 ${frac(1, cc.m + 3)} + ${frac(1, 3)}，二者不同。`
          ),
    }),
    g.number({
      id: 'line-int',
      title: t('Line integral along a curve', '沿曲线的线积分'),
      prompt: t(
        `F = ${coef(1, power('x', li.m))}y i + y² j. Find ∫_C F·dr along the curve y = ${power('x', li.j)} from (0, 0) to (1, 1).`,
        `F = ${coef(1, power('x', li.m))}y i + y² j。求沿曲线 y = ${power('x', li.j)} 从 (0, 0) 到 (1, 1) 的积分 ∫_C F·dr。`
      ),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: liAns }],
      hint: t(`Substitute y = ${power('x', li.j)} and dy = ${li.j}${power('x', li.j - 1)} dx, then integrate in x from 0 to 1.`, `代入 y = ${power('x', li.j)}，dy = ${li.j}${power('x', li.j - 1)} dx，再对 x 从 0 到 1 积分。`),
      explanation: t(
        `y ${power('x', li.m)} dx = ${power('x', li.m + li.j)} dx integrates to ${frac(1, li.m + li.j + 1)}. y² dy = ${power('x', 2 * li.j)}·${li.j}${power('x', li.j - 1)} dx = ${li.j}${power('x', 3 * li.j - 1)} dx integrates to ${frac(1, 3)}. The sum ≈ ${num(liAns)}.`,
        `y ${power('x', li.m)} dx = ${power('x', li.m + li.j)} dx 的积分为 ${frac(1, li.m + li.j + 1)}。y² dy = ${power('x', 2 * li.j)}·${li.j}${power('x', li.j - 1)} dx = ${li.j}${power('x', 3 * li.j - 1)} dx 的积分为 ${frac(1, 3)}。两部分之和 ≈ ${num(liAns)}。`
      ),
      figure: g.figure({
        alt: t(`Curve y = ${power('x', li.j)} from (0,0) to (1,1).`, `曲线 y = ${power('x', li.j)} 从 (0,0) 到 (1,1)。`),
        view: fitView(liShapes, 0.25),
        shapes: liShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-48:line-int', params: { m: li.m, j: li.j } },
    }),
    g.choice({
      id: 'jacobian',
      title: t('Jacobian transformation', '雅可比变换'),
      prompt: t(
        `For x > 0, y > 0 let u = ${jbU} and v = ${jbV}. Which formula gives the area element dx dy in terms of du dv?`,
        `对 x > 0、y > 0，设 u = ${jbU}，v = ${jbV}。哪个公式用 du dv 表示面积元素 dx dy？`
      ),
      options: jbOpts.map((s) => t(s, s)),
      correct: 0,
      hint: t('Compute J = ∂(u, v)/∂(x, y) = u_x v_y − u_y v_x; then du dv = |J| dx dy.', '先算 J = ∂(u, v)/∂(x, y) = u_x v_y − u_y v_x；再由 du dv = |J| dx dy 得出。'),
      explanation: jb.arr === 1 ? t(
        `u_x = ${jb.a}${power('x', jb.a - 1)}/y, u_y = −${power('x', jb.a)}/y², v_x = y, v_y = x, so J = u_x v_y − u_y v_x = ${jb.a}${power('x', jb.a)}/y + ${power('x', jb.a)}/y = ${jb.a + 1}${power('x', jb.a)}/y = ${jb.a + 1}${jbW}. Since du dv = |J| dx dy, dx dy = du dv/(${jb.a + 1}${jbW}).`,
        `u_x = ${jb.a}${power('x', jb.a - 1)}/y，u_y = −${power('x', jb.a)}/y²，v_x = y，v_y = x，所以 J = u_x v_y − u_y v_x = ${jb.a}${power('x', jb.a)}/y + ${power('x', jb.a)}/y = ${jb.a + 1}${power('x', jb.a)}/y = ${jb.a + 1}${jbW}。由 du dv = |J| dx dy 得 dx dy = du dv/(${jb.a + 1}${jbW})。`
      ) : t(
        `u_x = y, u_y = x, v_x = ${jb.a}${power('x', jb.a - 1)}/y, v_y = −${power('x', jb.a)}/y², so J = u_x v_y − u_y v_x = −${power('x', jb.a)}/y − ${jb.a}${power('x', jb.a)}/y = −${jb.a + 1}${power('x', jb.a)}/y = −${jb.a + 1}${jbW}. Since du dv = |J| dx dy, dx dy = du dv/(${jb.a + 1}${jbW}).`,
        `u_x = y，u_y = x，v_x = ${jb.a}${power('x', jb.a - 1)}/y，v_y = −${power('x', jb.a)}/y²，所以 J = u_x v_y − u_y v_x = −${power('x', jb.a)}/y − ${jb.a}${power('x', jb.a)}/y = −${jb.a + 1}${power('x', jb.a)}/y = −${jb.a + 1}${jbW}。由 du dv = |J| dx dy 得 dx dy = du dv/(${jb.a + 1}${jbW})。`
      ),
    }),
    g.number({
      id: 'green-m',
      title: t("Green's theorem: M dx", "格林定理：M dx"),
      prompt: t(
        `C is the boundary of the rectangle 0 ≤ x ≤ ${gm.a}, 0 ≤ y ≤ ${gm.b}, traversed counterclockwise, and M(x, y) = ${coef(gm.p, 'y²')}. Find ∮_C M dx.`,
        `C 是矩形 0 ≤ x ≤ ${gm.a}，0 ≤ y ≤ ${gm.b} 的边界，沿逆时针方向绕行，M(x, y) = ${coef(gm.p, 'y²')}。求 ∮_C M dx。`
      ),
      fields: [{ label: t('∮_C M dx', '∮_C M dx'), answer: gmAns }],
      hint: t("By Green's theorem with N = 0: ∮_C M dx = ∬_R (0 − M_y) dA.", '取 N = 0，由格林定理：∮_C M dx = ∬_R (0 − M_y) dA。'),
      explanation: t(
        `M_y = ${2 * gm.p}y, so ∮_C M dx = −∬_R ${2 * gm.p}y dA = −${2 * gm.p}·${gm.a}·${gm.b * gm.b}/2 = ${num(gmAns)}. Check on the sides: only the top side (y = ${gm.b}, traversed from x = ${gm.a} to x = 0) contributes: ∫ ${coef(gm.p, 'y²')} dx from ${gm.a} to 0 = ${num(gmAns)}.`,
        `M_y = ${2 * gm.p}y，所以 ∮_C M dx = −∬_R ${2 * gm.p}y dA = −${2 * gm.p}·${gm.a}·${gm.b * gm.b}/2 = ${num(gmAns)}。逐边检验：只有上边（y = ${gm.b}，从 x = ${gm.a} 走到 x = 0）有贡献：∫ ${coef(gm.p, 'y²')} dx（x 从 ${gm.a} 到 0）= ${num(gmAns)}。`
      ),
      figure: g.figure({
        alt: t(`Rectangle 0 ≤ x ≤ ${gm.a}, 0 ≤ y ≤ ${gm.b}, ccw.`, `矩形 0 ≤ x ≤ ${gm.a}，0 ≤ y ≤ ${gm.b}，逆时针。`),
        view: fitView(gmShapes, 0.25),
        shapes: gmShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-48:green-m', params: { p: gm.p, a: gm.a, b: gm.b } },
    }),
    g.number({
      id: 'flux-green',
      title: t('Flux via Green\'s theorem', '格林定理求通量'),
      prompt: t(
        `R is the region bounded by the x-axis, the line x = ${fg.c} and the curve y = ${fg.e === 1 ? 'x' : `${power('x', fg.e)}`}, for 0 ≤ x ≤ ${fg.c}. F = (1 + ${coef(fg.k, 'y²')}) j. Use the normal form of Green's theorem to find the flux of F out of R through its boundary (counterclockwise, outward normal).`,
        `R 是由 x 轴、直线 x = ${fg.c} 和曲线 y = ${fg.e === 1 ? 'x' : `${power('x', fg.e)}`} 围成的区域，0 ≤ x ≤ ${fg.c}。F = (1 + ${coef(fg.k, 'y²')}) j。用格林定理的法向形式求 F 穿出 R 的边界（逆时针，外法向）的通量。`
      ),
      fields: [{ label: t('flux', '通量'), answer: fgAns }],
      hint: t(`Normal form: flux = ∬_R div F dA with div F = M_x + N_y. Integrate y first, from 0 to ${power('x', fg.e)}.`, `法向形式：通量 = ∬_R div F dA，其中 div F = M_x + N_y。先对 y 积分，从 0 到 ${power('x', fg.e)}。`),
      explanation: t(
        `div F = ${2 * fg.k}y, so the flux is ∫₀^{${fg.c}}∫₀^{${fg.e === 1 ? 'x' : `${power('x', fg.e)}`}} ${2 * fg.k}y dy dx = ∫₀^{${fg.c}} ${coef(fg.k, `${power('x', 2 * fg.e)}`)} dx = ${fg.k === 1 ? '' : `${fg.k}·`}${fg.c}^${2 * fg.e + 1}/${2 * fg.e + 1} ≈ ${num(fgAns)}.`,
        `div F = ${2 * fg.k}y，所以通量 = ∫₀^{${fg.c}}∫₀^{${fg.e === 1 ? 'x' : `${power('x', fg.e)}`}} ${2 * fg.k}y dy dx = ∫₀^{${fg.c}} ${coef(fg.k, `${power('x', 2 * fg.e)}`)} dx = ${fg.k === 1 ? '' : `${fg.k}·`}${fg.c}^${2 * fg.e + 1}/${2 * fg.e + 1} ≈ ${num(fgAns)}。`
      ),
      figure: g.figure({
        alt: t(`Region bounded by x-axis, x=${fg.c}, y=${fg.e === 1 ? 'x' : `${power('x', fg.e)}`}.`, `由 x 轴、x=${fg.c}、y=${fg.e === 1 ? 'x' : `${power('x', fg.e)}`} 围成的区域。`),
        view: fitView(fgShapes, 0.25),
        shapes: fgShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-48:flux-green', params: { k: fg.k, c: fg.c, e: fg.e } },
    }),
    g.number({
      id: 'flux-side',
      title: t('Flux through curved side', '曲线边的通量'),
      prompt: t(
        `R is bounded by the x-axis (side C₁), the line x = ${fg.c} (side C₂) and the curve y = ${fg.e === 1 ? 'x' : `${power('x', fg.e)}`} (side C₃), for 0 ≤ x ≤ ${fg.c}, and the normal points out of R. F = (1 + ${coef(fg.k, 'y²')}) j. The flux of F out of R through C₁ is −${fg.c} and through C₂ is 0. Find the flux out of R through the curved side C₃.`,
        `R 由 x 轴（边 C₁）、直线 x = ${fg.c}（边 C₂）和曲线 y = ${fg.e === 1 ? 'x' : `${power('x', fg.e)}`}（边 C₃）围成，0 ≤ x ≤ ${fg.c}，法向量指向 R 外。F = (1 + ${coef(fg.k, 'y²')}) j。F 穿出 R 经过 C₁ 的通量是 −${fg.c}，经过 C₂ 的通量是 0。求穿出 R 经过曲线边 C₃ 的通量。`
      ),
      fields: [{ label: t('flux through C₃', 'C₃ 的通量'), answer: fsAns }],
      hint: t('The total flux out of R is the sum over the three sides. Get the total from div F.', '穿出 R 的总通量是三条边的通量之和。总通量由 div F 求出。'),
      explanation: t(
        `The total flux is ∬_R div F dA = ${fg.k}·${fg.c}^${2 * fg.e + 1}/${2 * fg.e + 1} ≈ ${num(fgAns)}. So the flux through C₃ ≈ ${num(fgAns)} − (−${fg.c}) − 0 ≈ ${num(fsAns)}.`,
        `总通量 = ∬_R div F dA = ${fg.k}·${fg.c}^${2 * fg.e + 1}/${2 * fg.e + 1} ≈ ${num(fgAns)}。所以经过 C₃ 的通量 ≈ ${num(fgAns)} − (−${fg.c}) − 0 ≈ ${num(fsAns)}。`
      ),
      figure: g.figure({
        alt: t(`Region with sides C₁, C₂, C₃.`, `带边 C₁、C₂、C₃ 的区域。`),
        view: fitView(fgShapes, 0.25),
        shapes: fgShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-48:flux-side', params: { k: fg.k, c: fg.c, e: fg.e } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: flux between curves', '挑战：两曲线间的通量'),
      prompt: t(
        `R is the region between the curves y = ${power('x', ch.e)} and y = x for 0 ≤ x ≤ 1, and F = (${coef(ch.p, 'x')}) i + (${coef(ch.q, 'y')}) j. Find the flux of F out of R through its boundary, traversed counterclockwise with the normal pointing out of R.`,
        `R 是曲线 y = ${power('x', ch.e)} 与 y = x 之间 0 ≤ x ≤ 1 的区域，F = (${coef(ch.p, 'x')}) i + (${coef(ch.q, 'y')}) j。求 F 穿出 R 的边界（逆时针，法向指向 R 外）的通量。`
      ),
      fields: [{ label: t('flux', '通量'), answer: chAns }],
      hint: t(`Use the normal form of Green's theorem; the region's area is ∫₀¹ (x − ${power('x', ch.e)}) dx.`, `用格林定理的法向形式；区域的面积是 ∫₀¹ (x − ${power('x', ch.e)}) dx。`),
      explanation: t(
        `div F = ${ch.p} + ${ch.q} = ${ch.p + ch.q} is constant. The area is ∫₀¹ (x − ${power('x', ch.e)}) dx = 1/2 − 1/${ch.e + 1} = ${frac(ch.e - 1, 2 * (ch.e + 1))}. So the flux is ${ch.p + ch.q}·${frac(ch.e - 1, 2 * (ch.e + 1))} ≈ ${num(chAns)}. This game does not assess line or surface integrals in space (Stokes' theorem, the divergence theorem), triple integrals, or the proofs of Green's theorem; it covers the double integrals and planar line integrals of Unit 3 only.`,
        `div F = ${ch.p} + ${ch.q} = ${ch.p + ch.q} 是常数。面积 ∫₀¹ (x − ${power('x', ch.e)}) dx = 1/2 − 1/${ch.e + 1} = ${frac(ch.e - 1, 2 * (ch.e + 1))}。所以通量 = ${ch.p + ch.q}·${frac(ch.e - 1, 2 * (ch.e + 1))} ≈ ${num(chAns)}。本游戏不涉及空间中的线积分与曲面积分（斯托克斯定理、散度定理）、三重积分，也不要求证明格林定理；只覆盖第三单元的二重积分与平面线积分。`
      ),
      figure: g.figure({
        alt: t(`Region between y = ${power('x', ch.e)} and y = x for 0 ≤ x ≤ 1.`, `曲线 y = ${power('x', ch.e)} 与 y = x 之间 0 ≤ x ≤ 1 的区域。`),
        view: fitView(chShapes, 0.25),
        shapes: chShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      audit: { kind: 'MIT-MV-48:challenge', params: { e: ch.e, p: ch.p, q: ch.q } },
    }),
  ];
};
