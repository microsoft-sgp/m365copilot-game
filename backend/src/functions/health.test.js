import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => {
    if (mockPool instanceof Error) throw mockPool;
    return mockPool.pool;
  },
}));

const health = await import('./health.js');

describe('GET /api/health', () => {
  beforeEach(() => {
    mockPool = null;
  });

  it('returns healthy when DB probe succeeds', async () => {
    mockPool = createMockPool([[{ ok: 1 }]]);
    const req = fakeRequest({});
    const res = await health.handler(req, { log: () => {} });

    expect(res.status).toBe(200);
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.status).toBe('healthy');
    expect(res.jsonBody.api).toBe('up');
    expect(res.jsonBody.database).toBe('up');
    expect(typeof res.jsonBody.checkedAt).toBe('string');
    // Ensure SELECT 1 used (not a business table)
    expect(mockPool.calls[0].query).toMatch(/SELECT\s+1/i);
  });

  it('returns degraded with HTTP 200 when DB query rejects', async () => {
    const dbErr = new Error('Connection lost: deadbeef-secret-host');
    mockPool = createMockPool([dbErr]);
    const req = fakeRequest({});
    const res = await health.handler(req, { log: () => {} });

    expect(res.status).toBe(200);
    expect(res.jsonBody.ok).toBe(false);
    expect(res.jsonBody.status).toBe('degraded');
    expect(res.jsonBody.api).toBe('up');
    expect(res.jsonBody.database).toBe('down');
  });

  it('returns degraded with HTTP 200 when getPool itself throws', async () => {
    mockPool = new Error('pool acquisition failed: super-secret');
    const req = fakeRequest({});
    const res = await health.handler(req, { log: () => {} });

    expect(res.status).toBe(200);
    expect(res.jsonBody.status).toBe('degraded');
    expect(res.jsonBody.database).toBe('down');
  });

  it('never leaks underlying error details in the response body', async () => {
    const secret = 'super-secret-error-detail';
    mockPool = createMockPool([new Error(secret)]);
    const req = fakeRequest({});
    const res = await health.handler(req, { log: () => {} });

    const body = JSON.stringify(res.jsonBody);
    expect(body).not.toContain(secret);
    expect(body).not.toMatch(/stack/i);
    expect(Object.keys(res.jsonBody).sort()).toEqual([
      'api',
      'checkedAt',
      'database',
      'ok',
      'status',
    ]);
  });
});
