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

type BackendLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type BackendLogContext =
  | InvocationContext
  | {
      log?: (message: string, details?: Record<string, unknown>) => void;
      error?: (message: string, errorOrDetails?: unknown) => void;
    }
  | null;

type BackendStatusClass = '4xx' | '5xx';

type BackendResponseClass = 'client_response' | 'server_failure';

type CaptureContext = {
  runtime?: BackendRuntime;
  functionName?: string;
  request?: Partial<HttpRequest> | null;
  context?: BackendLogContext;
  extra?: Record<string, unknown>;
};

type CaptureHttpResponseContext = CaptureContext & {
  response?: Partial<HttpResponseInit> | null;
};

const APP_NAME = 'm365copilot-game';
const FILTERED = '[Filtered]';
const UNKNOWN = 'unknown';
const API_CLIENT_RESPONSE_METRIC = 'api.client_response';
const MAX_SANITIZE_DEPTH = 4;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|set[-_]?cookie|headers?|token|jwt|secret|password|connection|string|otp|^code$|code[-_]?hash|verification[-_]?code|recovery[-_]?code|request[-_]?body|response[-_]?body|admin[-_]?key|player[-_]?token|email|name/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SAFE_TELEMETRY_KEYS = new Set([
  'status_code',
  'workflow_code',
  'error_name',
  'errorname',
  'function_name',
  'functionname',
]);

export type BackendHttpOutcome = {
  runtime: BackendRuntime;
  functionName: string;
  method: string;
  path: string;
  status: number;
  statusClass: BackendStatusClass;
  responseClass: BackendResponseClass;
  workflowCode?: string;
  shouldCaptureIssue: boolean;
  shouldLog: boolean;
  shouldMetric: boolean;
  attributes: Record<string, unknown>;
  metricTags: Record<string, string>;
};

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

function getFlushTimeoutMs(): number {
  return Math.max(0, numberValue(process.env.SENTRY_FLUSH_TIMEOUT_MS, 2000));
}

