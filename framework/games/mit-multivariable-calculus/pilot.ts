import { ellipse, project3d, sampleCurve, arrow3d, axes3d, fitView, type Figure, type FigureShape, type Pt } from '../figure';
import { coef, frac, linear, makeMvDeck, num, par, term, vec, type GeneratorMap, type Text } from './support';

/**
 * Coordinator-written pilots that fix the pattern for the authors: MIT-MV-02 (text only), MIT-MV-06 (3D figure), MIT-MV-17 (2D figures).
 */
const t = (en: string, zh: string) => [en, zh] as const;
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const products = (a: number[], b: number[]) => a.map((x, i) => `${par(x)}·${par(b[i])}`).join(' + ');

/** (x, y, z) with integer length: a Pythagorean quadruple, permuted and signed. */
const QUADS: [number, number, number, number][] = [[1, 2, 2, 3], [2, 3, 6, 7], [2, 6, 9, 11], [4, 4, 7, 9], [1, 4, 8, 9], [2, 10, 11, 15]];

export const pilotGenerators: GeneratorMap = {
  'MIT-MV-02': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-02');
    const integerLength = () => {
      const [x, y, z, length] = g.pick(QUADS);
      const v = [x, y, z];
      for (let i = 2; i > 0; i--) { const j = g.random(0, i); [v[i], v[j]] = [v[j], v[i]]; }
      return { v: v.map(c => (g.random(0, 1) ? c : -c)), length };
    };
    const a = [g.random(-3, 4), g.random(-3, 4), g.random(-3, 4)], b = [g.random(-3, 4), g.random(-3, 4), g.random(-3, 4)];
    const { v: u, length: lu } = integerLength(), { v: w, length: lw } = integerLength();
    const x = g.nonzero(-3, 3), y = g.nonzero(-3, 3), p = g.nonzero(-3, 3), q = g.nonzero(-3, 3), r = g.pick([1, -1]);
    const missing = -r * (x * p + y * q); // a·b = xp + yq + c r = 0 with r = ±1
    const s = [g.nonzero(-4, 4), g.nonzero(-4, 4)], v2 = [g.nonzero(-4, 4), g.nonzero(-4, 4)];
    const sign = dot(s, v2);
    const arrows: FigureShape[] = [
      { kind: 'arrow', from: [0, 0], to: [s[0], s[1]] as Pt, tone: 'accent', label: 'a' },
      { kind: 'arrow', from: [0, 0], to: [v2[0], v2[1]] as Pt, tone: 'accent2', label: 'b' },
    ];
    const [e, f] = [integerLength(), integerLength()];
    return [
      g.number({
        id: 'dot', title: t('Compute a · b', '计算 a · b'),
        prompt: t(`a = ${vec(...a)} and b = ${vec(...b)}. Compute a · b.`, `a = ${vec(...a)}，b = ${vec(...b)}。计算 a · b。`),
        fields: [{ label: t('a · b', 'a · b'), answer: dot(a, b) }],
        hint: t('Multiply matching components, then add the three products.', '把对应分量相乘，再把三个乘积相加。'),
        explanation: t(`a · b = ${products(a, b)} = ${num(dot(a, b))}. The result is a number, not a vector.`, `a · b = ${products(a, b)} = ${num(dot(a, b))}。结果是一个数，而不是向量。`),
        audit: { kind: 'MIT-MV-02:dot', params: { a, b } },
      }),
      g.number({
        id: 'length', title: t('Length from the dot product', '用点积求长度'),
        prompt: t(`For a = ${vec(...u)}, |a|² = a · a. Find the length |a|.`, `对 a = ${vec(...u)}，|a|² = a · a。求长度 |a|。`),
        fields: [{ label: t('|a|', '|a|'), answer: lu }],
        hint: t('Square each component and add them; the length is a whole number here.', '各分量平方后相加；本题长度是整数。'),
        explanation: t(`|a|² = ${u.map(c => `${par(c)}²`).join(' + ')} = ${lu * lu}, so |a| = ${lu}.`, `|a|² = ${u.map(c => `${par(c)}²`).join(' + ')} = ${lu * lu}，所以 |a| = ${lu}。`),
        audit: { kind: 'MIT-MV-02:length', params: { a: u } },
      }),
      g.number({
        id: 'perpendicular', title: t('Make two vectors perpendicular', '让两个向量垂直'),
        prompt: t(`Find c so that a = (${num(x)}, ${num(y)}, c) is perpendicular to b = ${vec(p, q, r)}.`, `求 c，使 a = (${num(x)}, ${num(y)}, c) 与 b = ${vec(p, q, r)} 垂直。`),
        fields: [{ label: t('c', 'c'), answer: missing }],
        hint: t('Perpendicular means a · b = 0. Write a · b with c in it and solve.', '垂直意味着 a · b = 0。写出含 c 的 a · b 再解方程。'),
        explanation: t(`a · b = ${par(x)}·${par(p)} + ${par(y)}·${par(q)} + c·${par(r)} = ${num(x * p + y * q)} + ${coef(r, 'c')} = 0, so c = ${num(missing)}.`, `a · b = ${par(x)}·${par(p)} + ${par(y)}·${par(q)} + c·${par(r)} = ${num(x * p + y * q)} + ${coef(r, 'c')} = 0，所以 c = ${num(missing)}。`),
        audit: { kind: 'MIT-MV-02:perpendicular', params: { x, y, p, q, r } },
      }),
      g.number({
        id: 'angle', title: t('The angle between two vectors', '两向量的夹角'),
        prompt: t(`For a = ${vec(...u)} and b = ${vec(...w)}, use cos θ = (a · b) / (|a| |b|). You may use |a| = ${lu} and |b| = ${lw}. Enter cos θ as a fraction or decimal.`, `对 a = ${vec(...u)}、b = ${vec(...w)}，用 cos θ = (a · b) / (|a| |b|)。可直接使用 |a| = ${lu}、|b| = ${lw}。以分数或小数输入 cos θ。`),
        fields: [{ label: t('cos θ', 'cos θ'), answer: dot(u, w) / (lu * lw) }],
        hint: t('Compute a · b first, then divide by the product of the two lengths.', '先算 a · b，再除以两个长度的乘积。'),
        explanation: t(`a · b = ${products(u, w)} = ${num(dot(u, w))}, so cos θ = ${num(dot(u, w))}/(${lu}·${lw}) = ${frac(dot(u, w), lu * lw)}.`, `a · b = ${products(u, w)} = ${num(dot(u, w))}，所以 cos θ = ${num(dot(u, w))}/(${lu}·${lw}) = ${frac(dot(u, w), lu * lw)}。`),
        audit: { kind: 'MIT-MV-02:angle', params: { a: u, b: w, la: lu, lb: lw } },
      }),
      g.choice({
        id: 'sign', title: t('Read the sign from a picture', '从图中读出符号'),
        prompt: t(`The vectors a = ${vec(...s)} and b = ${vec(...v2)} are drawn from the origin. What is the sign of a · b?`, `从原点画出向量 a = ${vec(...s)} 与 b = ${vec(...v2)}。a · b 的符号是什么？`),
        figure: g.figure({ alt: t(`Vectors a = ${vec(...s)} and b = ${vec(...v2)} drawn from the origin.`, `从原点画出的向量 a = ${vec(...s)} 与 b = ${vec(...v2)}。`), view: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 }, axes: { grid: true }, shapes: arrows }),
        options: [t('Positive: the angle is acute', '为正：夹角是锐角'), t('Zero: the vectors are perpendicular', '为零：两向量垂直'), t('Negative: the angle is obtuse', '为负：夹角是钝角')],
        correct: sign > 0 ? 0 : sign === 0 ? 1 : 2,
        hint: t('a · b = |a||b| cos θ, so the sign is the sign of cos θ.', 'a · b = |a||b| cos θ，所以符号就是 cos θ 的符号。'),
        explanation: t(`a · b = ${par(s[0])}·${par(v2[0])} + ${par(s[1])}·${par(v2[1])} = ${num(sign)}. ${sign > 0 ? 'Positive: acute angle.' : sign === 0 ? 'Zero: right angle.' : 'Negative: obtuse angle.'}`, `a · b = ${par(s[0])}·${par(v2[0])} + ${par(s[1])}·${par(v2[1])} = ${num(sign)}。${sign > 0 ? '为正：锐角。' : sign === 0 ? '为零：直角。' : '为负：钝角。'}`),
        audit: { kind: 'MIT-MV-02:sign', params: { a: s, b: v2 } },
      }),
      g.choice({
        id: 'zero-product', title: t('What does a · b = 0 say?', 'a · b = 0 说明什么？'),
        prompt: t('Suppose a · b = 0. Which conclusion is justified?', '设 a · b = 0。哪个结论成立？'),
        options: [t('a ⟂ b, or at least one of them is the zero vector.', 'a ⟂ b，或二者之一是零向量。'), t('a = 0 and b = 0.', 'a = 0 且 b = 0。'), t('a and b are parallel.', 'a 与 b 平行。')],
        correct: 0,
        hint: t('Use a · b = |a||b| cos θ and ask when a product of numbers can be zero.', '用 a · b = |a||b| cos θ，想想乘积何时为零。'),
        explanation: t('The product |a||b| cos θ is zero if a length is zero or cos θ = 0. Unlike numbers, a nonzero product of vectors need not appear: (1, 0, 0) · (0, 1, 0) = 0 although neither vector is zero.', '乘积 |a||b| cos θ 为零，要么某个长度为零，要么 cos θ = 0。与数的乘法不同：(1, 0, 0) · (0, 1, 0) = 0，但两个向量都不是零向量。'),
      }),
      g.symbols({
        id: 'law-of-cosines', title: t('Expand |a − b|²', '展开 |a − b|²'),
        prompt: t('Complete the identity using the dot product: |a − b|² = (a − b) · (a − b).', '用点积补全恒等式：|a − b|² = (a − b) · (a − b)。'),
        before: '|a − b|² = |a|² + |b|²', between: [' '], answers: ['−', '2 a·b'], tokens: ['+', '−', '2 a·b', 'a·b', '2|a||b|'],
        hint: t('Expand (a − b) · (a − b); the cross terms are −a·b twice.', '展开 (a − b) · (a − b)；交叉项是两个 −a·b。'),
        explanation: t('(a − b) · (a − b) = a·a − 2 a·b + b·b = |a|² + |b|² − 2 a·b. This is the law of cosines once a·b = |a||b| cos θ.', '(a − b) · (a − b) = a·a − 2 a·b + b·b = |a|² + |b|² − 2 a·b。当 a·b = |a||b| cos θ 时，它就是余弦定理。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Find cos θ for a = ${vec(...e.v)} and b = ${vec(...f.v)}. Enter a fraction or decimal.`, `求 a = ${vec(...e.v)} 与 b = ${vec(...f.v)} 夹角的 cos θ。以分数或小数输入。`),
        fields: [{ label: t('cos θ', 'cos θ'), answer: dot(e.v, f.v) / (e.length * f.length) }],
        hint: t('You need a · b, |a| and |b|. Both lengths are whole numbers.', '需要 a · b、|a| 与 |b|；两个长度都是整数。'),
        explanation: t(`|a| = ${e.length}, |b| = ${f.length}, a · b = ${num(dot(e.v, f.v))}. So cos θ = ${frac(dot(e.v, f.v), e.length * f.length)}. This game checks computation with the dot product; it does not test whether you can explain why cos θ gives the angle.`, `|a| = ${e.length}，|b| = ${f.length}，a · b = ${num(dot(e.v, f.v))}。所以 cos θ = ${frac(dot(e.v, f.v), e.length * f.length)}。本游戏只检查点积计算，不检查你能否解释为什么 cos θ 给出夹角。`),
        audit: { kind: 'MIT-MV-02:challenge', params: { a: e.v, b: f.v } },
      }),
    ];
  },

  'MIT-MV-06': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-06');
    const point = () => [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
    const eq = (a: number, b: number, c: number, d: number) => `${linear([a, b, c], ['x', 'y', 'z'])} = ${num(d)}`;
    const triangle = () => {
      for (;;) {
        const P = point(), Q = point(), R = point();
        const N = cross(sub(Q, P), sub(R, P));
        if (N.some(c => c !== 0)) return { P, Q, R, N };
      }
    };
    const p = g.nonzero(-3, 3), q = g.nonzero(-3, 3), r = g.nonzero(-3, 3), d0 = g.random(-4, 6);
    const [a1, b1, c1] = [g.nonzero(-3, 3), g.nonzero(-3, 3), g.nonzero(-3, 3)];
    const P0 = point(), dN = a1 * P0[0] + b1 * P0[1] + c1 * P0[2];
    const cz = g.pick([1, -1, 2, -2]), ax = g.nonzero(-3, 3), by = g.nonzero(-3, 3), x1 = g.random(-2, 3), y1 = g.random(-2, 3), z1 = g.random(-3, 3);
    const dz = ax * x1 + by * y1 + cz * z1;
    const T = triangle(), T2 = triangle();
    const dT = dot(T.N, T.P), dT2 = dot(T2.N, T2.P);
    const kind = g.random(0, 2), k = g.pick([2, -2, 3]), e = g.nonzero(-3, 3);
    const [a, b, c] = [g.nonzero(-2, 2), g.nonzero(-2, 2), g.nonzero(-2, 2)], d = g.random(-3, 4);
    const second = kind === 2 ? [k * a, k * b, k * c + (k > 0 ? 1 : -1)] : [k * a, k * b, k * c];
    const d2 = kind === 0 ? k * d : k * d + e;
    const patch = (u: number, v: number): [number, number, number] => [u, v, 1 + 0.3 * u + 0.2 * v];
    const corners = [patch(0, 0), patch(1.6, 0), patch(1.6, 1.6), patch(0, 1.6)];
    const planeShapes: FigureShape[] = [{ kind: 'area', points: corners.map(project3d), tone: 'accent' }, ...axes3d(2), arrow3d(patch(0.8, 0.8), [0.8 - 0.3, 0.8 - 0.2, 1 + 0.3 * 0.8 + 0.2 * 0.8 + 1], 'accent2', 'n')];
    const planeFigure: Figure = g.figure({ alt: t('A tilted plane patch with an arrow n standing perpendicular to it.', '一块倾斜的平面，以及与它垂直的箭头 n。'), view: fitView(planeShapes, 0.15), shapes: planeShapes });
    return [
      g.choice({
        id: 'normal', title: t('The normal vector', '法向量'),
        prompt: t(`The plane is ${eq(p, q, r, d0)}. The arrow n in the picture stands perpendicular to a plane. Which vector is perpendicular to this plane?`, `平面为 ${eq(p, q, r, d0)}。图中的箭头 n 垂直于平面。哪个向量垂直于这个平面？`),
        figure: planeFigure,
        options: [t(vec(p, q, r), vec(p, q, r)), t(vec(p, q, -r), vec(p, q, -r)), t(vec(p, -q, r), vec(p, -q, r))], correct: 0,
        hint: t('Read the coefficients of x, y and z in order.', '按顺序读出 x、y、z 的系数。'),
        explanation: t(`For ax + by + cz = d the normal is (a, b, c). Here that is ${vec(p, q, r)}; changing a sign gives a different direction, not the same plane's normal.`, `对 ax + by + cz = d，法向量是 (a, b, c)。这里是 ${vec(p, q, r)}；改变某个符号会得到不同方向，而不是这个平面的法向量。`),
      }),
      g.number({
        id: 'from-normal', title: t('Plane from a point and a normal', '由点和法向量求平面'),
        prompt: t(`A plane passes through P₀ = ${vec(...P0)} with normal N = ${vec(a1, b1, c1)}. Its equation is ${linear([a1, b1, c1], ['x', 'y', 'z'])} = d. Find d.`, `平面过点 P₀ = ${vec(...P0)}，法向量为 N = ${vec(a1, b1, c1)}。其方程为 ${linear([a1, b1, c1], ['x', 'y', 'z'])} = d。求 d。`),
        fields: [{ label: t('d', 'd') , answer: dN }],
        hint: t('P₀ must satisfy the equation: substitute its coordinates.', 'P₀ 必须满足方程：代入它的坐标。'),
        explanation: t(`d = N · P₀ = ${products([a1, b1, c1], P0)} = ${num(dN)}.`, `d = N · P₀ = ${products([a1, b1, c1], P0)} = ${num(dN)}。`),
        audit: { kind: 'MIT-MV-06:from-normal', params: { n: [a1, b1, c1], p0: P0 } },
      }),
      g.number({
        id: 'point-on-plane', title: t('A point on the plane', '平面上的点'),
        prompt: t(`A point on the plane ${eq(ax, by, cz, dz)} has x = ${num(x1)} and y = ${num(y1)}. Find its z-coordinate.`, `平面 ${eq(ax, by, cz, dz)} 上一点的 x = ${num(x1)}、y = ${num(y1)}。求它的 z 坐标。`),
        fields: [{ label: t('z', 'z'), answer: z1 }],
        hint: t('Substitute x and y, then solve the remaining equation for z.', '代入 x 和 y，再对 z 解剩下的方程。'),
        explanation: t(`${par(ax)}·${par(x1)} + ${par(by)}·${par(y1)} + ${par(cz)}·z = ${num(dz)}, so ${coef(cz, 'z')} = ${num(dz - ax * x1 - by * y1)} and z = ${num(z1)}.`, `${par(ax)}·${par(x1)} + ${par(by)}·${par(y1)} + ${par(cz)}·z = ${num(dz)}，所以 ${coef(cz, 'z')} = ${num(dz - ax * x1 - by * y1)}，z = ${num(z1)}。`),
        audit: { kind: 'MIT-MV-06:point-on-plane', params: { a: ax, b: by, c: cz, d: dz, x: x1, y: y1 } },
      }),
      g.number({
        id: 'three-point-normal', title: t('Normal from three points', '由三点求法向量'),
        prompt: t(`A plane contains P = ${vec(...T.P)}, Q = ${vec(...T.Q)} and R = ${vec(...T.R)}. Find N = PQ × PR, in this order.`, `平面含点 P = ${vec(...T.P)}、Q = ${vec(...T.Q)}、R = ${vec(...T.R)}。按此顺序求 N = PQ × PR。`),
        fields: [{ label: t('N₁', 'N₁'), answer: T.N[0] }, { label: t('N₂', 'N₂'), answer: T.N[1] }, { label: t('N₃', 'N₃'), answer: T.N[2] }],
        hint: t('First find PQ = Q − P and PR = R − P, then take their cross product.', '先求 PQ = Q − P 与 PR = R − P，再取叉积。'),
        explanation: t(`PQ = ${vec(...sub(T.Q, T.P))}, PR = ${vec(...sub(T.R, T.P))}, so N = PQ × PR = ${vec(...T.N)}.`, `PQ = ${vec(...sub(T.Q, T.P))}，PR = ${vec(...sub(T.R, T.P))}，所以 N = PQ × PR = ${vec(...T.N)}。`),
        audit: { kind: 'MIT-MV-06:three-point-normal', params: { p: T.P, q: T.Q, r: T.R } },
      }),
      g.number({
        id: 'three-point-d', title: t('Finish the equation', '写完平面方程'),
        prompt: t(`The plane through P = ${vec(...T.P)} has normal N = ${vec(...T.N)}. Its equation is ${linear(T.N, ['x', 'y', 'z'])} = d. Find d.`, `过 P = ${vec(...T.P)} 的平面法向量为 N = ${vec(...T.N)}。其方程为 ${linear(T.N, ['x', 'y', 'z'])} = d。求 d。`),
        fields: [{ label: t('d', 'd'), answer: dT }],
        hint: t('Use any one of the three points; each must satisfy the equation.', '三个点中任取一个，它必须满足方程。'),
        explanation: t(`d = N · P = ${products(T.N, T.P)} = ${num(dT)}. Check with Q or R: the same value appears.`, `d = N · P = ${products(T.N, T.P)} = ${num(dT)}。用 Q 或 R 检查，会得到同一个值。`),
        audit: { kind: 'MIT-MV-06:three-point-d', params: { n: T.N, p: T.P } },
      }),
      g.choice({
        id: 'coplanar', title: t('When is a point on the plane?', '点何时在平面上？'),
        prompt: t('A plane has normal N and contains the point P. Which condition says exactly that the point Q lies on the plane?', '平面的法向量为 N，且过点 P。哪个条件恰好说明点 Q 在平面上？'),
        options: [t('N · PQ = 0', 'N · PQ = 0'), t('N × PQ = 0', 'N × PQ = 0'), t('N · Q = 0', 'N · Q = 0')], correct: 0,
        hint: t('Q is in the plane exactly when PQ lies in the plane, i.e. is perpendicular to N.', 'Q 在平面上，当且仅当 PQ 在平面内，即与 N 垂直。'),
        explanation: t('PQ lies in the plane exactly when it is perpendicular to N. N × PQ = 0 would mean PQ is parallel to N (pointing out of the plane). N · Q = 0 only describes a plane through the origin.', 'PQ 在平面内当且仅当它与 N 垂直。N × PQ = 0 意味着 PQ 平行于 N（指向平面之外）。N · Q = 0 只描述过原点的平面。'),
      }),
      g.choice({
        id: 'two-planes', title: t('Two planes', '两个平面'),
        prompt: t(`How do the planes ${eq(a, b, c, d)} and ${eq(second[0], second[1], second[2], d2)} meet?`, `平面 ${eq(a, b, c, d)} 与 ${eq(second[0], second[1], second[2], d2)} 的位置关系是什么？`),
        options: [t('They are the same plane.', '它们是同一个平面。'), t('They are parallel and have no common point.', '它们平行且没有公共点。'), t('They meet in a line.', '它们交于一条直线。')], correct: kind,
        hint: t('Compare the two normals first. Then compare the right-hand sides.', '先比较两个法向量，再比较右端常数。'),
        explanation: t(kind === 2 ? 'The normals are not proportional, so the planes are not parallel and meet in a line.' : kind === 0 ? `The second equation is ${num(k)} times the first (all four numbers), so it describes the same plane.` : `The normals are proportional (factor ${num(k)}) but the right side is not ${num(k)}·${par(d)} = ${num(k * d)}, so the planes are parallel and distinct.`, kind === 2 ? '两个法向量不成比例，所以平面不平行，交于一条直线。' : kind === 0 ? `第二个方程是第一个的 ${num(k)} 倍（四个数都成比例），所以是同一个平面。` : `法向量成比例（比例 ${num(k)}），但右端常数不是 ${num(k)}·${par(d)} = ${num(k * d)}，所以两平面平行且不重合。`),
        audit: { kind: 'MIT-MV-06:two-planes', params: { a, b, c, d, a2: second[0], b2: second[1], c2: second[2], d2 } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Find the plane through P = ${vec(...T2.P)}, Q = ${vec(...T2.Q)}, R = ${vec(...T2.R)} in the form ax + by + cz = d, using (a, b, c) = PQ × PR exactly (no scaling).`, `求过 P = ${vec(...T2.P)}、Q = ${vec(...T2.Q)}、R = ${vec(...T2.R)} 的平面 ax + by + cz = d，其中 (a, b, c) = PQ × PR（不作缩放）。`),
        fields: [{ label: t('a', 'a'), answer: T2.N[0] }, { label: t('b', 'b'), answer: T2.N[1] }, { label: t('c', 'c'), answer: T2.N[2] }, { label: t('d', 'd'), answer: dT2 }],
        hint: t('Cross product of two edge vectors, then N · P.', '先取两条边向量的叉积，再算 N · P。'),
        explanation: t(`N = PQ × PR = ${vec(...T2.N)} and d = N · P = ${num(dT2)}. This game checks the computation; it does not test whether you can picture the plane.`, `N = PQ × PR = ${vec(...T2.N)}，d = N · P = ${num(dT2)}。本游戏检查计算，不检查你能否想象出这个平面。`),
        audit: { kind: 'MIT-MV-06:challenge', params: { p: T2.P, q: T2.Q, r: T2.R } },
      }),
    ];
  },

  'MIT-MV-17': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-17');
    const view = { xmin: -3.2, xmax: 3.2, ymin: -3.2, ymax: 3.2 };
    const levels = [1, 2, 3];
    const pictures: { name: string; alt: Text; shapes: FigureShape[] }[] = [
      { name: 'x² + y²', alt: t('Concentric circles', '同心圆'), shapes: levels.map(c => ({ kind: 'line', points: ellipse(0, 0, Math.sqrt(c)), tone: 'accent' })) },
      { name: 'x² − y²', alt: t('Hyperbolas opening left and right', '左右开口的双曲线'), shapes: levels.flatMap(c => [1, -1].map(side => ({ kind: 'line' as const, points: sampleCurve(y => [side * Math.sqrt(c + y * y), y] as Pt, -2.2, 2.2, 40), tone: 'accent' as const }))) },
      { name: 'x + 2y', alt: t('Parallel straight lines', '一组平行直线'), shapes: levels.map(c => ({ kind: 'line', points: [[c - 2 * 3, 3], [c + 2 * 3, -3]] as Pt[], tone: 'accent' })) },
      { name: 'x² + 4y²', alt: t('Concentric ellipses, wider than tall', '同心椭圆，宽大于高'), shapes: levels.map(c => ({ kind: 'line', points: ellipse(0, 0, Math.sqrt(c), Math.sqrt(c) / 2), tone: 'accent' })) },
    ];
    const target = g.random(0, 3);
    const labels = ['A', 'B', 'C', 'D'];
    const [fa, fb, fc] = [g.random(2, 4), g.random(2, 5), g.nonzero(-3, 3)];
    const [ex, ey] = [g.random(-3, 3), g.random(-3, 3)];
    const k = g.random(2, 4), [lx, ly] = [g.nonzero(-3, 3), g.nonzero(-3, 3)];
    const a = g.random(2, 4), y0 = g.random(1, 3);
    const kd = g.random(1, 4);
    const [ox, oy] = [g.nonzero(-3, 3), g.nonzero(-3, 3)];
    const [cx, cy] = [g.pick([-4, -3, -2, -1, 1, 2, 3, 4]), g.pick([-4, -3, -2, -1, 1, 2, 3, 4])];
    const cProduct = cx * cy;
    let cx1 = cy;
    for (let tries = 0; tries < 60; tries++) {
      const candidate = g.pick([-12, -6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 12]);
      if (cProduct % candidate === 0 && candidate !== cx) { cx1 = candidate; break; }
    }
    const contour = (): Figure => g.figure({ alt: t('Concentric circles for f = 1, 2, 3, 4 drawn closer together moving away from the origin.', '同心圆，对应 f = 1, 2, 3, 4，离原点越远越密。'), view, axes: { grid: true }, shapes: [1, 2, 3, 4].map(c => ({ kind: 'line' as const, points: ellipse(0, 0, Math.sqrt(c)), tone: 'accent' as const, label: String(c), labelAt: [Math.sqrt(c) * 0.71, Math.sqrt(c) * 0.71] as Pt })) });
    return [
      g.choice({
        id: 'level-pictures', title: t('Which picture shows these level curves?', '哪幅图是这些等高线？'),
        prompt: t(`The level curves f = 1, 2, 3 are drawn for four different functions. Which picture belongs to f(x, y) = ${pictures[target].name}?`, `四幅图分别画出四个不同函数的等高线 f = 1, 2, 3。哪一幅属于 f(x, y) = ${pictures[target].name}？`),
        fixedOrder: true,
        options: labels.map(l => t(`Picture ${l}`, `图 ${l}`)), correct: target,
        optionFigures: pictures.map((p, i) => g.figure({ alt: t(`Picture ${labels[i]}: ${typeof p.alt === 'string' ? p.alt : p.alt[0]}`, `图 ${labels[i]}：${typeof p.alt === 'string' ? p.alt : p.alt[1]}`), view, shapes: p.shapes })),
        hint: t('Set f = 1 and ask what curve you get: a circle, an ellipse, a hyperbola or a line?', '令 f = 1，看得到的是圆、椭圆、双曲线还是直线。'),
        explanation: t(`f = c for f = ${pictures[target].name} gives ${typeof pictures[target].alt === 'string' ? pictures[target].alt : (pictures[target].alt as readonly [string, string])[0].toLowerCase()}. That is Picture ${labels[target]}.`, `f = ${pictures[target].name} 令 f = c 得到${typeof pictures[target].alt === 'string' ? pictures[target].alt : (pictures[target].alt as readonly [string, string])[1]}，即图 ${labels[target]}。`),
      }),
      g.number({
        id: 'evaluate', title: t('Evaluate f', '计算函数值'),
        prompt: t(`f(x, y) = ${linear([fa, -fb], ['x²', 'y'])} ${term(fc)}. Find f(${num(ex)}, ${num(ey)}).`, `f(x, y) = ${linear([fa, -fb], ['x²', 'y'])} ${term(fc)}。求 f(${num(ex)}, ${num(ey)})。`),
        fields: [{ label: t('f value', '函数值'), answer: fa * ex * ex - fb * ey + fc }],
        hint: t('Square x first, then multiply, then combine.', '先对 x 平方，再相乘，最后合并。'),
        explanation: t(`f = ${fa}·${par(ex)}² − ${fb}·${par(ey)} ${term(fc)} = ${num(fa * ex * ex)} − ${par(fb * ey)} ${term(fc)} = ${num(fa * ex * ex - fb * ey + fc)}.`, `f = ${fa}·${par(ex)}² − ${fb}·${par(ey)} ${term(fc)} = ${num(fa * ex * ex)} − ${par(fb * ey)} ${term(fc)} = ${num(fa * ex * ex - fb * ey + fc)}。`),
        audit: { kind: 'MIT-MV-17:evaluate', params: { a: fa, b: fb, c: fc, x: ex, y: ey } },
      }),
      g.number({
        id: 'level-through', title: t('The level curve through a point', '过一点的等高线'),
        prompt: t(`f(x, y) = x² + ${k}y². The level curve through P = ${vec(lx, ly)} is f = c. Find c.`, `f(x, y) = x² + ${k}y²。过 P = ${vec(lx, ly)} 的等高线是 f = c。求 c。`),
        fields: [{ label: t('c', 'c'), answer: lx * lx + k * ly * ly }],
        hint: t('A point lies on the level curve f = c exactly when f(P) = c.', '点在等高线 f = c 上，当且仅当 f(P) = c。'),
        explanation: t(`c = f(P) = ${par(lx)}² + ${k}·${par(ly)}² = ${lx * lx} + ${k * ly * ly} = ${lx * lx + k * ly * ly}.`, `c = f(P) = ${par(lx)}² + ${k}·${par(ly)}² = ${lx * lx} + ${k * ly * ly} = ${lx * lx + k * ly * ly}。`),
        audit: { kind: 'MIT-MV-17:level-through', params: { k, x: lx, y: ly } },
      }),
      g.number({
        id: 'slice', title: t('A slice of the graph', '图像的一个切片'),
        prompt: t(`f(x, y) = x² + ${a}y². Along the line y = ${y0}, what is the smallest value of f?`, `f(x, y) = x² + ${a}y²。沿直线 y = ${y0}，f 的最小值是多少？`),
        fields: [{ label: t('minimum of f', 'f 的最小值'), answer: a * y0 * y0 }],
        hint: t('On y = constant, f is x² plus a constant.', '在 y 为常数时，f 就是 x² 加一个常数。'),
        explanation: t(`On y = ${y0}: f = x² + ${a}·${y0}² = x² + ${a * y0 * y0}. The smallest value is at x = 0: ${a * y0 * y0}.`, `在 y = ${y0} 上：f = x² + ${a}·${y0}² = x² + ${a * y0 * y0}。最小值在 x = 0 处：${a * y0 * y0}。`),
        audit: { kind: 'MIT-MV-17:slice', params: { a, y: y0 } },
      }),
      g.choice({
        id: 'spacing', title: t('Read the spacing', '读出等高线的疏密'),
        prompt: t('The picture shows the level curves f = 1, 2, 3, 4 of f(x, y) = x² + y². Where does f change fastest per unit of distance?', '图中画出 f(x, y) = x² + y² 的等高线 f = 1, 2, 3, 4。每单位距离上，f 在哪里变化最快？'),
        figure: contour(),
        options: [t('Farther from the origin, where the curves are closer together.', '离原点较远处，等高线更密。'), t('Near the origin, where the curves are closer together.', '靠近原点处，等高线更密。'), t('The same everywhere.', '处处一样。')], correct: 0,
        hint: t('Equal steps in f between neighbouring curves; look at how far apart the curves are.', '相邻曲线之间 f 的变化相同；看曲线间隔的大小。'),
        explanation: t('Neighbouring curves differ by 1 in f. Where they are close, a small distance already gives a change of 1, so f changes fast. The curves get closer as the distance from the origin grows.', '相邻曲线的 f 相差 1。曲线靠得近的地方，很小的距离就改变 1，所以 f 变化快。离原点越远，曲线越密。'),
      }),
      g.choice({
        id: 'domain', title: t('The domain', '定义域'),
        prompt: t(`Where is f(x, y) = ln(x + y − ${kd}) defined?`, `f(x, y) = ln(x + y − ${kd}) 在哪里有定义？`),
        options: [t(`x + y > ${kd}`, `x + y > ${kd}`), t(`x + y < ${kd}`, `x + y < ${kd}`), t(`x > ${kd} and y > ${kd}`, `x > ${kd} 且 y > ${kd}`)], correct: 0,
        hint: t('The logarithm needs a positive argument.', '对数要求真数为正。'),
        explanation: t(`ln needs x + y − ${kd} > 0, i.e. x + y > ${kd}: the half-plane above the line x + y = ${kd}. It is not the quadrant x > ${kd}, y > ${kd}: for example (${kd + 3}, ${-2}) has x + y = ${kd + 1} > ${kd} but y < ${kd}.`, `ln 要求 x + y − ${kd} > 0，即 x + y > ${kd}：直线 x + y = ${kd} 上方的半平面。它不是象限 x > ${kd}、y > ${kd}：例如 (${kd + 3}, ${-2}) 满足 x + y = ${kd + 1} > ${kd}，但 y < ${kd}。`),
      }),
      g.symbols({
        id: 'level-equation', title: t('Write the level curve', '写出等高线方程'),
        prompt: t(`Build the equation of the level curve of f through the point P = ${vec(ox, oy)}.`, `写出 f 过点 P = ${vec(ox, oy)} 的等高线方程。`),
        before: '', between: [' ', ' '], answers: ['f(x, y)', '=', 'f(x₀, y₀)'], tokens: ['f(x, y)', '=', 'f(x₀, y₀)', 'f(x, y) = 0', 'x₀', 'y₀'],
        hint: t('The level curve is where f takes the same value it has at P.', '等高线是 f 取与 P 点相同值的地方。'),
        explanation: t(`A level curve is f(x, y) = c, and the one through P has c = f(x₀, y₀) with (x₀, y₀) = ${vec(ox, oy)}.`, `等高线形如 f(x, y) = c；过 P 的那条满足 c = f(x₀, y₀)，其中 (x₀, y₀) = ${vec(ox, oy)}。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`f(x, y) = x·y. The level curve through P = ${vec(cx, cy)} contains a point with x = ${num(cx1)}. Find its y-coordinate.`, `f(x, y) = x·y。过 P = ${vec(cx, cy)} 的等高线上有一点的 x = ${num(cx1)}。求它的 y 坐标。`),
        fields: [{ label: t('y', 'y'), answer: cProduct / cx1 }],
        hint: t('First find the level c = f(P), then solve x·y = c for y.', '先求等高线的值 c = f(P)，再对 y 解 x·y = c。'),
        explanation: t(`c = ${par(cx)}·${par(cy)} = ${num(cProduct)}. With x = ${num(cx1)}: y = ${num(cProduct)}/${par(cx1)} = ${num(cProduct / cx1)}. These level curves are hyperbolas; this game does not test sketching them.`, `c = ${par(cx)}·${par(cy)} = ${num(cProduct)}。当 x = ${num(cx1)} 时：y = ${num(cProduct)}/${par(cx1)} = ${num(cProduct / cx1)}。这些等高线是双曲线；本游戏不检查你能否画出它们。`),
        audit: { kind: 'MIT-MV-17:challenge', params: { x0: cx, y0: cy, x1: cx1 } },
      }),
    ];
  },
};
