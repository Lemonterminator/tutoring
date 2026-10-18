import { describe, expect, it } from 'vitest';
import { gps1 } from './games/gps1';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { runOracle, simpson, type Oracle } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard, type PracticeCard } from '../types';

const SEEDS = 60;
const kernels = new Set(['GP-S1:box-integral','GP-S1:derivative-cov','GP-S1:conv-kernel','GP-S1:challenge']);
const cleanNumber = (n: number) => Math.abs(n);
const close = (a:number,b:number,tol=1e-7) => Math.abs(a-b) <= tol*Math.max(1,Math.abs(a),Math.abs(b));
const oracles: Record<string,Oracle> = {
 'GP-S1:box-integral': p => {
   const a=p.a as number,b=p.b as number,w=p.width as number;
   return [simpson(tau => (a+b*tau),-w/2,w/2,100)];
 },
 'GP-S1:derivative-cov': p => {
   const sigma2=p.sigma2 as number,ell=p.ell as number;
   const k=(x:number,xp:number)=>sigma2*Math.exp(-((x-xp)**2)/(2*ell**2));
   const mixedAt=(h:number)=>(k(h,h)-k(h,-h)-k(-h,h)+k(-h,-h))/(4*h*h);
   const coarse=mixedAt(0.01),fine=mixedAt(0.005),mixed=(4*fine-coarse)/3;
   return [mixed];
 },
 'GP-S1:conv-kernel': p => {
   const s=p.diagonal as number,c=p.offDiagonal as number;
   // Covariance of [g(0),g(-1)] is [[s,c],[c,s]]. Apply the convolution map [1,1] on both sides.
   const K=[[s,c],[c,s]],v=[1,1];
   const Kv=K.map(row=>row.reduce((sum,x,j)=>sum+x*v[j],0));
   return [v.reduce((sum,x,i)=>sum+x*Kv[i],0)];
 },
 'GP-S1:challenge': p => [(p.fMinus as number)+(2*(p.fZero as number))+(p.fPlus as number)],
};

const tuple=(p:Record<string,number>,keys:string[])=>keys.map(k=>p[k]).join(',');
const allowed:Record<string,Set<string>>={
 'GP-S1:box-integral':new Set(['1,1,2','1,2,1','2,1,2','2,2,1','3,1,2','3,2,1']),
 'GP-S1:derivative-cov':new Set(['1,1','1,2','2,1','2,2','3,1','3,2']),
 'GP-S1:conv-kernel':new Set(['1,0.5','1,0.25','2,1','2,0.5','3,1.5','3,0.75']),
 'GP-S1:challenge':new Set(['1,0,1','0,1,1','1,1,0','2,1,0','0,2,1','1,2,1']),
};
const paramsFor:Record<string,string[]>={
 'GP-S1:box-integral':['a','b','width'], 'GP-S1:derivative-cov':['sigma2','ell'],
 'GP-S1:conv-kernel':['diagonal','offDiagonal'], 'GP-S1:challenge':['fMinus','fZero','fPlus'],
};
function visibleNumbers(text:string):Set<number>{return new Set([...text.replaceAll('−','-').matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Math.abs(Number(m[0]))));}
function parsedInputs(card:PracticeCard):number[]{
 const q=card.prompt.replaceAll('−','-');
 const patterns:Record<string,RegExp>={
  'box-integral':/f\(τ\)\s*=\s*(-?\d+(?:\.\d+)?)\s*\+\s*(?:(-?\d+(?:\.\d+)?)τ|τ)[\s\S]*?\|t\|\s*<\s*(-?\d+(?:\.\d+)?)\s*\/\s*2/,
  'derivative-cov':/σ²\s*=\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*|\s+and\s+|[，、]\s*)ℓ\s*=\s*(-?\d+(?:\.\d+)?)/i,
  'conv-kernel':/k_g\(0,0\)=k_g\(-?1,-?1\)\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]*?k_g\(0,-?1\)=k_g\(-?1,0\)\s*=\s*(-?\d+(?:\.\d+)?)/,
  challenge:/f\(-?1\)\s*=\s*(-?\d+(?:\.\d+)?)[,，、][\s\S]*?f\(0\)\s*=\s*(-?\d+(?:\.\d+)?)[,，、][\s\S]*?f\(1\)\s*=\s*(-?\d+(?:\.\d+)?)/,
 };
 const id=card.id.replace(/^GP-S1-/,'');const match=q.match(patterns[id]);
 if(!match) throw new Error(`${card.id}: cannot parse visible sampled inputs from prompt: ${q}`);
 if(id==='box-integral') return [Number(match[1]), Number(match[2] ?? 1), Number(match[3])];
 return match.slice(1).map(Number);
}
function isCorrect(kind:string,text:string):boolean{
 if(kind==='conv-def') return /distributiv|分配律/i.test(text);
 if(kind==='discrete-map') return /linear map|matrix.vector|线性映射|矩阵向量乘法/i.test(text);
 if(kind==='linear-gp') return /(covariance.*transformed|协方差.*变换)/i.test(text) && /(Gaussian process|GP|高斯过程)/i.test(text);
 if(kind==='assumption-check') return /(nonlinear|非线性)/i.test(text) && /(squar|平方)/i.test(text);
 throw new Error(`unknown choice predicate ${kind}`);
}

