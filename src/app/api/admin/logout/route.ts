import { cookies } from "next/headers";

import { apiOk } from "@/lib/api/response";
import { getLegacySessionCookieName, getSessionCookieName } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName("ADMIN"), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(getLegacySessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return apiOk({ ok: true });
}

