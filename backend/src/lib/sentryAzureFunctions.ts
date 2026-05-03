import { app } from '@azure/functions';
import { withSentry } from './sentry.js';

type HttpOptions = Parameters<typeof app.http>[1];
type PatchedApp = typeof app & { __sentryHttpPatched?: boolean };

const patchedApp = app as PatchedApp;

if (!patchedApp.__sentryHttpPatched) {
  const originalHttp = app.http.bind(app);
  patchedApp.http = ((name: string, options: HttpOptions) => {
    return originalHttp(name, {
      ...options,
      handler: withSentry(options.handler, { functionName: name, runtime: 'azure-functions' }),
    });
  }) as typeof app.http;
  patchedApp.__sentryHttpPatched = true;
}
