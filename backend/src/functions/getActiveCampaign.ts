import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { getPool } from '../lib/db.js';
import { CACHE_KEYS, cacheGetJson, cacheSetJson, getPublicCacheTtlSeconds } from '../lib/cache.js';

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const cached = await cacheGetJson(CACHE_KEYS.activeCampaign, context);
  if (cached) return { jsonBody: cached };

  const pool = await getPool();

  const result = await pool.request().query(`
      SELECT id, display_name, total_packs, total_weeks, copilot_url
      FROM campaigns
      WHERE is_active = 1;
    `);

  if (result.recordset.length === 0) {
    return {
      status: 404,
      jsonBody: { ok: false, message: 'No active campaign' },
    };
  }

  const c = result.recordset[0];
  const jsonBody = {
    campaignId: c.id,
    displayName: c.display_name,
    totalPacks: c.total_packs,
    totalWeeks: c.total_weeks,
    copilotUrl: c.copilot_url,
  };

  await cacheSetJson(
    CACHE_KEYS.activeCampaign,
    jsonBody,
    getPublicCacheTtlSeconds('activeCampaign'),
    context,
  );

  return { jsonBody };
};

app.http('getActiveCampaign', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'campaigns/active',
  handler,
});
