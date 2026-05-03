import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'vue';

const sentryMock = vi.hoisted(() => {
  const init = vi.fn();
  const replayIntegration = vi.fn((options) => ({ name: 'Replay', options }));
  const captureMessage = vi.fn();
  const scope = {
    setLevel: vi.fn(),
    setTags: vi.fn(),
    setFingerprint: vi.fn(),
    setContext: vi.fn(),
  };
  const withScope = vi.fn((callback) => callback(scope));
  const metrics = { count: vi.fn() };
  return { init, replayIntegration, captureMessage, withScope, metrics, scope };
});

vi.mock('@sentry/vue', () => sentryMock);

const {
  captureFrontendApiFailure,
  getFrontendSentryConfig,
  initFrontendSentry,
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
      }),
    ).toEqual({
      email: '[Filtered]',
      headers: { Authorization: '[Filtered]', ok: '[Filtered]' },
      nested: { playerToken: '[Filtered]', count: 3 },
    });
  });
});

describe('captureFrontendApiFailure', () => {
  it('captures network failures and 5xx responses only', () => {
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
    ]);
  });
});

describe('runFrontendSentrySmokeCheck', () => {
  it('records the documented test counter before throwing the smoke error', () => {
    initFrontendSentry(app, configuredEnv());
    expect(() => runFrontendSentrySmokeCheck()).toThrow(TypeError);
    expect(sentryMock.metrics.count).toHaveBeenCalledWith('test_counter', 1, {
      tags: { service: 'frontend', runtime: 'browser' },
    });
  });
});
