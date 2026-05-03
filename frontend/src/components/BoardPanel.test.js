import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

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
import { apiRerollAssignment } from '../lib/api.js';
import BoardPanel from './BoardPanel.vue';

const TILES = Array.from({ length: 9 }, (_, i) => ({
  title: `Task ${i + 1}`,
  tag: 'Tag',
  tileIndex: i,
  packId: 42,
  verify: () => [],
}));

beforeEach(() => {
  vi.clearAllMocks();
  const { state } = useBingoGame();
  state.tiles = [...TILES];
  state.cleared = new Array(9).fill(false);
  state.wonLines = [];
  state.keywords = [];
  state.packId = 42;
  state.assignedPackId = 42;
  state.assignmentId = 21;
  state.gameSessionId = 111;
  state.playerName = 'Ada';
  state.email = 'ada@example.com';
  state.organization = '';
  state.sessionId = 'abcdef123456';
  state.challengeProfile = {
    challengeStartAt: 0,
    currentWeek: 2,
    weeksCompleted: 1,
    weeklySubmissions: [1],
  };
  state.recoveryRequired = false;
  apiRerollAssignment.mockResolvedValue({ ok: false, data: null });
});

describe('BoardPanel', () => {
  it('renders the padded pack id and session preview', () => {
    const w = mount(BoardPanel);
    expect(w.text()).toContain('Pack #042');
    expect(w.text()).toContain('Ada');
    expect(w.text()).toContain('abcdef12');
  });

  it('forwards BingoGrid open-tile events through its own open-tile emit', async () => {
    const w = mount(BoardPanel);
    await w.findAll('.tile')[4].trigger('click');
    expect(w.emitted('open-tile')).toEqual([[4]]);
  });

  it('New Board button asks for confirmation and rerolls when confirmed', async () => {
    const { state } = useBingoGame();
    state.boardActive = true;
    state.cleared[0] = true;
    state.wonLines = ['R1'];
    apiRerollAssignment.mockResolvedValue({
      ok: true,
      data: {
        gameSessionId: 222,
        packId: 77,
        activeAssignment: { assignmentId: 22, packId: 77, cycleNumber: 2 },
      },
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const w = mount(BoardPanel);
    const btn = w.findAll('button').find((b) => b.text().includes('New Board'));
    await btn.trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalledWith(
      'Start a new board? Your current board progress will be cleared and a new pack will be assigned.',
    );
    expect(apiRerollAssignment).toHaveBeenCalledWith({
      sessionId: 'abcdef123456',
      playerName: 'Ada',
      email: 'ada@example.com',
      gameSessionId: 111,
    });
    expect(state.boardActive).toBe(true);
    expect(state.packId).toBe(77);
    expect(state.gameSessionId).toBe(222);
    expect(state.cleared).toEqual(new Array(9).fill(false));
    expect(state.wonLines).toEqual([]);
    confirmSpy.mockRestore();
  });

  it('does not reset if the confirmation is declined', async () => {
    const { state } = useBingoGame();
    state.boardActive = true;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const w = mount(BoardPanel);
    const btn = w.findAll('button').find((b) => b.text().includes('New Board'));
    await btn.trigger('click');
    expect(state.boardActive).toBe(true);
    expect(apiRerollAssignment).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('keeps the current board and shows an error when reroll fails', async () => {
    const { state } = useBingoGame();
    state.boardActive = true;
    apiRerollAssignment.mockResolvedValue({ ok: false, status: 500, data: { ok: false } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const w = mount(BoardPanel);
    const btn = w.findAll('button').find((b) => b.text().includes('New Board'));
    await btn.trigger('click');
    await flushPromises();

    expect(state.boardActive).toBe(true);
    expect(state.packId).toBe(42);
    expect(w.text()).toContain('Unable to assign a new pack');
    confirmSpy.mockRestore();
  });
});
