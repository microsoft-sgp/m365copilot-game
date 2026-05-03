import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import WinModal from './WinModal.vue';
import { useToast } from '../composables/useToast.js';

const captureFrontendLog = vi.hoisted(() => vi.fn());

vi.mock('../lib/sentry.js', () => ({ captureFrontendLog }));

const data = {
  line: { id: 'R1', label: 'Row 1', cells: [0, 1, 2] },
  kw: 'CO-APR26-001-R1-ABCD1234',
};

describe('WinModal', () => {
  beforeEach(() => {
    useToast().hide();
    captureFrontendLog.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it('renders the won line label and keyword', () => {
    const w = mount(WinModal, { props: { data } });
    expect(w.text()).toContain('BINGO! Row 1');
    expect(w.text()).toContain(data.kw);
  });

  it('emits close when clicking outside the modal card', async () => {
    const w = mount(WinModal, { props: { data } });
    await w.find('.fixed.inset-0').trigger('click');
    expect(w.emitted('close')).toBeTruthy();
  });

  it('emits close when clicking "Keep Playing"', async () => {
    const w = mount(WinModal, { props: { data } });
    const btn = w.findAll('button').find((b) => b.text().includes('Keep Playing'));
    await btn.trigger('click');
    expect(w.emitted('close')).toBeTruthy();
  });

  it('copy keyword calls clipboard.writeText and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const w = mount(WinModal, { props: { data } });
    const copyBtn = w.findAll('button').find((b) => b.text().includes('Copy Keyword'));
    await copyBtn.trigger('click');
    expect(writeText).toHaveBeenCalledWith(data.kw);
    expect(useToast().toast.visible).toBe(true);
    expect(useToast().toast.sub).toBe(data.kw);
  });

  it('logs clipboard copy failures without exposing the keyword', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    const w = mount(WinModal, { props: { data } });
    const copyBtn = w.findAll('button').find((b) => b.text().includes('Copy Keyword'));
    await copyBtn.trigger('click');
    await Promise.resolve();

    expect(captureFrontendLog).toHaveBeenCalledWith(
      'win_keyword_clipboard_copy_failed',
      'warn',
      expect.objectContaining({ component: 'WinModal', action: 'copy_keyword' }),
    );
    expect(JSON.stringify(captureFrontendLog.mock.calls[0])).not.toContain(data.kw);
  });

  it('renders 40 confetti pieces', () => {
    const w = mount(WinModal, { props: { data } });
    expect(w.findAll('.confetti-piece')).toHaveLength(40);
  });
});
