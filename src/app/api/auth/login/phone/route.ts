import { cookies } from "next/headers";

import { apiError, apiOk } from "@/lib/api/response";
import { getSessionCookieName } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buildAuthSessionResponse, loginPersonalWithPhoneOtp } from "@/services/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as { phone?: unknown; code?: unknown };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!phone || !code) {
    return apiError("缺少手机号或验证码", { status: 400, code: "MISSING_FIELDS" });
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`personal-login-otp:${ip}:${phone}`, {
    limit: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? "5"),
    windowMs: Number(process.env.AUTH_LOGIN_WINDOW_SECONDS ?? "300") * 1000,
  });
  if (!limit.allowed) {
    return apiError("登录过于频繁，请稍后再试", { status: 429, code: "RATE_LIMITED" });
  }

  try {
    const result = await loginPersonalWithPhoneOtp({ phone, code });
    if (!result) {
      return apiError("手机号或验证码错误", { status: 401, code: "INVALID_CREDENTIALS" });
    }

    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName("PERSONAL"), result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return apiOk(buildAuthSessionResponse(result.principal));
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw === "MISSING_AUTH_SECRET") {
      return apiError("AUTH_SECRET 未配置", { status: 500, code: "MISSING_AUTH_SECRET" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
