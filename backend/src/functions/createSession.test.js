import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest, sqlError } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './createSession.js';

describe('POST /sessions (createSession)', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await handler(fakeRequest({ body: { playerName: 'Ada', packId: 1 } }));
    expect(res.status).toBe(400);
    expect(res.jsonBody.ok).toBe(false);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns 400 when playerName is missing', async () => {
    const res = await handler(fakeRequest({ body: { sessionId: 's', packId: 1 } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when packId is null', async () => {
    const res = await handler(
      fakeRequest({ body: { sessionId: 's', playerName: 'Ada', packId: null } }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts packId of 0 (falsy but valid)', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11 }] }, // player upsert
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 's', playerName: 'Ada', packId: 0 } }),
    );
    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 99 });
  });

  it('creates a new session on the happy path', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11 }] },
      { recordset: [{ id: 99 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 'sess-abc', playerName: 'Ada', packId: 42 } }),
    );

    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 99 });
    expect(calls).toHaveLength(2);
    expect(calls[0].inputs).toEqual({ sessionId: 'sess-abc', playerName: 'Ada' });
    expect(calls[1].inputs).toEqual({ playerId: 11, packId: 42 });
  });

  it('uses email identity while preserving canonical onboarding name', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11 }] },
      { recordset: [{ id: 99 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 'sess-abc', playerName: 'New Alias', packId: 42, email: 'ada@smu.edu.sg' } }),
    );

    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 99 });
    expect(calls[0].inputs).toEqual({
      sessionId: 'sess-abc',
      playerName: 'New Alias',
      email: 'ada@smu.edu.sg',
    });
    expect(calls[0].query).toMatch(/UPDATE SET session_id = @sessionId/);
  });

  it('returns the existing session id on duplicate-key error (2627)', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11 }] }, // player upsert
      sqlError(2627),              // session insert dupe
      { recordset: [{ id: 77 }] }, // follow-up SELECT
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 's', playerName: 'Ada', packId: 42 } }),
    );
    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 77 });
  });

  it('also recovers from duplicate-key error 2601', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11 }] },
      sqlError(2601),
      { recordset: [{ id: 78 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 's', playerName: 'Ada', packId: 42 } }),
    );
    expect(res.jsonBody.gameSessionId).toBe(78);
  });

  it('propagates unrelated DB errors', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11 }] },
      sqlError(9999, 'connection lost'),
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await expect(
      handler(fakeRequest({ body: { sessionId: 's', playerName: 'Ada', packId: 42 } })),
    ).rejects.toThrow(/connection lost/);
  });
});
