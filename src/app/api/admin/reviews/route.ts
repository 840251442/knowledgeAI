import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { listAdminReviewQueue } from "@/services/review.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireRole(["ADMIN"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  try {
    const items = await listAdminReviewQueue();
    return apiOk({ items, total: items.length });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
