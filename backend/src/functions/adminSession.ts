import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import {
  ADMIN_COOKIE_NAMES,
  clearAdminAuthCookies,
  createAdminCookie,
  getAdminAccessTtlSeconds,
  getAdminRefreshTtlSeconds,
  getCookie,
} from '../lib/adminCookies.js';
import {
  requireAllowedOrigin,
  signAdminRefreshToken,
  signAdminToken,
  verifyAdminRefreshToken,
} from '../lib/adminAuth.js';

export const refreshHandler = async (request: HttpRequest, _context: InvocationContext) => {
  const originError = requireAllowedOrigin(request);
  if (originError) return originError;

  const refreshToken = getCookie(request, ADMIN_COOKIE_NAMES.refresh);
  const verification = verifyAdminRefreshToken(refreshToken);

  if (!verification.ok) {
    return {
      status: 401,
      cookies: clearAdminAuthCookies(),
      jsonBody: { ok: false, message: 'Unauthorized' },
    };
  }

  const accessToken = signAdminToken(verification.email);
  const rotatedRefreshToken = signAdminRefreshToken(verification.email);

  return {
    cookies: [
      createAdminCookie('access', accessToken, { maxAgeSeconds: getAdminAccessTtlSeconds() }),
      createAdminCookie('refresh', rotatedRefreshToken, {
        maxAgeSeconds: getAdminRefreshTtlSeconds(),
      }),
    ],
    jsonBody: { ok: true },
  };
};

export const logoutHandler = async (request: HttpRequest, _context: InvocationContext) => {
  const originError = requireAllowedOrigin(request);
  if (originError) return originError;

  return {
    cookies: clearAdminAuthCookies(),
    jsonBody: { ok: true },
  };
};

app.http('adminRefresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/refresh',
  handler: refreshHandler,
});

app.http('adminLogout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/logout',
  handler: logoutHandler,
});
