import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api.js';

// Captured fetch invocations
let fetchSpy;

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => data,
  };
}

function csvResponse(text, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => 'text/csv; charset=utf-8' },
    blob: async () => new Blob([text], { type: 'text/csv' }),
    json: async () => {
      throw new Error('not json');
    },
  };
}

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy;
  sessionStorage.clear();
});

afterEach(() => {
  delete globalThis.fetch;
  sessionStorage.clear();
});

describe('public request() wrapper', () => {
  it('sends POST with JSON body and returns parsed envelope', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true, gameSessionId: 1 }));
    const res = await api.apiCreateSession({ sessionId: 's', playerName: 'Ada' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/api\/sessions$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ sessionId: 's', playerName: 'Ada' });
    expect(res).toEqual({ ok: true, status: 200, data: { ok: true, gameSessionId: 1 } });
  });

  it('returns { ok:false, status:0, data:null } on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const res = await api.apiSubmitKeyword({ keyword: 'X' });
    expect(res).toEqual({ ok: false, status: 0, data: null });
  });

  it('preserves non-2xx status with parsed body', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: 'bad' }, { ok: false, status: 400 }),
    );
    const res = await api.apiRecordEvent({ kind: 'tile' });
    expect(res).toEqual({ ok: false, status: 400, data: { ok: false, message: 'bad' } });
  });

  it('omits body for GET requests', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ entries: [] }));
    await api.apiGetLeaderboard('NOV26');
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(opts.body).toBeUndefined();
  });

  it('encodes campaign in leaderboard URL', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}));
    await api.apiGetLeaderboard('a/b c');
    expect(fetchSpy.mock.calls[0][0]).toMatch(/leaderboard\?campaign=a%2Fb%20c$/);
  });

  it('posts player state email in the body', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ player: null }));
    await api.apiGetPlayerState('a+b@example.com');
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/player\/state$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ email: 'a+b@example.com' });
  });

  it('apiGetCampaignConfig and apiGetOrgDomains use expected paths', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse({}));
    await api.apiGetCampaignConfig();
    await api.apiGetOrgDomains();
    expect(fetchSpy.mock.calls[0][0]).toMatch(/campaigns\/active$/);
    expect(fetchSpy.mock.calls[1][0]).toMatch(/organizations\/domains$/);
  });
});

describe('admin request() wrapper', () => {
  it('uses credentialed requests without Authorization headers', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ admins: [] }));
    await api.apiAdminGetAdmins();
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.credentials).toBe('include');
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('returns blob for text/csv responses', async () => {
    fetchSpy.mockResolvedValueOnce(csvResponse('a,b\n1,2'));
    const res = await api.apiAdminExportCsv('APR26');
    expect(res.ok).toBe(true);
    expect(res.blob).toBeInstanceOf(Blob);
    expect(await res.blob.text()).toBe('a,b\n1,2');
  });

  it('returns { ok:false, status:0, data:null } on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const res = await api.apiAdminGetAdmins();
    expect(res).toEqual({ ok: false, status: 0, data: null });
  });

  it('encodes admin email in remove path', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.apiAdminRemoveAdmin('a+b@x.com');
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/admins\/a%2Bb%40x\.com$/);
    expect(opts.method).toBe('DELETE');
    expect(opts.body).toBeUndefined();
  });

  it('encodes search query parameter', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ players: [] }));
    await api.apiAdminSearchPlayers('jo hn');
    expect(fetchSpy.mock.calls[0][0]).toMatch(/players\?q=jo%20hn$/);
  });

  it('apiAdminVerifyStepUpOtp posts purpose+action+targetEmail', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.apiAdminVerifyStepUpOtp('admin@x.com', '123456', 'add-admin', 'new@x.com');
    expect(fetchSpy.mock.calls[0][1].credentials).toBe('include');
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toEqual({
      email: 'admin@x.com',
      code: '123456',
      purpose: 'admin-management',
      action: 'add-admin',
      targetEmail: 'new@x.com',
    });
  });

  it('apiAdminVerifyOtp and session endpoints use credentialed requests', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.apiAdminVerifyOtp('admin@x.com', '123456');
    await api.apiAdminRefresh();
    await api.apiAdminLogout();
    expect(fetchSpy.mock.calls.map((call) => call[1].credentials)).toEqual([
      'include',
      'include',
      'include',
    ]);
  });
});