describe('GP-S1 independent definition oracles',()=>{
 for(const [kind,oracle] of Object.entries(oracles)) it(`${kind}: 60 spread seeds, EN and ZH`,()=>{
   const count=runOracle('GP-S1',(seed,lang)=>gps1(spreadSeed(seed),lang).filter(card=>card.audit?.kind===kind),{[kind]:oracle},SEEDS);
   expect(count[kind]).toBe(SEEDS);
 });
 it('covers exactly the approved audit kinds and no unreviewed numeric cards',()=>{
   const seen=new Set<string>();
   for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) for(const card of gps1(spreadSeed(i),lang)) {
     if(card.fields) expect(card.audit,card.id).toBeDefined();
     if(card.audit) { expect(oracles[card.audit.kind],card.audit.kind).toBeTypeOf('function'); seen.add(card.audit.kind); }
   }
   expect(seen).toEqual(kernels);
 });
 it('prints every audit parameter and uses only the approved finite sampler sets',()=>{
   for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) for(const card of gps1(spreadSeed(i),lang)) if(card.audit){
     const p=card.audit.params,visible=visibleNumbers(card.prompt),keys=paramsFor[card.audit.kind];
     for(const key of keys) expect(visible.has(cleanNumber(p[key] as number)),`${card.id} ${lang} missing ${key}=${p[key]}`).toBe(true);
     expect(parsedInputs(card),`${card.id} ${lang} printed input parse`).toEqual(keys.map(key=>p[key] as number));
     expect(allowed[card.audit.kind].has(tuple(p as Record<string,number>,keys)),`${card.id} params ${JSON.stringify(p)}`).toBe(true);
   }
 });
 it('accepts the independent answer and rejects a perturbation beyond tolerance',()=>{
   for(let i=0;i<SEEDS;i++) for(const card of gps1(spreadSeed(i),'en')) if(card.fields){
     expect(card.audit).toBeDefined();
     const answer=oracles[card.audit!.kind](card.audit!.params) as number[];
     expect(gradeCard(card,[String(answer[0])],null,[])).toBe('correct');
     expect(gradeCard(card,[String(answer[0]+0.01)],null,[])).toBe('incorrect');
   }
 });
 it('has exactly one plan-correct option for each choice and retains the specified answer index',()=>{
   const known=new Set(['conv-def','discrete-map','linear-gp','assumption-check']);
   for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) for(const card of gps1(spreadSeed(i),lang)) {
     expect(card.figure,card.id).toBeUndefined();
     if(card.choice){
       const kind=card.id.replace(/^GP-S1-/,''); expect(known.has(kind),kind).toBe(true);
       const verdicts=card.choice.options.map(x=>isCorrect(kind,x));
       expect(verdicts.filter(Boolean),card.id).toHaveLength(1);
       expect(verdicts[card.choice.answer],card.id).toBe(true);
     }
   }
 });
 it('varies every sampled card at least six ways and keeps the planned eight-card sequence',()=>{
   const prompts=new Map<string,Set<string>>(); let ids:string[]=[];
   for(let i=0;i<SEEDS;i++) { const cards=gps1(spreadSeed(i),'en'); ids=cards.map(c=>c.id); for(const card of cards){const set=prompts.get(card.id)??new Set<string>();set.add(card.prompt);prompts.set(card.id,set);} }
   expect(ids.map(x=>x.replace(/^GP-S1-/,''))).toEqual(['conv-def','box-integral','discrete-map','derivative-cov','linear-gp','conv-kernel','assumption-check','challenge']);
   for(const id of ['box-integral','derivative-cov','conv-kernel','challenge']) expect(prompts.get(`GP-S1-${id}`)!.size,id).toBeGreaterThanOrEqual(6);
 });
});
