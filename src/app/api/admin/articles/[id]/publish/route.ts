import { apiError, apiOk } from "@/lib/api/response";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import { publishAdminArticle } from "@/services/admin-article.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;
  try {
    const updated = await publishAdminArticle(id);
    return apiOk(updated);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

