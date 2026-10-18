import { ellipse, fitView, sampleCurve, type FigureShape, type Pt } from '../figure';
import { coef, frac, gcd, linear, makeMvDeck, num, par, term, vec, type GeneratorMap } from './support';

/**
 * Batch 3: MIT-MV-12 Parametric Curves (cycloid, cusp), MIT-MV-13 Velocity, Acceleration and Arc Length,
 * MIT-MV-14 Kepler's Second Law, MIT-MV-15 Unit 1 Review (thin evidence), MIT-MV-16 Exam 1.
 * Facts follow content/mit-multivariable-calculus/sources/{12,13,14,15,16}-*.txt. Audit notes: audit-notes/batch03.md.
 */
type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string) => [en, zh] as const;
const PI = Math.PI;

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
const nz = (x: number) => (x === 0 ? 0 : x);
const isqrt = (n: number) => Math.round(Math.sqrt(n));
const products = (a: number[], b: number[]) => a.map((x, i) => `${par(x)}·${par(b[i])}`).join(' + ');
/** a·π/b as text: piText(3) = "3π", piText(1, 2) = "π/2", piText(6, 4) = "3π/2". */
const piText = (n: number, d = 1) => {
  const k = gcd(n, d); n /= k; d /= k;
  const top = n === 1 ? 'π' : `${n}π`;
  return d === 1 ? top : `${top}/${d}`;
};

const det2 = (a: number, b: number, c: number, d: number) => a * d - b * c;
const det3 = (m: number[][]) => m[0][0] * det2(m[1][1], m[1][2], m[2][1], m[2][2]) - m[0][1] * det2(m[1][0], m[1][2], m[2][0], m[2][2]) + m[0][2] * det2(m[1][0], m[1][1], m[2][0], m[2][1]);
/** Cofactor matrix C[i][j] = (−1)^(i+j) · minor(i, j). The adjugate is its transpose and M⁻¹ = adj(M) / det M. */
const cofactors = (m: number[][]) => m.map((_, i) => m[i].map((__, j) => {
  const r = [0, 1, 2].filter(x => x !== i), c = [0, 1, 2].filter(x => x !== j);
  const minor = det2(m[r[0]][c[0]], m[r[0]][c[1]], m[r[1]][c[0]], m[r[1]][c[1]]);
  return nz((i + j) % 2 ? -minor : minor);
}));
const adjugate = (m: number[][]) => { const c = cofactors(m); return m.map((_, i) => m.map((__, j) => c[j][i])); };
const rowsLines = (m: number[][]) => m.map((row, i) => t(`Row ${i + 1} of M: ${vec(...row)}`, `M 的第 ${i + 1} 行：${vec(...row)}`));

/** (x, y, z) with integer length: a Pythagorean quadruple, permuted and signed. */
const QUADS: [number, number, number, number][] = [[1, 2, 2, 3], [2, 3, 6, 7], [2, 6, 9, 11], [4, 4, 7, 9], [1, 4, 8, 9], [2, 10, 11, 15]];
const integerLengthVector = (g: Deck) => {
  const [x, y, z, length] = g.pick(QUADS);
  const v = [x, y, z];
  for (let i = 2; i > 0; i--) { const j = g.random(0, i); [v[i], v[j]] = [v[j], v[i]]; }
  return { v: v.map(c => (g.random(0, 1) ? c : -c)), length };
};
/** A triangle PQR (all coordinates small integers) with PQ × PR ≠ 0; when `perfect`, |PQ × PR| is a whole number. */
const sampleTriangle = (g: Deck, perfect: boolean) => {
  for (let i = 0; i < 4000; i++) {
    const P = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)], Q = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)], R = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
    const N = cross(sub(Q, P), sub(R, P));
    if (N.every(c => c === 0)) continue;
    const m = isqrt(dot(N, N));
    if (perfect && m * m !== dot(N, N)) continue;
    return { P, Q, R, N, m };
  }
  return { P: [1, 1, 1], Q: [0, 3, 1], R: [0, 1, 4], N: [6, 3, 2], m: 7 };
};
/** A 3x3 integer matrix with 0 < |det| <= maxDet. */
const sampleMatrix = (g: Deck, maxDet: number) => {
  for (let i = 0; i < 4000; i++) {
    const m = [0, 1, 2].map(() => [0, 1, 2].map(() => g.random(-2, 3)));
    const D = det3(m);
    if (D !== 0 && Math.abs(D) <= maxDet) return m;
  }
  return [[1, 2, 3], [3, 2, 1], [2, -1, -1]];
};
const sys = (m: number[][], rhs: number[]) => m.map((row, i) => `${linear(row, ['x', 'y', 'z'])} = ${num(rhs[i])}`);

