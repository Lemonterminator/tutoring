export type DesignSpaceInputs = {
  totalParamsB?: number;
  activeParamsB?: number;
  layers?: number;
  sequenceLength?: number;
  heads?: number;
  kvHeads?: number;
  headDim?: number;
  bytesPerElement?: number;
  attentionVariant?: "mha" | "gqa" | "mla" | "sliding" | "sparse" | "hybrid";
  mlaLatentDim?: number;
  localWindow?: number;
  sparseTopK?: number;
  recurrenceRatio?: number;
  stateWidth?: number;
  activeExperts?: number;
  expertsTotal?: number;
  expertParallel?: boolean;
};

function positive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: unknown, low: number, high: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(high, Math.max(low, parsed)) : fallback;
}

export function compute(inputs: DesignSpaceInputs = {}) {
  const totalParamsB = positive(inputs.totalParamsB, 100);
  const activeParamsB = Math.min(totalParamsB, positive(inputs.activeParamsB, 20));
  const layers = Math.max(1, Math.floor(positive(inputs.layers, 32)));
  const sequenceLength = Math.max(1, Math.floor(positive(inputs.sequenceLength, 4096)));
  const heads = Math.max(1, Math.floor(positive(inputs.heads, 32)));
  const kvHeads = Math.min(heads, Math.max(1, Math.floor(positive(inputs.kvHeads, heads))));
  const headDim = Math.max(1, Math.floor(positive(inputs.headDim, 128)));
  const bytesPerElement = positive(inputs.bytesPerElement, 2);
  const attentionVariant = inputs.attentionVariant ?? "gqa";
  const mlaLatentDim = Math.max(1, Math.floor(positive(inputs.mlaLatentDim, 512)));
  const localWindow = Math.min(sequenceLength, Math.floor(positive(inputs.localWindow, 2048)));
  const sparseTopK = Math.min(sequenceLength, Math.floor(positive(inputs.sparseTopK, 256)));
  const recurrenceRatio = clamp(inputs.recurrenceRatio, 0, 1, 0);
  const stateWidth = Math.max(1, Math.floor(positive(inputs.stateWidth, 512)));
  const activeExperts = Math.max(1, Math.floor(positive(inputs.activeExperts, 1)));
  const expertsTotal = Math.max(activeExperts, Math.floor(positive(inputs.expertsTotal, activeExperts)));
  const expertParallel = inputs.expertParallel ?? false;

  const effectiveKvWidth = attentionVariant === "mla" ? mlaLatentDim : kvHeads * headDim;
  const denseKvWidth = heads * headDim;
  const cacheBytes = 2 * layers * sequenceLength * effectiveKvWidth * bytesPerElement;
  const denseMhaCacheBytes = 2 * layers * sequenceLength * denseKvWidth * bytesPerElement;
  const cacheReduction = denseMhaCacheBytes / cacheBytes;
  const attentionLayers = layers * (1 - recurrenceRatio);
  const recurrenceLayers = layers * recurrenceRatio;
  const keysPerQuery =
    attentionVariant === "sliding"
      ? localWindow
      : attentionVariant === "sparse"
        ? sparseTopK
        : attentionVariant === "hybrid"
          ? Math.min(sequenceLength, Math.max(localWindow, sparseTopK))
          : sequenceLength;
  const attentionInteractions = attentionLayers * heads * keysPerQuery;
  const attentionFlopsPerToken = 2 * attentionInteractions * headDim;
  const recurrenceFlopsPerToken = recurrenceLayers * stateWidth * stateWidth;
  const decodeWeightFlops = 2 * activeParamsB * 1e9;
  const decodeCostProxy = decodeWeightFlops + attentionFlopsPerToken + recurrenceFlopsPerToken;
  const residentWeightBytes = totalParamsB * 1e9 * bytesPerElement;
  const dispatchBytes =
    expertParallel && expertsTotal > activeExperts
      ? 2 * activeExperts * headDim * bytesPerElement
      : 0;
  const throughputProxyTokensPerSecond = 1e12 / Math.max(decodeCostProxy + dispatchBytes * 1e3, 1);

  return {
    totalParamsB,
    activeParamsB,
    layers,
    sequenceLength,
    heads,
    kvHeads,
    headDim,
    bytesPerElement,
    attentionVariant,
    effectiveKvWidth,
    denseKvWidth,
    cacheBytes,
    denseMhaCacheBytes,
    cacheReduction,
    attentionLayers,
    recurrenceLayers,
    keysPerQuery,
    attentionInteractions,
    attentionFlopsPerToken,
    recurrenceFlopsPerToken,
    decodeWeightFlops,
    decodeCostProxy,
    residentWeightBytes,
    dispatchBytes,
    throughputProxyTokensPerSecond,
  };
}
