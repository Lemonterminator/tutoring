import type { CardGenerator } from '../../types';
import { ellipse, fitView, rect, type FigureShape } from '../../figure';
import { coef, frac, makeMvDeck, num, par, piTerm, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
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

export const mv45: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-45');
  warm(g);

  // rect-proof: a, c in {0,1}, b, d in {2,3,4}, p in {1,2,3}; reject unless p*(d-c)*(b^2-a^2) is even
  const rp = retry(() => ({
    a: g.pick([0, 1]), c: g.pick([0, 1]),
    b: g.pick([2, 3, 4]), d: g.pick([2, 3, 4]),
    p: g.pick([1, 2, 3]),
  }), v => {
    const val = v.p * (v.d - v.c) * (v.b * v.b - v.a * v.a);
    return val % 2 === 0;
  });
  const rpAnswer = -rp.p * (rp.d - rp.c) * (rp.b * rp.b - rp.a * rp.a) / 2;

  // shared-edges: m, n in 2..4
  const se = { m: g.pick([2, 3, 4]), n: g.pick([2, 3, 4]) };
  const seAnswer = 2 * se.m * se.n - se.m - se.n;

  // area-pair: k in 1..3
  const ap = { k: g.pick([1, 2, 3]) };

  // ellipse-setup and ellipse-area: a, b in 2..5, a !== b
  const el = retry(() => ({ a: g.pick([2, 3, 4, 5]), b: g.pick([2, 3, 4, 5]) }), v => v.a !== v.b);
  const elAnswer = el.a * el.b * Math.PI;

  // inertia-pair: rho in 1..6
  const ip = { rho: g.pick([1, 2, 3, 4, 5, 6]) };

  // clockwise: same constraints as rect-proof, independent sample
  const cw = retry(() => ({
    a: g.pick([0, 1]), c: g.pick([0, 1]),
    b: g.pick([2, 3, 4]), d: g.pick([2, 3, 4]),
    p: g.pick([1, 2, 3]),
  }), v => {
    const val = v.p * (v.d - v.c) * (v.b * v.b - v.a * v.a);
    return val % 2 === 0;
  });
  const cwS = cw.p * (cw.d - cw.c) * (cw.b * cw.b - cw.a * cw.a) / 2;

  // challenge: rho in 1..4, R in {1,2,3}
  const ch = { rho: g.pick([1, 2, 3, 4]), R: g.pick([1, 2, 3]) };
  const chAnswer = ch.rho * ch.R ** 4 * Math.PI / 4;

  // --- Figures ---
  const rpShapes: FigureShape[] = [
    { kind: 'area', points: rect(rp.a, rp.c, rp.b, rp.d), tone: 'accent', opacity: 0.2 },
    { kind: 'line', points: [...rect(rp.a, rp.c, rp.b, rp.d), [rp.a, rp.c]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [rp.a, rp.c], to: [rp.b, rp.c], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [rp.b, rp.c], to: [rp.b, rp.d], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [rp.b, rp.d], to: [rp.a, rp.d], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [rp.a, rp.d], to: [rp.a, rp.c], tone: 'accent2', width: 2 },
  ];

  const cwShapes: FigureShape[] = [
    { kind: 'area', points: rect(cw.a, cw.c, cw.b, cw.d), tone: 'accent', opacity: 0.2 },
    { kind: 'line', points: [...rect(cw.a, cw.c, cw.b, cw.d), [cw.a, cw.c]], tone: 'accent', width: 2 },
    { kind: 'arrow', from: [cw.a, cw.c], to: [cw.a, cw.d], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [cw.a, cw.d], to: [cw.b, cw.d], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [cw.b, cw.d], to: [cw.b, cw.c], tone: 'accent2', width: 2 },
    { kind: 'arrow', from: [cw.b, cw.c], to: [cw.a, cw.c], tone: 'accent2', width: 2 },
  ];

  const seShapes: FigureShape[] = [];
  for (let i = 0; i <= se.m; i++) seShapes.push({ kind: 'line', points: [[i, 0], [i, se.n]], tone: 'muted', width: 1 });
  for (let j = 0; j <= se.n; j++) seShapes.push({ kind: 'line', points: [[0, j], [se.m, j]], tone: 'muted', width: 1 });
  for (let i = 0; i < se.m; i++) {
    for (let j = 0; j < se.n; j++) {
      const cx = i + 0.5, cy = j + 0.5;
      seShapes.push({ kind: 'arrow', from: [cx - 0.15, cy], to: [cx + 0.15, cy], tone: 'accent2', width: 1 });
      seShapes.push({ kind: 'arrow', from: [cx + 0.15, cy], to: [cx + 0.15, cy + 0.15], tone: 'accent2', width: 1 });
      seShapes.push({ kind: 'arrow', from: [cx + 0.15, cy + 0.15], to: [cx - 0.15, cy + 0.15], tone: 'accent2', width: 1 });
      seShapes.push({ kind: 'arrow', from: [cx - 0.15, cy + 0.15], to: [cx - 0.15, cy], tone: 'accent2', width: 1 });
    }
  }

  const elShapes: FigureShape[] = [
    { kind: 'area', points: ellipse(0, 0, el.a, el.b), tone: 'accent', opacity: 0.15 },
    { kind: 'line', points: ellipse(0, 0, el.a, el.b), tone: 'accent', width: 2 },
    { kind: 'arrow', from: [el.a, 0], to: [el.a * 0.95, el.b * 0.316], tone: 'accent2', width: 2 },
  ];

  // --- area-pair options ---
  const k = ap.k;
  const correctPair = ((): [string, string] => {
    if (k === 1) return ['0', 'x'];
    if (k === 2) return ['0', '2x'];
    return ['0', '3x'];
  })();
  const correctStr = `(${correctPair[0]}, ${correctPair[1]})`;
  const distractorPool: string[] = [
    `(${coef(k, 'y')}, 0)`,
    `(0, ${coef(-k, 'x')})`,
    `(${coef(k, 'x')}, 0)`,
    `(${coef(k, 'y')}, ${coef(k, 'x')})`,
    `(${coef(-k, 'y')}, ${coef(k, 'x')})`,
  ];
  const validDistractors = distractorPool.filter(s => s !== correctStr);
  const apDistractors = shuffled(g, validDistractors).slice(0, 3);
  const apOptions = [correctStr, ...apDistractors];
  const apCorrectIdx = 0;
  // what each wrong pair gives for N_x − M_y, so the explanation only discusses the options that are on the screen
  const apCurl: Record<string, number> = {
    [`(${coef(k, 'y')}, 0)`]: -k, [`(0, ${coef(-k, 'x')})`]: -k, [`(${coef(k, 'x')}, 0)`]: 0,
    [`(${coef(k, 'y')}, ${coef(k, 'x')})`]: 0, [`(${coef(-k, 'y')}, ${coef(k, 'x')})`]: 2 * k,
  };
  const apNotes = (sep: string) => apDistractors.map(d => `${d}: ${par(apCurl[d])}`).join(sep);

  // --- inertia-pair options ---
  const rho = ip.rho;
  const ipCorrect = `(${coef(-rho, 'x²y')}, ${coef(rho, 'xy²')})`;
  const ipDistractorPool = [
    `(${coef(rho, 'x²y')}, ${coef(rho, 'xy²')})`,
    `(${coef(-rho, 'x²y')}, ${coef(-rho, 'xy²')})`,
    `(${coef(-rho, 'xy²')}, ${coef(rho, 'x²y')})`,
    `(0, ${coef(rho, 'x² + y²')})`,
  ];
  const ipValidDistractors = ipDistractorPool.filter(s => s !== ipCorrect);
  const ipDistractors = shuffled(g, ipValidDistractors).slice(0, 3);
  const ipOptions = [ipCorrect, ...ipDistractors];
  const ipCorrectIdx = 0;
  const ipGives: Record<string, string> = {
    [`(${coef(rho, 'x²y')}, ${coef(rho, 'xy²')})`]: `${coef(rho, '')}(y² − x²)`,
    [`(${coef(-rho, 'x²y')}, ${coef(-rho, 'xy²')})`]: `${coef(rho, '')}(x² − y²)`,
    [`(${coef(-rho, 'xy²')}, ${coef(rho, 'x²y')})`]: `${coef(4 * rho, '')}xy`,
    [`(0, ${coef(rho, 'x² + y²')})`]: `${coef(2 * rho, '')}x`,
  };
  const ipNotes = (sep: string, verb: string) => ipDistractors.map(d => `${verb === 'pair' ? 'the pair ' : '对 '}${d}${verb === 'pair' ? ' gives ' : ' 得 '}${ipGives[d]}`).join(sep);

  // --- clockwise options ---
  const cwOptions = [String(cwS), String(-cwS), '0', String(2 * cwS)];
  const cwCorrectIdx = 0;

  // --- ellipse-setup tokens ---
  const elAnswerToken = `${el.a * el.b}cos²θ`;
  const elTokens = shuffled(g, [
    elAnswerToken,
    `${el.a * el.b}sin²θ`,
    `${el.a * el.a}cos²θ`,
    `${el.b * el.b}cos²θ`,
  ]);

  return [
    g.number({
      id: 'rect-proof',
      title: t('Line integral on a rectangle', '矩形上的线积分'),
      prompt: t(
        `R is the rectangle ${rp.a} ≤ x ≤ ${rp.b}, ${rp.c} ≤ y ≤ ${rp.d}, and C is its boundary traversed counterclockwise. Let M = ${coef(rp.p, 'xy')}. Compute ∮_C M dx.`,
        `R 是矩形 ${rp.a} ≤ x ≤ ${rp.b}，${rp.c} ≤ y ≤ ${rp.d}，C 是它的边界，沿逆时针方向行进。设 M = ${coef(rp.p, 'xy')}。计算 ∮_C M dx。`
      ),
      figure: g.figure({
        alt: t(`Rectangle ${rp.a} ≤ x ≤ ${rp.b}, ${rp.c} ≤ y ≤ ${rp.d} with counterclockwise boundary arrows.`,
          `矩形 ${rp.a} ≤ x ≤ ${rp.b}，${rp.c} ≤ y ≤ ${rp.d}，边界箭头沿逆时针方向。`),
        view: fitView(rpShapes, 0.3),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: rpShapes,
      }),
      fields: [{ label: t('∮_C M dx', '∮_C M dx'), answer: rpAnswer }],
      hint: t('Along the vertical sides dx = 0, so only the bottom and the top contribute. Which direction does the top edge have?',
        '在竖直的边上 dx = 0，所以只有下边和上边有贡献。上边的方向是什么？'),
      explanation: t(
        `Bottom (y = ${rp.c}, x from ${rp.a} to ${rp.b}): ∫ ${coef(rp.p, 'x')}·${rp.c} dx = ${num(rp.p * rp.c * (rp.b * rp.b - rp.a * rp.a) / 2)}. Top (y = ${rp.d}, x from ${rp.b} to ${rp.a}): ∫_${rp.b}^${rp.a} ${rp.p}·${rp.d}·x dx = ${par(-rp.p * rp.d * (rp.b * rp.b - rp.a * rp.a) / 2)}. Sum: ${num(rpAnswer)}. Green's theorem agrees: ∬ (−M_y) dA = ${par(-rp.p)}·∬ x dA = ${num(rpAnswer)}.`,
        `下边（y = ${rp.c}，x 从 ${rp.a} 到 ${rp.b}）：∫ ${coef(rp.p, 'x')}·${rp.c} dx = ${num(rp.p * rp.c * (rp.b * rp.b - rp.a * rp.a) / 2)}。上边（y = ${rp.d}，x 从 ${rp.b} 到 ${rp.a}）：∫_${rp.b}^${rp.a} ${rp.p}·${rp.d}·x dx = ${par(-rp.p * rp.d * (rp.b * rp.b - rp.a * rp.a) / 2)}。相加得 ${num(rpAnswer)}。格林定理给出同样的结果：∬ (−M_y) dA = ${par(-rp.p)}·∬ x dA = ${num(rpAnswer)}。`
      ),
      audit: { kind: 'MIT-MV-45:rect-proof', params: { a: rp.a, b: rp.b, c: rp.c, d: rp.d, p: rp.p } },
    }),
    g.number({
      id: 'shared-edges',
      title: t('Counting shared edges', '数共享边'),
      prompt: t(
        `The rectangle 0 ≤ x ≤ ${se.m}, 0 ≤ y ≤ ${se.n} is cut into ${se.m * se.n} unit squares (${se.m} columns, ${se.n} rows), and the boundary of every unit square is traversed counterclockwise. Add all these boundary line integrals. Each unit edge inside the big rectangle is traversed twice, once in each direction, so its two contributions cancel. How many unit edges cancel in this way?`,
        `矩形 0 ≤ x ≤ ${se.m}，0 ≤ y ≤ ${se.n} 被分成 ${se.m * se.n} 个单位正方形（${se.m} 列、${se.n} 行），每个单位正方形的边界都沿逆时针方向行进。把所有这些边界线积分相加。大矩形内部的每条单位边被经过两次，方向相反，所以两次的贡献相互抵消。这样抵消的单位边共有多少条？`
      ),
      figure: g.figure({
        alt: t(`A ${se.m} × ${se.n} grid of unit squares, each with a counterclockwise arrow.`,
          `${se.m} × ${se.n} 的单位正方形网格，每个正方形内有一个逆时针箭头。`),
        view: fitView(seShapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: seShapes,
      }),
      fields: [{ label: t('number of unit edges', '共有多少条单位边'), answer: seAnswer }],
      hint: t('Count the interior unit edges: the vertical ones and the horizontal ones.',
        '数一数内部的单位边：竖直的和水平的。'),
      explanation: t(
        `Vertical interior edges: (${se.m} − 1)·${se.n} = ${(se.m - 1) * se.n}. Horizontal interior edges: ${se.m}·(${se.n} − 1) = ${se.m * (se.n - 1)}. Together ${seAnswer}. Only the outside boundary, ${2 * (se.m + se.n)} unit edges, is left.`,
        `内部竖直的单位边：(${se.m} − 1)·${se.n} = ${(se.m - 1) * se.n}；内部水平的单位边：${se.m}·(${se.n} − 1) = ${se.m * (se.n - 1)}。合计 ${seAnswer} 条。最后只剩外边界上的 ${2 * (se.m + se.n)} 条单位边。`
      ),
      audit: { kind: 'MIT-MV-45:shared-edges', params: { m: se.m, n: se.n } },
    }),

    g.choice({
      id: 'area-pair',
      title: t('Finding a pair for area', '找面积对应的函数对'),
      prompt: t(
        `C is the boundary of a region R of area A, traversed counterclockwise. Which pair (M, N) gives ∮_C M dx + N dy = ${k === 1 ? 'A' : k === 2 ? '2A' : '3A'}?`,
        `C 是面积为 A 的区域 R 的边界，沿逆时针方向行进。哪一对 (M, N) 使 ∮_C M dx + N dy = ${k === 1 ? 'A' : k === 2 ? '2A' : '3A'}？`
      ),
      options: apOptions.map(s => t(s, s)),
      correct: apCorrectIdx,
      hint: t("Green's theorem: ∮ M dx + N dy = ∬ (N_x − M_y) dA. You want N_x − M_y to equal the constant that gives the asked multiple of A.",
        '格林定理：∮ M dx + N dy = ∬ (N_x − M_y) dA。要使 N_x − M_y 等于能给出所求 A 的倍数的常数。'),
      explanation: t(
        `The correct pair has N_x − M_y = ${k}, so the integral is ${k}·A. The other pairs give N_x − M_y = ${apNotes('; ')}.`,
        `正确的一对满足 N_x − M_y = ${k}，所以积分为 ${k}·A。其余各对的 N_x − M_y 分别是 ${apNotes('；')}。`
      ),
    }),
    g.symbols({
      id: 'ellipse-setup',
      title: t('Ellipse area integrand', '椭圆面积的被积函数'),
      prompt: t(
        `The ellipse C: x = ${el.a}cos θ, y = ${el.b}sin θ, 0 ≤ θ ≤ 2π, is traversed counterclockwise as θ increases. By Green's theorem with M = 0 and N = x, its area is ∮_C x dy. Fill in the integrand: ∮_C x dy = ∫₀^{2π} [ ] dθ.`,
        `椭圆 C：x = ${el.a}cos θ，y = ${el.b}sin θ，0 ≤ θ ≤ 2π，随 θ 增大沿逆时针方向行进。由格林定理，取 M = 0，N = x，它的面积为 ∮_C x dy。填写被积函数：∮_C x dy = ∫₀^{2π} [ ] dθ。`
      ),
      before: '∮_C x dy = ∫₀^{2π}',
      between: [],
      after: ' dθ',
      answers: [elAnswerToken],
      tokens: elTokens,
      hint: t(`Substitute x = ${el.a}cos θ and dy = (dy/dθ) dθ. What is dy/dθ?`,
        `代入 x = ${el.a}cos θ 和 dy = (dy/dθ) dθ。dy/dθ 是什么？`),
      explanation: t(
        `x = ${el.a}cos θ and dy = ${el.b}cos θ dθ, so x dy = ${el.a * el.b}cos²θ dθ. Swapping sine and cosine, or using ${el.a * el.a} or ${el.b * el.b} for the product ${el.a}·${el.b}, are the usual slips.`,
        `x = ${el.a}cos θ，dy = ${el.b}cos θ dθ，所以 x dy = ${el.a * el.b}cos²θ dθ。把正弦与余弦弄反，或者用 ${el.a * el.a}、${el.b * el.b} 代替乘积 ${el.a}·${el.b}，都是常见的错误。`
      ),
    }),
    g.number({
      id: 'ellipse-area',
      title: t('Area of an ellipse', '椭圆的面积'),
      prompt: t(
        `The ellipse x = ${el.a}cos θ, y = ${el.b}sin θ, 0 ≤ θ ≤ 2π, is traversed counterclockwise. Use Area = ∮_C x dy to find the area enclosed by the ellipse. Enter an exact multiple of π.`,
        `椭圆 x = ${el.a}cos θ，y = ${el.b}sin θ，0 ≤ θ ≤ 2π，沿逆时针方向行进。用 面积 = ∮_C x dy 求椭圆围成的面积。请输入 π 的精确倍数。`
      ),
      figure: g.figure({
        alt: t(`Ellipse x = ${el.a}cos θ, y = ${el.b}sin θ with a counterclockwise arrow.`,
          `椭圆 x = ${el.a}cos θ，y = ${el.b}sin θ，带逆时针箭头。`),
        view: fitView(elShapes, 0.25),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: elShapes,
      }),
      fields: [{ label: t('area (multiple of π)', '面积（π 的倍数）'), answer: elAnswer }],
      hint: t('Use cos²θ = (1 + cos 2θ)/2 and integrate over 0 to 2π.',
        '用 cos²θ = (1 + cos 2θ)/2，在 0 到 2π 上积分。'),
      explanation: t(
        `∫₀^{2π} ${coef(el.a * el.b, 'cos²θ')} dθ = ${el.a * el.b}·π = ${piTerm(el.a * el.b)}, because ∫₀^{2π} cos²θ dθ = π.`,
        `∫₀^{2π} ${coef(el.a * el.b, 'cos²θ')} dθ = ${el.a * el.b}·π = ${piTerm(el.a * el.b)}，因为 ∫₀^{2π} cos²θ dθ = π。`
      ),
      audit: { kind: 'MIT-MV-45:ellipse-area', params: { a: el.a, b: el.b } },
    }),

    g.choice({
      id: 'inertia-pair',
      title: t('Polar moment of inertia pair', '极转动惯量的函数对'),
      prompt: t(
        `A plate of uniform density ${rho} fills the region R inside a simple closed curve C traversed counterclockwise. Its polar moment of inertia is I = ∬_R ${coef(rho, '')}(x² + y²) dA. Which pair (M, N) satisfies N_x − M_y = ${coef(rho, '')}(x² + y²), so that I = ∮_C M dx + N dy?`,
        `密度均匀为 ${rho} 的薄板占据简单闭曲线 C（沿逆时针方向行进）内部的区域 R。它的极转动惯量为 I = ∬_R ${coef(rho, '')}(x² + y²) dA。哪一对 (M, N) 满足 N_x − M_y = ${coef(rho, '')}(x² + y²)，从而 I = ∮_C M dx + N dy？`
      ),
      options: ipOptions.map(s => t(s, s)),
      correct: ipCorrectIdx,
      hint: t('Work out N_x − M_y for each pair and compare it with the required expression.',
        '对每一对算出 N_x − M_y，并与所需的表达式比较。'),
      explanation: t(
        `For (${coef(-rho, 'x²y')}, ${coef(rho, 'xy²')}): N_x = ${coef(rho, 'y²')} and M_y = ${coef(-rho, 'x²')}, so N_x − M_y = ${coef(rho, '')}(x² + y²). For the other pairs N_x − M_y is: ${ipNotes('; ', 'pair')}. This pair is one of many that work; it is the simplest.`,
        `对 (${coef(-rho, 'x²y')}, ${coef(rho, 'xy²')})：N_x = ${coef(rho, 'y²')}，M_y = ${coef(-rho, 'x²')}，所以 N_x − M_y = ${coef(rho, '')}(x² + y²)。其余各对的 N_x − M_y：${ipNotes('；', 'zh')}。这一对只是众多可行的一对中最简单的一个。`
      ),
    }),
    g.choice({
      id: 'clockwise',
      title: t('Clockwise line integral', '顺时针线积分'),
      prompt: t(
        `R is the rectangle ${cw.a} ≤ x ≤ ${cw.b}, ${cw.c} ≤ y ≤ ${cw.d}, but now its boundary C is traversed clockwise. Let M = ${coef(cw.p, 'xy')}. What is ∮_C M dx?`,
        `R 是矩形 ${cw.a} ≤ x ≤ ${cw.b}，${cw.c} ≤ y ≤ ${cw.d}，但这次它的边界 C 沿顺时针方向行进。设 M = ${coef(cw.p, 'xy')}。∮_C M dx 等于多少？`
      ),
      figure: g.figure({
        alt: t(`Rectangle ${cw.a} ≤ x ≤ ${cw.b}, ${cw.c} ≤ y ≤ ${cw.d} with clockwise boundary arrows.`,
          `矩形 ${cw.a} ≤ x ≤ ${cw.b}，${cw.c} ≤ y ≤ ${cw.d}，边界箭头沿顺时针方向。`),
        view: fitView(cwShapes, 0.3),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: cwShapes,
      }),
      options: cwOptions.map(s => t(s, s)),
      correct: cwCorrectIdx,
      hint: t('Reversing the direction along a curve reverses the sign of a line integral. What would the counterclockwise value be?',
        '沿曲线反向时，线积分的符号反号。逆时针时的值是多少？'),
      explanation: t(
        `Counterclockwise the value is ${par(-cwS)} (bottom ${num(cw.p * cw.c * (cw.b * cw.b - cw.a * cw.a) / 2)} minus top ${num(cw.p * cw.d * (cw.b * cw.b - cw.a * cw.a) / 2)}). Clockwise reverses every edge, so ∮_C M dx = ${num(cwS)}. The value ${par(-cwS)} forgets the reversal; 0 assumes top and bottom cancel; ${num(2 * cwS)} doubles the magnitude.`,
        `逆时针时的值为 ${par(-cwS)}（下边 ${num(cw.p * cw.c * (cw.b * cw.b - cw.a * cw.a) / 2)} 减去上边 ${num(cw.p * cw.d * (cw.b * cw.b - cw.a * cw.a) / 2)}）。顺时针使每条边反向，所以 ∮_C M dx = ${num(cwS)}。值 ${par(-cwS)} 忘了反号；0 以为上下两边抵消；${num(2 * cwS)} 把大小翻了一倍。`
      ),
      audit: { kind: 'MIT-MV-45:clockwise', params: { a: cw.a, b: cw.b, c: cw.c, d: cw.d, p: cw.p } },
    }),

    g.number({
      id: 'challenge',
      title: t('Challenge: circle integral', '挑战：圆上的积分'),
      prompt: t(
        `C is the circle of radius ${ch.R} centred at the origin, traversed counterclockwise. Compute ∮_C ${coef(ch.rho, 'xy²')} dy. Enter an exact multiple of π, for example 3pi/4.`,
        `C 是以原点为圆心、半径为 ${ch.R} 的圆，沿逆时针方向行进。计算 ∮_C ${coef(ch.rho, 'xy²')} dy。请输入 π 的精确倍数，例如 3pi/4。`
      ),
      fields: [{ label: t(`∮_C ${coef(ch.rho, 'xy²')} dy (multiple of π)`, `∮_C ${coef(ch.rho, 'xy²')} dy（π 的倍数）`), answer: chAnswer }],
      hint: t(`Use Green's theorem with M = 0 and N = ${coef(ch.rho, 'xy²')}: what is N_x? Then integrate over the disk in polar coordinates.`,
        `用格林定理，M = 0，N = ${coef(ch.rho, 'xy²')}：N_x 是什么？然后在圆盘上用极坐标积分。`),
      explanation: t(
        `N_x − M_y = ${coef(ch.rho, 'y²')}, so ∮ = ∬ ${coef(ch.rho, 'y²')} dA = ${ch.rho === 1 ? '' : ch.rho}∫₀^{2π}∫₀^{${ch.R}} r² sin²θ·r dr dθ = ${ch.rho}·(${ch.R}⁴/4)·π = ${piTerm(ch.rho * ch.R ** 4 / 4)}. (Direct check: x = ${coef(ch.R, 'cos t')}, y = ${coef(ch.R, 'sin t')} gives ${coef(ch.rho * ch.R ** 4, 'cos²t sin²t')} dt, whose integral is ${piTerm(ch.rho * ch.R ** 4 / 4)}.) This game does not assess why approximating a region by rectangles proves the theorem for every region, nor regions with holes, nor how a planimeter works.`,
        `N_x − M_y = ${coef(ch.rho, 'y²')}，所以 ∮ = ∬ ${coef(ch.rho, 'y²')} dA = ${ch.rho === 1 ? '' : ch.rho}∫₀^{2π}∫₀^{${ch.R}} r² sin²θ·r dr dθ = ${ch.rho}·(${ch.R}⁴/4)·π = ${piTerm(ch.rho * ch.R ** 4 / 4)}。（直接验证：x = ${coef(ch.R, 'cos t')}，y = ${coef(ch.R, 'sin t')} 给出 ${coef(ch.rho * ch.R ** 4, 'cos²t sin²t')} dt，其积分为 ${piTerm(ch.rho * ch.R ** 4 / 4)}。）本游戏不考察为什么用矩形逼近就能对任意区域证明该定理，也不考察有洞的区域，也不考察测面积仪的工作原理。`
      ),
      audit: { kind: 'MIT-MV-45:challenge', params: { rho: ch.rho, R: ch.R } },
    }),
  ];
};
