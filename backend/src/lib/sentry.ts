import * as Sentry from '@sentry/node';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

type BackendRuntime = 'azure-functions' | 'local-express';
type RawEnv = NodeJS.ProcessEnv;
type AzureHttpHandler = (
  request: HttpRequest,
  context: InvocationContext,
) => Promise<HttpResponseInit> | HttpResponseInit;
type MetricCountApi = {
  count: (name: string, value?: number, options?: { tags?: Record<string, string> }) => void;
};

type CaptureContext = {
  runtime?: BackendRuntime;
  functionName?: string;
  request?: Partial<HttpRequest> | null;
  context?: InvocationContext | { log?: unknown } | null;
  extra?: Record<string, unknown>;
};

const APP_NAME = 'm365copilot-game';
const FILTERED = '[Filtered]';
const MAX_SANITIZE_DEPTH = 4;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|jwt|secret|password|connection|string|otp|code|admin[-_]?key|player[-_]?token|email|name/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

let initialized = false;
let configured = false;
let activeRuntime: BackendRuntime = 'azure-functions';

function stringValue(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function boolValue(value: string | undefined, fallback = false): boolean {
  const normalized = stringValue(value).toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function numberValue(value: string | undefined, fallback: number): number {
  const parsed = Number(stringValue(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sampleRate(value: string | undefined, fallback: number): number {
  const parsed = numberValue(value, fallback);
  return Math.min(1, Math.max(0, parsed));
}

function defaultRelease(env: RawEnv): string {
  const explicit = stringValue(env.SENTRY_RELEASE);
  if (explicit) return explicit;
  const gitSha = stringValue(env.GITHUB_SHA);
  return gitSha ? `${APP_NAME}@${gitSha}` : '';
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
    tags: { ...event.tags, service: 'backend', runtime: activeRuntime },
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
    message: typeof breadcrumb.message === 'string' ? redactString(breadcrumb.message) : breadcrumb.message,
    data: sanitizeForSentry(breadcrumb.data) as Record<string, unknown> | undefined,
  };
}

function getFlushTimeoutMs(): number {
  return Math.max(0, numberValue(process.env.SENTRY_FLUSH_TIMEOUT_MS, 2000));
}

function requestContext(request?: Partial<HttpRequest> | null): Record<string, unknown> | undefined {
  if (!request) return undefined;
  return {
    method: request.method,
    url: request.url,
    params: sanitizeForSentry(request.params),
  };
}

export function initBackendSentry(runtime: BackendRuntime = 'azure-functions', env: RawEnv = process.env): boolean {
  activeRuntime = runtime;
  const dsn = stringValue(env.SENTRY_DSN);
  configured = Boolean(dsn);
  if (!dsn || initialized) return configured;

  const options = {
    dsn,
    environment: stringValue(env.SENTRY_ENVIRONMENT) || stringValue(env.NODE_ENV) || 'development',
    release: defaultRelease(env) || undefined,
    sendDefaultPii: false,
    tracesSampleRate: sampleRate(env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    enableLogs: boolValue(env.SENTRY_ENABLE_LOGS, true),
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
    initialScope: {
      tags: {
        service: 'backend',
        runtime,
      },
    },
  } as Parameters<typeof Sentry.init>[0] & { enableLogs?: boolean };

  Sentry.init(options);
  initialized = true;
  return true;
}

export function isBackendSentryEnabled(): boolean {
  return initialized && configured;
}

export async function flushBackendSentry(): Promise<void> {
  if (!isBackendSentryEnabled()) return;
  await Sentry.flush(getFlushTimeoutMs());
}

export async function captureBackendException(error: unknown, captureContext: CaptureContext = {}): Promise<void> {
  const runtime = captureContext.runtime || activeRuntime;
  if (!initBackendSentry(runtime)) return;

  Sentry.withScope((scope) => {
    scope.setTags({
      service: 'backend',
      runtime,
      function_name: captureContext.functionName || 'unknown',
    });
    const request = requestContext(captureContext.request);
    if (request) scope.setContext('request', request);
    if (captureContext.extra) {
      scope.setContext('extra', sanitizeForSentry(captureContext.extra) as Record<string, unknown>);
    }
    Sentry.captureException(error);
  });

  await flushBackendSentry();
}

export function withSentry(
  handler: AzureHttpHandler,
  options: { functionName?: string; runtime?: BackendRuntime } = {},
): AzureHttpHandler {
  return async (request, context) => {
    initBackendSentry(options.runtime || 'azure-functions');
    try {
      return await handler(request, context);
    } catch (error) {
      await captureBackendException(error, {
        runtime: options.runtime || 'azure-functions',
        functionName: options.functionName,
        request,
        context,
      });
      throw error;
    }
  };
}

export function shouldCaptureOperationalFailure(): boolean {
  return process.env.NODE_ENV === 'production' || boolValue(process.env.SENTRY_CAPTURE_OPERATIONAL_ERRORS);
}

export async function captureOperationalError(
  category: string,
  details: Record<string, unknown>,
  captureContext: CaptureContext = {},
): Promise<void> {
  if (!shouldCaptureOperationalFailure()) return;
  const runtime = captureContext.runtime || activeRuntime;
  if (!initBackendSentry(runtime)) return;

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTags({
      service: 'backend',
      runtime,
      operational_category: category,
      function_name: captureContext.functionName || 'unknown',
    });
    scope.setContext('operational', sanitizeForSentry(details) as Record<string, unknown>);
    const request = requestContext(captureContext.request);
    if (request) scope.setContext('request', request);
    Sentry.captureMessage(`Operational failure: ${category}`);
  });

  await flushBackendSentry();
}

export function captureBackendLog(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra: Record<string, unknown> = {},
): void {
  if (!initBackendSentry(activeRuntime)) return;
  Sentry.captureMessage(message, {
    level,
    tags: { service: 'backend', runtime: activeRuntime },
    extra: sanitizeForSentry(extra) as Record<string, unknown>,
  });
}

export function incrementBackendMetric(
  name: string,
  value = 1,
  tags: Record<string, string> = {},
): void {
  if (!initBackendSentry(activeRuntime)) return;
  const sentryWithMetrics = Sentry as typeof Sentry & { metrics?: MetricCountApi };
  sentryWithMetrics.metrics?.count(name, value, {
    tags: { service: 'backend', runtime: activeRuntime, ...tags },
  });
}

export function resetBackendSentryForTests(): void {
  initialized = false;
  configured = false;
  activeRuntime = 'azure-functions';
}
