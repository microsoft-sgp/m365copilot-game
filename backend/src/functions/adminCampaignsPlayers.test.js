import { describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({ getPool: () => mockPool.pool }));
vi.mock('../lib/adminAuth.js', () => ({
  verifyAdmin: () => ({ ok: true, email: 'admin@test.com' }),
}));

// Tests for admin campaign and player endpoints
describe('admin campaign endpoints', () => {
  it('module loads without error', async () => {
    const mod = await import('./adminCampaigns.js');
    expect(mod).toBeDefined();
  });
});

describe('admin player endpoints', () => {
  it('module loads without error', async () => {
    const mod = await import('./adminPlayers.js');
    expect(mod).toBeDefined();
  });
});
