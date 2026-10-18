import type { CardGenerator } from '../../types';
import { ellipse, sampleCurve, type FigureShape } from '../../figure';
import { frac, gcd, makeMvDeck, num, type Text } from '../support';
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

export const mv53: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-53');
  warm(g);

  // Sampling
  const phiFig = g.pick([Math.PI / 6, Math.PI / 4, Math.PI / 3]);
  const zWord = g.pick(['A', 'B']);
  const ngWord = g.pick(['A', 'B']);
  const fs = { a: g.random(2, 6), c: g.pick([2, 3, 4, 5]) };
  const hr = { a: g.pick([2, 3, 4, 6, 8, 9]) };
  const cap = { d: g.random(1, 8), b: 0 }; cap.b = 2 * cap.d;
  const se = g.pick([
    { a: 1, c: 3, R: 3 }, { a: 2, c: 2, R: 4 }, { a: 2, c: 3, R: 6 },
    { a: 1, c: 2, R: 4 }, { a: 1, c: 2, R: 2 }, { a: 3, c: 1, R: 6 },
    { a: 1, c: 1, R: 2 }, { a: 2, c: 1, R: 4 }, { a: 3, c: 2, R: 6 },
  ]);
  const ch = { a: g.pick([2, 4, 8, 16, 24, 32]) };

  // Answers
  const ansHu = Math.PI * fs.a * fs.c;
  const ansHr = Math.PI * hr.a * hr.a / 3;
  const ansCf = Math.PI * cap.b / 4;
  const ansSe = 4 * Math.PI * se.c * se.a ** 3 / (3 * se.R ** 2);
  const ansCh = 3 * Math.PI * ch.a / 16;

  // Figures
  const halfBallShapes: FigureShape[] = [
    { kind: 'area', points: sampleCurve((t: number) => [fs.a * Math.cos(t), fs.a * Math.sin(t)], 0, Math.PI).concat([[0, 0]]), tone: 'accent', opacity: 0.3 },
    { kind: 'line', points: [[0, -0.3 * fs.a], [0, 1.2 * fs.a]], tone: 'axis', label: 'z' },
    { kind: 'line', points: [[-1.3 * fs.a, 0], [1.3 * fs.a, 0]], tone: 'axis', label: 'x' },
    { kind: 'point', at: [0, 0], label: 'O' },
    { kind: 'text', at: [0.55 * fs.a, 0.25 * fs.a], text: String(fs.a) },
  ];
  const halfBallView = { xmin: -1.3 * fs.a, xmax: 1.3 * fs.a, ymin: -1.3 * fs.a, ymax: 1.3 * fs.a };

  // The cap is the arc above the plane, closed by the chord (the plan's 0.9b view cut the circle off; 1.2b shows all of it).
  const capShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, cap.b), tone: 'muted' },
    { kind: 'area', points: sampleCurve((t: number) => [cap.b * Math.cos(t), cap.b * Math.sin(t)], Math.PI / 6, 5 * Math.PI / 6), tone: 'accent', opacity: 0.35 },
    { kind: 'line', points: [[-0.95 * cap.b, cap.d], [0.95 * cap.b, cap.d]], tone: 'accent2', label: `z = ${cap.d}`, labelAt: [0.5 * cap.b, cap.d] },
    { kind: 'line', points: [[-1.1 * cap.b, 0], [1.1 * cap.b, 0]], tone: 'axis', label: 'x' },
    { kind: 'line', points: [[0, -1.1 * cap.b], [0, 1.1 * cap.b]], tone: 'axis', label: 'z' },
    { kind: 'point', at: [0, 0], label: 'O' },
    { kind: 'line', points: [[0, 0], [cap.b * Math.cos(7 * Math.PI / 18), cap.b * Math.sin(7 * Math.PI / 18)]], tone: 'warn' },
    { kind: 'point', at: [cap.d / Math.tan(7 * Math.PI / 18), cap.d], label: g.t(['in', '入']) },
    { kind: 'point', at: [cap.b * Math.cos(7 * Math.PI / 18), cap.b * Math.sin(7 * Math.PI / 18)], label: g.t(['out', '出']) },
  ];
  const capView = { xmin: -1.2 * cap.b, xmax: 1.2 * cap.b, ymin: -1.2 * cap.b, ymax: 1.2 * cap.b };

  const zCompShapes: FigureShape[] = [
    { kind: 'line', points: [[-0.8, 0], [3.8, 0]], tone: 'axis', label: 'x' },
    { kind: 'line', points: [[0, -0.8], [0, 3.8]], tone: 'axis', label: 'z' },
    { kind: 'point', at: [0, 0], label: 'O' },
    { kind: 'point', at: [3 * Math.sin(phiFig), 3 * Math.cos(phiFig)], label: 'Δm' },
    { kind: 'line', points: [[0, 0], [3 * Math.sin(phiFig), 3 * Math.cos(phiFig)]], dash: true, label: 'ρ', labelAt: [2 * Math.sin(phiFig) + 0.1, 2 * Math.cos(phiFig) - 0.35] },
    { kind: 'arrow', from: [0, 0], to: [1.2 * Math.sin(phiFig), 1.2 * Math.cos(phiFig)], tone: 'warn', label: g.t(['pull', '引力']) },
    { kind: 'line', points: sampleCurve((s: number) => [0.8 * Math.sin(s), 0.8 * Math.cos(s)], 0, phiFig), tone: 'muted' },
    { kind: 'text', at: [0.55 * Math.sin(phiFig / 2) + 0.1, 0.55 * Math.cos(phiFig / 2)], text: 'φ' },
  ];
  const zCompView = { xmin: -1, xmax: 4, ymin: -1, ymax: 4 };

  return [
    g.choice({
      id: 'z-component',
      title: t('The z-component of one piece', '一小块的 z 分量'),
      prompt: zWord === 'A'
        ? t('A small piece of the solid has mass Δm and lies at spherical position (ρ, φ, θ) above the xy-plane (φ is measured from the positive z-axis). It attracts a unit mass at the origin with a force of magnitude G Δm/ρ². Which expression is the z-component ΔFz of this force?',
          '实心体中的一小块质量为 Δm，位于 xy 平面上方的球坐标位置 (ρ, φ, θ)（φ 是从正 z 轴量起的角）。它以大小为 G Δm/ρ² 的力吸引原点处的单位质量。这个力的 z 分量 ΔFz 是下面哪个表达式？')
        : t('A piece of mass Δm at distance ρ from the origin, in a direction that makes the angle φ with the positive z-axis, pulls the unit mass at the origin with force G Δm/ρ² in the direction of the piece. What is the z-component ΔFz of this pull?',
          '质量为 Δm 的一小块，到原点的距离为 ρ，方向与正 z 轴夹角为 φ，它以 G Δm/ρ² 的力沿指向这一小块的方向吸引原点处的单位质量。这个力的 z 分量 ΔFz 是什么？'),
      options: [
        t('ΔFz = G Δm cos φ / ρ²', 'ΔFz = G Δm cos φ / ρ²'),
        t('ΔFz = G Δm / ρ²', 'ΔFz = G Δm / ρ²'),
        t('ΔFz = G Δm sin φ / ρ²', 'ΔFz = G Δm sin φ / ρ²'),
        t('ΔFz = G Δm cos φ / ρ', 'ΔFz = G Δm cos φ / ρ'),
      ],
      correct: 0,
      hint: t('The force points towards the piece. What is the cosine of the angle between that direction and the z-axis?', '力指向这一小块。这个方向与 z 轴夹角的余弦是多少？'),
      explanation: t('The force has magnitude G Δm/ρ² and points from the origin towards the piece, a direction at angle φ from the z-axis. Its z-component is the magnitude times cos φ: ΔFz = G Δm cos φ / ρ². Using sin φ would give the horizontal component, and dropping cos φ gives the magnitude.',
        '力的大小为 G Δm/ρ²，方向从原点指向这一小块，与 z 轴的夹角为 φ。它的 z 分量是大小乘以 cos φ：ΔFz = G Δm cos φ / ρ²。用 sin φ 得到的是水平分量，去掉 cos φ 得到的是力的大小。'),
      figure: g.figure({
        alt: t('Side view: the z-axis upward, the origin O, a small mass Δm at distance ρ in a direction making the angle φ with the z-axis, and an arrow from O towards the mass showing the pull on the unit mass.',
          '侧视图：z 轴向上，原点 O，一小块质量 Δm 位于距离 ρ 处，方向与 z 轴夹角为 φ，从 O 指向该质量的箭头表示单位质量受到的引力。'),
        view: zCompView,
        shapes: zCompShapes,
      }),
    }),
    g.symbols({
      id: 'force-setup',
      title: t('Set up Fz', '列出 Fz 的积分'),
      prompt: t(`The upper half of a solid ball of radius ${fs.a} centred at the origin has uniform density δ = ${fs.c}. Take G = 1. It attracts a unit mass at the origin. Complete the integral for the z-component Fz of the force. (φ is measured from the positive z-axis.)`,
        `球心在原点、半径为 ${fs.a} 的实心球的上半部分，密度均匀，δ = ${fs.c}。取 G = 1。它吸引原点处的单位质量。补全这个力的 z 分量 Fz 的积分。（φ 是从正 z 轴量起的角。）`),
      before: t('Fz = ∫ over θ from 0 to 2π, over φ from 0 to ', 'Fz = ∫（θ 从 0 到 2π，φ 从 0 到 '),
      between: [g.t([`, over ρ from 0 to ${fs.a} of `, `，ρ 从 0 到 ${fs.a}，被积函数 `])],
      after: t(' dρ dφ dθ', '，积分顺序 dρ、dφ、dθ）'),
      answers: ['π/2', `${fs.c} cos φ sin φ`],
      tokens: shuffled(g, ['π/2', 'π', 'π/4', '2π', `${fs.c} cos φ sin φ`, `${fs.c} cos φ / ρ²`, `${fs.c} ρ² cos φ sin φ`, `${fs.c} cos φ`]),
      hint: t('Start from Fz = ∭ (cos φ/ρ²) δ dV (G = 1), then insert dV = ρ² sin φ dρ dφ dθ and simplify.', '从 Fz = ∭ (cos φ/ρ²) δ dV（G = 1）出发，代入 dV = ρ² sin φ dρ dφ dθ 并化简。'),
      explanation: t(`With G = 1, Fz = ∭ (cos φ/ρ²) δ dV. Inserting dV = ρ² sin φ dρ dφ dθ cancels the ρ²: the integrand is δ cos φ sin φ = ${fs.c} cos φ sin φ. The upper half of the ball is φ ≤ π/2, and ρ runs from 0 to ${fs.a}.`,
        `取 G = 1，Fz = ∭ (cos φ/ρ²) δ dV。代入 dV = ρ² sin φ dρ dφ dθ，ρ² 约去：被积函数是 δ cos φ sin φ = ${fs.c} cos φ sin φ。球的上半部分是 φ ≤ π/2，ρ 从 0 到 ${fs.a}。`),
      figure: g.figure({
        alt: t(`Side view in the xz-plane of the upper half of a ball of radius ${fs.a} centred at the origin O; the unit mass is at O.`,
          `xz 平面内的侧视图：半径为 ${fs.a}、球心在原点 O 的球的上半部分；单位质量在 O。`),
        view: halfBallView,
        shapes: halfBallShapes,
      }),
    }),
    g.number({
      id: 'hemisphere-uniform',
      title: t('Pull of a uniform half-ball', '均匀半球的引力'),
      prompt: t(`The upper half of a solid ball of radius ${fs.a} centred at the origin has uniform density δ = ${fs.c}. Take G = 1. Find the z-component Fz of the force on a unit mass at the origin. Give the exact value, for example 7pi/2.`,
        `球心在原点、半径为 ${fs.a} 的实心球的上半部分，密度均匀，δ = ${fs.c}。取 G = 1。求原点处单位质量所受力的 z 分量 Fz。写出精确值，例如 7pi/2。`),
      fields: [{ label: t('Fz', 'Fz'), answer: ansHu }],
      hint: t('Use your integral from the previous card; the three integrals separate: ∫dθ, ∫cos φ sin φ dφ, ∫dρ.', '用上一张卡片的积分；三个积分可以分开：∫dθ、∫cos φ sin φ dφ、∫dρ。'),
      explanation: t(`Fz = ${fs.c} · ∫ dθ · ∫ cos φ sin φ dφ · ∫ dρ = ${fs.c} · 2π · (1/2) · ${fs.a} = ${fracPi(fs.a * fs.c, 1)}.`,
        `Fz = ${fs.c} · ∫ dθ · ∫ cos φ sin φ dφ · ∫ dρ = ${fs.c} · 2π · (1/2) · ${fs.a} = ${fracPi(fs.a * fs.c, 1)}。`),
      figure: g.figure({
        alt: t(`Side view in the xz-plane of the upper half of a ball of radius ${fs.a} centred at the origin O; the unit mass is at O.`,
          `xz 平面内的侧视图：半径为 ${fs.a}、球心在原点 O 的球的上半部分；单位质量在 O。`),
        view: halfBallView,
        shapes: halfBallShapes,
      }),
      audit: { kind: 'MIT-MV-53:hemisphere-uniform', params: { a: fs.a, c: fs.c } },
    }),
    g.number({
      id: 'hemisphere-radial',
      title: t('A density that grows with the distance from the axis', '随到轴的距离增大的密度'),
      prompt: t(`The upper half of a solid ball of radius ${hr.a} centred at the origin has density δ = √(x² + y²), the distance from the z-axis. Take G = 1. Find the z-component Fz of the force on a unit mass at the origin. Give the exact value, for example 7pi/2.`,
        `球心在原点、半径为 ${hr.a} 的实心球的上半部分，密度为 δ = √(x² + y²)，即到 z 轴的距离。取 G = 1。求原点处单位质量所受力的 z 分量 Fz。写出精确值，例如 7pi/2。`),
      fields: [{ label: t('Fz', 'Fz'), answer: ansHr }],
      hint: t('In spherical coordinates √(x² + y²) = ρ sin φ. Put this δ into the integrand δ cos φ sin φ.', '在球坐标中 √(x² + y²) = ρ sin φ。把这个 δ 代入被积函数 δ cos φ sin φ。'),
      explanation: t(`δ = √(x² + y²) = ρ sin φ, so the integrand is ρ sin φ · cos φ sin φ = ρ sin²φ cos φ. Then Fz = 2π · ∫ ρ dρ · ∫ sin²φ cos φ dφ = 2π · (${hr.a}²/2) · (1/3) = ${fracPi(hr.a * hr.a, 3)}.`,
        `δ = √(x² + y²) = ρ sin φ，所以被积函数是 ρ sin φ · cos φ sin φ = ρ sin²φ cos φ。于是 Fz = 2π · ∫ ρ dρ · ∫ sin²φ cos φ dφ = 2π · (${hr.a}²/2) · (1/3) = ${fracPi(hr.a * hr.a, 3)}。`),
      audit: { kind: 'MIT-MV-53:hemisphere-radial', params: { a: hr.a } },
    }),
    g.symbols({
      id: 'cap-limits',
      title: t('Limits for the cap', '球冠的积分限'),
      prompt: t(`A solid ball of radius ${cap.b} is centred at the origin and cut by the plane z = ${cap.d}. The cap above the plane (z ≥ ${cap.d}) has density 1. Take G = 1. Complete the limits of the integral for the z-component Fz of its force on a unit mass at the origin (φ is measured from the positive z-axis; θ runs from 0 to 2π).`,
        `半径为 ${cap.b} 的实心球球心在原点，被平面 z = ${cap.d} 截开。平面上方的球冠（z ≥ ${cap.d}）密度为 1。取 G = 1。补全它对原点处单位质量的力的 z 分量 Fz 的积分的积分限（φ 是从正 z 轴量起的角；θ 从 0 到 2π）。`),
      before: t('Fz = ∫ over θ from 0 to 2π, over φ from 0 to ', 'Fz = ∫（θ 从 0 到 2π，φ 从 0 到 '),
      between: [g.t([', over ρ from ', '，ρ 从 ']), g.t([' to ', ' 到 '])],
      after: t(' of cos φ sin φ dρ dφ dθ', '，被积函数 cos φ sin φ，积分顺序 dρ、dφ、dθ）'),
      answers: ['π/3', `${cap.d}/cos φ`, String(cap.b)],
      tokens: shuffled(g, ['π/3', 'π/4', 'π/6', 'π/2', `${cap.d}/cos φ`, cap.d === 1 ? 'cos φ' : `${cap.d} cos φ`, String(cap.d), String(cap.b)]),
      hint: t(`A ray enters the cap through the plane, where ρ cos φ = ${cap.d}, and leaves through the sphere ρ = ${cap.b}. The last ray that meets the cap hits the circle where the plane cuts the sphere.`,
        `射线从平面进入球冠，此处 ρ cos φ = ${cap.d}，再从球面 ρ = ${cap.b} 离开。最后一条与球冠相交的射线经过平面截球面所得的圆。`),
      explanation: t(`A ray enters at the plane: ρ cos φ = ${cap.d}, so ρ = ${cap.d}/cos φ, and leaves on the sphere ρ = ${cap.b}. The plane meets the sphere where ${cap.d}/cos φ = ${cap.b}, that is cos φ = 1/2, so φ runs from 0 to π/3.`,
        `射线在平面处进入：ρ cos φ = ${cap.d}，所以 ρ = ${cap.d}/cos φ，在球面 ρ = ${cap.b} 处离开。平面与球面相交处 ${cap.d}/cos φ = ${cap.b}，即 cos φ = 1/2，所以 φ 从 0 到 π/3。`),
      figure: g.figure({
        alt: t(`Side view in the xz-plane: a circle of radius ${cap.b} around the origin, the horizontal line z = ${cap.d}, the cap above it shaded, and one ray from the origin that enters the cap at the line and leaves it on the circle.`,
          `xz 平面内的侧视图：以原点为圆心、半径为 ${cap.b} 的圆，水平线 z = ${cap.d}，线上方的球冠涂上阴影，一条从原点出发的射线在水平线处进入球冠，在圆上离开。`),
        view: capView,
        shapes: capShapes,
      }),
    }),
    g.number({
      id: 'cap-force',
      title: t('Pull of the cap', '球冠的引力'),
      prompt: t(`A solid ball of radius ${cap.b} is centred at the origin and cut by the plane z = ${cap.d}. The cap above the plane (z ≥ ${cap.d}) has density 1. Take G = 1. Find the z-component Fz of the force of the cap on a unit mass at the origin. Give the exact value, for example 9pi/4.`,
        `半径为 ${cap.b} 的实心球球心在原点，被平面 z = ${cap.d} 截开。平面上方的球冠（z ≥ ${cap.d}）密度为 1。取 G = 1。求球冠对原点处单位质量的力的 z 分量 Fz。写出精确值，例如 9pi/4。`),
      fields: [{ label: t('Fz', 'Fz'), answer: ansCf }],
      hint: t('Use the limits of the previous card; integrate ρ first (the integrand has no ρ), then φ, then θ.', '用上一张卡片的积分限；先对 ρ 积分（被积函数不含 ρ），再对 φ，最后对 θ。'),
      explanation: t(`Fz = 2π ∫ from φ = 0 to π/3 of cos φ sin φ (${cap.b} − ${cap.d}/cos φ) dφ = 2π [ ${cap.b} sin²φ/2 − ${cap.d === 1 ? '' : cap.d}(1 − cos φ) ] at φ = π/3 = 2π (${frac(3 * cap.d, 4)} − ${frac(cap.d, 2)}) = 2π · ${frac(cap.d, 4)} = ${fracPi(cap.d, 2)}.`,
        `Fz = 2π ∫ cos φ sin φ (${cap.b} − ${cap.d}/cos φ) dφ（φ 从 0 到 π/3）= 2π [ ${cap.b} sin²φ/2 − ${cap.d === 1 ? '' : cap.d}(1 − cos φ) ]（在 φ = π/3 处取值）= 2π (${frac(3 * cap.d, 4)} − ${frac(cap.d, 2)}) = 2π · ${frac(cap.d, 4)} = ${fracPi(cap.d, 2)}。`),
      audit: { kind: 'MIT-MV-53:cap-force', params: { b: cap.b, d: cap.d } },
    }),
    g.number({
      id: 'shell-exterior',
      title: t('A ball seen from outside', '从球外看球'),
      prompt: t(`A uniform solid ball of radius ${se.a} and density ${se.c} has its centre at the point (0, 0, ${se.R}) on the z-axis, with ${se.R} > ${se.a}, so the ball lies entirely above the origin. Take G = 1. A unit point mass sits at the origin. Newton's theorem says that a uniform ball attracts an outside point as if all of its mass were at its centre. What is the magnitude of the gravitational force on the unit mass? Give the exact value, for example 9pi/4.`,
        `半径为 ${se.a}、密度为 ${se.c} 的均匀实心球，球心在 z 轴上的点 (0, 0, ${se.R})，且 ${se.R} > ${se.a}，所以整个球在原点上方。取 G = 1。原点处有一个单位质点。牛顿定理指出：均匀球对球外一点的吸引，等同于把球的全部质量放在球心。单位质量所受引力的大小是多少？写出精确值，例如 9pi/4。`),
      fields: [{ label: t('F', 'F'), answer: ansSe }],
      hint: t('Find the mass M of the ball first, then use F = GM/R² with the distance from the origin to the centre.', '先求球的质量 M，再用 F = GM/R²，其中 R 是原点到球心的距离。'),
      explanation: t(`The mass is M = ${se.c} · (4/3)π · ${se.a}³ = ${fracPi(4 * se.c * se.a ** 3, 3)}. The theorem puts all of M at the centre, at distance ${se.R}, so F = G M/${se.R}² = ${fracPi(4 * se.c * se.a ** 3, 3)}/${se.R ** 2} = ${fracPi(4 * se.c * se.a ** 3, 3 * se.R ** 2)}.`,
        `质量 M = ${se.c} · (4/3)π · ${se.a}³ = ${fracPi(4 * se.c * se.a ** 3, 3)}。定理把全部质量 M 放在球心，距离为 ${se.R}，所以 F = G M/${se.R}² = ${fracPi(4 * se.c * se.a ** 3, 3)}/${se.R ** 2} = ${fracPi(4 * se.c * se.a ** 3, 3 * se.R ** 2)}。`),
      audit: { kind: 'MIT-MV-53:shell-exterior', params: { a: se.a, c: se.c, R: se.R } },
    }),
    g.choice({
      id: 'not-general',
      title: t('Does Newton\'s theorem generalise?', '牛顿定理能推广吗？'),
      prompt: ngWord === 'A'
        ? t('A student says: "Every uniform solid of mass M attracts an outside unit mass exactly like a point mass M placed at the solid\'s centre of mass." Which statement is correct?',
          '有同学说：“任何质量为 M 的均匀实心体对外部单位质量的吸引，都恰好等于把质量 M 放在它质心处的质点的吸引。”下面哪个说法正确？')
        : t('A student claims that any uniform solid of mass M pulls a unit mass outside it exactly as a point mass M at its centre of mass would. What is correct?',
          '有同学认为：任何质量为 M 的均匀实心体对它外部一个单位质量的吸引，都恰好等于质心处质量为 M 的质点的吸引。哪个说法正确？'),
      options: [
        t('True for a uniform solid ball, but not for every uniform solid.', '对均匀实心球成立，但并非对每个均匀实心体都成立。'),
        t('True for every uniform solid, whatever its shape.', '对任何形状的均匀实心体都成立。'),
        t('False: it does not even hold for a uniform solid ball.', '不成立：连均匀实心球也不成立。'),
        t('True for every uniform solid that has an axis of symmetry through the unit mass.', '对每个有一条通过该单位质量的对称轴的均匀实心体都成立。'),
      ],
      correct: 0,
      hint: t('Newton\'s result is about a ball. For other shapes, think of a unit mass on the line between two equal point masses, but closer to one of them.',
        '牛顿的结论是关于球的。对其他形状，想一想两个相等质点连线上、靠近其中一个的单位质量。'),
      explanation: t('Newton proved the statement for a uniform solid ball only. For other solids it fails: a unit mass on the line between two equal point masses, but closer to one of them, is pulled towards the closer one, while a point mass at their centre of mass (the midpoint) would pull it towards the midpoint. An axis of symmetry does not help: for the cap of radius √2 cut at distance 1 (density 1, G = 1) the true pull is 2π(3√2/4 − 1) ≈ 0.381, while a point mass of the same mass at its centre of mass would pull with about 0.528.',
        '牛顿只对均匀实心球证明了这个结论。对其他立体它不成立：在两个相等质点连线上、靠近其中一个的单位质量，会被拉向较近的那个，而位于它们质心（中点）的质点会把它拉向中点。有对称轴也没有用：对半径 √2、在距离 1 处截开的球冠（密度 1，G = 1），真实的引力是 2π(3√2/4 − 1) ≈ 0.381，而把同样质量放在它质心处的质点产生的引力约为 0.528。'),
    }),
    g.number({
      id: 'challenge',
      title: t('Average distance from a diameter', '到直径的平均距离'),
      prompt: t(`Find the average distance of a point in a solid ball of radius ${ch.a} from a fixed diameter of the ball, that is, the average value over the ball of the distance to that diameter. Give the exact value, for example 5pi/2.`,
        `求半径为 ${ch.a} 的实心球内的点到球的一条固定直径的平均距离，即该点到这条直径的距离在球上的平均值。写出精确值，例如 5pi/2。`),
      fields: [{ label: t('average distance', '平均距离'), answer: ansCh }],
      hint: t(`Choose the diameter to be the z-axis. The average value of f over the ball is (1/V) ∭ f dV with V = (4/3)π · ${ch.a}³.`,
        `取这条直径为 z 轴。f 在球上的平均值是 (1/V) ∭ f dV，其中 V = (4/3)π · ${ch.a}³。`),
      explanation: t(`With the diameter along the z-axis, the distance of a point is √(x² + y²) = ρ sin φ. Then ∭ ρ sin φ dV = ∫ dθ · ∫ sin²φ dφ · ∫ ρ³ dρ = 2π · (π/2) · ${ch.a}⁴/4 = ${fracPi(ch.a ** 4, 4)}², and dividing by V = (4/3)π · ${ch.a}³ gives ${fracPi(3 * ch.a, 16)}. This game only treats solids placed symmetrically so that the pull is along the z-axis, as in the notes; it does not test the x- and y-components of the attraction or forces from off-axis solids.`,
        `直径取在 z 轴上时，点到它的距离是 √(x² + y²) = ρ sin φ。于是 ∭ ρ sin φ dV = ∫ dθ · ∫ sin²φ dφ · ∫ ρ³ dρ = 2π · (π/2) · ${ch.a}⁴/4 = ${fracPi(ch.a ** 4, 4)}²，再除以 V = (4/3)π · ${ch.a}³ 得 ${fracPi(3 * ch.a, 16)}。本游戏只讨论像笔记中那样对称放置、引力沿 z 轴的立体，不涉及引力的 x、y 分量，也不涉及偏离轴的立体产生的引力。`),
      audit: { kind: 'MIT-MV-53:challenge', params: { a: ch.a } },
    }),
  ];
};
