import { apiError, apiOk } from "@/lib/api/response";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import { deleteAdminTag, updateAdminTag } from "@/services/admin-tag.service";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as { name?: unknown; slug?: unknown };
  try {
    const updated = await updateAdminTag(id, {
      ...(typeof body.name === "string" ? { name: body.name } : undefined),
      ...(typeof body.slug === "string" ? { slug: body.slug } : undefined),
    });
    return apiOk(updated);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const { id } = await params;
  try {
    const deleted = await deleteAdminTag(id);
    return apiOk(deleted);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

