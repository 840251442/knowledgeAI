import { apiError, apiOk } from "@/lib/api/response";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import {
  deleteAdminCategory,
  updateAdminCategory,
} from "@/services/admin-category.service";

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

  const body = payload as {
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    sortOrder?: unknown;
    isVisible?: unknown;
  };

  try {
    const updated = await updateAdminCategory(id, {
      ...(typeof body.name === "string" ? { name: body.name } : undefined),
      ...(typeof body.slug === "string" ? { slug: body.slug } : undefined),
      ...(body.description === null || typeof body.description === "string"
        ? { description: body.description as string | null }
        : undefined),
      ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : undefined),
      ...(typeof body.isVisible === "boolean" ? { isVisible: body.isVisible } : undefined),
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
    const deleted = await deleteAdminCategory(id);
    return apiOk(deleted);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

