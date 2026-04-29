import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AdminCampaigns from './AdminCampaigns.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminGetCampaigns: vi.fn(),
  apiAdminCreateCampaign: vi.fn(),
  apiAdminUpdateCampaign: vi.fn(),
}));

const api = await import('../lib/api.js');

const campaignFixture = {
  id: 'APR26',
  displayName: 'April 2026',
  totalPacks: 12,
  totalWeeks: 7,
  copilotUrl: 'https://m365.cloud.microsoft/chat',
  isActive: true,
  stats: { totalPlayers: 4, totalSessions: 5, totalSubmissions: 6 },
};

let alertSpy;

beforeEach(() => {
  vi.clearAllMocks();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  api.apiAdminGetCampaigns.mockResolvedValue({ ok: true, data: { campaigns: [campaignFixture] } });
  api.apiAdminCreateCampaign.mockResolvedValue({ ok: true, data: { ok: true } });
  api.apiAdminUpdateCampaign.mockResolvedValue({ ok: true, data: { ok: true } });
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('AdminCampaigns', () => {
  it('loads and renders campaigns with stats and active state', async () => {
    const wrapper = mount(AdminCampaigns);
    expect(wrapper.text()).toContain('Loading');
    await flushPromises();

    expect(api.apiAdminGetCampaigns).toHaveBeenCalled();
    expect(wrapper.text()).toContain('APR26');
    expect(wrapper.text()).toContain('April 2026');
    expect(wrapper.text()).toContain('ACTIVE');
    expect(wrapper.text()).toContain('4 players');
  });

  it('creates a campaign and reloads the list', async () => {
    const wrapper = mount(AdminCampaigns);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('New Campaign'))
      .trigger('click');
    await wrapper.find('input[placeholder="e.g. JUL26"]').setValue('JUL26');
    await wrapper.find('input[placeholder="e.g. July 2026"]').setValue('July 2026');
    const numberInputs = wrapper.findAll('input[type="number"]');
    await numberInputs[0].setValue(24);
    await numberInputs[1].setValue(8);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Create')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminCreateCampaign).toHaveBeenCalledWith({
      id: 'JUL26',
      displayName: 'July 2026',
      totalPacks: 24,
      totalWeeks: 8,
      copilotUrl: 'https://m365.cloud.microsoft/chat',
    });
    expect(api.apiAdminGetCampaigns).toHaveBeenCalledTimes(2);
  });

  it('alerts when campaign creation fails', async () => {
    api.apiAdminCreateCampaign.mockResolvedValueOnce({ ok: false, data: { message: 'Duplicate' } });
    const wrapper = mount(AdminCampaigns);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('New Campaign'))
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Create')
      .trigger('click');
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('Duplicate');
  });

  it('saves edited campaign settings', async () => {
    const wrapper = mount(AdminCampaigns);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit')
      .trigger('click');
    await wrapper.findAll('input')[0].setValue('April Refresh');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminUpdateCampaign).toHaveBeenCalledWith(
      'APR26',
      expect.objectContaining({ displayName: 'April Refresh', isActive: true }),
    );
  });

  it('toggles the active flag through the settings endpoint', async () => {
    const wrapper = mount(AdminCampaigns);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Deactivate')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminUpdateCampaign).toHaveBeenCalledWith('APR26', { isActive: false });
  });
});
