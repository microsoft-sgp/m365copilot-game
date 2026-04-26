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
  });

  it('renders the setup form with Launch Board button', () => {
    const w = mount(SetupPanel);
    expect(w.text()).toContain('Start Your Board');
    expect(w.findAll('button').some((b) => b.text().includes('Launch Board'))).toBe(true);
    expect(w.findAll('button').some((b) => b.text().includes('Quick Pick'))).toBe(true);
  });

  it('renders 999 pack cells', () => {
    const w = mount(SetupPanel);
    expect(w.findAll('.pack-cell')).toHaveLength(999);
  });

  it('shows an error for pack ids outside 1..999', async () => {
    const w = mount(SetupPanel);
    await w.find('input[type="number"]').setValue('1000');
    await w.findAll('button').find((b) => b.text().includes('Launch Board')).trigger('click');
    expect(w.text()).toMatch(/pack between 1 and 999/i);
    expect(useBingoGame().state.boardActive).toBe(false);
  });

  it('calls startBoard on valid input', async () => {
    const w = mount(SetupPanel);
    await w.find('input[type="number"]').setValue('42');
    await w.findAll('button').find((b) => b.text().includes('Launch Board')).trigger('click');
    const { state } = useBingoGame();
    expect(state.boardActive).toBe(true);
    expect(state.playerName).toBe('Ada');
    expect(state.packId).toBe(42);
  });

  it('selecting a pack cell updates the lucky number input', async () => {
    const w = mount(SetupPanel);
    const cell = w.findAll('.pack-cell')[17]; // index 17 → pack 18
    await cell.trigger('click');
    expect(w.find('input[type="number"]').element.value).toBe('18');
  });

  it('Quick Pick sets a pack id between 1 and 999', async () => {
    const w = mount(SetupPanel);
    await w.findAll('button').find((b) => b.text().includes('Quick Pick')).trigger('click');
    const value = Number(w.find('input[type="number"]').element.value);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(999);
  });

  it('prefills pack from localStorage on mount', async () => {
    localStorage.setItem('copilot_bingo_last_pack', '77');
    const w = mount(SetupPanel);
    await w.vm.$nextTick();
    expect(w.find('input[type="number"]').element.value).toBe('77');
  });

  it('blocks launch if onboarding identity is missing', async () => {
    localStorage.removeItem('copilot_bingo_player_name');
    const w = mount(SetupPanel);
    await w.find('input[type="number"]').setValue('42');
    await w.findAll('button').find((b) => b.text().includes('Launch Board')).trigger('click');
    expect(w.text()).toContain('complete onboarding identity');
    expect(useBingoGame().state.boardActive).toBe(false);
  });
});
