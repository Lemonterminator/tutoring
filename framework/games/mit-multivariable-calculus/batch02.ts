import { axes3d, fitView, line3d, project3d, type FigureShape, type Pt, type Pt3 } from '../figure';
import { coef, frac, linear, makeMvDeck, num, par, term, vec, type GeneratorMap } from './support';

/**
 * Batch 02: MIT-MV-07 matrix multiplication, MIT-MV-08 matrix inverses, MIT-MV-09 planes and linear systems,
 * MIT-MV-10 solutions to square systems, MIT-MV-11 lines and a line meeting a plane.
 * Every audit kind is documented in audit-notes/batch02.md.
 */
const t = (en: string, zh: string) => [en, zh] as const;
const nz = (x: number) => (x === 0 ? 0 : x);
const XYZ = ['x', 'y', 'z'];
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
const scale = (a: number[], k: number) => a.map(x => k * x);
const isZero = (a: number[]) => a.every(x => x === 0);
const det2 = (m: number[]) => m[0] * m[3] - m[1] * m[2];
const det3 = (m: number[]) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
const rowsOf = (flat: number[], cols: number) => Array.from({ length: flat.length / cols }, (_, i) => flat.slice(i * cols, (i + 1) * cols));
const matText = (cells: string[], cols: number) => `[${Array.from({ length: cells.length / cols }, (_, i) => cells.slice(i * cols, (i + 1) * cols).join(' ')).join('; ')}]`;
const matN = (flat: number[], cols: number) => matText(flat.map(num), cols);
/** Product of an m x n and an n x p matrix, all stored row by row. */
const mulMat = (A: number[], B: number[], m: number, n: number, p: number) => {
  const C: number[] = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < p; j++) { let s = 0; for (let k = 0; k < n; k++) s += A[i * n + k] * B[k * p + j]; C.push(s); }
  return C;
};
const products = (a: number[], b: number[]) => a.map((x, i) => `${par(x)}·${par(b[i])}`).join(' + ');
const eqn = (row: number[], rhs: number | string, vars = XYZ) => `${linear(row, vars)} = ${typeof rhs === 'number' ? num(rhs) : rhs}`;
/** "38/10 = 19/5" when it reduces, "19/13" when it does not, "3" for a whole number. */
const eqFrac = (n: number, d: number) => { const f = frac(n, d), raw = `${n}/${d}`; return d === 1 ? f : f === raw ? raw : `${raw} = ${f}`; };
const col = (...v: number[]) => `${vec(...v)}ᵀ`;
/** "1 + 2t", "−t", "3" */
const affine = (p: number, v: number) => (v === 0 ? num(p) : p === 0 ? coef(v, 't') : `${num(p)} ${v < 0 ? '−' : '+'} ${coef(Math.abs(v), 't')}`);
const lineEqs = (p0: number[], v: number[]) => XYZ.map((name, i) => `${name} = ${affine(p0[i], v[i])}`);
const P3 = (a: number[]): Pt3 => [a[0], a[1], a[2]];
/** p·A + q·B as text, skipping zero coefficients: combo2(2, −1, 'row 1', 'row 2') = "2·row 1 − row 2". */
const combo2 = (p: number, q: number, A: string, B: string) => {
  let out = '';
  for (const [k, name] of [[p, A], [q, B]] as [number, string][]) {
    if (k === 0) continue;
    const body = Math.abs(k) === 1 ? name : `${Math.abs(k)}·${name}`;
    out += out ? ` ${k < 0 ? '−' : '+'} ${body}` : `${k < 0 ? '−' : ''}${body}`;
  }
  return out;
};
/** "−x + 2y + c·z = rhs": a row whose z-coefficient is the unknown c. */
const rowWithC = (u: number[], rhs: string) => { const head = linear(u, ['x', 'y']); return `${head === '0' ? '' : `${head} + `}c·z = ${rhs}`; };

const NOTE = t('Matrices are written row by row; rows are separated by semicolons.', '矩阵按行书写，各行之间用分号隔开。');
/** Integer-length normals (Pythagorean quadruples) */
const QUADS: [number, number, number, number][] = [[1, 2, 2, 3], [2, 3, 6, 7], [4, 4, 7, 9], [1, 4, 8, 9], [2, 6, 9, 11]];
const PAIRS: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10]];

/** Segment of the line a x + b y = e inside the square |x|, |y| <= R (null when it misses the square). */
function clipLine(a: number, b: number, e: number, R: number): [Pt, Pt] | null {
  const pts: Pt[] = [];
  const eps = 1e-9;
  if (Math.abs(b) > eps) for (const x of [-R, R]) { const y = (e - a * x) / b; if (Math.abs(y) <= R + eps) pts.push([x, y]); }
  if (Math.abs(a) > eps) for (const y of [-R, R]) { const x = (e - b * y) / a; if (Math.abs(x) <= R + eps) pts.push([x, y]); }
  if (pts.length < 2) return null;
  let best: [Pt, Pt] = [pts[0], pts[1]], bd = -1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    if (d > bd) { bd = d; best = [pts[i], pts[j]]; }
  }
  return best;
}

