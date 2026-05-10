import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

type ReferralRecord = {
  id: number;
  display_name: string;
  referral_code: string;
};

export type ResolvedReferral = {
  ambassadorId: number;
  campaignId: string;
  displayName: string;
  referralCode: string;
};

export function normalizeReferralCode(value: string | null | undefined): string {
  return (value || '').trim().replace(/\s+/g, '-').toUpperCase();
}

export async function resolveStudentAmbassadorReferral(
  pool: ConnectionPool,
  {
    campaignId,
    referralCode,
  }: {
    campaignId: string;
    referralCode: string;
  },
): Promise<ResolvedReferral | null> {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) return null;

  const result = await pool
    .request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .input('referralCode', sql.NVarChar(64), normalizedCode).query<ReferralRecord>(`
      SELECT TOP 1 id, display_name, referral_code
      FROM student_ambassadors
      WHERE campaign_id = @campaignId
        AND referral_code = @referralCode
        AND active = 1;
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return {
    ambassadorId: row.id,
    campaignId,
    displayName: row.display_name,
    referralCode: row.referral_code,
  };
}

export async function createPlayerReferralAttribution(
  pool: ConnectionPool,
  {
    playerId,
    referral,
  }: {
    playerId: number;
    referral: ResolvedReferral;
  },
): Promise<void> {
  await pool
    .request()
    .input('playerId', sql.Int, playerId)
    .input('ambassadorId', sql.Int, referral.ambassadorId)
    .input('campaignId', sql.NVarChar(20), referral.campaignId)
    .input('referralCode', sql.NVarChar(64), referral.referralCode).query(`
      MERGE player_referrals WITH (HOLDLOCK) AS target
      USING (
        SELECT
          @playerId AS player_id,
          @campaignId AS campaign_id,
          @ambassadorId AS ambassador_id,
          @referralCode AS referral_code
      ) AS source
      ON target.player_id = source.player_id
        AND target.campaign_id = source.campaign_id
      WHEN NOT MATCHED THEN
        INSERT (player_id, ambassador_id, campaign_id, referral_code)
        VALUES (source.player_id, source.ambassador_id, source.campaign_id, source.referral_code);
    `);
}