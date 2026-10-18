import { describe, expect, it } from 'vitest';
import { gp31 } from './games/gp31';
import { spreadSeed, questionTextOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard } from '../types';

const SEEDS = 60;
const ID = 'GP-31';
const expectedKinds = new Set([
  'GP-31:simple-regret', 'GP-31:compound-error', 'GP-31:ucb-model-set', 'GP-31:challenge',
]);
const rows = {
  'simple-regret': [[12,8,10,7],[15,11,9,13],[9,6,8,5],[20,16,12,18],[7,4,6,3],[14,12,10,9]],
  'compound-error': [[1,2],[2,3],[1,3],[3,5],[2,5],[4,6]],
  challenge: [[2,1,3,.5],[1,2,4,.5],[3,2,1,.25],[4,1,2,.5],[2,4,1,.25],[1,3,2,.5]],
} as const;
const close = (a: number, b: number, tol: number) => Math.abs(a-b) <= tol;
const visibleNumbers = (s: string) => [...s.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g)].map(m => Number(m[0]));
const expected = (kind: string, p: Record<string, number | number[]>) => {
  if (kind.endsWith(':simple-regret')) {
    const vals = [p.y1, p.y2, p.y3] as number[];
    // Scan, rather than invoking the plan's max expression.
    let best = vals[0]; for (const v of vals.slice(1)) if (v > best) best = v;
    return Number(p.optimum) - best;
  }
  if (kind.endsWith(':compound-error')) return Number(p.error1) + Number(p.error2);
  if (kind.endsWith(':ucb-model-set')) {
    // Evaluate the endpoint from the right side of the absolute-value interval.
    const radius = Number(p.beta) * Number(p.sigma_f);
    const endpoints = [Number(p.mu_f)-radius, Number(p.mu_f)+radius];
    return Math.max(...endpoints);
  }
  if (kind.endsWith(':challenge')) {
    const g = Number(p.gamma);
    return [Number(p.r0), Number(p.r1)*g, Number(p.r2)*g*g].reduce((sum, term) => sum+term, 0);
  }
  throw new Error(`unrecognized audit kind ${kind}`);
};
function isCorrectOption(cardId: string, option: string): boolean {
  const t = option.toLowerCase();
  if (cardId.endsWith('bo-step')) return /highest acquisition score|采集函数得分最高/.test(t);
  if (cardId.endsWith('model-bias')) return /inaccurate.{0,70}exploits those inaccuracies|模型不准确.{0,40}利用这些误差/.test(t);
  if (cardId.endsWith('gp-dynamics')) return /latent transition value.{0,80}mean μ_f and variance σ²_f|潜在转移值.{0,50}均值为 μ_f，方差为 σ²_f/.test(t);
  if (cardId.endsWith('greedy-vs-ts')) return /posterior \(thompson\) sampling|后验（汤普森）采样/.test(t);
  if (cardId.endsWith('mpc-step')) return /only the first action|只应用序列中的第一个动作/.test(t);
  return false;
}

