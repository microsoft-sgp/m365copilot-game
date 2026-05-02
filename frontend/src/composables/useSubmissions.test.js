import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  apiSubmitKeyword: vi.fn(),
  apiGetLeaderboard: vi.fn(),
}));

import { apiGetLeaderboard, apiSubmitKeyword } from '../lib/api.js';
import { useSubmissions } from './useSubmissions.js';

// The module-scoped `submissions` and `serverLeaderboard` refs are shared
// across every useSubmissions() call. Reset both between tests so there's no
// cross-test contamination without needing vi.resetModules() (which would
// drop the hoisted vi.mock).
async function freshState() {
  localStorage.clear();
  const api = useSubmissions();
  api.submissions.value = [];
  apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: [] } });
  await api.refreshLeaderboard();
}

beforeEach(async () => {
  vi.clearAllMocks();
  apiSubmitKeyword.mockReset();
  apiGetLeaderboard.mockReset();
  await freshState();
});

afterEach(() => {
  vi.clearAllMocks();
});

const goodInput = {
  org: 'SMU',
  name: 'Ada',
  email: 'ada@smu.edu.sg',
  kw: 'CO-APR26-042-R1-ABCD1234',
};

describe('useSubmissions.submit validation', () => {
  it('rejects when any field is missing', async () => {
    const { submit } = useSubmissions();
    const res = await submit({ ...goodInput, org: '' });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/required/);
    expect(apiSubmitKeyword).not.toHaveBeenCalled();
  });

  it('rejects when email lacks @', async () => {
    const { submit } = useSubmissions();
    const res = await submit({ ...goodInput, email: 'bad' });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/email/i);
  });

  it('rejects malformed keyword', async () => {
    const { submit } = useSubmissions();
    const res = await submit({ ...goodInput, kw: 'NOPE' });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/keyword format/i);
  });

  it('normalizes casing before calling the API', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: true,
      data: { ok: true, orgDupe: false },
    });
    apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: [] } });
    const { submit } = useSubmissions();
    await submit({
      org: 'SMU',
      name: 'Ada',
      email: 'ADA@SMU.EDU.SG',
      kw: 'co-apr26-042-r1-abcd1234',
    });
    expect(apiSubmitKeyword).toHaveBeenCalledWith({
      org: 'SMU',
      name: 'Ada',
      email: 'ada@smu.edu.sg',
      keyword: 'CO-APR26-042-R1-ABCD1234',
    });
  });
});

describe('useSubmissions.submit server paths', () => {
  it('reports success on a 200 response and caches locally', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: true,
      data: { ok: true, orgDupe: false },
    });
    apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: [] } });
    const { submit, submissions } = useSubmissions();
    const res = await submit(goodInput);
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/Leaderboard updated/);
    expect(submissions.value).toHaveLength(1);
    expect(submissions.value[0]).toMatchObject({
      org: 'SMU',
      name: 'Ada',
      email: 'ada@smu.edu.sg',
      kw: 'CO-APR26-042-R1-ABCD1234',
    });
    expect(apiGetLeaderboard).toHaveBeenCalled();
  });

  it('reports orgDupe=true with the teammate message', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: true,
      data: { ok: true, orgDupe: true },
    });
    apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: [] } });
    const { submit } = useSubmissions();
    const res = await submit(goodInput);
    expect(res.orgDupe).toBe(true);
    expect(res.message).toMatch(/already counted/);
  });

  it('surfaces 409 duplicate errors', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: false,
      status: 409,
      data: { ok: false, message: 'dup!' },
    });
    const { submit } = useSubmissions();
    const res = await submit(goodInput);
    expect(res.ok).toBe(false);
    expect(res.message).toBe('❌ dup!');
  });

  it('surfaces 400 validation errors', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: false,
      status: 400,
      data: { ok: false, message: 'bad input' },
    });
    const { submit } = useSubmissions();
    const res = await submit(goodInput);
    expect(res.ok).toBe(false);
    expect(res.message).toBe('❌ bad input');
  });
});

