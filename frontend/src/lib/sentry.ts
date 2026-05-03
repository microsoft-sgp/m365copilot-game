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
  workflowCode?: string;
};

type FrontendLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type FrontendApiStatusClass = 'network' | '4xx' | '5xx';

type FrontendApiResponseClass = 'network_failure' | 'client_response' | 'server_failure';

export type FrontendApiOutcome = {
  method: string;
  endpointPath: string;
  status: number;
  statusClass: FrontendApiStatusClass;
  responseClass: FrontendApiResponseClass;
  apiHost: string;
  workflowCode?: string;
  errorName?: string;
  shouldCaptureIssue: boolean;
  shouldLog: boolean;
  shouldMetric: boolean;
  issueTitle: string;
  fingerprintKind: string;
  attributes: Record<string, unknown>;
  metricTags: Record<string, string>;
};

type MetricCountApi = {
  count: (name: string, value?: number, options?: { tags?: Record<string, string> }) => void;
};

const APP_NAME = 'm365copilot-game';
const FILTERED = '[Filtered]';
const UNKNOWN = 'unknown';
const API_CLIENT_RESPONSE_METRIC = 'api.client_response';
const MAX_SANITIZE_DEPTH = 4;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|set[-_]?cookie|headers?|token|jwt|secret|password|connection|string|otp|^code$|code[-_]?hash|verification[-_]?code|recovery[-_]?code|request[-_]?body|response[-_]?body|admin[-_]?key|player[-_]?token|email|name/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SAFE_TELEMETRY_KEYS = new Set(['status_code', 'workflow_code', 'error_name']);

let initialized = false;
let configured = false;
let activeConfig: Pick<FrontendSentryConfig, 'environment' | 'release'> | null = null;

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
    sanitized[key] = !SAFE_TELEMETRY_KEYS.has(key.toLowerCase()) && SENSITIVE_KEY_PATTERN.test(key)
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

function sanitizeLog<T extends { attributes?: unknown; message?: unknown }>(log: T): T {
  return {
    ...log,
    message: typeof log.message === 'string' ? redactString(log.message) : log.message,
    attributes: sanitizeForSentry(log.attributes),
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeEndpointSegment(segment: string): string {
  const decoded = safeDecode(segment);
  if (!decoded) return '';
  if (/^\d+$/.test(decoded)) return ':id';
  if (decoded.includes('@') || /%40/i.test(segment)) return ':email';
  if (/^[0-9a-f]{16,}$/i.test(decoded) || /^[A-Za-z0-9_-]{24,}$/.test(decoded)) return ':value';
  return redactString(decoded);
}

export function normalizeFrontendEndpointPath(path: string): string {
  const pathOnly = path.split('?')[0] || '/';
  let pathname = pathOnly;
  if (pathOnly.startsWith('http://') || pathOnly.startsWith('https://')) {
    try {
      pathname = new URL(pathOnly).pathname || '/';
    } catch {
      pathname = pathOnly;
    }
  }

  const normalized = pathname
    .split('/')
    .map(normalizeEndpointSegment)
    .join('/');
  return normalized.startsWith('/') ? normalized || '/' : `/${normalized}`;
}

function apiHost(apiBase: string): string {
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      return new URL(apiBase).host || UNKNOWN;
    } catch {
      return UNKNOWN;
    }
  }
  if (typeof window !== 'undefined' && window.location?.host) return window.location.host;
  return 'same-origin';
}

function workflowCode(value: unknown): string | undefined {
  const sanitized = sanitizeForSentry(value);
  if (typeof sanitized !== 'string' || !sanitized) return undefined;
  return /^[A-Z0-9_-]{2,64}$/.test(sanitized) ? sanitized : undefined;
}

function baseTelemetryAttributes(): Record<string, unknown> {
  return {
    service: 'frontend',
    runtime: 'browser',
    environment: activeConfig?.environment || UNKNOWN,
    release: activeConfig?.release || UNKNOWN,
  };
}

function metricTags(tags: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags).map(([key, value]) => {
      const sanitized = sanitizeForSentry(value);
      if (sanitized === null || sanitized === undefined || sanitized === '') return [key, UNKNOWN];
      if (typeof sanitized === 'string' || typeof sanitized === 'number' || typeof sanitized === 'boolean') {
        return [key, String(sanitized)];
      }
      return [key, FILTERED];
    }),
  );
}

function normalizeLogLevel(level: Sentry.SeverityLevel | FrontendLogLevel): FrontendLogLevel {
  if (level === 'warning') return 'warn';
  if (level === 'log') return 'info';
  if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
    return level as FrontendLogLevel;
  }
  return 'info';
}

function emitSentryLog(
  message: string,
  level: FrontendLogLevel,
  attributes: Record<string, unknown>,
): void {
  type LogMethod = (message: string, attributes?: Record<string, unknown>) => void;
  const logger = Sentry.logger as unknown as Record<FrontendLogLevel, LogMethod>;
  logger[level]?.(message, attributes);
}

function incrementFrontendMetric(
  name: string,
  value = 1,
  tags: Record<string, unknown> = {},
): void {
  if (!isFrontendSentryEnabled()) return;
  const sentryWithMetrics = Sentry as typeof Sentry & { metrics?: MetricCountApi };
  sentryWithMetrics.metrics?.count(name, value, { tags: metricTags(tags) });
}

