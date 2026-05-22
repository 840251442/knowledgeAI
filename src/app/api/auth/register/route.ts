import { cookies } from "next/headers";

import { apiError, apiOk } from "@/lib/api/response";
import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenTtlSeconds,
  getRefreshCookieName,
  getRefreshTokenTtlSeconds,
  getSessionCookieName,
} from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buildAuthSessionResponse, registerPersonalUser } from "@/services/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as {
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    otpCode?: unknown;
  };

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const otpCode = typeof body.otpCode === "string" ? body.otpCode.trim() : "";

  if (!password) {
    return apiError("缺少密码", { status: 400, code: "MISSING_PASSWORD" });
  }
  if (!email && !phone) {
    return apiError("缺少邮箱或手机号", { status: 400, code: "MISSING_IDENTITY" });
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`personal-register:${ip}:${email || phone}`, {
    limit: Number(process.env.AUTH_REGISTER_MAX_ATTEMPTS ?? "5"),
    windowMs: Number(process.env.AUTH_REGISTER_WINDOW_SECONDS ?? "900") * 1000,
  });
  if (!limit.allowed) {
    return apiError("注册过于频繁，请稍后再试", { status: 429, code: "RATE_LIMITED" });
  }

  try {
    const result = await registerPersonalUser({
      email: email || undefined,
      phone: phone || undefined,
      password,
      otpCode: otpCode || undefined,
    });

    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName("PERSONAL"), result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    const accessToken = createAccessToken({ userId: result.principal.id, role: result.principal.role });
    const refreshToken = createRefreshToken({ userId: result.principal.id, role: result.principal.role });
    if (!accessToken || !refreshToken) {
      return apiError("AUTH_SECRET 未配置", { status: 500, code: "MISSING_AUTH_SECRET" });
    }
    cookieStore.set(getRefreshCookieName("PERSONAL"), refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getRefreshTokenTtlSeconds(),
    });

    return apiOk(
      {
        ...buildAuthSessionResponse(result.principal),
        accessToken,
        accessTokenExpiresIn: getAccessTokenTtlSeconds(),
      },
      { status: 201 },
    );
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw === "MISSING_OTP") return apiError("缺少验证码", { status: 400, code: "MISSING_OTP" });
    if (raw === "INVALID_OTP") return apiError("验证码无效或已过期", { status: 400, code: "INVALID_OTP" });
    if (raw === "WEAK_PASSWORD") return apiError("密码至少 6 位", { status: 400, code: "WEAK_PASSWORD" });
    if (raw === "IDENTITY_EXISTS") return apiError("账号已存在", { status: 409, code: "IDENTITY_EXISTS" });
    if (raw === "MISSING_AUTH_SECRET") {
      return apiError("AUTH_SECRET 未配置", { status: 500, code: "MISSING_AUTH_SECRET" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
