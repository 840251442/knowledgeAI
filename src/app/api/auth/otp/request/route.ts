import { apiError, apiOk } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requestPhoneOtp } from "@/services/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const body = payload as { phone?: unknown; purpose?: unknown };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "REGISTER";

  if (!phone) {
    return apiError("缺少手机号", { status: 400, code: "MISSING_PHONE" });
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`otp-request:${ip}:${phone}:${purpose}`, {
    limit: Number(process.env.AUTH_OTP_REQUEST_MAX_ATTEMPTS ?? "3"),
    windowMs: Number(process.env.AUTH_OTP_REQUEST_WINDOW_SECONDS ?? "300") * 1000,
  });
  if (!limit.allowed) {
    return apiError("验证码请求过于频繁，请稍后再试", { status: 429, code: "RATE_LIMITED" });
  }

  try {
    const result = await requestPhoneOtp({ phone, purpose });
    return apiOk(result, { status: 201 });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw === "INVALID_OTP_PURPOSE") {
      return apiError("验证码用途无效", { status: 400, code: "INVALID_OTP_PURPOSE" });
    }
    if (raw === "MISSING_PHONE") {
      return apiError("缺少手机号", { status: 400, code: "MISSING_PHONE" });
    }
    return apiError("服务器错误", { status: 500, code: "INTERNAL_ERROR" });
  }
}
