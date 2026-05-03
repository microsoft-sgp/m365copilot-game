import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { incrementBackendMetric, logBackendEvent } from '../lib/sentry.js';

function smokeCheckEnabled(): boolean {
  return process.env.SENTRY_SMOKE_CHECK === 'true';
}

export const handler = async (_request: HttpRequest, context: InvocationContext) => {
  if (!smokeCheckEnabled()) {
    return { status: 404, jsonBody: { ok: false, message: 'Not found' } };
  }

  incrementBackendMetric('test_counter', 1, { smoke_check: 'backend' });
  logBackendEvent(context, 'backend_sentry_smoke_log', 'info', { smoke_check: true });
  throw new Error('Controlled backend Sentry smoke check');
};

app.http('sentrySmoke', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'ops/sentry-smoke',
  handler,
});