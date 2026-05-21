import { createClient } from "redis";

const REDIS_COOLDOWN_MS = 30_000;
type AppRedisClient = ReturnType<typeof createRedis>;

const globalForRedis = globalThis as unknown as {
  redisClient?: AppRedisClient;
  redisConnectPromise?: Promise<AppRedisClient | null>;
  redisUnavailableUntil?: number;
};

function createRedis() {
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 1_000,
      reconnectStrategy: false,
    },
  });

  client.on("error", () => {
    // Redis is optional for this project. Failures fall back to direct DB reads.
  });

  return client;
}

export async function getRedisClient(): Promise<AppRedisClient | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  if (
    typeof globalForRedis.redisUnavailableUntil === "number" &&
    globalForRedis.redisUnavailableUntil > Date.now()
  ) {
    return null;
  }

  if (globalForRedis.redisClient?.isReady) {
    return globalForRedis.redisClient;
  }

  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = createRedis();
  }

  if (!globalForRedis.redisConnectPromise) {
    const client = globalForRedis.redisClient;
    globalForRedis.redisConnectPromise = client
      .connect()
      .then(() => {
        globalForRedis.redisUnavailableUntil = undefined;
        return client;
      })
      .catch(async () => {
        globalForRedis.redisUnavailableUntil = Date.now() + REDIS_COOLDOWN_MS;
        if (client.isOpen) {
          await client.close();
        }
        globalForRedis.redisClient = undefined;
        return null;
      })
      .finally(() => {
        globalForRedis.redisConnectPromise = undefined;
      });
  }

  return globalForRedis.redisConnectPromise;
}
