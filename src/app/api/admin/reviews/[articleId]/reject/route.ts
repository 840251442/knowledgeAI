import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { adminRejectArticle } from "@/services/review.service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const user = await requireRole(["ADMIN"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { articleId } = await params;

  let payload: unknown;
  try {
    payload = await request.json().catch(() => ({}));
  } catch {
    payload = {};
  }

  const reason =
    typeof (payload as { reason?: unknown }).reason === "string"
      ? (payload as { reason: string }).reason.trim()
      : "内容不符合合规要求";

  try {
    const result = await adminRejectArticle({ articleId, reviewerId: user.id, reason });
    return apiOk(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "ARTICLE_NOT_FOUND") return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
