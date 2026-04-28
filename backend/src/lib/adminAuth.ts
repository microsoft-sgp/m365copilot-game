import { timingSafeEqual, createHash } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import {
  ADMIN_COOKIE_NAMES,
  getAdminAccessTtlSeconds,
  getAdminRefreshTtlSeconds,
  getAdminStepUpTtlSeconds,
  getCookie,
} from './adminCookies.js';

type HeaderReader = {
  get(name: string): string | null;
};

type AdminRequest = {
  headers: HeaderReader;
};

type ErrorResponse = {
  status: number;
  jsonBody: { ok: false; message: string };
};

type AdminVerificationResult =
  | { ok: true; email?: string }
  | { ok: false; response: ErrorResponse };

type JwtVerificationResult = AdminVerificationResult | { ok: false; response?: undefined };

type StepUpVerificationResult = { ok: true } | { ok: false; message: string };

type RefreshVerificationResult = { ok: true; email: string } | { ok: false; message: string };

type StepUpScope = {
  action?: string;
  targetEmail?: string;
};

type AdminJwtPayload = JwtPayload & {
  email?: string;
  role?: string;
  purpose?: string;
  action?: string;
  targetEmail?: string;
};

type QueryResult<T> = {
  recordset: T[];
};

type QueryRequest = {
  query<T = Record<string, unknown>>(query: string): Promise<QueryResult<T>>;
};

type AdminEmailPool = {
  request(): QueryRequest;
};

function asAdminPayload(payload: string | JwtPayload): AdminJwtPayload | null {
  return typeof payload === 'string' ? null : (payload as AdminJwtPayload);
}

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function getSqlErrorNumber(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'number' in error
    ? Number((error as { number?: unknown }).number)
    : undefined;
}

export function verifyAdmin(request: AdminRequest): AdminVerificationResult {
  const jwtResult = verifyJwt(request);
  if (jwtResult.ok) return jwtResult;

  const keyResult = verifyAdminKey(request);
  if (keyResult.ok) return keyResult;

  if (jwtResult.response) return jwtResult;
  return keyResult;
}

function verifyJwt(request: AdminRequest): JwtVerificationResult {
  const cookieToken = getCookie(request, ADMIN_COOKIE_NAMES.access);
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = cookieToken || bearerToken;
  if (!token) {
    return { ok: false };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false };
  }

  try {
    const payload = asAdminPayload(jwt.verify(token, secret));
    if (payload?.role !== 'admin') {
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
    const message = getErrorName(err) === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return {
      ok: false,
      response: {
        status: 401,
        jsonBody: { ok: false, message },
      },
    };
  }
}

export function signAdminToken(email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ email, role: 'admin' }, secret, { expiresIn: getAdminAccessTtlSeconds() });
}

export function signAdminRefreshToken(email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ email, role: 'admin-refresh' }, secret, {
    expiresIn: getAdminRefreshTtlSeconds(),
  });
}

export function verifyAdminRefreshToken(token: string | undefined): RefreshVerificationResult {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return { ok: false, message: 'Unauthorized' };

  try {
    const payload = asAdminPayload(jwt.verify(token, secret));
    if (payload?.role !== 'admin-refresh' || !payload.email) {
      return { ok: false, message: 'Unauthorized' };
    }
    return { ok: true, email: normalizeEmail(payload.email) };
  } catch {
    return { ok: false, message: 'Unauthorized' };
  }
}

export function signAdminStepUpToken(email: string, scope: StepUpScope = {}): string {
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
    { expiresIn: getAdminStepUpTtlSeconds() },
  );
}

export function verifyAdminStepUpToken(
  token: string | undefined,
  expectedEmail: string,
  expectedScope: StepUpScope = {},
): StepUpVerificationResult {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) {
    return { ok: false, message: 'OTP re-verification is required' };
  }

  try {
    const payload = asAdminPayload(jwt.verify(token, secret));
    if (
      payload?.role !== 'admin-step-up' ||
      payload.purpose !== 'admin-management' ||
      payload.email !== expectedEmail ||
      (expectedScope.action && payload.action !== expectedScope.action) ||
      (expectedScope.targetEmail &&
        payload.targetEmail !== normalizeEmail(expectedScope.targetEmail))
    ) {
      return { ok: false, message: 'OTP re-verification is required' };
    }
    return { ok: true };
  } catch (err) {
    const message =
      getErrorName(err) === 'TokenExpiredError'
        ? 'OTP re-verification expired. Please verify again.'
        : 'OTP re-verification is required';
    return { ok: false, message };
  }
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map(normalizeEmail).filter(Boolean);
}

export async function getDatabaseAdminEmails(pool: AdminEmailPool): Promise<string[]> {
  try {
    const result = await pool.request().query<{ email: string }>(`
      SELECT email FROM admin_users
      WHERE is_active = 1
      ORDER BY email;
    `);
    return result.recordset.map((row) => normalizeEmail(row.email)).filter(Boolean);
  } catch (err) {
    if (getSqlErrorNumber(err) === 208) return [];
    throw err;
  }
}

export async function getEffectiveAdminEmails(pool: AdminEmailPool): Promise<string[]> {
  const emails = new Set(getAdminEmails());
  const dbEmails = await getDatabaseAdminEmails(pool);
  for (const email of dbEmails) emails.add(email);
  return [...emails];
}

export async function isEffectiveAdminEmail(
  pool: AdminEmailPool,
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const emails = await getEffectiveAdminEmails(pool);
  return emails.includes(normalized);
}

export function verifyAdminKey(request: AdminRequest): AdminVerificationResult {
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
