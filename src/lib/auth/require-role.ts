import type { AuthRole } from "./session";

import { requireUser } from "./require-user";

export async function requireRole(roles: AuthRole[]) {
  const user = await requireUser();
  if (!user) return null;
  if (!roles.includes(user.role)) return null;
  return user;
}