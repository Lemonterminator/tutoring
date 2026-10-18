import type { CardGenerator } from '../../types';
import { fitView, rect, type FigureShape } from '../../figure';
import { coef, frac, makeMvDeck, num, par, type Text } from '../support';

/**
 * EXEMPLAR for the implementers of games 36-50. It is not a real game and is never registered.
 * It shows every pattern a game file needs: bilingual text pairs, bounded resampling, seeded draws only,
 * a number card with audit, a choice card, a symbols card, a figure, and the independent `challenge` card last.
 * A real game has 8-9 cards (7-12 allowed; review and exam games 9-16).
 */
type Deck = ReturnType<typeof makeMvDeck>;
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
  const g = makeMvDeck(seed, lang, 'MIT-MV-99');
  warm(g);

  // Sample everything up front. Every sampled number that an audit uses must be printed in that card's question.
  // Density delta = p*x on the rectangle [0, a] x [0, b]. retry() excludes degenerate samples (here a = b would make a card ambiguous).
  const rc = retry(() => ({ a: g.random(1, 4), b: g.random(1, 4), p: g.pick([1, 2, 3, 4]) }), v => v.a !== v.b);
  const mass = rc.p * rc.b * rc.a * rc.a / 2;                       // M = p b a^2 / 2  (exact; may be a half-integer)
  const xcmNum = rc.p * rc.b * rc.a ** 3 / 3, xcm = xcmNum / mass;    // x_cm = (1/M) * p b a^3 / 3 = 2a/3
  const ch = retry(() => ({ a: g.random(1, 5), c: g.random(1, 4) }), v => v.a !== rc.a);   // different from the first card, so it is not a repeat
  const challenge = ch.c * ch.a ** 2 / 2;                           // independent final card: integral of c*x over 0 <= x <= a, 0 <= y <= 1
  const density = coef(rc.p, 'x');                                  // coef prints x, 2x, ... never 1x
  const integrand = rc.p === 1 ? 'x²' : `${rc.p}x²`;                // x times the density, written without a 1

  const regionShapes: FigureShape[] = [
    { kind: 'area', points: rect(0, 0, rc.a, rc.b), tone: 'accent', opacity: 0.25 },
    { kind: 'line', points: [...rect(0, 0, rc.a, rc.b), [0, 0]], tone: 'accent', width: 2 },
  ];

  return [
    g.number({
      id: 'mass', title: t('Mass of a plate', '薄板的质量'),
      prompt: t(`A plate fills the rectangle 0 ≤ x ≤ ${rc.a}, 0 ≤ y ≤ ${rc.b}. Its density is δ = ${density}. Compute the mass M = ∬ δ dA.`,
        `一块薄板占据矩形 0 ≤ x ≤ ${rc.a}，0 ≤ y ≤ ${rc.b}，密度为 δ = ${density}。计算质量 M = ∬ δ dA。`),
      figure: g.figure({
        alt: t(`The rectangle 0 ≤ x ≤ ${rc.a}, 0 ≤ y ≤ ${rc.b}.`, `矩形 0 ≤ x ≤ ${rc.a}，0 ≤ y ≤ ${rc.b}。`),
        view: fitView(regionShapes, 0.25), axes: { xLabel: 'x', yLabel: 'y', grid: true }, shapes: regionShapes,
      }),
      fields: [{ label: t('M', 'M'), answer: mass }],            // answer is a plain number; the learner may type 3/2 or 1.5
      hint: t('Integrate in x first: the inner integral of the density over 0 ≤ x ≤ a, then multiply by the height b.', '先对 x 积分：密度在 0 ≤ x ≤ a 上的积分，再乘以高 b。'),
      explanation: t(`M = ∫₀^${rc.b} ∫₀^${rc.a} ${density} dx dy = ${par(rc.b)} · ${par(rc.p)} · ${rc.a}²/2 = ${num(mass)}. This is mass, not a centre of mass.`,
        `M = ∫₀^${rc.b} ∫₀^${rc.a} ${density} dx dy = ${par(rc.b)} · ${par(rc.p)} · ${rc.a}²/2 = ${num(mass)}。这里算的是质量，不是质心。`),
      audit: { kind: 'MIT-MV-99:mass', params: { a: rc.a, b: rc.b, p: rc.p } },   // a, b, p are all printed above (p = 1 would be implicit)
    }),
    g.choice({
      id: 'xcm-meaning', title: t('What is x_cm?', 'x_cm 是什么？'),
      prompt: t(`For the plate above, the mass is M = ${num(mass)}. Which formula gives the x-coordinate of the centre of mass?`,
        `对上面的薄板，质量 M = ${num(mass)}。哪个公式给出质心的 x 坐标？`),
      // Options are shuffled by the builder: NEVER refer to an option by its position in any text. Name it by its content.
      options: [t('x_cm = (1/M) ∬ x δ dA', 'x_cm = (1/M) ∬ x δ dA'), t('x_cm = (1/M) ∬ δ dA', 'x_cm = (1/M) ∬ δ dA'), t('x_cm = ∬ x dA', 'x_cm = ∬ x dA')],
      correct: 0,
      hint: t('The centre of mass is the average of x weighted by mass.', '质心是以质量为权的 x 的平均值。'),
      explanation: t('The correct formula weights x by the mass element δ dA and divides by the total mass. The formula (1/M) ∬ δ dA is just 1, and ∬ x dA ignores the density.',
        '正确的公式用质量元 δ dA 给 x 加权，再除以总质量。公式 (1/M) ∬ δ dA 恒等于 1，而 ∬ x dA 忽略了密度。'),
    }),
    g.symbols({
      id: 'setup', title: t('Set up x_cm', '写出 x_cm 的积分'),
      prompt: t(`Write the numerator of x_cm for the plate above as an iterated integral, x inside. Fill the blanks: the upper limit of y, the upper limit of x, and the integrand.`,
        `把上面薄板 x_cm 的分子写成累次积分，x 在内层。填空：y 的上限、x 的上限、被积函数。`),
      before: '∫₀^', between: ['∫₀^', ' '], after: ' dx dy',
      // Every answer token must also be in tokens (shuffled, plus distractors). Never ask for a free expression.
      answers: [String(rc.b), String(rc.a), integrand],
      tokens: shuffled(g, [String(rc.b), String(rc.a), integrand, coef(rc.p, 'x'), String(rc.a + rc.b + 1)]),
      hint: t('The numerator of x_cm is ∬ x δ dA, so the integrand is x times the density.', 'x_cm 的分子是 ∬ x δ dA，所以被积函数是 x 乘以密度。'),
      explanation: t(`The integrand is x · ${density}, the limit of x is ${rc.a} and the limit of y is ${rc.b}.`, `被积函数是 x · ${density}，x 的上限是 ${rc.a}，y 的上限是 ${rc.b}。`),
    }),
    g.number({
      id: 'xcm', title: t('The x-coordinate of the centre of mass', '质心的 x 坐标'),
      prompt: t(`For the same plate (0 ≤ x ≤ ${rc.a}, 0 ≤ y ≤ ${rc.b}, δ = ${density}) compute x_cm = (1/M) ∬ x δ dA. Give a fraction or an integer.`,
        `对同一块薄板（0 ≤ x ≤ ${rc.a}，0 ≤ y ≤ ${rc.b}，δ = ${density}），计算 x_cm = (1/M) ∬ x δ dA。填分数或整数。`),
      fields: [{ label: t('x_cm', 'x_cm'), answer: xcm }],
      hint: t('The numerator is the integral of x · δ; divide it by M.', '分子是 x · δ 的积分，再除以 M。'),
      explanation: t(`∬ x δ dA = ${num(xcmNum)} and M = ${num(mass)}, so x_cm = ${frac(2 * rc.a, 3)}. The density grows with x, so x_cm lies to the right of the middle ${num(rc.a / 2)}.`,
        `∬ x δ dA = ${num(xcmNum)}，M = ${num(mass)}，所以 x_cm = ${frac(2 * rc.a, 3)}。密度随 x 增大，所以 x_cm 在中点 ${num(rc.a / 2)} 的右侧。`),
      audit: { kind: 'MIT-MV-99:xcm', params: { a: rc.a, b: rc.b, p: rc.p } },
    }),
    g.number({
      id: 'challenge', title: t('Challenge: a new density', '挑战：新的密度'),
      prompt: t(`A strip fills 0 ≤ x ≤ ${ch.a}, 0 ≤ y ≤ 1 with density δ = ${coef(ch.c, 'x')}. Compute its mass.`,
        `一条带状薄板占据 0 ≤ x ≤ ${ch.a}，0 ≤ y ≤ 1，密度为 δ = ${coef(ch.c, 'x')}。计算它的质量。`),
      fields: [{ label: t('M', 'M'), answer: challenge }],
      hint: t('Integrate the density over the strip.', '把密度在这条带上积分。'),
      explanation: t(`M = ∫₀^1 ∫₀^${ch.a} ${coef(ch.c, 'x')} dx dy = ${par(ch.c)} · ${ch.a}²/2 = ${num(challenge)}. The height of the strip is 1, so the y-integral contributes the factor 1.`,
        `M = ∫₀^1 ∫₀^${ch.a} ${coef(ch.c, 'x')} dx dy = ${par(ch.c)} · ${ch.a}²/2 = ${num(challenge)}。带的高度为 1，所以对 y 的积分只贡献因子 1。`),
      audit: { kind: 'MIT-MV-99:challenge', params: { a: ch.a, c: ch.c } },
    }),
  ];
};
