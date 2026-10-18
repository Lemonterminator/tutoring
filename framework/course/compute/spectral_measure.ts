export type SpectralInputs = {
  mode?: "rope" | "yarn" | "alibi" | "t5";
  length?: number;
  frequencies?: number[];
  weights?: number[];
  scale?: number;
  slope?: number;
};

function finite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function spectralKernel(length: number, frequencies: number[], weights: number[]): number[][] {
  return Array.from({ length }, (_, row) => Array.from({ length }, (_, column) =>
    frequencies.reduce((sum, frequency, index) => sum + weights[index] * Math.cos((row - column) * frequency), 0),
  ));
}

function toeplitzBias(length: number, values: number[]): number[][] {
  return Array.from({ length }, (_, row) => Array.from({ length }, (_, column) =>
    values[Math.min(Math.abs(row - column), values.length - 1)],
  ));
}

export function compute(inputs: SpectralInputs = {}) {
  const mode = inputs.mode ?? "rope";
  const length = Math.max(2, Math.min(128, Math.floor(finite(inputs.length, 32))));
  const frequencies = inputs.frequencies?.length ? inputs.frequencies.map(Number) : [0.07, 0.19, 0.43, 0.81];
  const weights = inputs.weights?.length === frequencies.length
    ? inputs.weights.map((value) => Math.max(0, Number(value)))
    : frequencies.map(() => 1);
  const scale = Math.max(0.1, Math.min(64, finite(inputs.scale, 4)));
  const slope = Math.max(0, Math.min(4, finite(inputs.slope, 0.13)));
  const effectiveFrequencies = mode === "yarn" ? frequencies.map((frequency) => frequency / scale) : frequencies;
  const kernel = mode === "alibi"
    ? toeplitzBias(length, Array.from({ length }, (_, distance) => -slope * distance))
    : mode === "t5"
      ? toeplitzBias(length, [0, -0.2, -0.5, -0.9, -1.3])
      : spectralKernel(length, effectiveFrequencies, weights);
  return {
    mode,
    length,
    frequencies: effectiveFrequencies,
    weights,
    scale,
    slope,
    kernel,
    spectralPoints: effectiveFrequencies.map((frequency, index) => ({ frequency, weight: weights[index] })),
    insight: "RoPE is a finite unitary representation whose relative kernel is a Fourier transform of a nonnegative spectral measure; YaRN reshapes frequencies, while ALiBi/T5 add Toeplitz logit biases.",
  };
}
