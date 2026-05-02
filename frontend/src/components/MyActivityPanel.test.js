import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, reactive } from 'vue';
import MyActivityPanel from './MyActivityPanel.vue';

const fakeGameState = reactive({ keywords: [] });
const refreshLeaderboard = vi.fn();
const startPolling = vi.fn();
const stopPolling = vi.fn();

vi.mock('../composables/useBingoGame.js', () => ({
  useBingoGame: () => ({
    state: fakeGameState,
    keywordCount: computed(() => fakeGameState.keywords.length),
  }),
}));

vi.mock('../composables/useSubmissions.js', () => ({
  useSubmissions: () => ({
    refreshLeaderboard,
    startPolling,
    stopPolling,
  }),
}));

vi.mock('./LeaderboardTable.vue', () => ({
  default: { name: 'LeaderboardTable', template: '<div data-test="leaderboard-stub" />' },
}));

beforeEach(() => {
  refreshLeaderboard.mockReset().mockResolvedValue();
  startPolling.mockReset();
  stopPolling.mockReset();
  fakeGameState.keywords = [];
});

afterEach(() => {});

describe('MyActivityPanel', () => {
  it('renders the empty state when there are no keywords', async () => {
    const wrapper = mount(MyActivityPanel);
    await flushPromises();
    expect(wrapper.text()).toMatch(/No activity yet/i);
    expect(refreshLeaderboard).toHaveBeenCalledTimes(1);
    expect(startPolling).toHaveBeenCalledTimes(1);
  });

  it('renders keyword rows sorted by ts descending', async () => {
    fakeGameState.keywords = [
      { code: 'OLD', packId: 1, lineId: 'R1', ts: 100 },
      { code: 'NEW', packId: 2, lineId: 'C1', ts: 999 },
    ];
    const wrapper = mount(MyActivityPanel);
    await flushPromises();
    const rows = wrapper.findAll('.font-mono');
    expect(rows[0].text()).toBe('NEW');
    expect(rows[1].text()).toBe('OLD');
    expect(wrapper.text()).toContain('Pack 002');
  });

  it('stops polling when unmounted', async () => {
    const wrapper = mount(MyActivityPanel);
    await flushPromises();
    wrapper.unmount();
    expect(stopPolling).toHaveBeenCalledTimes(1);
  });
});
