import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './exportCsv.js';

describe('GET /admin/export (CSV)', () => {
  let prev;
  let prevSource;

  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    prev = process.env.ADMIN_KEY;
    process.env.ADMIN_KEY = 'secret';
    prevSource = process.env.LEADERBOARD_SOURCE;
    delete process.env.LEADERBOARD_SOURCE;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = prev;
    if (prevSource === undefined) delete process.env.LEADERBOARD_SOURCE;
    else process.env.LEADERBOARD_SOURCE = prevSource;
  });

  it('returns 401 without admin key', async () => {
    const res = await handler(fakeRequest({}));
    expect(res.status).toBe(401);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns header-only CSV when there are no progression scores', async () => {
    const { pool } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    expect(res.headers['Content-Type']).toBe('text/csv');
    expect(res.headers['Content-Disposition']).toContain('submissions-APR26.csv');
    expect(res.body).toBe('org,player_name,email,event_type,event_key,keyword,submitted_at');
  });

  it('renders rows in the expected column order', async () => {
    const { pool } = createMockPool([
      [
        {
          org: 'Contoso',
          player_name: 'Ada',
          email: 'ada@contoso.com',
          event_type: 'line_won',
          event_key: 'R1',
          keyword: 'CO-APR26-001-R1-AAAA1111',
          submitted_at: '2025-04-01T00:00:00Z',
        },
      ],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    const lines = res.body.split('\n');
    expect(lines[0]).toBe('org,player_name,email,event_type,event_key,keyword,submitted_at');
    expect(lines[1]).toBe(
      'Contoso,Ada,ada@contoso.com,line_won,R1,CO-APR26-001-R1-AAAA1111,2025-04-01T00:00:00Z',
    );
  });

  it('escapes fields containing commas, quotes, or newlines', async () => {
    const { pool } = createMockPool([
      [
        {
          org: 'Hooli, Inc.',
          player_name: 'Gilfoyle "The Dark Lord"',
          email: 'g@hooli.com',
          event_type: 'line_won',
          event_key: 'R1,R2',
          keyword: 'CO-APR26-001-R1-AAAA1111',
          submitted_at: 'line1\nline2',
        },
      ],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    // quotes are doubled, and fields with special chars are wrapped.
    expect(res.body).toContain('"Hooli, Inc."');
    expect(res.body).toContain('"Gilfoyle ""The Dark Lord"""');
    expect(res.body).toContain('"R1,R2"');
    expect(res.body).toContain('"line1\nline2"');
  });

  it('renders null fields as empty strings', async () => {
    const { pool } = createMockPool([
      [{
        org: 'Contoso',
        player_name: null,
        email: null,
        event_type: null,
        event_key: null,
        keyword: 'x',
        submitted_at: null,
      }],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    const row = res.body.split('\n')[1];
    expect(row).toBe('Contoso,,,,,x,');
  });

  it('names the file with the selected campaign', async () => {
    const { pool } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        headers: { 'x-admin-key': 'secret' },
        query: { campaign: 'SEP27' },
      }),
    );
    expect(res.headers['Content-Disposition']).toContain('submissions-SEP27.csv');
  });

  it('uses legacy CSV schema when rollback flag is enabled', async () => {
    process.env.LEADERBOARD_SOURCE = 'submissions';
    const { pool } = createMockPool([
      [
        {
          org: 'Contoso',
          player_name: 'Ada',
          email: 'ada@contoso.com',
          keyword: 'CO-APR26-001-R1-AAAA1111',
          submitted_at: '2025-04-01T00:00:00Z',
        },
      ],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    expect(res.body.split('\n')[0]).toBe('org,player_name,email,keyword,submitted_at');
  });
});
