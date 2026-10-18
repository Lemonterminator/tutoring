import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, line3d, project3d, wire3d, type FigureShape, type Pt } from '../../figure';
import { coef, frac, gcd, makeMvDeck, num, par, term, type Text } from '../support';

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

export const mv54: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-54');
  warm(g);

  // --- radial-mag ---
  const bases: [number, number, number][] = [[1, 2, 2], [2, 4, 4], [2, 3, 6]];
  const base = g.pick(bases);
  const perm = shuffled(g, [0, 1, 2]);
  const signs = [g.pick([-1, 1]), g.pick([-1, 1]), g.pick([-1, 1])];
  const rmX = base[perm[0]] * signs[0];
  const rmY = base[perm[1]] * signs[1];
  const rmZ = base[perm[2]] * signs[2];
  const rmC = g.random(1, 6);
  const rmRho2 = rmX * rmX + rmY * rmY + rmZ * rmZ;
  const rmAns = rmC / rmRho2;

  // --- field-id ---
  const fidAxis = g.pick(['z', 'y']);
  const fidW = g.random(2, 7);

  // --- grav-setup ---
  const gsA = g.random(2, 7);

  // --- grav-value ---
  const gvA = g.random(2, 7);
  const gvAns = gvA * gvA / 3;

  // --- orientation ---
  const orSolid = g.pick(['ball', 'cube', 'can']);
  const orPhi = g.pick([-12, -8, -5, 5, 8, 12]);

  // --- hemi-setup ---
  const hsR = g.random(2, 7);

  // --- hemi-flux ---
  const hfK = g.pick([2, 3, 4]);
  const hfR = g.random(2, 5);
  const hfAns = 2 * hfK * hfR * hfR * hfR;

  // --- plane-null ---
  const pnK = g.random(1, 4);
  const pnB = g.pick([2, 3, 4]);
  const pnC = g.pick([3, 4, 5]);

  // --- challenge ---
  const chC = g.random(1, 6);
  const chR = g.random(2, 5);
  const chAns = 4 * chC;

  // --- Figures ---
  // radial-mag: coordinate axes and the arrow from the origin to P
  const rmShapes: FigureShape[] = [
    ...axes3d(7),
    arrow3d([0, 0, 0], [rmX, rmY, rmZ], 'accent', 'P'),
    { kind: 'point', at: project3d([rmX, rmY, rmZ]), tone: 'warn', label: 'P' },
  ];
  // grav-setup: the upper half-ball with the point mass m0 at the origin
  const gsShapes: FigureShape[] = [
    ...wire3d((phi, th) => [gsA * Math.sin(phi) * Math.cos(th), gsA * Math.sin(phi) * Math.sin(th), gsA * Math.cos(phi)], 0, Math.PI / 2, 0, 2 * Math.PI, 3, 8, 24),
    line3d(Array.from({ length: 25 }, (_, i) => [gsA * Math.cos(i * Math.PI / 12), gsA * Math.sin(i * Math.PI / 12), 0] as [number, number, number]), 'accent'),
    ...axes3d(gsA + 1),
    { kind: 'point', at: project3d([0, 0, 0]), tone: 'warn', label: 'm0' },
  ];
  // hemi-setup / hemi-flux: the upper hemisphere with four outward normals
  const hemiShapes = (R: number): FigureShape[] => {
    const dirs: [number, number][] = [[Math.PI / 4, 0], [Math.PI / 4, Math.PI / 2], [Math.PI / 4, Math.PI], [Math.PI / 4, 3 * Math.PI / 2]];
    return [
      ...wire3d((phi, th) => [R * Math.sin(phi) * Math.cos(th), R * Math.sin(phi) * Math.sin(th), R * Math.cos(phi)], 0, Math.PI / 2, 0, 2 * Math.PI, 3, 8, 24),
      ...axes3d(R + 1),
      ...dirs.map(([phi, th]): FigureShape => {
        const p: [number, number, number] = [R * Math.sin(phi) * Math.cos(th), R * Math.sin(phi) * Math.sin(th), R * Math.cos(phi)];
        return arrow3d(p, [1.25 * p[0], 1.25 * p[1], 1.25 * p[2]], 'accent2');
      }),
    ];
  };
  // plane-null: the tilted rectangle with the upward normal n and the in-plane field arrows F
  const pnShapes: FigureShape[] = [
    ...axes3d(Math.max(pnB, pnC) + 1),
    line3d([[0, 0, pnC], [0, pnB, pnC], [pnC, pnB, 0], [pnC, 0, 0], [0, 0, pnC]], 'accent'),
    arrow3d([pnC / 2, pnB / 2, pnC / 2], [pnC / 2 + 0.8, pnB / 2, pnC / 2 + 0.8], 'accent2', 'n'),
    ...[0.25, 0.5, 0.75].map((f, i): FigureShape => arrow3d([f * pnC, pnB / 2, pnC - f * pnC], [f * pnC, pnB / 2 + 0.6, pnC - f * pnC], 'accent', i === 0 ? 'F' : undefined)),
  ];

  return [
    // 1. radial-mag
    g.number({
      id: 'radial-mag',
      title: t('Strength of a point source', '点源场的大小'),
      prompt: t(
        `In suitable units the field of a point charge at the origin is F = ${coef(rmC, '')}(x, y, z)/ρ³, where ρ = √(x² + y² + z²) (written (x, y, z)/ρ³ when C = 1). At the point P = (${num(rmX)}, ${num(rmY)}, ${num(rmZ)}), find the magnitude |F|. Enter an integer or a fraction.`,
        `在适当的单位下，原点处点电荷的场为 F = ${coef(rmC, '')}(x, y, z)/ρ³，其中 ρ = √(x² + y² + z²)（C = 1 时写作 (x, y, z)/ρ³）。求点 P = (${num(rmX)}, ${num(rmY)}, ${num(rmZ)}) 处的大小 |F|。填写整数或分数。`
      ),
      fields: [{ label: t('|F|', '|F|'), answer: rmAns }],
      hint: t(
        'F points along the vector (x, y, z) from the origin to P. How long is that vector?',
        'F 沿着从原点指向 P 的向量 (x, y, z) 的方向。这个向量有多长？'
      ),
      explanation: t(
        `ρ² = (${num(rmX)})² + (${num(rmY)})² + (${num(rmZ)})² = ${rmRho2}, so ρ = ${Math.sqrt(rmRho2)}. The vector (x, y, z) has length ρ, so |F| = ${rmC}·ρ/ρ³ = ${rmC}/ρ² = ${rmC}/${rmRho2}, which is ${frac(rmC, rmRho2)} in lowest terms.`,
        `ρ² = (${num(rmX)})² + (${num(rmY)})² + (${num(rmZ)})² = ${rmRho2}，所以 ρ = ${Math.sqrt(rmRho2)}。向量 (x, y, z) 的长度是 ρ，因此 |F| = ${rmC}·ρ/ρ³ = ${rmC}/ρ² = ${rmC}/${rmRho2}，约分后是 ${frac(rmC, rmRho2)}。`
      ),
      figure: g.figure({
        alt: t(
          `Three coordinate axes and an arrow from the origin to the point P = (${num(rmX)}, ${num(rmY)}, ${num(rmZ)}).`,
          `三条坐标轴，以及从原点指向点 P = (${num(rmX)}, ${num(rmY)}, ${num(rmZ)}) 的箭头。`
        ),
        view: fitView(rmShapes, 0.25),
        shapes: rmShapes,
      }),
      audit: { kind: 'MIT-MV-54:radial-mag', params: { C: rmC, x: rmX, y: rmY, z: rmZ } },
    }),

    // 2. field-id
    g.choice({
      id: 'field-id',
      title: t('Which rotating field?', '哪个是旋转场？'),
      prompt: t(
        `A fluid rotates steadily about the ${fidAxis}-axis with constant angular velocity ω = ${fidW}. When the right thumb points along the positive ${fidAxis}-axis, the right-hand fingers curl in the direction of the flow. Which of these is the velocity field F of the fluid?`,
        `流体绕 ${fidAxis} 轴匀速旋转，角速度 ω = ${fidW}。右手拇指指向 ${fidAxis} 轴正方向时，四指弯曲的方向就是流动方向。下面哪个是流体的速度场 F？`
      ),
      options: fidAxis === 'z'
        ? [
            t(`F = ${fidW}(−y, x, 0)`, `F = ${fidW}(−y, x, 0)`),
            t(`F = ${fidW}(y, −x, 0)`, `F = ${fidW}(y, −x, 0)`),
            t(`F = ${fidW}(x, y, 0)`, `F = ${fidW}(x, y, 0)`),
            t(`F = ${fidW}(z, 0, −x)`, `F = ${fidW}(z, 0, −x)`),
          ]
        : [
            t(`F = ${fidW}(z, 0, −x)`, `F = ${fidW}(z, 0, −x)`),
            t(`F = ${fidW}(−z, 0, x)`, `F = ${fidW}(−z, 0, x)`),
            t(`F = ${fidW}(x, 0, z)`, `F = ${fidW}(x, 0, z)`),
            t(`F = ${fidW}(−y, x, 0)`, `F = ${fidW}(−y, x, 0)`),
          ],
      correct: 0,
      hint: t(
        'Put your right hand around the axis and find the direction of the flow at one point on a coordinate axis: (1, 0, 0) for rotation about the z-axis, (0, 0, 1) for rotation about the y-axis.',
        '把右手握住转轴，找出坐标轴上一点处的流动方向：绕 z 轴取 (1, 0, 0)，绕 y 轴取 (0, 0, 1)。'
      ),
      explanation: fidAxis === 'z'
        ? t(
            `At (1, 0, 0) the right-hand rule with the thumb along +z gives flow in the +y direction, and the speed there is ${fidW}. The field ${fidW}(−y, x, 0) gives ${fidW}(0, 1, 0) at that point, and it does not depend on z. The field with y and −x is the same rotation run backwards, the field with x and y points away from the axis, and the field with z and −x turns about the y-axis.`,
            `在 (1, 0, 0) 处，拇指沿 +z 时右手法则给出沿 +y 方向的流动，速度为 ${fidW}。场 ${fidW}(−y, x, 0) 在该点为 ${fidW}(0, 1, 0)，且与 z 无关。含 y 与 −x 的场是方向相反的旋转，含 x 与 y 的场指向远离转轴的方向，含 z 与 −x 的场绕 y 轴旋转。`
          )
        : t(
            `At (0, 0, 1) the right-hand rule with the thumb along +y gives flow in the +x direction. The field ${fidW}(z, 0, −x) gives ${fidW}(1, 0, 0) there, and it does not depend on y. The field with −z and x is the same rotation backwards, the field with x and z points away from the axis, and the field with −y and x turns about the z-axis.`,
            `在 (0, 0, 1) 处，拇指沿 +y 时右手法则给出沿 +x 方向的流动。场 ${fidW}(z, 0, −x) 在该点为 ${fidW}(1, 0, 0)，且与 y 无关。含 −z 与 x 的场是方向相反的旋转，含 x 与 z 的场指向远离转轴的方向，含 −y 与 x 的场绕 z 轴旋转。`
          ),
    }),

    // 3. grav-setup
    g.symbols({
      id: 'grav-setup',
      title: t('Set up the attraction', '写出引力的积分'),
      prompt: t(
        `The upper half of a solid ball of radius ${gsA}, centred at the origin, has density δ = z. It attracts a point mass m0 at the origin. By symmetry Fx = Fy = 0, and the vertical component is Fz = G m0 ∭ z²/ρ³ dV over the half-ball, with ρ² = x² + y² + z². In spherical coordinates, φ is measured from the positive z-axis, z = ρ cos φ and dV = ρ² sin φ dρ dφ dθ. Complete the bounds and the integrand (the integrand already includes the factor from dV).`,
        `半径为 ${gsA}、球心在原点的实心球的上半部分密度 δ = z，它吸引原点处的质点 m0。由对称性 Fx = Fy = 0，竖直分量为 Fz = G m0 ∭ z²/ρ³ dV，积分区域是该半球体，ρ² = x² + y² + z²。在球坐标中，φ 是从正 z 轴量起的角，z = ρ cos φ，dV = ρ² sin φ dρ dφ dθ。补全积分限和被积函数（被积函数已包含 dV 中的因子）。`
      ),
      before: lang === 'zh' ? 'Fz = G m0 ×（θ 从 0 到 2π，φ 从 0 到 ' : 'Fz = G m0 × (θ from 0 to 2π, φ from 0 to ',
      between: lang === 'zh' ? ['，ρ 从 0 到 ', '），被积函数 '] : [', ρ from 0 to ', '), integrand '],
      after: lang === 'zh' ? '，积分顺序 dρ、dφ、dθ' : ' , in the order dρ dφ dθ',
      answers: ['π/2', String(gsA), 'ρ cos² φ sin φ'],
      tokens: shuffled(g, ['π/2', 'π', 'π/4', String(gsA), String(gsA * gsA), 'ρ cos² φ sin φ', 'cos² φ sin φ / ρ', 'ρ cos φ sin φ', 'ρ² cos² φ sin φ']),
      figure: g.figure({
        alt: t(
          `The upper half of a ball of radius ${gsA} centred at the origin, with the point mass m0 at the origin.`,
          `球心在原点、半径为 ${gsA} 的球的上半部分，质点 m0 位于原点。`
        ),
        view: fitView(gsShapes, 0.25),
        shapes: gsShapes,
      }),
      hint: t(
        'Substitute z = ρ cos φ: z²/ρ³ = cos² φ/ρ. Then multiply by the factor ρ² sin φ from dV.',
        '代入 z = ρ cos φ：z²/ρ³ = cos² φ/ρ。再乘以 dV 中的因子 ρ² sin φ。'
      ),
      explanation: t(
        `With z = ρ cos φ, z²/ρ³ = cos² φ/ρ. Multiplying by ρ² sin φ from dV gives the integrand ρ cos² φ sin φ. For the upper half-ball, ρ runs from 0 to ${gsA}, φ from 0 to π/2 and θ from 0 to 2π.`,
        `代入 z = ρ cos φ，得 z²/ρ³ = cos² φ/ρ。再乘以 dV 中的 ρ² sin φ，被积函数就是 ρ cos² φ sin φ。上半球体中 ρ 从 0 到 ${gsA}，φ 从 0 到 π/2，θ 从 0 到 2π。`
      ),
    }),

    // 4. grav-value
    g.number({
      id: 'grav-value',
      title: t('The attraction of the half-ball', '半球体的引力'),
      prompt: t(
        `The upper half of a solid ball of radius ${gvA}, centred at the origin, has density δ = z. It attracts a point mass m0 at the origin with the force (0, 0, Fz), where Fz = G m0 ∭ z²/ρ³ dV over the half-ball (ρ² = x² + y² + z²). The result has the form Fz = k · G m0 π. Enter k, an integer or a fraction.`,
        `半径为 ${gvA}、球心在原点的实心球的上半部分密度 δ = z，它对原点处的质点 m0 的引力为 (0, 0, Fz)，其中 Fz = G m0 ∭ z²/ρ³ dV，积分区域是该半球体（ρ² = x² + y² + z²）。结果形如 Fz = k · G m0 π。求 k，填写整数或分数。`
      ),
      fields: [{ label: t('k', 'k'), answer: gvAns }],
      hint: t(
        `In spherical coordinates (φ from the positive z-axis) the integrand is ρ cos² φ sin φ; integrate ρ from 0 to ${gvA}, φ from 0 to π/2, θ from 0 to 2π, one variable at a time.`,
        `在球坐标中（φ 从正 z 轴量起）被积函数是 ρ cos² φ sin φ；依次对 ρ 从 0 到 ${gvA}、φ 从 0 到 π/2、θ 从 0 到 2π 积分。`
      ),
      explanation: t(
        `Fz = G m0 ∫ from θ = 0 to 2π ∫ from φ = 0 to π/2 ∫ from ρ = 0 to ${gvA} of ρ cos² φ sin φ dρ dφ dθ. The ρ-integral is ${gvA}²/2 = ${frac(gvA * gvA, 2)}, the φ-integral of cos² φ sin φ is 1/3, and the θ-integral is 2π. So Fz = G m0 · (${frac(gvA * gvA, 2)}) · (1/3) · 2π = ${frac(gvA * gvA, 3)} · G m0 π, and k = ${frac(gvA * gvA, 3)}.`,
        `Fz = G m0 乘以三重积分（θ 从 0 到 2π，φ 从 0 到 π/2，ρ 从 0 到 ${gvA}，被积函数 ρ cos² φ sin φ）。ρ 的积分是 ${gvA}²/2 = ${frac(gvA * gvA, 2)}，cos² φ sin φ 对 φ 的积分是 1/3，θ 的积分是 2π。所以 Fz = G m0 · (${frac(gvA * gvA, 2)}) · (1/3) · 2π = ${frac(gvA * gvA, 3)} · G m0 π，k = ${frac(gvA * gvA, 3)}。`
      ),
      audit: { kind: 'MIT-MV-54:grav-value', params: { a: gvA } },
    }),

    // 5. orientation
    g.choice({
      id: 'orientation',
      title: t('Which side is positive?', '哪一侧为正？'),
      prompt: t(
        `A vector field F has flux ${num(orPhi)} through the surface of ${orSolid === 'ball' ? 'a ball' : orSolid === 'cube' ? 'a cube' : 'a closed can'}, S, when the normal points outward. What is the flux of F through the same surface S when the normal points inward?`,
        `向量场 F 穿过${orSolid === 'ball' ? '一个球' : orSolid === 'cube' ? '一个立方体' : '一个封闭罐子'}的表面 S 的通量，在法向量指向外侧时为 ${num(orPhi)}。同一个曲面 S 在法向量指向内侧时，F 的通量是多少？`
      ),
      options: [
        t(num(-orPhi), num(-orPhi)),
        t(num(orPhi), num(orPhi)),
        t('0', '0'),
      ],
      correct: 0,
      hint: t(
        'Flux counts flow in the direction of n as positive. What happens to F · n when n is replaced by −n?',
        '沿 n 方向的流动记为正。把 n 换成 −n，F · n 会怎样？'
      ),
      explanation: t(
        `Replacing n by −n replaces F · n by −F · n at every point, so ∬ F · n dS changes sign: the flux through S with the inward normal is ${num(-orPhi)}. The value 0 would mean that as much flows out as in, which says nothing about this field; and the value ${num(orPhi)} would ignore which side is positive.`,
        `把 n 换成 −n，每一点的 F · n 都变成 −F · n，所以 ∬ F · n dS 变号：S 取内侧法向时的通量是 ${num(-orPhi)}。值 0 表示流出和流入一样多，这并不适用于这个场；值 ${num(orPhi)} 则忽略了哪一侧为正。`
      ),
    }),

    // 6. hemi-setup
    g.symbols({
      id: 'hemi-setup',
      title: t('Flux through a hemisphere: set-up', '半球面的通量：列式'),
      prompt: t(
        `Let F = (x, y, z) and let S be the upper hemisphere x² + y² + z² = ${hsR}², z ≥ 0 (the flat base is not part of S), with the normal n pointing away from the origin, so n = (x, y, z)/${hsR} on S. Complete: the flux ∬_S F · n dS equals (the constant value of F · n on S) × (the area of S).`,
        `设 F = (x, y, z)，S 是上半球面 x² + y² + z² = ${hsR}²，z ≥ 0（平底不属于 S），法向量 n 指向远离原点的一侧，所以在 S 上 n = (x, y, z)/${hsR}。补全：通量 ∬_S F · n dS 等于（F · n 在 S 上的常数值）乘以（S 的面积）。`
      ),
      before: lang === 'zh' ? '通量 = ' : 'Flux = ',
      between: [' × '],
      after: lang === 'zh' ? '。' : ' .',
      answers: [String(hsR), `${2 * hsR * hsR}π`],
      tokens: shuffled(g, [String(hsR), '1', String(hsR * hsR), `${2 * hsR * hsR}π`, `${4 * hsR * hsR}π`, `${hsR * hsR}π`]),
      figure: g.figure({
        alt: t(
          `The upper hemisphere of radius ${hsR} with four outward normal arrows.`,
          `半径为 ${hsR} 的上半球面，带有四个向外的法向量箭头。`
        ),
        view: fitView(hemiShapes(hsR), 0.25),
        shapes: hemiShapes(hsR),
      }),
      hint: t(
        `On S, F · n = (x, y, z) · (x, y, z)/${hsR} = (x² + y² + z²)/${hsR}. What is x² + y² + z² on the sphere? The hemisphere has half the area of the sphere 4π${hsR}².`,
        `在 S 上 F · n = (x, y, z) · (x, y, z)/${hsR} = (x² + y² + z²)/${hsR}。球面上 x² + y² + z² 是多少？半球面的面积是整个球面 4π${hsR}² 的一半。`
      ),
      explanation: t(
        `On S we have x² + y² + z² = ${hsR * hsR}, so F · n = ${hsR * hsR}/${hsR} = ${hsR}: F points along n and its length equals the radius. The flux is therefore ${hsR} times the area of the hemisphere, which is half of 4π·${hsR}² = ${4 * hsR * hsR}π, that is ${2 * hsR * hsR}π.`,
        `在 S 上 x² + y² + z² = ${hsR * hsR}，所以 F · n = ${hsR * hsR}/${hsR} = ${hsR}：F 与 n 同向，长度等于半径。因此通量是 ${hsR} 乘以半球面的面积，即 4π·${hsR}² = ${4 * hsR * hsR}π 的一半，也就是 ${2 * hsR * hsR}π。`
      ),
    }),

    // 7. hemi-flux
    g.number({
      id: 'hemi-flux',
      title: t('Flux through a hemisphere', '半球面的通量'),
      prompt: t(
        `F = ${coef(hfK, '')}(x, y, z). S is the upper hemisphere x² + y² + z² = ${hfR}², z ≥ 0 (the flat base is not part of S), with the normal pointing away from the origin. The flux ∬_S F · n dS equals K · π. Enter K.`,
        `F = ${coef(hfK, '')}(x, y, z)。S 是上半球面 x² + y² + z² = ${hfR}²，z ≥ 0（平底不属于 S），法向量指向远离原点的一侧。通量 ∬_S F · n dS 等于 K · π。求 K。`
      ),
      fields: [{ label: t('K', 'K'), answer: hfAns }],
      hint: t(
        `Find F · n on the sphere of radius ${hfR} (n = (x, y, z)/${hfR}), then multiply by the area of the hemisphere.`,
        `求球面上的 F · n（n = (x, y, z)/${hfR}），再乘以半球面的面积。`
      ),
      explanation: t(
        `On S, n = (x, y, z)/${hfR}, so F · n = ${hfK}(x² + y² + z²)/${hfR} = ${hfK}·${hfR}²/${hfR} = ${hfK * hfR}. The area of the hemisphere is 2π·${hfR}² = ${2 * hfR * hfR}π. The flux is ${hfK * hfR}·${2 * hfR * hfR}π = ${hfAns}π, so K = ${hfAns}.`,
        `在 S 上 n = (x, y, z)/${hfR}，所以 F · n = ${hfK}(x² + y² + z²)/${hfR} = ${hfK}·${hfR}²/${hfR} = ${hfK * hfR}。半球面面积是 2π·${hfR}² = ${2 * hfR * hfR}π。通量是 ${hfK * hfR}·${2 * hfR * hfR}π = ${hfAns}π，所以 K = ${hfAns}。`
      ),
      figure: g.figure({
        alt: t(
          `The upper hemisphere of radius ${hfR} with four outward normal arrows.`,
          `半径为 ${hfR} 的上半球面，带有四个向外的法向量箭头。`
        ),
        view: fitView(hemiShapes(hfR), 0.25),
        shapes: hemiShapes(hfR),
      }),
      audit: { kind: 'MIT-MV-54:hemi-flux', params: { k: hfK, R: hfR } },
    }),

    // 8. plane-null
    g.choice({
      id: 'plane-null',
      title: t('A field that never crosses the surface', '不穿过曲面的场'),
      prompt: t(
        `F = (0, ${coef(pnK, '')}x, 0) (written (0, x, 0) when k = 1). S is the part of the plane x + z = ${pnC} with x > 0, 0 < y < ${pnB} and z > 0, with the normal pointing upward (positive z-component). What is the flux of F through S?`,
        `F = (0, ${coef(pnK, '')}x, 0)（k = 1 时写作 (0, x, 0)）。S 是平面 x + z = ${pnC} 上满足 x > 0、0 < y < ${pnB}、z > 0 的部分，法向量指向上侧（z 分量为正）。F 穿过 S 的通量是多少？`
      ),
      options: [
        t('0', '0'),
        t(frac(pnK * pnB * pnC * pnC, 2), frac(pnK * pnB * pnC * pnC, 2)),
        t(`${coef(pnK * pnB * pnC, '')}√2`, `${coef(pnK * pnB * pnC, '')}√2`),
        t(`${frac(pnK * pnB * pnC * pnC, 2)}√2`, `${frac(pnK * pnB * pnC * pnC, 2)}√2`),
      ],
      correct: 0,
      hint: t(
        `The plane is z = ${pnC} − x, so for the upward side n dS = (−f_x, −f_y, 1) dx dy with f = ${pnC} − x. Compute F · n dS.`,
        `平面为 z = ${pnC} − x，上侧的 n dS = (−f_x, −f_y, 1) dx dy，其中 f = ${pnC} − x。算出 F · n dS。`
      ),
      explanation: t(
        `On the plane z = ${pnC} − x the upward n dS = (1, 0, 1) dx dy. Then F · n dS = (0, ${coef(pnK, '')}x, 0) · (1, 0, 1) dx dy = 0 at every point, because F is parallel to the plane: it has no component along n. A nonzero field can have zero flux. The other values come from using only the y-component of F, as if the normal were (0, 1, 0), or from replacing the field by a constant.`,
        `在平面 z = ${pnC} − x 上，上侧的 n dS = (1, 0, 1) dx dy。于是 F · n dS = (0, ${coef(pnK, '')}x, 0) · (1, 0, 1) dx dy 处处为 0，因为 F 与平面平行，在 n 方向没有分量。非零的场也可以通量为 0。其余各值来自只取 F 的 y 分量（相当于法向量为 (0, 1, 0)），或把场当作常数。`
      ),
      figure: g.figure({
        alt: t(
          `The rectangle on the plane x + z = ${pnC} with the upward normal n and arrows of F lying in the plane.`,
          `平面 x + z = ${pnC} 上的矩形，带上侧法向量 n 和平行于平面的场 F 箭头。`
        ),
        view: fitView(pnShapes, 0.25),
        shapes: pnShapes,
      }),
    }),

    // 9. challenge
    g.number({
      id: 'challenge',
      title: t('Flux of a point source', '点源的通量'),
      prompt: t(
        `A gas streams out of a point source at the origin with the field F = ${coef(chC, '')}(x, y, z)/ρ³, ρ = √(x² + y² + z²) (written (x, y, z)/ρ³ when c = 1), valid for (x, y, z) ≠ (0, 0, 0). S is the sphere of radius ${chR} centred at the origin, with the normal pointing away from the origin. The flux of F through S equals k · π. Enter k.`,
        `气体从原点处的点源流出，速度场为 F = ${coef(chC, '')}(x, y, z)/ρ³，ρ = √(x² + y² + z²)（c = 1 时写作 (x, y, z)/ρ³），在 (x, y, z) ≠ (0, 0, 0) 处有定义。S 是球心在原点、半径为 ${chR} 的球面，法向量指向远离原点的一侧。F 穿过 S 的通量等于 k · π。求 k。`
      ),
      fields: [{ label: t('k', 'k'), answer: chAns }],
      hint: t(
        `On the sphere of radius ${chR}, F points along n. How large is |F| there, and what is the area of the sphere?`,
        `在半径为 ${chR} 的球面上 F 与 n 同向。那里的 |F| 是多少？球面面积是多少？`
      ),
      explanation: t(
        `On S, F = ${coef(chC, '')}(x, y, z)/${chR}³ points along n = (x, y, z)/${chR}, and F · n = |F| = ${chC}·${chR}/${chR}³ = ${chC}/${chR * chR}. The area of S is 4π·${chR}². So the flux is (${chC}/${chR * chR})·4π${chR}² = ${4 * chC}π, whatever the radius. This game does not ask you to compute fluxes through surfaces whose normal changes in a complicated way (only a sphere and a tilted plane appear), to parametrize general surfaces, or to use the divergence theorem.`,
        `在 S 上 F = ${coef(chC, '')}(x, y, z)/${chR}³ 与 n = (x, y, z)/${chR} 同向，F · n = |F| = ${chC}·${chR}/${chR}³ = ${chC}/${chR * chR}。S 的面积是 4π·${chR}²。所以通量 = (${chC}/${chR * chR})·4π${chR}² = ${4 * chC}π，与半径无关。本游戏不要求计算法向变化复杂的曲面的通量（只涉及球面和一个斜平面），不要求对一般曲面参数化，也不涉及散度定理。`
      ),
      audit: { kind: 'MIT-MV-54:challenge', params: { c: chC, R: chR } },
    }),
  ];
};
