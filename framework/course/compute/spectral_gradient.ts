export type SpectralInputs = { spectral_radii: "0.5_0.9_1.1" | "0.3_0.7_1.3"; horizon: number };
export type SpectralState = { seed: number; step: number; max_steps: number };

const RADIUS_OPTIONS: Record<SpectralInputs["spectral_radii"], number[]> = {
  "0.5_0.9_1.1": [0.5, 0.9, 1.1],
  "0.3_0.7_1.3": [0.3, 0.7, 1.3],
};

export function compute(inputs: SpectralInputs, state: SpectralState) {
  const horizon = Math.max(1, Math.floor(Number(inputs.horizon)));
  const radii = RADIUS_OPTIONS[inputs.spectral_radii] ?? RADIUS_OPTIONS["0.5_0.9_1.1"];
  const lags = Array.from({ length: horizon + 1 }, (_, lag) => lag);
  const curves = radii.map((radius) => ({
    radius,
    values: lags.map((lag) => ({ lag, value: Math.log(Math.max(Number.EPSILON, Math.pow(radius * 0.82, lag))) })),
  }));
  const bounds = radii.map((radius) => ({
    radius,
    values: lags.map((lag) => ({ lag, value: Math.log(Math.max(Number.EPSILON, Math.pow(radius, lag))) })),
  }));
  return { lags, curves, bounds, step: state.step, reset: state.step === 0 };
}
