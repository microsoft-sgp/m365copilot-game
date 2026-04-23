import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiSubmitKeyword: vi.fn(),
  apiGetLeaderboard: vi.fn(),
}));

import { apiGetLeaderboard, apiSubmitKeyword } from '../lib/api.js';
import { useSubmissions } from '../composables/useSubmissions.js';
import SubmitPanel from './SubmitPanel.vue';

beforeEach(async () => {
  vi.clearAllMocks();
  apiGetLeaderboard.mockResolvedValue({ ok: true, data: { leaderboard: [] } });
  apiSubmitKeyword.mockReset();
  const api = useSubmissions();
  api.submissions.value = [];
  await api.refreshLeaderboard();
});

afterEach(() => vi.clearAllMocks());

describe('SubmitPanel', () => {
  it('renders the submit form and leaderboard', () => {
    const w = mount(SubmitPanel);
    expect(w.text()).toContain('Submit a Keyword');
    expect(w.text()).toContain('Organization Leaderboard');
    expect(w.findAll('input').length).toBeGreaterThanOrEqual(4);
  });

  it('auto-detects org for a known domain on email input and makes org read-only', async () => {
    const w = mount(SubmitPanel);
    const inputs = w.findAll('input');
    const emailInput = inputs.find((i) => i.attributes('type') === 'email');
    await emailInput.setValue('ada@smu.edu.sg');
    await emailInput.trigger('input');
    expect(w.text()).toContain('Detected org: SMU');
    const orgInput = inputs.find(
      (i) => i.attributes('placeholder')?.includes('NUS'),
    );
    expect(orgInput.attributes('readonly')).toBeDefined();
  });

  it('tells the user to type their org when the domain is unknown', async () => {
    const w = mount(SubmitPanel);
    const emailInput = w.findAll('input').find((i) => i.attributes('type') === 'email');
    await emailInput.setValue('ada@unknownco.xyz');
    await emailInput.trigger('input');
    expect(w.text()).toContain('Domain not recognised');
  });

  it('uppercases keyword on input', async () => {
    const w = mount(SubmitPanel);
    const kwInput = w.findAll('input').find((i) =>
      i.attributes('placeholder')?.includes('CO-APR26'),
    );
    await kwInput.setValue('co-apr26-042-r1-abcd1234');
    await kwInput.trigger('input');
    expect(kwInput.element.value).toBe('CO-APR26-042-R1-ABCD1234');
  });

  it('submits successfully and calls apiSubmitKeyword', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: true,
      data: { ok: true, orgDupe: false },
    });
    const w = mount(SubmitPanel);
    const inputs = w.findAll('input');
    await inputs.find((i) => i.attributes('placeholder')?.includes('NUS')).setValue('SMU');
    await inputs.find((i) => i.attributes('placeholder') === 'Your first name').setValue('Ada');
    await inputs.find((i) => i.attributes('type') === 'email').setValue('ada@smu.edu.sg');
    const kwInput = inputs.find((i) => i.attributes('placeholder')?.includes('CO-APR26'));
    await kwInput.setValue('CO-APR26-042-R1-ABCD1234');
    await kwInput.trigger('input');
    await w.findAll('button').find((b) => b.text() === 'Submit Keyword').trigger('click');
    // Allow the async submit to resolve
    await new Promise((r) => setTimeout(r, 0));
    await w.vm.$nextTick();
    expect(apiSubmitKeyword).toHaveBeenCalled();
    expect(w.text()).toContain('Leaderboard updated');
  });

  it('shows the failure message when the server rejects the submission', async () => {
    apiSubmitKeyword.mockResolvedValue({
      ok: false,
      status: 409,
      data: { ok: false, message: 'You have already submitted this keyword.' },
    });
    const w = mount(SubmitPanel);
    const inputs = w.findAll('input');
    await inputs.find((i) => i.attributes('placeholder')?.includes('NUS')).setValue('SMU');
    await inputs.find((i) => i.attributes('placeholder') === 'Your first name').setValue('Ada');
    await inputs.find((i) => i.attributes('type') === 'email').setValue('ada@smu.edu.sg');
    const kwInput = inputs.find((i) => i.attributes('placeholder')?.includes('CO-APR26'));
    await kwInput.setValue('CO-APR26-042-R1-ABCD1234');
    await kwInput.trigger('input');
    await w.findAll('button').find((b) => b.text() === 'Submit Keyword').trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    await w.vm.$nextTick();
    expect(w.text()).toContain('already submitted');
  });

  it('admin clear requires typing RESET-BINGO', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const w = mount(SubmitPanel);
    const adminInput = w.findAll('input').find((i) =>
      i.attributes('placeholder') === 'RESET-BINGO',
    );
    await adminInput.setValue('wrong-phrase');
    await w.findAll('button').find((b) => b.text().includes('Clear All Data')).trigger('click');
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
