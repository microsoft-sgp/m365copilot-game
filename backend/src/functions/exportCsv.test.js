import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './exportCsv.js';

describe('GET /admin/export (CSV)', () => {
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

  it('returns 401 without admin key', async () => {
    const res = await handler(fakeRequest({}));
    expect(res.status).toBe(401);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns header-only CSV when there are no submissions', async () => {
    const { pool } = createMockPool([[]]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    expect(res.headers['Content-Type']).toBe('text/csv');
    expect(res.headers['Content-Disposition']).toContain('submissions-APR26.csv');
    expect(res.body).toBe('org,player_name,email,keyword,submitted_at');
  });

  it('renders rows in the expected column order', async () => {
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
    const lines = res.body.split('\n');
    expect(lines[0]).toBe('org,player_name,email,keyword,submitted_at');
    expect(lines[1]).toBe(
      'Contoso,Ada,ada@contoso.com,CO-APR26-001-R1-AAAA1111,2025-04-01T00:00:00Z',
    );
  });

  it('escapes fields containing commas, quotes, or newlines', async () => {
    const { pool } = createMockPool([
      [
        {
          org: 'Hooli, Inc.',
          player_name: 'Gilfoyle "The Dark Lord"',
          email: 'g@hooli.com',
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
    expect(res.body).toContain('"line1\nline2"');
  });

  it('renders null fields as empty strings', async () => {
    const { pool } = createMockPool([
      [{ org: 'Contoso', player_name: null, email: null, keyword: 'x', submitted_at: null }],
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ headers: { 'x-admin-key': 'secret' } }));
    const row = res.body.split('\n')[1];
    expect(row).toBe('Contoso,,,x,');
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
});
