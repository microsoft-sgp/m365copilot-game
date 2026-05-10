import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_CAMPAIGN_ID = 'APR26';
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_REFERRAL_CODE_LENGTH = 64;

function getLogger(logger) {
  return typeof logger?.log === 'function' ? logger : console;
}

function readSeedJson(env) {
  const jsonPayload = env.STUDENT_AMBASSADOR_REFERRALS_JSON?.trim();
  const filePath = env.STUDENT_AMBASSADOR_REFERRALS_FILE?.trim();

  if (jsonPayload && filePath) {
    throw new Error(
      'Set either STUDENT_AMBASSADOR_REFERRALS_JSON or STUDENT_AMBASSADOR_REFERRALS_FILE, not both.',
    );
  }

  if (filePath) {
    return {
      rawJson: readFileSync(resolve(filePath), 'utf8'),
      sourceLabel: 'file',
    };
  }

  if (jsonPayload) {
    return {
      rawJson: jsonPayload,
      sourceLabel: 'environment',
    };
  }

  return null;
}

function normalizeCampaignId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Student Ambassador referral seed campaignId must be a non-empty string.');
  }

  const campaignId = value.trim();
  if (campaignId.length > 20) {
    throw new Error('Student Ambassador referral seed campaignId must be 20 characters or fewer.');
  }

  return campaignId;
}

function normalizeEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`Student Ambassador referral seed entry ${index + 1} must be an object.`);
  }

  const displayNameValue = entry.displayName ?? entry.display_name;
  const referralCodeValue = entry.referralCode ?? entry.referral_code;

  if (typeof displayNameValue !== 'string' || !displayNameValue.trim()) {
    throw new Error(
      `Student Ambassador referral seed entry ${index + 1} requires a non-empty displayName.`,
    );
  }

  if (typeof referralCodeValue !== 'string' || !referralCodeValue.trim()) {
    throw new Error(
      `Student Ambassador referral seed entry ${index + 1} requires a non-empty referralCode.`,
    );
  }

  const displayName = displayNameValue.trim();
  const referralCode = referralCodeValue.trim().toUpperCase();

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(
      `Student Ambassador referral seed entry ${index + 1} displayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
    );
  }

  if (referralCode.length > MAX_REFERRAL_CODE_LENGTH) {
    throw new Error(
      `Student Ambassador referral seed entry ${index + 1} referralCode must be ${MAX_REFERRAL_CODE_LENGTH} characters or fewer.`,
    );
  }

  return { displayName, referralCode };
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error(
      'Student Ambassador referral seed must be a JSON array or an object with ambassadors.',
    );
  }

  if (entries.length === 0) {
    throw new Error('Student Ambassador referral seed must include at least one ambassador.');
  }

  const normalizedEntries = entries.map(normalizeEntry);
  const seenReferralCodes = new Set();

  for (const entry of normalizedEntries) {
    if (seenReferralCodes.has(entry.referralCode)) {
      throw new Error('Student Ambassador referral seed contains duplicate referralCode values.');
    }

    seenReferralCodes.add(entry.referralCode);
  }

  return normalizedEntries;
}

export function loadStudentAmbassadorReferralSeed(env = process.env) {
  const seedJson = readSeedJson(env);
  if (!seedJson) return null;

  let parsed;
  try {
    parsed = JSON.parse(seedJson.rawJson);
  } catch (err) {
    throw new Error(`Student Ambassador referral seed JSON is invalid: ${err.message}`);
  }

  const campaignId = normalizeCampaignId(
    env.STUDENT_AMBASSADOR_REFERRALS_CAMPAIGN_ID ?? parsed.campaignId ?? DEFAULT_CAMPAIGN_ID,
  );
  const entries = normalizeEntries(Array.isArray(parsed) ? parsed : parsed.ambassadors);

  return {
    campaignId,
    entries,
    sourceLabel: seedJson.sourceLabel,
  };
}

export async function seedStudentAmbassadorReferrals(pool, sql, options = {}) {
  const logger = getLogger(options.logger);
  const seed = loadStudentAmbassadorReferralSeed(options.env ?? process.env);

  if (!seed) {
    logger.log('No private Student Ambassador referral seed configured; skipping.');
    return { applied: false, count: 0 };
  }

  await pool
    .request()
    .input('campaignId', sql.NVarChar(20), seed.campaignId)
    .input('seedJson', sql.NVarChar(sql.MAX), JSON.stringify(seed.entries))
    .query(`
      SET XACT_ABORT ON;

      IF NOT EXISTS (SELECT 1 FROM campaigns WHERE id = @campaignId)
      BEGIN
          THROW 51013, 'Campaign must exist before seeding student ambassador referral codes.', 1;
      END;

      DECLARE @student_ambassadors TABLE (
          display_name NVARCHAR(200) NOT NULL,
          referral_code NVARCHAR(64) NOT NULL PRIMARY KEY
      );

      INSERT INTO @student_ambassadors (display_name, referral_code)
      SELECT display_name, referral_code
      FROM OPENJSON(@seedJson)
      WITH (
          display_name NVARCHAR(200) '$.displayName',
          referral_code NVARCHAR(64) '$.referralCode'
      );

      MERGE student_ambassadors WITH (HOLDLOCK) AS target
      USING @student_ambassadors AS source
          ON target.campaign_id = @campaignId
         AND target.referral_code = source.referral_code
      WHEN MATCHED AND (
          target.display_name <> source.display_name
          OR target.active = 0
      ) THEN
          UPDATE SET
              display_name = source.display_name,
              active = 1,
              updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED BY TARGET THEN
          INSERT (campaign_id, display_name, referral_code, active)
          VALUES (@campaignId, source.display_name, source.referral_code, 1)
      WHEN NOT MATCHED BY SOURCE AND target.campaign_id = @campaignId THEN
          UPDATE SET
              active = 0,
              updated_at = SYSUTCDATETIME();
    `);

  logger.log(
    `Seeded ${seed.entries.length} private Student Ambassador referral code(s) for campaign ${seed.campaignId} from ${seed.sourceLabel}.`,
  );

  return { applied: true, count: seed.entries.length, campaignId: seed.campaignId };
}
