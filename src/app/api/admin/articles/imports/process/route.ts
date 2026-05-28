import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { requireRole } from "@/lib/auth/require-role";
import { processImportTasksBatch } from "@/services/article-import.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const url = new URL(request.url);
  const limit = parsePositiveInt(url.searchParams.get("limit"), {
    defaultValue: 10,
    min: 1,
    max: 50,
  });

  try {
    const processed = await processImportTasksBatch({ limit });
    return apiOk({ processed, limit });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
