export type ParticleInputs = {
  beta?: number;
  depth?: number;
  qk?: boolean;
  residual?: boolean;
  ffn?: boolean;
  length?: number;
  seed?: number;
};

type Vec3 = [number, number, number];

function finite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function lcg(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalize(vector: number[]): Vec3 {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return [vector[0] / norm, vector[1] / norm, vector[2] / norm];
}

function seededSphere(length: number, seed: number): Vec3[] {
  const random = lcg(seed);
  return Array.from({ length }, () => normalize([
    2 * random() - 1,
    2 * random() - 1,
    2 * random() - 1,
  ]));
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function attention(points: Vec3[], keys: Vec3[], beta: number): number[][] {
  return points.map((query) => softmax(keys.map((key) => beta * dot(query, key))));
}

function mean(points: Vec3[]): Vec3 {
  const total = points.reduce((sum, point) => [
    sum[0] + point[0],
    sum[1] + point[1],
    sum[2] + point[2],
  ] as Vec3, [0, 0, 0] as Vec3);
  return [total[0] / points.length, total[1] / points.length, total[2] / points.length];
}

function centeredRank(points: Vec3[]): number {
  const center = mean(points);
  const basis: number[][] = [];
  const rows = points.map((point) => [
    point[0] - center[0],
    point[1] - center[1],
    point[2] - center[2],
  ]);
  const scale = Math.max(...rows.map((row) => Math.hypot(...row)), 1);
  for (const row of rows) {
    const residual = [...row];
    for (const vector of basis) {
      const coefficient = residual.reduce((sum, value, index) => sum + value * vector[index], 0);
      for (let index = 0; index < residual.length; index += 1) residual[index] -= coefficient * vector[index];
    }
    const norm = Math.hypot(...residual);
    if (norm > scale * 1e-7) basis.push(residual.map((value) => value / norm));
  }
  return basis.length;
}

function clusterCount(points: Vec3[], threshold = 0.94): number {
  const parent = points.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] === index) return index;
    parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (dot(points[left], points[right]) >= threshold) union(left, right);
    }
  }
  return new Set(parent.map((_, index) => find(index))).size;
}

function topEdges(weights: number[][], limit = 3) {
  return weights.flatMap((row, source) => row
    .map((weight, target) => ({ source, target, weight }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit));
}

function update(points: Vec3[], weights: number[][], residual: boolean, ffn: boolean): Vec3[] {
  return points.map((point, index) => {
    const aggregate = [0, 0, 0];
    for (let target = 0; target < points.length; target += 1) {
      aggregate[0] += weights[index][target] * points[target][0];
      aggregate[1] += weights[index][target] * points[target][1];
      aggregate[2] += weights[index][target] * points[target][2];
    }
    const candidate = residual
      ? [point[0] + 0.35 * aggregate[0], point[1] + 0.35 * aggregate[1], point[2] + 0.35 * aggregate[2]]
      : aggregate;
    const transformed = ffn
      ? candidate.map((value) => value + 0.12 * Math.tanh(value))
      : candidate;
    return normalize(transformed);
  });
}

export function compute(inputs: ParticleInputs = {}) {
  const beta = clamp(finite(inputs.beta, 4), 0.05, 20);
  const depth = Math.floor(clamp(finite(inputs.depth, 12), 0, 64));
  const length = Math.floor(clamp(finite(inputs.length, 16), 4, 64));
  const qk = inputs.qk ?? true;
  const residual = inputs.residual ?? false;
  const ffn = inputs.ffn ?? false;
  const seed = finite(inputs.seed, 7);
  const initialParticles = seededSphere(length, seed);
  const fixedKeys = seededSphere(length, seed + 991);
  let particles = initialParticles;
  const history = [{ layer: 0, rank: centeredRank(particles), clusters: clusterCount(particles) }];
  let weights = attention(particles, qk ? particles : fixedKeys, beta);
  for (let layer = 1; layer <= depth; layer += 1) {
    weights = attention(particles, qk ? particles : fixedKeys, beta);
    particles = update(particles, weights, residual, ffn);
    history.push({ layer, rank: centeredRank(particles), clusters: clusterCount(particles) });
  }
  return {
    beta,
    depth,
    length,
    qk,
    residual,
    ffn,
    seed,
    initialParticles,
    particles,
    edges: topEdges(weights),
    rank: centeredRank(particles),
    clusters: clusterCount(particles),
    history,
    insight: "Self-attention weights form a state-dependent graph; pure layers can collapse centered rank, while the identity residual path can preserve diversity.",
  };
}
