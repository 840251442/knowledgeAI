import { redirect } from "next/navigation";

import ArticleEditor from "@/components/admin/ArticleEditor";
import { requireRole } from "@/lib/auth/require-role";
import { getAdminArticleById } from "@/services/admin-article.service";
import { listAdminCategories } from "@/services/admin-category.service";
import { listAdminTags } from "@/services/admin-tag.service";

export default async function AdminEditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) redirect("/admin/login");

  const { id } = await params;

  let article: Awaited<ReturnType<typeof getAdminArticleById>>;
  let categories: Awaited<ReturnType<typeof listAdminCategories>>;
  let tags: Awaited<ReturnType<typeof listAdminTags>>;

  try {
    [article, categories, tags] = await Promise.all([
      getAdminArticleById(id, { id: user.id, role: user.role }),
      listAdminCategories(),
      listAdminTags(),
    ]);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const message = raw.includes("Environment variable not found: DATABASE_URL")
      ? "DATABASE_URL 未配置"
      : "服务器错误";

    return (
      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>编辑文章</strong>
            <span>加载失败</span>
          </div>
        </div>
        <div className="errorBox">{message}</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>编辑文章</strong>
            <span>未找到</span>
          </div>
        </div>
        <div className="errorBox">未找到文章</div>
      </div>
    );
  }

  return (
    <ArticleEditor
      mode="edit"
      categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      tags={tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
      initial={{
        id: article.id,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        contentMarkdown: article.contentMarkdown,
        categoryId: article.category.id,
        tagIds: article.tags.map((t) => t.id),
        status: article.status,
      }}
    />
  );
}

