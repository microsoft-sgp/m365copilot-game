import type { Cookie } from '@azure/functions';

type HeaderReader = {
  get(name: string): string | null;
};

type CookieRequest = {
  headers: HeaderReader;
};

type AdminCookieKind = 'access' | 'refresh' | 'stepUp';

type AdminCookieOptions = {
  maxAgeSeconds: number;
};

export const ADMIN_COOKIE_NAMES = {
  access: process.env.ADMIN_ACCESS_COOKIE_NAME || 'admin_access',
  refresh: process.env.ADMIN_REFRESH_COOKIE_NAME || 'admin_refresh',
  stepUp: process.env.ADMIN_STEP_UP_COOKIE_NAME || 'admin_step_up',
} as const;

export const ADMIN_COOKIE_PATH = process.env.ADMIN_COOKIE_PATH || '/api/portal-api';

export function getAdminAccessTtlSeconds(): number {
  return positiveInteger(process.env.ADMIN_ACCESS_TTL_SECONDS, 15 * 60);
}

export function getAdminRefreshTtlSeconds(): number {
  return positiveInteger(process.env.ADMIN_REFRESH_TTL_SECONDS, 7 * 24 * 60 * 60);
}

export function getAdminStepUpTtlSeconds(): number {
  return positiveInteger(process.env.ADMIN_STEP_UP_TTL_SECONDS, 5 * 60);
}

export function getCookie(request: CookieRequest, name: string): string | undefined {
  const cookies = parseCookieHeader(request.headers.get('cookie') || '');
  return cookies.get(name);
}

export function createAdminCookie(
  kind: AdminCookieKind,
  value: string,
  options: AdminCookieOptions,
): Cookie {
  return {
    ...baseCookieAttributes(kind),
    value,
    maxAge: options.maxAgeSeconds,
  };
}

export function clearAdminCookie(kind: AdminCookieKind): Cookie {
  return {
    ...baseCookieAttributes(kind),
    value: '',
    maxAge: 0,
    expires: new Date(0),
  };
}

export function clearAdminAuthCookies(): Cookie[] {
  return [clearAdminCookie('access'), clearAdminCookie('refresh'), clearAdminCookie('stepUp')];
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

function baseCookieAttributes(kind: AdminCookieKind): Omit<Cookie, 'value'> {
  return {
    name: ADMIN_COOKIE_NAMES[kind],
    path: ADMIN_COOKIE_PATH,
    domain: process.env.ADMIN_COOKIE_DOMAIN || undefined,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: getSameSite(),
  };
}

function shouldUseSecureCookies(): boolean {
  const configured = process.env.ADMIN_COOKIE_SECURE;
  if (configured !== undefined) return configured.toLowerCase() !== 'false';
  return process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_HOSTNAME);
}

function getSameSite(): Cookie['sameSite'] {
  const configured = (process.env.ADMIN_COOKIE_SAMESITE || 'Lax').toLowerCase();
  if (configured === 'none') return 'None';
  if (configured === 'strict') return 'Strict';
  return 'Lax';
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
