import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyAdminKey } from './adminAuth.js';

function fakeRequest(headerValue) {
  return {
    headers: {
      get: (name) => {
        if (name !== 'x-admin-key') return null;
        return headerValue;
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
