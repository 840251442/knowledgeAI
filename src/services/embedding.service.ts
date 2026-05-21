import OpenAI from "openai";

import type { ChunkDraft } from "@/lib/ai/chunking";

import { aiConfig, isRealSemanticSearchEnabled, requireAiConfig } from "@/config/ai";
import { buildQdrantPointId } from "@/lib/ai/qdrant";
import { extractTerms } from "@/lib/search/terms";

export type EmbeddedChunk = ChunkDraft & {
  pointId: string;
  vector: number[];
  embeddingStatus: "DONE";
  embeddingModel: string;
  embeddingVectorRef: string;
};

const MOCK_EMBEDDING_MODEL = "mock-local-v2";
let openAiClient: OpenAI | null | undefined;

export const EMBEDDING_MODEL = isRealSemanticSearchEnabled()
  ? aiConfig.embeddingModel
  : MOCK_EMBEDDING_MODEL;

function getOpenAiClient() {
  if (!isRealSemanticSearchEnabled()) return null;
  if (openAiClient) return openAiClient;

  const config = requireAiConfig();
  openAiClient = new OpenAI({
    apiKey: config.embeddingApiKey,
    baseURL: config.embeddingBaseUrl ?? undefined,
  });
  return openAiClient;
}

function encodeSignature(terms: string[]) {
  const encoded = encodeURIComponent(terms.join("|"));
  return encoded.length <= 220 ? encoded : encoded.slice(0, 220);
}

export function buildEmbeddingVectorRef(text: string) {
  const signatureTerms = extractTerms(text).slice(0, 16);
  return `mock:${encodeSignature(signatureTerms)}`;
}

export function parseEmbeddingVectorRef(vectorRef: string | null | undefined) {
  if (!vectorRef?.startsWith("mock:")) return [];

  try {
    return decodeURIComponent(vectorRef.slice(5))
      .split("|")
      .map((term) => term.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function buildQdrantVectorRef(pointId: string) {
  return aiConfig.qdrantCollection
    ? `qdrant:${aiConfig.qdrantCollection}:${pointId}`
    : `qdrant:unconfigured:${pointId}`;
}

export async function embedText(text: string) {
  const client = getOpenAiClient();
  if (!client) return [];

  const response = await client.embeddings.create({
    model: aiConfig.embeddingModel,
    input: text,
  });
  return response.data[0]?.embedding ?? [];
}

export async function buildEmbeddedChunks(chunks: ChunkDraft[], articleId: string): Promise<EmbeddedChunk[]> {
  if (!isRealSemanticSearchEnabled()) {
    return chunks.map((chunk) => {
      const pointId = buildQdrantPointId(articleId, chunk.chunkIndex);
      const text = `${chunk.headingPath ?? ""} ${chunk.content}`.trim();
      return {
        ...chunk,
        pointId,
        vector: [],
        embeddingStatus: "DONE" as const,
        embeddingModel: MOCK_EMBEDDING_MODEL,
        embeddingVectorRef: buildEmbeddingVectorRef(text),
      };
    });
  }

  const embeddedChunks: EmbeddedChunk[] = [];
  for (const chunk of chunks) {
    const pointId = buildQdrantPointId(articleId, chunk.chunkIndex);
    const text = `${chunk.headingPath ?? ""} ${chunk.content}`.trim();
    const vector = await embedText(text);
    embeddedChunks.push({
      ...chunk,
      pointId,
      vector,
      embeddingStatus: "DONE" as const,
      embeddingModel: EMBEDDING_MODEL,
      embeddingVectorRef: buildQdrantVectorRef(pointId),
    });
  }

  return embeddedChunks;
}

export function buildMockEmbeddedChunks(chunks: ChunkDraft[]) {
  return chunks.map((chunk) => ({
    ...chunk,
    embeddingStatus: "DONE" as const,
    embeddingModel: MOCK_EMBEDDING_MODEL,
    embeddingVectorRef: buildEmbeddingVectorRef(
      `${chunk.headingPath ?? ""} ${chunk.content}`.trim(),
    ),
  }));
}
