import type { HttpRequest } from '@azure/functions';

export type JsonObject = Record<string, unknown>;

export async function readJsonObject(request: HttpRequest): Promise<JsonObject> {
  const body = await request.json();
  return typeof body === 'object' && body !== null ? (body as JsonObject) : {};
}

export function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Return the integer when it falls inside [min, max] (inclusive), otherwise
// null. Non-integer numerics, NaN, and out-of-range values all collapse to
// null so callers can treat "not present" and "out of range" the same way.
export function boundedInteger(value: unknown, min: number, max: number): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

// True only when `value` is a non-empty string that parses as a URL with the
// `https:` protocol. Used to keep admin-supplied links (eg. campaigns.copilot_url)
// safe to render as `:href` later — blocks `javascript:`, `data:`, `http:`, etc.
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSqlErrorNumber(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'number' in error
    ? Number((error as { number?: unknown }).number)
    : undefined;
}

export function isDuplicateSqlKeyError(error: unknown): boolean {
  const errorNumber = getSqlErrorNumber(error);
  return errorNumber === 2627 || errorNumber === 2601;
}
