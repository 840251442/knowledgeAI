import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { listPublishedArticles } from "@/services/article.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), { defaultValue: 1, min: 1 });
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), {
    defaultValue: 10,
    min: 1,
    max: 50,
  });
  const categorySlug = url.searchParams.get("category") || undefined;
  const tagSlug = url.searchParams.get("tag") || undefined;

  try {
    const result = await listPublishedArticles({ page, pageSize, categorySlug, tagSlug });
    return apiOk({ ...result, page, pageSize });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
