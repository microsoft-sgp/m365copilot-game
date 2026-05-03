import * as Sentry from '@sentry/vue';
import type { App } from 'vue';

type RawEnv = Record<string, string | boolean | undefined>;

type FrontendSentryConfig = {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
  tracePropagationTargets: Array<string | RegExp>;
  enableLogs: boolean;
  replaySessionSampleRate: number;
  replayErrorSampleRate: number;
  replayMaskAllText: boolean;
  replayMaskAllInputs: boolean;
  replayBlockAllMedia: boolean;
};

type CaptureApiFailureOptions = {
  method: string;
  path: string;
  status: number;
  apiBase: string;
  error?: unknown;
};

type MetricCountApi = {
  count: (name: string, value?: number, options?: { tags?: Record<string, string> }) => void;
};

const APP_NAME = 'm365copilot-game';
const FILTERED = '[Filtered]';
const MAX_SANITIZE_DEPTH = 4;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|jwt|secret|password|connection|string|otp|code|admin[-_]?key|player[-_]?token|email|name/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

let initialized = false;
let configured = false;

function stringValue(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function boolValue(value: string | boolean | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = stringValue(value).toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function sampleRate(value: string | boolean | undefined, fallback: number): number {
  const parsed = Number(stringValue(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function splitList(value: string | boolean | undefined): string[] {
  return stringValue(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultRelease(env: RawEnv): string {
  const explicit = stringValue(env.VITE_SENTRY_RELEASE);
  if (explicit) return explicit;
  const gitSha = stringValue(env.VITE_GIT_SHA);
  return gitSha ? `${APP_NAME}@${gitSha}` : '';
}

function defaultTraceTargets(env: RawEnv): Array<string | RegExp> {
  const configuredTargets = splitList(env.VITE_SENTRY_TRACE_PROPAGATION_TARGETS);
  if (configuredTargets.length > 0) return configuredTargets;

  const apiBase = stringValue(env.VITE_API_BASE) || '/api';
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      return [new URL(apiBase).origin];
    } catch {
      return [];
    }
  }

  return [/^\/api/];
}

function replayPrivacyOptions(
  env: RawEnv,
): Pick<FrontendSentryConfig, 'replayMaskAllText' | 'replayMaskAllInputs' | 'replayBlockAllMedia'> {
  const unmaskReplay = boolValue(env.VITE_SENTRY_REPLAY_UNMASK, false);
  return {
    replayMaskAllText: !unmaskReplay,
    replayMaskAllInputs: !unmaskReplay,
    replayBlockAllMedia: !unmaskReplay,
  };
}

export function getFrontendSentryConfig(
  env: RawEnv = import.meta.env,
): FrontendSentryConfig | null {
  const dsn = stringValue(env.VITE_SENTRY_DSN);
  if (!dsn) return null;

  return {
    dsn,
    environment: stringValue(env.VITE_SENTRY_ENVIRONMENT) || stringValue(env.MODE) || 'development',
    release: defaultRelease(env),
    tracesSampleRate: sampleRate(env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
    tracePropagationTargets: defaultTraceTargets(env),
    enableLogs: boolValue(env.VITE_SENTRY_ENABLE_LOGS, true),
    replaySessionSampleRate: sampleRate(env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE, 0.01),
    replayErrorSampleRate: sampleRate(env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE, 1.0),
    ...replayPrivacyOptions(env),
  };
}

function redactString(value: string): string {
  return value.replace(EMAIL_PATTERN, FILTERED);
}

export function sanitizeForSentry(value: unknown, depth = 0): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeForSentry(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  const sanitized: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? FILTERED
      : sanitizeForSentry(entryValue, depth + 1);
  });
  return sanitized;
}

function sanitizeEvent(event: Sentry.Event): Sentry.Event {
  const request = event.request;
  const sanitizedEvent: Sentry.Event = {
    ...event,
    user: undefined,
    extra: sanitizeForSentry(event.extra) as Record<string, unknown> | undefined,
    contexts: sanitizeForSentry(event.contexts) as Sentry.Event['contexts'],
    tags: { ...event.tags, service: 'frontend', runtime: 'browser' },
  };

  if (request) {
    sanitizedEvent.request = {
      ...request,
      cookies: undefined,
      headers: sanitizeForSentry(request.headers) as Record<string, string> | undefined,
      data: sanitizeForSentry(request.data),
    };
  }

  return sanitizedEvent;
}

function sanitizeBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  return {
    ...breadcrumb,
    message:
      typeof breadcrumb.message === 'string'
        ? redactString(breadcrumb.message)
        : breadcrumb.message,
    data: sanitizeForSentry(breadcrumb.data) as Record<string, unknown> | undefined,
  };
}

export function initFrontendSentry(app: App, env: RawEnv = import.meta.env): boolean {
  const config = getFrontendSentryConfig(env);
  configured = Boolean(config);
  if (!config || initialized) return configured;

  const options = {
    app,
    dsn: config.dsn,
    environment: config.environment,
    release: config.release || undefined,
    sendDefaultPii: false,
    tracesSampleRate: config.tracesSampleRate,
    tracePropagationTargets: config.tracePropagationTargets,
    enableLogs: config.enableLogs,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: config.replayMaskAllText,
        maskAllInputs: config.replayMaskAllInputs,
        blockAllMedia: config.replayBlockAllMedia,
      }),
    ],
    replaysSessionSampleRate: config.replaySessionSampleRate,
    replaysOnErrorSampleRate: config.replayErrorSampleRate,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
    initialScope: {
      tags: {
        service: 'frontend',
        runtime: 'browser',
      },
    },
  } as Parameters<typeof Sentry.init>[0] & { enableLogs?: boolean };

  Sentry.init(options);
  initialized = true;
  return true;
}

