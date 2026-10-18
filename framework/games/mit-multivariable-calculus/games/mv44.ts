import type { CardGenerator } from '../../types';
import { ellipse, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, frac, linear, makeMvDeck, num, par, term, type Text } from '../support';

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

export const mv44: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-44');
  warm(g);

  // --- Card 1: curl-value ---
  const cv = retry(() => ({
    a: g.random(1, 6),
    b: g.random(1, 3),
    x0: g.pick([-3, -2, -1, 1, 2, 3]),
    y0: g.random(-3, 3),
  }), v => v.a !== 2 * v.b);
  const cvMx = coef(cv.a, 'xy');
  const cvNx = coef(cv.b, 'x²');
  const cvCurl = (2 * cv.b - cv.a) * cv.x0;

  // --- Card 2: not-gradient ---
  const ngIsGrad = g.random(0, 1) < 0.5;
  let ngA: number, ngB: number;
  if (ngIsGrad) {
    ngB = g.random(1, 3);
    ngA = 2 * ngB;
  } else {
    ngB = g.random(1, 3);
    ngA = retry(() => g.random(1, 6), v => v !== 2 * ngB);
  }
  const ngMx = coef(ngA, 'xy');
  const ngNx = coef(ngB, 'x²');
  const ngC = 2 * ngB - ngA;

  // --- Card 3: simply-connected ---
  const scCorrect = g.pick([0, 1, 2]); // 0=S1, 1=S2, 2=S3
  const scH = g.random(1, 3);
  const scK = g.random(1, 3);
  const scDistractors = shuffled(g, [
    t('The xy-plane with the origin removed', '去掉原点的 xy 平面'),
    t(`The xy-plane with the point (${scH}, ${scK}) removed`, `去掉点 (${scH}, ${scK}) 的 xy 平面`),
    t('The region between the circles of radius 1 and radius 2 centred at the origin', '以原点为圆心、半径 1 与半径 2 的两个圆之间的区域'),
    t('The xy-plane with the x-axis removed (the half-planes y > 0 and y < 0)', '去掉 x 轴的 xy 平面（半平面 y > 0 与 y < 0）'),
  ]).slice(0, 3);
  const scOptions = [
    t('The whole xy-plane', '整个 xy 平面'),
    t('The right half-plane x ≥ 0', '右半平面 x ≥ 0'),
    t('The unit disk: the unit circle together with its interior', '单位圆盘：单位圆及其内部'),
  ];
  const scCorrectOption = scOptions[scCorrect];

  // --- Card 4: potential-value ---
  const pv = {
    a: g.random(1, 3),
    b: g.pick([-3, -2, -1, 1, 2, 3]),
    c: g.pick([-3, -2, -1, 1, 2, 3]),
    c0: g.random(0, 5),
    x0: g.random(1, 3),
    y0: g.random(1, 3),
  };
  const pvM = coef(2 * pv.a, 'xy') + ' ' + term(pv.b);
  const pvN = coef(pv.a, 'x²') + ' ' + term(pv.c);
  const pvAnswer = pv.a * pv.x0 ** 2 * pv.y0 + pv.b * pv.x0 + pv.c * pv.y0 + pv.c0;

  // --- Card 5: half-plane-potential ---
  const hpUpper = g.random(0, 1) < 0.5;
  const hpY1 = hpUpper ? g.pick([1, 2, 3]) : g.pick([-1, -2, -3]);
  const hpY2 = hpUpper ? g.pick([1, 2, 3]) : g.pick([-1, -2, -3]);
  const hpQ1 = g.random(-3, 3);
  const hpQ2 = g.random(-3, 3);
  const hpX1 = hpQ1 * hpY1;
  const hpX2 = hpQ2 * hpY2;
  const hpV1 = g.random(-5, 5);
  const hpH = hpUpper ? 'y > 0' : 'y < 0';
  const hpAnswer = hpQ2 - hpQ1 + hpV1;

  // --- Card 6: exact-region ---
  const erVariant = g.random(0, 1) < 0.5 ? 'A' : 'B';
  const erK = g.random(1, 3);
  const erKStr = erK === 1 ? '' : String(erK);
  const erND = erVariant === 'A' ? 'y ≠ 0' : 'x ≠ 0';
  const erLine = erVariant === 'A' ? 'y = 0' : 'x = 0';
  const erW = erVariant === 'A'
    ? `${erKStr}(y dx − x dy)/y²`
    : `${erKStr}(x dy − y dx)/x²`;
  const erRatio = erVariant === 'A' ? 'x/y' : 'y/x';
  const erPieces = erVariant === 'A' ? 'y > 0 and y < 0' : 'x > 0 and x < 0';
  const erKRatio = erK === 1 ? erRatio : `${erK}·${erRatio}`;

  // --- Card 7: unit-circle-work ---
  const ucK = g.random(1, 5);
  const ucR = g.pick([1, 2, 3]);
  const ucFk = `(${coef(-ucK, 'y')}/(x² + y²), ${coef(ucK, 'x')}/(x² + y²))`;
  const ucAnswer = 2 * ucK * Math.PI;

  // --- Card 8: why-not-conservative ---
  const wncK = g.random(1, 4);
  const wncR = g.pick([1, 2, 3]);
  const wncFk = `(${coef(-wncK, 'y')}/(x² + y²), ${coef(wncK, 'x')}/(x² + y²))`;
  const wncIntegral = `${2 * wncK}π`;

  // --- Card 9: challenge ---
  const chInside = g.random(0, 1) < 0.5;
  let chH: number, chR: number;
  if (chInside) {
    const combos: [number, number][] = [[1, 2], [-1, 2], [1, 3], [-1, 3], [2, 3], [-2, 3]];
    const [h, r] = combos[g.random(0, combos.length - 1)];
    chH = h; chR = r;
  } else {
    chR = g.random(1, 2);
    chH = retry(() => g.pick([-3, -2, -1, 1, 2, 3]), v => Math.abs(v) > chR);
  }
  const chK = g.random(1, 3);
  const chFk = `(${coef(-chK, 'y')}/(x² + y²), ${coef(chK, 'x')}/(x² + y²))`;
  const chAnswer = Math.abs(chH) < chR ? 2 * chK * Math.PI : 0;

  // --- Figures ---
  const ucShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, ucR, ucR), tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'warn', hollow: true },
    { kind: 'arrow', from: [ucR, 0], to: [ucR * Math.cos(0.5), ucR * Math.sin(0.5)], tone: 'accent2', width: 2 },
  ];
  // the figure of why-not-conservative has its own radius wncR
  const wncShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, wncR, wncR), tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'warn', hollow: true },
    { kind: 'arrow', from: [wncR, 0], to: [wncR * Math.cos(0.5), wncR * Math.sin(0.5)], tone: 'accent2', width: 2 },
  ];
  const chShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(chH, 0, chR, chR), tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'warn', hollow: true },
    { kind: 'arrow', from: [chH + chR, 0], to: [chH + chR * Math.cos(0.5), chR * Math.sin(0.5)], tone: 'accent2', width: 2 },
  ];

  return [
    g.number({
      id: 'curl-value',
      title: t('Curl of a vector field', '向量场的旋度'),
      prompt: t(
        `F = (${cvMx}, ${cvNx}) is defined on the whole xy-plane. Compute curl F = N_x − M_y at the point P = (${num(cv.x0)}, ${num(cv.y0)}).`,
        `F = (${cvMx}, ${cvNx}) 在整个 xy 平面上有定义。求 curl F = N_x − M_y 在点 P = (${num(cv.x0)}, ${num(cv.y0)}) 处的值。`
      ),
      fields: [{ label: t('curl F', 'curl F'), answer: cvCurl }],
      hint: t(
        `curl F = N_x − M_y. M = ${cvMx} depends on y; N = ${cvNx} depends on x.`,
        `curl F = N_x − M_y。M = ${cvMx} 依赖 y，N = ${cvNx} 依赖 x。`
      ),
      explanation: t(
        `M_y = ${coef(cv.a, 'x')} and N_x = ${coef(2 * cv.b, 'x')}, so curl F = ${coef(2 * cv.b - cv.a, 'x')}. At x = ${num(cv.x0)} this is ${num(cvCurl)}.`,
        `M_y = ${coef(cv.a, 'x')}，N_x = ${coef(2 * cv.b, 'x')}，所以 curl F = ${coef(2 * cv.b - cv.a, 'x')}。在 x = ${num(cv.x0)} 处等于 ${num(cvCurl)}。`
      ),
      audit: { kind: 'MIT-MV-44:curl-value', params: { a: cv.a, b: cv.b, x0: cv.x0, y0: cv.y0 } },
    }),

    g.choice({
      id: 'not-gradient',
      title: t('Is F a gradient field?', 'F 是梯度场吗？'),
      prompt: t(
        `F = (${ngMx}, ${ngNx}) is defined and continuously differentiable on the whole xy-plane. Which statement is correct?`,
        `F = (${ngMx}, ${ngNx}) 在整个 xy 平面上有定义且连续可微。下列哪个说法正确？`
      ),
      options: ngIsGrad
        ? [
            t('A gradient field: curl F = 0 at every point and the plane is simply connected.', '是梯度场：每一点 curl F = 0，而且整个平面是单连通的。'),
            t('Not a gradient field: curl F = 0 does not guarantee a potential function.', '不是梯度场：curl F = 0 并不保证存在势函数。'),
            t(`Not a gradient field: M_x = ${coef(ngA, 'y')} is different from N_y = 0.`, `不是梯度场：M_x = ${coef(ngA, 'y')} 与 N_y = 0 不相等。`),
            t('Cannot be decided until a potential function has been written down.', '在写出势函数之前无法判定。'),
          ]
        : [
            t(`Not a gradient field: curl F = ${coef(ngC, 'x')} is not 0 at points with x ≠ 0.`, `不是梯度场：curl F = ${coef(ngC, 'x')} 在 x ≠ 0 的点不为 0。`),
            t('A gradient field: F is defined and continuously differentiable on the whole plane.', '是梯度场：F 在整个平面上有定义且连续可微。'),
            t('A gradient field: curl F = 0 along the y-axis.', '是梯度场：沿 y 轴 curl F = 0。'),
            t('Not a gradient field: F is not defined at the origin.', '不是梯度场：F 在原点没有定义。'),
          ],
      correct: 0,
      hint: t(
        'A gradient field has curl F = 0 at every point. Compute curl F first, then see where it vanishes.',
        '梯度场在每一点都有 curl F = 0。先算 curl F，再看它在哪里为 0。'
      ),
      explanation: ngIsGrad
        ? t(
            `curl F = N_x − M_y = 0. The whole plane is simply connected, so F = ∇f.`,
            `curl F = N_x − M_y = 0。整个平面是单连通的，所以 F = ∇f。`
          )
        : t(
            `curl F = N_x − M_y = ${coef(ngC, 'x')}. This is not 0 when x ≠ 0, so F is not a gradient field.`,
            `curl F = N_x − M_y = ${coef(ngC, 'x')}。当 x ≠ 0 时不为 0，所以 F 不是梯度场。`
          ),
      audit: { kind: 'MIT-MV-44:not-gradient', params: { a: ngA, b: ngB } },
    }),

    g.choice({
      id: 'simply-connected',
      title: t('Simply connected regions', '单连通区域'),
      prompt: t(
        'Which of these regions of the xy-plane is simply connected?',
        '下列 xy 平面上的区域中，哪一个是单连通的？'
      ),
      options: [scCorrectOption, ...scDistractors],
      correct: 0,
      hint: t(
        'Simply connected means one piece, and the inside of every closed curve in the region stays in the region: no holes.',
        '单连通指区域只有一块，并且区域内任一简单闭曲线的内部仍在区域内：没有洞。'
      ),
      explanation: t(
        `The region "${scCorrectOption[0]}" has no holes: every simple closed curve in it has its interior in it. The others fail: they contain a circle around a hole whose interior is not in the region, or are not one connected piece.`,
        `区域「${scCorrectOption[1]}」没有洞：其中任一简单闭曲线的内部仍在其中。其余各项都不满足：它们包含围绕洞的圆，其内部不在区域内，或者不是连成一块。`
      ),
    }),

    g.number({
      id: 'potential-value',
      title: t('Value of a potential function', '势函数的值'),
      prompt: t(
        `F = (${pvM}, ${pvN}) has curl F = 0 on the whole xy-plane, so F = ∇f for some function f. If f(0, 0) = ${pv.c0}, find f(${pv.x0}, ${pv.y0}).`,
        `F = (${pvM}, ${pvN}) 在整个 xy 平面上 curl F = 0，所以 F = ∇f 对某个函数 f 成立。若 f(0, 0) = ${pv.c0}，求 f(${pv.x0}, ${pv.y0})。`
      ),
      fields: [{ label: t('f(x₀, y₀)', 'f(x₀, y₀)'), answer: pvAnswer }],
      hint: t(
        `Use curl F = 0 to know a potential exists, then integrate along (0, 0)→(${pv.x0}, 0)→(${pv.x0}, ${pv.y0}) or find f directly.`,
        `用 curl F = 0 知道势函数存在，然后沿 (0, 0)→(${pv.x0}, 0)→(${pv.x0}, ${pv.y0}) 积分，或直接求 f。`
      ),
      explanation: t(
        `M_y = ${coef(2 * pv.a, 'x')} = N_x, so f exists. f = ${linear([pv.a, pv.b, pv.c], ['x²y', 'x', 'y'])} + ${pv.c0}. So f(${pv.x0}, ${pv.y0}) = ${num(pvAnswer)}.`,
        `M_y = ${coef(2 * pv.a, 'x')} = N_x，所以 f 存在。f = ${linear([pv.a, pv.b, pv.c], ['x²y', 'x', 'y'])} + ${pv.c0}。于是 f(${pv.x0}, ${pv.y0}) = ${num(pvAnswer)}。`
      ),
      audit: { kind: 'MIT-MV-44:potential-value', params: { a: pv.a, b: pv.b, c: pv.c, c0: pv.c0, x0: pv.x0, y0: pv.y0 } },
    }),
    g.number({
      id: 'half-plane-potential',
      title: t('Potential on a half-plane', '半平面上的势函数'),
      prompt: t(
        `On the half-plane ${hpH}, the differential (y dx − x dy)/y² equals df for a function f. Given f(${num(hpX1)}, ${num(hpY1)}) = ${num(hpV1)}, find f(${num(hpX2)}, ${num(hpY2)}). Both points lie in this half-plane.`,
        `在半平面 ${hpH} 上，微分 (y dx − x dy)/y² 等于某个函数的 df。已知 f(${num(hpX1)}, ${num(hpY1)}) = ${num(hpV1)}，求 f(${num(hpX2)}, ${num(hpY2)})。两点都在这个半平面内。`
      ),
      fields: [{ label: t('f(x₂, y₂)', 'f(x₂, y₂)'), answer: hpAnswer }],
      hint: t(
        'Find a function f with f_x = 1/y and f_y = −x/y². Remember that f is only determined up to a constant on this half-plane.',
        '找一个函数 f 满足 f_x = 1/y，f_y = −x/y²。注意在这个半平面上 f 只确定到一个常数。'
      ),
      explanation: t(
        `f = x/y + c on the half-plane ${hpH}. c = ${num(hpV1)} − ${par(hpQ1)} = ${num(hpV1 - hpQ1)}. Then f(${num(hpX2)}, ${num(hpY2)}) = ${num(hpQ2)} + ${par(hpV1 - hpQ1)} = ${num(hpAnswer)}.`,
        `在半平面 ${hpH} 上 f = x/y + c。c = ${num(hpV1)} − ${par(hpQ1)} = ${num(hpV1 - hpQ1)}。于是 f(${num(hpX2)}, ${num(hpY2)}) = ${num(hpQ2)} + ${par(hpV1 - hpQ1)} = ${num(hpAnswer)}。`
      ),
      audit: { kind: 'MIT-MV-44:half-plane-potential', params: { x1: hpX1, y1: hpY1, v1: hpV1, x2: hpX2, y2: hpY2 } },
    }),
    g.choice({
      id: 'exact-region',
      title: t('Exactness of a differential', '微分的恰当性'),
      prompt: t(
        `The differential ω = ${erW} is defined at every point where ${erND}. Which statement is correct?`,
        `微分 ω = ${erW} 在满足 ${erND} 的每一点处有定义。下列哪个说法正确？`
      ),
      options: erVariant === 'A'
        ? [
            t(`Exact on each half-plane y > 0 and y < 0, with f = ${erKRatio} + c on one and f = ${erKRatio} + c′ on the other, where c and c′ are independent.`,
              `在半平面 y > 0 与 y < 0 上各自恰当，一块上 f = ${erKRatio} + c，另一块上 f = ${erKRatio} + c′，c 与 c′ 相互独立。`),
            t(`Exact on each half-plane, but the constants must be equal on both: f = ${erKRatio} + c for every y ≠ 0.`,
              `在每个半平面上恰当，但两块上的常数必须相等：对每个 y ≠ 0，f = ${erKRatio} + c。`),
            t('Exact on the whole xy-plane, because M_y = N_x wherever ω is defined.',
              '在整个 xy 平面上恰当，因为在有定义的地方 M_y = N_x。'),
            t('Not exact anywhere, because the plane without the x-axis is not simply connected.',
              '处处不恰当，因为去掉 x 轴的平面不是单连通的。'),
          ]
        : [
            t(`Exact on each half-plane x > 0 and x < 0, with f = ${erKRatio} + c on one and f = ${erKRatio} + c′ on the other, where c and c′ are independent.`,
              `在半平面 x > 0 与 x < 0 上各自恰当，一块上 f = ${erKRatio} + c，另一块上 f = ${erKRatio} + c′，c 与 c′ 相互独立。`),
            t(`Exact on each half-plane, but the constants must be equal on both: f = ${erKRatio} + c for every x ≠ 0.`,
              `在每个半平面上恰当，但两块上的常数必须相等：对每个 x ≠ 0，f = ${erKRatio} + c。`),
            t('Exact on the whole xy-plane, because M_y = N_x wherever ω is defined.',
              '在整个 xy 平面上恰当，因为在有定义的地方 M_y = N_x。'),
            t('Not exact anywhere, because the plane without the y-axis is not simply connected.',
              '处处不恰当，因为去掉 y 轴的平面不是单连通的。'),
          ],
      correct: 0,
      hint: t(
        'Check where ω is defined, then find f by integrating, and ask whether the two pieces of the domain must share a constant.',
        '先看 ω 在哪里有定义，再积分求 f，并考虑定义域的两块是否必须共用一个常数。'
      ),
      explanation: t(
        `M_y = N_x on each piece, and each piece (${erPieces}) is simply connected, so ω is exact on each: f = ${erKRatio} + c on one and f = ${erKRatio} + c′ on the other. The two pieces do not touch, so c and c′ are independent. ω is not defined on the line ${erLine}, so it is not exact on the whole plane.`,
        `在每一块上 M_y = N_x，而每一块（${erPieces.replace(' and ', ' 与 ')}）都是单连通的，所以 ω 在每一块上恰当：一块上 f = ${erKRatio} + c，另一块上 f = ${erKRatio} + c′。两块不相连，所以 c 与 c′ 相互独立。ω 在直线 ${erLine} 上没有定义，所以它不是整个平面上的恰当微分。`
      ),
    }),

    g.number({
      id: 'unit-circle-work',
      title: t('Line integral around a circle', '绕圆的线积分'),
      prompt: t(
        `F = ${ucFk}. C is the circle of radius ${ucR} centred at the origin, traversed counterclockwise. Compute ∮_C F·dr. Enter an exact multiple of π.`,
        `F = ${ucFk}。C 是以原点为圆心、半径为 ${ucR} 的圆，沿逆时针方向行进。计算 ∮_C F·dr。请输入 π 的精确倍数。`
      ),
      figure: g.figure({
        alt: t(`A circle of radius ${ucR} centred at the origin, with a hollow point at the origin and a counterclockwise arrow.`,
          `以原点为圆心、半径为 ${ucR} 的圆，原点处有一个空心点，以及一个逆时针箭头。`),
        view: fitView(ucShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: ucShapes,
      }),
      fields: [{ label: t('∮_C F·dr (multiple of π)', '∮_C F·dr（π 的倍数）'), answer: ucAnswer }],
      hint: t(
        `Parametrise C by x = ${coef(ucR, 'cos t')}, y = ${coef(ucR, 'sin t')} and simplify M dx + N dy.`,
        `把 C 参数化为 x = ${coef(ucR, 'cos t')}，y = ${coef(ucR, 'sin t')}，并化简 M dx + N dy。`
      ),
      explanation: t(
        `With x = ${coef(ucR, 'cos t')}, y = ${coef(ucR, 'sin t')}: M dx + N dy = ${ucK} dt, so ∮_C F·dr = ∫₀^{2π} ${ucK} dt = ${2 * ucK}π. The radius ${ucR} does not appear in the answer.`,
        `取 x = ${coef(ucR, 'cos t')}，y = ${coef(ucR, 'sin t')}：M dx + N dy = ${ucK} dt，所以 ∮_C F·dr = ∫₀^{2π} ${ucK} dt = ${2 * ucK}π。半径 ${ucR} 不出现在答案中。`
      ),
      audit: { kind: 'MIT-MV-44:unit-circle-work', params: { k: ucK, R: ucR } },
    }),

    g.choice({
      id: 'why-not-conservative',
      title: t('Why is F not conservative?', '为什么 F 不是保守场？'),
      prompt: t(
        `F = ${wncFk} satisfies curl F = 0 at every point where it is defined (every point except the origin). Around the circle C of radius ${wncR} centred at the origin, traversed counterclockwise, ∮_C F·dr = ${wncIntegral}. What does this show?`,
        `F = ${wncFk} 在有定义的每一点（除原点外）都满足 curl F = 0。沿以原点为圆心、半径为 ${wncR}、逆时针行进的圆 C，∮_C F·dr = ${wncIntegral}。这说明什么？`
      ),
      figure: g.figure({
        alt: t(`A circle of radius ${wncR} centred at the origin, with a hollow point at the origin and a counterclockwise arrow.`,
          `以原点为圆心、半径为 ${wncR} 的圆，原点处有一个空心点，以及一个逆时针箭头。`),
        view: fitView(wncShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: wncShapes,
      }),
      options: [
        t('F is not conservative on the plane without the origin, although curl F = 0 there: that region is not simply connected.',
          'F 在去掉原点的平面上不是保守场，尽管那里 curl F = 0：该区域不是单连通的。'),
        t('F is conservative, because curl F = 0 at every point where F is defined.',
          'F 是保守场，因为在 F 有定义的每一点 curl F = 0。'),
        t('The curl criterion is false: it predicts that this integral is 0.',
          '旋度判据是错的：它预测这个积分为 0。'),
        t('curl F is not 0 at the origin, which is why the integral is not 0.',
          'curl F 在原点不为 0，所以积分不为 0。'),
      ],
      correct: 0,
      hint: t(
        'A conservative field has ∮ = 0 over every simple closed curve in its domain. What does the curl criterion require of the domain?',
        '保守场沿其定义域内每条简单闭曲线的 ∮ 都为 0。旋度判据对定义域有什么要求？'
      ),
      explanation: t(
        `The domain is the plane without the origin, which is not simply connected, so curl F = 0 does not imply F = ∇f. The nonzero integral ${wncIntegral} shows F is not conservative there. The curl criterion is not contradicted: its hypothesis fails.`,
        `定义域是去掉原点的平面，它不是单连通的，所以 curl F = 0 并不能推出 F = ∇f。非零的积分 ${wncIntegral} 说明 F 在这里不是保守场。旋度判据并没有被推翻：它的前提不成立。`
      ),
    }),

    g.number({
      id: 'challenge',
      title: t('Challenge: circle not centred at origin', '挑战：圆心不在原点的圆'),
      prompt: t(
        `F = ${chFk}. C is the circle with centre (${num(chH)}, 0) and radius ${chR}, traversed counterclockwise. Compute ∮_C F·dr. Enter 0 or an exact multiple of π.`,
        `F = ${chFk}。C 是圆心为 (${num(chH)}, 0)、半径为 ${chR} 的圆，沿逆时针方向行进。计算 ∮_C F·dr。请输入 0 或 π 的精确倍数。`
      ),
      figure: g.figure({
        alt: t(`A circle with centre (${num(chH)}, 0) and radius ${chR}, with a hollow point at the origin and a counterclockwise arrow.`,
          `圆心为 (${num(chH)}, 0)、半径为 ${chR} 的圆，原点处有一个空心点，以及一个逆时针箭头。`),
        view: fitView(chShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: chShapes,
      }),
      fields: [{ label: t('∮_C F·dr (multiple of π, or 0)', '∮_C F·dr（π 的倍数，或 0）'), answer: chAnswer }],
      hint: t(
        'Is the point where F is not defined inside the circle or outside it? Use the extended Green\'s theorem, or Green\'s theorem when the interior avoids that point.',
        'F 没有定义的那个点在圆内还是圆外？用推广的格林定理；若圆的内部不含该点，直接用格林定理。'
      ),
      explanation: Math.abs(chH) < chR
        ? t(
            `The circle encloses the origin. Using the extended Green's theorem, ∮_C F·dr equals the integral around a small circle about the origin, which is ${2 * chK}π.`,
            `圆内含原点。用推广的格林定理，∮_C F·dr 等于绕原点的小圆上的积分，即 ${2 * chK}π。`
          )
        : t(
            `The interior of C avoids the origin, so Green's theorem gives ∮_C F·dr = ∬ curl F dA = 0.`,
            `C 的内部不含原点，由格林定理 ∮_C F·dr = ∬ curl F dA = 0。`
          ),
      audit: { kind: 'MIT-MV-44:challenge', params: { k: chK, h: chH, R: chR } },
    }),
  ];
};
