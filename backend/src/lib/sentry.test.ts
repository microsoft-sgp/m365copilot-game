import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

const sentryMock = vi.hoisted(() => {
  const init = vi.fn();
  const flush = vi.fn(async () => true);
  const captureException = vi.fn();
  const captureMessage = vi.fn();
  const scope = {
    setLevel: vi.fn(),
    setTags: vi.fn(),
    setFingerprint: vi.fn(),
    setContext: vi.fn(),
  };
  const withScope = vi.fn((callback) => callback(scope));
  const metrics = { count: vi.fn() };
  return { init, flush, captureException, captureMessage, withScope, metrics, scope };
});

vi.mock('@sentry/node', () => sentryMock);

const {
  captureBackendHttpResponse,
  captureBackendLog,
  incrementBackendMetric,
  initBackendSentry,
  resetBackendSentryForTests,
  sanitizeForSentry,
  withSentry,
} = await import('./sentry.js');

const originalEnv = { ...process.env };

function restoreEnv(): void {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) delete process.env[key];
  });
  Object.assign(process.env, originalEnv);
}

beforeEach(() => {
  restoreEnv();
  resetBackendSentryForTests();
  sentryMock.init.mockClear();
  sentryMock.flush.mockClear();
  sentryMock.captureException.mockClear();
  sentryMock.captureMessage.mockClear();
  sentryMock.withScope.mockClear();
  sentryMock.metrics.count.mockClear();
  Object.values(sentryMock.scope).forEach((mock) => mock.mockClear());
});

