import type { CardGenerator } from '../../types';
import { fitView, type FigureShape } from '../../figure';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];
/** Fraction in parentheses when it contains a slash, so that chained divisions and powers read unambiguously. */
const pf = (text: string) => (text.includes('/') ? `(${text})` : text);
/** Exact rational, parenthesised when negative (par() would print a rounded decimal for fractions). */
const parx = (x: number) => (x < 0 ? `(${exact(x)})` : exact(x));

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

const LEG = t('(⁻ before the observation, ⁺ after it, ˢ after all observations)', '（⁻ 表示观测之前，⁺ 表示观测之后，ˢ 表示用上全部观测之后）');

function ratioStr(aNum: number, aDen: number): string {
  if (aDen === 2) return 'ln 2';
  if (aDen === 3 && aNum === 1) return 'ln 3';
  if (aDen === 3 && aNum === 2) return 'ln(3/2)';
  return '';
}

export const gp29: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-29');
  warm(g);

  // Card 1: discretise
  const c1 = g.pick([
    { aNum: 1, aDen: 2, s: 2 }, { aNum: 1, aDen: 2, s: 4 }, { aNum: 1, aDen: 2, s: 8 }, { aNum: 1, aDen: 2, s: 12 },
    { aNum: 1, aDen: 3, s: 3 }, { aNum: 1, aDen: 3, s: 9 }, { aNum: 1, aDen: 3, s: 18 },
    { aNum: 2, aDen: 3, s: 3 }, { aNum: 2, aDen: 3, s: 9 }, { aNum: 2, aDen: 3, s: 18 },
  ]);
  const c1Q = c1.s * (1 - (c1.aNum * c1.aNum) / (c1.aDen * c1.aDen));
  const c1a2 = frac(c1.aNum * c1.aNum, c1.aDen * c1.aDen);
  const c1omA2 = frac(c1.aDen * c1.aDen - c1.aNum * c1.aNum, c1.aDen * c1.aDen);
  const c1a2s = frac(c1.aNum * c1.aNum * c1.s, c1.aDen * c1.aDen);

  // Card 2: predict
  const c2Row = g.pick([
    { aNum: 1, aDen: 2, Q: 6, p: 4 }, { aNum: 1, aDen: 2, Q: 6, p: 6 },
    { aNum: 1, aDen: 2, Q: 9, p: 4 }, { aNum: 1, aDen: 2, Q: 9, p: 6 }, { aNum: 1, aDen: 2, Q: 9, p: 8 },
    { aNum: 1, aDen: 2, Q: 3, p: 2 },
    { aNum: 1, aDen: 3, Q: 16, p: 9 },
    { aNum: 2, aDen: 3, Q: 10, p: 9 },
  ]);
  const c2m = c2Row.aDen * g.pick([-3, -2, -1, 1, 2, 3]);
  const c2mp = (c2Row.aNum / c2Row.aDen) * c2m;
  const c2Pp = (c2Row.aNum * c2Row.aNum / (c2Row.aDen * c2Row.aDen)) * c2Row.p + c2Row.Q;
  const c2a2 = frac(c2Row.aNum * c2Row.aNum, c2Row.aDen * c2Row.aDen);
  const c2a2p = frac(c2Row.aNum * c2Row.aNum * c2Row.p, c2Row.aDen * c2Row.aDen);

  // Card 3: update
  const c3Row = g.pick([
    { Pp: 2, r: 2, denK: 2 }, { Pp: 4, r: 4, denK: 2 },
    { Pp: 6, r: 2, denK: 4 }, { Pp: 3, r: 1, denK: 4 },
    { Pp: 6, r: 3, denK: 3 }, { Pp: 4, r: 2, denK: 3 },
    { Pp: 9, r: 3, denK: 4 }, { Pp: 4, r: 1, denK: 5 },
  ]);
  const c3mp = g.pick([-3, -2, -1, 1, 2, 3]);
  const c3j = g.pick([-2, -1, 1, 2]);
  const c3y = c3mp + c3Row.denK * c3j;
  const c3v = c3y - c3mp;
  const c3S = c3Row.Pp + c3Row.r;
  const c3K = c3Row.Pp / c3S;
  const c3mPlus = c3mp + c3K * c3v;
  const c3PPlus = c3Row.Pp - c3K * c3S * c3K;

  // Card 4: forecast
  const c4 = g.pick([
    { aNum: 1, aDen: 2, s: 4, r: 4 }, { aNum: 1, aDen: 2, s: 8, r: 8 },
    { aNum: 1, aDen: 2, s: 12, r: 6 }, { aNum: 1, aDen: 2, s: 12, r: 12 },
    { aNum: 1, aDen: 3, s: 9, r: 9 },
    { aNum: 2, aDen: 3, s: 9, r: 9 }, { aNum: 2, aDen: 3, s: 18, r: 6 }, { aNum: 2, aDen: 3, s: 9, r: 3 },
  ]);
  const c4Q = c4.s * (1 - (c4.aNum * c4.aNum) / (c4.aDen * c4.aDen));
  const c4P1 = (c4.s * c4.r) / (c4.s + c4.r);
  const c4P2 = (c4.aNum * c4.aNum / (c4.aDen * c4.aDen)) * c4P1 + c4Q;
  const c4a2 = frac(c4.aNum * c4.aNum, c4.aDen * c4.aDen);
  const c4as = frac(c4.aNum * c4.s, c4.aDen);
  const c4as2 = frac(c4.aNum * c4.aNum * c4.s * c4.s, c4.aDen * c4.aDen);

  // Card 5: llh-term
  const c5 = retry(() => {
    const S = g.pick([1, 4, 8, 10]);
    const L = Math.round(Math.log(2 * Math.PI * S) * 100) / 100;
    const mag = S === 1 ? g.pick([1, 2, 3]) : S === 4 ? g.pick([2, 4, 6]) : S === 8 ? g.pick([2, 4, 6]) : g.pick([1, 2, 3, 4, 5, 6]);
    const sign = g.pick([-1, 1]);
    return { S, L, v: sign * mag };
  }, () => true);
  const c5q = (c5.v * c5.v) / c5.S;
  const c5ans = -(c5.L + c5q) / 2;

  // Card 6: rts-gain
  const c6 = g.pick([
    { aNum: 1, aDen: 2, p: 2, PpNum: 7, PpDen: 2 }, { aNum: 1, aDen: 2, p: 2, PpNum: 5, PpDen: 1 },
    { aNum: 1, aDen: 2, p: 3, PpNum: 9, PpDen: 2 }, { aNum: 1, aDen: 2, p: 4, PpNum: 7, PpDen: 1 },
    { aNum: 1, aDen: 2, p: 6, PpNum: 15, PpDen: 2 }, { aNum: 1, aDen: 2, p: 6, PpNum: 9, PpDen: 1 },
    { aNum: 1, aDen: 2, p: 4, PpNum: 10, PpDen: 1 }, { aNum: 1, aDen: 2, p: 3, PpNum: 6, PpDen: 1 },
    { aNum: 1, aDen: 3, p: 4, PpNum: 12, PpDen: 1 }, { aNum: 1, aDen: 3, p: 6, PpNum: 14, PpDen: 1 },
    { aNum: 1, aDen: 3, p: 8, PpNum: 16, PpDen: 1 },
    { aNum: 2, aDen: 3, p: 3, PpNum: 8, PpDen: 1 }, { aNum: 2, aDen: 3, p: 5, PpNum: 10, PpDen: 1 },
    { aNum: 2, aDen: 3, p: 9, PpNum: 14, PpDen: 1 },
  ]);
  const c6Pp = c6.PpNum / c6.PpDen;
  const c6G = (c6.aNum / c6.aDen) * c6.p / c6Pp;
  const c6ap = frac(c6.aNum * c6.p, c6.aDen);

  // Card 7: smooth
  const c7Row = g.pick([
    { aNum: 1, aDen: 2, p: 2, PpNum: 5, PpDen: 1, GNum: 1, GDen: 5 },
    { aNum: 1, aDen: 2, p: 3, PpNum: 9, PpDen: 2, GNum: 1, GDen: 3 },
    { aNum: 1, aDen: 2, p: 4, PpNum: 7, PpDen: 1, GNum: 2, GDen: 7 },
    { aNum: 1, aDen: 2, p: 6, PpNum: 15, PpDen: 2, GNum: 2, GDen: 5 },
    { aNum: 1, aDen: 2, p: 6, PpNum: 9, PpDen: 1, GNum: 1, GDen: 3 },
    { aNum: 1, aDen: 2, p: 4, PpNum: 10, PpDen: 1, GNum: 1, GDen: 5 },
    { aNum: 1, aDen: 2, p: 3, PpNum: 6, PpDen: 1, GNum: 1, GDen: 4 },
    { aNum: 1, aDen: 3, p: 6, PpNum: 14, PpDen: 1, GNum: 1, GDen: 7 },
    { aNum: 2, aDen: 3, p: 3, PpNum: 8, PpDen: 1, GNum: 1, GDen: 4 },
    { aNum: 2, aDen: 3, p: 5, PpNum: 10, PpDen: 1, GNum: 1, GDen: 3 },
  ]);
  const c7Pp = c7Row.PpNum / c7Row.PpDen;
  const c7diff = retry(() => g.pick([c7Row.GDen / 2, c7Row.GDen]), d => c7Pp - d > 0);
  const c7Ps = c7Pp - c7diff;
  const c7mf = c7Row.aDen * g.pick([-3, -2, -1, 1, 2, 3]);
  const c7mpred = (c7Row.aNum / c7Row.aDen) * c7mf;
  const c7j2 = g.pick([-2, -1, 1, 2]);
  const c7ms = c7mpred + c7Row.GDen * c7j2;
  const c7G = c7Row.GNum / c7Row.GDen;
  const c7dm = c7ms - c7mpred;
  const c7mean = c7mf + c7G * c7dm;
  const c7dP = c7Ps - c7Pp;
  const c7var = c7Row.p + c7G * c7G * c7dP;
  const c7G2 = frac(c7Row.GNum * c7Row.GNum, c7Row.GDen * c7Row.GDen);

  // Card 8: assumption
  const c8Template = g.pick([1, 2]);
  let c8Options: Text[] = [];
  let c8Correct = 0;
  let c8Title: Text;
  let c8Prompt: Text;
  let c8Hint: Text;
  let c8Expl: Text;
  if (c8Template === 1) {
    const s = g.pick([2, 4, 9]);
    const l = g.pick([2, 3, 4]);
    const twoL2 = 2 * l * l;
    c8Title = t('Which kernel has a one-variable state?', '哪个核只需要一个状态变量？');
    c8Prompt = t(
      `A zero-mean GP has one of the kernels below (r = |t − t′|, σ_f² = ${s}, ℓ = ${l}). For which of them does the scalar model fₖ₊₁ = a fₖ + qₖ with a = exp(−Δ/ℓ) give, through the Kalman filter and RTS smoother of this game, the exact GP posterior?`,
      `一个零均值高斯过程使用下列核之一（r = |t − t′|，σ_f² = ${s}，ℓ = ${l}）。对哪一个核，标量模型 fₖ₊₁ = a fₖ + qₖ（a = exp(−Δ/ℓ)）经过本游戏的卡尔曼滤波与 RTS 平滑器，能给出精确的高斯过程后验？`
    );
    c8Options = [
      t(`k = ${s} exp(−r/${l}), the exponential (Matérn-1/2) kernel`, `k = ${s} exp(−r/${l})，指数核（Matérn-1/2）`),
      t(`k = ${s} (1 + √3 r/${l}) exp(−√3 r/${l}), the Matérn-3/2 kernel`, `k = ${s} (1 + √3 r/${l}) exp(−√3 r/${l})，Matérn-3/2 核`),
      t(`k = ${s} exp(−r²/${twoL2}), the squared exponential kernel`, `k = ${s} exp(−r²/${twoL2})，平方指数核`),
    ];
    c8Correct = 0;
    c8Hint = t('Count the state variables each kernel needs: the OU process has one; what does Matérn-3/2 add, and what is the SE spectral density like?', '数一数每个核需要多少个状态变量：OU 过程只有一个；Matérn-3/2 多了什么？平方指数核的谱密度是什么样的？');
    c8Expl = t(
      'Only the exponential kernel is the Ornstein–Uhlenbeck process, whose whole state is the single value f(t) (Supplement p. 20; GPML pdf p. 230). Matérn-3/2 needs the two-dimensional state (f, df/dt) (Supplement p. 21), so the scalar recursion misses the derivative. The squared exponential spectral density is not a rational function, so no finite state is exact; a Taylor truncation with n states is only an approximation (Supplement pp. 22–23).',
      '只有指数核是 Ornstein–Uhlenbeck 过程，其全部状态就是单个数值 f(t)（补充讲义第 20 页；GPML 的 PDF 第 230 页）。Matérn-3/2 需要二维状态 (f, df/dt)（补充讲义第 21 页），标量递推漏掉了导数。平方指数核的谱密度不是有理函数，所以没有任何有限维状态是精确的；用 n 个状态做泰勒截断只是近似（补充讲义第 22–23 页）。'
    );
  } else {
    c8Title = t('Kalman filter on the SE kernel', '在平方指数核上用卡尔曼滤波');
    c8Prompt = t(
      'Someone runs a Kalman filter and RTS smoother on GP regression with the squared exponential kernel k = σ_f² exp(−r²/(2ℓ²)) (r = |t − t′|) and expects the exact posterior of the dense GP. Which statement is true?',
      '有人对平方指数核 k = σ_f² exp(−r²/(2ℓ²))（r = |t − t′|）的高斯过程回归运行卡尔曼滤波和 RTS 平滑器，并期望得到稠密高斯过程的精确后验。下列哪个说法正确？'
    );
    const allOpts = [
      t('No: the SE spectral density is not rational, so no finite state is exact; truncating its Taylor series only approximates it.', '不能：平方指数核的谱密度不是有理函数，所以没有任何有限维状态是精确的；对其泰勒级数截断只能得到近似。'),
      t('Yes: the scalar recursion fₖ₊₁ = a fₖ + qₖ with a = exp(−Δ/ℓ) is exact for every smooth stationary kernel, SE included.', '能：标量递推 fₖ₊₁ = a fₖ + qₖ（a = exp(−Δ/ℓ)）对每个光滑的平稳核都是精确的，平方指数核也不例外。'),
      t('Yes: it is exact with a two-dimensional state (f, df/dt), the same state as for the Matérn-3/2 kernel, only with other matrices.', '能：用二维状态 (f, df/dt) 就是精确的，与 Matérn-3/2 核的状态相同，只是矩阵不同。'),
      t('Yes: the Kalman filter is exact for every stationary kernel, because k(t, t′) depends only on t − t′ and so f(t) alone is the state.', '能：平稳核 k(t, t′) 只依赖 t − t′，所以卡尔曼滤波对每个平稳核都精确，状态只需 f(t)。'),
      t('No: the Kalman filter and RTS smoother work only for the exponential kernel; Matérn-3/2 and all other kernels fail as well.', '不能：卡尔曼滤波与 RTS 平滑器只适用于指数核；Matérn-3/2 核和其他核同样不行。'),
    ];
    const distractors = shuffled(g, [1, 2, 3, 4]).slice(0, 3);
    const indices = [0, ...distractors];
    c8Options = indices.map(i => allOpts[i]);
    c8Correct = 0;
    c8Hint = t('A finite state-space model needs a rational spectral density. Is the SE spectral density rational?', '有限维状态空间模型要求谱密度是有理函数。平方指数核的谱密度是有理函数吗？');
    const clauses: string[] = [];
    const clausesZh: string[] = [];
    if (distractors.includes(1)) { clauses.push('The scalar recursion is the OU process: it reproduces the exponential kernel only (Supplement p. 20).'); clausesZh.push('标量递推就是 OU 过程：它只能复现指数核（补充讲义第 20 页）。'); }
    if (distractors.includes(2)) { clauses.push('Two states (f, df/dt) give the Matérn-3/2 kernel, not the SE kernel (Supplement p. 21).'); clausesZh.push('二维状态 (f, df/dt) 对应的是 Matérn-3/2 核，而不是平方指数核（补充讲义第 21 页）。'); }
    if (distractors.includes(3)) { clauses.push('Stationarity does not make a process Markov: the state of the Matérn-3/2 kernel already needs f and df/dt.'); clausesZh.push('平稳并不等于马尔可夫：Matérn-3/2 核的状态就已经需要 f 和 df/dt。'); }
    if (distractors.includes(4)) { clauses.push('Matérn-3/2 and Matérn-5/2 have exact state-space models with 2 and 3 states (Supplement p. 21).'); clausesZh.push('Matérn-3/2 与 Matérn-5/2 有精确的状态空间模型，分别有 2 个和 3 个状态（补充讲义第 21 页）。'); }
    c8Expl = t(
      `The SE spectral density σ_f² √(2π) ℓ exp(−ℓ²ω²/2) is not a rational function, so no finite-dimensional linear state-space model reproduces the kernel exactly; truncating a Taylor series gives an n-state approximation that approaches the SE kernel only as n grows (Supplement pp. 22–23). ${clauses.join(' ')}`,
      `平方指数核的谱密度 σ_f² √(2π) ℓ exp(−ℓ²ω²/2) 不是有理函数，所以没有任何有限维线性状态空间模型能精确复现该核；对泰勒级数截断得到的是 n 个状态的近似，只有 n 增大时才趋近平方指数核（补充讲义第 22–23 页）。${clausesZh.join('')}`
    );
  }

  // Card 9: challenge
  const c9Family = g.pick([
    { aNum: 1, aDen: 2, s: 2, r: 1 }, { aNum: 1, aDen: 2, s: 4, r: 2 }, { aNum: 1, aDen: 2, s: 6, r: 3 },
    { aNum: 1, aDen: 2, s: 8, r: 4 }, { aNum: 1, aDen: 2, s: 12, r: 6 },
    { aNum: 2, aDen: 3, s: 3, r: 1 }, { aNum: 2, aDen: 3, s: 6, r: 2 }, { aNum: 2, aDen: 3, s: 9, r: 3 },
    { aNum: 2, aDen: 3, s: 12, r: 4 },
    { aNum: 2, aDen: 3, s: 3, r: 5 }, { aNum: 2, aDen: 3, s: 6, r: 10 },
  ]);
  const c9 = retry(() => {
    const y1 = g.pick([-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8]);
    const y2 = g.pick([-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8]);
    return { y1, y2 };
  }, v => {
    if (v.y1 === v.y2) return false;
    const { aNum, aDen, s, r } = c9Family;
    const a = aNum / aDen;
    const D = (s + r) * (s + r) - a * a * s * s;
    const w1 = (s * (s + r) - a * a * s * s) / D;
    const w2 = a * s * r / D;
    const ans = w1 * v.y1 + w2 * v.y2;
    if (Math.abs(ans) < 1e-12) return false;
    const numAns = Math.round(ans * 1000000);
    const denAns = 1000000;
    const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b);
    const d = gcd(numAns, denAns);
    const reducedDen = denAns / d;
    return reducedDen === 1 || reducedDen === 2 || reducedDen === 4;
  });
  const c9a = c9Family.aNum / c9Family.aDen;
  const c9D = (c9Family.s + c9Family.r) * (c9Family.s + c9Family.r) - c9a * c9a * c9Family.s * c9Family.s;
  const c9w1 = (c9Family.s * (c9Family.s + c9Family.r) - c9a * c9a * c9Family.s * c9Family.s) / c9D;
  const c9w2 = c9a * c9Family.s * c9Family.r / c9D;
  const c9ans = c9w1 * c9.y1 + c9w2 * c9.y2;
  const c9Q = c9Family.s * (1 - c9a * c9a);
  const c9P1 = (c9Family.s * c9Family.r) / (c9Family.s + c9Family.r);
  const c9m1 = (c9Family.s / (c9Family.s + c9Family.r)) * c9.y1;
  const c9m2m = c9a * c9m1;
  const c9P2m = c9a * c9a * c9P1 + c9Q;
  const c9K2 = c9P2m / (c9P2m + c9Family.r);
  const c9m2p = c9m2m + c9K2 * (c9.y2 - c9m2m);
  const c9G1 = c9a * c9P1 / c9P2m;
  const c9Kmat = mat([[String(c9Family.s), String(c9a * c9Family.s)], [String(c9a * c9Family.s), String(c9Family.s)]]);

  // Figure for card 7
  const sqrtP = Math.sqrt(c7Row.p);
  const sqrtPp = Math.sqrt(c7Pp);
  const sqrtPs = Math.sqrt(c7Ps);
  const shapes: FigureShape[] = [
    { kind: 'line', points: [[0, c7mf - sqrtP], [0, c7mf + sqrtP]], tone: 'accent', width: 2 },
    { kind: 'point', at: [0, c7mf], tone: 'accent', label: 'mₖ⁺' },
    { kind: 'line', points: [[1, c7mpred - sqrtPp], [1, c7mpred + sqrtPp]], tone: 'muted', width: 2 },
    { kind: 'point', at: [1, c7mpred], tone: 'muted', label: 'mₖ₊₁⁻', hollow: true },
    { kind: 'line', points: [[1.25, c7ms - sqrtPs], [1.25, c7ms + sqrtPs]], tone: 'warn', width: 2 },
    { kind: 'point', at: [1.25, c7ms], tone: 'warn', label: 'mₖ₊₁ˢ' },
    { kind: 'line', points: [[0, c7mf], [1, c7mpred]], tone: 'muted', dash: true },
    { kind: 'arrow', from: [1, c7mpred], to: [1.25, c7ms], tone: 'warn' },
  ];

  return [
    g.number({
      id: 'discretise',
      title: t('From Δ and ℓ to the process noise', '从 Δ 和 ℓ 到过程噪声'),
      prompt: t(
        `A zero-mean GP has the exponential (Matérn-1/2) kernel k(t, t′) = σ_f² exp(−|t − t′|/ℓ) with σ_f² = ${c1.s}. Two neighbouring observation times differ by Δ, where Δ/ℓ = ${ratioStr(c1.aNum, c1.aDen)}, so a = exp(−Δ/ℓ) = ${frac(c1.aNum, c1.aDen)}. The state-space (OU) form is fₖ₊₁ = a fₖ + qₖ with independent noise qₖ. Compute Var(qₖ).`,
        `一个零均值高斯过程使用指数核（Matérn-1/2）k(t, t′) = σ_f² exp(−|t − t′|/ℓ)，σ_f² = ${c1.s}。相邻两个观测时刻相差 Δ，其中 Δ/ℓ = ${ratioStr(c1.aNum, c1.aDen)}，所以 a = exp(−Δ/ℓ) = ${frac(c1.aNum, c1.aDen)}。状态空间（OU）形式为 fₖ₊₁ = a fₖ + qₖ，噪声 qₖ 相互独立。计算 Var(qₖ)。`
      ),
      fields: [{ label: t('Var(qₖ)', 'Var(qₖ)'), answer: c1Q }],
      hint: t('The process must stay stationary: Var(fₖ₊₁) = a² Var(fₖ) + Var(qₖ) must equal σ_f².', '过程必须保持平稳：Var(fₖ₊₁) = a² Var(fₖ) + Var(qₖ) 必须等于 σ_f²。'),
      explanation: t(
        `Var(qₖ) = σ_f²(1 − a²) = ${c1.s} · (1 − ${c1a2}) = ${c1.s} · ${c1omA2} = ${exact(c1Q)}. Check: a² · ${c1.s} + ${exact(c1Q)} = ${c1a2s} + ${exact(c1Q)} = ${c1.s}, so the variance stays ${c1.s} at every step. This is Q = P∞ − A P∞ Aᵀ of Assignment 6 Task 1.2 with A = a.`,
        `Var(qₖ) = σ_f²(1 − a²) = ${c1.s} · (1 − ${c1a2}) = ${c1.s} · ${c1omA2} = ${exact(c1Q)}。验算：a² · ${c1.s} + ${exact(c1Q)} = ${c1a2s} + ${exact(c1Q)} = ${c1.s}，所以每一步方差都保持为 ${c1.s}。这就是作业 6 任务 1.2 中的 Q = P∞ − A P∞ Aᵀ（A = a）。`
      ),
      audit: { kind: 'GP-29:discretise', params: { s: c1.s, a_num: c1.aNum, a_den: c1.aDen } },
    }),
    g.number({
      id: 'predict',
      title: t('The prediction step', '预测步'),
      prompt: t(
        `A Kalman filter for the exponential-kernel GP (zero mean, H = 1) uses fₖ₊₁ = a fₖ + qₖ with a = ${frac(c2Row.aNum, c2Row.aDen)} and Var(qₖ) = ${exact(c2Row.Q)}. After the update at time tₖ the filtered state is N(mₖ⁺, Pₖ⁺) with mₖ⁺ = ${num(c2m)} and Pₖ⁺ = ${exact(c2Row.p)}. Compute the predicted mean mₖ₊₁⁻ and the predicted variance Pₖ₊₁⁻ of f(tₖ₊₁) before the next observation is used. ${LEG[0]}`,
        `指数核高斯过程的卡尔曼滤波（零均值，H = 1）使用 fₖ₊₁ = a fₖ + qₖ，a = ${frac(c2Row.aNum, c2Row.aDen)}，Var(qₖ) = ${exact(c2Row.Q)}。在 tₖ 处更新之后，滤波状态为 N(mₖ⁺, Pₖ⁺)，其中 mₖ⁺ = ${num(c2m)}，Pₖ⁺ = ${exact(c2Row.p)}。在使用下一个观测之前，计算 f(tₖ₊₁) 的预测均值 mₖ₊₁⁻ 和预测方差 Pₖ₊₁⁻。${LEG[1]}`
      ),
      fields: [
        { label: t('mₖ₊₁⁻', 'mₖ₊₁⁻'), answer: c2mp },
        { label: t('Pₖ₊₁⁻', 'Pₖ₊₁⁻'), answer: c2Pp },
      ],
      hint: t('Prediction step: the mean is multiplied by a; the variance is multiplied by a² and then the process noise Var(qₖ) is added.', '预测步：均值乘以 a；方差乘以 a²，再加上过程噪声 Var(qₖ)。'),
      explanation: t(
        `mₖ₊₁⁻ = a mₖ⁺ = ${frac(c2Row.aNum, c2Row.aDen)} · ${num(c2m)} = ${exact(c2mp)}. Pₖ₊₁⁻ = a² Pₖ⁺ + Var(qₖ) = ${c2a2} · ${exact(c2Row.p)} + ${exact(c2Row.Q)} = ${c2a2p} + ${exact(c2Row.Q)} = ${exact(c2Pp)}. The uncertainty is scaled by a², not by a, because it is a variance; the new noise is then added.`,
        `mₖ₊₁⁻ = a mₖ⁺ = ${frac(c2Row.aNum, c2Row.aDen)} · ${num(c2m)} = ${exact(c2mp)}。Pₖ₊₁⁻ = a² Pₖ⁺ + Var(qₖ) = ${c2a2} · ${exact(c2Row.p)} + ${exact(c2Row.Q)} = ${c2a2p} + ${exact(c2Row.Q)} = ${exact(c2Pp)}。不确定度是方差，所以乘以 a² 而不是 a；然后再加上新的过程噪声。`
      ),
      audit: { kind: 'GP-29:predict', params: { a_num: c2Row.aNum, a_den: c2Row.aDen, Q: c2Row.Q, p: c2Row.p, m: c2m } },
    }),
    g.number({
      id: 'update',
      title: t('The update step', '更新步'),
      prompt: t(
        `Exponential-kernel GP, H = 1, observation noise variance σ_n² = ${c3Row.r}. Before the observation at tₖ the predicted state is N(mₖ⁻, Pₖ⁻) with mₖ⁻ = ${num(c3mp)} and Pₖ⁻ = ${exact(c3Row.Pp)}. The observation is y = ${num(c3y)}. Compute the Kalman gain Kₖ, the filtered mean mₖ⁺ and the filtered variance Pₖ⁺. ${LEG[0]}`,
        `指数核高斯过程，H = 1，观测噪声方差 σ_n² = ${c3Row.r}。在 tₖ 处观测之前，预测状态为 N(mₖ⁻, Pₖ⁻)，其中 mₖ⁻ = ${num(c3mp)}，Pₖ⁻ = ${exact(c3Row.Pp)}。观测值为 y = ${num(c3y)}。计算卡尔曼增益 Kₖ、滤波均值 mₖ⁺ 和滤波方差 Pₖ⁺。${LEG[1]}`
      ),
      fields: [
        { label: t('Kₖ', 'Kₖ'), answer: c3K },
        { label: t('mₖ⁺', 'mₖ⁺'), answer: c3mPlus },
        { label: t('Pₖ⁺', 'Pₖ⁺'), answer: c3PPlus },
      ],
      hint: t('v = y − mₖ⁻, S = Pₖ⁻ + σ_n², Kₖ = Pₖ⁻ / S, mₖ⁺ = mₖ⁻ + Kₖ v, Pₖ⁺ = Pₖ⁻ − Kₖ S Kₖ.', 'v = y − mₖ⁻，S = Pₖ⁻ + σ_n²，Kₖ = Pₖ⁻ / S，mₖ⁺ = mₖ⁻ + Kₖ v，Pₖ⁺ = Pₖ⁻ − Kₖ S Kₖ。'),
      explanation: t(
        `v = ${num(c3y)} − ${par(c3mp)} = ${par(c3v)}, S = ${exact(c3Row.Pp)} + ${c3Row.r} = ${exact(c3S)}, Kₖ = ${exact(c3Row.Pp)}/${exact(c3S)} = ${exact(c3K)}. mₖ⁺ = ${par(c3mp)} + ${exact(c3K)} · ${par(c3v)} = ${exact(c3mPlus)}. Pₖ⁺ = ${exact(c3Row.Pp)} − ${pf(exact(c3K))}² · ${exact(c3S)} = ${exact(c3PPlus)} (equal to (1 − Kₖ) Pₖ⁻). The gain and the variance do not depend on y; only the mean does.`,
        `v = ${num(c3y)} − ${par(c3mp)} = ${par(c3v)}，S = ${exact(c3Row.Pp)} + ${c3Row.r} = ${exact(c3S)}，Kₖ = ${exact(c3Row.Pp)}/${exact(c3S)} = ${exact(c3K)}。mₖ⁺ = ${par(c3mp)} + ${exact(c3K)} · ${par(c3v)} = ${exact(c3mPlus)}。Pₖ⁺ = ${exact(c3Row.Pp)} − ${pf(exact(c3K))}² · ${exact(c3S)} = ${exact(c3PPlus)}（等于 (1 − Kₖ) Pₖ⁻）。增益和方差与 y 无关，只有均值依赖 y。`
      ),
      audit: { kind: 'GP-29:update', params: { Pp: c3Row.Pp, r: c3Row.r, mp: c3mp, y: c3y } },
    }),
    g.number({
      id: 'forecast',
      title: t('One observation, then a forecast', '一次观测，然后预测'),
      prompt: t(
        `Exponential-kernel GP (zero mean, H = 1) with σ_f² = ${c4.s} and a = ${frac(c4.aNum, c4.aDen)}, so Var(qₖ) = ${exact(c4Q)}. The observation noise variance is σ_n² = ${c4.r}. The Kalman filter starts at the first observation time t₁ with the prior N(0, σ_f²) (P∞ = σ_f²) and then uses the observation y₁. Compute the filtered variance P₁⁺ at t₁ and the predicted variance P₂⁻ of f(t₂) before y₂ is used. ${LEG[0]}`,
        `指数核高斯过程（零均值，H = 1），σ_f² = ${c4.s}，a = ${frac(c4.aNum, c4.aDen)}，所以 Var(qₖ) = ${exact(c4Q)}。观测噪声方差为 σ_n² = ${c4.r}。卡尔曼滤波从第一个观测时刻 t₁ 开始，先验为 N(0, σ_f²)（P∞ = σ_f²），然后使用观测 y₁。计算 t₁ 处的滤波方差 P₁⁺，以及在使用 y₂ 之前 f(t₂) 的预测方差 P₂⁻。${LEG[1]}`
      ),
      fields: [
        { label: t('P₁⁺', 'P₁⁺'), answer: c4P1 },
        { label: t('P₂⁻', 'P₂⁻'), answer: c4P2 },
      ],
      hint: t('Update first with P⁻ = σ_f²: P⁺ = P⁻σ_n² / (P⁻ + σ_n²). Then predict: P⁻ = a² P⁺ + Var(qₖ).', '先用 P⁻ = σ_f² 做更新：P⁺ = P⁻σ_n² / (P⁻ + σ_n²)；再做预测：P⁻ = a² P⁺ + Var(qₖ)。'),
      explanation: t(
        `P₁⁺ = ${c4.s} · ${c4.r} / (${c4.s} + ${c4.r}) = ${exact(c4P1)}. P₂⁻ = ${c4a2} · ${pf(exact(c4P1))} + ${exact(c4Q)} = ${exact(c4P2)}. Dense check: k(t₁, t₂) = a σ_f² = ${c4as}, so the exact variance of f(t₂) given y₁ is σ_f² − (a σ_f²)² / (σ_f² + σ_n²) = ${c4.s} − ${c4as2} / ${c4.s + c4.r} = ${exact(c4P2)}. The O(n) recursion and the dense GP formula give the same number, and the variance does not depend on y₁.`,
        `P₁⁺ = ${c4.s} · ${c4.r} / (${c4.s} + ${c4.r}) = ${exact(c4P1)}。P₂⁻ = ${c4a2} · ${pf(exact(c4P1))} + ${exact(c4Q)} = ${exact(c4P2)}。与稠密高斯过程对照：k(t₁, t₂) = a σ_f² = ${c4as}，所以给定 y₁ 时 f(t₂) 的精确方差为 σ_f² − (a σ_f²)² / (σ_f² + σ_n²) = ${c4.s} − ${c4as2} / ${c4.s + c4.r} = ${exact(c4P2)}。O(n) 递推与稠密公式给出同一个数，而且方差与 y₁ 无关。`
      ),
      audit: { kind: 'GP-29:forecast', params: { a_num: c4.aNum, a_den: c4.aDen, s: c4.s, r: c4.r } },
    }),
    g.number({
      id: 'llh-term',
      title: t('One term of the log marginal likelihood', '对数边际似然的一项'),
      prompt: t(
        `In one Kalman update the innovation is v = ${num(c5.v)} and its variance is S = ${c5.S}. The lecture writes log p(y) = −½ Σ (log|2πS| + v²/S), summed over the time steps. For this S, log(2πS) = ${c5.L.toFixed(2)} (rounded to 2 decimals). Compute this step's contribution −½ (log(2πS) + v²/S) to log p(y). Give 2 decimals; the answer is negative.`,
        `在一次卡尔曼更新中，新息为 v = ${num(c5.v)}，其方差为 S = ${c5.S}。讲义把对数边际似然写成 log p(y) = −½ Σ (log|2πS| + v²/S)，对各时间步求和。对这个 S，log(2πS) = ${c5.L.toFixed(2)}（保留 2 位小数）。计算这一步对 log p(y) 的贡献 −½ (log(2πS) + v²/S)。保留 2 位小数；答案为负数。`
      ),
      fields: [{ label: t('this term of log p(y)', 'log p(y) 的这一项'), answer: c5ans, tolerance: 0.005 }],
      hint: t('v²/S is the data-fit part (a squared error in units of the predicted variance); log(2πS) is the cost of the spread S. Add them and multiply by −½.', 'v²/S 是数据拟合项（以预测方差为单位的平方误差）；log(2πS) 是方差 S 带来的惩罚。两者相加再乘以 −½。'),
      explanation: t(
        `v²/S = ${par(c5.v)}²/${c5.S} = ${exact(c5q)}. The term is −½ (${c5.L.toFixed(2)} + ${exact(c5q)}) = −½ · ${exact(c5.L + c5q)} = ${num(c5ans).replace(/-/g, '−')}. It is the logarithm of the Gaussian density N(v; 0, S) of the innovation; adding these terms over all time steps gives log p(y) as a by-product of the filter, with no n × n determinant.`,
        `v²/S = ${par(c5.v)}²/${c5.S} = ${exact(c5q)}。这一项为 −½ (${c5.L.toFixed(2)} + ${exact(c5q)}) = −½ · ${exact(c5.L + c5q)} = ${num(c5ans).replace(/-/g, '−')}。它是新息 v 的高斯密度 N(v; 0, S) 的对数；把所有时间步的这些项相加，就得到滤波的副产品 log p(y)，不需要 n × n 的行列式。`
      ),
      audit: { kind: 'GP-29:llh-term', params: { v: c5.v, S: c5.S, L: c5.L } },
    }),
    g.number({
      id: 'rts-gain',
      title: t('The smoother gain', '平滑增益'),
      prompt: t(
        `Exponential-kernel Kalman filter with a = ${frac(c6.aNum, c6.aDen)}. At time tₖ the filtered variance is Pₖ⁺ = ${exact(c6.p)}. The predicted variance at tₖ₊₁ is Pₖ₊₁⁻ = ${frac(c6.PpNum, c6.PpDen)} (this already includes the process noise). Compute the Rauch–Tung–Striebel smoother gain Gₖ. ${LEG[0]}`,
        `指数核卡尔曼滤波，a = ${frac(c6.aNum, c6.aDen)}。在 tₖ 处滤波方差为 Pₖ⁺ = ${exact(c6.p)}。tₖ₊₁ 处的预测方差为 Pₖ₊₁⁻ = ${frac(c6.PpNum, c6.PpDen)}（其中已包含过程噪声）。计算 Rauch–Tung–Striebel 平滑器的增益 Gₖ。${LEG[1]}`
      ),
      fields: [{ label: t('Gₖ', 'Gₖ'), answer: c6G }],
      hint: t('Gₖ = Pₖ⁺ a / Pₖ₊₁⁻ (the scalar form of Pₖ⁺ Aᵀ (Pₖ₊₁⁻)⁻¹).', 'Gₖ = Pₖ⁺ a / Pₖ₊₁⁻（即 Pₖ⁺ Aᵀ (Pₖ₊₁⁻)⁻¹ 的标量形式）。'),
      explanation: t(
        `Gₖ = ${exact(c6.p)} · ${pf(frac(c6.aNum, c6.aDen))} / ${pf(frac(c6.PpNum, c6.PpDen))} = ${pf(c6ap)} / ${pf(frac(c6.PpNum, c6.PpDen))} = ${exact(c6G)}. It is the regression slope of f(tₖ) on f(tₖ₊₁) given the data up to tₖ: Cov(f(tₖ), f(tₖ₊₁)) = a Pₖ⁺ divided by Var(f(tₖ₊₁)) = Pₖ₊₁⁻.`,
        `Gₖ = ${exact(c6.p)} · ${pf(frac(c6.aNum, c6.aDen))} / ${pf(frac(c6.PpNum, c6.PpDen))} = ${pf(c6ap)} / ${pf(frac(c6.PpNum, c6.PpDen))} = ${exact(c6G)}。它是在 tₖ 之前的数据条件下，f(tₖ) 对 f(tₖ₊₁) 的回归斜率：协方差 Cov(f(tₖ), f(tₖ₊₁)) = a Pₖ⁺ 除以方差 Var(f(tₖ₊₁)) = Pₖ₊₁⁻。`
      ),
      audit: { kind: 'GP-29:rts-gain', params: { a_num: c6.aNum, a_den: c6.aDen, p: c6.p, Pp_num: c6.PpNum, Pp_den: c6.PpDen } },
    }),
    g.number({
      id: 'smooth',
      title: t('The backward step of the smoother', '平滑器的反向一步'),
      prompt: t(
        `Exponential-kernel Kalman filter and RTS smoother, a = ${frac(c7Row.aNum, c7Row.aDen)}. Filtered at tₖ: mₖ⁺ = ${num(c7mf)}, Pₖ⁺ = ${exact(c7Row.p)}. Predicted at tₖ₊₁: Pₖ₊₁⁻ = ${frac(c7Row.PpNum, c7Row.PpDen)}; the smoother gain is Gₖ = ${frac(c7Row.GNum, c7Row.GDen)}. The smoother has already produced mₖ₊₁ˢ = ${num(c7ms)} and Pₖ₊₁ˢ = ${frac(Math.round(c7Ps * 2), 2)}. Compute mₖˢ and Pₖˢ. (The predicted mean is mₖ₊₁⁻ = a mₖ⁺.) ${LEG[0]}`,
        `指数核卡尔曼滤波与 RTS 平滑器，a = ${frac(c7Row.aNum, c7Row.aDen)}。tₖ 处的滤波结果：mₖ⁺ = ${num(c7mf)}，Pₖ⁺ = ${exact(c7Row.p)}。tₖ₊₁ 处的预测方差为 Pₖ₊₁⁻ = ${frac(c7Row.PpNum, c7Row.PpDen)}；平滑增益为 Gₖ = ${frac(c7Row.GNum, c7Row.GDen)}。平滑器已经算出 mₖ₊₁ˢ = ${num(c7ms)}，Pₖ₊₁ˢ = ${frac(Math.round(c7Ps * 2), 2)}。计算 mₖˢ 和 Pₖˢ。（预测均值为 mₖ₊₁⁻ = a mₖ⁺。）${LEG[1]}`
      ),
      figure: g.figure({
        alt: t(
          `At time tₖ a point at the filtered mean ${num(c7mf)} with a vertical bar of one standard deviation; at time tₖ₊₁ a hollow grey point at the predicted mean ${exact(c7mpred)} with its bar, and, shifted slightly to the right, a point at the smoothed mean ${num(c7ms)} with its bar, joined by an arrow from the predicted to the smoothed point.`,
          `在时刻 tₖ 有一个位于滤波均值 ${num(c7mf)} 的点，带一个一倍标准差的竖线；在时刻 tₖ₊₁ 有一个位于预测均值 ${exact(c7mpred)} 的空心灰点及其竖线，稍向右有一个位于平滑均值 ${num(c7ms)} 的点及其竖线，并用箭头从预测点指向平滑点。`
        ),
        view: { ...fitView(shapes, 0.25), xmin: -0.3, xmax: 1.6 },
        axes: { xLabel: 't', yLabel: 'f', grid: true },
        shapes,
        aspect: 'free',
      }),
      fields: [
        { label: t('mₖˢ', 'mₖˢ'), answer: c7mean },
        { label: t('Pₖˢ', 'Pₖˢ'), answer: c7var },
      ],
      hint: t('mₖˢ = mₖ⁺ + Gₖ (mₖ₊₁ˢ − mₖ₊₁⁻) with mₖ₊₁⁻ = a mₖ⁺; Pₖˢ = Pₖ⁺ + Gₖ² (Pₖ₊₁ˢ − Pₖ₊₁⁻).', 'mₖˢ = mₖ⁺ + Gₖ (mₖ₊₁ˢ − mₖ₊₁⁻)，其中 mₖ₊₁⁻ = a mₖ⁺；Pₖˢ = Pₖ⁺ + Gₖ² (Pₖ₊₁ˢ − Pₖ₊₁⁻)。'),
      explanation: t(
        `mₖ₊₁⁻ = ${frac(c7Row.aNum, c7Row.aDen)} · ${par(c7mf)} = ${exact(c7mpred)}. mₖˢ = ${par(c7mf)} + ${frac(c7Row.GNum, c7Row.GDen)} · (${par(c7ms)} − ${par(c7mpred)}) = ${par(c7mf)} + ${frac(c7Row.GNum, c7Row.GDen)} · ${par(c7dm)} = ${exact(c7mean)}. Pₖˢ = ${exact(c7Row.p)} + ${pf(frac(c7Row.GNum, c7Row.GDen))}² · (${exact(c7Ps)} − ${frac(c7Row.PpNum, c7Row.PpDen)}) = ${exact(c7Row.p)} + ${c7G2} · ${parx(c7dP)} = ${exact(c7var)}. The smoother pulls the filtered mean towards the later information and, because Pₖ₊₁ˢ < Pₖ₊₁⁻, reduces the variance below Pₖ⁺.`,
        `mₖ₊₁⁻ = ${frac(c7Row.aNum, c7Row.aDen)} · ${par(c7mf)} = ${exact(c7mpred)}。mₖˢ = ${par(c7mf)} + ${frac(c7Row.GNum, c7Row.GDen)} · (${par(c7ms)} − ${par(c7mpred)}) = ${par(c7mf)} + ${frac(c7Row.GNum, c7Row.GDen)} · ${par(c7dm)} = ${exact(c7mean)}。Pₖˢ = ${exact(c7Row.p)} + ${pf(frac(c7Row.GNum, c7Row.GDen))}² · (${exact(c7Ps)} − ${frac(c7Row.PpNum, c7Row.PpDen)}) = ${exact(c7Row.p)} + ${c7G2} · ${parx(c7dP)} = ${exact(c7var)}。平滑器把滤波均值拉向后来的信息；由于 Pₖ₊₁ˢ < Pₖ₊₁⁻，方差也比 Pₖ⁺ 小。`
      ),
      audit: { kind: 'GP-29:smooth', params: { a_num: c7Row.aNum, a_den: c7Row.aDen, mf: c7mf, p: c7Row.p, Pp_num: c7Row.PpNum, Pp_den: c7Row.PpDen, G_num: c7Row.GNum, G_den: c7Row.GDen, ms: c7ms, Ps_num: Math.round(c7Ps * 2) % 2 === 0 ? Math.round(c7Ps * 2) / 2 : Math.round(c7Ps * 2), Ps_den: Math.round(c7Ps * 2) % 2 === 0 ? 1 : 2 } },
    }),
    g.choice({
      id: 'assumption',
      title: c8Title,
      prompt: c8Prompt,
      options: c8Options,
      correct: c8Correct,
      hint: c8Hint,
      explanation: c8Expl,
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: two observations', '挑战：两个观测'),
      prompt: t(
        `A zero-mean GP has the exponential kernel k(t, t′) = σ_f² exp(−|t − t′|/ℓ) with σ_f² = ${c9Family.s}. Two observations are taken at times t₁ and t₂ with Δ/ℓ = ${ratioStr(c9Family.aNum, c9Family.aDen)} (so a = exp(−Δ/ℓ) = ${frac(c9Family.aNum, c9Family.aDen)}); the noise variance is σ_n² = ${c9Family.r}. The observations are y₁ = ${num(c9.y1)} at t₁ and y₂ = ${num(c9.y2)} at t₂. What is the exact posterior mean E[f(t₁) | y₁, y₂]?`,
        `一个零均值高斯过程使用指数核 k(t, t′) = σ_f² exp(−|t − t′|/ℓ)，σ_f² = ${c9Family.s}。在时刻 t₁ 和 t₂ 各取一个观测，Δ/ℓ = ${ratioStr(c9Family.aNum, c9Family.aDen)}（所以 a = exp(−Δ/ℓ) = ${frac(c9Family.aNum, c9Family.aDen)}）；噪声方差为 σ_n² = ${c9Family.r}。观测值为 t₁ 处 y₁ = ${num(c9.y1)}，t₂ 处 y₂ = ${num(c9.y2)}。精确的后验均值 E[f(t₁) | y₁, y₂] 是多少？`
      ),
      fields: [{ label: t('E[f(t₁) | y₁, y₂]', 'E[f(t₁) | y₁, y₂]'), answer: c9ans }],
      hint: t('Either run the filter on t₁, t₂ and one smoother step, or use the 2 × 2 formula k*ᵀ (K + σ_n² I)⁻¹ y with k* = (σ_f², a σ_f²). Both give the same number.', '可以对 t₁、t₂ 运行滤波再做一步平滑，也可以用 2 × 2 公式 k*ᵀ (K + σ_n² I)⁻¹ y，其中 k* = (σ_f², a σ_f²)。两种方法给出同一个数。'),
      explanation: t(
        `Kalman route: P₁⁺ = ${c9Family.s} · ${c9Family.r}/(${c9Family.s} + ${c9Family.r}) = ${exact(c9P1)}, m₁⁺ = ${c9Family.s}/(${c9Family.s} + ${c9Family.r}) · ${par(c9.y1)} = ${exact(c9m1)}; m₂⁻ = a m₁⁺ = ${exact(c9m2m)}, P₂⁻ = ${frac(c9Family.aNum * c9Family.aNum, c9Family.aDen * c9Family.aDen)} · ${pf(exact(c9P1))} + ${exact(c9Q)} = ${exact(c9P2m)}; K₂ = ${pf(exact(c9P2m))}/(${exact(c9P2m)} + ${c9Family.r}) = ${exact(c9K2)}, m₂⁺ = ${parx(c9m2m)} + ${exact(c9K2)} · (${par(c9.y2)} − ${parx(c9m2m)}) = ${exact(c9m2p)}; G₁ = a P₁⁺ / P₂⁻ = ${exact(c9G1)}; m₁ˢ = ${parx(c9m1)} + ${exact(c9G1)} · (${parx(c9m2p)} − ${parx(c9m2m)}) = ${exact(c9ans)}. Dense route: with K = ${c9Kmat}, weights k*ᵀ(K + σ_n² I)⁻¹ = (${exact(c9w1)}, ${exact(c9w2)}), so E[f(t₁) | y] = ${exact(c9w1)} · ${par(c9.y1)} + ${exact(c9w2)} · ${par(c9.y2)} = ${exact(c9ans)}. The two routes agree. This game does not test fitting hyperparameters or non-Gaussian likelihoods.`,
        `卡尔曼路线：P₁⁺ = ${c9Family.s} · ${c9Family.r}/(${c9Family.s} + ${c9Family.r}) = ${exact(c9P1)}，m₁⁺ = ${c9Family.s}/(${c9Family.s} + ${c9Family.r}) · ${par(c9.y1)} = ${exact(c9m1)}；m₂⁻ = a m₁⁺ = ${exact(c9m2m)}，P₂⁻ = ${frac(c9Family.aNum * c9Family.aNum, c9Family.aDen * c9Family.aDen)} · ${pf(exact(c9P1))} + ${exact(c9Q)} = ${exact(c9P2m)}；K₂ = ${pf(exact(c9P2m))}/(${exact(c9P2m)} + ${c9Family.r}) = ${exact(c9K2)}，m₂⁺ = ${parx(c9m2m)} + ${exact(c9K2)} · (${par(c9.y2)} − ${parx(c9m2m)}) = ${exact(c9m2p)}；G₁ = a P₁⁺ / P₂⁻ = ${exact(c9G1)}；m₁ˢ = ${parx(c9m1)} + ${exact(c9G1)} · (${parx(c9m2p)} − ${parx(c9m2m)}) = ${exact(c9ans)}。稠密路线：K = ${c9Kmat}，权重 k*ᵀ(K + σ_n² I)⁻¹ = (${exact(c9w1)}, ${exact(c9w2)})，所以 E[f(t₁) | y] = ${exact(c9w1)} · ${par(c9.y1)} + ${exact(c9w2)} · ${par(c9.y2)} = ${exact(c9ans)}。两条路线一致。本游戏不考查超参数拟合，也不涉及非高斯似然。`
      ),
      audit: { kind: 'GP-29:challenge', params: { a_num: c9Family.aNum, a_den: c9Family.aDen, s: c9Family.s, r: c9Family.r, y1: c9.y1, y2: c9.y2 } },
    }),
  ];
};
