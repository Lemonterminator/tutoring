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

function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { const r = a % b; a = b; b = r; } return a; }
function reducedDen(n: number, d: number): number { return d / gcd(n, d); }


/** Exact reduced fraction [numerator, denominator] with positive denominator. */
function red(n: number, d: number): [number, number] { const k = gcd(n, d) || 1; return d < 0 ? [-n / k, -d / k] : [n / k, d / k]; }
const far = (truth: number, routes: number[]) => routes.every(r => Math.abs(r - truth) >= 0.02);

// Sampling spaces: the plan's enumerated tuple lists, built once (exact denominators, wrong-route guard).
const SE_SPACE: { ell: number; x1: number; x2: number }[] = [];
for (const ell of [2, 3, 4]) for (let x1 = -6; x1 <= 6; x1++) for (let x2 = -6; x2 <= 6; x2++) {
  const r = Math.abs(x1 - x2);
  if (r < 1 || ![1, 2, 4, 8].includes(reducedDen(r * r, 2 * ell * ell))) continue;
  const truth = -(r * r) / (2 * ell * ell);
  if (far(truth, [-(r * r) / (ell * ell), -r / (2 * ell * ell), -(r * r) / (2 * ell), -(r * r) / 2, (r * r) / (2 * ell * ell)])) SE_SPACE.push({ ell, x1, x2 });
}
type RqTuple = { alpha: number; beta: number; ell: number; r: number };
/** k = alpha / q^beta as an exact fraction. */
function rqExact(v: RqTuple): [number, number] { const d = 2 * v.beta * v.ell * v.ell; return red(v.alpha * Math.pow(d, v.beta), Math.pow(d + v.r * v.r, v.beta)); }
const RQ_SPACE: RqTuple[] = [];
for (let alpha = 1; alpha <= 36; alpha++) for (const beta of [1, 2, 3]) for (let ell = 1; ell <= 4; ell++) for (let r = 1; r <= 8; r++) {
  const v = { alpha, beta, ell, r };
  const [kn, kd] = rqExact(v);
  if (![1, 2, 4, 5, 8, 10].includes(kd)) continue;
  const q = 1 + (r * r) / (2 * beta * ell * ell);
  const routes = [alpha * Math.pow(q, beta), alpha / Math.pow(1 + r / (2 * beta * ell * ell), beta), alpha / Math.pow(1 + (r * r) / (2 * beta * ell), beta)];
  if (beta >= 2) routes.push(alpha / Math.pow(1 + (r * r) / (2 * ell * ell), beta), alpha / q);
  if (far(kn / kd, routes)) RQ_SPACE.push(v);
}
const SIN2: Record<string, number[]> = { '1/6': [1, 4], '1/4': [1, 2], '1/3': [3, 4], '2/3': [3, 4], '3/4': [1, 2], '5/6': [1, 4] };
const PER_SPACE: { P: number; ell: number; r: number; s: [number, number] }[] = [];
for (const P of [4, 6, 12]) for (const ell of [1, 2]) for (let r = 1; r <= 24; r++) {
  const f = red(r % P, P);
  const s = SIN2[`${f[0]}/${f[1]}`];
  if (!s) continue; // whole periods (E = 0) and half periods (sin² = 1: the sine-squared-removed wrong route coincides)
  const sv = s[0] / s[1], truth = -(2 / (ell * ell)) * sv;
  if (![1, 2, 4, 8].includes(red(2 * s[0], ell * ell * s[1])[1])) continue;
  if (far(truth, [-(2 / (ell * ell)) * Math.sqrt(sv), 0, -(2 * (r / P) ** 2) / (ell * ell), -sv / (ell * ell), (2 * sv) / (ell * ell)])) PER_SPACE.push({ P, ell, r, s: [s[0], s[1]] });
}
const CH_SPACE: RqTuple[] = [];
for (let alpha = 1; alpha <= 36; alpha++) for (const beta of [1, 2]) for (let ell = 1; ell <= 4; ell++) for (let r = 1; r <= 8; r++) {
  const v = { alpha, beta, ell, r };
  const [kn, kd] = rqExact(v);
  if (![1, 2].includes(kd) || kn / kd < 1) continue;
  const [dn, dd] = red(alpha * alpha * kd * kd - kn * kn, kd * kd);
  if (![1, 2, 4, 5, 8, 10].includes(dd)) continue;
  const kv = kn / kd, a2 = alpha * alpha, q = 1 + (r * r) / (2 * beta * ell * ell);
  const ws = [alpha * Math.pow(q, beta), alpha / Math.pow(1 + r / (2 * beta * ell * ell), beta), alpha / Math.pow(1 + (r * r) / (2 * beta * ell), beta)];
  if (beta >= 2) ws.push(alpha / Math.pow(1 + (r * r) / (2 * ell * ell), beta), alpha / q);
  if (far(dn / dd, [...ws.map(w => a2 - w * w), a2 - kv, a2, kv * kv - a2, a2 - alpha * kv])) CH_SPACE.push(v);
}
/** Two positions with gap r, x1 in [lo1, hi1], x2 in [lo2, hi2], either order. */
function place(g: Deck, r: number, lo1: number, hi1: number, lo2: number, hi2: number): [number, number] {
  const options: [number, number][] = [];
  for (let x1 = lo1; x1 <= hi1; x1++) for (const x2 of [x1 + r, x1 - r]) if (x2 >= lo2 && x2 <= hi2) options.push([x1, x2]);
  return options[g.random(0, options.length - 1)];
}

