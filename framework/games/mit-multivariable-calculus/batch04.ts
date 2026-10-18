import { contourLines, graphOf, fitView, type FigureShape, type Pt } from '../figure';
import { makeMvDeck, num, par, vec, type GeneratorMap } from './support';

/**
 * Batch 4: MIT-MV-18 Partial Derivatives, MIT-MV-19 Tangent Plane Approximation, MIT-MV-20 Optimization.
 * Definitions follow content/mit-multivariable-calculus/sources/{18,19,20}-*.txt (18.02SC sessions 26, 27, 28).
 */
type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string) => [en, zh] as const;

/** Draw with `make` until `ok` holds. Bounded, so a bad sampling condition fails loudly instead of hanging. */
function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}

// ---- Small polynomial toolkit: a polynomial in x, y is a list of [coefficient, power of x, power of y]. ----
type Term = [number, number, number];
const sup = (p: number) => (p === 1 ? '' : p === 2 ? '²' : p === 3 ? '³' : `^${p}`);
/** Printed polynomial, e.g. "3x² − xy + 2y − 5". Zero coefficients are omitted; negatives never print as "+ −". */
function poly(terms: Term[], vx = 'x', vy = 'y'): string {
  const live = terms.filter(([c]) => c !== 0);
  if (!live.length) return '0';
  return live.map(([c, i, j], k) => {
    const vars = (i ? vx + sup(i) : '') + (j ? vy + sup(j) : '');
    const abs = Math.abs(c);
    const body = vars === '' ? num(abs) : abs === 1 ? vars : `${num(abs)}${vars}`;
    return k === 0 ? (c < 0 ? `−${body}` : body) : ` ${c < 0 ? '−' : '+'} ${body}`;
  }).join('');
}
const ev = (terms: Term[], x: number, y: number) => terms.reduce((s, [c, i, j]) => s + c * x ** i * y ** j, 0);
const dxT = (terms: Term[]): Term[] => terms.filter(([, i]) => i > 0).map(([c, i, j]) => [c * i, i - 1, j]);
const dyT = (terms: Term[]): Term[] => terms.filter(([, , j]) => j > 0).map(([c, i, j]) => [c * j, i, j - 1]);
/** The polynomial with concrete values substituted, e.g. "2·3² + (−1)·3·4". */
function subst(terms: Term[], x: number, y: number): string {
  const live = terms.filter(([c]) => c !== 0);
  if (!live.length) return '0';
  return live.map(([c, i, j]) => {
    const parts: string[] = [];
    if (Math.abs(c) !== 1 || (i === 0 && j === 0)) parts.push(par(c));
    else if (c === -1) parts.push('(−1)');
    if (i) parts.push(i === 1 ? par(x) : `${par(x)}${sup(i)}`);
    if (j) parts.push(j === 1 ? par(y) : `${par(y)}${sup(j)}`);
    return parts.join('·');
  }).join(' + ');
}
/** "x − 3", "x + 2" or "x": the variable shifted by a centre value, never "− (−2)". */
const shift = (v: string, c: number) => (c === 0 ? v : c > 0 ? `${v} − ${num(c)}` : `${v} + ${num(-c)}`);
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** General quadratic a x² + b xy + c y² + d x + e y (no constant term). */
const quad2 = (a: number, b: number, c: number, d: number, e: number): Term[] => [[a, 2, 0], [b, 1, 1], [c, 0, 2], [d, 1, 0], [e, 0, 1]];
/** Diagonal quadratic a x² + b y² + c x + d y + e. */
const diag2 = (a: number, b: number, c: number, d: number, e: number): Term[] => [[a, 2, 0], [b, 0, 2], [c, 1, 0], [d, 0, 1], [e, 0, 0]];
const sampleQ = (g: Deck) => ({ a: g.nonzero(-3, 3), b: g.random(-3, 3), c: g.nonzero(-3, 3), d: g.random(-3, 3), e: g.random(-3, 3) });

