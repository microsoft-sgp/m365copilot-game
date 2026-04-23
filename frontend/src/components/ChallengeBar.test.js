import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import ChallengeBar from './ChallengeBar.vue';

beforeEach(() => {
  const { state } = useBingoGame();
  state.challengeProfile = null;
});

describe('ChallengeBar', () => {
  it('renders nothing when there is no challenge profile', () => {
    const w = mount(ChallengeBar);
    expect(w.html()).toBe('<!--v-if-->');
  });

  it('renders 7 week dots with the current week highlighted', async () => {
    const { state } = useBingoGame();
    state.challengeProfile = {
      challengeStartAt: Date.now(),
      currentWeek: 3,
      weeksCompleted: 2,
      weeklySubmissions: [1, 2],
    };
    const w = mount(ChallengeBar);
    await w.vm.$nextTick();
    const dots = w.findAll('.wdot');
    expect(dots).toHaveLength(7);
    // W1, W2 → done; W3 → current
    expect(dots[0].classes('done')).toBe(true);
    expect(dots[1].classes('done')).toBe(true);
    expect(dots[2].classes('current')).toBe(true);
    expect(dots[2].classes('done')).toBe(false);
    expect(dots[6].classes('done')).toBe(false);
    expect(w.text()).toContain('Completed: 2/7');
    expect(w.text()).toContain('5 weeks left');
  });

  it('uses singular "week" when only 1 remains', async () => {
    const { state } = useBingoGame();
    state.challengeProfile = {
      challengeStartAt: Date.now(),
      currentWeek: 7,
      weeksCompleted: 6,
      weeklySubmissions: [1, 2, 3, 4, 5, 6],
    };
    const w = mount(ChallengeBar);
    await w.vm.$nextTick();
    expect(w.text()).toContain('1 week left');
    expect(w.text()).not.toContain('1 weeks left');
  });
});
