function optional(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeEmbeddingProvider(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "openai";
  if (normalized === "openai" || normalized === "qwen") return normalized;
  return "openai";
}

function defaultBaseUrlByProvider(provider: "openai" | "qwen") {
  if (provider === "qwen") {
    return "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }
  return null;
}

const embeddingProvider = normalizeEmbeddingProvider(process.env.EMBEDDING_PROVIDER);
const embeddingApiKey = optional("EMBEDDING_API_KEY") ?? optional("OPENAI_API_KEY");
const embeddingBaseUrl = optional("EMBEDDING_BASE_URL") ?? defaultBaseUrlByProvider(embeddingProvider);
const writerMaxCharsRaw = Number(process.env.AI_WRITER_MAX_CHARS ?? "2000");
const writerMaxChars = Number.isFinite(writerMaxCharsRaw)
  ? Math.max(200, Math.min(2000, Math.floor(writerMaxCharsRaw)))
  : 2000;

export const aiConfig = {
  qdrantUrl: optional("QDRANT_URL"),
  qdrantApiKey: optional("QDRANT_API_KEY"),
  qdrantCollection: optional("QDRANT_COLLECTION"),
  embeddingProvider,
  embeddingApiKey,
  embeddingBaseUrl,
  writerModel: process.env.AI_WRITER_MODEL?.trim() || "qwen-plus",
  reviewModel: process.env.AI_REVIEW_MODEL?.trim() || process.env.AI_WRITER_MODEL?.trim() || "qwen-plus",
  importTextModel: process.env.AI_IMPORT_TEXT_MODEL?.trim() || process.env.AI_WRITER_MODEL?.trim() || "qwen-plus",
  importPdfModel: process.env.AI_IMPORT_PDF_MODEL?.trim() || process.env.AI_WRITER_MODEL?.trim() || "qwen-plus",
  importVisionModel: process.env.AI_IMPORT_VISION_MODEL?.trim() || process.env.AI_WRITER_MODEL?.trim() || "qwen-vl-max",
  writerMaxChars,
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
} as const;

export function isRealSemanticSearchEnabled() {
  return Boolean(
    aiConfig.qdrantUrl &&
      aiConfig.qdrantApiKey &&
      aiConfig.qdrantCollection &&
      aiConfig.embeddingApiKey,
  );
}

export function requireAiConfig() {
  if (!isRealSemanticSearchEnabled()) {
    throw new Error(
      "QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION, and EMBEDDING_API_KEY (or OPENAI_API_KEY) are required",
    );
  }

  return {
    qdrantUrl: aiConfig.qdrantUrl!,
    qdrantApiKey: aiConfig.qdrantApiKey!,
    qdrantCollection: aiConfig.qdrantCollection!,
    embeddingProvider: aiConfig.embeddingProvider,
    embeddingApiKey: aiConfig.embeddingApiKey!,
    embeddingBaseUrl: aiConfig.embeddingBaseUrl,
    writerModel: aiConfig.writerModel,
    reviewModel: aiConfig.reviewModel,
    importTextModel: aiConfig.importTextModel,
    importPdfModel: aiConfig.importPdfModel,
    importVisionModel: aiConfig.importVisionModel,
    writerMaxChars: aiConfig.writerMaxChars,
    embeddingModel: aiConfig.embeddingModel,
  };
}
