import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AdminLogin from './AdminLogin.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminRequestOtp: vi.fn(),
  apiAdminVerifyOtp: vi.fn(),
}));

const api = await import('../lib/api.js');

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

function findButton(wrapper, label) {
  return wrapper.findAll('button').find((b) => b.text().includes(label));
}

describe('AdminLogin email step', () => {
  it('shows a session confirmation message from the app shell', () => {
    const wrapper = mount(AdminLogin, {
      props: { sessionMessage: 'Your admin session could not be confirmed. Please sign in again.' },
    });
    expect(wrapper.text()).toContain('Your admin session could not be confirmed');
  });

  it('rejects empty/invalid email without calling the API', async () => {
    const wrapper = mount(AdminLogin);
    await findButton(wrapper, 'Send Code').trigger('click');
    await flushPromises();
    expect(api.apiAdminRequestOtp).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('valid email');
  });

  it('lowercases and trims email before submission', async () => {
    api.apiAdminRequestOtp.mockResolvedValue({ ok: true, data: { ok: true } });
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue(' Admin@Test.COM ');
    await findButton(wrapper, 'Send Code').trigger('click');
    await flushPromises();
    expect(api.apiAdminRequestOtp).toHaveBeenCalledWith('admin@test.com');
    // Step advances to OTP entry
    expect(wrapper.find('input[placeholder="000000"]').exists()).toBe(true);
  });

  it('shows rate-limit message on 429 response', async () => {
    api.apiAdminRequestOtp.mockResolvedValue({ ok: false, status: 429, data: null });
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue('admin@test.com');
    await findButton(wrapper, 'Send Code').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toMatch(/wait/i);
  });

  it('surfaces server error message on failure', async () => {
    api.apiAdminRequestOtp.mockResolvedValue({ ok: false, status: 500, data: { message: 'down' } });
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue('admin@test.com');
    await findButton(wrapper, 'Send Code').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('down');
  });
});

describe('AdminLogin OTP step', () => {
  async function advanceToOtp(wrapper) {
    api.apiAdminRequestOtp.mockResolvedValue({ ok: true, data: { ok: true } });
    await wrapper.find('input[type="email"]').setValue('admin@test.com');
    await findButton(wrapper, 'Send Code').trigger('click');
    await flushPromises();
  }

  it('rejects empty code without calling verify API', async () => {
    const wrapper = mount(AdminLogin);
    await advanceToOtp(wrapper);
    await findButton(wrapper, 'Verify').trigger('click');
    await flushPromises();
    expect(api.apiAdminVerifyOtp).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/6-digit code/i);
  });

  it('stores non-sensitive admin state and emits authenticated on success', async () => {
    api.apiAdminVerifyOtp.mockResolvedValue({ ok: true, data: { ok: true } });
    const wrapper = mount(AdminLogin);
    await advanceToOtp(wrapper);
    await wrapper.find('input[placeholder="000000"]').setValue('123456');
    await findButton(wrapper, 'Verify').trigger('click');
    await flushPromises();

    expect(api.apiAdminVerifyOtp).toHaveBeenCalledWith('admin@test.com', '123456');
    expect(sessionStorage.getItem('admin_authenticated')).toBe('true');
    expect(sessionStorage.getItem('admin_email')).toBe('admin@test.com');
    expect(sessionStorage.getItem('admin_token')).toBeNull();
    expect(wrapper.emitted('authenticated')[0]).toEqual(['admin@test.com']);
  });

  it('shows server error and does not store admin state on failure', async () => {
    api.apiAdminVerifyOtp.mockResolvedValue({ ok: false, data: { message: 'Invalid code' } });
    const wrapper = mount(AdminLogin);
    await advanceToOtp(wrapper);
    await wrapper.find('input[placeholder="000000"]').setValue('000000');
    await findButton(wrapper, 'Verify').trigger('click');
    await flushPromises();

    expect(sessionStorage.getItem('admin_authenticated')).toBeNull();
    expect(sessionStorage.getItem('admin_token')).toBeNull();
    expect(wrapper.text()).toContain('Invalid code');
    expect(wrapper.emitted('authenticated')).toBeUndefined();
  });
});

describe('AdminLogin navigation', () => {
  it('emits back when "Back to Game" clicked', async () => {
    const wrapper = mount(AdminLogin);
    await findButton(wrapper, 'Back to Game').trigger('click');
    expect(wrapper.emitted('back')).toBeTruthy();
  });
});
