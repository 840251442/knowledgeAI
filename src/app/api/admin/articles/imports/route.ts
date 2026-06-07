import type { ArticleImportTaskStatus } from "@prisma/client";

import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { requireRole } from "@/lib/auth/require-role";
import { listImportTasks } from "@/services/article-import.service";

const IMPORT_TASK_STATUSES: ReadonlyArray<ArticleImportTaskStatus> = [
  "QUEUED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "RETRYING",
];

function parseImportStatus(value: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (IMPORT_TASK_STATUSES.includes(normalized as ArticleImportTaskStatus)) {
    return normalized as ArticleImportTaskStatus;
  }
  throw new Error("IMPORT_TASK_STATUS_INVALID");
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), { defaultValue: 1, min: 1 });
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), {
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  try {
    const status = parseImportStatus(url.searchParams.get("status"));
    const result = await listImportTasks({
      actor: { id: user.id, role: user.role },
      page,
      pageSize,
      status,
    });

    return apiOk({ ...result, page, pageSize, status: status ?? null });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw === "IMPORT_TASK_STATUS_INVALID") {
      return apiError("状态参数无效", { status: 400, code: "IMPORT_TASK_STATUS_INVALID" });
    }
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
