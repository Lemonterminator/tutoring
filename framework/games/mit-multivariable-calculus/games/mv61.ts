import type { CardGenerator } from '../../types';
import { axes3d, fitView, project3d, wire3d, type FigureShape, type Pt } from '../../figure';
import { makeMvDeck, num, type Text } from '../support';

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

const NOT_ASSESSED_EN = "This game does not ask you to parametrise surfaces or to prove the topological facts; it checks when 'curl F = 0 implies F = ∇f' applies and what the standard counterexample shows when simple connectivity fails.";
const NOT_ASSESSED_ZH = '本游戏不要求参数化曲面或证明拓扑事实；它检验「curl F = 0 推出 F = ∇f」何时适用，以及单连通性失效时标准反例说明了什么。';

export const mv61: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-61');
  warm(g);

  // 1. definition
  const defDistractors = [
    { id: 'd1', en: 'D is all of 3-space.', zh: 'D 是整个三维空间。', clauseEn: 'All of 3-space is one simply connected domain, but it is an example, not the definition: the inside of a sphere is another one.', clauseZh: '整个三维空间是单连通区域的一个例子而不是定义；球的内部也是单连通的。' },
    { id: 'd2', en: 'Every closed curve in D is a circle.', zh: 'D 中的每条闭曲线都是圆。', clauseEn: 'The closed curves in D may have any shape; what matters is whether they can be shrunk.', clauseZh: 'D 中的闭曲线可以是任意形状，关键是它们能否缩成一点。' },
    { id: 'd3', en: 'Every continuously differentiable vector field in D is a gradient field.', zh: 'D 内每个连续可微的向量场都是梯度场。', clauseEn: 'A gradient field also needs curl F = 0; simple connectivity is the condition on D that makes curl F = 0 enough.', clauseZh: '梯度场还要求旋度为零；单连通是使「旋度为零」足够的区域条件。' },
    { id: 'd4', en: 'D is bounded: it fits inside some ball.', zh: 'D 是有界的：它能放进某个球内。', clauseEn: 'Boundedness is not part of the definition: all of 3-space is simply connected and not bounded.', clauseZh: '有界性不是定义的一部分：整个三维空间是单连通的，却无界。' },
    { id: 'd5', en: 'D is the inside or the outside of a sphere.', zh: 'D 是某个球面的内部或外部。', clauseEn: 'The inside or outside of a sphere are examples; all of 3-space is also simply connected.', clauseZh: '球的内部或外部只是例子；整个三维空间同样是单连通的。' }
  ];
  const defSelected = shuffled(g, defDistractors).slice(0, 3);
  const defOptions = [
    t('Every closed curve in D can be shrunk to a point inside D.', 'D 中的每条闭曲线都能在 D 内缩成一点。'),
    ...defSelected.map(d => t(d.en, d.zh))
  ];

  // 2. region
  const a = g.pick([1, 2, 3]);
  const s = g.pick([1, 2, 3]);
  const badRegions = [
    { id: 'N1', en: 'the inside of a torus (a bagel)', zh: '圆环面（面包圈）的内部', clauseEn: 'A circle going around the hole of the torus cannot be shrunk to a point while staying inside it, so the inside of a torus is not simply connected.', clauseZh: '绕着圆环孔一圈的圆无法在圆环内部缩成一点，所以圆环面的内部不是单连通的。' },
    { id: 'N2', en: `the outside of the cylinder x² + y² = ${a * a}`, zh: `圆柱面 x² + y² = ${a * a} 的外部`, clauseEn: 'A circle around the outside of the cylinder cannot be shrunk to a point without crossing the cylinder, so its outside is not simply connected.', clauseZh: '绕在圆柱外侧一圈的圆无法不穿过圆柱就缩成一点，所以圆柱面的外部不是单连通的。' },
    { id: 'N3', en: '3-space with the z-axis removed', zh: '去掉 z 轴的三维空间', clauseEn: 'A circle around the z-axis cannot be shrunk to a point without meeting the axis, so this region is not simply connected.', clauseZh: '绕 z 轴一圈的圆不碰到 z 轴就无法缩成一点，所以这个区域不是单连通的。' },
    { id: 'N4', en: '3-space with a closed loop of wire removed', zh: '去掉一圈闭合导线的三维空间', clauseEn: 'A closed curve linking with the wire cannot be shrunk to a point without crossing the wire, so the outside of the loop of wire is not simply connected.', clauseZh: '与导线套在一起的闭曲线不穿过导线就无法缩成一点，所以导线圈的外部不是单连通的。' }
  ];
  const badRegion = g.pick(badRegions);
  const regionOptions = [
    t('all of 3-space', '整个三维空间'),
    t(`the inside of the sphere x² + y² + z² = ${s * s}`, `球面 x² + y² + z² = ${s * s} 的内部`),
    t(`the outside of the sphere x² + y² + z² = ${s * s}`, `球面 x² + y² + z² = ${s * s} 的外部`),
    t(badRegion.en, badRegion.zh)
  ];

  // 3. paraboloid
  const pa = g.pick([1, 2, 3, 4]);
  const pr = g.pick([1, 2, 3]);
  const pr2 = pr * pr;
  const par2 = pa * pr2;

  const paraboloidShapes: FigureShape[] = [
    ...axes3d(Math.max(pr, par2) + 1),
    ...wire3d((u, v) => [u * Math.cos(v), u * Math.sin(v), pa * u * u], 0, pr, 0, 2 * Math.PI, 4, 12, 24),
  ];
  const circlePts: Pt[] = [];
  for (let j = 0; j <= 48; j++) {
    const v = (j / 48) * 2 * Math.PI;
    circlePts.push(project3d([pr * Math.cos(v), pr * Math.sin(v), par2]));
  }
  paraboloidShapes.push({ kind: 'line', points: circlePts, tone: 'accent2', width: 2 });

  // 4. mobius
  const mobiusPhrasing = g.pick([1, 2]);
  const mobiusFalsePool = [
    { id: 'f1', en: 'Every closed curve on it can be shrunk to a point, so it is simply connected.', zh: '它上面的每条闭曲线都能缩成一点，所以它是单连通的。', clauseEn: 'So the claim that every closed curve can be shrunk is false.', clauseZh: '所以「每条闭曲线都能缩成一点」的说法是错的。' },
    { id: 'f2', en: 'It has two sides, so a continuous unit normal vector n can be chosen over the whole strip.', zh: '它有两个侧面，所以可以在整条带上连续地选取单位法向量 n。', clauseEn: 'Separately, the strip has only one side: a normal vector moved once around the loop comes back as −n, so no continuous normal exists (V14, p. 1).', clauseZh: '另外，这条带只有一个侧面：法向量绕一圈回来变成 −n，所以不存在连续的法向量（V14 第 1 页）。' },
    { id: 'f3', en: 'The flux of a vector field through it is well defined, because a consistent positive direction through the strip can be chosen.', zh: '穿过它的向量场通量有确定的意义，因为可以在带上一致地选定穿过的正方向。', clauseEn: 'Because the strip has only one side there is no consistent positive direction through it, so the flux through it makes no sense (V14, p. 1).', clauseZh: '这条带只有一个侧面，没有一致的穿过方向，所以谈不上穿过它的通量（V14 第 1 页）。' },
    { id: 'f4', en: "Stokes' theorem applies to the strip and its edge, because the strip can be oriented.", zh: "斯托克斯定理适用于这条带及其边缘，因为这条带可以定向。", clauseEn: "Because the strip has only one side it cannot be oriented, and Stokes' theorem does not apply to such surfaces (V14, p. 1).", clauseZh: '这条带只有一个侧面，无法定向，斯托克斯定理不适用于这类曲面（V14 第 1 页）。' }
  ];
  const mobiusSelected = shuffled(g, mobiusFalsePool).slice(0, 3);
  const mobiusOptions = [
    t('It is not simply connected: a closed curve going once around the loop of the strip cannot be shrunk to a point without leaving the strip.', '它不是单连通的：沿带子绕一圈的闭曲线，不离开带子就无法缩成一点。'),
    ...mobiusSelected.map(f => t(f.en, f.zh))
  ];

  // 5. circle-setup
  const R = g.pick([2, 3, 4, 5]);
  const z0 = g.pick([1, 2, 3]);
  const R2 = R * R;

  const circleSetupShapes: FigureShape[] = [...axes3d(Math.max(R, z0) + 1)];
  const circleSetupPts: Pt[] = [];
  for (let j = 0; j <= 48; j++) {
    const v = (j / 48) * 2 * Math.PI;
    circleSetupPts.push(project3d([R * Math.cos(v), R * Math.sin(v), z0]));
  }
  circleSetupShapes.push({ kind: 'line', points: circleSetupPts, tone: 'accent', width: 2 });
  const t1 = Math.PI / 4;
  const t2 = Math.PI / 4 + 0.4;
  circleSetupShapes.push({ kind: 'arrow', from: project3d([R * Math.cos(t1), R * Math.sin(t1), z0]), to: project3d([R * Math.cos(t2), R * Math.sin(t2), z0]), tone: 'accent', width: 2 });

  // 6. counterexample
  const counterShapes: FigureShape[] = [...circleSetupShapes];
  counterShapes.push({ kind: 'line', points: [project3d([0, 0, -1]), project3d([0, 0, z0 + 2])], tone: 'warn', dash: true, width: 1 });

  const counterOptions = [
    t('F is not a gradient field on D although curl F = 0: ∮_C F · dr = 2π ≠ 0.', '尽管 curl F = 0，F 在 D 上不是梯度场：∮_C F · dr = 2π ≠ 0。'),
    t('F is a gradient field on D, because curl F = 0 at every point of D.', 'F 在 D 上是梯度场，因为 D 内每一点处 curl F = 0。'),
    t(`∮_C F · dr = 0, because C bounds the flat disc x² + y² ≤ ${R2} in the plane z = ${z0}, on which curl F = 0.`, `∮_C F · dr = 0，因为 C 围成平面 z = ${z0} 内的圆盘 x² + y² ≤ ${R2}，而圆盘上 curl F = 0。`),
    t(`∮_C F · dr = ${2 * R2}π, because |F| = ${R} on C and C has length 2π·${R}.`, `∮_C F · dr = ${2 * R2}π，因为在 C 上 |F| = ${R}，而 C 的长度为 2π·${R}。`)
  ];

  // 7. winding
  const n = g.pick([2, 3, 4, 5, 6, 7]);
  const windingAnswer = 2 * n;

  // 8. flux-split
  const L = g.pick(['C', 'Γ', 'K']);
  const Sp = g.pick(['S₁', 'S₂']);
  const fluxAnswers = Sp === 'S₁' ? [L, `−${L}`, '0'] : [`−${L}`, L, '0'];
  const fluxTokens = shuffled(g, [L, `−${L}`, '0', ...(lang === 'zh' ? [`2∮ 沿 ${L} 的 G · dr`, `∮ 沿 ${L} 的 G · dr`, 'S₁ 的面积'] : [`2∮ over ${L} of G · dr`, `∮ over ${L} of G · dr`, 'the area of S₁'])]);

  // 9. challenge
  const p = g.pick([1, 2, 3, 4]);
  const q = retry(() => g.pick([1, 2, 3]), v => v !== p);
  const challengeAnswer = 2 * (p - q);

  return [
    g.choice({
      id: 'definition',
      title: t('The definition', '单连通的定义'),
      prompt: t('Which statement is the definition of a simply connected domain D in 3-space?', '下列哪条是三维空间中单连通区域 D 的定义？'),
      options: defOptions,
      correct: 0,
      hint: t('Picture a loop of string lying in D. Can you always pull it tight to a single point without lifting it out of D?', '想象 D 内放着一圈绳子：能否总是在不离开 D 的情况下把它拉紧成一个点？'),
      explanation: t(
        `A domain D in 3-space is simply connected when each closed curve in it can be shrunk to a point without ever getting outside of D (V14, definition). ${defSelected.map(d => d.clauseEn).join(' ')}`,
        `三维空间中的区域 D 是单连通的，当且仅当其中每条闭曲线都能缩成一点，且收缩过程始终不离开 D（V14 中的定义）。${defSelected.map(d => d.clauseZh).join('')}`
      ),
    }),
    g.choice({
      id: 'region',
      title: t('Which region has a hole?', '哪个区域不是单连通的？'),
      prompt: t('Which of these regions of 3-space is NOT simply connected?', '下列三维空间中的区域，哪一个不是单连通的？'),
      options: regionOptions,
      correct: 3,
      hint: t('A region is not simply connected when some closed curve in it goes around something and cannot be pulled tight inside the region.', '若区域内有一条闭曲线绕着某物一圈，并且无法在区域内拉紧成一点，则区域不是单连通的。'),
      explanation: t(
        `All of 3-space and the inside or outside of a sphere are simply connected (V14, p. 2). ${badRegion.clauseEn}`,
        `整个三维空间以及球的内部或外部都是单连通的（V14，第 2 页）。${badRegion.clauseZh}`
      ),
    }),
    g.choice({
      id: 'paraboloid',
      title: t('Is the paraboloid simply connected?', '抛物面是单连通的吗？'),
      prompt: t(
        `Let S be the paraboloid z = ${pa === 1 ? '' : pa}x² + ${pa === 1 ? '' : pa}y², a surface in 3-space, and let C be the circle x² + y² = ${pr2}, z = ${par2}, which lies on S. Is S a simply connected surface?`,
        `设 S 是抛物面 z = ${pa === 1 ? '' : pa}x² + ${pa === 1 ? '' : pa}y²，它是三维空间中的一张曲面；C 是圆 x² + y² = ${pr2}，z = ${par2}，它在 S 上。S 是单连通曲面吗？`
      ),
      options: [
        t('Yes: every closed curve on S, for example C, can be shrunk to a point while staying on S.', '是：S 上每条闭曲线（例如 C）都能在 S 上缩成一点。'),
        t('No: C goes around the z-axis, so it cannot be shrunk to a point.', '不是：C 绕着 z 轴一圈，所以不能缩成一点。'),
        t('No: S is unbounded.', '不是：S 是无界的。'),
        t('Yes: S is a closed surface.', '是：S 是闭曲面。')
      ],
      correct: 0,
      hint: t('Ask whether C can be moved along S, always staying on S, until it becomes a single point.', '想一想：能否让 C 始终留在 S 上移动，直到变成一个点？'),
      explanation: t(
        `The circles x² + y² = s², z = ${pa === 1 ? '' : pa}s² (s from ${pr} down to 0) all lie on S and shrink C to the vertex (0, 0, 0), always staying on S. More generally, any closed curve on S can be shrunk to a point by flattening the part of S that contains it and shrinking the curve in the plane (S94, problem 1). The axis is not removed from S: the vertex lies on S. So S is simply connected.`,
        `圆 x² + y² = s²，z = ${pa === 1 ? '' : pa}s²（s 从 ${pr} 减到 0）都在 S 上，它们把 C 始终留在 S 上缩到顶点 (0, 0, 0)。一般地，S 上任意闭曲线所在的那一块曲面压平后，曲线可在平面内缩成一点（S94 第 1 题）。顶点在 S 上，并没有被去掉。所以 S 是单连通曲面。`
      ),
      figure: g.figure({
        alt: t(
          `The paraboloid z = ${pa === 1 ? '' : pa}x² + ${pa === 1 ? '' : pa}y² for radius up to ${pr}, with the circle x² + y² = ${pr2} at height z = ${par2} marked on it.`,
          `抛物面 z = ${pa === 1 ? '' : pa}x² + ${pa === 1 ? '' : pa}y²（半径至多为 ${pr}），其上标出高度 z = ${par2} 处的圆 x² + y² = ${pr2}。`
        ),
        view: fitView(paraboloidShapes, 0.25),
        shapes: paraboloidShapes,
      }),
    }),
    g.choice({
      id: 'mobius',
      title: t('The Möbius strip', '莫比乌斯带'),
      prompt: mobiusPhrasing === 1
        ? t('A Möbius strip is made from a long thin rectangle of paper by joining its ends after an odd number of half-twists. Which statement about it is correct?', '莫比乌斯带是把一个细长的纸条扭转奇数个半圈后将两端粘起来得到的。下列哪条说法正确？')
        : t('Take a long thin rectangle of paper and join its ends after an odd number of half-twists to make a Möbius strip. Which of these statements is correct?', '把细长纸条扭转奇数个半圈后将两端粘起来，得到莫比乌斯带。下列哪条说法是正确的？'),
      options: mobiusOptions,
      correct: 0,
      hint: t('Picture a curve running along the length of the strip, all the way around the loop. Can you pull it tight to a point on the strip?', '想象一条沿着带子全长绕一圈的曲线：能否在带子上把它拉紧成一点？'),
      explanation: t(
        `A closed curve around the loop of a Möbius strip cannot be shrunk to a point without getting outside of the strip, so the strip is not simply connected (S94, problem 2). ${mobiusSelected.map(f => f.clauseEn).join(' ')}`,
        `绕着莫比乌斯带一圈的闭曲线，不离开带子就无法缩成一点，所以这条带不是单连通的（S94 第 2 题）。${mobiusSelected.map(f => f.clauseZh).join('')}`
      ),
    }),
    g.symbols({
      id: 'circle-setup',
      title: t('Set up the circle integral', '写出圆上的积分'),
      prompt: t(
        `F = (−y i + x j)/(x² + y²) is defined on D = 3-space with the z-axis removed. C is the circle r(t) = (${R} cos t, ${R} sin t, ${z0}), 0 ≤ t ≤ 2π, run in the direction of increasing t (counterclockwise viewed from above, so the right thumb points along +z). Complete the computation: F(r(t)) · r′(t) = [ ] , so ∮_C F · dr = the integral from t = 0 to t = [ ] of that constant dt = [ ] .`,
        `F = (−y i + x j)/(x² + y²) 定义在去掉 z 轴的三维空间 D 上。C 是圆 r(t) = (${R} cos t, ${R} sin t, ${z0})，0 ≤ t ≤ 2π，沿 t 增大的方向运行（从上往下看为逆时针，右手拇指指向 +z）。补全计算：F(r(t)) · r′(t) = [ ]，所以 ∮_C F · dr = 从 t = 0 到 t = [ ] 对该常数积分 dt = [ ]。`
      ),
      before: 'F(r(t)) · r′(t) = ',
      between: lang === 'zh' ? ['，所以 ∮_C F · dr = 从 t = 0 到 t = ', ' 对该常数积分 dt = '] : [', so ∮_C F · dr = the integral from t = 0 to t = ', ' of that constant dt = '],
      after: t('.', '。'),
      answers: ['1', '2π', '2π'],
      tokens: shuffled(g, ['1', String(R), `1/${R}`, String(R2), '2π', 'π', `${2 * R}π`, `${2 * R2}π`]),
      hint: t(
        `On C, x² + y² = ${R2}. Compute F(r(t)) = (−${R} sin t, ${R} cos t, 0)/${R2} and r′(t) = (−${R} sin t, ${R} cos t, 0), then take the dot product.`,
        `在 C 上 x² + y² = ${R2}。算出 F(r(t)) = (−${R} sin t, ${R} cos t, 0)/${R2} 与 r′(t) = (−${R} sin t, ${R} cos t, 0)，再作点积。`
      ),
      explanation: t(
        `F(r(t)) · r′(t) = (${R2} sin² t + ${R2} cos² t)/${R2} = 1, so ∮_C F · dr = ∫ from 0 to 2π of 1 dt = 2π. The value does not depend on the radius ${R} or on the height ${z0} (V14, p. 3).`,
        `F(r(t)) · r′(t) = (${R2} sin² t + ${R2} cos² t)/${R2} = 1，所以 ∮_C F · dr = 从 0 到 2π 对 1 积分 = 2π。结果与半径 ${R} 和高度 ${z0} 无关（V14 第 3 页）。`
      ),
      figure: g.figure({
        alt: t(
          `A circle of radius ${R} in the plane z = ${z0}, centred on the z-axis, with an arrow showing counterclockwise motion viewed from above.`,
          `平面 z = ${z0} 内以 z 轴为中心、半径为 ${R} 的圆，箭头表示从上往下看为逆时针的运行方向。`
        ),
        view: fitView(circleSetupShapes, 0.25),
        shapes: circleSetupShapes,
      }),
    }),
    g.choice({
      id: 'counterexample',
      title: t('curl F = 0 but not a gradient field', '旋度为零却不是梯度场'),
      prompt: t(
        `Let D be 3-space with the z-axis removed and F = (−y i + x j)/(x² + y²) on D; curl F = 0 at every point of D. C is the circle of radius ${R} in the plane z = ${z0} centred on the z-axis, run counterclockwise viewed from above (right thumb along +z, fingers along C). Which statement is correct?`,
        `设 D 是去掉 z 轴的三维空间，D 上的场 F = (−y i + x j)/(x² + y²)，且 D 内每一点处 curl F = 0。C 是平面 z = ${z0} 内以 z 轴为中心、半径为 ${R} 的圆，从上往下看为逆时针方向运行（右手拇指指向 +z，四指沿 C）。下列哪条说法正确？`
      ),
      options: counterOptions,
      correct: 0,
      hint: t('Which hypothesis of the theorem \'curl F = 0 ⇒ F = ∇f\' can fail for this D? Look at where a disc bounded by C would have to lie.', '定理「curl F = 0 ⇒ F = ∇f」的哪个假设在这个 D 上可能不成立？想想以 C 为边界的圆盘会落在哪里。'),
      explanation: t(
        `On C, F · dr = 1 · dt, so ∮_C F · dr = 2π (V14, p. 3), not 0: F is not conservative, hence not a gradient field. The theorem 'curl F = 0 ⇒ F = ∇f' needs a simply connected domain, and D is not: a circle around the z-axis cannot be shrunk to a point inside D. Any surface bounded by C must cross the z-axis, which is not in D, so Stokes' theorem cannot be used to get 0.`,
        `在 C 上 F · dr = 1 · dt，所以 ∮_C F · dr = 2π（V14 第 3 页），不是 0：F 不是保守场，因此不是梯度场。定理「curl F = 0 ⇒ F = ∇f」要求区域单连通，而 D 不是：绕 z 轴一圈的圆无法在 D 内缩成一点。以 C 为边界的任何曲面都必须穿过 z 轴，而 z 轴不在 D 内，所以不能用斯托克斯定理得到 0。`
      ),
      figure: g.figure({
        alt: t(
          `A circle of radius ${R} in the plane z = ${z0}, centred on the z-axis, with an arrow showing counterclockwise motion viewed from above. The z-axis is the part removed from D.`,
          `平面 z = ${z0} 内以 z 轴为中心、半径为 ${R} 的圆，箭头表示从上往下看为逆时针的运行方向。z 轴是从 D 中去掉的部分。`
        ),
        view: fitView(counterShapes, 0.25),
        shapes: counterShapes,
      }),
    }),
    g.number({
      id: 'winding',
      title: t('Winding n times', '绕 n 圈'),
      prompt: t(
        `F = (−y i + x j)/(x² + y²) on D = 3-space with the z-axis removed. C is a closed curve in D that goes ${n} times around the z-axis, oriented so that the right thumb points along +z and the fingers curl in the positive direction on C (counterclockwise viewed from above). The line integral ∮_C F · dr equals k·π. Enter k.`,
        `F = (−y i + x j)/(x² + y²)，定义在去掉 z 轴的三维空间 D 上。C 是 D 内绕 z 轴 ${n} 圈的闭曲线，取向使右手拇指指向 +z、四指弯曲的方向为 C 的正方向（从上往下看为逆时针）。线积分 ∮_C F · dr 等于 k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: windingAnswer }],
      hint: t('Once around gives 2π (previous cards). How does the integral change when C goes around several times?', '绕一圈得 2π（见前面的卡片）。绕多圈时积分怎样变化？'),
      explanation: t(
        `Each trip around the z-axis contributes 2π (V14, p. 3), so going around ${n} times gives ${n}·2π = ${2 * n}π and k = ${2 * n}.`,
        `每绕 z 轴一圈贡献 2π（V14 第 3 页），所以绕 ${n} 圈得 ${n}·2π = ${2 * n}π，k = ${2 * n}。`
      ),
      audit: { kind: 'MIT-MV-61:winding', params: { n } },
    }),
    g.symbols({
      id: 'flux-split',
      title: t('Splitting a closed surface', '把闭曲面一分为二'),
      prompt: t(
        `G has continuous second partial derivatives and F = curl G. S is a closed surface with the outward orientation. The closed curve ${L} cuts S into two parts S₁ and S₂, and ${L} is the positive boundary of ${Sp} (Stokes' theorem with the orientation of S). Complete: ∬_S F · n dS = ∬_{S₁} F · n dS + ∬_{S₂} F · n dS = ∮ over [ ] of G · dr + ∮ over [ ] of G · dr = [ ] .`,
        `G 有连续的二阶偏导数，F = curl G。S 是取外侧定向的闭曲面。闭曲线 ${L} 把 S 分成 S₁ 和 S₂ 两部分，${L} 是 ${Sp} 的正向边界曲线（斯托克斯定理，沿用 S 的定向）。补全：∬_S F · n dS = ∬_{S₁} F · n dS + ∬_{S₂} F · n dS = 沿 [ ] 的 ∮ G · dr + 沿 [ ] 的 ∮ G · dr = [ ]。`
      ),
      before: t('∬_S F · n dS = ∬_{S₁} F · n dS + ∬_{S₂} F · n dS = ∮ over ', '∬_S F · n dS = ∬_{S₁} F · n dS + ∬_{S₂} F · n dS = 沿 '),
      between: lang === 'zh' ? [' 的 ∮ G · dr + 沿 ', ' 的 ∮ G · dr = '] : [' of G · dr + ∮ over ', ' of G · dr = '],
      after: t('.', '。'),
      answers: fluxAnswers,
      tokens: fluxTokens,
      hint: t(
        `Stokes' theorem turns each surface integral of curl G into a line integral of G over its boundary. The two parts S₁ and S₂ share the curve ${L}. Which direction does each part induce on it?`,
        `斯托克斯定理把 curl G 在每一块曲面上的积分化为 G 沿其边界曲线的线积分。S₁ 和 S₂ 共有曲线 ${L}，它们各自在 ${L} 上诱导出什么方向？`
      ),
      explanation: t(
        `By Stokes' theorem the part with positive boundary ${L} gives ∮ over ${L} of G · dr, and the other part sees the same curve with the opposite direction, giving ∮ over −${L} of G · dr. The two line integrals are negatives of each other, so the sum is 0: the flux of F = curl G through a closed surface is 0 (S95).`,
        `由斯托克斯定理，以 ${L} 为正向边界的那一块给出沿 ${L} 的 ∮ G · dr，另一块在同一条曲线上的方向相反，给出沿 −${L} 的 ∮ G · dr。两个线积分互为相反数，和为 0：F = curl G 穿过闭曲面的通量为 0（S95）。`
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Three loops', '三条闭曲线'),
      prompt: t(
        `F = (−y i + x j)/(x² + y²) is defined on D = 3-space with the z-axis removed, and curl F = 0 at every point of D. Three closed curves lie in D. C₁ goes ${p} ${p === 1 ? 'time' : 'times'} around the z-axis, counterclockwise viewed from above. C₂ goes ${q} ${q === 1 ? 'time' : 'times'} around the z-axis, clockwise viewed from above. C₃ is the circle of radius 1 in the plane z = 0 centred at (4, 0, 0), run counterclockwise viewed from above. Then ∮_{C₁} F · dr + ∮_{C₂} F · dr + ∮_{C₃} F · dr = k·π. Enter k.`,
        `F = (−y i + x j)/(x² + y²) 定义在去掉 z 轴的三维空间 D 上，且 D 内每一点处 curl F = 0。D 内有三条闭曲线。C₁ 绕 z 轴 ${p} 圈，从上往下看为逆时针。C₂ 绕 z 轴 ${q} 圈，从上往下看为顺时针。C₃ 是平面 z = 0 内以 (4, 0, 0) 为圆心、半径为 1 的圆，从上往下看为逆时针。则 ∮_{C₁} F · dr + ∮_{C₂} F · dr + ∮_{C₃} F · dr = k·π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: challengeAnswer }],
      hint: t('Count each curve\'s turns with a sign (counterclockwise positive). What does a curve that does not go around the z-axis contribute?', '给每条曲线的圈数加上符号（逆时针为正）。不绕 z 轴的曲线贡献多少？'),
      explanation: t(
        `C₁ gives ${p}·2π. C₂ runs the opposite way and gives −${q}·2π (V14, p. 3: n = −1 for the opposite direction). C₃ does not go around the z-axis: it can be shrunk to a point inside D, so its integral is 0. The sum is 2π(${p} − ${q}) = ${num(challengeAnswer)}π, so k = ${num(challengeAnswer)}. ${NOT_ASSESSED_EN}`,
        `C₁ 给出 ${p}·2π。C₂ 方向相反，给出 −${q}·2π（V14 第 3 页：反向对应 n = −1）。C₃ 不绕 z 轴：它可以在 D 内缩成一点，所以积分为 0。总和为 2π(${p} − ${q}) = ${num(challengeAnswer)}π，k = ${num(challengeAnswer)}。${NOT_ASSESSED_ZH}`
      ),
      audit: { kind: 'MIT-MV-61:challenge', params: { p, q } },
    }),
  ];
};
