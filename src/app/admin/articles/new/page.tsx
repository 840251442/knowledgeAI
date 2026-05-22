import { redirect } from "next/navigation";

import ArticleEditor from "@/components/admin/ArticleEditor";
import { requireRole } from "@/lib/auth/require-role";
import { listAdminCategories } from "@/services/admin-category.service";
import { listAdminTags } from "@/services/admin-tag.service";

export default async function AdminNewArticlePage() {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) redirect("/admin/login");

  let categories: Awaited<ReturnType<typeof listAdminCategories>>;
  let tags: Awaited<ReturnType<typeof listAdminTags>>;
  try {
    [categories, tags] = await Promise.all([listAdminCategories(), listAdminTags()]);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const message = raw.includes("Environment variable not found: DATABASE_URL")
      ? "DATABASE_URL 未配置"
      : "服务器错误";

    return (
      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>新建文章</strong>
            <span>加载失败</span>
          </div>
        </div>
        <div className="errorBox">{message}</div>
      </div>
    );
  }

  const defaultCategoryId = categories[0]?.id ?? "";

  return (
    <ArticleEditor
      mode="create"
      categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      tags={tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
      initial={{
        title: "",
        slug: "",
        summary: null,
        contentMarkdown: "",
        categoryId: defaultCategoryId,
        tagIds: [],
      }}
    />
  );
}

