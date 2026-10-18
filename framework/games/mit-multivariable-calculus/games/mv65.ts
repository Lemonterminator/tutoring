import type { CardGenerator } from '../../types';
import { axes3d, ellipse, fitView, line3d, project3d, type FigureShape, type Pt, type Pt3 } from '../../figure';
import { coef, frac, linear, makeMvDeck, num, par, vec, type Text } from '../support';

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
/** coeff * √rad / 2 as an exact string; a coefficient 1 is omitted (√3, not 1√3). */
const sqrtHalf = (coeff: number, rad: 2 | 3): string => {
  const s = rad === 2 ? '√2' : '√3';
  if (coeff % 2 === 0) { const c = coeff / 2; return c === 1 ? s : `${c}${s}`; }
  return `${coeff}${s}/2`;
};

export const mv65: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-65');
  warm(g);

  // 1. normal
  const normal = retry(() => {
    const P: [number, number, number] = [g.random(-3, 3), g.random(-3, 3), g.random(-3, 3)];
    const Q: [number, number, number] = [g.random(-3, 3), g.random(-3, 3), g.random(-3, 3)];
    const R: [number, number, number] = [g.random(-3, 3), g.random(-3, 3), g.random(-3, 3)];
    const u: [number, number, number] = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]];
    const w: [number, number, number] = [R[0] - P[0], R[1] - P[1], R[2] - P[2]];
    const N: [number, number, number] = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const zeros = N.filter(v => v === 0).length;
    const maxAbs = Math.max(Math.abs(N[0]), Math.abs(N[1]), Math.abs(N[2]));
    const pP = project3d(P), pQ = project3d(Q), pR = project3d(R);
    const d1 = Math.hypot(pP[0] - pQ[0], pP[1] - pQ[1]);
    const d2 = Math.hypot(pP[0] - pR[0], pP[1] - pR[1]);
    const d3 = Math.hypot(pQ[0] - pR[0], pQ[1] - pR[1]);
    return { P, Q, R, u, w, N, zeros, maxAbs, d1, d2, d3 };
  }, v => (v.N[0] !== 0 || v.N[1] !== 0 || v.N[2] !== 0) && v.maxAbs <= 12 && v.zeros <= 1 && v.d1 >= 0.6 && v.d2 >= 0.6 && v.d3 >= 0.6);

  // 2. plane-d
  const planeD = retry(() => {
    const a = g.pick([1, 2, 3, 4]) * g.pick([1, -1]);
    const b = g.pick([1, 2, 3, 4]) * g.pick([1, -1]);
    const c = g.pick([1, 2, 3, 4]) * g.pick([1, -1]);
    const x0 = g.random(-4, 4), y0 = g.random(-4, 4), z0 = g.random(-4, 4);
    return { a, b, c, x0, y0, z0, d: a * x0 + b * y0 + c * z0 };
  }, v => v.d !== 0);

  // 3. singular
  const cSingular = g.random(0, 2) === 0 ? g.pick([1, -1]) : g.pick([-4, -3, -2, 2, 3, 4]);
  const detSingular = 1 - cSingular * cSingular;

  // 4. inv-entry
  const cInv = g.pick([-4, -3, -2, 2, 3, 4]);
  const DInv = 1 - cInv * cInv;
  const invPos = g.random(0, 4) < 2 ? [3, 2] : g.pick([[2, 1], [3, 3], [2, 3]]);
  const iInv = invPos[0], jInv = invPos[1];
  let cofactor: number, cofEn: string, cofZh: string;
  if (iInv === 3 && jInv === 2) {
    cofactor = 1;
    cofEn = '−(the determinant with rows (1, 0) and (1, −1)) = −(−1) = 1';
    cofZh = '−（行为 (1, 0) 和 (1, −1) 的行列式）= −(−1) = 1';
  } else if (iInv === 2 && jInv === 1) {
    cofactor = -3;
    cofEn = '−(the determinant with rows (2, 1) and (1, 2)) = −3';
    cofZh = '−（行为 (2, 1) 和 (1, 2) 的行列式）= −3';
  } else if (iInv === 3 && jInv === 3) {
    cofactor = cInv;
    cofEn = `the determinant with rows (1, 0) and (2, ${num(cInv)}) = ${num(cInv)}`;
    cofZh = `行为 (1, 0) 和 (2, ${num(cInv)}) 的行列式 = ${num(cInv)}`;
  } else {
    cofactor = 2 * cInv - 1;
    cofEn = `−(the determinant with rows (1, ${num(cInv)}) and (2, 1)) = −(1 − ${par(2 * cInv)}) = ${num(cofactor)}`;
    cofZh = `−（行为 (1, ${num(cInv)}) 和 (2, 1) 的行列式）= −(1 − ${par(2 * cInv)}) = ${num(cofactor)}`;
  }
  const ansInv = cofactor / DInv;

  // 5. tape-vector
  const aTape = g.pick([2, 3, 4, 5, 6]);
  const thTape = g.pick([1, 2, 3, 4]);
  const alphaTape = g.pick([30, 45, 60]);
  const aTh = aTape * thTape;
  const xTape = aTh * Math.cos(alphaTape * Math.PI / 180);
  const yTape = aTh * Math.sin(alphaTape * Math.PI / 180);
  let xTapeStr: string, yTapeStr: string;
  if (alphaTape === 30) { xTapeStr = sqrtHalf(aTh, 3); yTapeStr = frac(aTh, 2); }
  else if (alphaTape === 45) { xTapeStr = sqrtHalf(aTh, 2); yTapeStr = sqrtHalf(aTh, 2); }
  else { xTapeStr = frac(aTh, 2); yTapeStr = sqrtHalf(aTh, 3); }
  const dirStr = alphaTape === 30 ? '(√3/2, 1/2)' : alphaTape === 45 ? '(√2/2, √2/2)' : '(1/2, √3/2)';

  // 6. tape-curve
  const aCurve = g.pick([2, 4, 6]);
  const alphaCurve = g.pick([30, 45, 60]);
  const hCurve = aCurve / 2;
  const hLead = hCurve === 1 ? '' : String(hCurve);
  let t1Curve: string, t2Curve: string, t4Curve: string, t5Curve: string, t6Curve: string;
  if (alphaCurve === 30) {
    t1Curve = `${hLead}√3 θ`; t2Curve = `${hLead}θ`;
    t4Curve = '√3 θ/2'; t5Curve = `${hLead}√3`; t6Curve = String(hCurve);
  } else if (alphaCurve === 45) {
    t1Curve = `${hLead}√2 θ`; t2Curve = `${hLead}√2 θ`;
    t4Curve = '√2 θ/2'; t5Curve = `${hLead}√2`; t6Curve = `${hLead}√2`;
  } else {
    t1Curve = `${hLead}θ`; t2Curve = `${hLead}√3 θ`;
    t4Curve = 'θ/2'; t5Curve = String(hCurve); t6Curve = `${hLead}√3`;
  }
  const t3Curve = `${aCurve}θ`;
  const curveTokens = shuffled(g, Array.from(new Set([t1Curve, t2Curve, t3Curve, t4Curve, t5Curve, t6Curve])));

  // 7. speed
  const constantPairList: [number, number, number][] = [[3, 5, 4], [4, 5, 3], [6, 10, 8], [8, 10, 6], [5, 13, 12], [12, 13, 5], [8, 17, 15], [15, 17, 8]];
  const speedTriple: [number, number, number] = g.random(0, 1) < 0.5
    ? g.pick(constantPairList)
    : retry(() => {
        const a = g.random(2, 8), c = g.random(2, 8), b = g.random(2, 9);
        return [a, b, c] as [number, number, number];
      }, v => v[0] * v[0] + v[2] * v[2] !== v[1] * v[1] && v[1] * v[1] !== v[0] + v[1] + v[2]);
  const [aSpeed, bSpeed, cSpeed] = speedTriple;
  const A2 = aSpeed * aSpeed + cSpeed * cSpeed;
  const B2 = bSpeed * bSpeed;
  const isConst = A2 === B2;

  // 8. yz-point
  const aYz = g.random(1, 5);
  const bYz = g.pick([1, 2, 3, 4, 5]) * g.pick([1, -1]);
  const cYz = g.pick([1, 2, 3, 4, 5]) * g.pick([1, -1]);
  const dYz = g.pick([1, 2, 3, 4, 5]) * g.pick([1, -1]);

  // 9. challenge
  const pyth: [number, number][] = [[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5], [8, 15], [15, 8], [9, 12], [12, 9]];
  const chPair = g.pick(pyth);
  const aCh = chPair[0], cCh = chPair[1];
  const bCh = retry(() => g.random(2, 9), v => v * v !== aCh * aCh + cCh * cCh);
  const speedCh = Math.sqrt(aCh * aCh + cCh * cCh);

  // figures
  const L = Math.max(3, ...normal.P, ...normal.Q, ...normal.R) + 1;
  const normalShapes: FigureShape[] = [
    ...axes3d(L),
    line3d([normal.P, normal.Q, normal.R, normal.P], 'accent', { width: 2 }),
    { kind: 'point', at: project3d(normal.P), tone: 'accent2', label: 'P' },
    { kind: 'point', at: project3d(normal.Q), tone: 'accent2', label: 'Q' },
    { kind: 'point', at: project3d(normal.R), tone: 'accent2', label: 'R' },
  ];

  const th0 = 1;
  const Qx = aCurve * Math.cos(th0), Qy = aCurve * Math.sin(th0);
  const alphaRad = alphaCurve * Math.PI / 180;
  const PpX = Qx + aCurve * th0 * Math.cos(alphaRad);
  const PpY = Qy + aCurve * th0 * Math.sin(alphaRad);
  const curveShapes: FigureShape[] = [
    { kind: 'line', points: ellipse(0, 0, aCurve, aCurve), tone: 'axis' },
    { kind: 'point', at: [0, 0], tone: 'axis', label: 'O' },
    { kind: 'point', at: [aCurve, 0], tone: 'axis', label: 'A' },
    { kind: 'point', at: [Qx, Qy], tone: 'accent', label: 'Q' },
    { kind: 'line', points: [[0, 0], [Qx, Qy]], tone: 'muted', dash: true },
    { kind: 'arrow', from: [Qx, Qy], to: [PpX, PpY], tone: 'accent2' },
    { kind: 'point', at: [PpX, PpY], tone: 'accent2', label: 'P' },
    { kind: 'line', points: [[Qx, Qy], [Qx + 0.7 * aCurve, Qy]], tone: 'muted', dash: true },
    { kind: 'text', at: [0.3 * aCurve * Math.cos(0.5), 0.3 * aCurve * Math.sin(0.5)], text: 'θ' },
    { kind: 'text', at: [Qx + 0.5 * aCurve * Math.cos(alphaRad / 2), Qy + 0.5 * aCurve * Math.sin(alphaRad / 2)], text: `${alphaCurve}°` },
  ];

  return [
    g.number({
      id: 'normal',
      title: t('The normal from three points', '由三点求法向量'),
      prompt: t(`The points are P = ${vec(...normal.P)}, Q = ${vec(...normal.Q)} and R = ${vec(...normal.R)}. Compute the cross product PQ × PR of the vector from P to Q with the vector from P to R. Enter its three components (a, b, c).`,
        `三点为 P = ${vec(...normal.P)}，Q = ${vec(...normal.Q)}，R = ${vec(...normal.R)}。计算由 P 指向 Q 的向量与由 P 指向 R 的向量的叉积 PQ × PR，输入它的三个分量 (a, b, c)。`),
      figure: g.figure({
        alt: t(`The triangle with vertices P = ${vec(...normal.P)}, Q = ${vec(...normal.Q)}, R = ${vec(...normal.R)} drawn in three-dimensional axes.`,
          `三维坐标轴中以 P = ${vec(...normal.P)}、Q = ${vec(...normal.Q)}、R = ${vec(...normal.R)} 为顶点的三角形。`),
        view: fitView(normalShapes, 0.15),
        shapes: normalShapes,
      }),
      fields: [
        { label: t('a', 'a'), answer: normal.N[0] },
        { label: t('b', 'b'), answer: normal.N[1] },
        { label: t('c', 'c'), answer: normal.N[2] },
      ],
      hint: t('Form u = Q − P and w = R − P first. Then (a, b, c) = (u₂w₃ − u₃w₂, u₃w₁ − u₁w₃, u₁w₂ − u₂w₁); the same numbers come from the determinant with the rows (i, j, k), u, w.',
        '先求 u = Q − P 与 w = R − P。然后 (a, b, c) = (u₂w₃ − u₃w₂, u₃w₁ − u₁w₃, u₁w₂ − u₂w₁)；这些数也是行为 (i, j, k)、u、w 的行列式的展开结果。'),
      explanation: t(`PQ = ${vec(...normal.u)}, PR = ${vec(...normal.w)}. PQ × PR = (${par(normal.u[1])}·${par(normal.w[2])} − ${par(normal.u[2])}·${par(normal.w[1])}, ${par(normal.u[2])}·${par(normal.w[0])} − ${par(normal.u[0])}·${par(normal.w[2])}, ${par(normal.u[0])}·${par(normal.w[1])} − ${par(normal.u[1])}·${par(normal.w[0])}) = ${vec(...normal.N)}. This vector is perpendicular to both PQ and PR, so it is a normal vector of the plane through P, Q, R (P1, practice p.1).`,
        `PQ = ${vec(...normal.u)}，PR = ${vec(...normal.w)}。PQ × PR = (${par(normal.u[1])}·${par(normal.w[2])} − ${par(normal.u[2])}·${par(normal.w[1])}, ${par(normal.u[2])}·${par(normal.w[0])} − ${par(normal.u[0])}·${par(normal.w[2])}, ${par(normal.u[0])}·${par(normal.w[1])} − ${par(normal.u[1])}·${par(normal.w[0])}) = ${vec(...normal.N)}。这个向量同时垂直于 PQ 和 PR，所以它是过 P、Q、R 的平面的法向量（第 1 题，练习卷第 1 页）。`),
      audit: { kind: 'MIT-MV-65:normal', params: { p: normal.P, q: normal.Q, r: normal.R } },
    }),
    g.number({
      id: 'plane-d',
      title: t('The constant of the plane', '平面方程的常数项'),
      prompt: t(`The plane ax + by + cz = d has the normal vector (a, b, c) = ${vec(planeD.a, planeD.b, planeD.c)} and passes through the point P = ${vec(planeD.x0, planeD.y0, planeD.z0)}. Enter d.`,
        `平面 ax + by + cz = d 的法向量为 (a, b, c) = ${vec(planeD.a, planeD.b, planeD.c)}，并且经过点 P = ${vec(planeD.x0, planeD.y0, planeD.z0)}。求 d。`),
      fields: [{ label: t('d', 'd'), answer: planeD.d }],
      hint: t('P lies on the plane, so its coordinates satisfy the equation ax + by + cz = d.',
        'P 在平面上，所以它的坐标满足方程 ax + by + cz = d。'),
      explanation: t(`Substitute P into ax + by + cz: d = ${par(planeD.a)}·${par(planeD.x0)} + ${par(planeD.b)}·${par(planeD.y0)} + ${par(planeD.c)}·${par(planeD.z0)} = ${num(planeD.d)}. The plane is ${linear([planeD.a, planeD.b, planeD.c], ['x', 'y', 'z'])} = ${num(planeD.d)} (P1: 'substitute any of the pts').`,
        `把 P 代入 ax + by + cz：d = ${par(planeD.a)}·${par(planeD.x0)} + ${par(planeD.b)}·${par(planeD.y0)} + ${par(planeD.c)}·${par(planeD.z0)} = ${num(planeD.d)}。平面为 ${linear([planeD.a, planeD.b, planeD.c], ['x', 'y', 'z'])} = ${num(planeD.d)}（第 1 题：把任一点代入）。`),
      audit: { kind: 'MIT-MV-65:plane-d', params: { n: [planeD.a, planeD.b, planeD.c], p: [planeD.x0, planeD.y0, planeD.z0] } },
    }),
    g.choice({
      id: 'singular',
      title: t('Solutions of Ax = 0', 'Ax = 0 的解'),
      prompt: t(`A is the matrix with rows (1, 0, ${num(cSingular)}), (2, ${num(cSingular)}, 1), (1, −1, 2). Which statement about the solutions x = (x, y, z) of A x = 0 is correct?`,
        `A 是各行为 (1, 0, ${num(cSingular)})、(2, ${num(cSingular)}, 1)、(1, −1, 2) 的矩阵。关于方程 A x = 0 的解 x = (x, y, z)，下列哪条说法正确？`),
      options: [
        t('Only x = (0, 0, 0) is a solution.', '只有 x = (0, 0, 0) 是解。'),
        t('There are infinitely many solutions: a whole line of them.', '有无穷多个解：它们构成一条直线。'),
        t('There is exactly one non-zero solution.', '恰好有一个非零解。'),
        t('There is no solution at all.', '根本没有解。'),
      ],
      correct: detSingular === 0 ? 1 : 0,
      hint: t('x = 0 always solves A x = 0. The question is whether A also has a non-zero solution, so compute det A.',
        'x = 0 总是 A x = 0 的解。问题是 A 有没有非零解，所以先算 det A。'),
      explanation: detSingular !== 0
        ? t(`Expanding along the first row, det A = 1·(2c + 1) + c·(−2 − c) = 1 − c² (the terms 2c cancel). For c = ${num(cSingular)}: det A = ${num(detSingular)}. ${num(detSingular)} is not 0, so A is invertible and x = A⁻¹·0 = 0 is the only solution (P2: a non-zero solution exists exactly when c = ±1). Exactly one non-zero solution is impossible, because every multiple of a solution is a solution, and no solution at all is impossible, because x = (0, 0, 0) always works.`,
          `按第一行展开，det A = 1·(2c + 1) + c·(−2 − c) = 1 − c²（含 2c 的项相互抵消）。当 c = ${num(cSingular)} 时 det A = ${num(detSingular)}。${num(detSingular)} 不为 0，所以 A 可逆，x = A⁻¹·0 = 0 是唯一的解（第 2 题：只有 c = ±1 时才有非零解）。「恰好有一个非零解」不可能，因为解的任何倍数仍是解；「根本没有解」也不可能，因为 x = (0, 0, 0) 总是解。`)
        : t(`Expanding along the first row, det A = 1·(2c + 1) + c·(−2 − c) = 1 − c² (the terms 2c cancel). For c = ${num(cSingular)}: det A = 0, so A is not invertible and there are non-zero solutions, for example x = ${cSingular === 1 ? '(1, −1, −1)' : '(1, 3, 1)'}; all its multiples are solutions too, so the solutions form a line (P2: c = ±1). Exactly one non-zero solution is impossible, and no solution at all is impossible because x = (0, 0, 0) always works.`,
          `按第一行展开，det A = 1·(2c + 1) + c·(−2 − c) = 1 − c²（含 2c 的项相互抵消）。当 c = ${num(cSingular)} 时 det A = 0，所以 A 不可逆，存在非零解，例如 x = ${cSingular === 1 ? '(1, −1, −1)' : '(1, 3, 1)'}；它的所有倍数也是解，所以解构成一条直线（第 2 题：c = ±1）。「恰好有一个非零解」不可能；「根本没有解」也不可能，因为 x = (0, 0, 0) 总是解。`),
    }),
    g.number({
      id: 'inv-entry',
      title: t('An entry of the inverse', '逆矩阵的一个元素'),
      prompt: t(`A is the matrix with rows (1, 0, ${num(cInv)}), (2, ${num(cInv)}, 1), (1, −1, 2), and det A = ${num(DInv)}. What is the entry of A⁻¹ in row ${iInv}, column ${jInv}? Enter a fraction.`,
        `A 是各行为 (1, 0, ${num(cInv)})、(2, ${num(cInv)}, 1)、(1, −1, 2) 的矩阵，且 det A = ${num(DInv)}。A⁻¹ 的第 ${iInv} 行第 ${jInv} 列的元素是多少？以分数输入。`),
      fields: [{ label: t('entry', '元素'), answer: ansInv }],
      hint: t('Entry (i, j) of A⁻¹ is the cofactor of the entry in row j, column i of A, divided by det A. Note that i and j are swapped.',
        'A⁻¹ 的第 i 行第 j 列元素等于 A 的第 j 行第 i 列元素的代数余子式除以 det A。注意 i 与 j 要对调。'),
      explanation: t(`Entry (${iInv}, ${jInv}) of A⁻¹ needs the cofactor of the entry in row ${jInv}, column ${iInv} of A: ${cofEn}. So the entry is ${num(cofactor)}/(${num(DInv)}) = ${frac(cofactor, DInv)}. (P2b: for c = 2 the same method gives −1/3.)`,
        `A⁻¹ 的 (${iInv}, ${jInv}) 元素需要 A 的第 ${jInv} 行第 ${iInv} 列元素的代数余子式：${cofZh}。所以该元素为 ${num(cofactor)}/(${num(DInv)}) = ${frac(cofactor, DInv)}。（第 2 题 b：c = 2 时同样的方法给出 −1/3。）`),
      audit: { kind: 'MIT-MV-65:inv-entry', params: { c: cInv, i: iInv, j: jInv } },
    }),
    g.number({
      id: 'tape-vector',
      title: t('The free part of the tape', '胶带的自由段'),
      prompt: t(`A roll of tape has radius a = ${aTape} and does not turn; its centre is the origin O. Q = a(cos θ, sin θ) is the point where the free part of the tape leaves the roll, with θ = ${thTape} radians. The free part QP has length aθ and points up and to the right, making an angle of ${alphaTape}° with the horizontal. Find the vector QP = (x, y). Enter exact values such as 3sqrt(2) or 15/2.`,
        `胶带卷的半径为 a = ${aTape}，固定不动，圆心为原点 O。Q = a(cos θ, sin θ) 是胶带离开胶带卷的点，θ = ${thTape} 弧度。自由段 QP 的长度为 aθ，向右上方延伸，与水平方向成 ${alphaTape}° 角。求向量 QP = (x, y)。输入精确值，例如 3sqrt(2) 或 15/2。`),
      fields: [
        { label: t('x', 'x'), answer: xTape },
        { label: t('y', 'y'), answer: yTape },
      ],
      hint: t('The length of QP is aθ and its direction is the unit vector (cos α, sin α), because it makes the angle α with the horizontal and points up and to the right.',
        'QP 的长度为 aθ，方向是单位向量 (cos α, sin α)，因为它与水平方向成角 α 并指向右上方。'),
      explanation: t(`|QP| = aθ = ${aTape}·${thTape} = ${aTh}, and the direction is (cos ${alphaTape}°, sin ${alphaTape}°) = ${dirStr}. So QP = ${aTh}·${dirStr} = (${xTapeStr}, ${yTapeStr}), and P = Q + QP (P3 uses α = 45°, where QP = aθ(√2/2, √2/2)).`,
        `|QP| = aθ = ${aTape}·${thTape} = ${aTh}，方向为 (cos ${alphaTape}°, sin ${alphaTape}°) = ${dirStr}。所以 QP = ${aTh}·${dirStr} = (${xTapeStr}, ${yTapeStr})，P = Q + QP（第 3 题取 α = 45°，此时 QP = aθ(√2/2, √2/2)）。`),
      audit: { kind: 'MIT-MV-65:tape-vector', params: { a: aTape, th: thTape, alpha: alphaTape } },
    }),
    g.symbols({
      id: 'tape-curve',
      title: t('The curve traced by P', 'P 所画的曲线'),
      prompt: t(`The same roll (radius a = ${aCurve}, centre O). Let θ be the angle from the positive x-axis to OQ, so OQ = a(cos θ, sin θ). The free part QP has length aθ and points up and to the right, making an angle of ${alphaCurve}° with the horizontal. Use OP = OQ + QP to complete the parametric equations of the curve traced by P: x(θ) = ${aCurve} cos θ + [ ], y(θ) = ${aCurve} sin θ + [ ].`,
        `仍是这个胶带卷（半径 a = ${aCurve}，圆心 O）。设 θ 为从正 x 轴到 OQ 的角，所以 OQ = a(cos θ, sin θ)。自由段 QP 的长度为 aθ，向右上方延伸，与水平方向成 ${alphaCurve}° 角。利用 OP = OQ + QP，补全 P 所画曲线的参数方程：x(θ) = ${aCurve} cos θ + [ ]，y(θ) = ${aCurve} sin θ + [ ]。`),
      before: `x(θ) = ${aCurve} cos θ + `,
      between: lang === 'zh' ? [`，y(θ) = ${aCurve} sin θ + `] : [`, y(θ) = ${aCurve} sin θ + `],
      after: lang === 'zh' ? '。' : '.',
      answers: [t1Curve, t2Curve],
      tokens: curveTokens,
      figure: g.figure({
        alt: t(`A circle of radius ${aCurve} centred at O with A = (${aCurve}, 0) on it, a point Q on the circle joined to O, and the straight free part of the tape from Q to P pointing up and to the right at ${alphaCurve}° above a dashed horizontal line; drawn for one value of θ.`,
          `以 O 为圆心、半径为 ${aCurve} 的圆，圆上有点 A = (${aCurve}, 0) 和点 Q（与 O 相连），胶带的直线自由段从 Q 指向 P，向右上方，与虚线水平线成 ${alphaCurve}° 角；图中只画出 θ 的一个取值。`),
        view: fitView(curveShapes, 0.15),
        shapes: curveShapes,
        axes: { xLabel: 'x', yLabel: 'y' },
      }),
      hint: t('QP has length aθ and direction (cos α, sin α), so QP = aθ(cos α, sin α). Add its components to those of OQ.',
        'QP 的长度为 aθ，方向为 (cos α, sin α)，所以 QP = aθ(cos α, sin α)。把它的分量加到 OQ 的分量上。'),
      explanation: t(`QP = aθ(cos ${alphaCurve}°, sin ${alphaCurve}°) = (${t1Curve}, ${t2Curve}), so x(θ) = ${aCurve} cos θ + ${t1Curve}, y(θ) = ${aCurve} sin θ + ${t2Curve}. At θ = 0 the free part has length 0 and P = A = (${aCurve}, 0) (P3: x = a(cos θ + θ√2/2), y = a(sin θ + θ√2/2) for α = 45°).`,
        `QP = aθ(cos ${alphaCurve}°, sin ${alphaCurve}°) = (${t1Curve}, ${t2Curve})，所以 x(θ) = ${aCurve} cos θ + ${t1Curve}，y(θ) = ${aCurve} sin θ + ${t2Curve}。θ = 0 时自由段长度为 0，P = A = (${aCurve}, 0)（第 3 题：α = 45° 时 x = a(cos θ + θ√2/2)，y = a(sin θ + θ√2/2)）。`),
    }),
    g.choice({
      id: 'speed',
      title: t('Is the speed constant?', '速率是否为常数？'),
      prompt: t(`A point moves along r(t) = (${coef(aSpeed, 'cos t')}, ${coef(bSpeed, 'sin t')}, ${coef(cSpeed, 'cos t')}). Which statement about its speed |v| is correct?`,
        `一点沿 r(t) = (${coef(aSpeed, 'cos t')}, ${coef(bSpeed, 'sin t')}, ${coef(cSpeed, 'cos t')}) 运动。关于它的速率 |v|，下列哪条说法正确？`),
      options: [
        t(`The speed is constant and equals ${bSpeed}.`, `速率为常数，等于 ${bSpeed}。`),
        t('The speed is not constant: it takes different values at different times.', '速率不是常数：不同时刻的速率不同。'),
        t(`The speed is constant and equals ${B2}.`, `速率为常数，等于 ${B2}。`),
        t(`The speed is constant and equals ${aSpeed + bSpeed + cSpeed}.`, `速率为常数，等于 ${aSpeed + bSpeed + cSpeed}。`),
      ],
      correct: isConst ? 0 : 1,
      hint: t('Differentiate to get v and compute |v|² for the printed numbers. When does |v|² stop depending on t?',
        '先求导得到 v，再用题中的数字算出 |v|²。什么时候 |v|² 与 t 无关？'),
      explanation: t(`v = (−${aSpeed} sin t, ${coef(bSpeed, 'cos t')}, −${cSpeed} sin t), so |v|² = (${aSpeed * aSpeed} + ${cSpeed * cSpeed}) sin² t + ${B2} cos² t = ${A2} sin² t + ${B2} cos² t. ${isConst ? `Here ${A2} = ${B2}, so |v|² = ${B2}(sin² t + cos² t) = ${B2} for every t and the speed is the constant ${bSpeed} (P4a: 9 sin²t + 16 sin²t + 25 cos²t = 25, speed 5). The number ${B2} is |v|², not the speed.` : `Here ${A2} ≠ ${B2}, so |v|² = ${B2} + (${num(A2 - B2)}) sin² t changes with t: at t = 0 the speed is ${bSpeed}, at t = π/2 it is √${A2}. So the speed is not constant.`}`,
        `v = (−${aSpeed} sin t, ${coef(bSpeed, 'cos t')}, −${cSpeed} sin t)，所以 |v|² = (${aSpeed * aSpeed} + ${cSpeed * cSpeed}) sin² t + ${B2} cos² t = ${A2} sin² t + ${B2} cos² t。${isConst ? `这里 ${A2} = ${B2}，所以 |v|² = ${B2}(sin² t + cos² t) = ${B2} 对每个 t 成立，速率是常数 ${bSpeed}（第 4 题 a：9 sin²t + 16 sin²t + 25 cos²t = 25，速率为 5）。数 ${B2} 是 |v|²，不是速率。` : `这里 ${A2} ≠ ${B2}，所以 |v|² = ${B2} + (${num(A2 - B2)}) sin² t 随 t 变化：t = 0 时速率为 ${bSpeed}，t = π/2 时为 √${A2}。所以速率不是常数。`}`),
    }),
    g.number({
      id: 'yz-point',
      title: t('Crossing the yz-plane', '穿过 yz 平面'),
      prompt: t(`A point moves (for t ≥ 0) so that x = ${coef(aYz, 'cos t')}, y = ${coef(bYz, 'sin t')}, z = ${linear([cYz, dYz], ['cos t', 'sin t'])}. At the first time t > 0 at which it crosses the yz-plane (the plane x = 0), where is it? Enter the point (x, y, z).`,
        `一点运动（t ≥ 0），坐标为 x = ${coef(aYz, 'cos t')}，y = ${coef(bYz, 'sin t')}，z = ${linear([cYz, dYz], ['cos t', 'sin t'])}。它第一次（t > 0）穿过 yz 平面（即平面 x = 0）时位于何处？输入该点 (x, y, z)。`),
      fields: [
        { label: t('x', 'x'), answer: 0 },
        { label: t('y', 'y'), answer: bYz },
        { label: t('z', 'z'), answer: dYz },
      ],
      hint: t(`x = ${coef(aYz, 'cos t')} is zero when cos t = 0. Which is the first t > 0 where that happens? Then evaluate y and z at that time.`,
        `x = ${coef(aYz, 'cos t')} 在 cos t = 0 时为零。第一个这样的 t > 0 是多少？然后在该时刻计算 y 和 z。`),
      explanation: t(`x = ${coef(aYz, 'cos t')} = 0 means cos t = 0, and the first t > 0 is t = π/2. There sin t = 1 and cos t = 0, so y = ${num(bYz)} and z = ${num(cYz)}·0 + ${par(dYz)}·1 = ${num(dYz)}: the point is (0, ${num(bYz)}, ${num(dYz)}). At t = 3π/2 the point is (0, ${num(-bYz)}, ${num(-dYz)}) (P4b: (0, ±5, 0)).`,
        `x = ${coef(aYz, 'cos t')} = 0 即 cos t = 0，第一个 t > 0 是 t = π/2。此时 sin t = 1，cos t = 0，所以 y = ${num(bYz)}，z = ${num(cYz)}·0 + ${par(dYz)}·1 = ${num(dYz)}：该点为 (0, ${num(bYz)}, ${num(dYz)})。t = 3π/2 时到达 (0, ${num(-bYz)}, ${num(-dYz)})（第 4 题 b：(0, ±5, 0)）。`),
      audit: { kind: 'MIT-MV-65:yz-point', params: { a: aYz, b: bYz, c: cYz, d: dYz } },
    }),
    g.number({
      id: 'challenge',
      title: t('Speed at the crossing', '穿过平面时的速率'),
      prompt: t(`A point moves along r(t) = (${coef(aCh, 'cos t')}, ${coef(bCh, 'sin t')}, ${coef(cCh, 'cos t')}). At the first time t > 0 at which it crosses the yz-plane (the plane x = 0), what is its speed |v|? Enter a whole number.`,
        `一点沿 r(t) = (${coef(aCh, 'cos t')}, ${coef(bCh, 'sin t')}, ${coef(cCh, 'cos t')}) 运动。它第一次（t > 0）穿过 yz 平面（即平面 x = 0）的时刻，速率 |v| 是多少？输入整数。`),
      fields: [{ label: t('|v|', '|v|'), answer: speedCh }],
      hint: t('First find the time t at which x = 0. Then differentiate r and evaluate v at that time.',
        '先求 x = 0 的时刻 t；再对 r 求导，并在该时刻计算 v。'),
      explanation: t(`x = ${coef(aCh, 'cos t')} = 0 first at t = π/2. v = (−${aCh} sin t, ${coef(bCh, 'cos t')}, −${cCh} sin t), so at t = π/2: v = (−${aCh}, 0, −${cCh}) and |v| = √(${aCh * aCh} + ${cCh * cCh}) = ${speedCh}. The term ${coef(bCh, 'sin t')} does not matter at that moment, because cos(π/2) = 0. This game reviews only Unit 1: vectors, planes, matrices and parametric curves. It does not assess derivatives of functions of several variables, integrals or vector fields.`,
        `x = ${coef(aCh, 'cos t')} 第一次为 0 的时刻是 t = π/2。v = (−${aCh} sin t, ${coef(bCh, 'cos t')}, −${cCh} sin t)，所以 t = π/2 时 v = (−${aCh}, 0, −${cCh})，|v| = √(${aCh * aCh} + ${cCh * cCh}) = ${speedCh}。${coef(bCh, 'sin t')} 这一项在此刻不起作用，因为 cos(π/2) = 0。本游戏只复习第一单元：向量、平面、矩阵和参数曲线。不涉及多元函数的导数、积分和向量场。`),
      audit: { kind: 'MIT-MV-65:challenge', params: { a: aCh, b: bCh, c: cCh } },
    }),
  ];
};
