import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockClient;

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockClient),
}));

const cache = await import('./cache.js');
const { createClient } = await import('redis');

function makeClient(overrides = {}) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scanIterator: vi.fn(async function* scanIterator() {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REDIS_CONNECTION_STRING;
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_HOST_NAME;
  delete process.env.REDIS_ACCESS_KEY;
  delete process.env.REDIS_PASSWORD;
  delete process.env.REDIS_PORT;
  delete process.env.REDIS_USERNAME;
  delete process.env.REDIS_USE_TLS;
  mockClient = makeClient();
  cache.resetCacheClientForTests();
});

describe('cacheGetJson', () => {
  it('returns null without Redis configuration', async () => {
    const result = await cache.cacheGetJson('key');

    expect(result).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns parsed cached JSON when present', async () => {
    process.env.REDIS_CONNECTION_STRING = 'rediss://example.redis.cache.windows.net:6380';
    mockClient.get.mockResolvedValue('{"ok":true}');

    const result = await cache.cacheGetJson('key');

    expect(result).toEqual({ ok: true });
    expect(mockClient.connect).toHaveBeenCalledOnce();
    expect(mockClient.get).toHaveBeenCalledWith('key');
  });

  it('fails open on Redis read errors', async () => {
    process.env.REDIS_CONNECTION_STRING = 'rediss://example.redis.cache.windows.net:6380';
    mockClient.get.mockRejectedValue(new Error('redis unavailable'));
    const context = { log: vi.fn() };

    const result = await cache.cacheGetJson('key', context);

    expect(result).toBeNull();
    expect(context.log).toHaveBeenCalledWith(
      'redis_cache_get_failed',
      expect.objectContaining({ key: 'key' }),
    );
  });
});

describe('cacheSetJson', () => {
  it('serializes JSON and applies TTL', async () => {
    process.env.REDIS_HOST = 'example.redis.cache.windows.net';
    process.env.REDIS_ACCESS_KEY = 'secret-key';

    await cache.cacheSetJson('key', { value: 1 }, 60);

    expect(createClient).toHaveBeenCalledWith({
      url: 'rediss://secret-key@example.redis.cache.windows.net:6380',
    });
    expect(mockClient.set).toHaveBeenCalledWith('key', '{"value":1}', { EX: 60 });
  });

  it('fails open when Redis connect fails', async () => {
    process.env.REDIS_CONNECTION_STRING = 'rediss://example.redis.cache.windows.net:6380';
    mockClient.connect.mockRejectedValue(new Error('connect failed'));
    const context = { log: vi.fn() };

    await expect(cache.cacheSetJson('key', { value: 1 }, 60, context)).resolves.toBeUndefined();
    expect(mockClient.set).not.toHaveBeenCalled();
    expect(context.log).toHaveBeenCalledWith(
      'redis_cache_connect_failed',
      expect.objectContaining({ message: 'connect failed' }),
    );
  });
});

describe('cacheDelete', () => {
  it('deletes a list of keys when configured', async () => {
    process.env.REDIS_CONNECTION_STRING = 'rediss://example.redis.cache.windows.net:6380';

    await cache.cacheDelete(['a', 'b']);

    expect(mockClient.del).toHaveBeenCalledWith(['a', 'b']);
  });
});

describe('cacheDeleteByPrefix', () => {
  it('scans and deletes matching keys', async () => {
    process.env.REDIS_CONNECTION_STRING = 'rediss://example.redis.cache.windows.net:6380';
    mockClient.scanIterator.mockImplementation(async function* scanIterator() {
      yield 'leaderboard:one';
      yield 'leaderboard:two';
    });

    await cache.cacheDeleteByPrefix('leaderboard:');

    expect(mockClient.scanIterator).toHaveBeenCalledWith({ MATCH: 'leaderboard:*', COUNT: 100 });
    expect(mockClient.del).toHaveBeenCalledWith(['leaderboard:one', 'leaderboard:two']);
  });
});
