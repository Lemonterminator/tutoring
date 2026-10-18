import { describe, expect, it } from 'vitest';
import { gp30 } from './games/gp30';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard } from '../types';

const SEEDS = 60;
const PARAMS: Record<string, string[]> = {
  'GP-30:ucb-score': ['mu', 'sigma', 'beta'],
  'GP-30:ucb-tie': ['muA', 'sigmaA', 'muB', 'sigmaB'],
  'GP-30:lcb-best': ['mu1', 'sigma1', 'mu2', 'sigma2', 'mu3', 'sigma3', 'beta'],
  'GP-30:pi-lookup': ['mu', 'sigma', 'fplus'],
  'GP-30:ei-calc': ['mu', 'sigma', 'fplus'],
  'GP-30:ei-sigma-zero': ['mu', 'fplus'],
  'GP-30:thompson-pick': Array.from({ length: 4 }, (_, i) => [`mu${i + 1}`, `sigma${i + 1}`, `s${i + 1}`]).flat(),
  'GP-30:challenge': ['fplus', 'muA', 'sigmaA', 'muB', 'sigmaB'],
};
const kinds = Object.keys(PARAMS);
type P = Record<string, number>;
const params = (card: PracticeCard) => card.audit!.params as P;
const cardBy = (cards: PracticeCard[], slug: string) => {
  const card = cards.find(item => item.id === `GP-30-${slug}`);
  expect(card, `missing GP-30-${slug}`).toBeDefined();
  return card!;
};
const val = (x: number) => String(x).replaceAll('-', '−');
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const zGrid = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
const phiTable = [0.054, 0.1295, 0.242, 0.3521, 0.3989, 0.3521, 0.242, 0.1295, 0.054];
const PhiTable = [0.0228, 0.0668, 0.1587, 0.3085, 0.5, 0.6915, 0.8413, 0.9332, 0.9772];
const tab = (z: number, density = false) => (density ? phiTable : PhiTable)[zGrid.indexOf(z)];
const normPdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
function simpson(fn: (x: number) => number, lo: number, hi: number, n = 4000) {
  const h = (hi - lo) / n;
  let sum = fn(lo) + fn(hi);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * fn(lo + h * i);
  return sum * h / 3;
}
const cdf = (z: number) => z === 0 ? 0.5 : z > 0 ? 0.5 + simpson(normPdf, 0, z, 400) : 0.5 - simpson(normPdf, 0, -z, 400);
function quantile(prob: number) {
  let lo = -8, hi = 8;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < prob) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const normalQuantile = (mu: number, sigma: number, probability: number) => mu + sigma * quantile(probability);
