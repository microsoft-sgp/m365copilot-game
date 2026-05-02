import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  constantTimeEqualHex,
  createPlayerDeviceToken,
  generatePlayerToken,
  getPlayerTokenFromRequest,
  hashPlayerToken,
  isPlayerTokenEnforcementEnabled,
  verifyPlayerTokenForPlayer,
  verifyPlayerOwnsRow,
} from './playerAuth.js';
import {
  PLAYER_COOKIE_NAME,
  clearPlayerTokenCookie,
  createPlayerTokenCookie,
} from './playerCookies.js';
import { createMockPool } from '../test-helpers/mockPool.js';

function fakeRequest({ cookieHeader, headerToken } = {}) {
  return {
    headers: {
      get: (name) => {
        const lower = name.toLowerCase();
        if (lower === 'cookie') return cookieHeader || null;
        if (lower === 'x-player-token') return headerToken || null;
        return null;
      },
    },
  };
}

describe('generatePlayerToken', () => {
  it('produces 43-character base64url tokens', () => {
    const token = generatePlayerToken();
    // 32 bytes base64url-encoded → 43 chars (no padding)
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('produces a different token on each call', () => {
    const a = generatePlayerToken();
    const b = generatePlayerToken();
    expect(a).not.toBe(b);
  });
});

describe('hashPlayerToken', () => {
  it('produces a 64-char hex digest', () => {
    const hash = hashPlayerToken('any-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashPlayerToken('abc')).toBe(hashPlayerToken('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashPlayerToken('abc')).not.toBe(hashPlayerToken('abd'));
  });
});

describe('constantTimeEqualHex', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeEqualHex('abcd', 'abcd')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(constantTimeEqualHex('abcd', 'abce')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeEqualHex('abc', 'abcd')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(constantTimeEqualHex(undefined, 'abc')).toBe(false);
    expect(constantTimeEqualHex('abc', null)).toBe(false);
  });
});

describe('verifyPlayerOwnsRow', () => {
  it('returns true when the SHA-256 of the presented token matches the stored hash', () => {
    const token = generatePlayerToken();
    const hash = hashPlayerToken(token);
    expect(verifyPlayerOwnsRow(token, hash)).toBe(true);
  });

  it('returns false on mismatch', () => {
    const tokenA = generatePlayerToken();
    const tokenB = generatePlayerToken();
    expect(verifyPlayerOwnsRow(tokenA, hashPlayerToken(tokenB))).toBe(false);
  });

  it('returns false when the token is empty', () => {
    expect(verifyPlayerOwnsRow('', hashPlayerToken('x'))).toBe(false);
  });

  it('returns false when the stored hash is null or empty', () => {
    expect(verifyPlayerOwnsRow('any', null)).toBe(false);
    expect(verifyPlayerOwnsRow('any', '')).toBe(false);
  });
});

describe('createPlayerDeviceToken', () => {
  it('inserts a hashed token for the player', async () => {
    const { pool, calls } = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    await createPlayerDeviceToken(pool, 42, hashPlayerToken('device-token'));
    expect(calls[0].query).toMatch(/INSERT INTO player_device_tokens/);
    expect(calls[0].inputs.playerId).toBe(42);
  });

  it('ignores duplicate token hash inserts', async () => {
    const err = new Error('duplicate');
    err.number = 2601;
    const { pool } = createMockPool([err]);
    await expect(createPlayerDeviceToken(pool, 42, hashPlayerToken('device-token'))).resolves.toBeUndefined();
  });
});

