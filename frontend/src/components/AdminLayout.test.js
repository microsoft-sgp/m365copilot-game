import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AdminLayout from './AdminLayout.vue';

const stubs = {
  AdminDashboard: { template: '<section data-test="dashboard">Dashboard View</section>' },
  AdminOrganizations: {
    template: '<section data-test="organizations">Organizations View</section>',
  },
  AdminCampaigns: { template: '<section data-test="campaigns">Campaigns View</section>' },
  AdminPlayers: { template: '<section data-test="players">Players View</section>' },
  AdminAccess: { template: '<section data-test="admins">Admins View</section>' },
  AdminDangerZone: { template: '<section data-test="danger">Danger View</section>' },
};

describe('AdminLayout', () => {
  it('renders dashboard first and switches between admin sections', async () => {
    const wrapper = mount(AdminLayout, { global: { stubs } });
    await flushPromises();

    expect(wrapper.find('[data-test="dashboard"]').exists()).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Organizations'))
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="organizations"]').exists()).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Campaigns'))
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="campaigns"]').exists()).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Players'))
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="players"]').exists()).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Admins')
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="admins"]').exists()).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Danger Zone'))
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="danger"]').exists()).toBe(true);
  });

  it('emits logout from the header button', async () => {
    const wrapper = mount(AdminLayout, { global: { stubs } });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Logout')
      .trigger('click');
    expect(wrapper.emitted('logout')).toHaveLength(1);
  });
});
