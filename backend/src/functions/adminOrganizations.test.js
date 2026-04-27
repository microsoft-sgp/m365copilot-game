import { describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest, sqlError } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({ getPool: () => mockPool.pool }));
vi.mock('../lib/adminAuth.js', () => ({
  verifyAdmin: () => ({ ok: true, email: 'admin@test.com' }),
}));

const {
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  addDomain,
  removeDomain,
} = await import('./adminOrganizations.js');

const headers = { authorization: 'Bearer test' };

describe('adminOrganizations.listOrganizations', () => {
  it('parses domains JSON column', async () => {
    mockPool = createMockPool([
      [
        { id: 1, name: 'NUS', domains: JSON.stringify([{ id: 10, domain: 'nus.edu.sg' }]) },
        { id: 2, name: 'Acme', domains: null },
      ],
    ]);
    const res = await listOrganizations(fakeRequest({ headers }), {});
    expect(res.jsonBody.organizations).toEqual([
      { id: 1, name: 'NUS', domains: [{ id: 10, domain: 'nus.edu.sg' }] },
      { id: 2, name: 'Acme', domains: [] },
    ]);
  });
});

describe('adminOrganizations.createOrganization', () => {
  it('rejects missing name', async () => {
    mockPool = createMockPool([]);
    const res = await createOrganization(
      fakeRequest({ body: { name: '   ' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('inserts trimmed name and returns new id', async () => {
    mockPool = createMockPool([[{ id: 42 }]]);
    const res = await createOrganization(
      fakeRequest({ body: { name: '  NewOrg ' }, headers }),
      {},
    );
    expect(res.jsonBody).toEqual({ ok: true, id: 42 });
    expect(mockPool.calls[0].inputs.name).toBe('NewOrg');
  });

  it('returns 409 on duplicate', async () => {
    mockPool = createMockPool([sqlError(2627)]);
    const res = await createOrganization(
      fakeRequest({ body: { name: 'Dup' }, headers }),
      {},
    );
    expect(res.status).toBe(409);
  });
});

describe('adminOrganizations.updateOrganization', () => {
  it('rejects invalid id', async () => {
    mockPool = createMockPool([]);
    const res = await updateOrganization(
      fakeRequest({ params: { id: 'abc' }, body: { name: 'X' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing name', async () => {
    mockPool = createMockPool([]);
    const res = await updateOrganization(
      fakeRequest({ params: { id: '5' }, body: { name: '' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when no row updated', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [0] }]);
    const res = await updateOrganization(
      fakeRequest({ params: { id: '5' }, body: { name: 'X' }, headers }),
      {},
    );
    expect(res.status).toBe(404);
  });

  it('updates organization name', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    const res = await updateOrganization(
      fakeRequest({ params: { id: '5' }, body: { name: 'Renamed' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].inputs.id).toBe(5);
    expect(mockPool.calls[0].inputs.name).toBe('Renamed');
  });
});

describe('adminOrganizations.deleteOrganization', () => {
  it('rejects deletion when submissions exist', async () => {
    mockPool = createMockPool([[{ cnt: 3 }]]);
    const res = await deleteOrganization(
      fakeRequest({ params: { id: '7' }, headers }),
      {},
    );
    expect(res.status).toBe(409);
  });

  it('deletes domain mappings then organization', async () => {
    mockPool = createMockPool([
      [{ cnt: 0 }],
      { recordset: [], rowsAffected: [2] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const res = await deleteOrganization(
      fakeRequest({ params: { id: '7' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[1].query).toContain('DELETE FROM org_domains');
    expect(mockPool.calls[2].query).toContain('DELETE FROM organizations');
  });
});

describe('adminOrganizations.addDomain', () => {
  it('rejects invalid org id', async () => {
    mockPool = createMockPool([]);
    const res = await addDomain(
      fakeRequest({ params: { id: 'abc' }, body: { domain: 'x.com' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing domain', async () => {
    mockPool = createMockPool([]);
    const res = await addDomain(
      fakeRequest({ params: { id: '1' }, body: {}, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('lowercases domain before insert', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    const res = await addDomain(
      fakeRequest({ params: { id: '1' }, body: { domain: ' EXAMPLE.com ' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].inputs.domain).toBe('example.com');
  });

  it('returns 409 on duplicate domain mapping', async () => {
    mockPool = createMockPool([sqlError(2601)]);
    const res = await addDomain(
      fakeRequest({ params: { id: '1' }, body: { domain: 'dup.com' }, headers }),
      {},
    );
    expect(res.status).toBe(409);
  });
});

describe('adminOrganizations.removeDomain', () => {
  it('rejects invalid domain id', async () => {
    mockPool = createMockPool([]);
    const res = await removeDomain(
      fakeRequest({ params: { domainId: 'abc' }, headers }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('deletes the domain row', async () => {
    mockPool = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    const res = await removeDomain(
      fakeRequest({ params: { domainId: '99' }, headers }),
      {},
    );
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls[0].inputs.id).toBe(99);
  });
});
