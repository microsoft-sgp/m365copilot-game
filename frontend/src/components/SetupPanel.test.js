import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import SetupPanel from './SetupPanel.vue';

beforeEach(() => {
  localStorage.clear();
  const { state } = useBingoGame();
  state.boardActive = false;
  state.tiles = [];
  state.cleared = [];
  state.playerName = '';
  state.packId = 0;
  state.challengeProfile = null;
});

afterEach(() => vi.clearAllMocks());

describe('SetupPanel', () => {
  beforeEach(() => {
    localStorage.setItem('copilot_bingo_player_name', 'Ada');
    const { state } = useBingoGame();
    state.assignedPackId = 42;
    state.assignmentCycle = 2;
    state.assignmentRotated = false;
    state.completedPackId = null;
  });

  it('renders assigned-pack setup with Launch Board button', () => {
    const w = mount(SetupPanel);
    expect(w.text()).toContain('Start Your Board');
    expect(w.text()).toContain('#042');
    expect(w.findAll('button').some((b) => b.text().includes('Launch Board'))).toBe(true);
    expect(w.text()).not.toContain('Quick Pick');
    expect(w.find('input[type="number"]').exists()).toBe(false);
  });

  it('calls startBoard on valid input', async () => {
    const w = mount(SetupPanel);
    await w.findAll('button').find((b) => b.text().includes('Launch Board')).trigger('click');
    await Promise.resolve();
    const { state } = useBingoGame();
    expect(state.boardActive).toBe(true);
    expect(state.playerName).toBe('Ada');
    expect(state.packId).toBe(42);
  });

  it('shows assignment rotation copy when server marks rotated assignment', () => {
    const { state } = useBingoGame();
    state.assignmentRotated = true;
    state.completedPackId = 12;
    const w = mount(SetupPanel);
    expect(w.text()).toContain('Pack #012');
    expect(w.text()).toContain('new pack has been assigned');
  });

  it('uses last pack from localStorage when assigned pack is not yet hydrated', () => {
    const { state } = useBingoGame();
    state.assignedPackId = 0;
    localStorage.setItem('copilot_bingo_last_pack', '77');
    const w = mount(SetupPanel);
    expect(w.text()).toContain('#077');
  });

  it('blocks launch if onboarding identity is missing', async () => {
    localStorage.removeItem('copilot_bingo_player_name');
    const w = mount(SetupPanel);
    await w.findAll('button').find((b) => b.text().includes('Launch Board')).trigger('click');
    expect(w.text()).toContain('complete onboarding identity');
    expect(useBingoGame().state.boardActive).toBe(false);
  });
});
