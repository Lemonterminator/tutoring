import type { CardGenerator } from '../../types';
import { fitView, graphOf, line3d, project3d, rect, type FigureShape, type Pt } from '../../figure';
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

export const mv50: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-50');
  warm(g);

  // 1. limits-recipe
  const L = g.pick([1, 2, 3]);
  const orderIdx = g.pick([0, 1, 2]);
  const orders = [
    { v: 'z', s: 'y', t: 'x', order: 'dz dy dx', plane: 'xy' },
    { v: 'y', s: 'x', t: 'z', order: 'dy dx dz', plane: 'xz' },
    { v: 'x', s: 'z', t: 'y', order: 'dx dz dy', plane: 'yz' },
  ];
  const ord = orders[orderIdx];

  // 2-4. Shared c
  const c = g.pick([4, 6, 8, 10, 12, 14, 18]);
  const k = c / 2;
  const radius = Math.sqrt(k);
  const volume = Math.PI * k * k;

  // 5. plane-paraboloid-setup
  const k2 = g.pick([1, 2, 3, 4, 5, 6]);

  // 6. choose-coords
  const scenario = g.pick(['A', 'B', 'C', 'D']);
  const scL = g.pick([1, 2, 3]);
  const scA = g.pick([1, 2, 3]);
  const scH = g.pick([1, 2, 3]);
  const scC = g.pick([4, 6, 8]);
  const scB = g.pick([1, 2, 3]);

  // 7. cylinder-mass
  const cylA = g.pick([1, 2, 3]);
  const cylH = g.pick([1, 2, 3, 4]);
  const cylMass = Math.PI * cylH * cylA ** 4 / 2;

  // 8. hemisphere-zcm
  const hemA = g.pick([2, 3, 4, 5, 6, 8]);
  const hemZcm = 3 * hemA / 8;

  // 9. challenge
  const chK = g.pick([1, 2, 3]);
  const chT = g.pick([1, 2, 3]);
  const chH = chK * chT;
  const chVol = Math.PI * chH ** 3 / (3 * chK ** 2);

  const notAssessed = t(
    'This game builds the set-up (limits, projection, choice of coordinates, the factor r) and the short arithmetic for triple integrals in rectangular and cylindrical coordinates; it does not cover spherical coordinates, surface integrals or flux, or long antiderivatives.',
    '本游戏训练三重积分在直角坐标与柱坐标下的设置（积分限、投影、坐标系的选择、因子 r）和简短的计算；不涉及球坐标、曲面积分与通量，也不涉及冗长的原函数计算。'
  );

  // Figure: Tetrahedron for limits-recipe
  const tetraOf = (L: number): FigureShape[] => [
    line3d([[0, 0, 0], [L, 0, 0]], 'axis', { label: 'x' }),
    line3d([[0, 0, 0], [0, L, 0]], 'axis', { label: 'y' }),
    line3d([[0, 0, 0], [0, 0, L]], 'axis', { label: 'z' }),
    line3d([[L, 0, 0], [0, L, 0]], 'accent'),
    line3d([[L, 0, 0], [0, 0, L]], 'accent'),
    line3d([[0, L, 0], [0, 0, L]], 'accent'),
    { kind: 'point', at: project3d([0, 0, 0]), tone: 'text' },
    { kind: 'point', at: project3d([L, 0, 0]), tone: 'text' },
    { kind: 'point', at: project3d([0, L, 0]), tone: 'text' },
    { kind: 'point', at: project3d([0, 0, L]), tone: 'text' },
  ];
  const tetraShapes = tetraOf(L);

  // Figure: Cross-section for paraboloids
  const X = Math.sqrt(c);
  const parShapes: FigureShape[] = [
    { kind: 'line', points: graphOf((x: number) => x * x, -X, X), tone: 'accent' },
    { kind: 'line', points: graphOf((x: number) => c - x * x, -X, X), tone: 'accent2' },
  ];

  // Figure: Hemisphere
  const hemShapes: FigureShape[] = [
    { kind: 'line', points: graphOf((x: number) => Math.sqrt(hemA * hemA - x * x), -hemA, hemA), tone: 'accent' },
    { kind: 'line', points: [[-hemA, 0], [hemA, 0]], tone: 'axis' },
  ];

  // Figure: Challenge Cone
  const chR = chH / chK;
  const coneShapes: FigureShape[] = [
    { kind: 'line', points: [[-chR, chH], [0, 0], [chR, chH]], tone: 'accent' },
    { kind: 'line', points: [[-chR, chH], [chR, chH]], tone: 'accent2', dash: true },
  ];

  return [
    g.choice({
      id: 'limits-recipe',
      title: t('Limits for a tetrahedron', '四面体的积分限'),
      prompt: t(
        `D is the solid tetrahedron bounded by the coordinate planes and the plane x + y + z = ${L}. You integrate ∭_D dV in the order ${ord.order}, so ${ord.v} comes first. Which set-up is correct?`,
        `D 是由坐标平面和平面 x + y + z = ${L} 围成的四面体。你按 ${ord.order} 的次序积分 ∭_D dV，所以先对 ${ord.v} 积分。下面哪个积分限的设置是正确的？`
      ),
      options: [
        t(`${ord.v} from 0 to ${L} − ${ord.s} − ${ord.t}; then (${ord.s}, ${ord.t}) over the triangle ${ord.s} ≥ 0, ${ord.t} ≥ 0, ${ord.s} + ${ord.t} ≤ ${L}, the projection of D onto the ${ord.s}${ord.t}-plane.`,
          `${ord.v} 从 0 到 ${L} − ${ord.s} − ${ord.t}；然后 (${ord.s}, ${ord.t}) 取遍三角形 ${ord.s} ≥ 0，${ord.t} ≥ 0，${ord.s} + ${ord.t} ≤ ${L}，即 D 在 ${ord.s}${ord.t} 平面上的投影。`),
        t(`${ord.v} from 0 to ${L}; then (${ord.s}, ${ord.t}) over the square 0 ≤ ${ord.s} ≤ ${L}, 0 ≤ ${ord.t} ≤ ${L}.`,
          `${ord.v} 从 0 到 ${L}；然后 (${ord.s}, ${ord.t}) 取遍正方形 0 ≤ ${ord.s} ≤ ${L}，0 ≤ ${ord.t} ≤ ${L}。`),
        t(`${ord.v} from 0 to ${L} − ${ord.s} − ${ord.t}; then (${ord.s}, ${ord.t}) over the square 0 ≤ ${ord.s} ≤ ${L}, 0 ≤ ${ord.t} ≤ ${L}.`,
          `${ord.v} 从 0 到 ${L} − ${ord.s} − ${ord.t}；然后 (${ord.s}, ${ord.t}) 取遍正方形 0 ≤ ${ord.s} ≤ ${L}，0 ≤ ${ord.t} ≤ ${L}。`),
        t(`${ord.v} from 0 to ${L}; then (${ord.s}, ${ord.t}) over the triangle ${ord.s} ≥ 0, ${ord.t} ≥ 0, ${ord.s} + ${ord.t} ≤ ${L}.`,
          `${ord.v} 从 0 到 ${L}；然后 (${ord.s}, ${ord.t}) 取遍三角形 ${ord.s} ≥ 0，${ord.t} ≥ 0，${ord.s} + ${ord.t} ≤ ${L}。`),
      ],
      correct: 0,
      hint: t(`Hold the other two variables fixed and let ${ord.v} increase: where does that line enter D, and where does it leave?`,
        `固定另外两个变量，让 ${ord.v} 增大：这条线从哪里进入 D，又从哪里离开 D？`),
      explanation: t(`A line parallel to the ${ord.v}-axis enters D on the plane ${ord.v} = 0 and leaves on the slanted plane, where ${ord.v} = ${L} − ${ord.s} − ${ord.t}. These lines cover exactly the projection of D onto the ${ord.s}${ord.t}-plane, the triangle ${ord.s} ≥ 0, ${ord.t} ≥ 0, ${ord.s} + ${ord.t} ≤ ${L}.`,
        `平行于 ${ord.v} 轴的直线在平面 ${ord.v} = 0 处进入 D，在斜面上离开，那里 ${ord.v} = ${L} − ${ord.s} − ${ord.t}。这些直线恰好覆盖 D 在 ${ord.s}${ord.t} 平面上的投影，即三角形 ${ord.s} ≥ 0，${ord.t} ≥ 0，${ord.s} + ${ord.t} ≤ ${L}。`),
      figure: g.figure({
        alt: t(`The tetrahedron with vertices at the origin and at distance ${L} along each axis.`,
          `顶点在原点及沿各轴距离 ${L} 处的四面体。`),
        view: fitView(tetraShapes, 0.2),
        shapes: tetraShapes,
      }),
    }),
    g.number({
      id: 'projection-radius',
      title: t('Radius of intersection', '相交圆的半径'),
      prompt: t(`The solid D lies between the paraboloids z = x² + y² and z = ${c} − x² − y². The two surfaces meet over a circle in the xy-plane centred at the origin. Find the radius of that circle. Give the exact value, for example sqrt(3).`,
        `立体 D 位于抛物面 z = x² + y² 与 z = ${c} − x² − y² 之间。两曲面在 xy 平面上方沿一个以原点为圆心的圆相交。求这个圆的半径，写出精确值，例如 sqrt(3)。`),
      fields: [{ label: t('radius', '半径'), answer: radius }],
      hint: t(`Eliminate z: set x² + y² = ${c} − (x² + y²).`, `消去 z：令 x² + y² = ${c} − (x² + y²)。`),
      explanation: t(`x² + y² = ${c} − (x² + y²) gives x² + y² = ${k}. The projection R of D onto the xy-plane is the disc of radius √${k}.`,
        `x² + y² = ${c} − (x² + y²) 得 x² + y² = ${k}。D 在 xy 平面上的投影 R 是半径为 √${k} 的圆盘。`),
      audit: { kind: 'MIT-MV-50:projection-radius', params: { c } },
      figure: g.figure({
        alt: t(`Cross-section of the solid by the xz-plane: an upward parabola z = x² and a downward parabola z = ${c} − x² that cross.`,
          `立体在 xz 平面上的截面：向上抛物线 z = x² 与向下抛物线 z = ${c} − x² 相交。`),
        view: fitView(parShapes, 0.2),
        shapes: parShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.symbols({
      id: 'cyl-setup',
      title: t('Cylindrical set-up', '柱坐标设置'),
      prompt: t(`Use cylindrical coordinates to write the volume of the same solid D (between z = x² + y² and z = ${c} − x² − y²) as V = ∫_{θ=0}^{2π} ∫_{r=0}^{[ ]} ∫_{z=[ ]}^{[ ]} [ ] dz dr dθ. Remember dV = r dz dr dθ.`,
        `用柱坐标把同一个立体 D（介于 z = x² + y² 与 z = ${c} − x² − y² 之间）的体积写成 V = ∫_{θ=0}^{2π} ∫_{r=0}^{[ ]} ∫_{z=[ ]}^{[ ]} [ ] dz dr dθ。注意 dV = r dz dr dθ。`),
      before: '∫_{θ=0}^{2π} ∫_{r=0}^{',
      between: ['} ∫_{z=', '}^{', '} '],
      after: ' dz dr dθ',
      answers: [
        Number.isInteger(radius) ? String(radius) : `sqrt(${k})`,
        'r²',
        `${c} − r²`,
        'r'
      ],
      tokens: shuffled(g, [
        Number.isInteger(radius) ? String(radius) : `sqrt(${k})`,
        'r²',
        `${c} − r²`,
        'r',
        String(k),
        String(c),
        `${k} − r²`,
        '1'
      ]),
      hint: t(`x² + y² = r². Where do the two surfaces meet, in terms of r?`, `x² + y² = r²。两曲面在 r 取何值处相交？`),
      explanation: t(`In cylindrical coordinates x² + y² = r², so the lower surface is z = r² and the upper surface is z = ${c} − r². They meet at r² = ${k}, so r runs from 0 to √${k}. Because dV = r dz dr dθ, the integrand is r, not 1.`,
        `在柱坐标中 x² + y² = r²，所以下曲面是 z = r²，上曲面是 z = ${c} − r²。它们在 r² = ${k} 处相交，所以 r 从 0 到 √${k}。因为 dV = r dz dr dθ，被积函数是 r 而不是 1。`),
    }),
    g.number({
      id: 'paraboloid-volume',
      title: t('Volume between paraboloids', '两抛物面之间的体积'),
      prompt: t(`Find the volume of the solid D between the paraboloids z = x² + y² and z = ${c} − x² − y². Give the exact value, for example 9pi.`,
        `求介于抛物面 z = x² + y² 与 z = ${c} − x² − y² 之间的立体 D 的体积，写出精确值，例如 9pi。`),
      fields: [{ label: t('V', 'V'), answer: volume }],
      hint: t(`Use your cylindrical set-up: the z-integral gives the height ${c} − 2r².`, `用你的柱坐标设置：对 z 积分得到高度 ${c} − 2r²。`),
      explanation: t(`V = ∫₀^{2π}∫₀^{√${k}} (${c} − 2r²) r dr dθ = 2π[${c}r²/2 − r⁴/2] from 0 to √${k} = 2π(${c}·${k}/2 − ${k}²/2) = ${k * k}π.`,
        `V = ∫₀^{2π}∫₀^{√${k}} (${c} − 2r²) r dr dθ = 2π[${c}r²/2 − r⁴/2]（r 从 0 到 √${k}）= 2π(${c}·${k}/2 − ${k}²/2) = ${k * k}π。`),
      audit: { kind: 'MIT-MV-50:paraboloid-volume', params: { c } },
      figure: g.figure({
        alt: t(`Cross-section of the solid by the xz-plane.`, `立体在 xz 平面上的截面。`),
        view: fitView(parShapes, 0.2),
        shapes: parShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.symbols({
      id: 'plane-paraboloid-setup',
      title: t('Rectangular set-up', '直角坐标设置'),
      prompt: t(`D is the region below the plane z = ${coef(k2, 'y')} and above the paraboloid z = x² + y². The surfaces meet where x² + y² = ${coef(k2, 'y')}. Complete the set-up of the volume in rectangular coordinates: V = ∫_{y=0}^{[ ]} ∫_{x=[ ]}^{[ ]} ∫_{z=[ ]}^{[ ]} dz dx dy.`,
        `D 是平面 z = ${coef(k2, 'y')} 之下、抛物面 z = x² + y² 之上的区域。两曲面在 x² + y² = ${coef(k2, 'y')} 处相交。用直角坐标补全体积的积分设置：V = ∫_{y=0}^{[ ]} ∫_{x=[ ]}^{[ ]} ∫_{z=[ ]}^{[ ]} dz dx dy。`),
      before: '∫_{y=0}^{',
      between: ['} ∫_{x=', '}^{', '} ∫_{z=', '}^{'],
      after: '} dz dx dy',
      answers: [
        String(k2),
        `−√(${coef(k2, 'y')} − y²)`,
        `√(${coef(k2, 'y')} − y²)`,
        'x² + y²',
        coef(k2, 'y')
      ],
      tokens: shuffled(g, [
        String(k2),
        `−√(${coef(k2, 'y')} − y²)`,
        `√(${coef(k2, 'y')} − y²)`,
        'x² + y²',
        coef(k2, 'y'),
        `${k2}/2`,
        `√(${k2}² − y²)`,
        `−√(${k2}² − y²)`,
        'y²'
      ]),
      hint: t(`Complete the square in x² + y² = ${coef(k2, 'y')} to see the circle over which the solid sits. Then for each y, x runs symmetrically.`,
        `对 x² + y² = ${coef(k2, 'y')} 配方，看出立体所在的圆。然后对每个 y，x 的范围关于 0 对称。`),
      explanation: t(`At fixed (x, y) the vertical line enters D at the paraboloid z = x² + y² and leaves at the plane z = ${coef(k2, 'y')}. They meet where x² + (y − ${k2}/2)² = (${k2}/2)², a circle centred at (0, ${k2}/2) with radius ${k2}/2. So y runs from 0 to ${k2}, and for each y, x runs from −√(${coef(k2, 'y')} − y²) to √(${coef(k2, 'y')} − y²).`,
        `固定 (x, y)，竖直线在抛物面 z = x² + y² 处进入 D，在平面 z = ${coef(k2, 'y')} 处离开。两曲面相交于 x² + (y − ${k2}/2)² = (${k2}/2)²，这是圆心 (0, ${k2}/2)、半径 ${k2}/2 的圆。所以 y 从 0 到 ${k2}，对每个 y，x 从 −√(${coef(k2, 'y')} − y²) 到 √(${coef(k2, 'y')} − y²)。`),
    }),
    g.choice({
      id: 'choose-coords',
      title: t('Choosing coordinates', '选择坐标系'),
      prompt: t(`You must set up ${
        scenario === 'A' ? `the moment of inertia about the z-axis of the solid tetrahedron bounded by the coordinate planes and x + y + z = ${scL}, with density 1 (integrand x² + y²)` :
        scenario === 'B' ? `the mass of the solid cylinder x² + y² ≤ ${scA}², 0 ≤ z ≤ ${scH} with density δ = x² + y²` :
        scenario === 'C' ? `the volume of the solid between the paraboloids z = x² + y² and z = ${scC} − x² − y²` :
        `the mass of the box 0 ≤ x ≤ ${scB}, 0 ≤ y ≤ ${scB}, 0 ≤ z ≤ ${scH} with density δ = x + y + z`
      }. Which coordinate system is the better choice, so that both the limits and the integrand stay simple?`,
      `你要建立${
        scenario === 'A' ? `由坐标平面与 x + y + z = ${scL} 围成的实心四面体（密度为 1）关于 z 轴的转动惯量（被积函数 x² + y²）` :
        scenario === 'B' ? `实心圆柱 x² + y² ≤ ${scA}²，0 ≤ z ≤ ${scH}（密度 δ = x² + y²）的质量` :
        scenario === 'C' ? `抛物面 z = x² + y² 与 z = ${scC} − x² − y² 之间的立体的体积` :
        `长方体 0 ≤ x ≤ ${scB}，0 ≤ y ≤ ${scB}，0 ≤ z ≤ ${scH}（密度 δ = x + y + z）的质量`
      }的积分。哪个坐标系更合适，使积分限和被积函数都保持简单？`),
      options: [
        t('Rectangular coordinates: the boundary surfaces are planes, so the limits stay simple.', '直角坐标：边界曲面都是平面，积分限保持简单。'),
        t('Cylindrical coordinates: the solid is symmetric about the z-axis, so the limits are simple in r, θ and z.', '柱坐标：立体关于 z 轴对称，所以用 r、θ、z 时积分限很简单。'),
        t('Cylindrical coordinates whenever the integrand contains x² + y², whatever the shape of the solid.', '只要被积函数含有 x² + y²，不论立体形状如何，都用柱坐标。'),
        t('It makes no difference: the limits are equally simple in both systems.', '没有区别：两种坐标系下积分限同样简单。'),
      ],
      correct: (scenario === 'A' || scenario === 'D') ? 0 : 1,
      hint: t('Look at the boundary of the solid: planar faces, or a body of revolution about the z-axis? An easy integrand does not help if the limits become complicated.',
        '看立体的边界：是平面的面，还是绕 z 轴的旋转体？如果积分限变得复杂，被积函数简单也没有用。'),
      explanation: t(
        scenario === 'A' ? `In cylindrical coordinates x² + y² becomes the easy r², but the slanted plane x + y + z = ${scL} becomes z = ${scL} − r cos θ − r sin θ, so the limits are complicated. In rectangular coordinates the faces are planes and the limits are simple, so choose rectangular.` :
        scenario === 'B' ? `The cylinder is symmetric about the z-axis, and in cylindrical coordinates the limits are constants (0 ≤ r ≤ ${scA}, 0 ≤ θ ≤ 2π, 0 ≤ z ≤ ${scH}) and the density is r². Choose cylindrical.` :
        scenario === 'C' ? `Both paraboloids depend on x² + y² only, so they are z = r² and z = ${scC} − r², and the projection is a disc. Choose cylindrical.` :
        `The box has planar faces, so the rectangular limits are constants, while cylindrical limits for a box are awkward. Choose rectangular.`,
        scenario === 'A' ? `在柱坐标中 x² + y² 变成简单的 r²，但斜面 x + y + z = ${scL} 变成 z = ${scL} − r cos θ − r sin θ，积分限很复杂。在直角坐标中各面都是平面，积分限简单，所以选直角坐标。` :
        scenario === 'B' ? `圆柱关于 z 轴对称，在柱坐标中积分限都是常数（0 ≤ r ≤ ${scA}，0 ≤ θ ≤ 2π，0 ≤ z ≤ ${scH}），密度为 r²。选柱坐标。` :
        scenario === 'C' ? `两个抛物面都只依赖 x² + y²，分别是 z = r² 与 z = ${scC} − r²，投影是圆盘。选柱坐标。` :
        `长方体各面是平面，直角坐标的积分限是常数，而长方体用柱坐标则很别扭。选直角坐标。`
      ),
      figure: scenario === 'A' ? g.figure({
        alt: t(`The tetrahedron with vertices at the origin and at distance ${scL} along each axis.`, `顶点在原点及沿各轴距离 ${scL} 处的四面体。`),
        view: fitView(tetraOf(scL), 0.2),
        shapes: tetraOf(scL),
      }) : undefined,
    }),
    g.number({
      id: 'cylinder-mass',
      title: t('Mass of a cylinder', '圆柱的质量'),
      prompt: t(`Find the mass of the solid cylinder x² + y² ≤ ${cylA}², 0 ≤ z ≤ ${cylH}, whose density is δ = x² + y². Give the exact value, for example 3pi/2.`,
        `求实心圆柱 x² + y² ≤ ${cylA}²，0 ≤ z ≤ ${cylH} 的质量，其密度为 δ = x² + y²。写出精确值，例如 3pi/2。`),
      fields: [{ label: t('M', 'M'), answer: cylMass }],
      hint: t('In cylindrical coordinates δ = r² and dV = r dz dr dθ, so the integrand is r³.', '在柱坐标中 δ = r²，dV = r dz dr dθ，所以被积函数是 r³。'),
      explanation: t(`M = ∫₀^{2π}∫₀^{${cylA}}∫₀^{${cylH}} r²·r dz dr dθ = 2π·${cylH}·${cylA}⁴/4 ≈ ${num(cylMass)}. Without the factor r from dV the result would be wrong.`,
        `M = ∫₀^{2π}∫₀^{${cylA}}∫₀^{${cylH}} r²·r dz dr dθ = 2π·${cylH}·${cylA}⁴/4 ≈ ${num(cylMass)}。如果漏掉 dV 中的因子 r，结果就会出错。`),
      audit: { kind: 'MIT-MV-50:cylinder-mass', params: { a: cylA, h: cylH } },
    }),
    g.number({
      id: 'hemisphere-zcm',
      title: t('Centre of mass of a hemisphere', '半球的质心'),
      prompt: t(`The solid upper hemisphere x² + y² + z² ≤ ${hemA}², z ≥ 0, has density δ = 1. By symmetry x̄ = ȳ = 0. Find z̄, the z-coordinate of its centre of mass. Give a fraction.`,
        `实心上半球 x² + y² + z² ≤ ${hemA}²，z ≥ 0，密度 δ = 1。由对称性 x̄ = ȳ = 0。求质心的 z 坐标 z̄，写成分数。`),
      fields: [{ label: t('z̄', 'z̄'), answer: hemZcm }],
      hint: t(`z̄ = (1/M)∭ z dV. In cylindrical coordinates z runs from 0 to √(${hemA}² − r²).`, `z̄ = (1/M)∭ z dV。在柱坐标中 z 从 0 到 √(${hemA}² − r²)。`),
      explanation: t(`M = ∫₀^{2π}∫₀^{${hemA}}∫₀^{√(${hemA}²−r²)} r dz dr dθ = 2π${hemA}³/3 and ∭ z dV = ∫₀^{2π}∫₀^{${hemA}} (${hemA}² − r²)r/2 dr dθ = π${hemA}⁴/4. So z̄ = (π${hemA}⁴/4)/(2π${hemA}³/3) = 3·${hemA}/8 = ${num(hemZcm)}.`,
        `M = ∫₀^{2π}∫₀^{${hemA}}∫₀^{√(${hemA}²−r²)} r dz dr dθ = 2π${hemA}³/3，∭ z dV = ∫₀^{2π}∫₀^{${hemA}} (${hemA}² − r²)r/2 dr dθ = π${hemA}⁴/4。所以 z̄ = (π${hemA}⁴/4)/(2π${hemA}³/3) = 3·${hemA}/8 = ${num(hemZcm)}。`),
      audit: { kind: 'MIT-MV-50:hemisphere-zcm', params: { a: hemA } },
      figure: g.figure({
        alt: t(`Cross-section of the upper hemisphere: a half disc of radius ${hemA}.`, `上半球的截面：半径为 ${hemA} 的半圆盘。`),
        view: fitView(hemShapes, 0.2),
        shapes: hemShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.number({
      id: 'challenge',
      title: t('Volume of a cone segment', '圆锥段的体积'),
      prompt: t(`Find the volume of the solid above the cone z = ${coef(chK, 'r')} and below the plane z = ${chH}. Give the exact value, for example 2pi/3.`,
        `求圆锥 z = ${coef(chK, 'r')} 之上、平面 z = ${chH} 之下的立体的体积。写出精确值，例如 2pi/3。`),
      fields: [{ label: t('V', 'V'), answer: chVol }],
      hint: t(`Use cylindrical coordinates: the cone is z = ${coef(chK, 'r')}, so for each (r, θ) the variable z runs from ${coef(chK, 'r')} up to ${chH}.`,
        `用柱坐标：圆锥是 z = ${coef(chK, 'r')}，所以对每个 (r, θ)，z 从 ${coef(chK, 'r')} 变到 ${chH}。`),
      explanation: t(`The cone meets the plane z = ${chH} where ${coef(chK, 'r')} = ${chH}, that is r = ${chT}. V = ∫₀^{2π}∫₀^{${chT}}∫_{${coef(chK, 'r')}}^{${chH}} r dz dr dθ = 2π∫₀^{${chT}} (${chH} − ${coef(chK, 'r')}) r dr = 2π(${chH}·${chT}²/2 − ${chK}·${chT}³/3) ≈ ${num(chVol)}. ${notAssessed[0]}`,
        `圆锥与平面 z = ${chH} 在 ${coef(chK, 'r')} = ${chH} 即 r = ${chT} 处相交。V = ∫₀^{2π}∫₀^{${chT}}∫_{${coef(chK, 'r')}}^{${chH}} r dz dr dθ = 2π∫₀^{${chT}} (${chH} − ${coef(chK, 'r')}) r dr = 2π(${chH}·${chT}²/2 − ${chK}·${chT}³/3) ≈ ${num(chVol)}。${notAssessed[1]}`),
      audit: { kind: 'MIT-MV-50:challenge', params: { k: chK, h: chH } },
      figure: g.figure({
        alt: t(`Cross-section of the cone and plane.`, `圆锥和平面的截面。`),
        view: fitView(coneShapes, 0.2),
        shapes: coneShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
  ];
};
