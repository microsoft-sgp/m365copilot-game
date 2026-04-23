import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import BoardPanel from './BoardPanel.vue';

const TILES = Array.from({ length: 9 }, (_, i) => ({
  title: `Task ${i + 1}`,
  tag: 'Tag',
  tileIndex: i,
  packId: 42,
  verify: () => [],
}));

beforeEach(() => {
  const { state } = useBingoGame();
  state.tiles = [...TILES];
  state.cleared = new Array(9).fill(false);
  state.packId = 42;
  state.playerName = 'Ada';
  state.sessionId = 'abcdef123456';
  state.challengeProfile = null;
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

  it('New Board button asks for confirmation and resets when confirmed', async () => {
    const { state } = useBingoGame();
    state.boardActive = true;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const w = mount(BoardPanel);
    const btn = w.findAll('button').find((b) => b.text().includes('New Board'));
    await btn.trigger('click');
    expect(confirmSpy).toHaveBeenCalled();
    expect(state.boardActive).toBe(false);
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
    confirmSpy.mockRestore();
  });
});
