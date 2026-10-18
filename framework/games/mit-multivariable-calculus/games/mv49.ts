import type { CardGenerator } from '../../types';
import { ellipse, fitView, sampleCurve, type FigureShape, type Pt } from '../../figure';
import { coef, frac, linear, makeMvDeck, num, par, piTerm, term, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string): Text => [en, zh];
/** Rational coefficient in front of a variable: fc(3, 3, 'x³') = "x³", fc(1, 2, 'y²') = "(1/2)y²". */
const fc = (n: number, d: number, v: string): string => { const f = frac(n, d); return f === '1' ? v : f === '−1' ? `−${v}` : f.includes('/') ? `(${f})${v}` : `${f}${v}`; };

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

export const mv49: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-49');
  warm(g);

  // Cards 1 & 2: region-picture / swap-limits
  const a = g.pick([2, 3]);
  const mn = g.pick([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4]] as [number, number][]);
  const m = mn[0], n = mn[1];
  const ma = m * a, na = n * a;

  // Cards 3 & 4: annulus-mass / com-symmetry
  const b = g.pick([1, 2, 3]);
  const R = g.pick([b + 1, b + 2, b + 3, 5, 6].filter(v => v >= b + 1 && v <= 6));
  const evenDensities = ['y/(x² + y²)', 'x² + y', 'y + 1'];
  const evenDensity = g.pick(evenDensities);

  // Cards 5, 6, 7: conservative-q / potential-coefs / path-work
  const p = g.pick([3, 6, 9]);
  const m2 = g.pick([2, 3, 4, 5, 6]);
  const r = g.pick([2, 4, 6, 8]);
  const q = -2 * m2;
  const A = p / 3, B = -m2, C = r / 2;
  const f = (x: number, y: number) => A * x ** 3 + B * x * y ** 2 + C * y ** 2;
  const pts = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] as [number, number][];
  const path = retry(() => {
    const A1 = g.pick(pts), B1 = g.pick(pts);
    return { A1, B1 };
  }, v => v.A1[0] !== v.B1[0] || v.A1[1] !== v.B1[1] || f(v.A1[0], v.A1[1]) !== f(v.B1[0], v.B1[1]));
  const x1 = path.A1[0], y1 = path.A1[1], x2 = path.B1[0], y2 = path.B1[1];
  const fA = f(x1, y1), fB = f(x2, y2), work = fB - fA;

  // Card 8: green-circle
  const gc = { a: g.pick([1, 2, 3, 4]), b: g.pick([1, -1, 2, -2, 3, -3, 4, -4]), c: g.pick([1, 2, 3, 4]), d: g.pick([1, 2, 3, 4]), s: g.pick([1, 2]) };
  const greenAns = -gc.b * gc.s ** 2 * Math.PI;

  // Card 9: flux-rectangle
  const k = g.pick([1, 2, 3]);
  const fa = g.pick([1, 2, 3]);
  const fb = g.pick([2, 3, 4]);
  const fluxAns = k * fa * fb ** 2 / 2;

  // Card 10: flux-missing-edge
  const pm = g.pick([-2, -1, 0, 1, 2]);
  const pa = g.pick([1, 2, 3]);
  const pb = g.pick([2, 3, 4]);

  // Card 11: jacobian
  const ja = g.pick([1, 2, 3]), jb = g.pick([1, 2, 3]), jc = g.pick([1, 2, 3]), jd = g.pick([1, 2, 3]);
  const jacAns = ja * jd + jb * jc;

  // Card 12: challenge
  const cp = g.pick([1, 2, 3]), cq = g.pick([1, 2, 3]), ch = g.pick([4, 9, 16]);
  const chAns = Math.PI * ch ** 2 / (2 * (cp + cq));

  // Figures
  const annulusShapes: FigureShape[] = [
    { kind: 'area', points: [...sampleCurve((t: number): Pt => [R * Math.cos(t), R * Math.sin(t)], 0, Math.PI), ...sampleCurve((t: number): Pt => [b * Math.cos(t), b * Math.sin(t)], Math.PI, 0)], tone: 'accent', opacity: 0.3 },
    { kind: 'line', points: [...sampleCurve((t: number): Pt => [R * Math.cos(t), R * Math.sin(t)], 0, Math.PI), [0, 0]], tone: 'accent', width: 2 },
    { kind: 'line', points: [...sampleCurve((t: number): Pt => [b * Math.cos(t), b * Math.sin(t)], 0, Math.PI), [0, 0]], tone: 'accent2', width: 2 },
  ];
  const annulusView = fitView(annulusShapes, 0.2);

  const circleShapes: FigureShape[] = [
    { kind: 'line', points: sampleCurve((t: number): Pt => [gc.s * Math.cos(t), gc.s * Math.sin(t)], 0, 2 * Math.PI), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [gc.s * Math.cos(0.5), gc.s * Math.sin(0.5)], to: [gc.s * Math.cos(0.8), gc.s * Math.sin(0.8)], tone: 'accent', width: 2 },
  ];
  const circleView = fitView(circleShapes, 0.3);

  const rectShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [fa, 0], [fa, fb], [0, fb], [0, 0]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [fa / 2, 0], to: [fa / 2, -0.5], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [fa, fb / 2], to: [fa + 0.5, fb / 2], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [fa / 2, fb], to: [fa / 2, fb + 0.5], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [0, fb / 2], to: [-0.5, fb / 2], tone: 'accent2', width: 2 },
  ];
  const rectView = fitView(rectShapes, 0.3);

  const rectMissingShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [pa, 0], [pa, pb], [0, pb], [0, 0]], tone: 'accent', width: 2 },
    { kind: 'line', points: [[0, 0], [0, pb]], tone: 'warn', width: 4 },
    { kind: 'text', at: [-0.5, pb / 2], text: 'C₄', tone: 'warn' },
  ];
  const rectMissingView = fitView(rectMissingShapes, 0.3);

  // Text helpers
  const mxStr = m === 1 ? 'x' : `${m}x`;
  const nxStr = n === 1 ? 'x' : `${n}x`;
  const yOverN = n === 1 ? 'y' : `y/${n}`;
  const yOverM = m === 1 ? 'y' : `y/${m}`;
  const pStr = p === 1 ? 'x²' : `${p}x²`;
  const m2Str = m2 === 1 ? 'y²' : `${m2}y²`;
  const rStr = r === 1 ? 'y' : `${r}y`;
  const kStr = k === 1 ? 'xy' : `${k}xy`;
  const gcM = gc.a === 1 ? 'x' : `${gc.a}x`;
  const gcMFull = gc.b === 1 ? `${gcM} + y` : gc.b === -1 ? `${gcM} − y` : gc.b > 0 ? `${gcM} + ${gc.b}y` : `${gcM} − ${-gc.b}y`;
  const gcN = gc.c === 1 ? '1' : `${gc.c}`;
  const gcNFull = gc.d === 1 ? `${gcN} + cos y` : `${gcN} + ${gc.d} cos y`;
  const pmStr = pm === 0 ? '' : pm > 0 ? ` + ${pm}` : ` − ${-pm}`;
  const uStr = linear([ja, -jb], ['x', 'y']);
  const vStr = linear([jc, jd], ['x', 'y']) + ' − 1';
  const cpStr = cp === 1 ? 'x' : `${cp}x`;
  const cqStr = cq === 1 ? 'y' : `${cq}y`;
  const cpqStr = cp === 1 && cq === 1 ? 'x − y' : cp === 1 ? `${cpStr} − ${cqStr}` : `${cpStr} − ${cqStr}`;

  return [
    g.choice({
      id: 'region-picture', title: t('Region of integration', '积分区域'),
      prompt: t(`Which description matches the region of integration of ∫₀^${a} ∫_{${mxStr}}^{${nxStr}} dy dx?`,
        `∫₀^${a} ∫_{${mxStr}}^{${nxStr}} dy dx 的积分区域是下面哪一个？`),
      options: [
        t(`The triangle with vertices (0, 0), (${a}, ${ma}), (${a}, ${na})`, `顶点为 (0, 0)、(${a}, ${ma})、(${a}, ${na}) 的三角形`),
        t(`The triangle with vertices (0, 0), (${ma}, ${a}), (${na}, ${a})`, `顶点为 (0, 0)、(${ma}, ${a})、(${na}, ${a}) 的三角形`),
        t(`The triangle with vertices (0, 0), (${num(a / m)}, ${a}), (${num(a / n)}, ${a})`, `顶点为 (0, 0)、(${num(a / m)}, ${a})、(${num(a / n)}, ${a}) 的三角形`),
        t(`The triangle with vertices (0, 0), (${a}, 0), (${a}, ${na})`, `顶点为 (0, 0)、(${a}, 0)、(${a}, ${na}) 的三角形`),
      ],
      correct: 0,
      hint: t(`Sketch the lines y = ${mxStr} and y = ${nxStr}; x runs from 0 to ${a}.`, `画出直线 y = ${mxStr} 与 y = ${nxStr}；x 从 0 变到 ${a}。`),
      explanation: t(`x runs from 0 to ${a}, and for each x the variable y runs from ${mxStr} to ${nxStr}. At x = ${a} that is y from ${ma} to ${na}, so the region is the triangle with vertices (0, 0), (${a}, ${ma}), (${a}, ${na}).`,
        `x 从 0 到 ${a}，对每个 x，y 从 ${mxStr} 到 ${nxStr}。在 x = ${a} 处 y 从 ${ma} 到 ${na}，所以区域是顶点为 (0, 0)、(${a}, ${ma})、(${a}, ${na}) 的三角形。`),
    }),
    g.symbols({
      id: 'swap-limits', title: t('Exchange order of integration', '交换积分次序'),
      prompt: t(`Exchange the order of integration of ∫₀^${a} ∫_{${mxStr}}^{${nxStr}} dy dx. The region splits into two pieces: ∫_{y=0}^{${ma}} ∫_{x=[ ]}^{[ ]} dx dy + ∫_{y=${ma}}^{${na}} ∫_{x=[ ]}^{[ ]} dx dy.`,
        `交换 ∫₀^${a} ∫_{${mxStr}}^{${nxStr}} dy dx 的积分次序。区域分成两部分：∫_{y=0}^{${ma}} ∫_{x=[ ]}^{[ ]} dx dy + ∫_{y=${ma}}^{${na}} ∫_{x=[ ]}^{[ ]} dx dy。`),
      before: '∫_{y=0}^{', between: ['} ∫_{x=', '}^{', `} dx dy + ∫_{y=${ma}}^{`, '} ∫_{x=', '}^{'],
      after: '} dx dy',
      answers: [String(ma), yOverN, yOverM, String(na), yOverN, String(a)],
      tokens: shuffled(g, [String(ma), yOverN, yOverM, String(na), String(a), n === 1 ? 'y' : `${n}y`, m === 1 ? 'y' : `${m}y`, '0']),
      hint: t(`At height y, the horizontal line enters the triangle on one slanted line and leaves on another line or on x = ${a}. The corner (${a}, ${ma}) is where the description changes.`,
        `在高度 y 处，水平线从一条斜线进入三角形，从另一条斜线或 x = ${a} 离开。角点 (${a}, ${ma}) 是描述改变的地方。`),
      explanation: t(`Solving y = ${mxStr} and y = ${nxStr} for x gives x = ${yOverM} and x = ${yOverN}. For 0 ≤ y ≤ ${ma} the line enters at x = ${yOverN} and leaves at x = ${yOverM}. For ${ma} ≤ y ≤ ${na} it still enters at x = ${yOverN} but now leaves through the vertical side x = ${a}.`,
        `由 y = ${mxStr} 与 y = ${nxStr} 解出 x = ${yOverM} 与 x = ${yOverN}。当 0 ≤ y ≤ ${ma} 时，水平线在 x = ${yOverN} 进入，在 x = ${yOverM} 离开。当 ${ma} ≤ y ≤ ${na} 时，仍在 x = ${yOverN} 进入，但从竖直边 x = ${a} 离开。`),
    }),
    g.number({
      id: 'annulus-mass', title: t('Mass of half annulus', '上半环的质量'),
      prompt: t(`Find the mass M of the upper half of the annulus ${b}² < x² + y² < ${R}² (y ≥ 0) with density δ = y/(x² + y²).`,
        `求上半环 ${b}² < x² + y² < ${R}²（y ≥ 0）的质量 M，密度 δ = y/(x² + y²)。`),
      figure: g.figure({ alt: t(`Upper half annulus ${b} < r < ${R}.`, `上半环 ${b} < r < ${R}。`), view: annulusView, shapes: annulusShapes, axes: { xLabel: 'x', yLabel: 'y', grid: true } }),
      fields: [{ label: t('M', 'M'), answer: 2 * (R - b) }],
      hint: t('Use polar coordinates: δ dA = (r sin θ / r²)·r dr dθ.', '用极坐标：δ dA = (r sin θ / r²)·r dr dθ。'),
      explanation: t(`δ dA = sin θ dr dθ, so M = ∫₀^π sin θ dθ · ∫_${b}^${R} dr = 2·(${R} − ${b}) = ${num(2 * (R - b))}.`,
        `δ dA = sin θ dr dθ，所以 M = ∫₀^π sin θ dθ · ∫_${b}^${R} dr = 2·(${R} − ${b}) = ${num(2 * (R - b))}。`),
      audit: { kind: 'MIT-MV-49:annulus-mass', params: { b, R } },
    }),
    g.choice({
      id: 'com-symmetry', title: t('Centre of mass by symmetry', '对称性判断质心'),
      prompt: t(`The plate is the upper half of the annulus ${b}² < x² + y² < ${R}² (y ≥ 0). It is symmetric about the y-axis. For which of these densities can you conclude, without evaluating any integral, that the x-coordinate of its centre of mass is x̄ = 0?`,
        `薄板是上半环 ${b}² < x² + y² < ${R}²（y ≥ 0），它关于 y 轴对称。对下列哪个密度，不用计算任何积分就能断定质心的 x 坐标 x̄ = 0？`),
      options: [
        t(`δ = ${evenDensity}`, `δ = ${evenDensity}`),
        t(`δ = ${R} + x`, `δ = ${R} + x`),
        t(`δ = (${R} + x)y`, `δ = (${R} + x)y`),
        t(`δ = ${R} + x + y`, `δ = ${R} + x + y`),
      ],
      correct: 0,
      figure: g.figure({ alt: t(`Upper half annulus ${b} < r < ${R}.`, `上半环 ${b} < r < ${R}。`), view: annulusView, shapes: annulusShapes, axes: { xLabel: 'x', yLabel: 'y', grid: true } }),
      hint: t('Symmetry of the region alone is not enough: look at what happens to the density when x is replaced by −x.', '仅有区域对称是不够的：看看把 x 换成 −x 时密度怎样变化。'),
      explanation: t(`x̄ = (1/M)∬ xδ dA. If δ(−x, y) = δ(x, y), the contributions of (x, y) and (−x, y) to ∬ xδ dA cancel, so x̄ = 0. For the other densities δ contains ${R} + x: the x-term gives ∬ x² (or x²y) dA > 0, so x̄ ≠ 0.`,
        `x̄ = (1/M)∬ xδ dA。若 δ(−x, y) = δ(x, y)，则 (x, y) 与 (−x, y) 对 ∬ xδ dA 的贡献相互抵消，所以 x̄ = 0。其余密度含有 ${R} + x，x 项给出 ∬ x²（或 x²y）dA > 0，所以 x̄ ≠ 0。`),
    }),
    g.number({
      id: 'conservative-q', title: t('Find q for conservative field', '求保守场的 q'),
      prompt: t(`F = (${pStr} − ${m2Str}) i + (q xy + ${rStr}) j, where q is a constant, is defined on the whole plane. Find q so that F is conservative.`,
        `F = (${pStr} − ${m2Str}) i + (q xy + ${rStr}) j 在整个平面上有定义，q 是常数。求 q，使 F 为保守场。`),
      fields: [{ label: t('q', 'q'), answer: q }],
      hint: t('Conservative on the whole plane means M_y = N_x.', '在整个平面上保守等价于 M_y = N_x。'),
      explanation: t(`M_y = −${2 * m2}y and N_x = q y, so q = −${2 * m2}.`, `M_y = −${2 * m2}y，N_x = q y，所以 q = −${2 * m2}。`),
      audit: { kind: 'MIT-MV-49:conservative-q', params: { p, m: m2, r } },
    }),
    g.number({
      id: 'potential-coefs', title: t('Coefficients of potential function', '势函数的系数'),
      prompt: t(`F = (${pStr} − ${m2Str}) i + (−${2 * m2}xy + ${rStr}) j is conservative. Its potential function is f(x, y) = A x³ + B xy² + C y² (plus a constant). Enter A, B and C.`,
        `F = (${pStr} − ${m2Str}) i + (−${2 * m2}xy + ${rStr}) j 是保守场，它的势函数为 f(x, y) = A x³ + B xy² + C y²（再加常数）。填入 A、B、C。`),
      fields: [
        { label: t('A', 'A'), answer: A },
        { label: t('B', 'B'), answer: B },
        { label: t('C', 'C'), answer: C },
      ],
      hint: t('Integrate f_x = M with respect to x, then compare f_y with N.', '对 f_x = M 关于 x 积分，再比较 f_y 与 N。'),
      explanation: t(`f_x = ${pStr} − ${m2Str} gives f = ${fc(p, 3, 'x³')} − ${m2}xy² + g(y). Then f_y = −${2 * m2}xy + g′(y) must equal −${2 * m2}xy + ${rStr}, so g′(y) = ${rStr} and g(y) = ${fc(r, 2, 'y²')}.`,
        `f_x = ${pStr} − ${m2Str} 积分得 f = ${fc(p, 3, 'x³')} − ${m2}xy² + g(y)。再由 f_y = −${2 * m2}xy + g′(y) 等于 −${2 * m2}xy + ${rStr} 得 g′(y) = ${rStr}，g(y) = ${fc(r, 2, 'y²')}。`),
      audit: { kind: 'MIT-MV-49:potential-coefs', params: { p, m: m2, r } },
    }),
    g.number({
      id: 'path-work', title: t('Work along any path', '任意路径的功'),
      prompt: t(`F = (${pStr} − ${m2Str}) i + (−${2 * m2}xy + ${rStr}) j is conservative. C is any curve from A = (${x1}, ${y1}) to B = (${x2}, ${y2}). Find ∫_C F·dr.`,
        `F = (${pStr} − ${m2Str}) i + (−${2 * m2}xy + ${rStr}) j 是保守场。C 是从 A = (${x1}, ${y1}) 到 B = (${x2}, ${y2}) 的任意曲线。求 ∫_C F·dr。`),
      fields: [{ label: t('∫ F·dr', '∫ F·dr'), answer: work }],
      hint: t('F is conservative, so ∫_C F·dr = f(B) − f(A) and the shape of C does not matter.', 'F 是保守场，所以 ∫_C F·dr = f(B) − f(A)，曲线 C 的形状无关紧要。'),
      explanation: t(`With f = ${coef(p / 3, 'x³')} − ${m2}xy² + ${coef(r / 2, 'y²')}: f(B) = ${num(fB)} and f(A) = ${par(fA)}, so the integral is ${num(fB)} − ${par(fA)} = ${num(work)}.`,
        `取 f = ${coef(p / 3, 'x³')} − ${m2}xy² + ${coef(r / 2, 'y²')}：f(B) = ${num(fB)}，f(A) = ${par(fA)}，所以积分为 ${num(fB)} − ${par(fA)} = ${num(work)}。`),
      audit: { kind: 'MIT-MV-49:path-work', params: { p, m: m2, r, x1, y1, x2, y2 } },
    }),
    g.number({
      id: 'green-circle', title: t('Work around a circle', '绕圆的功'),
      prompt: t(`A particle moves once counterclockwise around the circle of radius ${gc.s} centred at the origin in the force field F = (${gcMFull}) i + (${gcNFull}) j. Find the work ∮_C F·dr. Give the exact value, for example −3pi.`,
        `一个质点在力场 F = (${gcMFull}) i + (${gcNFull}) j 中，沿以原点为圆心、半径为 ${gc.s} 的圆逆时针运动一周。求功 ∮_C F·dr，写出精确值，例如 −3pi。`),
      figure: g.figure({ alt: t(`Circle of radius ${gc.s}.`, `半径为 ${gc.s} 的圆。`), view: circleView, shapes: circleShapes, axes: { xLabel: 'x', yLabel: 'y', grid: true } }),
      fields: [{ label: t('W', 'W'), answer: greenAns }],
      hint: t("Use Green's theorem: ∮_C F·dr = ∬ (N_x − M_y) dA.", '用格林定理：∮_C F·dr = ∬ (N_x − M_y) dA。'),
      explanation: t(`N_x = 0 and M_y = ${par(gc.b)}, so ∮_C F·dr = ∬ (0 − ${par(gc.b)}) dA = ${par(-gc.b)}·(area π·${gc.s}²) = ${piTerm(-gc.b * gc.s ** 2)}.`,
        `N_x = 0，M_y = ${par(gc.b)}，所以 ∮_C F·dr = ∬ (0 − ${par(gc.b)}) dA = ${par(-gc.b)}·(面积 π·${gc.s}²) = ${piTerm(-gc.b * gc.s ** 2)}。`),
      audit: { kind: 'MIT-MV-49:green-circle', params: { a: gc.a, b: gc.b, c: gc.c, d: gc.d, s: gc.s } },
    }),
    g.number({
      id: 'flux-rectangle', title: t('Flux out of a rectangle', '矩形的通量'),
      prompt: t(`Let R be the rectangle 0 ≤ x ≤ ${fa}, 0 ≤ y ≤ ${fb}, with boundary C traversed counterclockwise and the normal pointing out of R, and F = (${kStr} + sin x cos y) i − (cos x sin y) j. Find the flux of F out of R through C.`,
        `设 R 是矩形 0 ≤ x ≤ ${fa}，0 ≤ y ≤ ${fb}，边界 C 沿逆时针方向，法向量指向 R 外，F = (${kStr} + sin x cos y) i − (cos x sin y) j。求 F 穿出 R 经过 C 的通量。`),
      figure: g.figure({ alt: t(`Rectangle 0 ≤ x ≤ ${fa}, 0 ≤ y ≤ ${fb}.`, `矩形 0 ≤ x ≤ ${fa}，0 ≤ y ≤ ${fb}。`), view: rectView, shapes: rectShapes, axes: { xLabel: 'x', yLabel: 'y', grid: true } }),
      fields: [{ label: t('Flux', '通量'), answer: fluxAns }],
      hint: t("Normal form of Green's theorem: flux = ∬ div F dA. Compute M_x + N_y and watch for cancellation.", '格林定理的法向形式：通量 = ∬ div F dA。计算 M_x + N_y，注意项的抵消。'),
      explanation: t(`M_x = ${coef(k, 'y')} + cos x cos y and N_y = −cos x cos y, so div F = ${coef(k, 'y')}. The flux is ∫₀^${fa}∫₀^${fb} ${coef(k, 'y')} dy dx = ${k}·${fa}·${fb}²/2 = ${num(fluxAns)}.`,
        `M_x = ${coef(k, 'y')} + cos x cos y，N_y = −cos x cos y，所以 div F = ${coef(k, 'y')}。通量 = ∫₀^${fa}∫₀^${fb} ${coef(k, 'y')} dy dx = ${k}·${fa}·${fb}²/2 = ${num(fluxAns)}。`),
      audit: { kind: 'MIT-MV-49:flux-rectangle', params: { k, a: fa, b: fb } },
    }),
    g.choice({
      id: 'flux-missing-edge', title: t('Flux through missing edge', '缺少一边的通量'),
      prompt: t(`R is the rectangle 0 ≤ x ≤ ${pa}, 0 ≤ y ≤ ${pb}. Its boundary C is traversed counterclockwise with the normal pointing out of R: C₁ the bottom, C₂ the right side, C₃ the top and C₄ the left side x = 0. F = (xy + sin x cos y${pmStr}) i − (cos x sin y) j. Compare the flux of F out of R through C₁, C₂ and C₃ together with the flux through the whole of C.`,
        `R 是矩形 0 ≤ x ≤ ${pa}，0 ≤ y ≤ ${pb}。边界 C 沿逆时针方向，法向量指向 R 外：C₁ 为下边，C₂ 为右边，C₃ 为上边，C₄ 为左边 x = 0。F = (xy + sin x cos y${pmStr}) i − (cos x sin y) j。比较 F 穿出 R 经过 C₁、C₂、C₃ 的总通量与经过整个 C 的通量。`),
      options: [
        t('More than the flux through C, because the flux through C₄ is negative.', '大于经过 C 的通量，因为经过 C₄ 的通量为负。'),
        t('Less than the flux through C, because the flux through C₄ is positive.', '小于经过 C 的通量，因为经过 C₄ 的通量为正。'),
        t('Equal to the flux through C, because the flux through C₄ is 0.', '等于经过 C 的通量，因为经过 C₄ 的通量为 0。'),
        t('Equal to the flux through C, because the fluxes through opposite sides cancel.', '等于经过 C 的通量，因为相对两边的通量相互抵消。'),
      ],
      correct: pm > 0 ? 0 : pm < 0 ? 1 : 2,
      figure: g.figure({ alt: t(`Rectangle with C₄ highlighted.`, `高亮 C₄ 的矩形。`), view: rectMissingView, shapes: rectMissingShapes, axes: { xLabel: 'x', yLabel: 'y', grid: true } }),
      hint: t('Total flux = flux through C₁ + C₂ + C₃ + C₄. On C₄ (x = 0) the normal is −i, so F·n = −M(0, y).', '总通量 = 经过 C₁、C₂、C₃、C₄ 的通量之和。在 C₄（x = 0）上法向量是 −i，所以 F·n = −M(0, y)。'),
      explanation: t(`On C₄, x = 0 and n = −i, and M(0, y) = ${par(pm)}, so F·n = ${par(-pm)} and the flux through C₄ is ${par(-pm)}·${pb} = ${num(-pm * pb)}. The flux through C₁, C₂, C₃ together is (flux through C) − (flux through C₄), which is ${pm > 0 ? 'more than' : pm < 0 ? 'less than' : 'equal to'} the flux through C.`,
        `在 C₄ 上 x = 0，n = −i，M(0, y) = ${par(pm)}，所以 F·n = ${par(-pm)}，经过 C₄ 的通量为 ${par(-pm)}·${pb} = ${num(-pm * pb)}。经过 C₁、C₂、C₃ 的通量之和 = (经过 C 的通量) − (经过 C₄ 的通量)，它${pm > 0 ? '大于' : pm < 0 ? '小于' : '等于'}经过 C 的通量。`),
    }),
    g.number({
      id: 'jacobian', title: t('Jacobian of change of variables', '换元的雅可比行列式'),
      prompt: t(`u = ${uStr} and v = ${vStr}. Enter the number J such that du dv = J dx dy (J is positive).`,
        `u = ${uStr}，v = ${vStr}。填入使 du dv = J dx dy 的数 J（J 为正）。`),
      fields: [{ label: t('J', 'J'), answer: jacAns }],
      hint: t('J = ∂(u, v)/∂(x, y) = u_x v_y − u_y v_x.', 'J = ∂(u, v)/∂(x, y) = u_x v_y − u_y v_x。'),
      explanation: t(`u_x = ${ja}, u_y = −${jb}, v_x = ${jc}, v_y = ${jd}, so J = ${ja}·${jd} − (−${jb})·${jc} = ${num(jacAns)}.`,
        `u_x = ${ja}，u_y = −${jb}，v_x = ${jc}，v_y = ${jd}，所以 J = ${ja}·${jd} − (−${jb})·${jc} = ${num(jacAns)}。`),
      audit: { kind: 'MIT-MV-49:jacobian', params: { a: ja, b: jb, c: jc, d: jd } },
    }),
    g.number({
      id: 'challenge', title: t('Volume under a paraboloid', '抛物面下的体积'),
      prompt: t(`Find the volume of the region enclosed by the plane z = ${ch} and the surface z = (${cpqStr})² + (x + y − 1)². Give the exact value, for example 8pi/3.`,
        `求平面 z = ${ch} 与曲面 z = (${cpqStr})² + (x + y − 1)² 所围区域的体积，写出精确值，例如 8pi/3。`),
      fields: [{ label: t('V', 'V'), answer: chAns }],
      hint: t(`Change variables u = ${cpqStr}, v = x + y − 1: the surface becomes z = u² + v².`, `换元 u = ${cpqStr}，v = x + y − 1：曲面变成 z = u² + v²。`),
      explanation: t(`J = ∂(u, v)/∂(x, y) = ${cp}·1 − (−${cq})·1 = ${cp + cq}, so dx dy = du dv/${cp + cq}. The region is u² + v² < ${ch}, so V = (1/${cp + cq}) ∬ (${ch} − u² − v²) du dv = (1/${cp + cq})·2π·${ch}²/4 ≈ ${num(chAns)}.`,
        `J = ∂(u, v)/∂(x, y) = ${cp}·1 − (−${cq})·1 = ${cp + cq}，所以 dx dy = du dv/${cp + cq}。区域为 u² + v² < ${ch}，V = (1/${cp + cq}) ∬ (${ch} − u² − v²) du dv = (1/${cp + cq})·2π·${ch}²/4 ≈ ${num(chAns)}。`),
      audit: { kind: 'MIT-MV-49:challenge', params: { p: cp, q: cq, h: ch } },
    }),
  ];
};
