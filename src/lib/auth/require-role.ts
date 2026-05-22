import type { AuthRole } from "./session";

import { requireUser } from "./require-user";

export async function requireRole(roles: AuthRole[]) {
  for (const role of roles) {
    const user = await requireUser(role);
    if (user) return user;
  }
  return null;
}