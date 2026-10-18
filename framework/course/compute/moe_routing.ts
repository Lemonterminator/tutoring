export type MoERoutingInputs = {
  probabilities?: number[][];
  topK?: number;
  alpha?: number;
  balancing?: "aux" | "bias";
  bias?: number[];
  biasGamma?: number;
};

function defaultProbabilities(): number[][] {
  return [
    [0.7, 0.2, 0.1],
    [0.6, 0.3, 0.1],
    [0.1, 0.2, 0.7],
    [0.2, 0.1, 0.7],
  ];
}

function normalize(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
}

export function compute(inputs: MoERoutingInputs = {}) {
  const probabilities = inputs.probabilities ?? defaultProbabilities();
  const tokens = probabilities.length;
  const experts = probabilities[0]?.length ?? 0;
  if (tokens === 0 || experts === 0 || probabilities.some((row) => row.length !== experts)) {
    throw new Error("probabilities must be a nonempty rectangular matrix");
  }
  const topK = Math.max(1, Math.min(experts, Math.floor(Number(inputs.topK ?? 1))));
  const alpha = Number.isFinite(Number(inputs.alpha)) ? Number(inputs.alpha) : 0.01;
  const balancing = inputs.balancing === "bias" ? "bias" : "aux";
  const bias = inputs.bias?.length === experts ? [...inputs.bias] : Array(experts).fill(0);
  const order = probabilities.map((row) =>
    row
      .map((value, expert) => ({ value, expert, score: value + bias[expert] }))
      .sort((left, right) => right.score - left.score || left.expert - right.expert)
      .slice(0, topK),
  );
  const flows = order.flatMap((row, token) => {
    const weights = normalize(row.map((entry) => entry.value));
    return row.map((entry, index) => ({ token, expert: entry.expert, weight: weights[index] }));
  });
  const top1 = order.map((row) => row[0].expert);
  const f = Array(experts).fill(0);
  top1.forEach((expert) => {
    f[expert] += 1 / tokens;
  });
  const P = Array(experts).fill(0);
  probabilities.forEach((row) => row.forEach((value, expert) => (P[expert] += value / tokens)));
  const auxLoss = alpha * experts * f.reduce((sum, value, expert) => sum + value * P[expert], 0);
  const target = 1 / experts;
  const gamma = Number.isFinite(Number(inputs.biasGamma)) ? Number(inputs.biasGamma) : 0.01;
  const biasAfter = bias.map((value, expert) => value + gamma * Math.sign(target - f[expert]));
  return {
    probabilities,
    topK,
    alpha,
    balancing,
    bias,
    top1,
    flows,
    f,
    P,
    auxLoss,
    softRelaxedMinimum: alpha,
    biasAfter,
    primaryBiasControllerNoBalanceGradient: balancing === "bias",
  };
}