const eiIntegral = (mu: number, sigma: number, fplus: number) => {
  const upper = Math.max(mu + 12 * sigma, fplus + sigma * 12);
  return simpson(x => Math.max(0, x - fplus) * normPdf((x - mu) / sigma) / sigma, fplus, upper, 6000);
};
function answerOf(card: PracticeCard) {
  expect(card.fields, `${card.id} numeric oracle requires one field`).toHaveLength(1);
  return card.fields![0].answer;
}
function assertParamLabels(card: PracticeCard, lang: 'en' | 'zh') {
  const p = params(card), id = card.id.replace('GP-30-', '');
  for (const key of PARAMS[card.audit!.kind]) expect(p, `${card.id}: missing param ${key}`).toHaveProperty(key);
  const prompt = card.prompt;
  if (id === 'lcb-best') {
    for (let i = 1; i <= 3; i++) expect(prompt, `${card.id} ${lang}: A/B/C tuple doesn't bind params`).toContain(`${'ABC'[i - 1]} = (${val(p[`mu${i}`])}, ${val(p[`sigma${i}`])})`);
    expect(prompt).toContain(`β = ${val(p.beta)}`);
  } else if (id === 'thompson-pick') {
    for (let i = 1; i <= 4; i++) {
      expect(prompt, `${card.id} ${lang}: row ${i} numbers drift from audit`).toContain(`x = ${i}${lang === 'en' ? ': μ = ' : '：μ = '}${val(p[`mu${i}`])}${lang === 'en' ? ', σ = ' : '，σ = '}${val(p[`sigma${i}`])}${lang === 'en' ? ', sample value s = ' : '，样本值 s = '}${val(p[`s${i}`])}`);
    }
  } else {
    const labels: Record<string, string> = { mu: 'μ', sigma: 'σ', beta: 'β', fplus: 'f⁺', muA: 'μ', sigmaA: 'σ', muB: 'μ', sigmaB: 'σ' };
    for (const key of PARAMS[card.audit!.kind]) {
      const printed = `${labels[key]} = ${val(p[key])}`;
      expect(prompt, `${card.id} ${lang}: labeled parameter ${key}=${p[key]} missing`).toContain(printed);
    }
    if (id === 'ucb-tie' && lang === 'en') {
      expect(prompt).toContain(`μ = ${val(p.muA)} and standard deviation σ = ${val(p.sigmaA)}`);
      expect(prompt).toContain(`μ = ${val(p.muB)} and standard deviation σ = ${val(p.sigmaB)}`);
    }
    if (id === 'challenge' && lang === 'en') {
      expect(prompt).toContain(`μ = ${val(p.muA)} and standard deviation σ = ${val(p.sigmaA)}`);
      expect(prompt).toContain(`μ = ${val(p.muB)} and standard deviation σ = ${val(p.sigmaB)}`);
    }
    if (id === 'ucb-tie' && lang === 'zh') {
      expect(prompt).toContain(`μ = ${val(p.muA)}，标准差为 σ = ${val(p.sigmaA)}`);
      expect(prompt).toContain(`μ = ${val(p.muB)}，标准差为 σ = ${val(p.sigmaB)}`);
    }
    if (id === 'challenge' && lang === 'zh') {
      expect(prompt).toContain(`μ = ${val(p.muA)}，标准差 σ = ${val(p.sigmaA)}`);
      expect(prompt).toContain(`μ = ${val(p.muB)}，标准差 σ = ${val(p.sigmaB)}`);
    }
  }
}
function recompute(kind: string, p: P) {
  switch (kind) {
    case 'GP-30:ucb-score': return normalQuantile(p.mu, p.sigma, cdf(p.beta));
    case 'GP-30:ucb-tie': {
      let lo = 0, hi = 10;
      for (let i = 0; i < 64; i++) {
        const mid = (lo + hi) / 2;
        if (p.muA + mid * p.sigmaA < p.muB + mid * p.sigmaB) hi = mid; else lo = mid;
      }
      return (lo + hi) / 2;
    }
    case 'GP-30:lcb-best': return Math.min(...[1, 2, 3].map(i => normalQuantile(p[`mu${i}`], p[`sigma${i}`], cdf(-p.beta))));
    case 'GP-30:pi-lookup': return simpson(x => normPdf(x), (p.fplus - p.mu) / p.sigma, 10, 5000);
    case 'GP-30:ei-calc': return eiIntegral(p.mu, p.sigma, p.fplus);
    case 'GP-30:ei-sigma-zero': return p.mu > p.fplus ? p.mu - p.fplus : 0;
    case 'GP-30:thompson-pick': {
      const s = [1, 2, 3, 4].map(i => p[`s${i}`]);
      return s.indexOf(Math.max(...s)) + 1;
    }
    case 'GP-30:challenge': return Math.max(eiIntegral(p.muA, p.sigmaA, p.fplus), eiIntegral(p.muB, p.sigmaB, p.fplus));
    default: throw new Error(`unknown oracle kind ${kind}`);
  }
}
function assertTable(card: PracticeCard, lang: 'en' | 'zh') {
  if (!['pi-lookup', 'ei-calc', 'challenge'].some(s => card.id.endsWith(s))) return;
  const zLine = 'z = (−2, −1.5, −1, −0.5, 0, 0.5, 1, 1.5, 2)';
  const phiLine = 'φ(z) = (0.0540, 0.1295, 0.2420, 0.3521, 0.3989, 0.3521, 0.2420, 0.1295, 0.0540)';
  const cdfLine = 'Φ(z) = (0.0228, 0.0668, 0.1587, 0.3085, 0.5000, 0.6915, 0.8413, 0.9332, 0.9772)';
  for (const line of [zLine, phiLine, cdfLine]) expect(card.prompt, `${card.id} ${lang} table mismatch`).toContain(line);
}