export function isFrontendSentryEnabled(): boolean {
  return initialized && configured;
}

export function captureFrontendApiFailure(options: CaptureApiFailureOptions): void {
  if (!isFrontendSentryEnabled()) return;
  const isNetworkFailure = options.status === 0;
  const isClientFailure = options.status >= 400 && options.status < 500;
  const isServerFailure = options.status >= 500 && options.status < 600;
  if (!isNetworkFailure && !isClientFailure && !isServerFailure) return;

  const endpointPath = options.path.split('?')[0] || '/';
  const failureClass = isNetworkFailure ? 'network' : isClientFailure ? '4xx' : '5xx';
  const fingerprintKind = isNetworkFailure
    ? 'frontend-network-failure'
    : isClientFailure
      ? 'frontend-client-failure'
      : 'frontend-server-failure';
  const title = isNetworkFailure
    ? 'Frontend API network failure'
    : isClientFailure
      ? 'Frontend API client failure'
      : 'Frontend API server failure';
  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTags({
      service: 'frontend',
      runtime: 'browser',
      api_status: String(options.status),
      api_status_class: failureClass,
      api_method: options.method,
    });
    scope.setFingerprint([fingerprintKind, options.method, endpointPath, String(options.status)]);
    scope.setContext('api', {
      method: options.method,
      path: endpointPath,
      status: options.status,
      statusClass: failureClass,
      apiBase: options.apiBase,
      online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
      errorName: options.error instanceof Error ? options.error.name : undefined,
    });
    Sentry.captureMessage(title);
  });
}

export function captureFrontendLog(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra: Record<string, unknown> = {},
): void {
  if (!isFrontendSentryEnabled()) return;
  Sentry.captureMessage(message, {
    level,
    tags: { service: 'frontend', runtime: 'browser' },
    extra: sanitizeForSentry(extra) as Record<string, unknown>,
  });
}

export function runFrontendSentrySmokeCheck(): void {
  if (!isFrontendSentryEnabled()) return;
  const sentryWithMetrics = Sentry as typeof Sentry & { metrics?: MetricCountApi };
  sentryWithMetrics.metrics?.count('test_counter', 1, {
    tags: { service: 'frontend', runtime: 'browser' },
  });
  const smokeTarget = globalThis as unknown as { myUndefinedFunction?: () => void };
  (smokeTarget.myUndefinedFunction as () => void)();
}

export function resetFrontendSentryForTests(): void {
  initialized = false;
  configured = false;
}
