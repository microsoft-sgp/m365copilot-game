import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AdminDangerZone from './AdminDangerZone.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminClearCampaignData: vi.fn(),
  apiAdminResetLeaderboard: vi.fn(),
}));

const api = await import('../lib/api.js');

let alertSpy;
let confirmSpy;

beforeEach(() => {
  vi.clearAllMocks();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
});

afterEach(() => {
  alertSpy.mockRestore();
  confirmSpy.mockRestore();
});

function clearInputs(wrapper) {
  return wrapper.findAll('input');
}

describe('AdminDangerZone clear campaign data', () => {
  it('alerts and aborts when confirmation phrase is wrong', async () => {
    const wrapper = mount(AdminDangerZone);
    const inputs = clearInputs(wrapper);
    await inputs[0].setValue('APR26');
    await inputs[1].setValue('NOPE');
    await wrapper.findAll('button').find((b) => b.text() === 'Clear All Data').trigger('click');
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('CLEAR-ALL'));
    expect(api.apiAdminClearCampaignData).not.toHaveBeenCalled();
  });

  it('aborts when window.confirm returns false', async () => {
    confirmSpy.mockReturnValueOnce(false);
    const wrapper = mount(AdminDangerZone);
    const inputs = clearInputs(wrapper);
    await inputs[0].setValue('APR26');
    await inputs[1].setValue('CLEAR-ALL');
    await wrapper.findAll('button').find((b) => b.text() === 'Clear All Data').trigger('click');
    await flushPromises();

    expect(api.apiAdminClearCampaignData).not.toHaveBeenCalled();
  });

  it('clears data and renders deletion summary on success', async () => {
    api.apiAdminClearCampaignData.mockResolvedValue({
      ok: true,
      data: { deleted: { sessions: 4, events: 12, submissions: 9 } },
    });
    const wrapper = mount(AdminDangerZone);
    const inputs = clearInputs(wrapper);
    await inputs[0].setValue('APR26');
    await inputs[1].setValue('CLEAR-ALL');
    await wrapper.findAll('button').find((b) => b.text() === 'Clear All Data').trigger('click');
    await flushPromises();

    expect(api.apiAdminClearCampaignData).toHaveBeenCalledWith('APR26');
    expect(wrapper.text()).toContain('4 sessions');
    expect(wrapper.text()).toContain('12 events');
    expect(wrapper.text()).toContain('9 submissions');
  });

  it('alerts on API failure', async () => {
    api.apiAdminClearCampaignData.mockResolvedValue({ ok: false, data: { message: 'denied' } });
    const wrapper = mount(AdminDangerZone);
    const inputs = clearInputs(wrapper);
    await inputs[0].setValue('APR26');
    await inputs[1].setValue('CLEAR-ALL');
    await wrapper.findAll('button').find((b) => b.text() === 'Clear All Data').trigger('click');
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('denied');
  });
});

describe('AdminDangerZone reset leaderboard', () => {
  it('aborts without RESET-BOARD phrase', async () => {
    const wrapper = mount(AdminDangerZone);
    const inputs = clearInputs(wrapper);
    await inputs[2].setValue('APR26');
    await inputs[3].setValue('NOPE');
    await wrapper.findAll('button').find((b) => b.text() === 'Reset Leaderboard').trigger('click');
    await flushPromises();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('RESET-BOARD'));
    expect(api.apiAdminResetLeaderboard).not.toHaveBeenCalled();
  });

  it('resets leaderboard and renders deletion count on success', async () => {
    api.apiAdminResetLeaderboard.mockResolvedValue({
      ok: true,
      data: { deleted: { submissions: 17 } },
    });
    const wrapper = mount(AdminDangerZone);
    const inputs = clearInputs(wrapper);
    await inputs[2].setValue('APR26');
    await inputs[3].setValue('RESET-BOARD');
    await wrapper.findAll('button').find((b) => b.text() === 'Reset Leaderboard').trigger('click');
    await flushPromises();
    expect(api.apiAdminResetLeaderboard).toHaveBeenCalledWith('APR26');
    expect(wrapper.text()).toContain('17 submissions');
  });
});
