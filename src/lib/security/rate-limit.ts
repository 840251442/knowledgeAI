import { getRedisClient } from "@/lib/redis/client";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type MemoryEntry = {
  count: number;
  expiresAt: number;
};

const memoryBuckets = new Map<string, MemoryEntry>();

function now() {
  return Date.now();
}

async function checkMemoryBucket(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const current = now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.expiresAt <= current) {
    const expiresAt = current + options.windowMs;
    memoryBuckets.set(key, { count: 1, expiresAt });
    return { allowed: true, remaining: options.limit - 1, resetAt: expiresAt };
  }

  existing.count += 1;
  if (existing.count > options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.expiresAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.expiresAt,
  };
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "test" || process.env.E2E_FAST_REVIEW === "1") {
    return {
      allowed: true,
      remaining: options.limit,
      resetAt: now() + options.windowMs,
    };
  }

  const redis = await getRedisClient();
  if (!redis) {
    return checkMemoryBucket(key, options);
  }

  const bucketKey = `rate-limit:${key}`;
  const count = await redis.incr(bucketKey);
  if (count === 1) {
    await redis.pexpire(bucketKey, options.windowMs);
  }

  const ttlRaw = await redis.pttl(bucketKey);
  const ttl = typeof ttlRaw === "number" ? ttlRaw : options.windowMs;
  const resetAt = ttl > 0 ? now() + ttl : now() + options.windowMs;
  if (count > options.limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}

export function getClientIp(input: Request) {
  const forwardedFor = input.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  return input.headers.get("x-real-ip")?.trim() ?? input.headers.get("cf-connecting-ip")?.trim() ?? "unknown";
}
