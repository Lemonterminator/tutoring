import type { CardGenerator } from '../../types';
import { ellipse, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, frac, gcd, makeMvDeck, num, par, type Text } from '../support';
/** n/d times π, written as π, 3π, 14π/3 (never 1π or 14/3π). */
const fracPi = (n: number, d: number): string => { const g = gcd(n, d); const p = n / g, q = d / g; const top = p === 1 ? 'π' : p === -1 ? '−π' : `${num(p)}π`; return q === 1 ? top : `${top}/${q}`; };


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

function fmtAngle(n: number, d: number): string {
  if (n === 0) return '0';
  const numStr = n === 1 ? '' : String(n);
  if (d === 1) return `${numStr}π`;
  return `${numStr}π/${d}`;
}

/** Exact text of q or q·√2 with rational q of denominator up to 4: 0, 3/2, −1, √2, 3√2/2, −√2/2 (never a decimal). */
function fmtExact(val: number): string {
  if (Math.abs(val) < 1e-12) return '0';
  const rat = (v: number): [number, number] | null => { for (let q = 1; q <= 4; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-9) return [p, q]; } return null; };
  const plain = rat(val);
  if (plain) return frac(plain[0], plain[1]);
  const root = rat(val / Math.SQRT2);
  if (root) { const [p, q] = root; const top = p === 1 ? '√2' : p === -1 ? '−√2' : `${num(p)}√2`; return q === 1 ? top : `${top}/${q}`; }
  return num(val);
}
/** Values that are exactly zero in exact arithmetic are stored as 0, not 1.2e-16. */
const snap = (v: number) => Math.abs(v) < 1e-12 ? 0 : v;

