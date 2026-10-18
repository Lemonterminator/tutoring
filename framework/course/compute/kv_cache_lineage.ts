export type KVCacheInputs = {
  layers?: number;
  context?: number;
  heads?: number;
  kvHeads?: number;
  headDim?: number;
  compressedDim?: number;
  rotaryDim?: number;
  dtype?: "fp32" | "fp16" | "bf16" | "int8";
};

const DTYPE_BYTES: Record<string, number> = { fp32: 4, fp16: 2, bf16: 2, int8: 1 };

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function compute(inputs: KVCacheInputs = {}) {
  const layers = positiveInteger(inputs.layers, 32);
  const context = positiveInteger(inputs.context, 2048);
  const heads = positiveInteger(inputs.heads, 32);
  const kvHeads = Math.min(heads, positiveInteger(inputs.kvHeads, 8));
  const headDim = positiveInteger(inputs.headDim, 128);
  const compressedDim = positiveInteger(inputs.compressedDim, 512);
  const rotaryDim = positiveInteger(inputs.rotaryDim, 64);
  const dtype = inputs.dtype && inputs.dtype in DTYPE_BYTES ? inputs.dtype : "fp16";
  const bytesPerElement = DTYPE_BYTES[dtype];
  const mha = 2 * layers * context * heads * headDim * bytesPerElement;
  const mqa = 2 * layers * context * headDim * bytesPerElement;
  const gqa = 2 * layers * context * kvHeads * headDim * bytesPerElement;
  const mla = layers * context * (compressedDim + rotaryDim) * bytesPerElement;
  return {
    layers,
    context,
    heads,
    kvHeads,
    headDim,
    compressedDim,
    rotaryDim,
    dtype,
    bytesPerElement,
    mha,
    mqa,
    gqa,
    mla,
    reductionMhaToGqa: mha / gqa,
    reductionMhaToMqa: mha / mqa,
    reductionMhaToMla: mha / mla,
  };
}
