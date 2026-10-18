import { arrow3d, axes3d, fitView, line3d, project3d, type Figure, type FigureShape, type Pt, type Pt3 } from '../figure';
import { coef, frac, linear, makeMvDeck, num, par, term, vec, type GeneratorMap } from './support';

/**
 * Batch 1: MIT-MV-01 Vectors, MIT-MV-03 Vector Components and Projection,
 * MIT-MV-04 Determinants: Area and Volume, MIT-MV-05 Cross Products.
 * Definitions follow content/mit-multivariable-calculus/sources/{01,03,04,05}-*.txt.
 */
type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string) => [en, zh] as const;

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
const det2 = (a: number, b: number, c: number, d: number) => a * d - b * c;
/** Row-major 3x3 determinant (Laplace expansion along the first row). */
const det3 = (m: number[]) => m[0] * det2(m[4], m[5], m[7], m[8]) - m[1] * det2(m[3], m[5], m[6], m[8]) + m[2] * det2(m[3], m[4], m[6], m[7]);
const norm2 = (a: number[]) => dot(a, a);
const isSquare = (n: number) => Math.round(Math.sqrt(n)) ** 2 === n;
const products = (a: number[], b: number[]) => a.map((x, i) => `${par(x)}·${par(b[i])}`).join(' + ');
/** Fraction n/d with a negative numerator wrapped in parentheses, for substitution into products. */
const pf = (n: number, d: number) => { const s = frac(n, d); return s.startsWith('−') || s.includes('/') ? `(${s})` : s; };
/** "n/d", followed by " = reduced" only when the fraction reduces. */
const ratio = (n: number, d: number) => (frac(n, d) === `${num(n)}/${d}` ? `${num(n)}/${d}` : `${num(n)}/${d} = ${frac(n, d)}`);
const sign0 = (c: number, keep: boolean) => (c === 0 ? 0 : keep ? c : -c);
const rv = (g: Deck, n: number, lo: number, hi: number) => Array.from({ length: n }, () => g.random(lo, hi));
/** Draw with `make` until `ok` holds. Bounded, so a bad sampling condition fails loudly instead of hanging. */
function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const rvNonzero = (g: Deck, n: number, lo: number, hi: number) => retry(() => rv(g, n, lo, hi), v => v.some(c => c !== 0));
/** Randomly permute and sign the entries of `base`. */
const permSign = (g: Deck, base: number[]) => {
  const v = [...base];
  for (let i = v.length - 1; i > 0; i--) { const j = g.random(0, i); [v[i], v[j]] = [v[j], v[i]]; }
  return v.map(c => sign0(c, g.random(0, 1) === 1));
};
/** Largest k with k² dividing n; n = k² r. */
const simplifyRoot = (n: number) => { let k = 1; for (let c = 2; c * c <= n; c++) while (n % (c * c) === 0) { n /= c * c; k *= c; } return { k, r: n }; };
/** Exact text of (1/2) sqrt(n2): "5/2", "3√5", "√7/2", "5√14/2". */
const halfRoot = (n2: number) => {
  const { k, r } = simplifyRoot(n2);
  if (r === 1) return frac(k, 2);
  if (k % 2 === 0) return `${k / 2 === 1 ? '' : k / 2}√${r}`;
  return `${k === 1 ? '' : k}√${r}/2`;
};

