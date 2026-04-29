import type { Cookie } from '@azure/functions';

type HeaderReader = {
  get(name: string): string | null;
};

type CookieRequest = {
  headers: HeaderReader;
};

// Cookie scoped to the API path so it's only sent with API calls. SameSite=None
// is required because the SPA runs on a different *.azurewebsites.net subdomain
// than the Function App; secure flag is on in production via the same probe used
// by adminCookies.ts so cookies aren't issued over plain HTTP locally.
export const PLAYER_COOKIE_NAME = process.env.PLAYER_COOKIE_NAME || 'player_token';
export const PLAYER_COOKIE_PATH = process.env.PLAYER_COOKIE_PATH || '/api';

// Tokens never expire on the server side (they are bound to the player row);
// the cookie max-age is a generous one year so it survives across browser
// restarts but eventually gets garbage-collected if the browser is reused
// for years. The DB row is the source of truth; the cookie is just transport.
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function getPlayerCookie(request: CookieRequest): string {
  const cookies = parseCookieHeader(request.headers.get('cookie') || '');
  return cookies.get(PLAYER_COOKIE_NAME) || '';
}

export function createPlayerTokenCookie(token: string): Cookie {
  return {
    ...basePlayerCookieAttributes(),
    value: token,
    maxAge: ONE_YEAR_SECONDS,
  };
}

export function clearPlayerTokenCookie(): Cookie {
  return {
    ...basePlayerCookieAttributes(),
    value: '',
    maxAge: 0,
    expires: new Date(0),
  };
}

function basePlayerCookieAttributes(): Omit<Cookie, 'value'> {
  return {
    name: PLAYER_COOKIE_NAME,
    path: PLAYER_COOKIE_PATH,
    domain: process.env.PLAYER_COOKIE_DOMAIN || undefined,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: getSameSite(),
  };
}

function shouldUseSecureCookies(): boolean {
  const configured = process.env.PLAYER_COOKIE_SECURE;
  if (configured !== undefined) return configured.toLowerCase() !== 'false';
  return process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_HOSTNAME);
}

function getSameSite(): Cookie['sameSite'] {
  const configured = (process.env.PLAYER_COOKIE_SAMESITE || 'None').toLowerCase();
  if (configured === 'lax') return 'Lax';
  if (configured === 'strict') return 'Strict';
  return 'None';
}

function parseCookieHeader(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!key) continue;
    cookies.set(key, decodeCookieValue(value));
  }
  return cookies;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
