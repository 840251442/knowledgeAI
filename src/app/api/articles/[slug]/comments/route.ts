import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { createComment, listPublishedComments } from "@/services/comment.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const comments = await listPublishedComments(slug);
    if (!comments) {
      return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    }
    return apiOk(comments);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await requireRole(["PERSONAL"]);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as { body?: unknown; authorName?: unknown };
  const content = typeof body.body === "string" ? body.body.trim() : "";
  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : null;

  if (!content) {
    return apiError("缺少评论内容", { status: 400, code: "MISSING_BODY" });
  }

  try {
    const created = await createComment({
      slug,
      body: content,
      authorName,
      actor: user ? { id: user.id, role: user.role } : null,
    });
    return apiOk(created, { status: 201 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "ARTICLE_NOT_FOUND") {
      return apiError("未找到文章", { status: 404, code: "NOT_FOUND" });
    }
    if (raw === "COMMENT_CLOSED") {
      return apiError("评论已关闭", { status: 400, code: "COMMENT_CLOSED" });
    }
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
