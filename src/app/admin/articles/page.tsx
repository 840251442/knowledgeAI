import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdminUserId } from "@/lib/auth/require-admin";
import { listAdminArticles } from "@/services/admin-article.service";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const userId = await requireAdminUserId();
  if (!userId) redirect("/admin/login");

  let data:
    | { type: "ok"; total: number; items: Awaited<ReturnType<typeof listAdminArticles>>["items"] }
    | { type: "error"; message: string };

  try {
    const result = await listAdminArticles({ page: 1, pageSize: 50 });
    data = { type: "ok", total: result.total, items: result.items };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    data = {
      type: "error",
      message: raw.includes("Environment variable not found: DATABASE_URL")
        ? "DATABASE_URL 未配置"
        : "服务器错误",
    };
  }

  return (
    <main>
      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>文章管理</strong>
            <span>草稿/发布状态、编辑与发布操作</span>
          </div>
          <div className="actions">
            <Link className="btn btnGreen" href="/admin/articles/new">
              新建文章
            </Link>
          </div>
        </div>

        {data.type === "error" ? (
          <div className="errorBox">{data.message}</div>
        ) : (
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            {data.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,255,255,.05)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{item.title}</strong>
                    <span className="badge">
                      <span className={item.status === "PUBLISHED" ? "dot dotGreen" : "dot dotWarn"} />
                      {item.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: "rgba(255,255,255,.66)", fontSize: 12 }}>
                    {item.slug} · 分类：{item.category.name} · 更新时间：{item.updatedAt.slice(0, 10)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Link className="btn" href={`/admin/articles/${item.id}/edit`}>
                    编辑
                  </Link>
                  {item.status === "PUBLISHED" ? (
                    <Link className="btn btnPrimary" href={`/articles/${item.slug}`}>
                      查看
                    </Link>
                  ) : (
                    <span className="badge">
                      <span className="dot dotWarn" />
                      未发布
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
