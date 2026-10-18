import { describe, expect, it } from 'vitest';
import { gp28 } from './games/gp28';
import { spreadSeed, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, type PracticeCard, type GameLanguage } from '../types';

/** Written from approved-GP-28.md before inspecting gp28.ts. The continuous-time
 * Gaussian calculations are checked through numerical Fourier/Lyapunov integrals. */
const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];
const ORDER = ['spectral-ou','lambda-from-peak','stationary-var','cov-from-sde','spectral-from-sde','unit-variance-qc','state-dim','markov-exact','challenge'];
const NUMERIC = new Set(ORDER.filter(x => x !== 'markov-exact'));
const KINDS = new Set([...NUMERIC].map(x => `GP-28:${x}`));
const close = (a: number, b: number, tol = 1e-7) => Math.abs(a-b) <= tol * Math.max(1,Math.abs(a),Math.abs(b));
const cards = (i: number, lang: GameLanguage) => gp28(spreadSeed(i),lang) as PracticeCard[];
const bySlug = (cs: PracticeCard[], slug: string) => {
  const c = cs.find(x => x.id === `GP-28-${slug}`);
  if (!c) throw new Error(`missing ${slug}`);
  return c;
};
const prompt = (c: PracticeCard) => questionTextOf(c).join(' ');
const numbers = (s: string) => [...s.replaceAll('−','-').matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
function labeled(s: string, label: string): number {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const m = new RegExp(`${esc}\\s*=\\s*\\(?(-?\\d+(?:\\.\\d+)?)\\)?`).exec(s);
  if (!m) throw new Error(`missing ${label} in ${s}`);
  return Number(m[1]);
}
function auditParams(s: string, labels: Record<string,string>) {
  return Object.fromEntries(Object.entries(labels).map(([k,v]) => [k,labeled(s,v)]));
}

// Composite Simpson integration of a decaying cosine transform, independently
// implementing the Fourier definition shown in the question.
function cosineTransform(f: (t:number)=>number, omega:number, end=500): number {
  const n=Math.max(20000,Math.ceil(end*100)), h=end/n;
  let sum=f(0)+f(end);
  for(let i=1;i<n;i++) sum+=(i%2?4:2)*f(i*h)*Math.cos(omega*i*h);
  return 2*sum*h/3;
}
function expIntegral(rate:number, omega=0, end=500): number {
  return cosineTransform(t=>Math.exp(-rate*t),omega,end);
}
function approxRoot(fn:(x:number)=>number, lo:number, hi:number): number {
  let a=lo,b=hi,fa=fn(a);
  for(let i=0;i<100;i++){const m=(a+b)/2,fm=fn(m); if((fa<0)===(fm<0)){a=m;fa=fm}else b=m;}
  return (a+b)/2;
}
function independent(kind:string,p:Record<string,number>):number {
  switch(kind){
    case 'GP-28:spectral-ou': return expIntegral(p.lam,p.om);
    case 'GP-28:lambda-from-peak': return approxRoot(l=>expIntegral(l,0,700)-p.s0,0.001,100);
    case 'GP-28:stationary-var': {
      // Solve the stationary covariance as the infinite-time integral of the
      // white-noise impulse response squared.
      const n=20000,end=500,h=end/n; let sum=1+Math.exp(-2*p.lam*end);
      for(let i=1;i<n;i++) sum+=(i%2?4:2)*Math.exp(-2*p.lam*i*h);
      return p.qc*sum*h/3;
    }
    case 'GP-28:cov-from-sde': {
      const tau=-Math.log(p.a)/p.lam;
      const n=20000,end=500,h=end/n; let sum=Math.exp(-p.lam*tau)+Math.exp(-p.lam*(2*end+tau));
      for(let i=1;i<n;i++) sum+=(i%2?4:2)*Math.exp(-p.lam*(2*i*h+tau));
      return p.qc*sum*h/3;
    }
    case 'GP-28:spectral-from-sde': return cosineTransform(t=>p.L*p.L*p.qc/(2*p.lam)*Math.exp(-p.lam*t),p.om);
    case 'GP-28:unit-variance-qc': {
      // Stationary variance of the Euler-discretized SDE, then take dt -> 0.
      const dt=1e-9; return (1-(1-p.lam*dt)**2)/dt;
    }
    case 'GP-28:state-dim': {
      // Build the state operator orders: direct sums add block orders; the
      // Kronecker sum has one state for every pair of component states.
      const blockDiagonalOrder=(x:number,y:number)=>x+y;
      const kroneckerSumOrder=(x:number,y:number)=>x*y;
      return p.form===1 ? kroneckerSumOrder(blockDiagonalOrder(p.m1,p.m2),p.m3) : blockDiagonalOrder(kroneckerSumOrder(p.m1,p.m2),p.m3);
    }
    case 'GP-28:challenge': return p.s2*expIntegral(1/p.ell,p.om);
    default: throw new Error(`unknown audit kind ${kind}`);
  }
}
function wrongRoutes(kind:string,p:Record<string,number>):number[] {
  const {lam,om,qc,a,L,s2,ell,form,m1,m2,m3,s0}=p;
  switch(kind){
    case 'GP-28:spectral-ou': return [2/(lam*lam+om*om),lam/(lam*lam+om*om),2*lam/((lam+om)**2),2/lam];
    case 'GP-28:lambda-from-peak': return [1/s0,s0,4/s0,s0/2];
    case 'GP-28:stationary-var': return [qc/lam,qc/(2*lam*lam),2*lam/qc,qc/2];
    case 'GP-28:cov-from-sde': return [qc/(2*lam),a*qc/lam,a*qc,a*a*qc/(2*lam),(1-a*a)*qc/(2*lam)];
    case 'GP-28:spectral-from-sde': return [L*qc/(lam*lam+om*om),qc/(lam*lam+om*om),L*L*qc/((lam+om)**2),L*L*qc/(lam*lam+om),2*lam*L*L*qc/(lam*lam+om*om)];
    case 'GP-28:unit-variance-qc': return [2,lam,lam/2,2*lam*lam];
    case 'GP-28:state-dim': return form===1?[m1+m2+m3,m1*m2*m3,m1+m2*m3,m1*m3+m2]:[m1+m2+m3,m1*m2*m3,m1*(m2+m3),(m1+m2)*m3];
    case 'GP-28:challenge': return [2*s2*ell/(ell*ell+om*om),(2*s2/ell)/(1+om*om),2*ell/(1+ell*ell*om*om),2*s2*ell/(1+ell*om*om),(2*s2/ell)/(ell*ell+om*om)];
    default: throw new Error(`unknown kind ${kind}`);
  }
}

const LABELS: Record<string,Record<string,string>>={
  'spectral-ou':{lam:'λ',om:'ω'}, 'lambda-from-peak':{s0:'S(0)'},
  'stationary-var':{lam:'λ',qc:'Qc'}, 'cov-from-sde':{lam:'λ',qc:'Qc',a:'exp(−λτ)'},
  'spectral-from-sde':{lam:'λ',L:'L',qc:'Qc',om:'ω'}, 'unit-variance-qc':{lam:'λ'},
  'state-dim':{m1:'m₁',m2:'m₂',m3:'m₃'}, challenge:{s2:'σ²',ell:'ℓ',om:'ω'}
};

describe('GP-28 independent acceptance oracle',()=>{
  it('audits every numeric kind, printed parameter, grading result, plan range and variety across 60 seeds in EN/ZH',()=>{
    const fired=new Set<string>(), prompts=new Map<string,Set<string>>();
    for(let i=0;i<SEEDS;i++) for(const lang of LANGS){
      const cs=cards(i,lang);
      expect(cs.map(c=>c.id)).toEqual(ORDER.map(x=>`GP-28-${x}`));
      for(const slug of NUMERIC){
        const c=bySlug(cs,slug), kind=`GP-28:${slug}`, q=prompt(c), a=c.audit;
        expect(a?.kind).toBe(kind); fired.add(a!.kind);
        const p=a!.params as Record<string,number>;
        const printed=auditParams(q,LABELS[slug]);
        if (slug === 'state-dim') {
          printed.form = q.includes('(κ₁ + κ₂) κ₃') ? 1 : 2;
          const printedBranch = q.match(/(?:Kernel construction|核的构造) ([12])/);
          expect(printedBranch).not.toBeNull();
          expect(Number(printedBranch![1])).toBe(printed.form);
          expect(q).toMatch(/without state reduction|不做状态降维/);
        }
        expect(printed).toEqual(p);
        const expected=independent(kind,p), field=c.fields?.[0];
        expect(field).toBeDefined();
        expect(Math.abs(field!.answer-expected), `${kind} ${lang} ${JSON.stringify(p)}`).toBeLessThan(0.001);
        const minGap=slug==='spectral-ou'?0.1:slug==='spectral-from-sde'||slug==='unit-variance-qc'?0.5:slug==='state-dim'?1:0.25;
        const guardKey=slug==='cov-from-sde'?p.a*p.qc/(2*p.lam):expected;
        for(const route of wrongRoutes(kind,p)) expect(Math.abs(route-guardKey),`${kind} wrong-route gap ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(minGap-1e-6);
        if(slug==='spectral-ou') for(const v of [p.lam,p.om]) expect(Number.isInteger(v*2)&&v>=0.5&&v<=6).toBe(true);
        if(slug==='lambda-from-peak') expect([0.1,0.2,0.25,0.4,0.5,0.8,1.6,4].includes(p.s0)).toBe(true);
        if(slug==='stationary-var') expect([2,3,4,5].includes(p.lam)&&[1,2,3,4,5,6,8,10,12].includes(p.qc)).toBe(true);
        if(slug==='cov-from-sde') expect([1,2,4,5].includes(p.lam)&&[2,4,5,6,8,10,12].includes(p.qc)&&[0.2,0.25,0.4,0.5,0.75,0.8].includes(p.a)).toBe(true);
        if(slug==='spectral-from-sde') expect([1,2,3,4].includes(p.lam)&&[2,3].includes(p.L)&&[1,2,3,4].includes(p.qc)&&[1,2,3,4].includes(p.om)).toBe(true);
        if(slug==='unit-variance-qc') expect([0.5,1.5,2,2.5,4,5,7,10].includes(p.lam)).toBe(true);
        if(slug==='state-dim') expect([1,2].includes(p.form)&&[1,2,3].includes(p.m1)&&[1,2,3].includes(p.m2)&&[1,2,3].includes(p.m3)).toBe(true);
        if(slug==='challenge') expect([0.5,1,1.5,2,3,4].includes(p.s2)&&[0.5,1,2,4].includes(p.ell)&&[0.5,1,1.5,2,3].includes(p.om)).toBe(true);
        expect(field!.tolerance).toBe(0.006);
        expect(gradeCard(c,[String(expected)],null,[])).toBe('correct');
        const wrong=expected + Math.max(0.02,field!.tolerance!*4);
        expect(gradeCard(c,[String(wrong)],null,[])).toBe('incorrect');
        expect(close(field!.answer,expected,0.006)).toBe(true);
        const key=`${slug}:${lang}`; if(!prompts.has(key))prompts.set(key,new Set()); prompts.get(key)!.add(q);
        expect(c.figure).toBeUndefined();
      }
      const choice=bySlug(cs,'markov-exact'), q=prompt(choice), opts=choice.choice?.options;
      expect(choice.audit).toBeUndefined(); expect(opts).toHaveLength(4);
      const spectrum=q.slice(q.indexOf('S(ω) =')+7);
      const isGaussian=spectrum.includes('exp(−ω²/');
      const truth=(s:string)=>isGaussian ? /^(S is not a constant|S 不是常数)/.test(s) : /^(S is a constant|S 是常数)/.test(s);
      const good=opts!.map((o,j)=>truth(o)?j:-1).filter(j=>j>=0);
      expect(good).toHaveLength(1);
      expect(choice.choice!.answer).toBe(good[0]);
      expect(choice.choice!.figures).toBeUndefined();
      const ckey=`markov-exact:${lang}`; if(!prompts.has(ckey))prompts.set(ckey,new Set());prompts.get(ckey)!.add(q);
      for(const c of cs) for(const f of c.figure?[c.figure]:[]) expect(questionTextOf(c).join(' ')).not.toContain(String(c.fields?.[0]?.answer));
    }
    expect([...fired].sort()).toEqual([...KINDS].sort());
    for(const [key,set] of prompts) if(!key.startsWith('markov-exact:')) expect(set.size, key).toBeGreaterThanOrEqual(6);
  }, 30000);
});
