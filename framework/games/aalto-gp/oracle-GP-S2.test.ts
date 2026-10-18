import { describe, expect, it } from 'vitest';
import { gps2 } from './games/gps2';
import { spreadSeed } from '../mit-multivariable-calculus/deck-invariants';
import { runOracle, simpson, type Oracle } from '../mit-multivariable-calculus/oracle-harness';
import { gradeCard } from '../types';

const SEEDS=60;
const kinds=new Set(['GP-S2:markov-predictive-variance','GP-S2:differential-model-mean','GP-S2:npode-displacement','GP-S2:challenge']);
const oracles:Record<string,Oracle>={
 'GP-S2:markov-predictive-variance':p=>{
   // Monte Carlo variance identity from independent centered normal components, evaluated analytically via their second moments.
   const vf=p.functionVariance as number,vw=p.systemVariance as number;
   const E_f2=vf,E_w2=vw,E_fw=0;
   return [E_f2+E_w2+2*E_fw];
 },
 'GP-S2:differential-model-mean':p=>{
   const x=p.x as number,m=p.driftMean as number;
   return [simpson(()=>x+m,0,1,100)];
 },
 'GP-S2:npode-displacement':p=>{
   const a=p.field as number,dt=p.deltaT as number;
   return [simpson(tau=>a,0,dt,100)];
 },
 'GP-S2:challenge':p=>{
   const x0=p.initialState as number,a=p.field as number,dt=p.deltaT as number;
   return [x0+simpson(tau=>a,0,dt,100)];
 },
};
const allowed:Record<string,Set<string>>={
 'GP-S2:markov-predictive-variance':new Set(['1,1','1,2','2,1','2,3','3,2','4,1']),
 'GP-S2:differential-model-mean':new Set(['1,-1','2,-1','3,-2','4,-2','5,-3','6,-4']),
 'GP-S2:npode-displacement':new Set(['1,1','-1,2','2,1','-2,2','1,3','-1,3']),
 'GP-S2:challenge':new Set(['0,1,2','1,1,2','2,-1,2','3,2,1','4,-2,1','5,1,2']),
};
const paramsFor:Record<string,string[]>={
 'GP-S2:markov-predictive-variance':['functionVariance','systemVariance'],
 'GP-S2:differential-model-mean':['x','driftMean'],
 'GP-S2:npode-displacement':['field','deltaT'],
 'GP-S2:challenge':['initialState','field','deltaT'],
};
const tuple=(p:Record<string,number>,keys:string[])=>keys.map(k=>p[k]).join(',');
function visibleNumbers(text:string):Set<number>{return new Set([...text.replaceAll('−','-').matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Math.abs(Number(m[0]))));}
function parsedInputs(card:import('../types').PracticeCard):number[]{
 const q=card.prompt.replaceAll('−','-');
 const id=card.id.replace(/^GP-S2-/,'');
 if(id==='npode-displacement'){
   const field=q.match(/f\(x\)\s*=\s*(-?\d+(?:\.\d+)?)/),dt=q.match(/Δt\s*=\s*(-?\d+(?:\.\d+)?)/);
   if(!field||!dt)throw new Error(`${card.id}: cannot parse field and interval`);
   return [Number(field[1]),Number(dt[1])];
 }
 if(id==='challenge'){
   const x0=q.match(/x₀\s*=\s*(-?\d+(?:\.\d+)?)/),field=q.match(/f\(x\)\s*=\s*(-?\d+(?:\.\d+)?)/),dt=q.match(/Δt\s*=\s*(-?\d+(?:\.\d+)?)/);
   if(!x0||!field||!dt)throw new Error(`${card.id}: cannot parse initial state, field and interval`);
   return [Number(x0[1]),Number(field[1]),Number(dt[1])];
 }
 const patterns:Record<string,RegExp>={
  'markov-predictive-variance':/(?:variance of f\(xₜ\) is |方差为 )(-?\d+(?:\.\d+)?)[\s\S]*?(?:system-noise variance is |系统噪声方差为 )(-?\d+(?:\.\d+)?)/i,
  'differential-model-mean':/xₜ\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]*?\|D\]\s*=(-?\d+(?:\.\d+)?)/,
  'npode-displacement':/f\(x\)\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]*?Δt\s*=\s*(-?\d+(?:\.\d+)?)/,
  challenge:/x₀\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]*?f\(x\)\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]*?Δt\s*=\s*(-?\d+(?:\.\d+)?)/,
 };
 const match=q.match(patterns[id]);
 if(!match) throw new Error(`${card.id}: cannot parse visible sampled inputs from prompt: ${q}`);
 return match.slice(1).map(Number);
}
function isCorrect(kind:string,text:string):boolean{
 if(kind==='independent-outputs') return /diagonal|对角/.test(text) && (/kernel|核/.test(text));
 if(kind==='markov-property') return /given x|earlier state history|current state.*(history|earlier)|(history|earlier).*current state|给定 x|当前状态.*(历史|更早)|当前状态屏蔽/i.test(text);
 if(kind==='noisy-state-observation') return /measurement noise|测量噪声/i.test(text);
 throw new Error(`unknown choice predicate ${kind}`);
}

