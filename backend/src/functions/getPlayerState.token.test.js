import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { generatePlayerToken, hashPlayerToken } from '../lib/playerAuth.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));
vi.mock('../lib/packAssignments.js', () => ({
  isPackAssignmentLifecycleEnabled: vi.fn(),
  resolvePackAssignment: vi.fn(),
}));

const { isPackAssignmentLifecycleEnabled } = await import('../lib/packAssignments.js');

const { handler } = await import('./getPlayerState.js');

function tokenedRequest(email, token) {
  const headers = token ? { cookie: `${PLAYER_COOKIE_NAME}=${token}` } : {};
  return fakeRequest({ body: { email }, headers });
}

describe('getPlayerState token enforcement (flag on)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(false);
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('returns {player: null} when the player has a token but the request has none (no oracle)', async () => {
    const realHash = hashPlayerToken(generatePlayerToken());
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc', owner_token: realHash }],
    ]);
    const res = await handler(tokenedRequest('alice@test.com'), {});
    expect(res.jsonBody).toEqual({ ok: true, player: null });
  });

  it('returns {player: null} when the presented token does not match', async () => {
    const realHash = hashPlayerToken(generatePlayerToken());
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc', owner_token: realHash }],
    ]);
    const res = await handler(tokenedRequest('alice@test.com', 'attacker'), {});
    expect(res.jsonBody).toEqual({ ok: true, player: null });
  });

  it('returns the full player payload when the token matches', async () => {
    const token = generatePlayerToken();
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc', owner_token: hashPlayerToken(token) }],
      [],
    ]);
    const res = await handler(tokenedRequest('alice@test.com', token), {});
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player?.playerName).toBe('Alice');
  });

  it('returns the full payload for legacy player rows with null owner_token', async () => {
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc', owner_token: null }],
      [],
    ]);
    const res = await handler(tokenedRequest('alice@test.com'), {});
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player?.playerName).toBe('Alice');
  });

  it('keeps returning {player: null} for unknown emails', async () => {
    mockPool = createMockPool([[]]);
    const res = await handler(tokenedRequest('unknown@test.com'), {});
    expect(res.jsonBody).toEqual({ ok: true, player: null });
  });
});

describe('getPlayerState token enforcement (flag off, rollout safety)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(false);
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('returns the player even when a token is on file but the request has none', async () => {
    const realHash = hashPlayerToken(generatePlayerToken());
    mockPool = createMockPool([
      [{ id: 1, player_name: 'Alice', session_id: 'abc', owner_token: realHash }],
      [],
    ]);
    const res = await handler(tokenedRequest('alice@test.com'), {});
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.player?.playerName).toBe('Alice');
  });
});
