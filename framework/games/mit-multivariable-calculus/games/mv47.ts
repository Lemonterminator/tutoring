import type { CardGenerator } from '../../types';
import { ellipse, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, makeMvDeck, num, par, piTerm, term, type Text } from '../support';

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

export const mv47: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-47');
  warm(g);

  // circle-integral
  const ci = { k: g.pick([1, 2, 3]), a: g.pick([1, 2, 3]) };
  const ciAns = 2 * ci.k * Math.PI;

  // crossings
  const cr = retry(() => ({ u: g.pick([1, 2, 3, 4]), d: g.pick([0, 1, 2, 3]) }), v => v.u !== v.d);
  const crAns = 2 * (cr.u - cr.d) * Math.PI;

  // negative-orientation
  const no = { k: g.pick([1, 2, 3]), a: g.pick([1, 2, 3]) };
  const noAns = -2 * no.k * Math.PI;

  // enclose-check
  const inside = g.random(0, 1) < 0.5;
  let ec: { k: number; a: number; cx: number; cy: number };
  if (inside) {
    const a = g.pick([3, 4, 5]);
    const centers: [number, number][] = [[1, 1], [-1, 2], [2, 0], [0, -2], [-2, -1]];
    const [cx, cy] = centers[g.random(0, centers.length - 1)];
    ec = { k: g.pick([1, 2, 3]), a, cx, cy };
  } else {
    const a = g.pick([1, 2]);
    const centers: [number, number][] = [[3, 0], [0, -3], [-3, -1], [2, 3], [-4, 0]];
    const [cx, cy] = centers[g.random(0, centers.length - 1)];
    ec = { k: g.pick([1, 2, 3]), a, cx, cy };
  }
  const ecD2 = ec.cx * ec.cx + ec.cy * ec.cy;
  const ecInside = ecD2 < ec.a * ec.a;
  const ecAns = ecInside ? 2 * ec.k * Math.PI : 0;

  // assumption-fails
  const af = { k: g.pick([1, 2, 3]), a: g.pick([1, 2, 3]) };

  // extended-setup
  const curveNames = g.pick([
    { co: 'C₂', ci: 'C₃' },
    { co: 'C₁', ci: 'C₂' },
    { co: 'C_out', ci: 'C_in' },
  ]);
  const fieldNames = g.pick([
    { M: 'M', N: 'N' },
    { M: 'P', N: 'Q' },
  ]);
  const integrandToken = `${fieldNames.N}_x − ${fieldNames.M}_y`;
  const distractor1 = `${fieldNames.M}_x + ${fieldNames.N}_y`;
  const distractor2 = `${fieldNames.N}_y − ${fieldNames.M}_x`;

  // exactness-region
  const exVariant = g.pick(['A', 'B']);
  const exC = g.pick([1, 2, 3]);

  // half-plane-work
  const hp = retry(() => {
    const c = g.pick([1, 2, 3]);
    const y1 = g.pick([1, 2, 4]);
    const y2 = g.pick([1, 2, 4]);
    const x1 = g.pick([-3, -2, -1, 0, 1, 2, 3]);
    const x2 = g.pick([-3, -2, -1, 0, 1, 2, 3]);
    return { c, y1, y2, x1, x2 };
  }, v => v.c * (v.x2 / v.y2 - v.x1 / v.y1) !== 0);
  const hpAns = hp.c * (hp.x2 / hp.y2 - hp.x1 / hp.y1);

  // challenge
  const ch = retry(() => {
    const c = g.pick([-1, 1, 2, 3]);
    const s = g.pick([1, 2, 3]);
    return { c, s };
  }, v => (2 + v.c * v.s * v.s) !== 0);
  const chAns = (2 + ch.c * ch.s * ch.s) * Math.PI;

  // Helper for field text
  const fieldText = (k: number) => k === 1 ? '(−y, x)/(x² + y²)' : `${k}(−y, x)/(x² + y²)`;

  // Figure helpers
  const makeCircleFigure = (radius: number, ccw: boolean, center: Pt = [0, 0]): FigureShape[] => {
    const shapes: FigureShape[] = [];
    // Circle as ellipse
    shapes.push({ kind: 'line', points: ellipse(center[0], center[1], radius, radius), tone: 'accent', width: 2 });
    // Arrow indicating direction
    const angle = ccw ? Math.PI / 4 : -Math.PI / 4;
    const ax = center[0] + radius * Math.cos(angle);
    const ay = center[1] + radius * Math.sin(angle);
    const tangentAngle = ccw ? angle + Math.PI / 2 : angle - Math.PI / 2;
    const arrowLen = 0.5;
    const from: Pt = [ax - arrowLen / 2 * Math.cos(tangentAngle), ay - arrowLen / 2 * Math.sin(tangentAngle)];
    const to: Pt = [ax + arrowLen / 2 * Math.cos(tangentAngle), ay + arrowLen / 2 * Math.sin(tangentAngle)];
    shapes.push({ kind: 'arrow', from, to, tone: 'accent', width: 2 });
    // Origin point
    shapes.push({ kind: 'point', at: [0, 0], tone: 'text', label: 'O' });
    return shapes;
  };

  const makeCrossingsFigure = (u: number, d: number): FigureShape[] => {
    const shapes: FigureShape[] = [];
    // Positive x-axis
    shapes.push({ kind: 'line', points: [[0, 0], [5, 0]], tone: 'axis', width: 2 });
    shapes.push({ kind: 'text', at: [2.5, -0.3], text: 'positive x-axis', tone: 'muted' });
    // Origin
    shapes.push({ kind: 'point', at: [0, 0], tone: 'text', label: 'O' });
    // Upward arrows
    for (let i = 0; i < u; i++) {
      const x = 0.8 + 0.6 * i;
      shapes.push({ kind: 'arrow', from: [x, -0.6], to: [x, 0.6], tone: 'accent', width: 2 });
    }
    // Downward arrows
    for (let i = 0; i < d; i++) {
      const x = 0.8 + 0.6 * (u + i);
      shapes.push({ kind: 'arrow', from: [x, 0.6], to: [x, -0.6], tone: 'warn', width: 2 });
    }
    return shapes;
  };

  const makeEncloseFigure = (cx: number, cy: number, a: number): FigureShape[] => {
    const shapes: FigureShape[] = [];
    shapes.push({ kind: 'line', points: ellipse(cx, cy, a, a), tone: 'accent', width: 2 });
    // Center label
    shapes.push({ kind: 'text', at: [cx, cy + a + 0.3], text: `(${cx}, ${cy})`, tone: 'text' });
    // Origin
    shapes.push({ kind: 'point', at: [0, 0], tone: 'text', label: 'O' });
    // CCW arrow
    const angle = Math.PI / 4;
    const ax = cx + a * Math.cos(angle);
    const ay = cy + a * Math.sin(angle);
    const tangentAngle = angle + Math.PI / 2;
    const arrowLen = 0.5;
    const from: Pt = [ax - arrowLen / 2 * Math.cos(tangentAngle), ay - arrowLen / 2 * Math.sin(tangentAngle)];
    const to: Pt = [ax + arrowLen / 2 * Math.cos(tangentAngle), ay + arrowLen / 2 * Math.sin(tangentAngle)];
    shapes.push({ kind: 'arrow', from, to, tone: 'accent', width: 2 });
    return shapes;
  };

  const makeExtendedFigure = (co: string, ci: string): FigureShape[] => {
    const shapes: FigureShape[] = [];
    // Outer circle radius 2
    shapes.push({ kind: 'line', points: ellipse(0, 0, 2, 2), tone: 'accent', width: 2 });
    shapes.push({ kind: 'text', at: [2, 0.3], text: co, tone: 'accent' });
    // Inner circle radius 1
    shapes.push({ kind: 'line', points: ellipse(0, 0, 1, 1), tone: 'accent2', width: 2 });
    shapes.push({ kind: 'text', at: [1, 0.3], text: ci, tone: 'accent2' });
    // CCW arrows
    const angle1 = Math.PI / 4;
    const ax1 = 2 * Math.cos(angle1);
    const ay1 = 2 * Math.sin(angle1);
    const t1 = angle1 + Math.PI / 2;
    shapes.push({ kind: 'arrow', from: [ax1 - 0.25 * Math.cos(t1), ay1 - 0.25 * Math.sin(t1)], to: [ax1 + 0.25 * Math.cos(t1), ay1 + 0.25 * Math.sin(t1)], tone: 'accent', width: 2 });
    const angle2 = Math.PI / 4;
    const ax2 = Math.cos(angle2);
    const ay2 = Math.sin(angle2);
    const t2 = angle2 + Math.PI / 2;
    shapes.push({ kind: 'arrow', from: [ax2 - 0.25 * Math.cos(t2), ay2 - 0.25 * Math.sin(t2)], to: [ax2 + 0.25 * Math.cos(t2), ay2 + 0.25 * Math.sin(t2)], tone: 'accent2', width: 2 });
    return shapes;
  };

  const makeChallengeFigure = (s: number): FigureShape[] => {
    return makeCircleFigure(s, true);
  };

  return [
    g.number({
      id: 'circle-integral',
      title: t('Line integral around a circle', '沿圆的线积分'),
      prompt: t(
        `On the punctured plane D = R² − {(0, 0)} let F = ${fieldText(ci.k)}. C is the circle of radius ${ci.a} centred at the origin, traversed counterclockwise. Find ∮_C F·dr. Give the exact value, for example 6pi.`,
        `在去掉原点的平面 D = R² − {(0, 0)} 上，设 F = ${fieldText(ci.k)}。C 是以原点为圆心、半径为 ${ci.a} 的圆，沿逆时针方向绕行。求 ∮_C F·dr，写出精确值，例如 6pi。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${ci.a} with counterclockwise arrow.`, `半径为 ${ci.a} 的圆，逆时针箭头。`),
        view: fitView(makeCircleFigure(ci.a, true), 0.3),
        shapes: makeCircleFigure(ci.a, true),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: ciAns }],
      hint: t('On the circle F points along the tangent: find F·T and integrate it over the length of the circle.', '在圆上 F 沿切线方向：先求 F·T，再沿圆的全长积分。'),
      explanation: t(
        `On the circle F·T = |F| = ${ci.k}/${ci.a}, so ∮_C F·dr = ∮ F·T ds = (${ci.k}/${ci.a})·(2π·${ci.a}) = ${2 * ci.k}π, whatever the radius.`,
        `在圆上 F·T = |F| = ${ci.k}/${ci.a}，所以 ∮_C F·dr = ∮ F·T ds = (${ci.k}/${ci.a})·(2π·${ci.a}) = ${2 * ci.k}π，与半径无关。`
      ),
      audit: { kind: 'MIT-MV-47:circle-integral', params: { k: ci.k, a: ci.a } },
    }),
    g.number({
      id: 'crossings',
      title: t('Winding number from crossings', '由穿越次数求圈数'),
      prompt: t(
        `Let F = (−y, x)/(x² + y²) on R² − {(0, 0)}. C is a closed curve that does not pass through the origin. It crosses the positive x-axis exactly ${cr.u} ${cr.u === 1 ? 'time' : 'times'} from below to above and ${cr.d === 0 ? 'never' : `exactly ${cr.d} ${cr.d === 1 ? 'time' : 'times'}`} from above to below, and these are all its crossings of the positive x-axis. Find ∮_C F·dr. Give the exact value, for example 4pi.`,
        `设 F = (−y, x)/(x² + y²)，定义在 R² − {(0, 0)} 上。C 是不经过原点的闭曲线，它恰好 ${cr.u} 次自下而上穿过正 x 轴，${cr.d === 0 ? '从不' : `恰好 ${cr.d} 次`}自上而下穿过正 x 轴，这就是它穿过正 x 轴的全部情形。求 ∮_C F·dr，写出精确值，例如 4pi。`
      ),
      figure: g.figure({
        alt: t(`The positive x-axis with ${cr.u} ${cr.u === 1 ? 'arrow' : 'arrows'} crossing it upward and ${cr.d} ${cr.d === 1 ? 'arrow' : 'arrows'} crossing it downward.`, `正 x 轴上有 ${cr.u} 个向上穿越的箭头和 ${cr.d} 个向下穿越的箭头。`),
        view: fitView(makeCrossingsFigure(cr.u, cr.d), 0.3),
        shapes: makeCrossingsFigure(cr.u, cr.d),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: crAns }],
      hint: t('The integral is 2π times the winding number of C around the origin, and the winding number counts crossings of the positive x-axis: +1 from below, −1 from above.', '积分等于 2π 乘以 C 绕原点的圈数；圈数可以数 C 穿过正 x 轴的次数：自下而上记 +1，自上而下记 −1。'),
      explanation: t(
        `The winding number is n = ${cr.u} − ${cr.d} = ${num(cr.u - cr.d)}, so ∮_C F·dr = 2πn = ${num(2 * (cr.u - cr.d))}π.`,
        `圈数 n = ${cr.u} − ${cr.d} = ${num(cr.u - cr.d)}，所以 ∮_C F·dr = 2πn = ${num(2 * (cr.u - cr.d))}π。`
      ),
      audit: { kind: 'MIT-MV-47:crossings', params: { u: cr.u, d: cr.d } },
    }),
    g.number({
      id: 'negative-orientation',
      title: t('Clockwise orientation', '顺时针方向'),
      prompt: t(
        `On R² − {(0, 0)} let F = ${fieldText(no.k)}. C is the circle of radius ${no.a} centred at the origin, traversed CLOCKWISE. Find ∮_C F·dr. Give the exact value.`,
        `在 R² − {(0, 0)} 上，设 F = ${fieldText(no.k)}。C 是以原点为圆心、半径为 ${no.a} 的圆，沿顺时针方向绕行。求 ∮_C F·dr，写出精确值。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${no.a} with clockwise arrow.`, `半径为 ${no.a} 的圆，顺时针箭头。`),
        view: fitView(makeCircleFigure(no.a, false), 0.3),
        shapes: makeCircleFigure(no.a, false),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: noAns }],
      hint: t('Reversing the direction of travel changes the sign of a line integral.', '反向绕行会使线积分变号。'),
      explanation: t(
        `Counterclockwise the integral is ${2 * no.k}π (F·T = ${no.k}/${no.a} ${no.a === 1 ? 'time' : 'times'} the length 2π·${no.a}). Clockwise the tangent is reversed, so F·T = −${no.k}/${no.a} and the integral is −${2 * no.k}π.`,
        `逆时针时积分为 ${2 * no.k}π（F·T = ${no.k}/${no.a}，乘以周长 2π·${no.a}）。顺时针时切向量反向，F·T = −${no.k}/${no.a}，积分为 −${2 * no.k}π。`
      ),
      audit: { kind: 'MIT-MV-47:negative-orientation', params: { k: no.k, a: no.a } },
    }),
    g.number({
      id: 'enclose-check',
      title: t('Does the curve enclose the origin?', '曲线是否包围原点？'),
      prompt: t(
        `On R² − {(0, 0)} let F = ${fieldText(ec.k)}. C is the circle of radius ${ec.a} centred at (${num(ec.cx)}, ${num(ec.cy)}), traversed counterclockwise. Find ∮_C F·dr. Give the exact value (0 is allowed).`,
        `在 R² − {(0, 0)} 上，设 F = ${fieldText(ec.k)}。C 是圆心为 (${num(ec.cx)}, ${num(ec.cy)})、半径为 ${ec.a} 的圆，沿逆时针方向绕行。求 ∮_C F·dr，写出精确值（可以是 0）。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${ec.a} centred at (${num(ec.cx)}, ${num(ec.cy)}).`, `圆心为 (${num(ec.cx)}, ${num(ec.cy)})、半径为 ${ec.a} 的圆。`),
        view: fitView(makeEncloseFigure(ec.cx, ec.cy, ec.a), 0.3),
        shapes: makeEncloseFigure(ec.cx, ec.cy, ec.a),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: ecAns }],
      hint: t('Decide whether the origin is inside C: compare cx² + cy² with the radius squared. Then use what you know about curves that go around the origin or not.', '先判断原点是否在 C 的内部：比较 cx² + cy² 与半径的平方。再用你已知的关于绕原点与不绕原点的闭曲线的结论。'),
      explanation: t(
        `The centre is at distance² ${par(ec.cx)}² + ${par(ec.cy)}² = ${ecD2} from the origin, and the radius² is ${ec.a}² = ${ec.a * ec.a}. ${ecInside ? `Since ${ecD2} < ${ec.a * ec.a}, the origin lies inside C, so the integral is ${2 * ec.k}π.` : `Since ${ecD2} > ${ec.a * ec.a}, the origin lies outside C; F is continuously differentiable with curl F = 0 on the disc inside C, so Green's theorem gives 0.`}`,
        `圆心到原点的距离的平方是 ${par(ec.cx)}² + ${par(ec.cy)}² = ${ecD2}，半径的平方是 ${ec.a}² = ${ec.a * ec.a}。${ecInside ? `因为 ${ecD2} < ${ec.a * ec.a}，原点在 C 的内部，所以积分为 ${2 * ec.k}π。` : `因为 ${ecD2} > ${ec.a * ec.a}，原点在 C 的外部；圆盘内 F 连续可微且 curl F = 0，由格林定理积分为 0。`}`
      ),
      audit: { kind: 'MIT-MV-47:enclose-check', params: { k: ec.k, a: ec.a, cx: ec.cx, cy: ec.cy } },
    }),
    g.choice({
      id: 'assumption-fails',
      title: t('Why Green\'s theorem fails', '格林定理为何失效'),
      prompt: t(
        `A student argues: "F = ${fieldText(af.k)} has curl F = 0 at every point of D = R² − {(0, 0)}. For the circle C of radius ${af.a} around the origin, traversed counterclockwise, Green's theorem gives ∮_C F·dr = ∬ curl F dA = 0." This conclusion is false. What is wrong with the argument?`,
        `一位同学这样论证：“F = ${fieldText(af.k)} 在 D = R² − {(0, 0)} 的每一点都有 curl F = 0。对以原点为圆心、半径为 ${af.a} 的逆时针圆 C，格林定理给出 ∮_C F·dr = ∬ curl F dA = 0。”这个结论是错的。论证错在哪里？`
      ),
      options: [
        t('F is not defined at the origin, which lies inside C, so F is not continuously differentiable on the whole region enclosed by C and Green\'s theorem does not apply there.', 'F 在原点没有定义，而原点在 C 的内部，所以 F 在 C 围成的整个区域上并不连续可微，格林定理在这里不能用。'),
        t('curl F is not 0 at some points of C itself, so the double integral is not 0.', '在 C 本身的某些点上 curl F 不为 0，所以二重积分不为 0。'),
        t('A circle is not a simple closed curve, so Green\'s theorem cannot be used.', '圆不是简单闭曲线，所以不能用格林定理。'),
        t('The disc inside C is not simply connected.', 'C 内部的圆盘不是单连通的。'),
      ],
      correct: 0,
      hint: t('Check the hypotheses of Green\'s theorem on the whole region inside C, not only the value of curl F at points where F is defined.', '检查格林定理的条件是否在 C 围成的整个区域上成立，而不只是看 F 有定义的那些点上的 curl F。'),
      explanation: t(
        `The vector field is not defined at the origin, which lies inside C, so it is not continuously differentiable on the entire region enclosed by C. This violates a hypothesis of Green\'s theorem, so the theorem cannot be applied.`,
        `向量场在原点没有定义，而原点在 C 内部，因此它在 C 围成的整个区域上并不连续可微。这违反了格林定理的一个条件，所以定理不能使用。`
      ),
    }),
    g.symbols({
      id: 'extended-setup',
      title: t('Extended Green\'s theorem setup', '扩展格林定理的表达式'),
      prompt: t(
        `R is the region between two simple closed curves: the outer curve ${curveNames.co} and the inner curve ${curveNames.ci}. Both are traversed counterclockwise. F = (${fieldNames.M}, ${fieldNames.N}) is continuously differentiable on R and on its boundary. Complete the extended Green's theorem: ∮_${curveNames.co} F·dr [ ] ∮_${curveNames.ci} F·dr = ∬_R [ ] dA.`,
        `R 是两条简单闭曲线之间的区域：外曲线 ${curveNames.co} 与内曲线 ${curveNames.ci}，二者都沿逆时针方向绕行。F = (${fieldNames.M}, ${fieldNames.N}) 在 R 及其边界上连续可微。补全扩展的格林定理：∮_${curveNames.co} F·dr [ ] ∮_${curveNames.ci} F·dr = ∬_R [ ] dA。`
      ),
      before: t(`∮_${curveNames.co} F·dr`, `∮_${curveNames.co} F·dr`),
      between: [` ∮_${curveNames.ci} F·dr = ∬_R `],
      after: t(' dA', ' dA'),
      answers: ['−', integrandToken],
      tokens: shuffled(g, ['+', '−', integrandToken, distractor1, distractor2]),
      hint: t('As part of the boundary of R, the inner curve must be traversed clockwise. What does reversing its direction do to its integral?', '作为 R 的边界的一部分，内曲线必须沿顺时针方向绕行。反向会对它的积分产生什么影响？'),
      explanation: t(
        `The boundary of R is the outer curve counterclockwise and the inner curve clockwise, so ∮_${curveNames.co} − ∮_${curveNames.ci} (both counterclockwise) = ∬_R curl F·k dA with curl F·k = ${fieldNames.N}_x − ${fieldNames.M}_y. When curl F = 0 this gives ∮_${curveNames.co} = ∮_${curveNames.ci}.`,
        `R 的边界由逆时针的外曲线和顺时针的内曲线组成，所以 ∮_${curveNames.co} − ∮_${curveNames.ci}（二者都取逆时针）= ∬_R curl F·k dA，其中 curl F·k = ${fieldNames.N}_x − ${fieldNames.M}_y。当 curl F = 0 时得到 ∮_${curveNames.co} = ∮_${curveNames.ci}。`
      ),
      figure: g.figure({
        alt: t(`Two concentric circles: outer ${curveNames.co}, inner ${curveNames.ci}.`, `两个同心圆：外圆 ${curveNames.co}，内圆 ${curveNames.ci}。`),
        view: fitView(makeExtendedFigure(curveNames.co, curveNames.ci), 0.3),
        shapes: makeExtendedFigure(curveNames.co, curveNames.ci),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
    }),
    g.choice({
      id: 'exactness-region',
      title: t('Where is F exact?', 'F 在哪个区域上恰当？'),
      prompt: exVariant === 'A'
        ? t(
            `Let F = (${exC === 1 ? '1/y' : `${exC}/y`}) i − (${exC === 1 ? 'x/y²' : `${exC}x/y²`}) j, that is M = ${exC === 1 ? '1/y' : `${exC}/y`} and N = −${exC === 1 ? 'x/y²' : `${exC}x/y²`}. On which region is F exact, that is, has a potential function?`,
            `设 F = (${exC === 1 ? '1/y' : `${exC}/y`}) i − (${exC === 1 ? 'x/y²' : `${exC}x/y²`}) j，即 M = ${exC === 1 ? '1/y' : `${exC}/y`}，N = −${exC === 1 ? 'x/y²' : `${exC}x/y²`}。F 在哪个区域上是恰当的（有势函数）？`
          )
        : t(
            `Let F = ${fieldText(exC)}; curl F = 0 wherever F is defined. On which of these regions is F exact (has a potential function)?`,
            `设 F = ${fieldText(exC)}，在 F 有定义的地方 curl F = 0。F 在下列哪个区域上是恰当的（有势函数）？`
          ),
      options: exVariant === 'A'
        ? [
            t(`Everywhere it is defined: on y > 0 and on y < 0, where M_y = N_x = −${exC}/y² and each half-plane is simply connected.`, `在它有定义的每个地方：在 y > 0 和 y < 0 上，那里 M_y = N_x = −${exC}/y²，且每个半平面都是单连通的。`),
            t('On the whole plane R².', '在整个平面 R² 上。'),
            t('Nowhere, because the region y ≠ 0 is not simply connected.', '哪里都不是，因为区域 y ≠ 0 不是单连通的。'),
            t('Only on the half-plane x > 0, because M_y = N_x only there.', '只在半平面 x > 0 上，因为只有那里 M_y = N_x。'),
          ]
        : [
            t('On the half-plane x > 0: it is simply connected, F is continuously differentiable there and curl F = 0.', '在半平面 x > 0 上：它是单连通的，F 在其上连续可微且 curl F = 0。'),
            t('On the whole punctured plane R² − {(0, 0)}, because curl F = 0 there.', '在整个去掉原点的平面 R² − {(0, 0)} 上，因为那里 curl F = 0。'),
            t('On the whole plane R².', '在整个平面 R² 上。'),
            t('Nowhere, because curl F ≠ 0.', '哪里都不是，因为 curl F ≠ 0。'),
          ],
      correct: 0,
      hint: t('For a continuously differentiable field, curl F = 0 on a simply connected domain is sufficient for exactness; simple connectivity is not necessary.', '对连续可微的场，在单连通定义域上 curl F = 0 是恰当性的充分条件；单连通不是必要条件。'),
      explanation: exVariant === 'A'
        ? t(
            `F is defined for y ≠ 0, which is the two half-planes y > 0 and y < 0, each simply connected. In both, M_y = −${exC}/y² = N_x, so F is exact there: f = ${exC === 1 ? '' : exC}x/y + constant works on each half-plane. F is not defined on the x-axis, so it is not exact on R².`,
            `F 在 y ≠ 0 时有定义，即在 y > 0 和 y < 0 两个半平面上，每个都单连通。两处都有 M_y = −${exC}/y² = N_x，所以 F 在那里恰当：每个半平面上 f = ${exC === 1 ? '' : exC}x/y + 常数 都是势函数。F 在 x 轴上没有定义，所以在 R² 上不恰当。`
          )
        : t(
            `On the punctured plane curl F = 0, but the integral around the origin is ${piTerm(2 * exC)} ≠ 0, so no potential exists there: the punctured plane is not simply connected. On the half-plane x > 0, which is simply connected, curl F = 0 does give a potential (${exC}·arctan(y/x)).`,
            `在去掉原点的平面上 curl F = 0，但绕原点一圈的积分是 ${piTerm(2 * exC)} ≠ 0，所以那里没有势函数：去掉原点的平面不是单连通的。在单连通的半平面 x > 0 上，curl F = 0 就保证有势函数（${exC}·arctan(y/x)）。`
          ),
    }),
    g.number({
      id: 'half-plane-work',
      title: t('Path-independent integral in the upper half-plane', '上半平面内与路径无关的积分'),
      prompt: t(
        `F = (${hp.c === 1 ? '1/y' : `${hp.c}/y`}) i − (${hp.c === 1 ? 'x/y²' : `${hp.c}x/y²`}) j is defined for y ≠ 0. C is any smooth path from A = (${num(hp.x1)}, ${hp.y1}) to B = (${num(hp.x2)}, ${hp.y2}) that stays in the upper half-plane y > 0. Find ∫_C F·dr.`,
        `F = (${hp.c === 1 ? '1/y' : `${hp.c}/y`}) i − (${hp.c === 1 ? 'x/y²' : `${hp.c}x/y²`}) j 在 y ≠ 0 时有定义。C 是从 A = (${num(hp.x1)}, ${hp.y1}) 到 B = (${num(hp.x2)}, ${hp.y2}) 的任意光滑路径，且始终留在上半平面 y > 0 内。求 ∫_C F·dr。`
      ),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: hpAns }],
      hint: t(`On y > 0, F has a potential function. Integrate M = ${hp.c === 1 ? '1/y' : `${hp.c}/y`} with respect to x and then fix the part that depends only on y.`, `在 y > 0 上 F 有势函数。对 M = ${hp.c === 1 ? '1/y' : `${hp.c}/y`} 关于 x 积分，再确定只依赖 y 的部分。`),
      explanation: t(
        `On y > 0, f(x, y) = ${hp.c === 1 ? 'x/y' : `${hp.c}x/y`} is a potential function (f_x = ${hp.c === 1 ? '1/y' : `${hp.c}/y`}, f_y = −${hp.c === 1 ? 'x/y²' : `${hp.c}x/y²`}). So ∫_C F·dr = f(B) − f(A) = ${hp.c}·${par(hp.x2)}/${hp.y2} − ${hp.c}·${par(hp.x1)}/${hp.y1} = ${num(hpAns)}, whatever the path in the half-plane.`,
        `在 y > 0 上 f(x, y) = ${hp.c === 1 ? 'x/y' : `${hp.c}x/y`} 是势函数（f_x = ${hp.c === 1 ? '1/y' : `${hp.c}/y`}, f_y = −${hp.c === 1 ? 'x/y²' : `${hp.c}x/y²`}）。所以 ∫_C F·dr = f(B) − f(A) = ${hp.c}·${par(hp.x2)}/${hp.y2} − ${hp.c}·${par(hp.x1)}/${hp.y1} = ${num(hpAns)}，与半平面内的路径无关。`
      ),
      audit: { kind: 'MIT-MV-47:half-plane-work', params: { c: hp.c, x1: hp.x1, y1: hp.y1, x2: hp.x2, y2: hp.y2 } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: mixed field', '挑战：混合场'),
      prompt: t(
        `Let F = (−y/(x² + y²)) i + (x/(x² + y²) ${ch.c < 0 ? '−' : '+'} ${coef(Math.abs(ch.c), 'x')}) j, defined away from the origin. C is the circle of radius ${ch.s} centred at the origin, traversed counterclockwise. Find ∮_C F·dr. Give the exact value, for example 14pi.`,
        `设 F = (−y/(x² + y²)) i + (x/(x² + y²) ${ch.c < 0 ? '−' : '+'} ${coef(Math.abs(ch.c), 'x')}) j，在原点以外有定义。C 是以原点为圆心、半径为 ${ch.s} 的圆，沿逆时针方向绕行。求 ∮_C F·dr，写出精确值，例如 14pi。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${ch.s} with counterclockwise arrow.`, `半径为 ${ch.s} 的圆，逆时针箭头。`),
        view: fitView(makeChallengeFigure(ch.s), 0.3),
        shapes: makeChallengeFigure(ch.s),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: chAns }],
      hint: t(`Split F into the tangential field (−y, x)/(x² + y²) and the remaining part (0, ${coef(ch.c, 'x')}). Treat each part with the tool that suits it.`, `把 F 拆成切向场 (−y, x)/(x² + y²) 与其余部分 (0, ${coef(ch.c, 'x')})，对每一部分用合适的方法。`),
      explanation: t(
        `The tangential part goes once counterclockwise around the origin, so it gives 2π. The part (0, ${coef(ch.c, 'x')}) is smooth everywhere, with curl = ${par(ch.c)}, so Green's theorem gives ${par(ch.c)}·(area π·${ch.s}²) = ${piTerm(ch.c * ch.s * ch.s)}. Total: (2 + ${par(ch.c * ch.s * ch.s)})π = ${piTerm(chAns / Math.PI)}.`,
        `切向部分绕原点逆时针一圈，贡献 2π。部分 (0, ${coef(ch.c, 'x')}) 处处光滑，curl = ${par(ch.c)}，由格林定理得 ${par(ch.c)}·(面积 π·${ch.s}²) = ${piTerm(ch.c * ch.s * ch.s)}。合计 (2 + ${par(ch.c * ch.s * ch.s)})π = ${piTerm(chAns / Math.PI)}。`
      ),
      audit: { kind: 'MIT-MV-47:challenge', params: { c: ch.c, s: ch.s } },
    }),
  ];
};