describe('useSubmissions.submit offline fallback', () => {
  it('saves locally when the server is unreachable', async () => {
    apiSubmitKeyword.mockResolvedValue({ ok: false, status: 0, data: null });
    const { submit, submissions } = useSubmissions();
    const res = await submit(goodInput);
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/saved locally/);
    expect(submissions.value).toHaveLength(1);
  });

  it('detects local self-duplicates when offline', async () => {
    apiSubmitKeyword.mockResolvedValue({ ok: false, status: 0, data: null });
    const { submit } = useSubmissions();
    await submit(goodInput);
    const res2 = await submit(goodInput);
    expect(res2.ok).toBe(false);
    expect(res2.message).toMatch(/already submitted/);
  });

  it('flags offline orgDupe when a teammate already submitted the same keyword', async () => {
    apiSubmitKeyword.mockResolvedValue({ ok: false, status: 0, data: null });
    const { submit } = useSubmissions();
    await submit({ ...goodInput, email: 'teammate@smu.edu.sg' });
    const res = await submit(goodInput);
    expect(res.ok).toBe(true);
    expect(res.orgDupe).toBe(true);
    expect(res.message).toMatch(/already counted/);
  });
});

describe('useSubmissions.detectOrg', () => {
  it('returns the mapped org for a known domain (e.g. smu.edu.sg → SMU)', () => {
    const { detectOrg } = useSubmissions();
    const { domain, org } = detectOrg('ada@smu.edu.sg');
    expect(domain).toBe('smu.edu.sg');
    expect(org).toBe('SMU');
  });

  it('returns null org for an unknown domain', () => {
    const { detectOrg } = useSubmissions();
    const { org } = detectOrg('ada@unknowncompany.xyz');
    expect(org).toBeNull();
  });

  it('lowercases and trims the domain', () => {
    const { detectOrg } = useSubmissions();
    const { domain } = detectOrg('ada@SMU.EDU.SG  ');
    expect(domain).toBe('smu.edu.sg');
  });

  it('handles emails with no @ by returning empty domain', () => {
    const { detectOrg } = useSubmissions();
    const { domain, org } = detectOrg('no-at-sign');
    expect(domain).toBe('');
    expect(org).toBeNull();
  });
});

describe('useSubmissions.leaderboard', () => {
  it('prefers the server leaderboard when present', async () => {
    apiGetLeaderboard.mockResolvedValue({
      ok: true,
      data: {
        leaderboard: [{ org: 'SMU', score: 3, contributors: 2, lastSubmission: 't' }],
      },
    });
    const { leaderboard, refreshLeaderboard } = useSubmissions();
    await refreshLeaderboard();
    expect(leaderboard.value).toEqual([{ org: 'SMU', score: 3, contributorCount: 2, lastTs: 't' }]);
  });

  it('computes a local leaderboard when the server is empty', async () => {
    apiSubmitKeyword.mockResolvedValue({ ok: false, status: 0, data: null });
    const { submit, leaderboard } = useSubmissions();
    await submit({ ...goodInput, kw: 'CO-APR26-042-R1-ABCD1234' });
    await submit({
      ...goodInput,
      email: 'grace@smu.edu.sg',
      kw: 'CO-APR26-042-R2-ABCD5678',
    });
    expect(leaderboard.value).toEqual([
      {
        org: 'SMU',
        score: 2,
        contributorCount: 2,
        lastTs: expect.any(Number),
      },
    ]);
  });

  it('dedupes (org, keyword) pairs — documents that only the first contributor is counted locally', async () => {
    // Current behavior: the local fallback dedupes by (org, kw) and skips any
    // subsequent row entirely, so a second contributor with the same keyword
    // does not bump the contributor count. Server-side aggregation counts
    // distinct emails correctly; this test pins the local-fallback quirk.
    apiSubmitKeyword.mockResolvedValue({ ok: false, status: 0, data: null });
    const { submit, leaderboard } = useSubmissions();
    const kw = 'CO-APR26-042-R1-ABCD1234';
    await submit({ ...goodInput, email: 'ada@smu.edu.sg', kw });
    await submit({ ...goodInput, email: 'grace@smu.edu.sg', kw });
    expect(leaderboard.value[0].score).toBe(1);
    expect(leaderboard.value[0].contributorCount).toBe(1);
  });

  it('sorts orgs by score desc then by name asc', async () => {
    apiSubmitKeyword.mockResolvedValue({ ok: false, status: 0, data: null });
    const { submit, leaderboard } = useSubmissions();
    await submit({ org: 'NUS', name: 'N', email: 'n@nus.edu.sg', kw: 'CO-APR26-042-R1-ABCD1234' });
    await submit({ org: 'SMU', name: 'S', email: 's@smu.edu.sg', kw: 'CO-APR26-042-R1-ABCD1234' });
    await submit({ org: 'SMU', name: 'S', email: 's@smu.edu.sg', kw: 'CO-APR26-042-R2-EFGH5678' });
    expect(leaderboard.value.map((r) => r.org)).toEqual(['SMU', 'NUS']);
  });
});
