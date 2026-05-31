import { redirect } from "next/navigation";
import { Button } from "antd";

import { requireRole } from "@/lib/auth/require-role";
import { listAdminReviewQueue } from "@/services/review.service";

export const dynamic = "force-dynamic";

type ReviewItem = Awaited<ReturnType<typeof listAdminReviewQueue>>[number];

function reviewStatusLabel(item: ReviewItem) {
  const decision = item.latestReview?.decision;
  if (!decision) return "AI审核中";
  if (decision === "REJECTED") return "命中风险";
  if (decision === "MANUAL_REQUIRED") return "待人工";
  return "AI审核中";
}

function reviewDotClass(item: ReviewItem) {
  const decision = item.latestReview?.decision;
  if (decision === "REJECTED") return "dot dotWarn";
  if (decision === "MANUAL_REQUIRED") return "dot dotCyan";
  return "dot dotBrand";
}

export default async function AdminReviewsPage() {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/admin/articles");

  let data:
    | { type: "ok"; items: ReviewItem[] }
    | { type: "error"; message: string };

  try {
    const items = await listAdminReviewQueue();
    data = { type: "ok", items };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    data = {
      type: "error",
      message: raw.includes("Environment variable not found: DATABASE_URL")
        ? "DATABASE_URL 未配置"
        : "加载审核队列失败",
    };
  }

  return (
    <main>
      <div className="panel adminReviewsPanel" data-testid="admin-reviews-panel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>审核列表</strong>
            <span>AI审核中 / 命中风险 / 待人工复核</span>
          </div>
          <div className="actions">
            <span className="badge">共 {data.type === "ok" ? data.items.length : 0} 条</span>
          </div>
        </div>

        {data.type === "error" ? (
          <div className="errorBox">{data.message}</div>
        ) : data.items.length === 0 ? (
          <div className="adminArticlesEmptyWrap">
            <div className="adminArticlesEmptyCard">
              <div className="adminArticlesEmptyIcon" aria-hidden="true">
                <span className="dot dotCyan" />
              </div>
              <strong>当前没有待审核内容</strong>
              <p>当作者提交文章后，系统会将需要人工介入的内容放入这里统一处理。</p>
              <div className="adminArticlesEmptyActions">
                <Button className="btn" href="/admin/articles">
                  返回文章管理
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="tableWrap adminReviewsTableWrap">
            <div className="tableHeader adminReviewTableHeader">
              <div>文章</div>
              <div>状态</div>
              <div>作者</div>
              <div>风险原因</div>
              <div>更新时间</div>
            </div>
            {data.items.map((item) => (
              <div className="tableRow adminReviewTableRow" key={item.id}>
                <div className="cell">
                  <div className="commentArticle">
                    <strong className="commentArticleTitle">{item.title}</strong>
                    <span className="subMuted">{item.slug} · {item.category.name}</span>
                  </div>
                </div>
                <div className="cell">
                  <span className="badge">
                    <span className={reviewDotClass(item)} />
                    {reviewStatusLabel(item)}
                  </span>
                </div>
                <div className="cell">
                  <span className="subMuted">{item.personalAuthor?.email ?? "-"}</span>
                </div>
                <div className="cell">
                  <span className="subMuted adminReviewReason">{item.latestReview?.reason ?? "等待 AI 返回结果"}</span>
                </div>
                <div className="cell">
                  <span className="subMuted">{item.updatedAt.slice(0, 19).replace("T", " ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
