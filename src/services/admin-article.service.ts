import { prisma } from "@/lib/db/prisma";
import { invalidatePublicContentCaches } from "@/lib/redis/cache";
import { reindexArticleById } from "@/services/reindex.service";
import type { AuthRole } from "@/lib/auth/session";
import type { EmbeddingStatus, EmbeddingTaskStatus } from "@prisma/client";

type ArticleActor = {
  id: string;
  role: AuthRole;
};

type IndexState = "not_started" | "pending" | "running" | "success" | "failed";

const EMBEDDING_STATUS_DONE: EmbeddingStatus = "DONE";
const EMBEDDING_STATUS_FAILED: EmbeddingStatus = "FAILED";

function whereForActor(actor: ArticleActor) {
  if (actor.role === "ADMIN") return {};
  return { personalAuthorId: actor.id };
}

async function assertArticleAccessible(id: string, actor: ArticleActor) {
  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, slug: true, personalAuthorId: true },
  });

  if (!article) throw new Error("ARTICLE_NOT_FOUND");
  if (actor.role === "PERSONAL" && article.personalAuthorId !== actor.id) {
    throw new Error("ARTICLE_FORBIDDEN");
  }

  return article;
}

async function assertArticleSlugAvailable(input: { slug: string; excludeId?: string }) {
  const hit = await prisma.article.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (!hit) return;
  if (input.excludeId && hit.id === input.excludeId) return;
  throw new Error("Slug 已存在");
}

export async function getAdminArticleById(id: string, actor: ArticleActor) {
  const row = await prisma.article.findFirst({
    where: { id, ...whereForActor(actor) },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      contentMarkdown: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    contentMarkdown: row.contentMarkdown,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    tags: row.tags.map((t) => t.tag),
  };
}

export async function listAdminArticles(input?: { page?: number; pageSize?: number; actor?: ArticleActor }) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 20;
  const where = input?.actor ? whereForActor(input.actor) : {};

  const [total, rows] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    }),
  ]);

  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary,
      status: r.status,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
      category: r.category,
      tags: r.tags.map((t) => t.tag),
    })),
  };
}