export const mv52: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-52');
  warm(g);

  const a1 = g.pick([2, 3, 4]);
  const phiOpts = [{ n: 1, d: 4 }, { n: 1, d: 2 }, { n: 3, d: 4 }];
  const phi1 = g.pick(phiOpts);
  const thetaOpts = [
    { n: 0, d: 1 }, { n: 1, d: 4 }, { n: 1, d: 2 }, { n: 3, d: 4 },
    { n: 1, d: 1 }, { n: 5, d: 4 }, { n: 3, d: 2 }, { n: 7, d: 4 }
  ];
  const theta1 = g.pick(thetaOpts);

  const phi1Val = phi1.n * Math.PI / phi1.d;
  const theta1Val = theta1.n * Math.PI / theta1.d;
  const x1 = snap(a1 * Math.sin(phi1Val) * Math.cos(theta1Val));
  const y1 = snap(a1 * Math.sin(phi1Val) * Math.sin(theta1Val));
  const z1 = snap(a1 * Math.cos(phi1Val));

  const a2 = g.random(1, 5);
  const sx = g.pick([-1, 1]);
  const sy = g.pick([-1, 1]);
  const sz = g.pick([-1, 0, 1]);
  const px = sx * a2;
  const py = sy * a2;
  const pz = sz * a2 * Math.SQRT2;

  const rho2 = Math.sqrt(px * px + py * py + pz * pz);
  const phi2 = Math.acos(pz / rho2);
  let theta2 = Math.atan2(py, px);
  if (theta2 < 0) theta2 += 2 * Math.PI;

  const c = g.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
  const phiP = c > 0 ? '0' : 'π';

  const R = g.random(1, 6);
  const a3 = g.random(1, 6);

  const a4 = g.pick([2, 3, 4, 6]);
  const alphaN = g.pick([1, 2]);
  const alpha = alphaN * Math.PI / 3;

  const cosAlpha = Math.cos(alpha);
  const kVol = (2 / 3) * Math.pow(a4, 3) * (1 - cosAlpha);

  const zCentroid = (3 * a4 / 8) * (1 + cosAlpha);

  const Rc = g.pick([3, 4, 5, 6]);
  const dc = g.random(1, Rc - 1);
  const kCap = Math.pow(Rc - dc, 2) * (2 * Rc + dc) / 3;
  const poleWording = g.pick(['A', 'B']);

  const circleShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(R, 0, R), tone: 'accent' },
    { kind: 'line', points: [[-0.6 * R, 0], [2.6 * R, 0]], tone: 'axis' },
    { kind: 'line', points: [[0, -1.6 * R], [0, 1.6 * R]], tone: 'axis' },
    { kind: 'point', at: [0, 0], label: 'O' },
    { kind: 'point', at: [1.5 * R, R * Math.sqrt(3) / 2], label: 'P' },
    { kind: 'line', points: [[0, 0], [1.5 * R, R * Math.sqrt(3) / 2]], tone: 'warn', label: 'ρ' },
    { kind: 'text', at: [0.2 * R, 0.5 * R], text: 'φ' }
  ];
  const circleView = { xmin: -0.6 * R, xmax: 2.6 * R, ymin: -1.6 * R, ymax: 1.6 * R };

  const capRadius = a3 * Math.SQRT2;
  const capArc: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI / 4 + (i / 24) * (Math.PI / 2);
    capArc.push([capRadius * Math.cos(t), capRadius * Math.sin(t)]);
  }
  const capShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, capRadius), tone: 'muted' },
    { kind: 'area', points: capArc, tone: 'accent', opacity: 0.35 },
    { kind: 'line', points: [[-1.5 * a3, a3], [1.5 * a3, a3]], tone: 'accent2', label: `z = ${a3}` },
    { kind: 'line', points: [[-1.8 * a3, 0], [1.8 * a3, 0]], tone: 'axis' },
    { kind: 'line', points: [[0, -1.8 * a3], [0, 1.8 * a3]], tone: 'axis' },
    { kind: 'point', at: [0, 0], label: 'O' },
    { kind: 'line', points: [[0, 0], [capRadius * Math.sin(Math.PI / 6), capRadius * Math.cos(Math.PI / 6)]], tone: 'warn' },
    { kind: 'point', at: [a3 * Math.tan(Math.PI / 6), a3], label: g.t(['in', '入']) },
    { kind: 'point', at: [capRadius * Math.sin(Math.PI / 6), capRadius * Math.cos(Math.PI / 6)], label: g.t(['out', '出']) },
  ];
  const capView = { xmin: -1.8 * a3, xmax: 1.8 * a3, ymin: -1.8 * a3, ymax: 1.8 * a3 };

  const coneArc: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = -alpha + (i / 24) * (2 * alpha);
    coneArc.push([a4 * Math.sin(t), a4 * Math.cos(t)]);
  }
  const coneShapes: FigureShape[] = [
    { kind: 'area', points: [[0, 0], ...coneArc], tone: 'accent', opacity: 0.3 },
    { kind: 'line', points: ellipse(0, 0, a4), tone: 'muted' },
    { kind: 'line', points: [[0, 0], [a4 * Math.sin(alpha), a4 * Math.cos(alpha)]], tone: 'accent2' },
    { kind: 'line', points: [[0, 0], [-a4 * Math.sin(alpha), a4 * Math.cos(alpha)]], tone: 'accent2' },
    { kind: 'line', points: [[0, -1.2 * a4], [0, 1.2 * a4]], tone: 'axis' },
    { kind: 'text', at: [a4 * 0.8, a4 * 0.8], text: `ρ = ${a4}` }
  ];
  const coneView = { xmin: -1.3 * a4, xmax: 1.3 * a4, ymin: -1.3 * a4, ymax: 1.3 * a4 };

  const phi1Str = fmtAngle(phi1.n, phi1.d);
  const theta1Str = fmtAngle(theta1.n, theta1.d);

  const x1Str = fmtExact(x1);
  const y1Str = fmtExact(y1);
  const z1Str = fmtExact(z1);
  const r1Str = fmtExact(a1 * Math.sin(phi1Val));

  const pxStr = num(px);
  const pyStr = num(py);
  const pzStr = sz === 0 ? '0' : (sz === 1 ? (a2 === 1 ? '√2' : `${a2}√2`) : (a2 === 1 ? '−√2' : `−${a2}√2`));

  const rho2Str = fmtExact(rho2);
  const phi2Exact = sz === 0 ? 'π/2' : sz === 1 ? 'π/4' : '3π/4';
  const theta2Exact = px > 0 && py > 0 ? 'π/4' : (px < 0 && py > 0 ? '3π/4' : (px < 0 && py < 0 ? '5π/4' : '7π/4'));

  const quadrantEN = px > 0 && py > 0 ? 'first' : (px < 0 && py > 0 ? 'second' : (px < 0 && py < 0 ? 'third' : 'fourth'));
  const quadrantZH = px > 0 && py > 0 ? '第一' : (px < 0 && py > 0 ? '第二' : (px < 0 && py < 0 ? '第三' : '第四'));

  const alphaStr = alphaN === 1 ? 'π/3' : '2π/3';
  const cosAlphaStr = alphaN === 1 ? '1/2' : '−1/2';
  const oneMinusCosStr = alphaN === 1 ? '1/2' : '3/2';
  const kVolExact = alphaN === 1 ? frac(Math.pow(a4, 3), 3) : num(Math.pow(a4, 3));

  const zCentroidExact = alphaN === 1 ? frac(9 * a4, 16) : frac(3 * a4, 16);
  const MPi = fracPi(3 * Math.pow(a4, 4), 16);
  const kVolPi = alphaN === 1 ? fracPi(Math.pow(a4, 3), 3) : fracPi(Math.pow(a4, 3), 1);

  const kCapNum = Math.round(kCap * 3);
  const kCapDen = 3;
  const kCapStr = frac(kCapNum, kCapDen);

  const cosPhiStr = sz === 0 ? '0' : (sz === 1 ? '√2/2' : '−√2/2');
  const pxSq = `${par(px)}²`;
  const pySq = `${par(py)}²`;
  const pzSq = sz === 0 ? '0²' : `(${pzStr})²`;
  const rhoParen = /\d√/.test(rho2Str) ? `(${rho2Str})` : rho2Str;

  return [
    g.number({
      id: 'to-cartesian',
      title: t('Spherical to Cartesian', '球坐标化直角坐标'),
      prompt: t(
        `A point P has spherical coordinates ρ = ${a1}, φ = ${phi1Str}, θ = ${theta1Str}. Here φ is measured from the positive z-axis (0 ≤ φ ≤ π), and θ is the angle of the projection of P on the xy-plane, measured from the positive x-axis. Find the Cartesian coordinates of P. Give exact values, for example 7/2 or 5sqrt(2)/2.`,
        `点 P 的球坐标为 ρ = ${a1}，φ = ${phi1Str}，θ = ${theta1Str}。这里 φ 是从正 z 轴量起的角（0 ≤ φ ≤ π），θ 是 P 在 xy 平面上的投影从正 x 轴量起的角。求 P 的直角坐标。写出精确值，例如 7/2 或 5sqrt(2)/2。`
      ),
      fields: [
        { label: t('x', 'x'), answer: x1 },
        { label: t('y', 'y'), answer: y1 },
        { label: t('z', 'z'), answer: z1 }
      ],
      hint: t(
        'The distance of P from the z-axis is r = ρ sin φ, so x = r cos θ and y = r sin θ; the height is z = ρ cos φ.',
        'P 到 z 轴的距离是 r = ρ sin φ，所以 x = r cos θ，y = r sin θ；高度是 z = ρ cos φ。'
      ),
      explanation: t(
        `z = ρ cos φ = ${a1} cos(${phi1Str}) = ${z1Str}. The distance from the z-axis is r = ρ sin φ = ${r1Str}. So x = r cos(${theta1Str}) = ${x1Str} and y = r sin(${theta1Str}) = ${y1Str}.`,
        `z = ρ cos φ = ${a1} cos(${phi1Str}) = ${z1Str}。到 z 轴的距离是 r = ρ sin φ = ${r1Str}。所以 x = r cos(${theta1Str}) = ${x1Str}，y = r sin(${theta1Str}) = ${y1Str}。`
      ),
      audit: { kind: 'MIT-MV-52:to-cartesian', params: { a: a1, phiN: phi1.n, phiD: phi1.d, thN: theta1.n, thD: theta1.d } }
    }),
    g.number({
      id: 'to-spherical',
      title: t('Cartesian to spherical', '直角坐标化球坐标'),
      prompt: t(
        `Find the spherical coordinates (ρ, φ, θ) of the point P = (${pxStr}, ${pyStr}, ${pzStr}), with ρ ≥ 0, 0 ≤ φ ≤ π (φ measured from the positive z-axis) and 0 ≤ θ ≤ 2π (θ measured from the positive x-axis to the projection of P on the xy-plane). Give exact values; write angles as multiples of pi, for example 2pi/3.`,
        `求点 P = (${pxStr}, ${pyStr}, ${pzStr}) 的球坐标 (ρ, φ, θ)，其中 ρ ≥ 0，0 ≤ φ ≤ π（φ 是从正 z 轴量起的角），0 ≤ θ ≤ 2π（θ 是从正 x 轴量到 P 在 xy 平面上投影的角）。写出精确值；角写成 pi 的倍数，例如 2pi/3。`
      ),
      fields: [
        { label: t('ρ', 'ρ'), answer: rho2 },
        { label: t('φ', 'φ'), answer: phi2 },
        { label: t('θ', 'θ'), answer: theta2 }
      ],
      hint: t(
        'ρ = √(x² + y² + z²) and cos φ = z/ρ. For θ look at the quadrant of (x, y): tan⁻¹(y/x) alone cannot tell (−3, −3) from (3, 3).',
        'ρ = √(x² + y² + z²)，cos φ = z/ρ。θ 要看 (x, y) 所在的象限：只用 tan⁻¹(y/x) 分不清 (−3, −3) 和 (3, 3)。'
      ),
      explanation: t(
        `ρ = √(${pxSq} + ${pySq} + ${pzSq}) = ${rho2Str}. cos φ = ${sz === 0 ? '0' : pzStr}/${rhoParen} = ${cosPhiStr}, so φ = ${phi2Exact}. The point (x, y) = (${pxStr}, ${pyStr}) is in the ${quadrantEN} quadrant, where θ = ${theta2Exact}.`,
        `ρ = √(${pxSq} + ${pySq} + ${pzSq}) = ${rho2Str}。cos φ = ${sz === 0 ? '0' : pzStr}/${rhoParen} = ${cosPhiStr}，所以 φ = ${phi2Exact}。点 (x, y) = (${pxStr}, ${pyStr}) 在${quadrantZH}象限，θ = ${theta2Exact}。`
      ),
      audit: { kind: 'MIT-MV-52:to-spherical', params: { a: a2, sx: sx, sy: sy, sz: sz } }
    }),
    g.choice({
      id: 'pole-choice',
      title: t('A point on the z-axis', 'z 轴上的点'),
      prompt: t(
        `The point P = (0, 0, ${num(c)}) lies on the z-axis. In spherical coordinates ρ = ${Math.abs(c)} and φ = ${phiP} (φ is measured from the positive z-axis). The formula θ = tan⁻¹(y/x) is used to find θ. ${poleWording === 'A' ? 'What is true for θ at P?' : 'Which statement about θ is correct?'}`,
        `点 P = (0, 0, ${num(c)}) 在 z 轴上。它的球坐标中 ρ = ${Math.abs(c)}，φ = ${phiP}（φ 是从正 z 轴量起的角）。用公式 θ = tan⁻¹(y/x) 求 θ。${poleWording === 'A' ? '关于 P 处的 θ，下面哪个说法正确？' : '下面哪个关于 θ 的说法正确？'}`
      ),
      options: [
        t('Any θ works: P is on the z-axis, so the point does not determine θ.', '任何 θ 都可以：P 在 z 轴上，所以这个点并不确定 θ。'),
        t('θ = 0, since the ratio y/x is 0 and tan⁻¹(0) = 0, as for every point on the x-axis.', 'θ = 0，因为比值 y/x 为 0，tan⁻¹(0) = 0，和 x 轴上的点一样。'),
        t('θ = π/2, because the z-axis is perpendicular to the x-axis, just as for the point (0, 1, 0).', 'θ = π/2，因为 z 轴与 x 轴垂直，和点 (0, 1, 0) 一样。'),
        t('None: since θ cannot be computed, P has no spherical coordinates at all.', '没有：θ 无定义，所以 P 根本没有球坐标。')
      ],
      correct: 0,
      hint: t('What are x and y at P? Try to form y/x.', 'P 处的 x 和 y 是多少？试着算 y/x。'),
      explanation: t(
        `At P = (0, 0, ${num(c)}) we have x = y = 0, so y/x = 0/0 has no value. The point is on the z-axis, where all the half-planes θ = constant meet, so every value of θ describes the same point: θ can be anything. P still has ρ = ${Math.abs(c)} and φ = ${phiP}.`,
        `在 P = (0, 0, ${num(c)}) 处 x = y = 0，所以 y/x = 0/0 没有意义。该点在 z 轴上，所有 θ = 常数 的半平面都相交于此，因此任何 θ 都给出同一个点：θ 可以取任意值。P 的 ρ = ${Math.abs(c)}，φ = ${phiP} 仍然确定。`
      )
    }),
    g.choice({
      id: 'circle-surface',
      title: t('A rotated circle', '旋转得到的曲面'),
      prompt: t(
        `In the yz-plane, the circle of radius ${R} with centre at y = ${R}, z = 0 passes through the origin. Rotate it about the z-axis. Which equation, in spherical coordinates (φ measured from the positive z-axis), describes the surface formed?`,
        `在 yz 平面内，半径为 ${R}、圆心在 y = ${R}，z = 0 的圆经过原点。把它绕 z 轴旋转。用球坐标（φ 是从正 z 轴量起的角）表示，所得曲面的方程是哪一个？`
      ),
      options: [
        t(`ρ = ${2 * R} sin φ`, `ρ = ${2 * R} sin φ`),
        t(`ρ = ${R === 1 ? 'sin φ' : `${R} sin φ`}`, `ρ = ${R === 1 ? 'sin φ' : `${R} sin φ`}`),
        t(`ρ = ${2 * R} cos φ`, `ρ = ${2 * R} cos φ`),
        t(`ρ = ${R}`, `ρ = ${R}`)
      ],
      correct: 0,
      hint: t(
        'Look at the right triangle formed by the origin O, the point of the circle on the y-axis and a point P of the circle: the angle at P is a right angle. Express OP with the diameter and an angle.',
        '看原点 O、圆上在 y 轴上的点和圆上任一点 P 构成的直角三角形：P 处是直角。用直径和一个角表示 OP。'
      ),
      explanation: t(
        `The diameter of the circle on the y-axis has length ${2 * R}. For a point P of the circle the angle at O between OP and that diameter is π/2 − φ, and the angle at P is a right angle, so ρ = OP = ${2 * R} cos(π/2 − φ) = ${2 * R} sin φ. Rotating about the z-axis changes only θ, so ρ = ${2 * R} sin φ describes the whole surface.`,
        `圆在 y 轴上的直径长为 ${2 * R}。对圆上一点 P，OP 与该直径在 O 处的夹角是 π/2 − φ，P 处是直角，所以 ρ = OP = ${2 * R} cos(π/2 − φ) = ${2 * R} sin φ。绕 z 轴旋转只改变 θ，所以 ρ = ${2 * R} sin φ 描述整个曲面。`
      ),
      figure: g.figure({
        alt: t(
          `The yz-plane with the circle of radius ${R} centred at y = ${R}; a point P of the circle is joined to the origin by a segment ρ, and φ is the angle between that segment and the z-axis.`,
          `yz 平面内半径为 ${R}、圆心在 y = ${R} 的圆；圆上一点 P 与原点相连的线段记为 ρ，φ 是该线段与 z 轴的夹角。`
        ),
        view: circleView,
        shapes: circleShapes,
        axes: { xLabel: 'y', yLabel: 'z', grid: false }
      })
    }),
    g.symbols({
      id: 'cap-limits',
      title: t('Limits for a cap', '球冠的积分限'),
      prompt: t(
        `A solid sphere of radius ${a3 === 1 ? '√2' : `${a3}√2`} is cut by the plane z = ${a3}. Take the cap above the plane, the part with z ≥ ${a3}. Complete the limits of its volume integral in spherical coordinates (φ is measured from the positive z-axis).`,
        `半径为 ${a3 === 1 ? '√2' : `${a3}√2`} 的实心球被平面 z = ${a3} 截开。取平面上方的球冠，即 z ≥ ${a3} 的部分。补全它在球坐标下的体积分的积分限（φ 是从正 z 轴量起的角）。`
      ),
      before: t('V = ∫ over θ from 0 to 2π, over φ from ', 'V = ∫（θ 从 0 到 2π，φ 从 '),
      between: [g.t([' to ', ' 到 ']), g.t([', over ρ from ', '，ρ 从 ']), g.t([' to ', ' 到 '])],
      after: t(' of ρ² sin φ dρ dφ dθ', '，被积函数 ρ² sin φ，积分顺序 dρ、dφ、dθ）'),
      answers: ['0', 'π/4', `${a3}/cos φ`, a3 === 1 ? '√2' : `${a3}√2`],
      tokens: shuffled(g, ['0', 'π/4', 'π/3', 'π/2', `${a3}/cos φ`, a3 === 1 ? 'cos φ' : `${a3} cos φ`, `${a3}`, a3 === 1 ? '√2' : `${a3}√2`]),
      hint: t(
        `A ray from the origin enters the cap through the flat face z = ${a3}, where ρ cos φ = ${a3}, and leaves through the sphere. The rays that meet the cap are those up to the circle where the plane cuts the sphere.`,
        `从原点出发的射线从平面 z = ${a3} 进入球冠，此处 ρ cos φ = ${a3}，再从球面离开。与球冠相交的射线直到平面与球面的交线为止。`
      ),
      explanation: t(
        `On the plane z = ${a3}: ρ cos φ = ${a3}, so the ray enters at ρ = ${a3}/cos φ. It leaves on the sphere ρ = ${a3 === 1 ? '√2' : `${a3}√2`}. The plane meets the sphere where ${a3}/cos φ = ${a3 === 1 ? '√2' : `${a3}√2`}, that is cos φ = 1/√2, so φ runs from 0 to π/4.`,
        `在平面 z = ${a3} 上 ρ cos φ = ${a3}，所以射线在 ρ = ${a3}/cos φ 处进入，在球面 ρ = ${a3 === 1 ? '√2' : `${a3}√2`} 处离开。平面与球面相交处 ${a3}/cos φ = ${a3 === 1 ? '√2' : `${a3}√2`}，即 cos φ = 1/√2，所以 φ 从 0 到 π/4。`
      ),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane: a circle of radius ${a3 === 1 ? '√2' : `${a3}√2`} around the origin, the horizontal line z = ${a3}, the cap above it shaded, and one ray from the origin that enters the cap at the line and leaves it on the circle.`,
          `xz 平面内的侧视图：以原点为圆心、半径为 ${a3 === 1 ? '√2' : `${a3}√2`} 的圆，水平线 z = ${a3}，线上方的球冠涂上阴影，一条从原点出发的射线在水平线处进入球冠，在圆上离开。`
        ),
        view: capView,
        shapes: capShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: false }
      })
    }),
    g.symbols({
      id: 'cone-setup',
      title: t('Limits and integrand for a cone', '圆锥的积分限与被积函数'),
      prompt: t(
        `D is the solid inside the sphere ρ = ${a4} and inside the cone φ = ${alphaStr}, that is, all points with ρ ≤ ${a4} and φ ≤ ${alphaStr} (φ is measured from the positive z-axis). Complete the integral for the volume of D.`,
        `D 是球面 ρ = ${a4} 之内、圆锥面 φ = ${alphaStr} 之内的立体，即满足 ρ ≤ ${a4} 且 φ ≤ ${alphaStr} 的所有点（φ 是从正 z 轴量起的角）。补全 D 的体积的积分。`
      ),
      before: t('V = ∫ over θ from 0 to ', 'V = ∫（θ 从 0 到 '),
      between: [g.t([', over φ from 0 to ', '，φ 从 0 到 ']), g.t([', over ρ from 0 to ', '，ρ 从 0 到 ']), g.t([' of ', '，被积函数 '])],
      after: t(' dρ dφ dθ', '，积分顺序 dρ、dφ、dθ）'),
      answers: ['2π', alphaStr, String(a4), 'ρ² sin φ'],
      tokens: shuffled(g, ['π', '2π', 'π/3', '2π/3', String(a4), 'ρ² sin φ', 'ρ sin φ', 'ρ²', 'ρ² cos φ']),
      hint: t(
        'Let ρ run from 0 to the sphere, φ from the z-axis out to the cone, and θ once around. Do not forget the spherical volume element.',
        'ρ 从 0 取到球面，φ 从 z 轴取到圆锥面，θ 转一圈。不要忘了球坐标的体积元。'
      ),
      explanation: t(
        `A ray from the origin stays in D from ρ = 0 to the sphere ρ = ${a4}. The rays in D are those with φ from 0 to the cone φ = ${alphaStr}, and θ goes once around, from 0 to 2π. The integrand is the volume element ρ² sin φ; without it the integral would not measure volume.`,
        `从原点出发的射线在 D 中从 ρ = 0 到球面 ρ = ${a4}。D 中的射线是 φ 从 0 到圆锥面 φ = ${alphaStr} 的那些，θ 转一圈，从 0 到 2π。被积函数是体积元 ρ² sin φ；没有它，积分就不是体积。`
      ),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane of the part of the ball of radius ${a4} inside the cone φ = ${alphaStr}; the shaded region is turned around the z-axis.`,
          `xz 平面内的侧视图：半径为 ${a4} 的球中位于圆锥面 φ = ${alphaStr} 之内的部分，阴影区域绕 z 轴旋转。`
        ),
        view: coneView,
        shapes: coneShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: false }
      })
    }),
    g.number({
      id: 'cone-volume',
      title: t('Volume of the cone region', '圆锥区域的体积'),
      prompt: t(
        `Find the volume of D, the solid with ρ ≤ ${a4} and φ ≤ ${alphaStr} (φ is measured from the positive z-axis). The volume is kπ; enter k as an integer or a fraction.`,
        `求 D 的体积，D 是满足 ρ ≤ ${a4} 且 φ ≤ ${alphaStr} 的立体（φ 是从正 z 轴量起的角）。体积为 kπ；填写 k（整数或分数）。`
      ),
      fields: [{ label: t('k', 'k'), answer: kVol }],
      hint: t(
        'The three integrals separate: ∫ρ² dρ, ∫sin φ dφ and ∫dθ.',
        '三个积分可以分开：∫ρ² dρ、∫sin φ dφ 和 ∫dθ。'
      ),
      explanation: t(
        `V = ∫ dθ · ∫ sin φ dφ · ∫ ρ² dρ = 2π · (1 − cos(${alphaStr})) · ${a4}³/3. Here cos(${alphaStr}) = ${cosAlphaStr}, so 1 − cos(${alphaStr}) = ${oneMinusCosStr}, and V = 2π · ${oneMinusCosStr} · ${Math.pow(a4, 3)}/3 = ${kVolPi}, so k = ${kVolExact}.`,
        `V = ∫ dθ · ∫ sin φ dφ · ∫ ρ² dρ = 2π · (1 − cos(${alphaStr})) · ${a4}³/3。这里 cos(${alphaStr}) = ${cosAlphaStr}，所以 1 − cos(${alphaStr}) = ${oneMinusCosStr}，V = 2π · ${oneMinusCosStr} · ${Math.pow(a4, 3)}/3 = ${kVolPi}，k = ${kVolExact}。`
      ),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane of the part of the ball of radius ${a4} inside the cone φ = ${alphaStr}; the shaded region is turned around the z-axis.`,
          `xz 平面内的侧视图：半径为 ${a4} 的球中位于圆锥面 φ = ${alphaStr} 之内的部分，阴影区域绕 z 轴旋转。`
        ),
        view: coneView,
        shapes: coneShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: false }
      }),
      audit: { kind: 'MIT-MV-52:cone-volume', params: { a: a4, alphaN: alphaN } }
    }),
    g.number({
      id: 'cone-centroid',
      title: t('Centroid of the cone region', '圆锥区域的质心'),
      prompt: t(
        `By symmetry the centroid of D (the solid with ρ ≤ ${a4} and φ ≤ ${alphaStr}; φ is measured from the positive z-axis) lies on the z-axis. Find its z-coordinate z̄ = (1/V) ∭ z dV. Enter an integer or a fraction.`,
        `由对称性，D（满足 ρ ≤ ${a4} 且 φ ≤ ${alphaStr} 的立体；φ 是从正 z 轴量起的角）的质心在 z 轴上。求它的 z 坐标 z̄ = (1/V) ∭ z dV。填写整数或分数。`
      ),
      fields: [{ label: t('z̄', 'z̄'), answer: zCentroid }],
      hint: t(
        `Write z = ρ cos φ. Then ∭ z dV = ∫ρ³ dρ · ∫ cos φ sin φ dφ · ∫ dθ, and the volume is V = ${kVolPi}.`,
        `取 z = ρ cos φ。则 ∭ z dV = ∫ρ³ dρ · ∫ cos φ sin φ dφ · ∫ dθ，体积是 V = ${kVolPi}。`
      ),
      explanation: t(
        `∭ z dV = 2π · (sin²(${alphaStr})/2) · ${a4}⁴/4 = ${MPi}, because sin²(${alphaStr}) = 3/4. Dividing by V = ${kVolPi} gives z̄ = ${zCentroidExact}.`,
        `∭ z dV = 2π · (sin²(${alphaStr})/2) · ${a4}⁴/4 = ${MPi}，因为 sin²(${alphaStr}) = 3/4。除以 V = ${kVolPi} 得 z̄ = ${zCentroidExact}。`
      ),
      audit: { kind: 'MIT-MV-52:cone-centroid', params: { a: a4, alphaN: alphaN } }
    }),
    g.number({
      id: 'challenge',
      title: t('Volume of a spherical cap', '球冠的体积'),
      prompt: t(
        `A solid ball of radius ${Rc} is centred at the origin and is cut by the plane z = ${dc}. Find the volume of the cap above the plane, the part of the ball with z ≥ ${dc}. The volume is kπ; enter k as an integer or a fraction.`,
        `半径为 ${Rc} 的实心球以原点为球心，被平面 z = ${dc} 截开。求平面上方的球冠，即球中满足 z ≥ ${dc} 的部分的体积。体积为 kπ；填写 k（整数或分数）。`
      ),
      fields: [{ label: t('k', 'k'), answer: kCap }],
      hint: t(
        'Any method works. With R the radius of the ball and d the height of the plane, the cap in spherical coordinates is d/cos φ ≤ ρ ≤ R; or slice the ball at height z, where the cross-section is a disk.',
        '任何方法都可以。设 R 为球的半径、d 为平面的高度，在球坐标下球冠是 d/cos φ ≤ ρ ≤ R；也可以在高度 z 处切片，截面是圆盘。'
      ),
      explanation: t(
        `At height z the cross-section is a disk whose radius squared is ${Rc}² − z², so V = ∫ from z = ${dc} to ${Rc} of π(${Rc}² − z²) dz = π(${Rc}²·(${Rc} − ${dc}) − (${Rc}³ − ${dc}³)/3) = π(${Rc * Rc * (Rc - dc)} − ${frac(Rc ** 3 - dc ** 3, 3)}) = ${fracPi(kCapNum, kCapDen)}. This game does not ask you to derive the volume element ρ² sin φ from the Jacobian determinant, and it does not cover regions whose boundaries are not spheres, cones, planes or the rotated circle of the notes.`,
        `在高度 z 处截面是半径平方为 ${Rc}² − z² 的圆盘，所以 V = ∫ π(${Rc}² − z²) dz（z 从 ${dc} 到 ${Rc}）= π(${Rc}²·(${Rc} − ${dc}) − (${Rc}³ − ${dc}³)/3) = π(${Rc * Rc * (Rc - dc)} − ${frac(Rc ** 3 - dc ** 3, 3)}) = ${fracPi(kCapNum, kCapDen)}。本游戏不要求用雅可比行列式推导体积元 ρ² sin φ，也不涉及边界不是球面、圆锥面、平面或笔记中旋转圆曲面的区域。`
      ),
      audit: { kind: 'MIT-MV-52:challenge', params: { R: Rc, d: dc } }
    })
  ];
};
