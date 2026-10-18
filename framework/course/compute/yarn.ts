export type YaRNInputs = {
  dimension?: number;
  base?: number;
  originalTrainLength?: number;
  targetLength?: number;
  alpha?: number;
  beta?: number;
};

function positive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function compute(inputs: YaRNInputs = {}) {
  const dimension = Math.max(2, Math.floor(positive(inputs.dimension, 8) / 2) * 2);
  const base = positive(inputs.base, 10000);
  const originalTrainLength = positive(inputs.originalTrainLength, 2048);
  const targetLength = positive(inputs.targetLength, 8192);
  const extensionScale = targetLength / originalTrainLength;
  const alpha = Number.isFinite(Number(inputs.alpha)) ? Number(inputs.alpha) : 1;
  const beta = Number.isFinite(Number(inputs.beta)) ? Number(inputs.beta) : 32;
  if (beta <= alpha) throw new Error("beta must exceed alpha");
  const frequencies = Array.from({ length: dimension / 2 }, (_, index) => base ** (-(2 * index) / dimension));
  const wavelength = frequencies.map((theta) => (2 * Math.PI) / theta);
  const ratios = wavelength.map((lambda) => originalTrainLength / lambda);
  const gamma = ratios.map((ratio) => Math.max(0, Math.min(1, (ratio - alpha) / (beta - alpha))));
  const adjustedFrequencies = frequencies.map(
    (theta, index) => (1 - gamma[index]) * (theta / extensionScale) + gamma[index] * theta,
  );
  const temperatureFactor = 0.1 * Math.log(extensionScale) + 1;
  return {
    dimension,
    base,
    originalTrainLength,
    targetLength,
    extensionScale,
    alpha,
    beta,
    frequencies,
    wavelength,
    ratios,
    gamma,
    adjustedFrequencies,
    temperatureFactor,
    logitFactor: temperatureFactor ** 2,
    temperature: 1 / (temperatureFactor ** 2),
  };
}
