import { describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest, sqlError } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({ getPool: () => mockPool.pool }));
vi.mock('../lib/adminAuth.js', () => ({
  verifyAdmin: () => ({ ok: true, email: 'admin@test.com' }),
}));

const {
  listCampaigns,
  createCampaign,
  updateCampaignSettings,
  clearCampaignData,
  resetLeaderboard,
} = await import('./adminCampaigns.js');

const headers = { authorization: 'Bearer test' };

describe('adminCampaigns.listCampaigns', () => {
  it('returns mapped campaigns with stats', async () => {
    mockPool = createMockPool([
      [
        {
          id: 'APR26',
          display_name: 'April 2026',
          total_packs: 10,
          total_weeks: 7,
          copilot_url: 'https://m365.cloud.microsoft/chat',
          is_active: true,
          created_at: new Date('2026-04-01'),
          total_players: 5,
          total_sessions: 6,
          total_submissions: 14,
        },
      ],
    ]);
    const res = await listCampaigns(fakeRequest({ headers }), {});
    expect(res.jsonBody.campaigns).toHaveLength(1);
    expect(res.jsonBody.campaigns[0]).toMatchObject({
      id: 'APR26',
      displayName: 'April 2026',
      totalPacks: 10,
      totalWeeks: 7,
      isActive: true,
      stats: { totalPlayers: 5, totalSessions: 6, totalSubmissions: 14 },
    });
  });
});

describe('adminCampaigns.createCampaign', () => {
  it('rejects when id or displayName missing', async () => {
    mockPool = createMockPool([]);
    const res = await createCampaign(
      fakeRequest({ body: { id: 'X' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('inserts with defaults applied', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    const res = await createCampaign(
      fakeRequest({ body: { id: 'NOV26', displayName: 'November' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].inputs.totalPacks).toBe(999);
    expect(mockPool.calls[0].inputs.totalWeeks).toBe(7);
    expect(mockPool.calls[0].inputs.copilotUrl).toBe('https://m365.cloud.microsoft/chat');
  });

  it('returns 409 on duplicate id', async () => {
    mockPool = createMockPool([sqlError(2627)]);
    const res = await createCampaign(
      fakeRequest({ body: { id: 'DUP', displayName: 'Dup' }, headers }),
      {},
    );
    expect(res.status).toBe(409);
  });

  it('rethrows non-uniqueness errors', async () => {
    mockPool = createMockPool([sqlError(50000, 'boom')]);
    await expect(
      createCampaign(fakeRequest({ body: { id: 'X', displayName: 'X' }, headers }), {}),
    ).rejects.toThrow('boom');
  });
});

describe('adminCampaigns.updateCampaignSettings', () => {
  it('deactivates other campaigns when activating', async () => {
    mockPool = createMockPool([
      { recordset: [], rowsAffected: [3] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const res = await updateCampaignSettings(
      fakeRequest({ params: { id: 'APR26' }, body: { isActive: true }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].query).toContain('is_active = 0 WHERE id != @id');
    expect(mockPool.calls[1].inputs.isActive).toBe(1);
  });

  it('returns 404 when no row updated', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [0] }]);
    const res = await updateCampaignSettings(
      fakeRequest({ params: { id: 'GONE' }, body: { isActive: false }, headers }),
      {},
    );
    expect(res.status).toBe(404);
  });
});

describe('adminCampaigns.clearCampaignData', () => {
  it('deletes events, sessions, submissions in FK order and reports counts', async () => {
    mockPool = createMockPool([
      { recordset: [], rowsAffected: [12] },
      { recordset: [], rowsAffected: [4] },
      { recordset: [], rowsAffected: [9] },
    ]);
    const res = await clearCampaignData(
      fakeRequest({ params: { id: 'APR26' }, headers }),
      {},
    );
    expect(res.jsonBody).toEqual({
      ok: true,
      deleted: { events: 12, sessions: 4, submissions: 9 },
    });
    expect(mockPool.calls[0].query).toContain('tile_events');
    expect(mockPool.calls[1].query).toContain('game_sessions');
    expect(mockPool.calls[2].query).toContain('submissions');
  });
});

describe('adminCampaigns.resetLeaderboard', () => {
  it('deletes only submissions for the campaign', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [7] }]);
    const res = await resetLeaderboard(
      fakeRequest({ params: { id: 'APR26' }, headers }),
      {},
    );
    expect(res.jsonBody).toEqual({ ok: true, deleted: { submissions: 7 } });
    expect(mockPool.calls[0].inputs.campaignId).toBe('APR26');
  });
});
