import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

const sentryMock = vi.hoisted(() => {
  const init = vi.fn();
  const flush = vi.fn(async () => true);
  const captureException = vi.fn();
  const captureMessage = vi.fn();
  const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
  const scope = {
    setLevel: vi.fn(),
    setTags: vi.fn(),
    setFingerprint: vi.fn(),
    setContext: vi.fn(),
  };
  const withScope = vi.fn((callback) => callback(scope));
  const metrics = { count: vi.fn() };
  return { init, flush, captureException, captureMessage, logger, withScope, metrics, scope };
});

vi.mock('@sentry/node', () => sentryMock);

const {
  captureBackendHttpResponse,
  captureBackendLog,
  classifyBackendHttpResponse,
  incrementBackendMetric,
  initBackendSentry,
  logBackendEvent,
  normalizeBackendRequestPath,
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
  Object.values(sentryMock.logger).forEach((mock) => mock.mockClear());
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
        status_code: 409,
        workflow_code: 'PLAYER_RECOVERY_REQUIRED',
        function_name: 'createSession',
        error_name: 'TypeError',
        code: '123456',
      }),
    ).toEqual({
      email: '[Filtered]',
      headers: '[Filtered]',
      nested: { connectionString: '[Filtered]', ok: true },
      status_code: 409,
      workflow_code: 'PLAYER_RECOVERY_REQUIRED',
      function_name: 'createSession',
      error_name: 'TypeError',
      code: '[Filtered]',
    });
  });
});

describe('normalizeBackendRequestPath', () => {
  it('removes query strings and replaces high-cardinality route segments', () => {
    expect(
      normalizeBackendRequestPath('https://api.example.com/api/portal-api/admins/ada%40example.com?x=1'),
    ).toBe('/api/portal-api/admins/:email');
    expect(normalizeBackendRequestPath('/api/sessions/12345?email=ada@example.com')).toBe(
      '/api/sessions/:id',
    );
  });
});

describe('withSentry', () => {
  it('classifies returned 4xx and 5xx handler responses', () => {
    expect(
      classifyBackendHttpResponse(
        { status: 409, jsonBody: { ok: false, code: 'PLAYER_RECOVERY_REQUIRED' } },
        {
          runtime: 'azure-functions',
          functionName: 'createSession',
          request: {
            method: 'POST',
            url: 'https://api.example.com/api/sessions?email=ada@example.com',
          } as unknown as HttpRequest,
        },
      ),
    ).toMatchObject({
      statusClass: '4xx',
      responseClass: 'client_response',
      shouldCaptureIssue: false,
      shouldLog: true,
      shouldMetric: true,
      workflowCode: 'PLAYER_RECOVERY_REQUIRED',
      path: '/api/sessions',
    });

    expect(
      classifyBackendHttpResponse(
        { status: 503, jsonBody: { ok: false } },
        {
          runtime: 'local-express',
          functionName: 'GET /api/health',
          request: { method: 'GET', url: 'https://api.example.com/api/health' } as unknown as HttpRequest,
        },
      ),
    ).toMatchObject({
      statusClass: '5xx',
      responseClass: 'server_failure',
      shouldCaptureIssue: true,
      shouldLog: false,
      shouldMetric: false,
    });
  });

  it('logs returned 4xx handler responses with stable attributes and metrics', async () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    process.env.SENTRY_FLUSH_TIMEOUT_MS = '1234';
    process.env.SENTRY_ENVIRONMENT = 'staging';
    process.env.SENTRY_RELEASE = 'm365copilot-game@abc123';
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
    expect(sentryMock.captureMessage).not.toHaveBeenCalledWith('Backend API returned failure');
    expect(sentryMock.captureException).not.toHaveBeenCalled();
    expect(sentryMock.flush).toHaveBeenCalledWith(1234);
    expect(sentryMock.logger.info).toHaveBeenCalledWith(
      'Backend API client response',
      expect.objectContaining({
        service: 'backend',
        runtime: 'azure-functions',
        environment: 'staging',
        release: 'm365copilot-game@abc123',
        function_name: 'createSession',
        http_method: 'POST',
        endpoint_path: '/api/sessions',
        status_code: 409,
        status_class: '4xx',
        response_class: 'client_response',
        workflow_code: 'PLAYER_RECOVERY_REQUIRED',
      }),
    );
    expect(sentryMock.metrics.count).toHaveBeenCalledWith(
      'api.client_response',
      1,
      expect.objectContaining({
        tags: expect.objectContaining({
          service: 'backend',
          runtime: 'azure-functions',
          status_code: '409',
          status_class: '4xx',
          response_class: 'client_response',
          workflow_code: 'PLAYER_RECOVERY_REQUIRED',
        }),
      }),
    );
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
      response_class: 'server_failure',
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
      path: '/api/sessions',
      params: { id: '1' },
    });
  });
});

describe('logs and metrics', () => {
  it('uses real Sentry Logs and configured backend tags for log and metric events', () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    process.env.SENTRY_ENVIRONMENT = 'staging';
    process.env.SENTRY_RELEASE = 'm365copilot-game@abc123';
    initBackendSentry('local-express');

    captureBackendLog('cache miss', 'info', { email: 'ada@example.com' });
    incrementBackendMetric('cache_miss', 2, { cache: 'leaderboard' });

    expect(sentryMock.captureMessage).not.toHaveBeenCalled();
    expect(sentryMock.logger.info).toHaveBeenCalledWith(
      'cache miss',
      expect.objectContaining({
        service: 'backend',
        runtime: 'local-express',
        environment: 'staging',
        release: 'm365copilot-game@abc123',
        severity: 'info',
        email: '[Filtered]',
      }),
    );
    expect(sentryMock.metrics.count).toHaveBeenCalledWith('cache_miss', 2, {
      tags: { service: 'backend', runtime: 'local-express', cache: 'leaderboard' },
    });
  });

  it('preserves platform logging while emitting sanitized Sentry Logs', () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    initBackendSentry('azure-functions');
    const context = { log: vi.fn(), error: vi.fn() };
    const error = new Error('boom');

    logBackendEvent(context, 'admin_otp_verify_failure', 'warn', {
      email: 'ada@example.com',
      status_code: 401,
    });
    logBackendEvent(
      context,
      'Failed to verify player recovery code',
      'error',
      { error_name: 'Error' },
      error,
    );

    expect(context.log).toHaveBeenCalledWith('admin_otp_verify_failure', {
      email: 'ada@example.com',
      status_code: 401,
    });
    expect(context.error).toHaveBeenCalledWith('Failed to verify player recovery code', error);
    expect(sentryMock.logger.warn).toHaveBeenCalledWith(
      'admin_otp_verify_failure',
      expect.objectContaining({ email: '[Filtered]', status_code: 401 }),
    );
    expect(sentryMock.logger.error).toHaveBeenCalledWith(
      'Failed to verify player recovery code',
      expect.objectContaining({ error_name: 'Error' }),
    );
  });
});