export const batch04Generators: GeneratorMap = {
  // ================================================================================================
  'MIT-MV-18': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-18');

    // 1. slice in x
    const q1 = sampleQ(g), x0 = g.random(-3, 3), y0 = g.random(-3, 3);
    const F1 = quad2(q1.a, q1.b, q1.c, q1.d, q1.e);
    const sliceX: Term[] = [[q1.a, 2, 0], [q1.b * y0 + q1.d, 1, 0], [q1.c * y0 * y0 + q1.e * y0, 0, 0]];
    const sliceXd: Term[] = [[2 * q1.a, 1, 0], [q1.b * y0 + q1.d, 0, 0]];
    const m1 = ev(dxT(F1), x0, y0);
    const g1 = (x: number) => ev(sliceX, x, 0);
    const slicePts: FigureShape[] = [
      { kind: 'line', points: graphOf(g1, x0 - 2.5, x0 + 2.5, 40), tone: 'accent', width: 2 },
      { kind: 'point', at: [x0, g1(x0)] as Pt, tone: 'warn', label: 'P' },
    ];

    // 2. slice in y
    const x1 = g.random(-3, 3), y1 = g.random(-3, 3);
    const sliceY: Term[] = [[q1.c, 2, 0], [q1.b * x1 + q1.e, 1, 0], [q1.a * x1 * x1 + q1.d * x1, 0, 0]];
    const sliceYd: Term[] = [[2 * q1.c, 1, 0], [q1.b * x1 + q1.e, 0, 0]];
    const m2 = ev(dyT(F1), x1, y1);

    // 3. which-fixed: sampled point only
    const wx = g.random(-3, 3), wy = g.random(-3, 3);

    // 4. which partial
    const wa = g.nonzero(-3, 3), wb = g.nonzero(-3, 3);
    const Fw: Term[] = [[wa, 1, 2], [wb, 2, 0]];
    const wrongX = poly(dxT(Fw));
    const wrongMixed = poly([[2 * wa, 1, 1], [2 * wb, 1, 0]]);
    const rightY = poly(dyT(Fw));

    // 5. cubic partials
    const ca = g.nonzero(-2, 2), cb = g.random(-2, 2), cc = g.random(-2, 2), cd = g.nonzero(-2, 2), cx = g.random(-2, 2), cy = g.random(-2, 2);
    const Fc: Term[] = [[ca, 3, 0], [cb, 2, 1], [cc, 1, 2], [cd, 0, 3]];

    // 6. mixed partial
    const ma = g.nonzero(-3, 3), mb = g.nonzero(-3, 3), mc = g.random(-3, 3), md = g.random(-3, 3), mx = g.random(-2, 2), my = g.random(-2, 2);
    const Fm: Term[] = [[ma, 3, 1], [mb, 1, 2], [mc, 2, 0], [md, 0, 1]];
    const mixed = ev(dxT(dyT(Fm)), mx, my);

    // 7. direction of change (f_y != 0)
    const dq = retry(() => ({ ...sampleQ(g), px: g.random(-3, 3), py: g.random(-3, 3) }), s => ev(dyT(quad2(s.a, s.b, s.c, s.d, s.e)), s.px, s.py) !== 0);
    const Fd = quad2(dq.a, dq.b, dq.c, dq.d, dq.e);
    const slopeD = ev(dyT(Fd), dq.px, dq.py);

    // 8. challenge
    const ha = g.nonzero(-3, 3), hb = g.nonzero(-3, 3), hc = g.random(-3, 3), hx = g.random(-2, 2), hy = g.random(-2, 2);
    const Fh: Term[] = [[ha, 2, 1], [hb, 1, 3], [hc, 1, 0]];
    const hfy = ev(dyT(Fh), hx, hy), hmix = ev(dxT(dyT(Fh)), hx, hy);

    return [
      g.number({
        id: 'slice-x', title: t('Hold y fixed, differentiate in x', '固定 y，对 x 求导'),
        prompt: t(`f(x, y) = ${poly(F1)}. Hold y fixed at y = ${num(y0)}, so f(x, ${num(y0)}) is an ordinary function of x. Find the partial derivative ∂f/∂x = f_x at the point (x, y) = (${num(x0)}, ${num(y0)}): the slope of this slice at x = ${num(x0)}.`,
          `f(x, y) = ${poly(F1)}。固定 y = ${num(y0)}，则 f(x, ${num(y0)}) 是 x 的一元函数。求偏导数 ∂f/∂x = f_x 在点 (x, y) = (${num(x0)}, ${num(y0)}) 的值，即这条截线在 x = ${num(x0)} 处的斜率。`),
        figure: g.figure({
          alt: t(`The slice of the graph in the plane y = ${num(y0)}: a parabola w = f(x, ${num(y0)}), with the point P above x = ${num(x0)}.`, `图像在平面 y = ${num(y0)} 上的截线：抛物线 w = f(x, ${num(y0)})，点 P 位于 x = ${num(x0)} 之上。`),
          view: fitView(slicePts, 0.2), aspect: 'free', axes: { xLabel: 'x', yLabel: 'w', grid: true }, shapes: slicePts,
          caption: t(`Slice y = ${num(y0)}`, `截线 y = ${num(y0)}`),
        }),
        fields: [{ label: t('f_x', 'f_x'), answer: m1 }],
        hint: t('Substitute the fixed y first, then differentiate the resulting function of x. Or differentiate in x treating y as a constant.', '先代入固定的 y，再对所得 x 的函数求导；或把 y 当作常数直接对 x 求导。'),
        explanation: t(`With y = ${num(y0)}: f(x, ${num(y0)}) = ${poly(sliceX)}. Its derivative is ${poly(sliceXd)}, which equals ${subst(sliceXd, x0, 0)} = ${num(m1)} at x = ${num(x0)}. Same result from f_x = ${poly(dxT(F1))} (y treated as a constant): f_x(${num(x0)}, ${num(y0)}) = ${num(m1)}.`,
          `令 y = ${num(y0)}：f(x, ${num(y0)}) = ${poly(sliceX)}，其导数为 ${poly(sliceXd)}，在 x = ${num(x0)} 处等于 ${subst(sliceXd, x0, 0)} = ${num(m1)}。把 y 当常数求 f_x = ${poly(dxT(F1))}，得 f_x(${num(x0)}, ${num(y0)}) = ${num(m1)}，结果相同。`),
        audit: { kind: 'MIT-MV-18:partial-x', params: { a: q1.a, b: q1.b, c: q1.c, d: q1.d, e: q1.e, x0, y0 } },
      }),
      g.number({
        id: 'slice-y', title: t('Hold x fixed, differentiate in y', '固定 x，对 y 求导'),
        prompt: t(`Same function f(x, y) = ${poly(F1)}. Now hold x fixed at x = ${num(x1)} and let y vary. Find ∂f/∂y = f_y at (x, y) = (${num(x1)}, ${num(y1)}).`,
          `仍取 f(x, y) = ${poly(F1)}。现在固定 x = ${num(x1)}，让 y 变化。求 ∂f/∂y = f_y 在点 (x, y) = (${num(x1)}, ${num(y1)}) 的值。`),
        fields: [{ label: t('f_y', 'f_y'), answer: m2 }],
        hint: t('Now x is the constant. Differentiate with respect to y only.', '这次 x 是常数，只对 y 求导。'),
        explanation: t(`With x = ${num(x1)}: f(${num(x1)}, y) = ${poly(sliceY, 'y')}, derivative ${poly(sliceYd, 'y')} = ${subst(sliceYd, y1, 0)} = ${num(m2)} at y = ${num(y1)}. Equivalently f_y = ${poly(dyT(F1))}, so f_y(${num(x1)}, ${num(y1)}) = ${num(m2)}.`,
          `令 x = ${num(x1)}：f(${num(x1)}, y) = ${poly(sliceY, 'y')}，导数为 ${poly(sliceYd, 'y')}，在 y = ${num(y1)} 处等于 ${subst(sliceYd, y1, 0)} = ${num(m2)}。等价地 f_y = ${poly(dyT(F1))}，所以 f_y(${num(x1)}, ${num(y1)}) = ${num(m2)}。`),
        audit: { kind: 'MIT-MV-18:partial-y', params: { a: q1.a, b: q1.b, c: q1.c, d: q1.d, e: q1.e, x0: x1, y0: y1 } },
      }),
      g.choice({
        id: 'which-fixed', title: t('What does ∂w/∂x measure?', '∂w/∂x 衡量什么？'),
        prompt: t(`Let w = f(x, y) and P = (${num(wx)}, ${num(wy)}). What is the partial derivative ∂w/∂x at P?`, `设 w = f(x, y)，P = (${num(wx)}, ${num(wy)})。偏导数 ∂w/∂x 在 P 处表示什么？`),
        options: [
          t(`The slope at x = ${num(wx)} of the curve w = f(x, ${num(wy)}) in the plane y = ${num(wy)}: y is held fixed.`, `平面 y = ${num(wy)} 内曲线 w = f(x, ${num(wy)}) 在 x = ${num(wx)} 处的斜率：y 保持不变。`),
          t(`The slope at y = ${num(wy)} of the curve w = f(${num(wx)}, y) in the plane x = ${num(wx)}: x is held fixed.`, `平面 x = ${num(wx)} 内曲线 w = f(${num(wx)}, y) 在 y = ${num(wy)} 处的斜率：x 保持不变。`),
          t('The slope of the graph along the diagonal direction in which x and y increase together.', '图像沿 x、y 同时增加的对角方向的斜率。'),
        ], correct: 0,
        hint: t('The symbol ∂/∂x names the variable that moves. Every other variable stays fixed.', '符号 ∂/∂x 指明变化的变量，其余变量都保持固定。'),
        explanation: t('∂w/∂x is the ordinary derivative of the partial function w = f(x, y₀): it says how fast w increases as x increases while y is held constant. The option that holds x fixed describes ∂w/∂y, and a diagonal direction needs both variables to move.', '∂w/∂x 是偏函数 w = f(x, y₀) 的普通导数：它表示 y 保持不变、x 增加时 w 增加得多快。保持 x 不变的那个选项描述的是 ∂w/∂y，而对角方向需要两个变量同时变化。'),
      }),
      g.choice({
        id: 'which-partial', title: t('Pick the right partial derivative', '选出正确的偏导数'),
        prompt: t(`For f(x, y) = ${poly(Fw)}, which expression is ∂f/∂y? (Differentiate in y; x is held constant.)`, `对 f(x, y) = ${poly(Fw)}，哪个表达式是 ∂f/∂y？（对 y 求导，x 视为常数。）`),
        options: [t(rightY, rightY), t(wrongX, wrongX), t(wrongMixed, wrongMixed)], correct: 0,
        hint: t('Each term: if it has no y, it is constant when y varies. If it has y^n, use the power rule in y and keep the x factors.', '每一项：不含 y 的项在 y 变化时是常数；含 y 的项对 y 用幂法则，x 的因子保持不变。'),
        explanation: t(`With x constant: the derivative in y of ${poly([[wa, 1, 2]])} is ${poly(dyT([[wa, 1, 2]]))}, and ${poly([[wb, 2, 0]])} has no y, so it contributes 0. Hence f_y = ${rightY}. The option ${wrongX} is f_x, and ${wrongMixed} wrongly differentiates ${poly([[wb, 2, 0]])} as if x were varying.`,
          `x 视为常数：${poly([[wa, 1, 2]])} 对 y 的导数是 ${poly(dyT([[wa, 1, 2]]))}，而 ${poly([[wb, 2, 0]])} 不含 y，贡献 0。所以 f_y = ${rightY}。选项 ${wrongX} 是 f_x，而 ${wrongMixed} 错把 ${poly([[wb, 2, 0]])} 当作随 x 变化来求导。`),
        audit: { kind: 'MIT-MV-18:which-partial', params: { a: wa, b: wb } },
      }),
      g.number({
        id: 'cubic-partials', title: t('Both partial derivatives at a point', '一点处的两个偏导数'),
        prompt: t(`f(x, y) = ${poly(Fc)}. Find f_x and f_y at (x, y) = (${num(cx)}, ${num(cy)}).`, `f(x, y) = ${poly(Fc)}。求 f_x 与 f_y 在点 (x, y) = (${num(cx)}, ${num(cy)}) 的值。`),
        fields: [{ label: t('f_x', 'f_x'), answer: ev(dxT(Fc), cx, cy) }, { label: t('f_y', 'f_y'), answer: ev(dyT(Fc), cx, cy) }],
        hint: t('Differentiate in x with y constant for f_x; then in y with x constant for f_y. Substitute the point at the end.', '求 f_x 时把 y 当常数对 x 求导；求 f_y 时把 x 当常数对 y 求导；最后代入该点。'),
        explanation: t(`f_x = ${poly(dxT(Fc))}, so f_x(${num(cx)}, ${num(cy)}) = ${subst(dxT(Fc), cx, cy)} = ${num(ev(dxT(Fc), cx, cy))}. f_y = ${poly(dyT(Fc))}, so f_y(${num(cx)}, ${num(cy)}) = ${subst(dyT(Fc), cx, cy)} = ${num(ev(dyT(Fc), cx, cy))}.`,
          `f_x = ${poly(dxT(Fc))}，所以 f_x(${num(cx)}, ${num(cy)}) = ${subst(dxT(Fc), cx, cy)} = ${num(ev(dxT(Fc), cx, cy))}。f_y = ${poly(dyT(Fc))}，所以 f_y(${num(cx)}, ${num(cy)}) = ${subst(dyT(Fc), cx, cy)} = ${num(ev(dyT(Fc), cx, cy))}。`),
        audit: { kind: 'MIT-MV-18:cubic-partials', params: { a: ca, b: cb, c: cc, d: cd, x0: cx, y0: cy } },
      }),
      g.number({
        id: 'mixed', title: t('Second partials in either order', '二阶混合偏导数'),
        prompt: t(`f(x, y) = ${poly(Fm)}. The mixed second partial ∂²f/∂x∂y means ∂/∂x(∂f/∂y): differentiate in y first, then in x. Find its value at (x, y) = (${num(mx)}, ${num(my)}).`,
          `f(x, y) = ${poly(Fm)}。混合二阶偏导数 ∂²f/∂x∂y 表示 ∂/∂x(∂f/∂y)：先对 y 求导，再对 x 求导。求它在点 (x, y) = (${num(mx)}, ${num(my)}) 的值。`),
        fields: [{ label: t('∂²f/∂x∂y', '∂²f/∂x∂y'), answer: mixed }],
        hint: t('Find f_y first (x constant), then differentiate that result in x (y constant).', '先求 f_y（x 为常数），再把结果对 x 求导（y 为常数）。'),
        explanation: t(`f_y = ${poly(dyT(Fm))}, then ∂/∂x of that is ${poly(dxT(dyT(Fm)))}. In the other order, f_x = ${poly(dxT(Fm))} and ∂/∂y of that is ${poly(dyT(dxT(Fm)))}: the same polynomial, so for this f the order does not matter. At (${num(mx)}, ${num(my)}): ${subst(dxT(dyT(Fm)), mx, my)} = ${num(mixed)}.`,
          `f_y = ${poly(dyT(Fm))}，再对 x 求导得 ${poly(dxT(dyT(Fm)))}。换顺序：f_x = ${poly(dxT(Fm))}，再对 y 求导得 ${poly(dyT(dxT(Fm)))}：两个多项式相同，所以对这个 f 求导顺序无关。在 (${num(mx)}, ${num(my)}) 处：${subst(dxT(dyT(Fm)), mx, my)} = ${num(mixed)}。`),
        audit: { kind: 'MIT-MV-18:mixed-partial', params: { a: ma, b: mb, c: mc, d: md, x0: mx, y0: my } },
      }),
      g.choice({
        id: 'direction', title: t('Read the sign of a partial derivative', '读出偏导数的符号'),
        prompt: t(`f(x, y) = ${poly(Fd)}. Start at P = (${num(dq.px)}, ${num(dq.py)}) and move a very small step in the +y direction, keeping x = ${num(dq.px)}. What happens to f?`,
          `f(x, y) = ${poly(Fd)}。从 P = (${num(dq.px)}, ${num(dq.py)}) 出发，保持 x = ${num(dq.px)}，沿 +y 方向走很小的一步。f 如何变化？`),
        options: [t('f increases.', 'f 增大。'), t('f decreases.', 'f 减小。'), t('f does not change to first order.', 'f 的一阶变化为零。')], correct: slopeD > 0 ? 0 : 1, fixedOrder: true,
        hint: t('The sign of f_y at P tells how w changes as y increases with x held fixed.', 'f_y 在 P 处的符号说明 x 固定、y 增加时 w 的变化。'),
        explanation: t(`f_y = ${poly(dyT(Fd))}, so f_y(${num(dq.px)}, ${num(dq.py)}) = ${subst(dyT(Fd), dq.px, dq.py)} = ${num(slopeD)}. It is ${slopeD > 0 ? 'positive, so f increases' : 'negative, so f decreases'} as y increases from P with x held fixed.`,
          `f_y = ${poly(dyT(Fd))}，所以 f_y(${num(dq.px)}, ${num(dq.py)}) = ${subst(dyT(Fd), dq.px, dq.py)} = ${num(slopeD)}。它${slopeD > 0 ? '为正，所以 x 固定、y 从 P 增加时 f 增大' : '为负，所以 x 固定、y 从 P 增加时 f 减小'}。`),
        audit: { kind: 'MIT-MV-18:direction-of-change', params: { a: dq.a, b: dq.b, c: dq.c, d: dq.d, e: dq.e, x0: dq.px, y0: dq.py } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`f(x, y) = ${poly(Fh)}. At (x, y) = (${num(hx)}, ${num(hy)}) find ∂f/∂y and the mixed partial ∂²f/∂x∂y = ∂/∂x(∂f/∂y).`,
          `f(x, y) = ${poly(Fh)}。在点 (x, y) = (${num(hx)}, ${num(hy)}) 求 ∂f/∂y 与混合偏导数 ∂²f/∂x∂y = ∂/∂x(∂f/∂y)。`),
        fields: [{ label: t('∂f/∂y', '∂f/∂y'), answer: hfy }, { label: t('∂²f/∂x∂y', '∂²f/∂x∂y') , answer: hmix }],
        hint: t('f_y first, holding x constant; then differentiate f_y in x, holding y constant. A term with no y vanishes in f_y.', '先求 f_y（x 为常数），再把 f_y 对 x 求导（y 为常数）。不含 y 的项在 f_y 中为零。'),
        explanation: t(`f_y = ${poly(dyT(Fh))}, so f_y(${num(hx)}, ${num(hy)}) = ${subst(dyT(Fh), hx, hy)} = ${num(hfy)}. Then ∂/∂x(f_y) = ${poly(dxT(dyT(Fh)))} = ${subst(dxT(dyT(Fh)), hx, hy)} = ${num(hmix)}. This game assesses computing partial derivatives of polynomials; it does not assess functions whose partials fail to exist.`,
          `f_y = ${poly(dyT(Fh))}，所以 f_y(${num(hx)}, ${num(hy)}) = ${subst(dyT(Fh), hx, hy)} = ${num(hfy)}。再 ∂/∂x(f_y) = ${poly(dxT(dyT(Fh)))} = ${subst(dxT(dyT(Fh)), hx, hy)} = ${num(hmix)}。本游戏只检查多项式偏导数的计算，不涉及偏导数不存在的函数。`),
        audit: { kind: 'MIT-MV-18:challenge', params: { a: ha, b: hb, c: hc, x0: hx, y0: hy } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-19': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-19');
    const deltas = [-0.2, -0.1, 0.1, 0.2];

    // Cards 1, 3, 4 share one function, point and increments.
    const s = retry(() => {
      const q = sampleQ(g), x0 = g.random(-2, 3), y0 = g.random(-2, 3), dx = g.pick(deltas), dy = g.pick(deltas);
      return { ...q, x0, y0, dx, dy };
    }, v => Math.abs(v.a * v.dx * v.dx + v.b * v.dx * v.dy + v.c * v.dy * v.dy) >= 0.009);
    const F = quad2(s.a, s.b, s.c, s.d, s.e);
    const f0 = ev(F, s.x0, s.y0), fx0 = ev(dxT(F), s.x0, s.y0), fy0 = ev(dyT(F), s.x0, s.y0);
    const x1 = round1(s.x0 + s.dx), y1 = round1(s.y0 + s.dy);
    const estimate = round2(f0 + fx0 * s.dx + fy0 * s.dy);
    const exact = round3(ev(F, x1, y1));
    const error = round2(exact - estimate);

    // 2. plane constant
    const pf0 = g.random(-6, 6), pm = g.nonzero(-4, 4), pn = g.nonzero(-4, 4), px = g.random(-3, 3), py = g.random(-3, 3);
    const pk = pf0 - pm * px - pn * py;

    // 6. when is the estimate exact
    const lm = g.nonzero(-4, 4), ln = g.nonzero(-4, 4), lk = g.random(-5, 5);
    const lin: Term[] = [[lm, 1, 0], [ln, 0, 1], [lk, 0, 0]];

    // 7. box sensitivity
    const sides = retry(() => [g.random(1, 6), g.random(1, 6), g.random(1, 6)], v => new Set(v).size === 3);
    const [sa, sb, sc] = sides;
    const sens = [sb * sc, sa * sc, sa * sb];
    const sensBest = sens.indexOf(Math.max(...sens));

    // 9. challenge: homogeneous cubic
    const ch = retry(() => {
      const a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), x0 = g.nonzero(-3, 3), y0 = g.nonzero(-3, 3), dx = g.pick(deltas), dy = g.pick(deltas);
      return { a, b, x0, y0, dx, dy };
    }, v => {
      const T: Term[] = [[v.a, 2, 1], [v.b, 1, 2]];
      const lin0 = ev(T, v.x0, v.y0) + ev(dxT(T), v.x0, v.y0) * v.dx + ev(dyT(T), v.x0, v.y0) * v.dy;
      return Math.abs(ev(T, v.x0 + v.dx, v.y0 + v.dy) - lin0) >= 0.02;
    });
    const Fch: Term[] = [[ch.a, 2, 1], [ch.b, 1, 2]];
    const cf0 = ev(Fch, ch.x0, ch.y0), cfx = ev(dxT(Fch), ch.x0, ch.y0), cfy = ev(dyT(Fch), ch.x0, ch.y0);
    const cest = round2(cf0 + cfx * ch.dx + cfy * ch.dy);
    const cexact = round3(ev(Fch, round1(ch.x0 + ch.dx), round1(ch.y0 + ch.dy)));

    return [
      g.number({
        id: 'tangent-data', title: t('The three numbers behind the tangent plane', '切平面所需的三个数'),
        prompt: t(`f(x, y) = ${poly(F)}. At P = (${num(s.x0)}, ${num(s.y0)}) find f(P), f_x(P) and f_y(P). They determine the tangent plane z = f(P) + f_x(P)(${shift('x', s.x0)}) + f_y(P)(${shift('y', s.y0)}).`,
          `f(x, y) = ${poly(F)}。在 P = (${num(s.x0)}, ${num(s.y0)}) 处求 f(P)、f_x(P) 与 f_y(P)。它们决定切平面 z = f(P) + f_x(P)(${shift('x', s.x0)}) + f_y(P)(${shift('y', s.y0)})。`),
        fields: [{ label: t('f(P)', 'f(P)'), answer: f0 }, { label: t('f_x(P)', 'f_x(P)'), answer: fx0 }, { label: t('f_y(P)', 'f_y(P)'), answer: fy0 }],
        hint: t('Value first; then f_x holding y fixed and f_y holding x fixed; substitute P into each.', '先算函数值；再求 f_x（y 固定）与 f_y（x 固定），分别代入 P。'),
        explanation: t(`f(P) = ${subst(F, s.x0, s.y0)} = ${num(f0)}. f_x = ${poly(dxT(F))}, so f_x(P) = ${subst(dxT(F), s.x0, s.y0)} = ${num(fx0)}. f_y = ${poly(dyT(F))}, so f_y(P) = ${subst(dyT(F), s.x0, s.y0)} = ${num(fy0)}.`,
          `f(P) = ${subst(F, s.x0, s.y0)} = ${num(f0)}。f_x = ${poly(dxT(F))}，所以 f_x(P) = ${subst(dxT(F), s.x0, s.y0)} = ${num(fx0)}。f_y = ${poly(dyT(F))}，所以 f_y(P) = ${subst(dyT(F), s.x0, s.y0)} = ${num(fy0)}。`),
        audit: { kind: 'MIT-MV-19:tangent-data', params: { a: s.a, b: s.b, c: s.c, d: s.d, e: s.e, x0: s.x0, y0: s.y0 } },
      }),
      g.number({
        id: 'plane-constant', title: t('Write the tangent plane as z = mx + ny + k', '把切平面写成 z = mx + ny + k'),
        prompt: t(`A surface w = f(x, y) has f(P) = ${num(pf0)}, f_x(P) = ${num(pm)} and f_y(P) = ${num(pn)} at P = (${num(px)}, ${num(py)}). Its tangent plane z = f(P) + f_x(P)(${shift('x', px)}) + f_y(P)(${shift('y', py)}) can be written z = ${coefText(pm, 'x')} ${signed(pn, 'y')} + k. Find k.`,
          `曲面 w = f(x, y) 在 P = (${num(px)}, ${num(py)}) 处有 f(P) = ${num(pf0)}、f_x(P) = ${num(pm)}、f_y(P) = ${num(pn)}。其切平面 z = f(P) + f_x(P)(${shift('x', px)}) + f_y(P)(${shift('y', py)}) 可写成 z = ${coefText(pm, 'x')} ${signed(pn, 'y')} + k。求 k。`),
        fields: [{ label: t('k', 'k'), answer: pk }],
        hint: t('Expand the brackets: the constant part is f(P) − f_x(P)·x₀ − f_y(P)·y₀.', '展开括号：常数部分是 f(P) − f_x(P)·x₀ − f_y(P)·y₀。'),
        explanation: t(`k = f(P) − f_x(P)·x₀ − f_y(P)·y₀ = ${num(pf0)} − ${par(pm)}·${par(px)} − ${par(pn)}·${par(py)} = ${num(pf0)} − ${par(pm * px)} − ${par(pn * py)} = ${num(pk)}.`,
          `k = f(P) − f_x(P)·x₀ − f_y(P)·y₀ = ${num(pf0)} − ${par(pm)}·${par(px)} − ${par(pn)}·${par(py)} = ${num(pf0)} − ${par(pm * px)} − ${par(pn * py)} = ${num(pk)}。`),
        audit: { kind: 'MIT-MV-19:plane-constant', params: { f0: pf0, m: pm, n: pn, x0: px, y0: py } },
      }),
      g.number({
        id: 'estimate', title: t('The linear estimate', '线性估计'),
        prompt: t(`Use the tangent plane at P = (${num(s.x0)}, ${num(s.y0)}) of f(x, y) = ${poly(F)} to estimate f(${num(x1)}, ${num(y1)}), where Δx = ${num(s.dx)} and Δy = ${num(s.dy)}. Use f(x, y) ≈ f(P) + f_x(P)Δx + f_y(P)Δy. Enter the estimate to 2 decimal places (it is the plane's height, not the exact f).`,
          `用 f(x, y) = ${poly(F)} 在 P = (${num(s.x0)}, ${num(s.y0)}) 处的切平面估计 f(${num(x1)}, ${num(y1)})，其中 Δx = ${num(s.dx)}，Δy = ${num(s.dy)}。使用 f(x, y) ≈ f(P) + f_x(P)Δx + f_y(P)Δy。保留 2 位小数输入估计值（这是平面的高度，不是 f 的精确值）。`),
        fields: [{ label: t('estimate', '估计值'), answer: estimate, tolerance: 0.005 }],
        hint: t('You need f(P), f_x(P), f_y(P) (previous card), then add f_x·Δx + f_y·Δy to f(P).', '需要 f(P)、f_x(P)、f_y(P)（上一张卡），再把 f_x·Δx + f_y·Δy 加到 f(P) 上。'),
        explanation: t(`f(P) = ${num(f0)}, f_x(P) = ${num(fx0)}, f_y(P) = ${num(fy0)}. Estimate = ${num(f0)} + ${par(fx0)}·${par(s.dx)} + ${par(fy0)}·${par(s.dy)} = ${num(f0)} + ${par(round2(fx0 * s.dx))} + ${par(round2(fy0 * s.dy))} = ${num(estimate)}. This is the height of the tangent plane; the exact f(${num(x1)}, ${num(y1)}) is different (next card).`,
          `f(P) = ${num(f0)}，f_x(P) = ${num(fx0)}，f_y(P) = ${num(fy0)}。估计值 = ${num(f0)} + ${par(fx0)}·${par(s.dx)} + ${par(fy0)}·${par(s.dy)} = ${num(f0)} + ${par(round2(fx0 * s.dx))} + ${par(round2(fy0 * s.dy))} = ${num(estimate)}。这是切平面的高度；f(${num(x1)}, ${num(y1)}) 的精确值与它不同（见下一张卡）。`),
        audit: { kind: 'MIT-MV-19:estimate', params: { a: s.a, b: s.b, c: s.c, d: s.d, e: s.e, x0: s.x0, y0: s.y0, dx: s.dx, dy: s.dy } },
      }),
      g.number({
        id: 'error', title: t('The estimate is not the exact value', '估计值不等于精确值'),
        prompt: t(`For the same f(x, y) = ${poly(F)}, P = (${num(s.x0)}, ${num(s.y0)}), Δx = ${num(s.dx)}, Δy = ${num(s.dy)}: compute the exact value f(${num(x1)}, ${num(y1)}) by substitution, then subtract the linear estimate f(P) + f_x(P)Δx + f_y(P)Δy. Enter exact − estimate to 2 decimal places.`,
          `仍取 f(x, y) = ${poly(F)}，P = (${num(s.x0)}, ${num(s.y0)})，Δx = ${num(s.dx)}，Δy = ${num(s.dy)}：用代入法算出精确值 f(${num(x1)}, ${num(y1)})，再减去线性估计 f(P) + f_x(P)Δx + f_y(P)Δy。保留 2 位小数输入「精确值 − 估计值」。`),
        fields: [{ label: t('exact − estimate', '精确值 − 估计值'), answer: error, tolerance: 0.005 }],
        hint: t('Substitute x and y directly into f for the exact value. The difference comes from the squared terms in Δx and Δy.', '直接把 x、y 代入 f 得精确值。差值来自 Δx、Δy 的二次项。'),
        explanation: t(`Exact: f(${num(x1)}, ${num(y1)}) = ${subst(F, x1, y1)} = ${num(exact)}. Linear estimate = ${num(estimate)}. Difference = ${num(error)}. It is not 0 because f has squared terms; the tangent plane is exact only when f is linear.`,
          `精确值：f(${num(x1)}, ${num(y1)}) = ${subst(F, x1, y1)} = ${num(exact)}。线性估计 = ${num(estimate)}。差为 ${num(error)}。它不为 0，因为 f 含二次项；只有当 f 是线性函数时切平面才是精确的。`),
        audit: { kind: 'MIT-MV-19:error', params: { a: s.a, b: s.b, c: s.c, d: s.d, e: s.e, x0: s.x0, y0: s.y0, dx: s.dx, dy: s.dy } },
      }),
      g.symbols({
        id: 'formula', title: t('The approximation formula', '近似公式'),
        prompt: t('Complete the approximation formula for the change in w = f(x, y) near P when Δx and Δy are small. Put the x-term first, then +, then the y-term.', '补全 w = f(x, y) 在 P 附近、Δx 与 Δy 很小时的变化量近似公式。先放 x 项，再放 +，最后放 y 项。'),
        before: 'Δw ≈', between: [' ', ' '], answers: ['f_x Δx', '+', 'f_y Δy'], tokens: ['f_x Δx', '+', 'f_y Δy', 'f_x Δy', 'f_y Δx', '×'],
        hint: t('Each partial derivative multiplies the change in its own variable.', '每个偏导数乘以它自己那个变量的改变量。'),
        explanation: t('Δw ≈ f_x Δx + f_y Δy. Moving in x changes w at rate f_x, moving in y at rate f_y, so each rate multiplies its own increment. Mixing f_x with Δy is the typical slip.', 'Δw ≈ f_x Δx + f_y Δy。沿 x 移动时 w 的变化率是 f_x，沿 y 移动时是 f_y，所以每个变化率乘以各自的增量。把 f_x 与 Δy 相乘是常见错误。'),
      }),
      g.choice({
        id: 'when-exact', title: t('When is the tangent plane exact?', '切平面何时是精确的？'),
        prompt: t('For which function does the tangent plane at P give the exact value f(x, y) for every (x, y), not just nearby?', '对哪个函数，P 处的切平面对每个 (x, y)（而不仅是附近）都给出精确的 f(x, y)？'),
        options: [
          t(`f(x, y) = ${poly(lin)}`, `f(x, y) = ${poly(lin)}`),
          t(`f(x, y) = ${poly([[lm, 2, 0], [ln, 0, 1], [lk, 0, 0]])}`, `f(x, y) = ${poly([[lm, 2, 0], [ln, 0, 1], [lk, 0, 0]])}`),
          t(`f(x, y) = ${poly([[lm, 1, 1], [lk, 0, 0]])}`, `f(x, y) = ${poly([[lm, 1, 1], [lk, 0, 0]])}`),
        ], correct: 0,
        hint: t('The tangent plane is a graph of a linear function. When does a graph equal its own tangent plane?', '切平面是线性函数的图像。什么时候一个图像等于它自己的切平面？'),
        explanation: t(`${poly(lin)} is linear, so its graph is already a plane and equals its tangent plane at every point. For the other two the partial derivatives change from point to point: for instance for ${poly([[lm, 2, 0], [ln, 0, 1], [lk, 0, 0]])} the slope in x is ${poly([[2 * lm, 1, 0]])}, so the tangent plane at (1, 0) already differs from f at x = 2 (the squared term is bent away from the plane).`,
          `${poly(lin)} 是线性函数，其图像本身就是平面，在每一点都等于自己的切平面。另外两个函数的偏导数随点变化：例如 ${poly([[lm, 2, 0], [ln, 0, 1], [lk, 0, 0]])} 在 x 方向的斜率是 ${poly([[2 * lm, 1, 0]])}，所以 (1, 0) 处的切平面在 x = 2 处就已经偏离 f（平方项使曲面弯离平面）。`),
      }),
      g.choice({
        id: 'sensitivity', title: t('Which measurement matters most?', '哪个测量最敏感？'),
        prompt: t(`A box has sides a = ${sa}, b = ${sb}, c = ${sc} (measured). Its volume is V = abc. By the approximation formula ΔV ≈ V_a Δa + V_b Δb + V_c Δc. To which side's measurement is V most sensitive: the one whose partial derivative has the largest absolute value?`,
          `一个盒子的边长测得 a = ${sa}，b = ${sb}，c = ${sc}。体积 V = abc。由近似公式 ΔV ≈ V_a Δa + V_b Δb + V_c Δc。V 对哪条边的测量最敏感：即哪个偏导数的绝对值最大？`),
        options: [t('Side a', '边 a'), t('Side b', '边 b'), t('Side c', '边 c')], correct: sensBest, fixedOrder: true,
        hint: t('Compute V_a = bc, V_b = ac, V_c = ab at the given sides and compare.', '在给定边长处计算 V_a = bc、V_b = ac、V_c = ab 并比较。'),
        explanation: t(`V_a = bc = ${sb}·${sc} = ${sens[0]}, V_b = ac = ${sa}·${sc} = ${sens[1]}, V_c = ab = ${sa}·${sb} = ${sens[2]}. The largest is ${Math.max(...sens)}, for side ${'abc'[sensBest]}. The most sensitive side is the one whose partner product is largest, here the shortest side.`,
          `V_a = bc = ${sb}·${sc} = ${sens[0]}，V_b = ac = ${sa}·${sc} = ${sens[1]}，V_c = ab = ${sa}·${sb} = ${sens[2]}。最大的是 ${Math.max(...sens)}，对应边 ${'abc'[sensBest]}。最敏感的边是另两边乘积最大的那条，这里就是最短的边。`),
        audit: { kind: 'MIT-MV-19:sensitivity', params: { a: sa, b: sb, c: sc } },
      }),
      g.choice({
        id: 'cone', title: t('Where does the formula fail?', '公式在哪里失效？'),
        prompt: t('The surface w = √(x² + y²) is a cone with its vertex at the origin. Here f_x = x/√(x² + y²) and f_y = y/√(x² + y²), continuous except at (0, 0), where they do not exist. Where can the tangent-plane approximation not be used?', '曲面 w = √(x² + y²) 是顶点在原点的圆锥面。这里 f_x = x/√(x² + y²)、f_y = y/√(x² + y²)，在 (0, 0) 以外连续，而在 (0, 0) 无定义。切平面近似在哪里不能使用？'),
        options: [
          t('At the origin only: the partial derivatives do not exist there and the cone has a sharp vertex.', '只在原点：该处偏导数不存在，圆锥面有尖顶。'),
          t('At every point of the cone, because a cone is not a plane.', '在圆锥面的每一点，因为圆锥面不是平面。'),
          t('Nowhere: both partial derivatives exist at most points, so the formula always holds.', '处处可用：大多数点上两个偏导数都存在，所以公式总成立。'),
        ], correct: 0,
        hint: t('The formula needs f_x and f_y to exist and be continuous near the point (f smooth there).', '公式要求 f_x、f_y 在该点附近存在且连续（f 在该点光滑）。'),
        explanation: t('Away from the vertex the partials exist and are continuous, so the surface is smooth and has a tangent plane. At (0, 0) the partials do not exist and no plane fits the sharp vertex, so the formula is not valid there. The claim that the formula always holds is wrong because "most points" is not "every point".', '在顶点以外，偏导数存在且连续，曲面光滑并有切平面。在 (0, 0) 偏导数无定义，没有平面能贴合尖顶，所以公式在该点无效。「处处可用」的说法错误，因为「大多数点」不等于「每一点」。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Let f(x, y) = ${poly(Fch)}. Use the tangent plane at (${num(ch.x0)}, ${num(ch.y0)}) to estimate f(${num(round1(ch.x0 + ch.dx))}, ${num(round1(ch.y0 + ch.dy))}), where Δx = ${num(ch.dx)} and Δy = ${num(ch.dy)}. Enter the linear estimate to 2 decimal places.`,
          `设 f(x, y) = ${poly(Fch)}。用 (${num(ch.x0)}, ${num(ch.y0)}) 处的切平面估计 f(${num(round1(ch.x0 + ch.dx))}, ${num(round1(ch.y0 + ch.dy))})，其中 Δx = ${num(ch.dx)}，Δy = ${num(ch.dy)}。保留 2 位小数输入线性估计值。`),
        fields: [{ label: t('linear estimate', '线性估计值'), answer: cest, tolerance: 0.005 }],
        hint: t('f(P), f_x(P), f_y(P); then f(P) + f_x(P)Δx + f_y(P)Δy. Do not substitute the new point into f.', '先求 f(P)、f_x(P)、f_y(P)；再算 f(P) + f_x(P)Δx + f_y(P)Δy。不要把新点代入 f。'),
        explanation: t(`f(P) = ${subst(Fch, ch.x0, ch.y0)} = ${num(cf0)}. f_x = ${poly(dxT(Fch))} gives ${num(cfx)}; f_y = ${poly(dyT(Fch))} gives ${num(cfy)}. Estimate = ${num(cf0)} + ${par(cfx)}·${par(ch.dx)} + ${par(cfy)}·${par(ch.dy)} = ${num(cest)}. The exact value is ${num(cexact)}, which differs. This game assesses the linear estimate; it does not assess error bounds or why the approximation works.`,
          `f(P) = ${subst(Fch, ch.x0, ch.y0)} = ${num(cf0)}。f_x = ${poly(dxT(Fch))}，值为 ${num(cfx)}；f_y = ${poly(dyT(Fch))}，值为 ${num(cfy)}。估计值 = ${num(cf0)} + ${par(cfx)}·${par(ch.dx)} + ${par(cfy)}·${par(ch.dy)} = ${num(cest)}。精确值是 ${num(cexact)}，二者不同。本游戏只检查线性估计，不检查误差界或近似为何成立。`),
        audit: { kind: 'MIT-MV-19:challenge', params: { a: ch.a, b: ch.b, x0: ch.x0, y0: ch.y0, dx: ch.dx, dy: ch.dy } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-20': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-20');
    /** Diagonal quadratic with an integer critical point (xs, ys): c = −2a·xs, d = −2b·ys. */
    const sampleDiag = (aSigns: 'any' | 'same' = 'any') => {
      const a = g.nonzero(-3, 3), b = aSigns === 'same' ? (a > 0 ? g.random(1, 3) : g.random(-3, -1)) : g.nonzero(-3, 3);
      const xs = g.random(-3, 3), ys = g.random(-3, 3), e = g.random(-5, 5);
      return { a, b, xs, ys, e, c: -2 * a * xs, d: -2 * b * ys };
    };

    // 1. f_x = 0
    const d1 = sampleDiag();
    const F1 = diag2(d1.a, d1.b, d1.c, d1.d, d1.e);
    // 2. both
    const d2 = sampleDiag();
    const F2 = diag2(d2.a, d2.b, d2.c, d2.d, d2.e);
    // 3. value at the critical point
    const d3 = sampleDiag();
    const F3 = diag2(d3.a, d3.b, d3.c, d3.d, d3.e);
    const v3 = ev(F3, d3.xs, d3.ys);
    // 4. horizontal tangent plane
    const d4 = sampleDiag();
    const F4 = diag2(d4.a, d4.b, d4.c, d4.d, d4.e);
    const horiz = [vec(d4.xs, d4.ys), vec(d4.xs, d4.ys + 1), vec(d4.xs + 1, d4.ys)];
    // 5. classification, with a mix of cases
    const kind5 = g.random(0, 2); // 0 minimum, 1 maximum, 2 neither
    const d5 = (() => {
      const r = sampleDiag();
      const pa = Math.abs(r.a), pb = Math.abs(r.b);
      const flip = g.pick([1, -1]);
      const a = kind5 === 0 ? pa : kind5 === 1 ? -pa : flip * pa, b = kind5 === 0 ? pb : kind5 === 1 ? -pb : -flip * pb;
      return { ...r, a, b, c: -2 * a * r.xs, d: -2 * b * r.ys };
    })();
    const F5 = diag2(d5.a, d5.b, d5.c, d5.d, d5.e);
    const f5 = ev(F5, d5.xs, d5.ys);
    const view5 = { xmin: d5.xs - 3.2, xmax: d5.xs + 3.2, ymin: d5.ys - 3.2, ymax: d5.ys + 3.2 };
    const offsets5 = kind5 === 0 ? [1, 4, 9] : kind5 === 1 ? [-1, -4, -9] : [1, 4, -1, -4];
    const shapes5: FigureShape[] = [
      ...offsets5.flatMap(h => contourLines((x, y) => d5.a * (x - d5.xs) ** 2 + d5.b * (y - d5.ys) ** 2, view5, h, 60, h > 0 ? 'accent' : 'accent2')),
      { kind: 'point', at: [d5.xs, d5.ys] as Pt, tone: 'warn', label: 'P' },
    ];
    // 6. neither: p x² − q y² + e
    const np = g.random(1, 4), nq = g.random(1, 4), ne = g.random(-3, 3);
    // 7. box
    const bk = g.random(1, 2), bx = g.random(1, 3), by = g.random(1, 3), bz = g.random(1, 3);
    const bA = bk * bx * bx * by * bz, bB = bk * bx * by * by * bz, bR = bk * bz, rc = bR === 1 ? '' : String(bR);
    // 8. challenge with a cross term
    const ch = retry(() => {
      const a = g.nonzero(-3, 3), b = g.nonzero(-3, 3), c = g.nonzero(-3, 3), xs = g.random(-3, 3), ys = g.random(-3, 3);
      return { a, b, c, xs, ys, d: -(2 * a * xs + b * ys), e: -(b * xs + 2 * c * ys) };
    }, v => 4 * v.a * v.c - v.b * v.b !== 0);
    const Fch = quad2(ch.a, ch.b, ch.c, ch.d, ch.e);

    const crit = (d: { a: number; b: number; c: number; d: number; e: number; xs: number; ys: number }) => ({ fx: poly(dxT(diag2(d.a, d.b, d.c, d.d, d.e))), fy: poly(dyT(diag2(d.a, d.b, d.c, d.d, d.e))) });
    const c1 = crit(d1), c2 = crit(d2), c4 = crit(d4);
    const classText = ['P is a minimum: f(x, y) ≥ f(P) for every (x, y).', 'P is a maximum: f(x, y) ≤ f(P) for every (x, y).', 'P is neither a maximum nor a minimum: f is above f(P) in some directions and below it in others.'];
    const classZh = ['P 是最小值点：对每个 (x, y) 都有 f(x, y) ≥ f(P)。', 'P 是最大值点：对每个 (x, y) 都有 f(x, y) ≤ f(P)。', 'P 既不是最大值点也不是最小值点：沿某些方向 f 大于 f(P)，沿另一些方向小于 f(P)。'];
    const fmtList = (xs: number[]) => xs.map(num).join(', ');
    const pos5 = offsets5.filter(h => h > 0), neg5 = offsets5.filter(h => h < 0);
    const alt5 = [
      ['closed curves around P, all at levels above f(P)', '围绕 P 的闭曲线，所有等高线的值都大于 f(P)'],
      ['closed curves around P, all at levels below f(P)', '围绕 P 的闭曲线，所有等高线的值都小于 f(P)'],
      ['open curves that do not enclose P, with levels above f(P) on two sides of P and levels below f(P) on the other two sides', '不包围 P 的开口曲线，P 的两侧是大于 f(P) 的等高线，另外两侧是小于 f(P) 的等高线'],
    ][kind5];

    return [
      g.number({
        id: 'fx-zero', title: t('The x-equation of a critical point', '临界点的 x 方程'),
        prompt: t(`f(x, y) = ${poly(F1)}. A critical point has f_x = 0 and f_y = 0. Compute f_x (hold y fixed) and solve f_x = 0 for x.`, `f(x, y) = ${poly(F1)}。临界点满足 f_x = 0 且 f_y = 0。先求 f_x（固定 y），再解 f_x = 0 求 x。`),
        fields: [{ label: t('x', 'x') , answer: d1.xs }],
        hint: t('f_x contains only x here, because y appears in separate terms. Set it to 0 and solve the linear equation.', '这里 f_x 只含 x，因为 y 出现在另外的项里。令其为 0，解这个线性方程。'),
        explanation: t(`f_x = ${c1.fx}. Setting ${c1.fx} = 0 gives ${poly([[d1.a * 2, 1, 0]])} = ${num(-d1.c)}, so x = ${num(d1.xs)}. For the full critical point we also need f_y = ${c1.fy} = 0, which fixes y separately.`,
          `f_x = ${c1.fx}。令 ${c1.fx} = 0 得 ${poly([[d1.a * 2, 1, 0]])} = ${num(-d1.c)}，所以 x = ${num(d1.xs)}。完整的临界点还需要 f_y = ${c1.fy} = 0，它单独确定 y。`),
        audit: { kind: 'MIT-MV-20:fx-zero', params: { a: d1.a, b: d1.b, c: d1.c, d: d1.d, e: d1.e } },
      }),
      g.number({
        id: 'critical-point', title: t('Find the critical point', '求临界点'),
        prompt: t(`f(x, y) = ${poly(F2)}. Find the point (x, y) where f_x = 0 and f_y = 0.`, `f(x, y) = ${poly(F2)}。求使 f_x = 0 且 f_y = 0 的点 (x, y)。`),
        fields: [{ label: t('x', 'x'), answer: d2.xs }, { label: t('y', 'y'), answer: d2.ys }],
        hint: t('Solve f_x = 0 for x and f_y = 0 for y; each equation has one unknown.', '分别由 f_x = 0 解 x、f_y = 0 解 y；每个方程只含一个未知数。'),
        explanation: t(`f_x = ${c2.fx} = 0 gives x = ${num(d2.xs)}. f_y = ${c2.fy} = 0 gives y = ${num(d2.ys)}. The only critical point is (${num(d2.xs)}, ${num(d2.ys)}). Finding it does not by itself say whether it is a maximum, a minimum or neither.`,
          `f_x = ${c2.fx} = 0 得 x = ${num(d2.xs)}。f_y = ${c2.fy} = 0 得 y = ${num(d2.ys)}。唯一的临界点是 (${num(d2.xs)}, ${num(d2.ys)})。找到它本身并不能说明它是最大值点、最小值点还是都不是。`),
        audit: { kind: 'MIT-MV-20:critical-point', params: { a: d2.a, b: d2.b, c: d2.c, d: d2.d, e: d2.e } },
      }),
      g.number({
        id: 'value', title: t('The value at the critical point', '临界点处的函数值'),
        prompt: t(`f(x, y) = ${poly(F3)} has exactly one critical point. Find the value of f at that point.`, `f(x, y) = ${poly(F3)} 恰有一个临界点。求 f 在该点的值。`),
        fields: [{ label: t('f at the critical point', '临界点处的 f 值'), answer: v3 }],
        hint: t('First find (x, y) from f_x = 0 and f_y = 0, then substitute both coordinates into f itself.', '先由 f_x = 0 与 f_y = 0 求出 (x, y)，再把两个坐标代入 f 本身。'),
        explanation: t(`f_x = ${poly(dxT(F3))} = 0 gives x = ${num(d3.xs)}; f_y = ${poly(dyT(F3))} = 0 gives y = ${num(d3.ys)}. Then f(${num(d3.xs)}, ${num(d3.ys)}) = ${subst(F3, d3.xs, d3.ys)} = ${num(v3)}. This is the value of f at the critical point; whether it is a maximum or minimum is a separate question.`,
          `f_x = ${poly(dxT(F3))} = 0 得 x = ${num(d3.xs)}；f_y = ${poly(dyT(F3))} = 0 得 y = ${num(d3.ys)}。于是 f(${num(d3.xs)}, ${num(d3.ys)}) = ${subst(F3, d3.xs, d3.ys)} = ${num(v3)}。这是 f 在临界点的值；它是最大值还是最小值是另一个问题。`),
        audit: { kind: 'MIT-MV-20:value-at-critical', params: { a: d3.a, b: d3.b, c: d3.c, d: d3.d, e: d3.e } },
      }),
      g.choice({
        id: 'horizontal', title: t('Where is the tangent plane horizontal?', '切平面在哪里是水平的？'),
        prompt: t(`f(x, y) = ${poly(F4)}. The tangent plane at (x₀, y₀) is z = f(x₀, y₀) + f_x(x₀, y₀)(x − x₀) + f_y(x₀, y₀)(y − y₀). At which point is it horizontal (a plane z = constant)?`,
          `f(x, y) = ${poly(F4)}。在 (x₀, y₀) 处的切平面是 z = f(x₀, y₀) + f_x(x₀, y₀)(x − x₀) + f_y(x₀, y₀)(y − y₀)。在哪个点它是水平的（即平面 z = 常数）？`),
        options: horiz.map(p => t(p, p)), correct: 0,
        hint: t('The plane is horizontal when both slopes vanish: f_x = 0 and f_y = 0. Check both at each candidate.', '两个斜率都为零时平面水平：f_x = 0 且 f_y = 0。对每个候选点两个都要检查。'),
        explanation: t(`f_x = ${c4.fx} and f_y = ${c4.fy}. At ${horiz[0]} both are 0. At ${horiz[1]}: f_x = ${num(ev(dxT(F4), d4.xs, d4.ys + 1))} but f_y = ${num(ev(dyT(F4), d4.xs, d4.ys + 1))}. At ${horiz[2]}: f_x = ${num(ev(dxT(F4), d4.xs + 1, d4.ys))} and f_y = ${num(ev(dyT(F4), d4.xs + 1, d4.ys))}. One vanishing partial is not enough: the plane stays tilted in the other direction.`,
          `f_x = ${c4.fx}，f_y = ${c4.fy}。在 ${horiz[0]} 处两者都为 0。在 ${horiz[1]} 处：f_x = ${num(ev(dxT(F4), d4.xs, d4.ys + 1))}，f_y = ${num(ev(dyT(F4), d4.xs, d4.ys + 1))}。在 ${horiz[2]} 处：f_x = ${num(ev(dxT(F4), d4.xs + 1, d4.ys))}，f_y = ${num(ev(dyT(F4), d4.xs + 1, d4.ys))}。只有一个偏导数为零不够：平面在另一个方向上仍是倾斜的。`),
        audit: { kind: 'MIT-MV-20:horizontal-plane', params: { a: d4.a, b: d4.b, c: d4.c, d: d4.d, e: d4.e } },
      }),
      g.choice({
        id: 'classify', title: t('Is the critical point a maximum or a minimum?', '临界点是最大值点还是最小值点？'),
        prompt: t(`f(x, y) = ${poly(F5)} has the critical point P = (${num(d5.xs)}, ${num(d5.ys)}), where f(P) = ${num(f5)}. Which statement can you justify? (f_x = f_y = 0 only locates P. Complete the squares, or compare f along the lines y = ${num(d5.ys)} and x = ${num(d5.xs)}.)`,
          `f(x, y) = ${poly(F5)} 有临界点 P = (${num(d5.xs)}, ${num(d5.ys)})，其中 f(P) = ${num(f5)}。哪个结论可以证明？（f_x = f_y = 0 只能找到 P。请配方，或沿直线 y = ${num(d5.ys)} 与 x = ${num(d5.xs)} 比较 f。）`),
        figure: g.figure({
          alt: t(`Level curves of f around the critical point P = (${num(d5.xs)}, ${num(d5.ys)}): ${alt5[0]}.`, `f 在临界点 P = (${num(d5.xs)}, ${num(d5.ys)}) 附近的等高线：${alt5[1]}。`),
          view: view5, axes: { grid: true }, shapes: shapes5,
          caption: t(`Curves f = f(P) + h for h = ${fmtList(pos5)}${neg5.length ? ` (first colour) and h = ${fmtList(neg5)} (second colour)` : ''}`, `曲线 f = f(P) + h，h = ${fmtList(pos5)}${neg5.length ? '（第一种颜色）与 h = ' + fmtList(neg5) + '（第二种颜色）' : ''}`),
        }),
        options: classText.map((x, i) => t(x, classZh[i])), correct: kind5, fixedOrder: true,
        hint: t('Write f(x, y) = f(P) + A(x − x₀)² + B(y − y₀)². The signs of A and B decide what happens near P.', '写成 f(x, y) = f(P) + A(x − x₀)² + B(y − y₀)²。A、B 的符号决定 P 附近的情形。'),
        explanation: t(`Completing the squares: f(x, y) = ${num(f5)} ${d5.a < 0 ? '−' : '+'} ${sqTerm(d5.a, 'x', d5.xs)} ${d5.b < 0 ? '−' : '+'} ${sqTerm(d5.b, 'y', d5.ys)}. ${kind5 === 0 ? 'Both coefficients are positive, so f ≥ f(P) everywhere: a minimum.' : kind5 === 1 ? 'Both coefficients are negative, so f ≤ f(P) everywhere: a maximum.' : `The coefficients have opposite signs: along y = ${num(d5.ys)} f is ${d5.a > 0 ? 'at least' : 'at most'} f(P), along x = ${num(d5.xs)} it is ${d5.a > 0 ? 'at most' : 'at least'} f(P). So P is neither (a saddle).`} The conditions f_x = f_y = 0 alone cannot tell these cases apart; the second derivative test comes later.`,
          `配方：f(x, y) = ${num(f5)} ${d5.a < 0 ? '−' : '+'} ${sqTerm(d5.a, 'x', d5.xs)} ${d5.b < 0 ? '−' : '+'} ${sqTerm(d5.b, 'y', d5.ys)}。${kind5 === 0 ? '两个系数都为正，所以处处 f ≥ f(P)：最小值点。' : kind5 === 1 ? '两个系数都为负，所以处处 f ≤ f(P)：最大值点。' : `两个系数符号相反：沿 y = ${num(d5.ys)}，f ${d5.a > 0 ? '不小于' : '不大于'} f(P)；沿 x = ${num(d5.xs)}，f ${d5.a > 0 ? '不大于' : '不小于'} f(P)。所以 P 既不是最大值点也不是最小值点（鞍点）。`}仅凭 f_x = f_y = 0 无法区分这些情形；二阶导数检验会在后面学习。`),
        audit: { kind: 'MIT-MV-20:classify', params: { a: d5.a, b: d5.b, c: d5.c, d: d5.d, e: d5.e } },
      }),
      g.choice({
        id: 'neither', title: t('A critical point that is not an extremum', '不是极值点的临界点'),
        prompt: t(`f(x, y) = ${poly([[np, 2, 0], [-nq, 0, 2], [ne, 0, 0]])}. Then f_x = ${poly([[2 * np, 1, 0]])} and f_y = ${poly([[-2 * nq, 0, 1]])} both vanish at (0, 0). What can you conclude about (0, 0)?`,
          `f(x, y) = ${poly([[np, 2, 0], [-nq, 0, 2], [ne, 0, 0]])}。f_x = ${poly([[2 * np, 1, 0]])} 与 f_y = ${poly([[-2 * nq, 0, 1]])} 在 (0, 0) 处都为零。关于 (0, 0) 能得出什么结论？`),
        options: [
          t('It is a minimum, because f_x = f_y = 0 there.', '它是最小值点，因为那里 f_x = f_y = 0。'),
          t('It is a critical point but neither a maximum nor a minimum: f is larger than f(0, 0) along one axis and smaller along the other.', '它是临界点，但既不是最大值点也不是最小值点：沿一条坐标轴 f 大于 f(0, 0)，沿另一条坐标轴小于 f(0, 0)。'),
          t('It is a maximum, because f_x = f_y = 0 there.', '它是最大值点，因为那里 f_x = f_y = 0。'),
        ], correct: 1,
        hint: t('Evaluate f at (1, 0) and at (0, 1) and compare with f(0, 0).', '计算 f 在 (1, 0) 与 (0, 1) 处的值，并与 f(0, 0) 比较。'),
        explanation: t(`f(0, 0) = ${num(ne)}. f(1, 0) = ${num(np + ne)} is above it, while f(0, 1) = ${num(-nq + ne)} is below it. So (0, 0) is a critical point (horizontal tangent plane) that is neither a maximum nor a minimum. Vanishing partial derivatives are necessary at an extremum but not sufficient.`,
          `f(0, 0) = ${num(ne)}。f(1, 0) = ${num(np + ne)} 比它大，而 f(0, 1) = ${num(-nq + ne)} 比它小。所以 (0, 0) 是临界点（切平面水平），但既不是最大值点也不是最小值点。偏导数为零是极值点的必要条件，而不是充分条件。`),
      }),
      g.number({
        id: 'box', title: t('Cheapest material for a box', '盒子的最省材料成本'),
        prompt: t(`A box with no top has a fixed volume V, and its base and sides have different material costs. After eliminating the height z = V/(xy), the total material cost is w(x, y) = ${bA}/x + ${bB}/y + ${rc}xy, with x > 0 and y > 0. Find the critical point (x, y) of w with x > 0 and y > 0.`,
          `一个无盖盒子体积固定为 V，底面与侧面的材料单价不同。消去高度 z = V/(xy) 后，材料总成本为 w(x, y) = ${bA}/x + ${bB}/y + ${rc}xy，其中 x > 0，y > 0。求 w 在 x > 0、y > 0 内的临界点 (x, y)。`),
        fields: [{ label: t('x', 'x'), answer: bx }, { label: t('y', 'y'), answer: by }],
        hint: t(`Set w_x = −${bA}/x² + ${rc}y = 0 and w_y = −${bB}/y² + ${rc}x = 0. Dividing the two relations ${rc}yx² = ${bA} and ${rc}xy² = ${bB} gives x/y.`, `令 w_x = −${bA}/x² + ${rc}y = 0，w_y = −${bB}/y² + ${rc}x = 0。把关系式 ${rc}yx² = ${bA} 与 ${rc}xy² = ${bB} 相除，可得 x/y。`),
        explanation: t(`w_x = −${bA}/x² + ${rc}y = 0 gives ${rc}yx² = ${bA}; w_y = −${bB}/y² + ${rc}x = 0 gives ${rc}xy² = ${bB}. Dividing: x/y = ${frac2(bA, bB)}. Substituting x = ${ratioY(bA, bB)} into ${rc}yx² = ${bA} gives y³ = ${bB * bB}/${bR * bA} = ${num(by ** 3)}, so y = ${num(by)} and x = ${num(bx)}. w_x = w_y = 0 alone does not show that this is a minimum; physically a cheapest box must exist, and the second-derivative test later confirms it.`,
          `w_x = −${bA}/x² + ${rc}y = 0 得 ${rc}yx² = ${bA}；w_y = −${bB}/y² + ${rc}x = 0 得 ${rc}xy² = ${bB}。相除：x/y = ${frac2(bA, bB)}。把 x = ${ratioY(bA, bB)} 代入 ${rc}yx² = ${bA} 得 y³ = ${bB * bB}/${bR * bA} = ${num(by ** 3)}，所以 y = ${num(by)}，x = ${num(bx)}。仅由 w_x = w_y = 0 不能断定它是最小值点；但从物理上看，成本最低的盒子必然存在，后面的二阶导数检验会再确认。`),
        audit: { kind: 'MIT-MV-20:reciprocal-critical', params: { A: bA, B: bB, r: bR } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`f(x, y) = ${poly(Fch)}. Find the one point (x, y) where f_x = 0 and f_y = 0.`, `f(x, y) = ${poly(Fch)}。求使 f_x = 0 且 f_y = 0 的唯一点 (x, y)。`),
        fields: [{ label: t('x', 'x'), answer: ch.xs }, { label: t('y', 'y'), answer: ch.ys }],
        hint: t('Now each partial derivative contains both x and y, so you get two linear equations in x, y. Eliminate one unknown.', '这次每个偏导数都含 x 和 y，得到关于 x、y 的两个线性方程。消去一个未知数。'),
        explanation: t(`f_x = ${poly(dxT(Fch))} = 0 and f_y = ${poly(dyT(Fch))} = 0, i.e. ${poly([[2 * ch.a, 1, 0], [ch.b, 0, 1]])} = ${num(-ch.d)} and ${poly([[ch.b, 1, 0], [2 * ch.c, 0, 1]])} = ${num(-ch.e)}. The solution is (${num(ch.xs)}, ${num(ch.ys)}); check: ${subst(dxT(Fch), ch.xs, ch.ys)} = 0 and ${subst(dyT(Fch), ch.xs, ch.ys)} = 0. This game assesses finding critical points; it does not classify them.`,
          `f_x = ${poly(dxT(Fch))} = 0 且 f_y = ${poly(dyT(Fch))} = 0，即 ${poly([[2 * ch.a, 1, 0], [ch.b, 0, 1]])} = ${num(-ch.d)} 与 ${poly([[ch.b, 1, 0], [2 * ch.c, 0, 1]])} = ${num(-ch.e)}。解为 (${num(ch.xs)}, ${num(ch.ys)})；检验：${subst(dxT(Fch), ch.xs, ch.ys)} = 0，${subst(dyT(Fch), ch.xs, ch.ys)} = 0。本游戏只检查求临界点，不检查如何分类。`),
        audit: { kind: 'MIT-MV-20:challenge', params: { a: ch.a, b: ch.b, c: ch.c, d: ch.d, e: ch.e } },
      }),
    ];
  },
};

/** "2(x − 3)²" for the absolute value of c. */
function sqTerm(c: number, v: string, centre: number): string { const k = Math.abs(c); return `${k === 1 ? '' : num(k)}(${shift(v, centre)})²`; }
// ---- small text helpers used above (hoisted function declarations) ----
/** "3x" / "−x" for a leading coefficient. */
function coefText(c: number, v: string): string { return c === 1 ? v : c === -1 ? `−${v}` : `${num(c)}${v}`; }
/** "+ 3y" / "− y" for a following term. */
function signed(c: number, v: string): string { return `${c < 0 ? '−' : '+'} ${Math.abs(c) === 1 ? v : `${num(Math.abs(c))}${v}`}`; }
/** "3y", "y" or "(1/2)y". */
function ratioY(p: number, q: number): string { const d = gcd(p, q); const n = p / d, m = q / d; return m === 1 ? (n === 1 ? 'y' : `${n}y`) : `(${n}/${m})y`; }
/** Reduced fraction "p/q". */
function frac2(p: number, q: number): string { const d = gcd(p, q); const n = p / d, m = q / d; return m === 1 ? num(n) : `${n}/${m}`; }
function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
