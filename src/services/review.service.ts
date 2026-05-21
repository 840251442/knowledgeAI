import OpenAI from "openai";

import { type ReviewDecision } from "@prisma/client";

import { aiConfig, requireAiConfig } from "@/config/ai";
import { prisma } from "@/lib/db/prisma";
import { invalidatePublicContentCaches } from "@/lib/redis/cache";
import { reindexArticleById } from "@/services/reindex.service";

const CONTENT_REVIEW_SYSTEM_PROMPT = [
  "你是内容合规审核助手，只审核内容是否合规，不评价文采或结构质量。",
  "你必须仅根据文章标题、摘要和正文判断是否存在违规广告、涉黄、涉政、违法、诈骗、恶意引流或明显平台风险。",
  "如果内容明显安全，输出 APPROVED。",
  "如果内容明确违规，输出 REJECTED。",
  "如果内容模糊、上下文不足、无法准确判断或需要人工复核，输出 MANUAL_REQUIRED。",
  "请只输出 JSON，格式为 {\"decision\":\"APPROVED|REJECTED|MANUAL_REQUIRED\",\"reason\":\"...\",\"riskTags\":[\"...\"] }。",
].join("\n");

type ReviewDecisionResult = {
  decision: ReviewDecision;
  reason: string;
  riskTags: string[];
  modelName: string;
};

function buildReviewClient() {
  const config = requireAiConfig();
  return new OpenAI({
    apiKey: config.embeddingApiKey,
    baseURL: config.embeddingBaseUrl ?? undefined,
  });
}

function normalizeRiskTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseDecisionPayload(raw: string): ReviewDecisionResult | null {
  try {
    const payload = JSON.parse(raw) as {
      decision?: unknown;
      reason?: unknown;
      riskTags?: unknown;
    };

    const decision = payload.decision;
    if (decision !== "APPROVED" && decision !== "REJECTED" && decision !== "MANUAL_REQUIRED") {
      return null;
    }

    return {
      decision,
      reason: typeof payload.reason === "string" && payload.reason.trim() ? payload.reason.trim() : "人工复核",
      riskTags: normalizeRiskTags(payload.riskTags),
      modelName: aiConfig.reviewModel,
    };
  } catch {
    return null;
  }
}

