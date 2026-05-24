import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { requireRole } from "@/lib/auth/require-role";
import { listAdminComments } from "@/services/comment.service";
import { CommentAuthorType } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), { defaultValue: 1, min: 1 });
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), {
    defaultValue: 20,
    min: 1,
    max: 100,
  });
  const articleId = url.searchParams.get("articleId") ?? undefined;
  const authorType = url.searchParams.get("authorType") ?? undefined;

  const normalizedAuthorType = Object.values(CommentAuthorType).includes(authorType as CommentAuthorType)
    ? (authorType as CommentAuthorType)
    : undefined;

  try {
    const result = await listAdminComments({
      page,
      pageSize,
      articleId,
      authorType: normalizedAuthorType,
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
