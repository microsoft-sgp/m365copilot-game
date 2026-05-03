import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'vue';

const sentryMock = vi.hoisted(() => {
  const init = vi.fn();
  const replayIntegration = vi.fn((options) => ({ name: 'Replay', options }));
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
  return { init, replayIntegration, captureMessage, logger, withScope, metrics, scope };
});

vi.mock('@sentry/vue', () => sentryMock);

const {
  captureFrontendApiFailure,
  captureFrontendLog,
  classifyFrontendApiOutcome,
  getFrontendSentryConfig,
  initFrontendSentry,
  normalizeFrontendEndpointPath,
  resetFrontendSentryForTests,
  runFrontendSentrySmokeCheck,
  sanitizeForSentry,
} = await import('./sentry.js');

const app = {} as App;

function configuredEnv(overrides: Record<string, string | boolean | undefined> = {}) {
  return {
    MODE: 'test',
    VITE_SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    VITE_SENTRY_ENVIRONMENT: 'staging',
    VITE_SENTRY_RELEASE: 'm365copilot-game@abc123',
    VITE_SENTRY_TRACES_SAMPLE_RATE: '0.25',
    VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE: '0.05',
    VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE: '0.75',
    VITE_SENTRY_ENABLE_LOGS: 'true',
    VITE_SENTRY_TRACE_PROPAGATION_TARGETS: 'https://api.example.com',
    ...overrides,
  };
}

beforeEach(() => {
  resetFrontendSentryForTests();
  sentryMock.init.mockClear();
  sentryMock.replayIntegration.mockClear();
  sentryMock.captureMessage.mockClear();
  Object.values(sentryMock.logger).forEach((mock) => mock.mockClear());
  sentryMock.withScope.mockClear();
  sentryMock.metrics.count.mockClear();
  Object.values(sentryMock.scope).forEach((mock) => mock.mockClear());
});

describe('getFrontendSentryConfig', () => {
  it('returns null when no DSN is configured', () => {
    expect(getFrontendSentryConfig({ MODE: 'test' })).toBeNull();
  });

  it('parses release, sampling, logs, replay, and trace targets', () => {
    expect(getFrontendSentryConfig(configuredEnv())).toMatchObject({
      dsn: 'https://public@example.ingest.sentry.io/1',
      environment: 'staging',
      release: 'm365copilot-game@abc123',
      tracesSampleRate: 0.25,
      tracePropagationTargets: ['https://api.example.com'],
      enableLogs: true,
      replaySessionSampleRate: 0.05,
      replayErrorSampleRate: 0.75,
      replayMaskAllText: true,
      replayMaskAllInputs: true,
      replayBlockAllMedia: true,
    });
  });

  it('falls back to a git-SHA release name when only VITE_GIT_SHA is present', () => {
    const config = getFrontendSentryConfig(
      configuredEnv({ VITE_SENTRY_RELEASE: '', VITE_GIT_SHA: 'deadbee' }),
    );
    expect(config?.release).toBe('m365copilot-game@deadbee');
  });
});

