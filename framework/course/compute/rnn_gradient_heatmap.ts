export type HeatmapInputs = { spectral_radius: number; hidden_size: number; seed: number };
export type HeatmapState = { seed: number; step: number; max_steps: number };

export function compute(inputs: HeatmapInputs, state: HeatmapState) {
  const time = 20;
  const lags = 20;
  const radius = Math.max(0.3, Math.min(1.5, Number(inputs.spectral_radius)));
  const saturationFactor = 0.82;
  const gradientHeatmap = Array.from({ length: time }, (_, t) =>
    Array.from({ length: lags }, (_, lag) => {
      if (lag > t) return 0;
      return Math.pow(radius * saturationFactor, lag);
    }),
  );
  const unrolledStates = Array.from({ length: time }, (_, t) => ({
    time: t + 1,
    hiddenNorm: Math.sqrt(Math.max(1, Math.floor(inputs.hidden_size))) * (1 - Math.exp(-(t + 1) / 8)),
  }));
  return {
    gradientHeatmap,
    unrolledStates,
    spectralRadius: radius,
    step: state.step,
    reset: state.step === 0,
  };
}
