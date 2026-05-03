import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './updateSession.js';

describe('PATCH /sessions/{id} (updateSession)', () => {
  let prevEnforce;

  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    // Legacy scenarios were written before token enforcement existed; keep them
    // exercising the pre-enforcement path here. Dedicated enforcement tests
    // live in updateSession.token.test.js.
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
  });

  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('returns 400 when id is not a number', async () => {
    const res = await handler(fakeRequest({ params: { id: 'abc' }, body: { tilesCleared: 1 } }));
    expect(res.status).toBe(400);
    expect(res.jsonBody.message).toMatch(/Invalid session id/);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns 404 when no row was updated', async () => {
    const { pool } = createMockPool([{ recordset: [] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ params: { id: '999' }, body: { tilesCleared: 3 } }));
    expect(res.status).toBe(404);
    expect(res.jsonBody.ok).toBe(false);
  });

  it('returns ok on successful update and passes all fields through', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ player_id: 11, owner_token: null, assignment_status: 'active' }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        params: { id: '42' },
        body: { tilesCleared: 5, linesWon: 2, keywordsEarned: 3 },
      }),
    );
    expect(res.jsonBody).toEqual({ ok: true });
    expect(calls[1].inputs).toEqual({
      id: 42,
      tilesCleared: 5,
      linesWon: 2,
      keywordsEarned: 3,
      boardState: null,
    });
  });

  it('coerces missing counters to 0 (not null/NaN)', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ player_id: 11, owner_token: null, assignment_status: null }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(fakeRequest({ params: { id: '1' }, body: {} }));
    expect(calls[1].inputs).toEqual({
      id: 1,
      tilesCleared: 0,
      linesWon: 0,
      keywordsEarned: 0,
      boardState: null,
    });
  });

  it('returns 409 and does not update abandoned assignment sessions', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ player_id: 11, owner_token: null, assignment_status: 'abandoned' }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ params: { id: '42' }, body: { tilesCleared: 3 } }));

    expect(res.status).toBe(409);
    expect(res.jsonBody.code).toBe('ASSIGNMENT_NOT_ACTIVE');
    expect(calls).toHaveLength(1);
  });

  it('returns 409 and does not update completed assignment sessions', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ player_id: 11, owner_token: null, assignment_status: 'completed' }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ params: { id: '42' }, body: { tilesCleared: 3 } }));

    expect(res.status).toBe(409);
    expect(res.jsonBody.code).toBe('ASSIGNMENT_NOT_ACTIVE');
    expect(calls).toHaveLength(1);
  });
});
