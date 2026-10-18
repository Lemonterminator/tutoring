export type PrePostLnInputs = {
  depth?: number;
  width?: number;
  placement?: "pre" | "post";
  seed?: number;
};

function integer(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function fitSlope(points: number[][]): number {
  const x = points.map(([depth]) => Math.log(depth));
  const y = points.map(([, value]) => Math.log(value));
  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;
  const numerator = x.reduce((sum, value, index) => sum + (value - xMean) * (y[index] - yMean), 0);
  const denominator = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  return numerator / denominator;
}

export function compute(inputs: PrePostLnInputs = {}) {
  const maximumDepth = integer(inputs.depth, 2, 128, 32);
  const width = integer(inputs.width, 8, 256, 64);
  const seed = integer(inputs.seed, 0, 999, 7);
  const placement = inputs.placement === "post" ? "post" : "pre";
  const depths = Array.from({ length: Math.max(1, Math.floor(maximumDepth / 2)) }, (_, index) => 2 + 2 * index);
  const base = Math.sqrt(width) * (1 + 0.01 * Math.sin(seed + 1));
  const gradientNorms = depths.map((depth) => {
    const jitter = 1 + 0.04 * Math.sin((seed + 3) * 0.17 + depth * 0.31);
    return placement === "pre" ? base * jitter / Math.sqrt(depth) : base * jitter;
  });
  const referenceBase = gradientNorms[0] * Math.sqrt(depths[0]);
  const oneOverSqrtDepth = depths.map((depth) => referenceBase / Math.sqrt(depth));
  const points = depths.map((depth, index) => [depth, gradientNorms[index]]);
  return {
    depth: maximumDepth,
    width,
    placement,
    depths,
    gradientNorms,
    oneOverSqrtDepth,
    loglogSlope: fitSlope(points),
    scope: "Toy initialization preview for the last FFN second matrix W^{2,L}; not a universal bound for all parameters.",
  };
}
