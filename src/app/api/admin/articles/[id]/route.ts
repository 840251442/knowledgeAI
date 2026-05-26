import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import {
  deleteAdminArticle,
  getAdminArticleById,
  updateAdminArticle,
} from "@/services/admin-article.service";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;

  try {
    const article = await getAdminArticleById(id, { id: user.id, role: user.role });
    if (!article) return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    return apiOk(article);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as {
    title?: unknown;
    slug?: unknown;
    summary?: unknown;
    contentMarkdown?: unknown;
    content?: unknown;
    body?: unknown;
    categoryId?: unknown;
    tagIds?: unknown;
  };

  const tagIds =
    Array.isArray(body.tagIds) && body.tagIds.every((x) => typeof x === "string")
      ? (body.tagIds as string[])
      : undefined;

  try {
    const contentMarkdown =
      typeof body.contentMarkdown === "string"
        ? body.contentMarkdown
        : typeof body.content === "string"
          ? body.content
          : typeof body.body === "string"
            ? body.body
            : undefined;

    const updated = await updateAdminArticle(id, {
      ...(typeof body.title === "string" ? { title: body.title } : undefined),
      ...(typeof body.slug === "string" ? { slug: body.slug } : undefined),
      ...(body.summary === null || typeof body.summary === "string" ? { summary: body.summary as string | null } : undefined),
      ...(typeof contentMarkdown === "string" ? { contentMarkdown } : undefined),
      ...(typeof body.categoryId === "string" ? { categoryId: body.categoryId } : undefined),
      ...(tagIds ? { tagIds } : undefined),
      actor: { id: user.id, role: user.role },
    });
    return apiOk(updated);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "ARTICLE_FORBIDDEN") return apiError("无权限", { status: 403, code: "FORBIDDEN" });
    if (raw === "ARTICLE_NOT_FOUND") return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    if (raw === "Slug 已存在") return apiError(raw, { status: 400, code: "SLUG_TAKEN" });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("Slug 已存在", { status: 400, code: "SLUG_TAKEN" });
    }
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;
  try {
    const deleted = await deleteAdminArticle(id, { id: user.id, role: user.role });
    return apiOk(deleted);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "ARTICLE_FORBIDDEN") return apiError("无权限", { status: 403, code: "FORBIDDEN" });
    if (raw === "ARTICLE_NOT_FOUND") return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
