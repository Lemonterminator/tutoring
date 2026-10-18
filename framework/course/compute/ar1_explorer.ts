export type AR1Inputs = {
  phi: number;
  sigma: number;
  horizon: number;
  seed: number;
};

export type AR1State = { x0: number };

export type AR1Outputs = {
  trajectory: Array<{ t: number; x: number }>;
  gradientMultiplier: Array<{ k: number; value: number }>;
  autocorrelation: Array<{ k: number; value: number }>;
  stationaryVariance: number | null;
};

function nextUniform(seed: number): [number, number] {
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

function normalNoise(seed: number): [number, number] {
  let nextSeed: number;
  let u1: number;
  [nextSeed, u1] = nextUniform(seed);
  let u2: number;
  [nextSeed, u2] = nextUniform(nextSeed);
  const radius = Math.sqrt(-2 * Math.log(Math.max(u1, Number.EPSILON)));
  return [nextSeed, radius * Math.cos(2 * Math.PI * u2)];
}

export function compute(inputs: AR1Inputs, state: AR1State): AR1Outputs {
  const phi = Number(inputs.phi);
  const sigma = Math.max(0, Number(inputs.sigma));
  const horizon = Math.max(1, Math.floor(inputs.horizon));
  let seed = Math.floor(inputs.seed) >>> 0;
  let x = Number(state.x0);
  const trajectory: Array<{ t: number; x: number }> = [{ t: 0, x }];
  const gradientMultiplier: Array<{ k: number; value: number }> = [];
  const autocorrelation: Array<{ k: number; value: number }> = [];

  for (let k = 0; k <= horizon; k += 1) {
    const value = phi ** k;
    gradientMultiplier.push({ k, value });
    autocorrelation.push({ k, value });
  }
  for (let t = 1; t <= horizon; t += 1) {
    let noise = 0;
    [seed, noise] = normalNoise(seed);
    x = phi * x + sigma * noise;
    trajectory.push({ t, x });
  }

  return {
    trajectory,
    gradientMultiplier,
    autocorrelation,
    stationaryVariance: Math.abs(phi) < 1 ? (sigma * sigma) / (1 - phi * phi) : null,
  };
}
