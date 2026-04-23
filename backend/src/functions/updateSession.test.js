import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './updateSession.js';

describe('PATCH /sessions/{id} (updateSession)', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
  });

  it('returns 400 when id is not a number', async () => {
    const res = await handler(
      fakeRequest({ params: { id: 'abc' }, body: { tilesCleared: 1 } }),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody.message).toMatch(/Invalid session id/);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns 404 when no row was updated', async () => {
    const { pool } = createMockPool([{ recordset: [], rowsAffected: [0] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ params: { id: '999' }, body: { tilesCleared: 3 } }),
    );
    expect(res.status).toBe(404);
    expect(res.jsonBody.ok).toBe(false);
  });

  it('returns ok on successful update and passes all fields through', async () => {
    const { pool, calls } = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        params: { id: '42' },
        body: { tilesCleared: 5, linesWon: 2, keywordsEarned: 3 },
      }),
    );
    expect(res.jsonBody).toEqual({ ok: true });
    expect(calls[0].inputs).toEqual({
      id: 42,
      tilesCleared: 5,
      linesWon: 2,
      keywordsEarned: 3,
    });
  });

  it('coerces missing counters to 0 (not null/NaN)', async () => {
    const { pool, calls } = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(fakeRequest({ params: { id: '1' }, body: {} }));
    expect(calls[0].inputs).toEqual({
      id: 1,
      tilesCleared: 0,
      linesWon: 0,
      keywordsEarned: 0,
    });
  });
});
