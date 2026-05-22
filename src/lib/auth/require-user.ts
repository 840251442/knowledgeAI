import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db/prisma";

import {
  getLegacySessionCookieName,
  getSessionCookieName,
  type AuthRole,
  verifyAccessToken,
  verifySessionToken,
} from "./session";

export type AuthenticatedUser =
  | { id: string; role: "ADMIN"; email: string; username: string; isActive: boolean }
  | { id: string; role: "PERSONAL"; email: string | null; phone: string | null; isActive: boolean };

export async function requireUser(role: AuthRole): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const authHeader = headerStore.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const access = verifyAccessToken(bearerToken);
    if (access && access.role === role) {
      return loadUserBySession(access.userId, access.role);
    }
  }

  const token = cookieStore.get(getSessionCookieName(role))?.value ?? cookieStore.get(getLegacySessionCookieName())?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session || session.role !== role) return null;

  return loadUserBySession(session.userId, session.role);
}

async function loadUserBySession(userId: string, role: AuthRole): Promise<AuthenticatedUser | null> {
  if (role === "ADMIN") {
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return { ...user, role: "ADMIN" };
  }

  const user = await prisma.personalUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { ...user, role: "PERSONAL" };
}