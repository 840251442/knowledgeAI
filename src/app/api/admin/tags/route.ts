import { apiError, apiOk } from "@/lib/api/response";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import { createAdminTag, listAdminTags } from "@/services/admin-tag.service";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  try {
    const tags = await listAdminTags();
    return apiOk(tags);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

export async function POST(request: Request) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as { name?: unknown; slug?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!name || !slug) return apiError("缺少必要字段", { status: 400, code: "MISSING_FIELDS" });

  try {
    const created = await createAdminTag({ name, slug });
    return apiOk(created, { status: 201 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

