import type { CardGenerator } from '../../types';
import { fitView, graphOf, type FigureShape } from '../../figure';
import { exact, makeGpDeck, mat, num, type Text } from '../support';

/**
 * EXEMPLAR for the implementers of the GP games. It is not a real game and is never registered.
 * It shows every pattern a game file needs: bilingual text pairs, bounded resampling, seeded draws only,
 * a number card with audit, a choice card, a symbols card, a figure, matrices in the [[a, b], [c, d]] syntax,
 * and the independent `challenge` card last. A real game has 7–9 cards.
 */
type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

/** Draw with `make` until `ok` holds. Bounded, so a bad sampling condition fails loudly instead of hanging. */
function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** The shared LCG gives near-constant first draws for neighbouring seeds. */
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const exemplarGame: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-99');
  warm(g);

  // One observation y at x₁, prior variance k₁₁ = s, cross-covariance k* = c, noise σ² = n. Kernel VALUES are given; nobody evaluates exp.
  // Sample so that k₁₁ + σ² divides nicely and c² ≤ s (a valid 2 × 2 covariance [[s, c], [c, s]] needs |c| ≤ s).
  const p = retry(() => ({ s: g.pick([1, 2, 3]), c: g.pick([1, 2]), n: g.pick([1, 2, 3]), y: g.random(-6, 6) }), v => v.c <= v.s && v.y !== 0 && (v.s + v.n) % 1 === 0);
  const mean = p.c * p.y / (p.s + p.n);          // μ* = c y / (s + σ²)
  const variance = p.s - p.c * p.c / (p.s + p.n); // σ*² = k** − c² / (s + σ²) with k** = s (stationary kernel)
  const ch = retry(() => ({ s: g.pick([2, 3, 4]), c: g.pick([1, 2]), n: g.pick([1, 2]) }), v => v.c < v.s && v.s !== p.s);
  const chVariance = ch.s - ch.c * ch.c / (ch.s + ch.n);

  // Figure: prior mean 0 and the posterior mean value at x* as a point. Coordinates come from the same sampled numbers as the text.
  const shapes: FigureShape[] = [
    { kind: 'line', points: graphOf(() => 0, -1, 2), tone: 'muted', dash: true, label: t('prior mean', '先验均值')[lang === 'zh' ? 1 : 0] },
    { kind: 'point', at: [0, p.y], tone: 'warn', label: 'y' },
  ];

  return [
    g.number({
      id: 'mean', title: t('Posterior mean from one observation', '一个观测下的后验均值'),
      prompt: t(`A zero-mean GP has k(x₁, x₁) = ${p.s}, k(x*, x₁) = ${p.c} and noise variance σ² = ${p.n}. One observation y = ${num(p.y)} at x₁. Compute the posterior mean μ* of f(x*).`,
        `一个零均值 GP 满足 k(x₁, x₁) = ${p.s}，k(x*, x₁) = ${p.c}，噪声方差 σ² = ${p.n}。在 x₁ 处观测到 y = ${num(p.y)}。计算 f(x*) 的后验均值 μ*。`),
      figure: g.figure({
        alt: t(`The observation y = ${num(p.y)} drawn as a point above x₁ = 0, and the prior mean 0 as a dashed line.`, `观测 y = ${num(p.y)} 画成 x₁ = 0 上方的点，先验均值 0 画成虚线。`),
        view: fitView(shapes, 0.5), axes: { xLabel: 'x', yLabel: 'f', grid: true }, shapes, aspect: 'free',
      }),
      fields: [{ label: t('μ*', 'μ*'), answer: mean }],   // a plain number; the learner may type a fraction
      hint: t('With one observation, C = k(x₁, x₁) + σ² is a number: μ* = k(x*, x₁) · y / C.', '只有一个观测时，C = k(x₁, x₁) + σ² 是一个数：μ* = k(x*, x₁) · y / C。'),
      explanation: t(`C = ${p.s} + ${p.n} = ${p.s + p.n}, so μ* = ${p.c} · ${num(p.y)} / ${p.s + p.n} = ${exact(mean)}.`,
        `C = ${p.s} + ${p.n} = ${p.s + p.n}，所以 μ* = ${p.c} · ${num(p.y)} / ${p.s + p.n} = ${exact(mean)}。`),
      audit: { kind: 'GP-99:mean', params: { s: p.s, c: p.c, n: p.n, y: p.y } },   // every value is printed above
    }),
    g.choice({
      id: 'which-variance', title: t('f* or y*?', 'f* 还是 y*？'),
      prompt: t(`For the same model, the variance of the noisy test observation y* differs from the variance of f(x*) by what?`, `对同一个模型，带噪声的测试观测 y* 的方差与 f(x*) 的方差相差多少？`),
      // Options are shuffled by the builder: NEVER refer to an option by its position in any text. Name it by its content.
      options: [t(`It is larger by σ² = ${p.n}`, `大 σ² = ${p.n}`), t('They are equal', '两者相等'), t(`It is smaller by σ² = ${p.n}`, `小 σ² = ${p.n}`)],
      correct: 0,
      hint: t('y* = f(x*) + ε with independent noise ε.', 'y* = f(x*) + ε，噪声 ε 独立。'),
      explanation: t(`Independent noise adds its variance: Var(y*) = Var(f*) + σ² = Var(f*) + ${p.n}.`, `独立噪声的方差直接相加：Var(y*) = Var(f*) + σ² = Var(f*) + ${p.n}。`),
    }),
    g.symbols({
      id: 'formula', title: t('The variance formula', '方差公式'),
      prompt: t('Complete the posterior variance of f(x*) for one observation.', '补全一个观测下 f(x*) 的后验方差。'),
      before: 'σ*² = ', between: [' − k(x*, x₁)² / ('], after: ')',
      // Every answer token must also be in tokens (shuffled, plus distractors). Never ask for a free expression.
      answers: ['k(x*, x*)', 'k(x₁, x₁) + σ²'], tokens: shuffled(g, ['k(x*, x*)', 'k(x₁, x₁) + σ²', 'k(x₁, x₁)', 'σ²', 'y']),
      hint: t('Start from the prior variance at x* and subtract what the observation explains.', '从 x* 处的先验方差出发，减去观测能解释的部分。'),
      explanation: t('σ*² = k(x*, x*) − k(x*, x₁)² / (k(x₁, x₁) + σ²): the noise enters the denominator.', 'σ*² = k(x*, x*) − k(x*, x₁)² / (k(x₁, x₁) + σ²)：噪声出现在分母里。'),
    }),
    g.number({
      id: 'variance', title: t('Posterior variance of f(x*)', 'f(x*) 的后验方差'),
      prompt: t(`Same model: k(x*, x*) = k(x₁, x₁) = ${p.s}, k(x*, x₁) = ${p.c}, σ² = ${p.n}. The covariance of (f(x₁), f(x*)) is ${mat([[String(p.s), String(p.c)], [String(p.c), String(p.s)]])}. Compute σ*², the variance of f(x*).`,
        `同一个模型：k(x*, x*) = k(x₁, x₁) = ${p.s}，k(x*, x₁) = ${p.c}，σ² = ${p.n}。(f(x₁), f(x*)) 的协方差矩阵为 ${mat([[String(p.s), String(p.c)], [String(p.c), String(p.s)]])}。计算 f(x*) 的方差 σ*²。`),
      fields: [{ label: t('σ*²', 'σ*²'), answer: variance }],
      hint: t('Use the formula from the previous card with the numbers above.', '把上面的数代入上一张卡的公式。'),
      explanation: t(`σ*² = ${p.s} − ${p.c}² / ${p.s + p.n} = ${exact(variance)}.`, `σ*² = ${p.s} − ${p.c}² / ${p.s + p.n} = ${exact(variance)}。`),
      audit: { kind: 'GP-99:variance', params: { s: p.s, c: p.c, n: p.n } },
    }),
    g.number({
      id: 'challenge', title: t('Challenge: a new model', '挑战：新的模型'),
      prompt: t(`A zero-mean GP has k(x*, x*) = k(x₁, x₁) = ${ch.s}, k(x*, x₁) = ${ch.c} and σ² = ${ch.n}. After one observation at x₁, what is the variance of f(x*)?`,
        `一个零均值 GP 满足 k(x*, x*) = k(x₁, x₁) = ${ch.s}，k(x*, x₁) = ${ch.c}，σ² = ${ch.n}。在 x₁ 处观测一次之后，f(x*) 的方差是多少？`),
      fields: [{ label: t('σ*²', 'σ*²'), answer: chVariance }],
      hint: t('Prior variance minus the explained part.', '先验方差减去被解释的部分。'),
      explanation: t(`σ*² = ${ch.s} − ${ch.c}² / (${ch.s} + ${ch.n}) = ${exact(chVariance)}. The observation's value does not enter the variance. This exemplar does not assess hyperparameter fitting.`,
        `σ*² = ${ch.s} − ${ch.c}² / (${ch.s} + ${ch.n}) = ${exact(chVariance)}。观测值本身不影响方差。本示例不考查超参数拟合。`),
      audit: { kind: 'GP-99:challenge', params: { s: ch.s, c: ch.c, n: ch.n } },
    }),
  ];
};
