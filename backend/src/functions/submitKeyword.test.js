import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest, sqlError } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/organizations.js', () => ({ resolveOrganizationForEmail: vi.fn() }));

import { getPool } from '../lib/db.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './submitKeyword.js';

const VALID_KEYWORD = 'CO-APR26-042-R1-ABCD1234';

function validBody(overrides = {}) {
  return {
    org: 'Contoso',
    name: 'Ada Lovelace',
    email: 'ada@contoso.com',
    keyword: VALID_KEYWORD,
    ...overrides,
  };
}

describe('POST /submissions (submitKeyword)', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: 10,
      orgName: 'Contoso',
      requiresOrganization: false,
    });
  });

  describe('input validation', () => {
    it('returns 400 when any required field is missing', async () => {
      for (const key of ['org', 'name', 'email', 'keyword']) {
        const res = await handler(fakeRequest({ body: validBody({ [key]: '' }) }));
        expect(res.status, `missing ${key}`).toBe(400);
      }
      expect(getPool).not.toHaveBeenCalled();
    });

    it('treats whitespace-only fields as missing', async () => {
      const res = await handler(fakeRequest({ body: validBody({ org: '   ' }) }));
      expect(res.status).toBe(400);
    });

    it('returns 400 for emails without @', async () => {
      const res = await handler(fakeRequest({ body: validBody({ email: 'not-an-email' }) }));
      expect(res.status).toBe(400);
      expect(res.jsonBody.message).toMatch(/Invalid email/);
    });

    it('returns 400 for malformed keywords', async () => {
      const res = await handler(fakeRequest({ body: validBody({ keyword: 'NOT-A-KEYWORD' }) }));
      expect(res.status).toBe(400);
      expect(res.jsonBody.message).toMatch(/keyword/i);
    });

    it('normalizes keyword to uppercase and email to lowercase before validation', async () => {
      const { pool, calls } = createMockPool([
        [{ id: 20 }], // player upsert
        [], // insert submission (rowsAffected 0, but handler ignores)
        [{ cnt: 0 }], // org dupe check
      ]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(
        fakeRequest({
          body: {
            org: 'Contoso',
            name: 'Ada',
            email: 'ADA@Contoso.COM',
            keyword: VALID_KEYWORD.toLowerCase(),
          },
        }),
      );
      expect(res.jsonBody.ok).toBe(true);
      expect(resolveOrganizationForEmail).toHaveBeenCalledWith(pool, {
        email: 'ada@contoso.com',
        organizationName: 'Contoso',
      });
      expect(calls[1].inputs.keyword).toBe(VALID_KEYWORD);
    });
  });

  describe('org resolution', () => {
    it('uses the shared resolver org id for submission inserts', async () => {
      const { pool, calls } = createMockPool([[{ id: 20 }], [], [{ cnt: 0 }]]);
      vi.mocked(getPool).mockResolvedValue(pool);

      await handler(fakeRequest({ body: validBody() }));
      expect(calls[1].inputs.orgId).toBe(10);
    });

    it('uses the resolved organization name in response messages', async () => {
      vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
        orgId: 99,
        orgName: 'Mapped Contoso',
      });
      const { pool } = createMockPool([[{ id: 40 }], [], [{ cnt: 0 }]]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(fakeRequest({ body: validBody({ org: 'Manual Name' }) }));
      expect(res.jsonBody.ok).toBe(true);
      expect(res.jsonBody.message).toMatch(/Mapped Contoso/);
    });

    it('returns 400 when the resolver cannot determine an organization', async () => {
      vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: null });
      const { pool } = createMockPool([]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(fakeRequest({ body: validBody() }));
      expect(res.status).toBe(400);
      expect(res.jsonBody.message).toMatch(/resolve organization/i);
    });
  });

  describe('duplicate detection', () => {
    it('returns 409 when the same player submits the same keyword (2627)', async () => {
      const { pool } = createMockPool([
        [{ id: 20 }], // player upsert
        sqlError(2627), // submission insert dupe
      ]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(fakeRequest({ body: validBody() }));
      expect(res.status).toBe(409);
      expect(res.jsonBody.message).toMatch(/already submitted/i);
    });

    it('also handles the alternate duplicate-key code 2601', async () => {
      const { pool } = createMockPool([[{ id: 20 }], sqlError(2601)]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(fakeRequest({ body: validBody() }));
      expect(res.status).toBe(409);
    });

    it('propagates non-constraint errors', async () => {
      const { pool } = createMockPool([[{ id: 20 }], sqlError(9001, 'boom')]);
      vi.mocked(getPool).mockResolvedValue(pool);

      await expect(handler(fakeRequest({ body: validBody() }))).rejects.toThrow(/boom/);
    });

    it('flags orgDupe=true when a teammate already submitted this keyword', async () => {
      const { pool } = createMockPool([
        [{ id: 20 }],
        [], // insert succeeds
        [{ cnt: 1 }], // another player in same org already had this keyword
      ]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(fakeRequest({ body: validBody() }));
      expect(res.jsonBody.ok).toBe(true);
      expect(res.jsonBody.orgDupe).toBe(true);
      expect(res.jsonBody.message).toMatch(/already counted/i);
    });

    it('flags orgDupe=false when first submission for the org', async () => {
      const { pool } = createMockPool([[{ id: 20 }], [], [{ cnt: 0 }]]);
      vi.mocked(getPool).mockResolvedValue(pool);

      const res = await handler(fakeRequest({ body: validBody() }));
      expect(res.jsonBody.orgDupe).toBe(false);
      expect(res.jsonBody.message).toMatch(/Leaderboard updated/);
    });
  });
});
