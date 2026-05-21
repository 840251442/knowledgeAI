import { apiError, apiOk } from "@/lib/api/response";
import { parsePositiveInt } from "@/lib/api/query";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), { defaultValue: 1, min: 1 });
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), {
    defaultValue: 20,
    min: 1,
    max: 100,
  });

  try {
    const [total, rows, topQueries, noResultQueries, avgLatency] = await Promise.all([
      prisma.searchLog.count(),
      prisma.searchLog.findMany({
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          query: true,
          queryType: true,
          resultCount: true,
          latencyMs: true,
          createdAt: true,
        },
      }),
      prisma.searchLog.groupBy({
        by: ["query"],
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: 10,
      }),
      prisma.searchLog.groupBy({
        by: ["query"],
        where: { resultCount: 0 },
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: 10,
      }),
      prisma.searchLog.aggregate({
        _avg: { latencyMs: true },
      }),
    ]);

    return apiOk({
      page,
      pageSize,
      total,
      items: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      aggregates: {
        avgLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
        topQueries: topQueries.map((x) => ({ query: x.query, count: x._count.query })),
        noResultQueries: noResultQueries.map((x) => ({ query: x.query, count: x._count.query })),
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

