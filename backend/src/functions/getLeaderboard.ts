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

type LeaderboardRecord = {
  org: string;
  score: number;
  contributors: number;
  lastSubmission: Date | string | null;
};

type ContributorRecord = {
  org: string;
  nickname: string;
  score: number;
  totalContributors: number;
};

function groupContributors(rows: ContributorRecord[]): Map<string, ContributorRecord[]> {
  const grouped = new Map<string, ContributorRecord[]>();
  for (const row of rows) {
    const orgRows = grouped.get(row.org) || [];
    orgRows.push(row);
    grouped.set(row.org, orgRows);
  }
  return grouped;
}

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

  const contributorRows =
    result.recordset.length === 0
      ? []
      : useLegacySubmissionSource
        ? (
            await pool.request().input('campaign', sql.NVarChar(20), campaign).query(`
              WITH contributor_scores AS (
                SELECT
                  o.name AS org,
                  p.player_name AS nickname,
                  COUNT(DISTINCT s.keyword) AS score,
                  MAX(s.created_at) AS lastContribution
                FROM submissions s
                JOIN organizations o ON s.org_id = o.id
                JOIN players p ON s.player_id = p.id
                WHERE s.campaign_id = @campaign
                GROUP BY o.name, p.id, p.player_name
              ), ranked AS (
                SELECT
                  org,
                  nickname,
                  score,
                  ROW_NUMBER() OVER (
                    PARTITION BY org
                    ORDER BY score DESC, lastContribution DESC, nickname ASC
                  ) AS contributorRank,
                  COUNT(*) OVER (PARTITION BY org) AS totalContributors
                FROM contributor_scores
              )
              SELECT org, nickname, score, totalContributors
              FROM ranked
              WHERE contributorRank <= 5
              ORDER BY org ASC, contributorRank ASC;
            `)
          ).recordset
        : (
            await pool.request().input('campaign', sql.NVarChar(20), campaign).query(`
              WITH contributor_scores AS (
                SELECT
                  COALESCE(o.name, 'UNMAPPED') AS org,
                  p.player_name AS nickname,
                  COUNT(*) AS score,
                  MAX(ps.created_at) AS lastContribution
                FROM progression_scores ps
                JOIN players p ON ps.player_id = p.id
                LEFT JOIN organizations o ON ps.org_id = o.id
                WHERE ps.campaign_id = @campaign
                GROUP BY COALESCE(o.name, 'UNMAPPED'), ps.player_id, p.player_name
              ), ranked AS (
                SELECT
                  org,
                  nickname,
                  score,
                  ROW_NUMBER() OVER (
                    PARTITION BY org
                    ORDER BY score DESC, lastContribution DESC, nickname ASC
                  ) AS contributorRank,
                  COUNT(*) OVER (PARTITION BY org) AS totalContributors
                FROM contributor_scores
              )
              SELECT org, nickname, score, totalContributors
              FROM ranked
              WHERE contributorRank <= 5
              ORDER BY org ASC, contributorRank ASC;
            `)
          ).recordset;

  const contributorsByOrg = groupContributors(contributorRows as ContributorRecord[]);

  const leaderboard = result.recordset.map((row, i) => ({
    rank: i + 1,
    org: row.org,
    score: row.score,
    contributors: row.contributors,
    topContributors: (contributorsByOrg.get(row.org) || []).map((contributor) => ({
      nickname: contributor.nickname,
      score: contributor.score,
    })),
    hiddenContributorCount: Math.max(
      0,
      Number(row.contributors || 0) - (contributorsByOrg.get(row.org) || []).length,
    ),
    lastSubmission: row.lastSubmission,
  })) as Array<LeaderboardRecord & { rank: number }>;

  await cacheSetJson(cacheKey, leaderboard, getPublicCacheTtlSeconds('leaderboard'), context);

  return { jsonBody: { leaderboard } };
};

app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler,
});
