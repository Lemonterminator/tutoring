export type ModelCalculatorInputs = {
  d?: number;
  h?: number;
  h_kv?: number;
  L?: number;
  V?: number;
  n?: number;
  dtype?: "fp32" | "fp16" | "bf16" | "int8";
};

const DTYPE_BYTES: Record<string, number> = { fp32: 4, fp16: 2, bf16: 2, int8: 1 };

function integer(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export function compute(inputs: ModelCalculatorInputs = {}) {
  const d = integer(inputs.d, 64, 16384, 4096);
  const h = integer(inputs.h, 1, 128, 32);
  const hKv = integer(inputs.h_kv, 1, h, 8);
  const layers = integer(inputs.L, 1, 256, 32);
  const vocabulary = integer(inputs.V, 256, 300000, 100000);
  const sequenceLength = integer(inputs.n, 1, 131072, 2048);
  const dtype = inputs.dtype && inputs.dtype in DTYPE_BYTES ? inputs.dtype : "fp16";
  if (d % h !== 0) throw new Error("d must be divisible by h");
  const headDimension = d / h;
  const bytesPerElement = DTYPE_BYTES[dtype];
  const parameterCount = 12 * layers * d * d + vocabulary * d;
  const kvCacheBytes = 2 * layers * sequenceLength * hKv * headDimension * bytesPerElement;
  const activationMemoryBytes = layers * sequenceLength * d * bytesPerElement * 4;
  return {
    d,
    h,
    hKv,
    layers,
    vocabulary,
    sequenceLength,
    dtype,
    bytesPerElement,
    headDimension,
    parameterCount,
    trainingFlopsPerToken: 6 * parameterCount,
    kvCacheBytes,
    activationMemoryBytes,
    activationEstimate: "4 saved d-vectors per layer and token; attention score workspace excluded",
  };
}
