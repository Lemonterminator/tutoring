import { describe, expect, it } from 'vitest';
import { gpf2 } from './games/gpf2';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { close } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard, type PracticeCard } from '../types';

const SEEDS = 60;
const KINDS = ['GP-F2:diagonal-weight', 'GP-F2:precision-weight', 'GP-F2:regression-beta', 'GP-F2:residual-var', 'GP-F2:shrinkage-delta', 'GP-F2:challenge'] as const;
type P = Record<string, number>;
const p = (card: PracticeCard): P => card.audit?.params as P;
const cardBy = (cards: PracticeCard[], id: string) => {
  const card = cards.find(item => item.id === `GP-F2-${id}`);
  expect(card, `missing GP-F2-${id}`).toBeDefined();
  return card!;
};
const fracText = (value: number): string => {
  for (let d = 1; d <= 10000; d++) { const n = Math.round(value * d); if (close(value, n / d, 1e-12)) return d === 1 ? String(n) : `${n}/${d}`; }
  throw new Error(`not a small rational: ${value}`);
};
const visibleNumbers = (text: string) => {
  const normalized = text.replaceAll('−', '-');
  const found = new Set([...normalized.matchAll(/(?<![A-Za-z])[-+]?\d+(?:\.\d+)?/g)].map(m => Number(m[0])));
  for (const m of normalized.matchAll(/(?<![\w.])(-?\d+)\s*\/\s*(\d+)(?![\w.])/g)) found.add(Number(m[1]) / Number(m[2]));
  return found;
};
const lit=(x:number)=>String(x).replaceAll('-','−');
function assertParamsVisible(card: PracticeCard, lang: 'en' | 'zh') {
  const numbers = visibleNumbers(card.prompt);
  for (const [key, value] of Object.entries(p(card))) {
    expect(numbers.has(value), `${card.id} ${lang}: ${key}=${value} absent from prompt: ${card.prompt}`).toBe(true);
    const label = key === 'rho' ? 'ρ' : key === 'mu' ? 'μ' : key;
    expect(card.prompt, `${card.id} ${lang}: ${label} is not visibly bound to audit value ${value}`).toContain(`${label} = ${lit(value)}`);
  }
  const q=p(card), id=card.id.replace('GP-F2-',''), exactText: Record<string,string[]>={
    'diagonal-weight': [`Σ = [[${q.a}, 0], [0, ${q.b}]]`],
    'precision-weight': [`Θ = Σ⁻¹ = [[${q.a}, ${lit(q.b)}], [${lit(q.b)}, ${q.c}]]`],
    'regression-beta': [`Θ = [[${q.a}, ${lit(q.b)}], [${lit(q.b)}, ${q.c}]]`],
    'residual-var': [`Θ = [[${q.a}, ${lit(q.b)}], [${lit(q.b)}, ${q.c}]]`],
    'shrinkage-delta': [`ρ = ${q.rho}`, `μ = ${q.mu}`],
    'challenge': [`S = [[${q.a}, ${lit(q.c)}], [${lit(q.c)}, ${q.b}]]`, `d = ${q.d}`],
  };
  for(const snippet of exactText[id]??[]) expect(card.prompt,`${card.id} ${lang}: sampled data representation changed`).toContain(snippet);
}
const determinant = (a: number, b: number, c: number) => a * c - b * b;
const invert2 = (a: number, b: number, c: number): number[][] => {
  const det = determinant(a, b, c);
  if (!(det > 0)) throw new Error(`precision matrix not SPD: [[${a},${b}],[${b},${c}]]`);
  return [[c / det, -b / det], [-b / det, a / det]];
};
// KKT/derivative route: stationary point of t -> [t,1-t] Σ [t,1-t] is (Σ22-Σ12)/(Σ11+Σ22-2Σ12).
const kktWeight = (S: number[][]) => (S[1][1] - S[0][1]) / (S[0][0] + S[1][1] - 2 * S[0][1]);
function recompute(kind: string, q: P): number {
  switch (kind) {
    case 'GP-F2:diagonal-weight': {
      // Derivative of a*t²+b*(1-t)² equals zero; solve the linear stationarity equation.
      const derivativeAtZero = -2 * q.b, secondDerivative = 2 * (q.a + q.b);
      return -derivativeAtZero / secondDerivative;
    }
    case 'GP-F2:precision-weight': {
      const covariance = invert2(q.a, q.b, q.c);
      return kktWeight(covariance); // invert precision, then solve the covariance-form KKT condition
    }
    case 'GP-F2:regression-beta': {
      const covariance = invert2(q.a, q.b, q.c);
      return covariance[0][1] / covariance[1][1]; // Gaussian conditional regression coefficient
    }
    case 'GP-F2:residual-var': {
      const covariance = invert2(q.a, q.b, q.c);
      return covariance[0][0] - covariance[0][1] ** 2 / covariance[1][1]; // Schur complement
    }
    case 'GP-F2:shrinkage-delta': {
      // Match coefficients in A=(1-rho)S+rho*mu*I and B=S+delta*I after dividing A by (1-rho).
      const scaledAIdentity = q.rho * q.mu / (1 - q.rho);
      return scaledAIdentity;
    }
    case 'GP-F2:challenge': {
      const covariance = [[q.a + q.d, q.c], [q.c, q.b + q.d]];
      if (!(determinant(covariance[0][0], covariance[0][1], covariance[1][1]) > 0)) throw new Error('challenge covariance not SPD');
      return kktWeight(covariance);
    }
    default: throw new Error(`unknown GP-F2 oracle kind: ${kind}`);
  }
}
function tuple(...values: number[]) { return values.join(','); }
function allowed(kind: string, q: P): boolean {
  if (kind === 'GP-F2:diagonal-weight') return [[1,1],[1,3],[3,1],[1,4],[4,1],[2,3],[3,2],[2,2],[2,6],[6,2],[3,3],[4,4]].some(v => tuple(...v) === tuple(q.a,q.b));
  if (kind === 'GP-F2:precision-weight') {
    const space = [2,4,6].flatMap(a => [2,4,6].flatMap(c => [-1,1].map(b => ({a,b,c})))).filter(v => v.a*v.c > v.b*v.b).filter(v => { const s=v.a+v.c+2*v.b, w=(v.a+v.b)/s; return 0<w && w<1 && (function den(x:number){for(let d=1;d<=10;d++)if(Math.abs(x*d-Math.round(x*d))<1e-10)return d;return 11;})(w)<=10; });
    return space.some(v => tuple(v.a,v.b,v.c) === tuple(q.a,q.b,q.c));
  }
  if (kind === 'GP-F2:regression-beta' || kind === 'GP-F2:residual-var') return [2,4].includes(q.a) && [-2,-1,1,2].includes(q.b) && [4,6].includes(q.c) && q.a*q.c > q.b*q.b;
  if (kind === 'GP-F2:shrinkage-delta') return [0.5,0.75].includes(q.rho) && [2,4,6].includes(q.mu);
  if (kind === 'GP-F2:challenge') {
    if (![2,4].includes(q.a) || ![4,6].includes(q.b) || ![-1,1].includes(q.c) || ![1,2].includes(q.d)) return false;
    const den=q.a+q.b+2*q.d-2*q.c, val=(q.b+q.d-q.c)/den;
    const reducedDen=Array.from({length:10},(_,i)=>i+1).find(x=>Math.abs(val*x-Math.round(val*x))<1e-10);
    return q.a*q.b>q.c*q.c && den>0 && reducedDen!==undefined;
  }
  return false;
}

