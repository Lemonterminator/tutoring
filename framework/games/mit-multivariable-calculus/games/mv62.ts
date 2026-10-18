import type { CardGenerator } from '../../types';
import { axes3d, ellipse, fitView, project3d, wire3d, type FigureShape } from '../../figure';
import { exact, makeMvDeck, type Text } from '../support';

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

const NOT_ASSESSED_EN = 'This game does not assess proofs, choosing the order of integration in rectangular coordinates, or integrals that need a change of variables other than polar, cylindrical and spherical coordinates.';
const NOT_ASSESSED_ZH = '本游戏不评估证明、直角坐标下积分次序的选择，也不评估需要极坐标、柱坐标、球坐标以外的变量替换的积分。';

export const mv62: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-62');
  warm(g);

  // --- coords ---
  const coordRegion = g.pick([1, 2, 3, 4]);
  const cS1 = { a: g.random(2, 6) };
  const cS2 = { a: g.random(2, 5), h: g.random(2, 6) };
  const cS3 = { a: g.random(2, 6) };
  const cS4 = { a: g.random(2, 5), b: g.random(2, 5), c: g.random(2, 5) };

  // --- polar-setup & polar-integral & jacobian-check ---
  const pa = g.pick([1, 2, 3]);
  const pR = g.pick([2, 3, 4]);
  const pIntegrand = pa === 1 ? 'r³' : `${pa}r³`;
  const pK = pa * pR ** 4 / 2;

  // --- cyl-setup & cyl-mass ---
  const cylPairs: [number, number][] = [[2,3],[2,5],[2,6],[3,2],[3,4],[3,5],[3,6],[4,3],[4,5],[4,6]];
  const [cR, ch] = g.pick(cylPairs);
  const cK = cR * cR * ch * ch / 2;

  // --- sph-setup & sph-mass ---
  const sphPairs: [number, number][] = [[1,2],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5],[3,4],[3,5]];
  const [sa, sb] = g.pick(sphPairs);
  const sK = sb ** 4 - sa ** 4;

  // --- challenge ---
  const chA = g.pick([2, 3, 4]);
  const chM = g.pick([1, 2]);
  const chK = chM * chA ** 4 / 4;

  // --- Figures ---
  const polarShapes: FigureShape[] = [
    { kind: 'area', points: ellipse(0, 0, pR, pR), tone: 'accent', opacity: 0.25 },
    { kind: 'arrow', from: [-(pR + 1), 0], to: [pR + 1, 0], tone: 'axis', label: 'x' },
    { kind: 'arrow', from: [0, -(pR + 1)], to: [0, pR + 1], tone: 'axis', label: 'y' },
  ];

  const polarIntShapes: FigureShape[] = [
    ...polarShapes,
    { kind: 'line', points: [[0, 0], [pR, 0]], tone: 'accent', label: String(pR) },
  ];

  const cylShapes: FigureShape[] = [
    ...axes3d(Math.max(cR, ch) + 1),
    ...wire3d((u, v) => [cR * Math.cos(u), cR * Math.sin(u), v], 0, 2 * Math.PI, 0, ch, 12, 2, 36),
  ];
  const cylMassShapes: FigureShape[] = [
    ...cylShapes,
    { kind: 'text', at: project3d([cR, 0, 0]), text: `R = ${cR}` },
    { kind: 'text', at: project3d([0, cR + 0.3, ch / 2]), text: `h = ${ch}` },
  ];

  const sphShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, sa, sa), tone: 'accent2' },
    { kind: 'line', points: ellipse(0, 0, sb, sb), tone: 'accent' },
    { kind: 'arrow', from: [-(sb + 1), 0], to: [sb + 1, 0], tone: 'axis', label: 'x' },
    { kind: 'arrow', from: [0, -(sb + 1)], to: [0, sb + 1], tone: 'axis', label: 'z' },
  ];

  const sphMassShapes: FigureShape[] = [
    ...sphShapes,
    { kind: 'text', at: [sa * Math.cos(40 * Math.PI / 180), sa * Math.sin(40 * Math.PI / 180)], text: String(sa) },
    { kind: 'text', at: [sb * Math.cos(40 * Math.PI / 180), sb * Math.sin(40 * Math.PI / 180)], text: String(sb) },
  ];

  // --- Texts ---
  const coordRegionText = (() => {
    if (coordRegion === 1) return t(`A triple integral is taken over the ball of radius ${cS1.a}, x² + y² + z² ≤ ${cS1.a * cS1.a}.`, `对半径为 ${cS1.a} 的球 x² + y² + z² ≤ ${cS1.a * cS1.a} 作三重积分。`);
    if (coordRegion === 2) return t(`A triple integral is taken over the solid cylinder x² + y² ≤ ${cS2.a * cS2.a} (radius ${cS2.a}), 0 ≤ z ≤ ${cS2.h}.`, `对实心圆柱 x² + y² ≤ ${cS2.a * cS2.a}（半径 ${cS2.a}），0 ≤ z ≤ ${cS2.h} 作三重积分。`);
    if (coordRegion === 3) return t(`A double integral is taken over the disc of radius ${cS3.a} in the xy-plane, x² + y² ≤ ${cS3.a * cS3.a}.`, `对 xy 平面内半径为 ${cS3.a} 的圆盘 x² + y² ≤ ${cS3.a * cS3.a} 作二重积分。`);
    return t(`A triple integral is taken over the box 0 ≤ x ≤ ${cS4.a}, 0 ≤ y ≤ ${cS4.b}, 0 ≤ z ≤ ${cS4.c}.`, `对长方体 0 ≤ x ≤ ${cS4.a}，0 ≤ y ≤ ${cS4.b}，0 ≤ z ≤ ${cS4.c} 作三重积分。`);
  })();

  const coordOptions = [
    t('rectangular coordinates (x, y, z)', '直角坐标 (x, y, z)'),
    t('polar coordinates (r, θ), for double integrals', '极坐标 (r, θ)，用于二重积分'),
    t('cylindrical coordinates (r, θ, z), for triple integrals', '柱坐标 (r, θ, z)，用于三重积分'),
    t('spherical coordinates (ρ, φ, θ), for triple integrals', '球坐标 (ρ, φ, θ)，用于三重积分'),
  ];
  const coordCorrect = coordRegion === 1 ? 3 : coordRegion === 2 ? 2 : coordRegion === 3 ? 1 : 0;

  const coordExpl = (() => {
    if (coordRegion === 1) return t(`In spherical coordinates (φ measured from the positive z-axis) the ball is 0 ≤ ρ ≤ ${cS1.a}, 0 ≤ φ ≤ π, 0 ≤ θ ≤ 2π: all constants. In rectangular or cylindrical coordinates the limits of the inner variable contain a square root such as √(${cS1.a * cS1.a} − x² − y²).`, `在球坐标下（φ 是从正 z 轴量起的角），这个球是 0 ≤ ρ ≤ ${cS1.a}，0 ≤ φ ≤ π，0 ≤ θ ≤ 2π：全是常数。在直角坐标或柱坐标下，内层变量的积分限含有平方根，如 √(${cS1.a * cS1.a} − x² − y²)。`);
    if (coordRegion === 2) return t(`In cylindrical coordinates the solid is 0 ≤ r ≤ ${cS2.a}, 0 ≤ θ ≤ 2π, 0 ≤ z ≤ ${cS2.h}: all constants. In rectangular coordinates y runs between −√(${cS2.a * cS2.a} − x²) and √(${cS2.a * cS2.a} − x²); in spherical coordinates the limits of ρ depend on φ.`, `在柱坐标下，这个实心圆柱是 0 ≤ r ≤ ${cS2.a}，0 ≤ θ ≤ 2π，0 ≤ z ≤ ${cS2.h}：全是常数。在直角坐标下 y 从 −√(${cS2.a * cS2.a} − x²) 到 √(${cS2.a * cS2.a} − x²)；在球坐标下 ρ 的积分限依赖于 φ。`);
    if (coordRegion === 3) return t(`In polar coordinates the disc is 0 ≤ r ≤ ${cS3.a}, 0 ≤ θ ≤ 2π: constants. In rectangular coordinates y runs between −√(${cS3.a * cS3.a} − x²) and √(${cS3.a * cS3.a} − x²).`, `在极坐标下，这个圆盘是 0 ≤ r ≤ ${cS3.a}，0 ≤ θ ≤ 2π：全是常数。在直角坐标下 y 从 −√(${cS3.a * cS3.a} − x²) 到 √(${cS3.a * cS3.a} − x²)。`);
    return t(`In rectangular coordinates the box is 0 ≤ x ≤ ${cS4.a}, 0 ≤ y ≤ ${cS4.b}, 0 ≤ z ≤ ${cS4.c}: all constants. A box has flat faces, and curved coordinates make the limits depend on the angles.`, `在直角坐标下，这个长方体是 0 ≤ x ≤ ${cS4.a}，0 ≤ y ≤ ${cS4.b}，0 ≤ z ≤ ${cS4.c}：全是常数。长方体的面是平的，用弯曲坐标会使积分限依赖角度。`);
  })();

  const polarIntegrandText = pa === 1 ? '(x² + y²)' : `${pa}(x² + y²)`;
  const polarTokens = shuffled(g, ['2π', 'π', String(pR), String(pR * pR), pIntegrand, pa === 1 ? 'r²' : `${pa}r²`, pa === 1 ? 'r' : `${pa}r`]);

  const jacobOptions = [
    t(`The Jacobian factor r is missing: the integrand must be ${pIntegrand}.`, `漏了雅可比因子 r：被积函数应为 ${pIntegrand}。`),
    t('The upper limit of θ should be π, not 2π, because x² + y² is even in x.', 'θ 的上限应是 π 而不是 2π，因为 x² + y² 关于 x 是偶函数。'),
    t(`x² + y² equals r, so the integrand should be ${pa === 1 ? 'r' : `${pa}r`}, not ${pa === 1 ? 'r²' : `${pa}r²`}.`, `x² + y² 等于 r，所以被积函数应为 ${pa === 1 ? 'r' : `${pa}r`}，而不是 ${pa === 1 ? 'r²' : `${pa}r²`}。`),
    t('Nothing is wrong: x² + y² = r² and the limits cover the whole disc.', '没有错误：x² + y² = r²，积分限也覆盖整个圆盘。'),
  ];
  const jacobWrong = 2 * pa * pR ** 3 / 3;
  const jacobExpl = t(`In polar coordinates the area element is dA = r dr dθ, not dr dθ. With x² + y² = r² the integrand is ${pa === 1 ? 'r²' : `${pa}r²`} · r = ${pIntegrand}, and the value is (${exact(pK)})π. The student's integral gives 2π · ${pa} · ${pR * pR * pR}/3 = (${exact(jacobWrong)})π, which is different.`,
    `极坐标下的面积元是 dA = r dr dθ，而不是 dr dθ。x² + y² = r²，所以被积函数是 ${pa === 1 ? 'r²' : `${pa}r²`} · r = ${pIntegrand}，积分值为 (${exact(pK)})π。这位同学的积分得 2π · ${pa} · ${pR * pR * pR}/3 = (${exact(jacobWrong)})π，结果不同。`);

  const cylTokens = shuffled(g, [String(cR), String(cR * cR), String(ch), String(ch * ch), 'z r', 'z', 'r', 'z r²']);

  const sphTokens = shuffled(g, [String(sa), String(sb), String(sb * sb), '0', 'π', 'π/2', 'ρ³ sin φ', 'ρ² sin φ', 'ρ³']);

  return [
    g.choice({
      id: 'coords',
      title: t('Choose the coordinates', '选择坐标系'),
      prompt: t(`${coordRegionText[0]} Which coordinate system makes every limit of integration a constant?`, `${coordRegionText[1]}在哪种坐标系下，所有积分限都是常数？`),
      options: coordOptions,
      correct: coordCorrect,
      hint: t('Write the boundary of the region in each system (in spherical coordinates, φ is measured from the positive z-axis). The right system turns every boundary into "variable = constant".', '把区域的边界用每种坐标系写出来（球坐标中 φ 是从正 z 轴量起的角）。合适的坐标系会把每个边界都写成「变量 = 常数」。'),
      explanation: coordExpl,
    }),
    g.symbols({
      id: 'polar-setup',
      title: t('Set up in polar coordinates', '写出极坐标积分'),
      prompt: t(`D is the disc of radius ${pR}, x² + y² ≤ ${pR * pR}, in the xy-plane. In polar coordinates dA = r dr dθ. Complete: ∬_D ${polarIntegrandText} dA = the integral over θ from 0 to [ ] and r from 0 to [ ] of ([ ]) dr dθ.`,
        `D 是 xy 平面内半径为 ${pR} 的圆盘 x² + y² ≤ ${pR * pR}。在极坐标下 dA = r dr dθ。补全：∬_D ${polarIntegrandText} dA = θ 从 0 到 [ ]、r 从 0 到 [ ] 对 ([ ]) dr dθ 的积分。`),
      before: t(`∬_D ${polarIntegrandText} dA = the integral over θ from 0 to `, `∬_D ${polarIntegrandText} dA = θ 从 0 到 `),
      between: lang === 'zh' ? ['、r 从 0 到 ', ' 对 ('] : [' and r from 0 to ', ' of ('],
      after: t(') dr dθ.', ') dr dθ 的积分。'),
      answers: ['2π', String(pR), pIntegrand],
      tokens: polarTokens,
      hint: t('Replace x² + y² by r², then remember what dA becomes in polar coordinates.', '先把 x² + y² 换成 r²，再想想 dA 在极坐标下变成什么。'),
      explanation: t(`In polar coordinates x² + y² = r² and dA = r dr dθ, so the integrand is ${pa === 1 ? 'r²' : `${pa}r²`} · r = ${pIntegrand}. The disc is 0 ≤ r ≤ ${pR}, 0 ≤ θ ≤ 2π.`,
        `在极坐标下 x² + y² = r²，dA = r dr dθ，所以被积函数是 ${pa === 1 ? 'r²' : `${pa}r²`} · r = ${pIntegrand}。圆盘是 0 ≤ r ≤ ${pR}，0 ≤ θ ≤ 2π。`),
      figure: g.figure({
        alt: t('A disc centred at the origin of the xy-plane.', 'xy 平面上以原点为圆心的圆盘。'),
        view: fitView(polarShapes, 0.25),
        shapes: polarShapes,
      }),
    }),
    g.number({
      id: 'polar-integral',
      title: t('Evaluate the polar integral', '计算极坐标积分'),
      prompt: t(`D is the disc of radius ${pR}, x² + y² ≤ ${pR * pR}. Evaluate ∬_D ${polarIntegrandText} dA. The value equals k·π; enter k (an integer or a fraction).`,
        `D 是半径为 ${pR} 的圆盘 x² + y² ≤ ${pR * pR}。计算 ∬_D ${polarIntegrandText} dA。其值等于 k·π；求 k（整数或分数）。`),
      fields: [{ label: t('k', 'k'), answer: pK }],
      hint: t(`Use the set-up of the previous card and integrate r³ from 0 to ${pR}.`, `用上一张卡片的设定，对 r³ 从 0 到 ${pR} 积分。`),
      explanation: t(`∫ from θ = 0 to 2π ∫ from r = 0 to ${pR} of ${pIntegrand} dr dθ = 2π · ${pa} · ${pR ** 4}/4 = (${exact(pK)})π, so k = ${exact(pK)}.`,
        `θ 从 0 到 2π、r 从 0 到 ${pR} 对 ${pIntegrand} dr dθ 的积分 = 2π · ${pa} · ${pR ** 4}/4 = (${exact(pK)})π，所以 k = ${exact(pK)}。`),
      figure: g.figure({
        alt: t(`A disc of radius ${pR} centred at the origin of the xy-plane.`, `xy 平面上以原点为圆心、半径为 ${pR} 的圆盘。`),
        view: fitView(polarIntShapes, 0.25),
        shapes: polarIntShapes,
      }),
      audit: { kind: 'MIT-MV-62:polar-integral', params: { a: pa, R: pR } },
    }),
    g.choice({
      id: 'jacobian-check',
      title: t('Find the mistake', '找出错误'),
      prompt: t(`A student writes ∬_D ${polarIntegrandText} dA over the disc D of radius ${pR}, x² + y² ≤ ${pR * pR}, in polar coordinates as ∫ from θ = 0 to 2π of ∫ from r = 0 to ${pR} of ${pa === 1 ? 'r²' : `${pa}r²`} dr dθ. Which statement is correct?`,
        `一位同学把半径为 ${pR} 的圆盘 D（x² + y² ≤ ${pR * pR}）上的积分 ∬_D ${polarIntegrandText} dA 在极坐标下写成：θ 从 0 到 2π、r 从 0 到 ${pR} 对 ${pa === 1 ? 'r²' : `${pa}r²`} dr dθ 的积分。下列哪条说法正确？`),
      options: jacobOptions,
      correct: 0,
      hint: t('Compare with dA = r dr dθ. What multiplies the integrand in polar coordinates?', '对照 dA = r dr dθ。在极坐标下被积函数还要乘以什么？'),
      explanation: jacobExpl,
    }),
    g.symbols({
      id: 'cyl-setup',
      title: t('Set up in cylindrical coordinates', '写出柱坐标积分'),
      prompt: t(`A solid cylinder occupies x² + y² ≤ ${cR * cR}, 0 ≤ z ≤ ${ch}, with density δ = z. Its mass is M = ∭ z dV. In cylindrical coordinates dV = r dr dθ dz. Complete (θ runs from 0 to 2π): M = the integral over r from 0 to [ ] and z from 0 to [ ] of ([ ]) dz dr dθ.`,
        `一个实心圆柱占据 x² + y² ≤ ${cR * cR}，0 ≤ z ≤ ${ch}，密度 δ = z。其质量为 M = ∭ z dV。在柱坐标下 dV = r dr dθ dz。补全（θ 从 0 到 2π）：M = r 从 0 到 [ ]、z 从 0 到 [ ] 对 ([ ]) dz dr dθ 的积分。`),
      before: t('M = the integral over r from 0 to ', 'M = r 从 0 到 '),
      between: lang === 'zh' ? ['、z 从 0 到 ', ' 对 ('] : [' and z from 0 to ', ' of ('],
      after: t(') dz dr dθ.', ') dz dr dθ 的积分。'),
      answers: [String(cR), String(ch), 'z r'],
      tokens: cylTokens,
      hint: t(`The radius is the square root of the number in x² + y² ≤ ${cR * cR}. In dV = r dr dθ dz, what multiplies the density z?`, `半径是 x² + y² ≤ ${cR * cR} 中那个数的平方根。在 dV = r dr dθ dz 中，什么因子要乘到密度 z 上？`),
      explanation: t(`The disc x² + y² ≤ ${cR * cR} has radius ${cR}, so 0 ≤ r ≤ ${cR}; z runs from 0 to ${ch}. The density is z and dV = r dr dθ dz, so the integrand is z · r.`,
        `x² + y² ≤ ${cR * cR} 是半径为 ${cR} 的圆盘，所以 0 ≤ r ≤ ${cR}；z 从 0 到 ${ch}。密度是 z，dV = r dr dθ dz，所以被积函数是 z · r。`),
      figure: g.figure({
        alt: t('A solid cylinder standing on the xy-plane with its axis along the z-axis.', '立在 xy 平面上、轴沿 z 轴的实心圆柱。'),
        view: fitView(cylShapes, 0.25),
        shapes: cylShapes,
      }),
    }),
    g.number({
      id: 'cyl-mass',
      title: t('Mass of the cylinder', '圆柱的质量'),
      prompt: t(`A solid cylinder of radius ${cR} and height ${ch}, x² + y² ≤ ${cR * cR}, 0 ≤ z ≤ ${ch}, has density δ = z. Its mass M = ∭ z dV equals k·π; enter k (an integer or a fraction).`,
        `半径为 ${cR}、高为 ${ch} 的实心圆柱 x² + y² ≤ ${cR * cR}，0 ≤ z ≤ ${ch}，密度 δ = z。其质量 M = ∭ z dV 等于 k·π；求 k（整数或分数）。`),
      fields: [{ label: t('k', 'k'), answer: cK }],
      hint: t('The integral separates: ∫ dθ · ∫ r dr · ∫ z dz.', '积分可以分离：∫ dθ · ∫ r dr · ∫ z dz。'),
      explanation: t(`M = ∫ from 0 to 2π dθ · ∫ from 0 to ${cR} r dr · ∫ from 0 to ${ch} z dz = 2π · ${cR * cR}/2 · ${ch * ch}/2 = (${exact(cK)})π, so k = ${exact(cK)}.`,
        `M = 0 到 2π 的 ∫ dθ · 0 到 ${cR} 的 ∫ r dr · 0 到 ${ch} 的 ∫ z dz = 2π · ${cR * cR}/2 · ${ch * ch}/2 = (${exact(cK)})π，所以 k = ${exact(cK)}。`),
      figure: g.figure({
        alt: t(`A solid cylinder of radius ${cR} and height ${ch} standing on the xy-plane, axis along the z-axis.`, `立在 xy 平面上、半径为 ${cR}、高为 ${ch}、轴沿 z 轴的实心圆柱。`),
        view: fitView(cylMassShapes, 0.25),
        shapes: cylMassShapes,
      }),
      audit: { kind: 'MIT-MV-62:cyl-mass', params: { R: cR, h: ch } },
    }),
    g.symbols({
      id: 'sph-setup',
      title: t('Set up in spherical coordinates', '写出球坐标积分'),
      prompt: t(`A spherical shell occupies ${sa * sa} ≤ x² + y² + z² ≤ ${sb * sb}, with density δ = ρ, the distance from the origin. Use spherical coordinates (ρ, φ, θ), with φ measured from the positive z-axis (0 ≤ φ ≤ π), dV = ρ² sin φ dρ dφ dθ, and θ from 0 to 2π. Complete: M = ∭ δ dV = the integral over ρ from [ ] to [ ] and φ from 0 to [ ] of ([ ]) dρ dφ dθ.`,
        `一个球壳占据 ${sa * sa} ≤ x² + y² + z² ≤ ${sb * sb}，密度 δ = ρ（到原点的距离）。使用球坐标 (ρ, φ, θ)，φ 是从正 z 轴量起的角（0 ≤ φ ≤ π），dV = ρ² sin φ dρ dφ dθ，θ 从 0 到 2π。补全：M = ∭ δ dV = ρ 从 [ ] 到 [ ]、φ 从 0 到 [ ] 对 ([ ]) dρ dφ dθ 的积分。`),
      before: t('M = ∭ δ dV = the integral over ρ from ', 'M = ∭ δ dV = ρ 从 '),
      between: lang === 'zh' ? [' 到 ', '、φ 从 0 到 ', ' 对 ('] : [' to ', ' and φ from 0 to ', ' of ('],
      after: t(') dρ dφ dθ.', ') dρ dφ dθ 的积分。'),
      answers: [String(sa), String(sb), 'π', 'ρ³ sin φ'],
      tokens: sphTokens,
      hint: t('ρ is the distance from the origin, so ρ² = x² + y² + z². The integrand is the density times the Jacobian.', 'ρ 是到原点的距离，所以 ρ² = x² + y² + z²。被积函数是密度乘以雅可比因子。'),
      explanation: t(`ρ² = x² + y² + z² runs from ${sa * sa} to ${sb * sb}, so ρ runs from ${sa} to ${sb}; φ runs from 0 to π and θ from 0 to 2π. The integrand is the density times the Jacobian: ρ · ρ² sin φ = ρ³ sin φ.`,
        `ρ² = x² + y² + z² 从 ${sa * sa} 变到 ${sb * sb}，所以 ρ 从 ${sa} 到 ${sb}；φ 从 0 到 π，θ 从 0 到 2π。被积函数是密度乘以雅可比因子：ρ · ρ² sin φ = ρ³ sin φ。`),
      figure: g.figure({
        alt: t('Cross-section of a spherical shell in the xz-plane: two circles around the origin; the shell is the region between them.', '球壳在 xz 平面内的截面：以原点为圆心的两个圆，球壳是两圆之间的部分。'),
        view: fitView(sphShapes, 0.25),
        shapes: sphShapes,
      }),
    }),
    g.number({
      id: 'sph-mass',
      title: t('Mass of the shell', '球壳的质量'),
      prompt: t(`A spherical shell lies between the spheres of radius ${sa} and radius ${sb} centred at the origin. Its density at distance ρ from the origin is δ = ρ. The mass M = ∭ δ dV equals k·π; enter k (an integer).`,
        `一个球壳位于以原点为球心、半径分别为 ${sa} 和 ${sb} 的两个球面之间，在到原点距离为 ρ 处密度为 δ = ρ。其质量 M = ∭ δ dV 等于 k·π；求 k（整数）。`),
      fields: [{ label: t('k', 'k'), answer: sK }],
      hint: t('Use spherical coordinates (φ measured from the positive z-axis): the integral separates into ∫ dθ · ∫ sin φ dφ · ∫ ρ³ dρ.', '用球坐标（φ 是从正 z 轴量起的角）：积分可分离为 ∫ dθ · ∫ sin φ dφ · ∫ ρ³ dρ。'),
      explanation: t(`M = ∫ from 0 to 2π dθ · ∫ from 0 to π sin φ dφ · ∫ from ${sa} to ${sb} ρ³ dρ = 2π · 2 · (${sb ** 4} − ${sa ** 4})/4 = (${exact(sK)})π, so k = ${exact(sK)}.`,
        `M = 0 到 2π 的 ∫ dθ · 0 到 π 的 ∫ sin φ dφ · ${sa} 到 ${sb} 的 ∫ ρ³ dρ = 2π · 2 · (${sb ** 4} − ${sa ** 4})/4 = (${exact(sK)})π，所以 k = ${exact(sK)}。`),
      figure: g.figure({
        alt: t(`Cross-section of the shell in the xz-plane: two circles around the origin with radii ${sa} and ${sb}; the shell is the region between them.`, `球壳在 xz 平面内的截面：以原点为圆心、半径分别为 ${sa} 和 ${sb} 的两个圆，球壳是两圆之间的部分。`),
        view: fitView(sphMassShapes, 0.25),
        shapes: sphMassShapes,
      }),
      audit: { kind: 'MIT-MV-62:sph-mass', params: { a: sa, b: sb } },
    }),
    g.number({
      id: 'challenge',
      title: t('Half a ball', '半个球'),
      prompt: t(`Let H be the upper half of the ball of radius ${chA}: x² + y² + z² ≤ ${chA * chA}, z ≥ 0. Evaluate ∭_H ${chM === 1 ? 'z' : `${chM}z`} dV. The value equals k·π; enter k (an integer or a fraction).`,
        `设 H 是半径为 ${chA} 的球的上半部分：x² + y² + z² ≤ ${chA * chA}，z ≥ 0。计算 ∭_H ${chM === 1 ? 'z' : `${chM}z`} dV。其值等于 k·π；求 k（整数或分数）。`),
      fields: [{ label: t('k', 'k'), answer: chK }],
      hint: t('Which coordinate system makes the ball and the plane z = 0 simple? If you use spherical coordinates, φ is measured from the positive z-axis.', '哪种坐标系能让球和平面 z = 0 都变得简单？若用球坐标，φ 是从正 z 轴量起的角。'),
      explanation: t(`In spherical coordinates (φ measured from the positive z-axis) H is 0 ≤ ρ ≤ ${chA}, 0 ≤ φ ≤ π/2, 0 ≤ θ ≤ 2π, and z = ρ cos φ. So ∭ ${chM === 1 ? 'z' : `${chM}z`} dV = ${chM === 1 ? '' : `${chM} · `}∫ dθ · ∫ cos φ sin φ dφ · ∫ ρ³ dρ = ${chM === 1 ? '' : `${chM} · `}2π · (1/2) · ${chA ** 4}/4 = (${exact(chK)})π, so k = ${exact(chK)}. ${NOT_ASSESSED_EN}`,
        `在球坐标下（φ 是从正 z 轴量起的角），H 是 0 ≤ ρ ≤ ${chA}，0 ≤ φ ≤ π/2，0 ≤ θ ≤ 2π，且 z = ρ cos φ。所以 ∭ ${chM === 1 ? 'z' : `${chM}z`} dV = ${chM === 1 ? '' : `${chM} · `}∫ dθ · ∫ cos φ sin φ dφ · ∫ ρ³ dρ = ${chM === 1 ? '' : `${chM} · `}2π · (1/2) · ${chA ** 4}/4 = (${exact(chK)})π，所以 k = ${exact(chK)}。${NOT_ASSESSED_ZH}`),
      audit: { kind: 'MIT-MV-62:challenge', params: { a: chA, m: chM } },
    }),
  ];
};