describe('initBackendSentry', () => {
  it('does not initialize without a DSN', () => {
    delete process.env.SENTRY_DSN;
    expect(initBackendSentry()).toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it('configures release, sampling, logs, and runtime tags', () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    process.env.SENTRY_ENVIRONMENT = 'staging';
    process.env.SENTRY_RELEASE = 'm365copilot-game@abc123';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.25';
    process.env.SENTRY_ENABLE_LOGS = 'true';

    expect(initBackendSentry('azure-functions')).toBe(true);
    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    expect(sentryMock.init.mock.calls[0][0]).toMatchObject({
      dsn: 'https://public@example.ingest.sentry.io/1',
      environment: 'staging',
      release: 'm365copilot-game@abc123',
      sendDefaultPii: false,
      tracesSampleRate: 0.25,
      enableLogs: true,
      initialScope: { tags: { service: 'backend', runtime: 'azure-functions' } },
    });
  });
});

describe('sanitizeForSentry', () => {
  it('redacts sensitive fields and full email addresses', () => {
    expect(
      sanitizeForSentry({
        email: 'ada@example.com',
        headers: { authorization: 'Bearer secret', harmless: 'support@example.com' },
        nested: { connectionString: 'Endpoint=secret', ok: true },
      }),
    ).toEqual({
      email: '[Filtered]',
      headers: { authorization: '[Filtered]', harmless: '[Filtered]' },
      nested: { connectionString: '[Filtered]', ok: true },
    });
  });
});

describe('withSentry', () => {
  it('captures returned 4xx handler responses with stable grouping', async () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    process.env.SENTRY_FLUSH_TIMEOUT_MS = '1234';
    const handler = vi.fn(async () => ({
      status: 409,
      jsonBody: { ok: false, code: 'PLAYER_RECOVERY_REQUIRED' },
    }));
    const wrapped = withSentry(handler, { functionName: 'createSession' });
    const request = {
      method: 'POST',
      url: 'https://api.example.com/api/sessions?email=ada@example.com',
      params: { id: '1', email: 'ada@example.com' },
    } as unknown as HttpRequest;
    const context = { log: vi.fn() } as unknown as InvocationContext;

    const response = await wrapped(request, context);

    expect(response.status).toBe(409);
    expect(sentryMock.captureMessage).toHaveBeenCalledWith('Backend API returned failure');
    expect(sentryMock.flush).toHaveBeenCalledWith(1234);
    expect(sentryMock.scope.setTags).toHaveBeenCalledWith({
      service: 'backend',
      runtime: 'azure-functions',
      function_name: 'createSession',
      api_status: '409',
      api_status_class: '4xx',
      api_method: 'POST',
    });
    expect(sentryMock.scope.setFingerprint).toHaveBeenCalledWith([
      'backend-returned-response',
      'azure-functions',
      'createSession',
      'POST',
      '/api/sessions',
      '409',
    ]);
    expect(sentryMock.scope.setContext).toHaveBeenCalledWith('request', {
      method: 'POST',
      path: '/api/sessions',
      params: { id: '1', email: '[Filtered]' },
    });
    expect(sentryMock.scope.setContext).toHaveBeenCalledWith('response', {
      status: 409,
      statusClass: '4xx',
    });
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it('captures returned 5xx responses through the helper', async () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    const request = {
      method: 'GET',
      url: 'https://api.example.com/api/health',
    } as unknown as HttpRequest;

    await captureBackendHttpResponse(
      { status: 503, jsonBody: { ok: false } },
      { runtime: 'local-express', functionName: 'GET /api/health', request },
    );

    expect(sentryMock.captureMessage).toHaveBeenCalledWith('Backend API returned failure');
    expect(sentryMock.scope.setTags).toHaveBeenCalledWith({
      service: 'backend',
      runtime: 'local-express',
      function_name: 'GET /api/health',
      api_status: '503',
      api_status_class: '5xx',
      api_method: 'GET',
    });
    expect(sentryMock.scope.setFingerprint).toHaveBeenCalledWith([
      'backend-returned-response',
      'local-express',
      'GET /api/health',
      'GET',
      '/api/health',
      '503',
    ]);
  });

  it('does not capture returned failures when Sentry is disabled', async () => {
    delete process.env.SENTRY_DSN;

    await captureBackendHttpResponse({ status: 404 }, { functionName: 'missingRoute' });

    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(sentryMock.captureMessage).not.toHaveBeenCalled();
  });

  it('captures, flushes, and rethrows unexpected handler errors', async () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    process.env.SENTRY_FLUSH_TIMEOUT_MS = '1234';
    const error = new Error('boom');
    const handler = vi.fn(async () => {
      throw error;
    });
    const wrapped = withSentry(handler, { functionName: 'createSession' });
    const request = {
      method: 'POST',
      url: 'https://api.example.com/api/sessions?email=ada@example.com',
      params: { id: '1' },
    } as unknown as HttpRequest;
    const context = { log: vi.fn() } as unknown as InvocationContext;

    await expect(wrapped(request, context)).rejects.toThrow('boom');

    expect(handler).toHaveBeenCalledWith(request, context);
    expect(sentryMock.captureException).toHaveBeenCalledWith(error);
    expect(sentryMock.captureMessage).not.toHaveBeenCalledWith('Backend API returned failure');
    expect(sentryMock.flush).toHaveBeenCalledWith(1234);
    expect(sentryMock.scope.setTags).toHaveBeenCalledWith({
      service: 'backend',
      runtime: 'azure-functions',
      function_name: 'createSession',
    });
    expect(sentryMock.scope.setContext).toHaveBeenCalledWith('request', {
      method: 'POST',
      url: 'https://api.example.com/api/sessions?email=ada@example.com',
      params: { id: '1' },
    });
  });
});

describe('logs and metrics', () => {
  it('uses the configured backend tags for log and metric events', () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    initBackendSentry('local-express');

    captureBackendLog('cache miss', 'info', { email: 'ada@example.com' });
    incrementBackendMetric('cache_miss', 2, { cache: 'leaderboard' });

    expect(sentryMock.captureMessage).toHaveBeenCalledWith('cache miss', {
      level: 'info',
      tags: { service: 'backend', runtime: 'local-express' },
      extra: { email: '[Filtered]' },
    });
    expect(sentryMock.metrics.count).toHaveBeenCalledWith('cache_miss', 2, {
      tags: { service: 'backend', runtime: 'local-express', cache: 'leaderboard' },
    });
  });
});
