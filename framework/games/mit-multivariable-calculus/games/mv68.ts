import type { CardGenerator } from '../../types';
import { axes3d, arrow3d, fitView, line3d, project3d, wire3d, type FigureShape, type Pt } from '../../figure';
import { coef, exact, linear, makeMvDeck, num, par, piTerm, term, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string): Text => [en, zh];
/** Required closing note (plan line 218) on what the game does not assess. */
const NOT_ASSESSED_EN = 'This game does not ask you to prove Green\'s, Stokes\' or the divergence theorem, to find a potential function for a field in space, or to compute the flux through a curved surface in any way other than the divergence theorem or the parametrisation given.';
const NOT_ASSESSED_ZH = '本游戏不要求证明格林定理、斯托克斯定理或散度定理，不要求为空间中的场求势函数，也不要求用散度定理和所给参数化之外的方法计算穿过曲面的通量。';

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

function linStr(a: number, b: number): string {
  if (b === 0) return num(a);
  if (a === 0) return coef(b, 't');
  const sign = b > 0 ? ' + ' : ' − ';
  const absB = Math.abs(b);
  const bAbsStr = absB === 1 ? 't' : `${absB}t`;
  return `${num(a)}${sign}${bAbsStr}`;
}

/** A scaled parenthesised expression: k = 1 prints "(s)", k = -1 prints "−(s)", k = 3 prints "3(s)". */
const mul = (k: number, s: string): string => `${k === 1 ? '' : k === -1 ? '−' : num(k)}(${s})`;
/** Sum of two scaled expressions with the second sign printed correctly ("3(3 − 6t) − 3(−1 + 3t)"). */
const addProd = (k1: number, s1: string, k2: number, s2: string): string => `${mul(k1, s1)} ${k2 < 0 ? '−' : '+'} ${mul(Math.abs(k2), s2)}`;

