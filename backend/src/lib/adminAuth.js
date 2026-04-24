import { timingSafeEqual } from 'node:crypto';

export function verifyAdminKey(request) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return {
      ok: false,
      response: {
        status: 500,
        jsonBody: { ok: false, message: 'Admin access not configured' },
      },
    };
  }

  const provided = request.headers.get('x-admin-key') || '';
  if (!provided) {
    return {
      ok: false,
      response: {
        status: 401,
        jsonBody: { ok: false, message: 'Unauthorized' },
      },
    };
  }

  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(adminKey, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: {
        status: 401,
        jsonBody: { ok: false, message: 'Unauthorized' },
      },
    };
  }

  return { ok: true };
}
