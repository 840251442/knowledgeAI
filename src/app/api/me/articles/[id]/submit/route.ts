import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { submitArticleForReview } from "@/services/review.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;

  try {
    const result = await submitArticleForReview({ articleId: id, authorId: user.id });
    return apiOk(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "ARTICLE_NOT_FOUND") return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    if (raw === "ARTICLE_ALREADY_PUBLISHED") return apiError("文章已发布", { status: 409, code: "ALREADY_PUBLISHED" });
    if (raw === "ARTICLE_ALREADY_PENDING") return apiError("文章已在审核中", { status: 409, code: "ALREADY_PENDING" });
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
