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
import GameTab from './GameTab.vue';

const TILES = Array.from({ length: 9 }, (_, i) => ({
  title: `T${i}`,
  tag: 't',
  tileIndex: i,
  packId: 1,
  prompt: 'p',
  verify: () => [],
}));

beforeEach(() => {
  const { state } = useBingoGame();
  state.boardActive = false;
  state.tiles = [];
  state.cleared = [];
  state.playerName = '';
  state.packId = 0;
  state.challengeProfile = null;
});

describe('GameTab', () => {
  it('renders SetupPanel when the board is inactive', () => {
    const w = mount(GameTab);
    expect(w.text()).toContain('Start Your Board');
  });

  it('renders BoardPanel when the board is active', async () => {
    const { state } = useBingoGame();
    state.boardActive = true;
    state.tiles = [...TILES];
    state.cleared = new Array(9).fill(false);
    state.packId = 1;
    state.playerName = 'Ada';
    state.sessionId = 'sessionid12345';
    const w = mount(GameTab);
    await w.vm.$nextTick();
    expect(w.text()).toContain('Pack #001');
    expect(w.text()).not.toContain('Start Your Board');
  });

  it('opens TileModal when BingoGrid emits open-tile', async () => {
    const { state } = useBingoGame();
    state.boardActive = true;
    state.tiles = [...TILES];
    state.cleared = new Array(9).fill(false);
    state.packId = 1;
    state.playerName = 'Ada';
    state.sessionId = 'sessionid12345';
    const w = mount(GameTab);
    await w.vm.$nextTick();
    await w.findAll('.tile')[0].trigger('click');
    expect(w.text()).toContain('Task 1');
    // Textarea appears only inside the modal
    expect(w.find('textarea').exists()).toBe(true);
  });
});
