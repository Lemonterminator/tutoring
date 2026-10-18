import type { CardGenerator } from '../../types';
import { coef, exact, frac, linear, makeMvDeck, num, par, vec, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
type Tri = [number, number, number];
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
const norm2 = (p: readonly number[]) => p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
const ORDERS: [string, string, string][] = [
  ['x', 'y', 'z'], ['x', 'z', 'y'], ['y', 'x', 'z'], ['y', 'z', 'x'], ['z', 'x', 'y'], ['z', 'y', 'x'],
];

const NOT_ASSESSED_EN = 'This game reviews only Unit 2: gradients, tangent planes, Lagrange multipliers and constrained differentials. It does not assess the second derivative test, least squares or integrals.';
const NOT_ASSESSED_ZH = '本游戏只复习第二单元：梯度、切平面、拉格朗日乘数法和受约束的微分。不涉及二阶导数检验、最小二乘和积分。';

export const mv66: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-66');
  warm(g);

  // 1. grad-dir
  // NOTE: the plan prints the parenthetical "(for m = 1 this is x²y − xy³)" unconditionally; that repeats the prompt
  // itself when m = 1, so it is shown only when m = 2 (the case where it adds information). Plan gap, fixed here.
  const m = g.pick([1, 2]);
  const [p, q] = g.pick([[2, 1], [1, 2], [2, -1], [1, -1], [3, 1], [-1, 2], [-2, 1]] as [number, number][]);
  const [u, v] = g.pick([[3, 4], [4, 3], [-3, 4], [3, -4], [-4, 3], [5, 12], [12, 5], [6, 8]] as [number, number][]);
  const nA = Math.sqrt(u * u + v * v);
  const fx = 2 * p * q - m * q ** 3;
  const fy = p * p - 3 * m * p * q * q;
  const gradAns = (fx * u + fy * v) / nA;

  // 2. level-dir
  const g1 = g.nonzero(1, 4) * g.pick([1, -1]);
  const g2 = retry(() => g.nonzero(1, 4) * g.pick([1, -1]), w => Math.abs(w) !== Math.abs(g1));
  const K: [number, number] = g.pick([1, -1]) === 1 ? [-g2, g1] : [g2, -g1];
  const distractors = shuffled(g, [[g1, g2], [-g1, -g2], [g2, g1], [-g1, g2], [g1, -g2]] as [number, number][]).slice(0, 3);
  // NOTE: each printed dot product ∇ω · A is computed from the sampled g1, g2 and the option vector, never hard-coded.
  const dotExpr = (d: [number, number]) => `${par(g1)}·${par(d[0])} ${g2 < 0 ? '−' : '+'} ${par(Math.abs(g2))}·${par(d[1])}`;
  const dotVal = (d: [number, number]) => g1 * d[0] + g2 * d[1];

  // 3. tangent-plane
  const [a, b] = g.pick([[1, 2], [2, 1], [2, 2], [1, 3], [3, 1], [2, 3], [3, 2]] as [number, number][]);
  const x0 = g.pick([1, 2]);
  const y0 = g.pick([1, -1, 2, -2]);
  const z0 = g.pick([1, -1, 2, -2]);
  const B = a * y0, C = b * z0, D = x0 * x0 + a * y0 * y0 + b * z0 * z0;

  // 4. dihedral
  const quad = shuffled(g, [...g.pick([[1, 2, 2], [2, 3, 6], [1, 4, 8], [4, 4, 7]] as Tri[])]);
  const da = quad[0] * g.pick([1, -1]);
  const db = quad[1] * g.pick([1, -1]);
  const dc = quad[2] * g.pick([1, -1]);
  const dd = g.random(1, 9);
  const dN = Math.sqrt(da * da + db * db + dc * dc);
  const dihedralAns = Math.abs(dc) / dN;

  // 5. lagrange-setup
  const [la, lb, lc] = retry(() => {
    const a1 = g.nonzero(1, 5) * g.pick([1, -1]);
    const b1 = g.nonzero(1, 5) * g.pick([1, -1]);
    const c1 = g.nonzero(1, 5) * g.pick([1, -1]);
    return [a1, b1, c1] as Tri;
  }, v => {
    const [a1, b1, c1] = v.map(Math.abs);
    if (a1 === b1 || a1 === c1 || b1 === c1) return false;
    return !(a1 === 2 * b1 || b1 === 2 * a1 || a1 === 2 * c1 || c1 === 2 * a1 || b1 === 2 * c1 || c1 === 2 * b1);
  });
  const ld = retry(() => g.random(1, 12), v => ![la, lb, lc, 2 * la, 2 * lb, 2 * lc].includes(v));
  const lsTokens = shuffled(g, [la, lb, lc, ld, 2 * la, 2 * lb, 2 * lc].map(num));

  // 6. lagrange-point
  const lpBase = g.pick([[1, 1, 1], [2, 1, 1], [1, 2, 2]] as Tri[]);
  const lpN = norm2(lpBase);
  const lpD = g.pick(lpN === 3 ? [3, 6, 9, -3, 2, 4, 5] : lpN === 6 ? [6, 12, -6, 3, 9] : [9, 18, -9, 3, 6]);
  const lpPerm = shuffled(g, [0, 1, 2]);
  const lpSign = g.pick([1, -1]);
  const lpa = lpBase[lpPerm[0]] * lpSign, lpb = lpBase[lpPerm[1]] * lpSign, lpc = lpBase[lpPerm[2]] * lpSign;
  const lpX = lpD * lpa / lpN, lpY = lpD * lpb / lpN, lpZ = lpD * lpc / lpN;

  // 7. lagrange-check
  const lcBase = g.pick([[1, 1, 1], [2, 1, 1], [1, 2, 2]] as Tri[]);
  const lcPerm = shuffled(g, [0, 1, 2]);
  const lcSign = g.pick([1, -1]);
  const lca = lcBase[lcPerm[0]] * lcSign, lcb = lcBase[lcPerm[1]] * lcSign, lcc = lcBase[lcPerm[2]] * lcSign;
  const lcN = norm2([lca, lcb, lcc]);
  const lcM = g.pick([1, 2, -1]);
  const lcD = lcM * lcN;
  const Kpt: Tri = [lcM * lca, lcM * lcb, lcM * lcc];
  const tA: Tri = [lcb, -lca, 0];
  const tB: Tri = [lcc, 0, -lca];
  const add = (p1: readonly number[], p2: readonly number[]): Tri => [p1[0] + p2[0], p1[1] + p2[1], p1[2] + p2[2]];
  const lcPts: Tri[] = [Kpt, add(Kpt, tA), add(Kpt, tB), add(add(Kpt, tA), tB)];
  const lcNorms = lcPts.map(norm2);
  const lcMin = Math.min(...lcNorms);

  // 8. constraint-setup
  const [cu, cv, cw] = g.pick(ORDERS);
  const c0 = g.random(1, 9);

  // 9. constraint-value
  const c0v = g.random(1, 9);
  const cvr = retry(() => {
    const f: Record<string, number> = {}, gg: Record<string, number> = {};
    for (const key of ['x', 'y', 'z']) { f[key] = g.nonzero(1, 3) * g.pick([1, -1]); gg[key] = g.nonzero(1, 3) * g.pick([1, -1]); }
    return { f, gg, order: g.pick(ORDERS) };
  }, v => {
    const [du, dv, dw] = v.order;
    const fu = v.f[du], fv = v.f[dv], gu = v.gg[du], gv = v.gg[dv];
    if (gu === 0) return false;
    // reject the answer 0 and the source combination (P8b)
    if (fv - fu * gv / gu === 0) return false;
    if (v.f.x === 1 && v.f.y === 1 && v.f.z === 2 && v.gg.x === 2 && v.gg.y === -1 && v.gg.z === -1 && du === 'z' && dv === 'x' && dw === 'y') return false;
    return true;
  });
  const [cu2, cv2, cw2] = cvr.order;
  const fu = cvr.f[cu2], fv = cvr.f[cv2], fw = cvr.f[cw2];
  const gu = cvr.gg[cu2], gv = cvr.gg[cv2], gw = cvr.gg[cw2];
  const cvAns = fv - fu * gv / gu;
  const ratio = exact(-gv / gu);
  const fVec = vec(cvr.f.x, cvr.f.y, cvr.f.z);
  const gVec = vec(cvr.gg.x, cvr.gg.y, cvr.gg.z);

  // 10. challenge
  const chBase = g.pick([[1, 1, 1], [2, 1, 1], [1, 2, 2]] as Tri[]);
  const chPerm = shuffled(g, [0, 1, 2]);
  const chSign = g.pick([1, -1]);
  const chn: Tri = [chBase[chPerm[0]] * chSign, chBase[chPerm[1]] * chSign, chBase[chPerm[2]] * chSign];
  const chN = norm2(chn);
  const chP0 = retry(() => {
    const P0: Tri = [g.random(-3, 3), g.random(-3, 3), g.random(-3, 3)];
    const d = chn[0] * P0[0] + chn[1] * P0[1] + chn[2] * P0[2];
    return { P0, d };
  }, v => v.d !== 0 && Math.abs(v.d) <= 12);
  const chAns = chP0.d * chP0.d / chN;

  return [
    g.number({
      id: 'grad-dir',
      title: t('Directional derivative of ω', 'ω 的方向导数'),
      prompt: t(`ω = x²y − ${coef(m, 'xy³')}${m === 2 ? ' (for m = 1 this is x²y − xy³)' : ''}. Find the directional derivative dω/ds at the point P = ${vec(p, q)} in the direction of the vector A = ${vec(u, v)}. (A is not a unit vector; |A| = ${nA}.) Enter an integer or a fraction.`,
        `ω = x²y − ${coef(m, 'xy³')}${m === 2 ? '（m = 1 时即 x²y − xy³）' : ''}。求 ω 在点 P = ${vec(p, q)} 处沿向量 A = ${vec(u, v)} 方向的方向导数 dω/ds。（A 不是单位向量，|A| = ${nA}。）输入整数或分数。`),
      fields: [{ label: t('dω/ds', 'dω/ds'), answer: gradAns }],
      hint: t('First find the gradient ∇ω = (ω_x, ω_y) at P. Then dω/ds = ∇ω · (A/|A|): divide A by its length before the dot product.',
        '先求 P 处的梯度 ∇ω = (ω_x, ω_y)。然后 dω/ds = ∇ω · (A/|A|)：点乘之前先把 A 除以它的长度。'),
      explanation: t(`ω_x = 2xy − ${coef(m, 'y³')} and ω_y = x² − ${coef(3 * m, 'xy²')}, so at P: ω_x = ${num(fx)}, ω_y = ${num(fy)} and ∇ω = ${vec(fx, fy)}. The unit vector is A/|A| = ${vec(u, v)}/${nA}. So dω/ds = ∇ω · A/|A| = (${par(fx)}·${par(u)} + ${par(fy)}·${par(v)})/${nA} = ${exact(gradAns)} (P5a: 1/5 for m = 1, P = (2, 1), A = (3, 4)).`,
        `ω_x = 2xy − ${coef(m, 'y³')}，ω_y = x² − ${coef(3 * m, 'xy²')}，所以在 P 处 ω_x = ${num(fx)}，ω_y = ${num(fy)}，∇ω = ${vec(fx, fy)}。单位向量为 A/|A| = ${vec(u, v)}/${nA}。因此 dω/ds = ∇ω · A/|A| = (${par(fx)}·${par(u)} + ${par(fy)}·${par(v)})/${nA} = ${exact(gradAns)}（第 5 题 a：m = 1，P = (2, 1)，A = (3, 4) 时为 1/5）。`),
      audit: { kind: 'MIT-MV-66:grad-dir', params: { m, p, q, u, v } },
    }),
    g.choice({
      id: 'level-dir',
      title: t('A direction with no change', '没有变化的方向'),
      prompt: t(`At the point P the gradient of ω is ∇ω = ${vec(g1, g2)}. In which direction A does ω neither increase nor decrease at P, that is, dω/ds = 0? (A is any non-zero vector pointing that way.)`,
        `在点 P 处 ω 的梯度为 ∇ω = ${vec(g1, g2)}。沿哪个方向 A，ω 在 P 处既不增加也不减少，即 dω/ds = 0？（A 是指向该方向的任一非零向量。）`),
      options: [K, ...distractors].map(d => t(`A = ${vec(d[0], d[1])}`, `A = ${vec(d[0], d[1])}`)),
      correct: 0,
      hint: t('dω/ds = ∇ω · A/|A|. For which vectors A is this dot product zero?', 'dω/ds = ∇ω · A/|A|。哪些向量 A 使这个点积为零？'),
      explanation: t(`dω/ds = ∇ω · A/|A| is zero exactly when ∇ω · A = 0, that is, when A is perpendicular to ∇ω (A points along the level curve of ω through P). For A = ${vec(K[0], K[1])}: (${dotExpr(K)}) = 0. For the other printed options ∇ω · A is not 0: ${distractors.map(d => `A = ${vec(d[0], d[1])}: (${dotExpr(d)}) = ${num(dotVal(d))}`).join('; ')}.`,
        `dω/ds = ∇ω · A/|A| 为 0，当且仅当 ∇ω · A = 0，即 A 与 ∇ω 垂直（A 沿着过 P 的 ω 的等值线方向）。当 A = ${vec(K[0], K[1])} 时：(${dotExpr(K)}) = 0。其他列出的选项的 ∇ω · A 都不为 0：${distractors.map(d => `A = ${vec(d[0], d[1])}：(${dotExpr(d)}) = ${num(dotVal(d))}`).join('；')}。`),
    }),
    g.number({
      id: 'tangent-plane',
      title: t('The tangent plane', '切平面'),
      prompt: t(`Let w = x² + ${coef(a, 'y²')} + ${coef(b, 'z²')}. The level surface of w through the point P = ${vec(x0, y0, z0)} has a tangent plane at P. Write it as ${coef(x0, 'x')} + By + Cz = D, so that the coefficient of x is ${x0}. Enter B, C and D.`,
        `设 w = x² + ${coef(a, 'y²')} + ${coef(b, 'z²')}。w 的过点 P = ${vec(x0, y0, z0)} 的等值面在 P 处有一个切平面。把它写成 ${coef(x0, 'x')} + By + Cz = D，使 x 的系数为 ${x0}。求 B、C 和 D。`),
      fields: [
        { label: t('B', 'B'), answer: B },
        { label: t('C', 'C'), answer: C },
        { label: t('D', 'D'), answer: D },
      ],
      hint: t(`The gradient ∇w at P is normal to the level surface, so it gives the coefficients of the tangent plane. Divide by 2 so that the coefficient of x is ${x0}.`,
        `w 在 P 处的梯度垂直于等值面，所以它给出切平面的系数。除以 2，使 x 的系数为 ${x0}。`),
      explanation: t(`∇w = (2x, ${coef(2 * a, 'y')}, ${coef(2 * b, 'z')}) = (${num(2 * x0)}, ${num(2 * a * y0)}, ${num(2 * b * z0)}) at P. Half of it is (${num(x0)}, ${num(B)}, ${num(C)}), so the plane is ${linear([x0, B, C], ['x', 'y', 'z'])} = D, and substituting P gives D = ${par(x0)}·${par(x0)} + ${par(B)}·${par(y0)} + ${par(C)}·${par(z0)} = ${num(D)}, which is also the value w(P) (P6a: x + 2y + 2z = 5 for the surface x² + 2y² + 2z² = 5 at (1, 1, 1)).`,
        `在 P 处 ∇w = (2x, ${coef(2 * a, 'y')}, ${coef(2 * b, 'z')}) = (${num(2 * x0)}, ${num(2 * a * y0)}, ${num(2 * b * z0)})。取它的一半得 (${num(x0)}, ${num(B)}, ${num(C)})，所以平面为 ${linear([x0, B, C], ['x', 'y', 'z'])} = D，代入 P 得 D = ${par(x0)}·${par(x0)} + ${par(B)}·${par(y0)} + ${par(C)}·${par(z0)} = ${num(D)}，这也等于 w(P) 的值（第 6 题 a：曲面 x² + 2y² + 2z² = 5 在 (1, 1, 1) 处的切平面为 x + 2y + 2z = 5）。`),
      audit: { kind: 'MIT-MV-66:tangent-plane', params: { a, b, x0, y0, z0 } },
    }),
    g.number({
      id: 'dihedral',
      title: t('The angle with the xy-plane', '与 xy 平面的夹角'),
      prompt: t(`The plane ${linear([da, db, dc], ['x', 'y', 'z'])} = ${num(dd)} makes a dihedral angle θ with the xy-plane (take θ acute, between 0° and 90°; it is the angle between the normal vectors of the two planes). Enter cos θ as a fraction.`,
        `平面 ${linear([da, db, dc], ['x', 'y', 'z'])} = ${num(dd)} 与 xy 平面所成的二面角为 θ（取锐角，0° 到 90° 之间；它等于两个平面的法向量之间的夹角）。以分数输入 cos θ。`),
      fields: [{ label: t('cos θ', 'cos θ'), answer: dihedralAns }],
      hint: t('The dihedral angle is the angle between the normal vectors (a, b, c) and (0, 0, 1). The number d plays no role. For an acute angle use the absolute value.',
        '二面角等于法向量 (a, b, c) 与 (0, 0, 1) 之间的夹角。常数 d 不起作用。取锐角时用绝对值。'),
      explanation: t(`The normal vector of the plane is n = ${vec(da, db, dc)} and the normal vector of the xy-plane is k = (0, 0, 1). |n| = √(${da * da} + ${db * db} + ${dc * dc}) = ${dN}. So cos θ = |n · k|/|n| = ${frac(Math.abs(dc), dN)} (P6b: ⟨1, 2, 2⟩ · k/3 = 2/3).`,
        `该平面的法向量为 n = ${vec(da, db, dc)}，xy 平面的法向量为 k = (0, 0, 1)。|n| = √(${da * da} + ${db * db} + ${dc * dc}) = ${dN}。所以 cos θ = |n · k|/|n| = ${frac(Math.abs(dc), dN)}（第 6 题 b：⟨1, 2, 2⟩ · k/3 = 2/3）。`),
      audit: { kind: 'MIT-MV-66:dihedral', params: { a: da, b: db, c: dc, d: dd } },
    }),
    g.symbols({
      id: 'lagrange-setup',
      title: t('The Lagrange equations', '拉格朗日方程'),
      prompt: t(`To find the point of the plane ${linear([la, lb, lc], ['x', 'y', 'z'])} closest to the origin, minimise f = x² + y² + z² subject to g = ${linear([la, lb, lc], ['x', 'y', 'z'])} = ${num(ld)}. Complete the Lagrange equations ∇f = λ∇g: 2x = λ·[ ], 2y = λ·[ ], 2z = λ·[ ].`,
        `要求平面 ${linear([la, lb, lc], ['x', 'y', 'z'])} 上离原点最近的点，在约束 g = ${linear([la, lb, lc], ['x', 'y', 'z'])} = ${num(ld)} 下使 f = x² + y² + z² 最小。补全拉格朗日方程 ∇f = λ∇g：2x = λ·[ ]，2y = λ·[ ]，2z = λ·[ ]。`),
      before: '2x = λ·',
      between: lang === 'zh' ? ['，2y = λ·', '，2z = λ·'] : [', 2y = λ·', ', 2z = λ·'],
      after: lang === 'zh' ? '。' : '.',
      answers: [num(la), num(lb), num(lc)],
      tokens: lsTokens,
      hint: t('∇f = (2x, 2y, 2z) and ∇g is the vector of the coefficients of x, y, z in g. Match the components.',
        '∇f = (2x, 2y, 2z)，∇g 是 g 中 x、y、z 的系数组成的向量。逐个分量对应。'),
      explanation: t(`∇f = (2x, 2y, 2z) and ∇g = ${vec(la, lb, lc)} (the coefficients of x, y, z in g), so ∇f = λ∇g reads 2x = λ·${num(la)}, 2y = λ·${num(lb)}, 2z = λ·${num(lc)}. The number ${num(ld)} is the value of g on the plane, it is used afterwards in the constraint (P7: 2x = 2λ, 2y = λ, 2z = −λ for 2x + y − z = 6).`,
        `∇f = (2x, 2y, 2z)，∇g = ${vec(la, lb, lc)}（g 中 x、y、z 的系数），所以 ∇f = λ∇g 就是 2x = λ·${num(la)}，2y = λ·${num(lb)}，2z = λ·${num(lc)}。数 ${num(ld)} 是 g 在平面上的取值，之后用于约束方程（第 7 题：对 2x + y − z = 6 得 2x = 2λ，2y = λ，2z = −λ）。`),
    }),
    g.number({
      id: 'lagrange-point',
      title: t('The closest point', '最近的点'),
      prompt: t(`Find the point (x, y, z) of the plane ${linear([lpa, lpb, lpc], ['x', 'y', 'z'])} = ${num(lpD)} that is closest to the origin. Use Lagrange multipliers: minimise x² + y² + z² subject to the equation of the plane. Enter each coordinate as an integer or a fraction.`,
        `求平面 ${linear([lpa, lpb, lpc], ['x', 'y', 'z'])} = ${num(lpD)} 上离原点最近的点 (x, y, z)。用拉格朗日乘数法：在平面方程的约束下使 x² + y² + z² 最小。每个坐标输入整数或分数。`),
      fields: [
        { label: t('x', 'x'), answer: lpX },
        { label: t('y', 'y'), answer: lpY },
        { label: t('z', 'z'), answer: lpZ },
      ],
      hint: t('The equations 2x = λa, 2y = λb, 2z = λc give x, y, z in terms of λ. Substitute them into the equation of the plane to find λ.',
        '方程 2x = λa，2y = λb，2z = λc 把 x、y、z 用 λ 表示。把它们代入平面方程求出 λ。'),
      explanation: t(`From 2x = λ·${num(lpa)}, 2y = λ·${num(lpb)}, 2z = λ·${num(lpc)} we get (x, y, z) = (λ/2)·${vec(lpa, lpb, lpc)}. Substituting into the plane: (λ/2)·(${lpa * lpa} + ${lpb * lpb} + ${lpc * lpc}) = ${num(lpD)}, that is (λ/2)·${lpN} = ${num(lpD)}, so λ/2 = ${frac(lpD, lpN)}. Hence (x, y, z) = (${exact(lpX)}, ${exact(lpY)}, ${exact(lpZ)}) (P7: for 2x + y − z = 6 this gives λ = 2 and the point (2, 1, −1)).`,
        `由 2x = λ·${num(lpa)}，2y = λ·${num(lpb)}，2z = λ·${num(lpc)} 得 (x, y, z) = (λ/2)·${vec(lpa, lpb, lpc)}。代入平面方程：(λ/2)·(${lpa * lpa} + ${lpb * lpb} + ${lpc * lpc}) = ${num(lpD)}，即 (λ/2)·${lpN} = ${num(lpD)}，所以 λ/2 = ${frac(lpD, lpN)}。于是 (x, y, z) = (${exact(lpX)}, ${exact(lpY)}, ${exact(lpZ)})（第 7 题：对 2x + y − z = 6 得 λ = 2，点为 (2, 1, −1)）。`),
      audit: { kind: 'MIT-MV-66:lagrange-point', params: { a: lpa, b: lpb, c: lpc, d: lpD } },
    }),
    g.choice({
      id: 'lagrange-check',
      title: t('Which point is closest?', '哪个点最近？'),
      prompt: t(`The four points below all lie on the plane ${linear([lca, lcb, lcc], ['x', 'y', 'z'])} = ${num(lcD)}. Which of them is the point of the plane closest to the origin?`,
        `下面四个点都在平面 ${linear([lca, lcb, lcc], ['x', 'y', 'z'])} = ${num(lcD)} 上。其中哪一个是该平面上离原点最近的点？`),
      options: lcPts.map(d => t(`(${num(d[0])}, ${num(d[1])}, ${num(d[2])})`, `(${num(d[0])}, ${num(d[1])}, ${num(d[2])})`)),
      correct: 0,
      hint: t('Compute x² + y² + z² for each point. Or use the Lagrange equations: at the closest point (x, y, z) is a multiple of the normal vector.',
        '对每个点算 x² + y² + z²。或者用拉格朗日方程：在最近点处 (x, y, z) 是法向量的倍数。'),
      explanation: t(`The squared distances from the origin are ${lcNorms.map(num).join(', ')}. The smallest, ${num(lcMin)}, belongs to (${num(Kpt[0])}, ${num(Kpt[1])}, ${num(Kpt[2])}). This is the point with (x, y, z) = ${num(lcM)}·${vec(lca, lcb, lcc)}: the Lagrange equations 2x = λ·${num(lca)}, 2y = λ·${num(lcb)}, 2z = λ·${num(lcc)} say that the closest point is a multiple of the normal vector, and none of the other printed points is a multiple of ${vec(lca, lcb, lcc)}.`,
        `各点到原点的距离平方为 ${lcNorms.map(num).join('，')}。最小的 ${num(lcMin)} 属于 (${num(Kpt[0])}, ${num(Kpt[1])}, ${num(Kpt[2])})。它满足 (x, y, z) = ${num(lcM)}·${vec(lca, lcb, lcc)}：拉格朗日方程 2x = λ·${num(lca)}，2y = λ·${num(lcb)}，2z = λ·${num(lcc)} 说明最近点是法向量的倍数，而其余列出的点都不是 ${vec(lca, lcb, lcc)} 的倍数。`),
    }),
    g.symbols({
      id: 'constraint-setup',
      title: t('Differentiating the constraint', '对约束方程求导'),
      prompt: t(`x, y and z satisfy g(x, y, z) = ${num(c0)}, so two of them are independent. Take ${cv} and ${cw} as the independent variables; ${cu} depends on them. Differentiate g(x, y, z) = ${num(c0)} with respect to ${cv}, holding ${cw} fixed, and complete: g_${cv}·[ ] + g_${cw}·[ ] + g_${cu}·(∂${cu}/∂${cv})_${cw} = 0, so (∂${cu}/∂${cv})_${cw} = [ ] / [ ].`,
        `x、y、z 满足 g(x, y, z) = ${num(c0)}，所以其中两个是独立变量。取 ${cv} 和 ${cw} 为独立变量，${cu} 依赖于它们。把 g(x, y, z) = ${num(c0)} 对 ${cv} 求导，同时保持 ${cw} 不变，补全：g_${cv}·[ ] + g_${cw}·[ ] + g_${cu}·(∂${cu}/∂${cv})_${cw} = 0，所以 (∂${cu}/∂${cv})_${cw} = [ ] / [ ]。`),
      before: `g_${cv}·`,
      between: lang === 'zh'
        ? [` + g_${cw}·`, ` + g_${cu}·(∂${cu}/∂${cv})_${cw} = 0，所以 (∂${cu}/∂${cv})_${cw} = `, ' / ']
        : [` + g_${cw}·`, ` + g_${cu}·(∂${cu}/∂${cv})_${cw} = 0, so (∂${cu}/∂${cv})_${cw} = `, ' / '],
      after: lang === 'zh' ? '。' : '.',
      answers: ['1', '0', `−g_${cv}`, `g_${cu}`],
      tokens: shuffled(g, ['1', '0', 'g_x', 'g_y', 'g_z', '−g_x', '−g_y', '−g_z']),
      hint: t(`${cv} changes at rate 1 and ${cw} does not change, so (∂${cv}/∂${cv})_${cw} = 1 and (∂${cw}/∂${cv})_${cw} = 0. Then solve the equation for (∂${cu}/∂${cv})_${cw}.`,
        `${cv} 的变化率为 1，${cw} 不变，所以 (∂${cv}/∂${cv})_${cw} = 1，(∂${cw}/∂${cv})_${cw} = 0。然后从该方程解出 (∂${cu}/∂${cv})_${cw}。`),
      explanation: t(`By the chain rule, 0 = g_${cv}·(∂${cv}/∂${cv})_${cw} + g_${cw}·(∂${cw}/∂${cv})_${cw} + g_${cu}·(∂${cu}/∂${cv})_${cw} = g_${cv}·1 + g_${cw}·0 + g_${cu}·(∂${cu}/∂${cv})_${cw}. Solving: (∂${cu}/∂${cv})_${cw} = −g_${cv}/g_${cu} (P8: g_x + g_z ∂z/∂x = 0, so (∂z/∂x)_y = −g_x/g_z).`,
        `由链式法则，0 = g_${cv}·(∂${cv}/∂${cv})_${cw} + g_${cw}·(∂${cw}/∂${cv})_${cw} + g_${cu}·(∂${cu}/∂${cv})_${cw} = g_${cv}·1 + g_${cw}·0 + g_${cu}·(∂${cu}/∂${cv})_${cw}。解得 (∂${cu}/∂${cv})_${cw} = −g_${cv}/g_${cu}（第 8 题：g_x + g_z ∂z/∂x = 0，所以 (∂z/∂x)_y = −g_x/g_z）。`),
    }),
    g.number({
      id: 'constraint-value',
      title: t('A constrained derivative', '受约束的导数'),
      prompt: t(`x, y and z satisfy g(x, y, z) = ${num(c0v)}, and ω = f(x, y, z). At the point P, ∇f = ${fVec} and ∇g = ${gVec}. Take ${cv2} and ${cw2} as the independent variables, so ${cu2} depends on them. Find (∂ω/∂${cv2})_${cw2} at P. Enter an integer or a fraction.`,
        `x、y、z 满足 g(x, y, z) = ${num(c0v)}，且 ω = f(x, y, z)。在点 P 处 ∇f = ${fVec}，∇g = ${gVec}。取 ${cv2} 和 ${cw2} 为独立变量，${cu2} 依赖于它们。求 P 处的 (∂ω/∂${cv2})_${cw2}。输入整数或分数。`),
      fields: [{ label: t('value', '值'), answer: cvAns }],
      hint: t(`First find (∂${cu2}/∂${cv2})_${cw2} from g_${cv2} + g_${cu2}(∂${cu2}/∂${cv2})_${cw2} = 0. Then (∂ω/∂${cv2})_${cw2} = f_${cv2}·1 + f_${cw2}·0 + f_${cu2}·(∂${cu2}/∂${cv2})_${cw2}.`,
        `先由 g_${cv2} + g_${cu2}(∂${cu2}/∂${cv2})_${cw2} = 0 求出 (∂${cu2}/∂${cv2})_${cw2}。然后 (∂ω/∂${cv2})_${cw2} = f_${cv2}·1 + f_${cw2}·0 + f_${cu2}·(∂${cu2}/∂${cv2})_${cw2}。`),
      explanation: t(`(∂${cu2}/∂${cv2})_${cw2} = −g_${cv2}/g_${cu2} = −(${par(gv)})/(${par(gu)}) = ${ratio}. Then (∂ω/∂${cv2})_${cw2} = f_${cv2}·1 + f_${cw2}·0 + f_${cu2}·(∂${cu2}/∂${cv2})_${cw2} = ${num(fv)} + ${par(fu)}·(${ratio}) = ${exact(cvAns)} (P8b: 1·1 + 1·0 + 2·2 = 5).`,
        `(∂${cu2}/∂${cv2})_${cw2} = −g_${cv2}/g_${cu2} = −(${par(gv)})/(${par(gu)}) = ${ratio}。于是 (∂ω/∂${cv2})_${cw2} = f_${cv2}·1 + f_${cw2}·0 + f_${cu2}·(∂${cu2}/∂${cv2})_${cw2} = ${num(fv)} + ${par(fu)}·(${ratio}) = ${exact(cvAns)}（第 8 题 b：1·1 + 1·0 + 2·2 = 5）。`),
      audit: { kind: 'MIT-MV-66:constraint-value', params: { fu, fv, fw, gu, gv, gw } },
    }),
    g.number({
      id: 'challenge',
      title: t('The least squared distance', '最小的距离平方'),
      prompt: t(`A plane passes through the point P₀ = ${vec(chP0.P0[0], chP0.P0[1], chP0.P0[2])} and has the normal vector ${vec(chn[0], chn[1], chn[2])}. What is the smallest value of x² + y² + z² over the points (x, y, z) of this plane? Enter an integer or a fraction.`,
        `一个平面经过点 P₀ = ${vec(chP0.P0[0], chP0.P0[1], chP0.P0[2])}，法向量为 ${vec(chn[0], chn[1], chn[2])}。在这个平面的所有点 (x, y, z) 上，x² + y² + z² 的最小值是多少？输入整数或分数。`),
      fields: [{ label: t('value', '值'), answer: chAns }],
      hint: t('Write the plane as ax + by + cz = d first; then minimise x² + y² + z² on it, for example with Lagrange multipliers.',
        '先把平面写成 ax + by + cz = d；然后在它上面使 x² + y² + z² 最小，例如用拉格朗日乘数法。'),
      explanation: t(`The plane is ${linear(chn, ['x', 'y', 'z'])} = ${num(chP0.d)}, where d = n · P₀ = ${par(chn[0])}·${par(chP0.P0[0])} + ${par(chn[1])}·${par(chP0.P0[1])} + ${par(chn[2])}·${par(chP0.P0[2])} = ${num(chP0.d)}. By the Lagrange equations 2x = λa, 2y = λb, 2z = λc the closest point is (${frac(chP0.d, chN)})·${vec(chn[0], chn[1], chn[2])} = (${exact(chP0.d * chn[0] / chN)}, ${exact(chP0.d * chn[1] / chN)}, ${exact(chP0.d * chn[2] / chN)}), and its squared distance is d²/${chN} = ${exact(chAns)}. ${NOT_ASSESSED_EN}`,
        `平面为 ${linear(chn, ['x', 'y', 'z'])} = ${num(chP0.d)}，其中 d = n · P₀ = ${par(chn[0])}·${par(chP0.P0[0])} + ${par(chn[1])}·${par(chP0.P0[1])} + ${par(chn[2])}·${par(chP0.P0[2])} = ${num(chP0.d)}。由拉格朗日方程 2x = λa，2y = λb，2z = λc，最近点是 (${frac(chP0.d, chN)})·${vec(chn[0], chn[1], chn[2])} = (${exact(chP0.d * chn[0] / chN)}, ${exact(chP0.d * chn[1] / chN)}, ${exact(chP0.d * chn[2] / chN)})，它到原点的距离平方为 d²/${chN} = ${exact(chAns)}。${NOT_ASSESSED_ZH}`),
      audit: { kind: 'MIT-MV-66:challenge', params: { n: chn, p0: chP0.P0 } },
    }),
  ];
};
