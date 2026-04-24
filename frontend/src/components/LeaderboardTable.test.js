import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiSubmitKeyword: vi.fn(),
  apiGetLeaderboard: vi.fn(),
}));

import { apiGetLeaderboard } from '../lib/api.js';
import { useSubmissions } from '../composables/useSubmissions.js';
import LeaderboardTable from './LeaderboardTable.vue';

async function seedServerLeaderboard(rows) {
  apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: rows } });
  const { refreshLeaderboard } = useSubmissions();
  await refreshLeaderboard();
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset to empty server leaderboard and empty local submissions
  apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: [] } });
  const api = useSubmissions();
  api.submissions.value = [];
  await api.refreshLeaderboard();
});

afterEach(() => vi.clearAllMocks());

describe('LeaderboardTable', () => {
  it('shows empty-state message when leaderboard is empty', () => {
    const w = mount(LeaderboardTable);
    expect(w.text()).toContain('No submissions yet');
    expect(w.find('table').exists()).toBe(false);
  });

  it('renders one row per org with rank badges 1, 2, 3', async () => {
    await seedServerLeaderboard([
      { org: 'SMU', score: 5, contributors: 3, lastSubmission: 1_700_000_000_000 },
      { org: 'NUS', score: 3, contributors: 2, lastSubmission: 1_700_000_100_000 },
      { org: 'NTU', score: 1, contributors: 1, lastSubmission: 1_700_000_200_000 },
    ]);
    const w = mount(LeaderboardTable);
    await w.vm.$nextTick();
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain('SMU');
    expect(rows[1].text()).toContain('NUS');
    expect(rows[2].text()).toContain('NTU');
    const badges = w.findAll('.rank-badge');
    expect(badges[0].classes()).toContain('rank-1');
    expect(badges[1].classes()).toContain('rank-2');
    expect(badges[2].classes()).toContain('rank-3');
  });

  it('renders contributor count for each row', async () => {
    await seedServerLeaderboard([
      { org: 'SMU', score: 7, contributors: 4, lastSubmission: 1_700_000_000_000 },
    ]);
    const w = mount(LeaderboardTable);
    await w.vm.$nextTick();
    expect(w.text()).toContain('4');
  });

  it('highlights the player org row when playerOrg prop is passed', async () => {
    await seedServerLeaderboard([
      { org: 'NUS', score: 5, contributors: 3, lastSubmission: 1_700_000_000_000 },
      { org: 'SMU', score: 3, contributors: 2, lastSubmission: 1_700_000_100_000 },
    ]);
    const w = mount(LeaderboardTable, { props: { playerOrg: 'NUS' } });
    await w.vm.$nextTick();
    const rows = w.findAll('tbody tr');
    expect(rows[0].classes()).toContain('bg-primary/10');
    expect(rows[0].text()).toContain('★ You');
    expect(rows[1].classes()).not.toContain('bg-primary/10');
  });

  it('hides Last Submission column on compact via CSS class', async () => {
    await seedServerLeaderboard([
      { org: 'NUS', score: 5, contributors: 3, lastSubmission: 1_700_000_000_000 },
    ]);
    const w = mount(LeaderboardTable);
    await w.vm.$nextTick();
    // The Last Submission th should have 'hidden' and 'sm:table-cell' classes
    const headers = w.findAll('th');
    const lastHeader = headers[headers.length - 1];
    expect(lastHeader.classes()).toContain('hidden');
    expect(lastHeader.classes()).toContain('sm:table-cell');
  });
});
