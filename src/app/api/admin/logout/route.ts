import { cookies } from "next/headers";

import { apiOk } from "@/lib/api/response";
import { getLegacySessionCookieName, getRefreshCookieName, getSessionCookieName } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };

  cookieStore.set(getSessionCookieName("ADMIN"), "", {
    ...base,
  });
  cookieStore.set(getSessionCookieName("PERSONAL"), "", {
    ...base,
  });
  cookieStore.set(getLegacySessionCookieName(), "", {
    ...base,
  });
  cookieStore.set(getRefreshCookieName("ADMIN"), "", {
    ...base,
  });
  cookieStore.set(getRefreshCookieName("PERSONAL"), "", {
    ...base,
  });

  return apiOk({ ok: true });
}

