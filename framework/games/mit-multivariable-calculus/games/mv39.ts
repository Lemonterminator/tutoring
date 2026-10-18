import type { CardGenerator } from '../../types';
import { ellipse, fitView, graphOf, sampleCurve, type FigureShape, type Pt } from '../../figure';
import { coef, frac, makeMvDeck, num, par, piTerm, term, type Text, exact } from '../support';

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

export const mv39: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-39');
  warm(g);

  // Card 1: axis-work
  const aw = { a: g.pick([2, 3, 4]), p: g.pick([1, 2, 3]), q: g.pick([1, 2, 3]), r: g.pick([1, 2, 3]) };
  const awAns = aw.p * aw.a * aw.a / 2;
  const awM = coef(aw.p, 'x') + (aw.q === 1 ? ' + y' : ` + ${aw.q}y`);
  const awN = coef(aw.r, 'xy');
  const awF = `(${awM}, ${awN})`;

  // Cards 2-5: shared (p, k)
  const pk = retry(() => ({ p: g.pick([1, 2, 3]), k: g.pick([1, 2, 3]) }), v => !(v.p === 2 && v.k === 2));
  const pkM = coef(pk.p, 'x²y');
  const pkN = pk.k === 1 ? 'x − y' : `x − ${pk.k}y`;
  const pkF = `(${pkM}, ${pkN})`;

  // Card 3: parabola-value
  const pvAns = pk.p / 5 + 2 / 3 - pk.k / 2;
  const pvIntegrand = (pk.p === 1 ? 't⁴' : `${pk.p}t⁴`) + ' + 2t² − ' + (2 * pk.k === 1 ? 't³' : `${2 * pk.k}t³`);

  // Card 4: line-value
  const lvAns = pk.p / 4 + (1 - pk.k) / 2;

  // Card 6: radial-arc
  const ra = { a: g.pick([2, 3, 4, 5]), radial: g.pick([true, false]) };
  const raF = ra.radial ? '(x, y)' : '(−y, x)';
  const raAns = ra.radial ? 0 : (ra.a * ra.a * Math.PI) / 2;

  // Cards 7-8: circle-ccw / circle-cw
  const cp = { a: g.pick([1, 2, 3]), p: g.pick([1, 2, 3]) };
  const cpF = cp.p === 1 ? '(−y, x)' : `(−${cp.p}y, ${cp.p}x)`;
  const ccwAns = 2 * cp.p * cp.a * cp.a * Math.PI;
  const cwAns = -ccwAns;

  // Card 9: challenge
  const ch = retry(
    () => ({ a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]), p: g.pick([1, 2, 3]), q: g.pick([2, 4]) }),
    v => (v.p - 1) * v.a !== v.q * v.b / 2
  );
  const chAns = (ch.p - 1) * ch.a * ch.b - ch.q * ch.b * ch.b / 2;
  const chM = coef(ch.p, 'y');
  const chN = ch.q === 1 ? 'x + y' : `x + ${ch.q}y`;
  const chF = `(${chM}, ${chN})`;

  // Figures
  const awShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [aw.a, 0]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [aw.a * 0.4, 0], to: [aw.a * 0.6, 0], tone: 'accent' },
    { kind: 'point', at: [0, 0], tone: 'text', label: '(0, 0)' },
    { kind: 'point', at: [aw.a, 0], tone: 'text', label: `(${aw.a}, 0)` },
  ];

  const pkShapes: FigureShape[] = [
    { kind: 'line', points: graphOf((x: number) => x * x, 0, 1), tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: '(0, 0)' },
    { kind: 'point', at: [1, 1], tone: 'text', label: '(1, 1)' },
  ];

  const lvShapes: FigureShape[] = [
    { kind: 'line', points: graphOf((x: number) => x * x, 0, 1), tone: 'muted', width: 1.5, dash: true },
    { kind: 'line', points: [[0, 0], [1, 1]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [0.4, 0.4], to: [0.6, 0.6], tone: 'accent' },
    { kind: 'point', at: [0, 0], tone: 'text', label: '(0, 0)' },
    { kind: 'point', at: [1, 1], tone: 'text', label: '(1, 1)' },
  ];

  const raShapes: FigureShape[] = [
    { kind: 'line', points: sampleCurve((th: number): Pt => [ra.a * Math.cos(th), ra.a * Math.sin(th)], 0, Math.PI / 2), tone: 'accent', width: 2 },
    { kind: 'point', at: [ra.a, 0], tone: 'text', label: `(${ra.a}, 0)` },
    { kind: 'point', at: [0, ra.a], tone: 'text', label: `(0, ${ra.a})` },
  ];
  for (let i = 0; i < 4; i++) {
    const th = (i + 0.5) * (Math.PI / 8);
    const px = ra.a * Math.cos(th), py = ra.a * Math.sin(th);
    if (ra.radial) {
      raShapes.push({ kind: 'arrow', from: [px, py], to: [px * 1.3, py * 1.3], tone: 'accent2', width: 1.5 });
    } else {
      raShapes.push({ kind: 'arrow', from: [px, py], to: [px - 0.3 * Math.sin(th), py + 0.3 * Math.cos(th)], tone: 'accent2', width: 1.5 });
    }
  }

  const ccwShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, cp.a, cp.a), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [cp.a * Math.cos(0.2), cp.a * Math.sin(0.2)], to: [cp.a * Math.cos(0.5), cp.a * Math.sin(0.5)], tone: 'accent2', width: 2 },
  ];

  const cwShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, cp.a, cp.a), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [cp.a * Math.cos(0.5), cp.a * Math.sin(0.5)], to: [cp.a * Math.cos(0.2), cp.a * Math.sin(0.2)], tone: 'warn', width: 2 },
  ];

  const chShapes: FigureShape[] = [
    { kind: 'line', points: [[0, ch.b], [ch.a, ch.b]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [ch.a * 0.4, ch.b], to: [ch.a * 0.6, ch.b], tone: 'accent' },
    { kind: 'line', points: [[ch.a, ch.b], [ch.a, 0]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [ch.a, ch.b * 0.6], to: [ch.a, ch.b * 0.4], tone: 'accent' },
    { kind: 'point', at: [0, ch.b], tone: 'text', label: `(0, ${ch.b})` },
    { kind: 'point', at: [ch.a, ch.b], tone: 'text', label: `(${ch.a}, ${ch.b})` },
    { kind: 'point', at: [ch.a, 0], tone: 'text', label: `(${ch.a}, 0)` },
  ];

  return [
    g.number({
      id: 'axis-work',
      title: t('Work along the x-axis', '沿 x 轴做功'),
      prompt: t(
        `F = ${awF}. Let C be the segment of the x-axis from (0, 0) to (${aw.a}, 0). Find ∫_C F·dr. Enter an integer or a fraction.`,
        `F = ${awF}。C 是 x 轴上从 (0, 0) 到 (${aw.a}, 0) 的线段。求 ∫_C F·dr（填整数或分数）。`
      ),
      figure: g.figure({
        alt: t(`The segment from (0,0) to (${aw.a},0) on the x-axis.`, `x 轴上从 (0,0) 到 (${aw.a},0) 的线段。`),
        view: { xmin: -0.4, xmax: aw.a + 0.4, ymin: -0.4 * aw.a, ymax: 0.4 * aw.a }, axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: awShapes,
      }),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: awAns }],
      hint: t('On the x-axis y = 0, so dy = 0.', '在 x 轴上 y = 0，所以 dy = 0。'),
      explanation: t(
        `With y = 0 and dy = 0, M dx + N dy = ${coef(aw.p, 'x')} dx, so ∫_0^${aw.a} ${coef(aw.p, 'x')} dx = ${num(awAns)}.`,
        `因为 y = 0，dy = 0，M dx + N dy = ${coef(aw.p, 'x')} dx，所以 ∫_0^${aw.a} ${coef(aw.p, 'x')} dx = ${num(awAns)}。`
      ),
      audit: { kind: 'MIT-MV-39:axis-work', params: { a: aw.a, p: aw.p, q: aw.q, r: aw.r } },
    }),
    g.symbols({
      id: 'parabola-setup',
      title: t('Set up the line integral', '建立线积分'),
      prompt: t(
        `F = ${pkF}. C is the curve y = x² from (0, 0) to (1, 1), parametrized by x = t, y = t², 0 ≤ t ≤ 1. Fill in ∫_C F·dr = ∫_[ ]^[ ] [ ] dt.`,
        `F = ${pkF}。C 是曲线 y = x² 上从 (0, 0) 到 (1, 1) 的一段，参数化为 x = t，y = t²，0 ≤ t ≤ 1。填空：∫_C F·dr = ∫_[ ]^[ ] [ ] dt。`
      ),
      figure: g.figure({
        alt: t(`The parabola y = x² from (0,0) to (1,1).`, `抛物线 y = x² 从 (0,0) 到 (1,1)。`),
        view: fitView(pkShapes, 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: pkShapes,
      }),
      before: '∫_', between: ['^', ' '], after: ' dt',
      answers: ['0', '1', pvIntegrand],
      tokens: shuffled(g, [
        '0', '1', '2', pvIntegrand,
        (pk.p === 1 ? 't⁴' : `${pk.p}t⁴`) + ' + t − ' + (pk.k === 1 ? 't²' : `${pk.k}t²`),
        (pk.p === 1 ? 't⁴' : `${pk.p}t⁴`) + ' + 2t² − ' + (pk.k === 1 ? 't³' : `${pk.k}t³`),
        (pk.p === 1 ? 't³' : `${pk.p}t³`) + ' + 2t² − ' + (2 * pk.k === 1 ? 't³' : `${2 * pk.k}t³`),
      ]),
      hint: t('Substitute x = t, y = t², dx = dt, dy = 2t dt into M dx + N dy.', '把 x = t，y = t²，dx = dt，dy = 2t dt 代入 M dx + N dy。'),
      explanation: t(
        `M dx = ${coef(pk.p, 't²')}·t² dt = ${coef(pk.p, 't⁴')} dt and N dy = (t − ${coef(pk.k, 't²')})·2t dt = 2t² − ${2 * pk.k}t³ dt, for 0 ≤ t ≤ 1.`,
        `M dx = ${coef(pk.p, 't²')}·t² dt = ${coef(pk.p, 't⁴')} dt，N dy = (t − ${coef(pk.k, 't²')})·2t dt = 2t² − ${2 * pk.k}t³ dt，0 ≤ t ≤ 1。`
      ),
    }),
    g.number({
      id: 'parabola-value',
      title: t('Evaluate along the parabola', '沿抛物线求值'),
      prompt: t(
        `F = ${pkF}. C is the parabola y = x² from (0, 0) to (1, 1). Evaluate I = ∫_C F·dr. Enter an integer or a fraction.`,
        `F = ${pkF}。C 是抛物线 y = x² 上从 (0, 0) 到 (1, 1) 的一段。计算 I = ∫_C F·dr（填整数或分数）。`
      ),
      figure: g.figure({
        alt: t(`The parabola y = x² from (0,0) to (1,1).`, `抛物线 y = x² 从 (0,0) 到 (1,1)。`),
        view: fitView(pkShapes, 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: pkShapes,
      }),
      fields: [{ label: t('I', 'I'), answer: pvAns }],
      hint: t('Integrate the polynomial term by term from 0 to 1.', '把多项式逐项从 0 积到 1。'),
      explanation: t(
        `∫_0^1 (${coef(pk.p, 't⁴')} + 2t² − ${2 * pk.k}t³) dt = ${pk.p}/5 + 2/3 − ${pk.k}/2 = ${exact(pvAns)}.`,
        `∫_0^1 (${coef(pk.p, 't⁴')} + 2t² − ${2 * pk.k}t³) dt = ${pk.p}/5 + 2/3 − ${pk.k}/2 = ${exact(pvAns)}。`
      ),
      audit: { kind: 'MIT-MV-39:parabola-value', params: { p: pk.p, k: pk.k } },
    }),
    g.number({
      id: 'line-value',
      title: t('Evaluate along the segment', '沿线段求值'),
      prompt: t(
        `F = ${pkF}. C is the straight segment from (0, 0) to (1, 1) (x = t, y = t, 0 ≤ t ≤ 1). Evaluate ∫_C F·dr. Enter an integer or a fraction.`,
        `F = ${pkF}。C 是从 (0, 0) 到 (1, 1) 的直线段（x = t，y = t，0 ≤ t ≤ 1）。计算 ∫_C F·dr（填整数或分数）。`
      ),
      figure: g.figure({
        alt: t(`The segment from (0,0) to (1,1) and the parabola y=x².`, `从 (0,0) 到 (1,1) 的线段和抛物线 y=x²。`),
        view: fitView(lvShapes, 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: lvShapes,
      }),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: lvAns }],
      hint: t('On the segment y = x, so dy = dx.', '在这条线段上 y = x，所以 dy = dx。'),
      explanation: t(
        `M dx + N dy = ${coef(pk.p, 't³')} dt + (t − ${coef(pk.k, 't')}) dt, so I = ${pk.p}/4 + (1 − ${pk.k})/2 = ${num(lvAns)}.`,
        `M dx + N dy = ${coef(pk.p, 't³')} dt + (t − ${coef(pk.k, 't')}) dt，所以 I = ${pk.p}/4 + (1 − ${pk.k})/2 = ${num(lvAns)}。`
      ),
      audit: { kind: 'MIT-MV-39:line-value', params: { p: pk.p, k: pk.k } },
    }),
    g.choice({
      id: 'path-dependence',
      title: t('Path dependence', '路径依赖性'),
      prompt: t(
        `For the same field F, the parabola from (0, 0) to (1, 1) gives ${num(pvAns)} and the straight segment gives ${num(lvAns)}. What does this show?`,
        `对同一个场 F，从 (0, 0) 到 (1, 1) 沿抛物线积分得 ${num(pvAns)}，沿直线段积分得 ${num(lvAns)}。这说明什么？`
      ),
      options: [
        t('A line integral can depend on the path, even when the endpoints are the same.', '即使端点相同，线积分也可能依赖于路径。'),
        t('A line integral depends only on its endpoints.', '线积分只取决于端点。'),
        t('One of the two computations must contain an arithmetic mistake.', '两次计算中一定有一次算错了。'),
        t('The value changes with the parametrization, so a different parametrization of the parabola would give yet another value.', '积分值随参数化改变，所以换一种参数化抛物线还会得到另一个值。'),
      ],
      correct: 0,
      hint: t('Compare the two values: do they agree?', '比较这两个值：它们相等吗？'),
      explanation: t(
        `The endpoints are the same but ${num(pvAns)} ≠ ${num(lvAns)}, so the integral cannot depend only on the endpoints. Reparametrizing the same curve never changes the value; changing the curve can.`,
        `端点相同，但 ${num(pvAns)} ≠ ${num(lvAns)}，所以积分不可能只取决于端点。同一条曲线换参数化不会改变积分值，换曲线则可能改变。`
      ),
    }),
    g.choice({
      id: 'radial-arc',
      title: t('Line integral on a quarter circle', '四分之一圆周上的线积分'),
      prompt: t(
        `F = ${raF}. C is the quarter circle of radius ${ra.a} centered at the origin, from (${ra.a}, 0) to (0, ${ra.a}), counterclockwise. What is ∫_C F·dr?`,
        `F = ${raF}。C 是以原点为圆心、半径为 ${ra.a} 的四分之一圆周，沿逆时针从 (${ra.a}, 0) 到 (0, ${ra.a})。∫_C F·dr 等于多少？`
      ),
      figure: g.figure({
        alt: t(`Quarter circle of radius ${ra.a} with field arrows.`, `半径为 ${ra.a} 的四分之一圆周及场箭头。`),
        view: fitView(raShapes, 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: raShapes,
      }),
      options: [
        t('0', '0'),
        t(`${ra.a * ra.a}`, `${ra.a * ra.a}`),
        t(`${ra.a * ra.a}π/2`, `${ra.a * ra.a}π/2`),
        t(`${ra.a * ra.a}/2`, `${ra.a * ra.a}/2`),
      ],
      correct: ra.radial ? 0 : 2,
      hint: t('Intrinsic formula: ∫_C F·dr = ∫_C F·T ds. Is F parallel or perpendicular to the path?', '内蕴公式：∫_C F·dr = ∫_C F·T ds。F 与路径平行还是垂直？'),
      explanation: t(
        ra.radial
          ? `Radial field: F is perpendicular to the circle, F·T = 0 everywhere, so the integral is 0.`
          : `Tangential field: F·T = |F| = ${ra.a} and the arc has length π·${ra.a}/2, so the integral is ${ra.a}·π·${ra.a}/2 = ${ra.a * ra.a}π/2.`,
        ra.radial
          ? '径向场：F 垂直于圆周，处处 F·T = 0，所以积分为 0。'
          : `切向场：F·T = |F| = ${ra.a}，弧长为 π·${ra.a}/2，所以积分为 ${ra.a}·π·${ra.a}/2 = ${ra.a * ra.a}π/2。`
      ),
    }),
    g.number({
      id: 'circle-ccw',
      title: t('Counterclockwise circle integral', '逆时针圆周积分'),
      prompt: t(
        `F = ${cpF}. C is the circle x² + y² = ${cp.a}², traversed once counterclockwise. Find ∮_C F·dr as a multiple of π.`,
        `F = ${cpF}。C 是圆 x² + y² = ${cp.a}²，逆时针绕行一周。求 ∮_C F·dr，答案写成 π 的倍数。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${cp.a} with counterclockwise arrow.`, `半径为 ${cp.a} 的圆及逆时针箭头。`),
        view: fitView(ccwShapes, 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: ccwShapes,
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: ccwAns }],
      hint: t('Intrinsic formula: F·T = |F| on this circle.', '内蕴公式：在这个圆上 F·T = |F|。'),
      explanation: t(
        `F·T = ${cp.p}·${cp.a} = ${cp.p * cp.a} everywhere on the circle, and ∮ ds = 2π·${cp.a}, so ∮_C F·dr = ${cp.p * cp.a}·2π·${cp.a} = ${piTerm(2 * cp.p * cp.a * cp.a)}.`,
        `在圆上处处 F·T = ${cp.p}·${cp.a} = ${cp.p * cp.a}，且 ∮ ds = 2π·${cp.a}，所以 ∮_C F·dr = ${cp.p * cp.a}·2π·${cp.a} = ${piTerm(2 * cp.p * cp.a * cp.a)}。`
      ),
      audit: { kind: 'MIT-MV-39:circle-ccw', params: { a: cp.a, p: cp.p } },
    }),
    g.number({
      id: 'circle-cw',
      title: t('Clockwise circle integral', '顺时针圆周积分'),
      prompt: t(
        `The same field F = ${cpF} and the same circle x² + y² = ${cp.a}², but now C is traversed once clockwise. Find ∮_C F·dr as a multiple of π (mind the sign).`,
        `同一个场 F = ${cpF} 和同一个圆 x² + y² = ${cp.a}²，但现在 C 沿顺时针绕行一周。求 ∮_C F·dr，答案写成 π 的倍数（注意符号）。`
      ),
      figure: g.figure({
        alt: t(`Circle of radius ${cp.a} with clockwise arrow.`, `半径为 ${cp.a} 的圆及顺时针箭头。`),
        view: fitView(cwShapes, 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: cwShapes,
      }),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: cwAns }],
      hint: t('Reversing the direction of a curve changes the sign of the line integral.', '曲线反向，线积分变号。'),
      explanation: t(
        `Clockwise is the reverse of counterclockwise, so the value is the opposite of ${piTerm(2 * cp.p * cp.a * cp.a)}: ${piTerm(-2 * cp.p * cp.a * cp.a)}.`,
        `顺时针是逆时针的反向，所以结果是 ${piTerm(2 * cp.p * cp.a * cp.a)} 的相反数：${piTerm(-2 * cp.p * cp.a * cp.a)}。`
      ),
      audit: { kind: 'MIT-MV-39:circle-cw', params: { a: cp.a, p: cp.p } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: two-segment path', '挑战：两段路径'),
      prompt: t(
        `F = ${chF}. C goes first along the segment from (0, ${ch.b}) to (${ch.a}, ${ch.b}), then along the segment from (${ch.a}, ${ch.b}) down to (${ch.a}, 0). Find ∫_C F·dr.`,
        `F = ${chF}。C 先沿线段从 (0, ${ch.b}) 到 (${ch.a}, ${ch.b})，再沿线段从 (${ch.a}, ${ch.b}) 向下到 (${ch.a}, 0)。求 ∫_C F·dr。`
      ),
      figure: g.figure({
        alt: t(`Two segments: (0,${ch.b}) to (${ch.a},${ch.b}) then to (${ch.a},0).`, `两段线段：(0,${ch.b}) 到 (${ch.a},${ch.b}) 再到 (${ch.a},0)。`),
        view: fitView(chShapes, 0.3), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: chShapes,
      }),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: chAns }],
      hint: t('Treat each segment separately; note the direction of travel on the second one.', '分别处理两段；注意第二段上的行进方向。'),
      explanation: t(
        `On the first segment y = ${ch.b}, dy = 0: ∫ ${ch.p}·${ch.b} dx from 0 to ${ch.a} = ${ch.p * ch.a * ch.b}. On the second x = ${ch.a}, dx = 0 and y runs from ${ch.b} to 0: ∫_${ch.b}^0 (${ch.a} + ${ch.q}y) dy = −(${ch.a * ch.b} + ${ch.q * ch.b * ch.b / 2}). Sum = ${num(chAns)}.`,
        `第一段 y = ${ch.b}，dy = 0：∫ ${ch.p}·${ch.b} dx（x 从 0 到 ${ch.a}）= ${ch.p * ch.a * ch.b}。第二段 x = ${ch.a}，dx = 0，y 从 ${ch.b} 到 0：∫_${ch.b}^0 (${ch.a} + ${ch.q}y) dy = −(${ch.a * ch.b} + ${ch.q * ch.b * ch.b / 2})。总和为 ${num(chAns)}。`
      ),
      audit: { kind: 'MIT-MV-39:challenge', params: { p: ch.p, q: ch.q, a: ch.a, b: ch.b } },
    }),
  ];
};
