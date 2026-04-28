import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { signAdminStepUpToken, signAdminToken } from '../lib/adminAuth.js';
import { ADMIN_COOKIE_NAMES } from '../lib/adminCookies.js';

let mockPool;
vi.mock('../lib/db.js', () => ({ getPool: () => mockPool.pool }));

const { addAdmin, listAdmins, removeAdmin } = await import('./adminAdmins.js');

function authHeaders() {
  return { authorization: `Bearer ${signAdminToken('admin@test.com')}` };
}

function stepUp(action, targetEmail) {
  return signAdminStepUpToken('admin@test.com', { action, targetEmail });
}

function stepUpHeader(action, targetEmail) {
  return `${ADMIN_COOKIE_NAMES.stepUp}=${stepUp(action, targetEmail)}`;
}

describe('admin admin-management endpoints', () => {
  let prevEmails, prevSecret;

  beforeEach(() => {
    prevEmails = process.env.ADMIN_EMAILS;
    prevSecret = process.env.JWT_SECRET;
    process.env.ADMIN_EMAILS = 'admin@test.com';
    process.env.JWT_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    if (prevEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prevEmails;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('lists bootstrap and portal-managed admins', async () => {
    mockPool = createMockPool([
      [
        {
          id: 1,
          email: 'portal@test.com',
          is_active: true,
          created_at: new Date(),
          created_by: 'admin@test.com',
        },
      ],
    ]);
    const res = await listAdmins(fakeRequest({ headers: authHeaders() }), {});
    expect(res.jsonBody.admins.map((admin) => admin.email)).toContain('admin@test.com');
    expect(res.jsonBody.admins.map((admin) => admin.email)).toContain('portal@test.com');
  });

  it('rejects add without step-up token', async () => {
    mockPool = createMockPool([]);
    const req = fakeRequest({ body: { email: 'new@test.com' }, headers: authHeaders() });
    const res = await addAdmin(req, {});
    expect(res.status).toBe(403);
  });

  it('adds admin with fresh step-up token', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    const req = fakeRequest({
      body: { email: ' New@Test.com ' },
      headers: { ...authHeaders(), cookie: stepUpHeader('add-admin', 'new@test.com') },
    });
    const res = await addAdmin(req, {});
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].inputs.email).toBe('new@test.com');
  });

  it('rejects removing bootstrap admins through the portal', async () => {
    mockPool = createMockPool([]);
    const req = fakeRequest({
      params: { email: 'admin@test.com' },
      headers: { ...authHeaders(), cookie: stepUpHeader('remove-admin', 'admin@test.com') },
    });
    const res = await removeAdmin(req, {});
    expect(res.status).toBe(409);
  });

  it('removes portal admin with fresh step-up token', async () => {
    mockPool = createMockPool([
      [{ email: 'portal@test.com' }],
      { recordset: [], rowsAffected: [1] },
    ]);
    const req = fakeRequest({
      params: { email: 'portal@test.com' },
      headers: { ...authHeaders(), cookie: stepUpHeader('remove-admin', 'portal@test.com') },
    });
    const res = await removeAdmin(req, {});
    expect(res.jsonBody.ok).toBe(true);
  });

  it('rejects step-up proof scoped to another target', async () => {
    mockPool = createMockPool([]);
    const req = fakeRequest({
      body: { email: 'new@test.com' },
      headers: { ...authHeaders(), cookie: stepUpHeader('add-admin', 'other@test.com') },
    });
    const res = await addAdmin(req, {});
    expect(res.status).toBe(403);
  });
});
