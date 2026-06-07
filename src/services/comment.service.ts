import { ArticleCommentStatus, ArticleStatus, CommentAuthorType } from "@prisma/client";

import type { AuthRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { AdminCommentItem, ArticleCommentSummary, CommentView } from "@/types/article";

type CommentActor = {
  id: string;
  role: AuthRole;
};

function mapComment(row: {
  id: string;
  articleId: string;
  authorType: CommentAuthorType;
  personalUserId: string | null;
  guestName: string | null;
  body: string;
  createdAt: Date;
  personalUser: { email: string | null; phone: string | null } | null;
}): CommentView {
  const isPersonal = row.authorType === CommentAuthorType.PERSONAL;
  const displayName = isPersonal
    ? row.personalUser?.email ?? row.personalUser?.phone ?? "已登录用户"
    : row.guestName?.trim() || "游客";

  return {
    id: row.id,
    articleId: row.articleId,
    author: {
      type: isPersonal ? CommentAuthorType.PERSONAL : CommentAuthorType.GUEST,
      userId: isPersonal ? row.personalUserId : null,
      displayName,
    },
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPublishedComments(slug: string): Promise<ArticleCommentSummary | null> {
  const article = await prisma.article.findFirst({
    where: { slug, status: ArticleStatus.PUBLISHED },
    select: { id: true, commentStatus: true },
  });

  if (!article) return null;

  const rows = await prisma.comment.findMany({
    where: { articleId: article.id },
    orderBy: [{ createdAt: "asc" }],
    include: {
      personalUser: { select: { email: true, phone: true } },
    },
  });

  return {
    articleId: article.id,
    commentStatus: article.commentStatus,
    items: rows.map((row) =>
      mapComment({
        ...row,
        personalUser: row.personalUser,
      }),
    ),
  };
}

export async function createComment(input: {
  slug: string;
  body: string;
  authorName?: string | null;
  actor?: CommentActor | null;
}): Promise<CommentView> {
  const article = await prisma.article.findFirst({
    where: { slug: input.slug, status: "PUBLISHED" },
    select: { id: true, commentStatus: true },
  });

  if (!article) throw new Error("ARTICLE_NOT_FOUND");
  if (article.commentStatus === ArticleCommentStatus.CLOSED) throw new Error("COMMENT_CLOSED");

  const isPersonal = input.actor?.role === "PERSONAL";
  const guestName = !isPersonal && typeof input.authorName === "string" ? input.authorName.trim() : null;

  const created = await prisma.comment.create({
    data: {
      articleId: article.id,
      authorType: isPersonal ? CommentAuthorType.PERSONAL : CommentAuthorType.GUEST,
      personalUserId: isPersonal ? input.actor?.id ?? null : null,
      guestName: guestName || null,
      body: input.body,
    },
    include: {
      personalUser: { select: { email: true, phone: true } },
    },
  });

  return mapComment({
    ...created,
    personalUser: created.personalUser,
  });
}

export async function deleteComment(id: string, actor: CommentActor) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, personalUserId: true },
  });

  if (!comment) throw new Error("COMMENT_NOT_FOUND");
  if (actor.role === "PERSONAL" && comment.personalUserId !== actor.id) {
    throw new Error("COMMENT_FORBIDDEN");
  }

  await prisma.comment.delete({ where: { id } });
  return { id };
}

export async function listAdminComments(input?: {
  page?: number;
  pageSize?: number;
  articleId?: string;
  authorType?: CommentAuthorType;
}) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 20;

  const where = {
    ...(input?.articleId ? { articleId: input.articleId } : undefined),
    ...(input?.authorType ? { authorType: input.authorType } : undefined),
  };

  const [total, rows] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        article: { select: { id: true, title: true, slug: true } },
        personalUser: { select: { email: true, phone: true } },
      },
    }),
  ]);

  return {
    total,
    items: rows.map((row) => {
      const mapped = mapComment({
        ...row,
        personalUser: row.personalUser,
      });
      return {
        ...mapped,
        article: row.article,
      } satisfies AdminCommentItem;
    }),
  };
}