export const batch03Generators: GeneratorMap = {
  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-12': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-12');
    const a = g.random(2, 5);
    const k = g.random(1, 3);
    const VC = g.pick([{ p: 1, q: 2, c: 0, s: 1 }, { p: 1, q: 1, c: -1, s: 0 }, { p: 3, q: 2, c: 0, s: -1 }]);
    const SC = g.pick([
      { p: 1, q: 3, m: 1, cos: '1/2', sin: '√3/2', v: `(${a}/2, ${a}√3/2)` },
      { p: 1, q: 1, m: 4, cos: '−1', sin: '0', v: `(${2 * a}, 0)` },
      { p: 2, q: 3, m: 3, cos: '−1/2', sin: '√3/2', v: `(${3 * a}/2, ${a}√3/2)` },
      { p: 5, q: 3, m: 1, cos: '1/2', sin: '−√3/2', v: `(${a}/2, −${a}√3/2)` },
    ]);
    const K = g.random(2, 4), nCusp = 2 * K;
    const kc = g.random(1, 3);
    const n = g.random(1, 3);
    const R = g.random(1, 4), u = 4 * g.random(1, 3), w = 4 * g.nonzero(-3, 3), rev = g.pick([1, 3]), time = g.pick([{ tn: 1, td: 4 }, { tn: 1, td: 2 }]);

    const cosK = k % 2 ? -1 : 1, yK = a * (1 - cosK);
    const vx = a * (1 - VC.c), vy = a * VC.s;
    const speedFactor = SC.m === 1 ? 1 : SC.m === 4 ? 2 : Math.sqrt(3);
    const speedText = SC.m === 1 ? `${a}` : SC.m === 4 ? `${2 * a}` : `${a}√3`;
    const sgn = kc % 2 ? -1 : 1;

    const cycloid = (arches: number, aa: number): FigureShape[] => [
      { kind: 'line', points: sampleCurve(s => [aa * (s - Math.sin(s)), aa * (1 - Math.cos(s))] as Pt, 0, 2 * arches * PI, 80 * arches), tone: 'accent', width: 2 },
      ...Array.from({ length: arches + 1 }, (_, j): FigureShape => ({ kind: 'point', at: [2 * PI * aa * j, 0], tone: 'accent2' })),
    ];

    // challenge: quarter turns q, phase angle q·π/2
    const q = 4 * rev * time.tn / time.td;
    const cosC = [1, 0, -1, 0][q % 4], sinC = [0, 1, 0, -1][q % 4];
    const cx = u * time.tn / time.td, cy = w * time.tn / time.td;
    const tText = `${time.tn}/${time.td}`;

    return [
      g.number({
        id: 'position', title: t('Position on the rolling wheel', '滚动车轮上的点'),
        prompt: t(`A wheel of radius a = ${a} rolls without slipping along the x-axis. The point P on its rim starts at the origin. After the wheel has turned through θ radians, its center is C = (aθ, a) and CP = (−a sin θ, −a cos θ). Find P = OC + CP at θ = ${piText(k)}.`, `半径 a = ${a} 的车轮沿 x 轴无滑动地滚动，轮缘上的点 P 从原点出发。车轮转过 θ 弧度后，圆心为 C = (aθ, a)，CP = (−a sin θ, −a cos θ)。求 θ = ${piText(k)} 时 P = OC + CP 的坐标。`),
        fields: [{ label: t('x', 'x'), answer: a * k * PI }, { label: t('y', 'y'), answer: yK }],
        hint: t('Add the two vectors: the center moves by aθ along the x-axis, and CP comes from sin θ and cos θ at this θ. Enter x as a multiple of π, e.g. 6pi.', '把两个向量相加：圆心沿 x 轴移动 aθ，CP 由此 θ 处的 sin θ、cos θ 决定。x 以 π 的倍数输入，例如 6pi。'),
        explanation: t(`At θ = ${piText(k)}: sin θ = 0 and cos θ = ${num(cosK)}. So OC = (${a}·${piText(k)}, ${a}) = (${a * k}π, ${a}) and CP = (0, ${num(-a * cosK)}). Hence P = (${a * k}π, ${a} ${term(-a * cosK)}) = (${a * k}π, ${yK}).`, `θ = ${piText(k)} 时：sin θ = 0，cos θ = ${num(cosK)}。所以 OC = (${a}·${piText(k)}, ${a}) = (${a * k}π, ${a})，CP = (0, ${num(-a * cosK)})。于是 P = (${a * k}π, ${a} ${term(-a * cosK)}) = (${a * k}π, ${yK})。`),
        audit: { kind: 'MIT-MV-12:position', params: { a, k } },
      }),
      g.number({
        id: 'velocity', title: t('Velocity of the cycloid', '摆线的速度'),
        prompt: t(`A point moves along the cycloid x = a(t − sin t), y = a(1 − cos t) with a = ${a}. Differentiate to find its velocity v = (dx/dt, dy/dt) at t = ${piText(VC.p, VC.q)}.`, `点沿摆线 x = a(t − sin t)，y = a(1 − cos t) 运动，a = ${a}。求导得到 t = ${piText(VC.p, VC.q)} 时的速度 v = (dx/dt, dy/dt)。`),
        fields: [{ label: t('v₁ = dx/dt', 'v₁ = dx/dt'), answer: vx }, { label: t('v₂ = dy/dt', 'v₂ = dy/dt'), answer: vy }],
        hint: t('dx/dt = a(1 − cos t) and dy/dt = a sin t. Then substitute the value of t.', 'dx/dt = a(1 − cos t)，dy/dt = a sin t。再代入 t 的值。'),
        explanation: t(`v(t) = (a(1 − cos t), a sin t). At t = ${piText(VC.p, VC.q)}: cos t = ${num(VC.c)}, sin t = ${num(VC.s)}, so v = (${a}·(1 − ${par(VC.c)}), ${a}·${par(VC.s)}) = (${num(vx)}, ${num(vy)}).`, `v(t) = (a(1 − cos t), a sin t)。t = ${piText(VC.p, VC.q)} 时：cos t = ${num(VC.c)}，sin t = ${num(VC.s)}，所以 v = (${a}·(1 − ${par(VC.c)}), ${a}·${par(VC.s)}) = (${num(vx)}, ${num(vy)})。`),
        audit: { kind: 'MIT-MV-12:velocity', params: { a, p: VC.p, q: VC.q } },
      }),
      g.number({
        id: 'speed', title: t('Speed is not velocity', '速率不是速度'),
        prompt: t(`For the cycloid x = a(t − sin t), y = a(1 − cos t) with a = ${a}, find the speed |v| at t = ${piText(SC.p, SC.q)}. Enter an exact value such as 5 or 3sqrt(3).`, `对摆线 x = a(t − sin t)，y = a(1 − cos t)，a = ${a}，求 t = ${piText(SC.p, SC.q)} 时的速率 |v|。输入精确值，如 5 或 3sqrt(3)。`),
        fields: [{ label: t('|v|', '|v|'), answer: a * speedFactor }],
        hint: t('First the velocity vector v = (a(1 − cos t), a sin t); the speed is its length, a single number.', '先求速度向量 v = (a(1 − cos t), a sin t)；速率是它的长度，是一个数。'),
        explanation: t(`At t = ${piText(SC.p, SC.q)}: cos t = ${SC.cos}, sin t = ${SC.sin}, so v = ${SC.v}. Then |v|² = ${SC.m * a * a}, so |v| = ${speedText}. The velocity is a vector; the speed is its length.`, `t = ${piText(SC.p, SC.q)} 时：cos t = ${SC.cos}，sin t = ${SC.sin}，所以 v = ${SC.v}。于是 |v|² = ${SC.m * a * a}，|v| = ${speedText}。速度是向量，速率是它的长度。`),
        audit: { kind: 'MIT-MV-12:speed', params: { a, p: SC.p, q: SC.q } },
      }),
      g.number({
        id: 'count-cusps', title: t('Counting the cusps', '数一数尖点'),
        prompt: t(`For the cycloid x = a(t − sin t), y = a(1 − cos t) with a = ${a}, how many values of t in 0 ≤ t ≤ ${nCusp}π (both ends included) make the velocity zero?`, `对摆线 x = a(t − sin t)，y = a(1 − cos t)，a = ${a}，在 0 ≤ t ≤ ${nCusp}π（含两端）内，有多少个 t 使速度为零？`),
        fields: [{ label: t('number of t values', 't 的个数'), answer: K + 1 }],
        hint: t('v = (a(1 − cos t), a sin t) = 0 needs both components zero at once.', 'v = (a(1 − cos t), a sin t) = 0 需要两个分量同时为零。'),
        explanation: t(`v = 0 needs cos t = 1 and sin t = 0, i.e. t = 0, 2π, 4π, … In 0 ≤ t ≤ ${nCusp}π these are t = 2πj for j = 0, 1, …, ${K}: ${K + 1} values. Each is a cusp.`, `v = 0 需要 cos t = 1 且 sin t = 0，即 t = 0, 2π, 4π, …。在 0 ≤ t ≤ ${nCusp}π 内为 t = 2πj，j = 0, 1, …, ${K}，共 ${K + 1} 个，每一个都是尖点。`),
        audit: { kind: 'MIT-MV-12:count-cusps', params: { a, n: nCusp } },
      }),
      g.number({
        id: 'arch-length', title: t('Length of cycloid arches', '摆线拱的长度'),
        prompt: t(`The cycloid x = a(t − sin t), y = a(1 − cos t) has a = ${a}. Its speed is |v| = 2a|sin(t/2)|. Find the arc length for 0 ≤ t ≤ ${2 * n}π (${n} arch${n === 1 ? '' : 'es'}, as drawn).`, `摆线 x = a(t − sin t)，y = a(1 − cos t)，a = ${a}，其速率为 |v| = 2a|sin(t/2)|。求 0 ≤ t ≤ ${2 * n}π（${n} 个拱，如图）上的弧长。`),
        figure: g.figure({ alt: t(`${n} arch${n === 1 ? '' : 'es'} of the cycloid with a = ${a}, each rising to height ${2 * a} and touching the x-axis at cusps spaced ${2 * a}π apart; the cusps are marked.`, `a = ${a} 的摆线的 ${n} 个拱，每个拱高 ${2 * a}，在相距 ${2 * a}π 的尖点处接触 x 轴；尖点已标出。`), view: { xmin: -a, xmax: 2 * n * PI * a + a, ymin: -0.4 * a, ymax: 2.5 * a }, axes: { xLabel: 'x', yLabel: 'y' }, shapes: cycloid(n, a) }),
        fields: [{ label: t('arc length', '弧长'), answer: 8 * a * n }],
        hint: t('Length = ∫ |v| dt. Each arch contributes the same amount; for one arch 0 ≤ t ≤ 2π, sin(t/2) ≥ 0.', '弧长 = ∫ |v| dt。每个拱贡献相同；在一个拱 0 ≤ t ≤ 2π 上 sin(t/2) ≥ 0。'),
        explanation: t(`For one arch: ∫₀^{2π} 2a sin(t/2) dt = [−4a cos(t/2)]₀^{2π} = 4a·(1 + 1) = 8a = ${8 * a}. With ${n} arch${n === 1 ? '' : 'es'}: ${n}·${8 * a} = ${8 * a * n}.`, `一个拱：∫₀^{2π} 2a sin(t/2) dt = [−4a cos(t/2)]₀^{2π} = 4a·(1 + 1) = 8a = ${8 * a}。${n} 个拱：${n}·${8 * a} = ${8 * a * n}。`),
        audit: { kind: 'MIT-MV-12:arch-length', params: { a, n } },
      }),
      g.choice({
        id: 'cusp-time', title: t('Where is the cusp?', '尖点在何处？'),
        prompt: t(`For the cycloid x = a(t − sin t), y = a(1 − cos t) with a = ${a}, at which of these times is the point at a cusp, where the velocity is zero?`, `对摆线 x = a(t − sin t)，y = a(1 − cos t)，a = ${a}，在下列哪个时刻，点位于尖点（速度为零）？`),
        options: [t(`t = ${2 * kc}π`, `t = ${2 * kc}π`), t(`t = ${2 * kc + 1}π`, `t = ${2 * kc + 1}π`), t(`t = ${2 * kc + 1}π/2`, `t = ${2 * kc + 1}π/2`)], correct: 0,
        hint: t('A cusp needs v = (a(1 − cos t), a sin t) = (0, 0): both components, not just one.', '尖点要求 v = (a(1 − cos t), a sin t) = (0, 0)：两个分量都为零，而不只是一个。'),
        explanation: t(`At t = ${2 * kc}π: cos t = 1, sin t = 0, so v = (0, 0): a cusp. At t = ${2 * kc + 1}π: cos t = −1, sin t = 0, so v = (${2 * a}, 0), the fastest point, not a cusp. At t = ${2 * kc + 1}π/2: cos t = 0, sin t = ${num(sgn)}, so v = (${a}, ${num(sgn * a)}) ≠ 0.`, `t = ${2 * kc}π 时：cos t = 1，sin t = 0，v = (0, 0)：是尖点。t = ${2 * kc + 1}π 时：cos t = −1，sin t = 0，v = (${2 * a}, 0)，是速度最大的点，不是尖点。t = ${2 * kc + 1}π/2 时：cos t = 0，sin t = ${num(sgn)}，v = (${a}, ${num(sgn * a)}) ≠ 0。`),
        audit: { kind: 'MIT-MV-12:cusp-time', params: { a } },
      }),
      g.choice({
        id: 'signed-trap', title: t('Why not integrate sin(t/2)?', '为什么不能直接积分 sin(t/2)？'),
        prompt: t(`To find the length of the first two arches (0 ≤ t ≤ 4π) of the cycloid with a = ${a}, a student computes ∫₀^{4π} 2a sin(t/2) dt = [−4a cos(t/2)]₀^{4π} = 0 and concludes that the length is 0. What went wrong?`, `为求 a = ${a} 的摆线前两个拱（0 ≤ t ≤ 4π）的长度，一位同学计算 ∫₀^{4π} 2a sin(t/2) dt = [−4a cos(t/2)]₀^{4π} = 0，得出长度为 0。错在哪里？`),
        options: [
          t('The speed is 2a|sin(t/2)|, and sin(t/2) < 0 for 2π < t < 4π, so the second arch cancelled the first. The integrand must be |v| ≥ 0.', '速率是 2a|sin(t/2)|，而在 2π < t < 4π 上 sin(t/2) < 0，第二个拱抵消了第一个。被积函数必须是 |v| ≥ 0。'),
          t('Arc length is the integral of the velocity vector, not of a number.', '弧长是速度向量的积分，而不是一个数的积分。'),
          t('Nothing: after 4π the point is back at its starting height, so the length is 0.', '没有错：4π 后点回到起始高度，所以长度为 0。'),
        ], correct: 0,
        hint: t('Arc length adds up distances travelled, which can never be negative. What does sin(t/2) do on 2π < t < 4π?', '弧长累加的是走过的距离，不会为负。sin(t/2) 在 2π < t < 4π 上是什么符号？'),
        explanation: t(`The correct integral is ∫₀^{4π} 2a|sin(t/2)| dt = 2·8a = ${16 * a}. The signed integral gives 0 because ∫₀^{2π} 2a sin(t/2) dt = ${8 * a} and ∫_{2π}^{4π} 2a sin(t/2) dt = −${8 * a}. The integral of the vector v would give the displacement (${4 * a}π, 0), not a length; and the point is not back at its start: x(4π) = ${4 * a}π.`, `正确的积分是 ∫₀^{4π} 2a|sin(t/2)| dt = 2·8a = ${16 * a}。带符号的积分得 0，是因为 ∫₀^{2π} 2a sin(t/2) dt = ${8 * a}，而 ∫_{2π}^{4π} 2a sin(t/2) dt = −${8 * a}。向量 v 的积分给出位移 (${4 * a}π, 0)，而不是长度；点也没有回到起点：x(4π) = ${4 * a}π。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`A disk of radius R = ${R} cm slides so that its center is at (${num(u)}t, ${num(w)}t) cm at time t seconds, and it spins counterclockwise at ${rev} revolution${rev === 1 ? '' : 's'} per second. At t = 0 the point P on the edge is at the right-hand end of the horizontal diameter, i.e. P is at C + (R, 0). Find the position of P at t = ${tText} s.`, `半径 R = ${R} cm 的圆盘滑动，其圆心在 t 秒时位于 (${num(u)}t, ${num(w)}t) cm，同时圆盘以每秒 ${rev} 圈逆时针旋转。t = 0 时边缘上的点 P 位于水平直径的右端，即 P 在 C + (R, 0)。求 t = ${tText} s 时 P 的位置。`),
        fields: [{ label: t('x', 'x'), answer: cx + R * cosC }, { label: t('y', 'y'), answer: cy + R * sinC }],
        hint: t('Split the motion: P = (center) + R(cos φ, sin φ), where φ is the angle turned, 2π × (revolutions per second) × t.', '把运动分解：P = (圆心) + R(cos φ, sin φ)，其中转过的角度 φ = 2π × (每秒圈数) × t。'),
        explanation: t(`Center: C = (${num(u)}·${tText}, ${num(w)}·${tText}) = (${num(cx)}, ${num(cy)}). Angle turned: φ = 2π·${rev}·${tText} = ${piText(q, 2)}, so CP = ${R}(cos φ, sin φ) = (${num(R * cosC)}, ${num(R * sinC)}). Hence P = (${num(cx + R * cosC)}, ${num(cy + R * sinC)}). You practised velocity, speed and position for parametrized motion; sketching a cycloid and deriving the rolling-wheel picture are not covered here.`, `圆心：C = (${num(u)}·${tText}, ${num(w)}·${tText}) = (${num(cx)}, ${num(cy)})。转过的角度：φ = 2π·${rev}·${tText} = ${piText(q, 2)}，所以 CP = ${R}(cos φ, sin φ) = (${num(R * cosC)}, ${num(R * sinC)})。于是 P = (${num(cx + R * cosC)}, ${num(cy + R * sinC)})。这里练习的是参数化运动的速度、速率与位置计算；画摆线草图和推导滚轮图形不在本题范围内。`),
        audit: { kind: 'MIT-MV-12:challenge', params: { R, u, w, n: rev, tn: time.tn, td: time.td } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-13': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-13');
    for (let i = 0; i < 4; i++) g.random(0, 1); // warm up the generator: the first draws of an LCG are nearly constant for neighbouring seeds
    const a = g.nonzero(-3, 3), b = g.nonzero(-2, 2), c = g.nonzero(-3, 3), t0 = g.pick([1, 2, 3, -1, -2]);
    const [p, qy] = g.pick<[number, number]>([[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5]]);
    const sp = g.pick([1, -1]), sq = g.pick([1, -1]);
    const lp = sp * p, lq = sq * qy, hyp = isqrt(lp * lp + lq * lq);
    const x0 = g.nonzero(-3, 3), y0 = g.nonzero(-3, 3), tA = g.random(0, 1), tB = tA + g.random(1, 3);
    const cc = g.random(1, 3), tSq = g.random(1, cc === 1 ? 3 : cc === 2 ? 2 : 1), TL = g.random(1, cc === 3 ? 2 : 3);
    const rho = g.random(1, 4), om = g.random(1, 3);
    const rhoC = g.random(1, 4), omC = g.random(1, 3);
    const k = g.random(1, 3), T = g.random(1, 3);

    const velX = 2 * a * t0, velY = 3 * b * t0 * t0 + c;
    const curve = `(${coef(a, 't²')}, ${linear([b, c], ['t³', 't'])})`;
    const sqSpeed = 1 + 2 * cc * cc * tSq * tSq;
    const cubic = (m: number) => (m % 3 === 0 ? coef(m / 3, 't³') : `${coef(m, 't³')}/3`); // m·t³/3 with the fraction reduced when it is a whole number
    const polyCurve = `(t, ${coef(cc, 't²')}, ${cubic(2 * cc * cc)})`;
    const lengthPoly = (3 * TL + 2 * cc * cc * TL ** 3) / 3;
    const arg = (m: number) => (m === 1 ? 't' : `${m}t`);
    const circleView = { xmin: -rho - 1.6, xmax: rho + 1.6, ymin: -rho - 1.6, ymax: rho + 1.6 };
    const Lb = k * (T ** 3 + 3 * T) / 3;
    // pieces of the challenge explanation, with no "1(...)" when k = 1
    const vx1 = k === 1 ? 't² − 1' : coef(k, '(t² − 1)');
    const v2 = k === 1 ? '(t² − 1)² + 4t²' : coef(k * k, '((t² − 1)² + 4t²)'), v2b = coef(k * k, '(t² + 1)²'), v1 = k === 1 ? 't² + 1' : coef(k, '(t² + 1)');

    return [
      g.number({
        id: 'velocity', title: t('Velocity from the position vector', '由位置向量求速度'),
        prompt: t(`A point moves along r(t) = ${curve}. Find its velocity v = r′(t) at t = ${num(t0)}.`, `点沿 r(t) = ${curve} 运动。求 t = ${num(t0)} 时的速度 v = r′(t)。`),
        fields: [{ label: t('v₁', 'v₁'), answer: velX }, { label: t('v₂', 'v₂'), answer: velY }],
        hint: t('Differentiate each component separately, then substitute t.', '分别对每个分量求导，再代入 t。'),
        explanation: t(`v(t) = (${coef(2 * a, 't')}, ${linear([3 * b], ['t²'])} ${term(c)}). At t = ${num(t0)}: v = (${num(2 * a)}·${par(t0)}, ${num(3 * b)}·${par(t0)}² ${term(c)}) = (${num(velX)}, ${num(velY)}).`, `v(t) = (${coef(2 * a, 't')}, ${linear([3 * b], ['t²'])} ${term(c)})。t = ${num(t0)} 时：v = (${num(2 * a)}·${par(t0)}, ${num(3 * b)}·${par(t0)}² ${term(c)}) = (${num(velX)}, ${num(velY)})。`),
        audit: { kind: 'MIT-MV-13:velocity', params: { a, b, c, t: t0 } },
      }),
      g.number({
        id: 'acceleration', title: t('Acceleration is the derivative of velocity', '加速度是速度的导数'),
        prompt: t(`For the same motion r(t) = ${curve}, find the acceleration a = d²r/dt² at t = ${num(t0)}.`, `对同一运动 r(t) = ${curve}，求 t = ${num(t0)} 时的加速度 a = d²r/dt²。`),
        fields: [{ label: t('a₁', 'a₁'), answer: 2 * a }, { label: t('a₂', 'a₂'), answer: 6 * b * t0 }],
        hint: t('Differentiate the velocity once more. Acceleration is a vector too.', '再对速度求一次导。加速度也是向量。'),
        explanation: t(`v(t) = (${coef(2 * a, 't')}, ${linear([3 * b], ['t²'])} ${term(c)}), so a(t) = (${num(2 * a)}, ${coef(6 * b, 't')}). At t = ${num(t0)}: a = (${num(2 * a)}, ${num(6 * b)}·${par(t0)}) = (${num(2 * a)}, ${num(6 * b * t0)}).`, `v(t) = (${coef(2 * a, 't')}, ${linear([3 * b], ['t²'])} ${term(c)})，所以 a(t) = (${num(2 * a)}, ${coef(6 * b, 't')})。t = ${num(t0)} 时：a = (${num(2 * a)}, ${num(6 * b)}·${par(t0)}) = (${num(2 * a)}, ${num(6 * b * t0)})。`),
        audit: { kind: 'MIT-MV-13:acceleration', params: { a, b, c, t: t0 } },
      }),
      g.number({
        id: 'line-speed-length', title: t('Speed and length along a line', '直线运动的速率与弧长'),
        prompt: t(`A point moves with x = ${linear([lp], ['t'])} ${term(x0)}, y = ${linear([lq], ['t'])} ${term(y0)}. Find its speed, and the length of the path from t = ${tA} to t = ${tB}.`, `点的运动为 x = ${linear([lp], ['t'])} ${term(x0)}，y = ${linear([lq], ['t'])} ${term(y0)}。求它的速率，以及 t = ${tA} 到 t = ${tB} 的路径长度。`),
        fields: [{ label: t('speed', '速率'), answer: hyp }, { label: t('arc length', '弧长'), answer: hyp * (tB - tA) }],
        hint: t('The velocity is constant, so the speed is constant. Length = ∫ speed dt.', '速度为常向量，所以速率为常数。弧长 = ∫ 速率 dt。'),
        explanation: t(`v = (${num(lp)}, ${num(lq)}) is constant, so |v| = √(${par(lp)}² + ${par(lq)}²) = √${lp * lp + lq * lq} = ${hyp}. Length = ∫_${tA}^${tB} ${hyp} dt = ${hyp}·(${tB} − ${tA}) = ${hyp * (tB - tA)}.`, `v = (${num(lp)}, ${num(lq)}) 为常向量，所以 |v| = √(${par(lp)}² + ${par(lq)}²) = √${lp * lp + lq * lq} = ${hyp}。弧长 = ∫_${tA}^${tB} ${hyp} dt = ${hyp}·(${tB} − ${tA}) = ${hyp * (tB - tA)}。`),
        audit: { kind: 'MIT-MV-13:line-speed-length', params: { p: lp, q: lq, x0, y0, t1: tA, t2: tB } },
      }),
      g.number({
        id: 'perfect-square', title: t('A speed that is a whole number', '速率恰为整数'),
        prompt: t(`A point moves along r(t) = ${polyCurve}. Find its speed |v| at t = ${tSq}.`, `点沿 r(t) = ${polyCurve} 运动。求 t = ${tSq} 时的速率 |v|。`),
        fields: [{ label: t('|v|', '|v|'), answer: sqSpeed }],
        hint: t('Differentiate each component, substitute t, then take the length of the vector.', '各分量求导，代入 t，再求向量的长度。'),
        explanation: t(`v(t) = (1, ${coef(2 * cc, 't')}, ${2 * cc * cc}t²). At t = ${tSq}: v = (1, ${2 * cc * tSq}, ${2 * cc * cc * tSq * tSq}), so |v|² = 1 + ${(2 * cc * tSq) ** 2} + ${(2 * cc * cc * tSq * tSq) ** 2} = ${sqSpeed * sqSpeed} and |v| = ${sqSpeed}. In general |v|² = 1 + ${4 * cc * cc}t² + ${4 * cc ** 4}t⁴ = (1 + ${2 * cc * cc}t²)², a perfect square.`, `v(t) = (1, ${coef(2 * cc, 't')}, ${2 * cc * cc}t²)。t = ${tSq} 时：v = (1, ${2 * cc * tSq}, ${2 * cc * cc * tSq * tSq})，所以 |v|² = 1 + ${(2 * cc * tSq) ** 2} + ${(2 * cc * cc * tSq * tSq) ** 2} = ${sqSpeed * sqSpeed}，|v| = ${sqSpeed}。一般地 |v|² = 1 + ${4 * cc * cc}t² + ${4 * cc ** 4}t⁴ = (1 + ${2 * cc * cc}t²)²，是完全平方。`),
        audit: { kind: 'MIT-MV-13:perfect-square', params: { c: cc, t: tSq } },
      }),
      g.number({
        id: 'arc-length-poly', title: t('Arc length when |v| is a polynomial', '|v| 为多项式时的弧长'),
        prompt: t(`For r(t) = ${polyCurve}, find the arc length from t = 0 to t = ${TL}. (Exact answer; use a fraction if needed.)`, `对 r(t) = ${polyCurve}，求 t = 0 到 t = ${TL} 的弧长。（精确值，必要时用分数。）`),
        fields: [{ label: t('arc length', '弧长'), answer: lengthPoly }],
        hint: t('Arc length is ∫ |v| dt. Check whether |v|² is a perfect square so that |v| is a polynomial.', '弧长为 ∫ |v| dt。检查 |v|² 是否为完全平方，使 |v| 成为多项式。'),
        explanation: t(`|v| = 1 + ${2 * cc * cc}t² (|v|² is the perfect square (1 + ${2 * cc * cc}t²)²). So L = ∫₀^${TL} (1 + ${2 * cc * cc}t²) dt = [t + ${cubic(2 * cc * cc)}]₀^${TL} = ${TL} + ${2 * cc * cc}·${TL ** 3}/3 = ${frac(3 * TL + 2 * cc * cc * TL ** 3, 3)}.`, `|v| = 1 + ${2 * cc * cc}t²（|v|² 是完全平方 (1 + ${2 * cc * cc}t²)²）。所以 L = ∫₀^${TL} (1 + ${2 * cc * cc}t²) dt = [t + ${cubic(2 * cc * cc)}]₀^${TL} = ${TL} + ${2 * cc * cc}·${TL ** 3}/3 = ${frac(3 * TL + 2 * cc * cc * TL ** 3, 3)}。`),
        audit: { kind: 'MIT-MV-13:arc-length-poly', params: { c: cc, T: TL } },
      }),
      g.number({
        id: 'circle-acceleration', title: t('Constant speed, nonzero acceleration', '速率不变，加速度不为零'),
        prompt: t(`A point moves on r(t) = (${coef(rho, `cos(${arg(om)})`)}, ${coef(rho, `sin(${arg(om)})`)}), a circle of radius ρ = ${rho} traversed with ω = ${om}. The picture shows the position at t = 0 with the directions of v and a (arrows not to scale). Find the speed |v| and the magnitude |a| of the acceleration.`, `点沿 r(t) = (${coef(rho, `cos(${arg(om)})`)}, ${coef(rho, `sin(${arg(om)})`)}) 运动，即半径为 ρ = ${rho} 的圆，ω = ${om}。图中画出 t = 0 时的位置以及 v 与 a 的方向（箭头不按比例）。求速率 |v| 和加速度的大小 |a|。`),
        figure: g.figure({ alt: t(`A circle of radius ${rho} centered at the origin. At the point (${rho}, 0) one arrow points straight up (the velocity v, tangent, counterclockwise) and another points left toward the center (the acceleration a). Arrows are not drawn to scale.`, `以原点为圆心、半径为 ${rho} 的圆。在点 (${rho}, 0) 处，一个箭头竖直向上（速度 v，沿切线、逆时针），另一个箭头向左指向圆心（加速度 a）。箭头不按比例绘制。`), view: circleView, axes: { grid: true }, shapes: [
          { kind: 'line', points: ellipse(0, 0, rho), tone: 'muted' },
          { kind: 'point', at: [rho, 0], tone: 'accent' },
          { kind: 'arrow', from: [rho, 0], to: [rho, 0.5 * rho + 0.2], tone: 'accent', label: 'v' },
          { kind: 'arrow', from: [rho, 0], to: [rho - 0.5 * rho - 0.2, 0], tone: 'accent2', label: 'a' },
        ] }),
        fields: [{ label: t('|v|', '|v|'), answer: rho * om }, { label: t('|a|', '|a|'), answer: rho * om * om }],
        hint: t('Differentiate twice. Compare a(t) with r(t): a = −ω² r.', '求导两次。把 a(t) 与 r(t) 比较：a = −ω² r。'),
        explanation: t(`v = (${coef(-rho * om, `sin(${arg(om)})`)}, ${coef(rho * om, `cos(${arg(om)})`)}), so |v| = ${rho * om}. a = (${coef(-rho * om * om, `cos(${arg(om)})`)}, ${coef(-rho * om * om, `sin(${arg(om)})`)}) = −ω² r, so |a| = ${rho}·${om}² = ${rho * om * om}.`, `v = (${coef(-rho * om, `sin(${arg(om)})`)}, ${coef(rho * om, `cos(${arg(om)})`)})，所以 |v| = ${rho * om}。a = (${coef(-rho * om * om, `cos(${arg(om)})`)}, ${coef(-rho * om * om, `sin(${arg(om)})`)}) = −ω² r，所以 |a| = ${rho}·${om}² = ${rho * om * om}。`),
        audit: { kind: 'MIT-MV-13:circle-acceleration', params: { rho, omega: om } },
      }),
      g.choice({
        id: 'constant-speed', title: t('Constant speed', '匀速率'),
        prompt: t(`A point goes around a circle of radius ${rhoC} with constant speed ${rhoC * omC}. Which statement is correct?`, `一点以恒定速率 ${rhoC * omC} 沿半径为 ${rhoC} 的圆运动。哪个说法正确？`),
        options: [
          t('Its velocity changes (the direction turns), so its acceleration is not zero.', '它的速度在变化（方向在转动），所以加速度不为零。'),
          t('Its velocity is constant, because the speed is constant.', '它的速度为常向量，因为速率不变。'),
          t('Its acceleration is zero, because the speed is not changing.', '它的加速度为零，因为速率不变。'),
        ], correct: 0,
        hint: t('Speed is |v|, a number. Velocity v is a vector with a direction.', '速率是 |v|，一个数；速度 v 是带方向的向量。'),
        explanation: t(`Speed = |v| = ${rhoC * omC} stays fixed, but the vector v keeps turning, so a = dv/dt ≠ 0. For a circle |a| = |v|²/ρ = ${rhoC * omC}²/${rhoC} = ${rhoC * omC * omC}, directed toward the center. Also, over one lap the average speed is positive but the average velocity is the zero vector.`, `速率 |v| = ${rhoC * omC} 不变，但向量 v 在不断转向，所以 a = dv/dt ≠ 0。对圆周运动 |a| = |v|²/ρ = ${rhoC * omC}²/${rhoC} = ${rhoC * omC * omC}，指向圆心。另外，绕一圈的平均速率为正，而平均速度是零向量。`),
      }),
      g.choice({
        id: 'product-rule', title: t('Derivative of a cross product', '叉积的导数'),
        prompt: t('For differentiable vector functions r(t) and s(t) in space, which rule gives d/dt (r × s)?', '对空间中可微的向量函数 r(t) 与 s(t)，哪个法则给出 d/dt (r × s)？'),
        options: [t('r′ × s + r × s′', 'r′ × s + r × s′'), t('r′ × s + s′ × r', 'r′ × s + s′ × r'), t('r′ × s′', 'r′ × s′')], correct: 0,
        hint: t('It is the ordinary product rule, but a × b = −b × a, so the order of each cross product matters.', '它是普通的乘积法则，但 a × b = −b × a，所以每个叉积的顺序都重要。'),
        explanation: t('Differentiating the components with the usual product rule gives r′ × s + r × s′, keeping r before s in each term. The option s′ × r equals −(r × s′), the wrong sign; r′ × s′ drops the cross terms.', '用普通乘积法则对分量求导，得到 r′ × s + r × s′，每一项中 r 都在 s 之前。选项 s′ × r 等于 −(r × s′)，符号错误；r′ × s′ 漏掉了交叉项。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`A point moves along x = ${cubic(k)} − ${coef(k, 't')}, y = ${coef(k, 't²')}. Find the arc length from t = 0 to t = ${T}. (Exact answer; use a fraction if needed.)`, `点沿 x = ${cubic(k)} − ${coef(k, 't')}，y = ${coef(k, 't²')} 运动。求 t = 0 到 t = ${T} 的弧长。（精确值，必要时用分数。）`),
        fields: [{ label: t('arc length', '弧长'), answer: Lb }],
        hint: t('Find v, then |v|², and look for a perfect square before integrating.', '先求 v，再求 |v|²，积分前先看它是否为完全平方。'),
        explanation: t(`v = (${vx1}, ${coef(2 * k, 't')}), so |v|² = ${v2} = ${v2b} and |v| = ${v1}. L = ∫₀^${T} ${coef(k, '(t² + 1)')} dt = ${k === 1 ? '' : `${k}·`}(${T ** 3}/3 + ${T}) = ${frac(k * (T ** 3 + 3 * T), 3)}. You practised speed and arc length; the tangential/normal split of acceleration and sketching the curves are not covered here.`, `v = (${vx1}, ${coef(2 * k, 't')})，所以 |v|² = ${v2} = ${v2b}，|v| = ${v1}。L = ∫₀^${T} ${coef(k, '(t² + 1)')} dt = ${k === 1 ? '' : `${k}·`}(${T ** 3}/3 + ${T}) = ${frac(k * (T ** 3 + 3 * T), 3)}。这里练习的是速率与弧长；加速度的切向/法向分解和曲线草图不在本题范围内。`),
        audit: { kind: 'MIT-MV-13:challenge', params: { k, T } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-14': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-14');
    for (let i = 0; i < 4; i++) g.random(0, 1); // warm up the generator: the first draws of an LCG are nearly constant for neighbouring seeds
    let x = g.nonzero(-5, 5), y = g.nonzero(-5, 5), vx = g.random(-5, 5), vy = g.random(-5, 5);
    for (let i = 0; i < 50 && x * vy - y * vx === 0; i++) { vx = g.nonzero(-5, 5); vy = g.nonzero(-5, 5); }
    if (x * vy - y * vx === 0) { vx = -y; vy = x; }
    const Kz = x * vy - y * vx;
    const rho = g.random(1, 4), om = g.pick([1, -1, 2, -2, 3, -3]);
    let d1 = 1, d2 = 2, v1 = 2;
    { d2 = g.random(2, 8); d1 = g.random(1, d2 - 1); const step = d2 / gcd(d1, d2); v1 = step * g.random(1, 3); }
    const v2 = d1 * v1 / d2;
    const Ks = g.nonzero(-9, 9), t1 = g.random(0, 3), t2 = t1 + g.random(2, 5);
    const rx = g.nonzero(-4, 4), ry = g.nonzero(-4, 4);
    const central = g.random(0, 3) === 0, kc = g.random(1, 2);
    let ax = g.random(-4, 4), ay = g.random(-4, 4);
    for (let i = 0; i < 50 && rx * ay - ry * ax === 0; i++) { ax = g.nonzero(-4, 4); ay = g.nonzero(-4, 4); }
    if (rx * ay - ry * ax === 0) { ax = 1; ay = 0; if (rx * ay - ry * ax === 0) ay = 1; }
    if (central) { ax = -kc * rx; ay = -kc * ry; }
    const Tz = rx * ay - ry * ax;
    const nPow = g.pick([1, 3, 4]), powText = nPow === 1 ? '' : `^${nPow}`;
    const ea = g.random(1, 4), eb = g.random(1, 4), ew = g.random(1, 2), eT = g.random(1, 3);

    const wt = ew === 1 ? 't' : `${ew}t`;
    const argOm = (m: number) => (m === 1 ? 't' : m === -1 ? '−t' : `${num(m)}t`);
    const crossShapes: FigureShape[] = [
      { kind: 'point', at: [0, 0], tone: 'warn', label: 'O' },
      { kind: 'arrow', from: [0, 0], to: [x, y], tone: 'accent', label: 'r' },
      { kind: 'arrow', from: [x, y], to: [x + vx, y + vy], tone: 'accent2', label: 'v' },
    ];
    const ellipseShapes: FigureShape[] = [
      { kind: 'line', points: ellipse(0, 0, ea, eb), tone: 'accent' },
      { kind: 'point', at: [0, 0], tone: 'warn', label: 'O' },
    ];

    return [
      g.number({
        id: 'cross-z', title: t('The area rate from r × v', '由 r × v 求面积速度'),
        prompt: t(`The sun is at the origin O. At some instant a planet is at r = ${vec(x, y)} with velocity v = ${vec(vx, vy)}. For planar vectors r × v points along the z-axis and (r × v)_z = x·v_y − y·v_x (counterclockwise motion is positive). Find (r × v)_z and the area rate dA/dt = ½|r × v|.`, `太阳位于原点 O。某一时刻行星位于 r = ${vec(x, y)}，速度为 v = ${vec(vx, vy)}。对平面向量，r × v 沿 z 轴方向，(r × v)_z = x·v_y − y·v_x（逆时针为正）。求 (r × v)_z 和面积速度 dA/dt = ½|r × v|。`),
        figure: g.figure({ alt: t(`The position vector r drawn from the sun O at the origin to the point ${vec(x, y)}, and the velocity vector v drawn starting at that point.`, `从原点处的太阳 O 到点 ${vec(x, y)} 的位置向量 r，以及从该点出发的速度向量 v。`), view: fitView(crossShapes, 0.25), axes: { grid: true }, shapes: crossShapes }),
        fields: [{ label: t('(r × v)_z', '(r × v)_z') , answer: Kz }, { label: t('dA/dt', 'dA/dt'), answer: Math.abs(Kz) / 2 }],
        hint: t('Substitute into x·v_y − y·v_x; then take half of the absolute value.', '代入 x·v_y − y·v_x；再取绝对值的一半。'),
        explanation: t(`(r × v)_z = ${par(x)}·${par(vy)} − ${par(y)}·${par(vx)} = ${num(x * vy)} − ${par(y * vx)} = ${num(Kz)}. So dA/dt = ½|${num(Kz)}| = ${frac(Math.abs(Kz), 2)}.`, `(r × v)_z = ${par(x)}·${par(vy)} − ${par(y)}·${par(vx)} = ${num(x * vy)} − ${par(y * vx)} = ${num(Kz)}。所以 dA/dt = ½|${num(Kz)}| = ${frac(Math.abs(Kz), 2)}。`),
        audit: { kind: 'MIT-MV-14:cross-z', params: { x, y, vx, vy } },
      }),
      g.number({
        id: 'circle-sign', title: t('Orientation and the sign', '方向与符号'),
        prompt: t(`A planet moves on r(t) = (${coef(rho, `cos(${argOm(om)})`)}, ${coef(rho, `sin(${argOm(om)})`)}) with ρ = ${rho} and ω = ${num(om)} (ω > 0 is counterclockwise, ω < 0 is clockwise); the sun is at the origin. Find (r × v)_z, where (r × v)_z = x·v_y − y·v_x, and the area rate dA/dt = ½|r × v|.`, `行星沿 r(t) = (${coef(rho, `cos(${argOm(om)})`)}, ${coef(rho, `sin(${argOm(om)})`)}) 运动，ρ = ${rho}，ω = ${num(om)}（ω > 0 为逆时针，ω < 0 为顺时针）；太阳在原点。求 (r × v)_z（其中 (r × v)_z = x·v_y − y·v_x）以及面积速度 dA/dt = ½|r × v|。`),
        fields: [{ label: t('(r × v)_z', '(r × v)_z'), answer: rho * rho * om }, { label: t('dA/dt', 'dA/dt'), answer: rho * rho * Math.abs(om) / 2 }],
        hint: t('v = (−ρω sin ωt, ρω cos ωt). Then x·v_y − y·v_x simplifies by cos² + sin² = 1.', 'v = (−ρω sin ωt, ρω cos ωt)。再用 cos² + sin² = 1 化简 x·v_y − y·v_x。'),
        explanation: t(`(r × v)_z = ρ cos·ρω cos − ρ sin·(−ρω sin) = ρ²ω = ${par(rho)}²·${par(om)} = ${num(rho * rho * om)}, constant and ${om > 0 ? 'positive (counterclockwise)' : 'negative (clockwise)'}. So dA/dt = ${frac(rho * rho * Math.abs(om), 2)}. Check: one lap sweeps πρ² = ${piText(rho * rho)} in time 2π/${Math.abs(om)}, i.e. ${frac(rho * rho * Math.abs(om), 2)} per unit time.`, `(r × v)_z = ρ cos·ρω cos − ρ sin·(−ρω sin) = ρ²ω = ${par(rho)}²·${par(om)} = ${num(rho * rho * om)}，为常数，${om > 0 ? '为正（逆时针）' : '为负（顺时针）'}。所以 dA/dt = ${frac(rho * rho * Math.abs(om), 2)}。检验：转一圈扫过 πρ² = ${piText(rho * rho)}，用时 2π/${Math.abs(om)}，即每单位时间 ${frac(rho * rho * Math.abs(om), 2)}。`),
        audit: { kind: 'MIT-MV-14:circle-sign', params: { rho, omega: om } },
      }),
      g.number({
        id: 'equal-areas', title: t('Equal areas at perihelion and aphelion', '近日点与远日点的等面积'),
        prompt: t(`A planet moves in a plane under a central force from the sun at the origin. At its nearest point its distance is d₁ = ${d1} and its speed is v₁ = ${v1}, with r ⟂ v. At its farthest point its distance is d₂ = ${d2}, again with r ⟂ v. Find its speed v₂ there.`, `行星在平面内受来自原点处太阳的中心力作用。在最近点，它到太阳的距离为 d₁ = ${d1}，速率为 v₁ = ${v1}，且 r ⟂ v。在最远点，距离为 d₂ = ${d2}，同样 r ⟂ v。求该点的速率 v₂。`),
        fields: [{ label: t('v₂', 'v₂'), answer: v2 }],
        hint: t('When r ⟂ v, |r × v| = |r||v|. Kepler’s second law says |r × v| is the same at both points.', '当 r ⟂ v 时，|r × v| = |r||v|。开普勒第二定律说明两点处的 |r × v| 相同。'),
        explanation: t(`With r ⟂ v: |r × v| = d·v, and for a central force this is constant (dA/dt = ½ d v). So ${d1}·${v1} = ${d2}·v₂, giving v₂ = ${d1 * v1}/${d2} = ${frac(d1 * v1, d2)}.`, `当 r ⟂ v 时：|r × v| = d·v，而在中心力作用下它为常数（dA/dt = ½ d v）。所以 ${d1}·${v1} = ${d2}·v₂，得 v₂ = ${d1 * v1}/${d2} = ${frac(d1 * v1, d2)}。`),
        audit: { kind: 'MIT-MV-14:equal-areas', params: { d1, v1, d2 } },
      }),
      g.number({
        id: 'swept-area', title: t('Area swept in a time interval', '一段时间内扫过的面积'),
        prompt: t(`A planet moves under a central force from the sun at the origin. At t = ${t1} its (r × v)_z equals ${num(Ks)}. How much area does the radius vector sweep from t = ${t1} to t = ${t2}? (Exact answer; use a fraction if needed.)`, `行星在来自原点处太阳的中心力作用下运动。t = ${t1} 时 (r × v)_z 等于 ${num(Ks)}。从 t = ${t1} 到 t = ${t2}，位置向量扫过的面积是多少？（精确值，必要时用分数。）`),
        fields: [{ label: t('area swept', '扫过的面积'), answer: Math.abs(Ks) * (t2 - t1) / 2 }],
        hint: t('For a central force r × v is constant, so dA/dt = ½|r × v| is constant.', '中心力下 r × v 为常向量，所以 dA/dt = ½|r × v| 为常数。'),
        explanation: t(`r × v is constant, so dA/dt = ½|${num(Ks)}| = ${frac(Math.abs(Ks), 2)} at every time (the sign only records the direction of motion). Area = ${frac(Math.abs(Ks), 2)}·(${t2} − ${t1}) = ${frac(Math.abs(Ks) * (t2 - t1), 2)}.`, `r × v 为常向量，所以任何时刻 dA/dt = ½|${num(Ks)}| = ${frac(Math.abs(Ks), 2)}（符号只表示运动方向）。面积 = ${frac(Math.abs(Ks), 2)}·(${t2} − ${t1}) = ${frac(Math.abs(Ks) * (t2 - t1), 2)}。`),
        audit: { kind: 'MIT-MV-14:swept-area', params: { K: Ks, t1, t2 } },
      }),
      g.number({
        id: 'torque', title: t('The derivative of r × v', 'r × v 的导数'),
        prompt: t(`Since d/dt (r × v) = v × v + r × a = r × a, the rate of change of (r × v)_z is (r × a)_z = x·a_y − y·a_x. At some instant the planet is at r = ${vec(rx, ry)} and has acceleration a = ${vec(ax, ay)}. Find (r × a)_z.`, `由于 d/dt (r × v) = v × v + r × a = r × a，(r × v)_z 的变化率是 (r × a)_z = x·a_y − y·a_x。某一时刻行星位于 r = ${vec(rx, ry)}，加速度为 a = ${vec(ax, ay)}。求 (r × a)_z。`),
        fields: [{ label: t('(r × a)_z', '(r × a)_z'), answer: nz(Tz) }],
        hint: t('Substitute into x·a_y − y·a_x. It is zero exactly when a is parallel to r.', '代入 x·a_y − y·a_x。当且仅当 a 平行于 r 时它为零。'),
        explanation: t(`(r × a)_z = ${par(rx)}·${par(ay)} − ${par(ry)}·${par(ax)} = ${num(rx * ay)} − ${par(ry * ax)} = ${num(Tz)}. ${Tz === 0 ? 'This is zero: a is parallel to r, as for a central force, so r × v does not change.' : 'This is not zero: a is not parallel to r, so a central force is ruled out and r × v is changing.'}`, `(r × a)_z = ${par(rx)}·${par(ay)} − ${par(ry)}·${par(ax)} = ${num(rx * ay)} − ${par(ry * ax)} = ${num(Tz)}。${Tz === 0 ? '结果为零：a 平行于 r，与中心力一致，所以 r × v 不变。' : '结果不为零：a 不平行于 r，排除了中心力，r × v 在变化。'}`),
        audit: { kind: 'MIT-MV-14:torque', params: { x: rx, y: ry, ax, ay } },
      }),
      g.choice({
        id: 'central-force-n', title: t('Does the force law matter?', '力的规律重要吗？'),
        prompt: t(`A planet is pulled toward the sun at the origin by a force of magnitude K/d${powText}, where d is its distance from the sun, always directed toward the sun. Does the radius vector from the sun sweep out equal areas in equal times?`, `行星受到指向原点处太阳的力，大小为 K/d${powText}（d 为到太阳的距离），方向始终指向太阳。从太阳出发的位置向量在相等时间内扫过的面积相等吗？`),
        options: [
          t(`Yes: the force is central, so r × a = 0 and r × v is constant. The exponent ${nPow} does not matter.`, `相等：力是中心力，所以 r × a = 0，r × v 为常向量。指数 ${nPow} 不起作用。`),
          t('Only for exponent 2: equal areas needs an inverse-square force.', '只有指数为 2 时才成立：等面积需要平方反比力。'),
          t('No: the distance d changes, so the area rate changes too.', '不相等：距离 d 在变，所以面积速度也在变。'),
        ], correct: 0,
        hint: t('Check the direction of the force, not its size: what is r × a when a points along −r?', '看力的方向而不是大小：当 a 沿 −r 方向时，r × a 是多少？'),
        explanation: t('Equal areas in equal times is equivalent to the force being central (pointing toward or away from the origin); the magnitude is irrelevant. With a parallel to r, r × a = 0, so d/dt (r × v) = 0. The 1/d² law is needed for Kepler’s first law (elliptical orbits), not for the second.', '相等时间内扫过相等面积等价于力是中心力（指向或背离原点），大小无关紧要。a 平行于 r 时 r × a = 0，所以 d/dt (r × v) = 0。平方反比律用于开普勒第一定律（椭圆轨道），而不是第二定律。'),
      }),
      g.choice({
        id: 'why-constant', title: t('Which step makes r × v constant?', '哪一步使 r × v 为常数？'),
        prompt: t('The force on a planet is central: the acceleration a is parallel to r. Which computation shows that r × v is constant?', '行星所受的力是中心力：加速度 a 平行于 r。哪一个计算说明 r × v 为常向量？'),
        options: [
          t('d/dt (r × v) = v × v + r × a = 0 + 0 = 0.', 'd/dt (r × v) = v × v + r × a = 0 + 0 = 0。'),
          t('|r| is constant on an orbit, so |r × v| is constant.', '轨道上 |r| 为常数，所以 |r × v| 为常数。'),
          t('v is constant for a central force, so r × v is constant.', '中心力下 v 为常向量，所以 r × v 为常向量。'),
        ], correct: 0,
        hint: t('Differentiate r × v with the product rule (keeping the order) and use s × s = 0.', '用乘积法则对 r × v 求导（保持顺序），并用 s × s = 0。'),
        explanation: t('The product rule gives d/dt (r × v) = v × v + r × a. The first term is 0 because s × s = 0; the second is 0 because a is parallel to r. The conclusion does not need |r| or v to stay fixed: in general both change along an orbit (v is constant only if a = 0, and |r| is constant only on a circle), yet r × v stays constant.', '乘积法则给出 d/dt (r × v) = v × v + r × a。第一项为 0，因为 s × s = 0；第二项为 0，因为 a 平行于 r。这个结论并不要求 |r| 或 v 保持不变：一般情况下二者都会沿轨道变化（只有 a = 0 时 v 才是常向量，只有在圆轨道上 |r| 才是常数），而 r × v 始终是常向量。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`A body is pulled toward the origin O by a spring-like force, so its acceleration is −ω² r (a central force). It moves on r(t) = (${coef(ea, `cos(${wt})`)}, ${coef(eb, `sin(${wt})`)}) (a = ${ea}, b = ${eb}, ω = ${ew}), where a and b are the semi-axes of the ellipse. This is a Hooke-type orbit, with O at the center of the ellipse; it is not a Kepler orbit, which has the sun at a focus. Find the area swept by the position vector from t = 0 to t = ${eT}. (Since ω·${eT} < 2π there is no overlap. Exact answer; use a fraction if needed.)`, `一个物体受到指向原点 O 的弹簧式力的作用，所以加速度为 −ω² r（中心力）。它沿 r(t) = (${coef(ea, `cos(${wt})`)}, ${coef(eb, `sin(${wt})`)}) 运动（a = ${ea}，b = ${eb}，ω = ${ew}），其中 a、b 是椭圆的半轴。这是胡克型轨道，O 在椭圆的中心；它不是开普勒轨道（开普勒轨道中太阳在焦点上）。求位置向量从 t = 0 到 t = ${eT} 扫过的面积。（因为 ω·${eT} < 2π，不会重叠。精确值，必要时用分数。）`),
        figure: g.figure({ alt: ea === eb
          ? t(`A circle of radius ${ea} centered at the origin (the horizontal semi-axis ${ea} and the vertical semi-axis ${eb} are equal); the center of force O is marked at the origin, the center of the circle.`, `以原点为圆心、半径为 ${ea} 的圆（水平半轴 ${ea} 与竖直半轴 ${eb} 相等）；力心 O 标在原点，即圆心。`)
          : t(`An ellipse centered at the origin with horizontal semi-axis ${ea} and vertical semi-axis ${eb}; the center of force O is marked at the origin, the center of the ellipse.`, `以原点为中心的椭圆，水平半轴为 ${ea}，竖直半轴为 ${eb}；力心 O 标在原点，即椭圆的中心。`), view: { xmin: -ea - 1, xmax: ea + 1, ymin: -eb - 1, ymax: eb + 1 }, axes: { grid: true }, shapes: ellipseShapes }),
        fields: [{ label: t('area swept', '扫过的面积'), answer: ea * eb * ew * eT / 2 }],
        hint: t('Find r × v first. For a central force dA/dt is constant, so the area is the constant rate times the elapsed time.', '先求 r × v。中心力下 dA/dt 为常数，所以面积 = 常数速率 × 经过的时间。'),
        explanation: t(`v = (${coef(-ea * ew, `sin(${wt})`)}, ${coef(eb * ew, `cos(${wt})`)}), so (r × v)_z = x·v_y − y·v_x = ${coef(ea * eb * ew, '(cos² + sin²)')} = ${ea * eb * ew}, constant. dA/dt = ${frac(ea * eb * ew, 2)}, so the area is ${frac(ea * eb * ew, 2)}·${eT} = ${frac(ea * eb * ew * eT, 2)}. Only the area law (Kepler’s second law) is used here: it holds for any central force, including this Hooke force. Kepler’s first law (a sun at a focus and an inverse-square force) is a different matter and is not covered here.`, `v = (${coef(-ea * ew, `sin(${wt})`)}, ${coef(eb * ew, `cos(${wt})`)})，所以 (r × v)_z = x·v_y − y·v_x = ${coef(ea * eb * ew, '(cos² + sin²)')} = ${ea * eb * ew}，为常数。dA/dt = ${frac(ea * eb * ew, 2)}，所以面积为 ${frac(ea * eb * ew, 2)}·${eT} = ${frac(ea * eb * ew * eT, 2)}。这里只用到面积定律（开普勒第二定律）：它对任何中心力都成立，包括这里的胡克力。开普勒第一定律（太阳位于焦点、平方反比力）是另一回事，这里不涉及。`),
        audit: { kind: 'MIT-MV-14:challenge', params: { a: ea, b: eb, w: ew, T: eT } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-15': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-15');
    const { v: qv, length: lq } = integerLengthVector(g), { v: rv, length: lr } = integerLengthVector(g);
    const T = sampleTriangle(g, true);
    const M = sampleMatrix(g, 6), D = det3(M), K = adjugate(M);
    const X = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
    const B = M.map(row => dot(row, X));
    // singular c
    let sing = { u1: 1, u2: 3, V: [2, 0, -1], W: [1, 1, 0], c: 1 };
    for (let i = 0; i < 4000; i++) {
      const V = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)], W = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
      const N = cross(V, W);
      const u1 = g.random(-2, 3), u2 = g.random(-2, 3);
      if (N[2] === 0 || (u1 === 0 && u2 === 0)) continue;
      const top = -(u1 * N[0] + u2 * N[1]);
      if (top % N[2] !== 0) continue;
      sing = { u1, u2, V, W, c: nz(top / N[2]) };
      break;
    }
    const Lk = g.random(1, 4), L = 4 * Lk, kS = (r: string) => (Lk === 1 ? r : `${Lk}${r}`), lad = g.pick([
      { d: 6, x: `−${kS('√3')}`, y: `${Lk}`, ax: -Lk * Math.sqrt(3), ay: Lk, steps: 'cos(π/6) = √3/2, sin(π/6) = 1/2' },
      { d: 4, x: `−${kS('√2')}`, y: `${kS('√2')}`, ax: -Lk * Math.sqrt(2), ay: Lk * Math.sqrt(2), steps: 'cos(π/4) = sin(π/4) = √2/2' },
      { d: 3, x: `−${Lk}`, y: `${kS('√3')}`, ax: -Lk, ay: Lk * Math.sqrt(3), steps: 'cos(π/3) = 1/2, sin(π/3) = √3/2' },
    ]);
    const [ha, hc] = g.pick<[number, number]>([[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5]]);
    const hs = isqrt(ha * ha + hc * hc), ht = g.random(0, 3);
    const vC = [g.random(-4, 4), g.random(-4, 4), g.random(-4, 4)];
    if (dot(vC, vC) === 0) vC[0] = 2;
    const cyA = g.random(2, 5), cyN = g.random(1, 2);
    let px = g.nonzero(-4, 4), py = g.nonzero(-4, 4), pvx = g.random(-4, 4), pvy = g.random(-4, 4);
    for (let i = 0; i < 50 && px * pvy - py * pvx === 0; i++) { pvx = g.nonzero(-4, 4); pvy = g.nonzero(-4, 4); }
    if (px * pvy - py * pvx === 0) { pvx = -py; pvy = px; }
    const detD = g.pick([0, 0, 1, -1, 2, -2, 3, 4, -5]);
    const T2 = sampleTriangle(g, false);
    const N2 = T2.N;
    const dd2 = dot(N2, T2.P);
    let line = { S: [0, 0, 0], V: [1, 1, 1], t: 1, X: [0, 0, 0] };
    for (let i = 0; i < 400; i++) {
      const V = [g.random(-2, 2), g.random(-2, 2), g.random(-2, 2)];
      if (dot(N2, V) === 0) continue;
      const alpha = g.random(-1, 2), beta = g.random(-1, 2), tt = g.nonzero(-3, 3);
      const Xp = add(T2.P, add(sub(T2.Q, T2.P).map(c => c * alpha), sub(T2.R, T2.P).map(c => c * beta)));
      line = { S: sub(Xp, V.map(c => c * tt)), V, t: tt, X: Xp };
      break;
    }
    if (dot(N2, line.V) === 0) { // fallback: a line along the first normal direction
      const V = N2.map(c => Math.sign(c)); const Xp = T2.P; line = { S: sub(Xp, V), V, t: 1, X: Xp };
    }
    const ladderShapes: FigureShape[] = [
      { kind: 'line', points: [[-L - 1, 0], [1, 0]], tone: 'axis' },
      { kind: 'line', points: [[0, -0.5], [0, L + 1]], tone: 'axis' },
      { kind: 'line', points: [[-L * Math.cos(PI / lad.d), 0], [0, L * Math.sin(PI / lad.d)]], tone: 'accent', width: 3 },
      { kind: 'point', at: [-L * Math.cos(PI / lad.d) / 2, L * Math.sin(PI / lad.d) / 2], tone: 'accent2', label: 'P' },
    ];
    const cosV = dot(qv, rv) / (lq * lr);

    return [
      g.number({
        id: 'angle', title: t('The angle between two position vectors', '两个位置向量的夹角'),
        prompt: t(`O is the origin, Q = ${vec(...qv)} and R = ${vec(...rv)}. Find cos ∠QOR. (|OQ| and |OR| are whole numbers.) Enter a fraction.`, `O 为原点，Q = ${vec(...qv)}，R = ${vec(...rv)}。求 cos ∠QOR。（|OQ| 与 |OR| 都是整数。）以分数输入。`),
        fields: [{ label: t('cos ∠QOR', 'cos ∠QOR'), answer: cosV }],
        hint: t('cos θ = (OQ · OR) / (|OQ||OR|).', 'cos θ = (OQ · OR) / (|OQ||OR|)。'),
        explanation: t(`OQ · OR = ${products(qv, rv)} = ${num(dot(qv, rv))}; |OQ| = ${lq}, |OR| = ${lr}. So cos θ = ${frac(dot(qv, rv), lq * lr)}.`, `OQ · OR = ${products(qv, rv)} = ${num(dot(qv, rv))}；|OQ| = ${lq}，|OR| = ${lr}。所以 cos θ = ${frac(dot(qv, rv), lq * lr)}。`),
        audit: { kind: 'MIT-MV-15:angle', params: { q: qv, r: rv } },
      }),
      g.number({
        id: 'triangle-area', title: t('Area of a space triangle', '空间三角形的面积'),
        prompt: t(`Find the area of the triangle with vertices P = ${vec(...T.P)}, Q = ${vec(...T.Q)}, R = ${vec(...T.R)}. (|PQ × PR| is a whole number.) Enter a fraction or decimal.`, `求顶点为 P = ${vec(...T.P)}、Q = ${vec(...T.Q)}、R = ${vec(...T.R)} 的三角形面积。（|PQ × PR| 为整数。）以分数或小数输入。`),
        fields: [{ label: t('area', '面积'), answer: T.m / 2 }],
        hint: t('Area = ½|PQ × PR|.', '面积 = ½|PQ × PR|。'),
        explanation: t(`PQ = ${vec(...sub(T.Q, T.P))}, PR = ${vec(...sub(T.R, T.P))}, PQ × PR = ${vec(...T.N)}, |PQ × PR| = ${T.m}. Area = ${frac(T.m, 2)}.`, `PQ = ${vec(...sub(T.Q, T.P))}，PR = ${vec(...sub(T.R, T.P))}，PQ × PR = ${vec(...T.N)}，|PQ × PR| = ${T.m}。面积 = ${frac(T.m, 2)}。`),
        audit: { kind: 'MIT-MV-15:triangle-area', params: { p: T.P, q: T.Q, r: T.R } },
      }),
      g.number({
        id: 'plane-constant', title: t('The plane through three points', '过三点的平面'),
        prompt: t(`The plane through P = ${vec(...T.P)}, Q = ${vec(...T.Q)}, R = ${vec(...T.R)} is ax + by + cz = d with (a, b, c) = PQ × PR exactly (no scaling). Find a, b, c and d.`, `过 P = ${vec(...T.P)}、Q = ${vec(...T.Q)}、R = ${vec(...T.R)} 的平面为 ax + by + cz = d，其中 (a, b, c) = PQ × PR（不作缩放）。求 a、b、c 与 d。`),
        fields: [{ label: t('a', 'a'), answer: T.N[0] }, { label: t('b', 'b'), answer: T.N[1] }, { label: t('c', 'c'), answer: T.N[2] }, { label: t('d', 'd'), answer: dot(T.N, T.P) }],
        hint: t('The normal is PQ × PR; then d = N · P because P lies on the plane.', '法向量为 PQ × PR；再由 P 在平面上得 d = N · P。'),
        explanation: t(`N = PQ × PR = ${vec(...T.N)}, and d = N · P = ${products(T.N, T.P)} = ${num(dot(T.N, T.P))}. The plane is ${linear(T.N, ['x', 'y', 'z'])} = ${num(dot(T.N, T.P))}.`, `N = PQ × PR = ${vec(...T.N)}，d = N · P = ${products(T.N, T.P)} = ${num(dot(T.N, T.P))}。平面为 ${linear(T.N, ['x', 'y', 'z'])} = ${num(dot(T.N, T.P))}。`),
        audit: { kind: 'MIT-MV-15:plane-constant', params: { p: T.P, q: T.Q, r: T.R } },
      }),
      g.number({
        id: 'solve-system', title: t('Solve a system with the inverse', '用逆矩阵解方程组'),
        prompt: t(`Solve M·(x, y, z) = B, where the equations are ${sys(M, B).join(';  ')}. You may use M⁻¹ = (1/D)·K with D = ${num(D)} and K = rows ${K.map(row => vec(...row)).join(', ')}.`, `解 M·(x, y, z) = B，方程为 ${sys(M, B).join('；  ')}。可使用 M⁻¹ = (1/D)·K，其中 D = ${num(D)}，K 的各行为 ${K.map(row => vec(...row)).join('，')}。`),
        fields: [{ label: t('x', 'x'), answer: X[0] }, { label: t('y', 'y'), answer: X[1] }, { label: t('z', 'z'), answer: X[2] }],
        hint: t('X = M⁻¹B = (1/D)·K·B: dot each row of K with B, then divide by D.', 'X = M⁻¹B = (1/D)·K·B：把 K 的每一行与 B 点乘，再除以 D。'),
        explanation: t(`B = ${vec(...B)}. Row 1 of K · B = ${products(K[0], B)} = ${num(dot(K[0], B))}, row 2: ${num(dot(K[1], B))}, row 3: ${num(dot(K[2], B))}. Dividing by D = ${num(D)}: (x, y, z) = ${vec(...X)}. Check in the first equation: ${products(M[0], X)} = ${num(B[0])}.`, `B = ${vec(...B)}。K 的第 1 行与 B 的点积 = ${products(K[0], B)} = ${num(dot(K[0], B))}，第 2 行：${num(dot(K[1], B))}，第 3 行：${num(dot(K[2], B))}。除以 D = ${num(D)}：(x, y, z) = ${vec(...X)}。在第一个方程中检验：${products(M[0], X)} = ${num(B[0])}。`),
        audit: { kind: 'MIT-MV-15:solve-system', params: { m: M.flat(), b: B } },
      }),
      g.number({
        id: 'singular-c', title: t('When is a matrix not invertible?', '矩阵何时不可逆？'),
        prompt: t(`The matrix M has rows U = (${num(sing.u1)}, ${num(sing.u2)}, c), V = ${vec(...sing.V)} and W = ${vec(...sing.W)}. Find the value of c for which M is not invertible.`, `矩阵 M 的各行为 U = (${num(sing.u1)}, ${num(sing.u2)}, c)、V = ${vec(...sing.V)}、W = ${vec(...sing.W)}。求使 M 不可逆的 c 值。`),
        fields: [{ label: t('c', 'c'), answer: sing.c }],
        hint: t('Not invertible means det M = 0, and det M = U · (V × W).', '不可逆意味着 det M = 0，而 det M = U · (V × W)。'),
        explanation: t(`V × W = ${vec(...cross(sing.V, sing.W))}, so det M = U · (V × W) = ${num(sing.u1)}·${par(cross(sing.V, sing.W)[0])} + ${par(sing.u2)}·${par(cross(sing.V, sing.W)[1])} + c·${par(cross(sing.V, sing.W)[2])} = ${num(sing.u1 * cross(sing.V, sing.W)[0] + sing.u2 * cross(sing.V, sing.W)[1])} ${cross(sing.V, sing.W)[2] < 0 ? '−' : '+'} ${coef(Math.abs(cross(sing.V, sing.W)[2]), 'c')}. Setting this to 0 gives c = ${num(sing.c)}.`, `V × W = ${vec(...cross(sing.V, sing.W))}，所以 det M = U · (V × W) = ${num(sing.u1)}·${par(cross(sing.V, sing.W)[0])} + ${par(sing.u2)}·${par(cross(sing.V, sing.W)[1])} + c·${par(cross(sing.V, sing.W)[2])} = ${num(sing.u1 * cross(sing.V, sing.W)[0] + sing.u2 * cross(sing.V, sing.W)[1])} ${cross(sing.V, sing.W)[2] < 0 ? '−' : '+'} ${coef(Math.abs(cross(sing.V, sing.W)[2]), 'c')}。令其为 0，得 c = ${num(sing.c)}。`),
        audit: { kind: 'MIT-MV-15:singular-c', params: { u1: sing.u1, u2: sing.u2, v: sing.V, w: sing.W } },
      }),
      g.number({
        id: 'ladder', title: t('The midpoint of a sliding ladder', '滑动梯子的中点'),
        prompt: t(`A ladder of length L = ${L} leans with its top on the wall (the y-axis) and its foot on the ground (the x-axis, to the left of the wall). The ladder makes the angle θ = π/${lad.d} with the ground. Find the coordinates of its midpoint P. Enter exact values such as −2 or 3sqrt(3).`, `长度 L = ${L} 的梯子，顶端靠在墙上（y 轴），底端在地面上（x 轴，位于墙的左侧）。梯子与地面的夹角为 θ = π/${lad.d}。求其中点 P 的坐标。输入精确值，如 −2 或 3sqrt(3)。`),
        figure: g.figure({ alt: t(`A ladder drawn from a point on the horizontal axis (the ground, to the left of the origin) up to a point on the vertical axis (the wall), making an angle π/${lad.d} with the ground; its midpoint P is marked.`, `一架梯子从水平轴（地面，原点左侧）上的一点画到竖直轴（墙）上的一点，与地面夹角为 π/${lad.d}；中点 P 已标出。`), view: fitView(ladderShapes, 0.1), shapes: ladderShapes }),
        fields: [{ label: t('x', 'x'), answer: lad.ax }, { label: t('y', 'y'), answer: lad.ay }],
        hint: t('The foot is at (−L cos θ, 0) and the top at (0, L sin θ); the midpoint is their average.', '底端在 (−L cos θ, 0)，顶端在 (0, L sin θ)；中点是它们的平均。'),
        explanation: t(`With ${lad.steps}: foot = (−${L} cos θ, 0), top = (0, ${L} sin θ). The midpoint is (−${L / 2} cos θ, ${L / 2} sin θ) = (${lad.x}, ${lad.y}).`, `由 ${lad.steps}：底端 = (−${L} cos θ, 0)，顶端 = (0, ${L} sin θ)。中点为 (−${L / 2} cos θ, ${L / 2} sin θ) = (${lad.x}, ${lad.y})。`),
        audit: { kind: 'MIT-MV-15:ladder', params: { L, d: lad.d } },
      }),
      g.number({
        id: 'helix-speed', title: t('Speed along a helix', '螺旋线上的速率'),
        prompt: t(`A point moves along r(t) = (${coef(hc, 't')}, ${coef(ha, 'cos t')}, ${coef(ha, 'sin t')}). Find its speed |v| at t = ${ht}.`, `点沿 r(t) = (${coef(hc, 't')}, ${coef(ha, 'cos t')}, ${coef(ha, 'sin t')}) 运动。求 t = ${ht} 时的速率 |v|。`),
        fields: [{ label: t('|v|', '|v|'), answer: hs }],
        hint: t('v = r′(t); the speed is its length. Use cos² + sin² = 1.', 'v = r′(t)；速率是它的长度。用 cos² + sin² = 1。'),
        explanation: t(`v = (${hc}, −${ha} sin t, ${ha} cos t), so |v|² = ${hc * hc} + ${ha * ha}(sin² t + cos² t) = ${hc * hc + ha * ha}, |v| = ${hs} for every t, in particular at t = ${ht}.`, `v = (${hc}, −${ha} sin t, ${ha} cos t)，所以 |v|² = ${hc * hc} + ${ha * ha}(sin² t + cos² t) = ${hc * hc + ha * ha}，对每个 t（包括 t = ${ht}）都有 |v| = ${hs}。`),
        audit: { kind: 'MIT-MV-15:helix-speed', params: { a: ha, c: hc, t: ht } },
      }),
      g.number({
        id: 'constant-length', title: t('Motion at constant distance from the origin', '到原点距离不变的运动'),
        prompt: t(`A point moves so that |R(t)| is constant (it stays on a sphere centered at the origin). At one instant its velocity is V = ${vec(...vC)}. Find R · A, where A is the acceleration at that instant.`, `点的运动使 |R(t)| 为常数（它始终在以原点为球心的球面上）。某一时刻它的速度为 V = ${vec(...vC)}。求 R · A，其中 A 是该时刻的加速度。`),
        fields: [{ label: t('R · A', 'R · A'), answer: -dot(vC, vC) }],
        hint: t('Differentiate R · R = constant, then differentiate R · V = 0.', '对 R · R = 常数求导，再对 R · V = 0 求导。'),
        explanation: t(`R · R is constant, so 2R · V = 0. Differentiating R · V = 0 gives V · V + R · A = 0, so R · A = −|V|² = −(${vC.map(c => `${par(c)}²`).join(' + ')}) = ${num(-dot(vC, vC))}.`, `R · R 为常数，所以 2R · V = 0。对 R · V = 0 求导得 V · V + R · A = 0，所以 R · A = −|V|² = −(${vC.map(c => `${par(c)}²`).join(' + ')}) = ${num(-dot(vC, vC))}。`),
        audit: { kind: 'MIT-MV-15:constant-length', params: { v: vC } },
      }),
      g.number({
        id: 'cycloid-arch', title: t('Length of cycloid arches', '摆线拱的长度'),
        prompt: t(`The cycloid x = a(t − sin t), y = a(1 − cos t) has a = ${cyA}. Find the arc length for 0 ≤ t ≤ ${2 * cyN}π (${cyN} arch${cyN === 1 ? '' : 'es'}).`, `摆线 x = a(t − sin t)，y = a(1 − cos t)，a = ${cyA}。求 0 ≤ t ≤ ${2 * cyN}π（${cyN} 个拱）上的弧长。`),
        fields: [{ label: t('arc length', '弧长'), answer: 8 * cyA * cyN }],
        hint: t('The speed is |v| = 2a|sin(t/2)|; integrate it over one arch and multiply.', '速率为 |v| = 2a|sin(t/2)|；在一个拱上积分，再乘以拱数。'),
        explanation: t(`One arch: ∫₀^{2π} 2a sin(t/2) dt = 8a = ${8 * cyA}. For ${cyN} arch${cyN === 1 ? '' : 'es'}: ${8 * cyA * cyN}.`, `一个拱：∫₀^{2π} 2a sin(t/2) dt = 8a = ${8 * cyA}。${cyN} 个拱：${8 * cyA * cyN}。`),
        audit: { kind: 'MIT-MV-15:cycloid-arch', params: { a: cyA, n: cyN } },
      }),
      g.number({
        id: 'area-rate', title: t('Kepler’s area rate', '开普勒面积速度'),
        prompt: t(`Under a central force from the sun at the origin, a planet at r = ${vec(px, py)} has velocity v = ${vec(pvx, pvy)}. Find the area rate dA/dt = ½|r × v|, where (r × v)_z = x·v_y − y·v_x.`, `在来自原点处太阳的中心力作用下，行星位于 r = ${vec(px, py)}，速度为 v = ${vec(pvx, pvy)}。求面积速度 dA/dt = ½|r × v|，其中 (r × v)_z = x·v_y − y·v_x。`),
        fields: [{ label: t('dA/dt', 'dA/dt'), answer: Math.abs(px * pvy - py * pvx) / 2 }],
        hint: t('Compute x·v_y − y·v_x, take the absolute value, halve it.', '计算 x·v_y − y·v_x，取绝对值，再除以 2。'),
        explanation: t(`(r × v)_z = ${par(px)}·${par(pvy)} − ${par(py)}·${par(pvx)} = ${num(px * pvy - py * pvx)}, so dA/dt = ${frac(Math.abs(px * pvy - py * pvx), 2)}; by Kepler’s second law this is the same at every time.`, `(r × v)_z = ${par(px)}·${par(pvy)} − ${par(py)}·${par(pvx)} = ${num(px * pvy - py * pvx)}，所以 dA/dt = ${frac(Math.abs(px * pvy - py * pvx), 2)}；由开普勒第二定律，它在任何时刻都相同。`),
        audit: { kind: 'MIT-MV-15:area-rate', params: { x: px, y: py, vx: pvx, vy: pvy } },
      }),
      g.choice({
        id: 'det-zero', title: t('What does det M say about M X = 0?', 'det M 对 M X = 0 意味着什么？'),
        prompt: t(`A 3×3 matrix M has det M = ${num(detD)}. How many solutions X does the system M X = 0 have?`, `3×3 矩阵 M 的 det M = ${num(detD)}。方程组 M X = 0 有多少个解 X？`),
        options: [t('Only X = 0', '只有 X = 0'), t('Infinitely many solutions, including X = 0', '有无穷多个解（包括 X = 0）'), t('No solutions', '无解')], correct: detD === 0 ? 1 : 0,
        hint: t('X = 0 always solves M X = 0. Ask whether M is invertible.', 'X = 0 总是 M X = 0 的解。想想 M 是否可逆。'),
        explanation: t(detD === 0 ? 'det M = 0, so M is not invertible and M X = 0 has non-zero solutions too (they are the vectors orthogonal to every row; if two rows are linearly independent, their cross product is one such non-zero vector). So there are infinitely many.' : `det M = ${num(detD)} ≠ 0, so M is invertible and X = M⁻¹·0 = 0 is the only solution.`, detD === 0 ? 'det M = 0，所以 M 不可逆，M X = 0 还有非零解（它们是与每一行都正交的向量；若有两行线性无关，它们的叉积就是这样一个非零向量）。因此有无穷多个解。' : `det M = ${num(detD)} ≠ 0，所以 M 可逆，X = M⁻¹·0 = 0 是唯一解。`),
        audit: { kind: 'MIT-MV-15:det-zero', params: { D: detD } },
      }),
      g.choice({
        id: 'norm-claim', title: t('What does R · V = 0 for all t justify?', 'R · V 恒为 0 能推出什么？'),
        prompt: t('A point has position R(t) and velocity V(t), and R · V = 0 for every t. Which conclusion is justified?', '一点的位置为 R(t)，速度为 V(t)，且对每个 t 都有 R · V = 0。哪个结论成立？'),
        options: [t('|R| is constant, because d/dt (R · R) = 2R · V = 0.', '|R| 为常数，因为 d/dt (R · R) = 2R · V = 0。'), t('|V| is constant.', '|V| 为常数。'), t('V = 0 for every t.', '对每个 t 都有 V = 0。')], correct: 0,
        hint: t('Differentiate R · R and use the product rule for dot products.', '对 R · R 求导，并用点积的乘积法则。'),
        explanation: t('d/dt (R · R) = R′ · R + R · R′ = 2R · V = 0, so |R|² is constant. Nothing forces |V| to be constant or V to vanish: for example R = (cos t², sin t²) has R · V = 0 but a changing speed.', 'd/dt (R · R) = R′ · R + R · R′ = 2R · V = 0，所以 |R|² 为常数。没有任何条件迫使 |V| 为常数或 V 为零：例如 R = (cos t², sin t²) 满足 R · V = 0，但速率在变化。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`The plane contains P = ${vec(...T2.P)}, Q = ${vec(...T2.Q)} and R = ${vec(...T2.R)}. The line through S = ${vec(...line.S)} parallel to V = ${vec(...line.V)} meets the plane at the point S + tV. Find t.`, `平面含点 P = ${vec(...T2.P)}、Q = ${vec(...T2.Q)}、R = ${vec(...T2.R)}。过 S = ${vec(...line.S)} 且平行于 V = ${vec(...line.V)} 的直线与平面交于点 S + tV。求 t。`),
        fields: [{ label: t('t', 't'), answer: line.t }],
        hint: t('Find the plane equation N · X = d first; then require N · (S + tV) = d.', '先求平面方程 N · X = d；再要求 N · (S + tV) = d。'),
        explanation: t(`N = PQ × PR = ${vec(...N2)}, d = N · P = ${num(dd2)}. Then N · (S + tV) = ${num(dot(N2, line.S))} + t·${par(dot(N2, line.V))} = ${num(dd2)}, so t = ${num(line.t)} and the point is ${vec(...line.X)}. This review practised computation only; geometric visualization and proofs are not covered here.`, `N = PQ × PR = ${vec(...N2)}，d = N · P = ${num(dd2)}。于是 N · (S + tV) = ${num(dot(N2, line.S))} + t·${par(dot(N2, line.V))} = ${num(dd2)}，所以 t = ${num(line.t)}，交点为 ${vec(...line.X)}。本复习只练习计算；几何想象和证明不在本题范围内。`),
        audit: { kind: 'MIT-MV-15:challenge', params: { p: T2.P, q: T2.Q, r: T2.R, s: line.S, v: line.V } },
      }),
    ];
  },

  // ---------------------------------------------------------------------------------------------------------------
  'MIT-MV-16': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-16');
    for (let i = 0; i < 4; i++) g.random(0, 1); // warm up the generator: the first draws of an LCG are nearly constant for neighbouring seeds
    // b is the y-coordinate of Q; each leg [a, h] has a² + b² = h², so |QP| and |QR| are whole numbers.
    const BETAS: { b: number; legs: [number, number][] }[] = [
      { b: 3, legs: [[4, 5]] }, { b: 4, legs: [[3, 5]] }, { b: 5, legs: [[12, 13]] }, { b: 6, legs: [[8, 10]] },
      { b: 7, legs: [[24, 25]] }, { b: 8, legs: [[6, 10], [15, 17]] }, { b: 9, legs: [[12, 15]] }, { b: 10, legs: [[24, 26]] },
      { b: 12, legs: [[5, 13], [9, 15], [16, 20]] }, { b: 15, legs: [[8, 17], [20, 25]] }, { b: 20, legs: [[15, 25], [21, 29]] },
    ];
    const bet = g.pick(BETAS);
    const [alAbs, h1] = g.pick(bet.legs), [gaAbs, h2] = g.pick(bet.legs), be = bet.b;
    const al = g.pick([1, -1]) * alAbs, ga = g.pick([1, -1]) * gaAbs; // P and R may lie on the negative axes: QP · QR = b² either way
    const T = sampleTriangle(g, true);
    const plane = linear(T.N, ['x', 'y', 'z']);
    const dT = dot(T.N, T.P);
    // parallel-line card: direction D with N·D = 0 (or not), small integer entries
    const dirs: number[][] = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) if (i || j || k) dirs.push([i, j, k]);
    const wantParallel = g.random(0, 1) === 1;
    const okDirs = dirs.filter(d => (dot(T.N, d) === 0) === wantParallel);
    // A must not lie on the plane, so "parallel" is unambiguous (a line inside the plane would be a borderline case)
    let lineA = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
    for (let i = 0; i < 200 && dot(T.N, lineA) === dT; i++) lineA = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
    if (dot(T.N, lineA) === dT) lineA = add(T.P, T.N); // fallback: P + N is off the plane since |N|² > 0
    const lineD = okDirs.length ? g.pick(okDirs) : [1, 0, 0];
    const lineB = add(lineA, lineD);
    const isPar = dot(T.N, sub(lineB, lineA)) === 0;
    const u = g.random(2, 12);
    const M = sampleMatrix(g, 9), D = det3(M), K = adjugate(M);
    const ij = [g.random(1, 3), g.random(1, 3)];
    const X1 = [g.random(-2, 3), g.random(-2, 3), g.random(-2, 3)];
    const B1 = M.map(row => dot(row, X1));
    // plane motion
    const pm = (() => {
      for (let i = 0; i < 400; i++) {
        const a = g.nonzero(-4, 4), b = g.nonzero(-4, 4), c = g.pick([1, -1, 2, -2]), d = g.random(-6, 6), v1 = g.random(-3, 3), v2 = g.random(-3, 3);
        const top = -(a * v1 + b * v2);
        if (top % c === 0) return { a, b, c, d, v1, v2, v3: nz(top / c) };
      }
      return { a: 4, b: -3, c: -2, d: 6, v1: 1, v2: 2, v3: -1 };
    })();
    const pmS = pm.a * pm.v1 + pm.b * pm.v2, cTerm = pm.c === 1 ? 'v₃' : `${par(pm.c)}·v₃`;
    const planeNormal = [g.nonzero(-4, 4), g.nonzero(-4, 4), g.nonzero(-4, 4)], planeD = g.random(-6, 6);
    const unD = g.pick([0, 0, 1, -1, 2, -3, 4, -5, 7, -12]);
    // challenge
    const M2 = sampleMatrix(g, 6), D2 = det3(M2), K2 = adjugate(M2), c1 = g.random(-3, 3), c3 = g.random(-3, 3);
    const dr = [K2[0][1] / D2, K2[1][1] / D2, K2[2][1] / D2];
    const drText = [frac(cofactors(M2)[1][0], D2), frac(cofactors(M2)[1][1], D2), frac(cofactors(M2)[1][2], D2)];

    const semi: FigureShape[] = [
      { kind: 'line', points: [[-1.6, 0], [2.8, 0]], tone: 'axis' },
      { kind: 'line', points: sampleCurve(s => [Math.cos(s), Math.sin(s)] as Pt, 0, PI, 48), tone: 'accent', width: 2 },
      { kind: 'point', at: [1, 0], tone: 'accent2', label: 'start' },
      { kind: 'arrow', from: [0, -0.35], to: [1.2, -0.35], tone: 'warn', label: 'u' },
    ];
    const cof2 = cofactors(M2);

    return [
      g.number({
        id: 'cosine', title: t('The angle at Q', 'Q 处的夹角'),
        prompt: t(`P, Q and R are the points at ${num(al)} on the x-axis, ${be} on the y-axis and ${num(ga)} on the z-axis: P = ${vec(al, 0, 0)}, Q = ${vec(0, be, 0)}, R = ${vec(0, 0, ga)}. Find cos ∠PQR, the cosine of the angle at Q between QP and QR. (|QP| and |QR| are whole numbers.) Enter a fraction.`, `P、Q、R 分别是 x 轴上 ${num(al)} 处、y 轴上 ${be} 处、z 轴上 ${num(ga)} 处的点：P = ${vec(al, 0, 0)}，Q = ${vec(0, be, 0)}，R = ${vec(0, 0, ga)}。求 cos ∠PQR，即 QP 与 QR 在 Q 处夹角的余弦。（|QP| 与 |QR| 都是整数。）以分数输入。`),
        fields: [{ label: t('cos ∠PQR', 'cos ∠PQR'), answer: be * be / (h1 * h2) }],
        hint: t('Write QP = P − Q and QR = R − Q, then use cos θ = QP · QR / (|QP||QR|).', '写出 QP = P − Q 与 QR = R − Q，再用 cos θ = QP · QR / (|QP||QR|)。'),
        explanation: t(`QP = ${vec(al, -be, 0)}, QR = ${vec(0, -be, ga)}. QP · QR = ${par(al)}·0 + ${par(-be)}·${par(-be)} + 0·${par(ga)} = ${be * be}, |QP| = ${h1}, |QR| = ${h2}. So cos ∠PQR = ${frac(be * be, h1 * h2)}.`, `QP = ${vec(al, -be, 0)}，QR = ${vec(0, -be, ga)}。QP · QR = ${par(al)}·0 + ${par(-be)}·${par(-be)} + 0·${par(ga)} = ${be * be}，|QP| = ${h1}，|QR| = ${h2}。所以 cos ∠PQR = ${frac(be * be, h1 * h2)}。`),
        audit: { kind: 'MIT-MV-16:cosine', params: { alpha: al, beta: be, gamma: ga } },
      }),
      g.number({
        id: 'area', title: t('Area of the triangle', '三角形的面积'),
        prompt: t(`Let P = ${vec(...T.P)}, Q = ${vec(...T.Q)} and R = ${vec(...T.R)}. Find the area of triangle PQR. (|PQ × PR| is a whole number.) Enter a fraction or decimal.`, `设 P = ${vec(...T.P)}，Q = ${vec(...T.Q)}，R = ${vec(...T.R)}。求三角形 PQR 的面积。（|PQ × PR| 为整数。）以分数或小数输入。`),
        fields: [{ label: t('area', '面积'), answer: T.m / 2 }],
        hint: t('Area = ½|PQ × PR|.', '面积 = ½|PQ × PR|。'),
        explanation: t(`PQ = ${vec(...sub(T.Q, T.P))}, PR = ${vec(...sub(T.R, T.P))}, PQ × PR = ${vec(...T.N)} with length ${T.m}. Area = ${frac(T.m, 2)}.`, `PQ = ${vec(...sub(T.Q, T.P))}，PR = ${vec(...sub(T.R, T.P))}，PQ × PR = ${vec(...T.N)}，长度为 ${T.m}。面积 = ${frac(T.m, 2)}。`),
        audit: { kind: 'MIT-MV-16:area', params: { p: T.P, q: T.Q, r: T.R } },
      }),
      g.number({
        id: 'plane', title: t('The plane through P, Q, R', '过 P、Q、R 的平面'),
        prompt: t(`For the same P = ${vec(...T.P)}, Q = ${vec(...T.Q)}, R = ${vec(...T.R)}, write the plane as ax + by + cz = d with (a, b, c) = PQ × PR exactly (no scaling). Find a, b, c and d.`, `对同样的 P = ${vec(...T.P)}，Q = ${vec(...T.Q)}，R = ${vec(...T.R)}，把平面写成 ax + by + cz = d，其中 (a, b, c) = PQ × PR（不作缩放）。求 a、b、c 与 d。`),
        fields: [{ label: t('a', 'a'), answer: T.N[0] }, { label: t('b', 'b'), answer: T.N[1] }, { label: t('c', 'c'), answer: T.N[2] }, { label: t('d', 'd'), answer: dT }],
        hint: t('The normal is PQ × PR. Then d = N · P.', '法向量为 PQ × PR。然后 d = N · P。'),
        explanation: t(`N = ${vec(...T.N)} and d = N · P = ${products(T.N, T.P)} = ${num(dT)}; the plane is ${plane} = ${num(dT)}. Check with Q: N · Q = ${num(dot(T.N, T.Q))}.`, `N = ${vec(...T.N)}，d = N · P = ${products(T.N, T.P)} = ${num(dT)}；平面为 ${plane} = ${num(dT)}。用 Q 检验：N · Q = ${num(dot(T.N, T.Q))}。`),
        audit: { kind: 'MIT-MV-16:plane', params: { p: T.P, q: T.Q, r: T.R } },
      }),
      g.number({
        id: 'bug-position', title: t('A ladybug on a moving car', '移动汽车上的瓢虫'),
        prompt: t(`A car’s surface is the unit semicircle x² + y² = 1, y ≥ 0 at t = 0, and the road is the x-axis. A ladybug starts at the front bumper (1, 0) at t = 0 and walks counterclockwise around the car at unit speed relative to the car. At the same time the car moves to the right at speed u = ${u}. Find the bug’s position (relative to the road) at t = π/2. Enter x as a multiple of π, e.g. 3pi.`, `汽车的表面在 t = 0 时是单位半圆 x² + y² = 1，y ≥ 0，路面是 x 轴。瓢虫在 t = 0 时从车头保险杠 (1, 0) 出发，相对于汽车以单位速率逆时针绕汽车行走。同时汽车以速率 u = ${u} 向右行驶。求 t = π/2 时瓢虫（相对于路面）的位置。x 以 π 的倍数输入，例如 3pi。`),
        figure: g.figure({ alt: t(`The unit semicircle above the x-axis (the car), the x-axis (the road), the start point (1, 0), and an arrow below the axis pointing right for the car’s motion at speed u = ${u}.`, `x 轴上方的单位半圆（汽车）、x 轴（路面）、起点 (1, 0)，以及轴下方向右的箭头，表示汽车以速率 u = ${u} 行驶。`), view: { xmin: -1.8, xmax: 3, ymin: -0.8, ymax: 1.4 }, shapes: semi }),
        fields: [{ label: t('x', 'x'), answer: u * PI / 2 }, { label: t('y', 'y'), answer: 1 }],
        hint: t('Position = (car’s displacement) + (position on the semicircle): r(t) = (u t + cos t, sin t). Then put t = π/2.', '位置 = （汽车的位移）+（半圆上的位置）：r(t) = (u t + cos t, sin t)。再取 t = π/2。'),
        explanation: t(`The car’s center moves to (${u}t, 0) and the bug is at (cos t, sin t) relative to it, so r(t) = (${u}t + cos t, sin t). At t = π/2: cos t = 0, sin t = 1, so r = (${u}π/2, 1).`, `汽车中心移到 (${u}t, 0)，瓢虫相对于它位于 (cos t, sin t)，所以 r(t) = (${u}t + cos t, sin t)。t = π/2 时：cos t = 0，sin t = 1，所以 r = (${u}π/2, 1)。`),
        audit: { kind: 'MIT-MV-16:bug-position', params: { u } },
      }),
      g.number({
        id: 'bug-speed', title: t('The bug’s speed', '瓢虫的速率'),
        prompt: t(`For the ladybug above (car speed u = ${u}, r(t) = (${u}t + cos t, sin t)), the bug walks from the front bumper to the rear bumper, 0 ≤ t ≤ π. Find the smallest and the largest value of |v|² in that time.`, `对上面的瓢虫（汽车速率 u = ${u}，r(t) = (${u}t + cos t, sin t)），它从车头走到车尾，0 ≤ t ≤ π。求这段时间内 |v|² 的最小值和最大值。`),
        fields: [{ label: t('smallest |v|²', '|v|² 的最小值'), answer: (u - 1) ** 2 }, { label: t('largest |v|²', '|v|² 的最大值'), answer: u * u + 1 }],
        hint: t('Work with |v|² = (u − sin t)² + cos² t = u² + 1 − 2u sin t. On 0 ≤ t ≤ π, sin t goes from 0 up to 1 and back to 0.', '用 |v|² = (u − sin t)² + cos² t = u² + 1 − 2u sin t。在 0 ≤ t ≤ π 上，sin t 从 0 升到 1 再回到 0。'),
        explanation: t(`v = (${u} − sin t, cos t), so |v|² = ${u * u} + 1 − ${2 * u} sin t. It is smallest when sin t = 1 (t = π/2): |v|² = ${(u - 1) ** 2} (the smallest speed is |v| = ${u - 1}). It is largest when sin t = 0 (t = 0 or π): |v|² = ${u * u + 1}.`, `v = (${u} − sin t, cos t)，所以 |v|² = ${u * u} + 1 − ${2 * u} sin t。sin t = 1（t = π/2）时最小：|v|² = ${(u - 1) ** 2}（最小速率为 |v| = ${u - 1}）。sin t = 0（t = 0 或 π）时最大：|v|² = ${u * u + 1}。`),
        audit: { kind: 'MIT-MV-16:bug-speed', params: { u } },
      }),
      g.number({
        id: 'det', title: t('Determinant of M', 'M 的行列式'),
        prompt: t(`The matrix M has rows ${M.map(row => vec(...row)).join(', ')}. Find det M.`, `矩阵 M 的各行为 ${M.map(row => vec(...row)).join('，')}。求 det M。`),
        fields: [{ label: t('det M', 'det M'), answer: D }],
        hint: t('Expand along the first row: a(ei − fh) − b(di − fg) + c(dh − eg).', '沿第一行展开：a(ei − fh) − b(di − fg) + c(dh − eg)。'),
        explanation: t(`det M = ${par(M[0][0])}·(${par(M[1][1])}·${par(M[2][2])} − ${par(M[1][2])}·${par(M[2][1])}) − ${par(M[0][1])}·(${par(M[1][0])}·${par(M[2][2])} − ${par(M[1][2])}·${par(M[2][0])}) + ${par(M[0][2])}·(${par(M[1][0])}·${par(M[2][1])} − ${par(M[1][1])}·${par(M[2][0])}) = ${num(D)}.`, `det M = ${par(M[0][0])}·(${par(M[1][1])}·${par(M[2][2])} − ${par(M[1][2])}·${par(M[2][1])}) − ${par(M[0][1])}·(${par(M[1][0])}·${par(M[2][2])} − ${par(M[1][2])}·${par(M[2][0])}) + ${par(M[0][2])}·(${par(M[1][0])}·${par(M[2][1])} − ${par(M[1][1])}·${par(M[2][0])}) = ${num(D)}。`),
        audit: { kind: 'MIT-MV-16:det', params: { m: M.flat() } },
      }),
      g.number({
        id: 'inverse-entry', title: t('An entry of the adjugate', '伴随矩阵的一项'),
        prompt: t(`For the same M with rows ${M.map(row => vec(...row)).join(', ')}, write M⁻¹ = (1/det M)·K, where K is the adjugate of M (the transpose of the matrix of cofactors). Find the entry of K in row ${ij[0]}, column ${ij[1]}.`, `对同样的 M（各行为 ${M.map(row => vec(...row)).join('，')}），写 M⁻¹ = (1/det M)·K，其中 K 是 M 的伴随矩阵（代数余子式矩阵的转置）。求 K 的第 ${ij[0]} 行第 ${ij[1]} 列的元素。`),
        fields: [{ label: t(`K row ${ij[0]}, column ${ij[1]}`, `K 第 ${ij[0]} 行第 ${ij[1]} 列`), answer: K[ij[0] - 1][ij[1] - 1] }],
        hint: t(`K[i][j] is the cofactor of M at row j, column i: delete row ${ij[1]} and column ${ij[0]} of M, take the 2×2 determinant, and apply the sign (−1)^(i+j).`, `K[i][j] 是 M 在第 j 行第 i 列的代数余子式：划去 M 的第 ${ij[1]} 行和第 ${ij[0]} 列，取 2×2 行列式，再乘以符号 (−1)^(i+j)。`),
        explanation: t(`Delete row ${ij[1]} and column ${ij[0]} of M; the remaining 2×2 determinant times (−1)^${ij[0] + ij[1]} is ${num(K[ij[0] - 1][ij[1] - 1])}. (Check: M·K = det M·I; here det M = ${num(D)}.)`, `划去 M 的第 ${ij[1]} 行和第 ${ij[0]} 列，剩下的 2×2 行列式乘以 (−1)^${ij[0] + ij[1]} 得 ${num(K[ij[0] - 1][ij[1] - 1])}。（检验：M·K = det M·I；此处 det M = ${num(D)}。）`),
        audit: { kind: 'MIT-MV-16:inverse-entry', params: { m: M.flat(), i: ij[0], j: ij[1] } },
      }),
      g.number({
        id: 'solve-system', title: t('Solving M X = B with the inverse', '用逆矩阵解 M X = B'),
        prompt: t(`Solve M·(x, y, z) = B, where the equations are ${sys(M, B1).join(';  ')}. You may use M⁻¹ = (1/D)·K with D = ${num(D)} and K = rows ${K.map(row => vec(...row)).join(', ')}.`, `解 M·(x, y, z) = B，方程为 ${sys(M, B1).join('；  ')}。可使用 M⁻¹ = (1/D)·K，其中 D = ${num(D)}，K 的各行为 ${K.map(row => vec(...row)).join('，')}。`),
        fields: [{ label: t('x', 'x'), answer: X1[0] }, { label: t('y', 'y'), answer: X1[1] }, { label: t('z', 'z'), answer: X1[2] }],
        hint: t('X = (1/D)·K·B: dot each row of K with B and divide by D.', 'X = (1/D)·K·B：把 K 的每一行与 B 点乘，再除以 D。'),
        explanation: t(`B = ${vec(...B1)}. K·B = (${products(K[0], B1)}, ${products(K[1], B1)}, ${products(K[2], B1)}) = ${vec(...K.map(row => dot(row, B1)))}. Dividing by D = ${num(D)} gives (x, y, z) = ${vec(...X1)}.`, `B = ${vec(...B1)}。K·B = (${products(K[0], B1)}, ${products(K[1], B1)}, ${products(K[2], B1)}) = ${vec(...K.map(row => dot(row, B1)))}。除以 D = ${num(D)} 得 (x, y, z) = ${vec(...X1)}。`),
        audit: { kind: 'MIT-MV-16:solve-system', params: { m: M.flat(), b: B1 } },
      }),
      g.number({
        id: 'plane-motion', title: t('Motion on a plane', '平面上的运动'),
        prompt: t(`A point P(t) moves on the plane ${linear([pm.a, pm.b, pm.c], ['x', 'y', 'z'])} = ${num(pm.d)}. At some instant its velocity is (${num(pm.v1)}, ${num(pm.v2)}, v₃). Find v₃.`, `点 P(t) 在平面 ${linear([pm.a, pm.b, pm.c], ['x', 'y', 'z'])} = ${num(pm.d)} 上运动。某一时刻它的速度为 (${num(pm.v1)}, ${num(pm.v2)}, v₃)。求 v₃。`),
        fields: [{ label: t('v₃', 'v₃'), answer: pm.v3 }],
        hint: t('Differentiate N · r(t) = d: the velocity is perpendicular to the normal N.', '对 N · r(t) = d 求导：速度与法向量 N 垂直。'),
        explanation: t(`N = ${vec(pm.a, pm.b, pm.c)} and N · v = 0: ${products([pm.a, pm.b], [pm.v1, pm.v2])} + ${cTerm} = 0. The first two products add up to ${num(pmS)}, so ${num(pmS)} + ${cTerm} = 0, i.e. ${cTerm} = ${num(-pmS)}${pm.c === 1 ? '' : `, and dividing by ${par(pm.c)} gives v₃ = ${num(-pmS)}/${par(pm.c)} = ${num(pm.v3)}`}.`, `N = ${vec(pm.a, pm.b, pm.c)}，N · v = 0：${products([pm.a, pm.b], [pm.v1, pm.v2])} + ${cTerm} = 0。前两个乘积之和为 ${num(pmS)}，所以 ${num(pmS)} + ${cTerm} = 0，即 ${cTerm} = ${num(-pmS)}${pm.c === 1 ? '' : `，两边除以 ${par(pm.c)} 得 v₃ = ${num(-pmS)}/${par(pm.c)} = ${num(pm.v3)}`}。`),
        audit: { kind: 'MIT-MV-16:plane-motion', params: { a: pm.a, b: pm.b, c: pm.c, d: pm.d, v1: pm.v1, v2: pm.v2 } },
      }),
      g.choice({
        id: 'parallel-line', title: t('Is the line parallel to the plane?', '直线与平面平行吗？'),
        prompt: t(`The plane is ${plane} = ${num(dT)}. Is the line through A = ${vec(...lineA)} and B = ${vec(...lineB)} parallel to the plane (is its direction parallel to the plane)? N denotes the normal vector of the plane.`, `平面为 ${plane} = ${num(dT)}。过 A = ${vec(...lineA)} 与 B = ${vec(...lineB)} 的直线是否平行于该平面（其方向是否平行于平面）？N 表示该平面的法向量。`),
        options: [t('Yes: N · AB = 0', '平行：N · AB = 0'), t('No: N · AB ≠ 0', '不平行：N · AB ≠ 0'), t('It cannot be decided: N · AB does not settle it unless A is on the plane', '无法判断：除非 A 在平面上，否则 N · AB 不能决定结果')], correct: isPar ? 0 : 1,
        hint: t('The line’s direction is AB = B − A. It is parallel to the plane exactly when AB is perpendicular to the normal N.', '直线的方向为 AB = B − A。当且仅当 AB 与法向量 N 垂直时，直线平行于平面。'),
        explanation: t(`AB = ${vec(...sub(lineB, lineA))} and N = ${vec(...T.N)}, so N · AB = ${products(T.N, sub(lineB, lineA))} = ${num(dot(T.N, sub(lineB, lineA)))}. A is not on the plane (N · A = ${num(dot(T.N, lineA))}, not ${num(dT)}), but the answer does not depend on that: it is decided by the direction AB alone. ${isPar ? 'Here N · AB = 0, so the direction is parallel to the plane (and, since A is off the plane, the line runs beside it).' : 'Here N · AB ≠ 0, so the line crosses the plane.'}`, `AB = ${vec(...sub(lineB, lineA))}，N = ${vec(...T.N)}，所以 N · AB = ${products(T.N, sub(lineB, lineA))} = ${num(dot(T.N, sub(lineB, lineA)))}。A 不在平面上（N · A = ${num(dot(T.N, lineA))}，不等于 ${num(dT)}），但结论并不取决于此：只由方向 AB 决定。${isPar ? '这里 N · AB = 0，所以方向平行于平面（又因为 A 不在平面上，直线在平面的旁边）。' : '这里 N · AB ≠ 0，所以直线与平面相交。'}`),
        audit: { kind: 'MIT-MV-16:parallel-line', params: { a: T.N[0], b: T.N[1], c: T.N[2], d: dT, A: lineA, B: lineB } },
      }),
      g.choice({
        id: 'normal-perp', title: t('Velocity on a plane', '平面上运动的速度'),
        prompt: t(`A point P(t) with position vector r(t) moves in the plane ${linear(planeNormal, ['x', 'y', 'z'])} = ${num(planeD)}, whose normal is N = ${vec(...planeNormal)}. Which statement about its velocity v = dr/dt is correct for every such motion?`, `位置向量为 r(t) 的点 P(t) 在平面 ${linear(planeNormal, ['x', 'y', 'z'])} = ${num(planeD)} 上运动，其法向量为 N = ${vec(...planeNormal)}。关于速度 v = dr/dt，哪个说法对每个这样的运动都成立？`),
        options: [t('v · N = 0', 'v · N = 0'), t('v is parallel to N', 'v 平行于 N'), t('v · r = 0', 'v · r = 0')], correct: 0,
        hint: t('Write the plane as N · r(t) = d and differentiate; d is a constant.', '把平面写成 N · r(t) = d 并求导；d 是常数。'),
        explanation: t(`N · r(t) = ${num(planeD)}; differentiating gives N · v = 0, so v ⟂ N: the velocity lies in the plane’s direction. v · r = 0 would mean |r| is constant, which is true on a sphere about the origin, not on a plane.`, `N · r(t) = ${num(planeD)}；求导得 N · v = 0，所以 v ⟂ N：速度沿平面的方向。v · r = 0 表示 |r| 为常数，这对以原点为中心的球面成立，对平面不成立。`),
      }),
      g.choice({
        id: 'unique-solution', title: t('How many solutions does M X = B have?', 'M X = B 有多少个解？'),
        prompt: t(`A 3×3 matrix M has det M = ${num(unD)}. What can be said about the solutions of M X = B for a given vector B?`, `3×3 矩阵 M 的 det M = ${num(unD)}。对给定的向量 B，关于 M X = B 的解可以说什么？`),
        options: [t('Exactly one solution, whatever B is', '无论 B 是什么，恰有一个解'), t('No solution or infinitely many, depending on B', '无解或有无穷多个解，取决于 B'), t('Infinitely many solutions for every B', '对每个 B 都有无穷多个解')], correct: unD === 0 ? 1 : 0,
        hint: t('Is M invertible? Compare det M with 0.', 'M 可逆吗？比较 det M 与 0。'),
        explanation: t(unD === 0 ? 'det M = 0, so M is not invertible: M X = B has a solution only if B is in the span of the columns, and then it has infinitely many; otherwise none. It is never exactly one.' : `det M = ${num(unD)} ≠ 0, so M⁻¹ exists and X = M⁻¹B is the unique solution for every B.`, unD === 0 ? 'det M = 0，所以 M 不可逆：只有当 B 在各列张成的空间中时 M X = B 才有解，此时有无穷多个解；否则无解。绝不会恰有一个解。' : `det M = ${num(unD)} ≠ 0，所以 M⁻¹ 存在，对每个 B，X = M⁻¹B 是唯一解。`),
        audit: { kind: 'MIT-MV-16:unique-solution', params: { D: unD } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`The vector r(t) = (x, y, z) solves the system ${sys(M2, [c1, 0, c3]).map((s, i) => (i === 1 ? s.replace(/= 0$/, '= t') : s)).join(';  ')}. Find dr/dt = (dx/dt, dy/dt, dz/dt). Enter fractions if needed.`, `向量 r(t) = (x, y, z) 是方程组 ${sys(M2, [c1, 0, c3]).map((s, i) => (i === 1 ? s.replace(/= 0$/, '= t') : s)).join('；  ')} 的解。求 dr/dt = (dx/dt, dy/dt, dz/dt)。必要时输入分数。`),
        fields: [{ label: t('dx/dt', 'dx/dt'), answer: dr[0] }, { label: t('dy/dt', 'dy/dt'), answer: dr[1] }, { label: t('dz/dt', 'dz/dt'), answer: dr[2] }],
        hint: t('Differentiating the system in t gives M·(dr/dt) = (0, 1, 0). Solve that, e.g. with M⁻¹.', '对方程组关于 t 求导，得 M·(dr/dt) = (0, 1, 0)。解它，例如用 M⁻¹。'),
        explanation: t(`Differentiating gives M·(dr/dt) = (0, 1, 0), so dr/dt = M⁻¹(0, 1, 0) = the second column of M⁻¹ = (1/${num(D2)})·(${num(cof2[1][0])}, ${num(cof2[1][1])}, ${num(cof2[1][2])}) = (${drText.join(', ')}). The constants ${num(c1)} and ${num(c3)} on the right do not affect dr/dt. You practised computation with vectors, planes, matrices and motion; proofs and sketches are not covered here.`, `求导得 M·(dr/dt) = (0, 1, 0)，所以 dr/dt = M⁻¹(0, 1, 0) = M⁻¹ 的第二列 = (1/${num(D2)})·(${num(cof2[1][0])}, ${num(cof2[1][1])}, ${num(cof2[1][2])}) = (${drText.join(', ')})。右端的常数 ${num(c1)} 与 ${num(c3)} 不影响 dr/dt。这里练习的是向量、平面、矩阵与运动的计算；证明和草图不在本题范围内。`),
        audit: { kind: 'MIT-MV-16:challenge', params: { m: M2.flat(), c1, c3 } },
      }),
    ];
  },
};
