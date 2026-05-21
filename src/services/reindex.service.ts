import { isRealSemanticSearchEnabled, requireAiConfig } from "@/config/ai";
import { deleteArticlePoints, ensureQdrantCollection, getQdrantClient } from "@/lib/ai/qdrant";
import { prisma } from "@/lib/db/prisma";
import { chunkMarkdownByHeading } from "@/lib/ai/chunking";
import { buildEmbeddedChunks } from "@/services/embedding.service";

export async function reindexArticleById(input: {
  articleId: string;
  taskType: string;
}) {
  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: {
      id: true,
      slug: true,
      contentMarkdown: true,
    },
  });

  if (!article) {
    throw new Error("Article not found");
  }

  const task = await prisma.embeddingTask.create({
    data: {
      articleId: article.id,
      taskType: input.taskType,
      status: "RUNNING",
      startedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const embeddedChunks = await buildEmbeddedChunks(
      chunkMarkdownByHeading(article.contentMarkdown),
      article.id,
    );

    await prisma.$transaction(async (tx) => {
      await tx.articleChunk.deleteMany({
        where: { articleId: article.id },
      });

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

    if (isRealSemanticSearchEnabled()) {
      const config = requireAiConfig();
      const vectorSize = embeddedChunks.find((chunk) => chunk.vector.length > 0)?.vector.length ?? 0;
      if (vectorSize > 0) {
        await ensureQdrantCollection(vectorSize);
      }

      await deleteArticlePoints(article.id);

      if (embeddedChunks.length > 0) {
        const qdrant = getQdrantClient();
        await qdrant.upsert(config.qdrantCollection, {
          wait: true,
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
    }

    await prisma.embeddingTask.update({
      where: { id: task.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        errorMessage: null,
      },
    });

    return {
      articleId: article.id,
      slug: article.slug,
      chunkCount: embeddedChunks.length,
    };
  } catch (error) {
    await prisma.embeddingTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });
    throw error;
  }
}

export async function reindexAllArticles(taskType: string) {
  const articles = await prisma.article.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, slug: true },
  });

  const results = [];
  for (const article of articles) {
    results.push(await reindexArticleById({ articleId: article.id, taskType }));
  }

  return results;
}
