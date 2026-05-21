import { cacheKeys, cacheVersionKeys } from "./cache-keys";
import { getRedisClient } from "./client";

export async function getCacheVersion(key: string) {
  const client = await getRedisClient();
  if (!client) return "1";

  try {
    return (await client.get(key)) ?? "1";
  } catch {
    return "1";
  }
}

export async function readThroughJson<T>(input: {
  key: string;
  ttlSeconds: number;
  loader: () => Promise<T>;
}): Promise<T> {
  const client = await getRedisClient();
  if (!client) {
    return input.loader();
  }

  try {
    const cached = await client.get(input.key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    return input.loader();
  }

  const value = await input.loader();
  try {
    await client.set(input.key, JSON.stringify(value), {
      expiration: { type: "EX", value: input.ttlSeconds },
    });
  } catch {
    return value;
  }

  return value;
}

export async function deleteCacheKeys(keys: Array<string | null | undefined>) {
  const client = await getRedisClient();
  const filtered = keys.filter((key): key is string => Boolean(key));
  if (!client || filtered.length === 0) return;

  try {
    await client.del(filtered);
  } catch {
    // Redis is optional. Skip invalidation when unavailable.
  }
}

export async function bumpCacheVersions(keys: string[]) {
  const client = await getRedisClient();
  if (!client || keys.length === 0) return;

  try {
    await Promise.all(keys.map((key) => client.incr(key)));
  } catch {
    // Redis is optional. Skip invalidation when unavailable.
  }
}

export async function invalidatePublicContentCaches(input: {
  slugs?: Array<string | null | undefined>;
  includeHomeLatest?: boolean;
  includeSearchResults?: boolean;
  includeHotTags?: boolean;
}) {
  await deleteCacheKeys((input.slugs ?? []).map((slug) => (slug ? cacheKeys.articleDetail(slug) : null)));

  const versionKeys: string[] = [];
  if (input.includeHomeLatest) versionKeys.push(cacheVersionKeys.homeLatest);
  if (input.includeSearchResults) versionKeys.push(cacheVersionKeys.searchResults);
  if (input.includeHotTags) versionKeys.push(cacheVersionKeys.hotTags);

  await bumpCacheVersions(versionKeys);
}
