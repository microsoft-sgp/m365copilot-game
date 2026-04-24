import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
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
  it('renders the brand and counters at zero by default', () => {
    const w = mount(TopBar);
    expect(w.text()).toContain('Copilot Chat Bingo');
    expect(w.text()).toMatch(/Tiles:\s*0\/9/);
    expect(w.text()).toMatch(/Lines:\s*0\/8/);
    expect(w.text()).toMatch(/Keys:\s*0/);
  });

  it('reflects state changes reactively', async () => {
    const { state } = useBingoGame();
    const w = mount(TopBar);
    state.cleared = [true, true, false, false, false, false, false, false, false];
    state.wonLines = ['R1'];
    state.keywords = [{ code: 'a' }];
    await w.vm.$nextTick();
    expect(w.text()).toMatch(/Tiles:\s*2\/9/);
    expect(w.text()).toMatch(/Lines:\s*1\/8/);
    expect(w.text()).toMatch(/Keys:\s*1/);
  });
});
