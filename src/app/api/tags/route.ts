import { apiError, apiOk } from "@/lib/api/response";
import { listTags } from "@/services/tag.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tags = await listTags();
    return apiOk(tags);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
