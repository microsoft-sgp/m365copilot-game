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
  vi.useRealTimers();
  sessionStorage.clear();
});

function findButton(wrapper, label) {
  return wrapper.findAll('button').find((b) => b.text().includes(label));
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
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

  it('shows delivery confirmation status while the OTP request remains pending', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    api.apiAdminRequestOtp.mockReturnValue(pending.promise);
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue('admin@test.com');

    await findButton(wrapper, 'Send Code').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Sending...');
    expect(findButton(wrapper, 'Sending...').attributes('disabled')).toBeDefined();
    expect(wrapper.find('input[placeholder="000000"]').exists()).toBe(false);

    vi.advanceTimersByTime(3000);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Confirming delivery...');
    expect(findButton(wrapper, 'Confirming delivery...').attributes('disabled')).toBeDefined();
    expect(wrapper.find('input[placeholder="000000"]').exists()).toBe(false);

    pending.resolve({ ok: true, data: { ok: true } });
    await pending.promise;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Code sent');
    expect(wrapper.find('input[placeholder="000000"]').exists()).toBe(true);
  });

  it('clears delivery confirmation status when OTP request fails', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    api.apiAdminRequestOtp.mockReturnValue(pending.promise);
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue('admin@test.com');

    await findButton(wrapper, 'Send Code').trigger('click');
    vi.advanceTimersByTime(3000);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Confirming delivery...');

    pending.resolve({ ok: false, status: 500, data: { message: 'down' } });
    await pending.promise;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('down');
    expect(wrapper.text()).not.toContain('Confirming delivery...');
    expect(findButton(wrapper, 'Send Code').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('input[placeholder="000000"]').exists()).toBe(false);
  });

  it('clears the slow-send timer when unmounted mid-request', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    api.apiAdminRequestOtp.mockReturnValue(pending.promise);
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue('admin@test.com');

    await findButton(wrapper, 'Send Code').trigger('click');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve({ ok: true, data: { ok: true } });
    await pending.promise;
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
