import { redirect } from "next/navigation";
import { Button } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { requireRole } from "@/lib/auth/require-role";
import { getAdminArticleById } from "@/services/admin-article.service";

export default async function AdminArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) redirect("/admin/login");

  const { id } = await params;

  let article: Awaited<ReturnType<typeof getAdminArticleById>>;
  try {
    article = await getAdminArticleById(id, { id: user.id, role: user.role });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const message = raw.includes("Environment variable not found: DATABASE_URL")
      ? "DATABASE_URL 未配置"
      : "服务器错误";

    return (
      <main>
        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">
              <strong>文章详情</strong>
              <span>加载失败</span>
            </div>
          </div>
          <div className="errorBox">{message}</div>
        </div>
      </main>
    );
  }

  if (!article) {
    return (
      <main>
        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">
              <strong>文章详情</strong>
              <span>未找到</span>
            </div>
          </div>
          <div className="errorBox">未找到文章</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>{article.title}</strong>
            <span>
              {article.slug} · {article.status === "PUBLISHED" ? "已发布" : "草稿"}
            </span>
          </div>
          <div className="actions">
            <Button className="btn" href="/admin/articles">
              返回列表
            </Button>
            <Button className="btn btnPrimary" href={`/admin/articles/${article.id}/edit`} type="primary">
              去编辑
            </Button>
          </div>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div className="subPanel" style={{ margin: 0 }}>
            <div className="subPanelHeader">
              <strong>文章信息</strong>
            </div>
            <div className="kvList">
              <div className="kvRow">
                <span className="kvKey">分类</span>
                <span className="kvVal">{article.category.name}</span>
              </div>
              <div className="kvRow">
                <span className="kvKey">标签</span>
                <span className="kvVal">{article.tags.length ? article.tags.map((t) => `#${t.name}`).join(" ") : "-"}</span>
              </div>
              <div className="kvRow">
                <span className="kvKey">更新时间</span>
                <span className="kvVal">{article.updatedAt.slice(0, 19).replace("T", " ")}</span>
              </div>
            </div>
          </div>

          <div className="pane" style={{ margin: 0, minHeight: 200 }}>
            <h4>摘要</h4>
            <div className="markdownPreview" style={{ marginTop: 0 }}>
              {article.summary || "（无摘要）"}
            </div>
          </div>

          <div className="pane" style={{ margin: 0 }}>
            <h4>正文</h4>
            <div className="markdown markdownPreview" style={{ marginTop: 0 }}>
              {article.contentMarkdown.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.contentMarkdown}</ReactMarkdown>
              ) : (
                <div className="markdownEmpty">（空内容）</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
