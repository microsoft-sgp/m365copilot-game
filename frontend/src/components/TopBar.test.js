import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRerollAssignment: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
  isAssignmentNotActiveResponse: vi.fn(
    (res) => res.status === 409 && res.data?.code === 'ASSIGNMENT_NOT_ACTIVE',
  ),
  isPlayerRecoveryRequiredResponse: vi.fn(
    (res) => res.status === 409 && res.data?.code === 'PLAYER_RECOVERY_REQUIRED',
  ),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import TopBar from './TopBar.vue';

beforeEach(() => {
  const { state } = useBingoGame();
  state.cleared = new Array(9).fill(false);
  state.wonLines = [];
  state.keywords = [];
});

describe('TopBar', () => {
  it('renders the game title and counters at zero by default', () => {
    const w = mount(TopBar);
    expect(w.text()).toContain('Copilot Bingo');
    // Compact emoji+number format
    expect(w.text()).toContain('🔥');
    expect(w.text()).toContain('⭐');
    expect(w.text()).toContain('🔑');
    expect(w.text()).toContain('0');
  });

  it('does not contain branding text', () => {
    const w = mount(TopBar);
    expect(w.text()).not.toContain('Powered by');
    expect(w.text()).not.toContain('Student Ambassador');
  });

  it('reflects state changes reactively', async () => {
    const { state } = useBingoGame();
    const w = mount(TopBar);
    state.cleared = [true, true, false, false, false, false, false, false, false];
    state.wonLines = ['R1'];
    state.keywords = [{ code: 'a' }];
    await w.vm.$nextTick();
    expect(w.text()).toContain('2');
    expect(w.text()).toContain('1');
  });
});
