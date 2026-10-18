import { describe, expect, it } from 'vitest';
import { gp28 } from './games/gp28';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import type { PracticeCard } from '../types';

const DENOMS = [1, 2, 4, 5, 10, 20, 25];
const nice = (x: number) => DENOMS.some(d => Math.abs(x*d-Math.round(x*d)) < 1e-9);
const gap = (key: number, routes: number[], floor: number) => routes.every(r => Math.abs(key-r)+1e-12 >= floor);
const set = (xs: string[]) => new Set(xs);

// The parameter domains and acceptance predicates below are transcribed from
// the approved plan's finite-space tables, not from the generator.
function plannedSpaces(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {
    'spectral-ou': set(['0.5,0.5','0.5,1','0.5,1.5','1.5,0.5','1.5,2','2,1','2,1.5','2,2','2.5,2.5','3,4','4,2','4,3','4,4','5,5']),
    'lambda-from-peak': new Set(), 'stationary-var': new Set(), 'cov-from-sde': new Set(),
    'spectral-from-sde': new Set(), 'unit-variance-qc': new Set(), 'state-dim': new Set(),
    'markov-exact': new Set(), 'challenge': new Set(),
  };
  for (const s0 of [.1,.2,.25,.4,.5,.8,1.6,2,4,5]) { const k=2/s0; if(nice(k)&&gap(k,[1/s0,s0,4/s0,s0/2],.25)) out['lambda-from-peak'].add(`${s0}`); }
  for (const lam of [2,3,4,5]) for (const qc of [1,2,3,4,5,6,8,10,12]) { const k=qc/(2*lam); if(nice(k)&&gap(k,[qc/lam,qc/(2*lam*lam),2*lam/qc,qc/2],.25)) out['stationary-var'].add(`${lam},${qc}`); }
  for (const lam of [1,2,4,5]) for (const qc of [2,4,5,6,8,10,12]) for (const a of [.2,.25,.4,.5,.75,.8]) { const k=a*qc/(2*lam); if(nice(k)&&gap(k,[qc/(2*lam),a*qc/lam,a*qc,a*a*qc/(2*lam),(1-a*a)*qc/(2*lam)],.25)) out['cov-from-sde'].add(`${lam},${qc},${a}`); }
  for (const lam of [1,2,3,4]) for (const L of [2,3]) for (const qc of [1,2,3,4]) for (const om of [1,2,3,4]) { const k=L*L*qc/(lam*lam+om*om); if(nice(k)&&gap(k,[L*qc/(lam*lam+om*om),qc/(lam*lam+om*om),L*L*qc/(lam+om)**2,L*L*qc/(lam*lam+om),2*lam*L*L*qc/(lam*lam+om*om)],.5)) out['spectral-from-sde'].add(`${lam},${L},${qc},${om}`); }
  for (const lam of [.5,1.5,2,2.5,4,5,7,10]) { const k=2*lam; if(nice(k)&&gap(k,[2,lam,lam/2,2*lam*lam],.5)) out['unit-variance-qc'].add(`${lam}`); }
  for (const form of [1,2]) for (const m1 of [1,2,3]) for (const m2 of [1,2,3]) for (const m3 of [1,2,3]) { const k=form===1?(m1+m2)*m3:m1*m2+m3; const r=form===1?[m1+m2+m3,m1*m2*m3,m1+m2*m3,m1*m3+m2]:[m1+m2+m3,m1*m2*m3,m1*(m2+m3),(m1+m2)*m3]; if(gap(k,r,1)) out['state-dim'].add(`${form},${m1},${m2},${m3}`); }
  for (const s2 of [.5,1,1.5,2,3,4]) for (const ell of [.5,1,2,4]) for (const om of [.5,1,1.5,2,3]) { const k=2*s2*ell/(1+ell*ell*om*om); if(nice(k)&&gap(k,[2*s2*ell/(ell*ell+om*om),(2*s2/ell)/(1+om*om),2*ell/(1+ell*ell*om*om),2*s2*ell/(1+ell*om*om),(2*s2/ell)/(ell*ell+om*om)],.25)) out.challenge.add(`${s2},${ell},${om}`); }
  for (const family of [1,2]) for (const a of [1,2,3]) for (const c of [2,4,6]) out['markov-exact'].add(`${family},${a},${c}`);
  for (const b of [2,4,8]) for (const c of [1,2,3]) out['markov-exact'].add(`3,${b},${c}`);
  return out;
}

function sampledKey(card: PracticeCard, slug: string): string {
  if (slug === 'markov-exact') {
    const q = String(card.prompt);
    const spectrum = q.split('S(ω) = ')[1].split('. Which')[0];
    if (spectrum.includes('exp(')) { const [, c, b] = spectrum.match(/(\d+)·exp\(−ω²\/(\d+)\)/)!; return `3,${b},${c}`; }
    const [, c, a, squared] = spectrum.match(/(\d+) \/ \((\d+)²? \+ ω²\)(²)?/)!;
    const family = squared ? 2 : 1;
    return `${family},${Math.sqrt(Number(a))},${c}`;
  }
  const p = card.audit!.params as Record<string, number>;
  const keys: Record<string, string[]> = {
    'spectral-ou':['lam','om'], 'lambda-from-peak':['s0'], 'stationary-var':['lam','qc'],
    'cov-from-sde':['lam','qc','a'], 'spectral-from-sde':['lam','L','qc','om'],
    'unit-variance-qc':['lam'], 'state-dim':['form','m1','m2','m3'], challenge:['s2','ell','om'],
  };
  return keys[slug].map(k => p[k]).join(',');
}

describe('GP-28 approved sampler-space coverage', () => {
  it('reaches every explicitly approved tuple and all 27 choice variants', () => {
    const expected = plannedSpaces();
    expect(Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,v.size]))).toEqual({
      'spectral-ou':14,'lambda-from-peak':8,'stationary-var':18,'cov-from-sde':62,
      'spectral-from-sde':22,'unit-variance-qc':8,'state-dim':27,'markov-exact':27,'challenge':20,
    });
    const observed: Record<string,Set<string>> = Object.fromEntries(Object.keys(expected).map(k=>[k,new Set<string>()]));
    for(let i=0;i<12000;i++) for(const card of gp28(spreadSeed(i),'en') as PracticeCard[]) {
      const slug=card.id.replace(/^GP-28-/,'');
      if(slug==='markov-exact'||card.audit) observed[slug].add(sampledKey(card,slug));
    }
    for(const slug of Object.keys(expected)) {
      const missing=[...expected[slug]].filter(x=>!observed[slug].has(x));
      const unexpected=[...observed[slug]].filter(x=>!expected[slug].has(x));
      expect({missing,unexpected},`${slug}: observed ${observed[slug].size}/${expected[slug].size}`).toEqual({missing:[],unexpected:[]});
    }
  }, 30000);
});
