import { contourLines, ellipse, fitView, type FigureShape, type Pt } from '../figure';
import { coef, frac, linear, makeMvDeck, num, par, term, vec, type GeneratorMap } from './support';

/**
 * Batch 5: MIT-MV-21 Least Squares, MIT-MV-22 The Second Derivative Test, MIT-MV-23 Total Differentials and the Chain Rule,
 * MIT-MV-24 The Chain Rule with More Variables, MIT-MV-25 The Gradient and Level Curves.
 * Definitions follow content/mit-multivariable-calculus/sources/{21,22,23,24,25}-*.txt (18.02SC sessions 29-37).
 */
type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string) => [en, zh] as const;

/** Draw with `make` until `ok` holds. Bounded, so a bad sampling condition fails loudly instead of hanging. */
function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** The shared LCG gives near-constant first draws for tiny seeds: discard a few. */
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// ---- n-variable polynomial toolkit: a term is [coefficient, power of variable 1, power of variable 2, ...]. ----
type Mono = number[];
const SUP = ['', '', '²', '³', '⁴'];
const sup = (p: number) => SUP[p] ?? `^${p}`;
/** Printed polynomial, e.g. "3x²y − xz + 2". Zero coefficients are omitted; a coefficient of 1 is never printed; negatives never print as "+ −". */
function poly(terms: Mono[], vars: string[]): string {
  const live = terms.filter(m => m[0] !== 0);
  if (!live.length) return '0';
  return live.map((m, k) => {
    const body = vars.map((v, i) => (m[i + 1] ? v + sup(m[i + 1]) : '')).join('');
    const abs = Math.abs(m[0]);
    const text = body === '' ? num(abs) : abs === 1 ? body : `${num(abs)}${body}`;
    return k === 0 ? (m[0] < 0 ? `−${text}` : text) : ` ${m[0] < 0 ? '−' : '+'} ${text}`;
  }).join('');
}
const ev = (terms: Mono[], at: number[]) => terms.reduce((s, m) => s + m[0] * at.reduce((p, x, i) => p * x ** m[i + 1], 1), 0);
/** Partial derivative with respect to variable number k (0-based). */
const D = (terms: Mono[], k: number): Mono[] => terms.filter(m => m[k + 1] > 0).map(m => { const c = [...m]; c[0] = m[0] * m[k + 1]; c[k + 1] -= 1; return c; });
/** The polynomial with concrete values substituted, e.g. "2·3² + (−1)·3·4". */
function subst(terms: Mono[], at: number[]): string {
  const live = terms.filter(m => m[0] !== 0);
  if (!live.length) return '0';
  return live.map(m => {
    const parts: string[] = [];
    const bare = m.slice(1).every(p => p === 0);
    if (Math.abs(m[0]) !== 1 || bare) parts.push(par(m[0]));
    else if (m[0] === -1) parts.push('(−1)');
    m.slice(1).forEach((p, i) => { if (p) parts.push(p === 1 ? par(at[i]) : `${par(at[i])}${sup(p)}`); });
    return parts.join('·');
  }).join(' + ');
}
const XY = ['x', 'y'], XYZ = ['x', 'y', 'z'], UV = ['u', 'v'];
/** General quadratic a x² + b xy + c y² + d x + e y. */
const quad2 = (a: number, b: number, c: number, d: number, e: number): Mono[] => [[a, 2, 0], [b, 1, 1], [c, 0, 2], [d, 1, 0], [e, 0, 1]];
const pt2 = (x: number, y: number) => `(${num(x)}, ${num(y)})`;
const shiftVar = (v: string, c: number) => (c === 0 ? v : c > 0 ? `${v} + ${num(c)}` : `${v} − ${num(-c)}`);
const sq = (x: number) => `${par(x)}²`;

