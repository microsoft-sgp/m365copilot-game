import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));
vi.mock('../lib/packAssignments.js', () => ({
  isPackAssignmentLifecycleEnabled: vi.fn(),
  resolvePackAssignment: vi.fn(),
}));

const { isPackAssignmentLifecycleEnabled, resolvePackAssignment } = await import('../lib/packAssignments.js');

const { handler } = await import('./getPlayerState.js');

describe('GET /api/player/state', () => {
  beforeEach(() => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(false);
    vi.mocked(resolvePackAssignment).mockReset();
  });

  it('returns 400 when email is missing', async () => {
    const req = fakeRequest({ query: {} });
    const res = await handler(req, {});
    expect(res.status).toBe(400);
  });

  it('returns null player when email not found', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ query: { email: 'unknown@test.com' } });
    const res = await handler(req, {});
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player).toBeNull();
  });

  it('returns player with active session and board state', async () => {
    const boardState = JSON.stringify({ cleared: [true, false], wonLines: ['R1'], keywords: [] });
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc123' }],
      [{ id: 10, pack_id: 42, campaign_id: 'APR26', tiles_cleared: 3, lines_won: 1, keywords_earned: 1, board_state: boardState, started_at: '2026-04-20', last_active_at: '2026-04-24' }],
    ]);
    const req = fakeRequest({ query: { email: 'alice@test.com' } });
    const res = await handler(req, {});
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player.playerName).toBe('Alice');
    expect(res.jsonBody.player.activeSession.packId).toBe(42);
    expect(res.jsonBody.player.activeSession.boardState.wonLines).toEqual(['R1']);
  });

  it('returns player with no sessions', async () => {
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Bob', session_id: 'def456' }],
      [],
    ]);
    const req = fakeRequest({ query: { email: 'bob@test.com' } });
    const res = await handler(req, {});
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player.activeSession).toBeNull();
  });

  it('returns assignment metadata and assignment-bound session in lifecycle mode', async () => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(true);
    vi.mocked(resolvePackAssignment).mockResolvedValue({
      campaign: { id: 'APR26', totalPacks: 999, totalWeeks: 7 },
      assignment: {
        assignmentId: 21,
        packId: 77,
        cycleNumber: 2,
        status: 'active',
        campaignId: 'APR26',
      },
      rotated: true,
      completedPackId: 12,
    });

    const boardState = JSON.stringify({
      cleared: [true, false],
      wonLines: ['R1'],
      keywords: [],
      challengeProfile: { weeksCompleted: 0 },
    });
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc123' }],
      [{ id: 201, pack_id: 77, campaign_id: 'APR26', tiles_cleared: 1, lines_won: 1, keywords_earned: 1, board_state: boardState, started_at: '2026-04-20', last_active_at: '2026-04-24' }],
    ]);

    const req = fakeRequest({ query: { email: 'alice@test.com' } });
    const res = await handler(req, {});

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player.activeAssignment.packId).toBe(77);
    expect(res.jsonBody.player.activeAssignment.rotated).toBe(true);
    expect(res.jsonBody.player.activeSession.packId).toBe(77);
  });
});
