import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiGetHealth: vi.fn(),
}));

import { apiGetHealth } from '../lib/api.js';
import { __resetHealthStatusForTests } from '../composables/useHealthStatus.js';
import GameFooter from './GameFooter.vue';

function findStatus(wrapper) {
  return wrapper.find('[data-testid="health-status"]');
}

describe('GameFooter health status indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiGetHealth.mockReset();
    __resetHealthStatusForTests();
  });

  afterEach(() => {
    __resetHealthStatusForTests();
    vi.useRealTimers();
  });

  it('renders Checking… on first paint before any probe response', () => {
    // Probe never resolves in this test — assert pre-response state.
    apiGetHealth.mockReturnValueOnce(new Promise(() => {}));
    const w = mount(GameFooter);
    const status = findStatus(w);
    expect(status.exists()).toBe(true);
    expect(status.attributes('data-status')).toBe('unknown');
    expect(status.text()).toContain('Checking…');
    w.unmount();
  });

  it('shows Online after a healthy probe', async () => {
    apiGetHealth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    const w = mount(GameFooter);
    await flushPromises();
    const status = findStatus(w);
    expect(status.attributes('data-status')).toBe('healthy');
    expect(status.text()).toContain('Online');
    expect(status.find('span.bg-emerald-500').exists()).toBe(true);
    w.unmount();
  });

  it('shows Degraded after a degraded probe', async () => {
    apiGetHealth.mockResolvedValueOnce({
      ok: false,
      status: 200,
      data: { status: 'degraded', api: 'up', database: 'down' },
    });
    const w = mount(GameFooter);
    await flushPromises();
    const status = findStatus(w);
    expect(status.attributes('data-status')).toBe('degraded');
    expect(status.text()).toContain('Degraded');
    expect(status.find('span.bg-amber-500').exists()).toBe(true);
    // No tooltip / hover-only content: only visible label words.
    expect(status.text()).not.toContain('database');
    expect(status.text()).not.toContain('API');
    w.unmount();
  });

  it('shows Offline after a network-failure probe', async () => {
    apiGetHealth.mockResolvedValueOnce({ ok: false, status: 0, data: null });
    const w = mount(GameFooter);
    await flushPromises();
    const status = findStatus(w);
    expect(status.attributes('data-status')).toBe('down');
    expect(status.text()).toContain('Offline');
    expect(status.find('span.bg-red-500').exists()).toBe(true);
    w.unmount();
  });

  it('keeps the existing attribution lines unchanged', async () => {
    apiGetHealth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    const w = mount(GameFooter);
    await flushPromises();
    expect(w.text()).toContain('Designed by Microsoft Student Ambassadors');
    expect(w.text()).toContain('Powered by Microsoft');
    w.unmount();
  });
});
