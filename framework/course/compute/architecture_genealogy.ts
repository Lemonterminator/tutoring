export type GenealogyAxis =
  | "attention"
  | "cache"
  | "position"
  | "routing"
  | "recurrence"
  | "window"
  | "sparse"
  | "residual";

export type GenealogyNode = {
  id: string;
  label: string;
  family: string;
  year: number;
  axes: GenealogyAxis[];
  sourceUrl: string | null;
  sourceStatus: "verified" | "unknown";
};

export type GenealogyEdge = {
  from: string;
  to: string;
  axis: GenealogyAxis;
  label: string;
};

export type GenealogyInputs = {
  yearMin?: number;
  yearMax?: number;
  axis?: GenealogyAxis | "all";
  family?: string | "all";
  includeUnknown?: boolean;
};

const nodes: GenealogyNode[] = [
  {
    id: "transformer",
    label: "Transformer (2017)",
    family: "Transformer",
    year: 2017,
    axes: ["attention", "position"],
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    sourceStatus: "verified",
  },
  {
    id: "gpt2",
    label: "GPT-2",
    family: "OpenAI",
    year: 2019,
    axes: ["attention", "position"],
    sourceUrl: "https://openai.com/index/better-language-models/",
    sourceStatus: "verified",
  },
  {
    id: "llama",
    label: "Llama",
    family: "Meta",
    year: 2023,
    axes: ["attention", "position"],
    sourceUrl: "https://arxiv.org/abs/2302.13971",
    sourceStatus: "verified",
  },
  {
    id: "mistral",
    label: "Mistral",
    family: "Mistral",
    year: 2023,
    axes: ["attention", "window"],
    sourceUrl: "https://arxiv.org/abs/2310.06825",
    sourceStatus: "verified",
  },
  {
    id: "mamba",
    label: "Mamba / SSM",
    family: "SSM",
    year: 2023,
    axes: ["recurrence"],
    sourceUrl: "https://arxiv.org/abs/2312.00752",
    sourceStatus: "verified",
  },
  {
    id: "deepseek-v2",
    label: "DeepSeek-V2",
    family: "DeepSeek",
    year: 2024,
    axes: ["attention", "cache", "routing"],
    sourceUrl: "https://arxiv.org/abs/2405.04434",
    sourceStatus: "verified",
  },
  {
    id: "deepseek-v3",
    label: "DeepSeek-V3",
    family: "DeepSeek",
    year: 2024,
    axes: ["attention", "cache", "routing"],
    sourceUrl: "https://arxiv.org/abs/2412.19437",
    sourceStatus: "verified",
  },
  {
    id: "gemma-3",
    label: "Gemma 3",
    family: "Google",
    year: 2025,
    axes: ["attention", "position", "window"],
    sourceUrl: "https://arxiv.org/abs/2503.19786",
    sourceStatus: "verified",
  },
  {
    id: "qwen3",
    label: "Qwen3",
    family: "Qwen",
    year: 2025,
    axes: ["attention", "cache", "routing"],
    sourceUrl: "https://arxiv.org/abs/2505.09388",
    sourceStatus: "verified",
  },
  {
    id: "gpt-oss",
    label: "gpt-oss",
    family: "OpenAI",
    year: 2025,
    axes: ["attention", "cache", "routing", "window"],
    sourceUrl: "https://openai.com/index/gpt-oss-model-card/",
    sourceStatus: "verified",
  },
  {
    id: "deepseek-v3.2",
    label: "DeepSeek-V3.2",
    family: "DeepSeek",
    year: 2025,
    axes: ["attention", "cache", "sparse"],
    sourceUrl: "https://arxiv.org/abs/2512.02556",
    sourceStatus: "verified",
  },
  {
    id: "qwen3-next",
    label: "Qwen3-Next",
    family: "Qwen",
    year: 2025,
    axes: ["recurrence", "routing", "attention"],
    sourceUrl: "https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct",
    sourceStatus: "verified",
  },
  {
    id: "kimi-k2",
    label: "Kimi K2 / K3",
    family: "Moonshot",
    year: 2025,
    axes: ["cache", "routing", "recurrence"],
    sourceUrl: "https://arxiv.org/abs/2507.20534",
    sourceStatus: "verified",
  },
  {
    id: "glm-45",
    label: "GLM-4.5 / 5.x",
    family: "Z.ai",
    year: 2025,
    axes: ["attention", "position", "routing"],
    sourceUrl: "https://arxiv.org/abs/2508.06471",
    sourceStatus: "verified",
  },
  {
    id: "deepseek-v4",
    label: "DeepSeek-V4",
    family: "DeepSeek",
    year: 2026,
    axes: ["attention", "cache", "routing", "residual", "position"],
    sourceUrl: null,
    sourceStatus: "unknown",
  },
  {
    id: "qwen3.5",
    label: "Qwen3.5 / 3.6",
    family: "Qwen",
    year: 2026,
    axes: ["recurrence", "routing", "attention"],
    sourceUrl: null,
    sourceStatus: "unknown",
  },
  {
    id: "nemotron-h",
    label: "Nemotron-H / Granite 4",
    family: "SSM hybrids",
    year: 2025,
    axes: ["recurrence", "attention"],
    sourceUrl: null,
    sourceStatus: "unknown",
  },
];

