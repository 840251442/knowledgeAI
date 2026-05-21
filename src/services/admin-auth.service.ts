import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

export async function verifyAdminLogin(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, isActive: true },
  });

  if (!user) return null;
  if (!user.isActive) return null;
  if (!verifyPassword(input.password, user.passwordHash)) return null;

  return { id: user.id, email: user.email };
}