describe('GP-F2 independent precision, conditioning and KKT oracle', () => {
  it('recomputes all six audit kinds over 60 spread seeds in EN and ZH', () => {
    const counts = Object.fromEntries(KINDS.map(kind => [kind, 0])) as Record<string, number>;
    for (let i=0;i<SEEDS;i++) for (const lang of ['en','zh'] as const) {
      const cards=gpf2(spreadSeed(i),lang) as PracticeCard[];
      for (const card of cards) {
        if (!card.audit) { if(card.fields) throw new Error(`${card.id} has an unaudited numeric answer`); continue; }
        expect(KINDS,`${card.id}: unknown audit kind ${card.audit.kind}`).toContain(card.audit.kind);
        counts[card.audit.kind]++;
        const q=p(card);
        expect(allowed(card.audit.kind,q),`${card.id} seed ${i}: outside approved tuple space ${JSON.stringify(q)}`).toBe(true);
        assertParamsVisible(card,lang);
        const expected=recompute(card.audit.kind,q), actual=card.fields?.[0].answer;
        expect(card.fields).toHaveLength(1);
        const tol=card.fields![0].tolerance??1e-8;
        expect(tol,`${card.id} should retain approved 0.006 tolerance`).toBe(0.006);
        expect(Math.abs(actual!-expected),`${card.id} seed ${i}, params ${JSON.stringify(q)}: expected ${expected}, got ${actual}`).toBeLessThanOrEqual(tol);
        expect(gradeCard(card,[fracText(expected)],null,[]),`${card.id} seed ${i}: oracle value accepted`).toBe('correct');
        expect(gradeCard(card,[(Math.round(expected*100)/100).toFixed(2)],null,[]),`${card.id} seed ${i}: two-decimal rounded answer accepted`).toBe('correct');
        expect(gradeCard(card,[fracText(expected+Math.max(2*tol,0.01))],null,[]),`${card.id} seed ${i}: perturbed value rejected`).toBe('incorrect');
      }
    }
    for(const kind of KINDS) expect(counts[kind],`${kind} count`).toBe(SEEDS*2);
  });

  it('checks all parameterized card prompt variants', () => {
    const ids=['diagonal-weight','precision-weight','regression-beta','residual-var','shrinkage-delta','scale-invariance','singular-limit','challenge'];
    for(const id of ids) {
      const prompts=new Set(Array.from({length:SEEDS},(_,i)=>cardBy(gpf2(spreadSeed(i),'en') as PracticeCard[],id).prompt));
      expect(prompts.size,`GP-F2-${id} variants`).toBeGreaterThanOrEqual(6);
    }
  });

  it('choice predicates uniquely identify scale invariance and singular covariance behavior', () => {
    const unchanged=(s:string)=>/unchanged|same weights|do not change|不变/.test(s.toLowerCase());
    const noInverse=(s:string)=>/inverse (?:does not exist|is absent|cannot)|no inverse|not invertible|逆不存在|不可逆/.test(s.toLowerCase());
    for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) {
      const cards=gpf2(spreadSeed(i),lang) as PracticeCard[];
      const scale=cardBy(cards,'scale-invariance');
      expect(scale.choice!.options.filter(unchanged)).toHaveLength(1);
      expect(unchanged(scale.choice!.options[scale.choice!.answer])).toBe(true);
      const singular=cardBy(cards,'singular-limit');
      expect(singular.choice!.options.filter(noInverse)).toHaveLength(1);
      expect(noInverse(singular.choice!.options[singular.choice!.answer])).toBe(true);
    }
  });

  it('approved-space sanity: filters and worked examples agree', () => {
    const T=[2,4,6].flatMap(a=>[2,4,6].flatMap(c=>[-1,1].map(b=>({a,b,c})))).filter(v=>v.a*v.c>v.b*v.b).filter(v=>{const den=v.a+v.c+2*v.b, w=(v.a+v.b)/den;return 0<w&&w<1&&Array.from({length:10},(_,i)=>i+1).some(d=>Math.abs(w*d-Math.round(w*d))<1e-10);});
    const U=[2,4].flatMap(a=>[4,6].flatMap(b=>[-1,1].flatMap(c=>[1,2].map(d=>({a,b,c,d}))))).filter(v=>v.a*v.b>v.c*v.c).filter(v=>Array.from({length:10},(_,i)=>i+1).some(k=>Math.abs((v.b+v.d-v.c)*k/(v.a+v.b+2*v.d-2*v.c)-Math.round((v.b+v.d-v.c)*k/(v.a+v.b+2*v.d-2*v.c)))<1e-10));
    expect(T).toHaveLength(16); // plan says 18; two tuples fail its denominator / interval filters
    expect(U).toHaveLength(12); // plan says 14; four tuples fail its denominator filter
    expect((6+1-1)/(2+6+2*1-2*1)).toBeCloseTo(0.75); // approved example (2,6,1,1) is correctly 3/4
    expect(kktWeight([[2+1,1],[1,6+1]])).toBeCloseTo(0.75); // independent covariance-form stationarity for that tuple
  });
});
