import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './getLeaderboard.js';

describe('GET /leaderboard', () => {
  let prevSource;

  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    prevSource = process.env.LEADERBOARD_SOURCE;
    delete process.env.LEADERBOARD_SOURCE;
  });

  afterEach(() => {
    if (prevSource === undefined) delete process.env.LEADERBOARD_SOURCE;
    else process.env.LEADERBOARD_SOURCE = prevSource;
  });

  it('defaults to the APR26 campaign when none is supplied', async () => {
    const { pool, calls } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({}));
    expect(res.jsonBody).toEqual({ leaderboard: [] });
    expect(calls[0].inputs.campaign).toBe('APR26');
  });

  it('passes through a custom campaign query param', async () => {
    const { pool, calls } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(fakeRequest({ query: { campaign: 'SEP27' } }));
    expect(calls[0].inputs.campaign).toBe('SEP27');
  });

  it('ranks rows by progression score query order', async () => {
    const { pool } = createMockPool([
      [
        { org: 'Contoso', score: 9, contributors: 3, lastSubmission: 't3' },
        { org: 'Fabrikam', score: 5, contributors: 2, lastSubmission: 't2' },
        { org: 'Northwind', score: 1, contributors: 1, lastSubmission: 't1' },
      ],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({}));
    expect(res.jsonBody.leaderboard).toEqual([
      { rank: 1, org: 'Contoso', score: 9, contributors: 3, lastSubmission: 't3' },
      { rank: 2, org: 'Fabrikam', score: 5, contributors: 2, lastSubmission: 't2' },
      { rank: 3, org: 'Northwind', score: 1, contributors: 1, lastSubmission: 't1' },
    ]);
  });

  it('returns empty array when no submissions exist', async () => {
    const { pool } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({}));
    expect(res.jsonBody.leaderboard).toEqual([]);
  });

  it('supports rollback to legacy submissions source via env flag', async () => {
    process.env.LEADERBOARD_SOURCE = 'submissions';
    const { pool, calls } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(fakeRequest({}));
    expect(calls[0].query).toMatch(/FROM submissions s/);
  });
});