describe('GP-31 blind approved-plan oracle', () => {
  it('recomputes every numeric audit kind, visible inputs, and tolerance in EN and ZH', () => {
    const seen = new Set<string>();
    const prompts = new Map<string, Set<string>>();
    for (let i=0; i<SEEDS; i++) for (const lang of ['en','zh'] as const) {
      const cards = gp31(spreadSeed(i), lang);
      for (const card of cards) {
        if (!card.fields) continue;
        expect(card.audit, `${card.id} missing audit`).toBeDefined();
        const kind = card.audit!.kind;
        expect(expectedKinds.has(kind), `unknown kind ${kind}`).toBe(true);
        seen.add(kind);
        const p = card.audit!.params;
        const nums = visibleNumbers(questionTextOf(card).join(' '));
        for (const [name, raw] of Object.entries(p)) {
          for (const value of Array.isArray(raw) ? raw : [raw])
            expect(nums.some(n => close(n, Number(value), 1e-8)), `${card.id}/${lang}: hidden ${name}=${value}`).toBe(true);
        }
        const answer = expected(kind, p);
        expect(card.fields).toHaveLength(1);
        expect(card.fields![0].tolerance, `${card.id} tolerance`).toBe(0.006);
        expect(close(card.fields![0].answer, answer, 0.006), `${card.id}/${lang}: expected ${answer}, got ${card.fields![0].answer}`).toBe(true);
        const good = gradeCard(card, [String(answer)], null, []);
        expect(good, `${card.id}/${lang} oracle answer`).toBe('correct');
        expect(gradeCard(card, [String(answer + 0.02)], null, []), `${card.id}/${lang} perturb`).toBe('incorrect');
        const set = prompts.get(card.id) ?? new Set<string>(); set.add(card.prompt); prompts.set(card.id, set);
      }
    }
    expect(seen).toEqual(expectedKinds);
    for (const kind of expectedKinds) expect(prompts.get(`${ID}-${kind.split(':')[1]}`)?.size ?? 0, `${kind} prompt variety`).toBeGreaterThanOrEqual(6);
  });

  it('uses the approved exact finite numeric input spaces', () => {
    const got = new Set<string>();
    for (let i=0; i<SEEDS; i++) for (const card of gp31(spreadSeed(i), 'en')) if (card.audit) {
      const k = card.audit.kind, p = card.audit.params;
      got.add(`${k}:${JSON.stringify(p)}`);
      if (k.endsWith(':simple-regret')) expect(rows['simple-regret'].some(r => r.every((v,j) => [p.optimum,p.y1,p.y2,p.y3][j] === v))).toBe(true);
      if (k.endsWith(':compound-error')) expect(rows['compound-error'].some(r => r[0] === p.error1 && r[1] === p.error2)).toBe(true);
      if (k.endsWith(':challenge')) expect(rows.challenge.some(r => r.every((v,j) => [p.r0,p.r1,p.r2,p.gamma][j] === v))).toBe(true);
      if (k.endsWith(':ucb-model-set')) expect([1,2,3,4,5,6].includes(Number(p.mu_f)) && [0.5,1,2].includes(Number(p.sigma_f)) && [1,2,3,4,5,6].includes(Number(p.beta))).toBe(true);
    }
    const ucb = [...got].filter(x => x.startsWith('GP-31:ucb-model-set:'));
    expect(ucb.length).toBeGreaterThanOrEqual(6);
    for (const level of [1,2,3,4,5,6]) expect(ucb.some(x => x.includes(`"mu_f":${level}`))).toBe(true);
    for (const level of [0.5,1,2]) expect(ucb.some(x => x.includes(`"sigma_f":${level}`))).toBe(true);
    for (const level of [1,2,3,4,5,6]) expect(ucb.some(x => x.includes(`"beta":${level}`))).toBe(true);
    for (const k of ['simple-regret','compound-error','challenge']) expect([...got].filter(x => x.startsWith(`GP-31:${k}:`)).length).toBe(6);
  });

  it('reaches all 108 approved UCB model-set tuples and all six BO candidate rows', () => {
    const ucbTuples = new Set<string>();
    for (let i=0; i<12000; i++) {
      const card = gp31(spreadSeed(i), 'en').find(c => c.id.endsWith('ucb-model-set'))!;
      const p = card.audit!.params;
      ucbTuples.add(`${p.mu_f},${p.sigma_f},${p.beta}`);
    }
    expect(ucbTuples.size).toBe(108);
    const boRows = new Set<string>();
    for (let i=0; i<SEEDS; i++) {
      const card = gp31(spreadSeed(i), 'en').find(c => c.id.endsWith('bo-step'))!;
      const values = visibleNumbers(card.prompt);
      boRows.add(JSON.stringify([values.slice(0,3), values.slice(3,6)]));
    }
    const approvedRows = [
      [[1,3,2],[2,1,4]], [[4,1,3],[1,5,2]], [[2,5,1],[3,2,4]],
      [[5,2,4],[1,4,3]], [[3,1,5],[4,2,1]], [[1,4,2],[3,1,5]],
    ].map(row => JSON.stringify(row));
    expect(boRows).toEqual(new Set(approvedRows));
  });

  it('checks each choice semantically, exactly one option, and correct answer index in both languages', () => {
    for (let i=0; i<SEEDS; i++) for (const lang of ['en','zh'] as const) {
      for (const card of gp31(spreadSeed(i), lang)) {
        if (!card.choice) continue;
        const verdicts = card.choice.options.map(o => isCorrectOption(card.id, o));
        expect(verdicts.filter(Boolean), `${card.id}/${lang}: choices ${JSON.stringify(card.choice.options)}`).toHaveLength(1);
        expect(verdicts[card.choice.answer], `${card.id}/${lang}: wrong choice index`).toBe(true);
        if (card.id.endsWith('bo-step')) {
          const nums = visibleNumbers(card.prompt);
          const scores = nums.slice(3, 6);
          const bestIndex = scores.reduce((best, value, index) => value > scores[best] ? index : best, 0) + 1;
          const explanation = card.explanation.match(/candidate (\d+)|候选点 (\d+)/i);
          expect(explanation, 'BO explanation must name the next candidate').toBeTruthy();
          expect(Number(explanation![1] ?? explanation![2]), `${card.id}/${lang}: wrong argmax`).toBe(bestIndex);
        }
      }
    }
  });
});
