import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureFrontendApiFailure = vi.hoisted(() => vi.fn());

vi.mock('./sentry.js', () => ({ captureFrontendApiFailure }));

const api = await import('./api.js');

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
  captureFrontendApiFailure.mockClear();
  api.installAdminSessionInvalidHandler(null);
});

afterEach(() => {
  delete globalThis.fetch;
  sessionStorage.clear();
  api.installAdminSessionInvalidHandler(null);
});

describe('Sentry API failure classification', () => {
  it('captures public API status 0 network failures', async () => {
    const error = new Error('offline');
    fetchSpy.mockRejectedValueOnce(error);
    const response = await api.apiSubmitKeyword({ keyword: 'X' });
    expect(response).toEqual({ ok: false, status: 0, data: null });
    expect(captureFrontendApiFailure).toHaveBeenCalledWith({
      method: 'POST',
      path: '/submissions',
      status: 0,
      apiBase: '/api',
      error,
    });
  });

  it('captures public API 4xx and 5xx responses', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 400 }))
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: false, code: api.PLAYER_RECOVERY_REQUIRED },
          { ok: false, status: 409 },
        ),
      );

    await api.apiGetHealth();
    await api.apiGetCampaignConfig();
    await api.apiSubmitKeyword({ keyword: 'X' });

    expect(captureFrontendApiFailure).toHaveBeenCalledTimes(3);
    expect(captureFrontendApiFailure).toHaveBeenCalledWith({
      method: 'GET',
      path: '/health',
      status: 503,
      apiBase: '/api',
    });
    expect(captureFrontendApiFailure).toHaveBeenCalledWith({
      method: 'GET',
      path: '/campaigns/active',
      status: 400,
      apiBase: '/api',
    });
    expect(captureFrontendApiFailure).toHaveBeenCalledWith({
      method: 'POST',
      path: '/submissions',
      status: 409,
      apiBase: '/api',
      workflowCode: api.PLAYER_RECOVERY_REQUIRED,
    });
  });

  it('captures admin API status 0 plus 4xx and 5xx responses', async () => {
    const adminError = new Error('offline');
    const invalidSession = vi.fn();
    api.installAdminSessionInvalidHandler(invalidSession);
    fetchSpy
      .mockRejectedValueOnce(adminError)
      .mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ ok: false }, { ok: false, status: 401 }));

    await api.apiAdminGetAdmins();
    await api.apiAdminGetDashboard();
    await api.apiAdminGetDashboard();

    expect(captureFrontendApiFailure).toHaveBeenCalledTimes(3);
    expect(captureFrontendApiFailure.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      path: '/portal-api/admins',
      status: 0,
      apiBase: '/api',
      error: adminError,
    });
    expect(captureFrontendApiFailure.mock.calls[1][0]).toMatchObject({
      method: 'GET',
      path: '/portal-api/dashboard?campaign=APR26',
      status: 500,
      apiBase: '/api',
    });
    expect(captureFrontendApiFailure.mock.calls[2][0]).toMatchObject({
      method: 'GET',
      path: '/portal-api/dashboard?campaign=APR26',
      status: 401,
      apiBase: '/api',
    });
    expect(invalidSession).toHaveBeenCalledTimes(1);
  });
});