export async function createAdminArticle(input: {
  title: string;
  slug: string;
  summary?: string | null;
  contentMarkdown: string;
  categoryId: string;
  tagIds?: string[];
  actor: ArticleActor;
}) {
  await assertArticleSlugAvailable({ slug: input.slug });
  const article = await prisma.article.create({
    data: {
      title: input.title,
      slug: input.slug,
      summary: input.summary ?? null,
      contentMarkdown: input.contentMarkdown,
      categoryId: input.categoryId,
      ...(input.actor.role === "ADMIN"
        ? { adminAuthorId: input.actor.id }
        : { personalAuthorId: input.actor.id }),
      status: "DRAFT",
      tags: input.tagIds?.length
        ? {
            createMany: {
              data: input.tagIds.map((tagId) => ({ tagId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  return article;
}

export async function updateAdminArticle(id: string, input: {
  title?: string;
  slug?: string;
  summary?: string | null;
  contentMarkdown?: string;
  categoryId?: string;
  tagIds?: string[];
  actor: ArticleActor;
}) {
  await assertArticleAccessible(id, input.actor);

  if (typeof input.slug === "string") {
    await assertArticleSlugAvailable({ slug: input.slug, excludeId: id });
  }
  const before = await prisma.article.findUnique({
    where: { id },
    select: { slug: true, status: true },
  });

  if (Array.isArray(input.tagIds)) {
    await prisma.articleTag.deleteMany({ where: { articleId: id } });
    if (input.tagIds.length > 0) {
      await prisma.articleTag.createMany({
        data: input.tagIds.map((tagId) => ({ articleId: id, tagId })),
        skipDuplicates: true,
      });
    }
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      ...(typeof input.title === "string" ? { title: input.title } : undefined),
      ...(typeof input.slug === "string" ? { slug: input.slug } : undefined),
      ...(input.summary !== undefined ? { summary: input.summary } : undefined),
      ...(typeof input.contentMarkdown === "string" ? { contentMarkdown: input.contentMarkdown } : undefined),
      ...(typeof input.categoryId === "string" ? { categoryId: input.categoryId } : undefined),
    },
    select: { id: true, slug: true },
  });

  if (before?.status === "PUBLISHED") {
    await reindexArticleById({
      articleId: updated.id,
      taskType: "UPDATE",
    });
  }

  await invalidatePublicContentCaches({
    slugs: [before?.slug, updated.slug],
    includeHomeLatest: true,
    includeSearchResults: true,
    includeHotTags: true,
  });

  return { id: updated.id };
}

export async function deleteAdminArticle(id: string, actor: ArticleActor) {
  const before = await assertArticleAccessible(id, actor);
  await prisma.article.delete({ where: { id } });

  await invalidatePublicContentCaches({
    slugs: [before?.slug],
    includeHomeLatest: true,
    includeSearchResults: true,
    includeHotTags: true,
  });

  return { id };
}

export async function publishAdminArticle(id: string, actor: ArticleActor) {
  await assertArticleAccessible(id, actor);
  const updated = await prisma.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    select: { id: true, slug: true },
  });

  await reindexArticleById({
    articleId: updated.id,
    taskType: "PUBLISH",
  });

  await invalidatePublicContentCaches({
    slugs: [updated.slug],
    includeHomeLatest: true,
    includeSearchResults: true,
    includeHotTags: true,
  });

  return { id: updated.id };
}

export async function unpublishAdminArticle(id: string, actor: ArticleActor) {
  await assertArticleAccessible(id, actor);
  const updated = await prisma.article.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
    select: { id: true, slug: true },
  });

  await invalidatePublicContentCaches({
    slugs: [updated.slug],
    includeHomeLatest: true,
    includeSearchResults: true,
    includeHotTags: true,
  });

  return { id: updated.id };
}

function mapTaskStatusToIndexState(status: EmbeddingTaskStatus): IndexState {
  if (status === "FAILED") return "failed";
  if (status === "RUNNING") return "running";
  if (status === "PENDING") return "pending";
  return "not_started";
}

export async function getAdminArticleIndexStatus(id: string, actor: ArticleActor) {
  const article = await assertArticleAccessible(id, actor);

  const [latestTask, chunkTotal, chunkDone, chunkFailed, latestSuccessTask] = await Promise.all([
    prisma.embeddingTask.findFirst({
      where: { articleId: article.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        taskType: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.articleChunk.count({ where: { articleId: article.id } }),
    prisma.articleChunk.count({ where: { articleId: article.id, embeddingStatus: EMBEDDING_STATUS_DONE } }),
    prisma.articleChunk.count({ where: { articleId: article.id, embeddingStatus: EMBEDDING_STATUS_FAILED } }),
    prisma.embeddingTask.findFirst({
      where: { articleId: article.id, status: "SUCCESS" },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
      select: { finishedAt: true },
    }),
  ]);

  let state: IndexState = "not_started";
  if (latestTask) {
    if (latestTask.status === "SUCCESS") {
      state = chunkDone > 0 ? "success" : "not_started";
    } else {
      state = mapTaskStatusToIndexState(latestTask.status);
    }
  }

  return {
    articleId: article.id,
    state,
    latestTask: latestTask
      ? {
          id: latestTask.id,
          taskType: latestTask.taskType,
          status: latestTask.status,
          startedAt: latestTask.startedAt ? latestTask.startedAt.toISOString() : null,
          finishedAt: latestTask.finishedAt ? latestTask.finishedAt.toISOString() : null,
          errorMessage: latestTask.errorMessage,
          createdAt: latestTask.createdAt.toISOString(),
        }
      : null,
    chunkSummary: {
      total: chunkTotal,
      done: chunkDone,
      failed: chunkFailed,
    },
    lastSuccessAt: latestSuccessTask?.finishedAt ? latestSuccessTask.finishedAt.toISOString() : null,
  };
}

export async function triggerAdminArticleReindex(id: string, actor: ArticleActor) {
  const article = await assertArticleAccessible(id, actor);

  const runningTask = await prisma.embeddingTask.findFirst({
    where: {
      articleId: article.id,
      status: { in: ["PENDING", "RUNNING"] },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true },
  });

  if (runningTask) {
    throw new Error("INDEX_TASK_RUNNING");
  }

  const result = await reindexArticleById({
    articleId: article.id,
    taskType: "MANUAL",
  });

  return {
    taskId: result.taskId,
    state: result.finalStatus === "SUCCESS" ? (result.chunkCount > 0 ? "success" : "not_started") : "failed",
  } as const;
}
