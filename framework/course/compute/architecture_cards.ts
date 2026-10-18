export type CardStatus = "verified" | "unknown" | "derived";

export type CardField = {
  value: string;
  status: CardStatus;
  sourceUrl?: string;
  note?: string;
};

export type ArchitectureCard = {
  id: string;
  family: string;
  name: string;
  fields: Record<string, CardField>;
  sources: Array<{ label: string; url: string }>;
};

const verified = (value: string, sourceUrl: string, note?: string): CardField => ({
  value,
  status: "verified",
  sourceUrl,
  note,
});

const unknown = (note = "not stated in the checked public source"): CardField => ({
  value: "unknown",
  status: "unknown",
  note,
});

const deepseekV2 = "https://arxiv.org/abs/2405.04434";
const deepseekV3 = "https://arxiv.org/abs/2412.19437";
const deepseekV32 = "https://arxiv.org/abs/2512.02556";
const deepseekV4 = "https://fe-static.deepseek.com/chat/transparency/deepseek-V4-model-card-EN.pdf";
const qwen3 = "https://arxiv.org/abs/2505.09388";
const qwen35 = "https://qwen.ai/blog?email_hash=23463b99b62a72f26ed677cc556c44e8&id=qwen3.5";
const qwen36 = "https://qwen.ai/blog?id=qwen3.6-27b&lang=zh-CN";
const gptOss = "https://openai.com/index/gpt-oss-model-card/";
const gemma3 = "https://arxiv.org/abs/2503.19786";
const glm45 = "https://arxiv.org/abs/2508.06471";
const kimiK2 = "https://arxiv.org/abs/2507.20534";
const kimiK3 = "https://www.kimi.com/news/kimi-k3-open-source";
const llama4 = "https://ai.meta.com/blog/llama-4-multimodal-intelligence/";
const mamba2 = "https://arxiv.org/abs/2405.21060";

