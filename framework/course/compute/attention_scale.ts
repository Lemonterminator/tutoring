export type AttentionScaleInputs = { dk?: number; scaled?: boolean; seed?: number };

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function logitsFor(dk: number, seed: number): number[] {
  return Array.from({ length: 32 }, (_, index) => {
    const phase = (index + 1) * (seed + 1) * 0.173;
    const base = Math.sin(phase) + 0.35 * Math.cos(phase * 1.7);
    return base * Math.sqrt(dk);
  });
}

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  const average = mean(values);
  return mean(values.map((value) => (value - average) ** 2));
}

function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, probability) => sum - (probability > 0 ? probability * Math.log(probability) : 0), 0);
}

function softmaxJacobianFrobenius(probabilities: number[]): number {
  let squared = 0;
  for (let i = 0; i < probabilities.length; i += 1) {
    for (let j = 0; j < probabilities.length; j += 1) {
      const entry = probabilities[i] * ((i === j ? 1 : 0) - probabilities[j]);
      squared += entry * entry;
    }
  }
  return Math.sqrt(squared);
}

export function compute(inputs: AttentionScaleInputs = {}) {
  const dk = clampInteger(inputs.dk, 4, 512, 64);
  const seed = clampInteger(inputs.seed, 0, 999, 7);
  const rawLogits = logitsFor(dk, seed);
  const unscaledVariance = variance(rawLogits);
  const logits = inputs.scaled === false ? rawLogits : rawLogits.map((value) => value / Math.sqrt(dk));
  const probabilities = softmax(logits);
  const logitVariance = variance(logits);
  return {
    dk,
    seed,
    scaled: inputs.scaled !== false,
    logits,
    probabilities,
    logitVariance,
    entropy: entropy(probabilities),
    jacobianFrobenius: softmaxJacobianFrobenius(probabilities),
    varianceRatioToUnscaled: logitVariance / unscaledVariance,
  };
}