describe('verifyPlayerTokenForPlayer', () => {
  it('accepts the legacy players.owner_token hash', async () => {
    const token = generatePlayerToken();
    const { pool, calls } = createMockPool([]);
    await expect(
      verifyPlayerTokenForPlayer(pool, {
        playerId: 42,
        ownerTokenHash: hashPlayerToken(token),
        presentedToken: token,
      }),
    ).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('accepts an active device token and updates last_seen_at', async () => {
    const token = generatePlayerToken();
    const { pool, calls } = createMockPool([
      { recordset: [{ token_hash: hashPlayerToken(token) }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    await expect(
      verifyPlayerTokenForPlayer(pool, {
        playerId: 42,
        ownerTokenHash: hashPlayerToken('legacy-token'),
        presentedToken: token,
      }),
    ).resolves.toBe(true);
    expect(calls[0].query).toMatch(/FROM player_device_tokens/);
    expect(calls[1].query).toMatch(/SET last_seen_at = SYSUTCDATETIME/);
  });

  it('rejects a revoked device token because active lookup returns no rows', async () => {
    const { pool } = createMockPool([{ recordset: [] }]);
    await expect(
      verifyPlayerTokenForPlayer(pool, {
        playerId: 42,
        ownerTokenHash: hashPlayerToken('legacy-token'),
        presentedToken: 'revoked-token',
      }),
    ).resolves.toBe(false);
  });

  it('rejects missing and mismatched tokens', async () => {
    const { pool: missingPool, calls: missingCalls } = createMockPool([]);
    await expect(
      verifyPlayerTokenForPlayer(missingPool, {
        playerId: 42,
        ownerTokenHash: hashPlayerToken('legacy-token'),
        presentedToken: '',
      }),
    ).resolves.toBe(false);
    expect(missingCalls).toHaveLength(0);

    const { pool } = createMockPool([{ recordset: [{ token_hash: hashPlayerToken('other') }] }]);
    await expect(
      verifyPlayerTokenForPlayer(pool, {
        playerId: 42,
        ownerTokenHash: hashPlayerToken('legacy-token'),
        presentedToken: 'attacker-token',
      }),
    ).resolves.toBe(false);
  });
});

describe('getPlayerTokenFromRequest', () => {
  it('reads the token from the cookie when present', () => {
    const req = fakeRequest({ cookieHeader: `${PLAYER_COOKIE_NAME}=cookie-token` });
    expect(getPlayerTokenFromRequest(req)).toBe('cookie-token');
  });

  it('falls back to the X-Player-Token header when the cookie is absent', () => {
    const req = fakeRequest({ headerToken: 'header-token' });
    expect(getPlayerTokenFromRequest(req)).toBe('header-token');
  });

  it('prefers the cookie when both are present', () => {
    const req = fakeRequest({
      cookieHeader: `${PLAYER_COOKIE_NAME}=cookie-token`,
      headerToken: 'header-token',
    });
    expect(getPlayerTokenFromRequest(req)).toBe('cookie-token');
  });

  it('returns an empty string when neither is present', () => {
    expect(getPlayerTokenFromRequest(fakeRequest({}))).toBe('');
  });

  it('decodes URL-encoded cookie values', () => {
    const encoded = encodeURIComponent('a/b+c=');
    const req = fakeRequest({ cookieHeader: `${PLAYER_COOKIE_NAME}=${encoded}` });
    expect(getPlayerTokenFromRequest(req)).toBe('a/b+c=');
  });
});

describe('isPlayerTokenEnforcementEnabled', () => {
  let prev;

  beforeEach(() => {
    prev = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prev;
  });

  it('defaults to true when unset', () => {
    delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    expect(isPlayerTokenEnforcementEnabled()).toBe(true);
  });

  it('is true for any value other than the literal string "false"', () => {
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'true';
    expect(isPlayerTokenEnforcementEnabled()).toBe(true);
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = '0';
    expect(isPlayerTokenEnforcementEnabled()).toBe(true);
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'no';
    expect(isPlayerTokenEnforcementEnabled()).toBe(true);
  });

  it('is false when set to the literal string "false"', () => {
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
    expect(isPlayerTokenEnforcementEnabled()).toBe(false);
  });
});

describe('createPlayerTokenCookie / clearPlayerTokenCookie', () => {
  it('issues HttpOnly cookies under the configured name and path', () => {
    const cookie = createPlayerTokenCookie('token-value');
    expect(cookie.name).toBe(PLAYER_COOKIE_NAME);
    expect(cookie.value).toBe('token-value');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/api');
    expect(cookie.maxAge).toBeGreaterThan(0);
  });

  it('clear cookie has zero max-age and an epoch expiry', () => {
    const cookie = clearPlayerTokenCookie();
    expect(cookie.value).toBe('');
    expect(cookie.maxAge).toBe(0);
    expect(cookie.expires?.getTime()).toBe(0);
  });
});
