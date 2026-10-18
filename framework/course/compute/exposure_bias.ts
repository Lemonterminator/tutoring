export type ExposureInputs = { epsilon: number; horizon: number };
export type ExposureState = { seed: number; step: number; max_steps: number };

export function compute(inputs: ExposureInputs, state: ExposureState) {
  const epsilon = Math.max(0, Number(inputs.epsilon));
  const horizon = Math.max(1, Math.floor(inputs.horizon));
  const points = Array.from({ length: horizon }, (_, index) => {
    const t = index + 1;
    const offManifoldProbability = Math.min(1, epsilon * index);
    return {
      t,
      offManifoldProbability,
      teacherForcedCumulativeCost: t * epsilon,
      exposureBiasBound: epsilon * t * (t - 1) / 2,
    };
  });
  return { points, reset: state.step === 0 };
}
