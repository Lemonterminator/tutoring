export type GradientHighwayInputs = { horizon: number; forget_bias: number; rnn_factor: number };

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function compute(inputs: GradientHighwayInputs) {
  const horizon = Math.max(1, Math.min(100, Math.floor(Number(inputs.horizon) || 1)));
  const forgetValue = sigmoid(Number(inputs.forget_bias));
  const rnnFactor = Math.max(0, Math.min(1.2, Number(inputs.rnn_factor)));
  const lags = Array.from({ length: horizon + 1 }, (_, lag) => lag);
  return {
    lags,
    forgetValue,
    lstm: lags.map((lag) => Math.pow(forgetValue, lag)),
    rnn: lags.map((lag) => Math.pow(rnnFactor, lag)),
  };
}
