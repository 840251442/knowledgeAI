import crypto from "node:crypto";

export type AuthRole = "ADMIN" | "PERSONAL";

const COOKIE_NAME = "ka_session";

type SessionPayload = {
  userId: string;
  role: AuthRole;
  issuedAt: number;
};

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(input: string) {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return Buffer.from(base64 + pad, "base64");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return Buffer.from(secret, "utf8");
}

function sign(data: string, secret: Buffer) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function createSessionToken(payload: SessionPayload) {
  const secret = getAuthSecret();
  if (!secret) return null;

  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const bodyEnc = base64UrlEncode(body);
  const sig = sign(bodyEnc, secret);
  const sigEnc = base64UrlEncode(sig);
  return `${bodyEnc}.${sigEnc}`;
}

export function verifySessionToken(token: string) {
  const secret = getAuthSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [bodyEnc, sigEnc] = parts;
  const expectedSig = sign(bodyEnc, secret);
  const actualSig = base64UrlDecode(sigEnc);
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

  const body = base64UrlDecode(bodyEnc).toString("utf8");
  const parsed = JSON.parse(body) as SessionPayload;
  if (!parsed?.userId || (parsed.role !== "ADMIN" && parsed.role !== "PERSONAL")) return null;
  if (typeof parsed.issuedAt !== "number") return null;
  return parsed;
}

