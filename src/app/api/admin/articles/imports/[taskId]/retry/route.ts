import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { retryImportTask } from "@/services/article-import.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { taskId } = await params;

  try {
    const result = await retryImportTask({
      taskId,
      actor: { id: user.id, role: user.role },
    });
    return apiOk(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "IMPORT_TASK_NOT_FOUND") {
      return apiError("导入任务不存在", { status: 404, code: "IMPORT_TASK_NOT_FOUND" });
    }
    if (raw === "IMPORT_TASK_NOT_RETRYABLE") {
      return apiError("当前状态不支持重试", { status: 409, code: "IMPORT_TASK_NOT_RETRYABLE" });
    }
    if (raw === "IMPORT_TASK_RETRY_LIMIT") {
      return apiError("已达到最大重试次数", { status: 409, code: "IMPORT_TASK_RETRY_LIMIT" });
    }
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
