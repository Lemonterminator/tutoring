export type HopfieldInputs = {
  patterns?: number[][];
  query?: number[];
  beta?: number;
  steps?: number;
};

function defaults() {
  return {
    patterns: [[1, 1, 0], [0, 1, 1], [-1, 0, 1], [0, -1, -1]],
    query: [0.75, 0.35, 0.2],
  };
}

function finite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function logsumexp(values: number[]): number {
  const maximum = Math.max(...values);
  return maximum + Math.log(values.reduce((sum, value) => sum + Math.exp(value - maximum), 0));
}

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function energy(query: number[], patterns: number[][], beta: number): number {
  const scores = patterns.map((pattern) => beta * dot(pattern, query));
  return -logsumexp(scores) / beta + 0.5 * dot(query, query);
}

function update(query: number[], patterns: number[][], beta: number): { weights: number[]; query: number[] } {
  const weights = softmax(patterns.map((pattern) => beta * dot(pattern, query)));
  const next = patterns[0].map((_, dimension) => patterns.reduce((sum, pattern, index) => sum + weights[index] * pattern[dimension], 0));
  return { weights, query: next };
}

export function compute(inputs: HopfieldInputs = {}) {
  const fallback = defaults();
  const patterns = inputs.patterns?.length ? inputs.patterns.map((row) => row.map(Number)) : fallback.patterns;
  const initialQuery = inputs.query?.length ? inputs.query.map(Number) : fallback.query;
  const beta = Math.max(0.05, Math.min(50, finite(inputs.beta, 6)));
  const steps = Math.max(1, Math.min(16, Math.floor(finite(inputs.steps, 1))));
  let query = [...initialQuery];
  const trajectory = [{ step: 0, query: [...query], energy: energy(query, patterns, beta) }];
  let weights = softmax(patterns.map((pattern) => beta * dot(pattern, query)));
  for (let step = 1; step <= steps; step += 1) {
    const next = update(query, patterns, beta);
    weights = next.weights;
    query = next.query;
    trajectory.push({ step, query: [...query], energy: energy(query, patterns, beta) });
  }
  return {
    patterns,
    beta,
    steps,
    initialQuery,
    query,
    weights,
    retrieved: [...query],
    energyBefore: trajectory[0].energy,
    energyAfter: trajectory[trajectory.length - 1].energy,
    trajectory,
    insight: "The bare Hopfield update is scaled dot-product attention with Q = xi and K = V = X; its MM/CCCP surrogate decreases the associative energy.",
  };
}