export const architectureCards: ArchitectureCard[] = [
  {
    id: "deepseek-v2",
    family: "DeepSeek",
    name: "DeepSeek-V2",
    fields: {
      identity: verified("236B total; 21B activated; 128K context; other identity fields unknown", deepseekV2),
      attention: verified("MLA", deepseekV2),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("DeepSeekMoE; detailed expert fields are recorded as unknown here", deepseekV2),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("none reported", deepseekV2),
      sources: verified("technical report", deepseekV2),
    },
    sources: [{ label: "DeepSeek-V2 technical report", url: deepseekV2 }],
  },
  {
    id: "deepseek-v3",
    family: "DeepSeek",
    name: "DeepSeek-V3",
    fields: {
      identity: verified("671B total; 37B activated", deepseekV3),
      attention: verified("MLA", deepseekV3),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("DeepSeekMoE; auxiliary-loss-free balancing", deepseekV3),
      residual: unknown(),
      objectives: verified("multi-token prediction", deepseekV3),
      numerics: verified("FP8 training path is reported", deepseekV3),
      recurrence: verified("none reported", deepseekV3),
      sources: verified("technical report", deepseekV3),
    },
    sources: [{ label: "DeepSeek-V3 technical report", url: deepseekV3 }],
  },
  {
    id: "deepseek-v3.2",
    family: "DeepSeek",
    name: "DeepSeek-V3.2",
    fields: {
      identity: verified("release date 2025-12-01; inherited dimensions not repeated here", deepseekV32),
      attention: verified("DSA sparse attention added; other inherited attention fields remain unknown", deepseekV32),
      position: unknown(),
      norm: unknown(),
      ffnMoe: unknown("the checked source focuses on the DSA modification"),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("none reported", deepseekV32),
      sources: verified("technical report", deepseekV32),
    },
    sources: [{ label: "DeepSeek-V3.2 technical report", url: deepseekV32 }],
  },
  {
    id: "deepseek-v4",
    family: "DeepSeek",
    name: "DeepSeek-V4 Pro / Flash",
    fields: {
      identity: verified("Pro: 1.6T total / 49B active; Flash: 284B total / 13B active; 1M context; MIT", deepseekV4),
      attention: verified("compressed sparse attention + heavily compressed attention; FP4 indexer", deepseekV4),
      position: verified("YaRN", deepseekV4),
      norm: unknown(),
      ffnMoe: verified("hash-routed MoE in early layers; sigmoid gating with expert bias", deepseekV4),
      residual: verified("multi-stream residual mixing (mHC)", deepseekV4),
      objectives: unknown(),
      numerics: verified("FP4 indexer; other precision fields unknown", deepseekV4),
      recurrence: verified("none reported", deepseekV4),
      sources: verified("model card / technical documentation", deepseekV4),
    },
    sources: [
      { label: "DeepSeek transparency center", url: "https://www.deepseek.com/en/transparency/" },
      { label: "DeepSeek-V4 model card", url: deepseekV4 },
      { label: "DeepSeek-V4 preview", url: "https://deepseek.com/en/news/v4-preview/" },
    ],
  },
  {
    id: "qwen3",
    family: "Qwen",
    name: "Qwen3 dense and MoE",
    fields: {
      identity: verified("0.6B–235B model series; exact card values are variant-specific", qwen3),
      attention: verified("GQA; QK-norm", qwen3),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("dense and MoE variants", qwen3),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("none reported for the Qwen3 base family", qwen3),
      sources: verified("technical report", qwen3),
    },
    sources: [{ label: "Qwen3 technical report", url: qwen3 }],
  },
  {
    id: "qwen3-next",
    family: "Qwen",
    name: "Qwen3-Next",
    fields: {
      identity: verified("80B total / 3B active variant shown by the referenced model card", "https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct"),
      attention: verified("Gated DeltaNet + gated attention hybrid", "https://qwen.ai/blog?id=qwen3.5"),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("sparse MoE", "https://qwen.ai/blog?id=qwen3.5"),
      residual: unknown(),
      objectives: verified("multi-token prediction is reported for the family", "https://qwen.ai/blog?id=qwen3.5"),
      numerics: unknown(),
      recurrence: verified("hybrid recurrence/attention", "https://qwen.ai/blog?id=qwen3.5"),
      sources: verified("model card and Qwen family report", "https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct"),
    },
    sources: [
      { label: "Qwen3-Next model card", url: "https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct" },
      { label: "Qwen3.5 architecture announcement", url: qwen35 },
    ],
  },
  {
    id: "qwen3.5",
    family: "Qwen",
    name: "Qwen3.5-397B-A17B",
    fields: {
      identity: verified("397B total / 17B active; context variants are source-specific", qwen35),
      attention: verified("Gated DeltaNet + gated attention hybrid", qwen35),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("higher-sparsity MoE", qwen35),
      residual: unknown(),
      objectives: verified("multi-token prediction", qwen35),
      numerics: unknown(),
      recurrence: verified("hybrid recurrence/attention", qwen35),
      sources: verified("official architecture announcement", qwen35),
    },
    sources: [{ label: "Qwen3.5 announcement", url: qwen35 }],
  },
  {
    id: "qwen3.6",
    family: "Qwen",
    name: "Qwen3.6-27B",
    fields: {
      identity: verified("27B dense variant", qwen36),
      attention: verified("Qwen3.5/3.6 family uses the reported hybrid design; this variant is dense", qwen36),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("dense for the 27B card", qwen36),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("hybrid Gated DeltaNet + gated attention family design", qwen36),
      sources: verified("official model announcement", qwen36),
    },
    sources: [{ label: "Qwen3.6-27B announcement", url: qwen36 }],
  },
  {
    id: "gpt-oss-20b",
    family: "OpenAI",
    name: "gpt-oss-20b",
    fields: {
      identity: verified("21B total / 3.6B active; 24 layers; 128K context; Apache 2.0", gptOss),
      attention: verified("alternating local banded and full attention; bandwidth 128; GQA group size 8; learned sinks", gptOss),
      position: verified("RoPE", gptOss),
      norm: verified("RMSNorm before attention and MoE blocks; Pre-LN placement", gptOss),
      ffnMoe: verified("32 experts; top-4 routing; gated SwiGLU", gptOss),
      residual: unknown(),
      objectives: unknown(),
      numerics: verified("MXFP4 inference path is reported", gptOss),
      recurrence: verified("none reported", gptOss),
      sources: verified("official model card", gptOss),
    },
    sources: [{ label: "gpt-oss model card", url: gptOss }],
  },
  {
    id: "gpt-oss-120b",
    family: "OpenAI",
    name: "gpt-oss-120b",
    fields: {
      identity: verified("117B total / 5.1B active; 36 layers; 128K context; Apache 2.0", gptOss),
      attention: verified("alternating local banded and full attention; bandwidth 128; GQA group size 8; learned sinks", gptOss),
      position: verified("RoPE", gptOss),
      norm: verified("RMSNorm before attention and MoE blocks; Pre-LN placement", gptOss),
      ffnMoe: verified("4 active experts; total expert count is recorded as source-version-sensitive", gptOss),
      residual: unknown(),
      objectives: unknown(),
      numerics: verified("MXFP4 inference path is reported", gptOss),
      recurrence: verified("none reported", gptOss),
      sources: verified("official model card", gptOss),
    },
    sources: [{ label: "gpt-oss model card", url: gptOss }],
  },
  {
    id: "gemma-3",
    family: "Google",
    name: "Gemma 3",
    fields: {
      identity: verified("1B, 4B, 12B, and 27B released sizes; at least 128K context", gemma3),
      attention: verified("short local attention with a larger local:global layer ratio", gemma3),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("dense family", gemma3),
      residual: unknown(),
      objectives: verified("distillation is reported in the technical report", gemma3),
      numerics: unknown(),
      recurrence: verified("none reported", gemma3),
      sources: verified("technical report", gemma3),
    },
    sources: [{ label: "Gemma 3 technical report", url: gemma3 }],
  },
  {
    id: "gemma-4",
    family: "Google",
    name: "Gemma 4",
    fields: {
      identity: verified("reported sizes include E2B/E4B, 12B, 26B-A4B, and 31B; verify variant cards", "https://ai.google.dev/gemma"),
      attention: unknown("architecture details beyond the public family description are not filled here"),
      position: unknown(),
      norm: unknown(),
      ffnMoe: unknown(),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: unknown(),
      sources: verified("official Gemma landing page; detailed architecture remains unknown", "https://ai.google.dev/gemma"),
    },
    sources: [{ label: "Google Gemma documentation", url: "https://ai.google.dev/gemma" }],
  },
  {
    id: "glm-4.5",
    family: "Z.ai",
    name: "GLM-4.5",
    fields: {
      identity: verified("355B total / 32B active; GLM-4.5-Air 106B", glm45),
      attention: verified("architecture details are variant-specific; partial RoPE and QK-norm are handoff axes", glm45),
      position: verified("partial RoPE", glm45),
      norm: verified("QK-norm", glm45),
      ffnMoe: verified("Mixture-of-Experts", glm45),
      residual: unknown(),
      objectives: verified("MTP layer is a handoff axis; exact objective wording remains source-gated", glm45),
      numerics: unknown(),
      recurrence: verified("none reported", glm45),
      sources: verified("technical report", glm45),
    },
    sources: [{ label: "GLM-4.5 technical report", url: glm45 }],
  },
  {
    id: "glm-5x",
    family: "Z.ai",
    name: "GLM-5.x",
    fields: {
      identity: verified("GLM-5.1/5.2/5.3 names are in the handoff snapshot; variant dimensions unknown", "https://z.ai"),
      attention: unknown("architecture details unverified"),
      position: unknown(),
      norm: unknown(),
      ffnMoe: unknown(),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: unknown(),
      sources: unknown("current architecture report not attached"),
    },
    sources: [{ label: "Z.ai official site", url: "https://z.ai" }],
  },
  {
    id: "kimi-k2",
    family: "Moonshot",
    name: "Kimi K2",
    fields: {
      identity: unknown("variant-specific values must be read from the technical report"),
      attention: verified("DeepSeek-style sparse/latent attention lineage is the axis under comparison", kimiK2),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("MoE family", kimiK2),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("Kimi Linear/KDA is the recurrence axis in the family map", kimiK2),
      sources: verified("technical report", kimiK2),
    },
    sources: [{ label: "Kimi K2 technical report", url: kimiK2 }],
  },
  {
    id: "kimi-k3",
    family: "Moonshot",
    name: "Kimi K3",
    fields: {
      identity: verified("2.8T total / 104B active; 1M context", kimiK3),
      attention: verified("Kimi Delta Attention (KDA) hybrid linear attention", kimiK3),
      position: unknown(),
      norm: unknown(),
      ffnMoe: verified("Mixture-of-Experts", kimiK3),
      residual: verified("attention residuals", kimiK3),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("KDA hybrid", kimiK3),
      sources: verified("official Kimi K3 release and technical report link", kimiK3),
    },
    sources: [{ label: "Kimi K3 open-source announcement", url: kimiK3 }],
  },
  {
    id: "llama-4",
    family: "Meta",
    name: "Llama 4",
    fields: {
      identity: unknown("variant-specific values belong to the model card"),
      attention: verified("chunked attention; interleaved NoPE layers are the handoff axis", llama4),
      position: verified("iRoPE with interleaved NoPE layers", llama4),
      norm: unknown(),
      ffnMoe: unknown(),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("none reported", llama4),
      sources: verified("official Meta release", llama4),
    },
    sources: [
      { label: "Meta Llama 4 announcement", url: llama4 },
      { label: "Llama 4 model card", url: "https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct" },
    ],
  },
  {
    id: "mamba2",
    family: "SSM hybrids",
    name: "Mamba-2",
    fields: {
      identity: unknown(),
      attention: verified("SSM/attention duality rather than a standard attention card", mamba2),
      position: unknown(),
      norm: unknown(),
      ffnMoe: unknown(),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("structured state-space model", mamba2),
      sources: verified("technical report", mamba2),
    },
    sources: [{ label: "Mamba-2 / SSD technical report", url: mamba2 }],
  },
  {
    id: "ssm-hybrids",
    family: "SSM hybrids",
    name: "Nemotron-H / Granite 4 / Falcon-H1 / MiniMax-M1/M3",
    fields: {
      identity: unknown("grouped teaching card; do not transfer fields across models"),
      attention: unknown("attention:SSM ratios remain model-specific"),
      position: unknown(),
      norm: unknown(),
      ffnMoe: unknown(),
      residual: unknown(),
      objectives: unknown(),
      numerics: unknown(),
      recurrence: verified("SSM-hybrid family axis", mamba2),
      sources: unknown("each model requires its own technical report or model card"),
    },
    sources: [{ label: "Mamba-2 axis reference", url: mamba2 }],
  },
  {
    id: "claude",
    family: "Anthropic",
    name: "Claude models",
    fields: {
      identity: unknown("Anthropic does not publish a complete architecture card"),
      attention: unknown("not public"),
      position: unknown("not public"),
      norm: unknown("not public"),
      ffnMoe: unknown("not public"),
      residual: unknown("not public"),
      objectives: unknown("not public"),
      numerics: unknown("not public"),
      recurrence: unknown("not public"),
      sources: verified("public model overview only; architecture remains unknown", "https://www.anthropic.com/claude"),
    },
    sources: [{ label: "Anthropic Claude overview", url: "https://www.anthropic.com/claude" }],
  },
];

export const CARD_FIELD_ORDER = [
  "identity",
  "attention",
  "position",
  "norm",
  "ffnMoe",
  "residual",
  "objectives",
  "numerics",
  "recurrence",
  "sources",
] as const;

export function getCard(id: string): ArchitectureCard {
  const card = architectureCards.find((candidate) => candidate.id === id);
  if (!card) throw new Error("unknown architecture card: " + id);
  return card;
}

export function compareCards(ids: string[] = ["deepseek-v3", "gpt-oss-120b"]) {
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.length > 4) {
    throw new Error("select between 2 and 4 cards");
  }
  const cards = unique.map(getCard);
  const rows = CARD_FIELD_ORDER.map((field) => ({
    field,
    cells: cards.map((card) => ({ cardId: card.id, ...card.fields[field] })),
    differs: new Set(cards.map((card) => card.fields[field].value)).size > 1,
  }));
  return { cards, rows };
}