const denominators = new Set([1, 2, 4, 5, 10, 20, 25]);
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
function reducedDenominator(x: number) {
  for (let scale of [1, 2, 4, 8, 10, 20, 40, 100]) if (close(x * scale, Math.round(x * scale), 1e-10)) return scale / gcd(Math.round(x * scale), scale);
  return 10000;
}
const gaps = (key: number, routes: number[], min: number) => routes.every(x => Math.abs(x - key) + 1e-10 >= min);
function validCounts() {
  let ucb = 0, tie = 0, lcb = 0, pi = 0, ei = 0, zero = 0, challenge = 0;
  for (let mu = 1; mu <= 5; mu++) for (const sigma of [0.5, 1, 2, 3]) for (const beta of [1.5, 2, 2.5, 3]) {
    const key = mu + beta * sigma;
    if (denominators.has(reducedDenominator(key)) && gaps(key, [mu - beta * sigma, mu + sigma, beta * mu + sigma, mu + beta * beta * sigma], 0.25)) ucb++;
  }
  for (let muA = 2; muA <= 9; muA++) for (let muB = 1; muB <= 8; muB++) for (let sigmaA = 1; sigmaA <= 5; sigmaA++) for (let sigmaB = 1; sigmaB <= 5; sigmaB++) {
    if (!(muA > muB && sigmaB > sigmaA)) continue;
    const dm = muA - muB, ds = sigmaB - sigmaA, key = dm / ds;
    if (denominators.has(reducedDenominator(key)) && key >= 1 && key <= 4 && gaps(key, [ds / dm, dm / sigmaB, dm / sigmaA, dm / (sigmaA + sigmaB)], 0.25)) tie++;
  }
  const pairs = Array.from({ length: 5 }, (_, i) => [i + 3, 0.5]).concat(Array.from({ length: 5 }, (_, i) => [i + 3, 1]), Array.from({ length: 5 }, (_, i) => [i + 3, 2]));
  for (const beta of [1, 2]) for (const A of pairs) for (const B of pairs) for (const C of pairs) {
    const rows = [A, B, C], scores = rows.map(([m, s]) => m - beta * s), uscores = rows.map(([m, s]) => m + beta * s), key = Math.min(...scores), bestS = Math.max(...rows.map(x => x[1]));
    if (key < 0.5 || scores.filter(x => x === key).length !== 1 || rows.filter(x => x[1] === bestS).length !== 1) continue;
    const worst = [Math.max(...uscores), Math.min(...rows.map(x => x[0])), Math.min(...uscores), scores[rows.findIndex(x => x[1] === bestS)], Math.max(...scores)];
    if (gaps(key, worst, 0.5)) lcb++;
  }
  for (const fplus of [2, 3, 4, 5]) for (const [sigma, zs] of [[0.5, [-2, -1, 1, 2]], [2, [-1, -0.5, 0.5, 1]]] as [number, number[]][]) for (const z of zs) {
    const mu = fplus + sigma * z, key = tab(z), routes = [tab(-z), tab((mu - fplus)), tab(z, true)];
    if (mu > 0 && gaps(key, routes, 0.03)) pi++;
  }
  for (const sigma of [1, 2]) for (const z of [-1.5, -1, -0.5, 0.5, 1, 1.5, 2]) for (const fplus of [2, 3, 4, 5]) {
    const mu = fplus + z * sigma;
    if (!(mu > 0)) continue;
    const d = mu - fplus, key = d * tab(z) + sigma * tab(z, true), routes = [d * tab(z), sigma * tab(z, true), d * tab(z) - sigma * tab(z, true), d * tab(-z) + sigma * tab(z, true)];
    if (gaps(key, routes, 0.05)) ei++;
  }
  for (const fp of [2,3,4,5]) for (let mu=1;mu<=7;mu++) if(mu!==fp) {
    const d=mu-fp,key=Math.max(0,d),routes=d>0?[0,d/2,-d,mu]:[d,-d,-d/2,mu];
    if(gaps(key,routes,0.5)) zero++;
  }
  for (const fp of [3, 4, 5]) for (const sigmaA of [1, 2]) for (const zA of [-1, -0.5, 0, 0.5, 1, 1.5]) for (const sigmaB of [1, 2]) for (const zB of [-1, -0.5, 0, 0.5, 1, 1.5]) {
    const muA = fp + zA * sigmaA, muB = fp + zB * sigmaB;
    if (muA <= 0 || muB <= 0 || sigmaA === sigmaB && zA === zB) continue;
    const ea = (muA - fp) * tab(zA) + sigmaA * tab(zA, true), eb = (muB - fp) * tab(zB) + sigmaB * tab(zB, true), key = Math.max(ea, eb);
    if (close(ea, eb, 1e-12)) continue;
    if (gaps(key, [Math.min(ea, eb), Math.max((muA - fp) * tab(zA), (muB - fp) * tab(zB)), Math.max(sigmaA * tab(zA, true), sigmaB * tab(zB, true)), Math.max(tab(zA), tab(zB))], 0.08)) challenge++;
  }
  return { ucb, tie, lcb, pi, ei, zero, choice: 4*4*3, thompson: thompsonValidCount(), challenge };
}
function thompsonValidCount() {
  const rows: [number,number,number,number][]=[];
  for(let mu=1;mu<=5;mu++) for(const sigma of [0.5,1,2]) for(let s=Math.ceil(Math.max(0,mu-2*sigma));s<=Math.floor(mu+2*sigma);s++) rows.push([mu,sigma,s,mu+2*sigma]);
  const [M,S,V]=[0,1,2].map(j=>rows.map(row=>row[j]));
  const code=rows.map(([mu,sigma])=>mu*10+sigma);
  const maxIndex=(a:number,b:number,c:number,d:number)=>{const m=Math.max(a,b,c,d),n=Number(a===m)+Number(b===m)+Number(c===m)+Number(d===m);return n!==1?-1:a===m?0:b===m?1:c===m?2:3;};
  let count=0;
  for(let i=0;i<rows.length;i++) for(let j=0;j<rows.length;j++) {
    if(code[i]===code[j]) continue;
    for(let k=0;k<rows.length;k++) {
      if(code[k]===code[i]||code[k]===code[j]) continue;
      for(let l=0;l<rows.length;l++) {
        if(code[l]===code[i]||code[l]===code[j]||code[l]===code[k]) continue;
        const s=maxIndex(V[i],V[j],V[k],V[l]),m=maxIndex(M[i],M[j],M[k],M[l]),u=maxIndex(S[i],S[j],S[k],S[l]);
        if(s>=0&&m>=0&&u>=0&&s!==m&&s!==u&&m!==u) count++;
      }
    }
  }
  return count;
}

