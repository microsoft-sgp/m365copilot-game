import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const incrementBackendMetric = vi.hoisted(() => vi.fn());
const logBackendEvent = vi.hoisted(() => vi.fn());

vi.mock('../lib/sentry.js', () => ({ incrementBackendMetric, logBackendEvent }));

import { handler } from './sentrySmoke.js';

const originalSmokeSetting = process.env.SENTRY_SMOKE_CHECK;

function context() {
  return { log: vi.fn(), error: vi.fn() };
}

describe('sentrySmoke', () => {
  beforeEach(() => {
    delete process.env.SENTRY_SMOKE_CHECK;
    incrementBackendMetric.mockClear();
    logBackendEvent.mockClear();
  });

  afterEach(() => {
    if (originalSmokeSetting === undefined) delete process.env.SENTRY_SMOKE_CHECK;
    else process.env.SENTRY_SMOKE_CHECK = originalSmokeSetting;
  });

  it('stays hidden unless the smoke check is explicitly enabled', async () => {
    const response = await handler({}, context());

    expect(response).toEqual({ status: 404, jsonBody: { ok: false, message: 'Not found' } });
    expect(incrementBackendMetric).not.toHaveBeenCalled();
    expect(logBackendEvent).not.toHaveBeenCalled();
  });

  it('emits backend smoke telemetry before throwing a controlled error', async () => {
    process.env.SENTRY_SMOKE_CHECK = 'true';
    const ctx = context();

    await expect(handler({}, ctx)).rejects.toThrow('Controlled backend Sentry smoke check');

    expect(incrementBackendMetric).toHaveBeenCalledWith('test_counter', 1, {
      smoke_check: 'backend',
    });
    expect(logBackendEvent).toHaveBeenCalledWith(ctx, 'backend_sentry_smoke_log', 'info', {
      smoke_check: true,
    });
  });
});