export async function runAiContentReview(input: {
  title: string;
  summary: string | null;
  contentMarkdown: string;
}) {
  if (process.env.E2E_FAST_REVIEW === "1" || process.env.NODE_ENV === "test") {
    const text = `${input.title}\n${input.summary ?? ""}\n${input.contentMarkdown}`.toLowerCase();
    const suspiciousKeywords = ["违法", "违规", "涉黄", "涉政", "诈骗", "引流", "risk", "风险"];
    const decision = suspiciousKeywords.some((keyword) => text.includes(keyword))
      ? ("REJECTED" as const)
      : ("MANUAL_REQUIRED" as const);

    return {
      decision,
      reason: decision === "REJECTED" ? "测试环境命中风险关键词" : "测试环境需要人工复核",
      riskTags: decision === "REJECTED" ? ["test-risk-keyword"] : ["test-manual-review"],
      modelName: aiConfig.reviewModel,
    } satisfies ReviewDecisionResult;
  }

  const client = buildReviewClient();
  const config = requireAiConfig();

  try {
    const completion = await client.chat.completions.create({
      model: config.reviewModel,
      temperature: 0,
      messages: [
        { role: "system", content: CONTENT_REVIEW_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            title: input.title,
            summary: input.summary,
            contentMarkdown: input.contentMarkdown,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      return {
        decision: "MANUAL_REQUIRED" as const,
        reason: "AI 未返回有效审核结果",
        riskTags: ["ai-empty-response"],
        modelName: config.reviewModel,
      } satisfies ReviewDecisionResult;
    }

    const parsed = parseDecisionPayload(raw.trim());
    if (!parsed) {
      return {
        decision: "MANUAL_REQUIRED" as const,
        reason: "AI 返回结果无法解析",
        riskTags: ["ai-invalid-json"],
        modelName: config.reviewModel,
      } satisfies ReviewDecisionResult;
    }

    return parsed;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "AI 审核异常";
    return {
      decision: "MANUAL_REQUIRED" as const,
      reason,
      riskTags: ["ai-exception"],
      modelName: config.reviewModel,
    } satisfies ReviewDecisionResult;
  }
}

export async function submitArticleForReview(input: { articleId: string; authorId: string }) {
  const article = await prisma.article.findFirst({
    where: { id: input.articleId, personalAuthorId: input.authorId },
    select: {
      id: true,
      title: true,
      summary: true,
      contentMarkdown: true,
      slug: true,
      status: true,
      personalAuthorId: true,
    },
  });

  if (!article) {
    throw new Error("ARTICLE_NOT_FOUND");
  }
  if (article.status === "PUBLISHED") {
    throw new Error("ARTICLE_ALREADY_PUBLISHED");
  }
  if (article.status === "PENDING_REVIEW") {
    throw new Error("ARTICLE_ALREADY_PENDING");
  }

  const aiResult = await runAiContentReview({
    title: article.title,
    summary: article.summary,
    contentMarkdown: article.contentMarkdown,
  });

  if (aiResult.decision === "APPROVED") {
    const updated = await prisma.article.update({
      where: { id: article.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      select: { id: true, slug: true },
    });

    await prisma.articleReview.create({
      data: {
        articleId: article.id,
        reviewType: "AI",
        decision: "APPROVED",
        reason: aiResult.reason,
        riskTags: aiResult.riskTags,
        modelName: aiResult.modelName,
      },
    });

    await reindexArticleById({ articleId: article.id, taskType: "PUBLISH" });
    await invalidatePublicContentCaches({
      slugs: [updated.slug],
      includeHomeLatest: true,
      includeSearchResults: true,
      includeHotTags: true,
    });

    return { id: article.id, status: "PUBLISHED" as const, decision: aiResult.decision };
  }

  await prisma.$transaction([
    prisma.article.update({
      where: { id: article.id },
      data: { status: "PENDING_REVIEW" },
      select: { id: true },
    }),
    prisma.articleReview.create({
      data: {
        articleId: article.id,
        reviewType: "AI",
        decision: aiResult.decision,
        reason: aiResult.reason,
        riskTags: aiResult.riskTags,
        modelName: aiResult.modelName,
      },
    }),
  ]);

  return { id: article.id, status: "PENDING_REVIEW" as const, decision: aiResult.decision };
}

export async function listAdminReviewQueue() {
  const rows = await prisma.article.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      personalAuthor: { select: { id: true, email: true, phone: true } },
      reviews: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    personalAuthor: row.personalAuthor,
    latestReview: row.reviews[0]
      ? {
          id: row.reviews[0].id,
          reviewType: row.reviews[0].reviewType,
          decision: row.reviews[0].decision,
          reason: row.reviews[0].reason,
          riskTags: row.reviews[0].riskTags,
          modelName: row.reviews[0].modelName,
          createdAt: row.reviews[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function adminApproveArticle(input: { articleId: string; reviewerId: string; reason?: string }) {
  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { id: true, slug: true, status: true },
  });
  if (!article) throw new Error("ARTICLE_NOT_FOUND");

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    select: { id: true, slug: true },
  });

  await prisma.articleReview.create({
    data: {
      articleId: article.id,
      reviewType: "HUMAN",
      decision: "APPROVED",
      reason: input.reason ?? "人工审核通过",
      reviewedByUserId: input.reviewerId,
    },
  });

  await reindexArticleById({ articleId: article.id, taskType: "PUBLISH" });
  await invalidatePublicContentCaches({
    slugs: [updated.slug],
    includeHomeLatest: true,
    includeSearchResults: true,
    includeHotTags: true,
  });

  return { id: updated.id, status: "PUBLISHED" as const };
}

export async function adminRejectArticle(input: { articleId: string; reviewerId: string; reason: string }) {
  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { id: true, slug: true },
  });
  if (!article) throw new Error("ARTICLE_NOT_FOUND");

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: { status: "REJECTED" },
    select: { id: true, slug: true },
  });

  await prisma.articleReview.create({
    data: {
      articleId: article.id,
      reviewType: "HUMAN",
      decision: "REJECTED",
      reason: input.reason,
      reviewedByUserId: input.reviewerId,
    },
  });

  await invalidatePublicContentCaches({
    slugs: [updated.slug],
    includeHomeLatest: true,
    includeSearchResults: true,
    includeHotTags: true,
  });

  return { id: updated.id, status: "REJECTED" as const };
}
