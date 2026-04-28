import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import { useToast } from '../composables/useToast.js';
import TileModal from './TileModal.vue';

const TILES = Array.from({ length: 9 }, (_, i) => ({
  title: `Task ${i + 1}`,
  tag: 'Productivity',
  tileIndex: i,
  packId: 1,
  prompt: `Prompt for tile ${i} — PASS-MARKER`,
  // Proof must contain "PASS" to validate.
  verify: (proof) => (proof.includes('PASS') ? [] : ['invalid proof']),
}));

beforeEach(() => {
  const { state } = useBingoGame();
  state.tiles = [...TILES];
  state.cleared = new Array(9).fill(false);
  state.wonLines = [];
  state.keywords = [];
  state.packId = 1;
  state.sessionId = 'sess-123456789012';
  state.challengeProfile = null;
  state.boardActive = true;
  useToast().hide();
});

afterEach(() => vi.clearAllMocks());

describe('TileModal', () => {
  it('renders the tile title, tag, and prompt', () => {
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    expect(w.text()).toContain('Task 1');
    expect(w.text()).toContain('Productivity');
    expect(w.text()).toContain('Prompt for tile 0');
  });

  it('shows an error when the proof is empty', async () => {
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    const verifyBtn = w.findAll('button').find((b) => b.text().includes('Verify'));
    await verifyBtn.trigger('click');
    expect(w.text()).toContain('paste your Copilot output');
  });

  it('shows the errors returned by the verifier', async () => {
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    await w.find('textarea').setValue('bad proof');
    await w
      .findAll('button')
      .find((b) => b.text().includes('Verify'))
      .trigger('click');
    expect(w.text()).toContain('invalid proof');
  });

  it('on valid proof: emits close, marks cleared, and shows toast', async () => {
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    await w.find('textarea').setValue('PASS this proof');
    await w
      .findAll('button')
      .find((b) => b.text().includes('Verify'))
      .trigger('click');
    expect(w.emitted('close')).toBeTruthy();
    const { state } = useBingoGame();
    expect(state.cleared[0]).toBe(true);
    expect(useToast().toast.visible).toBe(true);
  });

  it('emits "won" when a line is completed', async () => {
    const { state } = useBingoGame();
    // Pre-clear two of three cells in R1 (0, 1)
    state.cleared[0] = true;
    state.cleared[1] = true;
    const w = mount(TileModal, { props: { tileIndex: 2 } });
    await w.find('textarea').setValue('PASS third tile');
    await w
      .findAll('button')
      .find((b) => b.text().includes('Verify'))
      .trigger('click');
    const wonEvents = w.emitted('won');
    expect(wonEvents).toBeTruthy();
    expect(wonEvents[0][0].line.id).toBe('R1');
  });

  it('clicking the close button emits close', async () => {
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    const closeBtn = w.findAll('button').find((b) => b.text() === '✕');
    await closeBtn.trigger('click');
    expect(w.emitted('close')).toBeTruthy();
  });

  it('Copy Prompt writes the prompt to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    await w
      .findAll('button')
      .find((b) => b.text().includes('Copy Prompt'))
      .trigger('click');
    expect(writeText).toHaveBeenCalled();
    // The concrete marker replaces the placeholder.
    const arg = writeText.mock.calls[0][0];
    expect(arg).toContain('Prompt for tile 0');
  });

  it('Open Copilot Chat calls window.open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const w = mount(TileModal, { props: { tileIndex: 0 } });
    await w
      .findAll('button')
      .find((b) => b.text().includes('Open Copilot'))
      .trigger('click');
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
