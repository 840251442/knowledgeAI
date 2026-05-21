import type { SearchResponse, SearchResultItem } from "@/types/search";

import { searchConfig } from "@/config/search";
import { findSimilarArticles } from "@/lib/ai/vector-store";
import { prisma } from "@/lib/db/prisma";
import { getCacheVersion, readThroughJson } from "@/lib/redis/cache";
import { cacheKeys, cacheVersionKeys } from "@/lib/redis/cache-keys";
import { normalizeText } from "@/lib/search/terms";

type SearchArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  contentMarkdown: string;
  publishedAt: Date | null;
  updatedAt: Date;
  category: { id: string; name: string; slug: string };
  tags: { tag: { id: string; name: string; slug: string } }[];
};

function excerptFromMarkdown(markdown: string, maxLen: number) {
  const text = markdown
    .replaceAll(/```[\s\S]*?```/g, " ")
    .replaceAll(/`[^`]*`/g, " ")
    .replaceAll(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replaceAll(/\[[^\]]*]\([^)]*\)/g, " ")
    .replaceAll(/[#>*_~\-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

function freshnessScore(input: { publishedAt: Date | null; newestPublishedAt: number; oldestPublishedAt: number }) {
  const publishedAt = input.publishedAt ? input.publishedAt.getTime() : 0;
  if (input.newestPublishedAt === input.oldestPublishedAt) return publishedAt > 0 ? 1 : 0;
  return (publishedAt - input.oldestPublishedAt) / (input.newestPublishedAt - input.oldestPublishedAt);
}

function scoreForQuery(input: {
  q: string;
  title: string;
  summary: string | null;
  contentMarkdown: string;
  tagNames: string[];
}) {
  const q = input.q.toLowerCase();
  let score = 0;

  if (input.title.toLowerCase().includes(q)) score += 2.0;
  if ((input.summary ?? "").toLowerCase().includes(q)) score += 1.0;
  if (input.contentMarkdown.toLowerCase().includes(q)) score += 0.6;
  if (input.tagNames.some((t) => t.toLowerCase().includes(q))) score += 0.9;

  return score;
}

function mapResultItem(input: {
  row: SearchArticleRow;
  score: number;
  excerpt: string | null;
}): SearchResultItem {
  return {
    articleId: input.row.id,
    title: input.row.title,
    slug: input.row.slug,
    excerpt: input.excerpt,
    score: input.score,
    category: input.row.category,
    tags: input.row.tags.map((t) => t.tag),
  };
}

export async function searchArticles(input: {
  q: string;
  page: number;
  pageSize: number;
}): Promise<SearchResponse> {
  const q = input.q.trim();
  const page = Math.max(1, input.page);
  const pageSize = Math.min(50, Math.max(1, input.pageSize));
  const startedAt = Date.now();
  const version = await getCacheVersion(cacheVersionKeys.searchResults);
  const key = cacheKeys.searchResults({
    version,
    query: normalizeText(q),
    page,
    pageSize,
  });

  const response = await readThroughJson({
    key,
    ttlSeconds: searchConfig.searchCacheTtlSeconds,
    loader: () => buildSearchResponse({ q, page, pageSize }),
  });

  void prisma.searchLog
    .create({
      data: {
        query: q,
        queryType: response.queryType,
        resultCount: response.total,
        latencyMs: Date.now() - startedAt,
        topArticleId: response.items[0]?.articleId ?? null,
      },
    })
    .catch(() => null);

  return response;
}

async function buildSearchResponse(input: {
  q: string;
  page: number;
  pageSize: number;
}): Promise<SearchResponse> {
  const q = input.q.trim();
  const page = input.page;
  const pageSize = input.pageSize;
  const keywordWhere = {
    status: "PUBLISHED" as const,
    OR: [
      { title: { contains: q } },
      { summary: { contains: q } },
      { contentMarkdown: { contains: q } },
      { tags: { some: { tag: { name: { contains: q } } } } },
    ],
  };

  const [keywordRows, semanticHits] = await Promise.all([
    prisma.article.findMany({
      where: keywordWhere,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
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
    }),
    findSimilarArticles(q, searchConfig.semanticTopK).catch(() => []),
  ]);

  const keywordMap = new Map<
    string,
    { row: SearchArticleRow; keywordScore: number; excerpt: string | null }
  >();
  for (const row of keywordRows) {
    const tagNames = row.tags.map((t) => t.tag.name);
    const keywordScore = scoreForQuery({
      q,
      title: row.title,
      summary: row.summary,
      contentMarkdown: row.contentMarkdown,
      tagNames,
    });
    const excerpt = row.summary?.trim()
      ? row.summary.trim()
      : excerptFromMarkdown(row.contentMarkdown, 160);

    keywordMap.set(row.id, {
      row,
      keywordScore,
      excerpt: excerpt || null,
    });
  }

  const semanticMap = new Map<
    string,
    { row: SearchArticleRow; semanticScore: number; excerpt: string | null }
  >();
  for (const hit of semanticHits) {
    if (hit.semanticScore < searchConfig.semanticMinScore) continue;

    const current = semanticMap.get(hit.articleId);
    if (!current || hit.semanticScore > current.semanticScore) {
      semanticMap.set(hit.articleId, {
        row: hit.row,
        semanticScore: hit.semanticScore,
        excerpt: hit.excerpt,
      });
    }
  }

  const candidateIds = new Set<string>([
    ...Array.from(keywordMap.keys()),
    ...Array.from(semanticMap.keys()),
  ]);

  const newestPublishedAt = Math.max(
    0,
    ...Array.from(candidateIds, (id) => {
      const row = keywordMap.get(id)?.row ?? semanticMap.get(id)?.row;
      return row?.publishedAt?.getTime() ?? 0;
    }),
  );
  const oldestPublishedAt = Math.min(
    ...Array.from(candidateIds, (id) => {
      const row = keywordMap.get(id)?.row ?? semanticMap.get(id)?.row;
      return row?.publishedAt?.getTime() ?? 0;
    }).filter((value) => value > 0),
    newestPublishedAt || 0,
  );

  const items: SearchResultItem[] = Array.from(candidateIds)
    .map((id) => {
      const keywordHit = keywordMap.get(id);
      const semanticHit = semanticMap.get(id);
      const row = keywordHit?.row ?? semanticHit?.row;
      if (!row) return null;

      const keywordScore = keywordHit?.keywordScore ?? 0;
      const semanticScore = semanticHit?.semanticScore ?? 0;
      const score =
        keywordScore * searchConfig.keywordWeight +
        semanticScore * searchConfig.semanticWeight +
        freshnessScore({
          publishedAt: row.publishedAt,
          newestPublishedAt,
          oldestPublishedAt,
        }) *
          searchConfig.freshnessWeight;

      return mapResultItem({
        row,
        score,
        excerpt: keywordHit?.excerpt ?? semanticHit?.excerpt ?? null,
      });
    })
    .filter((item): item is SearchResultItem => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice((page - 1) * pageSize, page * pageSize);

  const response: SearchResponse = {
    query: q,
    queryType: semanticMap.size > 0 ? "HYBRID" : "KEYWORD",
    items,
    total: candidateIds.size,
  };

  return response;
}
