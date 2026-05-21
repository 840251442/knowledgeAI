import Link from "next/link";
import { redirect } from "next/navigation";

import PersonalLogoutButton from "@/components/auth/PersonalLogoutButton";
import { requireRole } from "@/lib/auth/require-role";
import { listPersonalArticles } from "@/services/article.service";

function statusClass(status: string) {
  if (status === "PUBLISHED") return "statusPill statusPillPublished";
  if (status === "PENDING_REVIEW") return "statusPill statusPillPending";
  if (status === "REJECTED") return "statusPill statusPillRejected";
  return "statusPill statusPillDraft";
}

function statusLabel(status: string) {
  if (status === "PUBLISHED") return "已发布";
  if (status === "PENDING_REVIEW") return "待审核";
  if (status === "REJECTED") return "已拒绝";
  return "草稿";
}

export default async function PersonalArticlesPage() {
  const user = await requireRole(["PERSONAL"]);
  if (!user) redirect("/auth");
  if (user.role !== "PERSONAL") redirect("/auth");

  const items = await listPersonalArticles(user.id).catch(() => null);

  return (
    <main className="panel">
      <div className="hero">
        <h1 className="heroTitle">个人文章</h1>
        <p className="heroSub">查看你自己的文章列表，以及当前发布审核状态。</p>
        <div className="meMetaRow">
          {user.email ? <span className="statusPill">邮箱：{user.email}</span> : null}
          {user.phone ? <span className="statusPill">手机号：{user.phone}</span> : null}
          <PersonalLogoutButton testId="personal-logout" />
          <PersonalLogoutButton label="切换账号" redirectTo="/auth?mode=login" testId="personal-switch-account" />
          <Link className="chipLink" href="/">
            返回首页
          </Link>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {!items ? (
          <div className="authError">个人文章加载失败，请检查数据库配置或稍后再试。</div>
        ) : items.length === 0 ? (
          <div className="meEmpty" data-testid="personal-article-list">
            你还没有文章。当前个人端只接好了认证和状态查看，文章创建仍走现有 API 或后续编辑入口。
          </div>
        ) : (
          <div className="list" data-testid="personal-article-list">
            {items.map((item) => (
              <div key={item.id} className="result" data-testid="personal-article-row">
                <div>
                  <strong>{item.title}</strong>
                  <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13, lineHeight: 1.5 }}>
                    {item.summary ?? "（无摘要）"}
                  </div>
                  <div className="resultMeta">
                    {item.category.name} · 更新于 {item.updatedAt.slice(0, 10)}
                  </div>
                </div>
                <div className={statusClass(item.status)} data-testid="personal-article-status">
                  {statusLabel(item.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}