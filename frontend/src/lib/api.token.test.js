import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api.js';
import {
  PLAYER_TOKEN_STORAGE_KEY,
  clearPlayerToken,
  getPlayerToken,
  setPlayerToken,
} from './playerToken.js';

let fetchSpy;

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => data,
  };
}

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy;
  sessionStorage.clear();
  api.installPlayerAuthRefresher(null);
});

afterEach(() => {
  delete globalThis.fetch;
  sessionStorage.clear();
  api.installPlayerAuthRefresher(null);
});

describe('player token forwarding', () => {
  it('forwards X-Player-Token from sessionStorage on game-API calls', async () => {
    setPlayerToken('player-token-abc');
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.apiRecordEvent({ gameSessionId: 1, tileIndex: 0, eventType: 'reveal' });
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers['X-Player-Token']).toBe('player-token-abc');
    expect(opts.credentials).toBe('include');
  });

  it('omits the X-Player-Token header when no token is stored', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.apiRecordEvent({ gameSessionId: 1 });
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers['X-Player-Token']).toBeUndefined();
    // credentials must still default to include so the cookie travels.
    expect(opts.credentials).toBe('include');
  });
});

describe('apiCreateSession token capture', () => {
  it('captures the issued playerToken into sessionStorage on success', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ ok: true, gameSessionId: 1, playerToken: 'fresh-token-xyz' }),
    );
    const res = await api.apiCreateSession({
      sessionId: 's',
      playerName: 'Ada',
      email: 'ada@smu.edu.sg',
    });
    expect(res.ok).toBe(true);
    expect(getPlayerToken()).toBe('fresh-token-xyz');
    expect(sessionStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBe('fresh-token-xyz');
  });

  it('does not overwrite an existing token when the response omits playerToken', async () => {
    setPlayerToken('previous');
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true, gameSessionId: 1 }));
    await api.apiCreateSession({ sessionId: 's', playerName: 'Ada' });
    expect(getPlayerToken()).toBe('previous');
  });

  it('does not capture a token from a failed response', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: 'Identity in use' }, { ok: false, status: 409 }),
    );
    const res = await api.apiCreateSession({
      sessionId: 's',
      playerName: 'Ada',
      email: 'ada@smu.edu.sg',
    });
    expect(res.status).toBe(409);
    expect(getPlayerToken()).toBe('');
  });
});

describe('401 retry path on game-API endpoints', () => {
  it('clears the token, calls the refresher, and retries once on 401', async () => {
    setPlayerToken('stale');
    fetchSpy
      // First attempt: 401
      .mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 401 }))
      // Refresher's apiCreateSession call
      .mockResolvedValueOnce(jsonResponse({ ok: true, gameSessionId: 9, playerToken: 'fresh' }))
      // Retry
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    api.installPlayerAuthRefresher(async () => {
      const res = await api.apiCreateSession({
        sessionId: 's',
        playerName: 'Ada',
        email: 'ada@smu.edu.sg',
      });
      return Boolean(res.ok);
    });

    const res = await api.apiRecordEvent({ gameSessionId: 1, tileIndex: 0, eventType: 'reveal' });
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const [firstUrl] = fetchSpy.mock.calls[0];
    const [refreshUrl] = fetchSpy.mock.calls[1];
    const [retryUrl, retryOpts] = fetchSpy.mock.calls[2];
    expect(firstUrl).toMatch(/\/events$/);
    expect(refreshUrl).toMatch(/\/sessions$/);
    expect(retryUrl).toMatch(/\/events$/);
    // The retry sends the freshly-captured token in the header.
    expect(retryOpts.headers['X-Player-Token']).toBe('fresh');
  });

  it('returns the original 401 when no refresher is installed', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 401 }));
    const res = await api.apiRecordEvent({ gameSessionId: 1 });
    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns the original 401 when the refresher fails', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 401 }));
    api.installPlayerAuthRefresher(async () => false);
    const res = await api.apiRecordEvent({ gameSessionId: 1 });
    expect(res.status).toBe(401);
    // No second fetch because the refresher gave up.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Stale token cleared regardless.
    expect(getPlayerToken()).toBe('');
  });

  it('does not retry non-401 failures', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 500 }));
    api.installPlayerAuthRefresher(async () => true);
    const res = await api.apiUpdateSession(1, { tilesCleared: 1 });
    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('clearPlayerToken interop', () => {
  it('subsequent calls after clearPlayerToken omit the header', async () => {
    setPlayerToken('something');
    clearPlayerToken();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.apiRecordEvent({ gameSessionId: 1 });
    expect(fetchSpy.mock.calls[0][1].headers['X-Player-Token']).toBeUndefined();
  });
});
