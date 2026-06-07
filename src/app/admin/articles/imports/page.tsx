import { redirect } from "next/navigation";

import ArticleImportPanel from "@/components/admin/ArticleImportPanel";
import { requireRole } from "@/lib/auth/require-role";
import { listImportTasks } from "@/services/article-import.service";

export const dynamic = "force-dynamic";

export default async function AdminArticleImportsPage() {
  const user = await requireRole(["ADMIN", "PERSONAL"]);
  if (!user) redirect("/admin/login");

  let data:
    | {
        type: "ok";
        payload: Awaited<ReturnType<typeof listImportTasks>> & {
          page: number;
          pageSize: number;
          status: null;
        };
      }
    | { type: "error"; message: string };

  try {
    const result = await listImportTasks({
      actor: { id: user.id, role: user.role },
      page: 1,
      pageSize: 20,
    });

    data = {
      type: "ok",
      payload: {
        ...result,
        page: 1,
        pageSize: 20,
        status: null,
      },
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    data = {
      type: "error",
      message: raw.includes("Environment variable not found: DATABASE_URL")
        ? "DATABASE_URL 未配置"
        : "加载导入任务失败",
    };
  }

  if (data.type === "error") {
    return <ArticleImportPanel initialData={null} initialError={data.message} />;
  }

  return <ArticleImportPanel initialData={data.payload} />;
}
