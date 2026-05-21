# Qdrant Vercel Integration Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Replace the current mock semantic retrieval layer with a Vercel-friendly `Qdrant Cloud + OpenAI embeddings` implementation while preserving the existing search API contract and MySQL content model.
**Architecture:** Keep `MySQL + Prisma` as the system of record and use `Qdrant Cloud` only as the semantic index. `reindex.service.ts` continues to own chunk rebuilds, but now writes chunk metadata to MySQL and vectors to Qdrant; `vector-store.ts` switches from local term-overlap scoring to Qdrant top-K retrieval and returns the same `SimilarArticleHit` shape to `search.service.ts`.
**Tech Stack:** Next.js App Router, TypeScript, Prisma, MySQL, Qdrant Cloud HTTP API, OpenAI embeddings, Playwright
---

## File Structure Mapping

- Create: `src/config/ai.ts`
  - Centralize embedding and Qdrant environment configuration
- Create: `src/lib/ai/qdrant.ts`
  - Build and export the Qdrant client plus collection helpers
- Modify: `src/services/embedding.service.ts`
  - Replace mock signature generation with real embedding generation and point reference creation
- Modify: `src/lib/ai/vector-store.ts`
  - Query Qdrant for semantic hits and map them back to current result shape
- Modify: `src/services/reindex.service.ts`
  - Upsert vectors into Qdrant and treat external write failures as indexing failures
- Modify: `scripts/backfill-embeddings.ts`
  - Keep script entrypoint, but ensure it exercises the Qdrant-backed reindex flow
- Modify: `scripts/reindex-all.ts`
  - Keep script entrypoint, but ensure logging still matches new flow
- Modify: `.env.example`
  - Add Qdrant and OpenAI environment variables
- Modify: `README.md`
  - Document local/Vercel setup and reindex behavior with Qdrant
- Modify: `package.json`
  - Add Qdrant/OpenAI dependencies if required by chosen client libraries
- Optional modify: `tests/e2e/search-and-analytics.spec.ts`
  - Keep current search assertions stable; only adjust if deterministic semantic setup needs hooks

### Task 1: Add Qdrant/OpenAI Configuration Boundary
**Files:**
- Create: `src/config/ai.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add failing configuration access**
```ts
// src/config/ai.ts
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const aiConfig = {
  qdrantUrl: required("QDRANT_URL"),
  qdrantApiKey: required("QDRANT_API_KEY"),
  qdrantCollection: required("QDRANT_COLLECTION"),
  openAiApiKey: required("OPENAI_API_KEY"),
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
} as const;
```

- [ ] **Step 2: Add the environment variable examples**
```env
DATABASE_URL="mysql://user:password@localhost:3306/knowledgeai"
AUTH_SECRET="replace-with-a-long-random-string"
REDIS_URL="redis://127.0.0.1:6379"
QDRANT_URL="https://xxxxxx.us-east.aws.cloud.qdrant.io"
QDRANT_API_KEY="replace-with-qdrant-api-key"
QDRANT_COLLECTION="knowledgeai-article-chunks"
OPENAI_API_KEY="replace-with-openai-api-key"
EMBEDDING_MODEL="text-embedding-3-small"
```

- [ ] **Step 3: Add required runtime dependencies**
```json
{
  "dependencies": {
    "@qdrant/js-client-rest": "^1.15.0",
    "openai": "^5.12.2"
  }
}
```

- [ ] **Step 4: Run install and typecheck to verify the boundary**
Run:
```bash
npm install
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
```
Expected: dependencies install successfully and `typecheck` passes.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json .env.example src/config/ai.ts README.md
git commit -m "chore: add qdrant and embedding config"
```

### Task 2: Implement Qdrant Client and Collection Utilities
**Files:**
- Create: `src/lib/ai/qdrant.ts`
- Modify: `README.md`

- [ ] **Step 1: Create the Qdrant client wrapper**
```ts
// src/lib/ai/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";

import { aiConfig } from "@/config/ai";

let client: QdrantClient | null = null;

export function getQdrantClient() {
  if (client) return client;
  client = new QdrantClient({
    url: aiConfig.qdrantUrl,
    apiKey: aiConfig.qdrantApiKey,
  });
  return client;
}

export function buildQdrantPointId(articleId: string, chunkIndex: number) {
  return `${articleId}:${chunkIndex}`;
}
```

- [ ] **Step 2: Add collection bootstrap helper**
```ts
export async function ensureQdrantCollection(vectorSize: number) {
  const qdrant = getQdrantClient();
  const collection = aiConfig.qdrantCollection;
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((item) => item.name === collection);
  if (exists) return;

  await qdrant.createCollection(collection, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });
}
```

