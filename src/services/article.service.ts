import { ArticleStatus } from "@prisma/client";
import type { ArticleCommentStatus } from "@prisma/client";

import type { ArticleDetail, ArticleListItem } from "@/types/article";

import { getCacheVersion, readThroughJson } from "@/lib/redis/cache";
import { cacheKeys, cacheVersionKeys } from "@/lib/redis/cache-keys";
import { prisma } from "@/lib/db/prisma";

function mapArticleListItem(article: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: ArticleStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  category: { id: string; name: string; slug: string };
  tags: { tag: { id: string; name: string; slug: string } }[];
}): ArticleListItem {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    status: article.status,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    updatedAt: article.updatedAt.toISOString(),
    category: article.category,
    tags: article.tags.map((t) => t.tag),
  };
}

function mapArticleDetail(article: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
  contentMarkdown: string;
  commentStatus: ArticleCommentStatus;
  category: { id: string; name: string; slug: string };
  tags: { tag: { id: string; name: string; slug: string } }[];
}): ArticleDetail {
  return {
    ...mapArticleListItem(article),
    contentMarkdown: article.contentMarkdown,
    commentStatus: article.commentStatus,
  };
}

export async function listPublishedArticles(input?: {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  tagSlug?: string;
}) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 10;
  return fetchPublishedArticleList({
    page,
    pageSize,
    categorySlug: input?.categorySlug,
    tagSlug: input?.tagSlug,
  });
}

async function fetchPublishedArticleList(input: {
  page: number;
  pageSize: number;
  categorySlug?: string;
  tagSlug?: string;
}) {
  const page = input.page;
  const pageSize = input.pageSize;

  const where = {
    status: ArticleStatus.PUBLISHED,
    ...(input.categorySlug
      ? { category: { slug: input.categorySlug } }
      : undefined),
    ...(input.tagSlug ? { tags: { some: { tag: { slug: input.tagSlug } } } } : undefined),
  };

  const [total, rows] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    }),
  ]);

  return {
    total,
    items: rows.map((r) =>
      mapArticleListItem({
        ...r,
        tags: r.tags.map((t) => ({ tag: t.tag })),
      }),
    ),
  };
}

export async function listHomeLatestArticles(input?: { page?: number; pageSize?: number }) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 6;
  const version = await getCacheVersion(cacheVersionKeys.homeLatest);
  const key = cacheKeys.homeLatest({ version, page, pageSize });

  return readThroughJson({
    key,
    ttlSeconds: 300,
    loader: () => fetchPublishedArticleList({ page, pageSize }),
  });
}

export async function getPublishedArticleBySlug(slug: string) {
  return readThroughJson({
    key: cacheKeys.articleDetail(slug),
    ttlSeconds: 600,
    loader: async () => {
      const row = await prisma.article.findFirst({
        where: { slug, status: ArticleStatus.PUBLISHED },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
      });

      if (!row) return null;

      return mapArticleDetail({
        ...row,
        tags: row.tags.map((t) => ({ tag: t.tag })),
      });
    },
  });
}

export async function listPersonalArticles(authorId: string) {
  const rows = await prisma.article.findMany({
    where: { personalAuthorId: authorId },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
  });

  return rows.map((row) =>
    mapArticleListItem({
      ...row,
      tags: row.tags.map((t) => ({ tag: t.tag })),
    }),
  );
}

export async function getPersonalArticleById(input: { articleId: string; authorId: string }) {
  const row = await prisma.article.findFirst({
    where: { id: input.articleId, personalAuthorId: input.authorId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!row) return null;

  return mapArticleDetail({
    ...row,
    tags: row.tags.map((t) => ({ tag: t.tag })),
  });
}

export async function createPersonalArticle(input: {
  authorId: string;
  title: string;
  slug: string;
  summary?: string | null;
  contentMarkdown: string;
  categoryId: string;
  tagIds?: string[];
}) {
  const article = await prisma.article.create({
    data: {
      title: input.title,
      slug: input.slug,
      summary: input.summary ?? null,
      contentMarkdown: input.contentMarkdown,
      categoryId: input.categoryId,
      personalAuthorId: input.authorId,
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

export async function updatePersonalArticle(input: {
  articleId: string;
  authorId: string;
  title?: string;
  slug?: string;
  summary?: string | null;
  contentMarkdown?: string;
  categoryId?: string;
  tagIds?: string[];
}) {
  const article = await prisma.article.findFirst({
    where: { id: input.articleId, personalAuthorId: input.authorId },
    select: { id: true, slug: true, status: true },
  });

  if (!article) throw new Error("ARTICLE_NOT_FOUND");
  if (article.status === "PUBLISHED" || article.status === "PENDING_REVIEW") {
    throw new Error("ARTICLE_NOT_EDITABLE");
  }

  if (typeof input.slug === "string") {
    const hit = await prisma.article.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (hit && hit.id !== input.articleId) throw new Error("Slug 已存在");
  }

  if (Array.isArray(input.tagIds)) {
    await prisma.articleTag.deleteMany({ where: { articleId: input.articleId } });
    if (input.tagIds.length > 0) {
      await prisma.articleTag.createMany({
        data: input.tagIds.map((tagId) => ({ articleId: input.articleId, tagId })),
        skipDuplicates: true,
      });
    }
  }

  const updated = await prisma.article.update({
    where: { id: input.articleId },
    data: {
      ...(typeof input.title === "string" ? { title: input.title } : undefined),
      ...(typeof input.slug === "string" ? { slug: input.slug } : undefined),
      ...(input.summary !== undefined ? { summary: input.summary } : undefined),
      ...(typeof input.contentMarkdown === "string" ? { contentMarkdown: input.contentMarkdown } : undefined),
      ...(typeof input.categoryId === "string" ? { categoryId: input.categoryId } : undefined),
    },
    select: { id: true },
  });

  return updated;
}
