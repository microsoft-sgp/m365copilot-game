import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/organizations.js', () => ({ resolveOrganizationForEmail: vi.fn() }));

import { getPool } from '../lib/db.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './recordEvent.js';

function sqlError(number, message = 'unique constraint violation') {
  const err = new Error(message);
  err.number = number;
  return err;
}

describe('POST /events (recordEvent)', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: null, requiresOrganization: false });
  });

  it('returns 400 when gameSessionId is null', async () => {
    const res = await handler(
      fakeRequest({ body: { tileIndex: 0, eventType: 'reveal' } }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when tileIndex is null', async () => {
    const res = await handler(
      fakeRequest({ body: { gameSessionId: 1, eventType: 'reveal' } }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when eventType is empty', async () => {
    const res = await handler(
      fakeRequest({ body: { gameSessionId: 1, tileIndex: 0, eventType: '' } }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts tileIndex of 0', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 1 }] }, // session exists
      { recordset: [], rowsAffected: [1] }, // insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { gameSessionId: 1, tileIndex: 0, eventType: 'reveal' } }),
    );
    expect(res.jsonBody).toEqual({ ok: true });
  });

  it('returns 400 when session does not exist', async () => {
    const { pool } = createMockPool([{ recordset: [] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { gameSessionId: 999, tileIndex: 0, eventType: 'reveal' } }),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody.message).toMatch(/Invalid session/);
  });

  it('inserts event with keyword and lineId when provided', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 1 }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(
      fakeRequest({
        body: {
          gameSessionId: 1,
          tileIndex: 4,
          eventType: 'line_won',
          keyword: 'CO-APR26-001-R1-ABCD1234',
          lineId: 'R1',
        },
      }),
    );
    expect(calls[1].inputs).toEqual({
      gameSessionId: 1,
      tileIndex: 4,
      eventType: 'line_won',
      keyword: 'CO-APR26-001-R1-ABCD1234',
      lineId: 'R1',
    });
    expect(calls[2].inputs.eventKey).toBe('R1');
  });

  it('coerces missing optional fields to null', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 1 }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    await handler(
      fakeRequest({ body: { gameSessionId: 1, tileIndex: 0, eventType: 'reveal' } }),
    );
    expect(calls[1].inputs.keyword).toBeNull();
    expect(calls[1].inputs.lineId).toBeNull();
  });

  it('creates progression score records for line wins', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 1, player_id: 20, org_id: 10, email: 'ada@smu.edu.sg' }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        body: {
          gameSessionId: 1,
          tileIndex: 6,
          eventType: 'line_won',
          keyword: 'CO-APR26-001-R2-ZZZZ1111',
          lineId: 'R2',
        },
      }),
    );

    expect(res.jsonBody).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(calls[2].query).toMatch(/INSERT INTO progression_scores/);
    expect(calls[2].inputs.eventKey).toBe('R2');
    expect(calls[2].inputs.orgId).toBe(10);
  });

  it('resolves and stores player org when a score event has no stored org', async () => {
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: 55, orgName: 'Contoso' });
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 1, player_id: 20, org_id: null, email: 'alex@contoso.com' }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        body: {
          gameSessionId: 1,
          tileIndex: 6,
          eventType: 'line_won',
          keyword: 'CO-APR26-001-R2-ZZZZ1111',
          lineId: 'R2',
        },
      }),
    );

    expect(res.jsonBody).toEqual({ ok: true });
    expect(resolveOrganizationForEmail).toHaveBeenCalledWith(pool, { email: 'alex@contoso.com' });
    expect(calls[2].query).toMatch(/UPDATE players SET org_id/);
    expect(calls[3].inputs.orgId).toBe(55);
  });

  it('ignores duplicate progression score inserts', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 1 }] },
      { recordset: [], rowsAffected: [1] },
      sqlError(2627),
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        body: {
          gameSessionId: 1,
          tileIndex: 6,
          eventType: 'line_won',
          keyword: 'CO-APR26-001-R2-ZZZZ1111',
          lineId: 'R2',
        },
      }),
    );

    expect(res.jsonBody).toEqual({ ok: true });
  });
});
