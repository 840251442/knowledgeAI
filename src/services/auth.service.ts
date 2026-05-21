import crypto from "node:crypto";

import { type OtpPurpose, type UserRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";

const OTP_TTL_SECONDS = Number(process.env.PHONE_OTP_TTL_SECONDS ?? "300");
const OTP_MAX_ATTEMPTS = Number(process.env.PHONE_OTP_MAX_ATTEMPTS ?? "5");

export type AuthPrincipal = {
  id: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
};

export type SessionIssueResult = {
  token: string;
  principal: AuthPrincipal;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.trim().replaceAll(/\s+/g, "");
}

function isOtpPurpose(value: string): value is OtpPurpose {
  return value === "LOGIN" || value === "REGISTER";
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function findConflictingPersonalIdentity(input: { email?: string | null; phone?: string | null }) {
  const [personalEmail, personalPhone, adminEmail] = await Promise.all([
    input.email
      ? prisma.personalUser.findUnique({ where: { email: input.email }, select: { id: true } })
      : Promise.resolve(null),
    input.phone
      ? prisma.personalUser.findUnique({ where: { phone: input.phone }, select: { id: true } })
      : Promise.resolve(null),
    input.email
      ? prisma.adminUser.findUnique({ where: { email: input.email }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  return Boolean(personalEmail || personalPhone || adminEmail);
}

function issueSession(userId: string, role: UserRole) {
  const token = createSessionToken({ userId, role, issuedAt: Date.now() });
  if (!token) {
    throw new Error("MISSING_AUTH_SECRET");
  }
  return token;
}

export async function registerPersonalUser(input: {
  email?: string;
  phone?: string;
  password: string;
  otpCode?: string;
}) {
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? normalizePhone(input.phone) : null;

  if (!email && !phone) {
    throw new Error("MISSING_IDENTITY");
  }

  if (email && input.password.trim().length < 6) {
    throw new Error("WEAK_PASSWORD");
  }

  if (phone && !input.otpCode) {
    throw new Error("MISSING_OTP");
  }

  if (phone && input.otpCode) {
    const otpValid = await verifyPhoneOtp({ phone, purpose: "REGISTER", code: input.otpCode });
    if (!otpValid) {
      throw new Error("INVALID_OTP");
    }
  }

  if (await findConflictingPersonalIdentity({ email, phone })) {
    throw new Error("IDENTITY_EXISTS");
  }

  const user = await prisma.personalUser.create({
    data: {
      email,
      phone,
      passwordHash: hashPassword(input.password),
      role: "PERSONAL",
    },
    select: { id: true, role: true, email: true, phone: true },
  });

  return {
    principal: user,
    token: issueSession(user.id, user.role),
  } satisfies SessionIssueResult;
}

export async function loginPersonalWithPassword(input: { identifier: string; password: string }) {
  const identifier = input.identifier.trim().toLowerCase();
  if (!identifier) return null;

  const user = await prisma.personalUser.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: normalizePhone(identifier) }],
    },
    select: { id: true, role: true, email: true, phone: true, passwordHash: true, isActive: true },
  });

  if (!user || !user.isActive || !user.passwordHash) return null;
  if (!verifyPassword(input.password, user.passwordHash)) return null;

  return {
    principal: { id: user.id, role: user.role, email: user.email, phone: user.phone },
    token: issueSession(user.id, user.role),
  } satisfies SessionIssueResult;
}

export async function loginPersonalWithPhoneOtp(input: { phone: string; code: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const otpValid = await verifyPhoneOtp({ phone, purpose: "LOGIN", code: input.code });
  if (!otpValid) return null;

  const user = await prisma.personalUser.findUnique({
    where: { phone },
    select: { id: true, role: true, email: true, phone: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  return {
    principal: { id: user.id, role: user.role, email: user.email, phone: user.phone },
    token: issueSession(user.id, user.role),
  } satisfies SessionIssueResult;
}

export async function requestPhoneOtp(input: { phone: string; purpose: OtpPurpose | string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("MISSING_PHONE");
  }
  if (!isOtpPurpose(input.purpose)) {
    throw new Error("INVALID_OTP_PURPOSE");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const record = await prisma.phoneOtpCode.create({
    data: {
      phone,
      codeHash: hashPassword(code),
      purpose: input.purpose,
      expiresAt,
    },
    select: { id: true, phone: true, purpose: true, expiresAt: true, createdAt: true },
  });

  return {
    ...record,
    code: process.env.NODE_ENV === "production" ? null : code,
  };
}

export async function verifyPhoneOtp(input: { phone: string; purpose: OtpPurpose | string; code: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone || !isOtpPurpose(input.purpose)) return false;

  const rows = await prisma.phoneOtpCode.findMany({
    where: { phone, purpose: input.purpose },
    orderBy: [{ createdAt: "desc" }],
    take: 5,
  });

  const now = new Date();
  for (const row of rows) {
    if (row.consumedAt) continue;
    if (row.expiresAt.getTime() < now.getTime()) continue;
    if (row.attemptCount >= OTP_MAX_ATTEMPTS) continue;

    if (!verifyPassword(input.code, row.codeHash)) {
      await prisma.phoneOtpCode.update({
        where: { id: row.id },
        data: { attemptCount: row.attemptCount + 1 },
      }).catch(() => undefined);
      continue;
    }

    await prisma.phoneOtpCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return true;
  }

  return false;
}

export async function resetPhoneOtpAttempts(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  await prisma.phoneOtpCode.updateMany({
    where: {
      phone: normalized,
      consumedAt: null,
    },
    data: {
      attemptCount: 0,
    },
  });
}

export function buildAuthSessionResponse(principal: AuthPrincipal) {
  return {
    userId: principal.id,
    role: principal.role,
    email: principal.email,
    phone: principal.phone,
  };
}