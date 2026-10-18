export type DistributionInputs = {
  logits: "toy" | "peaked";
  temperature: number;
  top_k: number;
  top_p: number;
};

export type DistributionState = { seed: number; step: number; max_steps: number };

const LOGITS: Record<DistributionInputs["logits"], number[]> = {
  toy: [2.0, 0.5, -1.0, 1.2, -0.4],
  peaked: [4.0, 1.0, 0.2, -0.8, -1.5],
};

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const weights = values.map((value) => Math.exp(value - maximum));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

function renormalize(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total === 0 ? values.map(() => 0) : values.map((value) => value / total);
}

function applyTopK(probabilities: number[], k: number): number[] {
  const count = Math.max(1, Math.min(probabilities.length, Math.floor(Number(k))));
  const order = probabilities.map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const keep = new Set(order.slice(0, count).map((item) => item.index));
  return renormalize(probabilities.map((value, index) => keep.has(index) ? value : 0));
}

function applyTopP(probabilities: number[], p: number): number[] {
  const threshold = Math.max(0.1, Math.min(1, Number(p)));
  const order = probabilities.map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  let cumulative = 0;
  const keep = new Set<number>();
  for (const item of order) {
    keep.add(item.index);
    cumulative += item.value;
    if (cumulative >= threshold) break;
  }
  return renormalize(probabilities.map((value, index) => keep.has(index) ? value : 0));
}

function entropy(probabilities: number[]): number {
  return -probabilities.reduce((sum, value) => sum + (value > 0 ? value * Math.log(value) : 0), 0);
}

export function compute(inputs: DistributionInputs, state: DistributionState) {
  const logits = LOGITS[inputs.logits] ?? LOGITS.toy;
  const temperature = Math.max(0.1, Number(inputs.temperature));
  const base = softmax(logits.map((value) => value / temperature));
  const topK = applyTopK(base, inputs.top_k);
  const probabilities = applyTopP(topK, inputs.top_p);
  return {
    logits,
    baseProbabilities: base,
    probabilities,
    entropy: entropy(probabilities),
    retainedSupport: probabilities.filter((value) => value > 0).length,
    sum: probabilities.reduce((sum, value) => sum + value, 0),
    step: state.step,
    reset: state.step === 0,
  };
}
