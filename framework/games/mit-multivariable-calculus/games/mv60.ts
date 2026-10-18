import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, ellipse, fitView, line3d, project3d, rect, wire3d, type FigureShape, type Pt, type Pt3 } from '../../figure';
import { coef, frac, gcd, linear, makeMvDeck, num, par, term, vec, type Text } from '../support';

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

export const mv60: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-60');
  warm(g);

  // --- stokes-setup ---
  const setup = retry(() => ({
    a: g.pick([1, 2, 3, 4, 5, 6]),
    b: g.pick([1, 2, 3, 4, 5, 6]),
    c: g.pick([1, 2, 3, 4, 5, 6]),
  }), v => {
    const vals = [v.a, v.b, v.c, 2 * v.b];
    return new Set(vals).size === vals.length;
  });

  // --- graph-value ---
  const gv = retry(() => ({
    a: g.pick([1, 2, 3]),
    c: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3, 4, 5, 6]),
    R: g.pick([1, 2, 3, 4, 5, 6]),
  }), v => v.a !== v.b && v.c !== v.b);
  const gvAnswer = gv.b * gv.R * gv.R;

  // --- orientation ---
  const orient = {
    upward: g.random(0, 1) > 0.5,
    region: g.pick(['disk', 'square', 'ellipse'] as const),
  };

  // --- hemisphere-value ---
  const hemi = { rho: g.pick([1, 2, 3, 4, 5, 6]) };
  const hemiAnswer = -hemi.rho * hemi.rho;

  // --- cylinder-flux ---
  const cyl = retry(() => ({
    R: g.pick([1, 2, 3, 4, 5]),
    h: g.pick([1, 2, 3, 4, 5]),
  }), v => {
    const d1 = 4 * v.R * v.h;
    const d2 = 2 * v.R * v.h;
    const d3 = 2 * v.R * v.R;
    return d1 !== d2 && d1 !== d3 && d2 !== d3;
  });

  // --- flat-circle ---
  const fc = { R: g.pick([1, 2, 3, 4, 5, 6]) };
  const fcAnswer = 2 * fc.R * fc.R;

  // --- conservative-stokes ---
  const cons = {
    surface: g.pick(['hemisphere', 'cylinder', 'graph', 'disk', 'cap', 'band'] as const),
  };

  // --- challenge ---
  const ch = retry(() => ({
    s: g.pick([1, 2, 3]),
    R: g.pick([1, 2, 3]),
    h: g.pick([1, 2]),
  }), v => v.s !== v.R);
  const chAnswer = ch.s * ch.R * ch.R;

  // --- Figure helpers ---
  // Top view of the region and its boundary curve, no direction on C (that is the answer), only the side of S.
  const orientShapes: FigureShape[] = (() => {
    const outline: Pt[] = orient.region === 'disk' ? ellipse(0, 0, 3, 3) : orient.region === 'square' ? rect(-3, -3, 3, 3) : ellipse(0, 0, 4, 2.5);
    return [
      { kind: 'area', points: outline, tone: 'accent', opacity: 0.2 },
      { kind: 'line', points: [...outline, outline[0]], tone: 'accent', width: 2 },
      { kind: 'text', at: [0, 0], text: g.t(orient.upward ? t('n points up', 'n 向上') : t('n points down', 'n 向下')), tone: 'text', anchor: 'middle' },
    ];
  })();

  // --- 3D figure shapes (oblique projection project3d(x, y, z) = (y − 0.45x, z − 0.3x)) ---
  // Projection of S onto the xy-plane: the disk of radius R, its boundary circle, and k (the surface itself is not drawn).
  const gvCircle: Pt3[] = Array.from({ length: 49 }, (_, i) => { const th = 2 * Math.PI * i / 48; return [gv.R * Math.cos(th), gv.R * Math.sin(th), 0] as Pt3; });
  const graphShapes: FigureShape[] = [
    { kind: 'area', points: gvCircle.map(project3d), tone: 'accent', opacity: 0.2 },
    ...axes3d(gv.R + 1),
    line3d(gvCircle, 'accent', { width: 2 }),
    arrow3d([0, 0, 0], [0, 0, gv.R * 0.8 + 0.6], 'accent2', 'k'),
  ];

  const hemiShapes: FigureShape[] = [
    ...axes3d(hemi.rho + 1),
    ...wire3d((ph, th) => [hemi.rho * Math.sin(ph) * Math.cos(th), hemi.rho * Math.sin(ph) * Math.sin(th), hemi.rho * Math.cos(ph)], 0, Math.PI, 0, Math.PI, 3, 10, 24),
    line3d(Array.from({ length: 49 }, (_, i) => { const th = 2 * Math.PI * i / 48; return [hemi.rho * Math.cos(th), 0, hemi.rho * Math.sin(th)] as [number, number, number]; }), 'accent', { width: 2 }),
    ...([[1, 0, 0], [0, 0, 1], [0, 1, 0]] as [number, number, number][]).map(([ex, ey, ez]) => {
      const p: [number, number, number] = [hemi.rho * ex, hemi.rho * ey, hemi.rho * ez];
      return arrow3d(p, [p[0] * 1.3, p[1] * 1.3, p[2] * 1.3], 'accent2');
    }),
  ];

  const cylShapes: FigureShape[] = [
    ...axes3d(Math.max(cyl.R, cyl.h) + 1),
    ...wire3d((t, u) => [cyl.R * Math.cos(t), cyl.R * Math.sin(t), u], 0, 2 * Math.PI, 0, cyl.h, 6, 4, 24),
    ...[0.4, 2.4, 4.4].map(t => arrow3d([cyl.R * Math.cos(t), cyl.R * Math.sin(t), cyl.h / 2], [cyl.R * Math.cos(t) * 1.35, cyl.R * Math.sin(t) * 1.35, cyl.h / 2], 'accent2')),
  ];

  return [
    // 1. stokes-setup (symbols)
    g.symbols({
      id: 'stokes-setup',
      title: t('Compute the curl for Stokes\' theorem', '为斯托克斯定理求旋度'),
      prompt: t(
        `Stokes' theorem says ∮_C F · dr = ∬_S (curl F) · n dS, with C the positively oriented boundary of S. For F = (${coef(setup.a, 'x²')}, ${coef(setup.b, 'x')}, ${coef(setup.c, 'z²')}), complete curl F = ( 0, 0, [ ] ).`,
        `斯托克斯定理为 ∮_C F · dr = ∬_S (curl F) · n dS，其中 C 是 S 的正向边界。对 F = (${coef(setup.a, 'x²')}, ${coef(setup.b, 'x')}, ${coef(setup.c, 'z²')})，补全 curl F = ( 0, 0, [ ] )。`
      ),
      before: t('curl F = ( 0, 0, ', 'curl F = ( 0, 0, '),
      after: t(' ) .', ' )。'),
      answers: [String(setup.b)],
      tokens: shuffled(g, [...new Set([String(setup.b), String(setup.a), String(setup.c), String(2 * setup.b), String(setup.a * setup.b)])]),
      hint: t(
        `The k-component of curl F is ∂N/∂x − ∂M/∂y with N = ${coef(setup.b, 'x')} and M = ${coef(setup.a, 'x²')}.`,
        `curl F 的 k 分量为 ∂N/∂x − ∂M/∂y，其中 N = ${coef(setup.b, 'x')}、M = ${coef(setup.a, 'x²')}。`
      ),
      explanation: t(
        `With M = ${coef(setup.a, 'x²')}, N = ${coef(setup.b, 'x')}, P = ${coef(setup.c, 'z²')}: the k-component is ∂N/∂x − ∂M/∂y = ${setup.b} − 0 = ${setup.b}; the i-component (∂P/∂y − ∂N/∂z) and the j-component (∂M/∂z − ∂P/∂x) are both 0. So curl F = (0, 0, ${setup.b}).`,
        `取 M = ${coef(setup.a, 'x²')}、N = ${coef(setup.b, 'x')}、P = ${coef(setup.c, 'z²')}：k 分量为 ∂N/∂x − ∂M/∂y = ${setup.b} − 0 = ${setup.b}；i 分量（∂P/∂y − ∂N/∂z）与 j 分量（∂M/∂z − ∂P/∂x）都为 0。故 curl F = (0, 0, ${setup.b})。`
      ),
    }),

    // 2. graph-value (number)
    g.number({
      id: 'graph-value',
      title: t('Stokes over a graph', '图面上的斯托克斯定理'),
      prompt: t(
        `F = (${coef(gv.a, 'x²')}, ${coef(gv.b, 'x')}, ${coef(gv.c, 'z²')}). S is the part of the graph z = x³ + x²y + y⁴ lying over the disk x² + y² ≤ ${gv.R}², oriented upward (n has positive z-component); C is the boundary of S with the compatible orientation (right-hand rule). The work ∮_C F · dr equals k·π. Enter k.`,
        `F = (${coef(gv.a, 'x²')}, ${coef(gv.b, 'x')}, ${coef(gv.c, 'z²')})。S 是曲面 z = x³ + x²y + y⁴ 位于圆盘 x² + y² ≤ ${gv.R}² 上方的那部分，取上侧（n 的 z 分量为正）；C 是 S 的边界，取与 S 相容的方向（右手法则）。功 ∮_C F · dr 等于 k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: gvAnswer }],
      figure: g.figure({
        alt: t(`In the xy-plane, the disk x² + y² ≤ ${gv.R}² of radius ${gv.R} over which S lies, bounded by the circle that is the projection of C, and the unit vector k along the positive z-axis. The surface itself is not drawn.`, `在 xy 平面内，S 所在的圆盘 x² + y² ≤ ${gv.R}²（半径 ${gv.R}），其边界圆是 C 的投影，以及沿正 z 轴的单位向量 k。图中没有画曲面本身。`),
        view: fitView(graphShapes, 0.2),
        shapes: graphShapes,
        caption: t(`Projection of S onto the xy-plane: the disk of radius ${gv.R}.`, `S 在 xy 平面上的投影：半径 ${gv.R} 的圆盘。`),
      }),
      hint: t(
        `Compute curl F, then note that on an upward graph k · n dS = dx dy, so the surface integral collapses to ${gv.b} × the projected area.`,
        `先求 curl F；再注意上侧图面上 k · n dS = dx dy，于是曲面积分化为 ${gv.b} 乘以投影面积。`
      ),
      explanation: t(
        `curl F = (0, 0, ${gv.b}) (from the set-up). For an upward graph, k · n dS = dx dy, so ∮_C F · dr = ∬_S curl F · n dS = ∬_{x²+y²≤${gv.R}²} ${gv.b} dx dy = ${gv.b}·π${gv.R}². The graph function x³ + x²y + y⁴ and the coefficients ${gv.a}, ${gv.c} do not enter: only ${gv.b} and the radius ${gv.R} matter.`,
        `由设定得 curl F = (0, 0, ${gv.b})。对上侧图面，k · n dS = dx dy，故 ∮_C F · dr = ∬_S curl F · n dS = ∬_{x²+y²≤${gv.R}²} ${gv.b} dx dy = ${gv.b}·π${gv.R}²。曲面函数 x³ + x²y + y⁴ 以及系数 ${gv.a}、${gv.c} 不参与：只与 ${gv.b} 和半径 ${gv.R} 有关。`
      ),
      audit: { kind: 'MIT-MV-60:graph-value', params: { a: gv.a, c: gv.c, b: gv.b, R: gv.R } },
    }),

    // 3. orientation (choice)
    g.choice({
      id: 'orientation',
      title: t('How is the boundary oriented?', '边界曲线怎么定向？'),
      prompt: t(
        `S is the ${orient.upward ? 'upward' : 'downward'} graph z = f(x, y) over the region ${orient.region === 'disk' ? 'a disk' : orient.region === 'square' ? 'a square' : 'an ellipse'} in the xy-plane, and C is its boundary, oriented compatibly with S by the right-hand rule (walking along C in the positive direction with S on your left, your head points along n). As viewed from the positive z-axis, in which direction is C traversed?`,
        `S 是 xy 平面上区域${orient.region === 'disk' ? '圆盘' : orient.region === 'square' ? '正方形' : '椭圆'}上方的${orient.upward ? '上侧' : '下侧'}图面 z = f(x, y)，C 是其边界，按右手法则取与 S 相容的方向（沿 C 正向前进时 S 在左侧，头的方向与 n 一致）。从正 z 轴看去，C 沿哪个方向？`
      ),
      options: [
        t('counterclockwise', '逆时针'),
        t('clockwise', '顺时针'),
        t('either direction, because Stokes\' theorem gives the same value', '任意方向，因为斯托克斯定理给出相同的值'),
        t('it depends on the function f', '取决于函数 f'),
      ],
      correct: orient.upward ? 0 : 1,
      hint: t(
        'For the upward side n = k; point the right thumb along k — the fingers curl in the positive direction of C.',
        '上侧时 n = k；右拇指指向 k，四指弯曲的方向就是 C 的正方向。'
      ),
      explanation: t(
        'For the upward graph n = k, so with the right thumb along +k the fingers curl counterclockwise as seen from +z; reversing n to the downward side reverses the sense, giving clockwise. The two directions are not interchangeable: changing the direction of C changes the sign of ∮_C F·dr. The shape of f does not affect the answer.',
        '上侧图面 n = k，右拇指沿 +k 时，从 +z 看去四指逆时针弯曲；把 n 换成下侧则方向相反，为顺时针。两个方向不可互换：改变 C 的方向会使 ∮_C F·dr 变号。函数 f 的形状不影响答案。'
      ),
      figure: g.figure({
        alt: t(
          `Top view of the xy-plane: a ${orient.region === 'disk' ? 'disk' : orient.region === 'square' ? 'square' : 'ellipse'} and its boundary curve, with the note that the normal n of S points ${orient.upward ? 'up' : 'down'}. The direction of C is not drawn.`,
          `xy 平面的俯视图：一个${orient.region === 'disk' ? '圆盘' : orient.region === 'square' ? '正方形' : '椭圆'}及其边界曲线，并注明 S 的法向量 n 向${orient.upward ? '上' : '下'}。图中没有画 C 的方向。`
        ),
        view: fitView(orientShapes, 0.3),
        shapes: orientShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
      }),
    }),

    // 4. hemisphere-value (number)
    g.number({
      id: 'hemisphere-value',
      title: t('Stokes over a hemisphere', '半球面上的斯托克斯定理'),
      prompt: t(
        `F = y i + 2x j + x k. S is the half of the sphere x² + y² + z² = ${hemi.rho}² on which y ≥ 0, oriented so that n makes an acute angle with the positive y-axis; C is the boundary of S with the compatible orientation (right-hand rule). The work ∮_C F · dr equals k·π. Enter k.`,
        `F = y i + 2x j + x k。S 是球面 x² + y² + z² = ${hemi.rho}² 在 y ≥ 0 的那一半，取 n 与正 y 轴成锐角的一侧；C 是 S 的边界，取与 S 相容的方向（右手法则）。功 ∮_C F · dr 等于 k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: hemiAnswer }],
      figure: g.figure({
        alt: t(`The half of the sphere of radius ${hemi.rho} with y ≥ 0, its boundary circle in the xz-plane, and outward normal arrows.`, `半径 ${hemi.rho} 的球面在 y ≥ 0 的一半、它在 xz 平面内的边界圆，以及外法向箭头。`),
        view: fitView(hemiShapes, 0.2),
        shapes: hemiShapes,
      }),
      hint: t(
        `curl F = −j + k. On the sphere n = (x, y, z)/${hemi.rho}; form (curl F) · n and integrate with dS = ${hemi.rho}² sinφ dφ dθ over the hemisphere y ≥ 0.`,
        `curl F = −j + k。球面上 n = (x, y, z)/${hemi.rho}；写出 (curl F) · n，用 dS = ${hemi.rho}² sinφ dφ dθ 在半球 y ≥ 0 上积分。`
      ),
      explanation: t(
        `curl F = (0, −1, 1) = −j + k, independent of ${hemi.rho}. On the sphere of radius ${hemi.rho}, n = (x, y, z)/${hemi.rho}, so (curl F) · n = (−y + z)/${hemi.rho}. With φ measured from the positive z-axis, y = ${hemi.rho} sinφ sinθ, z = ${hemi.rho} cosφ and dS = ${hemi.rho}² sinφ dφ dθ, so (curl F) · n dS = ${hemi.rho}²(−sinφ sinθ + cosφ) sinφ dφ dθ. Integrating φ from 0 to π and θ from 0 to π gives −π${hemi.rho}², so k = −${hemi.rho}².`,
        `curl F = (0, −1, 1) = −j + k，与 ${hemi.rho} 无关。在半径 ${hemi.rho} 的球面上 n = (x, y, z)/${hemi.rho}，故 (curl F) · n = (−y + z)/${hemi.rho}。φ 从正 z 轴量起，y = ${hemi.rho} sinφ sinθ、z = ${hemi.rho} cosφ，dS = ${hemi.rho}² sinφ dφ dθ，于是 (curl F) · n dS = ${hemi.rho}²(−sinφ sinθ + cosφ) sinφ dφ dθ。对 φ 从 0 到 π、θ 从 0 到 π 积分得 −π${hemi.rho}²，故 k = −${hemi.rho}²。`
      ),
      audit: { kind: 'MIT-MV-60:hemisphere-value', params: { rho: hemi.rho } },
    }),

    // 5. cylinder-flux (choice)
    g.choice({
      id: 'cylinder-flux',
      title: t('Curl through a cylinder', '旋度通过柱面'),
      prompt: t(
        `F = (2xz + y, 2yz + 3x, x² + y² + 5). S is the lateral surface of the cylinder x² + y² = ${cyl.R}², 0 ≤ z ≤ ${cyl.h}, with the normal pointing away from the z-axis. What is ∬_S (curl F) · n dS?`,
        `F = (2xz + y, 2yz + 3x, x² + y² + 5)。S 是柱面 x² + y² = ${cyl.R}²、0 ≤ z ≤ ${cyl.h} 的侧面，法向量指向远离 z 轴的一侧。∬_S (curl F) · n dS 是多少？`
      ),
      options: [
        t('0', '0'),
        t(`${4 * cyl.R * cyl.h}π`, `${4 * cyl.R * cyl.h}π`),
        t(`${2 * cyl.R * cyl.h}π`, `${2 * cyl.R * cyl.h}π`),
        t(`${2 * cyl.R * cyl.R}π`, `${2 * cyl.R * cyl.R}π`),
      ],
      correct: 0,
      figure: g.figure({
        alt: t(`The lateral surface of the cylinder x² + y² = ${cyl.R}², height ${cyl.h}, with arrows for the outward normal n.`, `柱面 x² + y² = ${cyl.R}²、高 ${cyl.h} 的侧面，以及表示外法向 n 的箭头。`),
        view: fitView(cylShapes, 0.2),
        shapes: cylShapes,
      }),
      hint: t(
        'Compute curl F; the normal to the lateral surface has no k-component, so (curl F) · n depends on the k-component of curl F.',
        '先求 curl F；侧面的法向量没有 k 分量，故 (curl F) · n 取决于 curl F 的 k 分量。'
      ),
      explanation: t(
        `curl F = (0, 0, 2) = 2k, which is nonzero. But the outward normal to the lateral surface is n = (x, y, 0)/${cyl.R}, orthogonal to k, so (curl F) · n = 0 at every point and ∬_S (curl F) · n dS = 0. A nonzero curl can have zero flux through a well-chosen surface.`,
        `curl F = (0, 0, 2) = 2k，非零。但侧面外法向 n = (x, y, 0)/${cyl.R} 与 k 正交，故 (curl F) · n 处处为 0，∬_S (curl F) · n dS = 0。非零的旋度在合适的曲面上通量可以为零。`
      ),
    }),

    // 6. flat-circle (number)
    g.number({
      id: 'flat-circle',
      title: t('Circulation around a circle', '绕圆周的环量'),
      prompt: t(
        `F = (2xz + y, 2yz + 3x, x² + y² + 5). C1 is the circle x² + y² = ${fc.R}² in the plane z = 0, oriented counterclockwise as viewed from the positive z-axis. The work ∮_{C1} F · dr equals k·π. Enter k.`,
        `F = (2xz + y, 2yz + 3x, x² + y² + 5)。C1 是平面 z = 0 内的圆周 x² + y² = ${fc.R}²，从正 z 轴看去为逆时针方向。功 ∮_{C1} F · dr 等于 k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: fcAnswer }],
      hint: t(
        "Use Stokes' theorem: replace the line integral by ∬_S (curl F) · n dS over the flat disk, which is oriented upward.",
        '用斯托克斯定理：把线积分换成平面上侧圆盘上的 ∬_S (curl F) · n dS。'
      ),
      explanation: t(
        `curl F = (0, 0, 2) = 2k. The disk x² + y² ≤ ${fc.R}² at z = 0 is oriented upward, so by Stokes ∮_{C1} F · dr = ∬ 2 k · n dS = 2·π${fc.R}², i.e. k = 2·${fc.R}².`,
        `curl F = (0, 0, 2) = 2k。平面 z = 0 上的圆盘 x² + y² ≤ ${fc.R}² 取上侧，由斯托克斯定理 ∮_{C1} F · dr = ∬ 2 k · n dS = 2·π${fc.R}²，即 k = 2·${fc.R}²。`
      ),
      audit: { kind: 'MIT-MV-60:flat-circle', params: { R: fc.R } },
    }),

    // 7. conservative-stokes (choice)
    g.choice({
      id: 'conservative-stokes',
      title: t('Zero curl and closed loops', '零旋度与闭曲线'),
      prompt: t(
        `Suppose curl F = 0 at every point of space. S is ${cons.surface === 'hemisphere' ? 'a hemisphere' : cons.surface === 'cylinder' ? 'the lateral surface of a cylinder' : cons.surface === 'graph' ? 'a graph z = f(x, y)' : cons.surface === 'disk' ? 'a flat disk' : cons.surface === 'cap' ? 'a spherical cap' : 'a cylindrical band'} with boundary C, oriented compatibly by the right-hand rule. What is ∮_C F · dr?`,
        `设全空间中每一点都有 curl F = 0。S 是${cons.surface === 'hemisphere' ? '一个半球面' : cons.surface === 'cylinder' ? '柱面的侧面' : cons.surface === 'graph' ? '图面 z = f(x, y)' : cons.surface === 'disk' ? '一个平面圆盘' : cons.surface === 'cap' ? '一个球冠' : '一条柱带'}，C 是其边界，按右手法则取相容方向。∮_C F · dr 是多少？`
      ),
      options: [
        t('0', '0'),
        t('the area of S', 'S 的面积'),
        t('the flux of F through S', 'F 通过 S 的通量'),
        t('it depends on the shape of S', '取决于 S 的形状'),
      ],
      correct: 0,
      hint: t(
        "Stokes' theorem turns ∮_C F · dr into ∬_S (curl F) · n dS. What is that when curl F = 0 everywhere?",
        '斯托克斯定理把 ∮_C F · dr 化为 ∬_S (curl F) · n dS。当处处 curl F = 0 时它等于多少？'
      ),
      explanation: t(
        "By Stokes' theorem ∮_C F · dr = ∬_S (curl F) · n dS = ∬_S 0 dS = 0. The value does not depend on the shape of S. (Equivalently, curl F = 0 on all of space makes F a gradient field, so every closed-loop integral is 0.)",
        '由斯托克斯定理，∮_C F · dr = ∬_S (curl F) · n dS = ∬_S 0 dS = 0，与 S 的形状无关。（等价地，curl F 在全空间为零使 F 成为梯度场，故任意闭曲线积分都是 0。）'
      ),
    }),

    // 8. challenge (number)
    g.number({
      id: 'challenge',
      title: t('Circulation over a lifted disk', '抬升圆盘上的环量'),
      prompt: t(
        `F = (0, ${coef(ch.s, 'x')}, 0) (written (0, x, 0) when s = 1). S is the disk x² + y² ≤ ${ch.R}² in the plane z = ${ch.h}, oriented upward (n = k); C is its boundary, oriented counterclockwise as viewed from the positive z-axis. The work ∮_C F · dr equals k·π. Enter k.`,
        `F = (0, ${coef(ch.s, 'x')}, 0)（s = 1 时写作 (0, x, 0)）。S 是平面 z = ${ch.h} 上的圆盘 x² + y² ≤ ${ch.R}²，取上侧（n = k）；C 是其边界，从正 z 轴看去为逆时针方向。功 ∮_C F · dr 等于 k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: chAnswer }],
      hint: t(
        `Compute curl F, then apply Stokes' theorem with n = k over the disk of radius ${ch.R}.`,
        `先求 curl F，再用斯托克斯定理、取 n = k 在半径 ${ch.R} 的圆盘上计算。`
      ),
      explanation: t(
        `curl F = (0, 0, ${ch.s}). With the upward disk n = k, Stokes' theorem gives ∮_C F · dr = ∬_S (${ch.s}) dS = ${ch.s}·π${ch.R}², so k = ${ch.s}·${ch.R}². The height ${ch.h} does not enter, because F does not depend on z. This game does not ask you to prove Stokes' theorem or to compute a line integral directly around a curve that is not a circle; every line integral here is reduced to a surface integral of curl F (or evaluated on a circle).`,
        `curl F = (0, 0, ${ch.s})。上侧圆盘 n = k，由斯托克斯定理 ∮_C F · dr = ∬_S (${ch.s}) dS = ${ch.s}·π${ch.R}²，故 k = ${ch.s}·${ch.R}²。高度 ${ch.h} 不参与，因为 F 与 z 无关。本游戏不要求证明斯托克斯定理，也不要求直接计算非圆周曲线上的线积分；这里的每个线积分都化为旋度的曲面积分（或在圆周上计算）。`
      ),
      audit: { kind: 'MIT-MV-60:challenge', params: { s: ch.s, R: ch.R, h: ch.h } },
    }),
  ];
};