const edges: GenealogyEdge[] = [
  { from: "transformer", to: "gpt2", axis: "attention", label: "decoder attention" },
  { from: "transformer", to: "llama", axis: "attention", label: "decoder attention" },
  { from: "transformer", to: "mistral", axis: "window", label: "sliding window" },
  { from: "transformer", to: "gemma-3", axis: "window", label: "local/global windows" },
  { from: "transformer", to: "gpt-oss", axis: "window", label: "banded/full alternation" },
  { from: "transformer", to: "deepseek-v2", axis: "cache", label: "MLA + MoE" },
  { from: "deepseek-v2", to: "deepseek-v3", axis: "routing", label: "MLA + DeepSeekMoE" },
  { from: "deepseek-v3", to: "deepseek-v3.2", axis: "sparse", label: "sparse indexer" },
  { from: "deepseek-v3.2", to: "deepseek-v4", axis: "residual", label: "compressed attention + mHC" },
  { from: "deepseek-v2", to: "kimi-k2", axis: "cache", label: "MLA/MoE lineage" },
  { from: "transformer", to: "qwen3", axis: "cache", label: "GQA + MoE" },
  { from: "qwen3", to: "qwen3-next", axis: "recurrence", label: "Gated DeltaNet hybrid" },
  { from: "qwen3-next", to: "qwen3.5", axis: "recurrence", label: "hybrid recurrence" },
  { from: "mamba", to: "qwen3-next", axis: "recurrence", label: "selective recurrence" },
  { from: "mamba", to: "nemotron-h", axis: "recurrence", label: "SSM hybrid" },
  { from: "transformer", to: "glm-45", axis: "routing", label: "MoE/position choices" },
];

function boundedYear(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(2026, Math.max(2017, Math.floor(parsed))) : fallback;
}

export function compute(inputs: GenealogyInputs = {}) {
  const yearMin = boundedYear(inputs.yearMin, 2017);
  const yearMax = Math.max(yearMin, boundedYear(inputs.yearMax, 2026));
  const axis = inputs.axis ?? "all";
  const family = inputs.family ?? "all";
  const includeUnknown = inputs.includeUnknown ?? true;

  const visibleNodes = nodes.filter((node) => {
    const inYears = node.year >= yearMin && node.year <= yearMax;
    const inFamily = family === "all" || node.family === family;
    const inAxis = axis === "all" || node.axes.includes(axis);
    const sourceAllowed = includeUnknown || node.sourceStatus !== "unknown";
    return inYears && inFamily && inAxis && sourceAllowed;
  });
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter(
    (edge) =>
      visibleIds.has(edge.from) &&
      visibleIds.has(edge.to) &&
      (axis === "all" || edge.axis === axis),
  );
  const familyCounts = Object.fromEntries(
    [...new Set(visibleNodes.map((node) => node.family))].map((name) => [
      name,
      visibleNodes.filter((node) => node.family === name).length,
    ]),
  );
  return {
    yearMin,
    yearMax,
    axis,
    family,
    includeUnknown,
    nodes: visibleNodes,
    edges: visibleEdges,
    familyCounts,
    sourceCount: visibleNodes.filter((node) => node.sourceUrl !== null).length,
    unknownSourceIds: visibleNodes
      .filter((node) => node.sourceStatus === "unknown")
      .map((node) => node.id),
  };
}
