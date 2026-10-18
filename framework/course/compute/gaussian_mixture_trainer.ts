export type GaussianMixtureInputs = { K: number; data_shape: "bimodal" | "unimodal" };
export type GaussianMixtureState = { seed: number; step: number; max_steps: number };

export function compute(inputs: GaussianMixtureInputs, state: GaussianMixtureState) {
  const data = inputs.data_shape === "bimodal" ? [-1, -0.9, -1.1, 0.9, 1, 1.1] : [-0.3, -0.1, 0, 0.1, 0.2, 0.3];
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
  const components = Math.max(1, Math.floor(inputs.K));
  const mixtureMeans = Array.from({ length: components }, (_, index) => {
    if (components === 1) return mean;
    return -1 + (2 * index) / (components - 1);
  });
  const mixtureWeights = Array.from({ length: components }, () => 1 / components);
  const mixtureScales = Array.from({ length: components }, () => 0.25);
  const gaussianLoss = data.reduce((sum, value) => sum + (value - mean) ** 2, 0) / data.length;
  const losses = Array.from({ length: Math.max(0, state.max_steps) + 1 }, (_, step) => ({ step, value: gaussianLoss * Math.exp(-step / 20) }));
  return { data, gaussianMean: mean, mixtureMeans, mixtureWeights, mixtureScales, gaussianLoss, losses, reset: state.step === 0 };
}
