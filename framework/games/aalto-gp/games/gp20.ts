import type { CardGenerator } from '../../types';
import { exact, frac, makeGpDeck, mat, num, par, type Text } from '../support';

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

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const denomOf = (x: number): number => {
  const r = Math.round(x * 100000) / 100000;
  const d = Math.round(r * 100000);
  return d === 0 ? 1 : 100000 / gcd(Math.abs(d), 100000);
};
const okDenom = (x: number): boolean => {
  const d = denomOf(x);
  return d === 1 || d === 2 || d === 4 || d === 5 || d === 8 || d === 10;
};
const minGap = (truth: number, routes: number[]): boolean => routes.every(r => Math.abs(r - truth) >= 0.1 - 1e-9);
const minGap125 = (truth: number, routes: number[]): boolean => routes.every(r => Math.abs(r - truth) >= 0.125 - 1e-9);
const minGap1000 = (truth: number, routes: number[]): boolean => routes.every(r => Math.abs(r - truth) >= 1000 - 1e-9);

const dec3 = (x: number): string => (Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? num(x) : exact(x));
const eq = (left: string, value: string): string => (left === value ? left : `${left} = ${value}`);
const vec = (xs: number[]): string => `(${xs.map(num).join(', ')})`;

export const gp20: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-20');
  warm(g);

  // Card 1: toeplitz-row
  const t1 = g.pick([
    { b: 0.3, c: 0.2, d: 0.1 }, { b: 0.4, c: 0.2, d: 0.1 }, { b: 0.4, c: 0.3, d: 0.1 },
    { b: 0.5, c: 0.2, d: 0.1 }, { b: 0.5, c: 0.3, d: 0.1 }, { b: 0.5, c: 0.3, d: 0.2 },
    { b: 0.5, c: 0.4, d: 0.2 }, { b: 0.6, c: 0.3, d: 0.1 }, { b: 0.6, c: 0.4, d: 0.1 },
    { b: 0.6, c: 0.4, d: 0.2 }, { b: 0.7, c: 0.4, d: 0.2 }, { b: 0.7, c: 0.5, d: 0.3 },
  ]);
  const t1Ans = 1 + 2 * t1.b + t1.c;

  // Card 2: toeplitz-check
  const t2h = g.pick([0.5, 1, 2, 3, 4, 5]);
  const t2l = g.pick([1, 2]);
  const g1 = [t2h, 2 * t2h, 3 * t2h, 4 * t2h];
  const g2 = [t2h, 2 * t2h, 4 * t2h, 5 * t2h];
  const g1s = g1.map(num).join(', ');
  const g2s = g2.map(num).join(', ');
  const g1zh = g1.map(num).join('、');
  const g2zh = g2.map(num).join('、');

  // Card 3: separable
  const pOpts = [0.25, 0.5, 0.6, 0.8, 0.9];
  const vOpts = [0.5, 2, 3, 4, 5];
  const t3 = retry(() => {
    const p = g.pick(pOpts);
    const v = g.pick(vOpts);
    const q = g.pick(pOpts);
    return { p, v, q };
  }, v => {
    const T = v.p * v.v * v.q;
    return okDenom(T) && Math.abs(T * 100 - Math.round(T * 100)) < 1e-9 && minGap(T, [v.p * v.q, v.p * v.v, v.q * v.v, v.p + v.q + v.v, v.p * v.q / v.v, (v.p + v.q) * v.v]);
  });
  const t3Ans = t3.p * t3.v * t3.q;

  // Card 4: quad-step
  const yOpts = [[1, 2], [2, 1], [1, -2], [2, -1]];
  const t4 = retry(() => {
    const a = g.random(1, 6);
    const c = g.random(1, 6);
    const b = g.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const y = g.pick(yOpts);
    const y1 = y[0], y2 = y[1];
    const q = a * y1 * y1 + 2 * b * y1 * y2 + c * y2 * y2;
    return { a, b, c, y1, y2, q };
  }, v => {
    if (v.a * v.c - v.b * v.b <= 0) return false;
    const T = 5 / v.q;
    const det = v.a * v.c - v.b * v.b;
    const routes = [
      (v.c * v.y1 - v.b * v.y2) / det,
      (v.a * v.y2 - v.b * v.y1) / det,
      5 / (v.a * v.y1 * v.y1 + v.c * v.y2 * v.y2),
      5 / (v.a * v.y1 * v.y1 - 2 * v.b * v.y1 * v.y2 + v.c * v.y2 * v.y2),
      v.q / 5,
      1 / v.a,
      1 / v.c,
    ];
    return [1, 2, 4, 5, 8, 10, 20].includes(v.q) && okDenom(T) && minGap125(T, routes);
  });
  const t4Ans = 5 / t4.q;
  const t4f = t4.q === 1 ? '½t²' : `½·${num(t4.q)}·t²`;
  const t4slope = t4.q === 1 ? 't' : `${num(t4.q)}·t`;
  const t4t = t4.q === 1 ? exact(t4Ans) : eq(`5/${num(t4.q)}`, exact(t4Ans));

  // Card 5: cond-noise
  const t5 = retry(() => {
    const a = g.random(2, 7);
    const b = g.random(1, a - 1);
    const s = g.pick([0.5, 1, 2, 3, 4, 5]);
    return { a, b, s };
  }, v => {
    const T = (v.a + v.b + v.s) / (v.a - v.b + v.s);
    const routes = [
      (v.a + v.b) / (v.a - v.b),
      (v.a + v.b) / (v.a - v.b) + v.s,
      (v.a + v.b + v.s) / (v.a - v.b),
      (v.a + v.b) / (v.a - v.b + v.s),
      (v.a + v.b + v.s) / v.s,
      (v.a + v.b) / v.s,
    ];
    return okDenom(T) && minGap(T, routes);
  });
  const t5Ans = (t5.a + t5.b + t5.s) / (t5.a - t5.b + t5.s);

  // Card 6: noise-rescue
  const t6 = retry(() => {
    const a = g.pick([1, 2, 3, 4, 5]);
    const s = g.pick([0.5, 1, 2, 4]);
    return { a, s };
  }, v => 2 * v.a / v.s !== 1);
  const t6v = 2 * t6.a / t6.s + 1;
  const t6r = 2 * t6.a / t6.s;

  // Card 7: precond
  const t7 = retry(() => {
    const l1 = g.random(2, 6);
    const l2 = g.random(1, l1 - 1);
    const d1 = g.random(1, 6);
    const d2 = g.random(1, 6);
    return { l1, l2, d1, d2 };
  }, v => {
    if (v.d1 === v.d2) return false;
    const r1 = v.l1 / v.d1;
    const r2 = v.l2 / v.d2;
    const T = Math.max(r1, r2) / Math.min(r1, r2);
    const routes = [
      v.l1 / v.l2,
      Math.max(v.d1, v.d2) / Math.min(v.d1, v.d2),
      (v.l1 / v.l2) * (Math.max(v.d1, v.d2) / Math.min(v.d1, v.d2)),
      Math.max(v.l1 * v.d1, v.l2 * v.d2) / Math.min(v.l1 * v.d1, v.l2 * v.d2),
    ];
    return T !== 1 && T < v.l1 / v.l2 && okDenom(T) && minGap(T, routes);
  });
  const t7r1 = t7.l1 / t7.d1;
  const t7r2 = t7.l2 / t7.d2;
  const t7Ans = Math.max(t7r1, t7r2) / Math.min(t7r1, t7r2);

  // Card 8: local-cost
  const t8M = g.pick([2, 3, 4, 5]);
  const t8P = g.pick([10, 20, 30]);
  const t8N = t8M * t8P;
  const t8Ans = t8M * Math.pow(t8P, 3);

  // Card 9: challenge
  const t9 = retry(() => {
    const b = g.random(1, 9) / 10;
    const c = g.random(1, 9) / 10;
    const s = g.pick([0.5, 1, 2]);
    const y1 = g.pick([1, 2]);
    const y2 = g.random(-2, 2);
    const y3 = g.random(-2, 2);
    return { b, c, s, y1, y2, y3 };
  }, v => {
    if (v.b <= v.c) return false;
    const { b, c, s, y1, y2, y3 } = v;
    const C = [
      [1 + s, b, c],
      [b, 1 + s, b],
      [c, b, 1 + s],
    ];
    // Check smallest eigenvalue of K > 0.05
    const K = [
      [1, b, c],
      [b, 1, b],
      [c, b, 1],
    ];
    // smallest eigenvalue of K > 0.05  <=>  K − 0.05·I positive definite (Sylvester: leading minors > 0)
    const d = 1 - 0.05;
    const m1 = d;
    const m2 = d * d - b * b;
    const m3 = d * (d * d - b * b) - b * (b * d - c * b) + c * (b * b - d * c);
    if (!(m1 > 0 && m2 > 0 && m3 > 0)) return false;

    const w = y1*y1 + y2*y2 + y3*y3;
    if (w > 6) return false;
    const nonzeros = [y1, y2, y3].filter(x => x !== 0).length;
    if (nonzeros < 2) return false;

    const Cy = [
      C[0][0]*y1 + C[0][1]*y2 + C[0][2]*y3,
      C[1][0]*y1 + C[1][1]*y2 + C[1][2]*y3,
      C[2][0]*y1 + C[2][1]*y2 + C[2][2]*y3,
    ];
    const q = y1*Cy[0] + y2*Cy[1] + y3*Cy[2];
    const T = -(w * w) / (2 * q);
    
    // Wrong routes
    const K_noise = [
      [1, b, c],
      [b, 1, b],
      [c, b, 1],
    ];
    const Cy_noise = [
      K_noise[0][0]*y1 + K_noise[0][1]*y2 + K_noise[0][2]*y3,
      K_noise[1][0]*y1 + K_noise[1][1]*y2 + K_noise[1][2]*y3,
      K_noise[2][0]*y1 + K_noise[2][1]*y2 + K_noise[2][2]*y3,
    ];
    const q_noise = y1*Cy_noise[0] + y2*Cy_noise[1] + y3*Cy_noise[2];
    const T_noise = -(w * w) / (2 * q_noise);

    const K_wrong = [
      [1 + s, b, b],
      [b, 1 + s, b],
      [b, b, 1 + s],
    ];
    const Cy_wrong = [
      K_wrong[0][0]*y1 + K_wrong[0][1]*y2 + K_wrong[0][2]*y3,
      K_wrong[1][0]*y1 + K_wrong[1][1]*y2 + K_wrong[1][2]*y3,
      K_wrong[2][0]*y1 + K_wrong[2][1]*y2 + K_wrong[2][2]*y3,
    ];
    const q_wrong = y1*Cy_wrong[0] + y2*Cy_wrong[1] + y3*Cy_wrong[2];
    const T_wrong = -(w * w) / (2 * q_wrong);

    const T_diag = -(w * w) / (2 * (y1*y1*(1+s) + y2*y2*(1+s) + y3*y3*(1+s)));
    const T_forgot = -w / 2;
    const T_neg = -T;
    const T_q = -(w * w) / q;
    const T_t = w / q;

    const routes = [T_noise, T_wrong, T_diag, T_forgot, T_neg, T_q, T_t];
    return okDenom(T) && minGap(T, routes);
  });
  const t9C = [
    [1 + t9.s, t9.b, t9.c],
    [t9.b, 1 + t9.s, t9.b],
    [t9.c, t9.b, 1 + t9.s],
  ];
  const t9Cy = [
    t9C[0][0]*t9.y1 + t9C[0][1]*t9.y2 + t9C[0][2]*t9.y3,
    t9C[1][0]*t9.y1 + t9C[1][1]*t9.y2 + t9C[1][2]*t9.y3,
    t9C[2][0]*t9.y1 + t9C[2][1]*t9.y2 + t9C[2][2]*t9.y3,
  ];
  const t9q = t9.y1*t9Cy[0] + t9.y2*t9Cy[1] + t9.y3*t9Cy[2];
  const t9w = t9.y1*t9.y1 + t9.y2*t9.y2 + t9.y3*t9.y3;
  const t9Ans = -(t9w * t9w) / (2 * t9q);

  return [
    g.number({
      id: 'toeplitz-row',
      title: t('Reading a Toeplitz matrix', '读懂托普利茨矩阵'),
      prompt: t(
        `Four inputs lie on a regular grid, x₁, x₂, x₃, x₄ = 0, 1, 2, 3 (spacing 1), and the kernel is stationary, k(x, x′) = k(x − x′), so Kᵢⱼ = k(xᵢ − xⱼ) and Kᵢ,ⱼ = Kᵢ₊₁,ⱼ₊₁ (Toeplitz structure). Its values at the lags are k(0) = 1, k(1) = ${num(t1.b)}, k(2) = ${num(t1.c)}, k(3) = ${num(t1.d)}, and k(−r) = k(r). What is the sum of the four entries in the third row of the 4 × 4 matrix K? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `四个输入位于规则网格上，x₁、x₂、x₃、x₄ = 0、1、2、3（间距为 1），核函数是平稳的，k(x, x′) = k(x − x′)，因此 Kᵢⱼ = k(xᵢ − xⱼ)，且 Kᵢ,ⱼ = Kᵢ₊₁,ⱼ₊₁（托普利茨结构）。它在各滞后处的取值为 k(0) = 1，k(1) = ${num(t1.b)}，k(2) = ${num(t1.c)}，k(3) = ${num(t1.d)}，并且 k(−r) = k(r)。4 × 4 矩阵 K 的第三行四个元素之和是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Sum of the third row of K', 'K 的第三行之和'), answer: t1Ans, tolerance: 0.006 }],
      hint: t(
        'Write the third row out entry by entry. Each entry depends only on how many grid steps apart the two inputs are.',
        '把第三行逐个元素写出来。每个元素只取决于两个输入相隔几个网格步长。'
      ),
      explanation: t(
        `Kᵢⱼ = k(|i − j|) in grid steps (Lecture 7 p. 14). Row 3 is (K₃₁, K₃₂, K₃₃, K₃₄) = (k(2), k(1), k(0), k(1)) = (${num(t1.c)}, ${num(t1.b)}, 1, ${num(t1.b)}), whose sum is ${num(t1.c)} + ${par(t1.b)} + 1 + ${par(t1.b)} = ${num(t1Ans)}. The first row (1, ${num(t1.b)}, ${num(t1.c)}, ${num(t1.d)}) sums to ${num(1 + t1.b + t1.c + t1.d)}, but it is a different row: the third row never reaches lag 3, and the entry on each side of the diagonal is k(1), not k(2). This game does not assess the FFT algorithm itself.`,
        `按网格步长计，Kᵢⱼ = k(|i − j|)（第 7 讲第 14 页）。第 3 行为 (K₃₁, K₃₂, K₃₃, K₃₄) = (k(2), k(1), k(0), k(1)) = (${num(t1.c)}、${num(t1.b)}、1、${num(t1.b)})，其和为 ${num(t1.c)} + ${par(t1.b)} + 1 + ${par(t1.b)} = ${num(t1Ans)}。第 1 行 (1、${num(t1.b)}、${num(t1.c)}、${num(t1.d)}) 之和为 ${num(1 + t1.b + t1.c + t1.d)}，但那是另一行：第 3 行不会出现滞后 3，对角线两侧的元素是 k(1) 而不是 k(2)。本游戏不考查快速傅里叶变换算法本身。`
      ),
      audit: { kind: 'GP-20:toeplitz-row', params: { b: t1.b, c: t1.c, d: t1.d } },
    }),
    g.choice({
      id: 'toeplitz-check',
      title: t('When is K Toeplitz?', 'K 何时是托普利茨矩阵？'),
      prompt: t(
        `K has Toeplitz structure when Kᵢ,ⱼ = Kᵢ₊₁,ⱼ₊₁, and then a product K·v can be computed with the fast Fourier transform (Lecture 7 p. 14). Four inputs and a kernel are given in each option; the squared exponential kernel has ℓ = ${num(t2l)}, and the grid spacing is h = ${num(t2h)}. For which option is K a Toeplitz matrix?`,
        `当 Kᵢ,ⱼ = Kᵢ₊₁,ⱼ₊₁ 时，K 具有托普利茨结构，此时乘积 K·v 可用快速傅里叶变换快速算出（第 7 讲第 14 页）。每个选项给出四个输入和一个核函数；平方指数核的 ℓ = ${num(t2l)}，网格间距为 h = ${num(t2h)}。哪个选项中的 K 是托普利茨矩阵？`
      ),
      options: [
        t(`Inputs ${g1s}; k(x, x′) = exp(−(x − x′)²/(2ℓ²))`, `输入 ${g1zh}；k(x, x′) = exp(−(x − x′)²/(2ℓ²))`),
        t(`Inputs ${g2s}; k(x, x′) = exp(−(x − x′)²/(2ℓ²))`, `输入 ${g2zh}；k(x, x′) = exp(−(x − x′)²/(2ℓ²))`),
        t(`Inputs ${g1s}; k(x, x′) = x·x′ (linear kernel)`, `输入 ${g1zh}；k(x, x′) = x·x′（线性核）`),
        t(`Inputs ${g1s}; k(x, x′) = x·x′·exp(−(x − x′)²/(2ℓ²))`, `输入 ${g1zh}；k(x, x′) = x·x′·exp(−(x − x′)²/(2ℓ²))`),
      ],
      correct: 0,
      hint: t(
        'Compare K₁₂ with K₂₃ and K₂₃ with K₃₄ in each option: are they computed from the same distance and the same kernel value?',
        '在每个选项中比较 K₁₂ 与 K₂₃，以及 K₂₃ 与 K₃₄：它们是否由同一个距离、同一个核函数值算出？'
      ),
      explanation: t(
        `Toeplitz structure needs two things together: a regular grid, so that neighbouring pairs have the same spacing, and a stationary kernel, so that equal spacing gives equal entries (Lecture 7 p. 14). With inputs ${g1s} and the squared exponential kernel every neighbouring pair is ${num(t2h)} apart, so K₁₂ = K₂₃ = K₃₄. With inputs ${g2s} the gaps are ${num(t2h)}, ${num(2 * t2h)}, ${num(t2h)}, so K₁₂ = k(${num(t2h)}) differs from K₂₃ = k(${num(2 * t2h)}). The linear kernel is not stationary: K₁₂ = ${num(t2h)}·${par(2 * t2h)} = ${num(2 * t2h * t2h)} but K₂₃ = ${num(2 * t2h)}·${par(3 * t2h)} = ${num(6 * t2h * t2h)}, although the grid is regular. Multiplying the stationary kernel by x·x′ breaks stationarity in the same way. This game does not assess the FFT algorithm.`,
        `托普利茨结构需要两个条件同时成立：网格规则，使相邻的输入对间距相同；核函数平稳，使间距相同时元素相同（第 7 讲第 14 页）。输入为 ${g1zh}，核为平方指数核时，每对相邻输入都相隔 ${num(t2h)}，所以 K₁₂ = K₂₃ = K₃₄。输入为 ${g2zh} 时间隔依次为 ${num(t2h)}、${num(2 * t2h)}、${num(t2h)}，于是 K₁₂ = k(${num(t2h)}) 不同于 K₂₃ = k(${num(2 * t2h)})。线性核不是平稳的：K₁₂ = ${num(t2h)}·${par(2 * t2h)} = ${num(2 * t2h * t2h)}，而 K₂₃ = ${num(2 * t2h)}·${par(3 * t2h)} = ${num(6 * t2h * t2h)}，尽管网格是规则的。把平稳核乘以 x·x′ 同样会破坏平稳性。本游戏不考查快速傅里叶变换算法。`
      ),
    }),
    g.number({
      id: 'separable',
      title: t('A separable kernel on a grid', '网格上的可分离核'),
      prompt: t(
        `Inputs x = (x₁, x₂, x₃) lie on a three-dimensional grid and the kernel is separable: k(x, x′) = k₁(x₁, x₁′)·k₂(x₂, x₂′)·k₃(x₃, x₃′) (Lecture 7 p. 13). The two inputs x and x′ differ in the first and third coordinate: k₁(x₁, x₁′) = ${num(t3.p)} and k₃(x₃, x₃′) = ${num(t3.q)}. They share the second coordinate, where k₂(x₂, x₂) = ${num(t3.v)} (the variance of the second factor). What is k(x, x′)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `输入 x = (x₁, x₂, x₃) 位于三维网格上，核函数可分离：k(x, x′) = k₁(x₁, x₁′)·k₂(x₂, x₂′)·k₃(x₃, x₃′)（第 7 讲第 13 页）。两个输入 x 与 x′ 的第一和第三个坐标不同：k₁(x₁, x₁′) = ${num(t3.p)}，k₃(x₃, x₃′) = ${num(t3.q)}。它们的第二个坐标相同，此处 k₂(x₂, x₂) = ${num(t3.v)}（第二个因子的方差）。k(x, x′) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k(x, x′)', 'k(x, x′)'), answer: t3Ans, tolerance: 0.006 }],
      hint: t(
        'Each coordinate contributes one factor, also a coordinate in which the two inputs agree.',
        '每个坐标都贡献一个因子，两个输入取值相同的坐标也不例外。'
      ),
      explanation: t(
        `A separable kernel multiplies one factor per coordinate (Lecture 7 p. 13): k(x, x′) = ${num(t3.p)}·${par(t3.v)}·${par(t3.q)} = ${num(t3Ans)}. The second factor is not 1 where the coordinates agree; it equals the variance ${num(t3.v)} of that factor. Dropping it would give ${dec3(t3.p * t3.q)}.`,
        `可分离核对每个坐标取一个因子再相乘（第 7 讲第 13 页）：k(x, x′) = ${num(t3.p)}·${par(t3.v)}·${par(t3.q)} = ${num(t3Ans)}。坐标相同时第二个因子并不等于 1，而是等于该因子的方差 ${num(t3.v)}。漏掉它会得到 ${dec3(t3.p * t3.q)}。`
      ),
      audit: { kind: 'GP-20:separable', params: { p: t3.p, v: t3.v, q: t3.q } },
    }),
    g.number({
      id: 'quad-step',
      title: t('The first conjugate gradient step', '共轭梯度的第一步'),
      prompt: t(
        `Conjugate gradients solves Cv = y by minimising f(v) = ½vᵀCv − vᵀy (Lecture 7 p. 18), with C = ${mat([[num(t4.a), num(t4.b)], [num(t4.b), num(t4.c)]])} and y = (${num(t4.y1)}, ${num(t4.y2)}) as a column. It starts at v = 0 and first moves along the direction y: v = t·y, with t chosen so that f is as small as possible. What is t? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `共轭梯度法通过最小化 f(v) = ½vᵀCv − vᵀy 来求解 Cv = y（第 7 讲第 18 页），其中 C = ${mat([[num(t4.a), num(t4.b)], [num(t4.b), num(t4.c)]])}，y = (${num(t4.y1)}, ${num(t4.y2)})（列向量）。它从 v = 0 出发，先沿方向 y 前进：v = t·y，t 取使 f 尽可能小的值。t 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Step length t', '步长 t'), answer: t4Ans, tolerance: 0.006 }],
      hint: t(
        'Put v = t·y into f. What remains is an expression in t alone; for which t is it smallest?',
        '把 v = t·y 代入 f，剩下只含 t 的表达式；t 取何值时它最小？'
      ),
      explanation: t(
        `On the line v = t·y, Cy = ${vec([t4.a * t4.y1 + t4.b * t4.y2, t4.b * t4.y1 + t4.c * t4.y2])} and yᵀCy = ${num(t4.q)}, while yᵀy = 5. So f(t·y) = ${t4f} − 5t, a parabola that opens upward; its slope ${t4slope} − 5 vanishes at t = ${t4t}. Ignoring the coupling b would use ${num(t4.a * t4.y1 * t4.y1 + t4.c * t4.y2 * t4.y2)} instead of ${num(t4.q)} and give ${exact(5 / (t4.a * t4.y1 * t4.y1 + t4.c * t4.y2 * t4.y2))}. One step along y does not solve Cv = y: the exact solution is a different vector, and CG reaches it after at most N = 2 steps (Lecture 7 p. 19). This game does not assess later CG iterations.`,
        `在直线 v = t·y 上，Cy = ${vec([t4.a * t4.y1 + t4.b * t4.y2, t4.b * t4.y1 + t4.c * t4.y2])}，yᵀCy = ${num(t4.q)}，而 yᵀy = 5。所以 f(t·y) = ${t4f} − 5t，是开口向上的抛物线；其斜率 ${t4slope} − 5 在 t = ${t4t} 处为零。若忽略耦合项 b，会用 ${num(t4.a * t4.y1 * t4.y1 + t4.c * t4.y2 * t4.y2)} 代替 ${num(t4.q)}，得到 ${exact(5 / (t4.a * t4.y1 * t4.y1 + t4.c * t4.y2 * t4.y2))}。沿 y 走一步并不能解出 Cv = y：精确解是另一个向量，共轭梯度法最多经 N = 2 步到达它（第 7 讲第 19 页）。本游戏不考查之后的共轭梯度迭代。`
      ),
      audit: { kind: 'GP-20:quad-step', params: { a: t4.a, b: t4.b, c: t4.c, y1: t4.y1, y2: t4.y2 } },
    }),
    g.number({
      id: 'cond-noise',
      title: t('Noise and the condition number', '噪声与条件数'),
      prompt: t(
        `A kernel matrix is K = ${mat([[num(t5.a), num(t5.b)], [num(t5.b), num(t5.a)]])} and the noise variance is σ² = ${num(t5.s)}, so C = K + σ²I. The condition number is κ(C) = λmax(C)/λmin(C), the ratio of the largest to the smallest eigenvalue (Lecture 7 p. 20). What is κ(C)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `核矩阵为 K = ${mat([[num(t5.a), num(t5.b)], [num(t5.b), num(t5.a)]])}，噪声方差为 σ² = ${num(t5.s)}，C = K + σ²I。条件数 κ(C) = λmax(C)/λmin(C)，即最大特征值与最小特征值之比（第 7 讲第 20 页）。κ(C) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('κ(C)', 'κ(C)'), answer: t5Ans, tolerance: 0.006 }],
      hint: t(
        'The eigenvectors of K are (1, 1) and (1, −1). What does adding σ²I do to each eigenvalue?',
        'K 的特征向量是 (1, 1) 和 (1, −1)。加上 σ²I 会使每个特征值发生什么变化？'
      ),
      explanation: t(
        `K has eigenvalues ${t5.a} + ${t5.b} = ${t5.a + t5.b} and ${t5.a} − ${t5.b} = ${t5.a - t5.b}. Adding σ²I adds ${num(t5.s)} to every eigenvalue, so C has ${t5.a + t5.b} + ${par(t5.s)} = ${t5.a + t5.b + t5.s} and ${t5.a - t5.b} + ${par(t5.s)} = ${t5.a - t5.b + t5.s}. Then κ(C) = ${eq(`${t5.a + t5.b + t5.s}/${t5.a - t5.b + t5.s}`, exact(t5Ans))}. Without the noise the ratio would be ${eq(`${t5.a + t5.b}/${t5.a - t5.b}`, exact((t5.a + t5.b) / (t5.a - t5.b)))}: the noise term shrinks the ratio because it lifts the small eigenvalue by the most in relative terms. Large condition numbers slow CG down (Lecture 7 p. 20).`,
        `K 的特征值为 ${t5.a} + ${t5.b} = ${t5.a + t5.b} 和 ${t5.a} − ${t5.b} = ${t5.a - t5.b}。加上 σ²I 会使每个特征值都增加 ${num(t5.s)}，所以 C 的特征值为 ${t5.a + t5.b} + ${par(t5.s)} = ${t5.a + t5.b + t5.s} 和 ${t5.a - t5.b} + ${par(t5.s)} = ${t5.a - t5.b + t5.s}。于是 κ(C) = ${eq(`${t5.a + t5.b + t5.s}/${t5.a - t5.b + t5.s}`, exact(t5Ans))}。若没有噪声，比值为 ${eq(`${t5.a + t5.b}/${t5.a - t5.b}`, exact((t5.a + t5.b) / (t5.a - t5.b)))}：噪声项使比值变小，因为它按相对大小抬高小特征值最多。条件数大会拖慢共轭梯度法（第 7 讲第 20 页）。`
      ),
      audit: { kind: 'GP-20:cond-noise', params: { a: t5.a, b: t5.b, s: t5.s } },
    }),
    g.choice({
      id: 'noise-rescue',
      title: t('Two identical inputs', '两个相同的输入'),
      prompt: t(
        `Two training inputs coincide, so the kernel matrix is K = ${mat([[num(t6.a), num(t6.a)], [num(t6.a), num(t6.a)]])} (all entries equal ${t6.a}), and the noise variance is σ² = ${num(t6.s)}, with C = K + σ²I. The condition number is κ = λmax/λmin (Lecture 7 p. 20). Which statement is correct?`,
        `两个训练输入重合，因此核矩阵为 K = ${mat([[num(t6.a), num(t6.a)], [num(t6.a), num(t6.a)]])}（所有元素都等于 ${t6.a}），噪声方差为 σ² = ${num(t6.s)}，C = K + σ²I。条件数为 κ = λmax/λmin（第 7 讲第 20 页）。下列哪个说法正确？`
      ),
      options: [
        t(`κ(K) is infinite since λmin(K) = 0, but κ(C) = ${exact(t6v)}`, `κ(K) 为无穷大，因为 λmin(K) = 0，但 κ(C) = ${exact(t6v)}`),
        t('κ(K) = 1 because all entries of K are equal, and κ(C) = 1', 'κ(K) = 1，因为 K 的所有元素相等，κ(C) = 1'),
        t('κ(K) and κ(C) are both infinite, since adding σ²I cannot change a zero eigenvalue', 'κ(K) 与 κ(C) 都是无穷大，因为加上 σ²I 改变不了为零的特征值'),
        t(`κ(K) is infinite, and κ(C) = ${exact(t6r)} because only the zero eigenvalue is raised, to σ²`, `κ(K) 为无穷大，κ(C) = ${exact(t6r)}，因为只有为零的特征值被抬高到 σ²`),
      ],
      correct: 0,
      hint: t(
        'Find the eigenvalues of K first (try the vectors (1, 1) and (1, −1)), then add σ² to each.',
        '先求 K 的特征值（试试向量 (1, 1) 和 (1, −1)），再给每个特征值加上 σ²。'
      ),
      explanation: t(
        `K = ${mat([[num(t6.a), num(t6.a)], [num(t6.a), num(t6.a)]])} has eigenvalues ${2 * t6.a} (for (1, 1)) and 0 (for (1, −1)), so λmin(K) = 0 and κ(K) is infinite: K is singular, and equal entries do not mean equal eigenvalues. Adding σ²I raises every eigenvalue by ${num(t6.s)}, including the zero one: C has eigenvalues ${2 * t6.a} + ${par(t6.s)} = ${2 * t6.a + t6.s} and ${num(t6.s)}, so κ(C) = ${eq(`${2 * t6.a + t6.s}/${num(t6.s)}`, exact(t6v))}. The option that lifts only the zero eigenvalue would give ${exact(t6r)}, forgetting that the large one is raised too. This is why the noise term makes the system solvable by CG even for degenerate kernel matrices. This game does not assess the CG iteration itself.`,
        `K = ${mat([[num(t6.a), num(t6.a)], [num(t6.a), num(t6.a)]])} 的特征值为 ${2 * t6.a}（对应 (1, 1)）和 0（对应 (1, −1)），所以 λmin(K) = 0，κ(K) 为无穷大：K 是奇异的，元素相等并不意味着特征值相等。加上 σ²I 会使每个特征值都增加 ${num(t6.s)}，为零的那个也不例外：C 的特征值为 ${2 * t6.a} + ${par(t6.s)} = ${2 * t6.a + t6.s} 和 ${num(t6.s)}，所以 κ(C) = ${eq(`${2 * t6.a + t6.s}/${num(t6.s)}`, exact(t6v))}。只抬高零特征值的说法会得到 ${exact(t6r)}，忘了较大的特征值同样被抬高。这就是即使核矩阵退化，噪声项也能使共轭梯度法可解的原因。本游戏不考查共轭梯度迭代本身。`
      ),
    }),
    g.number({
      id: 'precond',
      title: t('Does the preconditioner help?', '预条件子有帮助吗？'),
      prompt: t(
        `Instead of Cv = y, conjugate gradients solves P⁻¹Cv = P⁻¹y with a preconditioner P (Lecture 7 p. 20). Here C = ${mat([[num(t7.l1), '0'], ['0', num(t7.l2)]])} and P = ${mat([[num(t7.d1), '0'], ['0', num(t7.d2)]])}. The condition number is κ = λmax/λmin, the ratio of the largest to the smallest eigenvalue. What is κ(P⁻¹C)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `共轭梯度法不直接解 Cv = y，而是用预条件子 P 解 P⁻¹Cv = P⁻¹y（第 7 讲第 20 页）。这里 C = ${mat([[num(t7.l1), '0'], ['0', num(t7.l2)]])}，P = ${mat([[num(t7.d1), '0'], ['0', num(t7.d2)]])}。条件数 κ = λmax/λmin，即最大特征值与最小特征值之比。κ(P⁻¹C) 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('κ(P⁻¹C)', 'κ(P⁻¹C)'), answer: t7Ans, tolerance: 0.006 }],
      hint: t(
        'Write P⁻¹ as a matrix first (invert each diagonal entry), then multiply it with C.',
        '先把 P⁻¹ 写成矩阵（对角元素各取倒数），再与 C 相乘。'
      ),
      explanation: t(
        `P⁻¹C = ${eq(`diag(${t7.l1}/${t7.d1}, ${t7.l2}/${t7.d2})`, `diag(${exact(t7r1)}, ${exact(t7r2)})`)}. Its largest eigenvalue is ${exact(Math.max(t7r1, t7r2))} and its smallest ${exact(Math.min(t7r1, t7r2))}, so κ(P⁻¹C) = ${exact(t7Ans)}, smaller than κ(C) = ${eq(`${t7.l1}/${t7.l2}`, exact(t7.l1 / t7.l2))}. Multiplying instead of dividing by P would give ${exact(Math.max(t7.l1 * t7.d1, t7.l2 * t7.d2) / Math.min(t7.l1 * t7.d1, t7.l2 * t7.d2))}. The ideal case P⁻¹ = C⁻¹ would give κ = 1, one CG step (Lecture 7 p. 20), but it needs the inverse we wanted to avoid. This game does not assess how preconditioners are constructed.`,
        `P⁻¹C = ${eq(`diag(${t7.l1}/${t7.d1}, ${t7.l2}/${t7.d2})`, `diag(${exact(t7r1)}, ${exact(t7r2)})`)}。最大特征值为 ${exact(Math.max(t7r1, t7r2))}，最小特征值为 ${exact(Math.min(t7r1, t7r2))}，所以 κ(P⁻¹C) = ${exact(t7Ans)}，小于 κ(C) = ${eq(`${t7.l1}/${t7.l2}`, exact(t7.l1 / t7.l2))}。若乘以 P 而不是除以 P，会得到 ${exact(Math.max(t7.l1 * t7.d1, t7.l2 * t7.d2) / Math.min(t7.l1 * t7.d1, t7.l2 * t7.d2))}。理想情形 P⁻¹ = C⁻¹ 给出 κ = 1，一步即可求解（第 7 讲第 20 页），但这需要我们想避开的逆矩阵。本游戏不考查如何构造预条件子。`
      ),
      audit: { kind: 'GP-20:precond', params: { l1: t7.l1, l2: t7.l2, d1: t7.d1, d2: t7.d2 } },
    }),
    g.number({
      id: 'local-cost',
      title: t('Splitting the data into local experts', '把数据拆给局部专家'),
      prompt: t(
        `N = ${num(t8N)} training points are split into M = ${num(t8M)} subsets of equal size P = N/M, and one GP is fitted independently to each subset (Lecture 7 p. 24). Treat the cost of fitting one GP on P points as exactly P³ units. What is the total cost of all M models, in units? Give an integer.`,
        `N = ${num(t8N)} 个训练点被分成 M = ${num(t8M)} 个大小相等的子集，每个子集大小为 P = N/M，各子集独立拟合一个 GP（第 7 讲第 24 页）。把在 P 个点上拟合一个 GP 的代价当作恰好 P³ 个单位。全部 M 个模型的总代价是多少个单位？请填整数。`
      ),
      fields: [{ label: t('Total cost (units)', '总代价（单位）'), answer: t8Ans, tolerance: 0.006 }],
      hint: t(
        'First find how many points each model sees, then count the models.',
        '先求每个模型看到多少个点，再数一数有几个模型。'
      ),
      explanation: t(
        `Each subset has P = ${num(t8N)}/${num(t8M)} = ${num(t8P)} points, so one model costs ${num(t8P)}³ = ${num(Math.pow(t8P, 3))} units. There are ${num(t8M)} models, so the total is ${num(t8M)}·${par(Math.pow(t8P, 3))} = ${num(t8Ans)} units. A single GP on all ${num(t8N)} points would cost ${num(t8N)}³ = ${num(Math.pow(t8N, 3))} units, which is ${num(t8M)}² = ${num(t8M * t8M)} times more: independence between the subsets is what makes the split cheap, but it also means that the subsets share no information with each other. This game does not assess how the experts' predictions are combined.`,
        `每个子集有 P = ${num(t8N)}/${num(t8M)} = ${num(t8P)} 个点，所以一个模型的代价为 ${num(t8P)}³ = ${num(Math.pow(t8P, 3))} 个单位。共有 ${num(t8M)} 个模型，总代价为 ${num(t8M)}·${par(Math.pow(t8P, 3))} = ${num(t8Ans)} 个单位。在全部 ${num(t8N)} 个点上拟合一个 GP 要 ${num(t8N)}³ = ${num(Math.pow(t8N, 3))} 个单位，是它的 ${num(t8M)}² = ${num(t8M * t8M)} 倍：子集之间相互独立使拆分便宜，但这也意味着各子集彼此不共享信息。本游戏不考查如何合并各专家的预测。`
      ),
      audit: { kind: 'GP-20:local-cost', params: { N: t8N, M: t8M } },
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: one CG step on a grid', '挑战：网格上的一步共轭梯度'),
      prompt: t(
        `Three inputs lie on the regular grid 0, 1, 2 and the stationary kernel has k(0) = 1, k(1) = ${num(t9.b)}, k(2) = ${num(t9.c)}. The noise variance is σ² = ${num(t9.s)} and C = K + σ²I. Conjugate gradients minimises f(v) = ½vᵀCv − vᵀy for y = (${num(t9.y1)}, ${num(t9.y2)}, ${num(t9.y3)}) (as a column). It starts at v = 0 and moves along the direction y: v = t·y, with t chosen so that f is as small as possible. What is the smallest value of f on this line? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `三个输入位于规则网格 0、1、2 上，平稳核满足 k(0) = 1，k(1) = ${num(t9.b)}，k(2) = ${num(t9.c)}。噪声方差为 σ² = ${num(t9.s)}，C = K + σ²I。共轭梯度法对 y = (${num(t9.y1)}, ${num(t9.y2)}, ${num(t9.y3)})（列向量）最小化 f(v) = ½vᵀCv − vᵀy。它从 v = 0 出发，沿方向 y 前进：v = t·y，t 取使 f 尽可能小的值。f 在这条直线上的最小值是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('Smallest value of f on the line', '该直线上 f 的最小值'), answer: t9Ans, tolerance: 0.006 }],
      hint: t(
        'Write out the matrix C first, entry by entry. Then reduce f(t·y) to an expression in t alone.',
        '先把矩阵 C 逐个元素写出来，再把 f(t·y) 化为只含 t 的表达式。'
      ),
      explanation: t(
        `On a regular grid with a stationary kernel Kᵢⱼ = k(|i − j|), so C = ${mat([[num(1 + t9.s), num(t9.b), num(t9.c)], [num(t9.b), num(1 + t9.s), num(t9.b)], [num(t9.c), num(t9.b), num(1 + t9.s)]])} (diagonal 1 + ${par(t9.s)} = ${num(1 + t9.s)}; K₁₃ = k(2) = ${num(t9.c)}). Then Cy = ${vec(t9Cy)} and yᵀCy = ${num(t9q)}, with yᵀy = ${num(t9w)}. On the line v = t·y, f(t·y) = ½·${par(t9q)}·t² − ${par(t9w)}·t, smallest at t = ${eq(`${num(t9w)}/${num(t9q)}`, exact(t9w / t9q))}, where f = −½·${par(t9w)}·${exact(t9w / t9q)} = ${exact(t9Ans)}. Without the noise the value would be ${exact(-(t9w * t9w) / (2 * (t9.y1 * t9.y1 * (1) + t9.y2 * t9.y2 * (1) + t9.y3 * t9.y3 * (1) + 2 * t9.y1 * t9.y2 * t9.b + 2 * t9.y1 * t9.y3 * t9.c + 2 * t9.y2 * t9.y3 * t9.b)))}; with K₁₃ = ${num(t9.b)} wrongly copied from K₁₂ it would be ${exact(-(t9w * t9w) / (2 * (t9.y1 * t9.y1 * (1 + t9.s) + t9.y2 * t9.y2 * (1 + t9.s) + t9.y3 * t9.y3 * (1 + t9.s) + 2 * t9.y1 * t9.y2 * t9.b + 2 * t9.y1 * t9.y3 * t9.b + 2 * t9.y2 * t9.y3 * t9.b)))}. This game does not assess later CG iterations or the FFT product.`,
        `规则网格上的平稳核满足 Kᵢⱼ = k(|i − j|)，所以 C = ${mat([[num(1 + t9.s), num(t9.b), num(t9.c)], [num(t9.b), num(1 + t9.s), num(t9.b)], [num(t9.c), num(t9.b), num(1 + t9.s)]])}（对角线 1 + ${par(t9.s)} = ${num(1 + t9.s)}；K₁₃ = k(2) = ${num(t9.c)}）。于是 Cy = ${vec(t9Cy)}，yᵀCy = ${num(t9q)}，yᵀy = ${num(t9w)}。在直线 v = t·y 上，f(t·y) = ½·${par(t9q)}·t² − ${par(t9w)}·t，在 t = ${eq(`${num(t9w)}/${num(t9q)}`, exact(t9w / t9q))} 处最小，此时 f = −½·${par(t9w)}·${exact(t9w / t9q)} = ${exact(t9Ans)}。若没有噪声，值为 ${exact(-(t9w * t9w) / (2 * (t9.y1 * t9.y1 * (1) + t9.y2 * t9.y2 * (1) + t9.y3 * t9.y3 * (1) + 2 * t9.y1 * t9.y2 * t9.b + 2 * t9.y1 * t9.y3 * t9.c + 2 * t9.y2 * t9.y3 * t9.b)))}；若把 K₁₃ 误取为 K₁₂ 的值 ${num(t9.b)}，则为 ${exact(-(t9w * t9w) / (2 * (t9.y1 * t9.y1 * (1 + t9.s) + t9.y2 * t9.y2 * (1 + t9.s) + t9.y3 * t9.y3 * (1 + t9.s) + 2 * t9.y1 * t9.y2 * t9.b + 2 * t9.y1 * t9.y3 * t9.b + 2 * t9.y2 * t9.y3 * t9.b)))}。本游戏不考查之后的共轭梯度迭代，也不考查快速傅里叶变换乘积。`
      ),
      audit: { kind: 'GP-20:challenge', params: { b: t9.b, c: t9.c, s: t9.s, y1: t9.y1, y2: t9.y2, y3: t9.y3 } },
    }),
  ];
};
