import { redirect } from "next/navigation";

import { requireAdminUserId } from "@/lib/auth/require-admin";
import SearchLogsViewer from "@/components/admin/SearchLogsViewer";

export default async function AdminSearchLogsPage() {
  const userId = await requireAdminUserId();
  if (!userId) redirect("/admin/login");

  return <SearchLogsViewer />;
}
