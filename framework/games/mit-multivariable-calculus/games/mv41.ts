import type { CardGenerator } from '../../types';
import { arrowField, contourLines, ellipse, fitView, graphOf, rect, sampleCurve, type FigureShape, type Pt } from '../../figure';
import { coef, frac, gcd, linear, makeMvDeck, num, par, piTerm, term, vec, type Text } from '../support';

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

export const mv41: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-41');
  warm(g);

  // Card 1: criterion-constant
  const q = g.random(1, 5);
  const r = g.random(1, 5);
  const pAns = 2 * q;
  const N1 = coef(q, 'x²') + ' + ' + coef(r, 'y');

  // Card 2: curl-value
  const cvals = [-4, -3, -2, 2, 3, 4];
  const cp = g.pick(cvals);
  const cq = g.pick(cvals);
  const cr = retry(() => g.pick(cvals), v => v !== cq);
  const cs = g.pick(cvals);
  const M2 = linear([cp, cq], ['x', 'y']);
  const N2 = linear([cr, cs], ['x', 'y']);
  const curlAns = cr - cq;

  // Card 3: exactness
  const ep = g.random(1, 4);
  const isExact = g.random(0, 1) < 0.5;
  const eq = isExact ? ep : retry(() => g.random(1, 4), v => v !== ep);

  // Cards 4 & 5: potential-setup / potential-value
  const P = g.pick([2, 4, 6]);
  const p4 = g.random(1, 3);
  const Q = g.pick([3, 6, 9]);
  const a = g.random(1, 3);
  const b = g.random(1, 3);
  const M4 = coef(P, 'x') + ' + ' + coef(p4, 'y²');
  const N4 = coef(2 * p4, 'xy') + ' + ' + coef(Q, 'y²');
  const valAns = (P / 2) * a * a + p4 * a * b * b + (Q / 3) * b * b * b;

  // Card 6: gradient-of-potential
  const ga = g.random(1, 4);
  const gb = g.random(1, 3);
  const gk = g.random(1, 3);
  const fpoly = coef(ga, 'x²') + ' + ' + coef(gb, 'xy²') + ' + ' + coef(gk, 'y³');

  // Card 7: potential-coefs
  const A = g.pick([3, 6, 9]);
  const d = g.random(1, 4);
  const c = g.pick([2, 4, 6]);
  const F7 = '(' + coef(A, 'x²') + ' + ' + coef(2 * d, 'xy') + ', ' + coef(d, 'x²') + ' + ' + coef(c, 'y') + ')';

  // Card 8: counterexample-hole
  const k = g.random(1, 4);
  const AisRadial = g.random(0, 1) < 0.5;
  const RA = AisRadial ? 'A' : 'B';
  const TA = AisRadial ? 'B' : 'A';
  const FA = AisRadial
    ? '(' + coef(k, 'x') + ', ' + coef(k, 'y') + ')/(x² + y²)'
    : '(' + coef(-k, 'y') + ', ' + coef(k, 'x') + ')/(x² + y²)';
  const FB = AisRadial
    ? '(' + coef(-k, 'y') + ', ' + coef(k, 'x') + ')/(x² + y²)'
    : '(' + coef(k, 'x') + ', ' + coef(k, 'y') + ')/(x² + y²)';

  // Card 9: challenge
  const cp2 = g.random(1, 3);
  const cq2 = g.random(1, 3);
  const cr2 = g.random(1, 3);
  const endpoints: [number, number][] = [[1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1]];
  const [m, n] = g.pick(endpoints);
  const M9 = coef(2 * cp2, 'xy') + ' + ' + coef(cq2, 'y²');
  const N9 = coef(cp2, 'x²') + ' + ' + coef(2 * cq2, 'xy') + ' + ' + cr2;
  const chAns = cp2 * m * m * n + cq2 * m * n * n + cr2 * n;

  // Figures
  const pathShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [3, 0]], tone: 'accent', width: 2, label: 'C₁' },
    { kind: 'arrow', from: [2.5, 0], to: [3, 0], tone: 'accent', width: 2 },
    { kind: 'line', points: [[3, 0], [3, 2]], tone: 'accent2', width: 2, label: 'C₂' },
    { kind: 'arrow', from: [3, 1.5], to: [3, 2], tone: 'accent2', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: '(0, 0)' },
    { kind: 'point', at: [3, 0], tone: 'text', label: '(x, 0)' },
    { kind: 'point', at: [3, 2], tone: 'text', label: '(x, y)' },
  ];

  const valuePathShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [a, 0]], tone: 'accent', width: 2, label: 'C₁' },
    { kind: 'arrow', from: [a * 5 / 6, 0], to: [a, 0], tone: 'accent', width: 2 },
    { kind: 'line', points: [[a, 0], [a, b]], tone: 'accent2', width: 2, label: 'C₂' },
    { kind: 'arrow', from: [a, b * 3 / 4], to: [a, b], tone: 'accent2', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: '(0, 0)' },
    { kind: 'point', at: [a, 0], tone: 'text', label: `(${a}, 0)` },
    { kind: 'point', at: [a, b], tone: 'text', label: `(${a}, ${b})` },
  ];

  const holeShapes: FigureShape[] = [
    { kind: 'point', at: [0, 0], tone: 'warn', hollow: true },
    { kind: 'line', points: sampleCurve((t: number): Pt => [Math.cos(t), Math.sin(t)], 0, 2 * Math.PI), tone: 'accent', width: 1.5 },
    { kind: 'arrow', from: [Math.cos(0.5), Math.sin(0.5)], to: [Math.cos(0.8), Math.sin(0.8)], tone: 'accent', width: 2 },
  ];

  return [
    g.number({
      id: 'criterion-constant',
      title: t('Find the constant p', '求常数 p'),
      prompt: t(`F = (p·xy, ${N1}) is continuously differentiable on the whole xy-plane, and p is a constant. Exactly one value of p makes F a gradient field. Find p.`,
        `F = (p·xy, ${N1}) 在整个 xy 平面上连续可微，p 是常数。恰有一个 p 值使 F 成为梯度场，求 p。`),
      fields: [{ label: t('p', 'p'), answer: pAns }],
      hint: t('A gradient field needs M_y = N_x at every point. Differentiate M with respect to y and N with respect to x and compare the coefficients of x.',
        '梯度场要求处处 M_y = N_x。把 M 对 y 求偏导、N 对 x 求偏导，比较 x 的系数。'),
      explanation: t(`M = p·xy gives M_y = p·x. N = ${N1} gives N_x = ${coef(2 * q, 'x')} (the term ${coef(r, 'y')} has no x). They agree at every point exactly when p = ${2 * q}. F is continuously differentiable on the whole plane, so M_y = N_x makes F a gradient field.`,
        `M = p·xy 给出 M_y = p·x；N = ${N1} 给出 N_x = ${coef(2 * q, 'x')}（项 ${coef(r, 'y')} 不含 x）。两者处处相等当且仅当 p = ${2 * q}。F 在整个平面上连续可微，所以 M_y = N_x 保证 F 是梯度场。`),
      audit: { kind: 'MIT-MV-41:criterion-constant', params: { q, r } },
    }),
    g.number({
      id: 'curl-value',
      title: t('Compute the two-dimensional curl', '计算二维旋度'),
      prompt: t(`F = (M, N) with M = ${M2} and N = ${N2}. Compute the two-dimensional curl N_x − M_y.`,
        `F = (M, N)，其中 M = ${M2}，N = ${N2}。求二维旋度 N_x − M_y。`),
      fields: [{ label: t('curl F', 'curl F'), answer: curlAns }],
      hint: t('Differentiate N with respect to x and M with respect to y; a term without that variable gives 0.',
        '把 N 对 x 求偏导、M 对 y 求偏导；不含该变量的项导数为 0。'),
      explanation: t(`N_x = ${num(cr)} and M_y = ${num(cq)}, so curl F = ${num(cr)} − ${par(cq)} = ${num(curlAns)}.`,
        `N_x = ${num(cr)}，M_y = ${num(cq)}，所以旋度为 ${num(cr)} − ${par(cq)} = ${num(curlAns)}。`),
      audit: { kind: 'MIT-MV-41:curl-value', params: { p: cp, q: cq, r: cr, s: cs } },
    }),
    g.choice({
      id: 'exactness',
      title: t('Exactness of a differential', '微分的恰当性'),
      prompt: t(`M = x·eˣ + ${coef(ep, 'y')} and N = ${coef(eq, 'x')} + y are continuously differentiable on the whole xy-plane. Which statement about the differential M dx + N dy is correct?`,
        `M = x·eˣ + ${coef(ep, 'y')} 与 N = ${coef(eq, 'x')} + y 在整个 xy 平面上连续可微。关于微分 M dx + N dy，下列哪个说法正确？`),
      options: isExact
        ? [
            t(`Exact: M_y = ${ep} = N_x at every point.`, `恰当：M_y = ${ep} = N_x 处处成立。`),
            t('Not exact: M contains x·eˣ but N contains no exponential.', '不恰当：M 含有 x·eˣ，而 N 不含指数函数。'),
            t('Not exact: M_x = (1 + x)eˣ is different from N_y = 1.', '不恰当：M_x = (1 + x)eˣ 与 N_y = 1 不相等。'),
            t('Cannot be decided: M_y = N_x never proves exactness.', '无法判定：M_y = N_x 并不能证明恰当。'),
          ]
        : [
            t(`Not exact: M_y = ${ep} but N_x = ${eq}.`, `不恰当：M_y = ${ep}，而 N_x = ${eq}。`),
            t('Exact: M and N are continuously differentiable on the whole plane.', '恰当：M 与 N 在整个平面上连续可微。'),
            t('Exact: x·eˣ has an antiderivative, so each term can be integrated.', '恰当：x·eˣ 有原函数，所以每一项都能积分。'),
            t('Cannot be decided until a function f with df = M dx + N dy has been found.', '在求出满足 df = M dx + N dy 的函数 f 之前无法判定。'),
          ],
      correct: 0,
      hint: t('The test compares two mixed partial derivatives: M with respect to y, N with respect to x.',
        '判别法比较两个混合偏导数：M 对 y 的偏导和 N 对 x 的偏导。'),
      explanation: isExact
        ? t(`M_y = ${ep} (x·eˣ has no y) and N_x = ${eq}. EXACT: they are equal at every point and M, N are continuously differentiable on the whole plane, so the differential is exact.`,
          `M_y = ${ep}（x·eˣ 不含 y），N_x = ${eq}。恰当情形：两者处处相等，且 M、N 在整个平面上连续可微，所以该微分恰当。`)
        : t(`M_y = ${ep} (x·eˣ has no y) and N_x = ${eq}. NOT: ${ep} ≠ ${eq}, so no function f has df = M dx + N dy. Smoothness alone never decides this, and M_x = (1 + x)eˣ against N_y = 1 is the wrong pair of derivatives.`,
          `M_y = ${ep}（x·eˣ 不含 y），N_x = ${eq}。不恰当情形：${ep} ≠ ${eq}，不存在满足 df = M dx + N dy 的函数 f。只有光滑并不能判定，而 M_x = (1 + x)eˣ 与 N_y = 1 比较的是错误的一对导数。`),
    }),
    g.symbols({
      id: 'potential-setup',
      title: t('Set up the line integral', '设置线积分'),
      prompt: t(`F = (${M4}, ${N4}) is a gradient field on the whole xy-plane. To find f(x, y) − f(0, 0) = ∫ F·dr, go from (0, 0) to (x, 0) along C₁ (on the x-axis), then from (x, 0) to (x, y) along C₂ (vertical, with x held fixed). Fill in the two integrands.`,
        `F = (${M4}, ${N4}) 在整个 xy 平面上是梯度场。要求 f(x, y) − f(0, 0) = ∫ F·dr，先沿 C₁（在 x 轴上）从 (0, 0) 到 (x, 0)，再沿 C₂（竖直方向，x 保持不变）从 (x, 0) 到 (x, y)。填写两段的被积函数。`),
      before: '∫₀ˣ',
      between: [' dx,    ∫₀ʸ'],
      after: ' dy',
      answers: [coef(P, 'x'), coef(2 * p4, 'xy') + ' + ' + coef(Q, 'y²')],
      tokens: shuffled(g, [
        coef(P, 'x'),
        coef(2 * p4, 'xy') + ' + ' + coef(Q, 'y²'),
        coef(P, 'x') + ' + ' + coef(p4, 'y²'),
        coef(Q, 'y²'),
        coef(2 * p4, 'xy'),
      ]),
      hint: t('On C₁ we have y = 0 and dy = 0. On C₂ the variable x is constant, so dx = 0. Substitute these into M dx + N dy.',
        '在 C₁ 上 y = 0，dy = 0；在 C₂ 上 x 是常数，dx = 0。把它们代入 M dx + N dy。'),
      explanation: t(`On C₁: y = 0, dy = 0, so F·dr = M(x, 0) dx = ${coef(P, 'x')} dx. On C₂: x is fixed, dx = 0, so F·dr = N(x, y) dy = (${coef(2 * p4, 'xy')} + ${coef(Q, 'y²')}) dy. The complete M still contains ${coef(p4, 'y²')}, which vanishes on C₁; putting x = 0 on C₂ would lose ${coef(2 * p4, 'xy')}.`,
        `在 C₁ 上：y = 0，dy = 0，所以 F·dr = M(x, 0) dx = ${coef(P, 'x')} dx。在 C₂ 上：x 固定，dx = 0，所以 F·dr = N(x, y) dy = (${coef(2 * p4, 'xy')} + ${coef(Q, 'y²')}) dy。完整的 M 仍含 ${coef(p4, 'y²')}，它在 C₁ 上为 0；若在 C₂ 上令 x = 0，会丢掉 ${coef(2 * p4, 'xy')}。`),
      figure: g.figure({
        alt: t('An L-shaped path from (0,0) to (x,0) to (x,y).', '从 (0,0) 到 (x,0) 再到 (x,y) 的 L 形路径。'),
        view: fitView(pathShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: pathShapes,
      }),
    }),
    g.number({
      id: 'potential-value',
      title: t('Compute the line integral', '计算线积分'),
      prompt: t(`F = (${M4}, ${N4}) is a gradient field on the whole xy-plane. Compute ∫ F·dr along C₁ from (0, 0) to (${a}, 0), then along C₂ from (${a}, 0) to (${a}, ${b}).`,
        `F = (${M4}, ${N4}) 在整个 xy 平面上是梯度场。先沿 C₁ 从 (0, 0) 到 (${a}, 0)，再沿 C₂ 从 (${a}, 0) 到 (${a}, ${b})，计算 ∫ F·dr。`),
      fields: [{ label: t('∫ F·dr', '∫ F·dr'), answer: valAns }],
      hint: t(`Integrate M(x, 0) for x from 0 to ${a}, then N(${a}, y) for y from 0 to ${b}.`,
        `先对 x 从 0 到 ${a} 积分 M(x, 0)，再对 y 从 0 到 ${b} 积分 N(${a}, y)。`),
      explanation: t(`C₁: ∫₀^${a} ${coef(P, 'x')} dx = ${num((P / 2) * a * a)}. C₂ (x = ${a}): ∫₀^${b} (${coef(2 * p4 * a, 'y')} + ${coef(Q, 'y²')}) dy = ${num(p4 * a * b * b)} + ${num((Q / 3) * b * b * b)}. Total ${num(valAns)}.`,
        `C₁：∫₀^${a} ${coef(P, 'x')} dx = ${num((P / 2) * a * a)}。C₂（x = ${a}）：∫₀^${b} (${coef(2 * p4 * a, 'y')} + ${coef(Q, 'y²')}) dy = ${num(p4 * a * b * b)} + ${num((Q / 3) * b * b * b)}。总和为 ${num(valAns)}。`),
      audit: { kind: 'MIT-MV-41:potential-value', params: { P, p: p4, Q, a, b } },
      figure: g.figure({
        alt: t(`An L-shaped path from (0,0) to (${a},0) to (${a},${b}).`, `从 (0,0) 到 (${a},0) 再到 (${a},${b}) 的 L 形路径。`),
        view: fitView(valuePathShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: valuePathShapes,
      }),
    }),
    g.choice({
      id: 'gradient-of-potential',
      title: t('Find the gradient', '求梯度'),
      prompt: t(`f(x, y) = ${fpoly}. Which vector is ∇f = (f_x, f_y)?`,
        `f(x, y) = ${fpoly}。下列哪个向量是 ∇f = (f_x, f_y)？`),
      options: [
        t(`(${coef(2 * ga, 'x')} + ${coef(gb, 'y²')}, ${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')})`, `(${coef(2 * ga, 'x')} + ${coef(gb, 'y²')}, ${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')})`),
        t(`(${coef(ga, 'x')} + ${coef(gb, 'y²')}, ${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')})`, `(${coef(ga, 'x')} + ${coef(gb, 'y²')}, ${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')})`),
        t(`(${coef(2 * ga, 'x')} + ${coef(gb, 'y²')}, ${coef(2 * gb, 'xy')} + ${coef(gk, 'y²')})`, `(${coef(2 * ga, 'x')} + ${coef(gb, 'y²')}, ${coef(2 * gb, 'xy')} + ${coef(gk, 'y²')})`),
        t(`(${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')}, ${coef(2 * ga, 'x')} + ${coef(gb, 'y²')})`, `(${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')}, ${coef(2 * ga, 'x')} + ${coef(gb, 'y²')})`),
      ],
      correct: 0,
      hint: t('f_x is the derivative with respect to x with y held fixed; f_y the derivative with respect to y with x held fixed. Watch the exponents.',
        'f_x 是 y 固定时对 x 的导数，f_y 是 x 固定时对 y 的导数。注意指数。'),
      explanation: t(`f_x = ${coef(2 * ga, 'x')} + ${coef(gb, 'y²')} and f_y = ${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')}. The vector with ${coef(ga, 'x')} in the first component forgot the factor 2 from x²; the vector ending in ${coef(gk, 'y²')} forgot the factor 3 from y³; the vector with the components in reverse order is (f_y, f_x).`,
        `f_x = ${coef(2 * ga, 'x')} + ${coef(gb, 'y²')}，f_y = ${coef(2 * gb, 'xy')} + ${coef(3 * gk, 'y²')}。第一分量含 ${coef(ga, 'x')} 的向量漏了 x² 求导的因子 2；末项为 ${coef(gk, 'y²')} 的向量漏了 y³ 求导的因子 3；分量次序颠倒的向量是 (f_y, f_x)。`),
    }),
    g.number({
      id: 'potential-coefs',
      title: t('Find the potential coefficients', '求势函数系数'),
      prompt: t(`F = ${F7} is a gradient field, F = ∇f. Find the coefficients of f(x, y) = [ ]x³ + [ ]x²y + [ ]y² + C.`,
        `F = ${F7} 是梯度场，F = ∇f。求 f(x, y) = [ ]x³ + [ ]x²y + [ ]y² + C 中的各系数。`),
      fields: [
        { label: t('coefficient of x³', 'x³ 的系数'), answer: A / 3 },
        { label: t('coefficient of x²y', 'x²y 的系数'), answer: d },
        { label: t('coefficient of y²', 'y² 的系数'), answer: c / 2 },
      ],
      hint: t('Integrate M with respect to x (add an unknown function g(y)), then compare f_y with N.',
        '先对 x 积分 M（加上未知函数 g(y)），再把 f_y 与 N 比较。'),
      explanation: t(`f_x = M gives f = ${coef(A / 3, 'x³')} + ${coef(d, 'x²y')} + g(y). Then f_y = ${coef(d, 'x²')} + g′(y) must equal N = ${coef(d, 'x²')} + ${coef(c, 'y')}, so g′(y) = ${coef(c, 'y')} and g(y) = ${coef(c / 2, 'y²')} + C. The coefficients are ${A / 3}, ${d}, ${c / 2}.`,
        `由 f_x = M 得 f = ${coef(A / 3, 'x³')} + ${coef(d, 'x²y')} + g(y)。于是 f_y = ${coef(d, 'x²')} + g′(y) 必须等于 N = ${coef(d, 'x²')} + ${coef(c, 'y')}，所以 g′(y) = ${coef(c, 'y')}，g(y) = ${coef(c / 2, 'y²')} + C。系数依次为 ${A / 3}、${d}、${c / 2}。`),
      audit: { kind: 'MIT-MV-41:potential-coefs', params: { A, d, c } },
    }),
    g.choice({
      id: 'counterexample-hole',
      title: t('Conservative fields with a hole', '有洞定义域上的保守场'),
      prompt: t(`The fields A and B are defined on the xy-plane with the origin removed. Both satisfy M_y = N_x at every point where they are defined. A = ${FA}, B = ${FB}. Which statement is correct?`,
        `场 A 与 B 都定义在去掉原点的 xy 平面上，在有定义的每一点都满足 M_y = N_x。A = ${FA}，B = ${FB}。下列哪个说法正确？`),
      options: [
        t(`Only ${RA} is conservative.`, `只有 ${RA} 是保守场。`),
        t(`Only ${TA} is conservative.`, `只有 ${TA} 是保守场。`),
        t('Both A and B are conservative.', 'A 和 B 都是保守场。'),
        t('Neither A nor B is conservative.', 'A 和 B 都不是保守场。'),
      ],
      correct: 0,
      hint: t('One field is a constant multiple of ∇ ln r with r = √(x² + y²). For the other, compute ∮ F·dr around the unit circle x = cos t, y = sin t.',
        '其中一个场是 ∇ ln r 的常数倍，r = √(x² + y²)。对另一个场，沿单位圆 x = cos t，y = sin t 计算 ∮ F·dr。'),
      explanation: t(`${RA} = ${k === 1 ? '' : `${k}·`}∇ ln r, so ${RA} is a gradient field on the plane without the origin. For ${TA}, ∮ ${TA}·dr = ∫₀^{2π} ${k === 1 ? '1' : k} dt = ${piTerm(2 * k)} ≠ 0 around the unit circle, so ${TA} is not conservative. M_y = N_x does not settle it: the domain has a hole, and the converse of the criterion was proved for fields continuously differentiable on the whole plane.`,
        `${RA} = ${k === 1 ? '' : `${k}·`}∇ ln r，所以 ${RA} 在去掉原点的平面上是梯度场。对 ${TA}，沿单位圆 ∮ ${TA}·dr = ∫₀^{2π} ${k} dt = ${piTerm(2 * k)} ≠ 0，所以 ${TA} 不是保守场。M_y = N_x 在这里不能下结论：定义域有洞，而判据的逆命题是对整个平面上连续可微的场证明的。`),
      figure: g.figure({
        alt: t('The origin is not part of the domain; a counterclockwise unit circle is drawn.', '原点不属于定义域；图中画了一个逆时针单位圆。'),
        view: fitView(holeShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: holeShapes,
      }),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: path-independent integral', '挑战：路径无关积分'),
      prompt: t(`F = (${M9}, ${N9}) is continuously differentiable on the whole xy-plane. Compute ∫_C F·dr along any path C from (0, 0) to (${m}, ${n}).`,
        `F = (${M9}, ${N9}) 在整个 xy 平面上连续可微。沿任意从 (0, 0) 到 (${m}, ${n}) 的路径 C，计算 ∫_C F·dr。`),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: chAns }],
      hint: t('Check that M_y = N_x on the whole plane, then find a potential f (or integrate along an axis-parallel path).',
        '先验证整个平面上 M_y = N_x，再求势函数 f（或沿平行于坐标轴的路径积分）。'),
      explanation: t(`M_y = ${coef(2 * cp2, 'x')} + ${coef(2 * cq2, 'y')} = N_x, so F = ∇f with f = ${coef(cp2, 'x²y')} + ${coef(cq2, 'xy²')} + ${coef(cr2, 'y')} + C. The integral is f(${m}, ${n}) − f(0, 0) = ${num(chAns)}. This game does not assess path integrals along curved paths, Green's theorem or vector fields in space; it covers only the test M_y = N_x, the two-dimensional curl and finding a potential function in the plane.`,
        `M_y = ${coef(2 * cp2, 'x')} + ${coef(2 * cq2, 'y')} = N_x，所以 F = ∇f，f = ${coef(cp2, 'x²y')} + ${coef(cq2, 'xy²')} + ${coef(cr2, 'y')} + C。积分为 f(${m}, ${n}) − f(0, 0) = ${num(chAns)}。本游戏不考察沿曲线路径的线积分、格林定理或空间向量场，只涉及判别法 M_y = N_x、二维旋度以及平面上势函数的求法。`),
      audit: { kind: 'MIT-MV-41:challenge', params: { p: cp2, q: cq2, r: cr2, m, n } },
    }),
  ];
};
