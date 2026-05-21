import crypto from "node:crypto";

import { QdrantClient } from "@qdrant/js-client-rest";

import { requireAiConfig } from "@/config/ai";

declare global {
  var __knowledgeAiQdrantClient: QdrantClient | undefined;
}

export function getQdrantClient() {
  if (globalThis.__knowledgeAiQdrantClient) {
    return globalThis.__knowledgeAiQdrantClient;
  }

  const config = requireAiConfig();
  const client = new QdrantClient({
    url: config.qdrantUrl,
    apiKey: config.qdrantApiKey,
  });

  globalThis.__knowledgeAiQdrantClient = client;
  return client;
}

export function buildQdrantPointId(articleId: string, chunkIndex: number) {
  const hex = crypto
    .createHash("sha256")
    .update(`${articleId}:${chunkIndex}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function ensureQdrantCollection(vectorSize: number) {
  const qdrant = getQdrantClient();
  const config = requireAiConfig();
  const collection = config.qdrantCollection;
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((item) => item.name === collection);

  if (exists) {
    await ensureArticleIdIndex();
    return;
  }

  await qdrant.createCollection(collection, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });

  await ensureArticleIdIndex();
}

async function ensureArticleIdIndex() {
  const qdrant = getQdrantClient();
  const config = requireAiConfig();

  try {
    await qdrant.createPayloadIndex(config.qdrantCollection, {
      field_name: "articleId",
      field_schema: "keyword",
      wait: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Qdrant returns 400 when index already exists; safe to ignore.
    if (message.includes("already exists") || message.includes("exists")) {
      return;
    }
    throw error;
  }
}

export async function deleteArticlePoints(articleId: string) {
  const qdrant = getQdrantClient();
  const config = requireAiConfig();

  await qdrant.delete(config.qdrantCollection, {
    wait: true,
    filter: {
      must: [
        {
          key: "articleId",
          match: { value: articleId },
        },
      ],
    },
  });
}
