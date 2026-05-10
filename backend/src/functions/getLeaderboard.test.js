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
      [],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({}));
    expect(res.jsonBody.leaderboard).toEqual([
      {
        rank: 1,
        org: 'Contoso',
        score: 9,
        contributors: 3,
        topContributors: [],
        hiddenContributorCount: 3,
        lastSubmission: 't3',
      },
      {
        rank: 2,
        org: 'Fabrikam',
        score: 5,
        contributors: 2,
        topContributors: [],
        hiddenContributorCount: 2,
        lastSubmission: 't2',
      },
      {
        rank: 3,
        org: 'Northwind',
        score: 1,
        contributors: 1,
        topContributors: [],
        hiddenContributorCount: 1,
        lastSubmission: 't1',
      },
    ]);
  });

  it('returns top contributor nicknames and overflow counts', async () => {
    const { pool, calls } = createMockPool([
      [{ org: 'NUS', score: 42, contributors: 8, lastSubmission: 't9' }],
      [
        { org: 'NUS', nickname: 'Ada', score: 9, totalContributors: 8 },
        { org: 'NUS', nickname: 'Kai', score: 7, totalContributors: 8 },
        { org: 'NUS', nickname: 'Mei', score: 6, totalContributors: 8 },
        { org: 'NUS', nickname: 'Jon', score: 5, totalContributors: 8 },
        { org: 'NUS', nickname: 'Noor', score: 4, totalContributors: 8 },
      ],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({}));

    expect(res.jsonBody.leaderboard).toEqual([
      {
        rank: 1,
        org: 'NUS',
        score: 42,
        contributors: 8,
        topContributors: [
          { nickname: 'Ada', score: 9 },
          { nickname: 'Kai', score: 7 },
          { nickname: 'Mei', score: 6 },
          { nickname: 'Jon', score: 5 },
          { nickname: 'Noor', score: 4 },
        ],
        hiddenContributorCount: 3,
        lastSubmission: 't9',
      },
    ]);
    expect(calls[1].query).toMatch(/ROW_NUMBER\(\) OVER/);
    expect(calls[1].query).toMatch(/ORDER BY score DESC, lastContribution DESC, nickname ASC/);
    expect(calls[1].query).toMatch(/WHERE contributorRank <= 5/);
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

  it('keeps the legacy submissions source compatible with contributor metadata', async () => {
    process.env.LEADERBOARD_SOURCE = 'submissions';
    const { pool, calls } = createMockPool([
      [{ org: 'Contoso', score: 2, contributors: 1, lastSubmission: 't2' }],
      [{ org: 'Contoso', nickname: 'Ada', score: 2, totalContributors: 1 }],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({}));

    expect(calls[1].query).toMatch(/FROM submissions s/);
    expect(res.jsonBody.leaderboard[0]).toMatchObject({
      org: 'Contoso',
      topContributors: [{ nickname: 'Ada', score: 2 }],
      hiddenContributorCount: 0,
    });
  });
});
