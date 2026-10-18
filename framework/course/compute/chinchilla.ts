export type ChinchillaInputs = {
  compute?: number;
  points?: number;
  E?: number;
  A?: number;
  B?: number;
  alpha?: number;
  beta?: number;
};

const DEFAULTS = {
  compute: 1e21,
  points: 33,
  E: 1.69,
  A: 406.4,
  B: 410.7,
  alpha: 0.34,
  beta: 0.28,
};

function positive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function integer(value: unknown, fallback: number): number {
  return Math.max(3, Math.floor(positive(value, fallback)));
}

function loss(N: number, D: number, E: number, A: number, B: number, alpha: number, beta: number): number {
  return E + A / N ** alpha + B / D ** beta;
}

export function compute(inputs: ChinchillaInputs = {}) {
  const E = Number.isFinite(Number(inputs.E)) ? Number(inputs.E) : DEFAULTS.E;
  const A = positive(inputs.A, DEFAULTS.A);
  const B = positive(inputs.B, DEFAULTS.B);
  const alpha = positive(inputs.alpha, DEFAULTS.alpha);
  const beta = positive(inputs.beta, DEFAULTS.beta);
  const computeBudget = positive(inputs.compute, DEFAULTS.compute);
  const points = integer(inputs.points, DEFAULTS.points);
  const nExponent = beta / (alpha + beta);
  const dExponent = alpha / (alpha + beta);
  const scale = computeBudget / 6;
  const Nopt = (alpha * A / (beta * B)) ** (1 / (alpha + beta)) * scale ** nExponent;
  const Dopt = scale / Nopt;
  const ratios = Array.from({ length: points }, (_, index) => {
    const t = index / (points - 1);
    return 0.25 * (16 ** t);
  });
  const curve = ratios.map((ratio) => {
    const N = Nopt * ratio;
    const D = scale / N;
    return { ratio, N, D, loss: loss(N, D, E, A, B, alpha, beta) };
  });
  return {
    compute: computeBudget,
    fit: { E, A, B, alpha, beta },
    Nopt,
    Dopt,
    tokensPerParameter: Dopt / Nopt,
    NExponent: nExponent,
    DExponent: dExponent,
    optimumLoss: loss(Nopt, Dopt, E, A, B, alpha, beta),
    curve,
  };
}
