import type { CardGenerator } from '../../types';
import { fitView, rect, type FigureShape } from '../../figure';
import { coef, makeMvDeck, num, par, type Text } from '../support';

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

function sup(n: number): string {
  const map: Record<number, string> = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return map[n] || String(n);
}

function fmtPoly(c: number, m: number, n: number): string {
  const parts: string[] = [];
  if (c !== 1) parts.push(String(c));
  if (m > 0) parts.push(m === 1 ? 'x' : `x${sup(m)}`);
  if (n > 0) parts.push(n === 1 ? 'y' : `y${sup(n)}`);
  return parts.join('');
}

function fmtTerm(c: number, m: number, n: number): string {
  if (c === 0) return '0';
  const sign = c < 0 ? '−' : '';
  const ac = Math.abs(c);
  const parts: string[] = [];
  if (ac !== 1) parts.push(String(ac));
  if (m > 0) parts.push(m === 1 ? 'x' : `x${sup(m)}`);
  if (n > 0) parts.push(n === 1 ? 'y' : `y${sup(n)}`);
  return sign + parts.join('');
}

export const mv40: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-40');
  warm(g);

  // Card 1: gradient-field
  const gf = retry(() => ({
    c: g.pick([1, 2]),
    m: g.pick([2, 3, 4]),
    n: g.pick([2, 3, 4]),
  }), v => v.m !== v.n);
  const gfFx = fmtTerm(gf.c * gf.m, gf.m - 1, gf.n);
  const gfFy = fmtTerm(gf.c * gf.n, gf.m, gf.n - 1);
  const gfD1 = fmtTerm(gf.c, gf.m - 1, gf.n);
  const gfD2 = fmtTerm(gf.c * gf.m, gf.m - 1, gf.n - 1);
  const gfD3 = fmtTerm(gf.c * gf.m, gf.m, gf.n - 1);
  const gfTokens = shuffled(g, [gfFx, gfFy, gfD1, gfD2, gfD3]);

  // Cards 2-4: shared sample
  const sh = retry(() => ({
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
    x0: g.pick([1, 2, 3]),
    y0: g.pick([1, 2, 3]),
    x1: g.pick([1, 2, 3]),
    y1: g.pick([1, 2, 3]),
  }), v => v.x0 !== v.x1 && v.y0 !== v.y1 && (v.a * (v.x1 * v.y1 - v.x0 * v.y0) + v.b * (v.x1 * v.x1 - v.x0 * v.x0)) !== 0);
  const shF = (x: number, y: number) => sh.a * x * y + sh.b * x * x;
  const shV = shF(sh.x1, sh.y1) - shF(sh.x0, sh.y0);
  const shF1 = shF(sh.x1, sh.y1);
  const shF0 = shF(sh.x0, sh.y0);
  const shExpr = `${coef(sh.a, 'xy')} + ${coef(sh.b, 'x²')}`;

  // Card 4: closed-loop
  const cl = {
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
    x0: g.pick([1, 2, 3]),
    y0: g.pick([1, 2, 3]),
  };
  const clV0 = cl.a * cl.x0 * cl.y0 + cl.b * cl.x0 * cl.x0;
  const clExpr = `${coef(cl.a, 'xy')} + ${coef(cl.b, 'x²')}`;

  // Card 5: spot-nonconservative
  const sn = {
    p: g.pick([1, 2, 3]),
    q: g.pick([1, 2, 3]),
  };
  const snSwap = g.pick([true, false]);
  const snNameCons = snSwap ? 'F' : 'G';
  const snNameNon = snSwap ? 'G' : 'F';
  const snConsExpr = `(${coef(sn.p, 'x')}, ${coef(sn.p, 'y')})`;
  const snNonExprStr = `(${sn.q === 1 ? '−y' : `−${sn.q}y`}, ${coef(sn.q, 'x')})`;

  // Card 6: seg-via-xaxis
  const sv = {
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
    p: g.pick([1, 2, 3]),
  };
  const svAns = sv.p * sv.a * sv.b;
  const svFExpr = `(${sv.p === 1 ? '−y' : `−${sv.p}y`}, ${coef(sv.p, 'x')})`;
  const svShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [sv.a, 0]], tone: 'accent', width: 2 },
    { kind: 'line', points: [[sv.a, 0], [sv.a, sv.b]], tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: 'P0' },
    { kind: 'point', at: [sv.a, 0], tone: 'warn', label: 'C' },
    { kind: 'point', at: [sv.a, sv.b], tone: 'text', label: 'P1' },
    { kind: 'arrow', from: [sv.a / 2, 0], to: [sv.a / 2 + 0.2, 0], tone: 'accent' },
    { kind: 'arrow', from: [sv.a, sv.b / 2], to: [sv.a, sv.b / 2 + 0.2], tone: 'accent' },
  ];

  // Card 7: diag-field
  const df = {
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
    p: g.pick([1, 2, 3]),
  };
  const dfAns = df.p * df.a * df.b / 2;
  const dfFExpr = `(0, ${coef(df.p, 'x')})`;
  const dfShapes: FigureShape[] = [
    { kind: 'line', points: [[0, 0], [df.a, df.b]], tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: 'P0' },
    { kind: 'point', at: [df.a, df.b], tone: 'text', label: 'P1' },
    { kind: 'arrow', from: [0.45 * df.a, 0.45 * df.b], to: [0.55 * df.a, 0.55 * df.b], tone: 'accent' },
  ];

  // Card 8: challenge
  const ch = {
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
    p: g.pick([1, 2, 3]),
  };
  const chAns = 2 * ch.p * ch.a * ch.b;
  const chFExpr = `(${coef(2, 'x')} − ${coef(ch.p, 'y')}, ${coef(ch.p, 'x')} + ${coef(2, 'y')})`;
  const chShapes: FigureShape[] = [
    { kind: 'line', points: [...rect(0, 0, ch.a, ch.b), [0, 0]], tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: 'P0' },
    { kind: 'point', at: [ch.a, 0], tone: 'muted' },
    { kind: 'point', at: [ch.a, ch.b], tone: 'muted' },
    { kind: 'point', at: [0, ch.b], tone: 'muted' },
    { kind: 'arrow', from: [ch.a / 2, 0], to: [ch.a / 2 + 0.2, 0], tone: 'accent' },
    { kind: 'arrow', from: [ch.a, ch.b / 2], to: [ch.a, ch.b / 2 + 0.2], tone: 'accent' },
    { kind: 'arrow', from: [ch.a / 2, ch.b], to: [ch.a / 2 - 0.2, ch.b], tone: 'accent' },
    { kind: 'arrow', from: [0, ch.b / 2], to: [0, ch.b / 2 - 0.2], tone: 'accent' },
  ];

  return [
    g.symbols({
      id: 'gradient-field',
      title: t('Find the gradient field', '求梯度场'),
      prompt: t(`f(x, y) = ${fmtPoly(gf.c, gf.m, gf.n)}. Fill in F = ∇f = ( [ ], [ ] ).`,
        `f(x, y) = ${fmtPoly(gf.c, gf.m, gf.n)}。填空：F = ∇f = ( [ ], [ ] )。`),
      before: 'F = ∇f = ( ',
      between: [', '],
      after: ' )',
      answers: [gfFx, gfFy],
      tokens: gfTokens,
      hint: t('∇f = (f_x, f_y); lower the exponent of the variable you differentiate and multiply by it.',
        '∇f = (f_x, f_y)；对哪个变量求导，就把它的指数降 1，并把原指数乘到前面。'),
      explanation: t(`f_x = ${gfFx}, f_y = ${gfFy}. For example ∇(x³y⁴) = (3x²y⁴, 4x³y³).`,
        `f_x = ${gfFx}，f_y = ${gfFy}。例如 ∇(x³y⁴) = (3x²y⁴, 4x³y³)。`),
    }),
    g.number({
      id: 'potential-difference',
      title: t('Line integral of a gradient field', '梯度场的线积分'),
      prompt: t(`F = ∇f where f(x, y) = ${shExpr}. C is any curve from (${sh.x0}, ${sh.y0}) to (${sh.x1}, ${sh.y1}). Find ∫_C F·dr.`,
        `F = ∇f，其中 f(x, y) = ${shExpr}。C 是从 (${sh.x0}, ${sh.y0}) 到 (${sh.x1}, ${sh.y1}) 的任意曲线。求 ∫_C F·dr。`),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: shV }],
      hint: t('For a gradient field the integral only depends on the endpoints: ∫_C ∇f·dr = f(P1) − f(P0).',
        '对梯度场，积分只取决于端点：∫_C ∇f·dr = f(P1) − f(P0)。'),
      explanation: t(`f(${sh.x1}, ${sh.y1}) = ${num(shF1)} and f(${sh.x0}, ${sh.y0}) = ${num(shF0)}, so the integral is ${num(shF1)} − ${par(shF0)} = ${num(shV)}, whatever the curve.`,
        `f(${sh.x1}, ${sh.y1}) = ${num(shF1)}，f(${sh.x0}, ${sh.y0}) = ${num(shF0)}，所以不论曲线如何，积分都是 ${num(shF1)} − ${par(shF0)} = ${num(shV)}。`),
      audit: { kind: 'MIT-MV-40:potential-difference', params: { a: sh.a, b: sh.b, x0: sh.x0, y0: sh.y0, x1: sh.x1, y1: sh.y1 } },
    }),
    g.choice({
      id: 'path-independence',
      title: t('Path independence', '路径无关性'),
      prompt: t(`F = ∇f with f(x, y) = ${shExpr}. Path 1 goes from (${sh.x0}, ${sh.y0}) horizontally to (${sh.x1}, ${sh.y0}) and then vertically to (${sh.x1}, ${sh.y1}); path 2 goes vertically to (${sh.x0}, ${sh.y1}) and then horizontally to (${sh.x1}, ${sh.y1}); path 3 is the straight segment. Which statement is true?`,
        `F = ∇f，f(x, y) = ${shExpr}。路径 1 从 (${sh.x0}, ${sh.y0}) 先水平到 (${sh.x1}, ${sh.y0}) 再竖直到 (${sh.x1}, ${sh.y1})；路径 2 先竖直到 (${sh.x0}, ${sh.y1}) 再水平到 (${sh.x1}, ${sh.y1})；路径 3 是直线段。下列哪个说法正确？`),
      options: [
        t(`All three integrals are equal, each is ${num(shV)}.`, `三个积分都相等，都等于 ${num(shV)}。`),
        t('The straight segment gives the smallest value, because it is the shortest path.', '直线段的积分值最小，因为它是最短的路径。'),
        t('The two paths with a corner give different values, because their corners are different.', '两条有拐角的路径积分值不同，因为拐角不同。'),
        t(`Only the straight segment gives ${num(shV)}; the paths with a corner give other values.`, `只有直线段的积分等于 ${num(shV)}，有拐角的路径给出别的值。`),
      ],
      correct: 0,
      figure: g.figure({
        alt: t(`Three paths from (${sh.x0}, ${sh.y0}) to (${sh.x1}, ${sh.y1}).`, `从 (${sh.x0}, ${sh.y0}) 到 (${sh.x1}, ${sh.y1}) 的三条路径。`),
        view: fitView([
          { kind: 'line', points: [[sh.x0, sh.y0], [sh.x1, sh.y0], [sh.x1, sh.y1]], tone: 'accent' },
          { kind: 'line', points: [[sh.x0, sh.y0], [sh.x0, sh.y1], [sh.x1, sh.y1]], tone: 'accent2' },
          { kind: 'line', points: [[sh.x0, sh.y0], [sh.x1, sh.y1]], tone: 'accent3' },
          { kind: 'point', at: [sh.x0, sh.y0], tone: 'text', label: 'P0' },
          { kind: 'point', at: [sh.x1, sh.y1], tone: 'text', label: 'P1' },
        ], 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: [
          { kind: 'line', points: [[sh.x0, sh.y0], [sh.x1, sh.y0], [sh.x1, sh.y1]], tone: 'accent', width: 2 },
          { kind: 'line', points: [[sh.x0, sh.y0], [sh.x0, sh.y1], [sh.x1, sh.y1]], tone: 'accent2', width: 2 },
          { kind: 'line', points: [[sh.x0, sh.y0], [sh.x1, sh.y1]], tone: 'accent3', width: 2 },
          { kind: 'point', at: [sh.x0, sh.y0], tone: 'text', label: 'P0' },
          { kind: 'point', at: [sh.x1, sh.y1], tone: 'text', label: 'P1' },
        ],
      }),
      hint: t('The three paths join the same endpoints of a gradient field.', '三条路径连接梯度场的同一对端点。'),
      explanation: t(`By the fundamental theorem each integral equals f(P1) − f(P0) = ${num(shV)}. Length, corners and straightness do not matter.`,
        `由基本定理，每个积分都等于 f(P1) − f(P0) = ${num(shV)}，与长度、拐角、是否笔直都无关。`),
    }),
    g.choice({
      id: 'closed-loop',
      title: t('Integral over a closed loop', '闭曲线上的积分'),
      prompt: t(`F = ∇f with f(x, y) = ${clExpr}. C is a closed curve that starts and ends at (${cl.x0}, ${cl.y0}). What is ∮_C F·dr?`,
        `F = ∇f，f(x, y) = ${clExpr}。C 是起点和终点都是 (${cl.x0}, ${cl.y0}) 的任意形状的闭曲线。∮_C F·dr 等于多少？`),
      options: [
        t('0, whatever the shape of C.', '0，与 C 的形状无关。'),
        t(`f(${cl.x0}, ${cl.y0}) = ${num(clV0)}, the value of the potential at the starting point.`, `f(${cl.x0}, ${cl.y0}) = ${num(clV0)}，即起点处势函数的值。`),
        t('It depends on the shape of C.', '它取决于 C 的形状。'),
        t('The area enclosed by C.', 'C 所围成的面积。'),
      ],
      correct: 0,
      hint: t('A closed curve has the same start and end point.', '闭曲线的起点和终点相同。'),
      explanation: t('The start and the end are the same point P, so ∮_C ∇f·dr = f(P) − f(P) = 0.',
        '起点和终点是同一个点 P，所以 ∮_C ∇f·dr = f(P) − f(P) = 0。'),
    }),
    g.choice({
      id: 'spot-nonconservative',
      title: t('Identify the non-conservative field', '识别非保守场'),
      prompt: t(`Two fields: ${snNameCons} = ${snConsExpr} and ${snNameNon} = ${snNonExprStr}. Which statement is correct?`,
        `两个场：${snNameCons} = ${snConsExpr}，${snNameNon} = ${snNonExprStr}。下列哪个说法正确？`),
      options: [
        t(`Only ${snNameNon} is not conservative: from (0, 0) to (1, 1) it gives ${sn.q} along the path through (1, 0) but −${sn.q} along the path through (0, 1).`,
          `只有 ${snNameNon} 不是保守场：从 (0, 0) 到 (1, 1)，经过 (1, 0) 的路径积分为 ${sn.q}，经过 (0, 1) 的路径积分为 −${sn.q}。`),
        t(`Only ${snNameCons} is not conservative, because its vectors all point away from the origin.`,
          `只有 ${snNameCons} 不是保守场，因为它的向量都背离原点。`),
        t('Both are conservative, because each is given by a simple formula.', '两个都是保守场，因为它们都由简单公式给出。'),
        t('Neither is conservative: only a constant field can be conservative.', '两个都不是保守场：只有常向量场才可能是保守场。'),
      ],
      correct: 0,
      hint: t('If a field is conservative, two paths between the same endpoints give the same value.',
        '如果场是保守场，同一对端点之间的两条路径给出相同的值。'),
      explanation: t(`For ${snNameNon} the two routes from (0, 0) to (1, 1) give ${sn.q} and −${sn.q}, so it depends on the path and ${snNameNon} is not conservative. ${snNameCons} = ∇(${sn.p === 1 ? '' : sn.p}(x² + y²)/2) is a gradient field; both routes give ${sn.p}.`,
        `对 ${snNameNon}，从 (0, 0) 到 (1, 1) 的两条路线给出 ${sn.q} 与 −${sn.q}，积分依赖路径，所以 ${snNameNon} 不是保守场。${snNameCons} = ∇(${sn.p === 1 ? '' : sn.p}(x² + y²)/2) 是梯度场，两条路线都给出 ${sn.p}。`),
    }),
    g.number({
      id: 'seg-via-xaxis',
      title: t('Line integral along an L-path', 'L 形路径的线积分'),
      prompt: t(`F = ${svFExpr}. C goes from (0, 0) along the x-axis to (${sv.a}, 0), then straight up to (${sv.a}, ${sv.b}). Find ∫_C F·dr.`,
        `F = ${svFExpr}。C 从 (0, 0) 沿 x 轴到 (${sv.a}, 0)，再竖直向上到 (${sv.a}, ${sv.b})。求 ∫_C F·dr。`),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: svAns }],
      figure: g.figure({
        alt: t(`L-shaped path from (0,0) to (${sv.a},0) to (${sv.a},${sv.b}).`, `从 (0,0) 到 (${sv.a},0) 再到 (${sv.a},${sv.b}) 的 L 形路径。`),
        view: fitView(svShapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: svShapes,
      }),
      hint: t('This F is not a gradient field, so integrate along each piece.', '这个 F 不是梯度场，所以要分段积分。'),
      explanation: t(`On the x-axis y = 0, dy = 0, and F·dr = −${coef(sv.p, 'y')} dx = 0. On x = ${sv.a}, dx = 0 and F·dr = ${sv.p * sv.a} dy, so ∫_0^${sv.b} ${sv.p * sv.a} dy = ${num(svAns)}.`,
        `在 x 轴上 y = 0，dy = 0，F·dr = −${coef(sv.p, 'y')} dx = 0。在 x = ${sv.a} 上 dx = 0，F·dr = ${sv.p * sv.a} dy，所以 ∫_0^${sv.b} ${sv.p * sv.a} dy = ${num(svAns)}。`),
      audit: { kind: 'MIT-MV-40:seg-via-xaxis', params: { a: sv.a, b: sv.b, p: sv.p } },
    }),
    g.number({
      id: 'diag-field',
      title: t('Line integral along a diagonal', '对角线段的线积分'),
      prompt: t(`F = ${dfFExpr}. C is the straight segment from (0, 0) to (${df.a}, ${df.b}), parametrized by x = ${coef(df.a, 't')}, y = ${coef(df.b, 't')}, 0 ≤ t ≤ 1. Find ∫_C F·dr.`,
        `F = ${dfFExpr}。C 是从 (0, 0) 到 (${df.a}, ${df.b}) 的直线段，参数化为 x = ${coef(df.a, 't')}，y = ${coef(df.b, 't')}，0 ≤ t ≤ 1。求 ∫_C F·dr。`),
      fields: [{ label: t('∫_C F·dr', '∫_C F·dr'), answer: dfAns }],
      figure: g.figure({
        alt: t(`Straight segment from (0,0) to (${df.a},${df.b}).`, `从 (0,0) 到 (${df.a},${df.b}) 的直线段。`),
        view: fitView(dfShapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: dfShapes,
      }),
      hint: t(`Substitute x = ${coef(df.a, 't')}, y = ${coef(df.b, 't')}, dy = ${df.b} dt.`, `代入 x = ${coef(df.a, 't')}，y = ${coef(df.b, 't')}，dy = ${df.b} dt。`),
      explanation: t(`F·dr = 0·dx + ${coef(df.p, 'x')} dy = ${df.p}·${coef(df.a, 't')}·${df.b} dt, so ∫_0^1 ${df.p * df.a * df.b} t dt = ${num(dfAns)}.`,
        `F·dr = 0·dx + ${coef(df.p, 'x')} dy = ${df.p}·${coef(df.a, 't')}·${df.b} dt，所以 ∫_0^1 ${df.p * df.a * df.b} t dt = ${num(dfAns)}。`),
      audit: { kind: 'MIT-MV-40:diag-field', params: { a: df.a, b: df.b, p: df.p } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: Closed loop integral', '挑战：闭曲线积分'),
      prompt: t(`F = ${chFExpr}. C is the boundary of the rectangle 0 ≤ x ≤ ${ch.a}, 0 ≤ y ≤ ${ch.b}, traversed once counterclockwise starting at (0, 0). Find ∮_C F·dr.`,
        `F = ${chFExpr}。C 是矩形 0 ≤ x ≤ ${ch.a}，0 ≤ y ≤ ${ch.b} 的边界，从 (0, 0) 出发逆时针绕行一周。求 ∮_C F·dr。`),
      fields: [{ label: t('∮_C F·dr', '∮_C F·dr'), answer: chAns }],
      figure: g.figure({
        alt: t(`Rectangle 0 ≤ x ≤ ${ch.a}, 0 ≤ y ≤ ${ch.b} with counterclockwise arrows.`, `矩形 0 ≤ x ≤ ${ch.a}，0 ≤ y ≤ ${ch.b}，带逆时针箭头。`),
        view: fitView(chShapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: chShapes,
      }),
      hint: t('Split F into a gradient part and a rotational part.', '把 F 分成梯度部分和旋转部分。'),
      explanation: t(`F = ∇(x² + y²) + ${ch.p === 1 ? '' : ch.p}(−y, x). The gradient part gives 0 on a closed curve. For ${ch.p === 1 ? '' : ch.p}(−y, x): the bottom and left sides give 0, the right side gives ${ch.p}·${ch.a}·${ch.b}, the top gives ${ch.p}·${ch.a}·${ch.b}; the total is ${num(chAns)}.`,
        `F = ∇(x² + y²) + ${ch.p === 1 ? '' : ch.p}(−y, x)。梯度部分在闭曲线上积分为 0。对 ${ch.p === 1 ? '' : ch.p}(−y, x)：下边和左边为 0，右边为 ${ch.p}·${ch.a}·${ch.b}，上边为 ${ch.p}·${ch.a}·${ch.b}，总和为 ${num(chAns)}。`),
      audit: { kind: 'MIT-MV-40:challenge', params: { a: ch.a, b: ch.b, p: ch.p } },
    }),
  ];
};
