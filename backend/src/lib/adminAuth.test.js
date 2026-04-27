import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  verifyAdminKey,
  verifyAdmin,
  signAdminToken,
  hashOtp,
  getAdminEmails,
  getEffectiveAdminEmails,
  normalizeEmail,
  signAdminStepUpToken,
  verifyAdminStepUpToken,
} from './adminAuth.js';

function fakeRequest(headerValue, authHeader) {
  return {
    headers: {
      get: (name) => {
        if (name === 'x-admin-key') return headerValue;
        if (name === 'authorization') return authHeader || null;
        return null;
      },
    },
  };
}

describe('verifyAdminKey', () => {
  let prev;

  beforeEach(() => {
    prev = process.env.ADMIN_KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = prev;
  });

  it('returns 500 when ADMIN_KEY is not configured', () => {
    delete process.env.ADMIN_KEY;
    const result = verifyAdminKey(fakeRequest('anything'));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(500);
    expect(result.response.jsonBody.message).toMatch(/not configured/i);
  });

  it('returns 500 when ADMIN_KEY is empty string', () => {
    process.env.ADMIN_KEY = '';
    const result = verifyAdminKey(fakeRequest('anything'));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(500);
  });

  it('returns 401 when header is missing', () => {
    process.env.ADMIN_KEY = 'secret-123';
    const result = verifyAdminKey(fakeRequest(null));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
    expect(result.response.jsonBody.message).toMatch(/unauthorized/i);
  });

  it('returns 401 when header is empty string', () => {
    process.env.ADMIN_KEY = 'secret-123';
    const result = verifyAdminKey(fakeRequest(''));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
  });

  it('returns 401 when header does not match', () => {
    process.env.ADMIN_KEY = 'secret-123';
    const result = verifyAdminKey(fakeRequest('wrong-key'));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
  });

  it('returns 401 when provided key is shorter (length guard)', () => {
    // Regression: timingSafeEqual throws on different lengths; handler must guard.
    process.env.ADMIN_KEY = 'secret-123';
    const result = verifyAdminKey(fakeRequest('secret-1'));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
  });

  it('returns 401 when provided key is longer', () => {
    process.env.ADMIN_KEY = 'secret-123';
    const result = verifyAdminKey(fakeRequest('secret-123-extra'));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
  });

  it('returns ok when keys match exactly', () => {
    process.env.ADMIN_KEY = 'secret-123';
    const result = verifyAdminKey(fakeRequest('secret-123'));
    expect(result.ok).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it('matches unicode keys', () => {
    process.env.ADMIN_KEY = 'séçret-🔑';
    const result = verifyAdminKey(fakeRequest('séçret-🔑'));
    expect(result.ok).toBe(true);
  });

  it('is case-sensitive', () => {
    process.env.ADMIN_KEY = 'SECRET';
    expect(verifyAdminKey(fakeRequest('secret')).ok).toBe(false);
    expect(verifyAdminKey(fakeRequest('SECRET')).ok).toBe(true);
  });
});

describe('verifyAdmin (JWT + key)', () => {
  let prevKey, prevSecret;

  beforeEach(() => {
    prevKey = process.env.ADMIN_KEY;
    prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret-key-1234567890';
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = prevKey;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('accepts valid JWT in Authorization header', () => {
    const token = signAdminToken('admin@test.com');
    const req = fakeRequest(null, `Bearer ${token}`);
    const result = verifyAdmin(req);
    expect(result.ok).toBe(true);
    expect(result.email).toBe('admin@test.com');
  });

  it('falls back to x-admin-key when no JWT', () => {
    process.env.ADMIN_KEY = 'my-key';
    const req = fakeRequest('my-key', null);
    const result = verifyAdmin(req);
    expect(result.ok).toBe(true);
  });

  it('rejects expired JWT', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { email: 'admin@test.com', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' },
    );
    const req = fakeRequest(null, `Bearer ${token}`);
    const result = verifyAdmin(req);
    expect(result.ok).toBe(false);
    expect(result.response.jsonBody.message).toBe('Token expired');
  });

  it('rejects JWT with wrong role', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { email: 'user@test.com', role: 'player' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );
    const req = fakeRequest(null, `Bearer ${token}`);
    const result = verifyAdmin(req);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid JWT signature', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { email: 'admin@test.com', role: 'admin' },
      'wrong-secret',
      { expiresIn: '1h' },
    );
    const req = fakeRequest(null, `Bearer ${token}`);
    const result = verifyAdmin(req);
    expect(result.ok).toBe(false);
    expect(result.response.jsonBody.message).toBe('Invalid token');
  });
});

describe('signAdminToken', () => {
  let prevSecret;

  beforeEach(() => {
    prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('generates a valid JWT with admin role', () => {
    const token = signAdminToken('admin@test.com');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    expect(() => signAdminToken('admin@test.com')).toThrow();
  });
});

describe('hashOtp', () => {
  it('produces consistent SHA-256 hash', () => {
    const h1 = hashOtp('123456');
    const h2 = hashOtp('123456');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('produces different hashes for different codes', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('654321'));
  });
});

describe('getAdminEmails', () => {
  let prev;

  beforeEach(() => { prev = process.env.ADMIN_EMAILS; });
  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });

  it('parses comma-separated emails', () => {
    process.env.ADMIN_EMAILS = 'a@b.com, C@D.com ,e@f.com';
    expect(getAdminEmails()).toEqual(['a@b.com', 'c@d.com', 'e@f.com']);
  });

  it('returns empty array when not set', () => {
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
  });
});

describe('effective admin emails', () => {
  let prev;

  beforeEach(() => { prev = process.env.ADMIN_EMAILS; });
  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });

  it('normalizes email whitespace and casing', () => {
    expect(normalizeEmail(' Admin@Test.COM ')).toBe('admin@test.com');
  });

  it('combines bootstrap and database-backed admins', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com';
    const pool = {
      request: () => ({
        query: async () => ({ recordset: [{ email: 'DbAdmin@Test.com' }] }),
      }),
    };
    await expect(getEffectiveAdminEmails(pool)).resolves.toEqual(['admin@test.com', 'dbadmin@test.com']);
  });
});

describe('admin step-up token', () => {
  let prevSecret;

  beforeEach(() => {
    prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('accepts valid admin-management proof for matching admin', () => {
    const token = signAdminStepUpToken('admin@test.com');
    expect(verifyAdminStepUpToken(token, 'admin@test.com').ok).toBe(true);
  });

  it('rejects proof for another admin', () => {
    const token = signAdminStepUpToken('admin@test.com');
    expect(verifyAdminStepUpToken(token, 'other@test.com').ok).toBe(false);
  });
});