export const batch02Generators: GeneratorMap = {
  // ------------------------------------------------------------------------------------------------------------------
  'MIT-MV-07': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-07');
    const ints = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => g.random(lo, hi));

    // sizes
    const target = g.random(0, 3);
    let dims: number[] = [2, 2, 2, 2];
    for (let tries = 0; tries < 500; tries++) {
      dims = ints(4, 2, 4);
      const ab = dims[1] === dims[2], ba = dims[3] === dims[0];
      const scenario = ab && !ba ? 0 : !ab && ba ? 1 : ab && ba ? 2 : 3;
      if (scenario === target) break;
    }
    const [am, an, bm, bn] = dims;
    const abDefined = an === bm, baDefined = bn === am;

    // 3x3 coefficient rows with a missing variable
    let rowsA: number[] = [];
    for (;;) {
      rowsA = ints(9, -3, 3);
      rowsA[g.random(0, 8)] = 0;
      if (rowsOf(rowsA, 3).every(r => !isZero(r))) break;
    }
    let xv = ints(3, -2, 2);
    for (let tries = 0; tries < 50 && xv.filter(v => v !== 0).length < 2; tries++) xv = ints(3, -2, 2);
    const Ax = rowsOf(rowsA, 3).map(r => dot(r, xv));

    // entry of a 2x3 times 3x2 product
    const A23 = ints(6, -3, 3), B32 = ints(6, -3, 3), ei = g.random(1, 2), ej = g.random(1, 2);
    const C22 = mulMat(A23, B32, 2, 3, 2);
    const rowA = A23.slice((ei - 1) * 3, ei * 3), colB = [B32[ej - 1], B32[2 + ej - 1], B32[4 + ej - 1]];

    // 2x2 pair for AB and BA, sometimes commuting
    let A2 = ints(4, -3, 3);
    while (A2[1] === 0 && A2[2] === 0 && A2[0] === A2[3]) A2 = ints(4, -3, 3); // a scalar matrix commutes with everything
    let B2: number[] = [];
    if (g.random(0, 3) === 0) {
      const p = g.random(-2, 2), q = g.nonzero(-2, 2);
      B2 = [p + q * A2[0], q * A2[1], q * A2[2], p + q * A2[3]];
    } else {
      do { B2 = ints(4, -3, 3); } while (mulMat(A2, B2, 2, 2, 2).every((x, i) => x === mulMat(B2, A2, 2, 2, 2)[i]));
    }
    const AB = mulMat(A2, B2, 2, 2, 2), BA = mulMat(B2, A2, 2, 2, 2);
    const commute = AB.every((x, i) => x === BA[i]);

    const j = g.random(1, 3);
    const sub3 = ['₁', '₂', '₃'][j - 1];

    // the plane picture
    let M: number[] = [];
    do { M = ints(4, -3, 3); } while (det2(M) === 0);
    const Ai: Pt = [M[0], M[2]], Aj: Pt = [M[1], M[3]];
    const shapes: FigureShape[] = [
      { kind: 'area', points: [[0, 0], Ai, [M[0] + M[1], M[2] + M[3]], Aj], tone: 'accent', opacity: 0.25 },
      { kind: 'line', points: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], tone: 'muted', dash: true },
      { kind: 'arrow', from: [0, 0], to: Ai, tone: 'accent', label: 'Ai' },
      { kind: 'arrow', from: [0, 0], to: Aj, tone: 'accent2', label: 'Aj' },
    ];

    // det(AB)
    let P2: number[] = [], Q2: number[] = [];
    do { P2 = ints(4, -3, 3); Q2 = ints(4, -3, 3); } while (det2(P2) === 0 || det2(Q2) === 0);

    // challenge: A (2x3), B (3x2), x
    const CA = ints(6, -2, 2), CB = ints(6, -2, 2), cx = ints(2, -2, 2);
    const Bx = mulMat(CB, cx, 3, 2, 1), ABx = mulMat(CA, Bx, 2, 3, 1);

    return [
      g.choice({
        id: 'defined', title: t('Does the product make sense?', '乘积有意义吗？'),
        prompt: t(`A is a ${am} × ${an} matrix (rows × columns) and B is a ${bm} × ${bn} matrix. Which statement is correct?`, `A 是 ${am} × ${an} 矩阵（行数 × 列数），B 是 ${bm} × ${bn} 矩阵。下列哪个说法正确？`),
        options: [t('Only AB is defined.', '只有 AB 有定义。'), t('Only BA is defined.', '只有 BA 有定义。'), t('Both AB and BA are defined.', 'AB 与 BA 都有定义。'), t('Neither AB nor BA is defined.', 'AB 与 BA 都没有定义。')],
        correct: target,
        hint: t('A·B needs as many columns in A as there are rows in B. Check AB and BA separately.', 'A·B 要求 A 的列数等于 B 的行数。分别检查 AB 与 BA。'),
        explanation: t(`AB: A has ${an} columns and B has ${bm} rows, ${abDefined ? `equal, so AB is defined and is ${am} × ${bn}` : 'different, so AB is not defined'}. BA: B has ${bn} columns and A has ${am} rows, ${baDefined ? `equal, so BA is defined and is ${bm} × ${an}` : 'different, so BA is not defined'}.`, `AB：A 有 ${an} 列，B 有 ${bm} 行，${abDefined ? `相等，所以 AB 有定义，是 ${am} × ${bn} 矩阵` : '不相等，所以 AB 无定义'}。BA：B 有 ${bn} 列，A 有 ${am} 行，${baDefined ? `相等，所以 BA 有定义，是 ${bm} × ${an} 矩阵` : '不相等，所以 BA 无定义'}。`),
        audit: { kind: 'MIT-MV-07:defined', params: { am, an, bm, bn } },
      }),
      g.number({
        id: 'matvec', title: t('A system as A x', '把方程组写成 A x'),
        prompt: t(`The left-hand sides of a system of three equations are listed below. Write them as A x, where A is the 3 × 3 matrix of coefficients (a variable that is missing has coefficient 0) and x is the column (x, y, z). Compute A x for x = ${num(xv[0])}, y = ${num(xv[1])}, z = ${num(xv[2])}.`, `下面列出三个方程的左端。把它们写成 A x，其中 A 是 3 × 3 的系数矩阵（缺少的变量系数为 0），x 是列向量 (x, y, z)。当 x = ${num(xv[0])}，y = ${num(xv[1])}，z = ${num(xv[2])} 时，计算 A x。`),
        lines: rowsOf(rowsA, 3).map((r, i) => t(`(${i + 1}) ${linear(r, XYZ)}`, `(${i + 1}) ${linear(r, XYZ)}`)),
        fields: [1, 2, 3].map(i => ({ label: t(`row ${i} of A x`, `A x 的第 ${i} 个分量`), answer: nz(Ax[i - 1]) })),
        hint: t('Row i of A x is the dot product of row i of A with the column x.', 'A x 的第 i 个分量是 A 的第 i 行与列向量 x 的点积。'),
        explanation: t(`A = ${matN(rowsA, 3)}. Each entry of A x is (row of A) · (x, y, z): ${rowsOf(rowsA, 3).map((r, i) => `${products(r, xv)} = ${num(Ax[i])}`).join('; ')}.`, `A = ${matN(rowsA, 3)}。A x 的每个分量是 (A 的一行) · (x, y, z)：${rowsOf(rowsA, 3).map((r, i) => `${products(r, xv)} = ${num(Ax[i])}`).join('；')}。`),
        audit: { kind: 'MIT-MV-07:matvec', params: { a: rowsA, x: xv } },
      }),
      g.number({
        id: 'entry', title: t('One entry of a product', '乘积的一个元素'),
        prompt: t(`A (2 × 3) and B (3 × 2) are given; AB is a 2 × 2 matrix. Find the entry of AB in row ${ei}, column ${ej}.`, `给定 A (2 × 3) 与 B (3 × 2)；AB 是 2 × 2 矩阵。求 AB 中第 ${ei} 行第 ${ej} 列的元素。`),
        lines: [t(`A = ${matN(A23, 3)}`, `A = ${matN(A23, 3)}`), t(`B = ${matN(B32, 2)}`, `B = ${matN(B32, 2)}`), NOTE],
        fields: [{ label: t(`entry (${ei}, ${ej}) of AB`, `AB 的 (${ei}, ${ej}) 元素`), answer: nz(C22[(ei - 1) * 2 + ej - 1]) }],
        hint: t('The (i, j) entry is the dot product of row i of A with column j of B.', '(i, j) 元素是 A 的第 i 行与 B 的第 j 列的点积。'),
        explanation: t(`Row ${ei} of A is ${vec(...rowA)} and column ${ej} of B is ${vec(...colB)}, so the entry is ${products(rowA, colB)} = ${num(C22[(ei - 1) * 2 + ej - 1])}.`, `A 的第 ${ei} 行是 ${vec(...rowA)}，B 的第 ${ej} 列是 ${vec(...colB)}，所以该元素为 ${products(rowA, colB)} = ${num(C22[(ei - 1) * 2 + ej - 1])}。`),
        audit: { kind: 'MIT-MV-07:entry', params: { a: A23, b: B32, i: ei, j: ej } },
      }),
      g.number({
        id: 'product2', title: t('Multiply two 2 × 2 matrices', '两个 2 × 2 矩阵相乘'),
        prompt: t('Compute the product AB. Enter its four entries, row by row.', '计算乘积 AB，按行输入它的四个元素。'),
        lines: [t(`A = ${matN(A2, 2)}`, `A = ${matN(A2, 2)}`), t(`B = ${matN(B2, 2)}`, `B = ${matN(B2, 2)}`), NOTE],
        fields: [['11', 0], ['12', 1], ['21', 2], ['22', 3]].map(([name, k]) => ({ label: t(`(AB) entry ${name}`, `AB 的 ${name} 元素`), answer: nz(AB[k as number]) })),
        hint: t('Each entry of AB is (row of A) · (column of B).', 'AB 的每个元素是 (A 的一行) · (B 的一列)。'),
        explanation: t(`AB = ${matN(AB, 2)}. For example the first entry is ${products([A2[0], A2[1]], [B2[0], B2[2]])} = ${num(AB[0])}.`, `AB = ${matN(AB, 2)}。例如第一个元素是 ${products([A2[0], A2[1]], [B2[0], B2[2]])} = ${num(AB[0])}。`),
        audit: { kind: 'MIT-MV-07:product2', params: { a: A2, b: B2 } },
      }),
      g.choice({
        id: 'noncommute', title: t('Does the order matter?', '顺序重要吗？'),
        prompt: t('For the same A and B, also compute BA. Which statement is correct?', '对同样的 A 与 B，再计算 BA。下列哪个说法正确？'),
        lines: [t(`A = ${matN(A2, 2)}`, `A = ${matN(A2, 2)}`), t(`B = ${matN(B2, 2)}`, `B = ${matN(B2, 2)}`), NOTE],
        options: [t('AB = BA', 'AB = BA'), t('AB ≠ BA', 'AB ≠ BA'), t('BA is not defined.', 'BA 没有定义。')],
        correct: commute ? 0 : 1,
        hint: t('Compute both products entry by entry and compare them. Do not assume they are equal.', '分别逐项计算两个乘积再比较，不要假定它们相等。'),
        explanation: t(`AB = ${matN(AB, 2)} and BA = ${matN(BA, 2)}. ${commute ? 'Here they happen to be equal; this is a special pair, because in general AB ≠ BA.' : 'They differ, so the order matters: matrix multiplication is not commutative.'} Both products are defined since A and B are 2 × 2.`, `AB = ${matN(AB, 2)}，BA = ${matN(BA, 2)}。${commute ? '这里恰好相等，但这是特殊的一对；一般情形下 AB ≠ BA。' : '二者不同，所以顺序很重要：矩阵乘法不满足交换律。'}由于 A、B 都是 2 × 2，两个乘积都有定义。`),
        audit: { kind: 'MIT-MV-07:noncommute', params: { a: A2, b: B2 } },
      }),
      g.choice({
        id: 'column', title: t('Picking out a column', '取出一列'),
        prompt: t(`Let A be any 3 × 3 matrix with columns c₁, c₂, c₃, and let u be a column vector. Which u gives A u = c${sub3} (column ${j} of A) no matter what A is?`, `设 A 是任意 3 × 3 矩阵，各列为 c₁、c₂、c₃，u 是列向量。无论 A 是什么，哪个 u 使 A u = c${sub3}（A 的第 ${j} 列）？`),
        options: [vec(1, 0, 0), vec(0, 1, 0), vec(0, 0, 1), vec(1, 1, 1)].map(v => t(`u = ${v}`, `u = ${v}`)),
        correct: j - 1, fixedOrder: true,
        hint: t('A u = u₁·c₁ + u₂·c₂ + u₃·c₃: each component of u says how much of that column you take.', 'A u = u₁·c₁ + u₂·c₂ + u₃·c₃：u 的每个分量表示取多少该列。'),
        explanation: t(`A u = u₁c₁ + u₂c₂ + u₃c₃, so u = ${vec(...[0, 1, 2].map(k => (k === j - 1 ? 1 : 0)))} gives exactly column ${j}. The vector (1, 1, 1) gives the sum of all three columns.`, `A u = u₁c₁ + u₂c₂ + u₃c₃，所以 u = ${vec(...[0, 1, 2].map(k => (k === j - 1 ? 1 : 0)))} 恰好给出第 ${j} 列。向量 (1, 1, 1) 给出三列之和。`),
        audit: { kind: 'MIT-MV-07:column', params: { j } },
      }),
      g.number({
        id: 'meaning', title: t('What a matrix does to the unit square', '矩阵对单位正方形的作用'),
        prompt: t(`Multiplying by A = ${matN(M, 2)} sends i = (1, 0) to Ai = ${vec(M[0], M[2])} (first column) and j = (0, 1) to Aj = ${vec(M[1], M[3])} (second column). The unit square becomes the parallelogram with sides Ai and Aj. Find the area of this parallelogram (a positive number).`, `乘以 A = ${matN(M, 2)} 把 i = (1, 0) 变为 Ai = ${vec(M[0], M[2])}（第一列），把 j = (0, 1) 变为 Aj = ${vec(M[1], M[3])}（第二列）。单位正方形变成以 Ai、Aj 为边的平行四边形。求该平行四边形的面积（取正数）。`),
        figure: g.figure({
          alt: t(`The unit square (dashed) and the parallelogram with sides Ai = ${vec(M[0], M[2])} and Aj = ${vec(M[1], M[3])} drawn from the origin.`, `虚线的单位正方形，以及从原点出发、以 Ai = ${vec(M[0], M[2])} 和 Aj = ${vec(M[1], M[3])} 为边的平行四边形。`),
          view: fitView(shapes, 0.18), axes: { grid: true, xLabel: 'x', yLabel: 'y' }, shapes,
        }),
        fields: [{ label: t('area', '面积'), answer: Math.abs(det2(M)) }],
        hint: t('The area of the parallelogram spanned by two vectors is the absolute value of a 2 × 2 determinant.', '由两个向量张成的平行四边形面积是 2 × 2 行列式的绝对值。'),
        explanation: t(`Area = |det A| = |${par(M[0])}·${par(M[3])} − ${par(M[1])}·${par(M[2])}| = |${num(det2(M))}| = ${Math.abs(det2(M))}.`, `面积 = |det A| = |${par(M[0])}·${par(M[3])} − ${par(M[1])}·${par(M[2])}| = |${num(det2(M))}| = ${Math.abs(det2(M))}。`),
        audit: { kind: 'MIT-MV-07:meaning', params: { a: M } },
      }),
      g.number({
        id: 'det-product', title: t('The determinant of a product', '乘积的行列式'),
        prompt: t('Find det(AB) for the two 2 × 2 matrices below. You do not have to multiply them out.', '求下面两个 2 × 2 矩阵的乘积 AB 的行列式 det(AB)。不必把乘积算出来。'),
        lines: [t(`A = ${matN(P2, 2)}`, `A = ${matN(P2, 2)}`), t(`B = ${matN(Q2, 2)}`, `B = ${matN(Q2, 2)}`), NOTE],
        fields: [{ label: t('det(AB)', 'det(AB)'), answer: det2(P2) * det2(Q2) }],
        hint: t('For square matrices of the same size, det(AB) = det A · det B.', '对同阶方阵，det(AB) = det A · det B。'),
        explanation: t(`det A = ${par(P2[0])}·${par(P2[3])} − ${par(P2[1])}·${par(P2[2])} = ${num(det2(P2))} and det B = ${num(det2(Q2))}, so det(AB) = ${par(det2(P2))}·${par(det2(Q2))} = ${num(det2(P2) * det2(Q2))}.`, `det A = ${par(P2[0])}·${par(P2[3])} − ${par(P2[1])}·${par(P2[2])} = ${num(det2(P2))}，det B = ${num(det2(Q2))}，所以 det(AB) = ${par(det2(P2))}·${par(det2(Q2))} = ${num(det2(P2) * det2(Q2))}。`),
        audit: { kind: 'MIT-MV-07:det-product', params: { a: P2, b: Q2 } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t('Compute the column vector A B x, which means A (B x). Enter its two components.', '计算列向量 A B x，即 A (B x)。输入它的两个分量。'),
        lines: [t(`A = ${matN(CA, 3)}`, `A = ${matN(CA, 3)}`), t(`B = ${matN(CB, 2)}`, `B = ${matN(CB, 2)}`), t(`x = ${col(...cx)} (a column)`, `x = ${col(...cx)}（列向量）`), NOTE],
        fields: [{ label: t('first component', '第一个分量'), answer: nz(ABx[0]) }, { label: t('second component', '第二个分量'), answer: nz(ABx[1]) }],
        hint: t('Check the sizes first: B x is a 3 × 1 column, then A times that column is 2 × 1.', '先看大小：B x 是 3 × 1 的列，A 乘这一列得到 2 × 1。'),
        explanation: t(`B x = ${col(...Bx)} (each entry is a row of B dotted with x), then A (B x) = ${col(...ABx)}. This game checks matrix arithmetic and sizes; it does not ask you to prove the associative law.`, `B x = ${col(...Bx)}（每个分量是 B 的一行与 x 的点积），再算 A (B x) = ${col(...ABx)}。本游戏检查矩阵运算与大小匹配，不要求证明结合律。`),
        audit: { kind: 'MIT-MV-07:challenge', params: { a: CA, b: CB, x: cx } },
      }),
    ];
  },

  // ------------------------------------------------------------------------------------------------------------------
  'MIT-MV-08': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-08');
    const ints = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => g.random(lo, hi));

    // 2x2 inverse
    let M: number[] = [], dM = 0;
    do { M = ints(4, -3, 3); dM = det2(M); } while (![1, 2, 3].includes(Math.abs(dM)));
    const invM = [M[3], -M[1], -M[2], M[0]].map(x => nz(x / dM));

    // 3x3: determinant and an entry of the inverse
    let A3: number[] = [], D3 = 0;
    do { A3 = ints(9, -2, 2); D3 = det3(A3); } while (![1, 2].includes(Math.abs(D3)));
    const ri = g.random(1, 3), rj = g.random(1, 3);
    // minor of A3 deleting row rj and column ri: entry (ri, rj) of the inverse is C_{rj,ri} / det
    const minorCells: number[] = [];
    rowsOf(A3, 3).forEach((r, a) => { if (a !== rj - 1) r.forEach((x, b) => { if (b !== ri - 1) minorCells.push(x); }); });
    const minorDet = det2(minorCells);
    const cofactor = ((rj + ri) % 2 === 0 ? 1 : -1) * minorDet;
    const invEntry = nz(cofactor / D3);

    // exists
    const singular = g.random(0, 1) === 1;
    let E: number[] = [];
    if (singular) {
      let r1 = ints(2, -3, 3);
      while (isZero(r1)) r1 = ints(2, -3, 3);
      const k = g.pick([-2, -1, 1, 2, 3]);
      E = [r1[0], r1[1], k * r1[0], k * r1[1]];
    } else {
      do { E = ints(4, -3, 3); } while (det2(E) === 0);
    }

    // solve with a given inverse (det = ±1)
    let S: number[] = [];
    do { S = ints(4, -3, 3); } while (Math.abs(det2(S)) !== 1);
    const SM = [S[3], -S[1], -S[2], S[0]].map(x => nz(x / det2(S)));
    const sb = ints(2, -4, 4);
    const sx = [SM[0] * sb[0] + SM[1] * sb[1], SM[2] * sb[0] + SM[3] * sb[1]].map(nz);

    // determinant of the inverse
    const k = g.pick([2, 3, 4, 5, -2, -3, -4]);

    // challenge
    let C: number[] = [], dC = 0;
    do { C = ints(4, -3, 3); dC = det2(C); } while (![2, 3, 4, 5].includes(Math.abs(dC)));
    const cb = ints(2, -4, 4);
    const cxn = nz((C[3] * cb[0] - C[1] * cb[1])), cyn = nz((C[0] * cb[1] - C[2] * cb[0]));

    return [
      g.number({
        id: 'inverse2', title: t('Inverse of a 2 × 2 matrix', '2 × 2 矩阵的逆'),
        prompt: t(`Find A⁻¹ for the matrix A below. Enter the four entries of A⁻¹ row by row. Enter exact fractions such as −1/3, not rounded decimals.`, `求下面矩阵 A 的逆 A⁻¹。按行输入 A⁻¹ 的四个元素，用精确分数（如 −1/3），不要用四舍五入的小数。`),
        lines: [t(`A = ${matN(M, 2)}`, `A = ${matN(M, 2)}`), NOTE],
        fields: [['11', 0], ['12', 1], ['21', 2], ['22', 3]].map(([name, i]) => ({ label: t(`A⁻¹ entry ${name}`, `A⁻¹ 的 ${name} 元素`), answer: invM[i as number] })),
        hint: t('Switch the two diagonal entries, change the signs of the other two, then divide by the determinant.', '交换两个对角元素，另外两个元素变号，再除以行列式。'),
        explanation: t(`|A| = ${par(M[0])}·${par(M[3])} − ${par(M[1])}·${par(M[2])} = ${num(dM)}. So A⁻¹ = (1/${par(dM)}) ${matN([M[3], -M[1], -M[2], M[0]], 2)} = ${matText(invM.map((x, i) => frac([M[3], -M[1], -M[2], M[0]][i], dM)), 2)}.`, `|A| = ${par(M[0])}·${par(M[3])} − ${par(M[1])}·${par(M[2])} = ${num(dM)}。所以 A⁻¹ = (1/${par(dM)}) ${matN([M[3], -M[1], -M[2], M[0]], 2)} = ${matText(invM.map((x, i) => frac([M[3], -M[1], -M[2], M[0]][i], dM)), 2)}。`),
        audit: { kind: 'MIT-MV-08:inverse2', params: { a: M } },
      }),
      g.choice({
        id: 'exists', title: t('Does the inverse exist?', '逆矩阵存在吗？'),
        prompt: t('Decide whether A has an inverse.', '判断 A 是否有逆矩阵。'),
        lines: [t(`A = ${matN(E, 2)}`, `A = ${matN(E, 2)}`), NOTE],
        options: [t('A⁻¹ exists, because |A| ≠ 0.', 'A⁻¹ 存在，因为 |A| ≠ 0。'), t('A⁻¹ does not exist, because |A| = 0.', 'A⁻¹ 不存在，因为 |A| = 0。'), t('A⁻¹ exists even though |A| = 0.', '即使 |A| = 0，A⁻¹ 也存在。')],
        correct: singular ? 1 : 0,
        hint: t('An inverse exists exactly when the determinant is not zero. Compute |A|.', '逆矩阵存在当且仅当行列式不为零。先算 |A|。'),
        explanation: t(`|A| = ${par(E[0])}·${par(E[3])} − ${par(E[1])}·${par(E[2])} = ${num(det2(E))}. ${singular ? 'The determinant is 0 (the second row is a multiple of the first), so there is no inverse: no matrix M can satisfy M A = I, since |M||A| would be 0, not 1.' : 'The determinant is not 0, so A⁻¹ exists and equals (1/|A|) times the adjoint matrix.'}`, `|A| = ${par(E[0])}·${par(E[3])} − ${par(E[1])}·${par(E[2])} = ${num(det2(E))}。${singular ? '行列式为 0（第二行是第一行的倍数），所以没有逆矩阵：若 M A = I，则 |M||A| 应为 1 而不是 0，所以这样的 M 不存在。' : '行列式不为 0，所以 A⁻¹ 存在，并且等于 (1/|A|) 乘伴随矩阵。'}`),
        audit: { kind: 'MIT-MV-08:exists', params: { a: E } },
      }),
      g.number({
        id: 'solve-inverse', title: t('Solve a system with the inverse', '用逆矩阵解方程组'),
        prompt: t('The matrix M below is the inverse of A (so M A = I). Solve A x = b by using x = M b. Enter x₁ and x₂.', '下面的矩阵 M 是 A 的逆矩阵（即 M A = I）。用 x = M b 解 A x = b。输入 x₁ 与 x₂。'),
        lines: [t(`A = ${matN(S, 2)}`, `A = ${matN(S, 2)}`), t(`M = ${matN(SM, 2)}`, `M = ${matN(SM, 2)}`), t(`b = ${col(...sb)} (a column)`, `b = ${col(...sb)}（列向量）`), NOTE],
        fields: [{ label: t('x₁', 'x₁'), answer: sx[0] }, { label: t('x₂', 'x₂'), answer: sx[1] }],
        hint: t('Multiply both sides of A x = b on the left by M: M (A x) = (M A) x = x.', '在 A x = b 两边左乘 M：M (A x) = (M A) x = x。'),
        explanation: t(`x = M b = ${col(SM[0] * sb[0] + SM[1] * sb[1], SM[2] * sb[0] + SM[3] * sb[1])}: x₁ = ${products([SM[0], SM[1]], sb)} = ${num(sx[0])}, x₂ = ${products([SM[2], SM[3]], sb)} = ${num(sx[1])}. The solution is unique because x = M b is an explicit formula.`, `x = M b = ${col(SM[0] * sb[0] + SM[1] * sb[1], SM[2] * sb[0] + SM[3] * sb[1])}：x₁ = ${products([SM[0], SM[1]], sb)} = ${num(sx[0])}，x₂ = ${products([SM[2], SM[3]], sb)} = ${num(sx[1])}。解是唯一的，因为 x = M b 是显式公式。`),
        audit: { kind: 'MIT-MV-08:solve-inverse', params: { a: S, b: sb } },
      }),
      g.number({
        id: 'det3', title: t('The determinant of a 3 × 3 matrix', '3 × 3 矩阵的行列式'),
        prompt: t('Find |A|, the determinant of A. This is the first step to a 3 × 3 inverse.', '求 A 的行列式 |A|。这是求 3 × 3 逆矩阵的第一步。'),
        lines: [t(`A = ${matN(A3, 3)}`, `A = ${matN(A3, 3)}`), NOTE],
        fields: [{ label: t('|A|', '|A|'), answer: D3 }],
        hint: t('Expand along the first row with the signs + − +.', '沿第一行展开，符号为 + − +。'),
        explanation: t(`|A| = ${par(A3[0])}·(${par(A3[4])}·${par(A3[8])} − ${par(A3[5])}·${par(A3[7])}) − ${par(A3[1])}·(${par(A3[3])}·${par(A3[8])} − ${par(A3[5])}·${par(A3[6])}) + ${par(A3[2])}·(${par(A3[3])}·${par(A3[7])} − ${par(A3[4])}·${par(A3[6])}) = ${num(D3)}.`, `|A| = ${par(A3[0])}·(${par(A3[4])}·${par(A3[8])} − ${par(A3[5])}·${par(A3[7])}) − ${par(A3[1])}·(${par(A3[3])}·${par(A3[8])} − ${par(A3[5])}·${par(A3[6])}) + ${par(A3[2])}·(${par(A3[3])}·${par(A3[7])} − ${par(A3[4])}·${par(A3[6])}) = ${num(D3)}。`),
        audit: { kind: 'MIT-MV-08:det3', params: { a: A3 } },
      }),
      g.number({
        id: 'inverse-entry', title: t('One entry of a 3 × 3 inverse', '3 × 3 逆矩阵的一个元素'),
        prompt: t(`For the matrix A below, |A| = ${num(D3)}. Find the entry of A⁻¹ in row ${ri}, column ${rj}. Enter a fraction or a whole number.`, `对下面的矩阵 A，|A| = ${num(D3)}。求 A⁻¹ 中第 ${ri} 行第 ${rj} 列的元素。输入分数或整数。`),
        lines: [t(`A = ${matN(A3, 3)}`, `A = ${matN(A3, 3)}`), NOTE],
        fields: [{ label: t(`A⁻¹ entry (${ri}, ${rj})`, `A⁻¹ 的 (${ri}, ${rj}) 元素`), answer: invEntry }],
        hint: t('A⁻¹ = (1/|A|) · adj A, and adj A is the transpose of the cofactor matrix, so entry (i, j) of A⁻¹ uses the cofactor of the element in row j, column i of A.', 'A⁻¹ = (1/|A|) · adj A，伴随矩阵是余子式矩阵的转置，所以 A⁻¹ 的 (i, j) 元素用的是 A 中第 j 行第 i 列元素的代数余子式。'),
        explanation: t(`Entry (${ri}, ${rj}) of A⁻¹ is the cofactor of the element in row ${rj}, column ${ri} of A, divided by |A|. Delete row ${rj} and column ${ri}: the remaining 2 × 2 determinant is ${par(minorCells[0])}·${par(minorCells[3])} − ${par(minorCells[1])}·${par(minorCells[2])} = ${num(minorDet)}. The checkerboard sign is ${(rj + ri) % 2 === 0 ? '+' : '−'}, so the cofactor is ${num(cofactor)} and the entry is ${frac(cofactor, D3)}.`, `A⁻¹ 的 (${ri}, ${rj}) 元素等于 A 中第 ${rj} 行第 ${ri} 列元素的代数余子式除以 |A|。划去第 ${rj} 行与第 ${ri} 列，剩下的 2 × 2 行列式为 ${par(minorCells[0])}·${par(minorCells[3])} − ${par(minorCells[1])}·${par(minorCells[2])} = ${num(minorDet)}。棋盘符号为 ${(rj + ri) % 2 === 0 ? '+' : '−'}，所以代数余子式是 ${num(cofactor)}，该元素为 ${frac(cofactor, D3)}。`),
        audit: { kind: 'MIT-MV-08:inverse-entry', params: { a: A3, i: ri, j: rj } },
      }),
      g.number({
        id: 'det-inverse', title: t('The determinant of the inverse', '逆矩阵的行列式'),
        prompt: t(`A is an invertible 3 × 3 matrix with |A| = ${num(k)}. Find |A⁻¹|. Enter a fraction.`, `A 是可逆的 3 × 3 矩阵，|A| = ${num(k)}。求 |A⁻¹|。输入分数。`),
        fields: [{ label: t('|A⁻¹|', '|A⁻¹|'), answer: 1 / k }],
        hint: t('Take the determinant of A⁻¹ A = I and use |MA| = |M||A|.', '对 A⁻¹ A = I 取行列式，并用 |MA| = |M||A|。'),
        explanation: t(`From A⁻¹ A = I: |A⁻¹||A| = |I| = 1, so |A⁻¹| = 1/|A| = 1/${par(k)}${k < 0 ? ` = ${frac(1, k)}` : ''}.`, `由 A⁻¹ A = I：|A⁻¹||A| = |I| = 1，所以 |A⁻¹| = 1/|A| = 1/${par(k)}${k < 0 ? ` = ${frac(1, k)}` : ''}。`),
        audit: { kind: 'MIT-MV-08:det-inverse', params: { k } },
      }),
      g.choice({
        id: 'product-inverse', title: t('The inverse of a product', '乘积的逆'),
        prompt: t('A and B are invertible n × n matrices. Which matrix is the inverse of AB?', 'A 与 B 是可逆的 n × n 矩阵。哪个矩阵是 AB 的逆？'),
        options: [t('B⁻¹ A⁻¹', 'B⁻¹ A⁻¹'), t('A⁻¹ B⁻¹', 'A⁻¹ B⁻¹'), t('A⁻¹ + B⁻¹', 'A⁻¹ + B⁻¹'), t('(AB)⁻¹ never exists', '(AB)⁻¹ 永远不存在')],
        correct: 0,
        hint: t('Multiply AB by each candidate on the right, using the associative law, and see which gives I.', '用结合律把 AB 与各个候选矩阵相乘，看哪个得到 I。'),
        explanation: t('(AB)(B⁻¹A⁻¹) = A(B B⁻¹)A⁻¹ = A A⁻¹ = I by the associative law, so B⁻¹A⁻¹ works. A⁻¹B⁻¹ fails in general because AB ≠ BA; the sum A⁻¹ + B⁻¹ is unrelated. AB is invertible because |AB| = |A||B| ≠ 0.', '由结合律，(AB)(B⁻¹A⁻¹) = A(B B⁻¹)A⁻¹ = A A⁻¹ = I，所以 B⁻¹A⁻¹ 是 AB 的逆。一般情形下 A⁻¹B⁻¹ 不行，因为 AB ≠ BA；和 A⁻¹ + B⁻¹ 与此无关。AB 可逆，因为 |AB| = |A||B| ≠ 0。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t('Solve the system by writing it as A x = b and using A⁻¹. Enter x and y as fractions or whole numbers.', '把方程组写成 A x = b，用 A⁻¹ 求解。以分数或整数输入 x 与 y。'),
        lines: [t(eqn([C[0], C[1]], cb[0], ['x', 'y']), eqn([C[0], C[1]], cb[0], ['x', 'y'])), t(eqn([C[2], C[3]], cb[1], ['x', 'y']), eqn([C[2], C[3]], cb[1], ['x', 'y']))],
        fields: [{ label: t('x', 'x'), answer: cxn / dC }, { label: t('y', 'y'), answer: cyn / dC }],
        hint: t('First check |A| ≠ 0, then x = A⁻¹ b with A⁻¹ = (1/|A|)(switch the diagonal, change the signs of the other two).', '先检查 |A| ≠ 0，再用 x = A⁻¹ b，其中 A⁻¹ = (1/|A|)(交换对角元素，其余两个变号)。'),
        explanation: t(`A = ${matN(C, 2)} and |A| = ${num(dC)} ≠ 0. A⁻¹ = ${matText([C[3], -C[1], -C[2], C[0]].map(x => frac(x, dC)), 2)}. Then x = (${products([C[3], -C[1]], cb)})/${par(dC)} = ${frac(cxn, dC)} and y = (${products([-C[2], C[0]], cb)})/${par(dC)} = ${frac(cyn, dC)}. This game checks the computation; it does not cover the adjoint formula's proof or systems larger than 3 × 3.`, `A = ${matN(C, 2)}，|A| = ${num(dC)} ≠ 0。A⁻¹ = ${matText([C[3], -C[1], -C[2], C[0]].map(x => frac(x, dC)), 2)}。于是 x = (${products([C[3], -C[1]], cb)})/${par(dC)} = ${frac(cxn, dC)}，y = (${products([-C[2], C[0]], cb)})/${par(dC)} = ${frac(cyn, dC)}。本游戏检查计算，不涉及伴随矩阵公式的证明，也不涉及超过 3 × 3 的方程组。`),
        audit: { kind: 'MIT-MV-08:challenge', params: { a: C, b: cb } },
      }),
    ];
  },

  // ------------------------------------------------------------------------------------------------------------------
  'MIT-MV-09': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-09');
    const ints = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => g.random(lo, hi));
    const quadNormal = () => {
      const [x, y, z, L] = g.pick(QUADS);
      const v = [x, y, z];
      for (let i = 2; i > 0; i--) { const j = g.random(0, i); [v[i], v[j]] = [v[j], v[i]]; }
      return { n: v.map(c => (g.random(0, 1) ? c : -c)), L };
    };

    // intercepts
    const ia = g.nonzero(-3, 3), ib = g.nonzero(-3, 3), ic = g.nonzero(-3, 3);
    let ip = g.random(-2, 2), iq = g.random(-2, 2);
    for (let tries = 0; tries < 50 && (ip === 0 || iq === 0 || ip + iq === 1); tries++) { ip = g.random(-2, 2); iq = g.random(-2, 2); }
    const ix = ia * ip, iy = ib * iq, iz = ic * (1 - ip - iq);

    // line through two points
    const lp = ints(2, -3, 3);
    let lv = ints(2, -3, 3);
    while (isZero(lv)) lv = ints(2, -3, 3);
    const lq = add(lp, lv);
    const ln = [-lv[1], lv[0]], lc = dot(ln, lp);

    // distance point-plane
    const { n: dn, L: dL } = quadNormal();
    let dd = 0, dp: number[] = [];
    do { dd = g.random(-5, 5); dp = ints(3, -3, 3); } while (dot(dn, dp) - dd === 0);
    const dres = dot(dn, dp) - dd;

    // parallel planes
    const { n: qn, L: qL } = quadNormal();
    const qk = g.pick([1, 2, -2, 3, -1]);
    let qd1 = 0, qd2 = 0;
    do { qd1 = g.random(-5, 5); qd2 = g.random(-5, 5); } while (qd1 === qd2);
    const qn2 = scale(qn, qk), qe2 = qk * qd2;

    // 2x2 systems
    const kind2 = g.random(0, 2); // 0 one, 1 none, 2 infinitely many
    let sys: number[] = [];
    for (;;) {
      const a = g.random(-3, 3), b = g.random(-3, 3);
      if (a === 0 && b === 0) continue;
      const e = g.random(-5, 5);
      if (kind2 === 0) {
        const c = g.random(-3, 3), d = g.random(-3, 3), f = g.random(-5, 5), dt = a * d - b * c;
        if (dt === 0) continue;
        const x = (e * d - b * f) / dt, y = (a * f - c * e) / dt;
        if (Math.abs(x) > 7 || Math.abs(y) > 7) continue;
        sys = [a, b, c, d, e, f];
      } else {
        const k = g.pick([-2, -1, 1, 2, 3]);
        sys = [a, b, k * a, k * b, e, kind2 === 2 ? k * e : k * e + g.pick([-2, -1, 1, 2])];
      }
      break;
    }
    const [sa, sb, sc, sd, se, sf] = sys;
    const seg1 = clipLine(sa, sb, se, 8), seg2 = clipLine(sc, sd, sf, 8);
    const sysShapes: FigureShape[] = [];
    if (seg1) sysShapes.push({ kind: 'line', points: [seg1[0], seg1[1]], tone: 'accent', width: 2, label: '1', labelAt: [seg1[0][0] * 0.88 + seg1[1][0] * 0.12, seg1[0][1] * 0.88 + seg1[1][1] * 0.12] });
    if (seg2) sysShapes.push({ kind: 'line', points: [seg2[0], seg2[1]], tone: 'accent2', width: 2, dash: true, label: '2', labelAt: [seg2[1][0] * 0.88 + seg2[0][0] * 0.12, seg2[1][1] * 0.88 + seg2[0][1] * 0.12] });
    const detSys = sa * sd - sb * sc;

    // three planes
    const target3 = g.random(0, 3); // 0 point, 1 line, 2 plane, 3 none
    const subcase = g.random(0, 2);
    type Eq = { row: number[]; d: number };
    let eqs: Eq[] = [];
    let story: { en: string; zh: string; ids: number[] } = { en: '', zh: '', ids: [] };
    const indep = () => { for (;;) { const r1 = ints(3, -2, 2), r2 = ints(3, -2, 2); if (!isZero(cross(r1, r2))) return [r1, r2]; } };
    const combo = () => { for (;;) { const p = g.random(-1, 2), q = g.random(-1, 2); if (p !== 0 || q !== 0) return [p, q]; } };
    if (target3 === 0) {
      let A: number[] = [];
      do { A = ints(9, -2, 2); } while (det3(A) === 0);
      eqs = rowsOf(A, 3).map(row => ({ row, d: g.random(-4, 4) }));
      story = { en: '', zh: '', ids: [] };
    } else if (target3 === 1 || (target3 === 3 && subcase === 0)) {
      const [r1, r2] = indep(), [p, q] = combo();
      const d1 = g.random(-4, 4), d2 = g.random(-4, 4), delta = target3 === 1 ? 0 : g.pick([-2, -1, 1, 2]);
      eqs = [{ row: r1, d: d1 }, { row: r2, d: d2 }, { row: add(scale(r1, p), scale(r2, q)), d: p * d1 + q * d2 + delta }];
      story = { en: '', zh: '', ids: [p, q] };
    } else if (target3 === 2 || (target3 === 3 && subcase === 2)) {
      let r1 = ints(3, -2, 2);
      while (isZero(r1)) r1 = ints(3, -2, 2);
      const k = g.pick([-2, -1, 1, 2]), m = g.pick([-2, -1, 1, 2]), d1 = g.random(-4, 4);
      let d2 = k * d1, d3 = m * d1;
      if (target3 === 3) { d2 += g.pick([-2, -1, 1, 2]); if (g.random(0, 1)) d3 += g.pick([-1, 1]); }
      eqs = [{ row: r1, d: d1 }, { row: scale(r1, k), d: d2 }, { row: scale(r1, m), d: d3 }];
      story = { en: '', zh: '', ids: [k, m] };
    } else {
      // none, subcase 1: two parallel planes and a third that crosses them
      let r1 = ints(3, -2, 2), r3 = ints(3, -2, 2);
      while (isZero(cross(r1, r3))) { r1 = ints(3, -2, 2); r3 = ints(3, -2, 2); }
      const k = g.pick([-2, -1, 1, 2]), d1 = g.random(-4, 4);
      eqs = [{ row: r1, d: d1 }, { row: scale(r1, k), d: k * d1 + g.pick([-2, -1, 1, 2]) }, { row: r3, d: g.random(-4, 4) }];
      story = { en: '', zh: '', ids: [k] };
    }
    // shuffle, remembering where each constructed equation went
    const pos = [0, 1, 2], order = [0, 1, 2];
    for (let i = 2; i > 0; i--) { const j = g.random(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    const shuffled = order.map(o => eqs[o]);
    order.forEach((o, newIndex) => { pos[o] = newIndex; });
    const eqNo = (orig: number) => pos[orig] + 1;
    const flat3 = shuffled.flatMap(e => e.row), d3s = shuffled.map(e => e.d);
    let explanation3: [string, string];
    if (target3 === 0) explanation3 = [`|A| = ${num(det3(flat3))} ≠ 0 for the coefficient matrix A of the three equations, so the three planes meet in exactly one point.`, `三个方程的系数矩阵 A 满足 |A| = ${num(det3(flat3))} ≠ 0，所以三个平面恰交于一点。`];
    else if (target3 === 1 || (target3 === 3 && subcase === 0)) {
      const [p, q] = story.ids, rhs = p * eqs[0].d + q * eqs[1].d;
      const combEn = combo2(p, q, `(eq ${eqNo(0)})`, `(eq ${eqNo(1)})`), combZh = combo2(p, q, `(式${eqNo(0)})`, `(式${eqNo(1)})`);
      explanation3 = target3 === 1
        ? [`Equation ${eqNo(2)} is ${combEn} on both sides (right side: ${par(p)}·${par(eqs[0].d)} + ${par(q)}·${par(eqs[1].d)} = ${num(rhs)} = ${num(eqs[2].d)}). Equations ${eqNo(0)} and ${eqNo(1)} are not parallel, so they meet in a line, and the third plane contains that line. The three planes meet in a line.`, `式${eqNo(2)} 等于 ${combZh}（两边都成立；右端：${par(p)}·${par(eqs[0].d)} + ${par(q)}·${par(eqs[1].d)} = ${num(rhs)} = ${num(eqs[2].d)}）。式${eqNo(0)} 与式${eqNo(1)} 不平行，交于一条直线，而第三个平面包含这条直线。三个平面交于一条直线。`]
        : [`The left side of equation ${eqNo(2)} is ${combEn}, which would force the right side to be ${par(p)}·${par(eqs[0].d)} + ${par(q)}·${par(eqs[1].d)} = ${num(rhs)}, but it is ${num(eqs[2].d)}. The equations contradict each other: no point lies on all three planes.`, `式${eqNo(2)} 的左端等于 ${combZh}，这会迫使右端为 ${par(p)}·${par(eqs[0].d)} + ${par(q)}·${par(eqs[1].d)} = ${num(rhs)}，但实际是 ${num(eqs[2].d)}。方程互相矛盾：没有一点同时在三个平面上。`];
    } else if (target3 === 2) {
      const [k, m] = story.ids;
      explanation3 = [`Equation ${eqNo(1)} is ${num(k)} times equation ${eqNo(0)} (right side too: ${par(k)}·${par(eqs[0].d)} = ${num(k * eqs[0].d)}) and equation ${eqNo(2)} is ${num(m)} times equation ${eqNo(0)} (${par(m)}·${par(eqs[0].d)} = ${num(m * eqs[0].d)}). All three describe the same plane.`, `式${eqNo(1)} 是式${eqNo(0)} 的 ${num(k)} 倍（右端也是：${par(k)}·${par(eqs[0].d)} = ${num(k * eqs[0].d)}），式${eqNo(2)} 是式${eqNo(0)} 的 ${num(m)} 倍（${par(m)}·${par(eqs[0].d)} = ${num(m * eqs[0].d)}）。三个方程描述同一个平面。`];
    } else if (target3 === 3 && subcase === 2) {
      const [k, m] = story.ids;
      explanation3 = [`The normals are proportional (${num(k)} and ${num(m)} times the first), so the planes are parallel; but the right sides are not in the same ratios (they would have to be ${num(k * eqs[0].d)} and ${num(m * eqs[0].d)} for equations ${eqNo(1)} and ${eqNo(2)}, and at least one of them is different). Distinct parallel planes have no common point.`, `法向量成比例（分别是第一个的 ${num(k)} 倍与 ${num(m)} 倍），所以平面平行；但右端不成同样的比例（对式${eqNo(1)} 与式${eqNo(2)} 本应是 ${num(k * eqs[0].d)} 与 ${num(m * eqs[0].d)}，其中至少一个不同）。不重合的平行平面没有公共点。`];
    } else {
      const [k] = story.ids;
      explanation3 = [`Equations ${eqNo(0)} and ${eqNo(1)} have proportional normals (factor ${num(k)}), but ${par(k)}·${par(eqs[0].d)} = ${num(k * eqs[0].d)} is not ${num(eqs[1].d)}: they are distinct parallel planes. Parallel distinct planes have no common point, whatever the third plane is.`, `式${eqNo(0)} 与式${eqNo(1)} 的法向量成比例（比例 ${num(k)}），但 ${par(k)}·${par(eqs[0].d)} = ${num(k * eqs[0].d)} 不等于 ${num(eqs[1].d)}：它们是不重合的平行平面。无论第三个平面如何，不重合的平行平面都没有公共点。`];
    }

    // challenge: point to line through two points
    const cv0 = g.pick(PAIRS);
    const cvBase = g.random(0, 1) ? [cv0[0], cv0[1]] : [cv0[1], cv0[0]];
    const cv = cvBase.map(x => (g.random(0, 1) ? x : -x));
    const cp1 = ints(2, -3, 3), cp2 = add(cp1, cv);
    let cp: number[] = [], cn = [-cv[1], cv[0]];
    do { cp = ints(2, -4, 4); } while (dot(cn, sub(cp, cp1)) === 0);
    const cdist = Math.abs(dot(cn, sub(cp, cp1)));

    return [
      g.number({
        id: 'intercept', title: t('A plane from its intercepts', '由截距确定的平面'),
        prompt: t(`A plane meets the x-, y- and z-axes at (${num(ia)}, 0, 0), (0, ${num(ib)}, 0) and (0, 0, ${num(ic)}). A point on this plane has x = ${num(ix)} and y = ${num(iy)}. Find its z-coordinate.`, `一个平面与 x、y、z 轴分别交于 (${num(ia)}, 0, 0)、(0, ${num(ib)}, 0)、(0, 0, ${num(ic)})。该平面上一点的 x = ${num(ix)}、y = ${num(iy)}。求它的 z 坐标。`),
        fields: [{ label: t('z', 'z'), answer: nz(iz) }],
        hint: t('With intercepts a, b, c the plane is x/a + y/b + z/c = 1. Substitute x and y and solve for z.', '截距为 a、b、c 的平面是 x/a + y/b + z/c = 1。代入 x、y，再解 z。'),
        explanation: t(`The plane is x/${par(ia)} + y/${par(ib)} + z/${par(ic)} = 1. Substituting: ${num(ip)} ${term(iq)} + z/${par(ic)} = 1, so z/${par(ic)} = ${num(1 - ip - iq)} and z = ${num(iz)}. (Check: each intercept point satisfies the equation.)`, `平面方程为 x/${par(ia)} + y/${par(ib)} + z/${par(ic)} = 1。代入：${num(ip)} ${term(iq)} + z/${par(ic)} = 1，所以 z/${par(ic)} = ${num(1 - ip - iq)}，z = ${num(iz)}。（检验：三个截距点都满足方程。）`),
        audit: { kind: 'MIT-MV-09:intercept', params: { a: ia, b: ib, c: ic, x: ix, y: iy } },
      }),
      g.number({
        id: 'line-normal', title: t('A line in point-normal form', '直线的点法式'),
        prompt: t(`A line in the xy-plane passes through P₁ = ${vec(...lp)} and P₂ = ${vec(...lq)}. Let v = P₂ − P₁. Use the normal N = (−v₂, v₁) and write the line as N · (x, y) = c. Enter N₁, N₂ and c.`, `xy 平面上一条直线过 P₁ = ${vec(...lp)} 与 P₂ = ${vec(...lq)}。设 v = P₂ − P₁。取法向量 N = (−v₂, v₁)，把直线写成 N · (x, y) = c。输入 N₁、N₂ 与 c。`),
        fields: [{ label: t('N₁', 'N₁'), answer: nz(ln[0]) }, { label: t('N₂', 'N₂'), answer: nz(ln[1]) }, { label: t('c', 'c'), answer: nz(lc) }],
        hint: t('N is perpendicular to the direction v. Then c = N · P₁, since P₁ is on the line.', 'N 垂直于方向 v。因为 P₁ 在直线上，所以 c = N · P₁。'),
        explanation: t(`v = P₂ − P₁ = ${vec(...lv)}, so N = (−v₂, v₁) = ${vec(...ln)}. c = N · P₁ = ${products(ln, lp)} = ${num(lc)}. Check with P₂: ${products(ln, lq)} = ${num(dot(ln, lq))}, the same value.`, `v = P₂ − P₁ = ${vec(...lv)}，所以 N = (−v₂, v₁) = ${vec(...ln)}。c = N · P₁ = ${products(ln, lp)} = ${num(lc)}。用 P₂ 检验：${products(ln, lq)} = ${num(dot(ln, lq))}，结果相同。`),
        audit: { kind: 'MIT-MV-09:line-normal', params: { p1: lp, p2: lq } },
      }),
      g.number({
        id: 'plane-distance', title: t('Distance from a point to a plane', '点到平面的距离'),
        prompt: t(`Find the distance from P = ${vec(...dp)} to the plane ${eqn(dn, dd)}. The length |N| of the normal is a whole number. Enter a fraction or a whole number.`, `求点 P = ${vec(...dp)} 到平面 ${eqn(dn, dd)} 的距离。法向量的长度 |N| 是整数。输入分数或整数。`),
        fields: [{ label: t('distance', '距离'), answer: Math.abs(dres) / dL }],
        hint: t('Take any point Q on the plane; the distance is |PQ · N| / |N|. Since N · Q = d, this equals |N · P − d| / |N|.', '在平面上任取一点 Q；距离是 |PQ · N| / |N|。因为 N · Q = d，它等于 |N · P − d| / |N|。'),
        explanation: t(`N = ${vec(...dn)}, so |N| = ${dL}. N · P = ${products(dn, dp)} = ${num(dot(dn, dp))}, and N · P − d = ${num(dot(dn, dp))} − ${par(dd)} = ${num(dres)}. Distance = |${num(dres)}| / ${dL} = ${frac(Math.abs(dres), dL)}.`, `N = ${vec(...dn)}，所以 |N| = ${dL}。N · P = ${products(dn, dp)} = ${num(dot(dn, dp))}，N · P − d = ${num(dot(dn, dp))} − ${par(dd)} = ${num(dres)}。距离 = |${num(dres)}| / ${dL} = ${frac(Math.abs(dres), dL)}。`),
        audit: { kind: 'MIT-MV-09:plane-distance', params: { n: dn, d: dd, p: dp } },
      }),
      g.number({
        id: 'parallel-planes', title: t('Distance between parallel planes', '平行平面之间的距离'),
        prompt: t(`The planes ${eqn(qn, qd1)} and ${eqn(qn2, qe2)} are parallel. Find the distance between them. The length of the normal of the first plane is a whole number. Enter a fraction or a whole number.`, `平面 ${eqn(qn, qd1)} 与 ${eqn(qn2, qe2)} 平行。求它们之间的距离。第一个平面法向量的长度是整数。输入分数或整数。`),
        fields: [{ label: t('distance', '距离'), answer: Math.abs(qd1 - qd2) / qL }],
        hint: t('Divide the second equation by its common factor so both planes use the same normal N, then find the distance from a point of one plane to the other.', '把第二个方程除以公因数，使两个平面用同一个法向量 N，再求一个平面上的点到另一个平面的距离。'),
        explanation: t(`${qk === 1 ? 'Both equations already have the same left side.' : `Dividing the second equation by ${num(qk)} gives ${eqn(qn, qd2)}.`} With the same normal N = ${vec(...qn)} (|N| = ${qL}) the distance is |${num(qd1)} − ${par(qd2)}| / ${qL} = ${frac(Math.abs(qd1 - qd2), qL)}.`, `${qk === 1 ? '两个方程的左端已经相同。' : `把第二个方程除以 ${num(qk)} 得 ${eqn(qn, qd2)}。`}两个平面有相同的法向量 N = ${vec(...qn)}（|N| = ${qL}），距离为 |${num(qd1)} − ${par(qd2)}| / ${qL} = ${frac(Math.abs(qd1 - qd2), qL)}。`),
        audit: { kind: 'MIT-MV-09:parallel-planes', params: { n: qn, d: qd1, n2: qn2, e: qe2 } },
      }),
      g.choice({
        id: 'count-2x2', title: t('How many solutions?', '有几个解？'),
        prompt: t('Each equation of the system below is a line in the xy-plane, drawn in the picture (line 1 solid, line 2 dashed). How many solutions does the system have?', '下面方程组的每个方程都是 xy 平面上的一条直线，见图（直线 1 为实线，直线 2 为虚线）。该方程组有几个解？'),
        lines: [t(`(1) ${eqn([sa, sb], se, ['x', 'y'])}`, `(1) ${eqn([sa, sb], se, ['x', 'y'])}`), t(`(2) ${eqn([sc, sd], sf, ['x', 'y'])}`, `(2) ${eqn([sc, sd], sf, ['x', 'y'])}`)],
        figure: g.figure({
          alt: t(`Two lines in the xy-plane, window from −8 to 8: line 1 (solid) is ${eqn([sa, sb], se, ['x', 'y'])}; line 2 (dashed) is ${eqn([sc, sd], sf, ['x', 'y'])}.`, `xy 平面上的两条直线，窗口为 −8 到 8：直线 1（实线）为 ${eqn([sa, sb], se, ['x', 'y'])}；直线 2（虚线）为 ${eqn([sc, sd], sf, ['x', 'y'])}。`),
          view: { xmin: -8, xmax: 8, ymin: -8, ymax: 8 }, axes: { grid: true, xLabel: 'x', yLabel: 'y' }, shapes: sysShapes,
        }),
        options: [t('Exactly one solution', '恰有一个解'), t('No solution', '无解'), t('Infinitely many solutions', '有无穷多个解')],
        correct: kind2, fixedOrder: true,
        hint: t('Compare the coefficient rows of the two equations first. Then compare the right-hand sides.', '先比较两个方程的系数行，再比较右端常数。'),
        explanation: t(kind2 === 0 ? `The coefficient rows (${num(sa)}, ${num(sb)}) and (${num(sc)}, ${num(sd)}) are not proportional (determinant ${par(sa)}·${par(sd)} − ${par(sb)}·${par(sc)} = ${num(detSys)} ≠ 0), so the lines cross in exactly one point.` : kind2 === 1 ? `The coefficient rows are proportional, but the right sides are not in the same ratio: the lines are parallel and different, so there is no point on both.` : `The second equation is a multiple of the first on both sides, so both equations describe the same line: every point of it is a solution.`, kind2 === 0 ? `系数行 (${num(sa)}, ${num(sb)}) 与 (${num(sc)}, ${num(sd)}) 不成比例（行列式 ${par(sa)}·${par(sd)} − ${par(sb)}·${par(sc)} = ${num(detSys)} ≠ 0），所以两直线恰交于一点。` : kind2 === 1 ? '系数行成比例，但右端不成同样的比例：两直线平行且不重合，没有公共点。' : '第二个方程两边都是第一个方程的倍数，所以两个方程表示同一条直线：直线上每一点都是解。'),
        audit: { kind: 'MIT-MV-09:count-2x2', params: { a: sa, b: sb, c: sc, d: sd, e: se, f: sf } },
      }),
      g.choice({
        id: 'three-planes', title: t('Three planes', '三个平面'),
        prompt: t('How do the three planes below intersect? (Decide it from the equations; consider whether some planes are parallel or combine into another one.)', '下面三个平面如何相交？（根据方程判断；注意是否有平行的平面，或某个方程是其他方程的组合。）'),
        lines: shuffled.map((e, i) => t(`(eq ${i + 1}) ${eqn(e.row, e.d)}`, `(式${i + 1}) ${eqn(e.row, e.d)}`)),
        options: [t('In exactly one point', '恰交于一点'), t('In a line', '交于一条直线'), t('In a whole plane (all three equations describe the same plane)', '交于一个平面（三个方程描述同一个平面）'), t('There is no point on all three planes', '没有同时在三个平面上的点')],
        correct: target3, fixedOrder: true,
        hint: t('Look for proportional coefficient rows (parallel or equal planes). Then ask whether one equation is a combination of the other two, on both sides.', '先找系数成比例的行（平行或重合的平面）。再看某个方程是否（两边都）是另外两个的组合。'),
        explanation: t(explanation3[0], explanation3[1]),
        audit: { kind: 'MIT-MV-09:three-planes', params: { a: flat3, d: d3s } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`A line in the xy-plane passes through P₁ = ${vec(...cp1)} and P₂ = ${vec(...cp2)}. Find the distance from P = ${vec(...cp)} to this line. The distance between P₁ and P₂ is a whole number. Enter a fraction or a whole number.`, `xy 平面上一条直线过 P₁ = ${vec(...cp1)} 与 P₂ = ${vec(...cp2)}。求点 P = ${vec(...cp)} 到这条直线的距离。P₁ 与 P₂ 之间的距离是整数。输入分数或整数。`),
        fields: [{ label: t('distance', '距离'), answer: cdist / cv0[2] }],
        hint: t('Find a normal N to the line from its direction P₂ − P₁, then use |N · (P − P₁)| / |N|.', '由方向 P₂ − P₁ 求直线的法向量 N，再用 |N · (P − P₁)| / |N|。'),
        explanation: t(`v = P₂ − P₁ = ${vec(...cv)}, so |v| = ${cv0[2]} and a normal is N = ${vec(...cn)}. P − P₁ = ${vec(...sub(cp, cp1))} and N · (P − P₁) = ${products(cn, sub(cp, cp1))} = ${num(dot(cn, sub(cp, cp1)))}. Distance = ${eqFrac(cdist, cv0[2])}. This game checks the computation; it does not ask you to sketch the picture.`, `v = P₂ − P₁ = ${vec(...cv)}，所以 |v| = ${cv0[2]}，一个法向量是 N = ${vec(...cn)}。P − P₁ = ${vec(...sub(cp, cp1))}，N · (P − P₁) = ${products(cn, sub(cp, cp1))} = ${num(dot(cn, sub(cp, cp1)))}。距离 = ${eqFrac(cdist, cv0[2])}。本游戏检查计算，不要求画示意图。`),
        audit: { kind: 'MIT-MV-09:challenge', params: { p1: cp1, p2: cp2, p: cp } },
      }),
    ];
  },

  // ------------------------------------------------------------------------------------------------------------------
  'MIT-MV-10': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-10');
    const ints = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => g.random(lo, hi));
    const indep = (lo: number, hi: number) => { for (;;) { const r1 = ints(3, lo, hi), r2 = ints(3, lo, hi); if (!isZero(cross(r1, r2))) return [r1, r2]; } };
    const comb = () => { for (;;) { const p = g.random(-1, 2), q = g.random(-1, 2); if (p !== 0 || q !== 0) return [p, q]; } };
    const shuffle = <T,>(items: T[]) => { const a = items.slice(); for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // unique solution
    let UA: number[] = [];
    do { UA = ints(9, -2, 2); } while (![1, 2, 3, 4].includes(Math.abs(det3(UA))));
    const us = ints(3, -2, 2), ub = rowsOf(UA, 3).map(r => dot(r, us));

    // critical c
    let ca: number[][] = [], cN: number[] = [];
    for (;;) { ca = indep(-2, 2); cN = cross(ca[0], ca[1]); if (cN[2] !== 0) break; }
    const [cp, cq] = comb(), cr3 = add(scale(ca[0], cp), scale(ca[1], cq));
    const cu = [cr3[0], cr3[1]], c0 = cr3[2], cb = ints(3, -3, 3);

    // homogeneous: det = 0 or not
    const sing = g.random(0, 1) === 1;
    let HA: number[] = [];
    if (sing) {
      const [r1, r2] = indep(-3, 3), [p, q] = comb();
      HA = shuffle([r1, r2, add(scale(r1, p), scale(r2, q))]).flat();
    } else {
      do { HA = ints(9, -3, 3); } while (det3(HA) === 0);
    }
    const HD = det3(HA);

    // null vector (1, p, q)
    const nullVec = (needQ: boolean) => {
      for (;;) {
        const p = g.random(-2, 2), q = needQ ? g.nonzero(-2, 2) : g.random(-2, 2);
        const mk = () => { const y = g.random(-2, 2), z = g.random(-2, 2); return [-p * y - q * z, y, z]; };
        const r1 = mk(), r2 = mk();
        if (isZero(cross(r1, r2))) continue;
        const [al, be] = comb(), r3 = add(scale(r1, al), scale(r2, be));
        if ([...r1, ...r2, ...r3].some(x => Math.abs(x) > 5)) continue;
        return { p, q, rows: [r1, r2, r3] };
      }
    };
    const nv = nullVec(false);
    const nvRows = shuffle(nv.rows);
    let pair = [0, 1];
    for (const cand of [[0, 1], [0, 2], [1, 2]]) if (!isZero(cross(nvRows[cand[0]], nvRows[cand[1]]))) { pair = cand; break; }
    const nvN = cross(nvRows[pair[0]], nvRows[pair[1]]);

    // counting solutions
    const kind = g.random(0, 2); // 0 exactly one, 1 none, 2 infinitely many
    let eqs: { row: number[]; b: number }[] = [];
    let cnStory = { p: 0, q: 0, rhs: 0, actual: 0, ids: [0, 1, 2] };
    if (kind === 0) {
      let A: number[] = [];
      do { A = ints(9, -2, 2); } while (det3(A) === 0);
      eqs = rowsOf(A, 3).map(row => ({ row, b: g.random(-3, 3) }));
    } else {
      const [r1, r2] = indep(-2, 2), [p, q] = comb(), b1 = g.random(-3, 3), b2 = g.random(-3, 3);
      const rhs = p * b1 + q * b2, actual = kind === 2 ? rhs : rhs + g.pick([-2, -1, 1, 2]);
      const base = [{ row: r1, b: b1 }, { row: r2, b: b2 }, { row: add(scale(r1, p), scale(r2, q)), b: actual }];
      const order = shuffle([0, 1, 2]);
      eqs = order.map(o => base[o]);
      cnStory = { p, q, rhs, actual, ids: [order.indexOf(0) + 1, order.indexOf(1) + 1, order.indexOf(2) + 1] };
    }
    const flatCn = eqs.flatMap(e => e.row), bCn = eqs.map(e => e.b);

    // consistent value
    const [cvr1, cvr2] = indep(-3, 3), [vp, vq] = comb(), cvr3 = add(scale(cvr1, vp), scale(cvr2, vq));
    const vb1 = g.random(-3, 3), vb2 = g.random(-3, 3), beta = vp * vb1 + vq * vb2;

    // challenge
    const ch = nullVec(true);
    const chr3 = ch.rows[2];
    const chc0 = chr3[2];
    const chN = cross(ch.rows[0], ch.rows[1]);

    return [
      g.number({
        id: 'unique', title: t('One solution when |A| ≠ 0', '|A| ≠ 0 时的唯一解'),
        prompt: t(`This system has |A| ≠ 0, so it has exactly one solution. Find it.`, '该方程组的 |A| ≠ 0，所以恰有一个解。求这个解。'),
        lines: rowsOf(UA, 3).map((r, i) => t(eqn(r, ub[i]), eqn(r, ub[i]))),
        fields: ['x', 'y', 'z'].map((name, i) => ({ label: t(name, name), answer: nz(us[i]) })),
        hint: t('Use elimination, or x = A⁻¹ b. The solution is made of whole numbers.', '用消元法，或 x = A⁻¹ b。解全是整数。'),
        explanation: t(`With |A| = ${num(det3(UA))} ≠ 0 the unique solution is x = A⁻¹ b = ${vec(...us)}. Check in the equations: ${rowsOf(UA, 3).map((r, i) => `${products(r, us)} = ${num(ub[i])}`).join('; ')}.`, `|A| = ${num(det3(UA))} ≠ 0，唯一解为 x = A⁻¹ b = ${vec(...us)}。代回检验：${rowsOf(UA, 3).map((r, i) => `${products(r, us)} = ${num(ub[i])}`).join('；')}。`),
        audit: { kind: 'MIT-MV-10:unique', params: { a: UA, b: ub } },
      }),
      g.number({
        id: 'critical-c', title: t('When does the unique solution fail?', '唯一解何时失效？'),
        prompt: t('The system below has exactly one solution unless |A| = 0. For which value of c is |A| = 0?', '下面的方程组除非 |A| = 0，否则恰有一个解。c 取何值时 |A| = 0？'),
        lines: [t(eqn(ca[0], cb[0]), eqn(ca[0], cb[0])), t(eqn(ca[1], cb[1]), eqn(ca[1], cb[1])), t(rowWithC(cu, num(cb[2])), rowWithC(cu, num(cb[2])))],
        fields: [{ label: t('c', 'c'), answer: c0 }],
        hint: t('|A| = r₁ · (r₂ × r₃) with r₁, r₂, r₃ the rows of A. It is linear in c, so set it equal to 0 and solve.', '|A| = r₁ · (r₂ × r₃)，其中 r₁、r₂、r₃ 是 A 的三行。它关于 c 是线性的，令其为 0 再解。'),
        explanation: t(`Rows 1 and 2 give N = ${vec(...ca[0])} × ${vec(...ca[1])} = ${vec(...cN)}. Then |A| = N · (${num(cu[0])}, ${num(cu[1])}, c) = ${par(cN[0])}·${par(cu[0])} + ${par(cN[1])}·${par(cu[1])} + ${par(cN[2])}·c = 0, so c = ${num(c0)}. For every other c there is exactly one solution.`, `第 1、2 行给出 N = ${vec(...ca[0])} × ${vec(...ca[1])} = ${vec(...cN)}。于是 |A| = N · (${num(cu[0])}, ${num(cu[1])}, c) = ${par(cN[0])}·${par(cu[0])} + ${par(cN[1])}·${par(cu[1])} + ${par(cN[2])}·c = 0，所以 c = ${num(c0)}。对其他任何 c，方程组都恰有一个解。`),
        audit: { kind: 'MIT-MV-10:critical-c', params: { r1: ca[0], r2: ca[1], u: cu, b: cb } },
      }),
      g.choice({
        id: 'homogeneous', title: t('Homogeneous system: trivial solution only?', '齐次方程组：只有零解吗？'),
        prompt: t('Consider the homogeneous system A x = 0 below. Which statement is correct?', '考虑下面的齐次方程组 A x = 0。哪个说法正确？'),
        lines: rowsOf(HA, 3).map(r => t(eqn(r, 0), eqn(r, 0))),
        options: [t('Only the trivial solution x = y = z = 0.', '只有零解 x = y = z = 0。'), t('There are non-zero solutions.', '存在非零解。'), t('There is exactly one non-zero solution.', '恰有一个非零解。')],
        correct: HD === 0 ? 1 : 0,
        hint: t('A x = 0 has a non-zero solution exactly when |A| = 0. Compute |A|.', 'A x = 0 有非零解当且仅当 |A| = 0。计算 |A|。'),
        explanation: t(`|A| = ${num(HD)}. ${HD === 0 ? 'Since |A| = 0 the three rows lie in a plane, and any vector perpendicular to that plane is a non-zero solution; solutions come in whole lines of multiples, so never exactly one.' : 'Since |A| ≠ 0, A⁻¹ exists and x = A⁻¹ 0 = 0 is the only solution.'}`, `|A| = ${num(HD)}。${HD === 0 ? '因为 |A| = 0，三行落在同一平面内，垂直于该平面的任何向量都是非零解；非零解成整条直线的倍数出现，所以不可能恰有一个。' : '因为 |A| ≠ 0，A⁻¹ 存在，x = A⁻¹ 0 = 0 是唯一的解。'}`),
        audit: { kind: 'MIT-MV-10:homogeneous', params: { a: HA } },
      }),
      g.number({
        id: 'null-vector', title: t('Solutions of a singular homogeneous system', '奇异齐次方程组的解'),
        prompt: t('For this system |A| = 0, and all solutions are multiples of a single vector. Find the solution that has x = 1. Enter its y and z.', '该方程组的 |A| = 0，所有解都是某一个向量的倍数。求 x = 1 的那个解，输入它的 y 与 z。'),
        lines: nvRows.map(r => t(eqn(r, 0), eqn(r, 0))),
        fields: [{ label: t('y', 'y'), answer: nz(nv.p) }, { label: t('z', 'z'), answer: nz(nv.q) }],
        hint: t('A solution is perpendicular to every row. Take the cross product of two rows that are not parallel, then scale so that x = 1.', '解与每一行都垂直。取两个不平行的行的叉积，再缩放使 x = 1。'),
        explanation: t(`Rows ${pair[0] + 1} and ${pair[1] + 1}: ${vec(...nvRows[pair[0]])} × ${vec(...nvRows[pair[1]])} = ${vec(...nvN)}. Dividing by its first component ${num(nvN[0])} gives the solution with x = 1: (1, ${num(nv.p)}, ${num(nv.q)}). Check: (1, ${num(nv.p)}, ${num(nv.q)}) satisfies all three equations.`, `第 ${pair[0] + 1}、${pair[1] + 1} 行：${vec(...nvRows[pair[0]])} × ${vec(...nvRows[pair[1]])} = ${vec(...nvN)}。除以第一个分量 ${num(nvN[0])}，得到 x = 1 的解：(1, ${num(nv.p)}, ${num(nv.q)})。代入检验：(1, ${num(nv.p)}, ${num(nv.q)}) 满足三个方程。`),
        audit: { kind: 'MIT-MV-10:null-vector', params: { a: nvRows.flat() } },
      }),
      g.choice({
        id: 'count-solutions', title: t('No solution, one, or infinitely many?', '无解、唯一解还是无穷多解？'),
        prompt: t('How many solutions does this system have? Check |A| first, and if |A| = 0 check whether the equations agree with each other.', '该方程组有几个解？先检查 |A|；若 |A| = 0，再检查各方程是否相容。'),
        lines: eqs.map(e => t(eqn(e.row, e.b), eqn(e.row, e.b))),
        options: [t('Exactly one solution', '恰有一个解'), t('No solution', '无解'), t('Infinitely many solutions', '有无穷多个解')],
        correct: kind, fixedOrder: true,
        hint: t('If |A| ≠ 0 there is one solution. If |A| = 0, one row is a combination of the others; the right-hand sides must be combined in the same way for a solution to exist.', '若 |A| ≠ 0，则恰有一个解。若 |A| = 0，某一行是其他行的组合；只有右端也按同样方式组合，方程组才有解。'),
        explanation: t(kind === 0 ? `|A| = ${num(det3(flatCn))} ≠ 0, so there is exactly one solution (x = A⁻¹ b).` : `|A| = 0 because row ${cnStory.ids[2]} = ${combo2(cnStory.p, cnStory.q, `row ${cnStory.ids[0]}`, `row ${cnStory.ids[1]}`)}. For a solution the right side of that equation would have to be ${par(cnStory.p)}·${par(eqs[cnStory.ids[0] - 1].b)} + ${par(cnStory.q)}·${par(eqs[cnStory.ids[1] - 1].b)} = ${num(cnStory.rhs)}; it is ${num(cnStory.actual)}. ${kind === 2 ? 'They agree, so one equation is redundant and there are infinitely many solutions.' : 'They disagree, so the equations are inconsistent and there is no solution.'}`, kind === 0 ? `|A| = ${num(det3(flatCn))} ≠ 0，所以恰有一个解（x = A⁻¹ b）。` : `|A| = 0，因为第 ${cnStory.ids[2]} 行 = ${combo2(cnStory.p, cnStory.q, `第 ${cnStory.ids[0]} 行`, `第 ${cnStory.ids[1]} 行`)}。若有解，该方程的右端必须等于 ${par(cnStory.p)}·${par(eqs[cnStory.ids[0] - 1].b)} + ${par(cnStory.q)}·${par(eqs[cnStory.ids[1] - 1].b)} = ${num(cnStory.rhs)}；而实际是 ${num(cnStory.actual)}。${kind === 2 ? '二者一致，所以有一个方程多余，方程组有无穷多个解。' : '二者不一致，方程组不相容，无解。'}`),
        audit: { kind: 'MIT-MV-10:count-solutions', params: { a: flatCn, b: bCn } },
      }),
      g.number({
        id: 'consistent-value', title: t('Making a singular system consistent', '使奇异方程组相容'),
        prompt: t('Here |A| = 0, so the system has solutions only for special right-hand sides. For which value of β does it have a solution?', '这里 |A| = 0，所以只有特殊的右端才有解。β 取何值时方程组有解？'),
        lines: [t(eqn(cvr1, vb1), eqn(cvr1, vb1)), t(eqn(cvr2, vb2), eqn(cvr2, vb2)), t(eqn(cvr3, 'β'), eqn(cvr3, 'β'))],
        fields: [{ label: t('β', 'β'), answer: nz(beta) }],
        hint: t('Write row 3 = p·(row 1) + q·(row 2) and find p and q. A solution of the first two equations then forces β = p·b₁ + q·b₂.', '写出第 3 行 = p·(第 1 行) + q·(第 2 行)，求出 p 与 q。前两个方程的解会迫使 β = p·b₁ + q·b₂。'),
        explanation: t(`Row 3 = ${combo2(vp, vq, '(row 1)', '(row 2)')}, since ${vec(...cvr3)} = ${par(vp)}·${vec(...cvr1)} + ${par(vq)}·${vec(...cvr2)}. Any solution of the first two equations gives left side 3 equal to ${par(vp)}·${par(vb1)} + ${par(vq)}·${par(vb2)} = ${num(beta)}, so β = ${num(beta)}. For that β the third equation is redundant and there are infinitely many solutions; for any other β there is none.`, `第 3 行 = ${combo2(vp, vq, '(第 1 行)', '(第 2 行)')}，因为 ${vec(...cvr3)} = ${par(vp)}·${vec(...cvr1)} + ${par(vq)}·${vec(...cvr2)}。前两个方程的任何解使第 3 个方程的左端等于 ${par(vp)}·${par(vb1)} + ${par(vq)}·${par(vb2)} = ${num(beta)}，所以 β = ${num(beta)}。此时第三个方程多余，方程组有无穷多个解；β 取其他值则无解。`),
        audit: { kind: 'MIT-MV-10:consistent-value', params: { a: [...cvr1, ...cvr2, ...cvr3], b: [vb1, vb2] } },
      }),
      g.choice({
        id: 'singular-claim', title: t('A claim about singular systems', '关于奇异方程组的论断'),
        prompt: t('A is a square matrix with |A| = 0. Which statement about the system A x = b is correct?', 'A 是方阵且 |A| = 0。关于方程组 A x = b，哪个说法正确？'),
        options: [t('Depending on b, it has no solution or infinitely many; never exactly one.', '视 b 而定，无解或有无穷多个解；绝不会恰有一个解。'), t('It has no solution for any b.', '对任何 b 都无解。'), t('It has exactly one solution for every b.', '对每个 b 都恰有一个解。'), t('It always has infinitely many solutions.', '总有无穷多个解。')],
        correct: 0,
        hint: t('Try b = 0, and then think about what a non-zero solution of A x = 0 does to any solution of A x = b.', '先试 b = 0；再想想 A x = 0 的非零解对 A x = b 的任何解有什么影响。'),
        explanation: t('With b = 0 the zero vector is a solution, so "no solution for any b" is false. If |A| = 0 then A x = 0 has non-zero solutions, so a solution of A x = b can be changed by adding one: there are infinitely many whenever there is one. But for most b the equations contradict each other, so "always infinitely many" is false.', 'b = 0 时零向量是解，所以“对任何 b 都无解”不对。若 |A| = 0，则 A x = 0 有非零解；A x = b 的任一解加上它仍是解，所以只要有解就有无穷多个。但对大多数 b，方程互相矛盾，所以“总有无穷多个解”不对。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t('This homogeneous system has non-zero solutions for exactly one value of c. Find c, and for that c find the solution with x = 1. Enter c, y and z.', '这个齐次方程组恰对一个 c 的值有非零解。求 c，并对该 c 求 x = 1 的解。输入 c、y 与 z。'),
        lines: [t(eqn(ch.rows[0], 0), eqn(ch.rows[0], 0)), t(eqn(ch.rows[1], 0), eqn(ch.rows[1], 0)), t(rowWithC([chr3[0], chr3[1]], '0'), rowWithC([chr3[0], chr3[1]], '0'))],
        fields: [{ label: t('c', 'c'), answer: nz(chc0) }, { label: t('y', 'y'), answer: nz(ch.p) }, { label: t('z', 'z'), answer: nz(ch.q) }],
        hint: t('Non-zero solutions need |A| = 0, which fixes c. Then a solution is perpendicular to all rows: use a cross product of two rows.', '非零解要求 |A| = 0，这就确定了 c。然后解与所有行垂直：用两行的叉积。'),
        explanation: t(`N = row 1 × row 2 = ${vec(...chN)}, and |A| = N · (${num(chr3[0])}, ${num(chr3[1])}, c) = ${par(chN[0])}·${par(chr3[0])} + ${par(chN[1])}·${par(chr3[1])} + ${par(chN[2])}·c = 0 gives c = ${num(chc0)}. The solutions are the multiples of N, and dividing by its first component ${num(chN[0])} gives (1, ${num(ch.p)}, ${num(ch.q)}). This game checks the algebra; it does not assess the geometric picture of three planes through the origin.`, `N = 第 1 行 × 第 2 行 = ${vec(...chN)}，|A| = N · (${num(chr3[0])}, ${num(chr3[1])}, c) = ${par(chN[0])}·${par(chr3[0])} + ${par(chN[1])}·${par(chr3[1])} + ${par(chN[2])}·c = 0 给出 c = ${num(chc0)}。解是 N 的倍数，除以其第一个分量 ${num(chN[0])} 得 (1, ${num(ch.p)}, ${num(ch.q)})。本游戏检查代数计算，不检查对三个过原点平面的几何图像的理解。`),
        audit: { kind: 'MIT-MV-10:challenge', params: { r1: ch.rows[0], r2: ch.rows[1], u: [chr3[0], chr3[1]] } },
      }),
    ];
  },

  // ------------------------------------------------------------------------------------------------------------------
  'MIT-MV-11': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-11');
    const ints = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => g.random(lo, hi));
    const nonzeroVec = (n: number, lo: number, hi: number) => { for (;;) { const v = ints(n, lo, hi); if (!isZero(v)) return v; } };

    // on-line
    const p0a = ints(3, -3, 3), va = [g.nonzero(-3, 3), g.random(-3, 3), g.random(-3, 3)], ta = g.random(-2, 3);
    const xa = p0a[0] + va[0] * ta, ya = p0a[1] + va[1] * ta;

    // two points
    let pb0 = ints(3, -3, 3), pb1 = ints(3, -3, 3);
    while (isZero(sub(pb1, pb0))) pb1 = ints(3, -3, 3);
    const vb = sub(pb1, pb0), tb = g.pick([2, 3, -1, -2]);
    const Pb = (s: number) => add(pb0, scale(vb, s));
    const answerB = Pb(tb);
    const figShapes: FigureShape[] = [
      line3d([P3(Pb(-0.5)), P3(Pb(1.5))], 'accent', { width: 2 }),
      ...axes3d(3),
      { kind: 'point', at: project3d(P3(pb0)), tone: 'accent2', label: 'P₀' },
      { kind: 'point', at: project3d(P3(pb1)), tone: 'accent2', label: 'P₁' },
    ];

    // same line
    const sp0 = ints(3, -3, 3), sv = nonzeroVec(3, -2, 2), sk = g.pick([2, -2, 3, -3]), st = g.pick([-2, -1, 1, 2]);
    const goodQ = add(sp0, scale(sv, st)), goodW = scale(sv, sk);
    let badW: number[] = [];
    for (;;) { badW = ints(3, -2, 2); if (!isZero(cross(badW, sv))) break; }
    const badQ = add(sp0, badW);
    let tilted: number[] = [];
    for (let tries = 0; tries < 200; tries++) {
      const i = g.random(0, 2), s = g.pick([-2, -1, 1, 2]);
      tilted = sv.map((x, k) => (k === i ? x + s : x));
      if (!isZero(cross(tilted, sv)) && !isZero(tilted)) break;
    }
    const sameOptions = [
      [goodQ, goodW], [badQ, goodW], [goodQ, tilted],
    ].map(([q, w]) => t(`through Q = ${vec(...q)} with direction w = ${vec(...w)}`, `过点 Q = ${vec(...q)}，方向 w = ${vec(...w)}`));

    // line meets plane (unique)
    let mn: number[] = [], mv: number[] = [];
    do { mn = nonzeroVec(3, -3, 3); mv = nonzeroVec(3, -3, 3); } while (dot(mn, mv) === 0);
    const mp0 = ints(3, -3, 3), mt = g.random(-2, 3), mpoint = add(mp0, scale(mv, mt)), md = dot(mn, mpoint);

    // relationship
    const rel = g.random(0, 2); // 0 one point, 1 parallel and apart, 2 contained
    let rn = nonzeroVec(3, -2, 2), rv: number[] = [], rp0 = ints(3, -3, 3), rd = 0;
    if (rel === 0) {
      do { rv = nonzeroVec(3, -3, 3); } while (dot(rn, rv) === 0);
      rd = dot(rn, rp0) + g.random(-3, 3);
    } else {
      do { rv = cross(rn, ints(3, -1, 1)); } while (isZero(rv));
      rd = dot(rn, rp0) + (rel === 1 ? g.pick([-3, -2, -1, 1, 2, 3]) : 0);
    }
    const relDot = dot(rn, rv), relPlug = dot(rn, rp0);

    // direction of the intersection of two planes
    let n1: number[] = [], n2: number[] = [];
    do { n1 = nonzeroVec(3, -3, 3); n2 = nonzeroVec(3, -3, 3); } while (isZero(cross(n1, n2)));
    const e1 = g.random(-3, 3), e2 = g.random(-3, 3), dirv = cross(n1, n2);

    // challenge: line through A, B and plane through O, P, Q
    let cA: number[] = [], cB: number[] = [], cP: number[] = [], cQ: number[] = [], cNn: number[] = [], cv: number[] = [], den = 0;
    for (;;) {
      cA = ints(3, -2, 2); cB = ints(3, -2, 2); cP = ints(3, -1, 2); cQ = ints(3, -1, 2);
      cNn = cross(cP, cQ); cv = sub(cB, cA);
      den = dot(cNn, cv);
      if (!isZero(cNn) && den !== 0 && Math.abs(den) <= 5 && Math.abs(dot(cNn, cA)) > 0 && Math.abs(dot(cNn, cA)) <= 8) break;
    }
        const cnum = -dot(cNn, cA);
    const cpoint = [0, 1, 2].map(i => (cA[i] * den + cnum * cv[i]) / den);

    return [
      g.number({
        id: 'on-line', title: t('A point on a line', '直线上的点'),
        prompt: t(`A point on the line below has x = ${num(xa)}. Find its y-coordinate.`, `下面直线上有一点的 x = ${num(xa)}。求它的 y 坐标。`),
        lines: lineEqs(p0a, va).map(s => t(s, s)),
        fields: [{ label: t('y', 'y'), answer: ya }],
        hint: t('First find the parameter t from the x-equation, then use that t in the y-equation.', '先由 x 的方程求参数 t，再把这个 t 代入 y 的方程。'),
        explanation: t(`x = ${affine(p0a[0], va[0])} = ${num(xa)} gives t = ${num(ta)}. Then y = ${num(p0a[1])} + ${par(va[1])}·${par(ta)} = ${num(ya)}.`, `x = ${affine(p0a[0], va[0])} = ${num(xa)} 给出 t = ${num(ta)}。于是 y = ${num(p0a[1])} + ${par(va[1])}·${par(ta)} = ${num(ya)}。`),
        audit: { kind: 'MIT-MV-11:on-line', params: { p0: p0a, v: va, x: xa } },
      }),
      g.number({
        id: 'two-points', title: t('The line through two points', '过两点的直线'),
        prompt: t(`The line through P₀ = ${vec(...pb0)} and P₁ = ${vec(...pb1)} is parametrized by P(t) = P₀ + t (P₁ − P₀), so P(0) = P₀ and P(1) = P₁. Find the point P(${num(tb)}).`, `过 P₀ = ${vec(...pb0)} 与 P₁ = ${vec(...pb1)} 的直线参数化为 P(t) = P₀ + t (P₁ − P₀)，所以 P(0) = P₀，P(1) = P₁。求点 P(${num(tb)})。`),
        figure: g.figure({
          alt: t('A line through the two marked points P₀ and P₁ in a 3D oblique picture (x toward the viewer, y to the right, z up), with the three coordinate axes.', '三维斜投影图（x 轴朝向观察者，y 轴向右，z 轴向上）：过标出的两点 P₀、P₁ 的直线，以及三条坐标轴。'),
          view: fitView(figShapes, 0.15), shapes: figShapes,
        }),
        fields: XYZ.map((name, i) => ({ label: t(name, name), answer: nz(answerB[i]) })),
        hint: t('The direction vector is P₁ − P₀. Then P(t) = P₀ + t·(P₁ − P₀), component by component.', '方向向量是 P₁ − P₀。然后逐分量计算 P(t) = P₀ + t·(P₁ − P₀)。'),
        explanation: t(`v = P₁ − P₀ = ${vec(...vb)}. P(${num(tb)}) = ${vec(...pb0)} + ${par(tb)}·${vec(...vb)} = ${vec(...answerB)}.`, `v = P₁ − P₀ = ${vec(...vb)}。P(${num(tb)}) = ${vec(...pb0)} + ${par(tb)}·${vec(...vb)} = ${vec(...answerB)}。`),
        audit: { kind: 'MIT-MV-11:two-points', params: { p0: pb0, p1: pb1, t: tb } },
      }),
      g.choice({
        id: 'same-line', title: t('Different descriptions of the same line', '同一条直线的不同描述'),
        prompt: t('The line L is given by the parametric equations below. Which description gives the same line L (the same set of points)? A different parametrization of the same line is fine.', '直线 L 由下面的参数方程给出。哪个描述给出同一条直线 L（同一个点集）？同一条直线的不同参数化是允许的。'),
        lines: lineEqs(sp0, sv).map(s => t(s, s)),
        options: sameOptions, correct: 0,
        hint: t('A line is fixed by a point on it and a direction. Is Q on L, and is w parallel to the direction of L?', '直线由其上一点和一个方向决定。Q 在 L 上吗？w 与 L 的方向平行吗？'),
        explanation: t(`L has direction v = ${vec(...sv)} and passes through ${vec(...sp0)}. Q = ${vec(...goodQ)} is on L (t = ${num(st)}) and w = ${vec(...goodW)} = ${par(sk)}·v is parallel to v, so that description is the same line, only with a different time scale. In the others, either Q is not on L or w is not parallel to v.`, `L 的方向是 v = ${vec(...sv)}，过点 ${vec(...sp0)}。Q = ${vec(...goodQ)} 在 L 上（t = ${num(st)}），w = ${vec(...goodW)} = ${par(sk)}·v 平行于 v，所以该描述是同一条直线，只是参数的“时间尺度”不同。其他选项中，要么 Q 不在 L 上，要么 w 不平行于 v。`),
        audit: { kind: 'MIT-MV-11:same-line', params: { p0: sp0, v: sv } },
      }),
      g.number({
        id: 'meets-plane', title: t('Where a line meets a plane', '直线与平面的交点'),
        prompt: t(`Substitute the line into the plane ${eqn(mn, md)} to find the parameter t at which the line meets the plane, and then the point of intersection. Enter t and the point (x, y, z).`, `把直线代入平面 ${eqn(mn, md)}，求直线与平面相交处的参数 t，再求交点。输入 t 与交点 (x, y, z)。`),
        lines: lineEqs(mp0, mv).map(s => t(s, s)),
        fields: [{ label: t('t', 't'), answer: mt }, ...XYZ.map((name, i) => ({ label: t(name, name), answer: nz(mpoint[i]) }))],
        hint: t('Replace x, y, z in the plane equation by the expressions in t. You get one linear equation in t.', '把平面方程中的 x、y、z 换成含 t 的表达式，得到关于 t 的一个一次方程。'),
        explanation: t(`Substituting gives ${num(dot(mn, mp0))} ${term(dot(mn, mv))} t = ${num(md)}, i.e. (N · P₀) + t (N · v) = d with N · P₀ = ${num(dot(mn, mp0))} and N · v = ${num(dot(mn, mv))}. So t = (${num(md)} − ${par(dot(mn, mp0))}) / ${par(dot(mn, mv))} = ${num(mt)}, and the point is ${vec(...mpoint)}.`, `代入得 ${num(dot(mn, mp0))} ${term(dot(mn, mv))} t = ${num(md)}，即 (N · P₀) + t (N · v) = d，其中 N · P₀ = ${num(dot(mn, mp0))}，N · v = ${num(dot(mn, mv))}。所以 t = (${num(md)} − ${par(dot(mn, mp0))}) / ${par(dot(mn, mv))} = ${num(mt)}，交点为 ${vec(...mpoint)}。`),
        audit: { kind: 'MIT-MV-11:meets-plane', params: { p0: mp0, v: mv, n: mn, d: md } },
      }),
      g.choice({
        id: 'relationship', title: t('Line and plane: all the possibilities', '直线与平面：所有可能'),
        prompt: t(`How does the line below meet the plane ${eqn(rn, rd)}?`, `下面的直线与平面 ${eqn(rn, rd)} 的位置关系是什么？`),
        lines: lineEqs(rp0, rv).map(s => t(s, s)),
        options: [t('It meets the plane in exactly one point.', '它与平面恰交于一点。'), t('It is parallel to the plane and has no point in common with it.', '它与平面平行，没有公共点。'), t('It lies in the plane.', '它在平面内。')],
        correct: rel, fixedOrder: true,
        hint: t('Substitute the line into the plane equation. If t cancels, look at what is left: a false or a true statement.', '把直线代入平面方程。若 t 消去了，看剩下的是假命题还是真命题。'),
        explanation: t(`Substituting gives ${num(relPlug)} ${term(relDot)} t = ${num(rd)}. ${rel === 0 ? `The coefficient ${num(relDot)} of t is not 0, so there is exactly one t.` : rel === 1 ? `The t terms cancel and ${num(relPlug)} = ${num(rd)} is false for every t: no common point.` : `The t terms cancel and ${num(relPlug)} = ${num(rd)} is true for every t: the whole line is in the plane.`}`, `代入得 ${num(relPlug)} ${term(relDot)} t = ${num(rd)}。${rel === 0 ? `t 的系数 ${num(relDot)} 不为 0，所以恰有一个 t。` : rel === 1 ? `t 项消去，且 ${num(relPlug)} = ${num(rd)} 对每个 t 都不成立：没有公共点。` : `t 项消去，且 ${num(relPlug)} = ${num(rd)} 对每个 t 都成立：整条直线都在平面内。`}`),
        audit: { kind: 'MIT-MV-11:relationship', params: { p0: rp0, v: rv, n: rn, d: rd } },
      }),
      g.number({
        id: 'two-planes', title: t('The line where two planes meet', '两个平面的交线'),
        prompt: t(`The planes ${eqn(n1, e1)} and ${eqn(n2, e2)} are not parallel, so they meet in a line. That line is perpendicular to both normals. Find its direction vector v = N₁ × N₂ (in this order).`, `平面 ${eqn(n1, e1)} 与 ${eqn(n2, e2)} 不平行，所以交于一条直线。该直线与两个法向量都垂直。求它的方向向量 v = N₁ × N₂（按此顺序）。`),
        fields: XYZ.map((name, i) => ({ label: t(`v${['₁', '₂', '₃'][i]}`, `v${['₁', '₂', '₃'][i]}`), answer: nz(dirv[i]) })),
        hint: t('The normals are the coefficient vectors N₁ and N₂. Take their cross product.', '法向量就是系数向量 N₁ 与 N₂。取它们的叉积。'),
        explanation: t(`N₁ = ${vec(...n1)}, N₂ = ${vec(...n2)}. v = N₁ × N₂ = (${par(n1[1])}·${par(n2[2])} − ${par(n1[2])}·${par(n2[1])}, ${par(n1[2])}·${par(n2[0])} − ${par(n1[0])}·${par(n2[2])}, ${par(n1[0])}·${par(n2[1])} − ${par(n1[1])}·${par(n2[0])}) = ${vec(...dirv)}.`, `N₁ = ${vec(...n1)}，N₂ = ${vec(...n2)}。v = N₁ × N₂ = (${par(n1[1])}·${par(n2[2])} − ${par(n1[2])}·${par(n2[1])}, ${par(n1[2])}·${par(n2[0])} − ${par(n1[0])}·${par(n2[2])}, ${par(n1[0])}·${par(n2[1])} − ${par(n1[1])}·${par(n2[0])}) = ${vec(...dirv)}。`),
        audit: { kind: 'MIT-MV-11:two-planes', params: { n1, n2, d: [e1, e2] } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Find the point where the line through A = ${vec(...cA)} and B = ${vec(...cB)} meets the plane through O = (0, 0, 0), P = ${vec(...cP)} and Q = ${vec(...cQ)}. (The line is not parallel to the plane.) Enter the point as fractions or whole numbers.`, `求过 A = ${vec(...cA)} 与 B = ${vec(...cB)} 的直线与过 O = (0, 0, 0)、P = ${vec(...cP)}、Q = ${vec(...cQ)} 的平面的交点。（直线不平行于该平面。）以分数或整数输入该点。`),
        fields: XYZ.map((name, i) => ({ label: t(name, name), answer: nz(cpoint[i]) })),
        hint: t('Plane: a normal is P × Q and the plane passes through O. Line: A + t (B − A). Substitute and solve for t.', '平面：法向量取 P × Q，且平面过 O。直线：A + t (B − A)。代入并解 t。'),
        explanation: t(`N = P × Q = ${vec(...cNn)}, so the plane is ${eqn(cNn, 0)}. The line is A + t v with v = B − A = ${vec(...cv)}. Substituting: N · A + t (N · v) = ${num(dot(cNn, cA))} ${term(den)} t = 0, so t = ${frac(cnum, den)}. The point is A + t v = (${[0, 1, 2].map(i => frac(cA[i] * den + cnum * cv[i], den)).join(', ')}). This game checks the computation; it does not ask you to sketch the three possible line-plane pictures.`, `N = P × Q = ${vec(...cNn)}，所以平面为 ${eqn(cNn, 0)}。直线为 A + t v，v = B − A = ${vec(...cv)}。代入：N · A + t (N · v) = ${num(dot(cNn, cA))} ${term(den)} t = 0，所以 t = ${frac(cnum, den)}。交点为 A + t v = (${[0, 1, 2].map(i => frac(cA[i] * den + cnum * cv[i], den)).join(', ')})。本游戏检查计算，不要求你画出直线与平面三种位置关系的示意图。`),
        audit: { kind: 'MIT-MV-11:challenge', params: { a: cA, b: cB, p: cP, q: cQ } },
      }),
    ];
  },
};