describe('initFrontendSentry', () => {
  it('does not initialize Sentry when the DSN is absent', () => {
    expect(initFrontendSentry(app, { MODE: 'test' })).toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it('initializes with privacy-safe replay and tags', () => {
    expect(initFrontendSentry(app, configuredEnv())).toBe(true);
    expect(sentryMock.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    const options = sentryMock.init.mock.calls[0][0];
    expect(options).toMatchObject({
      app,
      dsn: 'https://public@example.ingest.sentry.io/1',
      environment: 'staging',
      release: 'm365copilot-game@abc123',
      sendDefaultPii: false,
      tracesSampleRate: 0.25,
      enableLogs: true,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 0.75,
      initialScope: { tags: { service: 'frontend', runtime: 'browser' } },
    });
  });

  it('allows replay masking to be explicitly disabled for approved diagnostics', () => {
    expect(initFrontendSentry(app, configuredEnv({ VITE_SENTRY_REPLAY_UNMASK: 'true' }))).toBe(
      true,
    );
    expect(sentryMock.replayIntegration).toHaveBeenCalledWith({
      maskAllText: false,
      maskAllInputs: false,
      blockAllMedia: false,
    });
  });
});

describe('sanitizeForSentry', () => {
  it('redacts sensitive keys and email addresses', () => {
    expect(
      sanitizeForSentry({
        email: 'ada@example.com',
        headers: { Authorization: 'Bearer secret', ok: 'support@example.com' },
        nested: { playerToken: 'token', count: 3 },
        status_code: 409,
        workflow_code: 'PLAYER_RECOVERY_REQUIRED',
        error_name: 'TypeError',
        code: '123456',
      }),
    ).toEqual({
      email: '[Filtered]',
      headers: '[Filtered]',
      nested: { playerToken: '[Filtered]', count: 3 },
      status_code: 409,
      workflow_code: 'PLAYER_RECOVERY_REQUIRED',
      error_name: 'TypeError',
      code: '[Filtered]',
    });
  });
});

  describe('normalizeFrontendEndpointPath', () => {
    it('removes query strings and replaces high-cardinality segments', () => {
      expect(normalizeFrontendEndpointPath('/portal-api/admins/ada%40example.com?confirm=1')).toBe(
        '/portal-api/admins/:email',
      );
      expect(normalizeFrontendEndpointPath('/sessions/12345?email=ada@example.com')).toBe(
        '/sessions/:id',
      );
    });
  });

describe('captureFrontendApiFailure', () => {
    it('classifies network failures, ordinary 4xx responses, and 5xx responses', () => {
      expect(
        classifyFrontendApiOutcome({
          method: 'POST',
          path: '/submissions?campaign=APR26',
          status: 0,
          apiBase: '/api',
          error: new Error('offline'),
        }),
      ).toMatchObject({
        statusClass: 'network',
        responseClass: 'network_failure',
        shouldCaptureIssue: true,
        shouldLog: false,
        shouldMetric: false,
        endpointPath: '/submissions',
      });

      expect(
        classifyFrontendApiOutcome({
          method: 'POST',
          path: '/submissions',
          status: 409,
          apiBase: '/api',
          workflowCode: 'PLAYER_RECOVERY_REQUIRED',
        }),
      ).toMatchObject({
        statusClass: '4xx',
        responseClass: 'client_response',
        shouldCaptureIssue: false,
        shouldLog: true,
        shouldMetric: true,
        workflowCode: 'PLAYER_RECOVERY_REQUIRED',
      });

      expect(
        classifyFrontendApiOutcome({
          method: 'GET',
          path: '/leaderboard',
          status: 503,
          apiBase: '/api',
        }),
      ).toMatchObject({
        statusClass: '5xx',
        responseClass: 'server_failure',
        shouldCaptureIssue: true,
        shouldLog: false,
        shouldMetric: false,
      });
    });

    it('captures network and 5xx failures as Issues while logging ordinary 4xx responses', () => {
    initFrontendSentry(app, configuredEnv());

    captureFrontendApiFailure({
      method: 'POST',
      path: '/submissions?campaign=APR26',
      status: 0,
      apiBase: '/api',
      error: new Error('offline'),
    });
    captureFrontendApiFailure({
      method: 'POST',
      path: '/submissions',
      status: 409,
      apiBase: '/api',
      workflowCode: 'PLAYER_RECOVERY_REQUIRED',
    });
    captureFrontendApiFailure({
      method: 'GET',
      path: '/leaderboard',
      status: 503,
      apiBase: '/api',
    });

    expect(sentryMock.captureMessage).toHaveBeenCalledTimes(2);
    expect(sentryMock.captureMessage.mock.calls.map(([message]) => message)).toEqual([
      'Frontend API network failure',
      'Frontend API server failure',
    ]);
    expect(sentryMock.scope.setFingerprint).toHaveBeenCalledWith([
      'frontend-network-failure',
      'POST',
      '/submissions',
      '0',
    ]);
    expect(sentryMock.scope.setFingerprint).toHaveBeenCalledWith([
      'frontend-server-failure',
      'GET',
      '/leaderboard',
      '503',
    ]);
    expect(sentryMock.scope.setTags).toHaveBeenCalledWith(
      expect.objectContaining({
        api_status: '503',
        api_status_class: '5xx',
        response_class: 'server_failure',
      }),
    );
    expect(sentryMock.logger.info).toHaveBeenCalledWith(
      'Frontend API client response',
      expect.objectContaining({
        service: 'frontend',
        runtime: 'browser',
        environment: 'staging',
        release: 'm365copilot-game@abc123',
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
          service: 'frontend',
          runtime: 'browser',
          status_code: '409',
          status_class: '4xx',
          response_class: 'client_response',
          workflow_code: 'PLAYER_RECOVERY_REQUIRED',
        }),
      }),
    );
  });
});

describe('captureFrontendLog', () => {
  it('emits real Sentry Logs with sanitized attributes', () => {
    initFrontendSentry(app, configuredEnv());

    captureFrontendLog('clipboard failed for ada@example.com', 'warn', {
      email: 'ada@example.com',
      status_code: 409,
      workflow_code: 'ASSIGNMENT_NOT_ACTIVE',
    });

    expect(sentryMock.captureMessage).not.toHaveBeenCalled();
    expect(sentryMock.logger.warn).toHaveBeenCalledWith(
      'clipboard failed for [Filtered]',
      expect.objectContaining({
        service: 'frontend',
        runtime: 'browser',
        severity: 'warn',
        email: '[Filtered]',
        status_code: 409,
        workflow_code: 'ASSIGNMENT_NOT_ACTIVE',
      }),
    );
  });
});

describe('runFrontendSentrySmokeCheck', () => {
  it('records the documented test counter before throwing the smoke error', () => {
    initFrontendSentry(app, configuredEnv());
    expect(() => runFrontendSentrySmokeCheck()).toThrow(TypeError);
    expect(sentryMock.metrics.count).toHaveBeenCalledWith('test_counter', 1, {
      tags: {
        service: 'frontend',
        runtime: 'browser',
        environment: 'staging',
        release: 'm365copilot-game@abc123',
      },
    });
  });
});
