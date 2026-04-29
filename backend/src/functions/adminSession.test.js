import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAdminRefreshToken } from '../lib/adminAuth.js';
import { ADMIN_COOKIE_NAMES } from '../lib/adminCookies.js';
import { fakeRequest } from '../test-helpers/mockPool.js';

const { refreshHandler, logoutHandler } = await import('./adminSession.js');

describe('admin session endpoints', () => {
  let prevSecret;

  beforeEach(() => {
    prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret-key-padded-to-min-32-chars';
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('rotates access and refresh cookies for a valid refresh cookie', async () => {
    const refreshToken = signAdminRefreshToken('admin@test.com');
    const res = await refreshHandler(
      fakeRequest({ headers: { cookie: `${ADMIN_COOKIE_NAMES.refresh}=${refreshToken}` } }),
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
      fakeRequest({ headers: { cookie: `${ADMIN_COOKIE_NAMES.refresh}=bad-token` } }),
      { log: vi.fn() },
    );

    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Unauthorized' });
    expect(res.cookies.every((cookie) => cookie.maxAge === 0)).toBe(true);
  });

  it('clears auth cookies on logout', async () => {
    const res = await logoutHandler(fakeRequest(), { log: vi.fn() });

    expect(res.jsonBody).toEqual({ ok: true });
    expect(res.cookies.map((cookie) => cookie.name)).toEqual([
      ADMIN_COOKIE_NAMES.access,
      ADMIN_COOKIE_NAMES.refresh,
      ADMIN_COOKIE_NAMES.stepUp,
    ]);
    expect(res.cookies.every((cookie) => cookie.maxAge === 0)).toBe(true);
  });
});
