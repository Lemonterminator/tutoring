export type LinearStateInputs = {
  keys?: number[][];
  values?: number[][];
  mode?: "hebbian" | "delta" | "gated";
  alpha?: number;
  beta?: number;
};

function defaults() {
  return {
    keys: [[1, 0], [0.8, 0.2], [0, 1], [0.2, 0.9]],
    values: [[1, 0], [0.8, 0.1], [0, 1], [0.2, 0.9]],
  };
}

export function compute(inputs: LinearStateInputs = {}) {
  const fallback = defaults();
  const keys = inputs.keys ?? fallback.keys;
  const values = inputs.values ?? fallback.values;
  const mode = inputs.mode === "delta" || inputs.mode === "gated" ? inputs.mode : "hebbian";
  const alpha = Number.isFinite(Number(inputs.alpha)) ? Number(inputs.alpha) : 0.95;
  const beta = Number.isFinite(Number(inputs.beta)) ? Number(inputs.beta) : 0.2;
  if (keys.length === 0 || keys.length !== values.length) throw new Error("keys and values must share a nonzero length");
  const keyDim = keys[0].length;
  const valueDim = values[0].length;
  if (keys.some((row) => row.length !== keyDim) || values.some((row) => row.length !== valueDim)) {
    throw new Error("keys and values must be rectangular");
  }
  let state = Array.from({ length: valueDim }, () => Array(keyDim).fill(0));
  const states: number[][][] = [];
  const predictions: number[][] = [];
  keys.forEach((key, index) => {
    const value = values[index];
    const prediction = state.map((row) => row.reduce((sum, weight, column) => sum + weight * key[column], 0));
    predictions.push(prediction);
    if (mode === "hebbian") {
      state = state.map((row, rowIndex) => row.map((weight, column) => weight + value[rowIndex] * key[column]));
    } else {
      const decayed = mode === "gated" ? state.map((row) => row.map((weight) => alpha * weight)) : state;
      const error = decayed.map((row, rowIndex) => decayed[rowIndex].reduce((sum, weight, column) => sum + weight * key[column], 0) - value[rowIndex]);
      state = decayed.map((row, rowIndex) => row.map((weight, column) => weight - beta * error[rowIndex] * key[column]));
    }
    states.push(state.map((row) => [...row]));
  });
  return { keys, values, mode, alpha, beta, states, predictions, finalState: state };
}
