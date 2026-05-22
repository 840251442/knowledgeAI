import crypto from "node:crypto";

export type AuthRole = "ADMIN" | "PERSONAL";
export type AuthTokenType = "SESSION" | "ACCESS" | "REFRESH";

const LEGACY_COOKIE_NAME = "ka_session";
const ADMIN_COOKIE_NAME = "ka_admin_session";
const PERSONAL_COOKIE_NAME = "ka_personal_session";
const ADMIN_REFRESH_COOKIE_NAME = "ka_admin_refresh_token";
const PERSONAL_REFRESH_COOKIE_NAME = "ka_personal_refresh_token";

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? "900");
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? `${30 * 24 * 60 * 60}`);

type SessionPayload = {
  userId: string;
  role: AuthRole;
  issuedAt: number;
  tokenType?: AuthTokenType;
  expiresAt?: number;
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

export function getSessionCookieName(role: AuthRole) {
  return role === "ADMIN" ? ADMIN_COOKIE_NAME : PERSONAL_COOKIE_NAME;
}

export function getLegacySessionCookieName() {
  return LEGACY_COOKIE_NAME;
}

export function getRefreshCookieName(role: AuthRole) {
  return role === "ADMIN" ? ADMIN_REFRESH_COOKIE_NAME : PERSONAL_REFRESH_COOKIE_NAME;
}

function createSignedToken(payload: SessionPayload) {
  const secret = getAuthSecret();
  if (!secret) return null;

  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const bodyEnc = base64UrlEncode(body);
  const sig = sign(bodyEnc, secret);
  const sigEnc = base64UrlEncode(sig);
  return `${bodyEnc}.${sigEnc}`;
}

function parseSignedToken(token: string) {
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
  return JSON.parse(body) as SessionPayload;
}

function isExpired(expiresAt?: number) {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt;
}

export function createSessionToken(payload: SessionPayload) {
  return createSignedToken({
    userId: payload.userId,
    role: payload.role,
    issuedAt: payload.issuedAt,
    tokenType: "SESSION",
  });
}

export function createAccessToken(payload: { userId: string; role: AuthRole }) {
  return createSignedToken({
    userId: payload.userId,
    role: payload.role,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    tokenType: "ACCESS",
  });
}

export function createRefreshToken(payload: { userId: string; role: AuthRole }) {
  return createSignedToken({
    userId: payload.userId,
    role: payload.role,
    issuedAt: Date.now(),
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    tokenType: "REFRESH",
  });
}

export function verifySessionToken(token: string) {
  const parsed = parseSignedToken(token);
  if (!parsed) return null;
  if (!parsed?.userId || (parsed.role !== "ADMIN" && parsed.role !== "PERSONAL")) return null;
  if (typeof parsed.issuedAt !== "number") return null;
  if (parsed.tokenType && parsed.tokenType !== "SESSION") return null;
  if (isExpired(parsed.expiresAt)) return null;
  return parsed;
}

function verifyTypedToken(token: string, tokenType: AuthTokenType) {
  const parsed = parseSignedToken(token);
  if (!parsed) return null;
  if (!parsed?.userId || (parsed.role !== "ADMIN" && parsed.role !== "PERSONAL")) return null;
  if (typeof parsed.issuedAt !== "number") return null;
  if (parsed.tokenType !== tokenType) return null;
  if (isExpired(parsed.expiresAt)) return null;
  return parsed;
}

export function verifyAccessToken(token: string) {
  return verifyTypedToken(token, "ACCESS");
}

export function verifyRefreshToken(token: string) {
  return verifyTypedToken(token, "REFRESH");
}

export function getAccessTokenTtlSeconds() {
  return ACCESS_TOKEN_TTL_SECONDS;
}

export function getRefreshTokenTtlSeconds() {
  return REFRESH_TOKEN_TTL_SECONDS;
}

