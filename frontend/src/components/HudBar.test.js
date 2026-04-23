import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import HudBar from './HudBar.vue';

beforeEach(() => {
  const { state } = useBingoGame();
  state.cleared = new Array(9).fill(false);
  state.wonLines = [];
  state.keywords = [];
});

describe('HudBar', () => {
  it('renders the four HUD sections with default zero values', () => {
    const w = mount(HudBar);
    expect(w.text()).toContain('Tiles Cleared');
    expect(w.text()).toContain('Lines Won');
    expect(w.text()).toContain('Keywords');
    expect(w.text()).toContain('Board Progress');
    expect(w.text()).toContain('0%');
  });

  it('renders a progress bar whose width matches boardProgress', async () => {
    const { state } = useBingoGame();
    state.cleared = [true, true, true, true, true, false, false, false, false];
    const w = mount(HudBar);
    await w.vm.$nextTick();
    const fill = w.find('.progress-fill');
    // 5/9 ≈ 56%
    expect(fill.attributes('style')).toContain('width: 56%');
    expect(w.text()).toContain('56%');
  });
});