export const batch05Generators: GeneratorMap = {
  // ================================================================================================
  'MIT-MV-21': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-21');
    warm(g);
    const XSETS = [[0, 1, 2, 3], [-1, 0, 1, 2], [1, 2, 3, 4], [-3, -1, 1, 3], [0, 2, 4, 6]];
    /** Least-squares line through (xs, ys): a = (nΣxy − ΣxΣy)/det, b = (ΣxxΣy − ΣxΣxy)/det, det = nΣx² − (Σx)². */
    const fitLine = (xs: number[], ys: number[]) => {
      const n = xs.length, sx = sum(xs), sxx = sum(xs.map(x => x * x)), sxy = sum(xs.map((x, i) => x * ys[i])), sy = sum(ys);
      const det = n * sxx - sx * sx, an = n * sxy - sx * sy, bn = sxx * sy - sx * sxy;
      const a = an / det, b = bn / det;
      const dmin = round2(ys.reduce((s, y, i) => s + (y - (a * xs[i] + b)) ** 2, 0));
      return { n, sx, sxx, sxy, sy, det, an, bn, a, b, dmin };
    };
    const pts = (xs: number[], ys: number[]) => xs.map((x, i) => pt2(x, ys[i])).join(', ');
    /** The line y = ax + b as "2x + 1", "x − 3", "−2x" or "3". */
    const lineText = (a: number, b: number) => (a === 0 ? num(b) : b === 0 ? coef(a, 'x') : `${coef(a, 'x')} ${term(b)}`);
    const sampleData = (avoid = -1) => retry(() => {
      const si = g.random(0, XSETS.length - 1), xs = XSETS[si], ys = xs.map(() => g.random(0, 6));
      return { si, xs, ys, f: fitLine(xs, ys) };
    }, v => v.si !== avoid && v.f.dmin >= 1 && v.f.a !== 0 && v.f.b !== 0);

    const m = sampleData();
    const { xs, ys, f } = m;
    // trial line for cards 1 and 3
    const trial = retry(() => {
      const a0 = g.nonzero(-1, 3), b0 = g.random(-1, 3);
      const d = ys.map((y, i) => y - (a0 * xs[i] + b0));
      return { a0, b0, d, D0: sum(d.map(v => v * v)), Da: -2 * sum(d.map((v, i) => xs[i] * v)), Db: -2 * sum(d) };
    }, v => v.D0 >= 3 && v.D0 <= 100 && !(v.Da === 0 && v.Db === 0));
    const { a0, b0, d: dev } = trial;

    // 2. two lines compared
    const cmp = retry(() => {
      const p = g.random(1, 3), zeroWins = g.random(0, 1) === 1, zeroIsA = g.random(0, 1) === 1;
      const zero = [p, -p, p, -p], other = [g.random(-3, 3), g.random(-3, 3), g.random(-3, 3), g.random(-3, 3)];
      const dz = 4 * p * p, doth = sum(other.map(v => v * v));
      return { p, zeroWins, zeroIsA, zero, other, dz, doth };
    }, v => sum(v.other) !== 0 && Math.abs(v.dz - v.doth) >= 3 && (v.dz < v.doth) === v.zeroWins);
    const devA = cmp.zeroIsA ? cmp.zero : cmp.other, devB = cmp.zeroIsA ? cmp.other : cmp.zero;
    const DA = sum(devA.map(v => v * v)), DB = sum(devB.map(v => v * v));
    const betterIsA = DA < DB;
    const zeroName = cmp.zeroIsA ? 'A' : 'B';

    // 7. which trial function is linear in its coefficients
    const linearPool = ['y = a₀ + a₁x + a₂x²', 'y = a₀ + a₁x + a₂/x', 'y = a₀ + a₁eˣ', 'y = a₁x + a₂x³', 'y = a₀ + a₁/x', 'y = a₀ + a₁x + a₂x² + a₃x³'];
    const nonlinPool: [string, string, string][] = [
      ['y = c·e^(kx)', 'the unknown k sits inside the exponential', '未知数 k 位于指数之中'],
      ['y = a·sin(bx)', 'the unknown b sits inside the sine', '未知数 b 位于正弦函数之中'],
      ['y = a·x^b', 'the unknown b is an exponent', '未知数 b 是指数'],
      ['y = a/(1 + bx)', 'the unknown b sits in a denominator', '未知数 b 位于分母之中'],
      ['y = a₀ + a₁e^(kx)', 'the unknown k sits inside the exponential', '未知数 k 位于指数之中'],
      ['y = a₀ + a₁x + a₂sin(bx)', 'the unknown b sits inside the sine', '未知数 b 位于正弦函数之中'],
      ['y = a₀ + a₁x^b', 'the unknown b is an exponent', '未知数 b 是指数'],
    ];
    const lin = g.pick(linearPool);
    const nl = [...nonlinPool];
    const n1 = nl.splice(g.random(0, nl.length - 1), 1)[0], n2 = nl.splice(g.random(0, nl.length - 1), 1)[0];

    // 8. which data set has no least-squares line y = ax + b
    const trio = (): number[] => retry(() => [g.random(-2, 4), g.random(-2, 4), g.random(-2, 4)], v => new Set(v).size === 3);
    const vp = g.random(-2, 3), vq = g.random(0, 5);
    const vxAllY = trio().map(v => v + 3), vyAllX = trio(), vgX = trio();
    const vgY = retry(() => [g.random(0, 6), g.random(0, 6), g.random(0, 6)], v => new Set(v).size > 1);
    const setXAll = pts([vp, vp, vp], vxAllY), setYAll = pts(vyAllX, [vq, vq, vq]), setGen = pts(vgX, vgY);

    // 9. challenge
    const c = sampleData(m.si);

    const eqText = (F: ReturnType<typeof fitLine>) => [`${linear([F.sxx, F.sx], ['a', 'b'])} = ${num(F.sxy)}`, `${linear([F.sx, F.n], ['a', 'b'])} = ${num(F.sy)}`];
    const eqs = eqText(f);

    const devFigure = (() => {
      const xlo = Math.min(...xs) - 1, xhi = Math.max(...xs) + 1;
      const shapes: FigureShape[] = [
        { kind: 'line', points: [[xlo, a0 * xlo + b0], [xhi, a0 * xhi + b0]], tone: 'accent', width: 2 },
        ...xs.flatMap((x, i): FigureShape[] => (dev[i] === 0 ? [] : [{ kind: 'line', points: [[x, ys[i]], [x, a0 * x + b0]], tone: 'warn', dash: true, width: 1.5 }])),
        ...xs.map((x, i): FigureShape => ({ kind: 'point', at: [x, ys[i]] as Pt, tone: 'text' })),
      ];
      return g.figure({
        alt: t(`The four data points ${pts(xs, ys)} and the line y = ${lineText(a0, b0)}. A dashed vertical segment joins each point to the line; its length is the size of that point's deviation.`,
          `四个数据点 ${pts(xs, ys)} 与直线 y = ${lineText(a0, b0)}。每个点到直线都有一条竖直虚线段，其长度就是该点偏差的大小。`),
        view: fitView(shapes, 0.15), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes,
        caption: t(`Data points and the line y = ${lineText(a0, b0)}`, `数据点与直线 y = ${lineText(a0, b0)}`),
      });
    })();

    const sums = (F: ReturnType<typeof fitLine>, X: number[], Y: number[]) => ({
      sxx: X.map(x => `${par(x)}²`).join(' + '), sx: X.map(par).join(' + '), sxy: X.map((x, i) => `${par(x)}·${par(Y[i])}`).join(' + '), sy: Y.map(par).join(' + '), F,
    });
    const sm = sums(f, xs, ys);
    const devLine = (X: number[], Y: number[], a: number, b: number, sep: string) => X.map((x, i) => `${num(Y[i])} − (${par(a)}·${par(x)} ${term(b)}) = ${num(Y[i] - (a * x + b))}`).join(sep);
    /** "21/10 = 2.1", or just "3" when the fraction is already a plain number. */
    const fv = (n: number, d: number) => { const fr = frac(n, d), dec = num(n / d); return fr === dec ? fr : `${fr} = ${dec}`; };

    return [
      g.number({
        id: 'deviation', title: t('Deviations from a line', '到直线的偏差'),
        prompt: t(`Four experimental data points: ${pts(xs, ys)}. Try the line y = ${lineText(a0, b0)}, that is a = ${num(a0)} and b = ${num(b0)} in y = ax + b. The deviation of a point (xᵢ, yᵢ) from the line y = ax + b is yᵢ − (axᵢ + b): the observed y minus the y that the line predicts. Find D, the sum of the squares of the four deviations.`,
          `四个实验数据点：${pts(xs, ys)}。试用直线 y = ${lineText(a0, b0)}，即 y = ax + b 中 a = ${num(a0)}，b = ${num(b0)}。数据点 (xᵢ, yᵢ) 到直线 y = ax + b 的偏差是 yᵢ − (axᵢ + b)：观测的 y 减去直线预测的 y。求 D，即四个偏差的平方和。`),
        figure: devFigure,
        fields: [{ label: t('D', 'D'), answer: trial.D0 }],
        hint: t('For each point, work out the y the line predicts at xᵢ, subtract it from yᵢ, square the result, and add the four squares.', '对每个点，先算直线在 xᵢ 处预测的 y，用 yᵢ 减去它，再平方，最后把四个平方相加。'),
        explanation: t(`Deviations: ${devLine(xs, ys, a0, b0, '; ')}. D = ${dev.map(sq).join(' + ')} = ${num(trial.D0)}. The least-squares line is the line that makes D as small as possible; this trial line is just one candidate.`,
          `偏差：${devLine(xs, ys, a0, b0, '；')}。D = ${dev.map(sq).join(' + ')} = ${num(trial.D0)}。最小二乘直线就是使 D 最小的直线；这条试验直线只是其中一个候选。`),
        audit: { kind: 'MIT-MV-21:sum-squares', params: { xs, ys, a: a0, b: b0 } },
      }),
      g.choice({
        id: 'cancel', title: t('Why the deviations are squared', '为什么要把偏差平方'),
        prompt: t(`Two lines are tried on the same four data points. Their deviations yᵢ − (axᵢ + b), one number per point, are: Line A: ${vec(...devA)}. Line B: ${vec(...devB)}. The least-squares criterion prefers the line with the smaller D, the sum of the squares of the deviations. Which line does it prefer?`,
          `同样的四个数据点上试了两条直线，它们的偏差 yᵢ − (axᵢ + b)（每个点一个数）分别是：直线 A：${vec(...devA)}。直线 B：${vec(...devB)}。最小二乘准则选择 D（偏差的平方和）较小的直线。它会选哪条？`),
        options: [t('Line A', '直线 A'), t('Line B', '直线 B'), t('Neither: both lines have the same D.', '都不选：两条直线的 D 相同。')],
        correct: betterIsA ? 0 : 1,
        hint: t('Compute D for each line by squaring each deviation and adding. Do not compare the plain sums of the deviations.', '分别对每条直线把各偏差平方后相加，算出 D。不要比较偏差的普通和。'),
        explanation: t(`Line A: D = ${devA.map(sq).join(' + ')} = ${DA}. Line B: D = ${devB.map(sq).join(' + ')} = ${DB}. The smaller D belongs to line ${betterIsA ? 'A' : 'B'}. Line ${zeroName} has deviations that add up to 0, but a plain sum lets positive and negative deviations cancel; squaring makes every term positive, so the sum cannot hide large errors.`,
          `直线 A：D = ${devA.map(sq).join(' + ')} = ${DA}。直线 B：D = ${devB.map(sq).join(' + ')} = ${DB}。D 较小的是直线 ${betterIsA ? 'A' : 'B'}。直线 ${zeroName} 的偏差之和为 0，但普通的和会让正负偏差互相抵消；平方使每一项都为正，所以这个和无法掩盖大的误差。`),
        audit: { kind: 'MIT-MV-21:compare-lines', params: { devA, devB } },
      }),
      g.number({
        id: 'slopes-of-d', title: t('Slopes of D at a trial line', '试验直线处 D 的偏导数'),
        prompt: t(`For the data ${pts(xs, ys)} and a line y = ax + b, the sum of squares is D(a, b) = Σ (yᵢ − axᵢ − b)². Differentiating with the chain rule, without expanding the squares, gives ∂D/∂a = Σ 2(yᵢ − axᵢ − b)(−xᵢ) and ∂D/∂b = Σ 2(yᵢ − axᵢ − b)(−1). Evaluate both partial derivatives at a = ${num(a0)}, b = ${num(b0)}, the line y = ${lineText(a0, b0)}.`,
          `对数据 ${pts(xs, ys)} 与直线 y = ax + b，平方和为 D(a, b) = Σ (yᵢ − axᵢ − b)²。用链式法则求导（不展开平方）得 ∂D/∂a = Σ 2(yᵢ − axᵢ − b)(−xᵢ)，∂D/∂b = Σ 2(yᵢ − axᵢ − b)(−1)。在 a = ${num(a0)}，b = ${num(b0)}（即直线 y = ${lineText(a0, b0)}）处求这两个偏导数。`),
        fields: [{ label: t('∂D/∂a', '∂D/∂a'), answer: trial.Da }, { label: t('∂D/∂b', '∂D/∂b'), answer: trial.Db }],
        hint: t('First find the four deviations dᵢ = yᵢ − axᵢ − b at the given a and b. Then ∂D/∂a = −2 Σ xᵢdᵢ and ∂D/∂b = −2 Σ dᵢ.', '先在给定的 a、b 下求出四个偏差 dᵢ = yᵢ − axᵢ − b。然后 ∂D/∂a = −2 Σ xᵢdᵢ，∂D/∂b = −2 Σ dᵢ。'),
        explanation: t(`Deviations dᵢ: ${dev.map(num).join(', ')}. ∂D/∂a = −2 Σ xᵢdᵢ = −2(${xs.map((x, i) => `${par(x)}·${par(dev[i])}`).join(' + ')}) = ${num(trial.Da)}. ∂D/∂b = −2 Σ dᵢ = −2(${dev.map(par).join(' + ')}) = ${num(trial.Db)}. They are not both 0, so this line is not the least-squares line: at the minimum of D both partial derivatives vanish.`,
          `偏差 dᵢ：${dev.map(num).join(', ')}。∂D/∂a = −2 Σ xᵢdᵢ = −2(${xs.map((x, i) => `${par(x)}·${par(dev[i])}`).join(' + ')}) = ${num(trial.Da)}。∂D/∂b = −2 Σ dᵢ = −2(${dev.map(par).join(' + ')}) = ${num(trial.Db)}。它们不全为 0，所以这条直线不是最小二乘直线：D 取最小值时两个偏导数都为 0。`),
        audit: { kind: 'MIT-MV-21:gradient-of-D', params: { xs, ys, a: a0, b: b0 } },
      }),
      g.number({
        id: 'normal-sums', title: t('The four sums in the linear system', '线性方程组中的四个和'),
        prompt: t(`Setting ∂D/∂a = 0 and ∂D/∂b = 0 and collecting terms gives two linear equations for a and b: (Σxᵢ²)a + (Σxᵢ)b = Σxᵢyᵢ and (Σxᵢ)a + n·b = Σyᵢ, where n = ${xs.length} is the number of points. For the data ${pts(xs, ys)} compute the four sums.`,
          `令 ∂D/∂a = 0、∂D/∂b = 0 并合并同类项，得到关于 a、b 的两个线性方程：(Σxᵢ²)a + (Σxᵢ)b = Σxᵢyᵢ 与 (Σxᵢ)a + n·b = Σyᵢ，其中 n = ${xs.length} 是数据点的个数。对数据 ${pts(xs, ys)} 求这四个和。`),
        fields: [{ label: t('Σxᵢ²', 'Σxᵢ²') , answer: f.sxx }, { label: t('Σxᵢ', 'Σxᵢ'), answer: f.sx }, { label: t('Σxᵢyᵢ', 'Σxᵢyᵢ'), answer: f.sxy }, { label: t('Σyᵢ', 'Σyᵢ'), answer: f.sy }],
        hint: t('Square each x, add them; add the x values; multiply each x by its y and add; add the y values.', '把每个 x 平方后相加；把各 x 相加；每个 x 乘以它的 y 后相加；把各 y 相加。'),
        explanation: t(`Σxᵢ² = ${sm.sxx} = ${num(f.sxx)}. Σxᵢ = ${sm.sx} = ${num(f.sx)}. Σxᵢyᵢ = ${sm.sxy} = ${num(f.sxy)}. Σyᵢ = ${sm.sy} = ${num(f.sy)}. The system is ${eqs[0]} and ${eqs[1]}.`,
          `Σxᵢ² = ${sm.sxx} = ${num(f.sxx)}。Σxᵢ = ${sm.sx} = ${num(f.sx)}。Σxᵢyᵢ = ${sm.sxy} = ${num(f.sxy)}。Σyᵢ = ${sm.sy} = ${num(f.sy)}。方程组为 ${eqs[0]} 与 ${eqs[1]}。`),
        audit: { kind: 'MIT-MV-21:normal-sums', params: { xs, ys } },
      }),
      g.number({
        id: 'solve-line', title: t('The least-squares line', '最小二乘直线'),
        prompt: t(`For the same data ${pts(xs, ys)}, find the least-squares line y = ax + b, the one that minimises D. Enter a and b as exact fractions (such as 11/10) or as decimals.`,
          `对同样的数据 ${pts(xs, ys)}，求最小二乘直线 y = ax + b，即使 D 最小的那条直线。a、b 请输入精确分数（如 11/10）或小数。`),
        fields: [{ label: t('a', 'a'), answer: f.a }, { label: t('b', 'b'), answer: f.b }],
        hint: t('Use the two linear equations from the previous card and solve them for a and b (elimination).', '用上一张卡中的两个线性方程，消元解出 a 和 b。'),
        explanation: t(`The equations are ${eqs[0]} and ${eqs[1]}. Their determinant is ${f.n}·${f.sxx} − ${par(f.sx)}² = ${f.det}. Hence a = (${f.n}·${par(f.sxy)} − ${par(f.sx)}·${par(f.sy)})/${f.det} = ${fv(f.an, f.det)} and b = (${f.sxx}·${par(f.sy)} − ${par(f.sx)}·${par(f.sxy)})/${f.det} = ${fv(f.bn, f.det)}. Check: the line passes through the point of means (x̄, ȳ) = (${num(f.sx / f.n)}, ${num(f.sy / f.n)}), because ${num(f.sx / f.n)}·${par(f.a)} ${term(f.b)} = ${num(f.sy / f.n)}.`,
          `方程为 ${eqs[0]} 与 ${eqs[1]}。系数行列式为 ${f.n}·${f.sxx} − ${par(f.sx)}² = ${f.det}。于是 a = (${f.n}·${par(f.sxy)} − ${par(f.sx)}·${par(f.sy)})/${f.det} = ${fv(f.an, f.det)}，b = (${f.sxx}·${par(f.sy)} − ${par(f.sx)}·${par(f.sxy)})/${f.det} = ${fv(f.bn, f.det)}。检验：这条直线通过均值点 (x̄, ȳ) = (${num(f.sx / f.n)}, ${num(f.sy / f.n)})，因为 ${num(f.sx / f.n)}·${par(f.a)} ${term(f.b)} = ${num(f.sy / f.n)}。`),
        audit: { kind: 'MIT-MV-21:least-squares-line', params: { xs, ys } },
      }),
      g.number({
        id: 'minimum-d', title: t('The smallest possible D', 'D 能取到的最小值'),
        prompt: t(`For the same data ${pts(xs, ys)}, the least-squares line is y = ${lineText(f.a, f.b)}, that is a = ${num(f.a)} and b = ${num(f.b)}. Its sum of squared deviations is the smallest value that D(a, b) can take. Find this smallest D, to 2 decimal places.`,
          `对同样的数据 ${pts(xs, ys)}，最小二乘直线为 y = ${lineText(f.a, f.b)}，即 a = ${num(f.a)}，b = ${num(f.b)}。它的偏差平方和就是 D(a, b) 能取到的最小值。求这个最小的 D，保留 2 位小数。`),
        fields: [{ label: t('smallest D', '最小的 D'), answer: f.dmin, tolerance: 0.005 }],
        hint: t('Compute the deviation yᵢ − (axᵢ + b) at each of the four points with these exact a and b, square them and add.', '用这组精确的 a、b，在四个点分别算偏差 yᵢ − (axᵢ + b)，平方后相加。'),
        explanation: t(`Deviations: ${xs.map((x, i) => num(round2(ys[i] - (f.a * x + f.b)))).join(', ')}. D = ${xs.map((x, i) => sq(round2(ys[i] - (f.a * x + f.b)))).join(' + ')} = ${num(f.dmin)}. For comparison, the trial line y = ${lineText(a0, b0)} of the first card gave D = ${num(trial.D0)}, which is larger, as it must be.`,
          `偏差：${xs.map((x, i) => num(round2(ys[i] - (f.a * x + f.b)))).join(', ')}。D = ${xs.map((x, i) => sq(round2(ys[i] - (f.a * x + f.b)))).join(' + ')} = ${num(f.dmin)}。作为对比，第一张卡中的试验直线 y = ${lineText(a0, b0)} 得到 D = ${num(trial.D0)}，比它大，这是必然的。`),
        audit: { kind: 'MIT-MV-21:minimum-d', params: { xs, ys, a: f.a, b: f.b } },
      }),
      g.choice({
        id: 'which-fit', title: t('Which trial function can be fitted?', '哪种试验函数可以这样拟合？'),
        prompt: t('Least squares leads to a square system of linear equations for the unknown coefficients only when those coefficients occur linearly in the trial function. In each formula below, the letters a, b, c, k, a₀, a₁, a₂, a₃ are the unknown coefficients and x is the variable. Which trial function can be fitted by this method?',
          '只有当未知系数在试验函数中以线性方式出现时，最小二乘法才会得到关于这些系数的线性方程组。下面每个公式里，字母 a、b、c、k、a₀、a₁、a₂、a₃ 是未知系数，x 是变量。哪个试验函数可以用这种方法拟合？'),
        options: [t(lin, lin), t(n1[0], n1[0]), t(n2[0], n2[0])], correct: 0,
        hint: t('Ask of each formula: is it a sum of the unknown coefficients times known functions of x, such as 1, x, x² or 1/x?', '对每个公式问：它是否是“未知系数乘以 x 的已知函数（如 1、x、x²、1/x）”之和？'),
        explanation: t(`${lin} is a sum of unknown coefficients times known functions of x (a linear combination), so the partial derivatives of D with respect to the coefficients give linear equations. In ${n1[0]} ${n1[1]}, and in ${n2[0]} ${n2[1]}, so the equations for the unknowns would not be linear. Fitting an exponential needs a separate adaptation of the method.`,
          `${lin} 是“未知系数乘以 x 的已知函数”之和（线性组合），所以 D 对各系数的偏导数给出线性方程。在 ${n1[0]} 中，${n1[2]}；在 ${n2[0]} 中，${n2[2]}；这样关于未知数的方程就不是线性的。拟合指数函数需要对方法另作调整。`),
      }),
      g.choice({
        id: 'vertical', title: t('When the equations cannot be solved', '方程组何时无法求解'),
        prompt: t('The two linear equations determine a and b only when n·Σxᵢ² − (Σxᵢ)² is not 0. For which of these data sets can you NOT write the best line in the form y = ax + b?', '只有当 n·Σxᵢ² − (Σxᵢ)² 不为 0 时，这两个线性方程才能确定 a 和 b。对下列哪组数据，最佳直线不能写成 y = ax + b 的形式？'),
        options: [t(setXAll, setXAll), t(setYAll, setYAll), t(setGen, setGen)], correct: 0,
        hint: t('When is n·Σx² equal to (Σx)²? Try three points with the same x, and then three points with the same y.', 'n·Σx² 何时等于 (Σx)²？试试三个 x 相同的点，再试三个 y 相同的点。'),
        explanation: t(`Only the set whose x-values are all equal (x = ${num(vp)}) makes n·Σx² − (Σx)² = 0: the points lie on the vertical line x = ${num(vp)}, which cannot be written as y = ax + b. The set with all y equal gives the horizontal line y = ${num(vq)} (a = 0), which is perfectly fine, and a set with different x-values always gives a determinant above 0.`,
          `只有 x 全相等（x = ${num(vp)}）的那组数据使 n·Σx² − (Σx)² = 0：这些点落在竖直线 x = ${num(vp)} 上，它不能写成 y = ax + b。y 全相等的那组给出水平线 y = ${num(vq)}（a = 0），完全没有问题；x 取值各不相同的数据，行列式总是大于 0。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Use the method of least squares to fit a line y = ax + b to the four data points ${pts(c.xs, c.ys)}. Enter a and b as exact fractions or decimals.`,
          `用最小二乘法为四个数据点 ${pts(c.xs, c.ys)} 拟合直线 y = ax + b。a、b 请输入精确分数或小数。`),
        fields: [{ label: t('a', 'a'), answer: c.f.a }, { label: t('b', 'b'), answer: c.f.b }],
        hint: t('Minimise D(a, b) = Σ (yᵢ − axᵢ − b)²: set both partial derivatives to 0 to get two linear equations and solve them.', '最小化 D(a, b) = Σ (yᵢ − axᵢ − b)²：令两个偏导数为 0，得到两个线性方程并解之。'),
        explanation: t(`Σxᵢ² = ${num(c.f.sxx)}, Σxᵢ = ${num(c.f.sx)}, Σxᵢyᵢ = ${num(c.f.sxy)}, Σyᵢ = ${num(c.f.sy)}, so ${eqText(c.f)[0]} and ${eqText(c.f)[1]}. Determinant ${c.f.det}: a = ${fv(c.f.an, c.f.det)}, b = ${fv(c.f.bn, c.f.det)}. You practised fitting a line by minimising D with partial derivatives; the Gaussian error theory behind the method and fits by other functions are not tested here.`,
          `Σxᵢ² = ${num(c.f.sxx)}，Σxᵢ = ${num(c.f.sx)}，Σxᵢyᵢ = ${num(c.f.sxy)}，Σyᵢ = ${num(c.f.sy)}，所以 ${eqText(c.f)[0]} 与 ${eqText(c.f)[1]}。行列式为 ${c.f.det}：a = ${fv(c.f.an, c.f.det)}，b = ${fv(c.f.bn, c.f.det)}。你练习了用偏导数最小化 D 来拟合直线；该方法背后的高斯误差理论以及用其他函数拟合，不在这里考查。`),
        audit: { kind: 'MIT-MV-21:challenge', params: { xs: c.xs, ys: c.ys } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-22': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-22');
    warm(g);
    const opts4 = [t('A minimum point', '最小值点'), t('A maximum point', '最大值点'), t('A saddle point', '鞍点'), t('The test fails: more investigation is needed', '判别法失效：需要进一步研究')];

    // 1. second partials of a cubic-type function
    const G = (() => {
      const a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), c = g.random(-3, 3), d = g.random(-3, 3), e = g.random(-3, 3), x0 = g.random(-2, 2), y0 = g.random(-2, 2);
      const F: Mono[] = [[a, 3, 0], [b, 1, 2], [c, 2, 0], [d, 1, 1], [e, 0, 2]];
      return { a, b, c, d, e, x0, y0, F, fx: D(F, 0), fy: D(F, 1), fxx: D(D(F, 0), 0), fxy: D(D(F, 0), 1), fyx: D(D(F, 1), 0), fyy: D(D(F, 1), 1) };
    })();
    const gA = ev(G.fxx, [G.x0, G.y0]), gB = ev(G.fxy, [G.x0, G.y0]), gC = ev(G.fyy, [G.x0, G.y0]);

    // 2. classification from A, B, C
    const abc = retry(() => {
      const kind = g.random(0, 3);
      let A = 0, B = 0, C = 0;
      if (kind === 3) {
        B = g.random(-3, 3);
        if (B === 0) { const z = g.nonzero(-5, 5); if (g.random(0, 1)) { A = 0; C = z; } else { A = z; C = 0; } }
        else { const divs = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => (B * B) % d === 0); const dd = g.pick(divs), s = g.pick([1, -1]); A = s * dd; C = s * (B * B / dd); }
      } else { A = g.random(-6, 6); B = g.random(-5, 5); C = g.random(-6, 6); }
      const disc = A * C - B * B;
      const real = disc === 0 ? 3 : disc < 0 ? 2 : A > 0 ? 0 : 1;
      return { A, B, C, disc, real, kind };
    }, v => v.real === v.kind);

    // 3. quadratic with cross term, with a level-curve picture
    const q = retry(() => {
      const kind = g.random(0, 2);
      let a: number, c: number, b: number;
      if (kind === 2) { a = g.nonzero(-3, 3); c = g.nonzero(-3, 3); b = g.random(-3, 3); }
      else { a = g.random(1, 3); c = g.random(1, 3); b = g.random(-3, 3); if (kind === 1) { a = -a; c = -c; } }
      const xs = g.random(-2, 2), ys = g.random(-2, 2);
      return { kind, a, b, c, xs, ys, d: -(2 * a * xs + b * ys), e: -(b * xs + 2 * c * ys), disc: 4 * a * c - b * b };
    }, v => {
      if (!(v.kind === 2 ? v.disc < 0 : v.disc > 0)) return false;
      // every level listed in the caption must be visible in the picture (very elongated saddles push a level out of view)
      const view = { xmin: v.xs - 4.5, xmax: v.xs + 4.5, ymin: v.ys - 4.5, ymax: v.ys + 4.5 };
      const hs = v.kind === 0 ? [1, 4, 9] : v.kind === 1 ? [-1, -4, -9] : [1, 4, -1, -4];
      const f = (x: number, y: number) => v.a * (x - v.xs) ** 2 + v.b * (x - v.xs) * (y - v.ys) + v.c * (y - v.ys) ** 2;
      return hs.every(h => contourLines(f, view, h, 60, 'accent').length > 0);
    });
    const Fq = quad2(q.a, q.b, q.c, q.d, q.e);
    const fq = ev(Fq, [q.xs, q.ys]);
    const viewQ = { xmin: q.xs - 4.5, xmax: q.xs + 4.5, ymin: q.ys - 4.5, ymax: q.ys + 4.5 };
    const offs = q.kind === 0 ? [1, 4, 9] : q.kind === 1 ? [-1, -4, -9] : [1, 4, -1, -4];
    // keep only the levels that actually appear in the view, so the caption never lists a level that is not drawn
    const levelsQ = offs.map(h => ({ h, shapes: contourLines((x, y) => q.a * (x - q.xs) ** 2 + q.b * (x - q.xs) * (y - q.ys) + q.c * (y - q.ys) ** 2, viewQ, h, 60, h > 0 ? 'accent' : 'accent2') })).filter(l => l.shapes.length > 0);
    const shapesQ: FigureShape[] = [
      ...levelsQ.flatMap(l => l.shapes),
      { kind: 'point', at: [q.xs, q.ys] as Pt, tone: 'warn', label: 'P' },
    ];
    const posH = levelsQ.map(l => l.h).filter(h => h > 0).map(num).join(', '), negH = levelsQ.map(l => l.h).filter(h => h < 0).map(num).join(', ');
    const figAlt = [
      ['closed curves around P, all with values above f(P)', '围绕 P 的闭曲线，所有等高线的值都大于 f(P)'],
      ['closed curves around P, all with values below f(P)', '围绕 P 的闭曲线，所有等高线的值都小于 f(P)'],
      ['hyperbola-shaped curves that do not enclose P: values above f(P) on two opposite sides of P and below f(P) on the other two sides', '不包围 P 的双曲线形曲线：P 相对的两侧是大于 f(P) 的等高线，另外两侧是小于 f(P) 的等高线'],
    ][q.kind];

    // 4-6. p x³ + p y³ + c xy with c = −3pk: critical points (0, 0) and (k, k)
    const k = g.pick([-3, -2, -1, 1, 2, 3]), pp = g.pick([-2, -1, 1, 2]), cc = -3 * pp * k;
    const Fc: Mono[] = [[pp, 3, 0], [pp, 0, 3], [cc, 1, 1]];
    const Ap = 6 * pp * k, discP = 27 * pp * pp * k * k;
    const maxOrMin = Ap > 0 ? 0 : 1;
    const kyx = k === 1 ? 'y − x' : k === -1 ? '−(y − x)' : `${par(k)}(y − x)`;
    const fxxX = poly([[6 * pp, 1]], ['x']), fyyY = poly([[6 * pp, 1]], ['y']);

    // 7-8. s x⁴ + t y⁴
    const fs = g.pick([-3, -2, -1, 1, 2, 3]), ft = g.pick([-3, -2, -1, 1, 2, 3]);
    const F4: Mono[] = [[fs, 4, 0], [ft, 0, 4]];
    const look = fs > 0 && ft > 0 ? 0 : fs < 0 && ft < 0 ? 1 : 2;

    // 9. challenge: q·x y (k − x − y)
    const cq = g.pick([-2, -1, 1, 2]), ck = 3 * g.pick([-3, -2, -1, 1, 2, 3]), cm = ck / 3;
    const Fh: Mono[] = [[cq * ck, 1, 1], [-cq, 2, 1], [-cq, 1, 2]];
    const qc = coef(cq, ''), qwrap = (inner: string) => (cq === 1 ? inner : `${qc}(${inner})`), qwrapDot = (inner: string) => (cq === 1 ? inner : `${qc}${Math.abs(cq) === 1 ? '' : '·'}(${inner})`);
    const hA = -2 * cq * cm, hB = -cq * cm, hDisc = 3 * cq * cq * cm * cm;

    return [
      g.number({
        id: 'second-partials', title: t('The three second partial derivatives', '三个二阶偏导数'),
        prompt: t(`f(x, y) = ${poly(G.F, XY)}. Let A = f_xx, B = f_xy and C = f_yy (the mixed partial f_xy equals f_yx here). Find A, B and C at the point (x, y) = ${pt2(G.x0, G.y0)}.`,
          `f(x, y) = ${poly(G.F, XY)}。记 A = f_xx，B = f_xy，C = f_yy（这里混合偏导数 f_xy 等于 f_yx）。求它们在点 (x, y) = ${pt2(G.x0, G.y0)} 的值。`),
        fields: [{ label: t('A = f_xx', 'A = f_xx'), answer: gA }, { label: t('B = f_xy', 'B = f_xy'), answer: gB }, { label: t('C = f_yy', 'C = f_yy'), answer: gC }],
        hint: t('Find f_x and f_y first, then differentiate again: f_xx from f_x in x, f_xy from f_x in y, f_yy from f_y in y. Substitute the point at the end.', '先求 f_x 与 f_y，再继续求导：f_x 对 x 得 f_xx，f_x 对 y 得 f_xy，f_y 对 y 得 f_yy。最后代入该点。'),
        explanation: t(`f_x = ${poly(G.fx, XY)} and f_y = ${poly(G.fy, XY)}. Then f_xx = ${poly(G.fxx, XY)}, f_xy = ${poly(G.fxy, XY)} (and f_yx = ${poly(G.fyx, XY)}, the same), f_yy = ${poly(G.fyy, XY)}. At ${pt2(G.x0, G.y0)}: A = ${subst(G.fxx, [G.x0, G.y0])} = ${num(gA)}, B = ${subst(G.fxy, [G.x0, G.y0])} = ${num(gB)}, C = ${subst(G.fyy, [G.x0, G.y0])} = ${num(gC)}.`,
          `f_x = ${poly(G.fx, XY)}，f_y = ${poly(G.fy, XY)}。于是 f_xx = ${poly(G.fxx, XY)}，f_xy = ${poly(G.fxy, XY)}（f_yx = ${poly(G.fyx, XY)}，结果相同），f_yy = ${poly(G.fyy, XY)}。在 ${pt2(G.x0, G.y0)} 处：A = ${subst(G.fxx, [G.x0, G.y0])} = ${num(gA)}，B = ${subst(G.fxy, [G.x0, G.y0])} = ${num(gB)}，C = ${subst(G.fyy, [G.x0, G.y0])} = ${num(gC)}。`),
        audit: { kind: 'MIT-MV-22:second-partials', params: { a: G.a, b: G.b, c: G.c, d: G.d, e: G.e, x0: G.x0, y0: G.y0 } },
      }),
      g.choice({
        id: 'classify-abc', title: t('Apply the test to A, B, C', '把判别法用于 A、B、C'),
        prompt: t(`At a critical point of a smooth function f(x, y) the second partial derivatives are A = f_xx = ${num(abc.A)}, B = f_xy = ${num(abc.B)} and C = f_yy = ${num(abc.C)}. What does the second derivative test say about this point?`,
          `在光滑函数 f(x, y) 的一个临界点处，二阶偏导数为 A = f_xx = ${num(abc.A)}，B = f_xy = ${num(abc.B)}，C = f_yy = ${num(abc.C)}。二阶导数判别法对这个点说了什么？`),
        options: opts4, correct: abc.real, fixedOrder: true,
        hint: t('Look at the sign of AC − B² first. If it is positive, the sign of A decides; if it is 0 the test says nothing.', '先看 AC − B² 的符号。若为正，由 A 的符号决定；若为 0，判别法什么也不说。'),
        explanation: t(`AC − B² = ${par(abc.A)}·${par(abc.C)} − ${par(abc.B)}² = ${num(abc.disc)}. ${abc.real === 3 ? 'It is 0, so the test fails: the point could be a minimum, a maximum or a saddle point, and f has to be examined directly.' : abc.real === 2 ? 'It is negative, so the point is a saddle point whatever the signs of A and C.' : abc.real === 0 ? `It is positive and A = ${num(abc.A)} > 0, so the point is a minimum.` : `It is positive and A = ${num(abc.A)} < 0, so the point is a maximum.`}`,
          `AC − B² = ${par(abc.A)}·${par(abc.C)} − ${par(abc.B)}² = ${num(abc.disc)}。${abc.real === 3 ? '它等于 0，所以判别法失效：该点可能是最小值点、最大值点或鞍点，必须直接研究 f。' : abc.real === 2 ? '它为负，所以无论 A、C 的符号如何，该点都是鞍点。' : abc.real === 0 ? `它为正且 A = ${num(abc.A)} > 0，所以该点是最小值点。` : `它为正且 A = ${num(abc.A)} < 0，所以该点是最大值点。`}`),
        audit: { kind: 'MIT-MV-22:classify-abc', params: { A: abc.A, B: abc.B, C: abc.C } },
      }),
      g.choice({
        id: 'classify-quad', title: t('Classify a critical point with a cross term', '对含交叉项的临界点分类'),
        prompt: t(`f(x, y) = ${poly(Fq, XY)} has its critical point at P = ${pt2(q.xs, q.ys)}, where f_x = f_y = 0. Its second partial derivatives are constants. Use the second derivative test to decide what kind of point P is. The picture shows level curves of f; the caption gives their values.`,
          `f(x, y) = ${poly(Fq, XY)} 的临界点是 P = ${pt2(q.xs, q.ys)}，该处 f_x = f_y = 0。它的二阶偏导数是常数。用二阶导数判别法判断 P 是哪种点。图中是 f 的等高线，图注给出了它们的值。`),
        figure: g.figure({
          alt: t(`Level curves of f near P = ${pt2(q.xs, q.ys)}: ${figAlt[0]}.`, `f 在 P = ${pt2(q.xs, q.ys)} 附近的等高线：${figAlt[1]}。`),
          view: viewQ, axes: { grid: true }, shapes: shapesQ,
          caption: t(`Curves f = f(P) + h, f(P) = ${num(fq)}, for ${[posH && `h = ${posH}${negH ? ' (first colour)' : ''}`, negH && `h = ${negH}${posH ? ' (second colour)' : ''}`].filter(Boolean).join(' and ')}`, `曲线 f = f(P) + h，f(P) = ${num(fq)}，${[posH && `h = ${posH}${negH ? '（第一种颜色）' : ''}`, negH && `h = ${negH}${posH ? '（第二种颜色）' : ''}`].filter(Boolean).join('；')}`),
        }),
        options: opts4.slice(0, 3), correct: q.kind === 2 ? 2 : q.kind, fixedOrder: true,
        hint: t('For a quadratic function the second partials are constants: A = f_xx, B = f_xy, C = f_yy. Compute AC − B² and the sign of A.', '二次函数的二阶偏导数是常数：A = f_xx，B = f_xy，C = f_yy。计算 AC − B² 以及 A 的符号。'),
        explanation: t(`A = f_xx = ${num(2 * q.a)}, B = f_xy = ${num(q.b)}, C = f_yy = ${num(2 * q.c)}. AC − B² = ${par(2 * q.a)}·${par(2 * q.c)} − ${par(q.b)}² = ${num(q.disc)}. ${q.kind === 2 ? 'This is negative, so P is a saddle point.' : q.kind === 0 ? `This is positive and A = ${num(2 * q.a)} > 0, so P is a minimum.` : `This is positive and A = ${num(2 * q.a)} < 0, so P is a maximum.`} The level curves agree: ${figAlt[0]}.`,
          `A = f_xx = ${num(2 * q.a)}，B = f_xy = ${num(q.b)}，C = f_yy = ${num(2 * q.c)}。AC − B² = ${par(2 * q.a)}·${par(2 * q.c)} − ${par(q.b)}² = ${num(q.disc)}。${q.kind === 2 ? '它为负，所以 P 是鞍点。' : q.kind === 0 ? `它为正且 A = ${num(2 * q.a)} > 0，所以 P 是最小值点。` : `它为正且 A = ${num(2 * q.a)} < 0，所以 P 是最大值点。`}等高线与此一致：${figAlt[1]}。`),
        audit: { kind: 'MIT-MV-22:classify-quadratic', params: { a: q.a, b: q.b, c: q.c, d: q.d, e: q.e } },
      }),
      g.number({
        id: 'critical-point', title: t('The second critical point', '另一个临界点'),
        prompt: t(`f(x, y) = ${poly(Fc, XY)} has exactly two critical points: (0, 0) and one more point P. Find P, the point with f_x = f_y = 0 other than (0, 0).`,
          `f(x, y) = ${poly(Fc, XY)} 恰有两个临界点：(0, 0) 和另一个点 P。求 P，即除 (0, 0) 之外满足 f_x = f_y = 0 的点。`),
        fields: [{ label: t('x of P', 'P 的 x'), answer: k }, { label: t('y of P', 'P 的 y'), answer: k }],
        hint: t('Write f_x = 0 and f_y = 0 and simplify each. Each gives one square on the left, so compare the two equations for a point with x ≠ 0 and y ≠ 0.', '写出 f_x = 0 与 f_y = 0 并各自化简。每个方程左边含一个平方项，比较这两个方程，求 x ≠ 0 且 y ≠ 0 的点。'),
        explanation: t(`f_x = ${poly(D(Fc, 0), XY)} = 0 and f_y = ${poly(D(Fc, 1), XY)} = 0. Dividing by ${num(3 * pp)} gives x² = ${coef(k, 'y')} and y² = ${coef(k, 'x')}. If x and y are not 0, subtracting gives x² − y² = ${kyx}, so (x − y)(x + y ${term(k)}) = 0. The factor x + y ${term(k)} = 0 is impossible: adding x² = ${coef(k, 'y')} and y² = ${coef(k, 'x')} gives x² + y² = ${linear([k, k], ['x', 'y'])}, which would equal ${num(-k * k)} < 0 if x + y = ${num(-k)}. Hence x = y, and x² = ${coef(k, 'x')} gives x = ${num(k)}. Check: f_x(${num(k)}, ${num(k)}) = ${subst(D(Fc, 0), [k, k])} = 0.`,
          `f_x = ${poly(D(Fc, 0), XY)} = 0 与 f_y = ${poly(D(Fc, 1), XY)} = 0。两边除以 ${num(3 * pp)} 得 x² = ${coef(k, 'y')}，y² = ${coef(k, 'x')}。设 x、y 都不为 0，两式相减得 x² − y² = ${kyx}，所以 (x − y)(x + y ${term(k)}) = 0。因式 x + y ${term(k)} = 0 不可能成立：把 x² = ${coef(k, 'y')} 与 y² = ${coef(k, 'x')} 相加得 x² + y² = ${linear([k, k], ['x', 'y'])}，若 x + y = ${num(-k)}，它就等于 ${num(-k * k)} < 0。于是 x = y，再由 x² = ${coef(k, 'x')} 得 x = ${num(k)}。检验：f_x(${num(k)}, ${num(k)}) = ${subst(D(Fc, 0), [k, k])} = 0。`),
        audit: { kind: 'MIT-MV-22:second-critical-point', params: { p: pp, c: cc } },
      }),
      g.number({
        id: 'discriminants', title: t('AC − B² at both critical points', '两个临界点处的 AC − B²'),
        prompt: t(`f(x, y) = ${poly(Fc, XY)} has the critical points (0, 0) and P = ${pt2(k, k)}. With A = f_xx, B = f_xy and C = f_yy, compute AC − B² at (0, 0) and at P.`,
          `f(x, y) = ${poly(Fc, XY)} 的临界点是 (0, 0) 与 P = ${pt2(k, k)}。记 A = f_xx，B = f_xy，C = f_yy，分别求 (0, 0) 与 P 处的 AC − B²。`),
        fields: [{ label: t('AC − B² at (0, 0)', '(0, 0) 处的 AC − B²'), answer: -cc * cc }, { label: t('AC − B² at P', 'P 处的 AC − B²'), answer: discP }],
        hint: t('Differentiate twice: f_xx and f_yy depend on x and y, while f_xy is a constant here. Then substitute each point.', '求两次导：f_xx 与 f_yy 依赖于 x、y，而 f_xy 在这里是常数。然后代入各点。'),
        explanation: t(`f_xx = ${fxxX}, f_xy = ${num(cc)}, f_yy = ${fyyY}. At (0, 0): A = 0, B = ${num(cc)}, C = 0, so AC − B² = 0·0 − ${par(cc)}² = ${num(-cc * cc)}. At P: A = ${num(Ap)}, B = ${num(cc)}, C = ${num(Ap)}, so AC − B² = ${par(Ap)}·${par(Ap)} − ${par(cc)}² = ${Ap * Ap} − ${cc * cc} = ${discP}.`,
          `f_xx = ${fxxX}，f_xy = ${num(cc)}，f_yy = ${fyyY}。在 (0, 0)：A = 0，B = ${num(cc)}，C = 0，所以 AC − B² = 0·0 − ${par(cc)}² = ${num(-cc * cc)}。在 P：A = ${num(Ap)}，B = ${num(cc)}，C = ${num(Ap)}，所以 AC − B² = ${par(Ap)}·${par(Ap)} − ${par(cc)}² = ${Ap * Ap} − ${cc * cc} = ${discP}。`),
        audit: { kind: 'MIT-MV-22:discriminants', params: { p: pp, c: cc } },
      }),
      g.choice({
        id: 'classify-two', title: t('Classify both critical points', '对两个临界点分类'),
        prompt: t(`For f(x, y) = ${poly(Fc, XY)} the critical points are (0, 0) and P = ${pt2(k, k)}. The second partials are f_xx = ${fxxX}, f_xy = ${num(cc)} and f_yy = ${fyyY}. Which statement is correct?`,
          `对 f(x, y) = ${poly(Fc, XY)}，临界点是 (0, 0) 与 P = ${pt2(k, k)}。二阶偏导数为 f_xx = ${fxxX}，f_xy = ${num(cc)}，f_yy = ${fyyY}。哪个说法正确？`),
        options: [
          t('(0, 0) is a saddle point and P is a minimum point.', '(0, 0) 是鞍点，P 是最小值点。'),
          t('(0, 0) is a saddle point and P is a maximum point.', '(0, 0) 是鞍点，P 是最大值点。'),
          t('(0, 0) is a minimum point and P is a saddle point.', '(0, 0) 是最小值点，P 是鞍点。'),
          t('Both (0, 0) and P are saddle points.', '(0, 0) 与 P 都是鞍点。'),
        ], correct: maxOrMin,
        hint: t('Use AC − B² at each point, and for a positive AC − B² look at the sign of A.', '对每个点用 AC − B²；若 AC − B² 为正，再看 A 的符号。'),
        explanation: t(`At (0, 0): AC − B² = 0·0 − ${par(cc)}² = ${num(-cc * cc)} < 0, a saddle point. At P: AC − B² = ${discP} > 0 and A = f_xx(P) = ${num(Ap)}, which is ${Ap > 0 ? 'positive, so P is a minimum point' : 'negative, so P is a maximum point'}.`,
          `在 (0, 0)：AC − B² = 0·0 − ${par(cc)}² = ${num(-cc * cc)} < 0，是鞍点。在 P：AC − B² = ${discP} > 0，且 A = f_xx(P) = ${num(Ap)}，${Ap > 0 ? '为正，所以 P 是最小值点' : '为负，所以 P 是最大值点'}。`),
        audit: { kind: 'MIT-MV-22:classify-two', params: { p: pp, c: cc } },
      }),
      g.choice({
        id: 'fails', title: t('What the test says when AC − B² = 0', 'AC − B² = 0 时判别法说了什么'),
        prompt: t(`f(x, y) = ${poly(F4, XY)} has f_x = ${poly(D(F4, 0), XY)} and f_y = ${poly(D(F4, 1), XY)}, so (0, 0) is a critical point. All second partial derivatives f_xx, f_xy, f_yy are 0 at (0, 0). What does the second derivative test say about (0, 0)?`,
          `f(x, y) = ${poly(F4, XY)} 有 f_x = ${poly(D(F4, 0), XY)}，f_y = ${poly(D(F4, 1), XY)}，所以 (0, 0) 是临界点。在 (0, 0) 处所有二阶偏导数 f_xx、f_xy、f_yy 都为 0。二阶导数判别法对 (0, 0) 说了什么？`),
        options: [
          t('Nothing: AC − B² = 0, so the test fails and f must be examined directly.', '什么也没说：AC − B² = 0，判别法失效，必须直接研究 f。'),
          t('(0, 0) is a saddle point, because AC − B² = 0 is not greater than zero.', '(0, 0) 是鞍点，因为 AC − B² = 0 不大于零。'),
          t('(0, 0) is not a critical point, because all the second partial derivatives vanish there.', '(0, 0) 不是临界点，因为所有二阶偏导数在那里都等于零。'),
        ], correct: 0,
        hint: t('Compute AC − B² from the three second partials at (0, 0) and recall the case AC − B² = 0.', '用 (0, 0) 处的三个二阶偏导数算出 AC − B²，并回想 AC − B² = 0 的情形。'),
        explanation: t('A = B = C = 0, so AC − B² = 0 and the test fails. It does not say that the point is a saddle (that needs AC − B² < 0), and a critical point is defined by f_x = f_y = 0, not by the second partials.',
          'A = B = C = 0，所以 AC − B² = 0，判别法失效。它并不说明该点是鞍点（那需要 AC − B² < 0），而临界点由 f_x = f_y = 0 定义，与二阶偏导数无关。'),
        audit: { kind: 'MIT-MV-22:test-fails', params: { s: fs, t: ft } },
      }),
      g.choice({
        id: 'fails-look', title: t('When the test fails, look at f', '判别法失效时，直接看 f'),
        prompt: t(`The second derivative test fails at the critical point (0, 0) of f(x, y) = ${poly(F4, XY)}. Decide what kind of point (0, 0) is by looking at f itself, for example along the x-axis (y = 0) and along the y-axis (x = 0).`,
          `二阶导数判别法在 f(x, y) = ${poly(F4, XY)} 的临界点 (0, 0) 处失效。直接观察 f 本身（例如沿 x 轴 y = 0 与沿 y 轴 x = 0）来判断 (0, 0) 是哪种点。`),
        options: opts4.slice(0, 3), correct: look, fixedOrder: true,
        hint: t('Compare f(x, 0) and f(0, y) with f(0, 0) = 0. Fourth powers are never negative.', '把 f(x, 0) 与 f(0, y) 同 f(0, 0) = 0 比较。四次方永远不为负。'),
        explanation: t(`f(x, 0) = ${poly([[fs, 4]], ['x'])} is ${fs > 0 ? 'at least' : 'at most'} 0 and f(0, y) = ${poly([[ft, 4]], ['y'])} is ${ft > 0 ? 'at least' : 'at most'} 0. ${look === 0 ? 'Both are at least 0 and f is a sum of two non-negative terms, so f ≥ 0 everywhere: a minimum point.' : look === 1 ? 'Both are at most 0 and f is a sum of two non-positive terms, so f ≤ 0 everywhere: a maximum point.' : 'f is above 0 along one axis and below 0 along the other, so (0, 0) is a saddle point.'} The test failed here, yet the point can still be classified.`,
          `f(x, 0) = ${poly([[fs, 4]], ['x'])} ${fs > 0 ? '不小于' : '不大于'} 0，f(0, y) = ${poly([[ft, 4]], ['y'])} ${ft > 0 ? '不小于' : '不大于'} 0。${look === 0 ? '两者都不小于 0，且 f 是两个非负项之和，所以处处 f ≥ 0：最小值点。' : look === 1 ? '两者都不大于 0，且 f 是两个非正项之和，所以处处 f ≤ 0：最大值点。' : '沿一条坐标轴 f 大于 0，沿另一条小于 0，所以 (0, 0) 是鞍点。'}判别法在这里失效，但该点仍然可以分类。`),
        audit: { kind: 'MIT-MV-22:classify-flat', params: { s: fs, t: ft } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`f(x, y) = ${poly(Fh, XY)} has four critical points: (0, 0), (${num(ck)}, 0), (0, ${num(ck)}) and one point P = (m, m) with m ≠ 0. Find m, then A = f_xx and AC − B² at P.`,
          `f(x, y) = ${poly(Fh, XY)} 有四个临界点：(0, 0)、(${num(ck)}, 0)、(0, ${num(ck)}) 以及一个 m ≠ 0 的点 P = (m, m)。求 m，然后求 P 处的 A = f_xx 与 AC − B²。`),
        fields: [{ label: t('m', 'm'), answer: cm }, { label: t('A = f_xx at P', 'P 处的 A = f_xx'), answer: hA }, { label: t('AC − B² at P', 'P 处的 AC − B²'), answer: hDisc }],
        hint: t('Factor f_x and f_y: each is a product of a variable and a linear expression. Put x = y and solve for m.', '把 f_x 与 f_y 因式分解：每个都是一个变量乘一个线性式。令 x = y 并解出 m。'),
        explanation: t(`f_x = ${coef(cq, 'y')}(${num(ck)} − 2x − y) and f_y = ${coef(cq, 'x')}(${num(ck)} − x − 2y). With x = y = m ≠ 0 both give ${num(ck)} − 3m = 0, so m = ${num(cm)}. Second partials: f_xx = ${coef(-2 * cq, 'y')}, f_xy = ${qwrap(`${num(ck)} − 2x − 2y`)}, f_yy = ${coef(-2 * cq, 'x')}. At P: A = ${num(hA)}, B = ${qwrapDot(`${num(ck)} − ${par(4 * cm)}`)} = ${num(hB)}, C = ${num(hA)}, so AC − B² = ${par(hA)}·${par(hA)} − ${par(hB)}² = ${hA * hA} − ${hB * hB} = ${hDisc} > 0 and A is ${hA < 0 ? 'negative: P is a maximum point' : 'positive: P is a minimum point'}. You practised the AC − B² test at smooth critical points; why the test works is not assessed here.`,
          `f_x = ${coef(cq, 'y')}(${num(ck)} − 2x − y)，f_y = ${coef(cq, 'x')}(${num(ck)} − x − 2y)。令 x = y = m ≠ 0，两式都给出 ${num(ck)} − 3m = 0，所以 m = ${num(cm)}。二阶偏导数：f_xx = ${coef(-2 * cq, 'y')}，f_xy = ${qwrap(`${num(ck)} − 2x − 2y`)}，f_yy = ${coef(-2 * cq, 'x')}。在 P：A = ${num(hA)}，B = ${qwrapDot(`${num(ck)} − ${par(4 * cm)}`)} = ${num(hB)}，C = ${num(hA)}，所以 AC − B² = ${par(hA)}·${par(hA)} − ${par(hB)}² = ${hA * hA} − ${hB * hB} = ${hDisc} > 0，且 A ${hA < 0 ? '为负：P 是最大值点' : '为正：P 是最小值点'}。你练习了在光滑临界点处使用 AC − B² 判别法；判别法为何成立不在这里考查。`),
        audit: { kind: 'MIT-MV-22:challenge', params: { q: cq, k: ck } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-23': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-23');
    warm(g);
    const deltas = [-0.3, -0.2, -0.1, 0.1, 0.2, 0.3];

    // shared function w = a xyz + b x² + c yz + d x
    const sw = retry(() => {
      const a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), c = g.nonzero(-2, 2), d = g.random(-3, 3), P = [g.nonzero(-2, 2), g.nonzero(-2, 2), g.nonzero(-2, 2)];
      const W: Mono[] = [[a, 1, 1, 1], [b, 2, 0, 0], [c, 0, 1, 1], [d, 1, 0, 0]];
      return { a, b, c, d, P, W, wx: ev(D(W, 0), P), wy: ev(D(W, 1), P), wz: ev(D(W, 2), P) };
    }, v => [v.wx, v.wy, v.wz].filter(x => x !== 0).length >= 2);
    const { a: wa, b: wb, c: wc, d: wd, P, W } = sw;
    const Wx = D(W, 0), Wy = D(W, 1), Wz = D(W, 2);
    const wxP = sw.wx, wyP = sw.wy, wzP = sw.wz;
    const inc = retry(() => ({ dx: g.pick(deltas), dy: g.pick(deltas), dz: g.pick(deltas) }), v => Math.abs(wxP * v.dx + wyP * v.dy + wzP * v.dz) >= 0.05);
    const dwP = round2(wxP * inc.dx + wyP * inc.dy + wzP * inc.dz);

    // path x = t, y = q t², z = r t
    const path = retry(() => {
      const q = g.pick([1, 2]), r = g.pick([-2, -1, 1, 2]), t0 = g.pick([-2, -1, 1, 2]);
      const at = [t0, q * t0 * t0, r * t0];
      const wx = ev(Wx, at), wy = ev(Wy, at), wz = ev(Wz, at), yp = 2 * q * t0;
      return { q, r, t0, at, wx, wy, wz, yp, ans: wx + wy * yp + wz * r };
    }, v => Math.abs(v.ans) <= 150);

    // given-data
    const dstr = (p: number) => (p === 1 ? '1' : p === 2 ? '2t' : `${p}t^${p - 1}`);
    const tpow = (p: number) => (p === 0 ? '1' : p === 1 ? 't' : `t^${p}`);
    const gp = g.random(1, 4), gq = retry(() => g.random(1, 4), v => v !== gp), gm = g.nonzero(-4, 4), gn = g.nonzero(-4, 4);

    // bug on a hot plate
    const bug = retry(() => {
      const p = g.random(1, 3), qq = g.random(1, 3), a = g.pick([-2, -1, 1, 2]), b = g.random(-2, 2), c = g.pick([-2, -1, 1, 2]), t0 = g.random(1, 2);
      const x0 = a * t0, y0 = b + c * t0;
      return { p, qq, a, b, c, t0, x0, y0, ans: -2 * p * x0 * a - 2 * qq * y0 * c };
    }, v => v.ans !== 0 && v.x0 !== 0 && v.y0 !== 0);
    const Tf: Mono[] = [[100, 0, 0], [-bug.p, 2, 0], [-bug.qq, 0, 2]];
    const bugShapes: FigureShape[] = [
      ...[4, 16, 36].map((kk): FigureShape => ({ kind: 'line', points: ellipse(0, 0, Math.sqrt(kk / bug.p), Math.sqrt(kk / bug.qq), 72), tone: 'muted', width: 1.5 })),
      { kind: 'arrow', from: [bug.a * (bug.t0 - 1), bug.b + bug.c * (bug.t0 - 1)], to: [bug.a * (bug.t0 + 1), bug.b + bug.c * (bug.t0 + 1)], tone: 'accent', width: 2 },
      { kind: 'point', at: [bug.x0, bug.y0] as Pt, tone: 'warn', label: 'bug' },
    ];

    // challenge: w = a xy + b y z² + c x; x = t², y = t + r, z = q t
    const ch = retry(() => {
      const a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), c = g.nonzero(-2, 2), r = g.random(-2, 2), q = g.pick([1, 2]), t0 = g.pick([-1, 1, 2]);
      const F: Mono[] = [[a, 1, 1, 0], [b, 0, 1, 2], [c, 1, 0, 0]];
      const at = [t0 * t0, t0 + r, q * t0];
      const wx = ev(D(F, 0), at), wy = ev(D(F, 1), at), wz = ev(D(F, 2), at);
      return { a, b, c, r, q, t0, F, at, wx, wy, wz, ans: wx * 2 * t0 + wy + wz * q };
    }, v => Math.abs(v.ans) <= 200 && v.ans !== 0);
    const pathY = shiftVar('t', ch.r);

    const tokens = ['w_x x′', 'w_y y′', 'w_z z′', '+', 'w_x y′', 'w_y z′', 'w_z x′', '·'];
    const pickNames = g.random(0, 1);
    const nVars = pickNames === 0 ? 'x, y' : 'x, y, z';

    return [
      g.number({
        id: 'differential-coefficients', title: t('The coefficients of the total differential', '全微分的系数'),
        prompt: t(`w = ${poly(W, XYZ)}. The total differential at a point P is dw = w_x(P) dx + w_y(P) dy + w_z(P) dz. Find the three coefficients w_x(P), w_y(P) and w_z(P) at P = (x, y, z) = ${vec(...P)}.`,
          `w = ${poly(W, XYZ)}。在点 P 处的全微分为 dw = w_x(P) dx + w_y(P) dy + w_z(P) dz。求 P = (x, y, z) = ${vec(...P)} 处的三个系数 w_x(P)、w_y(P)、w_z(P)。`),
        fields: [{ label: t('w_x(P)', 'w_x(P)'), answer: wxP }, { label: t('w_y(P)', 'w_y(P)'), answer: wyP }, { label: t('w_z(P)', 'w_z(P)'), answer: wzP }],
        hint: t('Differentiate in one variable at a time, treating the other two as constants, then substitute P.', '每次只对一个变量求导，把另外两个当作常数，最后代入 P。'),
        explanation: t(`w_x = ${poly(Wx, XYZ)}, w_y = ${poly(Wy, XYZ)}, w_z = ${poly(Wz, XYZ)}. At P: w_x = ${subst(Wx, P)} = ${num(wxP)}, w_y = ${subst(Wy, P)} = ${num(wyP)}, w_z = ${subst(Wz, P)} = ${num(wzP)}. So dw = ${linear([wxP, wyP, wzP], ['dx', 'dy', 'dz'])} at P.`,
          `w_x = ${poly(Wx, XYZ)}，w_y = ${poly(Wy, XYZ)}，w_z = ${poly(Wz, XYZ)}。在 P 处：w_x = ${subst(Wx, P)} = ${num(wxP)}，w_y = ${subst(Wy, P)} = ${num(wyP)}，w_z = ${subst(Wz, P)} = ${num(wzP)}。所以在 P 处 dw = ${linear([wxP, wyP, wzP], ['dx', 'dy', 'dz'])}。`),
        audit: { kind: 'MIT-MV-23:differential-coefficients', params: { a: wa, b: wb, c: wc, d: wd, x0: P[0], y0: P[1], z0: P[2] } },
      }),
      g.number({
        id: 'differential-value', title: t('Using the total differential', '使用全微分'),
        prompt: t(`For the same w = ${poly(W, XYZ)} and P = ${vec(...P)}, use the total differential dw = w_x dx + w_y dy + w_z dz to find dw when dx = ${num(inc.dx)}, dy = ${num(inc.dy)} and dz = ${num(inc.dz)}. Enter dw as a decimal.`,
          `对同样的 w = ${poly(W, XYZ)} 与 P = ${vec(...P)}，用全微分 dw = w_x dx + w_y dy + w_z dz，求当 dx = ${num(inc.dx)}，dy = ${num(inc.dy)}，dz = ${num(inc.dz)} 时的 dw。请用小数输入 dw。`),
        fields: [{ label: t('dw', 'dw'), answer: dwP, tolerance: 0.005 }],
        hint: t('Use the three coefficients at P from the previous card and multiply each by its own increment.', '用上一张卡中 P 处的三个系数，各自乘以对应的增量。'),
        explanation: t(`dw = ${par(wxP)}·${par(inc.dx)} + ${par(wyP)}·${par(inc.dy)} + ${par(wzP)}·${par(inc.dz)} = ${par(round2(wxP * inc.dx))} + ${par(round2(wyP * inc.dy))} + ${par(round2(wzP * inc.dz))} = ${num(dwP)}. This is the first-order change of w, not the exact change.`,
          `dw = ${par(wxP)}·${par(inc.dx)} + ${par(wyP)}·${par(inc.dy)} + ${par(wzP)}·${par(inc.dz)} = ${par(round2(wxP * inc.dx))} + ${par(round2(wyP * inc.dy))} + ${par(round2(wzP * inc.dz))} = ${num(dwP)}。这是 w 的一阶变化量，不是精确的变化量。`),
        audit: { kind: 'MIT-MV-23:differential-value', params: { a: wa, b: wb, c: wc, d: wd, x0: P[0], y0: P[1], z0: P[2], dx: inc.dx, dy: inc.dy, dz: inc.dz } },
      }),
      g.choice({
        id: 'derive', title: t('Where the chain rule comes from', '链式法则从何而来'),
        prompt: t('Suppose w = f(x, y, z) and x, y, z are functions of t. The tangent approximation says Δw ≈ w_x Δx + w_y Δy + w_z Δz. How does this lead to the chain rule for dw/dt?',
          '设 w = f(x, y, z)，且 x、y、z 是 t 的函数。切平面近似给出 Δw ≈ w_x Δx + w_y Δy + w_z Δz。它如何导出 dw/dt 的链式法则？'),
        options: [
          t('Divide both sides by Δt and let Δt → 0: the quotients Δx/Δt, Δy/Δt, Δz/Δt become dx/dt, dy/dt, dz/dt.', '两边同除以 Δt 并令 Δt → 0：商 Δx/Δt、Δy/Δt、Δz/Δt 变为 dx/dt、dy/dt、dz/dt。'),
          t('Put Δx = Δy = Δz = 1, which gives dw/dt = w_x + w_y + w_z along every curve in space, whatever its speed or direction.', '取 Δx = Δy = Δz = 1，沿空间中任何曲线（不论速度和方向如何）都得到 dw/dt = w_x + w_y + w_z。'),
          t('Multiply both sides by Δt and let Δt → 0: then Δw → 0 as well, so dw/dt = 0 along every curve in space and for every function f.', '两边同乘以 Δt 并令 Δt → 0：此时 Δw 也趋于 0，所以对每个函数 f，沿空间中任何曲线都有 dw/dt = 0。'),
        ], correct: 0,
        hint: t('You want a rate of change with respect to t. What do you have to do to Δw to get one?', '你想要的是对 t 的变化率。要得到它，应当对 Δw 做什么？'),
        explanation: t('Dividing by Δt turns each increment into a rate: Δw/Δt ≈ w_x (Δx/Δt) + w_y (Δy/Δt) + w_z (Δz/Δt). As Δt → 0 the quotients become derivatives: dw/dt = w_x dx/dt + w_y dy/dt + w_z dz/dt. Setting the increments equal to 1 ignores how fast x, y, z actually change, and multiplying by Δt makes the equation say nothing about a rate.',
          '除以 Δt 把每个增量变成变化率：Δw/Δt ≈ w_x (Δx/Δt) + w_y (Δy/Δt) + w_z (Δz/Δt)。当 Δt → 0 时，这些商变为导数：dw/dt = w_x dx/dt + w_y dy/dt + w_z dz/dt。把增量都取为 1 忽略了 x、y、z 实际变化的快慢，而乘以 Δt 得到的式子并不描述变化率。'),
      }),
      g.symbols({
        id: 'chain-formula', title: t('The chain rule for dw/dt', 'dw/dt 的链式法则'),
        prompt: t('w = f(x, y, z) and x, y, z are functions of t (x′ means dx/dt, and so on). Fill the blanks to complete the chain rule. Put the x-term first, the y-term second and the z-term last.', 'w = f(x, y, z)，且 x、y、z 是 t 的函数（x′ 表示 dx/dt，其余类推）。填空补全链式法则。x 项在前，y 项居中，z 项在最后。'),
        before: 'dw/dt =', between: [' ', ' ', ' ', ' '], answers: ['w_x x′', '+', 'w_y y′', '+', 'w_z z′'], tokens,
        hint: t('Each partial derivative of w is multiplied by the rate of change of its own variable.', 'w 的每个偏导数都乘以其自身变量的变化率。'),
        explanation: t('dw/dt = w_x x′ + w_y y′ + w_z z′. Each partial derivative says how w reacts to one variable, and that variable changes at its own rate with t. Pairing w_x with y′ is the typical slip.',
          'dw/dt = w_x x′ + w_y y′ + w_z z′。每个偏导数说明 w 对一个变量的反应，而该变量随 t 以自己的速率变化。把 w_x 与 y′ 相配是常见的错误。'),
      }),
      g.number({
        id: 'chain-path', title: t('The chain rule along a path', '沿路径用链式法则'),
        prompt: t(`w = ${poly(W, XYZ)} and a particle moves with x = t, y = ${coef(path.q, 't²')}, z = ${coef(path.r, 't')}. Find dw/dt at t = ${num(path.t0)} using the chain rule, without substituting x, y, z into w first.`,
          `w = ${poly(W, XYZ)}，一个质点按 x = t，y = ${coef(path.q, 't²')}，z = ${coef(path.r, 't')} 运动。用链式法则求 t = ${num(path.t0)} 时的 dw/dt，不要先把 x、y、z 代入 w。`),
        fields: [{ label: t('dw/dt', 'dw/dt'), answer: path.ans }],
        hint: t('First find the point (x, y, z) at this t, the three partial derivatives of w there, and dx/dt, dy/dt, dz/dt. Then add the three products.', '先求此刻 t 对应的点 (x, y, z)、w 在该点的三个偏导数，以及 dx/dt、dy/dt、dz/dt。然后把三个乘积相加。'),
        explanation: t(`At t = ${num(path.t0)}: (x, y, z) = ${vec(...path.at)}. w_x = ${poly(Wx, XYZ)} = ${num(path.wx)}, w_y = ${poly(Wy, XYZ)} = ${num(path.wy)}, w_z = ${poly(Wz, XYZ)} = ${num(path.wz)}. Also dx/dt = 1, dy/dt = ${num(path.yp)}, dz/dt = ${num(path.r)}. So dw/dt = ${par(path.wx)}·1 + ${par(path.wy)}·${par(path.yp)} + ${par(path.wz)}·${par(path.r)} = ${num(path.ans)}. The ordinary d is used because w ends up depending on the single variable t.`,
          `在 t = ${num(path.t0)} 时：(x, y, z) = ${vec(...path.at)}。w_x = ${poly(Wx, XYZ)} = ${num(path.wx)}，w_y = ${poly(Wy, XYZ)} = ${num(path.wy)}，w_z = ${poly(Wz, XYZ)} = ${num(path.wz)}。又 dx/dt = 1，dy/dt = ${num(path.yp)}，dz/dt = ${num(path.r)}。所以 dw/dt = ${par(path.wx)}·1 + ${par(path.wy)}·${par(path.yp)} + ${par(path.wz)}·${par(path.r)} = ${num(path.ans)}。这里用普通的 d，因为 w 最终只依赖于单个变量 t。`),
        audit: { kind: 'MIT-MV-23:chain-path', params: { a: wa, b: wb, c: wc, d: wd, q: path.q, r: path.r, t0: path.t0 } },
      }),
      g.number({
        id: 'given-data', title: t('Only the numbers at the point', '只给出该点的数值'),
        prompt: t(`w = f(x, y) is a function whose formula is not given. A bug moves with x = ${tpow(gp)}, y = ${tpow(gq)}. At the point (x, y) = (1, 1), which the bug passes at t = 1, the partial derivatives are ∂w/∂x = ${num(gm)} and ∂w/∂y = ${num(gn)}. Find dw/dt at t = 1.`,
          `w = f(x, y) 的公式没有给出。一只虫子按 x = ${tpow(gp)}，y = ${tpow(gq)} 运动。它在 t = 1 时经过点 (x, y) = (1, 1)，该点的偏导数为 ∂w/∂x = ${num(gm)}，∂w/∂y = ${num(gn)}。求 t = 1 时的 dw/dt。`),
        fields: [{ label: t('dw/dt at t = 1', 't = 1 时的 dw/dt'), answer: gm * gp + gn * gq }],
        hint: t('The chain rule needs only the partial derivatives at the point and the rates dx/dt, dy/dt at t = 1. You do not need f itself.', '链式法则只需要该点的偏导数以及 t = 1 时的变化率 dx/dt、dy/dt，并不需要 f 本身。'),
        explanation: t(`dx/dt = ${dstr(gp)}, which is ${num(gp)} at t = 1, and dy/dt = ${dstr(gq)}, which is ${num(gq)} at t = 1. So dw/dt = (∂w/∂x)(dx/dt) + (∂w/∂y)(dy/dt) = ${par(gm)}·${gp} + ${par(gn)}·${gq} = ${num(gm * gp + gn * gq)}.`,
          `dx/dt = ${dstr(gp)}，在 t = 1 时等于 ${num(gp)}；dy/dt = ${dstr(gq)}，在 t = 1 时等于 ${num(gq)}。所以 dw/dt = (∂w/∂x)(dx/dt) + (∂w/∂y)(dy/dt) = ${par(gm)}·${gp} + ${par(gn)}·${gq} = ${num(gm * gp + gn * gq)}。`),
        audit: { kind: 'MIT-MV-23:given-data', params: { p: gp, q: gq, wx: gm, wy: gn } },
      }),
      g.choice({
        id: 'notation', title: t('d or ∂?', '用 d 还是 ∂？'),
        prompt: t(`w = f(${nVars}) where ${pickNames === 0 ? 'x and y are' : 'x, y and z are'} functions of the single variable t. How should the rate of change of w with respect to t be written, and why?`,
          `w = f(${nVars})，其中 ${pickNames === 0 ? 'x 与 y 都是' : 'x、y、z 都是'}单个变量 t 的函数。w 对 t 的变化率应如何记，为什么？`),
        options: [
          t('dw/dt, an ordinary derivative, because w ends up depending on the single variable t.', 'dw/dt，普通导数，因为 w 最终只依赖于单个变量 t。'),
          t(`∂w/∂t, a partial derivative, because w is a function of several variables${pickNames === 0 ? ', x and y' : ', x, y and z'}.`, `∂w/∂t，偏导数，因为 w 是${pickNames === 0 ? ' x、y' : ' x、y、z'} 等多个变量的函数。`),
          t('∂w/∂x, because x comes first in the list of variables of f.', '∂w/∂x，因为 x 在 f 的变量列表中排在最前面。'),
        ], correct: 0,
        hint: t('Count the independent variables that w ultimately depends on after the chain of computations t → intermediate variables → w.', '在计算链 t → 中间变量 → w 之后，数一数 w 最终依赖的自变量个数。'),
        explanation: t(`The chain of computations is t → ${nVars} → w, so w is ultimately a function of exactly one independent variable, t. The derivative with respect to t is therefore an ordinary derivative dw/dt, not a partial derivative. The partials ∂w/∂x, ∂w/∂y${pickNames === 0 ? '' : ', ∂w/∂z'} appear inside the chain rule, not as the answer.`,
          `计算链是 t → ${nVars} → w，所以 w 最终恰好是一个自变量 t 的函数。因此对 t 的导数是普通导数 dw/dt，而不是偏导数。偏导数 ∂w/∂x、∂w/∂y${pickNames === 0 ? '' : '、∂w/∂z'} 出现在链式法则的内部，而不是最终结果。`),
      }),
      g.number({
        id: 'bug', title: t('A bug on a hot plate', '热板上的虫子'),
        prompt: t(`The temperature at the point (x, y) of a plate is T(x, y) = ${poly(Tf, XY)}. A bug moves with x = ${coef(bug.a, 't')}, y = ${poly([[bug.b, 0], [bug.c, 1]], ['t'])}. Find the rate dT/dt at which the temperature the bug feels is changing at t = ${bug.t0}. The picture shows some level curves of T and the bug's path.`,
          `平板上点 (x, y) 处的温度为 T(x, y) = ${poly(Tf, XY)}。一只虫子按 x = ${coef(bug.a, 't')}，y = ${poly([[bug.b, 0], [bug.c, 1]], ['t'])} 运动。求 t = ${bug.t0} 时虫子所感受到的温度的变化率 dT/dt。图中画出了 T 的几条等高线和虫子的路径。`),
        figure: g.figure({
          alt: t(`Three nested ellipses centred at the origin (level curves of T) and an arrow showing the bug's straight path, with the bug marked at the point ${pt2(bug.x0, bug.y0)} at t = ${bug.t0}.`, `以原点为中心的三个嵌套椭圆（T 的等高线），以及表示虫子直线路径的箭头，虫子在 t = ${bug.t0} 时位于点 ${pt2(bug.x0, bug.y0)}。`),
          view: fitView(bugShapes, 0.1), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: bugShapes,
          caption: t('Level curves of T and the bug’s path', 'T 的等高线与虫子的路径'),
        }),
        fields: [{ label: t('dT/dt', 'dT/dt'), answer: bug.ans }],
        hint: t('Find the position (x, y) at this time, T_x and T_y there, and the velocity (dx/dt, dy/dt). Then dT/dt = T_x dx/dt + T_y dy/dt.', '求此刻的位置 (x, y)、该处的 T_x 与 T_y 以及速度 (dx/dt, dy/dt)。然后 dT/dt = T_x dx/dt + T_y dy/dt。'),
        explanation: t(`At t = ${bug.t0} the bug is at (x, y) = ${pt2(bug.x0, bug.y0)}. T_x = ${poly([[-2 * bug.p, 1]], ['x'])} = ${num(-2 * bug.p * bug.x0)}, T_y = ${poly([[-2 * bug.qq, 1]], ['y'])} = ${num(-2 * bug.qq * bug.y0)}, dx/dt = ${num(bug.a)}, dy/dt = ${num(bug.c)}. So dT/dt = ${par(-2 * bug.p * bug.x0)}·${par(bug.a)} + ${par(-2 * bug.qq * bug.y0)}·${par(bug.c)} = ${num(bug.ans)}. ${bug.ans < 0 ? 'The temperature at the bug is falling: it is moving toward cooler places.' : 'The temperature at the bug is rising: it is moving toward hotter places.'}`,
          `在 t = ${bug.t0} 时虫子位于 (x, y) = ${pt2(bug.x0, bug.y0)}。T_x = ${poly([[-2 * bug.p, 1]], ['x'])} = ${num(-2 * bug.p * bug.x0)}，T_y = ${poly([[-2 * bug.qq, 1]], ['y'])} = ${num(-2 * bug.qq * bug.y0)}，dx/dt = ${num(bug.a)}，dy/dt = ${num(bug.c)}。所以 dT/dt = ${par(-2 * bug.p * bug.x0)}·${par(bug.a)} + ${par(-2 * bug.qq * bug.y0)}·${par(bug.c)} = ${num(bug.ans)}。${bug.ans < 0 ? '虫子所在处的温度在下降：它正走向更凉的地方。' : '虫子所在处的温度在上升：它正走向更热的地方。'}`),
        audit: { kind: 'MIT-MV-23:bug', params: { p: bug.p, q: bug.qq, a: bug.a, b: bug.b, c: bug.c, t0: bug.t0 } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`w = ${poly(ch.F, XYZ)} with x = t², y = ${pathY}, z = ${coef(ch.q, 't')}. Find dw/dt at t = ${num(ch.t0)}.`,
          `w = ${poly(ch.F, XYZ)}，x = t²，y = ${pathY}，z = ${coef(ch.q, 't')}。求 t = ${num(ch.t0)} 时的 dw/dt。`),
        fields: [{ label: t('dw/dt', 'dw/dt'), answer: ch.ans }],
        hint: t('Chain rule: dw/dt = w_x·dx/dt + w_y·dy/dt + w_z·dz/dt, with the partial derivatives evaluated at the point (x, y, z) reached at this t.', '链式法则：dw/dt = w_x·dx/dt + w_y·dy/dt + w_z·dz/dt，其中偏导数取在此刻 t 所到达的点 (x, y, z) 处。'),
        explanation: t(`At t = ${num(ch.t0)}: (x, y, z) = ${vec(...ch.at)}. w_x = ${poly(D(ch.F, 0), XYZ)} = ${num(ch.wx)}, w_y = ${poly(D(ch.F, 1), XYZ)} = ${num(ch.wy)}, w_z = ${poly(D(ch.F, 2), XYZ)} = ${num(ch.wz)}. dx/dt = 2t = ${num(2 * ch.t0)}, dy/dt = 1, dz/dt = ${num(ch.q)}. dw/dt = ${par(ch.wx)}·${par(2 * ch.t0)} + ${par(ch.wy)}·1 + ${par(ch.wz)}·${par(ch.q)} = ${num(ch.ans)}. You practised the chain rule and total differentials for polynomials; functions whose partial derivatives are discontinuous are not assessed.`,
          `在 t = ${num(ch.t0)} 时：(x, y, z) = ${vec(...ch.at)}。w_x = ${poly(D(ch.F, 0), XYZ)} = ${num(ch.wx)}，w_y = ${poly(D(ch.F, 1), XYZ)} = ${num(ch.wy)}，w_z = ${poly(D(ch.F, 2), XYZ)} = ${num(ch.wz)}。dx/dt = 2t = ${num(2 * ch.t0)}，dy/dt = 1，dz/dt = ${num(ch.q)}。dw/dt = ${par(ch.wx)}·${par(2 * ch.t0)} + ${par(ch.wy)}·1 + ${par(ch.wz)}·${par(ch.q)} = ${num(ch.ans)}。你练习了多项式的链式法则与全微分；偏导数不连续的函数不在这里考查。`),
        audit: { kind: 'MIT-MV-23:challenge', params: { a: ch.a, b: ch.b, c: ch.c, r: ch.r, q: ch.q, t0: ch.t0 } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-24': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-24');
    warm(g);
    const deltas = [-0.3, -0.2, -0.1, 0.1, 0.2, 0.3];
    /** "4u = −4", or just "2" when the derivative is already a constant. */
    const dval = (terms: Mono[], at: number[]) => { const text = poly(terms, UV), value = num(ev(terms, at)); return text === value ? value : `${text} = ${value}`; };

    // w = p x²y + q y² + r x with x = a u² + b v, y = c u + d v²
    const s = retry(() => {
      const p = g.nonzero(-2, 2), q = g.nonzero(-2, 2), r = g.random(-2, 2), a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), c = g.nonzero(-2, 2), d = g.nonzero(-2, 2), u0 = g.random(-2, 2), v0 = g.random(-2, 2);
      const W: Mono[] = [[p, 2, 1], [q, 0, 2], [r, 1, 0]];
      const X: Mono[] = [[a, 2, 0], [b, 0, 1]], Y: Mono[] = [[c, 1, 0], [d, 0, 2]];
      const x = ev(X, [u0, v0]), y = ev(Y, [u0, v0]);
      const wx = ev(D(W, 0), [x, y]), wy = ev(D(W, 1), [x, y]);
      const xu = ev(D(X, 0), [u0, v0]), xv = ev(D(X, 1), [u0, v0]), yu = ev(D(Y, 0), [u0, v0]), yv = ev(D(Y, 1), [u0, v0]);
      return { p, q, r, a, b, c, d, u0, v0, W, X, Y, x, y, wx, wy, xu, xv, yu, yv, wu: wx * xu + wy * yu, wv: wx * xv + wy * yv };
    }, v => Math.abs(v.x) <= 5 && Math.abs(v.y) <= 5 && Math.abs(v.wu) <= 120 && Math.abs(v.wv) <= 120 && (v.wu !== 0 || v.wv !== 0));
    const dd = retry(() => ({ du: g.pick(deltas), dv: g.pick(deltas) }), v => Math.abs(s.wu * v.du + s.wv * v.dv) >= 0.05);
    const dwuv = round2(s.wu * dd.du + s.wv * dd.dv);
    const sAudit = { p: s.p, q: s.q, r: s.r, a: s.a, b: s.b, c: s.c, d: s.d, u0: s.u0, v0: s.v0 };
    const funcsText = `w = ${poly(s.W, XY)}, x = ${poly(s.X, UV)}, y = ${poly(s.Y, UV)}`;

    // three intermediates: w = xyz, x = p uv, y = u + q v, z = u − r v
    const tr = retry(() => {
      const p = g.pick([1, 2]), q = g.pick([1, 2, 3]), r = g.pick([1, 2, 3]), u0 = g.nonzero(-2, 2), v0 = g.nonzero(-2, 2), which = g.random(0, 1);
      const x = p * u0 * v0, y = u0 + q * v0, z = u0 - r * v0;
      const xu = p * v0, xv = p * u0, yu = 1, yv = q, zu = 1, zv = -r;
      const wx = y * z, wy = x * z, wz = x * y;
      const ans = which === 0 ? wx * xu + wy * yu + wz * zu : wx * xv + wy * yv + wz * zv;
      return { p, q, r, u0, v0, which, x, y, z, xu, xv, yu, yv, zu, zv, wx, wy, wz, ans };
    }, v => Math.abs(v.ans) <= 120 && v.ans !== 0);
    const trVar = tr.which === 0 ? 'u' : 'v';

    // how many terms
    const nInter = g.random(2, 3);
    const interNames = nInter === 2 ? 'x, y' : 'x, y, z';
    const lastName = nInter === 2 ? 'y' : 'z';

    // polar: w = a x³y + b x y³ at (r0, π/4)
    const po = retry(() => { const r0 = g.random(1, 3), lim = r0 === 3 ? 2 : 3; return { a: g.nonzero(-lim, lim), b: g.nonzero(-lim, lim), r0 }; }, v => v.a + v.b !== 0 && v.a !== v.b);
    const Wp: Mono[] = [[po.a, 3, 1], [po.b, 1, 3]];
    const polarForm = `${coef(po.a, 'cos³θ sin θ')} ${po.b < 0 ? '−' : '+'} ${Math.abs(po.b) === 1 ? '' : num(Math.abs(po.b))}cos θ sin³θ`;
    const dwr = (po.a + po.b) * po.r0 ** 3, dwth = po.r0 ** 4 * (po.b - po.a) / 2;

    // challenge: w = a x y + b y², x = u + c v, y = u v
    const ch = retry(() => {
      const a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), c = g.pick([-2, -1, 1, 2]), u0 = g.random(-2, 2), v0 = g.random(-2, 2);
      const x = u0 + c * v0, y = u0 * v0;
      const wx = a * y, wy = a * x + 2 * b * y;
      return { a, b, c, u0, v0, x, y, wx, wy, wu: wx * 1 + wy * v0, wv: wx * c + wy * u0 };
    }, v => Math.abs(v.wu) <= 100 && Math.abs(v.wv) <= 100 && (v.wu !== 0 || v.wv !== 0));
    const Wch: Mono[] = [[ch.a, 1, 1], [ch.b, 0, 2]];

    return [
      g.symbols({
        id: 'chain-formula', title: t('The chain rule for ∂w/∂u', '∂w/∂u 的链式法则'),
        prompt: t('w = f(x, y) where x = x(u, v) and y = y(u, v). The chain of computations is (u, v) → (x, y) → w. Fill the blanks to complete ∂w/∂u. Put the x-term first and the y-term last.', 'w = f(x, y)，其中 x = x(u, v)，y = y(u, v)。计算链是 (u, v) → (x, y) → w。填空补全 ∂w/∂u。x 项在前，y 项在最后。'),
        before: '∂w/∂u =', between: [' ', ' '], answers: ['w_x x_u', '+', 'w_y y_u'], tokens: ['w_x x_u', 'w_y y_u', '+', 'w_x x_v', 'w_y y_v', 'w_x y_u', 'w_y x_u', '·'],
        hint: t('For the derivative with respect to u, every intermediate variable is differentiated with respect to u only.', '对 u 求导时，每个中间变量都只对 u 求导。'),
        explanation: t('∂w/∂u = w_x x_u + w_y y_u. To get the rate of w when only u changes, add the effect through x (w_x times how x responds to u) and the effect through y. Using x_v or y_v would describe a change in v instead.',
          '∂w/∂u = w_x x_u + w_y y_u。要得到只有 u 变化时 w 的变化率，把经由 x 的影响（w_x 乘以 x 对 u 的反应）与经由 y 的影响相加。使用 x_v 或 y_v 描述的则是 v 的变化。'),
      }),
      g.number({
        id: 'intermediates', title: t('Values along the chain of computations', '计算链上的各个值'),
        prompt: t(`${funcsText}. At (u, v) = ${pt2(s.u0, s.v0)} find the intermediate values x and y, and then the partial derivatives w_x and w_y there (as a function of x and y, with the other one held fixed).`,
          `${funcsText}。在 (u, v) = ${pt2(s.u0, s.v0)} 处求中间变量的值 x 与 y，再求 w_x 与 w_y 在该处的值（把 w 看作 x、y 的函数，另一个变量保持不变）。`),
        fields: [{ label: t('x', 'x'), answer: s.x }, { label: t('y', 'y'), answer: s.y }, { label: t('w_x', 'w_x'), answer: s.wx }, { label: t('w_y', 'w_y'), answer: s.wy }],
        hint: t('Substitute u and v into x(u, v) and y(u, v) first. Then differentiate w = f(x, y) in x and in y and substitute these x and y.', '先把 u、v 代入 x(u, v) 与 y(u, v)。再对 w = f(x, y) 分别对 x 与 y 求导，并代入这里的 x、y。'),
        explanation: t(`x = ${subst(s.X, [s.u0, s.v0])} = ${num(s.x)} and y = ${subst(s.Y, [s.u0, s.v0])} = ${num(s.y)}. w_x = ${poly(D(s.W, 0), XY)} = ${subst(D(s.W, 0), [s.x, s.y])} = ${num(s.wx)}, w_y = ${poly(D(s.W, 1), XY)} = ${subst(D(s.W, 1), [s.x, s.y])} = ${num(s.wy)}.`,
          `x = ${subst(s.X, [s.u0, s.v0])} = ${num(s.x)}，y = ${subst(s.Y, [s.u0, s.v0])} = ${num(s.y)}。w_x = ${poly(D(s.W, 0), XY)} = ${subst(D(s.W, 0), [s.x, s.y])} = ${num(s.wx)}，w_y = ${poly(D(s.W, 1), XY)} = ${subst(D(s.W, 1), [s.x, s.y])} = ${num(s.wy)}。`),
        audit: { kind: 'MIT-MV-24:intermediates', params: sAudit },
      }),
      g.number({
        id: 'partials-uv', title: t('∂w/∂u and ∂w/∂v at a point', '一点处的 ∂w/∂u 与 ∂w/∂v'),
        prompt: t(`${funcsText}. Use the chain rule to find ∂w/∂u and ∂w/∂v at (u, v) = ${pt2(s.u0, s.v0)}. You do not need to write w as a function of u and v.`,
          `${funcsText}。用链式法则求 (u, v) = ${pt2(s.u0, s.v0)} 处的 ∂w/∂u 与 ∂w/∂v。不必把 w 写成 u、v 的函数。`),
        fields: [{ label: t('∂w/∂u', '∂w/∂u'), answer: s.wu }, { label: t('∂w/∂v', '∂w/∂v'), answer: s.wv }],
        hint: t('Use the values of x, y, w_x, w_y at this point, and differentiate x(u, v) and y(u, v) in u and in v.', '用该点处 x、y、w_x、w_y 的值，并把 x(u, v)、y(u, v) 分别对 u 与 v 求导。'),
        explanation: t(`x_u = ${dval(D(s.X, 0), [s.u0, s.v0])}, x_v = ${dval(D(s.X, 1), [s.u0, s.v0])}, y_u = ${dval(D(s.Y, 0), [s.u0, s.v0])}, y_v = ${dval(D(s.Y, 1), [s.u0, s.v0])}; also w_x = ${num(s.wx)} and w_y = ${num(s.wy)} at this point. So ∂w/∂u = w_x x_u + w_y y_u = ${par(s.wx)}·${par(s.xu)} + ${par(s.wy)}·${par(s.yu)} = ${num(s.wu)} and ∂w/∂v = w_x x_v + w_y y_v = ${par(s.wx)}·${par(s.xv)} + ${par(s.wy)}·${par(s.yv)} = ${num(s.wv)}.`,
          `x_u = ${dval(D(s.X, 0), [s.u0, s.v0])}，x_v = ${dval(D(s.X, 1), [s.u0, s.v0])}，y_u = ${dval(D(s.Y, 0), [s.u0, s.v0])}，y_v = ${dval(D(s.Y, 1), [s.u0, s.v0])}；此外该点处 w_x = ${num(s.wx)}，w_y = ${num(s.wy)}。所以 ∂w/∂u = w_x x_u + w_y y_u = ${par(s.wx)}·${par(s.xu)} + ${par(s.wy)}·${par(s.yu)} = ${num(s.wu)}，∂w/∂v = w_x x_v + w_y y_v = ${par(s.wx)}·${par(s.xv)} + ${par(s.wy)}·${par(s.yv)} = ${num(s.wv)}。`),
        audit: { kind: 'MIT-MV-24:partials-uv', params: sAudit },
      }),
      g.number({
        id: 'differential-uv', title: t('The total differential in du and dv', '用 du、dv 表示的全微分'),
        prompt: t(`${funcsText}. In terms of du and dv the total differential is dw = (∂w/∂u) du + (∂w/∂v) dv. Find dw at (u, v) = ${pt2(s.u0, s.v0)} when du = ${num(dd.du)} and dv = ${num(dd.dv)}. Enter dw as a decimal.`,
          `${funcsText}。用 du、dv 表示，全微分为 dw = (∂w/∂u) du + (∂w/∂v) dv。当 du = ${num(dd.du)}，dv = ${num(dd.dv)} 时，求 (u, v) = ${pt2(s.u0, s.v0)} 处的 dw。请用小数输入 dw。`),
        fields: [{ label: t('dw', 'dw'), answer: dwuv, tolerance: 0.005 }],
        hint: t('The coefficients of du and dv are the partial derivatives ∂w/∂u and ∂w/∂v at the point, found with the chain rule.', 'du 与 dv 的系数就是该点的偏导数 ∂w/∂u 与 ∂w/∂v，用链式法则求得。'),
        explanation: t(`∂w/∂u = ${num(s.wu)} and ∂w/∂v = ${num(s.wv)} at this point. So dw = ${par(s.wu)}·${par(dd.du)} + ${par(s.wv)}·${par(dd.dv)} = ${par(round2(s.wu * dd.du))} + ${par(round2(s.wv * dd.dv))} = ${num(dwuv)}. The same number comes from dw = w_x dx + w_y dy with dx = x_u du + x_v dv and dy = y_u du + y_v dv.`,
          `该点处 ∂w/∂u = ${num(s.wu)}，∂w/∂v = ${num(s.wv)}。所以 dw = ${par(s.wu)}·${par(dd.du)} + ${par(s.wv)}·${par(dd.dv)} = ${par(round2(s.wu * dd.du))} + ${par(round2(s.wv * dd.dv))} = ${num(dwuv)}。由 dw = w_x dx + w_y dy，并取 dx = x_u du + x_v dv，dy = y_u du + y_v dv，也得到同样的数。`),
        audit: { kind: 'MIT-MV-24:differential-uv', params: { ...sAudit, du: dd.du, dv: dd.dv } },
      }),
      g.number({
        id: 'three-intermediates', title: t('Three intermediate variables', '三个中间变量'),
        prompt: t(`w = xyz with x = ${coef(tr.p, 'uv')}, y = u + ${coef(tr.q, 'v')}, z = u − ${coef(tr.r, 'v')}. Use the chain rule to find ∂w/∂${trVar} at (u, v) = ${pt2(tr.u0, tr.v0)}.`,
          `w = xyz，x = ${coef(tr.p, 'uv')}，y = u + ${coef(tr.q, 'v')}，z = u − ${coef(tr.r, 'v')}。用链式法则求 (u, v) = ${pt2(tr.u0, tr.v0)} 处的 ∂w/∂${trVar}。`),
        fields: [{ label: t(`∂w/∂${trVar}`, `∂w/∂${trVar}`), answer: tr.ans }],
        hint: t(`There are three terms, one for each of x, y, z. Compute x, y, z at the point, then w_x = yz, w_y = xz, w_z = xy and the three derivatives with respect to ${trVar}.`, `共有三项，x、y、z 各一项。先求该点的 x、y、z，再求 w_x = yz，w_y = xz，w_z = xy，以及三者对 ${trVar} 的导数。`),
        explanation: t(`At (u, v) = ${pt2(tr.u0, tr.v0)}: (x, y, z) = ${vec(tr.x, tr.y, tr.z)}, so w_x = yz = ${num(tr.wx)}, w_y = xz = ${num(tr.wy)}, w_z = xy = ${num(tr.wz)}. With respect to ${trVar}: x_${trVar} = ${num(tr.which === 0 ? tr.xu : tr.xv)}, y_${trVar} = ${num(tr.which === 0 ? tr.yu : tr.yv)}, z_${trVar} = ${num(tr.which === 0 ? tr.zu : tr.zv)}. So ∂w/∂${trVar} = ${par(tr.wx)}·${par(tr.which === 0 ? tr.xu : tr.xv)} + ${par(tr.wy)}·${par(tr.which === 0 ? tr.yu : tr.yv)} + ${par(tr.wz)}·${par(tr.which === 0 ? tr.zu : tr.zv)} = ${num(tr.ans)}.`,
          `在 (u, v) = ${pt2(tr.u0, tr.v0)} 处：(x, y, z) = ${vec(tr.x, tr.y, tr.z)}，所以 w_x = yz = ${num(tr.wx)}，w_y = xz = ${num(tr.wy)}，w_z = xy = ${num(tr.wz)}。对 ${trVar} 求导：x_${trVar} = ${num(tr.which === 0 ? tr.xu : tr.xv)}，y_${trVar} = ${num(tr.which === 0 ? tr.yu : tr.yv)}，z_${trVar} = ${num(tr.which === 0 ? tr.zu : tr.zv)}。所以 ∂w/∂${trVar} = ${par(tr.wx)}·${par(tr.which === 0 ? tr.xu : tr.xv)} + ${par(tr.wy)}·${par(tr.which === 0 ? tr.yu : tr.yv)} + ${par(tr.wz)}·${par(tr.which === 0 ? tr.zu : tr.zv)} = ${num(tr.ans)}。`),
        audit: { kind: 'MIT-MV-24:three-intermediates', params: { p: tr.p, q: tr.q, r: tr.r, u0: tr.u0, v0: tr.v0, which: tr.which } },
      }),
      g.choice({
        id: 'count-terms', title: t('How many terms?', '共有几项？'),
        prompt: t(`w = f(${interNames}) and each of ${interNames} is a function of the two independent variables u and v. When ∂w/∂u is written with the chain rule, what does the sum look like?`,
          `w = f(${interNames})，且 ${interNames} 中每一个都是两个自变量 u 与 v 的函数。用链式法则写出 ∂w/∂u 时，这个和是什么样的？`),
        options: [
          t(`${nInter} terms, one for each of ${interNames}: the partial derivative of w with respect to that variable times the variable's derivative with respect to u.`, `${nInter} 项，${interNames} 各一项：w 对该变量的偏导数乘以该变量对 u 的导数。`),
          t(`${nInter} terms, one for each of ${interNames}: the partial derivative of w with respect to that variable times the variable's derivative with respect to v.`, `${nInter} 项，${interNames} 各一项：w 对该变量的偏导数乘以该变量对 v 的导数。`),
          t(`${2 * nInter} terms: for each of ${interNames}, one product containing the derivative with respect to u and another product containing the derivative with respect to v.`, `${2 * nInter} 项：对 ${interNames} 中的每个变量，各有一项含对 u 的导数、一项含对 v 的导数。`),
        ], correct: 0,
        hint: t('The sum has one term for each intermediate variable. Which independent variable is changing in ∂w/∂u?', '每个中间变量对应一项。在 ∂w/∂u 中，哪个自变量在变化？'),
        explanation: t(`∂w/∂u = w_x x_u + w_y y_u${nInter === 3 ? ' + w_z z_u' : ''}: one term per intermediate variable, and since only u changes, each factor is a derivative with respect to u. Using derivatives in v describes ∂w/∂v, and the ${2 * nInter}-term version would count the effect of v even though v is held fixed.`,
          `∂w/∂u = w_x x_u + w_y y_u${nInter === 3 ? ' + w_z z_u' : ''}：每个中间变量一项；由于只有 u 变化，每个因子都是对 u 的导数。使用对 v 的导数描述的是 ∂w/∂v，而 ${2 * nInter} 项的写法把 v 的影响也算了进去，尽管 v 是固定的。`),
      }),
      g.choice({
        id: 'roles', title: t('Dependent, intermediate, independent', '因变量、中间变量与自变量'),
        prompt: t('w = f(x, y), x = x(u, v), y = y(u, v). Which description of the variables is correct?', 'w = f(x, y)，x = x(u, v)，y = y(u, v)。下面哪种对变量的描述是正确的？'),
        options: [
          t('w is the dependent variable, x and y are intermediate variables, and u and v are the independent variables.', 'w 是因变量，x 与 y 是中间变量，u 与 v 是自变量。'),
          t('w, x and y are all dependent variables, and u and v are the intermediate variables between x, y and w.', 'w、x、y 都是因变量，u 与 v 是介于 x、y 与 w 之间的中间变量。'),
          t('x and y are the independent variables, because w is defined directly in terms of them, and u and v are only labels for how x and y are computed.', 'x 与 y 是自变量，因为 w 是直接用它们定义的，而 u 与 v 只是 x、y 的计算过程中的记号。'),
        ], correct: 0,
        hint: t('Follow the chain (u, v) → (x, y) → w and decide which variables can be chosen freely.', '沿着计算链 (u, v) → (x, y) → w，判断哪些变量可以自由选取。'),
        explanation: t('The chain of computations is (u, v) → (x, y) → w. You can choose u and v freely, so they are the independent variables; x and y are computed from them (intermediate variables), and w is computed last (the dependent variable). Which variables are independent is often decided by the context, and different choices change what ∂w/∂x means.',
          '计算链是 (u, v) → (x, y) → w。u 与 v 可以自由选取，所以它们是自变量；x 与 y 由它们算出（中间变量），w 最后算出（因变量）。哪些变量是自变量常常由上下文决定，不同的选择会改变 ∂w/∂x 的含义。'),
      }),
      g.number({
        id: 'polar', title: t('The chain rule in polar coordinates', '极坐标下的链式法则'),
        prompt: t(`w = ${poly(Wp, XY)} with x = r cos θ and y = r sin θ. Use the chain rule ∂w/∂r = w_x cos θ + w_y sin θ and ∂w/∂θ = −w_x r sin θ + w_y r cos θ to find both derivatives at (r, θ) = (${po.r0}, π/4). Here cos(π/4) = sin(π/4) = √2/2, and both answers are rational numbers.`,
          `w = ${poly(Wp, XY)}，x = r cos θ，y = r sin θ。用链式法则 ∂w/∂r = w_x cos θ + w_y sin θ 与 ∂w/∂θ = −w_x r sin θ + w_y r cos θ，求 (r, θ) = (${po.r0}, π/4) 处的两个导数。这里 cos(π/4) = sin(π/4) = √2/2，两个答案都是有理数。`),
        fields: [{ label: t('∂w/∂r', '∂w/∂r'), answer: dwr }, { label: t('∂w/∂θ', '∂w/∂θ'), answer: dwth }],
        hint: t('At θ = π/4 we have x = y. Write w_x and w_y in terms of x, substitute x = r√2/2, and keep track of the factors √2.', '当 θ = π/4 时有 x = y。把 w_x、w_y 用 x 表示，代入 x = r√2/2，并留意 √2 因子。'),
        explanation: t(`With x = y = s: w_x = ${poly(D(Wp, 0), XY)} = ${coef(3 * po.a + po.b, 's³')} and w_y = ${poly(D(Wp, 1), XY)} = ${coef(po.a + 3 * po.b, 's³')}, where s = ${po.r0}·√2/2 and s³ = ${po.r0 ** 3}·√2/4. Then ∂w/∂r = (√2/2)(w_x + w_y) = (√2/2)·${par(4 * (po.a + po.b))}·${po.r0 ** 3}·√2/4 = ${num(dwr)}, and ∂w/∂θ = ${po.r0}·(√2/2)(w_y − w_x) = ${po.r0}·(√2/2)·${par(2 * (po.b - po.a))}·${po.r0 ** 3}·√2/4 = ${num(dwth)}. Check by substitution: w = r⁴(${polarForm}), and at θ = π/4 both cos³θ sin θ and cos θ sin³θ equal 1/4.`,
          `取 x = y = s：w_x = ${poly(D(Wp, 0), XY)} = ${coef(3 * po.a + po.b, 's³')}，w_y = ${poly(D(Wp, 1), XY)} = ${coef(po.a + 3 * po.b, 's³')}，其中 s = ${po.r0}·√2/2，s³ = ${po.r0 ** 3}·√2/4。于是 ∂w/∂r = (√2/2)(w_x + w_y) = (√2/2)·${par(4 * (po.a + po.b))}·${po.r0 ** 3}·√2/4 = ${num(dwr)}，∂w/∂θ = ${po.r0}·(√2/2)(w_y − w_x) = ${po.r0}·(√2/2)·${par(2 * (po.b - po.a))}·${po.r0 ** 3}·√2/4 = ${num(dwth)}。用代入法检验：w = r⁴(${polarForm})，当 θ = π/4 时 cos³θ sin θ 与 cos θ sin³θ 都等于 1/4。`),
        audit: { kind: 'MIT-MV-24:polar', params: { a: po.a, b: po.b, r0: po.r0 } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`w = ${poly(Wch, XY)} with x = ${linear([1, ch.c], UV)} and y = uv. Find ∂w/∂u and ∂w/∂v at (u, v) = ${pt2(ch.u0, ch.v0)}.`,
          `w = ${poly(Wch, XY)}，x = ${linear([1, ch.c], UV)}，y = uv。求 (u, v) = ${pt2(ch.u0, ch.v0)} 处的 ∂w/∂u 与 ∂w/∂v。`),
        fields: [{ label: t('∂w/∂u', '∂w/∂u'), answer: ch.wu }, { label: t('∂w/∂v', '∂w/∂v'), answer: ch.wv }],
        hint: t('Find x and y at the point, then w_x and w_y there, then x_u, x_v, y_u, y_v. Combine with ∂w/∂u = w_x x_u + w_y y_u and ∂w/∂v = w_x x_v + w_y y_v.', '先求该点的 x、y，再求该处的 w_x、w_y，然后求 x_u、x_v、y_u、y_v。用 ∂w/∂u = w_x x_u + w_y y_u 与 ∂w/∂v = w_x x_v + w_y y_v 组合。'),
        explanation: t(`At the point x = ${num(ch.x)} and y = ${num(ch.y)}. w_x = ${poly(D(Wch, 0), XY)} = ${num(ch.wx)} and w_y = ${poly(D(Wch, 1), XY)} = ${num(ch.wy)}. Also x_u = 1, x_v = ${num(ch.c)}, y_u = v = ${num(ch.v0)}, y_v = u = ${num(ch.u0)}. So ∂w/∂u = ${par(ch.wx)}·1 + ${par(ch.wy)}·${par(ch.v0)} = ${num(ch.wu)} and ∂w/∂v = ${par(ch.wx)}·${par(ch.c)} + ${par(ch.wy)}·${par(ch.u0)} = ${num(ch.wv)}. You practised the chain rule with two independent variables for polynomials; the proof and functions without continuous partials are not assessed.`,
          `在该点 x = ${num(ch.x)}，y = ${num(ch.y)}。w_x = ${poly(D(Wch, 0), XY)} = ${num(ch.wx)}，w_y = ${poly(D(Wch, 1), XY)} = ${num(ch.wy)}。又 x_u = 1，x_v = ${num(ch.c)}，y_u = v = ${num(ch.v0)}，y_v = u = ${num(ch.u0)}。所以 ∂w/∂u = ${par(ch.wx)}·1 + ${par(ch.wy)}·${par(ch.v0)} = ${num(ch.wu)}，∂w/∂v = ${par(ch.wx)}·${par(ch.c)} + ${par(ch.wy)}·${par(ch.u0)} = ${num(ch.wv)}。你练习了多项式在两个自变量下的链式法则；证明以及偏导数不连续的函数不在这里考查。`),
        audit: { kind: 'MIT-MV-24:challenge', params: { a: ch.a, b: ch.b, c: ch.c, u0: ch.u0, v0: ch.v0 } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-25': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-25');
    warm(g);

    // 1. gradient of a quadratic
    const q1 = { a: g.nonzero(-3, 3), b: g.random(-3, 3), c: g.nonzero(-3, 3), d: g.random(-3, 3), e: g.random(-3, 3), x0: g.random(-3, 3), y0: g.random(-3, 3) };
    const F1 = quad2(q1.a, q1.b, q1.c, q1.d, q1.e);
    const g1 = [ev(D(F1, 0), [q1.x0, q1.y0]), ev(D(F1, 1), [q1.x0, q1.y0])];

    // 2. perpendicular vector with a level-curve picture
    const pp = retry(() => {
      const a = g.random(1, 3), c = g.random(1, 3), b = g.random(-2, 2), x0 = g.nonzero(-2, 2), y0 = g.nonzero(-2, 2);
      const gx = 2 * a * x0 + b * y0, gy = b * x0 + 2 * c * y0;
      return { a, b, c, x0, y0, gx, gy, level: a * x0 * x0 + b * x0 * y0 + c * y0 * y0 };
    }, v => 4 * v.a * v.c > v.b * v.b && v.gx !== 0 && v.gy !== 0 && Math.abs(v.gx) !== Math.abs(v.gy));
    const Fp: Mono[] = [[pp.a, 2, 0], [pp.b, 1, 1], [pp.c, 0, 2]];
    const viewP = { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };
    const fp = (x: number, y: number) => pp.a * x * x + pp.b * x * y + pp.c * y * y;
    const shapesP: FigureShape[] = [
      ...[0.25, 1.5].flatMap(m => contourLines(fp, viewP, m * pp.level, 80, 'muted')),
      ...contourLines(fp, viewP, pp.level, 80, 'accent'),
      { kind: 'point', at: [pp.x0, pp.y0] as Pt, tone: 'warn', label: 'P' },
    ];

    // 3. slopes
    const sl = retry(() => {
      const a = g.nonzero(-3, 3), b = g.random(-3, 3), c = g.nonzero(-3, 3), d = g.random(-3, 3), e = g.random(-3, 3), x0 = g.random(-3, 3), y0 = g.random(-3, 3);
      const F = quad2(a, b, c, d, e);
      return { a, b, c, d, e, x0, y0, F, fx: ev(D(F, 0), [x0, y0]), fy: ev(D(F, 1), [x0, y0]) };
    }, v => v.fx !== 0 && v.fy !== 0 && Math.abs(v.fx) <= 12 && Math.abs(v.fy) <= 12 && Math.abs(v.fx) !== Math.abs(v.fy));

    // 4. graph as a level curve
    const gr = { a: g.nonzero(-2, 2), b: g.random(-3, 3), c: g.random(-3, 3), x0: g.nonzero(-2, 2) };
    const Gg: Mono[] = [[gr.a, 2], [gr.b, 1], [gr.c, 0]];
    const gy0 = ev(Gg, [gr.x0]), gslope = ev(D(Gg, 0), [gr.x0]);

    // 5. gradient in three variables
    const t3 = { a: g.nonzero(-2, 2), b: g.nonzero(-2, 2), c: g.nonzero(-2, 2), d: g.random(-3, 3), P: [g.nonzero(-2, 2), g.nonzero(-2, 2), g.nonzero(-2, 2)] };
    const F3: Mono[] = [[t3.a, 1, 1, 0], [t3.b, 0, 1, 1], [t3.c, 0, 0, 2], [t3.d, 1, 0, 0]];
    const g3 = [0, 1, 2].map(k => ev(D(F3, k), t3.P));

    // 6. which point lies on the surface
    const os = (() => {
      const a = g.random(1, 3), b = g.random(1, 3), P = [g.nonzero(-3, 3), g.nonzero(-3, 3), g.nonzero(-3, 3)];
      const c = P[0] ** 2 + a * P[1] ** 2 + b * P[2] ** 2;
      const axes = [0, 1, 2]; const i = g.random(0, 2); axes.splice(i, 1);
      const bump = (k: number) => P.map((v, j) => (j === k ? v + 1 : v));
      return { a, b, c, P, others: axes.map(bump) };
    })();
    const wsurf = (p: number[]) => p[0] ** 2 + os.a * p[1] ** 2 + os.b * p[2] ** 2;

    // 7. tangent plane of x² + a y² + b z = c
    const tp = (() => {
      const a = g.random(1, 3), b = g.nonzero(-3, 3), P = [g.nonzero(-2, 2), g.nonzero(-2, 2), g.random(-3, 3)];
      const n = [2 * P[0], 2 * a * P[1], b];
      return { a, b, P, n, c: P[0] ** 2 + a * P[1] ** 2 + b * P[2], D: n[0] * P[0] + n[1] * P[1] + n[2] * P[2] };
    })();
    const Wt: Mono[] = [[1, 2, 0, 0], [tp.a, 0, 2, 0], [tp.b, 0, 0, 1]];

    // 8. critical point
    const cr = (() => {
      const a = g.nonzero(-3, 3), b = g.nonzero(-3, 3), xs = g.random(-3, 3), ys = g.random(-3, 3);
      return { a, b, xs, ys, c: -2 * a * xs, d: -2 * b * ys };
    })();
    const Fcr: Mono[] = [[cr.a, 2, 0], [cr.b, 0, 2], [cr.c, 1, 0], [cr.d, 0, 1]];
    const crOthers = [[cr.xs, cr.ys + 1], [cr.xs + 1, cr.ys], [cr.xs + 1, cr.ys + 1]];
    const crPick = [...crOthers]; crPick.splice(g.random(0, 2), 1);

    // 9. challenge
    const ch = retry(() => ({ a: g.nonzero(-2, 2), b: g.nonzero(-2, 2), c: g.nonzero(-2, 2), x0: g.nonzero(-2, 2), y0: g.nonzero(-2, 2) }), v => {
      const F: Mono[] = [[v.a, 2, 0], [v.b, 1, 1], [v.c, 0, 3]];
      return !(ev(D(F, 0), [v.x0, v.y0]) === 0 || ev(D(F, 1), [v.x0, v.y0]) === 0);
    });
    const Fch: Mono[] = [[ch.a, 2, 0], [ch.b, 1, 1], [ch.c, 0, 3]];
    const chx = ev(D(Fch, 0), [ch.x0, ch.y0]), chy = ev(D(Fch, 1), [ch.x0, ch.y0]), chk = chx * ch.x0 + chy * ch.y0;

    const perpOptions = [vec(pp.gx, pp.gy), vec(pp.gy, pp.gx), vec(-pp.gy, pp.gx), vec(pp.gx, -pp.gy)];

    return [
      g.number({
        id: 'gradient', title: t('Compute the gradient', '计算梯度'),
        prompt: t(`f(x, y) = ${poly(F1, XY)}. The gradient is ∇f = (f_x, f_y), a vector in the plane. Find ∇f at the point (x, y) = ${pt2(q1.x0, q1.y0)}.`,
          `f(x, y) = ${poly(F1, XY)}。梯度是 ∇f = (f_x, f_y)，是平面内的一个向量。求 ∇f 在点 (x, y) = ${pt2(q1.x0, q1.y0)} 处的值。`),
        fields: [{ label: t('f_x', 'f_x'), answer: g1[0] }, { label: t('f_y', 'f_y'), answer: g1[1] }],
        hint: t('The gradient puts the two partial derivatives side by side as the components of one vector.', '梯度把两个偏导数并排放在一起，作为一个向量的两个分量。'),
        explanation: t(`f_x = ${poly(D(F1, 0), XY)} = ${subst(D(F1, 0), [q1.x0, q1.y0])} = ${num(g1[0])} and f_y = ${poly(D(F1, 1), XY)} = ${subst(D(F1, 1), [q1.x0, q1.y0])} = ${num(g1[1])}. So ∇f${pt2(q1.x0, q1.y0)} = ${vec(g1[0], g1[1])}: a scalar function f gives a vector ∇f.`,
          `f_x = ${poly(D(F1, 0), XY)} = ${subst(D(F1, 0), [q1.x0, q1.y0])} = ${num(g1[0])}，f_y = ${poly(D(F1, 1), XY)} = ${subst(D(F1, 1), [q1.x0, q1.y0])} = ${num(g1[1])}。所以 ∇f${pt2(q1.x0, q1.y0)} = ${vec(g1[0], g1[1])}：标量函数 f 给出向量 ∇f。`),
        audit: { kind: 'MIT-MV-25:gradient', params: { a: q1.a, b: q1.b, c: q1.c, d: q1.d, e: q1.e, x0: q1.x0, y0: q1.y0 } },
      }),
      g.choice({
        id: 'perpendicular', title: t('Which vector is perpendicular to the level curve?', '哪个向量垂直于等高线？'),
        prompt: t(`f(x, y) = ${poly(Fp, XY)}. The picture shows some level curves of f; the highlighted one passes through P = ${pt2(pp.x0, pp.y0)}. Which vector is perpendicular to the level curve of f through P?`,
          `f(x, y) = ${poly(Fp, XY)}。图中是 f 的几条等高线，加粗的那条经过 P = ${pt2(pp.x0, pp.y0)}。哪个向量垂直于 f 过 P 的等高线？`),
        figure: g.figure({
          alt: t(`Nested closed level curves of f around the origin, with P = ${pt2(pp.x0, pp.y0)} marked on the highlighted middle curve.`, `f 的围绕原点的嵌套闭合等高线，P = ${pt2(pp.x0, pp.y0)} 标在加粗的中间那条曲线上。`),
          view: viewP, axes: { grid: true }, shapes: shapesP,
          caption: t(`Level curves f = ${num(pp.level / 4)}, ${num(pp.level)}, ${num(pp.level * 1.5)}`, `等高线 f = ${num(pp.level / 4)}，${num(pp.level)}，${num(pp.level * 1.5)}`),
        }),
        options: perpOptions.map(v => t(v, v)), correct: 0,
        hint: t('The gradient of f at P is perpendicular to the level curve through P. Compute f_x and f_y at P.', 'f 在 P 处的梯度垂直于过 P 的等高线。计算 P 处的 f_x 与 f_y。'),
        explanation: t(`f_x = ${poly(D(Fp, 0), XY)} = ${num(pp.gx)} and f_y = ${poly(D(Fp, 1), XY)} = ${num(pp.gy)} at P, so ∇f = ${vec(pp.gx, pp.gy)}, which is perpendicular to the level curve. The vector ${vec(-pp.gy, pp.gx)} is the tangent direction (it has dot product 0 with ∇f), and the other two options come from swapping the components or flipping one sign.`,
          `在 P 处 f_x = ${poly(D(Fp, 0), XY)} = ${num(pp.gx)}，f_y = ${poly(D(Fp, 1), XY)} = ${num(pp.gy)}，所以 ∇f = ${vec(pp.gx, pp.gy)}，它垂直于等高线。向量 ${vec(-pp.gy, pp.gx)} 是切线方向（它与 ∇f 的点积为 0），另两个选项是把分量对调或改变了一个符号得到的。`),
        audit: { kind: 'MIT-MV-25:perpendicular-vector', params: { a: pp.a, b: pp.b, c: pp.c, x0: pp.x0, y0: pp.y0 } },
      }),
      g.number({
        id: 'slopes', title: t('Slope of the level curve and slope of the gradient', '等高线的斜率与梯度的斜率'),
        prompt: t(`f(x, y) = ${poly(sl.F, XY)} and P = ${pt2(sl.x0, sl.y0)}. Near P the level curve of f through P can be written y = y(x), so f(x, y(x)) is constant. Differentiating with the chain rule gives f_x + f_y·dy/dx = 0. Find the slope dy/dx of the level curve at P, and the slope of the vector ∇f(P) = (f_x, f_y) (the slope of a vector (p, q) is q/p). Enter fractions exactly, such as −2/3.`,
          `f(x, y) = ${poly(sl.F, XY)}，P = ${pt2(sl.x0, sl.y0)}。在 P 附近，f 过 P 的等高线可写成 y = y(x)，所以 f(x, y(x)) 是常数。用链式法则求导得 f_x + f_y·dy/dx = 0。求等高线在 P 处的斜率 dy/dx，以及向量 ∇f(P) = (f_x, f_y) 的斜率（向量 (p, q) 的斜率是 q/p）。请输入精确分数，如 −2/3。`),
        fields: [{ label: t('slope of the level curve', '等高线的斜率'), answer: -sl.fx / sl.fy }, { label: t('slope of ∇f(P)', '∇f(P) 的斜率'), answer: sl.fy / sl.fx }],
        hint: t('Find f_x and f_y at P. Then dy/dx = −f_x/f_y, and the slope of the vector (f_x, f_y) is f_y/f_x.', '求 P 处的 f_x 与 f_y。则 dy/dx = −f_x/f_y，而向量 (f_x, f_y) 的斜率是 f_y/f_x。'),
        explanation: t(`f_x(P) = ${num(sl.fx)} and f_y(P) = ${num(sl.fy)}. The level curve has slope dy/dx = −f_x/f_y = ${frac(-sl.fx, sl.fy)}, and the gradient ${vec(sl.fx, sl.fy)} has slope f_y/f_x = ${frac(sl.fy, sl.fx)}. The product of the two slopes is −1, so they are negative reciprocals: the gradient is perpendicular to the level curve.`,
          `f_x(P) = ${num(sl.fx)}，f_y(P) = ${num(sl.fy)}。等高线的斜率 dy/dx = −f_x/f_y = ${frac(-sl.fx, sl.fy)}，梯度 ${vec(sl.fx, sl.fy)} 的斜率为 f_y/f_x = ${frac(sl.fy, sl.fx)}。两个斜率的乘积为 −1，互为负倒数：梯度垂直于等高线。`),
        audit: { kind: 'MIT-MV-25:slopes', params: { a: sl.a, b: sl.b, c: sl.c, d: sl.d, e: sl.e, x0: sl.x0, y0: sl.y0 } },
      }),
      g.number({
        id: 'graph-normal', title: t('A graph as a level curve', '把图像看作等高线'),
        prompt: t(`The parabola y = ${poly(Gg, ['x'])} is the level curve w = 0 of w(x, y) = y − (${poly(Gg, ['x'])}). At the point P = ${pt2(gr.x0, gy0)} of the parabola, ∇w = (m, 1). Find m, so that (m, 1) is perpendicular to the tangent of the parabola at P.`,
          `抛物线 y = ${poly(Gg, ['x'])} 是 w(x, y) = y − (${poly(Gg, ['x'])}) 的等高线 w = 0。在抛物线上的点 P = ${pt2(gr.x0, gy0)} 处，∇w = (m, 1)。求 m，使 (m, 1) 垂直于抛物线在 P 处的切线。`),
        fields: [{ label: t('m', 'm') , answer: -gslope }],
        hint: t('w_x is minus the derivative of the polynomial. Evaluate it at x = the x-coordinate of P.', 'w_x 是该多项式导数的相反数。在 P 的横坐标处求值。'),
        explanation: t(`The derivative of ${poly(Gg, ['x'])} is g′(x) = ${poly(D(Gg, 0), ['x'])}, so g′(${num(gr.x0)}) = ${num(gslope)}. Since w = y − g(x), w_x = −g′(x) and w_y = 1, so m = −g′(${num(gr.x0)}) = ${num(-gslope)}. Check: the tangent vector is (1, ${num(gslope)}), and the dot product is ${par(-gslope)}·1 + 1·${par(gslope)} = 0.`,
          `${poly(Gg, ['x'])} 的导数为 g′(x) = ${poly(D(Gg, 0), ['x'])}，所以 g′(${num(gr.x0)}) = ${num(gslope)}。因为 w = y − g(x)，所以 w_x = −g′(x)，w_y = 1，于是 m = −g′(${num(gr.x0)}) = ${num(-gslope)}。检验：切向量为 (1, ${num(gslope)})，点积为 ${par(-gslope)}·1 + 1·${par(gslope)} = 0。`),
        audit: { kind: 'MIT-MV-25:graph-normal', params: { a: gr.a, b: gr.b, c: gr.c, x0: gr.x0 } },
      }),
      g.number({
        id: 'gradient-3d', title: t('The gradient in three variables', '三个变量的梯度'),
        prompt: t(`For f(x, y, z) = ${poly(F3, XYZ)} the gradient ∇f = (f_x, f_y, f_z) is a vector in space. Find ∇f at P = ${vec(...t3.P)}.`,
          `对 f(x, y, z) = ${poly(F3, XYZ)}，梯度 ∇f = (f_x, f_y, f_z) 是空间中的向量。求 ∇f 在 P = ${vec(...t3.P)} 处的值。`),
        fields: [{ label: t('f_x', 'f_x'), answer: g3[0] }, { label: t('f_y', 'f_y'), answer: g3[1] }, { label: t('f_z', 'f_z'), answer: g3[2] }],
        hint: t('Differentiate in one variable at a time, treating the other two as constants. Substitute P at the end.', '每次只对一个变量求导，把另外两个当作常数。最后代入 P。'),
        explanation: t(`f_x = ${poly(D(F3, 0), XYZ)} = ${num(g3[0])}, f_y = ${poly(D(F3, 1), XYZ)} = ${num(g3[1])}, f_z = ${poly(D(F3, 2), XYZ)} = ${num(g3[2])} at P. So ∇f(P) = ${vec(...g3)}: a scalar function of three variables gives a three-dimensional vector.`,
          `在 P 处 f_x = ${poly(D(F3, 0), XYZ)} = ${num(g3[0])}，f_y = ${poly(D(F3, 1), XYZ)} = ${num(g3[1])}，f_z = ${poly(D(F3, 2), XYZ)} = ${num(g3[2])}。所以 ∇f(P) = ${vec(...g3)}：三个变量的标量函数给出三维向量。`),
        audit: { kind: 'MIT-MV-25:gradient-3d', params: { a: t3.a, b: t3.b, c: t3.c, d: t3.d, x0: t3.P[0], y0: t3.P[1], z0: t3.P[2] } },
      }),
      g.choice({
        id: 'on-surface', title: t('Is the point on the surface?', '这个点在曲面上吗？'),
        prompt: t(`The surface x² + ${poly([[os.a, 0, 2, 0], [os.b, 0, 0, 2]], XYZ)} = ${os.c} is the level surface w = ${os.c} of w = ${poly([[1, 2, 0, 0], [os.a, 0, 2, 0], [os.b, 0, 0, 2]], XYZ)}. The gradient ∇w at a point of the surface is normal to it. Which of these points lies on the surface?`,
          `曲面 x² + ${poly([[os.a, 0, 2, 0], [os.b, 0, 0, 2]], XYZ)} = ${os.c} 是 w = ${poly([[1, 2, 0, 0], [os.a, 0, 2, 0], [os.b, 0, 0, 2]], XYZ)} 的等值面 w = ${os.c}。曲面上一点处的梯度 ∇w 是该点的法向量。下列哪个点在曲面上？`),
        options: [os.P, ...os.others].map(p => t(vec(...p), vec(...p))), correct: 0,
        hint: t('Substitute each point into w and compare the value with the level of the surface. The normal vector ∇w only describes the surface at points that are on it.', '把各点代入 w，并把结果同曲面的等值比较。法向量 ∇w 只在曲面上的点处描述曲面。'),
        explanation: t(`${[os.P, ...os.others].map(p => `w${vec(...p)} = ${num(wsurf(p))}`).join('; ')}. Only ${vec(...os.P)} gives ${os.c}, so it is the point on the surface. At the other points the value of w differs from ${os.c}, so they lie on other level surfaces and ∇w there is not normal to this surface.`,
          `${[os.P, ...os.others].map(p => `w${vec(...p)} = ${num(wsurf(p))}`).join('；')}。只有 ${vec(...os.P)} 给出 ${os.c}，所以它是曲面上的点。在其余各点 w 的值不等于 ${os.c}，它们位于其他等值面上，那里的 ∇w 并不垂直于这个曲面。`),
        audit: { kind: 'MIT-MV-25:on-surface', params: { a: os.a, b: os.b, c: os.c } },
      }),
      g.number({
        id: 'tangent-plane', title: t('The tangent plane to a level surface', '等值面的切平面'),
        prompt: t(`The surface ${poly(Wt, XYZ)} = ${num(tp.c)} passes through P = ${vec(...tp.P)}. It is the level surface w = ${num(tp.c)} of w = ${poly(Wt, XYZ)}, so ∇w(P) is normal to it. Write the tangent plane at P as n_x·x + n_y·y + n_z·z = D, where n = ∇w(P). Find n_x, n_y, n_z and D.`,
          `曲面 ${poly(Wt, XYZ)} = ${num(tp.c)} 经过 P = ${vec(...tp.P)}。它是 w = ${poly(Wt, XYZ)} 的等值面 w = ${num(tp.c)}，所以 ∇w(P) 是它的法向量。把 P 处的切平面写成 n_x·x + n_y·y + n_z·z = D，其中 n = ∇w(P)。求 n_x、n_y、n_z 与 D。`),
        fields: [{ label: t('n_x', 'n_x'), answer: tp.n[0] }, { label: t('n_y', 'n_y'), answer: tp.n[1] }, { label: t('n_z', 'n_z'), answer: tp.n[2] }, { label: t('D', 'D'), answer: tp.D }],
        hint: t('The point-normal form is n·(r − P) = 0, which expands to n·r = n·P. Compute ∇w first, then the dot product n·P.', '点法式为 n·(r − P) = 0，展开后是 n·r = n·P。先求 ∇w，再求点积 n·P。'),
        explanation: t(`∇w = (${poly([[2, 1]], ['x'])}, ${poly([[2 * tp.a, 1]], ['y'])}, ${num(tp.b)}), so at P the normal is n = ${vec(...tp.n)}. The point-normal form n·(r − P) = 0 is ${par(tp.n[0])}(x − ${par(tp.P[0])}) + ${par(tp.n[1])}(y − ${par(tp.P[1])}) + ${tp.n[2] === 1 ? '' : par(tp.n[2])}(z − ${par(tp.P[2])}) = 0, which rearranges to n·r = n·P. So D = ${par(tp.n[0])}·${par(tp.P[0])} + ${par(tp.n[1])}·${par(tp.P[1])} + ${par(tp.n[2])}·${par(tp.P[2])} = ${num(tp.D)}.`,
          `∇w = (${poly([[2, 1]], ['x'])}, ${poly([[2 * tp.a, 1]], ['y'])}, ${num(tp.b)})，所以在 P 处法向量为 n = ${vec(...tp.n)}。点法式 n·(r − P) = 0 即 ${par(tp.n[0])}(x − ${par(tp.P[0])}) + ${par(tp.n[1])}(y − ${par(tp.P[1])}) + ${tp.n[2] === 1 ? '' : par(tp.n[2])}(z − ${par(tp.P[2])}) = 0，整理为 n·r = n·P。所以 D = ${par(tp.n[0])}·${par(tp.P[0])} + ${par(tp.n[1])}·${par(tp.P[1])} + ${par(tp.n[2])}·${par(tp.P[2])} = ${num(tp.D)}。`),
        audit: { kind: 'MIT-MV-25:tangent-plane', params: { a: tp.a, b: tp.b, x0: tp.P[0], y0: tp.P[1], z0: tp.P[2] } },
      }),
      g.choice({
        id: 'zero-gradient', title: t('Where "perpendicular to the level curve" says nothing', '“垂直于等高线”在哪里不起作用'),
        prompt: t(`f(x, y) = ${poly(Fcr, XY)}. The gradient ∇f is perpendicular to the level curve through a point only when ∇f is a non-zero vector there. At which of these points is ∇f = (0, 0), so that this statement says nothing?`,
          `f(x, y) = ${poly(Fcr, XY)}。只有当某点处 ∇f 是非零向量时，∇f 才垂直于过该点的等高线。在下列哪个点处 ∇f = (0, 0)，使这个说法不起作用？`),
        options: [[cr.xs, cr.ys], ...crPick].map(p => t(pt2(p[0], p[1]), pt2(p[0], p[1]))), correct: 0,
        hint: t('Compute f_x and f_y at each point; the answer is the point where both vanish.', '在各点计算 f_x 与 f_y；答案是两者都为 0 的那个点。'),
        explanation: t(`f_x = ${poly(D(Fcr, 0), XY)} and f_y = ${poly(D(Fcr, 1), XY)}. Both vanish only at ${pt2(cr.xs, cr.ys)}; at the other points ∇f = ${[...crPick].map(p => vec(ev(D(Fcr, 0), p), ev(D(Fcr, 1), p))).join(' and ')}, which are not zero. A zero vector has no direction, so "perpendicular" says nothing there, and the level curve through such a point can be a single point or cross itself (compare x² + y² = 0 and x² − y² = 0 at the origin).`,
          `f_x = ${poly(D(Fcr, 0), XY)}，f_y = ${poly(D(Fcr, 1), XY)}。两者只在 ${pt2(cr.xs, cr.ys)} 处同时为 0；在其他点 ∇f = ${[...crPick].map(p => vec(ev(D(Fcr, 0), p), ev(D(Fcr, 1), p))).join(' 与 ')}，都不为零。零向量没有方向，所以“垂直”在那里没有意义，过这种点的等高线可能只是一个点或自身相交（比较原点处的 x² + y² = 0 与 x² − y² = 0）。`),
        audit: { kind: 'MIT-MV-25:zero-gradient', params: { a: cr.a, b: cr.b, c: cr.c, d: cr.d } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`f(x, y) = ${poly(Fch, XY)} and P = ${pt2(ch.x0, ch.y0)}. The tangent line at P to the level curve of f through P is perpendicular to ∇f(P), so it can be written f_x(P)·x + f_y(P)·y = k. Find f_x(P), f_y(P) and k.`,
          `f(x, y) = ${poly(Fch, XY)}，P = ${pt2(ch.x0, ch.y0)}。f 过 P 的等高线在 P 处的切线垂直于 ∇f(P)，所以可写成 f_x(P)·x + f_y(P)·y = k。求 f_x(P)、f_y(P) 与 k。`),
        fields: [{ label: t('f_x(P)', 'f_x(P)'), answer: chx }, { label: t('f_y(P)', 'f_y(P)'), answer: chy }, { label: t('k', 'k'), answer: chk }],
        hint: t('The line through P with normal vector n is n·((x, y) − P) = 0, that is n·(x, y) = n·P.', '过 P、法向量为 n 的直线是 n·((x, y) − P) = 0，即 n·(x, y) = n·P。'),
        explanation: t(`f_x = ${poly(D(Fch, 0), XY)} = ${num(chx)} and f_y = ${poly(D(Fch, 1), XY)} = ${num(chy)} at P, so ∇f(P) = ${vec(chx, chy)}. Then k = f_x(P)·x₀ + f_y(P)·y₀ = ${par(chx)}·${par(ch.x0)} + ${par(chy)}·${par(ch.y0)} = ${num(chk)}. You practised computing a gradient and using its perpendicularity to a level curve; the proof of that fact and directional derivatives are not assessed here.`,
          `在 P 处 f_x = ${poly(D(Fch, 0), XY)} = ${num(chx)}，f_y = ${poly(D(Fch, 1), XY)} = ${num(chy)}，所以 ∇f(P) = ${vec(chx, chy)}。于是 k = f_x(P)·x₀ + f_y(P)·y₀ = ${par(chx)}·${par(ch.x0)} + ${par(chy)}·${par(ch.y0)} = ${num(chk)}。你练习了计算梯度并利用它垂直于等高线；该事实的证明与方向导数不在这里考查。`),
        audit: { kind: 'MIT-MV-25:challenge', params: { a: ch.a, b: ch.b, c: ch.c, x0: ch.x0, y0: ch.y0 } },
      }),
    ];
  },
};
