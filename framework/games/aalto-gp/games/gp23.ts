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

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { const r = a % b; a = b; b = r; }
  return a;
}

// NOTE: the plan's "term" usage for coefficients in f = p·k(x₁,·) + q·k(x₂,·) produces
// "+ 1·k(x₁, ·)" and "+ − 3·k(x₂, ·)" which the checker flags as unparenthesised negatives.
// We use par() for each coefficient so that negatives are parenthesised: "(−3)·k(x₂, ·)".
const coef = (x: number): string => par(x);
/** "p·A + q·B" with a coefficient 1 dropped and -1 printed as a minus sign. */
const lead = (x: number, body: string): string => (x === 1 ? body : x === -1 ? `−${body}` : `${num(x)}·${body}`);
const follow = (x: number, body: string): string => `${x < 0 ? '−' : '+'} ${Math.abs(x) === 1 ? body : `${Math.abs(x)}·${body}`}`;
const lin = (p: number, q: number, a: string, b: string): string => `${lead(p, a)} ${follow(q, b)}`;
/** Every wrong route must differ from the truth by at least `gap` on every draw. */
const apart = (truth: number, routes: number[], gap: number): boolean => routes.every(r => Math.abs(r - truth) >= gap - 1e-9);

// Helper: format a vector of numbers with proper minus signs
const vec = (xs: number[]): string => `(${xs.map(num).join(', ')})`;

// Sampling spaces: every space of the plan is enumerated once at module load (explicit lists and exact predicates, guards included),
// then a card draws one entry with g.pick, so every listed set is reachable and nothing outside the plan is drawn.
const rng = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const offDiag = (a: number): number[] => rng(-(a - 1), a - 1).filter(x => x !== 0);
const SIX = [-3, -2, -1, 1, 2, 3];
const FIVE = [-2, -1, 1, 2, 3];

const SPACE1: { a: number; b: number; c: number; p: number; q: number }[] = [];
for (const a of rng(1, 4)) for (const c of rng(1, 4)) for (const b of rng(-3, 3)) for (const p of FIVE) for (const q of FIVE) {
  if (a === c || b === 0 || b * b >= a * c) continue;
  const T = p * b + q * c;
  if (T !== 0 && apart(T, [p * a + q * b, p + q, p * b + q * b, p * a + q * c, p * b - q * c, p * c + q * b], 1)) SPACE1.push({ a, b, c, p, q });
}
const SPACE2: { a: number; b: number; p: number; q: number }[] = [];
for (const a of rng(2, 5)) for (const b of offDiag(a)) for (const p of SIX) for (const q of SIX) {
  const s2 = p * p + q * q, T = a * s2 + 2 * b * p * q;
  if (apart(T, [s2, a * s2, a * s2 - 2 * b * p * q, b * s2 + 2 * a * p * q, a * (p + q) ** 2], 1)) SPACE2.push({ a, b, p, q });
}
const SPACE3: { a: number; b: number; p: number; q: number; u: number; v: number }[] = [];
for (const a of rng(2, 5)) for (const b of offDiag(a)) for (const p of SIX) for (const q of SIX) {
  const u = a * p + b * q, v = b * p + a * q;
  if (Math.abs(u) > 15 || Math.abs(v) > 15) continue;
  const T = a * (p * p + q * q) + 2 * b * p * q, uv = u * u + v * v, det = a * a - b * b;
  if (apart(T, [uv, uv / a, (a * uv + 2 * b * u * v) / det, uv / det, u * (a * u + b * v) + v * (b * u + a * v)], 0.1)) SPACE3.push({ a, b, p, q, u, v });
}
const SPACE4: { a: number; b: number }[] = [];
for (const a of rng(1, 4)) for (const d of [1, 2, 3]) SPACE4.push({ a, b: a + d });
const SPACE5: { a: number; b: number; c: number; u: number; v: number; s: number; d: number; T: number }[] = [];
for (const a of rng(2, 4)) for (const b of offDiag(a)) for (const c of [1, 2, 3]) for (const u of rng(-4, 6)) for (const v of rng(-4, 6)) {
  if (u === 0 && v === 0) continue;
  const s = a + c, d = s * s - b * b, numer = s * u - b * v;
  if (numer === 0) continue;
  if (![1, 2, 4, 5, 10].includes(Math.abs(d / gcd(numer, d)))) continue;
  const T = numer / d;
  if (apart(T, [(a * u - b * v) / (a * a - b * b), (s * u + b * v) / d, (s * v - b * u) / d, u / s, s * u / d], 0.1)) SPACE5.push({ a, b, c, u, v, s, d, T });
}
const SPACE6: { a: number; b: number; c: number; p: number; q: number }[] = [];
for (const a of rng(2, 5)) for (const b of offDiag(a)) for (const c of rng(1, 4)) for (const p of SIX) for (const q of SIX) {
  if (p === q) continue;
  const y1 = (a + c) * p + b * q;
  if (apart(c * p, [y1 - a * p, c * q, y1 - (a * q + b * p), y1, y1 - b * q, c * p + c * q], 1)) SPACE6.push({ a, b, c, p, q });
}
const SPACE9: { a: number; b: number; c: number; p: number; q: number; y1: number; y2: number }[] = [];
for (const a of rng(2, 4)) for (const b of offDiag(a)) for (const c of [1, 2, 3]) for (const p of FIVE) for (const q of FIVE) {
  const y1 = (a + c) * p + b * q, y2 = b * p + (a + c) * q;
  if (Math.abs(y1) > 12 || Math.abs(y2) > 12) continue;
  const T = a * (p * p + q * q) + 2 * b * p * q, det = a * a - b * b, k1 = a * p + b * q, k2 = b * p + a * q;
  if (apart(T, [p * p + q * q, y1 * y1 + y2 * y2, p * y1 + q * y2, (a * (y1 * y1 + y2 * y2) - 2 * b * y1 * y2) / det, k1 * k1 + k2 * k2, Math.sqrt(T)], 0.1)) SPACE9.push({ a, b, c, p, q, y1, y2 });
}

