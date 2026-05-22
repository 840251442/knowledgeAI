import { cookies } from "next/headers";

import { apiError, apiOk } from "@/lib/api/response";
import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenTtlSeconds,
  getRefreshCookieName,
  getRefreshTokenTtlSeconds,
  verifyRefreshToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();

  const adminRefreshToken = cookieStore.get(getRefreshCookieName("ADMIN"))?.value;
  const personalRefreshToken = cookieStore.get(getRefreshCookieName("PERSONAL"))?.value;

  const matched =
    (adminRefreshToken
      ? { role: "ADMIN" as const, payload: verifyRefreshToken(adminRefreshToken) }
      : null) ??
    (personalRefreshToken
      ? { role: "PERSONAL" as const, payload: verifyRefreshToken(personalRefreshToken) }
      : null);

  if (!matched?.payload) {
    return apiError("刷新令牌无效或已过期", { status: 401, code: "INVALID_REFRESH_TOKEN" });
  }

  if (matched.payload.role !== matched.role) {
    return apiError("刷新令牌角色不匹配", { status: 401, code: "INVALID_REFRESH_TOKEN" });
  }

  const accessToken = createAccessToken({
    userId: matched.payload.userId,
    role: matched.payload.role,
  });
  const nextRefreshToken = createRefreshToken({
    userId: matched.payload.userId,
    role: matched.payload.role,
  });

  if (!accessToken || !nextRefreshToken) {
    return apiError("AUTH_SECRET 未配置", { status: 500, code: "MISSING_AUTH_SECRET" });
  }

  cookieStore.set(getRefreshCookieName(matched.payload.role), nextRefreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getRefreshTokenTtlSeconds(),
  });

  return apiOk({
    accessToken,
    accessTokenExpiresIn: getAccessTokenTtlSeconds(),
    role: matched.payload.role,
    userId: matched.payload.userId,
  });
}
