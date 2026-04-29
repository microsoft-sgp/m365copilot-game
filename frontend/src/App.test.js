import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('./lib/api.js', () => ({
  apiGetPlayerState: vi.fn().mockResolvedValue({ ok: true, data: { player: null } }),
  apiAdminRefresh: vi.fn().mockResolvedValue({ ok: false, data: { message: 'Unauthorized' } }),
  apiAdminLogout: vi.fn().mockResolvedValue({ ok: true, data: { ok: true } }),
  apiCreateSession: vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, data: { ok: true, gameSessionId: 1 } }),
  installPlayerAuthRefresher: vi.fn(),
}));

const gameMocks = vi.hoisted(() => ({
  hydrateFromServer: vi.fn(),
  setIdentity: vi.fn(),
}));

vi.mock('./lib/playerToken.js', () => ({
  clearPlayerToken: vi.fn(),
  getPlayerToken: vi.fn().mockReturnValue(''),
  setPlayerToken: vi.fn(),
}));

vi.mock('./composables/useBingoGame.js', () => ({
  useBingoGame: () => ({
    hydrateFromServer: gameMocks.hydrateFromServer,
    setIdentity: gameMocks.setIdentity,
  }),
}));

// Stub heavy children so tests focus on routing / identity gate logic.
const stubs = {
  TopBar: { template: '<div data-test="topbar" />' },
  AppTabs: { template: '<div data-test="apptabs" />' },
  GameTab: { template: '<div data-test="gametab" />' },
  KeywordsPanel: { template: '<div />' },
  MyActivityPanel: { template: '<div />' },
  HelpPanel: {
    template: '<button data-test="help-admin" @click="$emit(\'admin\')" />',
    emits: ['admin'],
  },
  EmailGate: {
    template:
      "<button data-test=\"email-continue\" @click=\"$emit('continue', { email: 'ada@nus.edu.sg', name: 'Ada', organization: 'NUS' })\" />",
    emits: ['continue', 'admin'],
  },
  ToastMessage: { template: '<div />' },
  GameFooter: { template: '<div />' },
  AdminLogin: { template: '<div data-test="admin-login" />' },
  AdminLayout: {
    template: '<button data-test="admin-layout" @click="$emit(\'logout\')" />',
    emits: ['logout'],
  },
};

import {
  apiAdminLogout,
  apiAdminRefresh,
  apiCreateSession,
  apiGetPlayerState,
  installPlayerAuthRefresher,
} from './lib/api.js';
import { clearPlayerToken } from './lib/playerToken.js';

import App from './App.vue';

beforeEach(() => {
  vi.clearAllMocks();
  apiGetPlayerState.mockResolvedValue({ ok: true, data: { player: null } });
  apiAdminRefresh.mockResolvedValue({ ok: false, data: { message: 'Unauthorized' } });
  apiAdminLogout.mockResolvedValue({ ok: true, data: { ok: true } });
  apiCreateSession.mockResolvedValue({
    ok: true,
    status: 200,
    data: { ok: true, gameSessionId: 1 },
  });
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('App routing', () => {
  it('renders EmailGate when identity is missing', async () => {
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-test="email-continue"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="topbar"]').exists()).toBe(false);
  });

  it('reveals the main game once email-gate completes', async () => {
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    await wrapper.find('[data-test="email-continue"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="topbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="apptabs"]').exists()).toBe(true);
    expect(localStorage.getItem('copilot_bingo_email')).toBe('ada@nus.edu.sg');
    expect(gameMocks.setIdentity).toHaveBeenCalledWith({
      email: 'ada@nus.edu.sg',
      name: 'Ada',
      organization: 'NUS',
    });
  });

  it('keeps public-email players in the identity gate until organization is present', async () => {
    localStorage.setItem('copilot_bingo_email', 'alex@gmail.com');
    localStorage.setItem('copilot_bingo_player_name', 'Alex');

    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();

    expect(wrapper.find('[data-test="email-continue"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="topbar"]').exists()).toBe(false);
    expect(apiGetPlayerState).not.toHaveBeenCalled();
  });

  it('hydrates player state from the API when stored identity is ready', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@nus.edu.sg');
    localStorage.setItem('copilot_bingo_player_name', 'Ada');
    apiGetPlayerState.mockResolvedValueOnce({
      ok: true,
      data: { player: { playerName: 'Ada', activeSession: null } },
    });

    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();

    expect(wrapper.find('[data-test="topbar"]').exists()).toBe(true);
    expect(apiGetPlayerState).toHaveBeenCalledWith('ada@nus.edu.sg');
    expect(gameMocks.hydrateFromServer).toHaveBeenCalledWith({
      playerName: 'Ada',
      activeSession: null,
    });
  });

  it('opens admin login from the in-game help panel', async () => {
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    await wrapper.find('[data-test="email-continue"]').trigger('click');
    await flushPromises();

    await wrapper.find('[data-test="help-admin"]').trigger('click');
    await flushPromises();

    expect(window.location.hash).toBe('#/admin/login');
    expect(wrapper.find('[data-test="admin-login"]').exists()).toBe(true);
  });

  it('routes to admin login when hash is #/admin/login', async () => {
    window.location.hash = '#/admin/login';
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-test="admin-login"]').exists()).toBe(true);
  });

  it('routes to admin layout when hash is #/admin and admin session hint is present', async () => {
    sessionStorage.setItem('admin_authenticated', 'true');
    window.location.hash = '#/admin';
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-test="admin-layout"]').exists()).toBe(true);
  });

  it('routes to admin layout when cookie refresh succeeds', async () => {
    apiAdminRefresh.mockResolvedValueOnce({ ok: true, data: { ok: true } });
    window.location.hash = '#/admin';

    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();

    expect(apiAdminRefresh).toHaveBeenCalled();
    expect(sessionStorage.getItem('admin_authenticated')).toBe('true');
    expect(wrapper.find('[data-test="admin-layout"]').exists()).toBe(true);
  });

  it('falls back to admin login when hash is #/admin without an active cookie session', async () => {
    window.location.hash = '#/admin';
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-test="admin-login"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="admin-layout"]').exists()).toBe(false);
  });

  it('logs out of admin view and clears session hints plus player token', async () => {
    sessionStorage.setItem('admin_authenticated', 'true');
    sessionStorage.setItem('admin_email', 'admin@test.com');
    window.location.hash = '#/admin';
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();

    await wrapper.find('[data-test="admin-layout"]').trigger('click');
    await flushPromises();

    expect(apiAdminLogout).toHaveBeenCalled();
    expect(sessionStorage.getItem('admin_authenticated')).toBeNull();
    expect(sessionStorage.getItem('admin_email')).toBeNull();
    expect(clearPlayerToken).toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(wrapper.find('[data-test="email-continue"]').exists()).toBe(true);
  });

  it('installs a player auth refresher that recreates the session from stored identity', async () => {
    const wrapper = mount(App, { global: { stubs } });
    await flushPromises();
    await wrapper.find('[data-test="email-continue"]').trigger('click');
    await flushPromises();

    const refresher = installPlayerAuthRefresher.mock.calls.find(
      ([fn]) => typeof fn === 'function',
    )[0];
    apiCreateSession.mockClear();

    const result = await refresher();

    expect(result).toBe(true);
    expect(apiCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.any(String),
        playerName: 'Ada',
        email: 'ada@nus.edu.sg',
        organization: 'NUS',
      }),
    );
  });
});
