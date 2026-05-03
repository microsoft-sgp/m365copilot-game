import { createClient, type RedisClientType } from 'redis';
import { logBackendEvent } from './sentry.js';

type LoggerLike = {
  log?: (message: string, details?: Record<string, unknown>) => void;
  error?: (...args: unknown[]) => void;
};

type RedisConfig = {
  url: string;
};

export const CACHE_KEYS = {
  activeCampaign: 'public:campaign:active',
  orgDomains: 'public:org-domains',
  leaderboard: (campaignId: string, source: string) => `public:leaderboard:${source}:${campaignId}`,
  leaderboardPrefix: 'public:leaderboard:',
};

let clientPromise: Promise<RedisClientType | null> | null = null;

function logCacheEvent(
  context: LoggerLike | undefined,
  event: string,
  details: Record<string, unknown> = {},
): void {
  logBackendEvent(context, event, 'warn', details);
}

function getRedisConfig(): RedisConfig | null {
  if (process.env.REDIS_CONNECTION_STRING) {
    return { url: process.env.REDIS_CONNECTION_STRING };
  }

  const host = process.env.REDIS_HOST_NAME || process.env.REDIS_HOST;
  const accessKey = process.env.REDIS_ACCESS_KEY || process.env.REDIS_PASSWORD;
  if (!host || !accessKey) return null;

  const useTls = process.env.REDIS_USE_TLS !== 'false';
  const port = process.env.REDIS_PORT || (useTls ? '6380' : '6379');
  const protocol = useTls ? 'rediss' : 'redis';
  const username = process.env.REDIS_USERNAME
    ? `${encodeURIComponent(process.env.REDIS_USERNAME)}:`
    : '';
  const password = encodeURIComponent(accessKey);

  return { url: `${protocol}://${username}${password}@${host}:${port}` };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readTtlSeconds(envName: string, fallback: number): number {
  const parsed = Number(process.env[envName]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getDefaultCampaignId(): string {
  return process.env.DEFAULT_CAMPAIGN_ID || 'APR26';
}

export function getLeaderboardSource(): string {
  return process.env.LEADERBOARD_SOURCE === 'submissions' ? 'submissions' : 'progression';
}

export function getPublicCacheTtlSeconds(
  area: 'activeCampaign' | 'orgDomains' | 'leaderboard',
): number {
  if (area === 'activeCampaign') {
    return readTtlSeconds('CACHE_TTL_ACTIVE_CAMPAIGN_SECONDS', 60);
  }
  if (area === 'orgDomains') {
    return readTtlSeconds('CACHE_TTL_ORG_DOMAINS_SECONDS', 300);
  }
  return readTtlSeconds('CACHE_TTL_LEADERBOARD_SECONDS', 30);
}

async function getClient(context?: LoggerLike): Promise<RedisClientType | null> {
  const config = getRedisConfig();
  if (!config) return null;

  if (!clientPromise) {
    clientPromise = (async () => {
      const client = createClient({ url: config.url });
      client.on('error', (error) => {
        logCacheEvent(context, 'redis_cache_error', { message: getErrorMessage(error) });
      });

      try {
        await client.connect();
        return client as RedisClientType;
      } catch (error) {
        logCacheEvent(context, 'redis_cache_connect_failed', { message: getErrorMessage(error) });
        return null;
      }
    })();
  }

  return clientPromise;
}

export function resetCacheClientForTests(): void {
  clientPromise = null;
}

export async function cacheGetJson<T>(key: string, context?: LoggerLike): Promise<T | null> {
  try {
    const client = await getClient(context);
    if (!client) return null;

    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logCacheEvent(context, 'redis_cache_get_failed', { key, message: getErrorMessage(error) });
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
  context?: LoggerLike,
): Promise<void> {
  try {
    const client = await getClient(context);
    if (!client) return;

    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logCacheEvent(context, 'redis_cache_set_failed', { key, message: getErrorMessage(error) });
  }
}

export async function cacheDelete(keys: string | string[], context?: LoggerLike): Promise<void> {
  const targetKeys = Array.isArray(keys) ? keys : [keys];
  if (targetKeys.length === 0) return;

  try {
    const client = await getClient(context);
    if (!client) return;

    await client.del(targetKeys);
  } catch (error) {
    logCacheEvent(context, 'redis_cache_delete_failed', { message: getErrorMessage(error) });
  }
}

// Atomic INCR with TTL applied on first creation. Returns the post-increment
// counter value, or null if Redis is unavailable. Used for OTP brute-force
// lockout where each failed attempt needs a single, race-free counter.
export async function cacheIncrementWithTtl(
  key: string,
  ttlSeconds: number,
  context?: LoggerLike,
): Promise<number | null> {
  try {
    const client = await getClient(context);
    if (!client) return null;

    const value = await client.incr(key);
    if (value === 1) {
      await client.expire(key, ttlSeconds);
    }
    return value;
  } catch (error) {
    logCacheEvent(context, 'redis_cache_incr_failed', { key, message: getErrorMessage(error) });
    return null;
  }
}

// Returns the current counter value for an OTP lockout key, or 0 when the key
// has expired/never existed/Redis is unreachable. Used to gate verify before
// the database lookup so an attacker cannot keep probing once locked.
export async function cacheGetCounter(key: string, context?: LoggerLike): Promise<number> {
  try {
    const client = await getClient(context);
    if (!client) return 0;

    const value = await client.get(key);
    if (!value) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    logCacheEvent(context, 'redis_cache_get_counter_failed', {
      key,
      message: getErrorMessage(error),
    });
    return 0;
  }
}

export async function cacheDeleteByPrefix(prefix: string, context?: LoggerLike): Promise<void> {
  try {
    const client = await getClient(context);
    if (!client) return;

    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      keys.push(String(key));
    }

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    logCacheEvent(context, 'redis_cache_prefix_delete_failed', {
      prefix,
      message: getErrorMessage(error),
    });
  }
}

export async function invalidatePublicConfigCache(context?: LoggerLike): Promise<void> {
  await cacheDelete([CACHE_KEYS.activeCampaign, CACHE_KEYS.orgDomains], context);
}

export async function invalidateOrgDomainCache(context?: LoggerLike): Promise<void> {
  await cacheDelete(CACHE_KEYS.orgDomains, context);
}

export async function invalidateLeaderboardCache(
  campaignId?: string | null,
  context?: LoggerLike,
): Promise<void> {
  if (!campaignId) {
    await cacheDeleteByPrefix(CACHE_KEYS.leaderboardPrefix, context);
    return;
  }

  await cacheDelete(
    [
      CACHE_KEYS.leaderboard(campaignId, 'progression'),
      CACHE_KEYS.leaderboard(campaignId, 'submissions'),
    ],
    context,
  );
}
