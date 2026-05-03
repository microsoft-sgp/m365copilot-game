import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appMock, originalHttpMock, withSentryMock } = vi.hoisted(() => {
  const originalHttpMock = vi.fn();
  return {
    appMock: { http: originalHttpMock } as { http: ReturnType<typeof vi.fn>; __sentryHttpPatched?: boolean },
    originalHttpMock,
    withSentryMock: vi.fn((handler) => handler),
  };
});

vi.mock('@azure/functions', () => ({ app: appMock }));
vi.mock('./sentry.js', () => ({ withSentry: withSentryMock }));

describe('sentryAzureFunctions patcher', () => {
  beforeEach(() => {
    vi.resetModules();
    originalHttpMock.mockReset();
    withSentryMock.mockClear();
    appMock.http = originalHttpMock;
    delete appMock.__sentryHttpPatched;
  });

  it('wraps Azure Functions HTTP handlers with Sentry metadata', async () => {
    await import('./sentryAzureFunctions.js');
    const handler = vi.fn(async () => ({ jsonBody: { ok: true } }));
    const options = { methods: ['GET'], authLevel: 'anonymous', handler };

    appMock.http('health', options);

    expect(withSentryMock).toHaveBeenCalledWith(handler, {
      functionName: 'health',
      runtime: 'azure-functions',
    });
    expect(originalHttpMock).toHaveBeenCalledWith('health', {
      ...options,
      handler,
    });
  });

  it('does not patch an app that has already been patched', async () => {
    const existingHttp = vi.fn();
    appMock.http = existingHttp;
    appMock.__sentryHttpPatched = true;

    await import('./sentryAzureFunctions.js');

    expect(appMock.http).toBe(existingHttp);
    expect(withSentryMock).not.toHaveBeenCalled();
  });
});