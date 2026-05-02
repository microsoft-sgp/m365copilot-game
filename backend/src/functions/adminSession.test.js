import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAdminRefreshToken } from '../lib/adminAuth.js';
import { ADMIN_COOKIE_NAMES } from '../lib/adminCookies.js';
import { fakeRequest } from '../test-helpers/mockPool.js';

const { refreshHandler, logoutHandler } = await import('./adminSession.js');

describe('admin session endpoints', () => {
  let prevSecret;
  let prevOrigins;

  beforeEach(() => {
    prevSecret = process.env.JWT_SECRET;
    prevOrigins = process.env.ALLOWED_ORIGINS;
    process.env.JWT_SECRET = 'test-jwt-secret-key-padded-to-min-32-chars';
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
    if (prevOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = prevOrigins;
  });

  function adminRequest(headers = {}) {
    return fakeRequest({ headers: { origin: 'https://app.example.com', ...headers } });
  }

  it('rotates access and refresh cookies for a valid refresh cookie', async () => {
    const refreshToken = signAdminRefreshToken('admin@test.com');
    const res = await refreshHandler(
      adminRequest({ cookie: `${ADMIN_COOKIE_NAMES.refresh}=${refreshToken}` }),
      { log: vi.fn() },
    );

    expect(res.jsonBody).toEqual({ ok: true });
    expect(res.cookies.map((cookie) => cookie.name)).toEqual([
      ADMIN_COOKIE_NAMES.access,
      ADMIN_COOKIE_NAMES.refresh,
    ]);
    expect(res.cookies.every((cookie) => cookie.httpOnly)).toBe(true);
  });

  it('rejects invalid refresh cookies without issuing auth cookies', async () => {
    const res = await refreshHandler(
      adminRequest({ cookie: `${ADMIN_COOKIE_NAMES.refresh}=bad-token` }),
      { log: vi.fn() },
    );

    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Unauthorized' });
    expect(res.cookies.every((cookie) => cookie.maxAge === 0)).toBe(true);
  });

  it('clears auth cookies on logout', async () => {
    const res = await logoutHandler(adminRequest(), { log: vi.fn() });

    expect(res.jsonBody).toEqual({ ok: true });
    expect(res.cookies.map((cookie) => cookie.name)).toEqual([
      ADMIN_COOKIE_NAMES.access,
      ADMIN_COOKIE_NAMES.refresh,
      ADMIN_COOKIE_NAMES.stepUp,
    ]);
    expect(res.cookies.every((cookie) => cookie.maxAge === 0)).toBe(true);
  });

  it('rejects refresh when Origin is missing', async () => {
    const refreshToken = signAdminRefreshToken('admin@test.com');
    const res = await refreshHandler(
      fakeRequest({ headers: { cookie: `${ADMIN_COOKIE_NAMES.refresh}=${refreshToken}` } }),
      { log: vi.fn() },
    );

    expect(res.status).toBe(403);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Forbidden origin' });
  });

  it('rejects refresh when Origin is forbidden', async () => {
    const refreshToken = signAdminRefreshToken('admin@test.com');
    const res = await refreshHandler(
      fakeRequest({
        headers: {
          origin: 'https://evil.example.com',
          cookie: `${ADMIN_COOKIE_NAMES.refresh}=${refreshToken}`,
        },
      }),
      { log: vi.fn() },
    );

    expect(res.status).toBe(403);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Forbidden origin' });
    expect(res.cookies).toBeUndefined();
  });

  it('rejects logout when Origin is missing', async () => {
    const res = await logoutHandler(fakeRequest(), { log: vi.fn() });

    expect(res.status).toBe(403);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Forbidden origin' });
    expect(res.cookies).toBeUndefined();
  });

  it('rejects logout when Origin is forbidden', async () => {
    const res = await logoutHandler(
      fakeRequest({ headers: { origin: 'https://evil.example.com' } }),
      { log: vi.fn() },
    );

    expect(res.status).toBe(403);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Forbidden origin' });
    expect(res.cookies).toBeUndefined();
  });
});
