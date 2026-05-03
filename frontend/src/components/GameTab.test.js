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
import TileModal from './TileModal.vue';
import WinModal from './WinModal.vue';

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
  state.wonLines = [];
  state.keywords = [];
  state.playerName = '';
  state.packId = 0;
  state.gameSessionId = null;
  state.challengeProfile = null;
});

function activateBoard() {
  const { state } = useBingoGame();
  state.boardActive = true;
  state.tiles = [...TILES];
  state.cleared = new Array(9).fill(false);
  state.packId = 1;
  state.playerName = 'Ada';
  state.sessionId = 'sessionid12345';
  return state;
}

describe('GameTab', () => {
  it('renders SetupPanel when the board is inactive', () => {
    const w = mount(GameTab);
    expect(w.text()).toContain('Start Your Board');
  });

  it('renders BoardPanel when the board is active', async () => {
    activateBoard();
    const w = mount(GameTab);
    await w.vm.$nextTick();
    expect(w.text()).toContain('Pack #001');
    expect(w.text()).not.toContain('Start Your Board');
  });

  it('opens TileModal when BingoGrid emits open-tile', async () => {
    activateBoard();
    const w = mount(GameTab);
    await w.vm.$nextTick();
    await w.findAll('.tile')[0].trigger('click');
    expect(w.text()).toContain('Task 1');
    // Textarea appears only inside the modal
    expect(w.find('textarea').exists()).toBe(true);
  });

  it('closes TileModal when it emits close', async () => {
    activateBoard();
    const w = mount(GameTab);
    await w.vm.$nextTick();
    await w.findAll('.tile')[0].trigger('click');

    w.findComponent(TileModal).vm.$emit('close');
    await w.vm.$nextTick();

    expect(w.find('textarea').exists()).toBe(false);
  });

  it('shows and closes WinModal when a tile reports a won line', async () => {
    activateBoard();
    const w = mount(GameTab);
    await w.vm.$nextTick();
    await w.findAll('.tile')[0].trigger('click');

    w.findComponent(TileModal).vm.$emit('won', {
      line: { id: 'R1', label: 'Row 1', cells: [0, 1, 2] },
      kw: 'CO-APR26-001-R1-MOCK',
    });
    await w.vm.$nextTick();

    expect(w.findComponent(WinModal).exists()).toBe(true);
    expect(w.text()).toContain('BINGO! Row 1');
    await w.findComponent(WinModal).vm.$emit('close');
    await w.vm.$nextTick();
    expect(w.findComponent(WinModal).exists()).toBe(false);
  });
});
