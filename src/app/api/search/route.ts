import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { searchArticles } from "@/services/search.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = parsePositiveInt(url.searchParams.get("page"), { defaultValue: 1, min: 1 });
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), {
    defaultValue: 20,
    min: 1,
    max: 50,
  });

  if (!q) {
    return apiError("缺少搜索词", { status: 400, code: "MISSING_QUERY" });
  }

  try {
    const result = await searchArticles({ q, page, pageSize });
    return apiOk(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