/** (x, y, z) with integer length: a Pythagorean quadruple. */
const QUADS: number[][] = [[1, 2, 2, 3], [2, 3, 6, 7], [4, 4, 7, 9], [1, 4, 8, 9], [2, 6, 9, 11]];
/** (x, y) with integer length: a Pythagorean triple. */
const TRIPLES: number[][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
const quad = (g: Deck, pool = QUADS.slice(0, 4)) => { const q = g.pick(pool); return { v: permSign(g, q.slice(0, 3)), length: q[3] }; };
const triple = (g: Deck, pool = TRIPLES) => { const q = g.pick(pool); return { v: permSign(g, q.slice(0, 2)), length: q[2] }; };

const comp3 = [t('x-component', 'x 坐标分量'), t('y-component', 'y 坐标分量'), t('z-component', 'z 坐标分量')] as const;
const comp2 = [t('x-component', 'x 坐标分量'), t('y-component', 'y 坐标分量')] as const;

export const batch01Generators: GeneratorMap = {
  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-01': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-01');
    // displacement
    const P = rv(g, 3, -3, 4), Q = retry(() => rv(g, 3, -3, 4), q => q.some((c, i) => c !== P[i]));
    const PQ = sub(Q, P);
    // head to tail
    const hA = rvNonzero(g, 2, -4, 4), hB = rvNonzero(g, 2, -4, 4), hEnd = add(hA, hB);
    const pathShapes: FigureShape[] = [
      { kind: 'arrow', from: [0, 0], to: [hA[0], hA[1]] as Pt, tone: 'accent', label: 'A' },
      { kind: 'arrow', from: [hA[0], hA[1]] as Pt, to: [hEnd[0], hEnd[1]] as Pt, tone: 'accent2', label: 'B' },
      { kind: 'point', at: [0, 0], tone: 'muted', label: 'O' },
    ];
    // scaled combination
    const cs = g.nonzero(-3, 3), cr = g.nonzero(-3, 3), cA = rv(g, 2, -3, 4), cB = rvNonzero(g, 2, -3, 4);
    const cAns = [cs * cA[0] + cr * cB[0], cs * cA[1] + cr * cB[1]];
    // length of a sum, integer result
    const sum = triple(g, TRIPLES.slice(0, 3));
    const lA = retry(() => rvNonzero(g, 2, -3, 3), a => sub(sum.v, a).some(c => c !== 0)), lB = sub(sum.v, lA);
    // unit vector
    const un = triple(g, [...TRIPLES, [9, 12, 15], [12, 16, 20], [7, 24, 25], [20, 21, 29]]), unit = un.v;
    // parallelogram fourth vertex
    const [vA, vB, vC] = retry(() => [rv(g, 2, -3, 4), rv(g, 2, -3, 4), rv(g, 2, -3, 4)], ([a, b, c]) => det2(b[0] - a[0], b[1] - a[1], c[0] - b[0], c[1] - b[1]) !== 0);
    const vD = sub(add(vA, vC), vB);
    // triangle inequality, strict case
    const [iA, iB] = retry(() => [triple(g, TRIPLES.slice(0, 3)), triple(g, TRIPLES.slice(0, 3))], ([a, b]) => !(a.v[0] * b.v[1] - a.v[1] * b.v[0] === 0 && dot(a.v, b.v) > 0));
    const iSum = add(iA.v, iB.v), iSum2 = norm2(iSum), iBound = iA.length + iB.length;
    // river
    const rower = g.pick([3, 4, 5, 6, 8, 9, 10, 12]), river = g.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 12].filter(c => c !== rower));
    const crossable = river < rower;
    // challenge: |sA − B| integer
    const chS = g.pick([2, 3]), chW = quad(g), chA = rv(g, 3, -2, 3);
    const chB = sub(chA.map(c => chS * c), chW.v);
    return [
      g.number({
        id: 'displacement', title: t('The vector from P to Q', '从 P 到 Q 的向量'),
        prompt: t(`P = ${vec(...P)} and Q = ${vec(...Q)}. Find the vector PQ, the displacement from P to Q.`, `P = ${vec(...P)}，Q = ${vec(...Q)}。求向量 PQ，即从 P 到 Q 的位移。`),
        fields: PQ.map((c, i) => ({ label: comp3[i], answer: c })),
        hint: t('A displacement is "end minus start": subtract coordinates of the initial point from the terminal point.', '位移就是“终点减起点”：用终点坐标减去起点坐标。'),
        explanation: t(`PQ = Q − P = ${vec(...Q.map((c, i) => c - P[i]))} computed as ${Q.map((c, i) => `${par(c)} − ${par(P[i])}`).join(', ')}, so PQ = ${vec(...PQ)}.`, `PQ = Q − P，逐分量为 ${Q.map((c, i) => `${par(c)} − ${par(P[i])}`).join('，')}，所以 PQ = ${vec(...PQ)}。`),
        audit: { kind: 'MIT-MV-01:displacement', params: { p: P, q: Q } },
      }),
      g.number({
        id: 'head-to-tail', title: t('Adding vectors head to tail', '头尾相接地加向量'),
        prompt: t(`A = ${vec(...hA)} is drawn from the origin O, and B = ${vec(...hB)} is drawn starting at the tip of A. Find the point where B ends, the tip of A + B.`, `从原点 O 画出 A = ${vec(...hA)}，再从 A 的终点出发画出 B = ${vec(...hB)}。求 B 的终点，即 A + B 的终点。`),
        figure: g.figure({ alt: t(`From the origin an arrow A = ${vec(...hA)}, then from its tip a second arrow B = ${vec(...hB)}; the path ends at the tip of A + B.`, `从原点画出箭头 A = ${vec(...hA)}，再从它的终点画出第二个箭头 B = ${vec(...hB)}；路径终点就是 A + B 的终点。`), view: { xmin: -9, xmax: 9, ymin: -9, ymax: 9 }, axes: { grid: true }, shapes: pathShapes }),
        fields: hEnd.map((c, i) => ({ label: comp2[i], answer: c })),
        hint: t('Vectors add component by component; the end of the path is the position vector A + B.', '向量按分量相加；路径的终点就是位置向量 A + B。'),
        explanation: t(`A + B = (${par(hA[0])} + ${par(hB[0])}, ${par(hA[1])} + ${par(hB[1])}) = ${vec(...hEnd)}. The order does not matter: B + A ends at the same point.`, `A + B = (${par(hA[0])} + ${par(hB[0])}, ${par(hA[1])} + ${par(hB[1])}) = ${vec(...hEnd)}。顺序无关：B + A 终点相同。`),
        audit: { kind: 'MIT-MV-01:head-to-tail', params: { a: hA, b: hB } },
      }),
      g.number({
        id: 'combine', title: t('Scaling and subtracting', '数乘与减法'),
        prompt: t(`A = ${vec(...cA)} and B = ${vec(...cB)}. Compute ${linear([cs, cr], ['A', 'B'])}.`, `A = ${vec(...cA)}，B = ${vec(...cB)}。计算 ${linear([cs, cr], ['A', 'B'])}。`),
        fields: cAns.map((c, i) => ({ label: comp2[i], answer: c })),
        hint: t('Scale each vector first (every component), then add the results component by component.', '先对每个向量的每个分量数乘，再按分量相加。'),
        explanation: t(`${par(cs)}·${vec(...cA)} + ${par(cr)}·${vec(...cB)} = (${par(cs)}·${par(cA[0])} + ${par(cr)}·${par(cB[0])}, ${par(cs)}·${par(cA[1])} + ${par(cr)}·${par(cB[1])}) = ${vec(...cAns)}.`, `${par(cs)}·${vec(...cA)} + ${par(cr)}·${vec(...cB)} = (${par(cs)}·${par(cA[0])} + ${par(cr)}·${par(cB[0])}, ${par(cs)}·${par(cA[1])} + ${par(cr)}·${par(cB[1])}) = ${vec(...cAns)}。`),
        audit: { kind: 'MIT-MV-01:combine', params: { s: cs, r: cr, a: cA, b: cB } },
      }),
      g.number({
        id: 'length-of-sum', title: t('The length of a sum', '和向量的长度'),
        prompt: t(`A = ${vec(...lA)} and B = ${vec(...lB)}. Find the length |A + B|. It is a whole number.`, `A = ${vec(...lA)}，B = ${vec(...lB)}。求长度 |A + B|，结果是整数。`),
        fields: [{ label: t('|A + B|', '|A + B|'), answer: sum.length }],
        hint: t('First add the vectors, then use the Pythagorean theorem: |(x, y)| = √(x² + y²).', '先把向量相加，再用勾股定理：|(x, y)| = √(x² + y²)。'),
        explanation: t(`A + B = ${vec(...add(lA, lB))}, so |A + B| = √(${par(sum.v[0])}² + ${par(sum.v[1])}²) = √${norm2(sum.v)} = ${sum.length}. The lengths |A| and |B| are not needed.`, `A + B = ${vec(...add(lA, lB))}，所以 |A + B| = √(${par(sum.v[0])}² + ${par(sum.v[1])}²) = √${norm2(sum.v)} = ${sum.length}。不需要 |A| 与 |B|。`),
        audit: { kind: 'MIT-MV-01:length-of-sum', params: { a: lA, b: lB } },
      }),
      g.number({
        id: 'unit-vector', title: t('A unit vector in a given direction', '给定方向上的单位向量'),
        prompt: t(`Find the unit vector u = (u₁, u₂) pointing in the same direction as v = ${vec(...unit)}. Enter exact fractions.`, `求与 v = ${vec(...unit)} 同向的单位向量 u = (u₁, u₂)。请输入精确的分数。`),
        fields: [{ label: t('u₁', 'u₁'), answer: unit[0] / un.length }, { label: t('u₂', 'u₂'), answer: unit[1] / un.length }],
        hint: t('Divide v by its length |v|; the length is a whole number here.', '把 v 除以它的长度 |v|；这里长度是整数。'),
        explanation: t(`|v| = √(${par(unit[0])}² + ${par(unit[1])}²) = ${un.length}, so u = v/${un.length} = (${frac(unit[0], un.length)}, ${frac(unit[1], un.length)}), which has length 1.`, `|v| = √(${par(unit[0])}² + ${par(unit[1])}²) = ${un.length}，所以 u = v/${un.length} = (${frac(unit[0], un.length)}, ${frac(unit[1], un.length)})，长度为 1。`),
        audit: { kind: 'MIT-MV-01:unit-vector', params: { v: unit } },
      }),
      g.number({
        id: 'parallelogram-vertex', title: t('The fourth vertex of a parallelogram', '平行四边形的第四个顶点'),
        prompt: t(`ABCD is a parallelogram with its vertices listed in order, so the vector AB equals the vector DC. A = ${vec(...vA)}, B = ${vec(...vB)}, C = ${vec(...vC)}. Find D.`, `ABCD 是按顺序列出顶点的平行四边形，所以向量 AB 等于向量 DC。A = ${vec(...vA)}，B = ${vec(...vB)}，C = ${vec(...vC)}。求 D。`),
        fields: vD.map((c, i) => ({ label: comp2[i], answer: c })),
        hint: t('Write AB = B − A and DC = C − D, set them equal, and solve for D.', '写出 AB = B − A 与 DC = C − D，令二者相等，解出 D。'),
        explanation: t(`B − A = C − D gives D = A + C − B = (${par(vA[0])} + ${par(vC[0])} − ${par(vB[0])}, ${par(vA[1])} + ${par(vC[1])} − ${par(vB[1])}) = ${vec(...vD)}. Check: the diagonals AC and BD share the midpoint (${frac(vA[0] + vC[0], 2)}, ${frac(vA[1] + vC[1], 2)}).`, `由 B − A = C − D 得 D = A + C − B = (${par(vA[0])} + ${par(vC[0])} − ${par(vB[0])}, ${par(vA[1])} + ${par(vC[1])} − ${par(vB[1])}) = ${vec(...vD)}。检验：对角线 AC 与 BD 有公共中点 (${frac(vA[0] + vC[0], 2)}, ${frac(vA[1] + vC[1], 2)})。`),
        audit: { kind: 'MIT-MV-01:parallelogram-vertex', params: { a: vA, b: vB, c: vC } },
      }),
      g.choice({
        id: 'length-inequality', title: t('Do lengths add?', '长度会相加吗？'),
        prompt: t(`A = ${vec(...iA.v)} has length |A| = ${iA.length} and B = ${vec(...iB.v)} has length |B| = ${iB.length}. Which statement about |A + B| is correct?`, `A = ${vec(...iA.v)} 的长度 |A| = ${iA.length}，B = ${vec(...iB.v)} 的长度 |B| = ${iB.length}。关于 |A + B|，哪个说法正确？`),
        options: [
          t(`|A + B| < |A| + |B| = ${iBound}: lengths add only when the vectors point the same way.`, `|A + B| < |A| + |B| = ${iBound}：只有两个向量同向时长度才相加。`),
          t(`|A + B| = |A| + |B| = ${iBound}, because the length of a sum is the sum of the lengths.`, `|A + B| = |A| + |B| = ${iBound}，因为和的长度等于长度之和。`),
          t(`|A + B| > |A| + |B| = ${iBound}.`, `|A + B| > |A| + |B| = ${iBound}。`),
        ], correct: 0,
        hint: t('Compare |A + B|² with (|A| + |B|)². You do not need a square root.', '比较 |A + B|² 与 (|A| + |B|)²，不需要开方。'),
        explanation: t(`A + B = ${vec(...iSum)}, so |A + B|² = ${iSum2}, while (|A| + |B|)² = ${iBound * iBound}. Since ${iSum2} < ${iBound * iBound}, |A + B| < |A| + |B|. Equality would need A and B in the same direction (for instance A = ${vec(3, 4)} and 2A).`, `A + B = ${vec(...iSum)}，所以 |A + B|² = ${iSum2}，而 (|A| + |B|)² = ${iBound * iBound}。因为 ${iSum2} < ${iBound * iBound}，所以 |A + B| < |A| + |B|。要取等号，A 与 B 必须同向（例如 A = ${vec(3, 4)} 与 2A）。`),
        audit: { kind: 'MIT-MV-01:length-inequality', params: { a: iA.v, b: iB.v, la: iA.length, lb: iB.length } },
      }),
      g.choice({
        id: 'river', title: t('Rowing across a river', '划船过河'),
        prompt: t(`A river flows at ${river} mph and a rower rows at ${rower} mph in still water. The net velocity is the sum of the river's velocity and the rower's velocity. Can the rower choose a heading so that the net velocity points straight across the river?`, `河水流速 ${river} mph，划船者在静水中的划速为 ${rower} mph。净速度等于水流速度与划船速度之和。划船者能否选择航向，使净速度正对河对岸？`),
        options: [
          t('Yes: head straight across the river.', '能：航向正对河对岸。'),
          t('Yes: head upstream, at an angle θ away from the straight-across direction, with sin θ = (river speed)/(rower speed).', '能：向上游偏转，航向与正对河对岸的方向夹角为 θ，且 sin θ = (水流速度)/(划速)。'),
          t('No: no heading works.', '不能：任何航向都不行。'),
        ], correct: crossable ? 1 : 2,
        hint: t('Along the river the rower must cancel the current, so the upstream part of the rowing velocity is the river speed. Is that possible?', '沿河方向，划船速度必须抵消水流，所以划速的上游分量等于水流速度。这可能吗？'),
        explanation: t(crossable ? `The upstream part of the rowing velocity is ${rower} sin θ and it must equal ${river}, so sin θ = ${frac(river, rower)} < 1. This is possible. Heading straight across would let the current push the boat downstream.` : `The upstream part of the rowing velocity is ${rower} sin θ and it must equal ${river}, so sin θ = ${frac(river, rower)} > 1, which is impossible. The river is faster than the rower, so the boat is pushed downstream whatever the heading.`, crossable ? `划速的上游分量是 ${rower} sin θ，它必须等于 ${river}，所以 sin θ = ${frac(river, rower)} < 1，这是可能的。若正对河对岸划，水流会把船冲向下游。` : `划速的上游分量是 ${rower} sin θ，它必须等于 ${river}，所以 sin θ = ${frac(river, rower)} > 1，这是不可能的。河水比划速快，无论航向如何船都会被冲向下游。`),
        audit: { kind: 'MIT-MV-01:river', params: { river, rower } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`A = ${vec(...chA)} and B = ${vec(...chB)}. Find the length |${coef(chS, 'A')} − B|. It is a whole number.`, `A = ${vec(...chA)}，B = ${vec(...chB)}。求长度 |${coef(chS, 'A')} − B|，结果是整数。`),
        fields: [{ label: t('|' + chS + 'A − B|', '|' + chS + 'A − B|'), answer: chW.length }],
        hint: t('Form the vector first, component by component, then take its length.', '先逐分量算出这个向量，再求它的长度。'),
        explanation: t(`${chS}A − B = ${vec(...chA.map(c => chS * c))} − ${vec(...chB)} = ${vec(...chW.v)}, so its length is √${norm2(chW.v)} = ${chW.length}. This game checks vector arithmetic; it does not test writing coordinate-free proofs (for example that the diagonals of a parallelogram bisect each other).`, `${chS}A − B = ${vec(...chA.map(c => chS * c))} − ${vec(...chB)} = ${vec(...chW.v)}，所以它的长度是 √${norm2(chW.v)} = ${chW.length}。本游戏检查向量运算，不检查不依赖坐标的证明（例如平行四边形对角线互相平分）的书写。`),
        audit: { kind: 'MIT-MV-01:challenge', params: { s: chS, a: chA, b: chB } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-03': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-03');
    // component along a unit vector
    const uu = triple(g, [TRIPLES[0], TRIPLES[2], TRIPLES[3]]), uNum = uu.v, uD = uu.length;
    const uA = rv(g, 2, -5, 5), uAns = dot(uA, uNum) / uD;
    // component along a non-unit B in space
    const bq = quad(g), bB = bq.v, bA = rv(g, 3, -4, 4), bAns = dot(bA, bB) / bq.length;
    // both ways
    const [wA, wB] = retry(() => [triple(g, TRIPLES.slice(0, 3)), triple(g, TRIPLES.slice(0, 3))], ([a, b]) => a.length !== b.length && dot(a.v, b.v) !== 0);
    const wDot = dot(wA.v, wB.v);
    // |A| cos(theta)
    const cases: { k: number; d: number; sgn: number; root: number }[] = [
      { k: 1, d: 3, sgn: 1, root: 1 }, { k: 2, d: 3, sgn: -1, root: 1 }, { k: 1, d: 6, sgn: 1, root: 3 },
      { k: 5, d: 6, sgn: -1, root: 3 }, { k: 1, d: 4, sgn: 1, root: 2 }, { k: 3, d: 4, sgn: -1, root: 2 },
    ];
    const ac = g.pick(cases), aL = g.pick([2, 4, 6, 8, 10, 12]), aM = g.pick([3, 5, 7, 9, 10, 11, 13]);
    const aAns = ac.sgn * (aL / 2) * Math.sqrt(ac.root);
    const aExact = `${ac.sgn < 0 ? '−' : ''}${ac.root === 1 ? num(aL / 2) : `${aL / 2}√${ac.root}`}`;
    const aTheta = `${ac.k === 1 ? '' : ac.k}π/${ac.d}`;
    // projection with a figure
    const pBs: number[][] = [[1, 1], [1, 2], [2, 1], [1, -1], [2, -1], [1, -2], [3, 1], [1, 3], [2, 3], [3, 2]];
    const pB = g.pick(pBs).map(c => (g.random(0, 1) ? c : -c));
    const pA = retry(() => rv(g, 2, -4, 4), a => dot(a, pB) !== 0 && a[0] * pB[1] - a[1] * pB[0] !== 0);
    const pN2 = norm2(pB), pD = dot(pA, pB), pProj = pB.map(c => pD * c);
    const pFoot = pB.map(c => (pD * c) / pN2);
    const projShapes: FigureShape[] = [
      { kind: 'arrow', from: [0, 0], to: [pA[0], pA[1]] as Pt, tone: 'accent', label: 'A' },
      { kind: 'arrow', from: [0, 0], to: [pB[0], pB[1]] as Pt, tone: 'accent2', label: 'B' },
      { kind: 'line', points: [[pA[0], pA[1]], [pFoot[0], pFoot[1]]] as Pt[], tone: 'muted', dash: true },
      { kind: 'arrow', from: [0, 0], to: [pFoot[0], pFoot[1]] as Pt, tone: 'warn', width: 3, label: 'proj' },
    ];
    // zero component and sign
    const zp = g.nonzero(-3, 3), zq = g.nonzero(-4, 4), zm = g.nonzero(-2, 2), zy = zp * zm, zAns = -zm * zq;
    const sp = g.nonzero(-3, 3), sq = g.nonzero(-4, 4), sm = g.nonzero(-2, 2), sy = sp * sm, s0 = -sm * sq;
    // challenge: find x
    let cB = triple(g, [TRIPLES[0], TRIPLES[1], TRIPLES[2]]), cx = 0, cT = 0, cC = 0;
    for (let tries = 0; ; tries++) {
      cB = triple(g, [TRIPLES[0], TRIPLES[2]]); cx = g.random(-6, 6); cT = g.nonzero(-4, 4);
      const total = cx * cB.v[0] + cT * cB.v[1];
      if (total % cB.length === 0 && total !== 0) { cC = total / cB.length; break; }
      if (tries > 2000) { cB = { v: [3, 4], length: 5 }; cx = 3; cT = 4; cC = 5; break; }
    }
    return [
      g.number({
        id: 'component-unit', title: t('The component along a unit vector', '沿单位向量的标量分量'),
        prompt: t(`A = ${vec(...uA)} and u = (${frac(uNum[0], uD)}, ${frac(uNum[1], uD)}) is a unit vector. Find the component of A in the direction of u.`, `A = ${vec(...uA)}，u = (${frac(uNum[0], uD)}, ${frac(uNum[1], uD)}) 是单位向量。求 A 在 u 方向上的标量分量。`),
        fields: [{ label: t('component', '标量分量'), answer: uAns }],
        hint: t('For a unit vector u the component of A is simply A · u. Enter an exact fraction (a terminating decimal is also fine).', '对单位向量 u，A 的标量分量就是 A · u。请输入精确分数（有限小数亦可）。'),
        explanation: t(`A · u = ${par(uA[0])}·${pf(uNum[0], uD)} + ${par(uA[1])}·${pf(uNum[1], uD)} = ${frac(dot(uA, uNum), uD)}. The component is a scalar. A negative value means A · u < 0, i.e. the angle between A and u is obtuse and the projection points opposite to u.`, `A · u = ${par(uA[0])}·${pf(uNum[0], uD)} + ${par(uA[1])}·${pf(uNum[1], uD)} = ${frac(dot(uA, uNum), uD)}。标量分量是一个数（标量）。若为负，表示 A · u < 0，即 A 与 u 的夹角为钝角，投影与 u 反向。`),
        audit: { kind: 'MIT-MV-03:component-unit', params: { a: uA, u: uNum, d: uD } },
      }),
      g.number({
        id: 'component-direction', title: t('The component along any vector B', '沿任意向量 B 的标量分量'),
        prompt: t(`A = ${vec(...bA)} and B = ${vec(...bB)}, where |B| = ${bq.length}. Find the component of A in the direction of B. Enter an exact fraction (a terminating decimal is also fine).`, `A = ${vec(...bA)}，B = ${vec(...bB)}，其中 |B| = ${bq.length}。求 A 在 B 方向上的标量分量。请输入精确分数（有限小数亦可）。`),
        fields: [{ label: t('component', '标量分量'), answer: bAns }],
        hint: t('Use the unit vector B/|B|: the component is A · B/|B|.', '用单位向量 B/|B|：标量分量为 A · B/|B|。'),
        explanation: t(`A · B = ${products(bA, bB)} = ${num(dot(bA, bB))}, so the component is A · B/|B| = ${frac(dot(bA, bB), bq.length)}.`, `A · B = ${products(bA, bB)} = ${num(dot(bA, bB))}，所以标量分量为 A · B/|B| = ${frac(dot(bA, bB), bq.length)}。`),
        audit: { kind: 'MIT-MV-03:component-direction', params: { a: bA, b: bB, lb: bq.length } },
      }),
      g.number({
        id: 'both-ways', title: t('A in the direction of B, and B in the direction of A', 'A 沿 B 方向，B 沿 A 方向'),
        prompt: t(`A = ${vec(...wA.v)} with |A| = ${wA.length}, and B = ${vec(...wB.v)} with |B| = ${wB.length}. Find the component of A in the direction of B, then the component of B in the direction of A. Enter exact fractions (terminating decimals are also fine).`, `A = ${vec(...wA.v)}，|A| = ${wA.length}；B = ${vec(...wB.v)}，|B| = ${wB.length}。分别求 A 在 B 方向上的标量分量，以及 B 在 A 方向上的标量分量。请输入精确分数（有限小数亦可）。`),
        fields: [{ label: t('component of A along B', 'A 沿 B 的标量分量'), answer: wDot / wB.length }, { label: t('component of B along A', 'B 沿 A 的标量分量'), answer: wDot / wA.length }],
        hint: t('Both components use the same dot product A · B, but each divides by the length of the vector you project onto.', '两个标量分量用同一个点积 A · B，但各自除以被投影方向的向量的长度。'),
        explanation: t(`A · B = ${products(wA.v, wB.v)} = ${num(wDot)}. Along B: ${ratio(wDot, wB.length)}. Along A: ${ratio(wDot, wA.length)}. The two components differ because the lengths differ.`, `A · B = ${products(wA.v, wB.v)} = ${num(wDot)}。沿 B：${ratio(wDot, wB.length)}。沿 A：${ratio(wDot, wA.length)}。两者不同，因为长度不同。`),
        audit: { kind: 'MIT-MV-03:both-ways', params: { a: wA.v, b: wB.v, la: wA.length, lb: wB.length } },
      }),
      g.number({
        id: 'angle-form', title: t('The component from the angle', '由夹角求标量分量'),
        prompt: t(`|A| = ${aL}, |B| = ${aM}, and the angle between A and B is θ = ${aTheta}. Find the component of A in the direction of B. Enter an exact value such as 3, −3 or 2sqrt(3).`, `|A| = ${aL}，|B| = ${aM}，A 与 B 的夹角 θ = ${aTheta}。求 A 在 B 方向上的标量分量。请输入精确值，如 3、−3 或 2sqrt(3)。`),
        fields: [{ label: t('component', '标量分量'), answer: aAns }],
        hint: t('The component is |A| cos θ. The length of B does not matter, only its direction does.', '标量分量是 |A| cos θ。B 的长度无关，只有它的方向起作用。'),
        explanation: t(`The component is |A| cos θ = ${aL}·cos(${aTheta}) = ${aExact}. The length |B| = ${aM} is irrelevant.`, `标量分量为 |A| cos θ = ${aL}·cos(${aTheta}) = ${aExact}。长度 |B| = ${aM} 无关。`),
        audit: { kind: 'MIT-MV-03:angle-form', params: { l: aL, m: aM, k: ac.k, d: ac.d } },
      }),
      g.number({
        id: 'projection-figure', title: t('The orthogonal projection', '正交投影'),
        prompt: t(`A = ${vec(...pA)} and B = ${vec(...pB)} are drawn from the origin. The orthogonal projection of A on B is the vector along B (the leg parallel to B) that ends at the foot of the perpendicular dropped from the tip of A onto the line of B. Find its components. Enter exact fractions (terminating decimals are also fine).`, `从原点画出 A = ${vec(...pA)} 与 B = ${vec(...pB)}。A 在 B 上的正交投影是沿 B 的向量（与 B 平行的那条直角边），终点是从 A 的终点向 B 所在直线作垂线的垂足。求它的坐标分量。请输入精确分数（有限小数亦可）。`),
        figure: g.figure({ alt: t(`Arrows A = ${vec(...pA)} and B = ${vec(...pB)} from the origin; a dashed segment from the tip of A meets the line of B at a right angle, and a thick arrow from the origin to that foot is the projection of A on B.`, `从原点出发的箭头 A = ${vec(...pA)} 与 B = ${vec(...pB)}；从 A 的终点出发的虚线与 B 所在直线垂直相交，从原点到垂足的粗箭头是 A 在 B 上的投影。`), view: { xmin: -6, xmax: 6, ymin: -6, ymax: 6 }, axes: { grid: true }, shapes: projShapes }),
        fields: pProj.map((c, i) => ({ label: comp2[i], answer: c / pN2 })),
        hint: t('The projection is (component of A along B) times the unit vector B/|B|. That equals (A · B/|B|²) B.', '投影等于（A 沿 B 的标量分量）乘单位向量 B/|B|，即 (A · B/|B|²) B。'),
        explanation: t(`A · B = ${products(pA, pB)} = ${num(pD)} and |B|² = ${pN2}. The projection is (${num(pD)}/${pN2}) ${vec(...pB)} = (${frac(pProj[0], pN2)}, ${frac(pProj[1], pN2)}).`, `A · B = ${products(pA, pB)} = ${num(pD)}，|B|² = ${pN2}。投影为 (${num(pD)}/${pN2}) ${vec(...pB)} = (${frac(pProj[0], pN2)}, ${frac(pProj[1], pN2)})。`),
        audit: { kind: 'MIT-MV-03:projection', params: { a: pA, b: pB } },
      }),
      g.number({
        id: 'zero-component', title: t('When is the component zero?', '标量分量何时为零？'),
        prompt: t(`A = (a, ${num(zy)}) and B = ${vec(zp, zq)}. For which value of a is the component of A in the direction of B equal to 0?`, `A = (a, ${num(zy)})，B = ${vec(zp, zq)}。a 取何值时，A 在 B 方向上的标量分量等于 0？`),
        fields: [{ label: t('a', 'a'), answer: zAns }],
        hint: t('The component is A · B/|B|, and |B| ≠ 0, so it vanishes exactly when A · B = 0.', '标量分量为 A · B/|B|，而 |B| ≠ 0，所以它为零当且仅当 A · B = 0。'),
        explanation: t(`A · B = ${par(zp)}·a + ${par(zy)}·${par(zq)} = ${coef(zp, 'a')} ${term(zy * zq)} = 0, so a = ${num(zAns)}. Then A ⟂ B.`, `A · B = ${par(zp)}·a + ${par(zy)}·${par(zq)} = ${coef(zp, 'a')} ${term(zy * zq)} = 0，所以 a = ${num(zAns)}。此时 A ⟂ B。`),
        audit: { kind: 'MIT-MV-03:zero-component', params: { y: zy, b: [zp, zq] } },
      }),
      g.choice({
        id: 'negative-component', title: t('When is the component negative?', '标量分量何时为负？'),
        prompt: t(`A = (a, ${num(sy)}) and B = ${vec(sp, sq)}. For which values of a is the component of A in the direction of B negative?`, `A = (a, ${num(sy)})，B = ${vec(sp, sq)}。a 取哪些值时，A 在 B 方向上的标量分量为负？`),
        options: [t(`a < ${num(s0)}`, `a < ${num(s0)}`), t(`a > ${num(s0)}`, `a > ${num(s0)}`), t(`a = ${num(s0)}`, `a = ${num(s0)}`)],
        correct: sp > 0 ? 0 : 1,
        hint: t('The sign of the component is the sign of A · B. Find where A · B changes sign, then decide which side is negative: it depends on the sign of the coefficient of a.', '标量分量的符号就是 A · B 的符号。找出 A · B 变号的位置，再判断哪一侧为负：这取决于 a 的系数的符号。'),
        explanation: t(`A · B = ${coef(sp, 'a')} ${term(sy * sq)} is zero at a = ${num(s0)}. The scalar component has the sign of A · B. The coefficient of a is ${num(sp)}, which is ${sp > 0 ? 'positive, so A · B increases with a and the component is negative for a < ' : 'negative, so A · B decreases with a and the component is negative for a > '}${num(s0)}.`, `A · B = ${coef(sp, 'a')} ${term(sy * sq)} 在 a = ${num(s0)} 处为零。标量分量与 A · B 同号。a 的系数是 ${num(sp)}，${sp > 0 ? '为正，所以 A · B 随 a 增大而增大，标量分量在 a < ' : '为负，所以 A · B 随 a 增大而减小，标量分量在 a > '}${num(s0)} 时为负。`),
        audit: { kind: 'MIT-MV-03:negative-component', params: { y: sy, b: [sp, sq] } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`A = (x, ${num(cT)}) and B = ${vec(...cB.v)} with |B| = ${cB.length}. The component of A in the direction of B equals ${num(cC)}. Find x.`, `A = (x, ${num(cT)})，B = ${vec(...cB.v)}，|B| = ${cB.length}。A 在 B 方向上的标量分量等于 ${num(cC)}。求 x。`),
        fields: [{ label: t('x', 'x'), answer: cx }],
        hint: t('Write the component as (A · B)/|B|, set it equal to the given value, and solve for x.', '把标量分量写成 (A · B)/|B|，令其等于给定值，再解 x。'),
        explanation: t(`A · B/|B| = (${par(cB.v[0])}x ${term(cT * cB.v[1])})/${cB.length} = ${num(cC)}, so ${coef(cB.v[0], 'x')} ${term(cT * cB.v[1])} = ${num(cC * cB.length)} and x = ${num(cx)}. This game checks the computation; it does not test whether you can sketch the projection.`, `A · B/|B| = (${par(cB.v[0])}x ${term(cT * cB.v[1])})/${cB.length} = ${num(cC)}，所以 ${coef(cB.v[0], 'x')} ${term(cT * cB.v[1])} = ${num(cC * cB.length)}，x = ${num(cx)}。本游戏检查计算，不检查你能否画出投影。`),
        audit: { kind: 'MIT-MV-03:challenge', params: { t: cT, b: cB.v, lb: cB.length, c: cC } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-04': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-04');
    const rows3 = (m: number[]) => `${vec(m[0], m[1], m[2])}, ${vec(m[3], m[4], m[5])} and ${vec(m[6], m[7], m[8])}`;
    const rows3zh = (m: number[]) => `${vec(m[0], m[1], m[2])}、${vec(m[3], m[4], m[5])} 与 ${vec(m[6], m[7], m[8])}`;
    const m2 = rv(g, 4, -5, 5);
    // parallelogram
    const [pA, pB] = retry(() => [rv(g, 2, -4, 4), rv(g, 2, -4, 4)], ([a, b]) => det2(a[0], a[1], b[0], b[1]) !== 0);
    const pDet = det2(pA[0], pA[1], pB[0], pB[1]), pTip = add(pA, pB);
    const paraShapes: FigureShape[] = [
      { kind: 'area', points: [[0, 0], [pA[0], pA[1]], [pTip[0], pTip[1]], [pB[0], pB[1]]] as Pt[], tone: 'accent', opacity: 0.25 },
      { kind: 'arrow', from: [0, 0], to: [pA[0], pA[1]] as Pt, tone: 'accent', label: 'A' },
      { kind: 'arrow', from: [0, 0], to: [pB[0], pB[1]] as Pt, tone: 'accent2', label: 'B' },
    ];
    // triangle
    const [tp, tq, tr] = retry(() => [rv(g, 2, -3, 4), rv(g, 2, -3, 4), rv(g, 2, -3, 4)], ([p, q, r]) => det2(q[0] - p[0], q[1] - p[1], r[0] - p[0], r[1] - p[1]) !== 0);
    const tE1 = sub(tq, tp), tE2 = sub(tr, tp), tDet = det2(tE1[0], tE1[1], tE2[0], tE2[1]);
    const triShapes: FigureShape[] = [
      { kind: 'area', points: [[tp[0], tp[1]], [tq[0], tq[1]], [tr[0], tr[1]]] as Pt[], tone: 'accent', opacity: 0.25 },
      { kind: 'point', at: [tp[0], tp[1]] as Pt, tone: 'accent', label: 'P' }, { kind: 'point', at: [tq[0], tq[1]] as Pt, tone: 'accent', label: 'Q' }, { kind: 'point', at: [tr[0], tr[1]] as Pt, tone: 'accent', label: 'R' },
    ];
    // 3x3 determinant and cofactor
    const m3 = rv(g, 9, -3, 3), d3 = det3(m3);
    const cm = rv(g, 9, -3, 3), ci = g.random(1, 3), cj = g.random(1, 3);
    const minorRows = [0, 1, 2].filter(r => r !== ci - 1), minorCols = [0, 1, 2].filter(c => c !== cj - 1);
    const minorEntries = minorRows.flatMap(r => minorCols.map(c => cm[3 * r + c]));
    const minor = det2(minorEntries[0], minorEntries[1], minorEntries[2], minorEntries[3]);
    const cofSign = (ci + cj) % 2 === 0 ? 1 : -1, cof = cofSign * minor;
    // volume
    const [vA, vB, vC] = retry(() => [rv(g, 3, -3, 3), rv(g, 3, -3, 3), rv(g, 3, -3, 3)], ([a, b, c]) => det3([...a, ...b, ...c]) !== 0);
    const vM = [...vA, ...vB, ...vC], vDet = det3(vM);
    const corner = (i: number, j: number, k: number): Pt3 => [i * vA[0] + j * vB[0] + k * vC[0], i * vA[1] + j * vB[1] + k * vC[1], i * vA[2] + j * vB[2] + k * vC[2]];
    const boxEdges: FigureShape[] = [];
    for (const [i, j, k] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) {
      if (i === 0) boxEdges.push(line3d([corner(0, j, k), corner(1, j, k)], 'muted', { width: 1 }));
      if (j === 0) boxEdges.push(line3d([corner(i, 0, k), corner(i, 1, k)], 'muted', { width: 1 }));
      if (k === 0) boxEdges.push(line3d([corner(i, j, 0), corner(i, j, 1)], 'muted', { width: 1 }));
    }
    const boxShapes: FigureShape[] = [...boxEdges, arrow3d([0, 0, 0], corner(1, 0, 0), 'accent', 'A'), arrow3d([0, 0, 0], corner(0, 1, 0), 'accent2', 'B'), arrow3d([0, 0, 0], corner(0, 0, 1), 'warn', 'C')];
    const boxFigure: Figure = g.figure({ alt: t(`A parallelepiped drawn as a skewed box with three edges A = ${vec(...vA)}, B = ${vec(...vB)}, C = ${vec(...vC)} leaving the origin.`, `用斜投影画出的平行六面体，三条从原点出发的棱是 A = ${vec(...vA)}，B = ${vec(...vB)}，C = ${vec(...vC)}。`), view: fitView(boxShapes, 0.15), shapes: boxShapes });
    // coplanar test
    const coplanar = g.random(0, 1) === 1;
    const kA = rvNonzero(g, 3, -2, 3);
    // coplanar case: C = s A + r B (any A, B); other case: A, B not parallel and C off their plane
    const kB = coplanar ? rvNonzero(g, 3, -2, 3) : retry(() => rvNonzero(g, 3, -2, 3), b => norm2(cross(kA, b)) !== 0);
    const kC = coplanar
      ? retry(() => { const ks = g.nonzero(-2, 2), kr = g.random(-2, 2); return kA.map((c, i) => ks * c + kr * kB[i]); }, c => c.some(x => x !== 0))
      : retry(() => rv(g, 3, -3, 3), c => det3([...kA, ...kB, ...c]) !== 0);
    const kM = [...kA, ...kB, ...kC], kDet = det3(kM);
    // row operations
    const rd = g.nonzero(-6, 6), rc = g.pick([-4, -3, -2, 2, 3, 4]), rk = g.pick([-4, -3, -2, 2, 3, 4]);
    // challenge: convex quadrilateral O A B C
    const cvx = (pts: number[][]) => {
      const signs = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], r = pts[(i + 2) % pts.length]; return Math.sign(det2(q[0] - p[0], q[1] - p[1], r[0] - q[0], r[1] - q[1])); });
      return signs.every(s => s !== 0 && s === signs[0]);
    };
    let qA = [1, 3], qB = [4, 3], qC = [3, -1];
    for (let tries = 0; tries < 2000; tries++) {
      const a = rv(g, 2, -3, 5), b = rv(g, 2, -3, 5), c = rv(g, 2, -3, 5);
      if (cvx([[0, 0], a, b, c])) { qA = a; qB = b; qC = c; break; }
    }
    const qPts = [[0, 0], qA, qB, qC];
    const qDetAB = det2(qA[0], qA[1], qB[0], qB[1]), qDetBC = det2(qB[0], qB[1], qC[0], qC[1]);
    const qArea2 = Math.abs(qDetAB) + Math.abs(qDetBC);
    const quadShapes: FigureShape[] = [
      { kind: 'area', points: qPts.map(p => [p[0], p[1]] as Pt), tone: 'accent', opacity: 0.25 },
      ...['O', 'A', 'B', 'C'].map((label, i): FigureShape => ({ kind: 'point', at: [qPts[i][0], qPts[i][1]] as Pt, tone: 'accent', label })),
    ];
    return [
      g.number({
        id: 'det2', title: t('A 2 × 2 determinant', '2 × 2 行列式'),
        prompt: t(`Compute the determinant of the 2 × 2 matrix with rows ${vec(m2[0], m2[1])} and ${vec(m2[2], m2[3])}.`, `计算 2 × 2 矩阵的行列式，两行分别为 ${vec(m2[0], m2[1])} 与 ${vec(m2[2], m2[3])}。`),
        fields: [{ label: t('determinant', '行列式'), answer: det2(m2[0], m2[1], m2[2], m2[3]) }],
        hint: t('Main diagonal product minus antidiagonal product: a·d − b·c.', '主对角线乘积减去反对角线乘积：a·d − b·c。'),
        explanation: t(`det = ${par(m2[0])}·${par(m2[3])} − ${par(m2[1])}·${par(m2[2])} = ${num(m2[0] * m2[3])} − ${par(m2[1] * m2[2])} = ${num(det2(m2[0], m2[1], m2[2], m2[3]))}.`, `行列式 = ${par(m2[0])}·${par(m2[3])} − ${par(m2[1])}·${par(m2[2])} = ${num(m2[0] * m2[3])} − ${par(m2[1] * m2[2])} = ${num(det2(m2[0], m2[1], m2[2], m2[3]))}。`),
        audit: { kind: 'MIT-MV-04:det2', params: { m: m2 } },
      }),
      g.number({
        id: 'parallelogram-area', title: t('Area of a parallelogram', '平行四边形的面积'),
        prompt: t(`The parallelogram has edges A = ${vec(...pA)} and B = ${vec(...pB)} drawn from the origin. Find its area (a positive number).`, `平行四边形的两条边是从原点画出的 A = ${vec(...pA)} 与 B = ${vec(...pB)}。求它的面积（正数）。`),
        figure: g.figure({ alt: t(`A shaded parallelogram with edges A = ${vec(...pA)} and B = ${vec(...pB)} from the origin.`, `阴影平行四边形，从原点出发的两条边为 A = ${vec(...pA)} 与 B = ${vec(...pB)}。`), view: { xmin: -9, xmax: 9, ymin: -9, ymax: 9 }, axes: { grid: true }, shapes: paraShapes }),
        fields: [{ label: t('area', '面积'), answer: Math.abs(pDet) }],
        hint: t('The area is the absolute value of the determinant with rows A and B; the determinant itself can be negative.', '面积是以 A、B 为行的行列式的绝对值；行列式本身可以为负。'),
        explanation: t(`det(A, B) = ${par(pA[0])}·${par(pB[1])} − ${par(pA[1])}·${par(pB[0])} = ${num(pDet)}, so the area is |${num(pDet)}| = ${Math.abs(pDet)}.`, `det(A, B) = ${par(pA[0])}·${par(pB[1])} − ${par(pA[1])}·${par(pB[0])} = ${num(pDet)}，所以面积为 |${num(pDet)}| = ${Math.abs(pDet)}。`),
        audit: { kind: 'MIT-MV-04:parallelogram-area', params: { a: pA, b: pB } },
      }),
      g.number({
        id: 'triangle-area', title: t('Area of a triangle', '三角形的面积'),
        prompt: t(`Find the area of the triangle with vertices P = ${vec(...tp)}, Q = ${vec(...tq)} and R = ${vec(...tr)}. Enter an exact fraction (a terminating decimal is also fine).`, `求顶点为 P = ${vec(...tp)}、Q = ${vec(...tq)}、R = ${vec(...tr)} 的三角形的面积。请输入精确分数（有限小数亦可）。`),
        figure: g.figure({ alt: t(`A shaded triangle with vertices P = ${vec(...tp)}, Q = ${vec(...tq)}, R = ${vec(...tr)}.`, `阴影三角形，顶点为 P = ${vec(...tp)}、Q = ${vec(...tq)}、R = ${vec(...tr)}。`), view: { xmin: -5, xmax: 6, ymin: -5, ymax: 6 }, axes: { grid: true }, shapes: triShapes }),
        fields: [{ label: t('area', '面积'), answer: Math.abs(tDet) / 2 }],
        hint: t('The triangle is half of the parallelogram spanned by the edge vectors PQ and PR.', '三角形是由边向量 PQ 与 PR 张成的平行四边形的一半。'),
        explanation: t(`PQ = ${vec(...tE1)} and PR = ${vec(...tE2)}. det(PQ, PR) = ${par(tE1[0])}·${par(tE2[1])} − ${par(tE1[1])}·${par(tE2[0])} = ${num(tDet)}. Area = ${ratio(Math.abs(tDet), 2)}.`, `PQ = ${vec(...tE1)}，PR = ${vec(...tE2)}。det(PQ, PR) = ${par(tE1[0])}·${par(tE2[1])} − ${par(tE1[1])}·${par(tE2[0])} = ${num(tDet)}。面积 = ${ratio(Math.abs(tDet), 2)}。`),
        audit: { kind: 'MIT-MV-04:triangle-area', params: { p: tp, q: tq, r: tr } },
      }),
      g.number({
        id: 'det3', title: t('A 3 × 3 determinant', '3 × 3 行列式'),
        prompt: t(`Compute the determinant of the 3 × 3 matrix with rows ${rows3(m3)}.`, `计算 3 × 3 矩阵的行列式，三行分别为 ${rows3zh(m3)}。`),
        fields: [{ label: t('determinant', '行列式'), answer: d3 }],
        hint: t('For rows (a, b, c), (d, e, f), (g, h, i), expand along the first row with signs + − +: a·(ei − fh) − b·(di − fg) + c·(dh − eg).', '设三行为 (a, b, c)、(d, e, f)、(g, h, i)，沿第一行展开，符号为 + − +：a·(ei − fh) − b·(di − fg) + c·(dh − eg)。'),
        explanation: t(`Expanding along the first row: ${par(m3[0])}·(${par(m3[4])}·${par(m3[8])} − ${par(m3[5])}·${par(m3[7])}) − ${par(m3[1])}·(${par(m3[3])}·${par(m3[8])} − ${par(m3[5])}·${par(m3[6])}) + ${par(m3[2])}·(${par(m3[3])}·${par(m3[7])} − ${par(m3[4])}·${par(m3[6])}) = ${par(m3[0])}·${par(det2(m3[4], m3[5], m3[7], m3[8]))} − ${par(m3[1])}·${par(det2(m3[3], m3[5], m3[6], m3[8]))} + ${par(m3[2])}·${par(det2(m3[3], m3[4], m3[6], m3[7]))} = ${num(d3)}.`, `沿第一行展开：${par(m3[0])}·(${par(m3[4])}·${par(m3[8])} − ${par(m3[5])}·${par(m3[7])}) − ${par(m3[1])}·(${par(m3[3])}·${par(m3[8])} − ${par(m3[5])}·${par(m3[6])}) + ${par(m3[2])}·(${par(m3[3])}·${par(m3[7])} − ${par(m3[4])}·${par(m3[6])}) = ${par(m3[0])}·${par(det2(m3[4], m3[5], m3[7], m3[8]))} − ${par(m3[1])}·${par(det2(m3[3], m3[5], m3[6], m3[8]))} + ${par(m3[2])}·${par(det2(m3[3], m3[4], m3[6], m3[7]))} = ${num(d3)}。`),
        audit: { kind: 'MIT-MV-04:det3', params: { m: m3 } },
      }),
      g.number({
        id: 'cofactor', title: t('A cofactor', '代数余子式'),
        prompt: t(`The 3 × 3 matrix has rows ${rows3(cm)}. Find the cofactor of the entry in row ${ci}, column ${cj}: delete that row and column, take the 2 × 2 determinant (the minor), and attach the sign from the checkerboard pattern + − + / − + − / + − +.`, `3 × 3 矩阵的三行为 ${rows3zh(cm)}。求第 ${ci} 行第 ${cj} 列元素的代数余子式：划去该行与该列，计算余下 2 × 2 行列式（余子式），再按棋盘符号 + − + / − + − / + − + 加上正负号。`),
        fields: [{ label: t('cofactor', '代数余子式'), answer: cof }],
        hint: t(`The sign is (−1) raised to (row + column): ${cofSign > 0 ? 'here row + column is even, so the sign is +' : 'here row + column is odd, so the sign is −'}.`, `符号为 (−1) 的（行号 + 列号）次方：${cofSign > 0 ? '这里行号 + 列号为偶数，符号为 +' : '这里行号 + 列号为奇数，符号为 −'}。`),
        explanation: t(`Deleting row ${ci} and column ${cj} leaves rows ${vec(minorEntries[0], minorEntries[1])} and ${vec(minorEntries[2], minorEntries[3])}, whose minor is ${par(minorEntries[0])}·${par(minorEntries[3])} − ${par(minorEntries[1])}·${par(minorEntries[2])} = ${num(minor)}. The checkerboard sign is ${cofSign > 0 ? '+' : '−'}, so the cofactor is ${num(cof)}.`, `划去第 ${ci} 行第 ${cj} 列后剩下两行 ${vec(minorEntries[0], minorEntries[1])} 与 ${vec(minorEntries[2], minorEntries[3])}，余子式为 ${par(minorEntries[0])}·${par(minorEntries[3])} − ${par(minorEntries[1])}·${par(minorEntries[2])} = ${num(minor)}。棋盘符号为 ${cofSign > 0 ? '+' : '−'}，所以代数余子式为 ${num(cof)}。`),
        audit: { kind: 'MIT-MV-04:cofactor', params: { m: cm, i: ci, j: cj } },
      }),
      g.number({
        id: 'volume', title: t('Volume of a parallelepiped', '平行六面体的体积'),
        prompt: t(`A parallelepiped has edges given by the origin vectors A = ${vec(...vA)}, B = ${vec(...vB)}, C = ${vec(...vC)}. Find its volume (a positive number).`, `平行六面体的棱由原点向量 A = ${vec(...vA)}、B = ${vec(...vB)}、C = ${vec(...vC)} 给出。求它的体积（正数）。`),
        figure: boxFigure,
        fields: [{ label: t('volume', '体积'), answer: Math.abs(vDet) }],
        hint: t('The volume is the absolute value of the 3 × 3 determinant whose rows are A, B, C.', '体积是以 A、B、C 为行的 3 × 3 行列式的绝对值。'),
        explanation: t(`det(A, B, C) = ${par(vA[0])}·${par(det2(vB[1], vB[2], vC[1], vC[2]))} − ${par(vA[1])}·${par(det2(vB[0], vB[2], vC[0], vC[2]))} + ${par(vA[2])}·${par(det2(vB[0], vB[1], vC[0], vC[1]))} = ${num(vDet)}, so the volume is ${Math.abs(vDet)}.`, `det(A, B, C) = ${par(vA[0])}·${par(det2(vB[1], vB[2], vC[1], vC[2]))} − ${par(vA[1])}·${par(det2(vB[0], vB[2], vC[0], vC[2]))} + ${par(vA[2])}·${par(det2(vB[0], vB[1], vC[0], vC[1]))} = ${num(vDet)}，所以体积为 ${Math.abs(vDet)}。`),
        audit: { kind: 'MIT-MV-04:volume', params: { a: vA, b: vB, c: vC } },
      }),
      g.choice({
        id: 'coplanar', title: t('Do three vectors lie in a plane?', '三个向量共面吗？'),
        prompt: t(`Do the origin vectors A = ${vec(...kA)}, B = ${vec(...kB)} and C = ${vec(...kC)} all lie in one plane through the origin?`, `原点向量 A = ${vec(...kA)}、B = ${vec(...kB)}、C = ${vec(...kC)} 是否都在过原点的同一个平面内？`),
        fixedOrder: true,
        options: [
          t('Yes: the determinant is 0, so the parallelepiped is flat (volume 0).', '是：行列式为 0，所以平行六面体是扁平的（体积为 0）。'),
          t('No: the determinant is not 0, so the parallelepiped has positive volume.', '不是：行列式不为 0，所以平行六面体体积为正。'),
          t('It cannot be decided without knowing the angles between the vectors.', '不知道向量之间的夹角，就无法判断。'),
        ], correct: kDet === 0 ? 0 : 1,
        hint: t('Compute det(A, B, C). Zero volume means the three edges do not span a solid.', '计算 det(A, B, C)。体积为零说明三条棱张不出立体。'),
        explanation: t(`det(A, B, C) = ${par(kA[0])}·${par(det2(kB[1], kB[2], kC[1], kC[2]))} − ${par(kA[1])}·${par(det2(kB[0], kB[2], kC[0], kC[2]))} + ${par(kA[2])}·${par(det2(kB[0], kB[1], kC[0], kC[1]))} = ${num(kDet)}. ${kDet === 0 ? 'It is 0, so the three vectors lie in a plane.' : 'It is not 0, so the three vectors span a genuine parallelepiped and do not lie in a plane.'}`, `det(A, B, C) = ${par(kA[0])}·${par(det2(kB[1], kB[2], kC[1], kC[2]))} − ${par(kA[1])}·${par(det2(kB[0], kB[2], kC[0], kC[2]))} + ${par(kA[2])}·${par(det2(kB[0], kB[1], kC[0], kC[1]))} = ${num(kDet)}。${kDet === 0 ? '它为 0，所以三个向量共面。' : '它不为 0，所以三个向量张成真正的平行六面体，不共面。'}`),
        audit: { kind: 'MIT-MV-04:coplanar', params: { a: kA, b: kB, c: kC } },
      }),
      g.number({
        id: 'row-operations', title: t('Row operations and the determinant', '行变换与行列式'),
        prompt: t(`A 3 × 3 matrix M has det M = ${num(rd)}. Form N from M by swapping rows 1 and 2, then multiplying row 3 by ${num(rc)}, then adding ${par(rk)} times row 1 to row 2. Find det N.`, `3 × 3 矩阵 M 的 det M = ${num(rd)}。由 M 得到 N：先交换第 1、2 行，再把第 3 行乘以 ${num(rc)}，最后把第 1 行的 ${par(rk)} 倍加到第 2 行。求 det N。`),
        fields: [{ label: t('det N', 'det N'), answer: -rc * rd }],
        hint: t('Swapping two rows multiplies the determinant by −1; scaling a row by c multiplies it by c; adding a multiple of one row to another changes nothing.', '交换两行使行列式乘以 −1；把一行乘以 c 使行列式乘以 c；把一行的倍数加到另一行不改变行列式。'),
        explanation: t(`Swap: ${num(rd)} → ${num(-rd)}. Scale row 3 by ${num(rc)}: ${num(-rd)}·${par(rc)} = ${num(-rc * rd)}. Adding a multiple of row 1 to row 2 leaves it unchanged. So det N = ${num(-rc * rd)}.`, `交换：${num(rd)} → ${num(-rd)}。第 3 行乘以 ${num(rc)}：${num(-rd)}·${par(rc)} = ${num(-rc * rd)}。把第 1 行的倍数加到第 2 行不改变行列式。所以 det N = ${num(-rc * rd)}。`),
        audit: { kind: 'MIT-MV-04:row-operations', params: { d: rd, c: rc, k: rk } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`The convex quadrilateral OABC has vertices, in order, O = (0, 0), A = ${vec(...qA)}, B = ${vec(...qB)} and C = ${vec(...qC)}. Find its area. Enter an exact fraction (a terminating decimal is also fine).`, `凸四边形 OABC 的顶点依次为 O = (0, 0)、A = ${vec(...qA)}、B = ${vec(...qB)}、C = ${vec(...qC)}。求它的面积。请输入精确分数（有限小数亦可）。`),
        figure: g.figure({ alt: t(`A shaded convex quadrilateral with vertices O = (0, 0), A = ${vec(...qA)}, B = ${vec(...qB)}, C = ${vec(...qC)} in this order.`, `阴影凸四边形，顶点依次为 O = (0, 0)、A = ${vec(...qA)}、B = ${vec(...qB)}、C = ${vec(...qC)}。`), view: { xmin: -6, xmax: 7, ymin: -6, ymax: 7 }, axes: { grid: true }, shapes: quadShapes }),
        fields: [{ label: t('area', '面积'), answer: qArea2 / 2 }],
        hint: t('Cut the quadrilateral along the diagonal OB into two triangles that each have a vertex at the origin.', '沿对角线 OB 把四边形切成两个以原点为顶点的三角形。'),
        explanation: t(`Triangle OAB: ½|det(A, B)| = ½|${num(qDetAB)}| = ${frac(Math.abs(qDetAB), 2)}. Triangle OBC: ½|det(B, C)| = ½|${num(qDetBC)}| = ${frac(Math.abs(qDetBC), 2)}. Total area = ${frac(qArea2, 2)}. This game checks computation; it does not test the proof that a determinant equals an area or sketching skill.`, `三角形 OAB：½|det(A, B)| = ½|${num(qDetAB)}| = ${frac(Math.abs(qDetAB), 2)}。三角形 OBC：½|det(B, C)| = ½|${num(qDetBC)}| = ${frac(Math.abs(qDetBC), 2)}。总面积 = ${frac(qArea2, 2)}。本游戏检查计算，不检查“行列式等于面积”的证明或作图能力。`),
        audit: { kind: 'MIT-MV-04:challenge', params: { a: qA, b: qB, c: qC } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-05': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-05');
    const crossText = (a: number[], b: number[]) => `(${par(a[1])}·${par(b[2])} − ${par(a[2])}·${par(b[1])}, ${par(a[2])}·${par(b[0])} − ${par(a[0])}·${par(b[2])}, ${par(a[0])}·${par(b[1])} − ${par(a[1])}·${par(b[0])})`;
    // cross product
    const [xA, xB] = retry(() => [rv(g, 3, -3, 3), rv(g, 3, -3, 3)], ([a, b]) => norm2(cross(a, b)) !== 0);
    const xN = cross(xA, xB);
    // planar i, j form
    const [ps, pt, pu, pv] = [g.nonzero(-4, 4), g.nonzero(-4, 4), g.nonzero(-4, 4), g.nonzero(-4, 4)];
    const pAns = ps * pv - pt * pu;
    // non-associativity
    const units = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], names = ['i', 'j', 'k'];
    const ui = g.random(0, 2), vi = retry(() => g.random(0, 2), c => c !== ui);
    const nameOf = (v: number[]) => { const idx = v.findIndex(c => c !== 0); return idx < 0 ? '0' : `${v[idx] < 0 ? '−' : ''}${names[idx]}`; };
    const uv = cross(units[ui], units[vi]), first = cross(uv, units[vi]), second = cross(units[ui], cross(units[vi], units[vi]));
    // direction in the plane
    const [dA, dB] = retry(() => [rv(g, 2, -4, 4), rv(g, 2, -4, 4)], ([a, b]) => det2(a[0], a[1], b[0], b[1]) !== 0);
    const dZ = det2(dA[0], dA[1], dB[0], dB[1]);
    const dirShapes: FigureShape[] = [
      { kind: 'arrow', from: [0, 0], to: [dA[0], dA[1]] as Pt, tone: 'accent', label: 'A' },
      { kind: 'arrow', from: [0, 0], to: [dB[0], dB[1]] as Pt, tone: 'accent2', label: 'B' },
      { kind: 'point', at: [0, 0], tone: 'muted', label: 'O' },
    ];
    // parallelogram area with integer length
    /** Vectors whose cross product has integer length and at least two nonzero components (so the picture is not flat). */
    const squareCross = (lo: number, hi: number) => retry(() => ({ a: rv(g, 3, lo, hi), b: rv(g, 3, lo, hi) }), ({ a, b }) => {
      const n = cross(a, b), n2 = norm2(n);
      return n2 > 0 && isSquare(n2) && n.filter(c => c !== 0).length >= 2;
    });
    const par1 = squareCross(-3, 3), parN = cross(par1.a, par1.b), parLen = Math.round(Math.sqrt(norm2(parN)));
    const tri1 = squareCross(-3, 3), triN = cross(tri1.a, tri1.b), triLen = Math.round(Math.sqrt(norm2(triN)));
    const parCorner = [[0, 0, 0], par1.a, add(par1.a, par1.b), par1.b] as unknown as Pt3[];
    const parShapes: FigureShape[] = [
      { kind: 'area', points: parCorner.map(project3d), tone: 'accent', opacity: 0.25 },
      ...axes3d(3), arrow3d([0, 0, 0], par1.a as unknown as Pt3, 'accent', 'A'), arrow3d([0, 0, 0], par1.b as unknown as Pt3, 'accent2', 'B'),
    ];
    // Lagrange identity
    const lag = g.pick([[2, 5, 6, 8], [5, 2, 8, 6], [5, 5, 7, 24], [5, 5, 15, 20], [3, 5, 9, 12], [5, 3, 12, 9], [4, 5, 12, 16], [2, 13, 10, 24], [13, 2, 10, 24], [10, 2, 12, 16], [2, 10, 12, 16], [5, 6, 18, 24], [6, 5, 24, 18], [3, 10, 18, 24], [5, 7, 21, 28], [7, 5, 28, 21], [5, 8, 24, 32], [3, 13, 15, 36]]);
    const lagDot = g.random(0, 1) ? lag[2] : -lag[2];
    // parallel counterexample for the zero-product card
    const zA = rvNonzero(g, 3, -2, 3), zk = g.pick([-3, -2, 2, 3]), zB = zA.map(c => zk * c);
    // challenge: general triangle, exact radical
    const [cP, cQ, cR] = retry(() => [rv(g, 3, -2, 3), rv(g, 3, -2, 3), rv(g, 3, -2, 3)], ([p, q, r]) => norm2(cross(sub(q, p), sub(r, p))) !== 0);
    const cE1 = sub(cQ, cP), cE2 = sub(cR, cP), cN = cross(cE1, cE2), cN2 = norm2(cN);
    return [
      g.number({
        id: 'cross', title: t('Compute A × B', '计算 A × B'),
        prompt: t(`A = ${vec(...xA)} and B = ${vec(...xB)}. Compute the cross product A × B.`, `A = ${vec(...xA)}，B = ${vec(...xB)}。计算叉积 A × B。`),
        fields: xN.map((c, i) => ({ label: comp3[i], answer: c })),
        hint: t('Use the determinant pattern: i-component a₂b₃ − a₃b₂, j-component a₃b₁ − a₁b₃, k-component a₁b₂ − a₂b₁.', '用行列式的规律：i 分量 a₂b₃ − a₃b₂，j 分量 a₃b₁ − a₁b₃，k 分量 a₁b₂ − a₂b₁。'),
        explanation: t(`A × B = ${crossText(xA, xB)} = ${vec(...xN)}.`, `A × B = ${crossText(xA, xB)} = ${vec(...xN)}。`),
        audit: { kind: 'MIT-MV-05:cross', params: { a: xA, b: xB } },
      }),
      g.number({
        id: 'planar', title: t('Cross products of i and j', 'i 与 j 的叉积'),
        prompt: t(`Compute (${linear([ps, pt], ['i', 'j'])}) × (${linear([pu, pv], ['i', 'j'])}). The result is c k. Find c. Use i × j = k.`, `计算 (${linear([ps, pt], ['i', 'j'])}) × (${linear([pu, pv], ['i', 'j'])})。结果为 c k。求 c。已知 i × j = k。`),
        fields: [{ label: t('c', 'c'), answer: pAns }],
        hint: t('Expand with the distributive law. Then i × i = j × j = 0, i × j = k and j × i = −k.', '用分配律展开。再用 i × i = j × j = 0，i × j = k，j × i = −k。'),
        explanation: t(`${par(ps)}·${par(pu)}(i × i) + ${par(ps)}·${par(pv)}(i × j) + ${par(pt)}·${par(pu)}(j × i) + ${par(pt)}·${par(pv)}(j × j) = (${par(ps)}·${par(pv)} − ${par(pt)}·${par(pu)}) k = ${num(pAns)} k. So c = ${num(pAns)}.`, `${par(ps)}·${par(pu)}(i × i) + ${par(ps)}·${par(pv)}(i × j) + ${par(pt)}·${par(pu)}(j × i) + ${par(pt)}·${par(pv)}(j × j) = (${par(ps)}·${par(pv)} − ${par(pt)}·${par(pu)}) k = ${num(pAns)} k。所以 c = ${num(pAns)}。`),
        audit: { kind: 'MIT-MV-05:planar', params: { a: [ps, pt], b: [pu, pv] } },
      }),
      g.choice({
        id: 'non-associative', title: t('Is the cross product associative?', '叉积满足结合律吗？'),
        prompt: t(`For the unit vectors u = ${names[ui]} and v = ${names[vi]}, compare (u × v) × v with u × (v × v). Which statement is correct?`, `对单位向量 u = ${names[ui]}、v = ${names[vi]}，比较 (u × v) × v 与 u × (v × v)。哪个说法正确？`),
        options: [
          t(`They differ: (u × v) × v = ${nameOf(first)}, but u × (v × v) = ${nameOf(second)}. The cross product is not associative.`, `它们不相等：(u × v) × v = ${nameOf(first)}，而 u × (v × v) = ${nameOf(second)}。叉积不满足结合律。`),
          t(`They are equal, both ${nameOf(first)}, so the cross product is associative.`, `它们相等，都是 ${nameOf(first)}，所以叉积满足结合律。`),
          t('They are equal, both 0, because u × v is perpendicular to u and v.', '它们相等，都是 0，因为 u × v 垂直于 u 与 v。'),
        ], correct: 0,
        hint: t('Compute u × v first (cyclic rule: i × j = k, j × k = i, k × i = j, and reversing the order flips the sign). Also v × v = 0.', '先算 u × v（循环规则：i × j = k，j × k = i，k × i = j，交换顺序变号）。另外 v × v = 0。'),
        explanation: t(`u × v = ${nameOf(uv)}, so (u × v) × v = ${nameOf(uv)} × ${names[vi]} = ${nameOf(first)}. On the other side v × v = 0, so u × (v × v) = 0. The two sides differ, so (A × B) × C = A × (B × C) is false in general: brackets matter.`, `u × v = ${nameOf(uv)}，所以 (u × v) × v = ${nameOf(uv)} × ${names[vi]} = ${nameOf(first)}。另一边 v × v = 0，所以 u × (v × v) = 0。两边不同，故 (A × B) × C = A × (B × C) 一般不成立：括号的位置很重要。`),
      }),
      g.number({
        id: 'parallelogram-area', title: t('Area of a parallelogram in space', '空间平行四边形的面积'),
        prompt: t(`The parallelogram has edges A = ${vec(...par1.a)} and B = ${vec(...par1.b)} drawn from the origin. Find its area. It is a whole number.`, `平行四边形的两条边是从原点画出的 A = ${vec(...par1.a)} 与 B = ${vec(...par1.b)}。求它的面积，结果是整数。`),
        figure: g.figure({ alt: t(`A shaded parallelogram in space with edges A = ${vec(...par1.a)} and B = ${vec(...par1.b)} leaving the origin, drawn with the coordinate axes.`, `空间中的阴影平行四边形，从原点出发的两条边为 A = ${vec(...par1.a)} 与 B = ${vec(...par1.b)}，并画出坐标轴。`), view: fitView(parShapes, 0.15), shapes: parShapes }),
        fields: [{ label: t('area', '面积'), answer: parLen }],
        hint: t('The area equals |A × B|. Compute the cross product first, then its length.', '面积等于 |A × B|。先算叉积，再求它的长度。'),
        explanation: t(`A × B = ${crossText(par1.a, par1.b)} = ${vec(...parN)}, so the area is |A × B| = √${norm2(parN)} = ${parLen}.`, `A × B = ${crossText(par1.a, par1.b)} = ${vec(...parN)}，所以面积为 |A × B| = √${norm2(parN)} = ${parLen}。`),
        audit: { kind: 'MIT-MV-05:parallelogram-area', params: { a: par1.a, b: par1.b } },
      }),
      g.number({
        id: 'lagrange', title: t('Length of A × B from lengths and the dot product', '由长度和点积求 |A × B|'),
        prompt: t(`|A| = ${lag[0]}, |B| = ${lag[1]} and A · B = ${num(lagDot)}. Use |A × B|² = |A|²|B|² − (A · B)² to find |A × B|. It is a whole number.`, `|A| = ${lag[0]}，|B| = ${lag[1]}，A · B = ${num(lagDot)}。用 |A × B|² = |A|²|B|² − (A · B)² 求 |A × B|，结果是整数。`),
        fields: [{ label: t('|A × B|', '|A × B|'), answer: lag[3] }],
        hint: t('Substitute into the identity and take a square root. The result is a length, so it is positive.', '代入恒等式再开平方。结果是长度，所以为正。'),
        explanation: t(`|A × B|² = ${lag[0]}²·${lag[1]}² − ${par(lagDot)}² = ${lag[0] * lag[0] * lag[1] * lag[1]} − ${lagDot * lagDot} = ${lag[3] * lag[3]}, so |A × B| = ${lag[3]}. (Equivalently |A||B| sin θ with sin θ = ${frac(lag[3], lag[0] * lag[1])}.)`, `|A × B|² = ${lag[0]}²·${lag[1]}² − ${par(lagDot)}² = ${lag[0] * lag[0] * lag[1] * lag[1]} − ${lagDot * lagDot} = ${lag[3] * lag[3]}，所以 |A × B| = ${lag[3]}。（等价地，|A||B| sin θ，其中 sin θ = ${frac(lag[3], lag[0] * lag[1])}。）`),
        audit: { kind: 'MIT-MV-05:lagrange', params: { la: lag[0], lb: lag[1], d: lagDot } },
      }),
      g.choice({
        id: 'direction', title: t('The direction of A × B', 'A × B 的方向'),
        prompt: t(`A = ${vec(dA[0], dA[1], 0)} and B = ${vec(dB[0], dB[1], 0)} lie in the xy-plane. The picture looks down on the plane from the +z axis (x to the right, y up, +z pointing toward you). Which statement about A × B is correct, by the right-hand rule?`, `A = ${vec(dA[0], dA[1], 0)} 与 B = ${vec(dB[0], dB[1], 0)} 位于 xy 平面内。图是从 +z 轴方向俯视该平面（x 向右，y 向上，+z 指向读者）。按右手定则，关于 A × B 哪个说法正确？`),
        figure: g.figure({ alt: t(`Arrows A = ${vec(dA[0], dA[1])} and B = ${vec(dB[0], dB[1])} from the origin in the xy-plane, seen from above.`, `在 xy 平面内从原点出发的箭头 A = ${vec(dA[0], dA[1])} 与 B = ${vec(dB[0], dB[1])}，俯视图。`), view: { xmin: -6, xmax: 6, ymin: -6, ymax: 6 }, axes: { grid: true }, shapes: dirShapes }),
        fixedOrder: true,
        options: [t('A × B points in the +z direction (toward you).', 'A × B 沿 +z 方向（指向读者）。'), t('A × B points in the −z direction (away from you).', 'A × B 沿 −z 方向（背向读者）。'), t('A × B = 0.', 'A × B = 0。')],
        correct: dZ > 0 ? 0 : 1,
        hint: t('Curl the fingers of your right hand from A toward B (through the smaller angle); your thumb gives the direction. Or compute the z-component a₁b₂ − a₂b₁.', '右手四指从 A 经较小的角转向 B，拇指所指就是方向。也可以算 z 分量 a₁b₂ − a₂b₁。'),
        explanation: t(`A × B = (0, 0, ${par(dA[0])}·${par(dB[1])} − ${par(dA[1])}·${par(dB[0])}) = (0, 0, ${num(dZ)}). The z-component is ${dZ > 0 ? 'positive: B is counterclockwise from A, so the thumb points toward you (+z).' : 'negative: B is clockwise from A, so the thumb points away from you (−z).'} The vector is not zero because A and B are not parallel.`, `A × B = (0, 0, ${par(dA[0])}·${par(dB[1])} − ${par(dA[1])}·${par(dB[0])}) = (0, 0, ${num(dZ)})。z 分量${dZ > 0 ? '为正：B 在 A 的逆时针一侧，拇指指向读者（+z）。' : '为负：B 在 A 的顺时针一侧，拇指背向读者（−z）。'}因为 A 与 B 不平行，所以向量不为零。`),
        audit: { kind: 'MIT-MV-05:direction', params: { a: dA, b: dB } },
      }),
      g.number({
        id: 'triangle-area', title: t('Area of a triangle in space', '空间三角形的面积'),
        prompt: t(`The triangle has vertices O = (0, 0, 0), P = ${vec(...tri1.a)} and Q = ${vec(...tri1.b)}. Find its area. Enter an exact fraction (a terminating decimal is also fine).`, `三角形的顶点为 O = (0, 0, 0)、P = ${vec(...tri1.a)}、Q = ${vec(...tri1.b)}。求它的面积。请输入精确分数（有限小数亦可）。`),
        fields: [{ label: t('area', '面积'), answer: triLen / 2 }],
        hint: t('The triangle is half of the parallelogram spanned by OP and OQ.', '三角形是由 OP 与 OQ 张成的平行四边形的一半。'),
        explanation: t(`OP × OQ = ${crossText(tri1.a, tri1.b)} = ${vec(...triN)}, with length √${norm2(triN)} = ${triLen}. The triangle has half that area: ${frac(triLen, 2)}.`, `OP × OQ = ${crossText(tri1.a, tri1.b)} = ${vec(...triN)}，长度为 √${norm2(triN)} = ${triLen}。三角形面积是它的一半：${frac(triLen, 2)}。`),
        audit: { kind: 'MIT-MV-05:triangle-area', params: { p: tri1.a, q: tri1.b } },
      }),
      g.choice({
        id: 'zero-cross', title: t('What does A × B = 0 say?', 'A × B = 0 说明什么？'),
        prompt: t('Suppose A × B = 0. Which conclusion is justified?', '设 A × B = 0。哪个结论成立？'),
        options: [t('A and B are parallel, or at least one of them is the zero vector.', 'A 与 B 平行，或二者之一是零向量。'), t('A = 0 and B = 0.', 'A = 0 且 B = 0。'), t('A is perpendicular to B.', 'A 垂直于 B。')],
        correct: 0,
        hint: t('Use |A × B| = |A||B| sin θ and ask when a product of numbers can be zero.', '用 |A × B| = |A||B| sin θ，想想乘积何时为零。'),
        explanation: t(`|A × B| = |A||B| sin θ is zero if a length is zero or sin θ = 0 (θ = 0 or π, i.e. parallel). For example A = ${vec(...zA)} and B = ${vec(...zB)} are nonzero, yet A × B = ${crossText(zA, zB)} = (0, 0, 0). Perpendicular vectors have sin θ = 1, not 0.`, `|A × B| = |A||B| sin θ 为零，当且仅当某个长度为零，或 sin θ = 0（θ = 0 或 π，即平行）。例如 A = ${vec(...zA)} 与 B = ${vec(...zB)} 都不是零向量，但 A × B = ${crossText(zA, zB)} = (0, 0, 0)。垂直的向量 sin θ = 1，不是 0。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Find the area of the triangle with vertices P = ${vec(...cP)}, Q = ${vec(...cQ)} and R = ${vec(...cR)}. Enter the exact value, for example 5/2, sqrt(7)/2 or 3√5/2.`, `求顶点为 P = ${vec(...cP)}、Q = ${vec(...cQ)}、R = ${vec(...cR)} 的三角形的面积。请输入精确值，例如 5/2、sqrt(7)/2 或 3√5/2。`),
        fields: [{ label: t('area (exact)', '面积（精确值）'), answer: Math.sqrt(cN2) / 2 }],
        hint: t('Take two edge vectors from one vertex, cross them, and halve the length.', '从一个顶点引出两条边向量，作叉积，再取长度的一半。'),
        explanation: t(`PQ = ${vec(...cE1)} and PR = ${vec(...cE2)}. PQ × PR = ${vec(...cN)}, with |PQ × PR|² = ${cN2}. Area = ½√${cN2} = ${halfRoot(cN2)}. This game checks computation; a correct number does not show that you can picture the right-hand rule or sketch the triangle.`, `PQ = ${vec(...cE1)}，PR = ${vec(...cE2)}。PQ × PR = ${vec(...cN)}，|PQ × PR|² = ${cN2}。面积 = ½√${cN2} = ${halfRoot(cN2)}。本游戏检查计算；答案正确并不说明你能想象右手定则或画出这个三角形。`),
        audit: { kind: 'MIT-MV-05:challenge', params: { p: cP, q: cQ, r: cR } },
      }),
    ];
  },
};