- [ ] **Step 3: Add point deletion helper per article**
```ts
export async function deleteArticlePoints(articleId: string) {
  const qdrant = getQdrantClient();
  await qdrant.delete(aiConfig.qdrantCollection, {
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
```

- [ ] **Step 4: Run diagnostics and typecheck**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
```
Expected: PASS, with `qdrant.ts` compiling cleanly.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ai/qdrant.ts README.md
git commit -m "feat: add qdrant client wrapper"
```

### Task 3: Replace Mock Embeddings With Real Embedding Calls
**Files:**
- Modify: `src/services/embedding.service.ts`
- Modify: `src/config/ai.ts`

- [ ] **Step 1: Replace mock-only exports with real embedding helpers**
```ts
// src/services/embedding.service.ts
import OpenAI from "openai";

import type { ChunkDraft } from "@/lib/ai/chunking";
import { aiConfig } from "@/config/ai";

const client = new OpenAI({ apiKey: aiConfig.openAiApiKey });
export const EMBEDDING_MODEL = aiConfig.embeddingModel;

export async function embedText(text: string) {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0]?.embedding ?? [];
}

export function buildQdrantVectorRef(pointId: string) {
  return `qdrant:${aiConfig.qdrantCollection}:${pointId}`;
}
```

- [ ] **Step 2: Add embedded chunk builder that returns vectors**
```ts
export async function buildEmbeddedChunks(chunks: ChunkDraft[], articleId: string) {
  const embedded = [];

  for (const chunk of chunks) {
    const text = `${chunk.headingPath ?? ""} ${chunk.content}`.trim();
    const vector = await embedText(text);
    const pointId = `${articleId}:${chunk.chunkIndex}`;

    embedded.push({
      ...chunk,
      pointId,
      vector,
      embeddingStatus: "DONE" as const,
      embeddingModel: EMBEDDING_MODEL,
      embeddingVectorRef: buildQdrantVectorRef(pointId),
    });
  }

  return embedded;
}
```

- [ ] **Step 3: Remove mock parsing logic from semantic path**
```ts
// keep parseEmbeddingVectorRef only if other code still imports it;
// otherwise remove the export and update call sites to stop depending on mock signatures
```

- [ ] **Step 4: Run typecheck**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
```
Expected: PASS, even though callers are not updated yet only after all imports are aligned.

- [ ] **Step 5: Commit**
```bash
git add src/services/embedding.service.ts src/config/ai.ts
git commit -m "feat: add real embedding generation"
```

### Task 4: Upsert Chunk Vectors Into Qdrant During Reindex
**Files:**
- Modify: `src/services/reindex.service.ts`
- Modify: `scripts/backfill-embeddings.ts`
- Modify: `scripts/reindex-all.ts`

- [ ] **Step 1: Update single-article reindex to build vectors with article id**
```ts
const embeddedChunks = await buildEmbeddedChunks(
  chunkMarkdownByHeading(article.contentMarkdown),
  article.id,
);
```

- [ ] **Step 2: Write MySQL chunks, then replace Qdrant points**
```ts
import {
  deleteArticlePoints,
  ensureQdrantCollection,
  getQdrantClient,
} from "@/lib/ai/qdrant";

await ensureQdrantCollection(embeddedChunks[0]?.vector.length ?? 1536);

await prisma.$transaction(async (tx) => {
  await tx.articleChunk.deleteMany({ where: { articleId: article.id } });
  if (embeddedChunks.length > 0) {
    await tx.articleChunk.createMany({
      data: embeddedChunks.map((chunk) => ({
        articleId: article.id,
        chunkIndex: chunk.chunkIndex,
        headingPath: chunk.headingPath,
        content: chunk.content,
        contentHash: chunk.contentHash,
        tokenCount: chunk.tokenCount,
        embeddingStatus: chunk.embeddingStatus,
        embeddingModel: chunk.embeddingModel,
        embeddingVectorRef: chunk.embeddingVectorRef,
      })),
    });
  }
});

await deleteArticlePoints(article.id);
if (embeddedChunks.length > 0) {
  const qdrant = getQdrantClient();
  await qdrant.upsert(aiConfig.qdrantCollection, {
    points: embeddedChunks.map((chunk) => ({
      id: chunk.pointId,
      vector: chunk.vector,
      payload: {
        articleId: article.id,
        slug: article.slug,
        chunkIndex: chunk.chunkIndex,
        headingPath: chunk.headingPath ?? "",
        excerpt: chunk.content,
      },
    })),
  });
}
```

- [ ] **Step 3: Preserve failure semantics**
```ts
// on any Qdrant or embedding error:
await prisma.embeddingTask.update({
  where: { id: task.id },
  data: {
    status: "FAILED",
    finishedAt: new Date(),
    errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
  },
});
```

- [ ] **Step 4: Run script-level verification**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run reindex:all
```
Expected: PASS, logging `reindexed ...` lines and final chunk total.

