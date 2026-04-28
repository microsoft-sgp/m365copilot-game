import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import {
  CACHE_KEYS,
  cacheGetJson,
  cacheSetJson,
  getLeaderboardSource,
  getPublicCacheTtlSeconds,
} from '../lib/cache.js';

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const campaign = request.query.get('campaign') || 'APR26';
  const useLegacySubmissionSource = process.env.LEADERBOARD_SOURCE === 'submissions';
  const cacheKey = CACHE_KEYS.leaderboard(campaign, getLeaderboardSource());
  const cached = await cacheGetJson(cacheKey, context);
  if (cached) return { jsonBody: { leaderboard: cached } };

  const pool = await getPool();
  const result = useLegacySubmissionSource
    ? await pool.request().input('campaign', sql.NVarChar(20), campaign).query(`
        SELECT
          o.name AS org,
          COUNT(DISTINCT s.keyword) AS score,
          COUNT(DISTINCT p.email) AS contributors,
          MAX(s.created_at) AS lastSubmission
        FROM submissions s
        JOIN organizations o ON s.org_id = o.id
        JOIN players p ON s.player_id = p.id
        WHERE s.campaign_id = @campaign
        GROUP BY o.name
        ORDER BY score DESC, o.name ASC;
      `)
    : await pool.request().input('campaign', sql.NVarChar(20), campaign).query(`
        SELECT
          COALESCE(o.name, 'UNMAPPED') AS org,
          COUNT(*) AS score,
          COUNT(DISTINCT ps.player_id) AS contributors,
          MAX(ps.created_at) AS lastSubmission
        FROM progression_scores ps
        LEFT JOIN organizations o ON ps.org_id = o.id
        WHERE ps.campaign_id = @campaign
        GROUP BY COALESCE(o.name, 'UNMAPPED')
        ORDER BY score DESC, org ASC;
      `);

  const leaderboard = result.recordset.map((row, i) => ({
    rank: i + 1,
    org: row.org,
    score: row.score,
    contributors: row.contributors,
    lastSubmission: row.lastSubmission,
  }));

  await cacheSetJson(cacheKey, leaderboard, getPublicCacheTtlSeconds('leaderboard'), context);

  return { jsonBody: { leaderboard } };
};

app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler,
});
