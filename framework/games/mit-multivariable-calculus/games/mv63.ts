import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, ellipse, line3d, wire3d, type FigureShape, type Pt3 } from '../../figure';
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

const NOT_ASSESSED_EN = "This game does not assess deriving Maxwell's equations from physical principles, computing a field from a given charge distribution, or boundary-value problems for harmonic functions.";
const NOT_ASSESSED_ZH = '本游戏不评估由物理原理推导麦克斯韦方程、由给定电荷分布计算电场，也不评估调和函数的边值问题。';

export const mv63: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-63');
  warm(g);

  // --- bridge ---
  const bridgeStmt = g.pick(['A', 'B', 'C'] as const);
  const bridgePhrasing = g.pick([1, 2] as const);
  const bridgeQ = g.random(2, 7);
  const bridgeC = g.random(2, 7);

  // --- gauss-setup ---
  // q3 ≠ q1 − q2: otherwise the token "q3" has the same value as the right answer "q1 − q2"
  const gs = retry(() => ({ q1: g.random(1, 6), q2: g.random(1, 6), q3: g.random(1, 6) }), v => v.q1 !== v.q2 && v.q3 !== v.q1 - v.q2);
  const gsD = gs.q1 - gs.q2;

  // --- gauss-flux ---
  const gf = retry(() => ({ q1: g.random(1, 6), q2: g.random(1, 6), q3: g.random(1, 6) }), v => v.q1 !== v.q2);
  const gfD = gf.q1 - gf.q2;
  const gfK = 4 * gfD;

  // --- faraday-setup ---
  const fs = { a: g.random(1, 4), b: g.random(1, 5), c: g.random(2, 7) };

  // --- emf ---
  const em = { a: g.random(1, 4), b: g.random(1, 5), c: g.random(2, 7), t0: g.pick([1, 2, 3]) };
  const emD = 2 * em.a * em.t0 + em.b;
  const emAns = -emD / em.c;

  // --- same-flux ---
  const sfM = g.pick([2, 3, 4, 5, 6, 7, -2, -3, -4, -5, -6, -7]);

  // --- harmonic-coef ---
  const hc = { a: g.random(1, 5), b: g.random(1, 5), d: g.random(1, 5) };
  const hcW = -(hc.a + hc.b);

  // --- poisson ---
  const psR = g.random(1, 6);

  // --- challenge ---
  const ch = retry(() => ({ a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]), c: g.pick([1, 2, 3]), s: g.pick([2, 3, 4]) }),
    v => !(v.a === v.b && v.b === v.c));
  const chSum = ch.a + ch.b + ch.c;
  const chFlux = chSum * ch.s ** 3;
  const chK = chFlux / 4;

  // --- bridge texts ---
  const bridgeStatements: Record<string, { en: [string, string], zh: [string, string] }> = {
    A: {
      en: [
        `The Gauss-Coulomb law in integrated form says: the flux of E out of a closed surface S equals 4πQ, where Q is the net charge inside S (for example Q = ${bridgeQ}).`,
        `Consider the statement: for a closed surface S enclosing a net charge Q (for example Q = ${bridgeQ}), the flux of E out of S is 4πQ.`,
      ],
      zh: [
        `高斯-库仑定律的积分形式说：电场 E 穿出闭曲面 S 的通量等于 4πQ，其中 Q 是 S 内的净电荷（例如 Q = ${bridgeQ}）。`,
        `考虑这个陈述：闭曲面 S 内的净电荷为 Q（例如 Q = ${bridgeQ}）时，E 穿出 S 的通量等于 4πQ。`,
      ],
    },
    B: {
      en: [
        `Faraday's law in integrated form says: in suitable units (c = ${bridgeC}), the line integral of E around a closed loop C equals −1/${bridgeC} times the rate of change of the magnetic flux through a surface spanning C.`,
        `Consider the statement: in suitable units (c = ${bridgeC}), the EMF around a closed loop C equals −1/${bridgeC} times the time derivative of the magnetic flux through any surface spanning C.`,
      ],
      zh: [
        `法拉第定律的积分形式说：在适当的单位下（c = ${bridgeC}），E 沿闭回路 C 的线积分等于 −1/${bridgeC} 乘以穿过以 C 为边界的曲面的磁通量的变化率。`,
        `考虑这个陈述：在适当的单位下（c = ${bridgeC}），沿闭回路 C 的电动势等于 −1/${bridgeC} 乘以穿过以 C 为边界的任一曲面的磁通量对时间的导数。`,
      ],
    },
    C: {
      en: [
        `For a field F that is continuously differentiable in all of 3-space, the integrated criterion says: ∮_C F · dr = 0 for every closed curve C.`,
        `Consider the criterion: for a field F that is continuously differentiable in all of 3-space, ∮_C F · dr = 0 for every closed curve C.`,
      ],
      zh: [
        `对在整个三维空间中连续可微的场 F，积分形式的判据说：沿每条闭曲线 C，∮_C F · dr = 0。`,
        `考虑这个判据：对在整个三维空间中连续可微的场 F，沿每条闭曲线 C 都有 ∮_C F · dr = 0。`,
      ],
    },
  };
  const bStmt = bridgeStatements[bridgeStmt];
  const bIdx = bridgePhrasing - 1;
  const bridgePrompt = t(
    `${bStmt.en[bIdx]} Which theorem proves that this integrated form is equivalent to a differential form?`,
    `${bStmt.zh[bIdx]}哪个定理证明了这个积分形式与某个微分形式等价？`,
  );
  const bridgeCorrect = bridgeStmt === 'A' ? 1 : 0;
  const bridgeExpl = bridgeStmt === 'A'
    ? t(`By the divergence theorem the flux of E out of S equals ∭ ∇ · E dV over the inside of S; with ∇ · E = 4πρ this is 4π times the total charge Q inside, so the flux law and ∇ · E = 4πρ are equivalent (V15.2-3, p. 1).`,
      `由散度定理，E 穿出 S 的通量等于 S 内部 ∇ · E 的三重积分；取 ∇ · E = 4πρ，它就是 4π 乘以内部总电荷 Q，所以通量定律与 ∇ · E = 4πρ 等价（V15.2-3，第 1 页）。`)
    : bridgeStmt === 'B'
    ? t(`By Stokes' theorem ∮_C E · dr = ∬_S (∇ × E) · dS over a surface S spanning C, so the integrated form is equivalent to ∇ × E = −(1/c) ∂B/∂t (V15.2-3, p. 3). Green's theorem is only the plane case of Stokes' theorem.`,
      `由斯托克斯定理，∮_C E · dr = ∬_S (∇ × E) · dS（S 以 C 为边界），所以积分形式与 ∇ × E = −(1/c) ∂B/∂t 等价（V15.2-3，第 3 页）。格林定理只是斯托克斯定理在平面上的特例。`)
    : t(`Stokes' theorem provides the bridge between ∮_C F · dr = 0 for all closed C and curl F = 0 at all points (V15.2-3, p. 1).`,
      `斯托克斯定理是联系「沿所有闭曲线 ∮_C F · dr = 0」与「处处 curl F = 0」的桥梁（V15.2-3，第 1 页）。`);

  // --- gauss-setup tokens ---
  const gsTokens = shuffled(g, [
    '4π', '1/(4π)', '4πρ', 'ρ/(4π)',
    `${gs.q1} − ${gs.q2}`, `${gs.q1} − ${gs.q2} + ${gs.q3}`, `${gs.q1} + ${gs.q2}`, `${gs.q3}`,
  ]);

  // --- gauss-flux figure ---
  const gfShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, 3, 2), tone: 'accent', width: 2 },
    { kind: 'point', at: [-1, 0.4], tone: 'accent', label: `+${gf.q1}` },
    { kind: 'point', at: [1, -0.4], tone: 'accent2', label: `−${gf.q2}` },
    { kind: 'point', at: [4.8, 0], tone: 'warn', label: `+${gf.q3}` },
  ];

  // --- faraday / same-flux figures ---
  const ring = (radius: number, z: number): Pt3[] => Array.from({ length: 49 }, (_, i) => [radius * Math.cos(2 * Math.PI * i / 48), radius * Math.sin(2 * Math.PI * i / 48), z] as Pt3);
  const onRing = (radius: number, angle: number): Pt3 => [radius * Math.cos(angle), radius * Math.sin(angle), 0];
  const loopShapes: FigureShape[] = [
    ...axes3d(3),
    line3d(ring(2, 0), 'accent', { width: 2 }),
    arrow3d(onRing(2, Math.PI / 4), onRing(2, Math.PI / 4 + 0.4), 'accent'),
    arrow3d([0, 0, 0], [0, 0, 2], 'accent2', 'n'),
  ];
  const sfShapes: FigureShape[] = [
    ...axes3d(2),
    line3d(ring(1, 0), 'accent', { width: 2 }),
    ...Array.from({ length: 6 }, (_, k): FigureShape => line3d([[0, 0, 0], onRing(1, 2 * Math.PI * k / 6)], 'muted', { width: 1 })),
    ...wire3d((u, v) => [Math.sin(u) * Math.cos(v), Math.sin(u) * Math.sin(v), Math.cos(u)], 0, Math.PI / 2, 0, 2 * Math.PI, 3, 8, 36, 'accent2'),
    arrow3d([0, 0, 0], [0, 0, 1.6], 'accent2', 'n'),
  ];
  const loopFigure = (alt: Text) => g.figure({ alt, view: fitView(loopShapes, 0.25), shapes: loopShapes });
  const loopAlt = t('A circular loop C in a horizontal plane with an arrow showing counterclockwise motion viewed from above, and an arrow n pointing up from the centre.', '水平面内的圆形回路 C，箭头表示从上往下看为逆时针的方向，圆心处的箭头 n 向上。');

  // --- faraday-setup tokens ---
  const fsDeriv = fs.a === 1 ? `2t + ${fs.b}` : `${2 * fs.a}t + ${fs.b}`;
  const fsTokens = shuffled(g, [
    'd/dt', '∫ dt', 'Φ(t)/t',
    fsDeriv,
    fs.a === 1 ? `t + ${fs.b}` : `${fs.a}t + ${fs.b}`,
    fs.a === 1 ? '2t' : `${2 * fs.a}t`,
    `${coef(fs.a, 't²')} + ${coef(fs.b, 't')}`,
  ]);

  // --- same-flux options ---
  const sfNegM = -sfM;
  const sfOptions = [
    t(`The same flux, ${num(sfM)}`, `相同的通量，${num(sfM)}`),
    t(`The opposite flux, ${num(sfNegM)}`, `相反的通量，${num(sfNegM)}`),
    t('Zero, because ∇ · B = 0', '零，因为 ∇ · B = 0'),
    t('It cannot be found without knowing B', '不知道 B 就无法求出'),
  ];

  // --- poisson options ---
  const psFourPiR = psR === 1 ? '4π' : `4π·${psR}`;
  const psNegFourPiR = psR === 1 ? '−4π' : `−4π·${psR}`;
  const psOptions = [
    t(`f is not harmonic: ∇²f = ∇ · E = ${psFourPiR}`, `f 不是调和函数：∇²f = ∇ · E = ${psFourPiR}`),
    t('f is harmonic, because E is conservative and so ∇ × E = 0', 'f 是调和函数，因为 E 是保守场，所以 ∇ × E = 0'),
    t('f is harmonic, because ∇²f = ∇ · ∇f = 0', 'f 是调和函数，因为 ∇²f = ∇ · ∇f = 0'),
    t(`f is not harmonic: ∇²f = ${psNegFourPiR}`, `f 不是调和函数：∇²f = ${psNegFourPiR}`),
  ];

  return [
    g.choice({
      id: 'bridge',
      title: t('Which theorem is the bridge?', '哪个定理是桥梁？'),
      prompt: bridgePrompt,
      options: [
        t("Stokes' theorem: a line integral around a closed curve equals a surface integral of a curl", '斯托克斯定理：沿闭曲线的线积分等于曲面上旋度的积分'),
        t('the divergence theorem: the flux through a closed surface equals a volume integral of a divergence', '散度定理：穿过闭曲面的通量等于散度的体积分'),
        t("Green's theorem in the plane, which only applies to plane regions", '平面上的格林定理，它只适用于平面区域'),
        t('the fundamental theorem for line integrals: ∫ ∇f · dr = f(end) − f(start)', '线积分基本定理：∫ ∇f · dr = f(终点) − f(起点)'),
      ],
      correct: bridgeCorrect,
      hint: t('Is the integral in the statement over a closed surface or around a closed curve? Which theorem turns that kind of integral into an integral over the inside?',
        '陈述中的积分是在闭曲面上，还是沿闭曲线？哪个定理把这种积分化成对内部的积分？'),
      explanation: bridgeExpl,
    }),
    g.symbols({
      id: 'gauss-setup',
      title: t('Set up the Gauss-Coulomb law', '写出高斯-库仑定律'),
      prompt: t(
        `A closed surface S has the point charges ${gs.q1} and −${gs.q2} inside it and the point charge ${gs.q3} outside it. In the course's units the Gauss-Coulomb law reads (Q is the total net charge inside S, ρ is the charge density):`,
        `闭曲面 S 内有点电荷 ${gs.q1} 和 −${gs.q2}，S 外有点电荷 ${gs.q3}。在课程所用的单位下，高斯-库仑定律为（Q 是 S 内的净电荷总量，ρ 是电荷密度）：`,
      ),
      before: '∮_S E · dS = ',
      between: lang === 'zh' ? [' · Q 且 ∇ · E = ', '。这里 Q = '] : [' · Q and ∇ · E = ', '. Here Q = '],
      after: t('.', '。'),
      answers: ['4π', '4πρ', `${gs.q1} − ${gs.q2}`],
      tokens: gsTokens,
      hint: t('Only the charges inside S belong to Q, and the sign of each charge matters. Both forms of the law use the same constant.',
        '只有 S 内的电荷计入 Q，且每个电荷的符号都要计入。定律的两种形式使用同一个常数。'),
      explanation: t(
        `The two forms of the Gauss-Coulomb law are ∮_S E · dS = 4πQ and ∇ · E = 4πρ (V15.2-3, p. 1). Q is the total net charge inside S: ${gs.q1} + (−${gs.q2}) = ${num(gsD)}; the charge ${gs.q3} outside S does not count.`,
        `高斯-库仑定律的两种形式是 ∮_S E · dS = 4πQ 与 ∇ · E = 4πρ（V15.2-3，第 1 页）。Q 是 S 内的净电荷总量：${gs.q1} + (−${gs.q2}) = ${num(gsD)}；S 外的电荷 ${gs.q3} 不计入。`,
      ),
    }),
    g.number({
      id: 'gauss-flux',
      title: t('Flux out of S', '穿出 S 的通量'),
      prompt: t(
        `A closed surface S, oriented outward, has the point charges ${gf.q1} and −${gf.q2} inside it and the point charge ${gf.q3} outside it. By the Gauss-Coulomb law the flux ∮_S E · dS equals k·π. Enter k (an integer; a negative flux needs a minus sign).`,
        `闭曲面 S 取外侧定向，S 内有点电荷 ${gf.q1} 和 −${gf.q2}，S 外有点电荷 ${gf.q3}。由高斯-库仑定律，通量 ∮_S E · dS 等于 k·π。求 k（整数；通量为负时要写负号）。`,
      ),
      figure: g.figure({
        alt: t(
          `A cross-section of the closed surface S as a closed curve. The charges ${gf.q1} and −${gf.q2} are drawn inside it and the charge ${gf.q3} outside it.`,
          `闭曲面 S 的截面，画成一条闭曲线。电荷 ${gf.q1} 和 −${gf.q2} 画在曲线内部，电荷 ${gf.q3} 画在曲线外部。`,
        ),
        view: fitView(gfShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: gfShapes,
      }),
      fields: [{ label: t('k', 'k'), answer: gfK }],
      hint: t('Use ∮_S E · dS = 4πQ with Q the net charge inside S.', '用 ∮_S E · dS = 4πQ，其中 Q 是 S 内的净电荷。'),
      explanation: t(
        `The net charge inside S is Q = ${gf.q1} + (−${gf.q2}) = ${num(gfD)}; the charge ${gf.q3} outside contributes nothing. So ∮_S E · dS = 4π · ${par(gfD)} = ${num(gfK)}π and k = ${num(gfK)}.`,
        `S 内的净电荷为 Q = ${gf.q1} + (−${gf.q2}) = ${num(gfD)}；S 外的电荷 ${gf.q3} 没有贡献。所以 ∮_S E · dS = 4π · ${par(gfD)} = ${num(gfK)}π，k = ${num(gfK)}。`,
      ),
      audit: { kind: 'MIT-MV-63:gauss-flux', params: { q1: gf.q1, q2: gf.q2, q3: gf.q3 } },
    }),
    g.symbols({
      id: 'faraday-setup',
      title: t("Set up Faraday's law", '写出法拉第定律'),
      prompt: t(
        `In suitable units with c = ${fs.c}, the magnetic flux through any surface spanning the loop C is Φ(t) = ${coef(fs.a, 't²')} + ${coef(fs.b, 't')}, measured with the unit normal n of the surface pointing up, and C is run counterclockwise viewed from above (the compatible orientation). Faraday's law (9′) gives the EMF around C:`,
        `在适当的单位下取 c = ${fs.c}，穿过以回路 C 为边界的任一曲面的磁通量为 Φ(t) = ${coef(fs.a, 't²')} + ${coef(fs.b, 't')}（曲面的单位法向量 n 向上），C 取从上往下看为逆时针的相容方向。法拉第定律 (9′) 给出沿 C 的电动势：`,
      ),
      before: `∮_C E · dr = −(1/${fs.c}) · `,
      between: [` Φ(t) = −(1/${fs.c}) · (`],
      after: t(').', ')。'),
      answers: ['d/dt', fsDeriv],
      tokens: fsTokens,
      hint: t(`The EMF is −1/${fs.c} times the rate of change of the flux with respect to time.`,
        `电动势等于 −1/${fs.c} 乘以磁通量对时间的变化率。`),
      explanation: t(
        `Faraday's law (9′) is ∮_C E · dr = −(1/c) d/dt of the flux through a spanning surface (V15.2-3, p. 2). The flux is a function of t alone, so this is an ordinary derivative: dΦ/dt = ${fsDeriv}.`,
        `法拉第定律 (9′) 为：∮_C E · dr = −(1/c) 乘以穿过任一张开曲面的磁通量对 t 的导数（V15.2-3，第 2 页）。磁通量只是 t 的函数，所以这是普通导数：dΦ/dt = ${fsDeriv}。`,
      ),
      figure: loopFigure(loopAlt),
    }),
    g.number({
      id: 'emf',
      title: t('The EMF at time t', 't 时刻的电动势'),
      prompt: t(
        `In suitable units with c = ${em.c}, the magnetic flux through any surface spanning the loop C is Φ(t) = ${coef(em.a, 't²')} + ${coef(em.b, 't')}, with n pointing up and C counterclockwise viewed from above. Find the EMF ∮_C E · dr at t = ${em.t0}. Enter an integer or a fraction (a negative value needs a minus sign).`,
        `在适当的单位下取 c = ${em.c}，穿过以回路 C 为边界的任一曲面的磁通量为 Φ(t) = ${coef(em.a, 't²')} + ${coef(em.b, 't')}，n 向上，C 从上往下看为逆时针。求 t = ${em.t0} 时的电动势 ∮_C E · dr。填整数或分数（负值要写负号）。`,
      ),
      fields: [{ label: t('EMF', '电动势'), answer: emAns }],
      hint: t(`Differentiate Φ(t), put t = ${em.t0}, and multiply by −1/${em.c}.`,
        `对 Φ(t) 求导，代入 t = ${em.t0}，再乘以 −1/${em.c}。`),
      explanation: t(
        `dΦ/dt = ${coef(2 * em.a, 't')} + ${em.b}, which is ${emD} at t = ${em.t0}. So ∮_C E · dr = −(1/${em.c}) · ${emD} = ${frac(-emD, em.c)}.`,
        `dΦ/dt = ${coef(2 * em.a, 't')} + ${em.b}，在 t = ${em.t0} 时为 ${emD}。所以 ∮_C E · dr = −(1/${em.c}) · ${emD} = ${frac(-emD, em.c)}。`,
      ),
      figure: loopFigure(loopAlt),
      audit: { kind: 'MIT-MV-63:emf', params: { a: em.a, b: em.b, c: em.c, t0: em.t0 } },
    }),
    g.choice({
      id: 'same-flux',
      title: t('Two surfaces, one loop', '两个曲面，一个回路'),
      prompt: t(
        `B is a magnetic field with ∇ · B = 0 everywhere. The loop C is the unit circle in the xy-plane, counterclockwise viewed from above. S₁ is the flat disc bounded by C and S₂ is the upper half of the unit sphere, also bounded by C; both are oriented upward (on S₂ the normal n points away from the origin). The flux of B through S₁ is ${num(sfM)}. What is the flux of B through S₂?`,
        `B 是处处满足 ∇ · B = 0 的磁场。回路 C 是 xy 平面内的单位圆，从上往下看为逆时针。S₁ 是以 C 为边界的平圆盘，S₂ 是同样以 C 为边界的单位球面的上半部分；二者都取向上的一侧（在 S₂ 上 n 背离原点）。B 穿过 S₁ 的通量为 ${num(sfM)}。B 穿过 S₂ 的通量是多少？`,
      ),
      options: sfOptions,
      correct: 0,
      hint: t('S₁ and S₂ together bound a solid half-ball. What does ∇ · B = 0 say about the flux through the boundary of a solid region?',
        'S₁ 和 S₂ 一起围成一个实心半球。∇ · B = 0 对穿过实心区域边界的通量意味着什么？'),
      explanation: t(
        `The flux of B is the same through every surface spanning C (V15.2-3, p. 3, a consequence of ∇ · B = 0). Here is why: S₂ together with S₁ turned over (n pointing down) is the closed boundary of a half-ball, and by the divergence theorem its total outward flux is ∭ ∇ · B dV = 0. So the flux through S₂ equals the flux through S₁, namely ${num(sfM)}.`,
        `B 穿过以 C 为边界的每一个曲面的通量都相同（V15.2-3，第 3 页，这是 ∇ · B = 0 的推论）。原因如下：S₂ 与翻转后的 S₁（n 向下）合起来是半球的闭边界，由散度定理其向外的总通量为 ∭ ∇ · B dV = 0。所以穿过 S₂ 的通量等于穿过 S₁ 的通量，即 ${num(sfM)}。`,
      ),
      figure: g.figure({
        alt: t('A unit circle in the xy-plane, a flat disc across it, and the upper half of the unit sphere over it; an arrow n points up.', 'xy 平面内的单位圆，圆上的平圆盘，以及圆上方的单位球面上半部分；箭头 n 向上。'),
        view: fitView(sfShapes, 0.25),
        shapes: sfShapes,
      }),
    }),
    g.number({
      id: 'harmonic-coef',
      title: t('Make the potential harmonic', '让势函数成为调和函数'),
      prompt: t(
        `The function f(x, y, z) = ${coef(hc.a, 'x²')} + ${coef(hc.b, 'y²')} + w z² + ${coef(hc.d, 'xy')} is the potential (E = ∇f) of an electrostatic field in a region with no charge and no changing magnetic field, so f must be harmonic: ∇²f = ∂²f/∂x² + ∂²f/∂y² + ∂²f/∂z² = 0. Find w (an integer).`,
        `函数 f(x, y, z) = ${coef(hc.a, 'x²')} + ${coef(hc.b, 'y²')} + w z² + ${coef(hc.d, 'xy')} 是某静电场（E = ∇f）的势函数，该区域内无电荷也无变化的磁场，所以 f 必须是调和函数：∇²f = ∂²f/∂x² + ∂²f/∂y² + ∂²f/∂z² = 0。求 w（整数）。`,
      ),
      fields: [{ label: t('w', 'w'), answer: hcW }],
      hint: t('Compute the three second partial derivatives and add them. The xy term has no pure second derivative.',
        '分别算出三个二阶偏导数再相加。xy 项没有纯二阶偏导数。'),
      explanation: t(
        `∂²f/∂x² = ${2 * hc.a}, ∂²f/∂y² = ${2 * hc.b}, ∂²f/∂z² = 2w, and the xy term contributes to none of them. So ${2 * hc.a} + ${2 * hc.b} + 2w = 0 and w = ${num(hcW)}.`,
        `∂²f/∂x² = ${2 * hc.a}，∂²f/∂y² = ${2 * hc.b}，∂²f/∂z² = 2w，xy 项对三者都没有贡献。所以 ${2 * hc.a} + ${2 * hc.b} + 2w = 0，w = ${num(hcW)}。`,
      ),
      audit: { kind: 'MIT-MV-63:harmonic-coef', params: { a: hc.a, b: hc.b, d: hc.d } },
    }),
    g.choice({
      id: 'poisson',
      title: t('Is the potential still harmonic?', '势函数还是调和的吗？'),
      prompt: t(
        `In a simply connected region the static electric field E has the constant charge density ρ = ${psR} (not zero), and f is its potential, E = ∇f (the mathematical potential; the physical potential is −f). Which statement is correct?`,
        `在单连通区域中，静电场 E 的电荷密度为常数 ρ = ${psR}（不为零），f 是它的势函数，E = ∇f（这是数学势函数；物理势函数是 −f）。下列哪条说法正确？`,
      ),
      options: psOptions,
      correct: 0,
      hint: t('∇²f = ∇ · ∇f = ∇ · E. What does the Gauss-Coulomb law say about ∇ · E?',
        '∇²f = ∇ · ∇f = ∇ · E。高斯-库仑定律对 ∇ · E 是怎么说的？'),
      explanation: t(
        `Since E = ∇f, ∇²f = ∇ · ∇f = ∇ · E, and the Gauss-Coulomb law ∇ · E = 4πρ gives ${psFourPiR}, which is not 0. The argument that f is harmonic needs ρ = 0 (no charge), a static field (so ∇ × E = 0) and a simply connected region (V15.2-3, p. 4). The physical potential −f has the opposite sign, ∇²(−f) = ${psNegFourPiR}.`,
        `因为 E = ∇f，所以 ∇²f = ∇ · ∇f = ∇ · E，由高斯-库仑定律 ∇ · E = 4πρ 得 ${psFourPiR}，不为 0。「f 是调和函数」的论证需要 ρ = 0（无电荷）、静场（于是 ∇ × E = 0）和单连通区域（V15.2-3，第 4 页）。物理势函数 −f 的符号相反，∇²(−f) = ${psNegFourPiR}。`,
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Charge in a cube', '立方体内的电荷'),
      prompt: t(
        `In the course's units the Gauss-Coulomb law is ∮_S E · dS = 4πQ for a closed surface S enclosing the net charge Q. An electrostatic field is E = (${coef(ch.a, 'x')}, ${coef(ch.b, 'y')}, ${coef(ch.c, 'z')}) (a coefficient 1 is written as x, y or z). S is the surface of the cube 0 ≤ x, y, z ≤ ${ch.s}, oriented outward. The net charge Q inside S equals k/π. Enter k (an integer or a fraction).`,
        `在课程所用的单位下，对包围净电荷 Q 的闭曲面 S，高斯-库仑定律为 ∮_S E · dS = 4πQ。某静电场为 E = (${coef(ch.a, 'x')}, ${coef(ch.b, 'y')}, ${coef(ch.c, 'z')})（系数为 1 时写作 x、y 或 z）。S 是立方体 0 ≤ x, y, z ≤ ${ch.s} 的表面，取外侧定向。S 内的净电荷 Q 等于 k/π。求 k（整数或分数）。`,
      ),
      fields: [{ label: t('k', 'k'), answer: chK }],
      hint: t('Which theorem turns the flux through the closed surface S into an integral over the cube? What is ∇ · E here?',
        '哪个定理把穿过闭曲面 S 的通量化成对立方体的积分？这里的 ∇ · E 是多少？'),
      explanation: t(
        `∇ · E = ${ch.a} + ${ch.b} + ${ch.c} = ${chSum}, a constant. By the divergence theorem ∮_S E · dS = ${chSum} · ${ch.s}³ = ${chFlux}. The law ∮_S E · dS = 4πQ gives Q = ${chFlux}/(4π) = (${frac(chFlux, 4)})/π, so k = ${frac(chFlux, 4)}. ${NOT_ASSESSED_EN}`,
        `∇ · E = ${ch.a} + ${ch.b} + ${ch.c} = ${chSum}，是常数。由散度定理 ∮_S E · dS = ${chSum} · ${ch.s}³ = ${chFlux}。由定律 ∮_S E · dS = 4πQ 得 Q = ${chFlux}/(4π) = (${frac(chFlux, 4)})/π，所以 k = ${frac(chFlux, 4)}。${NOT_ASSESSED_ZH}`,
      ),
      audit: { kind: 'MIT-MV-63:challenge', params: { a: ch.a, b: ch.b, c: ch.c, s: ch.s } },
    }),
  ];
};
