import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { cacheDelete, cacheGetCounter, cacheIncrementWithTtl } from '../lib/cache.js';
import {
  createPlayerDeviceToken,
  generatePlayerToken,
  hashPlayerRecoveryCode,
  hashPlayerToken,
  normalizePlayerEmail,
  playerEmailHash,
} from '../lib/playerAuth.js';
import { createPlayerTokenCookie } from '../lib/playerCookies.js';
import { readJsonObject, stringValue } from './http.js';

const MAX_VERIFY_FAILURES = 5;
const LOCKOUT_WINDOW_SECONDS = 10 * 60;

function failureKey(email: string): string {
  return `player_recovery_verify_failures:${playerEmailHash(email)}`;
}

function logVerifyAttempt(
  context: InvocationContext,
  outcome: 'verify_success' | 'verify_failed' | 'locked_out',
  email: string,
  details: Record<string, unknown> = {},
): void {
  if (typeof context.log !== 'function') return;
  context.log('player_recovery_verify', {
    outcome,
    email_hash: playerEmailHash(email),
    ...details,
  });
}

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const body = await readJsonObject(request);
  const email = normalizePlayerEmail(stringValue(body.email));
  const code = stringValue(body.code).trim();

  if (!email || !code) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Email and code are required' },
    };
  }

  const key = failureKey(email);
  const existingFailures = await cacheGetCounter(key, context);
  if (existingFailures >= MAX_VERIFY_FAILURES) {
    logVerifyAttempt(context, 'locked_out', email, { failure_count: existingFailures });
    return {
      status: 429,
      jsonBody: {
        ok: false,
        message: 'Too many invalid attempts. Please request a new code and try again later.',
      },
    };
  }

  const pool = await getPool();
  const codeHash = hashPlayerRecoveryCode(code);
  const consumed = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('codeHash', sql.NVarChar(128), codeHash).query<{ id: number }>(`
      ;WITH candidate AS (
        SELECT TOP 1 id
        FROM player_recovery_otps WITH (UPDLOCK, READPAST)
        WHERE email = @email
          AND code_hash = @codeHash
          AND used = 0
          AND expires_at > SYSUTCDATETIME()
        ORDER BY created_at DESC
      )
      UPDATE player_recovery_otps
      SET used = 1,
          used_at = SYSUTCDATETIME()
      OUTPUT inserted.id
      WHERE id IN (SELECT id FROM candidate);
    `);

  if (consumed.rowsAffected?.[0] !== 1) {
    const failures = await cacheIncrementWithTtl(key, LOCKOUT_WINDOW_SECONDS, context);
    logVerifyAttempt(context, 'verify_failed', email, {
      ...(failures !== null ? { failure_count: failures } : {}),
    });
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid or expired code' },
    };
  }

  const playerResult = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .query<{ id: number }>('SELECT TOP 1 id FROM players WHERE email = @email;');
  const playerId = playerResult.recordset[0]?.id;
  if (!playerId) {
    logVerifyAttempt(context, 'verify_failed', email);
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid or expired code' },
    };
  }

  const token = generatePlayerToken();
  const tokenHash = hashPlayerToken(token);
  await createPlayerDeviceToken(pool, playerId, tokenHash);
  await cacheDelete(key, context);
  logVerifyAttempt(context, 'verify_success', email);

  return {
    cookies: [createPlayerTokenCookie(token)],
    jsonBody: { ok: true, playerToken: token },
  };
};

app.http('verifyPlayerRecovery', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'player/recovery/verify',
  handler,
});