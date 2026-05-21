import { requireRole } from "./require-role";

export async function requireAdminUserId() {
  const user = await requireRole(["ADMIN"]);
  if (!user) return null;
  return user.id;
}