export function initFrontendSentry(app: App, env: RawEnv = import.meta.env): boolean {
  const config = getFrontendSentryConfig(env);
  configured = Boolean(config);
  if (!config || initialized) return configured;
  activeConfig = { environment: config.environment, release: config.release };

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
    beforeSendLog: sanitizeLog,
    beforeBreadcrumb: sanitizeBreadcrumb,
    initialScope: {
      tags: {
        service: 'frontend',
        runtime: 'browser',
      },
    },
  } as Parameters<typeof Sentry.init>[0] & {
    enableLogs?: boolean;
    beforeSendLog?: (log: { attributes?: unknown; message?: unknown }) => unknown;
  };

  Sentry.init(options);
  initialized = true;
  return true;
}

export function isFrontendSentryEnabled(): boolean {
  return initialized && configured;
}

export function classifyFrontendApiOutcome(
  options: CaptureApiFailureOptions,
): FrontendApiOutcome | null {
  const isNetworkFailure = options.status === 0;
  const isClientFailure = options.status >= 400 && options.status < 500;
  const isServerFailure = options.status >= 500 && options.status < 600;
  if (!isNetworkFailure && !isClientFailure && !isServerFailure) return null;

  const endpointPath = normalizeFrontendEndpointPath(options.path);
  const statusClass: FrontendApiStatusClass = isNetworkFailure
    ? 'network'
    : isClientFailure
      ? '4xx'
      : '5xx';
  const responseClass: FrontendApiResponseClass = isNetworkFailure
    ? 'network_failure'
    : isClientFailure
      ? 'client_response'
      : 'server_failure';
  const safeWorkflowCode = workflowCode(options.workflowCode);
  const attributes = sanitizeForSentry({
    ...baseTelemetryAttributes(),
    http_method: options.method,
    endpoint_path: endpointPath,
    api_host: apiHost(options.apiBase),
    status_code: options.status,
    status_class: statusClass,
    response_class: responseClass,
    ...(safeWorkflowCode ? { workflow_code: safeWorkflowCode } : {}),
    online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
    error_name: options.error instanceof Error ? options.error.name : undefined,
  }) as Record<string, unknown>;

  return {
    method: options.method,
    endpointPath,
    status: options.status,
    statusClass,
    responseClass,
    apiHost: apiHost(options.apiBase),
    workflowCode: safeWorkflowCode,
    errorName: options.error instanceof Error ? options.error.name : undefined,
    shouldCaptureIssue: isNetworkFailure || isServerFailure,
    shouldLog: isClientFailure,
    shouldMetric: isClientFailure,
    issueTitle: isNetworkFailure ? 'Frontend API network failure' : 'Frontend API server failure',
    fingerprintKind: isNetworkFailure ? 'frontend-network-failure' : 'frontend-server-failure',
    attributes,
    metricTags: metricTags(attributes),
  };
}

export function captureFrontendApiFailure(options: CaptureApiFailureOptions): void {
  if (!isFrontendSentryEnabled()) return;
  const outcome = classifyFrontendApiOutcome(options);
  if (!outcome) return;

  if (outcome.shouldLog) {
    captureFrontendLog('Frontend API client response', 'info', outcome.attributes);
    if (outcome.shouldMetric) {
      incrementFrontendMetric(API_CLIENT_RESPONSE_METRIC, 1, outcome.metricTags);
    }
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTags({
      service: 'frontend',
      runtime: 'browser',
      api_status: String(outcome.status),
      api_status_class: outcome.statusClass,
      api_method: outcome.method,
      response_class: outcome.responseClass,
    });
    scope.setFingerprint([
      outcome.fingerprintKind,
      outcome.method,
      outcome.endpointPath,
      String(outcome.status),
    ]);
    scope.setContext('api', {
      method: outcome.method,
      path: outcome.endpointPath,
      status: outcome.status,
      statusClass: outcome.statusClass,
      responseClass: outcome.responseClass,
      apiHost: outcome.apiHost,
      online: outcome.attributes.online,
      errorName: outcome.errorName,
    });
    Sentry.captureMessage(outcome.issueTitle);
  });
}

export function captureFrontendLog(
  message: string,
  level: Sentry.SeverityLevel | FrontendLogLevel = 'info',
  extra: Record<string, unknown> = {},
): void {
  if (!isFrontendSentryEnabled()) return;
  const normalizedLevel = normalizeLogLevel(level);
  emitSentryLog(
    redactString(message),
    normalizedLevel,
    sanitizeForSentry({
      ...baseTelemetryAttributes(),
      severity: normalizedLevel,
      ...extra,
    }) as Record<string, unknown>,
  );
}

export function runFrontendSentrySmokeCheck(): void {
  if (!isFrontendSentryEnabled()) return;
  const sentryWithMetrics = Sentry as typeof Sentry & { metrics?: MetricCountApi };
  sentryWithMetrics.metrics?.count('test_counter', 1, {
    tags: metricTags(baseTelemetryAttributes()),
  });
  const smokeTarget = globalThis as unknown as { myUndefinedFunction?: () => void };
  (smokeTarget.myUndefinedFunction as () => void)();
}

export function resetFrontendSentryForTests(): void {
  initialized = false;
  configured = false;
  activeConfig = null;
}
