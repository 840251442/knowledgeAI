import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { listAdminArticles } from "@/services/admin-article.service";
import { listAdminComments } from "@/services/comment.service";
import AdminCommentTable from "@/components/admin/AdminCommentTable";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const user = await requireRole(["ADMIN"]);
  if (!user) redirect("/admin/login");

  const page = 1;
  const pageSize = 20;

  let initialData: {
    page: number;
    pageSize: number;
    total: number;
    items: Awaited<ReturnType<typeof listAdminComments>>["items"];
  } | null = null;
  let initialArticles: Array<{ id: string; title: string; slug: string }> = [];
  let initialError: string | null = null;

  try {
    const [comments, articles] = await Promise.all([
      listAdminComments({ page, pageSize }),
      listAdminArticles({ page: 1, pageSize: 100, actor: { id: user.id, role: user.role } }),
    ]);
    initialData = { ...comments, page, pageSize };
    initialArticles = articles.items.map((item) => ({ id: item.id, title: item.title, slug: item.slug }));
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    initialError = raw.includes("Environment variable not found: DATABASE_URL")
      ? "DATABASE_URL 未配置"
      : "服务器错误";
  }

  return (
    <main>
      <AdminCommentTable
        initialData={initialData}
        initialArticles={initialArticles}
        initialError={initialError}
      />
    </main>
  );
}
