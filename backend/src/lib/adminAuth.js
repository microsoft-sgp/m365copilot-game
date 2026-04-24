import { timingSafeEqual, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

export function verifyAdmin(request) {
  // Try JWT first, then fall back to static key
  const jwtResult = verifyJwt(request);
  if (jwtResult.ok) return jwtResult;
  // If JWT was provided but invalid, return the JWT error (don't fall back)
  if (jwtResult.response) return jwtResult;

  return verifyAdminKey(request);
}

function verifyJwt(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false };
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false };
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload.role !== 'admin') {
      return {
        ok: false,
        response: {
          status: 401,
          jsonBody: { ok: false, message: 'Unauthorized' },
        },
      };
    }
    return { ok: true, email: payload.email };
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return {
      ok: false,
      response: {
        status: 401,
        jsonBody: { ok: false, message },
      },
    };
  }
}

export function signAdminToken(email) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ email, role: 'admin' }, secret, { expiresIn: '4h' });
}

export function hashOtp(code) {
  return createHash('sha256').update(code).digest('hex');
}

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

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
