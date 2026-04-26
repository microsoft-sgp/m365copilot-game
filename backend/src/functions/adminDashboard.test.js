import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './adminDashboard.js';

describe('GET /admin/dashboard', () => {
  let prev;

  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    prev = process.env.ADMIN_KEY;
    process.env.ADMIN_KEY = 'secret';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = prev;
  });

  it('returns 401 without an admin key header', async () => {
    const res = await handler(fakeRequest({}));
    expect(res.status).toBe(401);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns 401 with a wrong admin key', async () => {
    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'wrong!!' } }));
    expect(res.status).toBe(401);
  });

  it('returns 500 when ADMIN_KEY is not configured', async () => {
    delete process.env.ADMIN_KEY;
    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'anything' } }));
    expect(res.status).toBe(500);
  });

  it('returns a shaped dashboard on success', async () => {
    const { pool, calls } = createMockPool([
      [
        {
          totalPlayers: 12,
          totalSessions: 18,
          totalSubmissions: 9,
          avgTilesCleared: 4.2345,
        },
      ],
      [{ org: 'Contoso', score: 9 }],
      [{ id: 1, player_name: 'Ada' }],
      [{
        id: 2,
        player_name: 'Grace',
        keyword: 'CO-APR26-001-R1-AAAA1111',
        event_type: 'line_won',
        event_key: 'R1',
        created_at: '2026-04-24T00:00:00.000Z',
      }],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ headers: { 'x-admin-key': 'secret' } }),
    );

    expect(res.jsonBody.summary).toEqual({
      totalPlayers: 12,
      totalSessions: 18,
      totalSubmissions: 9,
      avgTilesCleared: 4.2, // rounded to 1 decimal
      topOrg: 'Contoso',
    });
    expect(res.jsonBody.sessions).toHaveLength(1);
    expect(res.jsonBody.submissions).toHaveLength(1);
    calls.forEach((c) => expect(c.inputs.campaign).toBe('APR26'));
  });

  it('handles null avgTilesCleared (no sessions yet)', async () => {
    const { pool } = createMockPool([
      [{ totalPlayers: 0, totalSessions: 0, totalSubmissions: 0, avgTilesCleared: null }],
      [], // no top org
      [],
      [],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ headers: { 'x-admin-key': 'secret' } }),
    );
    expect(res.jsonBody.summary.avgTilesCleared).toBe(0);
    expect(res.jsonBody.summary.topOrg).toBeNull();
  });

  it('honors a custom campaign query parameter', async () => {
    const { pool, calls } = createMockPool([
      [{ totalPlayers: 0, totalSessions: 0, totalSubmissions: 0, avgTilesCleared: null }],
      [],
      [],
      [],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(
      fakeRequest({
        headers: { 'x-admin-key': 'secret' },
        query: { campaign: 'SEP27' },
      }),
    );
    calls.forEach((c) => expect(c.inputs.campaign).toBe('SEP27'));
  });

  it('supports rollback to legacy submissions source via env flag', async () => {
    process.env.LEADERBOARD_SOURCE = 'submissions';
    const { pool, calls } = createMockPool([
      [{ totalPlayers: 0, totalSessions: 0, totalSubmissions: 0, avgTilesCleared: null }],
      [],
      [],
      [],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    expect(calls[0].query).toMatch(/FROM submissions/);
    expect(calls[1].query).toMatch(/FROM submissions/);
    expect(calls[3].query).toMatch(/FROM submissions/);
  });
});