export const gp23: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-23');
  warm(g);

  const c1 = g.pick(SPACE1);
  const c1T = c1.p * c1.b + c1.q * c1.c;
  const c2 = g.pick(SPACE2);
  const c2T = c2.a * (c2.p * c2.p + c2.q * c2.q) + 2 * c2.b * c2.p * c2.q;
  const c3 = g.pick(SPACE3);
  const c3T = c3.p * c3.u + c3.q * c3.v;
  const c4 = g.pick(SPACE4);
  const c4Correct = 2 * c4.a - 2 * c4.b;
  const c4W1 = 2 * c4.a + 2 * c4.b;
  const c4W2 = c4.a;
  const c4W3 = 5 * c4.a + 4 * c4.b;
  const c5 = g.pick(SPACE5);
  const c5T = c5.T;
  const c6 = g.pick(SPACE6);
  const c6y1 = (c6.a + c6.c) * c6.p + c6.b * c6.q;
  const c6y2 = c6.b * c6.p + (c6.a + c6.c) * c6.q;
  const c6T = c6.c * c6.p;
  const c7 = { c: g.pick([2, 3, 4, 5, 6, 10]) };
  const c8 = { N: g.pick([3, 4, 5, 6, 8, 10]) };
  const c9 = g.pick(SPACE9);
  const c9T = c9.a * (c9.p * c9.p + c9.q * c9.q) + 2 * c9.b * c9.p * c9.q;

  // Helper: format matrix entries with proper minus sign
  const mEntry = (x: number): string => num(x);

  return [
    g.number({
      id: 'reproduce',
      title: t('Evaluating a function by an inner product', '用内积计算函数值'),
      prompt: t(
        `In the reproducing kernel Hilbert space of a kernel k, the function f = ${lin(c1.p, c1.q, 'k(x₁, ·)', 'k(x₂, ·)')} is given. The kernel values are k(x₁, x₁) = ${c1.a}, k(x₁, x₂) = ${num(c1.b)} and k(x₂, x₂) = ${c1.c}. What is the inner product ⟨k(x₂, ·), f⟩_H? Give an integer.`,
        `在核函数 k 的再生核希尔伯特空间中，给定函数 f = ${lin(c1.p, c1.q, 'k(x₁, ·)', 'k(x₂, ·)')}。核函数取值为 k(x₁, x₁) = ${c1.a}，k(x₁, x₂) = ${num(c1.b)}，k(x₂, x₂) = ${c1.c}。内积 ⟨k(x₂, ·), f⟩_H 是多少？请填整数。`
      ),
      fields: [{ label: t('⟨k(x₂, ·), f⟩_H', '⟨k(x₂, ·), f⟩_H'), answer: c1T, tolerance: 0.006 }],
      hint: t('The inner product is linear, and ⟨k(x, ·), k(y, ·)⟩_H = k(x, y).', '内积是线性的，并且 ⟨k(x, ·), k(y, ·)⟩_H = k(x, y)。'),
      explanation: t(
        `By linearity, ⟨k(x₂, ·), f⟩_H = ${lin(c1.p, c1.q, '⟨k(x₂, ·), k(x₁, ·)⟩_H', '⟨k(x₂, ·), k(x₂, ·)⟩_H')} = ${lin(c1.p, c1.q, 'k(x₂, x₁)', 'k(x₂, x₂)')} = ${par(c1.p)}·${par(c1.b)} + ${par(c1.q)}·${c1.c} = ${num(c1T)} (Lecture 8 p. 7). This is the reproducing property: the inner product with k(x₂, ·) evaluates f at x₂, so f(x₂) = ${num(c1T)} (Lecture 8 p. 8). Using k(x₁, x₁) = ${c1.a} instead would evaluate f at x₁ and give ${num(c1.p * c1.a + c1.q * c1.b)}. This game does not assess the uniqueness proof of the kernel.`,
        `由线性性，⟨k(x₂, ·), f⟩_H = ${lin(c1.p, c1.q, '⟨k(x₂, ·), k(x₁, ·)⟩_H', '⟨k(x₂, ·), k(x₂, ·)⟩_H')} = ${lin(c1.p, c1.q, 'k(x₂, x₁)', 'k(x₂, x₂)')} = ${par(c1.p)}·${par(c1.b)} + ${par(c1.q)}·${c1.c} = ${num(c1T)}（第 8 讲第 7 页）。这就是再生性质：与 k(x₂, ·) 的内积给出 f 在 x₂ 处的值，所以 f(x₂) = ${num(c1T)}（第 8 讲第 8 页）。若改用 k(x₁, x₁) = ${c1.a}，算出的是 f 在 x₁ 处的值 ${num(c1.p * c1.a + c1.q * c1.b)}。本游戏不考查核函数唯一性的证明。`
      ),
      audit: { kind: 'GP-23:reproduce', params: { a: c1.a, b: c1.b, c: c1.c, p: c1.p, q: c1.q } },
    }),
    g.number({
      id: 'norm-sq',
      title: t('The squared norm of f', 'f 的范数平方'),
      prompt: t(
        `A function in the reproducing kernel Hilbert space of a kernel k is f = ${lin(c2.p, c2.q, 'k(x₁, ·)', 'k(x₂, ·)')}. The kernel matrix is K = ${mat([[mEntry(c2.a), mEntry(c2.b)], [mEntry(c2.b), mEntry(c2.a)]])}, that is k(x₁, x₁) = k(x₂, x₂) = ${c2.a} and k(x₁, x₂) = ${num(c2.b)}. What is the squared norm ‖f‖²_H = ⟨f, f⟩_H? Give an integer.`,
        `在核函数 k 的再生核希尔伯特空间中，f = ${lin(c2.p, c2.q, 'k(x₁, ·)', 'k(x₂, ·)')}。核矩阵为 K = ${mat([[mEntry(c2.a), mEntry(c2.b)], [mEntry(c2.b), mEntry(c2.a)]])}，即 k(x₁, x₁) = k(x₂, x₂) = ${c2.a}，k(x₁, x₂) = ${num(c2.b)}。范数平方 ‖f‖²_H = ⟨f, f⟩_H 是多少？请填整数。`
      ),
      fields: [{ label: t('‖f‖²_H', '‖f‖²_H'), answer: c2T, tolerance: 0.006 }],
      hint: t('Expand ⟨f, f⟩_H with ⟨k(xᵢ, ·), k(xⱼ, ·)⟩_H = k(xᵢ, xⱼ); there are four pairs (i, j).', '用 ⟨k(xᵢ, ·), k(xⱼ, ·)⟩_H = k(xᵢ, xⱼ) 展开 ⟨f, f⟩_H，共有四个 (i, j) 组合。'),
      explanation: t(
        `⟨f, f⟩_H = Σᵢⱼ αᵢαⱼ k(xᵢ, xⱼ) = αᵀKα (Lecture 8 p. 7). With α = ${vec([c2.p, c2.q])} the pairs (1, 1) and (2, 2) give ${c2.a}·${c2.p * c2.p} + ${c2.a}·${c2.q * c2.q} = ${c2.a * (c2.p * c2.p + c2.q * c2.q)}, and the pairs (1, 2) and (2, 1) together give 2·${num(c2.b)}·${par(c2.p)}·${par(c2.q)} = ${num(2 * c2.b * c2.p * c2.q)}. So ‖f‖²_H = ${num(c2T)}. Leaving out the cross term would give ${c2.a * (c2.p * c2.p + c2.q * c2.q)}. A squared norm is never negative: here ${num(c2T)} > 0 because K is positive definite. This game does not assess how the eigenvalues of K are found.`,
        `⟨f, f⟩_H = Σᵢⱼ αᵢαⱼ k(xᵢ, xⱼ) = αᵀKα（第 8 讲第 7 页）。取 α = ${vec([c2.p, c2.q])}，组合 (1, 1) 与 (2, 2) 给出 ${c2.a}·${c2.p * c2.p} + ${c2.a}·${c2.q * c2.q} = ${c2.a * (c2.p * c2.p + c2.q * c2.q)}，组合 (1, 2) 与 (2, 1) 合起来给出 2·${num(c2.b)}·${par(c2.p)}·${par(c2.q)} = ${num(2 * c2.b * c2.p * c2.q)}。所以 ‖f‖²_H = ${num(c2T)}。漏掉交叉项会得到 ${c2.a * (c2.p * c2.p + c2.q * c2.q)}。范数的平方不会为负：这里 ${num(c2T)} > 0，因为 K 是正定的。本游戏不考查如何求 K 的特征值。`
      ),
      audit: { kind: 'GP-23:norm-sq', params: { a: c2.a, b: c2.b, p: c2.p, q: c2.q } },
    }),
    g.number({
      id: 'norm-values',
      title: t('The norm from function values', '由函数值求范数'),
      prompt: t(
        `A function f = α₁k(x₁, ·) + α₂k(x₂, ·) in the reproducing kernel Hilbert space of a kernel k has the values f(x₁) = ${num(c3.u)} and f(x₂) = ${num(c3.v)} at the two training inputs; its coefficients α are not given. The kernel matrix is K = ${mat([[mEntry(c3.a), mEntry(c3.b)], [mEntry(c3.b), mEntry(c3.a)]])}. What is ‖f‖²_H = αᵀKα? Give an integer.`,
        `核函数 k 的再生核希尔伯特空间中的函数 f = α₁k(x₁, ·) + α₂k(x₂, ·) 在两个训练输入处的值为 f(x₁) = ${num(c3.u)}，f(x₂) = ${num(c3.v)}，系数 α 未给出。核矩阵为 K = ${mat([[mEntry(c3.a), mEntry(c3.b)], [mEntry(c3.b), mEntry(c3.a)]])}。‖f‖²_H = αᵀKα 是多少？请填整数。`
      ),
      fields: [{ label: t('‖f‖²_H', '‖f‖²_H'), answer: c3T, tolerance: 0.006 }],
      hint: t('The values satisfy f(xᵢ) = Σⱼ αⱼ k(xᵢ, xⱼ). Find α from them.', '这些值满足 f(xᵢ) = Σⱼ αⱼ k(xᵢ, xⱼ)。先由它们求出 α。'),
      explanation: t(
        `By the reproducing property f(xᵢ) = Σⱼ αⱼ k(xᵢ, xⱼ), that is ${num(c3.u)} = ${c3.a}·α₁ + ${par(c3.b)}·α₂ and ${num(c3.v)} = ${par(c3.b)}·α₁ + ${c3.a}·α₂, whose solution is α = ${vec([c3.p, c3.q])}. Then ‖f‖²_H = αᵀKα = α₁·f(x₁) + α₂·f(x₂) = ${par(c3.p)}·${par(c3.u)} + ${par(c3.q)}·${par(c3.v)} = ${num(c3T)}, because Kα is the vector of function values. Equivalently ‖f‖²_H = fᵀK⁻¹f, the finite-dimensional form that the RKHS norm generalises (GPML §6.1). Using fᵀf = ${c3.u * c3.u + c3.v * c3.v} ignores K and is wrong. This game does not assess the eigenfunction expansion in this card.`,
        `由再生性质 f(xᵢ) = Σⱼ αⱼ k(xᵢ, xⱼ)，即 ${num(c3.u)} = ${c3.a}·α₁ + ${par(c3.b)}·α₂ 与 ${num(c3.v)} = ${par(c3.b)}·α₁ + ${c3.a}·α₂，解得 α = ${vec([c3.p, c3.q])}。于是 ‖f‖²_H = αᵀKα = α₁·f(x₁) + α₂·f(x₂) = ${par(c3.p)}·${par(c3.u)} + ${par(c3.q)}·${par(c3.v)} = ${num(c3T)}，因为 Kα 就是函数值向量。等价地 ‖f‖²_H = fᵀK⁻¹f，这正是再生核希尔伯特空间的范数所推广的有限维形式（教材第 6.1 节）。用 fᵀf = ${c3.u * c3.u + c3.v * c3.v} 忽略了 K，是错的。本游戏在这一关不考查特征函数展开。`
      ),
      audit: { kind: 'GP-23:norm-values', params: { a: c3.a, b: c3.b, u: c3.u, v: c3.v } },
    }),
    g.choice({
      id: 'not-a-norm',
      title: t('Can this be a kernel matrix?', '这能是核矩阵吗？'),
      prompt: t(
        `A symmetric matrix M = ${mat([[mEntry(c4.a), mEntry(c4.b)], [mEntry(c4.b), mEntry(c4.a)]])} is proposed as the kernel matrix of two functions k(x₁, ·) and k(x₂, ·) in a reproducing kernel Hilbert space, so ⟨k(xᵢ, ·), k(xⱼ, ·)⟩_H = Mᵢⱼ. A squared norm can never be negative. For f = α₁k(x₁, ·) + α₂k(x₂, ·) the squared norm is ‖f‖²_H = αᵀMα. Which coefficient vector α proves that M cannot be a kernel matrix?`,
        `对称矩阵 M = ${mat([[mEntry(c4.a), mEntry(c4.b)], [mEntry(c4.b), mEntry(c4.a)]])} 被提议为再生核希尔伯特空间中两个函数 k(x₁, ·) 与 k(x₂, ·) 的核矩阵，即 ⟨k(xᵢ, ·), k(xⱼ, ·)⟩_H = Mᵢⱼ。范数的平方不可能为负。对 f = α₁k(x₁, ·) + α₂k(x₂, ·)，范数平方为 ‖f‖²_H = αᵀMα。哪个系数向量 α 能证明 M 不可能是核矩阵？`
      ),
      options: [
        t(`α = (1, −1), giving αᵀMα = ${num(c4Correct)}`, `α = (1, −1)，此时 αᵀMα = ${num(c4Correct)}`),
        t(`α = (1, 1), giving αᵀMα = ${num(c4W1)}`, `α = (1, 1)，此时 αᵀMα = ${num(c4W1)}`),
        t(`α = (1, 0), giving αᵀMα = ${num(c4W2)}`, `α = (1, 0)，此时 αᵀMα = ${num(c4W2)}`),
        t(`α = (−2, −1), giving αᵀMα = ${num(c4W3)}`, `α = (−2, −1)，此时 αᵀMα = ${num(c4W3)}`),
      ],
      correct: 0,
      hint: t('Evaluate αᵀMα for each option and compare it with what a squared norm must satisfy.', '对每个选项计算 αᵀMα，并与范数平方必须满足的条件比较。'),
      explanation: t(
        `A squared norm satisfies ⟨f, f⟩_H ≥ 0 (Lecture 8 p. 3), and for f = α₁k(x₁, ·) + α₂k(x₂, ·) it equals αᵀMα (Lecture 8 p. 7). For α = (1, −1): αᵀMα = ${c4.a} + ${c4.a} − 2·${c4.b} = ${num(c4Correct)}, which is negative, so no function space can have M as its kernel matrix. The other three vectors give ${num(c4W1)}, ${num(c4W2)} and ${num(c4W3)}, all positive: they cannot show a problem, and a matrix is only a valid kernel matrix if αᵀMα ≥ 0 for every α. Symmetry and a positive diagonal are not enough. The eigenvalues of M are ${c4.a + c4.b} and ${num(c4.a - c4.b)}; the negative one belongs to the eigenvector (1, −1). This game does not assess kernel closure rules (GP-09).`,
        `范数的平方满足 ⟨f, f⟩_H ≥ 0（第 8 讲第 3 页），而对 f = α₁k(x₁, ·) + α₂k(x₂, ·) 它等于 αᵀMα（第 8 讲第 7 页）。取 α = (1, −1)：αᵀMα = ${c4.a} + ${c4.a} − 2·${c4.b} = ${num(c4Correct)}，为负，所以不存在以 M 为核矩阵的函数空间。其余三个向量给出 ${num(c4W1)}、${num(c4W2)} 与 ${num(c4W3)}，都是正数：它们暴露不出问题，而矩阵要成为合法核矩阵，必须对每个 α 都有 αᵀMα ≥ 0。仅有对称性和正的对角线是不够的。M 的特征值为 ${c4.a + c4.b} 和 ${num(c4.a - c4.b)}，负的那个对应特征向量 (1, −1)。本游戏不考查核函数的组合规则（GP-09）。`
      ),
    }),
    g.number({
      id: 'ridge-alpha',
      title: t('The ridge coefficients', '岭回归的系数'),
      prompt: t(
        `Kernel ridge regression minimises Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H over the functions f of a reproducing kernel Hilbert space. The kernel matrix is K = ${mat([[mEntry(c5.a), mEntry(c5.b)], [mEntry(c5.b), mEntry(c5.a)]])}, λ = ${c5.c} and the targets are y = (${num(c5.u)}, ${num(c5.v)}) (as a column). By the representer theorem the minimiser is f̂ = α̂₁k(x₁, ·) + α̂₂k(x₂, ·). What is α̂₁? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `核岭回归在再生核希尔伯特空间的函数 f 上最小化 Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H。核矩阵为 K = ${mat([[mEntry(c5.a), mEntry(c5.b)], [mEntry(c5.b), mEntry(c5.a)]])}，λ = ${c5.c}，目标值为 y = (${num(c5.u)}, ${num(c5.v)})（列向量）。由表示定理，最小值点为 f̂ = α̂₁k(x₁, ·) + α̂₂k(x₂, ·)。α̂₁ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('α̂₁', 'α̂₁'), answer: c5T, tolerance: 0.006 }],
      hint: t('Write the objective as a function of α = (α₁, α₂) and set its derivative to zero.', '把目标函数写成 α = (α₁, α₂) 的函数，并令其导数为零。'),
      explanation: t(
        `Substituting f = Σ αᵢk(xᵢ, ·) turns the objective into J(α) = αᵀ(K² + λK)α − 2yᵀKα (Lecture 8 p. 11). Its derivative vanishes where (K + λI)α̂ = y, so α̂ = (K + λI)⁻¹y. Here K + λI = ${mat([[mEntry(c5.s), mEntry(c5.b)], [mEntry(c5.b), mEntry(c5.s)]])} with s = ${c5.s}, determinant ${c5.s}² − ${par(c5.b)}² = ${c5.d}, and the inverse is (1/${c5.d})·${mat([[mEntry(c5.s), mEntry(-c5.b)], [mEntry(-c5.b), mEntry(c5.s)]])}. So α̂₁ = (${c5.s}·${par(c5.u)} − ${par(c5.b)}·${par(c5.v)})/${c5.d} = ${exact(c5T)}. Leaving out λ would give the interpolating coefficient ${exact((c5.a * c5.u - c5.b * c5.v) / (c5.a * c5.a - c5.b * c5.b))}; flipping the sign of the coupling would give ${exact((c5.s * c5.u + c5.b * c5.v) / c5.d)}. This game does not assess how λ is chosen.`,
        `代入 f = Σ αᵢk(xᵢ, ·)，目标函数化为 J(α) = αᵀ(K² + λK)α − 2yᵀKα（第 8 讲第 11 页）。其导数在 (K + λI)α̂ = y 处为零，所以 α̂ = (K + λI)⁻¹y。这里 K + λI = ${mat([[mEntry(c5.s), mEntry(c5.b)], [mEntry(c5.b), mEntry(c5.s)]])}，s = ${c5.s}，行列式 ${c5.s}² − ${par(c5.b)}² = ${c5.d}，逆矩阵为 (1/${c5.d})·${mat([[mEntry(c5.s), mEntry(-c5.b)], [mEntry(-c5.b), mEntry(c5.s)]])}。于是 α̂₁ = (${c5.s}·${par(c5.u)} − ${par(c5.b)}·${par(c5.v)})/${c5.d} = ${exact(c5T)}。若漏掉 λ，会得到插值解的系数 ${exact((c5.a * c5.u - c5.b * c5.v) / (c5.a * c5.a - c5.b * c5.b))}；若耦合项符号反了，则得到 ${exact((c5.s * c5.u + c5.b * c5.v) / c5.d)}。本游戏不考查 λ 如何选取。`
      ),
      audit: { kind: 'GP-23:ridge-alpha', params: { a: c5.a, b: c5.b, c: c5.c, u: c5.u, v: c5.v } },
    }),
    g.number({
      id: 'fit-residual',
      title: t('Does ridge regression interpolate?', '岭回归会插值吗？'),
      prompt: t(
        `Kernel ridge regression with kernel matrix K = ${mat([[mEntry(c6.a), mEntry(c6.b)], [mEntry(c6.b), mEntry(c6.a)]])} and λ = ${c6.c} is fitted to the targets y = (${num(c6y1)}, ${num(c6y2)}) (as a column). Its coefficients are α̂ = ${vec([c6.p, c6.q])}, so f̂ = α̂₁k(x₁, ·) + α̂₂k(x₂, ·). What is the residual y₁ − f̂(x₁) at the first training input? Give an integer.`,
        `核矩阵为 K = ${mat([[mEntry(c6.a), mEntry(c6.b)], [mEntry(c6.b), mEntry(c6.a)]])}、λ = ${c6.c} 的核岭回归拟合目标值 y = (${num(c6y1)}, ${num(c6y2)})（列向量）。其系数为 α̂ = ${vec([c6.p, c6.q])}，所以 f̂ = α̂₁k(x₁, ·) + α̂₂k(x₂, ·)。第一个训练输入处的残差 y₁ − f̂(x₁) 是多少？请填整数。`
      ),
      fields: [{ label: t('y₁ − f̂(x₁)', 'y₁ − f̂(x₁)'), answer: c6T, tolerance: 0.006 }],
      hint: t('f̂(x₁) is the inner product of k(x₁, ·) with f̂.', 'f̂(x₁) 就是 k(x₁, ·) 与 f̂ 的内积。'),
      explanation: t(
        `By the reproducing property f̂(x₁) = α̂₁·k(x₁, x₁) + α̂₂·k(x₁, x₂) = ${par(c6.p)}·${c6.a} + ${par(c6.q)}·${par(c6.b)} = ${num(c6.a * c6.p + c6.b * c6.q)}. The residual is ${num(c6y1)} − ${par(c6.a * c6.p + c6.b * c6.q)} = ${num(c6T)}. Shortcut: α̂ solves (K + λI)α̂ = y, so y − Kα̂ = λα̂ and the residual at xᵢ is λα̂ᵢ; here ${c6.c}·${par(c6.p)} = ${num(c6T)}. The residuals are not zero because λ > 0: ridge regression shrinks towards a smooth function instead of interpolating the targets. Only λ → 0 gives f̂(xᵢ) = yᵢ. This game does not assess the choice of λ.`,
        `由再生性质 f̂(x₁) = α̂₁·k(x₁, x₁) + α̂₂·k(x₁, x₂) = ${par(c6.p)}·${c6.a} + ${par(c6.q)}·${par(c6.b)} = ${num(c6.a * c6.p + c6.b * c6.q)}。残差为 ${num(c6y1)} − ${par(c6.a * c6.p + c6.b * c6.q)} = ${num(c6T)}。捷径：α̂ 满足 (K + λI)α̂ = y，所以 y − Kα̂ = λα̂，xᵢ 处的残差就是 λα̂ᵢ；这里 ${c6.c}·${par(c6.p)} = ${num(c6T)}。因为 λ > 0，残差不为零：岭回归趋向光滑函数而不是对目标值插值，只有 λ → 0 时才有 f̂(xᵢ) = yᵢ。本游戏不考查 λ 的选取。`
      ),
      audit: { kind: 'GP-23:fit-residual', params: { a: c6.a, b: c6.b, c: c6.c, p: c6.p, q: c6.q } },
    }),
    g.choice({
      id: 'lambda-noise',
      title: t('Ridge λ as a noise variance', '岭参数 λ 即噪声方差'),
      prompt: t(
        `Kernel ridge regression minimises Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H with λ = ${c7.c}. Its prediction equals the posterior mean of a GP regression with the same kernel k and Gaussian observation noise y = f + ε, ε ~ N(0, σ²) (Lecture 8 p. 11). Which noise variance σ² does this correspond to?`,
        `核岭回归最小化 Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H，其中 λ = ${c7.c}。它的预测等于使用相同核函数 k、观测噪声为 y = f + ε（ε ~ N(0, σ²)）的高斯过程回归的后验均值（第 8 讲第 11 页）。它对应哪个噪声方差 σ²？`
      ),
      options: [
        t(`σ² = ${c7.c}, since α̂ = (K + λI)⁻¹y`, `σ² = ${c7.c}，因为 α̂ = (K + λI)⁻¹y`),
        t(`σ² = ${c7.c * c7.c}, because λ is the standard deviation of the noise ε`, `σ² = ${c7.c * c7.c}，因为 λ 是噪声 ε 的标准差`),
        t(`σ² = ${frac(1, c7.c)}, because λ is the precision (inverse variance) of the noise`, `σ² = ${frac(1, c7.c)}，因为 λ 是噪声的精度（方差的倒数）`),
        t(`σ² = ${frac(c7.c, 2)}, because the objective carries a factor of ½ in front of the error term`, `σ² = ${frac(c7.c, 2)}，因为目标函数的误差项前带有因子 ½`),
      ],
      correct: 0,
      hint: t('Compare α̂ = (K + λI)⁻¹y with the posterior mean written with K + σ²I.', '把 α̂ = (K + λI)⁻¹y 与写成 K + σ²I 形式的后验均值作比较。'),
      explanation: t(
        `The ridge minimiser is α̂ = (K + λI)⁻¹y and f̂(x*) = k*ᵀ(K + λI)⁻¹y (Lecture 8 p. 11). The GP posterior mean is k*ᵀ(K + σ²I)⁻¹y, so the two agree exactly when σ² = λ = ${c7.c}. The textbook form J[f] = ½‖f‖²_H + (1/(2σₙ²))Σᵢ(yᵢ − f(xᵢ))² (GPML §6.2, eq. 6.19) multiplied by 2σₙ² has the same shape with λ = σₙ²; the factor ½ cancels and does not halve σ². Taking λ as a standard deviation would give ${c7.c * c7.c}, as a precision ${frac(1, c7.c)}, and halving it ${frac(c7.c, 2)}. This game does not assess the posterior variance.`,
        `岭回归的最小值点为 α̂ = (K + λI)⁻¹y，预测为 f̂(x*) = k*ᵀ(K + λI)⁻¹y（第 8 讲第 11 页）。高斯过程的后验均值为 k*ᵀ(K + σ²I)⁻¹y，所以二者恰好在 σ² = λ = ${c7.c} 时一致。教材中的形式 J[f] = ½‖f‖²_H + (1/(2σₙ²))Σᵢ(yᵢ − f(xᵢ))²（第 6.2 节式 (6.19)）乘以 2σₙ² 后形状相同，且 λ = σₙ²；因子 ½ 被约去，并不会把 σ² 减半。把 λ 当作标准差会得到 ${c7.c * c7.c}，当作精度会得到 ${frac(1, c7.c)}，再减半则得到 ${frac(c7.c, 2)}。本游戏不考查后验方差。`
      ),
    }),
    g.choice({
      id: 'sample-outside',
      title: t('Are GP samples in the RKHS?', '高斯过程的样本在再生核希尔伯特空间里吗？'),
      prompt: t(
        `A kernel has N = ${c8.N} eigenfunctions φ₁, …, φ_N with eigenvalues λ₁, …, λ_N. A random function f = Σᵢ fᵢφᵢ is drawn with independent coefficients fᵢ ~ N(0, λᵢ). Its squared norm in the reproducing kernel Hilbert space H is ‖f‖²_H = Σᵢ fᵢ²/λᵢ. What is E[‖f‖²_H], and what follows when N → ∞?`,
        `某核函数有 N = ${c8.N} 个特征函数 φ₁, …, φ_N，特征值为 λ₁, …, λ_N。随机函数 f = Σᵢ fᵢφᵢ 的系数相互独立，fᵢ ~ N(0, λᵢ)。它在再生核希尔伯特空间 H 中的范数平方为 ‖f‖²_H = Σᵢ fᵢ²/λᵢ。E[‖f‖²_H] 是多少？当 N → ∞ 时会怎样？`
      ),
      options: [
        t(`${c8.N}; it grows without bound as N → ∞, so prior samples are not in H`, `${c8.N}；N → ∞ 时它无限增大，所以先验样本不在 H 中`),
        t(`1; it stays finite as N → ∞, so prior samples are in H`, `1；N → ∞ 时它保持有限，所以先验样本在 H 中`),
        t(`${c8.N * c8.N}; it grows without bound as N → ∞, so prior samples are not in H`, `${c8.N * c8.N}；N → ∞ 时它无限增大，所以先验样本不在 H 中`),
        t(`${frac(c8.N, 2)}; it grows without bound as N → ∞, so prior samples are not in H`, `${frac(c8.N, 2)}；N → ∞ 时它无限增大，所以先验样本不在 H 中`),
      ],
      correct: 0,
      hint: t('For one coefficient, fᵢ has variance λᵢ. What is the expected value of fᵢ²/λᵢ?', '对单个系数，fᵢ 的方差为 λᵢ。fᵢ²/λᵢ 的期望是多少？'),
      explanation: t(
        `E[fᵢ²] = λᵢ, so every term has expectation E[fᵢ²/λᵢ] = 1 whatever the eigenvalue, and the N terms add up to ${c8.N} (GPML §6.1, eq. 6.4). The expected norm grows with N, so for infinitely many eigenfunctions it is infinite and, with probability 1, a prior sample is not an element of H. The posterior mean after observing data does lie in H: it has the representer form Σ α̂ᵢk(xᵢ, ·). The option with 1 forgets that there are N terms, the option with ${c8.N * c8.N} counts every pair of coefficients, and the option with ${frac(c8.N, 2)} uses E[z²] = ½ for a standard normal variable z, but E[z²] = 1. This game does not assess the Mercer expansion itself.`,
        `E[fᵢ²] = λᵢ，所以无论特征值多大，每一项的期望都是 E[fᵢ²/λᵢ] = 1，共 N 项，总和为 ${c8.N}（教材第 6.1 节式 (6.4)）。期望范数随 N 增大，因此特征函数有无穷多个时它为无穷大，先验样本以概率 1 不属于 H。观测数据后的后验均值则属于 H：它具有表示定理的形式 Σ α̂ᵢk(xᵢ, ·)。选 1 的选项忘了共有 N 项，选 ${c8.N * c8.N} 的选项把每一对系数都算了进去，选 ${frac(c8.N, 2)} 的选项把标准正态变量 z 的 E[z²] 当成 ½，而实际是 E[z²] = 1。本游戏不考查默瑟展开本身。`
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: the norm of the ridge solution', '挑战：岭回归解的范数'),
      prompt: t(
        `Kernel ridge regression minimises Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H with kernel matrix K = ${mat([[mEntry(c9.a), mEntry(c9.b)], [mEntry(c9.b), mEntry(c9.a)]])}, λ = ${c9.c} and targets y = (${num(c9.y1)}, ${num(c9.y2)}) (as a column). Its minimiser is f̂ = α̂₁k(x₁, ·) + α̂₂k(x₂, ·). What is the squared norm ‖f̂‖²_H in the reproducing kernel Hilbert space? Give an integer.`,
        `核岭回归最小化 Σᵢ(yᵢ − f(xᵢ))² + λ‖f‖²_H，其中核矩阵 K = ${mat([[mEntry(c9.a), mEntry(c9.b)], [mEntry(c9.b), mEntry(c9.a)]])}，λ = ${c9.c}，目标值 y = (${num(c9.y1)}, ${num(c9.y2)})（列向量）。其最小值点为 f̂ = α̂₁k(x₁, ·) + α̂₂k(x₂, ·)。它在再生核希尔伯特空间中的范数平方 ‖f̂‖²_H 是多少？请填整数。`
      ),
      fields: [{ label: t('‖f̂‖²_H', '‖f̂‖²_H'), answer: c9T, tolerance: 0.006 }],
      hint: t('Two steps are needed: the coefficients first, then the norm.', '需要两步：先求系数，再求范数。'),
      explanation: t(
        `The coefficients solve (K + λI)α̂ = y with K + λI = ${mat([[mEntry(c9.a + c9.c), mEntry(c9.b)], [mEntry(c9.b), mEntry(c9.a + c9.c)]])}, giving α̂ = ${vec([c9.p, c9.q])} (Lecture 8 p. 11). Then ‖f̂‖²_H = α̂ᵀKα̂ = ${c9.a}·(${c9.p * c9.p} + ${c9.q * c9.q}) + 2·${par(c9.b)}·${par(c9.p)}·${par(c9.q)} = ${num(c9T)} (Lecture 8 p. 7). Check: Kα̂ = y − λα̂, so ‖f̂‖²_H = α̂·(y − λα̂) = ${par(c9.p)}·${par(c9.y1 - c9.c * c9.p)} + ${par(c9.q)}·${par(c9.y2 - c9.c * c9.q)} = ${num(c9T)}. Without the ridge term, the interpolating function with coefficients K⁻¹y would have the larger norm ${exact((c9.a * (c9.y1 * c9.y1 + c9.y2 * c9.y2) - 2 * c9.b * c9.y1 * c9.y2) / (c9.a * c9.a - c9.b * c9.b))}: the penalty λ trades data fit for a smaller norm. This game does not assess how λ is chosen or the posterior variance.`,
        `系数满足 (K + λI)α̂ = y，其中 K + λI = ${mat([[mEntry(c9.a + c9.c), mEntry(c9.b)], [mEntry(c9.b), mEntry(c9.a + c9.c)]])}，解得 α̂ = ${vec([c9.p, c9.q])}（第 8 讲第 11 页）。于是 ‖f̂‖²_H = α̂ᵀKα̂ = ${c9.a}·(${c9.p * c9.p} + ${c9.q * c9.q}) + 2·${par(c9.b)}·${par(c9.p)}·${par(c9.q)} = ${num(c9T)}（第 8 讲第 7 页）。验算：Kα̂ = y − λα̂，所以 ‖f̂‖²_H = α̂·(y − λα̂) = ${par(c9.p)}·${par(c9.y1 - c9.c * c9.p)} + ${par(c9.q)}·${par(c9.y2 - c9.c * c9.q)} = ${num(c9T)}。若没有岭项，系数为 K⁻¹y 的插值函数范数更大，为 ${exact((c9.a * (c9.y1 * c9.y1 + c9.y2 * c9.y2) - 2 * c9.b * c9.y1 * c9.y2) / (c9.a * c9.a - c9.b * c9.b))}：惩罚项 λ 以拟合误差换取更小的范数。本游戏不考查 λ 的选取，也不考查后验方差。`
      ),
      audit: { kind: 'GP-23:challenge', params: { a: c9.a, b: c9.b, c: c9.c, y1: c9.y1, y2: c9.y2 } },
    }),
  ];
};
