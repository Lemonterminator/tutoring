import type { CardGenerator } from '../../types';
import { exact, makeGpDeck, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function retry<T>(make: () => T, ok: (value: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const value = make(); if (ok(value)) return value; }
  throw new Error('GP-30 sampler rejection limit reached');
}
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
function denominator(value: number): number {
  for (let d = 1; d <= 100; d++) if (Math.abs(value * d - Math.round(value * d)) < 1e-9) return d / gcd(Math.round(value * d), d);
  return Infinity;
}
const allowedDenominators = new Set([1, 2, 4, 5, 10, 20, 25]);
const gap = (key: number, routes: number[], minimum: number) => routes.every(value => Math.abs(key - value) + 1e-10 >= minimum);
const zValues = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
const PhiValues = [0.0228, 0.0668, 0.1587, 0.3085, 0.5, 0.6915, 0.8413, 0.9332, 0.9772];
const phiValues = [0.054, 0.1295, 0.242, 0.3521, 0.3989, 0.3521, 0.242, 0.1295, 0.054];
const tableAt = (z: number) => zValues.indexOf(z);
const Phi = (z: number) => PhiValues[tableAt(z)];
const phi = (z: number) => phiValues[tableAt(z)];
const four = (value: number) => value.toFixed(4);
const tableText = t(
  'z = (−2, −1.5, −1, −0.5, 0, 0.5, 1, 1.5, 2)\nΦ(z) = (0.0228, 0.0668, 0.1587, 0.3085, 0.5000, 0.6915, 0.8413, 0.9332, 0.9772)\nφ(z) = (0.0540, 0.1295, 0.2420, 0.3521, 0.3989, 0.3521, 0.2420, 0.1295, 0.0540)',
  'z = (−2, −1.5, −1, −0.5, 0, 0.5, 1, 1.5, 2)\nΦ(z) = (0.0228, 0.0668, 0.1587, 0.3085, 0.5000, 0.6915, 0.8413, 0.9332, 0.9772)\nφ(z) = (0.0540, 0.1295, 0.2420, 0.3521, 0.3989, 0.3521, 0.2420, 0.1295, 0.0540)',
);
const ei = (mu: number, sigma: number, fplus: number) => {
  const z = (mu - fplus) / sigma;
  return Number(((mu - fplus) * Phi(z) + sigma * phi(z)).toFixed(5));
};
const decimal = (value: number) => num(Number(value.toFixed(5)));
const tablePrompt = (g: Deck) => `${g.t(t('Use this table of the standard normal distribution function Φ and density φ, and keep all four decimals while you calculate:', '使用下面这张标准正态分布的分布函数 Φ 与密度函数 φ 的数值表，计算时保留全部 4 位小数：'))}\n${g.t(tableText)}`;

type Ucb = { mu: number; sigma: number; beta: number };
const ucbTuples: Ucb[] = [];
for (let mu = 1; mu <= 5; mu++) for (const sigma of [0.5, 1, 2, 3]) for (const beta of [1.5, 2, 2.5, 3]) {
  const key = mu + beta * sigma, routes = [mu - beta * sigma, mu + sigma, beta * mu + sigma, mu + beta * beta * sigma];
  if (allowedDenominators.has(denominator(key)) && gap(key, routes, 0.25)) ucbTuples.push({ mu, sigma, beta });
}
type Tie = { muA: number; sigmaA: number; muB: number; sigmaB: number };
const tieTuples: Tie[] = [];
for (let muA = 2; muA <= 9; muA++) for (let muB = 1; muB <= 8; muB++) for (let sigmaA = 1; sigmaA <= 5; sigmaA++) for (let sigmaB = 1; sigmaB <= 5; sigmaB++) {
  if (muA <= muB || sigmaB <= sigmaA) continue;
  const dm = muA - muB, ds = sigmaB - sigmaA, key = dm / ds;
  if (key < 1 || key > 4 || !allowedDenominators.has(denominator(key)) || !gap(key, [ds / dm, dm / sigmaB, dm / sigmaA, dm / (sigmaA + sigmaB)], 0.25)) continue;
  tieTuples.push({ muA, sigmaA, muB, sigmaB });
}
type Lcb = { beta: number; rows: [number, number, number, number, number, number] };
const lcbTuples: Lcb[] = [];
const posteriorPairs: [number, number][] = [];
for (let mu = 3; mu <= 7; mu++) for (const sigma of [0.5, 1, 2]) posteriorPairs.push([mu, sigma]);
for (const beta of [1, 2]) for (const a of posteriorPairs) for (const b of posteriorPairs) for (const c of posteriorPairs) {
  const rows = [a, b, c], scores = rows.map(([mu, sigma]) => mu - beta * sigma), ups = rows.map(([mu, sigma]) => mu + beta * sigma), key = Math.min(...scores), maxSigma = Math.max(...rows.map(row => row[1]));
  if (key < 0.5 || scores.filter(x => x === key).length !== 1 || rows.filter(row => row[1] === maxSigma).length !== 1) continue;
  const routes = [Math.max(...ups), Math.min(...rows.map(row => row[0])), Math.min(...ups), scores[rows.findIndex(row => row[1] === maxSigma)], Math.max(...scores)];
  if (gap(key, routes, 0.5)) lcbTuples.push({ beta, rows: [a[0], a[1], b[0], b[1], c[0], c[1]] });
}
type Pi = { mu: number; sigma: number; fplus: number };
const piTuples: Pi[] = [];
for (const fplus of [2, 3, 4, 5]) for (const [sigma, zs] of [[0.5, [-2, -1, 1, 2]], [2, [-1, -0.5, 0.5, 1]]] as [number, number[]][]) for (const z of zs) {
  const mu = fplus + z * sigma, key = Phi(z), routes = [Phi(-z), Phi(mu - fplus), phi(z)];
  if (mu > 0 && gap(key, routes, 0.03)) piTuples.push({ mu, sigma, fplus });
}
type EiPoint = { mu: number; sigma: number; fplus: number };
const eiTuples: EiPoint[] = [];
for (const fplus of [2, 3, 4, 5]) for (const sigma of [1, 2]) for (const z of [-1.5, -1, -0.5, 0.5, 1, 1.5, 2]) {
  const mu = fplus + z * sigma;
  if (mu <= 0) continue;
  const key = ei(mu, sigma, fplus), d = mu - fplus, routes = [d * Phi(z), sigma * phi(z), d * Phi(z) - sigma * phi(z), d * Phi(-z) + sigma * phi(z)];
  if (gap(key, routes, 0.05)) eiTuples.push({ mu, sigma, fplus });
}
type Zero = { mu: number; fplus: number };
const zeroTuples: Zero[] = [];
for (const fplus of [2, 3, 4, 5]) for (let mu = 1; mu <= 7; mu++) if (mu !== fplus) {
  const d = mu - fplus, key = Math.max(0, d), routes = d > 0 ? [0, d / 2, -d, mu] : [d, -d, -d / 2, mu];
  if (gap(key, routes, 0.5)) zeroTuples.push({ mu, fplus });
}
type Challenge = { fplus: number; A: EiPoint; B: EiPoint };
const challengeTuples: Challenge[] = [];
const challengePoints = [1, 2].flatMap(sigma => [-1, -0.5, 0, 0.5, 1, 1.5].map(z => ({ sigma, z })));
for (const fplus of [3, 4, 5]) for (const A of challengePoints) for (const B of challengePoints) {
  const muA = fplus + A.z * A.sigma, muB = fplus + B.z * B.sigma;
  if (muA <= 0 || muB <= 0 || (A.sigma === B.sigma && A.z === B.z)) continue;
  const eA = ei(muA, A.sigma, fplus), eB = ei(muB, B.sigma, fplus), key = Math.max(eA, eB);
  if (Math.abs(eA - eB) < 1e-12) continue;
  const routes = [Math.min(eA, eB), Math.max((muA - fplus) * Phi(A.z), (muB - fplus) * Phi(B.z)), Math.max(A.sigma * phi(A.z), B.sigma * phi(B.z)), Math.max(Phi(A.z), Phi(B.z))];
  if (gap(key, routes, 0.08)) challengeTuples.push({ fplus, A: { mu: muA, sigma: A.sigma, fplus }, B: { mu: muB, sigma: B.sigma, fplus } });
}

type SampleRow = { mu: number; sigma: number; s: number; x: number };
const rowGrid: Omit<SampleRow, 'x'>[] = [];
for (let mu = 1; mu <= 5; mu++) for (const sigma of [0.5, 1, 2]) {
  const low = Math.ceil(Math.max(0, mu - 2 * sigma)), high = Math.floor(mu + 2 * sigma);
  for (let s = low; s <= high; s++) rowGrid.push({ mu, sigma, s });
}
function thompsonValid(rows: SampleRow[]) {
  const uniqueMaxIndex = (key: 'mu' | 'sigma' | 's') => {
    const values = rows.map(row => row[key]), max = Math.max(...values);
    return values.filter(value => value === max).length === 1 ? values.indexOf(max) : -1;
  };
  const indices = { s: uniqueMaxIndex('s'), mu: uniqueMaxIndex('mu'), sigma: uniqueMaxIndex('sigma') };
  return new Set(rows.map(row => `${row.mu},${row.sigma}`)).size === 4 && indices.s >= 0 && indices.mu >= 0 && indices.sigma >= 0 && indices.s !== indices.mu && indices.s !== indices.sigma && indices.mu !== indices.sigma;
}

export const gp30: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-30'); warm(g);
  const a = g.pick(ucbTuples), b = g.pick(tieTuples), c = g.pick(lcbTuples), d = g.pick(piTuples), e = g.pick(eiTuples), zero = g.pick(zeroTuples), fp = g.random(2, 5);
  const choicePairs = [0.5, 1, 2, 4].flatMap(sigmaA => [0.5, 1, 2, 4].filter(sigmaB => sigmaB !== sigmaA).map(sigmaB => ({ sigmaA, sigmaB })));
  const { sigmaA, sigmaB } = g.pick(choicePairs), big = sigmaA > sigmaB ? 'A' : 'B', small = big === 'A' ? 'B' : 'A';
  const rows = retry(() => Array.from({ length: 4 }, (_, i) => ({ x: i + 1, ...g.pick(rowGrid) })), thompsonValid);
  const challenge = g.pick(challengeTuples), keyChallenge = Math.max(ei(challenge.A.mu, challenge.A.sigma, challenge.fplus), ei(challenge.B.mu, challenge.B.sigma, challenge.fplus));
  const number = (label: Text, answer: number) => [{ label, answer, tolerance: 0.006 }];
  const param = (name: string, value: number) => `${name} = ${num(value)}`;

  const mu = a.mu, sigma = a.sigma, beta = a.beta, bs = beta * sigma, score = mu + bs;
  const r1 = mu - bs, r2 = mu + sigma, r3 = beta * mu + sigma, r4 = mu + beta * beta * sigma;
  const bsEq = sigma === 1 ? num(bs) : `${num(beta)}·${num(sigma)} = ${num(bs)}`;
  const tieKey = (b.muA - b.muB) / (b.sigmaB - b.sigmaA), dm = b.muA - b.muB, ds = b.sigmaB - b.sigmaA;
  const tA = tieKey * b.sigmaA, tB = tieKey * b.sigmaB, tiedScore = b.muA + tA;
  const dsBeta = ds === 1 ? 'β' : `${ds}β`;
  const tieRoutes = [ds / dm, dm / b.sigmaB, dm / b.sigmaA, dm / (b.sigmaA + b.sigmaB)];
  const lcbRows = [[c.rows[0],c.rows[1]],[c.rows[2],c.rows[3]],[c.rows[4],c.rows[5]]] as [number,number][];
  const lcbScores = lcbRows.map(([m,s]) => m - c.beta * s), lcbUpper = lcbRows.map(([m,s]) => m + c.beta * s), lcbKey = Math.min(...lcbScores);
  const bestLcb = lcbScores.indexOf(lcbKey), maxSigmaIndex = lcbRows.findIndex(row => row[1] === Math.max(...lcbRows.map(x => x[1])));
  const lcbRoutes = [Math.max(...lcbUpper), Math.min(...lcbRows.map(x => x[0])), Math.min(...lcbUpper), lcbScores[maxSigmaIndex], Math.max(...lcbScores)];
  const piZ = (d.mu - d.fplus) / d.sigma, piKey = Phi(piZ), piD = d.mu - d.fplus, piRoutes = [Phi(-piZ), Phi(piD), phi(piZ)];
  const eiZ = (e.mu - e.fplus) / e.sigma, eiD = e.mu - e.fplus, eiPhi = Phi(eiZ), eiPhiD = phi(eiZ), eiKey = ei(e.mu,e.sigma,e.fplus), ei1 = eiD * eiPhi, ei2 = e.sigma * eiPhiD;
  const eiChain = eiD === 1 ? `${four(eiPhi)} + ${num(ei2)} = ${decimal(eiKey)}` : eiD === -1 ? `−${four(eiPhi)} + ${num(ei2)} = ${decimal(eiKey)}` : `${num(eiD)}·${four(eiPhi)} + ${num(ei2)} = ${decimal(eiKey)}`;
  const eiRoutes = [ei1,ei2,ei1-ei2,eiD*Phi(-eiZ)+ei2];
  const zeroD = zero.mu-zero.fplus, zeroKey = Math.max(0,zeroD), zeroRoutes = zeroD > 0 ? [0,zeroD/2,-zeroD,zero.mu] : [zeroD,-zeroD,-zeroD/2,zero.mu];
  const sampleChoice = rows.reduce((best, row) => row.s > best.s ? row : best);
  const sampleIndices = {
    sample: sampleChoice.x,
    mean: rows.reduce((best,row)=>row.mu>best.mu?row:best).x,
    uncertainty: rows.reduce((best,row)=>row.sigma>best.sigma?row:best).x,
    ucb: rows.reduce((best,row)=>row.mu+2*row.sigma>best.mu+2*best.sigma?row:best).x,
  };
  const cEI = (point: EiPoint) => {
    const z = (point.mu-point.fplus)/point.sigma, delta=point.mu-point.fplus, pz=Phi(z), dz=phi(z), first=delta*pz, second=point.sigma*dz, key=ei(point.mu,point.sigma,point.fplus);
    let chain: string;
    if (delta===0) chain = point.sigma===1 ? `${num(second)}` : `${num(point.sigma)}·${four(dz)} = ${num(second)}`;
    else if (delta===1) chain = point.sigma===1 ? `${four(pz)} + ${num(second)} = ${num(key)}` : `${four(pz)} + ${num(point.sigma)}·${four(dz)} = ${num(first)} + ${num(second)} = ${num(key)}`;
    else if (delta===-1) chain = point.sigma===1 ? `−${four(pz)} + ${num(second)} = ${num(key)}` : `−${four(pz)} + ${num(point.sigma)}·${four(dz)} = ${num(first)} + ${num(second)} = ${num(key)}`;
    else chain = point.sigma===1 ? `${num(delta)}·${four(pz)} + ${four(dz)} = ${num(first)} + ${num(second)} = ${num(key)}` : `${num(delta)}·${four(pz)} + ${num(point.sigma)}·${four(dz)} = ${num(first)} + ${num(second)} = ${num(key)}`;
    return { z, delta, pz, dz, first, second, key, chain };
  };
  const ca = cEI(challenge.A), cb = cEI(challenge.B), challengeBest = ca.key > cb.key ? 'A' : 'B';
  const challengeRoutes = [Math.min(ca.key,cb.key),Math.max(ca.first,cb.first),Math.max(ca.second,cb.second),Math.max(ca.pz,cb.pz)];

  return [
    g.number({ id:'ucb-score', title:t('UCB score of a point','一个点的 UCB 得分'), prompt:t(`We maximise an unknown function. At a candidate point the GP posterior has mean μ = ${mu} and standard deviation σ = ${num(sigma)}. The upper confidence bound (UCB) uses the exploration weight β = ${num(beta)} (Lecture 12 p. 18). What is the UCB score of this point? Give an integer, a fraction or a decimal rounded to 2 places.`, `我们要最大化一个未知函数。在某个候选点，GP 后验的均值为 μ = ${mu}，标准差为 σ = ${num(sigma)}。置信上界（UCB）使用探索权重 β = ${num(beta)}（第 12 讲第 18 页）。这个点的 UCB 得分是多少？请填整数、分数，或保留 2 位小数的小数。`), fields:number(t('UCB score','UCB 得分'),score), hint:t('UCB rewards a high posterior mean and a high posterior uncertainty (Lecture 12 pp. 14 and 18). What does the weight β control?','UCB 既奖励高的后验均值，也奖励高的后验不确定性（第 12 讲第 14 页、第 18 页）。权重 β 控制的是什么？'), explanation:t(`The UCB score is μ + β σ (Lecture 12 p. 18): the posterior mean plus β posterior standard deviations. Here β σ = ${bsEq}, so the score is ${mu} + ${num(bs)} = ${exact(score)}. The lower bound μ − β σ would give ${exact(r1)}; dropping β, μ + σ, ${exact(r2)}; putting β on the mean instead of σ, ${exact(r3)}; squaring β, ${exact(r4)}. A larger β favours exploration, a smaller β favours exploitation (Lecture 12 p. 14).`, `UCB 得分为 μ + β σ（第 12 讲第 18 页），即后验均值加上 β 个后验标准差。这里 β σ = ${bsEq}，所以得分为 ${mu} + ${num(bs)} = ${exact(score)}。若用下界 μ − β σ 会得到 ${exact(r1)}；漏掉 β 即 μ + σ 得到 ${exact(r2)}；把 β 乘在均值上而不是 σ 上得到 ${exact(r3)}；把 β 平方得到 ${exact(r4)}。β 越大越偏向探索，β 越小越偏向利用（第 12 讲第 14 页）。`), audit:{kind:'GP-30:ucb-score',params:a} }),
    g.number({ id:'ucb-tie', title:t('When do two points tie under UCB?','两个点何时在 UCB 下打平？'), prompt:t(`We maximise an unknown function and compare two candidate points with the UCB (Lecture 12 p. 18). At point A the GP posterior has mean μ = ${b.muA} and standard deviation σ = ${b.sigmaA}; at point B it has mean μ = ${b.muB} and standard deviation σ = ${b.sigmaB}. Point A has the larger mean and point B the larger uncertainty. For which exploration weight β do the two points get exactly the same UCB score? Give an integer, a fraction or a decimal rounded to 2 places.`, `我们要最大化一个未知函数，并用 UCB（第 12 讲第 18 页）比较两个候选点。在点 A，GP 后验的均值为 μ = ${b.muA}，标准差为 σ = ${b.sigmaA}；在点 B，均值为 μ = ${b.muB}，标准差为 σ = ${b.sigmaB}。点 A 的均值更大，点 B 的不确定性更大。探索权重 β 取多少时，两个点的 UCB 得分恰好相同？请填整数、分数，或保留 2 位小数的小数。`), fields:number(t('β','β'),tieKey), hint:t('With β = 0 only the means matter, so A wins; with a very large β the uncertainty dominates, so B wins. The answer is where the winner switches.','β = 0 时只有均值起作用，A 更优；β 很大时不确定性起主导，B 更优。答案就是优劣交换的位置。'), explanation:t(`The UCB score of A is ${b.muA} + ${num(tA)} and that of B is ${b.muB} + ${num(tB)} (Lecture 12 p. 18). Setting them equal gives ${dm} = ${dsBeta}, so β = ${ds===1?exact(tieKey):`${dm} ÷ ${ds} = ${exact(tieKey)}`}. Check: with β = ${num(tieKey)} both scores equal ${num(tiedScore)}. Swapping numerator and denominator would give ${exact(tieRoutes[0])}; dividing by the σ of B only, ${exact(tieRoutes[1])}; by the σ of A only, ${exact(tieRoutes[2])}; by the sum of the two σ, ${exact(tieRoutes[3])}. For a larger β the more uncertain point B is the better one, for a smaller β point A is.`, `A 的 UCB 得分为 ${b.muA} + ${num(tA)}，B 的为 ${b.muB} + ${num(tB)}（第 12 讲第 18 页）。令二者相等得 ${dm} = ${dsBeta}，所以 β = ${ds===1?exact(tieKey):`${dm} ÷ ${ds} = ${exact(tieKey)}`}。验算：β = ${num(tieKey)} 时两个得分都等于 ${num(tiedScore)}。把分子分母颠倒会得到 ${exact(tieRoutes[0])}；只除以 B 的 σ 得到 ${exact(tieRoutes[1])}；只除以 A 的 σ 得到 ${exact(tieRoutes[2])}；除以两个 σ 之和得到 ${exact(tieRoutes[3])}。β 比它大时更不确定的点 B 更优，比它小时点 A 更优。`), audit:{kind:'GP-30:ucb-tie',params:b} }),
    g.number({ id:'lcb-best', title:t('Lower confidence bound when minimising','最小化时的置信下界'), prompt:t(`We now minimise an unknown function. Use the lower confidence bound (LCB), the minimisation counterpart of UCB, with exploration weight β = ${c.beta}. Three candidate points have the posterior (mean, standard deviation) pairs A = (${c.rows[0]}, ${num(c.rows[1])}), B = (${c.rows[2]}, ${num(c.rows[3])}) and C = (${c.rows[4]}, ${num(c.rows[5])}). What is the smallest LCB value among the three points? Give an integer, a fraction or a decimal rounded to 2 places.`, `现在我们要最小化一个未知函数。使用置信下界（LCB，即 UCB 在最小化问题中的对应形式），探索权重 β = ${c.beta}。三个候选点的后验（均值，标准差）分别为 A = (${c.rows[0]}, ${num(c.rows[1])})，B = (${c.rows[2]}, ${num(c.rows[3])})，C = (${c.rows[4]}, ${num(c.rows[5])})。三个点中最小的 LCB 值是多少？请填整数、分数，或保留 2 位小数的小数。`), fields:number(t('smallest LCB','最小的 LCB'),lcbKey), hint:t('When we minimise, we look at the lower edge of the posterior band: an uncertain point can hide a value far below its mean. Which edge does the weight β move, and in which direction?','最小化时看的是后验区间的下边缘：不确定的点可能隐藏着远低于均值的取值。权重 β 把哪条边缘向哪个方向移动？'), explanation:t(`For minimisation the score is the lower bound LCB = μ − β σ, the mirror image of the UCB of Lecture 12 p. 18 (the slides show only the maximisation form). With β = ${c.beta}, the product β σ is ${num(c.beta*c.rows[1])} for A, ${num(c.beta*c.rows[3])} for B and ${num(c.beta*c.rows[5])} for C, so LCB(A) = ${c.rows[0]} − ${num(c.beta*c.rows[1])} = ${exact(lcbScores[0])}, LCB(B) = ${c.rows[2]} − ${num(c.beta*c.rows[3])} = ${exact(lcbScores[1])} and LCB(C) = ${c.rows[4]} − ${num(c.beta*c.rows[5])} = ${exact(lcbScores[2])}. The smallest is ${exact(lcbKey)}, at point ${'ABC'[bestLcb]}. Taking the largest of μ + β σ, the maximisation score, would give ${exact(lcbRoutes[0])}; the smallest mean alone, ${exact(lcbRoutes[1])}; the smallest of μ + β σ, ${exact(lcbRoutes[2])}; the LCB of the most uncertain point only, ${exact(lcbRoutes[3])}; the largest LCB, ${exact(lcbRoutes[4])}.`, `最小化时的得分是置信下界 LCB = μ − β σ，它是第 12 讲第 18 页 UCB 的镜像（讲义只给出了最大化的形式）。取 β = ${c.beta}，乘积 β σ 在 A 处为 ${num(c.beta*c.rows[1])}，在 B 处为 ${num(c.beta*c.rows[3])}，在 C 处为 ${num(c.beta*c.rows[5])}，所以 LCB(A) = ${c.rows[0]} − ${num(c.beta*c.rows[1])} = ${exact(lcbScores[0])}，LCB(B) = ${c.rows[2]} − ${num(c.beta*c.rows[3])} = ${exact(lcbScores[1])}，LCB(C) = ${c.rows[4]} − ${num(c.beta*c.rows[5])} = ${exact(lcbScores[2])}。最小值是 ${exact(lcbKey)}，出现在点 ${'ABC'[bestLcb]}。取 μ + β σ 的最大值（最大化的得分）会得到 ${exact(lcbRoutes[0])}；只看最小的均值得到 ${exact(lcbRoutes[1])}；取 μ + β σ 的最小值得到 ${exact(lcbRoutes[2])}；只取最不确定的点的 LCB 得到 ${exact(lcbRoutes[3])}；取 LCB 的最大值得到 ${exact(lcbRoutes[4])}。`), audit:{kind:'GP-30:lcb-best',params:{mu1:c.rows[0],sigma1:c.rows[1],mu2:c.rows[2],sigma2:c.rows[3],mu3:c.rows[4],sigma3:c.rows[5],beta:c.beta}} }),
    g.number({ id:'pi-lookup', title:t('Probability of improvement','改进概率'), prompt:t(`We maximise an unknown function. At a candidate point the GP posterior has mean μ = ${d.mu} and standard deviation σ = ${num(d.sigma)}, and the largest value observed so far is f⁺ = ${d.fplus}. What is the probability of improvement (PI) of this point (Lecture 12 p. 21)? ${tablePrompt(g)}\nGive a decimal rounded to 2 places.`, `我们要最大化一个未知函数。在某个候选点，GP 后验的均值为 μ = ${d.mu}，标准差为 σ = ${num(d.sigma)}，到目前为止观测到的最大值为 f⁺ = ${d.fplus}。这个点的改进概率（PI）是多少（第 12 讲第 21 页）？${tablePrompt(g)}\n请填保留 2 位小数的小数。`), fields:number(t('PI','PI'),piKey), hint:t('PI is the posterior probability that the function value at this point is at least f⁺ (Lecture 12 p. 21). Is μ above or below f⁺?','PI 是这个点的函数值至少达到 f⁺ 的后验概率（第 12 讲第 21 页）。μ 在 f⁺ 之上还是之下？'), explanation:t(`PI = Φ((μ − f⁺) ÷ σ) (Lecture 12 p. 21). Here μ − f⁺ = ${d.mu} − ${d.fplus} = ${num(piD)}, and the standardised gap is ${num(piD)} ÷ ${num(d.sigma)} = ${num(piZ)}, so PI = Φ(${num(piZ)}) = ${four(piKey)} from the table. Because μ is ${piD>0?'above':'below'} f⁺, PI is ${piD>0?'above':'below'} 0.5. The mirrored value Φ(${num(-piZ)}) would give ${four(piRoutes[0])}; forgetting to divide by σ, Φ(${num(piD)}) gives ${four(piRoutes[1])}; reading the density φ(${num(piZ)}) instead of Φ gives ${four(piRoutes[2])}.`, `PI = Φ((μ − f⁺) ÷ σ)（第 12 讲第 21 页）。这里 μ − f⁺ = ${d.mu} − ${d.fplus} = ${num(piD)}，标准化后的差距为 ${num(piD)} ÷ ${num(d.sigma)} = ${num(piZ)}，所以查表得 PI = Φ(${num(piZ)}) = ${four(piKey)}。因为 μ 在 f⁺ ${piD>0?'之上':'之下'}，PI 也${piD>0?'高于':'低于'} 0.5。镜像的值 Φ(${num(-piZ)}) 会得到 ${four(piRoutes[0])}；忘了除以 σ，即 Φ(${num(piD)}) 得到 ${four(piRoutes[1])}；把密度 φ(${num(piZ)}) 当作 Φ 读取得到 ${four(piRoutes[2])}。`), audit:{kind:'GP-30:pi-lookup',params:d} }),
    g.number({ id:'ei-calc', title:t('Expected improvement','期望改进'), prompt:t(`We maximise an unknown function. At a candidate point the GP posterior has mean μ = ${e.mu} and standard deviation σ = ${e.sigma}, and the largest value observed so far is f⁺ = ${e.fplus}. What is the expected improvement (EI) of this point (Lecture 12 p. 26)? ${tablePrompt(g)}\nGive a decimal rounded to 2 places.`, `我们要最大化一个未知函数。在某个候选点，GP 后验的均值为 μ = ${e.mu}，标准差为 σ = ${e.sigma}，到目前为止观测到的最大值为 f⁺ = ${e.fplus}。这个点的期望改进（EI）是多少（第 12 讲第 26 页）？${tablePrompt(g)}\n请填保留 2 位小数的小数。`), fields:number(t('EI','EI'),eiKey), hint:t('EI is the expected size of the improvement max(0, f − f⁺) under the posterior (Lecture 12 p. 25); the closed form is on p. 26.','EI 是后验下改进量 max(0, f − f⁺) 的期望（第 12 讲第 25 页）；闭式在第 26 页。'), explanation:t(`EI = (μ − f⁺) Φ(z) + σ φ(z) with z = (μ − f⁺) ÷ σ (Lecture 12 p. 26). Here μ − f⁺ = ${e.mu} − ${e.fplus} = ${num(eiD)} and z = ${num(eiD)} ÷ ${e.sigma} = ${num(eiZ)}; the table gives Φ(${num(eiZ)}) = ${four(eiPhi)} and φ(${num(eiZ)}) = ${four(eiPhiD)}. So EI = ${eiChain}. Keeping only the first term would give ${decimal(eiRoutes[0])}; only the second term, ${decimal(eiRoutes[1])}; subtracting the second term, ${decimal(eiRoutes[2])}; using Φ(${num(-eiZ)}) in the first term, ${decimal(eiRoutes[3])}. EI is never negative: the second term is positive even when μ is below f⁺. (In Assignment 6, Task 3 the acquisition function receives the posterior mean, the posterior standard deviation and the largest observed value, which is f⁺.)`, `EI = (μ − f⁺) Φ(z) + σ φ(z)，其中 z = (μ − f⁺) ÷ σ（第 12 讲第 26 页）。这里 μ − f⁺ = ${e.mu} − ${e.fplus} = ${num(eiD)}，z = ${num(eiD)} ÷ ${e.sigma} = ${num(eiZ)}；查表得 Φ(${num(eiZ)}) = ${four(eiPhi)}，φ(${num(eiZ)}) = ${four(eiPhiD)}。所以 EI = ${eiChain}。只保留第一项会得到 ${decimal(eiRoutes[0])}；只保留第二项得到 ${decimal(eiRoutes[1])}；把第二项减去得到 ${decimal(eiRoutes[2])}；在第一项里用 Φ(${num(-eiZ)}) 得到 ${decimal(eiRoutes[3])}。EI 永远不为负：即使 μ 低于 f⁺，第二项也是正的。（在作业 6 的任务 3 中，采集函数接收后验均值、后验标准差和当前最大观测值，也就是 f⁺。）`), audit:{kind:'GP-30:ei-calc',params:e} }),
    g.number({ id:'ei-sigma-zero', title:t('EI at a point with no uncertainty','没有不确定性的点的 EI'), prompt:t(`We maximise an unknown function. At a candidate point the GP posterior has mean μ = ${zero.mu} and standard deviation σ = 0, so the value of f there is known exactly. The largest value observed so far is f⁺ = ${zero.fplus}. What is the expected improvement (EI) of this point (Lecture 12 p. 25)? Give an integer, a fraction or a decimal rounded to 2 places.`, `我们要最大化一个未知函数。在某个候选点，后验均值为 μ = ${zero.mu}，标准差 σ = 0，所以那里 f 的取值是完全已知的。到目前为止观测到的最大值为 f⁺ = ${zero.fplus}。这个点的期望改进（EI）是多少（第 12 讲第 25 页）？请填整数、分数，或保留 2 位小数的小数。`), fields:number(t('EI','EI'),zeroKey), hint:t('If σ = 0, is the value f(x) still random? Lecture 12 p. 25 defines EI as an expected improvement.','σ = 0 时，f(x) 的取值还是随机的吗？第 12 讲第 25 页把 EI 定义为改进量的期望。'), explanation:t(`At σ = 0 the ratio (μ − f⁺) ÷ σ in the closed form of Lecture 12 p. 26 cannot be evaluated, so go back to the definition of Lecture 12 p. 25, EI = E[max(0, f − f⁺)]. With σ = 0 the value f is not random: it equals μ = ${zero.mu}. The improvement is therefore max(0, ${zero.mu} − ${zero.fplus}) = max(0, ${num(zeroD)}) = ${exact(zeroKey)}. (The closed form tends to the same value as σ → 0.) ${zeroD > 0 ? `Reading no uncertainty as no improvement would give ${exact(zeroRoutes[0])}; plugging 0 for the unavailable ratio, half the gap, ${exact(zeroRoutes[1])}; taking the gap backwards, ${exact(zeroRoutes[2])}; using μ itself, ${exact(zeroRoutes[3])}.` : `Dropping the floor at 0 would give the negative gap ${exact(zeroRoutes[0])}; using the size of the gap, ${exact(zeroRoutes[1])}; half the size of the gap, ${exact(zeroRoutes[2])}; using μ itself, ${exact(zeroRoutes[3])}.`}`, `σ = 0 时，第 12 讲第 26 页闭式中的比值 (μ − f⁺) ÷ σ 无法计算，所以回到第 12 讲第 25 页的定义 EI = E[max(0, f − f⁺)]。σ = 0 时 f 不再随机：它等于 μ = ${zero.mu}。因此改进量是 max(0, ${zero.mu} − ${zero.fplus}) = max(0, ${num(zeroD)}) = ${exact(zeroKey)}。（当 σ → 0 时，闭式趋于同一个值。）${zeroD > 0 ? `把没有不确定性当作没有改进会得到 ${exact(zeroRoutes[0])}；用 0 代替无法计算的比值，即取差距的一半，得到 ${exact(zeroRoutes[1])}；把差距反过来取得到 ${exact(zeroRoutes[2])}；直接用 μ 得到 ${exact(zeroRoutes[3])}。` : `不取 0 为下限会得到负的差距 ${exact(zeroRoutes[0])}；用差距的绝对值得到 ${exact(zeroRoutes[1])}；用差距绝对值的一半得到 ${exact(zeroRoutes[2])}；直接用 μ 得到 ${exact(zeroRoutes[3])}。`}`), audit:{kind:'GP-30:ei-sigma-zero',params:zero} }),
    g.choice({ id:'pi-vs-ei', title:t('PI and EI when the mean equals the best value','均值等于最优值时的 PI 与 EI'), prompt:t(`We maximise an unknown function. At two candidate points A and B the GP posterior mean equals the largest value observed so far, f⁺ = ${fp}. The posterior standard deviation is σ = ${num(sigmaA)} at A and σ = ${num(sigmaB)} at B. Which statement about the probability of improvement (PI) and the expected improvement (EI) of the two points is correct (Lecture 12 pp. 21 and 26)?`, `我们要最大化一个未知函数。在两个候选点 A 和 B 处，GP 后验均值都等于目前观测到的最大值 f⁺ = ${fp}。后验标准差在 A 处为 σ = ${num(sigmaA)}，在 B 处为 σ = ${num(sigmaB)}。关于这两个点的改进概率（PI）与期望改进（EI），下面哪一项正确（第 12 讲第 21 页和第 26 页）？`), options:[t(`PI is the same at both points, but EI is larger at point ${big}`,`两点的改进概率相同，但期望改进在点${big}更大`), t(`Both PI and EI are larger at point ${big}, because both reward uncertainty`,`改进概率和期望改进都在点${big}更大，因为两者都奖励不确定性`), t('PI and EI are both the same, because the means are equal','改进概率与期望改进都相同，因为均值相等'), t(`PI is the same at both points, but EI is larger at point ${small}, the more certain one`,`两点的改进概率相同，但期望改进在点${small}更大，因为${small}更确定`)], correct:0, hint:t('Put μ = f⁺ into the closed forms of PI and EI (Lecture 12 pp. 21 and 26) and ask which of the two still depends on σ.','把 μ = f⁺ 代入 PI 和 EI 的闭式（第 12 讲第 21 页、第 26 页），看看二者中哪一个仍然依赖于 σ。'), explanation:t(`With μ = f⁺ the standardised gap is z = 0 at both points, so PI = Φ(0) = 0.5 at A and at B: PI cannot tell them apart (Lecture 12 p. 21). EI = σ φ(0) = σ · 0.3989 (Lecture 12 p. 26), which is ${num(sigmaA*0.3989)} at A and ${num(sigmaB*0.3989)} at B, larger at point ${big}. So PI is the same and EI is larger at the point with more uncertainty. Saying that both are larger at the uncertain point confuses PI with EI; saying that both are the same because the means are equal ignores that EI depends on σ; saying that EI is larger at the more certain point reverses the effect, because here EI grows with σ.`,`后验均值等于 f⁺ 时，两点的标准化差距都是 z = 0，所以 A 和 B 处的 PI = Φ(0) = 0.5 相同：PI 区分不了它们（第 12 讲第 21 页）。EI = σ φ(0) = σ · 0.3989（第 12 讲第 26 页），在 A 处为 ${num(sigmaA*0.3989)}，在 B 处为 ${num(sigmaB*0.3989)}，在点 ${big} 更大。所以 PI 相同，EI 在不确定性更大的点更大。说两者都在不确定的点更大，是把 PI 与 EI 混为一谈；说两者都相同是因为均值相等，忽略了 EI 依赖于 σ；说 EI 在更确定的点更大，是把方向弄反了，因为此时 EI 随 σ 增大。`)}),
    g.number({ id:'thompson-pick', title:t('Which input does Thompson sampling choose?','汤普森采样选择哪个输入？'), prompt:t(`We maximise an unknown function. The GP posterior at four candidate inputs has the following mean μ and standard deviation σ, and Thompson sampling has just drawn one sample function from the posterior, whose values s at these inputs are listed too.\nx = 1: μ = ${rows[0].mu}, σ = ${num(rows[0].sigma)}, sample value s = ${rows[0].s}\nx = 2: μ = ${rows[1].mu}, σ = ${num(rows[1].sigma)}, sample value s = ${rows[1].s}\nx = 3: μ = ${rows[2].mu}, σ = ${num(rows[2].sigma)}, sample value s = ${rows[2].s}\nx = 4: μ = ${rows[3].mu}, σ = ${num(rows[3].sigma)}, sample value s = ${rows[3].s}\nWhich input x does Thompson sampling choose next (Lecture 12 p. 16)? Give 1, 2, 3 or 4.`, `我们要最大化一个未知函数。GP 后验在四个候选输入处的均值 μ 与标准差 σ 如下，并且汤普森采样刚从后验中抽取了一个样本函数，它在这些输入处的取值 s 也一并列出。\nx = 1：μ = ${rows[0].mu}，σ = ${num(rows[0].sigma)}，样本值 s = ${rows[0].s}\nx = 2：μ = ${rows[1].mu}，σ = ${num(rows[1].sigma)}，样本值 s = ${rows[1].s}\nx = 3：μ = ${rows[2].mu}，σ = ${num(rows[2].sigma)}，样本值 s = ${rows[2].s}\nx = 4：μ = ${rows[3].mu}，σ = ${num(rows[3].sigma)}，样本值 s = ${rows[3].s}\n汤普森采样下一步选择哪个输入 x（第 12 讲第 16 页）？请填 1、2、3 或 4。`), fields:number(t('x','x'),sampleChoice.x), hint:t('Lecture 12 p. 16 defines the Thompson acquisition value as a random draw from the posterior. Which of the listed numbers is that draw?','第 12 讲第 16 页把汤普森采样的采集值定义为从后验中抽取的一次随机取值。列出的数中哪一个是这次抽取？'), explanation:t(`Thompson sampling uses the drawn sample itself as the acquisition value and picks the input where it is largest (Lecture 12 p. 16). The largest s is ${sampleChoice.s} at x = ${sampleChoice.x}. Choosing by the largest mean would give x = ${sampleIndices.mean}; by the largest σ, x = ${sampleIndices.uncertainty}; choosing the first listed input among maxima of μ + 2σ (UCB with β = 2) gives x = ${sampleIndices.ucb}. UCB and Thompson can agree on an input for this draw, including when the UCB maximum is tied; the acquisition rules still use different values. Another posterior draw could select a different input.`,`汤普森采样把抽取的样本值本身作为采集值，并选择它最大的输入（第 12 讲第 16 页）。最大的 s 是 ${sampleChoice.s}，在 x = ${sampleChoice.x} 处。按最大均值选择会得到 x = ${sampleIndices.mean}；按最大 σ 选择得到 x = ${sampleIndices.uncertainty}；在 μ + 2σ 最大的输入中按列表顺序取第一个（即 β = 2 的 UCB）会得到 x = ${sampleIndices.ucb}。这次抽取中 UCB 与汤普森采样可能选择同一输入，包括 UCB 最大值并列时；两种采集规则使用的值仍不同。从同一后验再抽一次可能选择另一个输入。`), audit:{kind:'GP-30:thompson-pick',params:Object.fromEntries(rows.flatMap((row,i)=>[[`mu${i+1}`,row.mu],[`sigma${i+1}`,row.sigma],[`s${i+1}`,row.s]]))} }),
    g.number({ id:'challenge', title:t('Challenge: the larger expected improvement','挑战：较大的期望改进'), prompt:t(`We maximise an unknown function. The largest value observed so far is f⁺ = ${challenge.fplus}. Point A has posterior mean μ = ${challenge.A.mu} and standard deviation σ = ${challenge.A.sigma}; point B has posterior mean μ = ${challenge.B.mu} and standard deviation σ = ${challenge.B.sigma}. What is the larger of the two expected improvements (EI) (Lecture 12 p. 26)? ${tablePrompt(g)}\nGive a decimal rounded to 2 places.`, `我们要最大化一个未知函数。到目前为止观测到的最大值为 f⁺ = ${challenge.fplus}。点 A 的后验均值为 μ = ${challenge.A.mu}，标准差 σ = ${challenge.A.sigma}；点 B 的后验均值为 μ = ${challenge.B.mu}，标准差 σ = ${challenge.B.sigma}。两个点的期望改进（EI）中较大的一个是多少（第 12 讲第 26 页）？${tablePrompt(g)}\n请填保留 2 位小数的小数。`), fields:number(t('larger EI','较大的 EI'),keyChallenge), hint:t('Compute each EI separately and compare.','分别计算两个 EI，再比较。'), explanation:t(`Point A: μ − f⁺ = ${challenge.A.mu} − ${challenge.fplus} = ${num(ca.delta)} and z = ${num(ca.delta)} ÷ ${challenge.A.sigma} = ${num(ca.z)}, so Φ(${num(ca.z)}) = ${four(ca.pz)}, φ(${num(ca.z)}) = ${four(ca.dz)} and EI(A) = ${ca.chain}. Point B: μ − f⁺ = ${challenge.B.mu} − ${challenge.fplus} = ${num(cb.delta)} and z = ${num(cb.delta)} ÷ ${challenge.B.sigma} = ${num(cb.z)}, so Φ(${num(cb.z)}) = ${four(cb.pz)}, φ(${num(cb.z)}) = ${four(cb.dz)} and EI(B) = ${cb.chain}. The larger value is EI at point ${challengeBest}, ${decimal(keyChallenge)}. Reporting the smaller EI would give ${decimal(challengeRoutes[0])}; keeping only the first term of each EI and taking the larger, ${decimal(challengeRoutes[1])}; only the second term, ${decimal(challengeRoutes[2])}; reporting the larger PI instead of an EI, ${decimal(challengeRoutes[3])}. (Assignment 6, Task 3 picks the next point in the same way: the grid point with the largest acquisition value.) This game does not assess running the whole Bayesian optimisation loop, fitting the GP hyperparameters or deriving the closed form of EI.`,`点 A：μ − f⁺ = ${challenge.A.mu} − ${challenge.fplus} = ${num(ca.delta)}，z = ${num(ca.delta)} ÷ ${challenge.A.sigma} = ${num(ca.z)}，所以 Φ(${num(ca.z)}) = ${four(ca.pz)}，φ(${num(ca.z)}) = ${four(ca.dz)}，EI(A) = ${ca.chain}。点 B：μ − f⁺ = ${challenge.B.mu} − ${challenge.fplus} = ${num(cb.delta)}，z = ${num(cb.delta)} ÷ ${challenge.B.sigma} = ${num(cb.z)}，所以 Φ(${num(cb.z)}) = ${four(cb.pz)}，φ(${num(cb.z)}) = ${four(cb.dz)}，EI(B) = ${cb.chain}。较大的是点 ${challengeBest} 的 EI，即 ${decimal(keyChallenge)}。报告较小的 EI 会得到 ${decimal(challengeRoutes[0])}；两点都只保留第一项再取较大者得到 ${decimal(challengeRoutes[1])}；只保留第二项得到 ${decimal(challengeRoutes[2])}；报告较大的 PI 而不是 EI 得到 ${decimal(challengeRoutes[3])}。（作业 6 的任务 3 也是这样选下一个点：取采集值最大的网格点。）本游戏不考查整个贝叶斯优化循环的运行、GP 超参数的拟合，也不考查 EI 闭式的推导。`), audit:{kind:'GP-30:challenge',params:{fplus:challenge.fplus,muA:challenge.A.mu,sigmaA:challenge.A.sigma,muB:challenge.B.mu,sigmaB:challenge.B.sigma}} }),
  ];
};
