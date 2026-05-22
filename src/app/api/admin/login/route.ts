import { cookies } from "next/headers";

import { apiError, apiOk } from "@/lib/api/response";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { verifyAdminLogin } from "@/services/admin-auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return apiError("缺少邮箱或密码", { status: 400, code: "MISSING_FIELDS" });
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`admin-login:${ip}:${email.trim().toLowerCase()}`, {
    limit: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? "5"),
    windowMs: Number(process.env.AUTH_LOGIN_WINDOW_SECONDS ?? "300") * 1000,
  });
  if (!limit.allowed) {
    return apiError("登录过于频繁，请稍后再试", { status: 429, code: "RATE_LIMITED" });
  }

  try {
    const user = await verifyAdminLogin({ email, password });
    if (!user) {
      return apiError("邮箱或密码错误", { status: 401, code: "INVALID_CREDENTIALS" });
    }

    const token = createSessionToken({ userId: user.id, role: "ADMIN", issuedAt: Date.now() });
    if (!token) {
      return apiError("AUTH_SECRET 未配置", { status: 500, code: "MISSING_AUTH_SECRET" });
    }

    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName("ADMIN"), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return apiOk({ userId: user.id, email: user.email });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Environment variable not found: DATABASE_URL")) {
      return apiError("DATABASE_URL 未配置", { status: 500, code: "MISSING_DATABASE_URL" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}