describe('GP-30 independent acquisition-function acceptance', () => {
  it('allows valid sample winners that also maximize UCB when the UCB route ties', () => {
    const rows = [{mu:3,sigma:1,s:5},{mu:4,sigma:0.5,s:3},{mu:1,sigma:2,s:0},{mu:2,sigma:0.5,s:2}];
    const argmax = (key: 'mu'|'sigma'|'s') => rows.findIndex(row => row[key] === Math.max(...rows.map(r => r[key])));
    const ucb = rows.map(row => row.mu + 2*row.sigma);
    expect(argmax('s')).toBe(0); expect(argmax('mu')).toBe(1); expect(argmax('sigma')).toBe(2);
    expect(ucb).toEqual([5,5,5,3]); expect(ucb.indexOf(Math.max(...ucb))).toBe(argmax('s'));
  });
  it('recomputes every audited answer by quantile, numerical integration, or sampled-function argmax', () => {
    const counts: Record<string, number> = Object.fromEntries(kinds.map(k => [k, 0]));
    for (let seed = 0; seed < SEEDS; seed++) for (const lang of ['en', 'zh'] as const) {
      const cards = gp30(spreadSeed(seed), lang);
      expect(cards).toHaveLength(9);
      expect(cards.map(c => c.id)).toEqual(['ucb-score','ucb-tie','lcb-best','pi-lookup','ei-calc','ei-sigma-zero','pi-vs-ei','thompson-pick','challenge'].map(x => `GP-30-${x}`));
      const seen = new Set<string>();
      for (const card of cards) {
        expect(card.figure, `${card.id}: approved plan has no figures`).toBeUndefined();
        expect(card.choice?.figures, `${card.id}: approved plan has no option figures`).toBeUndefined();
        expect(card.prompt, `${card.id}: direction must be stated`).toContain(lang === 'en' ? card.id.includes('lcb-best') ? 'minimise' : 'maximise' : card.id.includes('lcb-best') ? '最小化' : '最大化');
        if (card.audit) {
          const kind = card.audit.kind;
          expect(PARAMS, `${card.id}: unexpected audit kind ${kind}`).toHaveProperty(kind);
          expect(seen.has(kind), `${card.id}: duplicate audit kind ${kind}`).toBe(false);
          seen.add(kind);
          const p = params(card), expected = recompute(kind, p), answer = answerOf(card), tol = card.fields![0].tolerance;
          expect(tol, `${card.id}: tolerance`).toBe(0.006);
          expect(Math.abs(answer - expected), `${card.id} seed ${seed} ${lang}, params ${JSON.stringify(p)}: expected ${expected}, got ${answer}`).toBeLessThanOrEqual(kind === 'GP-30:pi-lookup' ? 5e-5 : kind === 'GP-30:ei-calc' || kind === 'GP-30:challenge' ? 2e-4 : 1e-8);
          expect(gradeCard(card, [expected.toFixed(2)], null, []), `${card.id}: rounded independent answer should grade`).toBe('correct');
          expect(gradeCard(card, [(expected + Math.max(tol! * 1.2, 0.01)).toString()], null, []), `${card.id}: answer outside tolerance should fail`).toBe('incorrect');
          expect(seen.size).toBeGreaterThan(0);
          assertParamLabels(card, lang);
          assertTable(card, lang);
          counts[kind]++;
        }
      }
      expect([...seen].sort()).toEqual([...kinds].sort());
      const choice = cardBy(cards, 'pi-vs-ei');
      expect(choice.choice, 'counterexample card needs options').toBeDefined();
      expect(choice.audit).toBeUndefined();
      const numberToken = '([−-]?\\d+(?:\\.\\d+)?)';
      const fpMatch = choice.prompt.match(new RegExp(`f⁺ = ${numberToken}`));
      const stdMatches = [...choice.prompt.matchAll(new RegExp(`σ = ${numberToken}`, 'g'))];
      const cp = { fplus: Number(fpMatch?.[1].replace('−','-')), sigmaA: Number(stdMatches[0]?.[1].replace('−','-')), sigmaB: Number(stdMatches[1]?.[1].replace('−','-')) };
      expect([2,3,4,5]).toContain(cp.fplus);
      expect([0.5,1,2,4]).toContain(cp.sigmaA);
      expect([0.5,1,2,4]).toContain(cp.sigmaB);
      expect(cp.sigmaA).not.toBe(cp.sigmaB);
      const big = cp.sigmaA > cp.sigmaB ? 'A' : 'B', small = big === 'A' ? 'B' : 'A';
      expect(choice.prompt).toContain(`f⁺ = ${val(cp.fplus)}`);
      if (lang === 'en') {
        expect(choice.prompt).toContain(`σ = ${val(cp.sigmaA)} at A`);
        expect(choice.prompt).toContain(`σ = ${val(cp.sigmaB)} at B`);
      } else {
        expect(choice.prompt).toContain(`后验标准差在 A 处为 σ = ${val(cp.sigmaA)}，在 B 处为 σ = ${val(cp.sigmaB)}`);
      }
      const options = choice.choice!.options;
      const verdicts = options.map(text => lang === 'en'
        ? text.includes('PI is the same at both points') && text.includes(`EI is larger at point ${big}`)
        : text.includes('两点的改进概率相同') && text.includes(`期望改进在点${big}更大`));
      expect(verdicts.filter(Boolean), `${lang} exactly one option expresses the true PI/EI relation`).toHaveLength(1);
      expect(verdicts[choice.choice!.answer], `${lang} answer index must point to semantic correct option`).toBe(true);
      const wrong = options.filter((_, i) => !verdicts[i]);
      expect(wrong).toHaveLength(3);
      for (const expectedWrong of lang === 'en'
        ? [`Both PI and EI are larger at point ${big}, because both reward uncertainty`, 'PI and EI are both the same, because the means are equal', `PI is the same at both points, but EI is larger at point ${small}, the more certain one`]
        : [`改进概率和期望改进都在点${big}更大，因为两者都奖励不确定性`, '改进概率与期望改进都相同，因为均值相等', `两点的改进概率相同，但期望改进在点${small}更大，因为${small}更确定`]) expect(wrong).toContain(expectedWrong);
      expect(options[choice.choice!.answer].length).toBeLessThan(Math.max(...wrong.map(x => x.length)));
      expect(options[choice.choice!.answer].length).toBeGreaterThan(Math.min(...wrong.map(x => x.length)));
      expect(choice.hint).not.toContain(lang === 'en' ? 'EI is larger' : '期望改进在点');
    }
    for (const kind of kinds) expect(counts[kind], `${kind} should fire each seed in both locales`).toBe(SEEDS * 2);
  });

  it('uses exactly the finite sampler sets and route-gap filters in the approved plan', () => {
    // Every emitted numeric tuple must satisfy the exact approved-space predicates.
    const all = new Set(kinds);
    for (let i = 0; i < SEEDS; i++) for (const card of gp30(spreadSeed(i), 'en')) if (card.audit) {
      const p = params(card), kind = card.audit.kind;
      expect(all.has(kind)).toBe(true);
      if (kind === 'GP-30:ucb-score') {
        const key = p.mu + p.beta * p.sigma;
        expect([1,2,3,4,5]).toContain(p.mu); expect([0.5,1,2,3]).toContain(p.sigma); expect([1.5,2,2.5,3]).toContain(p.beta);
        expect(denominators.has(reducedDenominator(key))).toBe(true);
        expect(gaps(key,[p.mu-p.beta*p.sigma,p.mu+p.sigma,p.beta*p.mu+p.sigma,p.mu+p.beta*p.beta*p.sigma],0.25)).toBe(true);
      } else if (kind === 'GP-30:ucb-tie') {
        const key=(p.muA-p.muB)/(p.sigmaB-p.sigmaA), dm=p.muA-p.muB, ds=p.sigmaB-p.sigmaA;
        expect(p.muA).toBeGreaterThan(p.muB); expect(p.sigmaB).toBeGreaterThan(p.sigmaA); expect(key).toBeGreaterThanOrEqual(1); expect(key).toBeLessThanOrEqual(4); expect(denominators.has(reducedDenominator(key))).toBe(true);
        expect(gaps(key,[ds/dm,dm/p.sigmaB,dm/p.sigmaA,dm/(p.sigmaA+p.sigmaB)],0.25)).toBe(true);
      } else if (kind === 'GP-30:lcb-best') {
        expect([1,2]).toContain(p.beta);
        const rows=[1,2,3].map(j=>[p[`mu${j}`],p[`sigma${j}`]]), scores=rows.map(([m,s])=>m-p.beta*s), us=rows.map(([m,s])=>m+p.beta*s), key=Math.min(...scores);
        expect(rows.every(([m,s])=>[3,4,5,6,7].includes(m)&&[0.5,1,2].includes(s))).toBe(true);
        expect(key).toBeGreaterThanOrEqual(0.5); expect(scores.filter(x=>x===key)).toHaveLength(1); expect(rows.filter(x=>x[1]===Math.max(...rows.map(y=>y[1])))).toHaveLength(1);
        expect(gaps(key,[Math.max(...us),Math.min(...rows.map(x=>x[0])),Math.min(...us),scores[rows.findIndex(x=>x[1]===Math.max(...rows.map(y=>y[1])))],Math.max(...scores)],0.5)).toBe(true);
      } else if (kind === 'GP-30:pi-lookup') {
        const z=(p.mu-p.fplus)/p.sigma, key=tab(z);
        expect([2,3,4,5]).toContain(p.fplus); expect([0.5,2]).toContain(p.sigma); expect([-2,-1,-0.5,0.5,1,2]).toContain(z); expect(p.mu).toBeGreaterThan(0);
        expect(gaps(key,[tab(-z),tab(p.mu-p.fplus),tab(z,true)],0.03)).toBe(true);
      } else if (kind === 'GP-30:ei-calc') {
        const z=(p.mu-p.fplus)/p.sigma,d=p.mu-p.fplus,key=d*tab(z)+p.sigma*tab(z,true);
        expect([2,3,4,5]).toContain(p.fplus); expect([1,2]).toContain(p.sigma); expect([-1.5,-1,-0.5,0.5,1,1.5,2]).toContain(z); expect(p.mu).toBeGreaterThan(0);
        expect(gaps(key,[d*tab(z),p.sigma*tab(z,true),d*tab(z)-p.sigma*tab(z,true),d*tab(-z)+p.sigma*tab(z,true)],0.05)).toBe(true);
      } else if (kind === 'GP-30:ei-sigma-zero') {
        expect([2,3,4,5]).toContain(p.fplus); expect([1,2,3,4,5,6,7]).toContain(p.mu); expect(p.mu).not.toBe(p.fplus);
        const d=p.mu-p.fplus,key=Math.max(0,d),routes=d>0?[0,d/2,-d,p.mu]:[d,-d,-d/2,p.mu];
        expect(gaps(key,routes,0.5)).toBe(true);
      } else if (kind === 'GP-30:thompson-pick') {
        const rows=[1,2,3,4].map(j=>[p[`mu${j}`],p[`sigma${j}`],p[`s${j}`]]), im=(j:number)=>rows.findIndex(r=>r[j]===Math.max(...rows.map(x=>x[j])));
        expect(rows.every(([m,s,v])=>[1,2,3,4,5].includes(m)&&[0.5,1,2].includes(s)&&Number.isInteger(v)&&v>=Math.max(0,m-2*s)&&v<=m+2*s)).toBe(true);
        expect(new Set(rows.map(([m,s])=>`${m},${s}`)).size).toBe(4);
        expect([0,1,2].every(j=>rows.filter(r=>r[j]===Math.max(...rows.map(x=>x[j]))).length===1)).toBe(true);
        expect(im(2)).not.toBe(im(0)); expect(im(2)).not.toBe(im(1)); expect(im(0)).not.toBe(im(1));
      } else if (kind === 'GP-30:challenge') {
        const zA=(p.muA-p.fplus)/p.sigmaA,zB=(p.muB-p.fplus)/p.sigmaB, ea=(p.muA-p.fplus)*tab(zA)+p.sigmaA*tab(zA,true),eb=(p.muB-p.fplus)*tab(zB)+p.sigmaB*tab(zB,true),key=Math.max(ea,eb);
        expect([3,4,5]).toContain(p.fplus); expect([1,2]).toContain(p.sigmaA); expect([1,2]).toContain(p.sigmaB); expect([-1,-0.5,0,0.5,1,1.5]).toContain(zA); expect([-1,-0.5,0,0.5,1,1.5]).toContain(zB); expect(p.muA).toBeGreaterThan(0); expect(p.muB).toBeGreaterThan(0);
        expect(`${p.sigmaA}:${zA}`).not.toBe(`${p.sigmaB}:${zB}`); expect(close(ea,eb,1e-12)).toBe(false);
        expect(gaps(key,[Math.min(ea,eb),Math.max((p.muA-p.fplus)*tab(zA),(p.muB-p.fplus)*tab(zB)),Math.max(p.sigmaA*tab(zA,true),p.sigmaB*tab(zB,true)),Math.max(tab(zA),tab(zB))],0.08)).toBe(true);
      }
    }
    const tsRows = Array.from({ length: 5 }, (_, j) => j + 1).flatMap(mu => [0.5,1,2].flatMap(sigma => Array.from({length: Math.floor(mu+2*sigma)-Math.ceil(Math.max(0,mu-2*sigma))+1}, (_,j)=>({mu,sigma,s:Math.ceil(Math.max(0,mu-2*sigma))+j}))));
    expect(tsRows).toHaveLength(78);
  });

  it('independently enumerates the approved finite-space counts', () => {
    // Exact Cartesian enumeration of every small tuple family and all printed route guards.
    expect(validCounts()).toEqual({ ucb: 68, tie: 112, lcb: 1008, pi: 31, ei: 53, zero: 24, choice: 48, thompson: 332400, challenge: 300 });
  });

  it('has at least six prompt variants for each parameterised card', () => {
    for (const slug of ['ucb-score','ucb-tie','lcb-best','pi-lookup','ei-calc','ei-sigma-zero','pi-vs-ei','thompson-pick','challenge']) {
      const variants = new Set(Array.from({ length: SEEDS }, (_, i) => cardBy(gp30(spreadSeed(i), 'en'), slug).prompt));
      expect(variants.size, `${slug} variants`).toBeGreaterThanOrEqual(6);
    }
  });
});
