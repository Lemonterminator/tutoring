import type { CardGenerator } from '../../types';
import { fitView, rect, sampleCurve, type FigureShape } from '../../figure';
import { coef, frac, makeMvDeck, num, par, piTerm, type Text, exact } from '../support';

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

export const mv36: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-36');
  warm(g);

  // --- point-mass ---
  const pm = retry(() => {
    const pair = g.pick([[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]]);
    const x1 = g.random(-3, 3);
    const x2 = retry(() => g.random(-3, 3), v => v !== x1);
    return { m1: pair[0], x1, m2: pair[1], x2 };
  }, v => v.x1 !== v.x2);
  const pmAns = (pm.m1 * pm.x1 + pm.m2 * pm.x2) / (pm.m1 + pm.m2);

  // --- mass-rect ---
  const mr = retry(() => ({ a: g.random(1, 3), b: g.random(1, 3), p: g.random(1, 3) }), v => v.a !== v.b);
  const mrAns = mr.p * mr.a * mr.a * mr.b / 2;
  const mrDensity = coef(mr.p, 'x');
  const mrShapes: FigureShape[] = [
    { kind: 'area', points: rect(0, 0, mr.a, mr.b), tone: 'accent', opacity: 0.25 },
    { kind: 'line', points: [...rect(0, 0, mr.a, mr.b), [0, 0]], tone: 'accent', width: 2 },
    { kind: 'text', at: [mr.a / 2, -0.3], text: 'a', tone: 'text' },
    { kind: 'text', at: [-0.3, mr.b / 2], text: 'b', tone: 'text' },
  ];

  // --- com-assumption ---
  const ca = retry(() => {
    const a = g.random(2, 5);
    const dens = g.pick(['x', 'y', 'a-x', 'a-y']);
    return { a, dens };
  }, () => true);
  const caH = ca.a / 2;
  let caU: string, caV: string, caDir: 'greater' | 'less', caXcm: number, caYcm: number;
  if (ca.dens === 'x') { caU = 'x'; caV = 'y'; caDir = 'greater'; caXcm = 2 * ca.a / 3; caYcm = ca.a / 2; }
  else if (ca.dens === 'y') { caU = 'y'; caV = 'x'; caDir = 'greater'; caXcm = ca.a / 2; caYcm = 2 * ca.a / 3; }
  else if (ca.dens === 'a-x') { caU = 'x'; caV = 'y'; caDir = 'less'; caXcm = ca.a / 3; caYcm = ca.a / 2; }
  else { caU = 'y'; caV = 'x'; caDir = 'less'; caXcm = ca.a / 2; caYcm = ca.a / 3; }
  const caDensStr = ca.dens === 'a-x' ? `${ca.a} − x` : ca.dens === 'a-y' ? `${ca.a} − y` : ca.dens;
  const caGreater = caDir === 'greater';
  const caOpts = [
    t(`${caU}_cm is ${caDir} than ${num(caH)} and ${caV}_cm equals ${num(caH)}: the center of mass moves toward the denser side.`,
      `${caU}_cm ${caGreater ? '大于' : '小于'} ${num(caH)}，${caV}_cm 等于 ${num(caH)}：质心向密度较大的一侧偏移。`),
    t(`It is exactly the geometric center (${num(caH)}, ${num(caH)}), because the square is symmetric.`,
      `它恰好是几何中心 (${num(caH)}, ${num(caH)})，因为正方形是对称的。`),
    t(`${caU}_cm is ${caGreater ? 'less' : 'greater'} than ${num(caH)} and ${caV}_cm equals ${num(caH)}: the center of mass moves away from the denser side.`,
      `${caU}_cm ${caGreater ? '小于' : '大于'} ${num(caH)}，${caV}_cm 等于 ${num(caH)}：质心偏离密度较大的一侧。`),
    t(`Both x_cm and y_cm are ${caDir} than ${num(caH)}, because the density changes with ${caU}.`,
      `x_cm 与 y_cm 都${caGreater ? '大于' : '小于'} ${num(caH)}，因为密度随 ${caU} 变化。`),
  ];

  // --- setup-xcm ---
  const sx = retry(() => {
    const a = g.random(2, 4);
    const d = g.pick(['x', 'y']);
    const w = g.pick(['x', 'y']);
    return { a, d, w };
  }, () => true);
  let sxIntegrand: string;
  if (sx.d === 'y' && sx.w === 'x') sxIntegrand = 'r³ sin θ cos θ';
  else if (sx.d === 'y' && sx.w === 'y') sxIntegrand = 'r³ sin² θ';
  else if (sx.d === 'x' && sx.w === 'x') sxIntegrand = 'r³ cos² θ';
  else sxIntegrand = 'r³ sin θ cos θ';
  const sxD1 = sxIntegrand.replace('r³', 'r²');
  let sxD2: string;
  if (sx.d === 'y') sxD2 = 'r² sin θ'; else sxD2 = 'r² cos θ';
  let sxD3: string;
  if (sx.d === 'y') sxD3 = 'r³ sin θ'; else sxD3 = 'r³ cos θ';
  const sxTokens = shuffled(g, ['0', String(sx.a), 'π/2', 'π', sxIntegrand, sxD1, sxD2, sxD3]);

  // --- xcm-qdisk ---
  const xq = { a: g.random(1, 4), k: g.random(1, 3) };
  const xqAns = 3 * xq.a / 8;
  const xqM = xq.k * xq.a * xq.a * xq.a / 3;
  const xqDensity = coef(xq.k, 'y');

  // --- ycm-qdisk ---
  const yq = { a: g.random(1, 4), k: g.random(1, 3) };
  const yqAns = 3 * Math.PI * yq.a / 16;
  const yqM = yq.k * yq.a * yq.a * yq.a / 3;
  const yqDensity = coef(yq.k, 'y');

  // --- avg-distance ---
  const ad = { a: g.random(1, 6) };
  const adAns = 4 * ad.a / 3;

  // --- inertia-rect ---
  const ir = retry(() => ({ a: g.random(1, 3), b: g.random(1, 3), p: g.random(1, 3) }), v => v.a !== v.b);
  const irAns = ir.p * ir.a ** 4 * ir.b ** 2 / 8;
  const irDensity = coef(ir.p, 'xy');
  const irShapes: FigureShape[] = [
    { kind: 'area', points: rect(0, 0, ir.a, ir.b), tone: 'accent2', opacity: 0.25 },
    { kind: 'line', points: [...rect(0, 0, ir.a, ir.b), [0, 0]], tone: 'accent2', width: 2 },
    { kind: 'text', at: [ir.a / 2, -0.3], text: 'a', tone: 'text' },
    { kind: 'text', at: [-0.3, ir.b / 2], text: 'b', tone: 'text' },
  ];

  // --- challenge ---
  const ch = { a: g.random(1, 4), k: g.random(1, 3) };
  const chAns = ch.k * Math.PI * ch.a ** 4 / 8;

  // Quarter disk shape helper
  const qdisk = (r: number): FigureShape[] => {
    const arc = sampleCurve((t: number) => [r * Math.cos(t), r * Math.sin(t)], 0, Math.PI / 2);
    return [
      { kind: 'area', points: [[0, 0], ...arc, [0, 0]], tone: 'accent3', opacity: 0.2 },
      { kind: 'line', points: [[0, 0], [r, 0]], tone: 'accent3', width: 2 },
      { kind: 'line', points: [[0, 0], [0, r]], tone: 'accent3', width: 2 },
      { kind: 'line', points: [...arc, [0, 0]], tone: 'accent3', width: 2 },
      { kind: 'text', at: [r * 0.7, 0.15], text: String(r), tone: 'text' },
    ];
  };

  return [
    g.number({
      id: 'point-mass',
      title: t('Center of mass of two point masses', '两个质点的质心'),
      prompt: t(`Two point masses lie on a line: mass ${pm.m1} at x = ${num(pm.x1)} and mass ${pm.m2} at x = ${num(pm.x2)}. Find the center of mass x_cm (an integer or a fraction).`,
        `数轴上有两个质点：质量 ${pm.m1} 位于 x = ${num(pm.x1)}，质量 ${pm.m2} 位于 x = ${num(pm.x2)}。求质心 x_cm（填整数或分数）。`),
      fields: [{ label: t('x_cm', 'x_cm'), answer: pmAns }],
      hint: t('Weight each position by its mass, then divide by the total mass.', '用质量给每个位置加权，再除以总质量。'),
      explanation: t(`x_cm = (m1x1 + m2x2)/(m1 + m2) = (${pm.m1}·${par(pm.x1)} + ${pm.m2}·${par(pm.x2)})/${pm.m1 + pm.m2} = ${exact(pmAns)}.`,
        `x_cm = (m1x1 + m2x2)/(m1 + m2) = (${pm.m1}×${par(pm.x1)} + ${pm.m2}×${par(pm.x2)})/${pm.m1 + pm.m2} = ${exact(pmAns)}。`),
      audit: { kind: 'MIT-MV-36:point-mass', params: { m1: pm.m1, x1: pm.x1, m2: pm.m2, x2: pm.x2 } },
    }),
    g.number({
      id: 'mass-rect',
      title: t('Mass of a rectangular plate', '矩形薄板的质量'),
      prompt: t(`A rectangular plate fills 0 ≤ x ≤ ${mr.a}, 0 ≤ y ≤ ${mr.b} with density δ(x, y) = ${mrDensity}. Find its mass M = ∬_R δ dA.`,
        `矩形薄板占据 0 ≤ x ≤ ${mr.a}，0 ≤ y ≤ ${mr.b}，密度 δ(x, y) = ${mrDensity}。求它的质量 M = ∬_R δ dA。`),
      figure: g.figure({
        alt: t(`The rectangle 0 ≤ x ≤ ${mr.a}, 0 ≤ y ≤ ${mr.b}.`, `矩形 0 ≤ x ≤ ${mr.a}，0 ≤ y ≤ ${mr.b}。`),
        view: fitView(mrShapes, 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: mrShapes,
      }),
      fields: [{ label: t('M', 'M'), answer: mrAns }],
      hint: t(`M = ∬ δ dA. Integrate in x first: δ = ${mrDensity} does not depend on y.`, `M = ∬ δ dA。先对 x 积分；δ 与 y 无关。`),
      explanation: t(`M = ∫₀^${mr.b} ∫₀^${mr.a} ${mrDensity} dx dy = ${mr.p}·(${mr.a}²/2)·${mr.b} = ${num(mrAns)}.`,
        `M = ∫₀^${mr.b} ∫₀^${mr.a} ${mrDensity} dx dy = ${mr.p}·(${mr.a}²/2)·${mr.b} = ${num(mrAns)}。`),
      audit: { kind: 'MIT-MV-36:mass-rect', params: { a: mr.a, b: mr.b, p: mr.p } },
    }),
    g.choice({
      id: 'com-assumption',
      title: t('Center of mass vs. geometric center', '质心与几何中心'),
      prompt: t(`A square plate fills 0 ≤ x ≤ ${ca.a}, 0 ≤ y ≤ ${ca.a} and its density is δ = ${caDensStr}, so one side is denser. How does its center of mass (x_cm, y_cm) compare with the geometric center (${num(caH)}, ${num(caH)})?`,
        `正方形薄板占据 0 ≤ x ≤ ${ca.a}，0 ≤ y ≤ ${ca.a}，密度 δ = ${caDensStr}，所以一侧更密。它的质心 (x_cm, y_cm) 与几何中心 (${num(caH)}, ${num(caH)}) 相比如何？`),
      options: caOpts,
      correct: 0,
      hint: t('x_cm and y_cm are averages weighted by mass; the geometric center is the case δ = 1.', 'x_cm、y_cm 是按质量加权的平均；几何中心对应 δ = 1 的情形。'),
      explanation: t(`For δ = ${caDensStr}: (x_cm, y_cm) = (${num(caXcm)}, ${num(caYcm)}), while the geometric center is (${num(caH)}, ${num(caH)}). The center of mass moves toward the denser side; constant density is sufficient for it to equal the geometric center, but is not necessary.`,
        `当 δ = ${caDensStr} 时，(x_cm, y_cm) = (${num(caXcm)}, ${num(caYcm)})，而几何中心是 (${num(caH)}, ${num(caH)})。质心向密度较大的一侧偏移；密度为常数是质心与几何中心重合的充分条件，但不是必要条件。`),
    }),
    g.symbols({
      id: 'setup-xcm',
      title: t('Set up the integral in polar coordinates', '用极坐标写出积分'),
      prompt: t(`R is the quarter of the disk x² + y² ≤ ${sx.a}² in the first quadrant, with density δ = ${sx.d}. In polar coordinates (inner r first) fill in ∬_R ${sx.w}·δ dA = ∫∫ [ ] dr dθ over [ ] ≤ r ≤ [ ], [ ] ≤ θ ≤ [ ].`,
        `R 是圆盘 x² + y² ≤ ${sx.a}² 在第一象限的四分之一，密度 δ = ${sx.d}。用极坐标（先 r 后 θ）把 ∬_R ${sx.w}·δ dA 写成 ∫∫ [ ] dr dθ，积分区域 [ ] ≤ r ≤ [ ]，[ ] ≤ θ ≤ [ ]。`),
      before: '∫∫ ',
      between: [' dr dθ over ', ' ≤ r ≤ ', ', ', ' ≤ θ ≤ '],
      after: '',
      answers: [sxIntegrand, '0', String(sx.a), '0', 'π/2'],
      tokens: sxTokens,
      hint: t(`x = r cos θ, y = r sin θ and dA = r dr dθ. Write ${sx.w}·δ in polar form, then multiply by r.`, `x = r cos θ，y = r sin θ，dA = r dr dθ。先把 ${sx.w}·δ 写成极坐标，再乘以 r。`),
      explanation: t(`${sx.w}·δ in polar gives the trigonometric factor; times the factor r from dA this gives ${sxIntegrand}. The quarter disk is 0 ≤ r ≤ ${sx.a}, 0 ≤ θ ≤ π/2.`,
        `${sx.w}·δ 的极坐标形式给出三角因子；再乘以 dA 中的因子 r 得 ${sxIntegrand}。四分之一圆盘是 0 ≤ r ≤ ${sx.a}，0 ≤ θ ≤ π/2。`),
    }),
    g.number({
      id: 'xcm-qdisk',
      title: t('x-coordinate of center of mass (quarter disk)', '四分之一圆盘的质心 x 坐标'),
      prompt: t(`R is the quarter of the disk x² + y² ≤ ${xq.a}² in the first quadrant, with density δ = ${xqDensity}. Its mass is M = ${exact(xqM)}. Find x_cm = (1/M)∬_R xδ dA.`,
        `R 是圆盘 x² + y² ≤ ${xq.a}² 在第一象限的四分之一，密度 δ = ${xqDensity}。其质量 M = ${exact(xqM)}。求 x_cm = (1/M)∬_R xδ dA。`),
      figure: g.figure({
        alt: t(`The quarter disk x² + y² ≤ ${xq.a}² in the first quadrant.`, `第一象限的四分之一圆盘 x² + y² ≤ ${xq.a}²。`),
        view: fitView(qdisk(xq.a), 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: qdisk(xq.a),
      }),
      fields: [{ label: t('x_cm', 'x_cm'), answer: xqAns }],
      hint: t(`In polar coordinates ∬ xδ dA = ${xq.k}∫∫ r³ cos θ sin θ dr dθ. M is given.`, `用极坐标：∬ xδ dA = ${xq.k}∫∫ r³ cos θ sin θ dr dθ。M 已给出。`),
      explanation: t(`∬ xδ dA = ${xq.k}·(${xq.a}⁴/4)·(1/2) = ${num(xq.k * xq.a ** 4 / 8)}, so x_cm = ${num(xq.k * xq.a ** 4 / 8)}/(${exact(xqM)}) = 3·${xq.a}/8 = ${num(xqAns)}. The factor ${xq.k} cancels.`,
        `∬ xδ dA = ${xq.k}·(${xq.a}⁴/4)·(1/2) = ${num(xq.k * xq.a ** 4 / 8)}，所以 x_cm = ${num(xq.k * xq.a ** 4 / 8)}/(${exact(xqM)}) = 3·${xq.a}/8 = ${num(xqAns)}。系数 ${xq.k} 约掉了。`),
      audit: { kind: 'MIT-MV-36:xcm-qdisk', params: { a: xq.a, k: xq.k } },
    }),
    g.number({
      id: 'ycm-qdisk',
      title: t('y-coordinate of center of mass (quarter disk)', '四分之一圆盘的质心 y 坐标'),
      prompt: t(`R is the quarter of the disk x² + y² ≤ ${yq.a}² in the first quadrant, with density δ = ${yqDensity}. Its mass is M = ${exact(yqM)}. Find y_cm = (1/M)∬_R yδ dA. Give the answer as a multiple of π.`,
        `R 是圆盘 x² + y² ≤ ${yq.a}² 在第一象限的四分之一，密度 δ = ${yqDensity}。其质量 M = ${exact(yqM)}。求 y_cm = (1/M)∬_R yδ dA，答案写成 π 的倍数。`),
      figure: g.figure({
        alt: t(`The quarter disk x² + y² ≤ ${yq.a}² in the first quadrant.`, `第一象限的四分之一圆盘 x² + y² ≤ ${yq.a}²。`),
        view: fitView(qdisk(yq.a), 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: qdisk(yq.a),
      }),
      fields: [{ label: t('y_cm', 'y_cm'), answer: yqAns }],
      hint: t('Now the integrand has sin² θ, and ∫_0^{π/2} sin² θ dθ = π/4.', '这次被积函数含 sin² θ，且 ∫_0^{π/2} sin² θ dθ = π/4。'),
      explanation: t(`∬ yδ dA = ${yq.k}·(${yq.a}⁴/4)·(π/4) = ${piTerm(yq.k * yq.a ** 4 / 16)}, so y_cm = 3π·${yq.a}/16 ≈ ${num(yqAns)}. It differs from x_cm because δ = ${coef(yq.k, 'y')} is not symmetric in x and y.`,
        `∬ yδ dA = ${yq.k}·(${yq.a}⁴/4)·(π/4) = ${piTerm(yq.k * yq.a ** 4 / 16)}，所以 y_cm = 3π·${yq.a}/16 ≈ ${num(yqAns)}。它与 x_cm 不同，因为 δ = ${coef(yq.k, 'y')} 对 x、y 不对称。`),
      audit: { kind: 'MIT-MV-36:ycm-qdisk', params: { a: yq.a, k: yq.k } },
    }),
    g.number({
      id: 'avg-distance',
      title: t('Average distance to the x-axis', '到 x 轴的平均距离'),
      prompt: t(`R is the quarter of the disk x² + y² ≤ ${ad.a}² in the first quadrant (no density). Average with respect to area; the area of R is π·${ad.a}²/4. The average distance from a point of R to the x-axis equals k/π. Find k.`,
        `R 是圆盘 x² + y² ≤ ${ad.a}² 在第一象限的四分之一（不带密度）。平均值按面积取，R 的面积为 π·${ad.a}²/4。R 中的点到 x 轴的平均距离等于 k/π，求 k。`),
      figure: g.figure({
        alt: t(`The quarter disk x² + y² ≤ ${ad.a}² in the first quadrant.`, `第一象限的四分之一圆盘 x² + y² ≤ ${ad.a}²。`),
        view: fitView(qdisk(ad.a), 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: qdisk(ad.a),
      }),
      fields: [{ label: t('k', 'k'), answer: adAns }],
      hint: t('Average over area: (1/area)∬ y dA, with y = r sin θ.', '按面积取平均：(1/面积)∬ y dA，其中 y = r sin θ。'),
      explanation: t(`∬ y dA = ∫₀^{π/2} ∫₀^${ad.a} r² sin θ dr dθ = ${ad.a}³/3. Divide by the area π·${ad.a}²/4: the average is 4·${ad.a}/(3π), so k = ${exact(adAns)}.`,
        `∬ y dA = ∫₀^{π/2} ∫₀^${ad.a} r² sin θ dr dθ = ${ad.a}³/3。除以面积 π·${ad.a}²/4，平均距离为 4·${ad.a}/(3π)，所以 k = ${exact(adAns)}。`),
      audit: { kind: 'MIT-MV-36:avg-distance', params: { a: ad.a } },
    }),
    g.number({
      id: 'inertia-rect',
      title: t('Moment of inertia about the y-axis', '关于 y 轴的转动惯量'),
      prompt: t(`A rectangular plate fills 0 ≤ x ≤ ${ir.a}, 0 ≤ y ≤ ${ir.b} with density δ = ${irDensity}. The distance from a point to the y-axis is x. Find the moment of inertia I of the plate about the y-axis.`,
        `矩形薄板占据 0 ≤ x ≤ ${ir.a}，0 ≤ y ≤ ${ir.b}，密度 δ = ${irDensity}。点到 y 轴的距离是 x。求薄板关于 y 轴的转动惯量 I。`),
      figure: g.figure({
        alt: t(`The rectangle 0 ≤ x ≤ ${ir.a}, 0 ≤ y ≤ ${ir.b}.`, `矩形 0 ≤ x ≤ ${ir.a}，0 ≤ y ≤ ${ir.b}。`),
        view: fitView(irShapes, 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: irShapes,
      }),
      fields: [{ label: t('I', 'I'), answer: irAns }],
      hint: t('dI = (distance to the axis)² · dm, and dm = δ dA.', 'dI = (到转轴的距离)² · dm，而 dm = δ dA。'),
      explanation: t(`I = ∫₀^${ir.b} ∫₀^${ir.a} x²·${irDensity} dx dy = ${ir.p}·(${ir.a}⁴/4)·(${ir.b}²/2) = ${num(irAns)}.`,
        `I = ∫₀^${ir.b} ∫₀^${ir.a} x²·${irDensity} dx dy = ${ir.p}·(${ir.a}⁴/4)·(${ir.b}²/2) = ${num(irAns)}。`),
      audit: { kind: 'MIT-MV-36:inertia-rect', params: { a: ir.a, b: ir.b, p: ir.p } },
    }),
    g.number({
      id: 'challenge',
      title: t('Polar moment of inertia (quarter disk)', '极转动惯量（四分之一圆盘）'),
      prompt: t(`R is the quarter of the disk x² + y² ≤ ${ch.a}² in the first quadrant with constant density δ = ${ch.k}. Find its polar moment of inertia (the moment of inertia about the origin, i.e. the z-axis) as a multiple of π.`,
        `R 是圆盘 x² + y² ≤ ${ch.a}² 在第一象限的四分之一，密度为常数 δ = ${ch.k}。求它的极转动惯量（关于原点即 z 轴的转动惯量），答案写成 π 的倍数。`),
      figure: g.figure({
        alt: t(`The quarter disk x² + y² ≤ ${ch.a}² in the first quadrant.`, `第一象限的四分之一圆盘 x² + y² ≤ ${ch.a}²。`),
        view: fitView(qdisk(ch.a), 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: qdisk(ch.a),
      }),
      fields: [{ label: t('I', 'I'), answer: chAns }],
      hint: t('The distance to the origin is r.', '到原点的距离是 r。'),
      explanation: t(`dI = r²δ dA, so I = ∫₀^{π/2} ∫₀^${ch.a} r²·${ch.k}·r dr dθ = ${ch.k}·(${ch.a}⁴/4)·(π/2) ≈ ${num(chAns)}. This game does not explain why moment of inertia measures resistance to rotation, and it never asks for an integral whose polar limit involves sec θ.`,
        `dI = r²δ dA，所以 I = ∫₀^{π/2} ∫₀^${ch.a} r²·${ch.k}·r dr dθ = ${ch.k}·(${ch.a}⁴/4)·(π/2) ≈ ${num(chAns)}。本游戏不解释转动惯量为何衡量对旋转的阻力，也从不要求计算极坐标边界含 sec θ 的积分。`),
      audit: { kind: 'MIT-MV-36:challenge', params: { a: ch.a, k: ch.k } },
    }),
  ];
};
