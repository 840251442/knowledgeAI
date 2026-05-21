import { isRealSemanticSearchEnabled, requireAiConfig } from "@/config/ai";
import { getQdrantClient } from "@/lib/ai/qdrant";
import { prisma } from "@/lib/db/prisma";
import { extractTerms, overlapScore } from "@/lib/search/terms";
import { embedText, parseEmbeddingVectorRef } from "@/services/embedding.service";

type SemanticArticleRow = {
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

export type SimilarArticleHit = {
  articleId: string;
  row: SemanticArticleRow;
  semanticScore: number;
  excerpt: string | null;
};

function excerptFromContent(input: string, maxLen: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

export async function findSimilarArticles(query: string, topK: number) {
  if (isRealSemanticSearchEnabled()) {
    return findQdrantSimilarArticles(query, topK);
  }
  return findMockSimilarArticles(query, topK);
}

async function findMockSimilarArticles(query: string, topK: number) {
  const queryTerms = extractTerms(query);
  if (queryTerms.length === 0) return [];

  const rows = await prisma.articleChunk.findMany({
    where: {
      embeddingStatus: "DONE",
      article: { status: "PUBLISHED" },
    },
    select: {
      articleId: true,
      headingPath: true,
      content: true,
      embeddingVectorRef: true,
      article: {
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
      },
    },
  });

  const hits = new Map<string, SimilarArticleHit>();
  for (const row of rows) {
    const vectorTerms = parseEmbeddingVectorRef(row.embeddingVectorRef);
    const contentTerms = extractTerms(`${row.headingPath ?? ""} ${row.content}`);
    const vectorScore = overlapScore(queryTerms, vectorTerms);
    const contentScore = overlapScore(queryTerms, contentTerms);
    const semanticScore = vectorScore * 0.7 + contentScore * 0.3;
    if (semanticScore <= 0) continue;

    const hit: SimilarArticleHit = {
      articleId: row.articleId,
      row: row.article,
      semanticScore,
      excerpt: excerptFromContent(row.content, 160) ?? row.article.summary ?? null,
    };

    const current = hits.get(row.articleId);
    if (!current || semanticScore > current.semanticScore) {
      hits.set(row.articleId, hit);
    }
  }

  return Array.from(hits.values())
    .sort((a, b) => b.semanticScore - a.semanticScore)
    .slice(0, topK);
}

async function findQdrantSimilarArticles(query: string, topK: number) {
  const vector = await embedText(query);
  if (vector.length === 0) return [];

  const config = requireAiConfig();
  const qdrant = getQdrantClient();
  const points = await qdrant.search(config.qdrantCollection, {
    vector,
    limit: Math.max(topK * 3, topK),
    with_payload: true,
  });

  const articleIds = Array.from(
    new Set(
      points
        .map((point) => {
          const articleId = point.payload?.articleId;
          return typeof articleId === "string" ? articleId : "";
        })
        .filter(Boolean),
    ),
  );

  if (articleIds.length === 0) return [];

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

  const articleById = new Map(articles.map((article) => [article.id, article]));
  const hits = new Map<string, SimilarArticleHit>();
  for (const point of points) {
    const articleId = point.payload?.articleId;
    if (typeof articleId !== "string") continue;

    const row = articleById.get(articleId);
    if (!row) continue;

    const semanticScore = typeof point.score === "number" ? point.score : 0;
    if (semanticScore <= 0) continue;

    const payloadExcerpt = point.payload?.excerpt;
    const excerpt =
      (typeof payloadExcerpt === "string" ? excerptFromContent(payloadExcerpt, 160) : null) ??
      row.summary ??
      null;

    const hit: SimilarArticleHit = {
      articleId,
      row,
      semanticScore,
      excerpt,
    };

    const current = hits.get(articleId);
    if (!current || semanticScore > current.semanticScore) {
      hits.set(articleId, hit);
    }
  }

  return Array.from(hits.values())
    .sort((a, b) => b.semanticScore - a.semanticScore)
    .slice(0, topK);
}