export const gp08: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-08');
  warm(g);

  // Card 1: se-exponent
  const seT = SE_SPACE[g.random(0, SE_SPACE.length - 1)];
  const se = { ell: seT.ell, alpha: g.pick([2, 3, 5, 7]), x1: seT.x1, x2: seT.x2 };
  const seR = Math.abs(se.x1 - se.x2);
  const seAnswer = -(seR * seR) / (2 * se.ell * se.ell);

  // Card 2: se-compare
  const cmp = retry(() => {
    const S = g.random(-4, 8);
    const dA = g.random(1, 8);
    const dB = g.random(1, 8);
    const alpha = g.pick([1, 2, 3, 5]);
    const ell = g.pick([1, 2, 3, 4]);
    return { S, dA, dB, alpha, ell };
  }, v => {
    if (v.dA === v.dB) return false;
    if ((v.S - v.dA) % 2 !== 0 || (v.S - v.dB) % 2 !== 0) return false;
    const a1 = (v.S - v.dA) / 2, a2 = (v.S + v.dA) / 2;
    const b1 = (v.S - v.dB) / 2, b2 = (v.S + v.dB) / 2;
    const pts = [a1, a2, b1, b2];
    return pts.every(p => p >= -6 && p <= 8);
  });
  const flipA = g.random(0, 1) === 1, flipB = g.random(0, 1) === 1;
  const cmpA1 = (cmp.S + (flipA ? cmp.dA : -cmp.dA)) / 2, cmpA2 = (cmp.S + (flipA ? -cmp.dA : cmp.dA)) / 2;
  const cmpB1 = (cmp.S + (flipB ? cmp.dB : -cmp.dB)) / 2, cmpB2 = (cmp.S + (flipB ? -cmp.dB : cmp.dB)) / 2;
  const cmpCorrectIdx = cmp.dA < cmp.dB ? 0 : 1;

  // Card 3: rq-value
  const rq = RQ_SPACE[g.random(0, RQ_SPACE.length - 1)];
  const [rqX1, rqX2] = place(g, rq.r, -8, 8, -8, 8);
  const rqQ = 1 + (rq.r * rq.r) / (2 * rq.beta * rq.ell * rq.ell);
  const rqAnswer = rq.alpha * Math.pow(1 / rqQ, rq.beta);

  // Card 4: periodic-exponent
  const per = PER_SPACE[g.random(0, PER_SPACE.length - 1)];
  const perAlpha = g.pick([2, 3, 5, 7]);
  const [perX1, perX2] = place(g, per.r, -12, 12, -12, 12);
  const perS = per.s[0] / per.s[1];
  const perAnswer = -(2 / (per.ell * per.ell)) * perS;

  // Card 5: periodic-repeat
  const rep = {
    alpha: g.pick([2, 4, 6, 8]),
    ell: g.pick([1, 2, 3]),
    P: g.pick([2, 3, 4, 5]),
    n: g.pick([1, 2, 3]),
    x1: g.random(-3, 3),
    x2: 0,
  };
  rep.x2 = rep.x1 + (g.random(0, 1) === 0 ? rep.n * rep.P : -rep.n * rep.P);

  // Card 6: stationary-test
  const stat = {
    variant: g.pick([0, 1, 2]),
    a1: g.pick([1, 2, 3]), l1: g.pick([1, 2, 3]),
    a2: g.pick([1, 2, 3]), b2: g.pick([2, 3]), l2: g.pick([1, 2, 3]),
    a3: g.pick([1, 2, 3]), l3: g.pick([1, 2]), P3: g.pick([2, 3, 4]),
  };
  const statC0 = stat.variant === 1 ? g.pick([2, 3, 5]) : g.pick([1, 2, 3]);
  const statN = stat.variant === 0 ? 'x₁x₂' : stat.variant === 1 ? `${statC0}·x₁x₂` : `x₁x₂ + ${statC0}`;
  const statN01 = stat.variant === 0 ? 0 : stat.variant === 1 ? 0 : statC0;
  const statN12 = stat.variant === 0 ? 2 : stat.variant === 1 ? 2 * statC0 : 2 + statC0;

  // Card 7: matern-smoothest
  const matDraw = retry(() => ({
    nus: shuffled(g, [0.5, 1.5, 2.5, 3.5, 4.5]).slice(0, 4),
    alphas: shuffled(g, [1, 2, 3, 4, 5, 6]).slice(0, 4),
    ells: shuffled(g, [1, 2, 3, 4, 5, 6]).slice(0, 4),
  }), v => {
    const top = v.nus.indexOf(Math.max(...v.nus));
    return top !== v.alphas.indexOf(Math.max(...v.alphas)) && top !== v.ells.indexOf(Math.max(...v.ells));
  });
  const matNus = matDraw.nus, matAlphas = matDraw.alphas, matLs = matDraw.ells;
  const matOptions = matNus.map((nu, i) => ({ nu, alpha: matAlphas[i], ell: matLs[i] }));
  const matCorrectIdx = matOptions.findIndex(o => o.nu === Math.max(...matOptions.map(o => o.nu)));

  // Card 8: rq-limit
  const lim = {
    alpha: g.pick([2, 3, 4, 5]),
    ell: g.pick([2, 3, 4, 5]),
    beta: g.pick([2, 3, 4]),
  };

  // Card 9: challenge
  const ch = retry(() => CH_SPACE[g.random(0, CH_SPACE.length - 1)], v => v.alpha !== rq.alpha && !(v.beta === rq.beta && v.ell === rq.ell && v.r === rq.r));
  const [chX1, chX2] = place(g, ch.r, -8, 8, -8, 8);
  const chQ = 1 + (ch.r * ch.r) / (2 * ch.beta * ch.ell * ch.ell);
  const chK = ch.alpha * Math.pow(1 / chQ, ch.beta);
  const chAnswer = ch.alpha * ch.alpha - chK * chK;

  return [
    g.number({
      id: 'se-exponent',
      title: t('The exponent of the SE kernel', '平方指数核的指数'),
      prompt: t(
        `The squared exponential kernel is k(x₁, x₂) = α exp(E) with E = −(x₁ − x₂)²/(2ℓ²). Here α = ${se.alpha}, ℓ = ${se.ell}, x₁ = ${num(se.x1)} and x₂ = ${num(se.x2)}. What is the number E? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `平方指数核为 k(x₁, x₂) = α exp(E)，其中 E = −(x₁ − x₂)²/(2ℓ²)。这里 α = ${se.alpha}，ℓ = ${se.ell}，x₁ = ${num(se.x1)}，x₂ = ${num(se.x2)}。求数值 E。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('E', 'E'), answer: seAnswer, tolerance: 0.006 }],
      hint: t(
        'Only the gap between the two inputs enters E, not where they sit on the line. Find the gap first.',
        'E 中只出现两个输入之间的间距，而不是它们在数轴上的位置。先求间距。'
      ),
      explanation: t(
        `The gap is |${num(se.x1)} − ${par(se.x2)}| = ${seR}, so r² = ${seR * seR}. E = −r²/(2ℓ²) = −${seR * seR}/(2·${se.ell}²)${exact(-(seR * seR) / (2 * se.ell * se.ell)) === `−${seR * seR}/${2 * se.ell * se.ell}` ? '' : ` = −${seR * seR}/${2 * se.ell * se.ell}`} = ${exact(seAnswer)}. Then k = ${se.alpha}·exp(${exact(seAnswer)}); α only scales the whole value and does not change E (Lecture 3 p. 18, eq. 33). This game does not test evaluating exp or fitting kernel hyperparameters.`,
        `间距为 |${num(se.x1)} − ${par(se.x2)}| = ${seR}，所以 r² = ${seR * seR}。E = −r²/(2ℓ²) = −${seR * seR}/(2·${se.ell}²)${exact(-(seR * seR) / (2 * se.ell * se.ell)) === `−${seR * seR}/${2 * se.ell * se.ell}` ? '' : ` = −${seR * seR}/${2 * se.ell * se.ell}`} = ${exact(seAnswer)}。于是 k = ${se.alpha}·exp(${exact(seAnswer)})；α 只是整体缩放，不改变 E（第 3 讲第 18 页，式 33）。本游戏不考查 exp 的计算，也不考查超参数的拟合。`
      ),
      audit: { kind: 'GP-08:se-exponent', params: { alpha: se.alpha, ell: se.ell, x1: se.x1, x2: se.x2 } },
    }),
    g.choice({
      id: 'se-compare',
      title: t('Two pairs, same midpoint', '两对输入，中点相同'),
      prompt: t(
        `The squared exponential kernel k(x₁, x₂) = α exp(−(x₁ − x₂)²/(2ℓ²)) has α = ${cmp.alpha} and ℓ = ${cmp.ell}. Pair A is the inputs (${num(cmpA1)}, ${num(cmpA2)}); pair B is the inputs (${num(cmpB1)}, ${num(cmpB2)}). Which statement is correct?`,
        `平方指数核 k(x₁, x₂) = α exp(−(x₁ − x₂)²/(2ℓ²)) 的参数为 α = ${cmp.alpha}，ℓ = ${cmp.ell}。A 对输入是 (${num(cmpA1)}, ${num(cmpA2)})，B 对输入是 (${num(cmpB1)}, ${num(cmpB2)})。下列哪条说法正确？`
      ),
      options: [
        t('Pair A has the larger covariance.', 'A 对的协方差更大。'),
        t('Pair B has the larger covariance.', 'B 对的协方差更大。'),
        t('The two covariances are equal, because both pairs have the same midpoint.', '两个协方差相等，因为两对输入的中点相同。'),
        t('It cannot be decided without evaluating the exponentials.', '不算出指数的值就无法判断。'),
      ],
      correct: cmpCorrectIdx,
      hint: t(
        'Look at the two inputs of each pair: does this kernel use their positions, or something computed from them?',
        '看每对输入：这个核用的是它们的位置，还是由它们算出的某个量？'
      ),
      explanation: t(
        `The kernel depends only on the gap. Pair A: |${num(cmpA1)} − ${par(cmpA2)}| = ${cmp.dA}, exponent −${cmp.dA * cmp.dA}/(2·${cmp.ell}²) = ${exact(-(cmp.dA * cmp.dA) / (2 * cmp.ell * cmp.ell))}. Pair B: |${num(cmpB1)} − ${par(cmpB2)}| = ${cmp.dB}, exponent −${cmp.dB * cmp.dB}/(2·${cmp.ell}²) = ${exact(-(cmp.dB * cmp.dB) / (2 * cmp.ell * cmp.ell))}. The exponent closer to 0 gives the larger exp, and α = ${cmp.alpha} multiplies both, so the pair with the smaller gap has the larger covariance. Both pairs have the midpoint ${exact(cmp.S / 2)}, which is irrelevant: the kernel is stationary (Lecture 3 p. 15, 18). This game does not test the Matérn Bessel formula.`,
        `核只依赖间距。A 对：|${num(cmpA1)} − ${par(cmpA2)}| = ${cmp.dA}，指数 −${cmp.dA * cmp.dA}/(2·${cmp.ell}²) = ${exact(-(cmp.dA * cmp.dA) / (2 * cmp.ell * cmp.ell))}。B 对：|${num(cmpB1)} − ${par(cmpB2)}| = ${cmp.dB}，指数 −${cmp.dB * cmp.dB}/(2·${cmp.ell}²) = ${exact(-(cmp.dB * cmp.dB) / (2 * cmp.ell * cmp.ell))}。指数越接近 0，exp 越大；α = ${cmp.alpha} 对两者相同，所以间距小的一对协方差更大。两对的中点都是 ${exact(cmp.S / 2)}，与结果无关：该核是平稳的（第 3 讲第 15、18 页）。本游戏不考查 Matérn 核的 Bessel 公式。`
      ),
    }),
    g.number({
      id: 'rq-value',
      title: t('A rational quadratic value', '有理二次核的取值'),
      prompt: t(
        `The rational quadratic kernel is k(x₁, x₂) = α (1 + r²/(2βℓ²)) to the power −β, with r = |x₁ − x₂|. Here α = ${rq.alpha}, β = ${rq.beta}, ℓ = ${rq.ell}, x₁ = ${num(rqX1)} and x₂ = ${num(rqX2)}. What is k(x₁, x₂)? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `有理二次核为 k(x₁, x₂) = α (1 + r²/(2βℓ²)) 的 −β 次幂，其中 r = |x₁ − x₂|。这里 α = ${rq.alpha}，β = ${rq.beta}，ℓ = ${rq.ell}，x₁ = ${num(rqX1)}，x₂ = ${num(rqX2)}。求 k(x₁, x₂)。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('k', 'k'), answer: rqAnswer, tolerance: 0.006 }],
      hint: t(
        'Do it in two steps: first the single number in the bracket, then the power the kernel states.',
        '分两步：先算括号里的那个数，再按核中给出的幂次求幂。'
      ),
      explanation: t(
        `r = |${num(rqX1)} − ${par(rqX2)}| = ${rq.r}. Bracket: 1 + r²/(2βℓ²) = 1 + ${rq.r * rq.r}/(2·${rq.beta}·${rq.ell}²) = 1 + ${frac(rq.r * rq.r, 2 * rq.beta * rq.ell * rq.ell)} = ${exact(rqQ)}. Power: (${exact(rqQ)}) to the power −${rq.beta} = ${exact(Math.pow(1 / rqQ, rq.beta))}. So k = ${rq.alpha}·(${exact(Math.pow(1 / rqQ, rq.beta))}) = ${exact(rqAnswer)} (Lecture 3 p. 22, eq. 37). Tip: as β grows this kernel tends to the squared exponential one (card 8). This game does not test evaluating exp.`,
        `r = |${num(rqX1)} − ${par(rqX2)}| = ${rq.r}。括号：1 + r²/(2βℓ²) = 1 + ${rq.r * rq.r}/(2·${rq.beta}·${rq.ell}²) = 1 + ${frac(rq.r * rq.r, 2 * rq.beta * rq.ell * rq.ell)} = ${exact(rqQ)}。幂：(${exact(rqQ)}) 的 −${rq.beta} 次幂 = ${exact(Math.pow(1 / rqQ, rq.beta))}。所以 k = ${rq.alpha}·(${exact(Math.pow(1 / rqQ, rq.beta))}) = ${exact(rqAnswer)}（第 3 讲第 22 页，式 37）。提示：β 增大时该核趋于平方指数核（第 8 关）。本游戏不考查 exp 的计算。`
      ),
      audit: { kind: 'GP-08:rq-value', params: { alpha: rq.alpha, beta: rq.beta, ell: rq.ell, x1: rqX1, x2: rqX2 } },
    }),
    g.number({
      id: 'periodic-exponent',
      title: t('The exponent of the periodic kernel', '周期核的指数'),
      prompt: t(
        `The periodic kernel is k(x₁, x₂) = α exp(E) with E = −(2/ℓ²) sin²(π r/P) and r = |x₁ − x₂|. Here α = ${perAlpha}, ℓ = ${per.ell}, P = ${per.P}, x₁ = ${num(perX1)} and x₂ = ${num(perX2)}. What is the number E? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `周期核为 k(x₁, x₂) = α exp(E)，其中 E = −(2/ℓ²) sin²(π r/P)，r = |x₁ − x₂|。这里 α = ${perAlpha}，ℓ = ${per.ell}，P = ${per.P}，x₁ = ${num(perX1)}，x₂ = ${num(perX2)}。求数值 E。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('E', 'E'), answer: perAnswer, tolerance: 0.006 }],
      hint: t(
        'Write the gap r as a fraction of the period P, then use sin² at that fraction of π: sin² is 1/4 at π/6, 1/2 at π/4, 3/4 at π/3, and it repeats with period π.',
        '把间距 r 写成周期 P 的几分之几，再用该角度的 sin²：π/6 处为 1/4，π/4 处为 1/2，π/3 处为 3/4，且以 π 为周期重复。'
      ),
      explanation: t(
        `r = |${num(perX1)} − ${par(perX2)}| = ${per.r}, and r/P = ${frac(per.r, per.P)}, so the angle is π·${frac(per.r, per.P)}. There sin² = ${exact(perS)} (Lecture 3 p. 24, eq. 39). E = −(2/ℓ²)·sin² = −(2/${per.ell}²)·${exact(perS)} = ${exact(perAnswer)}. The magnitude α = ${perAlpha} is only a factor in front of exp. This game does not test evaluating exp.`,
        `r = |${num(perX1)} − ${par(perX2)}| = ${per.r}，r/P = ${frac(per.r, per.P)}，所以角度为 π·${frac(per.r, per.P)}。此处 sin² = ${exact(perS)}（第 3 讲第 24 页，式 39）。E = −(2/ℓ²)·sin² = −(2/${per.ell}²)·${exact(perS)} = ${exact(perAnswer)}。幅度 α = ${perAlpha} 只是 exp 前的因子。本游戏不考查 exp 的计算。`
      ),
      audit: { kind: 'GP-08:periodic-exponent', params: { alpha: perAlpha, ell: per.ell, P: per.P, x1: perX1, x2: perX2 } },
    }),
    g.choice({
      id: 'periodic-repeat',
      title: t('Far apart, yet fully correlated', '相距很远，却完全相关'),
      prompt: t(
        `The periodic kernel is k(x₁, x₂) = α exp(−(2/ℓ²) sin²(π |x₁ − x₂|/P)) with α = ${rep.alpha}, ℓ = ${rep.ell} and P = ${rep.P}. For x₁ = ${num(rep.x1)} and x₂ = ${num(rep.x2)} (the gap is ${rep.n} whole ${rep.n === 1 ? 'period' : 'periods'}), what is k(x₁, x₂)?`,
        `周期核为 k(x₁, x₂) = α exp(−(2/ℓ²) sin²(π |x₁ − x₂|/P))，其中 α = ${rep.alpha}，ℓ = ${rep.ell}，P = ${rep.P}。当 x₁ = ${num(rep.x1)}、x₂ = ${num(rep.x2)}（间距恰为 ${rep.n} 个整周期）时，k(x₁, x₂) 等于多少？`
      ),
      options: [
        t(`k = ${rep.alpha}`, `k = ${rep.alpha}`),
        t('k = 0', 'k = 0'),
        t(`k = −${rep.alpha}`, `k = −${rep.alpha}`),
        t(`k = ${rep.alpha / 2}`, `k = ${rep.alpha / 2}`),
      ],
      correct: 0,
      hint: t(
        'Write the gap as a whole number of periods and think about what sin does at a whole multiple of π.',
        '把间距写成整数个周期，想一想 sin 在 π 的整数倍处取什么值。'
      ),
      explanation: t(
        `The gap is |${num(rep.x1)} − ${par(rep.x2)}| = ${rep.n * rep.P}${rep.n === 1 ? "" : " = " + rep.n + "·" + rep.P}, so π·gap/P = ${rep.n === 1 ? "" : rep.n}π and sin(${rep.n === 1 ? "" : rep.n}π) = 0. Then exp(−(2/${rep.ell}²)·0) = exp(0) = 1 and k = ${rep.alpha}·1 = ${rep.alpha}, the same as k(x, x). This is a counterexample to 'covariance always decays with distance': a periodic kernel returns to its maximum at every whole period (Lecture 3 p. 24). The value 0 would be right for SE at a large gap; −${rep.alpha} confuses sin with cos. This game does not test fitting the period.`,
        `间距为 |${num(rep.x1)} − ${par(rep.x2)}| = ${rep.n * rep.P}${rep.n === 1 ? "" : " = " + rep.n + "·" + rep.P}，所以 π·间距/P = ${rep.n === 1 ? "" : rep.n}π，sin(${rep.n === 1 ? "" : rep.n}π) = 0。于是 exp(−(2/${rep.ell}²)·0) = exp(0) = 1，k = ${rep.alpha}·1 = ${rep.alpha}，与 k(x, x) 相同。这是“协方差总随距离衰减”的反例：周期核每隔一个整周期就回到最大值（第 3 讲第 24 页）。0 是平方指数核在大间距下的结果；−${rep.alpha} 把 sin 和 cos 弄混了。本游戏不考查周期的拟合。`
      ),
    }),
    g.choice({
      id: 'stationary-test',
      title: t('Which kernel is not stationary?', '哪个核不是平稳的？'),
      prompt: t(
        'A kernel is stationary if k(x₁, x₂) = k(x₁ + a, x₂ + a) for every shift a. Three of the four kernels below are stationary; r = |x₁ − x₂|. Which one is not stationary?',
        '若对任意平移 a 都有 k(x₁, x₂) = k(x₁ + a, x₂ + a)，则核是平稳的。下面四个核中有三个是平稳的；r = |x₁ − x₂|。哪一个不是平稳的？'
      ),
      options: [
        t(`k = ${statN}`, `k = ${statN}`),
        t(`k = ${stat.a3} exp(−(2/${stat.l3}²) sin²(π r/${stat.P3}))`, `k = ${stat.a3} exp(−(2/${stat.l3}²) sin²(π r/${stat.P3}))`),
        t(`k = ${stat.a2} (1 + r²/(2·${stat.b2}·${stat.l2}²)) to the power −${stat.b2}`, `k = ${stat.a2} (1 + r²/(2·${stat.b2}·${stat.l2}²)) 的 −${stat.b2} 次幂`),
        t(`k = ${stat.a1} exp(−r²/(2·${stat.l1}²))`, `k = ${stat.a1} exp(−r²/(2·${stat.l1}²))`),
      ],
      correct: 0,
      hint: t(
        'Shift both inputs by the same amount, for example from (0, 1) to (1, 2), and ask which formula could change.',
        '把两个输入平移同样的量，例如从 (0, 1) 变到 (1, 2)，想一想哪个公式的值可能改变。'
      ),
      explanation: t(
        `SE, RQ and periodic kernels use x₁ and x₂ only through r = |x₁ − x₂|, and a shift does not change r, so they are stationary (Lecture 3 pp. 15, 18, 22, 24). The kernel ${statN} contains the product x₁x₂ itself: for example k(0, 1) = ${statN01} but k(1, 2) = ${statN12}, the same gap with a different value. So it is not stationary (the linear kernel is the example in Lecture 3 p. 15). The sine of the periodic kernel does not break stationarity: it only sees r. This game does not test the combination rules for kernels.`,
        `平方指数核、有理二次核和周期核只通过 r = |x₁ − x₂| 依赖 x₁、x₂，而平移不改变 r，所以它们是平稳的（第 3 讲第 15、18、22、24 页）。核 ${statN} 含有乘积 x₁x₂ 本身：例如 k(0, 1) = ${statN01}，而 k(1, 2) = ${statN12}，间距相同，取值不同，所以它不是平稳的（线性核正是第 3 讲第 15 页的例子）。周期核里的正弦并不破坏平稳性：它只看 r。本游戏不考查核的组合规则。`
      ),
    }),
    g.choice({
      id: 'matern-smoothest',
      title: t('The smoothest Matérn kernel', '最光滑的 Matérn 核'),
      prompt: t(
        'Four Matérn kernels are listed with their parameters (α is the magnitude, ℓ the lengthscale, ν the smoothness). Which one produces sample paths that are differentiable the most times?',
        '下面列出四个 Matérn 核及其参数（α 是幅度，ℓ 是长度尺度，ν 是光滑度）。哪一个核的样本路径可微的次数最多？'
      ),
      options: matOptions.map(o => t(`α = ${o.alpha}, ℓ = ${o.ell}, ν = ${frac(Math.round(o.nu * 2), 2)}`, `α = ${o.alpha}, ℓ = ${o.ell}, ν = ${frac(Math.round(o.nu * 2), 2)}`)),
      correct: matCorrectIdx,
      hint: t(
        'Only one of the three parameters controls how many times the paths can be differentiated; the other two set the height and the horizontal scale.',
        '三个参数中只有一个决定样本路径可微的次数，另外两个分别决定高度和水平尺度。'
      ),
      explanation: t(
        `Sample paths are ⌊ν⌋ times differentiable (Lecture 3 p. 20): ν = 1/2 gives 0, 3/2 gives 1, 5/2 gives 2, 7/2 gives 3, 9/2 gives 4. Here the four kernels have ${Math.floor(matOptions[0].nu)}, ${Math.floor(matOptions[1].nu)}, ${Math.floor(matOptions[2].nu)} and ${Math.floor(matOptions[3].nu)} derivatives, so the kernel with ν = ${frac(Math.round(matOptions[matCorrectIdx].nu * 2), 2)} is the smoothest. The lengthscale ℓ and the magnitude α stretch and scale the paths but do not change how many times they can be differentiated. As ν → ∞ the Matérn kernel approaches the squared exponential one (infinitely differentiable). This game does not test the Bessel formula.`,
        `样本路径可微 ⌊ν⌋ 次（第 3 讲第 20 页）：ν = 1/2 为 0 次，3/2 为 1 次，5/2 为 2 次，7/2 为 3 次，9/2 为 4 次。这四个核分别可微 ${Math.floor(matOptions[0].nu)}、${Math.floor(matOptions[1].nu)}、${Math.floor(matOptions[2].nu)} 和 ${Math.floor(matOptions[3].nu)} 次，所以 ν = ${frac(Math.round(matOptions[matCorrectIdx].nu * 2), 2)} 的核最光滑。长度尺度 ℓ 和幅度 α 只是拉伸和缩放样本路径，不改变可微次数。当 ν → ∞ 时 Matérn 核趋于平方指数核（无穷次可微）。本游戏不考查 Bessel 公式。`
      ),
    }),
    g.choice({
      id: 'rq-limit',
      title: t('RQ for a large β', 'β 很大时的有理二次核'),
      prompt: t(
        `The rational quadratic kernel k(x₁, x₂) = α (1 + r²/(2βℓ²)) to the power −β has α = ${lim.alpha}, ℓ = ${lim.ell} and β = ${lim.beta}. Keep α and ℓ fixed and let β grow without bound. Which kernel does it approach?`,
        `有理二次核 k(x₁, x₂) = α (1 + r²/(2βℓ²)) 的 −β 次幂，参数为 α = ${lim.alpha}，ℓ = ${lim.ell}，β = ${lim.beta}。保持 α 和 ℓ 不变，让 β 无限增大。它趋于哪个核？`
      ),
      options: [
        t(`The squared exponential kernel with α = ${lim.alpha} and ℓ = ${lim.ell}`, `α = ${lim.alpha}、ℓ = ${lim.ell} 的平方指数核`),
        t(`The squared exponential kernel with α = ${lim.alpha} and the longer lengthscale βℓ = ${lim.beta * lim.ell}`, `α = ${lim.alpha}、长度尺度变为更长的 βℓ = ${lim.beta * lim.ell} 的平方指数核`),
        t(`A Matérn kernel with α = ${lim.alpha}, ℓ = ${lim.ell} and ν = ${lim.beta}`, `α = ${lim.alpha}、ℓ = ${lim.ell}、ν = ${lim.beta} 的 Matérn 核`),
        t(`The constant kernel k = ${lim.alpha} for every pair of inputs`, `对所有输入对都取 k = ${lim.alpha} 的常数核`),
      ],
      correct: 0,
      hint: t(
        'Let β grow and watch the denominator 2β inside the bracket together with the power −β: the two β\'s work against each other.',
        '让 β 增大，同时观察括号内分母中的 2β 和 −β 次幂：两个 β 互相抵消。'
      ),
      explanation: t(
        `As β grows, r²/(2βℓ²) becomes small and the bracket raised to the power −β behaves like exp(−r²/(2ℓ²)): the factor β in the denominator cancels the power. So the limit is α exp(−r²/(2ℓ²)) with the same α = ${lim.alpha} and ℓ = ${lim.ell} (Lecture 3 p. 22, 'identical to the squared exponential as β → ∞'). The lengthscale is not rescaled by β, the kernel does not become Matérn, and it still decays with distance. This game does not test evaluating limits beyond this one.`,
        `β 增大时，r²/(2βℓ²) 变小，括号的 −β 次幂的行为就像 exp(−r²/(2ℓ²))：分母里的 β 与幂次相互抵消。所以极限是 α exp(−r²/(2ℓ²))，α = ${lim.alpha}、ℓ = ${lim.ell} 不变（第 3 讲第 22 页：“β → ∞ 时与平方指数核一致”）。长度尺度不会被 β 重新缩放，核也不会变成 Matérn，并且仍随距离衰减。本游戏不考查此极限之外的极限计算。`
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: a 2 × 2 kernel matrix', '挑战：2 × 2 核矩阵'),
      prompt: t(
        `The rational quadratic kernel is k(x, x′) = α (1 + r²/(2βℓ²)) to the power −β with r = |x − x′|, and α = ${ch.alpha}, β = ${ch.beta}, ℓ = ${ch.ell}. The 2 × 2 kernel matrix of the inputs x₁ = ${num(chX1)} and x₂ = ${num(chX2)} is K = [[k(x₁, x₁), k(x₁, x₂)], [k(x₂, x₁), k(x₂, x₂)]]. What is det K? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `有理二次核为 k(x, x′) = α (1 + r²/(2βℓ²)) 的 −β 次幂，r = |x − x′|，其中 α = ${ch.alpha}，β = ${ch.beta}，ℓ = ${ch.ell}。输入 x₁ = ${num(chX1)}、x₂ = ${num(chX2)} 的 2 × 2 核矩阵为 K = [[k(x₁, x₁), k(x₁, x₂)], [k(x₂, x₁), k(x₂, x₂)]]。求 det K。请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('det K', 'det K'), answer: chAnswer, tolerance: 0.006 }],
      hint: t(
        'What is k(x₁, x₁)? Start with the entries of K.',
        'k(x₁, x₁) 是多少？先写出 K 的各个元素。'
      ),
      explanation: t(
        `The diagonal is k(x, x) = α = ${ch.alpha} because r = 0. The gap is r = |${num(chX1)} − ${par(chX2)}| = ${ch.r}, bracket 1 + ${ch.r * ch.r}/(2·${ch.beta}·${ch.ell}²) = ${exact(chQ)}, so k(x₁, x₂) = ${ch.alpha}/(${exact(chQ)}) to the power ${ch.beta} = ${exact(chK)}. K = ${mat([[String(ch.alpha), exact(chK)], [exact(chK), String(ch.alpha)]])} and det K = ${ch.alpha}² − (${exact(chK)})² = ${ch.alpha * ch.alpha} − ${exact(chK * chK)} = ${exact(chAnswer)}. It is positive, as it must be for a covariance matrix of two different inputs. This game does not test checking positive semi-definiteness in general.`,
        `对角元为 k(x, x) = α = ${ch.alpha}，因为 r = 0。间距 r = |${num(chX1)} − ${par(chX2)}| = ${ch.r}，括号 1 + ${ch.r * ch.r}/(2·${ch.beta}·${ch.ell}²) = ${exact(chQ)}，所以 k(x₁, x₂) = ${ch.alpha}/(${exact(chQ)}) 的 ${ch.beta} 次幂 = ${exact(chK)}。K = ${mat([[String(ch.alpha), exact(chK)], [exact(chK), String(ch.alpha)]])} ，det K = ${ch.alpha}² − (${exact(chK)})² = ${ch.alpha * ch.alpha} − ${exact(chK * chK)} = ${exact(chAnswer)}。结果为正，这正是两个不同输入的协方差矩阵应有的性质。本游戏不考查一般情形下的半正定性判定。`
      ),
      audit: { kind: 'GP-08:challenge', params: { alpha: ch.alpha, beta: ch.beta, ell: ch.ell, x1: chX1, x2: chX2 } },
    }),
  ];
};
