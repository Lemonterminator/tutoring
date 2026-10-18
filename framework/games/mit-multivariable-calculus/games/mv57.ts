import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, graphOf, wire3d, type FigureShape } from '../../figure';
import { coef, frac, makeMvDeck, num, par, term, type Text } from '../support';

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

export const mv57: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-57');
  warm(g);

  // 1. component
  const c1 = g.pick([2, 3, 4, 5]);
  const alpha = g.pick([1, 2]);
  const gamma = g.pick([2, 3]);
  const pStr = coef(c1, 'x');
  const zStr = gamma === 1 ? 'z' : `z${gamma === 2 ? '²' : '³'}`;
  const PStr = `${pStr}${zStr}`;
  const dPdzStr = coef(c1 * gamma, 'x') + (gamma - 1 === 1 ? 'z' : gamma - 1 === 2 ? 'z²' : '');
  const dPdxStr = alpha === 1 ? coef(c1, 'z') : coef(c1 * alpha, 'x') + zStr;
  const sumStr = `(${dPdxStr} + ${dPdzStr})`;

  // 2. simple-check
  const isSimple = g.random(0, 1) < 0.5;
  let scenarioEn = '';
  let scenarioZh = '';
  let a = 0, b = 0, c = 0;
  if (isSimple) {
    const type = g.random(0, 3);
    a = g.pick([2, 3, 4]);
    b = g.pick([2, 3, 4]);
    c = g.pick([2, 3, 4]);
    if (type === 0) {
      scenarioEn = `the surface of a ball of radius ${a}`;
      scenarioZh = `半径为 ${a} 的球的表面`;
    } else if (type === 1) {
      scenarioEn = `the surface of an upright solid cylinder of radius ${a} and height ${b} (it has vertical sides)`;
      scenarioZh = `半径为 ${a}、高为 ${b} 的直立实心圆柱的表面（有竖直的侧面）`;
    } else if (type === 2) {
      scenarioEn = `the surface of the box 0 ≤ x ≤ ${a}, 0 ≤ y ≤ ${b}, 0 ≤ z ≤ ${c}`;
      scenarioZh = `长方体 0 ≤ x ≤ ${a}、0 ≤ y ≤ ${b}、0 ≤ z ≤ ${c} 的表面`;
    } else {
      scenarioEn = `the surface of an upright solid cone with base radius ${a} in the plane z = 0 and apex (0, 0, ${b})`;
      scenarioZh = `底面半径为 ${a}（在平面 z = 0 内）、顶点为 (0, 0, ${b}) 的直立实心圆锥的表面`;
    }
  } else {
    const type = g.random(0, 1);
    if (type === 0) {
      scenarioEn = 'the surface of a torus standing on its edge like a wheel, with its axis along the x-axis';
      scenarioZh = '像车轮一样立着的环面，其轴沿 x 轴';
    } else {
      scenarioEn = 'the surface of a block with a horizontal tunnel drilled through it';
      scenarioZh = '水平钻通了一个隧道的方块的表面';
    }
  }

  // 3. lower-setup
  const c3 = g.pick([2, 3, 4, 5]);
  const H = g.pick([2, 4, 6]);
  const s = Math.sqrt(H);
  const lowerShapes: FigureShape[] = [
    { kind: 'line', points: graphOf((x: number) => x * x, -s, s), tone: 'accent', label: 'z = x²', labelAt: [0.82 * s, 0.49 * H] },
    { kind: 'line', points: [[-s, H], [s, H]], tone: 'accent2', label: `z = ${H}` },
    { kind: 'area', points: [...graphOf((x: number) => x * x, -s, s), [s, H], [-s, H]], tone: 'accent', opacity: 0.25 },
    { kind: 'arrow', from: [0, 0], to: [0, -0.9], tone: 'warn', label: 'n' },
  ];

  // 4. lower-flux
  const c4 = g.pick([2, 3, 4, 5]);
  const H4 = g.pick([2, 4, 6]);
  const k4 = -c4 * H4 * H4 / 2;

  // 5. cut-cancel
  const solidType = g.random(0, 2);
  const kPieces = g.pick([2, 3, 4]);
  const solidEn = ['a block with a horizontal tunnel through it', 'a U-shaped block', 'a solid torus standing on its edge like a wheel'][solidType];
  const solidZh = ['水平钻通了隧道的方块', 'U 形方块', '像车轮一样立着的实心环体'][solidType];
  const piecesEn = ['D1 and D2', 'D1, D2, D3', 'D1, D2, D3, D4'][kPieces - 2];
  const piecesZh = ['D1 和 D2', 'D1、D2、D3', 'D1、D2、D3、D4'][kPieces - 2];

  // 6. pde-name
  const pdeType = g.random(0, 3);
  const kPde = g.pick([2, 3, 4, 5]);
  let eqEn = '';
  let eqZh = '';
  if (pdeType === 0) {
    eqEn = '∂²w/∂x² + ∂²w/∂y² + ∂²w/∂z² = 0';
    eqZh = '∂²w/∂x² + ∂²w/∂y² + ∂²w/∂z² = 0';
  } else if (pdeType === 1) {
    eqEn = `∂²w/∂x² + ∂²w/∂y² + ∂²w/∂z² = ${kPde}xy`;
    eqZh = `∂²w/∂x² + ∂²w/∂y² + ∂²w/∂z² = ${kPde}xy`;
  } else if (pdeType === 2) {
    eqEn = `∂²w/∂x² = (1/${kPde}²) ∂²w/∂t²`;
    eqZh = `∂²w/∂x² = (1/${kPde}²) ∂²w/∂t²`;
  } else {
    eqEn = `∂²w/∂x² = (1/${kPde}²) ∂w/∂t`;
    eqZh = `∂²w/∂x² = (1/${kPde}²) ∂w/∂t`;
  }

  // 7. sphere-bounds
  const R7 = g.pick([2, 3, 4, 5, 6, 7]);
  const sphere57Shapes: FigureShape[] = [
    ...axes3d(R7 + 1),
    ...wire3d(
      (phi, th) => [R7 * Math.sin(phi) * Math.cos(th), R7 * Math.sin(phi) * Math.sin(th), R7 * Math.cos(phi)],
      0, Math.PI, 0, 2 * Math.PI, 4, 8, 24
    ),
    arrow3d([0, 0, 0], [
      R7 * Math.sin(Math.PI / 3) * Math.cos(Math.PI / 4),
      R7 * Math.sin(Math.PI / 3) * Math.sin(Math.PI / 4),
      R7 * Math.cos(Math.PI / 3),
    ], 'accent2', 'R'),
  ];

  // 8. non-harmonic
  const sets = [[1, 2, 3], [1, 1, 4], [1, 4, 4], [2, 3, 4], [1, 3, 5], [2, 2, 5], [1, 2, 6]];
  const abc = sets[g.random(0, sets.length - 1)];
  const a8 = abc[0], b8 = abc[1], c8 = abc[2];
  const d8 = retry(() => g.random(-5, 5), v => v !== 0);
  const R8 = g.pick([2, 3, 4]);
  const ans8 = (a8 + b8 + c8) * R8 * R8 / 3 + d8;

  // 9. challenge
  const p9 = g.pick([2, 3, 4, 5]);
  const q9 = g.pick([2, 3, 4, 5]);
  const c9 = g.pick([1, 2, 3]);
  const R9 = g.pick([2, 3, 4]);
  const ans9 = p9 * q9;

  return [
    g.choice({
      id: 'component',
      title: t('What the proof reduces to', '证明化归成什么'),
      prompt: t(
        `F = P k with P = ${PStr}. S is a closed surface with interior D that is vertically simple. The proof in the notes turns the flux ∬_S F · n dS into a triple integral over D. Which one?`,
        `F = P k，其中 P = ${PStr}。S 是围成区域 D 的闭曲面，并且在竖直方向上是简单的。笔记中的证明把通量 ∬_S F · n dS 化成 D 上的三重积分。是哪一个？`
      ),
      options: [
        t(`∭_D ${dPdzStr} dV`, `∭_D ${dPdzStr} dV`),
        t(`∭_D ${PStr} dV`, `∭_D ${PStr} dV`),
        t(`∭_D ${dPdxStr} dV`, `∭_D ${dPdxStr} dV`),
        t(`∭_D ${sumStr} dV`, `∭_D ${sumStr} dV`),
      ],
      correct: 0,
      hint: t(
        'In the proof the z-integral is done first: ∫ ∂P/∂z dz from z = g to z = h equals P(x, y, h) − P(x, y, g). Which derivative sits inside the triple integral?',
        '证明中先做 z 的积分：∂P/∂z 对 z 从 z = g 积到 z = h，得 P(x, y, h) − P(x, y, g)。三重积分里是哪个导数？'
      ),
      explanation: t(
        `The z-integral of ∂P/∂z from g to h is P(x, y, h) − P(x, y, g), which is exactly the sum of the two surface fluxes. So the triple integral has ∂P/∂z = ${dPdzStr} as its integrand. Using P itself, or the x-derivative, does not give the flux, and adding the other partial derivatives would be right only if F had other components.`,
        `∂P/∂z 对 z 从 g 到 h 的积分正是 P(x, y, h) − P(x, y, g)，也就是上下两个曲面通量之和。所以三重积分的被积函数是 ∂P/∂z = ${dPdzStr}。用 P 本身或对 x 的导数都不是这个通量；只有当 F 还有其他分量时，才需要加上其他偏导数。`
      ),
    }),
    g.choice({
      id: 'simple-check',
      title: t('Is the surface vertically simple?', '曲面在竖直方向上简单吗？'),
      prompt: t(
        `The proof for F = P k needs S to be vertically simple: every vertical line over the interior of the shadow R of S in the xy-plane meets S exactly twice. Is S = ${scenarioEn} vertically simple?`,
        `对 F = P k 的证明要求 S 在竖直方向上简单：S 在 xy 平面上的投影 R 内部的每条竖直线都恰好与 S 相交两次。S = ${scenarioZh}在竖直方向上简单吗？`
      ),
      options: [
        t('Yes: every vertical line over the interior of R meets S exactly twice, and vertical sides do not matter', '是：R 内部的每条竖直线都恰好与 S 相交两次，竖直的侧面没有影响'),
        t('No: over part of R a vertical line meets S four times, not twice', '不是：在 R 的一部分上，竖直线与 S 相交四次而不是两次'),
        t('No: a surface with vertical sides is not allowed', '不是：有竖直侧面的曲面是不允许的'),
        t('Yes, but only when S is a sphere', '是，但只有 S 是球面时才成立'),
      ],
      correct: isSimple ? 0 : 1,
      hint: t(
        'Draw a vertical line through the interior of the shadow and count the points where it meets S. A line along a vertical side is not one of the lines over the interior.',
        '在投影内部画一条竖直线，数它与 S 的交点个数。沿竖直侧面的线不属于投影内部上方的那些线。'
      ),
      explanation: isSimple
        ? t(
            'A vertical line over the interior of the shadow enters the solid through the lower surface and leaves through the upper one: two points. Vertical sides, as on a cylinder, only lie over the boundary of R, so they do not change this. The proof therefore applies.',
            '投影内部的竖直线从下表面进入立体，从上表面离开：两个交点。像圆柱那样的竖直侧面只位于 R 的边界上，不改变这一点。因此证明适用。'
          )
        : t(
            'A vertical line through the middle of the shadow crosses the solid, leaves it, and crosses it again (torus: through both arcs of the wheel; tunnel: through the ceiling and the floor of the tunnel). That is four points, so S is not vertically simple and the proof must first cut D into simple pieces.',
            '穿过投影中间的竖直线进入立体，离开，再进入（环面：穿过车轮的两个弧；隧道：穿过隧道的顶和底）。那是四个交点，所以 S 不是竖直简单的，证明必须先切 D 成简单块。'
          ),
    }),
    g.symbols({
      id: 'lower-setup',
      title: t('Flux through the lower surface: set-up', '下表面的通量：列式'),
      prompt: t(
        `A solid D is bounded below by the paraboloid z = x² + y² and above by the plane z = ${H}. Its shadow R in the xy-plane is the disk x² + y² ≤ ${H}. The field is F = P k with P = ${coef(c3, 'z')}. The lower surface z = g(x, y) = x² + y² is taken with the normal pointing down (away from D). In the proof the flux through the lower surface becomes a double integral over R. Complete it.`,
        `立体 D 的下方是抛物面 z = x² + y²，上方是平面 z = ${H}。它在 xy 平面上的投影 R 是圆盘 x² + y² ≤ ${H}。场为 F = P k，其中 P = ${coef(c3, 'z')}。下表面 z = g(x, y) = x² + y² 取法向量朝下（背离 D）。证明中下表面的通量化为 R 上的二重积分。补全它。`
      ),
      before: t('flux through the lower surface = ', '下表面的通量 = '),
      between: [' ∬_R '],
      after: t(' dx dy', ' dx dy'),
      answers: ['−', `${c3}(x² + y²)`],
      tokens: shuffled(g, ['+', '−', `${c3}(x² + y²)`, `${c3 * H}`, `${c3}z`, `${c3}`]),
      hint: t(
        'On the lower surface z = g(x, y) = x² + y². The notes use dS = ±(−z_x i − z_y j + k) dx dy with the minus sign when the normal points down.',
        '在下表面上 z = g(x, y) = x² + y²。笔记中 dS = ±(−z_x i − z_y j + k) dx dy，法向量朝下时取负号。'
      ),
      explanation: t(
        `With n pointing down, n dS = −(−z_x i − z_y j + k) dx dy, so F · n dS = −P dx dy, and on the lower surface P = ${c3}z = ${c3}(x² + y²). The flux is − ∬_R ${c3}(x² + y²) dx dy. The value ${c3 * H} belongs to the upper plane, and the minus sign comes from the downward normal.`,
        `法向量朝下时 n dS = −(−z_x i − z_y j + k) dx dy，所以 F · n dS = −P dx dy，下表面上 P = ${c3}z = ${c3}(x² + y²)。通量是 − ∬_R ${c3}(x² + y²) dx dy。${c3 * H} 是上方平面上的值，负号来自朝下的法向量。`
      ),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane: the parabola z = x² and the horizontal line z = ${H}; the solid lies between them, and an arrow n points downward at the vertex of the lower surface.`,
          `xz 平面侧视图：抛物线 z = x² 和水平线 z = ${H}；立体在它们之间，下表面顶点处有一个朝下的箭头 n。`
        ),
        view: { xmin: -s - 0.6, xmax: s + 0.6, ymin: -1.3, ymax: H + 0.9 },
        shapes: lowerShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.number({
      id: 'lower-flux',
      title: t('Flux through the lower surface', '下表面的通量'),
      prompt: t(
        `A solid D is bounded below by the paraboloid z = x² + y² and above by the plane z = ${H4}. The field is F = ${coef(c4, 'z')} k. Let S1 be the lower surface (the paraboloid), with the normal pointing down (away from D). The flux of F through S1 equals k·π. Enter k, an integer.`,
        `立体 D 的下方是抛物面 z = x² + y²，上方是平面 z = ${H4}。场为 F = ${coef(c4, 'z')} k。设 S1 为下表面（抛物面），法向量朝下（背离 D）。F 穿过 S1 的通量等于 k·π。求 k，填写整数。`
      ),
      fields: [{ label: t('k', 'k'), answer: k4 }],
      hint: t(
        `Only the k-component of F matters. On S1, F · n dS = −P dx dy with P = ${c4}z and z = x² + y². Integrate over the disk x² + y² ≤ ${H4} in polar coordinates.`,
        `只有 F 的 k 分量起作用。在 S1 上 F · n dS = −P dx dy，P = ${c4}z，z = x² + y²。在圆盘 x² + y² ≤ ${H4} 上用极坐标积分。`
      ),
      explanation: t(
        `F · n dS = −${c4}(x² + y²) dx dy over the disk x² + y² ≤ ${H4}. In polar coordinates ∬ ${c4} r² dA = ${c4}·2π ∫ from 0 to √${H4} of r³ dr = ${c4}·2π·${H4}²/4 = ${c4 * H4 * H4 / 2}π. With the minus sign the flux is −${c4 * H4 * H4 / 2}π, so k = ${num(k4)}. (The upper plane z = ${H4} carries +${c4 * H4 * H4}π upward; the sum ${c4 * H4 * H4 / 2}π is ∭ ${c4} dV, because the volume of D is π·${H4}²/2.)`,
        `在圆盘 x² + y² ≤ ${H4} 上 F · n dS = −${c4}(x² + y²) dx dy。极坐标下 ∬ ${c4} r² dA = ${c4}·2π ∫（r 从 0 到 √${H4}）r³ dr = ${c4}·2π·${H4}²/4 = ${c4 * H4 * H4 / 2}π。加上负号，通量为 −${c4 * H4 * H4 / 2}π，所以 k = ${num(k4)}。（上方平面 z = ${H4} 朝上的通量是 +${c4 * H4 * H4}π；两者之和 ${c4 * H4 * H4 / 2}π 就是 ∭ ${c4} dV，因为 D 的体积是 π·${H4}²/2。）`
      ),
      audit: { kind: 'MIT-MV-57:lower-flux', params: { c: c4, H: H4 } },
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane: the parabola z = x² and the horizontal line z = ${H4}; the solid lies between them, and an arrow n points downward at the vertex of the lower surface.`,
          `xz 平面侧视图：抛物线 z = x² 和水平线 z = ${H4}；立体在它们之间，下表面顶点处有一个朝下的箭头 n。`
        ),
        view: { xmin: -Math.sqrt(H4) - 0.6, xmax: Math.sqrt(H4) + 0.6, ymin: -1.3, ymax: H4 + 0.9 },
        shapes: [
          { kind: 'line', points: graphOf((x: number) => x * x, -Math.sqrt(H4), Math.sqrt(H4)), tone: 'accent', label: 'z = x²', labelAt: [0.82 * Math.sqrt(H4), 0.49 * H4] },
          { kind: 'line', points: [[-Math.sqrt(H4), H4], [Math.sqrt(H4), H4]], tone: 'accent2', label: `z = ${H4}` },
          { kind: 'area', points: [...graphOf((x: number) => x * x, -Math.sqrt(H4), Math.sqrt(H4)), [Math.sqrt(H4), H4], [-Math.sqrt(H4), H4]], tone: 'accent', opacity: 0.25 },
          { kind: 'arrow', from: [0, 0], to: [0, -0.9], tone: 'warn', label: 'n' },
        ],
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.choice({
      id: 'cut-cancel',
      title: t('Why the cut faces disappear', '切面为什么消失'),
      prompt: t(
        `A solid D (${solidEn}) is not simple in all three directions, so it is cut by planes into ${kPieces} pieces ${piecesEn}, each bounded by a closed surface Si that is simple in all three directions. The divergence theorem holds for each piece. Why does adding the ${kPieces} equations give the divergence theorem for D and its surface S?`,
        `实心体 D（${solidZh}）在三个方向上并不都是简单的，于是用平面把它切成 ${kPieces} 块 ${piecesZh}，每块的边界 Si 是在三个方向上都简单的闭曲面。散度定理对每一块都成立。为什么把这 ${kPieces} 个等式相加就得到 D 及其表面 S 的散度定理？`
      ),
      options: [
        t('Each new face appears in two pieces, with opposite normal vectors n, so its surface integrals cancel in the sum and only the integral over S is left.', '每个新增的面属于相邻的两块，在两块中法向量 n 相反，所以它的曲面积分在求和时相互抵消，只剩下 S 上的积分。'),
        t('The flux through a new face is zero because F is parallel to the cut.', '穿过新增面的通量为零，因为 F 与切面平行。'),
        t('The new faces are not part of any Si, so they are never counted.', '新增的面不属于任何 Si，所以根本没有被计入。'),
        t('Cutting D does not change the triple integral, so the surface integrals do not matter.', '切割不改变三重积分，所以曲面积分无关紧要。'),
      ],
      correct: 0,
      hint: t(
        'Look at a face shared by two neighbouring pieces. Which way does n point on it as seen from each piece?',
        '看相邻两块共有的一个面。从这两块各自看，n 指向哪边？'
      ),
      explanation: t(
        `A face shared by two pieces is part of the boundary of both. For the piece on one side n points out of it, so it points into the other piece: the two normals are opposite, and the two surface integrals of F · n over that face add up to 0. After adding the ${kPieces} equations only the faces of the original S remain on the left, and on the right the triple integrals over the pieces add up to ∭_D div F dV. (The flux through a cut face is not zero in general, and the new faces are counted, once from each side.)`,
        `两块共有的面是两块边界的组成部分。对其中一块，n 指向外，即指向另一块内部：两个法向量相反，该面上 F · n 的两个曲面积分相加为 0。相加 ${kPieces} 个等式后，左边只剩原 S 的面，右边各块的三重积分相加为 ∭_D div F dV。（穿过切面的通量一般不为零，且新面被计入，每侧一次。）`
      ),
    }),
    g.choice({
      id: 'pde-name',
      title: t('Name the equation', '给方程命名'),
      prompt: t(
        `A function w satisfies the equation ${eqEn}, where x, y, z are space variables and t is time. Which equation is it?`,
        `函数 w 满足方程 ${eqZh}，其中 x、y、z 是空间变量，t 是时间。这是哪个方程？`
      ),
      options: [
        t('Laplace equation', '拉普拉斯方程'),
        t('Poisson equation', '泊松方程'),
        t('Wave equation', '波方程'),
        t('Heat (diffusion) equation', '热（扩散）方程'),
      ],
      correct: pdeType,
      hint: t(
        'Compare the right-hand side with the four standard equations: zero, a given function of x, y, z, a second t-derivative, a first t-derivative.',
        '把右边与四个标准方程比较：零、关于 x、y、z 的已知函数、t 的二阶导数、t 的一阶导数。'
      ),
      explanation: t(
        pdeType === 0
          ? 'All second space derivatives add up to 0: Laplace\'s equation. Steady temperatures and gravitational potentials in a region without masses satisfy it.'
          : pdeType === 1
            ? `The same left side equals the given function ${kPde}xy of the space variables, not 0: Poisson's equation, for example the steady temperature with heat sources and sinks.`
            : pdeType === 2
              ? 'The right side has the second derivative ∂²w/∂t², so this is the wave equation; c is the speed of the wave. The heat equation has only ∂w/∂t.'
              : 'The right side has only the first derivative ∂w/∂t, so this is the heat equation, also called the diffusion equation: w is the temperature of a rod, or the concentration of a dissolved substance spreading in a tube. The wave equation would have ∂²w/∂t².',
        pdeType === 0
          ? '所有二阶空间导数之和为 0：拉普拉斯方程。无质量区域的稳态温度和引力势满足它。'
          : pdeType === 1
            ? `左边等于空间变量的已知函数 ${kPde}xy，而不是 0：泊松方程，例如有热源和汇的稳态温度。`
            : pdeType === 2
              ? '右边是二阶时间导数 ∂²w/∂t²，所以是波方程；c 是波速。热方程只有 ∂w/∂t。'
              : '右边只有一阶时间导数 ∂w/∂t，所以是热方程，也称扩散方程：w 是杆的温度或溶解物质在管中扩散的浓度。波方程应有 ∂²w/∂t²。'
      ),
    }),
    g.symbols({
      id: 'sphere-bounds',
      title: t('The average over a sphere: set-up', '球面平均值：列式'),
      prompt: t(
        `Let S_R be the sphere of radius ${R7} centered at the origin. The average of u over S_R is A = (1/(4π·${R7}²)) ∬ u dS. In spherical coordinates, with φ measured from the positive z-axis, x = ${R7} sin φ cos θ, y = ${R7} sin φ sin θ, z = ${R7} cos φ and dS = ${R7}² sin φ dφ dθ. The factor ${R7}² cancels. Complete A as an iterated integral.`,
        `设 S_R 是球心在原点、半径为 ${R7} 的球面。u 在 S_R 上的平均值是 A = (1/(4π·${R7}²)) ∬ u dS。在球坐标中，φ 是从正 z 轴量起的角，x = ${R7} sin φ cos θ，y = ${R7} sin φ sin θ，z = ${R7} cos φ，dS = ${R7}² sin φ dφ dθ。因子 ${R7}² 约掉。把 A 写成累次积分并补全。`
      ),
      before: t('A = ', 'A = '),
      between: lang === 'zh' ? [' ×（θ 从 0 到 ', '，φ 从 ', ' 到 '] : [' × (θ from 0 to ', ', φ from ', ' to '],
      after: t(') of u(x, y, z) sin φ dφ dθ', '）u(x, y, z) sin φ 的积分，积分元 dφ dθ'),
      answers: ['1/(4π)', '2π', '0', 'π'],
      tokens: shuffled(g, ['1/(4π)', `1/(${4 * R7 * R7}π)`, '1/(2π)', '0', 'π/2', 'π', '2π']),
      hint: t(
        'The factor R² in dS cancels one factor R² of the constant. The angle φ sweeps from the positive z-axis to the negative z-axis.',
        'dS 中的因子 R² 与前面常数中的 R² 约掉。角 φ 从正 z 轴扫到负 z 轴。'
      ),
      explanation: t(
        `dS = ${R7}² sin φ dφ dθ cancels the ${R7}² in 1/(4π·${R7}²), leaving the constant 1/(4π). The angle θ goes once around from 0 to 2π, and φ, measured from the positive z-axis, goes from 0 (the north pole) to π (the south pole).`,
        `dS = ${R7}² sin φ dφ dθ 与 1/(4π·${R7}²) 中的 ${R7}² 约掉，剩下常数 1/(4π)。角 θ 绕一圈，从 0 到 2π；φ 从正 z 轴量起，从 0（北极）到 π（南极）。`
      ),
      figure: g.figure({
        alt: t(
          `A sphere of radius ${R7} about the origin with an arrow from the center to a point of the sphere.`,
          `以原点为中心、半径为 ${R7} 的球面，以及从球心指向球面上一点的箭头。`
        ),
        view: fitView(sphere57Shapes, 0.25),
        shapes: sphere57Shapes,
      }),
    }),
    g.number({
      id: 'non-harmonic',
      title: t('An average that is not the center value', '不等于中心值的平均'),
      prompt: t(
        `Let u(x, y, z) = ${coef(a8, 'x')}² + ${coef(b8, 'y')}² + ${coef(c8, 'z')}² ${term(d8)} and let S be the sphere of radius ${R8} centered at the origin. Find the average value A of u over S, A = (1/(4π·${R8}²)) ∬_S u dS. Enter an integer.`,
        `设 u(x, y, z) = ${coef(a8, 'x')}² + ${coef(b8, 'y')}² + ${coef(c8, 'z')}² ${term(d8)}，S 是球心在原点、半径为 ${R8} 的球面。求 u 在 S 上的平均值 A = (1/(4π·${R8}²)) ∬_S u dS。填写整数。`
      ),
      fields: [{ label: t('A', 'A'), answer: ans8 }],
      hint: t(
        `On S, x² + y² + z² = ${R8}², and the sphere treats x, y and z alike. What is the average of x² over S?`,
        `在 S 上 x² + y² + z² = ${R8}²，球面对 x、y、z 一视同仁。x² 在 S 上的平均值是多少？`
      ),
      explanation: t(
        `By symmetry the averages of x², y² and z² over S are equal, and they add up to the average of x² + y² + z² = ${R8}², which is ${R8 * R8}. Each is ${R8 * R8}/3. So A = (${a8} + ${b8} + ${c8})·${R8 * R8}/3 ${term(d8)} = ${a8 + b8 + c8}·${R8 * R8}/3 ${term(d8)} = ${num(ans8)}. This is not u(0, 0, 0) = ${num(d8)}: here u_xx + u_yy + u_zz = 2(${a8} + ${b8} + ${c8}) = ${2 * (a8 + b8 + c8)} is not 0, so u is not harmonic, and the center value is the average only for harmonic functions.`,
        `由对称性，x²、y²、z² 在 S 上的平均值相等，它们的和是 x² + y² + z² = ${R8}² 的平均值，即 ${R8 * R8}，所以每个是 ${R8 * R8}/3。于是 A = (${a8} + ${b8} + ${c8})·${R8 * R8}/3 ${term(d8)} = ${a8 + b8 + c8}·${R8 * R8}/3 ${term(d8)} = ${num(ans8)}。它不等于 u(0, 0, 0) = ${num(d8)}：这里 u_xx + u_yy + u_zz = 2(${a8} + ${b8} + ${c8}) = ${2 * (a8 + b8 + c8)} 不为 0，u 不是调和函数，只有调和函数的球面平均值才等于中心值。`
      ),
      audit: { kind: 'MIT-MV-57:non-harmonic', params: { a: a8, b: b8, c: c8, d: d8, R: R8 } },
    }),
    g.number({
      id: 'challenge',
      title: t('Average of a polynomial over a sphere', '多项式在球面上的平均值'),
      prompt: t(
        `Let u(x, y, z) = (x + ${p9})(y + ${q9}) + ${coef(c9, '')}(z² − x²). Find the average value of u over the sphere of radius ${R9} centered at the origin. Enter an integer.`,
        `设 u(x, y, z) = (x + ${p9})(y + ${q9}) + ${coef(c9, '')}(z² − x²)。求 u 在球心为原点、半径为 ${R9} 的球面上的平均值。填写整数。`
      ),
      fields: [{ label: t('A', 'A'), answer: ans9 }],
      hint: t(
        'Compute u_xx + u_yy + u_zz. What does its value tell you about the average over a sphere centered at the origin?',
        '算出 u_xx + u_yy + u_zz。它的值对球心在原点的球面平均值意味着什么？'
      ),
      explanation: t(
        `u_xx = −${2 * c9}, u_yy = 0, u_zz = ${2 * c9}, so u_xx + u_yy + u_zz = 0: u is harmonic. The average of a harmonic function over any sphere centered at the origin is its value at the center: u(0, 0, 0) = ${p9}·${q9} + ${c9 === 1 ? '' : c9}(0 − 0) = ${num(ans9)}, whatever the radius ${R9}. This game does not ask you to carry out the proof for all three components or for general regions, to derive the partial differential equations, or to solve them.`,
        `u_xx = −${2 * c9}，u_yy = 0，u_zz = ${2 * c9}，所以 u_xx + u_yy + u_zz = 0：u 是调和函数。调和函数在任何球心位于原点的球面上的平均值等于它在球心的值：u(0, 0, 0) = ${p9}·${q9} + ${c9 === 1 ? '' : c9}(0 − 0) = ${num(ans9)}，与半径 ${R9} 无关。本游戏不要求对三个分量或一般区域完成证明，不要求推导偏微分方程，也不要求求解它们。`
      ),
      audit: { kind: 'MIT-MV-57:challenge', params: { p: p9, q: q9, c: c9, R: R9 } },
    }),
  ];
};
