import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "antd";

import { requireRole } from "@/lib/auth/require-role";
import { listAdminArticles, publishAdminArticle, unpublishAdminArticle } from "@/services/admin-article.service";

export const dynamic = "force-dynamic";

function getStatusLabel(status: string) {
  if (status === "PUBLISHED") return "已发布";
  if (status === "DRAFT") return "草稿";
  if (status === "PENDING_REVIEW") return "待审核";
  return status;
}

export default async function AdminArticlesPage() {
  async function publishAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const actor = await requireRole(["ADMIN", "PERSONAL"]);
    if (!actor) redirect("/admin/login");

    await publishAdminArticle(id, { id: actor.id, role: actor.role });
    revalidatePath("/admin/articles");
  }

  async function unpublishAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const actor = await requireRole(["ADMIN", "PERSONAL"]);
    if (!actor) redirect("/admin/login");

    await unpublishAdminArticle(id, { id: actor.id, role: actor.role });
    revalidatePath("/admin/articles");
  }

  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) redirect("/admin/login");

  let data:
    | { type: "ok"; total: number; items: Awaited<ReturnType<typeof listAdminArticles>>["items"] }
    | { type: "error"; message: string };

  try {
    const result = await listAdminArticles({
      page: 1,
      pageSize: 50,
      actor: { id: user.id, role: user.role },
    });
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
      <div className="panel adminArticlesPanel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>文章管理</strong>
            <span>草稿/发布状态、编辑与发布操作</span>
          </div>
          <div className="actions">
            {user.role === "ADMIN" ? (
              <Button className="btn" href="/admin/reviews">
                审核列表
              </Button>
            ) : null}
            <Button className="btn btnGreen" href="/admin/articles/new" type="primary">
              新建文章
            </Button>
          </div>
        </div>

        <div className="adminArticlesBody">
          {data.type === "error" ? (
            <div className="errorBox">{data.message}</div>
          ) : data.items.length === 0 ? (
            <div className="adminArticlesEmptyWrap">
              <div className="adminArticlesEmptyCard" data-testid="admin-articles-empty-state">
                <div className="adminArticlesEmptyIcon" aria-hidden="true">
                  <span className="dot dotCyan" />
                </div>
                <strong>还没有文章</strong>
                <p>先创建第一篇内容，后续可以在这里统一编辑、发布和管理状态。</p>
                <div className="adminArticlesEmptyActions">
                  <Button className="btn btnGreen" href="/admin/articles/new" type="primary">
                    去新建文章
                  </Button>
                </div>
              </div>
            </div>
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
                        <span
                          className={
                            item.status === "PUBLISHED"
                              ? "dot dotGreen"
                              : item.status === "PENDING_REVIEW"
                                ? "dot dotCyan"
                                : "dot dotWarn"
                          }
                        />
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, color: "rgba(255,255,255,.66)", fontSize: 12 }}>
                      {item.slug} · 分类：{item.category.name} · 更新时间：{item.updatedAt.slice(0, 10)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Button className="btn" href={`/admin/articles/${item.id}/edit`}>
                      编辑
                    </Button>
                    <form action={publishAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button
                        className="btn"
                        htmlType="submit"
                        disabled={item.status === "PUBLISHED" || item.status === "PENDING_REVIEW"}
                      >
                        发布
                      </Button>
                    </form>
                    <form action={unpublishAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button className="btn" htmlType="submit" disabled={item.status !== "PUBLISHED"}>
                        下线
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
