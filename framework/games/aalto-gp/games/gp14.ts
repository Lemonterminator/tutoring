import type { CardGenerator } from '../../types';
import { exact, makeGpDeck, mat, num, par, term, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const d2 = (x: number) => num(Math.round(x * 100) / 100);
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export const gp14: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-14');
  warm(g);

  // Card 1: feature-entry
  const c1 = retry(() => ({ a1: g.pick([-3, -2, -1, 1, 2, 3]), a2: g.pick([-3, -2, -1, 1, 2, 3]) }),
    v => {
      const m = v.a1 * v.a2;
      if (Math.abs(m) < 2) return false;
      const truth = Math.SQRT2 * m;
      const wrongs = [m, 2 * m, Math.SQRT2 * (v.a1 + v.a2), v.a1 * v.a1 + v.a2 * v.a2, Math.SQRT2 * m * m];
      return wrongs.every(w => Math.abs(truth - w) >= 0.02);
    });
  const c1_m = c1.a1 * c1.a2;
  const c1_answer = Math.SQRT2 * c1_m;

  // Card 2: inner-product
  const c2 = retry(() => ({
    a1: g.pick([-2, -1, 1, 2, 3]), a2: g.pick([-2, -1, 1, 2, 3]),
    b1: g.pick([-2, -1, 1, 2, 3]), b2: g.pick([-2, -1, 1, 2, 3])
  }), v => {
    const s = v.a1 * v.b1 + v.a2 * v.b2;
    if (s === 0 || Math.abs(s) > 7) return false;
    const truth = s * s;
    const Pc = v.a1 * v.a2 * v.b1 * v.b2;
    const r2 = (v.a1 * v.b1) * (v.a1 * v.b1) + (v.a2 * v.b2) * (v.a2 * v.b2);
    const wrongs = [s, r2, r2 + Pc, (v.a1 * v.a1 + v.a2 * v.a2) * (v.b1 * v.b1 + v.b2 * v.b2), 2 * s, (v.a1 * v.b1 - v.a2 * v.b2) * (v.a1 * v.b1 - v.a2 * v.b2)];
    return wrongs.every(w => Math.abs(truth - w) >= 0.02);
  });
  const c2_s = c2.a1 * c2.b1 + c2.a2 * c2.b2;
  const c2_answer = c2_s * c2_s;
  const c2_Pc = c2.a1 * c2.a2 * c2.b1 * c2.b2;

  // Card 3: feature-dist
  const c3 = retry(() => ({ P: g.random(2, 9), Q: g.random(2, 9), R: g.random(-3, 8) }),
    v => {
      if (v.R === 0) return false;
      if (v.R * v.R >= v.P * v.Q) return false;
      const truth = v.P + v.Q - 2 * v.R;
      if (truth < 2) return false;
      const wrongs = [v.P + v.Q + 2 * v.R, v.P + v.Q - v.R, v.P + v.Q, Math.sqrt(v.P + v.Q - 2 * v.R), 2 * v.R - v.P - v.Q, v.P * v.Q - v.R * v.R];
      return wrongs.every(w => Math.abs(truth - w) >= 0.02);
    });
  const c3_answer = c3.P + c3.Q - 2 * c3.R;

  // Card 4: feature-count
  const c4_pairs = [
    { D: 2, p: 3 }, { D: 2, p: 4 }, { D: 3, p: 3 }, { D: 3, p: 4 },
    { D: 4, p: 2 }, { D: 4, p: 3 }, { D: 4, p: 4 }
  ];
  const c4 = c4_pairs[g.random(0, c4_pairs.length - 1)];
  const c4_answer = comb(c4.D + c4.p - 1, c4.p);

  // Card 5: se-term
  const c5 = retry(() => ({ x: g.pick([-3, -2, -1, 1, 2, 3]), xp: g.pick([-3, -2, -1, 1, 2, 3]), l: g.pick([1, 2, 3]) }),
    v => {
      const u = (v.x * v.xp) / (v.l * v.l);
      if (Math.abs(u) < 0.5 || Math.abs(u) > 4) return false;
      if (Math.abs(2 * u - Math.round(2 * u)) > 1e-9) return false;
      const truth = (u * u) / 2;
      const wrongs = [u * u, u, (u * u * u) / 6, (v.x * v.xp) * (v.x * v.xp) / 2, (u * u) / 4, 2 * u * u, (u * u) / 6];
      return wrongs.every(w => Math.abs(truth - w) >= 0.02);
    });
  const c5_u = (c5.x * c5.xp) / (c5.l * c5.l);
  const c5_answer = (c5_u * c5_u) / 2;

  // Card 6: not-unique
  const c6 = retry(() => ({
    a1: g.pick([-2, -1, 1, 2, 3]), a2: g.pick([-2, -1, 1, 2, 3]),
    b1: g.pick([-2, -1, 1, 2, 3]), b2: g.pick([-2, -1, 1, 2, 3])
  }), v => {
    const s = v.a1 * v.b1 + v.a2 * v.b2;
    if (s === 0 || Math.abs(s) > 7) return false;
    const k = s * s;
    const w = (v.a1 * v.b1) * (v.a1 * v.b1) + v.a1 * v.a2 * v.b1 * v.b2 + (v.a2 * v.b2) * (v.a2 * v.b2);
    const twoK = 2 * k;
    return Math.abs(k - w) >= 0.02 && Math.abs(k - twoK) >= 0.02 && Math.abs(w - twoK) >= 0.02;
  });
  const c6_s = c6.a1 * c6.b1 + c6.a2 * c6.b2;
  const c6_k = c6_s * c6_s;
  const c6_w = (c6.a1 * c6.b1) * (c6.a1 * c6.b1) + c6.a1 * c6.a2 * c6.b1 * c6.b2 + (c6.a2 * c6.b2) * (c6.a2 * c6.b2);
  const c6_2k = 2 * c6_k;
  const c6_Pc = c6.a1 * c6.a2 * c6.b1 * c6.b2;

  // Card 7: dist-not-kernel
  const c7 = retry(() => ({ x1: g.random(-2, 2), x2: g.random(-2, 2) }),
    v => {
      if (v.x1 === v.x2) return false;
      const D = (v.x1 - v.x2) * (v.x1 - v.x2) * (1 + (v.x1 + v.x2) * (v.x1 + v.x2));
      return D >= 2;
    });
  const c7_D = (c7.x1 - c7.x2) * (c7.x1 - c7.x2) * (1 + (c7.x1 + c7.x2) * (c7.x1 + c7.x2));

  // Card 8: challenge
  const c8 = retry(() => ({ a: g.random(-3, 3), b: g.random(-3, 3) }),
    v => {
      if (v.a === v.b) return false;
      const T = (v.a - v.b) * (v.a - v.b) * (2 + (v.a + v.b) * (v.a + v.b));
      if (T > 100) return false;
      const wrongs = [
        (v.a - v.b) * (v.a - v.b),
        (v.a * v.a - v.b * v.b) * (v.a * v.a - v.b * v.b),
        (v.a * v.a + 1) * (v.a * v.a + 1) + (v.b * v.b + 1) * (v.b * v.b + 1) - (v.a * v.b + 1) * (v.a * v.b + 1),
        (v.a * v.a + 1) * (v.a * v.a + 1) + (v.b * v.b + 1) * (v.b * v.b + 1) + 2 * (v.a * v.b + 1) * (v.a * v.b + 1),
        (v.a * v.a + 1) * (v.a * v.a + 1) + (v.b * v.b + 1) * (v.b * v.b + 1),
        2 * (v.a - v.b) * (v.a - v.b)
      ];
      return wrongs.every(w => Math.abs(T - w) >= 0.02);
    });
  const c8_kaa = (c8.a * c8.a + 1) * (c8.a * c8.a + 1);
  const c8_kbb = (c8.b * c8.b + 1) * (c8.b * c8.b + 1);
  const c8_kab = (c8.a * c8.b + 1) * (c8.a * c8.b + 1);
  const c8_answer = c8_kaa + c8_kbb - 2 * c8_kab;

  const supMap: Record<number, string> = { 2: '²', 3: '³', 4: '⁴' };
  const subMap: Record<number, string> = { 2: '₂', 3: '₃', 4: '₄' };

  return [
    g.number({
      id: 'feature-entry',
      title: t('The middle feature', '中间那个特征'),
      prompt: t(
        `The quadratic kernel on R² is k(a, b) = (aᵀb)² = a₁²b₁² + 2a₁a₂b₁b₂ + a₂²b₂². Write it as k(a, b) = φ(a)ᵀφ(b) with φ(a) = (a₁², c·a₁a₂, a₂²), where c > 0 is one fixed number. For a = (${num(c1.a1)}, ${num(c1.a2)}), what is the middle entry c·a₁a₂ of φ(a)? Give a number times √2 (for example 3√2), or a decimal rounded to 2 places.`,
        `R² 上的二次核为 k(a, b) = (aᵀb)² = a₁²b₁² + 2a₁a₂b₁b₂ + a₂²b₂²。把它写成 k(a, b) = φ(a)ᵀφ(b)，其中 φ(a) = (a₁², c·a₁a₂, a₂²)，c > 0 是一个固定的数。当 a = (${num(c1.a1)}, ${num(c1.a2)}) 时，φ(a) 的中间元素 c·a₁a₂ 是多少？请填 √2 的整数倍（例如 3√2），或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('middle entry of φ(a)', 'φ(a) 的中间元素'), answer: c1_answer, tolerance: 0.006 }],
      hint: t(
        'Multiply the middle entries of φ(a) and φ(b). That product must equal the cross term printed in k(a, b). What does this say about c·c?',
        '把 φ(a) 和 φ(b) 的中间元素相乘，乘积必须等于 k(a, b) 中印出的交叉项。这说明 c·c 等于多少？'
      ),
      explanation: t(
        `The middle entries of φ(a) and φ(b) multiply to c·a₁a₂ · c·b₁b₂ = c²·a₁a₂b₁b₂, and this must equal the cross term 2a₁a₂b₁b₂ of k(a, b). So c² = 2 and c = √2 (Lecture 5 p. 16, eq. 13). For a = (${num(c1.a1)}, ${num(c1.a2)}): a₁a₂ = ${par(c1.a1)}·${par(c1.a2)} = ${num(c1_m)}, so the middle entry is √2·${par(c1_m)} = ${num(c1_m)}√2 ≈ ${d2(c1_answer)}. The factor c = 2 would give ${num(2 * c1_m)}, which is wrong: it is the square c² that must equal 2.`,
        `φ(a) 与 φ(b) 的中间元素相乘得 c·a₁a₂ · c·b₁b₂ = c²·a₁a₂b₁b₂，它必须等于 k(a, b) 的交叉项 2a₁a₂b₁b₂。所以 c² = 2，c = √2（第 5 讲第 16 页，式 13）。当 a = (${num(c1.a1)}, ${num(c1.a2)}) 时：a₁a₂ = ${par(c1.a1)}·${par(c1.a2)} = ${num(c1_m)}，中间元素为 √2·${par(c1_m)} = ${num(c1_m)}√2 ≈ ${d2(c1_answer)}。取 c = 2 会得到 ${num(2 * c1_m)}，这是错的：必须满足的是 c² = 2。`
      ),
      audit: { kind: 'GP-14:feature-entry', params: { a1: c1.a1, a2: c1.a2 } }
    }),

    g.number({
      id: 'inner-product',
      title: t('An inner product in feature space', '特征空间中的内积'),
      prompt: t(
        `The quadratic kernel on R² has the feature map φ(a) = (a₁², √2·a₁a₂, a₂²) ∈ R³, so k(a, b) = φ(a)ᵀφ(b). For a = (${num(c2.a1)}, ${num(c2.a2)}) and b = (${num(c2.b1)}, ${num(c2.b2)}), compute the inner product φ(a)ᵀφ(b) of the two three-dimensional feature vectors. Give an integer.`,
        `R² 上的二次核的特征映射为 φ(a) = (a₁², √2·a₁a₂, a₂²) ∈ R³，因此 k(a, b) = φ(a)ᵀφ(b)。当 a = (${num(c2.a1)}, ${num(c2.a2)})、b = (${num(c2.b1)}, ${num(c2.b2)}) 时，计算这两个三维特征向量的内积 φ(a)ᵀφ(b)。请填整数。`
      ),
      fields: [{ label: t('φ(a)ᵀφ(b)', 'φ(a)ᵀφ(b)'), answer: c2_answer, tolerance: 0.006 }],
      hint: t(
        'Replace a and b by their numbers first and write both feature vectors with three numbers each. Look at what happens when the two middle entries are multiplied.',
        '先把 a、b 换成数字，把两个特征向量各写成三个数。看看两个中间元素相乘时会发生什么。'
      ),
      explanation: t(
        `φ(a) = (${num(c2.a1 * c2.a1)}, √2·${par(c2.a1 * c2.a2)}, ${num(c2.a2 * c2.a2)}) and φ(b) = (${num(c2.b1 * c2.b1)}, √2·${par(c2.b1 * c2.b2)}, ${num(c2.b2 * c2.b2)}). The inner product is ${num(c2.a1 * c2.a1 * c2.b1 * c2.b1)} + ${par(2 * c2_Pc)} + ${par(c2.a2 * c2.a2 * c2.b2 * c2.b2)} = ${num(c2_answer)}; the middle product is 2·${par(c2.a1 * c2.a2)}·${par(c2.b1 * c2.b2)} because √2·√2 = 2. The same number comes from the two-dimensional inputs alone: aᵀb = ${num(c2.a1)}·${par(c2.b1)} + ${par(c2.a2)}·${par(c2.b2)} = ${num(c2_s)} and ${par(c2_s)}² = ${num(c2_answer)} (Lecture 5 p. 16). That is the kernel trick: the three-dimensional vectors never have to be built (GPML pdf p. 30).`,
        `φ(a) = (${num(c2.a1 * c2.a1)}, √2·${par(c2.a1 * c2.a2)}, ${num(c2.a2 * c2.a2)})，φ(b) = (${num(c2.b1 * c2.b1)}, √2·${par(c2.b1 * c2.b2)}, ${num(c2.b2 * c2.b2)})。内积为 ${num(c2.a1 * c2.a1 * c2.b1 * c2.b1)} + ${par(2 * c2_Pc)} + ${par(c2.a2 * c2.a2 * c2.b2 * c2.b2)} = ${num(c2_answer)}；中间一项等于 2·${par(c2.a1 * c2.a2)}·${par(c2.b1 * c2.b2)}，因为 √2·√2 = 2。只用二维输入也得到同一个数：aᵀb = ${num(c2.a1)}·${par(c2.b1)} + ${par(c2.a2)}·${par(c2.b2)} = ${num(c2_s)}，${par(c2_s)}² = ${num(c2_answer)}（第 5 讲第 16 页）。这就是核技巧：不必真的构造三维向量（GPML pdf 第 30 页）。`
      ),
      audit: { kind: 'GP-14:inner-product', params: { a1: c2.a1, a2: c2.a2, b1: c2.b1, b2: c2.b2 } }
    }),

    g.number({
      id: 'feature-dist',
      title: t('Distance in feature space from kernel values', '由核值求特征空间中的距离'),
      prompt: t(
        `A kernel k is an inner product of feature vectors, k(x, x′) = ⟨φ(x), φ(x′)⟩. For two inputs a and b the kernel values are k(a, a) = ${num(c3.P)}, k(b, b) = ${num(c3.Q)} and k(a, b) = ${num(c3.R)}. The feature vectors φ(a), φ(b) themselves are not given. What is the squared distance ‖φ(a) − φ(b)‖² between them? Give an integer.`,
        `核 k 是特征向量的内积，k(x, x′) = ⟨φ(x), φ(x′)⟩。对两个输入 a、b，核值为 k(a, a) = ${num(c3.P)}，k(b, b) = ${num(c3.Q)}，k(a, b) = ${num(c3.R)}。特征向量 φ(a)、φ(b) 本身未给出。它们之间的平方距离 ‖φ(a) − φ(b)‖² 是多少？请填整数。`
      ),
      fields: [{ label: t('‖φ(a) − φ(b)‖²', '‖φ(a) − φ(b)‖²'), answer: c3_answer, tolerance: 0.006 }],
      hint: t(
        'Write the squared length of the difference φ(a) − φ(b) as an inner product of the difference with itself, multiply it out, and read each inner product off the printed kernel values.',
        '把差 φ(a) − φ(b) 的平方长度写成这个差与自身的内积，展开，再把每个内积换成题中给出的核值。'
      ),
      explanation: t(
        `‖φ(a) − φ(b)‖² = ⟨φ(a), φ(a)⟩ − 2⟨φ(a), φ(b)⟩ + ⟨φ(b), φ(b)⟩ = k(a, a) − 2k(a, b) + k(b, b) = ${num(c3.P)} − 2·${par(c3.R)} + ${par(c3.Q)} = ${num(c3_answer)}. Only kernel values were needed, never φ itself: that is the kernel trick (GPML pdf p. 30). The result is positive, as a squared distance must be; this fits ${par(c3.R)}² = ${num(c3.R * c3.R)} < ${num(c3.P)}·${num(c3.Q)} = ${num(c3.P * c3.Q)}, the Cauchy–Schwarz condition that the Gram matrix of inner products satisfies.`,
        `‖φ(a) − φ(b)‖² = ⟨φ(a), φ(a)⟩ − 2⟨φ(a), φ(b)⟩ + ⟨φ(b), φ(b)⟩ = k(a, a) − 2k(a, b) + k(b, b) = ${num(c3.P)} − 2·${par(c3.R)} + ${par(c3.Q)} = ${num(c3_answer)}。只用到核值，完全不需要 φ 本身：这就是核技巧（GPML pdf 第 30 页）。结果为正，平方距离理应如此；这与 ${par(c3.R)}² = ${num(c3.R * c3.R)} < ${num(c3.P)}·${num(c3.Q)} = ${num(c3.P * c3.Q)} 相符，即内积的 Gram 矩阵满足的柯西–施瓦茨条件（推导所得）。`
      ),
      audit: { kind: 'GP-14:feature-dist', params: { P: c3.P, Q: c3.Q, R: c3.R } }
    }),

    g.number({
      id: 'feature-count',
      title: t('How many features?', '有多少个特征？'),
      prompt: t(
        `The polynomial kernel k(a, b) = (aᵀb) raised to the power ${num(c4.p)}, on R${supMap[c4.D]} (D = ${num(c4.D)} coordinates), is an inner product of feature vectors whose entries correspond to the distinct products of exactly ${num(c4.p)} coordinates chosen from a₁, …, a${subMap[c4.D]} (repetition allowed, order does not matter; for D = 2 and p = 2 these are a₁², a₁a₂, a₂²). How many entries does the feature vector have? Give an integer.`,
        `R${supMap[c4.D]} 上的多项式核 k(a, b) = (aᵀb) 的 ${num(c4.p)} 次方（D = ${num(c4.D)}，p = ${num(c4.p)}）是特征向量的内积，其元素对应从 a₁, …, a${subMap[c4.D]} 中取恰好 ${num(c4.p)} 个坐标所得的互不相同的乘积（可重复，不计顺序；例如 D = 2、p = 2 时为 a₁²、a₁a₂、a₂²）。特征向量有多少个元素？请填整数。`
      ),
      fields: [{ label: t('number of entries', '元素个数'), answer: c4_answer, tolerance: 0.006 }],
      hint: t(
        'Organise the list by how many times the first coordinate appears, then count the ways to fill the remaining places with the other coordinates.',
        '按第一个坐标出现的次数来整理清单，再数其余位置用其他坐标填满的方式。'
      ),
      explanation: t(
        `Choosing ${num(c4.p)} coordinates out of ${num(c4.D)} with repetition gives C(${num(c4.D)} + ${par(c4.p)} − 1, ${num(c4.p)}) = C(${num(c4.D + c4.p - 1)}, ${num(c4.p)}) = ${num(c4_answer)} distinct products (stars and bars; for D = 2, p = 2 it gives the three entries of Lecture 5 p. 16). Counting ${num(c4.D)} to the power ${num(c4.p)} = ${num(Math.pow(c4.D, c4.p))} would treat a₁a₂ and a₂a₁ as different entries. Evaluating the kernel directly needs only the ${num(c4.D)} products of aᵀb and one power, while building the ${num(c4_answer)} entries grows quickly with D and p; for the squared exponential kernel the number of entries is infinite (Lecture 5 p. 18).`,
        `从 ${num(c4.D)} 个坐标中可重复地取 ${num(c4.p)} 个，互不相同的乘积共有 C(${num(c4.D)} + ${par(c4.p)} − 1, ${num(c4.p)}) = C(${num(c4.D + c4.p - 1)}, ${num(c4.p)}) = ${num(c4_answer)} 个（隔板法，推导所得；D = 2、p = 2 时得到第 5 讲第 16 页的三个元素）。若算 ${num(c4.D)} 的 ${num(c4.p)} 次方 = ${num(Math.pow(c4.D, c4.p))}，就把 a₁a₂ 和 a₂a₁ 当成不同元素了。直接算核只需 aᵀb 的 ${num(c4.D)} 个乘积再取一次幂，而构造 ${num(c4_answer)} 个元素的特征向量随 D、p 增长很快；平方指数核的特征个数是无穷多（第 5 讲第 18 页）。`
      ),
      audit: { kind: 'GP-14:feature-count', params: { D: c4.D, p: c4.p } }
    }),

    g.number({
      id: 'se-term',
      title: t('A term of the squared exponential series', '平方指数核级数的一项'),
      prompt: t(
        `The squared exponential kernel k(x, x′) = exp(−(x − x′)²/(2ℓ²)) is an inner product of infinitely many features: k(x, x′) = exp(−x²/(2ℓ²))·exp(−x′²/(2ℓ²))·(1 + u + u²/2! + u³/3! + …), where u = x·x′/ℓ². The term with index n comes from the pair of features that contain xⁿ and x′ⁿ. For x = ${num(c5.x)}, x′ = ${num(c5.xp)} and ℓ = ${num(c5.l)}, what is the term with n = 2 of the bracket? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `平方指数核 k(x, x′) = exp(−(x − x′)²/(2ℓ²)) 是无穷多个特征的内积：k(x, x′) = exp(−x²/(2ℓ²))·exp(−x′²/(2ℓ²))·(1 + u + u²/2! + u³/3! + …)，其中 u = x·x′/ℓ²。下标为 n 的项来自含 xⁿ 和 x′ⁿ 的那一对特征。当 x = ${num(c5.x)}、x′ = ${num(c5.xp)}、ℓ = ${num(c5.l)} 时，括号中 n = 2 的项是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('term n = 2', 'n = 2 的项'), answer: c5_answer, tolerance: 0.006 }],
      hint: t(
        'Put x, x′ and ℓ into u first. Then look only at the term of the bracket with n = 2.',
        '先把 x、x′ 和 ℓ 代入 u，然后只看括号里 n = 2 的那一项。'
      ),
      explanation: t(
        `u = x·x′/ℓ² = ${num(c5.x)}·${par(c5.xp)}/${num(c5.l)}² = ${exact(c5_u)}. The term with n = 2 is u²/2! = (${exact(c5_u)})²/2 = ${exact(c5_answer)}. Multiplying the two features that contain x² and x′² gives exactly this term together with the common factor exp(−x²/(2ℓ²))·exp(−x′²/(2ℓ²)) (Lecture 5 p. 18, eq. 15, entry 1/√(2!ℓ⁴)·x²). The product form of the series follows from exp(−x²/(2ℓ²) − x′²/(2ℓ²) + u) = exp(−(x − x′)²/(2ℓ²)). The bracket never ends, so no finite feature vector reproduces k.`,
        `u = x·x′/ℓ² = ${num(c5.x)}·${par(c5.xp)}/${num(c5.l)}² = ${exact(c5_u)}。n = 2 的项为 u²/2! = (${exact(c5_u)})²/2 = ${exact(c5_answer)}。把含 x² 与 x′² 的两个特征相乘，恰好得到这一项再乘公共因子 exp(−x²/(2ℓ²))·exp(−x′²/(2ℓ²))（第 5 讲第 18 页，式 15，元素 1/√(2!ℓ⁴)·x²）。级数的乘积形式来自 exp(−x²/(2ℓ²) − x′²/(2ℓ²) + u) = exp(−(x − x′)²/(2ℓ²))。括号里的项永不终止，所以没有任何有限维特征向量能还原 k。`
      ),
      audit: { kind: 'GP-14:se-term', params: { x: c5.x, xp: c5.xp, l: c5.l } }
    }),

    g.choice({
      id: 'not-unique',
      title: t('Two feature maps, one kernel', '两个特征映射，同一个核'),
      prompt: t(
        `Two students write feature maps for the quadratic kernel k(a, b) = (aᵀb)² on R². Student P: φ(a) = (a₁², √2·a₁a₂, a₂²) in R³. Student Q: ψ(a) = (a₁², a₁a₂, a₁a₂, a₂²) in R⁴. For a = (${num(c6.a1)}, ${num(c6.a2)}) and b = (${num(c6.b1)}, ${num(c6.b2)}), which statement is correct?`,
        `两位同学为 R² 上的二次核 k(a, b) = (aᵀb)² 写出了特征映射。同学 P：R³ 中的 φ(a) = (a₁², √2·a₁a₂, a₂²)。同学 Q：R⁴ 中的 ψ(a) = (a₁², a₁a₂, a₁a₂, a₂²)。当 a = (${num(c6.a1)}, ${num(c6.a2)})、b = (${num(c6.b1)}, ${num(c6.b2)}) 时，下列哪条说法正确？`
      ),
      options: [
        t(`Both inner products equal ${num(c6_k)}: a kernel does not fix its feature map or its dimension.`,
          `两个内积都等于 ${num(c6_k)}：核并不决定特征映射或其维数。`),
        t(`Only P is right: with Q the inner product is ${num(c6_w)}, which is not k(a, b) = ${num(c6_k)}.`,
          `只有 P 对：用 Q 得到的内积是 ${num(c6_w)}，不等于 k(a, b) = ${num(c6_k)}。`),
        t(`Only P is right: the feature space of a quadratic kernel on R² has dimension exactly 3, so a four-dimensional map cannot reproduce k.`,
          `只有 P 对：R² 上二次核的特征空间恰好是 3 维，四维映射无法还原 k。`),
        t(`Both maps are valid, but Q gives ${num(c6_2k)}, twice the kernel value, so Q describes a different kernel.`,
          `两个映射都合法，但 Q 给出 ${num(c6_2k)}，是核值的两倍，所以 Q 描述的是另一个核。`)
      ],
      correct: 0,
      hint: t(
        'Compute the inner product with each of the two maps, with numbers. How many entries does each map have, and does the kernel value change?',
        '分别用两个映射、代入数字算内积。每个映射有几个元素？核值变了吗？'
      ),
      explanation: t(
        `φ(a) = (${num(c6.a1 * c6.a1)}, √2·${par(c6.a1 * c6.a2)}, ${num(c6.a2 * c6.a2)}), φ(b) = (${num(c6.b1 * c6.b1)}, √2·${par(c6.b1 * c6.b2)}, ${num(c6.b2 * c6.b2)}): inner product ${num(c6.a1 * c6.a1 * c6.b1 * c6.b1)} + ${par(2 * c6_Pc)} + ${par(c6.a2 * c6.a2 * c6.b2 * c6.b2)} = ${num(c6_k)}. ψ(a) = (${num(c6.a1 * c6.a1)}, ${num(c6.a1 * c6.a2)}, ${num(c6.a1 * c6.a2)}, ${num(c6.a2 * c6.a2)}), ψ(b) = (${num(c6.b1 * c6.b1)}, ${num(c6.b1 * c6.b2)}, ${num(c6.b1 * c6.b2)}, ${num(c6.b2 * c6.b2)}): inner product ${num(c6.a1 * c6.a1 * c6.b1 * c6.b1)} + ${par(c6_Pc)} + ${par(c6_Pc)} + ${par(c6.a2 * c6.a2 * c6.b2 * c6.b2)} = ${num(c6_k)}. The two equal entries of ψ add up to the cross term 2a₁a₂b₁b₂ that √2·√2 produced in P. Both maps give k(a, b) = (${num(c6_s)})² = ${num(c6_k)}, in dimensions 3 and 4, so the feature map and its dimension are not determined by the kernel (shown here, not stated so in the lecture, which only says that there is a space where the kernel is linear, p. 18). Dropping the second copy would give ${num(c6_w)} instead of ${num(c6_k)}, and a feature space can be larger than the minimum without changing k.`,
        `φ(a) = (${num(c6.a1 * c6.a1)}, √2·${par(c6.a1 * c6.a2)}, ${num(c6.a2 * c6.a2)})，φ(b) = (${num(c6.b1 * c6.b1)}, √2·${par(c6.b1 * c6.b2)}, ${num(c6.b2 * c6.b2)})：内积 ${num(c6.a1 * c6.a1 * c6.b1 * c6.b1)} + ${par(2 * c6_Pc)} + ${par(c6.a2 * c6.a2 * c6.b2 * c6.b2)} = ${num(c6_k)}。ψ(a) = (${num(c6.a1 * c6.a1)}, ${num(c6.a1 * c6.a2)}, ${num(c6.a1 * c6.a2)}, ${num(c6.a2 * c6.a2)})，ψ(b) = (${num(c6.b1 * c6.b1)}, ${num(c6.b1 * c6.b2)}, ${num(c6.b1 * c6.b2)}, ${num(c6.b2 * c6.b2)})：内积 ${num(c6.a1 * c6.a1 * c6.b1 * c6.b1)} + ${par(c6_Pc)} + ${par(c6_Pc)} + ${par(c6.a2 * c6.a2 * c6.b2 * c6.b2)} = ${num(c6_k)}。ψ 中两个相同的元素相加，恰好得到 P 中 √2·√2 产生的交叉项 2a₁a₂b₁b₂。两个映射都给出 k(a, b) = (${num(c6_s)})² = ${num(c6_k)}，维数分别是 3 和 4，所以核并不决定特征映射及其维数（推导所得；讲义只说存在一个使核成为线性的空间，第 18 页）。去掉第二个副本会得到 ${num(c6_w)} 而不是 ${num(c6_k)}；特征空间可以比最小维数大而不改变 k。`
      )
    }),

    g.choice({
      id: 'dist-not-kernel',
      title: t('Is a squared distance a kernel?', '平方距离是核吗？'),
      prompt: t(
        `A student takes the feature map h(x) = (x, x²) and proposes k(x, x′) = ‖h(x) − h(x′)‖², the squared distance between the feature vectors, as a covariance function. At x₁ = ${num(c7.x1)} and x₂ = ${num(c7.x2)} its Gram matrix is K = ${mat([[num(0), num(c7_D)], [num(c7_D), num(0)]])}. Which statement is correct?`,
        `一位同学取特征映射 h(x) = (x, x²)，提出把特征向量之间的平方距离 k(x, x′) = ‖h(x) − h(x′)‖² 作为协方差函数。在 x₁ = ${num(c7.x1)}、x₂ = ${num(c7.x2)} 处，它的 Gram 矩阵为 K = ${mat([[num(0), num(c7_D)], [num(c7_D), num(0)]])}。下列哪条说法正确？`
      ),
      options: [
        t(`Not valid: the eigenvalues are ${num(c7_D)} and ${num(-c7_D)}, and a Gram matrix has none below zero.`,
          `不合法：特征值为 ${num(c7_D)} 和 ${num(-c7_D)}，Gram 矩阵没有负特征值。`),
        t(`Valid: K is symmetric and all its entries are non-negative.`,
          `合法：K 是对称的，且所有元素非负。`),
        t(`Valid: it is a squared distance between feature vectors, so it is never negative.`,
          `合法：它是特征向量之间的平方距离，永远不为负。`),
        t(`Not valid only because the diagonal is 0: with the diagonal 1 and the same off-diagonal entry it would be valid.`,
          `不合法只是因为对角元为 0：若把对角元改为 1、非对角元保持不变，它就合法了。`)
      ],
      correct: 0,
      hint: t(
        'Find the two eigenvectors of K (add and subtract the two coordinates). Is any eigenvalue negative? What would that mean for a vector v with vᵀKv?',
        '求 K 的两个特征向量（两个坐标相加、相减）。有没有负的特征值？这对满足 vᵀKv 的向量 v 意味着什么？'
      ),
      explanation: t(
        `K·(1, 1) = (${num(c7_D)}, ${num(c7_D)}) = ${num(c7_D)}·(1, 1) and K·(1, −1) = (${num(-c7_D)}, ${num(c7_D)}) = ${num(-c7_D)}·(1, −1), so the eigenvalues are ${num(c7_D)} and ${num(-c7_D)}. A Gram matrix of inner products ⟨φ(xᵢ), φ(xⱼ)⟩ satisfies vᵀKv = ‖Σ vᵢφ(xᵢ)‖² ≥ 0 for every v (GPML pdf p. 98: a symmetric matrix is positive semi-definite exactly when all eigenvalues are non-negative), but here v = (1, −1) gives vᵀKv = ${num(-2 * c7_D)}. The squared distance is built from k(x, x) − 2k(x, x′) + k(x′, x′), which has a minus sign in front of the cross term; the sign is exactly what a kernel cannot have. Changing the diagonal to 1 does not help: ${mat([[num(1), num(c7_D)], [num(c7_D), num(1)]])} has the eigenvalue ${num(1 - c7_D)}. This game does not assess combining kernels (GP-09) or fitting hyperparameters.`,
        `K·(1, 1) = (${num(c7_D)}, ${num(c7_D)}) = ${num(c7_D)}·(1, 1)，K·(1, −1) = (${num(-c7_D)}, ${num(c7_D)}) = ${num(-c7_D)}·(1, −1)，所以特征值为 ${num(c7_D)} 和 ${num(-c7_D)}。由内积 ⟨φ(xᵢ), φ(xⱼ)⟩ 构成的 Gram 矩阵对任意 v 都有 vᵀKv = ‖Σ vᵢφ(xᵢ)‖² ≥ 0（GPML pdf 第 98 页：对称矩阵半正定当且仅当所有特征值非负），而这里 v = (1, −1) 给出 vᵀKv = ${num(-2 * c7_D)}。平方距离由 k(x, x) − 2k(x, x′) + k(x′, x′) 构成，交叉项前面是负号；核恰恰不能有这个符号。把对角元改成 1 也无济于事：${mat([[num(1), num(c7_D)], [num(c7_D), num(1)]])} 的特征值为 ${num(1 - c7_D)}。本游戏不考查核的组合（GP-09）或超参数拟合。`
      )
    }),

    g.number({
      id: 'challenge',
      title: t('Challenge: a distance for a new kernel', '挑战：新核下的距离'),
      prompt: t(
        `A kernel on R is k(x, x′) = (x·x′ + 1)². It is an inner product of feature vectors, k(x, x′) = ⟨φ(x), φ(x′)⟩. For a = ${num(c8.a)} and b = ${num(c8.b)}, what is the squared distance ‖φ(a) − φ(b)‖² between their feature vectors? Give an integer.`,
        `R 上的核为 k(x, x′) = (x·x′ + 1)²，它是特征向量的内积 k(x, x′) = ⟨φ(x), φ(x′)⟩。当 a = ${num(c8.a)}、b = ${num(c8.b)} 时，它们的特征向量之间的平方距离 ‖φ(a) − φ(b)‖² 是多少？请填整数。`
      ),
      fields: [{ label: t('‖φ(a) − φ(b)‖²', '‖φ(a) − φ(b)‖²'), answer: c8_answer, tolerance: 0.006 }],
      hint: t(
        'Everything you need can be obtained from values of the kernel.',
        '你需要的一切都可以由核的取值得到。'
      ),
      explanation: t(
        `‖φ(a) − φ(b)‖² = k(a, a) − 2k(a, b) + k(b, b). Here k(a, a) = (${num(c8.a)}·${par(c8.a)} + 1)² = ${num(c8_kaa)}, k(b, b) = (${num(c8.b)}·${par(c8.b)} + 1)² = ${num(c8_kbb)} and k(a, b) = (${num(c8.a)}·${par(c8.b)} + 1)² = ${num(c8_kab)}. So the squared distance is ${num(c8_kaa)} − 2·${par(c8_kab)} + ${par(c8_kbb)} = ${num(c8_answer)}. Check with the explicit map φ(x) = (1, √2·x, x²): φ(a) − φ(b) = (0, √2·${par(c8.a - c8.b)}, ${num(c8.a * c8.a - c8.b * c8.b)}), whose squared length is 2·${num((c8.a - c8.b) * (c8.a - c8.b))} + ${par((c8.a * c8.a - c8.b * c8.b) * (c8.a * c8.a - c8.b * c8.b))} = ${num(c8_answer)}. The map is not unique, but the distance is, because it only depends on k. This game does not test fitting hyperparameters by optimisation.`,
        `‖φ(a) − φ(b)‖² = k(a, a) − 2k(a, b) + k(b, b)。这里 k(a, a) = (${num(c8.a)}·${par(c8.a)} + 1)² = ${num(c8_kaa)}，k(b, b) = (${num(c8.b)}·${par(c8.b)} + 1)² = ${num(c8_kbb)}，k(a, b) = (${num(c8.a)}·${par(c8.b)} + 1)² = ${num(c8_kab)}。所以平方距离为 ${num(c8_kaa)} − 2·${par(c8_kab)} + ${par(c8_kbb)} = ${num(c8_answer)}。用显式映射 φ(x) = (1, √2·x, x²) 检验：φ(a) − φ(b) = (0, √2·${par(c8.a - c8.b)}, ${num(c8.a * c8.a - c8.b * c8.b)})，其平方长度为 2·${num((c8.a - c8.b) * (c8.a - c8.b))} + ${par((c8.a * c8.a - c8.b * c8.b) * (c8.a * c8.a - c8.b * c8.b))} = ${num(c8_answer)}。映射不唯一，但距离是唯一的，因为它只依赖于 k。本游戏不考查用优化来拟合超参数。`
      ),
      audit: { kind: 'GP-14:challenge', params: { a: c8.a, b: c8.b } }
    })
  ];
};
