import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { getPool } from '../lib/db.js';

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const checkedAt = new Date().toISOString();
  let database = 'down';

  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS ok;');
    if (result.recordset && result.recordset[0] && result.recordset[0].ok === 1) {
      database = 'up';
    }
  } catch (err) {
    if (context && typeof context.log === 'function') {
      context.log('Health probe DB failure:', err instanceof Error ? err.message : err);
    }
    database = 'down';
  }

  const status = database === 'up' ? 'healthy' : 'degraded';

  return {
    status: 200,
    jsonBody: {
      ok: database === 'up',
      status,
      api: 'up',
      database,
      checkedAt,
    },
  };
};

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler,
});