- [ ] **Step 5: Commit**
```bash
git add src/services/reindex.service.ts scripts/backfill-embeddings.ts scripts/reindex-all.ts
git commit -m "feat: write semantic index to qdrant"
```

### Task 5: Replace Local Semantic Scoring With Qdrant Retrieval
**Files:**
- Modify: `src/lib/ai/vector-store.ts`
- Modify: `src/services/search.service.ts`

- [ ] **Step 1: Replace local mock overlap logic with query embedding + Qdrant search**
```ts
// src/lib/ai/vector-store.ts
import { aiConfig } from "@/config/ai";
import { getQdrantClient } from "@/lib/ai/qdrant";
import { prisma } from "@/lib/db/prisma";
import { embedText } from "@/services/embedding.service";

export async function findSimilarArticles(query: string, topK: number) {
  const vector = await embedText(query);
  if (vector.length === 0) return [];

  const qdrant = getQdrantClient();
  const points = await qdrant.search(aiConfig.qdrantCollection, {
    vector,
    limit: topK * 3,
    with_payload: true,
  });

  // map top point per article and return current SimilarArticleHit shape
}
```

- [ ] **Step 2: Rebuild `SimilarArticleHit` from Qdrant payload and MySQL article data**
```ts
const articleIds = Array.from(new Set(points.map((point) => String(point.payload?.articleId ?? ""))).values())
  .filter(Boolean);

const articles = await prisma.article.findMany({
  where: {
    id: { in: articleIds },
    status: "PUBLISHED",
  },
  select: {
    id: true,
    title: true,
    slug: true,
    summary: true,
    contentMarkdown: true,
    publishedAt: true,
    updatedAt: true,
    category: { select: { id: true, name: true, slug: true } },
    tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  },
});
```

- [ ] **Step 3: Keep `search.service.ts` contract unchanged**
```ts
// search.service.ts should continue to do:
const [keywordRows, semanticHits] = await Promise.all([
  prisma.article.findMany({ ... }),
  findSimilarArticles(q, searchConfig.semanticTopK),
]);
```

- [ ] **Step 4: Run typecheck and search regression**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: PASS, with no front-end contract changes.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ai/vector-store.ts src/services/search.service.ts
git commit -m "feat: query semantic hits from qdrant"
```

### Task 6: Sync Docs And Validate End-to-End Search Flow
**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/plans/2026-05-19-ai-knowledge-base.md`

- [ ] **Step 1: Update README setup and semantic retrieval docs**
```md
- 向量数据库：`Qdrant Cloud`
- Embedding 提供方：`OpenAI text-embedding-3-small`
- 必需环境变量：`QDRANT_URL`、`QDRANT_API_KEY`、`QDRANT_COLLECTION`、`OPENAI_API_KEY`
- `npm run embeddings:backfill` / `npm run reindex:all` 现在会同时写入 MySQL `ArticleChunk` 与 Qdrant collection
```

- [ ] **Step 2: Update master plan status if the implementation is complete**
```md
- [x] 选定向量存储方案，并将其封装在 `lib/ai/vector-store.ts`
- [x] 在 `services/embedding.service.ts` 中实现 embedding 生成逻辑
- [x] 实现基于 top-K 切片相似度的语义召回
```

- [ ] **Step 3: Run full semantic regression**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: PASS, with search + publish flows stable after the Qdrant migration.

- [ ] **Step 4: Run diagnostics on touched files**
Run:
```text
GetDiagnostics for:
- src/config/ai.ts
- src/lib/ai/qdrant.ts
- src/services/embedding.service.ts
- src/services/reindex.service.ts
- src/lib/ai/vector-store.ts
- README.md
- .env.example
```
Expected: no new diagnostics introduced.

- [ ] **Step 5: Commit**
```bash
git add README.md .env.example docs/superpowers/plans/2026-05-19-ai-knowledge-base.md
git commit -m "docs: sync qdrant semantic search setup"
```

## Self-Review

- Spec coverage:
  - Qdrant Cloud selection and Vercel-friendly HTTP access are implemented through Task 1 and Task 2.
  - Real embedding generation is handled in Task 3.
  - MySQL/Qdrant dual responsibilities and reindex flow are handled in Task 4.
  - Semantic retrieval replacement while preserving `search.service.ts` contract is handled in Task 5.
  - Environment, docs, and regression verification are covered in Task 6.
- Placeholder scan:
  - No `TBD`, `TODO`, or deferred implementation markers remain.
  - Each verification step includes an exact command and expected result.
- Type consistency:
  - The plan keeps `findSimilarArticles()`, `SearchResultItem`, `SearchResponse`, and the current search API contract intact.
  - New configuration names are used consistently as `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `OPENAI_API_KEY`, and `EMBEDDING_MODEL`.
