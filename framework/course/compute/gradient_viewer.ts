export type GraphName = "rnn_cell" | "lstm_cell" | "attention_head";

export interface GradientViewerInputs {
  graph: GraphName;
  node: "state" | "gate" | "logits";
  upstreamGradient?: number[];
}

export interface GradientViewerState {
  seed: number;
}

export interface GradientViewerOutputs {
  graph: GraphName;
  node: GradientViewerInputs["node"];
  localJacobian: number[][];
  upstreamGradient: number[];
  outgoingGradient: number[];
  magnitudeView: number[];
  seed: number;
}

const LOCAL_JACOBIANS: Record<GraphName, number[][]> = {
  rnn_cell: [[0.7, 0.0], [0.0, 0.5]],
  lstm_cell: [[0.98, 0.0], [0.0, 0.95]],
  attention_head: [[0.6, 0.1], [0.2, 0.8]],
};

function transposeMatVec(matrix: number[][], vector: number[]): number[] {
  return matrix[0].map((_, column) =>
    matrix.reduce((sum, row, index) => sum + row[column] * vector[index], 0),
  );
}

export function compute(
  inputs: GradientViewerInputs,
  state: GradientViewerState = { seed: 0 },
): GradientViewerOutputs {
  const localJacobian = LOCAL_JACOBIANS[inputs.graph];
  if (!localJacobian) {
    throw new Error(`Unsupported graph: ${inputs.graph}`);
  }
  const upstreamGradient = [...(inputs.upstreamGradient ?? [1.0, -0.5])];
  if (upstreamGradient.length !== localJacobian.length) {
    throw new Error("upstreamGradient length must equal the Jacobian row count");
  }
  const outgoingGradient = transposeMatVec(localJacobian, upstreamGradient);
  return {
    graph: inputs.graph,
    node: inputs.node,
    localJacobian: localJacobian.map((row) => [...row]),
    upstreamGradient,
    outgoingGradient,
    magnitudeView: outgoingGradient.map((value) => Math.abs(value)),
    seed: state.seed,
  };
}

