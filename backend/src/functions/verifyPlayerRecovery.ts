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
  const tx = new sql.Transaction(pool);
  let transactionActive = false;

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionActive = true;

    const candidate = await tx
      .request()
      .input('email', sql.NVarChar(320), email)
      .input('codeHash', sql.NVarChar(128), codeHash).query<{ id: number }>(`
        SELECT TOP 1 id
        FROM player_recovery_otps WITH (UPDLOCK, HOLDLOCK, READPAST)
        WHERE email = @email
          AND code_hash = @codeHash
          AND used = 0
          AND expires_at > SYSUTCDATETIME()
        ORDER BY created_at DESC
      `);

    const recoveryOtpId = candidate.recordset[0]?.id;
    if (!recoveryOtpId) {
      await tx.commit();
      transactionActive = false;

      const failures = await cacheIncrementWithTtl(key, LOCKOUT_WINDOW_SECONDS, context);
      logVerifyAttempt(context, 'verify_failed', email, {
        ...(failures !== null ? { failure_count: failures } : {}),
      });
      return {
        status: 401,
        jsonBody: { ok: false, message: 'Invalid or expired code' },
      };
    }

    const playerResult = await tx
      .request()
      .input('email', sql.NVarChar(320), email)
      .query<{ id: number }>('SELECT TOP 1 id FROM players WHERE email = @email;');
    const playerId = playerResult.recordset[0]?.id;
    if (!playerId) {
      throw new Error('Player recovery verification failed after code match');
    }

    const token = generatePlayerToken();
    const tokenHash = hashPlayerToken(token);
    await createPlayerDeviceToken(tx, playerId, tokenHash);

    const markUsedResult = await tx
      .request()
      .input('id', sql.Int, recoveryOtpId)
      .query('UPDATE player_recovery_otps SET used = 1, used_at = SYSUTCDATETIME() WHERE id = @id AND used = 0;');

    if (markUsedResult.rowsAffected?.[0] !== 1) {
      await tx.rollback();
      transactionActive = false;

      const failures = await cacheIncrementWithTtl(key, LOCKOUT_WINDOW_SECONDS, context);
      logVerifyAttempt(context, 'verify_failed', email, {
        ...(failures !== null ? { failure_count: failures } : {}),
      });
      return {
        status: 401,
        jsonBody: { ok: false, message: 'Invalid or expired code' },
      };
    }

    await tx.commit();
    transactionActive = false;

    await cacheDelete(key, context);
    logVerifyAttempt(context, 'verify_success', email);

    return {
      cookies: [createPlayerTokenCookie(token)],
      jsonBody: { ok: true, playerToken: token },
    };
  } catch (err) {
    if (transactionActive) {
      try {
        await tx.rollback();
      } catch {
        // no-op: preserve the original verification failure response
      }
    }
    context.error?.('Failed to verify player recovery code', err);
    logVerifyAttempt(context, 'verify_failed', email, { failure_class: 'service_error' });
    return {
      status: 503,
      jsonBody: { ok: false, message: 'Could not verify recovery code. Please try again.' },
    };
  }
};

app.http('verifyPlayerRecovery', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'player/recovery/verify',
  handler,
});
