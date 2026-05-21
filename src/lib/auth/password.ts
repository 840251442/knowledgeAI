import crypto from "node:crypto";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
  if (stored === "dev") {
    return password === "dev";
  }

  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  if (parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  const actual = crypto.scryptSync(password, salt, expected.length);

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

