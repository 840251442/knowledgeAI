import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminArticle, listAdminArticles } from "@/services/admin-article.service";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), { defaultValue: 1, min: 1 });
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), {
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  try {
    const result = await listAdminArticles({
      page,
      pageSize,
      actor: { id: user.id, role: user.role },
    });
    return apiOk({ ...result, page, pageSize });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

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
    categoryId?: unknown;
    tagIds?: unknown;
  };

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const contentMarkdown = typeof body.contentMarkdown === "string" ? body.contentMarkdown : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  const summary = typeof body.summary === "string" ? body.summary : null;
  const tagIds =
    Array.isArray(body.tagIds) && body.tagIds.every((x) => typeof x === "string")
      ? (body.tagIds as string[])
      : undefined;

  if (!title || !slug || !contentMarkdown || !categoryId) {
    return apiError("缺少必要字段", { status: 400, code: "MISSING_FIELDS" });
  }

  try {
    const created = await createAdminArticle({
      title,
      slug,
      summary,
      contentMarkdown,
      categoryId,
      tagIds,
      actor: { id: user.id, role: user.role },
    });
    return apiOk(created, { status: 201 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
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
