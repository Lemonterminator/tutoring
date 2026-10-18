import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, line3d, wire3d, type FigureShape } from '../../figure';
import { coef, exact, makeMvDeck, num, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** A trigonometric term with its coefficient: 1 is omitted (`cos φ`), 3 is printed `3 cos φ`. */
const cw = (k: number, word: string) => k === 1 ? word : `${k} ${word}`;
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const NOT_ASSESSED_EN = 'This game does not ask you to evaluate the spherical-coordinate cap integral or to use the divergence theorem on a closed surface; it checks the set-ups and a few short computations.';
const NOT_ASSESSED_ZH = '本游戏不要求计算球冠的球坐标积分，也不要求对闭曲面使用散度定理；它检验积分的设定和几个简短的计算。';

export const mv64: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-64');
  warm(g);

  // 1. conservative-pair
  const cpFamily = g.pick(['X', 'Y', 'Z'] as const);
  const cpA = g.pick([2, 3, 4]);
  const cpB = g.pick([1, 2, 3]);
  const cpField = cpFamily === 'X' ? `(${coef(cpA, 'y')}, x, ${coef(cpB, 'z')})` : cpFamily === 'Y' ? `(y, x + ${coef(cpA, 'z')}, ${coef(cpB, 'z')})` : `(y, x, ${coef(cpA, 'x')} + ${coef(cpB, 'z')})`;
  const cpCorrectIdx = cpFamily === 'X' ? 0 : cpFamily === 'Y' ? 2 : 1;
  const cpOptions = [
    t('∂M/∂y = ∂N/∂x', '∂M/∂y = ∂N/∂x'),
    t('∂M/∂z = ∂P/∂x', '∂M/∂z = ∂P/∂x'),
    t('∂N/∂z = ∂P/∂y', '∂N/∂z = ∂P/∂y'),
    t('None of them fails: F is conservative', '三条都不失效：F 是保守场'),
  ];
  const cpExpl = cpFamily === 'X'
    ? t(`Here M = ${coef(cpA, 'y')}, N = x, P = ${coef(cpB, 'z')}. ∂M/∂y = ${cpA} but ∂N/∂x = 1, so the first equality fails; ∂M/∂z = 0 = ∂P/∂x and ∂N/∂z = 0 = ∂P/∂y hold. One failing equality is enough: F is not conservative.`,
      `这里 M = ${coef(cpA, 'y')}，N = x，P = ${coef(cpB, 'z')}。∂M/∂y = ${cpA}，而 ∂N/∂x = 1，所以第一条等式不成立；∂M/∂z = 0 = ∂P/∂x 与 ∂N/∂z = 0 = ∂P/∂y 成立。只要有一条不成立，F 就不是保守场。`)
    : cpFamily === 'Y'
      ? t(`Here M = y, N = x + ${coef(cpA, 'z')}, P = ${coef(cpB, 'z')}. ∂N/∂z = ${cpA} but ∂P/∂y = 0, so the third equality fails; ∂M/∂y = 1 = ∂N/∂x and ∂M/∂z = 0 = ∂P/∂x hold. One failing equality is enough: F is not conservative.`,
        `这里 M = y，N = x + ${coef(cpA, 'z')}，P = ${coef(cpB, 'z')}。∂N/∂z = ${cpA}，而 ∂P/∂y = 0，所以第三条等式不成立；∂M/∂y = 1 = ∂N/∂x 与 ∂M/∂z = 0 = ∂P/∂x 成立。只要有一条不成立，F 就不是保守场。`)
      : t(`Here M = y, N = x, P = ${coef(cpA, 'x')} + ${coef(cpB, 'z')}. ∂M/∂z = 0 but ∂P/∂x = ${cpA}, so the second equality fails; ∂M/∂y = 1 = ∂N/∂x and ∂N/∂z = 0 = ∂P/∂y hold. One failing equality is enough: F is not conservative.`,
        `这里 M = y，N = x，P = ${coef(cpA, 'x')} + ${coef(cpB, 'z')}。∂M/∂z = 0，而 ∂P/∂x = ${cpA}，所以第二条等式不成立；∂M/∂y = 1 = ∂N/∂x 与 ∂N/∂z = 0 = ∂P/∂y 成立。只要有一条不成立，F 就不是保守场。`);

  // 2. potential
  const potA = g.pick([1, 2, 3]);
  const potB = g.pick([1, 2, 3]);
  const potC = g.pick([1, 2, 3]);
  const potD = g.pick([1, 2, 3]);
  const potAns = 2 * potA + 4 * potB + potC - potD;
  const potF = `(${coef(2 * potA, 'xy')} + ${coef(potC, 'z³')}, ${coef(potA, 'x²')} + ${coef(2 * potB, 'yz')}, ${coef(potB, 'y²')} + ${coef(3 * potC, 'xz²')} − ${potD})`;

  // 3. sphere-eq
  const sphA = g.pick([1, 2, 3, 4, 5, 6, 7]);
  const sphAns = `${2 * sphA} cos φ`;
  const sphTokens = shuffled(g, [`${2 * sphA} cos φ`, cw(sphA, 'cos φ'), `${2 * sphA} sin φ`, `${sphA}`, `${2 * sphA} sec φ`]);
  const sphereWire = (a: number): FigureShape[] => wire3d((u, v) => [a * Math.sin(u) * Math.cos(v), a * Math.sin(u) * Math.sin(v), a + a * Math.cos(u)], 0, Math.PI, 0, 2 * Math.PI, 6, 8, 36);
  const sphShapes: FigureShape[] = [...axes3d(2 * sphA + 1), ...sphereWire(sphA)];

  // 4. plane-eq
  const plH = g.pick([1, 2, 3, 4, 5, 6]);
  const plOptions = [
    t(`ρ = ${cw(plH, 'sec φ')}`, `ρ = ${cw(plH, 'sec φ')}`),
    t(`ρ = ${cw(plH, 'cos φ')}`, `ρ = ${cw(plH, 'cos φ')}`),
    t(`ρ = ${plH}`, `ρ = ${plH}`),
    t(`ρ = ${cw(plH, 'csc φ')}`, `ρ = ${cw(plH, 'csc φ')}`),
  ];

  // 5. cap-setup
  const capA = g.pick([1, 2, 3, 4, 5, 6]);
  const capAns1 = cw(capA, 'sec φ');
  const capAns2 = `${2 * capA} cos φ`;
  const capTokens = shuffled(g, [cw(capA, 'sec φ'), `${2 * capA} cos φ`, cw(capA, 'cos φ'), `${2 * capA} sin φ`, cw(capA, 'tan φ'), `${2 * capA}`]);
  const capShapes: FigureShape[] = [
    ...axes3d(2 * capA + 1),
    ...sphereWire(capA),
    line3d([[-capA, -capA, capA], [capA, -capA, capA], [capA, capA, capA], [-capA, capA, capA], [-capA, -capA, capA]], 'warn', { width: 2 }),
  ];

  // 6. flux-setup
  const flH = g.pick([4, 9, 16]);
  const flC = g.pick([1, 2, 3, 4]);
  const flS = Math.sqrt(flH);
  const flAns1 = String(flS);
  const flAns2 = `2r² + ${flC}`;
  const flTokens = shuffled(g, [String(flS), String(flH), '1', `2r² + ${flC}`, `r² + ${flC}`, `−2r² − ${flC}`, `2r²`]);
  const capOfParaboloid = (h: number, s: number): FigureShape[] => [
    ...axes3d(Math.max(s, h) + 1),
    ...wire3d((u, v) => [u * Math.cos(v), u * Math.sin(v), h - u * u], 0, s, 0, 2 * Math.PI, 4, 12, 36),
    arrow3d([0, 0, h], [0, 0, h + 1.5], 'accent2', 'n'),
  ];
  const flShapes: FigureShape[] = capOfParaboloid(flH, flS);

  // 7. paraboloid-flux
  const pfH = g.pick([1, 4, 9, 16]);
  const pfC = g.pick([1, 2, 3, 4]);
  const pfS = Math.sqrt(pfH);
  const pfK = pfH * pfH + pfC * pfH;
  const pfShapes: FigureShape[] = capOfParaboloid(pfH, pfS);

  // 8. curl-sphere
  const csB = g.pick([1, 2, 3, 4, 5, 6]);
  const csA = -2 * csB;
  const csOptions = [
    t(`a = ${num(csA)}`, `a = ${num(csA)}`),
    t(`a = ${num(2 * csB)}`, `a = ${num(2 * csB)}`),
    t(`a = ${num(-csB)}`, `a = ${num(-csB)}`),
    t(`a = ${num(csB)}`, `a = ${num(csB)}`),
  ];

  // 9. cyl-setup
  const cylR = g.pick([2, 3, 4]);
  const cylH = retry(() => g.pick([2, 3, 4, 5, 6]), (v) => v !== cylR && v !== cylR * cylR);
  const cylAns = ['π/2', String(cylR), String(cylH), 'r³'];
  const cylTokens = shuffled(g, ['π/2', 'π', '2π', String(cylR), String(cylR * cylR), String(cylH), 'r³', 'r²', 'r', '(r² + z²) r']);
  const cylShapes: FigureShape[] = [
    ...axes3d(Math.max(cylR, cylH) + 1),
    ...wire3d((u, v) => [cylR * Math.cos(u), cylR * Math.sin(u), v], 0, Math.PI / 2, 0, cylH, 6, 4, 24),
  ];

  // 10. challenge
  const chR = g.pick([1, 2]);
  const chH = retry(() => g.pick([1, 2, 3, 4, 5, 6]), (v) => !(chR === 1 && v === 1));
  const chK = (chR ** 4 * chH) / 4;

  return [
    g.choice({
      id: 'conservative-pair',
      title: t('Which test fails?', '哪一条判据不成立？'),
      prompt: t(`A field F = (M, N, P) can be conservative on all of space only if all three equalities ∂M/∂y = ∂N/∂x, ∂M/∂z = ∂P/∂x and ∂N/∂z = ∂P/∂y hold. For F = ${cpField}, which one of them fails?`,
        `场 F = (M, N, P) 在整个空间上要成为保守场，必须同时满足三条等式 ∂M/∂y = ∂N/∂x、∂M/∂z = ∂P/∂x 和 ∂N/∂z = ∂P/∂y。对 F = ${cpField}，哪一条等式不成立？`),
      options: cpOptions,
      correct: cpCorrectIdx,
      hint: t('Compute M_y, N_x, M_z, P_x, N_z and P_y, then compare them in pairs.', '算出 M_y、N_x、M_z、P_x、N_z 和 P_y，再两两比较。'),
      explanation: cpExpl,
    }),
    g.number({
      id: 'potential',
      title: t('Find the potential', '求势函数'),
      prompt: t(`The field F = ${potF} is a gradient field, F = ∇f. Find the potential f with f(0, 0, 0) = 0 and enter the number f(1, 2, 1) (an integer).`,
        `场 F = ${potF} 是梯度场，F = ∇f。求满足 f(0, 0, 0) = 0 的势函数 f，并填入数值 f(1, 2, 1)（整数）。`),
      fields: [{ label: t('f(1, 2, 1)', 'f(1, 2, 1)'), answer: potAns }],
      hint: t('Integrate the first component with respect to x, then use the other two components to find the unknown function of y and z.', '先对第一个分量关于 x 积分，再用另外两个分量确定关于 y、z 的未知函数。'),
      explanation: t(`From f_x = ${coef(2 * potA, 'xy')} + ${coef(potC, 'z³')} we get f = ${coef(potA, 'x²y')} + ${coef(potC, 'xz³')} + g(y, z). Then f_y = ${coef(potA, 'x²')} + g_y = ${coef(potA, 'x²')} + ${coef(2 * potB, 'yz')} gives g = ${coef(potB, 'y²z')} + h(z). Finally f_z = ${coef(3 * potC, 'xz²')} + ${coef(potB, 'y²')} + h′(z) = ${coef(potB, 'y²')} + ${coef(3 * potC, 'xz²')} − ${potD} gives h′ = −${potD}. So f = ${coef(potA, 'x²y')} + ${coef(potB, 'y²z')} + ${coef(potC, 'xz³')} − ${coef(potD, 'z')} and f(1, 2, 1) = ${2 * potA} + ${4 * potB} + ${potC} − ${potD} = ${potAns}.`,
        `由 f_x = ${coef(2 * potA, 'xy')} + ${coef(potC, 'z³')} 得 f = ${coef(potA, 'x²y')} + ${coef(potC, 'xz³')} + g(y, z)。再由 f_y = ${coef(potA, 'x²')} + g_y = ${coef(potA, 'x²')} + ${coef(2 * potB, 'yz')} 得 g = ${coef(potB, 'y²z')} + h(z)。最后 f_z = ${coef(3 * potC, 'xz²')} + ${coef(potB, 'y²')} + h′(z) = ${coef(potB, 'y²')} + ${coef(3 * potC, 'xz²')} − ${potD} 给出 h′ = −${potD}。所以 f = ${coef(potA, 'x²y')} + ${coef(potB, 'y²z')} + ${coef(potC, 'xz³')} − ${coef(potD, 'z')}，f(1, 2, 1) = ${2 * potA} + ${4 * potB} + ${potC} − ${potD} = ${potAns}。`),
      audit: { kind: 'MIT-MV-64:potential', params: { a: potA, b: potB, c: potC, d: potD } },
    }),
    g.symbols({
      id: 'sphere-eq',
      title: t('The sphere in spherical coordinates', '球面的球坐标方程'),
      prompt: t(`A solid sphere of radius ${sphA} rests on the xy-plane, tangent to it at the origin, with its diameter along the z-axis. In spherical coordinates (ρ, φ, θ), with φ measured from the positive z-axis, its surface is ρ = [ ].`,
        `一个半径为 ${sphA} 的实心球放在 xy 平面上，与平面相切于原点，直径沿 z 轴。在球坐标 (ρ, φ, θ) 中（φ 是从正 z 轴量起的角），球面的方程为 ρ = [ ]。`),
      before: 'ρ = ',
      after: t('.', '。'),
      answers: [sphAns],
      tokens: sphTokens,
      hint: t(`The centre is (0, 0, ${sphA}), so the sphere is x² + y² + (z − ${sphA})² = ${sphA * sphA}. Expand it, then use ρ² = x² + y² + z² and z = ρ cos φ.`,
        `球心是 (0, 0, ${sphA})，球面为 x² + y² + (z − ${sphA})² = ${sphA * sphA}。展开后再用 ρ² = x² + y² + z² 与 z = ρ cos φ。`),
      explanation: t(`ρ² = ${2 * sphA}z = ${2 * sphA}ρ cos φ, so ρ = ${sphAns}. It reaches ρ = ${2 * sphA} (the top of the sphere) at φ = 0 and ρ = 0 at φ = π/2 (the origin).`,
        `ρ² = ${2 * sphA}z = ${2 * sphA}ρ cos φ，所以 ρ = ${sphAns}。在 φ = 0 时 ρ = ${2 * sphA}（球的最高点），在 φ = π/2 时 ρ = 0（原点）。`),
      figure: g.figure({
        alt: t('A sphere resting on the xy-plane and touching it at the origin; its centre lies on the z-axis.', '放在 xy 平面上、与平面相切于原点的球；球心在 z 轴上。'),
        view: fitView(sphShapes, 0.25),
        shapes: sphShapes,
      }),
    }),
    g.choice({
      id: 'plane-eq',
      title: t('The plane in spherical coordinates', '平面的球坐标方程'),
      prompt: t(`In spherical coordinates (ρ, φ, θ), with φ measured from the positive z-axis, which equation describes the horizontal plane z = ${plH}?`,
        `在球坐标 (ρ, φ, θ) 中（φ 是从正 z 轴量起的角），哪个方程描述水平面 z = ${plH}？`),
      options: plOptions,
      correct: 0,
      hint: t(`Write z in spherical coordinates, z = ρ cos φ, and set it equal to ${plH}.`, `把 z 用球坐标写出来，z = ρ cos φ，再令它等于 ${plH}。`),
      explanation: t(`On the plane z = ${plH}, ρ cos φ = ${plH}, so ρ = ${cw(plH, 'sec φ')}. The equation ρ = ${cw(plH, 'cos φ')} describes a sphere through the origin, ρ = ${plH} a sphere centred at the origin, and ρ = ${cw(plH, 'csc φ')} would be the plane if φ were measured from the xy-plane.`,
        `在平面 z = ${plH} 上，ρ cos φ = ${plH}，所以 ρ = ${cw(plH, 'sec φ')}。方程 ρ = ${cw(plH, 'cos φ')} 描述过原点的球面，ρ = ${plH} 描述以原点为球心的球面，ρ = ${cw(plH, 'csc φ')} 只有在 φ 从 xy 平面量起时才是这个平面。`),
    }),
    g.symbols({
      id: 'cap-setup',
      title: t('Set up the volume of the cap', '写出球冠的体积'),
      prompt: t(`The solid sphere S of radius ${capA} rests on the xy-plane, tangent at the origin, with surface ρ = ${2 * capA} cos φ (φ measured from the positive z-axis). The plane z = ${capA} cuts S where φ = π/4. Complete the volume of the part of S above the plane z = ${capA}: V = the integral over θ from 0 to 2π, φ from 0 to π/4, and ρ from [ ] to [ ] of ρ² sin φ dρ dφ dθ.`,
        `半径为 ${capA} 的实心球 S 放在 xy 平面上，与平面相切于原点，球面为 ρ = ${2 * capA} cos φ（φ 是从正 z 轴量起的角）。平面 z = ${capA} 在 φ = π/4 处截 S。补全 S 在平面 z = ${capA} 之上那一部分的体积：V = θ 从 0 到 2π、φ 从 0 到 π/4、ρ 从 [ ] 到 [ ] 对 ρ² sin φ dρ dφ dθ 的积分。`),
      before: t('V = the integral over θ from 0 to 2π, φ from 0 to π/4, and ρ from ', 'V = θ 从 0 到 2π、φ 从 0 到 π/4、ρ 从 '),
      between: lang === 'zh' ? [' 到 '] : [' to '],
      after: t(' of ρ² sin φ dρ dφ dθ.', ' 对 ρ² sin φ dρ dφ dθ 的积分。'),
      answers: [capAns1, capAns2],
      tokens: capTokens,
      hint: t(`The lower bound is the plane z = ${capA}, written ρ cos φ = ${capA}. The upper bound is the sphere.`,
        `下界是平面 z = ${capA}，写成 ρ cos φ = ${capA}。上界是球面。`),
      explanation: t(`For each direction φ < π/4 the ray from the origin enters the region at the plane, ρ cos φ = ${capA}, so ρ = ${capAns1}, and leaves it at the sphere, ρ = ${capAns2}. The two meet when ${capAns1} = ${capAns2}, that is cos² φ = 1/2 and φ = π/4.`,
        `对每个 φ < π/4 的方向，从原点出发的射线在平面 ρ cos φ = ${capA} 处进入该区域，即 ρ = ${capAns1}，在球面 ρ = ${capAns2} 处离开。两者相交于 ${capAns1} = ${capAns2}，即 cos² φ = 1/2，φ = π/4。`),
      figure: g.figure({
        alt: t('A sphere resting on the xy-plane and touching it at the origin, cut by the horizontal plane through its centre.', '放在 xy 平面上、与平面相切于原点的球，被过球心的水平面截开。'),
        view: fitView(capShapes, 0.25),
        shapes: capShapes,
      }),
    }),
    g.symbols({
      id: 'flux-setup',
      title: t('Set up the flux integral', '写出通量积分'),
      prompt: t(`S is the part of the paraboloid z = ${flH} − x² − y² above the xy-plane and F = (x, y, ${flC}). The flux is taken upward. For a surface z = f(x, y) the upward normal element is n dS = (−f_x, −f_y, 1) dA, and S lies over the disc x² + y² ≤ ${flH}. In polar coordinates: flux = the integral over θ from 0 to 2π and r from 0 to [ ] of ([ ]) r dr dθ.`,
        `S 是抛物面 z = ${flH} − x² − y² 在 xy 平面上方的部分，F = (x, y, ${flC})。通量取向上的一侧。对曲面 z = f(x, y)，向上的法向面元为 n dS = (−f_x, −f_y, 1) dA，S 位于圆盘 x² + y² ≤ ${flH} 之上。在极坐标下：通量 = θ 从 0 到 2π、r 从 0 到 [ ] 对 ([ ]) r dr dθ 的积分。`),
      before: t('flux = the integral over θ from 0 to 2π and r from 0 to ', '通量 = θ 从 0 到 2π、r 从 0 到 '),
      between: lang === 'zh' ? [' 对 ('] : [' of ('],
      after: t(') r dr dθ.', ') r dr dθ 的积分。'),
      answers: [flAns1, flAns2],
      tokens: flTokens,
      hint: t(`Here f = ${flH} − x² − y², so n dS = (2x, 2y, 1) dA. Take the dot product with F and put x² + y² = r². The edge of S is where z = 0.`,
        `这里 f = ${flH} − x² − y²，所以 n dS = (2x, 2y, 1) dA。与 F 作点积，并令 x² + y² = r²。S 的边缘在 z = 0 处。`),
      explanation: t(`n dS = (2x, 2y, 1) dA, so F · n dS = (x, y, ${flC}) · (2x, 2y, 1) dA = (2x² + 2y² + ${flC}) dA = (2r² + ${flC}) dA. The edge z = 0 is r² = ${flH}, so r runs from 0 to ${flS}, and dA = r dr dθ.`,
        `n dS = (2x, 2y, 1) dA，所以 F · n dS = (x, y, ${flC}) · (2x, 2y, 1) dA = (2x² + 2y² + ${flC}) dA = (2r² + ${flC}) dA。边缘 z = 0 即 r² = ${flH}，所以 r 从 0 到 ${flS}，dA = r dr dθ。`),
      figure: g.figure({
        alt: t('The cap of a paraboloid above the xy-plane, with an arrow n pointing up from its top.', 'xy 平面上方的抛物面帽，顶点处有向上的箭头 n。'),
        view: fitView(flShapes, 0.25),
        shapes: flShapes,
      }),
    }),
    g.number({
      id: 'paraboloid-flux',
      title: t('Flux across the paraboloid', '穿过抛物面的通量'),
      prompt: t(`S is the part of the paraboloid z = ${pfH} − x² − y² above the xy-plane and F = (x, y, ${pfC}). The flux of F across S, taking the upward direction as positive, equals k·π. Enter k (an integer).`,
        `S 是抛物面 z = ${pfH} − x² − y² 在 xy 平面上方的部分，F = (x, y, ${pfC})。F 穿过 S 的通量（以向上为正）等于 k·π。求 k（整数）。`),
      fields: [{ label: t('k', 'k'), answer: pfK }],
      hint: t('Either integrate over S directly with n dS = (2x, 2y, 1) dA, or close S with the flat disc z = 0 and use the divergence theorem.',
        '可以直接用 n dS = (2x, 2y, 1) dA 在 S 上积分，也可以用平面圆盘 z = 0 把 S 封闭后用散度定理。'),
      explanation: t(`n dS = (2x, 2y, 1) dA gives F · n dS = (2r² + ${pfC}) dA over the disc r ≤ ${pfS}. The flux is ∫ from 0 to 2π ∫ from 0 to ${pfS} of (2r² + ${pfC}) r dr dθ = 2π · (${pfH * pfH}/2 + ${pfC}·${pfH}/2) = (${pfK})π, so k = ${pfK}. Check with the divergence theorem: div F = 2, the solid under S has volume ${pfH === 1 ? '' : pfH * pfH}π/2 → 2 · ${pfH === 1 ? '' : pfH * pfH}π/2 = ${pfH === 1 ? '' : pfH * pfH}π, and the flux across the bottom disc with the downward normal is −${pfC * pfH === 1 ? '' : `${pfC}${pfH === 1 ? '' : `·${pfH}`}`}π, which is subtracted: ${pfH === 1 ? '' : pfH * pfH}π + ${pfC * pfH === 1 ? '' : `${pfC}${pfH === 1 ? '' : `·${pfH}`}`}π.`,
        `n dS = (2x, 2y, 1) dA 给出 F · n dS = (2r² + ${pfC}) dA（在圆盘 r ≤ ${pfS} 上）。通量为 θ 从 0 到 2π、r 从 0 到 ${pfS} 对 (2r² + ${pfC}) r dr dθ 的积分 = 2π · (${pfH * pfH}/2 + ${pfC}·${pfH}/2) = (${pfK})π，所以 k = ${pfK}。用散度定理验证：div F = 2，S 下方立体的体积为 ${pfH === 1 ? '' : pfH * pfH}π/2，故 2 · ${pfH === 1 ? '' : pfH * pfH}π/2 = ${pfH === 1 ? '' : pfH * pfH}π；底面圆盘取向下法向的通量为 −${pfC * pfH === 1 ? '' : `${pfC}${pfH === 1 ? '' : `·${pfH}`}`}π，需要减去，得 ${pfH === 1 ? '' : pfH * pfH}π + ${pfC * pfH === 1 ? '' : `${pfC}${pfH === 1 ? '' : `·${pfH}`}`}π。`),
      audit: { kind: 'MIT-MV-64:paraboloid-flux', params: { h: pfH, c: pfC } },
      figure: g.figure({
        alt: t('The cap of a paraboloid above the xy-plane, with an arrow n pointing up from its top.', 'xy 平面上方的抛物面帽，顶点处有向上的箭头 n。'),
        view: fitView(pfShapes, 0.25),
        shapes: pfShapes,
      }),
    }),
    g.choice({
      id: 'curl-sphere',
      title: t('Zero flux of the curl', '旋度通量为零'),
      prompt: t(`F = (a x z, 0, ${coef(csB, 'y²')}), where a is a constant. On the unit sphere x² + y² + z² = 1 the outward unit normal is n = (x, y, z). For which value of a is ∬_R (curl F) · n dS = 0 for every piece R of the unit sphere?`,
        `F = (a x z, 0, ${coef(csB, 'y²')})，其中 a 是常数。在单位球面 x² + y² + z² = 1 上，外单位法向量为 n = (x, y, z)。a 取何值时，对单位球面的每一块 R 都有 ∬_R (curl F) · n dS = 0？`),
      options: csOptions,
      correct: 0,
      hint: t('Compute curl F first. On the sphere, curl F · n is a multiple of xy; when is a multiple of xy zero on every piece of the sphere?',
        '先求 curl F。在球面上 curl F · n 是 xy 的倍数；xy 的倍数在球面的每一块上都为零，要求什么？'),
      explanation: t(`curl F = (${coef(2 * csB, 'y')}, a x, 0), so on the unit sphere curl F · n = ${coef(2 * csB, 'xy')} + a xy = (${2 * csB} + a)xy. This is 0 on every piece R only if ${2 * csB} + a = 0, that is a = ${num(csA)}; otherwise a small piece near a point with xy > 0 has nonzero flux. For that a, Stokes' theorem then gives ∮_C F · dr = ∬ (curl F) · n dS = 0 for every simple closed curve C on the sphere.`,
        `curl F = (${coef(2 * csB, 'y')}, a x, 0)，所以在单位球面上 curl F · n = ${coef(2 * csB, 'xy')} + a xy = (${2 * csB} + a)xy。只有 ${2 * csB} + a = 0，即 a = ${num(csA)}，它才在每一块 R 上都为零；否则在 xy > 0 的点附近的小块上通量不为零。对这个 a，由斯托克斯定理，对球面上每条简单闭曲线 C 都有 ∮_C F · dr = ∬ (curl F) · n dS = 0。`),
    }),
    g.symbols({
      id: 'cyl-setup',
      title: t('Set up the moment of inertia', '写出转动惯量的积分'),
      prompt: t(`C is the part of the solid cylinder x² + y² ≤ ${cylR * cylR} (radius ${cylR}) that lies in the first octant (x ≥ 0, y ≥ 0, z ≥ 0) and below the plane z = ${cylH}; the density is δ = 1. Its moment of inertia about the z-axis is I = ∭ (distance from the z-axis)² dV. In cylindrical coordinates, dV = r dr dθ dz. Complete: I = the integral over θ from 0 to [ ], r from 0 to [ ] and z from 0 to [ ] of ([ ]) dz dr dθ.`,
        `C 是实心圆柱 x² + y² ≤ ${cylR * cylR}（半径 ${cylR}）位于第一卦限（x ≥ 0，y ≥ 0，z ≥ 0）且在平面 z = ${cylH} 下方的部分，密度 δ = 1。它关于 z 轴的转动惯量为 I = ∭（到 z 轴的距离）² dV。在柱坐标下 dV = r dr dθ dz。补全：I = θ 从 0 到 [ ]、r 从 0 到 [ ]、z 从 0 到 [ ] 对 ([ ]) dz dr dθ 的积分。`),
      before: t('I = the integral over θ from 0 to ', 'I = θ 从 0 到 '),
      between: lang === 'zh' ? ['、r 从 0 到 ', '、z 从 0 到 ', ' 对 ('] : [', r from 0 to ', ' and z from 0 to ', ' of ('],
      after: t(') dz dr dθ.', ') dz dr dθ 的积分。'),
      answers: cylAns,
      tokens: cylTokens,
      hint: t('Which angles θ give x ≥ 0 and y ≥ 0? The distance from the z-axis is r, and dV adds one more factor.',
        '哪些 θ 满足 x ≥ 0 且 y ≥ 0？到 z 轴的距离是 r，而 dV 还要再乘一个因子。'),
      explanation: t(`The first octant gives 0 ≤ θ ≤ π/2; the cylinder gives 0 ≤ r ≤ ${cylR}; and 0 ≤ z ≤ ${cylH}. The squared distance from the z-axis is r², and dV = r dr dθ dz adds one factor r, so the integrand is r² · r = r³.`,
        `第一卦限给出 0 ≤ θ ≤ π/2；圆柱给出 0 ≤ r ≤ ${cylR}；还有 0 ≤ z ≤ ${cylH}。到 z 轴距离的平方是 r²，dV = r dr dθ dz 再乘一个因子 r，所以被积函数是 r² · r = r³。`),
      figure: g.figure({
        alt: t('The quarter of a solid cylinder that lies in the first octant, standing on the xy-plane with its axis along the z-axis.', '位于第一卦限、立在 xy 平面上、轴沿 z 轴的四分之一实心圆柱。'),
        view: fitView(cylShapes, 0.25),
        shapes: cylShapes,
      }),
    }),
    g.number({
      id: 'challenge',
      title: t('Half a cylinder', '半个圆柱'),
      prompt: t(`A solid with density δ = 1 fills the part of the cylinder x² + y² ≤ ${chR * chR} (radius ${chR}) with x ≥ 0 and 0 ≤ z ≤ ${chH}. Its moment of inertia about the z-axis, I = ∭ (distance from the z-axis)² dV, equals k·π. Enter k (an integer or a fraction).`,
        `一个密度 δ = 1 的立体充满圆柱 x² + y² ≤ ${chR * chR}（半径 ${chR}）中满足 x ≥ 0 且 0 ≤ z ≤ ${chH} 的部分。它关于 z 轴的转动惯量 I = ∭（到 z 轴的距离）² dV 等于 k·π。求 k（整数或分数）。`),
      fields: [{ label: t('k', 'k'), answer: chK }],
      hint: t('Which angles θ give x ≥ 0? The distance from the z-axis is r.', '哪些 θ 满足 x ≥ 0？到 z 轴的距离是 r。'),
      explanation: t(`x ≥ 0 means −π/2 ≤ θ ≤ π/2. Then I = ∫ from −π/2 to π/2 ∫ from 0 to ${chR} ∫ from 0 to ${chH} of r² · r dz dr dθ = π · ${chR ** 4}/4 · ${chH} = (${exact(chK)})π, so k = ${exact(chK)}. ${NOT_ASSESSED_EN}`,
        `x ≥ 0 意味着 −π/2 ≤ θ ≤ π/2。于是 I = θ 从 −π/2 到 π/2、r 从 0 到 ${chR}、z 从 0 到 ${chH} 对 r² · r dz dr dθ 的积分 = π · ${chR ** 4}/4 · ${chH} = (${exact(chK)})π，所以 k = ${exact(chK)}。${NOT_ASSESSED_ZH}`),
      audit: { kind: 'MIT-MV-64:challenge', params: { R: chR, h: chH } },
    }),
  ];
};
