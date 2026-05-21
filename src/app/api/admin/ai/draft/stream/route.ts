import { apiError } from "@/lib/api/response";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import { streamArticleDraft } from "@/services/ai-article-agent.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const keyword =
    typeof (payload as { keyword?: unknown }).keyword === "string"
      ? (payload as { keyword: string }).keyword.trim()
      : "";

  if (!keyword) {
    return apiError("缺少关键词", { status: 400, code: "MISSING_KEYWORD" });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of streamArticleDraft({ keyword })) {
          controller.enqueue(
            encoder.encode(`event: delta\ndata: ${JSON.stringify({ content: delta })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "生成失败";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
