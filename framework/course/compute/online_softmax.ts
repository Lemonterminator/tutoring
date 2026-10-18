export type OnlineState = {
  m: number;
  ell: number;
  numerator: number[];
};

export type OnlineSoftmaxInputs = {
  scores?: number[];
  values?: number[][];
  blockSize?: number;
};

function emptyState(width: number): OnlineState {
  return { m: Number.NEGATIVE_INFINITY, ell: 0, numerator: Array(width).fill(0) };
}

function update(state: OnlineState, scores: number[], values: number[][]): OnlineState {
  const finite = scores.map((score) => Number.isFinite(score));
  if (!finite.some(Boolean)) return { m: state.m, ell: state.ell, numerator: [...state.numerator] };
  const validScores = scores.filter((_, index) => finite[index]);
  const validValues = values.filter((_, index) => finite[index]);
  const blockMax = Math.max(...validScores);
  const blockWeights = validScores.map((score) => Math.exp(score - blockMax));
  const blockEll = blockWeights.reduce((sum, weight) => sum + weight, 0);
  const blockNumerator = state.numerator.map((_, column) =>
    blockWeights.reduce((sum, weight, row) => sum + weight * validValues[row][column], 0),
  );
  if (state.ell === 0 || !Number.isFinite(state.m)) {
    return { m: blockMax, ell: blockEll, numerator: blockNumerator };
  }
  const nextMax = Math.max(state.m, blockMax);
  const oldScale = Math.exp(state.m - nextMax);
  const blockScale = Math.exp(blockMax - nextMax);
  return {
    m: nextMax,
    ell: oldScale * state.ell + blockScale * blockEll,
    numerator: state.numerator.map(
      (oldValue, column) => oldScale * oldValue + blockScale * blockNumerator[column],
    ),
  };
}

export function compute(inputs: OnlineSoftmaxInputs = {}) {
  const scores = inputs.scores ?? [1, Number.NEGATIVE_INFINITY, 2, -1, Number.NEGATIVE_INFINITY];
  const values = inputs.values ?? scores.map((_, index) => [index + 1, 1]);
  const blockSize = Math.max(1, Math.floor(Number(inputs.blockSize ?? 2)));
  if (values.length !== scores.length) throw new Error("scores and values must have equal length");
  const width = values[0]?.length ?? 0;
  if (width === 0 || values.some((row) => row.length !== width)) throw new Error("values must be rectangular");
  let state = emptyState(width);
  const steps = [{ ...state, numerator: [...state.numerator], block: [] as number[] }];
  for (let start = 0; start < scores.length; start += blockSize) {
    const blockScores = scores.slice(start, start + blockSize);
    state = update(state, blockScores, values.slice(start, start + blockSize));
    steps.push({ ...state, numerator: [...state.numerator], block: blockScores });
  }
  const output = state.ell === 0 ? Array(width).fill(0) : state.numerator.map((value) => value / state.ell);
  return { scores, values, blockSize, steps, output, final: state, emptyBlockIsNoOp: true };
}
