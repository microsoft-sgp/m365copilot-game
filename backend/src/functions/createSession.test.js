import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest, sqlError } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/packAssignments.js', () => ({
  isPackAssignmentLifecycleEnabled: vi.fn(),
  resolvePackAssignment: vi.fn(),
}));
vi.mock('../lib/organizations.js', () => ({
  resolveOrganizationForEmail: vi.fn(),
}));

import { getPool } from '../lib/db.js';
import {
  isPackAssignmentLifecycleEnabled,
  resolvePackAssignment,
} from '../lib/packAssignments.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './createSession.js';

describe('POST /sessions (createSession)', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(false);
    vi.mocked(resolvePackAssignment).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: null, requiresOrganization: false });
    delete process.env.ENABLE_PACK_ASSIGNMENT_LIFECYCLE;
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

  it('accepts packId of 0 (falsy but valid) in legacy mode', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11 }] }, // player upsert
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 's', playerName: 'Ada', packId: 0 } }),
    );
    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 99, packId: 0 });
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

    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 99, packId: 42 });
    expect(calls).toHaveLength(2);
    expect(calls[0].inputs).toEqual({ sessionId: 'sess-abc', playerName: 'Ada' });
    expect(calls[1].inputs).toEqual({ playerId: 11, packId: 42 });
  });

  it('uses email identity while preserving canonical onboarding name', async () => {
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: 10, orgName: 'SMU', requiresOrganization: false });
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11 }] },
      { recordset: [{ id: 99 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 'sess-abc', playerName: 'New Alias', packId: 42, email: 'ada@smu.edu.sg' } }),
    );

    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 99, packId: 42 });
    expect(calls[0].inputs).toEqual({
      sessionId: 'sess-abc',
      playerName: 'New Alias',
      email: 'ada@smu.edu.sg',
      orgId: 10,
    });
    expect(calls[0].query).toMatch(/UPDATE SET session_id = @sessionId/);
    expect(resolveOrganizationForEmail).toHaveBeenCalledWith(pool, {
      email: 'ada@smu.edu.sg',
      organizationName: '',
    });
  });

  it('returns 400 when a public email domain needs an organization', async () => {
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: null,
      requiresOrganization: true,
    });
    const { pool, calls } = createMockPool([]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 'sess-abc', playerName: 'Ada', packId: 42, email: 'ada@gmail.com' } }),
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody.message).toMatch(/organization/i);
    expect(calls).toHaveLength(0);
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
    expect(res.jsonBody).toEqual({ ok: true, gameSessionId: 77, packId: 42 });
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

  it('returns 400 if lifecycle mode is enabled without email', async () => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(true);
    const res = await handler(
      fakeRequest({ body: { sessionId: 's', playerName: 'Ada' } }),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody.ok).toBe(false);
  });

  it('creates session using resolved assignment in lifecycle mode', async () => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(true);
    vi.mocked(resolvePackAssignment).mockResolvedValue({
      campaign: { id: 'APR26', totalPacks: 999, totalWeeks: 7 },
      assignment: {
        assignmentId: 501,
        packId: 10,
        cycleNumber: 2,
        status: 'active',
        campaignId: 'APR26',
        assignedAt: '2026-04-26T00:00:00Z',
        completedAt: null,
      },
      rotated: true,
      completedPackId: 9,
    });

    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11 }] },
      { recordset: [] },
      { recordset: [{ id: 301 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 'sess-abc', playerName: 'Ada', email: 'ada@smu.edu.sg' } }),
    );

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.gameSessionId).toBe(301);
    expect(res.jsonBody.packId).toBe(10);
    expect(res.jsonBody.activeAssignment.rotated).toBe(true);
    expect(res.jsonBody.activeAssignment.completedPackId).toBe(9);
    expect(calls).toHaveLength(3);
  });

  it('reuses existing session by assignment id in lifecycle mode', async () => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(true);
    vi.mocked(resolvePackAssignment).mockResolvedValue({
      campaign: { id: 'APR26', totalPacks: 999, totalWeeks: 7 },
      assignment: {
        assignmentId: 501,
        packId: 44,
        cycleNumber: 3,
        status: 'active',
        campaignId: 'APR26',
      },
      rotated: false,
      completedPackId: null,
    });

    const { pool } = createMockPool([
      { recordset: [{ id: 11 }] },
      { recordset: [{ id: 909 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { sessionId: 'sess-abc', playerName: 'Ada', email: 'ada@smu.edu.sg' } }),
    );

    expect(res.jsonBody).toMatchObject({ ok: true, gameSessionId: 909, packId: 44 });
  });
});