export const mv68: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-68');
  warm(g);

  // 1. flux-form
  const letterPairs = [
    { M: 'P', N: 'Q' }, { M: 'M', N: 'N' }, { M: 'f', N: 'g' }, { M: 'u', N: 'v' }
  ];
  const fp = letterPairs[g.random(0, 3)];
  const ccw = g.random(0, 1) > 0.5;
  const dirEN = ccw ? 'counterclockwise' : 'clockwise';
  const dirZH = ccw ? '逆时针' : '顺时针';
  const ans1 = ccw ? `−${fp.N}` : fp.N;
  const ans2 = ccw ? fp.M : `−${fp.M}`;
  const tokens1 = shuffled(g, [fp.M, fp.N, `−${fp.M}`, `−${fp.N}`, `${fp.M} + ${fp.N}`, `${fp.M} − ${fp.N}`]);

  // 2. flux-area
  const fa = retry(() => ({
    a: g.pick([-2, -1, 1, 2, 3, 4]),
    b: g.pick([-2, -1, 1, 2, 3, 4]),
    c: g.pick([-3, -2, -1, 1, 2, 3]),
    d: g.pick([-3, -2, -1, 1, 2, 3]),
    p: g.pick([2, 3, 4, 5]),
    q: g.pick([2, 3, 4, 5])
  }), v => v.a + v.b !== 0);
  const faAns = (fa.a + fa.b) * fa.p * fa.q / 2;
  const faArea = fa.p * fa.q / 2;
  const faShapes: FigureShape[] = [
    { kind: 'area', points: [[0, 0], [fa.p, 0], [0, fa.q]], tone: 'accent', opacity: 0.25 },
    { kind: 'line', points: [[0, 0], [fa.p, 0], [0, fa.q], [0, 0]], tone: 'accent', width: 2 },
    { kind: 'point', at: [0, 0], tone: 'text', label: '(0, 0)' },
    { kind: 'point', at: [fa.p, 0], tone: 'text', label: `(${fa.p}, 0)` },
    { kind: 'point', at: [0, fa.q], tone: 'text', label: `(0, ${fa.q})` },
  ];
  // Figure2D draws the point label 8 px right and 8 px up of the point, and the y-axis name "y" at the top
  // of the frame (x = axis + 6, y = 16). For flat triangles (small q/p) the (0, q) point lands near the top
  // and its label collides with "y". One extra invisible point above (0, q) makes fitView leave headroom:
  // the rendered shapes stay in faShapes; only the view is computed from faViewShapes.
  const faViewShapes: FigureShape[] = [...faShapes, { kind: 'point', at: [0, fa.q + 0.5] }];

  // 3. segment-setup
  const ss = retry(() => {
    const x0 = g.random(0, 5), y0 = g.random(0, 5), z0 = g.random(0, 5);
    const x1 = g.random(0, 5), y1 = g.random(0, 5), z1 = g.random(0, 5);
    const v1 = x1 - x0, v2 = y1 - y0, v3 = z1 - z0;
    if (v1 === 0 || v2 === 0 || v3 === 0) return null;
    const alpha = v1 * (y0 - x0) + v3 * (y0 - z0);
    const beta = v1 * (v2 - v1) + v3 * (v2 - v3);
    if (beta === 0) return null;
    const t1 = linStr(alpha, beta);
    const t2 = linStr((y0 - x0) + (y0 - z0), (v2 - v1) + (v2 - v3));
    const t3 = linStr(v1 * (y0 - x0), v1 * (v2 - v1));
    const t4 = linStr(v3 * (y0 - z0), v3 * (v2 - v3));
    const t5 = linStr(v1 * (y0 - x0) + v2 * (y0 - z0), v1 * (v2 - v1) + v2 * (v2 - v3));
    const t6 = num(v1 * (y1 - x1) + v3 * (y1 - z1));
    const toks = [t1, t2, t3, t4, t5, t6];
    if (new Set(toks).size !== 6) return null;
    return { x0, y0, z0, x1, y1, z1, v1, v2, v3, alpha, beta, t1, toks };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v1: number, v2: number, v3: number, alpha: number, beta: number, t1: string, toks: string[] }>>>;
  const ssTokens = shuffled(g, ss.toks);

  // 4. segment
  const sg = retry(() => {
    const x0 = g.random(0, 5), y0 = g.random(0, 5), z0 = g.random(0, 5);
    const x1 = g.random(0, 5), y1 = g.random(0, 5), z1 = g.random(0, 5);
    const v1 = x1 - x0, v2 = y1 - y0, v3 = z1 - z0;
    if (v1 === 0 || v2 === 0 || v3 === 0) return null;
    const alpha = v1 * (y0 - x0) + v3 * (y0 - z0);
    const beta = v1 * (v2 - v1) + v3 * (v2 - v3);
    const ans = alpha + beta / 2;
    if (ans === 0) return null;
    return { x0, y0, z0, x1, y1, z1, v1, v2, v3, alpha, beta, ans };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v1: number, v2: number, v3: number, alpha: number, beta: number, ans: number }>>>;

  // 5. conservative-ab
  const ca = retry(() => {
    const qx = g.pick([2, 4, 6, 8, 10]);
    const qz = g.pick([2, 4, 6, 8, 10]);
    if (qx === qz) return null;
    return { qx, qz };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { qx: number, qz: number }>>>;
  const caA = ca.qx / 2;
  const caB = ca.qz / 2;

  // 6. cap-setup
  const cs = retry(() => {
    const a = g.pick([1, 2, 3]);
    const b = g.pick([1, 2, 3]);
    const c = g.pick([1, 2, 3]);
    const h = g.pick([1, 2, 3, 4]);
    if (c === a + b || c === a + b + 1) return null;
    return { a, b, c, h };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { a: number, b: number, c: number, h: number }>>>;
  const csDiv = cs.a + cs.b + 1;
  const csTokens = shuffled(g, [String(csDiv), String(cs.a + cs.b), String(cs.a + cs.b + cs.c + 1), `${coef(cs.a, 'x')} + ${coef(cs.b, 'y')} + z + ${cs.c}`, '−', '+', `−${cs.c}`, String(cs.c), '0']);

  // 7. cap-flux
  const cf = retry(() => {
    const a = g.pick([1, 2, 3]);
    const b = g.pick([1, 2, 3]);
    const c = g.pick([1, 2, 3]);
    const h = g.pick([1, 2, 3, 4]);
    return { a, b, c, h };
  }, v => true) as { a: number, b: number, c: number, h: number };
  const cfK = (cf.a + cf.b + 1) * cf.h * cf.h / 2 + cf.c * cf.h;

  // 8. curl-setup
  const cu = retry(() => {
    const a = g.pick([1, 2, 3]);
    const b = g.pick([1, 2, 3]);
    const c = g.pick([1, 2, 3, 4, 5, 6, 7, 8]);
    if (c === 2 * a || c === 4 * a) return null;
    return { a, b, c };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { a: number, b: number, c: number }>>>;
  const cuJ = 2 * cu.a - cu.c;
  const cuJStr = coef(cuJ, 'z');
  const cuTokens = shuffled(g, ['0', cuJStr, coef(2 * cu.a + cu.c, 'z'), coef(cu.c - 2 * cu.a, 'z'), coef(2 * cu.a, 'z'), coef(2 * cu.b, 'y')]);

  // 9. cylinder-reason
  const cy = retry(() => {
    const a = g.pick([1, 2, 3]);
    const b = g.pick([1, 2, 3]);
    const c = g.pick([1, 2, 3, 4, 5, 6]);
    if (c === 2 * a) return null;
    return { a, b, c };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { a: number, b: number, c: number }>>>;
  const cyJ = 2 * cy.a - cy.c;

  // 10. challenge
  const ch = retry(() => {
    const a = g.pick([1, 2, 3]);
    const b = g.pick([1, 2, 3]);
    const c = g.pick([1, 2, 3, 4, 5, 6]);
    const z0 = g.pick([-3, -2, -1, 1, 2, 3]);
    if (c === 2 * a) return null;
    const k = (c - 2 * a) * z0;
    if (k === 0) return null;
    return { a, b, c, z0, k };
  }, v => v !== null) as NonNullable<ReturnType<typeof retry<null | { a: number, b: number, c: number, z0: number, k: number }>>>;

  // Figure helpers for 3D cards
  const makeSegFig = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): FigureShape[] => {
    const L = Math.max(x0, y0, z0, x1, y1, z1) + 1;
    const shapes: FigureShape[] = [
      ...axes3d(L),
      // The whole segment, plus an arrow from A to its midpoint: an arrowhead at B would sit under B's dot.
      line3d([[x0, y0, z0], [x1, y1, z1]], 'accent', { width: 2 }),
      arrow3d([x0, y0, z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], 'accent'),
      { kind: 'point', at: project3d([x0, y0, z0]), tone: 'accent2', label: 'A' },
      { kind: 'point', at: project3d([x1, y1, z1]), tone: 'accent2', label: 'B' },
    ];
    return shapes;
  };

  const makeCapFig = (h: number): FigureShape[] => {
    const L = Math.max(Math.sqrt(h), h) + 1;
    const shapes: FigureShape[] = [
      ...axes3d(L),
      ...wire3d((u: number, v: number) => [u * Math.cos(v), u * Math.sin(v), h - u * u], 0, Math.sqrt(h), 0, 2 * Math.PI, 4, 12, 36),
      line3d(Array.from({ length: 49 }, (_, i) => {
        const s = 2 * Math.PI * i / 48;
        return [Math.sqrt(h) * Math.cos(s), Math.sqrt(h) * Math.sin(s), 0] as [number, number, number];
      }), 'warn'),
      arrow3d([0, 0, h], [0, 0, h + 1.5], 'accent2', 'n'),
    ];
    return shapes;
  };

  return [
    g.symbols({
      id: 'flux-form',
      title: t('Flux as a line integral', '通量的线积分形式'),
      prompt: t(
        `F = (${fp.M}, ${fp.N}) is a vector field in the plane. C is a simple closed curve traversed ${dirEN}, and n is the unit normal that points out of the region enclosed by C. Complete the outward flux: ∮_C F · n ds = ∮_C ( [ ] ) dx + ( [ ] ) dy.`,
        `F = (${fp.M}, ${fp.N}) 是平面向量场。C 是沿${dirZH}方向绕行的简单闭曲线，n 是指向 C 所围区域外部的单位法向量。补全向外通量：∮_C F · n ds = ∮_C ( [ ] ) dx + ( [ ] ) dy。`
      ),
      before: '∮_C F · n ds = ∮_C (',
      between: [') dx + ('],
      after: ') dy',
      answers: [ans1, ans2],
      tokens: tokens1,
      hint: t('Write the small step along C as (dx, dy). The outward normal step n ds is that vector turned by 90°; the direction of the turn depends on which way C is traversed.', '把沿 C 的一小步写成 (dx, dy)。向外的 n ds 是该向量转 90° 所得；转哪个方向取决于 C 的绕行方向。'),
      explanation: ccw
        ? t(`Going counterclockwise, the outward normal is the step (dx, dy) turned clockwise by 90°, so n ds = (dy, −dx) and F · n ds = ${fp.M} dy − ${fp.N} dx. Written with dx first this is (−${fp.N}) dx + ${fp.M} dy. The pair (${fp.M}, ${fp.N}) would give the circulation ∮ F · dr, the work, not the flux.`,
          `沿逆时针方向，向外的法向量是把 (dx, dy) 顺时针转 90°：n ds = (dy, −dx)，所以 F · n ds = ${fp.M} dy − ${fp.N} dx，把 dx 项写在前面就是 (−${fp.N}) dx + ${fp.M} dy。填 (${fp.M}, ${fp.N}) 得到的是环流 ∮ F · dr（功），不是通量。`)
        : t(`Going clockwise, the steps dx and dy have the opposite signs, and the outward normal is the step (dx, dy) turned counterclockwise by 90°: n ds = (−dy, dx). So F · n ds = ${fp.N} dx − ${fp.M} dy. The formula changes sign with the direction of travel because dx and dy do, while the flux itself is the same number.`,
          `沿顺时针方向，dx、dy 的符号与逆时针时相反，向外的法向量是把 (dx, dy) 逆时针转 90°：n ds = (−dy, dx)，所以 F · n ds = ${fp.N} dx − ${fp.M} dy。公式的符号随绕行方向改变，是因为 dx、dy 改变了符号；通量本身是同一个数。`),
    }),
    g.number({
      id: 'flux-area',
      title: t('Flux out of a triangle', '穿出三角形的通量'),
      prompt: t(
        `F = (${linear([fa.a, fa.c], ['x', 'y'])}, ${linear([fa.d, fa.b], ['x', 'y'])}). R is the triangle with vertices (0, 0), (${fa.p}, 0) and (0, ${fa.q}), and C is its boundary, traversed counterclockwise, with n the outward unit normal. Find the flux ∮_C F · n ds. Enter an integer or a fraction.`,
        `F = (${linear([fa.a, fa.c], ['x', 'y'])}, ${linear([fa.d, fa.b], ['x', 'y'])})。R 是顶点为 (0, 0)、(${fa.p}, 0)、(0, ${fa.q}) 的三角形，C 是它的边界，沿逆时针方向绕行，n 是向外的单位法向量。求通量 ∮_C F · n ds。填整数或分数。`
      ),
      figure: g.figure({
        alt: t(`The triangle with vertices (0, 0), (${fa.p}, 0) and (0, ${fa.q}) in the xy-plane.`, `xy 平面内顶点为 (0, 0)、(${fa.p}, 0)、(0, ${fa.q}) 的三角形。`),
        view: fitView(faViewShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: faShapes,
      }),
      fields: [{ label: t('flux', '通量'), answer: faAns }],
      hint: t("Green's theorem in normal form turns the flux into a double integral over R. Which partial derivatives appear in the integrand, and how big is R?", '格林定理的法向形式把通量化为 R 上的二重积分。被积函数含哪些偏导数？R 的面积是多少？'),
      explanation: t(
        `By Green's theorem in normal form the flux is ∬_R (∂P/∂x + ∂Q/∂y) dA = ∬_R (${num(fa.a)} ${term(fa.b)}) dA = ${num(fa.a + fa.b)} · area(R). The terms ${coef(fa.c, 'y')} and ${coef(fa.d, 'x')} do not contribute, because ∂(${coef(fa.c, 'y')})/∂x = 0 and ∂(${coef(fa.d, 'x')})/∂y = 0. The triangle has area ${fa.p}·${fa.q}/2 = ${exact(faArea)}, so the flux is ${num(fa.a + fa.b)} · ${exact(faArea)} = ${exact(faAns)}.`,
        `由格林定理的法向形式，通量 = ∬_R (∂P/∂x + ∂Q/∂y) dA = ∬_R (${num(fa.a)} ${term(fa.b)}) dA = ${num(fa.a + fa.b)} · R 的面积。项 ${coef(fa.c, 'y')} 与 ${coef(fa.d, 'x')} 没有贡献，因为 ∂(${coef(fa.c, 'y')})/∂x = 0，∂(${coef(fa.d, 'x')})/∂y = 0。三角形的面积是 ${fa.p}·${fa.q}/2 = ${exact(faArea)}，所以通量 = ${num(fa.a + fa.b)} · ${exact(faArea)} = ${exact(faAns)}。`
      ),
      audit: { kind: 'MIT-MV-68:flux-area', params: { a: fa.a, b: fa.b, c: fa.c, d: fa.d, p: fa.p, q: fa.q } },
    }),
    g.symbols({
      id: 'segment-setup',
      title: t('Set up the line integral', '写出线积分的参数式'),
      prompt: t(
        `C is the straight line segment from A = (${ss.x0}, ${ss.y0}, ${ss.z0}) to B = (${ss.x1}, ${ss.y1}, ${ss.z1}). Parametrise it by r(t) = A + t(B − A), 0 ≤ t ≤ 1, that is x = ${linStr(ss.x0, ss.v1)}, y = ${linStr(ss.y0, ss.v2)}, z = ${linStr(ss.z0, ss.v3)}. Then ∫_C (y − x) dx + (y − z) dz = the integral from t = 0 to t = 1 of ( [ ] ) dt.`,
        `C 是从 A = (${ss.x0}, ${ss.y0}, ${ss.z0}) 到 B = (${ss.x1}, ${ss.y1}, ${ss.z1}) 的直线段。取参数化 r(t) = A + t(B − A)，0 ≤ t ≤ 1，即 x = ${linStr(ss.x0, ss.v1)}，y = ${linStr(ss.y0, ss.v2)}，z = ${linStr(ss.z0, ss.v3)}。于是 ∫_C (y − x) dx + (y − z) dz = t 从 0 到 1 对 ( [ ] ) dt 的积分。`
      ),
      figure: g.figure({
        alt: t(`The segment from A = (${ss.x0}, ${ss.y0}, ${ss.z0}) to B = (${ss.x1}, ${ss.y1}, ${ss.z1}) in space, with an arrow pointing from A to B and the three coordinate axes.`, `空间中从 A = (${ss.x0}, ${ss.y0}, ${ss.z0}) 到 B = (${ss.x1}, ${ss.y1}, ${ss.z1}) 的线段，箭头由 A 指向 B，并画出三条坐标轴。`),
        view: fitView(makeSegFig(ss.x0, ss.y0, ss.z0, ss.x1, ss.y1, ss.z1), 0.25),
        shapes: makeSegFig(ss.x0, ss.y0, ss.z0, ss.x1, ss.y1, ss.z1),
      }),
      before: lang === 'zh' ? '∫_C (y − x) dx + (y − z) dz = t 从 0 到 1 对 (' : '∫_C (y − x) dx + (y − z) dz = the integral from t = 0 to t = 1 of (',
      between: [],
      after: lang === 'zh' ? ') dt 的积分' : ') dt',
      answers: [ss.t1],
      tokens: ssTokens,
      hint: t('Substitute x(t), y(t), z(t) into y − x and y − z, and replace dx and dz by x′(t) dt and z′(t) dt.', '把 x(t)、y(t)、z(t) 代入 y − x 与 y − z，并把 dx、dz 换成 x′(t) dt、z′(t) dt。'),
      explanation: t(
        `Here dx = ${num(ss.v1)} dt and dz = ${num(ss.v3)} dt. Along the segment y − x = ${linStr(ss.y0 - ss.x0, ss.v2 - ss.v1)} and y − z = ${linStr(ss.y0 - ss.z0, ss.v2 - ss.v3)}. So the integrand is ${addProd(ss.v1, linStr(ss.y0 - ss.x0, ss.v2 - ss.v1), ss.v3, linStr(ss.y0 - ss.z0, ss.v2 - ss.v3))} = ${ss.t1}.`,
        `这里 dx = ${num(ss.v1)} dt，dz = ${num(ss.v3)} dt。沿线段 y − x = ${linStr(ss.y0 - ss.x0, ss.v2 - ss.v1)}，y − z = ${linStr(ss.y0 - ss.z0, ss.v2 - ss.v3)}。所以被积函数是 ${addProd(ss.v1, linStr(ss.y0 - ss.x0, ss.v2 - ss.v1), ss.v3, linStr(ss.y0 - ss.z0, ss.v2 - ss.v3))} = ${ss.t1}。`
      ),
    }),
    g.number({
      id: 'segment',
      title: t('Work along a segment', '沿线段的线积分'),
      prompt: t(
        `C is the straight line segment from A = (${sg.x0}, ${sg.y0}, ${sg.z0}) to B = (${sg.x1}, ${sg.y1}, ${sg.z1}). Find ∫_C (y − x) dx + (y − z) dz. Enter an integer or a fraction.`,
        `C 是从 A = (${sg.x0}, ${sg.y0}, ${sg.z0}) 到 B = (${sg.x1}, ${sg.y1}, ${sg.z1}) 的直线段。求 ∫_C (y − x) dx + (y − z) dz。填整数或分数。`
      ),
      figure: g.figure({
        alt: t(`The segment from A = (${sg.x0}, ${sg.y0}, ${sg.z0}) to B = (${sg.x1}, ${sg.y1}, ${sg.z1}) in space, with an arrow pointing from A to B and the three coordinate axes.`, `空间中从 A = (${sg.x0}, ${sg.y0}, ${sg.z0}) 到 B = (${sg.x1}, ${sg.y1}, ${sg.z1}) 的线段，箭头由 A 指向 B，并画出三条坐标轴。`),
        view: fitView(makeSegFig(sg.x0, sg.y0, sg.z0, sg.x1, sg.y1, sg.z1), 0.25),
        shapes: makeSegFig(sg.x0, sg.y0, sg.z0, sg.x1, sg.y1, sg.z1),
      }),
      fields: [{ label: t('∫_C', '∫_C'), answer: sg.ans }],
      hint: t('Parametrise the segment by r(t) = A + t(B − A), 0 ≤ t ≤ 1, express the integrand in t, then integrate.', '把线段参数化为 r(t) = A + t(B − A)，0 ≤ t ≤ 1，把被积式写成 t 的函数，再积分。'),
      explanation: t(
        `With r(t) = A + t(B − A): dx = ${num(sg.v1)} dt, dz = ${num(sg.v3)} dt, y − x = ${linStr(sg.y0 - sg.x0, sg.v2 - sg.v1)}, y − z = ${linStr(sg.y0 - sg.z0, sg.v2 - sg.v3)}. The integrand is ${linStr(sg.alpha, sg.beta)}, and ∫ from 0 to 1 gives ${num(sg.alpha)} ${term(sg.beta)}/2 = ${exact(sg.ans)}.`,
        `取 r(t) = A + t(B − A)：dx = ${num(sg.v1)} dt，dz = ${num(sg.v3)} dt，y − x = ${linStr(sg.y0 - sg.x0, sg.v2 - sg.v1)}，y − z = ${linStr(sg.y0 - sg.z0, sg.v2 - sg.v3)}。被积函数为 ${linStr(sg.alpha, sg.beta)}，从 0 到 1 积分得 ${num(sg.alpha)} ${term(sg.beta)}/2 = ${exact(sg.ans)}。`
      ),
      audit: { kind: 'MIT-MV-68:segment', params: { x0: sg.x0, y0: sg.y0, z0: sg.z0, x1: sg.x1, y1: sg.y1, z1: sg.z1 } },
    }),
    g.number({
      id: 'conservative-ab',
      title: t('Make F conservative', '使 F 为保守场'),
      prompt: t(
        `F = (a y², ${coef(ca.qx, 'x')}y + ${coef(ca.qz, 'y')}z, b y² + z²) is defined on all of space, where a and b are constants. Find a and b so that F is conservative. (Both are integers.)`,
        `F = (a y², ${coef(ca.qx, 'x')}y + ${coef(ca.qz, 'y')}z, b y² + z²) 定义在整个空间，其中 a、b 是常数。求 a 与 b，使 F 为保守场。（均为整数。）`
      ),
      fields: [
        { label: t('a', 'a'), answer: caA },
        { label: t('b', 'b'), answer: caB },
      ],
      hint: t('On all of space F = (P, Q, R) is conservative exactly when P_y = Q_x, P_z = R_x and Q_z = R_y. Two of these equalities contain a or b.', '在整个空间上，F = (P, Q, R) 是保守场当且仅当 P_y = Q_x、P_z = R_x、Q_z = R_y。其中有两个等式含 a 或 b。'),
      explanation: t(
        `P = a y², Q = ${coef(ca.qx, 'x')}y + ${coef(ca.qz, 'y')}z, R = b y² + z². P_y = 2a y and Q_x = ${ca.qx} y, so 2a = ${ca.qx} and a = ${caA}. Q_z = ${ca.qz} y and R_y = 2b y, so 2b = ${ca.qz} and b = ${caB}. The third equality P_z = 0 = R_x holds. Then f = ${coef(caA, 'x')}y² + ${coef(caB, 'y')}²z + z³/3 satisfies ∇f = F.`,
        `P_y = 2a y，Q_x = ${ca.qx} y，所以 2a = ${ca.qx}，a = ${caA}。Q_z = ${ca.qz} y，R_y = 2b y，所以 2b = ${ca.qz}，b = ${caB}。第三个等式 P_z = 0 = R_x 成立。此时 f = ${coef(caA, 'x')}y² + ${coef(caB, 'y')}²z + z³/3 满足 ∇f = F。`
      ),
      audit: { kind: 'MIT-MV-68:conservative-ab', params: { qx: ca.qx, qz: ca.qz } },
    }),
    g.symbols({
      id: 'cap-setup',
      title: t('Close the cap and use the divergence theorem', '补上底面，用散度定理'),
      prompt: t(
        `U is the paraboloid cap z = ${cs.h} − x² − y², z ≥ 0, with the normal pointing up. B is the flat disc x² + y² ≤ ${cs.h} in the plane z = 0, with the normal pointing down. Together they bound a solid V (outward normals). F = (${coef(cs.a, 'x')}, ${coef(cs.b, 'y')}, z + ${cs.c}). By the divergence theorem, flux through U = ∭_V ( [ ] ) dV [ ] ∬_B F · n dS, and on B we have F · n = [ ].`,
        `U 是曲面 z = ${cs.h} − x² − y²（z ≥ 0，抛物面帽），法向量向上；B 是平面 z = 0 上的圆盘 x² + y² ≤ ${cs.h}，法向量向下。二者围成立体 V（法向量均向外）。F = (${coef(cs.a, 'x')}, ${coef(cs.b, 'y')}, z + ${cs.c})。由散度定理，F 穿过 U 的通量 = ∭_V ( [ ] ) dV [ ] ∬_B F · n dS，并且在 B 上 F · n = [ ]。`
      ),
      figure: g.figure({
        alt: t(`A paraboloid cap above the xy-plane whose rim is the circle x² + y² = ${cs.h} in the plane z = 0, with an arrow n pointing up from its top.`, `xy 平面上方的抛物面帽，边缘是平面 z = 0 内的圆 x² + y² = ${cs.h}，顶点处有向上的箭头 n。`),
        view: fitView(makeCapFig(cs.h), 0.25),
        shapes: makeCapFig(cs.h),
      }),
      before: lang === 'zh' ? 'F 穿过 U 的通量 = ∭_V (' : 'flux through U = ∭_V (',
      between: lang === 'zh' ? [') dV ', ' ∬_B F · n dS，并且在 B 上 F · n = '] : [') dV ', ' ∬_B F · n dS, and on B we have F · n = '],
      after: lang === 'zh' ? '。' : '.',
      answers: [String(csDiv), '−', `−${cs.c}`],
      tokens: csTokens,
      hint: t('div F is the sum of the three partial derivatives. Flux through the closed surface = flux through U + flux through B. On B the outward normal is −k and z = 0.', 'div F 是三个偏导数之和。闭曲面上的通量 = U 上的通量 + B 上的通量。在 B 上，向外法向量是 −k，且 z = 0。'),
      explanation: t(
        `div F = ∂(${coef(cs.a, 'x')})/∂x + ∂(${coef(cs.b, 'y')})/∂y + ∂(z + ${cs.c})/∂z = ${cs.a} + ${cs.b} + 1 = ${csDiv}. For the closed surface U + B the divergence theorem says flux(U) + flux(B) = ∭_V div F dV, so flux(U) = ∭_V (${csDiv}) dV − flux(B). On B, z = 0 and n = −k, so F · n = −(z + ${cs.c}) = −${cs.c}.`,
        `div F = ∂(${coef(cs.a, 'x')})/∂x + ∂(${coef(cs.b, 'y')})/∂y + ∂(z + ${cs.c})/∂z = ${cs.a} + ${cs.b} + 1 = ${csDiv}。对闭曲面 U + B，散度定理给出 U 上的通量 + B 上的通量 = ∭_V div F dV，所以 U 上的通量 = ∭_V (${csDiv}) dV − B 上的通量。在 B 上 z = 0，n = −k，所以 F · n = −(z + ${cs.c}) = −${cs.c}。`
      ),
    }),
    g.number({
      id: 'cap-flux',
      title: t('Flux across the cap', '穿过抛物面帽的通量'),
      prompt: t(
        `U is the paraboloid cap z = ${cf.h} − x² − y², z ≥ 0, with the normal pointing up. Find the flux of F = (${coef(cf.a, 'x')}, ${coef(cf.b, 'y')}, z + ${cf.c}) across U. It equals kπ; enter k (an integer or a fraction).`,
        `U 是抛物面帽 z = ${cf.h} − x² − y²（z ≥ 0），法向量向上。求 F = (${coef(cf.a, 'x')}, ${coef(cf.b, 'y')}, z + ${cf.c}) 穿过 U 的通量。它等于 kπ，求 k（整数或分数）。`
      ),
      figure: g.figure({
        alt: t(`A paraboloid cap above the xy-plane whose rim is the circle x² + y² = ${cf.h} in the plane z = 0, with an arrow n pointing up from its top.`, `xy 平面上方的抛物面帽，边缘是平面 z = 0 内的圆 x² + y² = ${cf.h}，顶点处有向上的箭头 n。`),
        view: fitView(makeCapFig(cf.h), 0.25),
        shapes: makeCapFig(cf.h),
      }),
      fields: [{ label: t('k', 'k'), answer: cfK }],
      hint: t(`Close U with the flat disc B in the plane z = 0 and use the divergence theorem, or integrate F · (2x, 2y, 1) over the disc x² + y² ≤ ${cf.h}.`, `用平面 z = 0 上的圆盘 B 把 U 封闭后用散度定理，或者在圆盘 x² + y² ≤ ${cf.h} 上对 F · (2x, 2y, 1) 积分。`),
      explanation: t(
        `div F = ${cf.a + cf.b + 1} and the solid under U has volume π·${cf.h}²/2 = ${piTerm(cf.h * cf.h / 2)}, so the closed surface has total flux ${piTerm((cf.a + cf.b + 1) * (cf.h * cf.h / 2))}. On the base B, n = −k and z = 0, so F · n = −${cf.c} and the flux through B is −${cf.c}·(area π·${cf.h}) = ${piTerm(-(cf.c * cf.h))}. The flux through U is therefore ${piTerm((cf.a + cf.b + 1) * (cf.h * cf.h / 2))} − (${piTerm(-(cf.c * cf.h))}) = ${piTerm(cfK)}, so k = ${exact(cfK)}.`,
        `div F = ${cf.a + cf.b + 1}，U 下方立体的体积为 π·${cf.h}²/2 = ${piTerm(cf.h * cf.h / 2)}，所以闭曲面上的总通量为 ${piTerm((cf.a + cf.b + 1) * (cf.h * cf.h / 2))}。在底面 B 上 n = −k，z = 0，F · n = −${cf.c}，B 的面积是 π·${cf.h}，所以穿过 B 的通量为 ${piTerm(-(cf.c * cf.h))}。于是穿过 U 的通量为 ${piTerm((cf.a + cf.b + 1) * (cf.h * cf.h / 2))} − (${piTerm(-(cf.c * cf.h))}) = ${piTerm(cfK)}，k = ${exact(cfK)}。`
      ),
      audit: { kind: 'MIT-MV-68:cap-flux', params: { a: cf.a, b: cf.b, c: cf.c, h: cf.h } },
    }),
    g.symbols({
      id: 'curl-setup',
      title: t('Compute the curl', '计算旋度'),
      prompt: t(
        `F = (${coef(cu.a, 'z')}², ${coef(cu.b, 'y')}², ${coef(cu.c, 'x')}z). Then curl F = ∇ × F = ( [ ] ) i + ( [ ] ) j + ( [ ] ) k.`,
        `F = (${coef(cu.a, 'z')}², ${coef(cu.b, 'y')}², ${coef(cu.c, 'x')}z)。则 curl F = ∇ × F = ( [ ] ) i + ( [ ] ) j + ( [ ] ) k。`
      ),
      before: 'curl F = ∇ × F = (',
      between: [') i + (', ') j + ('],
      after: ') k',
      answers: ['0', cuJStr, '0'],
      tokens: cuTokens,
      hint: t('For F = (P, Q, R): curl F = (R_y − Q_z, P_z − R_x, Q_x − P_y).', '对 F = (P, Q, R)：curl F = (R_y − Q_z, P_z − R_x, Q_x − P_y)。'),
      explanation: t(
        `P = ${coef(cu.a, 'z')}², Q = ${coef(cu.b, 'y')}², R = ${coef(cu.c, 'x')}z. The i-component is R_y − Q_z = 0 − 0 = 0. The j-component is P_z − R_x = ${coef(2 * cu.a, 'z')} − ${coef(cu.c, 'z')} = ${cuJStr}. The k-component is Q_x − P_y = 0 − 0 = 0. So curl F = (${cuJStr}) j: it points only along the y-axis.`,
        `P = ${coef(cu.a, 'z')}²，Q = ${coef(cu.b, 'y')}²，R = ${coef(cu.c, 'x')}z。i 分量 R_y − Q_z = 0 − 0 = 0；j 分量 P_z − R_x = ${coef(2 * cu.a, 'z')} − ${coef(cu.c, 'z')} = ${cuJStr}；k 分量 Q_x − P_y = 0 − 0 = 0。所以 curl F = (${cuJStr}) j，只沿 y 轴方向。`
      ),
    }),
    g.choice({
      id: 'cylinder-reason',
      title: t('Why the circulation vanishes', '环流为什么为零'),
      prompt: t(
        `An xz-cylinder is a surface f(x, z) = 0 in which y takes every value. S is a piece of an xz-cylinder, C is its boundary curve, oriented by the right-hand rule with respect to the normal n of S, and F = (${coef(cy.a, 'z')}², ${coef(cy.b, 'y')}², ${coef(cy.c, 'x')}z). Why is ∮_C F · dr = 0?`,
        `xz 柱面是由方程 f(x, z) = 0 给出的曲面，y 可取任意值。S 是 xz 柱面的一块，C 是它的边界曲线，按右手法则相对于 S 的法向量 n 定向，F = (${coef(cy.a, 'z')}², ${coef(cy.b, 'y')}², ${coef(cy.c, 'x')}z)。为什么 ∮_C F · dr = 0？`
      ),
      options: [
        t(`curl F is a multiple of j, while n has no j-component on an xz-cylinder, so curl F · n = 0 and Stokes' theorem gives ∮_C F · dr = 0.`,
          `curl F 是 j 的倍数，而 xz 柱面上的 n 没有 j 分量，所以 curl F · n = 0，由斯托克斯定理得 ∮_C F · dr = 0。`),
        t(`curl F = 0, so F is conservative and its integral around every closed curve in space is 0, whatever surface the curve bounds.`,
          `curl F = 0，所以 F 是保守场，它沿空间中每条闭曲线的积分都为 0，不管这条曲线围成什么曲面。`),
        t(`curl F is a multiple of j, which is the direction of n on an xz-cylinder, so Stokes' theorem makes the integral ∮_C F · dr equal to 0.`,
          `curl F 是 j 的倍数，而 j 正是 xz 柱面上 n 的方向，所以由斯托克斯定理 ∮_C F · dr 等于 0。`),
        t(`The integral of any vector field around any closed curve is 0, so ∮_C F · dr = 0 and the shape of S does not matter at all.`,
          `任何向量场沿任何闭曲线的积分都为 0，所以 ∮_C F · dr = 0，S 的形状根本无关紧要。`),
        t(`F has zero divergence, so no flux crosses S, and the circulation ∮_C F · dr around its boundary is 0 as well.`,
          `F 的散度为零，所以没有通量穿过 S，它的边界上的环流 ∮_C F · dr 也为 0。`),
      ],
      correct: 0,
      hint: t('Compute curl F, then ask which direction the normal of f(x, z) = 0 can have: its gradient is (f_x, 0, f_z).', '先求 curl F，再问 f(x, z) = 0 的法向量可能指向哪里：它的梯度是 (f_x, 0, f_z)。'),
      explanation: t(
        `curl F = (${coef(cyJ, 'z')}) j, which is not 0, so F is not conservative. The normal of f(x, z) = 0 is parallel to ∇f = (f_x, 0, f_z), which has no j-component, so curl F · n = 0 at every point of S, and Stokes' theorem gives ∮_C F · dr = ∬_S curl F · n dS = 0. Parallel directions would give the largest value of curl F · n, not 0. The argument needs C to be the boundary of a piece of the cylinder: a closed curve that runs once around the cylinder bounds no such piece.`,
        `curl F = (${coef(cyJ, 'z')}) j ≠ 0，所以 F 不是保守场。f(x, z) = 0 的法向量平行于 ∇f = (f_x, 0, f_z)，它没有 j 分量，所以 S 上每一点都有 curl F · n = 0，由斯托克斯定理 ∮_C F · dr = ∬_S curl F · n dS = 0。方向相同时 curl F · n 反而最大，不会等于 0。这个论证要求 C 是柱面上某一块曲面的边界：绕柱面一整圈的闭曲线不是任何这样一块曲面的边界。`
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('A circle on a cylinder', '柱面上的圆'),
      prompt: t(
        `F = (${coef(ch.a, 'z')}², ${coef(ch.b, 'y')}², ${coef(ch.c, 'x')}z). C is the circle in the plane y = 0 given by r(t) = (cos t, 0, ${num(ch.z0)} + sin t), 0 ≤ t ≤ 2π. Find ∮_C F · dr. It equals kπ; enter k (an integer).`,
        `F = (${coef(ch.a, 'z')}², ${coef(ch.b, 'y')}², ${coef(ch.c, 'x')}z)。C 是平面 y = 0 内的圆，r(t) = (cos t, 0, ${num(ch.z0)} + sin t)，0 ≤ t ≤ 2π。求 ∮_C F · dr。它等于 kπ，求 k（整数）。`
      ),
      fields: [{ label: t('k', 'k'), answer: ch.k }],
      hint: t('Either substitute the parametrisation (on C, y = 0 and dy = 0) or use Stokes\' theorem on the flat disc bounded by C, taking its normal from the right-hand rule.', '可以直接代入参数化（在 C 上 y = 0，dy = 0），也可以对 C 所围的平面圆盘用斯托克斯定理，法向量按右手法则确定。'),
      explanation: t(
        `On C, y = 0 and dy = 0, so F · dr = ${coef(ch.a, 'z')}² dx + ${coef(ch.c, 'x')}z dz with x = cos t and z = ${num(ch.z0)} + sin t. The first part is −${coef(ch.a, '∫ z² sin t dt')} = ${piTerm(-2 * ch.a * ch.z0)} (only the cross term ${num(2 * ch.z0)}·sin t survives), the second is ${coef(ch.c, `∫ cos²t (${num(ch.z0)} + sin t) dt`)} = ${piTerm(ch.c * ch.z0)}. The total is (${num(ch.c)} − ${num(2 * ch.a)})·${par(ch.z0)}·π = ${piTerm(ch.k)}, so k = ${num(ch.k)}. Check with Stokes: curl F = ${coef(2 * ch.a - ch.c, 'z')} j; the normal given by the right-hand rule for this direction of travel is −j, so the flux through the disc is (${num(ch.c)} − ${num(2 * ch.a)})·${par(ch.z0)}·π = ${piTerm(ch.k)}. The circle lies on the xz-cylinder x² + (z − ${par(ch.z0)})² = 1 yet the integral is not 0, because C goes around the cylinder and bounds no piece of it. ${NOT_ASSESSED_EN}`,
        `在 C 上 y = 0，dy = 0，所以 F · dr = ${coef(ch.a, 'z')}² dx + ${coef(ch.c, 'x')}z dz，其中 x = cos t，z = ${num(ch.z0)} + sin t。第一部分 −${coef(ch.a, '∫ z² sin t dt')} = ${piTerm(-2 * ch.a * ch.z0)}（只有交叉项 ${num(2 * ch.z0)}·sin t 留下），第二部分 ${coef(ch.c, `∫ cos²t (${num(ch.z0)} + sin t) dt`)} = ${piTerm(ch.c * ch.z0)}。合计 (${num(ch.c)} − ${num(2 * ch.a)})·${par(ch.z0)}·π = ${piTerm(ch.k)}，所以 k = ${num(ch.k)}。用斯托克斯定理验证：curl F = ${coef(2 * ch.a - ch.c, 'z')} j；按这个行进方向的右手法则，圆盘的法向量是 −j，所以通过圆盘的通量是 (${num(ch.c)} − ${num(2 * ch.a)})·${par(ch.z0)}·π = ${piTerm(ch.k)}。这个圆在 xz 柱面 x² + (z − ${par(ch.z0)})² = 1 上，但积分不为 0，因为 C 绕柱面一圈，不是柱面上任何一块曲面的边界。${NOT_ASSESSED_ZH}`
      ),
      audit: { kind: 'MIT-MV-68:challenge', params: { a: ch.a, b: ch.b, c: ch.c, z0: ch.z0 } },
    }),
  ];
};
