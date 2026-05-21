import { apiError, apiOk } from "@/lib/api/response";
import { getPublishedArticleBySlug } from "@/services/article.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const article = await getPublishedArticleBySlug(slug);
    if (!article) {
      return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    }
    return apiOk(article);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
