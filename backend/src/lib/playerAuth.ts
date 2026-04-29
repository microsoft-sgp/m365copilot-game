import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { PLAYER_COOKIE_NAME, getPlayerCookie } from './playerCookies.js';

type HeaderReader = {
  get(name: string): string | null;
};

type PlayerRequest = {
  headers: HeaderReader;
};

// 32 bytes of CSPRNG entropy, base64url encoded → 43-character opaque token.
// The token is never persisted in plaintext; only its SHA-256 digest goes
// into players.owner_token. A leak of the database column therefore yields no
// usable credential.
export function generatePlayerToken(): string {
  return randomBytes(32).toString('base64url');
}

// Hex SHA-256 of the raw token, matching the NVARCHAR(64) column. Hex (not
// base64) because the column already exists with this width and an even-width
// digest is easier to debug in SQL.
export function hashPlayerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Constant-time equality so attackers cannot use response timing to learn
// digest prefixes. Both inputs MUST be 64-character hex strings.
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Header name aligns with the existing X-Admin-Key naming convention used
// elsewhere in the API. Cookie is preferred (HttpOnly); the header is the
// fallback path for browsers that block third-party cookies (Safari ITP).
const PLAYER_TOKEN_HEADER = 'x-player-token';

export function getPlayerTokenFromRequest(request: PlayerRequest): string {
  const cookieToken = getPlayerCookie(request);
  if (cookieToken) return cookieToken;
  const header = request.headers.get(PLAYER_TOKEN_HEADER);
  return typeof header === 'string' ? header : '';
}

// Compare a token presented by the caller against the digest stored in
// players.owner_token. Returns false if either value is missing or mismatched.
// The hash step happens unconditionally so the caller's code path takes the
// same shape regardless of token presence.
export function verifyPlayerOwnsRow(
  presentedToken: string,
  storedHash: string | null | undefined,
): boolean {
  if (!presentedToken || !storedHash) return false;
  const presentedHash = hashPlayerToken(presentedToken);
  return constantTimeEqualHex(presentedHash, storedHash);
}

// Feature flag for the rollout window. Default is enforced; only the explicit
// string "false" disables enforcement, so a missing or malformed env var
// errs on the side of safety.
export function isPlayerTokenEnforcementEnabled(): boolean {
  return process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT !== 'false';
}

export { PLAYER_COOKIE_NAME, PLAYER_TOKEN_HEADER };
