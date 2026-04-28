import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_COOKIE_NAMES,
  clearAdminAuthCookies,
  createAdminCookie,
  getAdminAccessTtlSeconds,
  getCookie,
} from './adminCookies.js';

function requestWithCookie(cookie) {
  return {
    headers: {
      get: (name) => (name === 'cookie' ? cookie : null),
    },
  };
}

describe('admin cookie helpers', () => {
  let prevSecure;
  let prevTtl;
  let prevNodeEnv;

  beforeEach(() => {
    prevSecure = process.env.ADMIN_COOKIE_SECURE;
    prevTtl = process.env.ADMIN_ACCESS_TTL_SECONDS;
    prevNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (prevSecure === undefined) delete process.env.ADMIN_COOKIE_SECURE;
    else process.env.ADMIN_COOKIE_SECURE = prevSecure;
    if (prevTtl === undefined) delete process.env.ADMIN_ACCESS_TTL_SECONDS;
    else process.env.ADMIN_ACCESS_TTL_SECONDS = prevTtl;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it('parses named cookies from the Cookie header', () => {
    const request = requestWithCookie(`theme=dark; ${ADMIN_COOKIE_NAMES.access}=abc%20123`);
    expect(getCookie(request, ADMIN_COOKIE_NAMES.access)).toBe('abc 123');
  });

  it('creates httpOnly cookies with environment-aware attributes', () => {
    process.env.ADMIN_COOKIE_SECURE = 'false';
    const cookie = createAdminCookie('access', 'token', { maxAgeSeconds: 60 });
    expect(cookie).toMatchObject({
      name: ADMIN_COOKIE_NAMES.access,
      value: 'token',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      path: '/api/portal-api',
      maxAge: 60,
    });
  });

  it('uses secure cookies by default in production', () => {
    delete process.env.ADMIN_COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    expect(createAdminCookie('refresh', 'token', { maxAgeSeconds: 60 }).secure).toBe(true);
  });

  it('clears access, refresh, and step-up cookies with matching names', () => {
    const cookies = clearAdminAuthCookies();
    expect(cookies.map((cookie) => cookie.name)).toEqual([
      ADMIN_COOKIE_NAMES.access,
      ADMIN_COOKIE_NAMES.refresh,
      ADMIN_COOKIE_NAMES.stepUp,
    ]);
    expect(cookies.every((cookie) => cookie.maxAge === 0 && cookie.value === '')).toBe(true);
  });

  it('falls back to default access TTL when configured TTL is invalid', () => {
    process.env.ADMIN_ACCESS_TTL_SECONDS = 'nope';
    expect(getAdminAccessTtlSeconds()).toBe(15 * 60);
  });
});
