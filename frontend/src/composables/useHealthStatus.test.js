import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  apiGetHealth: vi.fn(),
}));

import { apiGetHealth } from '../lib/api.js';
import {
  useHealthStatus,
  __resetHealthStatusForTests,
} from './useHealthStatus.js';

describe('useHealthStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiGetHealth.mockReset();
    __resetHealthStatusForTests();
  });

  afterEach(() => {
    __resetHealthStatusForTests();
    vi.useRealTimers();
  });

  it('starts as unknown before any probe response', () => {
    const { status } = useHealthStatus();
    expect(status.value).toBe('unknown');
  });

  it('transitions unknown -> healthy after a healthy probe', async () => {
    apiGetHealth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    const { status, start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(status.value).toBe('healthy'));
    stop();
  });

  it('transitions healthy -> degraded when database goes down', async () => {
    apiGetHealth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    const { status, start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(status.value).toBe('healthy'));

    apiGetHealth.mockResolvedValueOnce({
      ok: false,
      status: 200,
      data: { status: 'degraded', api: 'up', database: 'down' },
    });
    await vi.advanceTimersByTimeAsync(30000);
    await vi.waitFor(() => expect(status.value).toBe('degraded'));
    stop();
  });

  it('transitions healthy -> down on network failure (status: 0)', async () => {
    apiGetHealth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    const { status, start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(status.value).toBe('healthy'));

    apiGetHealth.mockResolvedValueOnce({ ok: false, status: 0, data: null });
    await vi.advanceTimersByTimeAsync(30000);
    await vi.waitFor(() => expect(status.value).toBe('down'));
    stop();
  });

  it('recovers down -> healthy on next successful probe', async () => {
    apiGetHealth.mockResolvedValueOnce({ ok: false, status: 0, data: null });
    const { status, start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(status.value).toBe('down'));

    apiGetHealth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    await vi.advanceTimersByTimeAsync(30000);
    await vi.waitFor(() => expect(status.value).toBe('healthy'));
    stop();
  });

  it('stop() clears the interval and visibility listener', async () => {
    apiGetHealth.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: 'healthy', api: 'up', database: 'up' },
    });
    const { start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(apiGetHealth).toHaveBeenCalledTimes(1));
    stop();

    apiGetHealth.mockClear();
    await vi.advanceTimersByTimeAsync(60000);
    expect(apiGetHealth).not.toHaveBeenCalled();
  });

  it('treats unexpected response shapes as down', async () => {
    apiGetHealth.mockResolvedValueOnce({ ok: true, status: 200, data: { foo: 'bar' } });
    const { status, start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(status.value).toBe('down'));
    stop();
  });

  it('treats null response as down', async () => {
    apiGetHealth.mockResolvedValueOnce(null);
    const { status, start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(status.value).toBe('down'));
    stop();
  });

  it('coalesces concurrent probes into a single in-flight request', async () => {
    let resolve;
    apiGetHealth.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { _probe } = useHealthStatus();
    const a = _probe();
    const b = _probe();
    expect(apiGetHealth).toHaveBeenCalledTimes(1);
    resolve({ ok: true, status: 200, data: { status: 'healthy' } });
    await Promise.all([a, b]);
  });

  it('refCount > 1 does not start a second interval', async () => {
    apiGetHealth.mockResolvedValue({ ok: true, status: 200, data: { status: 'healthy' } });
    const a = useHealthStatus();
    const b = useHealthStatus();
    a.start();
    b.start();
    await vi.waitFor(() => expect(apiGetHealth).toHaveBeenCalled());
    apiGetHealth.mockClear();
    await vi.advanceTimersByTimeAsync(30000);
    // Only one interval scheduled
    expect(apiGetHealth).toHaveBeenCalledTimes(1);
    a.stop();
    b.stop();
  });

  it('triggers a probe on visibilitychange when document becomes visible', async () => {
    apiGetHealth.mockResolvedValue({ ok: true, status: 200, data: { status: 'healthy' } });
    const { start, stop } = useHealthStatus();
    start();
    await vi.waitFor(() => expect(apiGetHealth).toHaveBeenCalledTimes(1));
    // Flush the in-flight probe so the next call isn't coalesced.
    await Promise.resolve();
    await Promise.resolve();
    apiGetHealth.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(apiGetHealth).toHaveBeenCalledTimes(1));
    stop();
  });
});
