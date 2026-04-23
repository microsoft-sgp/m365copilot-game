import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import KeywordsPanel from './KeywordsPanel.vue';

beforeEach(() => {
  const { state } = useBingoGame();
  state.keywords = [];
});

describe('KeywordsPanel', () => {
  it('shows an empty-state message when there are no keywords', () => {
    const w = mount(KeywordsPanel);
    expect(w.text()).toContain('No keywords yet');
  });

  it('renders one row per keyword with pack-id padded to 3 digits and lineId', async () => {
    const { state } = useBingoGame();
    state.keywords = [
      { code: 'CO-APR26-001-R1-AAAA1111', packId: 1, lineId: 'R1', ts: 1_700_000_000_000 },
      { code: 'CO-APR26-042-W1-BBBB2222', packId: 42, lineId: 'W1', ts: 1_700_000_100_000 },
    ];
    const w = mount(KeywordsPanel);
    await w.vm.$nextTick();
    expect(w.text()).toContain('CO-APR26-001-R1-AAAA1111');
    expect(w.text()).toContain('CO-APR26-042-W1-BBBB2222');
    expect(w.text()).toContain('Pack 001');
    expect(w.text()).toContain('Pack 042');
    expect(w.text()).toContain('R1');
    expect(w.text()).toContain('W1');
  });

  it('copy button writes the keyword to the clipboard', async () => {
    const { state } = useBingoGame();
    state.keywords = [
      { code: 'CO-APR26-001-R1-AAAA1111', packId: 1, lineId: 'R1', ts: Date.now() },
    ];
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const w = mount(KeywordsPanel);
    await w.vm.$nextTick();
    await w.find('.btn-ghost').trigger('click');
    expect(writeText).toHaveBeenCalledWith('CO-APR26-001-R1-AAAA1111');
  });
});
