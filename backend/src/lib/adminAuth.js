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

export function signAdminStepUpToken(email, scope = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    {
      email,
      role: 'admin-step-up',
      purpose: 'admin-management',
      action: scope.action,
      targetEmail: scope.targetEmail ? normalizeEmail(scope.targetEmail) : undefined,
    },
    secret,
    { expiresIn: '5m' },
  );
}

export function verifyAdminStepUpToken(token, expectedEmail, expectedScope = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) {
    return { ok: false, message: 'OTP re-verification is required' };
  }

  try {
    const payload = jwt.verify(token, secret);
    if (
      payload.role !== 'admin-step-up'
      || payload.purpose !== 'admin-management'
      || payload.email !== expectedEmail
      || (expectedScope.action && payload.action !== expectedScope.action)
      || (expectedScope.targetEmail && payload.targetEmail !== normalizeEmail(expectedScope.targetEmail))
    ) {
      return { ok: false, message: 'OTP re-verification is required' };
    }
    return { ok: true };
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'OTP re-verification expired. Please verify again.'
      : 'OTP re-verification is required';
    return { ok: false, message };
  }
}

export function hashOtp(code) {
  return createHash('sha256').update(code).digest('hex');
}

export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map(normalizeEmail).filter(Boolean);
}

export async function getDatabaseAdminEmails(pool) {
  try {
    const result = await pool.request().query(`
      SELECT email FROM admin_users
      WHERE is_active = 1
      ORDER BY email;
    `);
    return result.recordset.map((row) => normalizeEmail(row.email)).filter(Boolean);
  } catch (err) {
    if (err.number === 208) return [];
    throw err;
  }
}

export async function getEffectiveAdminEmails(pool) {
  const emails = new Set(getAdminEmails());
  const dbEmails = await getDatabaseAdminEmails(pool);
  for (const email of dbEmails) emails.add(email);
  return [...emails];
}

export async function isEffectiveAdminEmail(pool, email) {
  const normalized = normalizeEmail(email);
  const emails = await getEffectiveAdminEmails(pool);
  return emails.includes(normalized);
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
