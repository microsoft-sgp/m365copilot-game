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

export function getSqlErrorNumber(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'number' in error
    ? Number((error as { number?: unknown }).number)
    : undefined;
}

export function isDuplicateSqlKeyError(error: unknown): boolean {
  const errorNumber = getSqlErrorNumber(error);
  return errorNumber === 2627 || errorNumber === 2601;
}
