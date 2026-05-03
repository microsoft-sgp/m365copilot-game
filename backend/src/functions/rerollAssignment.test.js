import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { generatePlayerToken, hashPlayerToken } from '../lib/playerAuth.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/packAssignments.js', () => ({ rerollPackAssignment: vi.fn() }));
vi.mock('../lib/organizations.js', () => ({ resolveOrganizationForEmail: vi.fn() }));

import { getPool } from '../lib/db.js';
import { rerollPackAssignment } from '../lib/packAssignments.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './rerollAssignment.js';

function tokenedRequest(body, token) {
  const headers = token ? { cookie: `${PLAYER_COOKIE_NAME}=${token}` } : {};
  return fakeRequest({ body, headers });
}

function assignment(overrides = {}) {
  return {
    assignmentId: 502,
    packId: 44,
    cycleNumber: 2,
    status: 'active',
    campaignId: 'APR26',
    assignedAt: '2026-05-03T00:00:00Z',
    completedAt: null,
    abandonedAt: null,
    ...overrides,
  };
}

describe('POST /player/assignment/reroll', () => {
  let prevEnforce;

  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(rerollPackAssignment).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: null,
      requiresOrganization: false,
    });
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
  });

  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('rerolls an existing active assignment and creates a replacement session', async () => {
    const token = generatePlayerToken();
    vi.mocked(rerollPackAssignment).mockResolvedValue({
      campaign: { id: 'APR26', totalPacks: 999, totalWeeks: 7 },
      assignment: assignment(),
      abandonedAssignment: assignment({ assignmentId: 501, packId: 42, status: 'abandoned' }),
      rerolled: true,
    });
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11, owner_token: hashPlayerToken(token) }] },
      { recordset: [{ assignment_id: 501 }] },
      { recordset: [] },
      { recordset: [{ id: 301 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest(
        {
          email: 'ada@example.com',
          playerName: 'Ada',
          gameSessionId: 900,
        },
        token,
      ),
      { log: vi.fn() },
    );

    expect(res.jsonBody).toMatchObject({ ok: true, gameSessionId: 301, packId: 44 });
    expect(res.jsonBody.activeAssignment.rerolled).toBe(true);
    expect(res.jsonBody.activeAssignment.abandonedAssignment.packId).toBe(42);
    expect(rerollPackAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        pool,
        playerId: 11,
        expectedAssignmentId: 501,
      }),
    );
    expect(calls[3].inputs).toMatchObject({
      playerId: 11,
      packId: 44,
      campaignId: 'APR26',
      assignmentId: 502,
    });
  });

  it('returns 400 when identity is missing', async () => {
    const res = await handler(fakeRequest({ body: { email: 'ada@example.com' } }), {
      log: vi.fn(),
    });

    expect(res.status).toBe(400);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('returns recovery-required when the player token does not match', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: hashPlayerToken('real-token') }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({ body: { email: 'ada@example.com', playerName: 'Ada' } }),
      { log: vi.fn() },
    );

    expect(res.status).toBe(409);
    expect(res.jsonBody.code).toBe('PLAYER_RECOVERY_REQUIRED');
    expect(rerollPackAssignment).not.toHaveBeenCalled();
  });

  it('creates an assignment when the authenticated player has no active assignment', async () => {
    const token = generatePlayerToken();
    vi.mocked(rerollPackAssignment).mockResolvedValue({
      campaign: { id: 'APR26', totalPacks: 999, totalWeeks: 7 },
      assignment: assignment({ assignmentId: 601, packId: 77, cycleNumber: 1 }),
      abandonedAssignment: null,
      rerolled: false,
    });
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: hashPlayerToken(token) }] },
      { recordset: [] },
      { recordset: [{ id: 777 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ email: 'ada@example.com', playerName: 'Ada' }, token),
      { log: vi.fn() },
    );

    expect(res.jsonBody).toMatchObject({ ok: true, gameSessionId: 777, packId: 77 });
    expect(rerollPackAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAssignmentId: null }),
    );
  });
});
