import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { randomInt } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { sendPlayerRecoveryEmail } from '../lib/email.js';
import {
  hashPlayerRecoveryCode,
  normalizePlayerEmail,
  playerEmailHash,
} from '../lib/playerAuth.js';
import { readJsonObject, stringValue } from './http.js';

const REQUEST_COOLDOWN_MS = 60_000;
const CODE_TTL_MS = 10 * 60 * 1000;

type RequestOutcome =
  | 'sent'
  | 'dev_skipped'
  | 'not_found_neutral'
  | 'rate_limited'
  | 'email_failed';

function logRequestAttempt(
  context: InvocationContext,
  outcome: RequestOutcome,
  email: string,
  details: Record<string, unknown> = {},
): void {
  if (typeof context.log !== 'function') return;
  context.log('player_recovery_request', {
    outcome,
    email_hash: playerEmailHash(email),
    ...details,
  });
}

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const body = await readJsonObject(request);
  const email = normalizePlayerEmail(stringValue(body.email));

  if (!email || !email.includes('@')) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Valid email is required' },
    };
  }

  const successResponse = {
    jsonBody: { ok: true, message: 'If this email is registered, a recovery code has been sent.' },
  };

  const pool = await getPool();
  const playerResult = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .query<{ id: number; owner_token: string | null }>(`
      SELECT TOP 1 id, owner_token
      FROM players
      WHERE email = @email;
    `);
  const player = playerResult.recordset[0];

  if (!player?.owner_token) {
    logRequestAttempt(context, 'not_found_neutral', email);
    return successResponse;
  }

  const recent = await pool.request().input('email', sql.NVarChar(320), email).query(`
    SELECT TOP 1 created_at
    FROM player_recovery_otps
    WHERE email = @email
    ORDER BY created_at DESC;
  `);

  if (recent.recordset.length > 0) {
    const lastCreated = new Date(recent.recordset[0].created_at);
    if (Date.now() - lastCreated.getTime() < REQUEST_COOLDOWN_MS) {
      logRequestAttempt(context, 'rate_limited', email);
      return {
        status: 429,
        jsonBody: { ok: false, message: 'Please wait before requesting another code' },
      };
    }
  }

  const code = String(randomInt(100000, 1_000_000));
  const codeHash = hashPlayerRecoveryCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const insertResult = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('codeHash', sql.NVarChar(128), codeHash)
    .input('expiresAt', sql.DateTime2, expiresAt).query(`
      INSERT INTO player_recovery_otps (email, code_hash, expires_at)
      OUTPUT inserted.id
      VALUES (@email, @codeHash, @expiresAt);
    `);

  const emailResult = await sendPlayerRecoveryEmail(email, code, context);
  if (!emailResult.ok) {
    const otpId = insertResult.recordset[0].id;
    await pool
      .request()
      .input('id', sql.Int, otpId)
      .query('UPDATE player_recovery_otps SET used = 1, used_at = SYSUTCDATETIME() WHERE id = @id;');

    logRequestAttempt(context, 'email_failed', email, {
      latency_ms: emailResult.latencyMs,
      acs_send_status:
        emailResult.status === 'non_succeeded' && emailResult.acsStatus
          ? `non_succeeded_status:${emailResult.acsStatus}`
          : emailResult.status,
      ...(emailResult.messageId ? { acs_message_id: emailResult.messageId } : {}),
      ...(emailResult.errorName ? { error_name: emailResult.errorName } : {}),
    });

    return {
      status: 503,
      jsonBody: { ok: false, message: 'Could not send recovery code. Please try again later.' },
    };
  }

  logRequestAttempt(context, emailResult.skipped ? 'dev_skipped' : 'sent', email, {
    latency_ms: emailResult.latencyMs,
    ...(emailResult.messageId ? { acs_message_id: emailResult.messageId } : {}),
  });
  return successResponse;
};

app.http('requestPlayerRecovery', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'player/recovery/request',
  handler,
});