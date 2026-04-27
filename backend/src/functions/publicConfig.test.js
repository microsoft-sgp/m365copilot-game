import { describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));

const activeCampaign = await import('./getActiveCampaign.js');
const orgDomains = await import('./getOrgDomains.js');

describe('GET /api/campaigns/active', () => {
  it('returns active campaign config', async () => {
    mockPool = createMockPool([
      [{ id: 'APR26', display_name: 'April 2026', total_packs: 999, total_weeks: 7, copilot_url: 'https://m365.cloud.microsoft/chat' }],
    ]);
    const req = fakeRequest({});
    const res = await activeCampaign.handler(req, {});
    expect(res.jsonBody.campaignId).toBe('APR26');
    expect(res.jsonBody.totalPacks).toBe(999);
  });

  it('returns 404 when no active campaign', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({});
    const res = await activeCampaign.handler(req, {});
    expect(res.status).toBe(404);
  });
});

describe('GET /api/organizations/domains', () => {
  it('returns domain-to-org mapping', async () => {
    mockPool = createMockPool([
      [
        { domain: 'nus.edu.sg', org: 'NUS' },
        { domain: 'ntu.edu.sg', org: 'NTU' },
        { domain: 'contoso.com', org: 'Contoso' },
      ],
    ]);
    const req = fakeRequest({});
    const res = await orgDomains.handler(req, {});
    expect(res.jsonBody.domains).toEqual({
      'nus.edu.sg': 'NUS',
      'ntu.edu.sg': 'NTU',
      'contoso.com': 'Contoso',
    });
    expect(res.jsonBody.domains).not.toHaveProperty('gmail.com');
  });

  it('returns empty object when no domains', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({});
    const res = await orgDomains.handler(req, {});
    expect(res.jsonBody.domains).toEqual({});
  });
});
