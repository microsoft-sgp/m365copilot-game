import { describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({ getPool: () => mockPool.pool }));
vi.mock('../lib/adminAuth.js', () => ({
  verifyAdmin: () => ({ ok: true, email: 'admin@test.com' }),
}));

const {
  searchPlayers,
  getPlayerDetail,
  deletePlayer,
  revokeSubmission,
} = await import('./adminPlayers.js');

const headers = { authorization: 'Bearer test' };

describe('adminPlayers.searchPlayers', () => {
  it('wraps the query parameter with LIKE wildcards', async () => {
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', email: 'a@b.com', session_count: 2, submission_count: 5 }],
    ]);
    const res = await searchPlayers(
      fakeRequest({ query: { q: 'ali' }, headers }),
      {},
    );
    expect(res.jsonBody.players).toHaveLength(1);
    expect(mockPool.calls[0].inputs.q).toBe('%ali%');
  });

  it('defaults to wildcard match when q is missing', async () => {
    mockPool = createMockPool([[]]);
    const res = await searchPlayers(fakeRequest({ headers }), {});
    expect(res.jsonBody.players).toEqual([]);
    expect(mockPool.calls[0].inputs.q).toBe('%%');
  });
});

describe('adminPlayers.getPlayerDetail', () => {
  it('rejects non-numeric id', async () => {
    mockPool = createMockPool([]);
    const res = await getPlayerDetail(
      fakeRequest({ params: { id: 'abc' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when player does not exist', async () => {
    mockPool = createMockPool([[]]);
    const res = await getPlayerDetail(
      fakeRequest({ params: { id: '5' }, headers }),
      {},
    );
    expect(res.status).toBe(404);
  });

  it('returns player, sessions and submissions', async () => {
    mockPool = createMockPool([
      [{ id: 5, session_id: 'sid', player_name: 'Bob', email: 'b@x.com', created_at: new Date() }],
      [{ id: 100, pack_id: 1, campaign_id: 'APR26', tiles_cleared: 3, lines_won: 0, keywords_earned: 1 }],
      [{ id: 200, org: 'NUS', keyword: 'CHATBOT', campaign_id: 'APR26' }],
    ]);
    const res = await getPlayerDetail(
      fakeRequest({ params: { id: '5' }, headers }),
      {},
    );
    expect(res.jsonBody.player.email).toBe('b@x.com');
    expect(res.jsonBody.sessions).toHaveLength(1);
    expect(res.jsonBody.submissions).toHaveLength(1);
  });
});

describe('adminPlayers.deletePlayer', () => {
  it('rejects non-numeric id', async () => {
    mockPool = createMockPool([]);
    const res = await deletePlayer(
      fakeRequest({ params: { id: 'abc' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('deletes in FK order: tile_events, game_sessions, submissions, players', async () => {
    mockPool = createMockPool([
      { recordset: [], rowsAffected: [4] },
      { recordset: [], rowsAffected: [2] },
      { recordset: [], rowsAffected: [3] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const res = await deletePlayer(
      fakeRequest({ params: { id: '5' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].query).toContain('tile_events');
    expect(mockPool.calls[1].query).toContain('game_sessions');
    expect(mockPool.calls[2].query).toContain('submissions');
    expect(mockPool.calls[3].query).toContain('players');
  });
});

describe('adminPlayers.revokeSubmission', () => {
  it('rejects invalid id', async () => {
    mockPool = createMockPool([]);
    const res = await revokeSubmission(
      fakeRequest({ params: { id: 'nope' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when nothing deleted', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [0] }]);
    const res = await revokeSubmission(
      fakeRequest({ params: { id: '7' }, headers }),
      {},
    );
    expect(res.status).toBe(404);
  });

  it('deletes the submission', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    const res = await revokeSubmission(
      fakeRequest({ params: { id: '7' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].inputs.id).toBe(7);
  });
});
