import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AdminOrganizations from './AdminOrganizations.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminGetOrganizations: vi.fn(),
  apiAdminCreateOrganization: vi.fn(),
  apiAdminUpdateOrganization: vi.fn(),
  apiAdminDeleteOrganization: vi.fn(),
  apiAdminAddDomain: vi.fn(),
  apiAdminRemoveDomain: vi.fn(),
}));

const api = await import('../lib/api.js');

const organizationsFixture = [{ id: 1, name: 'NUS', domains: [{ id: 11, domain: 'nus.edu.sg' }] }];

let alertSpy;
let confirmSpy;

beforeEach(() => {
  vi.clearAllMocks();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
  api.apiAdminGetOrganizations.mockResolvedValue({
    ok: true,
    data: { organizations: organizationsFixture },
  });
  api.apiAdminCreateOrganization.mockResolvedValue({ ok: true, data: { ok: true } });
  api.apiAdminUpdateOrganization.mockResolvedValue({ ok: true, data: { ok: true } });
  api.apiAdminDeleteOrganization.mockResolvedValue({ ok: true, data: { ok: true } });
  api.apiAdminAddDomain.mockResolvedValue({ ok: true, data: { ok: true } });
  api.apiAdminRemoveDomain.mockResolvedValue({ ok: true, data: { ok: true } });
});

afterEach(() => {
  alertSpy.mockRestore();
  confirmSpy.mockRestore();
});

describe('AdminOrganizations', () => {
  it('loads organizations and domains', async () => {
    const wrapper = mount(AdminOrganizations);
    expect(wrapper.text()).toContain('Loading');
    await flushPromises();

    expect(wrapper.text()).toContain('NUS');
    expect(wrapper.text()).toContain('nus.edu.sg');
  });

  it('creates a trimmed organization and reloads', async () => {
    const wrapper = mount(AdminOrganizations);
    await flushPromises();

    await wrapper.find('input[placeholder="New organization name"]').setValue('  SMU  ');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Add'))
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminCreateOrganization).toHaveBeenCalledWith('SMU');
    expect(api.apiAdminGetOrganizations).toHaveBeenCalledTimes(2);
  });

  it('shows create errors inline', async () => {
    api.apiAdminCreateOrganization.mockResolvedValueOnce({
      ok: false,
      data: { message: 'Name already exists' },
    });
    const wrapper = mount(AdminOrganizations);
    await flushPromises();

    await wrapper.find('input[placeholder="New organization name"]').setValue('NUS');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Add'))
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Name already exists');
  });

  it('edits an organization name', async () => {
    const wrapper = mount(AdminOrganizations);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit')
      .trigger('click');
    const editInput = wrapper.findAll('input').find((input) => input.element.value === 'NUS');
    await editInput.setValue('National University');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminUpdateOrganization).toHaveBeenCalledWith(1, 'National University');
  });

  it('deletes only after confirmation and alerts on failure', async () => {
    api.apiAdminDeleteOrganization.mockResolvedValueOnce({
      ok: false,
      data: { message: 'Cannot delete' },
    });
    const wrapper = mount(AdminOrganizations);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete')
      .trigger('click');
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith('Delete this organization?');
    expect(api.apiAdminDeleteOrganization).toHaveBeenCalledWith(1);
    expect(alertSpy).toHaveBeenCalledWith('Cannot delete');
  });

  it('normalizes domains before adding them', async () => {
    const wrapper = mount(AdminOrganizations);
    await flushPromises();

    await wrapper.find('input[placeholder="add domain"]').setValue(' New.Edu.SG ');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '+')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminAddDomain).toHaveBeenCalledWith(1, 'new.edu.sg');
  });

  it('removes domains and reloads the organization list', async () => {
    const wrapper = mount(AdminOrganizations);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '\u2715')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminRemoveDomain).toHaveBeenCalledWith(1, 11);
    expect(api.apiAdminGetOrganizations).toHaveBeenCalledTimes(2);
  });
});
