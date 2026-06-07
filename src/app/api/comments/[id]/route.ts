import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { deleteComment } from "@/services/comment.service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;

  try {
    const deleted = await deleteComment(id, { id: user.id, role: user.role });
    return apiOk(deleted);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "COMMENT_NOT_FOUND") {
      return apiError("未找到评论", { status: 404, code: "NOT_FOUND" });
    }
    if (raw === "COMMENT_FORBIDDEN") {
      return apiError("无权限", { status: 403, code: "FORBIDDEN" });
    }
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
