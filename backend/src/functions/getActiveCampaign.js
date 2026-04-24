import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';

export const handler = async (request, context) => {
  const pool = await getPool();

  const result = await pool
    .request()
    .query(`
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
  return {
    jsonBody: {
      campaignId: c.id,
      displayName: c.display_name,
      totalPacks: c.total_packs,
      totalWeeks: c.total_weeks,
      copilotUrl: c.copilot_url,
    },
  };
};

app.http('getActiveCampaign', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'campaigns/active',
  handler,
});
