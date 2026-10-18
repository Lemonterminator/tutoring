import { ellipse, sampleCurve, type FigureShape, type Pt } from '../figure';
import { coef, frac, linear, makeMvDeck, num, par, term, vec, type GeneratorMap } from './support';

/**
 * Batch 6: MIT-MV-26 Directional Derivatives, MIT-MV-27 Lagrange Multipliers: Statement and Proof,
 * MIT-MV-28 Lagrange Multipliers: An Advanced Example, MIT-MV-29 Constrained Differentials, MIT-MV-30 Unit 2 Review.
 * Definitions follow content/mit-multivariable-calculus/sources/{26..30}-*.txt (18.02SC sessions 38 to 46).
 */
type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string) => [en, zh] as const;

/** Draw with `make` until `ok` holds. Bounded, so a bad sampling condition fails loudly instead of hanging. */
function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** The shared LCG gives near-constant first draws for neighbouring seeds. */
const warm = (g: Deck) => { for (let i = 0; i < 10; i++) g.random(0, 1); };
const round2 = (x: number) => Math.round(x * 100) / 100;

// ---- Text helpers (signs never print as "+ −"; a coefficient 1 is never printed) ----
/** "c·v" with c = 1 and −1 handled and negative factors parenthesised. */
const mulStr = (c: number, v: number) => (v === 0 && Math.abs(c) === 1 ? '0' : c === 1 ? par(v) : c === -1 ? `−${par(v)}` : `${par(c)}·${par(v)}`);
/** Join products with " + " / " − " so that a negative term never prints as "+ −". */
const joinTerms = (parts: string[]) => (parts.length === 0 ? '0' : parts.reduce((acc, s, i) => (i === 0 ? s : s.startsWith('−') ? `${acc} − ${s.slice(1)}` : `${acc} + ${s}`)));
/** cx·vx + cy·vy + c0 as text: "2x − y + 3". */
const affine = (cx: number, cy: number, c0 = 0, vx = 'x', vy = 'y') => {
  const s = linear([cx, cy], [vx, vy]);
  return c0 === 0 ? s : s === '0' ? num(c0) : `${s} ${term(c0)}`;
};
/** The value cx·x + cy·y + c0 written with the numbers substituted. */
const evalAffine = (cx: number, cy: number, c0: number, x: number, y: number) =>
  joinTerms([...(cx ? [mulStr(cx, x)] : []), ...(cy ? [mulStr(cy, y)] : []), ...(c0 ? [num(c0)] : [])]);
/** "expr + add" where add is already a printed linear expression (may start with "−"). */
const plus = (expr: string, add: string) => (add === '0' ? expr : add.startsWith('−') ? `${expr} − ${add.slice(1)}` : `${expr} + ${add}`);
/** "6/(−2) = −3" or "1/2": the quotient n/d without repeating itself. */
const divText = (n: number, d: number) => { const base = `${num(n)}/${par(d)}`, r = frac(n, d); return base === r ? base : `${base} = ${r}`; };
/** "2 dx − dy + 3 dz": a differential with its coefficients; 1 is omitted, 0 terms are dropped. */
const diffText = (cs: number[], names: string[]) => {
  const parts = cs.map((c, i) => ({ c, n: names[i] })).filter(p => p.c !== 0);
  if (!parts.length) return '0';
  return parts.map((p, i) => {
    const abs = Math.abs(p.c), body = abs === 1 ? p.n : `${num(abs)} ${p.n}`;
    return i === 0 ? (p.c < 0 ? `−${body}` : body) : ` ${p.c < 0 ? '−' : '+'} ${body}`;
  }).join('');
};
/** "(N)/b" with b = ±1, ±2 handled so that no "÷1" or "− −" appears. */
const divBy = (n: string, b: number) => (b === 1 ? n : b === -1 ? `−(${n})` : b > 0 ? `(${n})/${b}` : `−(${n})/${-b}`);
const vecFrac = (a: number, b: number, n: number) => `(${frac(a, n)}, ${frac(b, n)})`;
/** "−62/17", "35/5 = 7", "−2/5 ≈ −0.4": the quotient s/n without repeating itself. */
const ratioText = (s: number, n: number) => {
  const base = `${num(s)}/${n}`, r = frac(s, n);
  return `${base}${r !== base ? ` = ${r}` : ''}${Number.isInteger(s / n) ? '' : ` ≈ ${num(Math.round(s / n * 100) / 100)}`}`;
};

/** General quadratic a x² + b xy + c y² + d x + e y (a, c never zero). */
type Q5 = { a: number; b: number; c: number; d: number; e: number };
const sampleQ = (g: Deck): Q5 => ({ a: g.nonzero(-3, 3), b: g.random(-3, 3), c: g.nonzero(-3, 3), d: g.random(-3, 3), e: g.random(-3, 3) });
const qText = (q: Q5) => linear([q.a, q.b, q.c, q.d, q.e], ['x²', 'xy', 'y²', 'x', 'y']);
const qVal = (q: Q5, x: number, y: number) => q.a * x * x + q.b * x * y + q.c * y * y + q.d * x + q.e * y;
const qFx = (q: Q5, x: number, y: number) => 2 * q.a * x + q.b * y + q.d;
const qFy = (q: Q5, x: number, y: number) => q.b * x + 2 * q.c * y + q.e;

