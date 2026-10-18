export type StructuredInputs = {
  mode?: "toeplitz" | "semiseparable" | "low-rank" | "dense";
  length?: number;
  stateDim?: number;
  delta?: number;
  selective?: boolean;
  seed?: number;
};

function positive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function lcg(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function rankEstimate(matrix: number[][]): number {
  const rowNorms = matrix.map((row) => Math.sqrt(row.reduce((sum, value) => sum + value * value, 0)));
  const threshold = Math.max(...rowNorms, 1) * 1e-8;
  return rowNorms.filter((value) => value > threshold).length;
}

function toeplitz(length: number, delta: number): number[][] {
  return Array.from({ length }, (_, row) =>
    Array.from({ length }, (_, column) => Math.exp(-Math.abs(row - column) * delta)),
  );
}

function decayMask(length: number, delta: number, selective: boolean): number[][] {
  const result = Array.from({ length }, () => Array<number>(length).fill(0));
  for (let row = 0; row < length; row += 1) {
    let product = 1;
    for (let column = row; column >= 0; column -= 1) {
      if (column < row) {
        const localDecay = selective
          ? Math.max(0.05, Math.min(0.98, Math.exp(-delta * (1 + ((column + 3 * row) % 5) / 10))))
          : Math.exp(-delta);
        product *= localDecay;
      }
      result[row][column] = product;
    }
  }
  return result;
}

function lowRank(length: number): number[][] {
  return Array.from({ length }, (_, row) =>
    Array.from({ length }, (_, column) =>
      Math.sin((row + 1) * (column + 1) / (length + 1)) +
      0.5 * Math.cos((row + 1) * 2 / (length + 1)) * Math.sin((column + 1) * 3 / (length + 1)),
    ),
  );
}

function dense(length: number, seed: number): number[][] {
  const random = lcg(seed);
  return Array.from({ length }, () => Array.from({ length }, () => 2 * random() - 1));
}

export function compute(inputs: StructuredInputs = {}) {
  const mode = inputs.mode ?? "semiseparable";
  const length = Math.max(2, Math.min(64, Math.floor(positive(inputs.length, 16))));
  const stateDim = Math.max(1, Math.min(16, Math.floor(positive(inputs.stateDim, 4))));
  const delta = positive(inputs.delta, 0.15);
  const selective = inputs.selective ?? false;
  const seed = Number.isFinite(Number(inputs.seed)) ? Number(inputs.seed) : 7;
  let matrix: number[][];
  if (mode === "toeplitz") matrix = toeplitz(length, delta);
  else if (mode === "semiseparable") matrix = decayMask(length, delta, selective);
  else if (mode === "low-rank") matrix = lowRank(length);
  else matrix = dense(length, seed);

  const spectrum = matrix.map((row, index) => row[index]);
  return {
    mode,
    length,
    stateDim,
    delta,
    selective,
    matrix,
    spectrum,
    effectiveRank: rankEstimate(matrix),
    legend: {
      toeplitz: "LTI convolution / Green's-function-style structure",
      semiseparable: "selective or scalar-decay state transition mask",
      "low-rank": "finite feature-state factorization",
      dense: "data-dependent dense attention matrix",
    },
  };
}
