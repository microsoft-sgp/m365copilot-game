import { timingSafeEqual, createHash, createHmac } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';

// All admin tokens are signed with HS256. Pinning the algorithm in jwt.verify
// blocks algorithm-confusion attacks (eg. RS256 -> HS256 key swap).
const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];
// Defence in depth: refuse to sign or verify with a weak secret. This catches
// misconfigured deployments before they issue or accept short-key tokens.
const MIN_JWT_SECRET_LENGTH = 32;

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) return null;
  return secret;
}

function requireJwtSecret(): string {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error(
      `JWT_SECRET must be configured and at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }
  return secret;
}
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

function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Reject cookie-authenticated requests whose Origin is not in the allowlist.
// CORS already restricts which origins receive responses, but a malicious page
// can still trigger a credentialed POST that mutates state if no server-side
// check exists. We enforce the same allowlist on the receive path.
export function isAllowedAdminOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return false;
  return allowed.includes(origin);
}

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

  // Cookie-bound auth: require an Origin header that matches the configured
  // allowlist. Bearer tokens are server-to-server and do not need this check.
  if (cookieToken && !isAllowedAdminOrigin(request.headers.get('origin'))) {
    return {
      ok: false,
      response: {
        status: 403,
        jsonBody: { ok: false, message: 'Forbidden origin' },
      },
    };
  }

  const secret = getJwtSecret();
  if (!secret) {
    return { ok: false };
  }

  try {
    const payload = asAdminPayload(jwt.verify(token, secret, { algorithms: JWT_ALGORITHMS }));
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
  const secret = requireJwtSecret();
  return jwt.sign({ email, role: 'admin' }, secret, {
    expiresIn: getAdminAccessTtlSeconds(),
    algorithm: 'HS256',
  });
}

export function signAdminRefreshToken(email: string): string {
  const secret = requireJwtSecret();
  return jwt.sign({ email, role: 'admin-refresh' }, secret, {
    expiresIn: getAdminRefreshTtlSeconds(),
    algorithm: 'HS256',
  });
}

export function verifyAdminRefreshToken(token: string | undefined): RefreshVerificationResult {
  const secret = getJwtSecret();
  if (!secret || !token) return { ok: false, message: 'Unauthorized' };

  try {
    const payload = asAdminPayload(jwt.verify(token, secret, { algorithms: JWT_ALGORITHMS }));
    if (payload?.role !== 'admin-refresh' || !payload.email) {
      return { ok: false, message: 'Unauthorized' };
    }
    return { ok: true, email: normalizeEmail(payload.email) };
  } catch {
    return { ok: false, message: 'Unauthorized' };
  }
}

export function signAdminStepUpToken(email: string, scope: StepUpScope = {}): string {
  const secret = requireJwtSecret();
  return jwt.sign(
    {
      email,
      role: 'admin-step-up',
      purpose: 'admin-management',
      action: scope.action,
      targetEmail: scope.targetEmail ? normalizeEmail(scope.targetEmail) : undefined,
    },
    secret,
    { expiresIn: getAdminStepUpTtlSeconds(), algorithm: 'HS256' },
  );
}

export function verifyAdminStepUpToken(
  token: string | undefined,
  expectedEmail: string,
  expectedScope: StepUpScope = {},
): StepUpVerificationResult {
  const secret = getJwtSecret();
  if (!secret || !token) {
    return { ok: false, message: 'OTP re-verification is required' };
  }

  try {
    const payload = asAdminPayload(jwt.verify(token, secret, { algorithms: JWT_ALGORITHMS }));
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

// HMAC-keyed digest of an OTP code so a leak of the admin_otps table cannot
// be brute-forced offline against the 6-digit keyspace. Falls back to plain
// SHA-256 if JWT_SECRET is unavailable (eg. early misconfiguration) so the
// hash format remains stable for tests; production callers always have a
// JWT_SECRET configured via Key Vault.
export function hashOtp(code: string): string {
  const secret = getJwtSecret();
  if (secret) {
    return createHmac('sha256', secret).update(code).digest('hex');
  }
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
