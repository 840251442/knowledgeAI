import { apiError, apiOk } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/require-role";
import { createImportTasks } from "@/services/article-import.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("请求体必须是 multipart/form-data", { status: 400, code: "BAD_FORM_DATA" });
  }

  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  try {
    const result = await createImportTasks({
      files,
      actor: { id: user.id, role: user.role },
    });
    return apiOk(result, { status: 201 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "IMPORT_FILE_COUNT_INVALID") {
      return apiError("单次上传文件数量必须在 1 到 5 之间", { status: 400, code: "IMPORT_FILE_COUNT_INVALID" });
    }
    if (raw === "IMPORT_FILE_TYPE_UNSUPPORTED") {
      return apiError("存在不支持的文件类型", { status: 400, code: "IMPORT_FILE_TYPE_UNSUPPORTED" });
    }
    if (raw === "IMPORT_FILE_SIZE_INVALID") {
      return apiError("文件大小不合法或超过限制", { status: 400, code: "IMPORT_FILE_SIZE_INVALID" });
    }
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
