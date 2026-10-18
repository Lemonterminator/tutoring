import type { CardGenerator } from '../../types';
import { ellipse, fitView, rect, sampleCurve, type FigureShape, type Pt } from '../../figure';
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

export const mv43: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-43');
  warm(g);

  // --- Card 1: curl-value ---
  const cv = {
    a: g.random(2, 5),
    b: g.random(2, 5),
    x0: g.random(1, 3),
    y0: g.random(1, 3),
  };
  const cvAnswer = cv.a * cv.x0 * cv.x0 + cv.b * cv.y0 * cv.y0;
  const cvMc = coef(-cv.a, 'x²y');
  const cvNc = coef(cv.b, 'xy²');

  // --- Card 2: setup ---
  const st = retry(
    () => ({ p: g.random(1, 5), q: g.random(1, 5) }),
    v => v.p !== v.q && v.p !== 2 * v.q && v.p !== 4 * v.q
  );
  const stAnswer = coef(2 * st.q - st.p, 'x');
  const stTokens = shuffled(g, [
    coef(2 * st.q - st.p, 'x'),
    coef(st.p - 2 * st.q, 'x'),
    coef(2 * st.q + st.p, 'x'),
    coef(2 * st.q, 'x'),
    coef(st.p, 'x'),
  ]);

  // --- Card 3: area-form ---
  const areaItems = [
    { expr: '∮_C x dy', val: 1 },
    { expr: '−∮_C y dx', val: 1 },
    { expr: '½ ∮_C (x dy − y dx)', val: 1 },
    { expr: '∮_C (x dy − y dx)', val: 2 },
    { expr: '∮_C y dx', val: -1 },
    { expr: '−∮_C x dy', val: -1 },
    { expr: '∮_C (x dy + y dx)', val: 0 },
    { expr: '∮_C (x dx + y dy)', val: 0 },
  ];
  const targetVal = g.pick([1, 2, -1, 0]);
  const correctItems = areaItems.filter(it => it.val === targetVal);
  const distractorItems = areaItems.filter(it => it.val !== targetVal);
  const correctItem = correctItems[g.random(0, correctItems.length - 1)];
  const d1 = distractorItems[g.random(0, distractorItems.length - 1)];
  const d2 = distractorItems.find(it => it !== d1)!;
  const d3 = distractorItems.find(it => it !== d1 && it !== d2)!;
  const targetText =
    targetVal === 1 ? t('the area A', '面积 A') :
    targetVal === 2 ? t('twice the area, 2A', '面积的两倍，即 2A') :
    targetVal === -1 ? t('the negative of the area, −A', '面积的相反数，即 −A') :
    t('zero', '零');
  const areaOptions = [correctItem.expr, d1.expr, d2.expr, d3.expr];
  const areaCorrectIdx = 0;

  // --- Card 4: disk ---
  const dk = { a: g.pick([2, 4, 6]), R: g.pick([1, 2, 3]) };
  const dkAnswer = dk.a * dk.R ** 4 * Math.PI / 2;
  const dkMc = coef(-dk.a, 'x²y');
  const dkNc = coef(dk.a, 'xy²');
  const dkShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, dk.R), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [dk.R, 0], to: [dk.R * 0.8, dk.R * 0.6], tone: 'accent', width: 2 },
  ];

  // --- Card 5: linear-field ---
  const lf = retry(
    () => ({ a: g.random(1, 3), b: g.random(1, 3), R: g.pick([1, 2, 3]) }),
    v => v.a !== v.b
  );
  const lfAnswer = (lf.b - lf.a) * lf.R * lf.R * Math.PI;
  const lfShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, lf.R), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [lf.R, 0], to: [lf.R * 0.8, lf.R * 0.6], tone: 'accent', width: 2 },
  ];

  // --- Card 6: orientation ---
  const or = retry(
    () => ({ a: g.random(1, 3), b: g.random(1, 3), R: g.pick([1, 2, 3]) }),
    v => v.a !== v.b
  );
  const orCorrect = (or.a - or.b) * or.R * or.R * Math.PI;
  const orD1 = (or.b - or.a) * or.R * or.R * Math.PI;
  const orD2 = 0;
  const orD3 = 4 * (or.a - or.b) * or.R * or.R * Math.PI;
  const piStr = (v: number): string => {
    const k = v / Math.PI;
    if (k === 0) return '0';
    if (k === 1) return 'π';
    if (k === -1) return '−π';
    return `${num(k)}π`;
  };
  const orOptions = [piStr(orCorrect), piStr(orD1), piStr(orD2), piStr(orD3)];
  const orCorrectIdx = 0;
  const orShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, or.R), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [or.R, 0], to: [or.R * 0.8, -or.R * 0.6], tone: 'accent', width: 2 },
  ];

  // --- Card 7: cycloid ---
  const cy = { a: g.random(1, 6) };
  const cyAnswer = 3 * cy.a * cy.a * Math.PI;
  const cyX = (th: number) => cy.a * (th - Math.sin(th));
  const cyY = (th: number) => cy.a * (1 - Math.cos(th));
  const cyArch = sampleCurve((th: number) => [cyX(th), cyY(th)], 0, 2 * Math.PI);
  const cyEndX = 2 * cy.a * Math.PI;
  const cyShapes: FigureShape[] = [
    { kind: 'area', points: [[0, 0], ...cyArch, [cyEndX, 0]], tone: 'accent', opacity: 0.15 },
    { kind: 'line', points: cyArch, tone: 'accent', width: 2 },
    { kind: 'line', points: [[0, 0], [cyEndX, 0]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [0, 0], to: [cyEndX * 0.3, 0], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [cyEndX, 0], to: [cyX(2 * Math.PI - 0.5), cyY(2 * Math.PI - 0.5)], tone: 'accent', width: 2 },
  ];

  // --- Card 8: off-center ---
  const oc = { h: g.random(1, 3), rho: g.random(1, 3) };
  const ocAnswer = 4 * oc.h * oc.rho * oc.rho * Math.PI;
  const ocShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(oc.h, 0, oc.rho), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [oc.h + oc.rho, 0], to: [oc.h + oc.rho * 0.8, oc.rho * 0.6], tone: 'accent', width: 2 },
    { kind: 'point', at: [oc.h, 0], tone: 'accent', label: `(${oc.h}, 0)` },
  ];

  // --- Card 9: challenge ---
  const ch = retry(
    () => ({ p: g.random(2, 4), q: g.random(2, 4), b: g.pick([2, 3]) }),
    v => v.p !== v.q
  );
  const chAnswer = (ch.q - ch.p) * ch.b ** 3;
  const chShapes: FigureShape[] = [
    { kind: 'area', points: rect(0, 0, ch.b, ch.b), tone: 'accent', opacity: 0.1 },
    { kind: 'line', points: [...rect(0, 0, ch.b, ch.b), [0, 0]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [0, 0], to: [ch.b * 0.4, 0], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [ch.b, 0], to: [ch.b, ch.b * 0.4], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [ch.b, ch.b], to: [ch.b * 0.6, ch.b], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [0, ch.b], to: [0, ch.b * 0.6], tone: 'accent', width: 2 },
  ];

  return [
    g.number({
      id: 'curl-value',
      title: t('Curl of a vector field', '向量场的旋度'),
      prompt: t(
        `F = (M, N) with M = ${cvMc} and N = ${cvNc}. Compute N_x − M_y at the point (${cv.x0}, ${cv.y0}).`,
        `F = (M, N)，其中 M = ${cvMc}，N = ${cvNc}。求 N_x − M_y 在点 (${cv.x0}, ${cv.y0}) 处的值。`
      ),
      fields: [{ label: t('N_x − M_y', 'N_x − M_y'), answer: cvAnswer }],
      hint: t(
        'N_x − M_y: differentiate N with respect to x and M with respect to y.',
        'N_x − M_y：把 N 对 x 求偏导，把 M 对 y 求偏导。'
      ),
      explanation: t(
        `N_x = ${coef(cv.b, 'y²')} and M_y = ${coef(-cv.a, 'x²')}, so N_x − M_y = ${coef(cv.b, 'y²')} + ${coef(cv.a, 'x²')}. At (${cv.x0}, ${cv.y0}) this is ${cv.b}·${cv.y0 * cv.y0} + ${cv.a}·${cv.x0 * cv.x0} = ${num(cvAnswer)}.`,
        `N_x = ${coef(cv.b, 'y²')}，M_y = ${coef(-cv.a, 'x²')}，所以 N_x − M_y = ${coef(cv.b, 'y²')} + ${coef(cv.a, 'x²')}。在 (${cv.x0}, ${cv.y0}) 处等于 ${cv.b}·${cv.y0 * cv.y0} + ${cv.a}·${cv.x0 * cv.x0} = ${num(cvAnswer)}。`
      ),
      audit: { kind: 'MIT-MV-43:curl-value', params: { a: cv.a, b: cv.b, x0: cv.x0, y0: cv.y0 } },
    }),

    g.symbols({
      id: 'setup',
      title: t('Set up Green\'s theorem', '写出格林定理的被积函数'),
      prompt: t(
        `C is a simple closed curve bounding a region R and is traversed counterclockwise. Green's theorem gives ∮_C (${coef(st.p, 'xy')} dx + ${coef(st.q, 'x²')} dy) = ∬_R [ ] dA. Fill in the integrand.`,
        `C 是围成区域 R 的简单闭曲线，沿逆时针方向行进。由格林定理 ∮_C (${coef(st.p, 'xy')} dx + ${coef(st.q, 'x²')} dy) = ∬_R [ ] dA。填写被积函数。`
      ),
      before: t(`∮_C (${coef(st.p, 'xy')} dx + ${coef(st.q, 'x²')} dy) = ∬_R`, `∮_C (${coef(st.p, 'xy')} dx + ${coef(st.q, 'x²')} dy) = ∬_R`),
      after: t(' dA', ' dA'),
      answers: [stAnswer],
      tokens: stTokens,
      hint: t(
        'For a counterclockwise curve the integrand is N_x − M_y. Take both partial derivatives first.',
        '对逆时针曲线，被积函数是 N_x − M_y。先求出两个偏导数。'
      ),
      explanation: t(
        `M = ${coef(st.p, 'xy')} gives M_y = ${coef(st.p, 'x')}; N = ${coef(st.q, 'x²')} gives N_x = ${coef(2 * st.q, 'x')}. N_x − M_y = ${stAnswer}. The opposite order gives ${coef(st.p - 2 * st.q, 'x')}, adding gives ${coef(2 * st.q + st.p, 'x')}, and using only one partial gives ${coef(2 * st.q, 'x')} or ${coef(st.p, 'x')}.`,
        `M = ${coef(st.p, 'xy')} 给出 M_y = ${coef(st.p, 'x')}；N = ${coef(st.q, 'x²')} 给出 N_x = ${coef(2 * st.q, 'x')}。N_x − M_y = ${stAnswer}。相反的次序给出 ${coef(st.p - 2 * st.q, 'x')}，相加给出 ${coef(2 * st.q + st.p, 'x')}，只用一个偏导数则给出 ${coef(2 * st.q, 'x')} 或 ${coef(st.p, 'x')}。`
      ),
    }),
    g.choice({
      id: 'area-form',
      title: t('Area via Green\'s theorem', '用格林定理求面积'),
      prompt: t(
        `R is a region with area A, and C is its boundary traversed counterclockwise. Which expression equals ${targetText[0]}?`,
        `R 是面积为 A 的区域，C 是它的边界，沿逆时针方向行进。下列哪个表达式等于${targetText[1]}？`
      ),
      options: areaOptions.map(s => t(s, s)),
      correct: areaCorrectIdx,
      hint: t(
        'For counterclockwise C, ∮ M dx + N dy = ∬ (N_x − M_y) dA. Which choices of M and N make N_x − M_y a constant, and which constant?',
        '对逆时针的 C，∮ M dx + N dy = ∬ (N_x − M_y) dA。哪些 M、N 使 N_x − M_y 为常数？这个常数是多少？'
      ),
      explanation: t(
        `By Green's theorem each integral equals (value of N_x − M_y)·A. The correct expression has N_x − M_y = ${num(targetVal)}, so it equals ${targetText[0]}.`,
        `由格林定理，每个积分都等于（N_x − M_y 的值）·A。正确的表达式使 N_x − M_y = ${num(targetVal)}，所以它等于${targetText[1]}。`
      ),
    }),
    g.number({
      id: 'disk',
      title: t('Line integral over a disk', '圆盘上的线积分'),
      prompt: t(
        `C is the circle of radius ${dk.R} centred at the origin, traversed counterclockwise. Compute ∮_C (${dkMc} dx + ${dkNc} dy). Enter an exact multiple of π, for example 3pi/2.`,
        `C 是以原点为圆心、半径为 ${dk.R} 的圆，沿逆时针方向行进。计算 ∮_C (${dkMc} dx + ${dkNc} dy)。请输入 π 的精确倍数，例如 3pi/2。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${dk.R} centred at the origin, traversed counterclockwise.`, `以原点为圆心、半径为 ${dk.R} 的圆，沿逆时针方向行进。`),
        view: fitView(dkShapes, 0.3),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: dkShapes,
      }),
      fields: [{ label: t('∮_C F·dr (multiple of π)', '∮_C F·dr（π 的倍数）'), answer: dkAnswer }],
      hint: t(
        "Green's theorem turns the line integral into ∬ (N_x − M_y) dA over the disk. Use polar coordinates with dA = r dr dθ.",
        '格林定理把线积分化为圆盘上的 ∬ (N_x − M_y) dA。用极坐标，dA = r dr dθ。'
      ),
      explanation: t(
        `N_x − M_y = ${dk.a}y² − (${coef(-dk.a, 'x²')}) = ${dk.a}(x² + y²) = ${dk.a}r². The integral is ∫₀^{2π}∫₀^${dk.R} ${dk.a}r²·r dr dθ = 2π·${dk.a}·${dk.R}⁴/4 = ${dk.a * dk.R ** 4 / 2 === 1 ? '' : num(dk.a * dk.R ** 4 / 2)}π.`,
        `N_x − M_y = ${dk.a}y² + ${dk.a}x² = ${dk.a}r²。积分为 ∫₀^{2π}∫₀^${dk.R} ${dk.a}r²·r dr dθ = 2π·${dk.a}·${dk.R}⁴/4 = ${dk.a * dk.R ** 4 / 2 === 1 ? '' : num(dk.a * dk.R ** 4 / 2)}π。`
      ),
      audit: { kind: 'MIT-MV-43:disk', params: { a: dk.a, R: dk.R } },
    }),
    g.number({
      id: 'linear-field',
      title: t('Linear field over a circle', '线性场在圆上的线积分'),
      prompt: t(
        `F = (${coef(lf.a, 'y')}, ${coef(lf.b, 'x')}) and C is the circle of radius ${lf.R} centred at the origin, traversed counterclockwise. Compute ∮_C F·dr. Enter an exact multiple of π.`,
        `F = (${coef(lf.a, 'y')}, ${coef(lf.b, 'x')}), C 是以原点为圆心、半径为 ${lf.R} 的圆，沿逆时针方向行进。计算 ∮_C F·dr。请输入 π 的精确倍数。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${lf.R} centred at the origin, traversed counterclockwise.`, `以原点为圆心、半径为 ${lf.R} 的圆，沿逆时针方向行进。`),
        view: fitView(lfShapes, 0.3),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: lfShapes,
      }),
      fields: [{ label: t('∮_C F·dr (multiple of π)', '∮_C F·dr（π 的倍数）'), answer: lfAnswer }],
      hint: t(
        'N_x − M_y is constant here, so the double integral is that constant times the area of the disk.',
        '这里 N_x − M_y 是常数，所以二重积分等于该常数乘以圆盘面积。'
      ),
      explanation: t(
        `M = ${coef(lf.a, 'y')}, N = ${coef(lf.b, 'x')}: N_x − M_y = ${lf.b} − ${lf.a} = ${num(lf.b - lf.a)}. The area of the disk is π·${lf.R}² = ${piStr(lf.R * lf.R * Math.PI)}, so ∮ = ${num(lf.b - lf.a)}·${piStr(lf.R * lf.R * Math.PI)} = ${piStr((lf.b - lf.a) * lf.R * lf.R * Math.PI)}.`,
        `M = ${coef(lf.a, 'y')}，N = ${coef(lf.b, 'x')}：N_x − M_y = ${lf.b} − ${lf.a} = ${num(lf.b - lf.a)}。圆盘面积为 π·${lf.R}² = ${piStr(lf.R * lf.R * Math.PI)}，所以 ∮ = ${num(lf.b - lf.a)}·${piStr(lf.R * lf.R * Math.PI)} = ${piStr((lf.b - lf.a) * lf.R * lf.R * Math.PI)}。`
      ),
      audit: { kind: 'MIT-MV-43:linear-field', params: { a: lf.a, b: lf.b, R: lf.R } },
    }),

    g.choice({
      id: 'orientation',
      title: t('Effect of orientation', '方向的影响'),
      prompt: t(
        `F = (${coef(or.a, 'y')}, ${coef(or.b, 'x')}) and C is the circle of radius ${or.R} centred at the origin, now traversed clockwise. What is ∮_C F·dr?`,
        `F = (${coef(or.a, 'y')}, ${coef(or.b, 'x')}), C 是以原点为圆心、半径为 ${or.R} 的圆，这次沿顺时针方向行进。∮_C F·dr 等于多少？`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${or.R} centred at the origin, traversed clockwise.`, `以原点为圆心、半径为 ${or.R} 的圆，沿顺时针方向行进。`),
        view: fitView(orShapes, 0.3),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: orShapes,
      }),
      options: orOptions.map(s => t(s, s)),
      correct: orCorrectIdx,
      hint: t(
        "Green's theorem needs the curve traversed counterclockwise. What happens to a line integral when the direction along the curve is reversed?",
        '格林定理要求曲线沿逆时针方向行进。沿曲线的方向反过来时，线积分会怎样？'
      ),
      explanation: t(
        `Counterclockwise the value would be (${or.b} − ${or.a})·π·${or.R}² = ${piStr(orD1)}. Clockwise reverses the sign, so ∮ = ${piStr(orCorrect)}. The value ${piStr(orD1)} forgets the reversal; 0 treats the field as symmetric; ${piStr(orD3)} uses the diameter ${2 * or.R} instead of the radius.`,
        `逆时针时的值为 (${or.b} − ${or.a})·π·${or.R}² = ${piStr(orD1)}。顺时针使符号反号，所以 ∮ = ${piStr(orCorrect)}。值 ${piStr(orD1)} 忘了反号；0 把场看成对称而互相抵消；${piStr(orD3)} 把直径 ${2 * or.R} 当成了半径。`
      ),
      audit: { kind: 'MIT-MV-43:orientation', params: { a: or.a, b: or.b, R: or.R } },
    }),
    g.number({
      id: 'cycloid',
      title: t('Area under a cycloid arch', '摆线拱下的面积'),
      prompt: t(
        `R is the region between the x-axis and one arch of the cycloid x = ${cy.a === 1 ? 'θ − sin θ' : `${cy.a}(θ − sin θ)`}, y = ${cy.a === 1 ? '1 − cos θ' : `${cy.a}(1 − cos θ)`}, 0 ≤ θ ≤ 2π. Its boundary C is traversed counterclockwise: along the x-axis from (0, 0) to (${piStr(cyEndX)}, 0), then back along the arch from θ = 2π to θ = 0. By Green's theorem the area of R equals −∮_C y dx. Find the area. Enter an exact multiple of π.`,
        `R 是 x 轴与摆线 x = ${cy.a === 1 ? 'θ − sin θ' : `${cy.a}(θ − sin θ)`}，y = ${cy.a === 1 ? '1 − cos θ' : `${cy.a}(1 − cos θ)`}（0 ≤ θ ≤ 2π）的一个拱之间的区域。它的边界 C 沿逆时针方向行进：先沿 x 轴从 (0, 0) 到 (${piStr(cyEndX)}, 0)，再沿拱从 θ = 2π 回到 θ = 0。由格林定理，R 的面积等于 −∮_C y dx。求面积。请输入 π 的精确倍数。`
      ),
      figure: g.figure({
        alt: t(`One arch of a cycloid with parameter ${cy.a}, bounded by the x-axis, traversed counterclockwise.`, `参数为 ${cy.a} 的摆线的一个拱，与 x 轴围成区域，沿逆时针方向行进。`),
        view: fitView(cyShapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: cyShapes,
      }),
      fields: [{ label: t('area (multiple of π)', '面积（π 的倍数）'), answer: cyAnswer }],
      hint: t(
        'Follow the stated direction: the x-axis part has y = 0. What is the sign of the arch part when the arch is traversed backwards?',
        '按所述方向走：x 轴部分上 y = 0。沿拱反向行进时，拱这一部分的符号是什么？'
      ),
      explanation: t(
        `On the x-axis y = 0, so that part contributes 0. Along the arch traversed backwards, ∮ y dx = −∫₀^{2π} ${cy.a}²(1 − cos θ)² dθ, so −∮_C y dx = ${cy.a}²∫₀^{2π}(1 − 2cos θ + cos²θ) dθ = ${cy.a}²(2π + π) = ${3 * cy.a * cy.a}π.`,
        `在 x 轴上 y = 0，这一部分贡献为 0。沿拱反向行进时 ∮ y dx = −∫₀^{2π} ${cy.a}²(1 − cos θ)² dθ，所以 −∮_C y dx = ${cy.a}²∫₀^{2π}(1 − 2cos θ + cos²θ) dθ = ${cy.a}²(2π + π) = ${3 * cy.a * cy.a}π。`
      ),
      audit: { kind: 'MIT-MV-43:cycloid', params: { a: cy.a } },
    }),
    g.number({
      id: 'off-center',
      title: t('Off-center circle integral', '偏心圆的线积分'),
      prompt: t(
        `C is the circle with centre (${oc.h}, 0) and radius ${oc.rho}, traversed counterclockwise. Compute I = ∮_C 3x²y² dx + 2x²(1 + xy) dy. Enter an exact multiple of π.`,
        `C 是圆心为 (${oc.h}, 0)、半径为 ${oc.rho} 的圆，沿逆时针方向行进。计算 I = ∮_C 3x²y² dx + 2x²(1 + xy) dy。请输入 π 的精确倍数。`
      ),
      figure: g.figure({
        alt: t(`Circle with centre (${oc.h}, 0) and radius ${oc.rho}, traversed counterclockwise.`, `圆心为 (${oc.h}, 0)、半径为 ${oc.rho} 的圆，沿逆时针方向行进。`),
        view: fitView(ocShapes, 0.3),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: ocShapes,
      }),
      fields: [{ label: t('I (multiple of π)', 'I（π 的倍数）'), answer: ocAnswer }],
      hint: t(
        "Green's theorem first: compute N_x − M_y and look for a term that integrates by using the centre of mass.",
        '先用格林定理：算出 N_x − M_y，找一个可以用质心位置求积分的项。'
      ),
      explanation: t(
        `N = 2x² + 2x³y gives N_x = 4x + 6x²y and M_y = 6x²y, so N_x − M_y = 4x and I = 4∬_R x dA. The disk has area π${oc.rho}² and its centre of mass is at x = ${oc.h}, so ∬_R x dA = ${oc.h}·π${oc.rho}² and I = ${4 * oc.h * oc.rho * oc.rho}π.`,
        `N = 2x² + 2x³y 给出 N_x = 4x + 6x²y，M_y = 6x²y，所以 N_x − M_y = 4x，I = 4∬_R x dA。圆盘面积为 π${oc.rho}²，质心在 x = ${oc.h}，所以 ∬_R x dA = ${oc.h}·π${oc.rho}²，I = ${4 * oc.h * oc.rho * oc.rho}π。`
      ),
      audit: { kind: 'MIT-MV-43:off-center', params: { h: oc.h, rho: oc.rho } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: square boundary', '挑战：正方形边界'),
      prompt: t(
        `C is the boundary of the square 0 ≤ x ≤ ${ch.b}, 0 ≤ y ≤ ${ch.b}, traversed counterclockwise. Compute ∮_C ${coef(ch.p, 'y²')} dx + ${coef(ch.q, 'x²')} dy.`,
        `C 是正方形 0 ≤ x ≤ ${ch.b}，0 ≤ y ≤ ${ch.b} 的边界，沿逆时针方向行进。计算 ∮_C ${coef(ch.p, 'y²')} dx + ${coef(ch.q, 'x²')} dy。`
      ),
      figure: g.figure({
        alt: t(`Square 0 ≤ x ≤ ${ch.b}, 0 ≤ y ≤ ${ch.b}, boundary traversed counterclockwise.`, `正方形 0 ≤ x ≤ ${ch.b}，0 ≤ y ≤ ${ch.b}，边界沿逆时针方向行进。`),
        view: fitView(chShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: chShapes,
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: chAnswer }],
      hint: t(
        "Use Green's theorem and integrate N_x − M_y over the square.",
        '用格林定理，对正方形积分 N_x − M_y。'
      ),
      explanation: t(
        `M = ${coef(ch.p, 'y²')} gives M_y = ${coef(2 * ch.p, 'y')}; N = ${coef(ch.q, 'x²')} gives N_x = ${coef(2 * ch.q, 'x')}. ∬ over the square of (${coef(2 * ch.q, 'x')} − ${coef(2 * ch.p, 'y')}) dA = ${ch.q}·${ch.b}³ − ${ch.p}·${ch.b}³ = ${num(chAnswer)}. This game does not assess proving Green's theorem or integrating around curves that have no convenient parametrisation.`,
        `M = ${coef(ch.p, 'y²')} 给出 M_y = ${coef(2 * ch.p, 'y')}；N = ${coef(ch.q, 'x²')} 给出 N_x = ${coef(2 * ch.q, 'x')}。在正方形上对 (${coef(2 * ch.q, 'x')} − ${coef(2 * ch.p, 'y')}) 求二重积分，得 ${ch.q}·${ch.b}³ − ${ch.p}·${ch.b}³ = ${num(chAnswer)}。本游戏不考察格林定理的证明，也不考察没有方便参数化的曲线上的线积分。`
      ),
      audit: { kind: 'MIT-MV-43:challenge', params: { p: ch.p, q: ch.q, b: ch.b } },
    }),
  ];
};
