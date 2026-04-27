import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AdminAccess from './AdminAccess.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminGetAdmins: vi.fn(),
  apiAdminAddAdmin: vi.fn(),
  apiAdminRemoveAdmin: vi.fn(),
  apiAdminRequestOtp: vi.fn(),
  apiAdminVerifyStepUpOtp: vi.fn(),
}));

const api = await import('../lib/api.js');

function setAdminSession(email = 'admin@test.com') {
  const payload = btoa(JSON.stringify({ email }));
  sessionStorage.setItem('admin_token', `x.${payload}.x`);
}

describe('AdminAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    setAdminSession();
    api.apiAdminGetAdmins.mockResolvedValue({
      ok: true,
      data: {
        admins: [
          { email: 'admin@test.com', source: 'bootstrap', isActive: true, readOnly: true },
          { email: 'portal@test.com', source: 'portal', isActive: true, readOnly: false },
        ],
      },
    });
  });

  it('displays bootstrap and portal-managed source labels', async () => {
    const wrapper = mount(AdminAccess);
    await flushPromises();
    expect(wrapper.text()).toContain('admin@test.com');
    expect(wrapper.text()).toContain('portal@test.com');
    expect(wrapper.text()).toContain('BOOTSTRAP');
    expect(wrapper.text()).toContain('PORTAL');
  });

  it('requires OTP step-up before adding an admin', async () => {
    api.apiAdminRequestOtp.mockResolvedValue({ ok: true, data: { ok: true } });
    api.apiAdminVerifyStepUpOtp.mockResolvedValue({ ok: true, data: { stepUpToken: 'proof' } });
    api.apiAdminAddAdmin.mockResolvedValue({ ok: true, data: { ok: true } });

    const wrapper = mount(AdminAccess);
    await flushPromises();
    await wrapper.find('input[type="email"]').setValue('new@test.com');
    await wrapper.findAll('button').find((button) => button.text() === 'Add Admin').trigger('click');
    await flushPromises();

    expect(api.apiAdminRequestOtp).toHaveBeenCalledWith('admin@test.com');
    expect(api.apiAdminAddAdmin).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Re-enter OTP');

    await wrapper.find('input[placeholder="000000"]').setValue('123456');
    await wrapper.findAll('button').find((button) => button.text() === 'Confirm').trigger('click');
    await flushPromises();

    expect(api.apiAdminVerifyStepUpOtp).toHaveBeenCalledWith('admin@test.com', '123456', 'add-admin', 'new@test.com');
    expect(api.apiAdminAddAdmin).toHaveBeenCalledWith('new@test.com', 'proof');
  });

  it('keeps remove unsubmitted when step-up OTP fails', async () => {
    api.apiAdminRequestOtp.mockResolvedValue({ ok: true, data: { ok: true } });
    api.apiAdminVerifyStepUpOtp.mockResolvedValue({ ok: false, data: { message: 'Invalid code' } });

    const wrapper = mount(AdminAccess);
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === 'Disable').trigger('click');
    await flushPromises();
    await wrapper.find('input[placeholder="000000"]').setValue('000000');
    await wrapper.findAll('button').find((button) => button.text() === 'Confirm').trigger('click');
    await flushPromises();

    expect(api.apiAdminRemoveAdmin).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Invalid code');
  });
});