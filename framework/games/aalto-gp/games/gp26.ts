import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, term, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
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

const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const sub = (n: number): string => String(n).split('').map(c => SUBS[+c]).join('');

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** The reduced denominator of n/d is one of the plan's allowed denominators (exact integer arithmetic). */
const isAllowedDen = (n: number, d: number): boolean => {
  const den = Math.abs(d) / gcd(Math.abs(n), Math.abs(d));
  return den === 1 || den === 2 || den === 4 || den === 5 || den === 8 || den === 10;
};
/** A fraction as learner text: negatives and fractions in parentheses so they can sit inside a product. */
const pf = (x: number): string => { const s = exact(x); return x < 0 || s.includes('/') ? `(${s})` : s; };
/** A square: 3 -> "3²", 3/4 -> "(3/4)²", -1/2 -> "(−1/2)²". */
const sq = (x: number): string => { const s = exact(x); return /[/−]/.test(s) ? `(${s})²` : `${s}²`; };

/** One wrong route for the explanation: its wording in both languages and its value. Routes with the same value are merged into one clause. */
type Slip = { en: string; zh: string; v: number };
function slipText(slips: Slip[], fmt: (v: number) => string): Text {
  const groups: Slip[][] = [];
  for (const s of slips) { const g = groups.find(x => Math.abs(x[0].v - s.v) < 1e-9); if (g) g.push(s); else groups.push([s]); }
  const en = groups.map(g => {
    const names = g.map(x => x.en);
    const head = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${head} ${names.length === 1 ? 'would give' : 'both give'} ${fmt(g[0].v)}`;
  }).join('; ');
  const spaced = (phrase: string) => (/[A-Za-z0-9²⁴½⁻¹ᵀσℓθ)′]$/.test(phrase) ? `${phrase} ` : phrase);
  const zh = groups.map(g => {
    const names = g.map(x => x.zh);
    const head = names.length === 1 ? names[0] : `${names.slice(0, -1).join('、')}或${names[names.length - 1]}`;
    return `${spaced(head)}${g.length === 1 ? '会得到' : '都会得到'} ${fmt(g[0].v)}`;
  }).join('；');
  return [en.charAt(0).toUpperCase() + en.slice(1) + '.', zh + '。'];
}

type Fit = { ka: number; kb: number; x11: number; x12: number; x21: number; x22: number };
/** Exact sampling space of card 5 (plan: 1944 sets): every K pair times every X, with the plan's range, denominator and wrong-route guards. K = [[ka, kb], [kb, ka]], so K = (A/4)... use quarters as integers. */
function buildFitSpace(): Fit[] {
  const pairs: [number, number][] = [[1.25, 0.75], [1.25, -0.75], [1.5, 0.5], [1.5, -0.5], [2.5, 1.5], [2.5, -1.5], [3, 1], [3, -1]];
  const E = [-2, -1, 0, 1, 2];
  const out: Fit[] = [];
  for (const [ka, kb] of pairs) {
    const A = ka * 4, B = kb * 4; // integers
    const det16 = A * A - B * B;  // 16·det K
    for (const x11 of E) for (const x12 of E) for (const x21 of E) for (const x22 of E) {
      const g11 = x11 * x11 + x12 * x12, g12 = x11 * x21 + x12 * x22, g22 = x21 * x21 + x22 * x22;
      // key = (ka (g11 + g22) - 2 kb g12) / det = 4 (A (g11 + g22) - 2 B g12) / det16 ... exact integer numerator over det16
      const keyNum = 4 * (A * (g11 + g22) - 2 * B * g12), keyDen = det16;
      const key = keyNum / keyDen;
      if (key < 1 - 1e-12 || key > 12 + 1e-12 || !isAllowedDen(keyNum, keyDen)) continue;
      const h11 = x11 * x11 + x21 * x21, h12 = x11 * x12 + x21 * x22, h22 = x12 * x12 + x22 * x22; // XᵀX
      const det = det16 / 16;
      const r1 = (ka * (h11 + h22) - 2 * kb * h12) / det;
      const r2 = ka * (g11 + g22) + 2 * kb * g12;
      const r3 = key / 2;
      const r4 = (g11 + g22) / ka;
      if ([r1, r2, r3, r4].every(r => Math.abs(r - key) >= 0.5 - 1e-9)) out.push({ ka, kb, x11, x12, x21, x22 });
    }
  }
  return out;
}
type Chal = { z1: number; z2: number; s2: number; x11: number; x12: number; x21: number; x22: number };
/** Exact sampling space of card 9 (plan: 1572 sets). */
function buildChallengeSpace(): Chal[] {
  const Z = [-2, -1, 1, 2], E = [-2, -1, 0, 1, 2];
  const out: Chal[] = [];
  for (const z1 of Z) for (const z2 of Z) for (const s2 of [1, 2, 3]) {
    const det = s2 * (s2 + z1 * z1 + z2 * z2);
    const k11 = z1 * z1 + s2, k12 = z1 * z2, k22 = z2 * z2 + s2;
    const kp12 = z1 * z2 + s2, kpDet = k11 * k22 - kp12 * kp12;
    for (const x11 of E) for (const x12 of E) for (const x21 of E) for (const x22 of E) {
      const g11 = x11 * x11 + x12 * x12, g12 = x11 * x21 + x12 * x22, g22 = x21 * x21 + x22 * x22;
      const h11 = x11 * x11 + x21 * x21, h12 = x11 * x12 + x21 * x22, h22 = x12 * x12 + x22 * x22;
      const keyNum = k22 * g11 - 2 * k12 * g12 + k11 * g22;
      const key = keyNum / det;
      if (key < 1 - 1e-12 || key > 12 + 1e-12 || !isAllowedDen(keyNum, det)) continue;
      const r1 = (k22 * h11 - 2 * k12 * h12 + k11 * h22) / det;
      const r2 = k11 * g11 + 2 * k12 * g12 + k22 * g22;
      const r3 = g11 / k11 + g22 / k22;
      const r4 = (g11 + g22) / s2;
      const r5 = kpDet === 0 ? null : (k22 * g11 - 2 * kp12 * g12 + k11 * g22) / kpDet;
      if ([r1, r2, r3, r4, ...(r5 === null ? [] : [r5])].every(r => Math.abs(r - key) >= 0.5 - 1e-9)) out.push({ z1, z2, s2, x11, x12, x21, x22 });
    }
  }
  return out;
}
const FIT_SPACE = buildFitSpace();
const CHAL_SPACE = buildChallengeSpace();
/** Sizes of the two enumerated sampling spaces, for the oracle test. */
export const gp26SpaceSizes = { dataFit: FIT_SPACE.length, challenge: CHAL_SPACE.length };

export const gp26: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-26');
  warm(g);

  // Card 1: ppca-cov
  const c1 = retry(() => {
    const w = [g.pick([-2, -1, 0, 1, 2]), g.pick([-2, -1, 0, 1, 2]),
               g.pick([-2, -1, 0, 1, 2]), g.pick([-2, -1, 0, 1, 2]),
               g.pick([-2, -1, 0, 1, 2]), g.pick([-2, -1, 0, 1, 2])];
    const ij = g.pick([[1, 2], [1, 3], [2, 3]]);
    const s2 = g.pick([1, 2, 3]);
    return { w, i: ij[0], j: ij[1], s2 };
  }, v => {
    const [w11, w12, w21, w22, w31, w32] = v.w;
    const rows = [[w11, w12], [w21, w22], [w31, w32]];
    const ri = rows[v.i - 1], rj = rows[v.j - 1];
    const key = ri[0] * rj[0] + ri[1] * rj[1];
    if (key === 0) return false;
    const r1 = key + v.s2;
    const r2 = w11 * w12 + w21 * w22 + w31 * w32;
    const r3 = ri[0] * rj[0];
    const r4 = ri[0] * ri[0] + ri[1] * ri[1] + v.s2;
    const r5 = -key;
    return Math.abs(r1 - key) >= 1 && Math.abs(r2 - key) >= 1 && Math.abs(r3 - key) >= 1 && Math.abs(r4 - key) >= 1 && Math.abs(r5 - key) >= 1;
  });
  const c1w = c1.w;
  const c1rows = [[c1w[0], c1w[1]], [c1w[2], c1w[3]], [c1w[4], c1w[5]]];
  const c1ri = c1rows[c1.i - 1], c1rj = c1rows[c1.j - 1];
  const c1key = c1ri[0] * c1rj[0] + c1ri[1] * c1rj[1];
  const c1vari = c1ri[0] * c1ri[0] + c1ri[1] * c1ri[1] + c1.s2;
  const c1col = c1w[0] * c1w[1] + c1w[2] * c1w[3] + c1w[4] * c1w[5];
  const c1xi = 'x' + sub(c1.i), c1xj = 'x' + sub(c1.j);
  const c1term = `${par(c1ri[0])}·${par(c1rj[0])} + ${par(c1ri[1])}·${par(c1rj[1])} = ${num(c1ri[0] * c1rj[0])} ${term(c1ri[1] * c1rj[1])}`;
  const c1slips = slipText([
    { en: 'adding the noise variance σ² to it', zh: '把噪声方差 σ² 加上去', v: c1key + c1.s2 },
    { en: 'pairing the columns of W (the matrix WᵀW)', zh: '配对 W 的列（即矩阵 WᵀW）', v: c1col },
    { en: 'using the first latent dimension alone', zh: '只用第一个潜变量维度', v: c1ri[0] * c1rj[0] },
  ], num);

  // Card 2: ppca-det
  const c2 = retry(() => {
    const a = g.pick([-3, -2, -1, 1, 2, 3]);
    const b = g.pick([-3, -2, -1, 1, 2, 3]);
    const s2 = g.pick([2, 3, 4]);
    return { a, b, s2 };
  }, v => {
    const key = v.s2 * (v.s2 + v.a * v.a + v.b * v.b);
    const r1 = (v.a * v.a + v.s2) * (v.b * v.b + v.s2);
    const r2 = v.s2 * v.s2;
    const r3 = v.a * v.a + v.b * v.b + 2 * v.s2;
    const r4 = v.s2 + v.a * v.a + v.b * v.b;
    return Math.abs(r1 - key) >= 1 && Math.abs(r2 - key) >= 1 && Math.abs(r3 - key) >= 1 && Math.abs(r4 - key) >= 1;
  });
  const c2a2s = c2.a * c2.a + c2.s2;
  const c2b2s = c2.b * c2.b + c2.s2;
  const c2ab = c2.a * c2.b;
  const c2key = c2.s2 * (c2.s2 + c2.a * c2.a + c2.b * c2.b);
  const c2p1 = c2a2s * c2b2s;
  const c2p2 = c2ab * c2ab;
  const c2r1 = c2p1;
  const c2r2 = c2.s2 * c2.s2;
  const c2r3 = c2.a * c2.a + c2.b * c2.b + 2 * c2.s2;
  const c2slips = slipText([
    { en: 'leaving out the cross term', zh: '漏掉交叉项', v: c2r1 },
    { en: 'adding the determinants of the two parts (σ⁴)', zh: '把两部分的行列式相加（即 σ⁴）', v: c2r2 },
    { en: 'taking the trace instead', zh: '改取迹', v: c2r3 },
  ], num);

  // Card 3: latent-count
  const c3N = g.pick([100, 200, 500, 1000]);
  const c3D = g.pick([12, 20, 50]);
  const c3Q = g.pick([2, 3]);
  const c3key = c3N * c3Q;
  const c3DQ = c3D * c3Q;
  const c3ND = c3N * c3D;

  // Card 4: closed-form
  const c4kernel = g.pick(['linear', 'SE', 'Mat12', 'Mat32']);
  const c4Q = g.pick([1, 2, 3]);
  const c4kernelEN = c4kernel === 'linear' ? 'the linear kernel k(z, z′) = zᵀz′ (dual PPCA)' :
    c4kernel === 'SE' ? 'the squared exponential kernel k = σ_f² exp(−r²/(2ℓ²)) with r = ‖z − z′‖' :
    c4kernel === 'Mat12' ? 'the Matérn-1/2 kernel k = σ_f² exp(−r/ℓ) with r = ‖z − z′‖' :
    'the Matérn-3/2 kernel k = σ_f² (1 + √3 r/ℓ) exp(−√3 r/ℓ) with r = ‖z − z′‖';
  const c4kernelZH = c4kernel === 'linear' ? '线性核 k(z, z′) = zᵀz′（对偶 PPCA）' :
    c4kernel === 'SE' ? '平方指数核 k = σ_f² exp(−r²/(2ℓ²))，其中 r = ‖z − z′‖' :
    c4kernel === 'Mat12' ? '马特恩-1/2 核 k = σ_f² exp(−r/ℓ)，其中 r = ‖z − z′‖' :
    '马特恩-3/2 核 k = σ_f² (1 + √3 r/ℓ) exp(−√3 r/ℓ)，其中 r = ‖z − z′‖';
  const c4correctIdx = c4kernel === 'linear' ? 0 : 1;

  // Card 5: data-fit
  const c5 = g.pick(FIT_SPACE);
  const c5det = c5.ka * c5.ka - c5.kb * c5.kb;
  const c5inv11 = c5.ka / c5det, c5inv12 = -c5.kb / c5det, c5inv22 = c5.ka / c5det;
  const c5xx11 = c5.x11 * c5.x11 + c5.x12 * c5.x12;
  const c5xx12 = c5.x11 * c5.x21 + c5.x12 * c5.x22;
  const c5xx22 = c5.x21 * c5.x21 + c5.x22 * c5.x22;
  const c5key = c5inv11 * c5xx11 + c5inv12 * c5xx12 + c5inv12 * c5xx12 + c5inv22 * c5xx22;
  // column d of X holds the d-th feature of both data points: column 1 = (x11, x21), column 2 = (x12, x22)
  const c5q1 = c5inv11 * c5.x11 * c5.x11 + 2 * c5inv12 * c5.x11 * c5.x21 + c5inv22 * c5.x21 * c5.x21;
  const c5q2 = c5inv11 * c5.x12 * c5.x12 + 2 * c5inv12 * c5.x12 * c5.x22 + c5inv22 * c5.x22 * c5.x22;
  const c5r1 = c5inv11 * (c5.x11 * c5.x11 + c5.x21 * c5.x21) + c5inv12 * (c5.x11 * c5.x12 + c5.x21 * c5.x22) + c5inv12 * (c5.x11 * c5.x12 + c5.x21 * c5.x22) + c5inv22 * (c5.x12 * c5.x12 + c5.x22 * c5.x22);
  const c5r2 = c5.ka * c5xx11 + c5.kb * c5xx12 + c5.kb * c5xx12 + c5.ka * c5xx22;
  const c5r3 = c5key / 2;
  const c5r4 = (c5xx11 + c5xx22) / c5.ka;
  const c5terms = `${pf(c5inv11)}·${pf(c5xx11)} + ${pf(c5inv12)}·${pf(c5xx12)} + ${pf(c5inv12)}·${pf(c5xx12)} + ${pf(c5inv22)}·${pf(c5xx22)}`;
  const c5slips = slipText([
    { en: 'mixing up rows and columns of X (tr(K⁻¹XᵀX))', zh: '混淆 X 的行与列（tr(K⁻¹XᵀX)）', v: c5r1 },
    { en: 'forgetting the inverse (tr(K XXᵀ))', zh: '忘记求逆（tr(K XXᵀ)）', v: c5r2 },
    { en: 'also applying the factor ½ of the objective', zh: '多乘目标函数里的因子 ½', v: c5r3 },
    { en: 'replacing K by its diagonal entry', zh: '把 K 换成它的对角元', v: c5r4 },
  ], exact);

  // Card 6: map-prior
  const c6 = retry(() => {
    const z = [g.pick([-2, -1, 0, 1, 2]), g.pick([-2, -1, 0, 1, 2]),
               g.pick([-2, -1, 0, 1, 2]), g.pick([-2, -1, 0, 1, 2]),
               g.pick([-2, -1, 0, 1, 2]), g.pick([-2, -1, 0, 1, 2])];
    return { z11: z[0], z12: z[1], z21: z[2], z22: z[3], z31: z[4], z32: z[5] };
  }, v => {
    const ss = v.z11 * v.z11 + v.z12 * v.z12 + v.z21 * v.z21 + v.z22 * v.z22 + v.z31 * v.z31 + v.z32 * v.z32;
    if (ss < 4 || ss > 14) return false;
    const key = -ss / 2;
    const r1 = -ss;
    const r2 = ss / 2;
    const r3 = -(Math.abs(v.z11) + Math.abs(v.z12) + Math.abs(v.z21) + Math.abs(v.z22) + Math.abs(v.z31) + Math.abs(v.z32)) / 2;
    const sum1 = v.z11 + v.z21 + v.z31;
    const sum2 = v.z12 + v.z22 + v.z32;
    const r4 = -(sum1 * sum1 + sum2 * sum2) / 2;
    return Math.abs(r1 - key) >= 1 && Math.abs(r2 - key) >= 1 && Math.abs(r3 - key) >= 1 && Math.abs(r4 - key) >= 1;
  });
  const c6n1 = c6.z11 * c6.z11 + c6.z12 * c6.z12;
  const c6n2 = c6.z21 * c6.z21 + c6.z22 * c6.z22;
  const c6n3 = c6.z31 * c6.z31 + c6.z32 * c6.z32;
  const c6ss = c6n1 + c6n2 + c6n3;
  const c6key = -c6ss / 2;
  const c6r1 = -c6ss;
  const c6r3 = -(Math.abs(c6.z11) + Math.abs(c6.z12) + Math.abs(c6.z21) + Math.abs(c6.z22) + Math.abs(c6.z31) + Math.abs(c6.z32)) / 2;
  const c6sum1 = c6.z11 + c6.z21 + c6.z31;
  const c6sum2 = c6.z12 + c6.z22 + c6.z32;
  const c6r4 = -(c6sum1 * c6sum1 + c6sum2 * c6sum2) / 2;
  const c6slips = slipText([
    { en: 'forgetting the ½', zh: '漏掉 ½', v: c6r1 },
    { en: 'adding the points first and then squaring', zh: '先把各点相加再平方', v: c6r4 },
    { en: 'not squaring the entries', zh: '不对元素取平方', v: c6r3 },
  ], exact);

  // Card 7: bgplvm-interval
  const c7m = g.pick([-3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3]);
  const c7S = g.pick([0.25, 2.25, 4, 9]);
  const c7r = Math.sqrt(c7S);
  const c7key = c7m + 2 * c7r;
  const c7lo = c7m - 2 * c7r;
  const c7r1 = c7m + 2 * c7S;
  const c7r2 = c7m + c7r;
  const c7r3 = c7lo;
  const c7r4 = 2 * c7r;
  const c7slips = slipText([
    { en: 'using the variance as if it were a standard deviation', zh: '把方差当作标准差', v: c7r1 },
    { en: 'taking one standard deviation', zh: '只取一个标准差', v: c7r2 },
    { en: 'reading off the lower end', zh: '取下端点', v: c7r3 },
    { en: 'reporting the width of the interval', zh: '取区间宽度', v: c7r4 },
  ], num);

  // Card 8: not-gaussian
  const c8kernel = g.pick(['SE', 'Mat12', 'Mat32', 'linear']);
  const c8Q = g.pick([1, 2, 3]);
  const c8kernelEN = c8kernel === 'SE' ? 'a squared exponential kernel' :
    c8kernel === 'Mat12' ? 'a Matérn-1/2 kernel' :
    c8kernel === 'Mat32' ? 'a Matérn-3/2 kernel' :
    'the linear kernel k(z, z′) = zᵀz′';
  const c8kernelZH = c8kernel === 'SE' ? '平方指数核' :
    c8kernel === 'Mat12' ? '马特恩-1/2 核' :
    c8kernel === 'Mat32' ? '马特恩-3/2 核' :
    '线性核 k(z, z′) = zᵀz′';

  // Card 9: challenge
  const c9 = g.pick(CHAL_SPACE);
  const c9det = c9.s2 * (c9.s2 + c9.z1 * c9.z1 + c9.z2 * c9.z2);
  const c9inv11 = (c9.z2 * c9.z2 + c9.s2) / c9det;
  const c9inv12 = -(c9.z1 * c9.z2) / c9det;
  const c9inv22 = (c9.z1 * c9.z1 + c9.s2) / c9det;
  const c9xx11 = c9.x11 * c9.x11 + c9.x12 * c9.x12;
  const c9xx12 = c9.x11 * c9.x21 + c9.x12 * c9.x22;
  const c9xx22 = c9.x21 * c9.x21 + c9.x22 * c9.x22;
  const c9key = c9inv11 * c9xx11 + c9inv12 * c9xx12 + c9inv12 * c9xx12 + c9inv22 * c9xx22;
  const c9q1 = c9inv11 * c9.x11 * c9.x11 + 2 * c9inv12 * c9.x11 * c9.x21 + c9inv22 * c9.x21 * c9.x21;
  const c9q2 = c9inv11 * c9.x12 * c9.x12 + 2 * c9inv12 * c9.x12 * c9.x22 + c9inv22 * c9.x22 * c9.x22;
  const c9r1 = c9inv11 * (c9.x11 * c9.x11 + c9.x21 * c9.x21) + c9inv12 * (c9.x11 * c9.x12 + c9.x21 * c9.x22) + c9inv12 * (c9.x11 * c9.x12 + c9.x21 * c9.x22) + c9inv22 * (c9.x12 * c9.x12 + c9.x22 * c9.x22);
  const c9k11 = c9.z1 * c9.z1 + c9.s2, c9k12 = c9.z1 * c9.z2, c9k22 = c9.z2 * c9.z2 + c9.s2;
  const c9r2 = c9k11 * c9xx11 + c9k12 * c9xx12 + c9k12 * c9xx12 + c9k22 * c9xx22;
  const c9r3 = (c9xx11 / c9k11) + (c9xx22 / c9k22);
  const c9r4 = (c9xx11 + c9xx22) / c9.s2;
  const c9kp11 = c9.z1 * c9.z1 + c9.s2, c9kp12 = c9.z1 * c9.z2 + c9.s2, c9kp22 = c9.z2 * c9.z2 + c9.s2;
  const c9kpDet = c9kp11 * c9kp22 - c9kp12 * c9kp12;
  let c9r5 = 0;
  if (c9kpDet !== 0) {
    const c9kpinv11 = c9kp22 / c9kpDet, c9kpinv12 = -c9kp12 / c9kpDet, c9kpinv22 = c9kp11 / c9kpDet;
    c9r5 = c9kpinv11 * c9xx11 + c9kpinv12 * c9xx12 + c9kpinv12 * c9xx12 + c9kpinv22 * c9xx22;
  }
  const c9terms = `${pf(c9inv11)}·${pf(c9xx11)} + ${pf(c9inv12)}·${pf(c9xx12)} + ${pf(c9inv12)}·${pf(c9xx12)} + ${pf(c9inv22)}·${pf(c9xx22)}`;
  const c9slips = slipText([
    { en: 'replacing K⁻¹ by K', zh: '把 K⁻¹ 换成 K', v: c9r2 },
    { en: 'mixing up rows and columns of X', zh: '混淆 X 的行与列', v: c9r1 },
    { en: 'ignoring the cross term of K', zh: '忽略 K 的交叉项', v: c9r3 },
    { en: 'using only σ²I', zh: '只用 σ²I', v: c9r4 },
    ...(c9kpDet !== 0 ? [{ en: 'adding σ² to every entry of ZZᵀ', zh: '把 σ² 加到 ZZᵀ 的每个元素上', v: c9r5 }] : []),
  ], exact);

  return [
    g.number({
      id: 'ppca-cov',
      title: t('Covariance of two features', '两个特征的协方差'),
      prompt: t(
        `Probabilistic PCA with D = 3 features and Q = 2 latent dimensions generates x = W z + ε with z ∼ N(0, I) and ε ∼ N(0, σ²I), where z and ε are independent (Lecture 10 p. 15). The loading matrix is W = ${mat([[num(c1w[0]), num(c1w[1])], [num(c1w[2]), num(c1w[3])], [num(c1w[4]), num(c1w[5])]])} (one row per feature) and σ² = ${c1.s2}. What is the covariance Cov(${c1xi}, ${c1xj}) of feature ${c1.i} and feature ${c1.j}? Give an integer.`,
        `概率 PCA 有 D = 3 个特征和 Q = 2 个潜变量维度，生成方式为 x = W z + ε，其中 z ∼ N(0, I)，ε ∼ N(0, σ²I)，且 z 与 ε 相互独立（第 10 讲第 15 页）。载荷矩阵为 W = ${mat([[num(c1w[0]), num(c1w[1])], [num(c1w[2]), num(c1w[3])], [num(c1w[4]), num(c1w[5])]])}（每一行对应一个特征），σ² = ${c1.s2}。特征 ${c1.i} 与特征 ${c1.j} 的协方差 Cov(${c1xi}, ${c1xj}) 是多少？请填整数。`
      ),
      fields: [{ label: t(`Cov(${c1xi}, ${c1xj})`, `Cov(${c1xi}, ${c1xj})`), answer: c1key, tolerance: 0.006 }],
      hint: t(
        'Each row of W is the vector that belongs to one feature. Ask whether the noise of one feature is correlated with the noise of another.',
        'W 的每一行是对应一个特征的向量。想一想一个特征的噪声是否与另一个特征的噪声相关。'
      ),
      explanation: t(
        `With z ∼ N(0, I) and independent noise the covariance matrix of x is W Wᵀ + σ²I (Lecture 10 p. 15). Features ${c1.i} and ${c1.j} are different, so we need an off-diagonal entry, where σ²I is zero: it is the dot product of row ${c1.i} and row ${c1.j} of W, ${c1term} = ${num(c1key)}. The noise variance σ² = ${c1.s2} appears only on the diagonal, in Var(${c1xi}) = ${c1vari}. ${c1slips[0]}`,
        `因为 z ∼ N(0, I) 且噪声独立，x 的协方差矩阵为 W Wᵀ + σ²I（第 10 讲第 15 页）。特征 ${c1.i} 与特征 ${c1.j} 不同，所以要的是非对角元，那里 σ²I 为零：它等于 W 的第 ${c1.i} 行与第 ${c1.j} 行的内积 ${c1term} = ${num(c1key)}。噪声方差 σ² = ${c1.s2} 只出现在对角线上，即 Var(${c1xi}) = ${c1vari}。若${c1slips[1]}`
      ),
      audit: { kind: 'GP-26:ppca-cov', params: { w11: c1w[0], w12: c1w[1], w21: c1w[2], w22: c1w[3], w31: c1w[4], w32: c1w[5], s2: c1.s2, i: c1.i, j: c1.j } }
    }),
    g.number({
      id: 'ppca-det',
      title: t('Why PPCA needs noise', '为什么 PPCA 需要噪声'),
      prompt: t(
        `Probabilistic PCA with D = 2 features and Q = 1 latent dimension has the loading matrix W = ${mat([[num(c2.a)], [num(c2.b)]])} (a single column) and noise variance σ² = ${c2.s2}. The marginal covariance of x is Σ = W Wᵀ + σ²I (Lecture 10 p. 15). What is the determinant |Σ|? Give an integer.`,
        `概率 PCA 有 D = 2 个特征和 Q = 1 个潜变量维度，载荷矩阵为 W = ${mat([[num(c2.a)], [num(c2.b)]])}（只有一列），噪声方差 σ² = ${c2.s2}。x 的边际协方差为 Σ = W Wᵀ + σ²I（第 10 讲第 15 页）。行列式 |Σ| 是多少？请填整数。`
      ),
      fields: [{ label: t('|Σ|', '|Σ|'), answer: c2key, tolerance: 0.006 }],
      hint: t(
        'Write Σ out as a 2 × 2 matrix first; its entries come from the two numbers in W and from σ².',
        '先把 Σ 写成 2 × 2 矩阵，它的元素由 W 中的两个数和 σ² 得到。'
      ),
      explanation: t(
        `W Wᵀ = ${mat([[num(c2.a * c2.a), num(c2ab)], [num(c2ab), num(c2.b * c2.b)]])}, so Σ = ${mat([[num(c2a2s), num(c2ab)], [num(c2ab), num(c2b2s)]])} (diagonal entries ${num(c2a2s)} and ${num(c2b2s)}). |Σ| = ${num(c2a2s)}·${num(c2b2s)} − ${sq(c2ab)} = ${num(c2p1)} − ${num(c2p2)} = ${num(c2key)}. W Wᵀ alone has determinant 0 (it has rank 1 < D = 2), so without σ² the matrix is singular and x would have no density; adding σ²I makes Σ positive definite. ${c2slips[0]}`,
        `W Wᵀ = ${mat([[num(c2.a * c2.a), num(c2ab)], [num(c2ab), num(c2.b * c2.b)]])}，所以 Σ = ${mat([[num(c2a2s), num(c2ab)], [num(c2ab), num(c2b2s)]])}（对角元为 ${num(c2a2s)} 与 ${num(c2b2s)}）。|Σ| = ${num(c2a2s)}·${num(c2b2s)} − ${sq(c2ab)} = ${num(c2p1)} − ${num(c2p2)} = ${num(c2key)}。单独的 W Wᵀ 行列式为 0（秩为 1，小于 D = 2），没有 σ² 时矩阵奇异，x 没有密度；加上 σ²I 才使 Σ 正定。若${c2slips[1]}`
      ),
      audit: { kind: 'GP-26:ppca-det', params: { a: c2.a, b: c2.b, s2: c2.s2 } }
    }),
    g.number({
      id: 'latent-count',
      title: t('What the dual model keeps', '对偶模型保留什么'),
      prompt: t(
        `A GPLVM is fitted to N = ${c3N} data points with D = ${c3D} features, using a latent space with Q = ${c3Q} dimensions. The mapping from latent space to data is integrated out, and the log marginal likelihood log p(X | Z, θ, σ) is maximised over the latent matrix Z, the kernel parameters θ and the noise σ (Lecture 10 p. 23). How many numbers does Z contain? Do not count θ and σ. Give an integer.`,
        `对 N = ${c3N} 个数据点、D = ${c3D} 个特征拟合一个 GPLVM，潜变量空间有 Q = ${c3Q} 个维度。从潜变量空间到数据的映射被积分掉，对数边际似然 log p(X | Z, θ, σ) 对潜变量矩阵 Z、核参数 θ 和噪声 σ 求最大（第 10 讲第 23 页）。Z 中共有多少个数？不计 θ 和 σ。请填整数。`
      ),
      fields: [{ label: t('Entries of Z', 'Z 的元素个数'), answer: c3key, tolerance: 0.006 }],
      hint: t(
        'Every data point gets its own latent point. Count the points and the coordinates of one point.',
        '每个数据点都有自己的潜变量点。数一数点的个数和每个点的坐标个数。'
      ),
      explanation: t(
        `Z ∈ ℝ^{N×Q} holds one latent point zₙ with Q coordinates for each of the N data points (Lecture 10 p. 5), so it has ${c3N}·${c3Q} = ${c3key} numbers. Dual PPCA and the GPLVM integrate out the mapping W and keep Z as the unknown (Lecture 10 pp. 19, 23; GPML pdf p. 214); PPCA does the opposite, integrates out Z and keeps the loading matrix W ∈ ℝ^{D×Q} with ${c3D}·${c3Q} = ${c3DQ} numbers. The data matrix X itself has ${c3N}·${c3D} = ${c3ND} entries and is not an unknown.`,
        `Z ∈ ℝ^{N×Q} 为 N 个数据点中的每一个保存一个有 Q 个坐标的潜变量点 zₙ（第 10 讲第 5 页），所以共有 ${c3N}·${c3Q} = ${c3key} 个数。对偶 PPCA 与 GPLVM 积分掉映射 W，保留 Z 作为未知量（第 10 讲第 19、23 页；教材第 214 页）；PPCA 则相反，积分掉 Z，保留载荷矩阵 W ∈ ℝ^{D×Q}，有 ${c3D}·${c3Q} = ${c3DQ} 个数。数据矩阵 X 本身有 ${c3N}·${c3D} = ${c3ND} 个元素，不是未知量。`
      ),
      audit: { kind: 'GP-26:latent-count', params: { N: c3N, D: c3D, Q: c3Q } }
    }),
    g.choice({
      id: 'closed-form',
      title: t('When is there a closed form?', '何时有解析解？'),
      prompt: t(
        `A GPLVM with a ${c4Q}-dimensional latent space models every feature column x_d of the data matrix X as an independent zero-mean GP over the latent points, with covariance K = K_ZZ + σ²I. The kernel is ${c4kernelEN}. We want the latent points Z, together with θ and σ, that maximise the log marginal likelihood. Which statement is correct (Lecture 10 pp. 22 to 25)?`,
        `一个潜变量空间为 ${c4Q} 维的 GPLVM 把数据矩阵 X 的每个特征列 x_d 建模为潜变量点上相互独立的零均值 GP，协方差为 K = K_ZZ + σ²I。核为${c4kernelZH}。我们要求出使对数边际似然最大的潜变量点 Z，以及 θ 和 σ。下面哪一项正确（第 10 讲第 22 至 25 页）？`
      ),
      options: [
        t('An analytic solution exists: an eigenvalue problem gives Z', '存在解析解：解一个特征值问题即可得到 Z'),
        t('No analytic solution exists: Z, θ and σ are found by gradient-based optimisation', '不存在解析解：要用基于梯度的优化同时求出 Z、θ 和 σ'),
        t('The objective is convex, so a single run from any starting point finds the global optimum', '目标函数是凸的，所以从任意起点出发运行一次就能找到全局最优'),
        t('Z is obtained by conditioning on X as for the test points of a GP regression, so nothing needs to be optimised', '像高斯过程回归对测试点那样，以 X 为条件即可得到 Z，因此无需任何优化')
      ],
      correct: c4correctIdx,
      hint: t(
        'Ask what changes in the log marginal likelihood when the kernel is not the linear kernel of dual PPCA.',
        '想一想当核不是对偶 PPCA 的线性核时，对数边际似然有什么变化。'
      ),
      explanation: c4kernel === 'linear' ? t(
        'With the linear kernel this is dual PPCA (Lecture 10 p. 20), and for PCA, PPCA and DPPCA an analytic solution exists via an eigenvalue problem (p. 22). The objective is not convex in general (p. 25) and the latent points are unknowns of the model, so neither a single run from any start nor conditioning on X gives Z.',
        '核为线性核时这就是对偶 PPCA（第 10 讲第 20 页），而对 PCA、PPCA 和 DPPCA，都可以通过特征值问题得到解析解（第 22 页）。一般来说目标函数不是凸的（第 25 页），潜变量点又是模型的未知量，所以既不能从任意起点运行一次就得到 Z，也不能靠以 X 为条件得到 Z。'
      ) : t(
        `With the ${c4kernel === 'SE' ? 'squared exponential' : c4kernel === 'Mat12' ? 'Matérn-1/2' : 'Matérn-3/2'} kernel the analytic solution is lost (Lecture 10 p. 23): Z, θ and σ are found by gradient-based optimisation of log p(X | Z, θ, σ). The problem is very non-convex, so several restarts and a good initialisation matter, for example Z from the PCA of X (pp. 23 and 25). The latent points are unknowns of the model, not test inputs, so conditioning on X does not produce them.`,
        `核为${c4kernel === 'SE' ? '平方指数核' : c4kernel === 'Mat12' ? '马特恩-1/2 核' : '马特恩-3/2 核'}时失去解析解（第 10 讲第 23 页）：要用基于梯度的优化对 log p(X | Z, θ, σ) 同时求出 Z、θ 和 σ。这个问题高度非凸，所以需要多次重启和好的初始化，例如取 X 的 PCA 结果作为 Z（第 23、25 页）。潜变量点是模型的未知量而不是测试输入，因此以 X 为条件得不到它们。`
      )
    }),
    g.number({
      id: 'data-fit',
      title: t('The data-fit term', '数据拟合项'),
      prompt: t(
        `Up to a constant, the GPLVM log marginal likelihood is −(D/2) log|K| − ½ tr(K⁻¹XXᵀ) (Lecture 10 p. 23), where K = K_ZZ + σ²I is the N × N covariance of one feature column and X is the N × D data matrix with one row per data point and one column per feature. Take N = 2, D = 2, K = ${mat([[num(c5.ka), num(c5.kb)], [num(c5.kb), num(c5.ka)]])} and X = ${mat([[num(c5.x11), num(c5.x12)], [num(c5.x21), num(c5.x22)]])}. What is tr(K⁻¹XXᵀ)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `GPLVM 的对数边际似然在相差一个常数的意义下为 −(D/2) log|K| − ½ tr(K⁻¹XXᵀ)（第 10 讲第 23 页），其中 K = K_ZZ + σ²I 是一个特征列的 N × N 协方差，X 是 N × D 的数据矩阵，每行对应一个数据点，每列对应一个特征。取 N = 2、D = 2，K = ${mat([[num(c5.ka), num(c5.kb)], [num(c5.kb), num(c5.ka)]])}，X = ${mat([[num(c5.x11), num(c5.x12)], [num(c5.x21), num(c5.x22)]])}。tr(K⁻¹XXᵀ) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('tr(K⁻¹XXᵀ)', 'tr(K⁻¹XXᵀ)'), answer: c5key, tolerance: 0.006 }],
      hint: t(
        'K is symmetric and its two diagonal entries are equal, so K⁻¹ has the same pattern. Decide whether to work with whole matrices or with one feature column at a time.',
        'K 是对称的，且两个对角元相等，所以 K⁻¹ 有同样的结构。想一想是对整个矩阵计算，还是一次只算一个特征列。'
      ),
      explanation: t(
        `|K| = ${sq(c5.ka)} − ${sq(c5.kb)} = ${exact(c5det)}, so K⁻¹ = ${mat([[exact(c5inv11), exact(c5inv12)], [exact(c5inv12), exact(c5inv22)]])}. XXᵀ = ${mat([[num(c5xx11), num(c5xx12)], [num(c5xx12), num(c5xx22)]])} (entry (m, n) is the dot product of the data points m and n). tr(K⁻¹XXᵀ) multiplies the two matrices entry by entry and adds: ${c5terms} = ${exact(c5key)}. The columns give the same number: x₁ᵀK⁻¹x₁ + x₂ᵀK⁻¹x₂ = ${exact(c5q1)} + ${exact(c5q2)} = ${exact(c5key)}. ${c5slips[0]}`,
        `|K| = ${sq(c5.ka)} − ${sq(c5.kb)} = ${exact(c5det)}，所以 K⁻¹ = ${mat([[exact(c5inv11), exact(c5inv12)], [exact(c5inv12), exact(c5inv22)]])}。XXᵀ = ${mat([[num(c5xx11), num(c5xx12)], [num(c5xx12), num(c5xx22)]])}（第 (m, n) 个元素是数据点 m 与 n 的内积）。tr(K⁻¹XXᵀ) 把两个矩阵逐元素相乘再求和：${c5terms} = ${exact(c5key)}。用列来算结果相同：x₁ᵀK⁻¹x₁ + x₂ᵀK⁻¹x₂ = ${exact(c5q1)} + ${exact(c5q2)} = ${exact(c5key)}。若${c5slips[1]}`
      ),
      audit: { kind: 'GP-26:data-fit', params: { ka: c5.ka, kb: c5.kb, x11: c5.x11, x12: c5.x12, x21: c5.x21, x22: c5.x22 } }
    }),
    g.number({
      id: 'map-prior',
      title: t('What the prior adds in MAP', 'MAP 中先验加了什么'),
      prompt: t(
        `MAP estimation for the GPLVM maximises log p(X | Z, θ, σ) + log p(Z) with the prior p(Z) = ∏ₙ N(zₙ | 0, I) (Lecture 10 pp. 24 and 28). There are N = 3 data points with Q = 2 latent coordinates each, stored as the rows of Z = ${mat([[num(c6.z11), num(c6.z12)], [num(c6.z21), num(c6.z22)], [num(c6.z31), num(c6.z32)]])}. One part of log p(Z) is a constant that does not depend on Z at all. What is the remaining part, the one that depends on Z? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `GPLVM 的 MAP 估计最大化 log p(X | Z, θ, σ) + log p(Z)，先验为 p(Z) = ∏ₙ N(zₙ | 0, I)（第 10 讲第 24、28 页）。共有 N = 3 个数据点，每个点有 Q = 2 个潜变量坐标，存放为 Z = ${mat([[num(c6.z11), num(c6.z12)], [num(c6.z21), num(c6.z22)], [num(c6.z31), num(c6.z32)]])} 的各行。log p(Z) 的一部分是完全不依赖于 Z 的常数。剩下的、依赖于 Z 的部分是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Part of log p(Z) that depends on Z', 'log p(Z) 中依赖于 Z 的部分'), answer: c6key, tolerance: 0.006 }],
      hint: t(
        'Write the log density of one point under N(0, I) and drop everything that does not contain zₙ.',
        '写出一个点在 N(0, I) 下的对数密度，去掉所有不含 zₙ 的部分。'
      ),
      explanation: t(
        `For one point log N(zₙ | 0, I) = −½‖zₙ‖² plus a constant (−(Q/2) ln 2π). Adding the three points: −½(‖z₁‖² + ‖z₂‖² + ‖z₃‖²) = −½(${num(c6n1)} + ${num(c6n2)} + ${num(c6n3)}) = −½·${num(c6ss)} = ${exact(c6key)}. This is the term that MAP adds to the likelihood; it pulls the latent points towards the origin, which is how the prior regularises the latent variables (Lecture 10 p. 24). ${c6slips[0]}`,
        `单个点 log N(zₙ | 0, I) = −½‖zₙ‖² 加上一个常数（−(Q/2) ln 2π）。三个点相加：−½(‖z₁‖² + ‖z₂‖² + ‖z₃‖²) = −½(${num(c6n1)} + ${num(c6n2)} + ${num(c6n3)}) = −½·${num(c6ss)} = ${exact(c6key)}。这就是 MAP 加到似然上的项；它把潜变量点拉向原点，也就是先验对潜变量起正则化作用（第 10 讲第 24 页）。若${c6slips[1]}`
      ),
      audit: { kind: 'GP-26:map-prior', params: { z11: c6.z11, z12: c6.z12, z21: c6.z21, z22: c6.z22, z31: c6.z31, z32: c6.z32 } }
    }),
    g.number({
      id: 'bgplvm-interval',
      title: t('Uncertainty of an embedding', '嵌入的不确定性'),
      prompt: t(
        `In a Bayesian GPLVM with a one-dimensional latent space, the latent coordinate of one data point has the variational distribution q(zₙ) = N(mₙ, Sₙ) (Lecture 10 p. 29) with mₙ = ${num(c7m)} and Sₙ = ${num(c7S)}. The interval from two standard deviations below the mean to two standard deviations above it holds about 95% of the probability mass (Assignment 5, Task 1, part c). What is the upper end of this interval? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `在潜变量空间为一维的贝叶斯 GPLVM 中，某个数据点的潜变量坐标有变分分布 q(zₙ) = N(mₙ, Sₙ)（第 10 讲第 29 页），其中 mₙ = ${num(c7m)}，Sₙ = ${num(c7S)}。从均值下方两个标准差到均值上方两个标准差的区间约含 95% 的概率质量（作业 5 第 1 题第 c 问）。这个区间的上端点是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Upper end', '上端点'), answer: c7key, tolerance: 0.006 }],
      hint: t(
        'In N(m, S) the second number is a variance. Convert it before scaling.',
        '在 N(m, S) 中第二个数是方差。先换算成标准差再放大。'
      ),
      explanation: t(
        `Sₙ = ${num(c7S)} is a variance, so the standard deviation is √${num(c7S)} = ${num(c7r)}. The upper end is mₙ + 2√Sₙ = ${num(c7m)} + 2·${num(c7r)} = ${num(c7key)}, and the lower end is ${num(c7lo)}. A standard GPLVM keeps only a point estimate of zₙ; the Bayesian GPLVM keeps a distribution for every embedding and so can show such an interval (Assignment 5, Task 1, part c). ${c7slips[0]}`,
        `Sₙ = ${num(c7S)} 是方差，所以标准差为 √${num(c7S)} = ${num(c7r)}。上端点为 mₙ + 2√Sₙ = ${num(c7m)} + 2·${num(c7r)} = ${num(c7key)}，下端点为 ${num(c7lo)}。标准 GPLVM 对 zₙ 只保留点估计；贝叶斯 GPLVM 为每个嵌入保留一个分布，因此能给出这样的区间（作业 5 第 1 题第 c 问）。若${c7slips[1]}`
      ),
      audit: { kind: 'GP-26:bgplvm-interval', params: { m: c7m, S: c7S } }
    }),
    g.choice({
      id: 'not-gaussian',
      title: t('Gaussian everywhere, still intractable', '处处是高斯，仍然不可解'),
      prompt: t(
        `A student reasons as follows. In PPCA the latent variables z can be integrated out exactly and the marginal of x is Gaussian. A Bayesian GPLVM with ${c8kernelEN} and a ${c8Q}-dimensional latent space has the same Gaussian prior p(Z) = ∏ N(zₙ | 0, I), and given Z every feature column is Gaussian, x_d ∼ N(0, K_ZZ + σ²I). So ∫ p(X | Z) p(Z) dZ must be just as tractable. Which statement points out the flaw (Lecture 10 p. 28)?`,
        `一位学生这样推理：在 PPCA 中潜变量 z 可以被精确积分掉，x 的边际分布是高斯的。使用${c8kernelZH}${c8kernel === 'linear' ? ' ' : ''}且潜变量空间为 ${c8Q} 维的贝叶斯 GPLVM 有同样的高斯先验 p(Z) = ∏ N(zₙ | 0, I)，并且给定 Z 时每个特征列都服从高斯分布 x_d ∼ N(0, K_ZZ + σ²I)。所以 ∫ p(X | Z) p(Z) dZ 同样应当容易计算。下面哪一项指出了其中的错误（第 10 讲第 28 页）？`
      ),
      options: [
        t('Z enters the kernel matrix K_ZZ non-linearly, inside its inverse and its determinant, so the integral over Z has no closed form', 'Z 以非线性方式进入核矩阵 K_ZZ，出现在其逆和行列式中，故对 Z 的积分无解析形式'),
        t('The prior p(Z) stops being Gaussian as soon as the kernel is not linear', '只要核不是线性核，先验 p(Z) 就不再是高斯分布'),
        t('Given Z the columns x_d are no longer Gaussian, because only the linear kernel gives a Gaussian process', '给定 Z 后各列 x_d 不再是高斯分布，因为只有线性核才给出高斯过程'),
        t('The integral over Z does not exist at all, because the latent dimension Q is smaller than the number D of features, so Z cannot describe X', '对 Z 的积分根本不存在，因为潜变量维度 Q 小于特征数 D，所以 Z 无法描述数据矩阵 X 的全部结构')
      ],
      correct: 0,
      hint: t(
        'Ask where Z appears in the expression for p(x_d | Z), and compare with where z appears in PPCA.',
        '想一想 Z 在 p(x_d | Z) 的表达式里出现在哪里，并与 PPCA 中 z 出现的位置比较。'
      ),
      explanation: t(
        'In PPCA the data depend on z linearly through W z, so integrating z out leaves the Gaussian N(0, W Wᵀ + σ²I) (Lecture 10 p. 15). In the GPLVM Z sits inside the kernel matrix K_ZZ, and p(x_d | Z) = N(x_d | 0, K_ZZ + σ²I) depends on Z through the inverse and the determinant of that matrix, which is non-linear in Z. The integral over Z is therefore intractable (Lecture 10 p. 28) and the marginal of X is not Gaussian. This is why the Bayesian GPLVM introduces a variational distribution q(Z) = ∏ N(zₙ | mₙ, Sₙ) and a lower bound (p. 29). The prior p(Z) is Gaussian for every kernel, every column is Gaussian given Z for every valid kernel, and Q < D is the normal situation.',
        '在 PPCA 中数据通过 W z 线性地依赖于 z，所以积分掉 z 后剩下高斯分布 N(0, W Wᵀ + σ²I)（第 10 讲第 15 页）。在 GPLVM 中 Z 位于核矩阵 K_ZZ 之内，p(x_d | Z) = N(x_d | 0, K_ZZ + σ²I) 通过该矩阵的逆和行列式依赖于 Z，这种依赖对 Z 是非线性的。因此对 Z 的积分不可解（第 10 讲第 28 页），X 的边际分布也不是高斯的。这就是贝叶斯 GPLVM 引入变分分布 q(Z) = ∏ N(zₙ | mₙ, Sₙ) 和下界的原因（第 29 页）。先验 p(Z) 对每种核都是高斯的，给定 Z 时每一列对每个合法的核都是高斯的，而 Q < D 是常态。'
      )
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the data fit of dual PPCA', '挑战：对偶 PPCA 的数据拟合'),
      prompt: t(
        `A dual PPCA model has N = 2 data points with one-dimensional latent positions z₁ = ${num(c9.z1)} and z₂ = ${num(c9.z2)} (Z is the column with these two entries), noise variance σ² = ${c9.s2} and D = 2 features. The data matrix, with one row per data point and one column per feature, is X = ${mat([[num(c9.x11), num(c9.x12)], [num(c9.x21), num(c9.x22)]])}. Let K be the covariance matrix that each feature column has in this model. What is tr(K⁻¹XXᵀ), the data-fit quantity in the GPLVM log marginal likelihood (Lecture 10 pp. 19 and 23)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `一个对偶 PPCA 模型有 N = 2 个数据点，一维潜变量位置为 z₁ = ${num(c9.z1)}、z₂ = ${num(c9.z2)}（Z 是由这两个数组成的列），噪声方差 σ² = ${c9.s2}，D = 2 个特征。数据矩阵每行对应一个数据点，每列对应一个特征，X = ${mat([[num(c9.x11), num(c9.x12)], [num(c9.x21), num(c9.x22)]])}。记 K 为该模型中每个特征列的协方差矩阵。tr(K⁻¹XXᵀ) 是多少？它是 GPLVM 对数边际似然中的数据拟合量（第 10 讲第 19、23 页）。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('tr(K⁻¹XXᵀ)', 'tr(K⁻¹XXᵀ)'), answer: c9key, tolerance: 0.006 }],
      hint: t(
        'First work out the matrix K that every feature column has; then evaluate the quantity exactly as in a plain GPLVM.',
        '先求出每个特征列所具有的矩阵 K，再像普通 GPLVM 那样计算这个量。'
      ),
      explanation: t(
        `Integrating out the weights W of dual PPCA gives the covariance K = ZZᵀ + σ²I for every feature column (Lecture 10 p. 19). ZZᵀ = ${mat([[num(c9.z1 * c9.z1), num(c9.z1 * c9.z2)], [num(c9.z1 * c9.z2), num(c9.z2 * c9.z2)]])}, so K = ${mat([[num(c9k11), num(c9k12)], [num(c9k12), num(c9k22)]])} with |K| = ${num(c9det)}, K⁻¹ = ${mat([[exact(c9inv11), exact(c9inv12)], [exact(c9inv12), exact(c9inv22)]])}. XXᵀ = ${mat([[num(c9xx11), num(c9xx12)], [num(c9xx12), num(c9xx22)]])}. Multiplying entry by entry and adding: ${c9terms} = ${exact(c9key)}; the two columns give ${exact(c9q1)} + ${exact(c9q2)} = ${exact(c9key)}. ${c9slips[0]} This game does not assess fitting a GPLVM by optimisation or the variational lower bound of the Bayesian GPLVM.`,
        `对偶 PPCA 积分掉权重 W 之后，每个特征列的协方差都是 K = ZZᵀ + σ²I（第 10 讲第 19 页）。ZZᵀ = ${mat([[num(c9.z1 * c9.z1), num(c9.z1 * c9.z2)], [num(c9.z1 * c9.z2), num(c9.z2 * c9.z2)]])}，所以 K = ${mat([[num(c9k11), num(c9k12)], [num(c9k12), num(c9k22)]])}，|K| = ${num(c9det)}，K⁻¹ = ${mat([[exact(c9inv11), exact(c9inv12)], [exact(c9inv12), exact(c9inv22)]])}。XXᵀ = ${mat([[num(c9xx11), num(c9xx12)], [num(c9xx12), num(c9xx22)]])}。逐元素相乘再求和：${c9terms} = ${exact(c9key)}；用两列来算得到 ${exact(c9q1)} + ${exact(c9q2)} = ${exact(c9key)}。若${c9slips[1]}本游戏不考查通过优化来拟合 GPLVM，也不考查贝叶斯 GPLVM 的变分下界。`
      ),
      audit: { kind: 'GP-26:challenge', params: { z1: c9.z1, z2: c9.z2, s2: c9.s2, x11: c9.x11, x12: c9.x12, x21: c9.x21, x22: c9.x22 } }
    })
  ];
};
