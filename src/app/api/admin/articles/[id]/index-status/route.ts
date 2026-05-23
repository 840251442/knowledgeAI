import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { getAdminArticleIndexStatus } from "@/services/admin-article.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;
  try {
    const status = await getAdminArticleIndexStatus(id, { id: user.id, role: user.role });
    return apiOk(status);
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
