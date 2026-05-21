import { redirect } from "next/navigation";

import { requireAdminUserId } from "@/lib/auth/require-admin";
import { listAdminTags } from "@/services/admin-tag.service";
import TagManager from "@/components/admin/TagManager";

export default async function AdminTagsPage() {
  const userId = await requireAdminUserId();
  if (!userId) redirect("/admin/login");

  const initial = await listAdminTags();
  return <TagManager initial={initial} />;
}
