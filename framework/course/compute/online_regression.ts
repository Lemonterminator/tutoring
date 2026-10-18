export type RegressionInputs = {
  mode?: "hebbian" | "delta" | "gated";
  keys?: number[][];
  values?: number[][];
  alpha?: number;
  beta?: number;
  length?: number;
  seed?: number;
};

function clamp(value: unknown, low: number, high: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(low, Math.min(high, parsed)) : fallback;
}

function lcg(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function outer(value: number[], key: number[]): number[][] {
  return value.map((entry) => key.map((component) => entry * component));
}

function add(left: number[][], right: number[][]): number[][] {
  return left.map((row, rowIndex) => row.map((entry, column) => entry + right[rowIndex][column]));
}

function scale(matrix: number[][], factor: number): number[][] {
  return matrix.map((row) => row.map((entry) => factor * entry));
}

function matVec(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, entry, index) => sum + entry * vector[index], 0));
}

function subtract(left: number[], right: number[]): number[] {
  return left.map((entry, index) => entry - right[index]);
}

function generatedStream(length: number, seed: number) {
  const random = lcg(seed);
  const keys = Array.from({ length }, () => [2 * random() - 1, 2 * random() - 1, 2 * random() - 1]);
  const values = keys.map((key) => [0.8 * key[0] - 0.2 * key[1], 0.5 * key[1] + 0.3 * key[2]]);
  return { keys, values };
}

export function compute(inputs: RegressionInputs = {}) {
  const mode = inputs.mode ?? "hebbian";
  const alpha = clamp(inputs.alpha, 0, 1, 0.95);
  const beta = clamp(inputs.beta, 0, 1, 0.2);
  const length = Math.floor(clamp(inputs.length, 1, 256, 12));
  const seed = Number.isFinite(Number(inputs.seed)) ? Number(inputs.seed) : 7;
  const generated = generatedStream(length, seed);
  const keys = inputs.keys?.length ? inputs.keys.map((row) => row.map(Number)) : generated.keys;
  const values = inputs.values?.length ? inputs.values.map((row) => row.map(Number)) : generated.values;
  const valueWidth = values[0].length;
  const keyWidth = keys[0].length;
  let state = Array.from({ length: valueWidth }, () => Array<number>(keyWidth).fill(0));
  const states = [state.map((row) => [...row])];
  const predictions: number[][] = [];
  const errors: number[] = [];
  for (let index = 0; index < Math.min(keys.length, values.length); index += 1) {
    const key = keys[index];
    const value = values[index];
    if (mode === "hebbian") {
      state = add(state, outer(value, key));
    } else {
      if (mode === "gated") state = scale(state, alpha);
      const error = subtract(value, matVec(state, key));
      state = add(state, scale(outer(error, key), beta));
    }
    const prediction = matVec(state, key);
    predictions.push(prediction);
    errors.push(0.5 * prediction.reduce((sum, entry, dimension) => sum + (entry - value[dimension]) ** 2, 0));
    states.push(state.map((row) => [...row]));
  }
  return {
    mode,
    alpha,
    beta,
    seed,
    keys,
    values,
    states,
    predictions,
    errors,
    finalState: state,
    insight: "Hebbian accumulation, delta SGD, and Gated DeltaNet are three online optimizers for the same key-value regression memory.",
  };
}
