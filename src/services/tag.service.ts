import type { TagSummary } from "@/types/article";

import { prisma } from "@/lib/db/prisma";
import { getCacheVersion, readThroughJson } from "@/lib/redis/cache";
import { cacheKeys, cacheVersionKeys } from "@/lib/redis/cache-keys";

export async function listTags(): Promise<TagSummary[]> {
  const rows = await prisma.tag.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
  return rows;
}

async function fetchHotTags(limit: number): Promise<TagSummary[]> {
  const rows = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      articles: {
        where: {
          article: { status: "PUBLISHED" },
        },
        select: { id: true },
      },
    },
  });

  return rows
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      articleCount: tag.articles.length,
    }))
    .filter((tag) => tag.articleCount > 0)
    .sort((a, b) => {
      if (b.articleCount !== a.articleCount) return b.articleCount - a.articleCount;
      return a.name.localeCompare(b.name, "zh-CN");
    })
    .slice(0, limit)
    .map(({ articleCount: _articleCount, ...tag }) => tag);
}

export async function listHotTags(limit = 6): Promise<TagSummary[]> {
  const version = await getCacheVersion(cacheVersionKeys.hotTags);
  const key = cacheKeys.hotTags({ version, limit });

  return readThroughJson({
    key,
    ttlSeconds: 600,
    loader: () => fetchHotTags(limit),
  });
}