/** Pythagorean direction vectors (norm is an integer; the norms 5, 10, 13, 15, 17 never give a two-decimal tie). */
const PY: [number, number, number][] = [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [6, 8, 10], [8, 6, 10], [9, 12, 15], [12, 9, 15]];
function pyth(g: Deck) { const [a, b, n] = g.pick(PY); const sx = g.pick([1, -1]); const sy = g.pick([1, -1]); return { x: a * sx, y: b * sy, n }; }
/** Integer-norm triples: (1,2,2) 3, (2,3,6) 7, (1,4,8) 9, (4,4,7) 9, (2,6,9) 11. */
const TRIPLES: [number, number, number, number][] = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11]];
function triple(g: Deck) {
  const [a, b, c, n] = g.pick(TRIPLES);
  const arr = [a, b, c];
  for (let i = 2; i > 0; i--) { const j = g.random(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return { v: arr.map(x => x * g.pick([1, -1])) as [number, number, number], n };
}

export const batch06Generators: GeneratorMap = {
  // ================================================================================================
  'MIT-MV-26': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-26');
    warm(g);

    // Cards 1-3 share one function, point and direction.
    const A = retry(() => {
      const q = sampleQ(g), x0 = g.random(-3, 3), y0 = g.random(-3, 3), v = pyth(g);
      const fx = qFx(q, x0, y0), fy = qFy(q, x0, y0);
      return { q, x0, y0, v, fx, fy, s: fx * v.x + fy * v.y };
    }, r => r.fx !== 0 && r.fy !== 0 && r.s !== 0);
    const { q, x0, y0, v, fx, fy, s } = A;
    const dds = s / v.n;

    // 4. direction vector that is not a unit vector
    const B = retry(() => ({ g1: g.nonzero(-5, 5), g2: g.nonzero(-5, 5), v: pyth(g) }), r => r.g1 * r.v.x + r.g2 * r.v.y !== 0);
    const sB = B.g1 * B.v.x + B.g2 * B.v.y;

    // 5. the angle formula
    const angles = [0, 60, 90, 120, 180], cosines = [1, 0.5, 0, -0.5, -1];
    const ai = g.random(0, 4), G5 = g.pick([2, 4, 6, 8, 10]), theta = angles[ai], ans5 = G5 * cosines[ai];

    // 6. fastest increase in space
    const tr = triple(g);
    const P6 = { p: g.random(-2, 2), q: g.random(-2, 2), r: g.random(-2, 2) };
    const d6 = tr.v[0] - 2 * P6.p, e6 = tr.v[1] - 4 * P6.q, f6 = tr.v[2] - 4 * P6.r;
    const T6 = plus('x² + 2y² + 2z²', linear([d6, e6, f6], ['x', 'y', 'z']));

    // 7. direction of fastest decrease
    const C7 = pyth(g);

    // 8. how far
    const r8 = g.nonzero(-5, 5), ds8 = g.pick([0.1, 0.2, 0.3, 0.4, 0.5]), dT8 = round2(r8 * ds8);

    // 9. challenge
    const H = retry(() => {
      const a = g.nonzero(-2, 2), b = g.nonzero(-2, 2), x0h = g.random(-2, 2), y0h = g.random(-2, 2), gr = pyth(g), vh = pyth(g);
      return { a, b, x0h, y0h, gr, vh, d: gr.x - 2 * a * x0h, e: gr.y - 2 * b * y0h, s: gr.x * vh.x + gr.y * vh.y };
    }, r => r.s !== 0 && Math.abs(r.s) !== r.gr.n * r.vh.n);
    const wH = linear([H.a, H.b, H.d, H.e], ['x²', 'y²', 'x', 'y']);

    // figure for card 5
    const th = theta * Math.PI / 180;
    const arrows: FigureShape[] = [
      { kind: 'arrow', from: [0, 0], to: [2.2, 0], tone: 'accent', width: 2, label: '∇w' },
      { kind: 'arrow', from: [0, 0], to: [1.6 * Math.cos(th), 1.6 * Math.sin(th)] as Pt, tone: 'warn', width: 2, label: 'u' },
      ...(theta > 0 ? [{ kind: 'line', points: sampleCurve(a => [0.7 * Math.cos(a), 0.7 * Math.sin(a)] as Pt, 0, th, 24), tone: 'muted', width: 1.5 } as FigureShape] : []),
      { kind: 'point', at: [0, 0], tone: 'text', label: 'P' },
    ];

    return [
      g.number({
        id: 'gradient', title: t('The gradient at a point', '一点处的梯度'),
        prompt: t(`w(x, y) = ${qText(q)}. Find the gradient ∇w = (w_x, w_y) at the point P = (${num(x0)}, ${num(y0)}).`,
          `w(x, y) = ${qText(q)}。求梯度 ∇w = (w_x, w_y) 在点 P = (${num(x0)}, ${num(y0)}) 的值。`),
        fields: [{ label: t('w_x', 'w_x'), answer: fx }, { label: t('w_y', 'w_y'), answer: fy }],
        hint: t('Differentiate in x with y constant for w_x, then in y with x constant for w_y. Substitute P at the end.', '求 w_x 时把 y 当常数对 x 求导，求 w_y 时把 x 当常数对 y 求导，最后代入 P。'),
        explanation: t(`w_x = ${affine(2 * q.a, q.b, q.d)}, so w_x(P) = ${evalAffine(2 * q.a, q.b, q.d, x0, y0)} = ${num(fx)}. w_y = ${affine(q.b, 2 * q.c, q.e)}, so w_y(P) = ${evalAffine(q.b, 2 * q.c, q.e, x0, y0)} = ${num(fy)}. Hence ∇w(P) = ${vec(fx, fy)}.`,
          `w_x = ${affine(2 * q.a, q.b, q.d)}，所以 w_x(P) = ${evalAffine(2 * q.a, q.b, q.d, x0, y0)} = ${num(fx)}。w_y = ${affine(q.b, 2 * q.c, q.e)}，所以 w_y(P) = ${evalAffine(q.b, 2 * q.c, q.e, x0, y0)} = ${num(fy)}。于是 ∇w(P) = ${vec(fx, fy)}。`),
        audit: { kind: 'MIT-MV-26:gradient', params: { a: q.a, b: q.b, c: q.c, d: q.d, e: q.e, x0, y0 } },
      }),
      g.number({
        id: 'unit-vector', title: t('Normalise the direction', '把方向化为单位向量'),
        prompt: t(`The direction of a step in the xy-plane is given by v = ${vec(v.x, v.y)}. Find the unit vector u = v/|v| in this direction. Enter each component as a fraction (for example 3/5) or as a decimal to 2 places.`,
          `xy 平面内一步的方向由 v = ${vec(v.x, v.y)} 给出。求这个方向上的单位向量 u = v/|v|。每个分量用分数（例如 3/5）或保留 2 位小数的小数输入。`),
        fields: [{ label: t('u_x', 'u_x'), answer: v.x / v.n, tolerance: 0.005 }, { label: t('u_y', 'u_y'), answer: v.y / v.n, tolerance: 0.005 }],
        hint: t('A unit vector has length 1: divide both components of v by its length |v| = √(v_x² + v_y²).', '单位向量的长度为 1：把 v 的两个分量都除以它的长度 |v| = √(v_x² + v_y²)。'),
        explanation: t(`|v| = √(${par(v.x)}² + ${par(v.y)}²) = √${v.x * v.x + v.y * v.y} = ${v.n}. So u = v/${v.n} = ${vecFrac(v.x, v.y, v.n)}, which has length 1. Dividing by |v| is the step the directional-derivative formula needs: it only works with a unit vector.`,
          `|v| = √(${par(v.x)}² + ${par(v.y)}²) = √${v.x * v.x + v.y * v.y} = ${v.n}。所以 u = v/${v.n} = ${vecFrac(v.x, v.y, v.n)}，长度为 1。方向导数公式只适用于单位向量，所以必须先除以 |v|。`),
        audit: { kind: 'MIT-MV-26:unit-vector', params: { vx: v.x, vy: v.y } },
      }),
      g.number({
        id: 'directional', title: t('The directional derivative', '方向导数'),
        prompt: t(`w(x, y) = ${qText(q)} and P = (${num(x0)}, ${num(y0)}). Find the directional derivative dw/ds at P in the direction of v = ${vec(v.x, v.y)} (v is not a unit vector). Enter a fraction or a decimal to 2 places.`,
          `w(x, y) = ${qText(q)}，P = (${num(x0)}, ${num(y0)})。求 w 在 P 处沿 v = ${vec(v.x, v.y)} 方向的方向导数 dw/ds（v 不是单位向量）。用分数或保留 2 位小数的小数输入。`),
        fields: [{ label: t('dw/ds', 'dw/ds'), answer: dds, tolerance: 0.005 }],
        hint: t('dw/ds = ∇w · u with u a unit vector. Find ∇w(P), normalise v, then take the dot product.', 'dw/ds = ∇w · u，其中 u 是单位向量。先求 ∇w(P)，再把 v 单位化，最后做点积。'),
        explanation: t(`∇w(P) = ${vec(fx, fy)}. |v| = ${v.n}, so u = ${vecFrac(v.x, v.y, v.n)}. Then dw/ds = ∇w · u = (${joinTerms([mulStr(fx, v.x), mulStr(fy, v.y)])})/${v.n} = ${ratioText(s, v.n)}.`,
          `∇w(P) = ${vec(fx, fy)}。|v| = ${v.n}，所以 u = ${vecFrac(v.x, v.y, v.n)}。于是 dw/ds = ∇w · u = (${joinTerms([mulStr(fx, v.x), mulStr(fy, v.y)])})/${v.n} = ${ratioText(s, v.n)}。`),
        audit: { kind: 'MIT-MV-26:directional-derivative', params: { a: q.a, b: q.b, c: q.c, d: q.d, e: q.e, x0, y0, vx: v.x, vy: v.y } },
      }),
      g.choice({
        id: 'not-unit', title: t('A direction that is not a unit vector', '方向向量不是单位向量'),
        prompt: t(`At P the gradient of w is ∇w = ${vec(B.g1, B.g2)}. A student wants dw/ds in the direction of v = ${vec(B.v.x, B.v.y)}, where |v| = ${B.v.n}. Which value is the directional derivative dw/ds along v?`,
          `在 P 处 w 的梯度为 ∇w = ${vec(B.g1, B.g2)}。一位同学要求 w 沿 v = ${vec(B.v.x, B.v.y)} 方向的方向导数 dw/ds，其中 |v| = ${B.v.n}。方向导数 dw/ds 的值是哪一个？`),
        options: [
          t(`dw/ds = ${frac(sB, B.v.n)}`, `dw/ds = ${frac(sB, B.v.n)}`),
          t(`dw/ds = ${num(sB)}`, `dw/ds = ${num(sB)}`),
          t(`dw/ds = ${frac(sB, B.v.n * B.v.n)}`, `dw/ds = ${frac(sB, B.v.n * B.v.n)}`),
          t(`dw/ds = ${frac(-sB, B.v.n)}`, `dw/ds = ${frac(-sB, B.v.n)}`),
        ], correct: 0,
        hint: t('The formula dw/ds = ∇w · u needs |u| = 1. Divide v by |v| once, then dot with ∇w.', '公式 dw/ds = ∇w · u 要求 |u| = 1。把 v 除以 |v| 一次，再与 ∇w 点积。'),
        explanation: t(`∇w · v = ${joinTerms([mulStr(B.g1, B.v.x), mulStr(B.g2, B.v.y)])} = ${num(sB)}. This is ∇w · v, not yet a directional derivative, because v has length ${B.v.n}. With u = v/${B.v.n}: dw/ds = ∇w · u = ${ratioText(sB, B.v.n)}. Using v directly gives ${num(sB)}, dividing by |v|² gives ${frac(sB, B.v.n * B.v.n)}, and a flipped sign would mean the opposite direction.`,
          `∇w · v = ${joinTerms([mulStr(B.g1, B.v.x), mulStr(B.g2, B.v.y)])} = ${num(sB)}。这还不是方向导数，因为 v 的长度是 ${B.v.n}。取 u = v/${B.v.n}：dw/ds = ∇w · u = ${ratioText(sB, B.v.n)}。直接用 v 得到 ${num(sB)}，除以 |v|² 得到 ${frac(sB, B.v.n * B.v.n)}，符号相反则对应相反的方向。`),
        audit: { kind: 'MIT-MV-26:not-unit', params: { g1: B.g1, g2: B.g2, vx: B.v.x, vy: B.v.y } },
      }),
      g.number({
        id: 'angle', title: t('The angle between ∇w and u', '∇w 与 u 的夹角'),
        prompt: t(`At P the gradient of w has length |∇w| = ${G5}. The unit vector u makes an angle θ = ${theta}° with ∇w (see the figure). Find dw/ds at P in the direction of u.`,
          `在 P 处 w 的梯度长度为 |∇w| = ${G5}。单位向量 u 与 ∇w 的夹角为 θ = ${theta}°（见图）。求 w 在 P 处沿 u 方向的 dw/ds。`),
        figure: g.figure({
          alt: t(`From the point P, a long arrow ∇w along the positive x-direction and a shorter arrow u at an angle of ${theta}° from it.`, `从点 P 出发，一支较长的箭头 ∇w 沿 x 轴正方向，一支较短的箭头 u 与它成 ${theta}° 角。`),
          view: { xmin: -2.6, xmax: 2.8, ymin: -0.8, ymax: 2.0 }, shapes: arrows,
          caption: t(`θ = ${theta}°`, `θ = ${theta}°`),
        }),
        fields: [{ label: t('dw/ds', 'dw/ds'), answer: ans5 }],
        hint: t('dw/ds = ∇w · u = |∇w||u| cos θ, and |u| = 1.', 'dw/ds = ∇w · u = |∇w||u| cos θ，而 |u| = 1。'),
        explanation: t(`dw/ds = ∇w · u = |∇w| |u| cos θ = ${G5}·1·cos ${theta}° = ${num(ans5)}. ${theta === 0 ? 'At θ = 0° the rate is as large as it can be.' : theta === 180 ? 'At θ = 180° the rate is as small as it can be: w decreases fastest.' : theta === 90 ? 'At θ = 90° the step stays on a level curve of w, so w does not change to first order.' : 'For an angle strictly between 0° and 180° the rate is cos θ times the largest possible rate |∇w|.'}`,
          `dw/ds = ∇w · u = |∇w| |u| cos θ = ${G5}·1·cos ${theta}° = ${num(ans5)}。${theta === 0 ? 'θ = 0° 时变化率最大。' : theta === 180 ? 'θ = 180° 时变化率最小：w 下降得最快。' : theta === 90 ? 'θ = 90° 时这一步沿着 w 的等高线，所以 w 的一阶变化为零。' : '夹角严格介于 0° 与 180° 之间时，变化率是最大可能变化率 |∇w| 的 cos θ 倍。'}`),
        audit: { kind: 'MIT-MV-26:angle', params: { G: G5, theta } },
      }),
      g.number({
        id: 'max-rate', title: t('The fastest increase in space', '空间中最快的增长'),
        prompt: t(`The function T(x, y, z) = ${T6} gives the temperature at each point of space. At P = ${vec(P6.p, P6.q, P6.r)}, what is the largest possible directional derivative dT/ds over all unit directions u? (The maximum rate of increase of T.)`,
          `函数 T(x, y, z) = ${T6} 表示空间各点的温度。在 P = ${vec(P6.p, P6.q, P6.r)} 处，对所有单位方向 u，方向导数 dT/ds 的最大可能值是多少？（T 增加得最快的速率。）`),
        fields: [{ label: t('largest dT/ds', 'dT/ds 的最大值'), answer: tr.n }],
        hint: t('dT/ds = ∇T · u = |∇T| cos θ is largest when θ = 0. So the answer is the length |∇T|.', 'dT/ds = ∇T · u = |∇T| cos θ，当 θ = 0 时最大。所以答案是长度 |∇T|。'),
        explanation: t(`∇T = (2x${d6 === 0 ? '' : ` ${term(d6)}`}, 4y${e6 === 0 ? '' : ` ${term(e6)}`}, 4z${f6 === 0 ? '' : ` ${term(f6)}`}), so ∇T(P) = ${vec(...tr.v)}. The largest rate is |∇T(P)| = √(${tr.v.map(c => `${par(c)}²`).join(' + ')}) = √${tr.v.reduce((a, c) => a + c * c, 0)} = ${tr.n}, in the direction of ∇T(P).`,
          `∇T = (2x${d6 === 0 ? '' : ` ${term(d6)}`}, 4y${e6 === 0 ? '' : ` ${term(e6)}`}, 4z${f6 === 0 ? '' : ` ${term(f6)}`})，所以 ∇T(P) = ${vec(...tr.v)}。最大变化率是 |∇T(P)| = √(${tr.v.map(c => `${par(c)}²`).join(' + ')}) = √${tr.v.reduce((a, c) => a + c * c, 0)} = ${tr.n}，方向沿 ∇T(P)。`),
        audit: { kind: 'MIT-MV-26:max-rate', params: { d: d6, e: e6, f: f6, p: P6.p, q: P6.q, r: P6.r } },
      }),
      g.choice({
        id: 'decrease-direction', title: t('The direction of fastest decrease', '下降最快的方向'),
        prompt: t(`At P the gradient of w is ∇w = ${vec(C7.x, C7.y)}. Which unit vector u gives the most rapid decrease of w?`,
          `在 P 处 w 的梯度为 ∇w = ${vec(C7.x, C7.y)}。哪个单位向量 u 使 w 下降得最快？`),
        options: [
          t(`u = ${vecFrac(-C7.x, -C7.y, C7.n)}`, `u = ${vecFrac(-C7.x, -C7.y, C7.n)}`),
          t(`u = ${vecFrac(C7.x, C7.y, C7.n)}`, `u = ${vecFrac(C7.x, C7.y, C7.n)}`),
          t(`u = ${vecFrac(-C7.y, C7.x, C7.n)}`, `u = ${vecFrac(-C7.y, C7.x, C7.n)}`),
          t(`u = ${vec(-C7.x, -C7.y)}`, `u = ${vec(-C7.x, -C7.y)}`),
        ], correct: 0,
        hint: t('dw/ds = |∇w| cos θ is smallest when θ = 180°: opposite to ∇w. The answer must also have length 1.', 'dw/ds = |∇w| cos θ 在 θ = 180° 时最小，即与 ∇w 方向相反。答案的长度还必须是 1。'),
        explanation: t(`|∇w| = ${C7.n}. The rate is smallest, −${C7.n}, along u = −∇w/|∇w| = ${vecFrac(-C7.x, -C7.y, C7.n)}. The option ${vecFrac(C7.x, C7.y, C7.n)} points along +∇w, the direction of fastest increase; ${vecFrac(-C7.y, C7.x, C7.n)} is perpendicular to ∇w (rate 0); and ${vec(-C7.x, -C7.y)} points the right way but has length ${C7.n}, not 1.`,
          `|∇w| = ${C7.n}。变化率在 u = −∇w/|∇w| = ${vecFrac(-C7.x, -C7.y, C7.n)} 时最小，等于 −${C7.n}。选项 ${vecFrac(C7.x, C7.y, C7.n)} 沿 +∇w，是增长最快的方向；${vecFrac(-C7.y, C7.x, C7.n)} 与 ∇w 垂直（变化率为 0）；${vec(-C7.x, -C7.y)} 方向正确，但长度是 ${C7.n} 而不是 1。`),
        audit: { kind: 'MIT-MV-26:decrease-direction', params: { g1: C7.x, g2: C7.y } },
      }),
      g.number({
        id: 'distance', title: t('How far for a given change?', '改变一定数量需走多远'),
        prompt: t(`At P the directional derivative of the temperature T in the direction of the unit vector u is dT/ds = ${num(r8)} (degrees per unit length). Using ΔT ≈ (dT/ds)·Δs, about how far Δs ≥ 0 should you travel from P in the direction of u so that T changes by ΔT = ${num(dT8)}? Enter Δs to 2 decimal places.`,
          `在 P 处，温度 T 沿单位向量 u 方向的方向导数为 dT/ds = ${num(r8)}（每单位长度的度数）。利用 ΔT ≈ (dT/ds)·Δs，从 P 沿 u 方向大约要走多远 Δs ≥ 0，才能使 T 改变 ΔT = ${num(dT8)}？保留 2 位小数输入 Δs。`),
        fields: [{ label: t('Δs', 'Δs'), answer: dT8 / r8, tolerance: 0.005 }],
        hint: t('dT/ds is the limit of ΔT/Δs, so for small steps ΔT ≈ (dT/ds)Δs. Solve for Δs.', 'dT/ds 是 ΔT/Δs 的极限，所以对小步长 ΔT ≈ (dT/ds)Δs。解出 Δs。'),
        explanation: t(`${num(dT8)} ≈ ${coef(r8, 'Δs')}, so Δs ≈ ${Math.abs(r8) === 1 ? num(round2(dT8 / r8)) : `${num(dT8)}/${par(r8)} = ${num(round2(dT8 / r8))}`}. The directional derivative is a limit of a ratio, so this is a first-order estimate that is good for short steps.`,
          `${num(dT8)} ≈ ${coef(r8, 'Δs')}，所以 Δs ≈ ${Math.abs(r8) === 1 ? num(round2(dT8 / r8)) : `${num(dT8)}/${par(r8)} = ${num(round2(dT8 / r8))}`}。方向导数是比值的极限，所以这是一阶估计，对短步长较准确。`),
        audit: { kind: 'MIT-MV-26:distance', params: { r: r8, dT: dT8 } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`w(x, y) = ${wH}. At P = (${num(H.x0h)}, ${num(H.y0h)}) find (i) the directional derivative dw/ds in the direction of v = ${vec(H.vh.x, H.vh.y)} (enter a fraction or a decimal to 2 places) and (ii) the largest value of dw/ds over all unit directions.`,
          `w(x, y) = ${wH}。在 P = (${num(H.x0h)}, ${num(H.y0h)}) 处求 (i) 沿 v = ${vec(H.vh.x, H.vh.y)} 方向的方向导数 dw/ds（用分数或保留 2 位小数的小数输入），以及 (ii) 对所有单位方向 dw/ds 的最大值。`),
        fields: [{ label: t('dw/ds along v', '沿 v 的 dw/ds'), answer: H.s / H.vh.n, tolerance: 0.005 }, { label: t('largest dw/ds', 'dw/ds 的最大值'), answer: H.gr.n, tolerance: 0.005 }],
        hint: t('Find ∇w(P) first. For (i) normalise v and take ∇w · u. For (ii) use the length |∇w(P)|.', '先求 ∇w(P)。(i) 把 v 单位化后取 ∇w · u。(ii) 用长度 |∇w(P)|。'),
        explanation: t(`∇w = (${affine(2 * H.a, 0, H.d)}, ${affine(0, 2 * H.b, H.e)}), so ∇w(P) = ${vec(H.gr.x, H.gr.y)}. (i) |v| = ${H.vh.n}, so dw/ds = ∇w · v/|v| = (${joinTerms([mulStr(H.gr.x, H.vh.x), mulStr(H.gr.y, H.vh.y)])})/${H.vh.n} = ${ratioText(H.s, H.vh.n)}. (ii) The maximum is |∇w(P)| = √(${par(H.gr.x)}² + ${par(H.gr.y)}²) = ${H.gr.n}. You practised computing and using directional derivatives for differentiable functions; whether the directional derivative exists at a non-smooth point, and the proof of the formula dw/ds = ∇w · u, are not assessed here.`,
          `∇w = (${affine(2 * H.a, 0, H.d)}, ${affine(0, 2 * H.b, H.e)})，所以 ∇w(P) = ${vec(H.gr.x, H.gr.y)}。(i) |v| = ${H.vh.n}，所以 dw/ds = ∇w · v/|v| = (${joinTerms([mulStr(H.gr.x, H.vh.x), mulStr(H.gr.y, H.vh.y)])})/${H.vh.n} = ${ratioText(H.s, H.vh.n)}。(ii) 最大值是 |∇w(P)| = √(${par(H.gr.x)}² + ${par(H.gr.y)}²) = ${H.gr.n}。本游戏练习的是可微函数的方向导数的计算与使用；方向导数在不光滑点是否存在，以及公式 dw/ds = ∇w · u 的证明，不在考查范围内。`),
        audit: { kind: 'MIT-MV-26:challenge', params: { a: H.a, b: H.b, d: H.d, e: H.e, x0: H.x0h, y0: H.y0h, vx: H.vh.x, vy: H.vh.y } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-27': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-27');
    warm(g);

    // 1. gradients of f and g at a point of the constraint
    const S1 = retry(() => ({ a: g.nonzero(-3, 3), b: g.nonzero(-3, 3), c: g.random(1, 3), x0: g.nonzero(-3, 3), y0: g.nonzero(-3, 3) }), r => r.a * r.x0 + r.b !== 0);
    const k1 = S1.x0 * S1.x0 + S1.c * S1.y0 * S1.y0;
    const f1 = [S1.a * S1.y0, S1.a * S1.x0 + S1.b], g1 = [2 * S1.x0, 2 * S1.c * S1.y0];

    // 2. lambda
    const lam = g.pick<[number, number]>([[-3, 1], [-2, 1], [-1, 1], [1, 1], [2, 1], [3, 1], [-3, 2], [-1, 2], [1, 2], [3, 2]]);
    const w2 = [g.nonzero(-3, 3), g.nonzero(-3, 3)];
    const v2 = [lam[1] * w2[0], lam[1] * w2[1]], u2 = [lam[0] * w2[0], lam[0] * w2[1]];

    // 3. parallel or not
    const yes3 = g.random(0, 1) === 1;
    const v3 = [g.nonzero(-4, 4), g.nonzero(-4, 4)];
    const lam3 = g.pick([-3, -2, -1, 1, 2, 3]);
    const u3 = yes3 ? [lam3 * v3[0], lam3 * v3[1]] : retry(() => [g.nonzero(-6, 6), g.nonzero(-6, 6)], u => u[0] * v3[1] - u[1] * v3[0] !== 0);

    // 4. circle maximum
    const [pa, pb, n0] = g.pick(PY), pm = g.pick([1, 2, 3]);
    const sp = g.pick([1, -1]), sq = g.pick([1, -1]);
    const p4 = pm * sp * pa, q4 = pm * sq * pb, R4 = n0 * n0;
    const x4 = sp * pa, y4 = sq * pb;

    // 5. rectangle
    const a5 = g.random(1, 4), b5 = g.random(1, 4), k5 = g.random(1, 2), c5 = 2 * a5 * b5 * k5;
    const x5 = b5 * k5, y5 = a5 * k5;

    // 6. why a maximum
    const a6 = g.random(1, 4), b6 = g.random(1, 4), k6 = g.random(1, 2), c6 = 2 * a6 * b6 * k6;
    const X6 = 2 * b6 * k6, Y6 = 2 * a6 * k6, area6 = a6 * b6 * k6 * k6;

    // 7. figure: the circle, three level lines of f = p x + q y
    const [fa, fb, fn] = g.pick(PY);
    const p7 = g.pick([1, -1]) * fa, q7 = g.pick([1, -1]) * fb, R7 = fn * fn;
    const levels7 = [fn * (fn + Math.max(2, Math.round(0.3 * fn))), fn * fn, fn * (fn - Math.max(3, Math.round(0.4 * fn)))];
    const box7 = 1.7 * fn, clipBox = 0.93 * box7;
    const clip = (c: number, ux: number, uy: number, cx: number, cy: number): Pt[] => {
      // points cx,cy + s*(ux,uy) with |x|,|y| <= box
      let lo = -1e9, hi = 1e9;
      for (const [o, d] of [[cx, ux], [cy, uy]]) if (Math.abs(d) > 1e-9) { const s1 = (-clipBox - o) / d, s2 = (clipBox - o) / d; lo = Math.max(lo, Math.min(s1, s2)); hi = Math.min(hi, Math.max(s1, s2)); }
      void c;
      return [[cx + lo * ux, cy + lo * uy], [cx + hi * ux, cy + hi * uy]];
    };
    const lines7: FigureShape[] = levels7.map((L, i) => {
      const c0x = L * p7 / (fn * fn), c0y = L * q7 / (fn * fn);
      const [s, e] = clip(L, -q7 / fn, p7 / fn, c0x, c0y);
      return { kind: 'line', points: [s, e], tone: i === 1 ? 'accent' : 'muted', width: i === 1 ? 2.5 : 1.5, label: `f = ${L}`, labelAt: i === 1 ? s : e } as FigureShape;
    });
    const dir7: Pt = [p7 / fn, q7 / fn];
    const shapes7: FigureShape[] = [
      { kind: 'line', points: ellipse(0, 0, fn, fn, 72), tone: 'text', width: 2 },
      ...lines7,
      { kind: 'arrow', from: [p7, q7], to: [p7 + 0.55 * fn * dir7[0], q7 + 0.55 * fn * dir7[1]], tone: 'accent2', width: 2, label: '∇g' },
      { kind: 'arrow', from: [p7, q7], to: [p7 + 0.3 * fn * dir7[0], q7 + 0.3 * fn * dir7[1]], tone: 'accent3', width: 2.5, label: '∇f' },
      { kind: 'point', at: [p7, q7], tone: 'warn', label: 'P' },
    ];

    // 9. challenge
    const combos9: [number, number][] = [];
    for (let m = 2; m <= 6; m++) for (let k = 1; k <= Math.min(5, 2 * (m - 1) - 1); k++) {
      const hundredths = 100 * k * k / (4 * (m - 1));
      if (Math.abs(hundredths - Math.floor(hundredths) - 0.5) > 1e-9) combos9.push([m, k], [m, -k]);
    }
    const [m9, k9] = g.pick(combos9);
    const max9 = m9 + k9 * k9 / (4 * (m9 - 1)), min9 = 1 - Math.abs(k9);
    const f9 = linear([1, k9, m9], ['x²', 'x', 'y²']);

    const fT1 = linear([S1.a, S1.b], ['xy', 'y']), gT1 = linear([1, S1.c], ['x²', 'y²']);
    const L5 = linear([a5, b5], ['x', 'y']), L6 = linear([a6, b6], ['x', 'y']);
    const f4 = linear([p4, q4], ['x', 'y']);

    return [
      g.number({
        id: 'gradients', title: t('The two gradients', '两个梯度'),
        prompt: t(`Maximise f(x, y) = ${fT1} subject to the constraint g(x, y) = ${gT1} = ${k1}. The point P = (${num(S1.x0)}, ${num(S1.y0)}) lies on the constraint curve. Find f_x, f_y, g_x and g_y at P.`,
          `在约束 g(x, y) = ${gT1} = ${k1} 下求 f(x, y) = ${fT1} 的最大值。点 P = (${num(S1.x0)}, ${num(S1.y0)}) 在约束曲线上。求 f_x、f_y、g_x 与 g_y 在 P 处的值。`),
        fields: [{ label: t('f_x', 'f_x'), answer: f1[0] }, { label: t('f_y', 'f_y'), answer: f1[1] }, { label: t('g_x', 'g_x'), answer: g1[0] }, { label: t('g_y', 'g_y'), answer: g1[1] }],
        hint: t('Differentiate each function in x (y constant) and in y (x constant), then substitute P.', '分别对 x（y 为常数）和 y（x 为常数）求导，再代入 P。'),
        explanation: t(`f_x = ${coef(S1.a, 'y')} = ${num(f1[0])} and f_y = ${affine(S1.a, 0, S1.b)} = ${evalAffine(S1.a, 0, S1.b, S1.x0, 0)} = ${num(f1[1])}, so ∇f(P) = ${vec(f1[0], f1[1])}. g_x = 2x = ${num(g1[0])} and g_y = ${coef(2 * S1.c, 'y')} = ${num(g1[1])}, so ∇g(P) = ${vec(g1[0], g1[1])}. These two vectors are what the Lagrange condition ∇f = λ∇g compares.`,
          `f_x = ${coef(S1.a, 'y')} = ${num(f1[0])}，f_y = ${affine(S1.a, 0, S1.b)} = ${evalAffine(S1.a, 0, S1.b, S1.x0, 0)} = ${num(f1[1])}，所以 ∇f(P) = ${vec(f1[0], f1[1])}。g_x = 2x = ${num(g1[0])}，g_y = ${coef(2 * S1.c, 'y')} = ${num(g1[1])}，所以 ∇g(P) = ${vec(g1[0], g1[1])}。拉格朗日条件 ∇f = λ∇g 比较的就是这两个向量。`),
        audit: { kind: 'MIT-MV-27:gradients', params: { a: S1.a, b: S1.b, c: S1.c, x0: S1.x0, y0: S1.y0 } },
      }),
      g.number({
        id: 'find-lambda', title: t('Find the multiplier λ', '求乘数 λ'),
        prompt: t(`At a point P of the constraint curve g(x, y) = c the gradients are ∇f(P) = ${vec(u2[0], u2[1])} and ∇g(P) = ${vec(v2[0], v2[1])}. They are parallel, ∇f = λ∇g. Find λ (a fraction such as 3/2 is fine).`,
          `在约束曲线 g(x, y) = c 的点 P 处，梯度为 ∇f(P) = ${vec(u2[0], u2[1])}，∇g(P) = ${vec(v2[0], v2[1])}。它们平行，∇f = λ∇g。求 λ（可以输入 3/2 这样的分数）。`),
        fields: [{ label: t('λ', 'λ'), answer: lam[0] / lam[1] }],
        hint: t('Compare components: the first component of ∇f equals λ times the first component of ∇g. The second components must give the same λ.', '比较分量：∇f 的第一个分量等于 λ 乘 ∇g 的第一个分量，第二个分量必须给出同一个 λ。'),
        explanation: t(`λ = ${divText(u2[0], v2[0])}, and the second components give ${divText(u2[1], v2[1])} as well. Both components give the same λ, which is exactly what parallel vectors mean.`,
          `λ = ${divText(u2[0], v2[0])}，第二个分量给出 ${divText(u2[1], v2[1])}，也相同。两个分量给出同一个 λ，这正是两个向量平行的含义。`),
        audit: { kind: 'MIT-MV-27:lambda', params: { u1: u2[0], u2: u2[1], v1: v2[0], v2: v2[1] } },
      }),
      g.choice({
        id: 'critical-or-not', title: t('Can this point be an extremum?', '这一点可能是极值点吗？'),
        prompt: t(`P is a point of the constraint curve g(x, y) = c. At P, ∇f = ${vec(u3[0], u3[1])} and ∇g = ${vec(v3[0], v3[1])}. What does the Lagrange condition tell you about P?`,
          `P 是约束曲线 g(x, y) = c 上的一点。在 P 处，∇f = ${vec(u3[0], u3[1])}，∇g = ${vec(v3[0], v3[1])}。拉格朗日条件对 P 说明了什么？`),
        options: [
          t('P is a candidate: ∇f is parallel to ∇g there, but P may still be neither a maximum nor a minimum.', 'P 是候选点：那里 ∇f 与 ∇g 平行，但 P 仍可能既不是最大值点也不是最小值点。'),
          t('P cannot be a local maximum or minimum of f on the curve, because ∇f is not parallel to ∇g.', 'P 不可能是 f 在曲线上的局部最大值点或最小值点，因为 ∇f 与 ∇g 不平行。'),
        ], correct: yes3 ? 0 : 1,
        hint: t('Two vectors (a, b) and (c, d) are parallel exactly when one is a multiple of the other, that is, when ad − bc = 0.', '两个向量 (a, b) 与 (c, d) 平行，当且仅当其中一个是另一个的倍数，即 ad − bc = 0。'),
        explanation: t(yes3
          ? `${vec(u3[0], u3[1])} = ${par(lam3)}·${vec(v3[0], v3[1])}, so ∇f = λ∇g with λ = ${num(lam3)}: P satisfies the Lagrange condition and is a critical point. That is a necessary condition only: an extremum must be a critical point, but a critical point need not be an extremum (check the values of f at all candidates).`
          : `${par(u3[0])}·${par(v3[1])} − ${par(u3[1])}·${par(v3[0])} = ${num(u3[0] * v3[1] - u3[1] * v3[0])} ≠ 0, so ∇f is not a multiple of ∇g. Local maxima and minima occur only at points where ∇f = λ∇g, so P cannot be one.`,
        yes3
          ? `${vec(u3[0], u3[1])} = ${par(lam3)}·${vec(v3[0], v3[1])}，所以 ∇f = λ∇g，λ = ${num(lam3)}：P 满足拉格朗日条件，是临界点。这只是必要条件：极值点一定是临界点，但临界点不一定是极值点（要比较 f 在所有候选点的值）。`
          : `${par(u3[0])}·${par(v3[1])} − ${par(u3[1])}·${par(v3[0])} = ${num(u3[0] * v3[1] - u3[1] * v3[0])} ≠ 0，所以 ∇f 不是 ∇g 的倍数。局部最大值点与最小值点只出现在 ∇f = λ∇g 的点上，所以 P 不可能是极值点。`),
        audit: { kind: 'MIT-MV-27:parallel', params: { u1: u3[0], u2: u3[1], v1: v3[0], v2: v3[1] } },
      }),
      g.number({
        id: 'circle-max', title: t('Maximum on a circle', '圆上的最大值'),
        prompt: t(`Find the point (x, y) on the circle x² + y² = ${R4} where f(x, y) = ${f4} has its largest value. (Here g(x, y) = x² + y².)`,
          `在圆 x² + y² = ${R4} 上求使 f(x, y) = ${f4} 取最大值的点 (x, y)。（这里 g(x, y) = x² + y²。）`),
        fields: [{ label: t('x', 'x'), answer: x4 }, { label: t('y', 'y'), answer: y4 }],
        hint: t('∇f = λ∇g gives two equations, one for x and one for y. Solve both for x and y in terms of λ, then use the constraint to find λ. Two points qualify; pick the one where f is larger.', '∇f = λ∇g 给出两个方程，分别对应 x 与 y。用 λ 表示 x、y，再用约束求 λ。有两个点满足条件，取 f 较大的那个。'),
        explanation: t(`∇f = (${num(p4)}, ${num(q4)}) = λ(2x, 2y) gives x = ${num(p4)}/(2λ) and y = ${num(q4)}/(2λ). Then x² + y² = ${R4} gives ${p4 * p4 + q4 * q4}/(4λ²) = ${R4}, so 4λ² = ${pm * pm} and λ = ±${frac(pm, 2)}. For λ = ${frac(pm, 2)} we get (x, y) = ${vec(x4, y4)}, where f = ${num(p4 * x4 + q4 * y4)}; for λ = −${frac(pm, 2)} we get ${vec(-x4, -y4)}, where f = ${num(-(p4 * x4 + q4 * y4))}. The larger value is at ${vec(x4, y4)}.`,
          `∇f = (${num(p4)}, ${num(q4)}) = λ(2x, 2y)，得 x = ${num(p4)}/(2λ)，y = ${num(q4)}/(2λ)。代入 x² + y² = ${R4}：${p4 * p4 + q4 * q4}/(4λ²) = ${R4}，所以 4λ² = ${pm * pm}，λ = ±${frac(pm, 2)}。λ = ${frac(pm, 2)} 时 (x, y) = ${vec(x4, y4)}，f = ${num(p4 * x4 + q4 * y4)}；λ = −${frac(pm, 2)} 时为 ${vec(-x4, -y4)}，f = ${num(-(p4 * x4 + q4 * y4))}。较大的值在 ${vec(x4, y4)}。`),
        audit: { kind: 'MIT-MV-27:circle-max', params: { p: p4, q: q4, R: R4 } },
      }),
      g.number({
        id: 'rectangle', title: t('The rectangle of largest area', '面积最大的矩形'),
        prompt: t(`A rectangle in the first quadrant has one corner at the origin O and two sides on the axes. The opposite corner P = (x, y) lies on the line ${L5} = ${c5}. Use Lagrange multipliers to find the point P for which the area f(x, y) = xy is largest.`,
          `第一象限内的一个矩形有一个顶点在原点 O，两条边在坐标轴上。对角顶点 P = (x, y) 在直线 ${L5} = ${c5} 上。用拉格朗日乘数法求使面积 f(x, y) = xy 最大的点 P。`),
        fields: [{ label: t('x', 'x'), answer: x5 }, { label: t('y', 'y'), answer: y5 }],
        hint: t('Take f = xy and g = the left-hand side of the line. ∇f = λ∇g gives one equation for x and one for y; combine them with the constraint.', '取 f = xy，g 为直线方程的左边。∇f = λ∇g 给出关于 x 与 y 的两个方程，再与约束联立。'),
        explanation: t(`∇f = (y, x) and ∇g = (${a5}, ${b5}). So y = ${coef(a5, 'λ')} and x = ${coef(b5, 'λ')}. The constraint ${L5} = ${c5} becomes ${2 * a5 * b5}λ = ${c5}, so λ = ${frac(c5, 2 * a5 * b5)} and P = (${num(x5)}, ${num(y5)}).`,
          `∇f = (y, x)，∇g = (${a5}, ${b5})。所以 y = ${coef(a5, 'λ')}，x = ${coef(b5, 'λ')}。约束 ${L5} = ${c5} 变为 ${2 * a5 * b5}λ = ${c5}，所以 λ = ${frac(c5, 2 * a5 * b5)}，P = (${num(x5)}, ${num(y5)})。`),
        audit: { kind: 'MIT-MV-27:rectangle', params: { a: a5, b: b5, c: c5 } },
      }),
      g.choice({
        id: 'why-maximum', title: t('Why is it a maximum?', '为什么它是最大值？'),
        prompt: t(`The Lagrange equations for the area f(x, y) = xy on the segment ${L6} = ${c6} (x ≥ 0, y ≥ 0) have the single solution P = (${X6 / 2}, ${Y6 / 2}), where f = ${area6}. The segment runs from (${X6}, 0) to (0, ${Y6}). How do you know that P gives the maximum area, not the minimum?`,
          `面积 f(x, y) = xy 在线段 ${L6} = ${c6}（x ≥ 0，y ≥ 0）上的拉格朗日方程只有一个解 P = (${X6 / 2}, ${Y6 / 2})，在该点 f = ${area6}。线段从 (${X6}, 0) 到 (0, ${Y6})。你如何知道 P 给出的是最大面积而不是最小面积？`),
        options: [
          t(`A maximum occurs at a critical point or at an endpoint of the segment. At both endpoints the area is 0, which is less than ${area6}, so the critical point P gives the maximum.`, `最大值出现在临界点或线段的端点。两个端点处面积都是 0，小于 ${area6}，所以临界点 P 给出最大值。`),
          t(`Because ∇f = λ∇g holds at P, and the Lagrange condition singles out maxima rather than minima, so no further check is needed.`, `因为 P 满足 ∇f = λ∇g，而拉格朗日条件挑出的是最大值而不是最小值，所以不需要进一步检验。`),
          t(`Because P is the only critical point on the segment, and a maximum must exist somewhere, so it has to be at P, whatever the endpoints are.`, `因为 P 是线段上唯一的临界点，而最大值一定存在，所以不论端点如何，它必定在 P。`),
        ], correct: 0,
        hint: t('The Lagrange condition finds candidates only. The maximum of a continuous function on a segment is at a critical point or at an endpoint: compare f there.', '拉格朗日条件只给出候选点。连续函数在线段上的最大值出现在临界点或端点，比较 f 在这些点的值。'),
        explanation: t(`The only candidates are the critical point P (f = ${area6}) and the endpoints (${X6}, 0) and (0, ${Y6}) (f = 0 at both). The largest value among these is ${area6}, at P, so P is the maximum. Having ∇f = λ∇g at P, or being the only critical point, does not by itself exclude an endpoint with a larger value; it is the comparison that settles it.`,
          `候选点只有临界点 P（f = ${area6}）和两个端点 (${X6}, 0)、(0, ${Y6})（两处 f 都等于 0）。这些值中最大的是 P 处的 ${area6}，所以 P 是最大值点。仅有 ∇f = λ∇g，或者 P 是唯一临界点，并不能排除端点处有更大的值；必须通过比较来确定。`),
      }),
      g.choice({
        id: 'proof-geometric', title: t('Why ∇f ∥ ∇g: the picture', '为什么 ∇f ∥ ∇g：看图'),
        prompt: t(`The circle g(x, y) = x² + y² = ${R7} is the constraint. The straight lines are level curves of f(x, y) = ${linear([p7, q7], ['x', 'y'])} at the values f = ${levels7[0]}, f = ${levels7[1]} and f = ${levels7[2]}. The line f = ${levels7[0]} misses the circle, the line f = ${levels7[2]} cuts it in two points, and the line f = ${levels7[1]} touches it at one point P, where ∇f and ∇g are drawn. Which statement explains why ∇f and ∇g must lie along the same line at P?`,
          `圆 g(x, y) = x² + y² = ${R7} 是约束。图中的直线是 f(x, y) = ${linear([p7, q7], ['x', 'y'])} 在 f = ${levels7[0]}、f = ${levels7[1]} 与 f = ${levels7[2]} 时的等高线。直线 f = ${levels7[0]} 与圆不相交，直线 f = ${levels7[2]} 与圆交于两点，直线 f = ${levels7[1]} 与圆只在一点 P 相切，在 P 处画出了 ∇f 与 ∇g。下面哪个说法解释了为什么在 P 处 ∇f 与 ∇g 必在同一条直线上？`),
        figure: g.figure({
          alt: t(`A circle centred at the origin and three parallel straight lines labelled f = ${levels7[0]}, f = ${levels7[1]} and f = ${levels7[2]}. One line misses the circle, one cuts it, and one touches it at the point P. At P two arrows ∇g and ∇f point in the same direction, away from the origin.`,
            `一个以原点为圆心的圆和三条平行直线，分别标为 f = ${levels7[0]}、f = ${levels7[1]}、f = ${levels7[2]}。一条直线与圆不相交，一条与圆相交，一条在点 P 与圆相切。在 P 处，箭头 ∇g 与 ∇f 指向同一方向，远离原点。`),
          view: { xmin: -box7, xmax: box7, ymin: -box7, ymax: box7 }, shapes: shapes7,
          caption: t('Level lines of f and the constraint circle', 'f 的等高线与约束圆'),
        }),
        options: [
          t('The level line and the circle are tangent at P. ∇f is perpendicular to its level line and ∇g to the circle, so both are perpendicular to the same tangent line.', '等高线与圆在 P 相切。∇f 垂直于它的等高线，∇g 垂直于圆，所以两者都垂直于同一条切线。'),
          t('The level line crosses the circle at P at a right angle. ∇f is perpendicular to its level line, so ∇f must be perpendicular to ∇g there.', '等高线在 P 与圆成直角相交。∇f 垂直于它的等高线，所以在那里 ∇f 必与 ∇g 垂直。'),
          t('At the highest point of f on the circle the gradient ∇f is the zero vector, and the zero vector is parallel to every vector, including ∇g.', '在 f 于圆上的最高点，梯度 ∇f 是零向量，而零向量与任何向量（包括 ∇g）平行。'),
        ], correct: 0,
        hint: t('Moving along the circle away from P lands on level lines with smaller f. What does that say about how the level line and the circle meet? Then recall which curve each gradient is perpendicular to.', '沿圆离开 P 会落到 f 更小的等高线上。这说明等高线与圆如何相接？再想想每个梯度分别垂直于哪条曲线。'),
        explanation: t(`Start at the level line f = ${levels7[0]}, which misses the circle, and lower f until the line first touches the circle at P. Moving away from P along the circle in either direction lands on level lines with smaller f, so P is a maximum of f on the circle, and the level line and the circle are tangent. ∇f is perpendicular to the level line and ∇g to the circle, so both are perpendicular to the common tangent line: ∇f = λ∇g. Here ∇f = ${vec(p7, q7)} is not the zero vector, and the two curves are tangent rather than perpendicular.`,
          `从与圆不相交的等高线 f = ${levels7[0]} 出发，降低 f，直到直线第一次与圆在 P 相切。沿圆向任一方向离开 P，都会落到 f 更小的等高线上，所以 P 是 f 在圆上的最大值点，并且等高线与圆相切。∇f 垂直于等高线，∇g 垂直于圆，所以两者都垂直于公共切线：∇f = λ∇g。这里 ∇f = ${vec(p7, q7)} 不是零向量，并且两条曲线是相切而不是垂直。`),
      }),
      g.symbols({
        id: 'proof-chain', title: t('The analytic proof, step by step', '解析证明，一步一步'),
        prompt: t('Let r(t) be any curve on the constraint curve with r(0) = P, and put h(t) = f(r(t)). If f has a maximum at P on the constraint, then h has a maximum at t = 0, so h′(0) = 0. By the chain rule in vector form, h′(0) is a dot product. Complete it. Then ∇f(P) is perpendicular to every curve through P on the constraint.',
          '设 r(t) 是约束曲线上满足 r(0) = P 的任意曲线，并令 h(t) = f(r(t))。若 f 在约束上于 P 取最大值，则 h 在 t = 0 取最大值，所以 h′(0) = 0。由向量形式的链式法则，h′(0) 是一个点积。请补全。于是 ∇f(P) 垂直于约束上过 P 的每一条曲线。'),
        before: 'h′(0) =', between: [' ', ' '], after: ' = 0', answers: ['∇f(P)', '·', 'r′(0)'], tokens: ['∇f(P)', '·', 'r′(0)', '×', '∇g(P)', 'r(0)'],
        hint: t('The chain rule for h(t) = f(x(t), y(t)) gives h′ = f_x x′ + f_y y′ = (f_x, f_y) · (x′, y′).', '对 h(t) = f(x(t), y(t))，链式法则给出 h′ = f_x x′ + f_y y′ = (f_x, f_y) · (x′, y′)。'),
        explanation: t('h′(0) = ∇f(P) · r′(0) = 0. The vector r′(0) is tangent to the constraint at P, and this holds for every such curve, so ∇f(P) is perpendicular to the constraint curve (or surface). ∇g(P) is perpendicular to it as well, hence ∇f(P) is parallel to ∇g(P).',
          'h′(0) = ∇f(P) · r′(0) = 0。向量 r′(0) 是约束在 P 处的切向量，对每条这样的曲线都成立，所以 ∇f(P) 垂直于约束曲线（或曲面）。∇g(P) 也垂直于它，因此 ∇f(P) 平行于 ∇g(P)。'),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Find the maximum and the minimum value of f(x, y) = ${f9} on the unit circle x² + y² = 1. Enter each value as a fraction or as a decimal to 2 places.`,
          `求 f(x, y) = ${f9} 在单位圆 x² + y² = 1 上的最大值与最小值。每个值用分数或保留 2 位小数的小数输入。`),
        fields: [{ label: t('maximum', '最大值'), answer: max9, tolerance: 0.005 }, { label: t('minimum', '最小值'), answer: min9, tolerance: 0.005 }],
        hint: t('f_x = λg_x and f_y = λg_y. The y-equation gives y = 0 or a value of λ; follow both cases, then compare f at all the critical points.', 'f_x = λg_x 且 f_y = λg_y。y 方程给出 y = 0 或 λ 的某个值；两种情形都要讨论，最后比较 f 在所有临界点的值。'),
        explanation: t(`∇f = (${affine(2, 0, k9)}, ${coef(2 * m9, 'y')}) = λ(2x, 2y). The y-equation ${coef(2 * m9, 'y')} = ${coef(2, 'λ')}y gives y = 0 or λ = ${m9}. If y = 0 the constraint gives x = ±1, with f(1, 0) = ${num(1 + k9)} and f(−1, 0) = ${num(1 - k9)}. If λ = ${m9} the x-equation ${affine(2, 0, k9)} = ${2 * m9}x gives x = ${frac(k9, 2 * (m9 - 1))}, then y² = 1 − x² and f = ${frac(4 * (m9 - 1) * m9 + k9 * k9, 4 * (m9 - 1))}. Maximum ${frac(4 * (m9 - 1) * m9 + k9 * k9, 4 * (m9 - 1))}, minimum ${num(min9)}. You practised the two-case solution of a Lagrange system on a circle; constraints with boundary points or three variables are not assessed here.`,
          `∇f = (${affine(2, 0, k9)}, ${coef(2 * m9, 'y')}) = λ(2x, 2y)。y 方程 ${coef(2 * m9, 'y')} = ${coef(2, 'λ')}y 给出 y = 0 或 λ = ${m9}。若 y = 0，约束给出 x = ±1，f(1, 0) = ${num(1 + k9)}，f(−1, 0) = ${num(1 - k9)}。若 λ = ${m9}，x 方程 ${affine(2, 0, k9)} = ${2 * m9}x 给出 x = ${frac(k9, 2 * (m9 - 1))}，再由 y² = 1 − x² 得 f = ${frac(4 * (m9 - 1) * m9 + k9 * k9, 4 * (m9 - 1))}。最大值 ${frac(4 * (m9 - 1) * m9 + k9 * k9, 4 * (m9 - 1))}，最小值 ${num(min9)}。本游戏练习的是圆上拉格朗日方程组的分情形求解；带边界点的约束和三个变量的情形不在考查范围内。`),
        audit: { kind: 'MIT-MV-27:challenge', params: { m: m9, k: k9 } },
      }),
    ];
  },
  // ================================================================================================
  'MIT-MV-28': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-28');
    warm(g);
    // The drawer: two sides (each yz) cost s, back (xz) costs b, front (xz) costs f, bottom (xy) costs m.
    const S = retry(() => {
      const s = g.random(1, 3), b = g.random(1, 4), f = g.random(1, 4), m = g.random(1, 3), tt = g.pick([1, 1, 2]);
      const al = 2 * s, be = b + f, ga = m;
      return { s, b, f, m, tt, al, be, ga, B: 3 * al * be * ga * tt * tt };
    }, r => new Set([r.al, r.be, r.ga]).size === 3 && r.B <= 400);
    const { s, b, f, m, tt, al, be, ga, B } = S;
    const Ct = linear([al, be, ga], ['yz', 'xz', 'xy']);
    const X = al * tt, Y = be * tt, Z = ga * tt;
    const over = (c: number, v: string) => (c === 1 ? `1/${v}` : `${c}/${v}`);
    const eq1 = `yz = λ(${linear([ga, be], ['y', 'z'])})`, eq2 = `xz = λ(${linear([ga, al], ['x', 'z'])})`, eq3 = `xy = λ(${linear([al, be], ['y', 'x'])})`;

    // 2. gradient of the cost at a point
    const x0 = g.random(1, 4), y0 = g.random(1, 4), z0 = g.random(1, 4);
    const Cx = be * z0 + ga * y0, Cy = al * z0 + ga * x0, Cz = al * y0 + be * x0;

    // 8. which box is a Lagrange critical point
    const bx1 = [X, Y, Z], bx2 = [2 * X, 2 * Y, 2 * Z], bx3 = [Y, X, Z];
    const cost = (v: number[]) => al * v[1] * v[2] + be * v[0] * v[2] + ga * v[0] * v[1];

    // 9. challenge: a linear budget
    const H = retry(() => ({ a: g.random(1, 3), b: g.random(1, 3), c: g.random(1, 3), t: g.pick([1, 1, 2]) }), r => !(r.a === r.b && r.b === r.c) && 3 * r.a * r.b * r.c * r.t <= 120);
    const dH = 3 * H.a * H.b * H.c * H.t;
    const xH = H.b * H.c * H.t, yH = H.a * H.c * H.t, zH = H.a * H.b * H.t;

    return [
      g.number({
        id: 'cost', title: t('The cost function', '成本函数'),
        prompt: t(`An open-top drawer has width x (the front and the back), depth y (the two sides) and height z. Wood costs ${s} per unit area for each of the two sides, ${b} for the back, ${f} for the front and ${m} for the bottom. The total cost is C(x, y, z) = α·yz + β·xz + γ·xy. Find α, β and γ.`,
          `一个无盖抽屉的宽为 x（前面和后面），深为 y（两个侧面），高为 z。两个侧面每单位面积的木料价格都是 ${s}，后面是 ${b}，前面是 ${f}，底面是 ${m}。总成本为 C(x, y, z) = α·yz + β·xz + γ·xy。求 α、β、γ。`),
        fields: [{ label: t('α', 'α'), answer: al }, { label: t('β', 'β'), answer: be }, { label: t('γ', 'γ'), answer: ga }],
        hint: t('Each side has area yz, the front and the back have area xz, the bottom has area xy. Add up price × area for the faces with the same area.', '每个侧面的面积是 yz，前面和后面的面积是 xz，底面的面积是 xy。把面积相同的面的 单价 × 面积 加起来。'),
        explanation: t(`The two sides: 2·${s}·yz = ${al}yz, so α = ${al}. The back and the front: (${b} + ${f})xz = ${be}xz, so β = ${be}. The bottom: ${coef(ga, 'xy')}, so γ = ${ga}. Hence C = ${Ct}.`,
          `两个侧面：2·${s}·yz = ${al}yz，所以 α = ${al}。后面与前面：(${b} + ${f})xz = ${be}xz，所以 β = ${be}。底面：${coef(ga, 'xy')}，所以 γ = ${ga}。于是 C = ${Ct}。`),
        audit: { kind: 'MIT-MV-28:cost-coefficients', params: { s, b, f, m } },
      }),
      g.number({
        id: 'cost-gradient', title: t('The gradient of the cost', '成本的梯度'),
        prompt: t(`The cost of a drawer is C(x, y, z) = ${Ct}. Find the three partial derivatives C_x, C_y and C_z at (x, y, z) = ${vec(x0, y0, z0)}.`,
          `抽屉的成本为 C(x, y, z) = ${Ct}。求偏导数 C_x、C_y、C_z 在 (x, y, z) = ${vec(x0, y0, z0)} 处的值。`),
        fields: [{ label: t('C_x', 'C_x'), answer: Cx }, { label: t('C_y', 'C_y'), answer: Cy }, { label: t('C_z', 'C_z'), answer: Cz }],
        hint: t('Differentiate in one variable at a time, treating the other two as constants. Substitute the point at the end.', '每次只对一个变量求导，把另外两个当作常数。最后代入这一点。'),
        explanation: t(`C_x = ${linear([ga, be], ['y', 'z'])} = ${evalAffine(ga, be, 0, y0, z0)} = ${num(Cx)}. C_y = ${linear([ga, al], ['x', 'z'])} = ${evalAffine(ga, al, 0, x0, z0)} = ${num(Cy)}. C_z = ${linear([al, be], ['y', 'x'])} = ${evalAffine(al, be, 0, y0, x0)} = ${num(Cz)}. So ∇C = ${vec(Cx, Cy, Cz)} at this point, and ∇V = (yz, xz, xy) is the gradient of the volume V = xyz.`,
          `C_x = ${linear([ga, be], ['y', 'z'])} = ${evalAffine(ga, be, 0, y0, z0)} = ${num(Cx)}。C_y = ${linear([ga, al], ['x', 'z'])} = ${evalAffine(ga, al, 0, x0, z0)} = ${num(Cy)}。C_z = ${linear([al, be], ['y', 'x'])} = ${evalAffine(al, be, 0, y0, x0)} = ${num(Cz)}。所以在这一点 ∇C = ${vec(Cx, Cy, Cz)}，而 ∇V = (yz, xz, xy) 是体积 V = xyz 的梯度。`),
        audit: { kind: 'MIT-MV-28:cost-gradient', params: { alpha: al, beta: be, gamma: ga, x0, y0, z0 } },
      }),
      g.choice({
        id: 'which-system', title: t('Which system do we solve?', '要解哪个方程组？'),
        prompt: t(`We want the drawer of largest volume V = xyz that can be made for a budget of B = ${B}, where the cost is C(x, y, z) = ${Ct}. Which conditions define the Lagrange critical points?`,
          `我们要在预算 B = ${B} 内做出体积 V = xyz 最大的抽屉，其中成本为 C(x, y, z) = ${Ct}。哪组条件确定拉格朗日临界点？`),
        options: [
          t(`∇V = λ∇C and C = ${B}`, `∇V = λ∇C 且 C = ${B}`),
          t(`∇V = λ∇C and V = ${B}`, `∇V = λ∇C 且 V = ${B}`),
          t(`∇V = 0 and C = ${B}`, `∇V = 0 且 C = ${B}`),
        ], correct: 0,
        hint: t('The quantity being maximised is V. The budget is the constraint, and it restricts C, not V.', '被最大化的量是 V。预算是约束，它限制的是 C 而不是 V。'),
        explanation: t(`The objective is V = xyz and the constraint is the budget C = ${B}, so the conditions are ∇V = λ∇C together with C = ${B}. Putting V = ${B} would constrain the volume instead of the cost, and ∇V = 0 ignores the constraint (V has no critical point with x, y, z > 0).`,
          `目标函数是 V = xyz，约束是预算 C = ${B}，所以条件是 ∇V = λ∇C 与 C = ${B}。写成 V = ${B} 是在限制体积而不是成本；∇V = 0 忽略了约束（V 在 x、y、z > 0 时没有临界点）。`),
      }),
      g.number({
        id: 'ratios', title: t('Solving the equations symmetrically', '对称地解方程'),
        prompt: t(`For C = ${Ct} the equation ∇V = λ∇C reads ${eq1}, ${eq2} and ${eq3}. Solve each equation for 1/λ and compare them to find y/x and z/x (all of x, y, z are positive). Enter each ratio as a fraction or a decimal to 2 places.`,
          `对于 C = ${Ct}，方程 ∇V = λ∇C 为 ${eq1}、${eq2} 与 ${eq3}。从每个方程解出 1/λ 并比较，求 y/x 与 z/x（x、y、z 都为正）。每个比值用分数或保留 2 位小数的小数输入。`),
        fields: [{ label: t('y/x', 'y/x'), answer: be / al, tolerance: 0.005 }, { label: t('z/x', 'z/x'), answer: ga / al, tolerance: 0.005 }],
        hint: t(`Divide each equation by its left-hand side: for instance 1/λ = (${linear([ga, be], ['y', 'z'])})/(yz) = ${over(be, 'y')} + ${over(ga, 'z')}. Then equate two of the three expressions at a time.`, `把每个方程除以它的左边：例如 1/λ = (${linear([ga, be], ['y', 'z'])})/(yz) = ${over(be, 'y')} + ${over(ga, 'z')}。然后每次让三个式子中的两个相等。`),
        explanation: t(`1/λ = ${over(be, 'y')} + ${over(ga, 'z')} = ${over(al, 'x')} + ${over(ga, 'z')} = ${over(al, 'x')} + ${over(be, 'y')}. The first two give ${over(be, 'y')} = ${over(al, 'x')}, so y/x = ${frac(be, al)}. The first and the last give ${over(ga, 'z')} = ${over(al, 'x')}, so z/x = ${frac(ga, al)}. Thus x : y : z = ${al} : ${be} : ${ga}.`,
          `1/λ = ${over(be, 'y')} + ${over(ga, 'z')} = ${over(al, 'x')} + ${over(ga, 'z')} = ${over(al, 'x')} + ${over(be, 'y')}。前两个给出 ${over(be, 'y')} = ${over(al, 'x')}，所以 y/x = ${frac(be, al)}。第一个与最后一个给出 ${over(ga, 'z')} = ${over(al, 'x')}，所以 z/x = ${frac(ga, al)}。于是 x : y : z = ${al} : ${be} : ${ga}。`),
        audit: { kind: 'MIT-MV-28:ratios', params: { alpha: al, beta: be, gamma: ga } },
      }),
      g.number({
        id: 'dimensions', title: t('Use the budget', '用预算求尺寸'),
        prompt: t(`At the critical point the dimensions satisfy x : y : z = ${al} : ${be} : ${ga}, and the cost is C(x, y, z) = ${Ct} = ${B}. Find x, y and z.`,
          `在临界点处尺寸满足 x : y : z = ${al} : ${be} : ${ga}，且成本为 C(x, y, z) = ${Ct} = ${B}。求 x、y、z。`),
        fields: [{ label: t('x', 'x'), answer: X }, { label: t('y', 'y'), answer: Y }, { label: t('z', 'z'), answer: Z }],
        hint: t(`Write x = ${coef(al, 't')}, y = ${coef(be, 't')}, z = ${coef(ga, 't')}, substitute into C = ${B}, and solve for t (take t > 0).`, `令 x = ${coef(al, 't')}，y = ${coef(be, 't')}，z = ${coef(ga, 't')}，代入 C = ${B} 解出 t（取 t > 0）。`),
        explanation: t(`With x = ${coef(al, 't')}, y = ${coef(be, 't')}, z = ${coef(ga, 't')}, each of the three terms of C equals ${al * be * ga}t² (for example ${coef(al, 'yz')} becomes ${al}·${coef(be, 't')}·${coef(ga, 't')}), so C = ${3 * al * be * ga}t² = ${B}. Hence t² = ${tt * tt}, t = ${tt}, and (x, y, z) = ${vec(X, Y, Z)}.`,
          `令 x = ${coef(al, 't')}，y = ${coef(be, 't')}，z = ${coef(ga, 't')}：C 的三项都等于 ${al * be * ga}t²（例如 ${coef(al, 'yz')} 变为 ${al}·${coef(be, 't')}·${coef(ga, 't')}），所以 C = ${3 * al * be * ga}t² = ${B}。于是 t² = ${tt * tt}，t = ${tt}，(x, y, z) = ${vec(X, Y, Z)}。`),
        audit: { kind: 'MIT-MV-28:dimensions', params: { alpha: al, beta: be, gamma: ga, B } },
      }),
      g.number({
        id: 'lambda', title: t('The value of λ', 'λ 的值'),
        prompt: t(`For C = ${Ct} the equations ∇V = λ∇C are ${eq1}, ${eq2} and ${eq3}. They hold at the critical point (x, y, z) = ${vec(X, Y, Z)}. Find λ (a fraction such as 1/2 is fine).`,
          `对于 C = ${Ct}，方程 ∇V = λ∇C 为 ${eq1}、${eq2} 与 ${eq3}。它们在临界点 (x, y, z) = ${vec(X, Y, Z)} 成立。求 λ（可以输入 1/2 这样的分数）。`),
        fields: [{ label: t('λ', 'λ'), answer: (Y * Z) / (ga * Y + be * Z) }],
        hint: t('Substitute the point into one of the three equations and solve for λ. The other two must give the same value.', '把这一点代入三个方程之一，解出 λ。另外两个方程必须给出同一个值。'),
        explanation: t(`From the first equation: ${Y * Z} = λ(${evalAffine(ga, be, 0, Y, Z)}) = ${num(ga * Y + be * Z)}λ, so λ = ${frac(Y * Z, ga * Y + be * Z)}. The second equation gives ${X * Z} = λ(${evalAffine(ga, al, 0, X, Z)}) = ${num(ga * X + al * Z)}λ, the same λ = ${frac(X * Z, ga * X + al * Z)}.`,
          `由第一个方程：${Y * Z} = λ(${evalAffine(ga, be, 0, Y, Z)}) = ${num(ga * Y + be * Z)}λ，所以 λ = ${frac(Y * Z, ga * Y + be * Z)}。第二个方程给出 ${X * Z} = λ(${evalAffine(ga, al, 0, X, Z)}) = ${num(ga * X + al * Z)}λ，同样 λ = ${frac(X * Z, ga * X + al * Z)}。`),
        audit: { kind: 'MIT-MV-28:lambda', params: { alpha: al, beta: be, gamma: ga, x0: X, y0: Y, z0: Z } },
      }),
      g.choice({
        id: 'why-max', title: t('Why is this the largest volume?', '为什么这是最大体积？'),
        prompt: t(`For the budget C = ${Ct} = ${B} there is exactly one critical point with x, y, z > 0, namely ${vec(X, Y, Z)}, with V = ${X * Y * Z}. How do you know it gives the largest volume and not a smaller one?`,
          `对于预算 C = ${Ct} = ${B}，在 x、y、z > 0 内恰有一个临界点 ${vec(X, Y, Z)}，此处 V = ${X * Y * Z}。你如何知道它给出的是最大体积而不是较小的体积？`),
        options: [
          t(`Near the edge of the allowed region one dimension is close to 0, and then V = xyz is close to 0 (for example ${coef(al, 'yz')} ≤ ${B} gives yz ≤ ${B / al}). Since V is positive at the critical point, it is the maximum.`, `在允许区域的边缘附近，某个尺寸接近 0，此时 V = xyz 接近 0（例如 ${coef(al, 'yz')} ≤ ${B} 给出 yz ≤ ${B / al}）。V 在临界点为正，所以它就是最大值。`),
          t(`The Lagrange equations ∇V = λ∇C hold there, and these equations always pick out a maximum of the objective function rather than a minimum, so nothing more needs to be checked.`, `那里满足拉格朗日方程 ∇V = λ∇C，而这些方程总是挑出目标函数的最大值而不是最小值，所以不需要再检验什么。`),
          t(`The multiplier λ = ${frac(tt, 2)} is positive at the critical point, and a positive multiplier always means that the critical point is a maximum, so nothing more needs to be checked.`, `在临界点乘数 λ = ${frac(tt, 2)} 为正，而正的乘数总是表示该临界点是最大值点，所以不需要再检验什么。`),
        ], correct: 0,
        hint: t('A maximum occurs at a critical point or near the boundary of the allowed region. Look at what V does near the boundary.', '最大值出现在临界点或允许区域的边界附近。看看 V 在边界附近的取值。'),
        explanation: t(`Each product such as yz is bounded by the budget (${coef(al, 'yz')} ≤ C = ${B}, so yz ≤ ${B / al}), so when x tends to 0 the volume V = x·yz tends to 0, and the same holds for y and z. The volume at the critical point is ${X * Y * Z} > 0, larger than the values near the boundary, so the critical point is the maximum. A sign of λ or the equation ∇V = λ∇C alone does not show whether a critical point is a maximum or a minimum.`,
          `每个乘积如 yz 都受预算限制（${coef(al, 'yz')} ≤ C = ${B}，所以 yz ≤ ${B / al}），所以当 x 趋于 0 时体积 V = x·yz 趋于 0，y 与 z 同理。临界点处的体积是 ${X * Y * Z} > 0，大于边界附近的值，所以该临界点是最大值点。λ 的符号或单靠方程 ∇V = λ∇C 并不能说明临界点是最大值点还是最小值点。`),
      }),
      g.choice({
        id: 'which-box', title: t('Check both conditions', '两个条件都要检验'),
        prompt: t(`For the cost C = ${Ct} and the budget B = ${B}, a box (x, y, z) is a Lagrange critical point if ∇V = λ∇C and C = ${B}. Which of these boxes is a critical point?`,
          `对于成本 C = ${Ct} 和预算 B = ${B}，若 ∇V = λ∇C 且 C = ${B}，则盒子 (x, y, z) 是拉格朗日临界点。下面哪个盒子是临界点？`),
        options: [t(`(x, y, z) = ${vec(...bx1)}`, `(x, y, z) = ${vec(...bx1)}`), t(`(x, y, z) = ${vec(...bx2)}`, `(x, y, z) = ${vec(...bx2)}`), t(`(x, y, z) = ${vec(...bx3)}`, `(x, y, z) = ${vec(...bx3)}`)], correct: 0,
        hint: t(`Two things must hold: the shape must satisfy x : y : z = ${al} : ${be} : ${ga}, and the cost must equal ${B}. Compute C for each box.`, `必须同时满足两件事：形状满足 x : y : z = ${al} : ${be} : ${ga}，并且成本等于 ${B}。算出每个盒子的 C。`),
        explanation: t(`${vec(...bx1)} has the right shape x : y : z = ${al} : ${be} : ${ga} and costs C = ${cost(bx1)}, exactly the budget. ${vec(...bx2)} has the same shape, so ∇V is parallel to ∇C, but it costs ${cost(bx2)}, four times the budget. ${vec(...bx3)} costs ${cost(bx3)} and has the wrong shape. Both conditions are needed: the multiplier equations fix the shape, and the budget fixes the size.`,
          `${vec(...bx1)} 的形状满足 x : y : z = ${al} : ${be} : ${ga}，且成本 C = ${cost(bx1)}，正好等于预算。${vec(...bx2)} 的形状相同，所以 ∇V 平行于 ∇C，但它的成本是 ${cost(bx2)}，是预算的 4 倍。${vec(...bx3)} 的成本是 ${cost(bx3)}，形状也不对。两个条件缺一不可：乘数方程决定形状，预算决定大小。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`Use Lagrange multipliers to find the point (x, y, z) with x, y, z > 0 at which V = xyz is largest subject to the constraint ${linear([H.a, H.b, H.c], ['x', 'y', 'z'])} = ${dH}.`,
          `用拉格朗日乘数法，在约束 ${linear([H.a, H.b, H.c], ['x', 'y', 'z'])} = ${dH} 下，求 x、y、z > 0 时使 V = xyz 最大的点 (x, y, z)。`),
        fields: [{ label: t('x', 'x'), answer: xH }, { label: t('y', 'y'), answer: yH }, { label: t('z', 'z'), answer: zH }],
        hint: t(`∇V = (yz, xz, xy) = λ${vec(H.a, H.b, H.c)}. Multiply the three equations by x, y and z respectively and compare the results.`, `∇V = (yz, xz, xy) = λ${vec(H.a, H.b, H.c)}。把三个方程分别乘以 x、y、z，再比较结果。`),
        explanation: t(`yz = ${coef(H.a, 'λ')}, xz = ${coef(H.b, 'λ')}, xy = ${coef(H.c, 'λ')}. Multiplying by x, y, z gives xyz = ${coef(H.a, 'λ')}x = ${coef(H.b, 'λ')}y = ${coef(H.c, 'λ')}z, so ${coef(H.a, 'x')} = ${coef(H.b, 'y')} = ${coef(H.c, 'z')}. The constraint then says three equal terms add up to ${dH}, so each is ${dH / 3}: x = ${dH / 3 / H.a}, y = ${dH / 3 / H.b}, z = ${dH / 3 / H.c}. You practised setting up and solving a three-variable Lagrange system; checking that the critical point is a maximum, as in the drawer problem, is not assessed here.`,
          `yz = ${coef(H.a, 'λ')}，xz = ${coef(H.b, 'λ')}，xy = ${coef(H.c, 'λ')}。分别乘以 x、y、z 得 xyz = ${coef(H.a, 'λ')}x = ${coef(H.b, 'λ')}y = ${coef(H.c, 'λ')}z，所以 ${coef(H.a, 'x')} = ${coef(H.b, 'y')} = ${coef(H.c, 'z')}。约束说明这三个相等的项之和为 ${dH}，所以每一项都是 ${dH / 3}：x = ${dH / 3 / H.a}，y = ${dH / 3 / H.b}，z = ${dH / 3 / H.c}。本游戏练习的是三变量拉格朗日方程组的建立与求解；像抽屉问题那样验证临界点是最大值点，不在考查范围内。`),
        audit: { kind: 'MIT-MV-28:challenge', params: { a: H.a, b: H.b, c: H.c, d: dH } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-29': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-29');
    warm(g);
    const sqStr = (c: number, v: number) => (c === 1 ? `${par(v)}²` : c === -1 ? `−${par(v)}²` : `${par(c)}·${par(v)}²`);

    // 1. total differential of w = a xy + b yz² + c xz
    const T = retry(() => ({ a: g.nonzero(-3, 3), b: g.nonzero(-3, 3), c: g.nonzero(-3, 3), x0: g.random(-2, 2), y0: g.random(-2, 2), z0: g.random(-2, 2) }),
      r => r.a * r.y0 + r.c * r.z0 !== 0 && r.a * r.x0 + r.b * r.z0 * r.z0 !== 0 && 2 * r.b * r.y0 * r.z0 + r.c * r.x0 !== 0);
    const wx1 = T.a * T.y0 + T.c * T.z0, wy1 = T.a * T.x0 + T.b * T.z0 * T.z0, wz1 = 2 * T.b * T.y0 * T.z0 + T.c * T.x0;

    // 2-6. w = x² + y² + z² with z = a x² + b y²
    const D = retry(() => ({ a: g.pick([1, -1]), b: g.pick([1, -1, 2, -2]), x0: g.pick([1, 2, -1, -2]), y0: g.nonzero(-2, 2) }), r => r.a !== r.b && r.a * r.x0 * r.x0 + r.b * r.y0 * r.y0 !== 0);
    const z0 = D.a * D.x0 * D.x0 + D.b * D.y0 * D.y0;
    const ansXY = 2 * D.x0 * (1 + 2 * D.a * z0), ansXZ = 2 * D.x0 * (1 - D.a / D.b);
    const kk = 2 - 2 * D.a / D.b, yy = divBy(linear([1, -D.a], ['z', 'x²']), D.b);
    const held = g.pick(['y', 'z']);
    const wrtY = g.random(0, 1) === 1, cF = wrtY ? D.b : D.a, vF = wrtY ? 'y' : 'x', heldF = wrtY ? 'x' : 'y';
    const zRel = linear([D.a, D.b], ['x²', 'y²']);
    const pt = `(x, y, z) = ${vec(D.x0, D.y0, z0)}`;
    const nOpts = ['x and y are independent; z is determined by them', 'x and z are independent; y is determined by them', 'y and z are independent; x is determined by them'];
    const nOptsZh = ['x 与 y 是独立变量，z 由它们确定', 'x 与 z 是独立变量，y 由它们确定', 'y 与 z 是独立变量，x 由它们确定'];

    // 7. gradient with a constraint
    const K = retry(() => ({ f1: g.nonzero(-3, 3), f2: g.nonzero(-3, 3), f3: g.nonzero(-3, 3), g1: g.nonzero(-3, 3), g2: g.nonzero(-3, 3), g3: g.pick([1, -1, 2, -2]) }),
      r => r.f1 - r.f3 * r.g1 / r.g3 !== 0 && r.f2 - r.f3 * r.g2 / r.g3 !== 0);
    const kx = K.f1 - K.f3 * K.g1 / K.g3, ky = K.f2 - K.f3 * K.g2 / K.g3;

    // 8. cyclic rule
    const cA = g.pick([-3, -2, -1, 1, 2, 3]), cB = g.pick([-3, -2, -1, 1, 2, 3]);
    const cAns = -1 / (cA * cB);

    // 9. challenge: sphere
    const C = retry(() => {
      const tr = triple(g);
      return { x: tr.v[0], y: tr.v[1], z: tr.v[2], n: tr.n };
    }, r => Math.abs(r.y) !== 8 && Math.abs(r.x) !== Math.abs(r.y));
    const R = C.x * C.x + C.y * C.y + C.z * C.z, cAnsH = C.y - C.x * C.x / C.y;

    return [
      g.number({
        id: 'total-differential', title: t('The total differential', '全微分'),
        prompt: t(`Let w = ${linear([T.a, T.b, T.c], ['xy', 'yz²', 'xz'])}, with x, y, z independent variables. Its total differential is dw = w_x dx + w_y dy + w_z dz. Find w_x, w_y and w_z at (x, y, z) = ${vec(T.x0, T.y0, T.z0)}.`,
          `设 w = ${linear([T.a, T.b, T.c], ['xy', 'yz²', 'xz'])}，其中 x、y、z 是独立变量。它的全微分为 dw = w_x dx + w_y dy + w_z dz。求 w_x、w_y、w_z 在 (x, y, z) = ${vec(T.x0, T.y0, T.z0)} 处的值。`),
        fields: [{ label: t('w_x', 'w_x'), answer: wx1 }, { label: t('w_y', 'w_y'), answer: wy1 }, { label: t('w_z', 'w_z'), answer: wz1 }],
        hint: t('These are the formal partial derivatives: differentiate in one variable and treat the other two as constants.', '这些是形式偏导数：对一个变量求导，把另外两个当作常数。'),
        explanation: t(`w_x = ${linear([T.a, T.c], ['y', 'z'])} = ${evalAffine(T.a, T.c, 0, T.y0, T.z0)} = ${num(wx1)}. w_y = ${linear([T.a, T.b], ['x', 'z²'])} = ${joinTerms([mulStr(T.a, T.x0), sqStr(T.b, T.z0)])} = ${num(wy1)}. w_z = ${linear([2 * T.b, T.c], ['yz', 'x'])} = ${joinTerms([`${par(2 * T.b)}·${par(T.y0)}·${par(T.z0)}`, mulStr(T.c, T.x0)])} = ${num(wz1)}. So dw = ${diffText([wx1, wy1, wz1], ['dx', 'dy', 'dz'])} at this point.`,
          `w_x = ${linear([T.a, T.c], ['y', 'z'])} = ${evalAffine(T.a, T.c, 0, T.y0, T.z0)} = ${num(wx1)}。w_y = ${linear([T.a, T.b], ['x', 'z²'])} = ${joinTerms([mulStr(T.a, T.x0), sqStr(T.b, T.z0)])} = ${num(wy1)}。w_z = ${linear([2 * T.b, T.c], ['yz', 'x'])} = ${joinTerms([`${par(2 * T.b)}·${par(T.y0)}·${par(T.z0)}`, mulStr(T.c, T.x0)])} = ${num(wz1)}。所以在这一点 dw = ${diffText([wx1, wy1, wz1], ['dx', 'dy', 'dz'])}。`),
        audit: { kind: 'MIT-MV-29:total-differential', params: { a: T.a, b: T.b, c: T.c, x0: T.x0, y0: T.y0, z0: T.z0 } },
      }),
      g.choice({
        id: 'notation', title: t('Which variables are independent?', '哪些变量是独立的？'),
        prompt: t(`Let w = x² + y² + z², where x, y, z satisfy z = ${zRel}, so any two of them determine the third. In the symbol (∂w/∂x)_${held}, the variable ${held} is held constant. Which statement describes the independent variables?`,
          `设 w = x² + y² + z²，其中 x、y、z 满足 z = ${zRel}，所以其中任意两个确定第三个。在符号 (∂w/∂x)_${held} 中，变量 ${held} 保持不变。哪个说法描述了独立变量？`),
        options: nOpts.map((o, i) => t(o, nOptsZh[i])), correct: held === 'y' ? 0 : 1,
        hint: t('The two letters in the symbol, the variable in the denominator and the subscript, are the independent variables.', '符号中的两个字母，即分母中的变量与下标，就是独立变量。'),
        explanation: t(`In (∂w/∂x)_${held} the letters x and ${held} name the independent variables: x moves, ${held} is held fixed, and the remaining variable is determined by the relation z = ${zRel}. The same symbol with a different subscript describes a different rate of change.`,
          `在 (∂w/∂x)_${held} 中，字母 x 与 ${held} 指明独立变量：x 变化，${held} 固定，其余变量由关系 z = ${zRel} 确定。下标不同的同一符号描述的是不同的变化率。`),
      }),
      g.number({
        id: 'independent-xy', title: t('x and y independent', 'x、y 为独立变量'),
        prompt: t(`Let w = x² + y² + z² with z = ${zRel}. Take x and y as the independent variables, so z depends on them. Find (∂w/∂x)_y, with y held constant, at ${pt}.`,
          `设 w = x² + y² + z²，其中 z = ${zRel}。取 x、y 为独立变量，z 依赖于它们。求保持 y 不变的 (∂w/∂x)_y 在 ${pt} 处的值。`),
        fields: [{ label: t('(∂w/∂x)_y', '(∂w/∂x)_y'), answer: ansXY }],
        hint: t('w depends on x directly and also through z. With y fixed, find ∂z/∂x from the relation, then add 2x and 2z·∂z/∂x.', 'w 既直接依赖 x，又通过 z 依赖 x。y 固定时，由关系式求出 ∂z/∂x，再把 2x 与 2z·∂z/∂x 相加。'),
        explanation: t(`With x and y independent, (∂z/∂x)_y = ${coef(2 * D.a, 'x')} = ${num(2 * D.a * D.x0)}. By the chain rule (∂w/∂x)_y = 2x + 2z·(∂z/∂x)_y = 2·${par(D.x0)} + 2·${par(z0)}·${par(2 * D.a * D.x0)} = ${num(ansXY)}.`,
          `x、y 独立时，(∂z/∂x)_y = ${coef(2 * D.a, 'x')} = ${num(2 * D.a * D.x0)}。由链式法则 (∂w/∂x)_y = 2x + 2z·(∂z/∂x)_y = 2·${par(D.x0)} + 2·${par(z0)}·${par(2 * D.a * D.x0)} = ${num(ansXY)}。`),
        audit: { kind: 'MIT-MV-29:independent-xy', params: { a: D.a, b: D.b, x0: D.x0, y0: D.y0 } },
      }),
      g.number({
        id: 'independent-xz', title: t('x and z independent', 'x、z 为独立变量'),
        prompt: t(`Same w = x² + y² + z² with z = ${zRel}, at ${pt}. Now take x and z as the independent variables, so y depends on them. Find (∂w/∂x)_z, with z held constant.`,
          `仍取 w = x² + y² + z²，z = ${zRel}，在 ${pt} 处。现在取 x、z 为独立变量，y 依赖于它们。求保持 z 不变的 (∂w/∂x)_z。`),
        fields: [{ label: t('(∂w/∂x)_z', '(∂w/∂x)_z'), answer: ansXZ }],
        hint: t('Solve the relation for y² in terms of x and z, put it into w, and differentiate in x with z constant.', '把关系式解出 y²（用 x、z 表示），代入 w，再在 z 为常数的条件下对 x 求导。'),
        explanation: t(`From the relation y² = ${yy}, so w = ${plus('x²', yy)} + z². With z constant, (∂w/∂x)_z = ${linear([2, -2 * D.a / D.b], ['x', 'x'])} = ${coef(kk, 'x')} = ${mulStr(kk, D.x0)} = ${num(ansXZ)}.`,
          `由关系式 y² = ${yy}，所以 w = ${plus('x²', yy)} + z²。z 为常数时，(∂w/∂x)_z = ${linear([2, -2 * D.a / D.b], ['x', 'x'])} = ${coef(kk, 'x')} = ${mulStr(kk, D.x0)} = ${num(ansXZ)}。`),
        audit: { kind: 'MIT-MV-29:independent-xz', params: { a: D.a, b: D.b, x0: D.x0, y0: D.y0 } },
      }),
      g.choice({
        id: 'same-or-different', title: t('Are the two derivatives equal?', '这两个导数相等吗？'),
        prompt: t(`For w = x² + y² + z² with z = ${zRel} at ${pt}, are (∂w/∂x)_y and (∂w/∂x)_z equal?`,
          `对 w = x² + y² + z²，z = ${zRel}，在 ${pt} 处，(∂w/∂x)_y 与 (∂w/∂x)_z 相等吗？`),
        options: [
          t('No. They measure different rates: moving with y held fixed follows a different path from moving with z held fixed.', '不相等。它们衡量的是不同的变化率：y 固定时的移动路径与 z 固定时的移动路径不同。'),
          t('Yes. Both are the derivative of the same function w with respect to x, so the subscript does not matter.', '相等。两者都是同一个函数 w 对 x 的导数，所以下标无关紧要。'),
          t('Yes, because z is tied to y by the relation, so holding y fixed is the same as holding z fixed.', '相等。因为关系式把 z 与 y 联系在一起，所以固定 y 与固定 z 是一回事。'),
        ], correct: 0,
        hint: t('Compare the two values you computed: when y is fixed the point moves along one path, when z is fixed along another.', '比较你算出的两个值：y 固定时点沿一条路径移动，z 固定时沿另一条路径移动。'),
        explanation: t(`(∂w/∂x)_y = ${num(ansXY)} and (∂w/∂x)_z = ${num(ansXZ)}, which are different. When y is fixed the point moves on the surface z = ${zRel} along a curve where z changes; when z is fixed it moves along a curve where y changes. Without the subscript the symbol ∂w/∂x has no definite meaning.`,
          `(∂w/∂x)_y = ${num(ansXY)}，(∂w/∂x)_z = ${num(ansXZ)}，两者不同。y 固定时，点沿曲面 z = ${zRel} 上 z 变化的曲线移动；z 固定时，沿 y 变化的曲线移动。没有下标时，符号 ∂w/∂x 没有确定的含义。`),
      }),
      g.choice({
        id: 'formal-vs-actual', title: t('Formal or actual partial derivative?', '形式偏导数还是实际偏导数？'),
        prompt: t(`Let w = x² + y² + z² with z = ${zRel}, and take x and y as the independent variables. Which expression is (∂w/∂${vF})_${heldF}, with ${heldF} held constant? (The formal partial derivative w_${vF} = 2${vF} treats z as a constant.)`,
          `设 w = x² + y² + z²，z = ${zRel}，取 x、y 为独立变量。保持 ${heldF} 不变，哪个表达式是 (∂w/∂${vF})_${heldF}？（形式偏导数 w_${vF} = 2${vF} 把 z 当作常数。）`),
        options: [
          t(`2${vF} ${term(4 * cF)}${vF}z`, `2${vF} ${term(4 * cF)}${vF}z`),
          t(`2${vF}`, `2${vF}`),
          t(`2${vF} + 2z`, `2${vF} + 2z`),
          t(coef(4 * cF, `${vF}z`), coef(4 * cF, `${vF}z`)),
        ], correct: 0,
        hint: t(`(∂w/∂${vF})_${heldF} = w_${vF} + w_z·(∂z/∂${vF})_${heldF}. Compute (∂z/∂${vF})_${heldF} from the relation.`, `(∂w/∂${vF})_${heldF} = w_${vF} + w_z·(∂z/∂${vF})_${heldF}。由关系式算出 (∂z/∂${vF})_${heldF}。`),
        explanation: t(`Here w_${vF} = 2${vF}, w_z = 2z and (∂z/∂${vF})_${heldF} = ${coef(2 * cF, vF)}, so (∂w/∂${vF})_${heldF} = 2${vF} + 2z·(${coef(2 * cF, vF)}) = 2${vF} ${term(4 * cF)}${vF}z. The expression 2${vF} is only the formal partial derivative, 2${vF} + 2z forgets the factor (∂z/∂${vF})_${heldF}, and ${coef(4 * cF, `${vF}z`)} leaves out the direct dependence of w on ${vF}.`,
          `这里 w_${vF} = 2${vF}，w_z = 2z，(∂z/∂${vF})_${heldF} = ${coef(2 * cF, vF)}，所以 (∂w/∂${vF})_${heldF} = 2${vF} + 2z·(${coef(2 * cF, vF)}) = 2${vF} ${term(4 * cF)}${vF}z。表达式 2${vF} 只是形式偏导数，2${vF} + 2z 漏了因子 (∂z/∂${vF})_${heldF}，而 ${coef(4 * cF, `${vF}z`)} 漏掉了 w 对 ${vF} 的直接依赖。`),
        audit: { kind: 'MIT-MV-29:formal-vs-actual', params: { a: D.a, b: D.b, wrt: wrtY ? 1 : 0 } },
      }),
      g.number({
        id: 'gradient-with-constraint', title: t('Eliminate dz', '消去 dz'),
        prompt: t(`The variables x, y, z satisfy g(x, y, z) = 0, and w = f(x, y, z). At P, ∇f = ${vec(K.f1, K.f2, K.f3)} and ∇g = ${vec(K.g1, K.g2, K.g3)}. Take x and y as the independent variables (z depends on them through g = 0). Find (∂w/∂x)_y and (∂w/∂y)_x at P. Enter a fraction or a decimal.`,
          `变量 x、y、z 满足 g(x, y, z) = 0，w = f(x, y, z)。在 P 处，∇f = ${vec(K.f1, K.f2, K.f3)}，∇g = ${vec(K.g1, K.g2, K.g3)}。取 x、y 为独立变量（z 通过 g = 0 依赖于它们）。求 (∂w/∂x)_y 与 (∂w/∂y)_x 在 P 处的值。用分数或小数输入。`),
        fields: [{ label: t('(∂w/∂x)_y', '(∂w/∂x)_y'), answer: kx }, { label: t('(∂w/∂y)_x', '(∂w/∂y)_x'), answer: ky }],
        hint: t('Write dw = f_x dx + f_y dy + f_z dz and dg = 0 = g_x dx + g_y dy + g_z dz. Solve the second for dz and substitute into the first.', '写出 dw = f_x dx + f_y dy + f_z dz 与 dg = 0 = g_x dx + g_y dy + g_z dz。由第二个式子解出 dz，代入第一个。'),
        explanation: t(`dw = ${diffText([K.f1, K.f2, K.f3], ['dx', 'dy', 'dz'])} and dg = ${diffText([K.g1, K.g2, K.g3], ['dx', 'dy', 'dz'])} = 0, so dz = ${diffText([-K.g1 / K.g3, -K.g2 / K.g3], ['dx', 'dy'])}. Substituting: dw = (${num(K.f1)} ${term(-K.f3 * K.g1 / K.g3)}) dx + (${num(K.f2)} ${term(-K.f3 * K.g2 / K.g3)}) dy = ${diffText([kx, ky], ['dx', 'dy'])}. Since x and y are independent, the coefficients are the derivatives: (∂w/∂x)_y = ${num(kx)}, (∂w/∂y)_x = ${num(ky)}.`,
          `dw = ${diffText([K.f1, K.f2, K.f3], ['dx', 'dy', 'dz'])}，dg = ${diffText([K.g1, K.g2, K.g3], ['dx', 'dy', 'dz'])} = 0，所以 dz = ${diffText([-K.g1 / K.g3, -K.g2 / K.g3], ['dx', 'dy'])}。代入得 dw = (${num(K.f1)} ${term(-K.f3 * K.g1 / K.g3)}) dx + (${num(K.f2)} ${term(-K.f3 * K.g2 / K.g3)}) dy = ${diffText([kx, ky], ['dx', 'dy'])}。因为 x、y 独立，系数就是偏导数：(∂w/∂x)_y = ${num(kx)}，(∂w/∂y)_x = ${num(ky)}。`),
        audit: { kind: 'MIT-MV-29:gradient-with-constraint', params: { f1: K.f1, f2: K.f2, f3: K.f3, g1: K.g1, g2: K.g2, g3: K.g3 } },
      }),
      g.number({
        id: 'cyclic', title: t('The cyclic rule', '循环法则'),
        prompt: t(`The variables x, y, z are tied together by one equation, so any two of them are independent. At a point, (∂x/∂y)_z = ${num(cA)} and (∂y/∂z)_x = ${num(cB)}. Use the cyclic rule (∂x/∂y)_z (∂y/∂z)_x (∂z/∂x)_y = −1 to find (∂z/∂x)_y. Enter a fraction or a decimal to 2 places.`,
          `变量 x、y、z 由一个方程联系在一起，所以其中任意两个是独立的。在某一点，(∂x/∂y)_z = ${num(cA)}，(∂y/∂z)_x = ${num(cB)}。用循环法则 (∂x/∂y)_z (∂y/∂z)_x (∂z/∂x)_y = −1 求 (∂z/∂x)_y。用分数或保留 2 位小数的小数输入。`),
        fields: [{ label: t('(∂z/∂x)_y', '(∂z/∂x)_y'), answer: cAns, tolerance: 0.005 }],
        hint: t('The three factors multiply to −1 (not +1). Solve for the missing factor.', '三个因子的乘积是 −1（不是 +1）。解出缺少的那个因子。'),
        explanation: t(`${par(cA)}·${par(cB)}·(∂z/∂x)_y = −1, so (∂z/∂x)_y = ${divText(-1, cA * cB)}. Check with the plane x + y + z = 0: each factor is −1 and the product is −1, not +1.`,
          `${par(cA)}·${par(cB)}·(∂z/∂x)_y = −1，所以 (∂z/∂x)_y = ${divText(-1, cA * cB)}。用平面 x + y + z = 0 检验：每个因子都是 −1，乘积是 −1 而不是 +1。`),
        audit: { kind: 'MIT-MV-29:cyclic', params: { A: cA, B: cB } },
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`The point (x, y, z) lies on the sphere x² + y² + z² = ${R}, and w = xy + z². Take x and z as the independent variables, so y depends on them through the sphere equation. Find (∂w/∂x)_z, with z held constant, at P = ${vec(C.x, C.y, C.z)}. Enter a fraction or a decimal to 2 places.`,
          `点 (x, y, z) 在球面 x² + y² + z² = ${R} 上，w = xy + z²。取 x、z 为独立变量，y 通过球面方程依赖于它们。求保持 z 不变的 (∂w/∂x)_z 在 P = ${vec(C.x, C.y, C.z)} 处的值。用分数或保留 2 位小数的小数输入。`),
        fields: [{ label: t('(∂w/∂x)_z', '(∂w/∂x)_z'), answer: cAnsH, tolerance: 0.005 }],
        hint: t('Take differentials of w and of the sphere equation, and set dz = 0 because z is held constant.', '对 w 和球面方程取微分，并令 dz = 0，因为 z 保持不变。'),
        explanation: t(`dw = y dx + x dy + 2z dz and 2x dx + 2y dy + 2z dz = 0. With dz = 0: dy = −(x/y) dx, so dw = (y − x²/y) dx. At P: ${num(C.y)} − ${par(C.x)}²/${par(C.y)} = ${frac(C.y * C.y - C.x * C.x, C.y)}${Number.isInteger(cAnsH) ? '' : ` ≈ ${num(round2(cAnsH))}`}. You practised choosing the independent variables and computing a constrained derivative with differentials; the conditions under which the relation can be solved for a variable are not assessed here.`,
          `dw = y dx + x dy + 2z dz，2x dx + 2y dy + 2z dz = 0。令 dz = 0：dy = −(x/y) dx，所以 dw = (y − x²/y) dx。在 P 处：${num(C.y)} − ${par(C.x)}²/${par(C.y)} = ${frac(C.y * C.y - C.x * C.x, C.y)}${Number.isInteger(cAnsH) ? '' : ` ≈ ${num(round2(cAnsH))}`}。本游戏练习的是选择独立变量并用微分计算受约束的导数；关系式何时可以解出某个变量，不在考查范围内。`),
        audit: { kind: 'MIT-MV-29:challenge', params: { x0: C.x, y0: C.y, z0: C.z } },
      }),
    ];
  },

  // ================================================================================================
  'MIT-MV-30': (seed, lang) => {
    const g = makeMvDeck(seed, lang, 'MIT-MV-30');
    warm(g);

    // ---- choose-the-method pool: six kinds of Unit 2 questions ----
    const mq = sampleQ(g), mp = { x: g.random(-3, 3), y: g.random(-3, 3) }, mv = pyth(g);
    const ma = g.random(1, 3), mb = g.random(1, 3), mc = g.random(2, 12), mk = g.random(1, 3), mpp = g.nonzero(-2, 2), mqq = g.nonzero(-2, 2);
    const keys = ['approx', 'lagr', 'crit', 'dir', 'chain', 'cons'] as const;
    type Key = typeof keys[number];
    const problem: Record<Key, readonly [string, string]> = {
      approx: t(`Estimate f(${num(mp.x + 0.1)}, ${num(mp.y - 0.1)}) for f(x, y) = ${qText(mq)}, knowing the values of f and its partial derivatives at (${num(mp.x)}, ${num(mp.y)}).`, `已知 f(x, y) = ${qText(mq)} 及其偏导数在 (${num(mp.x)}, ${num(mp.y)}) 处的值，估计 f(${num(mp.x + 0.1)}, ${num(mp.y - 0.1)})。`),
      lagr: t(`Find the largest value of f(x, y) = xy on the line ${linear([ma, mb], ['x', 'y'])} = ${mc} in the first quadrant.`, `在第一象限内，求 f(x, y) = xy 在直线 ${linear([ma, mb], ['x', 'y'])} = ${mc} 上的最大值。`),
      crit: t(`Find the points where the graph of f(x, y) = ${qText(mq)} has a horizontal tangent plane.`, `求 f(x, y) = ${qText(mq)} 的图像在哪些点处有水平切平面。`),
      dir: t(`How fast does f(x, y) = ${qText(mq)} change at P = (${num(mp.x)}, ${num(mp.y)}) when you move in the direction of v = ${vec(mv.x, mv.y)}?`, `在 P = (${num(mp.x)}, ${num(mp.y)}) 处，沿 v = ${vec(mv.x, mv.y)} 方向移动时，f(x, y) = ${qText(mq)} 变化得多快？`),
      chain: t(`w = f(u, v) where u = x + ${coef(mk, 'y')} and v = xy. Express ∂w/∂x in terms of f_u, f_v, x and y.`, `w = f(u, v)，其中 u = x + ${coef(mk, 'y')}，v = xy。用 f_u、f_v、x、y 表示 ∂w/∂x。`),
      cons: t(`x, y, z satisfy z = ${linear([mpp, mqq], ['x', 'y'])} and w = xy + z². Take x and y as the independent variables. Find (∂w/∂x)_y.`, `x、y、z 满足 z = ${linear([mpp, mqq], ['x', 'y'])}，w = xy + z²。取 x、y 为独立变量。求 (∂w/∂x)_y。`),
    };
    const tool: Record<Key, readonly [string, string]> = {
      approx: t('Tangent plane approximation: f(P) + f_x(P)Δx + f_y(P)Δy', '切平面近似：f(P) + f_x(P)Δx + f_y(P)Δy'),
      lagr: t('Lagrange multipliers: solve ∇f = λ∇g together with g = c', '拉格朗日乘数法：联立 ∇f = λ∇g 与 g = c'),
      crit: t('Critical points: solve f_x = 0 and f_y = 0', '临界点：解 f_x = 0 与 f_y = 0'),
      dir: t('Directional derivative: ∇f · u with u = v/|v|', '方向导数：∇f · u，其中 u = v/|v|'),
      chain: t('Chain rule: w_x = f_u u_x + f_v v_x', '链式法则：w_x = f_u u_x + f_v v_x'),
      cons: t('Differentials: dw = f_x dx + f_y dy + f_z dz, with dz taken from the relation', '微分法：dw = f_x dx + f_y dy + f_z dz，其中 dz 由关系式得到'),
    };
    const why: Record<Key, readonly [string, string]> = {
      approx: t('The question asks for a small change of f near a point where the values are known, which is what the tangent plane approximation gives.', '题目要求在已知数值的点附近估计 f 的微小变化，这正是切平面近似所做的。'),
      lagr: t('The question asks for an extreme value of f on a constraint line g = c, which is the job of the Lagrange conditions.', '题目要求 f 在约束直线 g = c 上的极值，这是拉格朗日条件的用途。'),
      crit: t('A horizontal tangent plane means that both slopes vanish: f_x = 0 and f_y = 0.', '切平面水平意味着两个斜率都为零：f_x = 0 且 f_y = 0。'),
      dir: t('A rate of change in a given direction is the directional derivative ∇f · u, where the direction is first turned into a unit vector.', '给定方向上的变化率就是方向导数 ∇f · u，其中方向要先化为单位向量。'),
      chain: t('w depends on x through both u and v, so the chain rule adds the two paths: f_u u_x + f_v v_x.', 'w 通过 u 和 v 两条路径依赖于 x，所以链式法则把两条路径相加：f_u u_x + f_v v_x。'),
      cons: t('The variables are tied by a relation, so z moves with x and y; differentials replace dz by its expression in dx and dy.', '变量之间由关系式联系，所以 z 随 x、y 变化；微分法把 dz 换成用 dx、dy 表示的式子。'),
    };
    const k1 = g.random(0, 5), k2 = (k1 + g.random(1, 5)) % 6;
    const methodCard = (id: string, k: number, title: readonly [string, string]) => {
      const key = keys[k];
      // the chain rule and the differentials method can both handle a linked-variables question, so they are never offered against each other
      const partner = key === 'chain' ? 'cons' : key === 'cons' ? 'chain' : '';
      const pool = keys.map((_, i) => i).filter(i => i !== k && keys[i] !== partner);
      const o1 = pool.splice(g.random(0, pool.length - 1), 1)[0];
      const o2 = pool[g.random(0, pool.length - 1)];
      return g.choice({
        id, title: t(title[0], title[1]),
        prompt: t(`Which method answers this question? ${problem[key][0]}`, `哪种方法能解决这个问题？${problem[key][1]}`),
        options: [tool[key], tool[keys[o1]], tool[keys[o2]]], correct: 0,
        hint: t('Decide what is being asked for: a rate in a direction, an extreme value on a curve, a flat tangent plane, an estimate near a point, or a derivative when variables are linked.', '先判断题目要求什么：某方向上的变化率、曲线上的极值、水平切平面、某点附近的估计，还是变量相互关联时的导数。'),
        explanation: t(`${why[key][0]} The other methods answer different questions.`, `${why[key][1]}其他方法解决的是不同的问题。`),
      });
    };

    // 3. tangent plane
    const tq = sampleQ(g), tx = g.random(-3, 3), ty = g.random(-3, 3);
    const tm = qFx(tq, tx, ty), tn = qFy(tq, tx, ty), tf = qVal(tq, tx, ty), tk = tf - tm * tx - tn * ty;

    // 4. classification
    const kind = g.random(0, 2);
    const cl = retry(() => {
      const a = g.nonzero(-3, 3), c = g.nonzero(-3, 3), b = g.random(-3, 3), xs = g.random(-3, 3), ys = g.random(-3, 3);
      return { a, b, c, xs, ys, d: -(2 * a * xs + b * ys), e: -(b * xs + 2 * c * ys) };
    }, r => { const Dd = 4 * r.a * r.c - r.b * r.b; return Dd !== 0 && (Dd < 0 ? 2 : r.a > 0 ? 0 : 1) === kind; });
    const clD = 4 * cl.a * cl.c - cl.b * cl.b;
    const clText = linear([cl.a, cl.b, cl.c, cl.d, cl.e], ['x²', 'xy', 'y²', 'x', 'y']);

    // 5. chain rule
    const ch = retry(() => ({ a: g.nonzero(-2, 2), b: g.nonzero(-2, 2), x0: g.random(-2, 2), y0: g.random(-2, 2) }), r => {
      const u = r.x0 + r.y0, v = r.x0 * r.y0, fu = 2 * r.a * u + r.b * v, fv = r.b * u;
      return fu + fv * r.y0 !== 0 && fu + fv * r.x0 !== 0;
    });
    const cu = ch.x0 + ch.y0, cv = ch.x0 * ch.y0, cfu = 2 * ch.a * cu + ch.b * cv, cfv = ch.b * cu;
    const cwx = cfu + cfv * ch.y0, cwy = cfu + cfv * ch.x0;

    // 6. directional derivative
    const D6 = retry(() => {
      const q = sampleQ(g), x0 = g.random(-3, 3), y0 = g.random(-3, 3), v = pyth(g);
      const fx = qFx(q, x0, y0), fy = qFy(q, x0, y0);
      return { q, x0, y0, v, fx, fy, s: fx * v.x + fy * v.y };
    }, r => r.fx !== 0 && r.fy !== 0 && r.s !== 0);

    // 7-8. Lagrange on a line
    const L = retry(() => ({ a: g.random(1, 5), b: g.random(1, 5), k: g.random(1, 2) }), r => r.a !== r.b);
    const Lc = 2 * L.a * L.b * L.k, Lline = linear([L.a, L.b], ['x', 'y']), Lmax = L.a * L.b * L.k * L.k;
    const sysCorrect = `y = ${coef(L.a, 'λ')}, x = ${coef(L.b, 'λ')}, ${Lline} = ${Lc}`;
    const sysSwap = `x = ${coef(L.a, 'λ')}, y = ${coef(L.b, 'λ')}, ${Lline} = ${Lc}`;
    const sysZero = `y = 0, x = 0, ${Lline} = ${Lc}`;

    // 9. constrained derivative
    const Cn = retry(() => ({ p: g.nonzero(-2, 2), q: g.nonzero(-2, 2), x0: g.random(-2, 2), y0: g.random(-2, 2) }), r => r.p * r.x0 + r.q * r.y0 !== 0);
    const Cz = Cn.p * Cn.x0 + Cn.q * Cn.y0, Cans = Cn.y0 + 2 * Cn.p * Cz;

    // 10. Laplace
    const la = g.nonzero(-5, 5);

    // 11. critical point claim
    const cp = g.random(1, 4), cqq = g.random(1, 4);

    // 12. challenge, after Exam 2 Problem 1
    const E = retry(() => ({ c: g.nonzero(-3, 3), x0: g.nonzero(-2, 2), y0: g.nonzero(-2, 2), dx: g.pick([-0.2, -0.1, 0.1, 0.2]), dy: g.pick([-0.2, -0.1, 0.1, 0.2]) }), r => {
      // the exact value must differ from the linear estimate by more than the grading tolerance
      const f = (x: number, y: number) => x * x * y * y - r.c * x;
      const est = f(r.x0, r.y0) + (2 * r.x0 * r.y0 * r.y0 - r.c) * r.dx + 2 * r.x0 * r.x0 * r.y0 * r.dy;
      return Math.abs(f(r.x0 + r.dx, r.y0 + r.dy) - est) > 0.02;
    });
    const Ef = E.x0 * E.x0 * E.y0 * E.y0 - E.c * E.x0, Efx = 2 * E.x0 * E.y0 * E.y0 - E.c, Efy = 2 * E.x0 * E.x0 * E.y0;
    const Eest = round2(Ef + Efx * E.dx + Efy * E.dy);
    const Etext = linear([1, -E.c], ['x²y²', 'x']);

    return [
      methodCard('method-1', k1, t('Choose the method', '选择方法')),
      methodCard('method-2', k2, t('Choose the method again', '再选一次方法')),
      g.number({
        id: 'tangent-plane', title: t('The tangent plane', '切平面'),
        prompt: t(`f(x, y) = ${qText(tq)}. The tangent plane to the graph z = f(x, y) at P = (${num(tx)}, ${num(ty)}) can be written z = mx + ny + k. Find m, n and k.`,
          `f(x, y) = ${qText(tq)}。图像 z = f(x, y) 在 P = (${num(tx)}, ${num(ty)}) 处的切平面可写成 z = mx + ny + k。求 m、n、k。`),
        fields: [{ label: t('m', 'm'), answer: tm }, { label: t('n', 'n'), answer: tn }, { label: t('k', 'k'), answer: tk }],
        hint: t('m = f_x(P) and n = f_y(P). The plane passes through (x₀, y₀, f(P)), so k = f(P) − m·x₀ − n·y₀.', 'm = f_x(P)，n = f_y(P)。平面过点 (x₀, y₀, f(P))，所以 k = f(P) − m·x₀ − n·y₀。'),
        explanation: t(`m = f_x(P) = ${affine(2 * tq.a, tq.b, tq.d)} = ${evalAffine(2 * tq.a, tq.b, tq.d, tx, ty)} = ${num(tm)}, n = f_y(P) = ${evalAffine(tq.b, 2 * tq.c, tq.e, tx, ty)} = ${num(tn)}, and f(P) = ${num(tf)}. So k = ${num(tf)} − ${par(tm)}·${par(tx)} − ${par(tn)}·${par(ty)} = ${num(tk)}.`,
          `m = f_x(P) = ${affine(2 * tq.a, tq.b, tq.d)} = ${evalAffine(2 * tq.a, tq.b, tq.d, tx, ty)} = ${num(tm)}，n = f_y(P) = ${evalAffine(tq.b, 2 * tq.c, tq.e, tx, ty)} = ${num(tn)}，f(P) = ${num(tf)}。所以 k = ${num(tf)} − ${par(tm)}·${par(tx)} − ${par(tn)}·${par(ty)} = ${num(tk)}。`),
        audit: { kind: 'MIT-MV-30:tangent-plane', params: { a: tq.a, b: tq.b, c: tq.c, d: tq.d, e: tq.e, x0: tx, y0: ty } },
      }),
      g.choice({
        id: 'classify', title: t('Classify the critical point', '判别临界点'),
        prompt: t(`f(x, y) = ${clText} has the critical point P = (${num(cl.xs)}, ${num(cl.ys)}). Use the second derivative test (f_xx f_yy − f_xy² and the sign of f_xx) to decide what P is.`,
          `f(x, y) = ${clText} 有临界点 P = (${num(cl.xs)}, ${num(cl.ys)})。用二阶导数检验（f_xx f_yy − f_xy² 与 f_xx 的符号）判断 P 是什么点。`),
        options: [t('P is a local minimum.', 'P 是局部最小值点。'), t('P is a local maximum.', 'P 是局部最大值点。'), t('P is a saddle point: neither a maximum nor a minimum.', 'P 是鞍点：既不是最大值点也不是最小值点。')], correct: kind, fixedOrder: true,
        hint: t('For this f, f_xx and f_yy are constants and f_xy is the coefficient of xy. Compute f_xx f_yy − f_xy², then use the sign of f_xx if it is positive.', '对这个 f，f_xx 与 f_yy 是常数，f_xy 是 xy 的系数。算出 f_xx f_yy − f_xy²，若为正，再看 f_xx 的符号。'),
        explanation: t(`f_xx = ${num(2 * cl.a)}, f_yy = ${num(2 * cl.c)}, f_xy = ${num(cl.b)}, so f_xx f_yy − f_xy² = ${par(2 * cl.a)}·${par(2 * cl.c)} − ${par(cl.b)}² = ${num(clD)}. ${clD < 0 ? 'It is negative, so P is a saddle point.' : cl.a > 0 ? 'It is positive and f_xx > 0, so P is a local minimum.' : 'It is positive and f_xx < 0, so P is a local maximum.'}`,
          `f_xx = ${num(2 * cl.a)}，f_yy = ${num(2 * cl.c)}，f_xy = ${num(cl.b)}，所以 f_xx f_yy − f_xy² = ${par(2 * cl.a)}·${par(2 * cl.c)} − ${par(cl.b)}² = ${num(clD)}。${clD < 0 ? '它为负，所以 P 是鞍点。' : cl.a > 0 ? '它为正且 f_xx > 0，所以 P 是局部最小值点。' : '它为正且 f_xx < 0，所以 P 是局部最大值点。'}`),
        audit: { kind: 'MIT-MV-30:classify', params: { a: cl.a, b: cl.b, c: cl.c, d: cl.d, e: cl.e, xs: cl.xs, ys: cl.ys } },
      }),
      g.number({
        id: 'chain-rule', title: t('The chain rule', '链式法则'),
        prompt: t(`w = f(u, v) = ${linear([ch.a, ch.b], ['u²', 'uv'])}, where u = x + y and v = xy. Using the chain rule, find ∂w/∂x and ∂w/∂y at (x, y) = (${num(ch.x0)}, ${num(ch.y0)}).`,
          `w = f(u, v) = ${linear([ch.a, ch.b], ['u²', 'uv'])}，其中 u = x + y，v = xy。用链式法则求 ∂w/∂x 与 ∂w/∂y 在 (x, y) = (${num(ch.x0)}, ${num(ch.y0)}) 处的值。`),
        fields: [{ label: t('∂w/∂x', '∂w/∂x'), answer: cwx }, { label: t('∂w/∂y', '∂w/∂y'), answer: cwy }],
        hint: t('∂w/∂x = f_u u_x + f_v v_x and ∂w/∂y = f_u u_y + f_v v_y. First compute u, v, f_u, f_v at the point.', '∂w/∂x = f_u u_x + f_v v_x，∂w/∂y = f_u u_y + f_v v_y。先算出该点的 u、v、f_u、f_v。'),
        explanation: t(`At the point u = ${num(cu)}, v = ${num(cv)}. f_u = ${linear([2 * ch.a, ch.b], ['u', 'v'])} = ${num(cfu)} and f_v = ${coef(ch.b, 'u')} = ${num(cfv)}. u_x = 1, u_y = 1, v_x = y = ${num(ch.y0)}, v_y = x = ${num(ch.x0)}. So ∂w/∂x = ${num(cfu)}·1 + ${par(cfv)}·${par(ch.y0)} = ${num(cwx)} and ∂w/∂y = ${num(cfu)}·1 + ${par(cfv)}·${par(ch.x0)} = ${num(cwy)}.`,
          `在这一点 u = ${num(cu)}，v = ${num(cv)}。f_u = ${linear([2 * ch.a, ch.b], ['u', 'v'])} = ${num(cfu)}，f_v = ${coef(ch.b, 'u')} = ${num(cfv)}。u_x = 1，u_y = 1，v_x = y = ${num(ch.y0)}，v_y = x = ${num(ch.x0)}。所以 ∂w/∂x = ${num(cfu)}·1 + ${par(cfv)}·${par(ch.y0)} = ${num(cwx)}，∂w/∂y = ${num(cfu)}·1 + ${par(cfv)}·${par(ch.x0)} = ${num(cwy)}。`),
        audit: { kind: 'MIT-MV-30:chain-rule', params: { a: ch.a, b: ch.b, x0: ch.x0, y0: ch.y0 } },
      }),
      g.number({
        id: 'directional', title: t('A rate in a given direction', '给定方向上的变化率'),
        prompt: t(`f(x, y) = ${qText(D6.q)} and P = (${num(D6.x0)}, ${num(D6.y0)}). Find the directional derivative of f at P in the direction of v = ${vec(D6.v.x, D6.v.y)}. Enter a fraction or a decimal to 2 places.`,
          `f(x, y) = ${qText(D6.q)}，P = (${num(D6.x0)}, ${num(D6.y0)})。求 f 在 P 处沿 v = ${vec(D6.v.x, D6.v.y)} 方向的方向导数。用分数或保留 2 位小数的小数输入。`),
        fields: [{ label: t('df/ds', 'df/ds'), answer: D6.s / D6.v.n, tolerance: 0.005 }],
        hint: t('Gradient first, then the unit vector u = v/|v|, then ∇f · u.', '先求梯度，再求单位向量 u = v/|v|，最后算 ∇f · u。'),
        explanation: t(`∇f(P) = ${vec(D6.fx, D6.fy)} and |v| = ${D6.v.n}, so df/ds = ∇f · v/|v| = (${joinTerms([mulStr(D6.fx, D6.v.x), mulStr(D6.fy, D6.v.y)])})/${D6.v.n} = ${frac(D6.s, D6.v.n)}${Number.isInteger(D6.s / D6.v.n) ? '' : ` ≈ ${num(round2(D6.s / D6.v.n))}`}.`,
          `∇f(P) = ${vec(D6.fx, D6.fy)}，|v| = ${D6.v.n}，所以 df/ds = ∇f · v/|v| = (${joinTerms([mulStr(D6.fx, D6.v.x), mulStr(D6.fy, D6.v.y)])})/${D6.v.n} = ${frac(D6.s, D6.v.n)}${Number.isInteger(D6.s / D6.v.n) ? '' : ` ≈ ${num(round2(D6.s / D6.v.n))}`}。`),
        audit: { kind: 'MIT-MV-30:directional', params: { a: D6.q.a, b: D6.q.b, c: D6.q.c, d: D6.q.d, e: D6.q.e, x0: D6.x0, y0: D6.y0, vx: D6.v.x, vy: D6.v.y } },
      }),
      g.choice({
        id: 'lagrange-setup', title: t('Set up the Lagrange system', '建立拉格朗日方程组'),
        prompt: t(`You want the largest value of f(x, y) = xy on the line ${Lline} = ${Lc} with x > 0 and y > 0, using Lagrange multipliers. Which system must you solve?`,
          `你想用拉格朗日乘数法求 f(x, y) = xy 在直线 ${Lline} = ${Lc}（x > 0，y > 0）上的最大值。必须解哪个方程组？`),
        options: [t(sysCorrect, sysCorrect), t(sysSwap, sysSwap), t(sysZero, sysZero)], correct: 0,
        hint: t('∇f = (f_x, f_y) = (y, x), and ∇g is the vector of coefficients of the line. Match components: ∇f = λ∇g.', '∇f = (f_x, f_y) = (y, x)，∇g 是直线方程的系数向量。逐分量对应：∇f = λ∇g。'),
        explanation: t(`For f = xy we have ∇f = (y, x), and for g = ${Lline} we have ∇g = ${vec(L.a, L.b)}. The condition ∇f = λ∇g gives y = ${coef(L.a, 'λ')} and x = ${coef(L.b, 'λ')}; together with the constraint ${Lline} = ${Lc} that is the system ${sysCorrect}. Using x = ${coef(L.a, 'λ')} forgets that the derivative of xy in x is y, and y = 0 = x would put the point at the origin, which is not on the line.`,
          `对 f = xy，∇f = (y, x)；对 g = ${Lline}，∇g = ${vec(L.a, L.b)}。条件 ∇f = λ∇g 给出 y = ${coef(L.a, 'λ')}，x = ${coef(L.b, 'λ')}；再加上约束 ${Lline} = ${Lc}，就是方程组 ${sysCorrect}。若写 x = ${coef(L.a, 'λ')}，就忘了 xy 对 x 的导数是 y；而 y = 0 = x 会把点放在原点，原点不在这条直线上。`),
      }),
      g.number({
        id: 'lagrange-value', title: t('Solve it', '解出来'),
        prompt: t(`Find the largest value of f(x, y) = xy on the line ${Lline} = ${Lc} with x ≥ 0 and y ≥ 0.`,
          `求 f(x, y) = xy 在直线 ${Lline} = ${Lc}（x ≥ 0，y ≥ 0）上的最大值。`),
        fields: [{ label: t('largest value of xy', 'xy 的最大值'), answer: Lmax }],
        hint: t(`Solve y = ${coef(L.a, 'λ')}, x = ${coef(L.b, 'λ')} together with the line to get the point, then compute xy. At the endpoints of the segment the product is 0.`, `解 y = ${coef(L.a, 'λ')}、x = ${coef(L.b, 'λ')} 与直线方程得到该点，再算 xy。在线段两个端点处乘积为 0。`),
        explanation: t(`y = ${coef(L.a, 'λ')} and x = ${coef(L.b, 'λ')} give ${Lline} = ${2 * L.a * L.b}λ = ${Lc}, so λ = ${L.k}, x = ${L.b * L.k}, y = ${L.a * L.k} and xy = ${Lmax}. At the endpoints (${Lc / L.a}, 0) and (0, ${Lc / L.b}) the product is 0, which is smaller, so ${Lmax} is the maximum.`,
          `y = ${coef(L.a, 'λ')}，x = ${coef(L.b, 'λ')} 代入得 ${Lline} = ${2 * L.a * L.b}λ = ${Lc}，所以 λ = ${L.k}，x = ${L.b * L.k}，y = ${L.a * L.k}，xy = ${Lmax}。在端点 (${Lc / L.a}, 0) 与 (0, ${Lc / L.b}) 处乘积为 0，更小，所以 ${Lmax} 是最大值。`),
        audit: { kind: 'MIT-MV-30:lagrange-value', params: { a: L.a, b: L.b, c: Lc } },
      }),
      g.number({
        id: 'constrained', title: t('A derivative with a relation', '带关系式的导数'),
        prompt: t(`x, y, z satisfy z = ${linear([Cn.p, Cn.q], ['x', 'y'])}, and w = xy + z². Take x and y as the independent variables. Find (∂w/∂x)_y, with y held constant, at (x, y, z) = ${vec(Cn.x0, Cn.y0, Cz)}.`,
          `x、y、z 满足 z = ${linear([Cn.p, Cn.q], ['x', 'y'])}，w = xy + z²。取 x、y 为独立变量。求保持 y 不变的 (∂w/∂x)_y 在 (x, y, z) = ${vec(Cn.x0, Cn.y0, Cz)} 处的值。`),
        fields: [{ label: t('(∂w/∂x)_y', '(∂w/∂x)_y'), answer: Cans }],
        hint: t('dw = y dx + x dy + 2z dz, and dz comes from the relation. With y fixed, dy = 0.', 'dw = y dx + x dy + 2z dz，而 dz 由关系式得到。y 固定时 dy = 0。'),
        explanation: t(`dz = ${diffText([Cn.p, Cn.q], ['dx', 'dy'])}, so with dy = 0: dw = y dx + 2z dz = (${plus('y', coef(2 * Cn.p, 'z'))}) dx = (${joinTerms([num(Cn.y0), mulStr(2 * Cn.p, Cz)])}) dx = ${num(Cans)} dx. The formal derivative w_x = y = ${num(Cn.y0)} alone would miss the change of z.`,
          `dz = ${diffText([Cn.p, Cn.q], ['dx', 'dy'])}，所以 dy = 0 时：dw = y dx + 2z dz = (${plus('y', coef(2 * Cn.p, 'z'))}) dx = (${joinTerms([num(Cn.y0), mulStr(2 * Cn.p, Cz)])}) dx = ${num(Cans)} dx。单独用形式偏导数 w_x = y = ${num(Cn.y0)} 会漏掉 z 的变化。`),
        audit: { kind: 'MIT-MV-30:constrained', params: { p: Cn.p, q: Cn.q, x0: Cn.x0, y0: Cn.y0 } },
      }),
      g.choice({
        id: 'laplace', title: t('Laplace’s equation', '拉普拉斯方程'),
        prompt: t('Laplace’s equation in two variables is ∂²w/∂x² + ∂²w/∂y² = 0. Which function w(x, y) satisfies it?', '二元拉普拉斯方程为 ∂²w/∂x² + ∂²w/∂y² = 0。哪个函数 w(x, y) 满足它？'),
        options: [
          t(`w = ${linear([la, -la], ['x²', 'y²'])}`, `w = ${linear([la, -la], ['x²', 'y²'])}`),
          t(`w = ${linear([la, la], ['x²', 'y²'])}`, `w = ${linear([la, la], ['x²', 'y²'])}`),
          t(`w = ${linear([la, -2 * la], ['x²', 'y²'])}`, `w = ${linear([la, -2 * la], ['x²', 'y²'])}`),
        ], correct: 0,
        hint: t('Compute w_xx and w_yy for each function and add them.', '对每个函数算出 w_xx 与 w_yy 并相加。'),
        explanation: t(`For w = ${linear([la, -la], ['x²', 'y²'])}: w_xx = ${num(2 * la)} and w_yy = ${num(-2 * la)}, which add up to 0. For ${linear([la, la], ['x²', 'y²'])} the sum is ${num(4 * la)}, and for ${linear([la, -2 * la], ['x²', 'y²'])} it is ${num(-2 * la)}; neither is 0.`,
          `对 w = ${linear([la, -la], ['x²', 'y²'])}：w_xx = ${num(2 * la)}，w_yy = ${num(-2 * la)}，和为 0。对 ${linear([la, la], ['x²', 'y²'])}，和为 ${num(4 * la)}；对 ${linear([la, -2 * la], ['x²', 'y²'])}，和为 ${num(-2 * la)}；都不为 0。`),
        audit: { kind: 'MIT-MV-30:laplace', params: { a: la } },
      }),
      g.choice({
        id: 'critical-claim', title: t('Is the claim true?', '这个说法对吗？'),
        prompt: t('A student claims: “if f_x = f_y = 0 at P, then f has a local maximum or a local minimum at P.” Is the claim true?', '一位同学说：“若在 P 处 f_x = f_y = 0，则 f 在 P 处有局部最大值或局部最小值。”这个说法对吗？'),
        options: [
          t(`False. For f(x, y) = ${linear([cp, -cqq], ['x²', 'y²'])} both partial derivatives are 0 at (0, 0), but f is larger than f(0, 0) along the x-axis and smaller along the y-axis.`, `不对。对 f(x, y) = ${linear([cp, -cqq], ['x²', 'y²'])}，两个偏导数在 (0, 0) 处都是 0，但沿 x 轴 f 大于 f(0, 0)，沿 y 轴小于 f(0, 0)。`),
          t('True. A horizontal tangent plane means that f stops increasing in every direction, so P has to be a local maximum or a local minimum.', '对。切平面水平说明 f 沿每个方向都停止增大，所以 P 必定是局部最大值点或局部最小值点。'),
          t('True. Critical points are exactly the places where f has an extremum, and the second derivative test only decides whether it is a maximum or a minimum.', '对。临界点恰好就是 f 取极值的地方，二阶导数检验只用来判断它是最大值还是最小值。'),
        ], correct: 0,
        hint: t('Look for a function with f_x = f_y = 0 at the origin that curves up in one direction and down in another.', '找一个在原点处 f_x = f_y = 0、却在一个方向向上弯、另一个方向向下弯的函数。'),
        explanation: t(`f_x = ${coef(2 * cp, 'x')} and f_y = ${coef(-2 * cqq, 'y')} vanish at (0, 0). But f(1, 0) = ${cp} > 0 = f(0, 0) > ${num(-cqq)} = f(0, 1). So (0, 0) is a critical point that is a saddle, neither a maximum nor a minimum: f_x = f_y = 0 is necessary for an extremum, not sufficient.`,
          `f_x = ${coef(2 * cp, 'x')} 与 f_y = ${coef(-2 * cqq, 'y')} 在 (0, 0) 处为 0。但 f(1, 0) = ${cp} > 0 = f(0, 0) > ${num(-cqq)} = f(0, 1)。所以 (0, 0) 是临界点，也是鞍点，既不是最大值点也不是最小值点：f_x = f_y = 0 是取极值的必要条件，而不是充分条件。`),
      }),
      g.number({
        id: 'challenge', title: t('Independent challenge', '独立挑战'),
        prompt: t(`f(x, y) = ${Etext}. At P = (${num(E.x0)}, ${num(E.y0)}) find f_x and f_y, and use the tangent plane (the linear approximation) to estimate f(${num(round2(E.x0 + E.dx))}, ${num(round2(E.y0 + E.dy))}), where Δx = ${num(E.dx)} and Δy = ${num(E.dy)}. Enter the estimate to 2 decimal places.`,
          `f(x, y) = ${Etext}。在 P = (${num(E.x0)}, ${num(E.y0)}) 处求 f_x 与 f_y，并用切平面（线性近似）估计 f(${num(round2(E.x0 + E.dx))}, ${num(round2(E.y0 + E.dy))})，其中 Δx = ${num(E.dx)}，Δy = ${num(E.dy)}。估计值保留 2 位小数。`),
        fields: [{ label: t('f_x', 'f_x'), answer: Efx }, { label: t('f_y', 'f_y'), answer: Efy }, { label: t('estimate', '估计值'), answer: Eest, tolerance: 0.005 }],
        hint: t('f_x and f_y at P, then f(P) + f_x Δx + f_y Δy. Do not substitute the new point into f.', '先求 P 处的 f_x 与 f_y，再算 f(P) + f_x Δx + f_y Δy。不要把新点代入 f。'),
        explanation: t(`f_x = 2xy² ${term(-E.c)} = 2·${par(E.x0)}·${par(E.y0)}² ${term(-E.c)} = ${num(Efx)} and f_y = 2x²y = 2·${par(E.x0)}²·${par(E.y0)} = ${num(Efy)}. Also f(P) = ${num(Ef)}. Estimate = ${num(Ef)} + ${par(Efx)}·${par(E.dx)} + ${par(Efy)}·${par(E.dy)} = ${num(Eest)}. This review checks which tool to use and how to apply it to polynomials; it does not assess proofs or functions that are not differentiable.`,
          `f_x = 2xy² ${term(-E.c)} = 2·${par(E.x0)}·${par(E.y0)}² ${term(-E.c)} = ${num(Efx)}，f_y = 2x²y = 2·${par(E.x0)}²·${par(E.y0)} = ${num(Efy)}。另外 f(P) = ${num(Ef)}。估计值 = ${num(Ef)} + ${par(Efx)}·${par(E.dx)} + ${par(Efy)}·${par(E.dy)} = ${num(Eest)}。本复习游戏检查你选用哪种工具以及如何把它用于多项式；不考查证明，也不涉及不可微的函数。`),
        audit: { kind: 'MIT-MV-30:challenge', params: { c: E.c, x0: E.x0, y0: E.y0, dx: E.dx, dy: E.dy } },
      }),
    ];
  },
};