describe('GP-S2 independent definition oracles',()=>{
 for(const [kind,oracle] of Object.entries(oracles)) it(`${kind}: 60 spread seeds, EN and ZH`,()=>{
   const counts=runOracle('GP-S2',(seed,lang)=>gps2(spreadSeed(seed),lang).filter(card=>card.audit?.kind===kind),{[kind]:oracle},SEEDS);
   expect(counts[kind]).toBe(SEEDS);
 });
 it('covers exactly the approved audit kinds and no unreviewed numeric cards',()=>{
   const seen=new Set<string>();
   for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) for(const card of gps2(spreadSeed(i),lang)){
     if(card.fields) expect(card.audit,card.id).toBeDefined();
     if(card.audit){expect(oracles[card.audit.kind],card.audit.kind).toBeTypeOf('function');seen.add(card.audit.kind);}
   }
   expect(seen).toEqual(kinds);
 });
 it('prints all audit inputs and samples only the approved tuples',()=>{
   for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) for(const card of gps2(spreadSeed(i),lang)) if(card.audit){
     const p=card.audit.params,visible=visibleNumbers(card.prompt),keys=paramsFor[card.audit.kind];
     for(const key of keys) expect(visible.has(Math.abs(p[key] as number)),`${card.id} ${lang} missing ${key}=${p[key]}`).toBe(true);
     expect(parsedInputs(card),`${card.id} ${lang} printed input parse`).toEqual(keys.map(key=>p[key] as number));
     expect(allowed[card.audit.kind].has(tuple(p as Record<string,number>,keys)),`${card.id} params ${JSON.stringify(p)}`).toBe(true);
   }
 });
 it('grades the independent answer correct and a beyond-tolerance perturbation wrong',()=>{
   for(let i=0;i<SEEDS;i++) for(const card of gps2(spreadSeed(i),'en')) if(card.fields){
     const answer=oracles[card.audit!.kind](card.audit!.params) as number[];
     expect(gradeCard(card,[String(answer[0])],null,[])).toBe('correct');
     expect(gradeCard(card,[String(answer[0]+0.01)],null,[])).toBe('incorrect');
   }
 });
 it('checks choice predicates and the exact sensitivity formula with reachable tokens',()=>{
   const choiceIds=new Set(['independent-outputs','markov-property','noisy-state-observation']);
   for(let i=0;i<SEEDS;i++) for(const lang of ['en','zh'] as const) for(const card of gps2(spreadSeed(i),lang)){
     expect(card.figure,card.id).toBeUndefined();
     if(card.choice){const id=card.id.replace(/^GP-S2-/,'');expect(choiceIds.has(id)).toBe(true);const v=card.choice.options.map(x=>isCorrect(id,x));expect(v.filter(Boolean),`${card.id}: ${JSON.stringify(card.choice.options)}`).toHaveLength(1);expect(v[card.choice.answer]).toBe(true);}
     if(card.slots){
       const answers=card.slots.answers;
       expect(answers).toEqual(['J(t)','R(t)']);
       for(const token of answers) expect(card.slots.tokens).toContain(token);
       const assembled=`${card.slots.before}${answers[0]}${card.slots.between?.[0]??''}${answers[1]}${card.slots.after??''}`.replace(/\s/g,'');
       expect(assembled).toBe('Ṡ(t)=J(t)S(t)+R(t)');
     }
   }
 });
 it('states the noise mean and conditions Markov claims on a fixed transition function',()=>{
   for(const lang of ['en','zh'] as const){
     const cs=gps2(spreadSeed(3),lang);
     const mean=cs.find(c=>c.id==='GP-S2-differential-model-mean')!;
     const markov=cs.find(c=>c.id==='GP-S2-markov-property')!;
     expect(mean.prompt).toMatch(/zero-mean|零均值/);
     expect(mean.prompt).toMatch(/training data D|D 为已观测训练数据/);
     expect(markov.prompt).toMatch(/fixed transition function f|固定转移函数 f/);
     expect(markov.explanation).toMatch(/Integrating over an uncertain shared f|对不确定的共享函数 f 积分/);
   }
 });
 it('has six planned variants per sampled numeric card and the planned eight-card sequence',()=>{
   const prompts=new Map<string,Set<string>>();let ids:string[]=[];
   for(let i=0;i<SEEDS;i++){const cards=gps2(spreadSeed(i),'en');ids=cards.map(c=>c.id);for(const card of cards){const s=prompts.get(card.id)??new Set<string>();s.add(card.prompt);prompts.set(card.id,s);}}
   expect(ids.map(x=>x.replace(/^GP-S2-/,''))).toEqual(['markov-predictive-variance','differential-model-mean','independent-outputs','markov-property','npode-displacement','sensitivity-ode','noisy-state-observation','challenge']);
   for(const id of ['markov-predictive-variance','differential-model-mean','npode-displacement','challenge']) expect(prompts.get(`GP-S2-${id}`)!.size,id).toBeGreaterThanOrEqual(6);
 });
});
