import { redirect } from "next/navigation";

import { requireAdminUserId } from "@/lib/auth/require-admin";
import { listAdminCategories } from "@/services/admin-category.service";
import CategoryManager from "@/components/admin/CategoryManager";

export default async function AdminCategoriesPage() {
  const userId = await requireAdminUserId();
  if (!userId) redirect("/admin/login");

  const initial = await listAdminCategories();
  return <CategoryManager initial={initial} />;
}
