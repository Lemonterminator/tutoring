export type CopyDelayInputs = { delay: number; hidden_size: number; steps: number };
export type CopyDelayState = { seed: number; step: number; max_steps: number };

export function compute(inputs: CopyDelayInputs, state: CopyDelayState) {
  const delay = Math.max(2, Math.min(40, Math.floor(Number(inputs.delay))));
  const hiddenSize = Math.max(2, Math.floor(Number(inputs.hidden_size)));
  const steps = Math.max(1, Math.min(200, Math.floor(Number(inputs.steps))));
  const difficulty = delay / Math.sqrt(hiddenSize);
  const learningScale = 8 + 2 * difficulty;
  const accuracy = Array.from({ length: steps + 1 }, (_, step) => {
    const ceiling = Math.exp(-0.035 * Math.max(0, difficulty - 1));
    return Math.min(1, 0.25 + ceiling * 0.7 * (1 - Math.exp(-step / learningScale)));
  });
  const loss = accuracy.map((value) => ({ step: accuracy.indexOf(value), value: -Math.log(Math.max(value, 1e-9)) }));
  return {
    accuracy: accuracy.map((value, step) => ({ step, value })),
    loss,
    taskSummary: { delay, hiddenSize, steps },
    step: state.step,
    reset: state.step === 0,
  };
}
