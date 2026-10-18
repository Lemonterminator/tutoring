export type RopeInputs = {
  d?: number;
  base?: number;
  relative_distance?: number;
  single_frequency?: boolean;
  rotate_values?: boolean;
};

export type RopeState = { seed?: number; q?: number[]; k?: number[]; v?: number[] };

function integer(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function number(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function frequencies(d: number, base: number): number[] {
  return Array.from({ length: d / 2 }, (_, index) => base ** (-2 * index / d));
}

function normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return values.map((value) => value / norm);
}

function deterministicVector(d: number, seed: number, phase: number): number[] {
  return normalize(Array.from({ length: d }, (_, index) => {
    const x = (index + 1) * (seed + 1) * 0.173 + phase;
    return Math.sin(x) + 0.31 * Math.cos(1.7 * x);
  }));
}

function rotate(vector: number[], position: number, theta: number[]): number[] {
  const result = [...vector];
  for (let index = 0; index < theta.length; index += 1) {
    const angle = position * theta[index];
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const even = vector[2 * index];
    const odd = vector[2 * index + 1];
    result[2 * index] = cosine * even - sine * odd;
    result[2 * index + 1] = sine * even + cosine * odd;
  }
  return result;
}

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function partialEnvelope(delta: number, theta: number[]): number {
  let real = 0;
  let imaginary = 0;
  let total = 0;
  for (let index = 0; index < theta.length; index += 1) {
    real += Math.cos(delta * theta[index]);
    imaginary += Math.sin(delta * theta[index]);
    total += Math.hypot(real, imaginary);
  }
  return total / theta.length;
}

function rawScore(delta: number, q: number[], k: number[], theta: number[], singleFrequency: boolean): number {
  if (singleFrequency) return Math.cos(delta);
  let score = 0;
  for (let index = 0; index < theta.length; index += 1) {
    const qReal = q[2 * index];
    const qImag = q[2 * index + 1];
    const kReal = k[2 * index];
    const kImag = k[2 * index + 1];
    const hReal = qReal * kReal + qImag * kImag;
    const hImag = qReal * kImag - qImag * kReal;
    const angle = delta * theta[index];
    score += hReal * Math.cos(angle) - hImag * Math.sin(angle);
  }
  return score;
}

export function compute(inputs: RopeInputs = {}, state: RopeState = {}) {
  const d = integer(inputs.d, 4, 128, 32);
  const base = number(inputs.base, 100, 1_000_000, 10_000);
  const relativeDistance = integer(inputs.relative_distance, 0, 512, 0);
  const seed = integer(state.seed, 0, 999, 0);
  const theta = frequencies(d, base);
  const q = inputs.single_frequency === true
    ? [1, 0, ...Array(d - 2).fill(0)]
    : (Array.isArray(state.q) && state.q.length === d ? normalize(state.q.map(Number)) : deterministicVector(d, seed, 0.2));
  const k = inputs.single_frequency === true
    ? [1, 0, ...Array(d - 2).fill(0)]
    : (Array.isArray(state.k) && state.k.length === d ? normalize(state.k.map(Number)) : deterministicVector(d, seed + 3, 1.1));
  const v = Array.isArray(state.v) && state.v.length === d ? state.v.map(Number) : deterministicVector(d, seed + 5, 2.4);
  const qRotated = rotate(q, 0, theta);
  const kRotated = rotate(k, relativeDistance, theta);
  const identityScore = dot(qRotated, kRotated);
  const relativeScore = dot(q, rotate(k, relativeDistance, theta));
  const rotatedValue = inputs.rotate_values === true ? rotate(v, relativeDistance, theta) : v;
  const valuePathDifference = Math.sqrt(rotatedValue.reduce((sum, value, index) => sum + (value - v[index]) ** 2, 0));
  const maxDistance = 512;
  const decayCurve = Array.from({ length: maxDistance + 1 }, (_, delta) => ({
    relative_distance: delta,
    envelope: partialEnvelope(delta, theta),
    score: rawScore(delta, q, k, theta, false),
    single_frequency_score: Math.cos(delta),
  }));
  const rotation_view = theta.slice(0, Math.min(8, theta.length)).map((frequency, index) => ({
    block: index,
    theta: frequency,
    q_before: [q[2 * index], q[2 * index + 1]],
    q_after: [qRotated[2 * index], qRotated[2 * index + 1]],
    k_before: [k[2 * index], k[2 * index + 1]],
    k_after: [kRotated[2 * index], kRotated[2 * index + 1]],
  }));
  return {
    d,
    base,
    relativeDistance,
    theta,
    q,
    k,
    rotation_view,
    decay_curve: decayCurve,
    identityScore,
    relativeScore,
    identity_error: Math.abs(identityScore - relativeScore),
    valuePathDifference,
    rotatedValue,
  };
}