function requestContext(
  request?: Partial<HttpRequest> | null,
): Record<string, unknown> | undefined {
  if (!request) return undefined;
  return {
    method: request.method,
    path: requestPath(request),
    params: sanitizeForSentry(request.params),
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

export function normalizeBackendRequestPath(pathOrUrl: string): string {
  const pathOnly = pathOrUrl.split('?')[0] || '/';
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

function requestPath(request?: Partial<HttpRequest> | null): string | undefined {
  const url = request?.url;
  if (!url) return undefined;
  return normalizeBackendRequestPath(url);
}

function responseStatusClass(status: number): BackendStatusClass | null {
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return null;
}

function workflowCode(value: unknown): string | undefined {
  const sanitized = sanitizeForSentry(value);
  if (typeof sanitized !== 'string' || !sanitized) return undefined;
  return /^[A-Z0-9_-]{2,64}$/.test(sanitized) ? sanitized : undefined;
}

function responseWorkflowCode(response: Partial<HttpResponseInit> | null | undefined): string | undefined {
  const body = response?.jsonBody as { code?: unknown } | null | undefined;
  return workflowCode(body?.code);
}

function baseTelemetryAttributes(runtime: BackendRuntime): Record<string, unknown> {
  return {
    service: 'backend',
    runtime,
    environment:
      stringValue(process.env.SENTRY_ENVIRONMENT) || stringValue(process.env.NODE_ENV) || 'development',
    release: defaultRelease(process.env) || UNKNOWN,
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

function normalizeLogLevel(level: Sentry.SeverityLevel | BackendLogLevel): BackendLogLevel {
  if (level === 'warning') return 'warn';
  if (level === 'log') return 'info';
  if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
    return level as BackendLogLevel;
  }
  return 'info';
}

function emitSentryLog(
  message: string,
  level: BackendLogLevel,
  attributes: Record<string, unknown>,
): void {
  type LogMethod = (message: string, attributes?: Record<string, unknown>) => void;
  const logger = Sentry.logger as unknown as Record<BackendLogLevel, LogMethod>;
  logger[level]?.(message, attributes);
}

function responseRequestContext(
  request?: Partial<HttpRequest> | null,
): Record<string, unknown> | undefined {
  if (!request) return undefined;
  return {
    method: request.method,
    path: requestPath(request),
    params: sanitizeForSentry(request.params),
  };
}

export function initBackendSentry(
  runtime: BackendRuntime = 'azure-functions',
  env: RawEnv = process.env,
): boolean {
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
    beforeSendLog: sanitizeLog,
    beforeBreadcrumb: sanitizeBreadcrumb,
    initialScope: {
      tags: {
        service: 'backend',
        runtime,
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

export function isBackendSentryEnabled(): boolean {
  return initialized && configured;
}

export async function flushBackendSentry(): Promise<void> {
  if (!isBackendSentryEnabled()) return;
  await Sentry.flush(getFlushTimeoutMs());
}

export async function captureBackendException(
  error: unknown,
  captureContext: CaptureContext = {},
): Promise<void> {
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

export async function captureBackendHttpResponse(
  response: Partial<HttpResponseInit> | null | undefined,
  captureContext: CaptureHttpResponseContext = {},
): Promise<void> {
  const runtime = captureContext.runtime || activeRuntime;
  const outcome = classifyBackendHttpResponse(response, captureContext);
  if (!outcome) return;
  if (!initBackendSentry(runtime)) return;

  if (outcome.shouldLog) {
    captureBackendLog('Backend API client response', 'info', outcome.attributes);
    if (outcome.shouldMetric) {
      incrementBackendMetric(API_CLIENT_RESPONSE_METRIC, 1, outcome.metricTags);
    }
    await flushBackendSentry();
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTags({
      service: 'backend',
      runtime: outcome.runtime,
      function_name: outcome.functionName,
      api_status: String(outcome.status),
      api_status_class: outcome.statusClass,
      api_method: outcome.method,
      response_class: outcome.responseClass,
    });
    scope.setFingerprint([
      'backend-returned-response',
      outcome.runtime,
      outcome.functionName,
      outcome.method,
      outcome.path,
      String(outcome.status),
    ]);
    const request = responseRequestContext(captureContext.request);
    if (request) scope.setContext('request', request);
    scope.setContext('response', {
      status: outcome.status,
      statusClass: outcome.statusClass,
      responseClass: outcome.responseClass,
      workflowCode: outcome.workflowCode,
    });
    if (captureContext.extra) {
      scope.setContext('extra', sanitizeForSentry(captureContext.extra) as Record<string, unknown>);
    }
    Sentry.captureMessage('Backend API returned failure');
  });

  await flushBackendSentry();
}

export function classifyBackendHttpResponse(
  response: Partial<HttpResponseInit> | null | undefined,
  captureContext: CaptureHttpResponseContext = {},
): BackendHttpOutcome | null {
  const status = response?.status ?? 200;
  const statusClass = responseStatusClass(status);
  if (!statusClass) return null;

  const runtime = captureContext.runtime || activeRuntime;
  const method = captureContext.request?.method || UNKNOWN;
  const path = requestPath(captureContext.request) || UNKNOWN;
  const functionName = captureContext.functionName || UNKNOWN;
  const safeWorkflowCode = responseWorkflowCode(response);
  const responseClass: BackendResponseClass = statusClass === '4xx' ? 'client_response' : 'server_failure';
  const attributes = sanitizeForSentry({
    ...baseTelemetryAttributes(runtime),
    function_name: functionName,
    http_method: method,
    endpoint_path: path,
    status_code: status,
    status_class: statusClass,
    response_class: responseClass,
    ...(safeWorkflowCode ? { workflow_code: safeWorkflowCode } : {}),
  }) as Record<string, unknown>;

  return {
    runtime,
    functionName,
    method,
    path,
    status,
    statusClass,
    responseClass,
    workflowCode: safeWorkflowCode,
    shouldCaptureIssue: statusClass === '5xx',
    shouldLog: statusClass === '4xx',
    shouldMetric: statusClass === '4xx',
    attributes,
    metricTags: metricTags(attributes),
  };
}

export function withSentry(
  handler: AzureHttpHandler,
  options: { functionName?: string; runtime?: BackendRuntime } = {},
): AzureHttpHandler {
  return async (request, context) => {
    initBackendSentry(options.runtime || 'azure-functions');
    try {
      const response = await handler(request, context);
      await captureBackendHttpResponse(response, {
        runtime: options.runtime || 'azure-functions',
        functionName: options.functionName,
        request,
        context,
      });
      return response;
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
  return (
    process.env.NODE_ENV === 'production' ||
    boolValue(process.env.SENTRY_CAPTURE_OPERATIONAL_ERRORS)
  );
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
  level: Sentry.SeverityLevel | BackendLogLevel = 'info',
  extra: Record<string, unknown> = {},
): void {
  if (!initBackendSentry(activeRuntime)) return;
  const normalizedLevel = normalizeLogLevel(level);
  emitSentryLog(
    redactString(message),
    normalizedLevel,
    sanitizeForSentry({
      ...baseTelemetryAttributes(activeRuntime),
      severity: normalizedLevel,
      ...extra,
    }) as Record<string, unknown>,
  );
}

export function logBackendEvent(
  context: BackendLogContext | undefined,
  event: string,
  level: Sentry.SeverityLevel | BackendLogLevel = 'info',
  details: Record<string, unknown> = {},
  platformError?: unknown,
): void {
  const normalizedLevel = normalizeLogLevel(level);
  if ((normalizedLevel === 'error' || normalizedLevel === 'fatal') && typeof context?.error === 'function') {
    context.error(event, platformError ?? details);
  } else if (typeof context?.log === 'function') {
    context.log(event, details);
  }
  captureBackendLog(event, normalizedLevel, details);
}

export function incrementBackendMetric(
  name: string,
  value = 1,
  tags: Record<string, string> = {},
): void {
  if (!initBackendSentry(activeRuntime)) return;
  const sentryWithMetrics = Sentry as typeof Sentry & { metrics?: MetricCountApi };
  sentryWithMetrics.metrics?.count(name, value, {
    tags: metricTags({ service: 'backend', runtime: activeRuntime, ...tags }),
  });
}

export function resetBackendSentryForTests(): void {
  initialized = false;
  configured = false;
  activeRuntime = 'azure-functions';
}
